// 대국판 짓기: 적 수 · 킹 수비 · 적의 무게. 대국 시작(battle.js)과 판을 다시 채우는 규칙(chain.js)이 같이 쓴다.
import { int, next } from './rng.js';
import { at, attackers, emptyBoard, fileOf, rankOf } from './board.js';

// 판 생성 수치(하네스로 맞춤, step 2a):
//   적 수 8 + 관(최소 10) — 7 + 관이면 1~3관에서 판이 빨리 비어 폰이 떨굴 곳을 잃고 막힘 패배가 잦았다.
//   킹 수비 3, 3관부터 4(폰 하나 포함) — 둘이면 첫 수 외통이 3~5%, 셋이면 1~2%. 판(런)에서 무거운 주머니와
//   끊김 넘기기 격언이 붙으면 셋으로도 5~9%라 3관부터 넷.
//   증원 수마다 2 — 1이면 1~3관 막힘이 두 배.
export const enemyCount = (ante) => Math.max(10, 8 + ante);
export const kingGuards = (ante) => (ante >= 3 ? 4 : 3);
export const reinforceCount = () => 2;

// 관이 오를수록 무거운 적. 초안 — step 2에서 시뮬로 맞춘다.
// 깊이 A: 4관부터 이형 적이 섞인다(관마다 무게 +FAIRY_ENEMY.step, 겹친 기물은 반). 먹으면 그 이형이 된다.
export const FAIRY_ENEMY = { from: 4, step: 0.12 };
const FAIRY_ENEMY_W = { A: 0.5, C: 0.5, Z: 0.25, L: 1, H: 1, G: 1, O: 1, S: 1, W: 0.5 };
export function enemyWeights(ante) {
  const w = [
    ['P', Math.max(2, 7 - 0.6 * ante)],
    ['N', 2 + 0.1 * ante],
    ['B', 2 + 0.1 * ante],
    ['R', 1 + 0.25 * ante],
    ['Q', 0.3 + 0.2 * ante],
  ];
  if (ante >= FAIRY_ENEMY.from) {
    const k = FAIRY_ENEMY.step * (ante - FAIRY_ENEMY.from + 1);
    for (const [t, x] of Object.entries(FAIRY_ENEMY_W)) w.push([t, k * x]);
  }
  return w;
}
export function rollType(rng, ante) {
  const w = enemyWeights(ante);
  let total = 0;
  for (const [, x] of w) total += x;
  let r = next(rng) * total;
  for (const [t, x] of w) { if ((r -= x) < 0) return t; }
  return w[w.length - 1][0];
}

export function randomEmpty(rng, board, minRank, exclude = []) {
  const free = [];
  for (let sq = minRank * 8; sq < 64; sq++) if (!board[sq] && !exclude.includes(sq)) free.push(sq);
  return free.length ? free[int(rng, free.length)] : -1;
}

// 킹 수비: 킹마다 둘 이상이 지키고 그중 하나는 폰(킹 한 줄 위 대각).
// 폰 모습은 위로만 먹으니 그 폰을 먹은 자리에서는 킹에 닿지 못한다 — 수비수 하나만 치워 곧바로 외통이 나는 판을 막는다.
function defenderSquares(board, t, ksq, opts, reserve = []) {
  const out = [];
  for (let sq = 16; sq < 64; sq++) {
    if (board[sq] || reserve.includes(sq)) continue;
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

// 판 위 사물(깊이 F): 2관부터 드물게 보석 하나 · 벽 한두 칸(연쇄를 막는 벽은 포 · 메뚜기의 받침이 된다)
export const THINGS = { from: 2, gem: 0.3, wall: 0.25 };
function placeThings(b, rng, board, reserve) {
  if ((b.ante ?? 1) < THINGS.from || b.rules.things === false) return;
  if (next(rng) < THINGS.gem) { const sq = randomEmpty(rng, board, 2, reserve); if (sq >= 0) board[sq] = { t: 'J', id: b.nextId++, born: -1 }; }
  if (next(rng) < THINGS.wall) {
    const n = 1 + int(rng, 2);
    for (let i = 0; i < n; i++) { const sq = randomEmpty(rng, board, 2, reserve); if (sq >= 0) board[sq] = { t: 'X', id: b.nextId++, born: -1 }; }
  }
}

export function generateBoard(b, rng = b.rng.board, reserve = []) {
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
      for (let sq = 32; sq < 56; sq++) if (!board[sq] && !reserve.includes(sq)) free.push(sq);
      const ksq = free[int(rng, free.length)];
      put(ksq, 'K');
      ksqs.push(ksq);
      const pawnAt = [at(fileOf(ksq) - 1, rankOf(ksq) + 1), at(fileOf(ksq) + 1, rankOf(ksq) + 1)].filter((s) => s >= 0 && !board[s] && !reserve.includes(s));
      if (!pawnAt.length) { ok = false; break; }
      put(pawnAt[int(rng, pawnAt.length)], 'P');
      for (let g = 1; g < guards && ok; g++) {
        const t2 = rollType(rng, b.ante);
        const cand = defenderSquares(board, t2, ksq, opts, reserve);
        if (!cand.length) { ok = false; break; }
        put(cand[int(rng, cand.length)], t2);
      }
    }
    if (!ok) continue;
    for (let i = placed; i < count; i++) {
      const sq = randomEmpty(rng, board, 2, reserve);
      if (sq < 0) break;
      put(sq, rollType(rng, b.ante));
    }
    placeThings(b, rng, board, reserve);
    if (ksqs.every((s) => kingDefended(board, s, opts, guards))) return board;
  }
  throw new Error('board generation failed');
}

