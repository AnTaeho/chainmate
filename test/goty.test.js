// 대국 도전 · 숙적(docs/reports/goty.md): 도전 뽑기의 결정성 · 종류마다 판정 · 상금, 숙적이 생기고 · 다시 나오고 · 오르고 · 잡히는 길,
// 저장 왕복, 오늘의 대국 다시 두기, 쫓는 봇의 줄 평가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { createRun, applyRun, challengeFor, blindInfo, KINDS } from '../src/sim/run.js';
import { CHALLENGES, CHALLENGE_BY_ID, challengeMet, challengeText, drawChallenge, CHALLENGE_TEXT } from '../src/data/challenges.js';
import { NEMESIS_TEXT, nemesisTrait, nemesisBounty } from '../src/data/nemesis.js';
import { CHALLENGE, NEMESIS } from '../src/sim/tuning.js';
import { createRng } from '../src/sim/rng.js';
import { createDailyRun } from '../src/sim/daily.js';
import { verifyDaily, summarize } from '../api/_lib/verify.js';
import { playRun } from '../tools/shopbot.mjs';
import { CHASE, chaseRank, stepBattle } from '../tools/bot.mjs';
import { finishBattle } from './helpers/run.js';

// 숙적은 기본으로 꺼 두었다(tuning.js NEMESIS.on) — 규칙 길은 켜고 시험한다(시험 파일마다 따로 도는 프로세스)
NEMESIS.on = true;
const clone = (x) => JSON.parse(JSON.stringify(x));
const sum = (o) => ({ captures: 0, forced: 0, promotions: 0, mates: 0, caps: '', forms: 1, end: 'P', ...o });
// 판을 갈아 끼운 대국(손 R 하나) — 첫 수 R a1 → a5를 잡는다
function crafted(map, extra = {}) {
  const b = createBattle({ seed: 1, ...extra });
  b.board = boardFrom(map);
  for (const [k, v] of Object.entries(map)) if (typeof v === 'object') Object.assign(b.board[S(k)], v, { t: v.t });
  b.hand = [{ t: 'R', id: 1, eng: null }];
  b.bag = [];
  b.incoming = []; b.incomingNext = [];
  return b;
}

test('도전 뽑기: 같은 판 · 관 · 대국이면 같은 도전, 마스터전 · 수업 판 · 꺼짐이면 없다, 관 선택에 미리 보인다', () => {
  const a = createRun({ seed: 7 }), b = createRun({ seed: 7 }), c = createRun({ seed: 8 });
  const seen = new Set();
  for (let ante = 1; ante <= 8; ante++) for (let blind = 0; blind < 3; blind++) {
    const x = challengeFor(a, ante, blind);
    assert.deepEqual(x, challengeFor(b, ante, blind));
    if (KINDS[blind] === 'master') { assert.equal(x, null); continue; }
    assert.ok(CHALLENGE_BY_ID[x.id], x.id);
    assert.equal(x.reward, CHALLENGE.reward);
    assert.equal(x.done, false);
    seen.add(x.id);
    assert.ok(challengeText(x).length > 0);
  }
  assert.ok(seen.size >= 4, '여러 종류가 뽑힌다');
  assert.notDeepEqual([1, 2, 3, 4].map((a1) => challengeFor(a, a1, 0)), [1, 2, 3, 4].map((a1) => challengeFor(c, a1, 0)));
  assert.deepEqual(blindInfo(a).challenge, challengeFor(a, 1, 0));
  assert.equal(challengeFor({ ...a, scratch: true }, 1, 0), null);
  const was = CHALLENGE.on;
  CHALLENGE.on = false;
  try { assert.equal(challengeFor(a, 1, 0), null); } finally { CHALLENGE.on = was; }
  // 뽑기는 무게를 따른다: 무게 0인 종류는 뽑히지 않는다
  const w = CHALLENGES.map((x) => x.weight);
  CHALLENGES.forEach((x) => { x.weight = x.id === 'take' ? 1 : 0; });
  try { for (let i = 0; i < 20; i++) assert.equal(drawChallenge(createRng(i + 1), 3, 'practice').id, 'take'); } finally { CHALLENGES.forEach((x, i) => { x.weight = w[i]; }); }
});

test('도전 판정: 종류마다 끝난 콤보 요약 하나로', () => {
  const ok = (ch, h) => challengeMet(ch, sum(h));
  assert.ok(ok({ id: 'forms', n: 3 }, { forms: 3 }) && !ok({ id: 'forms', n: 4 }, { forms: 3 }));
  assert.ok(ok({ id: 'take', n: 5 }, { captures: 5 }) && !ok({ id: 'take', n: 5 }, { captures: 4 }));
  assert.ok(ok({ id: 'end', form: 'N' }, { captures: 2, end: 'N' }));
  assert.ok(!ok({ id: 'end', form: 'N' }, { captures: 1, end: 'N' }), '둘 이상 잡은 콤보만');
  assert.ok(!ok({ id: 'end', form: 'N' }, { captures: 3, end: 'B' }));
  assert.ok(ok({ id: 'guards', n: 2 }, { forced: 2 }) && !ok({ id: 'guards', n: 2 }, { forced: 1 }));
  assert.ok(ok({ id: 'promote' }, { promotions: 1 }) && !ok({ id: 'promote' }, {}));
  assert.ok(ok({ id: 'mate' }, { mates: 1 }) && !ok({ id: 'mate' }, {}));
  assert.ok(ok({ id: 'same' }, { caps: 'NPPPB' }) && !ok({ id: 'same' }, { caps: 'NPPBP' }));
  assert.ok(!challengeMet(null, sum({})) && !challengeMet({ id: 'nope' }, sum({})));
  // 도전 글: 수치가 끼는 꼴
  assert.equal(challengeText({ id: 'take', n: 5 }), '한 콤보에 5번 잡는다');
  assert.equal(challengeText({ id: 'end', form: 'N' }), '나이트 모습으로 콤보를 끝낸다');
  assert.equal(CHALLENGE_TEXT.reward(2), '이루면: 상금 +2');
});

test('도전: 이룬 콤보가 끝나는 순간 사건 · done, 한 대국에 한 번', () => {
  const b = crafted({ a5: 'P', h8: 'P' }, { challenge: { id: 'take', n: 1, reward: 2 } });
  b.hand.push({ t: 'R', id: 2, eng: null });
  const ev = [...apply(b, { type: 'drop', handIndex: 0, sq: S('a1') })];
  while (b.status === 'chain') ev.push(...apply(b, { type: 'capture', sq: b.chain.forced ? b.chain.forced[0] : S('a5') }));
  const i = ev.findIndex((e) => e.type === 'challenge');
  assert.ok(i > ev.findIndex((e) => e.type === 'end'), '콤보 끝 뒤');
  assert.deepEqual(ev[i], { type: 'challenge', id: 'take', reward: 2, move: 0 });
  assert.equal(b.challenge.done, true);
  assert.equal(b.history[0].forms, 2);
  assert.equal(b.history[0].end, 'P');
});

test('도전 상금: 이긴 대국은 보상 내역 challenge 칸, 진 대국도 상금을 받는다', () => {
  const run = createRun({ seed: 3, draft: false });
  applyRun(run, { type: 'play' });
  run.battle.challenge = { id: 'take', n: 1, reward: 2, done: false };
  run.battle.target = 1;
  finishBattle(run);
  const r = run.last.reward;
  assert.equal(r.challenge, 2);
  assert.equal(r.total, r.base + r.moves + r.interest + r.mate + r.overflow + r.earned + r.challenge);
  assert.deepEqual(run.log.at(-1).challenge, { id: 'take', n: 1, done: true, move: 0 });
  // 진 대국
  const lose = createRun({ seed: 3, draft: false });
  applyRun(lose, { type: 'play' });
  lose.battle.challenge = { id: 'take', n: 1, reward: 2, done: false };
  lose.battle.target = 1e15;
  const before = lose.money;
  const ev = [];
  while (lose.phase === 'battle') stepBattle(lose.battle, (c) => ev.push(...applyRun(lose, c)), { nomate: true });
  assert.equal(lose.phase, 'shop');
  assert.equal(lose.money, before + 2);
  assert.equal(lose.last.challengeMoney, 2);
  assert.ok(ev.some((e) => e.type === 'money' && e.src === 'challenge' && e.money === 2));
});

test('숙적이 생긴다: 끊은 적(값이 큰 적) · 대국마다 하나 · 킹은 안 된다', () => {
  // R a1 → a5의 폰을 잡아 폰 모습, b7 나이트가 a5를 지켜 끊긴다
  const b = crafted({ a5: 'P', b7: 'N' }, { nemesis: null });
  const ev = [...apply(b, { type: 'drop', handIndex: 0, sq: S('a1') })];
  ev.push(...apply(b, { type: 'capture', sq: S('a5') }));
  assert.ok(ev.some((e) => e.type === 'cut'));
  assert.deepEqual(ev.find((e) => e.type === 'nemesis'), { type: 'nemesis', kind: 'new', sq: S('b7'), piece: 'N', lv: 1 });
  assert.deepEqual(b.nem.born, { t: 'N', sq: S('b7') });
  // 킹만 지키면 숙적이 없다
  const k = crafted({ a5: 'P', a6: 'K' }, { nemesis: null });
  apply(k, { type: 'drop', handIndex: 0, sq: S('a1') });
  const ev2 = apply(k, { type: 'capture', sq: S('a5') });
  assert.ok(ev2.some((e) => e.type === 'cut'));
  assert.equal(k.nem.born, null);
  // 판(런) 밖의 대국(nemesis를 넘기지 않음) · 꺼짐이면 아무 일도 없다
  const off = crafted({ a5: 'P', b7: 'N' });
  apply(off, { type: 'drop', handIndex: 0, sq: S('a1') });
  assert.ok(!apply(off, { type: 'capture', sq: S('a5') }).some((e) => e.type === 'nemesis'));
  assert.equal(off.nem, undefined);
});

test('숙적이 다시 끊으면 단이 오르고(셋까지), 잡으면 현상금', () => {
  const b = crafted({ a5: 'P', b7: { t: 'N', nem: 2 } }, { nemesis: { t: 'N', lv: 2 } });
  apply(b, { type: 'drop', handIndex: 0, sq: S('a1') });
  const ev = apply(b, { type: 'capture', sq: S('a5') });
  assert.deepEqual(ev.find((e) => e.type === 'nemesis'), { type: 'nemesis', kind: 'up', sq: S('b7'), piece: 'N', lv: 3 });
  assert.equal(b.nem.ups, 1);
  const top = crafted({ a5: 'P', b7: { t: 'N', nem: 3 } }, { nemesis: { t: 'N', lv: 3 } });
  apply(top, { type: 'drop', handIndex: 0, sq: S('a1') });
  assert.ok(!apply(top, { type: 'capture', sq: S('a5') }).some((e) => e.type === 'nemesis'), `단은 ${NEMESIS.max}까지`);
  // 잡기: 상금은 콤보 상금으로(이긴 대국의 보상 earned)
  const t = crafted({ a5: { t: 'P', nem: 2 } }, { nemesis: { t: 'P', lv: 2 } });
  apply(t, { type: 'drop', handIndex: 0, sq: S('a1') });
  const ev3 = apply(t, { type: 'capture', sq: S('a5') });
  assert.deepEqual(ev3.find((e) => e.type === 'nemesis'), { type: 'nemesis', kind: 'taken', sq: S('a5'), piece: 'P', lv: 2, money: nemesisBounty(2) });
  assert.equal(t.money, nemesisBounty(2));
  assert.equal(t.nem.taken, 2);
});

test('숙적이 다시 나온다: 지어 둔 판의 같은 종류 적 하나에 표시와 단의 특성, 같은 종류가 없으면 안 나온다', () => {
  const lay = (map) => ({ board: boardFrom(map), nextId: 100, rng: 1 });
  const map = { d6: 'N', f6: 'N', a8: 'K', b8: 'P', a7: 'P', h3: 'P', c5: 'B' };
  const b = createBattle({ seed: 5, layout: lay(map), nemesis: { t: 'N', lv: 1 } });
  const marked = b.board.map((c, sq) => (c && c.nem ? sq : -1)).filter((x) => x >= 0);
  assert.equal(marked.length, 1);
  assert.equal(b.board[marked[0]].t, 'N');
  assert.equal(b.board[marked[0]].trait, nemesisTrait(1).id);
  assert.equal(b.nem.placed, true);
  // 같은 입력이면 같은 칸(시드)
  const again = createBattle({ seed: 5, layout: lay(map), nemesis: { t: 'N', lv: 1 } });
  assert.deepEqual(again.board, b.board);
  const none = createBattle({ seed: 5, layout: lay(map), nemesis: { t: 'R', lv: 1 } });
  assert.equal(none.nem.placed, false);
  assert.ok(!none.board.some((c) => c && c.nem));
  assert.equal(nemesisTrait(2).id, 'fort');
  assert.ok(NEMESIS_TEXT.bounty(3).includes('+3'));
});

test('판(런)의 숙적: 대국 줄 · run.nemesis로 옮겨 가고, 잡히면 사라지며, 저장 왕복에 안전하다', () => {
  const run = createRun({ seed: 11, draft: false });
  assert.equal(run.nemesis, null);
  // 첫 대국의 판을 갈아 끼워 끊기게 하고 수 하나로 진다
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.board = boardFrom({ a5: 'P', b7: 'N', h8: 'K' });
  b.hand = [{ t: 'R', id: 1, eng: null }];
  b.movesLeft = 1;
  b.target = 1e15;
  const ev = [...applyRun(run, { type: 'drop', handIndex: 0, sq: S('a1') }), ...applyRun(run, { type: 'capture', sq: S('a5') })];
  assert.ok(ev.some((e) => e.type === 'nemesisNew' && e.piece === 'N'));
  assert.deepEqual(run.nemesis, { t: 'N', lv: 1, ante: 1, blind: 0 });
  assert.deepEqual(run.log.at(-1).nemesis, { lv: 0, t: null, placed: false, taken: 0, ups: 0, born: 'N' });
  // 다음 대국은 숙적을 넘겨받는다(관 선택의 판 보기와 같은 대국)
  applyRun(run, { type: 'leave' });
  const saved = clone(run);
  applyRun(run, { type: 'play' });
  assert.deepEqual(run.battle.nem.cur, { t: 'N', lv: 1 });
  const s2 = clone(saved);
  applyRun(s2, { type: 'play' });
  assert.deepEqual(clone(s2.battle), clone(run.battle), '저장 왕복한 판에서 같은 대국');
  // 숙적을 잡게 판을 갈아 끼워 이긴다
  run.battle.board = boardFrom({ a5: 'P', h8: 'K' });
  run.battle.board[S('a5')].nem = 1;
  run.battle.hand = [{ t: 'R', id: 1, eng: null }];
  run.battle.target = 1;
  const ev2 = [...applyRun(run, { type: 'drop', handIndex: 0, sq: S('a1') }), ...applyRun(run, { type: 'capture', sq: S('a5') })];
  assert.ok(ev2.some((e) => e.type === 'nemesisGone' && e.won));
  assert.equal(run.nemesis, null);
  assert.equal(run.last.reward.earned, nemesisBounty(1));
  assert.equal(run.log.at(-1).nemesis.taken, 1);
});

test('꺼짐: 도전 · 숙적 스위치를 끄면 대국에 붙지 않는다', () => {
  const was = [CHALLENGE.on, NEMESIS.on];
  CHALLENGE.on = false; NEMESIS.on = false;
  try {
    const run = createRun({ seed: 2 });
    playRun(run, 'none');
    assert.ok(run.log.every((x) => !x.challenge && !x.nemesis));
    assert.equal(run.nemesis, null);
  } finally { [CHALLENGE.on, NEMESIS.on] = was; }
});

test('오늘의 대국: 도전 · 숙적이 든 판도 서버가 같은 성적과 상금으로 다시 둔다', () => {
  const run = createDailyRun('2026-11-02');
  playRun(run, 'none');
  const played = run.log.filter((x) => !x.skipped);
  assert.ok(played.some((x) => x.challenge && x.challenge.done), '이룬 도전이 있다');
  assert.ok(played.some((x) => x.nemesis && x.nemesis.born), '숙적이 생겼다');
  const got = verifyDaily('2026-11-02', clone(run.cmds));
  const { used, ...rest } = got;
  assert.deepEqual(rest, summarize(run));
  // 서버의 다시 두기도 같은 상금 · 숙적
  const again = createDailyRun('2026-11-02');
  for (const c of clone(run.cmds)) applyRun(again, c);
  assert.equal(again.money, run.money);
  assert.deepEqual(again.nemesis, run.nemesis);
  assert.deepEqual(again.log, run.log);
});

test('쫓는 봇의 줄 평가: 이번 수로 이기는 줄이 늘 앞, 이기는 줄끼리는 도전을 이루는 줄, 못 이기는 줄끼리는 덤', () => {
  const b = createBattle({ seed: 1, target: 1000, challenge: { id: 'take', n: 3, reward: 2 } });
  const w = CHASE.weight;
  CHASE.weight = 0.25;
  const rank = chaseRank(b);
  CHASE.weight = w;
  const line = (score, captures) => ({ score, h: sum({ captures }) });
  assert.ok(rank(line(1000, 1)) > rank(line(999, 3)), '이기는 줄이 먼저');
  assert.ok(rank(line(1000, 3)) > rank(line(5000, 1)), '이기는 줄끼리는 도전');
  assert.ok(rank(line(5000, 1)) > rank(line(1000, 1)), '그다음 점수');
  assert.ok(rank(line(600, 3)) > rank(line(800, 1)), '덤 0.25 × 남은 목표');
  assert.ok(rank(line(400, 3)) < rank(line(800, 1)));
  b.challenge.done = true;
  assert.equal(chaseRank(b), null, '이룬 뒤에는 덤이 없다');
  b.challenge.done = false;
  CHASE.on = false;
  try { assert.equal(chaseRank(b), null, '무시하는 봇'); } finally { CHASE.on = true; }
});

test('영어: 도전 · 숙적 화면 글이 모두 옮겨진다', async () => {
  const { missing } = await import('../src/ui/lang.js');
  const { HINTS } = await import('../src/ui/coach.js');
  const texts = [
    ...[3, 4].map((n) => challengeText({ id: 'forms', n })), ...[4, 5, 6, 7, 8].map((n) => challengeText({ id: 'take', n })),
    ...['N', 'B', 'R'].map((form) => challengeText({ id: 'end', form })),
    ...['guards', 'promote', 'mate', 'same'].map((id) => challengeText({ id, n: 2 })),
    ...Object.values(CHALLENGE_TEXT).map((x) => (typeof x === 'function' ? x(2) : x)),
    ...Object.values(NEMESIS_TEXT).map((x) => (typeof x === 'function' ? x(3) : x)),
    HINTS.challenge, HINTS.nemesis,
  ];
  assert.ok(texts.every(Boolean));
  assert.deepEqual(missing(texts), []);
});
