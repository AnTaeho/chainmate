// 여백 판(src/render/backdrop.js, layout.md 「화면 맞춤」): 판 밖 흐름은 게임과 같은 칸의 같은 얼룩, 바뀐 것이 없으면 다시 칠하지 않는다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, M;
before(async () => {
  dom = await installDom();
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

// 아이폰 가로 · 아이패드 세로 · 맥 1920×960 · 좁은 여백: [게임 왼쪽 위 자리 x, y, 여백 판 폭, 높이]
const WINDOWS = [[127, 36, 734, 343], [30, 225, 540, 720], [34, 2, 548, 274], [5, 24, 490, 318]];
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

test('첫 화면 달밤: 멈춘 바탕을 창 전체로 이어 그려도 게임 판 자리는 게임 캔버스와 같은 도트, 여백에 빈 곳이 없다', async () => {
  const { paintNight } = await import('../src/render/night.js');
  const game = recorder(480, 270);
  paintNight(game.g, 0, 0, 480, 270);
  // 아이폰 가로 · 아이패드 세로 · 맥 1920×960처럼 여백이 사방으로 다른 창
  for (const [ox, oy, cols, rows] of WINDOWS) {
    const pad = recorder(cols, rows);
    paintNight(pad.g, -ox, -oy, cols, rows);
    let diff = 0;
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) if (pad.hash[(y + oy) * cols + x + ox] !== game.hash[y * 480 + x]) diff++;
    assert.equal(diff, 0, `게임 자리 도트가 다르다(${cols}×${rows})`);
    assert.equal(pad.solid.indexOf(0), -1, `여백에 칠하지 않은 도트(${cols}×${rows})`);
  }
});

test('첫 화면 달밤: 별 · 실루엣은 여백 판과 게임이 같은 자리에 있고, 실루엣은 게임 밖으로도 이어진다', async () => {
  const N = await import('../src/render/night.js');
  const key = (s) => `${s.kind}${s.layer}@${s.x},${s.y}x${s.sc}`;
  for (const t of [0, 3.7, 41.2]) {
    const inGame = new Set(N.silhouettesIn(t, 0, 0, 480, 270).map(key));
    const stars = new Set(N.starsIn(0, 0, 480, 270).map((p) => p.join(',')));
    for (const [ox, oy, cols, rows] of WINDOWS) {
      const all = N.silhouettesIn(t, -ox, -oy, cols, rows);
      const touching = all.filter((s) => s.x < 480 && s.x + 16 * s.sc > 0 && s.y < 270 && s.y + 22 * s.sc > 0).map(key);
      assert.deepEqual(new Set(touching), inGame, `실루엣이 다르다(t ${t}, ${cols}×${rows})`);
      const padStars = N.starsIn(-ox, -oy, cols, rows).filter(([x, y]) => x >= 0 && x < 480 && y >= 0 && y < 270).map((p) => p.join(','));
      assert.deepEqual(new Set(padStars), stars, `별이 다르다(${cols}×${rows})`);
      if (ox >= 40) assert.ok(all.some((s) => s.x < 0), `왼쪽 여백에 실루엣이 없다(${cols}×${rows})`);
    }
  }
  // 겹마다 한 도트씩 함께 옮겨 간다: 흐른 거리가 같으면 같은 자리
  assert.deepEqual(N.silhouettesIn(10, 0, 0, 480, 270), N.silhouettesIn(10.001, 0, 0, 480, 270));
  assert.notDeepEqual(N.silShift(10), N.silShift(12));
});

test('여백 판: 움직이는 층은 그 열쇠가 바뀔 때만 다시 칠하고, 흔들림만큼 바탕을 옮겨 깐다', () => {
  const f = M.fit.chooseFit({ vw: 1470, vh: 956, dpr: 2 });
  const cv = dom.document.createElement('canvas');
  M.pad.resetPad();
  let drawn = 0, over = 0;
  const scene = (k, shake = [0, 0]) => ({ key: 'night-test', paint: () => {}, live: { key: k, shake, draw: () => { drawn++; }, over: () => { over++; } } });
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 1, dim: 0, scene: scene('a') }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 2, dim: 0, scene: scene('a') }), false);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 2, dim: 0, scene: scene('b') }), true);
  assert.equal(M.pad.drawPad(cv, f.pad, { time: 2, dim: 0, scene: scene('b|2,-1', [2, -1]) }), true);
  assert.equal(drawn, 3);
  assert.equal(over, 3);
});
