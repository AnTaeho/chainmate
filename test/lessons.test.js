// 튜토리얼 수업: 걸음마다 실제(코어 판) 규칙으로 둘 수 있고, 끝까지 가면 이긴다 · 수업 화면에서 빛나지 않는 칸을 눌러도 든 기물은 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, dropSquaresFor } from '../src/sim/battle.js';
import { chainCaptures } from '../src/sim/chain.js';
import { previewDrop } from '../src/sim/solver.js';
import { LESSONS, LESSON_GROUPS, LESSON_BY_ID, lessonBattle, lessonSq } from '../src/ui/lessons.js';
import { CORE } from '../src/data/core.js';

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

test('수업은 일곱, 묶음 둘(기초 셋 · 대국 넷) · 수업마다 걸음 3~6 · 킹의 말은 반말', () => {
  assert.equal(LESSONS.length, 7);
  for (const L of LESSONS) assert.ok(LESSON_GROUPS.some((g) => g.id === L.group), L.id);
  assert.deepEqual(LESSON_GROUPS.map((g) => LESSONS.filter((L) => L.group === g.id).length), [3, 4]);
  for (const L of LESSONS.filter((x) => !x.shop)) {
    assert.ok(L.steps.length >= 3 && L.steps.length <= 6, `${L.id} 걸음 ${L.steps.length}`);
    for (const st of [...L.steps, ...(L.demo || [])]) if (st.say) assert.ok(!/(세요|해요|예요|이에요|어요|아요|돼요|워요)$/.test(st.say), `${L.id}: ${st.say}`);
  }
  // 코어 판에 없는 것(특수 기물 · 시너지 · 탁월수)은 가르치지 않는다
  const all = JSON.stringify(LESSONS);
  for (const w of ['특수 기물', '시너지', '탁월수', '궁수', '다 채우면']) assert.ok(!all.includes(w), w);
});

test('수업 대국은 코어 판 대국 규칙(CORE.rules)을 켠다 — 증원 셈만 수업이 손으로 짠다', () => {
  for (const L of LESSONS.filter((x) => !x.shop)) {
    const b = lessonBattle(L);
    for (const [k, v] of Object.entries(CORE.rules)) if (k !== 'reinforceAdd') assert.deepEqual(b.rules[k], v, `${L.id} ${k}`);
    assert.equal(b.rules.reinforceAdd, 0);
    assert.equal(b.rules.moves, L.moves || 1);
  }
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

// 첫 수가 끝난 뒤(둘째 수의 놓기 전)까지 걷는다
const firstMove = (L) => walk(L, L.steps.slice(0, L.steps.findIndex((st, k) => k > 0 && st.pick != null)));

test('수업 streak: 첫 콤보가 남긴 배수에서 둘째 콤보가 시작한다', () => {
  const L = LESSON_BY_ID.streak;
  assert.equal(L.moves, 2);
  const b = firstMove(L);
  assert.equal(b.status, 'play');
  assert.equal(b.streak, 1, '첫 콤보에서 잡은 하나가 배수에 남는다');
  const k = L.steps.map((st, i) => ('drop' in st ? i : -1)).filter((i) => i >= 0)[1];
  const c = walk(L, L.steps.slice(0, k + 1));
  assert.equal(c.chain.mult, 1, '둘째 콤보는 이어 온 배수 1에서 시작');
  const end = walk(L, L.steps);
  assert.equal(end.streak, 2);
  assert.equal(end.history[1].captures, 1);
  assert.ok(end.history[1].score > end.history[0].score, '뒤 콤보가 더 크다');
});

test('수업 cut: 시범의 끊긴 콤보는 배수에 안 쌓이고, 걸음대로 두면 둘이 쌓인다', () => {
  const L = LESSON_BY_ID.cut;
  const d = walk(L, L.demo);
  assert.equal(d.history[0].reason, 'cut');
  assert.equal(d.history[0].captures, 1);
  assert.equal(d.streak, 0, '끊긴 콤보에서 잡은 수는 안 쌓인다');
  const b = walk(L, L.steps);
  assert.notEqual(b.history[0].reason, 'cut');
  assert.equal(b.streak, 2);
});

test('수업 playout: 첫 수로 목표를 넘겨도 대국이 이어지고, 증원을 잡아 ×2를 넘긴 채 수를 다 두면 이긴다', () => {
  const L = LESSON_BY_ID.playout;
  const b = firstMove(L);
  assert.equal(b.status, 'play', '목표를 넘겨도 끝나지 않는다');
  assert.ok(b.score >= b.target && b.movesLeft === 1);
  const rook = L.incoming[0];
  assert.equal(b.board[lessonSq(rook.sq)] && b.board[lessonSq(rook.sq)].t, rook.t, '증원이 들어왔다');
  const end = walk(L, L.steps);
  assert.equal(end.status, 'won');
  assert.equal(end.movesLeft, 0);
  assert.ok(end.overflow >= 2, `넘침 층 ${end.overflow}`);
  assert.ok(end.history[1].score > end.history[0].score, '뒤 수가 더 크다');
});

test('수업 mate: 아무도 지키지 않는 킹을 잡으면 수가 남아도 곧바로 이긴다', () => {
  const b = walk(LESSON_BY_ID.mate, LESSON_BY_ID.mate.steps);
  assert.equal(b.status, 'won');
  assert.equal(b.result.reason, 'mate');
  assert.ok(b.movesLeft > 0);
});

test('수업 redraw: 희생은 바치고 다시 뽑기만 한다(탁월수 기회 없음)', () => {
  const L = LESSON_BY_ID.redraw;
  const b = walk(L, L.steps.slice(0, 2));
  assert.equal(b.offering, null);
  assert.equal(b.hand[3].t, 'N');
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
test('문턱을 말하는 글 = THRESHOLDS(복제 레퍼토리 · 낱말 상자 · 도움말 팁, 한국어 · 영어)', async () => {
  const { THRESHOLDS } = await import('../src/data/families.js');
  const { JOSEKI_BY_ID } = await import('../src/data/josekis.js');
  const { TERMS } = await import('../src/ui/glossary.js');
  const { HINTS } = await import('../src/ui/coach.js');
  const { EN } = await import('../src/data/i18n/en.js');
  const nums = (s) => (s.match(/\d+/g) || []).map(Number);
  const set = TERMS.find((t) => t.id === 'set');
  const cases = [
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

// ── 수업 화면(CHM-79 사람 판: 「궁수에서 클릭을 갑자기 할 수 없게 됐다」). 빛나지 않는 칸을 누르면 대국처럼 든 기물을 내려놓아
// 걸음이 앞으로 돌아갔고, 그 뒤 빛나는 칸을 눌러도 든 것이 없어 아무 일도 없었다. 연출 중 손 카드 누름은 반응 없이 삼켰다
test('수업 화면: 빛나지 않는 칸을 눌러도 든 기물은 그대로고, 빛나는 칸을 누르면 놓인다 · 연출 중 손 카드는 연출을 빨리 감는다', async () => {
  const { installDom, tick } = await import('./helpers/dom.js');
  const { KEYS } = await import('../src/ui/save.js');
  const dom = await installDom();
  try {
    const { boot } = await import('../src/main.js');
    dom.store.set(KEYS.records, JSON.stringify({ v: 1, runs: 1, tutorialAsked: true }));
    const app = await boot({ window: dom.window, document: dom.document });
    tick(app);
    const i = LESSONS.findIndex((L) => L.id === 'streak');
    app.go('lesson', { index: i, phase: 'play' }); tick(app);
    const s = app.screen, L = LESSONS[i];
    const press = (id) => { const r = app.ui.regions.find((q) => q.id === id); assert.ok(r, id); r.onClick(r); tick(app); };
    press('hand:0');
    assert.deepEqual(s.sel, [0]);
    const drop = lessonSq(L.steps[1].drop);
    const wrong = dropSquaresFor(s.hold.b, s.hold.b.hand[0]).find((q) => q !== drop);
    assert.ok(wrong != null, '대국 규칙으로는 놓을 수 있지만 수업이 빛내지 않는 칸');
    s.clickSq(wrong); tick(app);
    assert.deepEqual(s.sel, [0], '든 기물은 그대로');
    assert.equal(s.at, 1, '걸음은 놓기에 머문다');
    s.clickSq(lessonSq('a1')); tick(app); // 판 위 빈 칸
    assert.deepEqual(s.sel, [0]);
    s.clickSq(drop); tick(app);
    assert.equal(s.hold.b.status, 'chain', '빛나는 칸을 누르면 놓인다');
    // 콤보 연출 중에 손 카드를 누르면 연출을 빨리 감는다(아무 반응 없이 삼키지 않는다)
    for (let n = 0; n < 600 && s.busy; n++) tick(app, 1);
    s.clickSq(lessonSq(L.steps[2].cap)); tick(app, 1);
    assert.ok(s.busy, '연출 중');
    assert.equal(s.fast, false);
    press('hand:0');
    assert.equal(s.fast, true);
    assert.deepEqual(s.sel, [], '연출 중에는 들지 않는다');
  } finally { delete globalThis.document; delete globalThis.window; }
});
