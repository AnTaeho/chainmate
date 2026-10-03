// 복기(CHM-59, src/sim/replay.js): 갈림길 찾기 · 길 없음 · 결정성 · 예산 초과 · 찾은 길을 실제 규칙으로 다시 두면 이긴다.
// 화면 글(src/ui/review.js): 갈림길 카드 문장 · 표시 칸 · 영어.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../src/sim/run.js'; // 조정자 등록
import { createBattle, apply } from '../src/sim/battle.js';
import { bestMove } from '../src/sim/solver.js';
import { noteStep, review, reviewGen, findWin, cloneBattle, decisionCommands, REVIEW } from '../src/sim/replay.js';
import { decideBattle } from '../tools/bot.mjs';

// 명령 하나씩 기록하며 둔다
const play = (b, steps, cmds) => { for (const c of cmds) { noteStep(steps, b, c); apply(b, c); } };
const replayPath = (state, best) => { const t = cloneBattle(state); for (const st of best) for (const c of st.cmds) apply(t, c); return t; };

// 수 하나짜리 대국: 목표 = 풀이기 최선 사슬 점수. 그보다 낮은 떨구기를 일부러 두면 진다
function oneMoveBattle() {
  for (let seed = 1; seed < 200; seed++) {
    const b = createBattle({ seed, ante: 2, rules: { moves: 1, discards: 0, reboards: 0 } });
    const collect = [];
    const best = bestMove(b, { collect, preferMate: false });
    if (!best || best.mate || best.score <= 0) continue;
    const worse = collect.find((c) => c.score < best.score && !c.mate && b.hand[c.handIndex].t !== b.hand[best.handIndex].t);
    if (!worse) continue;
    b.target = best.score;
    return { b, best, worse };
  }
  throw new Error('no board');
}

test('갈림길: 일부러 낮은 수를 두고 지면 그 수가 「?」, 찾은 길이 「!」이고 실제 규칙으로 다시 두면 이긴다', () => {
  const { b, best, worse } = oneMoveBattle();
  const steps = [];
  play(b, steps, [{ type: 'drop', handIndex: worse.handIndex, sq: worse.sq }, ...worse.line.map((x) => (typeof x === 'number' ? { type: 'capture', sq: x } : x))]);
  assert.equal(b.status, 'lost');
  assert.equal(steps.length, 1);
  const r = review(steps, b);
  assert.equal(r.kind, 'path');
  assert.equal(r.at, 0);
  assert.equal(r.move, 1);
  assert.equal(r.mine.kind, 'drop');
  assert.equal(r.mine.sq, worse.sq);
  assert.equal(r.best.length, 1);
  assert.equal(r.best[0].kind, 'drop');
  assert.ok(r.best[0].gain >= best.score);
  assert.ok(r.scores.best >= b.target, `이길 길 점수 ${r.scores.best} ≥ 목표 ${b.target}`);
  assert.equal(r.scores.mine, b.score);
  assert.equal(replayPath(steps[0].state, r.best).status, 'won');
});

test('갈림길은 길이 있는 마지막 수: 앞 수가 좋았어도 뒤에서 갈렸으면 뒤 수를 짚는다', () => {
  // 수 둘: 첫 수는 봇의 최선, 둘째 수에서 일부러 아무것도 못 먹는 떨구기 → 둘째 수에 길이 있으면 갈림길은 2수째
  for (let seed = 1; seed < 300; seed++) {
    const b = createBattle({ seed, ante: 2, rules: { moves: 2, discards: 0, reboards: 0 } });
    const m1 = bestMove(b, { preferMate: false });
    if (!m1 || m1.mate) continue;
    const s1 = cloneBattle(b);
    apply(s1, { type: 'drop', handIndex: m1.handIndex, sq: m1.sq });
    for (const sq of m1.line) apply(s1, typeof sq === 'number' ? { type: 'capture', sq } : sq);
    if (s1.status !== 'play') continue;
    const collect = [];
    const m2 = bestMove(s1, { collect, preferMate: false });
    if (!m2 || m2.mate) continue;
    const worse = collect.find((c) => c.score < m2.score && !c.mate);
    if (!worse) continue;
    b.target = s1.score + m2.score; // 둘째 수 최선이면 닿는다
    const steps = [];
    play(b, steps, decisionCommands({ play: m1 }));
    play(b, steps, decisionCommands({ play: { handIndex: worse.handIndex, sq: worse.sq, line: worse.line } }));
    if (b.status !== 'lost') continue;
    const r = review(steps, b);
    assert.equal(r.kind, 'path');
    assert.equal(r.at, 1, '갈림길은 둘째 결정');
    assert.equal(r.move, 2);
    assert.equal(replayPath(steps[1].state, r.best).status, 'won');
    return;
  }
  assert.fail('no board');
});

// 수 하나 · 희생 · 다시 놓기 없음 · 메이트 없는 판: 풀이기 최선(메이트 우선)이 목표에 못 닿으면 어떤 결정으로도 못 이긴다
function hopeless(moves) {
  for (let seed = 1; seed < 200; seed++) {
    const b = createBattle({ seed, ante: 1, target: 1e12, rules: { moves, discards: 0, reboards: 0 } });
    const steps = [];
    while (b.status === 'play') { const d = decideBattle(b, {}); play(b, steps, decisionCommands(d)); }
    if (b.status === 'lost' && !b.history.some((h) => h.reason === 'mate')) { const r = review(steps, b); if (r.kind === 'none') return { b, steps, r }; }
  }
  throw new Error('no board');
}

test('길 없음: 어떤 수로도 목표에 못 닿는 대국은 none', () => {
  const { steps, r } = hopeless(1);
  assert.equal(r.kind, 'none');
  const m = bestMove(steps[0].state);
  assert.ok(!m.mate && m.score < 1e12, '풀이기 최선도 못 닿는다');
});

test('이어 하기로 가운데부터 남은 기록은 길이 없어도 none 대신 unknown', () => {
  const { b, steps } = hopeless(2);
  assert.equal(review(steps.slice(1), b).kind, 'unknown');
});

test('예산을 넘으면 unknown, 기록이 없어도 unknown', () => {
  const b = createBattle({ seed: 3, ante: 2, target: 1e12 });
  const steps = [];
  while (b.status === 'play') { const d = decideBattle(b, {}); play(b, steps, decisionCommands(d)); }
  const r = review(steps, b, { nodes: 50 });
  assert.equal(r.kind, 'unknown');
  assert.ok(r.nodes >= 50);
  assert.equal(review([], b).kind, 'unknown');
});

test('결정적: 같은 대국이면 같은 답, 나눠 돌려도(제너레이터) 같은 답', () => {
  const { b, worse } = oneMoveBattle();
  const steps = [];
  play(b, steps, decisionCommands({ play: { handIndex: worse.handIndex, sq: worse.sq, line: worse.line } }));
  const a = review(steps, b), c = review(JSON.parse(JSON.stringify(steps)), JSON.parse(JSON.stringify(b)));
  assert.deepEqual(a, c);
  const g = reviewGen(steps, b);
  let r = g.next(), n = 0;
  while (!r.done) { r = g.next(); n++; }
  assert.deepEqual(r.value, a);
  assert.ok(n > 0, '쉬는 자리가 있다');
});

test('기록: 둘 차례의 떨구기 · 희생 · 다시 놓기마다 그 앞 상태 하나, 사슬 먹기는 그 결정에 붙는다', () => {
  const b = createBattle({ seed: 11, ante: 1, target: 1e9 });
  const steps = [];
  const d = decideBattle(b, {});
  const s0 = JSON.stringify(b);
  play(b, steps, decisionCommands(d));
  assert.equal(steps.length, 1);
  assert.equal(JSON.stringify(steps[0].state), s0);
  assert.deepEqual(steps[0].cmds, decisionCommands(d));
  play(b, steps, [{ type: 'discard', handIndices: [0] }]);
  assert.equal(steps.length, 2);
  assert.equal(steps[1].cmds[0].type, 'discard');
});

test('진 대국 몇십 개: 찾은 길을 갈림길 상태에서 실제 규칙으로 두면 모두 이기고, 내 결정은 다음 기록 상태를 그대로 낸다', () => {
  // 약한 봇(떨구기마다 가장 낮은 사슬)으로 1~3관 연습 목표에 지게 한다
  const weak = (b) => {
    const collect = [];
    const m = bestMove(b, { collect, preferMate: 'avoid', maxNodes: 2000 });
    if (!m) return b.discardsLeft > 0 && b.bag.length ? { discard: [0] } : null;
    const low = collect.filter((c) => !c.mate).sort((x, y) => x.score - y.score)[0] || collect[0];
    return { play: { handIndex: low.handIndex, sq: low.sq, line: low.line } };
  };
  const kinds = { path: 0, none: 0, unknown: 0 };
  let lost = 0;
  for (let i = 0; lost < 30 && i < 200; i++) {
    const ante = 1 + (i % 3);
    const b = createBattle({ seed: 500 + i, ante, target: [150, 616, 4400][ante - 1] });
    const steps = [];
    while (b.status === 'play') { const d = weak(b); if (!d) break; play(b, steps, decisionCommands(d)); }
    if (b.status !== 'lost') continue;
    lost++;
    for (let k = 0; k + 1 < steps.length; k++) {
      const t = cloneBattle(steps[k].state);
      for (const c of steps[k].cmds) apply(t, c);
      assert.equal(JSON.stringify(t), JSON.stringify(steps[k + 1].state), '같은 상태 · 같은 명령 → 같은 다음 상태(시드로 정해진 미래)');
    }
    const r = review(steps, b);
    kinds[r.kind]++;
    if (r.kind !== 'path') continue;
    const end = replayPath(steps[r.at].state, r.best);
    assert.equal(end.status, 'won', `seed ${500 + i}: 찾은 길이 이긴다`);
    assert.equal(end.score, r.scores.best);
  }
  assert.equal(lost, 30);
  assert.ok(kinds.path >= 10, `길을 찾은 대국 ${JSON.stringify(kinds)}`);
});

// ── 화면 글
let M;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  const dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  M = { review: await import('../src/ui/review.js'), lang: await import('../src/ui/lang.js') };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });

test('갈림길 카드 글: 떨구기 · 희생 · 다시 놓기 · 같은 떨구기에서 갈린 먹기, 표시 칸, 영어', () => {
  const R = M.review;
  const base = { move: 3, mine: { kind: 'drop', t: 'P', sq: 12, cmds: [] }, scores: { mine: 120, best: 2340, target: 150 }, split: null, mate: false };
  const drop = { ...base, best: [{ kind: 'drop', t: 'N', sq: 18, cmds: [] }] };
  assert.equal(R.forkTitle(drop), '3수째가 갈림길이었다');
  assert.equal(R.forkLine(drop, []), '나이트를 c3에 떨궜다면 이겼다');
  assert.equal(R.forkLine({ ...base, best: [{ kind: 'drop', t: 'R', sq: 0 }] }, []), '룩을 a1에 떨궜다면 이겼다');
  assert.equal(R.forkLine({ ...base, best: [{ kind: 'discard', t: 'P' }] }, []), '폰을 바쳤다면 이겼다');
  assert.equal(R.forkLine({ ...base, best: [{ kind: 'reboard' }] }, []), '판을 다시 놓았다면 이겼다');
  assert.equal(R.forkScores(drop), '네 수 120 · 이길 길 2,340 / 목표 150');
  assert.equal(R.forkScores({ ...drop, mate: true }), '네 수 120 · 이길 길 메이트 / 목표 150');
  assert.deepEqual(R.forkMarks(drop), { mine: 12, best: 18, ghost: 'N' });
  const board = []; board[36] = { t: 'B', id: 5 };
  const split = { ...drop, split: { mine: { type: 'capture', sq: 35 }, best: { type: 'capture', sq: 36 } } };
  assert.equal(R.forkLine(split, board), 'e5의 비숍을 먹었다면 이겼다');
  assert.deepEqual(R.forkMarks(split), { mine: 35, best: 36, ghost: null });
  assert.deepEqual(R.forkMarks({ ...base, mine: { kind: 'discard', t: 'P' }, best: [{ kind: 'reboard' }] }), { mine: null, best: null, ghost: null });
  M.lang.setLang('en');
  const L = M.lang.L;
  assert.equal(L(R.forkTitle(drop)), 'Move 3 was the turning point');
  assert.equal(L(R.forkLine(drop, [])), 'Knight on c3 would have won');
  assert.equal(L('폰을 바쳤다면 이겼다'), 'Sacrificing the pawn would have won');
  assert.equal(L(R.forkLine(split, board)), 'Taking the bishop on e5 would have won');
  assert.equal(L(R.forkScores(drop)), 'You 120 · Winning line 2,340 / Target 150');
  assert.equal(L('복기 · 2/4수'), 'Review · 2/4');
  assert.deepEqual(R.forkScoreLines(drop).map(L), ['You 120 · Winning line 2,340', 'Target 150']);
  for (const s of [R.NO_PATH, R.THINKING, '다시 두기', '넘어가기', '판을 다시 놓았다면 이겼다', '복기']) assert.ok(!/[가-힣]/.test(L(s)), s);
  M.lang.setLang('ko');
});

test('복기 예산 기본값: 빔 · 마디', () => {
  assert.ok(REVIEW.nodes > 0 && REVIEW.solver > 0);
  assert.ok(findWin(createBattle({ seed: 1, ante: 1, target: 1 })).path, '목표 1이면 첫 수로 이긴다');
});
