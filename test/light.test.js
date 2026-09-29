// 빛과 움직임(docs/design-notes/layout.md 「빛과 움직임」): 흔들림은 그리기 변환만 바꾸고, 1배 · 움직임 줄이기에서는 돌리지 않는다.
// 소수점 자리는 fine 안에서만 1/N 칸에 서고, 밖에서는 늘 정수 칸이다. 누르는 구역과 레이아웃 기록은 원래 네모 그대로.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let dom, M;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  M = {
    look: await import('../src/render/look.js'),
    gfx: await import('../src/render/gfx.js'),
    light: await import('../src/render/light.js'),
    sway: await import('../src/ui/sway.js'),
    log: await import('../src/render/layoutlog.js'),
  };
});
after(() => { delete globalThis.document; delete globalThis.window; });

// 그리기 호출을 적는 캔버스
function rec() {
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false, fillStyle: '#000' }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, calls };
}
const withLook = (o, fn) => { const keep = { ...M.look.LOOK }; Object.assign(M.look.LOOK, o); try { return fn(); } finally { Object.assign(M.look.LOOK, keep); } };

test('fine 안에서만 1/N 칸, 밖은 정수 칸', () => {
  withLook({ n: 3 }, () => {
    const { ctx, calls } = rec();
    M.gfx.rect(ctx, 10.4, 5.2, 2, 2, '#fff');
    M.gfx.fine(() => M.gfx.rect(ctx, 10.4, 5.2, 2, 2, '#fff'));
    const fr = calls.filter((c) => c[0] === 'fillRect');
    assert.deepEqual(fr[0].slice(1, 3), [10, 5]);
    assert.ok(Math.abs(fr[1][1] - 31 / 3) < 1e-9 && Math.abs(fr[1][2] - 16 / 3) < 1e-9, `fine 자리 ${fr[1]}`);
  });
  // N = 1이면 fine도 정수 칸
  withLook({ n: 1 }, () => {
    const { ctx, calls } = rec();
    M.gfx.fine(() => M.gfx.rect(ctx, 10.4, 5.6, 2, 2, '#fff'));
    assert.deepEqual(calls.find((c) => c[0] === 'fillRect').slice(1, 3), [10, 6]);
  });
});

test('흔들림: 3배는 돌리고, 1배 · 움직임 줄이기는 돌리지 않는다', () => {
  const run = (look, opts = {}) => withLook(look, () => {
    const { ctx, calls } = rec();
    let drawn = 0;
    for (let t = 0; t < 2; t += 0.05) M.sway.sway(ctx, t, `card:${JSON.stringify(look)}:${JSON.stringify(opts)}`, 100, 50, 60, 80, () => { drawn++; }, opts);
    return { calls, drawn };
  });
  const big = run({ n: 3, calm: false });
  assert.ok(big.calls.some((c) => c[0] === 'rotate'), '3배에서 돌지 않았다');
  const one = run({ n: 1, calm: false });
  assert.ok(!one.calls.some((c) => c[0] === 'rotate'), '1배에서 돌았다');
  const calm = run({ n: 3, calm: true });
  assert.ok(!calm.calls.some((c) => c[0] === 'rotate' || c[0] === 'translate'), '움직임 줄이기에서 흔들렸다');
  assert.equal(calm.drawn, 40);
  // 움직임 줄이기라도 가리키면 들린다(기울지는 않는다)
  const hov = run({ n: 3, calm: true }, { hover: true, mx: 160 });
  assert.ok(hov.calls.some((c) => c[0] === 'translate') && !hov.calls.some((c) => c[0] === 'rotate'));
  // 기울기는 ±2° 안
  const ang = big.calls.filter((c) => c[0] === 'rotate').map((c) => Math.abs(c[1]) * 180 / Math.PI);
  assert.ok(Math.max(...ang) <= 2.01, `기울기 ${Math.max(...ang)}°`);
});

test('흔들리는 카드의 레이아웃 기록은 원래 네모', () => {
  withLook({ n: 3, calm: false }, () => {
    const { ctx } = rec();
    M.log.LOG.on = true;
    try {
      M.log.logBegin();
      M.sway.sway(ctx, 1.3, 'card:log', 100, 50, 60, 80, () => { M.log.openBox('card', 100, 50, 60, 80, 7, { name: '카드' }); M.gfx.text(ctx, '말', 110, 60); M.log.closeBox(); }, { hover: true, mx: 150 });
      const b = M.log.LOG.boxes.find((x) => x.name === '카드');
      assert.deepEqual([b.x, b.y, b.w, b.h], [100, 50, 60, 80]);
      const t = M.log.LOG.texts[0];
      assert.deepEqual([t.x, t.y], [110, 60]);
    } finally { M.log.LOG.on = false; }
  });
});

test('빛 · 그림자 · 흐르는 배경이 가짜 캔버스에서 돈다', () => {
  const { ctx, calls } = rec();
  M.light.glow(ctx, 10, 10, 40, 12, '#efbd55', 0.5, 6);
  M.light.glowText(ctx, 10, 10, 40, 12, '#efbd55', 0.5, 8);
  M.light.shade(ctx, 10, 10, 40, 12);
  M.light.groundShadow(ctx, 30, 40, 4);
  M.light.flowLayer(ctx, 1.5, '#8fae4a', -8, -8, 496, 286);
  assert.ok(calls.filter((c) => c[0] === 'drawImage').length >= 12);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  assert.equal(ctx.imageSmoothingEnabled, false);
  assert.equal(ctx.globalAlpha, 1);
  // 빛 떨림: 움직임 줄이기면 멈춘 값
  withLook({ calm: true }, () => { assert.equal(M.light.flicker(0.3), 1); assert.equal(M.light.flicker(2.1), 1); });
});
