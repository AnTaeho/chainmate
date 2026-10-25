// 대국 화면(mockup 배치). 가운데 8×8 판, 왼쪽 판(관 · 목표 · 점수 · 값 × 배수 · 사슬 모습 줄 · 수 · 바꾸기 · 상금 · 덱),
// 오른쪽(격언 칸 · 손).
// 규칙은 명령으로만 진행하고, 돌아온 사건을 차례로 연출(Seq)하는 동안 화면은 「보이는 판」(view)을 그린다.
import { hint } from '../coach.js';
import { PIECES } from '../../data/pieces.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, rrect, rframe, R_BIG, radiusOf, frame, line, seg, dot, sprite, num, digits, measure, short, fitNum, fine, slot } from '../../render/gfx.js';
import { SW, SH, tierOf, ENG_EDGE } from '../../render/sprites.js';
import { center as sqCenter, centerAt, projectSq, unproject, sqBox, hitBox, picker, thingTop, THINGS, order as sqOrder, fillSq, strokeSq, clipSq, ringSq, boardPath, drawBoardImage, geo as boardGeo, PIECE_UP, RIM, DEPTH } from '../../render/board3.js';
import { piece3, fitPiece, pieceCanvas, pieceChips, scaleOf, PIECE_TOP, INK as INK3 } from '../../render/pieces3.js';
import { dropSquaresFor, visibleIncoming, isHidden, overflowTier, OVERFLOW_TIERS, canReboard, nextDraws } from '../../sim/battle.js';
import { chainCaptures, chainRedrops } from '../../sim/chain.js';
import { mateBlocked } from '../../sim/tuning.js';
import { reach, SLIDERS, LEAPERS } from '../../sim/board.js';
import { FAIRIES, chartForm, isFairy } from '../../data/pieces.js';
import { FAMILY_BY_ID, maximFamilies } from '../../data/families.js';
import { familyStrip, josekiBadges, traitMark } from '../parts-depth.js';
import { TRAIT_BY_ID } from '../../data/traits.js';
import { JOSEKI_BY_ID } from '../../data/josekis.js';
import { L } from '../lang.js';
import { previewCapture, previewDrop } from '../../sim/solver.js';
import { REWARD, ANTES, maximCapacity, maximCount } from '../../sim/run.js';
import { MASTER_BY_ID } from '../../data/masters.js';
import { FACTION_BY_ID } from '../../data/factions.js';

// 대국의 세력(버릇 조정자 faction:<id>) — 수업은 없다
export const factionOfBattle = (b) => { const s = b && b.mods && b.mods.find((x) => typeof x.id === 'string' && x.id.startsWith('faction:')); return s ? FACTION_BY_ID[s.id.slice(8)] : null; };
import { LEGEND_BY_ID } from '../../data/legends.js';
import { Seq, ease, lerp } from '../anim.js';
import { sway } from '../sway.js';
import { glow, glowText, groundShadow, flicker } from '../../render/light.js';
import { live as motion, beat } from '../../render/look.js';
import { button, tipHeight, growHit, pillR } from '../ui.js';
import { keyHeight } from '../glossary.js';
import { SIDE_W, NOTE_GAP } from '../placement.js';
import { pieceTip, moveTip, discardIcon, panel, tipLines, fitText, itemTip, tacticIcon, SEAL, chartLevel, maximCard, maximTip, edgeRing, chartBadge, soulMark, fragmentStrip } from '../parts.js';
import { KIND_NAME, KIND_SHORT, PIECE_NAME, PIECE_MOVE, FAIRY_MOVE, PART_NAME, josa } from '../words.js';
import { pauseButton, shardTo, hasClock, clockPips, clockTip, SIDE } from './common.js';
import { TOP, PAUSE, PAD_BOX, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, LIST_GAP, FAM_H, flow, textY, inkY, BTN_S, INK_H } from '../frame.js';
import { INK_DESC } from '../../render/layoutlog.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { drawPortrait } from '../../render/portraits.js';
import { wrap } from '../../render/text.js';
import { Marks, drawMarkSquares, drawMarkArrows } from '../marks.js';
import { awakenFlow } from './awaken.js';
import { SOUL_BY_ID, isCracked } from '../../data/souls.js';
import { ANNOT, drawAnnot, annotSize, handTagRect, boardTagRect, offeredRow, drawMore } from '../annot.js';
import { drawStars, starsW, starCount, STAR_N } from '../stars.js';
import { capRoute, routeAt, bendDur } from '../fxroute.js';
import { puff, chip, screenFlash, sparkBurst, confetti, flyCoins, boldText, kickMoney, stepScale, CAP, moneyShake } from '../juice.js';
import { noteStep, reviewGen, cloneBattle } from '../../sim/replay.js';
import { openCombo, drawCombo, comboLand, comboClose, emberMark } from '../ignite.js';
import { reviewOn, forkTitle, forkLine, forkScores, forkScoreLines, forkScoreRows, forkMarks, NO_PATH, THINKING } from '../review.js';

const KING_SHUT = '킹을 지키던 적을 둘 잡은 콤보로는 못 잡아요';
const NOTE_ROOM = 266; // 설명 묶음이 쓸 수 있는 높이(화면 270 - 가장자리 2 × 2, placement.js)

// 복기(CHM-59): 진 순간 프레임마다 이만큼(ms)씩 나눠 잰다. 답은 마디 예산(replay.js REVIEW.nodes)이 정하고, 이 기기에서
// REVIEW_WALL초를 넘기면(느린 기기) 카드 없이 지금 흐름대로 넘어간다(그 대국의 기록은 unknown)
export const REVIEW_SLICE_MS = 12, REVIEW_WALL = 3;

// 판 자리(bbox): BX · BY에서 S × 8 네모. 칸 자리는 투영(src/render/board3.js — 정면 판)이 정한다
export const S = 28, BX = 128, BY = 14; // 목표 막대가 왼쪽 칸으로 가서(안 3) 판을 위로 올렸다. 위 14줄은 수업 · 복기 제목 줄
export { sqCenter };
// 게임 좌표 → 판 칸(판 밖이면 -1). pick: 그린 판의 누르기(board3.js picker — 기물 몸이 그 칸), 없으면 바닥 칸만
export const sqAt = (x, y, pick = null) => { const sq = pick ? pick(x, y) : unproject(x, y); return sq == null ? -1 : sq; };
export const LX = 8, LW = 112, RX = 360, RW = 112;
// 대국이 끝난 뒤 막간 화면(afterSeq → app.flow): 날던 동전 · 명국 조각이 이어 난다
const AFTER = new Set(['reward', 'chest', 'awaken', 'legend']);
// 다음 수(CHM-60, docs/design-notes/agency.md A): 덱 맨 앞 둘을 손 부채 왼쪽 아래 작은 칸 둘에(왼쪽이 먼저, 흐리게), 위에 「다음」 이름표.
// fanX: 손 부채의 왼끝(handRect(0).x) — 그 왼쪽 틈 6에 붙인다
export const NEXT_COL = { w: 16, h: 22, gap: 3, sep: 6 };
export function nextColumn(lay, fanX = RX) {
  const { w, h, gap, sep } = NEXT_COL, cw = w * 2 + gap;
  const x = fanX - sep - cw, y = 270 - 4 - h;
  return { x, y, w: cw, h, labelY: y - LINE + 1, slots: [0, 1].map((k) => ({ x: x + k * (w + gap), y, w, h })) };
}
// 손 부채(안 3): 카드 폭 · 높이 · 걸음(겹침) · 고른 카드 들림 · 카드마다 기울기(도)
export const HAND = { w: 42, h: 48, hLesson: 40, step: 44, lift: 6, deg: 4 };
// 카드 윗변 y가 판 밑에 들어가는 가장 왼쪽 x(두께 · 기울기 몫 6을 더 둔다). 정면 판은 판 아래 띠 전체, 「다음」 칸이 판 자리 왼끝 안에 남게
export function fanLeft(y) {
  const g = boardGeo(), B = g.at(8, 0), R = g.at(8, 8), lim = y - DEPTH - 6;
  if (lim >= B.y) return BX + NEXT_COL.w * 2 + NEXT_COL.gap + NEXT_COL.sep;
  if (R.x === B.x) return Math.ceil(B.x) + 2;
  return Math.ceil(B.x + ((lim - B.y) * (R.x - B.x)) / (R.y - B.y));
}
// 오른쪽 칸 격언 칸(그림만) · 콤보 칸 · 왼쪽 칸 줄의 크기
export const MAXC = { w: 21, h: 26 }, MAXIM_ROW = 5;
export const COMBO = { top: 39, h: 18, gap: 3, max: 5 };
const ROW_L = 17, PX = 4, VAL_W = 47;
const maximSlotsOf = (run) => Math.max(maximCapacity(run) + run.maxims.filter((m) => m.legendary).length, run.maxims.length);
// 손 이름표 줄 오른쪽 희생 단추: 아이콘 + 이름이 62 안에 들어가면 그대로. 안 들어가면(영어 「Sacrifice」 굵게 57) 아이콘을 빼고
// 이름에 맞춘 폭(테 1 + 틈 2 양쪽 — 단추 글 안 여백 검사). 손 이름표 줄(handRowLayout)은 이 폭을 뺀 자리를 쓴다(CHM-40)
export function discardButton() {
  const tw = measure('희생', true);
  return tw + 10 + 6 <= 62 ? { w: 62, icon: true } : { w: Math.max(62, tw + 7), icon: false };
}
const BAR_TIERS = OVERFLOW_TIERS; // 목표 막대의 눈금(목표 ×1 · ×2 · ×5 · ×10) = 넘친 층
// 대국 왼쪽 칸(안 3): 값 × 배수 큰 칸 높이(이름표 줄 + 두 배 수)
export const VAL_H = 38;
const INTRO = 1.5; // 마스터 등장 장면 길이(초, 벽시계)
// 멈칫(hit-stop) 예산(초, ×1): 한 수의 멈칫 합은 move까지, 그중 잡기 멈칫은 impact까지. 멈칫은 Seq 밖의 시간이라 한 수 연출 4초 안에 같이 든다(smoke가 더해 잰다)
export const STOP = { move: 0.25, impact: 0.15 };
const clone = (x) => JSON.parse(JSON.stringify(x));

// 값 · 배수 상자에 들어가는 짧은 숫자(gfx.js — 다른 화면도 fitNum으로 쓴다)
export { short };
// 빗금(노림수 · 끊김): 붉은색을 못 가려도 무늬로 알아보게. 칸 모양 안에 5 간격 가는 사선(벡터)
function hatch(ctx, sq, col) {
  clipSq(ctx, sq, (b) => {
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < b.w + b.h; i += 5) { ctx.moveTo(b.x + i, b.y); ctx.lineTo(b.x + i - b.h, b.y + b.h); }
    ctx.stroke();
  });
}
// 다시 놓기 아이콘(7×7): 판 넷 칸이 뒤집히는 모양 — 칸 둘은 먹, 둘은 빈 테
function reboardIcon(ctx, x, y, col) {
  rrect(ctx, x, y, 3, 3, 0.8, col); rrect(ctx, x + 4, y + 4, 3, 3, 0.8, col);
  ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.lineJoin = 'round';
  ctx.strokeRect(x + 4.45, y + 0.45, 2.1, 2.1); ctx.strokeRect(x + 0.45, y + 4.45, 2.1, 2.1);
}
// 판 위 사물 「함정」(정석): 칸 안의 어두운 구덩이 + 네 귀퉁이 말뚝. 매복 시너지 빛(회청)
function trapPit(ctx, x, y, size) {
  const i = size >= 24 ? 5 : 3, w = size - i * 2;
  ctx.globalAlpha = 0.55; rrect(ctx, x + i, y + i, w, w, 2, '#1a1512'); ctx.globalAlpha = 1;
  rframe(ctx, x + i, y + i, w, w, 2, '#c0c8d0');
  for (const [a, b] of [[i - 1, i - 1], [size - i + 1, i - 1], [i - 1, size - i + 1], [size - i + 1, size - i + 1]]) { ctx.beginPath(); ctx.arc(x + a, y + b, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#c0c8d0'; ctx.fill(); }
  for (let k = i + 2.5; k < size - i - 1; k += 3) seg(ctx, x + k, y + size - i - 2.6, x + k, y + size - i - 1.4, '#6e767e', 0.9);
}
// 횃불(정석): 이 적은 아무것도 지키지 못한다 — 칸 오른쪽 위의 작은 불꽃(둥근 받침 위 두 겹 불꽃 · 자루)
function torchMark(ctx, x, y, time) {
  const k = beat(time, 6) % 2;
  rrect(ctx, x - 1, y - 1, 7, 10, 2.5, '#1a1512');
  seg(ctx, x + 2.5, y + 5, x + 2.5, y + 7.5, '#8c6a3a', 1.2);
  const flame = (h, w, col) => { ctx.beginPath(); ctx.moveTo(x + 2.5 - k * 0.4, y + 5 - h); ctx.quadraticCurveTo(x + 2.5 + w, y + 3.5, x + 2.5, y + 5); ctx.quadraticCurveTo(x + 2.5 - w, y + 3.5, x + 2.5 - k * 0.4, y + 5 - h); ctx.fillStyle = col; ctx.fill(); };
  flame(5.2, 2.6, '#df8a45'); flame(4.4, 1.9, '#efbd55'); flame(3, 1, '#fff1b8');
}
// 점선(미리 보기의 길): step 간격 둥근 점
function dotLine(ctx, x0, y0, x1, y1, col, step = 3) {
  const n = Math.hypot(x1 - x0, y1 - y0);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i <= n; i += step) { const t = n ? i / n : 0, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t; ctx.moveTo(px + 0.6, py); ctx.arc(px, py, 0.6, 0, Math.PI * 2); }
  ctx.fill();
}
// 끊어진 굵은 선(노림수, 굵기 2 · 마디 4 · 틈 2): off가 늘면 마디가 끝(x1, y1) 쪽으로 흐른다
function dashLine(ctx, x0, y0, x1, y1, col, off = 0) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'butt'; ctx.setLineDash([4, 2]); ctx.lineDashOffset = -off;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.restore();
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
function gateArch(ctx, x, y, size, glow) {
  const inset = size >= 24 ? 3 : 2, t = size >= 24 ? 2 : 1.5;
  const L = x + inset, R = x + size - inset, r = (R - L) / 2, cx = (L + R) / 2, top = y + inset - 1, bot = y + size - 2.5, cy = top + r;
  // 위는 반원, 아래는 곧은 기둥. k: 안쪽으로 들인 몫 · open: 바닥 변을 닫지 않는다(테)
  const arch = (k, dy = 0, open = false) => {
    ctx.beginPath(); ctx.moveTo(L + k, bot + dy); ctx.lineTo(L + k, cy + dy); ctx.arc(cx, cy + dy, Math.max(0.5, r - k), Math.PI, 0); ctx.lineTo(R - k, bot + dy);
    if (!open) ctx.closePath();
  };
  arch(0); ctx.fillStyle = GATE.in; ctx.fill();
  ctx.globalAlpha = glow; arch(2, 1); ctx.fillStyle = GATE.glow; ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  arch(t / 2, 0, true); ctx.strokeStyle = GATE.rim; ctx.lineWidth = t; ctx.stroke();
  arch(-0.4, 0, true); ctx.strokeStyle = INK3; ctx.lineWidth = 0.8; ctx.stroke();
  rect(ctx, x + 2, y + size - 2, size - 4, 1, GATE.hi);
  rect(ctx, x + inset, y + size - 3, size - inset * 2, 1, GATE.rim);
}
const WATER = '#4fa6c6'; // 물수제비가 튕긴 칸의 물방울 · 고리(나뭇결 위에서도 보이게 하늘빛보다 진하게)
const FALL = 0.2, FALL_PX = 14; // 증원이 위에서 떨어지는 시간(×1) · 높이

// 판 위 함정(정석): 칸 안의 어두운 구덩이 + 네 꼭짓점 말뚝(투영한 칸)
function trapSq(ctx, sq) {
  ctx.globalAlpha = 0.55; fillSq(ctx, sq, '#1a1512', 5); ctx.globalAlpha = 1;
  strokeSq(ctx, sq, '#c0c8d0', 1, 5);
  for (const p of projectSq(sq).pts) { const c = sqCenter(sq), x = c.x + (p.x - c.x) * 0.55, y = c.y + (p.y - c.y) * 0.55; rect(ctx, x - 1, y - 1, 2, 2, '#c0c8d0'); }
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
// 자리는 판 칸 단위(f, r)로 잇고 투영한다 — 꺾는 자리가 정면 판에서도 칸을 따른다. 돌려주는 자리는 칸 가운데(받침 가운데)
const fr = (sq) => ({ f: sq & 7, r: sq >> 3 });
const along = (a, c, k) => centerAt(lerp(a.f, c.f, k), lerp(a.r, c.r, k));
export function moverXY(form, from, to, p) {
  const a = fr(from), c = fr(to);
  if (!LEAPERS.has(form) || (isLine(from, to) && form !== 'V')) return along(a, c, p);
  // 나이트 L자가 아닌 도약(낙타 · 까마귀)은 한 번의 높은 포물선
  const ddf = Math.abs((to & 7) - (from & 7)), ddr = Math.abs((to >> 3) - (from >> 3));
  if (!((ddf === 1 && ddr === 2) || (ddf === 2 && ddr === 1))) { const q = ease.inOut(p), pt = along(a, c, q); return { x: pt.x, y: pt.y - Math.sin(p * Math.PI) * 14, arc: Math.sin(p * Math.PI) * 14 }; }
  const df = (to & 7) - (from & 7);
  const mid = Math.abs(df) === 2 ? { f: c.f, r: a.r } : { f: a.f, r: c.r };
  const q = ease.inOut(p);
  const k = q < 2 / 3 ? q * 1.5 : (q - 2 / 3) * 3;
  const pt = q < 2 / 3 ? along(a, mid, k) : along(mid, c, k);
  return { x: pt.x, y: pt.y - Math.sin(p * Math.PI) * 9, arc: Math.sin(p * Math.PI) * 9 };
}
// 움직이는 내 기물의 자리(CHM-57): 꺾는 길은 꺾은 칸을 거쳐(꺾는 칸에서 잠깐 선다), 넘기는 짧은 포물선, 그 밖은 행마(path)대로
export function routeXY(m) {
  const r = m.route;
  if (r && r.kind === 'bend') {
    const at = routeAt(r.pts, m.p);
    return along(fr(r.pts[at.i]), fr(r.pts[at.i + 1]), at.k);
  }
  if (r && r.kind === 'hop') {
    const q = ease.inOut(m.p), h = Math.sin(m.p * Math.PI) * 10, pt = along(fr(m.from), fr(m.to), q);
    return { x: pt.x, y: pt.y - h, arc: h };
  }
  return moverXY(m.path || m.form, m.from, m.to, m.p);
}
const bagTip = (b) => {
  const counts = {};
  for (const p of b.bag) counts[p.t] = (counts[p.t] || 0) + 1;
  const parts = ['P', 'N', 'B', 'R', 'Q', ...FAIRIES].filter((t) => counts[t]).map((t) => `${PIECE_NAME[t]} ${counts[t]}`);
  return tipLines('덱', parts.length ? parts.join(' · ') : '비었어요');
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
    this.trail = [];     // 복기: 내 결정마다 그 앞의 대국 상태(replay.js noteStep). 판 상태에는 적지 않는다
    this.rv = null;      // 복기 중 · 갈림길 카드 { phase: 'think' | 'card', … }
    this.sync();
    const info = events.find((e) => e.type === 'battleStart');
    const b = this.bRef;
    const m = b.mods.find((s) => MASTER_BY_ID[s.id]);
    // 마스터 대국: 온 화면 등장 장면(1.5초, 누르면 넘김) 뒤에 마스터 띠. 띠의 시간은 등장 장면 밑에서도 흐른다(from — 등장이 끝난 때부터 보인다)
    // 이어 하기로 연 대국(대국 시작 사건이 없다)에는 등장 장면 없이 마스터 띠만 곧바로 세운다
    if (m) {
      const M = MASTER_BY_ID[m.id], at = info ? INTRO : 0;
      if (info) { this.intro = { t: 0, life: INTRO, id: m.id, landed: false }; this.snd('start'); }
      this.banner = { title: `마스터 ${M.name}`, sub: M.text, t: 0, life: at + 1.6, from: at, col: PAL.red, master: m.id };
    }
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

  // 대국 화면을 떠나면 판 위 연출(큰 글자 · 모습 이름 · 연기 · 조각 · 반짝이)은 사라진다(보상 상자를 덮지 않게). 색종이는 화면 뒤 층으로 이어 떨어지고,
  // 날던 동전 · 명국 조각(carry)은 대국 뒤 막간(보상 · 상자 · 각성 · 전설)으로 갈 때만 이어 난다 — 결과 · 목록 · 메인 화면 위로는 날지 않는다
  onLeave(next) { this.fx.list = this.fx.list.filter((e) => e.confetti || (e.carry && AFTER.has(next))); }
  get run() { return this.src.run; }
  live() { return this.src.live(); }
  // 갈림길 카드가 떠 있으면 그 상태(갈린 수 앞)를 그린다
  get b() { return (this.rv && this.rv.state) || this.live() || this.bRef; }
  snd(name, arg) { this.app.sfx(name, arg); }
  shake(px, dur) { this.app.shake(px, dur); }
  // 한 수의 멈칫은 예산(STOP.move) 안에서만. 쓴 만큼 한 수 연출 시간(moveT)에도 더해 뒤 걸음이 줄어든다. 프레임 하나를 더 서는 몫(1/60)까지 센다
  hitstop(sec) {
    if (this.app.reducedMotion) return 0;
    const d = Math.min(sec, STOP.move - (this.stopT || 0) - 1 / 60);
    if (d < 0.01) return 0;
    this.app.hitstop(d);
    this.stopT = (this.stopT || 0) + d + 1 / 60;
    this.moveT = (this.moveT || 0) + d + 1 / 60;
    return d;
  }
  toast(msg, col, dur) { this.app.toast(msg, col, dur); }
  // 알림 자리(CHM-48): 판 아래쪽, 판 폭 안. 위 가운데는 목표 막대 · 얻을 몫(+N)을 덮었다.
  // 판 가운데는 「메이트」 · 「대국 승리」 글자와 마스터 띠, 왼쪽 칸은 목표 · 점수 · 사슬 칸, 오른쪽 칸은 격언 · 손이 쓴다
  // top: 쌓인 알림이 넘지 않을 윗변 — 띠가 떠 있으면 띠 아래, 아니면 판 가운데 큰 글자(「메이트」 네 배) 아래. 넘치면 오래된 것부터 접는다
  toastSpot() {
    let top = BY + 126;
    if (this.banner) { const bb = this.bannerBox(); top = bb.by + bb.bh + 2; }
    // 갈림길 카드(복기)가 떠 있으면 그 위로
    if (this.rv) {
      const rb = this.reviewBox();
      if (rb.y > BY + 4) return { cx: BX + (S * 8) / 2, w: S * 8 - 8, bottom: rb.y - 2, top: Math.min(top, rb.y - 22) };
      return { cx: BX + (S * 8) / 2, w: S * 8 - 8, bottom: Math.min(BY + S * 8 - 4, this.nextLabelY() - 3), top: rb.y + rb.h + 2 };
    }
    // 밑변은 손 부채 왼쪽의 「다음」 이름표 위(안 3 — 판 아래 오른쪽에 손이 선다)
    return { cx: BX + (S * 8) / 2, w: S * 8 - 8, bottom: Math.min(BY + S * 8 - 4, this.nextLabelY() - 3), top };
  }
  nextLabelY() { return nextColumn(this.rightLayout(this.run)).labelY; }
  // 대국 시작 띠의 자리(drawOver · toastSpot). 명인 띠: 이름(두 배, 초상 왼쪽 146에 안 들어가면 한 배) → 묶음 틈 → 규칙 글(줄마다 LINE) — 띠 높이는 글에 맞춘다(초상 64 이상)
  bannerBox() {
    const bn = this.banner, row = bn.news ? 26 : 0;
    const TW = 146, mBig = bn.master && measure(bn.title, true) * 2 <= TW;
    const subs = bn.master ? wrap(bn.sub, TW) : [];
    const mh = Math.max(76, PAD_BOX + LINE * 2 + GAP_GROUP + subs.length * LINE + PAD_BOX);
    const bh = (bn.master ? mh : 44) + row, by = BY + 106 - bh / 2;
    return { row, TW, mBig, subs, bh, by };
  }
  get busy() { return this.seq.busy || !!this.combo; } // 점화 막간(this.combo)이 떠 있는 동안도 누를 수 없다

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
    v.next = clone(nextDraws(b)); // 다음 수(CHM-60): 손과 같은 순간에 바뀐다
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
        bends: [null, ...c.captures.filter((x) => !x.stay).map((x) => capRoute(x).pts.slice(1, -1))],
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
    if (this.busy || this.rv) return { kind: null, list: [] };
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
    if (this.busy || this.rv || !b || b.status !== 'play' || i >= b.hand.length) return;
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
    if (this.src.kind === 'run' && !this.rehearsal) noteStep(this.trail, bRef, cmd);
    const events = this.src.cmd(cmd);
    if (run && !this.rehearsal) this.record(events, run);
    const post = clone(bRef.board);
    for (const e of events) if (e.type === 'reinforce') post[e.sq] = null;
    if (cmd.type === 'drop') { v.hand.splice(cmd.handIndex, 1); v.drawn = []; } // 수를 두면 탁월수 기회(!?)가 끝난다
    this.targets = null;
    this.play(events, post, cmd);
  }

  // 이번 판 최고 한 수를 다시 보기용으로 남긴다(결과 화면이 작은 판에 다시 둔다). captures: 사슬 길이(하이라이트 카드 — 옛 저장엔 없다)
  record(events, run) {
    const r = this.rec;
    if (!r) return;
    for (const e of events) {
      // 다시 보기가 같은 길을 그리게 꺾은 칸(via) · 넘기(hop) · 제자리 쏘기(stay) · 광대가 흉내 낸 행마(move)도 남긴다
      if (e.type === 'capture') r.caps.push({ from: e.from, to: e.to, at: e.at ?? e.to, piece: e.piece, form: e.form, after: e.form, ...(e.via != null && e.via >= 0 ? { via: e.via } : {}), ...(e.hop ? { hop: true } : {}), ...(e.stay ? { stay: true } : {}), ...(e.move ? { move: e.move } : {}) });
      // 화약병 · 폭약으로 함께 터진 적은 그 먹기에 붙여 둔다(다시 보기 판에서 지운다)
      else if (e.type === 'pierce' && r.caps.length) { const c = r.caps[r.caps.length - 1]; (c.gone || (c.gone = [])).push(e.sq); }
      else if ((e.type === 'transform' || e.type === 'promote') && r.caps.length) r.caps[r.caps.length - 1].after = e.type === 'promote' ? 'Q' : e.to;
      else if (e.type === 'refill' || e.type === 'redrop') r.broken = true;
      else if (e.type === 'end') {
        if (!r.broken && (!run.bestReplay || e.score > run.bestReplay.score)) run.bestReplay = { ...r, score: e.score, reason: e.reason, captures: e.captures };
        this.rec = null;
      }
    }
  }

  // ── 사건 → 연출
  play(events, post, cmd) {
    const app = this.app, v = this.view, seq = this.seq;
    // 한 수의 연출이 쌓인 시간(moveT)이 1.3초를 넘으면 뒤 걸음을 줄여 간다: 한 수 연출이 4초(×1) 안에 들게.
    // 사슬 끝의 곱 · 외통은 줄이지 않는다(그 순간이 보상이라서).
    if (cmd && cmd.type === 'drop') { this.moveT = 0; this.matesInMove = 0; this.stopT = 0; this.impactT = 0; }
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
            v.chain = { sq: e.sq, form: e.piece, value: 0, mult: 0, steps: [e.piece], path: [e.sq], bends: [], forced: null, awaiting: null, cut: false, eng: this.dropEng || null, soul: this.dropSoul || null, awake: this.dropAwake || false };
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
        // 까마귀 모습은 먹은 칸(e.to) 너머에 앉는다(e.at): 짧은 포물선으로 넘고, 넘은 적은 가운데쯤 깨진다(CHM-57).
        // 꺾쇠 · 물수제비는 꺾은 칸(via)을 거치는 꺾인 길로 미끄러지고 꺾는 칸에서 짧게 멈춘다(fxroute.js)
        case 'capture': {
          const route = capRoute(e);
          const form0 = v.chain ? v.chain.form : 'N';
          const dur = route.kind === 'bend' ? bendDur(route.pts) : route.kind === 'hop' ? 0.18 : moveDur(e.move || form0, e.from, e.at ?? e.to, e.stay);
          add(dur, {
            begin: () => {
              const c = v.chain;
              if (e.stay) { v.arrow = { from: e.from, to: e.to, p: 0 }; c.forced = null; return; }
              v.board[e.from] = null;
              v.mover = { from: e.from, to: e.at ?? e.to, form: c.form, path: e.move || c.form, route, p: 0, seen: 0, broke: false };
              c.forced = null;
            },
            tick: (p) => {
              if (v.arrow) { v.arrow.p = p; return; }
              const m = v.mover;
              if (route.kind === 'bend') {
                m.p = p;
                const at = routeAt(route.pts, p);
                // 꺾는 칸에 닿는 순간 한 번: 꺾쇠는 흰 빛 한 점, 물수제비는 물방울
                const reached = at.corner > 0 ? at.corner : at.i;
                while (m.seen < reached && m.seen < route.pts.length - 2) { m.seen++; this.cornerFx(route.pts[m.seen], (e.move || m.form) === 'E'); }
              } else if (route.kind === 'hop') {
                m.p = p;
                if (p >= 0.5 && !m.broke) { m.broke = true; const vic = v.board[e.to]; v.board[e.to] = null; this.shatter(e.to, vic ? vic.t : e.piece, vic && vic.gold ? 'g' : 'b'); this.flash(e.to, PAL.white); this.snd('capture', v.chain ? v.chain.path.length - 1 : 0); }
              } else m.p = LEAPERS.has(m.path) ? p : ease.out(p);
            },
            done: () => {
              const c = v.chain;
              const broke = !!(v.mover && v.mover.broke);
              const victim = v.board[e.to];
              // 궁수 모습: 제자리에서 쏜다(판 위 기물은 그대로, 먹힌 칸만 빈다)
              if (e.stay) { v.board[e.to] = null; v.arrow = null; (c.shots || (c.shots = [])).push([e.from, e.to]); c.steps.push(c.form); }
              else { const at = e.at ?? e.to; v.board[e.to] = null; v.board[at] = { t: c.form, mine: true }; v.mover = null; c.sq = at; c.path.push(at); (c.bends || (c.bends = []))[c.path.length - 1] = route.pts.slice(1, -1); c.steps.push(c.form); }
              c.value += e.value; c.mult += 1;
              if (!broke) { this.shatter(e.to, victim ? victim.t : e.piece, victim && victim.gold ? 'g' : 'b'); this.flash(e.to, PAL.white); }
              this.pop(`+${e.value}`, 'value');
              c.capPop = `+${e.value}`;
              if (!broke) this.snd('capture', c.path.length - 1);
              this.impact(c.steps.length - 1);
            },
          });
        } break;
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
            const mrow = [];
            if (dm) mrow.push([`+${short(dm)}`, {}]);
            if (xm !== 1) mrow.push([`×${Number(xm.toFixed(2))}`, {}]);
            if (cv || cm) this.chartShare(c.sq, cv, cm, { after: dv ? `+${short(dv)}` : c.capPop, row: mrow });
            else this.popRow(mrow);
            this.snd('tick', c.mult);
          },
        }); break;
        case 'money': if (e.src !== 'chest') add(0.05, { begin: () => { this.pop(`$${e.money}`, 'money'); this.snd('coin'); this.coinFx(e.money); } }); break;
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
        // 화약병 터짐(CHM-57): 둘레 여덟 칸이 번쩍이고 조각이 튄다. 세기는 터진 수에 따라(글 · 흔들림 · 멈칫은 여기서 한 번)
        case 'explode': add(0.14 + 0.02 * Math.min(6, e.squares.length), { begin: () => this.blastFx(e.sq, e.squares) }); break;
        // 화약병에 터진 적은 깨지기만(글 · 소리는 터짐 걸음이 한 번 냈다)
        case 'pierce': if (e.src === 'powder') { add(0.05, { begin: () => { const vic = v.board[e.sq]; v.board[e.sq] = null; this.shatter(e.sq, vic ? vic.t : e.piece, vic && vic.gold ? 'g' : 'b'); this.flash(e.sq, PAL.goldHi); } }); break; }
          add(0.12, { begin: () => {
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
          begin: () => { this.topple(e.sq); this.word('체크메이트', PAL.gold, 1.6, 4); this.snd('mate'); this.hitstop(0.25); this.shake(3, 0.3); },
        }); break;
        // 탁월수 !!: 메이트 연출에 겹쳐 돈다(걸음 길이 0 — 한 수 연출 시간을 늘리지 않는다). 칸의 「!!」 · 빛살은 fx, 배수 칸 「×N」은 v.brill
        case 'brilliant': { const sq = mateSq; add(0, { begin: () => this.brilliantFx(sq, e) }); break; }
        case 'refill': add(0.35, {
          begin: () => { this.word('적이 다시 나타났다!', PAL.gold, 1.1, 1); this.snd('refill'); },
          done: () => { v.board = clone(post); if (v.chain) { v.chain.path = [e.sq]; v.chain.bends = []; } },
        }); break;
        case 'redropReady': add(0.15, {
          begin: () => { if (v.chain) { v.board[v.chain.sq] = null; v.chain.awaiting = e.squares.slice(); } this.word('한 번 더 놓기', PAL.gold, 1); },
        }); break;
        case 'end': this.endSteps(e); break;
        case 'overflow': add(0.08, {
          begin: () => {
            const big = { 1: 1, 2: 2, 5: 3, 10: 4 }[e.tier] || 1;
            if (this.src.kind !== 'lesson') this.word(e.tier === 1 ? '목표 달성' : `목표 ×${e.tier}`, e.tier >= 5 ? PAL.red : PAL.gold, 1 + big * 0.2, Math.min(3, big));
            this.ring = { t: 0, life: 0.5 + big * 0.15, col: e.tier >= 10 ? PAL.white : e.tier >= 5 ? PAL.red : PAL.gold };
            this.snd('overflow', e.tier); this.shake(big, 0.2 + big * 0.05);
            this.overflowFx(e.tier, big);
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
        case 'returnHome': add(0.05, { begin: () => { this.toast(`${josa(PIECE_NAME[e.piece], '이/가')} 손으로 돌아왔어요`, PAL.gold); } }); break;
        case 'captive': add(0.05, { begin: () => { this.toast(`${PIECE_NAME[e.piece]} 포로가 덱에 들어와요`, PAL.gold); } }); break;
        // 시계를 잃는다(밤샘 2 D1): 대국은 졌지만 판은 이어진다
        case 'clockLost': add(0.9, {
          begin: () => {
            this.app.clockFx = { idx: e.clock, t: 0 };
            this.word(e.clock > 0 ? '시계 −1' : '시간 종료', PAL.red, 1.3, 2); this.snd('glass'); this.shake(2, 0.2);
          },
        }); this.runEvents.push(e); break;
        // 혼에 금이 간다(CHM-17): 짧은 금 소리 · 혼 빛깔 글. 처음이면 킹이 한 줄 안내
        case 'crack': add(0.25, {
          begin: () => {
            const s = SOUL_BY_ID[e.soul];
            this.toast(`${s.name}의 혼에 금이 갔어요`, s.col, 2.4);
            this.snd('crack');
          },
        }); this.runEvents.push(e); break;
        case 'shatter': add(0.2, { begin: () => { this.toast(`유리 각인 ${josa(PIECE_NAME[e.piece], '이/가')} 깨졌어요`, PAL.sky); this.snd('glass'); } }); break;
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
          begin: () => { this.word('손 새로 뽑기', PAL.gold, 1.2, 1); this.snd('discard'); },
          done: () => { const b = this.bRef; v.hand = clone(b.hand); v.bag = b.bag.length; v.next = clone(nextDraws(b)); },
        }); break;
        // 희생: 바친 카드가 흩어지고(걸음 처음) 새 카드가 아래에서 올라온다(걸음 끝, 0.18초 — 손 그리기가 app.time으로)
        case 'discard': add(0.22, {
          begin: () => { this.snd('discard'); this.offerFx((cmd && cmd.handIndices) || []); },
          done: () => {
            const b = this.bRef, had = new Set(v.hand.map((p) => p.id));
            v.hand = clone(b.hand); v.discardsLeft = b.discardsLeft; v.bag = b.bag.length; v.next = clone(nextDraws(b)); v.hiding = null;
            v.drawn = e.offering && e.offering.drawn ? e.offering.drawn.slice() : [];
            v.offered = (b.offered || []).map((p) => p.t);
            this.dealIn = { ids: v.hand.filter((p) => !had.has(p.id)).map((p) => p.id), t: this.app.time };
          },
        }); break;
        case 'win': if (this.src.kind === 'lesson') break; add(0.25, { begin: () => { this.word('대국 승리', PAL.gold, 1.2, 2); this.snd('win'); this.winFx(); } }); break;
        case 'lose': if (this.src.kind === 'lesson') break; add(0.6, { begin: () => { this.word(e.reason === 'stuck' ? '놓을 곳 없음' : '남은 수 없음', PAL.red, 1.4, 1); this.snd('lose'); } }); break;
        // 점화(CHM-67): 걸음 없이 적어 두고, 한 수 연출이 끝난 뒤(afterSeq) 막간을 연다
        case 'ignite': this.ignPending = e; break;
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
        if (e.score > 0) this.slamFx(v.target && v.score >= v.target);
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
    // 점화 막간(CHM-67): 한 수 연출 밖. 닫히면(closeCombo) 여기로 다시 와 대국을 잇거나 보상 흐름으로 간다
    if (this.ignPending) {
      this.combo = openCombo(this.ignPending, app.reducedMotion);
      this.ignPending = null;
      this.fx.list = this.fx.list.filter((e) => !e.word && !e.formName); // 「대국 승리」 같은 큰 글자 · 「폰!」 모습 이름 · 사슬 평가 도장은 다시 긋는 길과 함께 두지 않는다
      this.stamp = null;
      if (this.combo.calm) this.snd('ignite');
      return;
    }
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
    // 진 대국: 막간 앞에 복기(갈림길 카드). 「넘어가기」 한 번이면 지금과 같은 흐름
    if (this.bRef && this.bRef.status === 'lost' && reviewOn(app, this.src, this.bRef)) { this.rv = { phase: 'think', list, gen: reviewGen(this.trail, this.bRef), t: 0, end: this.bRef }; this.banner = null; return; }
    app.flow(list);
  }

  // ── 복기(CHM-59)
  thinkReview(dt) {
    const rv = this.rv;
    rv.t += dt;
    const t0 = performance.now();
    let r;
    do r = rv.gen.next(); while (!r.done && performance.now() - t0 < REVIEW_SLICE_MS);
    if (!r.done && rv.t < REVIEW_WALL) return;
    this.reviewDone(r.done ? r.value : { kind: 'unknown', nodes: 0, wall: true });
  }
  reviewDone(res) {
    const app = this.app, run = app.run, rv = this.rv;
    rv.gen = null;
    this.reviewRes = res; // 마지막 복기 결과(smoke · 스크린샷 도구가 본다)
    // 사람 판 기록: 대국 줄에 복기 결과(하네스 --replay와 같은 열쇠). 판이 이 대국으로 끝났으면 남긴 줄을 갈아 끼운다
    const row = run.log[run.log.length - 1];
    if (row && !row.won) {
      row.replay = res.kind;
      app.save();
      if ((run.phase === 'lost' || run.phase === 'won') && run.track && run.track.kept) app.keepRun(run, run.phase === 'won' ? 'won' : run.endless ? 'endless' : 'lost');
    }
    if (res.kind === 'unknown') { this.endReview(false); return; }
    rv.res = res;
    rv.phase = 'card';
    this.fx.list = this.fx.list.filter((e) => !e.word); // 「수가 다했다」 · 「시계 −1」 글자는 카드와 함께 두지 않는다
    if (res.kind === 'path') {
      // 갈린 수 앞의 판을 보인다(안개는 걷고)
      rv.state = cloneBattle(this.trail[res.at].state);
      rv.state.revealed = Array.from({ length: 64 }, (_, i) => i);
      this.lastEnd = null;
      this.sync();
    }
    app.records.reviews = (app.records.reviews || 0) + 1;
    app.track('review_open', { ante: app.run.ante, kind: res.kind });
    app.saveRecords();
    this.snd(res.kind === 'path' ? 'pick' : 'lose');
  }
  // 넘어가기: 막간 · 국면 화면으로(카드를 봤으면 잃은 시계 칸을 상점에서 한 번 더 깜빡인다)
  endReview(shown = true) {
    const rv = this.rv, app = this.app;
    this.rv = null;
    const lost = shown && this.runEvents.find((e) => e.type === 'clockLost');
    if (lost) app.clockFx = { idx: lost.clock, t: 0 };
    app.flow(rv.list);
  }
  retryReview() {
    const rv = this.rv, app = this.app;
    if (!rv || !rv.res || rv.res.kind !== 'path') return;
    app.records.reviewReplays = (app.records.reviewReplays || 0) + 1;
    app.track('review_replay', { ante: app.run.ante });
    app.saveRecords();
    const lost = this.runEvents.find((e) => e.type === 'clockLost');
    app.go('review', { res: rv.res, trail: this.trail, list: rv.list, clock: lost ? lost.clock : null });
  }
  // 갈림길 카드 자리(판 아래쪽, 판 폭 안 — hug): 복기 중이면 한 줄, 카드면 제목 → 묶음 안 틈 → 문장 · 점수 → 묶음 틈 → 단추 줄
  reviewBox() {
    const rv = this.rv, CW = S * 8 - 8, P = PAD_BOX, tw = CW - P * 2;
    const x = BX + Math.floor((S * 8 - CW) / 2), bottom = Math.min(BY + S * 8 - 4, this.nextLabelY() - 3);
    const f = flow(P), rows = [];
    let by = null;
    if (rv.phase === 'think') rows.push([THINKING, f.line(), PAL.dim, false]);
    else if (rv.res.kind === 'path') {
      for (const l of wrap(forkTitle(rv.res), tw, true)) rows.push([l, f.line(), PAL.gold, true]);
      f.gap(GAP_IN);
      for (const l of wrap(forkLine(rv.res, rv.state.board), tw)) rows.push([l, f.line(), PAL.ink, false]);
      const sc = wrap(forkScores(rv.res), tw);
      const two = forkScoreLines(rv.res);
      for (const l of sc.length <= 1 ? sc : two.every((x) => wrap(x, tw).length === 1) ? two : forkScoreRows(rv.res)) rows.push([l, f.line(), PAL.dim, false]);
    } else for (const l of wrap(NO_PATH, tw, true)) rows.push([l, f.line(), PAL.ink, true]);
    if (rv.phase === 'card') by = f.gap(GAP_GROUP).space(BTN_S);
    const h = f.y + P;
    // 「?」 · 「!」 칸이 카드 밑에 들면 카드를 판 위쪽으로
    let y = bottom - h;
    if (rv.phase === 'card' && rv.res.kind === 'path') {
      const m = forkMarks(rv.res);
      const under = [m.mine, m.best].some((sq) => { if (sq == null) return false; const b = sqBox(sq); return b.y + b.h > y - 6 && sqCenter(sq).y - PIECE_UP < y + h; });
      if (under) y = BY + 4;
    }
    return { x, y, w: CW, h, rows, by, tw };
  }
  // 갈림길 카드. 판 위에는 「?」 내 수 · 「!」 이길 수
  drawReview(ctx, ui) {
    const rv = this.rv, app = this.app, P = PAD_BOX;
    const path = rv.phase === 'card' && rv.res.kind === 'path';
    if (path) this.drawForkMarks(ctx, rv.res);
    const { x, y, w, h, rows, by, tw } = this.reviewBox();
    openBox('panel', x, y, w, h, P, { name: rv.phase === 'think' ? '복기 중' : '갈림길' });
    box(ctx, x, y, w, h, PAL.feltDk, path ? PAL.gold : PAL.frameDk);
    for (const [l, ty, col, bold] of rows) text(ctx, l, x + w / 2, y + ty, col, { align: 'center', bold });
    if (by != null) {
      const bw = Math.floor((tw - 8) / 2);
      if (path) {
        button(ctx, ui, 'btn:replay', x + P, y + by, bw, BTN_S, '다시 두기', { onClick: () => this.retryReview(), tone: 'gold' });
        button(ctx, ui, 'btn:moveon', x + w - P - bw, y + by, bw, BTN_S, '건너뛰기', { onClick: () => this.endReview() });
        hint(app, 'replay', 'btn:replay');
      } else button(ctx, ui, 'btn:moveon', x + Math.floor((w - bw) / 2), y + by, bw, BTN_S, '건너뛰기', { onClick: () => this.endReview() });
    }
    closeBox();
  }
  drawForkMarks(ctx, res) {
    const m = forkMarks(res);
    const tag = (sq, mark, tone, edge) => {
      strokeSq(ctx, sq, edge, 2);
      const r = boardTagRect(sq, { mark, scale: 2 });
      drawAnnot(ctx, mark, r.x, r.y, tone, 2);
    };
    if (m.best != null && m.ghost) { const c = sqCenter(m.best); this.putPiece(ctx, m.ghost, 'w', c.x, c.y, { alpha: 0.6 }); }
    if (m.mine != null) tag(m.mine, '?', ANNOT.red, ANNOT.red.fill);
    if (m.best != null) tag(m.best, '!', ANNOT.teal, ANNOT.teal.fill);
  }

  // ── 효과
  // 칸 가운데(받침 가운데) — 선 · 연출이 기댄다. 기물 몸 가운데는 그보다 위(bodyOf)
  center(sq) { return sqCenter(sq); }
  bodyOf(sq) { const c = sqCenter(sq); return { x: c.x, y: c.y - 10 }; }
  // 내 기물의 모습: 떨군 기물의 각인 톤 + 지금 모습의 기보 단계
  look(form, time = null) {
    const run = this.run, v = this.view;
    return { eng: v.chain ? v.chain.eng || null : null, soul: v.chain ? v.chain.soul || null : null, awake: !!(v.chain && v.chain.awake), tier: run ? tierOf(run.charts[chartForm(form)]) : 0, time };
  }
  // 먹힌 기물이 부서진다: 기물 빛깔 조각이 튀어 떨어지고(움직임 줄이기면 작은 조각만), 칸에서 흰 연기가 부푼다(28절)
  shatter(sq, type, side) {
    // 조각 자리는 16 × 22 상자(기물 그림 가운데에 맞춘다)
    const c0 = sqCenter(sq), x = c0.x - 8, y = c0.y - PIECE_TOP + 1;
    const chips = pieceChips(type, side === 'g' ? 'g' : side);
    const calm = this.app.reducedMotion, n = calm ? 14 : CAP.chips;
    let seed = sq * 97 + chips.length;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = [];
    const SHAPES = [[2, 2], [3, 2], [2, 3], [3, 3], [4, 2], [2, 1]];
    for (let i = 0; i < n; i++) {
      const c = chips[Math.floor(rnd() * chips.length)];
      if (calm) { parts.push({ x: x + c.x, y: y + c.y, vx: (c.x - 8) * 6 + (rnd() - 0.5) * 30, vy: -40 - rnd() * 50, col: c.col, s: rnd() < 0.3 ? 2 : 1, a: rnd() * 6, spin: 0 }); continue; }
      const [w, h] = SHAPES[i % SHAPES.length];
      parts.push({ x: x + c.x, y: y + c.y, vx: (c.x - 8) * 11 + (rnd() - 0.5) * 70, vy: -70 - rnd() * 80, col: c.col, s: w + 0.5, h: h + 0.5, a: rnd() * 6, spin: (rnd() - 0.5) * 18 });
    }
    if (!calm) puff(this.fx, c0.x, c0.y - 8, { seed: sq * 13 + 5, power: Math.min(3, (this.view.chain ? this.view.chain.steps.length : 1) / 3) });
    this.fx.add({
      life: 0.7, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; } },
      draw: (ctx, e) => { const k = e.t / e.life; ctx.globalAlpha = calm ? Math.max(0, 1 - k) : k < 0.5 ? 1 : Math.max(0, (1 - k) / 0.5); for (const p of e.parts) chip(ctx, p.x, p.y, p.s, p.h || p.s, p.col, p.a + p.spin * e.t); ctx.globalAlpha = 1; },
    });
  }
  // 잡을 때의 손맛(28절): 사슬이 길수록 큰 흔들림(그리기 변환만), 셋째 먹기부터 짧은 멈칫. 잡기 멈칫은 한 수에 STOP.impact까지(impactT), 멈칫 전체는 STOP.move까지
  impact(n) {
    this.shake(Math.min(4, 1 + Math.floor(n / 3)), 0.08 + 0.015 * Math.min(8, n));
    if (n >= 3) {
      const d = Math.min(0.05, 0.02 + 0.01 * (n - 3)), left = STOP.impact - (this.impactT || 0);
      if (left > 0.01) this.impactT = (this.impactT || 0) + this.hitstop(Math.min(d, left)) + 1 / 60;
    }
  }
  // 값 × 배수가 점수 줄에 꽂히는 순간: 점수 수가 크게 튀었다 돌아오고(drawLeft — this.slam) 흔들림 · 점수 줄 번쩍 · 금빛 반짝
  slamFx(hot) {
    this.slam = this.app.time;
    this.shake(hot ? 3 : 2, 0.14);
    if (this.app.reducedMotion) return;
    const sy = this.leftLayout().score;
    this.fx.add({ life: 0.16, layer: 1, board: true, draw: (ctx, f) => { ctx.globalAlpha = 0.7 * (1 - f.t / f.life); rect(ctx, LX + 2, sy - 1, LW - 4, LINE + 2, PAL.white); ctx.globalAlpha = 1; } });
    sparkBurst(this.fx, LX + LW - 20, sy + 6, { n: hot ? 14 : 8, seed: Math.round(this.app.time * 60) % 97 + 1, speed: 60, life: 0.5 }).board = true;
  }
  // 목표를 넘기는 순간: 화면 번쩍 + 점수 줄에서 반짝이 터짐(층이 높을수록 세다). 움직임 줄이기면 없음(글 · 고리는 남는다)
  overflowFx(tier, big) {
    if (this.app.reducedMotion) return;
    screenFlash(this.fx, { col: tier >= 10 ? PAL.white : tier >= 5 ? PAL.goldHi : PAL.white, a: 0.28 + 0.07 * big, life: 0.18 + 0.04 * big }).board = true;
    const sy = this.leftLayout().score + 6;
    sparkBurst(this.fx, LX + LW - 24, sy, { n: 12 + 3 * big, seed: tier * 7 + 1, speed: 70 + 15 * big }).board = true;
  }
  // 상금을 얻으면: 「$」 동전이 내 기물 자리(없으면 판 가운데)에서 솟아 상금 줄로 날아가고, 닿을 때마다 상금 수가 흔들린다
  coinFx(money) {
    if (this.app.reducedMotion) { kickMoney(this.app.time); return; } // 움직임 줄이기: 동전 없이 상금 수만 떤다(빛만 — moneyShake)
    const from = this.pieceXY() || { x: BX + 112, y: BY + 112 };
    const to = shardTo();
    const app = this.app;
    // 막간으로 넘어간 뒤 닿은 동전은 상금 수를 흔들지 않는다(보상 화면에는 상금 줄이 없다)
    flyCoins(this.fx, from.x, from.y - 16, LX + LW - PAD_BOX - 8, to.y + 5, { n: Math.max(1, Math.min(CAP.coins, money)), seed: Math.round(from.x * 3 + money), carry: true, onHit: () => { if (app.screen === this) kickMoney(app.time); } });
  }
  // 대국 승리: 판 위에서 색종이가 터진다(움직임 줄이기면 없음). 보상 화면 위로 이어 떨어진다
  winFx() {
    if (this.app.reducedMotion) return;
    confetti(this.fx, BX + 112, BY + 120, { n: CAP.confetti, seed: (this.run ? this.run.ante : 1) * 31 + 7, spread: 230, life: 1.5 });
  }
  burst(sq, col, n) {
    const { x, y } = this.bodyOf(sq);
    const parts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; parts.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 }); }
    this.fx.add({
      life: 0.5, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const p of e.parts) dot(ctx, p.x, p.y, 2, col); ctx.globalAlpha = 1; },
    });
  }
  sparkle(sq, col, n) {
    const c = sqCenter(sq), x = c.x - 14, y = c.y - PIECE_TOP;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: x + 3 + ((i * 7 + sq * 3) % 22), y: y + 2 + ((i * 11 + sq) % 22) });
    this.fx.add({
      life: 0.35, layer: 1,
      draw: (ctx, e) => { const k = e.t / e.life; ctx.globalAlpha = 1 - k; for (const p of pts) { seg(ctx, p.x - 1, p.y + 0.5 - k * 6, p.x + 2, p.y + 0.5 - k * 6, col, 1); } ctx.globalAlpha = 1; },
    });
  }
  flash(sq, col) {
    this.fx.add({ life: 0.15, layer: 1, draw: (ctx, e) => { ctx.globalAlpha = 0.6 * (1 - e.t / e.life); fillSq(ctx, sq, col); ctx.globalAlpha = 1; } });
  }
  // 꺾는 칸(CHM-57): 꺾쇠는 흰 빛 한 점(십자), 물수제비는 물방울 몇 개가 튀고 칸 테두리에 물빛 고리. 움직임 줄이기면 칸 빛만
  cornerFx(sq, water) {
    const { x, y } = this.center(sq);
    const col = water ? WATER : PAL.white;
    this.fx.add({ life: 0.22, layer: 1, draw: (ctx, e) => {
      const k = e.t / e.life;
      ctx.globalAlpha = 1 - k;
      if (water) { const r = 5 + k * 9; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); }
      else { const r = 2 + (1 - k) * 3; seg(ctx, x - r, y, x + r, y, col, 1); seg(ctx, x, y - r, x, y + r, col, 1); }
      ctx.globalAlpha = 1;
    } });
    if (water && !this.app.reducedMotion) {
      const parts = [];
      for (let i = 0; i < 7; i++) parts.push({ x, y: y - 6, vx: (i - 3) * 22, vy: -80 - (i % 2) * 30, s: i % 3 ? 1 : 2 });
      this.fx.add({
        life: 0.35, layer: 1, parts,
        update: (dt, f) => { for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; } },
        draw: (ctx, f) => { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); for (const p of f.parts) { dot(ctx, p.x, p.y, p.s + 0.5, col); if (p.s > 1) dot(ctx, p.x, p.y, 1, PAL.white); } ctx.globalAlpha = 1; },
      });
    }
    this.snd('tick');
  }
  // 화약병 터짐(CHM-57): 먹은 칸 둘레 여덟 칸이 번쩍이고(터진 칸은 진하게) 네모 충격파가 퍼지며 불티가 튄다.
  // 세기 n = 터진 수: 불티 · 충격파 · 흔들림 · 글 크기가 커진다. 움직임 줄이기면 칸 빛과 글만
  blastFx(sq, hit) {
    const n = hit.length, set = new Set(hit), calm = this.app.reducedMotion;
    const f0 = sq & 7, r0 = sq >> 3, cells = [];
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      const f = f0 + df, r = r0 + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const s = r * 8 + f; cells.push({ sq: s, hot: s === sq || set.has(s) });
    }
    this.fx.add({ life: 0.28 + 0.03 * Math.min(6, n), layer: 1, draw: (ctx, e) => {
      const k = e.t / e.life;
      for (const c of cells) {
        ctx.globalAlpha = (c.hot ? 0.75 : 0.35) * (1 - k);
        fillSq(ctx, c.sq, c.hot ? (k < 0.3 ? PAL.goldHi : PAL.red) : PAL.red);
      }
      ctx.globalAlpha = 1;
    } });
    const { x, y } = this.center(sq);
    if (!calm) {
      const reach = 18 + 4 * Math.min(6, n);
      this.fx.add({ life: 0.3, layer: 1, draw: (ctx, e) => {
        const k = e.t / e.life, r = 6 + k * reach;
        ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = PAL.goldHi; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      } });
      const parts = [], m = 10 + 3 * Math.min(8, n);
      let seed = sq * 131 + n;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2 + rnd() * 0.4, sp = 60 + rnd() * (40 + 10 * n); parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, col: rnd() < 0.5 ? PAL.goldHi : PAL.red, s: rnd() < 0.3 ? 2 : 1 }); }
      this.fx.add({
        life: 0.5, layer: 1, parts,
        update: (dt, f) => { for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy = p.vy * 0.93 + 120 * dt; } },
        draw: (ctx, f) => { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); for (const p of f.parts) rect(ctx, p.x, p.y, p.s, p.s, p.col); ctx.globalAlpha = 1; },
      });
    }
    this.word('폭발', PAL.red, 1, n >= 6 ? 3 : 2);
    this.snd('boom', 0);
    this.shake(Math.min(3, 1 + Math.floor(n / 3)), 0.12 + 0.02 * Math.min(6, n));
    if (n >= 3) this.hitstop(0.06);
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
      const chips = pieceChips(p.t, 'w');
      for (let k = 0; k < 18; k++) {
        const card = k < 8, c = card ? null : chips[Math.floor(rnd() * chips.length)];
        const x = card ? r.x + 2 + rnd() * (r.w - 4) : r.x + Math.floor((r.w - 16) / 2) + c.x;
        const y = card ? r.y + 2 + rnd() * (r.h - 4) : r.y + Math.floor((r.h - 22) / 2) + 1 + c.y;
        parts.push({ x, y, vx: (x - (r.x + r.w / 2)) * 5 + (rnd() - 0.5) * 30, vy: -50 - rnd() * 60, col: card ? (rnd() < 0.5 ? PAL.light : PAL.cardHi) : c.col, s: rnd() < 0.35 ? 2.5 : 1.5, a: rnd() * 6 });
      }
    }
    this.fx.add({
      life: 0.45, layer: 1, parts,
      update: (dt, e) => { for (const q of e.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const q of e.parts) chip(ctx, q.x, q.y, q.s, q.s, q.col, q.a + e.t * 9); ctx.globalAlpha = 1; },
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
    const tag = boardTagRect(sq);
    const { x: cx, y: cy } = sqCenter(sq);
    this.lastBrilliantTag = { sq, ...tag };
    // 딱지는 칸 쪽에서 제자리로 튀어나온다: 처음엔 칸 가운데 쪽으로 6 비켜 있다(뒤집히면 반대쪽)
    const ox = tag.flipX ? 1 : -1, oy = tag.flipY ? -1 : 1;
    this.fx.add({
      life: 0.9, layer: 1, word: true, brilliant: true,
      draw: (ctx, f) => {
        const t = f.t, fade = t > 0.7 ? Math.max(0, (0.9 - t) / 0.2) : 1;
        ctx.globalAlpha = fade;
        strokeSq(ctx, sq, T.fill, 1);
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
  // 값 · 배수 몫은 칸 위 틈에 머물며 스러진다: 머리 칸과 값 칸 사이 틈(GAP_GROUP 8)은 글자 잉크(11)보다 좁아, 떠오르면 머리 칸 아랫변 ·
  // 점수 줄에 겹쳤다(CHM-67). 잉크 윗변을 머리 칸 아랫변 바로 밑에 두면 아래쪽(그림자까지)은 값 칸 윗테 · 안 여백에 걸치고 칸 안 수(VT)에는 닿지 않는다.
  // 상금은 아래 칸 상금 줄 위로 떠오른다(예전 그대로)
  pop(s, where, { col = null, delay = 0, dx = 0, align = 'center' } = {}) {
    // 안 3: 값 칸 위는 목표 막대라 몫은 값 칸 바로 아래 빈 자리에 머문다
    const lay = this.leftLayout(), vy = lay.val.y + VAL_H + 2;
    const pos = where === 'value' ? { x: LX + 24 + dx, y: vy } : where === 'mult' ? { x: LX + 88 + dx, y: vy } : { x: LX + LW - 20, y: shardTo().y - 6 };
    const rise = where === 'money' ? 10 : 0;
    const c = col || (where === 'value' ? PAL.val : PAL.gold);
    // 머무는 몫은 같은 자리에 겹치지 않게: 앞선 순간에 뜬 같은 칸의 몫은 새 몫이 뜰 때 지운다(같은 순간에 나란히 뜬 몫은 둔다)
    const now = this.app.time;
    if (!rise) for (const f of this.fx.list) if (f.popAt === where && f.born < now) f.t = f.life;
    this.fx.add({ life: 0.6 + delay, layer: 1, popAt: where, born: now, draw: (ctx, e) => { const t = e.t - delay; if (t < 0) return; const k = t / 0.6; text(ctx, s, pos.x, pos.y - (rise ? 6 + k * rise : 0), c, { align, bold: true, alpha: Math.min(1, k * 10) * (1 - k * k), shadow: PAL.shadow }); } });
  }
  // 배수 칸 위 몫 여럿(+N · ×N · 기보 +N)은 위로 쌓지 않고 한 줄에 나란히(배수 칸 가운데 기준, 왼쪽 칸 안). items = [[글, { col, delay }]]
  popRow(items) {
    if (!items.length) return;
    const ws = items.map(([s]) => measure(s, true)), total = ws.reduce((a, w) => a + w, 0) + 3 * (items.length - 1);
    let x = Math.min(LX + LW - 1 - total, Math.round(LX + 88 - total / 2));
    items.forEach(([s, o], i) => { this.pop(s, 'mult', { ...o, dx: x - (LX + 88), align: 'left' }); x += ws[i] + 3; });
  }
  // 기보 몫: 값 칸 위의 기본 몫(after) 바로 오른쪽에 청록 「+N」, 배수 칸 위에 청록 「+N」(배수 몫이 같이 뜨면 그 옆에 나란히) —
  // 기보 봉랍 빛깔, 조금 늦게. 먹은 칸에 청록 반짝. 한 수 연출 길이는 늘리지 않는다(fx만)
  // row: 같은 순간 배수 칸 위에 뜨는 다른 몫(+N · ×N) — 기보 몫은 그 줄 끝에 나란히
  chartShare(sq, value, mult, { after = null, row = [] } = {}) {
    const hi = SEAL.chart[1];
    if (value) {
      const s = `+${short(value)}`;
      const half = after ? Math.ceil(measure(after, true) / 2) + 2 : -Math.floor(measure(s, true) / 2);
      this.pop(s, 'value', { col: hi, delay: 0.08, dx: half, align: 'left' });
    }
    this.popRow(mult ? [...row, [`+${short(mult)}`, { col: hi, delay: 0.08 }]] : row);
    if (sq != null) this.sparkle(sq, hi, 8);
    const st = this.app.stats;
    if (st) st.chartPops = (st.chartPops || 0) + 1;
  }
  word(s, col, life = 1, scale = 2) {
    this.fx.add({
      life, layer: 1, word: true, band: { w: measure(s, true) * scale, y0: BY + 100 - scale * 6, y1: BY + 100 + scale * 6 },
      draw: (ctx, e) => {
        const k = e.t / e.life;
        const sc = k < 0.1 ? scale + 1 : scale;
        text(ctx, s, BX + 112, BY + 100 - (sc * 6), col, { align: 'center', bold: true, scale: sc, shadow: PAL.shadow, alpha: k > 0.7 ? (1 - k) / 0.3 : 1 });
      },
    });
  }
  // 굵은 잉크 테 이름표가 내 기물 위로 툭 튀어 올랐다(2.2배 → 1.5배) 사라진다. 기물을 따라가고, 다음에 잡을 적 칸을 덮지 않는 쪽(위 · 왼쪽 · 오른쪽 · 아래)에 선다.
  // 새 이름표가 뜨면 앞 이름표는 곧바로 접는다(한 번에 하나)
  formName(sq, t) {
    const s = `${PIECE_NAME[t]}!`, calm = this.app.reducedMotion;
    for (const f of this.fx.list) if (f.formName && f.t < f.life - 0.1) f.t = f.life - 0.1;
    let at = this.center(sq);
    // 피할 것: 새 모습으로 닿는 적(보이는 판) — 칸 바닥에서 기물 머리까지
    const vb = this.view.board, targets = [];
    try { for (const q of reach(vb, t, sq, 1)) if (vb[q] && !vb[q].mine) { const b = sqBox(q); targets.push({ x: b.x, y: b.y - PIECE_TOP, w: b.w, h: b.h + PIECE_TOP }); } } catch { /* 모르는 모습 */ }
    const BASE = 1.5;
    this.fx.add({
      life: 0.95, layer: 1, formName: true,
      draw: (ctx, e) => {
        const now = this.pieceXY();
        if (now) at = now; else if (e.t < e.life - 0.12) e.t = e.life - 0.12; // 사슬이 끝나 기물이 판을 떠나면 곧 접는다
        const k = e.t / e.life;
        const sc = calm ? BASE : BASE + Math.max(0, 1 - e.t / 0.14) * 0.7 + (e.t < 0.14 ? 0 : Math.max(0, 0.2 - (e.t - 0.14) * 2));
        const w = measure(s, true) * sc, h = INK_H * sc;
        const rise = calm ? 0 : ease.out(Math.min(1, k * 1.6)) * 3;
        // 자리 후보: 기물 머리 위 · 왼쪽 · 오른쪽 · 받침 아래. 다음 먹이 칸(bbox)과 덜 겹치는 첫 자리
        const top = at.y - PIECE_TOP - 2 - h - rise, mid = at.y - PIECE_TOP / 2 - h / 2;
        const cands = [[at.x, top], [at.x - 14 - w / 2, mid], [at.x + 14 + w / 2, mid], [at.x, at.y + 8]];
        const hit = (cx, cy) => targets.reduce((u, b) => u + Math.max(0, Math.min(cx + w / 2, b.x + b.w) - Math.max(cx - w / 2, b.x)) * Math.max(0, Math.min(cy + h, b.y + b.h) - Math.max(cy, b.y)), 0);
        let best = cands[0], bestHit = hit(...cands[0]);
        for (const c of cands.slice(1)) { if (bestHit <= 0) break; const u = hit(...c); if (u < bestHit) { best = c; bestHit = u; } }
        let y = Math.max(1, Math.min(270 - h - 1, best[1]));
        const x = Math.max(2 + w / 2, Math.min(W - 2 - w / 2, best[0]));
        // 판 가운데 큰 글자(「프로모션」 · 「목표 달성」)가 떠 있으면 그 띠 밖으로 비킨다: 위에 자리가 있으면 위, 없으면 아래
        for (const f of this.fx.list) {
          const b = f.word && f.band;
          if (!b || f.t >= f.life || Math.abs(x - (BX + 112)) >= (w + b.w) / 2 + 2 || y > b.y1 + 2 || y + h < b.y0 - 2) continue;
          y = b.y0 - h - 4 >= 1 ? b.y0 - h - 4 : b.y1 + 4;
        }
        const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
        boldText(ctx, s, x, y, e.t < 0.08 && !calm ? PAL.white : PAL.goldHi, { scale: sc, alpha: fade, edgeW: 1 / sc + 0.4 });
      },
    });
  }
  // 내 기물이 지금 서 있는(움직이는) 자리의 가운데. 사슬이 끝났으면 없음
  pieceXY() {
    const v = this.view;
    if (v.mover) { const a = this.center(v.mover.from), b = this.center(v.mover.to), p = Math.max(0, Math.min(1, v.mover.p || 0)); return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) }; }
    return v.chain && v.chain.sq != null ? this.center(v.chain.sq) : null;
  }
  // 먹힌 킹이 천천히 쓰러진다
  topple(sq) {
    const { x, y } = sqCenter(sq);
    this.fx.add({
      life: 1.0, layer: 1,
      draw: (ctx, e) => {
        const k = Math.min(1, e.t / 0.55);
        const ang = (k * k) * Math.PI / 2;
        ctx.save();
        ctx.globalAlpha = e.t < 0.7 ? 1 : Math.max(0, 1 - (e.t - 0.7) / 0.3);
        ctx.translate(x + 6, y);
        ctx.rotate(ang);
        ctx.imageSmoothingEnabled = true; // 쓰러지는 킹(구운 그림을 돌린다)
        const c = pieceCanvas('K', 'b');
        ctx.drawImage(c.cv, -6 - c.ox, -c.oy, c.w, c.h);
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
      draw: (ctx, e) => { for (const p of e.parts) { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life) * (Math.floor(e.t * 20 + p.x) % 3 ? 1 : 0.4); dot(ctx, p.x, p.y, 1.2, p.c); } ctx.globalAlpha = 1; },
    });
  }
  // 점수 칸의 불꽃: 목표를 넘기면 붙고, 넘친 층(×2 · ×5 · ×10)마다 세진다
  updateFlames(dt) {
    const v = this.view;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const tier = v.target ? overflowTier(score, v.target) : 0;
    this.flames = (this.flames || []).filter((f) => (f.t += dt) < f.life);
    this.flameOn = !!tier && !this.app.reducedMotion;
    if (!this.flameOn) return;
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
  rightDown(x, y) { this.marks.down(sqAt(x, y, this.pick)); }
  rightUp(x, y) { this.marks.up(sqAt(x, y, this.pick)); }
  pointerDown(x, y) { if (this.combo) return; this.idleT = 0; if (x != null && sqAt(x, y, this.pick) >= 0) this.marks.clear(); }
  // 손이 들썩일 때(한동안 아무것도 들지 않으면 — drawRight)
  nudging() { const b = this.live(); return !!(b && b.status === 'play' && !this.busy && !this.sel.length && this.idleT > 2.5); }
  // 그릴 때만 그린다: 연출 · 띠 · 도장 · 불꽃 · 복기 셈 동안, 그리고 손 들썩임이 막 켜지거나 꺼질 때. 시간 따라 바뀌는 그림은 그릴 때 live · beat를 부른다
  animating() {
    return this.busy || !!this.intro || !!(this.falls && this.falls.size) || !!this.glow || !!this.ring || !!this.banner || !!this.stamp
      || !!this.flameOn || !!(this.flames && this.flames.length) || !!(this.rv && this.rv.phase === 'think') || this.nudging() !== !!this.nudgeOn;
  }
  // 점화 막간 닫기(탭 · 키 · 저절로)
  closeCombo() { if (!this.combo) return; this.combo = null; this.afterSeq(); }
  update(dt) {
    this.idleT = (this.idleT || 0) + dt;
    if (this.rv && this.rv.phase === 'think' && !this.busy) this.thinkReview(dt);
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
    if (this.intro) { const was = this.intro.t; this.intro.t += dt; if (was < 0.26 && this.intro.t >= 0.26) this.shake(2, 0.15); if (this.intro.t >= this.intro.life) this.endIntro(); }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.stamp) { this.stamp.t += dt * this.app.speed(); if (this.stamp.t > this.stamp.life) this.stamp = null; }
    if (this.combo) {
      const g = this.combo, was = g.t, land = comboLand(g.calm);
      g.t += dt;
      if (!g.calm && was < land && g.t >= land) { this.shake(2, 0.15); this.snd('ignite'); }
      if (g.t >= comboClose(g.calm)) this.closeCombo();
    }
  }

  // ── 그리기
  draw(ctx, ui) {
    this.drawBoard(ctx, ui);
    this.drawLeft(ctx, ui);
    this.drawRight(ctx, ui);
    this.drawOver(ctx);
    if (this.rv) this.drawReview(ctx, ui);
    // 점화 막간: 화면을 덮는 구역 하나가 모든 누르기를 받아 막간을 닫는다(밑의 단추 · 칸은 눌리지 않는다)
    if (this.combo) {
      drawCombo(ctx, this.combo, { BX, BY, S, center: sqCenter, board: boardGeo().bounds });
      ui.region('ignite', 0, 0, W, H, { onClick: () => this.closeCombo() });
    }
    // 마스터 등장: 온 화면을 덮는 구역 하나가 누르기를 받아 넘긴다
    if (this.intro) {
      this.drawIntro(ctx, this.intro);
      ui.region('intro', 0, 0, W, H, { onClick: () => this.endIntro() });
      pauseButton(ctx, ui, this.app); // 멈춤 단추는 등장 장면 위에(누르면 곧바로 멈춤이 열린다)
    }
    if (this.src.kind === 'run') this.coachHints();
  }
  endIntro() {
    if (!this.intro) return;
    if (this.banner && this.banner.from != null) this.banner.from = Math.min(this.banner.from, this.banner.t);
    this.intro = null;
    this.app.invalidate();
  }
  // 마스터 등장 장면(28절): 세력 빛깔 바탕 · 붉은 위아래 줄, 64×64 초상을 두 배로(왼쪽에서 들어온다), 「마스터」 · 이름(세 배) · 별칭, 규칙 띠(오른쪽에서 들어온다).
  // 움직임 줄이기면 미끄러짐 · 번쩍 · 흐르는 줄 없이 그대로 선다
  drawIntro(ctx, it) {
    const M = MASTER_BY_ID[it.id], calm = this.app.reducedMotion, t = it.t;
    const a = Math.min(1, t / 0.12, (it.life - t) / 0.18);
    if (!calm || a < 1) motion();
    const slide = (d, dur) => (calm ? 1 : ease.out(Math.max(0, Math.min(1, (t - d) / dur))));
    openBox('fx', 0, 0, W, H, 0, { loose: true, name: '마스터 등장' });
    ctx.globalAlpha = Math.max(0, a) * 0.96;
    rect(ctx, 0, 0, W, H, PAL.feltDk);
    ctx.globalAlpha = Math.max(0, a);
    // 흐르는 줄: 판 어두운 칸 빛깔 가는 줄이 오른쪽으로 지나간다
    if (!calm) { ctx.globalAlpha = Math.max(0, a) * 0.22; for (let i = 0; i < 9; i++) { const y = 46 + i * 21, len = 40 + (i * 37) % 70, x = ((t * (260 + i * 30) + i * 97) % (W + len)) - len; rect(ctx, x, y, len, 2, PAL.dark); } ctx.globalAlpha = Math.max(0, a); }
    rect(ctx, 0, 36, W, 3, PAL.red); rect(ctx, 0, H - 39, W, 3, PAL.red);
    // 초상: 왼쪽에서 들어와 선다(테 상자 안)
    const px = Math.round(-150 + 186 * slide(0.02, 0.24)), py = 62;
    box(ctx, px - 4, py - 4, 136, 136, PAL.well, PAL.red);
    fine(() => drawPortrait(ctx, it.id, px, py, 4));
    // 이름 · 별칭: 오른쪽에서
    const tx = Math.round(190 + (1 - slide(0.1, 0.24)) * 220);
    text(ctx, '마스터', tx, 66, PAL.red, { bold: true, scale: 2 });
    const room = W - 190 - 8, ns = [3, 2, 1].find((k) => measure(M.name, true) * k <= room) || 1;
    boldText(ctx, M.name, tx, 92 + (3 - ns) * 6, PAL.goldHi, { align: 'left', scale: ns });
    text(ctx, `「${L(M.rule)}」`, tx, 132, PAL.gold, { bold: true }); // 별칭만 옮긴다(괄호를 붙인 글은 표에 없다)
    // 규칙 띠: 붉은 띠가 오른쪽에서 밀려 들어오고 규칙 글이 선다
    const lines = wrap(M.text, W - 190 - 16).slice(0, 3);
    const bh = 8 + lines.length * LINE, by = 158, bx = Math.round(176 + (1 - slide(0.2, 0.22)) * 320);
    rect(ctx, bx, by, W - bx + 8, bh, PAL.redDk); rect(ctx, bx, by, 3, bh, PAL.red);
    lines.forEach((l, i) => text(ctx, l, bx + 14, by + 4 + i * LINE, PAL.ink));
    // 들어서는 순간 흰 번쩍
    if (!calm && t < 0.34 && t > 0.22) { ctx.globalAlpha = 0.5 * (1 - (t - 0.22) / 0.12); rect(ctx, 0, 0, W, H, PAL.white); }
    ctx.globalAlpha = 1;
    closeBox();
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
    // 다음 수(CHM-60): 덱 맨 앞이 보일 때
    if ((v.next || []).length) hint(app, 'next', 'next');
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
    else motion();
    return b.v;
  }
  // 건너뛴 프레임: 막대 끝이 따라가는 시각만 옮긴다(app.frame — 늘 그릴 때와 같은 걸음)
  settle(time) { if (this.bar) this.bar.t = time; }

  // 목표는 막대로(왼쪽 칸 점수 아래 — 안 3): 지금 점수는 채움, 이번 사슬로 얻을 몫(값 × 배수)은 빗금으로 미리 차오른다.
  // 목표를 넘기면 막대가 ×2 · ×5 · ×10 눈금으로 늘어나고 채움 끝에 불이 붙는다.
  // 사슬 중에는 막대 끝을 늘 다음 눈금에 둔다: 목표를 넘겨도 막대가 꽉 차지 않고 다음 눈금까지 계속 차오른다
  // (대국은 사슬이 끝난 뒤에 끝난다 — 규칙과 같다). 눈금이 바뀌면 막대는 한 번에 튀지 않고 늘어난다. 얻을 몫(+N)은 「점수」 이름표 줄 오른쪽
  // 얻을 몫(이번 사슬의 값 × 배수): 「점수」 이름표 줄 오른쪽(몫이 오를 때 잠깐 밝아진다 · 목표를 넘길 몫이면 더 밝다)
  drawGain(ctx, lay) {
    const v = this.view, tgt = v.target, time = this.app.time;
    if (!tgt || this.hideGain) return;
    const going = !!v.chain && !v.gather;
    const live = going ? Math.floor(v.chain.value * v.chain.mult) : v.gather && !v.count ? v.gather.score : 0;
    if (live <= 0) return;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const gs = `+${fitNum(live, LW / 2)}`, gsw = measure(gs, true), gy = lay.scoreLab;
    glowText(ctx, LX + LW - PX - gsw, gy, gsw, 12, PAL.gold, (score + live >= tgt ? 0.45 * flicker(time, 5) : 0.2) + this.pulseAt('gain', live, time) * 0.5, 8);
    text(ctx, gs, LX + LW - PX, gy, PAL.gold, { align: 'right', bold: true, shadow: PAL.shadow });
  }
  drawGoalBar(ctx, lay = this.leftLayout()) {
    const v = this.view, tgt = v.target;
    if (!tgt) return;
    const time = this.app.time;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const going = !!v.chain && !v.gather;
    const live = going ? Math.floor(v.chain.value * v.chain.mult) : v.gather && !v.count ? v.gather.score : 0;
    const total = score + live;
    const maxMul = BAR_TIERS.find((m) => (going ? total < m * tgt : total <= m * tgt)) ?? BAR_TIERS[BAR_TIERS.length - 1];
    const maxV = this.barScale(tgt * maxMul, time);
    const X = LX + 1, Y = lay.bar.y, Wd = LW - 2, Hh = lay.bar.h;
    // 목표 막대를 빈 상자로 적는다(막대 테) — smoke 「글 넘침」이 알림 · 다른 글과 겹치면 잡는다(CHM-48)
    openBox('tile', X - 1, Y - 1, Wd + 2, Hh + 2, 0, { name: '목표 막대' });
    closeBox();
    this.app.ui.region('goal', X - 1, Y - 3, Wd + 2, Hh + 6, { tip: () => tipLines(`목표 ${num(tgt)}`, '콤보가 끝났을 때 점수가 목표를 넘으면 이겨요. 넘치면 ×2 · ×5 · ×10 눈금까지 늘어나요') });
    if (score >= tgt) glow(ctx, X, Y, Math.round(Wd * Math.min(1, score / maxV)), Hh, PAL.gold, 0.3 * flicker(time, 4), 5);
    // 둥근 막대: 깊은 남색 + 옅은 테(빈 자리와 같은 결), 채움은 금빛 둥근 판
    rrect(ctx, X - 1, Y - 1, Wd + 2, Hh + 2, (Hh + 2) / 2, PAL.slotEdge);
    rrect(ctx, X, Y, Wd, Hh, Hh / 2, PAL.slot);
    const fill = Math.round(Wd * Math.min(1, score / maxV));
    const hot = score >= tgt;
    if (fill > 0) rrect(ctx, X, Y, Math.max(fill, Hh), Hh, Hh / 2, hot ? PAL.gold : PAL.goldDk);
    const gw = Math.round(Wd * Math.min(1, total / maxV)) - fill;
    if (gw > 0) {
      // 얻을 몫: 둥근 막대 안을 흐르는 금빛 사선(벡터)
      const hk = beat(time, 8);
      ctx.save(); ctx.beginPath(); ctx.rect(X + fill, Y, gw, Hh); ctx.clip();
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = -Hh - 3 + (hk % 3); i < gw + 3; i += 3) { ctx.moveTo(X + fill + i, Y + Hh); ctx.lineTo(X + fill + i + Hh, Y); }
      ctx.stroke(); ctx.restore();
    }
    // 눈금: 목표(×1)는 흰 막대(사슬 중에 넘기면 금빛으로 깜빡인다), 넘친 층은 붉은 막대 + 작은 숫자(막대 아래)
    const passed = going && total >= tgt && beat(time, 6) % 2 === 0;
    for (const m of BAR_TIERS) {
      if (m * tgt > maxV + 0.5) break;
      const tx = X + Math.round((Wd * m) / maxV * tgt) - 1;
      rect(ctx, tx, Y - 2, 2, Hh + 4, m === 1 ? (passed ? PAL.goldHi : PAL.white) : PAL.red);
      if (m > 1) digits(ctx, `${m}`, tx - 2 * String(m).length, Y - 7, PAL.red);
    }
    if (hot && !this.app.reducedMotion) {
      motion();
      const ex = X + fill;
      for (let i = 0; i < 6; i++) {
        const k = (time * 3 + i / 6) % 1;
        rect(ctx, ex - 4 + ((i * 5) % 9) - Math.round(Math.sin(time * 9 + i) * 1.5), Y - 1 - Math.round(k * 7), k < 0.4 ? 2 : 1, k < 0.4 ? 2 : 1, k < 0.3 ? PAL.goldHi : k < 0.6 ? PAL.gold : PAL.red);
      }
    }
  }

  drawBoard(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, time = app.time;
    // 판: 그림자 · 두께 · 크림 테 · 칸 · 좌표를 한 번 구운 그림(board3.js). 다른 땅에 왔다는 표지는 판 어두운 칸 빛깔(세력 모습)
    drawBoardImage(ctx, scaleOf(ctx));
    // 사슬 평가의 테두리 불빛: 흰 → 금 → 붉은 금 → 무지개. 사슬이 끝나면 사그라든다
    if (this.glow) {
      motion();
      const g = this.glow;
      const a = Math.max(0, 1 - g.fade / 0.6) * (0.75 + 0.25 * Math.sin(time * 10));
      const hue = Math.floor(time * 360) % 360;
      const cols = { '★': [PAL.white], '★★': [PAL.gold, PAL.goldHi], '★★★': [PAL.red, PAL.gold, PAL.red], '∞': [`hsl(${hue},85%,60%)`, `hsl(${(hue + 90) % 360},85%,60%)`, `hsl(${(hue + 180) % 360},85%,60%)`] }[g.mark];
      ctx.globalAlpha = a;
      cols.forEach((c, i) => { boardPath(ctx, RIM, 2 + i * 2); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    if (this.ring) {
      const k = this.ring.t / this.ring.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      boardPath(ctx, RIM, 6 + Math.round(k * 10)); ctx.strokeStyle = this.ring.col; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const t = this.clickable();
    const tset = new Set(t.list);
    const forced = v.chain && v.chain.forced ? new Set(v.chain.forced) : null;
    const openKings = b.hints && b.hints.openKings ? new Set(b.hints.openKings) : null;
    // 증원 그림자: 이번 수 뒤(k 0) · 그다음 수 뒤(k 1)
    const ghosts = new Map();
    visibleIncoming(b).forEach((wave, k) => { for (const r of wave || []) if (!v.board[r.sq] && !isHidden(b, r.sq) && !ghosts.has(r.sq)) ghosts.set(r.sq, { t: r.t, k }); });
    // 누르기: 아래 기물 층에서 그리는 기물 · 사물이 선 칸은 그 몸도 가진다(증원 그림자는 바닥)
    const pick = (this.pick = picker((sq) => {
      const c = v.board[sq];
      if (!c || (isHidden(b, sq) && !c.mine) || (c.mine && v.mover)) return 0;
      return THINGS.has(c.t) ? thingTop(c.t) : PIECE_UP;
    }));
    this.drawBoardThings(ctx, b.rules, time);
    // ── 바닥(칸 위 표시): 기물보다 먼저 — 정면 판에서도 뒤 칸 기물이 앞 칸에 걸치므로 칸 표시는 모두 이 층에서
    for (let sq = 0; sq < 64; sq++) {
      const r = sq >> 3;
      if (isHidden(b, sq)) {
        fillSq(ctx, sq, PAL.fog);
        clipSq(ctx, sq, (bx) => { for (let k = 0; k < bx.h; k += 3) rect(ctx, bx.x + ((k * 3 + (r * 2)) % bx.w), bx.y + k, 2, 1, PAL.fogHi); });
      }
      const id = `sq:${sq}`;
      const g = ghosts.get(sq);
      let tip = g ? [`증원 · ${PIECE_NAME[g.t]}`, [g.k ? '두 수 뒤에 들어와요' : '이번 수 뒤에 들어와요']] : null;
      if (forced && forced.has(sq) && !v.cut && !this.busy && !isHidden(b, sq)) tip = ['지키는 적', [t.kind === 'capture' && tset.has(sq) ? '이 적을 잡아야 콤보가 이어져요' : '지금 모습으로는 잡을 수 없어요']];
      const cell = v.board[sq];
      // 적 기물: 특성 · 특수 기물은 늘, 체스 기물은 지금 누를 칸이 아닐 때만(누를 칸은 먹기 미리 보기가 말한다). 행마 그림을 곁들인다
      let diag = null;
      if (!tip && cell && !cell.mine && cell.trait && !isHidden(b, sq)) { const tr = TRAIT_BY_ID[cell.trait]; tip = [`${tr.name} · ${PIECE_NAME[cell.t]}`, [tr.text, PIECE_MOVE[cell.t] || '']]; diag = cell.t; }
      if (!tip && cell && !cell.mine && (FAIRY_MOVE(cell.t) || (PIECE_MOVE[cell.t] && !tset.has(sq))) && !isHidden(b, sq)) { tip = [PIECE_NAME[cell.t], [PIECE_MOVE[cell.t]]]; diag = cell.t; }
      if (cell && !cell.mine && cell.muted && !isHidden(b, sq)) tip = tip ? [tip[0], [...tip[1], `횃불: ${L('아무것도 지키지 못해요')}`]] : [`횃불 · ${PIECE_NAME[cell.t]}`, ['아무것도 지키지 못해요']];
      // 외통 조건: 지키던 적을 둘 잡은 콤보에서는 킹을 가리키면 까닭을 말한다
      const shut = cell && !cell.mine && cell.t === 'K' && !this.busy && b.status === 'chain' && mateBlocked(b.chain) && !b.rules.openKings && !isHidden(b, sq);
      // 행마 글 · 그림만 까닭 줄로 갈아 끼운다. 특성 글(이 콤보로는 못 잡아 덜 쓸모 있다)이 체크메이트 낱말 상자를 밀어낼 때만 뺀다
      if (shut) {
        const tr = cell.trait && TRAIT_BY_ID[cell.trait];
        const torch = cell.muted && (tr ? `횃불: ${L('아무것도 지키지 못해요')}` : '아무것도 지키지 못해요');
        const head = tr ? `${tr.name} · ${PIECE_NAME.K}` : cell.muted ? `횃불 · ${PIECE_NAME.K}` : PIECE_NAME.K;
        const full = [KING_SHUT, tr && tr.text, torch].filter(Boolean), lean = [KING_SHUT, torch].filter(Boolean);
        const fits = (body, more) => tipHeight(tipLines(head, body), SIDE_W) + more <= NOTE_ROOM, box = NOTE_GAP + keyHeight('mate', SIDE_W);
        tip = [head, !tr || fits(full, box) || (!fits(lean, box) && fits(full, 0)) ? full : lean];
        diag = null;
      }
      // 판 위 사물(발판 · 문 · 고속도로 줄): 칸 자체가 스스로 풀이한다. 적이 서 있으면 그 풀이 아래에 한 줄 더
      const objs = isHidden(b, sq) ? [] : objectsAt(b.rules, sq);
      if (objs.length) tip = tip ? [tip[0], [...tip[1], ...objs.map((o) => o[1])]] : [objs.map((o) => o[0]).join(' · '), objs.map((o) => o[1])];
      const tipOpt = tip ? sqTip(tip[0], tip[1], diag) : null;
      // 낱말 상자: 말풍선 제목이 곧 낱말인 것(증원 · 지키는 적 · 특성 · 벽 · 보석 · 특수 기물)
      if (tipOpt) tipOpt.keys = [g && { id: 'reinforce' }, forced && forced.has(sq) && { id: 'threat' }, shut && { id: 'mate' }, cell && !cell.mine && cell.trait && { id: 'trait' }, cell && cell.t === 'X' && { id: 'wall' }, cell && cell.t === 'J' && { id: 'gem' }, cell && !cell.mine && isFairy(cell.t) && { id: 'fairy' }, shut && { skip: 'threat' }].filter(Boolean); // 「지키던 적」에 응수 낱말 상자를 붙이지 않고 체크메이트 풀이를 띄운다
      // 누르는 구역: 칸 + 몸 높이 상자, 판정은 그린 판의 누르기(앞 기물 몸 → 바닥 칸)
      const bx = hitBox(sq);
      ui.region(id, bx.x, bx.y, bx.w, bx.h, { hit: (x, y) => pick(x, y) === sq, onClick: () => this.clickSq(sq), ...tipOpt });
      if (tset.has(sq) && t.kind !== 'capture') {
        motion();
        const pulse = 0.22 + 0.12 * Math.sin(time * 5);
        ctx.globalAlpha = pulse; fillSq(ctx, sq, PAL.gold); ctx.globalAlpha = 1;
        strokeSq(ctx, sq, PAL.goldHi, 1, 1);
      }
      if (ui.isHover(id) && tset.has(sq)) strokeSq(ctx, sq, PAL.white, 1);
      if (!cell || cell.mine || isHidden(b, sq)) continue;
      if (openKings && openKings.has(sq) && cell.t === 'K') {
        motion();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4); strokeSq(ctx, sq, PAL.gold, 1, 2); ctx.globalAlpha = 1;
      }
      if (forced && forced.has(sq)) {
        if (beat(time, 6) % 2 === 0) strokeSq(ctx, sq, PAL.red, 2);
        ctx.globalAlpha = 0.25; fillSq(ctx, sq, PAL.red); ctx.globalAlpha = 1;
        hatch(ctx, sq, PAL.redDk);
      }
      // 얼린 적(묘수 「빙결」): 얼음빛 바닥 · 이번 수 동안 아무것도 지키지 못한다
      if (cell.frozen) { ctx.globalAlpha = 0.35; fillSq(ctx, sq, '#9fd3e0', 2); ctx.globalAlpha = 1; strokeSq(ctx, sq, '#9fd3e0', 1, 1); }
      if (t.kind === 'capture' && tset.has(sq) && ui.isHover(id)) strokeSq(ctx, sq, PAL.white, 1);
    }
    drawMarkSquares(ctx, this.marks, fillSq);
    // 증원 그림자의 바닥: 붉은 점선 칸(두 수 앞은 흐린 점선)
    for (const [sq, g] of ghosts) strokeSq(ctx, sq, g.k ? PAL.dimDk : PAL.red, 1, 2, g.k ? [1, 2] : [3, 2]);
    // 사슬 길
    if (v.chain) {
      // 꺾쇠 · 물수제비의 길은 꺾은 칸(bends)을 거쳐 꺾여 그린다 — 꺾은 칸에는 작은 금빛 점
      const path = v.chain.path, bends = v.chain.bends || [];
      for (let i = 1; i < path.length; i++) strokeSq(ctx, path[i], PAL.gold, 1);
      for (let i = 0; i + 1 < path.length; i++) {
        const pts = [path[i], ...(bends[i + 1] || []), path[i + 1]];
        for (let j = 0; j + 1 < pts.length; j++) { const a = this.center(pts[j]), c = this.center(pts[j + 1]); seg(ctx, a.x, a.y, c.x, c.y, PAL.gold); }
        for (const k of bends[i + 1] || []) { const c = this.center(k); rect(ctx, c.x - 1, c.y - 1, 3, 3, PAL.goldHi); }
      }
      for (const [a0, b0] of v.chain.shots || []) { const a = this.center(a0), c = this.center(b0); dotLine(ctx, a.x, a.y, c.x, c.y, PAL.gold, 2); strokeSq(ctx, b0, PAL.gold, 1, 0, [1, 1]); }
    }
    // 지금 모습의 행마선: 다음 먹기를 기다릴 때 갈 수 있는 칸을 흐리게(막히면 끊긴다)
    if (v.chain && !this.busy && !v.chain.awaiting && !v.cut && b.status === 'chain') {
      this.drawReach(ctx, v.chain.form, v.chain.sq);
      for (const f of v.chain.absorbed || []) this.drawReach(ctx, f, v.chain.sq);
    }
    // 끊김 · 응수 칸의 바닥
    if (v.cut) { strokeSq(ctx, v.cut.sq, PAL.red, 2); hatch(ctx, v.cut.sq, PAL.red); }
    if (v.chain && v.chain.forced && !v.cut && beat(time, 6) % 2 === 0) strokeSq(ctx, v.chain.sq, PAL.red, 2);
    // ── 기물: 뒤에서 앞으로(칸 가운데의 화면 y). 증원 그림자의 흐린 적도 같은 차례에 선다
    for (const sq of sqOrder()) {
      const { x, y } = sqCenter(sq);
      const g = ghosts.get(sq);
      if (g) this.drawGhost(ctx, sq, g, x, y, time);
      const c = v.board[sq];
      if (!c) continue;
      if (isHidden(b, sq) && !c.mine) continue;
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
        this.putPiece(ctx, c.t, side, x, y + dy, { sx, alpha, ...lk }, -dy);
        if (v.cut && v.cut.sq === sq) this.drawCrack(ctx, sq);
        continue;
      }
      let dy = 0;
      if (t.kind === 'capture' && tset.has(sq)) dy = beat(time, 4, sq * 0.37) % 2 ? -2 : -1;
      if (this.falls && this.falls.has(sq)) { const p = this.falls.get(sq) / FALL; dy -= (1 - p * p) * FALL_PX; }
      // 금빛 적: 몸 뒤에 은은한 금빛(천천히 숨 쉰다)
      if (c.gold) glowText(ctx, x - 9, y - PIECE_TOP + dy, 18, 22, PAL.gold, 0.45 * flicker(time + sq, 2.4, 0.3), 5);
      this.putPiece(ctx, c.t, c.gold ? 'g' : 'b', x, y + dy, {}, -dy);
      if (c.trait) traitMark(ctx, c.trait, x - 12, y - 1);
      if (c.muted) torchMark(ctx, x + 6, y - PIECE_TOP - 2, time);
      if (c.gold) {
        const k = beat(time, 8, sq) % 12;
        if (k < 3) dot(ctx, x - 7.25 + k * 5, y - PIECE_TOP + 1.75 + k * 4 + dy, 1.5, PAL.goldHi);
      }
    }
    // 궁수의 화살
    if (v.arrow) {
      const a = this.bodyOf(v.arrow.from), c = this.bodyOf(v.arrow.to), k = v.arrow.p;
      const x = a.x + (c.x - a.x) * k, y = a.y + (c.y - a.y) * k - Math.sin(k * Math.PI) * 6;
      const tx = a.x + (c.x - a.x) * Math.max(0, k - 0.15), ty = a.y + (c.y - a.y) * Math.max(0, k - 0.15) - Math.sin(Math.max(0, k - 0.15) * Math.PI) * 6;
      seg(ctx, tx, ty, x, y, PAL.goldHi);
      rect(ctx, Math.round(x) - 1, Math.round(y) - 1, 2, 2, PAL.white);
    }
    // 움직이는 내 기물(맨 위 — 지나는 칸의 앞 기물보다 앞에 선다)
    if (v.mover) {
      const m = routeXY(v.mover);
      // 꺾는 길: 지나온 몫을 흐린 금빛 선으로 끌고 간다
      if (v.mover.route && v.mover.route.kind === 'bend') {
        const pts = v.mover.route.pts, at = routeAt(pts, v.mover.p);
        let a = this.center(pts[0]);
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < at.i; i++) { const b = this.center(pts[i + 1]); seg(ctx, a.x, a.y, b.x, b.y, PAL.goldHi); a = b; }
        seg(ctx, a.x, a.y, Math.round(m.x), Math.round(m.y + (m.arc || 0)), PAL.goldHi);
        ctx.globalAlpha = 1;
      }
      // 그림자는 뛰는 호 밑 바닥 자리에(뛰면 작아지고 옅어진다)
      this.putPiece(ctx, v.mover.form, 'w', m.x, m.y, this.look(v.mover.form, time), Math.max(0, m.arc || 0));
    }
    // 노림수: 내 기물을 노리는 적에서 붉은 끊어진 선이 내 기물 쪽으로 흐른다(먹을 수 없는 적은 어두운 붉은색).
    // 기물 몸 높이에 긋되, 양 끝은 기물 몸을 비켜 칸 가장자리 쪽만
    if (forced && !v.cut) {
      const c = this.bodyOf(v.chain.sq);
      const off = this.app.reducedMotion ? 0 : beat(time, 12);
      for (const s of forced) {
        if (isHidden(b, s)) continue;
        const a = this.bodyOf(s);
        const d = Math.hypot(c.x - a.x, c.y - a.y), k = 10 / d;
        if (d < 24) continue;
        dashLine(ctx, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, c.x - (c.x - a.x) * k, c.y - (c.y - a.y) * k, t.kind === 'capture' && tset.has(s) ? PAL.red : PAL.redDk, off);
      }
    }
    this.drawPreview(ctx, ui);
    // 끊김: 노린 적에서 붉은 선
    if (v.cut) {
      const c = this.bodyOf(v.cut.sq);
      for (const s of v.cut.attackers) { const a = this.bodyOf(s); seg(ctx, a.x, a.y, c.x, c.y, PAL.red); }
    }
    // 판 위 화살표(오른쪽으로 끌어 그은 것): 기물 위에 반투명. 끄는 중이면 가리킨 칸까지 흐리게
    const mk = this.marks, to = mk.from >= 0 ? sqAt(ui.mouse.x, ui.mouse.y, this.pick) : -1;
    drawMarkArrows(ctx, mk, centerAt, to >= 0 && to !== mk.from ? { from: mk.from, to } : null);
  }
  // 증원 그림자: 그 적 빛깔로 흐리게(속이 비친다) + 붉은 ▼(흔들린다). 두 수 앞은 더 흐리게
  drawGhost(ctx, sq, g, x, y, time) {
    const a = g.k ? 0.3 : 0.5;
    piece3(ctx, g.t, 'b', x, y, { alpha: a });
    const bob = beat(time, 3, sq * 0.37) % 2, ty = y - PIECE_TOP - 7 + bob;
    ctx.globalAlpha = g.k ? 0.5 : 1;
    ctx.beginPath(); ctx.moveTo(x - 3.5, ty); ctx.lineTo(x + 3.5, ty); ctx.lineTo(x, ty + 5); ctx.closePath();
    ctx.fillStyle = PAL.red; ctx.fill(); ctx.strokeStyle = INK3; ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 끊긴 내 기물 위 붉은 금(칸 반 폭 · 반 높이 단위로)
  drawCrack(ctx, sq) {
    const c = sqCenter(sq), G = boardGeo();
    const pt = (u, w) => [c.x + u * G.hw, c.y - 10 + w * 12];
    const p = [pt(-0.6, -0.6), pt(-0.1, 0), pt(-0.3, 0.35), pt(0.55, 0.8)];
    for (let i = 0; i + 1 < p.length; i++) seg(ctx, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], PAL.red);
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
      box(ctx, x, ty, 15, 15, PAL.well, ui.isHover(id) && ok ? PAL.gold : PAL.frameDk);
      ctx.save(); ctx.translate(x + 1, ty + 2); ctx.scale(0.8, 0.8); tacticIcon(ctx, c.id, 0, 0); ctx.restore();
    });
  }
  useTactic(i) {
    let ev;
    try { ev = this.app.cmd({ type: 'tactic', index: i }); } catch { this.toast('지금은 할 수 없어요', PAL.red); return; }
    this.sync();
    for (const e of ev) {
      if (e.type === 'freeze') { for (const sq of e.squares) this.sparkle(sq, '#9fd3e0', 8); this.word('빙결', '#9fd3e0', 1.2, 1); this.snd('glass'); }
      if (e.type === 'reload') { this.word('수 +1', PAL.gold, 1.2, 1); this.snd('coin'); }
      if (e.type === 'taunt') { for (const sq of e.squares) this.sparkle(sq, '#df8a45', 8); this.word('도발', '#df8a45', 1.2, 1); this.snd('reinforce'); }
    }
  }

  // 판 위 사물(정석): 고속도로 줄 · 금빛 발판 · 강 · 함정 · 문
  drawBoardThings(ctx, rules, time) {
    if (!rules) return;
    // 고속도로: 그 줄을 따라 금빛 점선 두 줄(칸 가운데 양옆)
    for (const f of rules.highways || []) {
      ctx.globalAlpha = 0.55; ctx.strokeStyle = PAL.goldDk; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.setLineDash([0.1, 3]);
      for (const d of [-0.22, 0.22]) { const a = centerAt(f + d, -0.4), c = centerAt(f + d, 7.4); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
      ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
    }
    for (const sq of rules.steps || []) {
      ctx.globalAlpha = 0.45; fillSq(ctx, sq, PAL.gold, 3); ctx.globalAlpha = 1;
      strokeSq(ctx, sq, PAL.goldDk, 1, 3);
      const c = sqCenter(sq);
      for (const p of projectSq(sq).pts) dot(ctx, c.x + (p.x - c.x) * 0.55 - 0.75, c.y + (p.y - c.y) * 0.55 - 0.75, 1.5, PAL.goldHi);
    }
    // 강(정석): 넷째 줄과 다섯째 줄 사이를 흐르는 물결(판을 가로지르는 경계선을 따라)
    if (rules.river) {
      motion();
      // 두 겹 물결 선(짙은 물 · 옅은 물빛)을 판 경계를 따라 흐르게 — 둥근 끝 벡터 선
      const n = 64, wave = (dy, col, lw, ph) => {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const f = -0.5 + (8 * i) / n, p = centerAt(f, 3.5), w = Math.sin((i * 2 + time * 12) / 3 + ph); if (i) ctx.lineTo(p.x, p.y + dy + w); else ctx.moveTo(p.x, p.y + dy + w); }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      };
      wave(-0.5, '#6fa8d8', 1.3, 0); wave(0.8, '#c8e0f0', 0.7, 1.4);
    }
    for (const sq of rules.traps || []) trapSq(ctx, sq);
    // 문: 어두운 청록 문 안쪽 + 굵은 아치 테 + 문턱(칸 가운데에 선 작은 아치). 기물이 서도 기둥 · 윗테가 남는다. 두 문이 번갈아 숨 쉰다
    (rules.gates || []).forEach((sq, k) => {
      motion();
      const c = sqCenter(sq);
      gateArch(ctx, c.x - 9, c.y - 14, 18, 0.35 + 0.25 * Math.sin(time * 3 + k * Math.PI));
    });
  }

  // 판 위 기물 하나를 받침 가운데 (cx, cy)에: 벡터 기물(pieces3.js — 받침을 같이 굽는다) · 사물(벽 · 보석, board3.js)
  // lift는 바닥에서 들린 높이: 들리면 바닥에 그림자가 남는다(작아지고 옅어진다)
  putPiece(ctx, type, side, cx, cy, opts = {}, lift = 0) {
    if (lift > 0.5 && (opts.alpha == null || opts.alpha > 0.3)) groundShadow(ctx, cx, cy + lift + 2, lift);
    piece3(ctx, type, side, cx, cy, opts);
  }

  drawReach(ctx, form, from) {
    const v = this.view, o = this.center(from);
    const slide = SLIDERS.has(form);
    ctx.globalAlpha = 0.4;
    for (const s of reach(v.board, form, from, 1)) {
      const c = this.center(s);
      if (slide) dotLine(ctx, o.x, o.y, c.x, c.y, PAL.goldHi, 2);
      if (!v.board[s]) { if (slide) rect(ctx, c.x - 1, c.y - 1, 2, 2, PAL.goldHi); else strokeSq(ctx, s, PAL.goldHi, 1, 8); }
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
    const tc = this.center(pv.sq);
    if (pv.kind === 'capture' && v.chain) {
      const fc = this.center(v.chain.sq);
      dotLine(ctx, fc.x, fc.y, tc.x, tc.y, PAL.goldHi);
      strokeSq(ctx, pv.sq, PAL.gold, 1);
      motion();
      this.putPiece(ctx, pv.form, 'w', tc.x, tc.y - 1, { alpha: 0.62 + 0.12 * Math.sin(time * 6), ...this.look(pv.form) });
      if (pv.cut) {
        for (const s of pv.cut) { const a = this.center(s); dotLine(ctx, a.x, a.y, tc.x, tc.y, PAL.red, 2); ringSq(ctx, s, PAL.red, 2); }
        const G = boardGeo(), dx = G.hw * 0.55, dy = G.hh * 0.55;
        seg(ctx, tc.x - dx, tc.y - dy, tc.x + dx, tc.y + dy, PAL.red); seg(ctx, tc.x + dx, tc.y - dy, tc.x - dx, tc.y + dy, PAL.red);
        return;
      }
    } else if (pv.kind === 'drop') {
      this.putPiece(ctx, pv.form, 'w', tc.x, tc.y, { alpha: 0.5, eng: this.sel.length === 1 && v.hand[this.sel[0]] && v.hand[this.sel[0]].eng ? v.hand[this.sel[0]].eng.id : null, tier: this.look(pv.form).tier });
    }
    for (const s of pv.next) {
      const c = this.center(s);
      const reply = pv.forced && pv.forced.includes(s);
      dotLine(ctx, tc.x, tc.y, c.x, c.y, reply ? PAL.red : PAL.gold);
      if (reply) { ctx.globalAlpha = 0.6; hatch(ctx, s, PAL.red); ctx.globalAlpha = 1; }
      ringSq(ctx, s, reply ? PAL.red : PAL.gold, 2);
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
    text(ctx, '잡으면', RX + 77, labY, PAL.dim, { align: 'center' });
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
    const [msg, col] = pv.cut ? ['끊긴다', PAL.red] : pv.mate ? ['체크메이트', PAL.gold] : pv.redrop ? ['한 번 더 놓기', PAL.gold]
      : pv.done ? ['콤보가 끝난다', PAL.dim] : pv.forced ? [`지키는 적 ${pv.next.length}`, PAL.red]
      // 먹을 적이 두 자리면(넓은 행마의 새 특수 기물, CHM-55) 폭에 맞춰 짧은 말로
      : [measure(L(`다음에 잡을 적 ${pv.next.length}`), true) <= RW - P * 2 ? `다음에 잡을 적 ${pv.next.length}` : `잡을 적 ${pv.next.length}`, PAL.gold];
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
  // 왼쪽 칸 자리(안 3 시안 p3 — 판넬 없이 바탕 위에 글): 관 · 이기면 알약 → 대국 이름(세력 점) → 「점수」 이름표 → 큰 점수(목표는 오른쪽) →
  // 목표 막대 → 값 × 배수 큰 칸 → (빈 자리 — 다시 두기의 견주기 · 수업의 콤보 줄) → 아래에서부터 수 · 희생 · 시계 · 상금 · 덱 줄
  leftLayout() {
    const spec = this.headSpec();
    let y = 4;
    const kick = { y, h: 17 };
    y += 17;
    const titles = spec.titles.map(() => { const t = textY(y, LINE_TITLE); y += LINE_TITLE; return t; });
    const scoreLab = textY(y); y += LINE;
    // 큰 점수(세 배): 잉크 33 + 아래로 빠지는 쉼표 6
    const score = y; y += INK_H * 3 + INK_DESC * 3 + 1;
    const bar = { y, h: 6 }; y = bar.y + bar.h + 5;
    const val = { y, h: VAL_H }; y += VAL_H;
    const n = this.run ? (hasClock(this.run) ? 5 : 4) : 3;
    const rowsTop = SIDE.bottom - n * ROW_L;
    const chainY = y + 3;
    return { spec, kick, titles, scoreLab, score, bar, val, chain: { y: chainY, h: rowsTop - 3 - chainY }, rowsTop, n, headY: 4, headBottom: score + INK_H * 3 };
  }
  // 탁월수 배수(CHM-43): 배수 칸(모인 뒤엔 점수 칸)에 청록 테와 오른쪽 위 「×N」 딱지. 값 × 배수가 점수로 흘러갈 때까지
  brillTag(ctx, x, y, w) {
    const T = ANNOT.teal, mark = `×${Number(this.view.brill.x.toFixed(2))}`, sz = annotSize(mark);
    rframe(ctx, x, y, w, VAL_H, R_BIG, T.fill);
    rframe(ctx, x + 1, y + 1, w - 2, VAL_H - 2, R_BIG - 1, T.edge);
    drawAnnot(ctx, mark, x + w - sz.w + 4, y - 7, T);
  }
  // 수가 오른 순간부터 스러지는 빛 세기(1 → 0, 0.45초). 움직임 줄이기에도 남는다(한 번 밝아지는 것은 떨림이 아니다)
  pulseAt(key, n, time) {
    const P = this.pulses || (this.pulses = {});
    const p = P[key] || (P[key] = { n, t: -9 });
    if (n > p.n) p.t = time;
    p.n = n;
    const k = (time - p.t) / 0.45;
    if (k >= 0 && k < 1) { motion(); return (1 - k) * (1 - k); }
    return 0;
  }
  // 왼쪽 칸 자리 하나를 접기(fold.js) 몫으로 적는다: 설명 묶음이 걸치면 그 자리를 바탕으로 다시 칠한다(판넬이 없다)
  sideSpot(ui, x, y, w, h) { ui.sideItem(x, y, w, h, { blank: (c, ground) => { if (ground) ground({ x, y, w, h }); } }); }
  // 큰 수 글자 배율: 폭 room 안에 3 → 2 → 1배, 그래도 넘치면 1배 짧은 꼴
  bigNum(n, room, top = 3) {
    const s = typeof n === 'number' ? num(Math.floor(n)) : String(n);
    for (let k = top; k >= 1; k--) if (measure(s, true) * k <= room) return { s, k };
    return { s: typeof n === 'number' ? short(n) : s, k: 1 };
  }
  drawLeft(ctx, ui) {
    const app = this.app, v = this.view, run = this.run;
    const lay = this.leftLayout(), spec = lay.spec;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const hot = v.target && score >= v.target;
    // 관 줄: 관(흐림) · 오른쪽에 이기면 받는 상금(금빛 알약)
    const ky = lay.kick.y, kt = inkY(ky, lay.kick.h);
    this.sideSpot(ui, LX, ky, LW, lay.kick.h);
    openBox('tile', LX, ky, LW, lay.kick.h, 0, { name: '관 줄' });
    let pillW = 0;
    if (spec.right) {
      pillW = measure(spec.right, true) + 12;
      const px = LX + LW - pillW;
      const pr = pillR(pillW, lay.kick.h, pillW - 12);
      openBox('edge', px, ky, pillW, lay.kick.h, 1, { name: '이기면', r: pr });
      rrect(ctx, px, ky + 2, pillW, lay.kick.h, pr, PAL.drop);
      rrect(ctx, px, ky, pillW, lay.kick.h, pr, PAL.frameDk);
      rrect(ctx, px + 1, ky + 1, pillW - 2, lay.kick.h - 2, pr - 1, PAL.gold);
      text(ctx, spec.right, px + 6, kt, PAL.cardInk, { bold: true });
      closeBox();
    }
    fitText(ctx, spec.kicker, LX + PX, kt, LW - PX - (pillW ? pillW + 4 : 0), PAL.dim, { bold: false });
    closeBox();
    // 대국 이름: 세력 점(판 어두운 칸 빛깔) + 이름(금빛 · 마스터는 붉은). 가리키면 마스터 규칙 · 세력 버릇
    const t0 = lay.titles[0] - ((LINE_TITLE - INK_H) >> 1);
    this.sideSpot(ui, LX, t0, LW, LINE_TITLE * spec.titles.length);
    openBox('tile', LX, t0, LW, LINE_TITLE * spec.titles.length, 0, { name: '대국 이름' });
    const dot = spec.faction ? 9 : 0;
    if (dot) rrect(ctx, LX + PX, lay.titles[0] + 3, 6, 6, 3, spec.faction.look ? spec.faction.look.dark : PAL.dark);
    spec.titles.forEach((l, k) => fitText(ctx, l, LX + PX + (k ? 0 : dot), lay.titles[k], LW - PX * 2 - (k ? 0 : dot), spec.titleCol));
    closeBox();
    if (spec.master) { const m = spec.master; ui.region('master', LX + 2, t0, LW - 4, LINE_TITLE, { tip: () => tipLines(`마스터 ${m.name}`, m.text) }); }
    else if (spec.faction) { const fa = spec.faction; ui.region('faction', LX + 2, t0, LW - 4, LINE_TITLE, { tip: () => tipLines(fa.name, fa.habit.text) }); }
    // 「점수」 이름표(불씨 · 얻을 몫은 이 줄) → 큰 점수 · 오른쪽 「목표 / 150」
    const sl = lay.scoreLab, sy = lay.score;
    // 접기 몫은 가리킬 수 있는 것마다 따로(이름표 줄 · 큰 점수 · 막대) — 가리킨 것을 품은 큰 몫은 접기가 판넬 빛깔로 칠한다
    this.sideSpot(ui, LX, sl - 1, LW, LINE);
    this.sideSpot(ui, LX, sy, LW, INK_H * 3 + INK_DESC * 3);
    this.sideSpot(ui, LX, lay.bar.y - 3, LW, lay.bar.h + 6);
    openBox('tile', LX, sl - 1, LW, sy + INK_H * 3 + INK_DESC * 3 - (sl - 1), 0, { name: '점수' });
    text(ctx, '점수', LX + PX, sl, PAL.dim);
    // 점화(CHM-67): 점수 이름표 옆에 불씨 — 가리키면 이 판의 콤비네이션. 규칙이 사슬 끝에 남기니 막간이 열리기 전(ignPending)에는 감춘다
    if (run && run.ignite && !this.ignPending) emberMark(ctx, ui, run.ignite, LX + PX + measure('점수') + 4, sl);
    const tgt = spec.targetN ?? spec.target;
    const gS = `/ ${typeof tgt === 'number' ? fitNum(tgt, LW / 2) : L(String(tgt))}`;
    const gw = Math.max(measure('목표'), measure(gS, true));
    text(ctx, '목표', LX + LW - PX - gw, sy + 4, PAL.dim);
    text(ctx, gS, LX + LW - PX - gw, sy + 4 + LINE, PAL.ink, { bold: true });
    const big = this.bigNum(score, LW - PX * 2 - gw - 6);
    const by = sy + INK_H * (3 - big.k);
    {
      const up = this.pulseAt('score', score, app.time);
      const sw = measure(big.s, true) * big.k;
      const a = (hot ? 0.3 * flicker(app.time, 4) : 0) + up * 0.55;
      if (a > 0.01) glowText(ctx, LX + PX, by, sw, INK_H * big.k, PAL.gold, a, 8);
    }
    // 꽂힌 점수(slamFx): 0.3초 동안 크게 튀었다가 제 크기로(상자 밖 연출). 움직임 줄이기면 크기는 그대로
    const sk = this.slam != null && !app.reducedMotion ? (app.time - this.slam) / 0.3 : 1;
    const slamming = sk >= 0 && sk < 1;
    if (slamming) motion();
    if (!slamming) text(ctx, big.s, LX + PX, by, hot ? PAL.gold : PAL.ink, { bold: true, scale: big.k });
    this.drawGain(ctx, lay);
    closeBox();
    if (slamming) {
      const sc = big.k * stepScale(1 + 0.5 * (1 - sk) * (1 - sk));
      openBox('fx', LX, sy - 20, LW, 60, 0, { loose: true, name: '꽂힌 점수' });
      fine(() => boldText(ctx, big.s, LX + PX, sy + INK_H * 3 - INK_H * sc, sk < 0.2 ? PAL.white : hot ? PAL.gold : PAL.goldHi, { scale: sc, edge: PAL.shadow }));
      closeBox();
    }
    this.drawFlames(ctx);
    this.drawGoalBar(ctx, lay);
    // 값 × 배수: 큰 칸 둘(크림 값 · 금빛 배수), 이름표는 칸 안 왼쪽 위
    const c = v.chain, g = v.gather;
    const val = g ? g.value : c ? c.value : 0;
    const mul = g ? g.mult : c ? c.mult : 0;
    const gp = g ? g.p : 0;
    const dx = gp * 32;
    const VY = lay.val.y, TW = VAL_W, MX = LX + LW - VAL_W;
    this.sideSpot(ui, LX, VY, TW, VAL_H); this.sideSpot(ui, LX + TW, VY, MX - LX - TW, VAL_H); this.sideSpot(ui, MX, VY, TW, VAL_H);
    const t = app.time, uv = this.pulseAt('value', val, t), um = this.pulseAt('mult', mul, t);
    const punch = (u) => (app.reducedMotion ? 0 : Math.round(u * 3));
    {
      const liveA = c && !g ? 0.22 * flicker(t, 3.2) : 0;
      if (g && g.burst) glow(ctx, LX, VY, LW, VAL_H, PAL.goldHi, 0.7 * Math.max(0, 1 - (g.p || 0)) + 0.3, 8);
      else {
        if (val > 0) glow(ctx, LX + dx, VY, TW, VAL_H, PAL.val, liveA + uv * 0.6, 6);
        if (mul > 0) glow(ctx, MX - dx, VY, TW, VAL_H, PAL.gold, liveA + um * 0.6, 6);
      }
    }
    if (v.count) {
      const k = v.count.p;
      const tx = lerp(LX + LW / 2, LX + PX + 20, k), ty = lerp(VY + 16, sy + 10, k);
      openBox('fx', Math.round(tx) - 40, Math.round(ty), 80, 14, 0, { loose: true, name: '흘러가는 수' });
      const fs = fitNum(v.count.to - v.count.from, LW), fw = measure(fs, true);
      glowText(ctx, tx - fw / 2, ty, fw, 12, PAL.gold, 0.5 * (1 - k * 0.8), 7);
      const bg = app.reducedMotion || fw * 2 > LW ? 1 : stepScale(2 - k);
      fine(() => boldText(ctx, fs, tx, ty + 6 - 6 * bg, PAL.gold, { scale: bg, alpha: 1 - k * 0.5 }));
      closeBox();
    }
    const tile = (x, y, w, fill, label, labCol, n, pulse, name) => {
      const p = pulse;
      openBox('panel', x, y, w, VAL_H, 2, { name, loose: !!g });
      box(ctx, x - p, y - p, w + p * 2, VAL_H + p * 2, fill, PAL.frameDk);
      if (!g && (name === '값' ? uv : um) > 0.3) { ctx.globalAlpha = ((name === '값' ? uv : um) - 0.3) * 1.2; rrect(ctx, x - p + 2, y - p + 2, w - 4 + p * 2, VAL_H - 4 + p * 2, R_BIG - 1, PAL.white); ctx.globalAlpha = 1; }
      if (label) text(ctx, label, x + 5, y + 3, labCol);
      const bn = this.bigNum(n, w - 8, 2);
      text(ctx, bn.s, x + w / 2, y + 14 + (bn.k === 2 ? 0 : INK_H / 2), PAL.cardInk, { align: 'center', bold: true, scale: bn.k });
      closeBox();
    };
    if (g && g.burst) {
      tile(LX, VY, LW, PAL.gold, null, null, g.score, 0, '값 × 배수');
      if (v.brill) this.brillTag(ctx, LX, VY, LW);
    } else {
      ui.region('box:value', LX, VY, TW, VAL_H, { keys: [{ id: 'value' }] });
      ui.region('box:links', MX, VY, TW, VAL_H, { keys: [{ id: 'links' }] });
      const drawVM = () => {
        tile(LX + dx, VY, TW, PAL.val, '값', '#6b6f9a', val, g ? 0 : punch(uv), '값');
        if (!g) text(ctx, '×', LX + LW / 2, VY + 13, PAL.ink, { align: 'center', bold: true });
        tile(MX - dx, VY, TW, PAL.link, '배수', '#7a4e0e', mul, g ? 0 : punch(um), '배수');
      };
      if (g) fine(drawVM); else drawVM();
      if (v.brill) fine(() => this.brillTag(ctx, MX - dx, VY, TW));
    }
    this.drawChainPanel(ctx, ui, lay);
    this.drawFootRows(ctx, ui, lay);
  }
  // 왼쪽 칸 빈 자리(lay.chain): 대국은 콤보가 오른쪽 칸에 있어 비워 둔다. 판이 없는 화면(수업)은 오른쪽 칸 위가 킹의 말이라 여기에 콤보 줄.
  // 다시 두기(review.js)는 견주기 두 줄로 덮어 쓴다
  drawChainPanel(ctx, ui, lay) {
    if (this.run || lay.chain.h < 22) return;
    const v = this.view, c = v.chain, cy = lay.chain.y, ch = lay.chain.h;
    const steps = c ? c.steps : this.lastEnd ? this.lastEnd.steps : [];
    const a = c ? 1 : 0.45, eng = c ? c.eng : this.lastEnd ? this.lastEnd.eng : null;
    this.sideSpot(ui, LX, cy, LW, ch);
    openBox('tile', LX, cy, LW, ch, 0, { name: '콤보 줄' });
    text(ctx, '콤보', LX + PX, cy + 1, PAL.dim);
    const n = Math.max(0, steps.length - 1);
    text(ctx, `${n}`, LX + LW - PX, cy + 1, n ? PAL.gold : PAL.dim, { align: 'right', bold: true });
    // 지나온 모습(왼쪽부터) · 지금 모습(오른쪽 끝, 금빛 받침): 들어가는 만큼 최근 것부터, 못 보인 앞은 「+N」
    const step = 19, iy = cy + LINE + 1, k = Math.min(steps.length, Math.floor((LW - PX * 2 - 14) / step) + 1);
    const shown = steps.slice(steps.length - k), more = steps.length - k;
    let x = LX + PX;
    if (more > 0) { text(ctx, `+${more}`, x, iy + 4, PAL.dim); x += measure(`+${more}`) + 3; }
    shown.forEach((tp, i) => {
      const last = i === shown.length - 1;
      if (last && c) rrect(ctx, x - 1, iy + 15, 18, 3, 1.5, c.cut ? PAL.red : PAL.gold);
      ctx.globalAlpha = a;
      fitPiece(ctx, tp, 'w', x, iy, 16, 18, { eng, spark: false });
      ctx.globalAlpha = 1;
      x += step;
    });
    closeBox();
  }
  // 아래 칸 줄(판넬 없이): 수 · 희생(둥근 구슬) → 시계 → 상금 → 덱. 이름표는 왼쪽, 값은 오른쪽 끝
  drawFootRows(ctx, ui, lay = this.leftLayout()) {
    const app = this.app, v = this.view, run = this.run;
    const right = LX + LW - PX;
    const pipRow = (n, left, col, ty) => {
      const step = Math.min(11, Math.floor((LW - 40) / Math.max(1, n))), d = Math.max(5, step - 3);
      const x0 = right - n * step + (step - d);
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step, y = ty + Math.floor((INK_H - d) / 2);
        if (i < left) { rrect(ctx, x, y + 1, d, d, d / 2, PAL.drop); rrect(ctx, x, y, d, d, d / 2, PAL.frameDk); rrect(ctx, x + 1, y + 1, d - 2, d - 2, (d - 2) / 2, col); }
        else { rrect(ctx, x, y, d, d, d / 2, PAL.slotEdge); rrect(ctx, x + 1, y + 1, d - 2, d - 2, (d - 2) / 2, PAL.slot); }
      }
      return x0;
    };
    const rows = [
      { id: 'pips:moves', tip: () => tipLines('수', '이번 대국에 놓을 수 있는 횟수. 다 쓰면 대국이 끝나요'), draw: (ty) => { text(ctx, '수', LX + PX, ty, PAL.dim); pipRow(v.moves, v.movesLeft, PAL.gold, ty); } },
      { id: 'pips:discards', tip: () => this.offeredTip(), draw: (ty) => { text(ctx, '희생', LX + PX, ty, PAL.dim); const x0 = pipRow(v.discards, v.discardsLeft, PAL.btnRed, ty); this.offeredRow(ctx, LX + PX + measure('희생') + 4, x0 - 3, ty); } },
    ];
    if (hasClock(run)) rows.push({ id: 'clock', tip: () => clockTip(run), draw: (ty) => { text(ctx, '시계', LX + PX, ty, PAL.dim); clockPips(ctx, run, right, ty, app.time, app.clockFx); } });
    if (run) rows.push({ money: true, draw: (ty) => this.moneyRow(ctx, ui, run, ty) });
    rows.push({ id: 'bag', tip: () => bagTip(this.b), draw: (ty) => { text(ctx, '덱', LX + PX, ty, PAL.dim); text(ctx, `${v.bag} / ${v.deckSize}`, right, ty, PAL.ink, { align: 'right', bold: true }); } });
    const top = SIDE.bottom - rows.length * ROW_L;
    openBox('tile', LX, top, LW, rows.length * ROW_L, 0, { name: '아래 칸' });
    rows.forEach((r, i) => {
      const ry = top + i * ROW_L, ty = textY(ry, ROW_L);
      ui.sideItem(LX, ry, LW, ROW_L, { blank: (c, ground) => { if (ground) ground({ x: LX, y: ry, w: LW, h: ROW_L }); } });
      if (r.id) ui.region(r.id, LX, ry, LW, ROW_L, { tip: r.tip });
      r.draw(ty);
    });
    closeBox();
  }
  // 상금 줄: 「상금」 · 명국 조각 · 금액(벌거나 쓰면 흔들리고 빛이 번진다 — juice.js moneyShake)
  moneyRow(ctx, ui, run, ty) {
    text(ctx, '상금', LX + PX, ty, PAL.dim);
    const amt = `$${run.money}`, right = LX + LW - PX;
    const fx = LX + PX + measure('상금') + 4;
    fragmentStrip(ctx, ui, run, fx, ty + 1, { max: Math.floor((right - measure(amt, true) - 3 - fx) / 13), step: 13 });
    const sh = ui ? moneyShake(run.money, ui.time, run) : null;
    if (sh) { const aw = measure(amt, true); glowText(ctx, right - aw, ty, aw, 12, sh.up ? PAL.goldHi : PAL.red, 0.7 * sh.hot, 7); }
    text(ctx, amt, right + (sh ? sh.dx : 0), ty, sh && sh.hot > 0.6 ? (sh.up ? PAL.white : PAL.red) : PAL.gold, { align: 'right', bold: true });
  }

  // 바친 기물 줄(CHM-43 시안 A1): 희생 구슬 오른쪽에 반 크기 흐린 실루엣. 자리가 모자라면 앞에서부터 들어가는 만큼 + 작은 「+N」
  offeredRow(ctx, x0, x1, ty) {
    const list = this.view.offered || [];
    const row = offeredRow(list.length, x0, x1);
    row.xs.forEach((x, i) => fitPiece(ctx, list[i], 'w', x, ty - 1, SW / 2, SH / 2, { alpha: 0.55 }));
    if (row.more && row.fits) drawMore(ctx, row.more, row.moreX, ty + 4, PAL.dim, digits);
    this.offeredLayout = { ...row, x0, x1, n: list.length };
  }
  offeredTip() {
    const list = this.view.offered || [];
    const body = ['손의 기물을 희생하고 새로 뽑을 수 있는 횟수'];
    if (list.length) body.push(`희생한 기물: ${list.map((t) => PIECE_NAME[t]).join(' · ')}`);
    return tipLines('희생', body);
  }
  // 오른쪽 칸 쌓기(안 3 시안 p3): 위 줄(콤보 수 · 행마 · 정석 표 · 멈춤) → 콤보 칸(고리로 잇는 알약 칸, 남는 높이만큼 다섯까지) → 시너지 띠 →
  // 격언 칸(그림만, 한 줄에 다섯) → 손 이름표 줄(손 · 묘수 · 다시 놓기 · 희생) → 부채꼴 손(판 밑으로 왼쪽까지 펼친다)
  rightLayout(run = this && this.run) {
    // 수업(판 없음)은 킹의 말이 오른쪽 칸 위를 길게 쓰므로 손 카드를 조금 낮춘다(격언 · 시너지 · 콤보 칸이 없다)
    const HAND_H = run ? HAND.h : HAND.hLesson, ROW_H = BTN_S;
    const handY = 270 - 6 - HAND_H, rowY = handY - 6 - ROW_H;
    const slots = run ? maximSlotsOf(run) : 0;
    const mrows = slots ? Math.ceil(slots / MAXIM_ROW) : 0;
    const mH = mrows ? mrows * MAXC.h + (mrows - 1) * LIST_GAP : 0;
    const maxY = rowY - LIST_GAP - mH;
    const stripY = run ? maxY - LIST_GAP - FAM_H : rowY;
    const comboY = COMBO.top, comboEnd = (run ? stripY : rowY) - LIST_GAP;
    const comboN = Math.max(0, Math.min(COMBO.max, Math.floor((comboEnd - comboY + COMBO.gap) / (COMBO.h + COMBO.gap))));
    return { handY, HAND_H, rowY, maxY, mrows, stripY, rows: 1, comboY, comboN, room: stripY - GAP_GROUP - TOP };
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
  // 손 카드 i의 자리(n장일 때) — 부채꼴: 오른쪽 끝(오른쪽 칸 끝)에 붙여 왼쪽으로 펼치고, 가운데에서 멀수록 기울고 조금 내려앉는다.
  // 왼쪽 끝은 판 밑(fanLeft)까지. 희생 연출(흩어지는 카드)도 같은 셈을 쓴다. rot: 기울기(라디안), 구역은 기울이지 않은 네모
  handRect(i, n, lay = this.rightLayout(this.run)) {
    n = Math.max(1, n);
    const w = HAND.w, h = lay.HAND_H, right = RX + RW - 1;
    const step = n > 1 ? Math.min(HAND.step, Math.floor((right - w - fanLeft(lay.handY - HAND.lift)) / (n - 1))) : 0;
    const x0 = right - w - step * (n - 1), d = i - (n - 1) / 2;
    return { x: x0 + i * step, y: lay.handY + Math.round(d * d * 0.5), w, h, step, rot: (d * HAND.deg * Math.PI) / 180 };
  }
  // 콤보 칸: 이번 콤보가 거쳐 간 모습을 차례로(지난 콤보는 흐리게). 위 줄 왼쪽에 잡은 수(크게)와 「콤보」. 칸이 모자라면 최근 것부터
  drawComboSlots(ctx, ui, lay, headRoom) {
    const v = this.view, run = this.run, c = v.chain;
    const steps = c ? c.steps : this.lastEnd ? this.lastEnd.steps : [];
    const a = c ? 1 : 0.45, eng = c ? c.eng : this.lastEnd ? this.lastEnd.eng : null;
    const tierAt = (tp) => (run ? tierOf(run.charts[tp]) : 0);
    const n = Math.max(0, steps.length - 1);
    // 위 줄: 잡은 수(두 배 굵게), 그 아래 「콤보」 이름표
    // 위 줄에 자리가 없으면(영어 「Moves」 · 정석 표 셋) 수는 「콤보」 줄 오른쪽에 한 배로
    const ns = `${n}`, inHead = measure(ns, true) <= headRoom, nw = inHead ? Math.min(headRoom, measure(ns, true) * 2) : 0;
    const ncol = c && n ? PAL.gold : PAL.ink, na = c || !n ? 1 : 0.6;
    if (inHead) {
      openBox('tile', RX, 0, headRoom, 24, 0, { name: '콤보 수' });
      const big = this.bigNum(n, headRoom, 2);
      text(ctx, big.s, RX, 1 + (big.k === 2 ? 0 : 6), ncol, { bold: true, scale: big.k, alpha: na });
      closeBox();
    } else text(ctx, ns, RX + RW, 25, ncol, { align: 'right', bold: true, alpha: na });
    text(ctx, '콤보', RX, 25, PAL.dim);
    const k = lay.comboN, y0 = lay.comboY, H = COMBO.h, step = H + COMBO.gap;
    ui.region('combo', RX, inHead ? 0 : 24, inHead ? Math.max(1, nw, headRoom) : RW, (inHead ? y0 : y0 - 24) + k * step - COMBO.gap, { tip: () => tipLines('콤보', ['한 수에 잡은 적의 수. 잡을 때마다 그 기물로 바뀌어 콤보 칸이 하나씩 찬다']) });
    // 고리: 칸과 칸 사이를 잇는 세로 고리(칸 왼쪽, 번호 아래)
    for (let j = 0; j < k - 1; j++) { const ly = y0 + j * step + H - 3; rrect(ctx, RX + 9, ly, 5, COMBO.gap + 6, 2.5, PAL.slotEdge); rrect(ctx, RX + 10, ly + 1, 3, COMBO.gap + 4, 1.5, PAL.slot); }
    const start = Math.max(0, steps.length - k);
    for (let j = 0; j < k; j++) {
      const y = y0 + j * step, s = start + j, tp = steps[s];
      if (!tp) { slot(ctx, RX, y, RW, H); text(ctx, `${s + 1}`, RX + 8, inkY(y, H), PAL.slotEdge, { bold: true }); continue; }
      const cur = s === steps.length - 1;
      const fill = cur && c ? (c.cut ? PAL.btnRed : PAL.gold) : PAL.card;
      openBox('edge', RX, y, RW, H, 1, { name: '콤보 칸', r: H / 2 });
      ctx.globalAlpha = a;
      box(ctx, RX, y, RW, H, fill, PAL.frameDk, { r: H / 2 });
      text(ctx, `${s + 1}`, RX + 8, inkY(y, H), PAL.cardDim, { bold: true });
      fitPiece(ctx, tp, 'w', RX + 22, y + 1, 12, H - 2, { eng, tier: tierAt(tp), spark: false });
      const name = L(PIECE_NAME[tp] || ''), room = RW - 38 - 8;
      if (name && measure(name, true) <= room) text(ctx, name, RX + 38, inkY(y, H), PAL.cardInk, { bold: true });
      else if (name && measure(name) <= room) text(ctx, name, RX + 38, inkY(y, H), PAL.cardInk);
      ctx.globalAlpha = 1;
      closeBox();
    }
  }
  // 격언 칸(대국): 그림만 한 줄에 다섯(이름 · 효과 · 판본 · 잠듦은 가리키면 왼쪽 칸 설명에). 빈 칸은 빈 자리
  // 격언 수(「격언 2/5」): 시너지 띠 줄 오른쪽 끝, 띠가 쓰고 남은 자리에 들어갈 때만
  maximCountLabel(ctx, ui, lay) {
    const run = this.run, n = maximCount(run), cap = maximCapacity(run);
    const used = ui.regions.filter((r) => r.id.startsWith('fam:') && r.y === lay.stripY).reduce((u, r) => Math.max(u, r.x + r.w), RX - 6);
    const room = RX + RW - (used + 6);
    // 「2/5」만 남기면 띠 끝 「+N」 · 시너지 칩 「4/6」과 섞여 읽혀서 이름까지 들어갈 때만
    const s = `격언 ${n}/${cap}`;
    if (measure(s) > room) return;
    const x = RX + RW - measure(s);
    ui.region('maxims:count', x, lay.stripY, measure(s), FAM_H, { tip: () => tipLines('격언', [`격언 칸 ${cap}개 중 ${n}개를 채웠어요`]) });
    text(ctx, s, RX + RW, inkY(lay.stripY, FAM_H), n >= cap ? PAL.gold : PAL.dim, { align: 'right' });
  }
  drawMaxims(ctx, ui, lay) {
    const run = this.run, b = this.b;
    const off = b.mods.filter((s) => s.off && s.uid != null).map((s) => s.uid);
    const slots = maximSlotsOf(run);
    for (let i = 0; i < slots; i++) {
      const col = i % MAXIM_ROW, row = Math.floor(i / MAXIM_ROW);
      const x = RX + Math.round((col * (RW - MAXC.w)) / (MAXIM_ROW - 1)), y = lay.maxY + row * (MAXC.h + LIST_GAP);
      const m = run.maxims[i];
      if (!m) { slot(ctx, x, y, MAXC.w, MAXC.h, { r: radiusOf(MAXC.w, MAXC.h) }); continue; }
      const id = `maxim:${i}`;
      ui.region(id, x, y, MAXC.w, MAXC.h, { tip: () => maximTip(m), keys: () => maximFamilies(m.id).map((f) => ({ id: `fam_${f}` })) });
      maximCard(ctx, m, x, y, MAXC.w, MAXC.h, { narrow: true, off: off.includes(m.uid), hot: ui.isHover(id), t: ui.time + i * 0.37 });
    }
  }
  // 손 카드 하나(크림 카드 · 기물 그림 · 이름이 들어가면 이름): 고른 카드는 금빛 두 겹 테
  // vis: 다음 카드에 덮이지 않고 보이는 폭(이름은 그 안 가운데에, 안 들어가면 뺀다)
  handCard(c, p, x, y, w, h, { selected = false, hover = false, dim = false, alpha = 1, tier = 0, level = 0, time = null, loose = false, vis = w } = {}) {
    if (alpha !== 1) c.globalAlpha = alpha;
    openBox('card', x, y, w, h, 2, { overlay: true, loose, name: '손 카드' });
    box(c, x, y, w, h, PAL.card, selected ? PAL.gold : hover ? PAL.goldDk : PAL.frameDk);
    if (selected) { edgeRing(c, x, y, w, h, -1, PAL.gold); edgeRing(c, x, y, w, h, -2, PAL.frameDk); }
    if (p.eng && ENG_EDGE[p.eng.id]) edgeRing(c, x, y, w, h, 1, ENG_EDGE[p.eng.id]);
    const nm = L(PIECE_NAME[p.t] || ''), vw = Math.min(w, vis), room = vw - 4;
    const bold = measure(nm, true) <= room, show = bold || measure(nm) <= room;
    fitPiece(c, p.t, 'w', x + 3, y + 3, w - 6, h - 19, { alpha: dim ? 0.5 : 1, eng: p.eng ? p.eng.id : null, tier, time, soul: p.soul || null, awake: !!p.awake });
    if (show) text(c, nm, x + Math.floor(vw / 2), y + h - 14, dim ? PAL.cardDim : PAL.cardInk, { align: 'center', bold });
    if (level > 0) chartBadge(c, level, x + w - 3, y + 3, { dim });
    if (p.soul && (p.awake || isCracked(p))) soulMark(c, p, x, y, w, h, time, dim);
    closeBox();
    if (alpha !== 1) c.globalAlpha = 1;
  }
  drawRight(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    if (!this.intro) pauseButton(ctx, ui, app); // 등장 장면 동안은 장면 위에 그린다(draw)
    const lay = this.rightLayout(run);
    if (run) {
      // 위 줄: 콤보 수(왼쪽) · 「행마」 단추 · 정석 표(멈춤 단추 왼쪽에 붙여)
      const nj = (run.josekis || []).length;
      const bx = PAUSE.x - 4 - nj * 12;
      const mw = measure('행마', true) + 14, mx = bx - 4 - mw;
      // 손가락 구역(CHM-52): 위로는 캔버스 밖 여백까지, 아래로는 콤보 칸 윗변 앞까지, 옆으로는 콤보 수 쪽
      button(ctx, ui, 'btn:moves', mx, 2, mw, BTN_S, '행마', { onClick: () => this.openMoves(), grow: { l: Math.max(0, mx - RX - 34), u: Infinity, d: Math.max(0, lay.comboY - 1 - 2 - BTN_S) } });
      josekiBadges(ctx, ui, run, bx, 9);
      this.drawComboSlots(ctx, ui, lay, mx - 4 - RX);
      familyStrip(ctx, ui, run, RX, lay.stripY, RW, { time: this.app.time, max: 4, glyph: false, rows: lay.rows });
      this.maximCountLabel(ctx, ui, lay);
      this.drawMaxims(ctx, ui, lay);
    }
    this.drawPreviewPanel(ctx);
    // 손 이름표 줄
    const ry = lay.rowY;
    const row = this.handRowLayout();
    if (row.label) text(ctx, '손', RX, inkY(ry, BTN_S), PAL.dim);
    this.drawTactics(ctx, ui, ry, row);
    const db = discardButton();
    const upRoom = GAP_IN;
    if (row.rb != null) {
      const left = row.tactics.length ? 1 : Math.max(0, row.rb - RX), right = Math.max(0, RX + RW - db.w - (row.rb + 15) - 1);
      button(ctx, ui, 'btn:reboard', row.rb, ry, 15, BTN_S, '', { onClick: () => this.reboard(), icon: reboardIcon, tip: () => tipLines('다시 놓기', []), grow: { l: left, r: right, u: upRoom } });
    }
    const live = this.live();
    const canDiscard = !this.busy && live && live.status === 'play' && this.sel.length > 0 && live.discardsLeft > 0 && live.bag.length > 0;
    this.actionButton(ctx, ui, RX + RW - db.w, ry, db, !!canDiscard, upRoom);
    // 부채꼴 손: 왼쪽 카드부터 그린다(오른쪽 카드가 위에 겹친다). 구역은 보이는 몫(다음 카드 왼끝까지), 마지막 카드는 온 폭
    const drawn = v.drawn || [], hiding = v.hiding || [], deal = this.dealIn;
    const nudging = this.nudgeOn = this.nudging();
    const n = v.hand.length;
    const nc = nextColumn(lay, this.handRect(0, Math.max(1, n), lay).x), nextRight = nc.x + nc.w;
    v.hand.forEach((p, i) => {
      const hr = this.handRect(i, n, lay);
      const w = hr.w, x = hr.x, id = `hand:${i}`;
      if (hiding.includes(i)) return; // 바친 카드: 흩어지는 동안 자리만 남는다
      const dk = deal && deal.ids.includes(p.id) && !app.reducedMotion ? Math.min(1, (app.time - deal.t) / 0.18) : 1;
      if (dk < 1) motion();
      const y = hr.y + Math.round((1 - ease.out(dk)) * 10);
      const selected = this.sel.includes(i);
      const vis = i < n - 1 ? hr.step : w;
      // 누르는 구역: 카드 온 폭을 왼쪽부터 쌓는다 — 뒤에 쌓인(오른쪽) 카드가 겹친 곳을 가져가(ui.hitIn은 나중 것이 먼저) 보이는 몫이 곧 구역이다.
      // 손가락 기기는 바깥 카드를 빈 자리로(첫 카드는 「다음」 칸 앞까지 왼쪽, 끝 카드는 화면 끝까지 오른쪽), 모두 아래로 화면 끝 · 위로 이름표 줄(희생 단추) 앞까지 넓힌다
      const g = ui.finger
        ? growHit(x, y - HAND.lift, w, hr.h + HAND.lift, ui.finger, { l: i === 0 ? Math.max(0, x - nextRight - 2) : 0, r: i === n - 1 ? Math.max(0, W - (x + w)) : 0, u: Math.max(0, y - HAND.lift - (lay.rowY + BTN_S) - 1), d: Math.max(0, 270 - (y + hr.h)) })
        : { x, y: y - HAND.lift, w, h: hr.h + HAND.lift };
      ui.region(id, g.x, g.y, g.w, g.h, { onClick: () => this.toggle(i), tip: () => pieceTip(p) });
      const hov = ui.isHover(id);
      const usable = live && live.status === 'play' && !this.busy;
      const nudge = nudging && beat(app.time, 3) % n === i ? 2 : 0;
      const pressed = hov && ui.press && ui.press.id === id;
      const lift = selected ? HAND.lift : nudge;
      sway(ctx, app.time, `hand:${i}:${p.id ?? p.t}`, x, y - lift, w, hr.h, (c) => {
        const level = chartLevel(run, p.t);
        // 기울임: 카드 아래쪽 가운데(카드 높이의 1.2배 아래)를 축으로 돌린다 — 그리기 변환만, 구역 · 기록은 기울이지 않은 네모
        const px = x + w / 2, py = y - lift + hr.h * 1.2;
        c.save(); c.translate(px, py); c.rotate(hr.rot); c.translate(-px, -py);
        c.imageSmoothingEnabled = true; // 기운 카드에 붙이는 구운 기물 · 글 그림이 최근접 늘이기로 줄줄이 어긋나지 않게(restore가 되돌린다)
        try {
          this.handCard(c, p, x, y - lift, w, hr.h, { selected, hover: hov || nudge > 0, dim: !usable, tier: tierOf(level), level, time: app.time + i, alpha: dk < 1 ? dk : 1, loose: dk < 1, vis });
          // !? 흥미로운 수: 희생으로 새로 뽑은 기물(이것으로 시작한 다음 사슬이 체크메이트면 탁월수). 기보 표가 있으면 왼쪽 위
          if (drawn.includes(p.id)) { const r = handTagRect(x, y - lift, w, level); drawAnnot(c, '!?', r.x, r.y, ANNOT.red); }
        } finally { c.restore(); }
      }, { hover: hov && usable, press: pressed, shadow: false });
    });
    this.drawNext(ctx, ui, lay);
  }

  // 다음 수(CHM-60): 덱 맨 앞 둘(왼쪽이 먼저), 손 부채 왼쪽 아래에 「다음」 이름표와 작은 칸 둘. 덱이 비면 빈 자리
  drawNext(ctx, ui, lay) {
    const col = nextColumn(lay, this.handRect(0, Math.max(1, this.view.hand.length), lay).x), next = this.view.next || [];
    ui.region('next', col.x, col.labelY, col.w, col.y + col.h - col.labelY, { tip: () => this.nextTip() });
    text(ctx, '다음', col.x, col.labelY, PAL.dim);
    col.slots.forEach((r, k) => {
      const p = next[k];
      if (!p) { slot(ctx, r.x, r.y, r.w, r.h, { r: radiusOf(r.w, r.h) }); return; }
      box(ctx, r.x, r.y, r.w, r.h, PAL.slot, PAL.slotEdge);
      fitPiece(ctx, p.t, 'w', r.x + 2, r.y + 2, r.w - 4, r.h - 4, { alpha: k === 0 ? 0.9 : 0.65, eng: p.eng ? p.eng.id : null, spark: false });
    });
  }

  nextTip() {
    const next = this.view.next || [];
    return tipLines('다음에 뽑을 기물', [next.length ? next.map((p) => PIECE_NAME[p.t]).join(' · ') : '덱이 비었어요']);
  }

  // 손 이름표 줄 오른쪽 단추(희생). 다시 두기(screens/review.js)는 「넘어가기」
  actionButton(ctx, ui, x, y, db, canDiscard, upRoom) {
    button(ctx, ui, 'btn:discard', x, y, db.w, BTN_S, '희생', { enabled: canDiscard, onClick: () => this.discard(), icon: db.icon ? discardIcon : null, tone: canDiscard ? 'red' : 'plain', grow: { u: upRoom } });
  }

  drawOver(ctx) {
    if (this.banner && !this.intro) {
      const bn = this.banner, bt = bn.t - (bn.from || 0);
      const a = Math.min(1, bt * 6, (bn.life - bn.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      const { row, TW, mBig, subs, bh, by } = this.bannerBox();
      rect(ctx, BX - 6, by, S * 8 + 12, bh, PAL.shadow);
      ctx.globalAlpha = Math.max(0, a);
      if (bn.master) {
        // 초상이 오른쪽에서 미끄러져 들어온다(64×64)
        const k = Math.min(1, bt / 0.35);
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
      ctx.globalAlpha = 0.6; rrect(ctx, x, y, 18, 18, 3, PAL.gold); ctx.globalAlpha = 1;
      rframe(ctx, x, y, 18, 18, 3, PAL.goldDk);
      for (const [i, j] of [[3, 3], [13.5, 3], [3, 13.5], [13.5, 13.5]]) dot(ctx, x + i, y + j, 1.5, PAL.goldHi);
    } else if (obj === 'gate') {
      gateArch(ctx, x, y, 18, 0.5);
    } else if (obj === 'trap') {
      trapPit(ctx, x, y, 18);
    } else if (obj === 'river') {
      for (const [dy, col, lw] of [[8.5, '#6fa8d8', 1.3], [11.5, '#c8e0f0', 0.9]]) {
        ctx.beginPath(); for (let k = 0; k <= 18; k++) { const py = y + dy + Math.sin(k / 3); if (k) ctx.lineTo(x + k, py); else ctx.moveTo(x + k, py); }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
    } else if (obj === 'highway') {
      for (let j = 1; j < 18; j += 4) { dot(ctx, x + 3.75, y + j, 1.5, PAL.goldDk); dot(ctx, x + 12.75, y + j, 1.5, PAL.goldDk); }
      // 세로 두 갈래 화살(위아래로 곧게 간다)
      seg(ctx, x + 9, y + 4.5, x + 9, y + 13.5, PAL.gold, 1.6);
      for (const [ty, d] of [[4, 1], [14, -1]]) { ctx.beginPath(); ctx.moveTo(x + 9, ty); ctx.lineTo(x + 6.5, ty + 2.6 * d); ctx.lineTo(x + 11.5, ty + 2.6 * d); ctx.closePath(); ctx.fillStyle = PAL.gold; ctx.fill(); }
    }
  }

  key(k) {
    if (this.combo) { this.closeCombo(); return; } // 점화 막간: 아무 키나 닫는다(다른 데로 새지 않는다)
    if (this.intro) { if (k === 'Escape') this.app.openOverlay('pause'); else this.endIntro(); return; } // 마스터 등장: Esc는 멈춤, 다른 키는 넘긴다
    const b = this.live();
    this.idleT = 0;
    // 갈림길 카드: Enter 다시 두기 · Esc · 스페이스 넘어가기
    if (this.rv) {
      if (this.rv.phase !== 'card') return;
      if (k === 'Enter' && this.rv.res.kind === 'path') this.retryReview();
      else if (k === 'Escape' || k === ' ' || (k === 'Enter' && this.rv.res.kind !== 'path')) this.endReview();
      return;
    }
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
