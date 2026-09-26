// 상점: 진열 2칸(격언 · 기보 · 각인 · 기물) + 꾸러미 2개 + 다시 진열.
// 뽑기는 모두 run.shop.rng(상점마다 시드에서 갈라 낸 하위 스트림)에서. 상태는 순수 객체.
import { int, next } from './rng.js';
import { MAXIMS } from '../data/maxims.js';
import { CHARTS, CHART_FORMS, CHART_PRICE } from '../data/charts.js';
import { ENGRAVINGS, ENGRAVING_PRICE } from '../data/engravings.js';
import { EDITIONS, EDITION_BY_ID } from '../data/editions.js';
import { LEGENDS } from '../data/legends.js';

// 수치(내가 정한 것 — DESIGN에 없는 값)
export const SHOP = {
  displaySlots: 2,
  packSlots: 2,
  rerollBase: 5,      // 다시 진열: 5, 누를 때마다 +1(상점마다 되돌아감)
  packPrice: 4,
  packSize: 3,
  promotePrice: 3,    // 기물 승급(상점마다 한 번)
  removePrice: 3,     // 기물 버리기(상점마다 한 번)
  deckMin: 6,         // 주머니는 여섯 밑으로 줄일 수 없다(손 4 + 무르기 여유. 4까지 줄이면 대국 끝에 손이 비어 막힌다)
  // 진열 칸에 무엇이 나오나(무게)
  kindWeights: [['maxim', 55], ['chart', 20], ['engraving', 12], ['piece', 13]],
  // 격언 등급(무게). 전설은 상점에 나오지 않는다(step 2b)
  rarityWeights: [['common', 70], ['uncommon', 25], ['rare', 5]],
  // 낱개 기물 값과 기물 꾸러미의 무게
  piecePrice: { P: 2, N: 3, B: 3, R: 4, Q: 6 },
  pieceWeights: [['P', 20], ['N', 25], ['B', 25], ['R', 20], ['Q', 10]],
  engravingWeights: { common: 3, uncommon: 2 },
  packKinds: ['piece', 'chart', 'engraving'],
  // 격언 판본(HOOKS 「드문 것들의 사다리」 귀함 층, 칸당 ~5%): 진열에 나온 격언에 이 확률로 판본이 붙는다.
  // 격언이 진열 칸의 55%라 판본은 칸당 ≈ 2.2%, 귀한 격언(칸당 ≈ 2.75%)과 합쳐 귀함 층 ≈ 5%.
  // 8%(칸당 4.4%)에서는 판 봇의 81%가 판본 격언을 가졌고 은박(연쇄 +5)이 1~4관을 거의 공짜로 넘겼다. 금빛 꾸러미의 격언은 늘 판본.
  editionChance: 0.04,
  // 불멸의 기보 첫 조각: 진열 칸마다 · 꾸러미를 열 때마다 이 확률(명국마다 나오는 곳이 다르다, legends.js source).
  // 하네스로 맞춤(보고서 docs/reports/2b.md).
  fragmentChance: { display: 0.03, pack: 0.04 },
  fragmentPrice: 4,
  // 금빛 꾸러미(황금 기물을 먹은 대국 뒤 상점에 공짜로): 판본 붙은 격언 셋 중 하나. 등급은 드묾 쪽으로.
  goldenRarity: [['common', 40], ['uncommon', 45], ['rare', 15]],
  // 금빛 꾸러미에 첫 조각이 끼어 나올 확률(첫 조각을 가진 명국이 없어 금빛 조각을 못 받은 판에서만)
  goldenFragmentChance: 0.5,
};

export const PROMOTE = { P: ['N', 'B'], N: ['R'], B: ['R'], R: ['Q'] };

export function weighted(rng, pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = next(rng) * total;
  for (const [k, w] of pairs) { if ((r -= w) < 0) return k; }
  return pairs[pairs.length - 1][0];
}

export const rollEdition = (rng) => weighted(rng, EDITIONS.map((e) => [e.id, e.weight]));
export const maximPrice = (id, edition) => MAXIMS.find((m) => m.id === id).price + (edition ? EDITION_BY_ID[edition].price : 0);

// 가진 격언 · 이미 진열된 격언은 다시 나오지 않는다. edition: true면 판본을 반드시 붙인다.
function rollMaxim(rng, exclude, { rarityWeights = SHOP.rarityWeights, edition = false } = {}) {
  const rarity = weighted(rng, rarityWeights);
  let pool = MAXIMS.filter((m) => m.rarity === rarity && !exclude.includes(m.id));
  if (!pool.length) pool = MAXIMS.filter((m) => m.rarity !== 'legendary' && !exclude.includes(m.id));
  if (!pool.length) return null;
  const m = pool[int(rng, pool.length)];
  const ed = edition || next(rng) < SHOP.editionChance ? rollEdition(rng) : null;
  return { kind: 'maxim', id: m.id, edition: ed, price: maximPrice(m.id, ed) };
}

// 첫 조각을 아직 못 받은(완성도 안 된) 명국 중 source에서 나오는 것 하나. 없으면 null.
export function fragmentOffer(run, rng, source) {
  const pool = LEGENDS.filter((l) => (source == null || l.source === source) && !(run.fragments[l.id] && run.fragments[l.id].first));
  if (!pool.length) return null;
  return { kind: 'fragment', legend: pool[int(rng, pool.length)].id };
}
const rollEngravingId = (rng, exclude = []) =>
  weighted(rng, ENGRAVINGS.filter((e) => !exclude.includes(e.id)).map((e) => [e.id, SHOP.engravingWeights[e.rarity] || 1]));

// 단(난이도)이 바꾸는 상점 수치: 값 +1(단 3) · 첫 조각 확률 반(단 6)
export const priceBonus = (run) => (run.stake ? run.stake.price : 0);
export const fragmentMult = (run) => (run.stake ? run.stake.fragment : 1);

export function rollItem(run, rng, exclude) {
  if (next(rng) < SHOP.fragmentChance.display * fragmentMult(run)) {
    const f = fragmentOffer(run, rng, 'display');
    if (f && !exclude.includes(f.legend)) return { ...f, price: SHOP.fragmentPrice };
  }
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
    if (it.kind === 'fragment') exclude.push(it.legend);
    out.push({ ...it, price: it.price + priceBonus(run), sold: false });
  }
  run.shop.display = out;
}

export function rollPacks(run) {
  const rng = run.shop.rng;
  run.shop.packs = [];
  for (let i = 0; i < SHOP.packSlots; i++) {
    const kind = SHOP.packKinds[int(rng, SHOP.packKinds.length)];
    run.shop.packs.push({ kind, price: SHOP.packPrice + priceBonus(run), sold: false });
  }
}

// 꾸러미를 열면 3개 중 1개. 기보 · 각인은 서로 다른 셋.
// 기물 · 기보 · 각인 꾸러미는 fragmentChance.pack으로 셋째 자리에 그 꾸러미에서 나오는 명국의 첫 조각이 들어선다.
// 금빛 꾸러미: 판본 붙은 격언 셋(+ 가끔 첫 조각).
export function rollPackOptions(run, kind) {
  const rng = run.shop.rng;
  const out = [];
  if (kind === 'golden') {
    const exclude = run.maxims.map((m) => m.id);
    for (let i = 0; i < SHOP.packSize; i++) {
      const it = rollMaxim(rng, exclude, { rarityWeights: SHOP.goldenRarity, edition: true });
      if (!it) break;
      exclude.push(it.id);
      out.push({ kind: 'maxim', id: it.id, edition: it.edition });
    }
    if (run.shop.goldenFragment) {
      const f = fragmentOffer(run, rng, null);
      if (f) out.push(f);
    }
    return out;
  }
  for (let i = 0; i < SHOP.packSize; i++) {
    if (kind === 'piece') out.push({ kind: 'piece', t: weighted(rng, SHOP.pieceWeights) });
    else if (kind === 'chart') {
      const pool = CHART_FORMS.filter((f) => !out.some((o) => o.form === f));
      out.push({ kind: 'chart', form: pool[int(rng, pool.length)] });
    } else out.push({ kind: 'engraving', id: rollEngravingId(rng, out.map((o) => o.id)) });
  }
  if (next(rng) < SHOP.fragmentChance.pack * fragmentMult(run)) {
    const f = fragmentOffer(run, rng, kind);
    if (f) out[out.length - 1] = f;
  }
  return out;
}

export const rerollCost = (run) => SHOP.rerollBase + run.shop.rerolls + priceBonus(run);
export const chartName = (f) => CHARTS[f].name;
