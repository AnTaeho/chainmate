// 첫 판 대본 대국(CHM-22): 걸음대로 두면 실제 규칙(세력 버릇 포함)으로 목표를 넘기고, 건너뛰면 평범한 1관 연습이 된다.
// 처음 켜면 수업을 거치지 않고 타이틀 → 「새 판」이 곧바로 대본 대국, 설정 「킹과 다시 두기」가 다음 새 판을 대본으로 켠다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { createRun, applyRun, blindInfo } from '../src/sim/run.js';
import { apply, dropSquaresFor, createBattle } from '../src/sim/battle.js';
import { chainCaptures } from '../src/sim/chain.js';
import { SCRIPT } from '../src/data/tutorial.js';
import { TUTORIAL_STEPS as STEPS, stepSq, firstStepOf } from '../src/ui/tutorial.js';
import { BOARD_TUNING } from '../src/sim/tuning.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// 대본 화면과 같은 방식으로 걸음을 밟는다(try부터 rewind까지는 대국 복사본에서)
function walk(run, steps = STEPS) {
  let scratch = null, sel = null;
  const log = [];
  const b = () => scratch || run.battle;
  // 복사본에서 둔 수의 사건은 적지 않는다(진짜 대국의 사건만)
  const cmd = (c) => (scratch ? (apply(scratch, c), []) : applyRun(run, c));
  steps.forEach((st, k) => {
    const where = `걸음 ${k} ${st.say}`;
    if (st.try) scratch = clone(run.battle);
    if (st.end) return;
    if (st.ok) { if (st.rewind) scratch = null; return; }
    if (st.moves) return;
    if (st.pick) { sel = b().hand.findIndex((p) => p.t === st.pick); assert.ok(sel >= 0, `${where}: 손에 ${st.pick}`); assert.equal(b().status, 'play', where); return; }
    if (st.discard) { log.push(cmd({ type: 'discard', handIndices: [sel] })); sel = null; return; }
    if (st.drop) {
      assert.ok(dropSquaresFor(b(), b().hand[sel]).includes(stepSq(st)), `${where}: 떨굴 수 있는 칸`);
      log.push(cmd({ type: 'drop', handIndex: sel, sq: stepSq(st) }));
      sel = null;
      return;
    }
    if (st.cap) {
      assert.equal(b().status, 'chain', where);
      assert.ok(chainCaptures(b()).includes(stepSq(st)), `${where}: 먹을 수 있는 적`);
      log.push(cmd({ type: 'capture', sq: stepSq(st) }));
    }
  });
  return log.flat();
}

test('대본 대국: 걸음대로 두면 실제 규칙으로 목표를 넘기고, 판에 평소처럼 든다', () => {
  for (const seed of [1, 7, 12345]) {
    const run = createRun({ seed, script: true });
    assert.equal(run.phase, 'select', '레퍼토리 고르기는 대본 대국 뒤로');
    applyRun(run, { type: 'play' });
    const b = run.battle;
    assert.equal(b.script, 'king');
    assert.ok(b.rules.pawnSides, '세력 버릇(농민군)이 켜져 있다');
    assert.equal(b.rules.reboards, 0, '다시 놓기는 끈다');
    assert.equal(b.target, SCRIPT.target);
    assert.deepEqual(b.hand.map((p) => p.t), SCRIPT.hand);
    const ev = walk(run);
    const ends = ev.filter((e) => e.type === 'end');
    assert.deepEqual(ends.map((e) => e.reason), ['blocked', 'blocked', 'blocked', 'blocked'], '진짜 대국의 네 수는 막혀서 끝난다');
    assert.ok(ev.some((e) => e.type === 'reinforce'), '③ 뒤 증원이 들어온다');
    assert.ok(ev.some((e) => e.type === 'win'), '넷째 수로 이긴다');
    assert.equal(run.battle, null);
    const row = run.log.at(-1);
    assert.equal(row.won, true);
    assert.equal(row.target, SCRIPT.target, '기록의 목표는 대본 목표');
    assert.ok(row.score >= SCRIPT.target && row.moves === 4);
    assert.equal(run.phase, 'shop', '이기면 평소처럼 상점');
    assert.ok(run.money > 4, '보상이 든다');
    assert.equal(run.script, null, '대본은 한 번');
    // 뒤로 미룬 레퍼토리 고르기는 다음 대국 앞에
    applyRun(run, { type: 'leave' });
    assert.equal(run.phase, 'draft');
    assert.equal(run.blind, 1);
    applyRun(run, { type: 'joseki', index: 0 });
    assert.equal(run.phase, 'select');
    // 셋째 수까지는 목표에 못 닿는다(네 수를 다 둔다)
    const early = createRun({ seed, script: true });
    applyRun(early, { type: 'play' });
    walk(early, STEPS.filter((s) => s.move < 3));
    assert.ok(early.battle && early.battle.score < SCRIPT.target, `셋째 수까지 ${early.battle && early.battle.score}`);
  }
});

test('대본 대국 ②: 룩부터 먹으면 끊기고, 복사본이라 진짜 대국은 그대로', () => {
  const run = createRun({ seed: 3, script: true });
  applyRun(run, { type: 'play' });
  walk(run, STEPS.filter((s) => s.move === 0));
  const before = JSON.stringify(run.battle);
  const t = STEPS.findIndex((s) => s.try), rw = STEPS.findIndex((s) => s.rewind);
  let scratch = clone(run.battle), sel = null, ev = [];
  for (const st of STEPS.slice(t, rw)) {
    if (st.pick) sel = scratch.hand.findIndex((p) => p.t === st.pick);
    else if (st.drop) ev = ev.concat(apply(scratch, { type: 'drop', handIndex: sel, sq: stepSq(st) }));
    else if (st.cap) ev = ev.concat(apply(scratch, { type: 'capture', sq: stepSq(st) }));
  }
  assert.ok(ev.some((e) => e.type === 'cut'), '끊김');
  assert.equal(JSON.stringify(run.battle), before, '진짜 대국은 그대로');
});

test('대본 대국 ④: 폰은 떨굴 곳이 없다(바쳐야 한다)', () => {
  const run = createRun({ seed: 5, script: true });
  applyRun(run, { type: 'play' });
  walk(run, STEPS.filter((s) => s.move < 3));
  const b = run.battle;
  assert.deepEqual(b.hand.map((p) => p.t), ['P', 'P', 'P', 'P']);
  for (const p of b.hand) assert.equal(dropSquaresFor(b, p).length, 0);
});

test('건너뛰면 평범한 1관 연습: 대본 없는 판과 같은 대국', () => {
  for (const seed of [2, 9]) {
    const run = createRun({ seed, script: true });
    applyRun(run, { type: 'play' });
    // 첫 수를 둔 뒤에도 건너뛸 수 있다
    walk(run, STEPS.filter((s) => s.move === 0));
    const ev = applyRun(run, { type: 'unscript' });
    assert.ok(ev.some((e) => e.type === 'battleStart'));
    const b = run.battle;
    assert.equal(b.script, undefined);
    assert.equal(run.script, null);
    const info = blindInfo(run);
    assert.equal(b.target, info.target, '목표는 평소 1관 연습');
    assert.equal(b.movesUsed, 0);
    assert.equal(b.rules.reboards, run.rules.reboards ?? 1, '다시 놓기가 돌아온다');
    // 대본 없이 시작한 같은 시드의 판과 같은 대국판
    const plain = createRun({ seed });
    applyRun(plain, { type: 'joseki', index: 0 });
    applyRun(plain, { type: 'play' });
    assert.deepEqual(b.board.map((c) => c && c.t), plain.battle.board.map((c) => c && c.t));
    assert.throws(() => applyRun(run, { type: 'unscript' }), /not a scripted battle/);
  }
});

test('대본은 기본 오프닝 · 단 0 판의 1관 연습 하나뿐', () => {
  assert.equal(createRun({ seed: 1, script: true, opening: 'london' }).script, undefined);
  assert.equal(createRun({ seed: 1, script: true, dan: 2 }).script, undefined);
  assert.equal(createRun({ seed: 1 }).script, undefined);
  assert.equal(firstStepOf(0), 0);
  assert.ok(STEPS.every((s) => s.say && s.say.length <= 40), '킹의 말은 짧게');
});

// ── 앱: 첫 실행 · 킹과 다시 두기
let dom, boot;
before(async () => {
  dom = await installDom();
  ({ boot } = await import('../src/main.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });

test('첫 실행은 수업을 거치지 않는다: 타이틀 → 새 판 → 곧바로 대본 대국', async () => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  assert.equal(app.screen.name, 'title');
  assert.ok(!app.visited.has('lesson') && !app.visited.has('lessons'));
  app.screen.items().find(([id]) => id === 'title:new')[2]();
  tick(app);
  assert.equal(app.screen.name, 'battle');
  assert.equal(app.run.battle.script, 'king');
  assert.equal(app.screen.src.kind, 'script');
  assert.ok(app.guide, '킹이 이끈다');
  assert.ok(!app.visited.has('lesson') && !app.visited.has('select') && !app.visited.has('draft'));
  // 건너뛰기: 평범한 대국 화면
  app.guide.skip();
  tick(app);
  assert.equal(app.screen.name, 'battle');
  assert.equal(app.screen.src.kind, 'run');
  assert.equal(app.run.battle.script, undefined);
  assert.equal(app.guide, null);
  // 두 번째 새 판은 평소대로(오프닝 고르기부터)
  app.toTitle(); tick(app);
  assert.equal(app.wantsScript(), false);
});

test('설정 「킹과 다시 두기」가 다음 새 판을 대본으로 켠다', async () => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  const app = await boot({ window: dom.window, document: dom.document });
  app.records.runs = 3; app.records.lessonsDone = true; app.records.kingDone = true;
  assert.equal(app.wantsScript(), false);
  app.openOverlay('settings'); tick(app);
  app.ui.regions.find((r) => r.id === 'set:king').onClick();
  assert.equal(app.records.kingAgain, true);
  app.closeOverlay();
  app.screen.items().find(([id]) => id === 'title:new')[2]();
  tick(app);
  assert.equal(app.run.battle && app.run.battle.script, 'king');
  assert.equal(app.records.kingAgain, false, '한 번 켜면 한 판');
});

test('설정 「움직임 줄이기」는 기기 설정이 없어도 켠다', async () => {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  const app = await boot({ window: dom.window, document: dom.document });
  const { LOOK } = await import('../src/render/look.js');
  assert.equal(app.reducedMotion, false);
  app.settings.calm = true; tick(app);
  assert.equal(app.reducedMotion, true);
  assert.equal(LOOK.calm, true);
  app.settings.calm = false; tick(app);
  assert.equal(LOOK.calm, false);
});

test('대본 대국의 판 조정: 켜 둔 거르기와 상관없이 정해 둔 판', () => {
  const keep = { ...BOARD_TUNING };
  try {
    for (const f of [0, 4]) {
      BOARD_TUNING.filter = f;
      const run = createRun({ seed: 11, script: true });
      applyRun(run, { type: 'play' });
      const want = Object.entries(SCRIPT.board).length;
      assert.equal(run.battle.board.filter(Boolean).length, want);
    }
  } finally { Object.assign(BOARD_TUNING, keep); }
  assert.ok(createBattle);
});
