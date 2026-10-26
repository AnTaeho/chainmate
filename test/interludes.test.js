// 막간 화면(보상 · 마스터의 상자 · 깨우기)을 한 번씩 열어: 연출이 끝나면 animating()이 거짓이 되고(그릴 때만 그린다 — layout.md 9절),
// 끝 장면의 상자 · 글이 겹침 · 넘침 없이 서는지(checkLayout 어김 0)를 한국어 · 영어로 잰다(C-17).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

let dom, boot, LL, lang;
before(async () => {
  dom = await installDom();
  ({ boot } = await import('../src/main.js'));
  LL = await import('../src/render/layoutlog.js');
  lang = await import('../src/ui/lang.js');
});
after(() => { lang.setLang('ko'); delete globalThis.document; delete globalThis.window; });

const fresh = async (l) => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, tutorialAsked: true, runs: 1 }));
  const app = await boot({ window: dom.window, document: dom.document });
  app.settings.lang = l; lang.setLang(l);
  app.newRun({ seed: 3 });
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  tick(app);
  return app;
};
// 연출이 끝날 때까지(최대 10초) 프레임을 돌리고 끝 장면 한 장을 재어 어김을 돌려준다
const settle = (app) => {
  for (let i = 0; i < 600 && app.screen.animating(); i++) tick(app, 1);
  LL.LOG.on = true;
  try { tick(app, 1); assert.ok(LL.LOG.boxes.length > 2, '끝 장면을 그렸다'); return LL.checkLayout().map((q) => q.msg); } finally { LL.LOG.on = false; }
};

for (const l of ['ko', 'en']) {
  test(`보상: 줄이 다 쌓이면 멈추고, 일곱 줄 · 금빛 꾸러미 줄에도 상자가 넘치지 않는다(${l})`, async () => {
    const app = await fresh(l);
    app.run.last = { score: 98000, target: 9000, overflow: 10, reason: 'mate' };
    app.go('reward', { reward: { base: 5, moves: 3, interest: 5, mate: 2, overflow: 2, challenge: 2, earned: 4, total: 23 }, events: [{ type: 'goldenPack' }] });
    const s = app.screen;
    assert.equal(s.name, 'reward');
    assert.ok(s.animating(), '처음에는 줄이 쌓이는 중');
    assert.deepEqual(settle(app), [], l);
    assert.equal(s.animating(), false, '다 쌓인 뒤에는 그리지 않는다');
    assert.equal(s.shown, s.lines.length + 1);
  });

  test(`마스터의 상자: 다섯 칸 릴이 차례로 멈추고 번쩍임이 끝나면 그리지 않는다(${l})`, async () => {
    const app = await fresh(l);
    const p = app.run.deck[0];
    const cells = [{ kind: 'money', money: 2 }, { kind: 'chart', form: 'N' }, { kind: 'piece', t: 'R' }, { kind: 'engrave', piece: 'P', eng: 'gold' }, { kind: 'awaken', soul: 'echo', piece: p.t, pieceId: p.id }]
      .map((item) => ({ lit: true, item }));
    app.go('chest', { chest: { count: 5, cells } });
    const s = app.screen;
    assert.equal(s.name, 'chest');
    // 칸은 앞에서부터 멈춘다
    let last = 0;
    for (let i = 0; i < 400 && s.stopped < cells.length; i++) { tick(app, 1); assert.ok(s.stopped >= last); last = s.stopped; }
    assert.equal(s.stopped, cells.length);
    assert.deepEqual(settle(app), [], l);
    assert.equal(s.animating(), false);
  });

  test(`깨우기: 금이 번져 터진 뒤 끝 장면에서 멈춘다(${l})`, async () => {
    const app = await fresh(l);
    const p = app.run.deck[0];
    p.soul = 'echo';
    app.go('awaken', { awaken: { soul: 'echo', piece: p.t, pieceId: p.id, src: 'golden' } });
    const s = app.screen;
    assert.equal(s.name, 'awaken');
    assert.ok(s.animating());
    assert.deepEqual(settle(app), [], l);
    assert.equal(s.animating(), false);
  });
}
