// 기물 톤 · 16×22 상자 · 작은 반짝임. 기물 그림은 벡터(pieces3.js)이고 여기는 톤 표와 금 기운 · 혼 기운 그림만 둔다.
import { live } from './look.js';
import { blitVec } from './vec.js';

export const SW = 16, SH = 22;
// w 내 쪽(상아) · b 적(흑단) · g 황금 적(금빛 테) · s 은빛(갈아입는 순간) · q 금빛 몸(승급)
export const TONE = {
  w: { o: '#3b2a1b', s: '#c4ad84', f: '#efe3c7', h: '#fffcf2', d: '#8c704b' },
  b: { o: '#0a070b', s: '#211828', f: '#382c41', h: '#6d5a7a', d: '#120c16' },
  g: { o: '#efbd55', s: '#3a2a1c', f: '#4b3a33', h: '#b08a4c', d: '#1a1008' },
  s: { o: '#5d6f78', s: '#b8c4cc', f: '#e4eef4', h: '#ffffff', d: '#8a9aa6' },
  q: { o: '#6b4410', s: '#c8902c', f: '#efbd55', h: '#fff1b8', d: '#9c6f24' },
};
// 각인이 새겨진 내 기물의 톤(docs/mockups/graphics.html TONES). 흑단은 적 흑단과 갈리게 테두리가 금빛
export const ENG_TONE = {
  gold: { o: '#8a5a12', s: '#c4ad84', f: '#efe3c7', h: '#fffcf2', d: '#efbd55' },
  silver: { o: '#4a5a64', s: '#9eabb6', f: '#d9e1e8', h: '#ffffff', d: '#7d8d99' },
  ivory: { o: '#6b4a2a', s: '#e3caa0', f: '#fbf2de', h: '#ffffff', d: '#d8947a' },
  ebony: { o: '#efbd55', s: '#1c110a', f: '#3a2416', h: '#6e4a2c', d: '#efbd55' },
  glass: { o: '#236b80', s: '#74c0d4', f: '#b4e8f3', h: '#ffffff', d: '#4fa3b8' },
  feather: { o: '#3b2a1b', s: '#c4ad84', f: '#efe3c7', h: '#fffcf2', d: '#8c704b' },
  // 밤샘 2
  bronze: { o: '#5a3414', s: '#a0602a', f: '#d08a48', h: '#f0c090', d: '#7a4a20' },
  iron: { o: '#1e2226', s: '#555c63', f: '#8a9299', h: '#c8d0d6', d: '#3a4046' },
  amber: { o: '#6a3a08', s: '#c87a14', f: '#f0a830', h: '#ffe0a0', d: '#9a5a10' },
  jade: { o: '#1e5a3a', s: '#3f9a60', f: '#7fd09a', h: '#d0ffe0', d: '#2e7a4a' },
  coral: { o: '#7a2a2a', s: '#d05a50', f: '#f08878', h: '#ffd0c8', d: '#a03a38' },
  marble: { o: '#3a3a4a', s: '#b0a8d0', f: '#e8e4f8', h: '#ffffff', d: '#7a70a8' },
};
// 각인 색(카드 테두리 · 이름)
export const ENG_EDGE = { gold: '#efbd55', silver: '#d8dee6', ivory: '#f2d6c4', ebony: '#c8902c', glass: '#9fd3e0', feather: '#6fd1bf', bronze: '#d08a48', iron: '#8a9299', amber: '#f0a830', jade: '#7fd09a', coral: '#f08878', marble: '#b0a8d0' };
// 기보 단계: 0 그대로 · 1 동빛 새김(레벨 1~2) · 2 은빛 테 + 장식(3~4) · 3 금빛 테 + 장식 + 기운(5~)
export const TIER = [null, { o: null, d: '#b8733a' }, { o: '#6f7f8a', d: '#dfe6ec' }, { o: '#9c6f24', d: '#efbd55' }];
export const tierOf = (level) => (!level ? 0 : level <= 2 ? 1 : level <= 4 ? 2 : 3);

// 금 단계 기물 둘레의 기운 점과 반짝임(캔버스 밖이라 따로). t가 있으면 천천히 깜빡인다.
// 벡터(안 3): 밝을 때는 네 뿔 반짝, 흐릴 때는 둥근 빛 점 — 3 × 3 자리에 그리는 곳의 배율로 굽는다(각성 막간처럼 키운 곳에서도 또렷하게)
const AURA = [[-2, 4], [16, 7], [-1, 14], [17, 15], [8, -2]];
const SPARK = '#fff1b8';
function starPaint(g) {
  g.fillStyle = SPARK;
  g.beginPath(); g.moveTo(1.5, 0); g.quadraticCurveTo(1.75, 1.25, 3, 1.5); g.quadraticCurveTo(1.75, 1.75, 1.5, 3); g.quadraticCurveTo(1.25, 1.75, 0, 1.5); g.quadraticCurveTo(1.25, 1.25, 1.5, 0); g.closePath(); g.fill();
}
function dotPaint(g) { g.fillStyle = SPARK; g.beginPath(); g.arc(1.5, 1.5, 0.6, 0, Math.PI * 2); g.fill(); }
export function tierSparkle(ctx, x, y, t = null) {
  if (t != null) live();
  AURA.forEach(([i, j], k) => {
    const on = t == null ? 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (on < 0.25) return;
    if (on > 0.7) blitVec(ctx, 'spark:star', x + i - 1, y + j - 1, 3, 3, starPaint, on);
    else blitVec(ctx, 'spark:dot', x + i - 1, y + j - 1, 3, 3, dotPaint, on);
  });
}

// 혼 기운 한 점(gfx.soulSpark): 3 × 3 자리의 둥근 빛 — 옅은 달무리 · 진한 가운데 · 왼쪽 위 흰 빛 한 점
export function orbPaint(col) {
  return (g) => {
    g.globalAlpha = 0.45; g.fillStyle = col; g.beginPath(); g.arc(1.5, 1.5, 1.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.beginPath(); g.arc(1.5, 1.5, 1.05, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.9; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(1.1, 1.1, 0.38, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  };
}
