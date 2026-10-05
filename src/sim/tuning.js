// 판 조정(밤샘 2 D2 · D3, CHM-20에서 한 곳으로 모음): 대국판의 운을 누그러뜨리는 두 장치.
//   filter  나쁜 판 거르기 — 판(런) 대국은 판 후보를 이만큼 지어 「첫 손 최선 사슬 점수」가 가장 낮은 하나를 버린다(battle.js layBoard).
//           false · 0 · 1이면 끈다. true면 FILTER_DEFAULT.
//   reboard 다시 놓기 — 대국마다 첫 수 전에 한 번 판을 새로 깐다(battle.js reboard). false면 규칙 · 봇 · 화면 단추가 모두 사라진다.
// 둘 다 끄면 판 생성이 밤샘 2 전과 같다(같은 시드 → 같은 판). 켜고 끄는 법 · 통째로 들어낼 때 지울 목록은 docs/design-notes/board-tuning.md.
export const FILTER_DEFAULT = 4;
export const BOARD_TUNING = { filter: FILTER_DEFAULT, reboard: true };

// 판(런) 대국의 판 후보 수(0이면 거르지 않는다)
export const boardFilter = () => {
  const f = BOARD_TUNING.filter;
  if (f === true) return FILTER_DEFAULT;
  return f > 1 ? f : 0;
};
export const reboardOn = () => !!BOARD_TUNING.reboard;
