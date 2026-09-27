// 깊이 D: 적 특성 다섯
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, attackers, dropSquares } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { createRun, applyRun } from '../src/sim/run.js';
import { traitChance } from '../src/data/traits.js';
import { bestMove } from '../src/sim/solver.js';

const withTrait = (map, traits) => { const b = boardFrom(map); for (const [n, tr] of Object.entries(traits)) b[S(n)].trait = tr; return b; };
const T = (board) => ({ board, rules: {}, mods: [], chain: null });

test('방패: 사슬의 첫 먹이로는 못 먹는다(떨구기 판정도)', () => {
  const b = withTrait({ c6: 'N', e5: 'R', f5: 'B' }, { e5: 'shield', f5: 'shield' });
  const t = T(b);
  startChain(t, { type: 'N', sq: S('d4') });
  assert.deepEqual(chainCaptures(t), [S('c6')], 'f5 방패는 첫 먹이가 될 수 없다');
  chainCapture(t, S('c6'));
  assert.ok(chainCaptures(t).includes(S('e5')), '둘째부터는 먹는다');
  const only = withTrait({ f5: 'B' }, { f5: 'shield' });
  assert.ok(!dropSquares(only, 'N', {}).includes(S('d4')), '방패만 닿는 칸에는 떨굴 수 없다');
});

test('폭약: 먹히면 둘레 적도 함께 먹힌다', () => {
  const t = T(withTrait({ e6: 'R', e7: 'P', f7: 'N', d5: 'P' }, { e6: 'bomb' }));
  startChain(t, { type: 'N', sq: S('d4') });
  const ev = chainCapture(t, S('e6'));
  assert.equal(ev.filter((e) => e.type === 'pierce').length, 3);
  assert.equal(t.chain.value, 50 + 10 + 30 + 10);
  assert.equal(t.chain.mult, 4);
});

test('거울: 먹어도 모습이 바뀌지 않는다', () => {
  const t = T(withTrait({ e6: 'R' }, { e6: 'mirror' }));
  startChain(t, { type: 'N', sq: S('d4') });
  chainCapture(t, S('e6'));
  assert.equal(t.chain.form, 'N');
});

test('성채: 둘레 여덟 칸을 지킨다', () => {
  const b = withTrait({ d4: 'P' }, { d4: 'fort' });
  for (const n of ['c3', 'd3', 'e3', 'c4', 'e4', 'c5', 'd5', 'e5']) assert.ok(attackers(b, S(n)).includes(S('d4')), n);
});

test('배신자: 먹으면 대국 뒤 내 주머니로', () => {
  const run = createRun({ seed: 3, draft: false });
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.target = 1;
  const m = bestMove(b, { preferMate: 'avoid' });
  const first = m.line[0];
  b.board[first].trait = 'traitor';
  const t = b.board[first].t;
  const n = run.deck.length;
  applyRun(run, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
  while (run.phase === 'battle' && run.battle.status === 'chain') applyRun(run, { type: 'capture', sq: chainCaptures(run.battle)[0] });
  assert.equal(run.deck.length, n + 1);
  assert.equal(run.deck[run.deck.length - 1].t, t);
});

test('특성은 4관부터, 관이 오를수록 자주', () => {
  assert.equal(traitChance(3), 0);
  assert.ok(traitChance(8) > traitChance(4));
  let n = 0;
  for (let seed = 1; seed <= 30; seed++) n += createBattle({ seed, ante: 7 }).board.filter((c) => c && c.trait).length;
  assert.ok(n > 10);
  assert.ok(!createBattle({ seed: 1, ante: 3 }).board.some((c) => c && c.trait));
});
