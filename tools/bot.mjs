// 대국 봇(하네스 공용). 매 결정마다 풀이기(solver.js)로 손 기물별 최선 수를 찾는다.
//   외통이 보이면 바로 둔다(nomate면 피한다).
//   무르기가 남았고 최선 수의 사슬이 2 이하로 약하면, 혼자서 1 이하밖에 못 잇는 손 기물(최선 수를 낸 기물 제외)을 버린다
//   (주머니가 남은 수 이상 남았을 때만).
//   떨굴 수가 아예 없으면 무르기가 남은 한 손 전체를 버린다.
//   폰 아끼지 않기: 폰은 떨굴 자리가 드물어 끝까지 남기면 막힌다. 남은 폰이 남은 수 − 1 이상이면
//   최선의 절반 이상을 내는 폰 수를 먼저 둔다.
//   목표가 있으면: 목표를 넘기는 수가 여럿이면 그중 아무거나(최선)로 충분하다.
import { bestPerPiece, lineCommands } from '../src/sim/solver.js';

const betterMove = (x, y, nomate, rank) => !y || (x.mate !== y.mate ? (nomate ? y.mate : x.mate) : rank ? rank(x) > rank(y) : x.score > y.score);

// rank: 풀이기에 넘길 줄 평가(판 봇의 「노리기」 정책이 황금 기물 · 재현에 덤을 준다). 없으면 점수.
export function decideBattle(b, { nomate = false, pawnRatio = 0.5, rank = null } = {}) {
  const per = bestPerPiece(b, { preferMate: nomate ? 'avoid' : true, rank });
  let best = null;
  for (const m of per) if (m && betterMove(m, best, nomate, rank)) best = m;
  if (best && best.mate && !nomate) return { play: best };
  const canDiscard = b.discardsLeft > 0 && b.bag.length > 0;
  const roomy = b.bag.length >= b.movesLeft;
  if (!best) return canDiscard ? { discard: b.hand.map((_, i) => i).slice(0, b.rules.maxDiscard) } : null;
  const need = b.target != null ? b.target - b.score : Infinity;
  if (best.score >= need) return { play: best };
  if (canDiscard && roomy && best.captures <= 2) {
    const weak = per.map((m, i) => (i !== best.handIndex && (!m || m.captures <= 1) ? i : -1)).filter((i) => i >= 0);
    if (weak.length) return { discard: weak.slice(0, b.rules.maxDiscard) };
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
  if (d.discard) { apply({ type: 'discard', handIndices: d.discard }); return true; }
  apply({ type: 'drop', handIndex: d.play.handIndex, sq: d.play.sq });
  for (const c of lineCommands(d.play.line)) apply(c);
  return true;
}
