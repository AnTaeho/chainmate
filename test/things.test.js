// 깊이 F: 판 위 사물(벽 · 보석) · 묘수 · 진화
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, captures, attackers } from '../src/sim/board.js';
import { startChain, chainCapture } from '../src/sim/chain.js';
import { createBattle } from '../src/sim/battle.js';
import { createRun, applyRun, legalRunCommands } from '../src/sim/run.js';
import { evolveTo, EVOLVE } from '../src/data/tactics.js';
import { PIECES } from '../src/data/pieces.js';

test('벽: 먹을 수 없고 미끄러짐을 막으며 포의 받침이 된다', () => {
  const b = boardFrom({ d5: 'X', d7: 'R' });
  assert.deepEqual(captures(b, 'R', S('d1')), [], '벽은 먹을 수 없고 그 너머도 막힌다');
  assert.deepEqual(captures(b, 'O', S('d1')), [S('d7')], '포는 벽을 넘는다');
  assert.deepEqual(attackers(b, S('d4')), [], '벽은 지키지 않는다');
});

test('보석: 먹으면 상금 +2, 모습은 그대로, 아무도 지키지 않는다', () => {
  const t = { board: boardFrom({ e6: 'J', f8: 'P' }), rules: {}, mods: [], chain: null };
  startChain(t, { type: 'N', sq: S('d4') });
  const ev = chainCapture(t, S('e6'));
  assert.equal(t.chain.form, 'N');
  assert.equal(t.chain.money, 2);
  assert.ok(ev.some((e) => e.type === 'money' && e.src === 'gem'));
  assert.equal(t.chain.value, PIECES.J.value);
});

test('2관부터 판에 사물이 드물게 섞인다', () => {
  let gem = 0, wall = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const b = createBattle({ seed, ante: 3 });
    if (b.board.some((c) => c && c.t === 'J')) gem++;
    if (b.board.some((c) => c && c.t === 'X')) wall++;
    assert.ok(!createBattle({ seed, ante: 1 }).board.some((c) => c && (c.t === 'X' || c.t === 'J')));
  }
  assert.ok(gem > 5 && wall > 5, `${gem} ${wall}`);
});

test('묘수: 빙결 · 재장전 · 도발은 대국 중 떨구기 전에만, 쓰면 사라진다', () => {
  const run = createRun({ seed: 5, draft: false });
  run.consumables.push({ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'reload' });
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'use'), '상점 · 관 선택에서는 못 쓴다');
  applyRun(run, { type: 'play' });
  assert.ok(legalRunCommands(run).some((c) => c.type === 'tactic'));
  const moves = run.battle.movesLeft;
  applyRun(run, { type: 'tactic', index: 1 });
  assert.equal(run.battle.movesLeft, moves + 1);
  const ev = applyRun(run, { type: 'tactic', index: 0 });
  const fr = ev.find((e) => e.type === 'freeze');
  assert.equal(fr.squares.length, 3);
  for (const sq of fr.squares) for (let s = 0; s < 64; s++) assert.ok(!attackers(run.battle.board, s).includes(sq));
  assert.equal(run.consumables.length, 0);
  const b2 = createRun({ seed: 5, draft: false });
  b2.consumables.push({ kind: 'tactic', id: 'taunt' });
  applyRun(b2, { type: 'play' });
  const n0 = b2.battle.board.filter((c) => c && !c.mine).length;
  applyRun(b2, { type: 'tactic', index: 0 });
  assert.equal(b2.battle.board.filter((c) => c && !c.mine).length, n0 + 4);
});

test('진화: 주머니 기물 하나를 그 종류의 이형으로(결정적)', () => {
  const run = createRun({ seed: 7, draft: false });
  run.phase = 'shop'; run.shop = {};
  run.consumables.push({ kind: 'evolve' });
  const p = run.deck.find((x) => x.t === 'R');
  const to = evolveTo(run.seed, p);
  assert.ok(EVOLVE.R.includes(to));
  applyRun(run, { type: 'use', index: 0, target: p.id });
  assert.equal(p.t, to);
  assert.ok(PIECES[to].fairy);
});

test('도박 물건: 사는 순간 결과가 정해진다(같은 판 · 같은 칸이면 같은 결과)', () => {
  const buy = (id) => {
    const run = createRun({ seed: 9, draft: false });
    run.phase = 'shop'; run.money = 20;
    run.shop = { rng: null, display: [{ kind: 'gamble', id, price: 2 }], packs: [], rerolls: 0 };
    const ev = applyRun(run, { type: 'buy', slot: 0 });
    return { run, g: ev.find((e) => e.type === 'gamble') };
  };
  const a = buy('roulette'), b = buy('roulette');
  assert.deepEqual(a.g, b.g);
  assert.ok(PIECES[a.g.to].fairy);
  assert.equal(a.run.deck.find((p) => p.id === a.g.pieceId).t, a.g.to);
  const c = buy('potion');
  const p = c.run.deck.find((x) => x.id === c.g.pieceId);
  assert.ok(p.soul || p.eng);
});
