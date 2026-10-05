// CHM-65: 진 대국의 위로 상금 — 그 대국 기본 상금의 절반(내림, 최소 1). 남은 수 · 이자 · 넘침 덤 · 상자는 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, legalRunCommands, REWARD, consolationFor, CLOCK } from '../src/sim/run.js';

// 지금 대국을 진다: 수를 하나만 남기고 목표를 멀리 둔 채 사슬을 끝까지
function loseBattle(run) {
  if (run.phase === 'select') applyRun(run, { type: 'play' });
  const b = run.battle;
  b.movesLeft = 1;
  b.target = 1e12;
  const ev = [];
  for (let guard = 0; run.phase === 'battle' && guard < 200; guard++) {
    const cmds = legalRunCommands(run).filter((c) => c.type !== 'reboard' && c.type !== 'tactic');
    const c = cmds.find((x) => x.type === 'drop') || cmds.find((x) => x.type === 'capture' || x.type === 'redrop') || cmds[0];
    ev.push(...applyRun(run, c));
  }
  return ev;
}
// 대국을 목표 1로 이긴다
function winBattle(run) {
  if (run.phase === 'select') applyRun(run, { type: 'play' });
  run.battle.target = 1;
  const ev = [];
  for (let k = 0; k < 20 && run.phase === 'battle'; k++) {
    const cmds = legalRunCommands(run).filter((c) => c.type !== 'discard' && c.type !== 'reboard' && c.type !== 'tactic');
    ev.push(...applyRun(run, cmds[0]));
  }
  return ev;
}

test('위로 상금: 연습 1 · 정식 2 · 마스터 1(기본 상금의 절반, 내림 · 최소 1)', () => {
  assert.equal(REWARD.lossShare, 0.5);
  const want = (kind) => Math.max(1, Math.floor(REWARD.base[kind] * REWARD.lossShare));
  assert.equal(consolationFor('practice'), want('practice'));
  assert.equal(consolationFor('official'), want('official'));
  assert.equal(consolationFor('master'), want('master'));
  assert.deepEqual([consolationFor('practice'), consolationFor('official'), consolationFor('master')], [1, 2, 1]);
});

test('위로 상금: 연습 · 정식 · 마스터에서 지면 그만큼만 상금이 늘고 상점이 열린다(보상 · 상자 없음)', () => {
  for (const [blind, kind] of [[0, 'practice'], [1, 'official'], [2, 'master']]) {
    const run = createRun({ seed: 11 + blind, draft: false });
    run.blind = blind;
    run.money = 23; // 이자가 붙을 만큼 — 위로 상금에는 이자가 없다
    const ev = loseBattle(run);
    assert.equal(run.log.at(-1).won, false, kind);
    assert.equal(run.log.at(-1).kind, kind);
    const got = consolationFor(kind) + ev.filter((e) => e.type === 'money').reduce((a, e) => a + (e.money || 0), 0);
    assert.equal(run.money, 23 + got, kind);
    const c = ev.filter((e) => e.type === 'consolation');
    assert.equal(c.length, 1);
    assert.deepEqual(c[0], { type: 'consolation', money: consolationFor(kind), kind });
    assert.ok(!ev.some((e) => e.type === 'reward' || e.type === 'chest'), kind);
    assert.equal(run.last.reward, null);
    assert.equal(run.last.consolation, consolationFor(kind));
    assert.equal(run.phase, 'shop');
  }
});

test('위로 상금: 이기면 없다', () => {
  const run = createRun({ seed: 21, draft: false });
  const ev = winBattle(run);
  assert.equal(run.log.at(-1).won, true);
  assert.ok(!ev.some((e) => e.type === 'consolation'));
  assert.ok(ev.some((e) => e.type === 'reward'));
  assert.equal(run.last.consolation, undefined);
});

test('위로 상금: 마지막 시계 칸을 잃어 판이 끝나도 준다', () => {
  const run = createRun({ seed: 31, draft: false });
  run.clock = 1;
  const before = run.money;
  const ev = loseBattle(run);
  assert.equal(run.phase, 'lost');
  assert.equal(run.money, before + consolationFor('practice'));
  assert.ok(ev.some((e) => e.type === 'consolation'));
});

test('위로 상금: JSON 왕복 뒤에도 같은 상태 · 같은 다음 흐름', () => {
  const run = createRun({ seed: 41, draft: false });
  run.blind = 1;
  loseBattle(run);
  const copy = JSON.parse(JSON.stringify(run));
  assert.deepEqual(copy, run);
  assert.equal(copy.last.consolation, consolationFor('official'));
  assert.equal(copy.clock, CLOCK.start - 1);
  applyRun(run, { type: 'leave' });
  applyRun(copy, { type: 'leave' });
  assert.equal(JSON.stringify(copy), JSON.stringify(run));
  loseBattle(run);
  loseBattle(copy);
  assert.equal(JSON.stringify(copy), JSON.stringify(run));
});

test('위로 상금: 빌드 기록 상금 흐름은 「위로」 칸으로 나뉘고 남김이 없다', async () => {
  const { ledger } = await import('../tools/build.mjs');
  const r = ledger({ type: 'drop' }, [{ type: 'consolation', money: 2, kind: 'official' }], 2);
  assert.deepEqual(r.earn, { consolation: 2 });
  assert.equal(r.other, 0);
});
