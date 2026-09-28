# 체인메이트 작업 규칙

체스 기물 로그라이크 퍼즐. 설계는 `docs/DESIGN.md`(규칙·수치·구조), 도파민 설계는 `docs/HOOKS.md`, 화면 원형은 `docs/mockup.html`. 작업 전에 둘 다 읽는다.

## 뿌리
> **잡으면 그것이 된다.** 떨군 기물이 먹은 적으로 갈아입으며 사슬을 잇는다. 점수 = 값 × 배수(화면 낱말과 글의 목소리는 `docs/design-notes/voice.md`와 `src/ui/glossary.js`의 `TERMS`가 기준 — 효과 글은 「조건: 효과」 한 줄, 시너지 · 특수 기물 · 드문 낱말만 카드 옆 낱말 상자로 풀어 준다. 옛 낱말 표 `terms.md`는 voice.md와 다르면 voice.md를 따른다).

새 장치마다 묻는다: ① 떨구기·먹기·갈아입기·응수/끊김·승급·외통 중 하나를 키우거나 비트는가? ② DESIGN.md 「세계의 말」로 설명되는가? 둘 다 아니면 버리거나 모양을 바꾼다. 여러 게임에서 가져온 장치를 잡탕으로 섞지 않는다.

도파민이 핵심이다. 참고는 개발 규모가 작은 성공작(Balatro, Vampire Survivors, Luck be a Landlord, Peglin, Brotato). 판을 부수는 드문 보상은 한 번에 주지 않고, 중간~낮은 확률의 조각을 이어 모아야 얻게 한다(HOOKS.md 「불멸의 기보」).

## 구조 규칙
- 바닐라 JS ES 모듈, 빌드·npm 의존성 없음. `python3 -m http.server`로 연다.
- `src/sim/`·`src/data/`는 DOM·canvas 접근 금지(Node에서 돈다). 모든 무작위는 시드 rng. 상태는 JSON 왕복 안전.
- 상태 변경은 명령 객체로만(`apply`, `applyRun`). 봇과 화면이 같은 명령을 쓴다.
- 격언·기보·각인·명인은 `scoring.js`의 `defineModifier` 훅으로. 규칙 코드에 id별 분기를 박지 않는다.
- 검증: `npm test`(전부 통과), 대국 하네스 `node tools/sim.mjs --battles 300 --seed 1`, 판 하네스 `node tools/run.mjs --runs 300 --policy smart|random|none --seed 1 --workers 10`(smart 300판 ≈ 10분).

## 화면 글 규칙
- UI 흐름 중간의 설명은 처음 만나는 순간 한 줄 안내(`src/ui/coach.js` `hint`)로만 — 누르면 사라지고 다시 안 뜬다. 그 밖엔 컨트롤이 스스로 설명하게.
- 효과는 카드에 늘 적는다(말풍선은 덧붙임만). 효과 글은 「언제 → 무엇」 한 문장, 막히는 낱말은 `src/ui/glossary.js`.
- 레이아웃 규약은 `docs/design-notes/layout.md`(틀 셋 · 여백 토큰 `src/ui/frame.js` · 설명 자리 `src/ui/placement.js` — 판 안의 화면은 왼쪽 칸, 판 밖은 가리킨 것 바로 아래). smoke 「자리 규칙」이 어긴 곳을 잡는다.
- 설명서 말투, 만든 쪽 용어(엔진, 시뮬, 스폰, 틱, 버프, 트리거, 팩…) 금지. 세계의 말만 쓴다.
- 「A가 아니라 B」 문장 꼴 금지.
- 눈에 보이는 큰 변경은 구현 전에 시안(스크린샷 포함)을 남기고, 정한 안과 버린 대안을 한두 줄 적는다.

## git
- 커밋 메시지는 한국어 「무엇을 했다 — 왜」. **`Co-Authored-By` 줄과 세션 링크를 넣지 않는다**(amend·PR 포함).
- 커밋은 갈래별로 나눈다(버그 / 리팩터링 / 도구·설정 / 문서 / 수치 조정).
- 이미 올라간 커밋은 amend·force-push 하지 않는다.

## 일하는 방식
- 판단(설계·검토)과 손(코드 수정)을 나눈다. 큰 단계는 단계 하나 = 커밋 몇 개 = 세션 하나.
- 명세(DESIGN.md)와 부딪혀 게임 플레이에 영향이 있는 선택을 해야 하면, 우회하지 말고 멈춰서 선택지와 하네스 수치를 보고한다.
- 수치를 바꾸면 하네스 원문 출력으로 근거를 남긴다. 「통과했다」는 원문 출력이 있어야 믿는다.
- 설계가 바뀌면 DESIGN.md/HOOKS.md도 같은 커밋 갈래(문서)로 고친다.

## 진행 상태와 다음 단계

끝난 것: 1 규칙 엔진 · 2a 관·상점·격언·기보·각인·명인·목표 곡선 · 2b 도파민 규칙(보고서 `docs/reports/2b.md`, 화면이 받을 이벤트 목록 포함) · 3 화면 · 4 연출과 소리 · 5 판 밖 · 다듬기(밤샘, `docs/reports/night.md`) · 첫 만남(`docs/reports/onboarding.md`: 먹기 전 미리 보기 · 목표 막대 · 첫 수업 넷 · 타이틀 시연 · 퀸 · 킹 다시 그리기 · 사슬 따라가기 연출 · 겹침 · 소개 영상 `docs/media/`, 테스트 190) · 그래픽 손질(`docs/reports/graphics.md`: 새 킹 · 각인 톤 · 기보 단계 모습 · 달빛 타이틀 · 질감 `src/render/texture.js` · 겹침) · 깊이(`docs/reports/depth.md`: 이형 9 · 가족 8 · 정석 13 · 혼 8 · 진화 · 묘수 · 벽 · 보석 · 적 특성 5 · 격언 43, 테스트 257, smart 100판 18.0%) · 친절 손질(`docs/reports/ux.md`: 첫 실행 곧바로 수업 · 수업 열 · 처음 안내 · 카드에 효과 · 재료 그림 · 새기기 미리 보기 · 글 「언제 → 무엇」 · 낱말 풀이 · 영상 `docs/media/first-play.mp4`, 테스트 267) · 레이아웃 통일(`docs/reports/layout.md`: 설명 자리 한 곳 · 판 틀 · 판 밖 틀 · smoke 자리 규칙 · before/after `docs/shots/layout/`, 테스트 270) · 글 상자 hug(`docs/design-notes/layout.md` 「격자와 여백」: 토큰 8 · 7 · 14 · 18 · 3 · 8, smoke 「글 넘침」, before/after `docs/shots/spacing/`, 테스트 279).

알아 둘 것:
- 판 봇은 돈에 아주 민감하다: 공짜 보상을 얹을 때마다 승률이 크게 뛰었다. 새 보상은 하네스로 재고 넣는다.
- 판 하네스는 판 하나에 2분 상한(`--limit`, 넘으면 「시간 초과」로 따로). 봇의 짜임 재기는 마디 1000 · 판 K 6(깊이 층 뒤 판이 넓어져 상점 한 번이 수십 초가 됐었다). 4코어에서 smart 100판 ≈ 11분.
- 외통이 대국의 11%(후반 21%)로 흔하다 — 이형 사슬이 수비수를 다 치운다. `depth.md` 「아직 재미없는 곳」.
- 화면은 대국 상태를 이벤트 뒤에 다시 읽는다(`redrop` · `refill`). 미리 보기는 `previewCapture` · `previewDrop`(풀이기 복사본)으로만 잰다.
- 대국 화면(`BattleScreen`)은 대국이 어디서 오는지(`source`: 판 · 첫 수업 · 타이틀 시연)만 바꿔 같은 규칙 · 같은 연출로 쓴다. 누를 곳 좁히기는 `filterTargets`.
- 한 수 연출 ×1은 4초 안(smoke가 잰다). 새 연출을 넣으면 smoke 최대가 4초에 가깝다(지금 3.7~3.85초).
- 풀이기 마디 예산 10000. 명인 통과율은 봇 기준이다.
- 수업은 걸음 대본(`lessons.js` steps: pick · drop · cap · discard, 걸음마다 say)으로 돈다. 새 수업은 `test/lessons.test.js`가 실제 규칙으로 이기는지 잰다. 수업 ⑩은 `run.scratch`(저장 · 기록 안 함) 판 위의 따라 하는 길(`coach.js` startGuide).
- 처음 안내는 화면이 그리는 중에 `hint(app, id, 구역 id)`로 부른다(한 번에 하나, 먼저 부른 것). 본 것은 `records.coachSeen`.
- 사람 손으로 해 본 적이 없다. 첫 사람 판에서 볼 것은 `docs/reports/onboarding.md` 「알려진 문제」와 `night.md` 「남은 목록」.

### 다음
1. 사람 판으로 한 번: 처음 켠 10분(수업 열 · 처음 안내 · 카드 글이 읽히나, `docs/reports/ux.md` 「남은 헷갈림」), 미리 보기 · 소리 · 명인 세기, 5관의 정보량.
2. 깊이 조정(`depth.md` 「다음 세션이 할 것」): 외통 줄이기, 가족이 판을 가르게(쫓는 봇 = 무시하는 봇 20%), 묘수 · 도박의 값 재기.
3. 건너뛰기 패 키우기(하네스로 재고), 명인 통과율과 판 승률 맞추기(`night.md` 남은 목록).
4. 영어 글 다듬기, 데스크톱 포장, 깊이 층이 나오는 영상 다시 녹화.
