// 코어 판(CHM-79): 체스 기물 · 격언 · 기보만 남긴 판. createRun({ core: true })가 이 명세를 판 상태에 싣고, 규칙 코드는 실린 깃발 · 목록만 읽는다.
// 끄면(core 없음) 옛 판 그대로다. 대국 규칙(수 · 승패 · 점수 셈)은 건드리지 않는다.
import { UNLOCK_TIERS } from './unlocks.js';

export const CORE = {
  // 열린 목록(run.unlocked): 단계 0 격언 전부(덜어 낸 층에 기대는 것이 없다) · 체스 기물만 · 혼 · 각인 · 레퍼토리 없음
  unlocked: { maxims: [...UNLOCK_TIERS[0].maxims], pieces: [], souls: [], engravings: [], josekis: [] },
  // 대국 규칙 깃발(run.rules): 특수 기물 없음(rules.pieces) · 적 특성 없음 · 무작위 보석 · 벽 없음(세력 버릇의 벽은 남는다)
  rules: { pieces: [], traits: false, randomThings: false },
  consumableSlots: 0,
  // 판 쪽 깃발(run.core.off): 금빛 적 · 연줄 · 대국 도전 · 숙적 · 건너뛰기와 패 · 명경기 조각과 전설 · 격언 판본 · 시너지 조정자와 끌어당김
  off: { golden: true, pity: true, challenge: true, nemesis: true, skip: true, legends: true, editions: true, families: true },
  // 남기는 종류(run.core.keep): 상점 진열 · 꾸러미 · 마스터의 상자 칸
  keep: { shop: ['maxim', 'chart', 'piece'], packs: ['piece', 'chart'], chest: ['money', 'chart'] },
};
