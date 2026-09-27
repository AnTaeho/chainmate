import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, legalCommands } from '../src/sim/battle.js';
import { LESSONS, lessonBattle, lessonSq, lessonDrops } from '../src/ui/lessons.js';
import { sqName } from '../src/sim/board.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const walk = (b, route) => {
  const all = [];
  all.push(...apply(b, { type: 'drop', handIndex: 0, sq: lessonSq(route[0]) }));
  for (const s of route.slice(1)) {
    assert.ok(legalCommands(b).some((c) => c.type === 'capture' && c.sq === lessonSq(s)), `capture ${s}`);
    all.push(...apply(b, { type: 'capture', sq: lessonSq(s) }));
  }
  return all;
};
test('수업 판: 내 차례 길은 규칙대로 두어지고 목표에 딱 닿는다', () => {
  for (const L of LESSONS) {
    const b0 = lessonBattle(L);
    assert.equal(JSON.parse(JSON.stringify(b0)).lesson, L.id);
    const drops = lessonDrops(b0, L);
    assert.ok(drops.length > 0, L.id);
    for (const d of drops) {
      const b = clone(b0);
      const ev = walk(b, [sqName(d), ...L.path.slice(1)]);
      assert.ok(!ev.some((e) => e.type === 'cut' || e.type === 'forced'), `${L.id} ${d}`);
      assert.equal(b.score, L.target, `${L.id} drop ${d}`);
      assert.equal(b.status, 'won');
    }
  }
});

test('수업 3은 넷을 잇고 「!」, 수업 4 시범은 끊긴다', () => {
  const L3 = LESSONS[2], L4 = LESSONS[3];
  const ev3 = walk(lessonBattle(L3), L3.path);
  assert.equal(ev3.filter((e) => e.type === 'capture').length, 4);
  assert.ok(ev3.some((e) => e.type === 'grade' && e.mark === '!'));
  const ev4 = walk(lessonBattle(L4), L4.demo);
  assert.ok(ev4.some((e) => e.type === 'cut'));
  // 시범 길도 모두 규칙대로
  for (const L of LESSONS.slice(0, 3)) { const b = lessonBattle(L); walk(b, L.demo); assert.equal(b.score, L.target, L.id); }
});
