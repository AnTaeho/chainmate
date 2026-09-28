// 그리기 도구. 좌표는 모두 480×270 안의 정수 칸.
import { PAL } from './palette.js';
import { textImage, textWidth } from './text.js';
import { spriteCanvas, tierSparkle, SW, SH } from './sprites.js';
import { L } from '../ui/lang.js';
import { LOG, logText, logFrame } from './layoutlog.js';
import { SOUL_BY_ID } from '../data/souls.js';

// 혼이 깃든 기물: 몸 뒤 왼쪽 위에 혼 빛깔 기운 한 점(천천히 떠오르며 깜빡인다)
export function soulSpark(ctx, x, y, col, t = null) {
  const k = t == null ? 0 : t;
  const bob = Math.round(Math.sin(k * 2.5));
  const a = t == null ? 1 : 0.65 + 0.35 * Math.sin(k * 3.1);
  ctx.globalAlpha *= a;
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y + 6 + bob, 2, 2); ctx.fillRect(x + 2, y + 5 + bob, 1, 1); ctx.fillRect(x, y + 7 + bob, 1, 1);
  ctx.globalAlpha /= a;
}

export const W = 480, H = 270;

export function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function box(ctx, x, y, w, h, fill, edge = PAL.frameDk) {
  if (LOG.on) logFrame(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  rect(ctx, x, y, w, h, edge);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

// 테두리만
export function frame(ctx, x, y, w, h, col, t = 1) {
  rect(ctx, x, y, w, t, col); rect(ctx, x, y + h - t, w, t, col);
  rect(ctx, x, y, t, h, col); rect(ctx, x + w - t, y, t, h, col);
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
  dx = Math.round(dx); y = Math.round(y);
  if (LOG.on && alpha > 0 && ctx.globalAlpha > 0) logText(s, dx, y, w, scale);
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

// 기물. sx: 가로 배율(뒤집힘 1 → 0 → 1), lift: 위로 띄우기, alpha
// eng: 각인 id(몸 톤) · tier: 기보 단계 0~3 · time: 금 단계 반짝임을 깜빡이게(없으면 멈춘 모습)
export function sprite(ctx, type, side, x, y, { alpha = 1, sx = 1, sy = 1, eng = null, tier = 0, time = null, soul = null } = {}) {
  const c = spriteCanvas(type, side, eng, tier);
  if (alpha <= 0) return;
  if (tier === 3 && sx === 1 && sy === 1) { if (alpha !== 1) ctx.globalAlpha = alpha; tierSparkle(ctx, Math.round(x), Math.round(y), time); if (alpha !== 1) ctx.globalAlpha = 1; }
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (soul && sx === 1 && sy === 1) soulSpark(ctx, Math.round(x), Math.round(y), SOUL_BY_ID[soul] ? SOUL_BY_ID[soul].col : '#ffffff', time);
  if (sx === 1 && sy === 1) ctx.drawImage(c, Math.round(x), Math.round(y));
  else {
    const w = Math.max(1, Math.round(SW * Math.abs(sx)));
    const h = Math.max(1, Math.round(SH * sy));
    ctx.drawImage(c, Math.round(x + (SW - w) / 2), Math.round(y + SH - h), w, h);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
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
export function num(n) {
  if (!isFinite(n)) return '∞';
  const v = Math.floor(n);
  if (Math.abs(v) >= 1e15) return v.toExponential(2).replace('+', '');
  return v.toLocaleString('en-US');
}
