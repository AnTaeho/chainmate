// 판과 공격 판정. 8×8, sq = rank*8 + file, rank 0이 내 쪽.
// 칸: null | { t, id, born } (적) | { t, mine: true } (사슬을 푸는 내 기물).
// 행마 · 노림 · 먹은 뒤 서는 칸은 모두 이 파일 한 곳에서 정한다(풀이기 · 미리 보기 · 화면이 같은 규칙을 쓴다).
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
const threat = (cell) => cell != null && !cell.mine && !cell.frozen && !cell.muted; // muted: 정석 「횃불」(대국 내내)

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
// 방향별 선(빈 선도 자리를 지킨다): 꺾쇠 · 물수제비가 방향을 알고 꺾거나 튕긴다
function dirRays(deltas) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    out.push(deltas.map(([df, dr]) => {
      const ray = [];
      let f = fileOf(sq) + df, r = rankOf(sq) + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) { ray.push(r * 8 + f); f += df; r += dr; }
      return ray;
    }));
  }
  return out;
}
const OD = dirRays(ORTHO);
const DD = dirRays(DIAG);
// 직각으로 꺾는 방향(ORTHO 차례: 오른쪽 · 왼쪽 · 위 · 아래)
const PERP = [[2, 3], [2, 3], [0, 1], [0, 1]];
const isCorner = (s) => (s === 0 || s === 7 || s === 56 || s === 63);
// 튕김 방향: REFLECT[칸 * 4 + 방향] = 가장자리 칸에서 튕긴 뒤의 방향(구석 · 튕길 일 없는 칸은 -1)
const REFLECT = (() => {
  const out = new Int8Array(256).fill(-1);
  for (let s = 0; s < 64; s++) for (let d = 0; d < 4; d++) {
    if (isCorner(s)) continue;
    const [df, dr] = DIAG[d];
    const f = fileOf(s) + df, r = rankOf(s) + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) continue;
    out[s * 4 + d] = DIAG.findIndex(([a, b]) => a === (f < 0 || f > 7 ? -df : df) && b === (r < 0 || r > 7 ? -dr : dr));
  }
  return out;
})();
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
const SLIDES = { R: [RAY_O], B: [RAY_D], Q: [RAY_O, RAY_D], Z: [RAY_O, RAY_D] };
// 나이트 도약을 곁들이는 기물
const KNIGHTLIKE = new Set(['N', 'Z']);
// 선 위를 미끄러지는 모습(행마선을 선으로 그린다)
export const SLIDERS = new Set(['R', 'B', 'Q', 'Z', 'W']); // 꺾쇠 · 물수제비는 꺾이는 길이라 칸 표시만
// 칸 사이를 뛰는 모습(움직임이 포물선)
export const LEAPERS = new Set(['N', 'L', 'Z', 'V']);

// 받침 넘기(포): 선 ray 위에서 ignore 칸은 빈칸으로 본다
function hopCannon(board, ray, ignore, out) {
  let screen = false;
  for (const s of ray) {
    if (!board[s] || s === ignore) continue;
    if (!screen) { screen = true; continue; }
    out.push(s);
    return;
  }
}
const open = (board, s, ignore) => !board[s] || s === ignore;

// 꺾쇠(CHM-55): 룩처럼 가다가 지나는 빈칸 하나에서 한 번 직각으로 꺾는다. 꺾기 전후 모두 처음 만나는 기물에서 멈춘다.
// emit(칸, 꺾은 칸 | -1). 같은 칸이 두 길로 닿으면 두 번 부른다(곧은 길이 먼저)
function hookWalk(board, sq, ignore, emit) {
  for (let d = 0; d < 4; d++) {
    for (const s of OD[sq][d]) {
      emit(s, -1);
      if (!open(board, s, ignore)) break;
      for (const p of PERP[d]) for (const s2 of OD[s][p]) { emit(s2, s); if (!open(board, s2, ignore)) break; }
    }
  }
}
// 물수제비(CHM-55): 비숍처럼 가다가 판 가장자리(구석 빼고)에 닿으면 한 번 튕긴다. 튕기는 칸은 비어 있어야 한다
function bounceWalk(board, sq, ignore, emit) {
  for (let d = 0; d < 4; d++) {
    let last = -1, hit = false;
    for (const s of DD[sq][d]) { emit(s, -1); if (!open(board, s, ignore)) { hit = true; break; } last = s; }
    if (hit || last < 0) continue;
    const nd = REFLECT[last * 4 + d];
    if (nd < 0) continue; // 구석
    for (const s of DD[last][nd]) { emit(s, last); if (!open(board, s, ignore)) break; }
  }
}
// 까마귀(CHM-55): 대각선으로 붙은 칸을 뛰어넘어 그 너머 빈칸에 앉는다. 닿는 칸 = 넘을 칸(그 너머가 판 안의 빈칸)
function crowLand(sq, s) {
  const f = 2 * fileOf(s) - fileOf(sq), r = 2 * rankOf(s) - rankOf(sq);
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
}
// 광대가 흉내 내는 행마: 보석 · 광대는 킹처럼 한 칸
export const mimicOf = (t) => (t === 'M' || t === 'J' ? 'K' : t);
function dedupe(list) { return list.length > 1 ? [...new Set(list)] : list; }

// 기물 t가 sq에서 닿는 칸(점유된 칸 포함, 그 너머는 막힘). dir: +1 내 폰, −1 적 폰.
// 포는 먹을 수 있는 칸(받침 너머)만, 유령은 가로 · 세로 전부(막힘 무시), 궁수는 두 칸 고리, 까마귀는 넘을 칸,
// 광대는 판의 적마다 그 적의 행마로 닿는 그 적의 칸만.
export function reach(board, t, sq, dir = 1, ignore = -1) {
  switch (t) {
    case 'N': return KNIGHT[sq];
    case 'K': case 'D': return KING[sq];
    case 'P': return dir > 0 ? PAWN_UP[sq] : PAWN_DOWN[sq];
    case 'L': return CAMEL[sq];
    case 'S': return RING2[sq];
    case 'W': return RAY_O[sq].flat();
    case 'O': { const out = []; for (const ray of RAY_O[sq]) hopCannon(board, ray, ignore, out); return out; }
    case 'T': { const out = []; hookWalk(board, sq, ignore, (s) => out.push(s)); return dedupe(out); }
    case 'E': { const out = []; bounceWalk(board, sq, ignore, (s) => out.push(s)); return dedupe(out); }
    case 'V': { const out = []; for (const s of KING[sq]) { if (fileOf(s) === fileOf(sq) || rankOf(s) === rankOf(sq)) continue; const l = crowLand(sq, s); if (l >= 0 && open(board, l, ignore)) out.push(s); } return out; }
    case 'M': return jesterReach(board, sq, dir, ignore);
  }
  const out = KNIGHTLIKE.has(t) && t !== 'N' ? KNIGHT[sq].slice() : [];
  const sets = SLIDES[t];
  if (!sets) return out;
  for (const set of sets) for (const ray of set[sq]) {
    for (const s of ray) { out.push(s); if (board[s] && s !== ignore) break; }
  }
  return out;
}
// 광대(CHM-55): 적을 그 적의 행마로만 먹는다 — 판의 적 종류마다 그 행마로 sq에서 닿는 그 종류의 적 칸
function jesterReach(board, sq, dir, ignore) {
  const out = [];
  let seen = '';
  for (let s = 0; s < 64; s++) {
    const c = board[s];
    if (!c || c.mine || s === ignore || c.t === 'X' || seen.includes(c.t)) continue;
    seen += c.t;
    const t = c.t;
    for (const x of reach(board, mimicOf(t), sq, dir, ignore)) { const y = board[x]; if (y && !y.mine && y.t === t && x !== ignore && !out.includes(x)) out.push(x); }
  }
  return out;
}

// 먹은 길: 꺾쇠 · 물수제비가 sq에서 to까지 꺾거나 튕긴 칸(곧게 닿으면 -1). 광대는 흉내 낸 행마로 잰다
export function pathVia(board, form, sq, to, ignore = -1) {
  const walk = form === 'T' ? hookWalk : form === 'E' ? bounceWalk : null;
  if (!walk) return -1;
  let via = null;
  walk(board, sq, ignore, (s, v) => { if (s === to && (via == null || v < 0)) via = v; });
  return via == null ? -1 : via;
}
// 먹기 한 번의 길 갈래(가족 · 격언 판정): { ortho, diag, leap }. e = capture 이벤트(from · to · form · piece · via)
// 꺾쇠는 가로 · 세로, 물수제비는 대각, 까마귀는 대각 · 뛰기, 포는 뛰기(+ 방향), 나머지는 from → to 벡터로
export function capWay(e) {
  const f = e.form === 'M' ? mimicOf(e.piece) : e.form;
  if (f === 'T') return { ortho: true, diag: false, leap: false };
  if (f === 'E') return { ortho: false, diag: true, leap: false };
  if (f === 'V') return { ortho: false, diag: true, leap: true };
  const df = (e.to & 7) - (e.from & 7), dr = (e.to >> 3) - (e.from >> 3);
  const ortho = (df === 0) !== (dr === 0), diag = df !== 0 && Math.abs(df) === Math.abs(dr);
  return { ortho, diag, leap: (!ortho && !diag) || f === 'O' };
}
// 먹은 길의 마지막 곧은 걸음(꺾거나 튕긴 칸에서 to까지)
export const lastLeg = (e) => { const a = e.via != null && e.via >= 0 ? e.via : e.from; return [(e.to & 7) - (a & 7), (e.to >> 3) - (a >> 3)]; };
// 먹은 뒤 내 기물이 서는 칸: 궁수는 제자리, 까마귀(뛰어넘기)는 넘은 칸 너머, 그 밖은 먹은 칸
export function landingOf(board, form, from, to) {
  if (form === 'S') return from;
  if (form === 'V' && Math.abs(fileOf(to) - fileOf(from)) === 1 && Math.abs(rankOf(to) - rankOf(from)) === 1) {
    const l = crowLand(from, to);
    if (l >= 0 && !board[l]) return l;
  }
  return to;
}

// 노림 판정의 칸 검사(attackers 안에서 부를 때마다 닫힘을 만들지 않게 밖에 둔다)
const enemyAt = (board, ignore, s, t) => s !== ignore && threat(board[s]) && board[s].t === t;
const enemyIn = (board, ignore, s, set) => s !== ignore && threat(board[s]) && set.has(board[s].t);
// sq를 노리는 적들의 칸. ignore 칸은 비어 있는 것으로 본다(움직이기 전 내 기물 자리).
// opts.pawnSides: 적 폰이 좌우 옆 칸도 지킨다(명인 「철벽」).
// opts.form: sq에 설 내 기물의 모습(없으면 sq의 내 기물). 적 광대는 그 모습의 행마로 지킨다 — 모르면 광대는 지키지 않는다.
// 이형 적도 같은 행마로 지킨다: 포는 받침이 있을 때만, 궁수는 두 칸 고리, 유령은 막힘 무시, 까마귀는 넘을 너머가 빌 때.
export function attackers(board, sq, opts = {}) {
  const ignore = opts.ignore ?? -1;
  const out = [];
  for (const s of KNIGHT[sq]) if (enemyIn(board, ignore, s, KNIGHTLIKE)) out.push(s);
  for (const s of KING[sq]) if (enemyAt(board, ignore, s, 'K') || (s !== ignore && threat(board[s]) && board[s].trait === 'fort' && board[s].t !== 'K' && !out.includes(s))) out.push(s);
  // 적 폰은 (f±1, r−1)을 노린다 ⇒ sq를 노리는 폰은 (f±1, r+1)에 있다
  for (const s of PAWN_UP[sq]) if (enemyAt(board, ignore, s, 'P')) out.push(s);
  if (opts.pawnSides) for (const s of PAWN_SIDE[sq]) if (enemyAt(board, ignore, s, 'P')) out.push(s);
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
  fairyHits(board, sq, opts, ignore, out);
  return out;
}
const ORTHO_T = new Set(['R', 'Q', 'Z']);
const DIAG_T = new Set(['B', 'Q', 'Z']);

// 이형 적의 노림(attackers · anyAttacker가 같이 쓴다). out이 있으면 모으고, 없으면 첫 노림수에서 true
// (판에 이형이 없으면 여기까지 오지 않는다 — chain.js boardOpts의 fairy: false). opts.kinds: 판에 있는 이형 종류(모르면 전부 잰다)
const PROBE = { t: 'P', mine: true };
const hitAdd = (out, s) => { if (!out) return true; if (!out.includes(s)) out.push(s); return false; };
function fairyHits(board, sq, opts, ignore, out) {
  const k = opts.kinds;
  if (k == null || k.includes('L')) for (const s of CAMEL[sq]) if (enemyAt(board, ignore, s, 'L') && hitAdd(out, s)) return true;
  if (k == null || k.includes('S')) for (const s of RING2[sq]) if (enemyAt(board, ignore, s, 'S') && hitAdd(out, s)) return true;
  // 화약병: 킹처럼 둘레 한 칸
  if (k == null || k.includes('D')) for (const s of KING[sq]) if (enemyAt(board, ignore, s, 'D') && hitAdd(out, s)) return true;
  // 유령: 같은 줄 · 같은 단 어디서든
  if (k == null || k.includes('W')) for (const ray of RAY_O[sq]) for (const s of ray) if (enemyAt(board, ignore, s, 'W') && hitAdd(out, s)) return true;
  // 포: sq에서 선을 따라 첫 기물(받침) 너머 처음 만나는 기물이 적 포
  if (k == null || k.includes('O')) for (const ray of RAY_O[sq]) {
    let screen = false;
    for (const s of ray) {
      if (s === ignore || !board[s]) continue;
      if (!screen) { screen = true; continue; }
      if (enemyAt(board, ignore, s, 'O') && hitAdd(out, s)) return true;
      break;
    }
  }
  // 까마귀: 대각선으로 붙은 적 까마귀가 sq를 넘어 그 반대쪽 빈칸에 앉을 수 있으면
  if (k == null || k.includes('V')) for (const s of KING[sq]) {
    if (fileOf(s) === fileOf(sq) || rankOf(s) === rankOf(sq) || !enemyAt(board, ignore, s, 'V')) continue;
    const l = crowLand(s, sq);
    if (l >= 0 && open(board, l, ignore) && hitAdd(out, s)) return true;
  }
  // 꺾쇠: sq에서 거꾸로 걸어(가로 · 세로, 빈칸에서 한 번 꺾어) 처음 만나는 기물이 적 꺾쇠
  if (k == null || k.includes('T')) for (let d = 0; d < 4; d++) {
    for (const s of OD[sq][d]) {
      if (!open(board, s, ignore)) { if (enemyAt(board, ignore, s, 'T') && hitAdd(out, s)) return true; break; }
      for (const p of PERP[d]) for (const s2 of OD[s][p]) {
        if (open(board, s2, ignore)) continue;
        if (enemyAt(board, ignore, s2, 'T') && hitAdd(out, s2)) return true;
        break;
      }
    }
  }
  // 물수제비: sq에서 거꾸로 튕겨 걸어 처음 만나는 기물이 적 물수제비(튕김은 길을 뒤집어도 같은 튕김이다)
  if (k == null || k.includes('E')) for (let d = 0; d < 4; d++) {
    let last = -1, hit = false;
    for (const s of DD[sq][d]) {
      if (!open(board, s, ignore)) { hit = true; if (enemyAt(board, ignore, s, 'E') && hitAdd(out, s)) return true; break; }
      last = s;
    }
    if (hit || last < 0) continue;
    const nd = REFLECT[last * 4 + d];
    if (nd < 0) continue;
    for (const s of DD[last][nd]) {
      if (open(board, s, ignore)) continue;
      if (enemyAt(board, ignore, s, 'E') && hitAdd(out, s)) return true;
      break;
    }
  }
  // 광대: sq에 선 내 기물의 모습(opts.form)으로 광대가 sq에 닿으면. 빈칸을 잴 때는 그 모습이 서 있는 것으로 본다
  const form = k != null && !k.includes('M') ? null : opts.form || (board[sq] && board[sq].mine ? board[sq].t : null);
  if (form) {
    let empty = false;
    for (let s = 0; s < 64; s++) {
      if (!enemyAt(board, ignore, s, 'M')) continue;
      if (!board[sq]) { empty = true; board[sq] = PROBE; }
      const hit = reach(board, mimicOf(form), s, -1, ignore).includes(sq);
      if (hit && hitAdd(out, s)) { if (empty) board[sq] = null; return true; }
    }
    if (empty) board[sq] = null;
  }
  return false;
}

// 빈칸 sq에 t 종류의 적(특성 없음 · 얼지 않음)을 새로 세우면 attackers(board, to, opts)에 sq가 드는가 — 그런 빈칸 전부를 한 번에.
// 칸마다 세워 보고 노림 전체를 재던 것(판 짓기의 킹 수비 칸 찾기)과 같은 답을, to에서 뻗는 선을 한 번씩만 걸어 낸다(CHM-44).
// 돌려주는 값: 64칸 표(1 = 그 칸에 세우면 노린다). 차지된 칸은 늘 0. 광대는 지킬 모습을 몰라 늘 비어 있다.
export function guardSquares(board, t, to, opts = {}) {
  const m = new Uint8Array(64);
  const leap = (list) => { for (const s of list) if (!board[s]) m[s] = 1; };
  // 미끄러지는 선: to에서 처음 만나는 기물 앞의 빈칸은 세우면 그 기물이 첫 기물이 된다
  const slide = (set) => { for (const ray of set[to]) for (const s of ray) { if (board[s]) break; m[s] = 1; } };
  if (KNIGHTLIKE.has(t)) leap(KNIGHT[to]);
  if (t === 'K') leap(KING[to]);
  if (t === 'P') { leap(PAWN_UP[to]); if (opts.pawnSides) leap(PAWN_SIDE[to]); }
  if (ORTHO_T.has(t)) slide(RAY_O);
  if (DIAG_T.has(t)) slide(RAY_D);
  if (opts.fairy === false) return m;
  if (t === 'L') leap(CAMEL[to]);
  if (t === 'S') leap(RING2[to]);
  if (t === 'D') leap(KING[to]);
  if (t === 'W') for (const ray of RAY_O[to]) leap(ray);
  // 포: 선의 첫 기물(받침) 너머, 다음 기물 앞의 빈칸
  if (t === 'O') for (const ray of RAY_O[to]) {
    let screen = false;
    for (const s of ray) {
      if (!screen) { if (board[s]) screen = true; continue; }
      if (board[s]) break;
      m[s] = 1;
    }
  }
  // 까마귀: 대각선으로 붙은 빈칸 중 to 너머(반대쪽)가 빈칸인 곳
  if (t === 'V') for (const s of KING[to]) {
    if (board[s] || fileOf(s) === fileOf(to) || rankOf(s) === rankOf(to)) continue;
    const l = crowLand(s, to);
    if (l >= 0 && !board[l]) m[s] = 1;
  }
  // 꺾쇠 · 물수제비: to에서 거꾸로 걸어 닿는 빈칸(길은 뒤집어도 같다)
  if (t === 'T') hookWalk(board, to, -1, (s) => { if (!board[s]) m[s] = 1; });
  if (t === 'E') bounceWalk(board, to, -1, (s) => { if (!board[s]) m[s] = 1; });
  return m;
}

// attackers(board, sq, opts).length > 0 과 같은 답을, 첫 노림수를 만나는 순간 멈추며(목록을 만들지 않고) 낸다.
// 떨굴 칸 고르기 · 킹 먹기 판정이 칸마다 부르는 곳이라 따로 둔다(CHM-44). 검사 하나하나는 attackers와 같다.
function anyAttacker(board, sq, opts, ignore) {
  for (const s of KNIGHT[sq]) if (enemyIn(board, ignore, s, KNIGHTLIKE)) return true;
  for (const s of KING[sq]) if (enemyAt(board, ignore, s, 'K') || (s !== ignore && threat(board[s]) && board[s].trait === 'fort' && board[s].t !== 'K')) return true;
  for (const s of PAWN_UP[sq]) if (enemyAt(board, ignore, s, 'P')) return true;
  if (opts.pawnSides) for (const s of PAWN_SIDE[sq]) if (enemyAt(board, ignore, s, 'P')) return true;
  for (const ray of RAY_O[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (threat(board[s]) && ORTHO_T.has(board[s].t)) return true;
    break;
  }
  for (const ray of RAY_D[sq]) for (const s of ray) {
    if (s === ignore || !board[s]) continue;
    if (threat(board[s]) && DIAG_T.has(board[s].t)) return true;
    break;
  }
  if (opts.fairy === false) return false;
  return fairyHits(board, sq, opts, ignore, null);
}

export const isAttacked = (board, sq, opts = {}) => anyAttacker(board, sq, opts, opts.ignore ?? -1);

// 킹은 아무도 지키지 않을 때만 먹을 수 있다. from = 먹으러 가는 내 기물의 현재 칸(비운 것으로 본다).
export function kingTakeable(board, ksq, from, opts = {}) {
  return !anyAttacker(board, ksq, opts, from ?? -1);
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
    // 방패(적 특성): 사슬의 첫 먹이로는 못 먹는다(떨구기 판정도 첫 먹이)
    if (c.trait === 'shield' && opts.first) continue;
    // 지키는 적 광대는 먹으러 오는 모습(form)으로 지킨다
    if (c.t === 'K' && !opts.openKings && !kingTakeable(board, s, sq, opts.form === form ? opts : { ...opts, form })) continue;
    out.push(s);
  }
  return out;
}

// 기물 t를 떨굴 수 있는 칸: 빈칸 ∧ 노려지지 않음 ∧ 먹을 적이 하나 이상. 폰은 rank 7 금지.
// opts.allowAttacked: 노려지는 칸도 허용(각인 「깃」 자리).
export function dropSquares(board, t, opts = {}) {
  const out = [];
  const ao = opts.form === t ? opts : { ...opts, form: t }; // 적 광대는 떨굴 모습의 행마로 지킨다
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq]) continue;
    if (t === 'P' && rankOf(sq) === 7) continue;
    if (!opts.allowAttacked && isAttacked(board, sq, ao)) continue;
    if (captures(board, t, sq, { ...opts, first: true }).length === 0) continue;
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
