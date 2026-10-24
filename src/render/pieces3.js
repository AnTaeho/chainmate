// 벡터 기물(안 3, docs/design-notes/art3.md 1 · 2절): 둥근 받침 위의 굵은 실루엣, 왼쪽 빛 · 오른쪽 그늘 두 톤 + 잉크 테.
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
import { trace, shapePath, two as twoTone, scaleOf } from './vec.js';

export { scaleOf };

export const INK = '#12153a';
export const P3 = { w: 22 };                // 판 위 기물 폭(논리 px). 높이는 × 140 / 120
const S = P3.w / 120;                        // 원본(120 × 140 상자) → 논리
const PAD = 6;                               // 테가 상자 밖으로 나가는 몫(원본 단위)
const BOX = { x: -PAD, y: -PAD, w: 120 + PAD * 2, h: 140 + PAD * 2 };
export const BASE = { x: 60, y: 124 };       // 받침 가운데(칸 가운데에 선다)
// 선 굵기(논리 px) → 원본 단위
const LW = { body: 1.0 / S, base: 0.8 / S, ring: 0.6 / S, gem: 0.8 / S };
// 체스 여섯(받침 · 그림자 규칙이 처음 정해진 기물)
export const STANDARD = new Set(['P', 'N', 'B', 'R', 'Q', 'K']);

const GOLD = { fill: '#f6be45', shade: '#d48b1c' };
const BASE_W = { top: '#efe6d2', side: '#b8a47a' }, BASE_B = { top: '#262c5f', side: '#141737' };
// 톤: 몸 빛 · 그늘 · 테 + 받침(내 편 크림 · 적 남색) + 고리
function toneOf(side, eng) {
  if (side === 'b') return { fill: '#343a86', shade: '#222661', line: '#0a0c22', base: BASE_B, ring: PAL.dark, crown: GOLD, hiA: 0.22 };
  if (side === 'g') return { fill: GOLD.fill, shade: GOLD.shade, line: '#3a1d08', base: BASE_B, ring: '#efbd55', crown: null, hiA: 0.5 };
  if (side === 'q') return { fill: GOLD.fill, shade: GOLD.shade, line: '#6b4410', base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.6 };
  if (side === 's') { const t = TONE.s; return { fill: t.f, shade: t.s, line: t.o, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.7 }; }
  const e = eng && ENG_TONE[eng];
  if (e) return { fill: e.f, shade: e.s, line: e.o, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.6, glass: eng === 'glass' };
  return { fill: '#f7eedb', shade: '#dcc9a2', line: INK, base: BASE_W, ring: '#efbd55', crown: null, hiA: 0.7 };
}

// 모양(체스 여섯은 pieces3.mjs 그대로): body · top · parts는 경로 글(M L C Z) 또는 타원 [cx, cy, rx, ry, 돌림].
// parts: 몸 위에 더 얹는 두 톤 조각({ d, crown: 적이면 금 · gold: 늘 금 }). cuts · eyes · slit · strokes는 테 빛깔 새김, gems는 구슬, gem은 기보 보석 자리
const SHAPE = {
  P: { body: 'M36 120 C40 100 50 90 51 76 L69 76 C70 90 80 100 84 120 Z', top: [[60, 76, 20, 7], [60, 54, 20, 20]], gem: [60, 34] },
  R: { body: 'M36 120 L41 74 L79 74 L84 120 Z', top: 'M30 76 L30 30 L44 30 L44 42 L54 42 L54 30 L66 30 L66 42 L76 42 L76 30 L90 30 L90 76 Z', cuts: ['M55 86 L65 86 L65 106 L55 106 Z'], gem: [60, 30] },
  N: { body: 'M36 120 C38 106 44 98 48 92 L76 92 C78 100 82 108 84 120 Z', top: 'M48 94 L40 82 L36 62 L50 40 L54 20 L62 32 L78 42 L90 64 L88 74 L74 72 L64 64 L68 80 L76 94 Z', eyes: [[62, 48, 4.5]], gem: [54, 22] },
  B: { body: 'M38 120 C42 102 50 94 52 86 L68 86 C70 94 78 102 82 120 Z', top: ['M60 20 C82 38 86 62 74 86 L46 86 C34 62 38 38 60 20 Z', [60, 18, 7, 7]], slit: [50, 44, 70, 64], gem: [60, 11] },
  Q: { body: 'M36 120 C40 100 48 90 50 80 L70 80 C72 90 80 100 84 120 Z', top: 'M40 80 L32 40 L47 56 L53 32 L60 54 L67 32 L73 56 L88 40 L80 80 Z', gems: [[32, 38], [53, 30], [67, 30], [88, 38]], crown: true, gem: [60, 54] },
  K: { body: 'M36 120 C40 100 48 90 50 80 L70 80 C72 90 80 100 84 120 Z', top: 'M40 80 L36 46 L49 56 L60 38 L71 56 L84 46 L80 80 Z', cross: true, crown: true, gem: [60, 62] },
  // 특수 기물
  // 아마존: 나이트 말머리에 퀸의 뾰족 관(적이면 금)
  Z: { body: 'M36 120 C38 106 44 98 48 92 L76 92 C78 100 82 108 84 120 Z', top: 'M48 94 L40 82 L36 62 L50 40 L54 20 L62 32 L78 42 L90 64 L88 74 L74 72 L64 64 L68 80 L76 94 Z', parts: [{ d: 'M45 38 L42 14 L52 24 L58 8 L64 24 L74 14 L71 38 Z', crown: true }], gems: [[42, 12], [58, 6], [74, 12]], eyes: [[63, 50, 4.5]], gem: [58, 30] },
  // 낙타: 혹 둘 · 긴 목(오른쪽을 본다 — 나이트와 같은 도약 가족)
  L: { body: 'M36 120 C38 108 44 100 48 96 L76 96 C78 102 82 110 84 120 Z', top: 'M26 98 C24 74 32 58 42 56 C50 54 54 64 58 66 C62 52 72 46 80 58 L86 56 L88 34 L96 26 L106 30 L106 38 L96 40 L96 60 C95 74 92 86 90 98 Z', eyes: [[99, 32, 3.5]], strokes: [['M28 74 C20 78 19 88 22 96', 3.5]], gem: [44, 50] },
  // 포: 비스듬한 포신 · 바퀴
  O: { body: 'M34 120 C36 110 42 106 50 104 L74 104 C80 108 84 114 86 120 Z', top: 'M26 90 L82 34 L94 46 L38 102 Z', parts: [{ d: 'M76 32 L86 22 L104 40 L94 50 Z' }, { d: [46, 98, 18, 18] }], eyes: [[46, 98, 5]], strokes: [['M46 82 L46 114 M30 98 L62 98', 3]], gem: [92, 30] },
  // 궁수: 두건 쓴 몸 · 오른쪽에 크게 휜 활과 시위
  S: { body: 'M34 120 C38 100 44 90 48 80 L68 80 C70 90 76 100 80 120 Z', top: 'M56 16 C72 28 78 46 76 62 C74 76 66 84 56 84 C46 84 38 76 36 62 C34 46 42 30 56 16 Z', parts: [{ d: 'M80 20 C102 38 102 94 80 112 L85 117 C111 96 111 36 85 15 Z' }], eyes: [[56, 60, 9]], strokes: [['M83 18 L83 114', 2], ['M58 62 L82 62', 2.5]], gem: [56, 26] },
  // 유령: 떠 있는 망토(아랫몸이 반쯤 비친다) · 눈 둘
  W: { body: 'M60 20 C82 20 90 40 90 58 L90 98 L82 106 L74 98 L67 106 L60 98 L53 106 L46 98 L38 106 L30 98 L30 58 C30 40 38 20 60 20 Z', fade: 74, eyes: [[50, 50, 5], [70, 50, 5]], strokes: [['M54 66 C58 70 62 70 66 66', 3]], gem: [60, 26] },
  // 꺾쇠: 룩 몸 위에 직각으로 꺾인 쇠 갈고리
  T: { body: 'M38 120 L43 78 L77 78 L82 120 Z', top: 'M58 80 L58 34 L40 34 L40 50 L32 60 L24 50 L24 18 L76 18 L76 80 Z', strokes: [['M41 98 L79 98', 4]], eyes: [[67, 26, 3]], gem: [67, 12] },
  // 물수제비: 비숍 몸 · 물결 새긴 둥근 머리 · 머리 위로 튀어 오른 납작한 돌
  E: { body: 'M38 120 C42 102 50 94 52 86 L68 86 C70 94 78 102 82 120 Z', top: [[60, 86, 17, 6], [60, 64, 19, 19]], parts: [{ d: [76, 22, 20, 7, -0.3] }], strokes: [['M43 64 C49 57 54 71 60 64 C66 57 71 71 77 64', 4.5]], gem: [60, 45] },
  // 까마귀: 왼쪽을 본 새(나이트 · 낙타와 반대쪽) · 위로 든 날개 · 꽁지
  V: { body: 'M40 120 C44 108 50 102 52 96 L70 96 C72 102 76 108 80 120 Z', top: 'M16 50 L36 42 C40 30 54 26 62 36 L76 14 L94 8 L88 28 L104 24 L94 46 L98 64 L104 80 L88 82 C82 98 58 102 48 92 C38 84 36 68 42 60 L36 56 Z', eyes: [[47, 42, 4.5]], gem: [50, 30] },
  // 광대: 밖으로 늘어진 두 갈래 고깔(끝에 방울) · 가면 · 주름 깃
  M: { body: 'M36 120 C40 102 48 94 50 88 L70 88 C72 94 80 102 84 120 Z', top: [[60, 64, 15, 15]], parts: [{ d: 'M44 56 C40 38 28 30 20 50 C18 30 36 18 52 38 C56 32 64 32 68 38 C84 18 102 30 100 50 C92 30 80 38 76 56 Z' }, { d: 'M34 88 L42 78 L48 86 L54 78 L60 86 L66 78 L72 86 L78 78 L86 88 L78 96 L42 96 Z' }], gems: [[20, 54], [100, 54]], eyes: [[54, 63, 3.5], [66, 63, 3.5]], gem: [60, 33] },
  // 화약병: 아래가 무거운 둥근 병 · 마개 · 심지 · 금빛 불꽃
  D: { body: 'M60 54 C86 54 94 76 92 96 C90 112 80 120 60 120 C40 120 30 112 28 96 C26 76 34 54 60 54 Z', top: 'M50 56 L52 42 L46 42 L46 32 L74 32 L74 42 L68 42 L70 56 Z', parts: [{ d: 'M70 2 C79 10 79 17 70 21 C61 17 63 10 70 2 Z', gold: true }], strokes: [['M60 32 C60 22 70 26 70 18', 3], ['M32 86 C50 94 70 94 88 86', 4]], gem: [60, 37] },
};
export const SHAPES = new Set(Object.keys(SHAPE));
const CROSS = 'M56 6 L64 6 L64 16 L72 16 L72 24 L64 24 L64 38 L56 38 L56 24 L48 24 L48 16 L56 16 Z';

// 몸 하나: 빛 → 오른쪽 그늘(x 62부터 자른다) → 테
const two = (x, sh, fc, line, lw) => twoTone(x, sh, fc.fill, fc.shade, 62, line, lw);
const disc = (x, cx, cy, r, fill, line, lw) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = lw; x.stroke(); } };

// k: 원본 한 단위의 기기 화소. 선은 기기 화소 1 밑으로 가늘어지지 않는다(작은 손 카드 · 도감 칸에서도 테가 남는다).
// 작은 그림(받침 폭 < 기기 화소 16)은 고리 · 빛 줄을 빼고 새김을 굵게 — 몇 화소 안에서 뭉개지지 않게
function paint(x, t, C, tier, k, bare = false, lwBody = 0) {
  const S0 = SHAPE[t] || SHAPE.P;
  const small = 88 * k < 16;
  const lw = (v, min = 1) => Math.max(v, min / k);
  const LB = lwBody ? Math.max(lwBody, 1 / k) : lw(LW.body), LBASE = lw(LW.base, 0.75), LRING = lw(LW.ring, 0.75), LGEM = lw(LW.gem, 0.75);
  // 받침: 아래 타원(옆면) → 옆 띠 → 윗면 → 고리. 기보 단계는 옆면 빛깔
  const side = tier ? TIER[tier].d : C.base.side;
  const ell = (cy, rx, ry) => { x.beginPath(); x.ellipse(60, cy, rx, ry, 0, 0, Math.PI * 2); };
  if (!bare) {
  ell(128, 44, 12); x.fillStyle = side; x.fill(); x.strokeStyle = C.line; x.lineWidth = LBASE; x.stroke();
  x.fillStyle = side; x.fillRect(16, 120, 88, 8);
  ell(120, 44, 12); x.fillStyle = C.base.top; x.fill(); x.strokeStyle = C.line; x.lineWidth = LBASE; x.stroke();
  if (!small) { ell(120, 34, 8); x.strokeStyle = C.ring; x.lineWidth = LRING; x.stroke(); }
  }
  const crownC = (C.crown) || C;
  const body = () => { two(x, S0.body, C, C.line, LB); if (S0.top) two(x, S0.top, S0.crown ? crownC : C, C.line, LB); };
  if (C.glass) x.globalAlpha = 0.88;
  if (S0.fade) {
    // 아랫몸이 반쯤 비친다(유령)
    x.save(); x.beginPath(); x.rect(-10, -10, 140, S0.fade + 10); x.clip(); body(); x.restore();
    x.save(); x.beginPath(); x.rect(-10, S0.fade, 140, 160); x.clip(); x.globalAlpha *= 0.5; body(); x.restore();
  } else body();
  for (const p of S0.parts || []) two(x, p.d, p.gold ? GOLD : p.crown ? crownC : C, C.line, LB);
  x.globalAlpha = 1;
  const ink = C.line, grow = small ? 1.35 : 1;
  for (const d of S0.cuts || []) { x.beginPath(); trace(x, d); x.fillStyle = ink; x.fill(); }
  for (const [ex, ey, r] of S0.eyes || []) disc(x, ex, ey, r * grow, ink);
  if (S0.slit) { x.beginPath(); x.moveTo(S0.slit[0], S0.slit[1]); x.lineTo(S0.slit[2], S0.slit[3]); x.strokeStyle = ink; x.lineWidth = 6.5 * grow; x.lineCap = 'round'; x.stroke(); x.lineCap = 'butt'; }
  for (const [d, w] of S0.strokes || []) { x.beginPath(); trace(x, d); x.strokeStyle = ink; x.lineWidth = Math.max(w * grow, 1 / k); x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(); x.lineCap = 'butt'; }
  if (S0.gems) for (const [gx, gy] of S0.gems) disc(x, gx, gy, 6, C.crown ? C.crown.fill : C.fill, ink, LGEM);
  if (S0.cross) { x.beginPath(); trace(x, CROSS); x.fillStyle = GOLD.fill; x.fill(); x.strokeStyle = ink; x.lineWidth = LGEM; x.lineJoin = 'round'; x.stroke(); }
  // 왼쪽 빛 한 줄
  if (!small) {
    x.save(); x.beginPath(); x.rect(-10, -10, 62, 160); x.clip(); x.translate(4, 0);
    shapePath(x, S0.body); x.strokeStyle = `rgba(255,255,255,${C.hiA})`; x.lineWidth = 3; x.stroke(); x.restore();
  }
  // 기보 2단계부터 머리 보석(은 · 금)
  if (tier >= 2 && S0.gem) disc(x, S0.gem[0], S0.gem[1], 5.5, tier === 3 ? '#efbd55' : '#dfe6ec', ink, LGEM);
}

// 받침 없는 실루엣(격언 그림 · 아이콘 · 행마 그림): 굽는 캔버스 g에 바로, 몸 바닥 가운데 (cx, by) · 높이 h(g 단위).
// n: g 한 단위의 기기 화소, lw: 테 굵기(g 단위, 0이면 판 위 기물과 같은 비율)
export function pieceGlyph(g, t, side, cx, by, h, n = 1, lw = 0) {
  if (!SHAPE[t]) t = artOf(t);
  const s = h / 112;
  g.save(); g.translate(cx, by); g.scale(s, s); g.translate(-60, -120);
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
const FIT = { w: 92, h: 139, below: 141 - BASE.y };
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
// (빛 → 몸, x 62 오른쪽 → 그늘, 새김 · 눈 → 테, 관 · 금 조각 → 금, 받침 → 받침 빛깔). 사물은 제 빛깔 덩이
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
    gems: (S0.gems || []).map(([x, y]) => polys([x, y, 6, 6])), cross: S0.cross ? polys(CROSS) : null,
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
  const tone = (fc, x) => (x >= 62 ? fc.shade : fc.fill);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 16; x++) {
    const X = BASE.x + (x + 0.5 - cx) / s, Y = BASE.y + (y + 0.5 - cy) / s;
    let col = null;
    if (G.cross && inside(G.cross, X, Y)) col = GOLD.fill;
    else if (G.ink.some((ps) => inside(ps, X, Y))) col = C.line;
    else if (G.gems.some((ps) => inside(ps, X, Y))) col = C.crown ? C.crown.fill : C.fill;
    else {
      const part = G.parts.find((q) => inside(q.ps, X, Y));
      if (part) col = tone(part.gold ? GOLD : part.crown ? crownC : C, X);
      else if (G.top && inside(G.top, X, Y)) col = tone(G.crownTop ? crownC : C, X);
      else if (inside(G.body, X, Y)) col = tone(C, X);
      else if (Math.abs(X - 60) <= 44 && Y >= 108 && Y <= 140) {
        const top = ((X - 60) / 44) ** 2 + ((Y - 120) / 12) ** 2 <= 1, low = ((X - 60) / 44) ** 2 + ((Y - 128) / 12) ** 2 <= 1;
        if (top) col = C.base.top; else if (low || (Y >= 120 && Y <= 128)) col = C.base.side;
      }
    }
    if (col) out.push({ x, y, col });
  }
  return out;
}
