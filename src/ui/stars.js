// 사슬 평가 별(CHM-47): 먹은 수 3 · 5 · 8에 ★ · ★★ · ★★★, 12는 ∞(글자 그대로).
// 체스 주석(!? · !!)은 희생 · 탁월수만 쓰므로 사슬 평가는 별 도트 그림으로 찍는다. 빛깔은 단계마다 하양 · 금 · 빨강.
// 별 하나는 9 × 9 도트(px배). 화면 배율 2 이상(hiFor)이면 두 배 도트 그림(art-hi.js STAR_HI · STAR_HI4)을 같은 자리에.
import { rect, place } from '../render/gfx.js';
import { baked, hiFor } from '../render/sprites.js';
import { STAR_HI, STAR_HI4 } from '../render/art-hi.js';
import { PAL } from '../render/palette.js';

export const STAR_ROWS = ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'];
export const STAR_N = STAR_ROWS.length;

// 평가 표기 → 별 수(∞ · 모르는 것은 0)와 빛깔
export const starCount = (mark) => (/^★+$/.test(mark || '') ? mark.length : 0);
export const STAR_COL = { '★': PAL.white, '★★': PAL.gold, '★★★': PAL.red };

// 별 n개 줄의 폭: 별 9px씩, 사이 px
export const starsW = (n, px = 1) => (n > 0 ? n * STAR_N * px + (n - 1) * px : 0);

function star(ctx, x, y, px, col) {
  if (hiFor(ctx)) {
    const rows = px >= 2 ? STAR_HI4 : STAR_HI;
    ctx.drawImage(baked(`star:${rows.length}:${col}`, rows, { '#': [col, 1] }), place(x), place(y), STAR_N * px, STAR_N * px);
    return;
  }
  STAR_ROWS.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') rect(ctx, x + i * px, y + j * px, px, px, col); });
}

// 별 n개를 (x, y) 왼쪽 위부터. shadow가 있으면 오른쪽 아래로 반 도트 그림자. 돌려주는 값은 폭
// ring: 별 둘레 한 도트 테(네 방향으로 한 도트씩 민 별을 그 빛깔로 먼저). 하양 ★이 밝은 빛 번짐에 묻히지 않게(CHM-48)
export function drawStars(ctx, n, x, y, col, { px = 1, shadow = null, alpha = 1, ring = null } = {}) {
  if (n <= 0) return 0;
  const step = STAR_N * px + px;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (shadow) { const o = Math.max(1, Math.round(px / 2)); for (let i = 0; i < n; i++) star(ctx, x + i * step + o, y + o, px, shadow); }
  if (ring) for (let i = 0; i < n; i++) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) star(ctx, x + i * step + dx, y + dy, px, ring);
  for (let i = 0; i < n; i++) star(ctx, x + i * step, y, px, col);
  if (alpha !== 1) ctx.globalAlpha = 1;
  return starsW(n, px);
}
