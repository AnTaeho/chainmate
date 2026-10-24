# 안 3 — 굵은 벡터 보드게임 그림(CHM-77)

도트 그림을 굵은 벡터 그림으로 바꾼다. 시안은 `p3-battle.png` · `p3-extra.png`(기물 모양 원본 `pieces3.mjs`)이고 이 문서가 그 규칙이다. 480×270 좌표와 뒷면 N배(9절)는 그대로 둔다. 벡터는 논리 좌표로 그려 어느 N에서나 또렷하고, 한 번 구운 그림을 붙여 그리기 비용과 「그릴 때만 그린다」 건너뜀률을 지킨다.

## 1. 기물

- **모양**: 둥근 받침 위에 선 굵은 실루엣 하나. 받침 = 윗면 타원 + 옆면 띠 + 안쪽 고리. 모양 원본은 120×140 상자(받침 가운데 60, 124), 판 위 크기는 폭 22 · 높이 26(원본 × 0.183). 받침 가운데가 칸 가운데에 선다.
  | 기물 | 실루엣 | 알아보는 표 |
  |---|---|---|
  | 폰 | 둥근 머리 + 목 고리 + 퍼지는 몸 | 가장 작고 둥글다 |
  | 나이트 | 말머리 옆모습(오른쪽을 본다) | 눈 하나, 갈기 끝이 뾰족 |
  | 비숍 | 물방울 모자 + 꼭지 구슬 | 사선 홈 하나 |
  | 룩 | 곧은 탑 + 성가퀴 셋 | 몸 가운데 네모 창 |
  | 퀸 | 뾰족 관 다섯 갈래 | 갈래 끝 구슬 넷 |
  | 킹 | 넓은 관 + 금 십자가 | 관 위 십자가는 늘 금빛 |
- **두 톤**: 왼쪽 빛(몸 빛깔) · 오른쪽 그늘(x 62 오른쪽을 그늘 빛깔로 자른다). 왼쪽 가장자리에 흰 빛 한 줄(내 편 0.7 · 적 0.22).
- **선 굵기(논리 px)**: 실루엣 테 1.0(원본 4.5를 그대로 줄이면 0.83이라 N = 1에서 사라진다 — 1 논리 px = N = 1의 1 화소를 바닥으로), 받침 테 0.8, 고리 0.6, 룩 창 · 나이트 눈 · 비숍 홈은 채운 모양(선 아님).
- **굽기**: (모양, 편 · 톤, 고리 빛깔, N)마다 N배 캔버스에 한 번 그려 두고, 판에는 논리 크기로 붙인다. 고리 빛깔이 세력마다 바뀌므로 열쇠에 넣는다. `Path2D`는 쓰지 않는다(연기 시험의 가짜 캔버스에 없다) — 경로는 `moveTo` · `bezierCurveTo` · `ellipse`로.

## 2. 편과 톤

| 톤(`sprites.js`) | 몸 빛 / 그늘 / 테 | 받침 윗면 / 옆면 | 고리 |
|---|---|---|---|
| `w` 내 편 | `#f7eedb` / `#dcc9a2` / `#12153a` | 크림 `#efe6d2` / `#b8a47a` | 금 `#efbd55` |
| `b` 적 | `#343a86` / `#222661` / `#0a0c22` | 남색 `#262c5f` / `#141737` | 세력 빛깔(`PAL.dark` — 그 관 판 어두운 칸) |
| 적 킹 · 퀸 | 몸은 적, 관 · 구슬 · 십자가만 금 `#f6be45` / `#d48b1c` | 적과 같음 | 세력 빛깔 |
| `g` 금빛 적 | 금 `#f6be45` / `#d48b1c` / `#3a1d08` | 남색(적) | 금 |
| `s` 갈아입는 순간 | 은 `#e4eef4` / `#b8c4cc` / `#5d6f78` | 크림 | 금 |
| `q` 승급(금빛 몸) | 금 `#f6be45` / `#d48b1c` / `#6b4410` | 크림 | 금 |
| 각인(`ENG_TONE` 12종) | 그 각인의 몸 `f` / 그늘 `s` / 테 `o`(흑단은 금 테) | 크림 | 금 |
| 기보 단계(`TIER` 1~3) | 몸은 그대로 | 받침 옆면 띠 동 `#b8733a` · 은 `#dfe6ec` · 금 `#efbd55` | 금 |

- 기보 2단계부터 머리 보석(은 · 금), 3단계는 지금처럼 금 기운 점(`tierSparkle`)을 기물 상자에 둔다. 혼 기운(`soulSpark`)도 같은 상자 왼쪽 위.
- 받침 빛깔이 편을 말한다: 크림 받침 = 내 편, 남색 받침 = 적. 금빛 적 · 승급처럼 몸이 금이어도 받침으로 갈린다.
- 특수 기물(`fairy-sprites.js`) · 판 위 사물(벽 · 보석)은 다음 단계까지 도트 그대로, 자리만 투영한 칸 가운데에.

## 3. 투영

- 판은 아이소메트릭 마름모. a1이 왼쪽 꼭짓점, h1이 아래, a8이 위, h8이 오른쪽(시안과 같다). 칸 (f, r) 가운데 = 원점 + (f + ½)·파일 벡터 + (r + ½)·단 벡터.
- 손잡이 하나(`src/render/board3.js` `VIEW.name`, 각 판의 `tilt`): `diamond`(45° 돌리고 세로 0.786 — 칸 28 × 22) · `shallow`(돌리지 않고 세로만 0.75로 눌러 비스듬히 — 칸 28 × 21) · `flat`(정면, 높이에 맞춰 칸 25). 화면은 `project` · `unproject` · 칸 경로 · 뒤에서 앞 차례만 쓰므로 손잡이를 바꿔도 화면 코드는 그대로다.
- 크기: 대국 화면의 지금 판 자리(x 128 ~ 352, y 30 ~ 254) 안에 폭으로 맞춘다. 판 두께 4, 좌표 글자는 판 밖 가장자리(a~h는 왼쪽 아래 변, 1~8은 왼쪽 위 변).
- 누르는 구역은 bbox 네모 + 칸 모양 판정(`hit`)이다. 레이아웃 기록 · 연기 시험은 bbox를 쓰고, 마름모 가운데 = bbox 가운데다.
- 기물은 칸 가운데의 화면 y 차례(같으면 x)로 뒤에서 앞으로 그린다. 칸 위 표시(놓을 칸 · 노림 · 안개 · 길)는 모두 기물보다 먼저 바닥 층에 — 뒤 칸 기물이 앞 칸에 걸치기 때문이다. 움직이는 내 기물은 맨 위.
- **고른 기울기(2026-10-24)**: 시안 그대로(세로 0.64, 칸 28 × 18)는 7관 붐비는 판(킹 둘레 여덟 + 벽)에서 앞 줄 기물이 뒷줄 기물 몸을 반 넘게 가렸다. 판 자리 높이가 남아(판 144 → 176) 세로를 0.786으로 세웠다 — 줄 사이가 18 → 22로 벌어져 뒷줄의 관 · 성가퀴 · 비숍 홈이 1배에서도 보인다. 폭은 그대로라 칸 수 · 기물 크기 · 다른 칸은 안 바뀐다. 마름모가 1 · 2 · 3배 모두 읽혀 `shallow`로 물러서지 않았다(찍은 그림 `node tools/shots-art3.mjs`).

## 4. 글자(2026-10-24)

굵은 글(`bold: true` — 숫자 · 제목 · 단추 · 이름)은 **Black Han Sans**, 보통 글(본문 · 효과 · 말풍선 · 낱말 풀이)은 **IBM Plex Sans KR Medium(500)**. 한 곳 `src/render/type.js`(`FACE` · `fontOf`). 화면 코드는 그대로 `text(…, { bold, scale })`를 부른다.

| 단계 | 글꼴 · 논리 px | 시안(1920 ÷ 4)과의 관계 |
|---|---|---|
| 본문 · 이름표 · 보조 | Plex 500 · 12 | 시안 7~7.5. 480 칸의 줄 14 · 단추 18 · 칩 15~17이 12px 글자 띠(11줄)에 맞춰 있어 줄이지 않았다 — 폰 2배에서 24 화소라 넉넉히 읽힌다 |
| 이름 · 단추 · 수치 | Black Han Sans · 12 | 시안 7.5~12.5. 같은 크기에서 획 무게로 갈린다. 크게 쓸 곳은 `scale` |
| 큰 제목 · 큰 수 | Black Han Sans · 24 · 36(`scale` 2 · 3) | 시안의 값 · 배수 28 · 점수 36 |

- **같은 12px인 이유**: 화면 토큰(줄 · 단추 · 칩 · 안 여백 검사)이 Galmuri 12px의 잉크 11줄로 짜여 있다. Plex 12px의 「가A」 잉크는 10.5줄, Black Han Sans는 9.1줄이라 둘 다 글자 띠 11줄 안에 가운데로 선다 — 높이 토큰은 그대로 두고 글꼴만 바꿨다(넓어진 굵은 영어 때문에 고친 폭은 새기기 단추 62 · 숫자판 칸 50 · 계정 왼쪽 칸 232, 행마 단추 · 탭 줄은 글과 테 사이 4 · 3). 한글은 Galmuri보다 Plex 11% · BHS 15% 좁고, 영어는 Plex 15% 좁고 BHS는 비슷하거나 조금 넓다.
- **그리기**(`src/render/text.js`): 글자 그림을 그리는 곳의 화소 배율 k(화면 N × `scale`, `ctx.getTransform`)로 굽고 알파를 자르지 않는다. 논리 크기 · 폭은 k와 상관없다. 기준선은 `alphabetic`, 굵기마다 한 번 「가A」의 잉크(`measureText` `actualBoundingBox`)를 재어 글자 띠(text()의 y부터 11줄) 가운데에 놓는다 — 못 재는 곳은 `FACE.ink`. 글꼴이 오기 전에는 폭 · 기준선 · 줄 바꿈을 캐시하지 않고 `loadingdone`에 비운다. 글자 그림 캐시는 화소 합 1,200만에서 비운다.
- **Black Han Sans에 없는 기호**(· → … ★ ▼ 「」 등 37자)는 글꼴 줄 `"Black Han Sans", "IBM Plex Sans KR"`이 Plex로 넘긴다. Plex KR에도 없는 ‹ ›는 줄일 때 IBM Plex Sans(500)에서 옮겨 넣었다. 둘 다에 없는 글자(≈ ⊄ 紋章)는 주석에만 있다.
- **낱말 조각 글**(`glossary.js` `richText`): 글꼴 폭이 소수라 조각마다 올림해 더하면 한 줄로 잰 폭보다 넓다 — 조각 자리 · 폭은 앞 글 전체로 잰다.
- 굵게 안 들어갈 때 보통 굵기로 접는 곳이 늘었다(굵은 영어가 넓다): 건너뛰기 패 글(두 줄 넘으면) · 물건 카드 이름(낱말이 안 들어가면). smoke 「줄임」으로 센다(영어 1 → 10, 실패 아님).

**글꼴 파일**(`assets/fonts/`, 배포 · 앱에 든다 — `stamp.mjs STATIC`의 `assets` · `desktop/collect.sh`가 통째로 옮긴다)

| 파일 | 글자 | 크기 |
|---|---|---|
| `BlackHanSans.<해시>.woff2` | 1,037 | 78,264 B(76KB) |
| `PlexSansKR-Medium.<해시>.woff2` | 1,074(‹ › 포함) | 122,216 B(119KB) |
| `OFL-BlackHanSans.txt` · `OFL-IBMPlex.txt` | SIL OFL 1.1 | |

합 200,480 B(196KB) — 옛 Galmuri 둘 87KB의 2.3배. 벡터 한글은 글자마다 윤곽이라 도트보다 무겁다. 글자 고르기별로 재 봤다: KS X 1001 2,350자 + 소스 434KB · 소스 전체 글자(주석 포함, 지금) 199KB · 문자열만(주석 빼기) 158KB. KS X 1001은 화면에 바깥 글이 아이디 · 목록 이름뿐이라 뺐고, 주석 빼기는 41KB를 더 줄이지만 JS 토큰 읽기가 줄이는 도구와 시험 양쪽에 들어가야 해 두지 않았다.

**다시 만들기**
1. 글꼴 줄이기: `uv run --no-project --with fonttools --with brotli python tools/fonts.py` — google/fonts 고정 커밋에서 원본을 `tools/fonts/src/`(git 밖)로 받아 sha256을 맞추고, 쓰는 글자만 남긴 woff2 · `style.css` @font-face · `tools/fonts/glyphs.json`을 쓴다. 같은 입력이면 같은 해시다.
2. 미리 받기 줄: `node tools/preload.mjs`.
3. 연기 시험 폭 표: `node tools/fontwidths.mjs` — 줄인 woff2를 Playwright 크로미움에 싣고 덮은 글자마다 굵게 · 보통 폭(1/1000 em, 올림)을 `tools/fonts/widths.json`에 쓴다(`tools/fakedom.mjs`가 읽는다). 「가A」 잉크가 `type.js FACE.ink`와 다르면 알린다.
화면에 처음 쓰는 글자를 넣으면 `test/fonts.test.js`가 1을 하라고 실패한다. 글꼴 · 굵기 · 크기를 바꾸면 1 ~ 3을 차례로.

## 5. 빛깔 역할

| 역할 | 빛깔 | 쓰는 곳 |
|---|---|---|
| 잉크 남색 | `#262c5f`(상자 면) · `#12153a`(테 · 글 잉크) | 바탕 · 판 받침 · 적 받침 · 모든 테 |
| 크림 | `#efe6d2` | 판 밝은 칸 · 내 받침 · 카드 |
| 금 | `#efbd55` · `#f6be45` | 내 편 고리 · 놓을 칸 · 배수 · 금빛 적 · 적 킹 관 |
| 붉은 | `#df5a45`(`PAL.red`) · 시안 `#ef6a52` | 노림 · 증원 ▼ · 끊김 · 희생 |
| 하늘 | `#6fb3c8` | 시너지 |
| 세력 빛깔 | `PAL.dark` | 판 어두운 칸 · 적 고리 |

금 · 붉은 · 하늘은 규칙 빛깔이라 장식에 쓰지 않는다.

## 6. 바꿀 목록

도트 그림 모듈과 그것을 쓰는 곳. 바꾼 줄은 `[x]`로 지운다.

**모듈**
- [x] `src/render/text.js` — Galmuri 도트 글자(12px · 알파 문턱값) → 벡터 글꼴 둘(4절)
- [ ] `src/render/sprites.js` — 기물 16×22 마스크 · 톤(`TONE` · `ENG_TONE` · `TIER` · `THING_TONE`) · `spriteCanvas` · `outlineCanvas` · `spriteChips` · `tierSparkle` · `soulOrb` · `baked`
- [ ] `src/render/sprites-hi.js` — 기물 32×44 마스크(`tools/sprites-hi.mjs`가 쓴다)
- [ ] `src/render/fairy-sprites.js` — 특수 기물 마스크
- [ ] `src/render/art-hi.js` — 격언 · 문양 · 문장 · 각인 재료 · 전술 · 조각 두 배 마스크(`tools/art-hi.mjs`)
- [ ] `src/render/art16.js` — 물약 · 룰렛 1배 그림
- [ ] `src/render/portraits.js` — 마스터 초상 64×64
- [ ] `src/render/crests.js` — 세력 문장
- [ ] `src/render/icons.js` — 아이콘(`tools/icons.mjs` 홈 화면 아이콘)
- [ ] `src/render/dice.js` — 주사위
- [ ] `src/render/texture.js` — (대국 판은 `board3.js boardImage`로 옮겼다 — 남은 쓰임 없음 확인 뒤 지운다) `boardCanvas` · `boardFrameCanvas` · `feltCanvas` · 3×5 좌표 글자
- [ ] `src/ui/diagram.js` — 행마 그림(4 px 칸)
- [ ] `src/ui/envelope.js` — 꾸러미 봉투
- [ ] `src/ui/art.js` — 물건 그림 칸(`itemArt` · `engravingEmblem` · `soulEmblem` · `awakenArt` · 격언 그림)
- [ ] `src/ui/juice.js` — 동전(`coinCanvas`) · 연기 · 조각 · 색종이
- [ ] `src/ui/stars.js` — 평가 별
- [ ] `src/ui/kinds.js` — 종류 딱지 문양
- [ ] `src/ui/peek.js` — 관 선택 카드의 작은 판
- [ ] `src/render/night.js` — 타이틀 하늘 · 실루엣(`spritePixels`)
- [ ] `src/ui/screens/title.js` — 로고(`bakeLogo`) — 글자는 Black Han Sans를 화면 배율로 굽게 바꿨다(4절). 금빛 3단 띠 · 그림자 모양은 그대로

**쓰는 곳**
- [ ] `src/render/gfx.js` `sprite` · `soulSpark` (기물 그리기 입구)
- [x] `src/ui/screens/battle.js` 판 위 — 판 · 체스 기물 여섯 · 증원 그림자 · 미리 보기 · 부서짐 · 쓰러지는 킹 · 판 위 연출(2단계)
- [ ] `src/ui/screens/battle.js` 판 밖 — 손 카드 · 먹으면 판넬 · 사슬 칸 · 초상 · 문장 · 판 위 특수 기물 · 사물(도트 그대로, 자리만 투영)
- [ ] `src/ui/screens/lesson.js` · `review.js` (대국 화면을 물려받는다)
- [x] `src/ui/ignite.js` — 콤비네이션 길 · 카드 기물
- [x] `src/ui/marks.js` — 판 위 표시 · 화살표
- [x] `src/ui/annot.js` — 판 위 !! · ? 딱지 자리
- [ ] `src/ui/parts.js` — 기물 카드 · 진열 카드 · 격언 칸 · 봉투 · 행마 그림
- [ ] `src/ui/ui.js` — 말풍선 행마 그림
- [ ] `src/ui/coach.js` — 도움말 그림
- [ ] `src/ui/highlight.js` · `screens/highlight.js` — 하이라이트 카드(화면 = 내보내는 그림)
- [ ] `src/ui/unlockview.js` — 해금 칸 그림 · 자물쇠
- [ ] `src/ui/screens/shop.js` · `pack.js` · `chest.js` · `legend.js` · `reward.js` · `result.js` · `records.js` · `setup.js` · `moves.js` · `codex.js` · `select.js` · `settings.js` · `title.js`
- [ ] `src/ui/app.js` · `src/render/backdrop.js` — 바탕(`feltCanvas`)

**시험 · 도구**
- [ ] `test/sprites-hi.test.js` · `test/art-hi.test.js` · `test/annot.test.js` · `test/light.test.js`
- [ ] `tools/sprites-hi.mjs` · `tools/art-hi.mjs` · `tools/icons.mjs` · `tools/shots-dot2x.mjs` · `tools/shots-factions.mjs` · `tools/shots-shop-art.mjs` · `tools/shots.mjs` · `tools/smoke.mjs`(그림 검사)
