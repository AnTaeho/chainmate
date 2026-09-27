// 적 특성(깊이 D): 4관부터 적 기물에 붙는다(판을 지을 때, 관이 오를수록 자주). 발밑에 작은 문양.
// 판정은 board.js(방패 · 성채) · chain.js(폭약 · 거울 · 배신자)에서 칸의 trait만 보고 한다.
// 버린 안: 독(다음 먹기 하나를 건너뛴다 — 「건너뛴 먹기」가 사슬 규칙에 없는 개념이라 설명이 두 줄) · 예고장(먼 적이 함께 사라지는 이유가 판에서 안 보인다).
export const TRAITS = [
  { id: 'shield', name: '방패', col: '#d8dee6', text: '사슬의 첫 먹이로는 먹을 수 없다' },
  { id: 'bomb', name: '폭약', col: '#df5a45', text: '먹으면 둘레 여덟 칸의 적도 함께 먹혀 연쇄에 든다' },
  { id: 'mirror', name: '거울', col: '#9fd3e0', text: '먹어도 내 모습이 바뀌지 않는다' },
  { id: 'fort', name: '성채', col: '#c8902c', text: '둘레 여덟 칸을 모두 지킨다' },
  { id: 'traitor', name: '배신자', col: '#8ec07c', text: '먹으면 대국 뒤 내 주머니에 그 종류로 들어온다' },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
// 적 하나에 특성이 붙을 확률: 4관 6% · 관마다 +4%p, 최대 26%
export const TRAIT_CHANCE = { from: 4, base: 0.06, step: 0.04, max: 0.26, traitorDeckMax: 14 };
export const traitChance = (ante) => (ante < TRAIT_CHANCE.from ? 0 : Math.min(TRAIT_CHANCE.max, TRAIT_CHANCE.base + TRAIT_CHANCE.step * (ante - TRAIT_CHANCE.from)));
