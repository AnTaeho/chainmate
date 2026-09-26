// 지금 손으로 둘 수 있는 최선의 한 수를 끝까지 찾는다.
// 손 기물 × 떨굴 칸 × 먹기 선택의 깊이 우선 탐색. 점수 파이프라인(조정자 포함)을 그대로 돌린다.
import { startChain, chainCaptures, chainCapture } from './chain.js';
import { dropSquaresFor } from './battle.js';
import { forkSpec, forkSpecs } from './scoring.js';


function cloneTable(t) {
  const c = t.chain;
  return {
    ...t,
    board: t.board.slice(),
    mods: forkSpecs(t.mods),
    chain: c && {
      ...c,
      captures: c.captures.slice(), forms: c.forms.slice(), flags: { ...c.flags },
      forced: c.forced && c.forced.slice(),
      engraving: forkSpec(c.engraving),
    },
  };
}

// 결과 비교: 외통 우선(opts.preferMate), 그다음 점수, 그다음 짧은 줄.
// preferMate: true = 외통 우선, false = 점수만, 'avoid' = 외통 줄은 다른 수가 없을 때만.
function better(a, b, preferMate) {
  if (!b) return true;
  if (preferMate && a.mate !== b.mate) return preferMate === 'avoid' ? b.mate : a.mate;
  if (a.score !== b.score) return a.score > b.score;
  return a.line.length < b.line.length;
}

function dfs(t, stats, preferMate) {
  stats.nodes++;
  const c = t.chain;
  if (c.done) {
    return { score: c.score, value: c.value, mult: c.mult, reason: c.reason, mate: c.reason === 'mate', line: [], captures: c.captures.length, forced: c.forcedReplies };
  }
  let best = null;
  for (const sq of chainCaptures(t)) {
    const u = cloneTable(t);
    chainCapture(u, sq);
    const r = dfs(u, stats, preferMate);
    r.line = [sq, ...r.line];
    if (better(r, best, preferMate)) best = r;
  }
  return best;
}

// 대국 b(status 'play')의 최선 수. { handIndex, sq, line:[capture sq…], score, value, mult, reason, mate, captures }
// opts.handIndices: 이 손 칸들만 본다. opts.preferMate: true(기본) | false | 'avoid'.
export function bestMove(b, opts = {}) {
  const preferMate = opts.preferMate ?? true;
  const stats = { nodes: 0 };
  let best = null;
  const seen = new Set();
  const indices = opts.handIndices ?? b.hand.map((_, i) => i);
  for (const handIndex of indices) {
    const piece = b.hand[handIndex];
    const key = piece.t + JSON.stringify(piece.eng);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const sq of dropSquaresFor(b, piece)) {
      const t = cloneTable({ ...b, chain: null });
      // 각인 명세는 복사해서 쓴다(탐색 중 조정자 state가 실제 손 기물에 새지 않게)
      startChain(t, { type: piece.t, sq, engraving: forkSpec(piece.eng) });
      const r = dfs(t, stats, preferMate);
      if (!r) continue;
      if (better(r, best, preferMate)) best = { ...r, handIndex, sq };
    }
  }
  if (best) best.nodes = stats.nodes;
  return best;
}

// 손 기물마다 최선 수(무르기 판단용).
export function bestPerPiece(b, opts = {}) {
  return b.hand.map((_, i) => bestMove(b, { ...opts, handIndices: [i] }));
}
