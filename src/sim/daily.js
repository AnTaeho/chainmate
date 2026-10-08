// 오늘의 대국(순위, CHM-70 — docs/design-notes/leaderboard.md): 날짜 → 시드 → 판. 화면(src/ui/app.js)과 서버(api/_lib/verify.js)가
// 같은 함수로 판을 만든다 — 서버는 화면이 남긴 명령(run.cmds)을 이 판에 처음부터 다시 두어 성적을 스스로 셈한다.
// 판 만들기(오프닝 · 단 · 시드)나 규칙(src/sim)을 바꾸면 서버의 다시 두기도 같이 바뀐다 — 배포는 정적 파일과 함수가 한 묶음이다.
import { createRun } from './run.js';

export const DAILY = { opening: 'standard', dan: 0 };

// 날짜(YYYY-MM-DD) → 시드. 같은 날엔 모두 같은 판.
export function dailySeed(date) {
  let h = 0x811c9dc5;
  const s = `chainmate:${date}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 2147483646 + 1;
}

// 오늘의 대국 판. run.cmds: 이 판에 넣은 명령을 차례대로(applyRun이 성공한 명령만 덧붙인다 — 8관 우승 뒤 끝없는 대국은 빼고).
// 옛 저장(cmds 없는 진행 중 daily 판)에는 이 배열이 없어 순위에 내지 않는다.
export function createDailyRun(date) {
  const run = createRun({ seed: dailySeed(date), ...DAILY });
  run.daily = date;
  run.cmds = [];
  return run;
}
