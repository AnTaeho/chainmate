# 순위 (CHM-70)

「오늘의 대국」으로 매기는 하루 순위. 이 문서는 서버 쪽(줄 세우기 · 조작 막기 · API · DB · 한도 · 개인정보)을 적는다. 화면 시안은 `docs/shots/leaderboard/`.

- 서버 함수: `api/`(Vercel Functions, Node, ESM). 로직은 `api/_lib/` — `verify.js`(다시 두기) · `rank.js`(줄 세우기) · `service.js`(요청 → 응답) · `store.js`(SQL) · `http.js`(출처 · JSON · 오류).
- 오늘의 대국 판 만들기: `src/sim/daily.js` `createDailyRun(date)` — 화면(`src/ui/app.js`)과 서버가 같은 함수를 쓴다.
- 이름 목록: `src/data/names.js`. DB: Neon Postgres(`db/schema.sql`, `node tools/db-migrate.mjs`).
- 게임 자체는 여전히 빌드 · 의존성 없이 돈다. npm 패키지(`@neondatabase/serverless`)는 `api/`만 쓴다.

## 줄 세우기
매일 모두가 같은 판을 둔다: 시드 `dailySeed(날짜)` · 스탠다드 오프닝 · 단 0.

1. 닿은 관(`ante`) — 클수록 위
2. 대국 번호(`blind`: 0 연습 · 1 정식 · 2 마스터전)
3. 이겼는지(`won`) — 8관 마스터전 승리가 맨 위
4. 판 전체에서 낸 점수의 합(`score_total`: 둔 대국마다 낸 점수를 모두 더한다. 8관 마스터전을 다시 두었으면 그 대국들도)
5. 같으면 먼저 낸 사람(`submitted_at`), 그래도 같으면 `player_id`

- 한 사람은 하루에 가장 좋은 기록 하나만 오른다. 여러 번 두어도 되고, 더 좋은 판만 갈아 끼운다(같은 성적을 다시 내면 그대로 — 먼저 낸 시각이 남는다).
- 이긴 뒤 「계속 두기」(끝없는 대국)는 순위에 넣지 않는다. 8관 우승까지만 센다.
- 코드: `api/_lib/rank.js` `rankKey` · `compareRank` · `better`, SQL은 `api/_lib/store.js`의 `ORDER`(같은 차례).
- 기기에 남는 오늘의 대국 기록(`records.daily.score` = 관 × 10 + 대국 + 이기면 100)은 이것과 다른 옛 셈이다. 순위 화면은 서버가 준 값을 쓴다.

## 조작 막기: 서버가 다시 둔다
클라이언트가 말한 점수는 받지 않는다. 받는 것은 그 판에 넣은 **명령 줄**뿐이다.

- 오늘의 대국 판은 시작부터 `applyRun`이 성공한 명령을 `run.cmds`에 차례대로 남긴다(`src/sim/run.js` `applyRun` 끝 — `run.cmds`가 있는 판만). 거절된 명령 · 미리 보기 · 화면 전용 동작은 남지 않는다. 8관 우승 뒤(끝없는 대국)의 명령도 남기지 않는다.
- 보통 판 · 하네스 판에는 `run.cmds`가 없어 아무것도 달라지지 않는다(판 하네스 dump가 그대로).
- 옛 저장(이 기록이 없는 진행 중 오늘의 대국 판)에는 `run.cmds`가 없다. 그런 판은 제출하지 않는다.
- 크기: 봇 판 기준 명령 170~350개 · JSON 5~10KB. 판 저장(`chainmate.run.v1`)에 함께 들어간다.
- 서버(`api/_lib/verify.js` `verifyDaily(date, cmds)`)는 `createDailyRun(date)`로 같은 판을 만들어 명령을 처음부터 다시 둔다.
  - 명령마다 꼴을 먼저 거른다(`cleanCmd`: 아는 종류 · 아는 칸 · 작은 자연수만). 꼴이 틀리거나 규칙이 거절하면(없는 기물 떨구기 · 돈 없이 사기 …) `bad_cmd`.
  - 8관 우승에 닿으면 거기서 끊는다. 그 뒤의 명령은 보지 않는다.
  - 판이 끝나지 않은 줄(진행 중)은 `unfinished`.
  - 성적(`summarize`): `ante` · `blind` · `won` · `score_total` · `battles`(둔 대국 수) · `moves`(쓴 수의 합) · `ignite`(점화가 난 대국이 몇째인지, 없으면 null).
- 다시 두기 한 번은 봇 판 기준 40~120ms(명령 5000개 한도를 채운 줄도 1초 안). 함수 한도 30초와는 거리가 멀다.
- **규칙(`src/sim` · `src/data`)을 바꾸면 서버의 다시 두기도 같이 바뀐다.** 배포는 정적 파일과 함수가 한 묶음이라 둘이 어긋나지 않는다. 다만 옛 배포를 켜 둔 채 두던 판은 새 배포에서 다르게 풀릴 수 있다 — 그래서 배포 식별자를 견준다(아래 `stale`).
- 맞음의 증명: `test/daily-verify.test.js`(봇이 둔 세 날짜의 판 = 서버 셈, 고친 · 뺀 · 지어낸 명령, 끝없는 대국 끊기, 진행 중 거절), smoke 「순위 확인: 화면 판 = 서버 셈」(화면을 눌러 둔 판의 `run.cmds`를 같은 함수에 넣는다).
- 막지 못하는 것: 사람 대신 프로그램(풀이기)이 두는 것. 명령 줄이 규칙에 맞으면 받아들인다. 상위권은 `daily_logs`의 명령 줄로 다시 살펴볼 수 있다.

## 이름
「~한 ~」 = 형용사 + 동물. 직접 입력은 없고 「다시 짓기」만 있다.

- `src/data/names.js`: 형용사 228 · 동물 235(조합 53,580). 한국어 · 영어가 같은 차례(뜻이 짝)라 이름은 번호 한 쌍 `(a, n)`으로 저장하고 보는 사람의 언어로 보여 준다(`nameText(a, n, lang)`).
- 목록은 뒤에 덧붙이기만 한다. 번호가 저장되므로 차례를 바꾸거나 빼지 않는다.
- 넣지 않는 것: 놀림 · 비하 · 욕설 · 성적 뜻 · 질병 · 정치 · 종교로 읽힐 낱말, 색(사람을 가리키는 말로 읽힐 수 있다), 숫자, 체스 기물과 이 게임의 기물 이름(낙타 · 까마귀 …).
- 길이: 한국어는 「호기심 많은 바다코끼리」(130), 영어는 「Mischievous Hippopotamus」(173)가 가장 넓다(Galmuri11 12px 보통 굵기). `test/names.test.js`가 금칙어 · 중복 · 길이를 잰다.
- 이름은 겹칠 수 있다(같은 이름의 두 사람). 순위표에서 내 줄은 서버가 `me`로 따로 알려 준다.

## 계정 없음: 플레이어 열쇠
- 기기마다 무작위 비밀 하나(256비트, 16진수 64자). 서버가 만들어 한 번 돌려주고, DB에는 SHA-256 해시만 둔다. 비번 · 이메일은 없다.
- 열쇠를 잃으면(브라우저 저장을 지움 · 기기를 바꿈) 새 사람이 된다. 기기 옮기기는 아직 없다.

## API
모두 JSON. 오류는 `{ "error": 코드 }`(500은 `server`뿐 — 내부 메시지를 싣지 않는다). 응답은 `Cache-Control: no-store`.
출처는 같은 출처만 받는다: `Origin`이 없거나 요청 호스트와 같을 때(미리 보기 배포 주소도 자기 호스트면 통과). 그 밖의 출처는 403 `bad_origin`. 앱(Tauri) 출처는 `api/_lib/http.js` `ALLOWED_ORIGINS`에 붙인다.

| 길 | 받는 것 | 주는 것 |
|---|---|---|
| `GET /api/hello` | — | `{ build }` — 배포 식별자(`VERCEL_DEPLOYMENT_ID` → `VERCEL_GIT_COMMIT_SHA` → `'dev'`). 클라이언트는 켤 때 받아 둔다 |
| `POST /api/player` | `{}` | 새 플레이어 `{ key, a, n, rerolls }`(rerolls = 오늘 남은 다시 짓기) |
| | `{ key }` | 지금 이름 `{ key, a, n, rerolls }`. 모르는 열쇠 401 `unknown_key` |
| | `{ key, reroll: true }` | 새 이름(앞의 것과 다르다). 하루 한도를 넘으면 429 `reroll_limit` |
| `POST /api/daily/submit` | `{ key, date, build, cmds }` | `{ ok: true, best, rank, total, improved }` |
| `GET /api/daily/board` | `?date=YYYY-MM-DD&page=N&key=…`(모두 없어도 된다) | `{ date, total, page, pages, rows, me, around }` |

- `best` = `{ ante, blind, won, score, battles, moves, ignite }`(그날 그 사람의 가장 좋은 기록 — 방금 낸 판이 더 나쁘면 앞의 것), `rank` = 그 기록의 등수, `total` = 그날 오른 사람 수, `improved` = 방금 낸 판으로 갈아 끼웠나.
- `rows` · `around` · `me`의 한 줄 = `{ rank, a, n, ante, blind, won, score }`(score = 점수 합). 한 쪽은 10줄. `me`는 key의 그날 줄(없으면 null), `around`는 내 줄과 위아래 둘씩(내 줄 포함, 등수 차례). key가 없거나 모르는 열쇠면 구경(`me: null`, `around: []`).
- `date`의 기본은 서버 날짜(UTC). 화면은 자기 달력의 오늘 · 어제를 준다. 옛 날짜도 주면 준다(내일보다 뒤는 400 `bad_date`).

### 제출의 처리 차례
1. 꼴(열쇠 64자 16진수 · build 글 · cmds 배열) — 400 `bad_request`. 명령이 5000개를 넘으면 413 `too_many_cmds`
2. 열쇠 — 401 `unknown_key`
3. `build`가 서버와 다르면 409 `{ error: 'stale', stale: true, build }` — 판을 두는 사이 새로 배포됐다. 규칙이 다를 수 있어 다시 두지 않는다(화면은 새로 고침을 권한다)
4. `date`가 서버 날짜(UTC) ±1일 밖이면 422 `bad_date`(±1일은 시간대 — 그 사람의 「오늘」)
5. 하루 제출 한도 — 429 `submit_limit`(여기서 한 번을 센다. 조작한 줄도 센다)
6. 다시 두기 — 422 `bad_cmd`(+ `at`: 몇째 명령) · `unfinished`
7. 그날 기록보다 좋으면 갈아 끼우고 명령 줄을 남긴다

## 한도
| 무엇 | 값 | 어디 |
|---|---|---|
| 요청 본문 | 256KB(넘으면 413 `too_large`) | `service.js` `LIMITS.body` |
| 명령 수 | 5000 | `verify.js` `LIMITS.cmds` |
| 제출 | 플레이어당 하루(UTC) 30번 | `LIMITS.submits`, `players.submits_day` |
| 다시 짓기 | 플레이어당 하루(UTC) 20번 | `LIMITS.rerolls`, `players.rerolls_day` |
| 순위표 한 쪽 | 10줄 · 내 위아래 2줄씩 | `LIMITS.page` · `LIMITS.around` |
| 함수 | 리전 iad1(DB us-east-1과 같은 곳) · 최대 30초 | `vercel.json` |

플레이어 만들기에는 한도가 없다(IP를 남기지 않아 사람마다 셀 수 없다). 마구 만들면 다시 두기가 그만큼 돈다 — 문제가 되면 Vercel 방화벽의 요청 수 제한을 `/api/`에 건다.

## DB
`db/schema.sql`, 적용은 `node tools/db-migrate.mjs`(`.env.local`의 `DATABASE_URL_UNPOOLED`, 여러 번 돌려도 같다). 함수는 `DATABASE_URL`(풀)을 `@neondatabase/serverless`의 HTTP 질의로 쓴다. 주고받는 트랜잭션이 없어 한도 세기 · 기록 갈아 끼우기는 조건을 단 한 문장으로 한다.

- `players(id, key_hash unique, a, n, created_at, rerolls_day, rerolls_date, submits_day, submits_date, test)`
- `daily_scores(player_id → players, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at, primary key(player_id, date))` + 인덱스 `daily_scores_rank(date, ante desc, blind desc, won desc, score_total desc, submitted_at, player_id)`
- `daily_logs(player_id → players, date, cmds text, primary key(player_id, date))` — 그날 가장 좋은 기록의 명령 줄만(JSON 글, 우승 뒤 명령은 잘라 낸 것). 모든 제출의 원문은 남기지 않는다.
- 플레이어를 지우면 성적 · 명령 줄도 같이 지워진다(cascade).
- 미리 보기 배포도 프로덕션과 **같은 DB**를 쓴다.

## 개인정보
저장하는 것은 셋뿐이다: **무작위 열쇠의 해시 · 이름 번호 한 쌍 · 그날 성적**(과 가장 좋은 판의 명령 줄, 하루 한도를 세는 수).

- IP · UA · 기기 정보 · 주소는 읽지도 남기지도 않는다. 이름은 목록에서 뽑은 낱말이라 사람이 쓴 글이 들어가지 않는다.
- 열쇠 원문은 그 기기의 저장에만 있다. 서버 기록(함수 로그)에도 찍지 않는다.
- 기록 보내기(`telemetry.md`)의 익명 ID와 플레이어 열쇠는 서로 다른 값이고 잇지 않는다.

## 확인하는 법
- `npm test` — `test/names.test.js` · `test/daily-verify.test.js` · `test/leaderboard.test.js`(DB는 기억 저장소 `test/helpers/memstore.js`).
- `npm run smoke` — 「순위 확인: 화면 판 = 서버 셈」.
- `node tools/daily-e2e.mjs <주소> [--vercel]` — 진짜 DB까지: 플레이어 만들기 → 봇이 둔 오늘의 대국 제출 → 순위 → 같은 줄 다시 → 조작 거절 → 다시 짓기 → 쪽 넘김. 만든 플레이어는 `test` 표시를 하고 끝나면 지운다(`--cleanup`은 지우기만). 로컬은 `vercel dev --listen 3210` 뒤 `node tools/daily-e2e.mjs http://localhost:3210`, 배포 보호가 걸린 미리 보기 배포는 `--vercel`(`vercel curl`).

## 버린 안
- 점수만 받아 적기: 누구나 지어 보낼 수 있다.
- 명령 줄을 모두 남기기: 하루 수천 판 × 10KB. 가장 좋은 판 하나만 남긴다.
- 이름 직접 입력: 욕설 · 사칭 거르기가 따라온다. 목록에서 뽑는다.
- IP로 한도 세기: IP를 남기지 않는다는 방침과 부딪힌다.
