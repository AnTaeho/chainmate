// 사슬 한 수를 한 칸씩 진행하는 상태 기계.
// 다루는 대상 t는 { board, rules, mods, chain, ... } 모양이면 된다(대국 상태 자체, 또는 풀이기가 복사한 탁자).
//   startChain(t, { type, sq, engraving }) → events   떨구기
//   chainCaptures(t)                        → [sq]     지금 먹을 수 있는 칸(응수 제한 · 조정자 거름 반영)
//   chainCapture(t, sq)                     → events   먹기 한 번
// 이벤트: drop · capture · transform · promote · forced · cut · cutIgnored · mate · end · score
// 사슬이 끝나면 t.chain.done = true, 내 기물은 판에서 내려간다.
import { attackers, captures, rankOf, isEnemy } from './board.js';
import { PIECES } from '../data/pieces.js';
import { runHook, finalScore } from './scoring.js';

export const boardOpts = (t) => (t.rules && t.rules.pawnSides ? { pawnSides: true } : {});

export function startChain(t, { type, sq, engraving = null }) {
  const events = [];
  t.chain = {
    dropType: type, dropSq: sq, engraving: engraving || null,
    sq, form: type,
    value: 0, mult: 0, scoreMul: 1,
    captures: [], forms: [type],
    forced: null, flags: {},
    transforms: 0, promotions: 0, forcedReplies: 0,
    done: false, reason: null, score: 0,
  };
  t.board[sq] = { t: type, mine: true };
  events.push({ type: 'drop', piece: type, sq });
  runHook(t, 'onDrop', { type, sq }, events);
  if (chainCaptures(t).length === 0) finish(t, 'blocked', events);
  return events;
}

export function chainCaptures(t) {
  const c = t.chain;
  if (!c || c.done) return [];
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
  const cap = { from, to: sq, piece: target.t, form: formBefore, dist, index: c.captures.length, forced: wasForced, born: target.born ?? -1 };
  c.captures.push(cap);
  if (wasForced) c.forcedReplies++;
  events.push({ type: 'capture', ...cap, value: PIECES[target.t].value });

  // 1. 기본: 값 += 먹힌 기물 값, 연쇄 += 1
  c.value += PIECES[target.t].value;
  c.mult += 1;
  // 2~3. 기보 · 격언 먹기 반응
  runHook(t, 'onCapture', cap, events);

  // 외통: 마지막 킹을 먹으면 사슬과 대국이 끝난다
  if (target.t === 'K' && !board.some((x) => isEnemy(x) && x.t === 'K')) {
    events.push({ type: 'mate', sq });
    finish(t, 'mate', events);
    return events;
  }

  // 갈아입기
  if (target.t !== c.form) {
    const prev = c.form;
    c.form = target.t;
    c.transforms++;
    board[sq] = { t: c.form, mine: true };
    events.push({ type: 'transform', from: prev, to: c.form, sq });
    runHook(t, 'onTransform', { from: prev, to: c.form }, events);
  }
  if (!c.forms.includes(c.form)) c.forms.push(c.form);

  // 승급: 폰 모습으로 rank 7
  if (c.form === 'P' && rankOf(sq) === 7) {
    c.form = 'Q';
    c.promotions++;
    board[sq] = { t: 'Q', mine: true };
    events.push({ type: 'promote', sq });
    runHook(t, 'onPromote', { sq }, events);
    if (!c.forms.includes('Q')) c.forms.push('Q');
  }

  resolveReply(t, events);
  return events;
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
    const cancelled = runHook(t, 'onCut', { sq: c.sq, attackers: threats.slice() }, events);
    if (!cancelled) {
      events.push({ type: 'cut', sq: c.sq, attackers: threats.slice() });
      finish(t, 'cut', events);
      return;
    }
    c.forced = null;
    events.push({ type: 'cutIgnored', sq: c.sq, attackers: threats.slice() });
  }
  if (chainCaptures(t).length === 0) finish(t, 'blocked', events);
}

function finish(t, reason, events) {
  const c = t.chain;
  c.done = true;
  c.reason = reason;
  c.forced = null;
  runHook(t, 'onChainEnd', { reason }, events);
  c.score = finalScore(c);
  if (t.board[c.sq] && t.board[c.sq].mine) t.board[c.sq] = null;
  events.push({ type: 'end', reason, value: c.value, mult: c.mult, score: c.score, captures: c.captures.length });
}
