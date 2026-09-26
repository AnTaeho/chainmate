// 상점: 진열 2칸(격언 · 기보 · 각인 · 기물) + 꾸러미 2개 + 다시 진열.
// 뽑기는 모두 run.shop.rng(상점마다 시드에서 갈라 낸 하위 스트림)에서. 상태는 순수 객체.
import { int, next } from './rng.js';
import { MAXIMS } from '../data/maxims.js';
import { CHARTS, CHART_FORMS, CHART_PRICE } from '../data/charts.js';
import { ENGRAVINGS, ENGRAVING_PRICE } from '../data/engravings.js';

// 수치(내가 정한 것 — DESIGN에 없는 값)
export const SHOP = {
  displaySlots: 2,
  packSlots: 2,
  rerollBase: 5,      // 다시 진열: 5, 누를 때마다 +1(상점마다 되돌아감)
  packPrice: 4,
  packSize: 3,
  promotePrice: 3,    // 기물 승급(상점마다 한 번)
  removePrice: 3,     // 기물 버리기(상점마다 한 번)
  deckMin: 4,         // 주머니는 손 크기 밑으로 줄일 수 없다
  // 진열 칸에 무엇이 나오나(무게)
  kindWeights: [['maxim', 55], ['chart', 20], ['engraving', 12], ['piece', 13]],
  // 격언 등급(무게). 전설은 상점에 나오지 않는다(step 2b)
  rarityWeights: [['common', 70], ['uncommon', 25], ['rare', 5]],
  // 낱개 기물 값과 기물 꾸러미의 무게
  piecePrice: { P: 2, N: 3, B: 3, R: 4, Q: 6 },
  pieceWeights: [['P', 20], ['N', 25], ['B', 25], ['R', 20], ['Q', 10]],
  engravingWeights: { common: 3, uncommon: 2 },
  packKinds: ['piece', 'chart', 'engraving'],
};

export const PROMOTE = { P: ['N', 'B'], N: ['R'], B: ['R'], R: ['Q'] };

function weighted(rng, pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = next(rng) * total;
  for (const [k, w] of pairs) { if ((r -= w) < 0) return k; }
  return pairs[pairs.length - 1][0];
}

// 가진 격언 · 이미 진열된 격언은 다시 나오지 않는다.
function rollMaxim(rng, exclude) {
  const rarity = weighted(rng, SHOP.rarityWeights);
  let pool = MAXIMS.filter((m) => m.rarity === rarity && !exclude.includes(m.id));
  if (!pool.length) pool = MAXIMS.filter((m) => m.rarity !== 'legendary' && !exclude.includes(m.id));
  if (!pool.length) return null;
  const m = pool[int(rng, pool.length)];
  return { kind: 'maxim', id: m.id, price: m.price };
}
const rollEngravingId = (rng, exclude = []) =>
  weighted(rng, ENGRAVINGS.filter((e) => !exclude.includes(e.id)).map((e) => [e.id, SHOP.engravingWeights[e.rarity] || 1]));

export function rollItem(run, rng, exclude) {
  const kind = weighted(rng, SHOP.kindWeights);
  if (kind === 'maxim') {
    const it = rollMaxim(rng, exclude);
    if (it) return it;
  }
  if (kind === 'chart') return { kind: 'chart', form: CHART_FORMS[int(rng, CHART_FORMS.length)], price: CHART_PRICE };
  if (kind === 'engraving') return { kind: 'engraving', id: rollEngravingId(rng), price: ENGRAVING_PRICE };
  const t = weighted(rng, SHOP.pieceWeights);
  return { kind: 'piece', t, price: SHOP.piecePrice[t] };
}

export function rollDisplay(run) {
  const rng = run.shop.rng;
  const exclude = run.maxims.map((m) => m.id);
  const out = [];
  for (let i = 0; i < SHOP.displaySlots; i++) {
    const it = rollItem(run, rng, exclude);
    if (it.kind === 'maxim') exclude.push(it.id);
    out.push({ ...it, sold: false });
  }
  run.shop.display = out;
}

export function rollPacks(run) {
  const rng = run.shop.rng;
  run.shop.packs = [];
  for (let i = 0; i < SHOP.packSlots; i++) {
    const kind = SHOP.packKinds[int(rng, SHOP.packKinds.length)];
    run.shop.packs.push({ kind, price: SHOP.packPrice, sold: false });
  }
}

// 꾸러미를 열면 3개 중 1개. 기보 · 각인은 서로 다른 셋.
export function rollPackOptions(run, kind) {
  const rng = run.shop.rng;
  const out = [];
  for (let i = 0; i < SHOP.packSize; i++) {
    if (kind === 'piece') out.push({ kind: 'piece', t: weighted(rng, SHOP.pieceWeights) });
    else if (kind === 'chart') {
      const pool = CHART_FORMS.filter((f) => !out.some((o) => o.form === f));
      out.push({ kind: 'chart', form: pool[int(rng, pool.length)] });
    } else out.push({ kind: 'engraving', id: rollEngravingId(rng, out.map((o) => o.id)) });
  }
  return out;
}

export const rerollCost = (run) => SHOP.rerollBase + run.shop.rerolls;
export const chartName = (f) => CHARTS[f].name;
