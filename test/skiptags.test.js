// 건너뛰기 패 여덟(CHM-58 ②): 패마다 받는 것 · 꾸러미 패는 고른 뒤 다음 대국 앞 · 「다음 상점」 덤은 한 번만 · JSON 왕복.
// 마스터전을 못 건너는 것은 run.test.js 「건너뛰기」가 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, blindInfo, TAGS, TAG_RULES, legalRunCommands } from '../src/sim/run.js';
import { SHOP, rerollCost } from '../src/sim/shop.js';
import { LEGENDS } from '../src/data/legends.js';
import { finishBattle } from './helpers/run.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
// 1관 연습 대국의 패가 kind인 판
function runWith(kind, from = 1) {
  for (let seed = from; seed < from + 2000; seed++) {
    const run = createRun({ draft: false, seed });
    if (blindInfo(run).tag.kind === kind) return run;
  }
  throw new Error(`no ${kind}`);
}
// 다음 상점까지: 지금 대국을 두고 목표 0으로 끝낸다
function toShop(run) {
  applyRun(run, { type: 'play' });
  run.battle.target = 0;
  finishBattle(run);
  assert.equal(run.phase, 'shop');
  return run;
}

test('패 여덟이 무게대로 뽑힌다', () => {
  assert.deepEqual(TAGS.map((t) => t.kind), ['money', 'chart', 'pack', 'slot', 'reroll', 'double', 'golden', 'fragment']);
  const n = {};
  for (let seed = 1; seed <= 1600; seed++) { const k = blindInfo(createRun({ draft: false, seed })).tag.kind; n[k] = (n[k] || 0) + 1; }
  const total = TAGS.reduce((a, t) => a + t.weight, 0);
  for (const t of TAGS) assert.ok(Math.abs(n[t.kind] / 1600 - t.weight / total) < 0.035, `${t.kind} ${n[t.kind]}`);
});

test('상금 패: 4 + 관', () => {
  const run = runWith('money');
  assert.equal(blindInfo(run).tag.amount, TAG_RULES.moneyBase + 1);
  const r5 = clone(run); r5.ante = 5;
  for (let b = 0; b < 2; b++) { const t = blindInfo(r5, 5, b).tag; if (t.kind === 'money') assert.equal(t.amount, TAG_RULES.moneyBase + 5); }
  const m = run.money;
  const ev = applyRun(run, { type: 'skip' });
  assert.equal(run.money, m + 5);
  assert.equal(ev.find((e) => e.type === 'skip').money, 5);
  assert.equal(run.phase, 'select');
});

test('두 배 패: 가진 상금만큼, 최대 $10', () => {
  const a = runWith('double');
  const b = clone(a);
  a.money = 7; applyRun(a, { type: 'skip' });
  assert.equal(a.money, 14);
  b.money = 25; applyRun(b, { type: 'skip' });
  assert.equal(b.money, 25 + TAG_RULES.doubleMax);
});

test('꾸러미 패: 곧바로 열리고 고르면 상점 없이 다음 대국 앞(JSON 왕복 뒤에도)', () => {
  const run = runWith('pack');
  const kind = blindInfo(run).tag.pack;
  assert.ok(SHOP.packKinds.includes(kind));
  const deck = run.deck.length, charts = Object.values(run.charts).reduce((x, y) => x + y, 0);
  const ev = applyRun(run, { type: 'skip' });
  assert.equal(run.phase, 'pack');
  assert.equal(run.pack.kind, kind);
  assert.equal(run.pack.options.length, SHOP.packSize);
  assert.ok(ev.some((e) => e.type === 'packOpen' && e.from === 'tag'));
  const saved = clone(run);
  const cmd = legalRunCommands(saved).find((c) => c.type === 'pick');
  applyRun(saved, cmd);
  assert.equal(saved.phase, 'select');
  assert.equal(saved.blind, 1);
  assert.equal(saved.shop, null);
  assert.equal(saved.pack, null);
  const grew = saved.deck.length > deck || Object.values(saved.charts).reduce((x, y) => x + y, 0) > charts || saved.deck.some((p) => p.eng) || Object.values(saved.fragments).some((f) => f.first);
  assert.ok(grew, '고른 것이 들어왔다');
  applyRun(run, { type: 'skipPack' });
  assert.equal(run.phase, 'select');
  assert.equal(run.blind, 1);
});

test('금빛 꾸러미 패: 판본 격언 셋, 넘겨도 다음 대국 앞', () => {
  const run = runWith('golden');
  applyRun(run, { type: 'skip' });
  assert.equal(run.pack.kind, 'golden');
  assert.equal(run.pack.options.length, 3);
  assert.ok(run.pack.options.every((o) => o.kind === 'maxim' && o.edition));
  applyRun(run, { type: 'pick', index: 0 });
  assert.equal(run.phase, 'select');
  assert.ok(run.maxims.some((m) => m.edition));
});

test('꾸러미 칸 패: 다음 상점 하나에서만 꾸러미 셋', () => {
  const run = runWith('slot');
  applyRun(run, { type: 'skip' });
  assert.deepEqual(clone(run).perks, { packs: 1 });
  toShop(run);
  assert.equal(run.shop.packs.length, SHOP.packSlots + 1);
  assert.equal(run.perks, undefined);
  applyRun(run, { type: 'leave' });
  toShop(run);
  assert.equal(run.shop.packs.length, SHOP.packSlots);
});

test('다시 진열 패: 다음 상점에서 두 번은 $0, 그 뒤 값은 처음부터 · 다음 상점엔 없다', () => {
  const run = runWith('reroll');
  applyRun(run, { type: 'skip' });
  toShop(run);
  run.money = 0;
  for (let i = 0; i < TAG_RULES.rerolls; i++) {
    assert.equal(rerollCost(run), 0);
    applyRun(run, { type: 'reroll' });
  }
  assert.equal(rerollCost(run), SHOP.rerollBase);
  assert.throws(() => applyRun(run, { type: 'reroll' }), /money/);
  run.money = 50;
  applyRun(run, { type: 'reroll' });
  assert.equal(run.money, 50 - SHOP.rerollBase);
  applyRun(run, { type: 'leave' });
  toShop(run);
  assert.equal(rerollCost(run), SHOP.rerollBase);
});

test('명경기 조각 패: 첫 조각 하나, 고를 명경기가 없으면 상금 패', () => {
  const run = runWith('fragment');
  const ev = applyRun(run, { type: 'skip' });
  const f = ev.find((e) => e.type === 'fragment');
  assert.ok(f && f.part === 'first' && f.via === 'tag');
  assert.equal(run.fragments[f.legend].first, true);
  const full = runWith('fragment');
  for (const l of LEGENDS) full.fragments[l.id] = { first: true, feat: false, gold: false };
  const t = blindInfo(full).tag;
  assert.equal(t.kind, 'money');
  assert.equal(t.amount, TAG_RULES.moneyBase + 1);
});

test('덤 · 상점 밖 꾸러미가 JSON 왕복 안전', () => {
  const run = runWith('reroll');
  applyRun(run, { type: 'skip' });
  const back = clone(run);
  assert.deepEqual(back.perks, { rerolls: TAG_RULES.rerolls });
  toShop(back);
  assert.equal(clone(back).shop.free, TAG_RULES.rerolls);
});
