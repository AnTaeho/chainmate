// 대국 하나: 손 · 주머니 · 수 · 바꾸기 · 증원 · 승패.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 apply(b, cmd) 하나뿐.
//   { type: 'drop', handIndex, sq }  { type: 'capture', sq }  { type: 'redrop', sq }  { type: 'discard', handIndices }
import { createRng, fork, next, shuffle } from './rng.js';
import { dropSquares, fileOf, rankOf, reach } from './board.js';
import { startChain, chainCapture, chainCaptures, chainRedrop, chainRedrops, chainSummary, boardOpts, markFairy } from './chain.js';
import { runHook, getModifier, forkSpec, forkSpecs } from './scoring.js';
import { generateBoard, randomEmpty, rollType, reinforceCount } from './setup.js';
import { soulSpec } from '../data/souls.js';
import { thaw } from '../data/tactics.js';

export { enemyCount, kingGuards, reinforceCount, enemyWeights, kingDefended } from './setup.js';

export const DEFAULT_BAG = ['P', 'P', 'P', 'P', 'N', 'N', 'B', 'R'];
export const BASE_REWARD = { practice: 3, official: 4, master: 5 };

export const DEFAULT_RULES = {
  hand: 4,          // 손
  moves: 4,         // 수
  discards: 3,      // 바꾸기
  maxDiscard: 1,    // 한 번에 버리는 최대 수(한 장씩)
  kings: 1,         // 킹 수(명인 「대가」 2)
  enemies: null,    // null이면 enemyCount(관)
  guards: null,     // 킹 하나를 지키는 적 수(폰 하나 포함). null이면 kingGuards(관)
  reinforce: null,  // 수마다 증원 수. null이면 reinforceCount(관)
  pawnSides: false, // 적 폰이 옆 칸도 지킨다(2a의 명인 「철벽」, 지금은 쓰지 않는 규칙 깃발)
  noHeavyDrop: false, // 명인 「무거운 손」: 퀸 · 룩은 떨굴 수 없다
  noReply: false,   // 명인 「철벽」: 응수 없이 노려진 칸을 먹으면 곧바로 끊긴다
  openKings: false, // 지켜진 킹도 먹는다(전설 「오페라 대국」)
  fog: 0,           // 명인 「안개」: 위에서 몇 줄이 가려지나
  lookahead: 1,     // 증원 예고가 몇 수 앞까지 보이나(격언 「그림자 읽기」 2)
};

// 증원 예고는 늘 두 수 앞까지 뽑아 둔다: incoming(다음 수 뒤) · incomingNext(그다음).
// 무엇이 보이느냐는 rules.lookahead(기본 1, 격언 「그림자 읽기」 2)가 정하고, 뽑는 횟수는 같다
// (격언이 있든 없든 같은 시드면 같은 판).
function rollIncoming(b, taken) {
  const n = (b.rules.reinforce ?? reinforceCount(b.ante)) + (b.rules.reinforceBonus || 0); // reinforceBonus: 단 2부터 +1
  const out = [];
  for (let i = 0; i < n; i++) {
    const sq = randomEmpty(b.rng.reinf, b.board, 3, [...taken, ...out.map((x) => x.sq)]);
    if (sq < 0) break;
    out.push({ sq, t: rollType(b.rng.reinf, b.ante) });
  }
  return out;
}
function telegraph(b) {
  if (b.incomingNext) b.incoming = b.incomingNext;
  else b.incoming = rollIncoming(b, []);
  b.incomingNext = rollIncoming(b, b.incoming.map((x) => x.sq));
}

// 화면에 보여 줄 예고(두 수 앞까지는 「그림자 읽기」일 때만).
export const visibleIncoming = (b) => (b.rules.lookahead >= 2 ? [b.incoming, b.incomingNext] : [b.incoming]);

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
  markFairy(b);
  refreshHints(b);
}

// 판이 바뀔 때마다(시작 · 먹기 · 증원) 화면용 표시를 다시 잰다(격언 「왕의 목」 등이 onBoard에서 b.hints를 채운다).
// 풀이기 탐색은 이 길을 타지 않는다(apply만 부른다).
export function refreshHints(b) {
  b.hints = {};
  runHook(b, 'onBoard', {}, []);
}

// 명인 「안개」: 위 다섯 줄(rules.fog)의 적은 내 기물의 행마가 한 번이라도 닿은 칸만 드러난다(대국 동안 유지).
function reveal(b) {
  if (!b.rules.fog || !b.chain) return;
  const c = b.chain;
  for (const s of reach(b.board, c.form, c.sq, 1)) if (!b.revealed.includes(s)) b.revealed.push(s);
  if (!b.revealed.includes(c.sq)) b.revealed.push(c.sq);
}
export function isHidden(b, sq) {
  return !!b.rules.fog && rankOf(sq) >= 8 - b.rules.fog && !b.revealed.includes(sq);
}

function draw(b) {
  while (b.hand.length < b.rules.hand && b.bag.length) b.hand.push(b.bag.shift());
}

const normPiece = (p, i) => (typeof p === 'string' ? { t: p, id: i + 1, eng: null } : { t: p.t, id: p.id ?? i + 1, eng: p.eng ?? null, ...(p.soul ? { soul: p.soul } : {}) });

// 금빛 적: 대국 시작 판에서 킹이 아닌 적 하나가 이 확률로 금빛(HOOKS 「드문 것들의 사다리」 대국당 ~4%).
// 먹으면 값을 한 번 더 받고(chain.js), 판(런)이 대국 뒤 금빛 꾸러미와 조각 기회로 바꾼다.
// calling: 재현까지 해낸 명국이 금빛 조각만 기다릴 때(판(런)이 goldenChance로 넘긴다). 조각 셋이 한 판에 모이는 몫을
// 노리는 판 쪽으로 기울이려고 — 기본 4%에서는 첫 조각 · 재현을 모은 판의 14%만 금빛을 먹었다(보고서 2b).
export const GOLDEN = { chance: 0.04, calling: 0.1 };
// 목표를 넘긴 비율의 층(HOOKS 「넘친 만큼 축하」). 넘는 순간 「overflow」 이벤트.
export const OVERFLOW_TIERS = [1, 2, 5, 10];
export const overflowTier = (score, target) => (target ? OVERFLOW_TIERS.reduce((a, x) => (score >= x * target ? x : a), 0) : 0);

// golden: null이면 goldenChance(기본 GOLDEN.chance)로 굴린다(시드의 'gold' 하위 스트림), true/false로 강제.
export function createBattle({ seed = 1, ante = 1, kind = 'practice', bag = DEFAULT_BAG, target = null, rules = {}, mods = [], golden = null, goldenChance = GOLDEN.chance } = {}) {
  const root = createRng(seed);
  const b = {
    v: 1,
    seed, ante, kind, target,
    rules: { ...DEFAULT_RULES, ...rules },
    mods: JSON.parse(JSON.stringify(mods)),
    rng: { board: fork(root, 'board'), bag: fork(root, 'bag'), reinf: fork(root, 'reinf'), glass: fork(root, 'glass') },
    board: null,
    bag: bag.map(normPiece),
    hand: [], used: [],
    movesLeft: 0, movesUsed: 0, discardsLeft: 0, discardsUsed: 0,
    score: 0, history: [],
    incoming: [], incomingNext: null,
    chain: null, chainPiece: null,
    status: 'play', result: null,
    nextId: 100,
    money: 0,          // 대국 중에 번 상금(격언 「금고」 · 각인 「금」 …). 판(런)이 보상에 더한다
    deckSize: bag.length,
    discarded: 0,      // 바꾸기로 버린 기물 수
    shattered: [],     // 깨진 기물 id(각인 「유리」). 판(런)이 주머니에서 뺀다
    regrip: false,     // 막혀서 손을 새로 쥐었나(대국마다 한 번)
    revealed: [],      // 명인 「안개」로 드러난 칸
    hints: {},         // 화면용 표시(격언 「왕의 목」: openKings)
    golden: 0,         // 이번 대국에서 먹은 금빛 적 수
    overflow: 0,       // 목표를 넘긴 층(0 · 1 · 2 · 5 · 10)
  };
  runHook(b, 'onBattleStart', {}, []);
  b.movesLeft = b.rules.moves;
  b.discardsLeft = b.rules.discards;
  shuffle(b.rng.bag, b.bag);
  draw(b);
  // 시작 손으로 떨굴 수가 없으면 판을 다시 만든다(시드 안에서 결정적으로).
  // 판(런)의 첫 대국(1관 연습)은 시작 손으로 셋 이상 잇는 사슬(「!」)이 하나는 있는 판을 고른다 — 첫 사슬이 곧바로 나오게(밤샘 D-3)
  const easy = ante === 1 && kind === 'practice' && rules.easyStart !== false;
  for (let i = 0; i < 100; i++) {
    b.board = generateBoard(b);
    if (hasLegalDrop(b) && (!easy || i >= 60 || hasChainOf(b, EASY_CHAIN))) break;
  }
  const gr = fork(root, 'gold');
  if (golden ?? next(gr) < goldenChance) {
    const cand = [];
    b.board.forEach((c, sq) => { if (c && c.t !== 'K' && c.t !== 'X' && c.t !== 'J') cand.push(sq); });
    if (cand.length) b.board[cand[Math.floor(next(gr) * cand.length)]].gold = true;
  }
  telegraph(b);
  markFairy(b);
  refreshHints(b);
  return b;
}

export function dropSquaresFor(b, piece) {
  if (b.rules.noHeavyDrop && (piece.t === 'Q' || piece.t === 'R')) return [];
  const allow = { attacked: false };
  if ((b.mods && b.mods.length) || piece.eng || piece.soul) {
    // 조회일 뿐이라 조정자 state가 새지 않게 복사본으로 돌린다
    const t = { ...b, mods: forkSpecs(b.mods), chain: piece.eng || piece.soul ? { engraving: forkSpec(piece.eng), soul: soulSpec(piece.soul) } : null };
    const ctxEvent = { type: piece.t, engraving: piece.eng };
    // onDropCheck: ctx.event.allow.attacked = true 로 노려진 칸 허용
    ctxEvent.allow = allow;
    runHook(t, 'onDropCheck', ctxEvent, []);
  }
  return fogFilter(b, dropSquares(b.board, piece.t, { ...boardOpts(b), allowAttacked: allow.attacked }));
}
// 명인 「안개」: 안개 속(위 fog줄)에는 떨굴 수 없다
export const fogFilter = (t, list) => (t.rules && t.rules.fog ? list.filter((sq) => rankOf(sq) < 8 - t.rules.fog) : list);

// 시작 손의 어떤 기물로 n번 이상 잇는 사슬이 있나(조정자 없이, 깊이 우선, 마디 예산 안에서)
export const EASY_CHAIN = 3;
export function hasChainOf(b, n, budget = 4000) {
  let nodes = 0;
  const walk = (t, depth) => {
    if (depth >= n) return true;
    if (++nodes > budget) return false;
    for (const sq of chainCaptures(t)) {
      const u = { ...t, board: t.board.slice(), chain: { ...t.chain, captures: t.chain.captures.slice(), forms: t.chain.forms.slice(), flags: { ...t.chain.flags }, forced: t.chain.forced && t.chain.forced.slice() } };
      chainCapture(u, sq);
      if (u.chain.captures.length >= n) return true;
      if (!u.chain.done && walk(u, depth + 1)) return true;
    }
    return false;
  };
  for (const piece of b.hand) {
    for (const sq of dropSquares(b.board, piece.t, boardOpts(b))) {
      const t = { board: b.board.slice(), rules: b.rules, mods: [], chain: null };
      startChain(t, { type: piece.t, sq });
      if (walk(t, 0)) return true;
    }
  }
  return false;
}

export function hasLegalDrop(b) {
  return b.hand.some((p) => dropSquaresFor(b, p).length > 0);
}

export function legalCommands(b) {
  if (b.status === 'chain') {
    if (b.chain.awaiting) return chainRedrops(b).map((sq) => ({ type: 'redrop', sq }));
    return chainCaptures(b).map((sq) => ({ type: 'capture', sq }));
  }
  if (b.status !== 'play') return [];
  const out = [];
  b.hand.forEach((p, handIndex) => {
    for (const sq of dropSquaresFor(b, p)) out.push({ type: 'drop', handIndex, sq });
  });
  if (b.discardsLeft > 0 && b.bag.length > 0) {
    b.hand.forEach((_, i) => out.push({ type: 'discard', handIndices: [i] }));
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
      markFairy(b);
      if (!dropSquaresFor(b, piece).includes(cmd.sq)) throw new Error(`illegal drop ${piece.t}@${cmd.sq}`);
      b.hand.splice(cmd.handIndex, 1);
      b.chainPiece = piece;
      b.status = 'chain';
      events.push(...startChain(b, { type: piece.t, sq: cmd.sq, engraving: piece.eng, soul: soulSpec(piece.soul) }));
      reveal(b);
      if (b.chain.done) endMove(b, events);
      break;
    }
    case 'capture': {
      if (b.status !== 'chain') throw new Error('no chain');
      events.push(...chainCapture(b, cmd.sq));
      reveal(b);
      if (b.chain.done) endMove(b, events);
      else refreshHints(b);
      break;
    }
    case 'redrop': {
      if (b.status !== 'chain' || !b.chain.awaiting) throw new Error('not expecting a redrop');
      events.push(...chainRedrop(b, cmd.sq));
      reveal(b);
      if (b.chain.done) endMove(b, events);
      else refreshHints(b);
      break;
    }
    case 'discard': {
      if (b.status !== 'play') throw new Error('not expecting a discard');
      if (b.discardsLeft <= 0) throw new Error('no discards left');
      // 주머니가 비면 바꾸기는 손만 줄인다: legalCommands · 막힘 판정과 같이 막는다
      if (b.bag.length === 0) throw new Error('bag is empty');
      const idx = [...new Set(cmd.handIndices)].sort((x, y) => y - x);
      if (!idx.length || idx.length > b.rules.maxDiscard || idx.some((i) => !b.hand[i])) throw new Error('bad discard');
      const gone = idx.map((i) => b.hand.splice(i, 1)[0]);
      b.used.push(...gone);
      b.discardsLeft--;
      b.discardsUsed++;
      b.discarded += gone.length;
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
  const before = b.score;
  b.score += c.score;
  if (b.target) {
    for (const tier of OVERFLOW_TIERS) {
      if (before < tier * b.target && b.score >= tier * b.target) events.push({ type: 'overflow', tier, score: b.score, target: b.target });
    }
    b.overflow = overflowTier(b.score, b.target);
  }
  b.money += c.money || 0;
  b.movesLeft--;
  b.movesUsed++;
  // 각인 「유리」 꼴: 쓸 때마다 확률로 깨져 주머니에서 사라진다. 판정은 여기서만(풀이기가 난수를 건드리지 않게).
  const eng = b.chainPiece.eng && getModifier(b.chainPiece.eng.id);
  if (eng && eng.breakChance && next(b.rng.glass) < eng.breakChance) {
    b.shattered.push(b.chainPiece.id);
    b.deckSize--;
    events.push({ type: 'shatter', piece: b.chainPiece.t, id: b.chainPiece.id });
  } else b.used.push(b.chainPiece);
  // 정석 「결사」 · 「왕좌」: 판(런)이 대국 뒤 주머니에 옮긴다
  if (c.pact) (b.exiled || (b.exiled = [])).push(b.chainPiece.id);
  if (c.throne) (b.crowned || (b.crowned = [])).push(b.chainPiece.id);
  if (c.traitors) (b.traitors || (b.traitors = [])).push(...c.traitors);
  b.history.push(chainSummary(c, b.movesUsed - 1));
  b.golden += c.golden;
  b.chain = null;
  b.chainPiece = null;
  b.status = 'play';
  thaw(b);
  if (c.reason === 'mate') { refreshHints(b); return finishBattle(b, 'won', 'mate', events); }
  if (c.flags.gomoku) return finishBattle(b, 'won', 'gomoku', events);
  if (b.target != null && b.score >= b.target) return finishBattle(b, 'won', 'score', events);
  if (b.movesLeft <= 0) return finishBattle(b, 'lost', 'moves', events);
  arrive(b, events);
  draw(b);
  checkStuck(b, events);
}

export function checkStuck(b, events) {
  if (b.status !== 'play') return;
  if (hasLegalDrop(b)) return;
  if (b.discardsLeft > 0 && b.bag.length > 0) return;
  // 손을 새로 쥔다(대국마다 한 번): 떨굴 곳도 바꿀 것도 없으면 손과 쓴 기물을 주머니에 섞어 넣고 다시 뽑는다.
  // 막힘 패배는 둘 수 없어 지는 것이라 아프기만 하다 — 명인 「안개」 · 「무거운 손」을 세게 하며 판의 13%가 막힘으로 끝나서 넣었다(밤샘 D-1).
  if (!b.regrip) {
    b.regrip = true;
    b.bag.push(...b.hand.splice(0), ...b.used.splice(0));
    shuffle(b.rng.bag, b.bag);
    draw(b);
    events.push({ type: 'regrip', hand: b.hand.map((p) => p.t) });
    if (hasLegalDrop(b)) return;
  }
  finishBattle(b, 'lost', 'stuck', events);
}

function finishBattle(b, status, reason, events) {
  b.status = status;
  b.result = { reason, score: b.score, movesLeft: b.movesLeft };
  events.push({ type: status === 'won' ? 'win' : 'lose', reason, score: b.score });
}

