// 정석(깊이 E): 1관 · 3관 · 5관의 첫 대국 전에 셋 중 하나를 고른다(건너뛸 수 없다). 판 끝까지 간다. 격언 칸을 쓰지 않는다.
// 등급: silver 은 · gold 금 · rainbow 무지개(관이 오를수록 높은 등급이 섞인다). 가족 1~2개 → 첫 정석이 판의 가족 방향.
// 필드: id · name · tier · families · text
//   pick(run, events)    고르는 순간 판(런)을 바꾼다(주머니 기물을 이형으로 · …)
//   조정자 훅           대국 안에서(defineModifier('joseki:<id>', { kind: 'joseki', … }))
//   rules(battle, rng)  대국 규칙을 더한다(판 위 사물: 문 · 발판, 고속도로 줄) — 판을 짓기 전에
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';
import { createRng, fork, next } from '../sim/rng.js';

export const DRAFT_ANTES = [1, 3, 5];
export const DRAFT_TIERS = { 1: [['silver', 70], ['gold', 27], ['rainbow', 3]], 3: [['silver', 40], ['gold', 48], ['rainbow', 12]], 5: [['silver', 20], ['gold', 55], ['rainbow', 25]] };
export const TIER_COL = { silver: '#d8dee6', gold: '#efbd55', rainbow: '#9fe0a0' };

export const JOSEKIS = [];
function joseki(id, name, tier, families, text, def = {}) {
  const { pick = null, rules = null, targetMult = null, ...hooks } = def;
  JOSEKIS.push({ id, name, tier, families, text, pick, rules, targetMult });
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
joseki('archery', '활터', 'silver', ['hunt'], '폰 둘이 궁수가 된다', {
  pick(run, events) { evolve(run, 'P', 'S', 2, events); },
});
joseki('highway', '고속도로', 'silver', ['line'], 'b · g 줄에선 어느 모습이든 세로로 미끄러져 먹는다', {
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
joseki('gates', '판의 문', 'gold', ['leap', 'change'], '문 위 적을 먹으면 다른 문에서 이어 간다 · 대국마다 문 둘', {
  rules(b, rng) {
    const free = [];
    for (let sq = 16; sq < 64; sq++) free.push(sq);
    const a = pick3(rng, free.filter((s) => (s & 7) <= 3), 1)[0];
    const c = pick3(rng, free.filter((s) => (s & 7) >= 4 && Math.abs((s >> 3) - (a >> 3)) >= 2), 1)[0];
    b.rules.gates = [a, c];
  },
});
joseki('martyr_vow', '순교의 맹세', 'gold', ['sacrifice'], '끊기는 순간 킹을 뺀 둘레의 적을 모두 먹는다', {
  onCut(ctx) {
    const sq = ctx.event.sq, board = ctx.t.board;
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      const f = (sq & 7) + df, r = (sq >> 3) + dr;
      if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
      const s = r * 8 + f, c = board[s];
      if (!c || c.mine || c.t === 'K') continue;
      board[s] = null;
      ctx.emit({ type: 'pierce', sq: s, piece: c.t, gold: !!c.gold });
      ctx.addValue(PIECES[c.t].value);
      ctx.addMult(1);
    }
  },
});
joseki('pact', '결사', 'gold', ['sacrifice'], '대국 첫 수: 배수 ×3 · 주머니가 여섯을 넘으면 그 기물은 떠난다', {
  onChainEnd(ctx) { if (!(ctx.t.movesUsed ?? 0)) { ctx.mulMult(3); ctx.chain.pact = true; } },
});

// ── 무지개: 판의 조건을 바꾼다
joseki('highlander', '하이랜더', 'rainbow', ['hunt'], '주머니 기물이 모두 다른 종류: 목표 절반', {
  targetMult(run) { const seen = new Set(); for (const p of run.deck) { if (seen.has(p.t)) return 1; seen.add(p.t); } return 0.5; },
});
joseki('throne', '왕좌', 'rainbow', ['crown', 'march'], '폰으로 시작한 사슬이 승급하면 그 폰은 퀸으로 남는다', {
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

export const JOSEKI_BY_ID = Object.fromEntries(JOSEKIS.map((j) => [j.id, j]));
export const josekiFamilies = (ids) => (ids || []).flatMap((id) => (JOSEKI_BY_ID[id] ? [JOSEKI_BY_ID[id].families] : []));
export { collinear5 };
