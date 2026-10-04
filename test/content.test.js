// 격언 32 · 각인 6 · 명인 8 · 기보: 손으로 짠 장면에서 정확한 점수 변화를 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEW_MAXIMS } from './helpers/maxims.js';
import { boardFrom, parseSq as S, isEnemy } from '../src/sim/board.js';
import { startChain, chainCapture, chainCaptures } from '../src/sim/chain.js';
import { createBattle, apply, legalCommands, refreshHints, visibleIncoming, isHidden } from '../src/sim/battle.js';
import { bestMove } from '../src/sim/solver.js';
import { MAXIMS } from '../src/data/maxims.js';
import { ENGRAVINGS } from '../src/data/engravings.js';
import { MASTERS } from '../src/data/masters.js';
import { CHART_TABLE } from '../src/data/charts.js';
import { getModifier } from '../src/sim/scoring.js';

// 장면: 판 · 떨굴 기물과 칸 · 먹는 순서. extra는 대국 쪽 값(movesUsed 등).
const SCENES = {
  // 나이트 d3 → e5 비숍(가운데 칸). 값 30 · 연쇄 1 = 30, 갈아입기 1, 막힘으로 끝
  knight: { map: { e5: 'B' }, drop: ['N', 'd3'], line: ['e5'] },
  // 폰 b4 → c5 폰. 10, 모습 그대로
  pawn: { map: { c5: 'P' }, drop: ['P', 'b4'], line: ['c5'] },
  // 퀸 h1 → h5 룩: 4칸 미끄러짐, 가장자리. 50
  rook: { map: { h5: 'R' }, drop: ['Q', 'h1'], line: ['h5'] },
  // 폰 c7 → d8 폰: 승급. 10
  promote: { map: { d8: 'P' }, drop: ['P', 'c7'], line: ['d8'] },
  // 나이트 d4 → f5 퀸: 퀸으로 갈아입기. 90
  toQueen: { map: { f5: 'Q' }, drop: ['N', 'd4'], line: ['f5'] },
  // 긴 외통 사슬: N c3 → B d5 → Q g8(응수) → P g7 → P f8(승급) → R a8 → K a4. 값 340 · 연쇄 6 = 2040
  mate: { map: { d5: 'B', g8: 'Q', g7: 'P', f8: 'P', a8: 'R', a4: 'K', f3: 'P' }, drop: ['N', 'c3'], line: ['d5', 'g8', 'g7', 'f8', 'a8', 'a4'] },
  // 끊김: N d3 → R e5, g6 나이트가 노림 → 룩 모습으로 못 먹어 끊김. 50
  cut: { map: { e5: 'R', g6: 'N', b5: 'P' }, drop: ['N', 'd3'], line: ['e5'] },
  // 승급 뒤 끊김: P c7 → d8(승급 퀸), e6 나이트가 노림. 넘기면 h4 폰까지
  promoCut: { map: { d8: 'P', e6: 'N', h4: 'P' }, drop: ['P', 'c7'], line: ['d8'] },
};

function play(sceneName, mods = [], extra = {}, engraving = null, more = []) {
  const sc = SCENES[sceneName];
  const t = { board: boardFrom(sc.map), rules: {}, mods: JSON.parse(JSON.stringify(mods)), chain: null, ...extra };
  if (extra.bornAt) for (const [sq, born] of Object.entries(extra.bornAt)) t.board[S(sq)].born = born;
  let ev = startChain(t, { type: sc.drop[0], sq: S(sc.drop[1]), engraving });
  for (const sq of [...sc.line, ...more]) ev = chainCapture(t, S(sq));
  assert.ok(t.chain.done, `${sceneName}: chain should be done`);
  return { ...ev.at(-1), chain: t.chain, mods: t.mods };
}

test('장면 기준값(조정자 없음)', () => {
  const base = (n) => { const e = play(n); return [e.value, e.mult, e.score, e.reason]; };
  assert.deepEqual(base('knight'), [30, 1, 30, 'blocked']);
  assert.deepEqual(base('pawn'), [10, 1, 10, 'blocked']);
  assert.deepEqual(base('rook'), [50, 1, 50, 'blocked']);
  assert.deepEqual(base('promote'), [10, 1, 10, 'blocked']);
  assert.deepEqual(base('toQueen'), [90, 1, 90, 'blocked']);
  assert.deepEqual(base('mate'), [340, 6, 2040, 'mate']);
  assert.deepEqual(base('cut'), [50, 1, 50, 'cut']);
  assert.deepEqual(base('promoCut'), [10, 1, 10, 'cut']);
});

// [격언, 장면, 기대 점수, (선택) extra, (선택) 기대 상금, (선택) 넘긴 뒤 이어 먹을 칸]
const CASES = [
  ['chivalry', 'knight', 45],
  ['chivalry', 'pawn', 10],
  ['pawn_march', 'pawn', 50],
  ['pawn_march', 'knight', 30],
  ['quick_change', 'knight', 90],
  ['quick_change', 'mate', 340 * 14],
  ['whim', 'mate', 4080],
  ['whim', 'knight', 30],
  ['steadfast', 'pawn', 30],
  ['steadfast', 'knight', 30],
  ['steadfast', 'promote', 10], // 승급도 모습이 바뀐 것
  ['coronation', 'toQueen', 140],
  ['coronation', 'promote', 60],
  ['coronation', 'mate', 440 * 6], // 퀸으로 갈아입기 + 승급
  ['low_stance', 'pawn', 40],
  ['low_stance', 'mate', 340 * 9], // f8을 폰 모습으로 먹음
  ['diagonal', 'mate', 365 * 6], // g8을 비숍 모습으로 먹음
  ['diagonal', 'knight', 30],
  ['wall_breaker', 'rook', 250],
  ['wall_breaker', 'mate', 340 * 10],
  ['long_chain', 'mate', 2856], // 다섯째 ×1.2(5→6), 여섯째 +1 뒤 ×1.2(7→8.4)
  ['long_chain', 'knight', 30],
  ['long_road', 'rook', 70],
  ['long_road', 'knight', 30],
  ['edge', 'rook', 150],
  ['edge', 'knight', 30],
  ['center', 'knight', 45],
  ['center', 'rook', 50],
  ['vault', 'knight', 30, {}, 1],
  ['vault', 'mate', 2040, {}, 5],
  ['promotion_feast', 'promote', 20],
  ['promotion_feast', 'mate', 3400], // 넷째 먹기 뒤 4→8
  ['payback', 'cut', 450],
  ['payback', 'knight', 30],
  ['close_call', 'knight', 60],
  ['close_call', 'cut', 50],
  ['close_call', 'mate', 370 * 6],
  ['mate_hunter', 'mate', 2040, {}, 6],
  ['mate_hunter', 'knight', 30, {}, 0],
  ['kings_neck', 'mate', 8160], // a8 룩이 a4 킹을 지키고 있었다: 연쇄 +2, 사슬 끝 ×3
  ['kings_neck', 'knight', 30],
  ['first_move', 'knight', 60, { movesUsed: 0 }],
  ['first_move', 'knight', 30, { movesUsed: 1 }],
  ['last_move', 'knight', 90, { movesLeft: 1 }],
  ['last_move', 'knight', 30, { movesLeft: 2 }],
  ['no_regrets', 'knight', 150, { discardsUsed: 0 }],
  ['no_regrets', 'knight', 30, { discardsUsed: 1 }],
  // 탁월수(희생한 바로 다음 사슬이 체크메이트): 배수 ×2 — 무게 0으로 두어 탁월수 배수는 빼고 잰다
  ['second_thought', 'mate', 2040, { offering: { weight: 0, count: 1, drawn: [] } }],
  ['second_thought', 'knight', 30, { discarded: 3 }],
  ['empty_bag', 'knight', 180, { bag: [1, 2, 3, 4, 5] }],
  ['small_bag', 'knight', 45, { deckSize: 8 }],
  ['small_bag', 'knight', 30, { deckSize: 9 }],
  ['welcome', 'knight', 70, { movesUsed: 2, bornAt: { e5: 2 } }],
  ['welcome', 'knight', 30, { movesUsed: 2, bornAt: { e5: 1 } }],
  ['shadow_reading', 'knight', 30],
  ['ivory_tower', 'knight', 30], // 상아 각인이 없으면 그대로
];

for (const [id, scene, score, extra = {}, money, more] of CASES) {
  test(`격언 ${id} · ${scene} → ${score}`, () => {
    const e = play(scene, [{ id }], extra, null, more);
    assert.equal(e.score, score);
    if (money != null) assert.equal(e.money, money);
  });
}

test('격언 70종 모두 장면 검사가 있다', () => {
  assert.equal(MAXIMS.length, 70);
  const covered = new Set(CASES.map((c) => c[0]));
  for (const id of ['sacrifice', 'back_rank_dream', 'memory', 'collector', 'ivory_tower', 'kings_neck', 'shadow_reading']) covered.add(id);
  // 밤샘 D-8의 여덟은 test/newmaxims.test.js
  for (const id of ['light_step', 'queen_hunt', 'bare_board', 'homecoming', 'collector_forms', 'reply_master', 'promotion_road', 'reinforce_hunt']) covered.add(id);
  // 깊이 G의 셋도 test/newmaxims.test.js
  for (const id of ['promotion_rush', 'mad_horse', 'rook_lift']) covered.add(id);
  // 밤샘 2의 스물일곱은 test/expansion.test.js
  for (const id of NEW_MAXIMS) covered.add(id);
  for (const m of MAXIMS) assert.ok(covered.has(m.id), m.id);
  for (const m of MAXIMS) {
    assert.ok(['common', 'uncommon', 'rare'].includes(m.rarity), m.id);
    assert.ok(m.price >= 3 && m.price <= 8, m.id);
    assert.ok(m.name && m.text && !/엔진|스폰|버프|트리거|시뮬/.test(m.text), m.id);
  }
});

test('희생: 대국마다 첫 끊김만 넘긴다(대국 state)', () => {
  const e = play('cut', [{ id: 'sacrifice' }], {}, null, ['b5']);
  assert.equal(e.score, 120); // 룩 50 + 폰 10, 연쇄 2
  assert.deepEqual(e.mods[0].state, { used: true });
  // 같은 대국 state로 한 번 더: 이번엔 끊긴다
  const t = { board: boardFrom(SCENES.cut.map), rules: {}, mods: e.mods, chain: null };
  startChain(t, { type: 'N', sq: S('d3') });
  const ev = chainCapture(t, S('e5'));
  assert.equal(ev.at(-1).reason, 'cut');
});

test('끝줄의 꿈: 승급한 사슬의 끊김을 한 번 넘긴다', () => {
  assert.equal(play('promoCut').reason, 'cut');
  const e = play('promoCut', [{ id: 'back_rank_dream' }], {}, null, ['h4']);
  assert.equal(e.score, 40); // 폰 10 + 폰 10, 연쇄 2
  // 승급 없는 끊김은 그대로
  assert.equal(play('cut', [{ id: 'back_rank_dream' }]).score, 50);
});

test('대국의 기억: 판에 쌓인 외통 수만큼 ×(1 + 0.5n), 판(런)이 data를 올린다', () => {
  const spec = { id: 'memory', data: {} };
  assert.equal(play('knight', [spec]).score, 30);
  const def = getModifier('memory');
  def.onRunEvent(spec, { type: 'battleWon', reason: 'score' });
  assert.deepEqual(spec.data, {});
  def.onRunEvent(spec, { type: 'battleWon', reason: 'mate' });
  def.onRunEvent(spec, { type: 'battleWon', reason: 'mate' });
  assert.deepEqual(spec.data, { mates: 2 });
  assert.equal(play('knight', [spec]).score, 60);
});

test('기보 수집가: 기보를 쓸 때마다 연쇄 +1 영구', () => {
  const spec = { id: 'collector', data: {} };
  assert.equal(play('knight', [spec]).score, 30);
  for (let i = 0; i < 3; i++) getModifier('collector').onRunEvent(spec, { type: 'chartUsed', form: 'N' });
  assert.equal(play('knight', [spec]).score, 120);
});

test('상아탑: 상아 기물로 떨군 사슬 연쇄 +5(상아 값 +30과 함께)', () => {
  const e = play('knight', [{ id: 'ivory_tower' }], {}, { id: 'ivory' });
  assert.equal(e.value, 60);
  assert.equal(e.mult, 6);
  assert.equal(e.score, 360);
});

test('왕의 목: 지키는 이 없는 킹을 hints.openKings로 알린다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'kings_neck' }] });
  assert.deepEqual(b.hints.openKings, []);
  b.board = boardFrom({ e5: 'K', a1: 'P', h8: 'R' });
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, [S('e5')]);
  b.board = boardFrom({ e5: 'K', d6: 'P' });
  refreshHints(b);
  assert.deepEqual(b.hints.openKings, []);
  const plain = createBattle({ seed: 1 });
  assert.equal(plain.hints.openKings, undefined);
});

test('그림자 읽기: 증원 두 수 앞이 보인다, 뽑기는 같다(같은 시드 같은 판)', () => {
  const a = createBattle({ seed: 7, ante: 3 });
  const b = createBattle({ seed: 7, ante: 3, mods: [{ id: 'shadow_reading' }] });
  assert.deepEqual(a.board, b.board);
  assert.deepEqual(a.incoming, b.incoming);
  assert.deepEqual(a.incomingNext, b.incomingNext);
  assert.equal(visibleIncoming(a).length, 1);
  assert.equal(visibleIncoming(b).length, 2);
  assert.equal(b.incomingNext.length, 2);
  // 한 수 두면 그다음 예고가 앞으로 당겨진다
  const planned = b.incomingNext.map((x) => x.sq);
  const m = bestMove(b);
  apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq });
  for (const sq of m.line) apply(b, { type: 'capture', sq });
  if (b.status === 'play') assert.deepEqual(b.incoming.map((x) => x.sq), planned);
});

// ── 각인
test('각인: 금 상금 +2 · 상아 값 +30 · 흑단 ×1.5 · 유리 ×2', () => {
  assert.equal(play('knight', [], {}, { id: 'gold' }).money, 2);
  assert.equal(play('knight', [], {}, { id: 'ivory' }).score, 60);
  assert.equal(play('knight', [], {}, { id: 'ebony' }).score, 45);
  assert.equal(play('knight', [], {}, { id: 'glass' }).score, 60);
  assert.equal(ENGRAVINGS.length, 12);
});

test('각인 은: 첫 먹기의 끊김만 넘긴다', () => {
  const e = play('cut', [], {}, { id: 'silver' }, ['b5']);
  assert.equal(e.score, 120);
  // 둘째 먹기에서 난 끊김은 그대로 끊긴다
  const t = { board: boardFrom({ d5: 'B', e6: 'R', g7: 'N' }), rules: {}, mods: [], chain: null };
  startChain(t, { type: 'N', sq: S('c3'), engraving: { id: 'silver' } });
  chainCapture(t, S('d5')); // 비숍 모습, e6 룩이 노리지 않음(대각 아님) → 이어짐
  const ev = chainCapture(t, S('e6')); // 룩 모습 e6, g7 나이트가 노림 → 둘째 먹기라 끊김
  assert.equal(ev.at(-1).reason, 'cut');
});

test('각인 유리: 대국 흐름에서 1/4로 깨져 shattered에 남는다', () => {
  let broke = 0, kept = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const b = createBattle({ seed });
    b.board = boardFrom({ e5: 'B', a8: 'R', h1: 'R' });
    b.hand = [{ t: 'N', id: 1, eng: { id: 'glass' } }];
    apply(b, { type: 'drop', handIndex: 0, sq: S('d3') });
    apply(b, { type: 'capture', sq: S('e5') });
    assert.equal(b.score, 60);
    if (b.shattered.includes(1)) { broke++; assert.ok(!b.used.some((p) => p.id === 1)); assert.equal(b.deckSize, 7); } else kept++;
  }
  assert.ok(broke > 30 && broke < 70, `broke ${broke}`);
  assert.ok(kept > 0);
});

// ── 명인
test('명인 8: 철벽 · 모래시계 · 무거운 손 · 대가', () => {
  assert.equal(MASTERS.length, 8);
  const iron = createBattle({ seed: 1, mods: [{ id: 'iron_wall' }] });
  assert.equal(iron.rules.noReply, true);
  assert.equal(createBattle({ seed: 1, mods: [{ id: 'hourglass' }] }).movesLeft, 2);
  assert.equal(createBattle({ seed: 1, mods: [{ id: 'heavy_hand' }] }).rules.noHeavyDrop, true);
  const gm = createBattle({ seed: 3, ante: 8, mods: [{ id: 'grandmaster' }, { id: 'charts', data: { table: CHART_TABLE, levels: { N: 5 } } }] });
  assert.equal(gm.board.filter((c) => isEnemy(c) && c.t === 'K').length, 2);
  assert.equal(gm.mods[1].off, undefined);
});

test('꺼진 기보(off)는 레벨이 듣지 않는다', () => {
  const charts = { id: 'charts', data: { table: CHART_TABLE, levels: { N: 2 } } };
  assert.equal(play('knight', [charts]).score, 60 * 3);
  assert.equal(play('knight', [{ ...charts, off: true }]).score, 30);
});

test('명인 침묵: 왼쪽 격언 둘이 꺼진다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'silence' }, { id: 'charts', data: {} }, { id: 'chivalry' }, { id: 'payback' }, { id: 'quick_change' }] });
  assert.equal(b.mods[2].off, true);
  assert.equal(b.mods[3].off, true);
  assert.equal(b.mods[4].off, undefined);
  b.board = boardFrom({ e5: 'B', a8: 'R' });
  b.hand = [{ t: 'N', id: 1, eng: null }];
  apply(b, { type: 'drop', handIndex: 0, sq: S('d3') });
  apply(b, { type: 'capture', sq: S('e5') });
  assert.equal(b.score, 90); // 갈아입기만(+2), 기사도 · 되갚음 꺼짐
});

test('명인 앙갚음: 끊긴 사슬은 점수가 4분의 1', () => {
  assert.equal(play('cut', [{ id: 'grudge' }]).score, 12); // 50 × 1 × 0.25
  assert.equal(play('knight', [{ id: 'grudge' }]).score, 30);
});

test('명인 철벽: 응수가 없다 — 노려진 칸을 먹으면 곧바로 끊긴다', () => {
  // N d3 → B e5, e5를 f6 폰이 노린다. 보통은 f6을 먹어 잇지만(응수), 철벽이면 곧바로 끊긴다
  const plain = { board: boardFrom({ e5: 'B', f6: 'P', a8: 'R' }), rules: {}, mods: [], chain: null };
  startChain(plain, { type: 'N', sq: S('d3') });
  chainCapture(plain, S('e5'));
  assert.equal(plain.chain.done, false);
  const iron = createBattle({ seed: 1, mods: [{ id: 'iron_wall' }] });
  assert.equal(iron.rules.noReply, true);
  const t = { board: boardFrom({ e5: 'B', f6: 'P', a8: 'R' }), rules: iron.rules, mods: [], chain: null };
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.done, true);
  assert.equal(t.chain.reason, 'cut');
});

test('명인 안개: 안개 속에는 떨굴 수 없다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'fog' }] });
  b.board = boardFrom({ e7: 'P', a1: 'R' });
  b.hand = [{ t: 'N', id: 1, eng: null }];
  const drops = legalCommands(b).filter((c) => c.type === 'drop').map((c) => c.sq);
  assert.ok(drops.length > 0);
  assert.ok(drops.every((sq) => (sq >> 3) < 3), drops.join(','));
  const plain = createBattle({ seed: 1 });
  plain.board = boardFrom({ e7: 'P', a1: 'R' });
  plain.hand = [{ t: 'N', id: 1, eng: null }];
  assert.ok(legalCommands(plain).some((c) => c.type === 'drop' && (c.sq >> 3) >= 5));
});

test('명인 모래시계 · 무거운 손: 무르기가 줄어든다', () => {
  const h = createBattle({ seed: 1, mods: [{ id: 'hourglass' }] });
  assert.equal(h.movesLeft, 2);
  assert.equal(h.discardsLeft, 1);
  const w = createBattle({ seed: 1, mods: [{ id: 'heavy_hand' }] });
  w.board = boardFrom({ e5: 'B', a8: 'R' });
  w.hand = [{ t: 'Q', id: 1, eng: null }, { t: 'R', id: 2, eng: null }, { t: 'N', id: 3, eng: null }];
  const drops = legalCommands(w).filter((c) => c.type === 'drop');
  assert.ok(drops.length > 0 && drops.every((c) => c.handIndex === 2));
});

test('명인 거울: 같은 종류를 두 번 먹지 못한다', () => {
  // N c3 → B d5 → N f7 → (B e5 금지: 비숍은 이미 먹었다)
  const t = { board: boardFrom({ d5: 'B', f7: 'N', e5: 'B' }), rules: {}, mods: [{ id: 'mirror' }], chain: null };
  startChain(t, { type: 'N', sq: S('c3') });
  chainCapture(t, S('d5'));
  assert.deepEqual(chainCaptures(t), [S('f7')]);
  chainCapture(t, S('f7'));
  assert.equal(t.chain.form, 'N');
  // f7 나이트 모습에서 e5 비숍이 닿지만 비숍으로 두 번째 갈아입기라 막힌다
  assert.deepEqual(chainCaptures(t), []);
  assert.equal(t.chain.done, true);
  // 거울이 없으면 e5를 먹는다
  const u = { board: boardFrom({ d5: 'B', f7: 'N', e5: 'B' }), rules: {}, mods: [], chain: null };
  startChain(u, { type: 'N', sq: S('c3') });
  chainCapture(u, S('d5'));
  chainCapture(u, S('f7'));
  assert.deepEqual(chainCaptures(u), [S('e5')]);
});

test('명인 안개: 위 다섯 줄은 내 기물이 닿은 칸만 드러난다', () => {
  const b = createBattle({ seed: 1, mods: [{ id: 'fog' }] });
  assert.equal(b.rules.fog, 5);
  b.board = boardFrom({ d2: 'B', h6: 'R', a8: 'P' });
  b.hand = [{ t: 'N', id: 1, eng: null }];
  assert.ok(isHidden(b, S('h6')) && isHidden(b, S('a8')) && !isHidden(b, S('d2')));
  apply(b, { type: 'drop', handIndex: 0, sq: S('b1') });
  apply(b, { type: 'capture', sq: S('d2') }); // 비숍 모습 d2: 대각 e3 f4 g5 h6이 닿는다
  assert.ok(!isHidden(b, S('h6')));
  assert.ok(isHidden(b, S('a8')));
  assert.equal(isHidden(createBattle({ seed: 1 }), S('h8')), false);
});

test('기보 표: 모습 다섯(킹 없음)', () => {
  assert.deepEqual(Object.keys(CHART_TABLE), ['P', 'N', 'B', 'R', 'Q']);
  assert.deepEqual(CHART_TABLE.Q, { a: 25, b: 2 });
});
