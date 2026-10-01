// 희생(CHM-35, docs/design-notes/sacrifice.md): 손 기물 하나를 바치고 새로 뽑는다. 바친 기물의 힘이 이번 대국의 다음 사슬에 붙는다.
// 명령 id는 옛 이름 discard 그대로다(옛 저장과 맞추려고).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { createBattle, apply, offeringOf, addOffering, SACRIFICE } from '../src/sim/battle.js';
import { bestMove, previewDrop } from '../src/sim/solver.js';
import { createRun, applyRun, DANS } from '../src/sim/run.js';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { MASTER_BY_ID } from '../src/data/masters.js';
import { FAMILIES } from '../src/data/families.js';
import { setLang, L } from '../src/ui/lang.js';
const tr = (s) => { setLang('en'); try { return L(s); } finally { setLang('ko'); } };

// 판: e5 비숍 하나(나이트를 d3에 떨구면 먹고 막힌다 — 값 30 · 배수 1). 손 N P P P, 주머니 P P P P
function scene(extra = {}) {
  const b = createBattle({ seed: 3, ...extra });
  b.board = boardFrom({ e5: 'B' });
  b.hand = [{ t: 'N', id: 1, eng: null }, { t: 'P', id: 2, eng: null }, { t: 'P', id: 3, eng: null }, { t: 'P', id: 4, eng: null }];
  b.bag = [5, 6, 7, 8].map((id) => ({ t: 'P', id, eng: null }));
  b.incoming = []; b.incomingNext = [];
  return b;
}
const expect = (pieces) => {
  let off = null;
  for (const t of pieces) off = addOffering(off, t);
  return (30 + off.value) * (1 + off.mult);
};

test('희생: 바친 기물은 쓴 것으로 가고 주머니에서 새로 뽑는다 · 몫이 상태에 JSON으로 남는다', () => {
  const b = scene();
  const ev = apply(b, { type: 'discard', handIndices: [1] });
  assert.equal(b.discardsLeft, 2);
  assert.equal(b.discarded, 1);
  assert.deepEqual(b.used.map((p) => p.id), [2]);
  assert.equal(b.hand.length, 4);
  assert.deepEqual(b.offering, { ...offeringOf('P'), count: 1, pieces: ['P'] });
  assert.deepEqual(JSON.parse(JSON.stringify(b.offering)), b.offering);
  assert.deepEqual(ev.find((e) => e.type === 'discard').offering, b.offering);
});

test('희생의 몫: 다음 사슬에 붙고 여러 번 바치면 쌓인다', () => {
  const plain = scene();
  apply(plain, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(plain, { type: 'capture', sq: S('e5') });
  assert.equal(plain.score, 30);

  const one = scene();
  apply(one, { type: 'discard', handIndices: [1] });
  apply(one, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(one, { type: 'capture', sq: S('e5') });
  assert.equal(one.score, expect(['P']));

  const two = scene();
  apply(two, { type: 'discard', handIndices: [1] });
  apply(two, { type: 'discard', handIndices: [1] });
  assert.equal(two.offering.count, 2);
  const ev = apply(two, { type: 'drop', handIndex: 0, sq: S('d3') });
  // 떨군 순간 몫이 점수 사건으로 든다(화면이 값 · 배수 칸에 더한다)
  const sc = ev.find((e) => e.type === 'score' && e.src === 'sacrifice');
  assert.ok(sc);
  apply(two, { type: 'capture', sq: S('e5') });
  assert.equal(two.score, expect(['P', 'P']));
  assert.ok(two.score > one.score && one.score > plain.score);
});

test('희생의 몫: 다음 사슬이 끝나면 비운다(그다음 사슬엔 붙지 않는다)', () => {
  const b = scene();
  apply(b, { type: 'discard', handIndices: [1] });
  apply(b, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(b, { type: 'capture', sq: S('e5') });
  assert.equal(b.offering, null);
  assert.equal(b.history.at(-1).score, expect(['P']));
  // 둘째 사슬: 같은 장면을 다시 깔고 나이트로
  b.board = boardFrom({ e5: 'B' });
  b.hand[0] = { t: 'N', id: 9, eng: null };
  apply(b, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(b, { type: 'capture', sq: S('e5') });
  assert.equal(b.history.at(-1).score, 30);
});

test('희생 횟수: 대국마다 3번, 다 쓰면 거부', () => {
  const b = scene();
  assert.equal(b.discardsLeft, 3);
  for (let i = 0; i < 3; i++) apply(b, { type: 'discard', handIndices: [1] });
  assert.throws(() => apply(b, { type: 'discard', handIndices: [1] }), /no discards left/);
  assert.equal(b.offering.count, 3);
});

test('미리 보기(previewDrop)와 풀이기도 쌓인 몫을 본다', () => {
  const b = scene();
  const before = previewDrop(b, 0, S('d3'));
  assert.equal(before.value, 0);
  assert.equal(before.mult, 0);
  apply(b, { type: 'discard', handIndices: [1] });
  const off = offeringOf('P');
  const pv = previewDrop(b, 0, S('d3'));
  assert.equal(pv.value, off.value);
  assert.equal(pv.mult, off.mult);
  assert.deepEqual(pv.next, [S('e5')]);
  assert.equal(pv.offering.count, 1);
  assert.equal(bestMove(b).score, expect(['P']));
});

test('세기 후보 A · B · C: 바친 기물에 따라 붙는 몫', () => {
  const keep = { ...SACRIFICE };
  try {
    Object.assign(SACRIFICE, { mode: 'A', mult: 1 });
    assert.deepEqual(offeringOf('R'), { value: 50, mult: 1 });
    Object.assign(SACRIFICE, { mode: 'B', valueX: 2 });
    assert.deepEqual(offeringOf('R'), { value: 100, mult: 0 });
    Object.assign(SACRIFICE, { mode: 'C' });
    assert.deepEqual(offeringOf('Q'), { value: 0, mult: 5 });
    assert.deepEqual(offeringOf('P'), { value: 0, mult: 1 });
  } finally { Object.assign(SACRIFICE, keep); }
});

test('저장 왕복: 몫이 쌓인 대국을 JSON으로 되살려도 같은 결과 · 몫 없는 옛 저장도 돈다', () => {
  const a = scene();
  apply(a, { type: 'discard', handIndices: [1] });
  const b = JSON.parse(JSON.stringify(a));
  for (const x of [a, b]) {
    apply(x, { type: 'drop', handIndex: 0, sq: S('d3') });
    apply(x, { type: 'capture', sq: S('e5') });
  }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(b.score, expect(['P']));

  const old = JSON.parse(JSON.stringify(scene()));
  delete old.offering; // 희생 전 저장
  apply(old, { type: 'discard', handIndices: [1] });
  assert.equal(old.offering.count, 1);
  const old2 = JSON.parse(JSON.stringify(scene()));
  delete old2.offering;
  apply(old2, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(old2, { type: 'capture', sq: S('e5') });
  assert.equal(old2.score, 30);
});

test('격언 셋: 뽑은 대로 · 미련 없이 · 절약이 희생에 걸린다', () => {
  assert.equal(MAXIM_BY_ID.no_regrets.text, '희생 없는 대국: 배수 +4');
  assert.equal(MAXIM_BY_ID.second_thought.text, '희생 +1 · 희생할 때마다 배수 +2');
  assert.equal(MAXIM_BY_ID.thrift.text, '대국을 이기면 남은 희생마다 상금 +1');

  // 뽑은 대로: 희생하면 배수 +4를 잃는다
  const keep = scene({ mods: [{ id: 'no_regrets' }] });
  apply(keep, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(keep, { type: 'capture', sq: S('e5') });
  assert.equal(keep.score, 30 * 5);
  const gave = scene({ mods: [{ id: 'no_regrets' }] });
  apply(gave, { type: 'discard', handIndices: [1] });
  apply(gave, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(gave, { type: 'capture', sq: S('e5') });
  assert.equal(gave.score, expect(['P']));

  // 미련 없이: 희생 +1, 바칠 때마다 다음 사슬 배수 +2 — 몫과 함께 비운다
  const st = scene({ mods: [{ id: 'second_thought' }] });
  assert.equal(st.discardsLeft, 4);
  apply(st, { type: 'discard', handIndices: [1] });
  apply(st, { type: 'discard', handIndices: [1] });
  apply(st, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(st, { type: 'capture', sq: S('e5') });
  const off = addOffering(addOffering(null, 'P'), 'P');
  assert.equal(st.score, (30 + off.value) * (1 + off.mult + 4));
  st.board = boardFrom({ e5: 'B' });
  st.hand[0] = { t: 'N', id: 9, eng: null };
  apply(st, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(st, { type: 'capture', sq: S('e5') });
  assert.equal(st.history.at(-1).score, 30);

  // 절약: 이긴 대국의 남은 희생마다 상금 +1
  const th = scene({ mods: [{ id: 'thrift' }], target: 10 });
  apply(th, { type: 'discard', handIndices: [1] });
  apply(th, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(th, { type: 'capture', sq: S('e5') });
  assert.equal(th.status, 'won');
  assert.equal(th.money, 2);
});

test('마스터 모래시계: 수 2 · 희생 1', () => {
  assert.equal(MASTER_BY_ID.hourglass.text, '수 2 · 희생 1뿐');
  const b = createBattle({ seed: 1, mods: [{ id: 'hourglass', kind: 'master' }] });
  assert.equal(b.movesLeft, 2);
  assert.equal(b.discardsLeft, 1);
});

test('레이팅 계단: 6단(레이팅 2000)부터 희생 −1', () => {
  assert.equal(DANS.find((d) => d.n === 6).text, '희생 −1');
  const r5 = createRun({ draft: false, seed: 9, dan: 5 }); applyRun(r5, { type: 'play' });
  assert.equal(r5.battle.discardsLeft, 3);
  const r6 = createRun({ draft: false, seed: 9, dan: 6 }); applyRun(r6, { type: 'play' });
  assert.equal(r6.battle.discardsLeft, 2);
});

test('이름: 시너지 「희생」은 「불굴」(Resolve), 행동은 「희생」(Sacrifice)', () => {
  const fam = FAMILIES.find((f) => f.id === 'sacrifice');
  assert.equal(fam.name, '불굴');
  assert.ok(!FAMILIES.some((f) => f.name === '희생'));
  assert.equal(tr('불굴'), 'Resolve');
  assert.equal(tr('희생'), 'Sacrifice');
  assert.equal(tr('불굴 시너지'), 'Resolve synergy');
  assert.equal(tr('희생 −1'), '−1 Sacrifice');
});
