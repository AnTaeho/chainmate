// 튜토리얼 수업: 걸음마다 실제 규칙으로 둘 수 있고, 끝까지 가면 이긴다
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
    if (st.moves) return; // 「행마」 단추는 판을 바꾸지 않는다
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

test('수업은 여덟, 묶음 셋 · 수업마다 걸음 3~6 · 킹의 말은 반말', () => {
  assert.equal(LESSONS.length, 8);
  for (const L of LESSONS) assert.ok(LESSON_GROUPS.some((g) => g.id === L.group), L.id);
  for (const L of LESSONS.filter((x) => !x.shop)) {
    assert.ok(L.steps.length >= 3 && L.steps.length <= 6, `${L.id} 걸음 ${L.steps.length}`);
    for (const st of [...L.steps, ...(L.demo || [])]) if (st.say) assert.ok(!/(세요|해요|예요|이에요|어요|아요|돼요|워요)$/.test(st.say), `${L.id}: ${st.say}`);
  }
  // 「행마」 단추 걸음이 하나 있다(대국 오른쪽 위 「행마」로 기물 길 보기)
  assert.equal(LESSONS.flatMap((L) => L.steps || []).filter((st) => st.moves).length, 1);
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

test('수업 fairy: 궁수는 사이가 막혀도 제자리에서 룩을 먹고 룩이 된다', () => {
  const L = LESSONS.find((x) => x.id === 'fairy');
  assert.deepEqual(L.hand, ['S']);
  const drop = L.steps.find((st) => 'drop' in st).drop;
  const b = walk(L, L.steps.filter((st) => !st.moves).slice(0, 3));
  assert.equal(b.status, 'chain');
  assert.equal(b.chain.sq, lessonSq(drop), '먹은 뒤에도 놓은 칸');
  assert.equal(b.chain.form, 'R');
  assert.ok(b.board[lessonSq('d4')] && !b.board[lessonSq('d4')].mine, '사이의 폰은 그대로');
  assert.ok(!b.board[lessonSq('d5')], '룩은 먹혔다');
  // 사슬 하나로 목표를 꼭 채운다
  assert.equal(walk(L, L.steps).score, L.target);
});

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

// 문턱을 말하는 글은 families.js THRESHOLDS와 같아야 한다(CHM-78에서 6 → 5로 바꿀 때 글만 남았다 — U-1 · D-19)
test('문턱을 말하는 글 = THRESHOLDS(수업 ⑧ · 복제 레퍼토리 · 낱말 상자 · 도움말 팁, 한국어 · 영어)', async () => {
  const { THRESHOLDS } = await import('../src/data/families.js');
  const { SHOP_FAMILY_SAY } = await import('../src/ui/lessons.js');
  const { JOSEKI_BY_ID } = await import('../src/data/josekis.js');
  const { TERMS } = await import('../src/ui/glossary.js');
  const { HINTS } = await import('../src/ui/coach.js');
  const { EN } = await import('../src/data/i18n/en.js');
  const nums = (s) => (s.match(/\d+/g) || []).map(Number);
  const set = TERMS.find((t) => t.id === 'set');
  const cases = [
    [SHOP_FAMILY_SAY, THRESHOLDS.slice(1), 'tail'],
    [JOSEKI_BY_ID.clone.text, THRESHOLDS.map((x) => x - 1)],
    [set.say, THRESHOLDS], [set.enSay, THRESHOLDS],
    [HINTS.family, THRESHOLDS],
  ];
  for (const [s, want, tail] of cases) {
    for (const t of [s, EN[s]].filter(Boolean)) {
      const got = nums(t);
      assert.deepEqual(tail ? got.slice(-want.length) : got, want, t);
    }
  }
});
