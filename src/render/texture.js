// 질감: 펠트 천 결 · 판 나뭇결 · 판 테두리 조각 · 가장자리 좌표. 모두 한 번 그려 캐시한다.
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';

// 값이 흩어진 결정적 잡음(0~1)
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// 펠트: 가는 씨실 · 날실이 엇갈리는 은은한 천 결(두 톤 차이 아주 작게)
let feltCv = null;
export function feltCanvas(w, h) {
  if (feltCv && feltCv.width === w && feltCv.height === h) return feltCv;
  feltCv = makeCanvas(w, h);
  const g = context(feltCv);
  g.fillStyle = PAL.felt; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const weave = ((x >> 1) + (y >> 1)) % 2 === 0;
    const n = hash(x, y, 1);
    if (weave && (x + y) % 2 === 0 && n < 0.55) { g.fillStyle = '#1e302b'; g.fillRect(x, y, 1, 1); }
    else if (!weave && n < 0.12) { g.fillStyle = '#18261f'; g.fillRect(x, y, 1, 1); }
  }
  // 드문 보풀
  for (let i = 0; i < (w * h) / 900; i++) { const x = Math.floor(hash(i, 3, 2) * w), y = Math.floor(hash(i, 7, 2) * h); g.fillStyle = PAL.feltHi; g.fillRect(x, y, 2, 1); }
  return feltCv;
}

// 판 여덟 칸 × 여덟 칸 나뭇결(칸 S px). 밝은 칸 · 어두운 칸마다 결 무늬 2~3톤, 칸마다 결 방향 · 위상이 다르다
const WOOD = {
  light: ['#e2cda2', '#dec89c', '#e6d2a9', '#d9c294'],
  dark: ['#a4744a', '#a07046', '#a97a4f', '#9a6b43'],
};
const boardCache = new Map();
export function boardCanvas(S) {
  let c = boardCache.get(S);
  if (c) return c;
  c = makeCanvas(S * 8, S * 8);
  const g = context(c);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const light = (r + f) % 2 === 1;
    const pal = light ? WOOD.light : WOOD.dark;
    const x0 = f * S, y0 = (7 - r) * S;
    const vert = hash(f, r, 5) < 0.5;
    const phase = hash(f, r, 9) * 20, freq = 0.45 + hash(f, r, 11) * 0.25;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = vert ? i : j, v = vert ? j : i;
      const wave = Math.sin((u + Math.sin(v * 0.18 + phase) * 1.6) * freq + phase);
      let k = 0;
      if (wave > 0.9) k = 2; else if (wave < -0.94) k = 3; else if (hash(x0 + i, y0 + j, 3) < 0.03) k = 1;
      g.fillStyle = pal[k]; g.fillRect(x0 + i, y0 + j, 1, 1);
    }
    // 칸 가장자리에 아주 옅은 빛 · 그늘
    g.globalAlpha = 0.18;
    g.fillStyle = '#ffffff'; g.fillRect(x0, y0, S, 1);
    g.fillStyle = '#000000'; g.fillRect(x0, y0 + S - 1, S, 1);
    g.globalAlpha = 1;
  }
  boardCache.set(S, c);
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

// 판 테두리(두께 6): 나무 틀 + 조각된 네 모서리 장식 + 흐린 좌표. (x, y)는 틀 바깥 왼쪽 위
const frameCache = new Map();
export function boardFrameCanvas(S) {
  let c = frameCache.get(S);
  if (c) return c;
  const n = S * 8 + 12;
  c = makeCanvas(n, n);
  const g = context(c);
  g.fillStyle = PAL.frameDk; g.fillRect(0, 0, n, n);
  g.fillStyle = PAL.frame; g.fillRect(1, 1, n - 2, n - 2);
  // 틀 나뭇결: 가로 결(위아래) · 세로 결(양옆)
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const inside = x >= 6 && y >= 6 && x < n - 6 && y < n - 6;
    if (inside) continue;
    const side = x < 6 || x >= n - 6;
    const u = side ? y : x, v = side ? x : y;
    const w = Math.sin(u * 0.21 + Math.sin(v * 1.3) * 2 + (side ? 3 : 0));
    if (w > 0.9) { g.fillStyle = '#4a311c'; g.fillRect(x, y, 1, 1); }
    else if (w < -0.93) { g.fillStyle = '#2f1e10'; g.fillRect(x, y, 1, 1); }
  }
  g.fillStyle = PAL.frameHi; g.fillRect(1, 1, n - 2, 1); g.fillRect(1, 1, 1, n - 2);
  g.fillStyle = PAL.frameDk; g.fillRect(5, 5, n - 10, 1); g.fillRect(5, 5, 1, n - 10);
  g.fillStyle = '#4e331d'; g.fillRect(5, n - 6, n - 10, 1); g.fillRect(n - 6, 5, 1, n - 10);
  // 네 모서리 조각: 작은 마름모 꽃
  const orn = ['..#..', '.#o#.', '#o#o#', '.#o#.', '..#..'];
  for (const [ox, oy] of [[0, 0], [n - 6, 0], [0, n - 6], [n - 6, n - 6]]) {
    orn.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] !== '.') { g.fillStyle = r[i] === '#' ? '#8a5e34' : '#c8902c'; g.fillRect(ox + i, oy + j, 1, 1); } });
  }
  // 좌표(흐리게): 아래 a~h, 왼쪽 1~8
  g.fillStyle = '#7a5634';
  for (let f = 0; f < 8; f++) glyph(g, 'abcdefgh'[f], 6 + f * S + Math.floor(S / 2) - 1, n - 6);
  for (let r = 0; r < 8; r++) glyph(g, String(r + 1), 1, 6 + (7 - r) * S + Math.floor(S / 2) - 2);
  frameCache.set(S, c);
  return c;
}
