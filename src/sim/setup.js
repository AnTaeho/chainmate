// 대국판 짓기: 적 수 · 킹 수비 · 적의 무게. 대국 시작(battle.js)과 판을 다시 채우는 규칙(chain.js)이 같이 쓴다.
import { int, next } from './rng.js';
import { at, attackers, guardSquares, emptyBoard, fileOf, rankOf } from './board.js';
import { TRAITS, traitChance } from '../data/traits.js';

// 판 생성 수치(하네스로 맞춤, step 2a):
//   적 수 8 + 관(최소 10) — 7 + 관이면 1~3관에서 판이 빨리 비어 폰이 떨굴 곳을 잃고 막힘 패배가 잦았다.
//   킹 수비 3, 3관부터 4(폰 하나 포함) — 둘이면 첫 수 외통이 3~5%, 셋이면 1~2%. 판(런)에서 무거운 덱과
//   끊김 넘기기 격언이 붙으면 셋으로도 5~9%라 3관부터 넷.
//   증원 수마다 2 — 1이면 1~3관 막힘이 두 배.
export const enemyCount = (ante) => Math.max(10, 8 + ante);
export const kingGuards = (ante) => (ante >= 6 ? 6 : ante >= 5 ? 5 : ante >= 3 ? 4 : 3); // 깊이 층 뒤 5관부터 다섯: 이형 · 가족으로 수비수를 다 치우기 쉬워져 외통이 대국의 15~20%였다
export const reinforceCount = () => 2;

// 관이 오를수록 무거운 적. 초안 — step 2에서 시뮬로 맞춘다.
// 깊이 A: 4관부터 이형 적이 섞인다(관마다 무게 +FAIRY_ENEMY.step, 겹친 기물은 반). 먹으면 그 이형이 된다.
export const FAIRY_ENEMY = { from: 4, step: 0.12 };
// CHM-55: 적으로 나온 새 기물은 먹으면 센 모습을 입혀 준다(꺾쇠 두 번 꺾기 · 물수제비 두 번 튕기기) — 화약병만 입으면 사슬이 끝나 낮게
export const FAIRY_ENEMY_W = { Z: 0.25, L: 1, O: 1, S: 1, W: 0.5, T: 1, E: 1.5, V: 1, M: 1, D: 0.25 };
// 세력(docs/design-notes/factions.md): 대국 규칙 깃발로 적 구성을 비튼다(세력 id는 모른다).
//   rules.mix     { 종류: 곱 } 관별 무게에 곱한다(주력 적). fairy 키는 이형 전부에 곱한다
//   rules.unique  { 이형: 무게 } 고유 적 — 1관부터 UNIQUE.base × (1 + UNIQUE.step × (관 − 1)) × 무게로 섞인다(4관부터의 이형 무게에 더한다)
export const UNIQUE = { base: 0.35, step: 0.25 };
export function enemyWeights(ante, rules = null) {
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
  if (!rules || (!rules.mix && !rules.unique)) return w;
  const mix = rules.mix || {};
  const out = w.map(([t, x]) => [t, x * (mix[t] ?? (FAIRY_ENEMY_W[t] != null ? mix.fairy ?? 1 : 1))]);
  const u = UNIQUE.base * (1 + UNIQUE.step * (ante - 1));
  for (const [t, x] of Object.entries(rules.unique || {})) {
    const row = out.find((r) => r[0] === t);
    if (row) row[1] += u * x; else out.push([t, u * x]);
  }
  return out;
}
// 무게 표 하나에서 종류 하나를 굴린다
export function rollFrom(rng, w) {
  let total = 0;
  for (const [, x] of w) total += x;
  let r = next(rng) * total;
  for (const [t, x] of w) { if ((r -= x) < 0) return t; }
  return w[w.length - 1][0];
}
// rules: 대국 규칙(세력 깃발). 없으면 관별 기본 무게
// guard: 킹을 지킬 적을 굴린다(옛 호출과 맞추려고 남겼다 — 광대는 지킬 칸이 없어 수비수 자리에서 저절로 빠진다)
export function rollType(rng, ante, rules = null, guard = false) {
  const w = enemyWeights(ante, rules);
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
  // 칸마다 세워 보고 노림을 재던 것과 같은 답(guardSquares, CHM-44)
  const hit = guardSquares(board, t, ksq, opts);
  const out = [];
  for (let sq = 16; sq < 64; sq++) if (hit[sq] && !reserve.includes(sq)) out.push(sq);
  return out;
}

export function kingDefended(board, ksq, opts = {}, guards = 2) {
  const at = attackers(board, ksq, opts);
  return at.length >= guards && at.some((s) => board[s].t === 'P');
}

// 판 위 사물(깊이 F): 2관부터 드물게 보석 하나 · 벽 한두 칸(배수를 막는 벽은 포의 받침이 된다)
export const THINGS = { from: 2, gem: 0.3, wall: 0.25 };
function placeTraits(b, rng, board) {
  const p = b.rules.traits === false ? 0 : traitChance(b.ante ?? 1, b.rules);
  if (!p) return;
  for (let sq = 0; sq < 64; sq++) {
    const c = board[sq];
    if (!c || c.mine || c.t === 'K' || c.t === 'X' || c.t === 'J') continue;
    if (next(rng) < p) c.trait = TRAITS[int(rng, TRAITS.length)].id;
  }
}
// 세력 깃발 rules.walls = [적어도, 많아야]: 판마다 벽이 그만큼 늘 선다(수도원의 돌기둥)
function placeThings(b, rng, board, reserve) {
  if (b.rules.walls && b.rules.things !== false) {
    const [lo, hi] = b.rules.walls;
    const n = lo + int(rng, hi - lo + 1);
    for (let i = 0; i < n; i++) { const sq = randomEmpty(rng, board, 2, reserve); if (sq >= 0) board[sq] = { t: 'X', id: b.nextId++, born: -1 }; }
  }
  if ((b.ante ?? 1) < THINGS.from || b.rules.things === false) return;
  if (next(rng) < THINGS.gem) { const sq = randomEmpty(rng, board, 2, reserve); if (sq >= 0) board[sq] = { t: 'J', id: b.nextId++, born: -1 }; }
  if (next(rng) < THINGS.wall) {
    const n = 1 + int(rng, 2);
    for (let i = 0; i < n; i++) { const sq = randomEmpty(rng, board, 2, reserve); if (sq >= 0) board[sq] = { t: 'X', id: b.nextId++, born: -1 }; }
  }
}

// 세력 깃발 rules.wallRow = { ranks: [줄…] }: 판을 가로지르는 벽 한 줄, 가운데 네 칸(c~f) 중 하나가 빈 문(성채)
export const WALL_ROW = { gateFiles: [2, 3, 4, 5] };
function placeWallRow(b, rng, board, reserve) {
  const wr = b.rules.wallRow;
  if (!wr || b.rules.things === false) return;
  const rank = wr.ranks[int(rng, wr.ranks.length)];
  const gate = WALL_ROW.gateFiles[int(rng, WALL_ROW.gateFiles.length)];
  for (let f = 0; f < 8; f++) {
    const sq = rank * 8 + f;
    if (f !== gate && !board[sq] && !reserve.includes(sq)) board[sq] = { t: 'X', id: b.nextId++, born: -1 };
  }
}

export function generateBoard(b, rng = b.rng.board, reserve = []) {
  const count = b.rules.enemies ?? enemyCount(b.ante);
  const kings = b.rules.kings;
  const guards = (b.rules.guards ?? kingGuards(b.ante)) + (b.rules.guardsBonus || 0);
  const opts = { pawnSides: b.rules.pawnSides };
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = emptyBoard();
    const ksqs = [];
    let placed = 0, ok = true;
    const put = (sq, t) => { board[sq] = { t, id: b.nextId++, born: -1 }; placed++; };
    placeWallRow(b, rng, board, reserve);
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
        const t2 = rollType(rng, b.ante, b.rules, true);
        const cand = defenderSquares(board, t2, ksq, opts, reserve);
        if (!cand.length) { ok = false; break; }
        put(cand[int(rng, cand.length)], t2);
      }
    }
    if (!ok) continue;
    for (let i = placed; i < count; i++) {
      const sq = randomEmpty(rng, board, 2, reserve);
      if (sq < 0) break;
      put(sq, rollType(rng, b.ante, b.rules));
    }
    placeThings(b, rng, board, reserve);
    placeTraits(b, rng, board);
    if (ksqs.every((s) => kingDefended(board, s, opts, guards))) return board;
  }
  throw new Error('board generation failed');
}

