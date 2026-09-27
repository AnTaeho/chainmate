# 레이아웃 통일 진행 기록

- 브랜치: 환경이 `claude/hopeful-shannon-vw4ze1`만 푸시를 허락해 `layout/1` 대신 이 이름으로(main `b9a122c`에서). 시작 때 `npm test` 269 통과 · smoke OK · 영어 옮기지 못한 글 0.
- 찍는 도구 `tools/shots-layout.mjs` · 고치기 전 `docs/shots/layout/before-*`(한국어 36장면 254장 · 영어 7장면 92장) · (이 커밋) · 다음: 규약 `docs/design-notes/layout.md` · 시안
- 규약 `docs/design-notes/layout.md`(틀 셋 · 토큰 · 글자 단계 · 부품 · 설명 자리 규칙 · 버린 안 · 검사) · 시안 `docs/shots/layout/plan-1~4`(상점 · 정석 · 꾸러미 · 대국 틀) · (이 커밋) · 다음: `frame.js` · `placement.js` 구현, 판 틀 화면 옮기기
- 설명 자리 한 곳(`placement.js`) · 판 틀(`frame.js`, 상점 · 꾸러미 · 정석 · 관 선택이 대국의 틀) · 판 밖 틀(머리줄 · 단추 줄 · 도감 쪽) · `5ffd9b1`
- 연기 시험 자리 규칙 검사 · `7ef833b`
- 좁은 칸 넘침(fitText · 조각은 상금 칸 · 꾸러미 칸 값 · 두루마리 좁은 칸) · 카드 바탕 cardBase · (이 다음 커밋들) · 다음: 모든 화면 after 스크린샷 검수 → 보고서
- 모든 화면 after 스크린샷(`after-*`, 짝 343) · 규약 · CLAUDE.md 한 줄 · 보고서 `docs/reports/layout.md` · 원문 `docs/reports/raw/layout-*` · (이 커밋) · 끝
