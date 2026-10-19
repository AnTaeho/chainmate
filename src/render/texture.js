// 질감: 바탕 천 결 · 두 빛깔 판 · 판 테 · 칸 안 좌표. 모두 한 번 그려 캐시한다(판은 모습 빛깔마다).
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';

// 값이 흩어진 결정적 잡음(0~1)
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// 펠트 결 한 점: 0 바탕 · 1 밝은 씨실 · 2 어두운 날실. (x, y)는 펠트 판 좌표(음수여도 같은 결이 이어진다 — 판 밖 여백 판 backdrop.js)
export const FELT_WEAVE = [null, '#141834', '#0e1126'];
export function feltWeave(x, y) {
  const weave = (((x >> 1) + (y >> 1)) & 1) === 0;
  const n = hash(x, y, 1);
  if (weave && ((x + y) & 1) === 0 && n < 0.55) return 1;
  if (!weave && n < 0.12) return 2;
  return 0;
}

// 펠트: 가는 씨실 · 날실이 엇갈리는 은은한 천 결(두 톤 차이 아주 작게)
let feltCv = null;
export function feltCanvas(w, h) {
  if (feltCv && feltCv.width === w && feltCv.height === h) return feltCv;
  feltCv = makeCanvas(w, h);
  const g = context(feltCv);
  g.fillStyle = PAL.felt; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = feltWeave(x, y);
    if (k) { g.fillStyle = FELT_WEAVE[k]; g.fillRect(x, y, 1, 1); }
  }
  // 드문 보풀
  for (let i = 0; i < (w * h) / 900; i++) { const x = Math.floor(hash(i, 3, 2) * w), y = Math.floor(hash(i, 7, 2) * h); g.fillStyle = PAL.feltHi; g.fillRect(x, y, 2, 1); }
  return feltCv;
}

// 판 여덟 칸 × 여덟 칸(칸 S px): 상아 칸 · 모습의 어두운 칸(PAL.light · PAL.dark) 평면, 칸 윗변 옅은 빛 · 아랫변 그늘.
// 좌표는 칸 안 모서리에 흐리게(1~8은 a줄 칸 왼쪽 위, a~h는 1단 칸 오른쪽 아래) — 맞은편 칸 빛깔로
const boardCache = new Map();
export function boardCanvas(S) {
  const key = `${S}|${PAL.light}|${PAL.dark}`;
  let c = boardCache.get(key);
  if (c) return c;
  c = makeCanvas(S * 8, S * 8);
  const g = context(c);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const light = (r + f) % 2 === 1;
    const x0 = f * S, y0 = (7 - r) * S;
    g.fillStyle = light ? PAL.light : PAL.dark; g.fillRect(x0, y0, S, S);
    g.globalAlpha = 0.12;
    g.fillStyle = '#ffffff'; g.fillRect(x0, y0, S, 1);
    g.fillStyle = '#000000'; g.fillRect(x0, y0 + S - 1, S, 1);
    g.globalAlpha = 0.55;
    g.fillStyle = light ? PAL.dark : PAL.light;
    if (f === 0) glyph(g, String(r + 1), x0 + 1, y0 + 2);
    if (r === 0) glyph(g, 'abcdefgh'[f], x0 + S - 4, y0 + S - 7);
    g.globalAlpha = 1;
  }
  if (boardCache.size > 12) boardCache.clear();
  boardCache.set(key, c);
  return c;
}

// 3×5 작은 글자(판 가장자리 좌표 a~h · 1~8)
const GLYPH = {
  a: ['...', '.##', '#.#', '#.#', '.##'], b: ['#..', '##.', '#.#', '#.#', '##.'], c: ['...', '.##', '#..', '#..', '.##'], d: ['..#', '.##', '#.#', '#.#', '.##'],
  e: ['...', '.#.', '###', '#..', '.##'], f: ['.##', '#..', '##.', '#..', '#..'], g: ['.##', '#.#', '.##', '..#', '##.'], h: ['#..', '##.', '#.#', '#.#', '#.#'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '##.', '#.#', '.#.'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['.#.', '#.#', '.#.', '#.#', '.#.'],
};
export function glyph(g, ch, x, y) {
  const rows = GLYPH[ch];
  if (!rows) return;
  rows.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') g.fillRect(x + i, y + j, 1, 1); });
}

// 판 테(자리 두께 6): 판 바로 바깥에 크림 테 두 줄(틀 문법 — layout.md 27절). (x, y)는 자리 바깥 왼쪽 위
const frameCache = new Map();
export function boardFrameCanvas(S) {
  let c = frameCache.get(S);
  if (c) return c;
  const n = S * 8 + 12;
  c = makeCanvas(n, n);
  const g = context(c);
  g.fillStyle = PAL.edge;
  g.fillRect(4, 4, n - 8, 2); g.fillRect(4, n - 6, n - 8, 2); g.fillRect(4, 4, 2, n - 8); g.fillRect(n - 6, 4, 2, n - 8);
  frameCache.set(S, c);
  return c;
}
