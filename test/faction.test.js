// 세력 여덟(docs/design-notes/factions.md): 섞기 · 버릇 · 우두머리 · 옛 저장 옮기기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, blindInfo, battleMods, battleSeed, migrateRun, factionOrder, factionFor } from '../src/sim/run.js';
import { createBattle, apply, legalCommands, dropSquaresFor } from '../src/sim/battle.js';
import { attackers, rankOf, fileOf } from '../src/sim/board.js';
import { kingGuards, enemyWeights } from '../src/sim/setup.js';
import { FACTIONS, FACTION_BY_ID, MIDDLE_FACTIONS, FACTION_OF_BOSS } from '../src/data/factions.js';
import { MASTERS, FINAL_MASTER } from '../src/data/masters.js';
import { FAIRIES } from '../src/data/pieces.js';
import { traitChance } from '../src/data/traits.js';

// 세력 하나의 대국(버릇만, 명인 없이)
const battleOf = (faction, ante, seed, extra = {}) => createBattle({ seed, ante, kind: 'official', target: 1e12, mods: battleMods({ charts: {}, maxims: [] }, extra.master || null, faction), rules: extra.rules || {} });
const count = (board, t) => board.filter((c) => c && c.t === t).length;

test('세력 섞기: 1관 농민군 · 8관 왕궁 근위, 2~7관은 여섯을 판 시드로 섞는다(결정적)', () => {
  const orders = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const a = createRun({ seed, draft: false }).factions;
    assert.deepEqual(a, createRun({ seed, draft: false }).factions, '같은 시드 → 같은 차례');
    assert.deepEqual(a, factionOrder(seed));
    assert.equal(a[0], 'peasants');
    assert.equal(a[7], 'royal');
    assert.deepEqual([...a.slice(1, 7)].sort(), [...MIDDLE_FACTIONS].sort());
    orders.add(a.join());
  }
  assert.ok(orders.size >= 30, `판마다 다른 차례 ${orders.size}/40`);
  // 끝없는 대국: 9관부터 관마다 시드로 아무 세력
  const run = createRun({ seed: 5, draft: false });
  assert.equal(factionFor(run, 9), factionFor(createRun({ seed: 5, draft: false }), 9));
  assert.ok(FACTION_BY_ID[factionFor(run, 12)]);
});

test('세력: 관의 세 대국 모두 같은 세력, 명인은 그 세력의 우두머리, JSON 왕복', () => {
  const run = createRun({ seed: 7, draft: false });
  for (let ante = 1; ante <= 8; ante++) {
    const f = run.factions[ante - 1];
    for (let blind = 0; blind < 3; blind++) assert.equal(blindInfo(run, ante, blind).faction, f);
    assert.equal(blindInfo(run, ante, 2).master, FACTION_BY_ID[f].boss);
    assert.equal(blindInfo(run, ante, 0).master, null);
  }
  applyRun(run, { type: 'play' });
  assert.equal(run.battle.mods[0].id, 'faction:peasants');
  const back = JSON.parse(JSON.stringify(run));
  assert.deepEqual(back, run);
  assert.deepEqual(legalCommands(back.battle), legalCommands(run.battle));
});

test('우두머리: 옛 명인 여덟이 세력마다 하나씩, 8관은 대가', () => {
  assert.deepEqual(FACTIONS.map((f) => f.boss).sort(), MASTERS.map((m) => m.id).sort());
  assert.equal(FACTION_BY_ID.royal.boss, FINAL_MASTER);
  for (const f of FACTIONS) assert.ok(f.name && f.habit.text && f.crest, f.id);
});

test('버릇 · 농민군: 적 폰이 옆 칸도 지킨다', () => {
  const b = battleOf('peasants', 1, 3);
  const psq = b.board.findIndex((c) => c && c.t === 'P' && fileOf(b.board.indexOf(c)) > 0 && fileOf(b.board.indexOf(c)) < 7);
  const side = psq - 1;
  const saved = b.board[side];
  b.board[side] = { t: 'N', id: 999 };
  assert.ok(attackers(b.board, side, { pawnSides: b.rules.pawnSides }).includes(psq));
  b.board[side] = saved;
});

test('버릇 · 기병대: 증원이 모두 나이트 무리(나이트 · 낙타), 주력은 나이트', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const b = battleOf('cavalry', 3, seed);
    for (const r of [...b.incoming, ...b.incomingNext]) seen.add(r.t);
  }
  assert.ok([...seen].every((t) => ['N', 'L'].includes(t)), [...seen].join());
  const w = enemyWeights(3, { mix: FACTION_BY_ID.cavalry.mix, unique: FACTION_BY_ID.cavalry.unique });
  const top = [...w].sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(top, 'N');
});

test('버릇 · 수도원: 돌기둥(벽) 셋~다섯이 늘 선다', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const b = battleOf('abbey', 2, seed);
    assert.ok(count(b.board, 'X') >= 3, `seed ${seed}: ${count(b.board, 'X')}`);
  }
  assert.equal(count(battleOf(null, 1, 1).board, 'X'), 0);
});

test('버릇 · 성채: 넷째 줄에 성벽 일곱 칸, 가운데 네 칸 중 하나가 문', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const b = battleOf('fortress', 3, seed);
    const row = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => b.board[3 * 8 + f]);
    const gaps = row.map((c, f) => (c && c.t === 'X' ? -1 : f)).filter((f) => f >= 0);
    assert.equal(gaps.length, 1, `seed ${seed}`);
    assert.ok(gaps[0] >= 2 && gaps[0] <= 5);
  }
});

test('버릇 · 숲 사냥꾼: 위 두 줄은 숲(떨굴 수 없다) · 우두머리는 다섯 줄', () => {
  const b = battleOf('hunters', 2, 4);
  assert.equal(b.rules.fog, 2);
  for (const p of b.hand) for (const sq of dropSquaresFor(b, p)) assert.ok(rankOf(sq) < 6);
  assert.equal(battleOf('hunters', 2, 4, { master: FACTION_BY_ID.hunters.boss }).rules.fog, 5);
});

test('버릇 · 전령단: 증원 +1 · 두 수 앞까지 보인다', () => {
  const b = battleOf('heralds', 2, 5);
  const plain = battleOf(null, 2, 5);
  assert.equal(b.rules.lookahead, 2);
  assert.equal(b.incoming.length, plain.incoming.length + 1);
  // 단의 증원 +1과 겹친다
  assert.equal(battleOf('heralds', 2, 5, { rules: { reinforceBonus: 1 } }).incoming.length, plain.incoming.length + 2);
});

test('버릇 · 용병단: 적 특성이 2관부터 두 배로 붙는다 · 고유 적은 이형 아무거나', () => {
  const r = {}; FACTION_BY_ID.mercs.habit.apply(r);
  assert.equal(traitChance(2), 0);
  assert.ok(traitChance(2, r) > 0);
  assert.equal(traitChance(6, r), 2 * traitChance(6));
  let traits = 0;
  for (let seed = 1; seed <= 10; seed++) traits += battleOf('mercs', 3, seed).board.filter((c) => c && c.trait).length;
  assert.ok(traits > 0);
  assert.deepEqual(Object.keys(FACTION_BY_ID.mercs.unique).sort(), [...FAIRIES].sort());
});

test('버릇 · 왕궁 근위: 킹을 지키는 적 +1', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const b = battleOf('royal', 8, seed);
    const k = b.board.findIndex((c) => c && c.t === 'K');
    assert.ok(attackers(b.board, k).length >= kingGuards(8) + 1, `seed ${seed}`);
  }
  // 우두머리 대가: 킹 둘, 둘 다 수비 +1
  const m = battleOf('royal', 8, 2, { master: 'grandmaster' });
  const ks = m.board.map((c, i) => (c && c.t === 'K' ? i : -1)).filter((i) => i >= 0);
  assert.equal(ks.length, 2);
});

test('고유 적: 1관부터 그 세력의 이형만 조금 섞인다', () => {
  for (const f of FACTIONS) {
    const w = enemyWeights(1, { mix: f.mix, unique: f.unique });
    const fairy = w.filter(([t, x]) => FAIRIES.includes(t) && x > 0).map(([t]) => t).sort();
    assert.deepEqual(fairy, Object.keys(f.unique).sort(), f.id);
  }
  assert.ok(!enemyWeights(1).some(([t]) => FAIRIES.includes(t)), '세력 없이는 4관부터');
});

test('단 7 「대가 목표 ×1.25」는 왕궁 근위의 우두머리 대국에만', () => {
  const run = createRun({ seed: 2, dan: 7, draft: false });
  const plain = createRun({ seed: 2, dan: 5, draft: false });
  assert.ok(blindInfo(run, 8, 2).target > blindInfo(plain, 8, 2).target);
  assert.equal(blindInfo(run, 8, 1).target, blindInfo(plain, 8, 1).target);
  assert.equal(blindInfo(run, 4, 2).target, blindInfo(plain, 4, 2).target);
});

test('옛 저장: 명인 차례(run.masters)가 세력으로 옮겨지고 같은 명인과 둔다', () => {
  const old = createRun({ seed: 9, draft: false });
  const masters = ['fog', 'mirror', 'hourglass', 'iron_wall', 'heavy_hand', 'silence', 'grudge', 'grandmaster'];
  delete old.factions;
  old.masters = masters;
  const run = migrateRun(JSON.parse(JSON.stringify(old)));
  assert.equal(run.masters, undefined);
  assert.deepEqual(run.factions, masters.map((id) => FACTION_OF_BOSS[id]));
  for (let ante = 1; ante <= 8; ante++) assert.equal(blindInfo(run, ante, 2).master, masters[ante - 1]);
  // 명인도 세력도 없는 저장은 판 시드의 차례로
  const bare = createRun({ seed: 9, draft: false });
  delete bare.factions;
  assert.deepEqual(migrateRun(bare).factions, factionOrder(9));
  // 이미 세력이 있으면 그대로
  const now = createRun({ seed: 9, draft: false });
  assert.equal(migrateRun(now).factions, now.factions);
  assert.ok(battleSeed(run));
});
