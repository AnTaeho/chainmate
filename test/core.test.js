// 뼈대 판(src/data/core.js, createRun({ core: true })): 덜어 낸 층이 어디에도 안 나오는지 · JSON 왕복 · 뼈대가 아닌 판은 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE } from '../src/data/core.js';
import { UNLOCK_TIERS } from '../src/data/unlocks.js';
import { isFairy } from '../src/data/pieces.js';
import { createRun, applyRun, legalRunCommands, blindInfo, battleMods, GEN_RULES } from '../src/sim/run.js';
import { nearFamilies } from '../src/sim/shop.js';
import { createRng, int } from '../src/sim/rng.js';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { createBattle, apply, canReboard, DEFAULT_RULES } from '../src/sim/battle.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { mateBlocked } from '../src/sim/tuning.js';
import { FACTIONS, FACTION_BY_ID, habitText } from '../src/data/factions.js';
import { table } from './helpers/chain.js';
import { MASTER_BY_ID, MASTERS, masterText, CORE_MASTER_TEXT } from '../src/data/masters.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const MAXIMS = new Set(CORE.unlocked.maxims);
// 뼈대 판에 나오면 안 되는 판 · 대국 사건
const GONE = new Set(['fragment', 'legend', 'goldenPack', 'edition', 'engrave', 'ensoul', 'awaken', 'crack', 'gamble', 'evolve', 'joseki', 'skip',
  'challenge', 'nemesis', 'nemesisNew', 'nemesisGone', 'traitor', 'exile', 'shatter', 'tactic', 'brilliant', 'reboard', 'hold']);

function chess(t, where) { assert.ok(!isFairy(t), `${where}: 특수 기물 ${t}`); }
function cells(board, rules, where) {
  let walls = 0;
  for (const c of board || []) {
    if (!c) continue;
    assert.ok(!c.trait, `${where}: 적 특성 ${c.trait}`);
    assert.ok(!c.gold, `${where}: 금빛 적`);
    assert.ok(!c.nem && !c.snared, `${where}: 숙적 · 함정`);
    assert.notEqual(c.t, 'J', `${where}: 보석`);
    if (c.t === 'X') walls++;
    else chess(c.t, where);
  }
  // 코어 판에는 벽이 없다(돌기둥 · 성벽 버릇도 걷었다)
  assert.equal(walls, 0, `${where}: 벽 ${walls}`);
  assert.ok(!rules || (!rules.walls && !rules.wallRow && !rules.pawnSides), `${where}: 체스에 없는 세력 버릇`);
}
function bagPiece(p, where) { chess(p.t, where); assert.ok(!p.soul && !p.eng, `${where}: 혼 · 각인`); }
function item(it, where) {
  if (it.kind === 'maxim') { assert.ok(MAXIMS.has(it.id), `${where}: 뼈대 밖 격언 ${it.id}`); assert.ok(!it.edition, `${where}: 판본`); }
  if (it.kind === 'piece') { chess(it.t, where); assert.ok(!it.soul, `${where}: 혼 깃든 기물`); }
}

function look(run, events, stats) {
  const where = `seed ${run.seed} ${run.ante}-${run.blind} ${run.phase}`;
  assert.notEqual(run.phase, 'draft', where);
  assert.equal(run.consumables.length, 0, `${where}: 두루마리`);
  assert.deepEqual(run.josekis, []);
  assert.deepEqual(run.fragments, {});
  assert.deepEqual(run.legends, []);
  assert.deepEqual(run.pity, { golden: 0, edition: 0, fragment: 0 }, `${where}: 연줄`);
  assert.equal(run.nemesis, null);
  for (const m of run.maxims) { assert.ok(MAXIMS.has(m.id) && !m.legendary && !m.edition, `${where}: 격언 ${m.id}`); }
  for (const p of run.deck) bagPiece(p, `${where} 주머니`);
  if (run.phase === 'select') {
    const info = blindInfo(run);
    assert.equal(info.tag, null, `${where}: 건너뛰기 패`);
    assert.equal(info.challenge, null, `${where}: 대국 도전`);
    assert.ok(!legalRunCommands(run).some((c) => c.type === 'skip'), `${where}: 건너뛰기`);
    assert.throws(() => applyRun(clone(run), { type: 'skip' }));
  }
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'hold'), `${where}: 찜`);
  assert.equal(run.hold, null, `${where}: 찜`);
  if (run.phase === 'shop' && run.shop.display.length) assert.throws(() => applyRun(clone(run), { type: 'hold', slot: 0 }), /no hold/);
  // 지어 둔 판의 규칙(벽 · 성벽 버릇)은 판 짓기 열쇠 gen에 실려 있다
  const genRules = (lay) => { const v = JSON.parse(lay.gen); return Object.fromEntries(GEN_RULES.map((k, i) => [k, v[i]])); };
  for (const lay of run.boards || []) if (lay) cells(lay.board, genRules(lay), `${where} 판 보기`);
  const b = run.battle;
  if (b) {
    cells(b.board, b.rules, `${where} 대국`);
    // 외통 조건 · 탁월수 · 다시 놓기 없음, 안개는 사냥꾼 두령(마스터 규칙)만
    assert.equal(b.rules.mateLimit, false, where);
    assert.equal(b.rules.brilliant, false, where);
    assert.equal(b.rules.reboards, 0, where);
    assert.ok(!canReboard(b), `${where}: 다시 놓기`);
    assert.equal(b.offering, null, `${where}: 기다리는 희생`);
    assert.ok(!b.brilliants || !b.brilliants.length, `${where}: 탁월수`);
    assert.ok(!b.rules.fog, `${where}: 안개`);
    // 마스터 조정자는 이름 · 초상만 남고 꺼져 있다(비틀기 없음)
    for (const m of b.mods) if (MASTER_BY_ID[m.id]) assert.equal(m.off, true, `${where}: 마스터 규칙 ${m.id}`);
    assert.ok(!mateBlocked(b.chain, b.rules), `${where}: 킹 못 잡음`);
    assert.ok(!b.challenge && !b.nem, `${where}: 도전 · 숙적`);
    assert.ok(!b.mods.some((m) => String(m.id).startsWith('family:') || String(m.id).startsWith('edition:')), `${where}: 시너지 · 판본 조정자`);
    for (const x of [...(b.incoming || []), ...(b.incomingNext || [])]) chess(x.t, `${where} 증원`);
    for (const p of [...b.hand, ...b.bag, ...b.used]) bagPiece(p, `${where} 손`);
    stats.battles.add(`${run.ante}-${run.blind}`);
  }
  if (run.shop) {
    for (const it of run.shop.display) { assert.ok(CORE.keep.shop.includes(it.kind), `${where}: 진열 ${it.kind}`); item(it, `${where} 진열`); stats.shop.add(it.kind); }
    for (const pk of run.shop.packs) assert.ok(CORE.keep.packs.includes(pk.kind), `${where}: 꾸러미 ${pk.kind}`);
  }
  if (run.pack) {
    assert.ok(CORE.keep.packs.includes(run.pack.kind) && !run.pack.bonus, `${where}: 꾸러미 ${run.pack.kind}`);
    for (const o of run.pack.options) { assert.ok(o.kind === 'piece' || o.kind === 'chart', `${where}: 꾸러미 칸 ${o.kind}`); item(o, `${where} 꾸러미`); }
  }
  for (const e of events) {
    assert.ok(!GONE.has(e.type), `${where}: 사건 ${e.type}`);
    if (e.type === 'chest') { stats.chests++; for (const it of e.items) assert.ok(CORE.keep.chest.includes(it.kind), `${where}: 상자 칸 ${it.kind}`); }
    if (e.type === 'piece') chess(e.piece, `${where} 얻은 기물`);
    if (e.type === 'reinforce') chess(e.piece, `${where} 증원`);
    if (e.type === 'discard') { stats.discards++; assert.ok(!('offering' in e), `${where}: 희생 사건의 탁월수 표`); }
  }
}

const newStats = () => ({ battles: new Set(), shop: new Set(), chests: 0, discards: 0 });
// 무작위 정책(합법 명령만). 대국은 남은 수가 둘이면 목표를 0으로 내려 판이 끝 관까지 가게 한다(상자 · 4관부터의 특성 자리를 지나게)
function drive(run, stats = newStats(), { until = 99 } = {}) {
  const r = createRng((run.seed * 2654435761) >>> 0);
  const trace = [];
  const act = (c) => { const ev = applyRun(run, c); trace.push(JSON.stringify(c)); look(run, ev, stats); return ev; };
  look(run, [], stats);
  let guard = 0, inShop = 0;
  while (run.phase !== 'lost' && run.phase !== 'won' && run.ante < until && guard++ < 6000) {
    const ph = run.phase;
    if (ph === 'battle' && run.battle.movesLeft <= 2) run.battle.target = 0;
    if (ph === 'shop' && !inShop) run.money += 12; // 여러 가지를 사 보게
    if (ph === 'select') inShop = 0;
    let legal = legalRunCommands(run).filter((c) => c.type !== 'moveMaxim');
    if (ph === 'shop') { legal = legal.filter((c) => c.type !== 'leave'); if (inShop++ >= 8 || !legal.length) legal = [{ type: 'leave' }]; }
    if (ph === 'select') legal = legal.filter((c) => c.type !== 'sell');
    assert.ok(legal.length, `seed ${run.seed}: 둘 수가 있다(${ph})`);
    act(legal[int(r, legal.length)]);
  }
  return { trace, stats };
}

test('뼈대 명세: 단계 0 격언 · 체스 기물만 · 혼 · 각인 · 레퍼토리 없음', () => {
  for (const id of CORE.unlocked.maxims) assert.ok(UNLOCK_TIERS[0].maxims.includes(id), id);
  assert.deepEqual(CORE.unlocked.pieces, []);
  assert.deepEqual([CORE.unlocked.souls, CORE.unlocked.engravings, CORE.unlocked.josekis], [[], [], []]);
  const run = createRun({ seed: 1, core: true });
  assert.equal(run.phase, 'select', '레퍼토리 고르기 없이 관 선택부터');
  assert.equal(run.consumableSlots, 0);
  assert.deepEqual(run.rules.pieces, []);
  assert.equal(run.rules.traits, false);
  assert.equal(run.rules.randomThings, false);
  assert.deepEqual(run.unlocked, CORE.unlocked);
});

test('뼈대 판을 무작위로 끝까지: 덜어 낸 것이 진열 · 꾸러미 · 상자 · 판 · 증원 · 주머니 · 사건 어디에도 안 나온다', () => {
  const stats = newStats();
  let far = 0;
  for (const seed of [3, 11, 29, 47, 71, 97, 131, 173]) {
    const run = createRun({ seed, core: true });
    drive(run, stats);
    far = Math.max(far, run.phase === 'won' ? 9 : run.ante);
  }
  assert.ok(far >= 8, '끝 관까지 간 판이 있다');
  assert.ok(stats.chests >= 4, '마스터의 상자를 열었다');
  assert.deepEqual([...stats.shop].sort(), ['chart', 'maxim', 'piece'], '진열 세 종류를 다 봤다');
  assert.ok(stats.discards > 10, '희생을 여러 번 했다');
});

test('세력 버릇: 체스에 없는 버릇(옆 칸 폰 · 돌기둥 · 성벽 · 숲 · 특성)은 걷고 적 구성만, 기병대 · 전령단 · 왕궁 근위는 남는다', () => {
  const seen = new Set();
  for (const seed of [2, 5, 8, 13]) {
    const run = createRun({ seed, core: true });
    for (let ante = 1; ante <= 8; ante++) {
      run.ante = ante; run.blind = 0; run.boards = null; run.phase = 'select';
      const f = blindInfo(run).faction, r = (applyRun(run, { type: 'play' }), run.battle.rules);
      seen.add(f);
      assert.equal(run.battle.board.filter((c) => c && c.t === 'X').length, 0, `${f}: 벽`);
      assert.ok(!r.pawnSides && !r.walls && !r.wallRow && !r.fog, `${f}: 걷은 버릇`);
      assert.deepEqual(r.mix, FACTION_BY_ID[f].mix, `${f}: 적 구성은 남는다`);
      if (f === 'cavalry') { assert.deepEqual(r.reinforceMix, { N: 4, L: 2 }); for (const x of run.battle.incoming) assert.equal(x.t, 'N', '증원은 나이트만(낙타는 코어 판에 없다)'); }
      if (f === 'heralds') { assert.equal(r.reinforceBonus, 1); assert.equal(r.lookahead, 2); }
      if (f === 'royal') assert.equal(r.guardsBonus, 1);
      run.battle = null;
    }
  }
  assert.ok(['abbey', 'fortress', 'hunters', 'cavalry', 'heralds'].every((f) => seen.has(f)), [...seen].join(' '));
  // 옛 판은 버릇 그대로
  const plain = createRun({ seed: 2, draft: false });
  for (let ante = 2; ante <= 7; ante++) {
    plain.ante = ante; plain.blind = 0; plain.boards = null; plain.phase = 'select';
    const f = blindInfo(plain).faction;
    applyRun(plain, { type: 'play' });
    const r = plain.battle.rules;
    if (f === 'abbey') assert.ok(r.walls);
    if (f === 'fortress') assert.ok(r.wallRow);
    if (f === 'hunters') assert.equal(r.fog, 2);
    plain.battle = null;
  }
  assert.equal(createBattle({ seed: 1, mods: [{ id: 'faction:peasants' }] }).rules.pawnSides, true, '옛 판 농민군');
});

test('세력 버릇 글: 코어 판에서 버릇이 없는 세력은 주력 적 한 줄, 옛 판은 버릇 글', () => {
  const core = { chessHabits: true };
  const want = { peasants: '폰이 많이 나온다', abbey: '비숍이 많이 나온다', fortress: '룩이 많이 나온다', hunters: '나이트가 많이 나온다', mercs: '폰이 적게 나온다', cavalry: '증원으로 나이트만 온다' };
  for (const f of FACTIONS) {
    assert.equal(habitText(f, null), f.habit.text);
    assert.equal(habitText(f, core), want[f.id] || f.habit.text, f.id);
    assert.equal(!!f.habit.chess, ['cavalry', 'heralds', 'royal'].includes(f.id), f.id);
  }
  assert.equal(createRun({ seed: 1, core: true }).rules.chessHabits, true);
});

test('외통 조건: 코어 판은 킹을 지키던 적을 둘 잡은 콤보로도 킹을 잡는다, 옛 판은 못 잡는다', () => {
  // h8 킹을 h1 룩 · a1 비숍이 지킨다. d1 룩으로 떨궈 h1 → a1을 잡으면 비숍 모습으로 h8이 열린다(test/mate.test.js와 같은 장면)
  const scene = (rules) => {
    const t = table({ h8: 'K', h1: 'R', a1: 'B' });
    t.rules = rules;
    startChain(t, { type: 'R', sq: S('d1') });
    chainCapture(t, S('h1'));
    chainCapture(t, S('a1'));
    return t;
  };
  const old = scene({});
  assert.deepEqual(chainCaptures(old), []);
  const core = scene({ mateLimit: false });
  assert.ok(!mateBlocked(core.chain, core.rules));
  assert.deepEqual(chainCaptures(core), [S('h8')]);
  assert.equal(chainCapture(core, S('h8')).at(-1).reason, 'mate');
  assert.equal(DEFAULT_RULES.mateLimit, true);
});

test('희생: 코어 판은 바치고 다시 뽑기만 — 새로 뽑은 기물의 메이트도 탁월수가 아니다', () => {
  const P = (t, id) => ({ t, id, eng: null });
  const gamble = (rules) => {
    const b = createBattle({ seed: 3, rules });
    b.board = boardFrom({ e5: 'K' });
    b.hand = [P('Q', 4), P('R', 2), P('P', 3), P('P', 10)];
    b.bag = [P('N', 5), P('P', 6), P('P', 7), P('P', 8)];
    b.incoming = []; b.incomingNext = [];
    const ev = apply(b, { type: 'discard', handIndices: [0] });
    apply(b, { type: 'drop', handIndex: b.hand.findIndex((p) => p.id === 5), sq: S('d3') });
    return { b, ev: [...ev, ...apply(b, { type: 'capture', sq: S('e5') })] };
  };
  const core = gamble({ brilliant: false });
  assert.equal(core.b.offering, null);
  assert.ok(!core.ev.some((e) => e.type === 'brilliant'));
  assert.deepEqual(core.b.offered.map((p) => p.id), [4], '바친 퀸은 돌아오지 않는다');
  assert.equal(core.b.result.reason, 'mate');
  const old = gamble({});
  assert.ok(old.ev.some((e) => e.type === 'brilliant'));
  assert.ok(old.b.score > core.b.score, '옛 판은 탁월수 배수가 곱해진다');
});

test('다시 놓기 · 찜: 코어 판에는 없다, 옛 판은 그대로', () => {
  const core = createRun({ seed: 4, core: true });
  applyRun(core, { type: 'play' });
  assert.equal(core.battle.rules.reboards, 0);
  assert.ok(!canReboard(core.battle));
  assert.throws(() => apply(clone(core.battle), { type: 'reboard' }));
  assert.equal(core.core.off.hold, true);
  const plain = createRun({ seed: 4, draft: false });
  applyRun(plain, { type: 'play' });
  assert.ok(canReboard(plain.battle));
});

test('마스터전: 코어 판은 규칙 비틀기 없이 같은 규칙에 더 높은 목표, 옛 판은 비틀기 그대로', () => {
  const plainRules = createBattle({ seed: 1 }).rules;
  const KEYS = ['kings', 'fog', 'noHeavyDrop', 'noReply', 'moves', 'discards'];
  const seen = new Set();
  for (const seed of [5, 6, 7]) {
    const core = createRun({ seed, core: true }), old = createRun({ seed, draft: false });
    for (let ante = 1; ante <= 8; ante++) {
      for (const run of [core, old]) { run.ante = ante; run.blind = 2; run.boards = null; run.phase = 'select'; applyRun(run, { type: 'play' }); }
      const id = blindInfo(core).master;
      seen.add(id);
      const spec = core.battle.mods.find((m) => m.id === id);
      assert.ok(spec && spec.off === true, `${id}: 이름 · 초상은 남고 조정자는 꺼짐`);
      for (const k of KEYS) assert.equal(core.battle.rules[k] ?? plainRules[k], plainRules[k], `${id}: ${k}`);
      // 판 짓기가 읽는 값(GEN_RULES)도 기본값: 옛 판에서 비틀기가 바꾸는 값이 코어 판에선 그대로
      assert.ok(!core.battle.board.some((c) => c && c.t === 'X'), `${id}: 벽`);
      assert.equal(core.battle.board.filter((c) => c && c.t === 'K' && !c.mine).length, 1, `${id}: 킹 하나`);
      assert.ok(!old.battle.mods.find((m) => m.id === id).off, `옛 판 ${id}`);
      core.battle = null; old.battle = null;
    }
  }
  assert.equal(seen.size >= 6, true, [...seen].join(' '));
  // 옛 판의 비틀기는 그대로(대가 킹 둘 · 모래시계 수 2 · 안개 세 줄)
  const tw = (id) => createBattle({ seed: 1, mods: [{ id }] }).rules;
  assert.equal(tw('grandmaster').kings, 2); assert.equal(tw('hourglass').moves, 2); assert.equal(tw('fog').fog, 3);
  const offd = (id) => createBattle({ seed: 1, mods: [{ id, off: true }] }).rules;
  assert.equal(offd('grandmaster').kings, 1); assert.equal(offd('hourglass').moves, 4); assert.equal(offd('fog').fog, 0);
  // 화면 글: 비틀기 글 자리에 한 줄
  for (const m of MASTERS) { assert.equal(masterText(m, true), CORE_MASTER_TEXT); assert.equal(masterText(m, false), m.text); }
});

test('시너지: 칩이 문턱을 넘어도 뼈대 판에선 조정자 · 끌어당김이 켜지지 않는다', () => {
  const leap = ['chivalry', 'close_call', 'first_move', 'light_step']; // 모두 기사 시너지 칩
  const give = (run) => { for (const id of leap) run.maxims.push({ uid: run.nextUid++, id, data: {}, edition: null, paid: 0 }); return run; };
  const plain = give(createRun({ seed: 9 }));
  assert.ok(battleMods(plain).some((m) => m.id === 'family:leap'), '뼈대가 아닌 판은 켜진다');
  const core = give(createRun({ seed: 9, core: true }));
  assert.ok(!battleMods(core).some((m) => String(m.id).startsWith('family:')));
  core.maxims.pop();
  assert.equal(nearFamilies(core), null);
});

test('뼈대 판은 JSON 왕복 뒤에도 같은 판을 잇는다', () => {
  const run = createRun({ seed: 23, core: true });
  drive(run, newStats(), { until: 3 });
  const copy = clone(run);
  assert.deepEqual(copy, run);
  const a = drive(run, newStats(), { until: 6 });
  const b = drive(copy, newStats(), { until: 6 });
  assert.ok(a.trace.length > 20);
  assert.deepEqual(b.trace, a.trace);
  assert.deepEqual(clone(copy), clone(run));
});

test('core 없이 만든 판에는 뼈대 열쇠가 없고, core: false와 한 수도 다르지 않다', () => {
  const plain = createRun({ seed: 17, draft: false });
  assert.ok(!('core' in plain));
  assert.ok(!('randomThings' in plain.rules) && !('traits' in plain.rules) && !('pieces' in plain.rules));
  assert.equal(plain.consumableSlots, 2);
  const off = createRun({ seed: 17, draft: false, core: false });
  assert.deepEqual(off, plain);
  // 뼈대가 아닌 판에는 건너뛰기 · 도전이 그대로 있다
  assert.ok(blindInfo(plain).tag && legalRunCommands(plain).some((c) => c.type === 'skip'));
});
