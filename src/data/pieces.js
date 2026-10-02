// 기물 종류. 규칙 코드는 id만 보고 동작한다.
// 체스 여섯(P N B R Q K)과 이형 열(깊이 A · CHM-55). 이형 id는 한 글자(사슬 요약 caps가 글자 줄이라):
//   Z 아마존(퀸+나이트) · L 낙타(3,1 도약) · O 포(하나를 넘어 그 너머 첫 기물) · S 궁수(두 칸 떨어진 고리를 제자리에서) · W 유령(가로 · 세로 막힘 무시)
//   T 꺾쇠(룩처럼 가다 한 번 직각으로 꺾음) · E 물수제비(비숍처럼 가다 가장자리에서 한 번 튕김) · V 까마귀(대각으로 붙은 적을 넘어 너머 빈칸에 앉음)
//   M 광대(적을 그 적의 행마로만) · D 화약병(킹처럼 한 칸, 먹으면 둘레 적도 터지고 사슬 끝)
// 뺀 기물(CHM-55): A 대주교 · C 재상 · H 야간기사 · G 메뚜기 — 옛 저장은 OLD_PIECE로 바꿔 읽는다(src/sim/oldsave.js)
// chart: 이 모습으로 먹을 때 따르는 기보(이형은 바탕이 된 체스 모습). families: 가족(깊이 B). fairy: 이형.
export const PIECES = {
  P: { id: 'P', value: 10, name: '폰', chart: 'P', families: ['march'] },
  N: { id: 'N', value: 30, name: '나이트', chart: 'N', families: ['leap'] },
  B: { id: 'B', value: 30, name: '비숍', chart: 'B', families: ['diag'] },
  R: { id: 'R', value: 50, name: '룩', chart: 'R', families: ['line'] },
  Q: { id: 'Q', value: 90, name: '퀸', chart: 'Q', families: ['crown'] },
  K: { id: 'K', value: 150, name: '킹', chart: null, families: [] },
  Z: { id: 'Z', value: 120, name: '아마존', chart: 'Q', families: ['crown', 'leap'], fairy: true },
  L: { id: 'L', value: 30, name: '낙타', chart: 'N', families: ['leap'], fairy: true },
  O: { id: 'O', value: 50, name: '포', chart: 'R', families: ['line'], fairy: true },
  S: { id: 'S', value: 40, name: '궁수', chart: 'P', families: ['hunt', 'march'], fairy: true },
  W: { id: 'W', value: 60, name: '유령', chart: 'R', families: ['line', 'change'], fairy: true },
  T: { id: 'T', value: 60, name: '꺾쇠', chart: 'R', families: ['line'], fairy: true },
  E: { id: 'E', value: 40, name: '물수제비', chart: 'B', families: ['diag'], fairy: true },
  V: { id: 'V', value: 40, name: '까마귀', chart: 'B', families: ['diag', 'leap'], fairy: true },
  M: { id: 'M', value: 50, name: '광대', chart: 'N', families: ['change'], fairy: true },
  D: { id: 'D', value: 40, name: '화약병', chart: 'P', families: ['hunt'], fairy: true },
  // 판 위 사물(깊이 F): 벽은 먹을 수 없고 아무도 지키지 않으며 미끄러짐을 막는다(포의 받침은 된다).
  // 보석은 먹을 수 있지만 모습이 바뀌지 않고 상금 +2, 아무도 지키지 않는다.
  X: { id: 'X', value: 0, name: '벽', chart: null, families: [], thing: true },
  J: { id: 'J', value: 20, name: '보석', chart: null, families: [], thing: true },
};
export const TYPES = ['P', 'N', 'B', 'R', 'Q', 'K'];
export const FAIRIES = ['Z', 'L', 'O', 'S', 'W', 'T', 'E', 'V', 'M', 'D'];
// 옛 저장의 뺀 기물 → 바꿔 읽을 기물(CHM-55)
export const OLD_PIECE = { A: 'E', C: 'T', H: 'L', G: 'V' };
export const valueOf = (t) => PIECES[t].value;
export const isFairy = (t) => !!(PIECES[t] && PIECES[t].fairy);
export const isThing = (t) => !!(PIECES[t] && PIECES[t].thing);
// 먹을 때 따르는 기보의 모습(기보가 없는 킹은 null)
export const chartForm = (t) => (PIECES[t] ? PIECES[t].chart : null);
