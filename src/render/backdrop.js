// 여백 판(docs/design-notes/layout.md 「화면 맞춤」): 게임 캔버스 뒤 창 전체를 덮는 도트 해상도 캔버스.
// 게임과 같은 도트 격자 위에 판 밖 배경을 창 끝까지 잇는다 — 펠트 결은 같은 좌표의 결, 흐르는 얼룩은 같은 칸의 얼룩이라
// 게임 캔버스 테두리가 드러나지 않는다. 타이틀처럼 제 그림을 까는 화면은 같은 그리기 함수로 창 전체 장면을 이어 그린다.
// 전설 · 상자의 금빛 번쩍임은 여백 판도 같은 빛깔 · 같은 세기로 덮는다.
// 덮개(멈춤 · 설정)나 따라 하는 길이 화면을 어둡게 하면 여백 판도 같은 만큼 어두워진다.
import { makeCanvas, context } from './surface.js';
import { PAL, rgb } from './palette.js';
import { feltWeave, FELT_WEAVE } from './texture.js';
import { LOOK } from './look.js';
import { FLOW, flowTime, paintFlow } from './light.js';


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

// 제 장면(타이틀): 화면이 준 그리기 함수로 창 전체 좌표 범위를 한 번 칠해 둔다. 게임 캔버스와 같은 함수 · 같은 좌표라
// 겹치는 곳이 같은 도트다 — 가장자리를 늘리지 않는다(늘린 띠는 긴 줄무늬가 됐다). scene: { key, paint(g, x0, y0, w, h) }
let sceneCv = null, sceneKey = null;
export const padStats = { sceneMs: 0 };
function scenePad(pad, scene) {
  const key = `${scene.key}|${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}`;
  if (sceneCv && sceneKey === key) return sceneCv;
  const t0 = globalThis.performance ? performance.now() : 0;
  sceneCv = makeCanvas(pad.cols, pad.rows);
  const g = context(sceneCv);
  g.imageSmoothingEnabled = false;
  scene.paint(g, -pad.ox, -pad.oy, pad.cols, pad.rows);
  sceneKey = key;
  padStats.sceneMs = globalThis.performance ? performance.now() - t0 : 0;
  return sceneCv;
}

// 여백 판을 다시 칠한다(바뀐 것이 없으면 건너뛴다). s: { time, tint, dim, scene, flash: { col, a } }
// 순서는 게임과 같다: 바탕(펠트 · 흐름 또는 장면) → 번쩍임(전설 · 상자의 금빛) → 덮개 어둡기
let lastKey = null;
export function drawPad(canvas, pad, s) {
  const t = flowTime(s.time || 0);
  const fl = s.flash && s.flash.a > 0 ? s.flash : null;
  const key = `${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}|${s.scene ? `scene:${s.scene.key}` : `${t}|${s.tint}|${LOOK.flow}`}|${fl ? `${fl.col}@${fl.a.toFixed(3)}` : ''}|${s.dim || 0}`;
  if (key === lastKey && canvas.width === pad.cols && canvas.height === pad.rows) return false;
  lastKey = key;
  if (canvas.width !== pad.cols) canvas.width = pad.cols;
  if (canvas.height !== pad.rows) canvas.height = pad.rows;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  if (s.scene) ctx.drawImage(scenePad(pad, s.scene), 0, 0);
  else { ctx.drawImage(feltPad(pad), 0, 0); flowPad(ctx, pad, t, s.tint || null); }
  if (fl) { ctx.globalAlpha = fl.a; ctx.fillStyle = fl.col; ctx.fillRect(0, 0, pad.cols, pad.rows); ctx.globalAlpha = 1; }
  if (s.dim > 0) { ctx.globalAlpha = s.dim; ctx.fillStyle = PAL.shadow; ctx.fillRect(0, 0, pad.cols, pad.rows); ctx.globalAlpha = 1; }
  return true;
}
export function resetPad() { lastKey = null; }
