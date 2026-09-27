// 기물 스프라이트 16×22. mockup의 SPR · TONE · sprite()를 옮겼다.
// 모양 마스크(# 몸, d 새김)에서 테두리 · 빛 · 몸 · 그늘을 자동으로 만들고, 한 번 그려 오프스크린 캔버스에 둔다.
import { makeCanvas, context } from './surface.js';
import { FAIRY_SPR } from './fairy-sprites.js';

export const SW = 16, SH = 22;
const BASE = ['...##########...', '..############..', '..dddddddddddd..', '..############..', '................'];
const E = '................';
export const SPR = {
  P: [E, E, E, E, E, E, '......####......', '.....######.....', '.....######.....', '.....######.....', '......####......', '....########....', '......####......', '......####......', '.....######.....', '....########....', '...##########...', ...BASE],
  N: [E, '........##......', '.......####.....', '......######....', '.....#######d...', '....###d#####...', '...##########d..', '..############..', '..############d.', '..d####..######.', '...##....######.', '.........######.', '........#######.', '.......########.', '......########..', '....##########..', '...##########...', ...BASE],
  B: ['.......##.......', '.......##.......', '......####......', '.....######.....', '....####d###....', '....###d####....', '....##d#####....', '.....######.....', '......####......', '.....######.....', '....dddddddd....', '......####......', '......####......', '.....######.....', '....########....', '...##########...', '...##########...', ...BASE],
  R: [E, E, '...##.####.##...', '...##.####.##...', '...##########...', '...##########...', '....########....', '.....######.....', '.....##d###.....', '.....######.....', '.....###d##.....', '.....######.....', '.....##d###.....', '.....######.....', '....########....', '...##########...', '...dddddddddd...', ...BASE],
  // 퀸: mockup보다 꼭대기 구슬과 가운데 뿔을 세웠다(1배에서 룩의 성가퀴와 섞여 보였다)
  Q: ['.......##.......','..#....##....#..','..#...#..#...#..','..##..#..#..##..','...###.##.###...','....########....','.....#dddd#.....','......####......','.......##.......','......####......','.....######.....','......####......','......####......','.....######.....','....########....','...##########...','...##########...', ...BASE],
  // 킹: 양 끝이 솟은 넓은 왕관 위 십자가(비숍과 윤곽이 갈리게, docs/mockups/graphics.html KT)
  K: ['.......##.......','.....######.....','.......##.......','...#..####..#...','...##########...','...#d######d#...','....########....','.....#dddd#.....','......####......','.....######.....','......####......','......####......','.....######.....','.....######.....','....########....','...##########...','...##########...', ...BASE],
};
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
};
// 각인 색(카드 테두리 · 이름)
export const ENG_EDGE = { gold: '#efbd55', silver: '#d8dee6', ivory: '#f2d6c4', ebony: '#c8902c', glass: '#9fd3e0', feather: '#6fd1bf' };
// 기보 단계: 0 그대로 · 1 동빛 새김(레벨 1~2) · 2 은빛 테 + 장식(3~4) · 3 금빛 테 + 장식 + 기운(5~)
export const TIER = [null, { o: null, d: '#b8733a' }, { o: '#6f7f8a', d: '#dfe6ec' }, { o: '#9c6f24', d: '#efbd55' }];
export const tierOf = (level) => (!level ? 0 : level <= 2 ? 1 : level <= 4 ? 2 : 3);

// 판 위 사물은 편과 상관없이 제 빛깔(벽 = 돌 회색, 보석 = 청록 반짝)
export const THING_TONE = {
  X: { o: '#1a1d1c', s: '#4e5754', f: '#6f7a76', h: '#9aa6a1', d: '#353c3a' },
  J: { o: '#0d3a40', s: '#2f9fb0', f: '#6fd8e6', h: '#e8fffc', d: '#1f7280' },
};
export const TYPES = Object.keys(SPR);

const SPRPIX = {};
export function registerSprites(masks) {
  for (const [k, rows] of Object.entries(masks)) {
    if (rows.length !== SH) throw new Error(`sprite height ${k}`);
    if (!SPR[k]) SPR[k] = rows;
    const body = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && rows[y][x] !== '.';
    const px = [];
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const ch = rows[y][x];
      if (ch === '.') {
        if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) px.push([x, y, 'o']);
        continue;
      }
      if (ch === 'd') { px.push([x, y, 'd']); continue; }
      let l = x, r = x;
      while (body(l - 1, y)) l--;
      while (body(r + 1, y)) r++;
      const t = r > l ? (x - l) / (r - l) : 0.5;
      let tone = 'f';
      if (y >= SH - 2) tone = 's';
      else if (r - l >= 2 && t <= 0.28) tone = 'h';
      else if (t >= 0.72) tone = 's';
      if (tone === 'f' && !body(x, y - 1) && t < 0.6) tone = 'h';
      if (ch === 'x') tone = 'x';
      px.push([x, y, tone]);
    }
    SPRPIX[k] = px;
  }
}
registerSprites(SPR);
registerSprites(FAIRY_SPR); // 이형 아홉(깊이 A)
export const spritePixels = (type) => SPRPIX[type];

// 머리 꼭대기(보석 자리): 가장 위 몸 줄의 가운데
function crownOf(type) {
  const rows = SPR[type];
  for (let y = 0; y < SH; y++) {
    const xs = [...rows[y]].map((ch, x) => (ch !== '.' ? x : -1)).filter((x) => x >= 0);
    if (xs.length) return { x: Math.floor((xs[0] + xs[xs.length - 1]) / 2), y };
  }
  return { x: 7, y: 0 };
}
const PLUME = [[4, 0], [3, 1], [4, 1], [2, 2], [3, 2], [2, 3]];
const FEATHER = ['..#', '.##', '.#w', '##w', '#w.', 'w..'];
const GLINT = [[5, 9], [6, 8], [5, 13], [6, 12], [7, 11]];

const CACHE = new Map();
// 기물 하나의 캔버스(그림자 포함 16×22). eng: 각인 id(내 기물만) · tier: 기보 단계 0~3
export function spriteCanvas(type, side, eng = null, tier = 0) {
  if (!SPRPIX[type]) type = 'P';
  const key = `${type}${side}:${eng || ''}:${tier || 0}`;
  let c = CACHE.get(key);
  if (c) return c;
  c = makeCanvas(SW, SH);
  const ctx = context(c);
  const tone = { ...(THING_TONE[type] || (eng && ENG_TONE[eng] ? ENG_TONE[eng] : TONE[side])) };
  tone.x = tone.f;
  if (tier) { const tr = TIER[tier]; if (tr.o) tone.o = tr.o; tone.d = tr.d; }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.fillRect(3, SH - 1, 10, 1);
  ctx.fillRect(2, SH - 2, 12, 1);
  const px = SPRPIX[type];
  if (tier === 3) { ctx.fillStyle = 'rgba(239,189,85,0.5)'; for (const [i, j] of px) if (i > 0) ctx.fillRect(i - 1, j, 1, 1); }
  ctx.globalAlpha = eng === 'glass' ? 0.88 : 1;
  for (const [i, j, t] of px) {
    // 흐린 몸(x): 반투명
    if (t === 'x') { ctx.globalAlpha = 0.45; ctx.fillStyle = tone.f; ctx.fillRect(i, j, 1, 1); ctx.globalAlpha = eng === 'glass' ? 0.88 : 1; continue; }
    ctx.fillStyle = tone[t]; ctx.fillRect(i, j, 1, 1);
  }
  ctx.globalAlpha = 1;
  if (eng === 'glass') { ctx.fillStyle = '#ffffff'; for (const [i, j] of GLINT) ctx.fillRect(i, j, 1, 1); }
  if (eng === 'feather') FEATHER.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] !== '.') { ctx.fillStyle = r[i] === '#' ? '#4fb3a4' : '#e8fff9'; ctx.fillRect(12 + i, 9 + j, 1, 1); } });
  if (tier >= 2) {
    if (type === 'N') { ctx.fillStyle = tier === 3 ? '#df5a45' : '#b8c4cc'; for (const [i, j] of PLUME) ctx.fillRect(i, j, 1, 1); }
    else {
      const { x, y } = crownOf(type);
      const gem = tier === 3 ? ['#efbd55', '#fff1b8'] : ['#9eabb6', '#ffffff'];
      ctx.fillStyle = gem[0]; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = gem[1]; ctx.fillRect(x, y, 1, 1);
    }
  }
  CACHE.set(key, c);
  return c;
}

// 금 단계 기물 둘레의 기운 점과 반짝임(캔버스 밖이라 따로). t가 있으면 천천히 깜빡인다
const AURA = [[-2, 4], [16, 7], [-1, 14], [17, 15], [8, -2]];
export function tierSparkle(ctx, x, y, t = null) {
  AURA.forEach(([i, j], k) => {
    const on = t == null ? 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (on < 0.25) return;
    ctx.globalAlpha = on;
    ctx.fillStyle = '#fff1b8'; ctx.fillRect(x + i, y + j, 1, 1);
    if (on > 0.7) { ctx.globalAlpha = on * 0.5; ctx.fillRect(x + i - 1, y + j, 1, 1); ctx.fillRect(x + i + 1, y + j, 1, 1); ctx.fillRect(x + i, y + j - 1, 1, 1); ctx.fillRect(x + i, y + j + 1, 1, 1); }
  });
  ctx.globalAlpha = 1;
}

// 테두리만 남긴 빈 윤곽(증원 그림자). 격자 밖 1px까지 둘러 18×24, (x-1, y-1)에 그린다.
// 속은 네 칸에 한 점만 찍어(성긴 그물) 밝은 칸에서 상아(내 기물)로, 어두운 칸에서 흑단으로 읽히지 않게.
// dotted: 윤곽도 한 칸 걸러, 속은 비운다(두 수 앞 증원)
export function outlineCanvas(type, col, dotted = false) {
  const key = `o:${type}:${col}:${dotted ? 1 : 0}`;
  let c = CACHE.get(key);
  if (c) return c;
  const rows = SPR[type];
  const body = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && rows[y][x] !== '.';
  c = makeCanvas(SW + 2, SH + 2);
  const ctx = context(c);
  ctx.fillStyle = col;
  for (let y = -1; y <= SH; y++) for (let x = -1; x <= SW; x++) {
    if (body(x, y)) { if (!dotted && x % 2 === 0 && y % 2 === 0) ctx.fillRect(x + 1, y + 1, 1, 1); continue; }
    if (!(body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1))) continue;
    if (dotted && (x + y) % 2) continue;
    ctx.fillRect(x + 1, y + 1, 1, 1);
  }
  CACHE.set(key, c);
  return c;
}

// 조각으로 부서질 때 쓰는 몸 색 점들(테두리 빼고)
export function spriteChips(type, side, eng = null) {
  const tone = { ...(THING_TONE[type] || (eng && ENG_TONE[eng] ? ENG_TONE[eng] : TONE[side])) };
  tone.x = tone.f;
  return (SPRPIX[type] || SPRPIX.P).filter(([, , t]) => t !== 'o').map(([x, y, t]) => ({ x, y, col: tone[t] }));
}
