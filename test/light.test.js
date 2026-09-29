// 빛과 움직임(docs/design-notes/layout.md 「빛과 움직임」): 카드 들림은 그리기 변환(위아래)만 바꾸고, 가만히 있거나 가리켜도 돌지 않는다.
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

test('카드: 가만히 있으면 멈추고, 가리키면 들리고, 누르면 가라앉는다 — 어느 배율에서도 돌지 않는다', () => {
  const run = (look, opts = {}) => withLook(look, () => {
    const { ctx, calls } = rec();
    let drawn = 0;
    for (let t = 0; t < 2; t += 0.05) M.sway.sway(ctx, t, `card:${JSON.stringify(look)}:${JSON.stringify(opts)}`, 100, 50, 60, 80, () => { drawn++; }, opts);
    return { calls, drawn };
  });
  for (const look of [{ n: 3, calm: false }, { n: 1, calm: false }, { n: 3, calm: true }]) {
    const idle = run(look);
    assert.equal(idle.drawn, 40);
    assert.ok(!idle.calls.some((c) => c[0] === 'rotate' || c[0] === 'translate' || c[0] === 'drawImage'), `가만히 있는데 움직였다 ${JSON.stringify(look)}`);
    const ty = (cs) => cs.filter((c) => c[0] === 'translate').map((c) => { assert.equal(c[1], 0); return c[2]; });
    const hov = run(look, { hover: true });
    assert.ok(!hov.calls.some((c) => c[0] === 'rotate'), `가리키니 돌았다 ${JSON.stringify(look)}`);
    const up = ty(hov.calls);
    assert.ok(up.length && Math.min(...up) >= -1.5 - 1e-9 && up.at(-1) < 0, `가리킴 들림 ${up.at(-1)}`);
    const down = ty(run(look, { press: true }).calls);
    assert.ok(down.length && down.at(-1) === 1, `누름 가라앉음 ${down.at(-1)}`);
  }
  // 멈춘 배율에서는 정수 칸
  const one = withLook({ n: 1 }, () => { const { ctx, calls } = rec(); for (let t = 0; t < 1; t += 0.05) M.sway.sway(ctx, t, 'card:one', 0, 0, 10, 10, () => {}, { hover: true }); return calls; });
  assert.ok(one.filter((c) => c[0] === 'translate').every((c) => Number.isInteger(c[2])));
});

test('들린 카드의 레이아웃 기록은 원래 네모', () => {
  withLook({ n: 3, calm: false }, () => {
    const { ctx } = rec();
    M.log.LOG.on = true;
    try {
      M.log.logBegin();
      M.sway.sway(ctx, 1.3, 'card:log', 100, 50, 60, 80, () => { M.log.openBox('card', 100, 50, 60, 80, 7, { name: '카드' }); M.gfx.text(ctx, '말', 110, 60); M.log.closeBox(); }, { hover: true });
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
