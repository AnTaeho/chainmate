// 빛과 그림자(docs/design-notes/layout.md 「빛과 움직임」): 빛 번짐 · 판넬 그림자 · 기물 발밑 그림자 · 흐르는 배경.
// 모두 한 번 만든 작은 캔버스를 늘려 그린다(shadowBlur · 그라디언트를 쓰지 않는다 — 비싸고 연기 시험의 가짜 캔버스가 모른다).
// 빛은 글자 뒤 층에만 깐다: 글자 · 도트 그림은 늘 그 위에 네모 도트로 다시 그려져 번지지 않는다.
import { makeCanvas, context } from './surface.js';
import { rgb, PAL, lookOf } from './palette.js';
import { LOOK, snap, live } from './look.js';

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
export const flicker = (time, speed = 3, amt = 0.12) => { if (LOOK.calm) return 1; if (time) live(); return 1 - amt + amt * Math.sin(time * speed); };

// ── 판넬 · 카드 · 큰 상자 그림자(layout.md 27절): 아래 · 오른쪽으로 d 도트 비킨 단색 그늘(테 검사에 안 걸리게 rect만)
// 들리는 카드(sway.js)는 바닥 자리에 제 그림자를 깔고, 그 안에서 그리는 카드 바탕은 그림자를 건너뛴다(unshaded)
let OFF = 0;
export function unshaded(fn) { OFF++; try { return fn(); } finally { OFF--; } }
export const DROP = 3;
export function shade(ctx, x, y, w, h, d = DROP) {
  if (LOOK.shadow <= 0 || OFF || d <= 0) return;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillStyle = PAL.drop;
  ctx.fillRect(x + d, y + h, w, d);
  ctx.fillRect(x + w, y + d, d, h - d);
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

// ── 흐르는 배경: 판 밖 바탕 위에 아주 천천히 흐르는 큰 물감 얼룩(세력 모습의 두 빛깔 — 64×36을 늘려 그린다, 몇 프레임에 한 번 다시 칠한다)
// 얼룩 칸은 게임 좌표에 박혀 있다: 칸 (i, j)는 (-8 + i × FCW, -8 + j × FCH)에서 시작(화면 밖 여백 판 · src/render/backdrop.js가 같은 칸을 판 밖으로 이어 칠한다)
const FW = 64, FH = 36;
export const FLOW = { cols: FW, rows: FH, x0: -8, y0: -8, cw: (480 + 16) / FW, ch: (270 + 16) / FH };
// 흐름의 시각(움직임 줄이기면 0에서 멈춘다, 초당 12번만 바뀐다)
export const flowTime = (time) => (LOOK.calm ? 0 : Math.floor(time * 12) / 12);
// ImageData d(가로 cols 칸)에 칸 i0.., j0..의 얼룩을 칠한다
// tint: 모습 id(세력 id, 없으면 남색 기본 — palette.js lookOf). 큰 물감 얼룩 두 빛깔이 천천히 흐른다
export function paintFlow(d, cols, rows, i0, j0, t, tint, s) {
  const [ca, cb] = lookOf(tint).flow;
  const A = rgb(ca), B = rgb(cb);
  const q = t * 0.06;
  for (let jj = 0; jj < rows; jj++) for (let ii = 0; ii < cols; ii++) {
    const i = ii + i0, j = jj + j0;
    const u = i / FW * 2.6, v = j / FH * 1.5;
    // 소용돌이: 좌표를 두 번 비튼 물결 두 겹 — 센 쪽 빛깔이 얼룩이 된다
    const wx = u + 0.8 * Math.sin(v * 1.7 + q * 2.1);
    const wy = v + 0.8 * Math.sin(u * 1.3 - q * 1.7);
    const f1 = Math.sin(wx * 1.9 + q * 2.0 + Math.sin(wy * 2.1 - q * 1.3) * 1.2);
    const f2 = Math.sin(wy * 2.3 - q * 1.6 + Math.sin(wx * 1.4 + q * 1.1) * 1.5);
    const k = (jj * cols + ii) * 4;
    const c = f1 > f2 ? A : B;
    const edge = Math.max(0, Math.min(1, (Math.max(f1, f2) - 0.05) * 2.2));
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
    d[k + 3] = Math.round(255 * Math.min(1, edge * 0.5 * s));
  }
}
let flowCv = null, flowImg = null, flowKey = null;
export function flowLayer(ctx, time, tint, x, y, w, h) {
  const s = LOOK.flow;
  if (s <= 0) return;
  if (!flowCv) { flowCv = makeCanvas(FW, FH); flowImg = null; }
  const g = context(flowCv);
  const t = flowTime(time);
  const key = `${t}|${tint}|${s}`;
  if (key !== flowKey) {
    flowKey = key;
    if (!flowImg) flowImg = g.getImageData(0, 0, FW, FH);
    paintFlow(flowImg.data, FW, FH, 0, 0, t, tint, s);
    g.putImageData(flowImg, 0, 0);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(flowCv, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
}
