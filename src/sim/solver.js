// 지금 손으로 둘 수 있는 최선의 한 수를 끝까지 찾는다.
// 손 기물 × 떨굴 칸 × 먹기 선택의 깊이 우선 탐색. 점수 파이프라인(조정자 포함)을 그대로 돌린다.
import { startChain, chainCaptures, chainCapture, chainRedrops, chainRedrop, chainSummary } from './chain.js';
import { dropSquaresFor } from './battle.js';
import { forkSpec, forkSpecs } from './scoring.js';
import { pieceSoul } from '../data/souls.js';


function cloneTable(t) {
  const c = t.chain;
  return {
    ...t,
    board: t.board.slice(),
    mods: forkSpecs(t.mods),
    chain: c && {
      ...c,
      captures: c.captures.slice(), forms: c.forms.slice(), flags: { ...c.flags },
      forced: c.forced && c.forced.slice(), absorbed: c.absorbed && c.absorbed.slice(), traitors: c.traitors && c.traitors.slice(),
      engraving: forkSpec(c.engraving), soul: forkSpec(c.soul),
    },
  };
}

// 결과 비교: 외통 우선(opts.preferMate), 그다음 점수(opts.rank가 있으면 그 값), 그다음 짧은 줄.
// preferMate: true = 외통 우선, false = 점수만, 'avoid' = 외통 줄은 다른 수가 없을 때만.
// rank(r): 줄 결과(r.h = chainSummary 꼴 요약)를 받아 비교할 수를 돌려준다(봇이 금빛 적 · 재현을 노릴 때).
function better(a, b, preferMate, rank) {
  if (!b) return true;
  if (preferMate && a.mate !== b.mate) return preferMate === 'avoid' ? b.mate : a.mate;
  const ka = rank ? rank(a) : a.score, kb = rank ? rank(b) : b.score;
  if (ka !== kb) return ka > kb;
  return a.line.length < b.line.length;
}

// 줄(line)의 원소: 수(먹을 칸) 또는 { type: 'redrop', sq }. 명령으로 바꾸려면 lineCommands.
export const lineCommands = (line) => line.map((x) => (typeof x === 'number' ? { type: 'capture', sq: x } : x));

// 탐색 예산: bestMove 한 번에 이만큼 마디를 넘으면 그 뒤로는 가지마다 첫 수만 따라 줄을 끝까지 채운다(결정적, 늘 둘 수 있는 온전한 줄).
// 보통 한 수는 마디 100~200, 전설 「상록」 수천. 「오페라」(지켜진 킹도 먹고 판을 세 번 다시 채움)에 각인 「깃」이 겹치면
// 수백만까지 불어나 판 봇의 상점 한 번이 몇 분씩 걸렸다.
export const NODE_BUDGET = 10000;

function dfs(t, stats, preferMate, rank) {
  stats.nodes++;
  const greedy = stats.nodes > stats.max;
  const c = t.chain;
  if (c.done) {
    return { score: c.score, value: c.value, mult: c.mult, reason: c.reason, mate: c.reason === 'mate', line: [], captures: c.captures.length, forced: c.forcedReplies, h: chainSummary(c, t.movesUsed ?? 0) };
  }
  let best = null;
  if (c.awaiting) {
    for (const sq of chainRedrops(t)) {
      if (greedy && best) break;
      const u = cloneTable(t);
      chainRedrop(u, sq);
      const r = dfs(u, stats, preferMate, rank);
      r.line = [{ type: 'redrop', sq }, ...r.line];
      if (better(r, best, preferMate, rank)) best = r;
    }
    return best;
  }
  for (const sq of chainCaptures(t)) {
    if (greedy && best) break;
    const u = cloneTable(t);
    chainCapture(u, sq);
    const r = dfs(u, stats, preferMate, rank);
    r.line = [sq, ...r.line];
    if (better(r, best, preferMate, rank)) best = r;
  }
  return best;
}

// 대국 b(status 'play')의 최선 수. { handIndex, sq, line:[capture sq…], score, value, mult, reason, mate, captures }
// opts.handIndices: 이 손 칸들만 본다. opts.preferMate: true(기본) | false | 'avoid'. opts.rank: 위 better 참고.
export function bestMove(b, opts = {}) {
  const preferMate = opts.preferMate ?? true;
  const rank = opts.rank || null;
  const stats = { nodes: 0, max: opts.maxNodes ?? NODE_BUDGET };
  let best = null;
  const seen = new Set();
  const indices = opts.handIndices ?? b.hand.map((_, i) => i);
  for (const handIndex of indices) {
    const piece = b.hand[handIndex];
    const key = piece.t + JSON.stringify(piece.eng) + (piece.soul || '') + (piece.awake ? '!' : '');
    if (seen.has(key)) continue;
    seen.add(key);
    // 떨군 기물은 손에서 빠진다(실제 대국과 같게 — 손을 보는 조정자 「막내」 · 「맏이」 · 혼 「계주」)
    const rest = b.hand.filter((_, i) => i !== handIndex);
    for (const sq of dropSquaresFor(b, piece)) {
      const t = cloneTable({ ...b, hand: rest, chain: null });
      // 각인 명세는 복사해서 쓴다(탐색 중 조정자 state가 실제 손 기물에 새지 않게)
      startChain(t, { type: piece.t, sq, engraving: forkSpec(piece.eng), soul: pieceSoul(piece) });
      const r = dfs(t, stats, preferMate, rank);
      if (!r) continue;
      // opts.collect: 떨구기마다 그 자리의 최선(재미 하네스가 「의미 있는 선택지」를 센다)
      if (opts.collect) opts.collect.push({ handIndex, t: piece.t, sq, score: r.score, first: r.line[0] ?? null });
      if (better(r, best, preferMate, rank)) best = { ...r, handIndex, sq };
    }
  }
  if (best) best.nodes = stats.nodes;
  return best;
}

// 손 기물마다 최선 수(희생 판단용).
export function bestPerPiece(b, opts = {}) {
  return b.hand.map((_, i) => bestMove(b, { ...opts, handIndices: [i] }));
}

// ── 화면용 미리 보기(규칙 그대로, 복사본에서 — 원래 대국은 바뀌지 않는다)
// 지금 사슬에서 sq를 먹으면: 바뀐 모습 · 얻는 값 · 배수(조정자 반응까지) · 다음에 먹을 수 있는 적 · 응수 · 끊김 · 외통.
export function previewCapture(t, sq) {
  const u = cloneTable(t);
  const c0 = u.chain;
  const value0 = c0.value, mult0 = c0.mult;
  const events = chainCapture(u, sq);
  const c = u.chain;
  const cut = events.find((e) => e.type === 'cut');
  const forced = events.find((e) => e.type === 'forced');
  return {
    sq, form: c.form, value: c.value - value0, mult: c.mult - mult0,
    done: c.done, reason: c.reason, score: c.done ? c.score : null,
    next: c.done || c.awaiting ? [] : chainCaptures(u),
    forced: forced ? forced.attackers.slice() : null,
    cut: cut ? cut.attackers.slice() : null,
    mate: events.some((e) => e.type === 'mate'),
    redrop: !!c.awaiting,
  };
}

// 손 기물 handIndex를 sq에 떨구면 처음 먹을 수 있는 적
export function previewDrop(b, handIndex, sq) {
  const piece = b.hand[handIndex];
  const t = cloneTable({ ...b, hand: b.hand.filter((_, i) => i !== handIndex), chain: null });
  startChain(t, { type: piece.t, sq, engraving: forkSpec(piece.eng), soul: pieceSoul(piece) });
  // value · mult: 떨군 순간 사슬에 든 몫(onDrop 반응) · offering: 기다리는 희생(이 수가 체크메이트면 탁월수)
  return { sq, form: piece.t, value: t.chain.done ? 0 : t.chain.value, mult: t.chain.done ? 0 : t.chain.mult, offering: b.offering ? { ...b.offering } : null, next: t.chain.done ? [] : chainCaptures(t) };
}
