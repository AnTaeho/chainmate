// 판이 끝나거나 그만둘 때 기록에 남는 것(app.js): 끝없는 대국을 새 판으로 그만둠
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { createRun } from '../src/sim/run.js';
import { KEYS } from '../src/ui/save.js';

let dom, createApp;
before(async () => { dom = await installDom(); ({ createApp } = await import('../src/ui/app.js')); });
after(() => { delete globalThis.document; delete globalThis.window; });

function makeApp(records = {}) {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, lessonsDone: true, kingDone: true, ...records }));
  const tracked = [];
  const app = createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage, track: (name, props) => tracked.push([name, props]) });
  app.tracked = tracked;
  return app;
}
const stored = () => JSON.parse(dom.store.get(KEYS.records));

test('끝없는 대국을 새 판으로 덮어쓰면 도달한 관은 남고, 그만둔 판의 관은 해금에 세지 않는다', () => {
  for (const fromStore of [false, true]) {
    const app = makeApp({ runs: 1, wins: 1, bestAnte: 8, gates: 8, unlockTier: 1, bestEndless: 9 });
    const run = createRun({ draft: false, seed: 5 });
    run.endless = true; run.ante = 11; run.recorded = true; run.gatesDone = 8; run.tierOpened = 1;
    if (fromStore) dom.store.set(KEYS.run, JSON.stringify(run)); else app.run = run;
    app.newRun({ seed: 6 });
    const r = stored();
    assert.equal(r.bestEndless, 11, fromStore ? '저장에서' : '두던 판에서');
    assert.deepEqual([r.gates, r.unlockTier, r.runs, r.wins], [8, 1, 1, 1]);
  }
  // 더 얕으면 그대로
  const app = makeApp({ bestEndless: 14 });
  const run = createRun({ draft: false, seed: 5 });
  run.endless = true; run.ante = 10; app.run = run;
  app.newRun({ seed: 6 });
  assert.equal(stored().bestEndless, 14);
});
