// 그리기 도구. 좌표는 모두 480×270 안의 정수 칸.
import { PAL, lightFill } from './palette.js';
import { shade } from './light.js';
import { textImage, textWidth, inkBox } from './text.js';
import { soulOrb, SW, SH } from './sprites.js';
import { fitPiece, artOf } from './pieces3.js';
import { L } from '../ui/lang.js';
import { LOG, logText, logFrame } from './layoutlog.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { snap, live } from './look.js';

// 소수점 자리(빛과 움직임): fine(fn) 안에서 그린 rect · text · sprite는 정수 칸 대신 1/N 칸에 선다(N = 화면 배율).
// 움직이는 것(미끄러지는 기물 · 날아가는 카드 · 흐르는 점수)만 감싼다 — 멈춘 화면은 늘 정수 칸이라 도트가 어긋나지 않는다.
let FINE = 0;
export function fine(fn) { FINE++; try { return fn(); } finally { FINE--; } }
const R = (v) => (FINE ? snap(v) : Math.round(v));
// 자리 하나를 지금 모드(정수 칸 · fine 안이면 1/N 칸)에 맞춘다 — gfx 밖에서 drawImage를 바로 부르는 그림용
export const place = R;

// 혼이 깃든 기물: 몸 뒤 왼쪽 위에 혼 빛깔 기운 한 점(천천히 떠오르며 깜빡인다)
// hi(두 배 도트): 같은 3×3 자리에 반 도트로 구운 둥근 빛(sprites.js soulOrb)
export function soulSpark(ctx, x, y, col, t = null, hi = false) {
  const k = t == null ? 0 : t;
  if (t != null) live();
  const bob = Math.round(Math.sin(k * 2.5));
  const a = t == null ? 1 : 0.65 + 0.35 * Math.sin(k * 3.1);
  ctx.globalAlpha *= a;
  if (hi) ctx.drawImage(soulOrb(col), x, y + 5 + bob, 3, 3);
  else {
    ctx.fillStyle = col;
    ctx.fillRect(x + 1, y + 6 + bob, 2, 2); ctx.fillRect(x + 2, y + 5 + bob, 1, 1); ctx.fillRect(x, y + 7 + bob, 1, 1);
  }
  ctx.globalAlpha /= a;
}

export const W = 480, H = 270;

export function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(R(x), R(y), Math.round(w), Math.round(h));
}

// 틀 문법(layout.md 27절): 판넬 · 카드 · 큰 상자(가로 · 세로 BIG 이상)는 테 2 + 아래 · 오른쪽 단색 그림자 3, 작은 칸은 테 1.
// 테 빛깔을 따로 주지 않으면(PAL.frameDk) 어두운 바탕은 크림 테, 밝은 바탕(카드 · 금빛)은 짙은 남색 테
export const BIG = 24;
export const edgeOf = (fill, edge = PAL.frameDk) => ((edge === PAL.frameDk || edge === PAL.frameHi) && !lightFill(fill) ? PAL.edge : edge === PAL.frameHi ? PAL.frameDk : edge);
export const edgeW = (w, h) => (Math.min(w, h) >= BIG ? 2 : 1);
export function box(ctx, x, y, w, h, fill, edge = PAL.frameDk) {
  if (LOG.on) logFrame(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  const t = edgeW(w, h);
  if (t === 2) shade(ctx, x, y, w, h);
  rect(ctx, x, y, w, h, edgeOf(fill, edge));
  rect(ctx, x + t, y + t, w - 2 * t, h - 2 * t, fill);
}

// 뜨는 설명(말풍선 · 낱말 상자 · 처음 안내)의 받침: 네모 바깥 1px 어두운 테 + 아래 · 오른쪽 1px 그늘.
// 뒤 판넬 테 · 글과 설명 상자 사이를 끊는다. 묶음은 한 번에 깔아 상자 사이 틈도 이음선이 된다(테 검사에 안 걸리게 rect만)
export function lift(ctx, x, y, w, h) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, PAL.shadow);
  rect(ctx, x, y + h + 1, w + 2, 1, PAL.shadow);
  rect(ctx, x + w + 1, y, 1, h + 1, PAL.shadow);
}

// 테두리만
export function frame(ctx, x, y, w, h, col, t = 1) {
  rect(ctx, x, y, w, t, col); rect(ctx, x, y + h - t, w, t, col);
  rect(ctx, x, y, t, h, col); rect(ctx, x + w - t, y, t, h, col);
}

// 빈 자리(격언 빈칸 · 두루마리 빈칸 · 다음 수 빈칸): 움푹 들어간 칸 — 반쯤 비치는 어두운 바탕, 위 · 왼쪽 안쪽 그늘 2, 아래 · 오른쪽 밝은 줄 1(틀 문법 — layout.md 27절)
export function slot(ctx, x, y, w, h) {
  if (LOG.on) logFrame(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * 0.5;
  rect(ctx, x, y, w, h, PAL.deep);
  rect(ctx, x, y, w, 2, PAL.black);
  rect(ctx, x, y + 2, 2, h - 2, PAL.black);
  ctx.globalAlpha = pa;
  rect(ctx, x, y + h - 1, w, 1, PAL.fogHi);
  rect(ctx, x + w - 1, y, 1, h - 1, PAL.fogHi);
}

// 점선 테두리(증원 그림자 · 빈 칸)
export function dots(ctx, x, y, w, h, col, step = 2, phase = 0) {
  ctx.fillStyle = col;
  for (let i = phase % step; i < w; i += step) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i, y + h - 1, 1, 1); }
  for (let i = phase % step; i < h; i += step) { ctx.fillRect(x, y + i, 1, 1); ctx.fillRect(x + w - 1, y + i, 1, 1); }
}

export function line(ctx, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = col;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// 글자. align: left | center | right. scale: 정수배 확대(큰 글자).
export function text(ctx, s, x, y, col = PAL.ink, { align = 'left', bold = false, scale = 1, shadow = null, alpha = 1 } = {}) {
  s = L(String(s));
  const img = textImage(s, col, bold);
  const w = img.w * scale;
  let dx = x;
  if (align === 'center') dx = x - Math.floor(w / 2);
  else if (align === 'right') dx = x - w;
  dx = R(dx); y = R(y);
  if (LOG.on && alpha > 0 && ctx.globalAlpha > 0) logText(s, Math.round(dx), Math.round(y), w, scale);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (shadow) {
    const sh = textImage(s, shadow, bold);
    ctx.drawImage(sh.c, dx + scale, y + scale, sh.c.width * scale, sh.h * scale);
  }
  ctx.drawImage(img.c, dx, y, img.c.width * scale, img.h * scale);
  if (alpha !== 1) ctx.globalAlpha = 1;
  return w;
}

export const measure = (s, bold = false) => textWidth(s, bold);

// 높이 h인 칸(위 y) 안에 글자의 잉크를 세로 가운데로 놓는다(그림 칸 안의 큰 글자 — 잉크 높이를 재어 위아래 여백을 같게)
export function textMid(ctx, s, x, y, h, col = PAL.ink, opts = {}) {
  const scale = opts.scale || 1;
  const ink = inkBox(textImage(L(String(s)), col, !!opts.bold));
  return text(ctx, s, x, y + Math.floor((h - ink.h * scale) / 2) - ink.top * scale, col, opts);
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

// 천 무늬 바탕(한 번 그려 캐시)
let feltCache = null;
export function felt(ctx, makeCanvas, context) {
  if (!feltCache) {
    feltCache = makeCanvas(W, H);
    const c = context(feltCache);
    rect(c, 0, 0, W, H, PAL.felt);
    c.fillStyle = PAL.feltHi;
    for (let y = 0; y < H; y += 3) for (let x = (y / 3) % 2 ? 1 : 0; x < W; x += 6) c.fillRect(x, y, 1, 1);
  }
  ctx.drawImage(feltCache, 0, 0);
}

// 1~3자리 숫자 모양(작은 칸 번호용, mockup DIG)
const DIG = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'],
  3: ['110', '001', '010', '001', '110'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'],
  6: ['011', '100', '110', '101', '010'], 7: ['111', '001', '010', '010', '010'], 8: ['010', '101', '010', '101', '010'],
  9: ['010', '101', '011', '001', '110'],
};
export function digits(ctx, n, x, y, col) {
  ctx.fillStyle = col;
  const s = String(n);
  for (let k = 0; k < s.length; k++) {
    const rows = DIG[s[k]];
    if (!rows) continue;
    rows.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '1') ctx.fillRect(x + k * 4 + i, y + j, 1, 1); });
  }
  return s.length * 4 - 1;
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
