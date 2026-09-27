// 판(런): 8관 × (연습 · 정식 · 명인), 보상, 상점, 꾸러미, 끝없는 대국.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 applyRun(run, cmd) 하나뿐, 둘 수 있는 명령은 legalRunCommands(run).
// 대국은 run.battle에 들어 있고 대국 명령(drop · capture · discard)은 그대로 넘긴다.
//
// 국면(run.phase)과 명령
//   draft   1 · 3 · 5관의 첫 대국 앞(깊이 E). joseki(셋 중 하나, 건너뛸 수 없다)
//   select  다음 대국 앞.   play | skip(연습 · 정식만) | use | moveMaxim
//   battle  대국 중.        drop | capture | discard
//   shop    대국을 이긴 뒤. buy | buyPack | reroll | sell | use | promote | remove | moveMaxim | leave
//   pack    꾸러미를 연 뒤. pick | skipPack
//   won     8관 명인을 이김. endless
//   lost    끝.
import { createRng, fork, int, next, shuffle } from './rng.js';
import { createBattle, apply as applyBattle, legalCommands as battleCommands, BASE_REWARD, GOLDEN, DEFAULT_RULES } from './battle.js';
import { getModifier } from './scoring.js';
import { SHOP, PROMOTE, rollDisplay, rollPacks, rollPackOptions, rerollCost, weighted, rollEdition, maximPrice, fragmentMult } from './shop.js';
import { gradeOf } from './chain.js';
import { MAXIM_BY_ID } from '../data/maxims.js';
import { CHART_TABLE, CHART_FORMS } from '../data/charts.js';
import { ENGRAVING_BY_ID } from '../data/engravings.js';
import { MASTERS, FINAL_MASTER } from '../data/masters.js';
import { OPENINGS, DEFAULT_OPENING } from '../data/openings.js';
import { EDITION_BY_ID, editionSpec, editionSlots } from '../data/editions.js';
import { LEGENDS, LEGEND_BY_ID } from '../data/legends.js';
import { familyCounts, familyMods } from '../data/families.js';
import { JOSEKIS, JOSEKI_BY_ID, DRAFT_ANTES, DRAFT_TIERS } from '../data/josekis.js';

// ── 수치
// 관별 목표 기준. 대국 목표 = B[관] × 종류 배율. tools/run.mjs(smart 봇)로 맞춤:
//   1관은 격언 없이도 넘는다(100%), 2~4관에서 첫 격언 · 기보를 못 모은 판이 떨어져 4관 도달 80%대,
//   5~7관은 관마다 ×2.3~2.5 — 격언의 곱(×연쇄)과 기보 레벨이 붙은 짜임이라야 따라간다.
//   8관은 명인 「대가」(기보 무시)가 벽이라 8관 연습 · 정식만 보고 잡았다(보고서 참고).
export const B = [150, 600, 2000, 5200, 13000, 32000, 72000, 150000];
export const KIND_MULT = { practice: 1, official: 1.5, master: 2 };
export const KINDS = ['practice', 'official', 'master'];
export const ANTES = 8;
export const ENDLESS_GROWTH = 2.2; // 9관부터 관마다 목표 ×
export const REWARD = {
  // 연습 3 · 정식 4 · 명인 2. 명인은 2a의 5에서 명인의 상자 몫만큼 뺐다: 상자 기댓값 ≈ 1.5칸 × 상금 2~3어치 ≈ 3.6이라
  // 2 + 3.6 ≈ 2a의 5. 3으로 두면 판 봇 승률 24%(300판), 상자를 얹고 5 그대로면 34%(80판) — 보고서 2b.
  base: { ...BASE_REWARD, master: 2 },
  perMove: 1,          // 남은 수 하나당
  interestStep: 5,     // 가진 상금 5당 1
  interestMax: 5,
  mate: 3,             // 외통으로 이기면
  overflow: { 5: 1, 10: 2 }, // 목표를 ×5 · ×10 넘기면 덤. ×2부터 주면(이긴 대국의 절반) 판 봇 승률이 10%p 넘게 올라 작게 묶었다
};
// 명인의 상자(명인 대국을 이기면): 몇 개가 나오나(무게, HOOKS 1 흔함 · 3 드묾 · 5 ~3%)와 한 칸에 무엇이 드나.
export const CHEST = {
  counts: [[1, 77], [3, 20], [5, 3]],
  // 판본은 넣지 않는다: 가진 격언에 곧바로 붙어(은박 연쇄 +5) 상자 하나가 판 봇 승률을 10%p 넘게 올렸다(보고서 2b).
  items: [['money', 60], ['chart', 30], ['engrave', 10], ['fairy', 6]],
  money: 2,     // 상금 칸 하나
  cells: 5,     // 릴 칸 수. 나온 개수만큼 가운데부터 불이 켜진다(1: 가운데 · 3: 가운데 셋 · 5: 전부)
};
export const RUN_DEFAULTS = { money: 4, maximSlots: 5, consumableSlots: 2 };
// 건너뛰기 패(대국마다 정해진 하나). step 2b에서 늘린다.
export const TAGS = [
  { kind: 'money', amount: 5 },
  { kind: 'chart' },          // 정해진 모습의 기보 한 장을 곧바로 쓴다
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const root = (run) => createRng(run.seed);

// 단(난이도, 판 밖): 한 판을 이기면 다음 단이 열린다. 단 k는 1..k번 규칙을 모두 켠다(단 0 = 기본, 규칙 없음).
export const DANS = [
  { n: 1, text: '목표 ×1.25' },
  { n: 2, text: '증원 +1' },
  { n: 3, text: '상점 값 +1' },
  { n: 4, text: '무르기 −1' },
  { n: 5, text: '명인의 상자 다섯 칸이 반' },
  { n: 6, text: '명국 첫 조각이 반' },
  { n: 7, text: '수 −1' },
  { n: 8, text: '대가 목표 ×1.5' },
];
export function danRules(dan) {
  return {
    target: dan >= 1 ? 1.25 : 1, reinforce: dan >= 2 ? 1 : 0, price: dan >= 3 ? 1 : 0, discards: dan >= 4 ? -1 : 0,
    chestFive: dan >= 5 ? 0.5 : 1, fragment: dan >= 6 ? 0.5 : 1, moves: dan >= 7 ? -1 : 0, finalTarget: dan >= 8 ? 1.5 : 1,
  };
}

export function targetFor(ante, kind, mult = 1) {
  const base = ante <= ANTES ? B[ante - 1] : B[ANTES - 1] * ENDLESS_GROWTH ** (ante - ANTES);
  const raw = base * KIND_MULT[kind] * mult;
  // 보기 좋게: 유효 숫자 둘
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag;
}

function masterFor(run, ante) {
  if (ante <= ANTES) return run.masters[ante - 1];
  const r = fork(root(run), `master:${ante}`);
  return MASTERS[int(r, MASTERS.length)].id;
}

function tagFor(run, ante, blind) {
  const r = fork(root(run), `tag:${ante}:${blind}`);
  const tag = { ...TAGS[int(r, TAGS.length)] };
  if (tag.kind === 'chart') tag.form = CHART_FORMS[int(r, CHART_FORMS.length)];
  return tag;
}

// 지금(또는 다음) 대국의 정보: 종류 · 목표 · 명인 · 건너뛰기 패
export function blindInfo(run, ante = run.ante, blind = run.blind) {
  const kind = KINDS[blind];
  const master = kind === 'master' ? masterFor(run, ante) : null;
  const st = run.stake;
  const mult = (st ? st.target * (master === FINAL_MASTER ? st.finalTarget : 1) : 1) * josekiTargetMult(run);
  return {
    ante, blind, kind,
    target: targetFor(ante, kind, mult),
    master,
    tag: kind === 'master' ? null : tagFor(run, ante, blind),
  };
}

// draft: false면 정석 드래프트 없이(깊이 E 이전 규칙 — 시험 · 하네스 비교용)
export function createRun({ seed = 1, opening = DEFAULT_OPENING, dan = 0, draft = true } = {}) {
  const op = OPENINGS[opening];
  if (!op) throw new Error(`unknown opening ${opening}`);
  const conf = { ...RUN_DEFAULTS, ...op.run };
  const r = fork(createRng(seed), 'masters');
  const pool = shuffle(r, MASTERS.map((m) => m.id).filter((id) => id !== FINAL_MASTER));
  const rules = clone(op.rules);
  const stake = dan > 0 ? danRules(dan) : null;
  if (stake) {
    if (stake.discards) rules.discards = (rules.discards ?? DEFAULT_RULES.discards) + stake.discards;
    if (stake.moves) rules.moves = (rules.moves ?? DEFAULT_RULES.moves) + stake.moves;
    if (stake.reinforce) rules.reinforceBonus = stake.reinforce;
  }
  const run = {
    v: 1,
    seed, opening, dan, stake,
    rules,
    ante: 1, blind: 0,
    phase: 'select',
    endless: false,
    money: conf.money,
    deck: op.bag.map((t, i) => ({ id: i + 1, t, eng: null, edition: null })),
    nextPieceId: op.bag.length + 1,
    maxims: [],               // [{ uid, id, data, edition, paid }] 왼쪽부터
    josekis: [],              // 고른 정석 id(깊이 E)
    draft: null,              // { ante, options: [id…] } 정석을 고르는 중
    maximSlots: conf.maximSlots,
    consumables: [],          // [{ kind: 'chart', form } | { kind: 'engraving', id }]
    consumableSlots: conf.consumableSlots,
    charts: Object.fromEntries(CHART_FORMS.map((f) => [f, 0])),
    masters: [...pool.slice(0, ANTES - 1), FINAL_MASTER],
    fragments: {},            // { [명국 id]: { first, feat, gold } } — 불멸의 기보 조각
    legends: [],              // 완성한 명국 id(전설 격언은 maxims에 legendary: true로, 격언 칸 수와 따로)
    nextUid: 1,
    battle: null,
    shop: null,
    pack: null,
    last: null,               // 마지막 대국 결과와 보상 내역(화면용)
    log: [],                  // 대국마다 한 줄(하네스 · 결과 화면용)
  };
  if (!draft) run.noDraft = true;
  openDraft(run);
  return run;
}

// ── 정석 드래프트(깊이 E): 1 · 3 · 5관의 첫 대국 앞에 셋 중 하나
function openDraft(run) {
  if (run.noDraft || run.endless || run.blind !== 0 || !DRAFT_ANTES.includes(run.ante) || (run.drafted || []).includes(run.ante)) return;
  const r = fork(root(run), `draft:${run.ante}`);
  const pool = JOSEKIS.filter((j) => !run.josekis.includes(j.id));
  const options = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const tier = weighted(r, DRAFT_TIERS[run.ante]);
    let cand = pool.filter((j) => j.tier === tier);
    if (!cand.length) cand = pool;
    const j = cand[int(r, cand.length)];
    options.push(j.id);
    pool.splice(pool.indexOf(j), 1);
  }
  run.draft = { ante: run.ante, options };
  run.phase = 'draft';
}
// 정석이 바꾸는 목표 배율(「하이랜더」)
export function josekiTargetMult(run) {
  let k = 1;
  for (const id of run.josekis || []) { const j = JOSEKI_BY_ID[id]; if (j && j.targetMult) k *= j.targetMult(run); }
  return k;
}

// ── 대국 만들기
// 대국에 켜질 조정자: 명인 → 기보 → 격언(왼쪽부터). build = { charts, maxims } (판 자체거나 봇이 그려 본 변형)
export function battleMods(build, master = null) {
  const mods = [];
  if (master) mods.push({ id: master });
  mods.push({ id: 'charts', data: { table: CHART_TABLE, levels: { ...build.charts } } });
  // 가족(깊이 B): 문턱을 넘은 가족마다 하나(정석 「복제」면 가장 많이 모은 가족의 문턱이 하나 낮다)
  const counts = familyCounts(build);
  let dropFor = null;
  if ((build.josekis || []).includes('clone')) { const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; if (top && top[1] > 0) dropFor = top[0]; }
  mods.push(...familyMods(counts, dropFor));
  // 정석(깊이 E)
  for (const id of build.josekis || []) mods.push({ id: `joseki:${id}` });
  for (const m of build.maxims) {
    mods.push({ id: m.id, uid: m.uid, data: clone(m.data || {}) });
    const ed = editionSpec(m);
    if (ed) mods.push(ed);
  }
  return mods;
}

function startBattle(run) {
  const info = blindInfo(run);
  const seed = fork(root(run), `battle:${run.ante}:${run.blind}`).s;
  run.battle = createBattle({
    seed, ante: run.ante, kind: info.kind, target: info.target,
    bag: run.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng })),
    rules: run.rules, mods: battleMods(run, info.master),
    goldenChance: awaitingGold(run) ? GOLDEN.calling : GOLDEN.chance,
  });
  run.phase = 'battle';
}

function runEvent(run, ev) {
  for (const m of run.maxims) {
    const def = getModifier(m.id);
    if (def && def.onRunEvent) def.onRunEvent(m, ev);
  }
}

function interest(money) {
  return Math.min(REWARD.interestMax, Math.floor(Math.max(0, money) / REWARD.interestStep));
}

function endBattle(run, events) {
  const b = run.battle;
  const info = blindInfo(run);
  const best = b.history.reduce((a, h) => Math.max(a, h.score), 0);
  const won = b.status === 'won';
  // 깨진 기물(유리)은 주머니에서 빠진다
  if (b.shattered.length) run.deck = run.deck.filter((p) => !b.shattered.includes(p.id));
  // 정석 「결사」: 첫 사슬을 푼 기물은 판에서 사라진다(주머니 여섯은 남긴다) · 「왕좌」: 승급한 폰은 퀸으로
  for (const id of b.exiled || []) if (run.deck.length > SHOP.deckMin) { run.deck = run.deck.filter((p) => p.id !== id); events.push({ type: 'exile', pieceId: id }); }
  for (const id of b.crowned || []) { const p = run.deck.find((x) => x.id === id); if (p && p.t === 'P') { p.t = 'Q'; events.push({ type: 'evolve', pieceId: id, from: 'P', to: 'Q' }); } }
  const grades = {};
  for (const h of b.history) { const g = gradeOf(h.captures); if (g) grades[g.mark] = (grades[g.mark] || 0) + 1; }
  const row = {
    ante: run.ante, blind: run.blind, kind: info.kind, master: info.master, target: info.target,
    score: b.score, won, reason: b.result.reason, moves: b.movesUsed, best,
    goldenSeen: b.board.some((c) => c && c.gold) || b.golden > 0, golden: b.golden, overflow: b.overflow, grades,
  };
  run.log.push(row);
  if (!won) {
    run.last = { ...row, reward: null };
    run.phase = 'lost';
    events.push({ type: 'runLost', ante: run.ante, blind: run.blind });
    return;
  }
  const mate = b.result.reason === 'mate';
  const reward = {
    base: REWARD.base[info.kind],
    moves: REWARD.perMove * b.movesLeft,
    interest: interest(run.money),
    mate: mate ? REWARD.mate : 0,
    overflow: REWARD.overflow[b.overflow] || 0,
    earned: b.money,
  };
  reward.total = reward.base + reward.moves + reward.interest + reward.mate + reward.overflow + reward.earned;
  run.money += reward.total;
  run.last = { ...row, reward };
  events.push({ type: 'reward', ...reward });
  runEvent(run, { type: 'battleWon', reason: b.result.reason, kind: info.kind });
  run.battle = null;
  if (info.kind === 'master') row.chest = openChest(run, events);
  const goldenPack = b.golden > 0 ? goldenReward(run, b.golden, events) : null;
  if (run.ante === ANTES && info.kind === 'master' && !run.endless) {
    run.phase = 'won';
    events.push({ type: 'runWon' });
    return;
  }
  openShop(run);
  if (goldenPack) {
    run.shop.goldenFragment = goldenPack.fragment;
    run.shop.packs.push({ kind: 'golden', price: 0, sold: false });
    events.push({ type: 'goldenPack', fragment: goldenPack.fragment });
  }
}

// ── 불멸의 기보
export const legendInfo = (id) => LEGEND_BY_ID[id];
const fragOf = (run, id) => run.fragments[id] || (run.fragments[id] = { first: false, feat: false, gold: false });

// 조각 하나를 준다. 셋이 모이면 전설 격언이 칸 수와 따로 들어온다.
function grantFragment(run, id, part, events) {
  const f = fragOf(run, id);
  if (f[part]) return false;
  f[part] = true;
  events.push({ type: 'fragment', legend: id, part, have: { ...f } });
  if (f.first && f.feat && f.gold && !run.legends.includes(id)) {
    run.legends.push(id);
    const m = { uid: run.nextUid++, id, data: {}, edition: null, paid: 0, legendary: true };
    run.maxims.push(m);
    events.push({ type: 'legend', legend: id, uid: m.uid });
  }
  return true;
}

// 첫 조각과 재현을 모아 금빛 조각만 남은 명국이 있나(그동안 황금 기물이 자주 나온다: GOLDEN.calling)
export const awaitingGold = (run) => LEGENDS.some((l) => { const f = run.fragments[l.id]; return f && f.first && f.feat && !f.gold; });

// 재현: 끝난 사슬 요약 h로 첫 조각을 가진 명국의 둘째 조각을 판정한다.
function checkFeats(run, h, events) {
  for (const l of LEGENDS) {
    const f = run.fragments[l.id];
    if (f && f.first && !f.feat && l.check(h)) grantFragment(run, l.id, 'feat', events);
  }
}

// 황금 기물을 먹고 이긴 대국 뒤: 재현까지 해낸 명국 하나의 셋째(금빛) 조각 — 조각은 첫 → 재현 → 금빛 차례로만 모인다
// (HOOKS 「가진 조각 중 하나의 다음 조각」). 첫 조각이 하나도 없으면 금빛 꾸러미에 첫 조각이 끼어 나올 기회.
// 돌려주는 값 { fragment: 꾸러미에 첫 조각이 드나 }
function goldenReward(run, n, events) {
  const r = fork(root(run), `golden:${run.ante}:${run.blind}`);
  let fragment = false;
  for (let i = 0; i < n; i++) {
    const ready = LEGENDS.filter((l) => { const f = run.fragments[l.id]; return f && f.first && f.feat && !f.gold; });
    if (ready.length) grantFragment(run, ready[int(r, ready.length)].id, 'gold', events);
    else if (!LEGENDS.some((l) => run.fragments[l.id] && run.fragments[l.id].first) && next(r) < SHOP.goldenFragmentChance * fragmentMult(run)) fragment = true;
  }
  return { fragment };
}

// ── 명인의 상자. 결과는 판 시드와 관으로 정해진다(릴은 화면의 몫: 이벤트에 칸마다 무엇이 멈추는지 다 싣는다).
function openChest(run, events) {
  const r = fork(root(run), `chest:${run.ante}`);
  const count = weighted(r, chestCounts(run));
  const items = [];
  for (let i = 0; i < count; i++) items.push(chestItem(run, r, items));
  const lit = litCells(count);
  let k = 0;
  const cells = Array.from({ length: CHEST.cells }, (_, i) => (lit.includes(i) ? { lit: true, item: items[k++] } : { lit: false, item: null }));
  events.push({ type: 'chest', count, tier: count >= 5 ? 'rare' : count >= 3 ? 'uncommon' : 'common', cells, items: clone(items) });
  for (const it of items) applyChestItem(run, it, events);
  return count;
}
// 단 5부터 다섯 칸 무게가 반(덜어 낸 몫은 한 칸으로)
export function chestCounts(run) {
  const f = run.stake ? run.stake.chestFive : 1;
  if (f === 1) return CHEST.counts;
  const five = CHEST.counts.find(([n]) => n === 5)[1];
  return CHEST.counts.map(([n, w]) => [n, n === 5 ? w * f : n === 1 ? w + five * (1 - f) : w]);
}
const litCells = (n) => { const mid = (CHEST.cells - 1) / 2, h = (n - 1) / 2; return Array.from({ length: n }, (_, i) => mid - h + i); };

// 칸 하나를 굴려 구체적인 물건으로 정한다. 앞 칸(prev)이 고른 격언 · 기물은 다시 고르지 않는다.
function chestItem(run, r, prev) {
  const kind = weighted(r, CHEST.items);
  if (kind === 'edition') {
    const pool = run.maxims.filter((m) => !m.legendary && !m.edition && !prev.some((x) => x.uid === m.uid));
    if (pool.length) {
      const m = pool[int(r, pool.length)];
      return { kind: 'edition', uid: m.uid, id: m.id, edition: rollEdition(r) };
    }
  }
  if (kind === 'engrave') {
    const pool = run.deck.filter((p) => !p.eng && !prev.some((x) => x.pieceId === p.id));
    if (pool.length) {
      const p = pool[int(r, pool.length)];
      const ids = Object.keys(ENGRAVING_BY_ID);
      return { kind: 'engrave', pieceId: p.id, piece: p.t, eng: ids[int(r, ids.length)] };
    }
  }
  if (kind === 'fairy') return { kind: 'piece', t: weighted(r, SHOP.fairyWeights) };
  if (kind === 'money') return { kind: 'money', money: CHEST.money };
  return { kind: 'chart', form: CHART_FORMS[int(r, CHART_FORMS.length)] };
}

function applyChestItem(run, it, events) {
  if (it.kind === 'chart') useChart(run, it.form, events);
  else if (it.kind === 'money') { run.money += it.money; events.push({ type: 'money', src: 'chest', money: it.money }); }
  else if (it.kind === 'engrave') engrave(run, it.pieceId, it.eng, events);
  else if (it.kind === 'piece') addPiece(run, it.t, events);
  else if (it.kind === 'edition') {
    const m = run.maxims.find((x) => x.uid === it.uid);
    m.edition = it.edition;
    m.paid = (m.paid || 0) + EDITION_BY_ID[it.edition].price;
    events.push({ type: 'edition', uid: m.uid, id: m.id, edition: it.edition });
  }
}

// ── 상점
function openShop(run) {
  run.shop = {
    rng: fork(root(run), `shop:${run.ante}:${run.blind}`),
    display: [], packs: [], rerolls: 0, promoted: false, removed: false,
  };
  rollDisplay(run);
  rollPacks(run);
  run.phase = 'shop';
}

function advance(run) {
  run.shop = null;
  run.pack = null;
  if (run.blind < 2) run.blind++;
  else { run.blind = 0; run.ante++; }
  run.phase = 'select';
  openDraft(run);
}

function useChart(run, form, events) {
  run.charts[form]++;
  events.push({ type: 'chart', form, level: run.charts[form] });
  runEvent(run, { type: 'chartUsed', form });
}

function engrave(run, pieceId, id, events) {
  const p = run.deck.find((x) => x.id === pieceId);
  if (!p) throw new Error(`no piece ${pieceId}`);
  p.eng = { id };
  events.push({ type: 'engrave', piece: p.t, pieceId, eng: id });
}

function addPiece(run, t, events) {
  const p = { id: run.nextPieceId++, t, eng: null, edition: null };
  run.deck.push(p);
  events.push({ type: 'piece', piece: t, pieceId: p.id });
}

function addMaxim(run, id, paid, events, edition = null) {
  const m = { uid: run.nextUid++, id, data: {}, edition, paid };
  // 전설은 늘 오른쪽 끝(6번째 칸)에 남게 그 앞에 끼운다
  const at = run.maxims.findIndex((x) => x.legendary);
  run.maxims.splice(at < 0 ? run.maxims.length : at, 0, m);
  events.push({ type: 'maxim', id, uid: m.uid, edition });
}

// 격언 칸: 기본 칸 + 흑요 판본마다 하나. 전설 격언은 칸을 차지하지 않는다.
export const maximCapacity = (run) => run.maximSlots + run.maxims.reduce((a, m) => a + (m.legendary ? 0 : editionSlots(m)), 0);
export const maximCount = (run) => run.maxims.filter((m) => !m.legendary).length;
// 격언 하나(판본 포함)를 더 넣을 자리가 있나. 흑요 판본은 제 칸을 스스로 가져온다.
export const hasMaximRoom = (run, edition = null) => maximCount(run) < maximCapacity(run) + (edition && EDITION_BY_ID[edition].slots ? EDITION_BY_ID[edition].slots : 0);

const pay = (run, n) => {
  if (run.money < n) throw new Error('not enough money');
  run.money -= n;
};

// 진열 물건 하나를 지금 살 수 있나(돈 · 칸)
export function canBuy(run, it) {
  if (!it || it.sold || run.money < it.price) return false;
  if (it.kind === 'maxim') return hasMaximRoom(run, it.edition);
  if (it.kind === 'chart' || it.kind === 'engraving') return run.consumables.length < run.consumableSlots;
  return true;
}

export const sellPrice = (m) => Math.max(1, Math.floor((m.paid || 0) / 2));
export const canSell = (m) => !!m && !m.legendary;

// ── 명령
export function applyRun(run, cmd) {
  const events = [];
  const ph = run.phase;
  const need = (...ok) => { if (!ok.includes(ph)) throw new Error(`${cmd.type} not allowed in ${ph}`); };
  switch (cmd.type) {
    case 'joseki': {
      need('draft');
      const id = run.draft.options[cmd.index];
      if (!id) throw new Error('bad joseki');
      run.josekis.push(id);
      (run.drafted || (run.drafted = [])).push(run.draft.ante);
      const j = JOSEKI_BY_ID[id];
      events.push({ type: 'joseki', id });
      if (j.pick) j.pick(run, events);
      run.draft = null;
      run.phase = 'select';
      break;
    }
    case 'play': {
      need('select');
      startBattle(run);
      events.push({ type: 'battleStart', ...blindInfo(run) });
      break;
    }
    case 'skip': {
      need('select');
      const info = blindInfo(run);
      if (info.kind === 'master') throw new Error('cannot skip master');
      const tag = info.tag;
      if (tag.kind === 'money') run.money += tag.amount;
      else if (tag.kind === 'chart') useChart(run, tag.form, events);
      events.push({ type: 'skip', tag });
      run.log.push({ ante: run.ante, blind: run.blind, kind: info.kind, skipped: true, tag });
      advance(run);
      break;
    }
    case 'drop': case 'capture': case 'redrop': case 'discard': {
      need('battle');
      const seen = run.battle.history.length;
      events.push(...applyBattle(run.battle, cmd));
      for (const h of run.battle.history.slice(seen)) checkFeats(run, h, events);
      if (run.battle.status === 'won' || run.battle.status === 'lost') endBattle(run, events);
      break;
    }
    case 'buy': {
      need('shop');
      const it = run.shop.display[cmd.slot];
      if (!canBuy(run, it)) throw new Error('cannot buy');
      pay(run, it.price);
      it.sold = true;
      if (it.kind === 'maxim') addMaxim(run, it.id, it.price, events, it.edition || null);
      else if (it.kind === 'piece') addPiece(run, it.t, events);
      else if (it.kind === 'fragment') grantFragment(run, it.legend, 'first', events);
      else run.consumables.push(it.kind === 'chart' ? { kind: 'chart', form: it.form } : { kind: 'engraving', id: it.id });
      events.push({ type: 'buy', item: { ...it } });
      break;
    }
    case 'buyPack': {
      need('shop');
      const pk = run.shop.packs[cmd.slot];
      if (!pk || pk.sold) throw new Error('no pack');
      pay(run, pk.price);
      pk.sold = true;
      run.pack = { kind: pk.kind, options: rollPackOptions(run, pk.kind) };
      run.phase = 'pack';
      events.push({ type: 'packOpen', kind: pk.kind, options: clone(run.pack.options) });
      break;
    }
    case 'pick': {
      need('pack');
      const o = run.pack.options[cmd.index];
      if (!o) throw new Error('bad pick');
      if (o.kind === 'piece') addPiece(run, o.t, events);
      else if (o.kind === 'chart') useChart(run, o.form, events);
      else if (o.kind === 'fragment') grantFragment(run, o.legend, 'first', events);
      else if (o.kind === 'maxim') {
        if (!hasMaximRoom(run, o.edition)) throw new Error('no maxim slot');
        addMaxim(run, o.id, maximPrice(o.id, o.edition), events, o.edition);
      } else engrave(run, cmd.target, o.id, events);
      run.pack = null;
      run.phase = 'shop';
      break;
    }
    case 'skipPack': {
      need('pack');
      run.pack = null;
      run.phase = 'shop';
      break;
    }
    case 'reroll': {
      need('shop');
      pay(run, rerollCost(run));
      run.shop.rerolls++;
      rollDisplay(run);
      events.push({ type: 'reroll' });
      break;
    }
    case 'sell': {
      need('shop', 'select', 'pack');
      const m = run.maxims[cmd.index];
      if (!m) throw new Error('no maxim');
      if (!canSell(m)) throw new Error('cannot sell a legend');
      run.maxims.splice(cmd.index, 1);
      run.money += sellPrice(m);
      events.push({ type: 'sell', id: m.id, money: sellPrice(m) });
      break;
    }
    case 'use': {
      need('shop', 'select');
      const c = run.consumables[cmd.index];
      if (!c) throw new Error('no consumable');
      if (c.kind === 'engraving') engrave(run, cmd.target, c.id, events);
      else useChart(run, c.form, events);
      run.consumables.splice(cmd.index, 1);
      break;
    }
    case 'promote': {
      need('shop');
      if (run.shop.promoted) throw new Error('already promoted');
      const p = run.deck.find((x) => x.id === cmd.pieceId);
      if (!p || !PROMOTE[p.t]) throw new Error('cannot promote');
      const to = cmd.to ?? PROMOTE[p.t][0];
      if (!PROMOTE[p.t].includes(to)) throw new Error('bad promotion');
      pay(run, SHOP.promotePrice);
      run.shop.promoted = true;
      events.push({ type: 'promote', pieceId: p.id, from: p.t, to });
      p.t = to;
      break;
    }
    case 'remove': {
      need('shop');
      if (run.shop.removed) throw new Error('already removed');
      if (run.deck.length <= SHOP.deckMin) throw new Error('deck too small');
      const i = run.deck.findIndex((x) => x.id === cmd.pieceId);
      if (i < 0) throw new Error('no piece');
      pay(run, SHOP.removePrice);
      run.shop.removed = true;
      const [p] = run.deck.splice(i, 1);
      events.push({ type: 'remove', pieceId: p.id, piece: p.t });
      break;
    }
    case 'moveMaxim': {
      need('shop', 'select');
      const { from, to } = cmd;
      if (!run.maxims[from] || to < 0 || to >= run.maxims.length) throw new Error('bad move');
      const [m] = run.maxims.splice(from, 1);
      run.maxims.splice(to, 0, m);
      break;
    }
    case 'leave': {
      need('shop');
      advance(run);
      break;
    }
    case 'endless': {
      need('won');
      run.endless = true;
      openShop(run);
      break;
    }
    default: throw new Error(`unknown command ${cmd.type}`);
  }
  return events;
}

// 둘 수 있는 명령 전부(봇 · 화면 공용). moveMaxim은 이웃과 자리 바꾸기만 센다.
export function legalRunCommands(run) {
  const out = [];
  const ph = run.phase;
  if (ph === 'battle') return battleCommands(run.battle);
  if (ph === 'won') return [{ type: 'endless' }];
  if (ph === 'draft') return run.draft.options.map((_, index) => ({ type: 'joseki', index }));
  if (ph === 'lost') return [];
  if (ph === 'pack') {
    run.pack.options.forEach((o, index) => {
      if (o.kind === 'engraving') for (const p of run.deck) out.push({ type: 'pick', index, target: p.id });
      else if (o.kind !== 'maxim' || hasMaximRoom(run, o.edition)) out.push({ type: 'pick', index });
    });
    // 금빛 꾸러미의 격언을 칸이 찬 채로 받으려면 먼저 판다
    if (run.pack.options.some((o) => o.kind === 'maxim')) run.maxims.forEach((m, index) => { if (canSell(m)) out.push({ type: 'sell', index }); });
    out.push({ type: 'skipPack' });
    return out;
  }
  // select · shop 공통
  run.consumables.forEach((c, index) => {
    if (c.kind === 'engraving') for (const p of run.deck) out.push({ type: 'use', index, target: p.id });
    else out.push({ type: 'use', index });
  });
  run.maxims.forEach((m, index) => { if (canSell(m)) out.push({ type: 'sell', index }); });
  for (let i = 0; i + 1 < run.maxims.length; i++) out.push({ type: 'moveMaxim', from: i, to: i + 1 });
  if (ph === 'select') {
    out.push({ type: 'play' });
    if (run.blind < 2) out.push({ type: 'skip' });
    return out;
  }
  // shop
  run.shop.display.forEach((it, slot) => { if (canBuy(run, it)) out.push({ type: 'buy', slot }); });
  run.shop.packs.forEach((pk, slot) => { if (!pk.sold && run.money >= pk.price) out.push({ type: 'buyPack', slot }); });
  if (run.money >= rerollCost(run)) out.push({ type: 'reroll' });
  if (!run.shop.promoted && run.money >= SHOP.promotePrice) {
    for (const p of run.deck) for (const to of PROMOTE[p.t] || []) out.push({ type: 'promote', pieceId: p.id, to });
  }
  if (!run.shop.removed && run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin) {
    for (const p of run.deck) out.push({ type: 'remove', pieceId: p.id });
  }
  out.push({ type: 'leave' });
  return out;
}

export const maximInfo = (id) => MAXIM_BY_ID[id] || LEGEND_BY_ID[id];
export const engravingInfo = (id) => ENGRAVING_BY_ID[id];
