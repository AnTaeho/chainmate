// 판이 끝나거나 그만둘 때 기록에 남는 것(app.js): 끝난 그 명령에서 적기(결과 화면 전에 닫아도 남는다) · 끝없는 대국을 새 판으로 그만둠
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { stepBattle } from '../tools/bot.mjs';
import { createRun } from '../src/sim/run.js';
import { KEYS } from '../src/ui/save.js';

let dom, createApp, ResultScreen;
before(async () => { dom = await installDom(); ({ createApp } = await import('../src/ui/app.js')); ({ ResultScreen } = await import('../src/ui/screens/result.js')); });
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

// 대국 하나를 앱 명령으로 끝까지(이김: 목표 0 · 짐: 닿을 수 없는 목표 + 마지막 시계)
function playBattle(app, { lose }) {
  app.cmd({ type: 'play' });
  if (lose) { app.run.clock = 0; app.run.battle.target = 1e12; } else app.run.battle.target = 0;
  for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), { nomate: true })) break;
}
const unlockEvents = (app) => app.tracked.filter(([n]) => n === 'unlock_tier').length;

test('진 판: 마지막 명령에서 판 수 · 관 · 해금이 적힌다 — 결과 화면 전에 닫고 다시 켜도 남고, 결과 화면은 같은 것을 보이며 두 번 세지 않는다', () => {
  const app = makeApp({ runs: 3, gates: 12, unlockTier: 3 }); // 문턱 12를 넘었는데 아직 못 연 묶음 하나
  app.newRun({ seed: 1000003 });
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  playBattle(app, { lose: true });
  assert.equal(app.run.phase, 'lost');
  assert.equal(dom.store.get(KEYS.run) ?? null, null, '끝난 판의 저장은 지워졌다');
  const r = stored();
  assert.equal(r.runs, 4, '결과 화면 전에 판 수가 적혔다');
  assert.equal(r.unlockTier, 4, '한 판에 한 묶음');
  assert.equal(unlockEvents(app), 1);
  // 여기서 닫고 다시 켠다
  const again = createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage });
  assert.deepEqual([again.records.runs, again.records.unlockTier], [4, 4]);
  // 닫지 않고 결과 화면까지 가면: 같은 결과, 더 세지 않는다
  const out = app.run.recordedOut;
  const res = new ResultScreen(app, { quiet: true });
  assert.equal(res.out, out);
  assert.equal(res.opened, 4);
  assert.equal(res.out.fresh, app.fresh.length);
  assert.deepEqual([stored().runs, stored().unlockTier, unlockEvents(app)], [4, 4, 1]);
});

test('8관을 이긴 판: 이긴 명령에서 이긴 판 · 단 해금이 적히고, 끝없는 대국으로 이어져도 판 수는 한 번 — 끝없는 대국이 끝나면 깊이만 더한다', () => {
  const app = makeApp({ runs: 2, gates: 8, unlockTier: 2 });
  app.newRun({ seed: 1000003 });
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.run.ante = 8; app.run.blind = 2;
  playBattle(app, { lose: false });
  assert.equal(app.run.phase, 'won');
  let r = stored();
  assert.deepEqual([r.runs, r.wins, r.danWins['0'], r.unlocked.dan, r.unlockTier], [3, 1, 1, 1, 3]);
  assert.equal(unlockEvents(app), 1);
  const res = new ResultScreen(app, { quiet: true });
  assert.deepEqual([res.out.dan, res.opened], [1, 3]);
  // 끝없는 대국으로 잇고, 다음 관에서 진다
  app.cmd({ type: 'endless' });
  for (let i = 0; i < 6 && app.run.phase !== 'select'; i++) app.cmd(app.run.phase === 'shop' ? { type: 'leave' } : { type: 'skipPack' });
  assert.equal(app.run.phase, 'select');
  playBattle(app, { lose: true });
  assert.equal(app.run.phase, 'lost');
  r = stored();
  assert.deepEqual([r.runs, r.wins], [3, 1], '끝없는 대국의 끝은 판 수를 다시 세지 않는다');
  assert.equal(r.bestEndless, app.run.ante);
  assert.equal(unlockEvents(app), 1, '이긴 판이 이미 한 묶음을 열었다');
  const end = new ResultScreen(app, { quiet: true });
  assert.equal(end.out.endless, app.run.ante);
  assert.deepEqual([stored().runs, stored().bestEndless], [3, app.run.ante]);
});
