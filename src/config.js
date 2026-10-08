// 바깥과 닿는 값. 기록 보내기(CHM-63, docs/design-notes/telemetry.md)가 쓴다.
// key는 웹에 그대로 싣는 PostHog 프로젝트 공개 키(쓰기만 된다). 읽는 개인 키는 저장소에 두지 않는다.
export const POSTHOG = {
  key: 'phc_tGHNKJ8iTtae8R9gsH7MWmN7zbzjDBszreTBXs5mgXui',
  host: 'https://us.i.posthog.com',
};
// 기록을 보내는 웹 주소(이 밖의 호스트 — localhost · 미리 보기 배포 — 에서는 한 건도 보내지 않는다). 앱(Tauri)은 platform으로 안다
export const TELEMETRY_HOSTS = ['chainmate.papercut.kr'];
// 순위(CHM-70, docs/design-notes/leaderboard.md)를 부르는 웹 주소. 이 밖의 호스트(localhost · 미리 보기 배포)에서는 /api를 한 번도 부르지 않는다.
// 웹은 같은 출처(/api/…)를, 앱(Tauri)은 RANK_APP_BASE를 부른다
export const RANK_HOSTS = ['chainmate.papercut.kr'];
export const RANK_APP_BASE = 'https://chainmate.papercut.kr';
