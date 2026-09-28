// 사슬 중간에 목표를 넘겨도 사슬은 끝까지(docs/tasks/shop-chain.md B): 승리 판정 · 넘친 덤은 사슬이 끝난 뒤의 점수로.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, apply, overflowTier } from '../src/sim/battle.js';
import { chainCaptures } from '../src/sim/chain.js';
import { bestMove } from '../src/sim/solver.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// 먹기가 둘 이상 이어지는(다시 떨구기 없는) 첫 수가 있는 대국들
function chains(n) {
  const out = [];
  for (let seed = 1; seed <= 80 && out.length < n; seed++) {
    const b = createBattle({ seed, target: 1e12 });
    const d = bestMove(b, { preferMate: 'avoid' });
    if (d && d.line.length >= 2 && d.line.every((x) => typeof x === 'number')) out.push({ b, d });
  }
  return out;
}
// 사슬을 끝까지 둔다(봇의 줄 → 줄이 다하면 먹을 수 있는 첫 칸). 돌려주는 값: 모든 사건
function finishChain(b, line, events, k = 1) {
  while (b.status === 'chain') {
    const sq = k < line.length ? line[k++] : chainCaptures(b)[0];
    events.push(...apply(b, { type: 'capture', sq }));
  }
  return events;
}

test('목표를 사슬 중간에 넘겨도 같은 사슬에서 더 먹을 수 있고, 사슬이 끝나면 won', () => {
  const list = chains(5);
  assert.ok(list.length >= 3, `사슬 둘 이상인 대국 ${list.length}`);
  for (const { b, d } of list) {
    b.target = 1; // 첫 먹기로 사슬 몫이 목표를 넘는다
    const events = apply(b, { type: 'drop', handIndex: d.handIndex, sq: d.sq });
    events.push(...apply(b, { type: 'capture', sq: d.line[0] }));
    assert.equal(b.status, 'chain', '목표를 넘겨도 사슬은 이어진다');
    assert.ok(b.chain.value * b.chain.mult >= b.target);
    assert.equal(b.score, 0, '사슬 점수는 사슬이 끝날 때 더해진다');
    assert.ok(!events.some((e) => e.type === 'win' || e.type === 'overflow'));
    const caps = b.chain.captures.length;
    events.push(...apply(b, { type: 'capture', sq: d.line[1] }));
    assert.equal(events.filter((e) => e.type === 'capture').length, caps + 1, '넘긴 뒤의 먹기를 받는다');
    finishChain(b, d.line, events, 2);
    assert.equal(b.status, 'won');
    assert.equal(b.result.reason, 'score');
    const types = events.map((e) => e.type);
    assert.ok(types.indexOf('end') < types.indexOf('overflow') && types.indexOf('overflow') < types.indexOf('win'), '끝 → 넘침 → 승리 차례');
    assert.throws(() => apply(b, { type: 'drop', handIndex: 0, sq: 0 }), /over/, '사슬이 끝나면 대국도 끝: 다음 수가 없다');
  }
});

test('넘친 덤의 층은 사슬 끝의 최종 점수로 정해진다', () => {
  let checked = 0;
  for (const { b, d } of chains(4)) {
    // 목표 없이 두어 이 사슬의 최종 점수를 잰다
    const probe = clone(b);
    apply(probe, { type: 'drop', handIndex: d.handIndex, sq: d.sq });
    apply(probe, { type: 'capture', sq: d.line[0] });
    finishChain(probe, d.line, []);
    const S = probe.score;
    assert.ok(S > 0);
    // 최종 점수가 목표 ×5 이상 ×10 아래가 되게
    const target = Math.floor(S / 5);
    if (S >= 10 * target || target < 1) continue;
    b.target = target;
    apply(b, { type: 'drop', handIndex: d.handIndex, sq: d.sq });
    apply(b, { type: 'capture', sq: d.line[0] });
    const events = finishChain(b, d.line, []);
    assert.equal(b.score, S);
    assert.equal(b.overflow, 5);
    assert.equal(b.overflow, overflowTier(b.score, target));
    assert.deepEqual(events.filter((e) => e.type === 'overflow').map((e) => e.tier), [1, 2, 5]);
    checked++;
  }
  assert.ok(checked >= 2, `잰 대국 ${checked}`);
});
