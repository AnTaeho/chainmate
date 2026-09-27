// 깊이 E: 정석 드래프트와 정석 각각
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, captures } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { createRun, applyRun, legalRunCommands, blindInfo, battleMods } from '../src/sim/run.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { JOSEKIS, JOSEKI_BY_ID, collinear5 } from '../src/data/josekis.js';
import { familyCounts } from '../src/data/families.js';
import { bestMove } from '../src/sim/solver.js';

const T = (map, id, rules = {}) => ({ board: boardFrom(map), rules, mods: [{ id: `joseki:${id}` }], chain: null, movesUsed: 0 });

test('판은 1관 정석 셋 중 하나로 시작하고, 3관 · 5관 첫 대국 앞에 다시 고른다', () => {
  const run = createRun({ seed: 4 });
  assert.equal(run.phase, 'draft');
  assert.equal(run.draft.options.length, 3);
  assert.equal(new Set(run.draft.options).size, 3);
  assert.deepEqual(legalRunCommands(run).map((c) => c.type), ['joseki', 'joseki', 'joseki']);
  assert.throws(() => applyRun(run, { type: 'play' }));
  const id = run.draft.options[1];
  applyRun(run, { type: 'joseki', index: 1 });
  assert.deepEqual(run.josekis, [id]);
  assert.equal(run.phase, 'select');
  // 2관은 없고 3관 첫 대국 앞에 다시
  for (let a = 1; a <= 2; a++) for (let k = 0; k < 3; k++) { run.phase = 'shop'; run.shop = {}; applyRun(run, { type: 'leave' }); }
  assert.equal(run.ante, 3);
  assert.equal(run.phase, 'draft');
  assert.ok(!run.draft.options.includes(id), '가진 정석은 다시 나오지 않는다');
  assert.deepEqual(JSON.parse(JSON.stringify(run)), run);
});

test('같은 시드면 같은 정석 셋', () => {
  assert.deepEqual(createRun({ seed: 9 }).draft, createRun({ seed: 9 }).draft);
});

test('정석마다 가족 · 글이 있고 가족 수에 들어간다', () => {
  for (const j of JOSEKIS) assert.ok(j.name && j.text && ['silver', 'gold', 'rainbow'].includes(j.tier), j.id);
  const n = familyCounts({ maxims: [], deck: [], josekis: ['rampart', 'knight_oath'] });
  assert.equal(n.leap, 2);
  assert.equal(n.line, 1);
});

test('기물을 바꾸는 정석: 기사 서약 · 성벽 쌓기 · 주교관 · 활터', () => {
  const run = createRun({ seed: 1, draft: false });
  JOSEKI_BY_ID.knight_oath.pick(run, []);
  JOSEKI_BY_ID.rampart.pick(run, []);
  JOSEKI_BY_ID.mitre.pick(run, []);
  JOSEKI_BY_ID.archery.pick(run, []);
  const kinds = run.deck.map((p) => p.t).sort().join('');
  assert.equal(kinds, 'ACHHPPSS');
});

test('고속도로: b · g 줄에서는 세로로 룩처럼도 먹는다', () => {
  const b = boardFrom({ b7: 'P' });
  assert.equal(captures(b, 'N', S('b2'), {}).length, 0);
  assert.deepEqual(captures(b, 'N', S('b2'), { highways: [1, 6] }), [S('b7')]);
  const bt = createBattle({ seed: 3, mods: [{ id: 'joseki:highway' }] });
  assert.deepEqual(bt.rules.highways, [1, 6]);
});

test('발판: 발판 위의 적을 먹으면 연쇄 ×2', () => {
  const t = T({ e6: 'B' }, 'stepping', { steps: [S('e6')] });
  startChain(t, { type: 'N', sq: S('d4') });
  chainCapture(t, S('e6'));
  assert.equal(t.chain.mult, 2);
  const bt = createBattle({ seed: 3, mods: [{ id: 'joseki:stepping' }] });
  assert.equal(bt.rules.steps.length, 3);
});

test('흡수의 비전: 첫 사슬은 모습이 그대로이고 먹은 행마가 더해진다', () => {
  const t = T({ e6: 'B', a8: 'R', g8: 'P' }, 'absorb_art');
  startChain(t, { type: 'N', sq: S('d4') });
  chainCapture(t, S('e6'));
  assert.equal(t.chain.form, 'N');
  assert.deepEqual(t.chain.absorbed, ['B']);
  assert.ok(chainCaptures(t).includes(S('g8')), '비숍 행마로 g8');
  const t2 = { ...T({ e6: 'B' }, 'absorb_art'), movesUsed: 1 };
  startChain(t2, { type: 'N', sq: S('d4') });
  chainCapture(t2, S('e6'));
  assert.equal(t2.chain.form, 'B', '둘째 사슬부터는 보통');
});

test('판의 문: 문 위의 적을 먹으면 다른 문으로 나온다', () => {
  const t = T({ e6: 'B', a3: 'P' }, 'gates', { gates: [S('e6'), S('c1')] });
  startChain(t, { type: 'N', sq: S('d4') });
  const ev = chainCapture(t, S('e6'));
  assert.ok(ev.some((e) => e.type === 'gate'));
  assert.equal(t.chain.sq, S('c1'));
  assert.deepEqual(chainCaptures(t), [S('a3')], '비숍 모습으로 c1에서 a3');
});

test('순교의 맹세: 끊기는 순간 둘레 적을 먹은 것으로', () => {
  const t = T({ e6: 'P', e8: 'R', d7: 'N', f5: 'P' }, 'martyr_vow');
  startChain(t, { type: 'B', sq: S('c4') });
  chainCapture(t, S('e6'));
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.board[S('d7')], null);
  assert.equal(t.board[S('f5')], null);
  assert.equal(t.chain.value, 10 + 30 + 10);
});

test('결사: 대국 첫 사슬 ×3, 그 기물은 판에서 사라진다', () => {
  const run = createRun({ seed: 2, draft: false });
  run.josekis = ['pact'];
  applyRun(run, { type: 'play' });
  const b = run.battle;
  const m = bestMove(b, { preferMate: 'avoid' });
  const pid = b.hand[m.handIndex].id;
  applyRun(run, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
  for (const sq of m.line) if (run.phase === 'battle' && run.battle.status === 'chain') applyRun(run, { type: 'capture', sq });
  assert.ok(run.battle ? run.battle.exiled.includes(pid) : true);
  if (run.phase !== 'battle') assert.ok(!run.deck.some((p) => p.id === pid));
});

test('하이랜더: 같은 종류가 없으면 목표 절반', () => {
  const run = createRun({ seed: 2, draft: false });
  const t0 = blindInfo(run).target;
  run.josekis = ['highlander'];
  assert.equal(blindInfo(run).target, t0);
  run.deck = run.deck.filter((p, i, a) => a.findIndex((q) => q.t === p.t) === i).concat([{ id: 50, t: 'Q' }, { id: 51, t: 'L' }]);
  assert.equal(blindInfo(run).target, Math.round(t0 / 2));
});

test('오목: 한 줄에 다섯 칸을 밟은 사슬은 대국을 곧바로 이긴다', () => {
  assert.ok(collinear5([0, 1, 2, 3, 4]));
  assert.ok(collinear5([0, 9, 18, 27, 36, 5]));
  assert.ok(!collinear5([0, 1, 2, 3, 12]));
  const t = T({ d3: 'R', d5: 'R', d7: 'R', d8: 'R', a1: 'P' }, 'gomoku');
  startChain(t, { type: 'R', sq: S('d1') });
  for (const x of ['d3', 'd5', 'd7']) chainCapture(t, S(x));
  assert.ok(!t.chain.flags.gomoku, '넷까지는 아니다');
  const ev = chainCapture(t, S('d8'));
  assert.ok(t.chain.flags.gomoku && ev.some((e) => e.type === 'gomoku'));
  // 대국에서: 깃 각인(노려진 칸에 떨굼)으로 d1에 떨궈 끝까지 → 곧바로 이김
  const bt = createBattle({ seed: 1, mods: [{ id: 'joseki:gomoku' }], target: 1e12 });
  bt.board = boardFrom({ d3: 'R', d5: 'R', d7: 'R', d8: 'R', a5: 'K', a6: 'P', b6: 'P' });
  bt.hand = [{ t: 'R', id: 1, eng: { id: 'feather' } }];
  apply(bt, { type: 'drop', handIndex: 0, sq: S('d1') });
  for (const x of ['d3', 'd5', 'd7', 'd8']) if (bt.status === 'chain') apply(bt, { type: 'capture', sq: S(x) });
  assert.equal(bt.status, 'won');
  assert.equal(bt.result.reason, 'gomoku');
});

test('왕좌: 폰으로 떨궈 승급하면 그 폰이 주머니에 퀸으로', () => {
  const t = T({ c7: 'P', d8: 'P' }, 'throne');
  startChain(t, { type: 'P', sq: S('b6') });
  chainCapture(t, S('c7'));
  chainCapture(t, S('d8'));
  assert.equal(t.chain.promotions, 1);
  assert.equal(t.chain.throne, true);
});

test('복제: 가장 많이 모은 가족의 문턱이 하나 낮다', () => {
  const build = { deck: [{ t: 'L' }], maxims: [], charts: {}, josekis: ['clone'] };
  assert.ok(battleMods(build).some((m) => m.id === 'family:leap' && m.data.level === 1));
});
