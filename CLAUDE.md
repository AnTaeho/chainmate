# 체인메이트 작업 규칙

체스 기물 로그라이크 퍼즐. 작업 전에 `docs/DESIGN.md`(규칙 · 수치 · 구조)와 `docs/HOOKS.md`(도파민 설계)를 읽는다. 화면 원형은 `docs/mockup.html`, 지금까지 한 일은 `docs/history.md`.

## 뿌리
> **잡으면 그 기물로 바뀌고, 바뀐 기물로 또 잡는다.** 점수 = 값 × 배수.

- 새 장치마다 묻는다: ① 놓기 · 잡기 · 갈아입기 · 응수/끊김 · 프로모션 · 체크메이트 중 하나를 키우거나 비트는가? ② DESIGN.md 「세계의 말」로 설명되는가? 둘 다 아니면 버리거나 모양을 바꾼다.
- 게임 아이디어는 아이디어 볼트에 두지 않고 `docs/ideas/`에 둔다.

## 구조
- 게임(`src/` · `index.html`)은 바닐라 JS ES 모듈, 빌드 · npm 의존성 없음. 로컬은 `npm run serve`(`python3 -m http.server`는 연결 대기열 5라 모듈을 받다 끊긴다).
- npm 패키지는 순위 서버 함수 `api/`(Vercel Functions)만 쓴다. `src/`는 npm을 import하지 않고, `api/`는 `tools/` · `test/`에 기대지 않는다(배포에서 빠진다).
- 데스크톱 포장(Tauri 2)은 `desktop/` 안에만. 게임 파일은 `desktop/collect.sh`가 모은다.
- `src/sim/` · `src/data/`는 DOM · canvas 금지(Node에서 돈다). 무작위는 시드 rng, 상태는 JSON 왕복 안전.
- 상태 변경은 명령 객체로만(`apply`, `applyRun`). 봇 · 화면 · 순위 서버가 같은 명령을 쓴다.
- 격언 · 기보 · 각인 · 마스터는 `scoring.js` `defineModifier` 훅으로. 규칙 코드에 id별 분기를 박지 않는다.
- 검증: `npm test` · `npm run smoke` · 그리기를 바꿨으면 `node tools/drawcheck.mjs`(어김 0). 대국 하네스 `node tools/sim.mjs --battles 300 --seed 1`, 판 하네스 `node tools/run.mjs --runs 300 --policy smart|random|none --seed 1 --workers 10 --limit 400`(전후 비교는 둘 다 `--dump`, 걸리는 시간은 `docs/reports/perf.md`).

## 화면 글
- 낱말 · 목소리 기준은 `docs/design-notes/voice.md`와 `src/ui/glossary.js` `TERMS`. 말끝: 안내 · 알림 「~해요」, 킹 말풍선 반말, 효과 글 · 정의 「~다」, 단추 · 이름표 명사형.
- 효과는 카드에 늘 적는다. 「조건: 효과」 한 줄, 시너지 · 특수 기물 · 드문 낱말만 카드 옆 낱말 상자로 풀고, 시너지 상자 풀이는 「~할수록 점수가 커진다」 한 줄. 값 · 배수는 대국 칸 빛깔의 작은 칸으로 「값 +20」 · 「배수 ×1.5」(`glossary.js` richText).
- 낱말: 잡다(먹다 ×) · 콤보(사슬 ×, 코드 이름 `chain`은 그대로) · 곧게 가다(미끄러지다 ×). 체스 개념은 체스 말(`docs/design-notes/chess-terms.md`). 만든 쪽 용어(엔진 · 시뮬 · 스폰 · 틱 · 버프 · 트리거) · 「단계」 · 「티어」는 화면에 쓰지 않는다. 「팩」 · 「리롤」은 화면 낱말이다.
- 흐름 중간 설명은 처음 만나는 순간 한 줄(`src/ui/coach.js` `hint`)로만. 말하는 것이 그 순간 화면에 있을 때만 부른다.
- 레이아웃은 `docs/design-notes/layout.md`. 글을 「…」로 자르거나 낱말 가운데서 끊지 않는다(smoke 「잘린 글」, 의도한 잘림만 `tools/smoke.mjs` `CLIP_OK`).

## git · 배포
- 커밋 갈래에 「수치 조정」도 있다. 올라간 커밋은 amend · force-push 하지 않는다.
- **main 푸시 = 프로덕션 배포**(chainmate.papercut.kr, 화면 · 규칙 · `api/` 한 묶음). 사용자가 「올려」라고 한 뒤에만 모아서 푸시하고, 뒤에 `tools/daily-e2e.mjs` · `link-e2e.mjs` · `account-e2e.mjs`를 프로덕션 주소로 돌린다. 배포 순간 두던 오늘의 대국은 409 `stale`로 순위에 못 오른다. 옛 판본에서 시작한 판을 새로 켜 이어 두거나 대기열에서 다시 보내면 새 판본 식별자가 실려, 규칙이 바뀌었으면 422 `bad_cmd`로 조용히 버려진다.
- 배포 빌드 `node tools/stamp.mjs`가 `dist/`를 만들고 `src/` · `style.css` 주소에 판본을 붙인다. 루트에 새 정적 파일을 두면 `STATIC`에도 넣는다. 미리 보기 배포도 프로덕션과 같은 DB를 쓴다.

## 일하는 방식
- 명세와 부딪혀 플레이에 영향이 있는 선택은 우회하지 말고 멈춰서 선택지와 하네스 수치를 보고한다.
- 수치를 바꾸면 하네스 원문 출력으로 근거를 남긴다. 설계가 바뀌면 DESIGN.md · HOOKS.md도 문서 갈래로 고친다.
- 포장 · 출시(iOS · 맥 서명 · 스팀)는 사람이 다시 말하기 전까지 하지 않는다. 지시서에도 시뮬레이터 확인 · `desktop/` 수정을 넣지 않는다.

## 바꿀 때 같이 볼 곳
- 판 봇은 돈 · 시계에 아주 민감하다. 새 보상은 하네스로 재고 넣는다. 판 조정(거르기 · 다시 놓기)은 `src/sim/tuning.js` 한 곳. 희생 규칙 · 격언을 바꾸면 `tools/bot.mjs` `sacrificeChoice`도.
- 한 수 연출 ×1은 멈칫(hit-stop)까지 더해 4초 안(smoke가 잰다, 지금 최대 3.9초 안팎 — 멈칫 예산은 `battle.js` `STOP`).
- 화면은 대국 상태를 이벤트 뒤에 다시 읽는다(`redrop` · `refill`). 미리 보기는 `previewCapture` · `previewDrop`(풀이기 복사본)으로만 잰다.
- 튜토리얼(타이틀 「튜토리얼」 · 처음 켬 덮개, `docs/design-notes/tutorial.md`) 수업의 판을 바꾸면 `test/lessons.test.js`가 실제 규칙으로 잰다. 수업이 가르치는 도움말 팁은 `coach.js` `TAUGHT`에 묶는다(그 수업을 끝낸 사람에게 판 안에서 안 뜬다). 판은 대본 없이 시작한다. 세력은 대국 규칙 깃발로만 규칙에 닿는다(`src/data/factions.js`).
- 그릴 때만 그린다(layout.md 9절): 스스로 안 움직이는 새 화면만 `animating() { return false; }`, 시간 따라 바뀌는 그림은 그리는 순간 `live()`(계단처럼 바뀌면 `beat(app.time, …)`), 입력 없이 바뀐 상태는 `app.invalidate()`.
- 해금: 뽑거나 만드는 자리는 `src/sim/unlock.js` `openPool`(대국은 `openTypes`)을 거친다. 새 물건은 `src/data/unlocks.js` `UNLOCK_TIERS`에. 단계는 `records.unlockTier`에 따로 둔다. 판을 만드는 화면 길은 `app.newRun` 하나, 오늘의 대국에는 단계를 넘기지 않는다.
- 기록(`app.records`)에 칸을 더하면 `src/ui/merge.js` `RULES`에도(이 기기에만 둘 칸은 `LOCAL_ONLY`).
- 판 하네스 열쇠를 바꾸면 `src/sim/runlog.js` `runRow`와 `tools/run.mjs` `one()` 둘 다. 규칙 사건이나 `runRow`를 바꾸면 `src/ui/telemetry.js` 표와 `docs/design-notes/telemetry.md`도.
- 순위 서버(`api/_lib/verify.js`)는 오늘의 대국 명령 줄을 같은 규칙으로 다시 둔다. sim 규칙 · 판 만들기 · 명령 꼴을 바꾸면 서버도 바뀌고, 새 명령 종류 · 칸은 `SHAPES`에. 서버 응답 꼴을 바꾸면 `src/ui/rank.js`도.
- 기록 보내기 · 순위 · 클라우드 맞추기는 배포 주소 · 앱에서만 나가고 로컬 · smoke는 0건. 순위 화면을 로컬에서 보려면 `boot({ rankBase })`(가짜 서버 `test/helpers/fakeapi.js`).
- 계정 · 열쇠: 글자 입력 칸은 `src/ui/textfield.js`로만(그릴 때마다 부르고, 화면을 떠난 뒤 `<input>` 0). 입력 칸에 초점이 있으면 게임은 키를 받지 않는다(`main.js` keydown). 열쇠는 `Authorization` 머리말로만 보내고, 열쇠가 드는 부름은 `src/ui/rank.js` 안에만 둔다. 아이디 · 비번 · 열쇠는 로그 · 기록 보내기 · 오류 답에 싣지 않는다. 나가기 · 지우기는 서버가 새 열쇠를 준 뒤에 기기를 비운다. 플레이어를 지우는 길(`store.absorb`)은 계정이 붙어 있는지 먼저 본다. 모으는 것이 바뀌면 `privacy.html`도.
- 하이라이트 카드는 화면과 내보낸 그림이 같은 그리기다(움직이는 것 금지). 받기 · 공유 앞에 await를 두지 않는다.
- 진짜 DB를 건드리는 도구의 시험 자료는 `cleanupTests`(`tools/db-migrate.mjs`)로 지운다. 옛 칸 `players.key_hash`는 사용자가 `node tools/db-migrate.mjs --drop-old-key`를 돌리면 끝난다(leaderboard.md).

## 다음
1. 사람 판으로 한 번: 처음 10분 · 미리 보기 · 소리 · 마스터 세기(`docs/history.md` 「남은 것」).
2. 마스터 통과율과 판 승률 맞추기.
3. 영어 글 다듬기.
