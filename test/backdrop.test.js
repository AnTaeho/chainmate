// 여백 판(src/render/backdrop.js, layout.md 「화면 맞춤」): 판 밖 흐름은 게임과 같은 칸의 같은 얼룩, 바뀐 것이 없으면 다시 칠하지 않는다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let dom, M;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  M = { light: await import('../src/render/light.js'), pad: await import('../src/render/backdrop.js'), fit: await import('../src/ui/fit.js'), look: await import('../src/render/look.js') };
});
after(() => { delete globalThis.document; delete globalThis.window; });

test('흐르는 얼룩: 판 밖으로 넓힌 칸도 겹치는 곳은 게임의 64×36과 같다', () => {
  const game = new Uint8ClampedArray(64 * 36 * 4);
  M.light.paintFlow(game, 64, 36, 0, 0, 3.25, '#8fae4a', 1.6);
  const cols = 90, rows = 50, i0 = -13, j0 = -7;
  const wide = new Uint8ClampedArray(cols * rows * 4);
  M.light.paintFlow(wide, cols, rows, i0, j0, 3.25, '#8fae4a', 1.6);
  for (let j = 0; j < 36; j++) for (let i = 0; i < 64; i++) for (let c = 0; c < 4; c++) {
    assert.equal(wide[((j - j0) * cols + (i - i0)) * 4 + c], game[(j * 64 + i) * 4 + c]);
  }
});

test('여백 판: 창 크기 · 흐름 시각 · 어둡기가 같으면 다시 칠하지 않는다', () => {
  const f = M.fit.chooseFit({ vw: 1470, vh: 956, dpr: 2 });
  const cv = dom.document.createElement('canvas');
  M.pad.resetPad();
  M.look.LOOK.calm = false;
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 1, tint: null, dim: 0 }), true);
  assert.equal(cv.width, f.pad.cols);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 1.01, tint: null, dim: 0 }), false);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 1.01, tint: null, dim: 0.72 }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 2, tint: null, dim: 0.72 }), true);
  // 움직임 줄이기: 흐름이 멈춰 시각이 바뀌어도 그대로
  M.look.LOOK.calm = true;
  M.pad.drawPad(cv, f.pad, { time: 3, tint: null, dim: 0 });
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 9, tint: null, dim: 0 }), false);
  M.look.LOOK.calm = false;
  // 제 그림(타이틀)도 돈다
  const img = dom.document.createElement('canvas'); img.width = 480; img.height = 270;
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 9, tint: null, dim: 0, image: img }), true);
});
