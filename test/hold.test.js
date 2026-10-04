// 찜(CHM-58 F): 진열 카드 한 장을 다음 상점까지 맡겨 둔다 — 찜 · 풀기 · 옮기기, 다음 상점 같은 칸 · 새로 굴리는 칸 하나,
// 다시 진열에서 빠짐, 다음 상점의 값으로 사기, 떠났다 돌아오기, 사지 않으면 끝남, 건너뛰기 패 덤과 겹침, JSON 왕복.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, blindInfo } from '../src/sim/run.js';
import { SHOP, rollDisplay } from '../src/sim/shop.js';
import { shopRun, playToShop, skipBlind } from './helpers/run.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => { const k = (it) => JSON.stringify({ ...it, price: undefined, base: undefined, sold: undefined, kept: undefined }); return k(a) === k(b); };
const hold = (run, slot) => applyRun(run, { type: 'hold', slot });
// 상점을 떠나 다음 대국을 두고 다음 상점에 선다
const nextShop = (run, opts) => { applyRun(run, { type: 'leave' }); return playToShop(run, opts); };

test('찜 · 풀기 · 옮기기: 한 번에 하나, 값은 없다', () => {
  const run = shopRun(1);
  const money = run.money;
  assert.equal(run.hold, null);
  let ev = hold(run, 0);
  assert.deepEqual(ev, [{ type: 'hold', slot: 0, on: true }]);
  assert.equal(run.hold.slot, 0);
  assert.ok(same(run.hold.item, run.shop.display[0]));
  assert.equal(run.money, money);
  hold(run, 1);
  assert.equal(run.hold.slot, 1, '다른 카드를 찜하면 옮겨 간다');
  ev = hold(run, 1);
  assert.deepEqual(ev, [{ type: 'hold', slot: 1, on: false }]);
  assert.equal(run.hold, null, '같은 카드를 다시 찜하면 풀린다');
  // 산 카드는 찜할 수 없고, 찜한 카드를 사면 찜이 풀린다
  run.money = 99;
  hold(run, 0);
  applyRun(run, { type: 'buy', slot: 0 });
  assert.equal(run.hold, null);
  assert.throws(() => hold(run, 0));
  assert.throws(() => applyRun(createRun({ draft: false, seed: 1 }), { type: 'hold', slot: 0 }), /not allowed/);
});

test('다음 상점: 찜한 카드가 같은 칸에, 새로 굴리는 칸은 하나 · 다시 진열해도 그대로', () => {
  for (const slot of [0, 1]) {
    const run = shopRun(2);
    hold(run, slot);
    const item = clone(run.shop.display[slot]);
    // 이 상점에서 다시 진열해도 찜한 칸은 그대로
    run.money = 99;
    applyRun(run, { type: 'reroll' });
    assert.ok(same(run.shop.display[slot], item));
    nextShop(run);
    const d = run.shop.display;
    assert.equal(d.length, SHOP.displaySlots);
    assert.ok(same(d[slot], item), `${slot}칸에 그대로`);
    assert.equal(d[slot].kept, true);
    assert.ok(!d[1 - slot].kept);
    assert.equal(run.hold, null, '찜은 다음 상점을 열며 끝난다');
    // 새로 굴린 칸 하나만 바뀐다(다음 상점에서도 다시 진열에서 빠짐)
    run.money = 99;
    for (let i = 0; i < 3; i++) { applyRun(run, { type: 'reroll' }); assert.ok(same(run.shop.display[slot], item)); }
    // 찜한 격언은 새로 굴린 칸에 또 나오지 않는다
    if (item.kind === 'maxim') assert.notEqual(run.shop.display[1 - slot].id, item.id);
  }
});

test('찜한 칸이 없으면 진열 난수는 예전 그대로(새로 굴릴 칸만 난수를 쓴다)', () => {
  const a = shopRun(3), b = clone(a);
  rollDisplay(a); rollDisplay(b);
  assert.deepEqual(a.shop.display, b.shop.display);
  // 둘째 칸을 찜해도 첫 칸은 같은 난수로 굴린다(붙박인 칸은 난수를 쓰지 않는다)
  const c = clone(b), base = clone(b);
  c.hold = { slot: 1, item: { kind: 'evolve', base: 4 } };
  rollDisplay(base);
  rollDisplay(c);
  assert.ok(same(c.shop.display[0], base.shop.display[0]));
});

test('다음 상점의 값으로 산다: 값 덤(단 3 +1)은 그때 기준', () => {
  const run = shopRun(4);
  const slot = 0, base = run.shop.display[slot].price;
  hold(run, slot);
  run.stake = { ...(run.stake || {}), price: 2 }; // 그사이 값 덤이 바뀌었다고 치고
  nextShop(run);
  const it = run.shop.display[slot];
  assert.equal(it.price, base + 2);
  run.money = it.price;
  applyRun(run, { type: 'buy', slot });
  assert.equal(run.money, 0);
  assert.equal(it.sold, true);
  // 산 칸은 더는 붙박이가 아니다 — 다시 진열하면 새로 굴린다
  run.money = 99;
  applyRun(run, { type: 'reroll' });
  assert.equal(run.shop.display[slot].sold, false);
  assert.ok(!run.shop.display[slot].kept);
});

test('떠났다 돌아오기: 찜은 그대로, 돌아와 풀면 다음 상점은 둘 다 새로', () => {
  const run = shopRun(5);
  hold(run, 1);
  const item = clone(run.shop.display[1]);
  applyRun(run, { type: 'leave' });
  applyRun(run, { type: 'shop' });
  assert.equal(run.phase, 'shop');
  assert.equal(run.hold.slot, 1);
  assert.ok(same(run.shop.display[1], item), '돌아온 상점에서도 찜한 칸 그대로');
  // 돌아와서 다시 떠나 두면 다음 상점에 남는다
  const kept = clone(run);
  nextShop(kept);
  assert.ok(same(kept.shop.display[1], item));
  // 돌아와서 풀면 남지 않는다
  hold(run, 1);
  nextShop(run);
  assert.ok(run.shop.display.every((it) => !it.kept));
});

test('사지 않으면 찜은 거기서 끝난다 — 다시 찜하면 그다음 상점까지(횟수 제한 없음)', () => {
  const run = shopRun(6);
  hold(run, 0);
  const item = clone(run.shop.display[0]);
  nextShop(run);
  assert.ok(same(run.shop.display[0], item));
  // 사지 않고 떠나면 그다음 상점엔 없다
  const gone = clone(run);
  nextShop(gone);
  assert.ok(gone.shop.display.every((it) => !it.kept));
  // 넘어온 카드를 다시 찜하면 또 남는다
  hold(run, 0);
  assert.ok(!run.hold.item.kept);
  nextShop(run);
  assert.ok(same(run.shop.display[0], item));
  assert.equal(run.shop.display[0].kept, true);
});

test('진 뒤에 열린 상점에도 남는다 · 그사이 같은 격언을 얻었으면 찜은 버린다', () => {
  const run = shopRun(7);
  hold(run, 0);
  const item = clone(run.shop.display[0]);
  const clock = run.clock;
  nextShop(run, { lose: true });
  assert.equal(run.clock, clock - 1);
  assert.ok(same(run.shop.display[0], item));
  // 격언을 찜한 뒤 같은 격언이 다른 길로 들어오면 다음 상점에선 새로 굴린다
  const m = shopRun(8);
  m.shop.display[0] = { kind: 'maxim', id: 'vault', edition: null, price: 6, sold: false };
  hold(m, 0);
  m.maxims.push({ uid: m.nextUid++, id: 'vault', data: {}, edition: null, paid: 0 });
  nextShop(m);
  assert.ok(m.shop.display.every((it) => !it.kept && !(it.kind === 'maxim' && it.id === 'vault')));
});

test('건너뛰기 패의 다음 상점 덤과 겹쳐도: 값 없는 다시 진열 · 꾸러미 칸 +1, 찜한 칸 그대로', () => {
  // 1관 연습 대국 패가 다시 진열인 판을 찾아, 첫 상점은 정식 뒤에 연다: 연습을 건너뛰어 덤을 받고 정식을 둔다 — 찜할 상점이 없으니
  // 1관 정식 · 2관 연습의 패로 고른다(1관 정식 뒤 상점에서 찜 → 2관 연습을 덤 패로 건너뜀 → 2관 정식 뒤 상점)
  let run = null;
  for (let seed = 1; seed < 3000 && !run; seed++) {
    const r = createRun({ draft: false, seed });
    if (blindInfo(r, 2, 0).tag.kind === 'reroll' || blindInfo(r, 2, 0).tag.kind === 'slot') run = r;
  }
  assert.ok(run);
  const kind = blindInfo(run, 2, 0).tag.kind;
  playToShop(run);                       // 1관 연습 뒤
  applyRun(run, { type: 'leave' });
  playToShop(run);                       // 1관 정식 뒤
  applyRun(run, { type: 'leave' });
  playToShop(run);                       // 1관 마스터전 뒤
  hold(run, 1);
  const item = clone(run.shop.display[1]);
  applyRun(run, { type: 'leave' });
  assert.equal(run.ante, 2);
  skipBlind(run);                        // 2관 연습을 건너뛰어 덤
  assert.ok(run.perks);
  const saved = clone(run);              // JSON 왕복(찜 · 덤이 같이 남는다)
  playToShop(saved);
  assert.ok(same(saved.shop.display[1], item));
  assert.equal(saved.shop.display[1].kept, true);
  if (kind === 'reroll') {
    const money = saved.money;
    applyRun(saved, { type: 'reroll' });
    applyRun(saved, { type: 'reroll' });
    assert.equal(saved.money, money, '값 없는 다시 진열 둘');
    assert.ok(same(saved.shop.display[1], item));
  } else assert.equal(saved.shop.packs.length, SHOP.packSlots + 1);
  assert.equal(saved.perks, undefined);
});

test('JSON 왕복: 찜한 상태로 저장했다 불러도 같다 · 옛 저장(hold 없음)도 돈다', () => {
  const run = shopRun(9);
  hold(run, 0);
  const a = clone(run);
  assert.deepEqual(a.hold, run.hold);
  nextShop(run); nextShop(a);
  assert.deepEqual(clone(a.shop.display), clone(run.shop.display));
  const old = shopRun(10);
  delete old.hold;
  nextShop(old);
  assert.ok(old.shop.display.every((it) => !it.kept));
});
