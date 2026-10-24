// 행마 그림(안 3 벡터): 8×8 작은 판(칸 4px, 크림 · 판 어두운 칸 · 잉크 테)에 기물 하나를 d4에 두고, 먹을 수 있는 칸에 점을 찍는다.
// 대국 규칙과 같은 reach(src/sim/board.js)로 그린다 — 글(「나이트처럼 L자로 뛰되 …」) 옆에서 한눈에.
// 받침이 있어야 먹는 포 · 막힘을 뚫는 유령 · 막히면 꺾는 꺾쇠 · 넘을 너머가 비어야 하는 까마귀 · 적의 행마를 흉내 내는 광대는
// 받침 · 막는 기물 · 적을 둔 보기 판(어두운 네모)으로.
import { reach, boardFrom } from '../sim/board.js';
import { place } from '../render/gfx.js';
import { PAL } from '../render/palette.js';
import { bake, scaleOf, INK } from '../render/vec.js';

export const DIAG_CELL = 4;
export const DIAG_SIZE = 8 * DIAG_CELL + 2;   // 테 포함 34px
export const DIAG_W = DIAG_SIZE + 4;           // 말풍선에서 그림이 차지하는 너비(글과의 틈 포함)
const FROM = 27; // d4
// 보기 판: 받침 · 막는 기물(적 폰)과 그 너머의 적
const SAMPLE = {
  O: { d6: 'P', d8: 'P', f4: 'P', h4: 'P' },
  W: { d6: 'P' },
  T: { d6: 'P', f4: 'P', b4: 'P' },
  V: { e5: 'P', c3: 'P', c5: 'P', b6: 'P' },
  M: { e5: 'P', f5: 'N', b4: 'R', c3: 'P' },
};
const cache = new Map();
// 그릴 수 있나: 체스 · 특수 기물(벽 · 보석은 행마가 없다)
export const hasDiagram = (t) => !!t && 'PNBRQKZLOSWTEVMD'.includes(t);

function plan(t, dir) {
  const key = `${t}${dir}`;
  let p = cache.get(key);
  if (p) return p;
  const board = boardFrom(SAMPLE[t] || {});
  const blocks = board.map((c, sq) => (c ? sq : -1)).filter((sq) => sq >= 0);
  p = { reach: new Set(reach(board, t, FROM, dir)), blocks: new Set(blocks) };
  cache.set(key, p);
  return p;
}

const GOLD = '#f6be45', NAVY = '#343a86';
// (x, y) 왼쪽 위에 그린다. dir: 폰이 먹는 쪽(+1 내 폰 모습 위로, −1 적 폰 아래로). (기물, 쪽, 어두운 칸 빛깔, 배율)마다 한 번 굽는다
export function moveDiagram(ctx, t, x, y, { dir = 1 } = {}) {
  if (!hasDiagram(t)) return;
  const n = scaleOf(ctx);
  const c = bake(`diag:${t}:${dir}:${PAL.dark}`, DIAG_SIZE, DIAG_SIZE, n, (g) => paint(g, t, dir, n));
  ctx.drawImage(c, place(x), place(y), DIAG_SIZE, DIAG_SIZE);
}
function paint(g, t, dir, n) {
  const { reach: rs, blocks } = plan(t, dir);
  const C = DIAG_CELL;
  g.fillStyle = INK; g.fillRect(0, 0, DIAG_SIZE, DIAG_SIZE);
  // 판은 위가 먼 줄(rank 7): 대국 판과 같은 방향
  const at = (sq) => [1 + (sq % 8) * C, 1 + (7 - Math.floor(sq / 8)) * C];
  for (let sq = 0; sq < 64; sq++) {
    const [cx, cy] = at(sq), r = Math.floor(sq / 8), f = sq % 8;
    g.fillStyle = (r + f) % 2 ? PAL.light : PAL.dark;
    g.fillRect(cx, cy, C, C);
  }
  const dot = (cx, cy, rad, fill, ring) => {
    if (n === 1) { g.fillStyle = ring || fill; g.fillRect(cx - 1, cy - 1, 2, 2); return; }
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    if (ring) { g.strokeStyle = ring; g.lineWidth = Math.max(0.5, 1 / n); g.stroke(); }
  };
  // 막는 기물(적): 남색 원반, 먹을 수 있으면 가운데 흰 점
  for (const sq of blocks) {
    const [cx, cy] = at(sq);
    if (n === 1) { g.fillStyle = NAVY; g.fillRect(cx, cy, C, C); if (rs.has(sq)) { g.fillStyle = PAL.white; g.fillRect(cx + 1, cy + 1, 2, 2); } continue; }
    dot(cx + C / 2, cy + C / 2, 1.6, NAVY, INK);
    if (rs.has(sq)) dot(cx + C / 2, cy + C / 2, 0.6, '#ffffff');
  }
  // 갈 수 있는 칸: 금 점
  for (const sq of rs) if (!blocks.has(sq)) { const [cx, cy] = at(sq); dot(cx + C / 2, cy + C / 2, 1.25, GOLD, INK); }
  // 출발 칸(d4): 잉크 테 두른 금 칸(기물 실루엣은 4 칸 안에서 읽히지 않아 칸만)
  const [fx, fy] = at(FROM);
  g.fillStyle = INK; g.fillRect(fx, fy, C, C);
  const e = n === 1 ? 1 : Math.max(0.5, 1 / n);
  g.fillStyle = GOLD; g.fillRect(fx + e, fy + e, C - 2 * e, C - 2 * e);
}
