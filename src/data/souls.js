// 혼(깊이 C): 주머니 기물 하나에 붙는 고유 규칙. 모습이 바뀌어도 그 사슬 내내 따라간다.
// 각인(숫자)과 따로: 한 기물이 각인 하나 + 혼 하나까지. 명세는 기물의 soul = id, 사슬에서는 chain.soul = { id }.
// 버린 안: 쌍둥이(두 사슬을 차례로 — 한 수 연출 4초 안에 들지 않고 풀이기 가지가 제곱) · 방랑자(가로로 이어진 판 — 행마선이
//   화면 끝을 넘어 1배에서 읽히지 않는다) · 전령(증원 그림자 먹기 — 그림자는 판에 없는 기물이라 응수 · 끊김 판정이 모호).
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';

export const SOULS = [];
function soul(id, name, col, families, text, def) {
  SOULS.push({ id, name, col, families, text });
  defineModifier(`soul:${id}`, { kind: 'soul', ...def });
}
export const SOUL_PRICE = 4;
export const UP = { P: 'N', N: 'B', B: 'R', R: 'Q', Q: 'Z' };

soul('absorb', '흡수', '#d27fd6', ['change'], '처음 세 번은 먹어도 모습이 그대로 — 대신 마지막에 먹은 적의 행마도 함께 쓴다', {
  onDrop(ctx) { ctx.flags.absorb = true; },
});
soul('echo', '메아리', '#9fb8ff', ['change'], '사슬이 막히면 한 번 떨군 모습으로 돌아가 그 자리에서 잇는다', {
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
soul('transcend', '초월', '#fff1b8', ['change', 'crown'], '먹을 때마다 먹은 적 대신 한 단계 위 모습이 된다 — 폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존', {
  onDrop(ctx) { ctx.flags.transcend = true; },
});
soul('hunger', '굶주림', '#df8a45', ['hunt'], '먹을수록 값이 더 붙는다 — 둘째 먹기 +10, 셋째 +20, 넷째 +30 …', {
  onCapture(ctx) { ctx.addValue(10 * ctx.event.index); },
});
soul('hunter', '사냥꾼', '#8ec07c', ['hunt'], '같은 종류를 잇달아 먹으면 배수 ×2', {
  onCapture(ctx) {
    const caps = ctx.chain.captures;
    if (caps.length >= 2 && caps[caps.length - 2].piece === ctx.event.piece) ctx.mulMult(2);
  },
});
soul('martyr', '순교자', '#df5a45', ['sacrifice'], '끊기는 순간 둘레 여덟 칸의 적을 킹만 빼고 모두 먹는다', {
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
soul('crown', '왕관', '#efbd55', ['crown', 'march'], '승급하면 아마존이 되고, 승급 칸도 두 줄 앞당겨진다', {
  onDrop(ctx) { ctx.flags.promoteFrom = Math.min(ctx.flags.promoteFrom ?? 7, 5); ctx.flags.promoteTo = 'Z'; },
});
soul('shade', '그림자', '#8a5cc8', ['sacrifice', 'leap'], '지키는 적이 이 기물을 못 봐 지켜진 칸을 먹어도 사슬이 이어진다 — 대신 사슬이 끝나면 배수 −1', {
  onThreat(ctx) { ctx.ignoreThreat(); },
  onChainEnd(ctx) { if (ctx.chain.mult > 1) ctx.addMult(-1); },
});

export const SOUL_BY_ID = Object.fromEntries(SOULS.map((s) => [s.id, s]));
export const soulSpec = (id) => (id && SOUL_BY_ID[id] ? { id: `soul:${id}` } : null);
