# 순위 (CHM-70)

「오늘의 대국」으로 매기는 하루 순위. 서버 쪽(줄 세우기 · 조작 막기 · API · DB · 한도 · 개인정보)과 화면 쪽(끝의 「화면」 절 — 주고받는 모듈 · 상태 · 저장 열쇠 · 대기열)을 적는다. 화면의 자리 · 칸 폭은 `layout.md` 22절, 시안 · 스크린샷은 `docs/shots/leaderboard/`.

- 서버 함수: `api/`(Vercel Functions, Node, ESM). 로직은 `api/_lib/` — `verify.js`(다시 두기) · `rank.js`(줄 세우기) · `service.js`(요청 → 응답) · `store.js`(SQL) · `http.js`(출처 · JSON · 오류).
- 오늘의 대국 판 만들기: `src/sim/daily.js` `createDailyRun(date)` — 화면(`src/ui/app.js`)과 서버가 같은 함수를 쓴다.
- 이름 목록: `src/data/names.js`. DB: Neon Postgres(`db/schema.sql`, `node tools/db-migrate.mjs`).
- 화면 쪽: `src/ui/rank.js`(서버와 주고받기 — `createRank`) · `src/ui/screens/rank.js`(순위 화면 · 결과 카드) · `screens/settings.js`(이름 줄) · `screens/title.js`(「순위」 칸).
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
- 열쇠를 잃으면(브라우저 저장을 지움) 새 사람이 된다. 다른 기기로는 코드로 잇는다(아래 「기기 잇기 · 클라우드 저장」, CHM-71) — 이어 둔 기기가 없이 열쇠를 잃으면 되찾지 못한다(아이디 · 비번 계정은 CHM-72).

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

- `players(id, key_hash unique, a, n, created_at, rerolls_day, rerolls_date, submits_day, submits_date, test)` — `key_hash`는 옛 칸이다(열쇠 찾기는 `player_keys` — 아래 「기기 잇기 · 클라우드 저장」 DB)
- `daily_scores(player_id → players, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at, primary key(player_id, date))` + 인덱스 `daily_scores_rank(date, ante desc, blind desc, won desc, score_total desc, submitted_at, player_id)`
- `daily_logs(player_id → players, date, cmds text, primary key(player_id, date))` — 그날 가장 좋은 기록의 명령 줄만(JSON 글, 우승 뒤 명령은 잘라 낸 것). 모든 제출의 원문은 남기지 않는다.
- 플레이어를 지우면 성적 · 명령 줄도 같이 지워진다(cascade).
- 미리 보기 배포도 프로덕션과 **같은 DB**를 쓴다.

## 개인정보
저장하는 것: **무작위 열쇠의 해시 · 이름 번호 한 쌍 · 그날 성적**(과 가장 좋은 판의 명령 줄, 하루 한도를 세는 수), 그리고 CHM-71부터 **그 사람의 저장 한 덩이**(기록 · 도감 · 해금 · 진행 중인 판 · 설정 세 칸 — 아래 「무엇을 저장하나」)와 옮기기 코드의 해시(10분).

- IP · UA · 기기 정보 · 주소는 읽지도 남기지도 않는다. 이름은 목록에서 뽑은 낱말이라 사람이 쓴 글이 들어가지 않는다.
- 열쇠 원문은 그 기기의 저장에만 있다. 서버 기록(함수 로그)에도 찍지 않는다.
- 기록 보내기(`telemetry.md`)의 익명 ID와 플레이어 열쇠는 서로 다른 값이고 잇지 않는다.

## 화면
정한 안(2026-10-08, 시안 `docs/shots/leaderboard/draft*` · `nick-*`): **1 전용 순위 화면 + 2 결과 화면 카드**, 이름은 **(나) 다시 짓기만**. 버린 안: 3 기록 화면의 탭(기록은 내 것, 순위는 남의 것이라 한 화면에 섞인다) · (가) 이름 직접 입력(위 「버린 안」).

### 주고받는 쪽(`src/ui/rank.js`)
`createRank({ fetch, storage, today, lang, base, host, platform, webdriver })`를 `main.js`가 만들어 `createApp({ rank })`로 넘긴다(기록 보내기와 같은 꼴 — DOM을 모르고, 시험은 가짜 `fetch`를 넘긴다). 화면은 서버를 직접 부르지 않고 여기의 「지금 아는 것」만 읽는다.

- **부르는 조건**: 호스트가 `chainmate.papercut.kr`(`src/config.js` `RANK_HOSTS`)이거나 앱(Tauri)이고, `navigator.webdriver`가 아닐 때. 그 밖(로컬 `python3 -m http.server` · 미리 보기 배포 · 자동화 브라우저)에서는 `/api`를 **한 번도** 부르지 않고 저장에도 아무것도 쓰지 않는다 — 화면은 「순위에 닿지 못했다」 한 줄(오류 팝업 없음).
- 설정 「기록 보내기」와는 상관없다. 순위는 오늘의 대국을 둔 사람이 스스로 올리는 것이라 그 스위치로 막지 않는다.
- `base`: **도구 전용**. 연기 시험 · 스크린샷 · 진짜 서버 확인이 `boot({ rankBase })`로 주소 머리를 넘기면 호스트 · webdriver 조건을 보지 않는다. 게임은 주지 않는다(주소창 · 저장으로 켜는 뒷문은 없다). 웹은 같은 출처(`/api/…`), 앱은 `RANK_APP_BASE`를 부른다.
- 켤 때(`rank.open()`): `GET /api/hello`로 배포 식별자를 받아 둔다. 실패해도 조용히 넘어가고, 낼 때 다시 받는다. 대기열이 있으면 한 번 더 보낸다.
- 닿지 못한 것으로 보는 답: `fetch`가 거절 · 5xx · JSON이 아닌 답(다른 서버의 404 쪽).

### 저장 열쇠(localStorage)
| 열쇠 | 값 | 언제 |
|---|---|---|
| `chainmate.player.v1` | `{ key, a, n }` — 플레이어 열쇠 원문과 이름 번호 | **처음 필요할 때** 만든다: 판을 처음 두어 저장을 올릴 때(CHM-71) · 오늘의 대국을 끝냈을 때 · 순위 화면을 열 때(`POST /api/player {}`). 코드를 넣으면 받은 새 열쇠로 갈아탄다. 켠 뒤 처음 쓸 때 한 번 `{ key }`로 물어 이름 · 남은 다시 짓기를 맞추고, 401 `unknown_key`면 새로 만든다 |
| `chainmate.rankq.v1` | `{ date, cmds }` — 못 보낸 판 하나 | 아래 대기열 |

열쇠는 화면 · 콘솔 · 기록 보내기 어디에도 싣지 않는다(`rank.player()`는 이름과 남은 횟수만 준다 — `test/rank.test.js`). 저장을 지우면 새 사람이 된다.

### 제출
오늘의 대국 판이 끝나는 명령(`app.cmd` — 국면이 `won` · `lost`로 바뀐 그 자리, 끝난 판의 저장을 지우기 전)에서 `app.submitDaily(run)`이 `run.cmds`를 복사해 `POST /api/daily/submit { key, date: run.daily, build, cmds }`로 낸다.

- 내지 않는 판: 수업 · 대본 대국 · scratch(`app.cmd`가 세지 않는다) · 옛 저장(`run.cmds` 없음) · 보통 판 · 이긴 뒤 끝없는 대국의 끝(우승에서 이미 냈다).

| 답 | 화면 쪽이 하는 일 | `rank.status(date).phase` |
|---|---|---|
| (보내는 중) | — | `pending` |
| 200 | 등수 · 사람 수를 받고, 내 쪽을 한 번 더 읽어 내 줄과 위아래 이웃을 안다(그 쪽은 순위 화면의 캐시가 된다) | `ok` |
| 401 `unknown_key` | 플레이어를 새로 만들어 한 번 더 낸다 | — |
| 409 `stale` | **다시 보내지 않는다.** 이 세션에서는 더 내지 않는다(새로 고치면 다음 판부터 오른다) | `stale` |
| 400 · 413 · 422 · 429 | 조용히 버린다(대기열에도 안 남긴다). 그날 앞서 낸 기록이 있으면 그 등수를 보인다 | `ok`(`sent: false`) 또는 `none` |
| 닿지 못함 | 대기열에 남긴다 | `unreached` |

### 대기열
못 보낸 판 **하나**(`{ date, cmds }`, 새로 못 보내면 덮어쓴다 — 하루에 가장 좋은 기록 하나만 오르니 마지막 판 하나면 된다)를 남겼다가 다음에 켤 때 · 순위 화면을 열 때 한 번 더 보낸다(`rank.retry()`). 그날 것이 아니면(`date` ≠ 오늘) 보내지 않고 버린다. 서버가 답하면(오르든 거절이든) 지운다.

### 조회
`rank.board(date, page)`는 지금 아는 쪽을 곧바로 돌려주고(`loading` · `ok` · `unreached`) 뒤에서 묻는다. 같은 쪽은 30초 동안 다시 묻지 않고(`CACHE_MS`), 닿지 못한 쪽은 5초 뒤에야 다시 묻는다(`RETRY_MS`). 판을 내거나 이름을 다시 지으면 그날 쪽을 버린다. 내 줄을 받으려고 열쇠를 싣는다(없으면 이때 만든다).

### 화면 상태
| 어디 | 상태 | 보이는 것 |
|---|---|---|
| 순위 화면 | 불러오는 중 | 「순위표를 펴는 중」 |
| | 줄 있음 · 내 줄 있음 | 열 줄(내 줄은 금빛 바탕) + 아래 붙박은 내 줄 「14 / 312 이름 · 닿은 곳 · 점수」(누르면 내 쪽) + 쪽 단추 |
| | 오늘 안 둠 | 붙박은 자리에 「오늘은 아직 두지 않았다」 + 금빛 「오늘의 대국 두기」 |
| | 어제 탭 · 안 둠 | 「어제는 두지 않았다」(단추 없음) |
| | 빈 순위표 | 「아직 아무도 두지 않았다」(+ 오늘이면 두기 단추) |
| | 닿지 못함 | 「순위에 닿지 못했다」 한 줄뿐 |
| 결과 카드 | 확인 중(`pending`) | 「확인 중」 + 빈 줄 셋 + 「순위 보기」 |
| | 올랐다(`ok`) | 「오늘 14등 / 312명」 + 내 위아래 이웃 + 「순위 보기」 |
| | 새 배포(`stale`) | 「게임이 새로 나왔다」 / 「새로 고치면 다음 판부터 순위에 오른다」 |
| | 닿지 못함(`unreached`) | 「순위에 닿지 못했다」 한 줄 |
| | 낸 것 없음(`none` — 옛 저장 · 거절) | 카드 없음(예전의 「오늘의 대국 날짜」 줄) |
| 설정 | 열쇠 있음 | 「이름 졸린 수달」 + 주사위 「다시 짓기」. 가리키면 제목 자리에 「오늘 19번 더 지을 수 있다」 |
| | 열쇠 없음 · 닿지 못하는 곳 | 이름 줄 없음 |
| 첫 화면 | 열쇠가 생긴 뒤 처음 | 처음 안내 「이름은 설정에서 다시 지을 수 있다」(설정 칸을 가리킨다, 한 번) |

- 닿은 곳 표기: 이겼으면 「8관 이김」, 아니면 「7관 마스터전」 꼴(`screens/rank.js` `reachText`). 점수는 서버가 준 점수 합.
- 날짜는 화면의 달력(`app.today()`)으로 오늘 · 어제를 정한다. 판의 날짜는 `run.daily`(자정을 넘겨 끝내도 그 날로 낸다 — 서버는 ±1일을 받는다).
- 기록 보내기 사건: `rank_open` · `rank_submit` · `name_reroll`(`telemetry.md` — 이름 · 열쇠 없음).

### 순위를 끄는 스위치는 없다
나가는 것은 무작위 열쇠 · 그 판의 명령 줄뿐이고, 이름은 목록에서 뽑은 낱말이다. 오늘의 대국을 두는 것이 곧 순위에 내는 것이라 따로 끄는 스위치를 두지 않았다(설정 상자도 268/270으로 줄을 더할 자리가 없다). 필요해지면 설정의 이름 줄 자리(「다시 짓기」 왼쪽)에 「순위에 오르기 켬 · 끔」으로 둔다.

## 기기 잇기 · 클라우드 저장 (CHM-71)
계정 없이 **코드로 두 기기를 한 플레이어로 잇고**, 플레이어마다 **저장 한 덩이**를 서버에 둔다. 아이디 · 비번 계정은 다음 카드(CHM-72)다.

- 서버: `api/link/code.js` · `redeem.js` · `devices.js` · `unlink.js` · `api/save.js`(로직은 `api/_lib/service.js` — `linkCode` · `linkRedeem` · `linkDevices` · `linkUnlink` · `saveGet` · `savePut`, SQL은 `store.js`).
- 화면 쪽: `src/ui/merge.js`(합치는 규칙) · `src/ui/cloud.js`(맞추기 — `createCloud`를 `createApp({ cloud })`로) · `src/ui/rank.js`(열쇠가 드는 부름) · `src/ui/screens/link.js`(기기 잇기 화면) · `screens/settings.js`(「기기 잇기」 단추). 화면의 칸은 `layout.md` 23절, 스크린샷은 `docs/shots/link/`.

### 잇기
1. 기기 A가 「코드 받기」 → 서버가 **숫자 여덟 자리**를 준다. 10분 · 한 번만 · 새로 받으면 앞의 코드는 무효. DB에는 코드의 해시(`sha256('link:' + 코드)`)만 둔다.
2. 기기 B가 그 숫자를 넣는다 → 서버는 A의 열쇠 원문을 모른다(해시만 있다). 그래서 **A의 플레이어에 B의 새 열쇠를 붙여** 돌려준다(`player_keys` — 플레이어 하나에 열쇠 여럿). B는 그 뒤로 A와 같은 플레이어다. 이름은 A의 것.
3. B가 가지고 있던 플레이어의 순위 성적은 A로 합친다: 날짜마다 더 좋은 것(`rank.js`의 줄 세우기와 같은 견줌), **낸 시각은 그대로**(같은 성적의 차례가 바뀌지 않는다), 그 명령 줄도 따라온다. B의 플레이어에 이어져 있던 다른 기기의 열쇠도 A로 옮긴다. 그 뒤 B의 옛 플레이어를 지운다(옛 열쇠 · 옛 저장도 같이).
4. B의 화면이 A의 저장을 당겨 와 제 것과 합쳐 올린다(서버는 덩이를 합치지 않는다 — 내용을 읽지 않는다). A는 코드를 띄운 동안 5초마다 기기 수를 물어 이어진 것을 알고 당겨 온다.
- 「이 기기 떼기」: 이 기기의 열쇠만 떼어 새 플레이어로 갈라선다. 이름 · 저장 덩이 사본을 들고 간다. 순위 성적은 남은 쪽에 둔다(순위표에 같은 판이 두 줄이 되지 않게). 혼자인 열쇠는 400 `not_linked`.
- 주고받는 트랜잭션이 없다. 넣기의 차례는 코드 쓰기 → 성적 합치기(한 문장) → 새 열쇠 → 다른 열쇠 옮기기 → 옛 플레이어 지우기. 중간에 끊기면 옛 플레이어가 남을 뿐 잃는 것은 없다. 떼기는 한 문장이다.
- 알려진 가장자리: 넣기의 답이 오는 길에 끊기면 B는 옛 열쇠를 들고 있고 서버는 그 열쇠를 지운 뒤다 → B는 다음에 새 플레이어가 된다(기록은 B의 기기에 그대로 있어 잃지 않는다. 코드를 다시 받아 넣으면 된다).

### 합치는 규칙(`src/ui/merge.js` `mergeRecords`)
순수 함수. 교환 · 결합 법칙이 서고 `merge(a, a) = a`(고른 꼴 기준 — 해금 차례는 레퍼토리 차례로, 옛 평가 열쇠는 별로). `test/merge.test.js`가 무작위 300쌍으로 잰다.

| 칸 | 규칙 |
|---|---|
| `runs` · `wins` · `mates` · `legends` · `brilliants` · `reviews` · `reviewReplays` | 큰 쪽(더하지 않는다 — 같은 판을 두 번 세지 않는다) |
| `grades`(별마다) · `danWins`(단마다) | 열쇠마다 큰 쪽 |
| `bestAnte` · `bestEndless` | 큰 쪽 |
| `bestMove` · `bestBrilliant` | 점수가 큰 쪽(같으면 JSON 글이 큰 쪽 — 어느 쪽을 먼저 주어도 같게) |
| `codex`(격언 · 마스터 · 세력 · 판본 · 혼 · 각성 · 레퍼토리 · 완성한 명경기) | 합집합. `codex.legends`(모은 조각 수)는 큰 쪽 |
| `unlocked.openings` | 합집합(레퍼토리 차례) |
| `unlocked.dan` | 큰 쪽 |
| `coachSeen` · `lessonsSeen` · `movesSeen` | 합집합 |
| `lessonsDone` · `kingDone` | 켜진 쪽 |
| `daily` | 날짜가 늦은 쪽. 같은 날이면 더 좋은 판 + 둔 판 수는 큰 쪽 |
| `runNew`(이번 판에 처음 본 것) | 같은 판이면 합집합, 다른 판이면 글이 큰 쪽 |
| `kingAgain` · `lastOpening` · `lastDan` | **옮기지 않는다**(`LOCAL_ONLY` — 이 기기의 취향). 올릴 때 빼고, 받은 것으로 덮지 않는다 |
| 규칙이 없는 칸(옛 기록 · 앞으로 생길 칸) | 수는 큰 쪽 · 참거짓은 켜진 쪽 · 객체는 칸마다 · 그 밖은 글이 큰 쪽 |

- **기록에 칸을 더하면 `RULES`에도 규칙을 넣는다.** `emptyRecords()`의 칸에 규칙이 없으면 `test/merge.test.js`가 실패한다.
- 세는 수를 큰 쪽으로 하니, 두 기기에서 따로 둔 판은 합이 아닌 큰 쪽만 남는다(정한 것).
- 설정 「처음 안내 다시 보기」는 이 기기의 `coachSeen`을 비우고 그것을 올린다. 올리기 전에 다시 켜면 서버의 것과 합쳐져 되돌아온다(드문 가장자리).

### 무엇을 저장하나(저장 덩이)
`{ v: 1, records, run, runAt, settings, setAt }` — JSON 글 한 덩이(`saves.blob`), `rev`와 `updated_at`은 줄에 따로.

- `records`: 기록 · 도감 · 해금 · 본 안내(`chainmate.records.v1`에서 이 기기의 취향 셋을 뺀 것).
- `run`: 진행 중인 판(`chainmate.run.v1` 그대로 — 오늘의 대국이면 `cmds`도. 순위에 낼 때 쓴다), 없으면 `null`. `runAt`: 그 판을 저장한 때(`run.updatedAt`) 또는 판이 끝나 저장을 지운 때.
  - **늦은 쪽이 이긴다.** 끝난 쪽(`null`)이 더 늦으면 `null` — 끝난 판이 다른 기기에서 되살아나지 않는다. `run.updatedAt`은 화면의 저장 길(`app.save`)에서만 적는다(sim은 모른다).
  - 지금 판을 두는 중이면 받은 판으로 덮지 않고 두었다가 **첫 화면으로 돌아올 때**(`app.toTitle` → `cloud.settle`) 다시 견준다. 그 뒤 첫 화면의 「이어 하기」가 그 판을 연다.
  - 시각은 기기의 시계다. 두 기기의 시계가 크게 어긋나면 늦은 쪽 판정도 어긋난다.
- `settings`: `lang` · `coach` · `replay` 셋(게임 쪽 취향)과 `setAt`(바꾼 때 — 늦은 쪽). **옮기지 않는 것**: 소리 · 음악 · 연출 속도 · 화면 흔들림 · 큰 글자 · 움직임 줄이기(기기 취향)와 「기록 보내기」(동의는 기기마다).
- **옮기지 않는 것**: 사람 판 기록(`chainmate.runs.v1`, 200판 — 크다) · 순위 대기열 · 기록 보내기의 익명 ID.
- 크기(봇 판으로 잰 것): 기록 0.4KB(빈 것) ~ 4KB(도감을 다 채운 것) · 진행 중인 판 중간값 7 ~ 13KB · 최대 18KB(보통 판) · 26KB(오늘의 대국 — 명령 줄 8KB 포함) → **덩이 보통 10 ~ 20KB · 최대 30KB 안팎**. 본문 한도 200KB의 15%라 줄이기 · 압축은 넣지 않았다. 명령 줄이 아주 긴 판(한도 5000개 ≈ 120KB)에 대비해 화면은 190KB를 넘으면 판의 세기(`run.track`)를 빼고, 그래도 넘으면 그때는 올리지 않는다.

### 맞추는 때(`src/ui/cloud.js`)
| 때 | 하는 일 |
|---|---|
| 켤 때(`cloud.open`) | 열쇠가 있으면 당겨 와 합치고, 서버 것과 달라졌으면 올린다 |
| 판이 끝날 때 · 상점을 떠날 때 · 관 선택에 설 때(`app.cmd`) · 결과 화면이 기록을 적은 뒤(`app.finishRun`) | 올리기를 건다(`cloud.touch`). **15초에 한 번까지** 묶는다. 열쇠가 없으면 여기서 처음 만든다 |
| 화면이 가려질 때(`visibilitychange hidden` · `pagehide`) | 달라진 것이 있으면 한 번 올린다 — `fetch(…, { keepalive: true })`(64KiB를 넘는 덩이는 보통 길로). 열쇠가 없으면 만들지 않는다 |
| 코드를 넣은 뒤 · 이쪽 코드가 쓰인 뒤(`cloud.join`) | 당겨 합치고 곧바로 올린다 |

- 달라진 것이 없으면(마지막으로 올린 글과 같으면) 올리지 않는다.
- 서버는 `rev`로 낙관적 잠금을 한다. 보낸 `baseRev`가 서버 것과 다르면 409 + 서버 덩이 → 화면이 합쳐 **한 번** 더 올린다.
- 실패는 조용히 넘어가고 다음 때 다시 한다. 화면에는 아무것도 띄우지 않는다(맞추는 중 · 맞춘 표시 없음 — 기기 잇기 화면의 「마지막으로 맞춘 때」 한 줄뿐).
- **이어진 기기가 없어도 돈다.** 기록 저장만 지워지고 열쇠(`chainmate.player.v1`)가 남아 있으면 켤 때 되찾는다. 열쇠도 같이 지워지면 못 찾는다(CHM-72).
- 조건은 순위와 같다(`rank.allowed`): 배포 주소 · 앱에서만, `navigator.webdriver` 아님. 로컬 서버 · 미리 보기 배포에서는 0건이고 저장(`chainmate.cloud.v1`)에도 쓰지 않는다. 설정 「기록 보내기」와는 상관없다.
- 이 때문에 **플레이어 열쇠가 생기는 때가 당겨졌다**: 예전에는 오늘의 대국을 끝내거나 순위 화면을 열 때, 이제는 판을 처음 두어 관 선택에 서는 때. 설정의 이름 줄 · 처음 안내 「이름은 설정에서 다시 지을 수 있다」도 그때부터 보인다.
- 저장 열쇠 `chainmate.cloud.v1` = `{ rev, runAt, setAt, snap, at, sum }`(서버 rev · 판이 끝난 때 · 설정을 바꾼 때 · 마지막으로 맞춘 때 · 그날 센 수). 열쇠 · 코드는 없다.

### API
| 길 | 받는 것 | 주는 것 |
|---|---|---|
| `POST /api/link/code` | `{ key }` | `{ code, expiresAt, ttl }`. 하루 한도 429 `code_limit` |
| `POST /api/link/redeem` | `{ key, code }` | `{ key, a, n, rerolls, devices }` — `key`는 **이 기기의 새 열쇠**(코드를 낸 플레이어에 붙은 것). 404 `bad_code`(없는 · 쓴 코드) · 410 `expired` · 400 `self`(자기 코드) · 429 `redeem_limit` · 429 `locked` |
| `POST /api/link/devices` | `{ key }` | `{ devices }` — 이 플레이어의 열쇠 수 |
| `POST /api/link/unlink` | `{ key }` | `{ key, a, n, rerolls, devices: 1 }`. 혼자면 400 `not_linked` |
| `GET /api/save` | `?key=` | `{ rev, updatedAt, blob }` 또는 `{ rev: 0 }` |
| `PUT /api/save` | `{ key, baseRev, blob }` | `{ rev, updatedAt }`. 어긋나면 409 `{ error: 'conflict', rev, updatedAt, blob }`(저장이 없으면 `{ rev: 0 }`). 꼴이 틀리면 400 `bad_blob` · 크면 413 · 429 `save_limit` |

- 모두 모르는 열쇠는 401 `unknown_key`, 꼴이 틀리면 400 `bad_request`. 출처 · JSON 규칙은 위와 같다(`route`가 PUT과 길마다 본문 한도를 받는다).
- 넣기의 처리 차례: 꼴 → 전체 잠금 → 열쇠 → 열쇠 한도 → 코드(없음 · 지남 · 자기 것) → 코드 쓰기 → 합치기. 틀린 것으로 세는 것은 없는 코드 · 지난 코드뿐이다.
- 덩이 검사(`blobOk`): 최상위 열쇠(`v` · `records` · `run` · `runAt` · `settings` · `setAt`) · 타입 · 깊이(40겹)만 본다. **내용은 믿지도 읽지도 않는다** — 순위와 무관하고 그 사람 자신의 저장이다.
- 기존 길(`player` · `daily/*`)은 열쇠를 `player_keys`로 찾는다.

### 한도
| 무엇 | 값 | 어디 |
|---|---|---|
| 코드가 사는 시간 | 10분 · 한 번 | `LIMITS.codeTtl`, `link_codes` |
| 코드 받기 | 플레이어당 하루(UTC) 10번 | `LIMITS.codes` |
| 틀린 코드 | 넣는 쪽 열쇠당 한 시간 10번(그 뒤 429 `redeem_limit`) | `LIMITS.redeemFails` |
| 전체 잠금 | 모두 합쳐 10분 창에 500번 틀리면 그 창 동안 넣기 잠금(429 `locked`) | `LIMITS.lockFails` · `lockSpan` |
| 저장 올리기 본문 | 200KB(넘으면 413) | `LIMITS.save` |
| 저장 올리기 | 플레이어당 하루(UTC) 500번 | `LIMITS.saves` |

- 한도는 표 `link_limits(kind, who, bucket)`에 센다(함수는 상태가 없다). 이틀 지난 줄은 코드를 받을 때 지운다.
- **「코드는 5번 틀리면 무효」는 넣지 못했다**: 서버는 코드의 해시만 가지고 있어 틀린 숫자가 어느 코드를 겨눈 것인지 알 수 없다(틀린 숫자는 어떤 줄과도 맞지 않는다). 대신 전체 잠금이 그 몫을 한다 — 코드 하나가 사는 10분 동안 모두 합쳐 500번까지만 틀릴 수 있어 숫자 여덟 자리(1억)에서 살아 있는 코드 하나를 맞힐 확률은 20만분의 1 아래다. 열쇠 한도는 열쇠를 새로 만들면 피해지므로(플레이어 만들기에 한도가 없다) 막는 것은 전체 잠금이다.

### DB
- `player_keys(key_hash primary key, player_id → players, created_at, label)` + 인덱스 `player_keys_player(player_id)` — 플레이어 하나에 열쇠 여럿. 열쇠 찾기는 이 표로 한다.
- `link_codes(code_hash primary key, player_id → players, expires_at, used_at)` — 코드의 해시.
- `link_limits(kind, who, bucket, n, at, primary key(kind, who, bucket))` — 한도 세기(`who`는 플레이어 id, 전체 잠금은 0).
- `saves(player_id primary key → players, rev, blob text, updated_at)` — 저장 한 덩이.
- 플레이어를 지우면 열쇠 · 코드 · 저장도 같이 지워진다(cascade). 한도 줄은 도구(`cleanupTests`)가 지운다.

#### 옛 칸 `players.key_hash` — 두 벌로 둔다
- 마이그레이션(`db/schema.sql`)은 **더하기만** 한다: 새 표를 만들고 `players.key_hash`를 `player_keys`로 옮긴다(`on conflict do nothing` — 여러 번 돌려도 같다). 옛 칸은 지우지 않는다.
- 옛 배포(CHM-70 코드)는 `players.key_hash`만 읽고 쓴다. 새 표를 모르므로 마이그레이션 뒤에도 그대로 돈다(2026-10-08 프로덕션에서 확인 — 플레이어 만들기 · 다시 읽기 · 순위표 200).
- 새 코드는 플레이어를 만들 때 **두 곳에 다 쓰고**(`createPlayer` 한 문장), 찾을 때 `player_keys`를 먼저 본다. 거기 없으면 옛 칸을 보고 그 자리에서 `player_keys`로 옮긴다(`getPlayer`) — 마이그레이션과 새 배포 사이에 옛 코드가 만든 플레이어가 이 길로 들어온다.
- 코드를 넣어 붙은 열쇠 · 뗀 열쇠는 `player_keys`에만 있다. 뗀 플레이어의 옛 칸에는 쓰이지 않을 값을 채운다(옛 칸은 `not null unique`).
- **배포 차례**: ① 마이그레이션(끝남) → ② 새 코드 배포 → ③ 옛 배포가 더 돌지 않는 것을 본 뒤, 다음 카드에서 `createPlayer`의 옛 칸 쓰기 · `getPlayer`의 옛 칸 읽기를 걷고 `players.key_hash`를 지운다. ②보다 ③을 먼저 하면 옛 코드가 깨진다. ② 뒤에 옛 배포로 되돌리면(rollback) 그 사이 이어 붙인 기기의 열쇠는 옛 코드가 모른다(401 → 새 플레이어).

### 화면
`layout.md` 23절. 요약:
- 설정 언어 줄 오른쪽에 「기기 잇기」(「다시 짓기」 왼쪽). **판 밖 · 순위에 닿는 곳에서만** 보인다(멈춤에서 연 설정 · 로컬 서버에는 없다).
- 기기 잇기 화면(판 밖 틀): 왼쪽 「이 기기의 코드」([코드 받기] → 두 배 숫자 「4827 1593」 + 남은 시간 막대 + 「다른 기기에서 이 숫자를 넣는다」) · 오른쪽 「다른 기기의 코드 넣기」(숫자 여덟 칸 + 캔버스 숫자판, 키보드 숫자 · Backspace · Enter) · 아래 한 줄(「기기 2대가 이어져 있다 · 마지막으로 맞춘 때 방금」 + [이 기기 떼기]).
- 잇기 전 확인 「이 기기의 기록이 그 기기의 기록과 합쳐진다」 [잇기] [그만] → 「이어졌다 · 이름 졸린 수달」 + 합쳐서 늘어난 것 한 줄(`mergeGain` — 「도감 12칸이 새로 채워졌다」 · 「레퍼토리 1개가 새로 열렸다」 · 「판 3개가 더해졌다」 가운데 하나, 늘어난 것이 없으면 줄도 없다).
- 실패는 한 줄씩: 「숫자가 맞지 않는다」 · 「시간이 지난 숫자다」 · 「이 기기의 숫자다」 · 「잠시 뒤에 다시 넣는다」(한도 · 잠금) · 「닿지 못했다」.
- 브라우저 입력 칸(DOM input)은 쓰지 않는다. 열쇠는 화면 · 콘솔 · 기록 보내기 어디에도 없다(`rank.js` 밖으로 나가지 않는다). 코드는 받은 기기의 화면에만 보인다.
- 기록 보내기 사건: `link_code` · `link_redeem { ok, reason }` · `link_unlink` · `save_sync { pulled, pushed, conflict }`(하루 한 번 요약).

### 확인
- `npm test` — `test/merge.test.js`(합치기 성질) · `test/link.test.js`(서버 로직 — 기억 저장소) · `test/cloud.test.js`(화면 쪽 — 가짜 서버, 기기 둘) · `test/layout.test.js`(설정 단추 · 화면 칸 · 숫자판 · 긴 영어 글).
- `npm run smoke` — 「기기 잇기」 줄: 가짜 서버 하나 + 앱 둘로 코드 받기 → 숫자판으로 넣기 → 같은 이름 → 한쪽에서 판을 두고 → 다른 쪽을 다시 켜면 기록과 「이어 하기」의 판이 같은지 → 이 기기 떼기. 저장 올리기 크기도 찍는다.
- `node tools/link-e2e.mjs http://localhost:3210`(`vercel dev --listen 3210` 뒤) — 진짜 DB의 SQL까지: 코드 · 넣기 · 성적 합침(낸 시각) · 저장 409 · 떼기 · 한도 · 잠금 · 지난 코드 · 옛 열쇠 옮겨 읽기. 만든 것은 `test` 표시 뒤 지운다(전체 잠금 줄은 손댄 만큼 되돌린다).
- `node tools/shots-link.mjs` — 크로미움 · 웹킷으로 화면 상태를 찍는다(`docs/shots/link/`). `--live http://localhost:3210`은 진짜 서버로 크로미움 기기 ↔ 웹킷 기기를 화면으로 잇고, 웹킷에서 오늘의 대국을 끝낸 뒤 다시 켠 크로미움의 기록 · 순위의 내 줄이 같은지 본다(`live-*`).

## 확인하는 법
- `npm test` — `test/names.test.js` · `test/daily-verify.test.js` · `test/leaderboard.test.js`(DB는 기억 저장소 `test/helpers/memstore.js`).
- 화면 쪽: `test/rank.test.js`(열쇠 · 제출 조건 · stale · 실패 · 대기열 · 캐시 · 로컬과 webdriver에서 0건 · 열쇠가 로그 · 기록 보내기에 안 실림 — 가짜 서버 `test/helpers/fakeapi.js`는 진짜 `service.js`에 기억 저장소를 물린 것), `test/layout.test.js`(순위 줄 폭 · 화면 상태 · 결과 카드 높이 · 설정 이름 줄).
- `npm run smoke` — 「순위 확인: 화면 판 = 서버 셈」, 「순위: 제출 1 · 등수 표시 · 쪽 넘김 · 다시 짓기 · 닿지 못함 상태」(같은 가짜 서버로 오늘의 대국을 끝냄 → 결과 카드 → 순위 보기 → 쪽 넘김 → 어제 탭 → 설정에서 다시 짓기).
- `node tools/shots-leaderboard.mjs` — 크로미움 · 웹킷으로 화면 상태를 모두 찍고(`docs/shots/leaderboard/after-*`), `python3 -m http.server`로 열었을 때 `/api` 요청 · 알림이 0인지 본다. `--live http://localhost:3210`은 진짜 서버(`vercel dev`)로 봇 판을 화면에 넣어 끝내고 순위에 오르는지 본 뒤 만든 플레이어를 지운다.
- `node tools/daily-e2e.mjs <주소> [--vercel]` — 진짜 DB까지: 플레이어 만들기 → 봇이 둔 오늘의 대국 제출 → 순위 → 같은 줄 다시 → 조작 거절 → 다시 짓기 → 쪽 넘김. 만든 플레이어는 `test` 표시를 하고 끝나면 지운다(`--cleanup`은 지우기만). 로컬은 `vercel dev --listen 3210` 뒤 `node tools/daily-e2e.mjs http://localhost:3210`, 배포 보호가 걸린 미리 보기 배포는 `--vercel`(`vercel curl`).

## 버린 안
- 점수만 받아 적기: 누구나 지어 보낼 수 있다.
- 명령 줄을 모두 남기기: 하루 수천 판 × 10KB. 가장 좋은 판 하나만 남긴다.
- 이름 직접 입력: 욕설 · 사칭 거르기가 따라온다. 목록에서 뽑는다.
- IP로 한도 세기: IP를 남기지 않는다는 방침과 부딪힌다.
