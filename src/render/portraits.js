// 명인 초상 32×32(코드로 그린 도트). 얼굴 · 어깨 바탕 위에 명인마다 한 가지 표지.
import { makeCanvas, context } from './surface.js';

const SKIN = '#d9b08c', SKIN_DK = '#a8795a', INK = '#1a1210', WHITE = '#f4ead2';
const LOOK = {
  iron_wall: { robe: '#4a5a6a', robeHi: '#6f8294' },
  fog: { robe: '#24403c', robeHi: '#35605a' },
  mirror: { robe: '#5a4a7a', robeHi: '#7a68a0' },
  hourglass: { robe: '#6a4a2a', robeHi: '#8f6a3f' },
  heavy_hand: { robe: '#5a3a2a', robeHi: '#7f563f' },
  silence: { robe: '#2f3a4a', robeHi: '#475870' },
  grudge: { robe: '#6a1f1f', robeHi: '#8f2f2f' },
  grandmaster: { robe: '#3f2a5a', robeHi: '#5f447f' },
};

function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function head(g, skin = SKIN, dk = SKIN_DK) {
  // 머리(타원 꼴 계단)
  const rows = [[12, 8], [11, 10], [10, 12], [10, 12], [10, 12], [10, 12], [10, 12], [10, 12], [11, 10], [11, 10], [12, 8], [13, 6]];
  rows.forEach(([x, w], i) => { px(g, x, 6 + i, w, 1, skin); px(g, x + w - 2, 6 + i, 2, 1, dk); });
  px(g, 14, 18, 4, 3, dk); // 목
}
function body(g, look) {
  for (let y = 21; y < 32; y++) { const w = Math.min(28, 10 + (y - 21) * 3); px(g, 16 - w / 2, y, w, 1, look.robe); }
  px(g, 13, 21, 6, 2, look.robeHi);
  px(g, 15, 23, 2, 9, look.robeHi);
}
function eyes(g, col = INK, y = 11) { px(g, 12, y, 2, 2, col); px(g, 18, y, 2, 2, col); }
function mouth(g, col = SKIN_DK, y = 15, w = 4) { px(g, 16 - w / 2, y, w, 1, col); }

const DRAW = {
  iron_wall(g, L) {
    body(g, L); head(g); eyes(g); mouth(g);
    // 투구: 윗머리를 덮고 코 가리개
    px(g, 9, 4, 14, 6, '#8a9aa6'); px(g, 10, 3, 12, 1, '#b8c4cc'); px(g, 9, 9, 14, 1, '#5d6f78');
    px(g, 15, 9, 2, 5, '#8a9aa6'); px(g, 9, 10, 2, 6, '#8a9aa6'); px(g, 21, 10, 2, 6, '#8a9aa6');
    for (let x = 4; x < 28; x += 4) px(g, x, 26, 2, 2, '#b8c4cc');
  },
  fog(g, L) {
    body(g, L); head(g, '#3a4a48', '#2a3634');
    // 두건
    px(g, 8, 4, 16, 3, L.robe); px(g, 8, 7, 3, 12, L.robe); px(g, 21, 7, 3, 12, L.robe); px(g, 9, 3, 14, 1, L.robeHi);
    eyes(g, '#9fe0d0');
    for (let i = 0; i < 9; i++) px(g, (i * 7) % 30, 22 + (i * 5) % 9, 3, 1, 'rgba(200,230,225,0.5)');
  },
  mirror(g, L) {
    body(g, L); head(g); eyes(g); mouth(g);
    // 오른쪽 얼굴이 거울빛
    for (let y = 6; y < 18; y++) px(g, 16, y, 6, 1, '#b8c8e0');
    px(g, 18, 11, 2, 2, '#5d6f98'); px(g, 16, 15, 2, 1, '#8a9ab8');
    px(g, 16, 4, 1, 16, WHITE);
    px(g, 10, 4, 12, 2, '#2a1c10');
  },
  hourglass(g, L) {
    body(g, L); head(g); eyes(g, INK, 11); px(g, 11, 9, 4, 1, WHITE); px(g, 17, 9, 4, 1, WHITE);
    // 흰 수염
    px(g, 12, 15, 8, 3, WHITE); px(g, 13, 18, 6, 2, WHITE); px(g, 14, 20, 4, 2, WHITE);
    // 모래시계
    px(g, 2, 3, 7, 1, '#8f6a3f'); px(g, 2, 13, 7, 1, '#8f6a3f');
    px(g, 3, 4, 5, 2, '#efbd55'); px(g, 4, 6, 3, 1, '#efbd55'); px(g, 5, 7, 1, 2, '#efbd55'); px(g, 4, 10, 3, 1, '#c8902c'); px(g, 3, 11, 5, 2, '#c8902c');
  },
  heavy_hand(g, L) {
    body(g, L); head(g); eyes(g); mouth(g, INK, 15, 6);
    px(g, 11, 9, 4, 1, INK); px(g, 17, 9, 4, 1, INK); // 짙은 눈썹
    // 큰 주먹 둘
    for (const x of [1, 22]) { px(g, x, 22, 9, 8, SKIN); px(g, x, 22, 9, 1, SKIN_DK); for (let k = 0; k < 4; k++) px(g, x + 1 + k * 2, 23, 1, 3, SKIN_DK); }
  },
  silence(g, L) {
    body(g, L); head(g);
    px(g, 12, 12, 3, 1, INK); px(g, 17, 12, 3, 1, INK); // 감은 눈
    // 입에 댄 손가락
    px(g, 15, 13, 2, 6, SKIN); px(g, 15, 13, 2, 1, WHITE); px(g, 13, 15, 6, 1, SKIN_DK);
    px(g, 10, 4, 12, 3, '#1a1a2a');
  },
  grudge(g, L) {
    body(g, L); head(g); eyes(g, '#df5a45'); mouth(g, INK, 16, 5);
    px(g, 11, 10, 4, 1, INK); px(g, 17, 10, 4, 1, INK);
    // 흉터
    for (let i = 0; i < 7; i++) px(g, 11 + i, 7 + i, 1, 1, '#8a2a1f');
    px(g, 10, 4, 12, 2, '#3a1010');
  },
  grandmaster(g, L) {
    body(g, L); head(g); eyes(g);
    px(g, 11, 14, 10, 4, WHITE); px(g, 12, 18, 8, 3, WHITE); px(g, 13, 21, 6, 3, WHITE); px(g, 14, 24, 4, 2, WHITE);
    // 왕관
    px(g, 9, 3, 14, 3, '#efbd55'); for (const x of [9, 13, 18, 22]) px(g, x, 1, 1, 2, '#efbd55'); px(g, 15, 0, 2, 3, '#efbd55');
    px(g, 12, 4, 2, 1, '#df5a45'); px(g, 18, 4, 2, 1, '#6fb3c8');
  },
};

const CACHE = new Map();
export function portraitCanvas(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const c = makeCanvas(32, 32);
  const g = context(c);
  const L = LOOK[id] || LOOK.grandmaster;
  (DRAW[id] || DRAW.grandmaster)(g, L);
  CACHE.set(id, c);
  return c;
}
export function drawPortrait(ctx, id, x, y, scale = 1, alpha = 1) {
  const c = portraitCanvas(id);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(c, Math.round(x), Math.round(y), 32 * scale, 32 * scale);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
export const PORTRAIT_IDS = Object.keys(DRAW);
