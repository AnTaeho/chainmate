// 대국 하나: 손 · 주머니 · 수 · 무르기 · 증원 · 승패.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 apply(b, cmd) 하나뿐.
//   { type: 'drop', handIndex, sq }  { type: 'capture', sq }  { type: 'discard', handIndices }
import { createRng, fork, int, next, shuffle } from './rng.js';
import { at, attackers, dropSquares, emptyBoard, fileOf, rankOf } from './board.js';
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
  enemies: null,    // null이면 enemyCount(관)
  guards: null,     // 킹 하나를 지키는 적 수(폰 하나 포함). null이면 kingGuards(관)
  reinforce: null,  // 수마다 증원 수. null이면 reinforceCount(관)
  pawnSides: false, // 명인 「철벽」
};

// 판 생성 수치(하네스로 맞춤, step 2a):
//   적 수 8 + 관(최소 10) — 7 + 관이면 1~3관에서 판이 빨리 비어 폰이 떨굴 곳을 잃고 막힘 패배가 잦았다.
//   킹 수비 3(폰 하나 포함) — 둘이면 첫 수 외통이 3~5%, 셋이면 1~2%.
//   증원 수마다 2 — 1이면 1~3관 막힘이 두 배.
export const enemyCount = (ante) => Math.max(10, 8 + ante);
export const kingGuards = () => 3;
export const reinforceCount = () => 2;

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

// 킹 수비: 킹마다 둘 이상이 지키고 그중 하나는 폰(킹 한 줄 위 대각).
// 폰 모습은 위로만 먹으니 그 폰을 먹은 자리에서는 킹에 닿지 못한다 — 수비수 하나만 치워 곧바로 외통이 나는 판을 막는다.
function defenderSquares(board, t, ksq, opts) {
  const out = [];
  for (let sq = 16; sq < 64; sq++) {
    if (board[sq]) continue;
    board[sq] = { t, id: 0, born: -1 };
    const ok = attackers(board, ksq, opts).includes(sq);
    board[sq] = null;
    if (ok) out.push(sq);
  }
  return out;
}

export function kingDefended(board, ksq, opts = {}, guards = 2) {
  const at = attackers(board, ksq, opts);
  return at.length >= guards && at.some((s) => board[s].t === 'P');
}

function generateBoard(b) {
  const rng = b.rng.board;
  const count = b.rules.enemies ?? enemyCount(b.ante);
  const kings = b.rules.kings;
  const guards = b.rules.guards ?? kingGuards(b.ante);
  const opts = { pawnSides: b.rules.pawnSides };
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = emptyBoard();
    const ksqs = [];
    let placed = 0, ok = true;
    const put = (sq, t) => { board[sq] = { t, id: b.nextId++, born: -1 }; placed++; };
    for (let k = 0; k < kings && ok; k++) {
      // 킹은 rank 4~6(폰 수비수가 한 줄 위에 설 자리가 있게)
      const free = [];
      for (let sq = 32; sq < 56; sq++) if (!board[sq]) free.push(sq);
      const ksq = free[int(rng, free.length)];
      put(ksq, 'K');
      ksqs.push(ksq);
      const pawnAt = [at(fileOf(ksq) - 1, rankOf(ksq) + 1), at(fileOf(ksq) + 1, rankOf(ksq) + 1)].filter((s) => s >= 0 && !board[s]);
      if (!pawnAt.length) { ok = false; break; }
      put(pawnAt[int(rng, pawnAt.length)], 'P');
      for (let g = 1; g < guards && ok; g++) {
        const t2 = rollType(rng, b.ante);
        const cand = defenderSquares(board, t2, ksq, opts);
        if (!cand.length) { ok = false; break; }
        put(cand[int(rng, cand.length)], t2);
      }
    }
    if (!ok) continue;
    for (let i = placed; i < count; i++) {
      const sq = randomEmpty(rng, board, 2);
      if (sq < 0) break;
      put(sq, rollType(rng, b.ante));
    }
    if (ksqs.every((s) => kingDefended(board, s, opts, guards))) return board;
  }
  throw new Error('board generation failed');
}

function telegraph(b) {
  const n = b.rules.reinforce ?? reinforceCount(b.ante);
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
    // 조회일 뿐이라 조정자 state가 새지 않게 복사본으로 돌린다
    const t = { ...b, mods: JSON.parse(JSON.stringify(b.mods)), chain: piece.eng ? { engraving: JSON.parse(JSON.stringify(piece.eng)) } : null };
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
      // 주머니가 비면 무르기는 손만 줄인다: legalCommands · 막힘 판정과 같이 막는다
      if (b.bag.length === 0) throw new Error('bag is empty');
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

