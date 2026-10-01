// 희생 · 탁월수 !!(CHM-35, docs/design-notes/sacrifice.md 「바뀐 설계」).
// 희생: 손 기물 하나를 바치고 새로 뽑는다. 바친 기물은 이번 대국 동안 주머니로 돌아오지 않는다(손해). 평소엔 몫이 없다.
// 탁월수: 희생으로 새로 뽑은 기물로 시작한 바로 다음 사슬이 체크메이트로 끝나면, 그 사슬의 마지막 배수에 ×(1 + per × 바친 무게 합).
// 바치기 전에 보이던 메이트는 들지 않는다 — 무엇이 나올지 모르고 바치는 도박(공짜로 쌓이던 첫 안은 판의 70%에 나왔다).
export const SACRIFICE_WEIGHT = { P: 1, N: 2, B: 2, R: 3, Q: 5, A: 3, C: 4, Z: 4, L: 2, H: 3, G: 2, O: 3, S: 2, W: 3 };
export const weightOf = (t) => SACRIFICE_WEIGHT[t] ?? 2;
export const BRILLIANT = { per: 1 };
export const brilliantMult = (weight) => 1 + BRILLIANT.per * weight;
// 다음 수를 기다리는 희생(대국 상태 b.offering { weight, count, pieces, drawn(새로 뽑은 기물 id) }, JSON). 원본은 그대로 두고 새 것을 돌려준다
export function addOffering(off, t) {
  return { weight: ((off && off.weight) || 0) + weightOf(t), count: ((off && off.count) || 0) + 1, pieces: [...((off && off.pieces) || []), t], drawn: [...((off && off.drawn) || [])] };
}
