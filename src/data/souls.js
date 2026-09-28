// 혼(깊이 C): 주머니 기물 하나에 붙는 고유 규칙. 모습이 바뀌어도 그 사슬 내내 따라간다.
// 각인(숫자)과 따로: 한 기물이 각인 하나 + 혼 하나까지. 명세는 기물의 soul = id, 사슬에서는 chain.soul = { id }.
// 버린 안: 쌍둥이(두 사슬을 차례로 — 한 수 연출 4초 안에 들지 않고 풀이기 가지가 제곱) · 방랑자(가로로 이어진 판 — 행마선이
//   화면 끝을 넘어 1배에서 읽히지 않는다) · 전령(증원 그림자 먹기 — 그림자는 판에 없는 기물이라 응수 · 끊김 판정이 모호).
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';
import { attackers, isEnemy } from '../sim/board.js';

export const SOULS = [];
function soul(id, name, col, families, text, { more = null, ...def }) {
  SOULS.push({ id, name, col, families, text, more });
  defineModifier(`soul:${id}`, { kind: 'soul', ...def });
}
export const SOUL_PRICE = 4;

// 순교(혼 「순교자」 · 정석 「순교의 맹세」): 끊기는 순간 둘레의 적을 값이 큰 차례로 take까지 먹는다.
// 킹을 지키는 적은 남긴다 — 둘레를 다 먹으면 킹의 수비수가 사라져 다음 수에 외통이 쉽게 났다(2026-09-28, sim --soul martyr 외통 45~64% → 15~42%, 혼 없는 대국 13~37%).
// 킹 · 벽은 먹지 않는다. 치우면 킹을 지키는 적이 줄어드는 칸(포 · 메뚜기의 받침, 내 기물이 막던 선)도 남긴다.
export const MARTYR = { take: 2 };
export const MARTYR_TEXT = '끊길 때: 둘레의 적 둘을 먹는다';
export const MARTYR_MORE = '킹과 킹을 지키는 적은 남긴다 · 값이 큰 적부터';
// 잠행(옛 이름 그림자 — 증원 「점선 그림자」와 겹쳐 바꿨다, id shade는 그대로): 한 사슬에서 처음 ignores번만 지키는 적을 무시한다(지켜진 킹은 여전히 못 먹는다 — board.js kingTakeable).
// 옛 「늘 무시 · 배수 −1」은 끊김이 없어 첫 수 외통이 대국의 9~22%였다(sim --soul shade). 두 번이면 옛것과 외통이 같았다.
// 한 번으로 줄이며 배수 −1은 뺐다(penalty)
export const SHADE = { ignores: 1, penalty: 0 };

// 둘레 적 중 순교로 먹을 칸(값이 큰 차례, 같으면 칸 번호 차례). board는 끊긴 순간의 판(내 기물이 sq에 있다)
export function martyrTargets(board, sq, opts = {}, take = MARTYR.take) {
  const kings = [];
  for (let s = 0; s < 64; s++) if (isEnemy(board[s]) && board[s].t === 'K') kings.push(s);
  // 내 기물은 사슬이 끝나면 판에서 내려간다: 그 칸은 빈 것으로 보고 지킴을 센다
  const guards = (bd, k) => attackers(bd, k, { ...opts, ignore: sq }).length;
  const defenders = new Set(kings.flatMap((k) => attackers(board, k, { ...opts, ignore: sq })));
  const cand = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = (sq & 7) + df, r = (sq >> 3) + dr;
    if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
    const s = r * 8 + f, c = board[s];
    if (!isEnemy(c) || c.t === 'K' || c.t === 'X' || defenders.has(s)) continue;
    cand.push(s);
  }
  cand.sort((a, b) => PIECES[board[b].t].value - PIECES[board[a].t].value || a - b);
  const out = [], b = board.slice();
  for (const s of cand) {
    if (out.length >= take) break;
    const before = kings.map((k) => guards(b, k));
    const c = b[s];
    b[s] = null;
    if (kings.some((k, i) => guards(b, k) < before[i])) { b[s] = c; continue; }
    out.push(s);
  }
  return out;
}

export function martyrBurst(ctx, take = MARTYR.take) {
  const board = ctx.t.board;
  const opts = ctx.t.rules && ctx.t.rules.pawnSides ? { pawnSides: true } : {};
  for (const s of martyrTargets(board, ctx.event.sq, opts, take)) {
    const c = board[s];
    board[s] = null;
    ctx.emit({ type: 'pierce', sq: s, piece: c.t, gold: !!c.gold });
    ctx.addValue(PIECES[c.t].value);
    ctx.addMult(1);
  }
}
// 초월: every번 먹을 때마다 한 단계 위로, 룩까지. 옛 「먹을 때마다 · 아마존까지」는 퀸 · 아마존이 되어 판을 10~16번 쓸고
// 킹을 먹었다(sim --soul transcend 외통 86~98%). 룩까지만이면 1 · 2관이 60%대(나이트 › 비숍으로 둘째 먹기에 외통),
// 두 번마다를 더해 28~47%(2026-09-28). 룩으로 떨구면 모습이 바뀌지 않는다
export const UP = { P: 'N', N: 'B', B: 'R' };
export const TRANSCEND = { every: 2 };
export const TRANSCEND_TEXT = '두 번 먹을 때마다: 한 단계 위 기물이 된다';
export const TRANSCEND_MORE = '폰 › 나이트 › 비숍 › 룩';
// 흡수: 처음 takes번 먹기까지 모습이 안 바뀌고 먹은 적의 행마를 얻는다. 얻은 행마는 그다음 먹기까지만.
// 옛것은 얻은 행마가 사슬 끝까지 남아(코드가 지우지 않았다) 행마 둘로 다녀 외통이 66~80%였다(sim --soul absorb).
// 행마를 지워도 세 번이면 48~71% · 두 번이면 36~61%, 한 번이라 25~52%(2026-09-28)
export const ABSORB = { takes: 1 };
export const ABSORB_TEXT = '첫 먹기: 모습 그대로 · 먹은 적의 행마를 얻는다';
export const ABSORB_MORE = '얻은 행마는 다음 먹기까지';

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
soul('crown', '선봉', '#efbd55', ['crown', 'march'], '폰 모습이면 여섯째 줄에서 아마존으로 승급', {
  onDrop(ctx) { ctx.flags.promoteFrom = Math.min(ctx.flags.promoteFrom ?? 7, 5); ctx.flags.promoteTo = 'Z'; },
});
soul('shade', '잠행', '#8a5cc8', ['sacrifice', 'leap'], '사슬마다 한 번: 지키는 적을 무시한다', {
  more: '지켜진 킹은 먹을 수 없다',
  onThreat(ctx) {
    if ((ctx.flags.shade || 0) >= SHADE.ignores) return;
    ctx.flags.shade = (ctx.flags.shade || 0) + 1;
    ctx.ignoreThreat();
  },
  onChainEnd(ctx) { if (SHADE.penalty && ctx.chain.mult > 1) ctx.addMult(-SHADE.penalty); },
});

export const SOUL_BY_ID = Object.fromEntries(SOULS.map((s) => [s.id, s]));
export const soulSpec = (id) => (id && SOUL_BY_ID[id] ? { id: `soul:${id}` } : null);
