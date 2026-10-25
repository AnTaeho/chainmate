// 판 위 표시(체스닷컴처럼): 오른쪽 누르기로 칸에 빛깔을 칠하고, 오른쪽으로 눌러 끌면 두 칸 사이에 화살표를 긋는다.
// 순전히 화면의 것 — 규칙 · 명령 · 저장 · 다시 보기와 상관없다. 대국 화면 하나(인스턴스)에만 산다.
// 빛깔은 초록(PAL.mark): 붉은빛은 지키는 적 · 끊김, 금빛은 사슬 · 떨굴 칸, 하늘빛은 빙결이 이미 쓴다.
import { PAL } from '../render/palette.js';

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
// fill(ctx, sq, col): 칸 하나를 칠한다(판 투영 — board3.js fillSq)
export function drawMarkSquares(ctx, marks, fill) {
  if (!marks.squares.size) return;
  ctx.globalAlpha = 0.55;
  for (const sq of marks.squares) fill(ctx, sq, PAL.mark);
  ctx.globalAlpha = 1;
}

// 화살표: 굵기 3 벡터 선(둥근 이음) + 세모 머리, 1px 어두운 테. 모든 화살표를 한 길(path)로 모아 한 번에 칠해 겹친 곳이 짙어지지 않는다.
// 나이트 걸음(2 · 1)이면 긴 쪽으로 먼저 가다 꺾는 ㄱ자, 그 밖은 곧은 선. 기물 위에 반투명으로 그린다
const HEAD_LEN = 9, HEAD_HALF = 6, SHAFT_W = 3, START = 9, TIP = 5;
// at(f, r): 판 칸 단위 자리(소수도 된다) → 칸 가운데 화면 자리(board3.js centerAt). 나이트 꺾는 자리도 칸 단위로 잡아 투영한다
export function drawMarkArrows(ctx, marks, at, pending = null) {
  if (!marks.arrows.length && !pending) return;
  const c = (sq) => at(sq & 7, sq >> 3);
  const bend = (from, to) => (Math.abs((to & 7) - (from & 7)) === 2 ? at(to & 7, from >> 3) : at(from & 7, to >> 3));
  const shape = (list) => {
    const shafts = [], heads = [];
    for (const a of list) arrowShape(c(a.from), c(a.to), a.from, a.to, bend, shafts, heads);
    return { shafts, heads };
  };
  const layer = (sh, alpha, col, edge) => {
    if (!sh.shafts.length) return;
    ctx.save();
    ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
    const path = (list) => { ctx.beginPath(); for (const pts of list) { ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); } };
    if (edge) {
      // 테: 선은 두 겹 더 굵게, 머리는 둘레를 한 겹 — 한 번씩 칠해 겹친 곳이 짙어지지 않는다
      ctx.strokeStyle = col; ctx.lineCap = 'round';
      path(sh.shafts); ctx.lineWidth = SHAFT_W + 2; ctx.stroke();
      path(sh.heads); ctx.closePath(); ctx.lineWidth = 2; ctx.stroke();
    } else {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'butt';
      path(sh.shafts); ctx.lineWidth = SHAFT_W; ctx.stroke();
      ctx.beginPath(); for (const t of sh.heads) { ctx.moveTo(t[0].x, t[0].y); ctx.lineTo(t[1].x, t[1].y); ctx.lineTo(t[2].x, t[2].y); ctx.closePath(); } ctx.fill();
    }
    ctx.restore();
  };
  const solid = shape(marks.arrows);
  // 1px 어두운 테: 짙은 기물 · 짙은 칸 위에서도 화살 모양이 읽히게
  layer(solid, 0.55, PAL.shadow, true);
  layer(solid, 0.85, PAL.mark, false);
  // 끌고 있는 화살표는 흐리게
  if (pending) layer(shape([pending]), 0.5, PAL.mark, false);
}

// 화살 하나: 몸(꺾은 선 점들)은 머리 밑변에서 끝나고, 머리는 끝(tip)에서 뒤로 HEAD_LEN · 밑변 너비 HEAD_HALF × 2인 세모
function arrowShape(A, B, from, to, bend, shafts, heads) {
  const df = (to & 7) - (from & 7), dr = (to >> 3) - (from >> 3);
  const knight = (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
  const C = knight ? bend(from, to) : null, first = knight ? C : B;
  const u = unit(A, first), v = knight ? unit(C, B) : u;
  const s = { x: A.x + u.x * START, y: A.y + u.y * START };
  const tip = { x: B.x + v.x * TIP, y: B.y + v.y * TIP };
  const base = { x: tip.x - v.x * HEAD_LEN, y: tip.y - v.y * HEAD_LEN };
  shafts.push(knight ? [s, C, base] : [s, base]);
  const n = { x: -v.y, y: v.x };
  heads.push([tip, { x: base.x + n.x * HEAD_HALF, y: base.y + n.y * HEAD_HALF }, { x: base.x - n.x * HEAD_HALF, y: base.y - n.y * HEAD_HALF }]);
}
function unit(a, b) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
