# 영어 글 다듬기 (CHM-30)

사람이 「영어 다듬기는 알아서 해」라고 했다. 그전 영어는 「옮기지 못한 글 0」 수준이었다. 한국어를 그대로 옮긴 글, 카드 폭에 맞추려고 억지로 줄인 글, 같은 개념을 여러 말로 부른 글이 섞여 있었다. 발라트로 · 슬레이 더 스파이어 영어판처럼 짧고 또렷한 카드 글을 기준으로 모든 영어 글을 다시 썼다.

- 고친 곳: `src/data/i18n/en.js` 값 267줄과 틀 출력 몇 곳, `src/ui/glossary.js` 영어 칸(enWord · en · enSay) 39줄. 한국어 열쇠와 틀 정규식은 그대로 두었다. 열쇠 830개가 같고 PRE · TEMPLATES 정규식도 모두 같은 것을 확인했다.
- 같은 열쇠가 두 번 적힌 줄(`허수아비` 셋, `은` · `무지개` · `거울` · `성채` · `도약` · `희생` · `기물` · `시계 −1` 둘)은 하나만 남겼다. 이긴 쪽 값은 아래 표에 적었다.
- 시험 하나(`test/layout.test.js` 줄 바꿈)가 옛 영어 낱말 `reinforcements`를 박아 두고 있었다. 「낱말을 글자로 끊지 않는다」는 뜻은 그대로 두고, 「줄은 낱말 사이에서만 바뀐다」(줄을 공백으로 이으면 옮긴 글과 같다)로 넓혔다.

## 낱말 표

한 개념은 한 낱말로 쓴다. ★는 이번에 바꾼 것이다.

| 한국어 | 영어 | 메모 |
|---|---|---|
| 판 | Run | 기록 칸 · 탭 이름은 Runs |
| 관 | Hall | Round · Stage도 재 봤다. 「Round 2 · Practice」가 판 틀 왼쪽 제목 칸(112)을 넘어 smoke 글 넘침 33이 났다. 세력이 차지한 땅이라 Hall이 뜻에도 맞다 |
| 대국 · 연습 대국 · 정식 대국 · 마스터전 | Match · Practice Match · Rated Match · Master Match | ★ 첫 대본의 「battle」과 수업 탭 「Battle」을 Match로 맞췄다 |
| 수 | Move(s) | |
| 손 · 주머니 · 버리기 | Hand · Bag · Discard | |
| 떨구기 | Drop | |
| 먹기 | Take ★ | 효과 글은 모두 take인데 동사 칩만 Capture였다 |
| 사슬 | Chain | |
| 모습 · 갈아입기 | Form · Change | |
| 값 · 배수 · 점수 · 목표 | Value · Mult · Score · Target | ★ 수업 글의 goal을 Target으로 맞췄다(수업 목표 「Goal: checkmate」만 goal) |
| 상금 | Purse, 효과 글에서는 `$` ★ | 체스 대회의 상금이 purse다. 효과 글은 발라트로처럼 `+$2` |
| 지키는 적 | Guard | |
| 끊김 | Break | |
| 증원 | Recruit ★ | Reinforcement는 카드 이름 칸 · 효과 칸에서 「Reinforce/ment」로 글자 단위로 끊겼다. 막 들어온 적 = 새로 뽑힌 병사. 「Take a fresh recruit」처럼 소리 내어 읽어도 자연스럽다 |
| 체크메이트 | Checkmate, 좁은 곳은 Mate | 수업 · 낱말 풀이 · 업적은 Checkmate, 카드 효과 · 보상 줄은 Mate |
| 프로모션 | Promotion · promote | |
| 마스터 · 마스터의 상자 | Master · Master's Chest | |
| 레퍼토리 | Repertoire | |
| 전술 | Tactic | |
| 격언 | Maxim | |
| 기보 | Tome ★ | Study는 체스에서 「습작 퍼즐」이라 한 모습의 레벨을 올리는 물건으로 읽히지 않았다. Knight Tome Lv 2 · Tome Bundle · Tome Collector |
| 각인 · 혼 · 각성 | Engraving · Soul · Awakening(동사 Awaken) | |
| 진화 | Evolve | ★ 낱말 풀이 제목도 Evolution에서 두루마리 이름과 같은 Evolve로 |
| 특수 기물 · 기본 기물 | Special piece · Chess pieces ★ | 행마 보기 탭 「Basic pieces」를 Chess pieces로 |
| 시너지 | Synergy | 기사 Rider · 성채 Fortress ★ · 사제 Cleric · 변신 Shift · 희생 Sacrifice · 왕관 Crown · 행진 March · 사냥 Hunt · 역습 Counter · 매복 Ambush |
| 세력 · 버릇 | Faction · Habit | |
| 꾸러미 · 두루마리 · 도감 · 진열 | Bundle · Scroll · Almanac · For Sale ★ | 진열은 상점 머리 글이라 Display보다 For Sale |
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

## 이름을 바꾼 것

| 종류 | 한국어 | 전 | 뒤 | 까닭 |
|---|---|---|---|---|
| 격언 | 오뚝이 | Second Wind | **Unbowed** | 격언 「두 번째 바람」과 영어 이름이 겹쳤다 |
| 격언 | 대관식 | Coronation | **Crowning** | 카드 이름 칸(굵게 68)에서 「Coronatio/n」으로 끊겼다 |
| 격언 | 체스판 | Checkerboard | **Light and Dark** | 끊김(91). 밝은 칸 · 어두운 칸 효과를 이름으로 |
| 격언 | 되받아치기 | Counterstrike | **Riposte** | 끊김(90). 지키는 적을 먹는 반격 |
| 격언 | 되돌이 | Homecoming | **Way Home** | 끊김(81) |
| 격언 | 반격의 서 | Book of Counters | **Crossfire** | 시너지 Counter · 격언 Riposte와 헷갈렸다. Counterplay는 폭 78 |
| 격언 | 모습 모으기 | Form Collector | **Wardrobe** | Collector가 셋(Tome · Form · Soul)이었다. 갈아입기 = 옷장 |
| 격언 | 왕의 목 | King's Neck | **Regicide** | 직역이 어색했다. 킹을 지키는 적 · 메이트에 붙는 격언 |
| 격언 | 대국의 기억 | Memory of Matches | **Trophy Case** | 메이트 승리마다 커지는 격언. 직역이 어색했다 |
| 격언 | 중앙 장악 | Center Grip | **Center Control** | 체스 말 |
| 격언 | 포위 | Encircle | **Pincer** | 동사가 이름이었다 |
| 격언 | 증원 환영 | Welcome | **Welcome Party** | 낱말 하나로는 무엇인지 몰랐다 |
| 격언 | 증원 사냥 | Reinforcement Hunt | **Recruit Hunt** | 증원 → Recruit |
| 격언 | 기보 수집가 | Study Collector | **Tome Collector** | 기보 → Tome |
| 격언 | 대장장이 | Blacksmith | **Smith** | 이름 칸 69 > 68 |
| 격언 | 금욕 | Asceticism | **Austerity** | 끊김(70). 더 흔한 말 |
| 격언 | 역전 | Reversal | **Comeback** | 끊긴 다음 수 ×2 — 게임 말 |
| 혼 | 흡수 | Absorb | **Mimic** | 혼 이름은 명사로(「Absorb Soul」은 동사) |
| 혼 | 초월 | Transcend | **Ascent** | 같은 까닭 |
| 혼 | 계승 | Inherit | **Heir** | 같은 까닭 |
| 혼 | 잠행 | Stealth | **Shade** | 코드 id(shade)와 같은 말. 지키는 적을 그림자처럼 지나간다 |
| 혼 | 도약 | Spring | **Pounce** | 첫 먹기를 두 칸 안 어디서나 — 덮친다 |
| 혼 | 역행 | Retrograde | **Backstep** | 폭 73. 뒤 대각으로도 먹는다 |
| 기물 | 대주교 | Archbishop | **Cardinal** | 끊김(73). 비숍 + 나이트의 다른 체스 이름 |
| 기물 | 메뚜기 | Grasshopper | **Hopper** | 끊김(81) |
| 적 특성 | 폭약 | Powder | **Bomb** | 코드 id와 같은 말. 「Bomb · Rook」이 곧바로 읽힌다 |
| 도박 | 수상한 물약 | Dubious Potion | **Shady Potion** | |
| 명경기 | 폰 여덟의 행진 | March of Eight Pawns | **March of the Eight** | 시너지 March와 같은 뿌리, 짧게 |
| 격언 | 끝줄의 꿈 | Back Rank Dream | **Back Rank** | CHM-40: 격언 칸 이름 자리(아이콘 없이 98)를 넘었다(굵게 112). 체스 말 back rank는 지킨다 |
| 격언 | 그림자 읽기 | Shadow Reading | **Foresight** | CHM-40: 넘침(105). 증원을 두 수 앞까지 본다 |
| 격언 | 기보 수집가 | Tome Collector | **Tome Hoard** | CHM-40: 넘침(99). 기보 → Tome은 지킨다 |
| 격언 | 퀸으로 가는 길 | Road to the Queen | **Queen's Road** | CHM-40: 넘침(122) |
| 격언 | 가득 찬 판 | Crowded Board | **Full Board** | CHM-40: 넘침(99). 한국어 그대로, 짝 Bare Board |
| 격언 | 왕의 발자국 | King's Footsteps | **King's Steps** | CHM-40: 넘침(110) |
| 명경기 | 폰 여덟의 행진 | March of the Eight | **March of Eight** | CHM-40: 넘침(122). March 뿌리는 지킨다 |
| 마스터 | 사냥꾼 두령 | Hunt Chief | (그대로) | Huntmaster를 재 봤는데 마스터 카드 초상 옆 칸에 굵게 안 들어가 관 선택 시험(253)을 넘었다 |
| 마스터 | 기병대장 | Cavalry Captain | **Horse Captain** | CHM-46: 마스터전 머리 칸 제목이 이름만이 된 뒤에도 굵게 99 > 96. 기병 = horse(굵게 89) |
| 수업 제목 | 잡으면 그것이 된다 | Take it, be it | **You Are What You Take** | 먹다 = eat. 「You are what you eat」을 비튼 말 |

지킨 이름: 체스 명경기의 실제 영어 이름(The Immortal Game · The Opera Game · The Game of the Century · The Evergreen Game)(격언 칸에서 「…」로 잘려도 지킨다 — 가리키면 말풍선에 온 이름, CHM-40), 오프닝(London · Sicilian · Queen's Gambit · Rook Endgame), 체스 말 이름(Passed Pawn · Rook Lift · Battery · Back Rank · Queen's Gambit), 세력 여덟과 마스터 일곱(기병대장만 Horse Captain으로 바꿨다, CHM-46).

이름 겹침: 격언 · 레퍼토리 · 혼 · 각인 · 판본 · 세력 · 마스터 · 명경기 · 특성 · 전술 · 시너지 이름을 영어로 모아 소문자로 견줬다. 겹치는 것은 성채(세력 Fortress · 시너지 Fortress, 한국어도 같은 낱말) 하나다.

## 폭

- 카드 이름 칸(굵게 68)에서 끊기던 낱말은 위 이름 바꾸기로 모두 없앴다. smoke 동안 글자 단위로 끊긴 영어 낱말을 모아 보니(그리기 직전 `wrap`을 엿봄, 저장소 밖 도구) 남은 것은 둘이다. 마스터 「Grandmaster」는 `select.js`가 재고 초상 아래 온 폭으로 옮겨 쓰니 화면에서 끊기지 않는다. 다른 하나는 뒤집히는 좁은 카드(연출, 글 넘침을 재지 않는 칸)다.
- 늘린 글이 높이 한도에 걸려 다시 줄인 곳:
  - 도감 명경기 칸 말풍선(CHM-46, 자리 119~165): 불멸의 대국 둘째 조각 「Take two rooks in one unbroken chain」 → 「Two rooks in one unbroken chain」(168 → 154, 자리 165).
  - 판본 격언 카드 160: Shadow Reading은 옛 「See 2 waves · Drop on one」으로 되돌렸다. Back Rank Dream · Trophy Case · Passed Pawn · Long Diagonal · Specialty도 줄였다.
  - 혼 카드: Mimic · Echo · Martyr · Relay · Ripple을 줄였다.
  - 카드 아래 쓰는 법 줄(폭 94): Onto a piece · Into a piece · Evolve one · In a match.
  - 관 선택 카드: Clock −1. 설정 오프닝 규칙 줄: Fewer big chests · Fewer fragments.
- 낱말 풀이 화면은 낱말 칸이 100 폭이다. 「Sacrifice synergy」 · 「Counter synergy」 · 「Ambush synergy」는 바꾸기 전에도 풀이 글을 덮고 있었다(smoke가 재지 않는 화면). 그래서 시너지 낱말의 제목에서 synergy를 뺐다(Rider · Fortress …). 탭 이름이 Synergy이고, 글 안에서는 여전히 「Rider synergy」 꼴을 찾아 빛낸다.

## 틀(TEMPLATES · PRE) 출력을 바꾼 것

| 틀 | 전 | 뒤 |
|---|---|---|
| `(.+) 기보가 적용된다` | Uses the knight study | Knight Tome applies |
| `(\d+) › (\d+)단계` | Level 0 › 1 | Lv 0 › 1 |
| `(폰…킹) 모습` | Bishop form | Bishop Form(카드 이름) |
| `(.+)에 (.+) 각인` | Bronze engraving on Knight | Bronze on Knight |
| `상금 \+(\d+)` | Purse +2 | +$2 |
| `도감 (\d+)칸을 새로 채웠다` | 3 new Almanac entries | 단수 · 복수 가림(1 new Almanac entry) |
| `(\d+)판` | 1 runs | 1 run · 3 runs |
| `(기초\|대국\|판) n/m` | Battle 2/4 · Runs 1/2 | Match 2/4 · Run 1/2 |
| `버리기 (\d+)` | Discard 2 | Discards 2 |
| `(.+) 모습으로 먹을 때마다 값 +n` | Each take as a archbishop | 관사를 소리로 고른다(an amazon) |
| `오프닝 「(.+)」이 열렸다` | Opening "London" unlocked | 곧은따옴표 → “London” |
| `금이 갔다 · 깨어나면: …` | Cracked · when awakened: … | Cracked · awakened: … |

## 전과 후 — en.js 값

| 한국어 열쇠 | 전 | 뒤 |
|---|---|---|
| 사슬이 끝날 때 점수가 목표에 닿으면 이긴다. 넘치면 ×2 · ×5 · ×10 눈금까지 늘어난다 | Win when a chain ends at or past the goal. Past it, the bar stretches to ×2, ×5, ×10 | Reach the Target when a chain ends to win. Go past it and the bar stretches to ×2, ×5, ×10 |
| 전술은 떨구기 전에 눌러 이번 대국에 한 번 쓴다 | Tap a tactic before a drop to use it once this match | Tap a tactic before you drop to use it once this match |
| 창이 작아 글이 작다. 설정에서 큰 글자를 켤 수 있다 | The window is small, so text is small. Turn on Large Text in Settings | Small window, small text. Turn on Large Text in Settings |
| 가운데 네 칸에서 먹을 때마다 배수 ×1.5 | Center take: ×1.5 Mult | Each center take: ×1.5 Mult |
| 대각선 앞 한 칸의 적을 먹는다 | Takes one square diagonally ahead | Takes one square diagonally forward |
| 기보 셋 중 하나 | One of three charts | One of three tomes |
| 기물이 자란다 | Grow one | Evolve one |
| 자란다 | Grow | Evolve |
| 이 기물은 자랄 곳이 없다 | This piece has nothing to grow into | This piece cannot evolve |
| 주머니에서 새길 기물을 고른다 | Choose a piece in your bag to engrave | Choose a piece to engrave |
| 주머니에서 깃들 기물을 고른다 | Choose a piece in your bag for the soul | Choose a piece for the soul |
| 주머니에서 자랄 기물을 고른다 | Choose a piece in your bag to grow | Choose a piece to evolve |
| 체스 기물이 특수 기물로 자란다 | A chess piece grows into a special piece | A chess piece evolves into a special piece |
| 나는 킹이다. 첫 대국은 내가 이끈다. 알고 있다면 넘어가자 | I am the King. I'll lead your first battle. Skip it if you know the way | I am the King. I lead your first match. Know the way? Skip ahead |
| 빛나는 칸에 떨구어라. 거기서 룩에 닿는다 | Drop it on the glowing square. From there it reaches the rook | Drop it on the glowing square. From there, it reaches the rook |
| 룩을 먹어라. 잡으면 그것이 된다 | Take the rook. What you capture, you become | Take the rook. You are what you take |
| 먹은 값 × 배수가 점수다. 막대가 목표에 닿으면 이긴다 | Value × Mult is your score. Fill the bar to the Target to win | Value × Mult is your score. Fill the bar to the Target and you win |
| 저 룩은 비숍이 지킨다. 룩부터 먹어 보자 | That rook is guarded by the bishop. Let's try the rook first | The bishop guards that rook. Try the rook first |
| 그 칸은 비숍이 지킨다. 룩 모습으로는 비숍을 못 먹어 끊겼다 | The bishop guards that square. A rook can't take the bishop, so the chain breaks | The bishop guards that square. A rook cannot take it, so the chain broke |
| 지키던 비숍이 없으니 이어진다 | With the bishop gone, the chain goes on | The guard is gone. The chain holds |
| ▼ 그림자는 증원이다. 이 수가 끝나면 그 칸에 적이 들어온다 | ▼ A shadow is a reinforcement. When this move ends, an enemy lands there | ▼ A shadow marks a recruit. When this move ends, an enemy arrives there |
| 떨구어라. 곧게 가면 나이트다 | Drop it. Straight ahead is the knight | Drop it. The knight lies straight ahead |
| 폰은 떨굴 곳이 없다. 폰을 들어라 | Pawns have nowhere to drop. Pick up a pawn | A pawn has nowhere to drop. Pick up a pawn |
| 버리면 새로 뽑는다 | Discard it to draw a new one | Discard it and draw anew |
| 들어온 퀸이 노린다. 먼저 먹어라 | The queen that landed threatens you. Take her first | The new queen has her eye on you. Take her first |
| 기본 기물 | Basic pieces | Chess pieces |
| 킹과 다시 두기 | Replay with King | Replay with the King |
| 대국 | Battle | Matches |
| 누르면 내 차례 | Tap to play it yourself | Tap to try it yourself |
| 목표와 수 | Goal and Moves | Target and Moves |
| 먹을 때마다 흰 칸의 값이 더해지고, 금빛 칸의 배수가 1씩 는다 | Each take adds to the value in the white box and raises the mult in the gold box by 1 | Each take adds to the Value in the white box and +1 to the Mult in the gold box |
| 점수 = 값 × 배수. 길게 이을수록 커진다 | Score = value × mult. The longer the chain, the bigger | Score = Value × Mult. The longer the chain, the bigger |
| 룩을 먼저 먹으면 비숍이 그 칸을 지킨다. 룩 모습으로는 비숍을 못 먹어 끊긴다 | Take the rook first and the bishop guards that square. As a rook you cannot take it, so the chain breaks | Take the rook first and the bishop guards that square. A rook cannot take it, so the chain breaks |
| 지키던 비숍이 없으니 룩을 먹어도 끊기지 않는다 | With the bishop gone, taking the rook no longer breaks the chain | With the bishop gone, taking the rook keeps the chain going |
| 판 위 막대가 목표. 닿으면 이긴다. 왼쪽 금빛 구슬이 남은 수다 | The bar above the board is the goal. Reach it to win. The gold beads on the left are your moves | The bar above the board is the Target. Reach it to win. The gold beads on the left are your moves |
| 폰을 먹으면 첫 수가 끝나고 수 구슬 하나가 꺼진다 | Take the pawn: the first move ends and one bead goes out | Take the pawn: your first move ends and one bead goes dark |
| 남은 수로 목표를 채운다: 비숍을 든다 | Fill the goal with the move left: pick up the bishop | Use your last move to reach the Target: pick up the bishop |
| 룩을 먹으면 목표에 닿는다 | Take the rook to reach the goal | Take the rook to reach the Target |
| 폰은 떨굴 곳이 없다. 버릴 폰을 누른다 | Pawns have nowhere to drop. Tap a pawn to throw away | A pawn has nowhere to drop. Tap a pawn to discard |
| ▼ 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다 | A ▼ shadow is a reinforcement. An enemy lands there when this move ends | ▼ A shadow marks a recruit. An enemy arrives there when this move ends |
| 폰을 먹는다. 수가 끝나면 증원이 떨어진다 | Take the pawn. When the move ends the reinforcement lands | Take the pawn. When the move ends, the recruit arrives |
| 들어온 룩을 먹으러 간다 | Go take the rook that landed | Go take the rook that arrived |
| 지키는 적이 없는 킹을 먹으면 체크메이트. 점수와 상관없이 이긴다 | Take an unguarded king for a mate. You win whatever the score | Take an unguarded king for checkmate. You win, whatever the score |
| 산 격언은 오른쪽 칸에 들어간다. 효과는 카드에 적혀 있다 | Maxims you buy sit in the right column. The card says what it does | Maxims you buy go in the right column. The card says what it does |
| 기물 꾸러미를 연다. 셋 중 하나를 고른다 | Open the piece bundle. Pick one of three | Open the piece bundle. Keep one of three |
| 낙타를 고른다. 나이트처럼 뛰는 특수 기물이다 | Take the camel. It is a special piece that jumps like a knight | Take the camel. A special piece that leaps like a knight |
| 셋 중 하나를 고른다. 넘겨도 된다 | Pick one of three. Skipping is fine too | Keep one of three, or skip |
| 금빛 적을 먹고 이기면 금빛 꾸러미를 받는다 | Take a golden enemy and win for a golden bundle | Take a golden enemy and win to earn a golden bundle |
| 특수 기물은 체스에 없는 행마를 쓴다. 누르면 먹을 칸이 보인다 | Special pieces move in ways chess does not. Tap one to see where it can take | Special pieces move in ways chess does not. Tap one to see what it can take |
| 점선 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다 | Dotted shadows show where reinforcements land when this move ends | A dotted shadow marks a recruit. An enemy arrives there when this move ends |
| 격언을 누르면 팔 수 있고, 끌면 순서가 바뀐다 | Tap a maxim to sell it, drag to reorder | Tap a maxim to sell it. Drag to reorder |
| 같은 종류를 잇달아 먹으면 배수 ×2 | Same kind in a row: ×2 Mult | Same kind twice in a row: ×2 Mult |
| 초월 | Transcend | Ascent |
| 잠행 | Stealth | Shade |
| 대국 중 떨구기 전에 쓴다 | Use during a match, before a drop | Use in a match, before you drop |
| 수 +1 | Moves +1 | +1 Move |
| 폭약 | Powder | Bomb |
| 수상한 물약 | Dubious Potion | Shady Potion |
| 흡수 | Absorb | Mimic |
| 잡으면 그것이 된다 | Take it, be it | You Are What You Take |
| 화면 흔들림 | Shake | Screen Shake |
| 건너뛰면 | If skipped | Skip |
| 진열 | Display | For Sale |
| 다음 대국 | Next match | Next Match |
| 새길 기물 | Pick a piece to engrave | Choose a piece to engrave |
| 격언 칸이 찼다 | Maxim slots are full | Maxim slots full |
| 셋 중 하나를 고른다 | Pick one of three | Keep one of three |
| 상점 진열 | Shop display | Shop shelf |
| 기보 꾸러미 | Study Bundle | Tome Bundle |
| 기물 | Pieces | Piece |
| 기보 | Study | Tome |
| 더하는 규칙 없음 | No added rules | No extra rules |
| 마스터 | Masters | Master |
| 명경기 | Classics | Classic |
| 판본 | Editions | Edition |
| 5관에 닿는다 | Reach hall 5 | Reach Hall 5 |
| 체크메이트로 다섯 번 이긴다 | Win by mate five times | Win by checkmate five times |
| 불멸의 기보 하나를 완성한다 | Complete one immortal game | Complete one Immortal Game |
| 대주교 | Archbishop | Cardinal |
| 메뚜기 | Grasshopper | Hopper |
| 대주교! | Archbishop! | Cardinal! |
| 메뚜기! | Grasshopper! | Hopper! |
| 도약 | Spring | Pounce |
| 먹기 | Capture | Take |
| 증원 | Reinforcement | Recruit |
| 대관식 | Coronation | Crowning |
| 퀸 모습이 될 때마다 값 +50 | Become a queen: +50 Value | Each time you become a queen: +50 Value |
| 중앙 장악 | Center Grip | Center Control |
| 왕의 목 | King's Neck | Regicide |
| 대국의 기억 | Memory of Matches | Trophy Case |
| 증원 환영 | Welcome | Welcome Party |
| 기보 수집가 | Study Collector | Tome Collector |
| 퀸을 먹을 때마다 값 +60 | Queen taken: +60 Value | Each queen taken: +60 Value |
| 되돌이 | Homecoming | Way Home |
| 모습 모으기 | Form Collector | Wardrobe |
| 프로모션할 때마다 값 +80 | Promotion: +80 Value | Each promotion: +80 Value |
| 증원 사냥 | Reinforcement Hunt | Recruit Hunt |
| 뛰어 먹은 다음 먹기: 배수 +3 | Take right after a leap: +3 Mult | Take right after a jump: +3 Mult |
| 포위 | Encircle | Pincer |
| 손에서 값이 가장 낮은 기물로 시작: 배수 +4 | Start with your cheapest: +4 Mult | Start with your cheapest piece: +4 Mult |
| 손에서 값이 가장 높은 기물로 시작: 값 +50 | Start with your priciest: +50 Value | Start with your priciest piece: +50 Value |
| 마지막 수에 목표의 절반 밑이면: 배수 ×3 | Last move under half the goal: ×3 Mult | Last move, under half the Target: ×3 Mult |
| 같은 모습으로 잇달아 먹을 때마다 배수 +2 | Take in the same form again: +2 Mult | Each take in the same form again: +2 Mult |
| 체스판 | Checkerboard | Light and Dark |
| 마지막에 먹은 적의 값을 한 번 더 받는다 | The last enemy taken pays its Value again | The last enemy taken scores its Value twice |
| 대장장이 | Blacksmith | Smith |
| 각인 기물로 시작: 배수 ×1.5 | Start engraved: ×1.5 Mult | Start with an engraved piece: ×1.5 Mult |
| 기보 레벨이 가장 높은 모습으로 먹을 때마다 값 +25 | Take in your top Study form: +25 Value | Each take in your top tome form: +25 Value |
| 대국을 이기면 남은 버리기마다 상금 +1 | Win a match: +1 Purse per discard left | Win a match: +$1 per discard left |
| 금욕 | Asceticism | Austerity |
| 격언 칸이 하나라도 비었으면: 배수 ×2 | Any maxim slot empty: ×2 Mult | Any empty maxim slot: ×2 Mult |
| 먹을 때마다 여섯에 하나: 상금 +1 | Each take: 1 in 6 for +1 Purse | Each take: 1 in 6 for +$1 |
| 역전 | Reversal | Comeback |
| 판의 네 구역을 모두 밟은 사슬: 배수 ×4 | Chain touching all four quarters: ×4 Mult | Chain through all four quarters: ×4 Mult |
| 판을 가로 · 세로 반으로 나눈 네 구역 | The board split in half both ways | The board cut in half both ways |
| 증원 자리에 떨구면 값 +40 | Drop on a reinforcement square: +40 Value | Drop on a recruit square: +40 Value |
| 반격의 서 | Book of Counters | Crossfire |
| 지키는 적을 두 번 먹은 사슬: 배수 ×2 | Take 2 guards in a chain: ×2 Mult | Chain that takes 2 guards: ×2 Mult |
| 폰 둘이 메뚜기가 된다 | Two pawns become grasshoppers | Two pawns become hoppers |
| 가운데 두 줄을 건너 먹을 때마다 배수 +1 | Each take across the middle two ranks: +1 Mult | Each take across the river: +1 Mult |
| 대국마다 값이 가장 큰 적 둘은 아무것도 지키지 못한다 | Each match the two highest-value enemies guard nothing | Each match, the two highest-value enemies guard nothing |
| 대국마다 빈칸 둘이 함정 · 증원이 들면 먹은 것으로 친다 | Two empty squares are traps each match · reinforcements landing there count as taken | Two traps each match · a recruit landing there counts as taken |
| 붙잡은 증원의 값이 곧바로 점수가 된다 | A trapped reinforcement scores its Value at once | A trapped recruit scores its Value at once |
| 수 +1 · 손 −1 | Moves +1 · Hand −1 | +1 Move · −1 Hand |
| 수 −1 · 손 +2 · 버리기 +1 | Moves −1 · Hand +2 · Discards +1 | −1 Move · +2 Hand · +1 Discard |
| 대국 시작에 값이 가장 큰 적 하나가 판에서 빠진다 | At the start of a match the highest-value enemy leaves the board | Each match starts with the highest-value enemy removed |
| 대국 첫 사슬이 마지막에 먹은 적이 주머니에 들어온다 | The last enemy taken by the first chain of a match joins your bag | The last enemy your match's first chain takes joins your bag |
| 주머니 열넷까지 | Up to 14 pieces in the bag | Up to 14 pieces in your bag |
| 계승 | Inherit | Heir |
| 사슬이 끝나면 이 기물이 마지막 모습이 된다 | Chain ends: it becomes its last form | Chain ends: this piece becomes its last form |
| 주머니의 기물이 바뀐다 · 킹 모습은 빼고 | The piece in your bag changes · not into a king | The piece in your bag changes · never into a king |
| 더 먹을 적이 없으면 손의 다음 기물이 그 칸에서 이어 먹는다 | Stuck: the next hand piece takes over there | When stuck: your next hand piece takes over |
| 역행 | Retrograde | Backstep |
| 폰 모습이면 아래 대각으로도 먹는다 | Pawn form: also takes backward | As a pawn: also takes diagonally backward |
| 같은 종류를 두 번 못 먹는다 · 배수 ×2 | Cannot take the same kind twice · ×2 Mult | No taking the same kind twice · ×2 Mult |
| 킹을 지키는 적을 먹을 때마다 배수 +3 | Each king guard taken: +3 Mult | Each king's guard taken: +3 Mult |
| 주머니에서 깨울 기물을 고른다 | Choose a cracked piece in your bag | Choose a cracked piece |
| 혼에 금이 갔다. 금빛 적 · 마스터의 상자 · 깨우기로 깨어난다 | A soul cracked. A golden enemy, a Master's Chest or Awaken wakes it | A soul cracked. A golden enemy, a Master's Chest or Awaken will wake it |
| 앞서 먹은 종류를 또 먹으면: 배수 ×2 | Take a kind taken before: ×2 Mult | Take a kind you took before: ×2 Mult |
| 끊길 때 한 번: 둘레를 먹고 이어 간다 | Once on a cut: clear around and keep going | Once on a break: clear around it and go on |
| 폰 모습이면: 다섯째 줄에서 아마존으로 | As a pawn: amazon on the fifth rank | As a pawn: amazon on the 5th rank |
| 노림을 넘길 때마다: 배수 +1 · 배수 −1 없음 | Each guard slipped: +1 Mult · no −1 | Each guard slipped: +1 Mult · no −1 Mult |
| 대국마다 한 번: 마지막 모습의 기보 +1 | Once per match: +1 Study for the last form | Once per match: +1 tome level for the last form |
| 체크메이트한 사슬: 배수 ×3 | Checkmating chain: ×3 Mult | Chain that mates: ×3 Mult |
| 사슬이 끝나면 손으로 돌아온다 | Returns to your hand when the chain ends | Chain ends: returns to your hand |
| 먹을 때마다 둘레 적 하나가 이번 수 동안 못 지킨다 | Each take: a nearby enemy stops guarding | Each take: one nearby enemy stops guarding |
| 값이 가장 큰 적부터 | Highest value first | Highest Value first |
| 먹을 때마다 값 +5 | Each take: +5 Value | +5 Value per take |
| 첫 먹기의 값 ×2 | First take: ×2 Value | ×2 Value on the first take |
| 증원을 먹으면 상금 +1 | Take a reinforcement: +1 Purse | +$1 per recruit taken |
| 모습이 안 바뀐 먹기마다 배수 +2 | Each take that keeps your form: +2 Mult | +2 Mult per take that keeps your form |
| 지키는 적을 먹을 때마다 배수 +2 | Each guard you take: +2 Mult | Each guard taken: +2 Mult |
| 증원을 먹으면 값 +30 | Take a reinforcement: +30 Value | Take a recruit: +30 Value |
| 증원 자리에 떨구면 배수 +3 | Drop on a reinforcement square: +3 Mult | Drop on a recruit square: +3 Mult |
| 증원을 먹을 때마다 배수 ×1.5 | Each reinforcement taken: ×1.5 Mult | Each recruit taken: ×1.5 Mult |
| 증원이 모두 나이트 무리로 온다 | Reinforcements are all knight-kind | Recruits are all knight-kind |
| 위 두 줄은 숲이다 · 닿으면 걷힌다 | Top two rows are forest · your reach clears it | Top two ranks are forest · your reach clears it |
| 증원 +1 · 두 수 앞까지 보인다 | Reinforcements +1 · seen two moves ahead | +1 recruit · seen two moves ahead |
| 적 특성이 두 배로 붙는다 | Enemy traits come twice as often | Enemy traits twice as often |
| 킹을 지키는 적 +1 | Each king gets one more guard | Kings get one more guard |
| 기병대 땅이다. 증원이 나이트 무리로 온다 | Cavalry land. Reinforcements come as knight-kind | Cavalry land. Recruits come knight-kind |
| 수도원 땅이다. 돌기둥이 길을 막는다 | Abbey land. Stone pillars block the lines | Abbey land. Stone pillars block the way |
| 성채 땅이다. 성벽을 넘는 길은 문 하나다 | Fortress land. The wall has one gate | Fortress land. One gate through the wall |
| 숲 사냥꾼 땅이다. 위 두 줄은 숲이라 떨굴 수 없다 | Huntsmen land. No drops in the forest on the top two rows | Huntsmen land. No drops in the forest on the top two ranks |
| 전령단 땅이다. 증원이 하나 더 온다 | Herald land. One more reinforcement each move | Herald land. One more recruit each move |
| 용병단 땅이다. 적 특성이 두 배로 붙는다 | Mercenary land. Enemy traits come twice as often | Mercenary land. Enemy traits twice as often |
| 왕궁 근위 땅이다. 킹을 지키는 적이 하나 더 있다 | Royal land. Each king has one more guard | Royal land. Every king has one more guard |
| 마스터 대가를 꺾으면 판을 이긴다 | Beat Master Grandmaster to win the run | Beat the Grandmaster to win the run |
| 킹이 둘 · 둘 다 먹어야 체크메이트 | Two kings · a mate takes both | Two kings · mate means taking both |
| 끊겨도 사슬이 이어진다 | Breaks do not end the chain | Breaks never end the chain |
| 한 사슬에서 끊기지 않고 룩 둘을 먹는다 | Take two rooks in one chain without a break | Take two rooks in one unbroken chain |
| 모피가 오페라 관람석에서 17수 만에 이겼다 | Morphy won in 17 moves from an opera box | Morphy won in 17 moves from a box at the opera |
| 대국 첫 수에 체크메이트 | Mate on the first move of a match | Checkmate on the first move of a match |
| 폰 여덟의 행진 | March of Eight Pawns | March of the Eight |
| 격언 칸 +1 | Maxim slot +1 | +1 maxim slot |
| 폰의 기보 | Pawn Study | Pawn Tome |
| 나이트의 기보 | Knight Study | Knight Tome |
| 비숍의 기보 | Bishop Study | Bishop Tome |
| 룩의 기보 | Rook Study | Rook Tome |
| 퀸의 기보 | Queen Study | Queen Tome |
| 증원 +1 | Reinforce +1 | +1 recruit |
| 상점 값 +1 | Prices +1 | Prices +$1 |
| 수 −1 | Moves −1 | −1 Move |
| 상자 다섯 칸 | Chest five halved | Fewer big chests |
| 첫 조각이 반 | Fragments halved | Fewer fragments |
| 되받아치기 | Counterstrike | Riposte |
| 오뚝이 | Second Wind | Unbowed |
| 손과 버리기 | Hand and Discard | Hand and Discards |
| 레퍼토리는 판 끝까지 간다. 레퍼토리마다 시너지가 다르다 | A repertoire lasts the whole run. Each brings its own synergy | A repertoire lasts the whole run. Each one brings its own synergy |
| 버리기: 든 기물 하나를 버리고 새로 뽑는다. 붉은 구슬만큼 쓸 수 있다 | Discard: throw the picked piece away and draw a new one. Once per red bead | Discard: throw away the piece you hold and draw a new one. One per red bead |
| 기사도와 낙타로 기사 시너지가 2개. 첫 효과가 켜졌고, 4개 · 6개면 더 켜진다 | Chivalry and the camel make Rider synergy 2. Its first effect is on, more at 4 and 6 | Chivalry and the camel make Rider synergy 2. Its first effect is on. More at 4 and 6 |
| 이번 대국에 떨굴 수 있는 횟수. 다 쓰면 대국이 끝난다 | Drops left this match. The match ends when they run out | Drops left this match. When they run out, the match ends |
| 손에서 하나를 버리고 새로 뽑을 수 있는 횟수 | Times you can throw away one piece and draw again | How many times you can throw a piece away and draw again |
| 기물 하나에 새긴다 | Engrave one piece | Engraves one piece |
| 체스 기물 하나가 특수 기물로 자란다 | A chess piece grows into a special piece | One chess piece evolves into a special piece |
| 폰 › 궁수 · 나이트 › 야간기사 · 낙타 · 비숍 › 대주교 · 룩 › 재상 · 포 · 유령 · 퀸 › 아마존 | Pawn › archer · knight › nightrider, camel · bishop › archbishop · rook › chancellor, cannon, ghost · queen › amazon | Pawn › archer · knight › nightrider, camel · bishop › cardinal · rook › chancellor, cannon, ghost · queen › amazon |
| 버리기 −1 | Discards −1 | −1 Discard |
| 수 2 · 버리기 1뿐 | 2 moves · 1 discard only | Only 2 moves · 1 discard |
| 마지막에 얻은 행마는 사슬 끝까지 남는다 | The last gained move stays for the whole chain | The last move gained lasts to the end of the chain |
| 모습을 넷 이상 거친 사슬: 배수 ×2 | Chain with 4+ forms: ×2 Mult | Chain through 4+ forms: ×2 Mult |
| 모습이 안 바뀐 사슬: 배수 ×3 | Chain that never changed form: ×3 Mult | Chain that never changes form: ×3 Mult |
| 다섯째부터 먹을 때마다 배수 ×1.2 | Each take from the fifth on: ×1.2 Mult | Each take from the 5th on: ×1.2 Mult |
| 먹은 적 하나에 상금 +1 · 대국마다 5까지 | +1 Purse per take · up to 5 per match | +$1 per take · up to $5 a match |
| 프로모션한 사슬은 한 번 끊겨도 이어진다 | Promoted: one free break | Promoted chain: one free break |
| 대국마다 한 번, 끊겨도 사슬이 이어진다 | One free break per match | Once per match: a break does not end the chain |
| 킹을 지키는 적이 하나 적다 · 메이트: 상금 +6 | King guard −1 · Mate: +$6 | Kings: one fewer guard · Mate: +$6 |
| 킹을 지키는 적을 먹으면 배수 +2 · 체크메이트: 배수 ×3 | King's guard: +2 Mult · Mate: ×3 Mult | King's guard taken: +2 Mult · Mate: ×3 Mult |
| 체크메이트 승리마다 커진다: 배수 ×1.5 · ×2 · ×2.5 … | Mult ×1.5 · ×2 … by mates | Per mate win: ×1.5 · ×2 … Mult |
| 대국 첫 수: 배수 ×2 | Match's first move: ×2 Mult | First move of a match: ×2 Mult |
| 대국 마지막 수: 배수 ×3 | Match's last move: ×3 Mult | Last move of a match: ×3 Mult |
| 버리기를 안 쓴 대국: 배수 +4 | No discards yet this match: +4 Mult | No discards used this match: +4 Mult |
| 버리기 +1 · 버린 기물마다 배수 +2 | Discards +1 · +2 Mult per discard | +1 Discard · +2 Mult per discard |
| 주머니에 남은 기물마다 배수 +1 | +1 Mult per piece left in the bag | +1 Mult per piece left in your bag |
| 막 들어온 증원을 먹으면 값 +40 | Fresh reinforcement: +40 Value | Take a fresh recruit: +40 Value |
| 이번 판에 쓴 기보마다 배수 +1 | +1 Mult per study used this run | +1 Mult per tome used this run |
| 폰이나 나이트로 시작: 배수 +3 | Pawn/knight start: +3 Mult | Start with a pawn or knight: +3 Mult |
| 판에 적이 여덟 이하: 배수 ×1.5 | ≤ 8 enemies: ×1.5 Mult | 8 or fewer enemies: ×1.5 Mult |
| 처음 모습으로 돌아오면 배수 ×2 · 사슬마다 한 번 | Back to start form: ×2 Mult · once a chain | Back to your first form: ×2 Mult · once per chain |
| 증원을 먹을 때마다 배수 +2 | Each reinforcement taken: +2 Mult | Each recruit taken: +2 Mult |
| 폰 모습으로 둘을 먹은 뒤: 어느 줄에서든 프로모션 | 2 pawn takes: any rank | 2 pawn takes: promote on any rank |
| 룩 모습으로 구석에서 먹을 때마다 배수 ×2 | Rook take in a corner: ×2 Mult | Each corner take as a rook: ×2 Mult |
| 비숍 하나가 대주교가 된다 | A bishop becomes an archbishop | A bishop becomes a cardinal |
| b · g 세로줄: 어느 모습이든 세로로 미끄러져 먹는다 | b and g files: any form slides up and down to take | b- and g-files: any form slides along them to take |
| 대국마다 금빛 칸 셋 · 그 위 적을 먹으면 배수 ×2 | Three gold squares per match · take on one: ×2 Mult | Three gold squares each match · take on one: ×2 Mult |
| 대국마다 문 둘 · 문 위 적을 먹으면 다른 문으로 건너가 잇는다 | Two gates per match · take on one to cross to the other | Two gates each match · take on one to cross to the other |
| 끊길 때: 킹을 뺀 둘레의 적을 모두 먹는다 | On a break: take every enemy around it but kings | On a break: clear all around but kings |
| 주머니 기물이 모두 다른 종류: 목표 절반 | Every piece in your bag a different kind: half the target | Every piece in your bag different: half the Target |
| 한 사슬이 한 줄에 다섯 칸을 밟으면 곧바로 이긴다 | A chain that lands on five squares in a line wins at once | A chain that lands on five in a row wins at once |
| 가장 많이 모은 시너지는 1 · 3 · 5개에서 켜진다 | Your biggest synergy turns on at 1, 3 and 5 | Your biggest synergy switches on at 1, 3 and 5 |
| 세 번까지: 모습이 안 바뀐다 · 먹은 적의 행마를 얻는다 | First 3 takes: form holds · gains the taken move | First 3 takes: keep form · gain their moves |
| 더 먹을 적이 없으면 한 번, 처음 모습으로 돌아가 잇는다 | Once, if nothing is left: back to first form | Once, when stuck: back to your first form |
| 먹을 때마다 한 단계 위 기물이 된다 | Each take: the next piece up | Each take: become the next piece up |
| 둘째 먹기 값 +10 · 셋째 +20 · 넷째 +30 … | Second take +10 Value · third +20 · fourth +30 … | 2nd take +10 Value · 3rd +20 · 4th +30 … |
| 폰 모습이면 여섯째 줄에서 아마존으로 프로모션 | As a pawn: amazon on the sixth rank | As a pawn: promote to amazon on the 6th rank |
| 지키는 적을 무시한다 · 배수 −1 | Ignores guards · −1 Mult | Ignore guards · −1 Mult |
| 지켜진 킹은 먹을 수 없다 | A guarded king still can't be taken | A guarded king still cannot be taken |
| 먹어도 모습이 안 바뀐다 | Taking it doesn't change your form | Taking it keeps your form |
| 값이 가장 큰 적 셋: 이번 수엔 못 지킨다 | Top three enemies: no guarding this move | Top three enemies by Value: no guarding this move |
| 이번 대국 수 +1 | Moves +1 this match | +1 Move this match |
| 지켜진 킹도 먹는다 · 체크메이트하면 적이 다시 차고 사슬이 이어진다 | Take even guarded kings · a mate refills the enemies and the chain goes on | Take even guarded kings · a mate refills the board and the chain goes on |
| 사슬이 멈추면 한 번, 그 모습으로 다시 떨궈 잇는다 | Once when the chain stops, drop again in that form and go on | Once, when the chain stops: drop again in that form and go on |
| 폰으로 시작: 여섯째 줄에서 프로모션 · 프로모션마다 배수 ×3 | Start with a pawn: promote on the sixth rank · ×3 Mult per promotion | Start with a pawn: promote on the 6th rank · ×3 Mult per promotion |
| 사슬이 끝나면 상금 +2 | When its chain ends: +2 Purse | +$2 when its chain ends |
| 배수 ×2 · 4번에 1번 깨진다 | ×2 Mult · breaks 1 time in 4 | ×2 Mult · 1 in 4 to shatter |
| 4번에 1번 깨진다 | breaks 1 time in 4 | 1 in 4 to shatter |
| 첫 먹기에선 끊기지 않는다 | Can't break on the first take | First take never breaks |
| 대국마다 한 번, 뛰어 먹으면 지키는 적을 무시한다 | Once per match, a jumping take ignores its guards | Once per match: a jumping take ignores guards |
| 가로 · 세로로 세 칸 이상 가서 먹으면 배수 +2 | Straight take after 3+ squares: +2 Mult | Straight take 3+ squares away: +2 Mult |
| 가로 · 세로로 먹으면 그 너머 적도 먹는다 | Straight takes also take the next enemy beyond | Straight take: also take the enemy beyond |
| 거친 모습 셋이면 배수 ×1.5 · 넷이면 ×2 … | Three forms in a chain: ×1.5 Mult · four: ×2 … | 3 forms in a chain: ×1.5 Mult · 4: ×2 … |
| 더 먹을 적이 없으면 한 번, 거친 모든 모습의 행마로 잇는다 | Once, with nothing left to take: go on with every form it wore | Once, when stuck: go on with every form you wore |
| 일곱째 줄에서 프로모션한다 | Promote on the seventh rank | Promote on the 7th rank |
| 체크메이트하면 적이 다시 차고 사슬이 이어진다 · 대국마다 한 번 | A mate refills the enemies and the chain goes on · once per match | A mate refills the board and the chain goes on · once per match |
| 같은 종류를 잇달아 먹으면 값 +30 | Same kind again: +30 Value | Same kind twice in a row: +30 Value |
| 판에서 값이 가장 큰 적을 먹으면 배수 +4 | Take the most valuable enemy on the board: +4 Mult | Take the highest-value enemy: +4 Mult |
| L자로 뛰어 먹는다. 사이의 기물은 넘는다 | Jumps in an L to take. Hops over anything between | Leaps in an L to take. Jumps anything in between |
| 둘레 여덟 칸을 지킨다. 지키는 적이 없을 때만 먹힌다 | Guards the eight squares around. Can be taken only when unguarded | Guards the eight squares around it. Falls only when unguarded |
| 비숍처럼 미끄러지거나 나이트처럼 뛰어 먹는다 | Takes like a bishop or knight | Slides like a bishop or leaps like a knight to take |
| 룩처럼 미끄러지거나 나이트처럼 뛰어 먹는다 | Slides like a rook or jumps like a knight to take | Slides like a rook or leaps like a knight to take |
| 퀸처럼 미끄러지거나 나이트처럼 뛰어 먹는다 | Slides like a queen or jumps like a knight to take | Slides like a queen or leaps like a knight to take |
| L자를 길게, 세 칸 · 한 칸으로 뛰어 먹는다 | A long L: jumps three and one to take | A long L: leaps three and one to take |
| L자로 뛴다. 같은 방향으로 계속 더 뛸 수 있다 | Jumps in an L. Can keep jumping the same way | Leaps in an L. Can keep leaping the same way |
| 앞의 기물을 넘어, 바로 뒤 칸을 먹는다 | Hops a piece, takes the square behind | Hops over a piece to take the square just behind |
| 기물 하나를 넘어서 먹는다 | Jumps one piece to take | Jumps over one piece to take |
| 룩처럼 가로 · 세로로 가며, 기물을 뚫고 지나간다 | Moves like a rook, through pieces | Moves like a rook, straight through pieces |
| 먹을 수 없는 돌. 포 · 메뚜기는 넘는다 | A stone you can't take. Cannons and grasshoppers hop it | A stone you cannot take. Cannons and hoppers jump it |
| 먹으면 상금 +2. 모습은 안 바뀐다 | Take it for +2 Purse. Your form stays | Take it for +$2. Your form stays |

## 전과 후 — 낱말 풀이(glossary.js 영어 칸)

| id | 낱말 | 영어 낱말 | 전 풀이 | 뒤 풀이 |
|---|---|---|---|---|
| fam_leap | 기사 시너지 | Rider synergy → Rider | Grows as you take by jumping, like a knight | Grows with every take that leaps like a knight |
| fam_line | 성채 시너지 | Castle synergy → Fortress | (그대로) |  |
| fam_diag | 사제 시너지 | Cleric synergy → Cleric | Diagonal takes earn value and mult | Diagonal takes earn Value and Mult |
| fam_change | 변신 시너지 | Shift synergy → Shift | (그대로) |  |
| fam_sacrifice | 희생 시너지 | Sacrifice synergy → Sacrifice | Broken chains score big too | Broken chains still score big |
| fam_crown | 왕관 시너지 | Crown synergy → Crown | Promotion, queens and checkmate score more | Promotions, queens and checkmates score more |
| fam_march | 행진 시너지 | March synergy → March | Chains started by a pawn grow | Chains started by a pawn grow bigger |
| fam_hunt | 사냥 시너지 | Hunt synergy → Hunt | (그대로) |  |
| fam_counter | 역습 시너지 | Counter synergy → Counter | (그대로) |  |
| fam_ambush | 매복 시너지 | Ambush synergy → Ambush | Grows as you take reinforcements and drop where they land | Grows as you take recruits and drop where they arrive |
| drop | 떨구기 | Drop | Put a hand piece on a safe empty square with prey in reach | Place a piece from your hand on a safe empty square with prey in reach |
| chain | 사슬 | Chain | The run of takes one dropped piece makes in a move | Every take one dropped piece makes in a move |
| links | 배수 | Mult | +1 with every take. Score = value × mult | +1 with every take. Score = Value × Mult |
| form | 모습 | Form | Which piece yours is right now. It takes with that move | What your piece is now. It takes with that move |
| threat | 지키는 적 | Guard | An enemy guarding the square you just took. Take it next to go on | An enemy guarding the square you just took. Take it next to keep going |
| cut | 끊김 | Break | Miss the guard and the chain ends. You keep the score so far | Miss a guard and the chain ends. You keep the score so far |
| promote | 프로모션 | Promotion | A pawn form reaching the eighth rank becomes a queen | A pawn that reaches the 8th rank becomes a queen |
| mate | 체크메이트 | Checkmate | Take a king nobody guards and win at once | Take an unguarded king and win at once |
| reinforce | 증원 | Reinforcement → Recruit | New enemies that land on the ▼ shadows when a move ends | A new enemy that arrives on a ▼ shadow when the move ends |
| move | 수 | Move | One drop and its chain. Each match gives a set number | One drop and its chain. Each match gives you a set number |
| swap | 버리기 | Discard | Throw away one picked piece and draw a new one | Throw away the piece you hold and draw a new one |
| run | 판 | Run | One try from Hall 1 to Hall 8. Lose and start over | One attempt from Hall 1 to Hall 8. Lose it and start over |
| hall | 관 | Hall | Practice, rated and master matches. Eight halls | A practice, a rated and a master match. Eight halls in all |
| match | 대국 | Match | One contest you win by reaching the target | One game you win by reaching the Target |
| faction | 세력 | Faction | The foe holding a hall. Each has its own enemies, habit and master | The foe holding a hall. Each brings its own enemies, habit and master |
| habit | 버릇 | Habit | A light rule a faction puts on all three matches of its hall | A light rule a faction sets on all three matches in its hall |
| money | 상금 | Purse | Money for the shop, earned by winning | Money for the shop. Win matches to earn it |
| golden | 금빛 적 | Golden enemy | Its value counts twice. Win for a golden bundle | Its Value counts twice. Win for a golden bundle |
| trait | 특성 | Trait | The small mark at an enemy's feet from Hall 4 | A small mark at an enemy's feet, from Hall 4 on |
| wall | 벽 | Wall | A stone you cannot take. It blocks sliding | A stone you cannot take. It blocks sliding pieces |
| gem | 보석 | Gem | Take it for purse +2. Your form stays | Take it for +$2. Your form stays |
| step | 발판 | Golden step | Gold squares from the Stepping Stones repertoire. Takes there: ×2 Mult | Gold squares from the Stepping Stones repertoire. Take on one: ×2 Mult |
| chart | 기보 | Study → Tome | (그대로) |  |
| soul | 혼 | Soul | A special rule living in one piece | A special rule that lives in one piece |
| joseki | 레퍼토리 | Repertoire | A big pick before Halls 1, 3 and 5. It lasts the whole run | A big pick before Halls 1, 3 and 5. Lasts all run |
| tactic | 전술 | Tactic | Tap it before a drop to use it once | Tap it before you drop to use it once |
| evolve | 진화 | Evolution → Evolve | Grows one chess piece into a special piece | Turns one chess piece into a special piece |
| fragment | 명경기 조각 | Fragment | A piece of a legendary maxim. Three make the legend | Part of a legendary maxim. Three make the legend |
| feat | 재현 | Reenactment | Pull off a classic game's moment. Earns the second fragment | Pull off a moment from a classic game. Earns the second fragment |

## 남긴 것

- 격언 「Empty Bag」(빈 주머니)은 효과가 「주머니에 남은 기물마다 +1 Mult」이라 이름과 효과가 어긋나 보인다. 한국어 이름도 같은 모양이라 영어만 바꾸지 않았다.
- Shadow Reading 효과의 waves는 카드 높이 한도 때문에 남겼다. recruit로 쓰면 판본 카드가 한 줄 넘친다.
- 줄 바꿈은 줄 끝의 「 · 」를 지운다(`text.js` noDot). 그래서 「See 2 waves / Drop on one」처럼 두 줄로 나뉜 효과 사이에 구분 표시가 없다. 글이 아니라 줄 바꿈의 일이라 두었다.
- smoke --lang en의 「당겨 놓음」(설명 상자를 화면 안으로 당긴 횟수)이 81에서 93으로 늘었다. 어김 · 덮음은 0 그대로다. 영어 풀이 글이 조금 길어진 상자들이다.

## 검증

- `npm test`: tests 467 · pass 467 · fail 0
- `npm run smoke`: 글 넘침 0 · SMOKE OK
- `node tools/smoke.mjs --lang en`: 옮기지 못한 글 0 · 글 넘침 0(글이 상자 밖 0 · 테에 붙음 0 · 상자 겹침 0 · 화면 밖 0) · 자리 규칙 어김 0 · SMOKE OK

## 스크린샷 `docs/shots/english/` (1배 · `@3x` 3배)

| 파일 | 화면 |
|---|---|
| shop-1 | 상점: Shadow Reading · 은박 Recruit Hunt, Hunt synergy · Recruit 낱말 상자, 격언 칸 Regicide · Light and Dark |
| shop-2 | 상점: Bishop Tome(Lv 0 › 1) · Amber 각인, 두루마리 Evolve |
| shop-3-soul | 상점: 혼 Martyr · Pounce Soul 깃든 나이트, Sacrifice synergy · Break 상자 |
| repertoire | 레퍼토리 고르기: Archery · Highway · Gates, Fortress synergy 상자 |
| king-01 · 04 · 11 · 15 · 27 | 킹 대본: 첫 인사 · 「You are what you take」 · 다시 두기 · 증원(recruit) · 목표 달성 |
| awaken-1 · 2 | 혼 각성 막간(Martyr Soul · Rook) |
| glossary-1 · 2 · 3 | 낱말 풀이: Matches · Items · Synergy 탭 |
| select-1 · 2 | 관 선택: 세 대국 카드 · 마스터 Village Elder, 세력 말풍선 |
