// 색. 잉크 남색 바탕 + 잉크 테 + 크림 카드 + 금빛(안 3 틀 문법 — docs/design-notes/layout.md 27절). 판 안 화면은 관 세력이 상자 면 · 판 어두운 칸 · 바탕을 바꾼다(setTheme).
export const PAL = {
  felt: '#11142c', feltDk: '#262c5f', feltHi: '#181c3a', well: '#181b3b', deep: '#0b0d22',
  frame: '#2d3360', frameHi: '#5b6290', frameDk: '#12153a',
  edge: '#f3e6c8', drop: '#12153a',
  slot: '#161a44', slotEdge: '#3a4280', // 빈 자리(테 두른 둥근 칸) — 상자 면에서 섞는다(setTheme)
  btn: '#efe6d2', btnRed: '#ef6a52', btnRedInk: '#fff4ea', // 알약 단추: 크림(보조) · 붉은(위험), 주는 금빛 gold
  light: '#efe6d2', dark: '#7c87a6',
  gold: '#efbd55', goldDk: '#9c6f24', goldHi: '#fff1b8',
  red: '#df5a45', redDk: '#8a2a1f',
  ink: '#efe6d2', dim: '#8f97c9', dimDk: '#5f6696',
  val: '#f4ead2', valInk: '#3b2a1b', link: '#efbd55', linkInk: '#2a1c08',
  card: '#f7eedb', cardHi: '#fff8e8', cardInk: '#12153a', cardDim: '#545a8c',
  silver: '#d8dee6', shadow: '#05061a', black: '#000000', white: '#ffffff',
  fog: '#202551', fogHi: '#373d6c',
  sky: '#9fd3e0',
  mark: '#72c24e', // 판 위 표시(오른쪽 누르기): 붉은빛 · 금빛 · 하늘빛은 규칙이 이미 쓴다
  diagA: '#3c416f', diagB: '#212754', // 행마 그림 칸(모습을 바꾸면 상자 면에서 다시 섞는다 — setTheme)
};

// 모습(상자 면 · 판 어두운 칸 · 흐르는 얼룩 두 빛깔). 판 밖 화면은 남색 기본, 판 안 화면은 세력 모습(src/data/factions.js look)
// bg: 바탕 [가운데, 중간, 가장자리, 기운 띠](안 3 시안 p3 — 둥근 남색 빛 + −8도 띠 하나 + 판 어두운 칸 빛깔 줄). 세력은 상자 면에서 섞는다(bgOf)
export const BASE_LOOK = { face: '#262c5f', dark: '#7c87a6', flow: ['#2c3290', '#5a2a80'], bg: ['#2b326e', '#1c2152', '#141838', '#232a62'] };
const LOOKS = new Map();
export const THEME = { id: null, look: BASE_LOOK };
// 세력 모습을 id로 적어 둔다(흐르는 얼룩 · 여백 판은 id로 찾는다 — app.js가 처음에 여덟을 모두 적는다)
export const addLook = (id, look) => { LOOKS.set(id, look); };
// 지금 모습을 바꾼다: id는 세력 id(없거나 모르는 id면 기본). 바꿨으면 true
export function setTheme(id) {
  const l = (id && LOOKS.get(id)) || BASE_LOOK;
  if (THEME.look === l) return false;
  THEME.id = l === BASE_LOOK ? null : id; THEME.look = l;
  PAL.feltDk = l.face; PAL.dark = l.dark;
  // 상자 면에서 나온 빛깔: 움푹한 칸(well) · 행마 그림 칸 두 빛깔 · 안개
  PAL.well = mix(l.face, '#000000', 0.38); PAL.diagA = mix(l.face, '#ffffff', 0.1); PAL.diagB = mix(l.face, '#000000', 0.12);
  PAL.fog = mix(l.face, '#000000', 0.15); PAL.fogHi = mix(l.face, '#ffffff', 0.08);
  PAL.slot = l === BASE_LOOK ? '#161a44' : mix(l.face, '#000000', 0.42); PAL.slotEdge = l === BASE_LOOK ? '#3a4280' : mix(l.face, '#ffffff', 0.16);
  return true;
}
// 두 '#rrggbb'를 k(0~1)만큼 섞는다
export function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((A >> sh) & 255) * (1 - k) + ((B >> sh) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
export const lookOf = (id) => (id && LOOKS.get(id)) || BASE_LOOK;
// 모습의 바탕 네 빛깔(가운데 · 중간 · 가장자리 · 기운 띠): 기본은 시안 그대로, 세력은 상자 면에서
export function bgOf(id) {
  const l = lookOf(id);
  if (!l.bg) l.bg = [mix(l.face, '#ffffff', 0.05), mix(l.face, '#000000', 0.22), mix(l.face, '#000000', 0.45), mix(l.face, '#000000', 0.08)];
  return l.bg;
}

// 바탕이 밝은가(크림 카드 · 금빛 단추는 테를 어둡게)
export function lightFill(col) {
  if (typeof col !== 'string' || col[0] !== '#' || col.length !== 7) return false;
  const n = parseInt(col.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140;
}

// 등급 테두리
export const RARITY = { common: '#a3abd0', uncommon: '#6fb3c8', rare: '#d27fd6', legendary: '#efbd55' };
// 판본 빛깔(카드 테두리 · 반짝임)
export const EDITION_TINT = { foil: '#d8dee6', pearl: '#f2d6e4', rainbow: '#9fe0a0', obsidian: '#8a5cc8' };

// '#rrggbb' → [r, g, b]. 'hsl(h,s%,l%)'도 읽는다(무지갯빛으로 도는 글자 — 글자 그림은 이 값으로 화소를 다시 칠한다)
export function rgb(col) {
  const m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(col);
  if (m) {
    const h = (((+m[1] % 360) + 360) % 360) / 30, s = Math.min(100, +m[2]) / 100, l = Math.min(100, +m[3]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  }
  const n = parseInt(col.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
