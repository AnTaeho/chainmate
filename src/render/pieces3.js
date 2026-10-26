// 벡터 기물(안 3, docs/design-notes/art3.md 1 · 2절): 작은 받침 위의 체스 말 결 실루엣(발 고리 · 기둥 · 칼라 · 머리), 셀 그늘 + 잉크 테.
// (모양, 톤, 고리 빛깔, 배율 N)마다 N배 캔버스에 한 번 굽고, 판에는 논리 크기로 붙인다 — 그리는 비용은 붙이기 한 번.
// Path2D를 쓰지 않는다(연기 시험의 가짜 캔버스에 없다): 모양은 M · L · C · Z와 타원만.
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';
import { LOOK } from './look.js';
import { TONE, ENG_TONE, TIER, tierSparkle } from './sprites.js';
import { soulSpark, place } from './gfx.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { PIECES } from '../data/pieces.js';
import { THINGS, drawThing, drawThingFit } from './board3.js';
import { trace, shapePath, scaleOf } from './vec.js';

export { scaleOf };

export const INK = '#12153a';
export const P3 = { w: 22 };                // 판 위 기물 폭(논리 px). 높이는 × 140 / 120
const S = P3.w / 120;                        // 원본(120 × 140 상자) → 논리
const PAD = 6;                               // 테가 상자 위아래로 나가는 몫(원본 단위)
const BOX = { x: 4, y: -PAD, w: 112, h: 140 + PAD * 2 }; // 모양이 x 18 ~ 102 안이라 옆은 테 몫만 남기고 줄인다
export const BASE = { x: 60, y: 124 };       // 받침 가운데(칸 가운데에 선다)
// 받침: 윗면 · 아랫면 타원(가운데 y) · 반지름, 안쪽 고리
const PLATE = { top: 121, low: 128, rx: 32, ry: 8, ring: [23, 5] };
// 선 굵기(논리 px) → 원본 단위. body = 실루엣 바깥 테, inner = 칼라 · 부분 이음매
const LW = { body: 1.0 / S, inner: 0.75 / S, base: 0.8 / S, ring: 0.6 / S, gem: 0.8 / S };
// 체스 여섯(받침 · 그림자 규칙이 처음 정해진 기물)
export const STANDARD = new Set(['P', 'N', 'B', 'R', 'Q', 'K']);

const GOLD = { fill: '#f6be45', shade: '#d48b1c' };
const BASE_W = { top: '#efe6d2', side: '#b8a47a' }, BASE_B = { top: '#262c5f', side: '#141737' };
// 톤: 몸 빛 · 그늘 · 테 + 받침(내 편 크림 · 적 남색) + 고리. hiA는 반짝 점의 짙기
function toneOf(side, eng) {
  if (side === 'b') return { fill: '#343a86', shade: '#222661', line: '#0a0c22', base: BASE_B, ring: PAL.dark, crown: GOLD, hiA: 0.22 };
  if (side === 'g') return { fill: GOLD.fill, shade: GOLD.shade, line: '#3a1d08', base: BASE_B, ring: '#efbd55', crown: null, hiA: 0.5 };
  if (side === 'q') return { fill: GOLD.fill, shade: GOLD.shade, line: '#6b4410', base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.6 };
  if (side === 's') { const t = TONE.s; return { fill: t.f, shade: t.s, line: t.o, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.7 }; }
  const e = eng && ENG_TONE[eng];
  if (e) return { fill: e.f, shade: e.s, line: e.o, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.6, glass: eng === 'glass' };
  return { fill: '#f7eedb', shade: '#dcc9a2', line: INK, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.7 };
}

// 모양: body · top · parts는 경로 글(M L C Z) 또는 타원 [cx, cy, rx, ry, 돌림]. 몸 바닥 y 117(받침 윗면 안)
// parts: 몸 위에 더 얹는 조각({ d, crown: 적이면 금 · gold: 늘 금 }) — 칼라(머리 이음매를 덮는 납작한 타원) · 발 고리도 여기.
// cuts · eyes · slit · strokes는 테 빛깔 새김, gems는 구슬, gem은 기보 보석 자리, shine은 둥근 머리의 반짝 점
// 키 위계(꼭대기 y): 킹 8(십자가) · 비숍 12(구슬) · 퀸 15 · 나이트 18 · 룩 34 · 폰 49
const FOOT = (cx = 60) => ({ d: [cx, 111, 23, 5] });
const COL = (cy, rx, ry = 4) => ({ d: [60, cy, rx, ry] });
// 기둥: 목 반폭 n(y) → 발 반폭 f(y 106)로 오목하게 퍼지고 바닥 117은 f + 2
const STEM = (y, n, f) => { const m = Math.round(y + (106 - y) * 0.55); return `M${60 - n} ${y} L${60 + n} ${y} C${60 + n} ${m} ${54 + f} 103 ${60 + f} 106 L${62 + f} 117 L${58 - f} 117 L${60 - f} 106 C${66 - f} 103 ${60 - n} ${m} ${60 - n} ${y} Z`; };
const ROOK = (y) => `M45 ${y} L75 ${y} L78 104 L82 117 L38 117 L42 104 Z`;
const HORSE = 'M40 86 C34 68 36 48 48 33 L52 18 L60 27 C72 28 82 38 88 50 C91 56 94 62 91 67 C88 72 82 73 76 69 L68 64 C62 70 66 80 76 86 Z';
const PLINTH = (y) => `M48 ${y} L72 ${y} C74 ${y + 6} 77 ${y + 10} 80 112 L81 117 L39 117 L40 112 C43 ${y + 10} 46 ${y + 6} 48 ${y} Z`;
const SHAPE = {
  P: { body: STEM(80, 7, 19), top: [60, 62, 13, 13], parts: [COL(79, 15), FOOT()], gem: [60, 52], shine: [55, 57] },
  R: { body: ROOK(66), top: 'M38 62 L38 34 L48 34 L48 42 L55 42 L55 34 L65 34 L65 42 L72 42 L72 34 L82 34 L82 62 Z', parts: [COL(64, 24), FOOT()], cuts: ['M55 94 L55 81 C55 75 65 75 65 81 L65 94 Z'], gem: [60, 48] },
  N: { body: PLINTH(86), top: HORSE, parts: [COL(86, 20, 4.5), FOOT()], eyes: [[66, 42, 4]], strokes: [['M47 42 C42 54 42 66 46 78', 3]], gem: [57, 32] },
  B: { body: STEM(74, 6, 19), top: ['M60 24 C73 33 79 45 76 57 C74 64 68 69 60 69 C52 69 46 64 44 57 C41 45 47 33 60 24 Z', [60, 18, 6, 6]], parts: [COL(72, 14), FOOT()], slit: [67, 37, 56, 51], gem: [60, 18], shine: [51, 42] },
  Q: { body: STEM(74, 7, 20), top: 'M47 72 C44 60 40 46 38 32 L48 44 L49 26 L56 42 L60 22 L64 42 L71 26 L72 44 L82 32 C80 46 76 60 73 72 Z', parts: [COL(73, 16, 4.5), FOOT()], gems: [[38, 30], [49, 24], [60, 20], [71, 24], [82, 30]], crown: true, gem: [60, 58] },
  K: { body: STEM(74, 7, 20), top: 'M47 72 C45 62 42 53 41 45 C43 36 51 32 60 32 C69 32 77 36 79 45 C78 53 75 62 73 72 Z', parts: [{ d: [60, 47, 19, 3.5], crown: true }, COL(73, 16, 4.5), FOOT()], cross: true, crown: true, gem: [60, 60] },
  // 특수 기물(같은 문법 — 발 고리 · 칼라, x 18 ~ 102 안)
  // 아마존: 나이트 말머리에 퀸의 뾰족 관(적이면 금)
  Z: { body: PLINTH(86), top: HORSE, parts: [{ d: 'M46 38 L44 20 L52 28 L58 14 L64 28 L72 20 L70 38 Z', crown: true }, COL(86, 20, 4.5), FOOT()], gems: [[44, 18], [58, 11], [72, 18]], eyes: [[68, 46, 4]], gem: [58, 32] },
  // 낙타: 혹 둘 · 긴 목(오른쪽을 본다 — 나이트와 같은 도약 가족)
  L: { body: PLINTH(98), top: 'M28 98 C22 84 28 60 43 60 C50 60 52 67 55 69 C58 61 62 55 69 55 C76 55 78 64 80 70 C86 68 84 50 86 42 C87 35 92 31 98 33 L104 37 L104 44 L96 46 C94 58 97 76 91 90 L89 98 Z', parts: [COL(98, 22, 4.5), FOOT()], eyes: [[96, 38, 3]], strokes: [['M29 76 C21 80 20 88 23 95', 3.5]], gem: [44, 60] },
  // 포: 비스듬한 포신 · 바퀴 · 낮은 포가
  O: { body: 'M38 104 L82 104 L84 117 L36 117 Z', top: 'M30 90 L80 42 L90 52 L40 100 Z', parts: [{ d: 'M76 38 L84 30 L98 44 L90 52 Z' }, { d: [48, 96, 16, 16] }, FOOT()], eyes: [[48, 96, 4.5]], strokes: [['M48 83 L48 109 M35 96 L61 96', 3]], gem: [88, 38] },
  // 궁수: 두건 쓴 몸 · 오른쪽에 크게 휜 활과 시위
  S: { body: 'M50 80 L66 80 C67 92 72 101 78 106 L80 117 L36 117 L38 106 C44 101 49 92 50 80 Z', top: 'M56 18 C70 28 76 44 74 60 C72 74 64 81 56 81 C48 81 40 74 38 60 C36 44 42 28 56 18 Z', parts: [{ d: 'M80 22 C99 40 99 92 80 110 L84 114 C105 94 105 38 84 18 Z' }, { d: [58, 81, 15, 4] }, FOOT(58)], eyes: [[56, 58, 8]], strokes: [['M82 20 L82 112', 2.5], ['M58 60 L84 60', 2.5]], gem: [56, 30] },
  // 유령: 떠 있는 망토(아랫몸이 반쯤 비친다) · 눈 둘
  W: { body: 'M60 22 C80 22 88 40 88 58 L88 96 L81 104 L74 96 L67 104 L60 96 L53 104 L46 96 L39 104 L32 96 L32 58 C32 40 40 22 60 22 Z', fade: 74, eyes: [[51, 50, 5], [69, 50, 5]], strokes: [['M54 66 C58 70 62 70 66 66', 3]], gem: [60, 30], shine: [44, 38] },
  // 꺾쇠: 룩 몸 위에 직각으로 꺾인 쇠 갈고리
  T: { body: ROOK(78), top: 'M57 78 L57 34 L42 34 L42 48 L34 56 L26 48 L26 18 L78 18 L78 78 Z', parts: [COL(78, 22, 4.5), FOOT()], strokes: [['M43 96 L77 96', 4]], eyes: [[68, 26, 3]], gem: [68, 44] },
  // 물수제비: 비숍 몸 · 물결 새긴 둥근 머리 · 머리 위로 튀어 오른 납작한 돌
  E: { body: STEM(82, 6, 19), top: [60, 64, 17, 17], parts: [{ d: [78, 24, 18, 6, -0.3] }, COL(82, 15), FOOT()], strokes: [['M44 64 C50 57 54 71 60 64 C66 57 70 71 76 64', 4]], gem: [60, 51], shine: [52, 54] },
  // 까마귀: 왼쪽을 본 새(나이트 · 낙타와 반대쪽) · 위로 든 날개 · 꽁지
  V: { body: PLINTH(98), top: 'M20 50 L38 43 C42 31 54 27 62 36 L74 16 L92 10 L86 28 L98 26 L90 46 L94 62 L98 78 L86 80 C80 96 60 100 50 92 C40 84 38 70 44 60 L38 56 Z', parts: [COL(98, 16), FOOT()], eyes: [[48, 42, 4.5]], gem: [56, 30] },
  // 광대: 밖으로 늘어진 두 갈래 고깔(끝에 방울) · 가면 · 주름 깃
  M: { body: STEM(88, 9, 19), top: [60, 64, 15, 15], parts: [{ d: 'M45 56 C41 38 31 30 24 50 C22 30 38 18 53 38 C56 32 64 32 67 38 C82 18 98 30 96 50 C89 30 79 38 75 56 Z' }, { d: 'M34 88 L42 78 L48 86 L54 78 L60 86 L66 78 L72 86 L78 78 L86 88 L78 96 L42 96 Z' }, FOOT()], gems: [[24, 54], [96, 54]], eyes: [[54, 63, 3.5], [66, 63, 3.5]], gem: [60, 34] },
  // 화약병: 아래가 무거운 둥근 병 · 마개 · 심지 · 금빛 불꽃
  D: { body: 'M60 54 C84 54 92 76 90 96 C88 110 78 117 60 117 C42 117 32 110 30 96 C28 76 36 54 60 54 Z', top: 'M50 56 L52 42 L46 42 L46 32 L74 32 L74 42 L68 42 L70 56 Z', parts: [{ d: 'M70 6 C78 13 78 19 70 23 C62 19 64 13 70 6 Z', gold: true }], strokes: [['M60 32 C60 24 70 28 70 22', 3], ['M32 86 C50 94 70 94 88 86', 4]], gem: [60, 37], shine: [44, 74] },
};
export const SHAPES = new Set(Object.keys(SHAPE));
const CROSS = 'M57 8 L63 8 L63 14 L69 14 L69 20 L63 20 L63 33 L57 33 L57 20 L51 20 L51 14 L57 14 Z';

// 셀 그늘: 모양을 그늘 빛깔로 채우고, 왼쪽으로 OFF 민 같은 모양과 겹친 곳만 빛 빛깔 — 오른쪽 가장자리를 따라 초승달 그늘이 남는다
const OFF = 9;
function fillShape(x, sh, fc) {
  shapePath(x, sh); x.fillStyle = fc.shade; x.fill();
  x.save(); shapePath(x, sh); x.clip(); x.translate(-OFF, 0); shapePath(x, sh); x.fillStyle = fc.fill; x.fill(); x.restore();
}
const edge = (x, sh, col, lw) => { shapePath(x, sh); x.strokeStyle = col; x.lineWidth = lw; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); };
const disc = (x, cx, cy, r, fill, line, lw) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = lw; x.stroke(); } };

// k: 원본 한 단위의 기기 화소. 선은 기기 화소 1 밑으로 가늘어지지 않는다(작은 손 카드 · 도감 칸에서도 테가 남는다).
// 테 위계: 모든 조각의 바깥 테를 두 배 굵기로 먼저 긋고 칠한 뒤(밖으로 body 굵기만 남는다), 조각 이음매는 inner 굵기로.
// 작은 그림(120 상자 < 기기 화소 22)은 고리 · 반짝 점을 빼고 새김을 굵게 — 몇 화소 안에서 뭉개지지 않게
function paint(x, t, C, tier, k, bare = false, lwBody = 0) {
  const S0 = SHAPE[t] || SHAPE.P;
  const small = 120 * k < 22;
  const lw = (v, min = 1) => Math.max(v, min / k);
  const LB = lwBody ? Math.max(lwBody, 1 / k) : lw(LW.body), LI = lw(LW.inner, 0.75), LBASE = lw(LW.base, 0.75), LRING = lw(LW.ring, 0.75), LGEM = lw(LW.gem, 0.75);
  // 받침: 아랫면(옆면 빛깔) → 옆 띠 → 윗면 → 고리. 기보 단계는 옆면 빛깔
  const side = tier ? TIER[tier].d : C.base.side;
  const ell = (cy, rx, ry) => { x.beginPath(); x.ellipse(60, cy, rx, ry, 0, 0, Math.PI * 2); };
  if (!bare) {
    ell(PLATE.low, PLATE.rx, PLATE.ry); x.fillStyle = side; x.fill(); x.strokeStyle = C.line; x.lineWidth = LBASE; x.stroke();
    x.fillStyle = side; x.fillRect(60 - PLATE.rx, PLATE.top, PLATE.rx * 2, PLATE.low - PLATE.top);
    ell(PLATE.top, PLATE.rx, PLATE.ry); x.fillStyle = C.base.top; x.fill(); x.strokeStyle = C.line; x.lineWidth = LBASE; x.stroke();
    if (!small) { ell(PLATE.top, PLATE.ring[0], PLATE.ring[1]); x.strokeStyle = C.ring; x.lineWidth = LRING; x.stroke(); }
  }
  const crownC = (C.crown) || C;
  const layers = [[S0.body, C]];
  if (S0.top) layers.push([S0.top, S0.crown ? crownC : C]);
  for (const p of S0.parts || []) layers.push([p.d, p.gold ? GOLD : p.crown ? crownC : C]);
  const body = () => {
    for (const [sh] of layers) edge(x, sh, C.line, LB * 2);
    for (const [sh, fc] of layers) { fillShape(x, sh, fc); edge(x, sh, C.line, LI); }
  };
  if (C.glass) x.globalAlpha = 0.88;
  if (S0.fade) {
    // 아랫몸이 반쯤 비친다(유령)
    x.save(); x.beginPath(); x.rect(-10, -10, 140, S0.fade + 10); x.clip(); body(); x.restore();
    x.save(); x.beginPath(); x.rect(-10, S0.fade, 140, 160); x.clip(); x.globalAlpha *= 0.5; body(); x.restore();
  } else body();
  x.globalAlpha = 1;
  const ink = C.line, grow = small ? 1.35 : 1;
  for (const d of S0.cuts || []) { x.beginPath(); trace(x, d); x.fillStyle = ink; x.fill(); }
  for (const [ex, ey, r] of S0.eyes || []) disc(x, ex, ey, r * grow, ink);
  if (S0.slit) { x.beginPath(); x.moveTo(S0.slit[0], S0.slit[1]); x.lineTo(S0.slit[2], S0.slit[3]); x.strokeStyle = ink; x.lineWidth = 5.5 * grow; x.lineCap = 'round'; x.stroke(); x.lineCap = 'butt'; }
  for (const [d, w] of S0.strokes || []) { x.beginPath(); trace(x, d); x.strokeStyle = ink; x.lineWidth = Math.max(w * grow, 1 / k); x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(); x.lineCap = 'butt'; }
  const gemC = C.crown || C;
  if (S0.gems) for (const [gx, gy] of S0.gems) { disc(x, gx, gy, 5, gemC.shade, ink, LGEM); disc(x, gx - 1.2, gy - 0.8, 3.2, gemC.fill); }
  if (S0.cross) { x.beginPath(); trace(x, CROSS); x.fillStyle = GOLD.fill; x.fill(); x.strokeStyle = ink; x.lineWidth = LGEM; x.lineJoin = 'round'; x.stroke(); }
  if (!small && S0.shine) disc(x, S0.shine[0], S0.shine[1], 3.2, `rgba(255,255,255,${Math.min(0.9, C.hiA + 0.2)})`);
  // 기보 2단계부터 머리 보석(은 · 금)
  if (tier >= 2 && S0.gem) disc(x, S0.gem[0], S0.gem[1], 5, tier === 3 ? '#efbd55' : '#dfe6ec', ink, LGEM);
}

// 받침 없는 실루엣(격언 그림 · 아이콘 · 행마 그림): 굽는 캔버스 g에 바로, 몸 바닥 가운데 (cx, by) · 높이 h(g 단위).
// n: g 한 단위의 기기 화소, lw: 테 굵기(g 단위, 0이면 판 위 기물과 같은 비율)
export function pieceGlyph(g, t, side, cx, by, h, n = 1, lw = 0) {
  if (!SHAPE[t]) t = artOf(t);
  const s = h / 112;
  g.save(); g.translate(cx, by); g.scale(s, s); g.translate(-60, -117);
  paint(g, t, toneOf(side), 0, s * n, true, lw / s);
  g.restore();
}

// 한 번 굽기: 열쇠 = 모양 · 편 · 각인 · 기보 단계 · 고리 빛깔 · 크기 · 배율. w: 120 상자의 논리 폭(판 위 22)
const CACHE = new Map();
export function pieceCanvas(t, side = 'w', { eng = null, tier = 0, n = LOOK.n, w = P3.w } = {}) {
  if (!SHAPE[t]) t = artOf(t);
  const C = toneOf(side, eng);
  w = Math.max(2, Math.round(w * 4) / 4);
  const key = `${t}${side}:${eng || ''}:${tier || 0}:${C.ring}:${w}:${n}`;
  let c = CACHE.get(key);
  if (c) return c;
  const s = w / 120, k = s * n;
  const cv = makeCanvas(Math.ceil(BOX.w * k), Math.ceil(BOX.h * k));
  const x = context(cv);
  x.imageSmoothingEnabled = true;
  x.setTransform(k, 0, 0, k, -BOX.x * k, -BOX.y * k);
  paint(x, t, C, tier, k);
  c = { cv, n, w: cv.width / n, h: cv.height / n, ox: (BASE.x - BOX.x) * s, oy: (BASE.y - BOX.y) * s };
  if (CACHE.size > 3000) CACHE.clear();
  CACHE.set(key, c);
  return c;
}
// 그림이 없는 id(뺀 기물이 data에 남은 동안)는 바탕 기물(기보 모습), 그것도 없으면 폰
export const artOf = (t) => (SHAPE[t] || THINGS.has(t) ? t : (PIECES[t] && SHAPE[PIECES[t].chart]) ? PIECES[t].chart : 'P');
// 굽은 그림 하나를 받침 가운데 (cx, cy)에 붙인다. hx: 가로 배율(뒤집힘)
function blit(ctx, c, cx, cy, alpha, hx) {
  const a0 = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = a0 * alpha;
  const y = place(cy - c.oy);
  if (hx === 1) ctx.drawImage(c.cv, place(cx - c.ox), y, c.w, c.h);
  else ctx.drawImage(c.cv, place(cx - c.ox * Math.abs(hx)), y, Math.max(0.5, c.w * Math.abs(hx)), c.h);
  ctx.globalAlpha = a0;
}
// 금 기운 · 혼 기운: 옛 16 × 22 기물 상자 (bx, by)에 선다
function sparks(ctx, bx, by, tier, soul, awake, time, alpha) {
  const a0 = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = a0 * alpha;
  if (tier === 3) tierSparkle(ctx, bx, by, time);
  if (soul) {
    soulSpark(ctx, bx - 2, by, SOUL_BY_ID[soul] ? SOUL_BY_ID[soul].col : '#ffffff', time, true);
    if (awake) soulSpark(ctx, bx + 14, by - 2, PAL.gold, time == null ? null : time + 1.3, true);
  }
  ctx.globalAlpha = a0;
}
// 판 위 기물 하나를 받침 가운데 (cx, cy)에. sx: 가로 배율(갈아입을 때 뒤집힘), alpha. 각인 · 기보 · 혼은 내 편만. 사물(벽 · 보석)은 board3.js
export function piece3(ctx, t, side, cx, cy, { alpha = 1, sx = 1, eng = null, tier = 0, soul = null, awake = false, time = null } = {}) {
  if (alpha <= 0) return;
  if (THINGS.has(t)) { drawThing(ctx, t, cx, cy, alpha); return; }
  const c = pieceCanvas(t, side, { eng, tier, n: scaleOf(ctx) });
  if (sx === 1) sparks(ctx, Math.round(cx - 8), Math.round(cy - PIECE_TOP + 2), tier, soul, awake, time, alpha);
  blit(ctx, c, cx, cy, alpha, sx);
}
// 판 밖 기물(손 카드 · 사슬 칸 · 도감 · 상점 …): 정면 그림을 상자 (x, y, bw, bh) 안에 맞춰 — 받침 아래가 상자 아래, 가로 가운데.
// 모든 기물이 같은 비율로 줄어 크기를 견줄 수 있다. hx: 가로 배율(뒤집힘). 금 기운 · 혼 기운은 상자 가운데 16 폭 자리에
const FIT = { w: 92, h: 131, below: PLATE.low + PLATE.ry + 1 - BASE.y };
export function fitScale(bw, bh) { return Math.min(bw / FIT.w, bh / FIT.h); }
// 상자에 맞춘 기물의 받침 가운데(cx, cy)와 120 상자 논리 폭 w
export function fitAt(x, y, bw, bh) { const s = fitScale(bw, bh); return { cx: x + bw / 2, cy: y + bh - FIT.below * s, w: s * 120 }; }
export function fitPiece(ctx, t, side, x, y, bw, bh, { alpha = 1, hx = 1, eng = null, tier = 0, soul = null, awake = false, time = null, spark = true } = {}) {
  if (alpha <= 0 || bw <= 0 || bh <= 0) return;
  t = artOf(t);
  const { cx, cy, w } = fitAt(x, y, bw, bh);
  if (THINGS.has(t)) { drawThingFit(ctx, t, cx, y + bh, w, alpha); return; }
  const c = pieceCanvas(t, side, { eng, tier, n: scaleOf(ctx), w });
  if (hx === 1 && spark) sparks(ctx, Math.round(cx - 8), Math.round(y), tier, soul, awake, time, alpha);
  blit(ctx, c, cx, cy, alpha, hx);
}
// 기물 모양 한 빛깔(빛 테 · 흰 번쩍임): grow는 둘레로 넓힐 기기 화소. 돌려주는 것은 pieceCanvas와 같은 꼴(ox · oy는 받침 가운데)
const MASKS = new Map();
// 화면 배율이 바뀌면 옛 배율로 구운 기물 · 테를 버린다(app.setScale, P-17)
export function clearPieceCache() { CACHE.clear(); MASKS.clear(); }
export function pieceMask(t, col, { w = P3.w, n = LOOK.n, grow = 0 } = {}) {
  t = artOf(t);
  const key = `${t}:${col}:${Math.round(w * 4) / 4}:${n}:${grow}`;
  let m = MASKS.get(key);
  if (m) return m;
  const c = THINGS.has(t) ? pieceCanvas('P', 'w', { n, w }) : pieceCanvas(t, 'w', { n, w });
  const cv = makeCanvas(c.cv.width + grow * 2, c.cv.height + grow * 2), g = context(cv);
  for (const [dx, dy] of grow ? [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] : [[0, 0]]) g.drawImage(c.cv, grow + dx * grow, grow + dy * grow);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over';
  m = { cv, n, w: cv.width / n, h: cv.height / n, ox: c.ox + grow / n, oy: c.oy + grow / n };
  if (MASKS.size > 400) MASKS.clear();
  MASKS.set(key, m);
  return m;
}
export function drawMask(ctx, m, cx, cy, alpha = 1) { blit(ctx, m, cx, cy, alpha, 1); }
// 받침 가운데에서 기물 꼭대기까지(이름표 · 동전 · 금빛 빛이 기댄다)
export const PIECE_TOP = Math.round((BASE.y - 6) * S); // 22

// 부서질 조각의 빛깔 점(16 × 22 자리): 벡터 모양(fitPiece와 같은 맞춤)을 칸 가운데마다 재서 톤 빛깔
// (빛 → 몸, 왼쪽으로 OFF 민 모양 밖 → 그늘, 새김 · 눈 → 테, 관 · 금 조각 → 금, 받침 → 받침 빛깔). 사물은 제 빛깔 덩이
const THING_CHIPS = {
  X: { box: [2, 8, 12, 12], cols: ['#9aa6a1', '#6f7a76', '#4e5754'] },
  J: { box: [4, 9, 8, 7], cols: ['#e8fffc', '#6fd8e6', '#2f9fb0'] },
};
// 경로 글 · 타원 → 다각형(곡선은 여덟 토막). 안팎은 짝홀 규칙
function polys(sh) {
  const list = Array.isArray(sh) && typeof sh[0] === 'number' ? [sh] : Array.isArray(sh) ? sh : [sh], out = [];
  for (const p of list) {
    if (typeof p !== 'string') {
      const [cx, cy, rx, ry, r = 0] = p, pts = [];
      for (let i = 0; i < 24; i++) { const q = (i / 24) * Math.PI * 2, ex = rx * Math.cos(q), ey = ry * Math.sin(q); pts.push([cx + ex * Math.cos(r) - ey * Math.sin(r), cy + ex * Math.sin(r) + ey * Math.cos(r)]); }
      out.push(pts); continue;
    }
    const t = p.match(/[MLCZ]|-?\d+(?:\.\d+)?/g);
    let i = 0, cmd = null, cur = null;
    const n = () => Number(t[i++]);
    while (i < t.length) {
      if (/[MLCZ]/.test(t[i])) cmd = t[i++];
      if (cmd === 'M') { cur = [[n(), n()]]; out.push(cur); }
      else if (cmd === 'L') cur.push([n(), n()]);
      else if (cmd === 'C') {
        const [x0, y0] = cur[cur.length - 1], a = [n(), n()], b = [n(), n()], e = [n(), n()];
        for (let k = 1; k <= 8; k++) { const u = k / 8, v = 1 - u; cur.push([v * v * v * x0 + 3 * v * v * u * a[0] + 3 * v * u * u * b[0] + u * u * u * e[0], v * v * v * y0 + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u * u * u * e[1]]); }
      }
    }
  }
  return out;
}
function inside(ps, x, y) {
  let c = false;
  for (const pts of ps) for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const CHIP_GEO = new Map();
function chipGeo(t) {
  let g = CHIP_GEO.get(t);
  if (g) return g;
  const S0 = SHAPE[t];
  g = {
    body: polys(S0.body), top: S0.top ? polys(S0.top) : null, crownTop: !!S0.crown,
    parts: (S0.parts || []).map((q) => ({ ps: polys(q.d), gold: !!q.gold, crown: !!q.crown })),
    ink: [...(S0.cuts || []).map(polys), ...(S0.eyes || []).map(([x, y, r]) => polys([x, y, r, r]))],
    gems: (S0.gems || []).map(([x, y]) => polys([x, y, 5, 5])), cross: S0.cross ? polys(CROSS) : null,
  };
  CHIP_GEO.set(t, g);
  return g;
}
export function pieceChips(t, side, eng = null) {
  t = artOf(t);
  const th = THING_CHIPS[t];
  if (th) {
    const [x0, y0, w, h] = th.box, out = [];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push({ x, y, col: th.cols[(x * 7 + y * 3) % 3] });
    return out;
  }
  const C = toneOf(side, eng), G = chipGeo(t), crownC = C.crown || C;
  const { cx, cy, w } = fitAt(0, 0, 16, 22), s = w / 120, out = [];
  // 셀 그늘과 같은 규칙: 왼쪽으로 OFF 민 같은 모양 안이면 빛, 아니면 그늘
  const tone = (fc, ps, X, Y) => (inside(ps, X + OFF, Y) ? fc.fill : fc.shade);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 16; x++) {
    const X = BASE.x + (x + 0.5 - cx) / s, Y = BASE.y + (y + 0.5 - cy) / s;
    let col = null;
    if (G.cross && inside(G.cross, X, Y)) col = GOLD.fill;
    else if (G.ink.some((ps) => inside(ps, X, Y))) col = C.line;
    else if (G.gems.some((ps) => inside(ps, X, Y))) col = C.crown ? C.crown.fill : C.fill;
    else {
      const part = G.parts.find((q) => inside(q.ps, X, Y));
      if (part) col = tone(part.gold ? GOLD : part.crown ? crownC : C, part.ps, X, Y);
      else if (G.top && inside(G.top, X, Y)) col = tone(G.crownTop ? crownC : C, G.top, X, Y);
      else if (inside(G.body, X, Y)) col = tone(C, G.body, X, Y);
      else if (Math.abs(X - 60) <= PLATE.rx && Y >= PLATE.top - PLATE.ry && Y <= PLATE.low + PLATE.ry) {
        const e = (cy) => ((X - 60) / PLATE.rx) ** 2 + ((Y - cy) / PLATE.ry) ** 2 <= 1;
        if (e(PLATE.top)) col = C.base.top; else if (e(PLATE.low) || (Y >= PLATE.top && Y <= PLATE.low)) col = C.base.side;
      }
    }
    if (col) out.push({ x, y, col });
  }
  return out;
}
