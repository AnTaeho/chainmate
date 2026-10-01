// 정석(깊이 E): 1관 · 3관 · 5관의 첫 대국 전에 셋 중 하나를 고른다(건너뛸 수 없다). 판 끝까지 간다. 격언 칸을 쓰지 않는다.
// 등급: silver 은 · gold 금 · rainbow 무지개(관이 오를수록 높은 등급이 섞인다). 가족 1~2개 → 첫 정석이 판의 가족 방향.
// 필드: id · name · tier · families · text
//   pick(run, events)    고르는 순간 판(런)을 바꾼다(주머니 기물을 이형으로 · …)
//   조정자 훅           대국 안에서(defineModifier('joseki:<id>', { kind: 'joseki', … }))
//   rules(battle, rng)  대국 규칙을 더한다(판 위 사물: 문 · 발판, 고속도로 줄) — 판을 짓기 전에
import { defineModifier } from '../sim/scoring.js';
import { martyrBurst, MARTYR_TEXT, MARTYR_MORE } from './souls.js';
import { PIECES } from './pieces.js';
import { createRng, fork, next } from '../sim/rng.js';

export const DRAFT_ANTES = [1, 3, 5];
export const DRAFT_TIERS = { 1: [['silver', 70], ['gold', 27], ['rainbow', 3]], 3: [['silver', 40], ['gold', 48], ['rainbow', 12]], 5: [['silver', 20], ['gold', 55], ['rainbow', 25]] };
export const TIER_COL = { silver: '#d8dee6', gold: '#efbd55', rainbow: '#9fe0a0' };

export const JOSEKIS = [];
function joseki(id, name, tier, families, text, def = {}) {
  const { pick = null, rules = null, targetMult = null, more = null, ...hooks } = def;
  JOSEKIS.push({ id, name, tier, families, text, pick, rules, targetMult, more });
  // 판 위 사물 · 규칙은 대국 시작(판을 짓기 전)에 대국 시드에서 갈라 낸 흐름으로 정한다
  if (rules) hooks.onBattleStart = (ctx) => { const r = fork(createRng((ctx.t.seed ?? 1) >>> 0), `joseki:${id}`); rules(ctx.t, () => next(r)); };
  defineModifier(`joseki:${id}`, { kind: 'joseki', ...hooks });
}

// 주머니 기물을 바꾼다: from 종류 n개를 to로(없으면 to 하나를 더한다)
function evolve(run, from, to, n, events) {
  const list = run.deck.filter((p) => p.t === from).slice(0, n);
  if (!list.length) {
    const p = { id: run.nextPieceId++, t: to, eng: null, edition: null };
    run.deck.push(p);
    events.push({ type: 'piece', piece: to, pieceId: p.id });
    return;
  }
  for (const p of list) { events.push({ type: 'evolve', pieceId: p.id, from: p.t, to }); p.t = to; }
}
const collinear5 = (squares) => {
  const set = [...new Set(squares)];
  if (set.length < 5) return false;
  const key = { r: (s) => s >> 3, f: (s) => s & 7, d: (s) => (s >> 3) - (s & 7), a: (s) => (s >> 3) + (s & 7) };
  for (const k of Object.values(key)) {
    const cnt = {};
    for (const s of set) { const v = k(s); cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] >= 5) return true; }
  }
  return false;
};
const pick3 = (rng, free, n) => { const out = []; while (out.length < n && free.length) out.push(free.splice(Math.floor(rng() * free.length), 1)[0]); return out; };

// ── 은: 기물 하나를 바꾸거나 판에 작은 규칙
joseki('knight_oath', '기사 서약', 'silver', ['leap'], '나이트 둘이 야간기사가 된다', {
  pick(run, events) { evolve(run, 'N', 'H', 2, events); },
});
joseki('rampart', '성벽 쌓기', 'silver', ['line', 'leap'], '룩 하나가 재상이 된다', {
  pick(run, events) { evolve(run, 'R', 'C', 1, events); },
});
joseki('mitre', '주교관', 'silver', ['diag', 'leap'], '비숍 하나가 대주교가 된다', {
  pick(run, events) { evolve(run, 'B', 'A', 1, events); },
});
joseki('archery', '활터', 'silver', ['hunt', 'march'], '폰 둘이 궁수가 된다', {
  pick(run, events) { evolve(run, 'P', 'S', 2, events); },
});
joseki('highway', '고속도로', 'silver', ['line'], 'b · g 세로줄: 어느 모습이든 세로로 미끄러져 먹는다', {
  rules(b) { b.rules.highways = [1, 6]; },
});
joseki('stepping', '발판', 'silver', ['hunt'], '대국마다 금빛 칸 셋 · 그 위 적을 먹으면 배수 ×2', {
  rules(b, rng) {
    const free = [];
    for (let sq = 16; sq < 56; sq++) free.push(sq);
    b.rules.steps = pick3(rng, free, 3);
  },
  onCapture(ctx) { const st = ctx.t.rules && ctx.t.rules.steps; if (st && st.includes(ctx.event.to)) ctx.mulMult(2); },
});

// ── 금: 뿌리의 동사를 크게 비튼다
// 버린 안: 흡수의 비전(대국마다 첫 사슬은 행마가 더해진다) — 센 떨군 모습이 판을 쓸어, 하네스 30판의 첫 수 외통(3관부터 20~50%)이
//   모두 이 정석에서 나왔다. 처음 세 먹기로 줄여도 같았다. 한 기물에 붙는 혼 「흡수」만 남긴다.
joseki('gates', '판의 문', 'gold', ['leap', 'change'], '대국마다 문 둘 · 문 위 적을 먹으면 다른 문으로 건너가 잇는다', {
  rules(b, rng) {
    const free = [];
    for (let sq = 16; sq < 64; sq++) free.push(sq);
    const a = pick3(rng, free.filter((s) => (s & 7) <= 3), 1)[0];
    const c = pick3(rng, free.filter((s) => (s & 7) >= 4 && Math.abs((s >> 3) - (a >> 3)) >= 2), 1)[0];
    b.rules.gates = [a, c];
  },
});
joseki('martyr_vow', '순교의 맹세', 'gold', ['sacrifice'], MARTYR_TEXT, {
  more: MARTYR_MORE,
  onCut(ctx) { martyrBurst(ctx); },
});
joseki('pact', '결사', 'gold', ['sacrifice'], '대국 첫 사슬: 배수 ×3 · 시작한 기물은 주머니에서 떠난다', {
  more: '주머니가 여섯 이하면 떠나지 않는다',
  onChainEnd(ctx) { if (!(ctx.t.movesUsed ?? 0)) { ctx.mulMult(3); ctx.chain.pact = true; } },
});

// ── 무지개: 판의 조건을 바꾼다
joseki('highlander', '하이랜더', 'rainbow', ['hunt'], '주머니 기물이 모두 다른 종류: 목표 절반', {
  targetMult(run) { const seen = new Set(); for (const p of run.deck) { if (seen.has(p.t)) return 1; seen.add(p.t); } return 0.5; },
});
joseki('throne', '왕좌', 'rainbow', ['crown', 'march'], '폰으로 시작해 프로모션하면: 주머니의 그 폰이 퀸이 된다', {
  onPromote(ctx) { if (ctx.chain.dropType === 'P') ctx.chain.throne = true; },
});
joseki('gomoku', '오목', 'rainbow', ['line', 'diag'], '한 사슬이 한 줄에 다섯 칸을 밟으면 곧바로 이긴다', {
  onCapture(ctx) {
    const c = ctx.chain;
    const sqs = [c.dropSq, ...c.captures.filter((x) => !x.stay).map((x) => x.to)];
    if (!c.flags.gomoku && collinear5(sqs)) { c.flags.gomoku = true; ctx.emit({ type: 'gomoku', squares: sqs }); }
  },
});
joseki('clone', '복제', 'rainbow', [], '가장 많이 모은 시너지는 1 · 3 · 5개에서 켜진다');


// ── 밤샘 2: 열하나 더(docs/design-notes/content-expansion.md)
const foeAt = (c) => c && !c.mine && c.t !== 'K' && c.t !== 'X' && c.t !== 'J';
// 값이 큰 적 차례(같으면 칸 번호)
const heavyFirst = (board) => board.map((c, sq) => (foeAt(c) ? sq : -1)).filter((sq) => sq >= 0).sort((x, y) => PIECES[board[y].t].value - PIECES[board[x].t].value || x - y);
joseki('desert', '사막', 'silver', ['leap'], '나이트 둘이 낙타가 된다', {
  pick(run, events) { evolve(run, 'N', 'L', 2, events); },
});
joseki('meadow', '풀밭', 'silver', ['march'], '폰 둘이 메뚜기가 된다', {
  pick(run, events) { evolve(run, 'P', 'G', 2, events); },
});
joseki('battery', '포대', 'silver', ['line'], '룩 하나가 포가 된다', {
  pick(run, events) { evolve(run, 'R', 'O', 1, events); },
});
joseki('gloom', '그늘', 'silver', ['diag'], '비숍 하나가 유령이 된다', {
  pick(run, events) { evolve(run, 'B', 'W', 1, events); },
});
joseki('river', '강', 'silver', ['line'], '가운데 두 줄을 건너 먹을 때마다 배수 +1', {
  more: '넷째 줄과 다섯째 줄 사이가 강',
  rules(b) { b.rules.river = true; },
  onCapture(ctx) { const a = ctx.event.from >> 3, b = ctx.event.to >> 3; if ((a <= 3 && b >= 4) || (a >= 4 && b <= 3)) ctx.addMult(1); },
});
joseki('torch', '횃불', 'gold', ['counter'], '대국마다 값이 가장 큰 적 둘은 아무것도 지키지 못한다', {
  onSetup(ctx) { const b = ctx.t.board; for (const sq of heavyFirst(b).slice(0, 2)) b[sq] = { ...b[sq], muted: true }; },
});
joseki('trap', '함정', 'gold', ['ambush'], '대국마다 빈칸 둘이 함정 · 증원이 들면 먹은 것으로 친다', {
  more: '붙잡은 증원의 값이 곧바로 점수가 된다',
  onSetup(ctx) {
    const b = ctx.t.board, free = [];
    for (let sq = 24; sq < 64; sq++) if (!b[sq]) free.push(sq);
    const traps = [];
    while (traps.length < 2 && free.length) traps.push(free.splice(Math.floor(ctx.rng() * free.length), 1)[0]);
    ctx.t.rules = { ...ctx.t.rules, traps };
  },
  onArrive(ctx) { const tr = ctx.t.rules && ctx.t.rules.traps; if (tr && tr.includes(ctx.event.sq)) ctx.event.caught = true; },
});
joseki('blitz', '속기', 'gold', ['change'], '수 +1 · 손 −1', {
  onBattleStart(ctx) { ctx.rules.moves = (ctx.rules.moves ?? 4) + 1; ctx.rules.hand = Math.max(2, (ctx.rules.hand ?? 4) - 1); },
});
joseki('long_think', '장고', 'gold', ['hunt'], '수 −1 · 손 +2 · 버리기 +1', {
  onBattleStart(ctx) { ctx.rules.moves = Math.max(1, (ctx.rules.moves ?? 4) - 1); ctx.rules.hand = (ctx.rules.hand ?? 4) + 2; ctx.rules.discards = (ctx.rules.discards ?? 3) + 1; },
});
joseki('first_mover', '선수', 'rainbow', ['crown'], '대국 시작에 값이 가장 큰 적 하나가 판에서 빠진다', {
  onSetup(ctx) { const b = ctx.t.board; const sq = heavyFirst(b)[0]; if (sq != null) { b[sq] = null; ctx.emit({ type: 'firstMover', sq }); } },
});
joseki('captive', '포로', 'rainbow', ['change'], '대국 첫 사슬이 마지막에 먹은 적이 주머니에 들어온다', {
  more: '주머니 열넷까지',
  onChainEnd(ctx) {
    const c = ctx.chain, last = c.captures.at(-1);
    if ((ctx.t.movesUsed ?? 0) || !last || last.piece === 'K' || (PIECES[last.piece] && PIECES[last.piece].thing)) return;
    (c.traitors || (c.traitors = [])).push(last.piece);
    ctx.emit({ type: 'captive', piece: last.piece });
  },
});

export const JOSEKI_BY_ID = Object.fromEntries(JOSEKIS.map((j) => [j.id, j]));
export const josekiFamilies = (ids) => (ids || []).flatMap((id) => (JOSEKI_BY_ID[id] ? [JOSEKI_BY_ID[id].families] : []));
export { collinear5 };
