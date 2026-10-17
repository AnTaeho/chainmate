// 팩 화면: 숫자 키로 고르기 — 팩의 카드 수보다 큰 숫자는 아무 일도 없다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { applyRun } from '../src/sim/run.js';
import { shopRun } from './helpers/run.js';

let dom;
before(async () => { dom = await installDom(); });
after(() => { delete globalThis.document; delete globalThis.window; });

test('셋짜리 팩에서 「4」 키: 넘기기 전에도 뒤에도 던지지 않고 팩에 남는다', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const app = createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage });
  let run = null;
  for (let seed = 1; seed < 40 && !run; seed++) {
    const r = shopRun(seed);
    r.money = 99;
    for (let slot = 0; slot < r.shop.packs.length; slot++) {
      const c = JSON.parse(JSON.stringify(r));
      applyRun(c, { type: 'buyPack', slot });
      if (c.phase === 'pack' && c.pack.options.length === 3) { run = c; break; }
    }
  }
  assert.ok(run, '셋짜리 팩을 찾았다');
  app.run = run;
  app.go('pack');
  app.key('4');
  for (let i = 0; i < 200; i++) app.update(0.05);
  tick(app);
  assert.doesNotThrow(() => app.key('4'));
  assert.equal(app.screen.name, 'pack');
  assert.equal(app.run.phase, 'pack');
});
