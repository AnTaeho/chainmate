// 봇의 희생 판단(CHM-51, tools/bot.mjs sacrificeChoice): 바치기 전 최선 사슬과 「바친 뒤 기대값」(주머니 구성으로 본
// 새로 뽑을 기물의 평균 사슬 − 바친 기물을 이 대국에 잃는 손해 − 희생 횟수를 보는 조정자가 덜어 갈 몫)을 견준다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/data/maxims.js';
import { boardFrom } from '../src/sim/board.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { decideBattle } from '../tools/bot.mjs';

const P = (t, id) => ({ t, id, eng: null });
// 적이 대각선 · 줄에 늘어선 판. 손 폰 넷은 저마다 하나만 먹는다(50). 주머니 구성만 바꿔 가며 잰다
const LINE = { a1: 'P', b2: 'N', c3: 'B', d4: 'R', e5: 'N', f6: 'B', g7: 'R' };
function scene(bag, { mods = [], map = LINE } = {}) {
  const b = createBattle({ seed: 3, target: 100000, mods });
  b.board = boardFrom(map);
  b.hand = ['P', 'P', 'P', 'P'].map((t, i) => P(t, i + 1));
  b.bag = bag.map((t, i) => P(t, i + 11));
  b.incoming = []; b.incomingNext = [];
  b.touched = true; // 다시 놓기 없이
  return b;
}

test('봇 희생: 주머니에서 뽑을 기물이 손보다 크게 이으면 약한 기물을 바친다', () => {
  const b = scene(['Q', 'Q', 'Q', 'Q']);
  const d = decideBattle(b);
  assert.ok(d.discard, JSON.stringify(d).slice(0, 120));
  assert.equal(d.discard.length, 1);
  assert.ok(d.gain > 0);
  apply(b, { type: 'discard', handIndices: d.discard }); // 실제 규칙으로 둘 수 있는 명령
  assert.equal(b.discardsUsed, 1);
});

test('봇 희생: 주머니가 손보다 나을 게 없으면 바치지 않는다', () => {
  const d = decideBattle(scene(['P', 'P', 'P', 'P']));
  assert.ok(d.play && !d.discard);
});

test('봇 희생: 격언 「뽑은 대로」(희생 없는 대국: 배수 +4)를 쥐면 그 손해까지 셈해 바치지 않는다', () => {
  assert.ok(decideBattle(scene(['N', 'N', 'N', 'N'])).discard, '격언 없이는 바친다');
  const d = decideBattle(scene(['N', 'N', 'N', 'N'], { mods: [{ id: 'no_regrets' }] }));
  assert.ok(d.play && !d.discard);
});

test('봇 희생: 뽑을 기물이 메이트를 낼 수 있으면(탁월수 기회) 바친다', () => {
  // 킹 h1: 손 폰은 킹에 닿지 않는다. 주머니의 퀸은 킹을 먹을 수 있다(넷에 하나)
  const map = { ...LINE, h1: 'K' };
  const no = decideBattle(scene(['P', 'P', 'P', 'P'], { map }));
  assert.ok(no.play && !no.play.mate);
  const d = decideBattle(scene(['Q', 'P', 'P', 'P'], { map }));
  assert.ok(d.discard, JSON.stringify(d).slice(0, 120));
});

test('봇 희생: 같은 대국이면 같은 답 · 판단이 대국 상태를 바꾸지 않는다', () => {
  const a = scene(['Q', 'N', 'P', 'B']), c = scene(['Q', 'N', 'P', 'B']);
  const before = JSON.stringify(a);
  const da = decideBattle(a), dc = decideBattle(c);
  assert.deepEqual(da, dc);
  assert.equal(JSON.stringify(a), before);
  assert.deepEqual(decideBattle(a), da);
});
