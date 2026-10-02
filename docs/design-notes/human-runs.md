# 사람 판 기록 (CHM-50)

모든 수치(승률 · 곡선 · 희생 세기)는 봇 하네스에서 나왔다. 사람이 둔 판을 같은 잣대로 보려고, 판마다 한 줄 요약을 기기에 남기고 사람이 직접 내보낸다. 서버로 보내지 않는다.

## 흐름
- **세기:** 새 판(`app.newRun`)이 `run.track`(`src/sim/runlog.js` `newTrack`)을 단다. `app.cmd`가 명령마다 `trackCommand`로 센다. 판 저장(`KEYS.run`)에 함께 들어가 이어 하기에도 남는다. 판 시간은 `app.update`가 판이 살아 있는 동안 프레임 시간을 더한다(화면이 숨으면 프레임이 멈춰 세지 않는다).
- **남기기:** 명령 하나로 판이 이김 · 짐이 되는 순간 `runRow`로 한 줄을 만들어 `KEYS.runs`(`chainmate.runs.v1`, `{ v: 1, runs: [...] }`)에 더한다(`src/ui/runlog.js` `keepRow`). 끝나지 않은 판을 새 판으로 덮어쓰면 `end: 'quit'`. 이긴 판에서 끝없는 대국을 이어 두면 같은 `id` 줄을 `end: 'endless'`로 갈아 끼운다.
- **빼는 것:** 수업(대국은 `apply`로 따로 돈다) · `run.scratch`(수업 ⑩) 판은 track이 없다. 킹과 두는 대본 대국은 그 대국이 끝나며 늘어난 `log` 자리를 `track.script`에 적어 두고 요약에서 뺀다(그 뒤 대국은 보통 판으로 남는다). 타이틀로 나가기만 한 판은 남기지 않는다.
- **크기:** 200판까지, 오래된 것부터 버린다. 저장이 꽉 차면(`setItem`이 던짐) 오래된 네 몫 하나씩 덜어 다시 쓴다. 판 한 줄은 대국 수에 비례한다: 대국 하나 ≈ 340자, 8관까지 간 판(대국 24) ≈ 9~10KB, 3관에서 끝난 판 ≈ 4KB. 200판이 모두 끝까지 간 판이면 ≈ 2MB(글자 수)다.
- **내보내기:** 설정 맨 아래 「기록 내보내기」(영어 Export runs). 웹 · 앱(Tauri) 모두 `<a download>` Blob으로 `chainmate-runs-YYYYMMDD-HHMM.json`을 받는다. 받을 길이 없으면 클립보드로 복사하고, 둘 다 안 되면 「내보내지 못했다」. 받은 판 수는 알림 한 줄(「판 N개를 내보냈다」).
- **요약:** `node tools/humans.mjs <내보낸.json> [--vs <run.mjs --dump 파일>]` — 판 승률 · 관별 도달 · 통과 · 점수/목표 · 대국당 희생 · 탁월수 판 · 시너지 판 끝 · 진 대국의 자리 · 단별. 판 단위 수치는 끝낸 판만, 대국 단위 수치는 그만둔 판의 대국도 센다.

## 열쇠
내보낸 JSON은 `{ kind: 'chainmate-runs', v: 1, exportedAt, app, runs: [판] }` — 하네스 dump(`{ timeouts, runs }`)처럼 `runs`에 판이 있어 같은 도구로 읽는다.

### 하네스 dump와 같은 열쇠(같은 뜻)
`test/runlog.test.js`가 하네스 판 하나(`run.mjs --policy none --seed 1`)를 같은 씨앗으로 다시 두어 열쇠마다 값까지 견준다. `run.mjs`의 `one()`과 `runRow`는 일부러 따로 둔다(하네스는 손대지 않는다) — 어긋나면 그 시험이 잡는다.

| 열쇠 | 뜻 |
|---|---|
| `seed` | 판 시드 |
| `won` | 8관 마스터를 꺾었나. 끝없는 대국에서 져도 참(결과 화면 · 기록과 같다). 하네스 판에는 끝없는 대국이 없다 |
| `ante` · `blind` | 끝난 관 · 대국(0 연습 · 1 정식 · 2 마스터) |
| `log` | 대국마다 한 줄(`src/sim/run.js` endBattle: 관 · 종류 · 세력 · 목표 `target` · 점수 `score` · 이김 · 까닭 · 쓴 수 `moves` · 최고 한 수 `best` · 사슬 평가 `grades` · 희생 `discarded` · 탁월수 `brilliants` · 시계 `clockLost` …). 대본 대국 줄은 뺀다 |
| `bought` | 상점 · 꾸러미에서 새로 든 격언 id(겹치면 한 번) |
| `final` | 판 끝 격언(전설 빼고) |
| `money` | 판 끝 상금 |
| `fragments` · `legends` · `legendAt` | 명경기 조각 · 완성한 명경기 · 처음 완성한 관 |
| `editions` | 산 격언의 판본 |
| `seen` | 진열에 나온 것(칸 · 격언 · 판본 · 조각) · 연 꾸러미 · 금빛 꾸러미. 상점에 들어설 때와 다시 뽑을 때 센다(shopbot과 같다) |
| `deck` · `deckSize` | 판 끝 주머니(`모습[:각인]` 정렬) · 수 |
| `charts` | 기보 단계 합 |
| `fam` | 판 끝 시너지별 수(`familyCounts`) |
| `josekis` | 고른 레퍼토리 |
| `fairies` | 판 끝 주머니의 특수 기물 |
| `best` | 판 최고 한 수 |
| `souls` · `cracked` · `awakened` | 대국 때 주머니에 있던 혼 · 금 간 때 · 깨어난 때 |

### 사람 판에만 있는 열쇠
| 열쇠 | 뜻 |
|---|---|
| `human` | 1(사람 판 표시) |
| `id` | `시작 ms:시드` — 끝없는 대국에서 갈아 끼울 때 쓴다 |
| `end` | `won` · `lost` · `quit`(새 판으로 덮어씀) · `endless`(이긴 뒤 끝없는 대국이 끝남) |
| `dan` · `opening` · `daily` | 단(레이팅 800 + 200 × 단) · 오프닝 · 오늘의 대국 날짜 |
| `endless` | 끝없는 대국에서 닿은 관(없으면 null) |
| `startedAt` · `endedAt` · `sec` | 시작(ms) · 끝(ISO) · 판 시간(실제 초). 옛 저장에서 이어 둔 판은 `startedAt` null |
| `battles` · `sacrifices` · `brilliants` | 둔 대국 수 · 희생 합 · 탁월수 합 |
| `lostAt` | 진 대국마다 `{ ante, blind, kind, score, target, pct(목표 대비 %), reason, clockLost }` |
| `buys` | 산 것 모두 `{ a: 관, b: 대국, k: 종류(maxim · piece · soul · engraving · chart · tactic · fragment · gamble · pack …), id, $: 값, pack: 1(꾸러미에서 고름) }` |
| `script` | 뺀 대본 대국 줄 수 |
| `app` | `{ version, commit, platform: web · app }`. 커밋은 `desktop/collect.sh`가 앱에 모을 때만 채운다(웹은 null) |
