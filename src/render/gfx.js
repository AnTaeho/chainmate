// 그리기 도구. 좌표는 모두 480×270 안의 정수 칸.
import { PAL, lightFill } from './palette.js';
import { shade, softShadow, rpath, DROP, glow } from './light.js';
import { textImage, textWidth, inkBox, tinyText } from './text.js';
import { orbPaint, SW, SH } from './sprites.js';
import { blitVec } from './vec.js';
import { fitPiece, artOf } from './pieces3.js';
import { L } from '../ui/lang.js';
import { LOG, logText, logFrame } from './layoutlog.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { snap, live, LOOK, grid, span, frac } from './look.js';

// 소수점 자리(빛과 움직임): fine(fn) 안에서 그린 rect · text · sprite는 정수 칸 대신 1/N 칸에 선다(N = 화면 배율).
// 움직이는 것(미끄러지는 기물 · 날아가는 카드 · 흐르는 점수)만 감싼다 — 멈춘 화면은 늘 정수 칸이라 도트가 어긋나지 않는다.
let FINE = 0;
export function fine(fn) { FINE++; try { return fn(); } finally { FINE--; } }
// 꽉 채움(뒷면 배율이 소수)이면 멈춘 자리도 정수 칸에 둔 뒤 기기 화소에 맞춘다(look.js grid) — 정수 배율이면 Math.round 그대로
const R = (v) => (FINE ? snap(v) : grid(v));
// 도트 칸(점선 · 계단 선): 소수 배율이면 두 끝을 저마다 격자에 맞춘다 — 이웃 칸과 틈 없이 잇닿는다. 정수 배율이면 그대로
function cell(ctx, x, y, w, h) {
  if (!frac()) { ctx.fillRect(x, y, w, h); return; }
  const X = R(x), Y = R(y);
  ctx.fillRect(X, Y, R(x + w) - X, R(y + h) - Y);
}
// 자리 하나를 지금 모드(정수 칸 · fine 안이면 1/N 칸)에 맞춘다 — gfx 밖에서 drawImage를 바로 부르는 그림용
export const place = R;

// 혼이 깃든 기물: 몸 뒤 왼쪽 위에 혼 빛깔 기운 한 점(천천히 떠오르며 깜빡인다). 3 × 3 자리의 둥근 빛을 그리는 곳의 배율로 굽는다(sprites.js orbPaint).
// 옛 부름의 다섯째 인자(hi)는 쓰지 않는다
export function soulSpark(ctx, x, y, col, t = null) {
  const k = t == null ? 0 : t;
  if (t != null) live();
  const bob = Math.sin(k * 2.5);
  const a = t == null ? 1 : 0.65 + 0.35 * Math.sin(k * 3.1);
  fine(() => blitVec(ctx, `orb:${col}`, x, y + 5 + bob, 3, 3, orbPaint(col), a));
}

export const W = 480, H = 270;

export function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  const X = R(x), Y = R(y);
  ctx.fillRect(X, Y, span(X, w), span(Y, h));
}

// 틀 문법(안 3 — layout.md 27절): 둥근 상자 + 잉크 테 1 + 바로 아래 잉크 그림자(큰 상자 2). 크림 카드는 흐린 그림자를 더한다(light.js softShadow).
// 테 빛깔을 따로 주지 않으면(PAL.frameDk · PAL.frameHi) 잉크. 금빛 · 등급 · 세력 빛깔처럼 뜻이 있는 테는 그대로
// 모서리는 셋만(layout.md 29절): 작은 것(칩 · 빈 칸 · 작은 그림 칸) R_SM, 큰 것(판넬 · 카드 · 말풍선 · 막간 상자) R_LG, 알약(단추 · 탭 · 토글)은 ui.js pillR
export const BIG = 24;
export const R_SM = 4;
export const R_LG = 6;
export const R_BIG = R_LG;                    // 옛 이름
export const radiusOf = (w, h) => (Math.min(w, h) >= BIG ? R_LG : R_SM);
export const edgeOf = (fill, edge = PAL.frameDk) => (edge === PAL.frameDk || edge === PAL.frameHi ? PAL.frameDk : edge);
export const edgeW = () => 1;
// 둥근 네모 칠하기(정수 칸 · fine 안이면 1/N 칸)
export function rrect(ctx, x, y, w, h, r, col) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = col;
  const X = R(x), Y = R(y);
  if (!(r > 0)) { ctx.fillRect(X, Y, span(X, w), span(Y, h)); return; }
  rpath(ctx, X, Y, span(X, w), span(Y, h), r);
  ctx.fill();
}
// 둥근 테만(두께 t): 바깥 둥근 판에서 안쪽 둥근 판을 비운다(evenodd)
export function rframe(ctx, x, y, w, h, r, col, t = 1) {
  x = R(x); y = R(y); w = span(x, w); h = span(y, h);
  if (w <= 0 || h <= 0) return;
  // 소수 배율: 테 두께도 기기 화소 정수(round(t × N))로 — 테가 반 화소에 걸려 흐리거나 굵기가 들쭉날쭉하지 않게
  if (frac()) t = Math.max(1, Math.round(t * LOOK.n)) / LOOK.n;
  ctx.fillStyle = col;
  rpath(ctx, x, y, w, h, r);
  const ir = Math.max(0, r - t), iw = w - 2 * t, ih = h - 2 * t;
  if (iw > 0 && ih > 0) {
    ctx.moveTo(x + t + ir, y + t);
    ctx.arcTo(x + t, y + t, x + t, y + t + ih, ir);
    ctx.arcTo(x + t, y + t + ih, x + t + iw, y + t + ih, ir);
    ctx.arcTo(x + t + iw, y + t + ih, x + t + iw, y + t, ir);
    ctx.arcTo(x + t + iw, y + t, x + t, y + t, ir);
    ctx.closePath();
  }
  ctx.fill('evenodd');
}
// 상자: 큰 것(BIG 이상)은 아래 그림자 2, 밝은 바탕(크림 카드)은 흐린 그림자도. r: 모서리(기본은 크기로), drop: 그림자 거리
export function box(ctx, x, y, w, h, fill, edge = PAL.frameDk, { r = radiusOf(w, h), drop = null } = {}) {
  if (LOG.on) logFrame(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  const big = Math.min(w, h) >= BIG;
  const d = drop ?? (big ? DROP : 0);
  if (d > 0) shade(ctx, x, y, w, h, d, { r, soft: big && lightFill(fill) });
  rrect(ctx, x, y, w, h, r, edgeOf(fill, edge));
  inner(ctx, x, y, w, h, Math.max(0, r - 1), fill);
}
// 테 1 안쪽 판: 소수 배율이면 바깥 판의 기기 화소 네 변에서 round(N) 화소씩 들인다(테가 어느 상자 · 어느 변에서나 같은 굵기)
export function inner(ctx, x, y, w, h, r, col) {
  if (!frac()) { rrect(ctx, x + 1, y + 1, w - 2, h - 2, r, col); return; }
  const X = R(x), Y = R(y), W = span(X, w), H = span(Y, h), T = Math.max(1, Math.round(LOOK.n)) / LOOK.n;
  if (W - 2 * T <= 0 || H - 2 * T <= 0) return;
  ctx.fillStyle = col;
  if (r > 0) { rpath(ctx, X + T, Y + T, W - 2 * T, H - 2 * T, r); ctx.fill(); } else ctx.fillRect(X + T, Y + T, W - 2 * T, H - 2 * T);
}

// 뜨는 설명(말풍선 · 낱말 상자 · 처음 안내)의 받침: 흐린 그림자 + 바깥 잉크 테 1 + 아래 잉크 그림자 2(둥근 판).
// 뒤 판넬 테 · 글과 설명 상자 사이를 끊는다. 묶음은 한 번에 깔아 상자 사이 틈도 이음선이 된다(테 기록 logFrame 없이 칠만)
export function lift(ctx, x, y, w, h) {
  softShadow(ctx, x, y + 3, w, h);
  rrect(ctx, x - 1, y + 1, w + 2, h + 2, R_LG + 1, PAL.shadow);
  rrect(ctx, x - 1, y - 1, w + 2, h + 2, R_LG + 1, PAL.shadow);
}

// 테두리만(네모). 둥근 상자 위에 겹치는 테는 rframe
export function frame(ctx, x, y, w, h, col, t = 1) {
  rect(ctx, x, y, w, t, col); rect(ctx, x, y + h - t, w, t, col);
  rect(ctx, x, y, t, h, col); rect(ctx, x + w - t, y, t, h, col);
}

// 빈 자리(격언 · 두루마리 · 다음 수 · 콤보 · 도감 잠김 · 해금 카드 뒤): 한 꼴 — 움푹한 어두운 칸, 옅은 남색 테 1, 모서리 R_SM(29절).
// 옛 부름의 { r }는 받기만 한다
export const slotR = () => R_SM;
export function slot(ctx, x, y, w, h) {
  if (LOG.on) logFrame(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  rrect(ctx, x, y, w, h, R_SM, PAL.slotEdge);
  inner(ctx, x, y, w, h, R_SM - 1, PAL.slot);
}

// 고른 것(29절): 금빛 테 1 + 바깥 빛(2px 테 없음). selectGlow는 칸을 그리기 전에(빛이 칸 뒤), selectRing은 칸 위에 테까지
export const selectGlow = (ctx, x, y, w, h, col = PAL.gold, a = 0.45) => glow(ctx, x, y, w, h, col, a, 4);
export function selectRing(ctx, x, y, w, h, { r = radiusOf(w, h), col = PAL.gold, glowA = 0.45 } = {}) {
  if (glowA > 0) selectGlow(ctx, x, y, w, h, col, glowA);
  rframe(ctx, x, y, w, h, r, col, 1);
}

// 점선 테두리(증원 그림자 · 빈 칸)
export function dots(ctx, x, y, w, h, col, step = 2, phase = 0) {
  ctx.fillStyle = col;
  for (let i = phase % step; i < w; i += step) { cell(ctx, x + i, y, 1, 1); cell(ctx, x + i, y + h - 1, 1, 1); }
  for (let i = phase % step; i < h; i += step) { cell(ctx, x, y + i, 1, 1); cell(ctx, x + w - 1, y + i, 1, 1); }
}

// 둥근 빛 점(반짝이 · 불티 · 흩어지는 조각): 지름 d 상자(x, y)의 가운데
export function dot(ctx, x, y, d, col) {
  ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d * 0.55, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
}

// 벡터 선(둥근 끝, 두께 t — 판 위 지나온 길처럼 계단지지 않아야 하는 선)
export function seg(ctx, x0, y0, x1, y1, col, t = 1) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.strokeStyle = col; ctx.lineWidth = t; ctx.lineCap = 'round'; ctx.stroke();
}

export function line(ctx, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = col;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    cell(ctx, x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// 글자. align: left | center | right. scale: 확대(큰 글자 — 글꼴을 그 배율로 다시 그린다).
// 글자 그림은 그리는 곳의 화소 배율(화면 N × scale)로 굽는다(text.js textImage)
const resOf = (ctx) => { const t = ctx && ctx.getTransform ? ctx.getTransform() : null; return t && typeof t.a === 'number' ? Math.hypot(t.a, t.b) : LOOK.n; };
// w: 글 폭을 따로 줄 때(한 줄을 조각으로 나눠 그리는 richText — 앞 글 전체로 잰 조각 폭)
export function text(ctx, s, x, y, col = PAL.ink, { align = 'left', bold = false, scale = 1, shadow = null, alpha = 1, w: fixW = null, edge = null, edgeW = 1 } = {}) {
  s = L(String(s));
  const k = resOf(ctx) * scale;
  // 테(edge): 둥근 이음 선으로 그은 테와 글을 한 그림으로 굽는다(edgeW는 글자 크기 1배 기준 논리 px)
  const img = textImage(s, col, bold, k, edge, edgeW);
  const w = fixW ?? img.w * scale;
  let dx = x;
  if (align === 'center') dx = x - Math.floor(w / 2);
  else if (align === 'right') dx = x - w;
  dx = R(dx); y = R(y);
  if (LOG.on && alpha > 0 && ctx.globalAlpha > 0) logText(s, Math.round(dx), Math.round(y), w, scale);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (shadow) {
    const sh = textImage(s, shadow, bold, k);
    ctx.drawImage(sh.c, dx + sh.left * scale + scale, y + sh.top * scale + scale, sh.cw * scale, sh.h * scale);
  }
  ctx.drawImage(img.c, dx + img.left * scale, y + img.top * scale, img.cw * scale, img.h * scale);
  if (alpha !== 1) ctx.globalAlpha = 1;
  return w;
}

export const measure = (s, bold = false) => textWidth(s, bold);

// 높이 h인 칸(위 y) 안에 글자의 잉크를 세로 가운데로 놓는다(그림 칸 안의 큰 글자 — 잉크 높이를 재어 위아래 여백을 같게)
export function textMid(ctx, s, x, y, h, col = PAL.ink, opts = {}) {
  const scale = opts.scale || 1;
  const ink = inkBox(textImage(L(String(s)), col, !!opts.bold, resOf(ctx) * scale));
  return text(ctx, s, x, y + Math.floor((h - ink.h * scale) / 2 - ink.top * scale), col, opts);
}

// 기물(판 밖). 옛 16 × 22 상자 (x, y)에 벡터 기물(pieces3.js fitPiece)을 맞춘다 — 받침 아래가 상자 아래, 가로 가운데.
// sx · sy: 상자 배율(작은 칸은 0.5). sx만 바뀌면 뒤집힘(1 → 0 → 1). eng: 각인 id · tier: 기보 단계 0~3 · time: 금 단계 반짝임을 깜빡이게
// 그림이 없는 id(뺀 기물)는 바탕 기물(기보 모습)의 그림을 빌린다(artOf). hi는 옛 부름을 위해 받기만 한다
export { artOf };
export function sprite(ctx, type, side, x, y, { alpha = 1, sx = 1, sy = 1, eng = null, tier = 0, time = null, soul = null, awake = false } = {}) {
  if (alpha <= 0) return;
  const k = Math.abs(sy), bw = SW * k, bh = SH * k, still = sx === sy;
  fitPiece(ctx, type, side, R(x + (SW - bw) / 2), R(y + SH - bh), bw, bh, { alpha, hx: still ? 1 : Math.abs(sx) / (k || 1), eng, tier, time, soul, awake, spark: still && k === 1 });
}

// 작은 숫자(기보 수 표 · 조각 수 · 막대 눈금): 주석 글자 높이 DIGIT_H(annot.js GLYPH_H와 같은 7, 29절의 유일한 작은 글자) 굵은 숫자.
// 가운데 줄은 y + 2.5(옛 5줄 숫자 자리와 같다), 글자마다 폭 5. 돌려주는 값은 자리 폭
export const DIGIT_H = 7;
export function digits(ctx, n, x, y, col) {
  const s = String(n), w = s.length * 5 - 1;
  tinyText(ctx, s, x + w / 2, y + 2.5, DIGIT_H, col);
  return w;
}

// 1,234 꼴
// 숫자 글은 프레임마다 같은 값을 다시 만든다 — 값마다 한 번만(가득 차면 비운다)
const NUMS = new Map(), SHORTS = new Map();
const memo = (map, fn) => (n) => {
  if (typeof n !== 'number' || Object.is(n, -0)) return fn(n);
  let s = map.get(n);
  if (s === undefined) { s = fn(n); if (map.size > 2000) map.clear(); map.set(n, s); }
  return s;
};
export const num = memo(NUMS, numRaw);
function numRaw(n) {
  if (!isFinite(n)) return '∞';
  const v = Math.floor(n);
  if (Math.abs(v) >= 1e15) return v.toExponential(2).replace('+', '');
  return v.toLocaleString('en-US');
}
// 좁은 칸에 들어가는 짧은 숫자(1.7T 꼴)
export const short = memo(SHORTS, shortRaw);
function shortRaw(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 10 && n % 1) return n.toFixed(1);
  if (a < 100 && n % 1) return n.toFixed(1);
  if (a < 10000) return Math.floor(n).toLocaleString('en-US');
  const units = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K']];
  for (const [u, s] of units) if (a >= u) { const v = n / u; return (v < 100 ? v.toFixed(1) : Math.floor(v)) + s; }
  return String(Math.floor(n));
}
// 수치 하나를 폭 room 안에: 1,234 꼴이 들어가면 그대로, 넘치면 짧은 꼴(끝없는 대국의 큰 수)
export function fitNum(n, room, bold = true) {
  const s = num(n);
  return measure(s, bold) <= room ? s : short(n);
}
