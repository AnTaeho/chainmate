// CHM-55: 새 특수 기물 다섯(꺾쇠 T · 물수제비 E · 까마귀 V · 광대 M · 화약병 D)의 행마 · 막힘 · 꺾기/튕김 경계 ·
// 까마귀 앉는 칸 · 광대 적 행마 · 화약병 터짐 · 적일 때 지키는 칸 · 노림 판정과 행마의 일치(무작위 판) · 옛 저장 바꿔 읽기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table } from './helpers/chain.js';
import { boardFrom, parseSq as S, sqName, captures, attackers, isAttacked, reach, guardSquares, dropSquares, mimicOf, capWay } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { PIECES, FAIRIES, OLD_PIECE } from '../src/data/pieces.js';
import { createRng, next, int } from '../src/sim/rng.js';
import { createRun, applyRun, migrateRun } from '../src/sim/run.js';
import { legalCommands } from '../src/sim/battle.js';
import { renameOldPieces } from '../src/sim/oldsave.js';
import { generateBoard } from '../src/sim/setup.js';
import { EVOLVE } from '../src/data/tactics.js';
import { JOSEKI_BY_ID } from '../src/data/josekis.js';
import { loadRecords } from '../src/ui/records.js';
import { loadRuns } from '../src/ui/runlog.js';
import { makeStore, KEYS } from '../src/ui/save.js';

const names = (list) => list.map(sqName).sort();
const mine = (b, sq, t) => { b[S(sq)] = { t, mine: true }; return b; };

test('목록: 뺀 넷은 없고 새 다섯이 있다', () => {
  for (const t of ['A', 'C', 'H', 'G']) assert.ok(!PIECES[t] && !FAIRIES.includes(t), t);
  for (const t of ['T', 'E', 'V', 'M', 'D']) assert.ok(PIECES[t].fairy && FAIRIES.includes(t), t);
  assert.deepEqual(EVOLVE, { P: ['S', 'D'], N: ['L', 'M'], B: ['E', 'V'], R: ['O', 'W', 'T'], Q: ['Z'] });
});

// ── 꺾쇠
test('꺾쇠: 룩처럼 가다 빈칸에서 직각으로 꺾는다(두 번까지) · 꺾기 전후 처음 만나는 기물에서 멈춘다', () => {
  const b = boardFrom({ d6: 'P', f4: 'N', h5: 'B', e7: 'R', d2: 'P' });
  // d6 · f4 · d2는 곧게, h5는 d5에서 꺾어, e7은 e4에서 꺾어
  assert.deepEqual(names(captures(b, 'T', S('d4'))).filter((n) => ['d2', 'd6', 'e7', 'f4', 'h5'].includes(n)), ['d2', 'd6', 'e7', 'f4', 'h5']);
  // 두 번 꺾어 닿는다: d5에서 오른쪽, g5에서 위로 g7
  assert.ok(captures(boardFrom({ d6: 'P', g7: 'Q' }), 'T', S('d4')).includes(S('g7')));
  // 세 번은 못 꺾는다: 벽으로 길을 하나만 남기면(a1 → a3 → c3 → c2 → d2) d2는 꺾음 셋이라 닿지 않고, c2는 둘이라 닿는다
  const walls = { b1: 'X', b2: 'X', a4: 'X', d3: 'X', c1: 'X', b4: 'X', c4: 'X' };
  assert.ok(!captures(boardFrom({ ...walls, d2: 'P' }), 'T', S('a1')).includes(S('d2')));
  assert.ok(captures(boardFrom({ ...walls, c2: 'P' }), 'T', S('a1')).includes(S('c2')));
  // 꺾는 칸이 막혀 있으면 거기서 꺾지 못한다: 둘레가 모두 막히면 그 기물들만
  const b2 = boardFrom({ d5: 'P', h5: 'B', e4: 'P', c4: 'P', d3: 'P' });
  assert.deepEqual(names(captures(b2, 'T', S('d4'))), ['c4', 'd3', 'd5', 'e4']);
});

test('꺾쇠가 적일 때: 곧게 또는 꺾어 닿는 칸을 지킨다 · 길이 막히면 못 지킨다', () => {
  const b = mine(boardFrom({ h5: 'T' }), 'd4', 'N');
  assert.deepEqual(names(attackers(b, S('d4'))), ['h5']);
  const b2 = mine(boardFrom({ h5: 'T', d5: 'P', d3: 'P', c4: 'P', e4: 'P' }), 'd4', 'N');
  assert.deepEqual(attackers(b2, S('d4')).filter((s) => b2[s].t === 'T'), [], 'd4 둘레가 다 막혔다');
  // 먹은 칸(capture capWay): 꺾어도 가로 · 세로 먹기
  assert.deepEqual(capWay({ from: S('a1'), to: S('d4'), form: 'T', via: S('a4') }), { ortho: true, diag: false, leap: false });
});

// ── 물수제비
test('물수제비: 비숍처럼 가다 가장자리에서 튕긴다(두 번까지) · 구석에서는 튕기지 않는다', () => {
  // d4 → e3 · f2 · g1(아래 가장자리) → 튕겨 h2
  assert.ok(captures(boardFrom({ h2: 'R' }), 'E', S('d4')).includes(S('h2')));
  // 튕기기 전에 막히면 그 기물에서 멈춘다
  const b2 = boardFrom({ h2: 'R', f2: 'P', c5: 'P' });
  assert.deepEqual(names(captures(b2, 'E', S('d4'))), ['c5', 'f2']);
  const r = reach(boardFrom({ f2: 'P' }), 'E', S('d4'));
  // 구석 h8 · a1에 닿으면 튕기지 않는다 · c5 · b6 · a7에서 튕겨 b8, 다시 튕겨 c7 · d6 · … · h2
  assert.ok(r.includes(S('h8')) && r.includes(S('b8')) && r.includes(S('c7')) && r.includes(S('h2')));
  // 세 번은 없다: h2에서 다시 튕기면 g1이지만 닿지 않는다(e3 · f2 길은 f2가 막았다)
  assert.ok(!r.includes(S('g1')));
});

test('물수제비가 적일 때: 튕겨 닿는 칸도 지킨다(길을 뒤집어도 같은 튕김)', () => {
  const b = mine(boardFrom({ h2: 'E' }), 'd4', 'N');
  assert.deepEqual(names(attackers(b, S('d4'))), ['h2']);
  const b2 = mine(boardFrom({ h2: 'E', g1: 'P', c5: 'P' }), 'd4', 'N');
  assert.ok(!attackers(b2, S('d4')).includes(S('h2')), '한 번 튕기는 g1 · 두 번 튕기는 c5 길이 막혔다');
});

// ── 까마귀
test('까마귀: 대각선으로 붙은 적을 넘어 그 너머 빈칸에 앉는다 · 너머가 막히거나 판 밖이면 못 먹는다', () => {
  const b = boardFrom({ e5: 'N', c5: 'P', b6: 'P', e3: 'B', d5: 'R' });
  assert.deepEqual(names(captures(b, 'V', S('d4'))), ['e3', 'e5'], 'c5는 너머 b6이 막혔고 d5는 대각이 아니다');
  const edge = boardFrom({ h8: 'Q' });
  assert.deepEqual(captures(edge, 'V', S('g7')), [], '너머가 판 밖');
});

test('까마귀 모습으로 먹으면 앉는 칸이 먹은 칸과 다르다 · 이벤트에 at · 그 칸에서 바뀐 모습으로 잇는다', () => {
  const t = table({ e5: 'N', g4: 'P', a8: 'K', b7: 'P' });
  startChain(t, { type: 'V', sq: S('d4') });
  const ev = chainCapture(t, S('e5'));
  const cap = ev.find((e) => e.type === 'capture');
  assert.equal(cap.to, S('e5'));
  assert.equal(cap.at, S('f6'));
  assert.equal(cap.stay, false);
  assert.equal(t.board[S('e5')], null);
  assert.equal(t.board[S('d4')], null);
  assert.deepEqual(t.board[S('f6')], { t: 'N', mine: true });
  assert.equal(t.chain.sq, S('f6'));
  assert.equal(ev.find((e) => e.type === 'transform').sq, S('f6'));
  assert.deepEqual(names(chainCaptures(t)), ['g4'], '나이트가 된 f6에서');
  assert.deepEqual(capWay(cap), { ortho: false, diag: true, leap: true });
});

test('까마귀로 넘어 먹은 뒤에는 바뀐 모습으로도 대각선으로 붙은 적을 이어 넘는다 · 넘지 않는 먹기를 하면 끝', () => {
  const t = table({ e5: 'N', g7: 'P', a8: 'K', b7: 'P', e8: 'R' });
  startChain(t, { type: 'V', sq: S('d4') });
  chainCapture(t, S('e5'));                       // f6에 앉아 나이트
  assert.equal(t.chain.form, 'N');
  assert.ok(chainCaptures(t).includes(S('g7')), '나이트 행마로는 닿지 않는 g7을 넘는다');
  const cap = chainCapture(t, S('g7')).find((e) => e.type === 'capture');
  assert.equal(cap.at, S('h8'));
  assert.equal(cap.hop, true);
  assert.deepEqual(capWay(cap), { ortho: false, diag: true, leap: true });
  assert.equal(t.chain.form, 'Q', '폰이 되어 h8 — 프로모션');
  // 나이트 행마로 먹으면(넘지 않으면) 넘기가 끝난다
  const u = table({ e5: 'N', g8: 'R', a8: 'K', b7: 'P' });
  startChain(u, { type: 'V', sq: S('d4') });
  chainCapture(u, S('e5'));
  assert.equal(u.chain.hop, true);
  const c2 = chainCapture(u, S('g8')).find((e) => e.type === 'capture');
  assert.equal(c2.at, S('g8'));
  assert.equal(u.chain.hop, false);
});

test('까마귀가 적일 때: 대각선으로 붙은 칸 중 반대쪽이 빈 칸을 지킨다', () => {
  const b = mine(boardFrom({ e5: 'V' }), 'd4', 'N');
  assert.deepEqual(names(attackers(b, S('d4'))), ['e5']);
  const b2 = mine(boardFrom({ e5: 'V', c3: 'P' }), 'd4', 'N');
  assert.deepEqual(attackers(b2, S('d4')).filter((s) => b2[s].t === 'V'), [], '앉을 c3이 막혔다');
  // 떨굴 칸도 같은 판정
  const b3 = boardFrom({ e5: 'V', d6: 'P' });
  assert.ok(isAttacked(b3, S('d4'), { form: 'B' }));
});

// ── 광대
test('광대: 적을 그 적의 행마로만 먹는다 — 붙은 적도 그 행마로 닿아야 한다', () => {
  const b = boardFrom({ e5: 'P', c2: 'P', f5: 'N', d6: 'N', b4: 'R', b5: 'B', b6: 'B', c3: 'Q', e3: 'N', e4: 'B' });
  // c2 폰은 폰 행마로 닿지 않고, d6 나이트는 L자가 아니라, b5 비숍은 대각이 아니라 못 먹는다. b6 비숍은 대각선 위
  // 붙은 c3 퀸은 퀸 행마로 닿아 먹고, 붙은 e3 나이트 · e4 비숍은 그 행마로 닿지 않아 못 먹는다
  assert.deepEqual(names(captures(b, 'M', S('d4'))), ['b4', 'b6', 'c3', 'e5', 'f5']);
  // 적 까마귀는 까마귀처럼(넘어 앉는다) · 적 궁수는 궁수처럼(제자리)
  const t = table({ e5: 'V', a8: 'K', b7: 'P' });
  startChain(t, { type: 'M', sq: S('d4') });
  const cap = chainCapture(t, S('e5')).find((e) => e.type === 'capture');
  assert.equal(cap.at, S('f6'));
  const t2 = table({ d6: 'S', a8: 'K', b7: 'P' });
  startChain(t2, { type: 'M', sq: S('d4') });
  assert.equal(chainCapture(t2, S('d6')).find((e) => e.type === 'capture').stay, true);
  assert.equal(mimicOf('M'), 'K');
});

test('광대가 적일 때: 그 칸에 선 내 기물의 지금 모습의 행마로 지킨다', () => {
  const b = mine(boardFrom({ d7: 'M' }), 'd4', 'R');
  assert.deepEqual(names(attackers(b, S('d4'))), ['d7'], '룩 모습이면 룩처럼');
  const b2 = mine(boardFrom({ d7: 'M' }), 'd4', 'N');
  assert.deepEqual(attackers(b2, S('d4')), [], '나이트 모습이면 L자 칸만');
  const b3 = mine(boardFrom({ e6: 'M' }), 'd4', 'N');
  assert.deepEqual(names(attackers(b3, S('d4'))), ['e6']);
  // 떨굴 칸: 떨굴 모습으로 판정한다
  const b4 = boardFrom({ d7: 'M', a1: 'P' });
  assert.ok(isAttacked(b4, S('d4'), { form: 'R' }));
  assert.ok(!isAttacked(b4, S('d4'), { form: 'N' }));
  assert.ok(!dropSquares(b4, 'R').includes(S('d4')));
  // 붙은 칸도 모습의 행마로만 지킨다(그래서 킹 수비수로 서지 않는다)
  assert.deepEqual(attackers(mine(boardFrom({ e5: 'M' }), 'd4', 'N'), S('d4')), []);
  assert.equal(guardSquares(boardFrom({ d4: 'K' }), 'M', S('d4')).reduce((a, x) => a + x, 0), 0);
});

// ── 화약병
test('화약병: 킹처럼 한 칸으로 먹고, 둘레 여덟 칸의 적이 함께 터진다 · 킹 · 벽은 남는다 · 사슬은 끝난다', () => {
  const t = table({ e5: 'P', d6: 'R', e6: 'B', f6: 'N', f5: 'K', f4: 'X', a1: 'Q', h8: 'P' });
  t.board[S('d6')] = { ...t.board[S('d6')], gold: true };
  startChain(t, { type: 'D', sq: S('d4') });
  assert.ok(chainCaptures(t).includes(S('e5')));
  const ev = chainCapture(t, S('e5'));
  const ex = ev.find((e) => e.type === 'explode');
  assert.deepEqual(names(ex.squares), ['d6', 'e6', 'f6']);
  assert.equal(t.board[S('f5')].t, 'K');
  assert.equal(t.board[S('f4')].t, 'X');
  assert.equal(t.chain.done, true);
  assert.equal(t.chain.reason, 'blast');
  // 값: 폰 10 + 룩 50(금빛이라 두 번) + 비숍 30 + 나이트 30 · 배수: 먹기 1 + 터짐 3
  assert.equal(t.chain.value, 10 + 50 * 2 + 30 + 30);
  assert.equal(t.chain.mult, 4);
  assert.equal(t.chain.golden, 1);
  assert.equal(t.chain.captures.length, 1, '사슬 평가의 먹은 수에는 터진 적을 넣지 않는다');
  assert.ok(!ev.some((e) => e.type === 'transform'), '먹은 뒤 바뀌지 않는다');
  assert.equal(ev.at(-1).type, 'end');
});

test('화약병이 마지막 킹을 먹으면 체크메이트 · 적 화약병은 둘레 한 칸을 지킨다', () => {
  const t = table({ e5: 'K', e6: 'P' });
  startChain(t, { type: 'D', sq: S('d4') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.reason, 'mate');
  const b = mine(boardFrom({ e5: 'D' }), 'd4', 'N');
  assert.deepEqual(names(attackers(b, S('d4'))), ['e5']);
});

// ── 노림 판정 = 행마(무작위 판): attackers는 「적마다 그 행마로 sq에 닿나」와 같고, guardSquares는 「세워 보고 노리나」와 같다
const ALL = ['P', 'N', 'B', 'R', 'Q', 'K', ...FAIRIES];
function randomBoard(r, n) {
  const map = {};
  const b = boardFrom(map);
  for (let i = 0; i < n; i++) {
    const sq = int(r, 64);
    if (b[sq]) continue;
    const t = next(r) < 0.06 ? 'X' : ALL[int(r, ALL.length)];
    b[sq] = { t, id: i + 1, born: -1 };
  }
  return b;
}
function brute(board, sq, ignore) {
  const F = board[sq] && board[sq].mine ? board[sq].t : null;
  const out = [];
  for (let s = 0; s < 64; s++) {
    const c = board[s];
    if (!c || c.mine || s === ignore || c.t === 'X' || c.t === 'J') continue;
    const mv = c.t === 'M' ? (F ? mimicOf(F) : null) : c.t;
    if (mv && reach(board, mv, s, -1, ignore).includes(sq)) out.push(s);
  }
  return out.sort((a, b) => a - b);
}
test('노림 판정은 행마와 같다: 무작위 판 3000개(내 기물 모습 · 비운 칸 포함)', () => {
  const r = createRng(55);
  for (let k = 0; k < 3000; k++) {
    const b = randomBoard(r, 6 + int(r, 14));
    const free = b.map((c, s) => (c ? -1 : s)).filter((s) => s >= 0);
    const sq = free[int(r, free.length)];
    b[sq] = { t: ALL[int(r, ALL.length)], mine: true };
    let ignore = -1;
    if (next(r) < 0.5) { const f2 = b.map((c, s) => (c ? -1 : s)).filter((s) => s >= 0); ignore = f2[int(r, f2.length)]; b[ignore] = { t: 'N', mine: true }; }
    const got = attackers(b, sq, { ignore }).slice().sort((a, x) => a - x);
    assert.deepEqual([...new Set(got)], brute(b, sq, ignore), `판 ${k}`);
    assert.equal(isAttacked(b, sq, { ignore }), got.length > 0, `판 ${k} isAttacked`);
  }
});
test('킹 수비 칸(guardSquares)은 세워 보고 재는 것과 같다: 무작위 판 400개 × 종류', () => {
  const r = createRng(56);
  for (let k = 0; k < 400; k++) {
    const b = randomBoard(r, 6 + int(r, 12));
    const free = b.map((c, s) => (c ? -1 : s)).filter((s) => s >= 0);
    const to = free[int(r, free.length)];
    b[to] = { t: 'K', id: 99, born: -1 };
    for (const t of ALL) {
      const m = guardSquares(b, t, to);
      for (let s = 0; s < 64; s++) {
        if (b[s]) { assert.equal(m[s], 0); continue; }
        b[s] = { t, id: 100, born: -1 };
        const want = attackers(b, to).includes(s) ? 1 : 0;
        b[s] = null;
        assert.equal(m[s], want, `판 ${k} ${t} ${sqName(s)}`);
      }
    }
  }
});

test('판 짓기: 4관 이상 · 세력 고유 적으로도 판이 지어진다', () => {
  for (const unique of [{ M: 6 }, { V: 6 }, { D: 2.5, S: 6 }, { T: 0.6, Z: 0.3 }, { E: 1 }]) {
    for (let seed = 1; seed <= 6; seed++) {
      const b = { rules: { unique, kings: 1 }, ante: 6, nextId: 1 };
      const board = generateBoard(b, createRng(seed));
      assert.ok(board.some((c) => c && c.t === 'K'));
    }
  }
});

// ── 옛 저장
test('옛 저장 바꿔 읽기: 주머니 · 판 · 손 · 사슬 · 상점 · 꾸러미 · 기록 줄 · 세력 무게 · 기록 · 사람 판 기록', () => {
  const run = createRun({ seed: 5, draft: false });
  applyRun(run, { type: 'play' });
  const b = run.battle;
  run.deck.push({ id: 900, t: 'A', eng: null }, { id: 901, t: 'C', eng: null }, { id: 902, t: 'H', eng: null }, { id: 903, t: 'G', eng: null });
  const free = b.board.map((c, s) => (c ? -1 : s)).filter((s) => s >= 16);
  b.board[free[0]] = { t: 'G', id: 990, born: -1 };
  b.board[free[1]] = { t: 'H', id: 991, born: -1 };
  b.hand[0] = { ...b.hand[0], t: 'C' };
  b.history.push({ piece: 'A', caps: 'PGHN', took: 'ANH', reason: 'cut', score: 1 });
  b.rules.unique = { H: 6, L: 1 };
  b.offering = { weight: 3, count: 1, pieces: ['A'], drawn: [] };
  run.shop = { display: [{ kind: 'piece', t: 'C', price: 7, sold: false }], packs: [] };
  run.pack = { kind: 'piece', options: [{ kind: 'piece', t: 'H' }, { kind: 'piece', t: 'N' }] };
  run.log.push({ ante: 1, worn: { A: 2, E: 1, G: 3 }, took: { H: 1 } });
  run.bestReplay = { drop: { sq: 3, piece: 'A' }, caps: [{ from: 3, to: 12, piece: 'G', form: 'A', after: 'G' }], board: [] };
  // 저장 = JSON 한 덩이
  const saved = JSON.parse(JSON.stringify(run));
  const got = migrateRun(saved);
  const s = JSON.stringify(got);
  for (const old of Object.keys(OLD_PIECE)) assert.ok(!new RegExp(`"t":"${old}"`).test(s), old);
  assert.deepEqual(got.deck.slice(-4).map((p) => p.t), ['E', 'T', 'L', 'V']);
  assert.equal(got.battle.board[free[0]].t, 'V');
  assert.equal(got.battle.board[free[1]].t, 'L');
  assert.equal(got.battle.hand[0].t, 'T');
  assert.deepEqual(got.battle.history.at(-1), { piece: 'E', caps: 'PVLN', took: 'ENL', reason: 'cut', score: 1 });
  assert.deepEqual(got.battle.rules.unique, { L: 7 });
  assert.deepEqual(got.battle.offering.pieces, ['E']);
  assert.equal(got.shop.display[0].t, 'T');
  assert.deepEqual(got.pack.options.map((o) => o.t), ['L', 'N']);
  assert.deepEqual(got.log.at(-1).worn, { E: 3, V: 3 });
  assert.deepEqual(got.bestReplay.caps[0], { from: 3, to: 12, piece: 'V', form: 'E', after: 'V' });
  assert.equal(got.bestReplay.drop.piece, 'E');
  // 칸 번호 · 혼 · 격언은 그대로
  assert.equal(got.seed, run.seed);
  assert.deepEqual(got.maxims, run.maxims);
  // 바꿔 읽은 판으로 대국이 이어진다(명령이 돈다)
  assert.ok(legalCommands(got.battle).length > 0);
  // 새 저장은 손대지 않는다(같은 객체)
  const fresh = createRun({ seed: 6, draft: false });
  assert.equal(migrateRun(fresh), fresh);
});

test('옛 기록 · 사람 판 기록도 읽을 때 바꾼다', () => {
  const mem = new Map();
  const store = makeStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });
  store.set(KEYS.records, { v: 1, runs: 3, bestMove: { score: 900, steps: ['N', 'A', 'G'], ante: 4 }, bestBrilliant: { score: 50, weight: 3, pieces: ['C'], ante: 2 } });
  const rec = loadRecords(store);
  assert.deepEqual(rec.bestMove.steps, ['N', 'E', 'V']);
  assert.deepEqual(rec.bestBrilliant.pieces, ['T']);
  store.set(KEYS.runs, { v: 1, runs: [{ seed: 1, deck: 'A C:gold H N', fairies: ['A', 'G'], log: [{ worn: { C: 1 } }] }] });
  const rows = loadRuns(store);
  assert.equal(rows[0].deck, 'E T:gold L N');
  assert.deepEqual(rows[0].fairies, ['E', 'V']);
  assert.deepEqual(rows[0].log[0].worn, { T: 1 });
  assert.equal(renameOldPieces(null), null);
});

test('정석: 풀밭은 까마귀 · 기사 서약 광대 · 성벽 쌓기 꺾쇠 · 주교관 물수제비', () => {
  for (const [id, to] of [['meadow', 'V'], ['knight_oath', 'M'], ['rampart', 'T'], ['mitre', 'E']]) {
    const run = createRun({ seed: 1, draft: false });
    JOSEKI_BY_ID[id].pick(run, []);
    assert.ok(run.deck.some((p) => p.t === to), id);
  }
});
