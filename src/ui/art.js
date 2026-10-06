// 물건 그림(CHM-69, docs/design-notes/layout.md 「종류 표시」): 진열 카드 · 뒤집히는 카드 · 두루마리 칸이 같은 그림 칸을 쓴다.
// 그림 칸은 어두운 칸 하나(22×26, 진화만 44×26, 두루마리 칸은 18×22)이고 그림은 잉크 상자가 칸 가운데에 오게 놓는다(render/ink.js).
// 화면 배율 2 이상(hiFor): 칸을 반 칸 캔버스(두 배)에 구워 정수 칸에 놓는다 — 반 칸 자리에 따로 그리면 N = 3에서 번진다.
// 1배 화면: 옛 1배 그림을 잉크 가운데로(물약 · 룰렛은 옛 그림이 글자였어서 16×16 원본).
import { PAL } from '../render/palette.js';
import { rect, frame, sprite, place, soulSpark, artOf } from '../render/gfx.js';
import { makeCanvas, context } from '../render/surface.js';
import { baked, hiFor, tierOf, spriteCanvas, spritePixels, spritePixelsHi, tierSparkle } from '../render/sprites.js';
import { TACTIC_HI, SHARD_HI, MAXIM_ART, EMBLEM_ART, TACTIC_ART, SOUL_ART, SHARD_ART, POTION_ART, ROULETTE_ART, AWAKEN_ART } from '../render/art-hi.js';
import { POTION16, ROULETTE16 } from '../render/art16.js';
import { ICON_ROWS, drawIconLight } from '../render/icons.js';
import { ART, inkBox, centre } from '../render/ink.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { chartForm } from '../data/pieces.js';

// 그림 칸 바탕과 윗줄 한 줄 빛
export const CELL = { bg: '#1b2b27', top: '#2a3a33' };
// 기보 = 「이 모습일 때」: 네 귀 꺾쇠
export const CHART_TICK = '#8fd3c6';

// 각인 그림: 기물 없이 재료 하나(금화 · 은판 · 상아 조각 · 흑단 나뭇조각 · 유리 조각 · 깃털). 16×16 도트 — 1배 화면의 그림(빛깔 c는 두 배 그림도 쓴다).
// 각인은 주머니의 어느 기물에나 새기므로 기물을 그리지 않는다(나이트를 그리면 나이트에만 붙는 것처럼 보였다).
export const EMBLEM = {
  gold: { c: { o: '#6b4410', m: '#c8902c', h: '#efbd55', w: '#fff1b8' }, g: ['.....oooooo.....', '...oommmmmmoo...', '..ommhhhhhhmmo..', '.omhhwwhhhhhhmo.', '.omhwwhhhhhhhmo.', 'omhhhhmmmmhhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhhmmmmhhhhmo', '.omhhhhhhhhhhmo.', '.omhhhhhhhhhhmo.', '..ommhhhhhhmmo..', '...oommmmmmoo...', '.....oooooo.....'] },
  silver: { c: { o: '#4a5560', m: '#9aa6b0', h: '#d8dee6', w: '#ffffff' }, g: ['................', '................', '..oooooooooooo..', '.ohhhhhhhhhhhmo.', '.ohwwhhhhhhhhmo.', '.ohwhhhhhhhhhmo.', '.ohhhhhwhhhhhmo.', '.ohhhhwhhhhhhmo.', '.ohhhwhhhhhhhmo.', '.ohhhhhhhhhwhmo.', '.ohhhhhhhhwhhmo.', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................', '................'] },
  ivory: { c: { o: '#8a6a4a', m: '#d8c4a4', h: '#f7efdb', w: '#ffffff' }, g: ['..........oo....', '.........ohho...', '........ohwho...', '.......ohwhho...', '......ohwhhmo...', '.....ohhhhmo....', '....ohhhhmo.....', '...ohhhhmo......', '..ohhhhmo.......', '..ohhhmo........', '.ohhhmo.........', '.ohhmmo.........', '.ohmmo..........', '..oooo..........', '................', '................'] },
  ebony: { c: { o: '#1e1612', m: '#3e2f28', h: '#6b5a52', w: '#c8902c' }, g: ['................', '................', '...ooooooooo....', '..ohhmhhhhhmoo..', '..ohmhhhmhhhhmo.', '.ohhmhhhmhhhhmo.', '.ohmhhhhmhhhhhmo', '.ommmhhhhmmhhhmo', '.ohhhmmhhhhmmmmo', '.ohhhhhmhhhhhhmo', '..ohhhhmhhhwhmo.', '..ommmmmmmmmmo..', '...oooooooooo...', '................', '................', '................'] },
  glass: { c: { o: '#3f7f8a', m: '#6fb8c4', h: '#bfe0e6', w: '#ffffff' }, g: ['.......o........', '......owo.......', '......owho......', '.....owhho......', '.....owhhho.....', '....owhhhho.....', '....owhhhhmo....', '...owhhhhhmo....', '...owhhhhhhmo...', '..owhhhhhhhmo...', '..owhhhhhhhhmo..', '.owhhhhhhhhhmo..', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................'] },
  feather: { c: { o: '#3a6a60', m: '#6fd1bf', h: '#e8e0f0', w: '#ffffff' }, g: ['...........ooo..', '.........oohhmo.', '........ohhhhmo.', '.......ohhhhmo..', '......ohhwhmo...', '.....ohhwhmo....', '....ohhwhmo.....', '....ohwhmo......', '...ohwhmo.......', '...owhmo........', '..owmo..........', '..omo...........', '.oo.............', 'o...............', '................', '................'] },
  // 밤샘 2: 청동 종 · 철 덩이 · 벌레 든 호박 · 비취 고리 · 산호 가지 · 결 있는 대리석
  bronze: { c: { o: '#5a3414', m: '#a0602a', h: '#d08a48', w: '#f0c090' }, g: ['.......oo.......', '......ommo......', '.....ohhhmo.....', '....ohwhhhmo....', '....ohwhhhmo....', '...ohwhhhhhmo...', '...ohhhhhhhmo...', '...ohhhhhhhmo...', '..ohhhhhhhhhmo..', '..ohhhhhhhhhmo..', '.ohhhhhhhhhhhmo.', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '.......oo.......', '......omo.......', '.......o........'] },
  iron: { c: { o: '#2a2e33', m: '#555c63', h: '#8a9299', w: '#c8d0d6' }, g: ['................', '................', '................', '....oooooooo....', '...ohhwhhhhmo...', '..ohhwhhhhhhmo..', '.ohhhhhhhhhhhmo.', 'ommmmmmmmmmmmmmo', 'ommmmmmmmmmmmmmo', '.oooooooooooooo.', '................', '................', '................', '................', '................', '................'] },
  amber: { c: { o: '#6a3a08', m: '#c87a14', h: '#f0a830', w: '#ffe0a0' }, g: ['.......oo.......', '......ohho......', '.....ohwhho.....', '.....owhhho.....', '....owhhhhmo....', '...ohwhhhhhmo...', '...owhhoohhmo...', '..ohhhoooohhmo..', '..ohhhhoohhhmo..', '..ohhhhhhhhhmo..', '..ohhhhhhhhhmo..', '...ohhhhhhhmo...', '....ommmmmmo....', '.....oooooo.....', '................', '................'] },
  jade: { c: { o: '#1e5a3a', m: '#3f9a60', h: '#7fd09a', w: '#d0ffe0' }, g: ['.....oooooo.....', '...oohhhhhhoo...', '..ohhwwhhhhhmo..', '.ohwwhhhhhhhhmo.', '.ohwhhooooohhmo.', 'ohhhho....ohhhmo', 'ohhho......ohhmo', 'ohhho......ohhmo', 'ohhho......ohhmo', 'ohhhho....ohhhmo', '.ohhhhooooohhmo.', '.ohhhhhhhhhhhmo.', '..ommhhhhhhmmo..', '...oommmmmmoo...', '.....oooooo.....', '................'] },
  coral: { c: { o: '#7a2a2a', m: '#d05a50', h: '#f08878', w: '#ffd0c8' }, g: ['..o.....o....o..', '.oho...oho..oho.', '.oho...oho..oho.', '.ohho..oho.ohho.', '..oho..ohooho...', '..ohhooohhhmo...', '...ohhhhhhmo....', '....ohhhhmo.....', '.....ohhmo......', '.....ohhmo......', '.....ohhmo......', '....ohhhhmo.....', '...ommmmmmmo....', '...ooooooooo....', '................', '................'] },
  marble: { c: { o: '#3a3a4a', m: '#7a70a8', h: '#e8e4f8', w: '#ffffff' }, g: ['................', '................', '.oooooooooooooo.', '.ohhhhhhhmhhhho.', '.ohwhhhhmhhhhho.', '.ohhhhhmhhhhhho.', '.ohhhhmhhhhhhmo.', '.ohhhhhmmhhhhmo.', '.ohhhhhhhmhhhmo.', '.ohhmhhhhhmhhmo.', '.ohhhmmhhhhhhmo.', '.ommmmmmmmmmmmo.', '.oooooooooooooo.', '................', '................', '................'] },
};
// 옛 1배 재료 그림(16×16 자리). 화면 배율 2 이상의 그림 칸은 itemArt가 art16.js 그림으로 그린다
export function engravingEmblem(ctx, id, x, y, { sq = true } = {}) {
  if (sq) { rect(ctx, x, y, 22, 26, CELL.bg); rect(ctx, x + 1, y + 1, 20, 1, CELL.top); }
  const e = EMBLEM[id];
  if (!e) return;
  e.g.forEach((r, j) => { for (let i = 0; i < 16; i++) { const k = r[i]; if (k !== '.') rect(ctx, x + 3 + i, y + 5 + j, 1, 1, e.c[k]); } });
}
// 혼 그림(1배 화면): 기물 없이 혼의 빛깔로 도는 기운(혼도 주머니의 어느 기물에나 깃든다)
export function soulEmblem(ctx, id, x, y, t = 0, { sq = true } = {}) {
  const s = SOUL_BY_ID[id];
  if (sq) rect(ctx, x, y, 22, 26, CELL.bg);
  const cx = x + 11, cy = y + 13;
  for (let r = 8; r >= 2; r -= 2) { ctx.globalAlpha = 0.18 + (8 - r) * 0.06; for (let a = 0; a < 24; a++) { const q = (a / 24) * Math.PI * 2; rect(ctx, Math.round(cx + Math.cos(q) * r), Math.round(cy + Math.sin(q) * r), 1, 1, s.col); } }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 3; k++) { const q = t * 2 + (k * Math.PI * 2) / 3; rect(ctx, Math.round(cx + Math.cos(q) * 6), Math.round(cy + Math.sin(q) * 6), 2, 2, s.col); }
  // 가운데 문양(5×5): 혼이 열여섯이 되어 빛깔만으로는 갈리지 않는다(밤샘 2)
  const g = SOUL_GLYPH[id];
  if (g) { rect(ctx, cx - 3, cy - 3, 7, 7, '#1b2b27'); g.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') rect(ctx, cx - 2 + i, cy - 2 + j, 1, 1, PAL.white); }); }
  else rect(ctx, cx - 1, cy - 1, 3, 3, PAL.white);
}
// 작은 혼 표(9×9): 혼 빛깔 바탕에 가운데 문양(도감 칸처럼 좁은 곳)
export function soulGlyph(ctx, id, x, y) {
  const s = SOUL_BY_ID[id];
  rect(ctx, x, y, 9, 9, '#1b2b27');
  frame(ctx, x, y, 9, 9, s.col);
  const g = SOUL_GLYPH[id];
  if (g) g.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') rect(ctx, x + 2 + i, y + 2 + j, 1, 1, PAL.white); });
}
export const SOUL_GLYPH = {
  absorb: ['.###.', '#...#', '#.###', '#....', '.####'], echo: ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  transcend: ['..#..', '.###.', '#.#.#', '..#..', '..#..'], hunger: ['#.#.#', '#.#.#', '#####', '..#..', '..#..'],
  hunter: ['..#..', '.###.', '##.##', '.###.', '..#..'], martyr: ['..#..', '#####', '..#..', '..#..', '..#..'],
  crown: ['##...', '###..', '####.', '#....', '#....'], shade: ['#...#', '.###.', '.....', '.###.', '#...#'],
  inherit: ['#####', '#...#', '#.#.#', '..#..', '.###.'], relay: ['#....', '.#...', '..###', '...#.', '....#'],
  retro: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'], duel: ['#...#', '##.##', '.###.', '##.##', '#...#'],
  reaper: ['.###.', '#.#.#', '#####', '.#.#.', '.....'], spring: ['#####', '...#.', '..#..', '.#...', '#####'],
  homing: ['.###.', '#...#', '#.#..', '..##.', '.###.'], ripple: ['.#.#.', '#...#', '..#..', '#...#', '.#.#.'],
};

export function awakenArt(ctx, x, y, t = 0, { sq = true } = {}) {
  if (sq) rect(ctx, x, y, 22, 26, CELL.bg);
  const cx = x + 11, cy = y + 13;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = i * i + j * j; if (d <= 25) rect(ctx, cx + i, cy + j, 1, 1, d > 16 ? PAL.goldDk : i + j < -3 ? PAL.goldHi : PAL.gold); }
  for (const [i, j] of [[-1, -5], [0, -4], [0, -3], [1, -2], [1, -1], [0, 0], [1, 1], [2, 2], [2, 3]]) rect(ctx, cx + i, cy + j, 1, 1, PAL.ink);
  const k = Math.floor(t * 4) % 4;
  for (let r = 0; r < 4; r++) { const q = (r * Math.PI) / 2 + Math.PI / 4; const d = 7 + ((k + r) % 2); rect(ctx, Math.round(cx + Math.cos(q) * d), Math.round(cy + Math.sin(q) * d), 1, 1, PAL.goldHi); }
}
// 명국 조각 모양(금빛 깨진 판 조각) 16×14 — 작은 자리(금빛 꾸러미 건너뛰기 줄 · 마스터의 상자 · 결과)와 1배 그림 칸
export const SHARD_ROWS = ['..####..', '.######.', '########', '#######.', '.#####..', '..###...', '...#....'];
export function shardIcon(ctx, x, y, col = PAL.gold, dk = PAL.goldDk) {
  // 화면 배율 2 이상: 두 번 다듬은 32×28 반 도트 조각(art-hi.js, CHM-39 2단계)을 같은 16×14 자리에
  if (hiFor(ctx)) { ctx.drawImage(baked(`shard:${col}:${dk}`, SHARD_HI, { c: [col, 1], h: [PAL.goldHi, 1], d: [dk, 1] }), place(x), place(y), 16, 14); return; }
  const rows = SHARD_ROWS;
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') rect(ctx, x + i * 2, y + j * 2, 2, 2, (i + j) % 4 === 0 ? PAL.goldHi : j > 3 ? dk : col); });
}


// 전술 그림 16×11: 빙결 = 눈송이 · 재장전 = 수 구슬 더하기 · 도발 = 손짓하는 폰 — 작은 자리(대국 손 줄)와 1배 그림 칸
export const TACTIC_G = {
  freeze: ['.......#........', '...#...#...#....', '....#..#..#.....', '.....#.#.#......', '......###.......', '.#############..', '......###.......', '.....#.#.#......', '....#..#..#.....', '...#...#...#....', '.......#........'],
  reload: ['................', '..##########....', '..#........#....', '..##########....', '................', '.......##.......', '.......##.......', '....########....', '....########....', '.......##.......', '.......##.......'],
  taunt: ['......##........', '.....####....#..', '.....####...#...', '......##...#....', '....######......', '......##........', '......##........', '.....####.......', '....######......', '...########.....', '................'],
};
export const TACTIC_COL = { freeze: '#9fd3e0', reload: '#efbd55', taunt: '#df8a45' };
export function tacticIcon(ctx, id, x, y) {
  const G = TACTIC_G[id] || [];
  const col = TACTIC_COL[id] || '#ffffff';
  // 화면 배율 2 이상: 32×22 반 도트 그림(art-hi.js, CHM-39 2단계)을 같은 16×11 자리에
  if (TACTIC_HI[id] && hiFor(ctx)) { ctx.drawImage(baked(`tactic:${id}`, TACTIC_HI[id], { '#': [col, 1] }), place(x), place(y), 16, 11); return; }
  G.forEach((r, j) => { for (let i = 0; i < 16; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, col); });
}

// ── 그림 칸
// 격언 그림 빛깔(어두운 칸 위): art16.js MAXIM16의 문자
export const MAXIM_COL = { '#': '#fff1b8', d: '#b79c68', k: '#2a1c10', g: '#d9a23a', o: '#8a5f1c', r: '#c94a37', w: '#ffffff', s: '#9fb0bc', p: '#a77ad6', b: '#6f9ad8', G: '#7fb85f' };
const SHARD_COL = { c: PAL.gold, h: PAL.goldHi, d: PAL.goldDk };
const AWAKEN_COL = { D: PAL.goldDk, g: PAL.gold, h: PAL.goldHi, k: CELL.bg };
// 도박의 도는 빛깔: 한 바퀴를 스물넷으로 끊는다(구운 칸을 그만큼만 둔다)
const gambleHue = (t) => (Math.floor((t * 200) / 15) * 15) % 360;
const gambleCols = (id, hue) => (id === 'roulette'
  ? { R: '#efbd55', A: `hsl(${hue},70%,62%)`, B: '#0f1a17', H: '#fff1b8', n: '#fff8e8' }
  : { c: '#b07a44', o: '#bfe0e6', h: '#ffffff', l: `hsl(${hue},70%,62%)` });
// 혼: 굵은 고리(지름 16) + 안쪽 흐린 기운 + 가운데 문양(14×14 반 칸). R 고리 · a b 기운 · k 칸 바탕 · # 문양
const SOUL_ROWS = new Map();
export function soulRows(id) {
  if (SOUL_ROWS.has(id)) return SOUL_ROWS.get(id);
  const g = Array.from({ length: 32 }, () => Array(32).fill('.'));
  for (let j = -16; j < 16; j++) for (let i = -16; i < 16; i++) {
    const d = Math.hypot(i + 0.5, j + 0.5);
    if (d <= 16 && d > 13.6) g[j + 16][i + 16] = 'R';
    else if (d <= 13.6 && d > 7) g[j + 16][i + 16] = (i + j) & 1 ? 'a' : 'b';
  }
  for (let j = 8; j < 24; j++) for (let i = 8; i < 24; i++) g[j][i] = 'k';
  const m = SOUL_ART[id] || ['....', '.##.', '.##.', '....'];
  const o = centre(32, 32, inkBox(m));
  m.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') g[o.y + j][o.x + i] = '#'; });
  const rows = g.map((r) => r.join(''));
  SOUL_ROWS.set(id, rows);
  return rows;
}
const soulCols = (id) => { const c = SOUL_BY_ID[id] ? SOUL_BY_ID[id].col : '#ffffff'; return { R: c, a: [c, 0.3], b: [c, 0.12], k: CELL.bg, '#': PAL.white }; };

// 마스크로 그리는 종류의 반 칸 그림과 빛깔({ rows, cols }). 기물 · 기보 · 진화는 null(스프라이트로 그린다). t는 도박의 도는 빛깔
export function artMask(it, t = 0) {
  if (it.kind === 'maxim') return MAXIM_ART[it.id] ? { rows: MAXIM_ART[it.id], cols: MAXIM_COL } : null;
  if (it.kind === 'engraving') return EMBLEM_ART[it.id] ? { rows: EMBLEM_ART[it.id], cols: EMBLEM[it.id].c } : null;
  if (it.kind === 'tactic') return TACTIC_ART[it.id] ? { rows: TACTIC_ART[it.id], cols: { '#': TACTIC_COL[it.id] || '#ffffff' } } : null;
  if (it.kind === 'fragment') return { rows: SHARD_ART, cols: SHARD_COL };
  if (it.kind === 'gamble') return { rows: it.id === 'roulette' ? ROULETTE_ART : POTION_ART, cols: gambleCols(it.id, gambleHue(t)) };
  if (it.kind === 'awaken') return { rows: AWAKEN_ART, cols: AWAKEN_COL };
  if (it.kind === 'soul') return { rows: soulRows(it.id), cols: soulCols(it.id) };
  return null;
}
// 기물 몸(둘레 테 포함)의 가로 잉크 자리({ x, w } — 반 칸 그림이면 반 칸 단위). 세로는 발밑 줄을 지키므로 재지 않는다
const PBOX = new Map();
export function pieceBox(type, hi) {
  type = artOf(type);
  const key = `${type}:${hi ? 2 : 1}`;
  if (PBOX.has(key)) return PBOX.get(key);
  const px = (hi ? spritePixelsHi(type) : null) || spritePixels(type);
  let x0 = Infinity, x1 = -1;
  for (const [x] of px) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const b = { x: x0, w: x1 - x0 + 1 };
  PBOX.set(key, b);
  return b;
}
export const artW = (it) => (it.kind === 'evolve' ? ART.w * 2 : ART.w);

const BAKED = new Map();
function bake(key, w2, h2, paint) {
  let c = BAKED.get(key);
  if (c) return c;
  c = makeCanvas(w2, h2);
  const g = context(c);
  g.imageSmoothingEnabled = false;
  g.fillStyle = CELL.bg; g.fillRect(0, 0, w2, h2);
  g.fillStyle = CELL.top; g.fillRect(2, 2, w2 - 4, 2);
  paint(g);
  BAKED.set(key, c);
  return c;
}
// 마스크를 (ox, oy)부터 도트 하나씩. 빛깔은 '#rrggbb' · 'hsl(…)' 또는 [빛깔, 알파]
function stamp(g, rows, cols, ox, oy) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = cols[r[i]]; if (!c) continue; if (typeof c === 'string') g.fillStyle = c; else { g.fillStyle = c[0]; g.globalAlpha = c[1]; } g.fillRect(ox + i, oy + j, 1, 1); g.globalAlpha = 1; } });
}
// 네 귀 꺾쇠(u = 도트 한 변: 반 칸 캔버스 2, 화면 1)
function ticks(fill, w, h, u) {
  for (const [cx, cy, sx, sy] of [[u, u, 1, 1], [w - u, u, -1, 1], [u, h - u, 1, -1], [w - u, h - u, -1, -1]]) {
    fill(sx > 0 ? cx : cx - 4 * u, sy > 0 ? cy : cy - u, 4 * u, u);
    fill(sx > 0 ? cx : cx - u, sy > 0 ? cy : cy - 4 * u, u, 4 * u);
  }
}
// 물건 그림 칸을 (x, y)에 그린다. 칸 크기는 w × h(진열 카드 22×26 · 진화 44×26 · 두루마리 칸 18×22). 돌려주는 값: 칸 폭
export function itemArt(ctx, it, x, y, t = 0, run = null, { w = artW(it), h = ART.h } = {}) {
  const hi = hiFor(ctx);
  const tier = it.kind === 'piece' ? (run ? tierOf(run.charts[chartForm(it.t)]) : 0) : it.kind === 'chart' ? tierOf((run ? run.charts[it.form] || 0 : 0) + 1) : 0;
  const type = it.kind === 'piece' ? it.t : it.kind === 'chart' ? it.form : null;
  if (it.kind === 'evolve') { evolveCell(ctx, x, y, w, h, hi); return w; }
  if (type) {
    // 기물 · 기보: 가로만 몸 잉크 가운데, 발밑 줄은 칸 아래에서 (h − 22) / 2
    const b = pieceBox(type, hi), py = Math.floor((h - 22) / 2);
    let px;
    if (hi) {
      const hx = centre(w * 2, 0, { x: b.x, y: 0, w: b.w, h: 0 }).x;
      ctx.drawImage(bake(`p:${it.kind}:${artOf(type)}:${tier}:${w}x${h}`, w * 2, h * 2, (g) => {
        if (it.kind === 'chart') { g.fillStyle = CHART_TICK; ticks((a, c, d, e) => g.fillRect(a, c, d, e), w * 2, h * 2, 2); }
        g.drawImage(spriteCanvas(artOf(type), 'w', null, tier, true), hx, py * 2);
      }), place(x), place(y), w, h);
      px = x + Math.round(hx / 2);
    } else {
      rect(ctx, x, y, w, h, CELL.bg); rect(ctx, x + 1, y + 1, w - 2, 1, CELL.top);
      if (it.kind === 'chart') ticks((a, c, d, e) => rect(ctx, x + a, y + c, d, e, CHART_TICK), w, h, 1);
      px = x + centre(w, 0, { x: b.x, y: 0, w: b.w, h: 0 }).x;
      ctx.drawImage(spriteCanvas(artOf(type), 'w', null, tier, false), place(px), place(y + py), 16, 22);
    }
    // 금 단계 반짝임 · 혼 기운은 움직이므로 칸 위에 따로
    if (tier === 3) tierSparkle(ctx, place(px), place(y + py), t, hi);
    if (it.kind === 'piece' && it.soul) soulSpark(ctx, place(px), place(y + py), SOUL_BY_ID[it.soul] ? SOUL_BY_ID[it.soul].col : '#ffffff', t, hi);
    return w;
  }
  const m = hi ? artMask(it, t) : null;
  if (m) {
    const hue = it.kind === 'gamble' ? `:${gambleHue(t)}` : '';
    ctx.drawImage(bake(`m:${it.kind}:${it.id || ''}${hue}:${w}x${h}`, w * 2, h * 2, (g) => { const o = centre(w * 2, h * 2, inkBox(m.rows)); stamp(g, m.rows, m.cols, o.x, o.y); }), place(x), place(y), w, h);
  } else {
    rect(ctx, x, y, w, h, CELL.bg); rect(ctx, x + 1, y + 1, w - 2, 1, CELL.top);
    loArt(ctx, it, x, y, w, h, t);
  }
  // 움직이는 것은 정수 칸에: 혼의 도는 점 셋 · 깨우기의 귀 반짝임(구슬 상자 안쪽)
  const cx = x + w / 2, cy = y + h / 2;
  if (it.kind === 'soul' && hi) for (let k = 0; k < 3; k++) { const q = t * 2 + (k * Math.PI * 2) / 3; rect(ctx, Math.round(cx + Math.cos(q) * 5.25 - 1), Math.round(cy + Math.sin(q) * 5.25 - 1), 2, 2, PAL.white); }
  if (it.kind === 'awaken' && hi) { const k = Math.floor(t * 4) % 2; for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!(((sx + sy) / 2 + k) & 1)) rect(ctx, cx + (sx > 0 ? 7 : -8), cy + (sy > 0 ? 7 : -8), 1, 1, PAL.goldHi); }
  return w;
}
// 1배 화면: 옛 그림을 잉크 가운데로
function loRows(ctx, rows, cols, x, y, w, h) {
  const b = inkBox(rows);
  if (!b) return;
  const o = centre(w, h, b);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = cols[r[i]]; if (c) rect(ctx, x + o.x + i, y + o.y + j, 1, 1, c); } });
}
function loArt(ctx, it, x, y, w, h, t) {
  const ox = x + Math.floor((w - 22) / 2), oy = y + Math.floor((h - 26) / 2);
  if (it.kind === 'maxim') { const rows = ICON_ROWS[it.id]; if (rows) { const o = centre(w, h, inkBox(rows)); drawIconLight(ctx, it.id, x + o.x, y + o.y); } }
  else if (it.kind === 'engraving') { if (EMBLEM[it.id]) loRows(ctx, EMBLEM[it.id].g, EMBLEM[it.id].c, x, y, w, h); }
  else if (it.kind === 'tactic') loRows(ctx, TACTIC_G[it.id] || [], { '#': TACTIC_COL[it.id] || '#ffffff' }, x, y, w, h);
  else if (it.kind === 'fragment') shardIcon(ctx, x + Math.floor((w - 16) / 2), y + Math.floor((h - 14) / 2));
  else if (it.kind === 'gamble') loRows(ctx, it.id === 'roulette' ? ROULETTE16 : POTION16, gambleCols(it.id, gambleHue(t)), x, y, w, h);
  else if (it.kind === 'awaken') awakenArt(ctx, ox, oy, t, { sq: false });
  else if (it.kind === 'soul') soulEmblem(ctx, it.id, ox, oy, t, { sq: false });
}
// 진화: 넓은 칸에 나이트 ›› 낙타(전후 두 그림 + 가운데 겹 꺾쇠). 좁은 칸(두루마리 칸)은 겹 꺾쇠만
function evolveCell(ctx, x, y, w, h, hi) {
  const wide = w >= 40, py = Math.floor((h - 22) / 2);
  if (hi) {
    ctx.drawImage(bake(`evolve:${w}x${h}`, w * 2, h * 2, (g) => {
      if (wide) {
        const bn = pieceBox('N', true), bl = pieceBox('L', true), m = 6;
        g.drawImage(spriteCanvas('N', 'w', null, 0, true), m - bn.x, py * 2);
        g.drawImage(spriteCanvas('L', 'w', null, 1, true), w * 2 - m - bl.w - bl.x, py * 2);
      }
      g.fillStyle = PAL.gold;
      const k = wide ? 1 : 2; // 좁은 칸은 화살을 두 배로
      for (const ox of [-6, 0]) for (let i = 0; i < 5; i++) { g.fillRect(w + (ox + i) * k, h + (-5 + i) * k, 2 * k, k); g.fillRect(w + (ox + i) * k, h + (4 - i) * k, 2 * k, k); }
    }), place(x), place(y), w, h);
    return;
  }
  rect(ctx, x, y, w, h, CELL.bg); rect(ctx, x + 1, y + 1, w - 2, 1, CELL.top);
  if (wide) {
    const bn = pieceBox('N', false), bl = pieceBox('L', false), m = 3;
    sprite(ctx, 'N', 'w', x + m - bn.x, y + py);
    sprite(ctx, 'L', 'w', x + w - m - bl.w - bl.x, y + py, { tier: 1 });
  }
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
  for (const ox of [-3, 0]) for (let i = 0; i < 3; i++) { rect(ctx, cx + ox + i, cy - 3 + i, 1, 1, PAL.gold); rect(ctx, cx + ox + i, cy + 2 - i, 1, 1, PAL.gold); }
}
