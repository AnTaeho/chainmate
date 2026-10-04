import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table } from './helpers/chain.js';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { defineModifier } from '../src/sim/scoring.js';
import { createBattle, apply, legalCommands } from '../src/sim/battle.js';
import { bestMove } from '../src/sim/solver.js';

const LOG = [];
for (const kind of ['master', 'chart', 'engraving', 'maxim']) {
  for (const n of [1, 2]) {
    defineModifier(`t_${kind}${n}`, {
      kind,
      onCapture: () => LOG.push(`cap:${kind}${n}`),
      onChainEnd: () => LOG.push(`end:${kind}${n}`),
    });
  }
}

test('훅 순서: 먹기는 명인→기보→각인→격언, 사슬 끝은 (기보)→각인→격언→명인. 같은 종류는 배열 순서', () => {
  LOG.length = 0;
  const mods = [{ id: 't_maxim2' }, { id: 't_master1' }, { id: 't_maxim1' }, { id: 't_chart1' }];
  const t = table({ e5: 'P' }, mods);
  startChain(t, { type: 'N', sq: S('d3'), engraving: { id: 't_engraving1' } });
  chainCapture(t, S('e5'));
  assert.deepEqual(LOG, [
    'cap:master1', 'cap:chart1', 'cap:engraving1', 'cap:maxim2', 'cap:maxim1',
    'end:chart1', 'end:engraving1', 'end:maxim2', 'end:maxim1', 'end:master1',
  ]);
});

test('기보 레벨: 먹을 때의 모습 기준으로 값·연쇄를 더한다', () => {
  const charts = { id: 'charts', data: { table: { N: { a: 15, b: 1 }, B: { a: 15, b: 1 } }, levels: { N: 2 } } };
  const t = table({ e5: 'B' }, [charts]);
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  const end = ev.at(-1);
  // 기본 30·1 + 나이트 기보 레벨 2: 값 +30, 연쇄 +2. (비숍 레벨 0이라 먹힌 종류로는 안 붙는다)
  assert.equal(end.value, 60);
  assert.equal(end.mult, 3);
  assert.equal(end.score, 180);
  assert.deepEqual(ev.filter((e) => e.type === 'score').map((e) => [e.src, e.value ?? 0, e.mult ?? 0]), [['charts', 30, 0], ['charts', 0, 2]]);
});

defineModifier('t_sacrifice', {
  kind: 'maxim',
  onCut(ctx) { if (!ctx.state.used) { ctx.state.used = true; ctx.cancelCut(); } },
});
test('onCut 취소(「희생」 꼴): 첫 끊김을 무시하고 응수 제한 없이 이어 간다. 상태는 명세에 남는다', () => {
  const mods = [{ id: 't_sacrifice' }];
  const t = table({ e5: 'R', g6: 'N', b5: 'P' }, mods);
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  assert.ok(ev.some((e) => e.type === 'cutIgnored'));
  assert.equal(t.chain.done, false);
  assert.equal(t.chain.forced, null);
  assert.deepEqual(chainCaptures(t), [S('b5')]);
  assert.deepEqual(mods[0].state, { used: true });
  const ev2 = chainCapture(t, S('b5'));
  assert.equal(ev2.at(-1).score, (50 + 10) * 2);
});

defineModifier('t_steady', {
  kind: 'maxim',
  onChainEnd(ctx) { if (ctx.chain.transforms === 0) ctx.mulMult(3); },
});
defineModifier('t_transform', { kind: 'maxim', onTransform: (ctx) => ctx.addMult(2) });
test('갈아입기 반응과 사슬 끝 곱하기', () => {
  const t = table({ e5: 'B' }, [{ id: 't_transform' }, { id: 't_steady' }]);
  startChain(t, { type: 'N', sq: S('d3') });
  const end = chainCapture(t, S('e5')).at(-1);
  assert.equal(end.mult, 3); // 1 + 갈아입기 2, 한결같음은 안 붙음
  const t2 = table({ c5: 'P' }, [{ id: 't_transform' }, { id: 't_steady' }]);
  startChain(t2, { type: 'P', sq: S('b4') });
  const end2 = chainCapture(t2, S('c5')).at(-1);
  assert.equal(end2.mult, 3); // 1 × 3
  assert.equal(end2.score, 30);
});

defineModifier('t_mirror', { kind: 'master', allowCapture: (ctx) => ctx.event.piece !== 'Q' });
test('allowCapture로 먹을 칸을 거른다(응수 대상이 막히면 끊김)', () => {
  const t = table({ d5: 'B', g8: 'Q', b3: 'P' }, [{ id: 't_mirror' }]);
  startChain(t, { type: 'N', sq: S('c3') });
  const ev = chainCapture(t, S('d5'));
  assert.ok(ev.some((e) => e.type === 'cut'));
});

defineModifier('t_hourglass', { kind: 'master', onBattleStart: (ctx) => { ctx.rules.moves = 3; ctx.rules.hand = 3; } });
test('onBattleStart로 규칙을 바꾼다(「모래시계」 · 「무거운 손」 꼴)', () => {
  const b = createBattle({ seed: 3, mods: [{ id: 't_hourglass' }] });
  assert.equal(b.movesLeft, 3);
  assert.equal(b.hand.length, 3);
});

defineModifier('t_feather', { kind: 'engraving', onDropCheck: (ctx) => { ctx.event.allow.attacked = true; } });
test('각인 onDropCheck: 노려지는 칸에도 떨군다(「깃」 꼴), 그 기물에만', () => {
  const b = createBattle({ seed: 1 });
  b.board = boardFrom({ e5: 'P', a3: 'R' });
  b.hand = [{ t: 'N', id: 1, eng: null }, { t: 'N', id: 2, eng: { id: 't_feather' } }];
  const drops = (i) => legalCommands(b).filter((c) => c.type === 'drop' && c.handIndex === i).map((c) => c.sq);
  assert.ok(!drops(0).includes(S('d3')));
  assert.ok(drops(1).includes(S('d3')));
});

defineModifier('t_pawnlove', { kind: 'maxim', onCapture: (ctx) => { if (ctx.event.piece === 'P') ctx.addValue(500); } });
test('풀이기는 조정자까지 돌려 최선을 고른다', () => {
  const setup = (mods) => {
    const b = createBattle({ seed: 1, mods });
    b.board = boardFrom({ e5: 'R', h1: 'P' });
    b.hand = [{ t: 'N', id: 1, eng: null }];
    return b;
  };
  const base = bestMove(setup([]));
  assert.equal(base.score, 50);
  const mod = bestMove(setup([{ id: 't_pawnlove' }]));
  assert.equal(mod.score, 510);
  assert.deepEqual(mod.line, [S('h1')]);
});

test('각인 명세는 그 기물로 떨군 사슬에서만 켜진다(대국 흐름)', () => {
  defineModifier('t_ivory', { kind: 'engraving', onChainEnd: (ctx) => ctx.addValue(30) });
  const b = createBattle({ seed: 1 });
  b.board = boardFrom({ e5: 'R', h1: 'P' });
  b.hand = [{ t: 'N', id: 1, eng: { id: 't_ivory' } }, { t: 'N', id: 2, eng: null }];
  apply(b, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(b, { type: 'capture', sq: S('e5') });
  assert.equal(b.history[0].value, 80);
  assert.equal(b.score, 80);
});

defineModifier('t_counter', { kind: 'engraving', onDrop: (ctx) => { ctx.state.n = (ctx.state.n || 0) + 1; } });
test('풀이기 탐색은 손 기물의 각인 state를 건드리지 않는다', () => {
  const b = createBattle({ seed: 1 });
  b.board = boardFrom({ e5: 'R', h1: 'P' });
  b.hand = [{ t: 'N', id: 1, eng: { id: 't_counter' } }];
  bestMove(b);
  assert.equal(b.hand[0].eng.state, undefined);
});
