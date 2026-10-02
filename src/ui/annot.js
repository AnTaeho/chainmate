// 체스 주석 딱지(CHM-43, 희생 2부 — docs/design-notes/layout.md 「!? · !! 주석」).
//   !?  흥미로운 수: 희생으로 새로 뽑은 기물(b.offering.drawn)이 손에 있는 동안 그 카드 구석에. 붉은 바탕
//   !!  탁월수: 그 기물로 시작한 사슬이 체크메이트로 끝난 순간, 메이트 친 칸에서 튀어나온다. 청록 바탕
//   ×N  탁월수 배수: 값 × 배수 칸의 배수 칸에 붙는다. 청록 바탕
// 딱지 글은 글꼴로 쓰지 않고 도트 글자(7줄)로 찍는다 — 작은 칸에 12px 글꼴이 안 들어가고, 글 넘침 검사의 테와 엉키지 않게.
// 자리 셈(handTagRect · boardTagRect · offeredRow)은 그리기와 따로 두어 시험이 잰다(test/annot.test.js).
import { rect } from '../render/gfx.js';

export const ANNOT = {
  red: { fill: '#df5a45', edge: '#8a2a1f', ink: '#fff8e8' },
  teal: { fill: '#1baca6', edge: '#0e6b67', ink: '#ffffff' },
};

// 도트 글자 7줄(굵게 2칸 줄기). 글자 사이 1
const G = {
  '!': ['##', '##', '##', '##', '..', '##', '##'],
  '?': ['.###.', '##.##', '...##', '..##.', '.....', '..##.', '..##.'],
  '×': ['.....', '##.##', '.###.', '..#..', '.###.', '##.##', '.....'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  0: ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  1: ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '####'],
  2: ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
  3: ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
  4: ['...##', '..###', '.#.##', '#..##', '#####', '...##', '...##'],
  5: ['#####', '##...', '####.', '...##', '...##', '##.##', '.###.'],
  6: ['.###.', '##...', '####.', '##.##', '##.##', '##.##', '.###.'],
  7: ['#####', '...##', '..##.', '..##.', '.##..', '.##..', '.##..'],
  8: ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.'],
  9: ['.###.', '##.##', '##.##', '.####', '...##', '...##', '.###.'],
};
export const GLYPH_H = 7;
// 글자열의 폭(배율 s)
export function glyphW(s, scale = 1) {
  const ws = [...String(s)].map((ch) => (G[ch] ? G[ch][0].length : 0));
  return (ws.reduce((a, w) => a + w, 0) + Math.max(0, ws.length - 1)) * scale;
}
export function drawGlyphs(ctx, s, x, y, col, scale = 1) {
  let cx = x;
  for (const ch of String(s)) {
    const g = G[ch];
    if (!g) continue;
    g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') rect(ctx, cx + i * scale, y + j * scale, scale, scale, col); });
    cx += (g[0].length + 1) * scale;
  }
}

// 딱지 크기: 테 1 + 안 여백(가로 padX · 세로 1) + 글자. !!는 두 배 글자에 가로 여백을 넓게
const PAD = { 1: [1, 1], 2: [4, 1] };
export function annotSize(mark, scale = 1) {
  const [px, py] = PAD[scale] || PAD[1];
  return { w: glyphW(mark, scale) + (1 + px) * 2, h: GLYPH_H * scale + (1 + py) * 2 };
}
// 딱지 하나(바탕 · 테 · 도트 글자). 테는 rect로 — box()의 테 기록에 들지 않는다
export function drawAnnot(ctx, mark, x, y, tone = ANNOT.teal, scale = 1) {
  const { w, h } = annotSize(mark, scale);
  const [px, py] = PAD[scale] || PAD[1];
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x, y, w, h, tone.fill);
  rect(ctx, x, y, w, 1, tone.edge); rect(ctx, x, y + h - 1, w, 1, tone.edge);
  rect(ctx, x, y, 1, h, tone.edge); rect(ctx, x + w - 1, y, 1, h, tone.edge);
  drawGlyphs(ctx, mark, x + 1 + px, y + 1 + py, tone.ink, scale);
  return { x, y, w, h };
}

// 손 카드의 「!?」 자리: 오른쪽 위 구석(카드 밖으로 2 · 위로 4 비어져 나온다). 기보 표(chartBadge — 오른쪽 위)가 있으면 왼쪽 위로
export function handTagRect(x, y, w, level = 0) {
  const { w: tw, h: th } = annotSize('!?');
  return { x: level > 0 ? x - 2 : x + w - tw + 2, y: y - 4, w: tw, h: th, left: level > 0 };
}
// 기보 표의 네모(parts.js chartBadge와 같은 셈): 오른끝 x + w − 1, 윗변 y + 1, 높이 7
export function chartBadgeRect(x, y, w, level) {
  const bw = String(Math.min(99, level)).length * 4 + 1;
  return { x: x + w - 1 - bw, y: y + 1, w: bw, h: 7 };
}

// 판 위 「!!」 자리: 메이트 친 칸(sx, sy, 칸 크기 S)의 오른쪽 위 구석에 걸친다.
// 판(bx, by, 8칸) 밖으로 나가면 판 안쪽으로 뒤집는다 — 오른쪽 끝 줄이면 왼쪽 위, 맨 윗줄이면 아래
export function boardTagRect(sq, { bx, by, S, mark = '!!', scale = 2 }) {
  const { w, h } = annotSize(mark, scale);
  const sx = bx + (sq & 7) * S, sy = by + (7 - (sq >> 3)) * S;
  let x = sx + S - 6, y = sy - h + 6;
  const flipX = x + w > bx + S * 8, flipY = y < by;
  if (flipX) x = sx - w + 6;
  if (flipY) y = sy + S - 6;
  return { x, y, w, h, flipX, flipY };
}

// 바친 기물 줄: x0 ~ x1(끝 칸 앞) 안에 반 크기 실루엣(sw 폭, step 걸음)을 늘어놓는다.
// 다 안 들어가면 앞에서부터 들어가는 만큼 그리고 남은 수를 「+N」(작은 숫자 폭 moreW(n))로. 「+N」마저 안 들어가면 fits 거짓
export const moreW = (n) => 4 + String(n).length * 4 - 1; // 「+」 3 + 틈 1 + 숫자(3 + 틈 1)…
export function offeredRow(n, x0, x1, { sw = 8, step = 9 } = {}) {
  const room = x1 - x0;
  if (n <= 0) return { shown: 0, more: 0, xs: [], moreX: null, fits: true };
  if ((n - 1) * step + sw <= room) return { shown: n, more: 0, xs: Array.from({ length: n }, (_, i) => x0 + i * step), moreX: null, fits: true };
  let k = n - 1;
  while (k > 0 && (k * step + moreW(n - k) > room)) k--;
  const more = n - k;
  return { shown: k, more, xs: Array.from({ length: k }, (_, i) => x0 + i * step), moreX: x0 + k * step, fits: k * step + moreW(more) <= room };
}
// 작은 「+N」(3 × 5 숫자, gfx digits와 같은 꼴)
const PLUS = ['000', '010', '111', '010', '000'];
export function drawMore(ctx, n, x, y, col, digits) {
  PLUS.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '1') rect(ctx, x + i, y + j, 1, 1, col); });
  digits(ctx, String(n), x + 4, y, col);
}
