// 마스터 초상(안 3 벡터, docs/design-notes/art3.md): 어깨 · 목 · 머리의 굵은 반신상에 마스터마다 표지 하나.
// 64 단위 상자에 두 톤(왼쪽 빛 · 오른쪽 그늘, 머리 가운데에서 가른다) + 잉크 테로 그리고, (마스터, 크기, 배율 N)마다 한 번 굽는다.
import { two, line, bake, blitVec, INK } from './vec.js';

const SKIN = ['#e3bc96', '#c09070'], WHITE = ['#f4ead2', '#d6c8a8'], STEEL = ['#a8b6c0', '#74868f'], GOLD = ['#f6be45', '#d48b1c'];
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
const HEAD = [32, 25, 12, 14];

// 바탕 반신상: 어깨(겉옷 두 톤) · 목 · 머리. P(모양, [빛, 그늘], 테?) · L(경로, 빛깔, 굵기)
function bust(P, L, look, skin = SKIN) {
  P('M3 64 C4 52 14 45 23 43 L41 43 C50 45 60 52 61 64 Z', [look.robeHi, look.robe]);
  P('M26 43 L32 53 L38 43 Z', [look.robe, look.robe]);
  P('M27 34 L37 34 L37 44 C35 46 29 46 27 44 Z', [skin[1], skin[1]]);
  P(HEAD, skin);
}
const eyes = (P, col = INK, y = 25, r = 1.9) => { P([27, y, r, r * 1.15], [col, col], 0); P([37, y, r, r * 1.15], [col, col], 0); };
const mouth = (L, y = 32, w = 5, col = '#8a5a44') => L(`M${32 - w / 2} ${y} L${32 + w / 2} ${y}`, col, 1.6);

const DRAW = {
  iron_wall(P, L, M) {
    bust(P, L, M); eyes(P); mouth(L);
    // 투구: 윗머리를 덮고 볼 가리개 · 코 가리개
    P('M18.5 27 C17 10 47 10 45.5 27 L45.5 33 L41.5 33 L41.5 22 L22.5 22 L22.5 33 L18.5 33 Z', STEEL);
    P('M30.3 20 L33.7 20 L33.7 31 L30.3 31 Z', STEEL);
    L('M20 21 L44 21', '#dfe7ec', 1.4);
    for (let x = 10; x <= 54; x += 8) P([x, 56, 1.6, 1.6], ['#cfd8de', '#cfd8de'], 0);
  },
  fog(P, L, M) {
    bust(P, L, M, ['#3e504d', '#2a3634']);
    // 두건과 빛나는 청록 눈 · 아래로 흐르는 안개
    P('M15 40 C13 16 21 5 32 5 C43 5 51 16 49 40 L44.5 42 L44.5 24 C41 14 23 14 19.5 24 L19.5 42 Z', [M.robeHi, M.robe]);
    for (const x of [27, 37]) { P([x, 26, 3.4, 2.4], ['rgba(159,224,208,0.35)', 'rgba(159,224,208,0.35)'], 0); P([x, 26, 1.8, 1.4], ['#c8f4ea', '#9fe0d0'], 0); }
    for (const [x, y, w] of [[6, 50, 14], [40, 54, 18], [18, 59, 16], [46, 61, 12]]) L(`M${x} ${y} L${x + w} ${y}`, 'rgba(200,230,225,0.5)', 2.2);
  },
  mirror(P, L, M) {
    bust(P, L, M);
    // 오른쪽 얼굴이 거울빛 — 가르는 흰 줄
    P('M32 11 C40 11 44 18 44 25 C44 33 40 39 32 39 Z', ['#c8d6ea', '#a6b6d0'], 0);
    P([27, 25, 1.9, 2.2], [INK, INK], 0); P([37, 25, 1.9, 2.2], ['#5d6f98', '#5d6f98'], 0);
    L('M27.5 32 L31.5 32', '#8a5a44', 1.6); L('M32.5 32 L36.5 32', '#8a9ab8', 1.6);
    P('M20 19 C21 9 43 9 44 19 C38 15 26 15 20 19 Z', ['#3a2a1c', '#2a1c10']);
    L('M32 11.5 L32 38.5', '#ffffff', 1.4);
    P(HEAD, [null, null]);
  },
  hourglass(P, L, M) {
    bust(P, L, M); eyes(P);
    L('M24 21 L30 21 M34 21 L40 21', '#f4ead2', 2);
    // 흰 수염
    P('M20.5 28 C20.5 40 26 51 32 53 C38 51 43.5 40 43.5 28 C39 33.5 25 33.5 20.5 28 Z', WHITE);
    L('M28.5 32 C30.5 33 33.5 33 35.5 32', '#a89878', 1.4);
    // 모래시계
    P('M4 4 L18 4 L18 7 L4 7 Z', ['#a07a48', '#7a5630']);
    P('M4 27 L18 27 L18 30 L4 30 Z', ['#a07a48', '#7a5630']);
    P('M6 7 L16 7 L11 17 L16 27 L6 27 L11 17 Z', ['rgba(244,234,210,0.55)', 'rgba(214,200,168,0.55)']);
    P('M7.5 9 L14.5 9 L11 15 Z', GOLD, 0);
    P('M11 21 L15 26 L7 26 Z', GOLD, 0);
  },
  heavy_hand(P, L, M) {
    bust(P, L, M); eyes(P); mouth(L, 32, 8, INK);
    L('M23 21 L30 22.5 M34 22.5 L41 21', INK, 2.6);
    // 큰 주먹 둘
    for (const x of [2, 44]) {
      P(`M${x} 46 C${x} 43 ${x + 18} 43 ${x + 18} 46 L${x + 18} 60 C${x + 18} 63 ${x} 63 ${x} 60 Z`, SKIN);
      L(`M${x + 4.5} 46 L${x + 4.5} 51 M${x + 9} 46 L${x + 9} 51 M${x + 13.5} 46 L${x + 13.5} 51`, '#a8795a', 1.4);
    }
  },
  silence(P, L, M) {
    bust(P, L, M);
    P('M20 20 C20 9 44 9 44 20 C38 15.5 26 15.5 20 20 Z', ['#2a2a3e', '#1a1a2a']);
    L('M24.5 25.5 C26 27 28 27 29.5 25.5 M34.5 25.5 C36 27 38 27 39.5 25.5', INK, 1.6);
    // 입에 댄 손가락
    P([32, 44, 6.5, 4.5], SKIN);
    P('M30 28 C30 26 34 26 34 28 L34 42 L30 42 Z', SKIN);
    L('M30.8 28.6 L33.2 28.6', '#f4ead2', 1.2);
  },
  grudge(P, L, M) {
    bust(P, L, M); eyes(P, '#df5a45', 25.5, 2.1);
    L('M23 21 L30 23.5 M34 23.5 L41 21', INK, 2.2);
    L('M28 33.5 C30 31.5 34 31.5 36 33.5', INK, 1.8);
    P('M20 19 C21 9 43 9 44 19 C38 15 26 15 20 19 Z', ['#4a1414', '#3a1010']);
    // 흉터
    L('M22 17 L33 31', '#8a2a1f', 1.8);
    L('M24.5 21 L27 19.5 M27.5 25 L30 23.5 M30.5 29 L33 27.5', '#8a2a1f', 1.1);
  },
  grandmaster(P, L, M) {
    bust(P, L, M); eyes(P);
    // 긴 흰 수염 · 콧수염
    P('M21 28 C20 44 26 57 32 60 C38 57 44 44 43 28 C39 34 25 34 21 28 Z', WHITE);
    P('M25 31 C28 29 32 30 32 31.5 C32 30 36 29 39 31 C36 33.5 28 33.5 25 31 Z', WHITE);
    // 왕관
    P('M19 15 L18 4 L24 9 L28 2 L32 8 L36 2 L40 9 L46 4 L45 15 Z', GOLD);
    P([26, 12, 1.6, 1.6], ['#df5a45', '#b03a2a'], 0); P([38, 12, 1.6, 1.6], ['#6fb3c8', '#4a8aa0'], 0);
  },
};

function paintPortrait(g, id, k) {
  const M = LOOK[id] || LOOK.grandmaster;
  const LW = Math.max(1.6, 1 / k);
  const P = (sh, col, lw = LW) => {
    if (!col[0]) { two(g, sh, 'rgba(0,0,0,0)', null, 32, INK, LW); return; } // 테만
    two(g, sh, col[0], col[1], 32, INK, lw ? Math.max(lw, 1 / k) : 0);
  };
  const L = (d, col, w) => line(g, d, col, Math.max(w, 1 / k));
  (DRAW[id] || DRAW.grandmaster)(P, L, M);
}

const paintAt = (id, size) => (g, n) => { const u = size / 64; g.scale(u, u); paintPortrait(g, id, u * n); };
// 초상 캔버스(32 논리 자리): hi면 두 배(64 × 64 화소), 아니면 32 × 32
export function portraitCanvas(id, hi = false) { return bake(`portrait:${id}`, 32, 32, hi ? 2 : 1, paintAt(id, 32)); }
export function drawPortrait(ctx, id, x, y, scale = 1, alpha = 1) {
  const size = 32 * scale;
  blitVec(ctx, `portrait:${id}`, x, y, size, size, paintAt(id, size), alpha);
}
export const PORTRAIT_IDS = Object.keys(DRAW);
