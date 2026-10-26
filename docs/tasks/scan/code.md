# 코드 정확성 · 견고함 · 유지보수 · 시험 · 도구 훑기

훑은 날 2026-10-26, main `f2275d0`. 저장소 파일은 고치지 않았다. `npm test` 한 번(916개 모두 통과, 벽시계 48.5초 · CPU 265%) 원문은 `scan/code/npmtest.txt`.
높음으로 둘 것은 찾지 못했다. 아래는 중간 6 · 낮음 11.

---

### C-1 오늘의 대국 판본 식별자가 판이 아니라 세션에 묶여 있다 — 옛 판은 조용히 버려지고, 아무 배포나 두던 판을 stale로 만든다
- 심각도: 중간   · 종류: 버그
- 어디: `src/ui/rank.js:172-180`(`rank.submit`이 `hello()`로 받은 지금 세션의 `build`를 싣는다) · `src/ui/rank.js:119-131`(대기열 `{ date, cmds }`에 build가 없다) · `src/ui/app.js:175-177`(`submitDaily`) · `api/_lib/service.js` `submit`(`theirs !== build` → 409) · `api/_lib/http.js:10`(`BUILD = VERCEL_DEPLOYMENT_ID …`)
- 무엇: 판을 시작한 배포가 아니라 제출하는 세션의 배포를 싣는다. 그래서 (1) 옛 배포에서 시작한 판을 새 배포에서 이어 두거나 대기열에서 다시 보내면 새 식별자가 실려 409를 비켜 가고, 규칙이 바뀌었으면 서버 다시 두기가 어긋나 422 `bad_cmd`로 조용히 버려진다(CLAUDE.md · leaderboard.md가 이미 알려진 구멍으로 적어 둠). (2) 반대로 식별자가 배포 id라서 규칙과 상관없는 배포(화면 · 글 · `api/` 고침)도 그 순간 두던 모든 오늘의 대국을 409 `stale`로 만든다. 둘 다 사람이 순위를 잃는데 화면에는 이유가 안 보인다.
- 고치는 방향:
  1. 규칙 판본 상수 `RULES_VERSION`을 `src/sim/`에 두고(예: `src/sim/daily.js`), `createDailyRun`이 `run.rules = RULES_VERSION`으로 판에 적는다. 시험 하나가 `src/sim/**` · `src/data/**`(+ `api/_lib/verify.js`) 내용의 해시를 계산해 기대 해시와 견주고, 다르면 「RULES_VERSION을 올리고 기대 해시를 고쳐라」로 실패시킨다(규칙을 바꾸면 반드시 판본이 오른다).
  2. 제출 본문에 `rules: run.rules`를 싣고 대기열에도 함께 저장한다. 서버는 `build` 대신(또는 함께) `rules !== RULES_VERSION`이면 409 `stale`. 옛 저장(`run.rules` 없음)은 지금처럼 hello 값으로 내거나 stale로 본다.
  3. `/api/hello`는 `{ build, rules }`를 돌려주게 두면 화면 쪽 이행이 쉽다. leaderboard.md 「제출의 처리 차례」 3번과 CLAUDE.md git · 배포 줄을 같이 고친다.
- 검증: `node --test test/daily-verify.test.js test/leaderboard.test.js test/rank.test.js` 통과 + 새 시험 「규칙 해시가 바뀌면 RULES_VERSION도 바뀐다」 · 「옛 rules로 낸 판은 409 stale, 대기열에서 다시 보내도 409」. `npm run smoke`의 「순위 확인: 화면 판 = 서버 셈」 그대로 통과.

### C-2 전역 한도 넷을 스크립트 하나가 채워 모든 사람을 막을 수 있다
- 심각도: 중간   · 종류: 보안
- 어디: `api/_lib/service.js:15`(`playersAll: 2000`/시간) · `:21`(`lockFails: 500`/10분, 코드 넣기) · `:32`(`loginAllFails: 1000`/10분) · `:35`(`signupAll: 500`/시간), 세는 곳 `:83` · `player()` · `linkRedeem` `miss` · `accountSignup`
- 무엇: IP를 안 남기니 한도가 「모두 합쳐」뿐이다. 열쇠는 공짜(`POST /api/player` 열쇠 없이)라 공격자가 열쇠 50개를 만들어 열쇠당 한도(로그인 20/시간, 코드 10/시간) 안에서 틀리면 10분 안에 `loginall` 1000 · `lock` 500을 채운다 → 그 10분 동안 **모든 사람**의 로그인 · 코드 넣기가 429 `locked`. 열쇠 없는 `POST /api/player` 2000번이면 한 시간 동안 새 사람이 아무도 플레이어를 못 만든다(순위 · 클라우드 저장이 꺼진 채로 돈다). 이 길들에 IP 단위 속도 제한이 어디에도 없다(`vercel.json`에도 없음).
- 고치는 방향: 앱이 IP를 저장하지 않는 방침은 그대로 두고, 플랫폼 앞단에서 막는다 — Vercel Firewall 속도 제한 규칙을 `/api/player`(POST) · `/api/account/login` · `/api/account/signup` · `/api/link/redeem`에 IP 기준으로(예: 분당 10~20). 플랜에서 쓸 수 있는 규칙 수를 먼저 확인하고(사람 판단), 안 되면 전역 한도에 도달했을 때 이미 계정이 있는 열쇠(오래된 플레이어)는 통과시키는 식으로 피해를 줄인다. leaderboard.md 「한도」 표에 이 위협과 대책을 적는다.
- 검증: 규칙을 건 뒤 `for i in $(seq 30); do curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{}' https://chainmate.papercut.kr/api/player; done`에서 뒤쪽이 429(Firewall) — **프로덕션 DB에 플레이어가 생기니 미리 보기 배포가 아닌 별도 시험 프로젝트에서 하거나 사람이 직접**. 코드 쪽을 바꾸면 `node --test test/account.test.js test/link.test.js test/leaderboard.test.js`.

### C-3 비번 견줌 시간 시험이 벽시계 한 번씩으로 비율을 잰다 — 부하에서 흔들린다
- 심각도: 중간   · 종류: 시험
- 어디: `test/account.test.js:146-157`(검사 줄은 `:157`)
- 무엇: `tMiss`(없는 아이디) · `tHit`(있는 아이디)를 `process.hrtime`으로 **각 한 번** 재고 `tMiss > tHit * 0.4 && tMiss < tHit * 2.5 && tMiss > 5`를 요구한다. `npm test`는 파일을 병렬로 돌리고(이번 실행 CPU 265%), 같은 때 `daily-verify`가 30초 동안 CPU를 태운다. scrypt(N 2^15, 32MiB) 한 번이 다른 프로세스에 밀리면 비율이 쉽게 2.5를 넘는다. 이번 실행은 통과했지만 판정이 시간 운에 기댄다.
- 고치는 방향: 뜻(「없는 아이디도 같은 N으로 해시 견줌을 한 번 한다」)을 구조로 잰다. `createService`가 이미 `scryptN`을 받으니 `verify`(기본 `verifyPassword`)도 주입받게 하고, 시험은 가짜 `verify`가 없는 아이디 · 규칙 밖 아이디에도 정확히 한 번, 진짜 계정과 같은 꼴의 해시 글(`scrypt$32768$…`)로 불렸는지 본다. 벽시계 검사는 `tMiss > 5`(가짜 견줌을 건너뛰지 않았다)만 남기거나 5번 재서 중앙값으로.
- 검증: `for i in 1 2 3 4 5; do node --test test/account.test.js test/daily-verify.test.js test/content.test.js >/dev/null 2>&1 && echo ok || echo FAIL; done` → 다섯 번 모두 ok. `npm test` 통과.

### C-4 `npm test` 48초의 대부분이 daily-verify의 smart 봇 한 판이다
- 심각도: 중간   · 종류: 시험
- 어디: `test/daily-verify.test.js:16-26`(`botDaily`가 `playRun(run, 'smart')`) · `:53`(시험 229 — 30.7초) · `:80`(시험 233 — 15.8초)
- 무엇: 가장 느린 시험 셋이 30694ms · 15787ms · 8155ms(`황금 기물 … 4%`)이고 나머지는 거의 모두 1초 안. 같은 출력에 `다시 두기 2026-10-08 smart: 명령 300개 · 8062바이트 · 685ms` — 서버 셈(`verifyDaily`)은 0.7초이고 30초는 봇이 판을 두는 값이다. 233은 위조 줄 80여 개를 처음부터 다시 둔다(각 0.1~0.2초). 파일 하나가 전체 벽시계를 정한다.
- 고치는 방향: (1) smart 봇이 둔 명령 줄과 기대 `summarize`를 `test/fixtures/daily-2026-10-08-smart.json`으로 두고 시험은 그 파일을 다시 둔다. 규칙이 바뀌면 `bad_cmd`로 실패하는데, 그게 바라는 신호다(재생성 스크립트 `tools/fixture-daily.mjs`를 같이 두고 실패 글에 명령을 적는다). (2) 233의 위조 표본을 `cmds.length / 40` → `/ 20`으로 줄이거나 random 판으로 옮긴다. (3) `test/dopamine.test.js`의 「황금 기물 … 4%」 8초도 표본 수를 줄일 수 있는지 본다.
- 검증: `time npm test` → 벽시계 20초 안팎, 916개 통과. `node --test test/daily-verify.test.js` 5초 안.

### C-5 store.js의 진짜 SQL은 `npm test`에서 한 번도 돌지 않는다
- 심각도: 중간   · 종류: 시험
- 어디: `api/_lib/store.js` 전부(줄 세우기 `ORDER` · `putScore`의 튜플 비교 · `absorb` · `splitKey` · `bump`의 `where n < limit`) — 시험은 `test/helpers/memstore.js`(같은 꼴의 손으로 쓴 쌍둥이)만 쓴다(`test/leaderboard.test.js:2` 주석 「진짜 SQL은 tools/daily-e2e.mjs가 본다」).
- 무엇: 메서드 이름은 둘이 정확히 같다(`createStore(() => [])` vs `memStore()` 견줌: 한쪽에만 있는 것 0). 하지만 뜻(동점 순서 · `on conflict … where` 갈아 끼우기 조건 · `absorb` 차례 · 캐스케이드)은 배포 **뒤** 프로덕션 DB에 대고 돌리는 e2e로만 확인된다. SQL을 잘못 고치면 푸시 = 배포 뒤에야 안다.
- 고치는 방향: 메모리 Postgres로 `store.js`를 직접 돌리는 시험 하나. 후보 (가) `@electric-sql/pglite`를 devDependency로 두고 `db/schema.sql`을 적용한 뒤 `createStore((t, p) => db.query(t, p).then((r) => r.rows))` — CLAUDE.md 「npm 패키지는 api/만」 규칙에 시험용 devDependency를 넣어도 되는지 **사람 판단**. (나) 안 되면 `DATABASE_URL_TEST`(Neon 가지 branch)가 있을 때만 도는 시험. 같은 시나리오를 memStore와 진짜 store에 둘 다 돌려 결과를 견주면 쌍둥이의 어긋남도 잡힌다.
- 검증: `node --test test/store-sql.test.js` — 순위 동점(같은 성적은 먼저 낸 사람 · player_id), 더 좋은 판만 갈아 끼우기, `absorb` 뒤 성적 · 명령 줄 · 열쇠 옮김, `bump`가 한도에서 null, 모두 memStore와 같은 답.

### C-6 smoke의 프레임 p99 16ms 문턱이 벽시계 절대값이다(추정: 부하에서 흔들림)
- 심각도: 중간   · 종류: 시험
- 어디: `tools/smoke.mjs:2333-2338`(재기) · `:2423`(`if (pct(0.99) > 16) … fail = true`) · `:2424`(누르기 p99 > 50ms)
- 무엇: 가짜 DOM에서 그리기 시간을 `performance.now()`로 재 p99가 16ms를 넘으면 smoke 전체를 실패로 한다. 다른 하네스 · 시험이 같이 돌면 CPU가 밀려 p99가 오른다. 이번 훑기에서는 smoke를 돌리지 않아 흔들린 원문은 없다(추정).
- 고치는 방향: (1) 넘으면 그 구간만 한 번 더 재서 둘 다 넘을 때만 실패, 또는 (2) 문턱을 「같은 실행의 중앙값 × k」 꼴로, 또는 (3) 절대 문턱은 경고로 내리고 실패는 그리기 호출 수(`dom.counter.calls`) 같은 결정적인 값으로. `docs/reports/perf.md`에 기준을 적는다.
- 검증: `node tools/run.mjs --runs 300 --policy smart --seed 1 --workers 10 --limit 400`을 띄워 둔 채 `npm run smoke`를 세 번 → 세 번 다 통과(지금 꼴에서는 실패하는지 먼저 한 번 보고 적는다).

### C-7 도구 58개가 같은 Playwright 불러오기 · 정적 서버를 복사해 쓴다
- 심각도: 낮음   · 종류: 정리
- 어디: `tools/*.mjs` — `async function loadPlaywright()` 58곳(예: `tools/icons.mjs:14`), `http.createServer` 정적 서버 55곳(예: `tools/shots-gate.mjs:27-35`), `const TYPES = {…}` 변형 5가지(31곳은 `.png` · `.webmanifest`가 없어 그림이 `application/octet-stream`으로 나간다). `shots-*.mjs`만 7725줄.
- 무엇: 서버 · 브라우저 띄우기를 고치려면 50여 곳을 다 고쳐야 하고, 이미 변형이 갈렸다. 경로 검사가 `p.startsWith(ROOT)`라 `ROOT`와 이름이 앞부분만 같은 형제 폴더(`chainmate-x/`)는 통과한다(로컬 도구라 위험은 작다).
- 고치는 방향: `tools/_lib/browser.mjs`에 `loadPlaywright()` · `serveRoot({ root, patch })`(TYPES 하나, `path.relative`로 경로 검사) · `openPage({ viewport, scale })`를 두고 도구마다 import로 바꾼다. 한 커밋에 몇 개씩, 바꾼 도구는 한 번씩 돌려 본다. `.vercelignore`가 `tools/*`를 빼고 있어 배포에는 영향이 없다.
- 검증: `grep -l "async function loadPlaywright" tools/*.mjs | wc -l` → 0(또는 `_lib` 하나), `grep -l "http.createServer" tools/*.mjs | wc -l` → 1. 바꾼 도구 중 `node tools/shots-title.mjs` · `node tools/shots-leaderboard.mjs` · `node tools/drawcheck.mjs`가 전과 같이 끝난다(포트는 `listen(0)` 그대로 — 8123 · 7777 금지).

### C-8 어디서도 부르지 않는 일회용 스크린샷 · 영상 도구 16개
- 심각도: 낮음   · 종류: 도구
- 어디: 문서 · 시험 · 다른 도구 어디에도 이름이 안 나오는 것 — `tools/shots-charts-engrave.mjs` · `shots-clip.mjs` · `shots-fix-33-36.mjs` · `shots-fix-46.mjs` · `shots-fix-gamble.mjs` · `shots-fix-legend.mjs` · `shots-fragment-tip.mjs` · `shots-gate.mjs` · `shots-grade.mjs` · `shots-human-runs.mjs` · `shots-moves.mjs` · `shots-overflow.mjs` · `shots-souls.mjs` · `shots-tip-contrast.mjs` · `shots-ux.mjs` · `video-quick.mjs`
- 무엇: 특정 카드(CHM 번호) 시안을 찍으려고 만든 것들이 남아 있다. 모두 문법은 맞고(`node --check` 통과) 앱 속성 참조도 지금 코드에 있다(정적 확인). 하지만 돌려 본 적이 언제인지 알 수 없고 C-7 정리 범위를 키운다.
- 고치는 방향: 하나씩 한 번 돌려(`node tools/<이름>.mjs`) 아직 쓸모 있는 것(예: `shots-clip` — 잘린 글, `shots-gate`)은 `docs/design-notes/layout.md`나 해당 문서에 한 줄로 적어 두고, 시안용 일회 도구(`shots-fix-*`, `video-quick`)는 지운다(기록은 git과 `docs/shots/`에 남는다). 지울지 둘지는 사람이 고른다.
- 검증: `for f in tools/shots-*.mjs tools/video*.mjs; do b=$(basename $f); grep -rqs "$b" docs test tools CLAUDE.md --exclude="$b" || echo "$b"; done` → 남긴 것 0개.

### C-9 규칙 코드에 남은 id 분기 하나: 레퍼토리 「복제」
- 심각도: 낮음   · 종류: 정리
- 어디: `src/sim/run.js:326` — `if ((build.josekis || []).includes('clone')) { … dropFor = top[0]; }`
- 무엇: CLAUDE.md 「규칙 코드에 id별 분기를 박지 않는다」에 걸리는 곳은 src/sim 전체에서 이것 하나다(콘텐츠 id 문자열을 grep한 결과). 레퍼토리 정의는 이미 `pick` · `targetMult` 같은 훅을 가진다(`src/sim/run.js:310` `josekiTargetMult`, `:880` `j.pick`). `:789 id === 'potion'`은 물건 종류 나누기(`it.kind === 'maxim'`과 같은 꼴)라 그대로 둬도 된다.
- 고치는 방향: `src/data/josekis.js`의 `clone` 정의에 `familyDrop(counts) → 가족 id | null` 훅을 두고, `battleMods`는 `for (const id of build.josekis) { const j = JOSEKI_BY_ID[id]; if (j && j.familyDrop) dropFor = j.familyDrop(counts) ?? dropFor; }`. 동점일 때 `Object.entries` 차례로 고르는 지금 뜻을 그대로 옮긴다.
- 검증: `node --test test/joseki.test.js test/family.test.js test/daily-verify.test.js` 통과, `node tools/run.mjs --runs 300 --policy smart --seed 1 --workers 10 --limit 400 --dump`의 결과가 고치기 전 dump와 같다(규칙이 안 바뀜).

### C-10 한도 표(link_limits)는 코드를 받을 때만 청소된다
- 심각도: 낮음   · 종류: 정리
- 어디: `api/_lib/store.js:92`(`delete from link_limits where at < now() - interval '2 days'`가 `putCode` 안에만 있다)
- 무엇: `save`(플레이어마다 하루 한 줄) · `playerall` · `loginkey` · `redeem` · `code` · `signup` 줄이 계속 쌓이는데 지우는 때는 누군가 「코드 받기」를 누를 때뿐이다. 코드 받기는 드문 동작이라 표가 사실상 계속 자란다(`tools/db-migrate.mjs:37`의 고아 정리도 사람이 돌릴 때만). 지금 규모에서는 작지만 줄 수가 활성 플레이어 × 날짜로 늘어난다.
- 고치는 방향: 청소를 `putCode`에서 떼어 `store.sweep()`으로 두고 (가) Vercel Cron(하루 한 번 `GET /api/sweep` — 함수 수 한도 12 안인지 확인, 지금 8개) 또는 (나) `savePut` · `submit` 성공 뒤 1% 확률로 부른다. `link_codes`의 지난 코드 청소도 같이 옮긴다.
- 검증: memStore에 `sweep`을 같이 두고 `node --test test/link.test.js test/leaderboard.test.js`. 진짜 SQL은 C-5 시험이 생기면 거기서.

### C-11 판 저장이 저장소가 꽉 차서 실패해도 아무도 모른다(추정)
- 심각도: 낮음   · 종류: 버그
- 어디: `src/ui/app.js:305`(`store.set(KEYS.run, r)`의 참거짓을 버린다) · `src/ui/runlog.js:12-19`(`keepRow`는 **제 쓰기**가 실패할 때만 오래된 판을 덜어 낸다) · `src/sim/runlog.js:9`(`RUNLOG_MAX = 200`)
- 무엇: 사람 판 기록은 판마다 한 줄씩 200개까지 쌓인다. 봇 판으로 잰 한 줄 크기는 이긴 판 13.2KB · 진 판 7.9KB(`scan/code/rowsize.mjs`), 사람 판은 `buys`가 더 붙는다. 200줄이면 2~3MB라 기록 + 진행 중 판(17KB + 오늘의 대국 `cmds` 5~10KB) + 클라우드 상태를 더하면 브라우저 한도(대개 5MB)에 가까워질 수 있다. 그때 `keepRow`는 스스로 줄여 성공하지만, 그 뒤 매 명령의 판 저장(`app.save`)과 기록 저장(`saveRecords`)은 조용히 실패한다 — 다시 켜면 진행이 사라진다. 실제로 꽉 찬 기기를 본 것은 아니라 추정.
- 고치는 방향: `makeStore.set`이 실패하면 `KEYS.runs`를 4분의 1씩 덜고 한 번 더 쓰는 `setOrMakeRoom`을 두고 `app.save` · `saveRecords`가 그것을 쓴다. 또는 판 기록을 줄 수가 아닌 바이트(예: 1.5MB)로 자른다.
- 검증: `test/runlog.test.js`에 가짜 storage(총량 1MB에서 `setItem`이 던짐)로 판 기록을 가득 채운 뒤 `app.save()`가 판을 남기는지 보는 시험 → 통과. `npm test`.

### C-12 미리 보기 배포가 제 규칙으로 프로덕션 순위에 쓸 수 있다(추정: 배포 보호 설정에 달림)
- 심각도: 낮음   · 종류: 보안
- 어디: `api/_lib/http.js:10`(`BUILD`), `api/_lib/service.js` `submit` — `VERCEL_ENV`를 어디서도 보지 않는다(`grep -rn VERCEL_ENV api` 0건). CLAUDE.md 「미리 보기 배포도 프로덕션과 같은 DB를 쓴다」.
- 무엇: 미리 보기 배포의 `/api/hello`가 준 build로 그 배포의 `/api/daily/submit`에 내면, 그 가지의 규칙(실험 중인 쉬운 수치일 수도)으로 다시 둔 성적이 프로덕션 `daily_scores`에 오른다. 화면은 `RANK_HOSTS`에서만 부르니 일부러 API를 두드려야 한다. 미리 보기 주소가 Vercel 배포 보호(로그인)로 막혀 있으면 위험이 거의 없다 — 그 설정은 확인하지 못했다.
- 고치는 방향: 쓰기 길(`submit` · `player` 만들기 · `link/*` · `save` PUT · `account/*`)은 `process.env.VERCEL_ENV === 'production'`이 아니면 403 `preview_readonly`(도구용으로 `ALLOW_PREVIEW_WRITES=1` 환경 변수로만 풀기). 또는 Vercel 환경 변수에서 Preview용 `DATABASE_URL`을 Neon 가지로 나눈다(사람이 설정).
- 검증: `test/leaderboard.test.js`에 `VERCEL_ENV=preview`에서 submit이 403, production에서 200인 시험. 배포 보호 상태는 `vercel project inspect` 또는 대시보드에서 사람이 확인.

### C-13 대기열의 판이 날짜가 넘어가면 서버가 받을 수 있어도 버려진다
- 심각도: 낮음   · 종류: 버그
- 어디: `src/ui/rank.js:129`(`if (q.date !== today()) { dequeue(null); … }`) vs `api/_lib/service.js` `submit`(`dateSpan: 1` — 서버는 ±1일을 받는다)
- 무엇: 자정 직전에 오늘의 대국을 끝냈는데 망이 끊겨 대기열에 들어가면, 자정을 넘겨 다시 켤 때 `q.date`(어제)가 `today()`와 달라 버린다. 서버는 어제 날짜를 아직 받는다. 문서(leaderboard.md 「대기열」 「그날 것이 아니면 버린다」)대로이긴 하지만 서버 규칙보다 좁다.
- 고치는 방향: `Math.abs(dayGap(q.date, today())) <= 1`이면 보낸다(`shiftDate`가 이미 있다). 문서 줄도 「하루 넘게 지난 것은 버린다」로.
- 검증: `test/rank.test.js`에 `today`를 하루 옮긴 뒤 `rank.retry()`가 제출을 한 번 부르는지, 이틀 옮기면 버리는지 → 통과.

### C-14 기록 합치기 무작위 시험이 업적 쪽 여섯 칸을 비운 채로 잰다
- 심각도: 낮음   · 종류: 시험
- 어디: `test/merge.test.js:11-30`(`randomRecords`)
- 무엇: 교환 · 결합 · 멱등 300쌍 시험이 `achv` · `feats` · `mastersBeaten` · `synergyTop` · `openingDan` · `josekiDan`에 값을 넣지 않는다(모두 `emptyRecords()`의 빈 `{}`). 이 칸들의 규칙(`union`, `src/ui/merge.js` RULES)은 법칙 시험을 한 번도 안 받는다. 특히 `openingDan`의 「0 = 단 0으로 이겼다」는 열쇠가 있는지가 뜻이라 합칠 때 0이 사라지면 안 된다.
- 고치는 방향: `randomRecords`에 여섯 칸을 무작위로 채운다(`openingDan`은 0을 포함한 값). 0을 가진 열쇠가 합친 뒤에도 남는지 따로 한 줄 검사.
- 검증: `node --test test/merge.test.js` 통과(지금 규칙으로도 통과할 것으로 본다 — 실패하면 그게 버그).

### C-15 기록 보내기 표에 `link_redeem`의 `reason: 'account'`가 빠졌다
- 심각도: 낮음   · 종류: 정리
- 어디: `docs/design-notes/telemetry.md:75` · `src/ui/telemetry.js:320`(주석) — 실제 값은 `src/ui/rank.js` `linkRedeem`의 `409: 'account'` → `linkRedeemProps`(`src/ui/telemetry.js:330`)가 그대로 싣는다. 화면 글 `src/ui/screens/link.js:59` `REDEEM_FAIL.account`.
- 무엇: 계정이 붙은 기기에서 코드를 넣으면 `reason: 'account'`가 나가는데 표에는 `bad · expired · self · limit · unreached · null`뿐이다. `test/telemetry.test.js`는 값 목록을 재지 않는다.
- 고치는 방향: 표 · 주석에 `account`(계정이 붙은 기기 — 코드는 계정 쪽에서 받는다)를 더한다.
- 검증: `grep -n "account" docs/design-notes/telemetry.md | grep link_redeem` 한 줄.

### C-16 지운 그림 파일 · 도구를 지금 있는 것처럼 적은 문서
- 심각도: 낮음   · 종류: 정리
- 어디: `docs/design-notes/layout.md:348`(`src/render/art16.js` · `node tools/art-hi.mjs` · `art-hi.js`를 지금 길로 설명) · `:374`(`tools/shots-shop-art.mjs`로 잰다) — 같은 파일 `:236`과 `docs/design-notes/art3.md:131-176`은 모두 지웠다고 적었다. `docs/tasks/handoff-touch.md:45` · `handoff-pieces.md:39`의 `src/ui/i18n/en.js`(실제는 `src/data/i18n/en.js`).
- 무엇: 다음 세션이 layout.md를 믿고 없는 도구를 찾게 된다.
- 고치는 방향: layout.md 348 · 374줄을 「지웠다(2026-10-24) — 지금은 `emblems.js` · `art.js` 벡터, 재기는 `test/art.test.js` · `tools/shots-assets3.mjs`」로 줄이고, handoff 문서의 경로를 고치거나 다 끝난 지시서면 그대로 둔다(사람 판단).
- 검증: `grep -rhoE "\`(src|tools|test)/[A-Za-z0-9_./-]+\`" CLAUDE.md docs/design-notes | tr -d '\`' | sort -u | while read p; do [ -e "$p" ] || echo "$p"; done` → 「지웠다」 문맥의 art3.md 항목 말고는 0줄.

### C-17 화면이 바로 시험되지 않는 모듈
- 심각도: 낮음   · 종류: 시험
- 어디: 어느 `test/*.js`도 import하지 않는 것 — `src/ui/peek.js`(85줄, 관 선택 판 보기 그리기) · `src/ui/ignite.js`(135) · `src/ui/parts-depth.js`(267) · `src/ui/marks.js`(85) · `src/ui/fold.js`(64) · `src/ui/screens/awaken.js`(121) · `chest.js`(137) · `reward.js`(140) · `pause.js`. smoke가 이름을 적게 부르는 화면: `highlight` 2회 · `settings` 2회 · `link` 3회.
- 무엇: 대부분 smoke · boot 시험을 지나며 그려지기는 하지만, 레이아웃 어김(drawcheck) 밖의 뜻(예: 상자 열기 `chest`의 칸 멈춤 차례, `reward` 줄 차례)은 따로 재지 않는다.
- 고치는 방향: `test/layout.test.js`가 다른 화면에 하는 것처럼 `awaken` · `chest` · `reward`를 한 번 열어 `animating()`이 끝에 거짓이 되는지, `checkLayout()` 어김 0인지 보는 시험을 더한다.
- 검증: 새 시험 포함 `npm test` 통과, `node tools/drawcheck.mjs` 어김 0.

---

## 확인했고 문제 없음
다음 세션이 다시 훑지 않아도 되는 것.
- `src/sim` · `src/data`: `Math.random` · `Date` · `performance` · DOM · canvas 0건(`names.js randomName`의 기본 인자는 서버만 씀). Set · Map · Infinity를 상태에 넣는 곳 없음.
- `api/_lib/verify.js` `SHAPES`: `applyRun`의 명령 종류 23개와 모두 맞고, 화면이 만드는 명령(`battle.js` · `shop.js` · `pack.js`)에 딴 칸이 없다.
- `runRow`(`src/sim/runlog.js`) vs `tools/run.mjs one()`: 다른 열쇠는 봇만 내는 `sac` 하나이고 `test/runlog.test.js` `BOT_ONLY`가 이미 선언.
- 기록 칸: 화면이 쓰는 칸(`rec.*` · `app.records.*`) 모두 `merge.js RULES`에 있다(`movesSeen` · `runNew` 포함). `test/merge.test.js:115`가 지킨다.
- `memStore`와 `createStore`의 메서드 이름이 정확히 같다.
- `api/`: SQL 모두 매개변수 바인딩, 열쇠는 `Authorization` 머리말로만(본문 · 주소의 `key`는 버림), 500은 `server`만, 출처 확인 · 본문 한도 · 계정 길 4KB 한도, 없는 아이디도 가짜 해시 견줌. 열쇠 · 비번이 로그 · 기록 보내기 · 오류 답에 실리는 길은 찾지 못했다.
- `src/ui/textfield.js`: 그 프레임에 안 부른 칸과 빈 form을 치운다. `animating()`: 스스로 안 움직이는 화면은 모두 `false`이고, 없는 것은 하늘이 움직이는 `title`뿐(의도).
- 그리기 캐시(`text.js` · `gfx.js` · `vec.js` · `board3.js` · `pieces3.js` · `night.js` · `parts.js` · `sway.js` · `lang.js`)는 크기 한도가 있거나 열쇠가 유한(빛깔 · 배율 · 기물 종류)하다. `app.stats.drawMs`도 20000개까지.
- 비동기: 순위 · 저장 부름(`rank.js call`)은 거절하지 않고 `{ status: 0 }`으로 돌려준다. 화면의 `.then`들은 거절 쪽이 없어도 새는 상태가 없다. 망 답 뒤 다시 그리기는 `main.js seenFetch`가 한다.
- 도구: `tools/*.mjs` 전부 `node --check` 통과, 상대 경로 import가 가리키는 파일은 모두 있다.
