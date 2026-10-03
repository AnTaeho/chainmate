// 다음 수(CHM-60, docs/design-notes/agency.md A): 보이는 둘(nextDraws) = 실제로 다음에 손에 들어오는 둘.
// 수 · 희생 · 손을 새로 쥠 · 다시 놓기 뒤에도, 주머니가 빌 때도, 저장 왕복 뒤에도.
// 봇(tools/bot.mjs)의 희생 판단도 아는 둘로 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/sim/run.js'; // 조정자 등록
import { createBattle, apply, legalCommands, nextDraws, NEXT_DRAWS, checkStuck, canReboard } from '../src/sim/battle.js';
import { decideBattle, sacrificeChoice } from '../tools/bot.mjs';
import { decisionCommands } from '../src/sim/replay.js';
import { bestPerPiece } from '../src/sim/solver.js';

const ids = (xs) => xs.map((p) => p.id);
// 명령 뒤 새로 손에 든 기물(차례대로)
const newIn = (before, after) => after.filter((p) => !before.some((q) => q.id === p.id)).map((p) => p.id);
// 결정 하나를 두고, 손을 새로 쥐지 않았으면 새로 든 기물이 보이던 둘의 앞머리인지 잰다
function checkedDecision(b, d) {
  const shown = ids(nextDraws(b)), hand = b.hand.slice();
  const ev = [];
  for (const c of decisionCommands(d)) ev.push(...apply(b, c));
  if (ev.some((e) => e.type === 'regrip')) return { regrip: true };
  const got = newIn(hand, b.hand);
  if (got.length <= NEXT_DRAWS) assert.deepEqual(got, shown.slice(0, got.length), `보이던 ${shown} · 들어온 ${got}`);
  return { got, shown };
}

test('보이는 둘은 주머니 맨 앞 둘이고, 셋째부터는 가린다', () => {
  const b = createBattle({ seed: 3, ante: 2 });
  assert.equal(NEXT_DRAWS, 2);
  assert.deepEqual(ids(nextDraws(b)), ids(b.bag.slice(0, 2)));
  assert.equal(nextDraws(b).length, 2);
});

test('수 하나를 두면 보이던 둘이 그 차례로 손에 들어온다', () => {
  let drew = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = createBattle({ seed, ante: 2, rules: { discards: 0, reboards: 0 } });
    const d = decideBattle(b);
    if (!d || !d.play) continue;
    const r = checkedDecision(b, d);
    if (r.got && r.got.length) drew++;
  }
  assert.ok(drew >= 6, `들어온 대국 ${drew}`);
});

test('희생하면 보이던 첫째가 들어오고, 보이는 둘이 한 칸 당겨진다', () => {
  const b = createBattle({ seed: 5, ante: 2 });
  const [a, c, third] = b.bag;
  apply(b, { type: 'discard', handIndices: [0] });
  assert.equal(b.hand.at(-1).id, a.id);
  assert.deepEqual(ids(nextDraws(b)), [c.id, third.id]);
  apply(b, { type: 'discard', handIndices: [0] });
  assert.equal(b.hand.at(-1).id, c.id);
});

test('다시 놓기는 판만 새로 깔고 보이는 둘은 그대로다', () => {
  const b = createBattle({ seed: 7, ante: 3 });
  assert.ok(canReboard(b));
  const before = ids(nextDraws(b));
  apply(b, { type: 'reboard' });
  assert.deepEqual(ids(nextDraws(b)), before);
  const d = decideBattle(b);
  if (d && d.play) checkedDecision(b, d);
});

test('손을 새로 쥐면 주머니가 다시 섞이고, 보이는 둘도 새 차례 그대로 들어온다', () => {
  // 막힘을 만든다: 떨굴 수 없는 손(무거운 손 규칙 + 퀸 · 룩만) · 희생 0
  const bag = ['Q', 'R', 'Q', 'R', 'N', 'N', 'B', 'P', 'P', 'N'];
  const b = createBattle({ seed: 11, ante: 2, bag, rules: { discards: 0, reboards: 0 } });
  b.rules.noHeavyDrop = true;
  b.hand = b.hand.filter((p) => p.t === 'Q' || p.t === 'R');
  b.bag = [...b.bag.filter((p) => p.t !== 'Q' && p.t !== 'R'), ...b.bag.filter((p) => p.t === 'Q' || p.t === 'R')];
  const ev = [];
  checkStuck(b, ev);
  assert.ok(ev.some((e) => e.type === 'regrip'), '손을 새로 쥐었다');
  assert.deepEqual(ids(nextDraws(b)), ids(b.bag.slice(0, 2)));
  const d = decideBattle(b);
  assert.ok(d && d.play, '새로 쥔 손으로 둘 수 있다');
  checkedDecision(b, d);
});

test('주머니가 비어 가면 보이는 둘이 하나 · 없음으로 준다', () => {
  // 주머니 다섯 = 손 넷 + 하나
  const b = createBattle({ seed: 2, ante: 1, bag: ['P', 'N', 'B', 'R', 'N'], rules: { discards: 0, reboards: 0 } });
  assert.equal(nextDraws(b).length, 1);
  const d = decideBattle(b);
  assert.ok(d && d.play);
  checkedDecision(b, d);
  if (b.status === 'play') assert.equal(nextDraws(b).length, 0);
  // 빈 주머니에서는 희생도 없다
  assert.ok(!legalCommands(b).some((c) => c.type === 'discard'));
});

test('저장 왕복: 같은 보이는 둘, 같은 명령이면 같은 기물이 들어온다', () => {
  const b = createBattle({ seed: 9, ante: 3 });
  const t = JSON.parse(JSON.stringify(b));
  assert.deepEqual(ids(nextDraws(t)), ids(nextDraws(b)));
  apply(b, { type: 'discard', handIndices: [1] });
  apply(t, { type: 'discard', handIndices: [1] });
  assert.deepEqual(ids(b.hand), ids(t.hand));
  assert.deepEqual(ids(nextDraws(t)), ids(nextDraws(b)));
});

test('대국 스무 판을 봇으로 끝까지: 매 결정마다 들어온 기물 = 보이던 둘의 앞머리', () => {
  let checked = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const b = createBattle({ seed, ante: 1 + (seed % 5), target: 400 + seed * 50 });
    for (let guard = 0; b.status === 'play' && guard < 30; guard++) {
      const d = decideBattle(b);
      if (!d) break;
      const r = checkedDecision(b, d);
      if (r.got) checked++;
    }
  }
  assert.ok(checked >= 40, `잰 결정 ${checked}`);
});

test('봇의 희생 판단은 보이는 첫째로 잰다: 주머니 맨 앞만 바꾸면 판단이 따라 바뀐다', () => {
  // 같은 판 · 같은 손에서 주머니 맨 앞이 폰일 때와 퀸일 때 견준다. 퀸이 오면 바칠 만하고, 폰이 오면 덜 바친다
  let differ = 0, seen = 0;
  for (let seed = 1; seed <= 40 && seen < 12; seed++) {
    const b = createBattle({ seed, ante: 3, bag: ['P', 'P', 'P', 'P', 'P', 'N', 'B', 'Q', 'P', 'P'] });
    const per = bestPerPiece(b, { preferMate: true });
    let best = null;
    for (const m of per) if (m && (!best || m.score > best.score)) best = m;
    if (!best || best.captures > 2) continue;
    seen++;
    const front = (t) => { const x = JSON.parse(JSON.stringify(b)); const i = x.bag.findIndex((p) => p.t === t); x.bag.unshift(...x.bag.splice(i, 1)); return x; };
    const q = sacrificeChoice(front('Q'), per.map((m) => (m ? m.score : null)), best);
    const p = sacrificeChoice(front('P'), per.map((m) => (m ? m.score : null)), best);
    if (!!q !== !!p || (q && p && q.gain !== p.gain)) differ++;
    if (q && p) assert.ok(q.gain >= p.gain, `seed ${seed}: 퀸이 오는 희생 이득 ${q.gain} < 폰 ${p.gain}`);
  }
  assert.ok(seen >= 6 && differ >= 1, `잰 판 ${seen} · 판단이 바뀐 판 ${differ}`);
});
