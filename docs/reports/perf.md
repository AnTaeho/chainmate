# 하네스 빠르게 (CHM-44)

판 하네스 `node tools/run.mjs --policy smart`가 판당 35~90초라 균형 작업마다 몇 시간이 들었다. 같은 seed · 정책이면 판별 결과가 비트 단위로 같은 채로, 판당 시간을 줄였다.

**결과**: smart 20판(10일꾼) 판당 시간 **2.2배**, 전체 시간 **2.2~2.3배**, 판 하나를 혼자 돌리면 **2.4~2.7배**. `sim.mjs` 300대국은 1.4배. 결정성 diff 0(손질마다, 아래 원문).

## 1. 시간이 어디서 나가나

`node --cpu-prof`로 smart 판 하나(seed 1007922, 8관까지 이긴 긴 판)를 한 스레드에서 쟀다(스크립트는 판 하나를 `createRun` → `playRun`). 하네스는 판마다 새 일꾼을 띄우므로 판 하나를 새 프로세스에서 잰 것이 하네스와 같은 조건이다.

포함 시간으로 보면 **상점 봇의 짜임 재기(`tools/shopbot.mjs` `evalBuild` → 풀이기 `bestMove`)가 94%**다. 대국 봇(`decideBattle`)은 1%, 하네스 출력 계산은 표에 오르지 않을 만큼 작다. 그래서 손질은 모두 짜임 재기가 지나가는 풀이기 · 사슬 · 판 짓기에 들어갔다.

### 손질 전 (자기 시간, 합 26.5초)

| 몫 | 함수 | 하는 일 |
|---:|---|---|
| 33.1% | `ordered` scoring.js | 훅마다 조정자 차례 표 찾기 |
| 28.4% | `attackers` board.js | 노림 목록 (판 짓기 킹 수비 18.5% · 응수 · 떨굴 칸 · 킹 먹기) |
| 6.2% | `forkSpec` scoring.js | 마디마다 조정자 state JSON 왕복 |
| 4.0% | `chainCapture` chain.js | 먹기 한 번 |
| 3.8% | `dfs` solver.js | 탐색 |
| 3.7% | `runHook` scoring.js | 훅 부르기 |
| 3.2% | GC | |
| 2.2% | `forkSpecs` scoring.js | 마디마다 명세 전부 복사 |
| 2.1% | `chainCaptures` chain.js | 먹을 칸 목록 |

포함 시간: `evalBuild` 93.7% · `bestMove` 85.2% · `chainCapture` 62.1% · `runHook` 38.0% · `generateBoard` 20.1% · `defenderSquares` 18.5% · `createBattle` 12.8% · `refill` 12.3%.

### 손질 뒤 (자기 시간, 합 9.9초)

| 몫 | 함수 |
|---:|---|
| 16.5% | `attackers` board.js — 거의 모두 응수 판정(`resolveReply`, 16.4%) |
| 10.6% | `chainCapture` chain.js |
| 8.7% | `runHook` scoring.js |
| 8.2% | `ordered` scoring.js |
| 7.8% | `dfs` solver.js |
| 4.4% | GC |
| 4.2% | `chainCaptures` chain.js |
| 3.7% | `cloneTable` solver.js |
| 3.7% | `anyAttacker` board.js |
| 3.5% | `cowSpecs` scoring.js |

포함 시간: `evalBuild` 92.4% · `chainCapture` 62.2% · `resolveReply` 37.0% · `runHook` 20.5% · `createBattle` 7.2% · `refill` 4.9% · `generateBoard` 4.3%.

## 2. 손질 목록

모두 「같은 입력이면 같은 답」을 지키는 손질이다. 탐색 순서 · 마디 예산(풀이기 10000, 짜임 재기 1000 · 판 K 6) · 무작위 소비 순서는 건드리지 않았다. 몫은 그 손질 직전 프로파일의 자기 시간이다.

| 커밋 | 손질 | 없앤 몫 | 같은 답인 까닭 |
|---|---|---:|---|
| `65fb5d8` | `ordered`: 차례 표를 `명세 열쇠 → 훅 → 각인 id → 혼 id` 겹친 Map으로 찾는다 | 33% → 6~8% | 열쇠 네 가지는 그대로. 매번 긴 문자열을 새로 이어 해시하던 값만 사라졌다(명세 열쇠는 복사본끼리 같은 문자열 객체라 해시가 남아 있다) |
| `2719c47` → `fd849c0` | 판 짓기 킹 수비 칸(`defenderSquares`): 48칸마다 기물을 세워 `attackers` 전체를 재던 것을, 킹에서 뻗는 선을 한 번씩 걸어 한꺼번에 찾는다(`guardSquares`) | 18.5% → 0.3% | 칸마다 세워 보는 옛 방식과 무작위 판 2만 개 × 기물 15종에서 답이 모두 같았다(아래 4). `2719c47`의 기하 겉금(`attackSpan`)은 중간 단계였고 `fd849c0`이 대신한다 |
| `c45f499` | `forkSpec`: state가 평범한 객체 · 배열 · 문자열 · 참거짓 · 유한한 수뿐이면 직접 베끼고, 그 밖의 값이 하나라도 있으면 JSON 왕복 | 6~11% | JSON 왕복이 바꾸는 값(undefined · NaN · Infinity · −0 · 날짜 · 구멍 난 배열 …)을 만나면 옛 길로 간다. 키 차례도 같다 |
| `caf32a5` | 풀이기의 `chainCapture(u, sq, true)`: 바로 위에서 같은 상태로 받은 칸이면 합법 검사(먹을 칸 목록 다시 만들기)를 건너뛴다 | ~8% | `chainCaptures`는 상태를 바꾸지 않는다(`allowCapture` 훅 둘 다 읽기만). 화면 · `apply` 길은 검사를 그대로 한다 |
| `00fd1b3` | `isAttacked` · `kingTakeable`: 노림 목록을 만들지 않고 첫 노림수에서 멈추는 `anyAttacker` | ~5% | 검사 하나하나가 `attackers`와 같다. 무작위 판 128만 칸에서 옛 `attackers(...).length > 0`과 답이 모두 같았다 |
| `fbd9680` | 풀이기 탁자가 조정자 명세(mods · 각인 · 혼)를 부모와 나눠 쓰고, 훅이 `ctx.state`에 처음 손대는 순간 그 명세 하나만 갈라 낸다(copy-on-write, `cowSpecs` · `ownSpec`) | 12% | 탐색 중 명세에서 바뀌는 것은 state뿐이다(data는 대국 안에서 안 바뀌고, `off`는 대국 시작 훅 「침묵」만 바꾼다). 탁자를 펼쳐(`{ ...t }`) 같은 mods 배열을 이어 쓰는 곳은 `src/sim`에 없다(grep: 펼침은 모두 진짜 대국 `b`에서 `cloneTable`로 가거나 mods를 새로 만든다). 판 2개에서 갈라 내기 79만 번, 그중 state가 빈 것이 아닌 것 43만 번 — 실제로 쓰이는 길이다 |
| `ed5bd54` | 갈라 낸 표시를 형식 배열(`Uint8Array`) 대신 빈 배열로 | 1~2% | 표시일 뿐 |

손대지 않은 의심 후보:
- **일꾼 분배**: 하네스는 이미 판 하나에 일꾼 하나를 띄우고 끝나는 대로 다음 판을 준다. 「놀고 있는 일꾼」은 가장 긴 판의 꼬리일 뿐이라 고칠 것이 없다(20판이면 전체 시간이 판당 평균 × 2보다 조금 길다).
- **하네스 출력 계산 · 대국 봇 · 미리 보기**: 프로파일에서 1% 안팎.
- **대국 복사 JSON 왕복**: `createBattle`의 mods JSON 왕복 · 상점 봇 `buildOf`는 0.1% 안팎이라 그대로 뒀다.

## 3. 결정성 확인

방법:
1. 손질 전(`30edac9`, `--dump`만 더한 상태)에 기준 셋을 뽑았다.
   - `node tools/run.mjs --runs 20 --policy smart --seed 1 --workers 10 --limit 400 --dump base-smart.json`
   - `node tools/run.mjs --runs 10 --policy nosac --seed 1 --workers 10 --limit 400 --dump base-nosac.json`
   - `node tools/sim.mjs --battles 100 --seed 1 --dump base-sim.json`
2. 기준을 한 번 더 뽑아 `cmp`로 같음을 확인했다(하네스 자체가 결정적인지).
3. 손질마다 같은 셋을 뽑고 기준과 `cmp`. f4부터는 작업 트리를 따로 복사해(`src` · `tools`) 그 복사본에서 돌렸다. f1은 작업 트리에서 돌리는 동안 다음 손질을 고치고 있어서, 판마다 일꾼을 새로 띄우는 하네스 특성상 뒤쪽 판은 다음 손질 일부가 섞인 코드로 돌았다(그래도 diff 0). 시간 초과(`timeouts`)가 비어 있는지도 본다 — 빨라져서 옛날엔 넘던 판이 끝나면 diff로 보일 수 있어서.

`--dump`가 담는 것: 판(run.mjs)은 판마다 하네스가 모으는 결과 전부(이김/짐 · 관 · 대국 기록(대국별 점수 · 목표 · 끝난 이유 · 수 · 희생 …) · 산 격언 · 판본 · 조각 · 전설 · 주머니 · 기보 · 가족 · 정석 · 혼 · 금 · 각성 · 남은 돈)에서 `ms`만 뺀 것, seed 순. 대국(sim.mjs)은 대국마다 관 · 점수 · 결과 · 희생 수 · 수마다 기록(`history`) 전체.

원문(손질 단계마다, 기준 대비):

```
== f1 (ordered + 다음 손질 일부가 섞인 작업 트리)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
== f4 (attackSpan · forkSpec · 합법 검사 건너뛰기)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
== f5 (anyAttacker)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
== f6 (copy-on-write 명세)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
== f7 (guardSquares)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
== f8 (빈 배열 표시, 마지막)
smart: diff 0 (163700 bytes)
nosac: diff 0 (81083 bytes)
sim: diff 0 (738002 bytes)
"timeouts":[] "timeouts":[]
```

`base-smart.json`과 `f8-smart.json`의 sha256은 둘 다 `bc4c7991…c398ecff4`. 마지막 시간 재기(아래 5)의 smart 덤프도 기준과 같았다.

함수 단위로 따로 잰 것(무작위 판, 옛 `board.js`를 옆에 두고):
- `guardSquares` ↔ 칸마다 세워 보고 `attackers`: 판 2만 × 기물 15종 = 30만 번, 다른 답 0.
- `anyAttacker`(`isAttacked` · `kingTakeable`) ↔ 옛 `attackers(...).length`: 128만 칸, 다른 답 0.
- 손본 `attackers`(닫힘을 밖으로) ↔ 옛 `attackers`: 128만 칸, 목록 차례까지 같음.
- `forkSpec` state 복사 ↔ JSON 왕복: 빈 것 · 숫자 · 중첩 · 정수 키 차례 · undefined/NaN/Infinity/−0 · 날짜 · 구멍 난 배열 · 함수 · Set · 상속 키 · 배열, 다른 답 0.

`npm test` 514 통과. `npm run smoke` · `node tools/smoke.mjs --lang en` 모두 SMOKE OK, 한 수 연출(×1) 평균 2.86초 · 최대 3.80초(176수) — 손질 전과 같다. 누르기 처리는 평균 0.80ms → 0.36ms, 최대 1032ms → 116ms로 줄었다(미리 보기 · 봇이 같은 풀이기를 쓴다). smoke의 「누르기 처리 n번」 · 「소리 마디」는 손질 전에도 돌릴 때마다 조금씩 다르다(벽시계를 따르는 장면).

## 4. 전후 시간

같은 컴퓨터(10코어)에서 손질 전(`30edac9` 복사본)과 뒤(`ed5bd54` 복사본)를 번갈아 돌렸다. 이 작업 동안 다른 일이 컴퓨터를 함께 써서(부하 평균 7~54) 절대값은 흔들린다. 번갈아 잰 짝끼리 견준다.

smart 20판, `--workers 10 --limit 400`(하네스 원문 「판당 … (전체 …)」 · `/usr/bin/time` CPU):

| 짝 | 부하 | 전 판당 | 뒤 판당 | 배 | 전 전체 | 뒤 전체 | 배 | 전 CPU | 뒤 CPU | 배 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 18 / 33 | 67.3s | 37.8s | 1.78 | 180.5s | 92.2s | 1.96 | 1157s | 571s | 2.03 |
| 2 | 54 / 44 | 73.7s | 33.0s | 2.23 | 184.1s | 81.9s | 2.25 | 1220s | 556s | 2.19 |
| 3 | 7 / 14 | 58.3s | 26.4s | 2.21 | 146.1s | 63.5s | 2.30 | 1023s | 493s | 2.08 |

조용할 때 따로 잰 값: 손질 전 판당 44.2초 · 전체 113.4초(기준 뽑을 때), 뒤 판당 20.4초 · 전체 51.5초(f7 확인 때) — 2.2배.

판 하나를 혼자(새 프로세스, 다른 일 없이): seed 1007922 26.4초 → 9.9~11.2초(2.4~2.7배). seed 1000003 14.3초 → 5.6~6.5초, seed 1015841 5.3초 → 3.1~3.7초.

`sim.mjs --battles 300 --seed 1`(2400대국, 한 스레드): 3.6초 → 2.5초(세 짝 모두 같음, 1.4배). 대국 봇은 짜임 재기가 없어 풀이기 손질 몫만 받는다.

## 5. 남은 벽

- **응수 판정(`resolveReply` → `attackers`, 16%)**: 먹을 때마다 그 칸을 노리는 적 목록이 필요하다. 목록 자체가 규칙의 답이라 지름길이 없다. 남은 손은 판마다 노림 표를 유지(증분)하는 것인데, 먹기 · 갈아입기 · 다시 채움 · 폭약 · 문 · 얼림마다 표를 고쳐야 해서 규칙을 고칠 때 틀리기 쉬운 곳이 하나 더 생긴다.
- **훅 부르기(`runHook` + `ordered` 17%)**: 훅 하나에 명세마다 `Ctx`를 만들고 차례 표를 Map 세 겹으로 찾는다. 차례 표를 mods 배열에 붙여 들고 다니면 몇 %는 더 준다.
- **사슬 한 걸음(`chainCapture` 11% · `dfs` 8%)**: 탐색은 버리는 이벤트 객체를 매 걸음 만든다. 「이벤트 없이」 길을 따로 두면 줄지만 사슬 규칙이 두 벌이 된다.
- **10일꾼일 때 판당 2.2배, 혼자일 때 2.4~2.7배**: 일꾼 열이 동시에 돌면 판 하나가 혼자 돌 때보다 느리다(메모리 대역 · GC · 클럭). 코어 수를 넘겨 `--workers`를 늘리면 오히려 판당이 길어진다.

## 6. `--fast` 후보

결과를 바꾸는 손질은 넣지 않았다. 남은 구조적 후보 하나만 쟀다.

- **짜임 재기의 대국판 재사용**: 상점 한 번(`makeCtx`) 안에서 짜임마다 같은 seed K개로 `createBattle`을 새로 짓는다. 지은 판을 짜임끼리 나눠 쓰면 그 몫이 사라진다. 그런데 판 짓기는 조정자(`onBattleStart`가 규칙을 바꾸고, `onDropCheck`가 「떨굴 수 있는 판인가」 판정에 든다) · 주머니(첫 손) · `nextId` 소비에 따라 달라져 결과가 같다는 보장이 없다. 지금 `createBattle` 포함 몫은 7.2%(손질 전 12.8%)라 다 없애도 1.08배쯤이다. 구현하지 않았다.
- 마디 예산(`SMART.evalNodes` 1000 · `K` 6)을 줄이는 것은 시간이 거의 비례해 줄지만 봇의 선택이 바뀐다. 균형 작업의 잣대가 바뀌는 일이라 이번 범위 밖이다.

## 7. 재는 도구

- `tools/run.mjs --dump <파일>`: 판별 결과 전부(ms 빼고, seed 순)와 시간 초과 seed.
- `tools/sim.mjs --dump <파일>`: 대국별 결과와 수마다 기록.
- 손질 전후를 견줄 때: 두 커밋을 따로 복사해 같은 명령으로 덤프를 뽑고 `cmp`.
