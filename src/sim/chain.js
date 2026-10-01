// 사슬 한 수를 한 칸씩 진행하는 상태 기계.
// 다루는 대상 t는 { board, rules, mods, chain, ... } 모양이면 된다(대국 상태 자체, 또는 풀이기가 복사한 탁자).
//   startChain(t, { type, sq, engraving, soul, pieceId }) → events   떨구기(pieceId: 탁월수 판정용 손 기물 id)
//   chainCaptures(t)                        → [sq]     지금 먹을 수 있는 칸(응수 제한 · 조정자 거름 반영)
//   chainCapture(t, sq)                     → events   먹기 한 번
//   chainRedrops(t)                         → [sq]     다시 떨굴 칸(onChainStop에서 redrop한 뒤에만)
//   chainRedrop(t, sq)                      → events   다시 떨구기
// 이벤트: drop · capture · golden · grade · transform · promote · forced · cut · cutIgnored · mate · brilliant · refill ·
//         redropReady · redrop · end · score
// 사슬이 끝나면 t.chain.done = true, 내 기물은 판에서 내려간다.
import { attackers, captures, dropSquares, isAttacked, rankOf, isEnemy, kingTakeable, at } from './board.js';
import { PIECES } from '../data/pieces.js';
import { runHook, finalScore } from './scoring.js';
import { createRng, fork } from './rng.js';
import { generateBoard } from './setup.js';
import { UP, ABSORB } from '../data/souls.js';
import { brilliantMult } from '../data/sacrifice.js';

const NO_OPTS = {};
// 판에 이형 적이 없으면(t.fairyFree) 노림 판정의 이형 줄을 건너뛴다(탐색 마디마다 25%를 쓰던 곳)
const NO_FAIRY = { fairy: false };
export const boardOpts = (t) => {
  const r = t.rules;
  if (!r || (!r.pawnSides && !r.openKings && !r.highways)) return t.fairyFree ? NO_FAIRY : NO_OPTS;
  return { pawnSides: !!r.pawnSides, openKings: !!r.openKings, highways: r.highways || null, fairy: t.fairyFree ? false : undefined };
};
// 판의 적 중 이형이 하나라도 있나(판이 바뀌어 적이 들어올 때마다 다시 잰다: 대국 시작 · 증원 · 다시 채움 · 도발)
export const markFairy = (t) => { t.fairyFree = !t.board.some((c) => c && !c.mine && FAIRY_SET.has(c.t)); };
const FAIRY_SET = new Set(['A', 'C', 'Z', 'L', 'H', 'G', 'O', 'S', 'W']);

// 사슬 평가(기보 표기). 먹은 수가 이 값에 닿는 순간 「grade」 이벤트.
export const GRADES = [
  { n: 3, mark: '!' },
  { n: 5, mark: '!!' },
  { n: 8, mark: '!!!' },
  { n: 12, mark: '∞' },
];
export const gradeOf = (n) => GRADES.reduce((g, x) => (n >= x.n ? x : g), null);

export const PROMOTE_RANK = 7;

export function startChain(t, { type, sq, engraving = null, soul = null, pieceId = null }) {
  const events = [];
  t.chain = {
    dropType: type, dropSq: sq, engraving: engraving || null, soul: soul || null,
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
  // 희생(CHM-35): 바로 앞에 바친 기물(t.offering). 희생으로 새로 뽑은 기물(off.drawn)로 시작한 사슬이 체크메이트로 끝나면 탁월수(finish).
  // 비우는 곳은 battle.js endMove
  const off = t.offering;
  if (off && off.count) {
    t.chain.offered = off.count;
    if (pieceId != null && (off.drawn || []).includes(pieceId)) { t.chain.offerWeight = off.weight || 0; t.chain.offerPieces = off.pieces || []; }
  }
  runHook(t, 'onDrop', { type, sq }, events);
  if (chainCaptures(t).length === 0) stop(t, 'blocked', events);
  return events;
}

export function chainCaptures(t) {
  const c = t.chain;
  if (!c || c.done || c.awaiting) return [];
  const bo = c.captures.length ? boardOpts(t) : { ...boardOpts(t), first: true };
  let list = captures(t.board, c.form, c.sq, bo);
  // 「변신」 문턱 6: 지나온 모습 전부의 행마로(한 번)
  if (c.flags.union) for (const f of c.forms) for (const s of captures(t.board, f, c.sq, bo)) if (!list.includes(s)) list.push(s);
  // 흡수: 먹은 행마가 더해진다(모습은 그대로)
  if (c.absorbed) for (const f of c.absorbed) for (const s of captures(t.board, f, c.sq, bo)) if (!list.includes(s)) list.push(s);
  // 혼 「역행」: 폰 모습이면(각성하면 어느 모습이든) 아래 대각으로도 · 혼 「도약」: 첫 먹기(각성하면 둘째까지)는 두 칸 안의 적 어디든(밤샘 2)
  if (c.flags.pawnBack && (c.form === 'P' || c.flags.pawnBack === 'any')) for (const df of [-1, 1]) { const s = at((c.sq & 7) + df, (c.sq >> 3) - 1); if (s >= 0 && takeableAt(t, s, c.sq, bo) && !list.includes(s)) list.push(s); }
  if (c.flags.spring && c.captures.length < c.flags.spring) {
    for (let df = -2; df <= 2; df++) for (let dr = -2; dr <= 2; dr++) {
      const s = at((c.sq & 7) + df, (c.sq >> 3) + dr);
      if (s >= 0 && s !== c.sq && takeableAt(t, s, c.sq, bo) && !list.includes(s)) list.push(s);
    }
  }
  if (c.forced) list = list.filter((s) => c.forced.includes(s));
  if (list.length && ((t.mods && t.mods.length) || c.engraving || c.soul)) {
    list = list.filter((s) => runHook(t, 'allowCapture', { from: c.sq, to: s, piece: t.board[s].t, form: c.form }));
  }
  return list;
}

// 행마와 상관없이 s의 적을 먹을 수 있나(벽 · 방패 · 지켜진 킹 규칙은 captures와 같다)
function takeableAt(t, s, from, bo) {
  const x = t.board[s];
  if (!isEnemy(x) || x.t === 'X') return false;
  if (x.trait === 'shield' && bo.first) return false;
  if (x.t === 'K' && !bo.openKings && !kingTakeable(t.board, s, from, bo)) return false;
  return true;
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
  c.flags.union = false;

  // 궁수 모습은 움직이지 않고 쏜다: 먹힌 칸만 비고 내 기물은 제자리(응수도 제자리 기준)
  const stay = formBefore === 'S';
  const at = stay ? from : sq;
  board[sq] = null;
  board[from] = null;
  board[at] = { t: c.form, mine: true };
  c.sq = at;
  const dist = Math.max(Math.abs((from & 7) - (sq & 7)), Math.abs((from >> 3) - (sq >> 3)));
  const cap = { from, to: sq, piece: target.t, form: formBefore, dist, index: c.captures.length, forced: wasForced, born: target.born ?? -1, gold: !!target.gold, stay };
  c.captures.push(cap);
  if (wasForced) c.forcedReplies++;
  events.push({ type: 'capture', ...cap, value: PIECES[target.t].value });

  // 1. 기본: 값 += 먹힌 기물 값, 배수 += 1
  c.value += PIECES[target.t].value;
  c.mult += 1;
  // 금빛 적: 값을 한 번 더 받는다. 판(런)이 대국 뒤 금빛 꾸러미 · 조각으로 바꾼다
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

  // 적 특성(깊이 D): 폭약은 둘레 적을 함께 · 배신자는 대국 뒤 내 주머니로
  if (target.trait === 'bomb') blast(t, sq, events);
  if (target.trait === 'traitor' && target.t !== 'K') { (c.traitors || (c.traitors = [])).push(target.t); events.push({ type: 'traitor', sq, piece: target.t }); }
  // 보석(판 위 사물): 모습은 그대로, 상금 +2 · 허수아비(적 특성, id mirror): 모습이 바뀌지 않는다
  if (target.trait === 'mirror') {
    events.push({ type: 'mirrored', sq: at });
  } else if (target.t === 'J') {
    c.money = (c.money || 0) + 2;
    events.push({ type: 'money', src: 'gem', money: 2 });
  } else if (c.flags.absorb && target.t !== 'K' && c.captures.length <= ABSORB.takes) {
    // 흡수는 가장 최근에 먹은 행마 하나만 더한다(쌓이게 두면 모든 응수를 받아 첫 수 외통이 판의 절반이 됐다 — 하네스 30판).
    // 각성한 흡수는 absorbKeep(둘)까지 쌓는다(새것이 앞)
    if (target.t !== c.form && (c.absorbed || [])[0] !== target.t) {
      c.absorbed = [target.t, ...(c.absorbed || []).filter((x) => x !== target.t)].slice(0, c.flags.absorbKeep || 1);
      events.push({ type: 'absorb', piece: target.t, sq: at, forms: [c.form, ...c.absorbed] });
    }
  } else if (c.flags.transcend && target.t !== 'K') {
    // 혼 「초월」: 먹힌 모습 대신 한 단계 위로
    const up = UP[c.form];
    if (up) {
      const prev = c.form;
      c.form = up;
      c.transforms++;
      t.board[at] = { t: c.form, mine: true };
      events.push({ type: 'transform', from: prev, to: c.form, sq: at });
      runHook(t, 'onTransform', { from: prev, to: c.form }, events);
    }
  } else if (target.t !== c.form) {
    const prev = c.form;
    c.form = target.t;
    c.transforms++;
    t.board[at] = { t: c.form, mine: true };
    events.push({ type: 'transform', from: prev, to: c.form, sq: at });
    runHook(t, 'onTransform', { from: prev, to: c.form }, events);
  }
  if (!c.forms.includes(c.form)) c.forms.push(c.form);

  // 승급: 폰 모습으로 끝줄(조정자가 flags.promoteFrom으로 당길 수 있다 — 전설 「폰 여덟의 행진」)
  if (c.form === 'P' && rankOf(at) >= (c.flags.promoteFrom ?? PROMOTE_RANK)) {
    // 혼 「왕관」은 아마존으로(flags.promoteTo)
    c.form = c.flags.promoteTo || 'Q';
    c.promotions++;
    t.board[at] = { t: c.form, mine: true };
    events.push({ type: 'promote', sq: at, to: c.form });
    runHook(t, 'onPromote', { sq }, events);
    if (!c.forms.includes(c.form)) c.forms.push(c.form);
  }

  // 판의 문(정석 「판의 문」): 문 위의 적을 먹으면 다른 문(비었으면)으로 나온다
  const gates = t.rules && t.rules.gates;
  if (gates && gates.includes(c.sq)) {
    const other = gates[0] === c.sq ? gates[1] : gates[0];
    if (!t.board[other]) {
      t.board[other] = t.board[c.sq];
      t.board[c.sq] = null;
      events.push({ type: 'gate', from: c.sq, to: other });
      c.sq = other;
    }
  }

  resolveReply(t, events);
  return events;
}

// 폭약: 둘레 여덟 칸의 적(킹 · 벽 빼고)을 함께 먹은 것으로(값 · 배수 +1씩). 폭약이 폭약을 터뜨리면 이어진다
function blast(t, sq, events) {
  const c = t.chain, board = t.board;
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = (sq & 7) + df, r = (sq >> 3) + dr;
    if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
    const s = r * 8 + f, x = board[s];
    if (!x || x.mine || x.t === 'K' || x.t === 'X') continue;
    board[s] = null;
    events.push({ type: 'pierce', sq: s, piece: x.t, gold: !!x.gold, src: 'bomb' });
    c.value += PIECES[x.t].value;
    c.mult += 1;
    events.push({ type: 'score', src: 'bomb', value: PIECES[x.t].value, mult: 1 });
    if (x.trait === 'bomb') blast(t, s, events);
  }
}

// 외통 뒤 판을 새로 채운다. 판은 (대국 시드, 몇째 수, 몇째 채움)으로 정해진다 — 풀이기가 그려 봐도,
// 실제로 두어도 같은 판이고 대국의 난수 스트림은 건드리지 않는다.
// 내 기물 칸은 비워 두고, 그 칸이 노려지지 않으면서 킹 모습으로 먹을 적이 곁에 있는 판을 고른다(20번 안에서).
// 같은 (시드 · 수 · 채움 · 칸 · 규칙 · 관)이면 같은 판이라 지어 둔 것을 다시 쓴다(풀이기가 같은 외통 칸에 수없이 닿는다).
const REFILLS = new Map();
function refill(t, events) {
  const c = t.chain;
  c.refills++;
  const key = `${t.seed ?? 1}|${t.movesUsed ?? 0}|${c.refills}|${c.sq}|${t.ante ?? 1}|${JSON.stringify(t.rules || {})}`;
  let hit = REFILLS.get(key);
  if (!hit) {
    const rng = fork(createRng((t.seed ?? 1) >>> 0), `refill:${t.movesUsed ?? 0}:${c.refills}`);
    const tb = { rules: t.rules || {}, ante: t.ante ?? 1, nextId: 0 };
    let board = null;
    for (let i = 0; i < 20; i++) {
      board = generateBoard(tb, rng, [c.sq]);
      board[c.sq] = { t: 'K', mine: true };
      if (!isAttacked(board, c.sq, boardOpts(t)) && captures(board, 'K', c.sq, boardOpts(t)).length) break;
    }
    board[c.sq] = null;
    if (REFILLS.size > 2000) REFILLS.clear();
    hit = { board, ids: tb.nextId };
    REFILLS.set(key, hit);
  }
  // id는 대국의 nextId에서 이어 붙인다(지을 때는 0부터 셌다)
  const base = t.nextId ?? 1000;
  const board = hit.board.map((x) => (x ? { ...x, id: x.id + base } : null));
  board[c.sq] = { t: c.form, mine: true };
  t.nextId = base + hit.ids;
  t.board = board;
  markFairy(t);
  events.push({ type: 'refill', sq: c.sq, count: c.refills, enemies: board.filter(isEnemy).length });
}

// 응수와 끊김. 판정 한 곳(규칙을 바꾸면 여기만 고친다).
// 먹은 칸을 노리는 적(노림수)이 있으면 다음 먹기는 그중 하나여야 한다.
// 지금 모습으로 하나도 못 먹으면 끊김(조정자가 cancelCut하면 제한을 풀고 이어 간다).
function resolveReply(t, events) {
  const c = t.chain;
  const opts = boardOpts(t);
  let threats = attackers(t.board, c.sq, opts);
  c.forced = null;
  if (threats.length && runHook(t, 'onThreat', { sq: c.sq, attackers: threats.slice() }, events)) {
    events.push({ type: 'threatIgnored', sq: c.sq, attackers: threats.slice() });
    threats = [];
  }
  if (threats.length) {
    c.forced = threats;
    // 명인 「철벽」(rules.noReply): 응수가 없다 — 노려진 칸을 먹으면 곧바로 끊긴다
    if (!(t.rules && t.rules.noReply) && chainCaptures(t).length > 0) {
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
  if (reason === 'blocked' && runHook(t, 'onBlocked', { reason }, events) && chainCaptures(t).length) {
    events.push({ type: 'union', forms: c.forms.slice(), sq: c.sq });
    return;
  }
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
  const list = dropSquares(t.board, c.form, { ...boardOpts(t), allowAttacked: allow.attacked });
  // 명인 「안개」: 안개 속에는 떨굴 수 없다(battle.js fogFilter와 같은 규칙)
  return t.rules && t.rules.fog ? list.filter((s) => rankOf(s) < 8 - t.rules.fog) : list;
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
  // 탁월수 !!: 바친 바로 다음 사슬이 체크메이트로 끝났다 — 마지막 배수에 ×(1 + 바친 무게)
  if (reason === 'mate' && c.offerWeight) {
    const x = brilliantMult(c.offerWeight);
    c.mult *= x;
    events.push({ type: 'score', src: 'brilliant', xmult: x });
    c.brilliant = { weight: c.offerWeight, x, pieces: (c.offerPieces || []).slice() };
  }
  c.score = finalScore(c);
  if (c.brilliant) events.push({ type: 'brilliant', ...c.brilliant, score: c.score });
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
    ...(c.soul ? { soul: c.soul.id.replace(/^soul:/, '') } : {}),
  };
}
