import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attackers, boardFrom, parseSq as S, isEnemy } from '../src/sim/board.js';
import { createBattle, apply, legalCommands, arrive, nearestEmpty, hasLegalDrop, enemyCount } from '../src/sim/battle.js';
import { bestMove } from '../src/sim/solver.js';

const enemies = (b) => b.board.filter(isEnemy);

// 봇: 풀이기 최선 수, 없으면 첫 칸 무르기
function botStep(b, cmds) {
  const m = bestMove(b);
  const run = (c) => { cmds.push(c); apply(b, c); };
  if (!m) { run({ type: 'discard', handIndices: [0] }); return; }
  run({ type: 'drop', handIndex: m.handIndex, sq: m.sq });
  for (const sq of m.line) run({ type: 'capture', sq });
}
function playOut(b) {
  const cmds = [];
  while (b.status === 'play') botStep(b, cmds);
  return cmds;
}

test('대국판 생성: 적 수는 관을 따르고, 킹 하나는 폰 포함 셋(3관부터 넷)이 지킨 채 시작, 시작 손으로 떨굴 수 있다', () => {
  for (let ante = 1; ante <= 8; ante++) {
    for (let seed = 1; seed <= 25; seed++) {
      const b = createBattle({ seed, ante });
      const es = enemies(b);
      assert.equal(es.length, enemyCount(ante));
      const kings = b.board.map((c, sq) => (isEnemy(c) && c.t === 'K' ? sq : -1)).filter((s) => s >= 0);
      assert.equal(kings.length, 1);
      const guards = attackers(b.board, kings[0]);
      assert.ok(guards.length >= (ante >= 3 ? 4 : 3), 'king defended by 3+ (4+ from ante 3)');
      assert.ok(guards.some((s) => b.board[s].t === 'P'), 'one guard is a pawn');
      assert.ok(hasLegalDrop(b));
      assert.equal(b.hand.length, 4);
      assert.equal(b.movesLeft, 4);
      assert.equal(b.discardsLeft, 3);
      assert.equal(b.incoming.length, 2);
    }
  }
});

test('rules로 기본값을 바꾼다(손 · 수 · 무르기 · 킹 수)', () => {
  const b = createBattle({ seed: 5, ante: 8, rules: { hand: 5, moves: 3, discards: 1, kings: 2 } });
  assert.equal(b.hand.length, 5);
  assert.equal(b.movesLeft, 3);
  assert.equal(b.discardsLeft, 1);
  const ks = b.board.map((c, sq) => (isEnemy(c) && c.t === 'K' ? sq : -1)).filter((s) => s >= 0);
  assert.equal(ks.length, 2);
  for (const k of ks) assert.ok(attackers(b.board, k).some((s) => b.board[s].t === 'P') && attackers(b.board, k).length >= 4);
});

test('증원은 예고된 칸에 들어온다', () => {
  const b = createBattle({ seed: 11, ante: 4 });
  const planned = b.incoming.map((r) => ({ ...r }));
  botStep(b, []);
  assert.equal(b.status, 'play', '이 시드는 첫 수에 외통이 없다');
  for (const r of planned) {
    assert.equal(b.board[r.sq].t, r.t);
    assert.equal(b.board[r.sq].born, 1);
  }
  assert.equal(b.incoming.length, 2, '다음 예고가 새로 걸린다');
});

test('예고 칸이 막혔으면 가장 가까운 빈칸', () => {
  const b = createBattle({ seed: 1 });
  b.board = boardFrom({ d4: 'P', d5: 'P', c4: 'N', e4: 'N', d3: 'B' });
  b.incoming = [{ sq: S('d4'), t: 'R' }];
  // 거리 1 빈칸 중 맨해튼 거리가 짧은 것: c4 e4 d3 d5는 찼음 → 남은 거리 1 칸은 모두 대각(맨해튼 2) → 칸 번호가 가장 작은 c3
  assert.equal(nearestEmpty(b.board, S('d4')), S('c3'));
  const ev = [];
  arrive(b, ev);
  assert.equal(b.board[S('c3')].t, 'R');
  assert.deepEqual(ev[0], { type: 'reinforce', sq: S('c3'), planned: S('d4'), piece: 'R' });
});

test('명령으로만 진행: 사슬 중 legalCommands는 응수 칸만, 외통이면 이긴다', () => {
  const b = createBattle({ seed: 1 });
  b.board = boardFrom({ d5: 'B', g8: 'Q', g7: 'P', f8: 'P', a8: 'R', a4: 'K', f3: 'P' });
  b.hand = [{ t: 'N', id: 1, eng: null }];
  assert.ok(legalCommands(b).some((c) => c.type === 'drop' && c.sq === S('c3')));
  apply(b, { type: 'drop', handIndex: 0, sq: S('c3') });
  assert.equal(b.status, 'chain');
  apply(b, { type: 'capture', sq: S('d5') });
  assert.deepEqual(b.chain.forced, [S('g8')]);
  assert.deepEqual(legalCommands(b), [{ type: 'capture', sq: S('g8') }]);
  for (const sq of ['g8', 'g7', 'f8', 'a8', 'a4']) apply(b, { type: 'capture', sq: S(sq) });
  assert.equal(b.status, 'won');
  assert.equal(b.result.reason, 'mate');
  assert.equal(b.score, 2040);
  assert.throws(() => apply(b, { type: 'discard', handIndices: [0] }));
});

test('목표 넘기면 즉시 이김, 수를 다 쓰면 짐', () => {
  const w = createBattle({ seed: 2, target: 1 });
  botStep(w, []);
  assert.equal(w.status, 'won');
  let lostByMoves = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const l = createBattle({ seed, target: 1e9 });
    playOut(l);
    if (l.status === 'won') { assert.equal(l.result.reason, 'mate'); continue; }
    assert.equal(l.status, 'lost');
    if (l.result.reason === 'moves') { lostByMoves++; assert.equal(l.movesLeft, 0); }
  }
  assert.ok(lostByMoves > 0);
});

test('무르기: 골라 버리고 다시 뽑는다, 떨굴 수 없고 무르기도 없으면 짐', () => {
  const b = createBattle({ seed: 4 });
  const before = b.hand.map((p) => p.id);
  apply(b, { type: 'discard', handIndices: [0, 2] });
  assert.equal(b.discardsLeft, 2);
  assert.equal(b.hand.length, 4);
  assert.deepEqual(b.used.map((p) => p.id).sort(), [before[0], before[2]].sort());
  const saved = b.bag;
  b.bag = [];
  assert.throws(() => apply(b, { type: 'discard', handIndices: [0] }), /bag is empty/);
  assert.ok(!legalCommands(b).some((c) => c.type === 'discard'));
  b.bag = saved;
  b.board = boardFrom({});
  b.discardsLeft = 1;
  apply(b, { type: 'discard', handIndices: [0] });
  assert.equal(b.status, 'lost');
  assert.equal(b.result.reason, 'stuck');
});

test('결정성: 같은 시드 + 같은 명령 = 같은 JSON, 저장했다 되살려도 같다', () => {
  for (const ante of [1, 5, 8]) {
    const a = createBattle({ seed: 42, ante });
    const cmds = playOut(a);
    const b = createBattle({ seed: 42, ante });
    for (const c of cmds) apply(b, c);
    assert.equal(JSON.stringify(a), JSON.stringify(b));

    // 두 수째 앞에서 JSON으로 저장 → 되살려 이어 간다
    const c = createBattle({ seed: 42, ante });
    const firstMoveEnd = cmds.findIndex((x, i) => i > 0 && x.type !== 'capture');
    const cut = firstMoveEnd < 0 ? cmds.length : firstMoveEnd;
    for (const x of cmds.slice(0, cut)) apply(c, x);
    const d = JSON.parse(JSON.stringify(c));
    for (const x of cmds.slice(cut)) apply(d, x);
    assert.equal(JSON.stringify(d), JSON.stringify(a));
  }
  assert.notEqual(JSON.stringify(createBattle({ seed: 1 }).board), JSON.stringify(createBattle({ seed: 2 }).board));
});

test('하위 스트림은 서로 흔들지 않는다: 주머니가 달라도 판은 같다', () => {
  const a = createBattle({ seed: 9, ante: 3, bag: ['Q', 'Q', 'Q', 'Q', 'R', 'R'] });
  const b = createBattle({ seed: 9, ante: 3, bag: ['Q', 'Q', 'Q', 'Q', 'R', 'R', 'N'] });
  assert.deepEqual(a.board, b.board);
  assert.deepEqual(a.incoming, b.incoming);
});

test('판의 첫 대국(1관 연습)은 시작 손으로 셋 잇는 사슬이 있다', async () => {
  const { createRun, applyRun } = await import('../src/sim/run.js');
  const { bestMove } = await import('../src/sim/solver.js');
  const { hasChainOf } = await import('../src/sim/battle.js');
  let ok = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRun({ draft: false, seed });
    applyRun(run, { type: 'play' });
    const best = bestMove(run.battle, { preferMate: 'avoid' });
    if (best.captures >= 3 || hasChainOf(run.battle, 3)) ok++;
  }
  assert.ok(ok >= 58, `셋 잇는 판 ${ok}/60`);
});

test('막히면 대국마다 한 번 손을 새로 쥔다(손 · 쓴 기물을 주머니에 섞어 다시 뽑기)', async () => {
  const { checkStuck } = await import('../src/sim/battle.js');
  const b = createBattle({ seed: 5 });
  // 폰만 쥐었고(적이 맨 아래 줄뿐이라 폰은 못 먹는다) 무르기도 주머니도 없다. 쓴 기물에 나이트가 있다
  b.board = boardFrom({ e1: 'B', a1: 'R' });
  b.hand = [{ t: 'P', id: 1, eng: null }];
  b.bag = [];
  b.used = [{ t: 'N', id: 3, eng: null }, { t: 'N', id: 4, eng: null }];
  b.discardsLeft = 0;
  const events = [];
  checkStuck(b, events);
  assert.equal(b.status, 'play');
  assert.ok(events.some((e) => e.type === 'regrip'));
  assert.equal(b.regrip, true);
  assert.equal(b.hand.length + b.bag.length, 3);
  // 두 번째로 막히면 진다
  b.hand = [{ t: 'P', id: 1, eng: null }]; b.bag = []; b.used = [];
  const ev2 = [];
  checkStuck(b, ev2);
  assert.equal(b.status, 'lost');
  assert.equal(b.result.reason, 'stuck');
});

test('미리 보기: 먹기 전에 바뀐 모습 · 값 · 연쇄 · 다음 적 · 끊김이 실제와 같고 대국은 그대로', async () => {
  const { previewCapture, previewDrop } = await import('../src/sim/solver.js');
  const { chainCaptures } = await import('../src/sim/chain.js');
  for (let seed = 1; seed <= 40; seed++) {
    const b = createBattle({ seed, ante: 3, mods: [{ id: 'quick_change' }, { id: 'center' }] });
    const drop = legalCommands(b).find((c) => c.type === 'drop');
    if (!drop) continue;
    const pd = previewDrop(b, drop.handIndex, drop.sq);
    const before = JSON.stringify(b);
    apply(b, drop);
    if (b.status !== 'chain') continue;
    assert.deepEqual(pd.next.slice().sort(), chainCaptures(b).slice().sort());
    for (let k = 0; k < 6 && b.status === 'chain' && !b.chain.awaiting; k++) {
      const sq = chainCaptures(b)[0];
      const snap = JSON.stringify(b);
      const pv = previewCapture(b, sq);
      assert.equal(JSON.stringify(b), snap, '미리 보기가 대국을 바꾸지 않는다');
      const v0 = b.chain.value, m0 = b.chain.mult;
      const ev = apply(b, { type: 'capture', sq });
      const end = ev.find((e) => e.type === 'end');
      if (end) {
        assert.equal(pv.done, true);
        assert.equal(pv.reason, end.reason);
        assert.equal(pv.score, end.score);
        assert.equal(!!pv.cut, end.reason === 'cut');
        break;
      }
      assert.equal(pv.form, b.chain.form);
      assert.equal(pv.value, b.chain.value - v0);
      assert.equal(pv.mult, b.chain.mult - m0);
      assert.deepEqual(pv.next.slice().sort(), chainCaptures(b).slice().sort());
    }
    assert.ok(before);
  }
});
