// 격언(조커) 32종. 등록 데이터 + 조정자 정의.
// 명세(판·대국에 들어가는 것): { id, uid, data, edition } — data는 판(런) 동안 남는 값(「기보 수집가」의 n 등),
// 대국 안의 state는 대국마다 새로 시작한다(scoring.js 머리말).
// 필드: id · name(화면 이름) · text(화면 한 줄) · verb(뿌리의 어느 동사) · rarity('common'|'uncommon'|'rare') · price(3~8)
// 전설(불멸의 기보)은 step 2b: rarity 'legendary', 상점에는 나오지 않는다.
import { defineModifier } from '../sim/scoring.js';
import { reach } from '../sim/board.js';
import { kingGuards } from '../sim/setup.js';

const EDGE = (sq) => (sq & 7) === 0 || (sq & 7) === 7 || sq >> 3 === 0 || sq >> 3 === 7;
const CENTER = [27, 28, 35, 36]; // d4 e4 d5 e5
const num = (x, d = 0) => (typeof x === 'number' ? x : d);

export const MAXIMS = [];

function maxim(id, name, text, verb, rarity, price, def) {
  MAXIMS.push({ id, name, text, verb, rarity, price });
  defineModifier(id, { kind: 'maxim', ...def });
}

// ── 떨구기
maxim('chivalry', '기사도', '나이트로 떨군 사슬 연쇄 ×1.5', '떨구기', 'uncommon', 5, {
  onChainEnd(ctx) { if (ctx.chain.dropType === 'N') ctx.mulMult(1.5); },
});
maxim('pawn_march', '폰의 행진', '폰으로 떨군 사슬 값 +40', '떨구기', 'common', 3, {
  onChainEnd(ctx) { if (ctx.chain.dropType === 'P') ctx.addValue(40); },
});

// ── 갈아입기
maxim('quick_change', '갈아입기', '모습이 바뀔 때마다 연쇄 +2', '갈아입기', 'common', 4, {
  onTransform(ctx) { ctx.addMult(2); },
});
maxim('whim', '변덕', '한 사슬에 모습 넷 이상이면 연쇄 ×2', '갈아입기', 'rare', 7, {
  onChainEnd(ctx) { if (ctx.chain.forms.length >= 4) ctx.mulMult(2); },
});
maxim('steadfast', '한결같음', '모습이 한 번도 안 바뀐 사슬 연쇄 ×3', '갈아입기', 'uncommon', 6, {
  onChainEnd(ctx) { if (ctx.chain.transforms === 0 && ctx.chain.promotions === 0) ctx.mulMult(3); },
});
maxim('coronation', '대관식', '퀸 모습이 될 때마다 값 +50', '갈아입기', 'common', 4, {
  onTransform(ctx) { if (ctx.event.to === 'Q') ctx.addValue(50); },
  onPromote(ctx) { ctx.addValue(50); },
});

// ── 먹기
maxim('low_stance', '낮은 자세', '폰 모습으로 먹을 때마다 연쇄 +3', '먹기', 'common', 4, {
  onCapture(ctx) { if (ctx.event.form === 'P') ctx.addMult(3); },
});
maxim('diagonal', '대각의 길', '비숍 모습으로 먹을 때마다 값 +25', '먹기', 'common', 3, {
  onCapture(ctx) { if (ctx.event.form === 'B') ctx.addValue(25); },
});
maxim('wall_breaker', '성벽 허물기', '룩을 먹을 때마다 연쇄 +4', '먹기', 'common', 4, {
  onCapture(ctx) { if (ctx.event.piece === 'R') ctx.addMult(4); },
});
maxim('long_chain', '긴 사슬', '다섯째 먹기부터 먹을 때마다 연쇄 ×1.2', '먹기', 'rare', 7, {
  onCapture(ctx) { if (ctx.event.index >= 4) ctx.mulMult(1.2); },
});
maxim('long_road', '먼 길', '세 칸 이상 미끄러져 먹으면 값 +20', '먹기', 'common', 3, {
  onCapture(ctx) { if (ctx.event.dist >= 3) ctx.addValue(20); },
});
maxim('edge', '가장자리', '판 가장자리에서 먹으면 연쇄 +2', '먹기', 'common', 4, {
  onCapture(ctx) { if (EDGE(ctx.event.to)) ctx.addMult(2); },
});
maxim('center', '중앙 장악', '가운데 네 칸에서 먹으면 연쇄 ×1.5', '먹기', 'uncommon', 5, {
  onCapture(ctx) { if (CENTER.includes(ctx.event.to)) ctx.mulMult(1.5); },
});
maxim('vault', '금고', '먹은 수만큼 상금, 대국마다 5까지', '먹기', 'uncommon', 5, {
  onChainEnd(ctx) {
    const got = num(ctx.state.got);
    const n = Math.min(ctx.chain.captures.length, 5 - got);
    if (n > 0) { ctx.state.got = got + n; ctx.addMoney(n); }
  },
});

// ── 승급
maxim('back_rank_dream', '끝줄의 꿈', '승급한 사슬은 끊겨도 한 번 이어진다', '승급', 'uncommon', 6, {
  onCut(ctx) {
    if (ctx.chain.promotions > 0 && !ctx.flags.backRankDream) { ctx.flags.backRankDream = true; ctx.cancelCut(); }
  },
});
maxim('promotion_feast', '승급 잔치', '승급할 때마다 연쇄 ×2', '승급', 'uncommon', 5, {
  onPromote(ctx) { ctx.mulMult(2); },
});

// ── 끊김
maxim('sacrifice', '희생', '대국마다 첫 끊김을 넘긴다', '끊김', 'uncommon', 5, {
  onCut(ctx) { if (!ctx.state.used) { ctx.state.used = true; ctx.cancelCut(); } },
});
maxim('payback', '되갚음', '끊겨 끝난 사슬 연쇄 +8', '끊김', 'common', 4, {
  onChainEnd(ctx) { if (ctx.event.reason === 'cut') ctx.addMult(8); },
});
maxim('close_call', '아슬아슬', '끊기지 않고 끝난 사슬 값 +30', '끊김', 'common', 3, {
  onChainEnd(ctx) { if (ctx.event.reason !== 'cut') ctx.addValue(30); },
});

// ── 외통
// 밤샘 D-2: 외통 사냥꾼 · 왕의 목 · 다시 생각 · 그림자 읽기는 판 시작에 쥐여 줘도 통과한 관이 +0.25(보통 격언 +1.1)라 효과를 올렸다.
maxim('mate_hunter', '외통 사냥꾼', '킹을 지키는 적이 하나 적다 · 외통으로 이기면 상금 +6', '외통', 'common', 4, {
  onBattleStart(ctx) { ctx.rules.guards = Math.max(1, (ctx.rules.guards ?? kingGuards(ctx.t.ante ?? 1)) - 1); },
  onChainEnd(ctx) { if (ctx.event.reason === 'mate') ctx.addMoney(6); },
});
maxim('kings_neck', '왕의 목', '지키는 이 없는 킹이 빛난다 · 킹을 지키던 적을 먹으면 연쇄 +2 · 외통 사슬 연쇄 ×3', '외통', 'uncommon', 6, {
  onCapture(ctx) {
    const { piece, to } = ctx.event;
    if (piece === 'K') return;
    const board = ctx.t.board;
    if (reach(board, piece, to, -1).some((s) => board[s] && !board[s].mine && board[s].t === 'K')) ctx.addMult(2);
  },
  // 화면용: 지금 지키는 적이 없는 킹 칸. b.hints.openKings
  onBoard(ctx) {
    const t = ctx.t;
    const open = [];
    t.board.forEach((c, sq) => {
      if (c && !c.mine && c.t === 'K' && ctx.attackers(sq).length === 0) open.push(sq);
    });
    t.hints = { ...t.hints, openKings: open };
  },
  onChainEnd(ctx) { if (ctx.event.reason === 'mate') ctx.mulMult(3); },
});
maxim('memory', '대국의 기억', '외통 한 번마다 연쇄 ×0.5씩 쌓인다', '외통', 'rare', 8, {
  onChainEnd(ctx) { const m = num(ctx.data.mates); if (m > 0) ctx.mulMult(1 + 0.5 * m); },
  onRunEvent(spec, ev) {
    if (ev.type === 'battleWon' && ev.reason === 'mate') spec.data = { ...spec.data, mates: num(spec.data && spec.data.mates) + 1 };
  },
});

// ── 수
maxim('first_move', '첫수', '대국 첫 수 연쇄 ×2', '수', 'common', 4, {
  onChainEnd(ctx) { if (num(ctx.t.movesUsed) === 0) ctx.mulMult(2); },
});
maxim('last_move', '마지막 수', '대국 마지막 수 연쇄 ×3', '수', 'uncommon', 6, {
  onChainEnd(ctx) { if (ctx.t.movesLeft === 1) ctx.mulMult(3); },
});

// ── 무르기
maxim('no_regrets', '무르지 않는다', '무르기 전까지 모든 수 연쇄 +4', '무르기', 'common', 4, {
  onChainEnd(ctx) { if (num(ctx.t.discardsUsed) === 0) ctx.addMult(4); },
});
maxim('second_thought', '다시 생각', '무르기 +1 · 무른 기물 하나마다 이번 대국 값 +10', '무르기', 'common', 3, {
  onBattleStart(ctx) { ctx.rules.discards = (ctx.rules.discards ?? 3) + 1; },
  onChainEnd(ctx) { ctx.addValue(10 * num(ctx.t.discarded)); },
});

// ── 주머니
maxim('empty_bag', '빈 주머니', '주머니에 남은 기물마다 연쇄 +1', '주머니', 'common', 4, {
  onChainEnd(ctx) { ctx.addMult(ctx.t.bag ? ctx.t.bag.length : 0); },
});
// ×2였을 때(2a) 판 봇의 주머니가 끝에 평균 6개라 조건이 늘 참이었고, 산 판 승률이 35%(평균 10%)로 홀로 높았다.
// ×1.5로 낮췄다(보고서 docs/reports/2b.md).
maxim('small_bag', '작은 주머니', '가진 기물이 여덟 이하면 연쇄 ×1.5', '주머니', 'uncommon', 6, {
  onChainEnd(ctx) { if (num(ctx.t.deckSize, 99) <= 8) ctx.mulMult(1.5); },
});

// ── 증원
maxim('welcome', '증원 환영', '막 들어온 적을 먹으면 값 +40', '증원', 'common', 3, {
  onCapture(ctx) { if (ctx.event.born >= 0 && ctx.event.born === num(ctx.t.movesUsed)) ctx.addValue(40); },
});
maxim('shadow_reading', '그림자 읽기', '증원이 두 수 앞까지 보인다 · 증원이 올 칸에 떨구면 연쇄 +4', '증원', 'common', 3, {
  onBattleStart(ctx) { ctx.rules.lookahead = Math.max(ctx.rules.lookahead || 1, 2); },
  onDrop(ctx) {
    const t = ctx.t;
    const waves = [...(t.incoming || []), ...(t.incomingNext || [])];
    if (waves.some((r) => r.sq === ctx.event.sq)) ctx.flags.shadowDrop = true;
  },
  onChainEnd(ctx) { if (ctx.flags && ctx.flags.shadowDrop) ctx.addMult(4); },
});

// ── 각인
maxim('ivory_tower', '상아탑', '상아 기물로 떨군 사슬 연쇄 +5', '각인', 'uncommon', 5, {
  onChainEnd(ctx) { if (ctx.chain.engraving && ctx.chain.engraving.id === 'ivory') ctx.addMult(5); },
});

// ── 기보
maxim('collector', '기보 수집가', '기보를 쓸 때마다 연쇄 +1씩 쌓인다', '기보', 'rare', 7, {
  onChainEnd(ctx) { ctx.addMult(num(ctx.data.n)); },
  onRunEvent(spec, ev) {
    if (ev.type === 'chartUsed') spec.data = { ...spec.data, n: num(spec.data && spec.data.n) + 1 };
  },
});

// ── 밤샘 D-8: 여덟 더(뿌리의 동사마다 하나 이상)
maxim('light_step', '가벼운 발', '폰이나 나이트로 떨군 사슬 연쇄 +3', '떨구기', 'common', 4, {
  onChainEnd(ctx) { if (ctx.chain.dropType === 'P' || ctx.chain.dropType === 'N') ctx.addMult(3); },
});
maxim('queen_hunt', '퀸 사냥', '퀸을 먹을 때마다 값 +60', '먹기', 'common', 4, {
  onCapture(ctx) { if (ctx.event.piece === 'Q') ctx.addValue(60); },
});
maxim('bare_board', '빈 판', '적이 여덟 이하로 남으면 사슬 끝 연쇄 ×1.5', '먹기', 'uncommon', 6, {
  onChainEnd(ctx) { if (ctx.t.board.filter((c) => c && !c.mine).length <= 8) ctx.mulMult(1.5); },
});
maxim('homecoming', '되돌이', '떨군 모습으로 다시 갈아입으면 연쇄 ×2(사슬마다 한 번)', '갈아입기', 'uncommon', 5, {
  onTransform(ctx) {
    if (ctx.event.to === ctx.chain.dropType && !ctx.flags.homecoming) { ctx.flags.homecoming = true; ctx.mulMult(2); }
  },
});
maxim('collector_forms', '모습 모으기', '한 사슬에서 처음 되는 모습마다 값 +20', '갈아입기', 'common', 4, {
  onTransform(ctx) { if (!ctx.chain.forms.includes(ctx.event.to)) ctx.addValue(20); },
});
maxim('reply_master', '응수의 달인', '응수로 먹을 때마다 연쇄 +2', '응수', 'uncommon', 5, {
  onCapture(ctx) { if (ctx.event.forced) ctx.addMult(2); },
});
maxim('promotion_road', '승급의 길', '승급할 때마다 값 +80', '승급', 'common', 4, {
  onPromote(ctx) { ctx.addValue(80); },
});
maxim('reinforce_hunt', '증원 사냥', '증원으로 들어온 적을 먹을 때마다 연쇄 +2', '증원', 'common', 3, {
  onCapture(ctx) { if (ctx.event.born >= 0) ctx.addMult(2); },
});

// ── 깊이 G: 증강체스의 나머지 카드에서(뿌리의 동사를 비튼 셋)
maxim('promotion_rush', '특진', '한 사슬에서 폰 모습으로 둘을 먹으면 곧바로 승급', '승급', 'uncommon', 5, {
  onCapture(ctx) {
    if (ctx.event.form !== 'P') return;
    ctx.flags.pawnTakes = (ctx.flags.pawnTakes || 0) + 1;
    if (ctx.flags.pawnTakes >= 2) ctx.flags.promoteFrom = 0;
  },
});
maxim('mad_horse', '광마', '나이트 모습이 판 가장자리에서 먹으면 그 칸의 노림을 한 번 무시', '응수', 'common', 4, {
  onCapture(ctx) { if (ctx.event.form === 'N' && EDGE(ctx.event.to) && !ctx.flags.madHorseUsed) ctx.flags.madHorse = true; },
  onThreat(ctx) { if (ctx.flags.madHorse) { ctx.flags.madHorse = false; ctx.flags.madHorseUsed = true; ctx.ignoreThreat(); } },
});
maxim('rook_lift', '룩 리프트', '룩 모습이 네 구석에서 먹으면 연쇄 ×2', '먹기', 'common', 4, {
  onCapture(ctx) { const s = ctx.event.to; if (ctx.event.form === 'R' && (s === 0 || s === 7 || s === 56 || s === 63)) ctx.mulMult(2); },
});

export const MAXIM_BY_ID = Object.fromEntries(MAXIMS.map((m) => [m.id, m]));
