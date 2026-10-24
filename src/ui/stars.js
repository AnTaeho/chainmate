// 사슬 평가 별(CHM-47): 먹은 수 3 · 5 · 8에 ★ · ★★ · ★★★, 12는 ∞(글자 그대로).
// 체스 주석(!? · !!)은 희생 · 탁월수만 쓰므로 사슬 평가는 별 그림으로 찍는다. 빛깔은 단계마다 하양 · 금 · 빨강.
// 별 하나는 9 × 9 칸(px배)에 선 다섯 뿔 벡터 별(안 3) — (빛깔, 크기, 배율 N)마다 한 번 굽는다.
import { blitVec } from '../render/vec.js';
import { PAL } from '../render/palette.js';

export const STAR_N = 9;

// 평가 표기 → 별 수(∞ · 모르는 것은 0)와 빛깔
export const starCount = (mark) => (/^★+$/.test(mark || '') ? mark.length : 0);
export const STAR_COL = { '★': PAL.white, '★★': PAL.gold, '★★★': PAL.red };

// 별 n개 줄의 폭: 별 9px씩, 사이 px
export const starsW = (n, px = 1) => (n > 0 ? n * STAR_N * px + (n - 1) * px : 0);

// 뿔 다섯(안 반지름 0.45), 9 칸 상자를 꽉 채운다
export const STAR_PTS = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.15 : 4.72; return [4.5 + Math.cos(a) * r, 4.95 + Math.sin(a) * r]; });
function star(ctx, x, y, px, col) {
  const s = STAR_N * px;
  blitVec(ctx, `star:${col}`, x, y, s, s, (g) => {
    const k = s / STAR_N;
    g.beginPath(); STAR_PTS.forEach(([sx, sy], i) => (i ? g.lineTo(sx * k, sy * k) : g.moveTo(sx * k, sy * k))); g.closePath();
    g.fillStyle = col; g.fill();
  });
}

// 별 n개를 (x, y) 왼쪽 위부터. shadow가 있으면 오른쪽 아래로 반 칸 그림자. 돌려주는 값은 폭
// ring: 별 둘레 한 칸 테(네 방향으로 한 칸씩 민 별을 그 빛깔로 먼저). 하양 ★이 밝은 빛 번짐에 묻히지 않게(CHM-48)
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
