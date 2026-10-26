// 저장이 꽉 찼을 때(P-6 · C-11): 판 기록이 자리를 다 차지해도 진행 중인 판 · 기록 저장은 판 기록을 덜어 살아남고, 그래도 안 되면 한 번 알린다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

test('저장 한도를 판 기록이 거의 채워도 진행 중인 판이 저장된다 · 판 기록 줄임', async () => {
  const dom = await installDom();
  let LIMIT = Infinity;
  const ls = dom.window.localStorage, set0 = ls.setItem;
  const total = (skip) => [...dom.store.entries()].reduce((n, [k, v]) => n + (k === skip ? 0 : k.length + v.length), 0);
  ls.setItem = (k, v) => { if (total(k) + k.length + String(v).length > LIMIT) throw new Error('QuotaExceededError'); set0(k, v); };
  // 판 기록 약 38만 자
  const row = (i) => ({ id: `r${i}`, end: 'lost', pad: 'x'.repeat(9500) });
  dom.store.set(KEYS.runs, JSON.stringify({ v: 1, runs: Array.from({ length: 40 }, (_, i) => row(i)) }));
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, runs: 1, tutorialAsked: true }));
  LIMIT = total(null) + 1500; // 남은 자리 1500자 — 새 판(약 1800자)이 들어가지 않는다
  const { boot } = await import('../src/main.js');
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  app.newRun(); tick(app);
  assert.ok(dom.store.get(KEYS.run), '진행 중인 판이 남았다');
  assert.ok(JSON.parse(dom.store.get(KEYS.runs)).runs.length < 40, '판 기록을 덜었다');
  assert.equal(app.toasts.length, 0, '덜어서 됐으면 알리지 않는다');
  // 판 기록이 없는데도 모자라면 한 번 알린다
  const big = { v: 1, junk: 'y'.repeat(LIMIT + 1) };
  dom.store.delete(KEYS.runs);
  const { SAVE_FULL } = await import('../src/ui/app.js');
  app.run.junk = big.junk; app.save(); app.save();
  assert.equal(app.toasts.filter((t) => t.msg === SAVE_FULL).length, 1);
});

test('판 기록은 글자 수 상한(RUNLOG_CHARS) 안으로 줄인다', async () => {
  const { keepRow, loadRuns, RUNLOG_CHARS } = await import('../src/ui/runlog.js');
  const { makeStore } = await import('../src/ui/save.js');
  const m = new Map();
  const store = makeStore({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) });
  for (let i = 0; i < 160; i++) keepRow(store, { id: `r${i}`, pad: 'z'.repeat(18000) });
  assert.ok(m.get('chainmate.runs.v1').length <= RUNLOG_CHARS + 20000, `${m.get('chainmate.runs.v1').length}`);
  assert.equal(loadRuns(store).at(-1).id, 'r159', '새 판은 남는다');
});

test('다른 창이 저장을 바꾸면: 기록은 합치고, 판이 바뀌면 이 창의 판을 내려놓는다(P-18)', async () => {
  const dom = await installDom();
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, runs: 1, tutorialAsked: true }));
  const { boot } = await import('../src/main.js?tabs');
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  const { OTHER_TAB } = await import('../src/ui/app.js');
  // 다른 창이 판을 더 끝냈다 → 이 창의 기록에 합쳐진다(판 수는 큰 쪽)
  const theirs = { ...JSON.parse(JSON.stringify(app.records)), runs: 5 };
  dom.emit('storage', { key: KEYS.records, newValue: JSON.stringify(theirs) });
  assert.equal(app.records.runs, 5);
  // 판을 두는 중에 다른 창이 판을 바꿨다 → 메인 화면으로, 이 창은 판을 덮어쓰지 않는다
  app.newRun(); tick(app);
  const other = JSON.parse(dom.store.get(KEYS.run)); other.money = 999;
  dom.store.set(KEYS.run, JSON.stringify(other));
  dom.emit('storage', { key: KEYS.run, newValue: JSON.stringify(other) });
  tick(app);
  assert.equal(app.screen.name, 'title');
  assert.equal(app.run, null);
  assert.ok(app.toasts.some((t) => t.msg === OTHER_TAB));
  app.save();
  assert.equal(JSON.parse(dom.store.get(KEYS.run)).money, 999, '다른 창의 판이 남는다');
});
