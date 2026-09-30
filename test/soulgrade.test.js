// CHM-17: 혼 등급(1단계) · 각성(2단계)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOULS, SOUL_BY_ID, SOUL_RARITY, soulPrice } from '../src/data/souls.js';
import { rollSoul, rollItem, SHOP } from '../src/sim/shop.js';
import { createRng } from '../src/sim/rng.js';
import { createRun } from '../src/sim/run.js';

test('혼 등급: 열여섯 모두 흔함 · 드묾 · 귀함 중 하나, 값은 등급을 따른다', () => {
  const n = { common: 0, uncommon: 0, rare: 0 };
  for (const s of SOULS) { assert.ok(s.rarity in n, s.id); n[s.rarity]++; assert.equal(soulPrice(s.id), SOUL_RARITY[s.rarity].price); }
  assert.deepEqual(n, { common: 6, uncommon: 5, rare: 5 });
  assert.ok(SOUL_RARITY.common.price < SOUL_RARITY.uncommon.price && SOUL_RARITY.uncommon.price < SOUL_RARITY.rare.price);
});

test('혼 등급: 같은 시드면 같은 혼, 나오는 몫은 등급 무게를 따른다', () => {
  const seq = (seed) => { const r = createRng(seed); return Array.from({ length: 50 }, () => rollSoul(r)); };
  assert.deepEqual(seq(7), seq(7));
  const r = createRng(1), n = { common: 0, uncommon: 0, rare: 0 }, N = 20000;
  for (let i = 0; i < N; i++) n[SOUL_BY_ID[rollSoul(r)].rarity]++;
  const total = Object.values(SOUL_RARITY).reduce((a, x) => a + x.weight, 0);
  for (const k of Object.keys(n)) assert.ok(Math.abs(n[k] / N - SOUL_RARITY[k].weight / total) < 0.015, `${k} ${n[k] / N}`);
});

test('혼 등급: 상점의 혼 두루마리 · 혼 깃든 기물은 그 혼의 값을 받는다', () => {
  const run = createRun({ seed: 3 });
  const r = createRng(11);
  let scrolls = 0, pieces = 0;
  for (let i = 0; i < 6000; i++) {
    const it = rollItem(run, r, []);
    if (it.kind === 'soul') { scrolls++; assert.equal(it.price, soulPrice(it.id)); }
    if (it.kind === 'piece' && it.soul) { pieces++; assert.equal(it.price, SHOP.piecePrice[it.t] + soulPrice(it.soul)); }
  }
  assert.ok(scrolls > 50 && pieces > 20, `${scrolls} ${pieces}`);
});
