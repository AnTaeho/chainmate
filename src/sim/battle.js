// 대국 하나: 손 · 주머니 · 수 · 무르기 · 증원 · 승패.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 apply(b, cmd) 하나뿐.
//   { type: 'drop', handIndex, sq }  { type: 'capture', sq }  { type: 'discard', handIndices }
import { createRng, fork, int, next, shuffle } from './rng.js';
import { attackers, dropSquares, emptyBoard, fileOf, rankOf } from './board.js';
import { startChain, chainCapture, chainCaptures, boardOpts } from './chain.js';
import { runHook } from './scoring.js';

export const DEFAULT_BAG = ['P', 'P', 'P', 'P', 'N', 'N', 'B', 'R'];
export const BASE_REWARD = { practice: 3, official: 4, master: 5 };

export const DEFAULT_RULES = {
  hand: 4,          // 손
  moves: 4,         // 수
  discards: 3,      // 무르기
  maxDiscard: 4,    // 한 번에 버리는 최대 수
  kings: 1,         // 킹 수(명인 「대가」 2)
  enemies: null,    // null이면 7 + 관
  reinforce: null,  // 수마다 증원 수. null이면 관 1~3: 1, 4관부터: 2
  pawnSides: false, // 명인 「철벽」
};

// 관이 오를수록 무거운 적. 초안 — step 2에서 시뮬로 맞춘다.
export function enemyWeights(ante) {
  return [
    ['P', Math.max(2, 7 - 0.6 * ante)],
    ['N', 2 + 0.1 * ante],
    ['B', 2 + 0.1 * ante],
    ['R', 1 + 0.25 * ante],
    ['Q', 0.3 + 0.2 * ante],
  ];
}
function rollType(rng, ante) {
  const w = enemyWeights(ante);
  let total = 0;
  for (const [, x] of w) total += x;
  let r = next(rng) * total;
  for (const [t, x] of w) { if ((r -= x) < 0) return t; }
  return w[w.length - 1][0];
}

function randomEmpty(rng, board, minRank, exclude = []) {
  const free = [];
  for (let sq = minRank * 8; sq < 64; sq++) if (!board[sq] && !exclude.includes(sq)) free.push(sq);
  return free.length ? free[int(rng, free.length)] : -1;
}

function generateBoard(b) {
  const rng = b.rng.board;
  const count = b.rules.enemies ?? 7 + b.ante;
  const kings = b.rules.kings;
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = emptyBoard();
    const ksqs = [];
    for (let k = 0; k < kings; k++) {
      const sq = randomEmpty(rng, board, 4);
      board[sq] = { t: 'K', id: b.nextId++, born: -1 };
      ksqs.push(sq);
    }
    for (let i = kings; i < count; i++) {
      const sq = randomEmpty(rng, board, 2);
      if (sq < 0) break;
      board[sq] = { t: rollType(rng, b.ante), id: b.nextId++, born: -1 };
    }
    const opts = { pawnSides: b.rules.pawnSides };
    if (ksqs.every((s) => attackers(board, s, opts).length > 0)) return board;
  }
  throw new Error('board generation failed');
}

function telegraph(b) {
  const n = b.rules.reinforce ?? (b.ante >= 4 ? 2 : 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const sq = randomEmpty(b.rng.reinf, b.board, 3, out.map((x) => x.sq));
    if (sq < 0) break;
    out.push({ sq, t: rollType(b.rng.reinf, b.ante) });
  }
  b.incoming = out;
}

// 예고 칸이 막혔으면 가장 가까운 빈칸(체비쇼프 → 맨해튼 → 칸 번호 순).
export function nearestEmpty(board, sq) {
  let best = -1, bk = Infinity;
  for (let s = 0; s < 64; s++) {
    if (board[s]) continue;
    const df = Math.abs(fileOf(s) - fileOf(sq)), dr = Math.abs(rankOf(s) - rankOf(sq));
    const k = Math.max(df, dr) * 1000 + (df + dr) * 100 + s / 100;
    if (k < bk) { bk = k; best = s; }
  }
  return best;
}

export function arrive(b, events = []) {
  for (const r of b.incoming) {
    const sq = b.board[r.sq] ? nearestEmpty(b.board, r.sq) : r.sq;
    if (sq < 0) continue;
    b.board[sq] = { t: r.t, id: b.nextId++, born: b.movesUsed };
    events.push({ type: 'reinforce', sq, planned: r.sq, piece: r.t });
  }
  telegraph(b);
}

function draw(b) {
  while (b.hand.length < b.rules.hand && b.bag.length) b.hand.push(b.bag.shift());
}

const normPiece = (p, i) => (typeof p === 'string' ? { t: p, id: i + 1, eng: null } : { t: p.t, id: p.id ?? i + 1, eng: p.eng ?? null });

export function createBattle({ seed = 1, ante = 1, kind = 'practice', bag = DEFAULT_BAG, target = null, rules = {}, mods = [] } = {}) {
  const root = createRng(seed);
  const b = {
    v: 1,
    seed, ante, kind, target,
    rules: { ...DEFAULT_RULES, ...rules },
    mods: JSON.parse(JSON.stringify(mods)),
    rng: { board: fork(root, 'board'), bag: fork(root, 'bag'), reinf: fork(root, 'reinf') },
    board: null,
    bag: bag.map(normPiece),
    hand: [], used: [],
    movesLeft: 0, movesUsed: 0, discardsLeft: 0, discardsUsed: 0,
    score: 0, history: [],
    incoming: [],
    chain: null, chainPiece: null,
    status: 'play', result: null,
    nextId: 100,
  };
  runHook(b, 'onBattleStart', {}, []);
  b.movesLeft = b.rules.moves;
  b.discardsLeft = b.rules.discards;
  shuffle(b.rng.bag, b.bag);
  draw(b);
  // 시작 손으로 떨굴 수가 없으면 판을 다시 만든다(시드 안에서 결정적으로).
  for (let i = 0; i < 100; i++) {
    b.board = generateBoard(b);
    if (hasLegalDrop(b)) break;
  }
  telegraph(b);
  return b;
}

export function dropSquaresFor(b, piece) {
  const allow = { attacked: false };
  if ((b.mods && b.mods.length) || piece.eng) {
    const t = { ...b, chain: piece.eng ? { engraving: piece.eng } : null };
    const ctxEvent = { type: piece.t, engraving: piece.eng };
    // onDropCheck: ctx.event.allow.attacked = true 로 노려진 칸 허용
    ctxEvent.allow = allow;
    runHook(t, 'onDropCheck', ctxEvent, []);
  }
  return dropSquares(b.board, piece.t, { ...boardOpts(b), allowAttacked: allow.attacked });
}

export function hasLegalDrop(b) {
  return b.hand.some((p) => dropSquaresFor(b, p).length > 0);
}

export function legalCommands(b) {
  if (b.status === 'chain') return chainCaptures(b).map((sq) => ({ type: 'capture', sq }));
  if (b.status !== 'play') return [];
  const out = [];
  b.hand.forEach((p, handIndex) => {
    for (const sq of dropSquaresFor(b, p)) out.push({ type: 'drop', handIndex, sq });
  });
  if (b.discardsLeft > 0 && b.bag.length > 0) {
    const n = b.hand.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const idx = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i);
      if (idx.length <= b.rules.maxDiscard) out.push({ type: 'discard', handIndices: idx });
    }
  }
  return out;
}

export function apply(b, cmd) {
  const events = [];
  if (b.status === 'won' || b.status === 'lost') throw new Error('battle is over');
  switch (cmd.type) {
    case 'drop': {
      if (b.status !== 'play') throw new Error('not expecting a drop');
      const piece = b.hand[cmd.handIndex];
      if (!piece) throw new Error('bad hand index');
      if (!dropSquaresFor(b, piece).includes(cmd.sq)) throw new Error(`illegal drop ${piece.t}@${cmd.sq}`);
      b.hand.splice(cmd.handIndex, 1);
      b.chainPiece = piece;
      b.status = 'chain';
      events.push(...startChain(b, { type: piece.t, sq: cmd.sq, engraving: piece.eng }));
      if (b.chain.done) endMove(b, events);
      break;
    }
    case 'capture': {
      if (b.status !== 'chain') throw new Error('no chain');
      events.push(...chainCapture(b, cmd.sq));
      if (b.chain.done) endMove(b, events);
      break;
    }
    case 'discard': {
      if (b.status !== 'play') throw new Error('not expecting a discard');
      if (b.discardsLeft <= 0) throw new Error('no discards left');
      const idx = [...new Set(cmd.handIndices)].sort((x, y) => y - x);
      if (!idx.length || idx.length > b.rules.maxDiscard || idx.some((i) => !b.hand[i])) throw new Error('bad discard');
      const gone = idx.map((i) => b.hand.splice(i, 1)[0]);
      b.used.push(...gone);
      b.discardsLeft--;
      b.discardsUsed++;
      draw(b);
      events.push({ type: 'discard', pieces: gone.map((p) => p.t) });
      checkStuck(b, events);
      break;
    }
    default: throw new Error(`unknown command ${cmd.type}`);
  }
  return events;
}

function endMove(b, events) {
  const c = b.chain;
  b.score += c.score;
  b.movesLeft--;
  b.movesUsed++;
  b.used.push(b.chainPiece);
  b.history.push({
    piece: c.dropType, sq: c.dropSq, value: c.value, mult: c.mult, score: c.score, reason: c.reason,
    captures: c.captures.length, transforms: c.transforms, promotions: c.promotions, forced: c.forcedReplies,
  });
  b.chain = null;
  b.chainPiece = null;
  b.status = 'play';
  if (c.reason === 'mate') return finishBattle(b, 'won', 'mate', events);
  if (b.target != null && b.score >= b.target) return finishBattle(b, 'won', 'score', events);
  if (b.movesLeft <= 0) return finishBattle(b, 'lost', 'moves', events);
  arrive(b, events);
  draw(b);
  checkStuck(b, events);
}

function checkStuck(b, events) {
  if (b.status !== 'play') return;
  if (hasLegalDrop(b)) return;
  if (b.discardsLeft > 0 && b.bag.length > 0) return;
  finishBattle(b, 'lost', 'stuck', events);
}

function finishBattle(b, status, reason, events) {
  b.status = status;
  b.result = { reason, score: b.score, movesLeft: b.movesLeft };
  events.push({ type: status === 'won' ? 'win' : 'lose', reason, score: b.score });
}

