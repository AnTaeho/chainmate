// 기물 스프라이트 16×22. mockup의 SPR · TONE · sprite()를 옮겼다.
// 모양 마스크(# 몸, d 새김)에서 테두리 · 빛 · 몸 · 그늘을 자동으로 만들고, 한 번 그려 오프스크린 캔버스에 둔다.
// 두 배 도트(CHM-39): 화면 배율 N ≥ 2면 32×44 마스크(sprites-hi.js)를 16×22 자리에 반 도트로 그린다. N = 1은 16×22 그대로.
import { makeCanvas, context } from './surface.js';
import { FAIRY_SPR } from './fairy-sprites.js';
import { SPR_HI } from './sprites-hi.js';
import { LOOK } from './look.js';

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
// 킹의 금빛 자리(c): 편 · 각인과 상관없이 금빛. 상아 위 금빛 둘레는 짙은 금갈색(go)
const GOLD = { cf: '#eaa92c', ch: '#ffe79a', cs: '#b27414' };
const goldOf = (tone, light) => ({ ...GOLD, go: light ? '#5a3a0c' : tone.o });
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

// 판 위 사물은 편과 상관없이 제 빛깔(벽 = 돌 회색, 보석 = 청록 반짝)
export const THING_TONE = {
  X: { o: '#1a1d1c', s: '#4e5754', f: '#6f7a76', h: '#9aa6a1', d: '#353c3a' },
  J: { o: '#0d3a40', s: '#2f9fb0', f: '#6fd8e6', h: '#e8fffc', d: '#1f7280' },
};
export const TYPES = Object.keys(SPR);

const SPRPIX = {};
const SPRPIX_HI = {};
// 마스크를 화소 목록으로. 크기는 줄에서 읽는다: 16×22(배율 k 1) 또는 32×44(k 2) — 바닥 그늘 줄 수만 k배.
// 문자: . 빈칸 · # 몸 · d 새김 · c 금빛 자리 · x 흐린 몸 · l 1px 테 빛깔 줄(몸이 아니라 둘레 테를 만들지 않는다)
export function registerSprites(masks) {
  for (const [k, rows] of Object.entries(masks)) {
    const h = rows.length, w = rows[0].length, sc = h / SH;
    if (sc !== 1 && sc !== 2) throw new Error(`sprite height ${k}`);
    if (rows.some((r) => r.length !== w) || w !== SW * sc) throw new Error(`sprite width ${k}`);
    if (sc === 1 && !SPR[k]) SPR[k] = rows;
    const body = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.' && rows[y][x] !== 'l';
    const px = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === 'l') { px.push([x, y, 'o']); continue; }
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
      if (y >= h - 2 * sc) tone = 's';
      else if (r - l >= 2 && t <= 0.28) tone = 'h';
      else if (t >= 0.72) tone = 's';
      if (tone === 'f' && !body(x, y - 1) && t < 0.6) tone = 'h';
      if (ch === 'x') tone = 'x';
      if (ch === 'c') tone = `c${tone}`;
      px.push([x, y, tone]);
    }
    (sc === 2 ? SPRPIX_HI : SPRPIX)[k] = px;
  }
}
registerSprites(SPR);
registerSprites(FAIRY_SPR); // 이형 열(CHM-55: 낙타 · 포 · 궁수 · 유령 · 아마존 + 꺾쇠 · 물수제비 · 까마귀 · 광대 · 화약병)
registerSprites(SPR_HI);    // 두 배 도트(CHM-39)
// 16×22 화소 목록(타이틀 거대 실루엣 · 홈 화면 아이콘은 늘 이것)
export const spritePixels = (type) => SPRPIX[type];
export const spritePixelsHi = (type) => SPRPIX_HI[type];

// 반 도트 그림을 쓸지: 그리는 곳의 실제 배율(뒷면 N × 그리기 변환 × 기물 배율 s)이 2 이상일 때만.
// N = 1 화면이나 1배 오프스크린 캔버스에는 16×22를 쓴다 — 32×44를 반으로 줄이면 도트가 빠진다.
// N = 1이어도 두 배로 크게 그리는 곳(사슬 칸의 큰 기물)은 32×44가 1:1로 들어맞는다.
// 변환을 모르는 캔버스(연기 시험의 가짜)는 LOOK.n을 따른다
export function hiFor(ctx, s = 1) {
  const t = ctx && ctx.getTransform ? ctx.getTransform() : null;
  const a = t && typeof t.a === 'number' ? Math.hypot(t.a, t.b) : LOOK.n;
  return a * Math.abs(s) >= 2 - 1e-6;
}

// 머리 꼭대기(보석 자리): 가장 위 몸 줄의 가운데.
// 꼭대기가 머리가 아닌 기물은 자리를 따로 준다(1배 · 두 배): 까마귀 = 머리(꼭대기는 든 날개) · 광대 = 고깔 띠 가운데(두 갈래 사이 빈 곳) · 화약병 = 마개(꼭대기는 불꽃)
const CROWN = { V: [{ x: 12, y: 2 }, { x: 22, y: 3 }], M: [{ x: 7, y: 3 }, { x: 15, y: 8 }], D: [{ x: 7, y: 5 }, { x: 15, y: 10 }] };
function crownOf(rows, type) {
  if (CROWN[type]) return CROWN[type][rows.length === SH ? 0 : 1];
  for (let y = 0; y < rows.length; y++) {
    const xs = [...rows[y]].map((ch, x) => (ch !== '.' && ch !== 'l' ? x : -1)).filter((x) => x >= 0);
    if (xs.length) return { x: Math.floor((xs[0] + xs[xs.length - 1]) / 2), y };
  }
  return { x: 7, y: 0 };
}
// 장식(각인 깃 · 유리 반짝임 · 나이트 깃): 1배 / 두 배
const PLUME = [[4, 0], [3, 1], [4, 1], [2, 2], [3, 2], [2, 3]];
const PLUME_HI = ['......#', '.....##', '....###', '...###.', '..###..', '.###...', '.##....', '##.....'];
const FEATHER = ['..#', '.##', '.#w', '##w', '#w.', 'w..'];
// 두 배 깃: 깃대(w) 양쪽으로 깃털(#), 끝은 가늘게
const FEATHER_HI = ['....#', '...##', '..###', '..##w', '.###w', '.##w#', '.#w##', '##w#.', '#w##.', '#w#..', 'w#...', 'w....'];
const GLINT = [[5, 9], [6, 8], [5, 13], [6, 12], [7, 11]];
// 두 배 유리 반짝임: 1px 사선 두 줄(긴 것 · 짧은 것)
const GLINT_HI = [[10, 19], [11, 18], [12, 17], [13, 16], [10, 27], [11, 26], [12, 25], [13, 24], [14, 23], [15, 22]];

const CACHE = new Map();
const toneOf = (type, side, eng) => {
  const tone = { ...(THING_TONE[type] || (eng && ENG_TONE[eng] ? ENG_TONE[eng] : TONE[side])) };
  tone.x = tone.f;
  Object.assign(tone, goldOf(tone, side === 'w' && !eng));
  return tone;
};
// 기물 하나의 캔버스(그림자 포함). eng: 각인 id(내 기물만) · tier: 기보 단계 0~3
// hi: 32×44 캔버스(16×22 자리에 반 도트로 그린다) — 그리는 곳은 늘 크기를 SW × SH로 준다. 없으면 LOOK.n ≥ 2
export function spriteCanvas(type, side, eng = null, tier = 0, hi = LOOK.n >= 2) {
  if (!SPRPIX[type]) type = 'P';
  const k = hi && SPRPIX_HI[type] ? 2 : 1;
  const key = `${type}${side}:${eng || ''}:${tier || 0}:${k}`;
  let c = CACHE.get(key);
  if (c) return c;
  const w = SW * k, h = SH * k;
  c = makeCanvas(w, h);
  const ctx = context(c);
  const tone = toneOf(type, side, eng);
  if (tier) { const tr = TIER[tier]; if (tr.o) tone.o = tr.o; tone.d = tr.d; }
  // 바닥 그늘: 1배 두 줄 · 두 배 세 줄(위가 좁고 아래가 둥글게)
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  if (k === 1) { ctx.fillRect(3, SH - 1, 10, 1); ctx.fillRect(2, SH - 2, 12, 1); }
  else { ctx.fillRect(7, h - 1, 18, 1); ctx.fillRect(5, h - 2, 22, 1); ctx.fillRect(4, h - 3, 24, 1); }
  const px = (k === 2 ? SPRPIX_HI : SPRPIX)[type];
  // 금 단계: 몸 왼쪽으로 금 기운(1배 1px · 두 배 2px)
  if (tier === 3) { ctx.fillStyle = 'rgba(239,189,85,0.5)'; for (const [i, j] of px) if (i >= k) ctx.fillRect(i - k, j, k, 1); }
  ctx.globalAlpha = eng === 'glass' ? 0.88 : 1;
  for (const [i, j, t] of px) {
    // 흐린 몸(x): 반투명
    if (t === 'x') { ctx.globalAlpha = 0.45; ctx.fillStyle = tone.f; ctx.fillRect(i, j, 1, 1); ctx.globalAlpha = eng === 'glass' ? 0.88 : 1; continue; }
    ctx.fillStyle = tone[t]; ctx.fillRect(i, j, 1, 1);
  }
  ctx.globalAlpha = 1;
  const pat = (rows, x0, y0, cols) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (cols[ch]) { ctx.fillStyle = cols[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } }));
  if (eng === 'glass') { ctx.fillStyle = '#ffffff'; for (const [i, j] of k === 2 ? GLINT_HI : GLINT) ctx.fillRect(i, j, 1, 1); }
  if (eng === 'feather') {
    if (k === 1) pat(FEATHER, 12, 9, { '#': '#4fb3a4', w: '#e8fff9' });
    else pat(FEATHER_HI, 25, 17, { '#': '#4fb3a4', w: '#e8fff9' });
  }
  if (tier >= 2) {
    const plume = tier === 3 ? '#df5a45' : '#b8c4cc';
    if (type === 'N') {
      ctx.fillStyle = plume;
      if (k === 1) for (const [i, j] of PLUME) ctx.fillRect(i, j, 1, 1);
      else pat(PLUME_HI, 7, 0, { '#': plume });
    } else {
      const { x, y } = crownOf(k === 2 ? SPR_HI[type] : SPR[type], type);
      const gem = tier === 3 ? ['#efbd55', '#fff1b8', '#9c6f24'] : ['#9eabb6', '#ffffff', '#6f7f8a'];
      if (k === 1) { ctx.fillStyle = gem[0]; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = gem[1]; ctx.fillRect(x, y, 1, 1); }
      else {
        // 두 배 보석: 어두운 받침 4×2 위에 2×2 보석 · 빛 1px
        ctx.fillStyle = gem[2]; ctx.fillRect(x - 1, y, 4, 2);
        ctx.fillStyle = gem[0]; ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = gem[1]; ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  CACHE.set(key, c);
  return c;
}

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

// 테두리만 남긴 빈 윤곽(증원 그림자). 격자 밖 1칸까지 둘러 18×24 자리, (x-1, y-1)에 그린다 — 그리는 곳은 크기를 SW + 2 × SH + 2로 준다.
// 속은 네 칸에 한 점만 찍어(성긴 그물) 밝은 칸에서 상아(내 기물)로, 어두운 칸에서 흑단으로 읽히지 않게.
// dotted: 윤곽도 한 칸 걸러, 속은 비운다(두 수 앞 증원)
// 두 배: 36×48 캔버스, 윤곽은 몸 바로 밖 반 도트 한 줄(바깥 반 도트는 비운다), 그물 · 점선 간격은 1배와 같은 도트 간격
export function outlineCanvas(type, col, dotted = false, hi = LOOK.n >= 2) {
  const k = hi && SPR_HI[type] ? 2 : 1;
  const key = `o:${type}:${col}:${dotted ? 1 : 0}:${k}`;
  let c = CACHE.get(key);
  if (c) return c;
  const rows = (k === 2 ? SPR_HI : SPR)[type];
  const w = SW * k, h = SH * k;
  const body = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.' && rows[y][x] !== 'l';
  c = makeCanvas(w + 2 * k, h + 2 * k);
  const ctx = context(c);
  ctx.fillStyle = col;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (body(x, y)) { if (!dotted && x % (2 * k) === 0 && y % (2 * k) === 0) ctx.fillRect(x + k, y + k, 1, 1); continue; }
    if (!(body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1))) continue;
    if (dotted && (Math.floor(x / k) + Math.floor(y / k)) % 2) continue;
    ctx.fillRect(x + k, y + k, 1, 1);
  }
  CACHE.set(key, c);
  return c;
}

// 조각으로 부서질 때 쓰는 몸 색 점들(테두리 빼고). 자리는 늘 16×22 칸(조각은 한두 도트 크기로 날아간다) —
// 두 배면 32×44 마스크에서 빛깔을 뽑아 자리를 반으로(빛 · 새김 · 금빛이 더 고르게 섞인다)
export function spriteChips(type, side, eng = null, hi = LOOK.n >= 2) {
  const tone = toneOf(type, side, eng);
  const k = hi && SPRPIX_HI[type] ? 2 : 1;
  const px = (k === 2 ? SPRPIX_HI : SPRPIX)[type] || SPRPIX.P;
  return px.filter(([, , t]) => t !== 'o' && t !== 'go').map(([x, y, t]) => ({ x: Math.floor(x / k), y: Math.floor(y / k), col: tone[t] }));
}
