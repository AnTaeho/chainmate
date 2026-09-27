// 첫 수업: 걸음마다 실제 규칙으로 둘 수 있고, 끝까지 가면 이긴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, dropSquaresFor } from '../src/sim/battle.js';
import { chainCaptures } from '../src/sim/chain.js';
import { previewDrop } from '../src/sim/solver.js';
import { LESSONS, LESSON_GROUPS, lessonBattle, lessonSq } from '../src/ui/lessons.js';

// 수업 화면과 같은 방식으로 걸음을 밟는다
export function walk(L, steps) {
  const b = lessonBattle(L);
  let sel = null;
  steps.forEach((st, k) => {
    const where = `${L.id} 걸음 ${k}`;
    if (st.pick != null) { assert.equal(b.status, 'play', where); assert.ok(b.hand[st.pick], where); sel = st.pick; return; }
    if (st.discard) { assert.equal(b.status, 'play', where); apply(b, { type: 'discard', handIndices: [sel] }); sel = null; return; }
    if ('drop' in st) {
      const list = dropSquaresFor(b, b.hand[sel]);
      let sq = lessonSq(st.drop);
      if (sq == null) {
        const next = steps[k + 1];
        sq = list.find((s) => previewDrop(b, sel, s).next.includes(lessonSq(next.cap)));
      }
      assert.ok(list.includes(sq), `${where}: 떨굴 수 있는 칸`);
      apply(b, { type: 'drop', handIndex: sel, sq });
      sel = null;
      return;
    }
    if (st.cap) {
      assert.equal(b.status, 'chain', where);
      assert.ok(chainCaptures(b).includes(lessonSq(st.cap)), `${where}: 먹을 수 있는 적 ${st.cap}`);
      apply(b, { type: 'capture', sq: lessonSq(st.cap) });
    }
  });
  return b;
}

test('수업은 열, 묶음 셋', () => {
  assert.equal(LESSONS.length, 10);
  for (const L of LESSONS) assert.ok(LESSON_GROUPS.some((g) => g.id === L.group), L.id);
});

for (const L of LESSONS.filter((x) => !x.shop)) {
  test(`수업 ${L.id}: 걸음대로 두면 이긴다`, () => {
    const b = walk(L, L.steps);
    assert.equal(b.status, 'won', `${L.id}: ${b.status} 점수 ${b.score}/${b.target}`);
  });
  if (L.demo) test(`수업 ${L.id}: 시범은 끊긴다`, () => {
    const b = walk(L, L.demo);
    assert.notEqual(b.status, 'won');
  });
}

test('떨굴 칸을 열어 둔 걸음은 빛나는 칸 어디서든 이긴다', () => {
  for (const L of LESSONS.filter((x) => !x.shop)) {
    L.steps.forEach((st, k) => {
      if (!('drop' in st) || st.drop) return;
      const pre = walk(L, L.steps.slice(0, k));
      const sel = L.steps[k - 1].pick;
      const want = lessonSq(L.steps[k + 1].cap);
      const list = dropSquaresFor(pre, pre.hand[sel]).filter((s) => previewDrop(pre, sel, s).next.includes(want));
      assert.ok(list.length > 0, L.id);
      for (const s of list) {
        const steps = L.steps.map((x, j) => (j === k ? { drop: null, force: s } : x));
        const b = lessonBattle(L);
        let h = null;
        for (const x of steps) {
          if (x.pick != null) h = x.pick;
          else if ('drop' in x) apply(b, { type: 'drop', handIndex: h, sq: x.force ?? lessonSq(x.drop) });
          else if (x.cap) { assert.ok(chainCaptures(b).includes(lessonSq(x.cap)), `${L.id} ${s} ${x.cap}`); apply(b, { type: 'capture', sq: lessonSq(x.cap) }); }
        }
        assert.equal(b.status, 'won', `${L.id} ${s}`);
      }
    });
  }
});
