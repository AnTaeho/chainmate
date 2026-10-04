// 관 선택 ↔ 상점 오가기(docs/tasks/shop-chain.md A): 떠나온 상점으로 돌아가도 새로 얻는 것이 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skipBlind } from './helpers/run.js';
import { createRun, applyRun, legalRunCommands, canReopenShop } from '../src/sim/run.js';
import { stepBattle } from '../tools/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
// 상점 안에서 오가며 바뀌면 안 되는 것
const shopState = (run) => clone({ shop: run.shop, money: run.money, deck: run.deck, maxims: run.maxims, consumables: run.consumables, josekis: run.josekis });

// 봇으로 대국을 이기며 조건에 맞는 상점까지 간다(상점에선 곧바로 떠난다)
function reachShop(want, { draft = false, seeds = 30 } = {}) {
  for (let seed = 1; seed <= seeds; seed++) {
    const run = createRun({ draft, seed });
    while (run.phase !== 'lost' && run.phase !== 'won') {
      if (run.phase === 'draft') applyRun(run, { type: 'joseki', index: 0 });
      else if (run.phase === 'select') applyRun(run, { type: 'play' });
      else if (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
      else if (run.phase === 'shop') { if (want(run)) return run; applyRun(run, { type: 'leave' }); }
    }
  }
  throw new Error('상점에 닿지 못했다');
}

test('상점 → 관 선택 → 상점 → 관 선택: 진열 · 꾸러미 · 돈 · 대국 칸이 그대로', () => {
  const run = reachShop(() => true);
  applyRun(run, { type: 'reroll' });
  const inShop = shopState(run), at = [run.ante, run.blind];
  applyRun(run, { type: 'leave' });
  assert.equal(run.phase, 'select');
  assert.ok(canReopenShop(run));
  const next = [run.ante, run.blind];
  assert.notDeepEqual(next, at);
  for (let k = 0; k < 2; k++) {
    applyRun(run, { type: 'shop' });
    assert.equal(run.phase, 'shop');
    assert.deepEqual([run.ante, run.blind], at);
    assert.deepEqual(shopState(run), inShop);
    applyRun(run, { type: 'leave' });
    assert.equal(run.phase, 'select');
    assert.deepEqual([run.ante, run.blind], next, '대국 칸은 한 번만 오른다');
    assert.deepEqual(shopState(run), inShop);
  }
});

test('돌아간 상점에서 한 일은 떠나기 전에 한 것과 같다(다시 진열 횟수 · 승급을 쓴 것도 남는다)', () => {
  const run = reachShop((r) => r.money >= 12);
  const stay = clone(run);
  applyRun(stay, { type: 'reroll' });
  const away = clone(run);
  applyRun(away, { type: 'leave' });
  applyRun(away, { type: 'shop' });
  applyRun(away, { type: 'reroll' });
  assert.deepEqual(away.shop.display, stay.shop.display);
  assert.equal(away.money, stay.money);
  // 승급을 쓰고 떠났다 돌아와도 다시 쓸 수 없다
  const p = run.deck.find((x) => x.t === 'P' || x.t === 'N');
  applyRun(away, { type: 'promote', pieceId: p.id });
  applyRun(away, { type: 'leave' });
  applyRun(away, { type: 'shop' });
  assert.ok(away.shop.promoted);
  assert.equal(away.shop.rerolls, 1);
  assert.throws(() => applyRun(away, { type: 'promote', pieceId: p.id }));
});

test('두기 뒤 · 건너뛴 뒤 · 판의 첫 대국 앞에는 돌아갈 상점이 없다', () => {
  const first = createRun({ draft: false, seed: 1 });
  assert.equal(canReopenShop(first), false);
  assert.throws(() => applyRun(first, { type: 'shop' }));

  const run = reachShop((r) => r.blind === 0);
  applyRun(run, { type: 'leave' });
  const skip = clone(run);
  applyRun(run, { type: 'play' });
  assert.equal(run.shop, null);
  assert.throws(() => applyRun(run, { type: 'shop' }));
  // 건너뛰기: 연습 대국을 건너뛰면 다음 관 선택에도 상점이 없다
  skipBlind(skip);
  assert.equal(skip.phase, 'select');
  assert.equal(skip.shop, null);
  assert.equal(canReopenShop(skip), false);
  assert.throws(() => applyRun(skip, { type: 'shop' }));
});

test('정석 관: 정석을 고른 뒤의 관 선택에서만 상점으로 가고, 정석은 한 번만 고른다', () => {
  const run = reachShop((r) => r.ante === 2 && r.blind === 2, { draft: true });
  const inShop = shopState(run);
  applyRun(run, { type: 'leave' });
  assert.equal(run.phase, 'draft');
  assert.equal(canReopenShop(run), false);
  assert.throws(() => applyRun(run, { type: 'shop' }));
  applyRun(run, { type: 'joseki', index: 0 });
  const picked = run.josekis.slice();
  assert.equal(run.phase, 'select');
  applyRun(run, { type: 'shop' });
  assert.deepEqual([run.ante, run.blind], [2, 2]);
  assert.deepEqual(shopState(run).shop, inShop.shop);
  applyRun(run, { type: 'leave' });
  assert.equal(run.phase, 'select', '정석을 다시 고르지 않는다');
  assert.equal(run.draft, null);
  assert.deepEqual(run.josekis, picked);
  assert.deepEqual([run.ante, run.blind], [3, 0]);
});

test('저장 왕복: 관 선택(상점이 남은 채) · 돌아간 상점에서 저장하고 불러와도 같다', () => {
  const run = reachShop(() => true);
  applyRun(run, { type: 'leave' });
  const saved = clone(run);
  assert.deepEqual(saved, run);
  applyRun(saved, { type: 'shop' });
  applyRun(run, { type: 'shop' });
  assert.deepEqual(saved, run);
  const again = clone(saved);
  applyRun(again, { type: 'leave' });
  applyRun(saved, { type: 'leave' });
  assert.deepEqual(again, saved);
  // 옛 저장: 자리(ante · blind)가 없는 상점도 떠났다 돌아올 수 있다
  const old = clone(run);
  delete old.shop.ante; delete old.shop.blind;
  const at = [old.ante, old.blind];
  applyRun(old, { type: 'leave' });
  applyRun(old, { type: 'shop' });
  assert.deepEqual([old.ante, old.blind], at);
});

test('봇이 고르는 명령(legalRunCommands)에는 상점으로 돌아가기가 없다', () => {
  const run = reachShop(() => true);
  applyRun(run, { type: 'leave' });
  assert.ok(canReopenShop(run));
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'shop'));
});
