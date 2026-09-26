// 오프닝: 시작 주머니 + 규칙 덮어쓰기. 지금은 기본만(해금은 판 밖, 나중).
//   bag    시작 주머니(기물 종류 배열)
//   rules  대국 규칙 덮어쓰기(battle.js DEFAULT_RULES 키: hand · moves · discards …)
//   run    판 수치 덮어쓰기(run.js RUN_DEFAULTS 키: money · maximSlots · consumableSlots)
export const OPENINGS = {
  standard: { id: 'standard', name: '기본', bag: ['P', 'P', 'P', 'P', 'N', 'N', 'B', 'R'], rules: {}, run: {} },
};
export const DEFAULT_OPENING = 'standard';
