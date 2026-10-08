# 기록 보내기 (CHM-63)

사람 판의 수치(전체 승률 · 무엇을 골랐을 때 승률 · DAU · MAU · 다시 오는 비율)를 한곳에서 보려고, 우리가 고른 사건만 PostHog(US Cloud)로 보낸다. 기기의 판 기록(`human-runs.md`)은 그대로 남는다.

- 모듈: `src/ui/telemetry.js`(큐 · 묶어 보내기 · 익명 ID · 세션 · 끄기 · 판 사건 표). 공개 키와 주소는 `src/config.js`.
- PostHog의 JS 라이브러리는 쓰지 않는다. 바깥 스크립트 없이 `fetch` · `navigator.sendBeacon`으로 `POST https://us.i.posthog.com/batch/`(`{ api_key, batch: [{ event, distinct_id, properties, timestamp }] }`, 본문 `text/plain`).
- 자동 수집(누름 · 화면 녹화 · 히트맵 · 쪽 보기)은 없다.

## 보내는 조건
아래를 모두 만족할 때만 나간다. 하나라도 어긋나면 큐에도 넣지 않고, 익명 ID도 만들지 않는다.

| 조건 | 어디서 |
|---|---|
| 호스트가 `chainmate.papercut.kr`(`src/config.js` `TELEMETRY_HOSTS`)이거나 앱(Tauri) | `createTelemetry` `allowed` |
| `navigator.webdriver`가 거짓(자동화 브라우저 · 스크린샷 도구 제외) | 같은 곳 |
| 설정 「기록 보내기」 켬(`settings.telemetry`, 기본 켬) | `enabled()` |
| 수업 · 대본 대국 · scratch 판이 아님(판 기록과 같은 기준) | `app.track`(scratch) · `commandEvents`(대본 대국) |

- 예외로 늘 나가는 것(조건 위 셋은 그대로): 튜토리얼 진행(`tutorial_*` · `lesson_done`) · `setting_change` · `rank_submit` · `name_reroll` · 기기 잇기(`link_code` · `link_redeem` · `link_unlink` · `save_sync`) · 오류.
- localhost(8123 포함) · Vercel 미리 보기 주소 · smoke · Playwright 도구에서는 0건이다. smoke는 가짜 `fetch` · `sendBeacon` 셈을 「기록 보내기: 0건」으로 찍고, `tools/shots-telemetry.mjs`가 크로미움 · 웹킷에서 로컬 0건과 배포 주소인 척(가로챔) 묶음이 나가는 것을 본다.

## 익명 방침
- 사람은 무작위 UUID 하나(`localStorage` `chainmate.tid.v1` = `{ id, since }`)로만 센다. 이름 · 이메일 · 계정이 없다. 브라우저 저장을 지우거나 기기 · 브라우저를 바꾸면 새 사람으로 세어진다(DAU · 잔존이 그만큼 부풀 수 있다).
- 사건마다 `$process_person_profile: false`(사람 프로필을 만들지 않는다) · `$geoip_disable: true` · `$ip: '0.0.0.0'`(IP와 그로 어림한 위치를 남기지 않는다). 프로젝트 설정 「Discard client IP data」도 켜 두면 서버 쪽에서 한 번 더 막는다.
- UA 글자 · 주소 · 리퍼러는 보내지 않는다. 브라우저는 엔진 어림(`webkit` · `chromium` · `gecko`)만.
- 순위(CHM-70, `leaderboard.md`)의 플레이어 열쇠는 이 익명 ID와 다른 값이고 서로 잇지 않는다. 순위 서버(`api/`)로 가는 요청은 기록 보내기 설정과 상관없다 — 오늘의 대국을 순위에 낼 때만 나간다.
- 판 시드는 `run_start`에 싣지 않는다. `run_end`의 `row`(판 요약 한 줄) 안에만 있다 — 하네스와 같은 판을 다시 두어 견주는 데 쓰고, 사람을 가리키지 않는다.
- 처음 켠 첫 화면 맨 위에 한 번 「판 결과를 이름 없이 모은다 · 설정에서 끌 수 있다」(`screens/title.js` `drawNote`, 무엇이든 누르면 사라진다, 본 것은 `records.coachSeen.telemetry` — 설정 「다시 보기」로 되살아난다). 떠 있는 동안 설정 칸에 금빛 테가 깜박인다.
- 설정 「기록 보내기」를 끄는 순간 `telemetry_off` 하나를 곧바로 보내고 그 뒤로는 아무것도 나가지 않는다. 가리키면 제목 자리에 「이름 없이 판 결과만 보낸다 · 화면은 보지 않는다」.

## 보내기
- 스무 건이 차면 곧바로, 그 전에는 10초 뒤에 한 묶음으로. 화면이 숨거나 떠날 때(`pagehide` · `visibilitychange hidden`) 남은 것을 `sendBeacon`으로(스무 건 · 60KB씩).
- 실패하면 그 묶음을 다음 차례에 한 번만 더 보내고 버린다. 못 보낸 채 쌓이는 것은 200건까지(오래된 것부터 버린다). 게임은 결과를 모른다.
- 사건 하나가 30KB를 넘으면 `row`에서 `log` → `buys` → `lostAt` 차례로 빼고 `row_trimmed: true`.

## 공통 속성
`app_version`(`src/version.js`) · `platform`(web · desktop · ios) · `engine` · `lang` · `dan`(연 단, `records.unlocked.dan`) · `screen_w` · `screen_h`(창 크기, CSS 화소) · `scale`(뒷면 캔버스 배율) · `$session_id`(켤 때마다 새 UUIDv7) · `$lib: chainmate`.

## 사건 표
판 사건은 화면이 따로 부르지 않는다. `app.cmd`가 명령마다 규칙 사건(`applyRun`의 events)을 `telemetry.js`의 표(`EVENT_MAP` · `commandEvents`)로 옮긴다. 규칙 사건으로 못 잡는 것만 화면이 `app.track`을 부른다(★).

| 사건 | 속성 | 왜 |
|---|---|---|
| `app_open` | `first` · `days_since_first` | 켤 때 한 번. DAU · MAU · 잔존의 뿌리 |
| `tutorial_step` | `step`(걸음 번호, `src/ui/tutorial.js` 차례) | 첫 판 대본 대국에서 어디까지 따라오나 |
| `tutorial_done` · `tutorial_skip` | `won` | 대본 대국을 끝냈나 · 건너뛰었나 |
| `lesson_done` ★ | `id` | 수업을 어디까지 하나 |
| `run_start` | `dan` · `opening` · `daily` · `script`(첫 대국이 대본) | 시작한 판 수(끝낸 판과 견준다) |
| `run_end` | `row`(`runRow` 한 줄 통째 — 열쇠는 `human-runs.md`) + `won` · `end`(win · lose · quit · endless) · `ante` · `blind` · `dan` · `opening` · `daily` · `josekis[]` · `maxims[]`(판 끝에 가진 것) · `legends[]` · `families_max` · `skips` · `holds` · `ignite_at` · `brilliants` · `battles` · `duration_s` | 판 승률 · 선택별 승률의 재료 |
| `battle_end` | `ante` · `blind` · `kind` · `won` · `reason`(mate · target · gomoku · moves · stuck) · `ratio`(점수 ÷ 목표) · `moves_used` · `first_move_win` · `sacrifices` | 관별 통과 · 아슬아슬함 · 첫 수 승리 |
| `draft_pick` | `ante` · `offered[]` · `picked` | 레퍼토리: 보인 것 가운데 무엇을 골랐나 |
| `shop_buy` | `ante` · `kind` · `id` · `price` · `held`(찜해 넘어온 카드) | 무엇을 사나(꾸러미는 `kind: pack`) |
| `shop_leave` | `ante` · `money_left` · `bought` · `rerolls` · `shown[{kind,id}]` | 안 산 것까지 — 진열의 고른 비율 |
| `pack_pick` | `ante` · `kind` · `offered[{kind,id}]` · `picked{kind,id}` 또는 `skipped` | 꾸러미에서 무엇을 고르나 · 넘기나 |
| `skip_blind` | `ante` · `blind` · `tag` | 어떤 패에 대국을 건너뛰나 |
| `hold` | `ante` · `kind` · `id` | 무엇을 찜하나 |
| `ignite` | `ante` · `by` · `captures` | 점화가 언제 · 무엇으로 오나 |
| `brilliant` · `legend_done` · `awaken` · `clock_lost` | `ante` · `blind` / `id` / `soul` / `ante` · `blind` · `clock` | 드문 순간이 얼마나 자주 오나 |
| `review_open` ★ · `review_replay` ★ | `ante` · `kind` | 복기 카드를 보나 · 다시 두나 |
| `peek_hover` ★ | `ante` · `blind` | 판 보기 큰 판을 가리켜 보나(판마다 첫 번만) |
| `setting_change` ★ | `key` · `value` | 무엇을 바꾸나 |
| `rank_open` ★ | `tab`(today · yesterday) | 순위 화면을 여나 · 어제 것을 보나(CHM-70) |
| `rank_submit` | `ok`(순위에 올랐나) · `improved`(그날 기록을 갈아 끼웠나) · `rank` · `total` · `stale`(새 배포라 내지 못함) | 오늘의 대국이 순위에 닿는 비율. `app.js`가 제출 결과마다 한 번(`telemetry.js` `rankSubmitProps`). 이름(번호) · 열쇠 · 점수는 싣지 않는다 |
| `name_reroll` ★ | — | 이름을 다시 짓는 사람 수 |
| `link_code` | — | 기기 잇기 화면에서 코드를 받은 수(CHM-71) |
| `link_redeem` | `ok` · `reason`(bad · expired · self · limit · unreached, 이어졌으면 null) | 코드를 넣어 이어지는 비율 · 왜 실패하나(`telemetry.js` `linkRedeemProps`). 열쇠 · 코드 · 이름은 싣지 않는다 |
| `link_unlink` | — | 이 기기를 뗀 수 |
| `save_sync` | `pulled` · `pushed` · `conflict` | 클라우드 저장을 당긴 · 올린 · 어긋난(409) 수. **하루 한 번 요약** — 매번 보내지 않고 날이 바뀐 뒤 처음 맞출 때 지난 날의 수를 보낸다(`cloud.js` · `saveSyncProps`) |
| `telemetry_off` | — | 보내기를 끈 사람 수 |
| `$exception` | `$exception_list`(PostHog Error Tracking 꼴) · `screen` · `app_version` | `window.onerror` · `unhandledrejection`. 같은 메시지 + 첫 스택 줄은 세션에 한 번, 세션당 5건 |

알아 둘 것:
- 이긴 뒤 끝없는 대국을 이어 두면 같은 판(`row.id`)의 `run_end`가 두 번 온다(`end: win` → `endless`). 승률은 `end in (win, lose)`로 센다.
- 끝난 판의 복기 결과(`log[].replay`)는 `run_end`가 나간 뒤에 붙어 `row`에 없다. `review_open`의 `kind`로 본다.
- 판의 첫 `__autoDraft`(스크린샷 도구) · 옛 저장에서 이어 둔 판의 앞부분은 사건이 없다.

## PostHog에서 보기
사람이 한 번 해 둘 것: 프로젝트 설정에서 「Discard client IP data」 켜기 · Error tracking 켜기 · 슬랙 알림 연결 · 대시보드 만들기(아래 질의를 SQL 인사이트로 붙인다).

질의는 Product analytics → New insight → SQL(HogQL)에 그대로 붙인다. 개인 API 키가 없어 여기 질의는 돌려 보지 못했다 — 불리언 · 배열 속성 읽는 자리(`toString(…) = 'true'` · `JSONExtractArrayRaw`)가 안 맞으면 그 줄을 고친다. `selftest`는 `tools/telemetry-selftest.mjs`가 보낸 확인용 사건이다.

판 승률(지난 30일):
```sql
select count() as runs,
       countIf(toString(properties.won) = 'true') as wins,
       round(100 * wins / runs, 1) as win_pct
from events
where event = 'run_end' and properties.`end` in ('win', 'lose')
  and properties.selftest is null and timestamp > now() - interval 30 day
```

단별 승률:
```sql
select toInt(properties.dan) as dan, count() as runs,
       round(100 * countIf(toString(properties.won) = 'true') / runs, 1) as win_pct
from events
where event = 'run_end' and properties.`end` in ('win', 'lose') and properties.selftest is null
group by dan order by dan
```

레퍼토리별 고른 판 · 승률:
```sql
select replaceAll(arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.josekis), '[]'))), '"', '') as joseki,
       count() as runs,
       round(100 * countIf(toString(properties.won) = 'true') / runs, 1) as win_pct
from events
where event = 'run_end' and properties.`end` in ('win', 'lose') and properties.selftest is null
group by joseki order by runs desc
```

격언별 가진 판 · 승률(판 끝에 가진 격언):
```sql
select replaceAll(arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.maxims), '[]'))), '"', '') as maxim,
       count() as runs,
       round(100 * countIf(toString(properties.won) = 'true') / runs, 1) as win_pct
from events
where event = 'run_end' and properties.`end` in ('win', 'lose') and properties.selftest is null
group by maxim having runs >= 5 order by win_pct desc
```

끝난 관 분포(진 판 · 그만둔 판):
```sql
select toInt(properties.ante) as ante,
       countIf(properties.`end` = 'lose') as lost,
       countIf(properties.`end` = 'quit') as quit
from events
where event = 'run_end' and properties.selftest is null
group by ante order by ante
```

첫 판 튜토리얼 깔때기(사람 수). 걸음 번호는 `src/ui/tutorial.js` `TUTORIAL_STEPS` 차례(0 인사 · 6 둘째 수 시작 · 14 셋째 수 · 20 넷째 수):
```sql
select uniqIf(distinct_id, event = 'app_open' and toString(properties.first) = 'true') as opened,
       uniqIf(distinct_id, event = 'run_start' and toString(properties.script) = 'true') as started,
       uniqIf(distinct_id, event = 'tutorial_step' and toInt(properties.step) >= 6) as move2,
       uniqIf(distinct_id, event = 'tutorial_step' and toInt(properties.step) >= 20) as move4,
       uniqIf(distinct_id, event = 'tutorial_done') as done,
       uniqIf(distinct_id, event = 'tutorial_skip') as skipped,
       uniqIf(distinct_id, event = 'battle_end') as played_on
from events
where properties.selftest is null and timestamp > now() - interval 30 day
```
같은 것을 Funnel 인사이트로도 만든다: `app_open`(first = true) → `tutorial_step` → `tutorial_done` → `battle_end`.

DAU(날마다) · MAU:
```sql
select toDate(timestamp) as day, uniq(distinct_id) as dau
from events
where event = 'app_open' and properties.selftest is null and timestamp > now() - interval 30 day
group by day order by day
```
```sql
select uniq(distinct_id) as mau
from events
where event = 'app_open' and properties.selftest is null and timestamp > now() - interval 30 day
```
다시 오는 비율은 Retention 인사이트(시작 · 돌아옴 모두 `app_open`, 날 단위)로 본다. `app_open`의 `days_since_first`로도 어림한다.

## `humans.mjs --posthog`
모인 `run_end`의 `row`를 내려받아 내보낸 JSON과 같은 표로 찍는다: 판 승률 · 관별 도달 · 희생 · 탁월수 · 시너지 · 진 대국의 자리 · 끝난 관 · 레퍼토리 · 격언 · 시너지별 고른 판 수와 그 판 승률 · 단별. `--vs`로 하네스 dump와 나란히.

```
POSTHOG_PERSONAL_KEY=phx_… POSTHOG_PROJECT_ID=12345 node tools/humans.mjs --posthog [--days 90] [--vs <run.mjs --dump 파일>]
```
- 개인 API 키(읽기, `query:read` 권한)와 프로젝트 id는 환경 변수로만 넣는다. 저장소에 적지 않는다. 없으면 안내 한 줄을 내고 끝난다.
- 질의와 응답 읽기는 `tools/posthog.mjs`(`rowsQuery` · `parseRows` — 같은 `row.id`는 뒤의 것으로 갈아 끼우고, `row_trimmed` 판은 대국 줄 없이 판 단위 수치에만 든다). 실제 호출은 키가 없어 못 해 봤고, 응답 꼴을 흉내 낸 시험(`test/telemetry.test.js`)으로 읽기만 쟀다.
- 진짜 수집 확인은 `node tools/telemetry-selftest.mjs` — `selftest-…` ID로 `app_open` · `run_end` 한 벌을 보낸다(Activity에서 그 ID로 찾는다).
