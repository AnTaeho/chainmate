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

// 대국 호흡 시제품(CHM-66 D′): 「첫 수에 목표를 넘겨 끝나는」 대국을 줄이려는 세 안. 기본은 꺼짐(mode null) — 꺼 두면 규칙 · 봇 · 하네스가 그대로다.
// 하네스 `node tools/run.mjs … --pace '{"mode":"B","momentum":0.5,"curve":1.6}'`가 켠다. 화면 · 저장은 이 값을 모른다(시제품).
//   mode      null | 'A' | 'B' | 'C'
//   curve     2관부터 목표 곡선 배율(run.js targetFor — 1관은 그대로). 안마다 판 승률을 맞추는 시제품 맞춤값. mode가 있을 때만 쓴다
//   A 수치만  kindMult: 연습 · 정식 목표 배율(지금 ×1 · ×1.5, 마스터 ×2는 그대로) · moves: 대국당 수(지금 4)
//   B 기세    momentum: 대국 안에서 앞서 끝낸 사슬 하나마다 이후 사슬의 점수 ×(1 + momentum × 앞서 끝낸 사슬 수)(chain.js finish —
//             풀이기 · 봇 · 짜임 재기가 같은 셈을 본다)
//   C 끝까지  목표를 넘겨도 수를 다 쓸 때까지 둔다(체크메이트는 곧바로 이김). 남은 수 상금은 없고 넘친 목표 덤은 overflow 표로
export const PACE = {
  mode: null,
  curve: 1,
  kindMult: { practice: 1, official: 1.5 },
  moves: 4,
  momentum: 0.5,
  overflow: { 2: 1, 5: 2, 10: 4 },
};
// 기세 배율: 이 사슬 앞에 끝낸 사슬 수 n(대국의 movesUsed)
export const momentumMult = (t) => (PACE.mode === 'B' && t.movesUsed > 0 ? 1 + PACE.momentum * t.movesUsed : 1);
export const playToEnd = () => PACE.mode === 'C';
