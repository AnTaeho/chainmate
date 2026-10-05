// 빌드 단면(CHM-65, tools/build.mjs): 격언 효과 꼴 나누기, 명령 하나의 상금 흐름, 짜임 단면, 힘 재기가 판을 건드리지 않음,
// 실제 대국 · 상점을 기록기로 받아 상금 흐름이 남김없이 나뉘는가, 힘 비율이 처음 1 밑인 관.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun } from '../src/sim/run.js';
import { finishBattle } from './helpers/run.js';
import { maximForm, ledger, buildState, measurePower, buildLog, firstBelow, growth, powerSeed } from '../tools/build.mjs';

test('격언 효과 꼴: 카드 글이 먼저, 글에 없으면 훅의 셈', () => {
  assert.equal(maximForm('chivalry'), 'x');      // 배수 ×1.5
  assert.equal(maximForm('quick_change'), 'm');  // 배수 +2
  assert.equal(maximForm('pawn_march'), 'v');    // 값 +40
  assert.equal(maximForm('last_square'), 'v');   // 값 ×2 — 값 쪽
  assert.equal(maximForm('gambler'), 'x');       // 넷에 하나 배수 ×3(onChainLuck라 훅 셈에는 안 보인다)
  assert.equal(maximForm('vault'), 'o');         // 상금
});

test('상금 흐름: 보상(이자 따로) · 상자 · 패 · 팔기 · 산 값 · 꾸러미 · 다시 진열, 놓친 것은 other', () => {
  const won = ledger({ type: 'capture', sq: 1 }, [{ type: 'reward', base: 3, moves: 2, interest: 4, mate: 0, overflow: 1, earned: 0, total: 10 }, { type: 'money', src: 'chest', money: 2 }, { type: 'money', src: 'gem', money: 2 }], 12);
  assert.deepEqual(won, { earn: { interest: 4, reward: 6, chest: 2 }, spend: {}, other: 0 }); // gem 상금은 보상의 earned에 이미 든다
  assert.deepEqual(ledger({ type: 'buy', slot: 0 }, [{ type: 'buy', item: { kind: 'maxim', id: 'chivalry', price: 5 } }], -5), { earn: {}, spend: { maxim: 5 }, other: 0 });
  assert.deepEqual(ledger({ type: 'buy', slot: 1 }, [{ type: 'buy', item: { kind: 'soul', id: 'echo', price: 6 } }], -6).spend, { soul: 6 });
  assert.deepEqual(ledger({ type: 'reroll' }, [{ type: 'reroll' }], -6), { earn: {}, spend: { reroll: 6 }, other: 0 });
  assert.deepEqual(ledger({ type: 'reroll' }, [{ type: 'reroll' }], 0), { earn: {}, spend: {}, other: 0 }); // 값 없는 다시 진열
  assert.deepEqual(ledger({ type: 'buyPack', slot: 0 }, [{ type: 'packOpen' }], -4).spend, { pack: 4 });
  assert.deepEqual(ledger({ type: 'sell', index: 0 }, [{ type: 'sell', id: 'x', money: 2 }], 2), { earn: { sell: 2 }, spend: {}, other: 0 });
  assert.deepEqual(ledger({ type: 'skip' }, [{ type: 'skip', tag: { kind: 'money' }, money: 6 }], 6).earn, { tag: 6 });
  assert.equal(ledger({ type: 'leave' }, [], 3).other, 3, '나누지 못한 상금은 other로');
});

test('짜임 단면: 격언 꼴 · 판본 · 기보 · 주머니', () => {
  const run = createRun({ seed: 3, draft: false });
  run.maxims.push({ uid: 1, id: 'chivalry', data: {}, edition: 'rainbow', paid: 10 }, { uid: 2, id: 'quick_change', data: {}, edition: null, paid: 4 });
  run.charts.Q = 3; run.charts.N = 1;
  const s = buildState(run);
  assert.equal(s.maxims, 2);
  assert.deepEqual(s.form, { x: 1, m: 1, v: 0, o: 0 });
  assert.deepEqual(s.editions, { rainbow: 1 });
  assert.deepEqual(s.edForm, { x: 1, m: 0, v: 0, o: 0 });
  assert.equal(s.charts, 4);
  assert.deepEqual(s.chartTop, ['Q', 3]);
  assert.equal(s.deck, run.deck.length);
  assert.equal(s.money, run.money);
});

test('힘 재기: 판을 바꾸지 않고, 같은 판이면 같은 값', () => {
  const run = createRun({ seed: 5, draft: false });
  const before = JSON.stringify(run);
  const a = measurePower(run, 2, { n: 2, nodes: 2000 });
  assert.equal(JSON.stringify(run), before, '판 상태 그대로');
  const b = measurePower(run, 2, { n: 2, nodes: 2000 });
  assert.deepEqual(a, b);
  assert.equal(a.scores.length, 2);
  assert.ok(a.target > 0 && a.mean >= 0);
  assert.notEqual(powerSeed(2, 0), powerSeed(2, 1));
});

test('기록기: 첫 대국 · 첫 상점의 상금 흐름이 남김없이 나뉘고 상점 진열 · 남긴 돈이 남는다', () => {
  const run = createRun({ seed: 1, draft: false });
  const log = buildLog(run, { power: false });
  const act = (cmd) => { const m = run.money, a = run.ante; const ev = applyRun(run, cmd); log.record(run, cmd, ev, m, a); return ev; };
  act({ type: 'play' });
  finishBattle(run, act);
  assert.equal(run.phase, 'shop');
  const shop = log.rows.shops[0];
  assert.ok(shop && shop.items.length >= 2, '진열이 남는다');
  assert.equal(log.rows.other, 0);
  run.money = Math.max(run.money, 20); // 다시 진열 값이 모자라지 않게(기록기 밖에서 바꾼 상금은 흐름에 들지 않는다)
  act({ type: 'reroll' });
  act({ type: 'leave' });
  assert.equal(log.rows.other, 0);
  assert.equal(shop.out, run.money, '떠날 때 돈');
  assert.ok(shop.items.some((it) => it.g === 1), '다시 진열한 카드');
});

test('힘 비율이 처음 1 밑인 관 · 오름', () => {
  const snaps = [{ ante: 1, power: { ratio: 3, mean: 600, target: 200 } }, { ante: 2, power: { ratio: 1.2, mean: 3600, target: 3000 } }, { ante: 3, power: { ratio: 0.8, mean: 8000, target: 10000 } }, { ante: 4 }];
  assert.equal(firstBelow(snaps), 3);
  assert.equal(firstBelow(snaps.slice(0, 2)), null);
  assert.deepEqual(growth(snaps[0], snaps[1]), { target: 15, score: 6 });
  assert.equal(growth(snaps[2], snaps[3]), null);
});
