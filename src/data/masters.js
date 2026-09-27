// 명인(보스) 8. 관마다 하나(같은 판에서 겹치지 않음), 8관은 「대가」 고정.
import { defineModifier, getModifier } from '../sim/scoring.js';

export const MASTERS = [];
function master(id, name, text, def) {
  MASTERS.push({ id, name, text });
  defineModifier(id, { kind: 'master', ...def });
}

// 명인마다 뿌리의 동사 하나를 확실히 비튼다(밤샘 D-1: 2a · 2b에서 1~7관 명인 통과 90~97%로 너무 약했다 — 보고서 docs/reports/night-D.md).
// 철벽 = 응수, 안개 = 떨구기, 거울 = 갈아입기, 모래시계 = 수, 무거운 손 = 손, 침묵 = 격언, 앙갚음 = 끊김, 대가 = 외통.
master('iron_wall', '철벽', '지켜진 적을 먹는 순간 사슬이 끊긴다', {
  onBattleStart(ctx) { ctx.rules.noReply = true; },
});
master('fog', '안개', '위 다섯 줄의 안개에는 떨굴 수 없고, 내 기물이 닿은 칸만 걷힌다', {
  onBattleStart(ctx) { ctx.rules.fog = 5; },
});
// 한 사슬에서 같은 종류의 적을 두 번 먹지 못한다(킹은 하나뿐이라 뺀다)
master('mirror', '거울', '한 사슬에서 같은 종류를 두 번 먹지 못한다', {
  allowCapture(ctx) {
    const { piece } = ctx.event;
    if (piece === 'K') return true;
    return !ctx.chain.captures.some((c) => c.piece === piece);
  },
});
master('hourglass', '모래시계', '이 대국은 수 2 · 바꾸기 1로 둔다', {
  onBattleStart(ctx) { ctx.rules.moves = 2; ctx.rules.discards = 1; },
});
master('heavy_hand', '무거운 손', '퀸과 룩은 떨굴 수 없다', {
  onBattleStart(ctx) { ctx.rules.noHeavyDrop = true; },
});
master('silence', '침묵', '이 대국 동안 왼쪽 격언 둘이 잠든다', {
  onBattleStart(ctx) {
    const firsts = ctx.t.mods.filter((s) => (s.kind || (getModifier(s.id) || {}).kind) === 'maxim' && !s.of).slice(0, 2);
    for (const first of firsts) {
      first.off = true;
      // 그 격언의 판본(edition:* 명세, of = uid)도 같이 잠든다
      for (const s of ctx.t.mods) if (first.uid != null && s.of === first.uid) s.off = true;
    }
  },
});
master('grudge', '앙갚음', '끊긴 사슬은 점수가 4분의 1', {
  onChainEnd(ctx) { if (ctx.event.reason === 'cut') ctx.chain.scoreMul *= 0.25; },
});
master('grandmaster', '대가', '킹이 둘이다', {
  onBattleStart(ctx) { ctx.rules.kings = 2; },
});

export const MASTER_BY_ID = Object.fromEntries(MASTERS.map((m) => [m.id, m]));
export const FINAL_MASTER = 'grandmaster';
