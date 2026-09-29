// 혼(깊이 C): 주머니 기물 하나에 붙는 고유 규칙. 모습이 바뀌어도 그 사슬 내내 따라간다.
// 각인(숫자)과 따로: 한 기물이 각인 하나 + 혼 하나까지. 명세는 기물의 soul = id, 사슬에서는 chain.soul = { id }.
// 버린 안: 쌍둥이(두 사슬을 차례로 — 한 수 연출 4초 안에 들지 않고 풀이기 가지가 제곱) · 방랑자(가로로 이어진 판 — 행마선이
//   화면 끝을 넘어 1배에서 읽히지 않는다) · 전령(증원 그림자 먹기 — 그림자는 판에 없는 기물이라 응수 · 끊김 판정이 모호).
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';
import { isEnemy, reach } from '../sim/board.js';

export const SOULS = [];
function soul(id, name, col, families, text, { more = null, ...def }) {
  SOULS.push({ id, name, col, families, text, more });
  defineModifier(`soul:${id}`, { kind: 'soul', ...def });
}
export const SOUL_PRICE = 4;

// 순교(혼 「순교자」 · 정석 「순교의 맹세」): 끊기는 순간 킹을 뺀 둘레의 적을 모두 먹는다. 벽은 남긴다.
// 99a6436에서 「킹을 지키는 적은 남기고 둘까지」로 줄였다가 되돌렸다(2026-09-28, 사람: 지금도 깨기 힘들고 단이 오르면 더 어렵다).
// 그때 잰 수치(sim --soul martyr 외통 45~64% → 15~42%)는 DESIGN.md 혼 줄에 나중 참고로 남긴다.
export const MARTYR_TEXT = '끊길 때: 킹을 뺀 둘레의 적을 모두 먹는다';
export const MARTYR_MORE = null;

export function martyrBurst(ctx) {
  const sq = ctx.event.sq, board = ctx.t.board;
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = (sq & 7) + df, r = (sq >> 3) + dr;
    if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
    const s = r * 8 + f, c = board[s];
    if (!isEnemy(c) || c.t === 'K' || c.t === 'X') continue;
    board[s] = null;
    ctx.emit({ type: 'pierce', sq: s, piece: c.t, gold: !!c.gold });
    ctx.addValue(PIECES[c.t].value);
    ctx.addMult(1);
  }
}
// 초월: 먹을 때마다 한 단계 위로, 아마존까지. 39a89d3에서 「두 번마다 · 룩까지」로 줄였다가 되돌렸다(2026-09-28, 순교자와 같은 까닭)
export const UP = { P: 'N', N: 'B', B: 'R', R: 'Q', Q: 'Z' };
export const TRANSCEND_TEXT = '먹을 때마다 한 단계 위 기물이 된다';
export const TRANSCEND_MORE = '폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존';
// 흡수: 처음 takes번 먹기까지 모습이 안 바뀌고, 먹은 적의 행마를 얻는다(마지막에 얻은 것 하나만).
// 얻은 행마는 사슬 끝까지 남는다(흡수가 끝난 뒤 모습이 바뀌어도). 39a89d3 · c74068a에서 「다음 먹기까지 · 첫 먹기 한 번」으로
// 줄였다가 되돌렸다(2026-09-28)
export const ABSORB = { takes: 3 };
export const ABSORB_TEXT = '세 번까지: 모습이 안 바뀐다 · 먹은 적의 행마를 얻는다';
export const ABSORB_MORE = '마지막에 얻은 행마는 사슬 끝까지 남는다';

soul('absorb', '흡수', '#d27fd6', ['change'], ABSORB_TEXT, {
  more: ABSORB_MORE,
  onDrop(ctx) { ctx.flags.absorb = true; },
});
soul('echo', '메아리', '#9fb8ff', ['change'], '더 먹을 적이 없으면 한 번, 처음 모습으로 돌아가 잇는다', {
  onBlocked(ctx) {
    const c = ctx.chain;
    if (ctx.flags.echoUsed || c.form === c.dropType) return;
    ctx.flags.echoUsed = true;
    const prev = c.form;
    c.form = c.dropType;
    ctx.t.board[c.sq] = { t: c.form, mine: true };
    ctx.emit({ type: 'transform', from: prev, to: c.form, sq: c.sq, echo: true });
    ctx.keepGoing();
  },
});
soul('transcend', '초월', '#fff1b8', ['change', 'crown'], TRANSCEND_TEXT, {
  more: TRANSCEND_MORE,
  onDrop(ctx) { ctx.flags.transcend = true; },
});
soul('hunger', '굶주림', '#df8a45', ['hunt'], '둘째 먹기 값 +10 · 셋째 +20 · 넷째 +30 …', {
  onCapture(ctx) { ctx.addValue(10 * ctx.event.index); },
});
soul('hunter', '사냥꾼', '#8ec07c', ['hunt'], '같은 종류를 잇달아 먹으면 배수 ×2', {
  onCapture(ctx) {
    const caps = ctx.chain.captures;
    if (caps.length >= 2 && caps[caps.length - 2].piece === ctx.event.piece) ctx.mulMult(2);
  },
});
soul('martyr', '순교자', '#df5a45', ['sacrifice'], MARTYR_TEXT, {
  more: MARTYR_MORE,
  onCut(ctx) { martyrBurst(ctx); },
});
soul('crown', '선봉', '#efbd55', ['crown', 'march'], '폰 모습이면 여섯째 줄에서 아마존으로 프로모션', {
  onDrop(ctx) { ctx.flags.promoteFrom = Math.min(ctx.flags.promoteFrom ?? 7, 5); ctx.flags.promoteTo = 'Z'; },
});
soul('shade', '잠행', '#8a5cc8', ['sacrifice', 'leap'], '지키는 적을 무시한다 · 배수 −1', {
  // 99a6436에서 「사슬마다 한 번 · 배수 그대로」로 줄였다가 되돌렸다(2026-09-28). 지켜진 킹은 여전히 못 먹는다(board.js kingTakeable)
  more: '지켜진 킹은 먹을 수 없다',
  onThreat(ctx) { ctx.ignoreThreat(); },
  onChainEnd(ctx) { if (ctx.chain.mult > 1) ctx.addMult(-1); },
});


// ── 밤샘 2: 여덟 더(docs/design-notes/content-expansion.md)
soul('inherit', '계승', '#f2d6c4', ['change'], '사슬이 끝나면 이 기물이 마지막 모습이 된다', {
  more: '주머니의 기물이 바뀐다 · 킹 모습은 빼고',
  onChainEnd(ctx) { const c = ctx.chain; if (c.form !== c.dropType && c.form !== 'K' && PIECES[c.form] && !PIECES[c.form].thing) c.becomes = c.form; },
});
soul('relay', '계주', '#6fd1bf', ['march'], '더 먹을 적이 없으면 손의 다음 기물이 그 칸에서 이어 먹는다', {
  more: '대국마다 한 번 · 이어 먹은 기물도 쓴 것이 된다',
  onBlocked(ctx) {
    const t = ctx.t, c = ctx.chain;
    if (t.relayUsed || c.relay || !t.hand || !t.hand.length) return;
    const next = t.hand[0];
    t.relayUsed = true;
    c.relay = { id: next.id, t: next.t };
    const prev = c.form;
    c.form = next.t;
    t.board[c.sq] = { t: c.form, mine: true };
    if (!c.forms.includes(c.form)) c.forms.push(c.form);
    ctx.emit({ type: 'transform', from: prev, to: c.form, sq: c.sq, relay: true });
    ctx.keepGoing();
  },
});
soul('retro', '역행', '#c8b48a', ['march'], '폰 모습이면 아래 대각으로도 먹는다', {
  onDrop(ctx) { ctx.flags.pawnBack = true; },
});
soul('duel', '결투', '#e8e070', ['hunt'], '같은 종류를 두 번 못 먹는다 · 배수 ×2', {
  more: '킹은 빼고',
  allowCapture(ctx) { return ctx.event.piece === 'K' || !ctx.chain.captures.some((x) => x.piece === ctx.event.piece); },
  onChainEnd(ctx) { ctx.mulMult(2); },
});
soul('reaper', '사신', '#b070f0', ['counter'], '킹을 지키는 적을 먹을 때마다 배수 +3', {
  onCapture(ctx) {
    const { piece, to } = ctx.event;
    if (piece === 'K') return;
    const board = ctx.t.board;
    if (reach(board, piece, to, -1).some((s) => board[s] && !board[s].mine && board[s].t === 'K')) ctx.addMult(3);
  },
});
soul('spring', '도약', '#7fe0e8', ['leap'], '첫 먹기: 두 칸 안의 적이면 어디든 먹는다', {
  onDrop(ctx) { ctx.flags.spring = true; },
});
soul('homing', '귀환', '#f0a060', ['sacrifice'], '사슬이 끝나면 손으로 돌아온다', {
  more: '대국마다 한 번 · 수는 쓴다',
  onChainEnd(ctx) { ctx.chain.returnHome = true; },
});
soul('ripple', '파문', '#8fb0ff', ['counter'], '먹을 때마다 둘레 적 하나가 이번 수 동안 못 지킨다', {
  more: '값이 가장 큰 적부터',
  onCapture(ctx) {
    const b = ctx.t.board, to = ctx.event.to;
    let best = -1;
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      const f = (to & 7) + df, r = (to >> 3) + dr;
      if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
      const s = r * 8 + f, c = b[s];
      if (!isEnemy(c) || c.t === 'K' || c.t === 'X' || c.t === 'J' || c.frozen) continue;
      if (best < 0 || PIECES[c.t].value > PIECES[b[best].t].value) best = s;
    }
    if (best >= 0) { b[best] = { ...b[best], frozen: true }; ctx.emit({ type: 'freeze', squares: [best] }); }
  },
});

export const SOUL_BY_ID = Object.fromEntries(SOULS.map((s) => [s.id, s]));
export const soulSpec = (id) => (id && SOUL_BY_ID[id] ? { id: `soul:${id}` } : null);
