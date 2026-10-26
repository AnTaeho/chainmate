// 물건 그림 칸(CHM-69, docs/design-notes/layout.md 「종류 표시」 · art3.md 7절): 진열 카드 · 뒤집히는 카드 · 두루마리 칸이 같은 그림 칸을 쓴다.
// 칸은 그림 상자 하나(22×26, 진화만 44×26, 두루마리 칸은 18×22)이고 안 3 벡터 그림을 (물건, 칸 크기, 배율 N)마다 한 번 굽고 붙인다.
// 격언 · 전설: 가족 빛깔 상자 + 가족 모양(밝은 그림자) + 문양(emblems.js). 각인 · 혼 · 전술 · 조각 · 도박 · 깨우기 · 판본은 제 물건 그림.
import { PAL } from '../render/palette.js';
import { beatAt, LOOK } from '../render/look.js';
import { rect, dot } from '../render/gfx.js';
import { tierOf } from '../render/sprites.js';
import { fitPiece } from '../render/pieces3.js';
import { INK, blitVec, trace } from '../render/vec.js';
import { pen, drawMotif } from '../render/emblems.js';
import { ART } from '../render/ink.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { MAXIM_BY_ID } from '../data/maxims.js';
import { LEGEND_BY_ID } from '../data/legends.js';
import { chartForm } from '../data/pieces.js';

// 기물 · 기보 칸 바탕과 윗줄 한 줄 빛: 그릴 때마다 PAL에서 읽는다(관 세력 모습을 따른다 — setTheme)
export const CELL = { get bg() { return PAL.felt; }, get top() { return PAL.fogHi; } };
// 기보 = 「이 모습일 때」: 네 귀 꺾쇠
export const CHART_TICK = '#8fd3c6';

// ── 문양 문법(art3.md 7절): 격언의 동사가 가족을 정하고, 가족이 상자 빛깔과 뒤 모양을 정한다
// 상자 [면, 밝은 윗줄, 짙은 아랫줄], 뒤 모양(halo)은 면보다 밝은 한 빛깔 — 금 · 붉은 · 하늘(규칙 빛깔)은 쓰지 않는다
export const FAMILY = {
  start: { verbs: ['놓기', '수'], box: '#6c8f76', halo: '#86a98f', shape: 'circle' },
  capture: { verbs: ['잡기'], box: '#7a5f86', halo: '#937a9f', shape: 'shield' },
  change: { verbs: ['갈아입기'], box: '#467f80', halo: '#5f9897', shape: 'diamond' },
  crown: { verbs: ['프로모션', '체크메이트'], box: '#535a9c', halo: '#6c73b4', shape: 'banner' },
  break: { verbs: ['끊김', '희생'], box: '#8a4f58', halo: '#a2676f', shape: 'octagon' },
  board: { verbs: [], box: '#5f6d85', halo: '#77869e', shape: 'square' },
  legend: { verbs: [], box: '#7d6238', halo: '#977a4c', shape: 'rosette' },
};
export function familyOf(id) {
  if (LEGEND_BY_ID[id]) return 'legend';
  const m = MAXIM_BY_ID[id];
  if (!m) return 'board';
  for (const [k, f] of Object.entries(FAMILY)) if (f.verbs.includes(m.verb)) return k;
  return 'board';
}
// 다른 종류의 상자 면(종류 빛깔을 낮춘 것)
const KIND_BOX = { engraving: '#73485f', soul: '#25414d', tactic: '#8a6440', fragment: '#3d427a', gamble: '#7d4560', awaken: '#3d427a', edition: '#4b4566' };

// 각인 재료 빛깔(몸 · 그늘 · 빛). 각인은 덱의 어느 기물에나 새기므로 기물을 그리지 않는다
export const EMBLEM = {
  gold: { c: ['#f6be45', '#d48b1c', '#fff1b8'] }, silver: { c: ['#e4eaf0', '#a9b6c1', '#ffffff'] }, ivory: { c: ['#f7efdb', '#d8c4a4', '#ffffff'] },
  ebony: { c: ['#6b5a52', '#3e2f28', '#c8902c'] }, glass: { c: ['#cdeef3', '#7fc3cf', '#ffffff'] }, feather: { c: ['#efe8f4', '#6fd1bf', '#ffffff'] },
  bronze: { c: ['#d08a48', '#a0602a', '#f0c090'] }, iron: { c: ['#8a9299', '#555c63', '#c8d0d6'] }, amber: { c: ['#f0a830', '#c87a14', '#ffe0a0'] },
  jade: { c: ['#7fd09a', '#3f9a60', '#d0ffe0'] }, coral: { c: ['#f08878', '#d05a50', '#ffd0c8'] }, marble: { c: ['#ece8f8', '#b0a8d0', '#ffffff'] },
};
const MATERIAL = {
  gold: (p, [l]) => { p.coin(12, 12, 9.5, [l, '#d48b1c']); p.crown(12, 14.5, 7, 4.5, ['#fff1b8', '#efbd55']); },
  silver: (p, c) => { p.g.save(); p.g.translate(12, 12); p.g.rotate(-0.25); p.rect(-8.5, -6.5, 17, 13, c, 2); p.stroke('M-5.5 -3.5 L-1.5 -3.5 M-5.5 -0.5 L-3 -0.5', c[2], 1.6); p.g.restore(); },
  ivory: (p, c) => { p.shape('M18 2.5 C21.5 8 19 17 9 21.5 C6 22.8 3.6 21 5 19 C11 15.5 15 10 15 3.5 C15.5 1.8 17 1.5 18 2.5 Z', c); p.stroke('M7.5 18.5 L9.5 20.5 M11 16 L13 18 M13.8 12.5 L15.8 14', INK, 1); },
  ebony: (p, c) => { p.poly([[3, 7], [19, 4], [21.5, 16], [5.5, 20]], c); p.stroke('M6 9.5 C10 9 13 11 19 8 M6.8 13 C11 12.5 13 15 19.8 12 M7.5 16.5 C11 16 14 18 20.5 15.5', '#2a1e18', 1.1); p.spark(19, 5, 2.8, ['#efbd55', '#c8902c']); },
  glass: (p, c) => { p.poly([[12, 1.5], [19.5, 9], [15.5, 22.5], [8.5, 22.5], [4.5, 9]], c); p.stroke('M12 1.5 L12 22.5 M4.5 9 L19.5 9', '#5aa9b6', 1); p.stroke('M7.5 10.5 L9.5 18', '#ffffff', 1.4); },
  feather: (p, c) => { p.shape('M19.5 2 C22 9 17 17 8 19.5 C7 15 9.5 6 19.5 2 Z', c); p.stroke('M20 2.5 C15 9 10 15 3 22', INK, 1.4); p.stroke('M12 12 L17 10.5 M10 15 L14.5 15', '#4fa894', 1); },
  bronze: (p, c) => { p.shape('M12 2.5 C17 2.5 18 7.5 18 12 C18 15 20 17 21 18.5 L3 18.5 C4 17 6 15 6 12 C6 7.5 7 2.5 12 2.5 Z', c); p.disc(12, 20.5, 2.4, c); p.rect(10.5, 0.8, 3, 2.4, c, 1); p.stroke('M8 9 C8 6.5 9 5 10.5 4.6', c[2], 1.4); },
  iron: (p, c) => { p.poly([[2, 18], [6, 8], [18, 8], [22, 18]], c); p.poly([[6, 8], [18, 8], [16.5, 5], [7.5, 5]], [c[2], c[0]]); p.stroke('M6 15 L10 15', c[2], 1.3); },
  amber: (p, c) => { p.shape('M12 1.5 C17 7 20.5 11 20.5 15.5 C20.5 20 16.5 22.5 12 22.5 C7.5 22.5 3.5 20 3.5 15.5 C3.5 11 7 7 12 1.5 Z', c); p.shape([12, 15.5, 2.6, 3.6], '#6a3a08', { lw: 0 }); p.stroke('M9 13 L15 18 M15 13 L9 18', '#6a3a08', 1); p.stroke('M7.5 12 C7.5 10 8.5 8.5 10 7.5', c[2], 1.5); },
  jade: (p, c) => { p.ring(12, 12, 7, 5, c[0]); p.g.beginPath(); p.g.arc(12, 12, 7, Math.PI * 0.1, Math.PI * 0.9); p.g.strokeStyle = c[1]; p.g.lineWidth = 5; p.g.stroke(); p.stroke('M7.5 9 C8.5 7 10 6 12 5.8', c[2], 1.4); },
  coral: (p, c) => { p.band('M12 22 L12 13 M12 16 L6 9 L5 3 M6 9 L3 7 M12 13 L17 7 L19 2 M17 7 L21 6.5 M12 13 L11 5', c[0], 2.6); },
  marble: (p, c) => { p.rect(3, 4, 18, 16, c, 1.5); p.stroke('M5 8 C8 9 9 13 13 13 C16 13 16 17 19.5 18 M12 13 C13 10 16 9 19 9', c[1], 1.2); },
};
// 혼 문양(고리 가운데): 흰 선
const SOUL_MARK = {
  absorb: 'M14.5 12 C14.5 15 9.5 15 9.5 12 C9.5 9 15.5 8.5 16 12 C16.5 16.5 8 17.5 8 12 C8 7 13 6.5 13.5 9',
  echo: 'M9 8 C11 10 11 14 9 16 M12 6.5 C15 9.5 15 14.5 12 17.5 M15 5 C19 9 19 15 15 19',
  transcend: 'M12 18 L12 7 M8 10.5 L12 6.5 L16 10.5 M8.5 18 L15.5 18',
  hunger: 'M8.5 6.5 L8.5 11 C8.5 13 15.5 13 15.5 11 L15.5 6.5 M12 6.5 L12 18',
  hunter: 'M12 5.5 L18.5 12 L12 18.5 L5.5 12 Z M12 10.5 L12 13.5',
  martyr: 'M12 5 L12 19 M7.5 9.5 L16.5 9.5',
  crown: 'M8.5 18.5 L8.5 5.5 L16.5 9 L8.5 12.5',
  shade: 'M6.5 10 C9 13 15 13 17.5 10 M8.5 15 L15.5 15',
  inherit: 'M7.5 6.5 L16.5 6.5 C16.5 11 14 12.5 12 12.5 C10 12.5 7.5 11 7.5 6.5 M12 12.5 L12 17 M9 18 L15 18',
  relay: 'M6 7 L11 12 L9 14 L15 18 M12.5 18.2 L15.4 18.2 L15.2 15.2',
  retro: 'M7 6.5 L12 17.5 L17 6.5',
  duel: 'M7 7 L17 17 M17 7 L7 17 M6.5 10.5 L10.5 6.5 M13.5 6.5 L17.5 10.5',
  reaper: 'M7 18 L14 6 M14 6 C17 6.5 19 9 18.5 12 C17 9.5 15.5 8.5 13 8.6',
  spring: 'M7 7 L17 7 L7 17 L17 17',
  homing: 'M16.5 9.5 C15 6 9.5 5.5 7.5 9 C5.5 12.5 7.5 17.5 12 17.5 C14.5 17.5 16 16 16.7 14 M17 6 L16.5 9.5 L13 9.2',
  ripple: 'M12 12 L12 12.1 M8.5 9 C7 11 7 13 8.5 15 M15.5 9 C17 11 17 13 15.5 15 M6 6.5 C3 10 3 14 6 17.5 M18 6.5 C21 10 21 14 18 17.5',
};
export const SOUL_GLYPH = SOUL_MARK;
const TACTIC = {
  freeze: (p) => { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; const dx = Math.cos(a) * 10, dy = Math.sin(a) * 10; p.band(`M${12 - dx} ${12 - dy} L${12 + dx} ${12 + dy}`, '#bfe6f0', 2.2); for (const s of [1, -1]) { const bx = 12 + s * dx * 0.62, by = 12 + s * dy * 0.62, q = a + (s > 0 ? 0 : Math.PI); p.stroke(`M${bx + Math.cos(q + 2.4) * 3.4} ${by + Math.sin(q + 2.4) * 3.4} L${bx} ${by} L${bx + Math.cos(q - 2.4) * 3.4} ${by + Math.sin(q - 2.4) * 3.4}`, '#bfe6f0', 1.4); } } p.disc(12, 12, 2.4, '#e8f8fc'); },
  reload: (p) => { for (let i = 0; i < 3; i++) p.disc(5 + i * 5, 6, 2.4, 'gold'); p.band('M12 11 L12 22 M6.5 16.5 L17.5 16.5', 'gold', 3); },
  taunt: (p) => {
    // 손짓하는 손 + 나타나는 적 폰 넷
    for (const [x, h] of [[4, 9], [9.5, 10], [15, 10], [20.5, 9]]) p.foe(x, 23.5, h);
    p.shape('M5.5 13.5 L5.5 5.5 C5.5 2.8 12.5 2.8 12.5 5.5 L12.5 8.5 L14.6 6.6 C15.8 5.6 17.6 7 16.5 8.4 L12.6 13.2 C11.4 15 6.6 15 5.5 13.5 Z', ['#f0c48e', '#d89a5e']);
    p.stroke('M7.8 4.5 L7.8 8.5 M10.2 4.5 L10.2 8.5', INK, 1.1);
    p.stroke('M17.5 2.5 C19 3.5 19 6 17.5 7 M20 1 C22.5 3 22.5 6.5 20 8.5', '#f0a060', 1.5);
  },
};
export const TACTIC_COL = { freeze: '#9fd3e0', reload: '#efbd55', taunt: '#df8a45' };
export const TACTIC_G = TACTIC;
// 명경기 조각: 금빛 깨진 판 조각(판 무늬 새김)
function shard(p) {
  p.poly([[3, 6], [11, 2.5], [20.5, 5], [21, 13], [15.5, 15], [17, 21.5], [9, 21], [4, 15]], 'gold');
  p.g.save(); p.g.beginPath(); p.g.moveTo(3, 6); [[11, 2.5], [20.5, 5], [21, 13], [15.5, 15], [17, 21.5], [9, 21], [4, 15]].forEach(([x, y]) => p.g.lineTo(x, y)); p.g.closePath(); p.g.clip();
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2) p.flat(`M${2 + i * 5.2} ${2 + j * 5.2} L${7.2 + i * 5.2} ${2 + j * 5.2} L${7.2 + i * 5.2} ${7.2 + j * 5.2} L${2 + i * 5.2} ${7.2 + j * 5.2} Z`, '#d48b1c');
  p.g.restore();
  p.outline('M3 6 L11 2.5 L20.5 5 L21 13 L15.5 15 L17 21.5 L9 21 L4 15 Z');
  p.stroke('M5.5 8 L10.5 5.5', '#fff1b8', 1.4);
}
const potion = (hue) => (p) => {
  p.shape('M9.5 7 L9.5 10 C5 11.5 3.5 14.5 3.5 17 C3.5 20.5 7 22.5 12 22.5 C17 22.5 20.5 20.5 20.5 17 C20.5 14.5 19 11.5 14.5 10 L14.5 7 Z', ['#dff2f5', '#a9d6de']);
  p.shape('M4.8 16 C7 14.5 17 14.5 19.2 16 C19.5 19.5 16.5 21.3 12 21.3 C7.5 21.3 4.5 19.5 4.8 16 Z', [`hsl(${hue},70%,62%)`, `hsl(${hue},62%,48%)`], { lw: 0 });
  p.rect(8.5, 3, 7, 4.2, '#b07a44', 1); p.stroke('M7 13.5 C6.2 15 6 16 6.2 17', '#ffffff', 1.4);
};
const roulette = (hue) => (p) => {
  p.disc(12, 12, 10.5, 'gold');
  for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2; p.g.beginPath(); p.g.moveTo(12, 12); p.g.arc(12, 12, 8, a0, a1); p.g.closePath(); p.g.fillStyle = i % 2 ? `hsl(${hue},70%,62%)` : PAL.deep; p.g.fill(); }
  p.ring(12, 12, 8, 0.01, INK); p.disc(12, 12, 2.6, ['#fff1b8', '#efbd55']); p.disc(16.5, 6.5, 1.6, ['#fff8e8', '#ffffff']);
};
function awaken(p) {
  p.disc(12, 12, 9, 'gold'); p.stroke('M8.5 6 C9.5 4.8 11 4.2 12.5 4.2', '#fff1b8', 1.6);
  p.stroke('M11 3.5 L12.5 7.5 L10.5 10.5 L13.5 13.5 L12 17 L14 20.5', INK, 1.3);
}

// 판본: 제 재료 하나 — 은박 = 접힌 은빛 종이와 빗긴 빛, 자개 = 조개 위 진주, 무지개 = 빛깔 띠 무지개, 흑요 = 깎인 검은 조각
const RAINBOW = ['#e57a8a', '#f0a060', '#f3dc6b', '#7fc98a', '#7f9be0', '#a983d6'];
// 테 없는 네 뿔 반짝(작은 칸에서 잉크 테가 반짝을 덮지 않게)
const glint = (p, x, y, r, c = '#ffffff') => { const q = r * 0.28; p.flat(`M${x} ${y - r} L${x + q} ${y - q} L${x + r} ${y} L${x + q} ${y + q} L${x} ${y + r} L${x - q} ${y + q} L${x - r} ${y} L${x - q} ${y - q} Z`, c); };
const cloud = (x) => `M${x - 4} 21 C${x - 6.5} 21 ${x - 6.5} 17 ${x - 3.6} 17.3 C${x - 3.2} 13.6 ${x + 2.2} 13.6 ${x + 2.6} 17 C${x + 5.6} 16.6 ${x + 6} 21 ${x + 3.4} 21 Z`;
const EDITION_G = {
  foil: (p) => {
    const sheet = 'M4 5 L17 3 L21 7 L20 21 L5 20.5 Z';
    p.shape(sheet, ['#eef3f7', '#b9c6cf']);
    p.g.save(); p.g.beginPath(); trace(p.g, sheet); p.g.clip();
    p.stroke('M3 15 L14 2 M7 21 L21 5', '#ffffff', 2.2); p.stroke('M10 21 L22 8', '#ffffff', 0.9);
    p.g.restore();
    p.poly([[17, 3], [17.6, 6.6], [21, 7]], ['#cdd7de', '#9eabb5']);
    glint(p, 5, 5, 3.4);
  },
  pearl: (p) => {
    p.shape('M2.5 15 C2.5 9 7 6.5 12 6.5 C17 6.5 21.5 9 21.5 15 L18 21 L6 21 Z', ['#f2d6e4', '#cfa9c0']);
    p.stroke('M6 20.5 L4.5 13 M9 21 L8.5 9.5 M12 21 L12 8.5 M15 21 L15.5 9.5 M18 20.5 L19.5 13', '#b98aa8', 1);
    p.disc(12, 12.5, 5.6, ['#fbf6fa', '#d9cde0']);
    p.stroke('M8.8 11.2 C9.2 9.6 10.4 8.6 11.8 8.4', '#ffffff', 1.4); p.dot(14.4, 15, 0.9, '#efc7dc');
    glint(p, 20, 4.5, 3.4);
  },
  rainbow: (p) => {
    for (let i = 0; i < RAINBOW.length; i++) { const r = 10 - i * 1.25; p.g.beginPath(); p.g.arc(12, 17, r, Math.PI, 0); p.g.strokeStyle = RAINBOW[i]; p.g.lineWidth = 1.35; p.g.stroke(); }
    p.g.beginPath(); p.g.arc(12, 17, 10.7, Math.PI, 0); p.g.strokeStyle = INK; p.g.lineWidth = p.O; p.g.stroke();
    p.g.beginPath(); p.g.arc(12, 17, 3.1, Math.PI, 0); p.g.stroke();
    for (const x of [4.6, 19.4]) p.shape(cloud(x), 'cream');
  },
  obsidian: (p) => {
    const pts = [[12, 1.5], [19.5, 8], [17.5, 21.5], [8, 22.5], [4, 11]];
    p.poly(pts, ['#3d3157', '#221a36']);
    p.flat('M12 1.5 L19.5 8 L13 11 Z', '#5a4a80'); p.flat('M12 1.5 L13 11 L4 11 Z', '#4a3d6a'); p.flat('M13 11 L17.5 21.5 L8 22.5 Z', '#2c2344');
    p.stroke('M12 1.5 L13 11 L19.5 8 M4 11 L13 11 L17.5 21.5 M13 11 L8 22.5', '#8a5cc8', 0.9);
    p.outline(`M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} Z`);
    p.stroke('M8.5 6.5 L10.6 4.2', '#ffffff', 1.3); glint(p, 20, 19, 3.2, '#e6d6ff');
  },
};
export const EDITION_G_IDS = Object.keys(EDITION_G);

// 그림 상자 뒤 모양(가족 표): 상자 가운데 (cx, cy), 반지름 r
function haloPath(shape, cx, cy, r) {
  const ring = (n, rot = -Math.PI / 2, k = 1) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2, q = i % 2 && k !== 1 ? r * k : r; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; });
  const P = (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
  if (shape === 'circle') return [cx, cy, r, r];
  if (shape === 'diamond') return P(ring(4));
  if (shape === 'octagon') return P(ring(8, -Math.PI / 8));
  if (shape === 'rosette') return P(ring(16, -Math.PI / 2, 0.82));
  if (shape === 'square') { const s = r * 0.86; return P([[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s]]); }
  if (shape === 'shield') return `M${cx - r * 0.9} ${cy - r * 0.85} L${cx + r * 0.9} ${cy - r * 0.85} L${cx + r * 0.9} ${cy - r * 0.05} C${cx + r * 0.9} ${cy + r * 0.55} ${cx + r * 0.35} ${cy + r * 0.85} ${cx} ${cy + r * 1.05} C${cx - r * 0.35} ${cy + r * 0.85} ${cx - r * 0.9} ${cy + r * 0.55} ${cx - r * 0.9} ${cy - r * 0.05} Z`;
  if (shape === 'banner') return P([[cx - r * 0.82, cy + r * 0.95], [cx - r * 0.82, cy - r * 0.35], [cx, cy - r * 1.02], [cx + r * 0.82, cy - r * 0.35], [cx + r * 0.82, cy + r * 0.95]]);
  return [cx, cy, r, r];
}
// 상자: 면 + 윗줄 빛 + 아랫줄 그늘(1 논리 칸)
function boxBg(g, w, h, face) {
  g.fillStyle = face; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(1, 1, w - 2, 1);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, h - 1, w, 1);
}
// 그림 크기: 칸 안 여백 2 · 높이 여백 3
const motifSize = (w, h) => Math.min(w - 3, h - 5, 19);

// 칸 하나 그리기(굽는 쪽): 종류마다
function paintCell(g, n, it, w, h, hue) {
  const S = motifSize(w, h), ox = (w - S) / 2, oy = (h - S) / 2;
  const sub = (fn) => { const s = S / 24; g.save(); g.translate(ox, oy); g.scale(s, s); fn(pen(g, s * n)); g.restore(); };
  if (it.kind === 'maxim') {
    const F = FAMILY[familyOf(it.id)];
    boxBg(g, w, h, F.box);
    const sh = haloPath(F.shape, w / 2, h / 2, Math.min(w, h) / 2 - 0.5);
    const p = pen(g, n); p.flat(sh, F.halo);
    drawMotif(g, it.id, ox, oy, S, n);
    return;
  }
  boxBg(g, w, h, KIND_BOX[it.kind] || PAL.felt);
  if (it.kind === 'engraving') { const e = EMBLEM[it.id]; if (e) sub((p) => MATERIAL[it.id](p, e.c)); }
  else if (it.kind === 'soul') {
    const c = SOUL_BY_ID[it.id] ? SOUL_BY_ID[it.id].col : '#ffffff';
    sub((p) => {
      p.g.globalAlpha = 0.28; p.dot(12, 12, 9.5, c); p.g.globalAlpha = 1;
      p.ring(12, 12, 9.6, 2.6, c); p.disc(12, 12, 6.6, [KIND_BOX.soul, KIND_BOX.soul]);
      if (SOUL_MARK[it.id]) { g.save(); g.translate(12, 12); g.scale(0.7, 0.7); g.translate(-12, -12); p.stroke(SOUL_MARK[it.id], '#ffffff', 2.4); g.restore(); }
    });
  } else if (it.kind === 'tactic') { if (TACTIC[it.id]) sub(TACTIC[it.id]); }
  else if (it.kind === 'fragment') sub(shard);
  else if (it.kind === 'gamble') sub(it.id === 'roulette' ? roulette(hue) : potion(hue));
  else if (it.kind === 'awaken') sub(awaken);
  else if (it.kind === 'edition') { if (EDITION_G[it.id]) sub(EDITION_G[it.id]); }
}

// 도박의 도는 빛깔: 한 바퀴를 스물넷으로 끊는다(구운 칸을 그만큼만 둔다)
const gambleHue = (t) => (t ? (beatAt(t, 200 / 15) * 15) % 360 : 0); // 계단(초당 약 13번 — beat, P-8)
export const artW = (it) => (it.kind === 'evolve' ? ART.w * 2 : ART.w);

// 네 귀 꺾쇠
function ticks(ctx, x, y, w, h, col) {
  for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [w - 1, 1, -1, 1], [1, h - 1, 1, -1], [w - 1, h - 1, -1, -1]]) {
    rect(ctx, x + (sx > 0 ? cx : cx - 4), y + (sy > 0 ? cy : cy - 1), 4, 1, col);
    rect(ctx, x + (sx > 0 ? cx : cx - 1), y + (sy > 0 ? cy : cy - 4), 1, 4, col);
  }
}
// 물건 그림 칸을 (x, y)에 그린다. 칸 크기는 w × h(진열 카드 22×26 · 진화 44×26 · 두루마리 칸 18×22). 돌려주는 값: 칸 폭
export function itemArt(ctx, it, x, y, t = 0, run = null, { w = artW(it), h = ART.h } = {}) {
  const tier = it.kind === 'piece' ? (run ? tierOf(run.charts[chartForm(it.t)]) : 0) : it.kind === 'chart' ? tierOf((run ? run.charts[it.form] || 0 : 0) + 1) : 0;
  const type = it.kind === 'piece' ? it.t : it.kind === 'chart' ? it.form : null;
  if (it.kind === 'evolve') { evolveCell(ctx, x, y, w, h); return w; }
  if (type) {
    // 기물 · 기보: 16 × 22 상자(가로 가운데, 발밑 줄은 칸 아래에서 (h − 22) / 2)에 벡터 기물. 금 기운 · 혼 기운은 그 상자에
    rect(ctx, x, y, w, h, CELL.bg); rect(ctx, x + 1, y + 1, w - 2, 1, CELL.top);
    if (it.kind === 'chart') ticks(ctx, x, y, w, h, CHART_TICK);
    const px = x + Math.floor((w - 16) / 2), py = y + Math.floor((h - 22) / 2);
    fitPiece(ctx, type, 'w', px, py, 16, 22, { tier, time: t, soul: it.kind === 'piece' ? it.soul || null : null });
    return w;
  }
  const hue = it.kind === 'gamble' ? gambleHue(t) : 0;
  blitVec(ctx, `art:${it.kind}:${it.id || ''}:${hue}`, x, y, w, h, (g, n) => paintCell(g, n, it, w, h, hue));
  // 움직이는 것은 정수 칸에: 혼의 도는 점 셋 · 깨우기의 귀 반짝임
  const cx = x + w / 2, cy = y + h / 2;
  // 계단(beat)으로만 바뀐다 — 혼은 초당 12번, 깨우기는 4번. 움직임 줄이기면 멈춘다(P-8: 혼 두루마리를 든 상점이 초당 60번 그렸다)
  const turns = it.kind === 'soul' || it.kind === 'awaken', still = !t || LOOK.calm || !turns, ts = still ? 0 : beatAt(t, 12) / 12;
  if (it.kind === 'soul') for (let k = 0; k < 3; k++) { const q = ts * 2 + (k * Math.PI * 2) / 3; dot(ctx, cx + Math.cos(q) * 6.5 - 1, cy + Math.sin(q) * 6.5 - 1, 2, PAL.white); }
  if (it.kind === 'awaken') { const k = still ? 0 : beatAt(t, 4) % 2; for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!(((sx + sy) / 2 + k) & 1)) dot(ctx, cx + (sx > 0 ? 7 : -8) - 0.2, cy + (sy > 0 ? 7 : -8) - 0.2, 1.4, PAL.goldHi); }
  return w;
}
// 격언 칸 · 도감 칸의 작은 그림 칸(20 × 22): 진열 카드와 같은 그림
export const MAXIM_CELL = { w: 20, h: 22, gap: 3, inset: 3 };
export function maximArt(ctx, id, x, y, alpha = 1) {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  itemArt(ctx, { kind: 'maxim', id }, x, y, 0, null, MAXIM_CELL);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
// 판본 그림 칸(도감 칸 20 × 22): id = 판본 id
export function editionArt(ctx, id, x, y, alpha = 1) {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  itemArt(ctx, { kind: 'edition', id }, x, y, 0, null, MAXIM_CELL);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
// 옛 이름: 각인 · 혼 · 깨우기 그림 칸(22 × 26). sq가 거짓이면 같은 그림을 상자 없이 — 지금은 늘 상자째
export const engravingEmblem = (ctx, id, x, y) => itemArt(ctx, { kind: 'engraving', id }, x, y);
export const soulEmblem = (ctx, id, x, y, t = 0) => itemArt(ctx, { kind: 'soul', id }, x, y, t);
export const awakenArt = (ctx, x, y, t = 0) => itemArt(ctx, { kind: 'awaken' }, x, y, t);
// 작은 혼 표(9×9): 혼 빛깔 고리에 흰 문양(도감 칸처럼 좁은 곳)
export function soulGlyph(ctx, id, x, y) {
  const s = SOUL_BY_ID[id];
  if (!s) return;
  blitVec(ctx, `soulglyph:${id}`, x, y, 9, 9, (g, n) => {
    const k = 9 / 24; g.save(); g.scale(k, k);
    const p = pen(g, k * n);
    p.disc(12, 12, 10.5, [PAL.felt, PAL.felt], { lw: 0 }); p.ring(12, 12, 9.5, 3, s.col);
    if (SOUL_MARK[id]) { g.translate(12, 12); g.scale(0.62, 0.62); g.translate(-12, -12); p.stroke(SOUL_MARK[id], '#ffffff', 3.4); }
    g.restore();
  });
}
// 월계관(도장의 이겨서 받은 표, size × size): 크림 몸 + 잉크 테 — 문양 붓의 선 굵기 그대로
const LAUREL = [[6.4, 5.6, 0.95], [4.4, 10.4, 0.45], [5, 15.6, -0.15], [8.2, 19.6, -0.75]];
export function laurelMark(ctx, x, y, size) {
  blitVec(ctx, 'laurel', x, y, size, size, (g, n) => {
    const k = size / 24; g.save(); g.scale(k, k);
    const p = pen(g, k * n);
    p.stroke('M11 22 C3.5 19.5 2.5 11 6.5 3.5 M13 22 C20.5 19.5 21.5 11 17.5 3.5', INK, 1.8);
    for (const [lx, ly, a] of LAUREL) { p.shape([lx, ly, 3.3, 1.9, a], 'cream'); p.shape([24 - lx, ly, 3.3, 1.9, -a], 'cream'); }
    g.restore();
  });
}
// 명경기 조각 16×14 — 작은 자리(금빛 꾸러미 건너뛰기 줄 · 마스터의 상자 · 결과)
export function shardIcon(ctx, x, y) {
  blitVec(ctx, 'shard', x, y, 16, 14, (g, n) => { const k = 14 / 24; g.save(); g.translate(1.5, 0); g.scale(k, k); shard(pen(g, k * n)); g.restore(); });
}
// 전술 그림 16×11(대국 손 줄의 작은 칸)
export function tacticIcon(ctx, id, x, y) {
  if (!TACTIC[id]) return;
  blitVec(ctx, `tactic:${id}`, x, y, 16, 11, (g, n) => { const k = 11 / 24; g.save(); g.translate(8 - 12 * k, 0); g.scale(k, k); TACTIC[id](pen(g, k * n)); g.restore(); });
}
// 진화: 넓은 칸에 나이트 ›› 낙타(전후 두 그림 + 가운데 겹 꺾쇠). 좁은 칸(두루마리 칸)은 겹 꺾쇠만
function evolveCell(ctx, x, y, w, h) {
  const wide = w >= 40, py = y + Math.floor((h - 22) / 2);
  blitVec(ctx, `evolve:${CELL.bg}:${CELL.top}`, x, y, w, h, (g, n) => {
    g.fillStyle = CELL.bg; g.fillRect(0, 0, w, h); g.fillStyle = CELL.top; g.fillRect(1, 1, w - 2, 1);
    const k = wide ? 0.42 : 0.6, s = 24 * k;
    g.save(); g.translate(w / 2 - s / 2, h / 2 - s / 2); g.scale(k, k);
    const p = pen(g, k * n); p.chevron(8, 12, 9, 13, 'gold', 3.2, 'right'); p.chevron(16, 12, 9, 13, 'gold', 3.2, 'right');
    g.restore();
  });
  if (wide) {
    fitPiece(ctx, 'N', 'w', x + 2, py, 16, 22);
    fitPiece(ctx, 'L', 'w', x + w - 2 - 16, py, 16, 22, { tier: 1 });
  }
}
