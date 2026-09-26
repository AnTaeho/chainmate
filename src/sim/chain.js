// 사슬 한 수를 한 칸씩 진행하는 상태 기계.
// 다루는 대상 t는 { board, rules, mods, chain, ... } 모양이면 된다(대국 상태 자체, 또는 풀이기가 복사한 탁자).
//   startChain(t, { type, sq, engraving }) → events   떨구기
//   chainCaptures(t)                        → [sq]     지금 먹을 수 있는 칸(응수 제한 · 조정자 거름 반영)
//   chainCapture(t, sq)                     → events   먹기 한 번
//   chainRedrops(t)                         → [sq]     다시 떨굴 칸(onChainStop에서 redrop한 뒤에만)
//   chainRedrop(t, sq)                      → events   다시 떨구기
// 이벤트: drop · capture · golden · grade · transform · promote · forced · cut · cutIgnored · mate · refill ·
//         redropReady · redrop · end · score
// 사슬이 끝나면 t.chain.done = true, 내 기물은 판에서 내려간다.
import { attackers, captures, dropSquares, isAttacked, rankOf, isEnemy } from './board.js';
import { PIECES } from '../data/pieces.js';
import { runHook, finalScore } from './scoring.js';
import { createRng, fork } from './rng.js';
import { generateBoard } from './setup.js';

export const boardOpts = (t) => (t.rules && t.rules.pawnSides ? { pawnSides: true } : {});

// 사슬 평가(기보 표기). 먹은 수가 이 값에 닿는 순간 「grade」 이벤트.
export const GRADES = [
  { n: 3, mark: '!' },
  { n: 5, mark: '!!' },
  { n: 8, mark: '!!!' },
  { n: 12, mark: '∞' },
];
export const gradeOf = (n) => GRADES.reduce((g, x) => (n >= x.n ? x : g), null);

export const PROMOTE_RANK = 7;

export function startChain(t, { type, sq, engraving = null }) {
  const events = [];
  t.chain = {
    dropType: type, dropSq: sq, engraving: engraving || null,
    sq, form: type,
    value: 0, mult: 0, scoreMul: 1, money: 0,
    captures: [], forms: [type],
    forced: null, flags: {},
    transforms: 0, promotions: 0, forcedReplies: 0,
    cuts: 0, mates: 0, refills: 0, redrops: 0, awaiting: false, golden: 0,
    done: false, reason: null, score: 0,
  };
  t.board[sq] = { t: type, mine: true };
  events.push({ type: 'drop', piece: type, sq });
  runHook(t, 'onDrop', { type, sq }, events);
  if (chainCaptures(t).length === 0) stop(t, 'blocked', events);
  return events;
}

export function chainCaptures(t) {
  const c = t.chain;
  if (!c || c.done || c.awaiting) return [];
  let list = captures(t.board, c.form, c.sq, boardOpts(t));
  if (c.forced) list = list.filter((s) => c.forced.includes(s));
  if (list.length && ((t.mods && t.mods.length) || c.engraving)) {
    list = list.filter((s) => runHook(t, 'allowCapture', { from: c.sq, to: s, piece: t.board[s].t, form: c.form }));
  }
  return list;
}

export function chainCapture(t, sq) {
  const c = t.chain;
  if (!c || c.done) throw new Error('no active chain');
  if (!chainCaptures(t).includes(sq)) throw new Error(`illegal capture ${sq}`);
  const events = [];
  const board = t.board;
  const from = c.sq;
  const target = board[sq];
  const formBefore = c.form;
  const wasForced = !!c.forced;

  board[from] = null;
  board[sq] = { t: c.form, mine: true };
  c.sq = sq;
  const dist = Math.max(Math.abs((from & 7) - (sq & 7)), Math.abs((from >> 3) - (sq >> 3)));
  const cap = { from, to: sq, piece: target.t, form: formBefore, dist, index: c.captures.length, forced: wasForced, born: target.born ?? -1, gold: !!target.gold };
  c.captures.push(cap);
  if (wasForced) c.forcedReplies++;
  events.push({ type: 'capture', ...cap, value: PIECES[target.t].value });

  // 1. 기본: 값 += 먹힌 기물 값, 연쇄 += 1
  c.value += PIECES[target.t].value;
  c.mult += 1;
  // 황금 기물: 값을 한 번 더 받는다. 판(런)이 대국 뒤 금빛 꾸러미 · 조각으로 바꾼다
  if (target.gold) {
    c.golden++;
    c.value += PIECES[target.t].value;
    events.push({ type: 'golden', sq, piece: target.t });
    events.push({ type: 'score', src: 'golden', value: PIECES[target.t].value });
  }
  // 2~3. 기보 · 격언 먹기 반응
  runHook(t, 'onCapture', cap, events);
  const grade = GRADES.find((g) => g.n === c.captures.length);
  if (grade) events.push({ type: 'grade', n: grade.n, mark: grade.mark });

  // 외통: 마지막 킹을 먹으면 사슬과 대국이 끝난다(onMate가 keepGoing하면 판을 다시 채워 잇는다)
  if (target.t === 'K' && !board.some((x) => isEnemy(x) && x.t === 'K')) {
    c.mates++;
    events.push({ type: 'mate', sq });
    if (!runHook(t, 'onMate', { sq, mates: c.mates }, events)) {
      finish(t, 'mate', events);
      return events;
    }
    refill(t, events);
  }

  // 갈아입기
  if (target.t !== c.form) {
    const prev = c.form;
    c.form = target.t;
    c.transforms++;
    t.board[sq] = { t: c.form, mine: true };
    events.push({ type: 'transform', from: prev, to: c.form, sq });
    runHook(t, 'onTransform', { from: prev, to: c.form }, events);
  }
  if (!c.forms.includes(c.form)) c.forms.push(c.form);

  // 승급: 폰 모습으로 끝줄(조정자가 flags.promoteFrom으로 당길 수 있다 — 전설 「폰 여덟의 행진」)
  if (c.form === 'P' && rankOf(sq) >= (c.flags.promoteFrom ?? PROMOTE_RANK)) {
    c.form = 'Q';
    c.promotions++;
    t.board[sq] = { t: 'Q', mine: true };
    events.push({ type: 'promote', sq });
    runHook(t, 'onPromote', { sq }, events);
    if (!c.forms.includes('Q')) c.forms.push('Q');
  }

  resolveReply(t, events);
  return events;
}

// 외통 뒤 판을 새로 채운다. 판은 (대국 시드, 몇째 수, 몇째 채움)으로 정해진다 — 풀이기가 그려 봐도,
// 실제로 두어도 같은 판이고 대국의 난수 스트림은 건드리지 않는다.
// 내 기물 칸은 비워 두고, 그 칸이 노려지지 않으면서 킹 모습으로 먹을 적이 곁에 있는 판을 고른다(20번 안에서).
function refill(t, events) {
  const c = t.chain;
  c.refills++;
  const rng = fork(createRng((t.seed ?? 1) >>> 0), `refill:${t.movesUsed ?? 0}:${c.refills}`);
  const tb = { rules: t.rules || {}, ante: t.ante ?? 1, nextId: t.nextId ?? 1000 };
  let board = null;
  for (let i = 0; i < 20; i++) {
    board = generateBoard(tb, rng, [c.sq]);
    board[c.sq] = { t: 'K', mine: true };
    if (!isAttacked(board, c.sq, boardOpts(t)) && captures(board, 'K', c.sq, boardOpts(t)).length) break;
  }
  board[c.sq] = { t: c.form, mine: true };
  t.nextId = tb.nextId;
  t.board = board;
  events.push({ type: 'refill', sq: c.sq, count: c.refills, enemies: board.filter(isEnemy).length });
}

// 응수와 끊김. 판정 한 곳(규칙을 바꾸면 여기만 고친다).
// 먹은 칸을 노리는 적(노림수)이 있으면 다음 먹기는 그중 하나여야 한다.
// 지금 모습으로 하나도 못 먹으면 끊김(조정자가 cancelCut하면 제한을 풀고 이어 간다).
function resolveReply(t, events) {
  const c = t.chain;
  const opts = boardOpts(t);
  const threats = attackers(t.board, c.sq, opts);
  c.forced = null;
  if (threats.length) {
    c.forced = threats;
    if (chainCaptures(t).length > 0) {
      events.push({ type: 'forced', sq: c.sq, attackers: threats.slice() });
      runHook(t, 'onForced', { sq: c.sq, attackers: threats.slice() }, events);
      return;
    }
    c.cuts++;
    const cancelled = runHook(t, 'onCut', { sq: c.sq, attackers: threats.slice() }, events);
    if (!cancelled) {
      events.push({ type: 'cut', sq: c.sq, attackers: threats.slice() });
      stop(t, 'cut', events);
      return;
    }
    c.forced = null;
    events.push({ type: 'cutIgnored', sq: c.sq, attackers: threats.slice() });
  }
  if (chainCaptures(t).length === 0) stop(t, 'blocked', events);
}

// 사슬이 멈춘다(끊김 · 막힘). 한 번은 onChainStop이 redrop으로 떨굴 칸을 다시 고르게 할 수 있다.
function stop(t, reason, events) {
  const c = t.chain;
  if (!c.redrops && runHook(t, 'onChainStop', { reason }, events)) {
    c.redrops++;
    c.forced = null;
    if (t.board[c.sq] && t.board[c.sq].mine) t.board[c.sq] = null;
    c.awaiting = true;
    const squares = chainRedrops(t);
    if (squares.length) {
      events.push({ type: 'redropReady', form: c.form, reason, squares });
      return;
    }
    c.awaiting = false;
  }
  finish(t, reason, events);
}

// 다시 떨굴 칸: 지금 모습으로 보통 떨구기와 같은 규칙(각인 「깃」 등 onDropCheck 반영)
export function chainRedrops(t) {
  const c = t.chain;
  if (!c || c.done || !c.awaiting) return [];
  const allow = { attacked: false };
  runHook(t, 'onDropCheck', { type: c.form, engraving: c.engraving, allow }, []);
  return dropSquares(t.board, c.form, { ...boardOpts(t), allowAttacked: allow.attacked });
}

export function chainRedrop(t, sq) {
  const c = t.chain;
  if (!chainRedrops(t).includes(sq)) throw new Error(`illegal redrop ${sq}`);
  const events = [];
  c.awaiting = false;
  c.sq = sq;
  t.board[sq] = { t: c.form, mine: true };
  events.push({ type: 'redrop', piece: c.form, sq });
  if (chainCaptures(t).length === 0) stop(t, 'blocked', events);
  return events;
}

function finish(t, reason, events) {
  const c = t.chain;
  c.done = true;
  c.reason = reason;
  c.forced = null;
  c.awaiting = false;
  runHook(t, 'onChainEnd', { reason }, events);
  c.score = finalScore(c);
  if (t.board[c.sq] && t.board[c.sq].mine) t.board[c.sq] = null;
  events.push({ type: 'end', reason, value: c.value, mult: c.mult, score: c.score, captures: c.captures.length, money: c.money });
}

// 끝난 사슬 한 줄 요약(대국 기록 · 풀이기 · 재현 판정이 같은 꼴을 쓴다). move = 대국의 몇째 수(0부터)
export function chainSummary(c, move = 0) {
  return {
    piece: c.dropType, sq: c.dropSq, value: c.value, mult: c.mult, score: c.score, reason: c.reason, money: c.money || 0,
    captures: c.captures.length, transforms: c.transforms, promotions: c.promotions, forced: c.forcedReplies,
    caps: c.captures.map((x) => x.piece).join(''), cuts: c.cuts, mates: c.mates, golden: c.golden,
    refills: c.refills, redrops: c.redrops, move,
  };
}
