// 여백 판(docs/design-notes/layout.md 「화면 맞춤」): 게임 캔버스 뒤 창 전체를 덮는 도트 해상도 캔버스.
// 게임과 같은 도트 격자 위에 판 밖 배경을 창 끝까지 잇는다 — 펠트 결은 같은 좌표의 결, 흐르는 얼룩은 같은 칸의 얼룩이라
// 게임 캔버스 테두리가 드러나지 않는다. 타이틀처럼 제 그림을 까는 화면은 그 그림의 가장자리 줄을 늘려 잇고 차츰 어둡게 한다.
// 덮개(멈춤 · 설정)나 따라 하는 길이 화면을 어둡게 하면 여백 판도 같은 만큼 어두워진다.
import { makeCanvas, context } from './surface.js';
import { PAL, rgb } from './palette.js';
import { feltWeave, FELT_WEAVE } from './texture.js';
import { LOOK } from './look.js';
import { FLOW, flowTime, paintFlow } from './light.js';

const GW = 480, GH = 270;

// 펠트: 게임은 펠트 판 (W + 16)×(H + 16)을 (-8, -8)에 깐다 → 게임 도트 (x, y)의 결은 feltWeave(x + 8, y + 8)
let feltCv = null, feltKey = null;
function feltPad(pad) {
  const key = `${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}`;
  if (feltCv && feltKey === key) return feltCv;
  feltKey = key;
  feltCv = makeCanvas(pad.cols, pad.rows);
  const g = context(feltCv);
  const img = g.getImageData(0, 0, pad.cols, pad.rows);
  const d = img.data;
  const cols = [rgb(PAL.felt), ...FELT_WEAVE.slice(1).map(rgb)];
  for (let y = 0; y < pad.rows; y++) for (let x = 0; x < pad.cols; x++) {
    const c = cols[feltWeave(x - pad.ox + 8, y - pad.oy + 8)];
    const i = (y * pad.cols + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return feltCv;
}

// 흐르는 얼룩: 게임과 같은 칸(FLOW)을 여백 판이 덮는 만큼 넓혀 칠한다
let flowCv = null, flowImg = null, flowKey = null;
function flowPad(ctx, pad, t, tint) {
  const s = LOOK.flow;
  if (s <= 0) return;
  const { cw, ch, x0, y0 } = FLOW;
  const i0 = Math.floor((-pad.ox - x0) / cw) - 1, i1 = Math.ceil((pad.cols - pad.ox - x0) / cw) + 1;
  const j0 = Math.floor((-pad.oy - y0) / ch) - 1, j1 = Math.ceil((pad.rows - pad.oy - y0) / ch) + 1;
  const cols = i1 - i0, rows = j1 - j0;
  if (!flowCv || flowCv.width !== cols || flowCv.height !== rows) { flowCv = makeCanvas(cols, rows); flowImg = null; flowKey = null; }
  const key = `${t}|${tint}|${s}|${i0},${j0}`;
  if (key !== flowKey) {
    flowKey = key;
    const g = context(flowCv);
    if (!flowImg) flowImg = g.getImageData(0, 0, cols, rows);
    paintFlow(flowImg.data, cols, rows, i0, j0, t, tint, s);
    g.putImageData(flowImg, 0, 0);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(flowCv, pad.ox + x0 + i0 * cw, pad.oy + y0 + j0 * ch, cols * cw, rows * ch);
  ctx.imageSmoothingEnabled = false;
}

// 제 그림(타이틀): 가장자리 띠를 늘려 잇고, 멀어질수록 바탕 빛깔로 스러진다.
// 띠는 가장자리 여섯 줄에서 줄마다 가장 흔한 빛깔을 고른 한 줄(별 · 불티 한 점이 긴 금으로 늘어나지 않게)
const EDGE = 6, FADE = 64, FADE_MAX = 0.7;
const strips = new WeakMap();
function edgeStrips(img) {
  let e = strips.get(img);
  if (e) return e;
  const d = context(img).getImageData(0, 0, GW, GH).data;
  const at = (x, y) => { const i = (y * GW + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
  const mode = (list) => { const m = new Map(); let best = list[0], bn = 0; for (const v of list) { const n = (m.get(v) || 0) + 1; m.set(v, n); if (n > bn) { bn = n; best = v; } } return best; };
  const strip = (w, h, pick) => {
    const c = makeCanvas(w, h), g = context(c), im = g.getImageData(0, 0, w, h);
    for (let k = 0; k < w * h; k++) { const v = pick(k); im.data[k * 4] = v >> 16; im.data[k * 4 + 1] = (v >> 8) & 255; im.data[k * 4 + 2] = v & 255; im.data[k * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    return c;
  };
  const span = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  e = {
    left: strip(1, GH, (y) => mode(span(EDGE, (i) => at(i, y)))),
    right: strip(1, GH, (y) => mode(span(EDGE, (i) => at(GW - 1 - i, y)))),
    top: strip(GW, 1, (x) => mode(span(EDGE, (j) => at(x, j)))),
    bottom: strip(GW, 1, (x) => mode(span(EDGE, (j) => at(x, GH - 1 - j)))),
  };
  strips.set(img, e);
  return e;
}
function imagePad(ctx, pad, img) {
  const { ox, oy, cols, rows } = pad;
  const rw = cols - ox - GW, bh = rows - oy - GH;
  const e = edgeStrips(img);
  const put = (c, sx, sy, sw, sh, dx, dy, dw, dh) => { if (dw > 0 && dh > 0) ctx.drawImage(c, sx, sy, sw, sh, dx, dy, dw, dh); };
  put(e.left, 0, 0, 1, GH, 0, oy, ox, GH);
  put(e.right, 0, 0, 1, GH, ox + GW, oy, rw, GH);
  put(e.top, 0, 0, GW, 1, ox, 0, GW, oy);
  put(e.bottom, 0, 0, GW, 1, ox, oy + GH, GW, bh);
  put(e.top, 0, 0, 1, 1, 0, 0, ox, oy);
  put(e.top, GW - 1, 0, 1, 1, ox + GW, 0, rw, oy);
  put(e.bottom, 0, 0, 1, 1, 0, oy + GH, ox, bh);
  put(e.bottom, GW - 1, 0, 1, 1, ox + GW, oy + GH, rw, bh);
  ctx.drawImage(img, ox, oy);
  // 멀어질수록 어둡게: 한 도트 띠마다 겹쳐 칠해 d 도트 떨어진 곳이 FADE_MAX × d / FADE만큼 어둡다(그라디언트 없이 — 도트 계단으로)
  ctx.fillStyle = PAL.shadow;
  const far = Math.min(FADE, Math.max(ox, oy, rw, bh));
  let prev = 0;
  for (let d = 1; d <= far; d++) {
    const cur = (FADE_MAX * d) / FADE;
    ctx.globalAlpha = 1 - (1 - cur) / (1 - prev);
    prev = cur;
    if (ox - d > 0) ctx.fillRect(0, 0, ox - d, rows);
    if (rw - d > 0) ctx.fillRect(ox + GW + d, 0, rw - d, rows);
    if (oy - d > 0) ctx.fillRect(Math.max(0, ox - d), 0, Math.min(cols, GW + 2 * d), oy - d);
    if (bh - d > 0) ctx.fillRect(Math.max(0, ox - d), oy + GH + d, Math.min(cols, GW + 2 * d), bh - d);
  }
  ctx.globalAlpha = 1;
}

// 여백 판을 다시 칠한다(바뀐 것이 없으면 건너뛴다). s: { time, tint, dim, image }
let lastKey = null;
export function drawPad(canvas, pad, s) {
  const t = flowTime(s.time || 0);
  const key = `${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}|${s.image ? 'img' : `${t}|${s.tint}|${LOOK.flow}`}|${s.dim || 0}`;
  if (key === lastKey && canvas.width === pad.cols && canvas.height === pad.rows) return false;
  lastKey = key;
  if (canvas.width !== pad.cols) canvas.width = pad.cols;
  if (canvas.height !== pad.rows) canvas.height = pad.rows;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  if (s.image) imagePad(ctx, pad, s.image);
  else { ctx.drawImage(feltPad(pad), 0, 0); flowPad(ctx, pad, t, s.tint || null); }
  if (s.dim > 0) { ctx.globalAlpha = s.dim; ctx.fillStyle = PAL.shadow; ctx.fillRect(0, 0, pad.cols, pad.rows); ctx.globalAlpha = 1; }
  return true;
}
export function resetPad() { lastKey = null; }
