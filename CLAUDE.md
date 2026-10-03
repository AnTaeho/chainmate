# 체인메이트 작업 규칙

체스 기물 로그라이크 퍼즐. 설계는 `docs/DESIGN.md`(규칙·수치·구조), 도파민 설계는 `docs/HOOKS.md`, 화면 원형은 `docs/mockup.html`. 작업 전에 둘 다 읽는다.

## 뿌리
> **먹으면 그 기물로 바뀌고, 바뀐 기물로 또 먹는다.** 떨군 기물이 먹은 적으로 갈아입으며 사슬을 잇는다. 점수 = 값 × 배수(화면 낱말과 글의 목소리는 `docs/design-notes/voice.md`와 `src/ui/glossary.js`의 `TERMS`가 기준 — 효과 글은 「조건: 효과」 한 줄, 시너지 · 특수 기물 · 드문 낱말만 카드 옆 낱말 상자로 풀어 준다. 옛 낱말 표 `terms.md`는 voice.md와 다르면 voice.md를 따른다).

- 새 장치마다 묻는다: ① 떨구기·먹기·갈아입기·응수/끊김·프로모션·체크메이트 중 하나를 키우거나 비트는가? ② DESIGN.md 「세계의 말」로 설명되는가? 둘 다 아니면 버리거나 모양을 바꾼다.
- 여러 게임에서 가져온 장치를 잡탕으로 섞지 않는다.

- 도파민이 핵심이다. 참고는 개발 규모가 작은 성공작(Balatro, Vampire Survivors, Luck be a Landlord, Peglin, Brotato).
- 판을 부수는 드문 보상은 한 번에 주지 않고, 중간~낮은 확률의 조각을 이어 모아야 얻게 한다(HOOKS.md 「불멸의 기보」).

## 구조 규칙
- 바닐라 JS ES 모듈, 빌드·npm 의존성 없음. `python3 -m http.server`로 연다.
- 데스크톱 포장(Tauri 2)은 `desktop/` 안에만 둔다. 게임 파일은 고치지 않고 `desktop/collect.sh`가 모아 쓴다(`desktop/README.md`).
- `src/sim/`·`src/data/`는 DOM·canvas 접근 금지(Node에서 돈다). 모든 무작위는 시드 rng. 상태는 JSON 왕복 안전.
- 상태 변경은 명령 객체로만(`apply`, `applyRun`). 봇과 화면이 같은 명령을 쓴다.
- 격언·기보·각인·마스터(코드 이름 master)는 `scoring.js`의 `defineModifier` 훅으로. 규칙 코드에 id별 분기를 박지 않는다.
- 검증: `npm test`(전부 통과), 대국 하네스 `node tools/sim.mjs --battles 300 --seed 1`, 판 하네스 `node tools/run.mjs --runs 300 --policy smart|random|none --seed 1 --workers 10`(10코어에서 smart 판당 ≈ 20~26초, 300판 ≈ 10~13분 — `docs/reports/perf.md`). 손질 전후 결과 비교는 `--dump`(둘 다).

## 화면 글 규칙
- UI 흐름 중간의 설명은 처음 만나는 순간 한 줄 안내(`src/ui/coach.js` `hint`)로만 — 누르면 사라지고 다시 안 뜬다. 그 밖엔 컨트롤이 스스로 설명하게.
- 효과는 카드에 늘 적는다(말풍선은 덧붙임만). 효과 글은 「언제 → 무엇」 한 문장, 막히는 낱말은 `src/ui/glossary.js`.
- 레이아웃 규약은 `docs/design-notes/layout.md`(틀 셋 · 여백 토큰 `src/ui/frame.js` · 설명 자리 `src/ui/placement.js` — 판 안의 화면은 왼쪽 칸, 판 밖은 가리킨 것 바로 아래). smoke 「자리 규칙」이 어긴 곳을 잡는다.
- 글을 「…」로 자르거나 낱말 가운데서 끊지 않는다. smoke 「잘린 글」이 잡는다 — 의도한 잘림만 이유와 함께 허용 목록(`tools/smoke.mjs` `CLIP_OK`, layout.md 「잘린 글 검사」)에.
- 설명서 말투, 만든 쪽 용어(엔진, 시뮬, 스폰, 틱, 버프, 트리거, 팩…) 금지. 세계의 말만 쓴다.
- 체스에 있는 개념은 체스 말로: 체크메이트(짧게 메이트) · 마스터 · 마스터전 · 레퍼토리 · 전술 · 명경기 · 프로모션 · 레이팅(800 + 200 × 단). 옛 장기 · 바둑 말(외통 · 명인 · 정석 · 묘수 · 명국 · 승급 · 단)은 코드 id · 하네스 표 · 지난 보고서에만 남는다(`docs/design-notes/chess-terms.md`).
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
- 게임 완성이 먼저다. iOS 앱 · 맥 서명 · 스팀 같은 포장 · 출시 작업은 사람이 다시 말하기 전까지 하지 않는다(일꾼 지시서에도 시뮬레이터 확인 · desktop/ 수정을 넣지 않는다).

## 진행 상태와 다음 단계

끝난 것: 1 규칙 엔진 · 2a 관·상점·격언·기보·각인·명인·목표 곡선 · 2b 도파민 규칙(보고서 `docs/reports/2b.md`, 화면이 받을 이벤트 목록 포함) · 3 화면 · 4 연출과 소리 · 5 판 밖 · 다듬기(밤샘, `docs/reports/night.md`) · 첫 만남(`docs/reports/onboarding.md`: 먹기 전 미리 보기 · 목표 막대 · 첫 수업 넷 · 타이틀 시연 · 퀸 · 킹 다시 그리기 · 사슬 따라가기 연출 · 겹침 · 소개 영상 `docs/media/`, 테스트 190) · 그래픽 손질(`docs/reports/graphics.md`: 새 킹 · 각인 톤 · 기보 단계 모습 · 달빛 타이틀 · 질감 `src/render/texture.js` · 겹침) · 깊이(`docs/reports/depth.md`: 이형 9 · 가족 8 · 정석 13 · 혼 8 · 진화 · 묘수 · 벽 · 보석 · 적 특성 5 · 격언 43, 테스트 257, smart 100판 18.0%) · 친절 손질(`docs/reports/ux.md`: 첫 실행 곧바로 수업 · 수업 열 · 처음 안내 · 카드에 효과 · 재료 그림 · 새기기 미리 보기 · 글 「언제 → 무엇」 · 낱말 풀이 · 영상 `docs/media/first-play.mp4`, 테스트 267) · 레이아웃 통일(`docs/reports/layout.md`: 설명 자리 한 곳 · 판 틀 · 판 밖 틀 · smoke 자리 규칙 · before/after `docs/shots/layout/`, 테스트 270) · 글 상자 hug(`docs/design-notes/layout.md` 「격자와 여백」: 토큰 8 · 7 · 14 · 18 · 3 · 8, smoke 「글 넘침」, before/after `docs/shots/spacing/`, 테스트 279) · 밤샘 2(`docs/reports/night2.md`: 시계 3칸 · 다시 놓기 · 나쁜 판 거르기(후보 넷) · 정석 24 · 격언 70 · 시너지 10 · 혼 16 · 각인 12 · 새 훅 onSetup · onArrive · onBattleEnd · onChainLuck · onBuild · 목표 곡선 · 단 표 다시, smart 100판 38% · 단 8 12% · none 0% · random 2%, 판을 끝낸 죽음의 판 운 몫 96% → 12.5%) · CHM-20 손질(`night2.md` 끝: 진 뒤에도 상점 · 4~8관 목표 인상 절반쯤 · 판 조정 스위치 `src/sim/tuning.js`(`docs/design-notes/board-tuning.md`), smart 50판 50% · 단 8 12→10% · 판 운 몫 40% · 판 조정 끄면 36.7%, 테스트 388) · 세력(`docs/reports/factions.md`: 관마다 세력 여덟 — 주력 적 · 고유 적 · 버릇 · 우두머리(옛 명인 여덟), 1관 농민군 · 8관 왕궁 근위 · 2~7관 판 시드로 섞음 `run.factions`, 문장 12×12 · 관 선택 세력 띠 · 판 틀 테, smart 100판 45% · 단 8 200판 10.5% · 가장 많이 입은 모습이 세력마다 다름, 테스트 402) · 빛과 움직임(CHM-23, `docs/design-notes/layout.md` 「빛과 움직임」: 뒷면 캔버스 정수 N배 · 움직이는 것만 1/N 칸(`fine`) · 카드 들림 `src/ui/sway.js`(CHM-26에서 숨 쉬기 · 기울기를 뺐다) · 그림자 · 빛 번짐 · 흐르는 배경 `src/render/light.js`, 움직임 줄이기면 멈춤, 시안 · 전후 `docs/shots/light-motion/`, 영상 `docs/media/light-motion.mp4`, 테스트 406) · 첫 판 튜토리얼(CHM-22, `docs/design-notes/tutorial.md` 「구현 뒤」: 처음 켜면 타이틀 → 「새 판」이 곧바로 킹과 두는 1관 연습 대본(`src/data/tutorial.js` 판 · `src/ui/tutorial.js` 걸음 · `screens/script.js`, 목표 600, 레퍼토리 고르기는 그 뒤, 건너뛰기 = `unscript`) · 킹 말풍선(처음 안내도) · 대국 「행마」 보기 · 설정 「킹과 다시 두기」 · 「움직임 줄이기」, 스크린샷 `docs/shots/tutorial/`, 영상 `docs/media/tutorial.mp4`, 테스트 415) · 화면 맞춤(CHM-28, `docs/design-notes/layout.md` 「화면 맞춤」: 배율 고르기 `src/ui/fit.js` · 가장자리를 같은 결로 채우는 여백 판 `src/render/backdrop.js` · 폰 세로 안내 · 터치 막기와 한 손가락 끌기 · 홈 화면에 추가(manifest · 아이콘 `tools/icons.mjs`), 전후 `docs/shots/mobile/`(`tools/shots-mobile.mjs`), 테스트 436) · 혼 등급 · 각성(CHM-17, `docs/reports/souls.md`: 혼 흔함 6/$4 · 드묾 3/$6 · 귀함 1/$9 — 세기는 그대로 · 먹은 사슬 다섯이면 금 → 금빛 적 승리 · 상자 세 칸 · 두루마리 깨우기로 각성, 혼마다 한 단계 더 · 금선 · 금테 표 · 각성 막간 `screens/awaken.js` · 도감 혼 탭 · 각성 칸, smart 100판 41% · 단 8 10% · none 0% · random 2% · 깨어난 판 15%, 테스트 467) · 기보는 얻는 순간 쓰인다(CHM-33, 두루마리 칸에 들지 않는다, smart 30판 50.0% 그대로) · 처음 안내는 대상이 화면에 있을 때만 · 대본 대국 경로 다섯을 smoke로(CHM-36, `docs/design-notes/tutorial.md` 「구현 뒤」 끝, `docs/shots/fix-33-36/`, 테스트 469) · 설명 겹침 없애기(CHM-34, `docs/design-notes/layout.md` 「접기와 자르기」: 설명이 뜨는 동안 묶음에 닿은 왼쪽 칸 줄을 비운다 `src/ui/fold.js` · 자리에 안 들어가면 그 높이로 잘라 「…」(재는 높이 = 그리는 높이) · 덜 중요한 줄 `optLine` · smoke 「설명이 덮은 글」 736/754 → 23(모두 도감 격자 — 피할 수 없음), 전후 `docs/shots/overlap/`, 테스트 470) · 두 배 도트(CHM-39: 기물 17종 32×44를 반 칸으로 `src/render/sprites-hi.js` · 2단계 아이콘 · 종류 문양 · 문장 · 초상 · 각인 재료 · 전술 117개 `src/render/art-hi.js`(Scale2x 다듬기, `tools/art-hi.mjs`), 1배는 옛 그림) · 종류 표시(CHM-37, layout.md 「종류 표시」: 카드 · 봉투 딱지, 두루마리 칸 왼쪽 띠, `src/ui/kinds.js`) · 격언 이름 잘림(CHM-40: 다시 놓기를 손 줄 아이콘으로 · 두 줄 격언 칸은 아이콘만 · 이름 폭 시험) · 단 8 계단(CHM-32, `docs/reports/dan8.md`: 7단 시계 −1 대신 대가 목표 ×1.25 · 8단 목표 ×1.25, 단 0 50% → 단 8 10.5%, 테스트 484) · 진열 카드 글(CHM-42, layout.md 「종류 표시」 끝: 머릿말 낱말 단위 줄 바꿈 · 쓰는 법 줄 바꿈 · 좁은 꾸러미 줄은 이름이 넘치면 작은 봉투 + 값 · smoke 진열 카드 종류 장면 다섯, `docs/shots/fix-42/`) · 테스트 497 · 희생 2부 화면(CHM-43, layout.md 「!? · !! 주석」 · `docs/reports/sacrifice.md` 「2부」: 새로 뽑은 카드 「!?」 · 바친 기물 줄 · 탁월수 「!!」 · 빛살 · 배수 칸 「×N」 · 소리 · 영어 「Sacrifice」 단추 · 기록 · 수업 ⑥ · 킹 ④걸음, `docs/shots/sacrifice/` · `docs/media/brilliant.mp4`, 테스트 514) · 소개 영상 다시 녹화(CHM-31, `docs/media/chapters.md`: 세력 · 큰 사슬 도장 · 희생 → 탁월수 · 종류 딱지 · 마스터전까지 84초 · 30fps · 소리, 장면 프레임 `docs/media/frames/`. `tools/video.mjs`는 게임 시계를 프레임마다 돌려 찍고 소리를 OfflineAudioContext로 다시 합성한다, `--first`는 `tools/video-first.mjs` · `light-motion.mp4`도 지금 모습으로) · 탁월수 보상과 별 평가(CHM-47, `docs/design-notes/sacrifice.md` 끝 · layout.md 「!? · !! 주석」: 사슬 평가 ★ · ★★ · ★★★ · ∞(도트 별 `src/ui/stars.js`, 옛 기록 열쇠 옮김) · 탁월수가 명경기 조각 하나(첫 조각, 다 있으면 재현) · smart 100판 43% · 단 8 13% 그대로, `docs/shots/grade/`, 테스트 528) · 첫 화면(CHM-49, layout.md 「첫 화면」: 달밤 · 하늘의 사슬(흰 폰이 다섯을 먹으며 바뀜, 타격감 시간표 `src/ui/skychain.js` · 그림 `src/render/night.js`) · 글자마다 오르내리는 로고 · 금빛 주인공 단추(저장 있으면 이어 하기) + 도트 아이콘 줄 · 여백 판 움직이는 층 · 옛 원근 시연 판 지움, `docs/shots/title/` · `docs/media/title.mp4`, 테스트 541) · 알림 손질(CHM-48, layout.md 「!? · !! 주석」 끝 · 「첫 화면」: 재현 조각 사건을 사슬 끝 앞으로(판정 그대로, 하네스 dump diff 0) · 대국 알림은 판 아래쪽 `toastSpot`(smoke 글 넘침이 목표 막대 겹침을 잰다) · 하양 ★ 어두운 테 · 첫 화면 「×N」은 부제 아래까지만 튐, 전후 `docs/shots/fix-48/`, 테스트 543) · 특수 기물 다시 짜기(CHM-55, `docs/design-notes/fairies.md` · `docs/reports/fairies.md`: 대주교 · 재상 · 야간기사 · 메뚜기를 빼고 꺾쇠 · 물수제비 · 까마귀 · 광대 · 화약병, 규칙 `board.js` 한 곳 · 옛 저장 바꿔 읽기 `oldsave.js`, 넓힌 행마(꺾쇠 두 번 꺾기 · 물수제비 두 번 튕기기 · 광대 붙은 칸 · 까마귀 잇따라 넘기) · 값 · 적 무게를 손잡이 다섯 바퀴로 맞춘 뒤 목표 곡선 2~8관 ×0.88, 마지막 100판 smart 단 0 37.4 · 34.0%(평균 35.7%, 흔들림 안으로 보고 채택) · 단 8 12%, 광대 seed 1 +29%p는 다음 손질 첫 후보, 테스트 592) · 복기(CHM-59, `docs/design-notes/agency.md` B 「구현 뒤」 · layout.md 15절: 진 순간 갈림길 카드(「N수째가 갈림길이었다」 · 판 위 「?」 · 「!」) → 「다시 두기」 수마다 재생 · 계산 `src/sim/replay.js`(빔 4 · 희생 1 · 마디 10만, 결정적) · 설정 「복기」 · 기록 `replay` 열쇠 · 하네스 `--replay`, 100판 진 대국 path 62.6% · none 27.0% · unknown 10.4%(판을 끝낸 패배 none 35.9%), `docs/shots/replay/`, 테스트 611).

데스크톱 1단계(CHM-8, `desktop/README.md`): Tauri 2로 서명 없는 맥 `.app` · `.dmg`, 창 1440×842(webview 1440×810) · 최소 960×572, 저장은 webview localStorage가 앱 데이터 폴더에 남음 · 첫 누름 뒤 소리 확인, 스크린샷 `docs/shots/desktop/`.

### 알아 둘 것:
- 판 봇은 돈에 아주 민감하다: 공짜 보상을 얹을 때마다 승률이 크게 뛰었다. 새 보상은 하네스로 재고 넣는다. 목숨(시계)에도 민감하다: 시계 3만으로 17.5% → 48.7%.
- 대국을 져도 판은 시계로 이어진다(`run.clock`, 진 뒤에도 상점은 열린다 — 보상 · 마스터의 상자는 없다). 판 조정(거르기 · 다시 놓기)은 `src/sim/tuning.js` 한 곳에서 켜고 끈다. 하네스 판 하나가 길어져 smart 판당 35~90초였다가 CHM-44(`docs/reports/perf.md`, 결과는 비트 단위로 같음)로 10일꾼 판당 20~26초 · 혼자 3~11초 — 판 하네스는 `--limit 400`으로 돌린다. 시간의 92%는 상점 봇의 짜임 재기(풀이기)다. 짜임 재기도 대국 봇과 같은 희생 판단(`tools/bot.mjs` `sacrificeChoice`, 기대값)으로 바친다(CHM-51, `docs/reports/sacrifice.md` 「CHM-51 봇」) — 희생 규칙 · 희생 격언을 바꾸면 그 판단도 본다.
- 판 하네스는 판 하나에 2분 상한(`--limit`, 넘으면 「시간 초과」로 따로). 봇의 짜임 재기는 마디 1000 · 판 K 6(깊이 층 뒤 판이 넓어져 상점 한 번이 수십 초가 됐었다). 10코어 10일꾼에서 smart 20판 ≈ 1분 · 100판 ≈ 4분(CHM-44 전 2분 · 8분).
- 체크메이트가 대국의 11%(후반 21%)로 흔하다 — 이형 사슬이 수비수를 다 치운다. `depth.md` 「아직 재미없는 곳」.
- 화면은 대국 상태를 이벤트 뒤에 다시 읽는다(`redrop` · `refill`). 미리 보기는 `previewCapture` · `previewDrop`(풀이기 복사본)으로만 잰다.
- 대국 화면(`BattleScreen`)은 대국이 어디서 오는지(`source`: 판 · 첫 수업)만 바꿔 같은 규칙 · 같은 연출로 쓴다. 누를 곳 좁히기는 `filterTargets`.
- 한 수 연출 ×1은 4초 안(smoke가 잰다). 새 연출을 넣으면 smoke 최대가 4초에 가깝다(지금 3.7~3.85초).
- 풀이기 마디 예산 10000. 마스터 통과율은 봇 기준이다.
- 첫 판 대본 대국(`screens/script.js`)은 대국 화면에 걸음(`src/ui/tutorial.js`)을 얹고, 누를 곳 막기 · 어둡게 · 킹 말풍선은 따라 하는 길(`coach.js` startGuide — hold · skip · target 함수)을 쓴다. 판을 바꾸면 `test/tutorial.test.js`가 실제 규칙으로 잰다.
- 수업은 걸음 대본(`lessons.js` steps: pick · drop · cap · discard, 걸음마다 say)으로 돈다. 새 수업은 `test/lessons.test.js`가 실제 규칙으로 이기는지 잰다. 수업 ⑩은 `run.scratch`(저장 · 기록 안 함) 판 위의 따라 하는 길(`coach.js` startGuide).
- 처음 안내는 화면이 그리는 중에 `hint(app, id, 구역 id)`로 부른다 — 말하는 것이 그 순간 화면에 있을 때만 부른다(격언 안내는 진열에 격언이 있을 때, CHM-36). 한 번에 하나, 부른 차례대로 가리킬 구역이 화면 안에 그려진 첫 것. 본 것은 `records.coachSeen`. smoke 「처음 안내가 말하는 것」이 판 상태로 대상을 잰다.
- 세력(`src/data/factions.js`)은 대국 규칙 깃발(`mix` · `unique` · `walls` · `wallRow` · `reinforceMix` · `traitMult` · `guardsBonus` …)로만 규칙에 닿는다. 봇(풀이기)은 안개 속 적도 보므로 숲 사냥꾼 수치는 사람보다 쉽게 나온다. 하네스 세력 표의 「관 보정」이 세력 공평의 잣대다.
- 사람 손으로 해 본 적이 없다. 첫 사람 판에서 볼 것은 `docs/reports/onboarding.md` 「알려진 문제」와 `night.md` 「남은 목록」.
- 사람 판 기록(CHM-50, `docs/design-notes/human-runs.md`): 판이 끝날 때(이김 · 짐 · 끝없는 대국 끝 · 새 판으로 덮어쓴 「그만둠」) 하네스 dump와 같은 열쇠의 한 줄을 `chainmate.runs.v1`에 200판까지 남긴다(수업 · 대본 대국 · scratch 빼고). 설정 「기록 내보내기」로 JSON을 받아 `node tools/humans.mjs <파일> [--vs <run.mjs dump>]`로 하네스와 나란히 본다. 요약 `src/sim/runlog.js` `runRow`는 `run.mjs` `one()`과 따로 두고 `test/runlog.test.js`가 값까지 견준다 — 하네스 판 열쇠를 바꾸면 둘 다.

### 다음
1. 사람 판으로 한 번: 처음 켠 10분(수업 열 · 처음 안내 · 카드 글이 읽히나, `docs/reports/ux.md` 「남은 헷갈림」), 미리 보기 · 소리 · 마스터 세기, 5관의 정보량.
2. 깊이 조정(`depth.md` 「다음 세션이 할 것」): 체크메이트 줄이기, 가족이 판을 가르게(쫓는 봇 = 무시하는 봇 20%), 전술 · 도박의 값 재기.
3. 건너뛰기 패 키우기(하네스로 재고), 마스터 통과율과 판 승률 맞추기(`night.md` 남은 목록).
4. 영어 글 다듬기, 데스크톱 포장 2단계(서명 · 공증, `desktop/README.md` 「2단계」).
