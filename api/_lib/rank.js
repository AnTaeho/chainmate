// 순위 줄 세우기(CHM-70): 닿은 관 → 대국 번호 → 이겼는지 → 판 전체 점수 합. 모두 클수록 위.
// 8관 마스터전 승리(ante 8 · blind 2 · won)가 맨 위에 온다. 같으면 먼저 낸 사람이 위(DB의 submitted_at · player_id — api/_lib/store.js ORDER).
export const rankKey = (r) => [r.ante, r.blind, r.won ? 1 : 0, r.score_total];

// a가 b보다 위면 음수(정렬용)
export function compareRank(a, b) {
  const x = rankKey(a), y = rankKey(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
}

// a가 b보다 확실히 좋은가(같으면 거짓 — 같은 기록을 다시 내도 갈아 끼우지 않는다)
export const better = (a, b) => !b || compareRank(a, b) < 0;
