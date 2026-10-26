// 되돌릴 수 없는 누름 막기(묶음 3): 끊긴 손가락은 끌던 격언을 옮기지 않는다(P-10) · 수정 키가 낀 키는 게임이 받지 않는다 ·
// 상점에 막 들어온 Enter는 「다음 대국」이 아니다(P-11) · 「다음 대국」은 빈 자리 손가락 누름이 붙지 않는다(P-5)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

let dom, boot, createRun, createRng, fork;
before(async () => {
  dom = await installDom();
  ({ boot } = await import('../src/main.js'));
  ({ createRun } = await import('../src/sim/run.js'));
  ({ createRng, fork } = await import('../src/sim/rng.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });
const fresh = async () => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, runs: 1, tutorialAsked: true, lessonsDone: true, coachSeen: { telemetry: true, bigText: true, rankName: true, shop: true, maximSell: true, hold: true } }));
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  return app;
};
// 격언 셋을 든 상점(수업 상점과 같은 꼴)
function shopRun(app) {
  const run = createRun({ seed: 3, draft: false, unlockTier: 0 });
  run.money = 14; run.phase = 'shop';
  run.maxims = ['chivalry', 'first_move', 'diagonal'].map((id, k) => ({ id, uid: 100 + k, data: {} }));
  run.shop = { rng: fork(createRng(3), 'test-shop'), display: [], packs: [], rerolls: 0, promoted: false, removed: false };
  app.run = run;
  app.go('shop'); tick(app);
  return run;
}
const mid = (r) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];

test('끊긴 손가락(touchcancel): 끌던 격언은 제자리, 누르던 단추도 눌리지 않는다(P-10)', async () => {
  const app = await fresh();
  const run = shopRun(app);
  const order = run.maxims.map((m) => m.id);
  const r = app.ui.regions.find((q) => q.id === 'maxim:2');
  // 진짜 손가락 사건으로(main.js): 누르고 → 위로 끌다가 → 끊김
  const [x, y] = mid(r);
  const fire = (type, gx, gy) => { const t = { identifier: 7, ...dom.clientOf(gx, gy) }; for (const fn of dom.screen.listeners[type] || []) fn({ cancelable: true, preventDefault() {}, touches: type === 'touchstart' ? [t] : [], changedTouches: [t] }); };
  fire('touchstart', x, y); fire('touchmove', x, y - 30);
  assert.ok(app.ui.drag && app.ui.drag.moved, '끄는 중');
  fire('touchcancel', x, y - 30); tick(app);
  assert.deepEqual(run.maxims.map((m) => m.id), order, '순서 그대로');
  assert.equal(app.ui.drag, null);
  assert.equal(app.ui.hover, null);
  assert.equal(app.screen.name, 'shop');
});

test('수정 키(Cmd · Ctrl · Alt)가 낀 키 · 수정 키 혼자는 게임이 받지 않는다(P-11)', async () => {
  const app = await fresh();
  app.newRun(); tick(app, 120);
  assert.equal(app.screen.name, 'draft');
  dom.key('1', { metaKey: true }); dom.key('1', { ctrlKey: true }); dom.key('1', { altKey: true }); dom.key('Shift'); dom.key('Meta');
  tick(app);
  assert.equal(app.screen.chosen, null, '단축키로 레퍼토리가 골라지지 않는다');
  dom.key('1'); tick(app);
  assert.ok(app.screen.chosen, '맨 숫자 키는 고른다');
});

test('상점에 막 들어온 Enter는 받지 않는다 — 보상 화면 Enter 연타로 상점을 지나가지 않게(P-11)', async () => {
  const app = await fresh();
  shopRun(app);
  app.key('Enter'); tick(app);
  assert.equal(app.screen.name, 'shop', '들어오자마자 Enter');
  tick(app, 40); // 0.64초
  app.key('Enter'); tick(app);
  assert.notEqual(app.screen.name, 'shop', '조금 뒤 Enter는 다음 대국');
});

test('「다음 대국」 곁 빈 자리를 손가락으로 빗눌러도 「다음 대국」으로 붙지 않는다(P-5)', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const ui = new UI();
  ui.touch = true; ui.finger = 35;
  ui.begin();
  ui.region('leave', 100, 0, 60, 18, { onClick: () => {}, nosnap: true });
  ui.region('chip', 200, 0, 15, 15, { onClick: () => {} });
  ui.end();
  assert.deepEqual(ui.snap('down', 130, 22), [130, 22], 'nosnap 구역에는 붙지 않는다');
  assert.deepEqual(ui.snap('down', 195, 5), [200, 5], '다른 작은 구역에는 그대로 붙는다');
  assert.deepEqual(ui.snap('down', 130, 10), [130, 10], '단추 위 누름은 그대로');
});

test('손가락: 창 끝에 가까운 단추는 누르는 구역이 캔버스 끝 너머까지(첫 화면 아이콘 줄 · 상점 위 띠 · 탭 · 수업 단추), 이웃과 겹치지 않는다(P-2 · P-13)', async () => {
  const app = await fresh();
  app.touch = true; app.pixelScale = 734 * 3 / 3 / 480; // 아이폰 가로 꽉 채움(도트 하나 ≈ 1.18 CSS 화소)
  const reg = (id) => app.ui.regions.find((r) => r.id === id);
  const clash = (ids) => {
    const rs = app.ui.regions.filter((r) => !r.passive && r.onClick && ids.some((p) => r.id.startsWith(p)));
    for (const a of rs) for (const b of rs) if (a !== b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return `${a.id} × ${b.id}`;
    return null;
  };
  app.toTitle(); tick(app);
  assert.ok(reg('title:lesson').y + reg('title:lesson').h > 270, '첫 화면 아이콘 줄은 캔버스 밑으로');
  assert.equal(clash(['title:']), null);
  shopRun(app);
  assert.ok(reg('shop:leave').y < 0 && reg('shop:reroll').y < 0, '상점 위 띠는 캔버스 위로');
  app.go('records'); tick(app);
  assert.ok(reg('records:tab:stats').y < 0, '탭은 캔버스 위로');
  assert.equal(clash(['records:']), null);
  app.go('codex'); tick(app);
  assert.ok(reg('codex:tab:pieces') ? reg('codex:tab:pieces').y < 0 : app.ui.regions.some((r) => r.id.startsWith('codex:tab:') && r.y < 0));
  assert.equal(clash(['codex:tab:']), null);
});
