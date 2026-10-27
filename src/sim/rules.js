// 규칙 판본(오늘의 대국 순위 — docs/design-notes/leaderboard.md 「규칙 판본」): 판 규칙(src/sim · src/data · api/_lib/verify.js)이 바뀔 때만 올린다.
// 오늘의 대국 판은 시작할 때 이 값을 적고(run.rulesVersion), 낼 때 싣는다. 서버는 자기 값과 같을 때만 다시 두고, 다르면 409 stale.
// 배포 식별자(배포마다 바뀐다)에 묶여 있을 때는 글 · 화면만 바꾼 배포도 두던 판을 모두 stale로 만들었다(C-1 · P-9).
// test/rules.test.js가 규칙 파일 내용의 해시를 test/fixtures/rules-hash.json과 견준다 — 규칙 파일을 바꿨으면 이 값을 올리고
// `node tools/rules-hash.mjs --write`로 해시를 고친다.
export const RULES_VERSION = 6;
