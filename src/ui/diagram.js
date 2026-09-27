// 행마 그림: 8×8 작은 판(칸 4px)에 기물 하나를 d4에 두고, 먹을 수 있는 칸에 점을 찍는다.
// 대국 규칙과 같은 reach(src/sim/board.js)로 그린다 — 글(「나이트처럼 L자로 뛰되 …」) 옆에서 한눈에.
// 받침이 있어야 먹는 포 · 메뚜기와 막힘을 뚫는 유령은 받침 · 막는 기물을 둔 보기 판(어두운 네모)으로.
import { reach, boardFrom } from '../sim/board.js';
import { rect, frame } from '../render/gfx.js';
import { PAL } from '../render/palette.js';

export const DIAG_CELL = 4;
export const DIAG_SIZE = 8 * DIAG_CELL + 2;   // 테 포함 34px
export const DIAG_W = DIAG_SIZE + 4;           // 말풍선에서 그림이 차지하는 너비(글과의 틈 포함)
const FROM = 27; // d4
// 보기 판: 받침 · 막는 기물(적 폰)과 그 너머의 적
const SAMPLE = {
  G: { d6: 'P', f6: 'P', b4: 'P' },
  O: { d6: 'P', d8: 'P', f4: 'P', h4: 'P' },
  W: { d6: 'P' },
};
const cache = new Map();
// 그릴 수 있나: 체스 · 특수 기물(벽 · 보석은 행마가 없다)
export const hasDiagram = (t) => !!t && 'PNBRQKACZLHGOSW'.includes(t);

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

// (x, y) 왼쪽 위에 그린다. dir: 폰이 먹는 쪽(+1 내 폰 모습 위로, −1 적 폰 아래로)
export function moveDiagram(ctx, t, x, y, { dir = 1 } = {}) {
  if (!hasDiagram(t)) return;
  const { reach: rs, blocks } = plan(t, dir);
  const C = DIAG_CELL;
  frame(ctx, x, y, DIAG_SIZE, DIAG_SIZE, PAL.frameDk);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = r * 8 + f;
    // 판은 위가 먼 줄(rank 7): 대국 판과 같은 방향
    const cx = x + 1 + f * C, cy = y + 1 + (7 - r) * C;
    rect(ctx, cx, cy, C, C, (r + f) % 2 ? '#2f4a41' : '#243a33');
    if (sq === FROM) rect(ctx, cx, cy, C, C, PAL.gold);
    else if (blocks.has(sq)) rect(ctx, cx, cy, C, C, '#6b6454');
    if (rs.has(sq)) rect(ctx, cx + 1, cy + 1, 2, 2, blocks.has(sq) ? PAL.white : PAL.goldHi);
  }
}
