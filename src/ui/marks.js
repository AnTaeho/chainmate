// 판 위 표시(체스닷컴처럼): 오른쪽 누르기로 칸에 빛깔을 칠하고, 오른쪽으로 눌러 끌면 두 칸 사이에 화살표를 긋는다.
// 순전히 화면의 것 — 규칙 · 명령 · 저장 · 다시 보기와 상관없다. 대국 화면 하나(인스턴스)에만 산다.
// 빛깔은 초록(PAL.mark): 붉은빛은 지키는 적 · 끊김, 금빛은 사슬 · 떨굴 칸, 하늘빛은 빙결이 이미 쓴다.
import { PAL } from '../render/palette.js';
import { rect } from '../render/gfx.js';

export class Marks {
  constructor() { this.squares = new Set(); this.arrows = []; this.from = -1; }
  get count() { return this.squares.size + this.arrows.length; }
  clear() { this.squares.clear(); this.arrows = []; this.from = -1; }
  toggleSquare(sq) { if (this.squares.has(sq)) this.squares.delete(sq); else this.squares.add(sq); }
  toggleArrow(from, to) {
    const i = this.arrows.findIndex((a) => a.from === from && a.to === to);
    if (i >= 0) this.arrows.splice(i, 1); else this.arrows.push({ from, to });
  }
  // 오른쪽 누름 · 뗌. sq는 판 칸(판 밖이면 -1)
  down(sq) { this.from = sq; }
  up(sq) {
    const from = this.from;
    this.from = -1;
    if (from < 0 || sq < 0) return;
    if (from === sq) this.toggleSquare(sq); else this.toggleArrow(from, sq);
  }
}

// 칸 칠: 기물 아래, 반투명
export function drawMarkSquares(ctx, marks, sqXY, S) {
  if (!marks.squares.size) return;
  ctx.globalAlpha = 0.55;
  for (const sq of marks.squares) { const { x, y } = sqXY(sq); rect(ctx, x, y, S, S, PAL.mark); }
  ctx.globalAlpha = 1;
}

// 화살표: 굵기 3px 도트 선 + 도트 머리. 모든 화살표의 화소를 한 번에 모아 칠해 겹친 곳이 짙어지지 않는다.
// 나이트 걸음(2 · 1)이면 긴 쪽으로 먼저 가다 꺾는 ㄱ자, 그 밖은 곧은 선. 기물 위에 반투명으로 그린다
const HEAD_LEN = 9, HEAD_HALF = 6, SHAFT = 1.2, START = 9, TIP = 5;
export function drawMarkArrows(ctx, marks, sqXY, S, pending = null) {
  if (!marks.arrows.length && !pending) return;
  const c = (sq) => { const p = sqXY(sq); return { x: p.x + S / 2 - 0.5, y: p.y + S / 2 - 0.5 }; }; // 칸 가운데 화소 한 줄의 가운데
  // 화소 모음은 화살표가 바뀔 때만 다시 센다(프레임마다 세지 않는다)
  const sig = marks.arrows.map((a) => `${a.from}-${a.to}`).join(',') + (pending ? `|${pending.from}-${pending.to}` : '');
  if (!marks.px || marks.px.sig !== sig) {
    const solid = new Set();
    for (const a of marks.arrows) arrowPixels(c(a.from), c(a.to), a.from, a.to, solid);
    const p = new Set();
    if (pending) { arrowPixels(c(pending.from), c(pending.to), pending.from, pending.to, p); for (const k of solid) p.delete(k); }
    marks.px = { sig, rim: runs(rim(solid)), solid: runs(solid), pending: runs(p) };
  }
  // 1px 어두운 테: 짙은 기물 · 짙은 칸 위에서도 화살 모양이 읽히게
  paint(ctx, marks.px.rim, 0.55, PAL.shadow);
  paint(ctx, marks.px.solid, 0.85);
  // 끌고 있는 화살표는 흐리게(겹친 화소는 이미 칠했다)
  paint(ctx, marks.px.pending, 0.5);
}

// 화소 모음 → 가로 토막 [x, y, 길이]
function runs(set) {
  const ks = [...set].sort((a, b) => a - b), out = [];
  for (const k of ks) {
    const x = k & 511, y = k >> 9, last = out[out.length - 1];
    if (last && last[1] === y && last[0] + last[2] === x) last[2]++; else out.push([x, y, 1]);
  }
  return out;
}
// 화소 모음 바로 바깥 한 겹(위아래 · 양옆)
function rim(set) {
  const out = new Set();
  for (const k of set) for (const d of [1, -1, 512, -512]) if (!set.has(k + d)) out.add(k + d);
  return out;
}
function paint(ctx, list, alpha, col = PAL.mark) {
  if (!list.length) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  for (const [x, y, w] of list) ctx.fillRect(x, y, w, 1);
  ctx.globalAlpha = 1;
}

function arrowPixels(A, B, from, to, set) {
  const df = (to & 7) - (from & 7), dr = (to >> 3) - (from >> 3);
  const knight = (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
  if (knight) {
    // 긴 다리(두 칸)를 먼저, 한 칸 꺾어 과녁으로
    const C = Math.abs(df) === 2 ? { x: B.x, y: A.y } : { x: A.x, y: B.y };
    const u = unit(A, C), v = unit(C, B);
    const s = { x: A.x + u.x * START, y: A.y + u.y * START };
    const tip = { x: B.x + v.x * TIP, y: B.y + v.y * TIP };
    shaft(s, { x: C.x + u.x * SHAFT, y: C.y + u.y * SHAFT }, set);
    const base = { x: tip.x - v.x * HEAD_LEN, y: tip.y - v.y * HEAD_LEN };
    shaft(C, base, set);
    head(tip, v, set);
    return;
  }
  const u = unit(A, B);
  const s = { x: A.x + u.x * START, y: A.y + u.y * START };
  const tip = { x: B.x + u.x * TIP, y: B.y + u.y * TIP };
  shaft(s, { x: tip.x - u.x * HEAD_LEN, y: tip.y - u.y * HEAD_LEN }, set);
  head(tip, u, set);
}
function unit(a, b) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
const key = (x, y) => (y << 9) | x;
// 선분에서 SHAFT 안의 화소(화소 (x, y)의 가운데는 x + 0.5 · y + 0.5 — 칸 가운데 선이 화소 한 줄을 지나 굵기 3)
function shaft(a, b, set) {
  const x0 = Math.floor(Math.min(a.x, b.x) - 2), x1 = Math.ceil(Math.max(a.x, b.x) + 2);
  const y0 = Math.floor(Math.min(a.y, b.y) - 2), y1 = Math.ceil(Math.max(a.y, b.y) + 2);
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L2));
    const ex = a.x + dx * t - px, ey = a.y + dy * t - py;
    if (ex * ex + ey * ey <= SHAFT * SHAFT) set.add(key(x, y));
  }
}
// 머리: 끝(tip)에서 뒤로 HEAD_LEN, 밑변 너비 HEAD_HALF × 2인 세모
function head(tip, u, set) {
  const n = { x: -u.y, y: u.x };
  const bx = tip.x - u.x * HEAD_LEN, by = tip.y - u.y * HEAD_LEN;
  const P = [tip, { x: bx + n.x * HEAD_HALF, y: by + n.y * HEAD_HALF }, { x: bx - n.x * HEAD_HALF, y: by - n.y * HEAD_HALF }];
  const x0 = Math.floor(Math.min(...P.map((p) => p.x))), x1 = Math.ceil(Math.max(...P.map((p) => p.x)));
  const y0 = Math.floor(Math.min(...P.map((p) => p.y))), y1 = Math.ceil(Math.max(...P.map((p) => p.y)));
  const side = (p, q, x, y) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const a = side(P[0], P[1], x + 0.5, y + 0.5), b = side(P[1], P[2], x + 0.5, y + 0.5), c = side(P[2], P[0], x + 0.5, y + 0.5);
    const e = 0.35 * HEAD_LEN;
    if ((a >= -e && b >= -e && c >= -e) || (a <= e && b <= e && c <= e)) set.add(key(x, y));
  }
}
