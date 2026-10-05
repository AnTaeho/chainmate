// 연줄(CHM-68 C, 빗나감 보정)과 시너지 끌어당김(CHM-68 E): 드문 층(금빛 적 · 판본 · 첫 조각)이 오래 안 나오면 확률이 오르고
// 나오면 처음으로 · 상한 · 몫 0이면 같은 굴림 · 문턱 하나 앞 시너지 물건의 무게가 오름 · pull 1이면 같은 굴림 · JSON 왕복.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, battleOpts } from '../src/sim/run.js';
import { SHOP, pityOf, pityChance, pityMiss, pityHit, rollDisplay, rollItem, nearFamilies, pullWeight } from '../src/sim/shop.js';
import { GOLDEN } from '../src/sim/battle.js';
import { createRng } from '../src/sim/rng.js';
import { maximFamilies } from '../src/data/families.js';
import { shopRun, finishBattle, playToShop } from './helpers/run.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
// SHOP 수치를 잠깐 바꿔 재고 되돌린다
function withShop(patch, fn) {
  const old = {};
  for (const k of Object.keys(patch)) old[k] = SHOP[k];
  Object.assign(SHOP, patch);
  try { return fn(); } finally { Object.assign(SHOP, old); }
}
const zeroPity = { golden: { step: 0, max: 0.2 }, edition: { step: 0, max: 0.15 }, fragment: { step: 0, max: 0.12 } };
const surePity = { golden: { step: 1, max: 1 }, edition: { step: 1, max: 1 }, fragment: { step: 1, max: 1 } };

test('연줄: 확률은 기본 + 몫 × 지난 수, 상한에서 멈추고, 기본이 상한보다 크면 기본 그대로', () => {
  const { step, max } = SHOP.pity.golden;
  assert.equal(pityChance(GOLDEN.chance, 'golden', 0), GOLDEN.chance);
  assert.ok(Math.abs(pityChance(GOLDEN.chance, 'golden', 3) - (GOLDEN.chance + 3 * step)) < 1e-12);
  assert.equal(pityChance(GOLDEN.chance, 'golden', 10000), max, '상한');
  assert.ok(pityChance(GOLDEN.calling, 'golden', 5) > GOLDEN.calling, '금빛의 부름 위에도 오른다');
  withShop({ pity: { ...SHOP.pity, golden: { step: 0.01, max: 0.05 } } }, () => {
    assert.equal(pityChance(0.1, 'golden', 50), 0.1, '기본이 상한보다 크면 기본');
  });
  withShop({ pity: zeroPity }, () => assert.equal(pityChance(0.04, 'golden', 50), 0.04, '몫 0'));
});

test('연줄 상태: 새 판은 0, 옛 저장(없음)은 0으로 읽고 처음 빗나갈 때 만든다, 나오면 0', () => {
  assert.deepEqual(createRun({ seed: 2 }).pity, { golden: 0, edition: 0, fragment: 0 });
  const old = clone(createRun({ seed: 2 }));
  delete old.pity;
  assert.equal(pityOf(old, 'golden'), 0);
  pityHit(old, 'golden');
  assert.equal(old.pity, undefined, '나와도 없는 상태는 만들지 않는다');
  pityMiss(old, 'edition'); pityMiss(old, 'edition');
  assert.deepEqual(old.pity, { golden: 0, edition: 2, fragment: 0 });
  pityHit(old, 'edition');
  assert.equal(old.pity.edition, 0);
});

test('금빛 적 연줄: 금빛 적 없는 대국을 열 때마다 하나 더, 금빛 적이 서면 처음으로', () => {
  const run = createRun({ draft: false, seed: 1 });
  run.pity.golden = 7;
  const before = battleOpts(run).opts.goldenChance;
  assert.ok(Math.abs(before - pityChance(GOLDEN.chance, 'golden', 7)) < 1e-12, '대국을 여는 재료가 연줄을 읽는다');
  withShop({ pity: zeroPity }, () => {
    applyRun(run, { type: 'play' });
    const gold = run.battle.board.some((c) => c && c.gold);
    assert.equal(run.pity.golden, gold ? 0 : 8);
  });
  finishBattle(run);
  // 확률 1로 두면 금빛 적이 서고 연줄은 0으로
  const r2 = createRun({ draft: false, seed: 1 });
  r2.pity.golden = 3;
  withShop({ pity: surePity }, () => applyRun(r2, { type: 'play' }));
  assert.ok(r2.battle.board.some((c) => c && c.gold));
  assert.equal(r2.pity.golden, 0);
});

test('판본 · 첫 조각 연줄: 상점을 열 때마다 하나 더, 진열에 나오면 처음으로', () => {
  // 판본 · 조각이 나올 수 없게 두면 상점마다 하나씩 쌓인다
  const run = withShop({ editionChance: 0, fragmentChance: { display: 0, pack: 0 } }, () => {
    const r = shopRun(1);
    assert.deepEqual([r.pity.edition, r.pity.fragment], [1, 1]);
    applyRun(r, { type: 'leave' });
    playToShop(r);
    assert.deepEqual([r.pity.edition, r.pity.fragment], [2, 2]);
    return r;
  });
  // 판본: 격언만 나오게 두고 확률 1 — 첫 판본에서 0으로 돌아가고, 같은 상점의 다음 격언은 기본 확률로
  run.pity.edition = 4;
  withShop({ pity: { ...zeroPity, edition: surePity.edition }, kindWeights: [['maxim', 1]] }, () => rollDisplay(run));
  assert.equal(run.shop.display[0].kind, 'maxim');
  assert.ok(run.shop.display[0].edition, '확률 1이면 첫 격언에 판본');
  assert.equal(run.pity.edition, 0);
  // 첫 조각: 진열 칸 확률 1
  run.pity.fragment = 4;
  withShop({ pity: surePity }, () => rollDisplay(run));
  assert.equal(run.shop.display[0].kind, 'fragment');
  assert.equal(run.pity.fragment, 0);
});

test('몫 0이면 연줄이 얼마든 진열 · 금빛 확률이 연줄 없을 때와 같다(같은 난수를 같은 만큼 쓴다)', () => {
  withShop({ pity: zeroPity }, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = shopRun(seed), b = clone(a);
      a.pity = { golden: 0, edition: 0, fragment: 0 };
      b.pity = { golden: 40, edition: 40, fragment: 40 };
      for (let i = 0; i < 30; i++) { rollDisplay(a); rollDisplay(b); }
      assert.deepEqual(b.shop.display, a.shop.display);
      assert.equal(b.shop.rng.s, a.shop.rng.s);
      assert.equal(battleOpts(b).opts.goldenChance, battleOpts(a).opts.goldenChance);
    }
  });
  // 몫이 있어도 연줄 1(지난 상점 없이 이 상점만)이면 기본 확률 — 몫 0과 같은 진열
  const a = shopRun(3);
  a.pity.edition = 1; a.pity.fragment = 1;
  const b = clone(a);
  for (let i = 0; i < 30; i++) rollDisplay(a);
  withShop({ pity: zeroPity }, () => { for (let i = 0; i < 30; i++) rollDisplay(b); });
  assert.deepEqual(a.shop.display, b.shop.display);
});

// 기사(leap) 하나만 가진 판: 기사가 문턱 2 바로 앞(1)
function leapRun() {
  const run = shopRun(1);
  run.maxims = [{ uid: 900, id: 'chivalry', data: {}, edition: null, paid: 0 }];
  run.josekis = [];
  run.consumables = [];
  return run;
}

test('끌어당김: 문턱 하나 앞(1 · 3 · 5) 시너지를 찾는다', () => {
  const run = leapRun();
  assert.deepEqual([...nearFamilies(run)], ['leap']);
  run.maxims.push({ uid: 901, id: 'cavalry_charge', data: {} }, { uid: 902, id: 'close_call', data: {} });
  assert.deepEqual([...nearFamilies(run)], ['leap'], '셋도 하나 앞');
  run.maxims.push({ uid: 903, id: 'first_move', data: {} });
  assert.equal(nearFamilies(run), null, '넷은 문턱 위');
  assert.equal(pullWeight(new Set(['leap']), ['leap', 'march']), SHOP.pull, '둘 붙어도 한 번');
  assert.equal(pullWeight(new Set(['leap']), ['diag']), 1);
  withShop({ pull: 1 }, () => assert.equal(nearFamilies(leapRun()), null, 'pull 1이면 끌어당기지 않는다'));
});

test('끌어당김: 하나 앞 시너지가 붙은 격언이 더 자주 나온다', () => {
  const run = leapRun();
  const near = nearFamilies(run);
  const share = (nearSet) => {
    const rng = createRng(77);
    let hit = 0, n = 0;
    withShop({ kindWeights: [['maxim', 1]], fragmentChance: { display: 0, pack: 0 }, pity: zeroPity }, () => {
      for (let i = 0; i < 3000; i++) {
        const it = rollItem(run, rng, ['chivalry'], nearSet);
        if (it.kind !== 'maxim') continue;
        n++;
        if (maximFamilies(it.id).includes('leap')) hit++;
      }
    });
    return hit / n;
  };
  const base = share(null), pulled = share(near);
  assert.ok(pulled > base * 1.8, `기사 격언 몫 ${base.toFixed(3)} → ${pulled.toFixed(3)}`);
});

test('끌어당김: pull 1이면 하나 앞 시너지가 있어도 굴림이 같다(무게 1의 굴림 = 고른 굴림)', () => {
  const run = leapRun();
  withShop({ pull: 1 }, () => {
    const ra = createRng(5), rb = createRng(5);
    for (let i = 0; i < 2000; i++) assert.deepEqual(rollItem(run, rb, [], new Set(['leap', 'diag', 'march', 'change'])), rollItem(run, ra, [], null));
    assert.equal(ra.s, rb.s);
  });
});

test('JSON 왕복: 연줄 · 끌어당김이 있는 판을 저장했다 읽어도 굴림이 같다', () => {
  const a = leapRun();
  a.pity = { golden: 6, edition: 3, fragment: 5 };
  const b = clone(a);
  for (let i = 0; i < 20; i++) { rollDisplay(a); rollDisplay(b); }
  assert.deepEqual(b.shop.display, a.shop.display);
  assert.deepEqual(b.pity, a.pity);
  assert.equal(battleOpts(b).opts.goldenChance, battleOpts(a).opts.goldenChance);
});
