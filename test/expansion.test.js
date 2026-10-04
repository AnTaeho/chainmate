// 밤샘 2 가짓수 늘리기(docs/design-notes/content-expansion.md): 새것마다 규칙 시험 하나 이상 · 이름 겹침
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, attackers } from '../src/sim/board.js';
import { startChain, chainCapture, chainCaptures } from '../src/sim/chain.js';
import { createBattle, apply, legalCommands, arrive } from '../src/sim/battle.js';
import { createRun, battleMods } from '../src/sim/run.js';
import { bestMove } from '../src/sim/solver.js';
import { MAXIMS, MAXIM_BY_ID } from '../src/data/maxims.js';
import { JOSEKIS, JOSEKI_BY_ID } from '../src/data/josekis.js';
import { SOULS } from '../src/data/souls.js';
import { ENGRAVINGS } from '../src/data/engravings.js';
import { MASTERS } from '../src/data/masters.js';
import { TRAITS } from '../src/data/traits.js';
import { FAMILIES, MAXIM_FAMILIES, familyCounts } from '../src/data/families.js';
import { LEGENDS } from '../src/data/legends.js';
import { TACTICS } from '../src/data/tactics.js';
import { PIECES } from '../src/data/pieces.js';
import { NEW_MAXIMS } from './helpers/maxims.js';

const spec = (m) => (typeof m === 'string' ? { id: m } : m);
function chain(map, drop, at, caps, mods = [], extra = {}, opts = {}) {
  const t = { board: boardFrom(map), rules: {}, mods: mods.map(spec), chain: null, movesUsed: 0, hand: [], ...extra };
  startChain(t, { type: drop, sq: S(at), engraving: opts.eng ? { id: opts.eng } : null, soul: opts.soul ? { id: `soul:${opts.soul}` } : null });
  for (const c of caps) { if (t.chain.done) break; chainCapture(t, S(c)); }
  return t.chain;
}
const tbl = (map, mods = [], extra = {}) => ({ board: boardFrom(map), rules: {}, mods: mods.map(spec), chain: null, movesUsed: 0, hand: [], ...extra });

test('가짓수: 정석 24 · 격언 70 · 시너지 10 · 혼 16 · 각인 12', () => {
  assert.equal(JOSEKIS.length, 24);
  assert.equal(MAXIMS.length, 70);
  assert.equal(FAMILIES.length, 10);
  assert.equal(SOULS.length, 16);
  assert.equal(ENGRAVINGS.length, 12);
  for (const id of NEW_MAXIMS) assert.ok(MAXIM_BY_ID[id], id);
});

test('이름 겹침 없음: 격언 · 정석 · 혼 · 각인 · 명인 · 특성 · 시너지 · 전설 · 묘수', () => {
  const seen = new Map();
  const add = (kind, list) => { for (const x of list) { assert.ok(!seen.has(x.name), `${x.name}: ${seen.get(x.name)} · ${kind}`); seen.set(x.name, kind); } };
  add('격언', MAXIMS); add('정석', JOSEKIS); add('혼', SOULS); add('각인', ENGRAVINGS); add('명인', MASTERS); add('특성', TRAITS); add('시너지', FAMILIES); add('전설', LEGENDS); add('묘수', TACTICS);
});

test('새 시너지 둘은 넷 이상에 붙어 2 · 4 · 6이 켜질 수 있다', () => {
  const holders = (f) => [...Object.values(MAXIM_FAMILIES), ...JOSEKIS.map((j) => j.families), ...SOULS.map((s) => s.families)].filter((l) => l.includes(f)).length;
  assert.ok(holders('counter') >= 4, `역습 ${holders('counter')}`);
  assert.ok(holders('ambush') >= 4, `매복 ${holders('ambush')}`);
  for (const id of NEW_MAXIMS) assert.ok((MAXIM_FAMILIES[id] || []).length >= 1, `${id} 시너지 칩`);
  const n = familyCounts({ maxims: [{ id: 'reversal' }, { id: 'kings_step' }, { id: 'counter_book' }], deck: [{ t: 'P', soul: 'reaper' }] });
  assert.equal(n.counter, 4);
});

// ── 시너지
test('역습 시너지: 지키는 적을 먹을 때마다 값 +40 · 4 배수 +3 · 6 ×1.3', () => {
  const map = { e5: 'B', f6: 'P', a8: 'R' };
  const lv = (level) => chain(map, 'N', 'd3', ['e5', 'f6'], [{ id: 'family:counter', data: { level } }]);
  const base = chain(map, 'N', 'd3', ['e5', 'f6']);
  assert.equal(lv(1).value, base.value + 40);
  assert.equal(lv(2).mult, base.mult + 3);
  assert.ok(Math.abs(lv(3).mult - (base.mult + 3) * 1.3) < 1e-9);
});
test('매복 시너지: 증원을 먹을 때마다 배수 +3 · 4 증원 자리 떨구기 배수 +4 · 6 증원을 먹을 때마다 ×2', () => {
  const t = tbl({ e5: 'B', h1: 'R' }, [{ id: 'family:ambush', data: { level: 3 } }], { incoming: [{ sq: S('d3'), t: 'P' }] });
  t.board[S('e5')].born = 0;
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.value, 30);
  assert.equal(t.chain.mult, (1 + 3) * 2 + 4);
});

// ── 격언
test('기마 돌격: 뛰어 먹은 다음 먹기 배수 +3', () => {
  assert.equal(chain({ e5: 'B', c7: 'N', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], ['cavalry_charge']).mult, 2 + 3);
});
test('긴 대각: 대각선 세 칸 이상이면 값 +30', () => {
  assert.equal(chain({ e5: 'P', h8: 'R' }, 'B', 'b2', ['e5'], ['long_diagonal']).value, 10 + 30);
  assert.equal(chain({ c3: 'P', h8: 'R' }, 'B', 'b2', ['c3'], ['long_diagonal']).value, 10);
});
test('포위: 둘레에 적이 셋 이상인 칸에서 먹으면 배수 +2', () => {
  assert.equal(chain({ e5: 'B', d6: 'N', f6: 'N', d4: 'N' }, 'N', 'd3', ['e5'], ['encircle']).mult, 3);
  assert.equal(chain({ e5: 'B', d6: 'N', h8: 'N' }, 'N', 'd3', ['e5'], ['encircle']).mult, 1);
});
test('외톨이: 지키는 적이 없는 적을 먹으면 값 +15', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['loner']).value, 45);
  assert.equal(chain({ e5: 'B', f6: 'P' }, 'N', 'd3', ['e5'], ['loner']).value, 30);
});
test('가득 찬 판: 떨굴 때 적이 열여섯 이상이면 ×1.5', () => {
  const many = { e5: 'B' };
  for (const s of ['a8', 'c8', 'd8', 'e8', 'f8', 'g8', 'a7', 'b7', 'd7', 'e7', 'f7', 'h7', 'a6', 'b6', 'g6', 'h6']) many[s] = 'P';
  assert.equal(chain(many, 'N', 'd3', ['e5'], ['full_board']).score, 45);
  delete many.a8; delete many.c8;
  assert.equal(chain(many, 'N', 'd3', ['e5'], ['full_board']).score, 30);
});
test('막내 · 맏이: 손에서 가장 낮은 · 높은 기물로 시작', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['youngest'], { hand: [{ t: 'R' }] }).mult, 5);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['youngest'], { hand: [{ t: 'P' }] }).mult, 1);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['eldest'], { hand: [{ t: 'P' }] }).value, 80);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['eldest'], { hand: [{ t: 'Q' }] }).value, 30);
});
test('두 번째 바람 · 승부수 · 역전', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['second_wind'], { movesUsed: 1 }).score, 60);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['second_wind'], { movesUsed: 2 }).score, 30);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['all_in'], { movesLeft: 1, target: 1000, score: 100 }).score, 90);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['all_in'], { movesLeft: 1, target: 1000, score: 600 }).score, 30);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['reversal'], { history: [{ reason: 'cut' }] }).score, 60);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['reversal'], { history: [{ reason: 'blocked' }] }).score, 30);
});
test('연타: 같은 모습으로 잇달아 먹으면 배수 +2', () => {
  const c = chain({ e5: 'N', f7: 'P' }, 'N', 'd3', ['e5', 'f7'], ['combo']);
  assert.equal(c.mult, 4);
});
test('변장: 특수 기물 모습으로 먹으면 값 +30', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'E', 'c3', ['e5'], ['disguise']).value, 60);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'B', 'c3', ['e5'], ['disguise']).value, 30);
});
test('체스판: 밝은 칸 값 +10 · 어두운 칸 배수 +1', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['checkerboard']).mult, 2);
  const light = chain({ e4: 'B', a8: 'R' }, 'N', 'd2', ['e4'], ['checkerboard']);
  assert.equal(light.value, 40);
  assert.equal(light.mult, 1);
});
test('마지막 한 칸 · 귀족 · 농부', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['last_square']).value, 60);
  assert.equal(chain({ e5: 'R', a8: 'R' }, 'N', 'd3', ['e5'], ['nobility']).mult, 3);
  assert.equal(chain({ e5: 'P', a8: 'R' }, 'N', 'd3', ['e5'], ['farmer']).value, 25);
});
test('대장장이: 각인 기물로 시작하면 ×1.5', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['blacksmith'], {}, { eng: 'ivory' }).score, 90);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['blacksmith']).score, 30);
});
test('혼 수집가 · 금욕: 판(런)이 짜임에서 센다(onBuild)', () => {
  const mods = battleMods({ deck: [{ t: 'P', soul: 'echo' }, { t: 'N', soul: 'hunger' }, { t: 'B' }], maxims: [{ uid: 1, id: 'soul_collector' }, { uid: 2, id: 'asceticism' }], charts: {} });
  assert.equal(mods.find((m) => m.id === 'soul_collector').data.souls, 2);
  assert.equal(mods.find((m) => m.id === 'asceticism').data.free, 3);
  const full = battleMods({ deck: [], maxims: ['asceticism', 'farmer', 'nobility', 'combo', 'loner'].map((id, i) => ({ uid: i, id })), charts: {} });
  assert.equal(full.find((m) => m.id === 'asceticism').data.free, 0);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [{ id: 'soul_collector', data: { souls: 2 } }]).mult, 5);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [{ id: 'asceticism', data: { free: 1 } }]).score, 60);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [{ id: 'asceticism', data: { free: 0 } }]).score, 30);
});
test('주특기: 기보 레벨이 가장 높은 모습으로 먹으면 값 +25', () => {
  const ch = { id: 'charts', data: { table: {}, levels: { B: 2, N: 1 } } };
  const c = chain({ e5: 'B', c7: 'B', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], [ch, 'specialty']);
  const d = chain({ e5: 'B', c7: 'B', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], [ch]);
  assert.equal(c.value - d.value, 25);
});
test('순례: 네 구역을 모두 밟은 사슬 ×4', () => {
  const c = chain({ e5: 'B', c7: 'B', f4: 'P' }, 'N', 'd3', ['e5', 'c7', 'f4'], ['pilgrimage']);
  assert.equal(c.captures.length, 3);
  assert.equal(c.score, (30 + 30 + 10) * 3 * 4);
});
test('왕의 발자국: 킹 옆 칸에서 먹으면 배수 +3', () => {
  const t = tbl({ e5: 'B', f6: 'K', a1: 'R' }, ['kings_step']);
  startChain(t, { type: 'N', sq: S('d3') });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.mult, 4);
});
test('매복병: 증원 자리에 떨구면 값 +40', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['ambusher'], { incoming: [{ sq: S('d3'), t: 'P' }] }).value, 70);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['ambusher'], { incoming: [{ sq: S('h3'), t: 'P' }] }).value, 30);
});
test('반격의 서: 지키는 적을 두 번 먹은 사슬 ×2', () => {
  const c = chain({ e5: 'B', f6: 'P', g7: 'P' }, 'N', 'd3', ['e5', 'f6', 'g7'], ['counter_book']);
  assert.equal(c.forcedReplies, 2);
  assert.equal(c.score, (30 + 10 + 10) * 3 * 2);
});

// 대국 흐름으로만 도는 격언: 절약 · 도박사 · 행운의 동전
function winOnce(seed, mods, target = 1) {
  const b = createBattle({ seed, ante: 2, kind: 'practice', target, mods });
  const ev = [];
  const d = legalCommands(b).find((c) => c.type === 'drop');
  ev.push(...apply(b, d));
  while (b.status === 'chain') ev.push(...apply(b, legalCommands(b)[0]));
  return { b, ev };
}
test('절약: 대국을 이기면 남은 희생마다 상금 +1', () => {
  const { b } = winOnce(3, [{ id: 'thrift' }]);
  assert.equal(b.status, 'won');
  assert.equal(b.money >= b.discardsLeft && b.discardsLeft === 3, true);
});
test('도박사: 사슬 넷에 하나 ×3(풀이기는 모른다) · 행운의 동전: 먹기 여섯에 하나 상금', () => {
  let hit = 0, n = 0, coins = 0, caps = 0;
  for (let s = 1; s <= 400; s++) {
    const { ev } = winOnce(s, [{ id: 'gambler' }, { id: 'lucky_coin' }], 1e9);
    n++;
    if (ev.some((e) => e.src === 'gambler' && e.xmult === 3)) hit++;
    caps += ev.filter((e) => e.type === 'capture').length;
    coins += ev.filter((e) => e.type === 'money' && e.src === 'lucky_coin').reduce((a, e) => a + e.money, 0);
  }
  assert.ok(hit > n * 0.18 && hit < n * 0.32, `도박사 ${hit}/${n}`);
  assert.ok(coins > caps / 6 * 0.7 && coins < caps / 6 * 1.3, `동전 ${coins}/${caps}`);
  const b = createBattle({ seed: 5, ante: 2, target: 1e9, mods: [{ id: 'gambler' }] });
  const p = createBattle({ seed: 5, ante: 2, target: 1e9 });
  assert.equal(bestMove(b).score, bestMove(p).score);
});

// ── 정석
test('정석 사막 · 풀밭 · 포대 · 그늘: 주머니 기물이 이형이 된다', () => {
  for (const [id, to, n] of [['desert', 'L', 2], ['meadow', 'V', 2], ['battery', 'O', 1], ['gloom', 'W', 1]]) {
    const run = createRun({ seed: 1, draft: false });
    JOSEKI_BY_ID[id].pick(run, []);
    assert.equal(run.deck.filter((p) => p.t === to).length, n, id);
  }
});
test('정석 강: 가운데 두 줄을 건너 먹으면 배수 +1', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['joseki:river']).mult, 2);
  assert.equal(chain({ e4: 'B', a8: 'R' }, 'N', 'd2', ['e4'], ['joseki:river']).mult, 1);
});
test('정석 횃불: 값이 가장 큰 적 둘은 아무것도 지키지 못한다', () => {
  const b = createBattle({ seed: 11, ante: 5, mods: [{ id: 'joseki:torch' }] });
  const muted = b.board.map((c, sq) => (c && c.muted ? sq : -1)).filter((s) => s >= 0);
  assert.equal(muted.length, 2);
  const vals = b.board.filter((c) => c && c.t !== 'K' && c.t !== 'X' && c.t !== 'J').map((c) => PIECES[c.t].value).sort((x, y) => y - x);
  assert.deepEqual(muted.map((s) => PIECES[b.board[s].t].value).sort((x, y) => y - x), vals.slice(0, 2));
  for (let sq = 0; sq < 64; sq++) for (const a of attackers(b.board, sq)) assert.ok(!b.board[a].muted);
});
test('정석 함정: 빈칸 둘 · 증원이 들면 값이 점수로', () => {
  const b = createBattle({ seed: 12, ante: 3, target: 1e9, mods: [{ id: 'joseki:trap' }] });
  const tr = b.rules.traps;
  assert.equal(tr.length, 2);
  for (const s of tr) assert.equal(b.board[s], null);
  b.incoming = [{ sq: tr[0], t: 'R' }];
  const ev = [];
  arrive(b, ev);
  assert.ok(ev.some((e) => e.type === 'trapped' && e.value === 50));
  assert.equal(b.score, 50);
  assert.equal(b.board[tr[0]], null);
});
test('정석 속기 · 장고: 수 · 손 · 희생', () => {
  const a = createBattle({ seed: 1, mods: [{ id: 'joseki:blitz' }] });
  assert.equal(a.movesLeft, 5); assert.equal(a.hand.length, 3);
  const b = createBattle({ seed: 1, mods: [{ id: 'joseki:long_think' }] });
  assert.equal(b.movesLeft, 3); assert.equal(b.hand.length, 6); assert.equal(b.discardsLeft, 4);
});
test('정석 선수: 값이 가장 큰 적 하나가 빠진다', () => {
  const a = createBattle({ seed: 21, ante: 5, mods: [{ id: 'joseki:first_mover' }] });
  const p = createBattle({ seed: 21, ante: 5 });
  const count = (b) => b.board.filter((c) => c && !c.mine && c.t !== 'X' && c.t !== 'J').length;
  assert.equal(count(a), count(p) - 1);
});
test('정석 포로: 대국 첫 사슬이 마지막에 먹은 적이 주머니로', () => {
  assert.deepEqual(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['joseki:captive']).traitors, ['B']);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], ['joseki:captive'], { movesUsed: 1 }).traitors, undefined);
});

// ── 혼
test('혼 계승: 사슬이 끝난 모습이 된다(킹 빼고)', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [], {}, { soul: 'inherit' }).becomes, 'B');
});
test('혼 계주: 막히면 손의 다음 기물이 그 칸에서 잇는다(대국마다 한 번)', () => {
  const c = chain({ e5: 'B', e8: 'P' }, 'N', 'd3', ['e5', 'e8'], [], { hand: [{ id: 9, t: 'R' }] }, { soul: 'relay' });
  assert.deepEqual(c.relay, { id: 9, t: 'R' });
  assert.equal(c.captures.length, 2);
  const again = chain({ e5: 'B', e8: 'P' }, 'N', 'd3', ['e5'], [], { hand: [{ id: 9, t: 'R' }], relayUsed: true }, { soul: 'relay' });
  assert.equal(again.done, true);
});
test('혼 역행: 폰 모습이면 아래 대각으로도 먹는다', () => {
  const t = tbl({ e5: 'P', f4: 'R', a8: 'R' });
  startChain(t, { type: 'N', sq: S('d3'), soul: { id: 'soul:retro' } });
  chainCapture(t, S('e5'));
  assert.ok(chainCaptures(t).includes(S('f4')));
  const u = tbl({ e5: 'P', f4: 'R', a8: 'R' });
  startChain(u, { type: 'N', sq: S('d3') });
  chainCapture(u, S('e5'));
  assert.ok(!chainCaptures(u).includes(S('f4')));
});
test('혼 결투: 같은 종류를 두 번 못 먹는다 · 배수 ×2', () => {
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [], {}, { soul: 'duel' }).score, 60);
  const t = tbl({ e5: 'P', f6: 'P' });
  startChain(t, { type: 'N', sq: S('d3'), soul: { id: 'soul:duel' } });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.reason, 'cut');
});
test('혼 사신: 킹을 지키는 적을 먹으면 배수 +3', () => {
  const t = tbl({ e5: 'B', g7: 'K', a1: 'R' });
  startChain(t, { type: 'N', sq: S('d3'), soul: { id: 'soul:reaper' } });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.mult, 4);
});
test('혼 도약: 첫 먹기는 두 칸 안의 적 어디든', () => {
  const t = tbl({ e5: 'B', d5: 'R' });
  startChain(t, { type: 'N', sq: S('d3'), soul: { id: 'soul:spring' } });
  assert.ok(chainCaptures(t).includes(S('d5')));
  const u = tbl({ e5: 'B', d5: 'R' });
  startChain(u, { type: 'N', sq: S('d3') });
  assert.ok(!chainCaptures(u).includes(S('d5')));
});
test('혼 귀환: 사슬을 푼 기물이 손으로 돌아온다(대국마다 한 번)', () => {
  let done = false;
  for (let seed = 1; seed <= 60 && !done; seed++) {
    const b = createBattle({ seed, ante: 2, target: 1e9, bag: [{ t: 'N', id: 1, soul: 'homing' }, 'P', 'P', 'P', 'N', 'B', 'R', 'P'] });
    const i = b.hand.findIndex((p) => p.id === 1);
    const d = legalCommands(b).find((c) => c.type === 'drop' && c.handIndex === i);
    if (!d) continue;
    apply(b, d);
    while (b.status === 'chain') apply(b, legalCommands(b)[0]);
    assert.ok(b.hand.some((p) => p.id === 1));
    assert.equal(Number(b.returnUsed), 1);
    done = true;
  }
  assert.ok(done);
});
test('혼 파문: 먹을 때마다 둘레 적 하나가 이번 수 동안 못 지킨다', () => {
  const t = tbl({ e5: 'B', d6: 'R', f4: 'P' });
  startChain(t, { type: 'N', sq: S('d3'), soul: { id: 'soul:ripple' } });
  chainCapture(t, S('e5'));
  assert.equal(t.board[S('d6')].frozen, true);
  assert.ok(!t.board[S('f4')].frozen);
});

// ── 각인
test('각인 청동 · 철 · 호박 · 비취 · 산호 · 대리석', () => {
  assert.equal(chain({ e5: 'B', c7: 'B', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], [], {}, { eng: 'bronze' }).value, 70);
  const cut = chain({ e5: 'R', g6: 'N' }, 'N', 'd3', ['e5'], [], {}, { eng: 'iron' });
  assert.equal(cut.reason, 'cut');
  assert.equal(cut.mult, 4);
  assert.equal(chain({ e5: 'B', c7: 'B', h1: 'R' }, 'N', 'd3', ['e5', 'c7'], [], {}, { eng: 'amber' }).value, 90);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [], {}, { eng: 'jade' }).score, 60);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [], { movesUsed: 1 }, { eng: 'jade' }).score, 30);
  const t = tbl({ e5: 'B', a8: 'R' });
  t.board[S('e5')].born = 1;
  startChain(t, { type: 'N', sq: S('d3'), engraving: { id: 'coral' } });
  chainCapture(t, S('e5'));
  assert.equal(t.chain.money, 1);
  assert.equal(chain({ e5: 'N', f7: 'P' }, 'N', 'd3', ['e5'], [], {}, { eng: 'marble' }).mult, 3);
  assert.equal(chain({ e5: 'B', a8: 'R' }, 'N', 'd3', ['e5'], [], {}, { eng: 'marble' }).mult, 1);
});
