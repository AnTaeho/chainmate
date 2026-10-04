import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, legalRunCommands, blindInfo, targetFor, B, REWARD, sellPrice } from '../src/sim/run.js';
import { SHOP, rerollCost } from '../src/sim/shop.js';
import { MASTERS, FINAL_MASTER } from '../src/data/masters.js';
import { FACTION_BY_ID } from '../src/data/factions.js';
import { stepBattle } from '../tools/bot.mjs';
import { finishBattle, shopRun, skipBlind } from './helpers/run.js';

// 간단한 봇: 대국은 풀이기, 상점에선 살 수 있는 첫 물건 하나를 사고 꾸러미는 첫 선택, 나간다. 명령을 모두 적어 둔다.
function botCommands(run, maxCmds = 100000) {
  const cmds = [];
  const go = (c) => { cmds.push(c); applyRun(run, c); };
  while (cmds.length < maxCmds && run.phase !== 'lost' && run.phase !== 'won') {
    if (run.phase === 'select') go({ type: 'play' });
    else if (run.phase === 'battle') stepBattle(run.battle, go, {});
    else if (run.phase === 'shop') {
      const legal = legalRunCommands(run);
      const buy = legal.find((c) => c.type === 'buy' || c.type === 'buyPack');
      const use = legal.find((c) => c.type === 'use');
      go(use || buy || { type: 'leave' });
    } else if (run.phase === 'pack') go(legalRunCommands(run)[0]);
  }
  return cmds;
}

test('판 시작: 주머니 8, 상금 4, 세력은 1관 농민군 · 8관 왕궁 근위, 명인은 관마다 다르고 8관은 대가', () => {
  const run = createRun({ draft: false, seed: 3 });
  assert.equal(run.deck.length, 8);
  assert.equal(run.money, 4);
  assert.equal(run.phase, 'select');
  assert.equal(run.factions.length, 8);
  assert.equal(run.factions[0], 'peasants');
  assert.equal(run.factions[7], 'royal');
  const masters = [1, 2, 3, 4, 5, 6, 7, 8].map((a) => blindInfo(run, a, 2).master);
  assert.equal(masters[7], FINAL_MASTER);
  assert.deepEqual([...masters].sort(), MASTERS.map((m) => m.id).sort());
  assert.notDeepEqual(createRun({ draft: false, seed: 4 }).factions, run.factions);
});

test('목표: B × 종류 배율, 9관부터 늘어난다', () => {
  assert.equal(targetFor(1, 'practice'), B[0]);
  assert.equal(targetFor(3, 'master'), B[2] * 2);
  assert.ok(targetFor(9, 'practice') > B[7]);
  const run = createRun({ draft: false, seed: 1 });
  const info = blindInfo(run);
  assert.equal(info.kind, 'practice');
  assert.equal(info.master, null);
  assert.ok(info.tag);
  assert.equal(blindInfo(run, 2, 2).master, FACTION_BY_ID[run.factions[1]].boss);
  assert.equal(blindInfo(run, 2, 0).faction, run.factions[1]);
});

test('대국을 이기면 보상(기본 + 남은 수 + 적립 + 외통 + 대국 중 번 돈) 뒤 상점', () => {
  let checked = 0;
  for (let seed = 1; seed <= 10 && checked < 3; seed++) {
    const run = createRun({ draft: false, seed });
    run.money = 12; // 적립 2
    applyRun(run, { type: 'play' });
    assert.equal(run.phase, 'battle');
    finishBattle(run);
    if (run.phase !== 'shop') continue;
    const r = run.last.reward;
    const movesLeft = 4 - run.last.moves;
    assert.equal(r.base, REWARD.base.practice);
    assert.equal(r.moves, movesLeft);
    assert.equal(r.interest, 2);
    assert.equal(r.mate, run.last.reason === 'mate' ? 3 : 0);
    assert.equal(run.money, 12 + r.total);
    assert.equal(run.shop.display.length, 2);
    assert.equal(run.shop.packs.length, 2);
    checked++;
  }
  assert.ok(checked > 0);
});

test('상점: 사기 · 다시 진열(5, +1) · 팔기(절반) · 칸 제한', () => {
  const run = shopRun(1);
  run.money = 100;
  // 격언 하나를 진열에 세워 산다
  run.shop.display[0] = { kind: 'maxim', id: 'steadfast', price: 6, sold: false };
  applyRun(run, { type: 'buy', slot: 0 });
  assert.equal(run.money, 94);
  assert.deepEqual(run.maxims.map((m) => m.id), ['steadfast']);
  assert.throws(() => applyRun(run, { type: 'buy', slot: 0 }), /cannot buy/);
  // 다시 진열
  assert.equal(rerollCost(run), 5);
  applyRun(run, { type: 'reroll' });
  assert.equal(run.money, 89);
  assert.equal(rerollCost(run), 6);
  applyRun(run, { type: 'reroll' });
  assert.equal(run.money, 83);
  // 팔기: 산 값의 절반
  assert.equal(sellPrice(run.maxims[0]), 3);
  applyRun(run, { type: 'sell', index: 0 });
  assert.equal(run.money, 86);
  assert.equal(run.maxims.length, 0);
  // 격언 칸 5
  for (let i = 0; i < 5; i++) run.maxims.push({ uid: 90 + i, id: 'edge', data: {}, edition: null, paid: 4 });
  run.shop.display[1] = { kind: 'maxim', id: 'center', price: 5, sold: false };
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'buy' && c.slot === 1));
  assert.throws(() => applyRun(run, { type: 'buy', slot: 1 }), /cannot buy/);
  // 두루마리 칸 2: 차면 각인은 못 산다
  run.consumables = [{ kind: 'engraving', id: 'ebony' }, { kind: 'soul', id: 'echo' }];
  run.shop.display[1] = { kind: 'engraving', id: 'glass', price: 3, sold: false };
  assert.throws(() => applyRun(run, { type: 'buy', slot: 1 }), /cannot buy/);
  // 기보는 칸이 차도 산다 — 사는 순간 그 모습의 단계가 오르고 칸은 그대로(CHM-33)
  run.shop.display[1] = { kind: 'chart', form: 'R', price: 3, sold: false };
  assert.ok(legalRunCommands(run).some((c) => c.type === 'buy' && c.slot === 1));
  const ev = applyRun(run, { type: 'buy', slot: 1 });
  assert.equal(run.charts.R, 1);
  assert.equal(run.consumables.length, 2);
  assert.deepEqual(ev.map((e) => e.type), ['chart', 'buy']);
  assert.deepEqual(ev[0], { type: 'chart', form: 'R', level: 1 });
  // 다음 상점에서 다시 진열 값은 5로 돌아간다
  applyRun(run, { type: 'leave' });
  assert.equal(run.phase, 'select');
  assert.equal(run.blind, 1);
});

test('기보는 얻는 길마다 곧바로 쓰인다: 진열 · 꾸러미 · 건너뛰기 보상(기보 수집가 +1)', () => {
  const run = shopRun(2);
  run.money = 50;
  run.maxims.push({ uid: 1, id: 'collector', data: {}, edition: null, paid: 7 });
  run.consumables = [{ kind: 'engraving', id: 'ebony' }, { kind: 'engraving', id: 'glass' }];
  run.shop.display[0] = { kind: 'chart', form: 'N', price: 3, sold: false };
  applyRun(run, { type: 'buy', slot: 0 });
  assert.equal(run.charts.N, 1);
  run.shop.packs[0] = { kind: 'chart', price: 4, sold: false };
  applyRun(run, { type: 'buyPack', slot: 0 });
  const form = run.pack.options[0].form;
  const lv = run.charts[form];
  const ev = applyRun(run, { type: 'pick', index: 0 });
  assert.equal(run.charts[form], lv + 1);
  assert.ok(ev.some((e) => e.type === 'chart' && e.form === form));
  assert.ok(!run.consumables.some((c) => c.kind === 'chart'));
  assert.deepEqual(run.maxims[0].data, { n: 2 });
});

test('옛 저장: 두루마리 칸에 남은 기보는 눌러 쓴다', () => {
  const run = JSON.parse(JSON.stringify(shopRun(2)));
  run.consumables = [{ kind: 'chart', form: 'B' }];
  assert.ok(legalRunCommands(run).some((c) => c.type === 'use' && c.index === 0));
  const ev = applyRun(run, { type: 'use', index: 0 });
  assert.equal(run.charts.B, 1);
  assert.equal(run.consumables.length, 0);
  assert.ok(ev.some((e) => e.type === 'chart' && e.form === 'B' && e.level === 1));
});

test('소모품: 기보는 레벨을 올리고(기보 수집가 +1), 각인 두루마리는 주머니의 기물에', () => {
  const run = shopRun(2);
  run.maxims.push({ uid: 1, id: 'collector', data: {}, edition: null, paid: 7 });
  run.consumables = [{ kind: 'chart', form: 'N' }, { kind: 'engraving', id: 'ebony' }];
  applyRun(run, { type: 'use', index: 0 });
  assert.equal(run.charts.N, 1);
  assert.deepEqual(run.maxims[0].data, { n: 1 });
  const target = run.deck[5].id;
  assert.ok(legalRunCommands(run).some((c) => c.type === 'use' && c.index === 0 && c.target === target));
  applyRun(run, { type: 'use', index: 0, target });
  assert.deepEqual(run.deck[5].eng, { id: 'ebony' });
  assert.equal(run.consumables.length, 0);
  // 다음 대국에 기보 레벨과 격언 data가 들어간다
  applyRun(run, { type: 'leave' });
  applyRun(run, { type: 'play' });
  const charts = run.battle.mods.find((m) => m.id === 'charts');
  assert.equal(charts.data.levels.N, 1);
  assert.deepEqual(run.battle.mods.find((m) => m.id === 'collector').data, { n: 1 });
  assert.deepEqual(run.battle.bag.concat(run.battle.hand).find((p) => p.id === target).eng, { id: 'ebony' });
});

test('꾸러미: 3개 중 하나(기물은 주머니에, 기보는 곧바로, 각인은 대상을 골라), 넘길 수도', () => {
  const run = shopRun(3);
  run.money = 100;
  run.shop.packs = [{ kind: 'piece', price: 4, sold: false }, { kind: 'engraving', price: 4, sold: false }];
  applyRun(run, { type: 'buyPack', slot: 0 });
  assert.equal(run.phase, 'pack');
  assert.equal(run.pack.options.length, 3);
  assert.equal(run.money, 96);
  const t = run.pack.options[1].t;
  applyRun(run, { type: 'pick', index: 1 });
  assert.equal(run.deck.length, 9);
  assert.equal(run.deck.at(-1).t, t);
  assert.equal(run.phase, 'shop');
  applyRun(run, { type: 'buyPack', slot: 1 });
  const ids = run.pack.options.map((o) => o.id);
  assert.equal(new Set(ids).size, 3);
  const picks = legalRunCommands(run).filter((c) => c.type === 'pick');
  assert.equal(picks.length, 3 * run.deck.length);
  applyRun(run, { type: 'pick', index: 2, target: run.deck[0].id });
  assert.deepEqual(run.deck[0].eng, { id: ids[2] });
  assert.throws(() => applyRun(run, { type: 'buyPack', slot: 1 }), /no pack/);
  // 기보 꾸러미는 서로 다른 모습 셋, 넘기기
  run.shop.packs[0] = { kind: 'chart', price: 4, sold: false };
  applyRun(run, { type: 'buyPack', slot: 0 });
  assert.equal(new Set(run.pack.options.map((o) => o.form)).size, 3);
  applyRun(run, { type: 'skipPack' });
  assert.equal(run.phase, 'shop');
});

test('기물 조작: 승급(P→N/B→R→Q) · 빼기, 상점마다 한 번씩, 주머니는 여섯 밑으로 못 줄인다', () => {
  const run = shopRun(4);
  run.money = 100;
  const pawn = run.deck.find((p) => p.t === 'P');
  applyRun(run, { type: 'promote', pieceId: pawn.id, to: 'B' });
  assert.equal(pawn.t, 'B');
  assert.equal(run.money, 100 - SHOP.promotePrice);
  assert.throws(() => applyRun(run, { type: 'promote', pieceId: pawn.id, to: 'R' }), /already/);
  const rook = run.deck.find((p) => p.t === 'R');
  applyRun(run, { type: 'remove', pieceId: rook.id });
  assert.equal(run.deck.length, 7);
  assert.throws(() => applyRun(run, { type: 'remove', pieceId: run.deck[0].id }), /already/);
  run.shop.removed = false;
  run.deck = run.deck.slice(0, SHOP.deckMin);
  assert.throws(() => applyRun(run, { type: 'remove', pieceId: run.deck[0].id }), /too small/);
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'remove'));
});

// 패마다 받는 것은 test/skiptags.test.js
test('건너뛰기: 연습 · 정식은 다음 대국으로, 명인은 못 건넌다', () => {
  const run = createRun({ draft: false, seed: 5 });
  skipBlind(run);
  assert.equal(run.blind, 1);
  assert.equal(run.phase, 'select');
  skipBlind(run);
  assert.equal(run.blind, 2);
  assert.ok(!legalRunCommands(run).some((c) => c.type === 'skip'));
  assert.throws(() => applyRun(run, { type: 'skip' }), /master/);
});

test('격언 자리 바꾸기(침묵이 가장 왼쪽을 끈다)', () => {
  const run = createRun({ draft: false, seed: 1 });
  run.maxims = [{ uid: 1, id: 'edge', data: {} }, { uid: 2, id: 'center', data: {} }];
  applyRun(run, { type: 'moveMaxim', from: 0, to: 1 });
  assert.deepEqual(run.maxims.map((m) => m.uid), [2, 1]);
});

test('결정성: 같은 시드 + 같은 명령 = 같은 JSON', () => {
  const a = createRun({ draft: false, seed: 11 });
  const cmds = botCommands(a);
  const b = createRun({ draft: false, seed: 11 });
  for (const c of cmds) applyRun(b, c);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.log.length >= 3);
  // 다른 시드는 다른 판
  const c = createRun({ draft: false, seed: 12 });
  botCommands(c);
  assert.notEqual(JSON.stringify(c.log), JSON.stringify(a.log));
});

test('저장 왕복: 대국 중 · 상점 중에 JSON으로 저장했다 되살려 이어도 같다', () => {
  const a = createRun({ draft: false, seed: 21 });
  const cmds = botCommands(a);
  // 되살릴 자리: 첫 상점 한가운데, 둘째 대국부터 사슬 한가운데
  const replay = (n) => { const r = createRun({ draft: false, seed: 21 }); for (const c of cmds.slice(0, n)) applyRun(r, c); return r; };
  let midShop = -1, midBattle = -1;
  {
    const r = createRun({ draft: false, seed: 21 });
    let battles = 0;
    cmds.forEach((c, i) => {
      applyRun(r, c);
      if (midShop < 0 && r.phase === 'shop' && cmds[i + 1] && cmds[i + 1].type !== 'leave') midShop = i + 1;
      if (c.type === 'play') battles++;
      if (midBattle < 0 && battles >= 2 && r.phase === 'battle' && r.battle.status === 'chain') midBattle = i + 1;
    });
  }
  assert.ok(midShop > 0, 'found a mid-shop point');
  assert.ok(midBattle > 0, 'found a mid-battle point');
  for (const cut of [midShop, midBattle]) {
    const saved = JSON.stringify(replay(cut));
    const restored = JSON.parse(saved);
    for (const c of cmds.slice(cut)) applyRun(restored, c);
    assert.equal(JSON.stringify(restored), JSON.stringify(a));
  }
});

test('8관 명인을 이기면 판을 이기고, 끝없는 대국으로 이어 간다', () => {
  const run = createRun({ draft: false, seed: 7 });
  run.ante = 8; run.blind = 2;
  applyRun(run, { type: 'play' });
  assert.equal(run.battle.rules.kings, 2);
  run.battle.target = 1;
  finishBattle(run);
  assert.equal(run.phase, 'won');
  assert.deepEqual(legalRunCommands(run), [{ type: 'endless' }]);
  applyRun(run, { type: 'endless' });
  assert.equal(run.phase, 'shop');
  applyRun(run, { type: 'leave' });
  assert.equal(run.ante, 9);
  assert.equal(run.blind, 0);
  assert.ok(blindInfo(run).target > B[7]);
  assert.ok(blindInfo(run, 9, 2).master);
});

test('유리 기물이 깨지면 판의 주머니에서도 빠진다', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun({ draft: false, seed });
    for (const p of run.deck) p.eng = { id: 'glass' };
    applyRun(run, { type: 'play' });
    finishBattle(run);
    const gone = run.log.length && run.deck.length < 8;
    if (gone) return;
  }
  assert.fail('no glass piece broke in 40 battles');
});
