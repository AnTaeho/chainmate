// 가족 여덟(깊이 B). 뿌리의 동사에 하나씩: 도약 · 직선 · 대각 · 변신(갈아입기) · 희생(끊김) · 왕관(승급 · 외통) · 행진(폰 떨구기) · 사냥(갈아입지 않고 잇달아).
// 세는 법: 가진 격언의 가족 + 주머니 이형 「종류」의 가족 + 정석의 가족 + 혼의 가족. 체스 기물은 세지 않는다.
// 문턱 2 · 4 · 6마다 효과가 하나씩 켜진다(쌓인다). 효과는 조정자(kind 'family', id 'family:<가족>', data.level 1~3).
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';
import { MAXIM_BY_ID } from './maxims.js';
import { LEGEND_BY_ID } from './legends.js';
import { JOSEKI_BY_ID } from './josekis.js';
import { SOUL_BY_ID } from './souls.js';

export const THRESHOLDS = [2, 4, 6];
export const FAMILIES = [
  { id: 'leap', name: '뛰기', col: '#6fd1bf', text: ['뛰어서 먹을 때마다 값 +20', '대국마다 한 번, 뛰어서 먹은 칸을 지키는 적을 무시한다', '뛰어서 먹을 때마다 배수 ×1.5'] },
  { id: 'line', name: '가로세로', col: '#e0a060', text: ['가로 · 세로로 세 칸 이상 미끄러져 먹을 때마다 배수 +2', '가로 · 세로로 지나간 칸마다 값 +10', '가로 · 세로로 먹으면 그 너머 첫 적도 함께 먹는다'] },
  { id: 'diag', name: '대각선', col: '#9fb8ff', text: ['대각선으로 먹을 때마다 값 +15', '대각선으로 먹을 때마다 배수 +2', '대각선으로 먹을 때마다 배수 ×1.3'] },
  { id: 'change', name: '갈아입기', col: '#d27fd6', text: ['모습이 바뀔 때마다 배수 +2', '사슬이 끝나면 거친 모습 수의 절반을 배수에 곱한다(넷이면 ×2)', '사슬이 막히면 한 번, 지나온 모습 전부의 행마로 잇는다'] },
  { id: 'sacrifice', name: '끊김', col: '#df5a45', text: ['사슬이 끊겨 끝나면 값 ×2', '대국마다 첫 끊김 한 번은 사슬이 이어진다', '끊길 때마다 배수 ×2'] },
  { id: 'crown', name: '승급', col: '#efbd55', text: ['승급할 때마다, 또 퀸 · 아마존을 먹을 때마다 값 +60', '승급 칸이 한 줄 앞당겨진다', '외통하면 대국마다 한 번 판이 다시 채워진다'] },
  { id: 'march', name: '폰 사슬', col: '#c8b48a', text: ['폰으로 떨군 사슬이 끝나면 값 +40', '폰 모습으로 먹을 때마다 배수 +2', '폰으로 떨군 사슬이 끝나면 배수 ×3'] },
  { id: 'hunt', name: '같은 적', col: '#8ec07c', text: ['같은 종류를 잇달아 먹으면 값 +30', '판에서 값이 가장 큰 적을 먹으면 배수 +4', '같은 종류를 잇달아 먹을 때마다 배수 ×1.5'] },
];
export const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
// 화면 이름: 「뛰기 모음」(옛 이름 가족 · 도약 — docs/design-notes/terms.md)
export const setName = (id) => `${FAMILY_BY_ID[id].name} 모음`;
export const levelOf = (n, drop = 0) => THRESHOLDS.filter((x) => n >= x - drop).length;

// 격언 · 명국(전설) 가족: 효과가 건드리는 동사로
export const MAXIM_FAMILIES = {
  chivalry: ['leap'], pawn_march: ['march'], quick_change: ['change'], whim: ['change'], steadfast: ['hunt'], coronation: ['crown'],
  low_stance: ['march'], diagonal: ['diag'], wall_breaker: ['line'], long_chain: ['hunt'], long_road: ['line'], edge: ['line'],
  center: ['diag'], vault: ['hunt'], back_rank_dream: ['crown', 'sacrifice'], promotion_feast: ['crown'], sacrifice: ['sacrifice'],
  payback: ['sacrifice'], close_call: ['leap'], mate_hunter: ['crown', 'hunt'], kings_neck: ['crown'], memory: ['crown'],
  first_move: ['leap'], last_move: ['sacrifice'], no_regrets: ['line'], second_thought: ['change'], empty_bag: ['march'],
  small_bag: ['hunt'], welcome: ['hunt'], shadow_reading: ['march'], ivory_tower: ['diag'], collector: ['change'],
  light_step: ['leap', 'march'], queen_hunt: ['hunt', 'crown'], bare_board: ['sacrifice'], homecoming: ['change'],
  collector_forms: ['change'], reply_master: ['sacrifice'], promotion_road: ['crown', 'march'], reinforce_hunt: ['hunt'],
  promotion_rush: ['crown', 'march'], mad_horse: ['leap'], rook_lift: ['line'],
};
export const maximFamilies = (id) => MAXIM_FAMILIES[id] || (MAXIM_BY_ID[id] && MAXIM_BY_ID[id].families) || (LEGEND_BY_ID[id] && LEGEND_BY_ID[id].families) || [];

// 짜임(build = { deck, maxims, josekis?, souls? })의 가족 수. extra: 더 셀 [가족…](정석 · 혼이 따로 넘길 때)
export function familyCounts(build, extra = []) {
  const n = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
  const add = (list) => { for (const f of list || []) if (n[f] != null) n[f]++; };
  for (const m of build.maxims || []) add(maximFamilies(m.id));
  const fairy = new Set();
  for (const p of build.deck || []) {
    if (PIECES[p.t] && PIECES[p.t].fairy) fairy.add(p.t);
    if (p.soul && SOUL_BY_ID[p.soul]) add(SOUL_BY_ID[p.soul].families);
  }
  for (const t of fairy) add(PIECES[t].families);
  for (const id of build.josekis || []) if (JOSEKI_BY_ID[id]) add(JOSEKI_BY_ID[id].families);
  add(extra);
  return n;
}
// 켜진 가족 조정자 명세: [{ id: 'family:leap', data: { level } }…]. drop: 문턱을 낮추는 수(정석 「복제」가 가장 많이 모은 가족에)
export function familyMods(counts, dropFor = null) {
  const out = [];
  for (const f of FAMILIES) {
    const level = levelOf(counts[f.id], dropFor === f.id ? 1 : 0);
    if (level > 0) out.push({ id: `family:${f.id}`, data: { level } });
  }
  return out;
}

// ── 판정 도우미(먹기 하나: from → to)
const vec = (e) => [(e.to & 7) - (e.from & 7), (e.to >> 3) - (e.from >> 3)];
export const isOrtho = (e) => { const [df, dr] = vec(e); return (df === 0) !== (dr === 0); };
export const isDiag = (e) => { const [df, dr] = vec(e); return df !== 0 && Math.abs(df) === Math.abs(dr); };
// 뛰어서 먹기: 선 위가 아닌 도약(나이트 · 낙타 · 야간기사 · 겹친 기물의 나이트 몫)이거나 메뚜기 · 포의 넘기
export const isLeap = (e) => !isOrtho(e) && !isDiag(e) || e.form === 'G' || e.form === 'O';

const def = (id, hooks) => defineModifier(`family:${id}`, { kind: 'family', ...hooks });
const lv = (ctx) => ctx.data.level || 0;

def('leap', {
  onCapture(ctx) {
    if (!isLeap(ctx.event)) return;
    ctx.addValue(20);
    if (lv(ctx) >= 3) ctx.mulMult(1.5);
    if (lv(ctx) >= 2 && !ctx.state.used) ctx.flags.leapGuard = true;
  },
  // 문턱 4: 대국마다 첫 도약 뒤 그 칸의 노림을 한 번 무시(응수도 끊김도 없다)
  onThreat(ctx) {
    if (lv(ctx) >= 2 && ctx.flags.leapGuard && !ctx.state.used) { ctx.state.used = true; ctx.flags.leapGuard = false; ctx.ignoreThreat(); }
  },
});
def('line', {
  onCapture(ctx) {
    const e = ctx.event;
    if (!isOrtho(e) || e.stay) return;
    if (e.dist >= 3) ctx.addMult(2);
    if (lv(ctx) >= 2) ctx.addValue(10 * e.dist);
    if (lv(ctx) >= 3) {
      // 꿰뚫기: 같은 쪽으로 그 너머 첫 기물이 적(킹 빼고)이면 함께 먹은 것으로(값 · 배수 +1, 모습은 그대로)
      const [df, dr] = vec(e);
      const sf = Math.sign(df), sr = Math.sign(dr);
      let f = (e.to & 7) + sf, r = (e.to >> 3) + sr;
      const board = ctx.t.board;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const s = r * 8 + f, c = board[s];
        if (c) {
          if (!c.mine && c.t !== 'K') {
            board[s] = null;
            ctx.chain.pierced = (ctx.chain.pierced || 0) + 1;
            ctx.emit({ type: 'pierce', sq: s, piece: c.t, gold: !!c.gold });
            ctx.addValue(PIECES[c.t].value);
            ctx.addMult(1);
          }
          break;
        }
        f += sf; r += sr;
      }
    }
  },
});
def('diag', {
  onCapture(ctx) {
    if (!isDiag(ctx.event)) return;
    ctx.addValue(15);
    if (lv(ctx) >= 2) ctx.addMult(2);
    if (lv(ctx) >= 3) ctx.mulMult(1.3);
  },
});
def('change', {
  onTransform(ctx) { ctx.addMult(2); },
  // 문턱 6: 막히면 한 번, 지나온 모습 전부의 행마로 잇는다
  onBlocked(ctx) { if (lv(ctx) >= 3 && !ctx.flags.unionUsed) { ctx.flags.unionUsed = true; ctx.flags.union = true; ctx.keepGoing(); } },
  onChainEnd(ctx) { if (lv(ctx) >= 2) { const k = ctx.chain.forms.length / 2; if (k > 1) ctx.mulMult(k); } },
});
def('sacrifice', {
  onCut(ctx) {
    if (lv(ctx) >= 3) ctx.mulMult(2);
    if (lv(ctx) >= 2 && !ctx.state.used) { ctx.state.used = true; ctx.cancelCut(); }
  },
  onChainEnd(ctx) { if (ctx.event.reason === 'cut') ctx.addValue(ctx.chain.value); },
});
def('crown', {
  onDrop(ctx) { if (lv(ctx) >= 2) ctx.flags.promoteFrom = Math.min(ctx.flags.promoteFrom ?? 7, 6); },
  onCapture(ctx) { if (ctx.event.piece === 'Q' || ctx.event.piece === 'Z') ctx.addValue(60); },
  onPromote(ctx) { ctx.addValue(60); },
  onMate(ctx) { if (lv(ctx) >= 3 && !ctx.state.refilled) { ctx.state.refilled = true; ctx.keepGoing(); } },
});
def('march', {
  onCapture(ctx) { if (lv(ctx) >= 2 && ctx.event.form === 'P') ctx.addMult(2); },
  onChainEnd(ctx) {
    if (ctx.chain.dropType !== 'P') return;
    ctx.addValue(40);
    if (lv(ctx) >= 3) ctx.mulMult(3);
  },
});
def('hunt', {
  onCapture(ctx) {
    const e = ctx.event, caps = ctx.chain.captures;
    const prev = caps.length >= 2 ? caps[caps.length - 2] : null;
    if (prev && prev.piece === e.piece) { ctx.addValue(30); if (lv(ctx) >= 3) ctx.mulMult(1.5); }
    if (lv(ctx) >= 2 && e.piece !== 'K') {
      const v = PIECES[e.piece].value;
      if (!ctx.t.board.some((c) => c && !c.mine && c.t !== 'K' && PIECES[c.t].value > v)) ctx.addMult(4);
    }
  },
});
