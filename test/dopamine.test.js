// 2b 도파민 규칙: 사슬 평가 · 황금 기물 · 넘친 목표 · 격언 판본 · 명인의 상자 · 불멸의 기보(조각 · 재현 · 전설 다섯).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { startChain, chainCapture, chainCaptures, chainRedrops, chainRedrop, gradeOf, GRADES } from '../src/sim/chain.js';
import { createBattle, apply, GOLDEN, overflowTier, OVERFLOW_TIERS } from '../src/sim/battle.js';
import { bestMove, lineCommands } from '../src/sim/solver.js';
import { createRng } from '../src/sim/rng.js';
import {
  createRun, applyRun, legalRunCommands, battleMods, REWARD, CHEST, maximCapacity, hasMaximRoom, sellPrice, canBuy,
} from '../src/sim/run.js';
import { SHOP, rollDisplay, rollPackOptions, maximPrice } from '../src/sim/shop.js';
import { EDITIONS, EDITION_BY_ID } from '../src/data/editions.js';
import { LEGENDS, LEGEND_BY_ID, OPERA_REFILLS } from '../src/data/legends.js';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { enemyCount } from '../src/sim/setup.js';
import { stepBattle } from '../tools/bot.mjs';

const table = (map, mods = [], extra = {}) => ({ board: boardFrom(map), rules: {}, mods: JSON.parse(JSON.stringify(mods)), chain: null, seed: 1, ante: 1, movesUsed: 0, nextId: 500, ...extra });
const types = (ev) => ev.map((e) => e.type);
function play(map, drop, line, mods = [], extra = {}) {
  const t = table(map, mods, extra);
  const all = [...startChain(t, { type: drop[0], sq: S(drop[1]) })];
  for (const x of line) all.push(...(typeof x === 'string' ? chainCapture(t, S(x)) : chainRedrop(t, S(x.redrop))));
  return { t, ev: all, end: all.at(-1) };
}

// ── 사슬 평가
test('사슬 평가: 3 「!」 · 5 「!!」 · 8 「!!!」 · 12 「∞」, 닿는 순간 한 번씩', () => {
  assert.deepEqual(GRADES.map((g) => [g.n, g.mark]), [[3, '!'], [5, '!!'], [8, '!!!'], [12, '∞']]);
  assert.equal(gradeOf(2), null);
  assert.equal(gradeOf(3).mark, '!');
  assert.equal(gradeOf(7).mark, '!!');
  assert.equal(gradeOf(11).mark, '!!!');
  assert.equal(gradeOf(20).mark, '∞');
  // 룩 모습으로 한 줄을 쓸어 가는 12 사슬: a1 룩 떨굼 → a2…a8, b8…f8 (값은 폰 10씩)
  const map = {};
  for (let r = 2; r <= 8; r++) map['a' + r] = 'R';
  for (const f of 'bcdef') map[f + '8'] = 'R';
  const line = ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b8', 'c8', 'd8', 'e8', 'f8'];
  const { ev, end } = play(map, ['R', 'a1'], line);
  assert.deepEqual(ev.filter((e) => e.type === 'grade').map((e) => [e.n, e.mark]), [[3, '!'], [5, '!!'], [8, '!!!'], [12, '∞']]);
  assert.equal(end.captures, 12);
});

// ── 황금 기물
test('황금 기물: 먹으면 값을 한 번 더 받고 「golden」 이벤트, 대국은 먹은 수를 센다', () => {
  const t = table({ e5: 'B' });
  t.board[S('e5')].gold = true;
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  assert.ok(types(ev).includes('golden'));
  assert.equal(ev.at(-1).value, 60);
  assert.equal(ev.at(-1).score, 60);
  assert.equal(t.chain.golden, 1);
});

test('황금 기물: 대국 시작 판의 킹 아닌 적 하나, 확률은 대국당 약 4%', () => {
  const b = createBattle({ seed: 11, golden: true });
  const golds = b.board.map((c, sq) => (c && c.gold ? sq : -1)).filter((x) => x >= 0);
  assert.equal(golds.length, 1);
  assert.notEqual(b.board[golds[0]].t, 'K');
  assert.equal(createBattle({ seed: 11, golden: false }).board.filter((c) => c && c.gold).length, 0);
  // 금빛 여부는 따로 뽑아 판 자체는 같다
  assert.deepEqual(createBattle({ seed: 11, golden: false }).board.map((c) => c && c.t), b.board.map((c) => c && c.t));
  let n = 0;
  const N = 3000;
  for (let s = 1; s <= N; s++) if (createBattle({ seed: s * 7 + 1 }).board.some((c) => c && c.gold)) n++;
  assert.equal(GOLDEN.chance, 0.04);
  assert.ok(n / N > 0.03 && n / N < 0.05, `golden rate ${n / N}`);
});

// ── 넘친 목표
test('넘친 목표: 층 ×1 · ×2 · ×5 · ×10, 한 수로 여러 층을 넘으면 층마다 이벤트', () => {
  assert.deepEqual(OVERFLOW_TIERS, [1, 2, 5, 10]);
  assert.equal(overflowTier(99, 100), 0);
  assert.equal(overflowTier(100, 100), 1);
  assert.equal(overflowTier(499, 100), 2);
  assert.equal(overflowTier(500, 100), 5);
  assert.equal(overflowTier(1000, 100), 10);
  const b = createBattle({ seed: 5, target: 1, golden: false });
  const m = bestMove(b, { preferMate: 'avoid' });
  let ev = apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
  for (const c of lineCommands(m.line)) ev = ev.concat(apply(b, c));
  assert.ok(m.score >= 10);
  assert.deepEqual(ev.filter((e) => e.type === 'overflow').map((e) => e.tier), [1, 2, 5, 10]);
  assert.equal(b.overflow, 10);
  assert.equal(b.status, 'won');
});

test('넘친 목표 상금: ×5 +1 · ×10 +2, 보상 내역에 overflow', () => {
  assert.deepEqual(REWARD.overflow, { 5: 1, 10: 2 });
  let checked = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const run = createRun({ seed });
    applyRun(run, { type: 'play' });
    while (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
    if (run.phase !== 'shop') continue;
    const r = run.last.reward;
    const tier = overflowTier(run.last.score, run.last.target);
    assert.equal(run.last.overflow, tier);
    assert.equal(r.overflow, REWARD.overflow[tier] || 0);
    assert.equal(r.total, r.base + r.moves + r.interest + r.mate + r.overflow + r.earned);
    checked++;
  }
  assert.ok(checked >= 5);
});

// ── 격언 판본
test('판본: 은박 연쇄 +5 · 자개 값 +50 · 무지개 연쇄 ×1.5, 그 격언 바로 뒤에서 듣는다', () => {
  const scene = (edition) => {
    const mods = battleMods({ charts: {}, maxims: [{ uid: 1, id: 'chivalry', data: {}, edition }] });
    return play({ e5: 'B' }, ['N', 'd3'], ['e5'], mods).end;
  };
  // 나이트 d3 → e5 비숍: 30 × 1, 기사도 ×1.5
  assert.equal(scene(null).score, 45);
  assert.equal(scene('foil').score, Math.floor(30 * (1.5 + 5)));
  assert.equal(scene('pearl').score, Math.floor(80 * 1.5));
  assert.equal(scene('rainbow').score, Math.floor(30 * 1.5 * 1.5));
  assert.equal(scene('obsidian').score, 45, '흑요는 점수에 손대지 않는다');
  const mods = battleMods({ charts: {}, maxims: [{ uid: 7, id: 'edge', data: {}, edition: 'foil' }, { uid: 8, id: 'center', data: {}, edition: null }] });
  assert.deepEqual(mods.map((m) => m.id), ['charts', 'edge', 'edition:foil', 'center']);
  assert.equal(mods[2].of, 7);
});

test('판본: 명인 침묵이 잠재운 격언의 판본도 같이 잠든다', () => {
  const mods = [{ id: 'silence' }, ...battleMods({ charts: {}, maxims: [{ uid: 3, id: 'chivalry', data: {}, edition: 'pearl' }] })];
  const b = createBattle({ seed: 2, mods, golden: false });
  assert.ok(b.mods.find((m) => m.id === 'chivalry').off);
  assert.ok(b.mods.find((m) => m.id === 'edition:pearl').off);
});

test('판본: 값에 판본 값이 붙고(팔면 절반), 흑요는 격언 칸 +1', () => {
  assert.deepEqual(EDITIONS.map((e) => [e.id, e.name]), [['foil', '은박'], ['pearl', '자개'], ['rainbow', '무지개'], ['obsidian', '흑요']]);
  assert.equal(maximPrice('edge', null), MAXIM_BY_ID.edge.price);
  assert.equal(maximPrice('edge', 'rainbow'), MAXIM_BY_ID.edge.price + EDITION_BY_ID.rainbow.price);
  const run = createRun({ seed: 1 });
  applyRun(run, { type: 'play' });
  while (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
  assert.equal(run.phase, 'shop');
  run.money = 100;
  for (let i = 0; i < 5; i++) run.maxims.push({ uid: 90 + i, id: ['edge', 'center', 'payback', 'first_move', 'welcome'][i], data: {}, edition: null, paid: 4 });
  assert.equal(maximCapacity(run), 5);
  run.shop.display[0] = { kind: 'maxim', id: 'whim', edition: 'foil', price: maximPrice('whim', 'foil'), sold: false };
  run.shop.display[1] = { kind: 'maxim', id: 'steadfast', edition: 'obsidian', price: maximPrice('steadfast', 'obsidian'), sold: false };
  assert.ok(!canBuy(run, run.shop.display[0]), '칸이 차면 은박 격언은 못 산다');
  assert.ok(canBuy(run, run.shop.display[1]), '흑요 격언은 제 칸을 가져온다');
  applyRun(run, { type: 'buy', slot: 1 });
  assert.equal(run.money, 100 - 11);
  assert.equal(maximCapacity(run), 6);
  assert.equal(run.maxims.length, 6);
  const m = run.maxims.find((x) => x.id === 'steadfast');
  assert.equal(m.edition, 'obsidian');
  assert.equal(sellPrice(m), 5);
});

test('판본: 진열 격언에 약 4%(칸당 ~2%), 무게는 은박 > 자개 > 무지개 > 흑요', () => {
  const run = createRun({ seed: 1 });
  const counts = {}; let maxims = 0, slots = 0;
  for (let i = 0; i < 8000; i++) {
    run.shop = { rng: createRng(1000 + i), display: [], packs: [], rerolls: 0 };
    rollDisplay(run);
    for (const it of run.shop.display) {
      slots++;
      if (it.kind !== 'maxim') continue;
      maxims++;
      if (it.edition) counts[it.edition] = (counts[it.edition] || 0) + 1;
      assert.equal(it.price, maximPrice(it.id, it.edition));
    }
  }
  const total = Object.values(counts).reduce((a, x) => a + x, 0);
  assert.equal(SHOP.editionChance, 0.04);
  assert.ok(total / maxims > 0.03 && total / maxims < 0.05, `edition share ${total / maxims}`);
  assert.ok(total / slots > 0.015 && total / slots < 0.03, `per slot ${total / slots}`);
  assert.ok(counts.foil > counts.pearl && counts.pearl > counts.rainbow && counts.rainbow > counts.obsidian, JSON.stringify(counts));
});

// ── 명인의 상자
function toMasterWin(seed) {
  // 1관 명인 대국 직전까지 건너뛰고(연습 · 정식), 명인 대국을 목표 1로 이긴다
  const run = createRun({ seed });
  applyRun(run, { type: 'skip' });
  applyRun(run, { type: 'skip' });
  applyRun(run, { type: 'play' });
  run.battle.target = 1;
  let events = [];
  while (run.phase === 'battle') stepBattle(run.battle, (c) => { events = events.concat(applyRun(run, c)); }, {});
  return { run, events };
}

test('명인의 상자: 명인 대국을 이기면 1 · 3 · 5개, 칸 다섯에 가운데부터 불이 켜지고 물건이 곧바로 들어온다', () => {
  const { run, events } = toMasterWin(3);
  assert.equal(run.phase, 'shop');
  const chest = events.find((e) => e.type === 'chest');
  assert.ok(chest);
  assert.ok([1, 3, 5].includes(chest.count));
  assert.equal(chest.cells.length, CHEST.cells);
  const lit = chest.cells.map((c, i) => (c.lit ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(lit, { 1: [2], 3: [1, 2, 3], 5: [0, 1, 2, 3, 4] }[chest.count]);
  assert.deepEqual(chest.cells.filter((c) => c.lit).map((c) => c.item), chest.items);
  assert.equal(chest.tier, { 1: 'common', 3: 'uncommon', 5: 'rare' }[chest.count]);
  assert.equal(run.log.at(-1).chest, chest.count);
  // 같은 시드 = 같은 상자
  const again = toMasterWin(3).events.find((e) => e.type === 'chest');
  assert.deepEqual(again, chest);
  // 연습 대국을 이기면 상자는 없다
  const r2 = createRun({ seed: 3 });
  applyRun(r2, { type: 'play' });
  r2.battle.target = 1;
  let ev2 = [];
  while (r2.phase === 'battle') stepBattle(r2.battle, (c) => { ev2 = ev2.concat(applyRun(r2, c)); }, {});
  assert.ok(!ev2.some((e) => e.type === 'chest'));
});

test('명인의 상자: 개수 분포 1 ≈ 77% · 3 ≈ 20% · 5 ≈ 3% (판 시드 × 관마다 다른 결과)', () => {
  assert.deepEqual(CHEST.counts, [[1, 77], [3, 20], [5, 3]]);
  const n = { 1: 0, 3: 0, 5: 0 };
  const N = 400;
  for (let seed = 1; seed <= N; seed++) {
    const { events } = toMasterWin(seed * 13);
    n[events.find((e) => e.type === 'chest').count]++;
  }
  assert.ok(n[1] / N > 0.7 && n[1] / N < 0.84, JSON.stringify(n));
  assert.ok(n[3] / N > 0.14 && n[3] / N < 0.26, JSON.stringify(n));
  assert.ok(n[5] / N > 0.01 && n[5] / N < 0.06, JSON.stringify(n));
});

test('명인의 상자: 물건 셋(상금 · 기보 · 각인)이 판에 그대로 들어간다', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 150 && kinds.size < 3; seed++) {
    const run = createRun({ seed });
    run.maxims.push({ uid: 50, id: 'edge', data: {}, edition: null, paid: 4 });
    applyRun(run, { type: 'skip' });
    applyRun(run, { type: 'skip' });
    applyRun(run, { type: 'play' });
    run.battle.target = 1;
    const before = { charts: { ...run.charts }, deck: JSON.parse(JSON.stringify(run.deck)) };
    let events = [];
    while (run.phase === 'battle') stepBattle(run.battle, (c) => { events = events.concat(applyRun(run, c)); }, {});
    const chest = events.find((e) => e.type === 'chest');
    for (const it of chest.items) {
      kinds.add(it.kind);
      if (it.kind === 'chart') assert.ok(run.charts[it.form] > before.charts[it.form]);
      if (it.kind === 'engrave') assert.equal(run.deck.find((p) => p.id === it.pieceId).eng.id, it.eng);
      if (it.kind === 'edition') assert.equal(run.maxims.find((m) => m.uid === it.uid).edition, it.edition);
      if (it.kind === 'money') assert.ok(events.some((e) => e.type === 'money' && e.src === 'chest'));
    }
  }
  assert.deepEqual([...kinds].sort(), ['chart', 'engrave', 'money']);
  assert.deepEqual(CHEST.items.map((x) => x[0]), ['money', 'chart', 'engrave']);
});

// ── 불멸의 기보: 조각
test('불멸의 기보: 명국 다섯, 첫 조각이 나오는 곳이 서로 다르게 나뉜다', () => {
  assert.deepEqual(LEGENDS.map((l) => l.id), ['immortal', 'opera', 'century', 'evergreen', 'eight_pawns']);
  for (const l of LEGENDS) {
    assert.ok(l.name && l.text && l.feat && l.story, l.id);
    assert.ok(!/엔진|스폰|버프|트리거|시뮬|틱|팩/.test(l.text + l.feat), l.id);
    assert.ok(['display', 'piece', 'chart', 'engraving'].includes(l.source));
    assert.equal(l.rarity, 'legendary');
  }
  assert.ok(!Object.keys(MAXIM_BY_ID).some((id) => LEGEND_BY_ID[id]), '상점 격언 목록에는 없다');
});

test('재현 판정: 명국마다 조건', () => {
  const h = (o) => ({ caps: '', cuts: 0, mates: 0, promotions: 0, captures: 0, move: 1, ...o });
  const chk = (id, o) => LEGEND_BY_ID[id].check(h(o));
  assert.ok(chk('immortal', { caps: 'PRNR', captures: 4 }));
  assert.ok(!chk('immortal', { caps: 'PRNR', captures: 4, cuts: 1 }), '끊김(넘긴 것 포함)이 있으면 안 된다');
  assert.ok(!chk('immortal', { caps: 'PRN' }));
  assert.ok(chk('opera', { move: 0, mates: 1 }));
  assert.ok(!chk('opera', { move: 1, mates: 1 }));
  assert.ok(chk('century', { caps: 'NQQ' }));
  assert.ok(!chk('century', { caps: 'QNQ' }));
  assert.ok(chk('evergreen', { captures: 8 }));
  assert.ok(!chk('evergreen', { captures: 7 }));
  assert.ok(chk('eight_pawns', { promotions: 2 }));
  assert.ok(!chk('eight_pawns', { promotions: 1 }));
});

function shopAt(seed = 1) {
  const run = createRun({ seed });
  applyRun(run, { type: 'play' });
  while (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
  assert.equal(run.phase, 'shop');
  return run;
}

test('첫 조각: 진열에서 사거나 꾸러미에서 고른다', () => {
  const run = shopAt(1);
  run.money = 50;
  run.shop.display[0] = { kind: 'fragment', legend: 'opera', price: SHOP.fragmentPrice, sold: false };
  const ev = applyRun(run, { type: 'buy', slot: 0 });
  assert.deepEqual(run.fragments.opera, { first: true, feat: false, gold: false });
  assert.ok(ev.some((e) => e.type === 'fragment' && e.legend === 'opera' && e.part === 'first'));
  assert.equal(run.money, 50 - SHOP.fragmentPrice);
  run.shop.packs[0] = { kind: 'piece', price: 4, sold: false };
  applyRun(run, { type: 'buyPack', slot: 0 });
  run.pack.options[2] = { kind: 'fragment', legend: 'eight_pawns' };
  applyRun(run, { type: 'pick', index: 2 });
  assert.equal(run.fragments.eight_pawns.first, true);
});

test('첫 조각 확률: 진열 칸 3% · 꾸러미 4%, 나오는 곳이 맞는 명국만, 가진 첫 조각은 다시 안 나온다', () => {
  const run = createRun({ seed: 1 });
  let frag = 0, slots = 0;
  for (let i = 0; i < 6000; i++) {
    run.shop = { rng: createRng(7 + i), display: [], packs: [], rerolls: 0 };
    rollDisplay(run);
    for (const it of run.shop.display) {
      slots++;
      if (it.kind === 'fragment') { frag++; assert.equal(LEGEND_BY_ID[it.legend].source, 'display'); }
    }
  }
  assert.ok(frag / slots > 0.022 && frag / slots < 0.038, `display ${frag / slots}`);
  for (const kind of ['piece', 'chart', 'engraving']) {
    let got = 0;
    for (let i = 0; i < 4000; i++) {
      run.shop = { rng: createRng(99 + i), display: [], packs: [], rerolls: 0 };
      const o = rollPackOptions(run, kind);
      assert.equal(o.length, 3);
      const f = o.find((x) => x.kind === 'fragment');
      if (f) { got++; assert.equal(LEGEND_BY_ID[f.legend].source, kind); }
    }
    assert.ok(got / 4000 > 0.03 && got / 4000 < 0.05, `${kind} ${got / 4000}`);
  }
  run.fragments = { immortal: { first: true, feat: false, gold: false }, opera: { first: true, feat: false, gold: false } };
  for (let i = 0; i < 2000; i++) {
    run.shop = { rng: createRng(5 + i), display: [], packs: [], rerolls: 0 };
    rollDisplay(run);
    assert.ok(!run.shop.display.some((it) => it.kind === 'fragment'));
  }
});

test('재현(둘째 조각): 첫 조각을 가진 판에서만, 해낸 사슬 뒤 곧바로', () => {
  // N a6 → b8 폰(폰 모습으로 끝줄 → 승급 1, 퀸) → e8 폰(다시 폰 모습, 끝줄 → 승급 2) = 폰 여덟의 행진 재현
  const drive = (run) => {
    applyRun(run, { type: 'play' });
    run.battle.board = boardFrom({ b8: 'P', e8: 'P', h1: 'P' });
    run.battle.hand = [{ t: 'N', id: 1, eng: null }];
    let ev = applyRun(run, { type: 'drop', handIndex: 0, sq: S('a6') });
    for (const sq of ['b8', 'e8']) ev = ev.concat(applyRun(run, { type: 'capture', sq: S(sq) }));
    return ev;
  };
  const r1 = createRun({ seed: 1 });
  const ev1 = drive(r1);
  assert.equal(r1.battle.history.at(-1).promotions, 2);
  assert.ok(!ev1.some((e) => e.type === 'fragment'), '첫 조각이 없으면 재현해도 조각이 안 나온다');
  assert.equal(r1.fragments.eight_pawns, undefined);
  const r2 = createRun({ seed: 1 });
  r2.fragments.eight_pawns = { first: true, feat: false, gold: false };
  const ev2 = drive(r2);
  assert.deepEqual(ev2.find((e) => e.type === 'fragment'), { type: 'fragment', legend: 'eight_pawns', part: 'feat', have: { first: true, feat: true, gold: false } });
  const endAt = ev2.findIndex((e) => e.type === 'end');
  assert.ok(ev2.findIndex((e) => e.type === 'fragment') > endAt, '사슬이 끝난 뒤');
});

test('셋째 조각: 황금 기물을 먹고 이기면 재현까지 해낸 명국의 금빛 조각 + 금빛 꾸러미', () => {
  const run = createRun({ seed: 2 });
  run.fragments.century = { first: true, feat: false, gold: false };
  run.fragments.evergreen = { first: true, feat: true, gold: false };
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.board = boardFrom({ e5: 'B', a8: 'K', b7: 'P', h7: 'N' });
  b.board[S('e5')].gold = true;
  b.hand = [{ t: 'N', id: 1, eng: null }];
  b.target = 1;
  const ev = applyRun(run, { type: 'drop', handIndex: 0, sq: S('d3') }).concat(applyRun(run, { type: 'capture', sq: S('e5') }));
  assert.equal(run.phase, 'shop');
  const frags = ev.filter((e) => e.type === 'fragment');
  assert.equal(frags.length, 1, '금빛 조각 하나로 셋이 모여 전설');
  assert.deepEqual(frags[0], { type: 'fragment', legend: 'evergreen', part: 'gold', have: { first: true, feat: true, gold: true } });
  assert.ok(ev.some((e) => e.type === 'legend' && e.legend === 'evergreen'));
  assert.deepEqual(run.legends, ['evergreen']);
  const lg = run.maxims.find((m) => m.id === 'evergreen');
  assert.ok(lg.legendary);
  assert.equal(run.log.at(-1).golden, 1);
  // 금빛 꾸러미: 공짜, 판본 붙은 격언 셋
  const gp = run.shop.packs.findIndex((p) => p.kind === 'golden');
  assert.ok(gp >= 0);
  assert.equal(run.shop.packs[gp].price, 0);
  applyRun(run, { type: 'buyPack', slot: gp });
  assert.equal(run.pack.kind, 'golden');
  assert.ok(run.pack.options.filter((o) => o.kind === 'maxim').length === 3);
  assert.ok(run.pack.options.every((o) => o.kind !== 'maxim' || o.edition));
  applyRun(run, { type: 'pick', index: 0 });
  assert.ok(run.maxims.some((m) => m.id === run.maxims[0].id && m.edition));
  // 전설은 칸 수와 따로, 팔 수 없다
  assert.equal(maximCapacity(run), 5);
  assert.ok(hasMaximRoom(run));
  const li = run.maxims.findIndex((m) => m.legendary);
  assert.throws(() => applyRun(run, { type: 'sell', index: li }), /legend/);
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'sell' && c.index === li));
});

test('셋째 조각: 조각은 첫 → 재현 → 금빛 차례, 재현 전의 황금 기물은 조각을 주지 않는다', () => {
  const run = createRun({ seed: 2 });
  run.fragments.century = { first: true, feat: false, gold: false };
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.board = boardFrom({ e5: 'B', a8: 'K', b7: 'P', h7: 'N' });
  b.board[S('e5')].gold = true;
  b.hand = [{ t: 'N', id: 1, eng: null }];
  b.target = 1;
  const ev = applyRun(run, { type: 'drop', handIndex: 0, sq: S('d3') }).concat(applyRun(run, { type: 'capture', sq: S('e5') }));
  assert.equal(run.phase, 'shop');
  assert.ok(!ev.some((e) => e.type === 'fragment'));
  assert.deepEqual(run.fragments.century, { first: true, feat: false, gold: false });
  assert.equal(run.shop.goldenFragment, false, '첫 조각을 가졌으면 꾸러미에 첫 조각도 끼지 않는다');
  assert.ok(run.shop.packs.some((p) => p.kind === 'golden'));
});

test('셋째 조각: 첫 조각이 없으면 금빛 꾸러미에 첫 조각이 끼어 나올 기회', () => {
  let withFrag = 0, N = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRun({ seed });
    applyRun(run, { type: 'play' });
    const b = run.battle;
    b.board = boardFrom({ e5: 'B', a8: 'K', b7: 'P', h7: 'N' });
    b.board[S('e5')].gold = true;
    b.hand = [{ t: 'N', id: 1, eng: null }];
    b.target = 1;
    applyRun(run, { type: 'drop', handIndex: 0, sq: S('d3') });
    applyRun(run, { type: 'capture', sq: S('e5') });
    const gp = run.shop.packs.findIndex((p) => p.kind === 'golden');
    applyRun(run, { type: 'buyPack', slot: gp });
    N++;
    const f = run.pack.options.find((o) => o.kind === 'fragment');
    if (f) { withFrag++; applyRun(run, { type: 'pick', index: run.pack.options.indexOf(f) }); assert.equal(run.fragments[f.legend].first, true); }
    assert.equal(!!f, run.shop.goldenFragment);
  }
  assert.ok(withFrag / N > 0.3 && withFrag / N < 0.7, `${withFrag}/${N}`);
});

// ── 전설 다섯: 점수
const LEG = (id) => [{ id, uid: 99, data: {} }];

test('전설 불멸의 대국: 끊김을 넘기며 연쇄 ×2, 되잡힌 칸에서 계속', () => {
  // N d3 → R e5(g6 나이트가 노림, 룩으로 못 먹음 = 끊김) → 넘겨 ×2 → 룩으로 b5 폰
  const base = play({ e5: 'R', g6: 'N', b5: 'P' }, ['N', 'd3'], ['e5']).end;
  assert.deepEqual([base.reason, base.score], ['cut', 50]);
  const { ev, end } = play({ e5: 'R', g6: 'N', b5: 'P' }, ['N', 'd3'], ['e5', 'b5'], LEG('immortal'));
  assert.ok(types(ev).includes('cutIgnored'));
  // 값 50 + 10 = 60, 연쇄 (1 × 2) + 1 = 3 → 180
  assert.deepEqual([end.value, end.mult, end.score], [60, 3, 180]);
});

test('전설 오페라 대국: 외통 뒤 판이 다시 채워지고 킹이 된 기물이 사슬을 잇는다', () => {
  const MATE = { d5: 'B', g8: 'Q', g7: 'P', f8: 'P', a8: 'R', a4: 'K', f3: 'P' };
  const line = ['d5', 'g8', 'g7', 'f8', 'a8', 'a4'];
  const t = table(MATE, LEG('opera'), { seed: 42, ante: 2 });
  startChain(t, { type: 'N', sq: S('c3') });
  let ev = [];
  for (const sq of line) ev = chainCapture(t, S(sq));
  const at = (x) => types(ev).indexOf(x);
  assert.ok(at('mate') >= 0 && at('mate') < at('refill') && at('refill') < at('transform'), types(ev).join(' '));
  assert.ok(!types(ev).includes('end'));
  assert.ok(!t.chain.done, '사슬이 끝나지 않는다');
  assert.equal(t.chain.form, 'K', '킹을 먹었으니 킹 모습');
  assert.equal(t.chain.mates, 1);
  assert.equal(t.board.filter((c) => c && !c.mine).length, enemyCount(2));
  assert.equal(t.board[S('a4')].mine, true);
  assert.deepEqual([t.chain.value, t.chain.mult], [340, 6], '외통까지의 값 · 연쇄는 그대로');
  const caps = chainCaptures(t);
  assert.ok(caps.length > 0, '곁에 먹을 적이 있는 판');
  const v = t.board[caps[0]].t;
  chainCapture(t, caps[0]);
  assert.equal(t.chain.value, 340 + { P: 10, N: 30, B: 30, R: 50, Q: 90 }[v]);
  assert.equal(t.chain.mult, 7);
  // 같은 시드 · 같은 수 = 같은 새 판(풀이기가 그려 본 판과 실제 판이 같다)
  const t2 = table(MATE, LEG('opera'), { seed: 42, ante: 2 });
  startChain(t2, { type: 'N', sq: S('c3') });
  for (const sq of line) chainCapture(t2, S(sq));
  chainCapture(t2, caps[0]);
  assert.deepEqual(t2.board, t.board);
  assert.equal(OPERA_REFILLS, 3);
});

test('전설 오페라 대국: 지켜진 킹도 먹는다(떨굴 칸도 그만큼 늘어난다)', () => {
  // 킹 e6을 d7 폰이 지킨다. 나이트 d4에서 e6은 보통 못 먹는다
  const MAP = { e6: 'K', d7: 'P', h8: 'R' };
  const plain = table(MAP);
  startChain(plain, { type: 'N', sq: S('d4') });
  assert.equal(plain.chain.done, true, '먹을 적이 없어 곧바로 막힘');
  const b = createBattle({ seed: 4, mods: LEG('opera'), golden: false });
  assert.equal(b.rules.openKings, true);
  const t = table(MAP, LEG('opera'), { rules: { openKings: true }, seed: 8, ante: 1 });
  startChain(t, { type: 'N', sq: S('d4') });
  assert.deepEqual(chainCaptures(t), [S('e6')]);
  const ev = chainCapture(t, S('e6'));
  assert.ok(types(ev).includes('mate') && types(ev).includes('refill'));
  assert.equal(t.chain.done, false);
});

test('전설 세기의 대국: 퀸 모습으로 먹은 수만큼 사슬 끝 ×1.5를 거듭 곱한다', () => {
  // 퀸 h1 → h5 룩(퀸 모습 1번): 50 × 1.5 = 75
  assert.equal(play({ h5: 'R' }, ['Q', 'h1'], ['h5'], LEG('century')).end.score, 75);
  // 퀸 d1 → d5 퀸(d8 퀸이 노림: 응수) → d8 퀸: 퀸 모습 2번. 값 180, 연쇄 2 × 2.25 = 4.5 → 810
  const { end } = play({ d5: 'Q', d8: 'Q' }, ['Q', 'd1'], ['d5', 'd8'], LEG('century'));
  assert.deepEqual([end.value, end.mult, end.score], [180, 4.5, 810]);
  // 나이트 모습으로 퀸을 먹은 것은 세지 않는다
  assert.equal(play({ f5: 'Q' }, ['N', 'd4'], ['f5'], LEG('century')).end.score, 90);
});

test('전설 상록의 대국: 사슬이 멈추면 한 번, 그 모습 그대로 다시 떨궈 값 · 연쇄를 잇는다', () => {
  const MAP = { e5: 'B', a8: 'P' };
  assert.equal(play(MAP, ['N', 'd3'], ['e5']).end.score, 30);
  const t = table(MAP, LEG('evergreen'));
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  const ready = ev.find((e) => e.type === 'redropReady');
  assert.ok(ready);
  assert.equal(ready.form, 'B');
  assert.equal(t.chain.done, false);
  assert.equal(t.board[S('e5')], null, '기물을 들었다');
  assert.deepEqual(chainRedrops(t).sort((a, b) => a - b), ['h1', 'g2', 'f3', 'e4', 'd5', 'c6'].map(S).sort((a, b) => a - b), 'b7은 a8 폰이 노린다');
  assert.deepEqual(chainCaptures(t), []);
  chainRedrop(t, S('d5'));
  const end = chainCapture(t, S('a8')).at(-1);
  // 값 30 + 10 = 40, 연쇄 2 → 80. 두 번째는 없다
  assert.deepEqual([end.reason, end.value, end.mult, end.score], ['blocked', 40, 2, 80]);
  assert.equal(t.chain.redrops, 1);
});

test('전설 상록의 대국: 대국에서 redrop 명령, 풀이기가 다시 떨구기 줄을 찾는다', () => {
  const b = createBattle({ seed: 3, mods: LEG('evergreen'), golden: false });
  b.board = boardFrom({ e5: 'B', a8: 'P', h4: 'P' });
  b.hand = [{ t: 'N', id: 1, eng: null }];
  const m = bestMove(b);
  assert.ok(m.line.some((x) => typeof x === 'object' && x.type === 'redrop'));
  apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
  for (const c of lineCommands(m.line)) {
    if (c.type === 'redrop') assert.ok(legalCommandsOf(b).some((x) => x.type === 'redrop' && x.sq === c.sq));
    apply(b, c);
  }
  assert.equal(b.history.at(-1).score, m.score);
  assert.equal(b.history.at(-1).redrops, 1);
});

test('전설 폰 여덟의 행진: 폰으로 떨군 사슬은 여섯째 줄부터 승급, 승급마다 연쇄 ×3', () => {
  // P b4 → c5 나이트(나이트 모습) → d7 폰(여섯째 줄 = rank 6 ≥ 5 → 승급, ×3)
  const MAP = { c5: 'N', d7: 'P' };
  assert.equal(play(MAP, ['P', 'b4'], ['c5', 'd7']).end.score, 80, '전설 없이는 승급 없음');
  const { ev, end } = play(MAP, ['P', 'b4'], ['c5', 'd7'], LEG('eight_pawns'));
  assert.ok(types(ev).includes('promote'));
  // 값 40, 연쇄 2 × 3 = 6 → 240
  assert.deepEqual([end.value, end.mult, end.score], [40, 6, 240]);
  // 나이트로 떨구면 듣지 않는다(끝줄 전이라 승급도 없다)
  assert.equal(play({ e5: 'N', f7: 'P' }, ['N', 'd3'], ['e5', 'f7'], LEG('eight_pawns')).end.score, 80);
  // 승급 두 번: P b4 → c5 N → d7 P(승급 ×3, 퀸) → e8 P(폰 → 끝줄 승급 ×3): 값 50, ((1+1)×3 + 1)×3 = 21 → 1050
  const two = play({ c5: 'N', d7: 'P', e8: 'P' }, ['P', 'b4'], ['c5', 'd7', 'e8'], LEG('eight_pawns')).end;
  assert.deepEqual([two.value, two.mult, two.score], [50, 21, 1050]);
});

test('풀이기 마디 예산: 넘으면 첫 수만 따라가도 늘 끝까지 둘 수 있는 줄, 점수는 그 줄을 둔 결과와 같다', () => {
  for (const seed of [3, 9, 21]) {
    const full = createBattle({ seed, ante: 6, golden: false, mods: LEG('opera') });
    const cut = JSON.parse(JSON.stringify(full));
    const a = bestMove(full), m = bestMove(cut, { maxNodes: 5 });
    assert.ok(m.nodes < a.nodes || a.nodes <= 5);
    assert.ok(m.score <= a.score);
    apply(cut, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
    for (const c of lineCommands(m.line)) apply(cut, c);
    assert.equal(cut.chain, null, '줄이 사슬을 끝낸다');
    assert.equal(cut.history.at(-1).score, m.score);
  }
});

// ── 저장 · 결정성
function legalCommandsOf(b) {
  return b.status === 'chain' && b.chain.awaiting ? chainRedrops(b).map((sq) => ({ type: 'redrop', sq })) : [];
}

test('저장: 조각 · 전설 · 판본 · 금빛 꾸러미가 든 판이 JSON 왕복 뒤 같은 결과를 낸다', () => {
  const run = createRun({ seed: 9 });
  run.fragments.opera = { first: true, feat: true, gold: false };
  run.maxims.push({ uid: 40, id: 'edge', data: {}, edition: 'rainbow', paid: 9 });
  run.legends.push('century');
  run.maxims.push({ uid: 41, id: 'century', data: {}, edition: null, paid: 0, legendary: true });
  const copy = JSON.parse(JSON.stringify(run));
  assert.deepEqual(copy, run);
  const drive = (r) => {
    const out = [];
    for (let i = 0; i < 400 && r.phase !== 'lost' && r.ante < 3; i++) {
      if (r.phase === 'select') out.push(applyRun(r, { type: 'play' }));
      else if (r.phase === 'battle') stepBattle(r.battle, (c) => out.push(applyRun(r, c)), {});
      else if (r.phase === 'shop') {
        const g = r.shop.packs.findIndex((p) => p.kind === 'golden' && !p.sold);
        out.push(applyRun(r, g >= 0 ? { type: 'buyPack', slot: g } : { type: 'leave' }));
      } else if (r.phase === 'pack') out.push(applyRun(r, { type: 'skipPack' }));
      // 중간에 한 번 더 저장했다 불러도 같다
      if (i === 30) { const s = JSON.stringify(r); Object.assign(r, JSON.parse(s)); }
    }
    return out;
  };
  assert.deepEqual(drive(copy), drive(run));
  assert.deepEqual(copy, run);
});
