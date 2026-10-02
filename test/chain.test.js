import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, sqName } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';

const table = (map) => ({ board: boardFrom(map), rules: {}, mods: [], chain: null });
const names = (list) => list.map(sqName).sort();
const types = (events) => events.map((e) => e.type);

// 손으로 만든 장면 하나로 응수(이어짐) · 같은 종류 먹기 · 승급 뒤 퀸으로 응수 · 사슬 중 외통을 한 번에 본다.
//   c3 N 떨굼 → d5 B(대각선의 g8 퀸이 노림: 응수) → g8 Q → g7 P(f8 폰이 노림: 응수)
//   → f8 P(같은 종류, 승급 → a8 룩이 노림: 퀸으로 응수) → a8 R → a4 K(지키던 룩이 사라짐: 외통)
test('장면: 응수 · 승급 뒤 응수 · 외통, 값 340 × 연쇄 6 = 2040', () => {
  const t = table({ d5: 'B', g8: 'Q', g7: 'P', f8: 'P', a8: 'R', a4: 'K', f3: 'P' });
  startChain(t, { type: 'N', sq: S('c3') });
  assert.deepEqual(names(chainCaptures(t)), ['d5'], '킹 a4는 a8 룩이 지켜서 못 먹는다');

  let ev = chainCapture(t, S('d5'));
  assert.deepEqual(types(ev), ['capture', 'transform', 'forced']);
  assert.deepEqual(names(t.chain.forced), ['g8']);
  assert.deepEqual(names(chainCaptures(t)), ['g8'], '비숍으로는 a8 · f3도 닿지만 응수가 먼저');

  ev = chainCapture(t, S('g8'));
  assert.deepEqual(types(ev), ['capture', 'transform']);
  assert.equal(t.chain.forced, null);
  assert.deepEqual(names(chainCaptures(t)), ['f8', 'g7']);

  ev = chainCapture(t, S('g7'));
  assert.deepEqual(types(ev), ['capture', 'grade', 'transform', 'forced'], '셋째 먹기에 평가 「!」');
  assert.deepEqual(ev.find((e) => e.type === 'grade'), { type: 'grade', n: 3, mark: '★' });
  assert.deepEqual(names(t.chain.forced), ['f8']);

  ev = chainCapture(t, S('f8'));
  assert.deepEqual(types(ev), ['capture', 'promote', 'forced'], '폰→폰은 갈아입기 없음, 승급 뒤 응수');
  assert.equal(t.chain.form, 'Q');
  assert.deepEqual(names(t.chain.forced), ['a8']);
  assert.deepEqual(names(chainCaptures(t)), ['a8'], '퀸으로는 f3도 닿지만 응수가 먼저');

  ev = chainCapture(t, S('a8'));
  assert.deepEqual(types(ev), ['capture', 'grade', 'transform'], '다섯째 먹기에 「!!」');
  assert.equal(ev[1].mark, '★★');
  assert.deepEqual(names(chainCaptures(t)), ['a4'], '지키던 룩이 사라져 킹을 먹을 수 있다');

  ev = chainCapture(t, S('a4'));
  assert.deepEqual(types(ev), ['capture', 'mate', 'end']);
  const end = ev.at(-1);
  assert.equal(end.reason, 'mate');
  assert.equal(end.value, 30 + 90 + 10 + 10 + 50 + 150);
  assert.equal(end.mult, 6);
  assert.equal(end.score, 2040);
  assert.equal(t.chain.done, true);
  assert.equal(t.board[S('a4')], null, '끝나면 내 기물은 판에서 내려간다');
});

test('같은 칸에 폰 모습으로 도착했다면 끊겼을 자리: 승급이 먼저라 퀸으로 응수', () => {
  // 위 장면의 f8 한 칸만 떼어 본다: 승급이 없다면 폰 모습은 a8을 못 먹어 끊김
  const t = table({ f8: 'P', a8: 'R', h1: 'P' });
  startChain(t, { type: 'P', sq: S('g7') });
  const ev = chainCapture(t, S('f8'));
  assert.ok(types(ev).includes('promote'));
  assert.ok(!types(ev).includes('cut'));
});

test('응수 실패 → 끊김: 룩 모습을 나이트가 노린다. 값·연쇄는 인정', () => {
  const t = table({ e5: 'R', g6: 'N', b5: 'P' });
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  assert.deepEqual(types(ev), ['capture', 'transform', 'cut', 'end']);
  const end = ev.at(-1);
  assert.equal(end.reason, 'cut');
  assert.equal(end.value, 50);
  assert.equal(end.mult, 1);
  assert.equal(end.score, 50);
  assert.deepEqual(names(ev.find((e) => e.type === 'cut').attackers), ['g6']);
  assert.equal(t.board[S('e5')], null, '되잡힘: 내 기물은 판에서 사라진다');
  assert.equal(t.board[S('b5')].t, 'P', '룩 모습이 닿던 b5는 그대로');
});

test('노리는 킹: 지켜지면 못 먹어서 끊김, 아무도 안 지키면 먹고 외통', () => {
  const guarded = table({ e5: 'B', f6: 'K', f8: 'R', a1: 'P' });
  startChain(guarded, { type: 'N', sq: S('d3') });
  let ev = chainCapture(guarded, S('e5'));
  assert.ok(types(ev).includes('cut'));

  const open = table({ e5: 'B', f6: 'K', a1: 'P' });
  startChain(open, { type: 'N', sq: S('d3') });
  ev = chainCapture(open, S('e5'));
  assert.deepEqual(names(open.chain.forced), ['f6']);
  ev = chainCapture(open, S('f6'));
  assert.deepEqual(types(ev), ['capture', 'mate', 'end']);
  assert.equal(ev.at(-1).score, (30 + 150) * 2);
});

test('노림수가 둘이면 하나만 먹으면 되고, 새 칸에서 다시 판정', () => {
  // e5 비숍을 먹으면 d6 폰과 h8 퀸이 함께 노린다(비숍 모습: 둘 다 대각선)
  const t = table({ e5: 'B', d6: 'P', h8: 'Q' });
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.deepEqual(names(t.chain.forced), ['d6', 'h8']);
  assert.deepEqual(names(chainCaptures(t)), ['d6', 'h8']);
  const ev = chainCapture(t, S('d6'));
  // d6 폰 모습: h8 퀸의 대각선(g7 f6 e5 d4…)에 d6은 없음 → 노림수 없음. 위로 먹을 게 없어 막힘
  assert.deepEqual(types(ev), ['capture', 'transform', 'end']);
  assert.equal(ev.at(-1).reason, 'blocked');
});

test('떨군 뒤 먹을 게 없는 선택지는 없다 · 잘못된 먹기는 거부', () => {
  const t = table({ e5: 'P' });
  startChain(t, { type: 'N', sq: S('d3') });
  assert.throws(() => chainCapture(t, S('a1')));
});
