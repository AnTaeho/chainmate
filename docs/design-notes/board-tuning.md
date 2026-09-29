# 판 조정 — 나쁜 판 거르기 · 다시 놓기

밤샘 2(`docs/reports/night2.md` D2 · D3)에서 넣은 두 장치를 CHM-20에서 한 스위치로 모았다. 사람: 「나중에 판 조정 부분은 아예 들어낼 수도 있을 것 같아.」

## 무엇을 하나
- **나쁜 판 거르기(D3)**: 판(런)의 대국은 대국판 후보를 넷 짓는다. 그중 「첫 손 최선 사슬 점수」(풀이기, 마디 3000, `docs/reports/luck.md` ④)가 가장 낮은 판 하나를 버리고, 남은 셋 중 하나를 시드로 고른다. 좋은 판은 버리지 않고 아래 꼬리만 자른다. 1관 연습(첫 사슬 보장 판) · 수업 · 타이틀 시연 · 봇의 짜임 재기 · 시험의 `createBattle` 기본값은 거르지 않는다.
- **다시 놓기(D2)**: 대국마다 첫 수 전에 한 번, 손 · 목표 · 규칙은 그대로 두고 판만 (대국 시드, 몇째)로 새로 깐다. 명령 `reboard`, 화면은 오른쪽 칸의 「다시 놓기」 단추. 봇은 첫 손 최선 사슬 × 남은 수가 남은 목표 × 2에 못 미치면 누른다(`tools/bot.mjs REBOARD.ratio`).

## 켜고 끄는 법
`src/sim/tuning.js` 한 곳만 바꾼다.

```js
export const BOARD_TUNING = { filter: FILTER_DEFAULT, reboard: true }; // 기본(켬)
export const BOARD_TUNING = { filter: false, reboard: false };         // 끔
```

- `filter`: `false` · `0` · `1`이면 끈다. 수면 그만큼 후보를 짓는다. `true`면 `FILTER_DEFAULT`(4).
- `reboard`: `false`면 `canReboard`가 늘 거짓이다. 그래서 규칙(`legalCommands`에 `reboard`가 없고 명령은 던진다) · 봇 · 화면 단추 · smoke가 함께 따라간다.
- 둘 다 끄면 판(런)의 대국판은 밤샘 2 이전 판 생성과 같다(같은 시드 → 같은 판 · 손 · 증원). `test/clock.test.js` 「판 조정을 끄면 같은 시드 → 거르기 없는 옛 판」이 잰다.
- 하네스에서 파일을 고치지 않고 끄려면 `--tune '{"reboard":false,"filter":0}'`(`tools/run.mjs` · `tools/luck.mjs`, `tools/night2.mjs applyNight2`가 같은 `BOARD_TUNING`을 바꾼다).
- 끈 채로 돌리면 시험 셋(다시 놓기 둘 · 켰을 때 거르기 하나)은 건너뛴다. smoke는 다시 놓기 단추가 한 번도 없어야 통과한다.

## 끈 상태의 수치 (CHM-20, seed 1, 시계 3 · 진 뒤 상점 · 곡선 CHM-20)

끄고 잰 값은 **시계 3 · 진 뒤 상점 · CHM-20 곡선** 위의 수치다. 밤샘 2의 d0(17.5%, 시계 1 · 옛 곡선)과는 견주지 않는다.

| | 판 조정 켬(기본) | 판 조정 끔 |
|---|---|---|
| smart 단 0 판 승률 | 50.0% (50판, `chm20-cA2-smart50`) | **36.7%** (30판, `chm20-off-smart30`) |
| 판당 잃은 시계 | 1.80 | 2.23 |
| 이긴 판 중 시계를 쓴 판 | 40.0% | 54.5% |
| 8관 도달 · 통과 | 72% · 50% | 60% · 36.7% |
| 명인 대가 통과 | 53.2% (47대국) | 55.0% (20대국) |
| 다시 놓기/대국 | 0.15 | 0 |
| luck: 판을 끝낸 죽음 | 15 | 19 |
| luck: 그중 대체 판 승률 ≥60% 몫 | 40.0% (6/15, 95% 구간 19.8~64.3%) | **36.8%** (7/19, 19.1~59.0%) |
| luck: 진 대국 전부 ≥60% 몫 | 52.1% (48개) | 49.2% (63개) |

원문 `docs/reports/raw/chm20-off-smart30.*` · `chm20-luck-off.*`(끔), `chm20-cA2-smart50.*` · `chm20-luck-final.*`(켬). luck은 `--runs 30 --k 20 --sk 10`.

읽는 법: 떼어 내면 판 승률이 13%p쯤 떨어진다(50 → 37%, 30~50판이라 ±8%p). 판을 끝낸 죽음의 판 운 몫은 켜고 끈 차이가 구간 안이다(40% · 37%). 지금 곡선에서 판 조정의 몫은 대국을 덜 지게 하는 쪽에 크다(판당 잃은 시계 2.23 → 1.80). 들어내면 목표 곡선을 13%p어치 낮춰 다시 맞춰야 한다.

끈 채 검증(곡선을 바꾸기 전 `ff0a9b1` 위): `npm test` 388개 중 통과 385 · 건너뜀 3 · 실패 0(`chm20-test-off.txt`), `npm run smoke` SMOKE OK · 다시 놓기(끔) 0 · 글 넘침 0 · 보류 0(`chm20-smoke-off.txt`).

## 통째로 들어낼 때 지울 것
스위치를 끈 채 두고, 코드를 걷어 낼 때 이 목록을 따른다. 걷어 낸 뒤 `npm test` · `npm run smoke` · `node tools/smoke.mjs --lang en`을 돌린다. 판 승률이 바뀌므로 목표 곡선을 다시 잰다(위 「끈 상태의 수치」가 출발점).

파일째 지운다
- `src/sim/tuning.js`
- `tools/night2.mjs`(`--tune`의 시계 · 봇 문턱만 남기려면 `clock` · `reboardRatio` 줄만 두고 `tools/run.mjs` · `tools/luck.mjs`로 옮긴다)

`src/sim/battle.js`
- `import { reboardOn } from './tuning.js'`
- `DEFAULT_RULES.reboards`
- `BOARD_FILTER`와 그 위 주석, `boardScore`
- `createBattle`의 `filter` 인자 · `b.filter` · `b.reboards` · `b.touched` 필드. `layBoard(b, b.rng.board, fork(root, 'filter'))` → `layOne(b, b.rng.board, easy)`로(판이 같다: `fork`는 부모 rng를 쓰지 않는다)
- `layBoard`의 후보 가지(함수째 `layOne`으로 합친다)
- `canReboard` · `reboard` · `legalCommands`의 `reboard` 줄 · `apply`의 `case 'reboard'` · 머리 주석의 `{ type: 'reboard' }`

`src/sim/run.js`
- `import { boardFilter } from './tuning.js'` · `startBattle`의 `filter:` 줄
- `applyRun`의 `case 'reboard'`(명령 목록에서 빼기) · `endBattle` 기록의 `reboards`

`src/sim/scoring.js`
- 조정자 rng 이름의 `:${this.t.reboards || 0}`는 두어도 된다(늘 0). 지우면 확률 격언의 굴림이 바뀌니, 지울 땐 확률 격언 시험을 다시 본다.

`src/data/tactics.js`
- `b.touched = true` 줄(다시 놓기를 막는 용도뿐)

화면
- `src/ui/screens/battle.js`: `canReboard` 가져오기, `reboardIcon`, 메서드 `canReboard()` · `reboard()`, 이벤트 연출 `case 'reboard'`(`v.reboarded`), 오른쪽 칸 배치의 `rb` · `rbY` · `btn:reboard` 단추
- `src/ui/lessons.js` · `src/ui/screens/title.js`: `rules`의 `reboards: 0`
- `src/data/i18n/en.js`: `'다시 놓기': 'New Board'`

도구
- `tools/bot.mjs`: `REBOARD` · `canReboard` 가져오기 · `decideBattle`의 다시 놓기 줄 · `{ reboard: true }` 처리
- `tools/smoke.mjs`: `reboardOn` · `canReboard` 가져오기, `n2`의 `reboard` · `reboardBot` · `reboardBad` · `tried`, 「다시 놓기」 걸음 둘, 끝의 줄 · 실패 조건에서 다시 놓기 몫
- `tools/luck.mjs`: `boardFilter` 가져오기 · `rebuild`의 `filter:` 줄 · `origReboards` · 「다시 놓기 대국당」 출력
- `tools/run.mjs`: 「다시 놓기 대국당」 출력 · JSON `reboardPerBattle`

시험
- `test/clock.test.js`: 다시 놓기 둘 · 나쁜 판 거르기 · 판 조정 셋(끄면 옛 판 · filter 값 읽기 · 켜면 거른다)

문서
- `docs/DESIGN.md` 「다시 놓기」 · 「나쁜 판 거르기」 절과 판 조정 한 줄, 이 파일
