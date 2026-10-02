// 대국 화면(mockup 배치). 가운데 8×8 판, 왼쪽 판(관 · 목표 · 점수 · 값 × 배수 · 사슬 모습 줄 · 수 · 바꾸기 · 상금 · 주머니),
// 오른쪽(격언 칸 · 손).
// 규칙은 명령으로만 진행하고, 돌아온 사건을 차례로 연출(Seq)하는 동안 화면은 「보이는 판」(view)을 그린다.
import { hint } from '../coach.js';
import { PIECES } from '../../data/pieces.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, dots, line, sprite, num, digits, measure, short, fitNum, fine, artOf } from '../../render/gfx.js';
import { spriteChips, spriteCanvas, outlineCanvas, hiFor, SW, SH, TONE, tierOf } from '../../render/sprites.js';
import { boardCanvas, boardFrameCanvas } from '../../render/texture.js';
import { dropSquaresFor, visibleIncoming, isHidden, overflowTier, OVERFLOW_TIERS, canReboard } from '../../sim/battle.js';
import { chainCaptures, chainRedrops } from '../../sim/chain.js';
import { reach, SLIDERS, LEAPERS } from '../../sim/board.js';
import { FAIRIES, chartForm, isFairy } from '../../data/pieces.js';
import { FAMILY_BY_ID } from '../../data/families.js';
import { familyStrip, josekiBadges, traitMark } from '../parts-depth.js';
import { TRAIT_BY_ID } from '../../data/traits.js';
import { JOSEKI_BY_ID } from '../../data/josekis.js';
import { L, getLang } from '../lang.js';
import { previewCapture, previewDrop } from '../../sim/solver.js';
import { REWARD, ANTES, maximCapacity, maximCount } from '../../sim/run.js';
import { MASTER_BY_ID } from '../../data/masters.js';
import { FACTION_BY_ID } from '../../data/factions.js';
import { drawCrest } from '../../render/crests.js';

// 대국의 세력(버릇 조정자 faction:<id>) — 수업은 없다
export const factionOfBattle = (b) => { const s = b && b.mods && b.mods.find((x) => typeof x.id === 'string' && x.id.startsWith('faction:')); return s ? FACTION_BY_ID[s.id.slice(8)] : null; };
import { LEGEND_BY_ID } from '../../data/legends.js';
import { Seq, ease, lerp } from '../anim.js';
import { sway } from '../sway.js';
import { glow, glowText, groundShadow, flicker } from '../../render/light.js';
import { button } from '../ui.js';
import { maximColumn, maximColumnH, pieceCard, pieceTip, moveTip, discardIcon, panel, tipLines, fitText, itemTip, tacticIcon, SEAL, chartLevel } from '../parts.js';
import { KIND_NAME, KIND_SHORT, PIECE_NAME, PIECE_MOVE, FAIRY_MOVE, PART_NAME, josa } from '../words.js';
import { pauseButton, headLayout, footLayout, sideStack, drawFoot, shardTo, hallText, clockRow, hasClock, clockPips, clockTip } from './common.js';
import { TOP, PAUSE, PAD_BOX, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, LIST_GAP, FAM_H, flow, textY, inkY, BTN_S, EDGE_PAD, rowSpan } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { drawPortrait } from '../../render/portraits.js';
import { wrap } from '../../render/text.js';
import { Marks, drawMarkSquares, drawMarkArrows } from '../marks.js';
import { awakenFlow } from './awaken.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { ANNOT, drawAnnot, annotSize, handTagRect, boardTagRect, offeredRow, drawMore } from '../annot.js';
import { drawStars, starsW, starCount, STAR_N } from '../stars.js';

export const S = 28, BX = 128, BY = 30; // 판 위에 목표 막대 자리를 두려고 mockup(23)보다 7px 내렸다
export const sqXY = (sq) => ({ x: BX + (sq & 7) * S, y: BY + (7 - (sq >> 3)) * S });
// 게임 좌표 → 판 칸(판 밖이면 -1)
export const sqAt = (x, y) => { const f = Math.floor((x - BX) / S), r = 7 - Math.floor((y - BY) / S); return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1; };
export const LX = 8, LW = 112, RX = 360, RW = 112;
// 손 이름표 줄 오른쪽 희생 단추: 아이콘 + 이름이 62 안에 들어가면 그대로. 안 들어가면(영어 「Sacrifice」 굵게 57) 아이콘을 빼고
// 이름에 맞춘 폭(테 1 + 틈 2 양쪽 — 단추 글 안 여백 검사). 손 이름표 줄(handRowLayout)은 이 폭을 뺀 자리를 쓴다(CHM-40)
export function discardButton() {
  const tw = measure('희생', true);
  return tw + 10 + 6 <= 62 ? { w: 62, icon: true } : { w: Math.max(62, tw + 7), icon: false };
}
const BAR_TIERS = OVERFLOW_TIERS; // 목표 막대의 눈금(목표 ×1 · ×2 · ×5 · ×10) = 넘친 층
// 대국 왼쪽 칸(판 틀 공통 쌓기 — common.js sideStack): 머리 칸(관 · 대국 종류 · 목표 · 점수) → 값 × 배수 → 사슬 칸(남는 높이)
// … 아래 칸(수 · 희생 · 상금 · 주머니). 값 × 배수 칸은 값 칸(단추처럼 글이 가운데) 높이 VAL_H.
export const VAL_H = 22;
const clone = (x) => JSON.parse(JSON.stringify(x));

// 값 · 배수 상자에 들어가는 짧은 숫자(gfx.js — 다른 화면도 fitNum으로 쓴다)
export { short };
// 빗금(노림수 · 끊김): 붉은색을 못 가려도 무늬로 알아보게
function hatch(ctx, x, y, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < S * 2; i += 5) for (let j = 0; j < S; j++) { const k = i - j; if (k >= 0 && k < S) ctx.fillRect(x + k, y + j, 1, 1); }
}
// 다시 놓기 아이콘(7×7): 판 넷 칸이 뒤집히는 모양 — 칸 둘은 먹, 둘은 비고 가운데 화살
function reboardIcon(ctx, x, y, col) {
  rect(ctx, x, y, 3, 3, col); rect(ctx, x + 4, y + 4, 3, 3, col);
  rect(ctx, x + 4, y, 3, 1, col); rect(ctx, x + 6, y, 1, 3, col);
  rect(ctx, x, y + 6, 3, 1, col); rect(ctx, x, y + 4, 1, 3, col);
}
// 판 위 사물 「함정」(정석): 칸 안의 어두운 구덩이 + 네 귀퉁이 말뚝. 매복 시너지 빛(회청)
function trapPit(ctx, x, y, size) {
  const i = size >= 24 ? 5 : 3;
  ctx.globalAlpha = 0.55; rect(ctx, x + i, y + i, size - i * 2, size - i * 2, '#1a1512'); ctx.globalAlpha = 1;
  frame(ctx, x + i, y + i, size - i * 2, size - i * 2, '#c0c8d0');
  for (const [a, b] of [[i - 2, i - 2], [size - i, i - 2], [i - 2, size - i], [size - i, size - i]]) rect(ctx, x + a, y + b, 2, 2, '#c0c8d0');
  for (let k = i + 2; k < size - i - 1; k += 3) rect(ctx, x + k, y + size - i - 3, 1, 2, '#6e767e');
}
// 횃불(정석): 이 적은 아무것도 지키지 못한다 — 칸 오른쪽 위의 작은 불꽃(3×5)
function torchMark(ctx, x, y, time) {
  const k = Math.floor(time * 6) % 2;
  rect(ctx, x - 1, y - 1, 7, 10, '#1a1512');
  rect(ctx, x + 2 - k, y, 1, 1, '#fff1b8'); rect(ctx, x + 1, y + 1, 3, 1, '#fff1b8'); rect(ctx, x, y + 2, 5, 2, '#efbd55'); rect(ctx, x + 1, y + 4, 3, 1, '#df8a45');
  rect(ctx, x + 2, y + 5, 1, 3, '#8c6a3a');
}
// 점선(미리 보기의 길)
function dotLine(ctx, x0, y0, x1, y1, col, step = 3) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i += step) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}
// 끊어진 굵은 선(노림수, 2px): off가 늘면 마디가 끝(x1, y1) 쪽으로 흐른다
function dashLine(ctx, x0, y0, x1, y1, col, off = 0) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) if ((((i - off) % 6) + 6) % 6 < 4) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n) - 1, Math.round(y0 + ((y1 - y0) * i) / n) - 1, 2, 2);
}
// 증원 그림자의 떨어질 표(▼ 5×3)
function dropMark(ctx, x, y, col) {
  rect(ctx, x, y, 5, 1, col); rect(ctx, x + 1, y + 1, 3, 1, col); rect(ctx, x + 2, y + 2, 1, 1, col);
}
// 칸 말풍선: 자리는 설명 자리 규칙(판 틀 = 왼쪽 칸, 그 칸의 줄 높이 — placement.js)
// diag: 적 기물의 행마 그림(적 폰은 아래로 먹는다)
function sqTip(title, body, diag = null) {
  return { tip: diag ? moveTip(title, diag, body, { dir: -1 }) : tipLines(title, body) };
}
// 칸 위의 판 사물(정석이 까는 것): [이름, 풀이]. 풀이는 정석 글 그대로(「언제 → 무엇」)
export function objectsAt(rules, sq) {
  const out = [];
  if (!rules) return out;
  if ((rules.steps || []).includes(sq)) out.push(['발판', JOSEKI_BY_ID.stepping.text]);
  if ((rules.gates || []).includes(sq)) out.push(['문', JOSEKI_BY_ID.gates.text]);
  if ((rules.highways || []).includes(sq & 7)) out.push(['고속도로', JOSEKI_BY_ID.highway.text]);
  if ((rules.traps || []).includes(sq)) out.push(['함정', JOSEKI_BY_ID.trap.text]);
  return out;
}
// 판 위 사물 「문」: size×size 칸 안의 아치 문(어두운 청록 안쪽 · 굵은 테 · 문턱). glow = 문 안쪽 빛(0~1)
const GATE = { rim: '#6fd1bf', hi: '#c8f5ea', in: '#1d4d48', glow: '#2f8a7e' };
// 아치의 줄마다 [y, 왼쪽 x, 오른쪽 x]: 위는 반원, 아래는 곧은 기둥(바닥 두 줄 위까지)
function archRows(size, inset) {
  const top = inset - 1, w = size - inset * 2, r = Math.floor(w / 2), cx = inset + (w - 1) / 2, rows = [];
  for (let yy = top; yy < size - 2; yy++) {
    const dy = Math.max(0, r - (yy - top)), dx = Math.sqrt(Math.max(0, r * r - dy * dy));
    rows.push([yy, Math.round(cx - dx), Math.round(cx + dx)]);
  }
  return rows;
}
function gateArch(ctx, x, y, size, glow) {
  const t = size >= 24 ? 2 : 1, inset = size >= 24 ? 3 : 2;
  const outer = archRows(size, inset);
  for (const [yy, a, b] of outer) rect(ctx, x + a, y + yy, b - a + 1, 1, GATE.in);
  ctx.globalAlpha = glow;
  for (const [yy, a, b] of archRows(size, inset + 2)) rect(ctx, x + a, y + yy + 1, b - a + 1, 1, GATE.glow);
  ctx.globalAlpha = 1;
  for (const [yy, a, b] of outer) { rect(ctx, x + a, y + yy, t, 1, GATE.rim); rect(ctx, x + b - t + 1, y + yy, t, 1, GATE.rim); }
  // 윗테: 반원 꼭대기 줄들은 가로로 이어 그린다(1배에서 끊겨 보이지 않게)
  for (let k = 0; k < t; k++) { const [yy, a, b] = outer[k]; rect(ctx, x + a, y + yy, b - a + 1, 1, GATE.rim); }
  rect(ctx, x + 2, y + size - 2, size - 4, 1, GATE.hi);
  rect(ctx, x + inset, y + size - 3, size - inset * 2, 1, GATE.rim);
}
const FALL = 0.2, FALL_PX = 14; // 증원이 위에서 떨어지는 시간(×1) · 높이

// 칸 안의 둥근 고리(다음에 먹을 적)
function ringAt(ctx, x, y, col, thick = 1) {
  for (let k = 0; k < thick; k++) {
    const o = k;
    for (let i = 10; i < 18; i++) { rect(ctx, x + i, y + 3 + o, 1, 1, col); rect(ctx, x + i, y + 24 - o, 1, 1, col); rect(ctx, x + 3 + o, y + i, 1, 1, col); rect(ctx, x + 24 - o, y + i, 1, 1, col); }
    for (const [px, py] of [[8, 5], [9, 4], [18, 4], [19, 5], [5, 8], [4, 9], [22, 8], [23, 9], [4, 18], [5, 19], [23, 18], [22, 19], [8, 22], [9, 23], [18, 23], [19, 22]]) rect(ctx, x + px, y + py, 1, 1, col);
    for (const [px, py] of [[6, 6], [7, 6], [6, 7], [20, 6], [21, 6], [21, 7], [6, 20], [6, 21], [7, 21], [21, 20], [20, 21], [21, 21]]) rect(ctx, x + px, y + py, 1, 1, col);
  }
}
// 먹으러 가는 시간: 미끄러지는 기물은 지나는 칸 수만큼, 나이트는 L자로 한 번 튀고, 폰 · 킹은 한 칸
const dist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
function moveDur(form, from, to, stay = false) {
  if (stay) return 0.16;
  if (LEAPERS.has(form) && !isLine(from, to)) return 0.2;
  if (form === 'P' || form === 'K') return 0.12;
  return 0.08 + 0.035 * Math.min(7, dist(from, to));
}
// 움직이는 기물의 자리(p 0→1): 나이트는 긴 다리 → 짧은 다리, 작은 포물선
const isLine = (a, b) => { const df = (b & 7) - (a & 7), dr = (b >> 3) - (a >> 3); return df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr); };
export function moverXY(form, from, to, p) {
  const a = sqXY(from), c = sqXY(to);
  if (!LEAPERS.has(form) || (isLine(from, to) && form !== 'V')) return { x: lerp(a.x, c.x, p), y: lerp(a.y, c.y, p) };
  // 나이트 L자가 아닌 도약(낙타 · 까마귀)은 한 번의 높은 포물선
  const ddf = Math.abs((to & 7) - (from & 7)), ddr = Math.abs((to >> 3) - (from >> 3));
  if (!((ddf === 1 && ddr === 2) || (ddf === 2 && ddr === 1))) { const q = ease.inOut(p); return { x: lerp(a.x, c.x, q), y: lerp(a.y, c.y, q) - Math.sin(p * Math.PI) * 14, arc: Math.sin(p * Math.PI) * 14 }; }
  const df = (to & 7) - (from & 7);
  const mid = Math.abs(df) === 2 ? { x: c.x, y: a.y } : { x: a.x, y: c.y };
  const q = ease.inOut(p);
  const k = q < 2 / 3 ? q * 1.5 : (q - 2 / 3) * 3;
  const pt = q < 2 / 3 ? { x: lerp(a.x, mid.x, k), y: lerp(a.y, mid.y, k) } : { x: lerp(mid.x, c.x, k), y: lerp(mid.y, c.y, k) };
  return { x: pt.x, y: pt.y - Math.sin(p * Math.PI) * 9, arc: Math.sin(p * Math.PI) * 9 };
}
const bagTip = (b) => {
  const counts = {};
  for (const p of b.bag) counts[p.t] = (counts[p.t] || 0) + 1;
  const parts = ['P', 'N', 'B', 'R', 'Q', ...FAIRIES].filter((t) => counts[t]).map((t) => `${PIECE_NAME[t]} ${counts[t]}`);
  return tipLines('주머니', parts.length ? parts.join(' · ') : '비었다');
};

// 대국이 어디서 오나: 판(런)의 대국(기본) · 첫 수업. 화면은 같은 규칙 · 같은 연출을 쓴다.
//   live()   지금 둘 수 있는 대국(끝나 판에서 빠졌으면 null)
//   cmd(c)   명령 하나 → 사건 배열
//   run      판(런) 상태(없으면 상금 · 격언 칸 · 막간을 그리지 않는다)
export const runSource = (app) => ({ kind: 'run', live: () => app.run.battle, cmd: (c) => app.cmd(c), get run() { return app.run; } });

export class BattleScreen {
  constructor(app, { events = [], source = null } = {}) {
    this.app = app;
    this.src = source || runSource(app);
    this.fx = app.fx;
    this.seq = new Seq();
    this.sel = [];
    this.view = {};
    this.runEvents = [];
    this.bRef = this.src.live();
    this.drops = null;
    this.fast = false;
    this.banner = null;
    this.stamp = null;
    this.lastEnd = null;
    this.notes = 'side'; // 설명 자리: 왼쪽 칸(placement.js). 판 위의 기물 · 손을 가리지 않는다
    this.sync();
    const info = events.find((e) => e.type === 'battleStart');
    const b = this.bRef;
    const m = b.mods.find((s) => MASTER_BY_ID[s.id]);
    if (m) { this.banner = { title: `마스터 ${MASTER_BY_ID[m.id].name}`, sub: MASTER_BY_ID[m.id].text, t: 0, life: 2.6, col: PAL.red, master: m.id }; this.snd('start'); }
    else if (info && this.run) { const fa = factionOfBattle(b); this.banner = { title: `${this.run.ante}관 · ${KIND_NAME[b.kind]}`, sub: `${fa ? `${fa.name} · ` : ''}목표 ${num(b.target)}`, t: 0, life: 1.4, col: PAL.gold }; }
    // 이번 판에서 처음 나온 것(이형 적 · 적 특성 · 판 위 사물 · 금빛 적): 띠 아래에 작은 그림 한 줄
    if (this.banner && info && this.run) {
      const news = this.newThings(b);
      if (news.length) { this.banner.news = news; this.banner.life += 0.8; }
    }
  }

  // 이 대국 판에 처음 나온 것들(이번 판에서 처음). 본 것은 기록(records.runNew)에 판 시드와 함께 — 판 상태는 건드리지 않는다
  newThings(b) {
    const run = this.run, rec = this.app.records;
    const seen = rec.runNew && rec.runNew.seed === run.seed && run.log && run.log.length ? rec.runNew.keys : [];
    const found = new Map();
    const add = (key, it) => { if (!found.has(key)) found.set(key, it); };
    b.board.forEach((c, sq) => {
      if (!c || c.mine || isHidden(b, sq)) return;
      const P = PIECES[c.t];
      if (P && P.fairy) add(`fairy:${c.t}`, { t: c.t });
      if (P && P.thing) add(`thing:${c.t}`, { t: c.t });
      if (c.trait) add(`trait:${c.trait}`, { t: c.t, trait: c.trait });
      if (c.gold) add('gold', { t: c.t, gold: true });
    });
    const r = b.rules || {};
    if ((r.steps || []).length) add('obj:steps', { obj: 'step' });
    if ((r.gates || []).length) add('obj:gates', { obj: 'gate' });
    if ((r.highways || []).length) add('obj:highway', { obj: 'highway' });
    if ((r.traps || []).length) add('obj:traps', { obj: 'trap' });
    if (r.river) add('obj:river', { obj: 'river' });
    b.board.forEach((c) => { if (c && c.muted && !c.mine) add('torch', { t: c.t, muted: true }); });
    const fresh = [...found].filter(([k]) => !seen.includes(k));
    if (!run.scratch) { rec.runNew = { seed: run.seed, keys: [...seen, ...fresh.map(([k]) => k)] }; this.app.saveRecords(); }
    return fresh.slice(0, 8).map(([, it]) => it);
  }

  // 판 한가운데 뜨는 큰 글자는 대국 화면과 함께 사라진다(보상 화면 글자를 덮지 않게)
  onLeave() { this.fx.list = this.fx.list.filter((e) => !e.word); }
  get run() { return this.src.run; }
  live() { return this.src.live(); }
  get b() { return this.live() || this.bRef; }
  snd(name, arg) { this.app.sfx(name, arg); }
  shake(px, dur) { this.app.shake(px, dur); }
  hitstop(sec) { this.app.hitstop(sec); }
  toast(msg, col, dur) { this.app.toast(msg, col, dur); }
  // 알림 자리(CHM-48): 판 아래쪽, 판 폭 안. 위 가운데는 목표 막대 · 얻을 몫(+N)을 덮었다.
  // 판 가운데는 「메이트」 · 「대국 승리」 글자와 마스터 띠, 왼쪽 칸은 목표 · 점수 · 사슬 칸, 오른쪽 칸은 격언 · 손이 쓴다
  // top: 쌓인 알림이 넘지 않을 윗변 — 띠가 떠 있으면 띠 아래, 아니면 판 가운데 큰 글자(「메이트」 네 배) 아래. 넘치면 오래된 것부터 접는다
  toastSpot() {
    let top = BY + 126;
    if (this.banner) { const bb = this.bannerBox(); top = bb.by + bb.bh + 2; }
    return { cx: BX + (S * 8) / 2, w: S * 8 - 8, bottom: BY + S * 8 - 4, top };
  }
  // 대국 시작 띠의 자리(drawOver · toastSpot). 명인 띠: 이름(두 배, 초상 왼쪽 146에 안 들어가면 한 배) → 묶음 틈 → 규칙 글(줄마다 LINE) — 띠 높이는 글에 맞춘다(초상 64 이상)
  bannerBox() {
    const bn = this.banner, row = bn.news ? 26 : 0;
    const TW = 146, mBig = bn.master && measure(bn.title, true) * 2 <= TW;
    const subs = bn.master ? wrap(bn.sub, TW) : [];
    const mh = Math.max(76, PAD_BOX + LINE * 2 + GAP_GROUP + subs.length * LINE + PAD_BOX);
    const bh = (bn.master ? mh : 44) + row, by = BY + 106 - bh / 2;
    return { row, TW, mBig, subs, bh, by };
  }
  get busy() { return this.seq.busy; }

  // 규칙 상태에서 보이는 판을 다시 읽는다(연출이 끝날 때마다)
  sync() {
    const b = this.b;
    const v = this.view;
    v.board = clone(b.board);
    v.hand = clone(b.hand);
    v.score = b.score; v.target = b.target;
    v.movesLeft = b.movesLeft; v.moves = b.rules.moves;
    v.discardsLeft = b.discardsLeft; v.discards = b.rules.discards;
    v.bag = b.bag.length; v.deckSize = b.deckSize;
    // 희생(CHM-43): 새로 뽑은 기물(손 카드의 !?) · 바친 기물(왼쪽 칸 희생 구슬 옆 줄). 규칙 상태를 그대로 읽는다 — 수를 두면 endMove가 b.offering을 비운다
    // 사슬 중(수를 둔 뒤)에는 기회가 이미 그 수에 걸렸으니 손의 「!?」는 없다
    v.drawn = b.status === 'play' && b.offering && b.offering.drawn ? b.offering.drawn.slice() : [];
    v.offered = (b.offered || []).map((p) => p.t);
    v.hiding = null; v.brill = null;
    v.mover = null; v.arrow = null; v.flip = null; v.dropIn = null; v.cut = null; v.gather = null; v.count = null; v.lift = null;
    const c = b.chain;
    if (c && !c.done) {
      v.chain = {
        sq: c.sq, form: c.form, value: c.value, mult: c.mult,
        steps: [...c.captures.map((x) => x.form), c.form],
        path: [c.dropSq, ...c.captures.filter((x) => !x.stay).map((x) => x.at ?? x.to)],
        shots: c.captures.filter((x) => x.stay).map((x) => [x.from, x.to]),
        forced: c.forced ? c.forced.slice() : null, awaiting: c.awaiting ? chainRedrops(b) : null,
        cut: false, eng: c.engraving ? c.engraving.id : null, soul: c.soul ? c.soul.id.replace('soul:', '') : null, awake: !!(c.soul && c.soul.data && c.soul.data.awake), absorbed: c.absorbed ? c.absorbed.slice() : null,
      };
    } else v.chain = null;
    this.targets = null;
    this.drops = null;
    this.pvCache = new Map();
    this.tapSq = null;
    this.kbIdx = null;
    this.sel = this.sel.filter((i) => i < v.hand.length);
  }

  // 지금 누를 수 있는 칸(판이 바뀔 때만 다시 잰다)
  clickable() {
    if (this.busy) return { kind: null, list: [] };
    const b = this.live();
    if (!b) return { kind: null, list: [] };
    if (!this.targets) {
      if (b.status === 'chain') this.targets = b.chain.awaiting ? { kind: 'redrop', list: chainRedrops(b) } : { kind: 'capture', list: chainCaptures(b) };
      else if (b.status === 'play' && this.sel.length === 1) {
        const i = this.sel[0];
        if (!this.drops || this.drops.i !== i) this.drops = { i, list: dropSquaresFor(b, b.hand[i]) };
        this.targets = { kind: 'drop', list: this.drops.list };
      } else this.targets = { kind: null, list: [] };
      this.targets = this.filterTargets(this.targets, b);
    }
    return this.targets;
  }
  // 첫 수업 · 대본 대국이 누를 곳을 좁힌다(평소 대국은 그대로)
  filterTargets(t) { return t; }
  // 대국 복사본에서 두는 중(대본 대국의 「한 번 끊겨 보기」): 판의 기록에 적지 않는다
  get rehearsal() { return false; }
  // 행마 보기(덮개): 지금 판과 손의 기물
  openMoves() { this.app.openOverlay('moves', { battle: this }); }
  // 누를 수 없는 칸을 눌렀다
  missSq() {}

  // 미리 보기: 지금 겨누는 칸(마우스 · 화살표 · 첫 누르기)과 그 결과. 규칙 조회는 칸마다 한 번.
  aimSq(ui) {
    const t = this.clickable();
    if (!t.list.length || this.noPreview) return null;
    const h = ui.hover && ui.hover.id.startsWith('sq:') ? Number(ui.hover.id.slice(3)) : null;
    if (h != null && t.list.includes(h)) return h;
    if (this.tapSq != null && t.list.includes(this.tapSq)) return this.tapSq;
    if (this.kbIdx != null) return t.list[((this.kbIdx % t.list.length) + t.list.length) % t.list.length];
    return null;
  }
  preview(sq) {
    const t = this.clickable();
    const b = this.live();
    if (!b || sq == null) return null;
    const key = `${t.kind}:${this.sel[0]}:${sq}`;
    if (!this.pvCache) this.pvCache = new Map();
    if (!this.pvCache.has(key)) {
      let pv = null;
      try {
        if (t.kind === 'capture') pv = { kind: 'capture', ...previewCapture(b, sq) };
        else if (t.kind === 'drop') pv = { kind: 'drop', ...previewDrop(b, this.sel[0], sq) };
      } catch { pv = null; }
      if (pv) pv.next = pv.next.filter((s) => !isHidden(b, s));
      this.pvCache.set(key, pv);
    }
    return this.pvCache.get(key);
  }

  toggle(i) {
    const b = this.live();
    if (this.busy || !b || b.status !== 'play' || i >= b.hand.length) return;
    // 손은 하나만 든다: 다른 기물을 누르면 바꿔 들고, 든 것을 다시 누르면 놓는다
    this.sel = this.sel.includes(i) ? [] : [i];
    this.targets = null;
    this.snd('pick');
  }

  clickSq(sq) {
    if (this.busy) { this.fast = true; return; }
    const b = this.live();
    if (!b) return;
    const t = this.clickable();
    if (t.list.includes(sq)) {
      if (this.app.touch && !this.noPreview && (t.kind === 'capture' || t.kind === 'drop') && this.tapSq !== sq) { this.tapSq = sq; this.snd('pick'); return; }
      this.tapSq = null;
      if (t.kind === 'capture') this.send({ type: 'capture', sq });
      else if (t.kind === 'redrop') this.send({ type: 'redrop', sq });
      else if (t.kind === 'drop') { const i = this.sel[0]; this.sel = []; this.send({ type: 'drop', handIndex: i, sq }); }
      return;
    }
    if (b.status === 'play' && this.sel.length) { this.sel = []; this.targets = null; }
    this.missSq(sq);
  }

  discard() {
    const b = this.live();
    if (this.busy || !b || b.status !== 'play' || !this.sel.length || b.discardsLeft <= 0 || !b.bag.length) return;
    const idx = this.sel;
    this.sel = [];
    this.send({ type: 'discard', handIndices: idx });
  }

  // 다시 놓기: 판(런)의 대국에서만(수업은 규칙이 끈다)
  canReboard() {
    const b = this.live();
    return !!this.run && !this.run.scratch && !this.busy && !!b && canReboard(b) && !this.sel.length;
  }
  reboard() {
    if (!this.canReboard()) return;
    this.send({ type: 'reboard' });
  }

  send(cmd) {
    this.marks.clear();
    const bRef = this.live();
    this.bRef = bRef;
    const v = this.view;
    const run = this.run;
    if (cmd.type === 'drop') this.slow = this.src.kind === 'lesson' || (!!run && !run.log.some((x) => !x.skipped) && bRef.history.length < 3);
    if (cmd.type === 'drop') { const hp = bRef.hand[cmd.handIndex]; this.dropEng = hp && hp.eng ? hp.eng.id : null; this.dropSoul = hp && hp.soul ? hp.soul : null; this.dropAwake = !!(hp && hp.awake); }
    if (cmd.type === 'drop' && run && !this.rehearsal) this.rec = { board: clone(bRef.board), drop: { sq: cmd.sq, piece: bRef.hand[cmd.handIndex].t }, caps: [], ante: run.ante };
    const events = this.src.cmd(cmd);
    if (run && !this.rehearsal) this.record(events, run);
    const post = clone(bRef.board);
    for (const e of events) if (e.type === 'reinforce') post[e.sq] = null;
    if (cmd.type === 'drop') { v.hand.splice(cmd.handIndex, 1); v.drawn = []; } // 수를 두면 탁월수 기회(!?)가 끝난다
    this.targets = null;
    this.play(events, post, cmd);
  }

  // 이번 판 최고 한 수를 다시 보기용으로 남긴다(결과 화면이 작은 판에 다시 둔다)
  record(events, run) {
    const r = this.rec;
    if (!r) return;
    for (const e of events) {
      if (e.type === 'capture') r.caps.push({ from: e.from, to: e.to, at: e.at ?? e.to, piece: e.piece, form: e.form, after: e.form });
      else if ((e.type === 'transform' || e.type === 'promote') && r.caps.length) r.caps[r.caps.length - 1].after = e.type === 'promote' ? 'Q' : e.to;
      else if (e.type === 'refill' || e.type === 'redrop') r.broken = true;
      else if (e.type === 'end') {
        if (!r.broken && (!run.bestReplay || e.score > run.bestReplay.score)) run.bestReplay = { ...r, score: e.score, reason: e.reason };
        this.rec = null;
      }
    }
  }

  // ── 사건 → 연출
  play(events, post, cmd) {
    const app = this.app, v = this.view, seq = this.seq;
    // 한 수의 연출이 쌓인 시간(moveT)이 1.3초를 넘으면 뒤 걸음을 줄여 간다: 한 수 연출이 4초(×1) 안에 들게.
    // 사슬 끝의 곱 · 외통은 줄이지 않는다(그 순간이 보상이라서).
    if (cmd && cmd.type === 'drop') { this.moveT = 0; this.matesInMove = 0; }
    const pace = () => { const T = this.moveT || 0; return T < 1.3 ? 1 : Math.max(0.01, (2.3 - T) / 1.0); };
    let label = '', mateSq = null;
    const add = (dur, o = {}) => {
      const d = label === 'mate' && !this.matesInMove++ ? dur : dur * pace();
      this.moveT = (this.moveT || 0) + d;
      return seq.add({ dur: d, label, ...o });
    };
    // 같은 순간의 점수 사건(격언 · 기보 반응)은 한 걸음으로 묶는다
    const merged = [];
    for (const e of events) {
      const prev = merged[merged.length - 1];
      if (e.type === 'score' && prev && prev.type === 'scoreGroup') prev.list.push(e);
      else if (e.type === 'score') merged.push({ type: 'scoreGroup', list: [e] });
      else merged.push(e);
    }
    for (const e of merged) {
      label = e.type;
      switch (e.type) {
        case 'drop': add(0.14, {
          begin: () => {
            v.board[e.sq] = { t: e.piece, mine: true };
            v.chain = { sq: e.sq, form: e.piece, value: 0, mult: 0, steps: [e.piece], path: [e.sq], forced: null, awaiting: null, cut: false, eng: this.dropEng || null, soul: this.dropSoul || null, awake: this.dropAwake || false };
            v.dropIn = { sq: e.sq, p: 0 };
            this.snd('drop');
          },
          tick: (p) => { v.dropIn.p = p; },
          done: () => { v.dropIn = null; },
        }); break;
        case 'redrop': add(0.14, {
          begin: () => {
            v.board[e.sq] = { t: e.piece, mine: true };
            v.chain.sq = e.sq; v.chain.awaiting = null; v.chain.path.push(e.sq);
            v.dropIn = { sq: e.sq, p: 0 };
            this.snd('drop');
          },
          tick: (p) => { v.dropIn.p = p; },
          done: () => { v.dropIn = null; },
        }); break;
        // 까마귀 모습은 먹은 칸(e.to) 너머에 앉는다(e.at): 움직임은 앉는 칸까지, 깨지는 그림은 먹은 칸에
        case 'capture': add(moveDur(v.chain ? v.chain.form : 'N', e.from, e.at ?? e.to, e.stay), {
          begin: () => {
            const c = v.chain;
            if (e.stay) { v.arrow = { from: e.from, to: e.to, p: 0 }; c.forced = null; return; }
            v.board[e.from] = null;
            v.mover = { from: e.from, to: e.at ?? e.to, form: c.form, p: 0 };
            c.forced = null;
          },
          tick: (p) => { if (v.arrow) v.arrow.p = p; else v.mover.p = LEAPERS.has(v.mover.form) ? p : ease.out(p); },
          done: () => {
            const c = v.chain;
            const victim = v.board[e.to];
            // 궁수 모습: 제자리에서 쏜다(판 위 기물은 그대로, 먹힌 칸만 빈다)
            if (e.stay) { v.board[e.to] = null; v.arrow = null; (c.shots || (c.shots = [])).push([e.from, e.to]); c.steps.push(c.form); }
            else { const at = e.at ?? e.to; v.board[e.to] = null; v.board[at] = { t: c.form, mine: true }; v.mover = null; c.sq = at; c.path.push(at); c.steps.push(c.form); }
            c.value += e.value; c.mult += 1;
            this.shatter(e.to, victim ? victim.t : e.piece, victim && victim.gold ? 'g' : 'b');
            this.flash(e.to, PAL.white);
            this.pop(`+${e.value}`, 'value');
            c.capPop = `+${e.value}`;
            this.snd('capture', c.path.length - 1);
            this.shake(1, 0.08);
          },
        }); break;
        case 'golden': add(0.12, { begin: () => { this.burst(e.sq, PAL.gold, 20); this.dust(e.sq, 26); this.snd('golden'); this.shake(1, 0.1); } }); break;
        case 'scoreGroup': add(0.05 + 0.03 * Math.min(3, e.list.length), {
          begin: () => {
            const c = v.chain;
            if (!c) return;
            // 기보 몫(src 'charts')은 따로 모아 청록(기보 봉랍 빛깔)으로 한 번 더 튀긴다 — 기본 몫 옆, 조금 늦게
            let dv = 0, dm = 0, xm = 1, cv = 0, cm = 0;
            for (const x of e.list) {
              const chart = x.src === 'charts';
              if (x.value) { c.value += x.value; if (chart) cv += x.value; else dv += x.value; }
              if (x.mult) { c.mult += x.mult; if (chart) cm += x.mult; else dm += x.mult; }
              if (x.xmult && x.src === 'brilliant') { c.mult *= x.xmult; continue; } // 탁월수 배수는 배수 칸의 청록 「×N」 딱지가 말한다
              if (x.xmult) { c.mult *= x.xmult; xm *= x.xmult; }
            }
            if (dv) this.pop(`+${short(dv)}`, 'value');
            if (dm) this.pop(`+${short(dm)}`, 'mult');
            if (xm !== 1) this.pop(`×${Number(xm.toFixed(2))}`, 'mult', dm ? 10 : 0);
            if (cv || cm) this.chartShare(c.sq, cv, cm, { after: dv ? `+${short(dv)}` : c.capPop, multBusy: !!dm || xm !== 1 });
            this.snd('tick', c.mult);
          },
        }); break;
        case 'money': if (e.src !== 'chest') add(0.05, { begin: () => { this.pop(`$${e.money}`, 'money'); this.snd('coin'); } }); break;
        case 'transform': add(this.bigFlip ? 0.4 : 0.1, {
          begin: () => { v.flip = { sq: e.sq, p: 0, from: e.from, to: e.to, big: this.bigFlip }; this.snd('transform'); this.formName(e.sq, e.to); if (this.bigFlip) { this.hitstop(0.2); this.shake(2, 0.15); } },
          tick: (p) => { v.flip.p = p; if (p >= 0.5 && v.chain) { v.chain.form = e.to; v.chain.steps[v.chain.steps.length - 1] = e.to; if (v.board[e.sq] && v.board[e.sq].mine) v.board[e.sq].t = e.to; } },
          done: () => { if (v.flip && v.flip.big) this.burst(e.sq, PAL.gold, 18); v.flip = null; this.sparkle(e.sq, PAL.silver, 6); },
        });
        // 모습이 바뀐 순간 한 박자 멈춘다(새 이름을 읽을 틈). 긴 사슬 뒤쪽에서는 다른 걸음처럼 줄어든다
        { const d = 0.25 * pace(); this.moveT = (this.moveT || 0) + d; seq.add({ dur: d, label: 'hold' }); } break;
        case 'promote': add(0.3, {
          begin: () => { v.lift = { sq: e.sq, p: 0 }; this.snd('promote'); },
          tick: (p) => { const to = e.to || 'Q'; v.lift.p = p; if (p >= 0.5 && v.chain) { v.chain.form = to; v.chain.steps[v.chain.steps.length - 1] = to; if (v.board[e.sq]) v.board[e.sq].t = to; } },
          done: () => { v.lift = null; this.sparkle(e.sq, PAL.gold, 12); this.word('프로모션', PAL.gold); },
        }); break;
        case 'grade': add(0.2, { begin: () => this.gradeStamp(e) }); break;
        case 'forced': add(0.1, { begin: () => { if (v.chain) v.chain.forced = e.attackers.slice(); this.snd('forced'); } }); break;
        case 'cutIgnored': add(0.2, { begin: () => { this.sparkle(e.sq, PAL.silver, 10); this.word('넘겼다', PAL.silver); } }); break;
        // 가족(깊이 B): 도약 뒤 노림 무시 · 직선 꿰뚫기 · 변신 한 번 더
        case 'threatIgnored': add(0.15, { begin: () => { this.sparkle(e.sq, PAL.silver, 10); this.word('지키는 적을 피했다', PAL.silver); } }); break;
        case 'pierce': add(0.12, { begin: () => {
          const vic = v.board[e.sq]; v.board[e.sq] = null; this.shatter(e.sq, vic ? vic.t : e.piece, vic && vic.gold ? 'g' : 'b');
          const bomb = e.src === 'bomb' || e.src === 'powder', col = bomb ? PAL.red : e.src && e.src.includes('martyr') ? PAL.red : FAMILY_BY_ID.line.col;
          this.flash(e.sq, col); this.word(bomb ? '폭발' : e.src && e.src.includes('martyr') ? '순교' : '꿰뚫었다', col); this.snd(bomb ? 'cut' : 'capture', 2); if (bomb) this.shake(2, 0.12);
        } }); break;
        case 'mirrored': add(0.1, { begin: () => { this.sparkle(e.sq, '#9fd3e0', 8); this.word('허수아비', '#9fd3e0'); } }); break;
        case 'traitor': add(0.1, { begin: () => { this.word('배신자가 넘어온다', '#8ec07c'); this.snd('coin'); } }); break;
        case 'absorb': add(0.15, { begin: () => { if (v.chain) v.chain.absorbed = e.forms.slice(1); this.sparkle(e.sq, FAMILY_BY_ID.change.col, 12); this.word(`+${PIECE_NAME[e.piece]}`, FAMILY_BY_ID.change.col); this.snd('transform'); } }); break;
        case 'gate': add(0.22, {
          begin: () => { this.sparkle(e.from, '#6fd1bf', 10); this.snd('transform'); },
          done: () => { const c = v.chain; if (v.board[e.from]) { v.board[e.to] = v.board[e.from]; v.board[e.from] = null; } if (c) { c.sq = e.to; c.path.push(e.to); } this.sparkle(e.to, '#6fd1bf', 14); },
        }); break;
        case 'gomoku': add(0.4, { begin: () => { this.word('오목', PAL.gold, 1.6, 3); this.snd('fanfare'); this.shake(2, 0.2); } }); break;
        case 'union': add(0.3, { begin: () => { this.sparkle(e.sq, FAMILY_BY_ID.change.col, 16); this.word('모든 모습으로', FAMILY_BY_ID.change.col, 1.2, 1); this.snd('transform'); this.hitstop(0.15); } }); break;
        case 'cut':
          add(0.15, { begin: () => { v.cut = { sq: e.sq, attackers: e.attackers, p: 0 }; if (v.chain) v.chain.cut = true; this.snd('cut'); this.hitstop(0.12); this.shake(2, 0.15); } });
          add(0.3, { tick: (p) => { v.cut.p = p; } });
          break;
        case 'mate': mateSq = e.sq; add(0.5, {
          begin: () => { this.topple(e.sq); this.word('메이트', PAL.gold, 1.6, 4); this.snd('mate'); this.hitstop(0.25); this.shake(3, 0.3); },
        }); break;
        // 탁월수 !!: 메이트 연출에 겹쳐 돈다(걸음 길이 0 — 한 수 연출 시간을 늘리지 않는다). 칸의 「!!」 · 빛살은 fx, 배수 칸 「×N」은 v.brill
        case 'brilliant': { const sq = mateSq; add(0, { begin: () => this.brilliantFx(sq, e) }); break; }
        case 'refill': add(0.35, {
          begin: () => { this.word('적이 다시 찬다', PAL.gold, 1.1, 1); this.snd('refill'); },
          done: () => { v.board = clone(post); if (v.chain) { v.chain.path = [e.sq]; } },
        }); break;
        case 'redropReady': add(0.15, {
          begin: () => { if (v.chain) { v.board[v.chain.sq] = null; v.chain.awaiting = e.squares.slice(); } this.word('다시 떨군다', PAL.gold, 1); },
        }); break;
        case 'end': this.endSteps(e); break;
        case 'overflow': add(0.08, {
          begin: () => {
            const big = { 1: 1, 2: 2, 5: 3, 10: 4 }[e.tier] || 1;
            if (this.src.kind !== 'lesson') this.word(e.tier === 1 ? '목표 달성' : `목표 ×${e.tier}`, e.tier >= 5 ? PAL.red : PAL.gold, 1 + big * 0.2, Math.min(3, big));
            this.ring = { t: 0, life: 0.5 + big * 0.15, col: e.tier >= 10 ? PAL.white : e.tier >= 5 ? PAL.red : PAL.gold };
            this.snd('overflow', e.tier); this.shake(big, 0.2 + big * 0.05);
          },
        }); break;
        // 다시 놓기: 옛 판의 적이 흩어지고 새 판이 내려앉는다
        case 'reboard': add(0.45, {
          begin: () => {
            for (let sq = 0; sq < 64; sq++) if (v.board[sq] && !v.board[sq].mine) this.sparkle(sq, PAL.dim, 3);
            this.word('다시 놓기', PAL.gold, 1.1, 1); this.snd('discard');
          },
          tick: (p) => { if (p >= 0.5 && !v.reboarded) { v.reboarded = true; const b = this.bRef; v.board = clone(b.board); this.news = this.newThings(b); } },
          done: () => { v.reboarded = false; this.sync(); },
        }); break;
        // 함정(정석): 증원이 함정에 들어 곧바로 점수가 된다
        case 'trapped': add(0.3, {
          begin: () => { this.sparkle(e.sq, '#c0c8d0', 10); this.pop(`+${short(e.value)}`, 'value'); this.snd('coin'); },
          done: () => { v.score = e.score; },
        }); break;
        case 'freeze': add(0.05, { begin: () => { for (const sq of e.squares) this.sparkle(sq, '#9fd3e0', 5); } }); break;
        case 'returnHome': add(0.05, { begin: () => { this.toast(`${josa(PIECE_NAME[e.piece], '이/가')} 손으로 돌아왔다`, PAL.gold); } }); break;
        case 'captive': add(0.05, { begin: () => { this.toast(`${PIECE_NAME[e.piece]} 포로가 주머니에 든다`, PAL.gold); } }); break;
        // 시계를 잃는다(밤샘 2 D1): 대국은 졌지만 판은 이어진다
        case 'clockLost': add(0.9, {
          begin: () => {
            this.app.clockFx = { idx: e.clock, t: 0 };
            this.word(e.clock > 0 ? '시계 −1' : '시간이 다했다', PAL.red, 1.3, 2); this.snd('glass'); this.shake(2, 0.2);
          },
        }); this.runEvents.push(e); break;
        // 혼에 금이 간다(CHM-17): 짧은 금 소리 · 혼 빛깔 글. 처음이면 킹이 한 줄 안내
        case 'crack': add(0.25, {
          begin: () => {
            const s = SOUL_BY_ID[e.soul];
            this.toast(`${s.name}의 혼에 금이 갔다`, s.col, 2.4);
            this.snd('crack');
          },
        }); this.runEvents.push(e); break;
        case 'shatter': add(0.2, { begin: () => { this.toast(`유리 각인 ${josa(PIECE_NAME[e.piece], '이/가')} 깨졌다`, PAL.sky); this.snd('glass'); } }); break;
        // 증원은 위에서 떨어져 들어온다. 떨어지는 시간은 한 수 연출 길이에 넣지 않는다(update가 따로 센다)
        case 'reinforce': add(0.1, {
          begin: () => {
            v.board[e.sq] = post[e.sq] || { t: e.piece, id: -1 };
            if (this.app.reducedMotion) this.flash(e.sq, PAL.dim);
            else (this.falls || (this.falls = new Map())).set(e.sq, 0);
            this.snd('reinforce');
          },
        }); break;
        case 'regrip': add(0.45, {
          begin: () => { this.word('손을 새로 쥔다', PAL.gold, 1.2, 1); this.snd('discard'); },
          done: () => { const b = this.bRef; v.hand = clone(b.hand); v.bag = b.bag.length; },
        }); break;
        // 희생: 바친 카드가 흩어지고(걸음 처음) 새 카드가 아래에서 올라온다(걸음 끝, 0.18초 — 손 그리기가 app.time으로)
        case 'discard': add(0.22, {
          begin: () => { this.snd('discard'); this.offerFx((cmd && cmd.handIndices) || []); },
          done: () => {
            const b = this.bRef, had = new Set(v.hand.map((p) => p.id));
            v.hand = clone(b.hand); v.discardsLeft = b.discardsLeft; v.bag = b.bag.length; v.hiding = null;
            v.drawn = e.offering && e.offering.drawn ? e.offering.drawn.slice() : [];
            v.offered = (b.offered || []).map((p) => p.t);
            this.dealIn = { ids: v.hand.filter((p) => !had.has(p.id)).map((p) => p.id), t: this.app.time };
          },
        }); break;
        case 'win': if (this.src.kind === 'lesson') break; add(0.25, { begin: () => { this.word('대국 승리', PAL.gold, 1.2, 2); this.snd('win'); } }); break;
        case 'lose': if (this.src.kind === 'lesson') break; add(0.6, { begin: () => { this.word(e.reason === 'stuck' ? '떨굴 곳이 없다' : '수가 다했다', PAL.red, 1.4, 1); this.snd('lose'); } }); break;
        case 'fragment': add(0.05, { begin: () => { this.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6); this.snd('fragment'); { const to = shardTo(); this.app.flyShard(BX + 112, BY + 112, to.x, to.y); } } }); this.runEvents.push(e); break;
        default: this.runEvents.push(e);
      }
    }
    add(0, { done: () => this.afterSeq() });
  }

  endSteps(e) {
    const app = this.app, v = this.view;
    const add = (d, o) => { this.moveT = (this.moveT || 0) + d; return this.seq.add({ dur: d, label: 'end', ...o }); };
    add(0.25, {
      begin: () => {
        if (v.chain) { v.chain.value = e.value; v.chain.mult = e.mult; }
        v.gather = { p: 0, value: e.value, mult: e.mult, score: e.score };
        if (v.chain && v.board[v.chain.sq] && v.board[v.chain.sq].mine) v.board[v.chain.sq] = null;
        this.snd('gather');
      },
      tick: (p) => { v.gather.p = ease.in(p); },
    });
    add(0.2, {
      begin: () => {
        v.gather.burst = true; this.snd('boom', e.score); this.shake(e.score >= v.target ? 2 : 1, 0.12);
        const parts = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push({ x: LX + 56, y: this.leftLayout().val.y + 11, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50 }); }
        this.fx.add({
          life: 0.4, layer: 1, parts,
          update: (dt, f) => { for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; } },
          draw: (c, f) => { c.globalAlpha = 1 - f.t / f.life; for (const p of f.parts) rect(c, p.x, p.y, 2, 2, PAL.goldHi); c.globalAlpha = 1; },
        });
      },
    });
    const from = v.score;
    add(0.3, {
      begin: () => { v.count = { from, to: from + e.score, p: 0 }; this.snd('count'); },
      tick: (p) => { v.count.p = ease.out(p); },
      done: () => {
        v.score = from + e.score;
        v.count = null;
        this.lastEnd = { value: e.value, mult: e.mult, score: e.score, reason: e.reason, steps: v.chain ? v.chain.steps.slice() : [], eng: v.chain ? v.chain.eng : null };
        if (this.run && !this.rehearsal && e.score > 0 && app.noteMove(e.score, this.lastEnd.steps) && app.records.runs + app.records.wins > 0) this.toast('최고 한 수', PAL.gold);
        v.gather = null;
        v.chain = null;
        v.cut = null;
        if (this.glow) this.glow.fading = true;
        if (this.bRef) { v.movesLeft = this.bRef.movesLeft; }
      },
    });
  }

  afterSeq() {
    this.fast = false;
    const app = this.app;
    if (this.src.after) { this.sync(); this.src.after(this); return; }
    if (app.run.phase === 'battle') { this.sync(); return; }
    // 대국이 끝났다: 막간(보상 · 상자 · 전설) 뒤 국면 화면으로
    const ev = this.runEvents;
    const list = [];
    const reward = ev.find((e) => e.type === 'reward');
    if (reward) list.push(['reward', { reward, events: ev }]);
    const chest = ev.find((e) => e.type === 'chest');
    if (chest) list.push(['chest', { chest }]);
    list.push(...awakenFlow(ev));
    for (const e of ev) if (e.type === 'legend') list.push(['legend', { legend: e.legend }]);
    app.flow(list);
  }

  // ── 효과
  center(sq) { const p = sqXY(sq); return { x: p.x + 14, y: p.y + 14 }; }
  // 내 기물의 모습: 떨군 기물의 각인 톤 + 지금 모습의 기보 단계
  look(form, time = null) {
    const run = this.run, v = this.view;
    return { eng: v.chain ? v.chain.eng || null : null, soul: v.chain ? v.chain.soul || null : null, awake: !!(v.chain && v.chain.awake), tier: run ? tierOf(run.charts[chartForm(form)]) : 0, time };
  }
  shatter(sq, type, side) {
    const { x, y } = sqXY(sq);
    const chips = spriteChips(artOf(type), side);
    const n = 14;
    let seed = sq * 97 + chips.length;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = [];
    for (let i = 0; i < n; i++) {
      const c = chips[Math.floor(rnd() * chips.length)];
      parts.push({ x: x + 6 + c.x, y: y + 3 + c.y, vx: (c.x - 8) * 6 + (rnd() - 0.5) * 30, vy: -40 - rnd() * 50, col: c.col, s: rnd() < 0.3 ? 2 : 1 });
    }
    this.fx.add({
      life: 0.7, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const p of e.parts) rect(ctx, p.x, p.y, p.s, p.s, p.col); ctx.globalAlpha = 1; },
    });
  }
  burst(sq, col, n) {
    const { x, y } = this.center(sq);
    const parts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; parts.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 }); }
    this.fx.add({
      life: 0.5, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const p of e.parts) rect(ctx, p.x, p.y, 2, 2, col); ctx.globalAlpha = 1; },
    });
  }
  sparkle(sq, col, n) {
    const { x, y } = sqXY(sq);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: x + 3 + ((i * 7 + sq * 3) % 22), y: y + 2 + ((i * 11 + sq) % 22) });
    this.fx.add({
      life: 0.35, layer: 1,
      draw: (ctx, e) => { const k = e.t / e.life; ctx.globalAlpha = 1 - k; for (const p of pts) { rect(ctx, p.x, p.y - k * 6, 1, 1, col); rect(ctx, p.x - 1, p.y - k * 6, 3, 1, col); } ctx.globalAlpha = 1; },
    });
  }
  flash(sq, col) {
    const { x, y } = sqXY(sq);
    this.fx.add({ life: 0.15, layer: 1, draw: (ctx, e) => { ctx.globalAlpha = 0.6 * (1 - e.t / e.life); rect(ctx, x, y, S, S, col); ctx.globalAlpha = 1; } });
  }
  // 희생: 바친 손 카드가 조각(카드 바탕 · 기물 빛깔)으로 흩어진다. 카드 자리는 걸음이 끝날 때까지 비워 둔다(v.hiding)
  offerFx(indices) {
    const v = this.view;
    if (!indices.length) return;
    const n = v.hand.length;
    v.hiding = indices.slice();
    const parts = [];
    let seed = 7 + indices[0] * 13 + n;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const i of indices) {
      const p = v.hand[i];
      if (!p) continue;
      const r = this.handRect(i, n);
      const chips = spriteChips(artOf(p.t), 'w');
      for (let k = 0; k < 18; k++) {
        const card = k < 8, c = card ? null : chips[Math.floor(rnd() * chips.length)];
        const x = card ? r.x + 2 + rnd() * (r.w - 4) : r.x + Math.floor((r.w - 16) / 2) + c.x;
        const y = card ? r.y + 2 + rnd() * (r.h - 4) : r.y + Math.floor((r.h - 22) / 2) + 1 + c.y;
        parts.push({ x, y, vx: (x - (r.x + r.w / 2)) * 5 + (rnd() - 0.5) * 30, vy: -50 - rnd() * 60, col: card ? (rnd() < 0.5 ? PAL.light : PAL.cardHi) : c.col, s: rnd() < 0.35 ? 2 : 1 });
      }
    }
    this.fx.add({
      life: 0.45, layer: 1, parts,
      update: (dt, e) => { for (const q of e.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const q of e.parts) rect(ctx, q.x, q.y, q.s, q.s, q.col); ctx.globalAlpha = 1; },
    });
  }
  // 탁월수 !!(CHM-43 시안 B1): 메이트 친 칸에서 청록 「!!」 딱지가 튀어나오고 빛살이 퍼진다. 판 가장자리 칸이면 딱지를 판 안쪽으로 뒤집는다.
  // 움직임 줄이기면 빛살 · 튀어나옴 없이 딱지만. 배수 칸의 「×N」은 v.brill(drawLeft — 값 × 배수가 모여 점수가 될 때까지)
  brilliantFx(sq, e) {
    this.view.brill = { x: e.x };
    this.snd('brilliant');
    const st = this.app.stats;
    if (st) st.brilliantFx = (st.brilliantFx || 0) + 1;
    if (sq == null) return;
    const calm = this.app.reducedMotion, T = ANNOT.teal;
    const tag = boardTagRect(sq, { bx: BX, by: BY, S });
    const s0 = sqXY(sq), cx = s0.x + 14, cy = s0.y + 14;
    this.lastBrilliantTag = { sq, ...tag };
    // 딱지는 칸 쪽에서 제자리로 튀어나온다: 처음엔 칸 가운데 쪽으로 6 비켜 있다(뒤집히면 반대쪽)
    const ox = tag.flipX ? 1 : -1, oy = tag.flipY ? -1 : 1;
    this.fx.add({
      life: 0.9, layer: 1, word: true, brilliant: true,
      draw: (ctx, f) => {
        const t = f.t, fade = t > 0.7 ? Math.max(0, (0.9 - t) / 0.2) : 1;
        ctx.globalAlpha = fade;
        frame(ctx, s0.x, s0.y, S, S, T.fill);
        if (!calm) {
          const k = Math.min(1, t / 0.45), r = 9 + 13 * ease.out(k), ra = Math.max(0, 1 - t / 0.6);
          ctx.globalAlpha = fade * ra;
          fine(() => {
            rect(ctx, cx - 1, cy - r - 6, 2, 6, T.fill); rect(ctx, cx - 1, cy + r, 2, 6, T.fill);
            rect(ctx, cx - r - 6, cy - 1, 6, 2, T.fill); rect(ctx, cx + r, cy - 1, 6, 2, T.fill);
            const d = r * 0.78;
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rect(ctx, cx + sx * d - 1.5, cy + sy * d - 1.5, 3, 3, T.fill);
          });
          ctx.globalAlpha = fade;
        }
        const k = calm ? 1 : Math.min(1, t / 0.14);
        const pop = calm ? 0 : (1 - ease.back(k)) * 6;
        if (!calm && k < 1) ctx.globalAlpha = fade * Math.min(1, 0.4 + k);
        drawAnnot(ctx, '!!', tag.x + ox * pop, tag.y + oy * pop, T, 2);
        ctx.globalAlpha = 1;
      },
    });
  }
  // col: 빛깔(기본은 값 · 배수 빛깔) · delay: 늦게 뜨기(초) · dx · align: 가운데 대신 왼쪽 맞춤으로 옆에 붙일 때
  pop(s, where, dy = 0, { col = null, delay = 0, dx = 0, align = 'center' } = {}) {
    const lay = this.leftLayout(), vy = lay.val.y - 2;
    const pos = where === 'value' ? { x: LX + 24 + dx, y: vy - dy } : where === 'mult' ? { x: LX + 88 + dx, y: vy - dy } : { x: LX + LW - 20, y: shardTo().y - 6 };
    const c = col || (where === 'value' ? PAL.val : PAL.gold);
    this.fx.add({ life: 0.6 + delay, layer: 1, draw: (ctx, e) => { const t = e.t - delay; if (t < 0) return; const k = t / 0.6; text(ctx, s, pos.x, pos.y - 6 - k * 10, c, { align, bold: true, alpha: 1 - k * k, shadow: PAL.shadow }); } });
  }
  // 기보 몫: 값 칸 위의 기본 몫(after) 바로 오른쪽에 청록 「+N」, 배수 칸 위에 청록 「+N」(배수 몫이 이미 떴으면 한 칸 위) —
  // 기보 봉랍 빛깔, 조금 늦게. 먹은 칸에 청록 반짝. 한 수 연출 길이는 늘리지 않는다(fx만)
  chartShare(sq, value, mult, { after = null, multBusy = false } = {}) {
    const hi = SEAL.chart[1];
    if (value) {
      const s = `+${short(value)}`;
      const half = after ? Math.ceil(measure(after, true) / 2) + 2 : -Math.floor(measure(s, true) / 2);
      this.pop(s, 'value', 0, { col: hi, delay: 0.08, dx: half, align: 'left' });
    }
    if (mult) this.pop(`+${short(mult)}`, 'mult', multBusy ? 11 : 0, { col: hi, delay: 0.08 });
    if (sq != null) this.sparkle(sq, hi, 8);
    const st = this.app.stats;
    if (st) st.chartPops = (st.chartPops || 0) + 1;
  }
  word(s, col, life = 1, scale = 2) {
    this.fx.add({
      life, layer: 1, word: true,
      draw: (ctx, e) => {
        const k = e.t / e.life;
        const sc = k < 0.1 ? scale + 1 : scale;
        text(ctx, s, BX + 112, BY + 100 - (sc * 6), col, { align: 'center', bold: true, scale: sc, shadow: PAL.shadow, alpha: k > 0.7 ? (1 - k) / 0.3 : 1 });
      },
    });
  }
  // 모습이 바뀐 칸 위로 새 모습 이름이 떠오르며 사라진다(「룩!」)
  formName(sq, t) {
    const c = this.center(sq);
    const s = `${PIECE_NAME[t]}!`;
    this.fx.add({
      life: 0.9, layer: 1,
      draw: (ctx, e) => {
        const k = e.t / e.life;
        const w = measure(s, true) * 2 + 10, h = 27;
        const rise = Math.round(ease.out(Math.min(1, k * 1.6)) * 6);
        const above = c.y - 14 - h - 2 >= BY;
        const y = above ? c.y - 14 - h - rise : c.y + 14 + 2 + rise;
        const x = Math.round(Math.max(BX + 2, Math.min(BX + S * 8 - w - 2, c.x - w / 2)));
        ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
        text(ctx, s, x + w / 2, y + 2, PAL.gold, { align: 'center', bold: true, scale: 2 });
        ctx.globalAlpha = 1;
      },
    });
  }
  // 먹힌 킹이 천천히 쓰러진다
  topple(sq) {
    const { x, y } = sqXY(sq);
    this.fx.add({
      life: 1.0, layer: 1,
      draw: (ctx, e) => {
        const k = Math.min(1, e.t / 0.55);
        const ang = (k * k) * Math.PI / 2;
        ctx.save();
        ctx.globalAlpha = e.t < 0.7 ? 1 : Math.max(0, 1 - (e.t - 0.7) / 0.3);
        ctx.translate(x + 6 + 14, y + 3 + 21);
        ctx.rotate(ang);
        ctx.drawImage(spriteCanvas('K', 'b', null, 0, hiFor(ctx)), -14, -21, SW, SH);
        ctx.restore();
      },
    });
  }
  // 금가루: 위로 튀었다가 천천히 내려앉는 점
  dust(sq, n) {
    const { x, y } = this.center(sq);
    let seed = sq * 31 + 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = [];
    for (let i = 0; i < n; i++) parts.push({ x: x + (rnd() - 0.5) * 20, y: y + (rnd() - 0.5) * 10, vx: (rnd() - 0.5) * 60, vy: -30 - rnd() * 70, c: rnd() < 0.3 ? PAL.goldHi : PAL.gold });
    this.fx.add({
      life: 1.1, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.97; } },
      draw: (ctx, e) => { for (const p of e.parts) { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life) * (Math.floor(e.t * 20 + p.x) % 3 ? 1 : 0.4); rect(ctx, p.x, p.y, 1, 1, p.c); } ctx.globalAlpha = 1; },
    });
  }
  // 점수 칸의 불꽃: 목표를 넘기면 붙고, 넘친 층(×2 · ×5 · ×10)마다 세진다
  updateFlames(dt) {
    const v = this.view;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const tier = v.target ? overflowTier(score, v.target) : 0;
    this.flames = (this.flames || []).filter((f) => (f.t += dt) < f.life);
    if (!tier || this.app.reducedMotion) return;
    const rate = { 1: 20, 2: 40, 5: 70, 10: 110 }[tier];
    this.flameAcc = (this.flameAcc || 0) + dt * rate;
    while (this.flameAcc >= 1) {
      this.flameAcc -= 1;
      const r = Math.random();
      this.flames.push({ x: LX + 4 + Math.random() * (LW - 8), y: this.leftLayout().score, vy: -(18 + Math.random() * (14 + tier * 3)), t: 0, life: 0.4 + r * 0.5, tier });
    }
  }
  drawFlames(ctx) {
    for (const f of this.flames || []) {
      const k = f.t / f.life;
      const col = f.tier >= 10 && k < 0.3 ? PAL.white : k < 0.35 ? PAL.goldHi : k < 0.7 ? PAL.gold : PAL.red;
      ctx.globalAlpha = 1 - k * 0.6;
      const s = k < 0.4 ? (f.tier >= 5 ? 3 : 2) : 1;
      rect(ctx, f.x + Math.sin((f.t + f.x) * 12) * 1.5, f.y + f.vy * f.t, s, s + (k < 0.3 ? 1 : 0), col);
    }
    ctx.globalAlpha = 1;
  }

  gradeStamp(e) {
    const cols = { '★': PAL.white, '★★': PAL.gold, '★★★': PAL.red, '∞': null };
    this.stamp = { mark: e.mark, t: 0, life: 1.1, col: cols[e.mark] };
    this.glow = { mark: e.mark, fade: 0 };
    this.snd('grade', e.mark);
    this.shake({ '★': 1, '★★': 2, '★★★': 3, '∞': 4 }[e.mark] || 1, 0.25);
  }

  // 판 위 표시(오른쪽 누르기 · 끌기, marks.js). 왼쪽으로 판을 누르거나 수를 두면 지운다
  get marks() { return this._marks || (this._marks = new Marks()); }
  rightDown(x, y) { this.marks.down(sqAt(x, y)); }
  rightUp(x, y) { this.marks.up(sqAt(x, y)); }
  pointerDown(x, y) { this.idleT = 0; if (x != null && sqAt(x, y) >= 0) this.marks.clear(); }
  update(dt) {
    this.idleT = (this.idleT || 0) + dt;
    // 판 전체의 처음 세 사슬과 첫 수업은 연출 속도 설정과 상관없이 ×1(눈이 규칙을 따라잡을 때까지)
    const sp = (this.slow ? 1 : this.app.speed()) * (this.fast ? 5 : 1);
    this.seq.update(dt * sp);
    if (this.falls) for (const [sq, t] of this.falls) {
      const nt = t + dt * sp;
      if (nt >= FALL) { this.falls.delete(sq); this.flash(sq, PAL.dim); } else this.falls.set(sq, nt);
    }
    if (this.glow && this.glow.fading) { this.glow.fade += dt * this.app.speed(); if (this.glow.fade > 0.6) this.glow = null; }
    if (this.ring) { this.ring.t += dt * this.app.speed(); if (this.ring.t > this.ring.life) this.ring = null; }
    this.updateFlames(dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.stamp) { this.stamp.t += dt * this.app.speed(); if (this.stamp.t > this.stamp.life) this.stamp = null; }
  }

  // ── 그리기
  draw(ctx, ui) {
    this.drawBoard(ctx, ui);
    this.drawLeft(ctx, ui);
    this.drawRight(ctx, ui);
    this.drawOver(ctx);
    if (this.src.kind === 'run') this.coachHints();
  }
  // 처음 안내: 판 위에서 처음 만나는 것(증원 · 금빛 적 · 특성 · 벽과 보석 · 이형 기물)
  coachHints() {
    const b = this.live();
    if (!b || this.busy || this.banner || b.status !== 'play') return;
    const app = this.app, v = this.view;
    // 탁월수: 희생으로 새로 뽑은 기물의 「!?」 딱지가 처음 뜬 순간(CHM-43)
    const nb = v.hand.findIndex((p) => (v.drawn || []).includes(p.id));
    if (nb >= 0) hint(app, 'brilliant', `hand:${nb}`);
    const ghost = (b.incoming || []).find((r) => !v.board[r.sq] && !isHidden(b, r.sq));
    if (ghost) hint(app, 'incoming', `sq:${ghost.sq}`);
    const find = (f) => v.board.findIndex((c, sq) => c && !c.mine && !isHidden(b, sq) && f(c));
    let sq = find((c) => c.gold);
    if (sq >= 0) hint(app, 'golden', `sq:${sq}`);
    sq = find((c) => c.trait);
    if (sq >= 0) hint(app, 'trait', `sq:${sq}`);
    sq = find((c) => PIECES[c.t] && PIECES[c.t].thing);
    if (sq >= 0) hint(app, 'things', `sq:${sq}`);
    const f = v.hand.findIndex((p) => PIECES[p.t] && PIECES[p.t].fairy);
    if (f >= 0) hint(app, 'fairy', `hand:${f}`);
    const reg = (p) => app.ui.regions.find((r) => r.id.startsWith(p));
    if (reg('fam:')) hint(app, 'family', reg('fam:').id);
    if (reg('joseki:')) hint(app, 'joseki', reg('joseki:').id);
    if (reg('tactic:')) hint(app, 'tactic', reg('tactic:').id);
  }

  // 목표 막대 끝의 값(목표 × 눈금)을 부드럽게 따라간다. 대국이 바뀌면 · 움직임 줄이기면 곧바로
  barScale(want, time) {
    const b = this.bar, tgt = this.view.target;
    if (!b || b.tgt !== tgt || this.app.reducedMotion) { this.bar = { v: want, t: time, tgt }; return want; }
    const dt = Math.max(0, Math.min(0.1, time - b.t));
    b.t = time;
    b.v += (want - b.v) * Math.min(1, dt * 10);
    if (Math.abs(want - b.v) < want * 0.005) b.v = want;
    return b.v;
  }

  // 목표는 막대로: 지금 점수는 채움, 이번 사슬로 얻을 몫(값 × 배수)은 빗금으로 미리 차오른다.
  // 목표를 넘기면 막대가 ×2 · ×5 · ×10 눈금으로 늘어나고 채움 끝에 불이 붙는다.
  // 사슬 중에는 막대 끝을 늘 다음 눈금에 둔다: 목표를 넘겨도 막대가 꽉 차지 않고 다음 눈금까지 계속 차오른다
  // (대국은 사슬이 끝난 뒤에 끝난다 — 규칙과 같다). 눈금이 바뀌면 막대는 한 번에 튀지 않고 늘어난다.
  drawGoalBar(ctx) {
    const v = this.view, tgt = v.target;
    if (!tgt) return;
    const time = this.app.time;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const going = !!v.chain && !v.gather;
    const live = going ? Math.floor(v.chain.value * v.chain.mult) : v.gather && !v.count ? v.gather.score : 0;
    const total = score + live;
    const maxMul = BAR_TIERS.find((m) => (going ? total < m * tgt : total <= m * tgt)) ?? BAR_TIERS[BAR_TIERS.length - 1];
    const maxV = this.barScale(tgt * maxMul, time);
    const X = BX, Y = 15, Wd = S * 8, Hh = 7;
    // 목표 막대를 빈 상자로 적는다(막대 테) — smoke 「글 넘침」이 알림(toastSpot)과 겹치면 「상자 겹침」으로,
    // 막대 위 얻을 몫(+N, 상자 밖 글)을 알림이 덮으면 「글이 상자 밖」으로 잡는다(CHM-48). 수업 제목 줄(y 1)은 막대 상자 밖이다
    openBox('tile', X - 1, Y - 1, Wd + 2, Hh + 2, 0, { name: '목표 막대' });
    closeBox();
    this.app.ui.region('goal', X - 1, Y - 3, Wd + 2, Hh + 6, { tip: () => tipLines(`목표 ${num(tgt)}`, '사슬이 끝날 때 점수가 목표에 닿으면 이긴다. 넘치면 ×2 · ×5 · ×10 눈금까지 늘어난다') });
    // 목표를 넘긴 막대 뒤 빛(막대 칸 뒤 층)
    if (score >= tgt) glow(ctx, X, Y, Math.round(Wd * Math.min(1, score / maxV)), Hh, PAL.gold, 0.3 * flicker(time, 4), 5);
    box(ctx, X - 1, Y - 1, Wd + 2, Hh + 2, PAL.feltDk, PAL.frameDk);
    const fill = Math.round(Wd * Math.min(1, score / maxV));
    const hot = score >= tgt;
    rect(ctx, X, Y, fill, Hh, hot ? PAL.gold : PAL.goldDk);
    if (fill > 1) rect(ctx, X, Y, fill, 1, PAL.goldHi);
    const gw = Math.round(Wd * Math.min(1, total / maxV)) - fill;
    if (gw > 0) {
      ctx.fillStyle = PAL.gold;
      for (let i = 0; i < gw; i++) for (let j = 0; j < Hh; j++) if ((i + j + Math.floor(time * 8)) % 3 === 0) ctx.fillRect(X + fill + i, Y + j, 1, 1);
      // 얻을 몫: 채움 끝 위 가운데, 판 폭 안으로(왼쪽 칸 · 오른쪽 칸을 덮지 않게)
      const gs = `+${num(live)}`, gw2 = Math.ceil(measure(gs, true) / 2);
      const gx = Math.max(X + gw2, Math.min(X + Wd - gw2, X + fill + gw / 2));
      // 얻을 몫의 빛: 목표를 넘길 몫이면 더 밝다(몫이 오를 때 잠깐 밝아진다)
      if (!this.hideGain) glowText(ctx, gx - gw2, 1, gw2 * 2, 12, PAL.gold, (total >= tgt ? 0.45 * flicker(time, 5) : 0.2) + this.pulseAt('gain', live, time) * 0.5, 8);
      if (!this.hideGain) text(ctx, gs, gx, 1, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    }
    // 눈금: 목표(×1)는 흰 막대(사슬 중에 넘기면 금빛으로 깜빡인다), 넘친 층은 작은 숫자
    const passed = going && total >= tgt && Math.floor(time * 6) % 2 === 0;
    for (const m of BAR_TIERS) {
      if (m * tgt > maxV + 0.5) break;
      const tx = X + Math.round((Wd * m) / maxV * tgt) - 1;
      rect(ctx, tx, Y - 3, 2, Hh + 6, m === 1 ? (passed ? PAL.goldHi : PAL.white) : PAL.red);
      if (m > 1) { rect(ctx, tx - 7, Y - 8, 1, 1, PAL.red); rect(ctx, tx - 5, Y - 6, 1, 1, PAL.red); rect(ctx, tx - 6, Y - 7, 1, 1, PAL.red); rect(ctx, tx - 7, Y - 6, 1, 1, PAL.red); rect(ctx, tx - 5, Y - 8, 1, 1, PAL.red); digits(ctx, m, tx - 3, Y - 9, PAL.red); }
    }
    // 불: 목표를 넘기면 채움 끝에서 불꽃이 인다
    if (hot && !this.app.reducedMotion) {
      const ex = X + fill;
      for (let i = 0; i < 6; i++) {
        const k = (time * 3 + i / 6) % 1;
        rect(ctx, ex - 4 + ((i * 5) % 9) - Math.round(Math.sin(time * 9 + i) * 1.5), Y - 1 - Math.round(k * 9), k < 0.4 ? 2 : 1, k < 0.4 ? 2 : 1, k < 0.3 ? PAL.goldHi : k < 0.6 ? PAL.gold : PAL.red);
      }
    }
  }

  // 세력마다 판 틀 한 가지(다른 땅에 왔다는 표지): 틀 안쪽 테 한 줄이 세력 빛깔, 네 모서리 조각 자리에 작은 문장 빛
  drawFactionFrame(ctx) {
    const fa = factionOfBattle(this.b);
    if (!fa) return;
    const n = S * 8 + 12, x0 = BX - 6, y0 = BY - 6;
    ctx.globalAlpha = 0.85;
    frame(ctx, BX - 2, BY - 2, S * 8 + 4, S * 8 + 4, fa.hue);
    ctx.globalAlpha = 1;
    // 모서리 조각(5×5 꽃)을 세력 빛깔로 덧칠한다
    const orn = ['..#..', '.#o#.', '#o#o#', '.#o#.', '..#..'];
    for (const [ox, oy] of [[0, 0], [n - 6, 0], [0, n - 6], [n - 6, n - 6]]) orn.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'o') rect(ctx, x0 + ox + i, y0 + oy + j, 1, 1, fa.hue); });
  }

  drawBoard(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, time = app.time;
    this.drawGoalBar(ctx);
    ctx.drawImage(boardFrameCanvas(S), BX - 6, BY - 6);
    this.drawFactionFrame(ctx);
    // 사슬 평가의 테두리 불빛: 흰 → 금 → 붉은 금 → 무지개. 사슬이 끝나면 사그라든다
    if (this.glow) {
      const g = this.glow;
      const a = Math.max(0, 1 - g.fade / 0.6) * (0.75 + 0.25 * Math.sin(time * 10));
      const hue = Math.floor(time * 360) % 360;
      const cols = { '★': [PAL.white], '★★': [PAL.gold, PAL.goldHi], '★★★': [PAL.red, PAL.gold, PAL.red], '∞': [`hsl(${hue},85%,60%)`, `hsl(${(hue + 90) % 360},85%,60%)`, `hsl(${(hue + 180) % 360},85%,60%)`] }[g.mark];
      ctx.globalAlpha = a;
      cols.forEach((c, i) => frame(ctx, BX - 6 + i, BY - 6 + i, S * 8 + 12 - i * 2, S * 8 + 12 - i * 2, c, 1));
      ctx.globalAlpha = 1;
    }
    if (this.ring) {
      const k = this.ring.t / this.ring.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      const o = Math.round(k * 10);
      frame(ctx, BX - 6 - o, BY - 6 - o, S * 8 + 12 + o * 2, S * 8 + 12 + o * 2, this.ring.col, 2);
      ctx.globalAlpha = 1;
    }
    const t = this.clickable();
    const tset = new Set(t.list);
    const forced = v.chain && v.chain.forced ? new Set(v.chain.forced) : null;
    const openKings = b.hints && b.hints.openKings ? new Set(b.hints.openKings) : null;
    // 증원 그림자: 이번 수 뒤(k 0) · 그다음 수 뒤(k 1)
    const ghosts = new Map();
    visibleIncoming(b).forEach((wave, k) => { for (const r of wave || []) if (!v.board[r.sq] && !isHidden(b, r.sq) && !ghosts.has(r.sq)) ghosts.set(r.sq, { t: r.t, k }); });
    ctx.drawImage(boardCanvas(S), BX, BY);
    this.drawBoardThings(ctx, b.rules, time);
    for (let sq = 0; sq < 64; sq++) {
      const { x, y } = sqXY(sq);
      const r = sq >> 3;
      if (isHidden(b, sq)) {
        rect(ctx, x, y, S, S, PAL.fog);
        for (let k = 0; k < S; k += 4) rect(ctx, x + ((k + (r * 2)) % S), y + k, 2, 1, PAL.fogHi);
      }
      const id = `sq:${sq}`;
      const g = ghosts.get(sq);
      let tip = g ? [`증원 · ${PIECE_NAME[g.t]}`, [g.k ? '두 수 뒤에 들어온다' : '이번 수 뒤에 들어온다']] : null;
      if (forced && forced.has(sq) && !v.cut && !this.busy && !isHidden(b, sq)) tip = ['지키는 적', [t.kind === 'capture' && tset.has(sq) ? '이 적을 먹어야 사슬이 이어진다' : '지금 모습으로는 닿지 않는다']];
      const cell = v.board[sq];
      // 적 기물: 특성 · 특수 기물은 늘, 체스 기물은 지금 누를 칸이 아닐 때만(누를 칸은 먹기 미리 보기가 말한다). 행마 그림을 곁들인다
      let diag = null;
      if (!tip && cell && !cell.mine && cell.trait && !isHidden(b, sq)) { const tr = TRAIT_BY_ID[cell.trait]; tip = [`${tr.name} · ${PIECE_NAME[cell.t]}`, [tr.text, PIECE_MOVE[cell.t] || '']]; diag = cell.t; }
      if (!tip && cell && !cell.mine && (FAIRY_MOVE(cell.t) || (PIECE_MOVE[cell.t] && !tset.has(sq))) && !isHidden(b, sq)) { tip = [PIECE_NAME[cell.t], [PIECE_MOVE[cell.t]]]; diag = cell.t; }
      if (cell && !cell.mine && cell.muted && !isHidden(b, sq)) tip = tip ? [tip[0], [...tip[1], `횃불: ${L('아무것도 지키지 못한다')}`]] : [`횃불 · ${PIECE_NAME[cell.t]}`, ['아무것도 지키지 못한다']];
      // 판 위 사물(발판 · 문 · 고속도로 줄): 칸 자체가 스스로 풀이한다. 적이 서 있으면 그 풀이 아래에 한 줄 더
      const objs = isHidden(b, sq) ? [] : objectsAt(b.rules, sq);
      if (objs.length) tip = tip ? [tip[0], [...tip[1], ...objs.map((o) => o[1])]] : [objs.map((o) => o[0]).join(' · '), objs.map((o) => o[1])];
      const tipOpt = tip ? sqTip(tip[0], tip[1], diag) : null;
      // 낱말 상자: 말풍선 제목이 곧 낱말인 것(증원 · 지키는 적 · 특성 · 벽 · 보석 · 특수 기물)
      if (tipOpt) tipOpt.keys = [g && { id: 'reinforce' }, forced && forced.has(sq) && { id: 'threat' }, cell && !cell.mine && cell.trait && { id: 'trait' }, cell && cell.t === 'X' && { id: 'wall' }, cell && cell.t === 'J' && { id: 'gem' }, cell && !cell.mine && isFairy(cell.t) && { id: 'fairy' }].filter(Boolean);
      ui.region(id, x, y, S, S, { onClick: () => this.clickSq(sq), ...tipOpt });
      if (tset.has(sq) && t.kind !== 'capture') {
        const pulse = 0.22 + 0.12 * Math.sin(time * 5);
        ctx.globalAlpha = pulse; rect(ctx, x, y, S, S, PAL.gold); ctx.globalAlpha = 1;
        frame(ctx, x + 1, y + 1, S - 2, S - 2, PAL.goldHi);
      }
      if (ui.isHover(id) && tset.has(sq)) frame(ctx, x, y, S, S, PAL.white);
    }
    drawMarkSquares(ctx, this.marks, sqXY, S);
    // 증원 그림자: 점선 테 안에 빈 윤곽(속이 비어 판 위의 적과 섞이지 않는다)과 흔들리는 ▼. 두 수 앞은 윤곽도 점선
    for (const [sq, g] of ghosts) {
      const { x, y } = sqXY(sq);
      dots(ctx, x, y, S, S, g.k ? PAL.dimDk : PAL.shadow, 2);
      ctx.drawImage(outlineCanvas(artOf(g.t), TONE.b.o, g.k > 0, hiFor(ctx)), x + 5, y + 5, SW + 2, SH + 2);
      const bob = Math.floor(time * 3 + sq * 0.37) % 2;
      ctx.globalAlpha = g.k ? 0.5 : 1;
      dropMark(ctx, x + 12, y + 1 + bob, TONE.b.o);
      ctx.globalAlpha = 1;
    }
    // 사슬 길
    if (v.chain) {
      const path = v.chain.path;
      for (let i = 0; i + 1 < path.length; i++) {
        const a = this.center(path[i]), c = this.center(path[i + 1]);
        line(ctx, a.x, a.y, c.x, c.y, PAL.gold);
      }
      for (let i = 1; i < path.length; i++) {
        const { x, y } = sqXY(path[i]);
        frame(ctx, x, y, S, S, PAL.gold);
      }
      for (const [a0, b0] of v.chain.shots || []) { const a = this.center(a0), c = this.center(b0); dotLine(ctx, a.x, a.y, c.x, c.y, PAL.gold, 2); const B = sqXY(b0); dots(ctx, B.x, B.y, S, S, PAL.gold, 2); }
    }
    // 궁수의 화살
    if (v.arrow) {
      const a = this.center(v.arrow.from), c = this.center(v.arrow.to), k = v.arrow.p;
      const x = a.x + (c.x - a.x) * k, y = a.y + (c.y - a.y) * k - Math.sin(k * Math.PI) * 6;
      const tx = a.x + (c.x - a.x) * Math.max(0, k - 0.15), ty = a.y + (c.y - a.y) * Math.max(0, k - 0.15) - Math.sin(Math.max(0, k - 0.15) * Math.PI) * 6;
      line(ctx, tx, ty, x, y, PAL.goldHi);
      rect(ctx, Math.round(x) - 1, Math.round(y) - 1, 2, 2, PAL.white);
    }
    // 지금 모습의 행마선: 다음 먹기를 기다릴 때 갈 수 있는 칸을 흐리게(막히면 끊긴다)
    if (v.chain && !this.busy && !v.chain.awaiting && !v.cut && b.status === 'chain') {
      this.drawReach(ctx, v.chain.form, v.chain.sq);
      for (const f of v.chain.absorbed || []) this.drawReach(ctx, f, v.chain.sq);
    }
    // 기물
    for (let sq = 0; sq < 64; sq++) {
      const c = v.board[sq];
      if (!c) continue;
      if (isHidden(b, sq) && !c.mine) continue;
      const { x, y } = sqXY(sq);
      if (c.mine) {
        if (v.mover) continue;
        let sx = 1, dy = 0, side = 'w';
        if (v.flip && v.flip.sq === sq) { sx = Math.abs(1 - 2 * v.flip.p); side = 's'; }
        // 떨어져 내림 · 들림은 소수점 자리로(빛과 움직임 — 3배 화면에서 계단 없이)
        if (v.dropIn && v.dropIn.sq === sq) dy = -(1 - v.dropIn.p) * 10;
        if (v.lift && v.lift.sq === sq) { dy = -Math.sin(v.lift.p * Math.PI) * 8; side = 'q'; }
        let alpha = 1;
        if (v.cut && v.cut.sq === sq) alpha = 1 - v.cut.p;
        const lk = side === 'w' ? this.look(c.t, time) : {};
        this.putPiece(ctx, c.t, side, x + 6, y + 3 + dy, { sx, alpha, ...lk }, -dy);
        continue;
      }
      let dy = 0;
      if (t.kind === 'capture' && tset.has(sq)) dy = Math.floor(time * 4 + sq * 0.37) % 2 ? -2 : -1;
      if (this.falls && this.falls.has(sq)) { const p = this.falls.get(sq) / FALL; dy -= (1 - p * p) * FALL_PX; }
      if (openKings && openKings.has(sq) && c.t === 'K') {
        const a = 0.5 + 0.3 * Math.sin(time * 4);
        ctx.globalAlpha = a; frame(ctx, x + 2, y + 2, S - 4, S - 4, PAL.gold); ctx.globalAlpha = 1;
      }
      if (forced && forced.has(sq)) {
        if (Math.floor(time * 6) % 2 === 0) frame(ctx, x, y, S, S, PAL.red, 2);
        ctx.globalAlpha = 0.25; rect(ctx, x, y, S, S, PAL.red); ctx.globalAlpha = 1;
        hatch(ctx, x, y, PAL.redDk);
      }
      // 금빛 적: 몸 뒤에 은은한 금빛(천천히 숨 쉰다)
      if (c.gold) glowText(ctx, x + 6, y + 4, 16, 20, PAL.gold, 0.45 * flicker(time + sq, 2.4, 0.3), 5);
      this.putPiece(ctx, c.t, c.gold ? 'g' : 'b', x + 6, y + 3 + dy, {}, -dy);
      if (c.trait) traitMark(ctx, c.trait, x + 2, y + S - 8);
      if (c.muted) torchMark(ctx, x + S - 7, y + 2, time);
      // 얼린 적(묘수 「빙결」): 얼음빛 덮개 · 이번 수 동안 아무것도 지키지 못한다
      if (c.frozen) { ctx.globalAlpha = 0.35; rect(ctx, x + 2, y + 2, S - 4, S - 4, '#9fd3e0'); ctx.globalAlpha = 1; frame(ctx, x + 1, y + 1, S - 2, S - 2, '#9fd3e0'); }
      if (c.gold) {
        const k = Math.floor(time * 8 + sq) % 12;
        if (k < 3) rect(ctx, x + 8 + k * 4, y + 4 + k * 3, 1, 1, PAL.goldHi);
      }
      if (t.kind === 'capture' && tset.has(sq) && ui.isHover(`sq:${sq}`)) frame(ctx, x, y, S, S, PAL.white);
    }
    // 움직이는 내 기물
    if (v.mover) {
      const m = moverXY(v.mover.form, v.mover.from, v.mover.to, v.mover.p);
      // 그림자는 뛰는 호 밑 바닥 자리에(뛰면 작아지고 옅어진다)
      this.putPiece(ctx, v.mover.form, 'w', m.x + 6, m.y + 3, this.look(v.mover.form, time), Math.max(0, m.arc || 0));
    }
    // 노림수: 내 기물을 노리는 적에서 붉은 끊어진 선이 내 기물 쪽으로 흐른다(먹을 수 없는 적은 어두운 붉은색).
    // 붙어 있는 적이 많아 기물 위에 긋되, 양 끝은 기물 몸을 비켜 칸 가장자리 쪽만
    if (forced && !v.cut) {
      const c = this.center(v.chain.sq);
      const off = this.app.reducedMotion ? 0 : Math.floor(time * 12);
      for (const s of forced) {
        if (isHidden(b, s)) continue;
        const a = this.center(s);
        const d = Math.hypot(c.x - a.x, c.y - a.y), k = 10 / d;
        if (d < 24) continue;
        dashLine(ctx, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, c.x - (c.x - a.x) * k, c.y - (c.y - a.y) * k, t.kind === 'capture' && tset.has(s) ? PAL.red : PAL.redDk, off);
      }
    }
    this.drawPreview(ctx, ui);
    // 끊김: 노린 적에서 붉은 선 · 금
    if (v.cut) {
      const c = this.center(v.cut.sq);
      for (const s of v.cut.attackers) { const a = this.center(s); line(ctx, a.x, a.y, c.x, c.y, PAL.red); }
      const { x, y } = sqXY(v.cut.sq);
      line(ctx, x + 4, y + 3, x + 12, y + 12, PAL.red); line(ctx, x + 12, y + 12, x + 9, y + 18, PAL.red); line(ctx, x + 9, y + 18, x + 22, y + 26, PAL.red);
      frame(ctx, x, y, S, S, PAL.red, 2);
      hatch(ctx, x, y, PAL.red);
    }
    // 응수 칸
    if (v.chain && v.chain.forced && !v.cut) {
      const { x, y } = sqXY(v.chain.sq);
      if (Math.floor(time * 6) % 2 === 0) frame(ctx, x, y, S, S, PAL.red, 2);
    }
    // 판 위 화살표(오른쪽으로 끌어 그은 것): 기물 위에 반투명. 끄는 중이면 가리킨 칸까지 흐리게
    const mk = this.marks, to = mk.from >= 0 ? sqAt(ui.mouse.x, ui.mouse.y) : -1;
    drawMarkArrows(ctx, mk, sqXY, S, to >= 0 && to !== mk.from ? { from: mk.from, to } : null);
  }

  // 묘수(깊이 F): 손 이름표 옆의 작은 칸. 떨구기 전에 눌러 쓴다
  drawTactics(ctx, ui, y, row = this.handRowLayout()) {
    const run = this.run, live = this.live();
    if (!run) return;
    row.tactics.forEach(({ i, x }) => {
      const c = run.consumables[i];
      const ok = !this.busy && live && live.status === 'play';
      const id = `tactic:${i}`;
      // 묘수 칸(15)은 손 이름표 줄(BTN_S) 가운데
      const ty = y + ((BTN_S - 15) >> 1);
      ui.region(id, x, ty, 15, 15, { enabled: ok, onClick: () => this.useTactic(i), tip: () => itemTip(c), preview: true });
      box(ctx, x, ty, 15, 15, '#132019', ui.isHover(id) && ok ? PAL.gold : PAL.frameDk);
      ctx.save(); ctx.translate(x + 1, ty + 2); ctx.scale(0.8, 0.8); tacticIcon(ctx, c.id, 0, 0); ctx.restore();
    });
  }
  useTactic(i) {
    let ev;
    try { ev = this.app.cmd({ type: 'tactic', index: i }); } catch { this.toast('할 수 없다', PAL.red); return; }
    this.sync();
    for (const e of ev) {
      if (e.type === 'freeze') { for (const sq of e.squares) this.sparkle(sq, '#9fd3e0', 8); this.word('빙결', '#9fd3e0', 1.2, 1); this.snd('glass'); }
      if (e.type === 'reload') { this.word('수 +1', PAL.gold, 1.2, 1); this.snd('coin'); }
      if (e.type === 'taunt') { for (const sq of e.squares) this.sparkle(sq, '#df8a45', 8); this.word('도발', '#df8a45', 1.2, 1); this.snd('reinforce'); }
    }
  }

  // 판 위 사물(정석): 고속도로 줄 · 금빛 발판 · 문
  drawBoardThings(ctx, rules, time) {
    if (!rules) return;
    for (const f of rules.highways || []) {
      const x = BX + f * S + Math.floor(S / 2);
      ctx.globalAlpha = 0.35;
      for (let y = BY + 2; y < BY + S * 8 - 2; y += 4) { rect(ctx, x - 4, y, 1, 2, PAL.goldDk); rect(ctx, x + 3, y, 1, 2, PAL.goldDk); }
      ctx.globalAlpha = 1;
    }
    for (const sq of rules.steps || []) {
      const { x, y } = sqXY(sq);
      ctx.globalAlpha = 0.45; rect(ctx, x + 3, y + 3, S - 6, S - 6, PAL.gold); ctx.globalAlpha = 1;
      frame(ctx, x + 3, y + 3, S - 6, S - 6, PAL.goldDk);
      for (const [i, j] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5]]) rect(ctx, x + i, y + j, 1, 1, PAL.goldHi);
    }
    // 강(정석): 넷째 줄과 다섯째 줄 사이를 흐르는 물결
    if (rules.river) {
      const y = BY + S * 4;
      for (let x = BX + 1; x < BX + S * 8 - 1; x++) { const w = Math.round(Math.sin((x + time * 12) / 3)); rect(ctx, x, y - 1 + w, 1, 1, '#6fa8d8'); if ((x & 3) === 0) rect(ctx, x, y + w, 1, 1, '#c8e0f0'); }
    }
    for (const sq of rules.traps || []) { const { x, y } = sqXY(sq); trapPit(ctx, x, y, S); }
    // 문: 어두운 청록 문 안쪽 + 굵은 아치 테 + 문턱. 기물이 서도 기둥 · 윗테 · 문턱이 남는다. 두 문이 번갈아 숨 쉰다
    (rules.gates || []).forEach((sq, k) => {
      const { x, y } = sqXY(sq);
      gateArch(ctx, x, y, S, 0.35 + 0.25 * Math.sin(time * 3 + k * Math.PI));
    });
  }

  // 판 위 기물 하나.
  // 발밑 그림자(light.js): lift는 바닥에서 들린 높이(도트) — 들리면 작아지고 옅어진다. 움직이는 기물은 소수점 자리에 선다(fine)
  putPiece(ctx, type, side, x, y, opts = {}, lift = 0) {
    if (opts.alpha == null || opts.alpha > 0.3) groundShadow(ctx, x + 8, y + lift + 22, lift);
    if (y % 1 || x % 1) fine(() => sprite(ctx, type, side, x, y, opts));
    else sprite(ctx, type, side, x, y, opts);
  }

  drawReach(ctx, form, from) {
    const v = this.view, o = this.center(from);
    const slide = SLIDERS.has(form);
    ctx.globalAlpha = 0.4;
    for (const s of reach(v.board, form, from, 1)) {
      const c = this.center(s);
      if (slide) dotLine(ctx, o.x, o.y, c.x, c.y, PAL.goldHi, 2);
      if (!v.board[s]) { if (slide) rect(ctx, c.x - 1, c.y - 1, 2, 2, PAL.goldHi); else frame(ctx, c.x - 3, c.y - 3, 6, 6, PAL.goldHi); }
    }
    ctx.globalAlpha = 1;
  }

  // 먹기 전에 「그것」이 보인다: 겨눈 적 칸에 바뀐 모습, 다음에 먹을 적에 고리(응수면 붉은 빗금), 끊기면 붉은 금
  drawPreview(ctx, ui) {
    const v = this.view;
    const aim = this.busy ? null : this.aimSq(ui);
    const pv = aim != null ? this.preview(aim) : null;
    this.pvNow = pv;
    if (!pv) return;
    const time = this.app.time;
    const T = sqXY(pv.sq), tc = this.center(pv.sq);
    if (pv.kind === 'capture' && v.chain) {
      const fc = this.center(v.chain.sq);
      dotLine(ctx, fc.x, fc.y, tc.x, tc.y, PAL.goldHi);
      frame(ctx, T.x, T.y, S, S, PAL.gold);
      sprite(ctx, pv.form, 'w', T.x + 6, T.y + 2, { alpha: 0.62 + 0.12 * Math.sin(time * 6), ...this.look(pv.form) });
      if (pv.cut) {
        for (const s of pv.cut) { const a = this.center(s); dotLine(ctx, a.x, a.y, tc.x, tc.y, PAL.red, 2); const A = sqXY(s); ringAt(ctx, A.x, A.y, PAL.red, 2); }
        line(ctx, T.x + 5, T.y + 5, T.x + 22, T.y + 22, PAL.red); line(ctx, T.x + 22, T.y + 5, T.x + 5, T.y + 22, PAL.red);
        return;
      }
    } else if (pv.kind === 'drop') {
      sprite(ctx, pv.form, 'w', T.x + 6, T.y + 3, { alpha: 0.5, eng: this.sel.length === 1 && v.hand[this.sel[0]] && v.hand[this.sel[0]].eng ? v.hand[this.sel[0]].eng.id : null, tier: this.look(pv.form).tier });
    }
    for (const s of pv.next) {
      const A = sqXY(s), c = this.center(s);
      const reply = pv.forced && pv.forced.includes(s);
      dotLine(ctx, tc.x, tc.y, c.x, c.y, reply ? PAL.red : PAL.gold);
      if (reply) { ctx.globalAlpha = 0.6; hatch(ctx, A.x, A.y, PAL.red); ctx.globalAlpha = 1; }
      ringAt(ctx, A.x, A.y, reply ? PAL.red : PAL.gold, 2);
    }
  }

  // 오른쪽 작은 판넬(격언 칸 위에 뜬다): 지금 [모습] › 먹으면 [모습] → 얻을 값 · 배수, 그 아래 한 줄 판넬에 그다음
  drawPreviewPanel(ctx) {
    const pv = this.pvNow, v = this.view;
    if (!pv || pv.kind !== 'capture' || !v.chain) return;
    const P = PAD_BOX, f = flow(TOP + P);
    const labY = f.line();
    f.gap(GAP_IN);
    const artY = f.space(34);
    f.gap(GAP_GROUP);
    const valY = f.line();
    const h1 = f.y + P - TOP;
    openBox('panel', RX, TOP, RW, h1, P, { overlay: true, name: '먹으면' });
    panel(ctx, RX, TOP, RW, h1);
    text(ctx, '지금', RX + 21, labY, PAL.dim, { align: 'center' });
    text(ctx, '먹으면', RX + 77, labY, PAL.dim, { align: 'center' });
    box(ctx, RX + 8, artY, 26, 34, PAL.light, PAL.frameDk);
    sprite(ctx, v.chain.form, 'w', RX + 13, artY + 6, this.look(v.chain.form));
    text(ctx, '›', RX + 49, artY + 9, PAL.gold, { align: 'center', bold: true, scale: 2 });
    box(ctx, RX + 64, artY, 26, 34, pv.cut ? PAL.red : PAL.gold, PAL.frameDk);
    sprite(ctx, pv.form, 'w', RX + 69, artY + 6, this.look(pv.form));
    text(ctx, `+${short(pv.value)}`, RX + P, valY, PAL.val, { bold: true });
    text(ctx, `배수 +${short(pv.mult)}`, RX + RW - P, valY, PAL.gold, { align: 'right', bold: true });
    closeBox();
    const y2 = TOP + h1 + LIST_GAP * 2, h2 = P * 2 + LINE;
    openBox('panel', RX, y2, RW, h2, P, { overlay: true, name: '그다음' });
    panel(ctx, RX, y2, RW, h2);
    const [msg, col] = pv.cut ? ['끊긴다', PAL.red] : pv.mate ? ['체크메이트', PAL.gold] : pv.redrop ? ['다시 떨군다', PAL.gold]
      : pv.done ? ['사슬이 끝난다', PAL.dim] : pv.forced ? [`지키는 적 ${pv.next.length}`, PAL.red] : [`다음에 먹을 적 ${pv.next.length}`, PAL.gold];
    fitText(ctx, msg, RX + P, y2 + textY(P), RW - P * 2, col);
    closeBox();
  }

  // 왼쪽 칸 자리: 머리 칸 내용(headSpec — 수업이 바꾼다)과 아래 칸 줄 수로 쌓는다
  headSpec() {
    const b = this.b, run = this.run, master = b.mods.find((s) => MASTER_BY_ID[s.id]);
    // 명인 대국은 제목이 곧 명인 이름(빨간 글 · 가리키면 「마스터 ○○」 규칙 — 우두머리 이름이 곧 세력을 말한다).
    // 연습 · 정식은 「농민군 · 연습 대국」, 한 줄에 안 들어가면 「농민군 · 연습」, 그래도 안 들어가면(영어) 세력 이름만
    // (머리 칸은 한 줄: 두 줄이면 사슬 칸이 모자란다. 대국 종류는 관 줄의 「이기면 $3 · $4」와 목표가 말한다)
    const fa = factionOfBattle(b);
    const room = LW - PAD_BOX * 2;
    // 마스터전 제목은 이름만(CHM-46): 「마스터」는 빨간 제목 빛깔과 가리키면 뜨는 말풍선 제목(「마스터 ○○」)이 말한다 — 「마스터 사냥꾼 두령」이 폭 96을 넘었다
    let title = master ? MASTER_BY_ID[master.id].name : KIND_NAME[b.kind];
    if (fa && !master) {
      const cands = [`${fa.name} · ${KIND_NAME[b.kind]}`, `${fa.name} · ${KIND_SHORT[b.kind]}`];
      title = cands.find((c) => measure(c, true) <= room) || cands.find((c) => measure(c) <= room) || fa.name;
    }
    return {
      kicker: run && !run.endless ? `${b.ante}/${ANTES}관` : `${b.ante}관`,
      right: `이기면 $${REWARD.base[b.kind]}`,
      titles: [title],
      faction: fa,
      titleCol: master ? PAL.red : PAL.gold,
      master: master ? MASTER_BY_ID[master.id] : null,
      target: num(this.view.target),
      targetN: this.view.target,
    };
  }
  leftLayout() {
    const spec = this.headSpec();
    // 이기면 받는 상금: 관 줄 오른쪽에 들어가면 거기, 안 들어가면(영어 · 긴 관) 목표 줄 아래 한 줄
    spec.rightInline = !!spec.right && measure(spec.kicker) + 4 + measure(spec.right) <= LW - PAD_BOX * 2;
    const head = headLayout(spec.titles.length, spec.right && !spec.rightInline ? 3 : 2);
    const foot = footLayout(this.run ? (hasClock(this.run) ? 5 : 4) : 3);
    const st = sideStack(head.h, foot.h);
    const val = { y: st.mid.y, h: VAL_H };
    const chainY = val.y + VAL_H + GAP_GROUP;
    return { spec, headLay: head, head: st.head, foot: st.foot, val, chain: { y: chainY, h: st.mid.y + st.mid.h - chainY }, score: st.head.y + head.rows[head.rows.length - 1] };
  }
  // 탁월수 배수(CHM-43): 배수 칸(모인 뒤엔 점수 칸)에 청록 테와 오른쪽 위 「×N」 딱지. 값 × 배수가 점수로 흘러갈 때까지
  brillTag(ctx, x, y, w) {
    const T = ANNOT.teal, mark = `×${Number(this.view.brill.x.toFixed(2))}`, sz = annotSize(mark);
    frame(ctx, x, y, w, VAL_H, T.fill);
    frame(ctx, x + 1, y + 1, w - 2, VAL_H - 2, T.edge);
    drawAnnot(ctx, mark, x + w - sz.w + 4, y - 7, T);
  }
  // 수가 오른 순간부터 스러지는 빛 세기(1 → 0, 0.45초). 움직임 줄이기에도 남는다(한 번 밝아지는 것은 떨림이 아니다)
  pulseAt(key, n, time) {
    const P = this.pulses || (this.pulses = {});
    const p = P[key] || (P[key] = { n, t: -9 });
    if (n > p.n) p.t = time;
    p.n = n;
    const k = (time - p.t) / 0.45;
    return k >= 0 && k < 1 ? (1 - k) * (1 - k) : 0;
  }
  drawLeft(ctx, ui) {
    const app = this.app, v = this.view, run = this.run;
    const P = PAD_BOX, lay = this.leftLayout(), spec = lay.spec, hl = lay.headLay, hy = lay.head.y;
    // 머리 칸(판 틀 공통): 관(머릿말, 오른쪽에 이기면 받는 상금) → 대국 종류(제목) → 목표 · 점수
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const hot = v.target && score >= v.target;
    openBox('panel', LX, hy, LW, lay.head.h, P, { name: '머리 칸' });
    panel(ctx, LX, hy, LW, lay.head.h);
    ui.sideItem(LX, hy, LW, lay.head.h, { rows: [rowSpan(hy + hl.kicker), ...hl.titles.map((t) => rowSpan(hy + t, LINE_TITLE)), ...hl.rows.map((t) => rowSpan(hy + t))] });
    text(ctx, spec.kicker, LX + P, hy + hl.kicker, PAL.dim);
    if (spec.rightInline) text(ctx, spec.right, LX + LW - P, hy + hl.kicker, PAL.goldDk, { align: 'right' });
    spec.titles.forEach((l, k) => fitText(ctx, l, LX + P, hy + hl.titles[k], LW - P * 2, spec.titleCol));
    // 제목 줄을 가리키면: 명인 대국은 명인 규칙, 연습 · 정식은 세력의 버릇
    if (spec.master) { const m = spec.master; ui.region('master', LX + 2, hy + hl.titles[0], LW - 4, 16, { tip: () => tipLines(`마스터 ${m.name}`, m.text) }); }
    else if (spec.faction) { const fa = spec.faction; ui.region('faction', LX + 2, hy + hl.titles[0], LW - 4, 16, { tip: () => tipLines(fa.name, fa.habit.text) }); }
    // 수치가 이름표 옆에 안 들어가면(끝없는 대국의 큰 수) 짧은 꼴(1.2G)로
    const fitRow = (label, n) => (typeof n === 'number' ? fitNum(n, LW - P * 2 - measure(label) - 4) : n);
    text(ctx, '목표', LX + P, hy + hl.rows[0], PAL.dim);
    text(ctx, fitRow('목표', spec.targetN ?? spec.target), LX + LW - P, hy + hl.rows[0], PAL.ink, { align: 'right', bold: true });
    if (spec.right && !spec.rightInline) { const m = spec.right.match(/^(.*?)\s*(\$\d+)$/); text(ctx, m ? m[1] : spec.right, LX + P, hy + hl.rows[1], PAL.dim); if (m) text(ctx, m[2], LX + LW - P, hy + hl.rows[1], PAL.goldDk, { align: 'right', bold: true }); }
    // 점수(목표를 넘기면 불붙는다) — 머리 칸 마지막 줄
    const sy = hy + hl.rows[hl.rows.length - 1];
    if (hot) { const k = Math.floor(app.time * 10) % 3; frame(ctx, LX + 2, sy, LW - 4, LINE, k ? PAL.gold : PAL.red); }
    // 점수 빛: 오르는 동안 밝아졌다가 가라앉고, 목표를 넘기면 금빛이 남는다(글자 뒤 층)
    {
      const up = this.pulseAt('score', score, app.time);
      const sw = measure(num(Math.floor(score)), true);
      const a = (hot ? 0.3 * flicker(app.time, 4) : 0) + up * 0.55;
      if (a > 0.01) glowText(ctx, LX + LW - P - sw, sy, sw, 12, PAL.gold, a, 7);
    }
    text(ctx, '점수', LX + P, sy, PAL.dim);
    text(ctx, fitRow('점수', score), LX + LW - P, sy, hot ? PAL.gold : PAL.ink, { align: 'right', bold: true });
    closeBox();
    this.drawFlames(ctx);
    // 값 × 배수
    const c = v.chain;
    const g = v.gather;
    const val = g ? g.value : c ? c.value : 0;
    const mul = g ? g.mult : c ? c.mult : 0;
    const gp = g ? g.p : 0;
    const dx = gp * 32;
    const VY = lay.val.y, VT = VY + Math.floor((VAL_H - 12) / 2) - 1;
    // 설명 자리 접기(fold.js): 빈 값 칸 · 배수 칸(수 · 「×」 없이)
    ui.sideItem(LX, VY, LW, VAL_H, { blank: (ctx2, ground) => { box(ctx2, LX, VY, 48, VAL_H, PAL.val, PAL.frameDk); box(ctx2, LX + 64, VY, 48, VAL_H, PAL.link, PAL.frameDk); if (ground) ground({ x: LX + 48, y: VY, w: 16, h: VAL_H }); } });
    // 값 × 배수 빛: 수가 오를 때 잠깐 밝아졌다가 가라앉는다. 사슬이 이어지는 동안은 옅게 남는다(칸 뒤 층)
    {
      const t = app.time, live = c && !g ? 0.22 * flicker(t, 3.2) : 0;
      const uv = this.pulseAt('value', val, t), um = this.pulseAt('mult', mul, t);
      if (g && g.burst) glow(ctx, LX, VY, LW, VAL_H, PAL.goldHi, 0.7 * Math.max(0, 1 - (g.p || 0)) + 0.3, 8);
      else {
        if (val > 0) glow(ctx, LX + dx, VY, 48, VAL_H, PAL.val, live + uv * 0.6, 6);
        if (mul > 0) glow(ctx, LX + 64 - dx, VY, 48, VAL_H, PAL.gold, live + um * 0.6, 6);
      }
    }
    if (v.count) {
      // 곱이 점수 줄로 흘러 들어간다
      const k = v.count.p;
      const tx = lerp(LX + LW / 2, LX + LW - 30, k), ty = lerp(VT, lay.score, k);
      openBox('fx', Math.round(tx) - 40, Math.round(ty), 80, 14, 0, { loose: true, name: '흘러가는 수' });
      const fs = fitNum(v.count.to - v.count.from, LW), fw = measure(fs, true);
      glowText(ctx, tx - fw / 2, ty, fw, 12, PAL.gold, 0.5 * (1 - k * 0.8), 7);
      fine(() => text(ctx, fs, tx, ty, PAL.gold, { align: 'center', bold: true, alpha: 1 - k * 0.8, shadow: PAL.shadow }));
      closeBox();
    }
    if (g && g.burst) {
      openBox('edge', LX, VY, LW, VAL_H, 1, { name: '값 × 배수' });
      box(ctx, LX, VY, LW, VAL_H, PAL.gold, PAL.frameDk);
      // 곱이 칸 폭(테 1 + 틈 EDGE_PAD 양쪽)을 넘으면 짧은 꼴(끝없는 대국의 13자리 곱)
      text(ctx, fitNum(g.score, LW - (1 + EDGE_PAD) * 2), LX + LW / 2, VT, PAL.linkInk, { align: 'center', bold: true });
      closeBox();
      if (v.brill) this.brillTag(ctx, LX, VY, LW);
    } else {
      ui.region('box:value', LX, VY, 48, VAL_H, { keys: [{ id: 'value' }] });
      ui.region('box:links', LX + 64, VY, 48, VAL_H, { keys: [{ id: 'links' }] });
      // 모이는 동안(g) 두 칸은 소수점 자리로 미끄러진다
      const drawVM = () => {
        openBox('edge', LX + dx, VY, 48, VAL_H, 1, { name: '값', loose: !!g });
        box(ctx, LX + dx, VY, 48, VAL_H, PAL.val, PAL.frameDk);
        text(ctx, short(val), LX + dx + 24, VT, PAL.valInk, { align: 'center', bold: true });
        closeBox();
        if (!g) text(ctx, '×', LX + 56, VT, PAL.ink, { align: 'center', bold: true });
        openBox('edge', LX + 64 - dx, VY, 48, VAL_H, 1, { name: '배수', loose: !!g });
        box(ctx, LX + 64 - dx, VY, 48, VAL_H, PAL.link, PAL.frameDk);
        text(ctx, short(mul), LX + 88 - dx, VT, PAL.linkInk, { align: 'center', bold: true });
        closeBox();
      };
      if (g) fine(drawVM); else drawVM();
      if (v.brill) fine(() => this.brillTag(ctx, LX + 64 - dx, VY, 48));
    }
    // 사슬 칸: 지나온 모습은 작게(왼쪽 아래), 지금 모습은 크게(2배, 오른쪽). 남는 높이를 가진다(모자라면 지금 모습도 1배)
    const cy = lay.chain.y, ch = lay.chain.h;
    openBox('panel', LX, cy, LW, ch, P, { name: '사슬 칸' });
    panel(ctx, LX, cy, LW, ch);
    ui.sideItem(LX, cy, LW, ch);
    const steps = c ? c.steps : this.lastEnd ? this.lastEnd.steps : [];
    const a = c ? 1 : 0.45;
    const past = steps.slice(Math.max(0, steps.length - 4), -1);
    const eng = c ? c.eng : this.lastEnd ? this.lastEnd.eng : null;
    const tierAt = (tp) => (run ? tierOf(run.charts[tp]) : 0);
    const big = ch >= 44 + 4;
    past.forEach((tp, i) => sprite(ctx, tp, 'w', LX + 5 + i * 19, cy + ch - 24, { alpha: a, eng, tier: tierAt(tp) }));
    if (steps.length > 4) text(ctx, `+${steps.length - 4}`, LX + P, cy + textY(P), PAL.dim);
    const cur = steps[steps.length - 1];
    if (cur) {
      const cw = big ? 32 : 16, chh = big ? 44 : 22, cx0 = LX + LW - 6 - cw, cy0 = cy + Math.floor((ch - chh) / 2);
      if (c && c.cut) { ctx.globalAlpha = 0.35; rect(ctx, cx0 - 2, cy + 2, cw + 4, ch - 4, PAL.red); ctx.globalAlpha = 1; }
      ctx.globalAlpha = a;
      ctx.drawImage(spriteCanvas(artOf(cur), 'w', eng, tierAt(cur), hiFor(ctx, cw / SW)), cx0, cy0, cw, chh);
      ctx.globalAlpha = 1;
    }
    closeBox();
    // 아래 칸: 수 · 희생(구슬) → 상금 → 주머니
    const pipX = Math.max(52, Math.max(measure('수'), measure('희생')) + PAD_BOX + 6);
    const pipN = Math.max(v.moves, v.discards, 1);
    const pipStep = Math.min(14, Math.floor((LW - PAD_BOX - pipX) / pipN));
    const pipW = Math.max(4, pipStep - 4);
    const pips = (n, left, col) => (ctx2, ty) => {
      for (let i = 0; i < n; i++) rect(ctx2, LX + pipX + i * pipStep, ty + 3, pipW, 7, i < left ? col : PAL.frame);
    };
    const rows = [
      { id: 'pips:moves', label: '수', tip: () => tipLines('수', '이번 대국에 떨굴 수 있는 횟수. 다 쓰면 대국이 끝난다'), draw: (ctx2, ty) => { text(ctx2, '수', LX + P, ty, PAL.dim); pips(v.moves, v.movesLeft, PAL.gold)(ctx2, ty); } },
      { id: 'pips:discards', label: '희생', tip: () => this.offeredTip(), draw: (ctx2, ty) => { text(ctx2, '희생', LX + P, ty, PAL.dim); pips(v.discards, v.discardsLeft, PAL.red)(ctx2, ty); this.offeredRow(ctx2, LX + pipX + Math.max(0, v.discards - 1) * pipStep + pipW + 3, LX + LW - 2, ty); } },
    ];
    if (hasClock(run)) rows.push(clockRow(app, run));
    if (run) rows.push({ money: run });
    rows.push({ id: 'bag', label: '주머니', val: `${v.bag} / ${v.deckSize}`, tip: () => bagTip(this.b) });
    drawFoot(ctx, ui, rows);
  }

  // 바친 기물 줄(CHM-43 시안 A1): 희생 구슬 오른쪽에 반 크기 흐린 실루엣. 자리가 모자라면 앞에서부터 들어가는 만큼 + 작은 「+N」
  offeredRow(ctx, x0, x1, ty) {
    const list = this.view.offered || [];
    const row = offeredRow(list.length, x0, x1);
    const hi = hiFor(ctx, 0.5);
    row.xs.forEach((x, i) => {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(spriteCanvas(artOf(list[i]), 'w', null, 0, hi), x, ty - 1, SW / 2, SH / 2);
      ctx.globalAlpha = 1;
    });
    if (row.more && row.fits) drawMore(ctx, row.more, row.moreX, ty + 4, PAL.dim, digits);
    this.offeredLayout = { ...row, x0, x1, n: list.length };
  }
  offeredTip() {
    const list = this.view.offered || [];
    const body = ['손의 기물을 바치고 새로 뽑을 수 있는 횟수'];
    if (list.length) body.push(`바친 기물: ${list.map((t) => PIECE_NAME[t]).join(' · ')}`);
    return tipLines('희생', body);
  }
  // 오른쪽 칸 쌓기: 격언 칸(칸마다 이름 한 줄) → 시너지 띠 → 손 이름표 줄(묘수 · 희생) → 손. 묶음 사이 GAP_GROUP
  // 시너지 띠는 칩(FAM_H) 두 줄 — 그러면 격언 칸이 한 줄로 안 들어가는 판(칸 다섯 이상)은 한 줄에 못 놓은 것을 「+N」로
  // 다시 놓기(밤샘 2 D2): 첫 수 전에만, 손 이름표 줄의 「손」 · 묘수 오른쪽에 아이콘 단추(이름은 말풍선 — CHM-40).
  // 전에는 손 이름표 줄 위에 단추 줄을 따로 두었는데, 그 줄 때문에 기본 격언 다섯 칸이 두 줄로 접혀 이름이 잘렸다.
  // 시안(docs/shots/night2/draft-*): 1 왼쪽 사슬 칸 가운데(골랐다가 옮김 — 왼쪽 칸은 판 틀의 설명 자리라 말풍선이 단추를 덮었다) ·
  // 2 사슬 칸 구석 아이콘만 · 3 사슬 칸을 채운 금빛 단추
  rightLayout(run = this && this.run) {
    const HAND_H = 36, ROW_H = BTN_S;
    const at = (rows) => {
      const strip = rows * FAM_H + (rows - 1) * LIST_GAP;
      // 아래에서부터: 손(화면 아래 2px 위까지) → 손 이름표 줄 → 시너지 띠. 격언 칸은 TOP부터 띠 위까지(room)
      const handY = 270 - 2 - HAND_H, rowY = handY - GAP_IN - ROW_H;
      const stripY = rowY - GAP_GROUP - strip;
      return { room: stripY - GAP_GROUP - TOP, stripY, rows, rowY, handY, HAND_H };
    };
    const two = at(2);
    return run && maximColumnH(run, two.room).cols === 1 ? two : at(1);
  }
  // 손 이름표 줄 왼쪽(희생 단추 앞, 틈 3): 「손」 → 묘수 칸들 → 다시 놓기 단추(칸마다 15, 사이 2).
  // 칸이 다 들어가지 않으면 「손」 글자를 빼고(손 카드가 바로 아래 있다), 그래도 모자라면 칸 사이를 1로
  handRowLayout() {
    const run = this.run;
    const tactics = run ? run.consumables.map((c, i) => (c.kind === 'tactic' ? i : -1)).filter((i) => i >= 0) : [];
    const rb = this.canReboard();
    const n = tactics.length + (rb ? 1 : 0);
    const itemsW = (gap) => (n ? n * 15 + (n - 1) * gap : 0);
    const space = RW - discardButton().w - 3;
    const lw = measure('손') + 6;
    const label = lw + itemsW(2) <= space;
    const x0 = label ? RX + lw : RX;
    const step = 15 + (label || itemsW(2) <= space ? 2 : 1);
    return { label, tactics: tactics.map((i, k) => ({ i, x: x0 + k * step })), rb: rb ? x0 + tactics.length * step : null };
  }
  // 손 카드 i의 자리(n장일 때). 희생 연출(흩어지는 카드)도 같은 셈을 쓴다
  handRect(i, n, lay = this.rightLayout(this.run)) {
    n = Math.max(1, n);
    const w = Math.min(26, Math.floor((RW - (n - 1) * 3) / n));
    const gap = n > 1 ? Math.floor((RW - w * n) / (n - 1)) : 0;
    return { x: RX + i * (w + Math.min(gap, 4)), y: lay.handY, w, h: lay.HAND_H };
  }
  drawRight(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    pauseButton(ctx, ui, app);
    const lay = this.rightLayout(run);
    if (run) {
      // 이름표 줄: 「격언 5/5」와 정석 표(멈춤 단추 왼쪽에 붙여). 이름표가 길면(영어) 표에 닿기 전에 줄인다. 명국 조각은 상금 줄
      // 「행마」 단추(행마 보기)는 정석 표 왼쪽
      const nj = (run.josekis || []).length;
      const bx = PAUSE.x - 4 - nj * 12;
      // 이름표는 단추 왼쪽에 들어가는 만큼: 「격언 5/5」 → 「5/5」 → 없음(영어 · 정석 셋)
      const mw = measure('행마', true) + 6, mx = bx - 4 - mw;
      const room = mx - RX - 4, full = `격언 ${maximCount(run)}/${maximCapacity(run)}`, count = `${maximCount(run)}/${maximCapacity(run)}`;
      const label = measure(full) <= room ? full : measure(count) <= room ? count : null;
      if (label) text(ctx, label, RX, 8, PAL.dim);
      // 손가락 구역(CHM-52): 위로는 캔버스 밖 여백까지, 아래로는 본 칸 윗변(TOP) 앞까지, 옆으로는 이름표 쪽(정석 표 · 멈춤은 오른쪽)
      button(ctx, ui, 'btn:moves', mx, 2, mw, BTN_S, '행마', { onClick: () => this.openMoves(), grow: { l: Math.max(0, mx - RX - 4), u: Infinity, d: Math.max(0, TOP - 1 - 2 - BTN_S) } });
      josekiBadges(ctx, ui, run, bx, 9);
      const off = b.mods.filter((s) => s.off && s.uid != null).map((s) => s.uid);
      maximColumn(ctx, ui, run, RX, TOP, RW, lay.room, { offUids: off });
      // 시너지: 칩 줄 lay.rows개(격언 칸이 다섯이면 한 줄), 못 놓은 것은 「+N」
      familyStrip(ctx, ui, run, RX, lay.stripY, RW, { time: this.app.time, max: 4, glyph: false, rows: lay.rows });
    }
    this.drawPreviewPanel(ctx);
    // 손
    const ry = lay.rowY;
    const row = this.handRowLayout();
    if (row.label) text(ctx, '손', RX, inkY(ry, BTN_S), PAL.dim);
    this.drawTactics(ctx, ui, ry, row);
    const db = discardButton();
    // 손가락 구역(CHM-52): 위로 시너지 띠까지의 틈(GAP_GROUP − 1), 다시 놓기는 옆으로 「손」 글자 · 희생 단추 앞 틈까지
    const upRoom = GAP_GROUP - 1;
    if (row.rb != null) {
      const left = row.tactics.length ? 1 : Math.max(0, row.rb - RX), right = Math.max(0, RX + RW - db.w - (row.rb + 15) - 1);
      button(ctx, ui, 'btn:reboard', row.rb, ry, 15, BTN_S, '', { onClick: () => this.reboard(), icon: reboardIcon, tip: () => tipLines('다시 놓기', []), grow: { l: left, r: right, u: upRoom } });
    }
    const live = this.live();
    const canDiscard = !this.busy && live && live.status === 'play' && this.sel.length > 0 && live.discardsLeft > 0 && live.bag.length > 0;
    button(ctx, ui, 'btn:discard', RX + RW - db.w, ry, db.w, BTN_S, '희생', { enabled: !!canDiscard, onClick: () => this.discard(), icon: db.icon ? discardIcon : null, tone: canDiscard ? 'red' : 'plain', grow: { u: upRoom } });
    const drawn = v.drawn || [], hiding = v.hiding || [], deal = this.dealIn;
    v.hand.forEach((p, i) => {
      const hr = this.handRect(i, v.hand.length, lay);
      const w = hr.w, x = hr.x, id = `hand:${i}`;
      if (hiding.includes(i)) return; // 바친 카드: 흩어지는 동안 자리만 남는다
      // 희생으로 새로 뽑은 카드는 아래에서 올라온다(0.18초)
      const dk = deal && deal.ids.includes(p.id) && !app.reducedMotion ? Math.min(1, (app.time - deal.t) / 0.18) : 1;
      const y = hr.y + Math.round((1 - ease.out(dk)) * 10);
      const selected = this.sel.includes(i);
      ui.region(id, x, y - 4, w, lay.HAND_H + 4, { onClick: () => this.toggle(i), tip: () => pieceTip(p) });
      const hov = ui.isHover(id);
      const usable = live && live.status === 'play' && !this.busy;
      // 한동안 아무것도 들지 않으면 손이 차례로 살짝 들썩인다(누를 곳이 손이라는 것을 글 없이)
      const nudge = usable && !this.sel.length && this.idleT > 2.5 && Math.floor(app.time * 3) % v.hand.length === i ? 2 : 0;
      // 들림(sway.js): 가리키면 들리고, 누르면 가라앉는다
      const pressed = hov && ui.press && ui.press.id === id;
      sway(ctx, app.time, `hand:${i}:${p.id ?? p.t}`, x, y - (selected ? 4 : nudge), w, lay.HAND_H, (c) => {
        const level = chartLevel(run, p.t), lift = selected ? 4 : nudge;
        pieceCard(c, p, x, y, w, lay.HAND_H, { lift, selected, hover: hov || nudge > 0, dim: !usable, tier: tierOf(level), level, time: app.time + i, alpha: dk < 1 ? dk : 1 });
        // !? 흥미로운 수: 희생으로 새로 뽑은 기물(이것으로 시작한 다음 사슬이 체크메이트면 탁월수). 기보 표가 있으면 왼쪽 위
        if (drawn.includes(p.id)) { const r = handTagRect(x, y - lift, w, level); drawAnnot(c, '!?', r.x, r.y, ANNOT.red); }
      }, { hover: hov && usable, press: pressed });
    });
  }

  drawOver(ctx) {
    if (this.banner) {
      const bn = this.banner;
      const a = Math.min(1, bn.t * 6, (bn.life - bn.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      const { row, TW, mBig, subs, bh, by } = this.bannerBox();
      rect(ctx, BX - 6, by, S * 8 + 12, bh, PAL.shadow);
      ctx.globalAlpha = Math.max(0, a);
      if (bn.master) {
        // 초상이 오른쪽에서 미끄러져 들어온다(64×64)
        const k = Math.min(1, bn.t / 0.35);
        const px = BX + 150 + (1 - k * k * (3 - 2 * k)) * 90;
        fine(() => drawPortrait(ctx, bn.master, px, by + 6, 2));
        rect(ctx, BX - 6, by, S * 8 + 12, 1, PAL.red); rect(ctx, BX - 6, by + bh - 1, S * 8 + 12, 1, PAL.red);
        text(ctx, bn.title, BX + 4, mBig ? by + PAD_BOX : by + PAD_BOX + LINE - 7, bn.col, { bold: true, scale: mBig ? 2 : 1 });
        subs.forEach((l, i) => text(ctx, l, BX + 4, by + PAD_BOX + LINE * 2 + GAP_GROUP + i * LINE, PAL.ink));
      } else {
        text(ctx, bn.title, BX + 112, by + 6, bn.col, { align: 'center', bold: true, scale: 2 });
        text(ctx, bn.sub, BX + 112, by + 30, PAL.ink, { align: 'center' });
      }
      if (bn.news) this.drawNews(ctx, bn.news, by + bh - row - 2);
      ctx.globalAlpha = 1;
    }
    if (this.stamp) {
      const st = this.stamp;
      const k = st.t / st.life;
      const sc = k < 0.08 ? 7 : 5;
      const col = st.col || `hsl(${Math.floor(this.app.time * 400) % 360},90%,65%)`;
      const fade = k > 0.75 ? (1 - k) / 0.25 : 1;
      // 사슬 평가(★ · ★★ · ★★★ · ∞) 뒤 빛: 찍히는 순간 가장 밝다. 별은 도트 그림(stars.js), ∞는 글자
      const n = starCount(st.mark), px = sc - 1;
      const mw = n ? starsW(n, px) : measure(st.mark, true) * sc, mh = n ? STAR_N * px : 11 * sc;
      glowText(ctx, BX + 200 - mw, BY + 4, mw, mh, st.col || PAL.goldHi, fade * (k < 0.15 ? 0.9 : 0.55), 14);
      // 하양 ★은 어두운 테 한 도트 — 1배에서 가장 밝은 빛 번짐에 묻혔다(CHM-48)
      if (n) drawStars(ctx, n, BX + 200 - mw, BY + 4, col, { px, shadow: PAL.shadow, alpha: fade, ring: st.col === PAL.white ? PAL.shadow : null });
      else text(ctx, st.mark, BX + 200, BY + 4, col, { align: 'right', bold: true, scale: sc, shadow: PAL.shadow, alpha: fade });
    }
  }

  // 띠 아래 「새로」 한 줄: 판에서 보이는 그대로의 작은 그림(적은 검은 기물, 금빛 적은 금빛, 특성은 발밑 문양)
  drawNews(ctx, news, y) {
    const step = 22, lw = measure('새로') + 6;
    const x0 = Math.round(BX + 112 - (lw + news.length * step - 4) / 2);
    text(ctx, '새로', x0, y + 7, PAL.gold, { bold: true });
    news.forEach((it, k) => {
      const x = x0 + lw + k * step;
      if (it.obj) { this.newsObj(ctx, it.obj, x, y + 3); return; }
      sprite(ctx, it.t, it.gold ? 'g' : 'b', x, y);
      if (it.trait) traitMark(ctx, it.trait, x - 2, y + 17);
      if (it.muted) torchMark(ctx, x + 12, y, this.app.time);
    });
  }
  // 판 위 사물의 작은 그림(18×18): 발판 · 문 · 고속도로 줄
  newsObj(ctx, obj, x, y) {
    if (obj === 'step') {
      ctx.globalAlpha = 0.6; rect(ctx, x, y, 18, 18, PAL.gold); ctx.globalAlpha = 1;
      frame(ctx, x, y, 18, 18, PAL.goldDk);
      for (const [i, j] of [[1, 1], [16, 1], [1, 16], [16, 16]]) rect(ctx, x + i, y + j, 1, 1, PAL.goldHi);
    } else if (obj === 'gate') {
      gateArch(ctx, x, y, 18, 0.5);
    } else if (obj === 'trap') {
      trapPit(ctx, x, y, 18);
    } else if (obj === 'river') {
      for (let k = 0; k < 18; k++) { const w = Math.round(Math.sin(k / 3)); rect(ctx, x + k, y + 8 + w, 1, 1, '#6fa8d8'); rect(ctx, x + k, y + 11 + w, 1, 1, '#c8e0f0'); }
    } else if (obj === 'highway') {
      for (let j = 0; j < 18; j += 4) { rect(ctx, x + 4, y + j, 1, 2, PAL.goldDk); rect(ctx, x + 13, y + j, 1, 2, PAL.goldDk); }
      rect(ctx, x + 8, y + 4, 2, 10, PAL.gold); rect(ctx, x + 7, y + 5, 4, 1, PAL.gold); rect(ctx, x + 7, y + 12, 4, 1, PAL.gold);
    }
  }

  key(k) {
    const b = this.live();
    this.idleT = 0;
    if (k === 'Escape') {
      if (this.sel.length) { this.sel = []; this.targets = null; return; }
      this.app.openOverlay('pause');
      return;
    }
    if (this.busy) { this.fast = true; return; }
    if (/^[1-5]$/.test(k)) this.toggle(Number(k) - 1);
    else if (k === ' ') this.discard();
    else if (/^Arrow/.test(k)) {
      // 화살표: 누를 수 있는 칸(먹을 적 · 떨굴 칸)을 차례로 겨눈다(미리 보기가 따라온다)
      const t = this.clickable();
      if (t.list.length) this.kbIdx = (this.kbIdx ?? -1) + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1);
    } else if (k === 'Enter' && b) {
      const t = this.clickable();
      if (this.kbIdx != null && t.list.length) this.clickSq(t.list[((this.kbIdx % t.list.length) + t.list.length) % t.list.length]);
      else if (b.status === 'chain' && t.list.length === 1) this.clickSq(t.list[0]);
    }
  }
}
