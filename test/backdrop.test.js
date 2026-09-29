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
  // 제 장면(타이틀): 흐름 시각이 바뀌어도 다시 칠하지 않는다
  const scene = { key: 'test', paint: () => {} };
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 9, tint: null, dim: 0, scene }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 20, tint: null, dim: 0, scene }), false);
  // 번쩍임: 세기가 바뀌는 동안만 다시 칠하고, 끝나면 멈춘다
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 20, tint: null, dim: 0, scene, flash: { col: '#efbd55', a: 0.4 } }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 20, tint: null, dim: 0, scene, flash: { col: '#efbd55', a: 0.3 } }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 20, tint: null, dim: 0, scene, flash: null }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 21, tint: null, dim: 0, scene, flash: null }), false);
});

// 칠하기를 도트마다 기록하는 캔버스: 도트마다 (빛깔, 알파) 순서의 해시. 불투명하게 칠하면 그 전 역사는 지운다
const ids = new Map();
function recorder(w, h) {
  const hash = new Int32Array(w * h), solid = new Uint8Array(w * h);
  const g = {
    fillStyle: '#000', globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect(x, y, rw, rh) {
      const k = `${g.fillStyle}@${g.globalAlpha}`;
      if (!ids.has(k)) ids.set(k, ids.size + 1);
      const id = ids.get(k), opaque = g.globalAlpha === 1 && !String(g.fillStyle).startsWith('rgba');
      for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) {
        const i = yy * w + xx;
        hash[i] = opaque ? id : (Math.imul(hash[i], 31) + id) | 0;
        if (opaque) solid[i] = 1;
      }
    },
  };
  return { g, hash, solid, w, h };
}

test('타이틀 장면: 창 전체로 이어 그려도 게임 판 자리는 게임 캔버스와 같은 도트, 여백에 빈 곳이 없다', async () => {
  const { paintScene } = await import('../src/ui/screens/title.js');
  const game = recorder(480, 270);
  paintScene(game.g, 0, 0, 480, 270);
  // 아이폰 가로 · 아이패드 세로 · 맥 1920×960처럼 여백이 사방으로 다른 창
  for (const [ox, oy, cols, rows] of [[127, 36, 734, 343], [30, 225, 540, 720], [34, 2, 548, 274], [5, 24, 490, 318]]) {
    const pad = recorder(cols, rows);
    paintScene(pad.g, -ox, -oy, cols, rows);
    let diff = 0;
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) if (pad.hash[(y + oy) * cols + x + ox] !== game.hash[y * 480 + x]) diff++;
    assert.equal(diff, 0, `게임 자리 도트가 다르다(${cols}×${rows})`);
    assert.equal(pad.solid.indexOf(0), -1, `여백에 칠하지 않은 도트(${cols}×${rows})`);
    // 늘인 띠가 아니다: 게임 판 왼쪽 바로 밖 열이 게임 첫 열을 그대로 되풀이하지 않는다
    if (ox >= 2) {
      let same = 0;
      for (let y = 0; y < 270; y++) if (pad.hash[(y + oy) * cols + ox - 2] === pad.hash[(y + oy) * cols + ox - 1] && pad.hash[(y + oy) * cols + ox - 1] === pad.hash[(y + oy) * cols + ox]) same++;
      assert.ok(same < 270, '가장자리 열이 늘인 띠처럼 같다');
    }
  }
});
