// 판(런): 8관 × (연습 · 정식 · 명인), 보상, 상점, 꾸러미, 끝없는 대국.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 applyRun(run, cmd) 하나뿐, 둘 수 있는 명령은 legalRunCommands(run).
// 대국은 run.battle에 들어 있고 대국 명령(drop · capture · discard)은 그대로 넘긴다.
//
// 국면(run.phase)과 명령
//   select  다음 대국 앞.   play | skip(연습 · 정식만) | use | moveMaxim
//   battle  대국 중.        drop | capture | discard
//   shop    대국을 이긴 뒤. buy | buyPack | reroll | sell | use | promote | remove | moveMaxim | leave
//   pack    꾸러미를 연 뒤. pick | skipPack
//   won     8관 명인을 이김. endless
//   lost    끝.
import { createRng, fork, int, shuffle } from './rng.js';
import { createBattle, apply as applyBattle, legalCommands as battleCommands, BASE_REWARD } from './battle.js';
import { getModifier } from './scoring.js';
import { SHOP, PROMOTE, rollDisplay, rollPacks, rollPackOptions, rerollCost } from './shop.js';
import { MAXIM_BY_ID } from '../data/maxims.js';
import { CHART_TABLE, CHART_FORMS } from '../data/charts.js';
import { ENGRAVING_BY_ID } from '../data/engravings.js';
import { MASTERS, FINAL_MASTER } from '../data/masters.js';
import { OPENINGS, DEFAULT_OPENING } from '../data/openings.js';

// ── 수치
// 관별 목표 기준. 대국 목표 = B[관] × 종류 배율. (tools/run.mjs로 맞춘다)
export const B = [150, 400, 1000, 2400, 5500, 12000, 26000, 55000];
export const KIND_MULT = { practice: 1, official: 1.5, master: 2 };
export const KINDS = ['practice', 'official', 'master'];
export const ANTES = 8;
export const ENDLESS_GROWTH = 2.2; // 9관부터 관마다 목표 ×
export const REWARD = {
  base: BASE_REWARD,   // 연습 3 · 정식 4 · 명인 5
  perMove: 1,          // 남은 수 하나당
  interestStep: 5,     // 가진 상금 5당 1
  interestMax: 5,
  mate: 3,             // 외통으로 이기면
};
export const RUN_DEFAULTS = { money: 4, maximSlots: 5, consumableSlots: 2 };
// 건너뛰기 패(대국마다 정해진 하나). step 2b에서 늘린다.
export const TAGS = [
  { kind: 'money', amount: 5 },
  { kind: 'chart' },          // 정해진 모습의 기보 한 장을 곧바로 쓴다
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const root = (run) => createRng(run.seed);

export function targetFor(ante, kind) {
  const base = ante <= ANTES ? B[ante - 1] : B[ANTES - 1] * ENDLESS_GROWTH ** (ante - ANTES);
  const raw = base * KIND_MULT[kind];
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
  return {
    ante, blind, kind,
    target: targetFor(ante, kind),
    master: kind === 'master' ? masterFor(run, ante) : null,
    tag: kind === 'master' ? null : tagFor(run, ante, blind),
  };
}

export function createRun({ seed = 1, opening = DEFAULT_OPENING } = {}) {
  const op = OPENINGS[opening];
  if (!op) throw new Error(`unknown opening ${opening}`);
  const conf = { ...RUN_DEFAULTS, ...op.run };
  const r = fork(createRng(seed), 'masters');
  const pool = shuffle(r, MASTERS.map((m) => m.id).filter((id) => id !== FINAL_MASTER));
  const run = {
    v: 1,
    seed, opening,
    rules: clone(op.rules),
    ante: 1, blind: 0,
    phase: 'select',
    endless: false,
    money: conf.money,
    deck: op.bag.map((t, i) => ({ id: i + 1, t, eng: null, edition: null })),
    nextPieceId: op.bag.length + 1,
    maxims: [],               // [{ uid, id, data, edition, paid }] 왼쪽부터
    maximSlots: conf.maximSlots,
    consumables: [],          // [{ kind: 'chart', form } | { kind: 'engraving', id }]
    consumableSlots: conf.consumableSlots,
    charts: Object.fromEntries(CHART_FORMS.map((f) => [f, 0])),
    masters: [...pool.slice(0, ANTES - 1), FINAL_MASTER],
    nextUid: 1,
    battle: null,
    shop: null,
    pack: null,
    last: null,               // 마지막 대국 결과와 보상 내역(화면용)
    log: [],                  // 대국마다 한 줄(하네스 · 결과 화면용)
  };
  return run;
}

// ── 대국 만들기
// 대국에 켜질 조정자: 명인 → 기보 → 격언(왼쪽부터). build = { charts, maxims } (판 자체거나 봇이 그려 본 변형)
export function battleMods(build, master = null) {
  const mods = [];
  if (master) mods.push({ id: master });
  mods.push({ id: 'charts', data: { table: CHART_TABLE, levels: { ...build.charts } } });
  for (const m of build.maxims) mods.push({ id: m.id, uid: m.uid, data: clone(m.data || {}) });
  return mods;
}

function startBattle(run) {
  const info = blindInfo(run);
  const seed = fork(root(run), `battle:${run.ante}:${run.blind}`).s;
  run.battle = createBattle({
    seed, ante: run.ante, kind: info.kind, target: info.target,
    bag: run.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng })),
    rules: run.rules, mods: battleMods(run, info.master),
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
  const row = {
    ante: run.ante, blind: run.blind, kind: info.kind, master: info.master, target: info.target,
    score: b.score, won, reason: b.result.reason, moves: b.movesUsed, best,
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
    earned: b.money,
  };
  reward.total = reward.base + reward.moves + reward.interest + reward.mate + reward.earned;
  run.money += reward.total;
  run.last = { ...row, reward };
  events.push({ type: 'reward', ...reward });
  runEvent(run, { type: 'battleWon', reason: b.result.reason, kind: info.kind });
  run.battle = null;
  if (run.ante === ANTES && info.kind === 'master' && !run.endless) {
    run.phase = 'won';
    events.push({ type: 'runWon' });
    return;
  }
  openShop(run);
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

function addMaxim(run, id, paid, events) {
  const m = { uid: run.nextUid++, id, data: {}, edition: null, paid };
  run.maxims.push(m);
  events.push({ type: 'maxim', id, uid: m.uid });
}

const pay = (run, n) => {
  if (run.money < n) throw new Error('not enough money');
  run.money -= n;
};

// 진열 물건 하나를 지금 살 수 있나(돈 · 칸)
export function canBuy(run, it) {
  if (!it || it.sold || run.money < it.price) return false;
  if (it.kind === 'maxim') return run.maxims.length < run.maximSlots;
  if (it.kind === 'chart' || it.kind === 'engraving') return run.consumables.length < run.consumableSlots;
  return true;
}

export const sellPrice = (m) => Math.max(1, Math.floor((m.paid || 0) / 2));

// ── 명령
export function applyRun(run, cmd) {
  const events = [];
  const ph = run.phase;
  const need = (...ok) => { if (!ok.includes(ph)) throw new Error(`${cmd.type} not allowed in ${ph}`); };
  switch (cmd.type) {
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
    case 'drop': case 'capture': case 'discard': {
      need('battle');
      events.push(...applyBattle(run.battle, cmd));
      if (run.battle.status === 'won' || run.battle.status === 'lost') endBattle(run, events);
      break;
    }
    case 'buy': {
      need('shop');
      const it = run.shop.display[cmd.slot];
      if (!canBuy(run, it)) throw new Error('cannot buy');
      pay(run, it.price);
      it.sold = true;
      if (it.kind === 'maxim') addMaxim(run, it.id, it.price, events);
      else if (it.kind === 'piece') addPiece(run, it.t, events);
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
      else engrave(run, cmd.target, o.id, events);
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
      need('shop', 'select');
      const m = run.maxims[cmd.index];
      if (!m) throw new Error('no maxim');
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
  if (ph === 'lost') return [];
  if (ph === 'pack') {
    run.pack.options.forEach((o, index) => {
      if (o.kind === 'engraving') for (const p of run.deck) out.push({ type: 'pick', index, target: p.id });
      else out.push({ type: 'pick', index });
    });
    out.push({ type: 'skipPack' });
    return out;
  }
  // select · shop 공통
  run.consumables.forEach((c, index) => {
    if (c.kind === 'engraving') for (const p of run.deck) out.push({ type: 'use', index, target: p.id });
    else out.push({ type: 'use', index });
  });
  run.maxims.forEach((_, index) => out.push({ type: 'sell', index }));
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

export const maximInfo = (id) => MAXIM_BY_ID[id];
export const engravingInfo = (id) => ENGRAVING_BY_ID[id];
