// 질감: 바탕 천 결 · 판 가장자리 좌표 글자. 천 결은 한 번 그려 캐시한다(대국 판 · 판 테는 board3.js).
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
