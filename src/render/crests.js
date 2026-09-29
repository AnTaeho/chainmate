// 세력 문장(紋章) 12×12 도트 여덟: 낫(농민군) · 말굽(기병대) · 등불(수도원) · 성탑(성채) · 활(숲 사냥꾼) · 뿔나팔(전령단) · 금화(용병단) · 왕관(왕궁 근위).
// 글자: o 테(짙은 먹) · # 세력 빛깔 · h 밝은 빛 · s 은빛(쇠 · 시위) · w 나무 · . 빈칸.
import { rect } from './gfx.js';
import { FACTION_BY_ID } from '../data/factions.js';

export const CREST = {
  sickle: [
    '....oooo....',
    '..oo####o...',
    '.o##oooo#o..',
    'o#oo....o#o.',
    'o#o......o..',
    'o#o.........',
    'o##o........',
    '.o##o..oo...',
    '..o###owwo..',
    '...ooo.owwo.',
    '.......owwo.',
    '........oo..',
  ],
  horseshoe: [
    '.oo......oo.',
    'o##o....o##o',
    'o#so....os#o',
    'o##o....o##o',
    'o#so....os#o',
    'o##o....o##o',
    'o##oo..oo##o',
    '.o###oo###o.',
    '.o########o.',
    '..o######o..',
    '...oooooo...',
    '............',
  ],
  lantern: [
    '.....oo.....',
    '....o##o....',
    '...oooooo...',
    '..o######o..',
    '..o#hhhh#o..',
    '..o#hhhh#o..',
    '..o#hhhh#o..',
    '..o#hhhh#o..',
    '..o######o..',
    '...oooooo...',
    '....o##o....',
    '.....oo.....',
  ],
  tower: [
    '.oo.oooo.oo.',
    '.o#oo##oo#o.',
    '.o########o.',
    '..o######o..',
    '..o##oo##o..',
    '..o#o..o#o..',
    '..o######o..',
    '..o######o..',
    '..o##oo##o..',
    '..o#o..o#o..',
    '.o########o.',
    '.oooooooooo.',
  ],
  bow: [
    '...oo.......',
    '..o##o......',
    '.o#o.so.....',
    '.o#o..s.....',
    'o#o...s..o..',
    'o#wwwwwwwsso',
    'o#o...s..o..',
    '.o#o..s.....',
    '.o#o.so.....',
    '..o##o......',
    '...oo.......',
    '............',
  ],
  horn: [
    '............',
    '.........oo.',
    '........o##o',
    '.......o#h#o',
    'o.....o##h#o',
    'oo...o###h#o',
    'o#ooo####h#o',
    'o########h#o',
    '.oo######h#o',
    '...ooooo##o.',
    '........oo..',
    '............',
  ],
  coin: [
    '...oooooo...',
    '..o######o..',
    '.o##hhhh##o.',
    'o##h####h##o',
    'o#h##oo##h#o',
    'o#h#o##o#h#o',
    'o#h#o##o#h#o',
    'o#h##oo##h#o',
    'o##h####h##o',
    '.o##hhhh##o.',
    '..o######o..',
    '...oooooo...',
  ],
  crown: [
    '............',
    '.o...oo...o.',
    'o#o.o##o.o#o',
    'o#o.o##o.o#o',
    'o##o#hh#o##o',
    'o##########o',
    'o#h#h##h#h#o',
    'o##########o',
    'oooooooooooo',
    'o##########o',
    'oooooooooooo',
    '............',
  ],
};
export const CREST_SIZE = 12;

const INK = '#140f0c', STEEL = '#d8dee6', WOOD = '#8a5a30';
const lighten = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// 세력 id의 문장을 (x, y)에 scale배로. alpha로 흐리게(지나간 · 남은 관), dim이면 먹빛 하나로(아직 만나지 않은 세력)
export function drawCrest(ctx, id, x, y, { scale = 1, alpha = 1, dim = false } = {}) {
  const f = FACTION_BY_ID[id];
  if (!f) return;
  const rows = CREST[f.crest];
  const col = { o: INK, '#': dim ? '#3a4a44' : f.hue, h: dim ? '#4a5a54' : lighten(f.hue, 0.55), s: dim ? '#4a5a54' : STEEL, w: dim ? '#3a4a44' : WOOD };
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = col[row[i]];
      if (c) rect(ctx, x + i * scale, y + j * scale, scale, scale, c);
    }
  });
  ctx.globalAlpha = a0;
}
