# 화면 글 검수 — 처음 보는 사람이 3초 안에 알아듣는가

사람이 해 보고 「왕홀의 혼? 이거 무슨 말인지 모르겠어. 그 외에도 설명이 이상한 게 많아」라고 했다(2026-09-28). 설계 담당이 게임 안 글 188개를 읽고 고칠 곳 표를 만들었고, 이 기록은 그 표와 전체 검수로 바꾼 글 전부다. 기준은 `voice.md` 「검수하는 법」 네 질문과 아래 넷이다.

- 글이 규칙과 맞는가(가장 중요). 글을 규칙에 맞췄다. 규칙 · 수치는 건드리지 않았다.
- 「조건: 효과」 한 줄, 효과 둘까지. 괄호 · 줄표 · 「~되」 · 긴 꼬리 없이.
- 같은 것을 같은 말로: 줄은 **여섯째 · 일곱째 · 여덟째 줄**(판 왼쪽 숫자 1~8, 옛 「두 줄 먼저 · 한 줄 먼저 · 맨 윗줄」). 먹을 적이 없어 멈추는 것은 **더 먹을 적이 없으면**(옛 「막히면」, 끊김과 헷갈렸다). 외통 뒤 새 적은 **적이 다시 찬다**(옛 「판이 다시 찬다 · 채워진다」). 모습이 유지되는 것은 **모습이 안 바뀐다**(옛 「그대로」).
- 이름이 서로 겹치지 않는가.

**[규칙]** 표시는 글이 규칙과 달랐던 것(아래 따로 모았다).

## 규칙과 달랐던 글
| 곳 | 글이 말한 것 | 실제 규칙(코드) |
|---|---|---|
| 격언 특진 | 폰 모습으로 둘을 먹으면 **곧바로** 승급 | `onCapture`가 `promoteFrom = 0`을 켠 뒤 갈아입기가 먼저 온다. 둘째 먹기가 폰이 아니면 그 모습이 되어 승급하지 않고, 그 뒤로 폰 모습이 되면 어느 줄에서든 승급한다(`chain.js` 승급 판정은 `c.form === 'P'`) |
| 격언 먼 길 | 세 칸 이상 **미끄러져** 먹을 때마다 | `dist >= 3`(체비쇼프 거리)만 본다. 낙타 · 야간기사처럼 뛰어 먹어도 센다 |
| 낱말 끊김 | 사슬이 끝나고 **기물을 잃는다** | 끊겨도 기물은 쓴 기물 더미로 가서 다음 대국에 돌아온다(`battle.js` endMove). 잃는 것은 유리 각인이 깨질 때뿐 |
| 명인 침묵 | **왼쪽** 격언 둘이 잠든다 | 잠드는 것은 격언 칸 첫째 · 둘째(`run.maxims` 차례). 격언 칸은 이제 오른쪽 세로 줄의 맨 위 |
| 처음 안내 golden | 금빛 적을 **먹으면** 금빛 꾸러미 | 꾸러미는 금빛 적을 먹고 **이긴** 대국 뒤에만 나온다(`run.js` endBattle) |

검수 표의 추측 중 규칙과 달랐던 것: **초월 사다리** 예시 「폰 › 나이트 › 룩 › 퀸」은 비숍이 빠졌다(`UP` = P › N › B › R › Q › Z). 사다리는 이미 덧말(가리키면 보이는 말풍선)에 「폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존」으로 있어 그대로 두고, 카드는 「먹을 때마다 한 단계 위 기물이 된다」로 줄였다(괄호는 voice.md가 막고, 상점 카드가 세 줄뿐이다). 나머지 표 항목(왕홀 여섯째 줄 · 왕관 4 일곱째 줄 · 흡수 세 번 · 메아리 · 변신 6은 먹을 적이 없을 때(`onBlocked`, 끊김과 다름) · 대가는 마지막 킹 · 안개는 행마가 닿는 칸 전부 · 광마는 나이트 모습으로 가장자리 칸을 먹을 때 · 고속도로는 b · g 세로줄 · 세기의 대국은 퀸 모습 먹기 하나에 ×1.5)은 규칙과 맞았다.

## 한국어(화면 글)
| # | 곳 | 전 | 뒤 | 까닭 |
|---|---|---|---|---|
| 1 | 혼 왕홀 | 승급하면 아마존 · 두 줄 먼저 승급 | 폰 모습이면 여섯째 줄에서 아마존으로 승급 | 무엇이 어디서 승급하는지 보이게. 효과 둘을 한 문장으로(상점 카드 세 줄) |
| 2 | 시너지 왕관 4 | 한 줄 먼저 승급한다 | 일곱째 줄에서 승급한다 | 「먼저」가 모호 — 판 왼쪽 숫자로 읽히는 줄 이름 |
| 3 | 혼 흡수 | 세 번까지 모습 그대로 · 먹은 적의 행마를 더한다 | 세 번까지 모습이 안 바뀌고, 먹은 적의 행마를 얻는다 | 「그대로」 · 「더한다」가 모호 |
| 4 | 혼 흡수(덧말) | 처음 세 먹기는 모습이 바뀌지 않고, 마지막에 먹은 적의 행마도 함께 쓴다 | 행마는 마지막에 먹은 적 하나의 것만 남는다 | 카드와 겹치는 말을 빼고, 쌓이지 않는다는 규칙만 |
| 5 | 혼 메아리 | 막히면 한 번, 처음 모습으로 돌아가 잇는다 | 더 먹을 적이 없으면 한 번, 처음 모습으로 돌아가 잇는다 | 「막히면」이 끊김으로도 읽힌다 — 규칙은 먹을 적이 없을 때만(onBlocked) |
| 6 | 시너지 변신 6 | 막히면 한 번, 거친 모든 모습의 행마로 잇는다 | 더 먹을 적이 없으면 한 번, 거친 모든 모습의 행마로 잇는다 | 메아리와 같은 조건 · 같은 말 |
| 7 | 혼 초월 | 먹으면 한 단계 위 모습이 된다 | 먹을 때마다 한 단계 위 기물이 된다 | 「모습」보다 「기물」이 사다리로 읽힌다. 사다리(폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존)는 덧말 그대로 |
| 8 | 특성 거울 → 허수아비(이름) | 거울 | 허수아비 | 명인 「거울」과 이름이 겹쳤다. 먹어도 그것이 안 되는 가짜 적 |
| 9 | 특성 허수아비 | 먹어도 모습이 그대로 | 먹어도 모습이 안 바뀐다 | 「그대로」가 모호 |
| 10 | 명인 침묵 **[규칙]** | 왼쪽 격언 둘이 잠든다 | 맨 위 격언 둘이 잠든다 | 격언 칸은 오른쪽 세로 줄 — 잠드는 것은 첫째 · 둘째 칸(맨 위) |
| 11 | 명인 대가 | 킹이 둘이다 | 킹이 둘 · 둘 다 먹어야 외통 | 외통이 어떻게 되는지 — 마지막 킹을 먹어야 외통 |
| 12 | 명인 안개 | 위 다섯 줄은 안개라 떨굴 수 없다 · 닿은 칸만 걷힌다 | 위 다섯 줄은 안개라 떨굴 수 없다 · 내 기물의 행마가 닿으면 걷힌다 | 「닿은 칸」이 먹은 칸으로 읽힌다 — 규칙은 행마가 닿는 칸 전부 |
| 13 | 격언 외통 사냥꾼 | 킹을 지키는 적 −1 · 외통 승리: 상금 +6 | 킹을 지키는 적이 하나 적다 · 외통 승리: 상금 +6 | 「적 −1」이 읽히지 않는다 |
| 14 | 격언 광마 | 가장자리의 나이트: 지키는 적을 한 번 무시한다 | 가장자리에서 나이트 모습으로 먹으면: 지키는 적을 무시한다 | 조건이 모호 — 규칙은 나이트 모습으로 가장자리 칸을 먹을 때 |
| 15 | 격언 광마(덧말) | 나이트 모습으로 가장자리 칸에서 먹을 때, 사슬마다 한 번 | 사슬마다 한 번 | 조건은 카드로 올렸다 |
| 16 | 정석 판의 문 | 문 위 적을 먹으면 다른 문에서 이어 간다 · 대국마다 문 둘 | 대국마다 문 둘 · 문 위 적을 먹으면 다른 문으로 건너가 잇는다 | 무엇이 있는지 먼저, 그다음 쓰는 법 |
| 17 | 정석 고속도로 | b · g 줄에선 어느 모습이든 세로로 미끄러져 먹는다 | b · g 세로줄: 어느 모습이든 세로로 미끄러져 먹는다 | 「줄」이 가로인지 세로인지 |
| 18 | 시너지 왕관 6 | 외통하면 판이 다시 찬다 · 대국마다 한 번 | 외통하면 적이 다시 차고 사슬이 이어진다 · 대국마다 한 번 | 「판이 다시 찬다」가 모호 — 적이 새로 서고 같은 사슬이 이어진다 |
| 19 | 전설 오페라 대국 | 지켜진 킹도 먹는다 · 외통하면 판이 다시 차고 사슬이 이어진다 | 지켜진 킹도 먹는다 · 외통하면 적이 다시 차고 사슬이 이어진다 | 왕관 6과 같은 말 |
| 20 | 전설 세기의 대국 | 퀸 모습으로 먹은 만큼, 사슬 끝에 배수 ×1.5 | 퀸 모습으로 먹을 때마다: 사슬 끝 배수 ×1.5 | 「만큼」이 모호 — 퀸 모습 먹기 하나에 ×1.5 한 번 |
| 21 | 대국 알림(외통 뒤 다시 채움) | '판이 다시 채워진다' | '적이 다시 찬다' | 왕관 6 · 오페라와 같은 말 |
| 22 | 대국 알림(허수아비를 먹었을 때) | this.word('거울' | this.word('허수아비' | 특성 이름을 따라 |
| 23 | 처음 안내 shop | 격언은 판 내내 붙어 있다 — 사면 오른쪽 칸에 들어간다 | 산 격언은 오른쪽 칸에서 판 내내 힘을 낸다 | 줄표 없이 한 문장 |
| 24 | 처음 안내 pack | 셋 중 하나를 고른다 — 고르지 않고 넘겨도 된다 | 셋 중 하나를 고른다. 넘겨도 된다 | 줄표 · 긴 꼬리 |
| 25 | 처음 안내 draft | 판 끝까지 가는 큰 선택 — 정석마다 시너지가 다르다 | 정석은 판 끝까지 간다. 정석마다 시너지가 다르다 | 줄표 |
| 26 | 처음 안내 master | 명인 대국 — 명인은 규칙 하나를 비튼다 | 명인은 규칙 하나를 비튼다 | 줄표 · 머리말 되풀이 |
| 27 | 처음 안내 golden **[규칙]** | 금빛 적을 먹으면 금빛 꾸러미를 받는다 | 금빛 적을 먹고 이기면 금빛 꾸러미를 받는다 | 꾸러미는 대국을 이겨야 나온다(run.js endBattle) |
| 28 | 처음 안내 trait | 특성이 있는 적 — 가리키면 무엇을 하는지 보인다 | 발밑 문양은 특성. 가리키면 무엇을 하는지 보인다 | 줄표 · 무엇을 보라는지(문양) |
| 29 | 처음 안내 things | 판 위의 벽 · 보석 — 가리키면 무엇을 하는지 보인다 | 벽과 보석은 가리키면 무엇을 하는지 보인다 | 줄표 |
| 30 | 처음 안내 fairy | 체스에 없는 행마를 가진 특수 기물 — 누르면 먹을 수 있는 칸이 보인다 | 특수 기물은 체스에 없는 행마를 쓴다. 누르면 먹을 칸이 보인다 | 줄표 · 긴 머리 |
| 31 | 처음 안내 incoming | 점선 그림자는 증원 — 이 수가 끝나면 그 칸에 적이 들어온다 | 점선 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다 | 줄표 |
| 32 | 처음 안내 maximSell | 격언을 누르면 팔 수 있다 — 끌어서 순서를 바꾼다 | 격언을 누르면 팔 수 있고, 끌면 순서가 바뀐다 | 줄표 |
| 33 | 처음 안내 joseki | 고른 정석 — 가리키면 무엇을 하는지 보인다 | 고른 정석은 가리키면 무엇을 하는지 보인다 | 줄표 |
| 34 | 처음 안내 tactic | 묘수 — 떨구기 전에 눌러 이번 대국에 한 번 쓴다 | 묘수는 떨구기 전에 눌러 이번 대국에 한 번 쓴다 | 줄표 |
| 35 | 처음 안내 bigText | 창이 작아 글이 작게 보인다 — 설정에서 큰 글자를 켤 수 있다 | 창이 작아 글이 작다. 설정에서 큰 글자를 켤 수 있다 | 줄표 |
| 36 | 격언 특진 **[규칙]** | 폰 모습으로 둘을 먹으면 곧바로 승급 | 폰 모습으로 둘을 먹은 뒤: 어느 줄에서든 승급 | 둘째 먹기에서 폰이 아닌 적을 먹으면 그 모습이 되어 승급하지 않는다 — 규칙은 「그 뒤로 폰 모습이면 어느 줄에서든」 |
| 37 | 격언 먼 길 **[규칙]** | 세 칸 이상 미끄러져 먹을 때마다 값 +20 | 세 칸 이상 떨어진 적을 먹을 때마다 값 +20 | 낙타 · 야간기사처럼 뛰어 먹어도 센다(거리만 본다) |
| 38 | 정석 왕좌 | 폰으로 시작한 사슬이 승급하면 그 폰은 퀸으로 남는다 | 폰으로 시작해 승급하면: 주머니의 그 폰이 퀸이 된다 | 「남는다」가 어디에 남는지 모호 — 대국 뒤 주머니의 폰이 퀸으로 바뀐다 |
| 39 | 전설 폰 여덟의 행진 | 폰으로 시작하면 여섯째 줄에서 승급 · 승급마다 배수 ×3 | 폰으로 시작: 여섯째 줄에서 승급 · 승급마다 배수 ×3 | 「조건: 효과」 꼴 |
| 40 | 시너지 기사 4 | 대국마다 한 번, 뛰어 먹으면 지키는 적 무시 | 대국마다 한 번, 뛰어 먹으면 지키는 적을 무시한다 | 명사로 끊겨 어색 |
| 41 | 낱말 끊김 **[규칙]** | 지키는 적을 못 먹으면 사슬이 끝나고 기물을 잃는다. 점수는 받는다 | 지키는 적을 못 먹으면 사슬이 끝난다. 그때까지 점수는 받는다 | 끊겨도 기물은 주머니에 남는다(battle.js endMove) — 잃는 것은 유리 각인이 깨질 때뿐 |
| 42 | 낱말 승급 | 폰 모습으로 맨 윗줄에 닿으면 퀸이 된다 | 폰 모습으로 여덟째 줄에 닿으면 퀸이 된다 | 여섯째 · 일곱째 줄과 같은 말(판 왼쪽 숫자) |
| 43 | 수업 ① 떨군다 | 빛나는 칸에 떨군다 — 그 자리에서 먹을 적이 있는 칸만 빛난다 | 빛나는 칸에 떨군다. 먹을 적이 닿는 칸만 빛난다 | 줄표 · 「그 자리에서」 군말 |
| 44 | 수업 ③ 점수 | 점수 = 값 × 배수 — 길게 이을수록 곱이 커진다 | 점수 = 값 × 배수. 길게 이을수록 커진다 | 줄표 |
| 45 | 수업 ④ 시범 | 룩을 먼저 먹으면 비숍이 그 칸을 지킨다 — 룩 모습으로는 비숍을 못 먹어 사슬이 끊긴다 | 룩을 먼저 먹으면 비숍이 그 칸을 지킨다. 룩 모습으로는 비숍을 못 먹어 끊긴다 | 줄표 |
| 46 | 수업 ⑤ 첫 수 | 폰을 먹고 첫 수가 끝난다 — 수 구슬이 하나 준다 | 폰을 먹으면 첫 수가 끝나고 수 구슬 하나가 꺼진다 | 줄표 · 「준다」가 「주다」로 읽힌다 |
| 47 | 수업 ⑥ 버리기 | 폰은 떨굴 곳이 없다 — 버릴 폰을 누른다 | 폰은 떨굴 곳이 없다. 버릴 폰을 누른다 | 줄표 |
| 48 | 수업 ⑧ 외통 | 킹은 지키는 적이 하나라도 있으면 먹을 수 없다 — 룩이 킹을 지킨다 | 킹은 지키는 적이 있으면 못 먹는다. 지금은 룩이 지킨다 | 줄표 · 길다 |
| 49 | 수업 ⑩ 격언 사기 | 진열의 격언 「기사도」를 산다 — 격언은 판 내내 붙어 있다 | 진열의 격언 「기사도」를 산다. 격언은 판 내내 힘을 낸다 | 줄표 · 처음 안내와 같은 말 |
| 50 | 수업 ⑩ 꾸러미 | 기물 꾸러미를 연다 — 셋 중 하나를 고른다 | 기물 꾸러미를 연다. 셋 중 하나를 고른다 | 줄표 |
| 51 | 수업 ⑩ 낙타 | 낙타를 고른다 — 나이트처럼 뛰는 특수 기물 | 낙타를 고른다. 나이트처럼 뛰는 특수 기물이다 | 줄표 |
| 52 | 수업 ⑩ 시너지 | 기사도와 낙타로 기사 시너지가 2개 — 첫 효과가 켜졌다. 4개 · 6개면 더 켜진다 | 기사도와 낙타로 기사 시너지가 2개. 첫 효과가 켜졌고, 4개 · 6개면 더 켜진다 | 줄표 |
| 53 | 행마 보석 | 먹으면 상금 +2. 모습은 그대로 | 먹으면 상금 +2. 모습은 안 바뀐다 | 허수아비와 같은 일은 같은 말로 |
| 54 | 낱말 보석 | 먹으면 상금 +2. 모습은 그대로 | 먹으면 상금 +2. 모습은 안 바뀐다 | 허수아비와 같은 일은 같은 말로 |


문서 · 주석: `docs/DESIGN.md`의 혼 「왕관」 → 「왕홀」(규칙 설명도 여섯째 줄로), 메아리 「막히면」 → 「더 먹을 적이 없으면」, 적 특성 「거울 · 성채」 → 「허수아비 · 파수꾼」, 명인 침묵 「왼쪽」 → 「맨 위」, 대가에 「둘 다 먹어야 외통」. 코드 주석 넷(`traits.js` · `chain.js` · `parts-depth.js`의 거울 → 허수아비, `battle.js` 안개 「위 세 줄」 → 「위 다섯 줄」).

## 영어(`src/data/i18n/en.js` · `glossary.js` 영어 칸)
영어 카드는 글자가 넓어 상점 카드 세 줄 · 금빛 꾸러미 판본 카드 두 줄에 맞춰 줄였다(`test/layout.test.js`가 잰다).

| # | 곳 | 전 | 뒤 | 까닭 |
|---|---|---|---|---|
| 1 | 혼 왕홀 | Promotes to amazon · two ranks sooner | As a pawn: amazon on the sixth rank | 한국어와 같은 뜻 |
| 2 | 시너지 왕관 4 | Promote one rank sooner | Promote on the seventh rank | 한국어와 같은 뜻 |
| 3 | 혼 흡수 | Form holds for 3 takes · adds their moves | Form holds for 3 takes · gains the taken move | 한국어와 같은 뜻 |
| 4 | 혼 흡수(덧말) | The first three takes keep your form, and you also use the move of the last enemy taken | Only the last taken move stays | 한국어와 같은 뜻 |
| 5 | 혼 메아리 | Once when stuck: back to start form | Once, if nothing is left: back to first form | 「stuck」이 끊김으로도 읽혔다 |
| 6 | 시너지 변신 6 | Once when stuck, goes on with the moves of every form it wore | Once, with nothing left to take: go on with every form it wore | 메아리와 같은 말 |
| 7 | 혼 초월 | Each take: one step up | Each take: the next piece up | 「one step up」이 무엇인지 모호 |
| 8 | 특성 허수아비(이름) | Mirror(명인과 같은 열쇠 「거울」) | Decoy(새 열쇠 「허수아비」) | 명인 Mirror와 겹치지 않게 |
| 9 | 특성 허수아비 | Taking it keeps your form | Taking it doesn't change your form | 한국어와 같은 말 |
| 10 | 명인 침묵 | Your two leftmost maxims sleep | Your top two maxims sleep | 격언 칸은 오른쪽 세로 줄 |
| 11 | 명인 대가 | There are two kings | Two kings · a mate takes both | 외통이 어떻게 되는지 |
| 12 | 명인 안개 | Fog on the top five ranks: no drops · only squares you reach clear | Fog on the top five ranks: no drops · your reach clears it | 행마가 닿는 칸 |
| 13 | 격언 외통 사냥꾼 | King guard −1 · Mate win: +$6 | (같음) | 한국어 열쇠만 바뀜. 「One fewer king guard」는 금빛 꾸러미의 판본 카드(두 줄)를 넘어 영어는 그대로 |
| 14 | 격언 광마 | Knight on the edge: ignore guards once | Knight take on an edge: ignore guards | 조건을 규칙대로 |
| 15 | 격언 광마(덧말) | A knight-form take on an edge square, once per chain | Once per chain | 조건은 카드로 |
| 16 | 정석 판의 문 | Take on a gate: go on from the other gate · two gates per match | Two gates per match · take on one to cross to the other | 순서 |
| 17 | 정석 고속도로 | On the b and g files, any form slides vertically to take | b and g files: any form slides up and down to take | 「조건: 효과」 꼴 |
| 18 | 시너지 왕관 6 | A mate refills the board · once per match | A mate refills the enemies and the chain goes on · once per match | 무엇이 다시 차는지 |
| 19 | 전설 오페라 대국 | Take even guarded kings · a mate refills the board and the chain goes on | Take even guarded kings · a mate refills the enemies and the chain goes on | 왕관 6과 같은 말 |
| 20 | 전설 세기의 대국 | ×1.5 Mult at chain end for each take as a queen | Each take as a queen: ×1.5 Mult at chain end | 「조건: 효과」 꼴 |
| 21 | 대국 알림(다시 채움) | The board refills | Enemies refill | 효과 글과 같은 말 |
| 22 | 격언 특진 | 2 pawn takes: promote now | 2 pawn takes: any rank | 규칙대로. 「promote anywhere」는 판본 카드 두 줄을 넘는다 |
| 23 | 격언 먼 길 | Each take after sliding 3+ squares: +20 Value | Each take 3+ squares away: +20 Value | 규칙대로(거리만 본다) |
| 24 | 정석 왕좌 | A pawn that starts a chain and promotes stays a queen | Pawn start that promotes: that pawn becomes a queen in your bag | 어디에 남는지 |
| 25 | 전설 폰 여덟의 행진 | Start with a pawn: promote on the sixth rank · ×3 Mult per promotion | (같음) | 한국어 열쇠만 바뀜(영어 그대로) |
| 26 | 시너지 기사 4 | Once per match, a jumping take ignores its guards | (같음) | 한국어 열쇠만 바뀜(영어 그대로) |
| 27 | 처음 안내 shop | Maxims stay all run — bought ones go in the right column | Maxims you buy work all run from the right column | 줄표 |
| 28 | 처음 안내 pack | Pick one of three — or skip | Pick one of three. Skipping is fine too | 줄표 |
| 29 | 처음 안내 draft | A pick for the whole run — each joseki brings its own synergy | A joseki lasts the whole run. Each brings its own synergy | 줄표 |
| 30 | 처음 안내 master | Master battle — a master twists one rule | A master bends one rule | 줄표 · battle은 Match |
| 31 | 처음 안내 golden | Take the golden enemy for a golden pack | Take a golden enemy and win for a golden bundle | 규칙대로 · pack은 bundle |
| 32 | 처음 안내 trait | An enemy with a trait — point at it to see what it does | The mark at its feet is a trait. Point at it to see what it does | 줄표 |
| 33 | 처음 안내 things | Walls and gems on the board — point at them to see what they do | Point at walls and gems to see what they do | 줄표 |
| 34 | 처음 안내 fairy | A special piece with a move chess does not have — tap it to see where it can take | Special pieces move in ways chess does not. Tap one to see where it can take | 줄표 |
| 35 | 처음 안내 incoming | Dotted shadows are reinforcements — enemies land there when this move ends | Dotted shadows are reinforcements. Enemies land there when this move ends | 줄표 |
| 36 | 처음 안내 maximSell | Tap a maxim to sell it — drag to reorder | Tap a maxim to sell it, drag to reorder | 줄표 |
| 37 | 처음 안내 joseki | Your joseki — point at it to see what it does | Point at your joseki to see what it does | 줄표 |
| 38 | 처음 안내 tactic | A trick — tap it before a drop to use it once this match | Tap a trick before a drop to use it once this match | 줄표 |
| 39 | 처음 안내 bigText | The window is small, so text is small — turn on Big text in Settings | The window is small, so text is small. Turn on Large Text in Settings | 줄표 · 설정 단추 이름(Large Text)과 맞춤 |
| 40 | 수업 ① 떨군다 | Drop it on a glowing square — only squares with prey in reach glow | Drop it on a glowing square. Only squares with prey in reach glow | 줄표 |
| 41 | 수업 ③ 점수 | Score = value × mult — the longer the chain, the bigger the product | Score = value × mult. The longer the chain, the bigger | 줄표 |
| 42 | 수업 ④ 시범 | Take the rook first and the bishop guards that square — as a rook you cannot take it, so the chain breaks | Take the rook first and the bishop guards that square. As a rook you cannot take it, so the chain breaks | 줄표 |
| 43 | 수업 ⑤ 첫 수 | Take the pawn and the first move ends — one bead goes out | Take the pawn: the first move ends and one bead goes out | 줄표 |
| 44 | 수업 ⑥ 버리기 | Pawns have nowhere to drop — tap a pawn to throw back | Pawns have nowhere to drop. Tap a pawn to throw away | 줄표 |
| 45 | 수업 ⑧ 외통 | A king cannot be taken while anything guards it — the rook guards the king | A guarded king cannot be taken. Right now the rook guards it | 줄표 |
| 46 | 수업 ⑩ 격언 사기 | Buy the maxim “Chivalry” — maxims stay with you all run | Buy the maxim “Chivalry”. Maxims work all run | 줄표 |
| 47 | 수업 ⑩ 꾸러미 | Open the piece pack — pick one of three | Open the piece bundle. Pick one of three | 줄표 · pack은 bundle |
| 48 | 수업 ⑩ 낙타 | Take the camel — a special piece that jumps like a knight | Take the camel. It is a special piece that jumps like a knight | 줄표 |
| 49 | 수업 ⑩ 시너지 | Chivalry and the camel make Rider synergy 2 — its first effect is on. More at 4 and 6 | Chivalry and the camel make Rider synergy 2. Its first effect is on, more at 4 and 6 | 줄표 |
| 50 | 낱말 끊김 | Miss the guard and the chain ends and your piece is lost. You keep the score | Miss the guard and the chain ends. You keep the score so far | 끊겨도 기물은 잃지 않는다 |
| 51 | 낱말 승급 | A pawn form reaching the top row becomes a queen | A pawn form reaching the eighth rank becomes a queen | 여섯째 · 일곱째 줄과 같은 말 |
| 52 | 행마 보석 | Take it for +2 Purse. Your form stays | (같음) | 한국어 열쇠만 바뀜(영어 그대로) |
| 53 | 혼 흡수(이름) | Absorbed | Absorb | 「Absorbed Soul」이 어색 — 다른 혼 이름처럼 동사 · 명사 하나 |

그대로 둔 것: 대주교 행마 「Takes like a bishop or knight」를 재상 · 아마존처럼 「Slides like a bishop or jumps like a knight to take」로 바꾸면 기물 카드가 한 줄 넘쳐(165 > 160) 되돌렸다.

## 내가 정한 것
- **특성 거울의 새 이름은 「허수아비」(영어 Decoy).** 적처럼 서 있지만 먹어도 그것이 되지 않는 가짜라서. 검수 표의 예 「허상」보다 한국어로 곧바로 그림이 그려진다. 저장 id는 `mirror` 그대로.
- **왕홀은 효과 둘을 한 문장으로** 「폰 모습이면 여섯째 줄에서 아마존으로 승급」. 표의 예 「폰 모습이면 여섯째 줄에서 승급 · 승급하면 아마존」은 상점 카드가 한 줄 넘쳤다(169 > 160).
- **광마 덧말은 「사슬마다 한 번」만.** 조건(가장자리 · 나이트 모습 · 먹을 때)은 카드로 올렸다.
- **흡수 덧말은 「행마는 마지막에 먹은 적 하나의 것만 남는다」.** 옛 덧말은 카드와 같은 말을 되풀이했다. 흡수는 행마가 쌓이지 않는다(`c.absorbed = [target.t]`)는 것이 카드에 없는 규칙이다.
- **상록의 대국 「사슬이 멈추면」은 그대로.** 끊김과 먹을 적이 없는 것 둘 다에 듣는다(`onChainStop`). 「더 먹을 적이 없으면」과 일부러 다른 말이다.
- **처음 안내 · 수업은 줄표 대신 마침표 두 문장까지.** 검수 표의 예 「셋 중 하나를 고른다. 넘겨도 된다」와 같은 꼴.
- **영어 흡수 이름 Absorbed → Absorb.** 「Absorbed Soul」이 어색했다.
- **영어 특진은 「2 pawn takes: any rank」, 외통 사냥꾼은 옛 「King guard −1」 그대로.** 판본 카드 두 줄에 규칙대로 들어가는 말이 이것뿐이었다.

## 남은 것(이번 일 밖 · 보고만)
- **왕홀이라는 이름.** 사람이 막힌 것은 카드 제목 「왕홀의 혼」이기도 하다. 왕홀은 드문 낱말이다(`voice-review.md`가 시너지 「왕관」과 겹치지 않게 붙인 이름). 글은 고쳤지만 이름 자체가 무엇을 하는지 말하지 않는다. 아마존으로 승급한다는 것이 이름에 드러나는 새 이름을 사람에게 물어 정할 것.
- **혼 「그림자」와 증원 「그림자」.** 처음 안내 · 수업이 증원을 「점선 그림자」 · 「▼ 그림자」로 부른다. 혼 이름과 같은 낱말이다. 격언 「그림자 읽기」는 증원 쪽 뜻이다.
- **혼 「사냥꾼」 · 격언 「외통 사냥꾼」 · 시너지 「사냥」**이 같은 뿌리의 말을 나눠 쓴다.
- 격언 대관식 「퀸 모습이 될 때마다 값 +50」은 아마존으로 승급할 때도 받는다(`onPromote`). 격언 빈 판 「판에 적이 여덟 이하」는 벽 · 보석도 센다(`c && !c.mine`). 특성 배신자는 주머니가 열넷이면 들어오지 않는다. 글에 없는 드문 경우라 그대로 뒀다.
- 시너지 기사 4의 「뛰어 먹으면 지키는 적을 무시한다」는, 뛰어 먹은 칸에 지키는 적이 없으면 표시(`leapGuard`)가 남아 뒤의 다른 먹기에서 쓰인다. 글보다 규칙이 넓다.
- `npm run smoke` 「낱말 상자: 진열」이 60 → 57. 혼 글이 바뀌며 연기 시험이 지나는 상점 차례가 달라져 낱말이 없는 카드(기보 · 각인)를 더 가리켰다. 겹침 · 상자 없음 · 셋 넘음은 모두 0 그대로. 영어는 「자리가 없어 뺌」이 3 → 1로 줄었다.

## 스크린샷
`docs/shots/text-review/` 1배(480×270), 한국어(`ko-`) · 영어(`en-`) 같은 장면: 상점 혼 셋(왕홀 · 흡수 · 초월, 가리킴 셋) · 메아리와 격언(광마 가리킴) · 특진 · 먼 길 · 세기의 대국 조각(가리킴) · 정석 고르기(판의 문 · 고속도로 · 왕좌) · 명인 카드(침묵 · 안개 · 대가) · 대국 시너지 말풍선(왕관 6 · 변신 6) · 처음 안내(상점 · 격언 팔기) · 수업 ⑤ · ⑧ · 낱말 풀이. 찍는 대본은 저장소 밖(세션 scratchpad `shots-text.mjs`, `tools/shots-ux.mjs`와 같은 꼴).
