// 처음 켬과 튜토리얼(docs/design-notes/tutorial.md): 기록이 빈 사람에게 첫 화면이 튜토리얼을 권하고, 첫 판은 대본 없는 평범한 판이다.
// 튜토리얼에서 가르친 도움말 팁은 판 안에서 다시 뜨지 않는다. 없앤 첫 판 대본 대국 도중의 옛 저장은 평범한 1관 첫머리로 돌아온다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { createRun, applyRun, migrateRun, blindInfo } from '../src/sim/run.js';
import { KEYS } from '../src/ui/save.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// 배포 전 저장 꼴: 레퍼토리 고르기를 미루고(draftLate) 킹과 두던 1관 연습 도중(run.script · battle.script)
function oldScriptSave(seed) {
  const run = createRun({ seed });
  run.draft = null; run.phase = 'select'; run.script = 'king'; run.draftLate = 1;
  applyRun(run, { type: 'play' });
  run.battle.script = 'king';
  run.battle.plan = [[], [], [{ sq: 43, t: 'Q' }], []];
  return clone(run);
}

test('옛 저장: 대본 대국 도중이면 그 대국을 접고 평범한 판의 1관 첫머리(레퍼토리 고르기)부터', () => {
  for (const seed of [1, 7]) {
    const run = migrateRun(oldScriptSave(seed));
    assert.equal(run.script, undefined);
    assert.equal(run.draftLate, undefined);
    assert.equal(run.battle, null);
    assert.equal(run.phase, 'draft', '미뤘던 1관 레퍼토리 고르기가 열린다');
    assert.equal(run.ante, 1); assert.equal(run.blind, 0);
    applyRun(run, { type: 'joseki', index: 0 });
    assert.equal(run.phase, 'select');
    applyRun(run, { type: 'play' });
    assert.equal(run.battle.script, undefined);
    assert.equal(run.battle.plan, undefined);
    assert.equal(run.battle.target, blindInfo(run).target, '목표는 평소 1관 연습');
  }
  // 대본이 없는 저장은 그대로
  const plain = createRun({ seed: 3 });
  assert.deepEqual(migrateRun(clone(plain)).phase, plain.phase);
});

// ── 앱
let dom, boot;
before(async () => {
  dom = await installDom();
  ({ boot } = await import('../src/main.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });
const fresh = async (records = null) => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  if (records) dom.store.set(KEYS.records, JSON.stringify({ v: 1, ...records }));
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  return app;
};

test('옛 저장을 이어 하면 레퍼토리 고르기 화면부터', async () => {
  const app = await fresh({ runs: 1, tutorialAsked: true });
  dom.store.set(KEYS.run, JSON.stringify(oldScriptSave(5)));
  assert.equal(app.continueRun(), true);
  tick(app);
  assert.equal(app.screen.name, 'draft');
  assert.equal(app.run.script, undefined);
});

test('처음 켜면 첫 화면 위에 킹이 튜토리얼을 권한다 → 「튜토리얼부터」는 첫 수업', async () => {
  const app = await fresh();
  assert.equal(app.screen.name, 'title');
  assert.equal(app.overlay && app.overlay.name, 'welcome');
  app.ui.regions.find((r) => r.id === 'welcome:lesson').onClick();
  tick(app);
  assert.equal(app.overlay, null);
  assert.equal(app.records.tutorialAsked, true);
  assert.equal(app.screen.name, 'lesson');
  assert.equal(app.screen.index, 0);
  assert.equal(app.lessonFrom, 'welcome');
  // 「건너뛰기」: 곧바로 평범한 첫 판(레퍼토리 고르기부터)
  app.ui.regions.find((r) => r.id === 'lesson:skip').onClick();
  tick(app);
  assert.equal(app.screen.name, 'draft');
  assert.ok(app.run && !app.run.script && !app.run.scratch);
});

test('「바로 시작」은 평범한 첫 판, Esc는 덮개만 닫는다(이번 실행 동안)', async () => {
  let app = await fresh();
  app.ui.regions.find((r) => r.id === 'welcome:play').onClick();
  tick(app);
  assert.equal(app.screen.name, 'draft');
  assert.equal(app.records.tutorialAsked, true);
  assert.ok(app.run.phase === 'draft' && !app.run.script);
  // 한 번 고르면 다시 권하지 않는다
  app.toTitle(); tick(app);
  assert.equal(app.overlay, null);
  // Esc: 닫고, 다시 켜면 또 권한다
  app = await fresh();
  app.key('Escape'); tick(app);
  assert.equal(app.overlay, null);
  assert.equal(app.records.tutorialAsked, false);
  app.go('codex'); app.toTitle(); tick(app);
  assert.equal(app.overlay, null, '이번 실행 동안은 다시 안 뜬다');
  app = await fresh();
  assert.equal(app.overlay && app.overlay.name, 'welcome');
  // 판 기록이 있거나 이미 권했으면 뜨지 않는다
  assert.equal((await fresh({ runs: 2 })).overlay, null);
  assert.equal((await fresh({ tutorialAsked: true })).overlay, null);
  // 튜토리얼을 다 끝냈으면 뜨지 않는다(lessonsDone은 lessonsSeen이 모든 수업을 덮을 때만 참)
  const { LESSONS } = await import('../src/ui/lessons.js');
  assert.equal((await fresh({ lessonsSeen: Object.fromEntries(LESSONS.map((L) => [L.id, true])) })).overlay, null);
  assert.equal((await fresh({ lessonsDone: true, lessonsSeen: { [LESSONS[0].id]: true } })).overlay.name, 'welcome', '첫 수업만 끝낸 옛 참은 다 끝낸 것이 아니다');
});

test('덮개 오른쪽 위 「×」는 Esc와 같다: 덮개만 닫고(튜토리얼을 권한 것으로 적지 않는다) 다음에 켜면 다시 권한다', async () => {
  let app = await fresh();
  const close = app.ui.regions.find((r) => r.id === 'welcome:close');
  assert.ok(close, '닫기 단추가 있다');
  // 덮개 상자 오른쪽 위 구석 안
  const lesson = app.ui.regions.find((r) => r.id === 'welcome:lesson');
  assert.ok(close.x + close.w === lesson.x + lesson.w && close.y < lesson.y, '오른쪽 위');
  close.onClick();
  tick(app);
  assert.equal(app.overlay, null);
  assert.equal(app.welcomeShut, true);
  assert.equal(app.records.tutorialAsked, false);
  assert.equal(app.screen.name, 'title');
  app = await fresh();
  assert.equal(app.overlay && app.overlay.name, 'welcome', '다시 켜면 또 권한다');
});

test('튜토리얼 목록: 「이어서」는 안 끝낸 첫 수업부터, 마지막 수업을 끝내면 끝 카드 → 「새 판」', async () => {
  const { LESSONS } = await import('../src/ui/lessons.js');
  const { lessonDone } = await import('../src/ui/screens/lessons.js');
  const app = await fresh({ tutorialAsked: true });
  app.go('lessons'); tick(app);
  assert.equal(app.ui.regions.find((r) => r.id === 'lessons:go') && app.screen.name, 'lessons');
  app.records.lessonsSeen = { [LESSONS[0].id]: true, [LESSONS[1].id]: true };
  tick(app);
  app.ui.regions.find((r) => r.id === 'lessons:go').onClick();
  tick(app);
  assert.equal(app.screen.name, 'lesson');
  assert.equal(app.screen.index, 2);
  assert.equal(app.lessonFrom, 'flow');
  // 흐름: 끝내면 다음 안 끝낸 수업
  lessonDone(app, 2); tick(app);
  assert.equal(app.screen.index, 3);
  // 나머지를 끝낸 것으로 두고 마지막 하나를 끝내면 끝 카드
  const last = LESSONS.length - 1;
  for (const L of LESSONS.slice(0, last)) app.records.lessonsSeen[L.id] = true;
  lessonDone(app, last); tick(app);
  assert.equal(app.screen.name, 'lessons');
  assert.equal(app.screen.end, true);
  assert.equal(app.records.lessonsDone, true);
  assert.ok(app.ui.regions.some((r) => r.id === 'lessons:play'));
  app.ui.regions.find((r) => r.id === 'lessons:play').onClick();
  tick(app);
  assert.equal(app.screen.name, 'draft', '새 판은 평범한 판(레퍼토리 고르기부터)');
});

// 손가락 기기(CHM-52): 덮개 단추의 누르는 구역은 44pt까지 넓어지고 서로 겹치지 않는다(그림은 그대로)
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fingerCheck = (app, ids) => {
  for (const ps of [1, 4 / 3]) {
    app.coarse = true; app.pixelScale = ps; tick(app);
    const need = app.ui.finger, rs = ids.map((id) => app.ui.regions.find((r) => r.id === id));
    assert.ok(need >= 33, `finger ${need}`);
    rs.forEach((r, i) => assert.ok(r && r.w >= need && r.h >= need, `${ids[i]} ${r && r.w}×${r && r.h} < ${need}`));
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!overlap(rs[i], rs[j]), `${ids[i]} · ${ids[j]} 겹침`);
  }
};
test('손가락 기기: 처음 켬 덮개 「×」 · 「바로 시작」 · 「튜토리얼부터」와 튜토리얼 끝 카드 「목록」 · 「새 판」은 44pt 구역, 서로 겹치지 않는다', async () => {
  let app = await fresh();
  assert.equal(app.overlay && app.overlay.name, 'welcome');
  fingerCheck(app, ['welcome:close', 'welcome:play', 'welcome:lesson']);
  app = await fresh({ tutorialAsked: true });
  app.go('lessons'); tick(app);
  app.screen.end = true; tick(app);
  fingerCheck(app, ['lessons:list', 'lessons:play']);
});

test('튜토리얼에서 가르친 도움말 팁은 그 수업을 끝낸 사람에게 판 안에서 뜨지 않는다', async () => {
  const { hint, TAUGHT, HINTS } = await import('../src/ui/coach.js');
  const { LESSON_BY_ID } = await import('../src/ui/lessons.js');
  for (const [id, lesson] of Object.entries(TAUGHT)) { assert.ok(HINTS[id], id); assert.ok(LESSON_BY_ID[lesson], lesson); }
  const app = await fresh({ tutorialAsked: true });
  app.hintNow = null;
  hint(app, 'incoming', 'sq:1');
  assert.equal(app.hintNow.length, 1, '「바로 시작」한 사람에게는 뜬다');
  app.hintNow = null;
  app.records.lessonsSeen = { reinforce: true };
  hint(app, 'incoming', 'sq:1');
  hint(app, 'next', 'next');
  assert.deepEqual(app.hintNow.map((c) => c.id), ['next'], '튜토리얼에 없는 것만');
});

test('처음 안내가 떠 있는 동안 설명 묶음이 그 위를 덮지 않고, 손가락 가리킴은 화면이 바뀌면 지워진다(U-4 · P-12)', async () => {
  const app = await fresh({ tutorialAsked: true });
  app.newRun(); tick(app);
  assert.equal(app.screen.name, 'draft');
  const card = () => app.ui.regions.find((r) => r.id === 'draft:0');
  const at = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  // 마우스로 카드를 가리킨 채: 레퍼토리 안내가 떠 있으면 카드 설명 묶음은 없다
  app.pointer('move', ...at(card())); tick(app, 90); // 카드가 다 뒤집힌 뒤(1.2초) 안내가 뜬다
  assert.equal(app.hintShown && app.hintShown.id, 'draft');
  assert.equal(app.noteStack, null, '안내가 떠 있는 동안 설명 묶음 없음');
  // 아무 데나 한 번 누르면 안내는 본 것으로 사라지고, 그 뒤에는 카드 설명이 뜬다
  app.pointer('down', 2, 2); app.pointer('up', 2, 2); app.pointer('move', ...at(card())); tick(app);
  assert.equal(app.hintShown, null);
  assert.ok(app.records.coachSeen.draft);
  assert.ok(app.noteStack && app.noteStack.rects.length, '안내가 없으면 설명 묶음');
  // 손가락: 뗀 자리의 가리킴은 같은 화면 안에서만 남는다(누르면 설명). 화면이 바뀌면 지운다
  app.touch = true;
  app.pointer('move', ...at(card())); tick(app);
  assert.equal(app.ui.hover && app.ui.hover.id, 'draft:0');
  app.go('draft'); tick(app);
  assert.equal(app.ui.hover, null);
  assert.equal(app.noteStack, null, '다음 화면의 같은 자리 카드에 설명이 저절로 뜨지 않는다');
  // 마우스는 그대로 남는다
  app.touch = false;
  app.pointer('move', ...at(card())); app.go('draft'); tick(app);
  assert.equal(app.ui.hover && app.ui.hover.id, 'draft:0');
});

test('설정 「움직임 줄이기」는 기기 설정이 없어도 켠다', async () => {
  const app = await fresh({ tutorialAsked: true });
  const { LOOK } = await import('../src/render/look.js');
  assert.equal(app.reducedMotion, false);
  app.settings.calm = true; tick(app);
  assert.equal(app.reducedMotion, true);
  assert.equal(LOOK.calm, true);
  app.settings.calm = false; tick(app);
  assert.equal(LOOK.calm, false);
});
