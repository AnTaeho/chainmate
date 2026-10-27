// 판 밖: 오프닝 다섯 · 단 1~8 · 기록/도감/해금 · 오늘의 대국
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, blindInfo, targetFor, DANS, danRules, chestCounts, CHEST, maximCapacity } from '../src/sim/run.js';
import { rerollCost, rollDisplay, rollPacks, rollItem, SHOP } from '../src/sim/shop.js';
import { OPENINGS } from '../src/data/openings.js';
import { FINAL_MASTER } from '../src/data/masters.js';
import { stepBattle } from '../tools/bot.mjs';
import { emptyRecords, loadRecords, observe, finishRun, nextUnlock, noteMove, dailySeed, UNLOCKS, MAX_DAN } from '../src/ui/records.js';
import { mergeRecords } from '../src/ui/merge.js';
import { makeStore, KEYS } from '../src/ui/save.js';

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

test('단 1: 증원 +1 / 단 4: 시계 −1 / 단 8: 수는 그대로', () => {
  const plain = createRun({ draft: false, seed: 9 }); applyRun(plain, { type: 'play' });
  assert.equal(plain.clock, 3);
  const r1 = createRun({ draft: false, seed: 9, dan: 1 }); applyRun(r1, { type: 'play' });
  assert.equal(r1.battle.incoming.length, plain.battle.incoming.length + 1);
  assert.equal(createRun({ draft: false, seed: 9, dan: 4 }).clock, 2);
  assert.equal(createRun({ draft: false, seed: 9, dan: 8 }).clock, 2);
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

test('단 3부터: 첫 조각 확률 반(진열 6000칸)', () => {
  const rate = (dan) => {
    const run = createRun({ draft: false, seed: 1, dan });
    const rng = { s: 12345 };
    let n = 0;
    for (let i = 0; i < 6000; i++) if (rollItem(run, rng, []).kind === 'fragment') n++;
    return n / 6000;
  };
  const r0 = rate(0), r6 = rate(6);
  const p = SHOP.fragmentChance.display;
  assert.ok(r0 > p * 0.6 && r0 < p * 1.4, `단 0 ${r0} (기대 ${p})`);
  assert.ok(r6 > p * 0.2 && r6 < p * 0.8, `단 6 ${r6} (기대 ${p / 2})`);
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

test('세기의 대국 첫 조각은 기보 꾸러미에서 덤으로 나오고, 꾸러미를 열면 고르지 않아도 받는다', async () => {
  const { rollPack, SHOP } = await import('../src/sim/shop.js');
  const { createRng } = await import('../src/sim/rng.js');
  const { legalRunCommands } = await import('../src/sim/run.js');
  const run = createRun({ draft: false, seed: 1 });
  run.shop = { rng: { s: 99 }, display: [], packs: [], rerolls: 0 };
  let n = 0;
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const { options, bonus } = rollPack(run, 'chart');
    assert.equal(options.length, 3);
    assert.ok(!options.some((o) => o.kind === 'fragment'), '조각은 고르는 칸에 끼지 않는다');
    if (bonus && bonus.legend === 'century') n++;
  }
  const p = SHOP.fragmentChance.pack;
  assert.ok(n / N > p * 0.75 && n / N < p * 1.25, `기보 꾸러미에서 ${n}/${N} (기대 ${p})`);
  // 다른 꾸러미에서는 나오지 않는다
  for (let i = 0; i < 2000; i++) for (const k of ['piece', 'engraving']) assert.ok((rollPack(run, k).bonus || {}).legend !== 'century');
  // 꾸러미를 사면 덤 조각은 곧바로 받고(사건 packOpen 뒤 fragment via pack), 고르는 칸은 셋 그대로
  const keep = SHOP.fragmentChance;
  SHOP.fragmentChance = { ...keep, pack: 1 };
  try {
    run.phase = 'shop';
    run.money = 20;
    run.shop = { rng: createRng(3), display: [], packs: [{ kind: 'chart', price: 4, sold: false }], rerolls: 0 };
    const ev = applyRun(run, { type: 'buyPack', slot: 0 });
    const at = ev.findIndex((e) => e.type === 'packOpen');
    const fi = ev.findIndex((e) => e.type === 'fragment' && e.legend === 'century' && e.part === 'first' && e.via === 'pack');
    assert.ok(at >= 0 && fi > at, '꾸러미를 연 뒤 덤 조각');
    assert.deepEqual(ev[at].bonus, { kind: 'fragment', legend: 'century' });
    assert.ok(run.fragments.century.first);
    assert.equal(run.pack.options.length, 3);
    assert.ok(!legalRunCommands(run).some((c) => c.type === 'pick' && c.index === 3));
    applyRun(run, { type: 'pick', index: 0 });
    assert.equal(run.phase, 'shop');
  } finally { SHOP.fragmentChance = keep; }
});

test('최고 도달은 8관까지: 끝없는 대국의 명령 · 예전에 8을 넘겨 적힌 기록 · 다른 기기에서 온 기록 모두', () => {
  const rec = emptyRecords();
  const run = createRun({ draft: false, seed: 4 });
  run.endless = true; run.ante = 11;
  observe(rec, run, []);
  assert.equal(rec.bestAnte, 8);
  const mem = new Map([[KEYS.records, JSON.stringify({ v: 1, runs: 2, bestAnte: 12 })]]);
  const store = makeStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });
  assert.equal(loadRecords(store).bestAnte, 8);
  assert.equal(mergeRecords({ ...emptyRecords(), bestAnte: 11 }, { ...emptyRecords(), bestAnte: 5 }).bestAnte, 8);
  assert.equal(mergeRecords({ ...emptyRecords(), bestAnte: 3 }, { ...emptyRecords(), bestAnte: 5 }).bestAnte, 5);
});
