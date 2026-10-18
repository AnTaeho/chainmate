# 영어 글 다듬기 (CHM-30)

영어 글은 발라트로 · 슬레이 더 스파이어 영어판처럼 짧고 또렷한 카드 글을 기준으로 쓴다. 값은 `src/data/i18n/en.js`와 `src/ui/glossary.js` 영어 칸(enWord · en · enSay)에 있다. 한국어 열쇠와 틀 정규식(PRE · TEMPLATES)은 한국어 쪽과 같이 둔다.

## 낱말 표

한 개념은 한 낱말로 쓴다. 한국어 낱말 기준은 `voice.md`이고, 영어 값은 `src/data/i18n/en.js`가 기준이다.

| 한국어 | 영어 | 메모 |
|---|---|---|
| 판 | Run | 기록 칸 · 탭 이름은 Runs |
| 관 | Hall | Round · Stage도 재 봤다. 「Round 2 · Practice」가 판 틀 왼쪽 제목 칸(112)을 넘어 smoke 글 넘침 33이 났다. 세력이 차지한 땅이라 Hall이 뜻에도 맞다 |
| 대국 · 연습 대국 · 정식 대국 · 마스터전 | Match · Practice Match · Rated Match · Master Match | 첫 대본의 「battle」과 수업 탭 「Battle」을 Match로 맞췄다 |
| 수 | Move(s) | |
| 손 · 덱 · 버리기 | Hand · Deck · Discard | |
| 놓기 | Drop | |
| 잡기 | Take | |
| 콤보 | Chain | |
| 모습 · 갈아입기 | Form · Change | |
| 값 · 배수 · 점수 · 목표 | Value · Mult · Score · Target | 수업 글의 goal을 Target으로 맞췄다(수업 목표 「Goal: checkmate」만 goal) |
| 상금 | Purse, 효과 글에서는 `$` | 체스 대회의 상금이 purse다. 효과 글은 발라트로처럼 `+$2` |
| 지키는 적 | Guard | |
| 끊김 | Break | |
| 증원 | Recruit | Reinforcement는 카드 이름 칸 · 효과 칸에서 「Reinforce/ment」로 글자 단위로 끊겼다. 막 들어온 적 = 새로 뽑힌 병사. 「Take a fresh recruit」처럼 소리 내어 읽어도 자연스럽다 |
| 체크메이트 | Checkmate, 좁은 곳은 Mate | 수업 · 낱말 풀이 · 업적은 Checkmate, 카드 효과 · 보상 줄은 Mate |
| 프로모션 | Promotion · promote | |
| 마스터 · 마스터의 상자 | Master · Master's Chest | |
| 레퍼토리 | Repertoire | |
| 전술 | Tactic | |
| 격언 | Maxim | |
| 기보 | Tome | Study는 체스에서 「습작 퍼즐」이라 한 모습의 레벨을 올리는 물건으로 읽히지 않았다. Knight Tome Lv 2 · Tome Bundle · Tome Collector |
| 각인 · 혼 · 각성 | Engraving · Soul · Awakening(동사 Awaken) | |
| 진화 | Evolve | 낱말 풀이 제목도 Evolution에서 두루마리 이름과 같은 Evolve로 |
| 특수 기물 · 기본 기물 | Special piece · Chess pieces | 행마 보기 탭 「Basic pieces」를 Chess pieces로 |
| 시너지 | Synergy | 기사 Rider · 성채 Fortress · 사제 Cleric · 변신 Shift · 희생 Sacrifice · 왕관 Crown · 행진 March · 사냥 Hunt · 역습 Counter · 매복 Ambush |
| 세력 · 버릇 | Faction · Habit | |
| 팩 · 두루마리 · 도감 · 진열 | Bundle · Scroll · Almanac · For Sale | 진열은 상점 머리 글이라 Display보다 For Sale |
| 명경기 · 명경기 조각 · 재현 · 불멸의 기보 | Classic · Classic Fragment · Reenact · Immortal Games | |
| 판본 | Edition | |
| 시계 · 다시 놓기 | Clock · New Board | |
| 레이팅 | Rating | |

성채 하나만 두 뜻이다. 한국어도 세력 「성채」와 시너지 「성채」가 같은 낱말이고 화면은 한 열쇠로 옮기므로 영어도 Fortress 하나로 둔다. 그전엔 열쇠가 두 번 적혀 뒤의 Fortress가 이겼는데, 낱말 풀이는 「Castle synergy」를 찾아 시너지 상자가 영어에서 뜨지 않았다.

## 대소문자 · 숫자 · 문장 규칙

- **Value · Mult · Target**은 어디서나 대문자로 쓴다(발라트로의 Chips · Mult처럼 점수판 낱말). 돈은 `$`로 쓴다.
- 그 밖의 낱말(chain · take · drop · form · guard · break · recruit · mate · promotion · maxim · tome · soul · repertoire …)과 **기물 이름은 문장 안에서 소문자**로 쓴다: 「Each take as a pawn」, 「Two knights become nightriders」.
- **이름**(격언 · 레퍼토리 · 혼 · 각인 · 세력 · 마스터 · 명경기 · 시너지)과 **화면 제목 · 단추**는 Title Case로 쓴다: Next Match · Reduce Motion · Knight Tome. 줄 이름표는 첫 글자만 대문자로 쓴다: Best move · Runs won.
- **효과 글은 「Condition: effect」**로 쓴다. 콜론은 한 번만 쓴다(`parts.js` effectPart · effectHead가 첫 콜론 뒤를 좁은 칸에 쓴다). 효과는 두 개까지 「 · 」로 잇는다.
  - 먹을 때마다: `Each take as a bishop: +25 Value` · `Each rook taken: +4 Mult` · `Each take on an edge square: +2 Mult`
  - 시작 기물: `Start with a knight: ×1.5 Mult`
  - 사슬 조건: `Broken chain: +8 Mult` · `Chain through 4+ forms: ×2 Mult`
  - 더 먹을 적이 없을 때는 모두 **when stuck**: `Once, when stuck: back to your first form`
- 각인 글은 이름 뒤에 콜론으로 붙어 나온다(「Amber: …」). 그래서 콜론 없이 쓴다: `×2 Value on the first take` · `+$1 per recruit taken`.
- 숫자: 늘리기는 `+20 Value` · `+1 Move` · `+1 Discard`(숫자 먼저), 곱하기는 `×2 Mult`, 확률은 `1 in 4`. 서수는 `5th rank` · `2nd take`. 「이상」은 `3+`로 쓴다.
- 문장 끝에 마침표를 찍지 않는다(한국어 화면 글과 같다). 두 문장이면 가운데만 마침표를 찍는다.
- 킹의 대본은 짧은 명령문 · 평서문으로 쓴다: 「Take the rook. You are what you take」 · 「The guard is gone. The chain holds」. 수업 걸음은 같은 명령문을 2인칭 현재로 쓴다.

## 이름

- 이름은 카드 이름 칸(굵게 68) · 격언 칸 이름 자리(아이콘 없이 98)에서 글자 단위로 끊기지 않게 고른다. 넘치면 짧은 영어 이름으로 바꾼다(예: Coronation → Crowning, Road to the Queen → Queen's Road). 지금 이름은 `en.js`가 기준이다.
- 혼 이름은 명사로 쓴다(Mimic · Ascent · Heir). 코드 id와 같은 말이 자연스러우면 그것을 쓴다(Shade · Bomb).
- 한 개념을 두 이름이 나눠 쓰지 않게 한다(Collector 셋 → Wardrobe · Tome Hoard, Counter 겹침 → Crossfire).

지킨 이름: 체스 명경기의 실제 영어 이름(The Immortal Game · The Opera Game · The Game of the Century · The Evergreen Game)(격언 칸에서 「…」로 잘려도 지킨다 — 가리키면 말풍선에 온 이름, CHM-40), 오프닝(London · Sicilian · Queen's Gambit · Rook Endgame), 체스 말 이름(Passed Pawn · Rook Lift · Battery · Back Rank · Queen's Gambit), 세력 여덟과 마스터 일곱(기병대장만 Horse Captain으로 바꿨다, CHM-46).

이름 겹침: 격언 · 레퍼토리 · 혼 · 각인 · 판본 · 세력 · 마스터 · 명경기 · 특성 · 전술 · 시너지 이름을 영어로 모아 소문자로 견준다. 겹치는 것은 성채(세력 Fortress · 시너지 Fortress, 한국어도 같은 낱말) 하나다.

## 폭

- 늘린 글이 카드 높이 한도에 걸리면 영어를 줄인다(판본 격언 카드 160, 혼 깃든 특수 기물 카드는 시너지 칩 줄 때문에 효과 글 다섯 줄까지, 카드 아래 쓰는 법 줄 폭 94).
- 마스터 「Grandmaster」는 `select.js`가 재고 초상 아래 온 폭으로 옮겨 쓴다.
- 낱말 풀이 화면은 낱말 칸이 100 폭이라 시너지 낱말 제목에서 synergy를 뺐다(Rider · Fortress …). 글 안에서는 「Rider synergy」 꼴을 찾아 빛낸다.

## 틀(TEMPLATES · PRE) 출력

| 틀 | 영어 출력 |
|---|---|
| `(.+) 기보가 적용된다` | Knight Tome applies |
| `(\d+) › (\d+)단계` | Lv 0 › 1 |
| `(폰…킹) 모습` | Bishop Form(카드 이름) |
| `(.+)에 (.+) 각인` | Bronze on Knight |
| `상금 \+(\d+)` | +$2 |
| `도감 (\d+)칸을 새로 채웠다` | 단수 · 복수 가림(1 new Almanac entry) |
| `(\d+)판` | 1 run · 3 runs |
| `(기초\|대국\|판) n/m` | Match 2/4 · Run 1/2 |
| `버리기 (\d+)` | Discards 2 |
| `(.+) 모습으로 먹을 때마다 값 +n` | 관사를 소리로 고른다(an amazon) |
| `오프닝 「(.+)」이 열렸다` | 굽은따옴표 “London” |
| `금이 갔다 · 깨어나면: …` | Cracked · awakened: … |

## 남긴 것

- 격언 「Empty Bag」(빈 주머니)은 효과가 「주머니에 남은 기물마다 +1 Mult」이라 이름과 효과가 어긋나 보인다. 한국어 이름도 같은 모양이라 영어만 바꾸지 않았다.
- Shadow Reading 효과의 waves는 카드 높이 한도 때문에 남겼다. recruit로 쓰면 판본 카드가 한 줄 넘친다.
- 줄 바꿈은 줄 끝의 「 · 」를 지운다(`text.js` noDot). 그래서 「See 2 waves / Drop on one」처럼 두 줄로 나뉜 효과 사이에 구분 표시가 없다. 글이 아니라 줄 바꿈의 일이라 두었다.
