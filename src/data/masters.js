// 명인(보스) 8. 관마다 하나(같은 판에서 겹치지 않음), 8관은 「대가」 고정.
import { defineModifier, getModifier } from '../sim/scoring.js';

export const MASTERS = [];
function master(id, name, text, def) {
  MASTERS.push({ id, name, text });
  defineModifier(id, { kind: 'master', ...def });
}

master('iron_wall', '철벽', '적 폰이 좌우 옆 칸도 지킨다', {
  onBattleStart(ctx) { ctx.rules.pawnSides = true; },
});
master('fog', '안개', '위 세 줄이 안개에 덮인다 · 내 기물이 닿은 칸만 걷힌다', {
  onBattleStart(ctx) { ctx.rules.fog = 3; },
});
// 같은 모습으로 두 번 갈아입지 못한다: 이 사슬에서 이미 X로 갈아입었으면(먹을 때 모습 ≠ X인 X 먹기) 다른 모습으로 X를 먹을 수 없다.
master('mirror', '거울', '한 사슬에서 같은 모습으로 두 번 갈아입지 못한다', {
  allowCapture(ctx) {
    const { piece, form } = ctx.event;
    if (piece === form || piece === 'K') return true;
    return !ctx.chain.captures.some((c) => c.piece === piece && c.form !== piece);
  },
});
master('hourglass', '모래시계', '수 3', {
  onBattleStart(ctx) { ctx.rules.moves = 3; },
});
master('heavy_hand', '무거운 손', '손 3', {
  onBattleStart(ctx) { ctx.rules.hand = 3; },
});
master('silence', '침묵', '가장 왼쪽 격언이 잠든다', {
  onBattleStart(ctx) {
    const first = ctx.t.mods.find((s) => (s.kind || (getModifier(s.id) || {}).kind) === 'maxim');
    if (first) {
      first.off = true;
      // 그 격언의 판본(edition:* 명세, of = uid)도 같이 잠든다
      for (const s of ctx.t.mods) if (first.uid != null && s.of === first.uid) s.off = true;
    }
  },
});
master('grudge', '앙갚음', '끊긴 사슬은 점수 반', {
  onChainEnd(ctx) { if (ctx.event.reason === 'cut') ctx.chain.scoreMul *= 0.5; },
});
master('grandmaster', '대가', '킹이 둘이다', {
  onBattleStart(ctx) { ctx.rules.kings = 2; },
});

export const MASTER_BY_ID = Object.fromEntries(MASTERS.map((m) => [m.id, m]));
export const FINAL_MASTER = 'grandmaster';
