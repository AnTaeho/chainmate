// 대국 봇(하네스 공용). 매 결정마다 풀이기(solver.js)로 손 기물별 최선 수를 찾는다.
//   외통이 보이면 바로 둔다(nomate면 피한다).
//   희생(CHM-35, 명령 id는 discard)은 한 번에 하나. 바친 기물은 이번 대국에 돌아오지 않는다.
//   희생은 이득일 때만(CHM-51, sacrificeChoice): 바치기 전 최선 사슬과 「바친 뒤 기대값」을 견준다. 주머니 맨 앞 둘은 사람처럼
//   안다(CHM-60 「다음 수」) — 바쳐서 들어올 기물을 지금 판에서 혼자 둔 최선(희생으로 뽑은 셈이라 메이트면 탁월수 배수까지)으로 잰다.
//   셋째부터 들어와야 할 때만 옛 판단처럼 가려진 주머니 구성으로 평균한다. 손해는 바친 기물이 남은 수에 낼 몫과, 희생 횟수를 보는 조정자(격언 「뽑은 대로」 …)가
//   남은 사슬에서 덜어 갈 몫이다.
//   sacrifice: false(하네스 정책 nosac)면 손이 나빠도 바치지 않는다.
//   둘 다 떨굴 수가 아예 없으면 값이 가장 낮은 기물 하나를 바친다.
//   폰 아끼지 않기: 폰은 떨굴 자리가 드물어 끝까지 남기면 막힌다. 남은 폰이 남은 수 − 1 이상이면
//   최선의 절반 이상을 내는 폰 수를 먼저 둔다.
//   목표가 있으면: 목표를 넘기는 수가 여럿이면 그중 아무거나(최선)로 충분하다.
//   다시 놓기(밤샘 2 D2): 첫 수 전, 첫 손 최선 사슬 점수 × 수가 목표 × REBOARD.ratio에 못 미치면 판을 새로 깐다
//   (첫 손 최선 사슬 점수가 대국 점수의 대리 지표 — docs/reports/luck.md ④).
import { bestPerPiece, lineCommands } from '../src/sim/solver.js';
import { canReboard, NEXT_DRAWS, nextDraws } from '../src/sim/battle.js';
import { createRng, fork, next, shuffle } from '../src/sim/rng.js';
import { valueOf } from '../src/data/pieces.js';
import { bestMove } from '../src/sim/solver.js';
import { addOffering, weightOf as weightOfPiece } from '../src/data/sacrifice.js';
import { cloneBattle, applyDecision, pieceKey } from '../src/sim/replay.js';

// ratio 1 → 2(밤샘 2 3부): 1이면 대국당 0.08번만 다시 놓아 판을 끝낸 죽음의 판 운 몫이 52.6%, 2면 0.18번 · 31.3%(luck 30판)
export const REBOARD = { ratio: 2 }; // 켜고 끄기는 src/sim/tuning.js BOARD_TUNING.reboard(끄면 canReboard가 늘 거짓)
// 하네스 세기 손잡이(실력 천장 측정, docs/reports/agency-measure.md). 기본값이면 옛 봇과 비트 단위로 같다.
//   nodes: 대국 결정의 풀이기 마디 예산(null = 풀이기 기본 10000)
//   look: 내다보기 굴림 수(0 = 끔). 켜면 결정마다 후보(손 기물마다 최선 수 · 손 칸마다 희생 · 다시 놓기)를
//         모르는 것(주머니 차례 · 앞으로 올 증원 · 다시 놓을 판 · 확률)을 새로 섞은 look개의 복사본에서 이 봇(내다보기 없이)으로
//         끝까지 두어 보고, 이긴 몫(같으면 평균 점수)이 가장 큰 후보를 고른다. 굴림 시드는 후보끼리 같다(공통 난수).
//   stats: 결정마다 풀이기가 예산에 닿았나 센다(예산 손잡이가 실제로 움직이는지 보려고)
export const BOT = { nodes: null, look: 0, stats: null };
const betterMove = (x, y, nomate, rank) => !y || (x.mate !== y.mate ? (nomate ? y.mate : x.mate) : rank ? rank(x) > rank(y) : x.score > y.score);

// rank: 풀이기에 넘길 줄 평가(판 봇의 「노리기」 정책이 황금 기물 · 재현에 덤을 준다). 없으면 점수.
export function decideBattle(b, { nomate = false, pawnRatio = 0.5, rank = null, sacrifice = true } = {}) {
  const per = bestPerPiece(b, { preferMate: nomate ? 'avoid' : true, rank, ...(BOT.nodes ? { maxNodes: BOT.nodes } : {}) });
  if (BOT.stats) { BOT.stats.decisions++; const lim = BOT.nodes ?? 10000; if (per.some((m) => m && m.nodes > lim)) BOT.stats.capped++; }
  let best = null;
  for (const m of per) if (m && betterMove(m, best, nomate, rank)) best = m;
  const canDiscard = b.discardsLeft > 0 && b.bag.length > 0;
  if (best && best.mate && !nomate) return { play: best };
  if (b.target != null && canReboard(b) && (!best || best.score * b.movesLeft < (b.target - b.score) * REBOARD.ratio)) return { reboard: true };
  const roomy = b.bag.length >= b.movesLeft;
  if (!best) {
    if (!canDiscard) return null;
    let low = 0;
    b.hand.forEach((p, i) => { if (valueOf(p.t) < valueOf(b.hand[low].t)) low = i; });
    return { discard: [low], why: 'stuck', before: 0 };
  }
  const need = b.target != null ? b.target - b.score : Infinity;
  if (best.score >= need) return { play: best };
  if (sacrifice && canDiscard && roomy) {
    const pick = sacrificeChoice(b, per.map((m) => (m ? m.score : null)), best, { need, preferMate: nomate ? 'avoid' : true });
    if (pick) return { discard: [pick.index], why: 'gain', before: best.score, gain: pick.gain };
  }
  if (b.hand[best.handIndex].t !== 'P') {
    const pawnsLeft = b.hand.filter((p) => p.t === 'P').length + b.bag.filter((p) => p.t === 'P').length;
    if (pawnsLeft >= Math.max(1, b.movesLeft - 1)) {
      let pb = null;
      per.forEach((m, i) => { if (m && b.hand[i].t === 'P' && (nomate ? !m.mate : true) && (!pb || m.score > pb.score)) pb = m; });
      if (pb && pb.score >= pawnRatio * best.score) return { play: pb };
    }
  }
  return { play: best };
}

// ── 희생 판단(CHM-51). 대국 봇과 상점 봇의 짜임 재기(shopbot evalBuild)가 함께 쓴다.
//   keep: 바친 기물(또는 그 자리에 남을 기물)이 남은 수 가운데 한 번 쓰일 몫. 손 넷 · 수 넷이면 손의 약한 기물은 반쯤 안 쓰인다.
//   margin: 바치기 전 최선 사슬 대비 이만큼 넘게 남아야 바친다(희생 횟수 · 상금 격언 「절약」처럼 재지 않는 몫을 덮으려고).
//   nodes: 주머니 기물 하나를 재는 풀이기 마디 예산.
//   weakChain: 지금 최선 사슬이 이만큼 먹기 이하일 때만 잰다(옛 「손이 나쁠 때」 문턱 — 짜임 재기가 모든 판에서 주머니를 재면 하네스가 몇 배 느려진다).
//   keys: 주머니에서 재는 서로 다른 기물 수(많이 든 것부터). 나머지는 잰 것들의 평균으로 친다.
export const SAC = { keep: 0.5, margin: 0.1, nodes: 2000, weakChain: 2, keys: 4 };
export { pieceKey }; // 복기(src/sim/replay.js)와 함께 쓴다

// 희생으로 뽑을 기물 하나를 지금 판에 혼자 둔 최선 { score, mate }.
// 탁월수 배수는 바친 무게에 달려서, 무게 1(폰)을 바친 셈으로 재 두고 후보마다 비율로 바꾼다(배수 ×(1 + 무게)는 곱이다).
// 희생 한 번을 쓴 대국으로 재므로 희생 횟수를 보는 조정자가 그대로 반영된다.
// 손은 바칠 기물을 아직 쥔 다섯 장으로 잰다(바칠 후보마다 다시 재지 않으려고) — 손 크기를 보는 조정자(막내 · 맏이 · 혼 「계주」)에는 한 장이 더 보이는 근사다.
function drawProbe(b, p, opts) {
  const base = b.offering && b.offering.weight ? b.offering.weight : 0;
  const offering = addOffering(b.offering, 'P');
  offering.drawn = [...offering.drawn, p.id];
  const t = { ...b, hand: [...b.hand, p], offering, discardsLeft: b.discardsLeft - 1, discardsUsed: (b.discardsUsed || 0) + 1, discarded: (b.discarded || 0) + 1 };
  const r = bestMove(t, { handIndices: [b.hand.length], preferMate: opts.preferMate, maxNodes: opts.nodes ?? SAC.nodes });
  return { score: r ? r.score : 0, mate: !!(r && r.mate), probe: 1 + base + 1 };
}
// 희생으로 들어올 것: [{ n(무게), score, mate, probe }]. 「다음 수」(CHM-60)로 주머니 맨 앞 둘은 보이니 아는 그대로 잰다 —
// 한 장을 바치면 손이 하나 비어 맨 앞 하나가 들어온다(손이 이미 넘치면 0장, 모자랐으면 더). 들어올 것이 모두 아는 둘 안이면
// 그 가운데 가장 좋은 것 하나(무게 1)로 친다. 셋째부터 들어와야 하면(드묾) 옛 판단처럼 가려진 주머니 구성으로 평균한다.
function bagDraws(b, opts) {
  const k = Math.max(0, Math.min(b.bag.length, b.rules.hand - (b.hand.length - 1)));
  if (k === 0) return [{ n: 1, score: 0, mate: false, probe: 1 }];
  if (k <= NEXT_DRAWS) {
    let best = null;
    for (const p of nextDraws(b, k)) {
      const d = drawProbe(b, p, opts);
      if (!best || (d.mate !== best.mate ? d.mate : d.score > best.score)) best = d;
    }
    return [{ n: 1, ...best }];
  }
  const groups = new Map();
  for (const p of b.bag.slice(NEXT_DRAWS)) { const key = pieceKey(p); if (groups.has(key)) groups.get(key).n++; else groups.set(key, { p, n: 1 }); }
  // 많이 든 것부터(같으면 주머니 차례) keys개만 — 무게 n은 그대로라 잰 것들끼리의 평균이 된다
  const top = [...groups.values()].sort((x, y) => y.n - x.n).slice(0, opts.keys ?? SAC.keys);
  return top.map(({ p, n }) => ({ n, ...drawProbe(b, p, opts) }));
}

// 바칠 손 칸 고르기: 이득 = (이번 수의 기대 − S0) + keep × (손에 남을 기물 − 바친 기물) − 남은 사슬에서 덜어 갈 몫.
// S1: 바친 뒤 지금 최선 기물의 사슬, futureCost: 남은 수의 사슬이 희생 한 번으로 잃는 몫(희생 횟수를 보는 조정자)
function chooseSacrifice(b, per, best, draws, { u, S0, S1, need, mateWins, futureCost }) {
  const total = draws.reduce((a, d) => a + d.n, 0);
  const q = b.movesLeft > 1 ? SAC.keep : 0;
  const base = b.offering && b.offering.weight ? b.offering.weight : 0;
  let pick = null;
  b.hand.forEach((piece, i) => {
    if (i === best.handIndex) return;
    const hv = per[i] == null ? 0 : u(per[i]);
    const x = 1 + base + weightOfPiece(piece.t); // 이 기물을 바치면 탁월수 배수
    let now = 0, kept = 0;
    for (const d of draws) {
      // 뽑은 기물이 메이트를 내면 탁월수: 목표가 있는 대국이면 이긴다, 없으면 배수 비율만큼 점수
      const v = d.mate ? (mateWins ? need : u(Math.floor((d.score * x) / d.probe))) : u(d.score);
      now += d.n * Math.max(S1, v);
      kept += d.n * Math.min(S1, d.mate && mateWins ? S1 : u(d.score)); // 이번에 안 쓴 쪽이 손에 남는다(탁월수 몫은 이번 수뿐)
    }
    const gain = (now / total - S0) + q * (kept / total - hv) - futureCost;
    if (gain > SAC.margin * S0 && (!pick || gain > pick.gain)) pick = { index: i, gain };
  });
  return pick;
}

// b: 둘 차례의 대국(status 'play'), per[i]: 손 i를 혼자 둔 최선 점수(둘 곳이 없으면 null), best: 지금 손의 최선 수.
// opts.need: 목표까지 남은 점수(없으면 Infinity) · preferMate: 풀이기에 넘길 메이트 선호(true면 메이트를 이긴 것으로 친다) · nodes.
// 돌려주는 값: 바칠 손 칸 { index, gain } 또는 null. 같은 대국이면 늘 같은 답(무작위 없음).
export function sacrificeChoice(b, per, best, opts = {}) {
  if (!best || !(b.discardsLeft > 0) || !b.bag.length) return null;
  const need = opts.need ?? Infinity;
  const u = (x) => Math.min(x, need);
  const S0 = u(best.score);
  if (S0 >= need || best.captures > (opts.weakChain ?? SAC.weakChain)) return null;
  const draws = bagDraws(b, opts);
  const ctx = { u, S0, S1: S0, need, mateWins: opts.preferMate === true && need !== Infinity, futureCost: 0 };
  // 먼저 희생이 지금 최선 기물을 바꾸지 않는다고 보고 고른다. 바칠 기물이 나오면 그때 희생 한 번이 지금 최선 기물의 사슬을
  // 얼마나 바꾸는지 잰다(격언 「뽑은 대로」면 배수 +4가 빠진다). 바뀌면 남은 사슬도 그 비율로 바뀐다고 보고 다시 고른다
  const pick = chooseSacrifice(b, per, best, draws, ctx);
  if (!pick) return null;
  const t1 = { ...b, discardsLeft: b.discardsLeft - 1, discardsUsed: (b.discardsUsed || 0) + 1, discarded: (b.discarded || 0) + 1 };
  const r1 = bestMove(t1, { handIndices: [best.handIndex], preferMate: opts.preferMate, maxNodes: opts.nodes ?? SAC.nodes });
  const raw1 = r1 ? r1.score : 0;
  if (raw1 === best.score) return pick;
  const rho = best.score > 0 ? Math.min(1, raw1 / best.score) : 1;
  return chooseSacrifice(b, per, best, draws, { ...ctx, S1: u(raw1), futureCost: (b.movesLeft - 1) * S0 * (1 - rho) });
}

// 하네스 진단(CHM-51): 희생마다 { why: 'stuck'|'weak'|…, before: 바치기 전 최선 사슬 점수, after: 바친 뒤 둔 첫 사슬 점수 }.
// 대국 상태에는 아무것도 적지 않는다(WeakMap). playRun이 판마다 비운다.
export const SACLOG = { rows: [], pending: new WeakMap(), reset() { this.rows = []; this.pending = new WeakMap(); } };

// ── 내다보기(BOT.look > 0). 대국 상태는 JSON 왕복 안전하니 복사본에서 두어 본다(복사 · 결정 두기는 복기 src/sim/replay.js와 함께 쓴다).
const cloneB = cloneBattle;
const seedOf = (r) => Math.floor(next(r) * 2 ** 31);
function candidates(b, base, opts) {
  const nomate = !!opts.nomate;
  const per = bestPerPiece(b, { preferMate: nomate ? 'avoid' : true, rank: opts.rank || null, ...(BOT.nodes ? { maxNodes: BOT.nodes } : {}) });
  const out = [base];
  const seen = new Set();
  per.forEach((m) => { if (!m) return; const k = pieceKey(b.hand[m.handIndex]); if (seen.has(k)) return; seen.add(k); out.push({ play: m }); });
  if (b.discardsLeft > 0 && b.bag.length > 0) {
    const ds = new Set();
    b.hand.forEach((p, i) => { const k = pieceKey(p); if (ds.has(k)) return; ds.add(k); out.push({ discard: [i] }); });
  }
  if (b.target != null && canReboard(b)) out.push({ reboard: true });
  const key = (d) => (d.reboard ? 'R' : d.discard ? 'D' + pieceKey(b.hand[d.discard[0]]) : 'P' + d.play.handIndex + ':' + d.play.sq + ':' + JSON.stringify(d.play.line));
  const uniq = new Map();
  for (const d of out) if (!uniq.has(key(d))) uniq.set(key(d), d);
  return [...uniq.values()];
}
// 모르는 것만 새로 섞는다: 주머니 차례(보이는 맨 앞 둘은 그대로 — CHM-60 「다음 수」) · 증원 · 다시 놓을 판(대국 시드에서 나온다) · 확률 · 유리
function determinize(t, s) {
  const r = createRng(s);
  const rest = t.bag.slice(NEXT_DRAWS);
  shuffle(r, rest);
  t.bag = [...nextDraws(t), ...rest];
  t.rng = { ...t.rng, bag: fork(r, 'bag'), reinf: fork(r, 'reinf'), luck: fork(r, 'luck'), glass: fork(r, 'glass') };
  t.seed = seedOf(r);
}
function lookDecide(b, opts) {
  const base = decideBattle(b, opts);
  if (!base || b.target == null) return base;
  if (base.play && ((base.play.mate && !opts.nomate) || b.score + base.play.score >= b.target)) return base;
  const cands = candidates(b, base, opts);
  if (cands.length < 2) return base;
  const r = fork(createRng((b.seed ^ (b.movesUsed * 7919) ^ ((b.discardsUsed || 0) * 104729) ^ ((b.reboards || 0) * 31)) >>> 0), 'look');
  const seeds = Array.from({ length: BOT.look }, () => seedOf(r));
  let best = null;
  {
    cands.forEach((d, ci) => {
      let wins = 0, score = 0;
      for (const s of seeds) {
        const t = cloneB(b);
        determinize(t, s);
        try { applyDecision(t, d); } catch { wins = -1; break; }
        let guard = 0;
        // 굴림은 하네스 희생 기록(SACLOG)에 남기지 않는다
        while (t.status === 'play' && guard++ < 200) { const d2 = decideBattle(t, opts); if (!d2) break; applyDecision(t, d2); }
        if (t.status === 'won') wins++;
        score += Math.min(t.score, 2 * b.target);
      }
      if (wins < 0) return;
      const v = { d, wins, score, ci };
      // 이긴 몫 → 평균 점수 → 원래 봇의 결정(ci 0) 순
      if (!best || v.wins > best.wins || (v.wins === best.wins && v.score > best.score)) best = v;
    });
  }
  return best ? best.d : base;
}

// 결정 하나를 명령으로 적용. 끝났거나 둘 게 없으면 false.
export function stepBattle(b, apply, opts) {
  const d = BOT.look > 0 && b.status === 'play' ? lookDecide(b, opts || {}) : decideBattle(b, opts);
  if (!d) return false;
  if (d.reboard) { apply({ type: 'reboard' }); return true; }
  if (d.discard) {
    if (!SACLOG.pending.has(b)) SACLOG.pending.set(b, { why: d.why || 'stuck', before: d.before ?? 0, n: 0 });
    SACLOG.pending.get(b).n++;
    apply({ type: 'discard', handIndices: d.discard });
    return true;
  }
  apply({ type: 'drop', handIndex: d.play.handIndex, sq: d.play.sq });
  for (const c of lineCommands(d.play.line)) apply(c);
  const pend = SACLOG.pending.get(b);
  if (pend) {
    SACLOG.pending.delete(b);
    const h = b.history && b.history.at(-1);
    SACLOG.rows.push({ ...pend, after: h ? h.score : 0, mate: !!(h && h.reason === 'mate') });
  }
  return true;
}
