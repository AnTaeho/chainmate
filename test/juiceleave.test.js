// 손맛 연출의 뒤처리(layout.md 28절): 화면을 떠나면 판 위 연출 · 날던 동전을 거두고, 마스터 등장은 대국을 처음 열 때만,
// 등장 중에도 멈춤이 열리고, 움직임 줄이기에서는 상금 동전을 날리지 않으며, 상금 떨림 기준은 판마다 새로 잡는다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

let dom, boot;
before(async () => {
  dom = await installDom();
  ({ boot } = await import('../src/main.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });
const fresh = async () => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, tutorialAsked: true, runs: 1 }));
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  return app;
};
// 마스터 대국을 관 선택에서 연다(1관 세 번째 대국)
const masterBattle = (app) => {
  app.newRun({ seed: 3 });
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.run.blind = 2;
  app.goPhase(); tick(app);
  app.screen.play(); tick(app);
  return app.screen;
};

test('마스터 등장: 대국을 열 때만 서고, 이어 하기로 연 대국에는 다시 서지 않는다', async () => {
  const app = await fresh();
  const s = masterBattle(app);
  assert.equal(s.name, 'battle');
  assert.ok(s.intro, '대국 시작에 등장 장면');
  app.continueRun(); tick(app);
  assert.equal(app.screen.name, 'battle');
  assert.ok(!app.screen.intro, '이어 하기에는 등장 장면이 없다');
});

test('마스터 등장 중에도 멈춤 단추 · Esc는 곧바로 멈춤을 연다', async () => {
  const app = await fresh();
  const s = masterBattle(app);
  const regs = app.ui.regions;
  const pause = regs.find((r) => r.id === 'btn:pause'), intro = regs.find((r) => r.id === 'intro');
  assert.ok(pause && intro);
  assert.ok(regs.indexOf(pause) > regs.indexOf(intro), '멈춤 구역이 장면 구역 위');
  assert.equal(app.ui.hitIn(regs, pause.x + 2, pause.y + 2).id, 'btn:pause');
  app.key('Escape'); tick(app);
  assert.equal(app.overlay && app.overlay.name, 'pause');
  assert.ok(s.intro, '장면은 멈춤 밑에 그대로');
  app.closeOverlay(); tick(app);
  app.key('Enter'); tick(app);
  assert.equal(s.intro, null, '다른 키는 장면을 넘긴다');
});

test('대국을 떠나면 판 위 연출(연기 · 조각 · 동전)은 사라지고 색종이만 남는다 · 보상을 떠나면 날던 동전도', async () => {
  const app = await fresh();
  const s = masterBattle(app);
  s.endIntro();
  s.coinFx(3);
  s.shatter(27, 'P', 'b');
  s.winFx();
  assert.ok(app.fx.list.some((e) => e.coin) && app.fx.list.some((e) => e.confetti));
  const n = app.fx.list.length;
  app.go('codex');
  assert.ok(app.fx.list.length > 0 && app.fx.list.length < n);
  assert.ok(app.fx.list.every((e) => e.confetti), '색종이만');
  // 보상: 날던 동전을 거둔다
  app.fx.clear();
  app.go('reward', { reward: { base: 3, total: 3 }, events: [] });
  for (let i = 0; i < 30; i++) tick(app, 1);
  assert.ok(app.fx.list.some((e) => e.coin), '보상 동전이 난다');
  app.go('shop');
  assert.equal(app.fx.list.filter((e) => e.coin).length, 0);
});

test('움직임 줄이기: 대국 상금은 동전 없이 상금 수만 떤다', async () => {
  const app = await fresh();
  const s = masterBattle(app);
  s.endIntro();
  app.settings.calm = true; tick(app);
  assert.equal(app.reducedMotion, true);
  app.fx.clear();
  s.coinFx(4);
  assert.equal(app.fx.list.filter((e) => e.coin).length, 0);
});

test('상금 떨림: 판이 바뀌면 첫 그림에서 흔들지 않고 기준만 잡는다', async () => {
  const { moneyShake } = await import('../src/ui/juice.js');
  const a = { money: 4 }, b = { money: 20 };
  assert.equal(moneyShake(a.money, 10, a), null);
  assert.ok(moneyShake(7, 11, a), '같은 판에서 바뀌면 흔들린다');
  assert.equal(moneyShake(b.money, 12, b), null, '다른 판의 첫 그림은 흔들지 않는다');
  assert.equal(moneyShake(b.money, 12.1, b), null);
});
