// 대국 호흡 시제품(CHM-66 D′, src/sim/tuning.js PACE): 기본은 꺼짐이고, 켜면
//   A 연습 · 정식 목표 배율 · 대국당 수, B 기세(풀이기와 실제 대국이 같은 점수), C 끝까지 둔다(넘겨도 수를 다 쓴다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, targetFor } from '../src/sim/run.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { bestMove, lineCommands } from '../src/sim/solver.js';
import { PACE, momentumMult } from '../src/sim/tuning.js';
import { decideBattle, stepBattle, goalOf } from '../tools/bot.mjs';

const OFF = JSON.parse(JSON.stringify(PACE));
function withPace(p, fn) {
  Object.assign(PACE, p);
  try { return fn(); } finally { Object.assign(PACE, JSON.parse(JSON.stringify(OFF))); }
}
const play = (b, m) => { const ev = apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq }); for (const c of lineCommands(m.line)) ev.push(...apply(b, c)); return ev; };

test('꺼짐이 기본이고, 꺼 두면 목표 · 수 · 기세가 그대로다', () => {
  assert.equal(PACE.mode, null);
  assert.equal(momentumMult({ movesUsed: 3 }), 1);
  assert.equal(targetFor(3, 'official'), 6600);
  assert.equal(createRun({ seed: 1 }).rules.moves ?? 4, 4);
  // 모드가 없으면 곡선 배율도 쓰지 않는다
  withPace({ curve: 2 }, () => assert.equal(targetFor(3, 'official'), 6600));
});

test('A: 연습 · 정식 목표 배율과 대국당 수, 곡선 배율은 2관부터', () => withPace({ mode: 'A', kindMult: { practice: 1.5, official: 2 }, moves: 5, curve: 1.2 }, () => {
  assert.equal(targetFor(1, 'practice'), 230); // 150 × 1.5(1관은 곡선 그대로)
  assert.equal(targetFor(3, 'official'), 11000); // 4400 × 1.2 × 2 = 10560 → 유효 숫자 둘
  assert.equal(targetFor(3, 'master'), 11000); // 마스터 ×2는 그대로
  const run = createRun({ seed: 1 });
  assert.equal(run.rules.moves, 5);
}));

test('B 기세: 풀이기가 기세를 반영한 점수를 내고, 실제로 둔 사슬 점수와 같다', () => withPace({ mode: 'B', momentum: 0.5 }, () => {
  const b = createBattle({ seed: 7, ante: 2 });
  // 첫 사슬: 앞서 끝낸 사슬이 없어 기세 없음
  const m1 = bestMove(b, { preferMate: false });
  const ev1 = play(b, m1);
  assert.equal(b.history[0].score, m1.score);
  assert.ok(!ev1.some((e) => e.src === 'momentum'));
  assert.equal(b.movesUsed, 1);
  // 둘째 사슬: ×1.5. 풀이기의 예상 = 실제 점수, 꺼 둔 풀이기의 1.5배
  assert.equal(b.status, 'play');
  const off = withPace({ mode: null }, () => bestMove(b, { preferMate: false }));
  Object.assign(PACE, { mode: 'B', momentum: 0.5 });
  const m2 = bestMove(b, { preferMate: false });
  assert.ok(m2.score >= Math.floor(off.score * 1.5) && m2.score <= Math.floor(off.score * 1.5) + 1, `기세 ${m2.score} · 꺼짐 ${off.score}`);
  const ev2 = play(b, m2);
  assert.ok(ev2.some((e) => e.type === 'score' && e.src === 'momentum' && e.xmult === 1.5));
  assert.equal(b.history[1].score, m2.score);
}));

test('B 기세: 두 수 앞선 대국은 ×2', () => withPace({ mode: 'B', momentum: 0.5 }, () => {
  const b = createBattle({ seed: 11, ante: 3 });
  const off = withPace({ mode: null }, () => bestMove({ ...b, movesUsed: 2 }, { preferMate: false }));
  Object.assign(PACE, { mode: 'B', momentum: 0.5 });
  const on = bestMove({ ...b, movesUsed: 2 }, { preferMate: false });
  assert.ok(on.score >= off.score * 2 && on.score <= off.score * 2 + 1, `기세 ${on.score} · 꺼짐 ${off.score}`);
}));

test('C 끝까지: 목표를 넘겨도 수를 다 쓰고, 다 쓴 뒤 목표 이상이면 이긴다', () => withPace({ mode: 'C' }, () => {
  let checked = 0;
  for (let seed = 1; seed <= 20 && checked < 3; seed++) {
    const b = createBattle({ seed, ante: 1, target: 20 });
    let crossedAt = null;
    for (let i = 0; i < 40 && (b.status === 'play' || b.status === 'chain'); i++) {
      stepBattle(b, (c) => apply(b, c));
      if (crossedAt == null && b.score >= b.target) crossedAt = b.movesUsed;
    }
    if (b.result.reason === 'mate' || crossedAt == null || crossedAt >= b.rules.moves) continue;
    // 넘긴 뒤에도 대국이 이어졌다
    assert.equal(b.status, 'won');
    assert.ok(b.movesUsed > crossedAt, `넘긴 수 ${crossedAt} · 둔 수 ${b.movesUsed}`);
    assert.ok(b.movesLeft === 0 || b.result.reason === 'score');
    checked++;
  }
  assert.ok(checked > 0, '넘긴 뒤 이어진 대국이 하나는 있어야 한다');
}));

test('C 끝까지: 꺼 두면 넘긴 수에서 곧바로 끝난다', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const b = createBattle({ seed, ante: 1, target: 20 });
    for (let i = 0; i < 40 && (b.status === 'play' || b.status === 'chain'); i++) stepBattle(b, (c) => apply(b, c));
    if (b.status === 'won' && b.result.reason === 'score') assert.ok(b.score >= 20 && b.history.slice(0, -1).reduce((a, h) => a + h.score, 0) < 20);
  }
});

test('C 끝까지: 봇은 넘긴 뒤 덤이 붙는 다음 넘침 층을 노린다', () => withPace({ mode: 'C', overflow: { 2: 1, 5: 2, 10: 4 } }, () => {
  const b = createBattle({ seed: 2, ante: 1, target: 100 });
  assert.equal(goalOf(b), 100);
  b.score = 150;
  assert.equal(goalOf(b), 200);
  b.score = 600;
  assert.equal(goalOf(b), 1000);
  b.score = 1200;
  assert.equal(goalOf(b), Infinity);
  assert.ok(decideBattle(b)); // 넘긴 뒤에도 둘 수를 낸다
  Object.assign(PACE, { mode: null });
  assert.equal(goalOf(b), 100);
}));
