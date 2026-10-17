// 켜기(main.js boot): 저장소를 읽기만 해도 던지는 브라우저(쿠키 막음 · 샌드박스 iframe)에서도 첫 화면까지 간다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';

let dom;
before(async () => { dom = await installDom(); });
after(() => { delete globalThis.document; delete globalThis.window; });

test('window.localStorage를 읽으면 던져도 켜지고, 저장 없이 판을 시작한다', async () => {
  Object.defineProperty(dom.window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: access denied'); } });
  const { boot } = await import('../src/main.js');
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  assert.ok(app.screen, '첫 화면이 섰다');
  assert.equal(app.hasSave(), false);
  app.records.kingDone = true; app.records.lessonsDone = true;
  assert.doesNotThrow(() => { app.newRun({ seed: 3 }); tick(app); });
  assert.ok(app.run);
});
