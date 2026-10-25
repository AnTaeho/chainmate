// 첫 화면 앞 기다림(main.js BOOT_WAIT): 글꼴이 끝없이 안 와도(망이 멈춤) 앱은 뜨고, 늦게 오면 한 번 다시 그린다
import test from 'node:test';
import assert from 'node:assert/strict';

test('글꼴 받기가 돌아오지 않아도 boot가 BOOT_WAIT.fonts 뒤에 끝난다 · 늦게 온 글꼴에 다시 그린다', async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const main = await import('../src/main.js');
  const d = makeFakeDom({ width: 1280, height: 720 });
  const arrive = [];
  d.document.fonts = { load: () => new Promise((ok) => { arrive.push(ok); }) };
  const old = { ...main.BOOT_WAIT };
  main.BOOT_WAIT.fonts = 30; main.BOOT_WAIT.audio = 30;
  try {
    const t0 = Date.now();
    const app = await main.boot({ window: d.window, document: d.document, rankBase: '' });
    assert.ok(app && app.screen, '앱이 떴다');
    assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
    let n = 0;
    const inv = app.invalidate;
    app.invalidate = () => { n++; return inv(); };
    for (const ok of arrive) ok([]);
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
    assert.ok(n >= 1, '늦게 온 글꼴에 다시 그린다');
  } finally { Object.assign(main.BOOT_WAIT, old); }
});
