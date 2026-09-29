// 밤샘 2: 시계(D1) · 다시 놓기(D2) · 나쁜 판 거르기(D3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, legalRunCommands, ANTES, CLOCK } from '../src/sim/run.js';
import { createBattle, apply, legalCommands, canReboard, boardScore } from '../src/sim/battle.js';
import { useTactic } from '../src/data/tactics.js';

// 지금 대국을 진다: 수를 하나만 남기고 목표를 멀리 둔 채 첫 떨구기부터 사슬을 끝까지
function loseBattle(run) {
  if (run.phase === 'draft') applyRun(run, { type: 'joseki', index: 0 });
  if (run.phase === 'select') applyRun(run, { type: 'play' });
  const b = run.battle;
  b.movesLeft = 1;
  b.target = 1e12;
  const ev = [];
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 200) {
    const cmds = legalRunCommands(run).filter((c) => c.type !== 'reboard' && c.type !== 'tactic');
    const c = cmds.find((x) => x.type === 'drop') || cmds.find((x) => x.type === 'capture' || x.type === 'redrop') || cmds[0];
    ev.push(...applyRun(run, c));
  }
  return ev;
}

test('시계: 지면 한 칸을 잃고 보상 없이 상점을 거쳐 다음 대국으로, 마지막 칸을 잃으면 판이 끝난다', () => {
  const run = createRun({ seed: 5, draft: false });
  assert.equal(run.clock, CLOCK.start);
  const money = run.money;
  const ev = loseBattle(run);
  assert.ok(ev.some((e) => e.type === 'clockLost' && e.clock === CLOCK.start - 1));
  assert.ok(!ev.some((e) => e.type === 'reward' || e.type === 'chest'));
  assert.equal(run.phase, 'shop');
  assert.equal(run.money, money);
  assert.equal(run.last.reward, null);
  assert.ok(run.shop.display.length > 0);
  assert.equal(run.log.at(-1).clockLost, true);
  applyRun(run, { type: 'leave' });
  assert.equal(run.phase, 'select');
  assert.equal(run.blind, 1);
  for (let i = 1; i < CLOCK.start - 1; i++) { loseBattle(run); applyRun(run, { type: 'leave' }); }
  assert.equal(run.clock, 1);
  const last = loseBattle(run);
  assert.equal(run.phase, 'lost');
  assert.ok(last.some((e) => e.type === 'runLost'));
});

test('시계: 명인에서 지면 명인의 상자 없이 다음 관 · 8관 명인은 같은 대국을 새 판으로', () => {
  const run = createRun({ seed: 6, draft: false });
  run.blind = 2;
  const ev = loseBattle(run);
  assert.ok(!ev.some((e) => e.type === 'chest'));
  assert.equal(run.phase, 'shop');
  applyRun(run, { type: 'leave' });
  assert.equal(run.ante, 2);
  assert.equal(run.blind, 0);
  const fin = createRun({ seed: 6, draft: false });
  fin.ante = ANTES; fin.blind = 2;
  applyRun(fin, { type: 'play' });
  const first = JSON.stringify(fin.battle.board);
  fin.phase = 'select'; fin.battle = null;
  loseBattle(fin);
  assert.equal(fin.phase, 'shop');
  const shop1 = JSON.stringify(fin.shop.display);
  // 상점을 떠났다 돌아와도(shop) 떠나면 같은 대국 앞이다
  applyRun(fin, { type: 'leave' });
  applyRun(fin, { type: 'shop' });
  assert.equal(fin.phase, 'shop');
  applyRun(fin, { type: 'leave' });
  assert.equal(fin.phase, 'select');
  assert.equal(fin.ante, ANTES);
  assert.equal(fin.blind, 2);
  assert.equal(fin.retry, 1);
  applyRun(fin, { type: 'play' });
  const second = JSON.stringify(fin.battle.board);
  // 두 번째로 지면 상점 진열도 새로 굴린다(같은 자리의 상점이 되풀이되지 않게)
  fin.phase = 'select'; fin.battle = null; fin.shop = null;
  loseBattle(fin);
  assert.equal(fin.retry, 2);
  assert.notEqual(JSON.stringify(fin.shop.display), shop1);
  applyRun(fin, { type: 'leave' });
  applyRun(fin, { type: 'play' });
  assert.notEqual(JSON.stringify(fin.battle.board), second);
  fin.phase = 'select'; fin.battle = null; fin.retry = 1;
  applyRun(fin, { type: 'play' });
  assert.notEqual(JSON.stringify(fin.battle.board), first);
});

test('시계 1(단 7부터)은 한 번 지면 판이 끝난다', () => {
  const run = createRun({ seed: 5, draft: false, dan: 7 });
  assert.equal(run.clock, 1);
  loseBattle(run);
  assert.equal(run.phase, 'lost');
});

test('다시 놓기: 첫 수 전에 한 번, 손 · 목표는 그대로, 판은 시드로 정해진다', () => {
  const make = () => createBattle({ seed: 77, ante: 3, kind: 'official', target: 500 });
  const b = make();
  const hand = JSON.stringify(b.hand), board = JSON.stringify(b.board);
  assert.ok(canReboard(b));
  assert.ok(legalCommands(b).some((c) => c.type === 'reboard'));
  const ev = apply(b, { type: 'reboard' });
  assert.ok(ev.some((e) => e.type === 'reboard'));
  assert.equal(JSON.stringify(b.hand), hand);
  assert.notEqual(JSON.stringify(b.board), board);
  assert.equal(b.board.filter((c) => c && c.t === 'K').length, 1);
  assert.ok(!canReboard(b));
  assert.throws(() => apply(b, { type: 'reboard' }));
  const again = make(); apply(again, { type: 'reboard' });
  assert.equal(JSON.stringify(again.board), JSON.stringify(b.board));
  assert.equal(JSON.stringify(again.incoming), JSON.stringify(b.incoming));
});

test('다시 놓기: 첫 수를 두거나 묘수를 쓰면 못 한다', () => {
  const b = createBattle({ seed: 78, ante: 2, kind: 'practice', target: 1e9 });
  const d = legalCommands(b).find((c) => c.type === 'drop');
  apply(b, d);
  while (b.status === 'chain') apply(b, legalCommands(b)[0]);
  assert.ok(!canReboard(b));
  const t = createBattle({ seed: 79, ante: 2, kind: 'practice', target: 1e9 });
  useTactic(t, 'reload');
  assert.ok(!canReboard(t));
});

test('나쁜 판 거르기: 같은 시드면 같은 판 · 거른 판의 첫 손 점수가 평균으로 낫다', () => {
  const mk = (seed, filter) => createBattle({ seed, ante: 4, kind: 'official', target: 1000, filter });
  assert.equal(JSON.stringify(mk(3, 3).board), JSON.stringify(mk(3, 3).board));
  let plain = 0, filtered = 0;
  for (let s = 1; s <= 30; s++) { plain += boardScore(mk(s, 0)); filtered += boardScore(mk(s, 3)); }
  assert.ok(filtered > plain, `거른 판 ${filtered} · 옛 판 ${plain}`);
});
