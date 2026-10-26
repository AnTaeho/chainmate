# 넘김 — 2026-10-25 로컬 세션에서 클라우드 세션으로

> 끝남 — 다섯 갈래 모두 main `f2275d0`에 들어가 배포됐다(시너지 수치만 사용자 결정 대기). 다음 일은 `docs/tasks/next.md`.

부르는 법: 「AnTaeho/chainmate 저장소 docs/tasks/handoff.md를 읽고 이어서 진행해」.

## 먼저 읽을 것
- 저장소 `CLAUDE.md`(작업 규칙 · git · 배포 · 화면 글), `docs/DESIGN.md`, `docs/HOOKS.md`.
- 아래 갈래마다 그 브랜치의 `docs/tasks/handoff-<갈래>.md`(그 일꾼이 남긴 수치 · 명령 · 걸리는 곳).

## 지금 상태
- main `e5f8f0d` = 프로덕션(chainmate.papercut.kr). 시험 905 통과, smoke OK, 프로덕션 e2e 셋 OK.
- 마지막으로 들어간 것: 꽉 채움 화면 맞춤 시제품(`?fit=fill`, `src/ui/fit.js` `placeFill`). 기본은 아직 정수 배율(`int`).
- 넘김 브랜치 넷은 모두 main `722b818`에서 갈라졌다. main에 합치기 전에 `e5f8f0d` 위로 다시 얹는다(rebase 또는 merge, 이미 올라간 커밋은 고치지 않는다).

## 할 일(차례대로)

### 1. 터치 — `handoff/touch`
- 사용자가 아이폰 실기기(사파리 가로, `?fit=fill`)에서 「터치가 안 되는 곳이 있다, 전부 확인해」라고 했다. 어느 화면인지는 모른다 — 전부 본다.
- 브랜치에 `tools/touch-audit.mjs`(아직 끝까지 안 돌림)와 의심 목록이 있다. 가장 유력한 것: 뗄 때 손가락이 몇 화소 밀리면 `ui.up`이 누른 구역과 달라 아무 일도 안 한다. 작은 구역(전술 칸 · 도장 · 칩 · 도감 칸)이 `growHit`을 안 쓴다.
- 고치는 방향(내가 정한 것): `src/ui/ui.js` 한 곳에서 손가락일 때만(`this.touch`) 뗄 때 여유 · 가장 가까운 구역 붙이기. 마우스 동작은 그대로.
- 끝나면 도구 표(전 · 후, 네 판 land/port × int/fill)와 창 끝 거리 표를 보고에.

### 2. 꽉 채움을 기본으로
- 1이 끝난 뒤. 남은 위험(`fit` 시제품 보고): `inner()`를 거치지 않는 안쪽 판 `annot.js:58`, `parts.js:549/665/678`, `shop.js:136`은 꽉 채움에서 테가 3/4 화소로 갈릴 수 있다 — 고친다.
- 그다음 `src/main.js` `fitMode` 기본을 `'fill'`로. 설정 토글은 두지 않는다. `docs/design-notes/layout.md` 10절(「버린 안: 비정수 배율」)을 문서 커밋으로 고친다.
- 검증: `node tools/shots-scale.mjs`로 세 창 캡처, `node tools/drawcheck.mjs` · `--scale 1280x720 --fit fill` 어김 0.

### 3. 영어 잘린 글 — `handoff/clip`
- en 24 → 19, ko 2 → 1까지 왔다. 남은 두 갈래는 내가 정했다(사용자는 화면 선택을 묻지 말라고 했다):
  - 도감 명경기 말풍선: `placement.js` `placeNotes` 'below'에서 위 · 아래 어디에도 안 들어갈 때만 가리킨 칸 옆(오른쪽, 안 되면 왼쪽)에 세운다.
  - 대국 이름(「Peasants · Rated」): 굵게 안 들어가면 세력 이름만 굵게 쓴다(대국 종류는 「이기면 $N」 알약이 알린다).
- 보이는 변경이라 시안 2~4장을 찍어 고르고, 고른 이유와 버린 안을 보고에.
- 브랜치 smoke가 부하 속에서 p99로 FAIL이었다 — 조용할 때 다시 돌려 확인.

### 4. 기물 디자인 — `handoff/pieces`
- 사용자: 「기물 디자인이 너무 투박해, 묻지 말고 더 나은 디자인으로 바꿔」.
- 진단 · 새 모양 계획 · 후보 A/B/C · 걸리는 곳(`pieceChips` 경로 문법, 받침 수치 세 곳, `FIT`, `PIECE_TOP`, `pieceGlyph`)이 브랜치 문서에 있다. 비교 도구 `tools/shots-pieces.mjs`.
- 후보를 실제 화면에 찍어 직접 고른다. 기준: 1배 · 붐비는 판에서 종류와 편이 한눈에 → 지금보다 다듬어짐 → art3.md 결 → 한 번 굽기.
- 홈 화면 아이콘(`tools/icons.mjs`)을 새 킹으로 다시 구울지는 고른 뒤 함께 정한다.

### 5. 약한 시너지 — `handoff/synergy` (사용자 결정 대기)
- 규칙은 안 바꿨다. 진단: 행진은 효과가 작고 폰이 주머니에서 사라진다, 왕관 5는 점수에 안 닿는다, 매복은 공급이 없다. 변신 · 불굴은 반대로 +28 · +30%p.
- 수치를 바꾸는 선택(행진 2 · 4, 왕관 4, 변신 · 불굴 약화, 활터의 행진 칩)은 플레이에 닿아 `CLAUDE.md` 규칙대로 사용자에게 선택지와 하네스 원문을 보고하고 기다린다. 하네스로 후보를 재어 표로 준비하는 것까지는 해도 된다.

## 지킬 것(요약)
- main 푸시 = 프로덕션 배포. 푸시 뒤 `node tools/daily-e2e.mjs https://chainmate.papercut.kr` · `link-e2e.mjs` · `account-e2e.mjs`.
- 커밋 메시지 한국어 「무엇을 했다 — 왜」, 갈래별(버그/리팩터링/도구·설정/문서/수치 조정). `Co-Authored-By` 줄 · 세션 링크 금지. 올라간 커밋 amend · force-push 금지.
- 「A가 아니라 B」 꼴을 쓰지 않는다. 사용자 보고는 한국어 해요체, 짧게 한 덩이씩, 걸린 시간은 적지 않는다.
- `desktop/` · 출시(iOS · 맥 서명 · 스팀)는 건드리지 않는다.
- 시험에서 `test/account.test.js:130` · 프레임 p99는 부하에 흔들린다 — 혼자 다시 돌린다. drawcheck는 혼자 돌린다.
- 클라우드에는 아이폰 실기기가 없다. Playwright WebKit(`npx playwright install webkit`)으로 흉내 내고, iOS 몸짓은 창 끝 거리로만 보고한다.
- 하나가 끝날 때마다 검증 → main 푸시 → 프로덕션 e2e까지 하고 다음으로 넘어간다.
