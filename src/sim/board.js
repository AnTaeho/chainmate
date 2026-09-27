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
// 노림을 거는 적: 얼린 적(묘수 「빙결」)은 이번 수 동안 아무것도 지키지 못한다
const threat = (cell) => cell != null && !cell.mine && !cell.frozen;

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
const CAMEL_D = [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]];
const KNIGHT = table(KN);
const KING = table(KG);
const CAMEL = table(CAMEL_D);
const RAY_O = rays(ORTHO);
const RAY_D = rays(DIAG);
const RAY_N = rays(KN); // 야간기사: 나이트 도약을 같은 방향으로 거듭
// 궁수: 딱 두 칸 떨어진 고리(체비쇼프 거리 2, 16칸)
const RING2 = (() => {
  const d = [];
  for (let df = -2; df <= 2; df++) for (let dr = -2; dr <= 2; dr++) if (Math.max(Math.abs(df), Math.abs(dr)) === 2) d.push([df, dr]);
  return table(d);
})();
// 폰 공격 칸: 위로(+1, 내 폰 모습) / 아래로(−1, 적 폰)
const PAWN_UP = table([[-1, 1], [1, 1]]);
const PAWN_DOWN = table([[-1, -1], [1, -1]]);
const PAWN_SIDE = table([[-1, 0], [1, 0]]);

// 미끄러지는 선 묶음(체스 · 이형)
const SLIDES = { R: [RAY_O], B: [RAY_D], Q: [RAY_O, RAY_D], A: [RAY_D], C: [RAY_O], Z: [RAY_O, RAY_D], H: [RAY_N] };
// 나이트 도약을 곁들이는 기물
const KNIGHTLIKE = new Set(['N', 'A', 'C', 'Z']);
// 선 위를 미끄러지는 모습(행마선을 선으로 그린다)
export const SLIDERS = new Set(['R', 'B', 'Q', 'A', 'C', 'Z', 'H', 'W']);
// 칸 사이를 뛰는 모습(움직임이 포물선)
export const LEAPERS = new Set(['N', 'L', 'H', 'G', 'A', 'C', 'Z']);

// 받침 넘기(메뚜기 · 포): 선 ray 위에서 ignore 칸은 빈칸으로 본다
function hopGrasshopper(board, ray, ignore, out) {
  for (let i = 0; i < ray.length; i++) {
    const s = ray[i];
    if (!board[s] || s === ignore) continue;
    if (i + 1 < ray.length) out.push(ray[i + 1]);
    return;
  }
}
function hopCannon(board, ray, ignore, out) {
  let screen = false;
  for (const s of ray) {
    if (!board[s] || s === ignore) continue;
    if (!screen) { screen = true; continue; }
    out.push(s);
    return;
  }
}

// 기물 t가 sq에서 닿는 칸(점유된 칸 포함, 그 너머는 막힘). dir: +1 내 폰, −1 적 폰.
// 메뚜기 · 포는 먹을 수 있는 칸(받침 너머)만, 유령은 가로 · 세로 전부(막힘 무시), 궁수는 두 칸 고리.
export function reach(board, t, sq, dir = 1, ignore = -1) {
  switch (t) {
    case 'N': return KNIGHT[sq];
    case 'K': return KING[sq];
    case 'P': return dir > 0 ? PAWN_UP[sq] : PAWN_DOWN[sq];
    case 'L': return CAMEL[sq];
    case 'S': return RING2[sq];
    case 'W': return RAY_O[sq].flat();
    case 'G': { const out = []; for (const set of [RAY_O, RAY_D]) for (const ray of set[sq]) hopGrasshopper(board, ray, ignore, out); return out; }
    case 'O': { const out = []; for (const ray of RAY_O[sq]) hopCannon(board, ray, ignore, out); return out; }
  }
  const out = KNIGHTLIKE.has(t) && t !== 'N' ? KNIGHT[sq].slice() : [];
  const sets = SLIDES[t];
  if (!sets) return out;
  for (const set of sets) for (const ray of set[sq]) {
    for (const s of ray) { out.push(s); if (board[s] && s !== ignore) break; }
  }
  return out;
}

// sq를 노리는 적들의 칸. ignore 칸은 비어 있는 것으로 본다(움직이기 전 내 기물 자리).
// opts.pawnSides: 적 폰이 좌우 옆 칸도 지킨다(명인 「철벽」).
// 이형 적도 같은 행마로 지킨다: 포 · 메뚜기는 받침이 있을 때만, 궁수는 두 칸 고리, 유령은 막힘 무시.
export function attackers(board, sq, opts = {}) {
  const ignore = opts.ignore ?? -1;
  const out = [];
  const enemyAt = (s, t) => s !== ignore && threat(board[s]) && board[s].t === t;
  const enemyIn = (s, set) => s !== ignore && threat(board[s]) && set.has(board[s].t);
  for (const s of KNIGHT[sq]) if (enemyIn(s, KNIGHTLIKE)) out.push(s);
  for (const s of KING[sq]) if (enemyAt(s, 'K')) out.push(s);
  // 적 폰은 (f±1, r−1)을 노린다 ⇒ sq를 노리는 폰은 (f±1, r+1)에 있다
  for (const s of PAWN_UP[sq]) if (enemyAt(s, 'P')) out.push(s);
  if (opts.pawnSides) for (const s of PAWN_SIDE[sq]) if (enemyAt(s, 'P')) out.push(s);
  for (const ray of RAY_O[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (threat(board[s]) && ORTHO_T.has(board[s].t)) out.push(s);
    break;
  }
  for (const ray of RAY_D[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (threat(board[s]) && DIAG_T.has(board[s].t)) out.push(s);
    break;
  }
  if (opts.fairy === false) return out;
  // ── 이형(판에 이형이 없으면 여기까지 오지만 칸마다 몇 번의 확인뿐)
  for (const s of CAMEL[sq]) if (enemyAt(s, 'L')) out.push(s);
  for (const s of RING2[sq]) if (enemyAt(s, 'S')) out.push(s);
  for (const ray of RAY_N[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (enemyAt(s, 'H')) out.push(s);
    break;
  }
  // 유령: 같은 줄 · 같은 단 어디서든
  for (const ray of RAY_O[sq]) for (const s of ray) if (enemyAt(s, 'W')) out.push(s);
  // 메뚜기: sq 바로 앞(선 위 한 칸)이 받침이고, 그 뒤로 빈칸을 지나 처음 만나는 기물이 적 메뚜기
  for (const set of [RAY_O, RAY_D]) for (const ray of set[sq]) {
    const h = ray[0];
    if (!board[h] || h === ignore) continue;
    for (let i = 1; i < ray.length; i++) {
      const s = ray[i];
      if (s === ignore || !board[s]) continue;
      if (enemyAt(s, 'G')) out.push(s);
      break;
    }
  }
  // 포: sq에서 선을 따라 첫 기물(받침) 너머 처음 만나는 기물이 적 포
  for (const ray of RAY_O[sq]) {
    let screen = false;
    for (const s of ray) {
      if (s === ignore || !board[s]) continue;
      if (!screen) { screen = true; continue; }
      if (enemyAt(s, 'O')) out.push(s);
      break;
    }
  }
  return out;
}
const ORTHO_T = new Set(['R', 'Q', 'C', 'Z']);
const DIAG_T = new Set(['B', 'Q', 'A', 'Z']);

export const isAttacked = (board, sq, opts) => attackers(board, sq, opts).length > 0;

// 킹은 아무도 지키지 않을 때만 먹을 수 있다. from = 먹으러 가는 내 기물의 현재 칸(비운 것으로 본다).
export function kingTakeable(board, ksq, from, opts = {}) {
  return attackers(board, ksq, { ...opts, ignore: from }).length === 0;
}

// 모습 form으로 sq에서 먹을 수 있는 적 칸. 응수 제한은 chain.js가 건다.
// opts.openKings: 지켜진 킹도 먹을 수 있다(전설 「오페라 대국」).
// opts.highways: 이 줄(file)들에서는 어떤 모습이든 세로로 룩처럼도 미끄러진다(정석 「고속도로」)
export function captures(board, form, sq, opts = {}) {
  const out = [];
  let list = reach(board, form, sq, 1);
  if (opts.highways && opts.highways.includes(sq & 7)) {
    list = list.slice();
    for (const ray of RAY_O[sq]) { if ((ray[0] & 7) !== (sq & 7)) continue; for (const s of ray) { if (!list.includes(s)) list.push(s); if (board[s]) break; } }
  }
  for (const s of list) {
    const c = board[s];
    if (!isEnemy(c) || c.t === 'X') continue;
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
