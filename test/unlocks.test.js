// 해금 사다리(src/data/unlocks.js)와 솔기(src/sim/unlock.js): 자료 정합성 · 잠긴 것이 어디에도 안 나오는지 · 잠금 없는 판은 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNLOCK_TIERS, UNLOCK_KINDS, MAX_TIER, unlockedAt, tierOf, UNLOCK_GATES, tierForGates, gatesOfRun, advanceUnlock, unlockProgress } from '../src/data/unlocks.js';
import { emptyRecords, loadRecords, finishRun, finishEndless } from '../src/ui/records.js';
import { makeStore } from '../src/ui/save.js';
import { openPool, openTypes } from '../src/sim/unlock.js';
import { MAXIMS } from '../src/data/maxims.js';
import { SOULS, UP } from '../src/data/souls.js';
import { ENGRAVINGS } from '../src/data/engravings.js';
import { JOSEKIS } from '../src/data/josekis.js';
import { FAIRIES, PIECES, isFairy } from '../src/data/pieces.js';
import { EVOLVE, evolveTo } from '../src/data/tactics.js';
import { FAMILIES, maximFamilies } from '../src/data/families.js';
import { OPENINGS } from '../src/data/openings.js';
import { createRun, applyRun, legalRunCommands } from '../src/sim/run.js';
import { enemyWeights } from '../src/sim/setup.js';
import { createRng, int } from '../src/sim/rng.js';
import { stepBattle } from '../tools/bot.mjs';

const ALL = { maxims: MAXIMS.map((m) => m.id), pieces: FAIRIES, souls: SOULS.map((s) => s.id), engravings: ENGRAVINGS.map((e) => e.id), josekis: JOSEKIS.map((j) => j.id) };
const clone = (x) => JSON.parse(JSON.stringify(x));

test('사다리: 모든 id가 정확히 한 단계에 한 번 들어간다', () => {
  for (const k of UNLOCK_KINDS) {
    const flat = UNLOCK_TIERS.flatMap((t) => t[k]);
    assert.equal(new Set(flat).size, flat.length, `${k}: 겹친 id`);
    assert.deepEqual([...flat].sort(), [...ALL[k]].sort(), `${k}: 빠지거나 없는 id`);
    assert.deepEqual([...unlockedAt(MAX_TIER)[k]].sort(), [...ALL[k]].sort());
    for (const id of ALL[k]) assert.ok(tierOf(k, id) >= 0);
  }
  assert.equal(tierOf('maxims', 'no_such'), -1);
  assert.deepEqual(unlockedAt(-3), unlockedAt(0));
  assert.deepEqual(unlockedAt(999), unlockedAt(MAX_TIER));
});

test('사다리: 단계 0에는 특수 기물이 없고, 뽑는 자리가 비지 않을 만큼은 있다', () => {
  const t0 = UNLOCK_TIERS[0];
  assert.deepEqual(t0.pieces, []);
  assert.ok(t0.souls.length >= 1, '혼 두루마리 · 물약');
  assert.ok(t0.engravings.length >= 3, '각인 팩은 서로 다른 셋');
  assert.ok(t0.josekis.length >= 5, '레퍼토리 고르기 세 번(셋 · 셋 · 셋)');
  assert.ok(!t0.josekis.some((id) => JOSEKIS.find((j) => j.id === id).tier === 'rainbow'));
});

test('사다리: 단계마다 네댓 개가 종류를 섞어 열리고, 특수 기물은 두 단계에 하나 · 아마존이 맨 뒤', () => {
  for (let i = 1; i <= MAX_TIER; i++) {
    const t = UNLOCK_TIERS[i];
    const n = UNLOCK_KINDS.reduce((a, k) => a + t[k].length, 0);
    assert.ok(n >= 3 && n <= 6, `단계 ${i}: ${n}개`);
    assert.ok(UNLOCK_KINDS.filter((k) => t[k].length).length >= 2, `단계 ${i}: 한 종류뿐`);
    assert.ok(t.pieces.length <= 1);
  }
  const at = FAIRIES.map((t) => tierOf('pieces', t)).sort((a, b) => a - b);
  assert.equal(at[0], 1);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 1 && at[i] - at[i - 1] <= 3);
  assert.equal(tierOf('pieces', 'Z'), Math.max(...at));
});

test('사다리 의존: 가리키거나 만들어 내는 대상보다 먼저 열리지 않는다', () => {
  // 레퍼토리의 진화: 고르는 순간 덱에 생기는 기물
  for (const j of JOSEKIS) {
    if (!j.pick) continue;
    const made = new Set();
    for (const bag of [OPENINGS.standard.bag, []]) {
      const run = { deck: bag.map((t, i) => ({ id: i + 1, t, eng: null, edition: null })), nextPieceId: bag.length + 1 };
      j.pick(run, []);
      for (const p of run.deck) if (isFairy(p.t)) made.add(p.t);
    }
    for (const t of made) assert.ok(tierOf('josekis', j.id) >= tierOf('pieces', t), `${j.id} → ${t}`);
  }
  // 아마존을 만드는 혼(초월의 마지막 단계 · 선봉의 프로모션)
  assert.equal(UP.Q, 'Z');
  for (const id of ['transcend', 'crown']) assert.ok(tierOf('souls', id) >= tierOf('pieces', 'Z'), id);
  // 각인 · 특수 기물을 이름으로 가리키는 격언
  assert.ok(tierOf('maxims', 'ivory_tower') >= tierOf('engravings', 'ivory'));
  assert.ok(tierOf('maxims', 'disguise') >= Math.min(...FAIRIES.map((t) => tierOf('pieces', t))));
  // 드문 것은 뒤쪽 단계에
  const late = MAX_TIER / 2;
  for (const m of MAXIMS) if (m.rarity === 'rare') assert.ok(tierOf('maxims', m.id) > late, m.id);
  for (const s of SOULS) if (s.rarity === 'rare') assert.ok(tierOf('souls', s.id) > late, s.id);
  for (const j of JOSEKIS) if (j.tier === 'rainbow') assert.ok(tierOf('josekis', j.id) > late, j.id);
});

test('사다리: 단계 0에서 시너지마다 격언이 둘 이상 있다', () => {
  for (const f of FAMILIES) {
    const n = UNLOCK_TIERS[0].maxims.filter((id) => maximFamilies(id).includes(f.id)).length;
    assert.ok(n >= 2, `${f.id}: ${n}`);
  }
});

test('솔기: 잠금이 없으면 받은 목록 그대로, 있으면 열린 것만 같은 차례로', () => {
  assert.equal(openPool({}, 'maxims', MAXIMS), MAXIMS);
  assert.equal(openPool(null, 'pieces', FAIRIES), FAIRIES);
  const run = { unlocked: unlockedAt(3) };
  assert.deepEqual(openPool(run, 'pieces', [['Z', 1], ['L', 3], ['P', 2], ['S', 3]]), [['L', 3], ['P', 2], ['S', 3]]);
  assert.deepEqual(openPool(run, 'pieces', FAIRIES), ['L', 'S']);
  assert.deepEqual(openPool(run, 'engravings', ['gold', 'ebony', 'iron']), ['gold', 'iron']);
  assert.deepEqual(openPool({ unlocked: unlockedAt(MAX_TIER) }, 'souls', SOULS), SOULS);
  const w = [['P', 1], ['L', 1], ['Z', 1]];
  assert.equal(openTypes({}, w), w);
  assert.deepEqual(openTypes({ pieces: ['L'] }, w), [['P', 1], ['L', 1]]);
});

test('솔기: 적 무게 · 진화는 열린 특수 기물만 쓴다', () => {
  const mercs = { mix: { P: 0.8, fairy: 2 }, unique: { Z: 0.08, L: 0.3, S: 0.3 } };
  assert.ok(enemyWeights(8, mercs).some(([t]) => t === 'Z'));
  assert.deepEqual(enemyWeights(8, { ...mercs, pieces: [] }).map(([t]) => t), ['P', 'N', 'B', 'R', 'Q']);
  assert.deepEqual(enemyWeights(8, { pieces: ['S'] }).map(([t]) => t), ['P', 'N', 'B', 'R', 'Q', 'S']);
  assert.deepEqual(enemyWeights(8, { ...mercs, pieces: FAIRIES }), enemyWeights(8, mercs));
  const rook = { id: 5, t: 'R' };
  assert.equal(evolveTo(7, rook), EVOLVE.R[(7 + 5) % 3]);
  assert.equal(evolveTo(7, rook, { unlocked: unlockedAt(0) }), null);
  assert.equal(evolveTo(7, rook, { unlocked: unlockedAt(7) }), 'O');
  assert.equal(evolveTo(7, rook, { unlocked: unlockedAt(MAX_TIER) }), evolveTo(7, rook));
});

// ── 판을 끝까지: 대국은 봇이 두고(끝 두 수 앞에서 목표를 0으로 — 증원을 보고 이긴다), 상점 · 팩 · 레퍼토리는 시드로 아무거나
function seenBox() { return { maxims: new Set(), pieces: new Set(), souls: new Set(), engravings: new Set(), josekis: new Set(), evolve: 0, roulette: 0 }; }
function look(run, events, seen) {
  const piece = (t) => { if (isFairy(t)) seen.pieces.add(t); };
  const item = (it) => {
    if (!it) return;
    if (it.kind === 'maxim') seen.maxims.add(it.id);
    else if (it.kind === 'engraving') seen.engravings.add(it.id);
    else if (it.kind === 'engrave') seen.engravings.add(it.eng);
    else if (it.kind === 'soul') seen.souls.add(it.id);
    else if (it.kind === 'piece') { piece(it.t); if (it.soul) seen.souls.add(it.soul); }
    else if (it.kind === 'evolve') seen.evolve++;
    else if (it.kind === 'gamble' && it.id === 'roulette') seen.roulette++;
  };
  for (const it of (run.shop && run.shop.display) || []) item(it);
  for (const it of (run.pack && run.pack.options) || []) item(it);
  for (const it of run.consumables) item(it);
  if (run.hold) item(run.hold.item);
  for (const id of (run.draft && run.draft.options) || []) seen.josekis.add(id);
  for (const id of run.josekis) seen.josekis.add(id);
  for (const m of run.maxims) if (!m.legendary) seen.maxims.add(m.id);
  for (const p of run.deck) { piece(p.t); if (p.eng) seen.engravings.add(p.eng.id); if (p.soul) seen.souls.add(p.soul); }
  const cells = (board) => { for (const c of board || []) if (c) piece(c.t); };
  const b = run.battle;
  if (b) { cells(b.board); for (const x of [...(b.incoming || []), ...(b.incomingNext || [])]) piece(x.t); for (const p of [...b.hand, ...b.bag]) piece(p.t); }
  for (const lay of run.boards || []) if (lay) cells(lay.board);
  for (const e of events) {
    if (e.type === 'chest') for (const it of e.items) item(it);
    if (e.type === 'gamble') { if (e.soul) seen.souls.add(e.soul); if (e.eng) seen.engravings.add(e.eng); if (e.to) piece(e.to); }
    if (e.type === 'evolve') piece(e.to);
    if (e.type === 'piece') piece(e.piece);
  }
}
function drive(run, seen = seenBox(), { until = 9 } = {}) {
  const r = createRng((run.seed * 2654435761) >>> 0);
  const trace = [];
  const act = (c) => { const ev = applyRun(run, c); trace.push(JSON.stringify(c)); look(run, ev, seen); return ev; };
  look(run, [], seen);
  let guard = 0, inShop = 0;
  while (run.phase !== 'lost' && run.phase !== 'won' && run.ante < until && guard++ < 3000) {
    const ph = run.phase;
    if (ph === 'battle') {
      if (run.battle.movesLeft <= 2) run.battle.target = 0;
      assert.ok(stepBattle(run.battle, act, {}), '봇이 둘 수가 있다');
    } else if (ph === 'draft') act({ type: 'joseki', index: int(r, run.draft.options.length) });
    else if (ph === 'select') { inShop = 0; act({ type: 'play' }); }
    else {
      if (ph === 'shop' && !inShop) run.money += 12; // 여러 가지를 사 보게
      const legal = legalRunCommands(run).filter((c) => c.type !== 'leave' && c.type !== 'moveMaxim');
      if (ph === 'shop' && (inShop++ >= 8 || !legal.length)) act({ type: 'leave' });
      else act(legal[int(r, legal.length)]);
    }
  }
  return { trace, seen };
}
const within = (seen, open, label) => {
  for (const k of UNLOCK_KINDS) for (const id of seen[k]) assert.ok(open[k].includes(id), `${label}: 잠긴 ${k} ${id}`);
};

test('단계 0 판: 잠긴 것이 상점 · 팩 · 상자 · 레퍼토리 후보 · 적 판 · 덱 어디에도 안 나온다', () => {
  const open = unlockedAt(0);
  const seen = seenBox();
  let far = 0;
  for (const seed of [3, 11, 29, 47, 71, 97]) {
    const run = createRun({ seed, unlockTier: 0 });
    assert.deepEqual(run.unlocked, open);
    drive(run, seen);
    within(seen, open, `seed ${seed}`);
    far = Math.max(far, run.ante);
  }
  assert.ok(far >= 8, '끝 관까지 간 판이 있다');
  assert.equal(seen.pieces.size, 0);
  assert.equal(seen.evolve + seen.roulette, 0, '특수 기물이 없으면 진화 · 룰렛도 안 나온다');
  assert.ok(seen.maxims.size >= 12 && seen.engravings.size >= 2 && seen.souls.size >= 1 && seen.josekis.size >= 5, '보는 눈이 실제로 본다');
});

test('가운데 단계 판: 열린 것만 나오고, 열린 특수 기물은 나온다', () => {
  const tier = 10;
  const open = unlockedAt(tier);
  const seen = seenBox();
  for (const seed of [5, 13, 31, 53]) { drive(createRun({ seed, unlockTier: tier }), seen); within(seen, open, `seed ${seed}`); }
  assert.ok(seen.pieces.size >= 2);
});

test('잠금 없는 판은 열쇠가 없고, 최고 단계 판과 한 수도 다르지 않다', () => {
  const plain = createRun({ seed: 17 });
  assert.ok(!('unlocked' in plain));
  assert.ok(!('pieces' in plain.rules));
  const full = createRun({ seed: 17, unlockTier: MAX_TIER });
  const a = drive(plain, seenBox(), { until: 5 });
  const b = drive(full, seenBox(), { until: 5 });
  assert.deepEqual(b.trace, a.trace);
  assert.ok(a.seen.pieces.size > 0, '전부 열린 판에는 특수 기물이 나온다');
  const strip = (run) => { const x = clone(run); delete x.unlocked; delete x.rules.pieces; return x; };
  assert.deepEqual(strip(full), strip(plain));
});

test('해금 목록은 판 상태에 실려 JSON 왕복 뒤에도 같은 판을 잇는다', () => {
  const run = createRun({ seed: 23, unlockTier: 4 });
  drive(run, seenBox(), { until: 2 });
  const copy = clone(run);
  assert.deepEqual(copy, run);
  assert.deepEqual(copy.unlocked, unlockedAt(4));
  const a = drive(run, seenBox(), { until: 4 });
  const b = drive(copy, seenBox(), { until: 4 });
  assert.deepEqual(b.trace, a.trace);
  assert.deepEqual(clone(copy), clone(run));
  within(a.seen, unlockedAt(4), '왕복 뒤');
});

// ── 판 밖 진행: 돌파한 관의 누적 수 → 단계(한 판에 한 묶음)
test('문턱: 스무 단계, 늘 오르기만 하고 사이가 줄지 않는다', () => {
  assert.equal(UNLOCK_GATES.length, MAX_TIER + 1);
  assert.deepEqual(UNLOCK_GATES, [0, 2, 5, 8, 12, 16, 20, 25, 30, 35, 41, 47, 53, 60, 67, 74, 82, 90, 98, 107, 116]);
  for (let t = 2; t <= MAX_TIER; t++) assert.ok(UNLOCK_GATES[t] - UNLOCK_GATES[t - 1] >= UNLOCK_GATES[t - 1] - UNLOCK_GATES[t - 2], `단계 ${t}`);
  assert.deepEqual([0, 1, 2, 4, 5, 8, 115, 116, 9999].map(tierForGates), [0, 0, 1, 1, 2, 3, 19, 20, 20]);
});

test('판에서 돌파한 관: 이기면 여덟, 지면 도달한 관 앞까지, 끝없는 대국은 여덟을 넘겨 실제로 돌파한 관', () => {
  assert.equal(gatesOfRun({ phase: 'won', ante: 8 }), 8);
  assert.equal(gatesOfRun({ phase: 'lost', ante: 1 }), 0);
  assert.equal(gatesOfRun({ phase: 'lost', ante: 5 }), 4);
  assert.equal(gatesOfRun({ phase: 'lost', ante: 11, endless: true }), 10);
  assert.equal(gatesOfRun({ phase: 'lost', ante: 9, endless: true }), 8);
});

test('한 판에 한 묶음: 이긴 판(+8) 뒤 단계 1, 다음 판은 진 판(+0)이라도 2, 그다음 3', () => {
  assert.deepEqual(advanceUnlock(0, 0, 8), { tier: 1, gates: 8, opened: 1 });
  assert.deepEqual(advanceUnlock(1, 8, 0), { tier: 2, gates: 8, opened: 2 });
  assert.deepEqual(advanceUnlock(2, 8, 0), { tier: 3, gates: 8, opened: 3 });
  assert.deepEqual(advanceUnlock(3, 8, 0), { tier: 3, gates: 8, opened: null }, '문턱 12 앞에서 멈춘다');
  assert.deepEqual(advanceUnlock(20, 500, 8), { tier: 20, gates: 508, opened: null });
  assert.deepEqual(advanceUnlock(0, 0, 8, false), { tier: 0, gates: 8, opened: null }, '이 판이 이미 하나 열었으면 관만 쌓인다');
  // 기록으로: 판마다 finishRun
  const rec = emptyRecords();
  assert.deepEqual([rec.gates, rec.unlockTier], [0, 0]);
  const run = (phase, ante) => { const r = createRun({ seed: 1, draft: false, unlockTier: rec.unlockTier }); r.phase = phase; r.ante = ante; return r; };
  const won = run('won', 8);
  assert.equal(finishRun(rec, won).tier, 1);
  assert.deepEqual([rec.gates, rec.unlockTier], [8, 1]);
  assert.equal(finishRun(rec, run('lost', 1)).tier, 2);
  assert.deepEqual([rec.gates, rec.unlockTier], [8, 2]);
  assert.equal(finishRun(rec, run('lost', 1)).tier, 3);
  assert.equal(finishRun(rec, run('lost', 1)).tier, null);
  assert.deepEqual([rec.gates, rec.unlockTier], [8, 3]);
  // 다음 판은 그때까지 연 묶음으로 열린다
  assert.deepEqual(run('lost', 1).unlocked, unlockedAt(3));
  // 끝없는 대국: 이긴 순간 여덟을 세었고, 끝나면 넘긴 관만 더한다 — 그 판이 이미 하나 열었으면 단계는 그대로
  won.endless = true; won.phase = 'lost'; won.ante = 13;
  assert.deepEqual(finishEndless(rec, won), { deeper: true, tier: null });
  assert.deepEqual([rec.gates, rec.unlockTier], [12, 3]);
  assert.equal(finishRun(rec, run('lost', 1)).tier, 4);
  // 이긴 순간에 못 열었던 판은 끝없는 대국이 끝날 때 하나 연다
  const full = emptyRecords(); full.gates = 8; full.unlockTier = 3;
  const w2 = createRun({ seed: 2, draft: false }); w2.phase = 'won'; w2.ante = 8;
  assert.equal(finishRun(full, w2).tier, 4);
  const cap = emptyRecords(); cap.gates = 0; cap.unlockTier = 0;
  const w3 = createRun({ seed: 2, draft: false }); w3.phase = 'lost'; w3.ante = 1; w3.endless = true;
  assert.equal(finishEndless(cap, w3).tier, 1, '옛 저장의 끝없는 대국(센 적 없음)도 한 번에 하나');
  assert.deepEqual([cap.gates, cap.unlockTier], [8, 1]);
});

test('지금 자리: 다음 묶음까지 남은 관 · 온 몫, 문턱을 이미 넘었으면 남은 관 0, 다 열면 다음이 없다', () => {
  assert.deepEqual(unlockProgress(0, 0), { tier: 0, gates: 0, next: 1, left: 2, p: 0 });
  assert.deepEqual(unlockProgress(3, 10), { tier: 3, gates: 10, next: 4, left: 2, p: 0.5 });
  assert.deepEqual(unlockProgress(1, 8), { tier: 1, gates: 8, next: 2, left: 0, p: 1 });
  assert.deepEqual(unlockProgress(MAX_TIER, 300), { tier: MAX_TIER, gates: 300, next: null, left: 0, p: 1 });
});

test('옛 기록은 옮기지 않는다: 칸이 없으면 누적 0 · 단계 0', () => {
  const store = makeStore({ getItem: () => JSON.stringify({ v: 1, runs: 40, wins: 9, bestAnte: 8, codex: { maxims: { memory: true } } }), setItem() {}, removeItem() {} });
  const rec = loadRecords(store);
  assert.deepEqual([rec.gates, rec.unlockTier, rec.runs], [0, 0, 40]);
});
