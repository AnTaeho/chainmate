// 코어 판(CHM-79): 체스 기물 · 격언 · 기보만 남긴 판. createRun({ core: true })가 이 명세를 판 상태에 싣고, 규칙 코드는 실린 깃발 · 목록만 읽는다.
// 끄면(core 없음) 옛 판 그대로다. 대국 구조(끝까지 두기 · 이어지는 배수)는 규칙 깃발로만 켜고, 보상 · 목표 곡선은 여기 수치를 쓴다.
import { UNLOCK_TIERS } from './unlocks.js';

export const CORE = {
  // 열린 목록(run.unlocked): 단계 0 격언 전부(덜어 낸 층에 기대는 것이 없다) · 체스 기물만 · 혼 · 각인 · 레퍼토리 없음
  unlocked: { maxims: [...UNLOCK_TIERS[0].maxims], pieces: [], souls: [], engravings: [], josekis: [] },
  // 대국 규칙 깃발(run.rules): 특수 기물 없음(rules.pieces) · 적 특성 없음 · 무작위 보석 · 벽 없음(세력 버릇의 벽은 남는다)
  //   playOut: 목표를 넘겨도 수를 다 쓴다(battle.js endMove) · streak: 이어 잡은 수가 다음 콤보의 시작 배수(chain.js startChain)
  //   streakCut: 끊김으로 끝난 콤보 뒤 — 'keep' 쌓인 수는 남고 끊긴 콤보에서 잡은 수만 안 더한다('reset' 0 · 'half' 절반)
  //   enemyMult · reinforceAdd: 처음 판은 킹 · 지키는 적 밖의 적을 절반으로, 증원은 수마다 +3 — 판이 차오르다 마지막 수에 쓸어 낸다
  //   mateLimit: false — 외통 조건 없음(아무도 지키지 않는 킹은 잡는다, tuning.js mateBlocked) · brilliant: false — 희생은 바치고 다시 뽑기만(탁월수 · 「!?」 없음)
  //   chessHabits: 세력 버릇은 체스에 있는 것만(factions.js habit.chess) · reboards: 0 — 다시 놓기 없음
  rules: { pieces: [], traits: false, randomThings: false, playOut: true, streak: true, streakCut: 'keep', enemyMult: 0.5, reinforceAdd: 3, mateLimit: false, brilliant: false, chessHabits: true, reboards: 0 },
  // 넘친 목표 덤(run.js endBattle, 가장 높은 층 하나): 코어 판은 끝까지 두니 ×2부터 준다
  overflow: { 2: 1, 5: 2, 10: 4 },
  // 관별 목표 기준(run.js B 대신, 종류 · 마스터 · 단 배율과 끝없는 대국 성장은 그대로 곱한다). 잘 두는 봇(--look 8) 판 승률 80~90% · 관별 통과 93% 이상 · 기본 봇 40~60%로 맞춘 값
  B: [350, 1500, 3300, 7200, 14500, 27000, 50000, 115000],
  // 종류 배율(run.js KIND_MULT 대신, 모든 관 공통 — 옛 관별 마스터 덧배율 MASTER_MULT는 쓰지 않는다). 연습 < 정식 < 마스터
  kindMult: { practice: 1, official: 1.6, master: 1.9 },
  consumableSlots: 0,
  // 판 쪽 깃발(run.core.off): 금빛 적 · 연줄 · 대국 도전 · 숙적 · 건너뛰기와 패 · 명경기 조각과 전설 · 격언 판본 · 시너지 조정자와 끌어당김 · 찜 ·
  //   마스터 규칙(마스터전은 같은 규칙에 더 높은 목표 — run.js battleMods가 마스터 조정자를 꺼 둔다)
  off: { golden: true, pity: true, challenge: true, nemesis: true, skip: true, legends: true, editions: true, families: true, hold: true, masters: true },
  // 남기는 종류(run.core.keep): 상점 진열 · 꾸러미 · 마스터의 상자 칸
  keep: { shop: ['maxim', 'chart', 'piece'], packs: ['piece', 'chart'], chest: ['money', 'chart'] },
};
