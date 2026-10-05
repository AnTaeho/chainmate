// 빌드 단면(CHM-65): 판 하네스 `node tools/run.mjs … --build`가 쓴다(꺼져 있으면 아무것도 하지 않는다).
// 관이 끝날 때마다(마스터전 뒤 상점을 떠나 다음 관으로 넘어가는 순간) 그 판의 짜임 · 상금 흐름을 한 줄로 남기고,
// 그 짜임으로 다음 관 연습 대국판 몇 개에서 첫 손 최선 사슬 점수를 재 「힘 비율」(점수 ÷ 다음 관 연습 목표)을 낸다.
// 기록기는 판(run)을 읽기만 한다 — 힘 재기는 판을 JSON으로 복사한 것 위에서 대국을 새로 지어 풀이기로 재므로
// 판의 상태 · 난수를 건드리지 않는다(켜도 끄도 판 결과는 같다, 하네스 dump로 확인).
// 순수 함수(maximForm · ledger · buildState · firstBelow …)는 test/build.test.js.
import { createRng, fork } from '../src/sim/rng.js';
import { battleOpts } from '../src/sim/run.js';
import { createBattle } from '../src/sim/battle.js';
import { bestMove, NODE_BUDGET } from '../src/sim/solver.js';
import { getModifier } from '../src/sim/scoring.js';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { familyCounts } from '../src/data/families.js';
import { PIECES } from '../src/data/pieces.js';

// ── 격언의 효과 꼴: 'x' ×배수 · 'm' +배수 · 'v' 값(+값 · 값 ×) · 'o' 그 밖(상금 · 규칙 바꾸기)
// 카드 글이 먼저다(「배수 ×」 → x, 「배수 +」 → m, 「값 +」 · 「값 ×」 → v). 글에 없으면 조정자 훅의 소스에 쓰인 셈
// (mulMult → x, addMult → m, addValue → v). 둘 다 없으면 o.
export function maximForm(id) {
  const m = MAXIM_BY_ID[id];
  const text = (m && m.text) || '';
  if (/배수 ×/.test(text)) return 'x';
  if (/배수 \+/.test(text)) return 'm';
  if (/값 [+×]/.test(text)) return 'v';
  const def = getModifier(id);
  const src = def ? Object.values(def).filter((v) => typeof v === 'function').map(String).join('\n') : '';
  if (/mulMult/.test(src)) return 'x';
  if (/addMult/.test(src)) return 'm';
  if (/addValue/.test(src)) return 'v';
  return 'o';
}
// 판본의 꼴(editions.js): 무지개 배수 ×1.5 · 은박 배수 +5 · 자개 값 +50 · 흑요 칸 +1
export const EDITION_FORM = { rainbow: 'x', foil: 'm', pearl: 'v', obsidian: 'o' };

// ── 상금 흐름. 진열 물건 kind → 쓴 곳 이름(혼 깃든 기물은 기물로 센다)
export const SPEND_OF = { maxim: 'maxim', chart: 'chart', engraving: 'engraving', piece: 'piece', soul: 'soul', tactic: 'tactic', evolve: 'evolve', awaken: 'awaken', fragment: 'fragment', gamble: 'gamble' };
export const SPEND_KEYS = ['maxim', 'chart', 'engraving', 'piece', 'pack', 'reroll', 'promote', 'remove', 'soul', 'tactic', 'evolve', 'awaken', 'fragment', 'gamble'];
export const SPEND_NAME = { maxim: '격언', chart: '기보', engraving: '각인', piece: '기물', pack: '꾸러미', reroll: '다시 진열', promote: '승급', remove: '버리기', soul: '혼', tactic: '전술', evolve: '진화', awaken: '깨우기', fragment: '조각', gamble: '도박' };
export const EARN_KEYS = ['reward', 'interest', 'chest', 'tag', 'sell'];
export const EARN_NAME = { reward: '대국 보상', interest: '이자', chest: '상자', tag: '건너뛰기 패', sell: '팔기' };

// 명령 하나의 상금 흐름(순수). cmd · 그 명령의 사건 · 상금 변화(뒤 − 앞) → { earn, spend, other }.
// 버는 것은 사건에서: reward(이자는 따로, 나머지 — 기본 · 남은 수 · 메이트 · 넘침 · 대국에서 번 상금 — 는 대국 보상) ·
// money(src chest) · skip(money) · sell. 쓰는 것: buy는 사건의 물건 값, buyPack · reroll · promote · remove는 상금 변화.
// other = 상금 변화 − (번 것 − 쓴 것): 놓친 흐름이 없으면 늘 0이다(하네스가 0이 아닌 명령 수를 센다).
export function ledger(cmd, events, delta) {
  const earn = {}, spend = {};
  const add = (o, k, v) => { if (v) o[k] = (o[k] || 0) + v; };
  for (const e of events) {
    if (e.type === 'reward') { add(earn, 'interest', e.interest || 0); add(earn, 'reward', (e.total || 0) - (e.interest || 0)); }
    else if (e.type === 'money' && e.src === 'chest') add(earn, 'chest', e.money || 0);
    else if (e.type === 'skip' && e.money) add(earn, 'tag', e.money);
    else if (e.type === 'sell') add(earn, 'sell', e.money || 0);
    else if (e.type === 'buy' && cmd.type === 'buy' && e.item) add(spend, SPEND_OF[e.item.kind] || e.item.kind, e.item.price || 0);
  }
  const SPEND_CMD = { buyPack: 'pack', reroll: 'reroll', promote: 'promote', remove: 'remove' };
  if (SPEND_CMD[cmd.type]) add(spend, SPEND_CMD[cmd.type], -delta);
  const sum = (o) => Object.values(o).reduce((a, x) => a + x, 0);
  return { earn, spend, other: delta - (sum(earn) - sum(spend)) };
}

// ── 짜임 단면(순수, 판 상태를 읽기만)
export function buildState(run) {
  const maxims = run.maxims.filter((m) => !m.legendary);
  const rarity = {}, form = { x: 0, m: 0, v: 0, o: 0 }, editions = {}, edForm = { x: 0, m: 0, v: 0, o: 0 };
  for (const m of maxims) {
    const r = (MAXIM_BY_ID[m.id] || {}).rarity || '?';
    rarity[r] = (rarity[r] || 0) + 1;
    form[maximForm(m.id)]++;
    if (m.edition) { editions[m.edition] = (editions[m.edition] || 0) + 1; edForm[EDITION_FORM[m.edition] || 'o']++; }
  }
  const charts = Object.entries(run.charts || {});
  const top = charts.reduce((a, [f, l]) => (l > a[1] ? [f, l] : a), [null, 0]);
  const fam = familyCounts(run);
  return {
    money: run.money,
    maxims: maxims.length, legends: run.maxims.length - maxims.length, rarity, form, editions, edForm,
    charts: charts.reduce((a, [, l]) => a + l, 0), chartTop: top[0] ? [top[0], top[1]] : null,
    engraved: run.deck.filter((p) => p.eng).length,
    souls: run.deck.filter((p) => p.soul).length, awake: run.deck.filter((p) => p.awake).length,
    fam: Math.max(0, ...Object.values(fam)),
    deck: run.deck.length, fairies: run.deck.filter((p) => PIECES[p.t] && PIECES[p.t].fairy).length,
    josekis: (run.josekis || []).length,
  };
}

// ── 힘 재기: 판을 복사해 다음 관 연습 대국을 연다고 치고, 고정 시드 대국판 n개에서 첫 손 최선 사슬 점수(풀이기, 점수만 — 메이트 우선 없음).
// 시드는 판 시드와 상관없이 (관, i)로 정한다 — 판마다 대국판이 같지는 않다(세력 · 판 거르기가 주머니를 읽는다). 금빛 적은 끈다.
export const POWER = { n: 4, nodes: NODE_BUDGET };
export const powerSeed = (ante, i) => fork(createRng(0xb11d), `build:${ante}:${i}`).s;
export function measurePower(run, ante, { n = POWER.n, nodes = POWER.nodes } = {}) {
  const copy = JSON.parse(JSON.stringify(run));
  Object.assign(copy, { ante, blind: 0, phase: 'select', retry: 0, script: null, battle: null, draft: null });
  const { opts } = battleOpts(copy, 0);
  const scores = [];
  for (let i = 0; i < n; i++) {
    const b = createBattle({ ...opts, seed: powerSeed(ante, i), golden: false, layout: undefined });
    const best = b.hand.length ? bestMove(b, { preferMate: false, maxNodes: nodes }) : null;
    scores.push(best ? best.score : 0);
  }
  const mean = scores.reduce((a, x) => a + x, 0) / Math.max(1, scores.length);
  return { ante, target: opts.target, scores, mean: Math.round(mean), ratio: Math.round((mean / opts.target) * 1000) / 1000 };
}

// 단면 줄에서 힘 비율이 처음 1 밑인 관(관 k의 단면 = 다음 관 k+1을 맞는 짜임). 없으면 null. 순수.
export function firstBelow(snaps, edge = 1) {
  const s = snaps.find((x) => x.power && x.power.ratio < edge);
  return s ? s.ante : null;
}
// 관 k의 단면에서 관 k+1 연습 목표까지의 오름: 곡선(목표) · 힘(점수). 두 단면의 power가 있어야. 순수.
export function growth(prev, cur) {
  if (!prev || !cur || !prev.power || !cur.power) return null;
  return { target: cur.power.target / prev.power.target, score: prev.power.mean ? cur.power.mean / prev.power.mean : null };
}

// ── 기록기. 판 하나에 하나(buildLog(run) — 판을 만든 바로 뒤). record(run, cmd, events, moneyBefore, anteBefore)를 명령마다(shopbot act가) 부른다.
// rows(판 요약의 build 열쇠):
//   snaps: 관마다 { ante, full(마스터전 뒤 다음 관으로 넘어감) | false(판이 그 관에서 끝남), end: 'won' | 'lost' | null,
//           earn · spend(그 관에서), ...buildState, power(full이고 8관 전이면) }
//   shops: 상점마다 { ante, blind, in(들어설 때 상금), out(떠날 때), items: [{ k, id, p, r, f, e, g(다시 진열 몇 번째), a(보였을 때 살 돈이 있었나), b(삼) }], packs: [{ k, p, b }] }
//   other: 상금 흐름을 다 못 나눈 명령 수(0이어야 한다)
export function buildLog(run, { power = true } = {}) {
  const out = { snaps: [], shops: [], other: 0 };
  let acc = { earn: {}, spend: {} }, shop = null, shopObj = null, gen = 0, done = false;
  const items = new Map();
  const addTo = (o, src) => { for (const [k, v] of Object.entries(src)) o[k] = (o[k] || 0) + v; };
  const look = () => {
    for (const it of run.shop.display) {
      if (!it || items.has(it)) continue;
      const m = it.kind === 'maxim' ? MAXIM_BY_ID[it.id] : null;
      const rec = { k: it.kind, id: it.id ?? it.form ?? it.t ?? it.legend ?? null, p: it.price, ...(m ? { r: m.rarity, f: maximForm(it.id) } : {}), ...(it.edition ? { e: it.edition } : {}), ...(it.soul ? { s: it.soul } : {}), ...(it.kept ? { kept: 1 } : {}), g: gen, a: run.money >= it.price ? 1 : 0, b: 0 };
      items.set(it, rec);
      shop.items.push(rec);
    }
  };
  const snap = (ante, full, end) => {
    const row = { ante, full, end, earn: acc.earn, spend: acc.spend, ...buildState(run) };
    if (power && full && ante < 8) row.power = measurePower(run, ante + 1);
    out.snaps.push(row);
    acc = { earn: {}, spend: {} };
  };
  return {
    rows: out,
    record(run2, cmd, events, moneyBefore, anteBefore) {
      if (done) return;
      const L = ledger(cmd, events, run.money - moneyBefore);
      addTo(acc.earn, L.earn); addTo(acc.spend, L.spend);
      if (L.other) out.other++;
      // 상점: 새 상점이 열렸나 · 다시 진열 · 산 것 · 꾸러미 · 떠남
      if (run.shop && run.phase === 'shop' && run.shop !== shopObj) {
        shopObj = run.shop; gen = 0;
        shop = { ante: run.ante, blind: run.blind, in: run.money, out: null, items: [], packs: run.shop.packs.map((p) => ({ k: p.kind, p: p.price, b: 0 })) };
        out.shops.push(shop);
        look();
      } else if (shop && cmd.type === 'reroll') { gen++; look(); }
      if (shop && cmd.type === 'buy') { const rec = items.get(shopObj.display[cmd.slot]); if (rec) rec.b = 1; }
      if (shop && cmd.type === 'buyPack' && shop.packs[cmd.slot]) shop.packs[cmd.slot].b = 1;
      if (shop && cmd.type === 'leave') { shop.out = moneyBefore; shop = null; }
      // 관 끝: 다음 관으로 넘어감 · 판이 끝남
      if (run.ante > anteBefore) snap(anteBefore, true, null);
      else if (run.phase === 'won') { snap(run.ante, true, 'won'); done = true; }
      else if (run.phase === 'lost') { snap(run.ante, false, 'lost'); done = true; }
    },
  };
}
