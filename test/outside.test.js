// 판 밖: 오프닝 다섯 · 단 1~8 · 기록/도감/해금 · 오늘의 대국
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, blindInfo, targetFor, DANS, danRules, chestCounts, CHEST, maximCapacity } from '../src/sim/run.js';
import { rerollCost, rollDisplay, rollPacks, rollItem } from '../src/sim/shop.js';
import { OPENINGS } from '../src/data/openings.js';
import { FINAL_MASTER } from '../src/data/masters.js';
import { stepBattle } from '../tools/bot.mjs';
import { emptyRecords, observe, finishRun, nextUnlock, noteMove, dailySeed, UNLOCKS, MAX_DAN } from '../src/ui/records.js';

const count = (arr) => arr.reduce((o, t) => ((o[t] = (o[t] || 0) + 1), o), {});

test('오프닝 다섯: 주머니는 모두 여덟, 적힌 대로', () => {
  const want = {
    standard: { P: 4, N: 2, B: 1, R: 1 }, london: { P: 5, B: 2, R: 1 }, sicilian: { P: 3, N: 3, B: 1, R: 1 },
    queens_gambit: { P: 3, N: 2, B: 1, R: 1, Q: 1 }, rook_endgame: { P: 4, N: 1, B: 1, R: 2 },
  };
  assert.deepEqual(Object.keys(OPENINGS).sort(), Object.keys(want).sort());
  for (const [id, c] of Object.entries(want)) {
    const run = createRun({ draft: false, seed: 5, opening: id });
    assert.equal(run.deck.length, 8, id);
    assert.deepEqual(count(run.deck.map((p) => p.t)), c, id);
  }
});

test('오프닝 규칙: 시실리안 손 5 · 퀸스 갬빗 수 3 · 룩 엔딩 격언 칸 4', () => {
  let run = createRun({ draft: false, seed: 5, opening: 'sicilian' });
  applyRun(run, { type: 'play' });
  assert.equal(run.battle.hand.length, 5);
  run = createRun({ draft: false, seed: 5, opening: 'queens_gambit' });
  applyRun(run, { type: 'play' });
  assert.equal(run.battle.movesLeft, 3);
  run = createRun({ draft: false, seed: 5, opening: 'rook_endgame' });
  assert.equal(maximCapacity(run), 4);
  assert.equal(createRun({ draft: false, seed: 5 }).maximSlots, 5);
});

test('오프닝마다 한 판이 끝까지 돈다(봇)', () => {
  for (const id of Object.keys(OPENINGS)) {
    const run = createRun({ draft: false, seed: 21, opening: id });
    for (let g = 0; g < 3000 && run.phase !== 'lost' && run.phase !== 'won'; g++) {
      if (run.phase === 'select') applyRun(run, { type: 'play' });
      else if (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
      else if (run.phase === 'shop') applyRun(run, { type: 'leave' });
      else if (run.phase === 'pack') applyRun(run, { type: 'skipPack' });
    }
    assert.ok(run.phase === 'lost' || run.phase === 'won', id);
  }
});

test('단 0은 단 없는 판과 같다(목표 · 첫 대국판 · 상점)', () => {
  const a = createRun({ draft: false, seed: 9 }), b = createRun({ draft: false, seed: 9, dan: 0 });
  assert.equal(a.stake, null);
  assert.deepEqual(a, b);
  for (let i = 0; i < 3; i++) assert.equal(blindInfo(a, 1, i).target, targetFor(1, ['practice', 'official', 'master'][i]));
});

test('단 규칙은 차례로 쌓인다(여덟)', () => {
  assert.equal(DANS.length, 8);
  const r0 = danRules(0), r8 = danRules(8);
  assert.deepEqual(r0, { reinforce: 0, price: 0, chestFive: 1, fragment: 1, clock: 0, target: 1, discards: 0, moves: 0, finalTarget: 1 });
  assert.deepEqual(r8, { reinforce: 1, price: 1, chestFive: 0.5, fragment: 0.5, clock: -1, target: 1.25, discards: -1, moves: 0, finalTarget: 1.25 });
  for (let d = 1; d <= 8; d++) {
    const r = danRules(d), p = danRules(d - 1);
    assert.ok(Object.keys(r).some((k) => r[k] !== p[k]), `단 ${d}에서 바뀐 것 없음`);
  }
});

test('단 1: 증원 +1 / 단 4: 시계 −1 / 단 6: 희생 −1', () => {
  const plain = createRun({ draft: false, seed: 9 }); applyRun(plain, { type: 'play' });
  assert.equal(plain.clock, 3);
  const r1 = createRun({ draft: false, seed: 9, dan: 1 }); applyRun(r1, { type: 'play' });
  assert.equal(r1.battle.incoming.length, plain.battle.incoming.length + 1);
  assert.equal(createRun({ draft: false, seed: 9, dan: 4 }).clock, 2);
  assert.equal(createRun({ draft: false, seed: 9, dan: 8 }).clock, 2);
  const r6 = createRun({ draft: false, seed: 9, dan: 6 }); applyRun(r6, { type: 'play' });
  assert.equal(r6.battle.discardsLeft, 2);
  const r8 = createRun({ draft: false, seed: 9, dan: 8 }); applyRun(r8, { type: 'play' });
  assert.equal(r8.battle.movesLeft, 4);
});

test('단 2부터: 상점 값 +1(진열 · 꾸러미 · 다시 진열)', () => {
  const a = createRun({ draft: false, seed: 4 }), b = createRun({ draft: false, seed: 4, dan: 3 });
  for (const r of [a, b]) r.shop = { rng: { s: 777 }, display: [], packs: [], rerolls: 0 };
  rollDisplay(a); rollDisplay(b);
  a.shop.rng = { s: 778 }; b.shop.rng = { s: 778 };
  rollPacks(a); rollPacks(b);
  a.shop.display.forEach((it, i) => assert.equal(b.shop.display[i].price, it.price + 1));
  a.shop.packs.forEach((pk, i) => assert.equal(b.shop.packs[i].price, pk.price + 1));
  assert.equal(rerollCost(b), rerollCost(a) + 1);
});

test('단 3부터: 명인의 상자 다섯 칸 무게 반(덜어 낸 몫은 한 칸)', () => {
  const r5 = createRun({ draft: false, seed: 1, dan: 6 });
  const c = Object.fromEntries(chestCounts(r5));
  const base = Object.fromEntries(CHEST.counts);
  assert.equal(c[5], base[5] / 2);
  assert.equal(c[1], base[1] + base[5] / 2);
  assert.equal(c[3], base[3]);
  assert.equal(chestCounts(createRun({ draft: false, seed: 1 })), CHEST.counts);
});

test('단 3부터: 첫 조각 확률 반(진열 3000칸)', () => {
  const rate = (dan) => {
    const run = createRun({ draft: false, seed: 1, dan });
    const rng = { s: 12345 };
    let n = 0;
    for (let i = 0; i < 6000; i++) if (rollItem(run, rng, []).kind === 'fragment') n++;
    return n / 6000;
  };
  const r0 = rate(0), r6 = rate(6);
  assert.ok(r0 > 0.02 && r0 < 0.04, `단 0 ${r0}`);
  assert.ok(r6 > 0.008 && r6 < 0.022, `단 6 ${r6}`);
});

test('단은 저장 왕복 뒤에도 같다', () => {
  const run = createRun({ draft: false, seed: 3, dan: 8, opening: 'london' });
  const back = JSON.parse(JSON.stringify(run));
  assert.deepEqual(back, run);
  applyRun(back, { type: 'play' });
  assert.equal(back.battle.movesLeft, 4);
  assert.equal(back.battle.discardsLeft, 2);
  assert.equal(back.clock, 2);
});

test('기록: 외통 · 평가 · 도감 · 해금 · 단', () => {
  const rec = emptyRecords();
  const run = createRun({ draft: false, seed: 3 });
  const fresh = observe(rec, run, [{ type: 'win', reason: 'mate' }, { type: 'grade', mark: '★★★' }, { type: 'fragment', legend: 'opera', part: 'first', have: { first: true, feat: false, gold: false } }]);
  assert.equal(rec.mates, 1);
  assert.equal(rec.grades['★★★'], 1);
  assert.equal(rec.codex.legends.opera, 1);
  assert.ok(fresh.includes('legends:opera'));
  // 같은 것은 두 번 새로 치지 않는다
  assert.equal(observe(rec, run, []).length, 0);
  assert.equal(nextUnlock(rec).id, 'london');
  rec.bestAnte = 5;
  run.phase = 'won';
  const out = finishRun(rec, run);
  assert.deepEqual(out.unlocked, ['london', 'queens_gambit']);
  assert.equal(out.dan, 1);
  assert.equal(rec.unlocked.dan, 1);
  assert.equal(rec.wins, 1);
  assert.equal(nextUnlock(rec).id, 'sicilian');
  assert.ok(noteMove(rec, 500, ['N', 'B'], 2));
  assert.ok(!noteMove(rec, 400, ['N'], 2));
  assert.equal(UNLOCKS.length, 4);
  // 단은 이긴 단 + 1까지만, 8에서 멈춘다
  const r8 = createRun({ draft: false, seed: 1, dan: MAX_DAN }); r8.phase = 'won';
  rec.unlocked.dan = MAX_DAN;
  assert.equal(finishRun(rec, r8).dan, null);
});

test('오늘의 대국: 날짜마다 정해진 시드', () => {
  assert.equal(dailySeed('2026-09-26'), dailySeed('2026-09-26'));
  assert.notEqual(dailySeed('2026-09-26'), dailySeed('2026-09-27'));
  const a = createRun({ draft: false, seed: dailySeed('2026-09-26') }), b = createRun({ draft: false, seed: dailySeed('2026-09-26') });
  assert.deepEqual(a, b);
  const rec = emptyRecords();
  a.phase = 'lost'; a.ante = 3;
  finishRun(rec, a, { daily: '2026-09-26' });
  assert.equal(rec.daily.ante, 3);
  a.ante = 2;
  finishRun(rec, a, { daily: '2026-09-26' });
  assert.equal(rec.daily.ante, 3);
  assert.equal(rec.daily.runs, 2);
});

test('세기의 대국 첫 조각은 기보 꾸러미에서 4%로 나오고 고르면 받는다(2b에서 0이었던 것은 봇 탓)', async () => {
  const { rollPackOptions } = await import('../src/sim/shop.js');
  const run = createRun({ draft: false, seed: 1 });
  run.shop = { rng: { s: 99 }, display: [], packs: [], rerolls: 0 };
  let n = 0;
  const N = 5000;
  for (let i = 0; i < N; i++) if (rollPackOptions(run, 'chart').some((o) => o.kind === 'fragment' && o.legend === 'century')) n++;
  assert.ok(n / N > 0.03 && n / N < 0.05, `기보 꾸러미에서 ${n}/${N}`);
  // 다른 꾸러미에서는 나오지 않는다
  for (let i = 0; i < 2000; i++) for (const k of ['piece', 'engraving']) assert.ok(!rollPackOptions(run, k).some((o) => o.legend === 'century'));
  // 고르면 첫 조각
  run.phase = 'pack';
  run.pack = { kind: 'chart', options: [{ kind: 'chart', form: 'N' }, { kind: 'fragment', legend: 'century' }] };
  const ev = applyRun(run, { type: 'pick', index: 1 });
  assert.ok(ev.some((e) => e.type === 'fragment' && e.legend === 'century' && e.part === 'first'));
  assert.ok(run.fragments.century.first);
});
