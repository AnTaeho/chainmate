// 복기(CHM-59, docs/design-notes/agency.md B): 진 대국에서 「여기서 갈렸다」를 찾는다.
// 대국은 시드로 정해져 있다(주머니 차례 · 증원 · 확률). 대국 상태의 복사본에 명령을 두면 「그렇게 뒀다면 실제로 이렇게 뽑히고 들어왔다」는
// 진짜 미래가 나온다. 규칙은 바꾸지 않는다 — 복사본에서 apply만 부른다.
//
// 갈림길: 내 결정(떨구기 + 그 사슬 · 희생 · 다시 놓기)마다 그 앞의 상태 S_k를 남겨 둔다(steps[k] = { state, cmds }).
// k = n−1부터 거꾸로, S_k에서 이길 길을 찾는다. 길이 있는 첫 k(= 길이 있는 마지막 k)에서 내가 둔 결정이 「?」, 찾은 길이 「!」.
// 그보다 뒤의 k 하나라도 예산에 닿았으면 그 k가 마지막이라고 말할 수 없어 unknown.
//
// 길 찾기: 결정마다 빔 — 풀이기(bestMove collect)가 잰 떨구기 자리별 최선 사슬 가운데 위 REVIEW.beam개(메이트 먼저, 점수 차례),
// 희생(손 기물 종류마다 하나, 값 낮은 것부터), 다시 놓기(첫 수 전)를 깊이 우선으로 펼친다. 마지막 수는 최선 사슬 하나면 정확하다
// (점수 최대 · 메이트 우선 사슬이 목표에 못 닿으면 다른 사슬도 못 닿는다). 목표에 닿거나 체크메이트면 이긴 길이다.
// 예산은 마디 수(풀이기 마디 + 펼친 결정)로만 잰다 — 시계를 보지 않으니 같은 대국이면 늘 같은 답이다.
// none의 뜻: 모든 k에서 「빔 안에서」 이길 길이 없었다(증명이 아니다 — 빔 밖의 길은 보지 않는다).
import { apply, canReboard } from './battle.js';
import { bestMove, lineCommands } from './solver.js';
import { valueOf } from '../data/pieces.js';

// beam: 결정마다 펼칠 떨구기 수(배열이면 남은 수마다) · sac: 결정마다 펼칠 희생 수(값 낮은 기물 종류부터)
// nodes: 복기 한 번(모든 k)의 마디 예산 — 마디당 ≈ 0.015ms(Node 한 일꾼)라 10만이면 1.5초 안팎(브라우저 2초 안).
// solver: 결정 하나를 재는 풀이기 마디 예산(봇과 같은 10000).
// 고른 값(진 대국 60개, 예산 100만으로 견줌): 빔 4 · 희생 1이 길을 찾은 몫은 빔 4 · 희생 4와 거의 같고(38 대 39) 마디 10만 안에
// 판정이 나는 몫은 37 → 55. 빔을 줄이면(남은 수마다 2 · 3) 빠르지만 길을 덜 찾아 none이 는다(무승부(C) 판정 근거가 흐려진다).
export const REVIEW = { beam: 4, nodes: 100000, solver: 10000, sac: 1, sacMax: Infinity };

// 길이 없다고 다 본 상태(예산에 닿지 않고 빈손으로 끝난 상태)의 지문. 갈림길을 거꾸로 찾을 때 S_k의 탐색이 내 결정을 거쳐
// S_k+1(이미 다 본 상태)로 다시 들어가는 일이 잦다 — 같은 상태는 같은 미래라 다시 보지 않는다. 지문은 JSON 글의 53비트 해시.
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ── 대국 봇(tools/bot.mjs 내다보기)과 함께 쓰는 것
export const cloneBattle = (b) => JSON.parse(JSON.stringify(b));
export const pieceKey = (p) => p.t + JSON.stringify(p.eng ?? null) + (p.soul || '') + (p.awake ? '!' : '');
// 결정(봇 꼴: { play: { handIndex, sq, line } } | { discard: [i] } | { reboard: true }) → 대국 명령
export function decisionCommands(d) {
  if (d.reboard) return [{ type: 'reboard' }];
  if (d.discard) return [{ type: 'discard', handIndices: d.discard }];
  return [{ type: 'drop', handIndex: d.play.handIndex, sq: d.play.sq }, ...lineCommands(d.play.line)];
}
export function applyDecision(t, d) { for (const c of decisionCommands(d)) apply(t, c); }

// ── 내 결정 기록(화면 · 하네스): 둘 차례(status 'play')에서 떨구기 · 희생 · 다시 놓기를 두기 직전에 noteStep,
// 그 결정의 사슬 명령(capture · redrop)은 noteCmd로 마지막 결정에 붙인다. 판 상태에는 아무것도 적지 않는다.
export function noteStep(steps, b, cmd) {
  if (b.status === 'play' && (cmd.type === 'drop' || cmd.type === 'discard' || cmd.type === 'reboard')) steps.push({ state: cloneBattle(b), cmds: [cmd] });
  else if (b.status === 'chain' && steps.length && (cmd.type === 'capture' || cmd.type === 'redrop')) steps[steps.length - 1].cmds.push(cmd);
}

// 결정 하나를 사람 말 재료로: { kind: 'drop' | 'discard' | 'reboard', t, sq, cmds }
export function describe(state, cmds) {
  const c = cmds[0];
  if (c.type === 'drop') return { kind: 'drop', t: state.hand[c.handIndex].t, sq: c.sq, cmds };
  if (c.type === 'discard') return { kind: 'discard', t: state.hand[c.handIndices[0]].t, cmds };
  return { kind: 'reboard', cmds };
}

// 다 본 상태의 열쇠: 상태 지문 + 남은 희생 몫(sacMax가 있으면 같은 상태도 남은 몫에 따라 미래가 다르다)
const keyOf = (u, budget) => `${hash53(JSON.stringify(u))}:${Math.min(9, REVIEW.sacMax - ((u.discardsUsed || 0) - budget.sac0))}`;
// beam이 배열이면 남은 수마다(beam[movesLeft], 없으면 마지막 값)
const beamOf = (t) => (Array.isArray(REVIEW.beam) ? REVIEW.beam[Math.min(t.movesLeft, REVIEW.beam.length - 1)] : REVIEW.beam);
// 둘 차례의 결정 후보(빔). 같은 종류 기물 · 같은 칸은 하나로.
function expand(t, budget) {
  const out = [];
  const collect = [];
  const m = t.hand.length ? bestMove(t, { collect, maxNodes: REVIEW.solver }) : null;
  budget.used += (m ? m.nodes : 0) + 1;
  if (m) {
    if (t.movesLeft <= 1 || beamOf(t) <= 1) out.push({ play: { handIndex: m.handIndex, sq: m.sq, line: m.line } });
    else {
      const seen = new Set();
      const order = collect.map((c, i) => ({ c, i })).sort((a, b) => (a.c.mate !== b.c.mate ? (a.c.mate ? -1 : 1) : b.c.score - a.c.score || a.i - b.i));
      for (const { c } of order) {
        const k = pieceKey(t.hand[c.handIndex]) + '@' + c.sq;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ play: { handIndex: c.handIndex, sq: c.sq, line: c.line } });
        if (seen.size >= beamOf(t)) break;
      }
    }
  }
  if (t.discardsLeft > 0 && t.bag.length > 0 && (t.discardsUsed || 0) - budget.sac0 < REVIEW.sacMax) {
    const seen = new Set();
    const idx = t.hand.map((p, i) => ({ p, i })).sort((a, b) => valueOf(a.p.t) - valueOf(b.p.t) || a.i - b.i);
    for (const { p, i } of idx) { const k = pieceKey(p); if (seen.has(k)) continue; seen.add(k); out.push({ discard: [i] }); if (seen.size >= REVIEW.sac) break; }
  }
  if (t.target != null && canReboard(t)) out.push({ reboard: true });
  return out;
}

// t(둘 차례)에서 이기는 결정 줄. 찾으면 [{ kind, t, sq, cmds, gain, score }…], 못 찾으면 null(예산에 닿았으면 budget.hit).
// 제너레이터: 결정을 하나 펼칠 때마다 한 번 쉰다(화면이 프레임마다 나눠 돌린다 — 쉬는 자리가 답을 바꾸지 않는다).
function* dfs(t, budget, key = null) {
  if (budget.used >= budget.max) { budget.hit = true; return null; }
  const cands = expand(t, budget);
  yield budget.used;
  for (const d of cands) {
    if (budget.used >= budget.max) { budget.hit = true; return null; }
    const u = cloneBattle(t);
    const cmds = decisionCommands(d);
    try { for (const c of cmds) apply(u, c); } catch { continue; }
    budget.used++;
    const step = { ...describe(t, cmds), gain: u.score - t.score, score: u.score };
    if (u.status === 'won') return [{ ...step, reason: u.result.reason }];
    if (u.status !== 'play') continue;
    const k = keyOf(u, budget);
    if (budget.dead.has(k)) continue;
    const rest = yield* dfs(u, budget, k);
    if (rest) return [step, ...rest];
    if (budget.hit) return null;
  }
  if (key != null) budget.dead.add(key);
  return null;
}

// 한 상태에서 이길 길 찾기(시험 · 하네스용). { path, nodes, hit }
export function findWin(b, { nodes = REVIEW.nodes } = {}) {
  const budget = { used: 0, max: nodes, hit: false, dead: new Set(), sac0: b.discardsUsed || 0 };
  const g = dfs(cloneBattle(b), budget);
  let r = g.next();
  while (!r.done) r = g.next();
  return { path: r.value, nodes: budget.used, hit: budget.hit };
}

// 같은 떨구기(같은 기물 · 같은 칸)면 사슬이 처음 갈리는 명령: { mine, best }(mine은 내 사슬이 거기서 끝났으면 null)
function splitOf(mine, best) {
  if (mine.kind !== 'drop' || best.kind !== 'drop' || mine.t !== best.t || mine.sq !== best.sq) return null;
  for (let i = 1; i < Math.max(mine.cmds.length, best.cmds.length); i++) {
    const a = mine.cmds[i], b = best.cmds[i];
    if (!a || !b || a.type !== b.type || a.sq !== b.sq) return { mine: a || null, best: b || null };
  }
  return null;
}

// 복기 한 번. steps: noteStep 기록, end: 진 대국(마지막 상태). opts.nodes: 예산.
// 돌려주는 값(제너레이터의 return):
//   { kind: 'path', at, move, mine, mines: [갈림길부터 내 결정…], best: [결정…], split, mate, scores: { mine, best, target }, nodes }
//   { kind: 'none', nodes } · { kind: 'unknown', at?, nodes }
// mine · best[i]: describe 꼴 + gain(그 결정이 낸 점수). move: 갈림길 상태의 「N수째」(movesUsed + 1).
export function* reviewGen(steps, end, opts = {}) {
  const budget = { used: 0, max: opts.nodes ?? REVIEW.nodes, hit: false, dead: new Set() };
  if (!steps.length || !end) return { kind: 'unknown', nodes: 0 };
  for (let k = steps.length - 1; k >= 0; k--) {
    const s = steps[k].state;
    budget.sac0 = s.discardsUsed || 0;
    const path = yield* dfs(cloneBattle(s), budget, keyOf(s, budget));
    if (path) {
      // 갈림길부터 내가 둔 결정들(다시 두기 왼쪽 칸이 수마다 견준다)
      const mines = steps.slice(k).map((st, i) => {
        const after = k + i + 1 < steps.length ? steps[k + i + 1].state.score : end.score;
        return { ...describe(st.state, st.cmds), gain: after - st.state.score };
      });
      const last = path[path.length - 1];
      return { kind: 'path', at: k, move: s.movesUsed + 1, mine: mines[0], mines, best: path, split: splitOf(mines[0], path[0]), mate: last.reason === 'mate', scores: { mine: end.score, best: last.score, target: end.target ?? null }, nodes: budget.used };
    }
    if (budget.hit) return { kind: 'unknown', at: k, nodes: budget.used };
  }
  // 이어 하기로 대국 가운데부터 남은 기록이면 처음 상태를 보지 못했다
  const s0 = steps[0].state;
  const partial = s0.movesUsed > 0 || (s0.discardsUsed || 0) > 0 || (s0.reboards || 0) > 0;
  return { kind: partial ? 'unknown' : 'none', nodes: budget.used };
}
export function review(steps, end, opts = {}) {
  const g = reviewGen(steps, end, opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
