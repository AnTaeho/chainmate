// 대국 화면(mockup 배치). 가운데 8×8 판, 왼쪽 판(관 · 목표 · 점수 · 값 × 배수 · 사슬 모습 줄 · 수 · 바꾸기 · 상금 · 주머니),
// 오른쪽(격언 칸 · 손).
// 규칙은 명령으로만 진행하고, 돌아온 사건을 차례로 연출(Seq)하는 동안 화면은 「보이는 판」(view)을 그린다.
import { hint } from '../coach.js';
import { PIECES } from '../../data/pieces.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, dots, line, sprite, num, digits, measure } from '../../render/gfx.js';
import { spriteChips, spriteCanvas, outlineCanvas, TONE, tierOf } from '../../render/sprites.js';
import { boardCanvas, boardFrameCanvas } from '../../render/texture.js';
import { dropSquaresFor, visibleIncoming, isHidden, overflowTier } from '../../sim/battle.js';
import { chainCaptures, chainRedrops } from '../../sim/chain.js';
import { reach, SLIDERS, LEAPERS } from '../../sim/board.js';
import { FAIRIES, chartForm, isFairy } from '../../data/pieces.js';
import { FAMILY_BY_ID } from '../../data/families.js';
import { familyStrip, josekiBadges, traitMark } from '../parts-depth.js';
import { TRAIT_BY_ID } from '../../data/traits.js';
import { JOSEKI_BY_ID } from '../../data/josekis.js';
import { L } from '../lang.js';
import { previewCapture, previewDrop } from '../../sim/solver.js';
import { REWARD, ANTES, maximCapacity, maximCount } from '../../sim/run.js';
import { MASTER_BY_ID } from '../../data/masters.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { Seq, ease, lerp } from '../anim.js';
import { button } from '../ui.js';
import { maximColumn, pieceCard, pieceTip, moveTip, discardIcon, panel, tipLines, fragmentStrip, itemTip, tacticIcon } from '../parts.js';
import { KIND_SHORT, PIECE_NAME, PIECE_MOVE, FAIRY_MOVE, PART_NAME, josa } from '../words.js';
import { pauseButton } from './common.js';
import { drawPortrait } from '../../render/portraits.js';
import { wrap } from '../../render/text.js';

export const S = 28, BX = 128, BY = 30; // 판 위에 목표 막대 자리를 두려고 mockup(23)보다 7px 내렸다
export const sqXY = (sq) => ({ x: BX + (sq & 7) * S, y: BY + (7 - (sq >> 3)) * S });
export const LX = 8, LW = 112, RX = 360, RW = 112;
const clone = (x) => JSON.parse(JSON.stringify(x));

// 값 · 배수 상자에 들어가는 짧은 숫자
export function short(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 10 && n % 1) return n.toFixed(1);
  if (a < 100 && n % 1) return n.toFixed(1);
  if (a < 10000) return Math.floor(n).toLocaleString('en-US');
  const units = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K']];
  for (const [u, s] of units) if (a >= u) { const v = n / u; return (v < 100 ? v.toFixed(1) : Math.floor(v)) + s; }
  return String(Math.floor(n));
}
// 빗금(노림수 · 끊김): 붉은색을 못 가려도 무늬로 알아보게
function hatch(ctx, x, y, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < S * 2; i += 5) for (let j = 0; j < S; j++) { const k = i - j; if (k >= 0 && k < S) ctx.fillRect(x + k, y + j, 1, 1); }
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
// 칸 말풍선을 그 칸 바로 아래(넘치면 위)에: 옆 칸의 미리 보기와 오른쪽 패널을 덜 가리게
// diag: 적 기물의 행마 그림(적 폰은 아래로 먹는다)
function sqTip(x, y, title, body, w = 130, diag = null) {
  const tip = diag ? moveTip(title, diag, body, { dir: -1 }) : tipLines(title, body, w);
  w = tip.w;
  const h = 10 + 14 + Math.max(tip.lines.length * 13, diag ? 35 : 0);
  const ty = y + S + 2 + h > 268 ? y - h - 2 : y + S + 2;
  return { tip, tipAt: { x: x + S / 2 - w / 2, y: ty } };
}
// 칸 위의 판 사물(정석이 까는 것): [이름, 풀이]. 풀이는 정석 글 그대로(「언제 → 무엇」)
export function objectsAt(rules, sq) {
  const out = [];
  if (!rules) return out;
  if ((rules.steps || []).includes(sq)) out.push(['발판', JOSEKI_BY_ID.stepping.text]);
  if ((rules.gates || []).includes(sq)) out.push(['문', JOSEKI_BY_ID.gates.text]);
  if ((rules.highways || []).includes(sq & 7)) out.push(['고속도로', JOSEKI_BY_ID.highway.text]);
  return out;
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
  if (!LEAPERS.has(form) || (isLine(from, to) && form !== 'G')) return { x: lerp(a.x, c.x, p), y: lerp(a.y, c.y, p) };
  // 나이트 L자가 아닌 도약(낙타 · 야간기사 · 메뚜기)은 한 번의 높은 포물선
  const ddf = Math.abs((to & 7) - (from & 7)), ddr = Math.abs((to >> 3) - (from >> 3));
  if (!((ddf === 1 && ddr === 2) || (ddf === 2 && ddr === 1))) { const q = ease.inOut(p); return { x: lerp(a.x, c.x, q), y: lerp(a.y, c.y, q) - Math.sin(p * Math.PI) * 14 }; }
  const df = (to & 7) - (from & 7);
  const mid = Math.abs(df) === 2 ? { x: c.x, y: a.y } : { x: a.x, y: c.y };
  const q = ease.inOut(p);
  const k = q < 2 / 3 ? q * 1.5 : (q - 2 / 3) * 3;
  const pt = q < 2 / 3 ? { x: lerp(a.x, mid.x, k), y: lerp(a.y, mid.y, k) } : { x: lerp(mid.x, c.x, k), y: lerp(mid.y, c.y, k) };
  return { x: pt.x, y: pt.y - Math.sin(p * Math.PI) * 9 };
}
const bagTip = (b) => {
  const counts = {};
  for (const p of b.bag) counts[p.t] = (counts[p.t] || 0) + 1;
  const parts = ['P', 'N', 'B', 'R', 'Q', ...FAIRIES].filter((t) => counts[t]).map((t) => `${PIECE_NAME[t]} ${counts[t]}`);
  return tipLines('주머니', parts.length ? parts.join(' · ') : '비었다');
};

// 대국이 어디서 오나: 판(런)의 대국(기본) · 첫 수업 · 타이틀 시연. 화면은 같은 규칙 · 같은 연출을 쓴다.
//   live()   지금 둘 수 있는 대국(끝나 판에서 빠졌으면 null)
//   cmd(c)   명령 하나 → 사건 배열
//   run      판(런) 상태(없으면 상금 · 격언 칸 · 막간을 그리지 않는다)
export const runSource = (app) => ({ kind: 'run', live: () => app.run.battle, cmd: (c) => app.cmd(c), get run() { return app.run; } });

export class BattleScreen {
  constructor(app, { events = [], source = null, quiet = false, fx = null } = {}) {
    this.app = app;
    this.src = source || runSource(app);
    this.quiet = quiet;            // 소리 · 흔들림 · 알림 없음(타이틀 시연)
    this.fx = fx || app.fx;
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
    this.boardRect = { x: BX - 6, y: BY - 6, w: S * 8 + 12, h: S * 8 + 12 }; // 처음 안내가 비켜 설 판 자리(테두리 포함)
    this.sync();
    const info = events.find((e) => e.type === 'battleStart');
    const b = this.bRef;
    const m = b.mods.find((s) => MASTER_BY_ID[s.id]);
    if (m) { this.banner = { title: `명인 ${MASTER_BY_ID[m.id].name}`, sub: MASTER_BY_ID[m.id].text, t: 0, life: 2.6, col: PAL.red, master: m.id }; this.snd('start'); }
    else if (info && this.run) this.banner = { title: `${this.run.ante}관 · ${KIND_SHORT[b.kind]} 대국`, sub: `목표 ${num(b.target)}`, t: 0, life: 1.4, col: PAL.gold };
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
    const fresh = [...found].filter(([k]) => !seen.includes(k));
    if (!run.scratch) { rec.runNew = { seed: run.seed, keys: [...seen, ...fresh.map(([k]) => k)] }; this.app.saveRecords(); }
    return fresh.slice(0, 8).map(([, it]) => it);
  }

  // 판 한가운데 뜨는 큰 글자는 대국 화면과 함께 사라진다(보상 화면 글자를 덮지 않게)
  onLeave() { this.fx.list = this.fx.list.filter((e) => !e.word); }
  get run() { return this.src.run; }
  live() { return this.src.live(); }
  get b() { return this.live() || this.bRef; }
  snd(name, arg) { if (!this.quiet) this.app.sfx(name, arg); }
  shake(px, dur) { if (!this.quiet) this.app.shake(px, dur); }
  hitstop(sec) { if (!this.quiet) this.app.hitstop(sec); }
  toast(msg, col, dur) { if (!this.quiet) this.app.toast(msg, col, dur); }
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
    v.mover = null; v.arrow = null; v.flip = null; v.dropIn = null; v.cut = null; v.gather = null; v.count = null; v.lift = null;
    const c = b.chain;
    if (c && !c.done) {
      v.chain = {
        sq: c.sq, form: c.form, value: c.value, mult: c.mult,
        steps: [...c.captures.map((x) => x.form), c.form],
        path: [c.dropSq, ...c.captures.filter((x) => !x.stay).map((x) => x.to)],
        shots: c.captures.filter((x) => x.stay).map((x) => [x.from, x.to]),
        forced: c.forced ? c.forced.slice() : null, awaiting: c.awaiting ? chainRedrops(b) : null,
        cut: false, eng: c.engraving ? c.engraving.id : null, soul: c.soul ? c.soul.id.replace('soul:', '') : null, absorbed: c.absorbed ? c.absorbed.slice() : null,
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
  // 첫 수업이 누를 곳을 좁힌다(평소 대국은 그대로)
  filterTargets(t) { return t; }
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
    this.sel = this.sel.includes(i) ? this.sel.filter((x) => x !== i) : [...this.sel, i].sort((x, y) => x - y);
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

  send(cmd) {
    const bRef = this.live();
    this.bRef = bRef;
    const v = this.view;
    const run = this.run;
    if (cmd.type === 'drop') this.slow = this.src.kind === 'lesson' || (!!run && !run.log.some((x) => !x.skipped) && bRef.history.length < 3);
    if (cmd.type === 'drop') { const hp = bRef.hand[cmd.handIndex]; this.dropEng = hp && hp.eng ? hp.eng.id : null; this.dropSoul = hp && hp.soul ? hp.soul : null; }
    if (cmd.type === 'drop' && run) this.rec = { board: clone(bRef.board), drop: { sq: cmd.sq, piece: bRef.hand[cmd.handIndex].t }, caps: [], ante: run.ante };
    const events = this.src.cmd(cmd);
    if (run) this.record(events, run);
    const post = clone(bRef.board);
    for (const e of events) if (e.type === 'reinforce') post[e.sq] = null;
    if (cmd.type === 'drop') v.hand.splice(cmd.handIndex, 1);
    this.targets = null;
    this.play(events, post, cmd);
  }

  // 이번 판 최고 한 수를 다시 보기용으로 남긴다(결과 화면이 작은 판에 다시 둔다)
  record(events, run) {
    const r = this.rec;
    if (!r) return;
    for (const e of events) {
      if (e.type === 'capture') r.caps.push({ from: e.from, to: e.to, piece: e.piece, form: e.form, after: e.form });
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
    let label = '';
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
            v.chain = { sq: e.sq, form: e.piece, value: 0, mult: 0, steps: [e.piece], path: [e.sq], forced: null, awaiting: null, cut: false, eng: this.dropEng || null, soul: this.dropSoul || null };
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
        case 'capture': add(moveDur(v.chain ? v.chain.form : 'N', e.from, e.to, e.stay), {
          begin: () => {
            const c = v.chain;
            if (e.stay) { v.arrow = { from: e.from, to: e.to, p: 0 }; c.forced = null; return; }
            v.board[e.from] = null;
            v.mover = { from: e.from, to: e.to, form: c.form, p: 0 };
            c.forced = null;
          },
          tick: (p) => { if (v.arrow) v.arrow.p = p; else v.mover.p = LEAPERS.has(v.mover.form) ? p : ease.out(p); },
          done: () => {
            const c = v.chain;
            const victim = v.board[e.to];
            // 궁수 모습: 제자리에서 쏜다(판 위 기물은 그대로, 먹힌 칸만 빈다)
            if (e.stay) { v.board[e.to] = null; v.arrow = null; (c.shots || (c.shots = [])).push([e.from, e.to]); c.steps.push(c.form); }
            else { v.board[e.to] = { t: c.form, mine: true }; v.mover = null; c.sq = e.to; c.path.push(e.to); c.steps.push(c.form); }
            c.value += e.value; c.mult += 1;
            this.shatter(e.to, victim ? victim.t : e.piece, victim && victim.gold ? 'g' : 'b');
            this.flash(e.to, PAL.white);
            this.pop(`+${e.value}`, 'value');
            this.snd('capture', c.path.length - 1);
            this.shake(1, 0.08);
          },
        }); break;
        case 'golden': add(0.12, { begin: () => { this.burst(e.sq, PAL.gold, 20); this.dust(e.sq, 26); this.snd('golden'); this.shake(1, 0.1); } }); break;
        case 'scoreGroup': add(0.05 + 0.03 * Math.min(3, e.list.length), {
          begin: () => {
            const c = v.chain;
            if (!c) return;
            let dv = 0, dm = 0, xm = 1;
            for (const x of e.list) {
              if (x.value) { c.value += x.value; dv += x.value; }
              if (x.mult) { c.mult += x.mult; dm += x.mult; }
              if (x.xmult) { c.mult *= x.xmult; xm *= x.xmult; }
            }
            if (dv) this.pop(`+${short(dv)}`, 'value');
            if (dm) this.pop(`+${short(dm)}`, 'mult');
            if (xm !== 1) this.pop(`×${Number(xm.toFixed(2))}`, 'mult', dm ? 10 : 0);
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
          done: () => { v.lift = null; this.sparkle(e.sq, PAL.gold, 12); this.word('승급', PAL.gold); },
        }); break;
        case 'grade': add(0.2, { begin: () => this.gradeStamp(e) }); break;
        case 'forced': add(0.1, { begin: () => { if (v.chain) v.chain.forced = e.attackers.slice(); this.snd('forced'); } }); break;
        case 'cutIgnored': add(0.2, { begin: () => { this.sparkle(e.sq, PAL.silver, 10); this.word('넘겼다', PAL.silver); } }); break;
        // 가족(깊이 B): 도약 뒤 노림 무시 · 직선 꿰뚫기 · 변신 한 번 더
        case 'threatIgnored': add(0.15, { begin: () => { this.sparkle(e.sq, PAL.silver, 10); this.word('지키는 적을 피했다', PAL.silver); } }); break;
        case 'pierce': add(0.12, { begin: () => {
          const vic = v.board[e.sq]; v.board[e.sq] = null; this.shatter(e.sq, vic ? vic.t : e.piece, vic && vic.gold ? 'g' : 'b');
          const bomb = e.src === 'bomb', col = bomb ? PAL.red : e.src && e.src.includes('martyr') ? PAL.red : FAMILY_BY_ID.line.col;
          this.flash(e.sq, col); this.word(bomb ? '폭발' : e.src && e.src.includes('martyr') ? '순교' : '꿰뚫었다', col); this.snd(bomb ? 'cut' : 'capture', 2); if (bomb) this.shake(2, 0.12);
        } }); break;
        case 'mirrored': add(0.1, { begin: () => { this.sparkle(e.sq, '#9fd3e0', 8); this.word('거울', '#9fd3e0'); } }); break;
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
        case 'mate': add(0.5, {
          begin: () => { this.topple(e.sq); this.word('외통', PAL.gold, 1.6, 4); this.snd('mate'); this.hitstop(0.25); this.shake(3, 0.3); },
        }); break;
        case 'refill': add(0.35, {
          begin: () => { this.word('판이 다시 채워진다', PAL.gold, 1.1, 1); this.snd('refill'); },
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
        case 'discard': add(0.22, {
          begin: () => { this.snd('discard'); },
          done: () => { const b = this.bRef; v.hand = clone(b.hand); v.discardsLeft = b.discardsLeft; v.bag = b.bag.length; },
        }); break;
        case 'win': if (this.src.kind === 'lesson') break; add(0.25, { begin: () => { this.word('대국 승리', PAL.gold, 1.2, 2); this.snd('win'); } }); break;
        case 'lose': if (this.src.kind === 'lesson') break; add(0.6, { begin: () => { this.word(e.reason === 'stuck' ? '떨굴 곳이 없다' : '수가 다했다', PAL.red, 1.4, 1); this.snd('lose'); } }); break;
        case 'fragment': add(0.05, { begin: () => { this.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6); this.snd('fragment'); this.app.flyShard(BX + 112, BY + 112, RX + RW - 30, 10); } }); this.runEvents.push(e); break;
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
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push({ x: LX + 56, y: 109, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50 }); }
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
        if (this.run && e.score > 0 && app.noteMove(e.score, this.lastEnd.steps) && app.records.runs + app.records.wins > 0) this.toast('최고 한 수', PAL.gold);
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
    for (const e of ev) if (e.type === 'legend') list.push(['legend', { legend: e.legend }]);
    app.flow(list);
  }

  // ── 효과
  center(sq) { const p = sqXY(sq); return { x: p.x + 14, y: p.y + 14 }; }
  // 내 기물의 모습: 떨군 기물의 각인 톤 + 지금 모습의 기보 단계
  look(form, time = null) {
    const run = this.run, v = this.view;
    return { eng: v.chain ? v.chain.eng || null : null, soul: v.chain ? v.chain.soul || null : null, tier: run ? tierOf(run.charts[chartForm(form)]) : 0, time };
  }
  shatter(sq, type, side) {
    const { x, y } = sqXY(sq);
    const chips = spriteChips(type, side);
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
  pop(s, where, dy = 0) {
    if (this.boardOnly) return;
    const pos = where === 'value' ? { x: LX + 24, y: 96 - dy } : where === 'mult' ? { x: LX + 88, y: 96 - dy } : { x: LX + LW - 20, y: 210 };
    const col = where === 'value' ? PAL.val : where === 'mult' ? PAL.gold : PAL.gold;
    this.fx.add({ life: 0.6, layer: 1, draw: (ctx, e) => { const k = e.t / e.life; text(ctx, s, pos.x, pos.y - 6 - k * 10, col, { align: 'center', bold: true, alpha: 1 - k * k, shadow: PAL.shadow }); } });
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
        ctx.drawImage(spriteCanvas('K', 'b'), -14, -21);
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
      this.flames.push({ x: LX + 4 + Math.random() * (LW - 8), y: 70, vy: -(18 + Math.random() * (14 + tier * 3)), t: 0, life: 0.4 + r * 0.5, tier });
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
    const cols = { '!': PAL.white, '!!': PAL.gold, '!!!': PAL.red, '∞': null };
    this.stamp = { mark: e.mark, t: 0, life: 1.1, col: cols[e.mark] };
    this.glow = { mark: e.mark, fade: 0 };
    this.snd('grade', e.mark);
    this.shake({ '!': 1, '!!': 2, '!!!': 3, '∞': 4 }[e.mark] || 1, 0.25);
  }

  pointerDown() { this.idleT = 0; }
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

  // 목표는 막대로: 지금 점수는 채움, 이번 사슬로 얻을 몫(값 × 배수)은 빗금으로 미리 차오른다.
  // 목표를 넘기면 막대가 ×2 · ×5 · ×10 눈금으로 늘어나고 채움 끝에 불이 붙는다.
  drawGoalBar(ctx) {
    const v = this.view, tgt = v.target;
    if (!tgt || this.boardOnly) return;
    const time = this.app.time;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const live = v.chain && !v.gather ? Math.floor(v.chain.value * v.chain.mult) : v.gather && !v.count ? v.gather.score : 0;
    const total = score + live;
    const maxMul = total <= tgt ? 1 : total <= 2 * tgt ? 2 : total <= 5 * tgt ? 5 : 10;
    const maxV = tgt * maxMul;
    const X = BX, Y = 15, Wd = S * 8, Hh = 7;
    if (this.src.kind !== 'demo') this.app.ui.region('goal', X - 1, Y - 3, Wd + 2, Hh + 6, { tip: () => tipLines(`목표 ${num(tgt)}`, '점수가 이 막대 끝에 닿으면 대국을 이긴다 — 넘기면 ×2 · ×5 · ×10 눈금으로 늘어난다') });
    box(ctx, X - 1, Y - 1, Wd + 2, Hh + 2, PAL.feltDk, PAL.frameDk);
    const fill = Math.round(Wd * Math.min(1, score / maxV));
    const hot = score >= tgt;
    rect(ctx, X, Y, fill, Hh, hot ? PAL.gold : PAL.goldDk);
    if (fill > 1) rect(ctx, X, Y, fill, 1, PAL.goldHi);
    const gw = Math.round(Wd * Math.min(1, total / maxV)) - fill;
    if (gw > 0) {
      ctx.fillStyle = PAL.gold;
      for (let i = 0; i < gw; i++) for (let j = 0; j < Hh; j++) if ((i + j + Math.floor(time * 8)) % 3 === 0) ctx.fillRect(X + fill + i, Y + j, 1, 1);
      if (!this.hideGain) text(ctx, `+${num(live)}`, Math.max(X + 16, Math.min(X + Wd - 20, X + fill + gw / 2)), 2, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    }
    // 눈금: 목표(×1)는 흰 막대, 넘친 층은 작은 숫자
    for (const m of [1, 2, 5, 10]) {
      if (m > maxMul) break;
      const tx = X + Math.round((Wd * m) / maxV * tgt) - 1;
      rect(ctx, tx, Y - 3, 2, Hh + 6, m === 1 ? PAL.white : PAL.red);
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

  drawBoard(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, time = app.time;
    this.drawGoalBar(ctx);
    ctx.drawImage(boardFrameCanvas(S), BX - 6, BY - 6);
    // 사슬 평가의 테두리 불빛: 흰 → 금 → 붉은 금 → 무지개. 사슬이 끝나면 사그라든다
    if (this.glow) {
      const g = this.glow;
      const a = Math.max(0, 1 - g.fade / 0.6) * (0.75 + 0.25 * Math.sin(time * 10));
      const hue = Math.floor(time * 360) % 360;
      const cols = { '!': [PAL.white], '!!': [PAL.gold, PAL.goldHi], '!!!': [PAL.red, PAL.gold, PAL.red], '∞': [`hsl(${hue},85%,60%)`, `hsl(${(hue + 90) % 360},85%,60%)`, `hsl(${(hue + 180) % 360},85%,60%)`] }[g.mark];
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
      // 판 위 사물(발판 · 문 · 고속도로 줄): 칸 자체가 스스로 풀이한다. 적이 서 있으면 그 풀이 아래에 한 줄 더
      const objs = isHidden(b, sq) ? [] : objectsAt(b.rules, sq);
      if (objs.length) tip = tip ? [tip[0], [...tip[1], ...objs.map((o) => o[1])]] : [objs.map((o) => o[0]).join(' · '), objs.map((o) => o[1])];
      const tipOpt = tip ? sqTip(x, y, tip[0], tip[1], 130, diag) : null;
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
    // 증원 그림자: 점선 테 안에 빈 윤곽(속이 비어 판 위의 적과 섞이지 않는다)과 흔들리는 ▼. 두 수 앞은 윤곽도 점선
    for (const [sq, g] of ghosts) {
      const { x, y } = sqXY(sq);
      dots(ctx, x, y, S, S, g.k ? PAL.dimDk : PAL.shadow, 2);
      ctx.drawImage(outlineCanvas(g.t, TONE.b.o, g.k > 0), x + 5, y + 5);
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
        if (v.dropIn && v.dropIn.sq === sq) dy = -Math.round((1 - v.dropIn.p) * 10);
        if (v.lift && v.lift.sq === sq) { dy = -Math.round(Math.sin(v.lift.p * Math.PI) * 8); side = 'q'; }
        let alpha = 1;
        if (v.cut && v.cut.sq === sq) alpha = 1 - v.cut.p;
        const lk = side === 'w' ? this.look(c.t, time) : {};
        this.putPiece(ctx, c.t, side, x + 6, y + 3 + dy, { sx, alpha, ...lk });
        continue;
      }
      let dy = 0;
      if (t.kind === 'capture' && tset.has(sq)) dy = Math.floor(time * 4 + sq * 0.37) % 2 ? -2 : -1;
      if (this.falls && this.falls.has(sq)) { const p = this.falls.get(sq) / FALL; dy -= Math.round((1 - p * p) * FALL_PX); }
      if (openKings && openKings.has(sq) && c.t === 'K') {
        const a = 0.5 + 0.3 * Math.sin(time * 4);
        ctx.globalAlpha = a; frame(ctx, x + 2, y + 2, S - 4, S - 4, PAL.gold); ctx.globalAlpha = 1;
      }
      if (forced && forced.has(sq)) {
        if (Math.floor(time * 6) % 2 === 0) frame(ctx, x, y, S, S, PAL.red, 2);
        ctx.globalAlpha = 0.25; rect(ctx, x, y, S, S, PAL.red); ctx.globalAlpha = 1;
        hatch(ctx, x, y, PAL.redDk);
      }
      this.putPiece(ctx, c.t, c.gold ? 'g' : 'b', x + 6, y + 3 + dy);
      if (c.trait) traitMark(ctx, c.trait, x + 2, y + S - 8);
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
      this.putPiece(ctx, v.mover.form, 'w', m.x + 6, m.y + 3, this.look(v.mover.form, time));
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
  }

  // 묘수(깊이 F): 손 이름표 옆의 작은 칸. 떨구기 전에 눌러 쓴다
  drawTactics(ctx, ui) {
    const run = this.run, live = this.live();
    if (!run) return;
    let k = 0;
    run.consumables.forEach((c, i) => {
      if (c.kind !== 'tactic') return;
      const x = RX + 16 + k * 17, y = 202;
      k++;
      const ok = !this.busy && live && live.status === 'play';
      const id = `tactic:${i}`;
      ui.region(id, x, y, 15, 15, { enabled: ok, onClick: () => this.useTactic(i), tip: () => itemTip(c) });
      box(ctx, x, y, 15, 15, '#132019', ui.isHover(id) && ok ? PAL.gold : PAL.frameDk);
      ctx.save(); ctx.translate(x + 1, y + 2); ctx.scale(0.8, 0.8); tacticIcon(ctx, c.id, 0, 0); ctx.restore();
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
    (rules.gates || []).forEach((sq, k) => {
      const { x, y } = sqXY(sq);
      const col = '#6fd1bf';
      // 아치 모양 문(두 문이 번갈아 빛난다)
      const on = 0.55 + 0.35 * Math.sin(time * 3 + k * Math.PI);
      ctx.globalAlpha = on;
      for (let j = 0; j < 20; j++) {
        const w = j < 6 ? Math.round(Math.sqrt(36 - (6 - j) * (6 - j)) * 1.4) + 4 : 12;
        rect(ctx, x + 14 - w, y + 5 + j, 1, 1, col); rect(ctx, x + 13 + w, y + 5 + j, 1, 1, col);
      }
      rect(ctx, x + 2, y + 24, S - 4, 1, col);
      ctx.globalAlpha = 1;
    });
  }

  // 판 위 기물 하나. pieceSink가 있으면 그리지 않고 모은다(타이틀이 눕힌 판 위에 세워 그린다)
  putPiece(ctx, type, side, x, y, opts = {}) {
    if (this.pieceSink) this.pieceSink.push({ type, side, x, y, opts });
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

  // 오른쪽 작은 패널: 지금 [모습] › 먹으면 [모습], 얻을 값 · 배수, 그다음
  drawPreviewPanel(ctx) {
    const pv = this.pvNow, v = this.view;
    if (!pv || pv.kind !== 'capture' || !v.chain) return;
    panel(ctx, RX, 22, RW, 88);
    text(ctx, '지금', RX + 21, 26, PAL.dim, { align: 'center' });
    text(ctx, '먹으면', RX + 77, 26, PAL.dim, { align: 'center' });
    box(ctx, RX + 8, 40, 26, 34, PAL.light, PAL.frameDk);
    sprite(ctx, v.chain.form, 'w', RX + 13, 46, this.look(v.chain.form));
    text(ctx, '›', RX + 49, 49, PAL.gold, { align: 'center', bold: true, scale: 2 });
    box(ctx, RX + 64, 40, 26, 34, pv.cut ? PAL.red : PAL.gold, PAL.frameDk);
    sprite(ctx, pv.form, 'w', RX + 69, 46, this.look(pv.form));
    text(ctx, `+${short(pv.value)}`, RX + 8, 88, PAL.val, { bold: true });
    text(ctx, `배수 +${short(pv.mult)}`, RX + RW - 8, 88, PAL.gold, { align: 'right', bold: true });
    panel(ctx, RX, 114, RW, 22);
    const [msg, col] = pv.cut ? ['끊긴다', PAL.red] : pv.mate ? ['외통', PAL.gold] : pv.redrop ? ['다시 떨군다', PAL.gold]
      : pv.done ? ['사슬이 끝난다', PAL.dim] : pv.forced ? [`지키는 적 ${pv.next.length}`, PAL.red] : [`다음에 먹을 적 ${pv.next.length}`, PAL.gold];
    text(ctx, msg, RX + 8, 119, col, { bold: true });
  }

  drawLeft(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    const master = b.mods.find((s) => MASTER_BY_ID[s.id]);
    panel(ctx, LX, 8, LW, 58);
    // 판의 대국이면 몇 관째인지 전체(8관) 중에 보인다
    const hall = run && !run.endless ? `${b.ante}/${ANTES}관` : `${b.ante}관`;
    // 영어처럼 길어지면 「관」 낱말을 빼고 숫자만(판 가장자리에 닿지 않게)
    let head = `${hall} · ${KIND_SHORT[b.kind]} 대국`;
    if (measure(head) > LW - 12) head = `${run && !run.endless ? `${b.ante}/${ANTES}` : b.ante} · ${KIND_SHORT[b.kind]} 대국`;
    text(ctx, head, LX + 6, 12, PAL.dim);
    text(ctx, '목표', LX + 6, 27, PAL.dim);
    text(ctx, num(v.target), LX + LW - 6, 27, PAL.ink, { align: 'right', bold: true });
    if (master) {
      const m = MASTER_BY_ID[master.id];
      ui.region('master', LX + 2, 40, LW - 4, 16, { tip: () => tipLines(`명인 ${m.name}`, m.text) });
      text(ctx, `명인 ${m.name}`, LX + 6, 42, PAL.red, { bold: true });
    } else text(ctx, `이기면 $${REWARD.base[b.kind]}`, LX + 6, 42, PAL.goldDk);
    // 점수(목표를 넘기면 불붙는다)
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const hot = v.target && score >= v.target;
    panel(ctx, LX, 70, LW, 24);
    if (hot) {
      const k = Math.floor(app.time * 10) % 3;
      frame(ctx, LX, 70, LW, 24, k ? PAL.gold : PAL.red);
    }
    this.drawFlames(ctx);
    text(ctx, '점수', LX + 6, 75, PAL.dim);
    text(ctx, num(score), LX + LW - 6, 75, hot ? PAL.gold : PAL.ink, { align: 'right', bold: true });
    // 값 × 배수
    const c = v.chain;
    const g = v.gather;
    const val = g ? g.value : c ? c.value : 0;
    const mul = g ? g.mult : c ? c.mult : 0;
    const gp = g ? g.p : 0;
    const dx = Math.round(gp * 32);
    if (v.count) {
      // 곱이 점수 칸으로 흘러 들어간다
      const k = v.count.p;
      const tx = lerp(LX + LW / 2, LX + LW - 30, k), ty = lerp(103, 75, k);
      text(ctx, num(v.count.to - v.count.from), tx, ty, PAL.gold, { align: 'center', bold: true, alpha: 1 - k * 0.8, shadow: PAL.shadow });
    }
    if (g && g.burst) {
      box(ctx, LX, 98, LW, 22, PAL.gold, PAL.frameDk);
      text(ctx, num(g.score), LX + LW / 2, 103, PAL.linkInk, { align: 'center', bold: true });
    } else {
      ui.region('box:value', LX, 98, 48, 22, { keys: [{ id: 'value' }] });
      ui.region('box:links', LX + 64, 98, 48, 22, { keys: [{ id: 'links' }] });
      box(ctx, LX + dx, 98, 48, 22, PAL.val, PAL.frameDk);
      text(ctx, short(val), LX + dx + 24, 103, PAL.valInk, { align: 'center', bold: true });
      if (!g) text(ctx, '×', LX + 56, 103, PAL.ink, { align: 'center', bold: true });
      box(ctx, LX + 64 - dx, 98, 48, 22, PAL.link, PAL.frameDk);
      text(ctx, short(mul), LX + 88 - dx, 103, PAL.linkInk, { align: 'center', bold: true });
    }
    // 사슬 모습 줄
    // 지나온 모습은 작게, 지금 모습은 크게(2배)
    panel(ctx, LX, 124, LW, 52);
    const steps = c ? c.steps : this.lastEnd ? this.lastEnd.steps : [];
    const a = c ? 1 : 0.45;
    const past = steps.slice(Math.max(0, steps.length - 4), -1);
    const eng = c ? c.eng : this.lastEnd ? this.lastEnd.eng : null;
    const tierAt = (tp) => (run ? tierOf(run.charts[tp]) : 0);
    past.forEach((tp, i) => sprite(ctx, tp, 'w', LX + 5 + i * 19, 148, { alpha: a, eng, tier: tierAt(tp) }));
    if (steps.length > 4) text(ctx, `+${steps.length - 4}`, LX + 5, 127, PAL.dim);
    const cur = steps[steps.length - 1];
    if (cur) {
      if (c && c.cut) { ctx.globalAlpha = 0.35; rect(ctx, LX + LW - 40, 126, 36, 48, PAL.red); ctx.globalAlpha = 1; }
      ctx.globalAlpha = a;
      ctx.drawImage(spriteCanvas(cur, 'w', eng, tierAt(cur)), LX + LW - 38, 128, 32, 44);
      ctx.globalAlpha = 1;
    }
    // 수 · 바꾸기
    panel(ctx, LX, 180, LW, 28);
    ui.region('pips:moves', LX, 180, LW, 13, { tip: () => tipLines('수', '이번 대국에 떨굴 수 있는 횟수. 다 쓰면 대국이 끝난다') });
    ui.region('pips:discards', LX, 193, LW, 15, { tip: () => tipLines('버리기', '손을 골라 버리고 새로 뽑을 수 있는 횟수') });
    text(ctx, '수', LX + 6, 181, PAL.dim);
    // 구슬은 두 이름표 중 긴 것 뒤에서(영어 「Redraw」가 붉은 구슬과 붙지 않게), 칸이 모자라면 간격을 줄인다
    const pipX = Math.max(52, Math.max(measure('수'), measure('버리기')) + 12);
    const pipN = Math.max(v.moves, v.discards, 1);
    const pipStep = Math.min(14, Math.floor((LW - 4 - pipX) / pipN));
    const pipW = Math.max(4, pipStep - 4);
    for (let i = 0; i < v.moves; i++) rect(ctx, LX + pipX + i * pipStep, 184, pipW, 7, i < v.movesLeft ? PAL.gold : PAL.frame);
    text(ctx, '버리기', LX + 6, 194, PAL.dim);
    for (let i = 0; i < v.discards; i++) rect(ctx, LX + pipX + i * pipStep, 197, pipW, 7, i < v.discardsLeft ? PAL.red : PAL.frame);
    if (run) {
      panel(ctx, LX, 212, LW, 22);
      text(ctx, '상금', LX + 6, 217, PAL.dim);
      text(ctx, `$${run.money}`, LX + LW - 6, 217, PAL.gold, { align: 'right', bold: true });
    }
    panel(ctx, LX, 240, LW, 22);
    ui.region('bag', LX, 240, LW, 22, { tip: () => bagTip(this.b) });
    text(ctx, '주머니', LX + 6, 245, PAL.dim);
    text(ctx, `${v.bag} / ${v.deckSize}`, LX + LW - 6, 245, PAL.ink, { align: 'right' });
  }

  drawRight(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    pauseButton(ctx, ui, app, RX + RW - 12, 6);
    if (run) {
      text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 8, PAL.dim);
      josekiBadges(ctx, ui, run, RX + 56, 9);
      fragmentStrip(ctx, ui, run, RX + RW - 18, 8, { align: 'right' });
      const off = b.mods.filter((s) => s.off && s.uid != null).map((s) => s.uid);
      maximColumn(ctx, ui, run, RX, 22, RW, 164, { offUids: off });
      familyStrip(ctx, ui, run, RX, 188, RW, { time: this.app.time, max: 3, glyph: false });
    }
    this.drawPreviewPanel(ctx);
    // 손
    text(ctx, '손', RX, 206, PAL.dim);
    this.drawTactics(ctx, ui);
    const live = this.live();
    const canDiscard = !this.busy && live && live.status === 'play' && this.sel.length > 0 && live.discardsLeft > 0 && live.bag.length > 0;
    button(ctx, ui, 'btn:discard', RX + RW - 62, 203, 62, 16, '버리기', { enabled: !!canDiscard, onClick: () => this.discard(), icon: discardIcon, tone: canDiscard ? 'red' : 'plain' });
    const n = Math.max(1, v.hand.length);
    const w = Math.min(26, Math.floor((RW - (n - 1) * 3) / n));
    const gap = n > 1 ? Math.floor((RW - w * n) / (n - 1)) : 0;
    v.hand.forEach((p, i) => {
      const x = RX + i * (w + Math.min(gap, 4)), y = 224;
      const id = `hand:${i}`;
      const selected = this.sel.includes(i);
      ui.region(id, x, y - 4, w, 40, { onClick: () => this.toggle(i), tip: () => pieceTip(p) });
      const hov = ui.isHover(id);
      const usable = live && live.status === 'play' && !this.busy;
      // 한동안 아무것도 들지 않으면 손이 차례로 살짝 들썩인다(누를 곳이 손이라는 것을 글 없이)
      const nudge = usable && !this.sel.length && this.idleT > 2.5 && Math.floor(app.time * 3) % v.hand.length === i ? 2 : 0;
      pieceCard(ctx, p, x, y, w, 36, { lift: selected ? 4 : hov && usable ? 1 : nudge, selected, hover: hov || nudge > 0, dim: !usable, tier: run ? tierOf(run.charts[chartForm(p.t)]) : 0, time: app.time + i });
    });
  }

  drawOver(ctx) {
    if (this.banner) {
      const bn = this.banner;
      const a = Math.min(1, bn.t * 6, (bn.life - bn.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      const row = bn.news ? 26 : 0;
      const bh = (bn.master ? 86 : 44) + row, by = BY + 106 - bh / 2;
      rect(ctx, BX - 6, by, S * 8 + 12, bh, PAL.shadow);
      ctx.globalAlpha = Math.max(0, a);
      if (bn.master) {
        // 초상이 오른쪽에서 미끄러져 들어온다(64×64)
        const k = Math.min(1, bn.t / 0.35);
        const px = Math.round(BX + 150 + (1 - k * k * (3 - 2 * k)) * 90);
        drawPortrait(ctx, bn.master, px, by + 6, 2);
        rect(ctx, BX - 6, by, S * 8 + 12, 1, PAL.red); rect(ctx, BX - 6, by + bh - 1, S * 8 + 12, 1, PAL.red);
        text(ctx, bn.title, BX + 4, by + 14, bn.col, { bold: true, scale: 2 });
        wrap(bn.sub, 140).slice(0, 3).forEach((l, i) => text(ctx, l, BX + 4, by + 42 + i * 12, PAL.ink));
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
      text(ctx, st.mark, BX + 200, BY + 4, col, { align: 'right', bold: true, scale: sc, shadow: PAL.shadow, alpha: k > 0.75 ? (1 - k) / 0.25 : 1 });
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
    });
  }
  // 판 위 사물의 작은 그림(18×18): 발판 · 문 · 고속도로 줄
  newsObj(ctx, obj, x, y) {
    if (obj === 'step') {
      ctx.globalAlpha = 0.6; rect(ctx, x, y, 18, 18, PAL.gold); ctx.globalAlpha = 1;
      frame(ctx, x, y, 18, 18, PAL.goldDk);
      for (const [i, j] of [[1, 1], [16, 1], [1, 16], [16, 16]]) rect(ctx, x + i, y + j, 1, 1, PAL.goldHi);
    } else if (obj === 'gate') {
      const col = '#6fd1bf';
      for (let j = 0; j < 16; j++) {
        const w = j < 5 ? Math.round(Math.sqrt(25 - (5 - j) * (5 - j)) * 1.2) + 2 : 8;
        rect(ctx, x + 9 - w, y + 1 + j, 1, 1, col); rect(ctx, x + 8 + w, y + 1 + j, 1, 1, col);
      }
      rect(ctx, x, y + 17, 18, 1, col);
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
