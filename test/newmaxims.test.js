// 밤샘 D-8 격언 여덟: 각각 정확한 점수
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { startChain, chainCapture, chainCaptures } from '../src/sim/chain.js';
import { MAXIMS } from '../src/data/maxims.js';

function chain(map, drop, at, caps, mods, extra = {}) {
  const t = { board: boardFrom(map), rules: {}, mods: mods.map((id) => ({ id })), chain: null, movesUsed: 0, ...extra };
  startChain(t, { type: drop, sq: S(at) });
  for (const c of caps) { if (t.chain.done) break; chainCapture(t, S(c)); }
  return t.chain;
}

test('격언은 마흔 · 새 여덟은 동사가 겹치지 않게 퍼졌다', () => {
  assert.equal(MAXIMS.length, 40);
  const ids = ['light_step', 'queen_hunt', 'bare_board', 'homecoming', 'collector_forms', 'reply_master', 'promotion_road', 'reinforce_hunt'];
  for (const id of ids) assert.ok(MAXIMS.find((m) => m.id === id), id);
});

test('가벼운 발: 폰 · 나이트로 떨군 사슬 연쇄 +3', () => {
  const c = chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['light_step']);
  assert.equal(c.score, 30 * (1 + 3));
  const d = chain({ e5: 'B', h8: 'R' }, 'B', 'c3', ['e5'], ['light_step']);
  assert.equal(d.mult, 1);
});

test('퀸 사냥: 퀸을 먹을 때마다 값 +60', () => {
  const c = chain({ e5: 'Q', a8: 'R' }, 'N', 'd3', ['e5'], ['queen_hunt']);
  assert.equal(c.value, 90 + 60);
});

test('빈 판: 적이 여덟 이하면 ×1.5', () => {
  const few = chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['bare_board']);
  assert.equal(few.score, Math.floor(30 * 1.5));
  const many = {};
  // e5 비숍 모습에서 닿지 않는 곳에 폰 열
  ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'h1', 'h3', 'h5'].forEach((s) => { many[s] = 'P'; });
  many.e5 = 'B';
  const lots = chain(many, 'N', 'd3', ['e5'], ['bare_board']);
  assert.equal(lots.score, 30);
});

test('되돌이: 떨군 모습으로 다시 갈아입으면 ×2(한 번)', () => {
  // N d3 → B e5 → N? e5 비숍에서 c7 나이트(대각) → 나이트로 되돌아옴
  const c = chain({ e5: 'B', c7: 'N', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], ['homecoming']);
  assert.equal(c.forms[0], 'N');
  assert.equal(c.score, Math.floor((30 + 30) * (2 * 2)));
});

test('모습 모으기: 처음 되는 모습마다 값 +20', () => {
  const c = chain({ e5: 'B', c7: 'N', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], ['collector_forms']);
  // B는 처음(+20), N은 떨군 모습이라 처음이 아니다
  assert.equal(c.value, 60 + 20);
});

test('응수의 달인: 응수로 먹을 때마다 연쇄 +2', () => {
  // N d3 → B e5, e5를 f6 폰이 노림 → 응수로 f6 먹기
  const c = chain({ e5: 'B', f6: 'P', a8: 'R' }, 'N', 'd3', ['e5', 'f6'], ['reply_master']);
  assert.equal(c.captures[1].forced, true);
  assert.equal(c.mult, 2 + 2);
});

test('승급의 길: 승급할 때마다 값 +80', () => {
  // 폰 모습으로 끝줄: B d6 떨굼 → c7 폰 먹기(폰 모습) → ... 간단히: 폰을 d6에 떨궈 e7 먹고 폰 모습 → f8 먹으면 승급
  const c = chain({ e7: 'P', f8: 'P', a1: 'R' }, 'P', 'd6', ['e7', 'f8'], ['promotion_road']);
  assert.equal(c.promotions, 1);
  assert.equal(c.value, 10 + 10 + 80);
});

test('증원 사냥: 들어온 적(born ≥ 0)을 먹을 때마다 연쇄 +2', () => {
  const t = { board: boardFrom({ e5: 'B', a8: 'R' }), rules: {}, mods: [{ id: 'reinforce_hunt' }], chain: null, movesUsed: 2 };
  t.board[S('e5')].born = 1;
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.mult, 1 + 2);
});

// ── 밤샘 D-2: 효과를 올린 넷
test('외통 사냥꾼: 킹 수비가 하나 적은 판', async () => {
  const { createBattle } = await import('../src/sim/battle.js');
  const { attackers } = await import('../src/sim/board.js');
  for (const ante of [1, 3]) {
    const b = createBattle({ seed: 4, ante, mods: [{ id: 'mate_hunter' }] });
    const plain = createBattle({ seed: 4, ante });
    assert.equal(b.rules.guards, plain.rules.guards == null ? (ante >= 3 ? 3 : 2) : plain.rules.guards - 1);
    const k = b.board.findIndex((c) => c && c.t === 'K');
    assert.ok(attackers(b.board, k).length >= b.rules.guards);
  }
});

test('왕의 목: 킹을 지키던 적을 먹으면 연쇄 +2', () => {
  // e5 비숍이 h8 킹을 지킨다(대각). N d3 → e5
  const c = chain({ e5: 'B', h8: 'K', a1: 'R' }, 'N', 'd3', ['e5'], ['kings_neck']);
  assert.equal(c.mult, 1 + 2);
  const d = chain({ e5: 'B', h7: 'K', a1: 'R' }, 'N', 'd3', ['e5'], ['kings_neck']);
  assert.equal(d.mult, 1);
});

test('다시 생각: 무르기 +1 · 무른 기물마다 값 +10', async () => {
  const { createBattle } = await import('../src/sim/battle.js');
  assert.equal(createBattle({ seed: 1, mods: [{ id: 'second_thought' }] }).discardsLeft, 4);
});

test('그림자 읽기: 증원이 올 칸에 떨구면 연쇄 +4', () => {
  const t = { board: boardFrom({ e5: 'B', a8: 'R' }), rules: {}, mods: [{ id: 'shadow_reading' }], chain: null, incoming: [{ sq: S('d3'), t: 'P' }], incomingNext: [] };
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.mult, 1 + 4);
  const u = { board: boardFrom({ e5: 'B', a8: 'R' }), rules: {}, mods: [{ id: 'shadow_reading' }], chain: null, incoming: [{ sq: S('h1'), t: 'P' }], incomingNext: [] };
  startChain(u, { type: 'N', sq: S('d3') });
  chainCapture(u, S('e5'));
  assert.equal(u.chain.mult, 1);
});
