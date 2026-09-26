// 판과 공격 판정. 8×8, sq = rank*8 + file, rank 0이 내 쪽.
// 칸: null | { t, id, born } (적) | { t, mine: true } (사슬을 푸는 내 기물).
// 미끄러지는 선은 어떤 기물(내 기물 포함)에든 막힌다.
import { PIECES } from '../data/pieces.js';

export const SIZE = 8;
export const fileOf = (sq) => sq & 7;
export const rankOf = (sq) => sq >> 3;
export const at = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);
export const sqName = (sq) => 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
export function parseSq(name) {
  return at(name.charCodeAt(0) - 97, Number(name[1]) - 1);
}

export const emptyBoard = () => new Array(64).fill(null);
export const isEnemy = (cell) => cell != null && !cell.mine;

const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function table(deltas) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    const list = [];
    for (const [df, dr] of deltas) { const s = at(fileOf(sq) + df, rankOf(sq) + dr); if (s >= 0) list.push(s); }
    out.push(list);
  }
  return out;
}
function rays(deltas) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    const rs = [];
    for (const [df, dr] of deltas) {
      const ray = [];
      let f = fileOf(sq) + df, r = rankOf(sq) + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) { ray.push(r * 8 + f); f += df; r += dr; }
      if (ray.length) rs.push(ray);
    }
    out.push(rs);
  }
  return out;
}
const KNIGHT = table(KN);
const KING = table(KG);
const RAY_O = rays(ORTHO);
const RAY_D = rays(DIAG);
// 폰 공격 칸: 위로(+1, 내 폰 모습) / 아래로(−1, 적 폰)
const PAWN_UP = table([[-1, 1], [1, 1]]);
const PAWN_DOWN = table([[-1, -1], [1, -1]]);
const PAWN_SIDE = table([[-1, 0], [1, 0]]);

// 기물 t가 sq에서 닿는 칸(점유된 칸 포함, 그 너머는 막힘). dir: +1 내 폰, −1 적 폰.
export function reach(board, t, sq, dir = 1, ignore = -1) {
  switch (t) {
    case 'N': return KNIGHT[sq];
    case 'K': return KING[sq];
    case 'P': return dir > 0 ? PAWN_UP[sq] : PAWN_DOWN[sq];
  }
  const out = [];
  const sets = t === 'R' ? [RAY_O] : t === 'B' ? [RAY_D] : [RAY_O, RAY_D];
  for (const set of sets) for (const ray of set[sq]) {
    for (const s of ray) { out.push(s); if (board[s] && s !== ignore) break; }
  }
  return out;
}

// sq를 노리는 적들의 칸. ignore 칸은 비어 있는 것으로 본다(움직이기 전 내 기물 자리).
// opts.pawnSides: 적 폰이 좌우 옆 칸도 지킨다(명인 「철벽」).
export function attackers(board, sq, opts = {}) {
  const ignore = opts.ignore ?? -1;
  const out = [];
  const enemyAt = (s, t) => s !== ignore && isEnemy(board[s]) && board[s].t === t;
  for (const s of KNIGHT[sq]) if (enemyAt(s, 'N')) out.push(s);
  for (const s of KING[sq]) if (enemyAt(s, 'K')) out.push(s);
  // 적 폰은 (f±1, r−1)을 노린다 ⇒ sq를 노리는 폰은 (f±1, r+1)에 있다
  for (const s of PAWN_UP[sq]) if (enemyAt(s, 'P')) out.push(s);
  if (opts.pawnSides) for (const s of PAWN_SIDE[sq]) if (enemyAt(s, 'P')) out.push(s);
  for (const ray of RAY_O[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (isEnemy(board[s]) && (board[s].t === 'R' || board[s].t === 'Q')) out.push(s);
    break;
  }
  for (const ray of RAY_D[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (isEnemy(board[s]) && (board[s].t === 'B' || board[s].t === 'Q')) out.push(s);
    break;
  }
  return out;
}

export const isAttacked = (board, sq, opts) => attackers(board, sq, opts).length > 0;

// 킹은 아무도 지키지 않을 때만 먹을 수 있다. from = 먹으러 가는 내 기물의 현재 칸(비운 것으로 본다).
export function kingTakeable(board, ksq, from, opts = {}) {
  return attackers(board, ksq, { ...opts, ignore: from }).length === 0;
}

// 모습 form으로 sq에서 먹을 수 있는 적 칸. 응수 제한은 chain.js가 건다.
// opts.openKings: 지켜진 킹도 먹을 수 있다(전설 「오페라 대국」).
export function captures(board, form, sq, opts = {}) {
  const out = [];
  for (const s of reach(board, form, sq, 1)) {
    const c = board[s];
    if (!isEnemy(c)) continue;
    if (c.t === 'K' && !opts.openKings && !kingTakeable(board, s, sq, opts)) continue;
    out.push(s);
  }
  return out;
}

// 기물 t를 떨굴 수 있는 칸: 빈칸 ∧ 노려지지 않음 ∧ 먹을 적이 하나 이상. 폰은 rank 7 금지.
// opts.allowAttacked: 노려지는 칸도 허용(각인 「깃」 자리).
export function dropSquares(board, t, opts = {}) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq]) continue;
    if (t === 'P' && rankOf(sq) === 7) continue;
    if (!opts.allowAttacked && isAttacked(board, sq, opts)) continue;
    if (captures(board, t, sq, opts).length === 0) continue;
    out.push(sq);
  }
  return out;
}

export const pieceValue = (t) => PIECES[t].value;

// 테스트·도구용: { c3: 'N', d5: 'B', ... } → 판 (소문자 없이 적만)
export function boardFrom(map) {
  const b = emptyBoard();
  let id = 1;
  for (const [name, t] of Object.entries(map)) b[parseSq(name)] = { t, id: id++, born: -1 };
  return b;
}
