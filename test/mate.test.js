// 외통 조건: 한 콤보에서 킹을 지키던 적을 둘 이상 잡았으면 그 콤보로는 킹을 못 잡는다(tuning.js MATE.guardLimit)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table } from './helpers/chain.js';
import { parseSq as S, sqName, boardFrom, kingTakeable } from '../src/sim/board.js';
import { createBattle, refreshHints } from '../src/sim/battle.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { MATE } from '../src/sim/tuning.js';
import '../src/data/maxims.js';

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

test('왕의 목: 지키던 적을 둘 잡은 콤보 동안은 킹이 빛나지 않는다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'kings_neck' }] });
  b.board = boardFrom({ h8: 'K', h1: 'R', a1: 'B', c4: 'P' });
  startChain(b, { type: 'R', sq: S('d1') });
  chainCapture(b, S('h1'));
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, [], 'a1 비숍이 아직 지킨다');
  b.chain.guardsTaken = 2;
  b.board[S('a1')] = null;
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, [], '지키는 적은 없지만 이 콤보로는 못 잡는다');
  b.chain.guardsTaken = 1;
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, [S('h8')]);
});

test('광대가 지키던 킹: 광대를 잡으면 지키던 적으로 센다(kingTakeable과 같은 모습)', () => {
  // h4 광대는 룩 모습으로 h8 킹에 닿는다. d4 룩이 h4를 잡는다
  const t = table({ h8: 'K', h4: 'M' });
  startChain(t, { type: 'R', sq: S('d4') });
  assert.equal(kingTakeable(t.board, S('h8'), S('d4'), { form: 'R' }), false, '화면 규칙도 광대가 지킨다고 본다');
  chainCapture(t, S('h4'));
  assert.equal(t.chain.guardsTaken, 1);
});

test('내 기물 칸 너머에서 지키던 룩도 kingTakeable처럼 센다', () => {
  // h4 내 룩 뒤 h1 룩이 h8 킹을 지킨다(내 칸은 비운 것으로 본다) → h1 · a1 비숍을 잡으면 둘
  const t = table({ h8: 'K', h1: 'R', a1: 'B' });
  startChain(t, { type: 'R', sq: S('h4') });
  assert.equal(kingTakeable(t.board, S('h8'), S('h4'), { form: 'R' }), false);
  chainCapture(t, S('h1'));
  assert.equal(t.chain.guardsTaken, 1);
  chainCapture(t, S('a1'));
  assert.equal(t.chain.guardsTaken, 2);
  assert.ok(!chainCaptures(t).includes(S('h8')), '지키던 적을 둘 잡았다');
});

test('왕의 목: 오페라(openKings) 판에서는 지키던 적을 둘 잡아도 킹이 빛난다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'kings_neck' }] });
  b.board = boardFrom({ h8: 'K', h1: 'R', a1: 'B', c4: 'P' });
  b.rules = { ...b.rules, openKings: true };
  startChain(b, { type: 'R', sq: S('d1') });
  chainCapture(b, S('h1'));
  b.chain.guardsTaken = 2;
  b.board[S('a1')] = null;
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, [S('h8')]);
  assert.ok(chainCaptures(b).includes(S('h8')), '대국 규칙도 잡게 둔다');
});
