# 기록 보내기 (CHM-63)

사람 판의 수치(승률 · 선택별 승률 · DAU · MAU · 잔존)를 보려고, 고른 사건만 PostHog(US Cloud)로 보낸다. 기기의 판 기록(`human-runs.md`)은 그대로 남는다.

- 모듈 `src/ui/telemetry.js`(큐 · 묶어 보내기 · 익명 ID · 세션 · 끄기 · 판 사건 표), 공개 키와 주소는 `src/config.js`.
- PostHog JS 라이브러리는 쓰지 않는다. `fetch` · `navigator.sendBeacon`으로 `POST https://us.i.posthog.com/batch/`(`{ api_key, batch: [{ event, distinct_id, properties, timestamp }] }`, 본문 `text/plain`).
- 자동 수집(누름 · 화면 녹화 · 히트맵 · 쪽 보기)은 없다.

## 보내는 조건
모두 만족할 때만 나간다. 하나라도 어긋나면 큐에도 넣지 않고 익명 ID도 만들지 않는다.

| 조건 | 어디서 |
|---|---|
| 호스트가 `chainmate.papercut.kr`(`TELEMETRY_HOSTS`)이거나 앱(Tauri) | `createTelemetry` `allowed` |
| `navigator.webdriver`가 거짓 | 같은 곳 |
| 설정 「플레이 기록 전송」 켬(`settings.telemetry`, 기본 켬) | `enabled()` |
| 수업 · scratch 판이 아님 | `app.track`(scratch) |

- 넷째 조건 없이 나가는 것(위 셋은 그대로): `tutorial_offer` · `lesson_*` · `setting_change` · `rank_submit` · `name_reroll` · `link_*` · `save_sync` · `account_*` · `unlock_tier` · `unlocks_open` · 오류.
- 로컬 · 미리 보기 배포 · smoke · Playwright 도구에서는 0건이다(smoke 「기록 보내기: 0건」, `tools/shots-telemetry.mjs`가 로컬 0건과 배포 주소인 척한 묶음을 본다).

## 익명 방침
- 사람은 무작위 UUID 하나(`chainmate.tid.v1` = `{ id, since }`)로만 센다. 저장을 지우거나 기기를 바꾸면 새 사람이다.
- 사건마다 `$process_person_profile: false` · `$geoip_disable: true` · `$ip: '0.0.0.0'`. PostHog 프로젝트의 「Discard client IP data」도 켠다.
- UA 글자 · 주소 · 리퍼러는 보내지 않는다. 브라우저는 엔진 어림(`webkit` · `chromium` · `gecko`)만.
- 순위의 플레이어 열쇠(`leaderboard.md`)와 이 익명 ID는 잇지 않는다.
- 판 시드는 `run_end`의 `row` 안에만 있다(하네스와 견주는 데 쓴다).
- 처음 켠 첫 화면 맨 위에 한 번 알림 한 줄(`screens/title.js` `drawNote`, 누르면 사라진다, `records.coachSeen.telemetry`).
- 설정을 끄는 순간 `telemetry_off` 하나를 보내고 그 뒤로는 아무것도 나가지 않는다.

## 보내기
- 스무 건이 차면 곧바로, 그 전에는 10초 뒤에 한 묶음. 화면이 숨거나 떠날 때 남은 것을 `sendBeacon`으로(스무 건 · 60KB씩).
- 실패한 묶음은 한 번만 더 보내고 버린다. 쌓이는 것은 200건까지(오래된 것부터 버린다).
- 사건 하나가 30KB를 넘으면 `row`에서 `log` → `buys` → `lostAt` 차례로 빼고 `row_trimmed: true`.

## 공통 속성
`app_version`(`src/version.js`) · `platform`(web · desktop · ios) · `engine` · `lang` · `dan`(`records.unlocked.dan`) · `screen_w` · `screen_h` · `scale` · `$session_id`(켤 때마다 새 UUIDv7) · `$lib: chainmate`.

## 사건 표
판 사건은 화면이 부르지 않는다. `app.cmd`가 규칙 사건(`applyRun`의 events)을 `telemetry.js`의 표(`EVENT_MAP` · `commandEvents`)로 옮긴다. 규칙 사건으로 못 잡는 것만 화면이 `app.track`을 부른다(★). **규칙 사건이나 `runRow`를 바꾸면 이 표 · `telemetry.js` · `test/telemetry.test.js`도 바꾼다.**

| 사건 | 속성 |
|---|---|
| `app_open` | `first` · `days_since_first` |
| `tutorial_offer` ★ | `pick`(lesson · play · close — 처음 켬 덮개에서 고른 것) |
| `lesson_start` ★ · `lesson_done` ★ | `id`(`src/ui/lessons.js` 수업) |
| `run_start` | `dan` · `opening` · `daily` |
| `run_end` | `row`(`runRow` 한 줄 통째 — 열쇠는 `human-runs.md`) + `won` · `end`(win · lose · quit · endless) · `ante` · `blind` · `dan` · `opening` · `daily` · `josekis[]` · `maxims[]` · `legends[]` · `families_max` · `skips` · `holds` · `ignite_at` · `brilliants` · `battles` · `duration_s` |
| `battle_end` | `ante` · `blind` · `kind` · `won` · `reason`(mate · target · gomoku · moves · stuck) · `ratio` · `moves_used` · `first_move_win` · `sacrifices` |
| `draft_pick` | `ante` · `offered[]` · `picked` |
| `shop_buy` | `ante` · `kind` · `id` · `price` · `held` |
| `shop_leave` | `ante` · `money_left` · `bought` · `rerolls` · `shown[{kind,id}]` |
| `pack_pick` | `ante` · `kind` · `offered[{kind,id}]` · `picked{kind,id}` 또는 `skipped` |
| `skip_blind` | `ante` · `blind` · `tag` |
| `hold` | `ante` · `kind` · `id` |
| `ignite` | `ante` · `by` · `captures` |
| `brilliant` · `legend_done` · `awaken` · `clock_lost` | `ante` · `blind` / `id` / `soul` / `ante` · `blind` · `clock` |
| `review_open` ★ · `review_replay` ★ | `ante` · `kind` |
| `peek_hover` ★ | `ante` · `blind`(판마다 첫 번만) |
| `setting_change` ★ | `key` · `value` |
| `rank_open` ★ | `tab`(today · yesterday) |
| `rank_submit` | `ok` · `improved` · `rank` · `total` · `stale` — 제출 결과마다(`rankSubmitProps`). 이름 · 열쇠 · 점수 없음 |
| `name_reroll` ★ | — |
| `highlight_open` ★ · `highlight_save` ★ | — |
| `highlight_share` ★ | `ok`(공유 시트에서 끝까지 보냈나). 그림 · 이름 · 판 내용 없음 |
| `unlock_tier` | `tier`(1 ~ 20) · `gates` — 판이 끝나 단계가 오를 때마다(`finishRun`, `unlockTierProps`) |
| `unlocks_open` ★ | `from`(codex · result) · `tier` |
| `account_signup` | `ok` · `reason`(`taken` · `username` · `weak` · `has` · `limit` · `unreached` · null) |
| `account_login` | `ok` · `reason`(`bad` · `locked` · `other` · `unreached`) |
| `account_logout` · `account_delete` | — |
| `account_password` | `reset` |
| `link_code` · `link_unlink` | — |
| `link_redeem` | `ok` · `reason`(bad · expired · self · limit · unreached · null) |
| `save_sync` | `pulled` · `pushed` · `conflict` — **하루 한 번 요약**(날이 바뀐 뒤 처음 맞출 때 지난 날의 수, `saveSyncProps`) |
| `telemetry_off` | — |
| `$exception` | `$exception_list`(PostHog Error Tracking 꼴) · `screen` · `app_version` — `window.onerror` · `unhandledrejection`. 같은 메시지 + 첫 스택 줄은 세션에 한 번, 세션당 5건 |

아이디 · 비번 · 열쇠 · 코드 · 이름은 어느 사건에도 싣지 않는다.

알아 둘 것:
- 이긴 뒤 끝없는 대국을 이어 두면 같은 판(`row.id`)의 `run_end`가 두 번 온다(`win` → `endless`). 승률은 `end in (win, lose)`로 센다.
- 끝난 판의 복기 결과(`log[].replay`)는 `run_end` 뒤에 붙어 `row`에 없다. `review_open`의 `kind`로 본다.
- 판의 첫 `__autoDraft`(스크린샷 도구) · 옛 저장에서 이어 둔 판의 앞부분은 사건이 없다.

## PostHog에서 보기
사람이 한 번 해 둘 것: 「Discard client IP data」 켜기 · Error tracking 켜기 · 슬랙 알림 · 대시보드.

질의는 SQL(HogQL) 인사이트에 붙인다. 개인 API 키가 없어 돌려 보지 못했다. `selftest`는 `tools/telemetry-selftest.mjs`가 보낸 확인용 사건이라 뺀다. 판 승률:
```sql
select count() as runs,
       countIf(toString(properties.won) = 'true') as wins,
       round(100 * wins / runs, 1) as win_pct
from events
where event = 'run_end' and properties.`end` in ('win', 'lose')
  and properties.selftest is null and timestamp > now() - interval 30 day
```
단별 · 레퍼토리별(`JSONExtractArrayRaw(properties.josekis)`) · 격언별 승률, 끝난 관 분포는 같은 꼴로 묶는 열만 바꾼다. 튜토리얼 깔때기는 Funnel 인사이트(`app_open` first = true → `tutorial_offer` → `lesson_start` → `lesson_done` → `battle_end`), DAU · MAU는 `app_open`의 `uniq(distinct_id)`, 잔존은 Retention 인사이트(`app_open`)로 본다.

## `humans.mjs --posthog`
모인 `run_end`의 `row`를 내려받아 내보낸 JSON과 같은 표로 찍는다. `--vs`로 하네스 dump와 나란히.

```
POSTHOG_PERSONAL_KEY=phx_… POSTHOG_PROJECT_ID=12345 node tools/humans.mjs --posthog [--days 90] [--vs <run.mjs --dump 파일>]
```
- 개인 API 키(`query:read`)와 프로젝트 id는 환경 변수로만. 저장소에 적지 않는다.
- 질의와 응답 읽기는 `tools/posthog.mjs`(`rowsQuery` · `parseRows` — 같은 `row.id`는 뒤의 것으로, `row_trimmed` 판은 판 단위 수치에만). 실제 호출은 키가 없어 못 해 봤고 `test/telemetry.test.js`가 흉내 낸 응답으로 잰다.
- 진짜 수집 확인은 `node tools/telemetry-selftest.mjs`(`selftest-…` ID로 `app_open` · `run_end` 한 벌).
