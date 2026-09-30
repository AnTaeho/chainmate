# 혼 등급 · 각성 진행 기록

**지금 단계 · 다음 할 일:** 1단계 — 규칙 · 화면 넣음. 다음: 하네스 뒤(smart 50 · 단 8 50) 재기 → 값 맞추기 → 「1단계 끝」.

- 브랜치 `claude/upbeat-einstein-8lor9h`(지시서의 `souls/1` 대신 — 이 세션은 정해진 브랜치에만 올릴 수 있다). 이어 가는 세션은 이 브랜치를 체크아웃한다. main `a779cab`에서. 시작 때 `npm test` 441 통과 · smoke OK(한 수 ×1 최대 3.83s) · smoke en OK(옮기지 못한 글 0).
- 혼 등급 규칙(souls.js `rarity` · `SOUL_RARITY` 흔함 6/$4 · 드묾 3/$6 · 귀함 1/$9, shop.js `rollSoul` — 두루마리 · 혼 깃든 기물 · 수상한 물약이 같이 씀) · 시험 `test/soulgrade.test.js`. 하네스 전(`docs/reports/raw/souls-before-*`)은 뒤에서 도는 중.
- 1단계 화면: 혼 카드 · 혼 깃든 기물 카드 윗변 등급 막대(격언과 같은 RARITY) · 두루마리 칸 왼쪽 막대 · 말풍선 등급 줄 · 도감 「혼」 탭(records.codex.souls) · smoke 도감 탭에 혼. 스크린샷 도구 `tools/shots-souls.mjs`.
