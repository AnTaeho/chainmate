// 깊이 B: 가족 여덟의 세기 · 문턱 · 효과
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { familyCounts, familyMods, levelOf, FAMILIES, MAXIM_FAMILIES } from '../src/data/families.js';
import { MAXIMS } from '../src/data/maxims.js';
import { battleMods, createRun } from '../src/sim/run.js';

const T = (map, fam, level, extra = {}) => ({ board: boardFrom(map), rules: {}, mods: [{ id: `family:${fam}`, data: { level } }], chain: null, ...extra });
const run = (t, type, sq, caps) => { startChain(t, { type, sq: S(sq) }); for (const c of caps) chainCapture(t, S(c)); return t.chain; };

test('격언 마흔 모두 가족이 있다 · 가족마다 격언이 셋 이상', () => {
  for (const m of MAXIMS) assert.ok(MAXIM_FAMILIES[m.id] && MAXIM_FAMILIES[m.id].length, m.id);
  for (const f of FAMILIES) assert.ok(Object.values(MAXIM_FAMILIES).filter((l) => l.includes(f.id)).length >= 3, f.id);
});

test('세기: 격언의 가족 + 주머니 이형 종류(같은 종류 여럿은 하나), 체스 기물은 세지 않는다', () => {
  const n = familyCounts({ maxims: [{ id: 'chivalry' }, { id: 'light_step' }], deck: [{ t: 'N' }, { t: 'L' }, { t: 'L' }, { t: 'V' }] });
  assert.equal(n.leap, 2 + 1 + 1);
  assert.equal(n.march, 1);
  assert.equal(n.diag, 1);
  assert.deepEqual([levelOf(1), levelOf(2), levelOf(5), levelOf(6), levelOf(3, 1)], [0, 1, 2, 3, 2]);
  assert.deepEqual(familyMods(n).map((m) => [m.id, m.data.level]), [['family:leap', 2]]);
});

test('판(런)의 대국에 켜진 가족이 들어간다', () => {
  const r = createRun({ draft: false, seed: 1 });
  r.maxims.push({ uid: 1, id: 'diagonal', data: {} }, { uid: 2, id: 'center', data: {} });
  assert.ok(battleMods(r).some((m) => m.id === 'family:diag' && m.data.level === 1));
});

test('도약: 뛰어서 먹으면 값 +20 · 6에 연쇄 ×1.5', () => {
  const c = run(T({ e6: 'B' }, 'leap', 3), 'N', 'd4', ['e6']);
  assert.equal(c.value, 30 + 20);
  assert.equal(c.mult, 1.5);
});

test('도약 4: 대국마다 첫 도약 뒤 노림을 한 번 무시한다', () => {
  const t = T({ e6: 'B', e8: 'R', a1: 'P' }, 'leap', 2);
  startChain(t, { type: 'N', sq: S('d4') });
  const ev = chainCapture(t, S('e6'));
  assert.ok(ev.some((e) => e.type === 'threatIgnored'));
  assert.equal(t.chain.forced, null);
});

test('직선: 세 칸 이상이면 연쇄 +2, 4에 칸마다 값 +10, 6에 그 너머 첫 적까지 꿰뚫는다', () => {
  const c = run(T({ d7: 'P', d8: 'N' }, 'line', 3), 'R', 'd2', ['d7']);
  assert.equal(c.pierced, 1);
  assert.equal(c.value, 10 + 50 + 30, '폰 10 + 칸 다섯 × 10 + 꿰뚫은 나이트 30');
  assert.equal(c.mult, 1 + 2 + 1);
});

test('대각: 값 +15, 4에 연쇄 +2', () => {
  const c = run(T({ f6: 'N' }, 'diag', 2), 'B', 'd4', ['f6']);
  assert.equal(c.value, 45);
  assert.equal(c.mult, 3);
});

test('변신: 바뀔 때마다 연쇄 +2, 4에 모습 종류 수의 절반만큼 ×, 6에 막히면 지나온 모습 전부로 한 번 더', () => {
  // N d4 → e6(B) → c8(R)... 막힌 뒤 나이트 행마로 b6
  const t = T({ e6: 'B', c8: 'R', a6: 'P' }, 'change', 3);
  startChain(t, { type: 'N', sq: S('d4') });
  chainCapture(t, S('e6'));
  chainCapture(t, S('c8'));
  assert.ok(!t.chain.done, '룩 모습으로는 a6에 닿지 않지만 지나온 비숍 행마로 잇는다');
  assert.deepEqual(chainCaptures(t), [S('a6')]);
  assert.equal(t.chain.mult, 2 + 2 + 2);
});

test('희생: 끊긴 사슬 값 ×2, 4에 대국마다 첫 끊김을 넘긴다, 6에 끊길 때마다 연쇄 ×2', () => {
  const t = T({ e6: 'P', e8: 'R' }, 'sacrifice', 3);
  startChain(t, { type: 'B', sq: S('c4') });
  const ev = chainCapture(t, S('e6'));
  assert.ok(ev.some((e) => e.type === 'cutIgnored'), '첫 끊김은 넘긴다');
  assert.equal(t.chain.mult, 2, '끊길 때마다 ×2');
  const t2 = T({ e6: 'P', e8: 'R' }, 'sacrifice', 1);
  startChain(t2, { type: 'B', sq: S('c4') });
  chainCapture(t2, S('e6'));
  assert.equal(t2.chain.reason, 'cut');
  assert.equal(t2.chain.value, 20);
});

test('왕관: 퀸을 먹으면 값 +60 · 4에 승급 칸이 한 줄 앞', () => {
  const c = run(T({ e6: 'Q' }, 'crown', 1), 'N', 'd4', ['e6']);
  assert.equal(c.value, 150);
  const t = T({ c7: 'P' }, 'crown', 2);
  startChain(t, { type: 'N', sq: S('b5') });
  chainCapture(t, S('c7'));
  assert.equal(t.chain.promotions, 1, '폰 모습으로 7번째 줄에서 승급');
});

test('행진: 폰으로 떨군 사슬 배수 +3, 폰 모습 먹기 +2, 6에 ×3', () => {
  const c = run(T({ e5: 'N' }, 'march', 3), 'P', 'd4', ['e5']);
  assert.equal(c.value, 30);
  assert.equal(c.mult, (1 + 2 + 3) * 3, '폰 모습으로 먹어 +2, 폰으로 떨궈 +3 · ×3');
});

test('사냥: 같은 종류를 잇달아 먹으면 값 +30, 4에 판에서 가장 비싼 적을 먹으면 연쇄 +4', () => {
  const c = run(T({ e6: 'N', f8: 'N', a1: 'P' }, 'hunt', 2), 'N', 'd4', ['e6', 'f8']);
  assert.equal(c.value, 30 + 30 + 30);
  assert.ok(c.mult >= 2 + 4);
});
