# 시험 정리(CHM-62)

시험 46개 파일을 모두 읽고, 다른 시험이 이미 재는 단언 · 통째 겹친 시험 · 늘 통과하는 단언을 걷었다. 복사된 준비 코드는 `test/helpers/`로 모았다. src · tools는 손대지 않았다.

원문은 `docs/reports/test-cleanup-raw/`에 있다.
- 커버리지: `before.lcov` · `before-run2.lcov` · `after.lcov` · `after-run2.lcov`, 표 `before-coverage.md` · `after-coverage.md` · `compare.md`(`node docs/reports/test-cleanup-raw/cov.mjs 전.lcov 뒤.lcov`로 다시 만든다)
- 시험 목록: `before-spec.txt` · `after-spec.txt`. 시간: `*-time.txt`(커버리지 켬) · `*-plain-time.txt` · `*-plain-summary.txt`(`npm test`)
- 잰 명령(전후 같음): `node --test --experimental-test-coverage --test-reporter=spec --test-reporter-destination=… --test-reporter=lcov --test-reporter-destination=… 'test/*.test.js'`(Node 22.23.1)

## 수 · 줄 · 시간

| | 전(f4cd098) | 뒤 |
|---|---:|---:|
| 시험 수 | 633 | 586 |
| ─ 그중 expansion 시험이 한 번 더 돈 몫 | 41 | 0 |
| ─ 지운 시험 | | 6 |
| 시험 파일 줄(`test/*.test.js`) | 8,246 | 8,113 |
| 도우미 줄(`test/helpers/*.js`) | 0 | 36 |
| `npm test` 걸린 시간(real) | 7.38초 | 7.44초 |
| 커버리지를 켠 전체 시간(real) | 36.48초 | 35.71초 |

- 633 → 592 사이에 지운 시험은 없다. `content.test.js`가 `NEW_MAXIMS` 목록을 쓰려고 `./expansion.test.js`를 import했다. 그래서 expansion 시험 41개가 content 프로세스에서 한 번 더 돌았다(`before-spec.txt`에 「가짓수: 정석 24 …」가 두 번 나온다). 목록을 `test/helpers/maxims.js`로 옮겨 이제 각자 한 번씩 돈다.
- 592 → 586은 통째 겹친 시험 여섯을 지운 몫이다(아래 (나)).
- 시간은 거의 그대로다. 지운 것은 빠른 시험이고, 오래 걸리는 시험(무작위 판 3000 · 판 하네스 dump · 판 끝까지 두기)은 모두 남겼다. 7.38 → 7.44초는 흔들림 안이다.

## 커버리지 전후

src 파일 105개 모두 줄 · 가지 · 함수 커버리지가 기준선 아래로 내려가지 않았다(`compare.md`).

| | 줄 | 가지 | 함수 |
|---|---:|---:|---:|
| src 전체 · 전 | 81.24 | 83.24 | 68.97 |
| src 전체 · 뒤 | 81.24 | 83.27 | 68.97 |

가지 커버리지 하나는 흔들린다. `src/data/families.js`는 같은 코드 · 같은 시험을 두 번 돌려도 가지 칸 수(BRF)가 93 · 98로 달라진다(V8 블록 커버리지가 그때그때 다르게 센다). 그래서 전후를 두 번씩 떴다.

| | 줄 LH/LF | 가지 BRH/BRF | 함수 FNH/FNF |
|---|---|---|---|
| 전 1 | 189/191 | 82/93 (88.17%) | 34/36 |
| 전 2 | 189/191 | 88/98 (89.80%) | 34/36 |
| 뒤 1 | 189/191 | 88/98 (89.80%) | 34/36 |
| 뒤 2 | 189/191 | 82/93 (88.17%) | 34/36 |

두 꼴이 전에도 뒤에도 그대로 나온다. 같은 꼴끼리 견주면 떨어진 칸이 없다. 그 밖의 104개 파일은 네 번 모두 같은 값이다.

## 고른 목록

「대신 지키는 시험」은 지운 단언과 같은 입력 · 같은 동작을 재는 남은 시험이다. 그런 시험을 찾은 것만 지웠다.

### (가) 앞부분 중복: 본론 앞에서 다른 시험이 재는 것을 다시 단언 — 4

| 파일:시험 | 처리 | 대신 지키는 시험 |
|---|---|---|
| battle:「희생: 하나를 골라 바치고 다시 뽑는다, 떨굴 수 없고 희생도 없으면 짐」 | 앞의 바치기 셈(희생 수 · discarded · 손 넷 · offered · used) 지움. 본론(빈 주머니 거부 · 막히면 짐)만 남기고 이름을 「희생: 주머니가 비면 바칠 수 없고, 떨굴 수 없는데 희생도 없으면 짐」으로 | sacrifice:「희생: 바친 기물은 이번 대국에 돌아오지 않고 새로 뽑는다 · 몫은 없다」 |
| sacrifice:「희생 횟수: 대국마다 3번, 다 쓰면 거부」 | 앞의 `discardsLeft === 3` 지움(세 번 뒤 거부가 그대로 잰다) | battle:「대국판 생성 …」(관 1~8 × 시드 25에서 희생 3) |
| content:「명인 철벽: 응수가 없다 …」 | 앞의 `iron.rules.noReply === true` 지움. 깃발이 안 켜지면 본론의 끊김 단언이 깨진다 | 본론 자신 + content:「명인 모래시계 · 무거운 손」 꼴의 명인 시험 |
| dopamine:「전설 불멸의 대국 …」 | 앞의 「전설 없는 같은 판은 50에서 끊긴다」 지움, 주석으로 출처만 남김 | chain:「응수 실패 → 끊김 …」(같은 판 · reason cut · 50) |

### (나) 통째 중복 — 통째 지운 시험 6 · 겹친 단언 12 · 두 번 돈 시험 41

| 파일:시험 | 처리 | 대신 지키는 시험 |
|---|---|---|
| expansion 41개(content 프로세스에서 한 번 더) | `NEW_MAXIMS`를 `test/helpers/maxims.js`로 옮김 | 각 expansion 시험(제 프로세스에서 한 번) |
| newmaxims:「미련 없이: 희생 +1」 | 시험 지움 | sacrifice:「격언 셋」의 `st.discardsLeft === 4` |
| expansion:「절약: 대국을 이기면 남은 희생마다 상금 +1」 | 시험 지움(단언이 `money >= discardsLeft`로 약했다) | sacrifice:「격언 셋」의 절약(희생 하나 쓴 승리 → 상금 정확히 2) |
| fairies55:「정석: 풀밭은 까마귀 · 기사 서약 광대 · 성벽 쌓기 꺾쇠 · 주교관 물수제비」 | 시험 지움 | expansion:「정석 사막 · 풀밭 · 포대 · 그늘」(풀밭 → 까마귀 둘) + joseki:「기물을 바꾸는 정석」(넷을 겹쳐 주머니가 정확히 EMNPPSST) |
| soul:「순교자: 끊기면 둘레 적을 먹은 것으로」 | 시험 지움 | soul:「순교자: 킹을 뺀 둘레의 적을 모두 먹는다」(같은 판을 넓혀 d7 포함 넷을 잰다) |
| soul:「잠행: 노림이 보지 못해 응수 없이 이어진다」 | 시험 지움 | soul:「잠행: 지키는 적을 늘 무시한다 · 사슬 끝에 배수 −1」(지켜진 e6을 먹은 뒤 forced 없음 · 다음 먹기까지 끊기지 않음) |
| clock:「시계 1(마지막 칸)은 한 번 지면 판이 끝난다」 | 시험 지움 | clock:「시계: 지면 한 칸을 잃고 …」 끝(시계 1에서 지면 lost · runLost). 앞의 「단 8이면 시계 2」는 outside:「단 1: 증원 +1 / 단 4: 시계 −1 / 단 8: 수는 그대로」 |
| sacrifice:「마스터 모래시계: 수 2 · 희생 1」 | 대국 셈(수 2 · 희생 1) 지움, 글 단언만 남겨 이름을 「마스터 모래시계 글: …」로. spec `kind: 'master'`는 정의의 kind와 같아 결과가 같다(scoring.js `spec.kind ‖ def.kind`) | content:「명인 모래시계 · 무거운 손: 무르기가 줄어든다」(같은 seed 1) |
| content:「명인 8: 철벽 · 모래시계 · 무거운 손 · 대가」 | 철벽 noReply · 모래시계 수 2 · 무거운 손 noHeavyDrop 깃발 지움. 남은 것(명인 여덟 · 대가 킹 둘 · 기보 안 꺼짐)으로 이름을 「명인 여덟 · 대가: 킹 둘, 기보는 꺼지지 않는다」로 | content:「명인 철벽」(동작) · 「명인 모래시계 · 무거운 손」(수 2와 무거운 손 동작) |
| content:「장면 기준값(조정자 없음)」 | mate · cut 두 줄 지움 | chain:「장면: 응수 · 승급 뒤 응수 · 외통 …」(340 · 6 · 2040 · mate), chain:「응수 실패 → 끊김」(50 · 1 · 50 · cut) |
| content:「격언 70종 모두 장면 검사가 있다」 | `MAXIMS.length === 70` 지움, 이름 「격언마다 장면 검사가 있다」 | expansion:「가짓수: 정석 24 · 격언 70 · …」 |
| content:「각인: 금 상금 +2 · 상아 값 +30 · …」 | `ENGRAVINGS.length === 12` 지움 | expansion:「가짓수」 |
| newmaxims:「격언은 일흔 …」 | `MAXIMS.length === 70` 지움, 이름 「밤샘 D-8 격언 여덟이 목록에 있다」 | expansion:「가짓수」 |
| soul:「혼 열여섯 · 가족이 있고 세기에 들어간다」 | `SOULS.length === 16` 지움, 이름 「혼의 가족이 가족 세기에 들어간다」 | expansion:「가짓수」(+ soulgrade:「혼 등급」 6 · 5 · 5) |
| brilliantgrade:「사슬 평가 별 …」 | GRADES 표 단언과 「표식에 ! 없음」 지움 | dopamine:「사슬 평가: 3 「!」 · 5 「!!」 …」(같은 GRADES 표를 deepEqual, 그 표에 「!」가 없다) |
| faction:「세력: 관의 세 대국 모두 같은 세력 …」 | `rules.pawnSides === true` 지움 | faction:「버릇 · 농민군: 적 폰이 옆 칸도 지킨다」(깃발이 없으면 attackers 단언이 깨진다) |
| outside:「단 1: 증원 +1 / 단 4: 시계 −1 / 단 6: 희생 −1」 | 단 6 희생 2 지움, 이름에서 단 6을 빼고 남은 단 8 수 4를 이름에 | sacrifice:「레이팅 계단: 6단부터 희생 −1」(같은 seed 9 · dan 6 · 희생 2, 단 5 = 3과 함께) |
| fit:「돌리는 기준 …」 | 아이패드 810×1080 줄 지움(768×1024 줄은 남김) | fit:「화면 맞춤: 아이패드 세로」(같은 입력, rot false) |

### (다) 불필요: 늘 통과 · 안 쓰는 값 — 7

| 파일:시험 | 처리 | 까닭 |
|---|---|---|
| battle:「미리 보기: …」 | `const before = JSON.stringify(b)`와 끝의 `assert.ok(before)` 지움 | 빈 문자열이 아닌 JSON은 늘 참. 「미리 보기가 대국을 바꾸지 않는다」는 같은 시험의 `snap` 단언이 잰다 |
| board:「폰은 rank 7(8번째 줄)에 떨굴 수 없다」 | 56+f 칸 루프 지움 | 바로 앞의 `drops.every(rankOf !== 7)`과 같은 것을 다시 잰다 |
| fairy:「적 이형은 4관부터 섞인다」 | `… \|\| true` 줄과 그 대국 만들기 지움 | `\|\| true`라 늘 통과. 4관 섞임은 같은 시험의 enemyWeights · rollType 단언이 잰다 |
| run:「유리 기물이 깨지면 판의 주머니에서도 빠진다」 | `deck.every(eng.id === 'glass')` 지움 | 시험이 모든 기물에 유리를 넣었으니 늘 참. 본론은 「주머니가 8 밑으로 줄었다」(그 판을 못 찾으면 assert.fail) |
| nextdraw:「보이는 둘은 주머니 맨 앞 둘이고, 셋째부터는 가린다」 | `nextDraws(b).length === 2` 지움 | 바로 앞 `deepEqual(ids(nextDraws), ids(bag.slice(0, 2)))`에 길이가 들어 있다 |
| faction:「버릇 · 기병대 …」 | `const r = {}; habit.apply(r)` 지움 | r을 아무 데도 쓰지 않는다 |
| tutorial:「대본 대국의 판 조정 …」 | `assert.ok(createBattle)`과 그 import 지움 | 함수가 있는지만 본다 |

지금 코드에 없는 기능을 재는 시험은 찾지 못했다. 뺀 기물(대주교 · 재상 · 야간기사 · 메뚜기) · 옛 「!」 표식 · 옛 명인 차례를 다루는 시험은 모두 옛 저장 바꿔 읽기나 「없어졌는지」를 지키는 시험이라 남겼다.

### (라) 정리만: 도우미로 모음

| 도우미 | 쓰는 곳 | 바꾼 것 |
|---|---|---|
| `test/helpers/dom.js` `installDom()` | annot · backdrop · fairyfx · kinds · layoutlog · layout · light · sprites-hi · title · replay · runlog · tutorial | before 훅마다 복사된 「가짜 DOM → 전역 document · window → 캔버스 공장」 다섯 줄 |
| `test/helpers/dom.js` `tick()` | export · runlog · tutorial | 같은 한 줄 함수 |
| `test/helpers/run.js` `finishBattle()` · `shopRun()` | run · dopamine | run의 `shopRun` · dopamine의 `shopAt`(같은 함수) · 같은 while 줄 다섯 |
| `test/helpers/chain.js` `table()` | chain · scoring · fairy · fairies55 · soul | 같은 꼴의 사슬 탁자 |
| `test/helpers/maxims.js` `NEW_MAXIMS` | content · expansion | 위 (나) 첫 줄 |

`test/helpers/`는 `test/*.test.js` 글롭 밖이라 시험으로 돌지 않는다. after 훅(전역 지우기 · 캔버스 공장 되돌리기)은 파일마다 하는 일이 달라 그대로 두었다. art-hi(캔버스마다 빛깔을 적는 공장) · export(시험마다 다른 navigator) · audio · render(전역 없이 씀)는 꼴이 달라 모으지 않았다.

정리하다 하나를 더 알았다. content는 각인 조정자 등록을 expansion import에 기대고 있었다. 그래서 `import '../src/data/engravings.js'`를 등록용으로 남겼다.

## 지우지 않고 남긴 애매한 것

- **설계 수치를 박아 둔 상수 단언**(`GOLDEN.chance === 0.04`, `GOLDEN.calling`, `SHOP.editionChance`, `CHEST.counts`, `CHEST.items`, `REWARD.overflow`, `OVERFLOW_TIERS`, `OPERA_REFILLS`, `NEXT_DRAWS`, `CHART_TABLE`, frame 토큰): 상수끼리 비교하는 꼴이다. 다만 늘 통과하지는 않는다. 수치를 바꾸면 깨져서 설계서와 함께 고치라고 알린다. 확률 표본 단언과 짝이라 남겼다.
- **battle:「명령으로만 진행 …」 vs chain:「장면 …」**: 같은 2040 판이다. battle은 apply · legalCommands · status · 끝난 뒤 명령 거부를 재고, chain은 사건 차례를 잰다. 층이 달라 둘 다 둔다.
- **전설 · 명인 시험의 「없으면 이렇다」 대조 줄**(content「끝줄의 꿈」의 `play('promoCut').reason === 'cut'`, dopamine 상록 · 폰 여덟 · 오페라 지켜진 킹의 전설 없는 판, content 철벽 · 거울 · 안개의 plain 판): 대부분 다른 시험이 재는 것이다. 다만 전제가 깨지면 본론이 엉뚱하게 통과한다. 예: promoCut이 끊기지 않으면 back_rank_dream 없이도 h4까지 이어 같은 40이 나온다. 그래서 짧은 가드로 남겼다.
- **runlog:「앱: 설정 「기록 내보내기」」 vs export 시험들**: 「내보내지 못했다」 반쪽은 export와 겹친다. 「판이 없으면 알림만(none)」 길은 여기에만 있어 통째 남겼다.
- **저장 왕복 시험 여럿**(battle · run · dopamine · soulgrade · sacrifice · nextdraw · shopreturn · fairy · soul): 기능마다 새 상태 필드가 JSON에 들어가는지 잰다. 서로 다른 필드라 겹침으로 보지 않았다.
- **넓게 훑는 시험과 손으로 만든 경계 시험**(fairies55 「노림 판정은 행마와 같다」 3000판 · fairyfx 「무작위 판 3000」 · replay 「진 대국 몇십 개」 · preview 「미리 본 판 = 대국 시작 판」과 각 경계 시험): 지시대로 둘 다 둔다.
- content · expansion · newmaxims · dopamine · joseki · family · trait 의 사슬 탁자 함수: 저마다 extra(movesUsed · hand · seed · 조정자 꼴)가 달라 `helpers/chain.js`로 모으지 않았다.
- 이름이 지금과 안 맞는 시험(family「격언 마흔 모두 가족이 있다」 — 지금 70, run「격언 자리 바꾸기(침묵이 가장 왼쪽을 끈다)」 — 침묵은 재지 않음): 고친 시험만 이름을 바꾸라는 규칙에 따라 그대로 두었다.

## src 버그 의심

없다. 정리하다 나온 것은 둘 다 시험 쪽 문제였다(expansion이 두 번 돈 것 · content가 등록을 남의 import에 기댄 것).

## smoke

시험이 tools(bot.mjs · shopbot.mjs · run.mjs · fakedom.mjs)를 부르는 파일을 고쳤으므로 정리 뒤 `npm run smoke`를 한 번 돌렸다. 끝줄 `SMOKE OK`, 종료 0(원문 `smoke-after.txt`).

## 커밋

1. `4d286ff` 시험 도우미를 test/helpers로 모았다(시험 633 → 592, 지운 시험 없음)
2. `0f89c2d` 규칙 시험에서 다른 시험이 이미 재는 단언 · 시험을 지웠다(592 → 586)
3. `1ad7c09` 화면 시험의 늘 통과하는 단언과 겹친 단언을 지웠다
4. 이 보고서와 원문
