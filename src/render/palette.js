// 색. mockup의 PAL에서 시작했다.
export const PAL = {
  felt: '#1b2b27', feltDk: '#132019', feltHi: '#263a34',
  frame: '#3b2616', frameHi: '#6a4526', frameDk: '#24170d',
  light: '#e2cda2', dark: '#a4744a',
  gold: '#efbd55', goldDk: '#9c6f24', goldHi: '#fff1b8',
  red: '#df5a45', redDk: '#8a2a1f',
  ink: '#ece3cf', dim: '#8ea198', dimDk: '#5d6f68',
  val: '#f4ead2', valInk: '#3b2a1b', link: '#efbd55', linkInk: '#2a1c08',
  card: '#efe3c6', cardHi: '#fff8e8', cardInk: '#2a1c10', cardDim: '#6b563c',
  silver: '#d8dee6', shadow: '#0b1210', black: '#000000', white: '#ffffff',
  fog: '#243330', fogHi: '#2e403c',
  sky: '#9fd3e0',
};

// 등급 테두리
export const RARITY = { common: '#8ea198', uncommon: '#6fb3c8', rare: '#d27fd6', legendary: '#efbd55' };
// 판본 빛깔(카드 테두리 · 반짝임)
export const EDITION_TINT = { foil: '#d8dee6', pearl: '#f2d6e4', rainbow: '#9fe0a0', obsidian: '#8a5cc8' };

// '#rrggbb' → [r, g, b]
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
