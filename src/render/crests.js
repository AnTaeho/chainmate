// 세력 문장(紋章) 여덟(안 3 벡터, docs/design-notes/art3.md): 낫(농민군) · 말굽(기병대) · 등불(수도원) · 성탑(성채) · 활(숲 사냥꾼) · 뿔나팔(전령단) · 금화(용병단) · 왕관(왕궁 근위).
// 24 단위 상자에 세력 빛깔 두 톤 + 잉크 테로 그리고, (문장, 빛깔, 크기, 배율 N)마다 한 번 구워 12 × scale 자리에 붙인다.
import { two, line, blitVec, INK } from './vec.js';
import { FACTION_BY_ID } from '../data/factions.js';

export const CREST_SIZE = 12;
export const CREST_IDS = ['sickle', 'horseshoe', 'lantern', 'tower', 'bow', 'horn', 'coin', 'crown'];

const STEEL = ['#e4eaf0', '#a8b4c0'], WOOD = ['#a8723e', '#7a4e26'];
const DIM = { body: ['#3a4a54', '#334250'], hi: '#4a5a64', steel: ['#4a5a64', '#4a5a64'], wood: ['#3a4a54', '#3a4a54'] };
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// 문장마다 그리기: P(모양, 빛깔쌍) — 두 톤 + 테. 빛깔쌍: b 몸 · s 쇠 · w 나무, h 밝은 빛 하나
const DRAW = {
  sickle(P, C) {
    P('M8 14 L11 12.5 L16.5 20.5 L13.5 22 Z', C.w);
    P('M5 15 C2.5 7 9.5 1.5 17.5 2.5 C20.5 3 21.5 5 20 6.5 C14 5 9 8 9.5 15 Z', C.b);
  },
  horseshoe(P, C, L) {
    P('M3.5 3 L9.5 3 L9.5 13 C9.5 17 14.5 17 14.5 13 L14.5 3 L20.5 3 L20.5 13 C20.5 23.5 3.5 23.5 3.5 13 Z', C.b);
    for (const [x, y] of [[6.5, 6.5], [6.5, 11], [17.5, 6.5], [17.5, 11]]) P([x, y, 1.2, 1.2], C.s, 0);
  },
  lantern(P, C) {
    P('M12 1 C14.5 1 15 4 14 5 L10 5 C9 4 9.5 1 12 1 Z', C.s);
    P('M6.5 8.5 L9 5 L15 5 L17.5 8.5 Z', C.b);
    P('M6.5 8.5 L17.5 8.5 L17.5 19 L6.5 19 Z', C.b);
    P('M9 10.5 L15 10.5 L15 17 L9 17 Z', [C.h, C.h]);
    P('M12 11.5 C13.8 13.5 13.8 15.5 12 16.3 C10.2 15.5 10.2 13.5 12 11.5 Z', C.f, 0);
    P('M8 19 L16 19 L14.5 22 L9.5 22 Z', C.b);
  },
  tower(P, C) {
    P('M5 22.5 L6.5 9 L4 9 L4 2.5 L7.5 2.5 L7.5 5 L10.2 5 L10.2 2.5 L13.8 2.5 L13.8 5 L16.5 5 L16.5 2.5 L20 2.5 L20 9 L17.5 9 L19 22.5 Z', C.b);
    P('M9.5 22.5 L9.5 18 C9.5 15.2 14.5 15.2 14.5 18 L14.5 22.5 Z', [INK, INK], 0);
    P('M11 9.5 L13 9.5 L13 13 L11 13 Z', [INK, INK], 0);
  },
  bow(P, C, L) {
    L('M10.5 3.5 L10.5 20.5', C.s[1], 1);
    P('M8.5 1.5 C0.5 7 0.5 17 8.5 22.5 L11.2 20.3 C6 16 6 8 11.2 3.7 Z', C.b);
    P('M3 11 L18 11 L18 13 L3 13 Z', C.w);
    P('M22.5 12 L17 8.5 L17 15.5 Z', C.s);
    P('M2 9.5 L5.5 11 L5.5 13 L2 14.5 Z', [C.h, C.h]);
  },
  horn(P, C) {
    P('M2.5 9.5 L2.5 13.5 L6.5 13 C10.5 16.5 15 18.5 19.5 21.5 C22.5 15 22.5 7 18.5 2.5 C16 7.5 11.5 10 6.5 10 Z', C.b);
    P('M18.5 2.5 C22.5 7 22.5 15 19.5 21.5 L17.5 20.5 C20 14.5 20 8 16.8 4.5 Z', [C.h, C.h], 0);
    P('M1 9 L3 9 L3 14 L1 14 Z', C.s);
  },
  coin(P, C, L) {
    P([12, 12, 10, 10], C.b);
    P([12, 12, 6.8, 6.8], [C.h, C.h], 0);
    P('M9.5 9.5 L14.5 9.5 L14.5 14.5 L9.5 14.5 Z', C.b);
  },
  crown(P, C) {
    P('M3 18 L1.5 6.5 L7 11.5 L12 3 L17 11.5 L22.5 6.5 L21 18 Z', C.b);
    P('M3 18 L21 18 L21 21.5 L3 21.5 Z', C.b);
    for (const [x, y] of [[1.5, 5.5], [12, 2.5], [22.5, 5.5]]) P([x, y, 1.6, 1.6], [C.h, C.h]);
    for (const x of [7.5, 12, 16.5]) P([x, 19.8, 1, 1], [C.h, C.h], 0);
  },
};

function paintCrest(g, crest, hue, dim, k) {
  const C = dim ? { b: DIM.body, h: DIM.hi, s: DIM.steel, w: DIM.wood, f: DIM.body } : { b: [hue, mix(hue, '#000000', 0.28)], h: mix(hue, '#ffffff', 0.6), s: STEEL, w: WOOD, f: ['#f6be45', '#d48b1c'] };
  // k: 24 단위 한 단위의 기기 화소. 테는 기기 화소 1 밑으로 가늘어지지 않는다
  const LW = Math.max(1.5, 1 / k);
  const P = (sh, col, lw = LW) => two(g, sh, col[0], col[1], 12, INK, lw ? Math.max(lw, 1 / k) : 0);
  const L = (d, col, w) => line(g, d, col, Math.max(w, 1 / k));
  (DRAW[crest] || DRAW.coin)(P, C, L);
}

// 세력 id의 문장을 (x, y)에 scale배로. alpha로 흐리게(지나간 · 남은 관), dim이면 먹빛 하나로(아직 만나지 않은 세력)
export function drawCrest(ctx, id, x, y, { scale = 1, alpha = 1, dim = false } = {}) {
  const f = FACTION_BY_ID[id];
  if (!f) return;
  const size = CREST_SIZE * scale;
  blitVec(ctx, `crest:${f.crest}:${f.hue}:${dim ? 1 : 0}`, x, y, size, size, (g, n) => {
    const u = size / 24;
    g.scale(u, u);
    paintCrest(g, f.crest, f.hue, dim, u * n);
  }, alpha);
}
