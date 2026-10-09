// 오프닝: 시작 덱 + 규칙 덮어쓰기. 해금은 판 밖(src/ui/records.js의 과제).
//   bag    시작 덱(기물 종류 배열)
//   rules  대국 규칙 덮어쓰기(battle.js DEFAULT_RULES 키: hand · moves · discards …)
//   run    판 수치 덮어쓰기(run.js RUN_DEFAULTS 키: money · maximSlots · consumableSlots)
// 덱은 모두 여덟(기본과 같은 크기): DESIGN의 「런던(폰 5 · 비숍 2)」처럼 적힌 기물이 늘고 나머지가 기본에서 빠진다.
export const OPENINGS = {
  standard: { id: 'standard', name: '기본', text: '폰 넷 · 나이트 둘 · 비숍 · 룩', bag: ['P', 'P', 'P', 'P', 'N', 'N', 'B', 'R'], rules: {}, run: {} },
  london: { id: 'london', name: '런던', text: '폰 다섯 · 비숍 둘 · 룩', bag: ['P', 'P', 'P', 'P', 'P', 'B', 'B', 'R'], rules: {}, run: {} },
  sicilian: { id: 'sicilian', name: '시실리안', text: '폰 셋 · 나이트 셋 · 비숍 · 룩 · 손 5', bag: ['P', 'P', 'P', 'N', 'N', 'N', 'B', 'R'], rules: { hand: 5 }, run: {} },
  queens_gambit: { id: 'queens_gambit', name: '퀸스 갬빗', text: '폰 셋 · 나이트 둘 · 비숍 · 룩 · 퀸 · 수 3', bag: ['P', 'P', 'P', 'N', 'N', 'B', 'R', 'Q'], rules: { moves: 3 }, run: {} },
  rook_endgame: { id: 'rook_endgame', name: '룩 엔딩', text: '폰 넷 · 나이트 · 비숍 · 룩 둘 · 격언 칸 4', bag: ['P', 'P', 'P', 'P', 'N', 'B', 'R', 'R'], rules: {}, run: { maximSlots: 4 } },
};
export const DEFAULT_OPENING = 'standard';
