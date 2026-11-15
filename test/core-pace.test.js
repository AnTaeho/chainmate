// 코어 판의 대국 구조(CHM-79): 끝까지 두기(rules.playOut) · 이어지는 배수(rules.streak) · 넘침 덤 · 목표 곡선.
// 코어가 아닌 대국은 두 깃발이 꺼져 있고 상태 · 요약에 새 칸이 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE } from '../src/data/core.js';
import { createRun, applyRun, blindInfo, targetFor, B } from '../src/sim/run.js';
import { createBattle, apply, checkStuck, legalCommands, DEFAULT_RULES } from '../src/sim/battle.js';
import { bestMove, lineCommands, previewDrop } from '../src/sim/solver.js';
import { cloneBattle } from '../src/sim/replay.js';
import { goalOf, stepBattle } from '../tools/bot.mjs';

const CORE_RULES = { playOut: true, streak: true };
const clone = (x) => JSON.parse(JSON.stringify(x));
const play = (b, m) => { const ev = apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq }); for (const c of lineCommands(m.line)) ev.push(...apply(b, c)); return ev; };
const live = (b) => b.status === 'play' || b.status === 'chain';
// 봇으로 끝까지(코어 판 봇 그대로)
function finish(b, onStep = () => {}) {
  for (let i = 0; i < 60 && live(b); i++) { if (!stepBattle(b, (c) => apply(b, c))) break; onStep(b); }
}
// 첫 잡기만 따라 콤보를 끝까지 둔다(줄 고르기 없이 — 끊김으로 끝나는 콤보를 찾을 때)
function greedy(b, cmd) {
  apply(b, cmd);
  for (let g = 0; g < 50 && b.status === 'chain'; g++) apply(b, legalCommands(b)[0]);
}
// 빈 판에 적 킹 하나(지키는 적 없음)와 나이트 한 손: 나이트를 떨궈 킹을 잡으면 체크메이트
function mateBoard(b) {
  b.board = Array(64).fill(null);
  b.board[36] = { t: 'K', id: 900 }; // e5
  b.board[7] = { t: 'P', id: 901 };  // h1(멀리)
  b.hand = [{ t: 'N', id: 1, eng: null }];
  b.offering = null;
}

test('명세: 코어 판에만 깃발이 켜지고 기본 규칙은 꺼져 있다', () => {
  assert.equal(DEFAULT_RULES.playOut, false);
  assert.equal(DEFAULT_RULES.streak, false);
  assert.equal(CORE.rules.playOut, true);
  assert.equal(CORE.rules.streak, true);
  const core = createRun({ seed: 4, core: true });
  applyRun(core, { type: 'play' });
  assert.equal(core.battle.rules.playOut, true);
  assert.equal(core.battle.rules.streak, true);
  assert.equal(core.battle.streak, 0);
  const plain = createRun({ seed: 4, draft: false });
  applyRun(plain, { type: 'play' });
  assert.equal(plain.battle.rules.playOut, false);
  assert.equal(plain.battle.rules.streak, false);
  assert.ok(!('streak' in plain.battle));
  finish(plain.battle);
  for (const h of plain.battle.history) assert.ok(!('start' in h), '코어가 아닌 콤보 요약에는 시작 배수가 없다');
});

test('목표 곡선 · 넘침 덤: 코어 판은 CORE.B와 CORE.overflow를 쓴다', () => {
  const core = createRun({ seed: 1, core: true });
  for (let i = 0; i < 3; i++) assert.equal(blindInfo(core, 1, i).target, targetFor(1, ['practice', 'official', 'master'][i], 1, CORE.B));
  assert.equal(blindInfo(core, 5, 1).target, targetFor(5, 'official', 1, CORE.B));
  assert.ok(blindInfo(core, 9, 0).target > CORE.B[7], '끝없는 대국은 코어 곡선의 8관 값에서 이어 간다');
  const plain = createRun({ seed: 1 });
  assert.equal(blindInfo(plain, 5, 1).target, targetFor(5, 'official', 1, B));
  assert.deepEqual(CORE.overflow, { 2: 1, 5: 2, 10: 4 });
  // 목표를 아주 낮게 두고 끝까지: 받은 넘침 덤은 코어 표의 가장 높은 층 하나
  let checked = 0;
  for (let seed = 1; seed <= 6 && checked < 2; seed++) {
    const run = createRun({ seed, core: true });
    applyRun(run, { type: 'play' });
    const b = run.battle;
    b.target = 5;
    const evs = [];
    for (let i = 0; i < 60 && run.phase === 'battle'; i++) if (!stepBattle(b, (c) => { const ev = applyRun(run, c); evs.push(...ev); return ev; })) break;
    const rw = evs.find((e) => e.type === 'reward');
    if (!rw || b.result.reason !== 'score') continue;
    assert.equal(rw.overflow, CORE.overflow[b.overflow] || 0);
    assert.equal(rw.moves, b.movesLeft, '남은 수 상금은 그대로(끝까지 두면 0)');
    checked++;
  }
  assert.ok(checked > 0);
});

test('끝까지 두기: 목표를 넘겨도 수를 다 쓰고, 다 쓴 뒤 목표 이상이면 이긴다', () => {
  let checked = 0;
  for (let seed = 1; seed <= 20 && checked < 3; seed++) {
    const b = createBattle({ seed, ante: 1, target: 20, rules: CORE_RULES });
    let crossedAt = null;
    finish(b, (x) => { if (crossedAt == null && x.score >= x.target && x.status !== 'chain') crossedAt = x.movesUsed; });
    if (b.result.reason === 'mate' || crossedAt == null || crossedAt >= b.rules.moves) continue;
    assert.equal(b.status, 'won');
    assert.equal(b.result.reason, 'score');
    assert.ok(b.movesUsed > crossedAt, `넘긴 수 ${crossedAt} · 둔 수 ${b.movesUsed}`);
    assert.ok(b.movesLeft === 0 || b.status === 'won');
    checked++;
  }
  assert.ok(checked > 0, '넘긴 뒤 이어진 대국이 하나는 있어야 한다');
  // 꺼 두면 넘긴 수에서 곧바로 끝난다
  const off = createBattle({ seed: 1, ante: 1, target: 20 });
  finish(off);
  if (off.status === 'won' && off.result.reason === 'score') assert.ok(off.history.slice(0, -1).reduce((a, h) => a + h.score, 0) < 20);
});

test('끝까지 두기: 수를 다 쓰고 목표 밑이면 진다', () => {
  const b = createBattle({ seed: 3, ante: 1, target: 1e12, rules: CORE_RULES });
  finish(b);
  assert.equal(b.status, 'lost');
  assert.ok(['moves', 'stuck'].includes(b.result.reason));
  if (b.result.reason === 'moves') assert.equal(b.movesLeft, 0);
});

test('끝까지 두기: 체크메이트는 목표와 상관없이 곧바로 이긴다', () => {
  for (const target of [1e9, 1]) {
    const b = createBattle({ seed: 5, ante: 1, target, rules: CORE_RULES });
    if (target === 1) b.score = 10; // 이미 넘긴 대국
    mateBoard(b);
    const sq = 26; // c4 → 나이트로 e5를 노린다
    apply(b, { type: 'drop', handIndex: 0, sq });
    apply(b, { type: 'capture', sq: 36 });
    assert.equal(b.status, 'won');
    assert.equal(b.result.reason, 'mate');
    assert.equal(b.movesLeft, b.rules.moves - 1, '수가 남은 채 끝난다');
  }
});

test('끝까지 두기: 막히면 목표 이상은 이김 · 밑은 짐(손을 새로 쥔 뒤)', () => {
  for (const [score, want] of [[100, 'won'], [10, 'lost']]) {
    const b = createBattle({ seed: 6, ante: 1, target: 50, rules: CORE_RULES });
    b.score = score;
    b.board = Array(64).fill(null); // 잡을 적이 없어 떨굴 곳이 없다
    b.discardsLeft = 0;
    const ev = [];
    checkStuck(b, ev);
    assert.ok(b.regrip, '손을 새로 쥐어 본 뒤');
    assert.equal(b.status, want);
    assert.equal(b.result.reason, want === 'won' ? 'score' : 'stuck');
  }
  // 꺼 두면 막힘은 늘 짐
  const off = createBattle({ seed: 6, ante: 1, target: 50 });
  off.score = 100; off.board = Array(64).fill(null); off.discardsLeft = 0;
  checkStuck(off, []);
  assert.equal(off.status, 'lost');
});

test('이어지는 배수: 콤보는 이어 온 수에서 시작하고, 끊기지 않으면 잡은 수만큼 쌓인다', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30 && checked < 3; seed++) {
    const b = createBattle({ seed, ante: 2, target: 1e12, rules: CORE_RULES });
    const m = bestMove(b, { preferMate: 'avoid' });
    if (!m || m.reason === 'cut') continue;
    play(b, m);
    const h1 = b.history[0];
    assert.equal(h1.start, 0);
    assert.equal(b.streak, h1.captures, '이어 온 수 = 잡은 수');
    if (b.status !== 'play') continue;
    const s = b.streak;
    // 조정자 없는 대국: 배수 = 시작 배수 + 잡은 수, 점수 = 값 × 배수
    const m2 = bestMove(b, { preferMate: 'avoid' });
    if (!m2) continue;
    play(b, m2);
    const h2 = b.history[1];
    assert.equal(h2.start, s);
    assert.equal(h2.mult, s + h2.captures);
    assert.equal(h2.score, Math.floor(h2.value * h2.mult));
    assert.equal(b.streak, h2.reason === 'cut' ? 0 : s + h2.captures);
    checked++;
  }
  assert.ok(checked > 0);
});

test('이어지는 배수: 끊김으로 끝나면 0으로 돌아간다(그 콤보 점수는 인정)', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 2; seed++) {
    const b0 = createBattle({ seed, ante: 3, target: 1e12, rules: CORE_RULES });
    b0.streak = 5;
    const drop = legalCommands(b0).filter((c) => c.type === 'drop').find((c) => { const t = cloneBattle(b0); greedy(t, c); return t.history.at(-1).reason === 'cut'; });
    if (!drop) continue;
    greedy(b0, drop);
    const h = b0.history.at(-1);
    assert.equal(h.reason, 'cut');
    assert.equal(h.start, 5);
    assert.ok(h.score >= Math.floor(h.value * 5), '시작 배수가 그 콤보 점수에 든다');
    assert.equal(b0.score, h.score);
    assert.equal(b0.streak, 0);
    checked++;
  }
  assert.ok(checked > 0, '끊김으로 끝나는 콤보를 찾았다');
});

test('끊김 뒤 이어 온 수(rules.streakCut): reset 0 · half 절반(내림) · keep 그대로, 코어 판 기본은 keep', () => {
  assert.equal(DEFAULT_RULES.streakCut, 'reset');
  assert.equal(CORE.rules.streakCut, 'keep');
  const core = createRun({ seed: 4, core: true });
  applyRun(core, { type: 'play' });
  assert.equal(core.battle.rules.streakCut, 'keep');
  const want = { reset: 0, half: 2, keep: 5 };
  for (const mode of Object.keys(want)) {
    let checked = 0;
    for (let seed = 1; seed <= 40 && !checked; seed++) {
      const b = createBattle({ seed, ante: 3, target: 1e12, rules: { ...CORE_RULES, streakCut: mode } });
      b.streak = 5;
      const drop = legalCommands(b).filter((c) => c.type === 'drop').find((c) => { const t = cloneBattle(b); greedy(t, c); return t.history.at(-1).reason === 'cut'; });
      if (!drop) continue;
      greedy(b, drop);
      const h = b.history.at(-1);
      assert.equal(h.reason, 'cut');
      assert.equal(h.start, 5, `${mode}: 끊긴 콤보도 이어 온 수에서 시작했다`);
      assert.equal(b.streak, want[mode], `${mode}: 끊긴 뒤 ${b.streak}`);
      checked++;
    }
    assert.ok(checked, `${mode}: 끊김으로 끝나는 콤보를 찾았다`);
  }
});

test('처음 적 수 곱(rules.enemyMult) · 증원 더하기(rules.reinforceAdd): 킹과 킹을 지키는 적은 그대로, 꺼진 값은 옛 판과 같다', () => {
  assert.equal(DEFAULT_RULES.enemyMult, 1);
  assert.equal(DEFAULT_RULES.reinforceAdd, 0);
  const plainRules = { randomThings: false, traits: false, pieces: [] };
  const enemies = (b) => b.board.filter((c) => c && !c.mine && c.t !== 'X');
  for (const ante of [1, 4, 7]) {
    const base = createBattle({ seed: 9, ante, rules: plainRules });
    assert.deepEqual(createBattle({ seed: 9, ante, rules: { ...plainRules, enemyMult: 1, reinforceAdd: 0 } }).board, base.board, '꺼진 값은 같은 판');
    const guards = (ante >= 6 ? 6 : ante >= 5 ? 5 : ante >= 3 ? 4 : 3);
    const none = createBattle({ seed: 9, ante, rules: { ...plainRules, enemyMult: 0 } });
    assert.equal(enemies(none).length, 1 + guards, `${ante}관: 곱 0이면 킹과 킹을 지키는 적만`);
    assert.equal(enemies(none).filter((c) => c.t === 'K').length, 1);
    const half = createBattle({ seed: 9, ante, rules: { ...plainRules, enemyMult: 0.5 } });
    const others = enemies(base).length - 1 - guards;
    assert.equal(enemies(half).length, 1 + guards + Math.round(others * 0.5));
    const more = createBattle({ seed: 9, ante, rules: { ...plainRules, reinforceAdd: 3 } });
    assert.equal(more.incoming.length, base.incoming.length + 3, '증원 +3');
  }
  // 단 덤(reinforceBonus) 위에 더한다
  const dan = createBattle({ seed: 9, ante: 2, rules: { ...plainRules, reinforceBonus: 1, reinforceAdd: 2 } });
  assert.equal(dan.incoming.length, 2 + 1 + 2);
});

test('이어지는 배수: 풀이기 · 미리 보기 · 복기 복사본이 실제 콤보와 같은 셈을 본다(코어 판 조정자 그대로)', () => {
  let checked = 0;
  for (let seed = 1; seed <= 12 && checked < 4; seed++) {
    const run = createRun({ seed, core: true });
    run.maxims.push({ uid: run.nextUid++, id: 'combo', data: {}, edition: null, paid: 0 }, { uid: run.nextUid++, id: 'payback', data: {}, edition: null, paid: 0 });
    run.charts.N = 2; run.charts.B = 1;
    applyRun(run, { type: 'play' });
    const b = run.battle;
    b.streak = 7;
    const m = bestMove(b, { preferMate: 'avoid' });
    if (!m) continue;
    const pv = previewDrop(b, m.handIndex, m.sq);
    assert.ok(pv.mult >= 7, `미리 보기 배수 ${pv.mult}`);
    const copy = cloneBattle(b);
    const mc = bestMove(copy, { preferMate: 'avoid' });
    assert.equal(mc.score, m.score, '복기 복사본의 풀이기도 같은 점수');
    for (const c of [{ type: 'drop', handIndex: m.handIndex, sq: m.sq }, ...lineCommands(m.line)]) applyRun(run, c);
    const h = b.history.at(-1);
    assert.equal(h.start, 7);
    assert.equal(h.score, m.score, `seed ${seed}: 풀이기 ${m.score} · 실제 ${h.score}`);
    checked++;
  }
  assert.ok(checked >= 2);
});

test('봇: 끝까지 두는 대국에서 넘긴 뒤에는 다음 넘침 층을 노린다', () => {
  const b = createBattle({ seed: 2, ante: 1, target: 100, rules: CORE_RULES });
  assert.equal(goalOf(b), 100);
  b.score = 150; assert.equal(goalOf(b), 200);
  b.score = 600; assert.equal(goalOf(b), 1000);
  b.score = 1200; assert.equal(goalOf(b), Infinity);
  const off = createBattle({ seed: 2, ante: 1, target: 100 });
  off.score = 150;
  assert.equal(goalOf(off), 100);
});

test('코어 판 대국은 JSON 왕복 뒤에도 같은 수를 잇는다(이어 온 수 · 시작 배수 포함)', () => {
  const run = createRun({ seed: 31, core: true });
  applyRun(run, { type: 'play' });
  const b = run.battle;
  stepBattle(b, (c) => applyRun(run, c));
  if (run.phase !== 'battle') return;
  const copy = clone(run);
  assert.deepEqual(copy, run);
  const ta = [], tb = [];
  for (let i = 0; i < 30 && run.phase === 'battle'; i++) if (!stepBattle(run.battle, (c) => { ta.push(JSON.stringify(c)); return applyRun(run, c); })) break;
  for (let i = 0; i < 30 && copy.phase === 'battle'; i++) if (!stepBattle(copy.battle, (c) => { tb.push(JSON.stringify(c)); return applyRun(copy, c); })) break;
  assert.ok(ta.length > 0);
  assert.deepEqual(tb, ta);
  assert.deepEqual(clone(copy), clone(run));
});
