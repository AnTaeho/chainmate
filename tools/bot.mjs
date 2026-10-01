// 대국 봇(하네스 공용). 매 결정마다 풀이기(solver.js)로 손 기물별 최선 수를 찾는다.
//   외통이 보이면 바로 둔다(nomate면 피한다).
//   희생(CHM-35, 명령 id는 discard)은 한 번에 하나. 이번 수로 목표에 못 닿으면 손 기물마다
//   「이 기물을 떨군 최선 사슬 점수」와 「바치고 다음 수에 얻는 몫」(남은 손 + 쌓인 몫으로 다시 푼 최선 − 바치지 않은 남은 손의 최선)을
//   견줘, 몫이 더 큰 기물 중 차이가 가장 큰 것을 바친다. 바친 자리엔 새 기물이 오므로 떨군 점수는 손에서 가장 약한 기물의 점수를
//   뺀 만큼만 잃는 것으로 센다(가장 약한 기물은 잃는 것이 없다 — 손 넷 · 수 넷이라 약한 기물은 끝까지 안 쓰인다).
//   새로 뽑힐 기물(주머니 맨 위)은 보지 않는다 — 사람도 모른다.
//   sacrifice: false(하네스 정책 nosac)면 옛 버리기 봇: 최선 수의 사슬이 2 이하로 약할 때 혼자서 1 이하밖에 못 잇는 기물 하나를 버린다.
//   떨굴 수가 아예 없으면 값이 가장 낮은 기물 하나를 바친다.
//   폰 아끼지 않기: 폰은 떨굴 자리가 드물어 끝까지 남기면 막힌다. 남은 폰이 남은 수 − 1 이상이면
//   최선의 절반 이상을 내는 폰 수를 먼저 둔다.
//   목표가 있으면: 목표를 넘기는 수가 여럿이면 그중 아무거나(최선)로 충분하다.
//   다시 놓기(밤샘 2 D2): 첫 수 전, 첫 손 최선 사슬 점수 × 수가 목표 × REBOARD.ratio에 못 미치면 판을 새로 깐다
//   (첫 손 최선 사슬 점수가 대국 점수의 대리 지표 — docs/reports/luck.md ④).
import { bestPerPiece, lineCommands } from '../src/sim/solver.js';
import { bestMove } from '../src/sim/solver.js';
import { canReboard, addOffering } from '../src/sim/battle.js';
import { valueOf } from '../src/data/pieces.js';

// ratio 1 → 2(밤샘 2 3부): 1이면 대국당 0.08번만 다시 놓아 판을 끝낸 죽음의 판 운 몫이 52.6%, 2면 0.18번 · 31.3%(luck 30판)
export const REBOARD = { ratio: 2 }; // 켜고 끄기는 src/sim/tuning.js BOARD_TUNING.reboard(끄면 canReboard가 늘 거짓)
const betterMove = (x, y, nomate, rank) => !y || (x.mate !== y.mate ? (nomate ? y.mate : x.mate) : rank ? rank(x) > rank(y) : x.score > y.score);

// rank: 풀이기에 넘길 줄 평가(판 봇의 「노리기」 정책이 황금 기물 · 재현에 덤을 준다). 없으면 점수.
// 희생 판단의 풀이기 마디 예산(손 기물마다 한 번 더 푼다)
export const SAC = { nodes: 3000, stats: null }; // stats: 진단용 { asked, picked, notNeeded }

// 손 기물 i를 바치면 다음 수에 얻는 몫. 바친 뒤의 대국(손에서 빠짐 · 몫이 쌓임 · 희생 수 +1)을 풀이기로 다시 푼다.
function sacrificeGain(b, per, i, nomate) {
  const base = Math.max(0, ...per.map((m, j) => (j !== i && m ? m.score : 0)));
  const hyp = {
    ...b, hand: b.hand.filter((_, j) => j !== i), offering: addOffering(b.offering, b.hand[i].t),
    discardsLeft: b.discardsLeft - 1, discardsUsed: b.discardsUsed + 1, discarded: b.discarded + 1,
  };
  const w = bestMove(hyp, { preferMate: nomate ? 'avoid' : true, maxNodes: SAC.nodes });
  return w ? w.score - base : -Infinity;
}

export function decideBattle(b, { nomate = false, pawnRatio = 0.5, rank = null, sacrifice = true } = {}) {
  const per = bestPerPiece(b, { preferMate: nomate ? 'avoid' : true, rank });
  let best = null;
  for (const m of per) if (m && betterMove(m, best, nomate, rank)) best = m;
  if (best && best.mate && !nomate) return { play: best };
  if (b.target != null && canReboard(b) && (!best || best.score * b.movesLeft < (b.target - b.score) * REBOARD.ratio)) return { reboard: true };
  const canDiscard = b.discardsLeft > 0 && b.bag.length > 0;
  const roomy = b.bag.length >= b.movesLeft;
  if (!best) {
    if (!canDiscard) return null;
    let low = 0;
    b.hand.forEach((p, i) => { if (valueOf(p.t) < valueOf(b.hand[low].t)) low = i; });
    return { discard: [low] };
  }
  const need = b.target != null ? b.target - b.score : Infinity;
  if (SAC.stats && canDiscard) SAC.stats[best.score >= need ? 'notNeeded' : 'asked']++;
  if (best.score >= need) return { play: best };
  if (sacrifice && canDiscard && b.hand.length - 1 + b.bag.length >= b.movesLeft) {
    let pick = -1, edge = 0;
    const tried = new Map();
    const floor = Math.min(...per.map((m) => (m ? m.score : 0)));
    b.hand.forEach((p, i) => {
      const key = p.t + JSON.stringify(p.eng) + (p.soul || '') + (p.awake ? '!' : '') + ':' + (per[i] ? per[i].score : -1);
      const gain = tried.has(key) ? tried.get(key) : sacrificeGain(b, per, i, nomate);
      tried.set(key, gain);
      const d = gain - Math.max(0, (per[i] ? per[i].score : 0) - floor);
      if (SAC.stats && SAC.stats.log) SAC.stats.log.push({ t: p.t, drop: per[i] ? per[i].score : null, gain, need, movesLeft: b.movesLeft, best: best.score });
      if (d > edge) { edge = d; pick = i; }
    });
    if (SAC.stats) { SAC.stats.edges = SAC.stats.edges || []; SAC.stats.edges.push(Math.round(edge)); }
    if (pick >= 0) { if (SAC.stats) SAC.stats.picked++; return { discard: [pick] }; }
  }
  if (!sacrifice && canDiscard && roomy && best.captures <= 2) {
    const weak = per.map((m, i) => (i !== best.handIndex && (!m || m.captures <= 1) ? i : -1)).filter((i) => i >= 0);
    const worth = (i) => (per[i] ? [1, per[i].captures, per[i].score] : [0, 0, 0]);
    const weaker = (i, j) => { const x = worth(i), y = worth(j); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
    if (weak.length) return { discard: [weak.reduce((a, i) => (weaker(i, a) < 0 ? i : a))] };
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

// 결정 하나를 명령으로 적용. 끝났거나 둘 게 없으면 false.
export function stepBattle(b, apply, opts) {
  const d = decideBattle(b, opts);
  if (!d) return false;
  if (d.reboard) { apply({ type: 'reboard' }); return true; }
  if (d.discard) { apply({ type: 'discard', handIndices: d.discard }); return true; }
  apply({ type: 'drop', handIndex: d.play.handIndex, sq: d.play.sq });
  for (const c of lineCommands(d.play.line)) apply(c);
  return true;
}
