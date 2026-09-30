# 혼 등급 · 각성 진행 기록

**지금 단계 · 다음 할 일:** 1단계 코드 끝(`cd850cd`), 하네스 뒤(smart 50 · 단 8 50) 도는 중 — 끝나면 값 맞추기 · 「1단계 끝」. 2단계 규칙 · 화면 넣는 중 → 봇 · 하네스 · smoke 걸음.

- 브랜치 `claude/upbeat-einstein-8lor9h`(지시서의 `souls/1` 대신 — 이 세션은 정해진 브랜치에만 올릴 수 있다). 이어 가는 세션은 이 브랜치를 체크아웃한다. main `a779cab`에서. 시작 때 `npm test` 441 통과 · smoke OK(한 수 ×1 최대 3.83s) · smoke en OK(옮기지 못한 글 0).
- 혼 등급 규칙(souls.js `rarity` · `SOUL_RARITY` 흔함 6/$4 · 드묾 3/$6 · 귀함 1/$9, shop.js `rollSoul` — 두루마리 · 혼 깃든 기물 · 수상한 물약이 같이 씀) · 시험 `test/soulgrade.test.js`. 하네스 전(`docs/reports/raw/souls-before-*`)은 뒤에서 도는 중.
- 1단계 화면: 혼 카드 · 혼 깃든 기물 카드 윗변 등급 막대(격언과 같은 RARITY) · 두루마리 칸 왼쪽 막대 · 말풍선 등급 줄 · 도감 「혼」 탭(records.codex.souls) · smoke 도감 탭에 혼. 스크린샷 도구 `tools/shots-souls.mjs`.
- 하네스 전(`a779cab`, 깨끗한 사본에서): smart 50판 42.0% · 단 8 50판 10.0% (`docs/reports/raw/souls-before-*`). 처음 돌린 것은 도는 중에 코드가 바뀌어(일꾼이 판마다 새로 읽는다) 버렸다 — 하네스는 늘 커밋 사본(worktree)에서 돌린다.
- 2단계 규칙: 금(CRACK.links 5, 먹은 사슬마다 한 칸 · battle.js endMove) · 깨우기 셋(금빛 적 + 승리 · 상자 세 칸 이상의 마지막 칸 · 두루마리 「깨우기」 $8 무게 3, 금 간 혼 있을 때만) · 각성 효과 16(souls.js awake · data.awake) · 새 혼이면 금 · 각성 지움 · 시험 26(soulgrade).
- 2단계 화면: 금 · 각성 표(시안 1 금선 · 금테, parts.js soulMark) · 각성 막간 화면(awaken.js, 시안 1 가운데 막간) · 대국의 금 소리 · 글 · 처음 안내 crack(상점, 금 간 기물을 가리킴) · 두루마리 깨우기 카드 · 미리 보기 · 상자 칸 · 영어 · 도감 영어 모은 수 자리. 시안 2 · 3 코드는 다음 커밋에서 뺀다.
- 시안 스크린샷 `docs/shots/souls/draft-{1,2,3}-{4,5}-deck` · `draft-{1,2,3}-{6,7}-awaken`(1배 · 3배). 고른 것: 표 1(금선 · 금테 — 1배에서도 보인다, 2 구석 표는 안 보이고 3 틈 · 도는 점은 흐리다) · 막간 1(어느 기물이 깨어났는지 카드로 보이고 글이 한 상자에 든다, 2 띠는 글이 판 밖 여백에 걸리고 3은 기물이 안 보인다).
