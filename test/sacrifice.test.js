// 희생 · 탁월수 !!(CHM-35, docs/design-notes/sacrifice.md 「바뀐 설계」).
// 희생: 손 기물 하나를 바치고 새로 뽑는다. 바친 기물은 이번 대국 동안 돌아오지 않는다. 평소엔 몫이 없다.
// 탁월수: 희생으로 새로 뽑은 기물로 시작한 바로 다음 사슬이 체크메이트로 끝나면 마지막 배수 ×(1 + 바친 무게 합).
// 명령 id는 옛 이름 discard 그대로다(옛 저장과 맞추려고).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { bestMove, previewDrop } from '../src/sim/solver.js';
import { createRun, applyRun, DANS } from '../src/sim/run.js';
import { SACRIFICE_WEIGHT, brilliantMult, addOffering } from '../src/data/sacrifice.js';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { MASTER_BY_ID } from '../src/data/masters.js';
import { FAMILIES } from '../src/data/families.js';
import { emptyRecords, observe } from '../src/ui/records.js';
import { decideBattle } from '../tools/bot.mjs';
import { setLang, L } from '../src/ui/lang.js';
const tr = (s) => { setLang('en'); try { return L(s); } finally { setLang('ko'); } };

const P = (t, id) => ({ t, id, eng: null });
// 판: map(적). 손 N R P Q, 주머니 P 넷. 나이트 d3 → e5를 먹는다
function scene(map, extra = {}) {
  const b = createBattle({ seed: 3, ...extra });
  b.board = boardFrom(map);
  b.hand = [P('N', 1), P('R', 2), P('P', 3), P('Q', 4)];
  b.bag = [5, 6, 7, 8].map((id) => P('P', id));
  b.incoming = []; b.incomingNext = [];
  return b;
}
const KING = { e5: 'K' };   // 나이트로 킹을 먹으면 체크메이트: 값 150 · 배수 1
const BISHOP = { e5: 'B', h1: 'K' }; // 비숍을 먹고 막힘: 값 30 · 배수 1(킹은 비숍 모습이 닿지 않는 h1에 남는다)
const play = (b, id = null) => {
  const handIndex = id == null ? 0 : b.hand.findIndex((p) => p.id === id);
  apply(b, { type: 'drop', handIndex, sq: S('d3') });
  return apply(b, { type: 'capture', sq: S('e5') });
};
// 탁월수 장면: 손 Q R P P(나이트 없음), 주머니 맨 위 N(id 5) — 퀸을 바치면 나이트를 뽑는다
function gamble(extra = {}) {
  const b = scene(KING, extra);
  b.hand = [P('Q', 4), P('R', 2), P('P', 3), P('P', 10)];
  b.bag = [P('N', 5), P('P', 6), P('P', 7), P('P', 8)];
  return b;
}

test('희생: 바친 기물은 이번 대국에 돌아오지 않고 새로 뽑는다 · 몫은 없다', () => {
  const b = scene(BISHOP);
  apply(b, { type: 'discard', handIndices: [1] });
  assert.equal(b.discardsLeft, 2);
  assert.equal(b.discarded, 1);
  assert.deepEqual(b.offered.map((p) => p.id), [2]);
  assert.deepEqual(b.used, []);
  assert.equal(b.hand.length, 4);
  assert.deepEqual(b.offering, { weight: 3, count: 1, pieces: ['R'], drawn: [5] });
  play(b);
  assert.equal(b.score, 30, '체크메이트가 아니면 몫이 없다');
  assert.equal(b.offering, null, '바로 다음 수가 끝나면 비운다');
  assert.ok(![...b.hand, ...b.bag, ...b.used].some((p) => p.id === 2), '바친 룩은 대국 안에 다시 오지 않는다');
});

test('희생 횟수: 대국마다 3번, 다 쓰면 거부', () => {
  const b = scene(BISHOP);
  assert.equal(b.discardsLeft, 3);
  for (let i = 0; i < 3; i++) apply(b, { type: 'discard', handIndices: [3] });
  assert.throws(() => apply(b, { type: 'discard', handIndices: [3] }), /no discards left/);
  assert.equal(b.offering.count, 3);
});

test('탁월수: 희생으로 새로 뽑은 기물로 시작한 다음 사슬이 체크메이트면 마지막 배수 ×(1 + 무게), 사건 brilliant', () => {
  const plain = scene(KING);
  play(plain);
  assert.equal(plain.status, 'won');
  assert.equal(plain.score, 150);
  assert.equal(plain.brilliants, undefined);

  const b = gamble();
  apply(b, { type: 'discard', handIndices: [0] }); // 퀸(무게 5) → 나이트를 뽑는다
  assert.deepEqual(b.offering.drawn, [5]);
  const ev = play(b, 5);
  const x = brilliantMult(SACRIFICE_WEIGHT.Q);
  assert.equal(b.score, Math.floor(150 * x));
  const br = ev.find((e) => e.type === 'brilliant');
  assert.deepEqual({ weight: br.weight, x: br.x, pieces: br.pieces, score: br.score }, { weight: 5, x, pieces: ['Q'], score: b.score });
  assert.ok(ev.some((e) => e.type === 'score' && e.src === 'brilliant' && e.xmult === x));
  assert.equal(b.brilliants.length, 1);
});

test('탁월수가 아니다: 바치기 전부터 손에 있던 기물로 체크메이트', () => {
  const b = scene(KING); // 손에 나이트가 이미 있다
  apply(b, { type: 'discard', handIndices: [3] }); // 퀸을 바치고 폰을 뽑는다
  play(b, 1);
  assert.equal(b.status, 'won');
  assert.equal(b.score, 150);
  assert.equal(b.brilliants, undefined);
});

test('탁월수: 여러 번 바치면 새로 뽑은 것 중 하나로 시작하면 되고, 무게를 더한다', () => {
  const b = gamble();
  apply(b, { type: 'discard', handIndices: [0] }); // Q 5 → N(5)
  apply(b, { type: 'discard', handIndices: [0] }); // R 3 → P(6)
  assert.deepEqual(b.offering.drawn, [5, 6]);
  play(b, 5);
  assert.equal(b.score, Math.floor(150 * brilliantMult(8)));
  assert.equal(b.brilliants[0].weight, 8);
});

test('미리 보기 · 풀이기: 기다리는 희생을 본다(새로 뽑은 기물의 체크메이트 줄 점수에 탁월수가 든다)', () => {
  const b = gamble();
  apply(b, { type: 'discard', handIndices: [0] });
  const pv = previewDrop(b, b.hand.findIndex((p) => p.id === 5), S('d3'));
  assert.equal(pv.offering.weight, 5);
  assert.deepEqual(pv.next, [S('e5')]);
  const m = bestMove(b);
  assert.ok(m.mate);
  assert.equal(m.score, Math.floor(150 * brilliantMult(5)));
});

test('봇: 탁월수를 노리지 않는다 — 체크메이트가 보이면 곧바로 둔다', () => {
  const b = scene(KING);
  b.target = 10000;
  assert.ok(decideBattle(b).play.mate);
});

test('저장 왕복: 기다리는 희생이 있는 대국을 JSON으로 되살려도 같다 · 희생 전 옛 저장도 돈다', () => {
  const a = gamble();
  apply(a, { type: 'discard', handIndices: [0] });
  const b = JSON.parse(JSON.stringify(a));
  play(a, 5); play(b, 5);
  assert.equal(JSON.stringify(a), JSON.stringify(b));

  const old = JSON.parse(JSON.stringify(gamble()));
  delete old.offering; delete old.offered;
  apply(old, { type: 'discard', handIndices: [0] });
  assert.equal(old.offered.length, 1);
  play(old, 5);
  assert.equal(old.brilliants.length, 1);
  assert.deepEqual(addOffering(null, 'P'), { weight: 1, count: 1, pieces: ['P'], drawn: [] });
});

test('기록: 탁월수 수와 가장 큰 탁월수', () => {
  const rec = emptyRecords();
  observe(rec, null, [{ type: 'brilliant', weight: 2, x: 3, pieces: ['N'], score: 900 }]);
  observe(rec, null, [{ type: 'brilliant', weight: 5, x: 6, pieces: ['Q'], score: 5400 }, { type: 'brilliant', weight: 1, x: 2, pieces: ['P'], score: 100 }]);
  assert.equal(rec.brilliants, 3);
  assert.deepEqual(rec.bestBrilliant, { score: 5400, weight: 5, pieces: ['Q'], ante: null });
});

test('격언 셋: 뽑은 대로 · 미련 없이 · 절약', () => {
  assert.equal(MAXIM_BY_ID.no_regrets.text, '희생 없는 대국: 배수 +4');
  assert.equal(MAXIM_BY_ID.second_thought.text, '희생 +1 · 탁월수: 배수 ×2');
  assert.equal(MAXIM_BY_ID.thrift.text, '대국을 이기면 남은 희생마다 상금 +1');

  // 뽑은 대로: 희생하면 배수 +4를 잃는다
  const keep = scene(BISHOP, { mods: [{ id: 'no_regrets' }] });
  play(keep);
  assert.equal(keep.score, 30 * 5);
  const gave = scene(BISHOP, { mods: [{ id: 'no_regrets' }] });
  apply(gave, { type: 'discard', handIndices: [3] });
  play(gave);
  assert.equal(gave.score, 30);

  // 미련 없이: 희생 +1, 탁월수면 배수 ×2 더(체크메이트가 아니면 없다)
  const st = gamble({ mods: [{ id: 'second_thought' }] });
  assert.equal(st.discardsLeft, 4);
  apply(st, { type: 'discard', handIndices: [2] }); // 폰 1 → 나이트
  play(st, 5);
  assert.equal(st.score, Math.floor(150 * 2 * brilliantMult(1)));
  // 손에 있던 기물의 메이트는 탁월수가 아니라 ×2도 없다
  const st3 = scene(KING, { mods: [{ id: 'second_thought' }] });
  apply(st3, { type: 'discard', handIndices: [2] });
  play(st3, 1);
  assert.equal(st3.score, 150);
  const st2 = scene(BISHOP, { mods: [{ id: 'second_thought' }] });
  apply(st2, { type: 'discard', handIndices: [2] });
  play(st2);
  assert.equal(st2.score, 30);

  // 절약: 이긴 대국의 남은 희생마다 상금 +1
  const th = scene(BISHOP, { mods: [{ id: 'thrift' }], target: 10 });
  apply(th, { type: 'discard', handIndices: [3] });
  play(th);
  assert.equal(th.status, 'won');
  assert.equal(th.money, 2);
});

test('마스터 모래시계: 수 2 · 희생 1', () => {
  assert.equal(MASTER_BY_ID.hourglass.text, '수 2 · 희생 1뿐');
  const b = createBattle({ seed: 1, mods: [{ id: 'hourglass', kind: 'master' }] });
  assert.equal(b.movesLeft, 2);
  assert.equal(b.discardsLeft, 1);
});

test('레이팅 계단: 6단(레이팅 2000)부터 희생 −1', () => {
  assert.equal(DANS.find((d) => d.n === 6).text, '희생 −1');
  const r5 = createRun({ draft: false, seed: 9, dan: 5 }); applyRun(r5, { type: 'play' });
  assert.equal(r5.battle.discardsLeft, 3);
  const r6 = createRun({ draft: false, seed: 9, dan: 6 }); applyRun(r6, { type: 'play' });
  assert.equal(r6.battle.discardsLeft, 2);
});

test('이름: 시너지 「희생」은 「불굴」(Resolve), 행동은 「희생」(Sacrifice), 탁월수는 Brilliant', () => {
  const fam = FAMILIES.find((f) => f.id === 'sacrifice');
  assert.equal(fam.name, '불굴');
  assert.ok(!FAMILIES.some((f) => f.name === '희생'));
  assert.equal(tr('불굴'), 'Resolve');
  assert.equal(tr('희생'), 'Sacrifice');
  assert.equal(tr('탁월수'), 'Brilliant');
  assert.equal(tr('불굴 시너지'), 'Resolve synergy');
  assert.equal(tr('희생 −1'), '−1 Sacrifice');
});
