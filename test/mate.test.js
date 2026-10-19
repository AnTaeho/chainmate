// 외통 조건: 한 콤보에서 킹을 지키던 적을 둘 이상 잡았으면 그 콤보로는 킹을 못 잡는다(tuning.js MATE.guardLimit)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table } from './helpers/chain.js';
import { parseSq as S, sqName } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { MATE } from '../src/sim/tuning.js';

const names = (list) => list.map(sqName).sort();

// h8 킹을 h1 룩(세로) · a1 비숍(대각)이 지킨다. d1 룩으로 떨궈 h1 → a1을 잡으면 비숍 모습으로 h8이 열린다.
const twoGuards = () => {
  const t = table({ h8: 'K', h1: 'R', a1: 'B' });
  startChain(t, { type: 'R', sq: S('d1') });
  chainCapture(t, S('h1'));
  assert.deepEqual(names(chainCaptures(t)), ['a1'], '킹은 a1 비숍이 지킨다');
  chainCapture(t, S('a1'));
  return t;
};

test('킹을 지키던 적을 둘 잡은 콤보는 킹을 못 잡는다', () => {
  assert.equal(MATE.guardLimit, 1);
  const t = twoGuards();
  assert.equal(t.chain.guardsTaken, 2);
  assert.deepEqual(chainCaptures(t), [], '지키는 적은 없어졌지만 이 콤보로는 못 잡는다');
  assert.equal(t.chain.done, true);
  assert.notEqual(t.chain.reason, 'mate');
});

test('옛 규칙(guardLimit Infinity)이면 같은 장면에서 킹을 잡는다', () => {
  const keep = MATE.guardLimit;
  MATE.guardLimit = Infinity;
  try {
    const t = twoGuards();
    assert.deepEqual(names(chainCaptures(t)), ['h8']);
    const ev = chainCapture(t, S('h8'));
    assert.equal(ev.at(-1).reason, 'mate');
  } finally { MATE.guardLimit = keep; }
});

test('지키던 적을 하나만 잡았으면 킹을 잡아 체크메이트한다', () => {
  const t = table({ h8: 'K', h1: 'R', c1: 'P' });
  startChain(t, { type: 'R', sq: S('d1') });
  chainCapture(t, S('h1'));
  assert.equal(t.chain.guardsTaken, 1);
  assert.ok(chainCaptures(t).includes(S('h8')));
  const ev = chainCapture(t, S('h8'));
  assert.equal(ev.at(-1).reason, 'mate');
});

test('폭약에 함께 터진 지키던 적은 세지 않는다', () => {
  // b1 룩(폭약)을 잡으면 a1 비숍이 함께 터진다 → h1 룩(지키던 적 하나) → h8 킹
  const t = table({ h8: 'K', h1: 'R', a1: 'B', b1: 'R' });
  t.board[S('b1')].trait = 'bomb';
  startChain(t, { type: 'R', sq: S('d1') });
  chainCapture(t, S('b1'));
  assert.equal(t.board[S('a1')], null, '비숍은 폭약에 터졌다');
  assert.equal(t.chain.guardsTaken || 0, 0);
  chainCapture(t, S('h1'));
  assert.equal(t.chain.guardsTaken, 1);
  assert.ok(chainCaptures(t).includes(S('h8')));
  assert.equal(chainCapture(t, S('h8')).at(-1).reason, 'mate');
});
