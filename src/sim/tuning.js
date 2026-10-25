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

// 외통 조건(docs/reports/mate.md). guardLimit: 한 콤보에서 킹을 지키던 적을 이만큼 넘게 잡았으면 그 콤보로는 킹을 못 잡는다(Infinity = 옛 규칙).
//   하네스는 --tune '{"mate":{"guardLimit":…}}'(run.mjs) · --mate '{…}'(sim.mjs)로 바꿔 잰다.
export const MATE = { guardLimit: 1 };
// 이 콤보로는 킹을 못 잡나(규칙 chain.js chainCaptures · 화면 표시가 같이 쓴다)
export const mateBlocked = (c) => !!c && !c.done && c.guardsTaken > MATE.guardLimit;

// 대국 도전(src/data/challenges.js, 보고서 docs/reports/goty.md). on: 끄면 도전이 붙지 않는다(옛 판과 같은 판) ·
// kinds: 도전이 붙는 대국 종류(마스터전은 마스터 규칙이 그 자리를 쓴다) · reward: 이루면 대국이 끝날 때 받는 상금
export const CHALLENGE = { on: true, kinds: ['practice', 'official'], reward: 2 };
// 숙적(보고서 docs/reports/goty.md). 내 콤보를 끊은 적이 판의 숙적이 되어 뒤 대국에 표시를 달고 다시 나온다.
//   on: 끄면 숙적이 생기지 않는다(옛 판과 같은 판) · max: 또 끊으면 오르는 단의 끝 · traits: 단마다 붙는 특성(방패 · 파수꾼, src/data/traits.js) ·
//   bounty: 단마다 잡으면 받는 상금(대국을 이기면 함께 받는다)
// 꺼 둔다: 판 승률을 현상금만큼(+2.7%p, 300판) 올릴 뿐 숙적이 선 대국과 안 선 대국의 승률이 같았다(87.1 · 86.0%) — docs/reports/goty.md
export const NEMESIS = { on: false, max: 3, traits: ['shield', 'fort', 'fort'], bounty: [1, 2, 3] };
