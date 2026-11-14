// 뼈대 판(src/data/core.js, createRun({ core: true })): 덜어 낸 층이 어디에도 안 나오는지 · JSON 왕복 · 뼈대가 아닌 판은 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE } from '../src/data/core.js';
import { UNLOCK_TIERS } from '../src/data/unlocks.js';
import { isFairy } from '../src/data/pieces.js';
import { createRun, applyRun, legalRunCommands, blindInfo, battleMods, GEN_RULES } from '../src/sim/run.js';
import { nearFamilies } from '../src/sim/shop.js';
import { createRng, int } from '../src/sim/rng.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const MAXIMS = new Set(CORE.unlocked.maxims);
// 뼈대 판에 나오면 안 되는 판 · 대국 사건
const GONE = new Set(['fragment', 'legend', 'goldenPack', 'edition', 'engrave', 'ensoul', 'awaken', 'crack', 'gamble', 'evolve', 'joseki', 'skip',
  'challenge', 'nemesis', 'nemesisNew', 'nemesisGone', 'traitor', 'exile', 'shatter', 'tactic']);

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
  // 벽은 세력 버릇(돌기둥 · 성벽 한 줄)에서만
  const habit = (rules && rules.walls ? rules.walls[1] : 0) + (rules && rules.wallRow ? 7 : 0);
  assert.ok(walls <= habit, `${where}: 버릇 밖의 벽 ${walls}`);
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
  // 지어 둔 판의 규칙(벽 · 성벽 버릇)은 판 짓기 열쇠 gen에 실려 있다
  const genRules = (lay) => { const v = JSON.parse(lay.gen); return Object.fromEntries(GEN_RULES.map((k, i) => [k, v[i]])); };
  for (const lay of run.boards || []) if (lay) cells(lay.board, genRules(lay), `${where} 판 보기`);
  const b = run.battle;
  if (b) {
    cells(b.board, b.rules, `${where} 대국`);
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
    if (e.type === 'brilliant') stats.brilliant++;
  }
}

const newStats = () => ({ battles: new Set(), shop: new Set(), chests: 0, brilliant: 0 });
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
});

test('세력 버릇은 그대로: 수도원 돌기둥 · 성채 성벽은 서고, 무작위 보석 · 벽 · 특성은 없다', () => {
  let abbey = 0, fort = 0;
  for (const seed of [2, 5, 8, 13]) {
    const run = createRun({ seed, core: true });
    for (let ante = 2; ante <= 7; ante++) {
      run.ante = ante; run.blind = 0; run.boards = null; run.phase = 'select';
      const f = blindInfo(run).faction;
      applyRun(run, { type: 'play' });
      const xs = run.battle.board.filter((c) => c && c.t === 'X').length;
      if (f === 'abbey') { abbey++; assert.ok(xs >= 3 && xs <= 5, `돌기둥 ${xs}`); }
      else if (f === 'fortress') { fort++; assert.ok(xs >= 5, `성벽 ${xs}`); }
      else assert.equal(xs, 0, `${f}: 벽`);
      assert.ok(run.battle.board.every((c) => !c || (!c.trait && c.t !== 'J')));
      run.battle = null;
    }
  }
  assert.ok(abbey > 0 && fort > 0);
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
