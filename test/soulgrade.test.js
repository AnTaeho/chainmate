// CHM-17: 혼 등급(1단계) · 각성(2단계)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOULS, SOUL_BY_ID, SOUL_RARITY, soulPrice } from '../src/data/souls.js';
import { rollSoul, rollItem, SHOP } from '../src/sim/shop.js';
import { createRng } from '../src/sim/rng.js';
import { createRun } from '../src/sim/run.js';

test('혼 등급: 열여섯 모두 흔함 · 드묾 · 귀함 중 하나, 값은 등급을 따른다', () => {
  const n = { common: 0, uncommon: 0, rare: 0 };
  for (const s of SOULS) { assert.ok(s.rarity in n, s.id); n[s.rarity]++; assert.equal(soulPrice(s.id), SOUL_RARITY[s.rarity].price); }
  assert.deepEqual(n, { common: 6, uncommon: 5, rare: 5 });
  assert.ok(SOUL_RARITY.common.price < SOUL_RARITY.uncommon.price && SOUL_RARITY.uncommon.price < SOUL_RARITY.rare.price);
});

test('혼 등급: 같은 시드면 같은 혼, 나오는 몫은 등급 무게를 따른다', () => {
  const seq = (seed) => { const r = createRng(seed); return Array.from({ length: 50 }, () => rollSoul(r)); };
  assert.deepEqual(seq(7), seq(7));
  const r = createRng(1), n = { common: 0, uncommon: 0, rare: 0 }, N = 20000;
  for (let i = 0; i < N; i++) n[SOUL_BY_ID[rollSoul(r)].rarity]++;
  const total = Object.values(SOUL_RARITY).reduce((a, x) => a + x.weight, 0);
  for (const k of Object.keys(n)) assert.ok(Math.abs(n[k] / N - SOUL_RARITY[k].weight / total) < 0.015, `${k} ${n[k] / N}`);
});

test('혼 등급: 상점의 혼 두루마리 · 혼 깃든 기물은 그 혼의 값을 받는다', () => {
  const run = createRun({ seed: 3 });
  const r = createRng(11);
  let scrolls = 0, pieces = 0;
  for (let i = 0; i < 6000; i++) {
    const it = rollItem(run, r, []);
    if (it.kind === 'soul') { scrolls++; assert.equal(it.price, soulPrice(it.id)); }
    if (it.kind === 'piece' && it.soul) { pieces++; assert.equal(it.price, SHOP.piecePrice[it.t] + soulPrice(it.soul)); }
  }
  assert.ok(scrolls > 50 && pieces > 20, `${scrolls} ${pieces}`);
});

// ── 2단계 · 각성
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { soulSpec, CRACK, isCracked } from '../src/data/souls.js';
import { createBattle, apply, legalCommands } from '../src/sim/battle.js';
import { applyRun, legalRunCommands, CHEST } from '../src/sim/run.js';

// 혼 id · 각성 여부로 사슬 하나(caps를 차례로 먹는다). extra는 탁자에 얹을 것(hand · relayUsed …)
function run2(map, drop, at, caps, soul, awake, extra = {}) {
  const t = { board: boardFrom(map), rules: {}, mods: [], chain: null, movesUsed: 0, hand: [], ...extra };
  const ev = startChain(t, { type: drop, sq: S(at), soul: soulSpec(soul, awake) });
  for (const c of caps) { if (t.chain.done) break; ev.push(...chainCapture(t, S(c))); }
  return { t, c: t.chain, ev };
}
const both = (...a) => [run2(...a, false), run2(...a, true)];

test('각성 효과 · 흡수: 얻은 행마가 둘까지 쌓인다', () => {
  const [p, w] = both({ e6: 'R', e8: 'P', a1: 'P' }, 'N', 'd4', ['e6', 'e8'], 'absorb');
  assert.deepEqual(p.c.absorbed, ['P']);
  assert.deepEqual(w.c.absorbed, ['P', 'R']);
});

test('각성 효과 · 메아리: 두 번까지 처음 모습으로 돌아간다', () => {
  const map = { e6: 'B', g7: 'R', e8: 'P' };
  const [p, w] = both(map, 'N', 'd4', ['e6', 'g7', 'e8'], 'echo');
  assert.equal(p.c.captures.length, 2);
  assert.equal(w.c.captures.length, 3);
  assert.equal(w.ev.filter((e) => e.type === 'transform' && e.echo).length, 2);
});

test('각성 효과 · 초월: 아마존 모습으로 먹을 때마다 배수 ×1.5', () => {
  const [p, w] = both({ e5: 'P', g6: 'P' }, 'Q', 'd4', ['e5', 'g6'], 'transcend');
  assert.deepEqual([p.c.forms.at(-1), p.c.mult], ['Z', 2]);
  assert.equal(w.c.mult, 3);
});

test('각성 효과 · 굶주림: 값 +20씩 · 배수 +1씩 커진다', () => {
  const [p, w] = both({ d5: 'R', h5: 'R', h8: 'R' }, 'R', 'd1', ['d5', 'h5', 'h8'], 'hunger');
  assert.equal(p.c.captures.length, 3);
  assert.equal(w.c.value - p.c.value, 10 * (0 + 1 + 2));
  assert.equal(w.c.mult - p.c.mult, 0 + 1 + 2);
});

test('각성 효과 · 사냥꾼: 앞서 먹은 종류를 또 먹으면 배수 ×2', () => {
  const [p, w] = both({ d5: 'P', e6: 'N', f8: 'P' }, 'Q', 'd4', ['d5', 'e6', 'f8'], 'hunter');
  assert.equal(p.c.captures.map((x) => x.piece).join(''), 'PNP');
  assert.equal(p.c.mult, 3);
  assert.equal(w.c.mult, 6);
});

test('각성 효과 · 순교자: 끊길 때 한 번 둘레를 먹고 이어 간다', () => {
  const [p, w] = both({ a4: 'B', c5: 'N', c6: 'P' }, 'R', 'a1', ['a4', 'c6'], 'martyr');
  assert.equal(p.c.reason, 'cut');
  assert.equal(p.c.captures.length, 1);
  assert.equal(w.c.captures.length, 2);
  assert.ok(w.ev.some((e) => e.type === 'cutIgnored'));
});

test('각성 효과 · 선봉: 폰 모습이면 다섯째 줄에서 아마존으로', () => {
  const [p, w] = both({ e4: 'P', f5: 'P' }, 'P', 'd3', ['e4', 'f5'], 'crown');
  assert.equal(p.c.promotions, 0);
  assert.deepEqual([w.c.promotions, w.c.forms.at(-1)], [1, 'Z']);
});

test('각성 효과 · 잠행: 노림을 넘길 때마다 배수 +1 · 배수 −1 없음', () => {
  const [p, w] = both({ a4: 'P', c5: 'N', b5: 'P' }, 'R', 'a1', ['a4', 'b5'], 'shade');
  assert.equal(p.c.captures.length, 2);
  assert.equal(p.c.mult, 1);
  assert.equal(w.c.mult, 3);
});

test('각성 효과 · 계승: 대국마다 한 번 마지막 모습의 기보가 오른다', () => {
  const p = run2({ e6: 'B' }, 'N', 'd4', ['e6'], 'inherit', false);
  const w = run2({ e6: 'B' }, 'N', 'd4', ['e6'], 'inherit', true);
  assert.equal(p.c.chartUp, undefined);
  assert.deepEqual([w.c.becomes, w.c.chartUp], ['B', 'B']);
  const again = run2({ e6: 'B' }, 'N', 'd4', ['e6'], 'inherit', true, { chartUpUsed: true });
  assert.equal(again.c.chartUp, undefined);
});

test('각성 효과 · 계주: 대국에 한 번 쓴 뒤에도 사슬마다 이어 먹는다', () => {
  const extra = () => ({ hand: [{ id: 9, t: 'R' }], relayUsed: true });
  const p = run2({ e5: 'B', e8: 'P' }, 'N', 'd3', ['e5', 'e8'], 'relay', false, extra());
  const w = run2({ e5: 'B', e8: 'P' }, 'N', 'd3', ['e5', 'e8'], 'relay', true, extra());
  assert.equal(p.c.captures.length, 1);
  assert.equal(w.c.captures.length, 2);
  assert.deepEqual(w.c.relay, { id: 9, t: 'R' });
});

test('각성 효과 · 역행: 어느 모습이든 아래 대각으로도 먹는다', () => {
  const [p, w] = both({ c3: 'P' }, 'N', 'd4', [], 'retro');
  assert.ok(!chainCaptures(p.t).includes(S('c3')));
  assert.ok(chainCaptures(w.t).includes(S('c3')));
});

test('각성 효과 · 결투: 사슬 끝 배수 ×3', () => {
  const [p, w] = both({ e6: 'B' }, 'N', 'd4', ['e6'], 'duel');
  assert.deepEqual([p.c.mult, w.c.mult], [2, 3]);
});

test('각성 효과 · 사신: 체크메이트한 사슬 배수 ×3', () => {
  const [p, w] = both({ a5: 'K' }, 'R', 'a1', ['a5'], 'reaper');
  assert.equal(p.c.reason, 'mate');
  assert.deepEqual([p.c.mult, w.c.mult], [1, 3]);
});

test('각성 효과 · 도약: 둘째 먹기까지 두 칸 안 어디든', () => {
  const [p, w] = both({ d6: 'P', f6: 'P' }, 'P', 'd4', ['d6'], 'spring');
  assert.ok(!chainCaptures(p.t).includes(S('f6')));
  assert.ok(chainCaptures(w.t).includes(S('f6')));
});

test('각성 효과 · 파문: 먹을 때마다 둘레 적 둘이 못 지킨다', () => {
  const [p, w] = both({ d4: 'P', c5: 'P', e5: 'P' }, 'R', 'd1', ['d4'], 'ripple');
  const frozen = (x) => x.ev.filter((e) => e.type === 'freeze').flatMap((e) => e.squares).length;
  assert.deepEqual([frozen(p), frozen(w)], [1, 2]);
  assert.equal(w.c.forced, null, '둘 다 못 지켜 응수가 없다');
});

test('각성 효과 · 귀환: 대국마다 두 번 돌아온다', () => {
  const back = (awake) => {
    for (let seed = 1; seed <= 80; seed++) {
      const b = createBattle({ seed, ante: 2, target: 1e9, bag: [{ t: 'N', id: 1, soul: 'homing', ...(awake ? { awake: true } : {}) }, 'P', 'P', 'P', 'N', 'B', 'R', 'P'] });
      let n = 0;
      for (let k = 0; k < 2; k++) {
        const i = b.hand.findIndex((p) => p.id === 1);
        const d = i >= 0 && legalCommands(b).find((c) => c.type === 'drop' && c.handIndex === i);
        if (!d) break;
        apply(b, d);
        while (b.status === 'chain') apply(b, legalCommands(b)[0]);
        if (b.hand.some((p) => p.id === 1)) n++;
      }
      if (b.movesUsed === 2) return n;
    }
    return null;
  };
  assert.equal(back(false), 1);
  assert.equal(back(true), 2);
});

test('각성 효과: 열여섯 혼 모두 각성 한 줄이 있다', () => {
  for (const s of SOULS) assert.ok(typeof s.awake === 'string' && s.awake.length > 4, s.id);
});

// 금이 가는 셈: 혼 깃든 기물로 한 번 이상 먹은 사슬마다 한 칸, CRACK.links에 닿으면 crack
function dropOnce(b, id) {
  const i = b.hand.findIndex((p) => p.id === id);
  if (i < 0) return null;
  for (const d of legalCommands(b).filter((c) => c.type === 'drop' && c.handIndex === i)) {
    const copy = JSON.parse(JSON.stringify(b));
    const ev = apply(copy, d);
    while (copy.status === 'chain') ev.push(...apply(copy, legalCommands(copy)[0]));
    if (copy.history.at(-1).captures > 0) { Object.assign(b, copy); return ev; }
  }
  return null;
}
test('금: 먹은 사슬마다 한 칸, 다섯째에 금이 간다', () => {
  let checked = false;
  for (let seed = 1; seed <= 60 && !checked; seed++) {
    const b = createBattle({ seed, ante: 2, target: 1e9, bag: [{ t: 'Q', id: 1, soul: 'hunger', links: CRACK.links - 1 }, 'P', 'P', 'P', 'N', 'B', 'R', 'P'] });
    const ev = dropOnce(b, 1);
    if (!ev) continue;
    const p = b.used.find((x) => x.id === 1) || b.hand.find((x) => x.id === 1);
    assert.equal(p.links, CRACK.links);
    assert.ok(ev.some((e) => e.type === 'crack' && e.id === 1 && e.soul === 'hunger'));
    assert.ok(isCracked(p));
    assert.deepEqual(b.cracks, [{ id: 1, soul: 'hunger' }]);
    checked = true;
  }
  assert.ok(checked);
  // 혼이 없거나 이미 깨어난 기물은 세지 않는다
  assert.ok(!isCracked({ t: 'Q', links: 9 }));
  assert.ok(!isCracked({ t: 'Q', soul: 'hunger', links: 9, awake: true }));
});

// 판을 대국 앞까지: 주머니 첫 기물에 금이 간 혼
function crackedRun(seed, blind = 0) {
  const run = createRun({ seed, draft: false });
  run.deck[0].soul = 'hunger';
  run.deck[0].links = CRACK.links;
  run.blind = blind;
  applyRun(run, { type: 'play' });
  return run;
}
// 대국을 목표 1로 이긴다(첫 떨구기 → 사슬 끝까지). gold면 판의 적을 모두 금빛으로
function winBattle(run, gold = false) {
  const b = run.battle;
  b.target = 1;
  if (gold) for (const c of b.board) if (c && !c.mine && c.t !== 'K' && c.t !== 'X') c.gold = true;
  const ev = [];
  for (let k = 0; k < 20 && run.phase === 'battle'; k++) {
    const cmds = legalRunCommands(run).filter((c) => c.type !== 'discard' && c.type !== 'reboard' && c.type !== 'tactic');
    ev.push(...applyRun(run, cmds[0]));
  }
  return ev;
}

test('각성 길 · 금빛 적을 먹고 이긴 대국: 금이 간 혼이 깨어난다', () => {
  let ok = false;
  for (let seed = 1; seed <= 30 && !ok; seed++) {
    const run = crackedRun(seed);
    const ev = winBattle(run, true);
    if (!run.log.at(-1).won || !run.log.at(-1).golden) continue;
    const e = ev.find((x) => x.type === 'awaken');
    assert.ok(e, `seed ${seed}`);
    assert.deepEqual([e.src, e.soul, e.pieceId], ['golden', 'hunger', run.deck[0].id]);
    assert.equal(run.deck[0].awake, true);
    assert.ok(!isCracked(run.deck[0]));
    ok = true;
  }
  assert.ok(ok);
});

test('각성 길 · 마스터의 상자 세 칸 이상: 마지막 칸이 깨우기', () => {
  const keep = CHEST.counts;
  try {
    CHEST.counts = [[3, 1]];
    const run = crackedRun(4, 2);
    assert.equal(run.battle.kind, 'master');
    const ev = winBattle(run);
    const chest = ev.find((e) => e.type === 'chest');
    assert.equal(chest.count, 3);
    assert.equal(chest.items.at(-1).kind, 'awaken');
    assert.ok(ev.some((e) => e.type === 'awaken' && e.src === 'chest'));
    assert.equal(run.deck[0].awake, true);
    CHEST.counts = [[1, 1]];
    const one = crackedRun(4, 2);
    const ev1 = winBattle(one);
    assert.ok(!ev1.some((e) => e.type === 'awaken'), '한 칸 상자는 깨우지 않는다');
  } finally { CHEST.counts = keep; }
});

test('각성 길 · 두루마리 깨우기: 금이 간 혼이 있을 때만 진열되고, 금이 간 기물에만 쓴다', () => {
  const run = createRun({ seed: 5, draft: false });
  const r = createRng(3);
  const offers = () => Array.from({ length: 4000 }, () => rollItem(run, r, [])).filter((it) => it.kind === 'awaken').length;
  assert.equal(offers(), 0);
  run.deck[1].soul = 'echo';
  run.deck[1].links = CRACK.links;
  const n = offers();
  assert.ok(n > 20 && n < 200, `${n}`);
  // 사서 쓴다
  run.phase = 'shop';
  run.money = 50;
  run.shop = { rng: createRng(1), display: [{ kind: 'awaken', price: SHOP.awaken.price }], packs: [], rerolls: 0, promoted: false, removed: false };
  applyRun(run, { type: 'buy', slot: 0 });
  assert.deepEqual(run.consumables, [{ kind: 'awaken' }]);
  assert.deepEqual(legalRunCommands(run).filter((c) => c.type === 'use'), [{ type: 'use', index: 0, target: run.deck[1].id }]);
  assert.throws(() => applyRun(run, { type: 'use', index: 0, target: run.deck[0].id }));
  const ev = applyRun(run, { type: 'use', index: 0, target: run.deck[1].id });
  assert.ok(ev.some((e) => e.type === 'awaken' && e.src === 'scroll'));
  assert.equal(run.deck[1].awake, true);
  assert.equal(run.consumables.length, 0);
});

test('각성: 새 혼을 깃들이면 금 · 각성이 지워진다', () => {
  const run = createRun({ seed: 6, draft: false });
  Object.assign(run.deck[0], { soul: 'hunger', links: 7, awake: true });
  run.phase = 'shop';
  run.shop = { rng: createRng(1), display: [], packs: [], rerolls: 0, promoted: false, removed: false };
  run.consumables = [{ kind: 'soul', id: 'echo' }];
  applyRun(run, { type: 'use', index: 0, target: run.deck[0].id });
  assert.deepEqual([run.deck[0].soul, run.deck[0].links, run.deck[0].awake], ['echo', undefined, undefined]);
});

test('각성: 저장 왕복 — 금 · 각성이 판과 대국을 오가고 JSON으로 그대로', () => {
  const run = createRun({ seed: 8, draft: false });
  Object.assign(run.deck[0], { soul: 'duel', awake: true });
  Object.assign(run.deck[1], { soul: 'echo', links: 3 });
  applyRun(run, { type: 'play' });
  const all = [...run.battle.hand, ...run.battle.bag];
  assert.equal(all.find((p) => p.id === run.deck[0].id).awake, true);
  assert.equal(all.find((p) => p.id === run.deck[1].id).links, 3);
  const copy = JSON.parse(JSON.stringify(run));
  assert.deepEqual(copy, run);
  // 같은 명령을 두 판에 두면 같은 결과
  for (let k = 0; k < 6 && run.phase === 'battle'; k++) {
    const cmd = legalRunCommands(run)[0];
    assert.deepEqual(applyRun(copy, cmd), applyRun(run, cmd));
  }
  assert.deepEqual(copy, run);
});
