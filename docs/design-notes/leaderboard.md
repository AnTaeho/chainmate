# 순위 (CHM-70)

「오늘의 대국」으로 매기는 하루 순위와, 그 위에 얹은 기기 잇기 · 클라우드 저장(CHM-71) · 계정(CHM-72). 화면의 자리 · 칸 폭은 `layout.md` 22 · 23 · 24절, 스크린샷은 `docs/shots/leaderboard/` · `link/` · `account/`.

- 서버 함수: `api/`(Vercel Functions, Node, ESM). 로직은 `api/_lib/` — `verify.js`(다시 두기) · `rank.js`(줄 세우기) · `service.js`(요청 → 응답) · `store.js`(SQL) · `http.js`(출처 · JSON · 오류) · `auth.js`(아이디 · 비번).
- 오늘의 대국 판: `src/sim/daily.js` `createDailyRun(date)` — 화면과 서버가 같은 함수를 쓴다.
- 이름 목록 `src/data/names.js`. DB는 Neon Postgres(`db/schema.sql`, `node tools/db-migrate.mjs`).
- 화면 쪽: `src/ui/rank.js`(서버와 주고받기 — `createRank`) · `screens/rank.js` · `screens/settings.js`(이름 줄) · `screens/title.js`(「순위」 칸).
- npm 패키지(`@neondatabase/serverless`)는 `api/`만 쓴다.

## 줄 세우기
매일 모두가 같은 판을 둔다: 시드 `dailySeed(날짜)` · 스탠다드 오프닝 · 단 0. 차례:

1. 닿은 관(`ante`) — 클수록 위
2. 대국 번호(`blind`: 0 연습 · 1 정식 · 2 마스터전)
3. 이겼는지(`won`) — 8관 마스터전 승리가 맨 위
4. 판 전체에서 낸 점수의 합(`score_total`, 8관 마스터전을 다시 둔 대국도 더한다)
5. 같으면 먼저 낸 사람(`submitted_at`), 그래도 같으면 `player_id`

- 한 사람은 하루에 가장 좋은 기록 하나만 오른다. 더 좋은 판만 갈아 끼운다(같은 성적이면 먼저 낸 시각이 남는다).
- 이긴 뒤 「계속 두기」(끝없는 대국)는 넣지 않는다.
- 코드: `api/_lib/rank.js` `rankKey` · `compareRank` · `better`, SQL은 `store.js` `ORDER`(같은 차례).
- 기기의 `records.daily.score`(관 × 10 + 대국 + 이기면 100)는 다른 옛 셈이다. 순위 화면은 서버 값을 쓴다.

## 조작 막기: 서버가 다시 둔다
클라이언트가 말한 점수는 받지 않는다. 받는 것은 그 판의 **명령 줄**뿐이다.

- 오늘의 대국 판은 `applyRun`이 성공한 명령을 `run.cmds`에 남긴다(`run.cmds`가 있는 판만). 거절된 명령 · 미리 보기 · 화면 전용 동작 · 8관 우승 뒤의 명령은 남지 않는다. 보통 판 · 하네스 판에는 `run.cmds`가 없다. `run.cmds`가 없는 옛 저장 판은 제출하지 않는다.
- 크기: 명령 170~350개 · JSON 5~10KB. 판 저장(`chainmate.run.v1`)에 함께 들어간다.
- 서버 `verifyDaily(date, cmds)`는 `createDailyRun(date)`로 같은 판을 만들어 처음부터 다시 둔다.
  - 명령마다 꼴을 먼저 거른다(`cleanCmd`: 아는 종류 · 아는 칸 · 작은 자연수만). 꼴이 틀리거나 규칙이 거절하면 `bad_cmd`.
  - 8관 우승에서 끊는다. 끝나지 않은 줄은 `unfinished`.
  - 성적(`summarize`): `ante` · `blind` · `won` · `score_total` · `battles` · `moves` · `ignite`(점화가 난 대국이 몇째인지, 없으면 null).
- 다시 두기 한 번 40~120ms(명령 5000개도 1초 안). 함수 한도 30초.
- **규칙(`src/sim` · `src/data`)을 바꾸면 서버의 다시 두기도 바뀐다.** 정적 파일과 함수가 한 묶음으로 배포되지만, 옛 배포에서 두던 판은 새 배포에서 다르게 풀릴 수 있어 배포 식별자를 견준다(`stale`).
- 증명: `test/daily-verify.test.js`, smoke 「순위 확인: 화면 판 = 서버 셈」.
- 막지 못하는 것: 프로그램(풀이기)이 두는 것. 상위권은 `daily_logs`의 명령 줄로 다시 볼 수 있다.

## 이름
「~한 ~」 = 형용사 + 동물. 직접 입력은 없고 「다시 짓기」만 있다.

- `names.js`: 형용사 228 · 동물 235. 한국어 · 영어가 같은 차례라 이름은 번호 한 쌍 `(a, n)`으로 저장하고 보는 사람의 언어로 보인다(`nameText(a, n, lang)`).
- **목록은 뒤에 덧붙이기만 한다**(번호가 저장된다).
- 넣지 않는 것: 놀림 · 비하 · 욕설 · 성적 뜻 · 질병 · 정치 · 종교로 읽힐 낱말, 색, 숫자, 기물 이름. `test/names.test.js`가 금칙어 · 중복 · 길이를 잰다(가장 넓은 이름 한국어 130 · 영어 173).
- 이름은 겹칠 수 있다. 내 줄은 서버가 `me`로 따로 알려 준다.

## 계정 없음: 플레이어 열쇠
- 기기마다 무작위 비밀 하나(256비트, 16진수 64자). 서버가 만들어 한 번 돌려주고 DB에는 SHA-256 해시만 둔다.
- 열쇠를 잃으면 새 사람이 된다. 다른 기기와는 코드로 잇고(「기기 잇기 · 클라우드 저장」), 어디서든 돌아오려면 계정을 쓴다(「계정」).

## API
열쇠는 **`Authorization: Bearer <열쇠>` 머리말로만** 받는다(「열쇠 머리말」). 모두 JSON, 오류는 `{ "error": 코드 }`(500은 `server`뿐 — 내부 메시지를 싣지 않는다), 응답은 `Cache-Control: no-store`.

- 출처: `Origin`이 없거나 요청 호스트와 같을 때만. 앱 출처 둘(`tauri://localhost` · `http://tauri.localhost`)은 `http.js` `ALLOWED_ORIGINS`로 받아 `Access-Control-Allow-Origin`으로 돌려준다. 그 밖은 403 `bad_origin`. 쿠키를 쓰지 않는다.
- Hobby는 배포 하나에 함수 12개까지라 길을 `[action].js`로 묶었다(`api/account/[action].js` · `api/link/[action].js`, `http.js` `routes`가 마지막 조각으로 고르고 모르면 404 `not_found`). 지금 8개, `test/leaderboard.test.js`가 12개를 넘으면 실패한다. 묶은 파일에는 POST 길만 둔다(Vercel이 조각을 `?action=`으로도 넘기는데 GET 길은 물음을 통째로 입력으로 쓴다).

| 길 | 받는 것 | 주는 것 |
|---|---|---|
| `GET /api/hello` | — | `{ build }` — 배포 식별자(`VERCEL_DEPLOYMENT_ID` → `VERCEL_GIT_COMMIT_SHA` → `'dev'`) |
| `POST /api/player` | `{}`(열쇠 없이) | 새 플레이어 `{ key, a, n, rerolls }`. 전체 한도 429 `player_limit` + `retryAfter` |
| | 열쇠 + `{}` | 지금 이름 `{ key, a, n, rerolls }`. 모르는 열쇠 401 `unknown_key` |
| | 열쇠 + `{ reroll: true }` | 새 이름(앞과 다르다). 429 `reroll_limit` |
| `POST /api/daily/submit` | 열쇠 + `{ date, build, cmds }` | `{ ok: true, best, rank, total, improved }` |
| `GET /api/daily/board` | `?date=YYYY-MM-DD&page=N` + 열쇠 | `{ date, total, page, pages, rows, me, around }` |

- `best` = `{ ante, blind, won, score, battles, moves, ignite }`(그날 가장 좋은 기록), `rank` · `total` · `improved`(방금 판으로 갈아 끼웠나).
- 줄 하나 = `{ rank, a, n, ante, blind, won, score }`. 한 쪽 10줄. `around`는 내 줄과 위아래 둘씩. 열쇠가 없거나 모르면 구경(`me: null`, `around: []`).
- `date` 기본은 서버 날짜(UTC). 내일보다 뒤는 400 `bad_date`.

### 제출의 처리 차례
1. 꼴(열쇠 64자 16진수 · build 글 · cmds 배열) — 400 `bad_request`. 명령 5000개 넘으면 413 `too_many_cmds`
2. 열쇠 — 401 `unknown_key`
3. `build`가 서버와 다르면 409 `{ error: 'stale', stale: true, build }` — 다시 두지 않는다
4. `date`가 서버 날짜 ±1일 밖이면 422 `bad_date`
5. 하루 제출 한도 — 429 `submit_limit`(조작한 줄도 센다)
6. 다시 두기 — 422 `bad_cmd`(+ `at`) · `unfinished`
7. 그날 기록보다 좋으면 갈아 끼우고 명령 줄을 남긴다

## 한도
| 무엇 | 값 | 어디 |
|---|---|---|
| 요청 본문 | 256KB(413 `too_large`) | `service.js` `LIMITS.body` |
| 명령 수 | 5000 | `verify.js` `LIMITS.cmds` |
| 제출 | 플레이어당 하루(UTC) 30번 | `LIMITS.submits` |
| 다시 짓기 | 플레이어당 하루(UTC) 20번 | `LIMITS.rerolls` |
| 플레이어 만들기 | 모두 합쳐 한 시간 2000명(429 `player_limit` + `retryAfter`) | `LIMITS.playersAll`, `link_limits` `playerall`(`who` 0) |
| 순위표 한 쪽 | 10줄 · 내 위아래 2줄씩 | `LIMITS.page` · `LIMITS.around` |
| 함수 | 리전 iad1(DB us-east-1) · 최대 30초 | `vercel.json` |

플레이어 만들기는 IP를 남기지 않아 모두 합친 수만 센다(열쇠 없이 부른 `POST /api/player`만, 나가기 · 지우기의 새 빈 플레이어는 세지 않는다). 한도에 닿으면 화면 쪽은 `retryAfter`까지 다시 부르지 않고 끝낸 판은 대기열에 둔다(`rank.js` `holdUntil`). 누가 일부러 채우면 Vercel 방화벽의 요청 수 제한을 `/api/player`에 건다.

## DB
`db/schema.sql`, 적용은 `node tools/db-migrate.mjs`(`DATABASE_URL_UNPOOLED`, 여러 번 돌려도 같다). 함수는 `DATABASE_URL`(풀)을 HTTP 질의로 쓴다. 트랜잭션이 없어 한도 세기 · 기록 갈아 끼우기는 조건을 단 한 문장으로 한다.

- `players(id, a, n, created_at, rerolls_day, rerolls_date, submits_day, submits_date, test)` — 열쇠는 `player_keys`에
- `daily_scores(player_id, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at, pk(player_id, date))` + 인덱스 `daily_scores_rank`(줄 세우기 차례)
- `daily_logs(player_id, date, cmds text, pk(player_id, date))` — 그날 가장 좋은 기록의 명령 줄만
- 플레이어를 지우면 성적 · 명령 줄도 지워진다(cascade). **미리 보기 배포도 프로덕션과 같은 DB를 쓴다.**

## 개인정보
저장하는 것: 무작위 열쇠의 해시 · 이름 번호 한 쌍 · 그날 성적과 가장 좋은 판의 명령 줄 · 한도 세는 수, 플레이어마다 저장 한 덩이(「무엇을 저장하나」) · 옮기기 코드의 해시(10분), 계정이 있으면 아이디와 비번의 scrypt 해시. 사람에게 보이는 쪽은 `privacy.html`.

- IP · UA · 기기 정보 · 주소는 읽지도 남기지도 않는다. 이름은 목록의 낱말이다.
- 열쇠 원문은 그 기기의 저장에만 있다. 함수 로그에도 찍지 않는다.
- 기록 보내기(`telemetry.md`)의 익명 ID와 플레이어 열쇠는 잇지 않는다.

## 화면
정한 안: 전용 순위 화면 + 결과 화면 카드, 이름은 다시 짓기만(버린 안: 기록 화면의 탭 · 이름 직접 입력).

### 주고받는 쪽(`src/ui/rank.js`)
`createRank({ fetch, storage, today, lang, base, host, platform, webdriver })`를 `main.js`가 만들어 `createApp({ rank })`로 넘긴다(DOM을 모르고, 시험은 가짜 `fetch`). 화면은 서버를 직접 부르지 않고 여기의 「지금 아는 것」만 읽는다.

- **부르는 조건**: 호스트가 `chainmate.papercut.kr`(`src/config.js` `RANK_HOSTS`)이거나 앱(Tauri)이고 `navigator.webdriver`가 아닐 때. 그 밖에서는 `/api`를 한 번도 부르지 않고 저장에도 쓰지 않는다(화면은 「순위를 불러오지 못했어요」 한 줄). 설정 「플레이 기록 전송」과는 상관없다.
- `base`는 **도구 전용**: `boot({ rankBase })`로 넘기면 호스트 · webdriver 조건을 보지 않는다. 게임에는 켜는 뒷문이 없다. 앱은 `RANK_APP_BASE`를 부른다.
- 켤 때 `GET /api/hello`로 배포 식별자를 받아 둔다(실패하면 낼 때 다시). 대기열이 있으면 한 번 더 보낸다.
- 닿지 못한 것으로 보는 답: `fetch` 거절 · 5xx · JSON이 아닌 답.

### 저장 열쇠(localStorage)
| 열쇠 | 값 | 언제 |
|---|---|---|
| `chainmate.player.v1` | `{ key, a, n }` | 처음 필요할 때 만든다(판을 처음 두어 저장을 올릴 때 · 오늘의 대국을 끝냈을 때 · 순위 화면을 열 때). 켠 뒤 처음 쓸 때 열쇠를 실어 이름 · 남은 다시 짓기를 맞추고, 401이면 새로 만든다. 429 `player_limit`이면 말한 때까지 물러난다 |
| `chainmate.rankq.v1` | `{ date, cmds }` — 못 보낸 판 하나 | 대기열 |

**열쇠는 화면 · 콘솔 · 기록 보내기 어디에도 싣지 않는다**(`rank.player()`는 이름과 남은 횟수만 — `test/rank.test.js`).

### 제출
오늘의 대국 판이 끝나는 명령(`app.cmd` — 국면이 `won` · `lost`로 바뀐 자리, 저장을 지우기 전)에서 `app.submitDaily(run)`이 `run.cmds`를 복사해 낸다. 수업 · scratch · 옛 저장 · 보통 판 · 우승 뒤 끝없는 대국은 내지 않는다.

| 답 | 화면 쪽이 하는 일 | `rank.status(date).phase` |
|---|---|---|
| (보내는 중) | — | `pending` |
| 200 | 등수 · 사람 수를 받고 내 쪽을 한 번 더 읽는다 | `ok` |
| 401 `unknown_key` | 플레이어를 새로 만들어 한 번 더 낸다 | — |
| 409 `stale` | **다시 보내지 않는다**(이 세션에서는 더 내지 않는다) | `stale` |
| 400 · 413 · 422 · 429 | 조용히 버린다. 앞서 낸 기록이 있으면 그 등수 | `ok`(`sent: false`) · `none` |
| 닿지 못함 | 대기열에 남긴다 | `unreached` |

### 대기열
못 보낸 판 **하나**(덮어쓴다)를 다음에 켤 때 · 순위 화면을 열 때 한 번 더 보낸다(`rank.retry()`). 그날 것이 아니면 버린다. 서버가 답하면(오르든 거절이든) 지운다.

### 조회
`rank.board(date, page)`는 지금 아는 쪽을 곧바로 돌려주고 뒤에서 묻는다. 같은 쪽은 30초 동안 다시 묻지 않고(`CACHE_MS`), 닿지 못한 쪽은 5초 뒤에(`RETRY_MS`). 판을 내거나 이름을 다시 지으면 그날 쪽을 버린다.

### 화면 상태
순위 화면(불러오는 중 · 줄 + 붙박은 내 줄 · 오늘 안 둠 + 「오늘의 대국 두기」 · 어제 안 둠 · 빈 순위표 · 닿지 못함 한 줄), 결과 카드(`pending` · `ok` 등수와 이웃 · `stale` 「게임이 업데이트됐어요」 · `unreached` 한 줄 · `none` 카드 없음), 설정 이름 줄(열쇠가 있을 때만 + 주사위 「다시 짓기」), 열쇠가 생긴 뒤 첫 화면의 도움말 팁 하나. 글 · 폭은 `layout.md` 22절.

- 도달 표기는 `screens/rank.js` `reachText`, 결과 카드 줄이 좁으면 짧은 꼴 → 도달 칸 빼기(`cardCols`).
- 날짜는 `app.today()`로 오늘 · 어제를 정한다. 판의 날짜는 `run.daily`(자정을 넘겨도 그 날로 — 서버는 ±1일을 받는다).
- 기록 보내기 사건: `rank_open` · `rank_submit` · `name_reroll`(이름 · 열쇠 없음).
- 순위를 끄는 스위치는 두지 않았다(나가는 것은 열쇠 · 명령 줄뿐). 필요해지면 설정 이름 줄 자리에 둔다.

## 기기 잇기 · 클라우드 저장 (CHM-71)
계정 없이 **코드로 두 기기를 한 플레이어로 잇고**, 플레이어마다 **저장 한 덩이**를 서버에 둔다.

- 서버: `api/link/[action].js`(`code` · `redeem` · `devices` · `unlink`) · `api/save.js`(로직 `service.js` `link*` · `saveGet` · `savePut`).
- 화면 쪽: `src/ui/merge.js`(합치는 규칙) · `src/ui/cloud.js`(맞추기 — `createApp({ cloud })`) · `src/ui/rank.js`(열쇠가 드는 부름) · `screens/link.js`.

### 잇기
1. 기기 A가 「코드 받기」 → **숫자 여덟 자리**. 10분 · 한 번만 · 새로 받으면 앞 코드는 무효. DB에는 `sha256('link:' + 코드)`만.
2. 기기 B가 넣으면 서버는 **A의 플레이어에 B의 새 열쇠를 붙여** 돌려준다(`player_keys` — 플레이어 하나에 열쇠 여럿). 이름은 A의 것.
3. B의 옛 플레이어 순위 성적은 A로 합친다: 날짜마다 더 좋은 것, **낸 시각은 그대로**, 명령 줄도 따라온다. B의 옛 플레이어에 붙은 다른 열쇠도 A로 옮긴 뒤 옛 플레이어를 지운다.
4. B가 A의 저장을 당겨 제 것과 합쳐 올린다(서버는 덩이를 읽지 않는다). A는 코드를 띄운 동안 5초마다 기기 수를 물어 이어진 것을 안다.
- 「이 기기 떼기」: 이 기기의 열쇠만 새 플레이어로 갈라선다(이름 · 저장 사본을 들고 간다, 순위 성적은 남은 쪽에). 혼자면 400 `not_linked`.
- 트랜잭션이 없다. 넣기 차례는 코드 쓰기 → 성적 합치기 → 새 열쇠 → 다른 열쇠 옮기기 → 옛 플레이어 지우기라 중간에 끊겨도 잃는 것은 없다. 넣기의 답이 오는 길에 끊기면 B는 다음에 새 플레이어가 된다(기록은 기기에 남는다).

### 합치는 규칙(`src/ui/merge.js` `mergeRecords`)
순수 함수. 교환 · 결합 법칙이 서고 `merge(a, a) = a`. `test/merge.test.js`가 무작위 300쌍으로 잰다.

| 칸 | 규칙 |
|---|---|
| `runs` · `wins` · `mates` · `legends` · `brilliants` · `reviews` · `reviewReplays` · `bestAnte` · `bestEndless` · `gates` · `unlockTier` · `unlocked.dan` · `codex.legends` | 큰 쪽(더하지 않는다) |
| `grades` · `danWins` | 열쇠마다 큰 쪽 |
| `bestMove` · `bestBrilliant` | 점수가 큰 쪽(같으면 JSON 글이 큰 쪽) |
| `codex` · `unlocked.openings` · `coachSeen` · `lessonsSeen` · `movesSeen` | 합집합 |
| `lessonsDone` · `tutorialAsked` | 켜진 쪽 |
| `daily` | 날짜가 늦은 쪽, 같은 날이면 더 좋은 판 + 둔 판 수는 큰 쪽 |
| `runNew` | 같은 판이면 합집합, 다른 판이면 글이 큰 쪽 |
| `lastOpening` · `lastDan` | **옮기지 않는다**(`LOCAL_ONLY`) |
| 규칙이 없는 칸 | 수는 큰 쪽 · 참거짓은 켜진 쪽 · 객체는 칸마다 · 그 밖은 글이 큰 쪽 |

- **기록에 칸을 더하면 `RULES`에도 규칙을 넣는다**(없으면 `test/merge.test.js`가 실패한다).
- 두 기기에서 따로 둔 판 수는 합이 아닌 큰 쪽만 남는다(정한 것).

### 무엇을 저장하나(저장 덩이)
`{ v: 1, records, run, runAt, settings, setAt }` — JSON 글 한 덩이(`saves.blob`), `rev` · `updated_at`은 줄에 따로.

- `records`: `chainmate.records.v1`에서 `LOCAL_ONLY`를 뺀 것.
- `run`: 진행 중인 판(오늘의 대국이면 `cmds`도) 또는 `null`, `runAt`: 저장한 때(`run.updatedAt`) 또는 판이 끝난 때.
  - **늦은 쪽이 이긴다**(끝난 쪽이 늦으면 `null` — 끝난 판이 되살아나지 않는다). `run.updatedAt`은 `app.save`에서만 적는다.
  - 판을 두는 중이면 덮지 않고 **첫 화면으로 돌아올 때**(`app.toTitle` → `cloud.settle`) 다시 견준다.
  - 시각은 기기 시계다.
- `settings`: `lang` · `coach` · `replay`와 `setAt`(늦은 쪽). 소리 · 연출 · 화면 취향과 「플레이 기록 전송」(동의는 기기마다)은 옮기지 않는다.
- 옮기지 않는 것: 사람 판 기록(`chainmate.runs.v1`) · 순위 대기열 · 기록 보내기 익명 ID.
- 크기: 보통 10~20KB · 최대 30KB 안팎(한도 200KB). 190KB를 넘으면 `run.track`을 빼고, 그래도 넘으면 올리지 않는다.

### 맞추는 때(`src/ui/cloud.js`)
| 때 | 하는 일 |
|---|---|
| 켤 때(`cloud.open`) | 열쇠가 있으면 당겨 합치고, 달라졌으면 올린다 |
| 판 끝 · 상점을 떠날 때 · 관 선택에 설 때(`app.cmd`) · `app.finishRun` 뒤 | 올리기를 건다(`cloud.touch`, **15초에 한 번까지**). 열쇠가 없으면 여기서 만든다 |
| 화면이 가려질 때(`visibilitychange hidden` · `pagehide`) | 달라진 것이 있으면 한 번 올린다(`keepalive`, 64KiB 넘으면 보통 길). 열쇠를 만들지 않는다 |
| 코드를 넣은 뒤 · 이쪽 코드가 쓰인 뒤(`cloud.join`) | 당겨 합치고 곧바로 올린다 |

- 마지막으로 올린 글과 같으면 올리지 않는다.
- `rev` 낙관적 잠금: `baseRev`가 다르면 409 + 서버 덩이 → 합쳐 **한 번** 더 올린다.
- 실패는 조용히 넘어간다. 화면에 띄우는 것은 기기 잇기 화면의 「마지막으로 맞춘 때」 한 줄뿐.
- 이어진 기기가 없어도 돈다(기록만 지워지고 열쇠가 남으면 켤 때 되찾는다).
- 조건은 순위와 같다(`rank.allowed`). 로컬 · 미리 보기 배포에서는 0건이고 `chainmate.cloud.v1`에도 쓰지 않는다.
- `chainmate.cloud.v1` = `{ rev, runAt, setAt, snap, at, sum }`. 열쇠 · 코드는 없다.

### API
| 길 | 받는 것 | 주는 것 |
|---|---|---|
| `POST /api/link/code` | `{}` | `{ code, expiresAt, ttl }`. 429 `code_limit` |
| `POST /api/link/redeem` | `{ code }` | `{ key(이 기기의 새 열쇠), a, n, rerolls, devices }`. 404 `bad_code` · 410 `expired` · 400 `self` · 429 `redeem_limit` · 429 `locked` |
| `POST /api/link/devices` | `{}` | `{ devices }` |
| `POST /api/link/unlink` | `{}` | `{ key, a, n, rerolls, devices: 1 }`. 400 `not_linked` |
| `GET /api/save` | — | `{ rev, updatedAt, blob }` 또는 `{ rev: 0 }` |
| `PUT /api/save` | `{ baseRev, blob }` | `{ rev, updatedAt }`. 409 `{ error: 'conflict', rev, updatedAt, blob }` · 400 `bad_blob` · 413 · 429 `save_limit` |

- 모두 열쇠 머리말이 든다. 모르는 열쇠 401 `unknown_key`, 없거나 꼴이 틀리면 400 `bad_request`.
- 넣기 차례: 꼴 → 전체 잠금 → 열쇠 → 열쇠 한도 → 코드(없음 · 지남 · 자기 것) → 코드 쓰기 → 합치기. 틀린 것으로 세는 것은 없는 코드 · 지난 코드뿐.
- 덩이 검사(`blobOk`)는 최상위 열쇠 · 타입 · 깊이(40겹)만 본다. **내용은 믿지도 읽지도 않는다.**

### 한도
| 무엇 | 값 | 어디 |
|---|---|---|
| 코드가 사는 시간 | 10분 · 한 번 | `LIMITS.codeTtl` |
| 코드 받기 | 플레이어당 하루(UTC) 10번 | `LIMITS.codes` |
| 틀린 코드 | 넣는 쪽 열쇠당 한 시간 10번(429 `redeem_limit`) | `LIMITS.redeemFails` |
| 전체 잠금 | 10분 창에 모두 합쳐 500번 틀리면 그 창 동안 잠금(429 `locked`) | `LIMITS.lockFails` · `lockSpan` |
| 저장 본문 | 200KB(413) | `LIMITS.save` |
| 저장 올리기 | 플레이어당 하루(UTC) 500번 | `LIMITS.saves` |

- 한도는 `link_limits(kind, who, bucket)`에 센다. 이틀 지난 줄은 코드를 받을 때 지운다.
- 「코드 5번 틀리면 무효」는 넣지 못했다(서버는 해시만 있어 틀린 숫자가 어느 코드를 겨눴는지 모른다). 전체 잠금으로 살아 있는 코드 하나를 맞힐 확률이 20만분의 1 아래다. 열쇠 한도는 새 열쇠로 피해지니 실제로 막는 것은 전체 잠금이다.

### DB
- `player_keys(key_hash pk, player_id, created_at, label)` + 인덱스 `player_keys_player` — 열쇠 찾기는 이 표로.
- `link_codes(code_hash pk, player_id, expires_at, used_at)`
- `link_limits(kind, who, bucket, n, at, pk(kind, who, bucket))` — `who`는 플레이어 id, 전체 잠금은 0.
- `saves(player_id pk, rev, blob text, updated_at)`
- 플레이어를 지우면 열쇠 · 코드 · 저장도 지워진다(cascade). 한도 줄은 `cleanupTests`가 지운다.

#### 옛 칸 `players.key_hash` — 걷는 차례
CHM-70은 열쇠 해시를 `players.key_hash`(not null unique)에 두었다. 지금 코드는 이 칸을 읽지도 쓰지도 않는다. 옛 칸에 쓰는 배포가 도는 동안 칸을 지우면 플레이어 만들기가 깨지므로 두 걸음으로 걷는다.

1. **걸음 A** `node tools/db-migrate.mjs`: 옛 칸이 있으면 `not null`만 푼다. 여러 번 돌려도 같다.
2. 옛 칸을 쓰지 않는 코드를 배포한다(**걸음 A보다 먼저 배포하면** 플레이어 만들기가 500).
3. **걸음 B** `node tools/db-migrate.mjs --drop-old-key`: `drop column if exists key_hash`. 2가 자리 잡은 뒤에만. 그 뒤로는 옛 배포로 되돌릴 수 없다.

- 기본 마이그레이션은 칸이 있는 DB · 푼 DB · 없는 DB 모두에서 돈다(`oldKeyColumn`, `test/leaderboard.test.js`). 끝 줄이 칸의 상태를 적는다.

### 화면
`layout.md` 23절. 설정의 「계정」 → 탭 「기기 잇기」(판 밖 · 순위에 닿는 곳에서만). 왼쪽 「이 기기의 코드」(두 배 숫자 + 남은 시간 막대) · 오른쪽 숫자 여덟 칸 + 캔버스 숫자판 · 아래 기기 수와 「이 기기 떼기」. 잇기 전 확인 → 「이어졌다」 + 늘어난 것 한 줄(`mergeGain`). 실패는 한 줄씩.

- 열쇠는 `rank.js` 밖으로 나가지 않는다. 코드는 받은 기기의 화면에만 보인다.
- 기록 보내기 사건: `link_code` · `link_redeem { ok, reason }` · `link_unlink` · `save_sync { pulled, pushed, conflict }`(하루 한 번).

## 계정 (CHM-72)
아이디 · 비번 계정, 이메일 없음. 열쇠가 든 브라우저 저장이 지워져도 어느 기기에서든 들어오면 내 기록 · 순위 이름으로 돌아온다.

- 서버: `api/account.js`(GET) · `api/account/[action].js`(`signup` · `login` · `logout` · `password` · `delete`), 규칙 · 해시는 `api/_lib/auth.js`.
- 화면 쪽: `src/ui/rank.js` · `screens/account.js` · `src/ui/textfield.js`(`layout.md` 24절) · `privacy.html`.

### 모델
**계정 = 플레이어에 붙는 자격 하나.** 플레이어 · 열쇠 · 저장 덩이의 꼴은 그대로다.

| 일 | 서버가 하는 일 |
|---|---|
| 가입 | 지금 기기의 플레이어에 아이디 · 비번 해시를 붙인다 |
| 들어오기 | 그 기기를 계정의 플레이어에 **새 열쇠**로 붙인다. 기기 잇기의 넣기와 같은 길(`store.absorb`) — 옛 플레이어 성적을 합치고 지운 뒤 화면이 저장을 당겨 합친다(`cloud.join`). 이미 그 계정의 기기면 그대로 |
| 나가기 | 이 기기의 열쇠만 지우고 **새 빈 플레이어**를 준다. 화면은 서버 답을 받은 **뒤에** 기기의 기록 · 진행 중인 판 · 사람 판 기록을 비운다(`app.wipeDevice`, 설정과 `coachSeen` · `tutorialAsked` · `lessonsDone` · `lessonsSeen`은 둔다). 나가기 앞에 한 번 올리고, 못 올리면 나가지 않는다 |
| 비번 바꾸기 | 지금 비번 + 새 비번. 지금 비번이 없으면 그 열쇠가 계정 플레이어의 것이면 된다 — 하루 3번 |
| 지우기 | 비번을 견준 뒤 플레이어를 지운다(계정 · 모든 열쇠 · 성적 · 저장 · 코드 cascade + 한도 줄). 이 기기는 새 빈 플레이어 |

- **되찾기는 없다.** 비번을 잊으면 들어와 있는 기기에서만 새로 정한다.
- **아이디는 본인의 계정 화면에만 보인다.** 순위표 이름은 계속 형용사 + 동물.
- 계정이 붙은 기기는 다른 아이디로 들어오지 못하고(409 `other_account`), **남의 기기 잇기 코드도 넣지 못한다**(409 `has_account` — 넣는 쪽의 옛 플레이어를 지우는 길이라 계정까지 지워진다).
- 가장자리: 계정을 지우면 이어진 다른 기기의 열쇠도 죽는다 · 비번을 바꿔도 들어와 있는 기기는 그대로 · 아이디 잠금은 남이 걸 수 있다(들어와 있는 기기는 그대로) · 들어오기 답이 끊기면 새 사람이 된다.

### 아이디 · 비번 규칙(`api/_lib/auth.js`)
- 아이디: 영문 소문자 · 숫자 · `_`, 3~20자, 대문자는 소문자로. 예약어 25개는 400 `bad_username`.
- 비번: 8~72자. 흔한 비번 54개와 아이디와 같은 것은 400 `weak_password`. NFKC로 고른 뒤 넣는다.
- **해시**: `node:crypto` scrypt — **N 2^15 · r 8 · p 1 · salt 16바이트 · 값 32바이트**, 저장 `scrypt$32768$8$1$<salt>$<hash>`. 견줌은 `timingSafeEqual`. 한 번 약 39ms · 33MB라 `maxmem` 96MiB. 저장된 N을 읽어 견주므로 N을 올려도 옛 해시가 맞는다. 시험은 `createService({ scryptN: 16 })`.
- **아이디가 있는지 새지 않게**: 없는 아이디에도 같은 질의 · 가짜 해시 견줌 · 같은 한도를 하고 답은 401 `bad_login` 하나다. 가입의 409 `taken`만 알려 준다(전체 한도로 묶는다).
- 아이디 · 비번은 로그 · 기록 보내기 · 오류 답에 싣지 않는다. 화면은 값을 입력 칸에만 두고 내는 순간에만 읽는다.

### API
본문 한도 4KB.

| 길 | 받는 것 | 주는 것 |
|---|---|---|
| `GET /api/account` | — | `{ username | null, devices }` |
| `POST /api/account/signup` | `{ username, password }` | `{ username }`. 400 `bad_username` · `weak_password` · 409 `taken` · `has_account` · 429 `signup_limit` |
| `POST /api/account/login` | `{ username, password }` | `{ key(새 열쇠), a, n, rerolls, devices, username }`. 401 `bad_login` · 429 `locked` · `login_limit` · 409 `other_account` |
| `POST /api/account/logout` | `{}` | `{ key(새 빈 플레이어), a, n, rerolls, devices: 1 }`. 400 `no_account` |
| `POST /api/account/password` | `{ current?, next }` | `{ ok, reset }`. 401 `bad_login` · 400 `weak_password` · `no_account` · 429 `reset_limit` |
| `POST /api/account/delete` | `{ password }` | `{ key(새 빈 플레이어), a, n, rerolls, devices: 1 }`. 401 `bad_login` · 400 `no_account` |

- 모르는 열쇠 401 `unknown_key`, 꼴이 틀리면 400 `bad_request`, 429에는 `retryAfter`.
- 들어오기 차례: 꼴 → 전체 잠금 → 열쇠 → 열쇠 한도 → 아이디 잠금 → 다른 계정 → 비번 견줌 → 합치기.
- 나가기 · 지우기는 새 플레이어를 **먼저** 만들고 옛 것을 지운다.

### 한도
| 무엇 | 값 | 어디 |
|---|---|---|
| 틀린 비번 — 아이디 | 15분 창에 5번 → 15분 잠금(맞는 비번도 429 `locked`). 맞게 들어오면 되돌린다 | `LIMITS.loginFails` · `loginSpan` · `loginLock` |
| 틀린 비번 — 열쇠 | 한 시간 20번(429 `login_limit`), 비번 바꾸기 · 지우기의 틀림도 센다 | `LIMITS.keyLoginFails` |
| 틀린 비번 — 전체 | 10분 창에 1000번이면 그 창 동안 잠금 | `LIMITS.loginAllFails` · `loginAllSpan` |
| 가입 — 열쇠 | 하루(UTC) 3번 | `LIMITS.signups` |
| 가입 — 전체 | 한 시간 500번(이미 있는 아이디도 센다) | `LIMITS.signupAll` |
| 지금 비번 없이 새로 정하기 | 하루 3번(429 `reset_limit`) | `LIMITS.pwResets` |
| 계정 본문 | 4KB(413) | `LIMITS.account` |

- `link_limits`의 kind: `login` · `loginlock` · `loginkey` · `loginall` · `signup` · `signupall` · `pwreset`. 아이디 쪽 `who`는 **아이디 해시의 앞 60비트**(원문은 두지 않는다).
- 「이미 있는 아이디」는 열쇠 한도에 세지 않고 전체 한도에는 센다. 실제로 막는 것은 아이디 잠금과 전체 잠금이다.

### 열쇠 머리말
- 화면 쪽은 **모든 길에서 머리말만** 쓴다(주소 · 본문에 열쇠 없음 — `test/rank.test.js` · `accountui.test.js`). 예전 `?key=`는 접근 로그에 열쇠가 실렸다.
- 서버(`http.js` `route`)도 **머리말만** 받는다. 본문 · 주소의 `key`는 읽기 전에 버린다. `Bearer <열쇠>` 꼴이 아니면 400 `bad_request`.
- 옛 꼴로 부르면 열쇠 없는 요청이 된다(`POST /api/player { key }`는 새 플레이어를 만든다). CORS 허용 머리말에 `Authorization`이 있다.
- 도구(`daily-e2e` · `link-e2e` · `account-e2e`)도 머리말로 부르고, 옛 꼴 거절은 `account-e2e.mjs` · `test/account.test.js`가 본다.

### DB
- `accounts(id, username unique, pw_hash, player_id unique → players on delete cascade, created_at, pw_changed_at)`.
- 나가기는 이 기기의 열쇠 줄을 `player_keys`에서 지운다(`store.dropKey`). 옛 칸은 위 「옛 칸 — 걷는 차례」.

### 화면
`layout.md` 24절. 설정 언어 줄의 「계정」 → 탭 「아이디」 · 「기기 잇기」, 순위 · 저장과 같은 조건에서만. 계정 없음이면 입력 칸 둘 + 「로그인」 · 「계정 만들기」와 처리방침 링크, 들어와 있으면 아이디 · 기기 수 + 비밀번호 바꾸기 · 로그아웃 · 계정 지우기(확인은 오른쪽 칸). 상태는 한 줄.

- 기록 보내기 사건: `account_signup` · `account_login { ok, reason }` · `account_logout` · `account_password { reset }` · `account_delete`(아이디 없음).
- `privacy.html`은 **초안이다(법률 검토 전)** — 사람이 `TODO(사람)` 자리(문의 주소 · 운영자 · 시행일 · PostHog 보관 기간)를 채운다.

### 배포 차례
마이그레이션(더하기만) → 새 코드 배포. 거꾸로 하면 계정 길이 500. 새 코드 뒤 옛 배포로 되돌리면 계정 길만 사라진다(열쇠는 `player_keys`에 있어 옛 코드도 읽는다).

## 확인하는 법
- `npm test`: `names` · `daily-verify` · `leaderboard`(기억 저장소 `test/helpers/memstore.js`) · `rank`(가짜 서버 `test/helpers/fakeapi.js` = 진짜 `service.js` + 기억 저장소) · `merge` · `link` · `cloud` · `account` · `accountui` · `layout`.
- `npm run smoke`: 「순위 확인: 화면 판 = 서버 셈」 · 「순위」 · 「기기 잇기」(앱 둘) · 「계정」(남은 입력 칸 0).
- 진짜 DB: `node tools/daily-e2e.mjs` · `link-e2e.mjs` · `account-e2e.mjs` `<주소>`(로컬은 `vercel dev --listen 3210`, 보호된 미리 보기는 `--vercel`). 만든 플레이어는 `test` 표시 뒤 지운다(`--cleanup`은 지우기만).
- 스크린샷: `node tools/shots-leaderboard.mjs` · `shots-link.mjs` · `shots-account.mjs`(크로미움 · 웹킷, `--live <주소>`는 진짜 서버로 두 기기).

## 버린 안
- 점수만 받아 적기(누구나 지어 보낼 수 있다) · 명령 줄을 모두 남기기(가장 좋은 판 하나만) · 이름 직접 입력(욕설 · 사칭) · IP로 한도 세기(IP를 남기지 않는다).
