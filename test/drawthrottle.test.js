// 그릴 때만 그린다(CHM-75, layout.md 「빛과 움직임」): 멈춘 화면은 건너뛰고, 입력 · 알림 · 움직이는 그림 · 흐르는 배경의 한 칸 · 배율이 그리게 한다.
// 실제 화소 견주기는 tools/drawcheck.mjs(브라우저)가 한다 — 여기서는 판단만
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

let dom, createApp, LOOK, sway;
before(async () => {
  dom = await installDom();
  ({ createApp } = await import('../src/ui/app.js'));
  ({ LOOK } = await import('../src/render/look.js'));
  sway = await import('../src/ui/sway.js');
});
after(() => { delete globalThis.document; delete globalThis.window; });

function makeApp({ calm = true } = {}) {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify({ v: 1, lessonsDone: true, tutorialAsked: true, coachSeen: { bigText: true, telemetry: true, rankName: true } }));
  dom.store.set(KEYS.settings, JSON.stringify({ volume: 0, music: 0, calm, telemetry: false }));
  const app = createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage, alwaysDraw: false });
  let t = 0;
  app.tick = (n = 1) => { const d0 = app.stats.drawn || 0; for (let i = 0; i < n; i++) { t += 1000 / 60; app.frame(t); } return (app.stats.drawn || 0) - d0; };
  return app;
}

test('멈춘 화면(도감 · 움직임 줄이기): 두 번 그린 뒤 건너뛴다 — 시계는 그대로 간다', () => {
  const app = makeApp();
  app.go('codex');
  assert.equal(app.tick(2), 2, '바뀐 뒤 · 그 다음 한 번');
  const t0 = app.time;
  assert.equal(app.tick(120), 0);
  assert.ok(app.time - t0 > 1.9, '그리지 않아도 시간은 흐른다');
  assert.equal(app.lastWant, false);
});

test('입력 · 알림 · 화면 바뀜 · 배율은 그리게 하고, 알림이 사라진 뒤 한 번 더 그린다', () => {
  const app = makeApp();
  app.go('codex'); app.tick(5);
  app.pointer('move', 100, 100);
  assert.equal(app.tick(5), 2);
  app.toast('알림');
  const n = app.tick(60 * 3);
  assert.ok(n > 120 && n < 60 * 3, `알림 동안 그린다(${n})`);
  assert.equal(app.toasts.length, 0);
  assert.equal(app.tick(30), 0, '사라진 뒤에는 쉰다');
  app.setScale(2);
  assert.ok(app.tick(3) >= 1, '캔버스 크기를 바꾸면 그린다');
  app.openOverlay('settings');
  assert.ok(app.tick(3) >= 1);
  assert.equal(app.tick(30), 0, '설정 덮개도 멈춘 화면');
});

test('바탕은 흐르지 않아(안 3) 멈춘 화면은 움직임 줄이기가 아니어도 쉰다 · 움직이는 화면(첫 화면)은 프레임마다', () => {
  const app = makeApp({ calm: false });
  app.go('codex'); app.tick(5);
  const n = app.tick(120);
  assert.equal(n, 0, `2초에 ${n}번`);
  app.go('title');
  assert.equal(app.tick(60), 60);
  assert.ok(LOOK.flow > 0);
});

test('움직이는 그림을 그린 프레임 다음은 그린다(live) · 카드 들림은 건너뛴 프레임에도 시각만 옮긴다', async () => {
  const { live } = await import('../src/render/look.js');
  const app = makeApp();
  app.go('codex'); app.tick(5);
  let moving = true;
  const draw = app.screen.draw.bind(app.screen);
  app.screen.draw = (ctx, ui) => { draw(ctx, ui); if (moving) live(); };
  app.invalidate();
  assert.equal(app.tick(30), 30, '움직이는 동안 프레임마다');
  moving = false;
  assert.equal(app.tick(30), 1, '멈춘 뒤 한 번');
  // 카드 들림: 가만히 있던 카드를 오래 건너뛴 뒤 가리키면, 그 첫 그림은 한 프레임만큼만 들린다(늘 그릴 때와 같다)
  const ctx = { lift: 0, save() {}, restore() {}, translate(_, y) { this.lift = y; }, fillRect() {}, globalAlpha: 1, fillStyle: '' };
  sway.swayBegin(app.time);
  sway.sway(ctx, app.time, 'test:card', 0, 0, 10, 10, () => {}, { shadow: false });
  for (let i = 0; i < 90; i++) { app.time += 1 / 60; sway.swaySettle(app.time); }
  app.time += 1 / 60;
  sway.swayBegin(app.time);
  sway.sway(ctx, app.time, 'test:card', 0, 0, 10, 10, () => {}, { hover: true, shadow: false });
  assert.ok(ctx.lift < 0 && ctx.lift > -1, `한 프레임만큼(${ctx.lift})`);
});

test('계단처럼 바뀌는 그림(beat)은 바뀌는 때만 그린다', async () => {
  const { beat } = await import('../src/render/look.js');
  const app = makeApp();
  app.go('codex'); app.tick(5);
  const seen = [];
  const draw = app.screen.draw.bind(app.screen);
  app.screen.draw = (ctx, ui) => { draw(ctx, ui); seen.push(beat(app.time, 3)); };
  app.invalidate();
  const n = app.tick(120);
  assert.equal(n, 2 + 6, `바뀐 뒤 둘 + 2초에 초당 3번 계단(${n}번)`);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] - seen[i - 1] <= 1, '계단을 건너뛰지 않는다');
});

test('대국(움직임 줄이기): 쉬면 건너뛰고, 손 들썩임이 켜지는 프레임은 그린다 · 막대 시각은 건너뛴 프레임에도 옮긴다', () => {
  const app = makeApp();
  app.nextSeed = 11; app.newRun();
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.run.ante = 3; app.run.blind = 0;
  app.cmd({ type: 'play' });
  app.run.battle.incoming = []; // 증원 그림자(초당 3번 들썩임)를 치워 멈춘 판으로
  app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
  app.go('battle', { events: [] });
  const s = app.screen;
  app.tick(10);
  s.idleT = -1e9;
  assert.equal(app.tick(60), 0, '멈춘 판은 그리지 않는다');
  s.idleT = 2.5 - 1 / 120;
  app.tick(1);
  assert.equal(app.lastWant, true, '들썩임이 켜지는 프레임');
  assert.ok(app.tick(60) <= 4, '들썩임은 초당 3번 계단');
  s.idleT = -1e9; app.tick(5);
  s.bar = { v: 1, t: 0, tgt: s.view.target };
  app.tick(30);
  assert.ok(Math.abs(s.bar.t - app.time) < 1e-9, '건너뛴 프레임에도 막대 시각이 따라온다');
});
