// 벡터 기물(안 3, docs/design-notes/art3.md 1 · 2절): 둥근 받침 위의 굵은 실루엣, 왼쪽 빛 · 오른쪽 그늘 두 톤 + 잉크 테.
// (모양, 톤, 고리 빛깔, 배율 N)마다 N배 캔버스에 한 번 굽고, 판에는 논리 크기로 붙인다 — 그리는 비용은 붙이기 한 번.
// Path2D를 쓰지 않는다(연기 시험의 가짜 캔버스에 없다): 모양은 M · L · C · Z와 타원만.
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';
import { LOOK } from './look.js';
import { TONE, ENG_TONE, TIER, spritePixels, tierSparkle } from './sprites.js';
import { soulSpark, place } from './gfx.js';
import { SOUL_BY_ID } from '../data/souls.js';

export const INK = '#12153a';
export const P3 = { w: 22 };                // 판 위 기물 폭(논리 px). 높이는 × 140 / 120
const S = P3.w / 120;                        // 원본(120 × 140 상자) → 논리
const PAD = 6;                               // 테가 상자 밖으로 나가는 몫(원본 단위)
const BOX = { x: -PAD, y: -PAD, w: 120 + PAD * 2, h: 140 + PAD * 2 };
export const BASE = { x: 60, y: 124 };       // 받침 가운데(칸 가운데에 선다)
// 선 굵기(논리 px) → 원본 단위
const LW = { body: 1.0 / S, base: 0.8 / S, ring: 0.6 / S, gem: 0.8 / S };
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

// 모양(pieces3.mjs 그대로): body · top은 경로 글(M L C Z), 타원은 [cx, cy, rx, ry]
const SHAPE = {
  P: { body: 'M36 120 C40 100 50 90 51 76 L69 76 C70 90 80 100 84 120 Z', top: [[60, 76, 20, 7], [60, 54, 20, 20]], gem: [60, 34] },
  R: { body: 'M36 120 L41 74 L79 74 L84 120 Z', top: 'M30 76 L30 30 L44 30 L44 42 L54 42 L54 30 L66 30 L66 42 L76 42 L76 30 L90 30 L90 76 Z', cut: 'M55 86 L65 86 L65 106 L55 106 Z', gem: [60, 30] },
  N: { body: 'M36 120 C38 106 44 98 48 92 L76 92 C78 100 82 108 84 120 Z', top: 'M48 94 L40 82 L36 62 L50 40 L54 20 L62 32 L78 42 L90 64 L88 74 L74 72 L64 64 L68 80 L76 94 Z', eye: [62, 48], gem: [54, 22] },
  B: { body: 'M38 120 C42 102 50 94 52 86 L68 86 C70 94 78 102 82 120 Z', top: ['M60 20 C82 38 86 62 74 86 L46 86 C34 62 38 38 60 20 Z', [60, 18, 7, 7]], slit: [50, 44, 70, 64], gem: [60, 11] },
  Q: { body: 'M36 120 C40 100 48 90 50 80 L70 80 C72 90 80 100 84 120 Z', top: 'M40 80 L32 40 L47 56 L53 32 L60 54 L67 32 L73 56 L88 40 L80 80 Z', gems: [[32, 38], [53, 30], [67, 30], [88, 38]], crown: true, gem: [60, 54] },
  K: { body: 'M36 120 C40 100 48 90 50 80 L70 80 C72 90 80 100 84 120 Z', top: 'M40 80 L36 46 L49 56 L60 38 L71 56 L84 46 L80 80 Z', cross: true, crown: true, gem: [60, 62] },
};
const CROSS = 'M56 6 L64 6 L64 16 L72 16 L72 24 L64 24 L64 38 L56 38 L56 24 L48 24 L48 16 L56 16 Z';

// 경로 글 → 캔버스 경로(이미 beginPath한 위에 더한다)
function trace(x, d) {
  const t = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g);
  let i = 0, cmd = null;
  const n = () => Number(t[i++]);
  while (i < t.length) {
    if (/[MLCZ]/.test(t[i])) cmd = t[i++];
    if (cmd === 'M') x.moveTo(n(), n());
    else if (cmd === 'L') x.lineTo(n(), n());
    else if (cmd === 'C') x.bezierCurveTo(n(), n(), n(), n(), n(), n());
    else if (cmd === 'Z') x.closePath();
  }
}
function shapePath(x, sh) {
  x.beginPath();
  for (const p of Array.isArray(sh) ? sh : [sh]) {
    if (typeof p === 'string') trace(x, p);
    else { x.moveTo(p[0] + p[2], p[1]); x.ellipse(p[0], p[1], p[2], p[3], 0, 0, Math.PI * 2); x.closePath(); }
  }
}
// 몸 하나: 빛 → 오른쪽 그늘(x 62부터 자른다) → 테
function two(x, sh, fc, line) {
  shapePath(x, sh); x.fillStyle = fc.fill; x.fill();
  x.save(); x.beginPath(); x.rect(62, -10, 70, 160); x.clip(); shapePath(x, sh); x.fillStyle = fc.shade; x.fill(); x.restore();
  shapePath(x, sh); x.strokeStyle = line; x.lineWidth = LW.body; x.lineJoin = 'round'; x.stroke();
}
const disc = (x, cx, cy, r, fill, line, lw) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = lw; x.stroke(); } };

function paint(x, t, C, tier) {
  const S0 = SHAPE[t] || SHAPE.P;
  // 받침: 아래 타원(옆면) → 옆 띠 → 윗면 → 고리. 기보 단계는 옆면 빛깔
  const side = tier ? TIER[tier].d : C.base.side;
  const ell = (cy, rx, ry) => { x.beginPath(); x.ellipse(60, cy, rx, ry, 0, 0, Math.PI * 2); };
  ell(128, 44, 12); x.fillStyle = side; x.fill(); x.strokeStyle = C.line; x.lineWidth = LW.base; x.stroke();
  x.fillStyle = side; x.fillRect(16, 120, 88, 8);
  ell(120, 44, 12); x.fillStyle = C.base.top; x.fill(); x.strokeStyle = C.line; x.lineWidth = LW.base; x.stroke();
  ell(120, 34, 8); x.strokeStyle = C.ring; x.lineWidth = LW.ring; x.stroke();
  if (C.glass) x.globalAlpha = 0.88;
  two(x, S0.body, C, C.line);
  two(x, S0.top, (S0.crown && C.crown) || C, C.line);
  x.globalAlpha = 1;
  if (S0.cut) { x.beginPath(); trace(x, S0.cut); x.fillStyle = C.line; x.fill(); }
  if (S0.eye) disc(x, S0.eye[0], S0.eye[1], 4.5, C.line);
  if (S0.slit) { x.beginPath(); x.moveTo(S0.slit[0], S0.slit[1]); x.lineTo(S0.slit[2], S0.slit[3]); x.strokeStyle = C.line; x.lineWidth = 6.5; x.lineCap = 'round'; x.stroke(); x.lineCap = 'butt'; }
  if (S0.gems) for (const [gx, gy] of S0.gems) disc(x, gx, gy, 6, C.crown ? C.crown.fill : C.fill, C.line, LW.gem);
  if (S0.cross) { x.beginPath(); trace(x, CROSS); x.fillStyle = GOLD.fill; x.fill(); x.strokeStyle = C.line; x.lineWidth = LW.gem; x.lineJoin = 'round'; x.stroke(); }
  // 왼쪽 빛 한 줄
  x.save(); x.beginPath(); x.rect(-10, -10, 62, 160); x.clip(); x.translate(4, 0);
  shapePath(x, S0.body); x.strokeStyle = `rgba(255,255,255,${C.hiA})`; x.lineWidth = 3; x.stroke(); x.restore();
  // 기보 2단계부터 머리 보석(은 · 금)
  if (tier >= 2 && S0.gem) disc(x, S0.gem[0], S0.gem[1], 5.5, tier === 3 ? '#efbd55' : '#dfe6ec', C.line, LW.gem);
}

// 한 번 굽기: 열쇠 = 모양 · 편 · 각인 · 기보 단계 · 고리 빛깔 · 배율
const CACHE = new Map();
export function pieceCanvas(t, side = 'w', { eng = null, tier = 0, n = LOOK.n } = {}) {
  if (!STANDARD.has(t)) t = 'P';
  const C = toneOf(side, eng);
  const key = `${t}${side}:${eng || ''}:${tier || 0}:${C.ring}:${n}`;
  let c = CACHE.get(key);
  if (c) return c;
  const k = S * n;
  const cv = makeCanvas(Math.ceil(BOX.w * k), Math.ceil(BOX.h * k));
  const x = context(cv);
  x.imageSmoothingEnabled = true;
  x.setTransform(k, 0, 0, k, -BOX.x * k, -BOX.y * k);
  paint(x, t, C, tier);
  c = { cv, n, w: cv.width / n, h: cv.height / n, ox: (BASE.x - BOX.x) * S, oy: (BASE.y - BOX.y) * S };
  if (CACHE.size > 600) CACHE.clear();
  CACHE.set(key, c);
  return c;
}
// 그리는 곳의 실제 배율(뒷면 N × 그리기 변환) — 정수로 굽는다
export function scaleOf(ctx) {
  const m = ctx && ctx.getTransform ? ctx.getTransform() : null;
  const a = m && typeof m.a === 'number' ? Math.hypot(m.a, m.b) : LOOK.n;
  return Math.max(1, Math.min(6, Math.round(a)));
}
// 기물 하나를 받침 가운데 (cx, cy)에. sx: 가로 배율(갈아입을 때 뒤집힘), alpha. 각인 · 기보 · 혼은 내 편만
export function piece3(ctx, t, side, cx, cy, { alpha = 1, sx = 1, eng = null, tier = 0, soul = null, awake = false, time = null } = {}) {
  if (alpha <= 0) return;
  const c = pieceCanvas(t, side, { eng, tier, n: scaleOf(ctx) });
  const x = place(cx - c.ox), y = place(cy - c.oy);
  const a0 = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = a0 * alpha;
  // 기물 상자(옛 16 × 22 자리와 같은 틀): 금 기운 · 혼 기운이 이 상자에 선다
  const bx = Math.round(cx - 8), by = Math.round(cy - PIECE_TOP + 2);
  if (tier === 3 && sx === 1) tierSparkle(ctx, bx, by, time);
  if (soul && sx === 1) {
    soulSpark(ctx, bx - 2, by, SOUL_BY_ID[soul] ? SOUL_BY_ID[soul].col : '#ffffff', time, true);
    if (awake) soulSpark(ctx, bx + 14, by - 2, PAL.gold, time == null ? null : time + 1.3, true);
  }
  if (sx === 1) ctx.drawImage(c.cv, x, y, c.w, c.h);
  else {
    const w = Math.max(0.5, c.w * Math.abs(sx));
    ctx.drawImage(c.cv, place(cx - c.ox * Math.abs(sx)), y, w, c.h);
  }
  ctx.globalAlpha = a0;
}
// 받침 가운데에서 기물 꼭대기까지(이름표 · 동전 · 금빛 빛이 기댄다)
export const PIECE_TOP = Math.round((BASE.y - 6) * S); // 22

// 부서질 조각의 빛깔 점: 16 × 22 마스크 자리에 벡터 톤 빛깔(빛 · 몸 → 몸, 그늘 → 그늘, 새김 · 테 → 테, 금 자리 → 금)
export function pieceChips(t, side, eng = null) {
  const C = toneOf(side, eng), px = spritePixels(STANDARD.has(t) ? t : 'P') || [];
  const col = (k) => (k[0] === 'c' ? GOLD.fill : k === 's' ? C.shade : k === 'd' ? C.line : C.fill);
  return px.filter(([, , k]) => k !== 'o' && k !== 'go').map(([x, y, k]) => ({ x, y, col: col(k) }));
}
