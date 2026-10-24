// 기물 톤 · 16×22 상자 · 작은 반 도트 그림. 기물 그림은 벡터(pieces3.js)이고, 체스 여섯의 16×22 마스크(SPR)는
// 타이틀 하늘 실루엣 · 홈 화면 아이콘 · 부서지는 조각 빛깔 자리만 쓴다(안 3 다음 단계에서 바꾼다).
import { makeCanvas, context } from './surface.js';
import { LOOK, live } from './look.js';

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
  // 킹: 금 십자가를 얹은 넓은 금관 · 목 띠 · 밑동 띠만 금빛(c), 몸은 편 색. 비숍 · 퀸과 한눈에 갈리게(시안 3)
  K: ['.......cc.......','.....cccccc.....','.......cc.......','.c....cccc....c.','.cc..cc##cc..cc.','.ccc.c####c.ccc.','.cccccccccccccc.','..cccccccccccc..','...##########...','....cccccccc....','.....######.....','......####......','......####......','.....######.....','....########....','...##########...','..############..', BASE[0], BASE[1], '..cccccccccccc..', BASE[3], BASE[4]],
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

export const TYPES = Object.keys(SPR);

const SPRPIX = {};
// 마스크를 화소 목록으로(16×22). 문자: . 빈칸 · # 몸 · d 새김 · c 금빛 자리. 테(o · go) · 빛(h) · 몸(f) · 그늘(s)은 자리에서 정한다
function registerSprites(masks) {
  for (const [k, rows] of Object.entries(masks)) {
    const h = rows.length, w = rows[0].length;
    if (h !== SH || w !== SW || rows.some((r) => r.length !== w)) throw new Error(`sprite size ${k}`);
    const body = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
    const px = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') {
        const g = (a, b) => body(a, b) && rows[b][a] === 'c';
        if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) px.push([x, y, g(x - 1, y) || g(x + 1, y) || g(x, y - 1) || g(x, y + 1) ? 'go' : 'o']);
        continue;
      }
      if (ch === 'd') { px.push([x, y, 'd']); continue; }
      let l = x, r = x;
      while (body(l - 1, y)) l--;
      while (body(r + 1, y)) r++;
      const t = r > l ? (x - l) / (r - l) : 0.5;
      let tone = 'f';
      if (y >= h - 2) tone = 's';
      else if (r - l >= 2 && t <= 0.28) tone = 'h';
      else if (t >= 0.72) tone = 's';
      if (tone === 'f' && !body(x, y - 1) && t < 0.6) tone = 'h';
      if (ch === 'c') tone = `c${tone}`;
      px.push([x, y, tone]);
    }
    SPRPIX[k] = px;
  }
}
registerSprites(SPR);
// 16×22 화소 목록(타이틀 거대 실루엣 · 홈 화면 아이콘 · 조각 자리)
export const spritePixels = (type) => SPRPIX[type];

// 반 도트 그림을 쓸지: 그리는 곳의 실제 배율(뒷면 N × 그리기 변환 × 기물 배율 s)이 2 이상일 때만.
// N = 1 화면이나 1배 오프스크린 캔버스에는 16×22를 쓴다 — 32×44를 반으로 줄이면 도트가 빠진다.
// N = 1이어도 두 배로 크게 그리는 곳(사슬 칸의 큰 기물)은 32×44가 1:1로 들어맞는다.
// 변환을 모르는 캔버스(연기 시험의 가짜)는 LOOK.n을 따른다
export function hiFor(ctx, s = 1) {
  const t = ctx && ctx.getTransform ? ctx.getTransform() : null;
  const a = t && typeof t.a === 'number' ? Math.hypot(t.a, t.b) : LOOK.n;
  return a * Math.abs(s) >= 2 - 1e-6;
}

const CACHE = new Map();
// 반 도트 작은 그림(기운 점 · 혼 기운 · 아이콘 · 문장 …)을 한 번 굽는다: rows의 문자 → [빛깔, 세기]. 그릴 때는 정수 칸 상자에 늘인다(N = 3에서 번지지 않게)
export function baked(key, rows, cols) {
  let c = CACHE.get(key);
  if (c) return c;
  c = makeCanvas(rows[0].length, rows.length);
  const g = context(c);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { const v = cols[ch]; if (!v) return; g.globalAlpha = v[1]; g.fillStyle = v[0]; g.fillRect(i, j, 1, 1); }));
  CACHE.set(key, c);
  return c;
}

// 금 단계 기물 둘레의 기운 점과 반짝임(캔버스 밖이라 따로). t가 있으면 천천히 깜빡인다
// 두 배: 반 도트 한 점 + 반 도트 두 칸 길이의 가는 십자(3×3 칸 상자에 구운 그림)
const AURA = [[-2, 4], [16, 7], [-1, 14], [17, 15], [8, -2]];
const STAR_HI = ['..a...', '..a...', 'aaCaa.', '..a...', '..a...', '......'];
const DOT_HI = ['......', '......', '..C...', '......', '......', '......'];
export function tierSparkle(ctx, x, y, t = null, hi = hiFor(ctx)) {
  const a0 = ctx.globalAlpha;
  if (t != null) live();
  AURA.forEach(([i, j], k) => {
    const on = t == null ? 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (on < 0.25) return;
    if (hi) {
      const img = on > 0.7 ? baked('star', STAR_HI, { C: ['#fff1b8', 1], a: ['#fff1b8', 0.5] }) : baked('dot', DOT_HI, { C: ['#fff1b8', 1] });
      ctx.globalAlpha = a0 * on;
      ctx.drawImage(img, x + i - 1, y + j - 1, 3, 3);
      return;
    }
    ctx.globalAlpha = a0 * on;
    ctx.fillStyle = '#fff1b8'; ctx.fillRect(x + i, y + j, 1, 1);
    if (on > 0.7) { ctx.globalAlpha = a0 * on * 0.5; ctx.fillRect(x + i - 1, y + j, 1, 1); ctx.fillRect(x + i + 1, y + j, 1, 1); ctx.fillRect(x + i, y + j - 1, 1, 1); ctx.fillRect(x + i, y + j + 1, 1, 1); }
  });
  ctx.globalAlpha = a0;
}

// 혼 기운 한 점(gfx.soulSpark가 두 배일 때 쓴다): 3×3 칸 상자에 구운 둥근 빛 — 가운데 밝고 왼쪽 위에 빛 한 점
const ORB_HI = ['..oo..', '.ohoo.', 'ooCCoo', 'ooCCoo', '.oooo.', '..oo..'];
export function soulOrb(col) {
  return baked(`orb:${col}`, ORB_HI, { o: [col, 0.75], C: [col, 1], h: ['#ffffff', 0.9] });
}

