// 빛과 그림자(docs/design-notes/layout.md 「빛과 움직임」): 빛 번짐 · 판넬 그림자 · 기물 발밑 그림자 · 흐르는 배경.
// 모두 한 번 만든 작은 캔버스를 늘려 그린다(shadowBlur · 그라디언트를 쓰지 않는다 — 비싸고 연기 시험의 가짜 캔버스가 모른다).
// 빛은 글자 뒤 층에만 깐다: 글자 · 도트 그림은 늘 그 위에 네모 도트로 다시 그려져 번지지 않는다.
import { makeCanvas, context } from './surface.js';
import { rgb, PAL } from './palette.js';
import { LOOK, snap } from './look.js';

// ── 빛 번짐: 가운데가 밝고 가장자리로 스러지는 둥근 빛(32×32, 빛깔마다 한 번). 네모 뒤에 아홉 조각으로 늘려 깐다
//   (네모 안은 고르게 밝고, 네모 밖 spread 폭에서 스러진다 — 길쭉한 글 줄에도 둥글게 번진다)
const B = 32, HB = 16;
const blobs = new Map();
function blob(col) {
  let c = blobs.get(col);
  if (c) return c;
  c = makeCanvas(B, B);
  const g = context(c);
  const img = g.getImageData(0, 0, B, B);
  const d = img.data;
  const [r, gg, b] = rgb(col);
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    const dist = Math.hypot(x + 0.5 - HB, y + 0.5 - HB) / HB;
    const k = Math.max(0, 1 - dist);
    const i = (y * B + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = Math.round(255 * k * Math.sqrt(k));
  }
  g.putImageData(img, 0, 0);
  blobs.set(col, c);
  return c;
}

// 글 뒤 빛: 글 네모를 spread만큼 넓힌 타원에 둥근 빛 하나(가운데가 가장 밝고 바깥으로 스러진다 — 네모 티가 나지 않게)
export function glowText(ctx, x, y, w, h, col, a = 0.5, spread = 8) {
  a *= LOOK.glow;
  if (a <= 0.01 || w <= 0) return;
  const prev = ctx.globalCompositeOperation;
  const pa = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pa * Math.min(1, a);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blob(col), x - spread, y - spread, w + spread * 2, h + spread * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = typeof prev === 'string' ? prev : 'source-over';
}

// (x, y, w, h) 칸 뒤에 빛(칸은 그 위에 불투명하게 그린다). a: 세기(0~1), spread: 칸 밖으로 번지는 폭(도트)
export function glow(ctx, x, y, w, h, col, a = 0.5, spread = 6) {
  a *= LOOK.glow;
  if (a <= 0.01 || w <= 0 || h <= 0) return;
  const prev = ctx.globalCompositeOperation;
  const pa = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pa * Math.min(1, a);
  ctx.imageSmoothingEnabled = true;
  const c = blob(col), s = spread;
  const X = [x - s, x, x + w], Y = [y - s, y, y + h], Wd = [s, w, s], Ht = [s, h, s];
  const SX = [0, HB - 0.5, HB], SW = [HB, 1, HB];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) ctx.drawImage(c, SX[i], SX[j], SW[i], SW[j], X[i], Y[j], Wd[i], Ht[j]);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = typeof prev === 'string' ? prev : 'source-over';
}

// 빛 떨림: 움직임 줄이기면 멈춘 값
export const flicker = (time, speed = 3, amt = 0.12) => (LOOK.calm ? 1 : 1 - amt + amt * Math.sin(time * speed));

// ── 판넬 · 카드 · 격언 칸 그림자: 아래로 d 도트, 오른쪽으로 1 도트 비켜 어둡게(테 검사에 안 걸리게 rect만)
// 들리는 카드(sway.js)는 바닥 자리에 제 그림자를 깔고, 그 안에서 그리는 카드 바탕은 그림자를 건너뛴다(unshaded)
let OFF = 0;
export function unshaded(fn) { OFF++; try { return fn(); } finally { OFF--; } }
export function shade(ctx, x, y, w, h, d = 2) {
  const a = LOOK.shadow;
  if (a <= 0 || OFF) return;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * a;
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(Math.round(x) + 1, Math.round(y + h), Math.round(w), d);
  ctx.fillRect(Math.round(x + w), Math.round(y) + d, 1, Math.round(h) - d);
  ctx.globalAlpha = pa;
}

// ── 기물 발밑 그림자: 도트 타원(너비 w). 기물이 들리면(lift, 도트) 작아지고 옅어진다
const ovals = new Map();
function oval(w) {
  let c = ovals.get(w);
  if (c) return c;
  const h = Math.max(2, Math.round(w / 4));
  c = makeCanvas(w, h);
  const g = context(c);
  g.fillStyle = '#000000';
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5 - h / 2) / (h / 2);
    const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - v * v)));
    g.fillRect(Math.round(w / 2) - half, j, half * 2, 1);
  }
  ovals.set(w, c);
  return c;
}
// cx: 기물 가운데, by: 발 자리(그림자 가운데 줄)
export function groundShadow(ctx, cx, by, lift = 0) {
  const a0 = LOOK.shadow;
  if (a0 <= 0) return;
  const k = Math.max(0, Math.min(1, lift / 14));
  const w = Math.max(8, Math.round(16 - 7 * k) & ~1);
  const c = oval(w);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * a0 * 1.1 * (1 - 0.6 * k);
  ctx.drawImage(c, snap(cx - w / 2), snap(by - c.height / 2));
  ctx.globalAlpha = pa;
}

// ── 흐르는 배경: 판 밖 펠트 위에 아주 천천히 흐르는 물감 얼룩(64×36을 늘려 그린다, 몇 프레임에 한 번 다시 칠한다)
const FW = 64, FH = 36;
let flowCv = null, flowImg = null, flowKey = null;
export function flowLayer(ctx, time, tint, x, y, w, h) {
  const s = LOOK.flow;
  if (s <= 0) return;
  if (!flowCv) { flowCv = makeCanvas(FW, FH); flowImg = null; }
  const g = context(flowCv);
  // 초당 12번만 다시 칠한다(움직임 줄이기면 한 번 칠하고 멈춘다)
  const t = LOOK.calm ? 0 : Math.floor(time * 12) / 12;
  const key = `${t}|${tint}|${s}`;
  if (key !== flowKey) {
    flowKey = key;
    if (!flowImg) flowImg = g.getImageData(0, 0, FW, FH);
    const d = flowImg.data;
    const A = tint ? rgb(tint) : [111, 207, 185];
    const B = [226, 178, 77];
    const q = t * 0.09;
    for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
      const u = i / FW * 6, v = j / FH * 3.4;
      // 소용돌이: 좌표를 두 번 비튼 물결 두 겹
      const wx = u + 0.9 * Math.sin(v * 1.3 + q * 2.1);
      const wy = v + 0.9 * Math.sin(u * 1.1 - q * 1.7);
      const f1 = Math.sin(wx * 1.2 + q * 3.0 + Math.sin(wy * 1.7 - q * 1.3) * 1.4);
      const f2 = Math.sin(wy * 1.6 - q * 2.3 + Math.sin(wx * 0.9 + q * 1.1) * 1.8);
      const m = 0.5 + 0.5 * f1, n = Math.max(0, f2);
      const k = (j * FW + i) * 4;
      const c = m > 0.5 ? A : B;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
      d[k + 3] = Math.round(255 * Math.min(1, (Math.abs(m - 0.5) * 2) * (0.55 + 0.45 * n)) * 0.11 * s);
    }
    g.putImageData(flowImg, 0, 0);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(flowCv, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
}
