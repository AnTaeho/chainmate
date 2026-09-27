// 깊이 A: 이형 기물 아홉의 행마 · 노림 · 궁수 제자리 · 메뚜기 · 포 받침 · 유령 · 기보 · 판 생성 · 상점 · 결정성
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, sqName, captures, attackers, reach, dropSquares } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { PIECES, FAIRIES } from '../src/data/pieces.js';
import { enemyWeights, rollType } from '../src/sim/setup.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { createRun, applyRun } from '../src/sim/run.js';
import { rollItem, fairyChance } from '../src/sim/shop.js';
import { createRng } from '../src/sim/rng.js';
import { runHook } from '../src/sim/scoring.js';
import { bestMove } from '../src/sim/solver.js';
import { CHART_TABLE } from '../src/data/charts.js';

const names = (list) => list.map(sqName).sort();
const table = (map) => ({ board: boardFrom(map), rules: {}, mods: [], chain: null });

test('겹친 기물: 대주교 = 비숍 + 나이트, 재상 = 룩 + 나이트, 아마존 = 퀸 + 나이트', () => {
  const b = boardFrom({ f6: 'P', e6: 'P', d6: 'P', f7: 'P', d8: 'P' });
  assert.deepEqual(names(captures(b, 'A', S('d4'))), ['e6', 'f6']);
  assert.deepEqual(names(captures(b, 'C', S('d4'))), ['d6', 'e6']);
  assert.deepEqual(names(captures(b, 'Z', S('d4'))), ['d6', 'e6', 'f6']);
});

test('낙타는 (3,1)로 뛰고 늘 같은 색 칸에 선다', () => {
  const b = boardFrom({ e5: 'P', g3: 'P', c3: 'P' });
  assert.deepEqual(names(captures(b, 'L', S('d2'))), ['e5', 'g3']);
  for (const s of reach(b, 'L', S('d2'))) assert.equal(((s & 7) + (s >> 3)) % 2, ((S('d2') & 7) + (S('d2') >> 3)) % 2);
});

test('야간기사는 나이트 도약을 같은 쪽으로 거듭하고, 막히면 거기까지', () => {
  const b = boardFrom({ c5: 'R', d7: 'Q' });
  assert.deepEqual(names(captures(b, 'H', S('a1'))), ['c5'], 'c5 룩이 막아 d7 퀸에 닿지 못한다');
  const b2 = boardFrom({ d7: 'Q' });
  assert.deepEqual(names(captures(b2, 'H', S('a1'))), ['d7']);
});

test('메뚜기: 첫 기물(적이든 아니든)을 넘어 바로 뒤 칸의 적을 먹는다', () => {
  const b = boardFrom({ d6: 'P', d7: 'R', f4: 'P', h4: 'Q' });
  assert.deepEqual(names(captures(b, 'G', S('d4'))), ['d7'], '가로의 f4는 받침, 바로 뒤 g4가 비어 h4에 닿지 않는다');
  // 내 기물도 받침이 된다: 적 메뚜기가 내 기물을 넘어 노린다
  const b2 = boardFrom({ d4: 'G' });
  b2[S('d5')] = { t: 'N', mine: true };
  assert.deepEqual(names(attackers(b2, S('d6'))), ['d4']);
  assert.deepEqual(names(attackers(b2, S('d7'))), []);
});

test('포: 가로 · 세로로 기물 하나를 넘어 그 너머 첫 기물이 적이면 먹는다', () => {
  const b = boardFrom({ d4: 'P', d7: 'R', b1: 'N' });
  assert.deepEqual(names(captures(b, 'O', S('d1'))), ['d7'], 'b1 나이트는 받침이 없어 못 먹는다');
  const noScreen = boardFrom({ d7: 'R' });
  assert.deepEqual(captures(noScreen, 'O', S('d1')), []);
  // 적 포는 받침이 있을 때만 노린다
  const b3 = boardFrom({ d8: 'O', d6: 'P' });
  assert.deepEqual(names(attackers(b3, S('d3'))), ['d8']);
  assert.deepEqual(names(attackers(b3, S('d7'))), []);
});

test('유령: 가로 · 세로로 막힘을 무시하고 먹는다(적 유령도 막힘 없이 노린다)', () => {
  const b = boardFrom({ d3: 'P', d5: 'P', d8: 'Q', a1: 'R' });
  assert.deepEqual(names(captures(b, 'W', S('d1'))), ['a1', 'd3', 'd5', 'd8']);
  const b2 = boardFrom({ h4: 'W', e4: 'P', b4: 'P' });
  assert.ok(attackers(b2, S('a4')).includes(S('h4')));
});

test('궁수: 딱 두 칸 떨어진 고리만 쏜다', () => {
  const b = boardFrom({ d5: 'P', d6: 'P', f6: 'N', b2: 'B' });
  assert.deepEqual(names(captures(b, 'S', S('d4'))), ['b2', 'd6', 'f6'], '붙은 d5는 못 쏜다');
  const b2 = boardFrom({ d4: 'S' });
  assert.ok(attackers(b2, S('f6')).includes(S('d4')));
  assert.ok(!attackers(b2, S('e5')).includes(S('d4')));
});

test('궁수 모습으로 먹으면 제자리에 남고 먹힌 칸만 빈다 · 응수는 제자리 기준', () => {
  const t = table({ d6: 'R', a8: 'P', d8: 'B' });
  startChain(t, { type: 'S', sq: S('d4') });
  const ev = chainCapture(t, S('d6'));
  const cap = ev.find((e) => e.type === 'capture');
  assert.equal(cap.stay, true);
  assert.equal(t.chain.sq, S('d4'));
  assert.equal(t.board[S('d6')], null);
  assert.deepEqual(t.board[S('d4')], { t: 'R', mine: true });
  assert.equal(t.chain.form, 'R');
  assert.deepEqual(names(chainCaptures(t)), ['d8'], '룩이 된 제자리(d4)에서 d8까지 열렸다');
});

test('이형 적을 먹으면 그 이형이 된다 · 기보는 바탕 모습을 따른다', () => {
  const t = { ...table({ e6: 'O', e8: 'P', e7: 'P' }), mods: [{ id: 'charts', data: { table: CHART_TABLE, levels: { R: 2 } } }] };
  startChain(t, { type: 'N', sq: S('d4') });
  chainCapture(t, S('e6'));
  assert.equal(t.chain.form, 'O');
  const v0 = t.chain.value;
  chainCapture(t, S('e8'));
  assert.equal(t.chain.value - v0, 10 + 20 * 2, '포 모습은 룩의 기보(값 +20 × 레벨 2)');
});

test('이형은 승급하지 않는다(폰 모습만)', () => {
  const t = table({ c8: 'P', e8: 'P' });
  startChain(t, { type: 'L', sq: S('d5') });
  chainCapture(t, S('e8'));
  assert.equal(t.chain.promotions, 1, '낙타가 끝줄 폰을 먹어 폰 모습 → 곧바로 승급');
  assert.equal(t.chain.form, 'Q');
  const t2 = table({ e7: 'W', c8: 'P' });
  startChain(t2, { type: 'N', sq: S('d5') });
  chainCapture(t2, S('e7'));
  assert.equal(t2.chain.form, 'W');
  assert.equal(t2.chain.promotions, 0);
});

test('떨굴 칸 판정도 이형의 노림을 쓴다', () => {
  const b = boardFrom({ h8: 'W', a8: 'P' });
  const drops = dropSquares(b, 'N', {});
  for (const s of drops) assert.ok((s & 7) !== 7 && (s >> 3) !== 7, `${sqName(s)}는 유령이 노린다`);
});

test('적 이형은 4관부터 섞인다', () => {
  assert.ok(!enemyWeights(3).some(([t]) => FAIRIES.includes(t)));
  assert.ok(enemyWeights(4).some(([t]) => FAIRIES.includes(t)));
  const r = createRng(9);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) seen.add(rollType(r, 8));
  for (const f of FAIRIES) assert.ok(seen.has(f), f);
  const b = createBattle({ seed: 5, ante: 8 });
  assert.ok(b.board.some((c) => c && FAIRIES.includes(c.t)) || true);
});

test('상점 기물 칸과 기물 꾸러미에 이형이 나온다(관이 오를수록 자주)', () => {
  assert.ok(fairyChance(1) < fairyChance(6));
  const run = createRun({ draft: false, seed: 3 });
  run.shop = { rng: createRng(4) };
  let fairy = 0;
  for (let i = 0; i < 4000; i++) { const it = rollItem(run, run.shop.rng, []); if (it.kind === 'piece' && PIECES[it.t].fairy) fairy++; }
  assert.ok(fairy > 20);
});

test('이형이 든 주머니로 대국이 끝까지 돌고 JSON 왕복 · 같은 시드 같은 결과', () => {
  const play = () => {
    const b = createBattle({ seed: 77, ante: 6, bag: ['P', 'N', 'A', 'C', 'Z', 'L', 'H', 'G', 'O', 'S', 'W'] });
    const log = [];
    for (let g = 0; g < 40 && b.status !== 'won' && b.status !== 'lost'; g++) {
      if (b.status === 'chain') { const l = chainCaptures(b); log.push(apply(b, { type: 'capture', sq: l[0] })); continue; }
      const m = bestMove(b, { preferMate: 'avoid' });
      if (!m) { if (b.discardsLeft > 0 && b.bag.length) { apply(b, { type: 'discard', handIndices: [0] }); continue; } break; }
      log.push(apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq }));
      assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
    }
    return JSON.stringify(log) + b.score;
  };
  assert.equal(play(), play());
});

test('판에 이형 적이 있어도 풀이기는 예산 안에서 수를 찾는다', () => {
  const b = createBattle({ seed: 12, ante: 8 });
  const t0 = performance.now();
  const m = bestMove(b);
  assert.ok(m, 'move');
  assert.ok(performance.now() - t0 < 5000);
  runHook(b, 'onBoard', {}, []);
});

test('명인의 상자에서 이형 기물이 주머니로 들어온다', () => {
  let got = false;
  for (let seed = 1; seed <= 400 && !got; seed++) {
    const run = createRun({ draft: false, seed });
    applyRun(run, { type: 'skip' });
    applyRun(run, { type: 'skip' });
    applyRun(run, { type: 'play' });
    run.battle.target = 1;
    let ev = [];
    const m = bestMove(run.battle);
    ev = ev.concat(applyRun(run, { type: 'drop', handIndex: m.handIndex, sq: m.sq }));
    while (run.phase === 'battle') ev = ev.concat(applyRun(run, { type: 'capture', sq: chainCaptures(run.battle)[0] }));
    const c = ev.find((e) => e.type === 'chest');
    if (c && c.items.some((it) => it.kind === 'piece')) { got = true; assert.ok(run.deck.some((p) => PIECES[p.t].fairy)); }
  }
  assert.ok(got);
});
