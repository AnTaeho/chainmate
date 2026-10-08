// 기록 합치기(CHM-71, src/ui/merge.js): 교환 · 결합 · 멱등, 칸마다 규칙, 옛 꼴 기록, 규칙 없는 칸이 생기면 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecords, normRecords, mergeInto, cloudRecords, mergeGain, RULES, LOCAL_ONLY } from '../src/ui/merge.js';
import { emptyRecords, loadRecords } from '../src/ui/records.js';
import { makeStore, KEYS } from '../src/ui/save.js';

// 시드 무작위로 지은 기록(칸마다 있거나 없거나)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
function randomRecords(seed) {
  const r = rng(seed), n = (k) => Math.floor(r() * k), some = () => Object.fromEntries(IDS.filter(() => r() < 0.5).map((id) => [id, true]));
  const rec = emptyRecords();
  Object.assign(rec, { runs: n(40), wins: n(10), mates: n(9), legends: n(3), brilliants: n(5), bestAnte: n(9), bestEndless: n(14), reviews: n(6), reviewReplays: n(4) });
  if (r() < 0.7) rec.bestMove = { score: n(4) * 1000, steps: ['P', 'N', 'Q'].slice(0, 1 + n(3)), ante: 1 + n(8) };
  if (r() < 0.5) rec.bestBrilliant = { score: n(4) * 500, weight: n(9), pieces: ['R'], ante: 1 + n(8) };
  for (const g of ['★', '★★', '★★★', '∞']) if (r() < 0.6) rec.grades[g] = n(20);
  for (const kind of Object.keys(rec.codex)) rec.codex[kind] = { ...rec.codex[kind], ...some() };
  rec.codex.legends = Object.fromEntries(IDS.filter(() => r() < 0.5).map((id) => [id, 1 + n(3)]));
  rec.unlocked = { openings: ['standard', ...['sicilian', 'london', 'rook_endgame', 'queens_gambit'].filter(() => r() < 0.4)], dan: n(9) };
  for (let d = 0; d < 9; d++) if (r() < 0.3) rec.danWins[d] = 1 + n(5);
  if (r() < 0.7) { const ante = 1 + n(8), blind = n(3), won = r() < 0.2; rec.daily = { date: `2026-10-0${6 + n(3)}`, ante, blind, won, score: ante * 10 + blind + (won ? 100 : 0), runs: 1 + n(4) }; }
  rec.lessonsDone = r() < 0.5; rec.lessonsSeen = some(); rec.coachSeen = some();
  if (r() < 0.5) rec.kingDone = r() < 0.5;
  if (r() < 0.5) rec.movesSeen = some();
  if (r() < 0.5) rec.runNew = { seed: n(3), keys: IDS.filter(() => r() < 0.4) };
  if (r() < 0.3) rec.someday = { n: n(5), on: r() < 0.5, word: IDS[n(6)] }; // 규칙이 없는 칸
  return normRecords(rec);
}

test('합치기: 교환 · 결합 · 멱등(무작위 기록 300쌍)', () => {
  for (let i = 0; i < 300; i++) {
    const a = randomRecords(i * 3 + 1), b = randomRecords(i * 3 + 2), c = randomRecords(i * 3 + 3);
    assert.deepEqual(mergeRecords(a, b), mergeRecords(b, a), `교환 ${i}`);
    assert.deepEqual(mergeRecords(mergeRecords(a, b), c), mergeRecords(a, mergeRecords(b, c)), `결합 ${i}`);
    assert.deepEqual(mergeRecords(a, a), a, `멱등 ${i}`);
    const ab = mergeRecords(a, b);
    assert.deepEqual(mergeRecords(ab, a), ab, `합친 것에 다시 합쳐도 같다 ${i}`);
    assert.deepEqual(JSON.parse(JSON.stringify(ab)), ab, 'JSON 왕복');
  }
});

test('합치기: 빈 기록은 아무것도 바꾸지 않는다 · 켜서 읽은 기록 꼴 그대로', () => {
  const e = emptyRecords();
  assert.deepEqual(mergeRecords(e, e), e);
  for (let i = 0; i < 50; i++) { const a = randomRecords(900 + i); assert.deepEqual(mergeRecords(a, e), a); }
  // 저장에서 읽은 꼴(loadRecords)도 고른 꼴이다
  const store = makeStore({ getItem: () => JSON.stringify({ v: 1, runs: 3, grades: { '!': 2, '★': 1 }, codex: { maxims: { x: true } }, unlocked: { openings: ['standard', 'sicilian', 'london'], dan: 2 } }), setItem() {}, removeItem() {} });
  const loaded = loadRecords(store);
  const m = mergeRecords(loaded, loaded);
  assert.deepEqual(m.unlocked.openings, ['standard', 'london', 'sicilian'], '해금 차례는 레퍼토리 차례로');
  assert.deepEqual({ ...m, unlocked: null }, { ...loaded, unlocked: null });
  assert.equal(KEYS.records, 'chainmate.records.v1');
});

test('합치기: 칸마다 규칙', () => {
  const a = { ...emptyRecords(), runs: 10, wins: 2, mates: 7, legends: 0, brilliants: 4, reviews: 1, reviewReplays: 5, bestAnte: 6, bestEndless: 0,
    bestMove: { score: 900, steps: ['P'], ante: 3 }, bestBrilliant: null, grades: { '★': 4, '∞': 1 },
    codex: { ...emptyRecords().codex, maxims: { m1: true }, legends: { immortal: 1 }, souls: { s1: true } },
    unlocked: { openings: ['standard', 'sicilian'], dan: 2 }, danWins: { 0: 3, 1: 1 },
    daily: { date: '2026-10-07', ante: 8, blind: 2, won: true, score: 182, runs: 5 },
    lessonsDone: false, lessonsSeen: { l1: true }, coachSeen: { c1: true } };
  const b = { ...emptyRecords(), runs: 4, wins: 3, mates: 1, legends: 2, brilliants: 0, reviews: 6, reviewReplays: 0, bestAnte: 5, bestEndless: 11,
    bestMove: { score: 1200, steps: ['Q', 'N'], ante: 5 }, bestBrilliant: { score: 50, weight: 1, pieces: ['P'], ante: 2 }, grades: { '★': 9, '★★': 2 },
    codex: { ...emptyRecords().codex, maxims: { m2: true }, legends: { immortal: 3, evergreen: 1 }, awake: { s1: true } },
    unlocked: { openings: ['standard', 'london'], dan: 5 }, danWins: { 1: 4, 5: 1 },
    daily: { date: '2026-10-08', ante: 2, blind: 0, won: false, score: 20, runs: 1 },
    lessonsDone: true, lessonsSeen: { l2: true }, coachSeen: {} };
  const m = mergeRecords(a, b);
  // 세는 수는 큰 쪽
  assert.deepEqual([m.runs, m.wins, m.mates, m.legends, m.brilliants, m.reviews, m.reviewReplays], [10, 3, 7, 2, 4, 6, 5]);
  assert.deepEqual(m.grades, { '★': 9, '★★': 2, '∞': 1 });
  // 최고 기록은 더 좋은 쪽
  assert.deepEqual([m.bestAnte, m.bestEndless], [6, 11]);
  assert.deepEqual(m.bestMove, b.bestMove);
  assert.deepEqual(m.bestBrilliant, b.bestBrilliant);
  // 도감 · 해금 · 본 안내는 합집합(명경기 조각 수는 큰 쪽)
  assert.deepEqual(m.codex.maxims, { m1: true, m2: true });
  assert.deepEqual(m.codex.legends, { immortal: 3, evergreen: 1 });
  assert.deepEqual([m.codex.souls, m.codex.awake, m.codex.openings], [{ s1: true }, { s1: true }, { standard: true }]);
  assert.deepEqual(m.unlocked, { openings: ['standard', 'london', 'sicilian'], dan: 5 });
  assert.deepEqual(m.danWins, { 0: 3, 1: 4, 5: 1 });
  assert.deepEqual([m.lessonsDone, m.lessonsSeen, m.coachSeen], [true, { l1: true, l2: true }, { c1: true }]);
  // 오늘의 대국: 날짜가 늦은 쪽(성적이 나빠도)
  assert.deepEqual(m.daily, b.daily);
  // 같은 날이면 더 좋은 판 · 둔 판 수는 큰 쪽
  const same = mergeRecords({ ...a, daily: { date: '2026-10-08', ante: 4, blind: 1, won: false, score: 41, runs: 2 } }, { ...b, daily: { ...b.daily, runs: 7 } });
  assert.deepEqual(same.daily, { date: '2026-10-08', ante: 4, blind: 1, won: false, score: 41, runs: 7 });
  assert.equal(mergeRecords({ ...a, daily: null }, b).daily, b.daily);
  // 점수가 같은 최고 기록도 어느 쪽을 먼저 주든 같다
  const t1 = { ...a, bestMove: { score: 900, steps: ['N'], ante: 1 } };
  assert.deepEqual(mergeRecords(a, t1).bestMove, mergeRecords(t1, a).bestMove);
});

test('합치기: 옛 꼴 기록(없는 칸 · 옛 평가 열쇠 · 망가진 값)도 받아 채운다', () => {
  const old = { v: 1, runs: 7, bestAnte: 4, grades: { '!': 3, '!!': 1 }, codex: { maxims: { m1: true } }, unlocked: { openings: ['standard'] } };
  const now = { ...emptyRecords(), runs: 2, grades: { '★': 1 }, coachSeen: { c: true } };
  const m = mergeRecords(old, now);
  assert.deepEqual(m, mergeRecords(now, old));
  assert.deepEqual(Object.keys(emptyRecords()).filter((k) => !(k in m)), [], '없는 칸이 채워진다');
  assert.deepEqual(m.grades, { '★': 3, '★★': 1 });
  assert.deepEqual([m.runs, m.bestAnte, m.unlocked.dan, m.codex.maxims, m.codex.souls], [7, 4, 0, { m1: true }, {}]);
  for (const junk of [null, undefined, 7, 'x', [], { runs: 'many', codex: 3, unlocked: null, grades: [], daily: 'x', bestMove: 5 }]) {
    const j = mergeRecords(junk, now);
    assert.deepEqual(j, mergeRecords(now, junk));
    assert.equal(j.runs, 2);
    assert.deepEqual(j.unlocked.openings, ['standard']);
  }
});

test('합치기: 기록의 모든 칸에 규칙이 있다 — 새 칸을 더하면 RULES에도 넣는다', () => {
  const known = [...Object.keys(emptyRecords()), 'kingDone', 'kingAgain', 'lastOpening', 'lastDan', 'movesSeen', 'runNew'];
  assert.deepEqual(known.filter((k) => typeof RULES[k] !== 'function'), [], 'src/ui/merge.js RULES에 규칙이 없는 칸');
  // 규칙이 없는 칸도 법칙은 지킨다(수는 큰 쪽 · 참거짓은 켜진 쪽)
  const m = mergeRecords({ ...emptyRecords(), later: { n: 2, on: false } }, { ...emptyRecords(), later: { n: 5, on: true, extra: 'x' } });
  assert.deepEqual(m.later, { n: 5, on: true, extra: 'x' });
});

test('이 기기의 취향(킹과 다시 두기 · 마지막에 고른 것)은 올리지 않고 받은 것으로 덮지 않는다', () => {
  const local = { ...emptyRecords(), runs: 1, kingAgain: false, lastOpening: 'london', lastDan: 2 };
  const remote = { ...emptyRecords(), runs: 9, kingAgain: true, lastOpening: 'sicilian', lastDan: 7, codex: { ...emptyRecords().codex, maxims: { m: true } } };
  const up = cloudRecords(local);
  for (const k of LOCAL_ONLY) assert.ok(!(k in up), k);
  assert.equal(up.runs, 1);
  const m = mergeInto(local, remote);
  assert.deepEqual([m.runs, m.kingAgain, m.lastOpening, m.lastDan, m.codex.maxims], [9, false, 'london', 2, { m: true }]);
  assert.deepEqual(mergeInto(local, null).runs, 1);
});

test('합쳐서 늘어난 것: 도감 칸 · 열린 레퍼토리 · 판 수 · 닿은 관', () => {
  const a = { ...emptyRecords(), runs: 3, bestAnte: 4, codex: { ...emptyRecords().codex, maxims: { m1: true } } };
  const b = { ...emptyRecords(), runs: 8, bestAnte: 6, codex: { ...emptyRecords().codex, maxims: { m1: true, m2: true }, souls: { s: true }, legends: { x: 2, y: 0 } }, unlocked: { openings: ['standard', 'london'], dan: 0 } };
  assert.deepEqual(mergeGain(a, mergeRecords(a, b)), { codex: 3, openings: 1, runs: 5, ante: 6 });
  assert.deepEqual(mergeGain(b, mergeRecords(a, b)), { codex: 0, openings: 0, runs: 0, ante: 0 });
});
