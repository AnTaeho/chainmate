// 빛과 그림자(docs/design-notes/layout.md 「빛과 움직임」): 빛 번짐 · 판넬 그림자 · 기물 발밑 그림자 · 흐르는 배경.
// 모두 한 번 만든 작은 캔버스를 늘려 그린다(shadowBlur · 그라디언트를 쓰지 않는다 — 비싸고 연기 시험의 가짜 캔버스가 모른다).
// 빛은 글자 뒤 층에만 깐다: 글자 · 도트 그림은 늘 그 위에 네모 도트로 다시 그려져 번지지 않는다.
import { makeCanvas, context } from './surface.js';
import { rgb, PAL, lookOf, bgOf } from './palette.js';
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
  const sm0 = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blob(col), x - spread, y - spread, w + spread * 2, h + spread * 2);
  ctx.imageSmoothingEnabled = sm0; // 기운 카드(sway tilt)처럼 켜 둔 곳이면 켠 채로
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
  const sm0 = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const c = blob(col), s = spread;
  const X = [x - s, x, x + w], Y = [y - s, y, y + h], Wd = [s, w, s], Ht = [s, h, s];
  const SX = [0, HB - 0.5, HB], SW = [HB, 1, HB];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) ctx.drawImage(c, SX[i], SX[j], SW[i], SW[j], X[i], Y[j], Wd[i], Ht[j]);
  ctx.imageSmoothingEnabled = sm0; // 기운 카드(sway tilt)처럼 켜 둔 곳이면 켠 채로
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = typeof prev === 'string' ? prev : 'source-over';
}

// 빛 떨림: 움직임 줄이기면 멈춘 값
export const flicker = (time, speed = 3, amt = 0.12) => { if (LOOK.calm) return 1; if (time) live(); return 1 - amt + amt * Math.sin(time * speed); };

// ── 그림자(안 3 틀 문법 — layout.md 27절): 상자 바로 아래로 d 비킨 잉크 빛 둥근 판(단단한 그림자) + 크림 카드만 흐린 그림자(soft).
// 흐린 그림자는 한 번 구운 9조각을 늘려 깐다 — shadowBlur는 그릴 때마다 흐림을 다시 셈해 비싸고 연기 시험의 가짜 캔버스가 모른다.
// 들리는 카드(sway.js)는 바닥 자리에 제 그림자를 깔고, 그 안에서 그리는 카드 바탕은 그림자를 건너뛴다(unshaded)
let OFF = 0;
export function unshaded(fn) { OFF++; try { return fn(); } finally { OFF--; } }
export const DROP = 2;
// 둥근 네모 경로(arcTo — Path2D · roundRect는 연기 시험의 가짜 캔버스에 없다)
export function rpath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// d: 아래로 비킨 거리, r: 상자 모서리, soft: 크림 카드의 흐린 그림자를 함께
export function shade(ctx, x, y, w, h, d = DROP, { r = 4, soft = false } = {}) {
  if (OFF || d <= 0) return;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (soft) softShadow(ctx, x, y + d + 1, w, h);
  ctx.fillStyle = PAL.drop;
  rpath(ctx, x, y + d, w, h, r);
  ctx.fill();
}
// 흐린 그림자: 가우스로 흐린 네모(시그마 3)를 가로 · 세로 곱으로 한 번 굽는다(화면 배율 N마다). 9조각으로 늘려 깐다
const SIG = 3, KS = 3 * SIG; // 흐림 반경(논리)
const softs = new Map();
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
function softCanvas(n) {
  let c = softs.get(n);
  if (c) return c;
  const S = 4 * KS * n; // 한 변: 흐림 2 + 네모 2(가운데에서 자른다)
  c = makeCanvas(S, S);
  const g = context(c);
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  const prof = new Float32Array(S);
  for (let i = 0; i < S; i++) { const x = (i + 0.5) / n; prof[i] = 0.5 * (erf((x - KS) / (SIG * Math.SQRT2)) - erf((x - 3 * KS) / (SIG * Math.SQRT2))); }
  const [r, gg, b] = rgb('#05061a');
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const k = (j * S + i) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = Math.round(255 * 0.34 * prof[i] * prof[j]); }
  g.putImageData(img, 0, 0);
  softs.set(n, c);
  return c;
}
export function softShadow(ctx, x, y, w, h) {
  if (LOOK.shadow <= 0 || OFF) return;
  const n = Math.max(1, LOOK.n), c = softCanvas(n), S = c.width, H2 = S / 2, k = KS * 2; // 원본의 반(논리 2 × KS)
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * Math.min(1, LOOK.shadow / 0.45);
  const sm0 = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const X = [x - KS, x + KS, x + w - KS], Y = [y - KS, y + KS, y + h - KS];
  const iw = Math.max(0, w - 2 * KS), ih = Math.max(0, h - 2 * KS);
  const Wd = [k, iw, k], Ht = [k, ih, k];
  const SX = [0, H2 - 0.5, H2], SW = [H2, 1, H2];
  // 상자가 흐림 폭(2 × KS)보다 작으면 가운데 조각 없이 모서리 넷을 반씩 겹쳐 깐다
  if (w < 2 * KS) { Wd[0] = Wd[2] = w / 2 + KS; X[2] = x + w / 2; SW[0] = SW[2] = (Wd[0] / k) * H2; SX[2] = S - SW[2]; Wd[1] = 0; }
  if (h < 2 * KS) { Ht[0] = Ht[2] = h / 2 + KS; Y[2] = y + h / 2; }
  const SY = [0, H2 - 0.5, h < 2 * KS ? S - (Ht[2] / k) * H2 : H2], SH = [h < 2 * KS ? (Ht[0] / k) * H2 : H2, 1, h < 2 * KS ? (Ht[2] / k) * H2 : H2];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (Wd[i] > 0 && Ht[j] > 0) ctx.drawImage(c, SX[i] * 1, SY[j], SW[i], SH[j], X[i], Y[j], Wd[i], Ht[j]);
  ctx.imageSmoothingEnabled = sm0; // 기운 카드(sway tilt)처럼 켜 둔 곳이면 켠 채로
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

// ── 바탕(안 3): 둥근 남색 빛(가운데가 밝다) + 크게 기운(−8도) 띠 하나 + 판 어두운 칸 빛깔의 가는 줄(시안 p3). 움직이지 않는다 —
// 모습(세력)마다 한 번 구워 늘려 깐다. 칸은 논리 1px이고 게임 좌표에 박혀 있다: 칸 (i, j)는 (-8 + i, -8 + j)(여백 판 backdrop.js가 같은 함수로 판 밖을 잇는다)
const FW = 496, FH = 286;
export const FLOW = { cols: FW, rows: FH, x0: -8, y0: -8, cw: 1, ch: 1 };
// 바탕은 흐르지 않는다(옛 흐르는 얼룩의 시각 — 그릴 때만 그린다의 5번은 모습 · 배율 바뀜에만 걸린다)
export const flowTime = () => 0;
const COS8 = Math.cos(8 * Math.PI / 180), SIN8 = Math.sin(8 * Math.PI / 180);
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const cover = (v, h) => Math.max(0, Math.min(1, v + 0.5)) * Math.max(0, Math.min(1, h - v + 0.5));
// ImageData d(가로 cols 칸)에 칸 i0.., j0..의 바탕을 칠한다(불투명). t · s는 옛 부름을 위해 받기만 한다
export function paintFlow(d, cols, rows, i0, j0, t, tint, s) {
  const [c0, c1, c2, cb] = bgOf(tint).map(rgb);
  const stripe = mixc(cb, rgb(lookOf(tint).dark), 0.5);
  for (let jj = 0; jj < rows; jj++) for (let ii = 0; ii < cols; ii++) {
    const x = FLOW.x0 + ii + i0 + 0.5, y = FLOW.y0 + jj + j0 + 0.5;
    const dx = (x - 216) / 336, dy = (y - 121.5) / 189, r = Math.hypot(dx, dy);
    let c = r < 0.6 ? mixc(c0, c1, r / 0.6) : mixc(c1, c2, Math.min(1, (r - 0.6) / 0.4));
    // 띠: (-50, 190)에서 시작한 높이 130 띠를 −8도 기울인다. 줄: (-50, 247.5)에서 높이 10
    const v = (x + 50) * SIN8 + (y - 190) * COS8;
    const kb = cover(v, 130);
    if (kb > 0) c = mixc(c, cb, kb);
    const ks = cover(v - 57.5, 10);
    if (ks > 0) c = mixc(c, stripe, ks);
    const k = (jj * cols + ii) * 4;
    d[k] = Math.round(c[0]); d[k + 1] = Math.round(c[1]); d[k + 2] = Math.round(c[2]); d[k + 3] = 255;
  }
}
let flowCv = null, flowImg = null, flowKey = null;
export function flowLayer(ctx, time, tint, x, y, w, h) {
  if (!flowCv) { flowCv = makeCanvas(FW, FH); flowImg = null; }
  const g = context(flowCv);
  const key = `${tint}`;
  if (key !== flowKey) {
    flowKey = key;
    if (!flowImg) flowImg = g.getImageData(0, 0, FW, FH);
    paintFlow(flowImg.data, FW, FH, 0, 0, 0, tint, 1);
    g.putImageData(flowImg, 0, 0);
  }
  const sm0 = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(flowCv, x, y, w, h);
  ctx.imageSmoothingEnabled = sm0; // 기운 카드(sway tilt)처럼 켜 둔 곳이면 켠 채로
}
