// 박자표(CHM-66, tools/beats.mjs): 사건 → 등급, 시너지 문턱, 메마른 구간 셈, 아슬아슬 층 · 넘긴 자리, 드문 층 간격,
// 실제 대국 하나를 기록기로 받아 대국 줄이 판(런) log와 맞는가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun } from '../src/sim/run.js';
import { finishBattle } from './helpers/run.js';
import { beatKey, beatTier, famKeys, longestDry, nearTier, crossThird, gaps, runBeats, beatLog, BEAT_TABLE, TIER } from '../tools/beats.mjs';

test('사건 → 등급: 표에 있는 것은 S · M · L, 없는 것은 null', () => {
  assert.equal(beatTier({ type: 'grade', n: 3 }), 'S');
  assert.equal(beatTier({ type: 'grade', n: 5 }), 'M');
  assert.equal(beatTier({ type: 'grade', n: 8 }), 'L');
  assert.equal(beatTier({ type: 'grade', n: 12 }), 'L');
  assert.equal(beatTier({ type: 'overflow', tier: 1 }), null);
  assert.equal(beatTier({ type: 'overflow', tier: 2 }), 'S');
  assert.equal(beatTier({ type: 'overflow', tier: 5 }), 'M');
  assert.equal(beatTier({ type: 'overflow', tier: 10 }), 'L');
  assert.equal(beatKey({ type: 'promote', sq: 3, to: 'Q' }), 'promote');
  assert.equal(beatKey({ type: 'promote', pieceId: 4, from: 'P', to: 'N' }), null, '상점 프로모션은 뺀다');
  assert.equal(beatTier({ type: 'discard', pieces: ['P'] }), 'S');
  assert.equal(beatTier({ type: 'golden', sq: 1, piece: 'R' }), 'M');
  assert.equal(beatTier({ type: 'mate', sq: 1 }), 'M');
  assert.equal(beatKey({ type: 'maxim', id: 'pawn_march', edition: null }), null, '흔한 격언');
  assert.equal(beatKey({ type: 'maxim', id: 'pawn_march', edition: 'foil' }), 'edition');
  assert.equal(beatKey({ type: 'maxim', id: 'whim', edition: null }), 'edition', '귀한 격언');
  assert.equal(beatKey({ type: 'buy', item: { kind: 'piece', t: 'N', soul: 'absorb' } }), 'rareSoul');
  assert.equal(beatKey({ type: 'buy', item: { kind: 'piece', t: 'N', soul: 'echo' } }), null, '드문 혼은 귀함이 아니다');
  assert.equal(beatKey({ type: 'buy', item: { kind: 'soul', id: 'absorb' } }), null, '두루마리는 쓸 때 ensoul로 센다');
  assert.equal(beatKey({ type: 'ensoul', soul: 'transcend' }), 'rareSoul');
  assert.equal(beatKey({ type: 'chest', count: 1 }), null);
  assert.equal(beatTier({ type: 'chest', count: 3 }), 'M');
  assert.equal(beatTier({ type: 'chest', count: 5 }), 'L');
  assert.equal(beatTier({ type: 'fragment', part: 'first' }), 'M');
  assert.equal(beatTier({ type: 'fragment', part: 'feat' }), 'L');
  assert.equal(beatTier({ type: 'fragment', part: 'gold' }), 'L');
  assert.equal(beatKey({ type: 'goldenPack' }), 'goldPack');
  assert.equal(beatKey({ type: 'packOpen', kind: 'golden', from: 'tag' }), 'goldPack');
  assert.equal(beatKey({ type: 'packOpen', kind: 'golden' }), null, '상점의 공짜 금빛 꾸러미는 goldenPack에서 셌다');
  for (const t of ['brilliant', 'legend', 'awaken']) assert.equal(beatTier({ type: t }), 'L');
  assert.equal(beatTier({ type: 'crack' }), 'M');
  assert.equal(beatKey({ type: 'capture' }), null);
  for (const k of Object.keys(BEAT_TABLE)) assert.ok(['S', 'M', 'L'].includes(TIER[k]));
});

test('시너지 문턱: 가족 수 최댓값이 넘은 문턱마다 하나', () => {
  assert.deepEqual(famKeys(0, 1), []);
  assert.deepEqual(famKeys(1, 4), ['fam2', 'fam4']);
  assert.deepEqual(famKeys(4, 6), ['fam6']);
  assert.deepEqual(famKeys(6, 7), []);
  assert.deepEqual(['fam2', 'fam4', 'fam6'].map((k) => TIER[k]), ['S', 'M', 'L']);
});

test('메마른 구간: 표시 없는 대국이 가장 길게 이어진 수, 하나도 없으면 판 길이', () => {
  assert.equal(longestDry(6, new Set([2, 5])), 2);
  assert.equal(longestDry(5, new Set()), 5);
  assert.equal(longestDry(3, new Set([1, 2, 3])), 0);
  // 대국 1 M · 대국 4 L(대국 밖 사건도 그 대국으로) — 대국 다섯
  const b = (bi) => [bi, 1, bi % 3, 1, 'score', 120, 100, 2, 4, 2];
  const r = runBeats({
    ev: [[1, 1, 2, 'grade5'], [2, 1, 1, 'grade3'], [4, 2, 0, 'chest5'], [4, 2, 3, 'grade8']],
    battles: [1, 2, 3, 4, 5].map(b), seen: { edition: [], golden: [], frag: [] },
  });
  assert.equal(r.dryM, 2); // 대국 2 · 3
  assert.equal(r.dryL, 3); // 대국 1 · 2 · 3
  assert.equal(r.noL, false);
  assert.equal(r.firstL, 4);
  assert.deepEqual(r.ignite, { bi: 4, ante: 2 });
  assert.deepEqual([r.S, r.M, r.L], [1, 1, 2]);
  const none = runBeats({ ev: [[2, 1, 1, 'grade5']], battles: [1, 2, 3].map(b), seen: { edition: [], golden: [], frag: [] } });
  assert.equal(none.dryL, 3);
  assert.equal(none.noL, true);
  assert.equal(none.ignite, null);
});

test('아슬아슬: 진 대국 점수/목표 층 · 이긴 대국의 넘긴 자리', () => {
  assert.equal(nearTier(0.1), 0);
  assert.equal(nearTier(0.4999), 0);
  assert.equal(nearTier(0.5), 1);
  assert.equal(nearTier(0.79), 1);
  assert.equal(nearTier(0.8), 2);
  assert.equal(nearTier(0.949), 2);
  assert.equal(nearTier(0.95), 3);
  assert.equal(nearTier(0.999), 3);
  assert.equal(crossThird(1, 4), 0);
  assert.equal(crossThird(2, 4), 1);
  assert.equal(crossThird(3, 4), 2);
  assert.equal(crossThird(4, 4), 2);
  const r = runBeats({ ev: [], seen: { edition: [], golden: [], frag: [] }, battles: [
    [1, 1, 0, 0, 'moves', 96, 100, 4, 4, null], [2, 1, 1, 0, 'moves', 30, 100, 4, 4, null],
    [3, 1, 2, 1, 'score', 150, 100, 4, 4, 4], [4, 2, 0, 1, 'score', 300, 100, 1, 4, 1], [5, 2, 1, 1, 'mate', 40, 100, 2, 4, null],
  ] });
  assert.deepEqual(r.near.map((x) => x.tier), [3, 0]);
  assert.deepEqual(r.late, [{ ante: 1, last2: true, third: 2 }, { ante: 2, last2: false, third: 0 }]);
  assert.equal(r.mateUnder, 1);
});

test('드문 층 간격: 같은 대국은 하나로, 처음까지와 다음까지', () => {
  assert.deepEqual(gaps([]), { first: null, gaps: [], n: 0 });
  assert.deepEqual(gaps([7, 3, 3, 12]), { first: 3, gaps: [4, 5], n: 3 });
});

test('기록기: 실제 대국 하나의 줄이 판(런) log와 맞고 사건 key는 모두 표에 있다', () => {
  const run = createRun({ draft: false, seed: 1 });
  const log = beatLog(run);
  const rec = (cmd) => { const b = run.battle, mu = b ? b.movesUsed : 0, len = run.log.length; const ev = applyRun(run, cmd); log.record(run, ev, b, mu, len); return ev; };
  rec({ type: 'play' });
  finishBattle(run, rec);
  const { battles, ev } = log.rows;
  assert.equal(battles.length, 1);
  const [bi, ante, blind, won, reason, score, target, used, max] = battles[0];
  const row = run.log[0];
  assert.deepEqual([bi, ante, blind, won, reason, score, target, used], [1, row.ante, row.blind, row.won ? 1 : 0, row.reason, row.score, row.target, row.moves]);
  assert.ok(max >= used);
  for (const e of ev) { assert.ok(BEAT_TABLE[e[3]], e[3]); assert.equal(e[0], 1); assert.ok(e[2] >= 1 && e[2] <= max); }
  // 사건으로 센 별이 대국 줄의 별(사슬마다 마지막 별)과 같은 사슬들에서 나왔다: 사슬 8이면 3 · 5 · 8이 모두 찍힌다
  const g = row.grades || {};
  const reach = (n) => ['★', '★★', '★★★', '∞'].slice([3, 5, 8, 12].indexOf(n)).reduce((a, k) => a + (g[k] || 0), 0);
  assert.equal(ev.filter((e) => e[3] === 'grade3').length, reach(3));
  assert.equal(ev.filter((e) => e[3] === 'grade5').length, reach(5));
});
