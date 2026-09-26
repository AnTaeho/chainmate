import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attackers, captures, dropSquares, boardFrom, parseSq as S, sqName, rankOf } from '../src/sim/board.js';

const names = (list) => list.map(sqName).sort();

test('미끄러지는 선은 적에게도 내 기물에게도 막힌다', () => {
  const b = boardFrom({ a1: 'R', a3: 'P', h8: 'B' });
  assert.deepEqual(names(attackers(b, S('a2'))), ['a1']);
  assert.deepEqual(names(attackers(b, S('a5'))), []); // a3 적 폰이 막음
  assert.deepEqual(names(attackers(b, S('c3'))), ['h8']); // g7..d4가 비었으니 닿는다
});

test('비숍 긴 대각선: 비어 있으면 닿고, 내 기물이 서면 막힌다', () => {
  const b = boardFrom({ h8: 'B' });
  assert.deepEqual(names(attackers(b, S('a1'))), ['h8']);
  b[S('d4')] = { t: 'N', mine: true };
  assert.deepEqual(names(attackers(b, S('a1'))), []);
  assert.deepEqual(names(attackers(b, S('d4'))), ['h8']); // 막는 칸 자체는 노려진다
});

test('내 룩 모습은 첫 적에서 멈춘다', () => {
  const b = boardFrom({ a3: 'P', a5: 'N' });
  assert.deepEqual(names(captures(b, 'R', S('a1'))), ['a3']);
});

test('적 폰은 아래를, 내 폰 모습은 위를 먹는다', () => {
  const b = boardFrom({ d5: 'P' });
  assert.deepEqual(names(attackers(b, S('c4'))), ['d5']);
  assert.deepEqual(names(attackers(b, S('e4'))), ['d5']);
  assert.deepEqual(names(attackers(b, S('c6'))), []);
  assert.deepEqual(names(attackers(b, S('d4'))), []);
  const b2 = boardFrom({ c5: 'N', c3: 'N', e3: 'B' });
  assert.deepEqual(names(captures(b2, 'P', S('d4'))), ['c5']); // 아래(c3·e3)는 못 먹는다
});

test('떨굴 칸: 노려지는 칸 거부, 먹을 적이 있어야 함', () => {
  const b = boardFrom({ e5: 'P', a3: 'R' });
  const drops = names(dropSquares(b, 'N'));
  assert.ok(!drops.includes('d3'), 'a3 룩이 3줄을 노림');
  assert.ok(drops.includes('c4'));
  assert.ok(drops.includes('f7'));
  assert.ok(!drops.includes('f3'), 'f3도 3줄');
  assert.ok(!drops.includes('a1'), '먹을 적이 없음');
  assert.deepEqual(dropSquares(boardFrom({}), 'Q'), []);
});

test('폰은 rank 7(8번째 줄)에 떨굴 수 없다', () => {
  const b = boardFrom({ c7: 'N', e7: 'N', g7: 'N', b7: 'N' }); // 폰이 먹을 수 있는 칸들이 6줄에 모이게
  const drops = dropSquares(b, 'P');
  assert.ok(drops.length > 0);
  assert.ok(drops.every((s) => rankOf(s) !== 7));
  // 규칙 경로 자체: 8번째 줄 칸은 폰에게 절대 나오지 않는다(위로 먹을 칸이 없어도, 있어도)
  for (let f = 0; f < 8; f++) assert.ok(!drops.includes(56 + f));
});

test('킹은 아무도 지키지 않을 때만 먹을 수 있다', () => {
  const b = boardFrom({ e5: 'K', e8: 'R' });
  assert.deepEqual(captures(b, 'N', S('d3')), []);
  assert.ok(!dropSquares(b, 'N').includes(S('d3')));
  const b2 = boardFrom({ e5: 'K' });
  assert.deepEqual(names(captures(b2, 'N', S('d3'))), ['e5']);
});

test('철벽 깃발: 적 폰이 옆 칸도 지킨다', () => {
  const b = boardFrom({ d5: 'P' });
  assert.deepEqual(names(attackers(b, S('e5'))), []);
  assert.deepEqual(names(attackers(b, S('e5'), { pawnSides: true })), ['d5']);
});
