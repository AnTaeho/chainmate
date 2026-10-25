// 여백 판(docs/design-notes/layout.md 「화면 맞춤」): 게임 캔버스 뒤 창 전체를 덮는 도트 해상도 캔버스.
// 게임과 같은 도트 격자 위에 판 밖 배경을 창 끝까지 잇는다 — 바탕(남색 빛 · 기운 띠)은 같은 좌표의 같은 칸이라
// 게임 캔버스 테두리가 드러나지 않는다. 타이틀처럼 제 그림을 까는 화면은 같은 그리기 함수로 창 전체 장면을 이어 그린다.
// 전설 · 상자의 금빛 번쩍임은 여백 판도 같은 빛깔 · 같은 세기로 덮는다.
// 덮개(멈춤 · 설정)나 따라 하는 길이 화면을 어둡게 하면 여백 판도 같은 만큼 어두워진다.
import { makeCanvas, context } from './surface.js';
import { PAL, rgb } from './palette.js';
import { LOOK } from './look.js';
import { FLOW, flowTime, paintFlow } from './light.js';


// 바탕(안 3 — 남색 빛 · 기운 띠): 게임과 같은 칸(FLOW, 논리 1px)을 여백 판이 덮는 만큼 넓혀 칠한다
let flowCv = null, flowImg = null, flowKey = null;
function flowPad(ctx, pad, t, tint) {
  const s = 1;
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
// 겹치는 곳이 같은 도트다 — 가장자리를 늘리지 않는다(늘린 띠는 긴 줄무늬가 됐다). scene: { key, paint(g, x0, y0, w, h), live? }
// 둘레 SCENE_M 도트를 더 칠해 둔다: 장면이 흔들리면(live.shake) 그만큼 옮겨 깔아도 창 끝이 비지 않는다.
// live: { key, shake: [dx, dy], draw(g, x0, y0, w, h), over(g, x0, y0, w, h) } — 움직이는 층(흔들림을 따라 옮긴다)과
// 그 위의 멈춘 덮개(over, 옮기지 않는다). key가 바뀔 때만 다시 칠한다(타이틀: 실루엣이 한 도트 옮겨 가거나 별이 깜빡일 때)
const SCENE_M = 8;
let sceneCv = null, sceneKey = null;
export const padStats = { sceneMs: 0 };
function scenePad(pad, scene) {
  const s = pad.s || 1;
  const key = `${scene.key}|${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}|${s}`;
  if (sceneCv && sceneKey === key) return sceneCv;
  const t0 = globalThis.performance ? performance.now() : 0;
  // 꽉 채움(pad.s가 소수): 장면도 여백 판 해상도로 칠한다 — 도트 해상도 그림을 소수 배로 늘리면 도트가 2 · 3 화소로 들쭉날쭉하다
  sceneCv = makeCanvas(Math.ceil((pad.cols + 2 * SCENE_M) * s), Math.ceil((pad.rows + 2 * SCENE_M) * s));
  const g = context(sceneCv);
  g.imageSmoothingEnabled = false;
  if (s !== 1) g.setTransform(s, 0, 0, s, 0, 0);
  scene.paint(g, -pad.ox - SCENE_M, -pad.oy - SCENE_M, pad.cols + 2 * SCENE_M, pad.rows + 2 * SCENE_M);
  sceneKey = key;
  padStats.sceneMs = globalThis.performance ? performance.now() - t0 : 0;
  return sceneCv;
}
function drawScene(ctx, pad, scene) {
  const live = scene.live || null;
  const [dx, dy] = (live && live.shake) || [0, 0];
  const sc = scenePad(pad, scene), s = pad.s || 1;
  ctx.drawImage(sc, dx - SCENE_M, dy - SCENE_M, sc.width / s, sc.height / s);
  if (!live) return;
  if (live.draw) {
    ctx.save();
    ctx.translate(dx - SCENE_M, dy - SCENE_M);
    live.draw(ctx, -pad.ox - SCENE_M, -pad.oy - SCENE_M, pad.cols + 2 * SCENE_M, pad.rows + 2 * SCENE_M);
    ctx.restore();
  }
  if (live.over) live.over(ctx, -pad.ox, -pad.oy, pad.cols, pad.rows);
}

// 여백 판을 다시 칠한다(바뀐 것이 없으면 건너뛴다). s: { time, tint, dim, scene, flash: { col, a } }
// 순서는 게임과 같다: 바탕(남색 빛 · 띠 또는 장면) → 번쩍임(전설 · 상자의 금빛) → 덮개 어둡기
let lastKey = null;
export function drawPad(canvas, pad, s) {
  const t = flowTime(s.time || 0);
  const fl = s.flash && s.flash.a > 0 ? s.flash : null;
  const key = `${pad.cols}x${pad.rows}@${pad.ox},${pad.oy}|${s.scene ? `scene:${s.scene.key}:${s.scene.live ? s.scene.live.key : ''}` : `${t}|${s.tint}`}|${fl ? `${fl.col}@${fl.a.toFixed(3)}` : ''}|${s.dim || 0}`;
  // 꽉 채움(fit.js placeFill): 여백 판 캔버스는 뒷면 해상도(pad.dev), 도트 좌표는 변환으로 그 화소에 놓는다
  const dev = pad.dev || null, cw = dev ? dev.w : pad.cols, ch = dev ? dev.h : pad.rows;
  if (key === lastKey && canvas.width === cw && canvas.height === ch) return false;
  lastKey = key;
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (dev) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch); ctx.setTransform(pad.s, 0, 0, pad.s, dev.tx, dev.ty); }
  else ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  if (s.scene) drawScene(ctx, pad, s.scene);
  else flowPad(ctx, pad, t, s.tint || null);
  if (fl) { ctx.globalAlpha = fl.a; ctx.fillStyle = fl.col; ctx.fillRect(0, 0, pad.cols, pad.rows); ctx.globalAlpha = 1; }
  if (s.dim > 0) { ctx.globalAlpha = s.dim; ctx.fillStyle = PAL.shadow; ctx.fillRect(0, 0, pad.cols, pad.rows); ctx.globalAlpha = 1; }
  return true;
}
export function resetPad() { lastKey = null; }
