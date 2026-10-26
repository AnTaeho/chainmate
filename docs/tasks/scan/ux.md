# 처음 경험 · 화면 글 · 흐름 훑기 (ux)

캡처 · 스크립트 경로의 `scan/ux/`는 `/private/tmp/claude-501/-Users-antaeho-workspace-projects-chainmate/8f330b3b-72b7-4640-9007-8007bff18851/scratchpad/scan/ux/`다(저장소 밖, 세션이 끝나면 사라질 수 있다 — 클라우드 세션은 아래 스크립트로 다시 찍는다).
- `scan/ux/play.mjs <ko|en> <mobile|desktop> <run|tutorial> [걸음]`: 빈 저장소로 켜서 처음 켬 덮개 → 「바로 시작」 첫 판(봇) 또는 튜토리얼 여덟을 손가락(734×343 dpr3 · 터치) / 마우스(1280×720)로 두며 새 화면 · 새 안내마다 캡처. 서버는 빈 포트, 끝나면 브라우저 · 서버를 닫는다.
- `scan/ux/scenes.mjs <ko|en>`: 마우스를 치운 채 레퍼토리 · 관 선택 · 멈춤 · 설정 · 결과 · 용어 사전 · 새 판 화면.
- Playwright: `/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs`(저장소 의존성 아님).

### U-1 튜토리얼 상점 수업이 시너지 문턱을 틀리게 가르친다(4 · 6)
- 심각도: 높음   · 종류: 글
- 어디: 튜토리얼 ⑧ 「상점과 시너지」 마지막 걸음, `src/ui/screens/lessons.js:110` · `src/data/i18n/en.js:461`
- 무엇: 킹 말 「격언 둘로 기사 시너지가 2개야. 첫 효과가 켜졌고, 4개 · 6개면 더 켜져」 / en "Two maxims make Rider synergy 2. Its first effect is on. More at 4 and 6". 실제 문턱은 `src/data/families.js:13` `THRESHOLDS = [2, 4, 5]`(CHM-78, 예전 문턱은 6이었다 — voice.md 「변신 시너지 6」). 같은 화면의 시너지 띠(「기사 2/4」)와 낱말 상자(「2 · 4 · 5개」, `glossary.js:30`) · 도움말 팁 `family`(`coach.js:24`)는 5라서 수업이 처음 배우는 사람에게 틀린 수를 심는다.
- 고치는 방향: ko 「격언 둘로 기사 시너지가 2개야. 첫 효과가 켜졌고, 4개 · 5개면 더 켜져」, en "Two maxims make Rider synergy 2. Its first effect is on. More at 4 and 5". 문턱을 글에 박지 말고 `THRESHOLDS`에서 만들면 다시 어긋나지 않는다(예: `` `… ${THRESHOLDS[1]}개 · ${THRESHOLDS[2]}개면 …` `` + en.js는 TEMPLATES 한 줄). `test/lessons.test.js`에 「수업 글의 수 = THRESHOLDS」 시험 한 줄.
- 검증: `grep -rn "4개 · 6개\|4 and 6" src` 0건, `node --test test/lessons.test.js`, 캡처 `scan/ux/shots/ko-mobile-tutorial/056-lesson8-guide-5.png`(시너지 칩은 「기사 2/4」인데 킹은 「4개 · 6개」)

### U-2 진행 중인 판이 확인 없이 사라진다(「오늘의 대국」 · 「새 판」)
- 심각도: 높음   · 종류: 흐름
- 어디: 타이틀 `src/ui/screens/title.js:98,101` → `app.newRun`(`src/ui/app.js:271-275`), 새 판 화면 `src/ui/screens/setup.js:44-49,132,141`
- 무엇: 저장된 판이 있을 때 타이틀 아이콘 줄의 「오늘의 대국」을 한 번 누르면 곧바로 `app.newRun({ daily: true })`가 돌고, 끝나지 않은 판은 「그만둠(quit)」으로 기록에 남은 채 저장이 덮인다. 「새 판」 → 「시작」(또는 Enter)도 같다. 새 판 화면 머리줄 · 단추 어디에도 「지금 판이 끝나요」 같은 말이 없고, `src/ui`에 확인 단계가 한 곳도 없다(`grep -rn confirm src/ui` → 기기 연결 코드 확인뿐). 8관 가까이 간 판도 아이콘 한 번에 날아간다.
- 고치는 방향: `app.hasSave()`일 때만 확인 한 번. 권장: 막간 상자(멈춤과 같은 `interlude`)에 킹 말 없이 제목 「진행 중인 판이 있어요」 · 한 줄 「새로 시작하면 지금 판은 패배로 끝나요」 · 단추 「이어 하기」(금빛) · 「새로 시작」. en: "You have a run in progress" · "Starting over ends it as a loss" · "Continue" · "Start Over". 대안(가벼움): 새 판 화면 머리줄 오른쪽 보조 글에 붉게 「지금 판 3관 · 시작하면 끝나요」, 오늘의 대국은 그 화면이 없으니 확인 상자가 꼭 필요.
- 검증: smoke에 「저장된 판 + 오늘의 대국 → 확인 상자 → 이어 하기면 저장 그대로」 장면, `test/firstrun.test.js`에 같은 시험. 재현: 판을 하나 시작해 1관 대국 중 멈춤 → 메인 화면 → 아이콘 줄 「오늘의 대국」 한 번 → 확인 없이 새 판(기록에 옛 판이 quit으로 남음, `app.js:274`)

### U-3 화면 글 「단계」: 저장소 규칙끼리 부딪힌다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/parts.js:607`(상점 기보 카드 「0 › 1단계」), `src/ui/glossary.js:69`(「모습 하나의 단계를 올린다」), `src/data/maxims.js:298` 주특기(「기보 단계가 가장 높은 모습으로…」), `src/data/souls.js:50` 초월(「한 단계 위 기물이 된다」)
- 무엇: chainmate `CLAUDE.md` 「화면 글」은 「단계」를 화면에 쓰지 말라고 하고, `docs/design-notes/voice.md` 낱말 표는 「기보 레벨 → 기보 단계」로 정했다. 넷이 화면에 그대로 나온다. 어느 쪽이 맞는지 사람이 정해야 한다.
- 고치는 방향(둘 중 하나, 사람 판단): ① 규칙을 따른다면 기보는 「Lv」 꼴(「기보 0 › 1」 · 「나이트 기보 Lv 2」와 en 「Lv 0 › 1」이 이미 같다) · 주특기 「기보를 가장 많이 쓴 모습으로 잡을 때마다 값 +25」 · 초월 「잡을 때마다 한 칸 위 기물이 된다(폰 › 나이트 › …)」. ② 기보 단계를 허용한다면 CLAUDE.md 금지어에 「(기보 단계는 예외)」를 적는다.
- 검증: `grep -rn "단계" src --include='*.js' | grep -v "//"`

### U-4 처음 안내(킹 말풍선)가 설명 묶음 밑에 깔려 못 읽고 지나간다
- 심각도: 높음   · 종류: 처음 경험
- 어디: 판 틀 화면 전부(레퍼토리 · 관 선택 · 대국 · 상점 · 팩), `src/ui/app.js:573`(drawCoach) 다음 `:576-600`(설명 묶음을 그 위에 그림) · `src/main.js:308`(touchend가 손가락 자리를 가리킴으로 남김) · `src/ui/coach.js:58-63`(아무 데나 누르면 본 것으로 적음)
- 무엇: 킹 말풍선과 카드 설명 묶음(말풍선 + 낱말 상자)이 둘 다 왼쪽 칸을 쓰고, 설명 묶음이 나중에 그려져 말풍선을 덮는다. 손가락은 떼도 가리킴이 그 자리에 남아서, 앞 화면에서 누른 자리에 다음 화면의 카드가 있으면 곧바로 설명 묶음이 뜬다. 처음 켠 사람의 실제 길(「바로 시작」 → 레퍼토리 카드 누름 → 관 선택)에서:
  - 레퍼토리 안내 `draft`가 「강 · 성채 시너지 · 배수」 상자에 완전히 가려짐 — `scan/ux/shots/ko-mobile-run/003-hint-draft.png`
  - 세력 안내 「농민군 땅이야…」가 「연습 대국 · 팩」 상자에 덮여 머리줄만 보임 — `scan/ux/shots/ko-mobile-run/005-hint-faction_peasants.png`, 데스크톱도 같음 `scan/ux/shots/ko-desktop-run/004-hint-faction_peasants.png`(마우스를 그 자리에 둔 채)
  - 판 미리 보기 안내 `preview`도 완전히 가려짐 — `006-hint-preview.png`
  - 대국 `family` 안내 아래쪽이 「다음에 뽑을 기물」 상자에 걸림 — `010-hint-family.png`
  영어도 같다: 증원 안내가 「A dotted shadow marks a recruit.」에서 잘리고 「Highway」 상자가 덮음(`scan/ux/shots/en-mobile-run/008-hint-incoming.png`), 격언 팔기 안내 `maximSell`은 「Rider · Mult」 상자에 통째로 가려짐(`016-hint-maximSell.png`), 첫 패배 뒤 복기 안내 `replay`는 「Pawn」 상자에 덮임(`021-hint-replay.png`).
  그 상태에서 화면 아무 데나 한 번 누르면 `coachDown`이 그 안내를 본 것으로 적어 다시는 안 뜬다. 처음 경험의 안내가 읽히지 않은 채 사라진다. 마우스를 치우면 정상(`scan/ux/shots/ko-scenes/02-draft.png`, `03-after-draft.png`).
- 고치는 방향: ① 처음 안내가 이번 프레임에 떠 있으면(`app.hintShown`) 설명 묶음을 띄우지 않거나, 말풍선 아래로 쌓기(layout.md 「설명 자리 규칙」의 말풍선 → 상자 순서) — 권장은 「안내가 떠 있는 동안 설명 묶음 끔」(가장 단순, 안내는 누르면 곧 사라진다). ② 화면이 바뀔 때(`app.go`) 손가락 기기면 `ui.mouse`를 화면 밖(-1, -1)으로 옮겨 앞 화면의 누름이 다음 화면의 가리킴이 되지 않게(`touchcancel`이 이미 그렇게 한다). ③ 안내는 실제로 그려진 프레임이 하나 이상 있고 가려지지 않았을 때만 `markSeen`.
- 검증: 위 `play.mjs ko mobile run`을 다시 돌려 hint-* 캡처마다 킹 말풍선 글이 다 보이는지, smoke에 「처음 안내가 설명 묶음에 가리지 않음」(hintRect와 noteStack rects 겹침 0) 한 줄.

### U-5 첫 대국 첫 수 전에 안내가 넷 연달아 뜬다
- 심각도: 중간   · 종류: 처음 경험
- 어디: 1관 연습 대국 첫 화면, `src/ui/screens/battle.js`의 `hint(app, 'incoming' | 'next' | 'family' | 'joseki' …)` 호출들
- 무엇: 「바로 시작」한 사람(튜토리얼 안 함)이 첫 대국에서 놓기 전에 `incoming`(점선 그림자) → `next`(흐린 둘) → `family`(시너지 2 · 4 · 5) → `joseki`(레퍼토리 가리키기)를 차례로 누르며 넘긴다(`scan/ux/shots/ko-mobile-run/008~011`). 정작 첫 대국에서 가장 필요한 「손의 기물을 눌러 빛나는 칸에 놓아 봐」 · 「잡으면 그 기물로 바뀐다」는 판 안에 없다(튜토리얼에만 있음). 시너지 · 레퍼토리 안내는 첫 상점 뒤로 미뤄도 되는 것.
- 고치는 방향: 대국 안내는 한 대국에 하나만(대기열, 다음 대국에 다음 것). 튜토리얼을 건너뛴 사람(`!records.lessonsSeen.become`)의 첫 대국 첫 안내는 손 카드를 가리키는 「기물을 눌러 빛나는 칸에 놓아 봐」(새 HINTS `firstDrop`, 놓으면 사라짐), 둘째 대국에 `incoming`. `family` · `joseki`는 첫 상점 이후(상점에서 시너지 띠가 보일 때)로.
  데스크톱 훑기(`scan/ux/shots/ko-desktop-run/`)의 로그에는 대국 안내가 안 찍혔다. `battle.js:1517-1543` `coachHints`에 가리킴 조건은 없고, `coachDown`(`coach.js:58`)이 아무 누름에나 떠 있는 안내를 본 것으로 적으므로 하네스의 다음 클릭(손 카드)이 폴링 사이에 안내를 지운 것으로 본다 — 사람도 같은 일을 겪는다(손 카드를 누르는 순간 안내가 사라지고 그 누름은 그대로 전해진다). 별개 결함은 아니다.
  첫 상점도 같다: 격언이 진열에 있으면 `shop` → `hold` → (격언을 사면 곧바로) `maximSell` 셋이 이어진다(`scan/ux/shots/en-mobile-run/log.txt`).
- 검증: `play.mjs ko mobile run` 로그의 HINT 줄이 첫 대국에서 하나, 첫 상점에서 하나인지.

### U-6 처음 안내에 그림이 없고, 절반 넘게 두 문장이다
- 심각도: 중간   · 종류: 처음 경험
- 어디: `src/ui/coach.js:21-55` HINTS, 그리기 `bubble()`
- 무엇: 작업 취향 「조작법은 처음 필요한 순간에만 그림 + 동사 한 줄」과 달리 안내는 글만 있고(금빛 테로 가리킬 뿐), 34개 중 22개가 두 문장이다. 가장 긴 것 `brilliant` 57자 「이 기물로 곧바로 메이트하면 탁월수야. 희생한 기물이 무거울수록 배수가 커지고 명경기 조각도 하나 얻어」. 또 안내는 아무 데나 누르면 사라진다(해낸 때가 아니다).
- 고치는 방향: 조작 안내(놓기 · 찜 · 팔기 · 전술 · 두루마리)부터 작은 그림 칸(손가락 + 대상 아이콘, `fxroute`/`diagram.js` 재사용) + 동사 한 줄로. 두 문장 안내는 뒤 문장을 낱말 상자(이미 있는 TERMS)에 맡기고 한 줄로:
  | id | 지금 | 제안 ko | 제안 en |
  |---|---|---|---|
  | brilliant | 이 기물로 곧바로 메이트하면 탁월수야. 희생한 기물이 … | 이 기물로 곧바로 메이트하면 탁월수야 | Mate with this piece right away for a Brilliant |
  | shop | 산 격언은 오른쪽 칸에 들어가. 판이 끝날 때까지 효과가 있어 | 산 격언은 판 끝까지 오른쪽 칸에서 효과를 내 | Maxims you buy work all run from the right column(그대로) |
  | incoming | 점선 그림자는 증원이야. 이 수가 끝나면 그 칸에 적이 들어와 | 이 수가 끝나면 점선 칸에 적이 들어와 | An enemy arrives on the dotted square when this move ends |
  | next | 흐린 둘은 다음에 뽑을 기물이야. 위가 먼저 나와 | 흐린 둘은 다음에 뽑을 기물이야 | The two faded pieces come to your hand next |
  | crack | 혼에 금이 갔어. 금빛 적 · 마스터의 상자 · 깨우기로 깨어나 | 금 간 혼은 금빛 적 · 상자 · 깨우기로 깨어나 | A cracked soul wakes from a golden enemy, a chest or Awaken |
  「해내면 사라짐」은 조작 안내에만: `hold`는 찜을 눌렀을 때, `maximSell`은 팔거나 끌었을 때 `markSeen`.
- 검증: `node -e` HINTS 중 `'. '` 든 것 개수, drawcheck.

### U-7 「가리키면」 안내가 손가락 기기에서 맞지 않는다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/coach.js` HINTS `trait` · `things` · `joseki`, en.js `:79,153,154`
- 무엇: 「발밑 문양은 특성이야. 가리키면 설명이 나와」 「벽이나 보석을 가리키면 설명이 나와」 「고른 레퍼토리를 가리키면 효과가 나와」. 폰에는 가리키기가 없다(누르면 미리 보기). 폰 사용자가 많다(`shots-mobile.mjs`가 기본 기기).
- 고치는 방향: 동사를 「누르면」으로 통일(데스크톱 클릭도 같은 일). ko 「발밑 문양은 특성이야. 누르면 설명이 나와」 · 「벽이나 보석을 누르면 설명이 나와」 · 「고른 레퍼토리를 누르면 효과가 나와」, en "Tap …"(en은 이미 대부분 Tap). 아니면 `app.coarse`일 때만 바꾸는 틀.
- 검증: `grep -n "가리키" src/ui/coach.js` 0건.

### U-8 폰에서는 첫 화면마다 「창이 작아서 글이 작아」 안내가 뜬다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/screens/title.js` draw `hint(app, 'bigText', 'title:settings')`, `coach.js:39`
- 무엇: 734×343(아이폰 가로)에서 `pixelScale` 1.18 < 2라 처음 켬 덮개를 닫으면 이 안내가 뜬다(코드와 `play.mjs` 로그의 pixelScale로 확인, 캡처 없음). 폰에서는 「창」이 아니라 화면이 작은 것이고, 크게 할 방법이 「큰 글자」뿐이라는 것을 알리는 게 목적.
- 고치는 방향: ko 「글이 작으면 설정에서 큰 글자를 켜 봐」, en "Text too small? Turn on Large Text in Settings". 튜토리얼 · 첫 판을 먼저 하도록 덮개가 뜬 첫 실행에는 미루고(둘째 타이틀부터).
- 검증: 734×343 캡처 `play.mjs ko mobile …`에서 타이틀로 돌아온 뒤 확인.

### U-9 튜토리얼 ⑤ 「손과 희생」이 아직 안 배운 메이트 · 탁월수를 말하고, 판에는 킹도 없다
- 심각도: 중간   · 종류: 처음 경험
- 어디: `src/ui/lessons.js` LESSONS `redraw`(board `{ h8: 'Q' }`), en.js `:123`
- 무엇: 셋째 걸음 「새로 뽑은 나이트를 눌러 봐. 이걸로 곧바로 메이트하면 탁월수야」 → 다음은 「퀸을 잡아」로 끝난다. 판에 킹이 없어 메이트가 불가능하고, 체크메이트는 다음 수업 ⑥에서 처음 배운다. 처음 듣는 낱말 둘(메이트 · 탁월수)을 이루지 못할 일로 던진다 — `scan/ux/shots/ko-mobile-tutorial/032-lesson5-play-1.png`.
- 고치는 방향: ⑤에서는 탁월수 말을 빼고 「새로 뽑은 나이트를 눌러 봐」만. 탁월수는 ⑥ 체크메이트 끝 알림(after)이나 판 안의 `brilliant` 안내(이미 TAUGHT로 묶여 있으니 TAUGHT를 `mate`로 옮김)에. en "Pick up the knight you drew".
- 검증: `node --test test/lessons.test.js`, 캡처.

### U-10 튜토리얼 ③ 시범이 이 수업의 요점인데 「화면을 눌러 직접 해 봐」가 건너뛰게 만든다
- 심각도: 중간   · 종류: 처음 경험
- 어디: `src/ui/screens/lesson.js:20`(DEMO_FOOT) · `:158-162`(시범 중 누르면 skipDemo) · `src/ui/lessons.js` `guard.demo`
- 무엇: 「지키는 적부터」는 시범이 일부러 한 번 끊겨 보이는 게 가르칠 거리인데, 시범 첫 두 걸음에 say가 없어 킹 상자가 비어 있고 아래에 「화면을 눌러 직접 해 봐」만 보인다(`scan/ux/shots/ko-mobile-tutorial/016-lesson3-demo-0.png`). 따라 누르면 끊기는 장면을 못 본 채 내 차례로 넘어가고, 내 차례 첫 말 「이번엔 끊기지 않게 해 보자」의 「이번엔」이 가리키는 것이 없다.
- 고치는 방향: 시범 첫 걸음에 say 「먼저 보기만 해. 룩부터 잡으면 어떻게 될까?」(en "Just watch. What if you take the rook first?"). 시범이 요점인 수업(`L.demo`가 있는 것)은 첫 1.5초 동안 누름으로 건너뛰지 않게, 또는 DEMO_FOOT를 「다 보면 직접 해 봐」로.
- 검증: 캡처 `lesson3-demo-*`, `test/lessons.test.js` 「시범은 끊긴다」.

### U-11 튜토리얼 ④ 첫 말이 세 문장이고, 할 일(나이트 누르기)을 말하지 않는다
- 심각도: 낮음   · 종류: 처음 경험
- 어디: `src/ui/lessons.js` `reinforce.steps[0].say`, en.js `:116`
- 무엇: 「점수 아래 막대가 목표야. 다 채우면 이겨. 왼쪽 아래 금빛 구슬은 남은 수야」 — 설명 셋이 한 상자(5줄)에 몰리고, 이 걸음에 눌러야 하는 손의 나이트 이야기는 없다(빛나는 테만). `scan/ux/shots/ko-mobile-tutorial/023-lesson4-play-0.png`.
- 고치는 방향: 걸음을 나눈다 — ① 「점수 아래 막대가 목표야. 다 채우면 이겨」 + `ok`(알겠어) ② 「금빛 구슬은 남은 수야. 나이트를 눌러 봐」(pick). en ① "The bar under Score is the Target. Fill it to win" ② "Gold beads are your moves. Pick up the knight".
- 검증: `test/lessons.test.js`(걸음 3~6 · 반말), 캡처.

### U-12 튜토리얼 ⑥ 끝 알림이 보여 주지 않은 규칙을 꺼낸다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/lessons.js` `mate.after`, `glossary.js` `mate` 풀이, `battle.js` 킹 말풍선 「킹을 지키던 적을 둘 잡은 콤보로는 못 잡아요」
- 무엇: 이기고 나서 3초 알림 「킹을 지키던 적을 둘 잡은 콤보로는 킹을 못 잡아요」. 수업은 지키는 적 하나를 잡고 킹을 잡는 판이라 이 규칙이 뭔지 그려지지 않고, 문장도 「지키던 적을 둘 잡은 콤보로는」이 두 번 읽어야 풀린다(voice.md 「꼬인 문장은 풀지 말고 짧게」).
- 고치는 방향: 알림을 「잘했어! 킹은 지키는 적을 먼저 치우고 잡아」로(규칙 예외는 판 안의 킹 말풍선 · 용어 사전에만). 남길 거라면 ko 「한 콤보에서 킹의 호위를 둘 잡으면 그 킹은 못 잡아요」, en "If a chain takes two of the king's guards, it can't take the king".
- 검증: 캡처 lesson6 끝.

### U-13 줄 바꿈이 「2 · 4 · 5」 같은 수 목록의 가운뎃점을 지워 숫자가 붙어 읽힌다
- 심각도: 낮음   · 종류: 글
- 어디: `src/render/text.js:151` `noDot`(줄 끝 「 ·」를 지움)
- 무엇: 「같은 시너지를 2 · 4 / 5개 모으면」(`010-hint-family.png`), 「4개 / 6개면 더 켜져」(`056-lesson8-guide-5.png`), en 용어 사전 「rook 50 / queen 90」(`scan/ux/shots/en-scenes/09-glossary.png`). 효과 둘을 가르는 「 · 」를 지우는 규칙이 수 목록에도 걸려 「4 5개」 · 「4개 6개」처럼 읽힌다.
- 고치는 방향: 수 목록은 끊지 않게 붙임표로 묶거나(「2·4·5」를 한 덩이로 — `glueVM`처럼 `glueNums`), 글을 「2개 · 4개 · 5개」로 바꿔 끊겨도 뜻이 남게. en은 "2, 4 and 5"(이미 쉼표).
- 검증: `play.mjs` 캡처 family 안내, `node tools/smoke.mjs`.

### U-14 레퍼토리 고르기: 한 번 누르면 판 끝까지 가는 선택이 확정되고, 「은 · 금」 표시가 풀리지 않는다
- 심각도: 낮음   · 종류: 흐름
- 어디: `src/ui/screens/draft.js:84`(`onClick: () => this.pick(i)`), 카드 머리 「은 · 금 · 무지개」
- 무엇: 데스크톱은 클릭 한 번(잘못 누른 것도)에 판 끝까지 가는 선택이 확정된다(되돌리기 없음). 손가락은 첫 누름이 미리 보기라 두 번 눌러야 해서, 같은 선택이 기기마다 무게가 다르다. 카드 머리의 「은」 「금」(`scan/ux/shots/ko-scenes/02-draft.png`)은 무엇인지 어디에도 풀이가 없다(낱말 상자 · 용어 사전에 없음).
- 고치는 방향: 고르면 카드에 금빛 테 + 아래 「이걸로 시작」 단추(한 번 더). 「은 · 금」은 낱말 상자에 「레퍼토리 등급. 금일수록 효과가 크다」(en "Repertoire grade. Gold is stronger") — TERMS에 하나.
- 검증: smoke 「처음 켬 경로」에 레퍼토리 두 번 누름.

### U-15 일시정지에 「판 그만두기」가 없다
- 심각도: 낮음   · 종류: 흐름
- 어디: `src/ui/screens/pause.js:13-17`
- 무엇: 멈춤은 계속 · 설정 · 메인 화면뿐. 판을 접는 길은 새 판으로 덮어쓰기(U-2)밖에 없어, 사람은 「새 판」이 지금 판을 지운다는 걸 모른 채 그 길을 쓰게 된다.
- 고치는 방향: 멈춤에 「판 포기」(붉은, 한 번 더 누르면 확정 — 계정 로그아웃과 같은 두 단계) → 결과 화면. U-2 확인 상자와 같은 문구 재사용.
- 검증: smoke 「수업 중 멈춤」 옆에 「판 포기 → 결과」.

### U-16 설정 줄 대부분이 무엇을 하는지 알 길이 없다
- 심각도: 낮음   · 종류: 흐름
- 어디: `src/ui/screens/settings.js:96`(aux는 플레이 기록 전송 · 이름 · 계정만)
- 무엇: 「복기」 「연출 속도」 「움직임 줄이기」 「도움말 팁」을 가리켜도 아무 풀이가 없다. 특히 「복기 켬」은 처음 보는 사람이 무엇인지 모른다(`scan/ux/shots/ko-scenes/05-settings-inrun.png`).
- 고치는 방향: aux 한 줄 추가 — 복기 「진 대국 뒤에 이기는 수를 보여 줘요」(en "After a loss, see the winning line") · 연출 속도 「잡는 연출을 빠르게 해요」(en "Speeds up the capture animations") · 움직임 줄이기 「흔들림 · 번쩍임 · 움직이는 배경을 줄여요」(en "Less shaking, flashing and motion") · 도움말 팁 「처음 보는 것마다 킹이 한 줄 알려 줘요」(en "The king explains new things once").
- 검증: 설정 캡처에서 줄마다 가리키기.

### U-17 이름 바꾸기에 실패하면 「순위를 불러오지 못했어요」가 뜬다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/screens/settings.js:147`
- 무엇: 이름 바꾸기(`app.rank.reroll`) 실패 알림이 순위 화면의 불러오기 실패 문구를 그대로 쓴다. 사람은 순위를 연 적이 없다.
- 고치는 방향: ko 「이름을 바꾸지 못했어요 · 연결을 확인하세요」, en "Couldn't change your name · check your connection".
- 검증: `test/helpers/fakeapi.js`로 reroll 500 → 알림 글.

### U-18 기기 연결 결과가 오프닝을 「레퍼토리」라고 부른다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/screens/link.js:54`, en.js TEMPLATES `:656`
- 무엇: `g.openings`(열린 오프닝 수, `merge.js:106` `unlocked.openings`)를 「레퍼토리 N개가 새로 열렸어요」 / "N new Repertoires unlocked"로 알린다. 레퍼토리(관 앞에서 고르는 것)와 오프닝(새 판 화면의 덱 모양)은 다른 것이다.
- 고치는 방향: ko 「오프닝 N개가 새로 열렸어요」, en "N new opening(s) unlocked"(템플릿 키도 함께).
- 검증: `test` 기기 연결 합치기 시험의 알림 글.

### U-19 업적 · 쓰지 않는 문구에 금지 낱말 · 옛 동사가 남았다
- 심각도: 낮음   · 종류: 글
- 어디: `src/data/achievements.js:32,55` 등
- 무엇 · 고치는 방향:
  | 곳 | 지금 | 제안 ko | 제안 en(지금 → 제안) |
  |---|---|---|---|
  | 업적 첫 퀸 | 폰 모습으로 끝줄에 닿아 프로모션한다 | 폰 모습으로 끝줄에 가서 프로모션한다 | 그대로 |
  | 업적 끝없는 밤 | 끝없는 대국에서 12관에 닿는다 | 끝없는 대국에서 12관에 도달한다 | 그대로 |
  | 업적(맞받아치기) | 끊길 자리에서 콤보를 잇는다 | 끊길 자리에서 콤보를 이어 간다 | 그대로 |
  | `words.js:38` END_REASON | 놓을 곳이 없다 | (쓰는 곳 없음 — 지우기) | en 키 없음 |
  voice.md: 「닿」은 화면에 쓰지 않는다, 「잇는다 → 이어 잡는다」.
- 검증: `grep -rnE "'[^']*(닿|잇는다)[^']*'" src --include='*.js' | grep -v "//"`

### U-20 시너지 낱말 상자 풀이가 정한 틀과 어긋난다(ko 하나 · en 넷 갈래)
- 심각도: 낮음   · 종류: 글 · 영어
- 어디: `src/ui/glossary.js:20-29`
- 무엇: voice.md 「시너지 상자의 풀이는 모두 『~할수록 점수가 커진다』 한 줄」. ko `fam_crown` 「프로모션 · 퀸 · 체크메이트로 점수가 커진다」만 다르다. en은 Grows with… / Grows as… / Diagonal takes earn Value and Mult / Broken chains still score big / … score more / … grow bigger로 갈린다.
- 고치는 방향:
  | id | ko 제안 | en 제안 |
  |---|---|---|
  | fam_leap | (그대로) | Scores more the more you take with knight leaps |
  | fam_line | (그대로) | Scores more the farther you slide straight to take |
  | fam_diag | (그대로) | Scores more the more you take diagonally |
  | fam_change | (그대로) | Scores more the more often your form changes |
  | fam_sacrifice | (그대로) | Scores more the more your chains break |
  | fam_crown | 프로모션 · 퀸 · 체크메이트가 많을수록 점수가 커진다 | Scores more with every promotion, queen and mate |
  | fam_march | (그대로) | Scores more on chains started by a pawn |
  | fam_hunt | (그대로) | Scores more the more you take the same kind in a row |
  | fam_counter | (그대로) | Scores more the more guards you take |
  | fam_ambush | (그대로) | Scores more as you take recruits and drop where they arrive |
- 검증: 낱말 상자 높이 시험(`test/layout.test.js`), smoke --lang en.

### U-21 특수 기물 풀이가 행마 글 · 낱말 상자 · 영어에서 서로 다르다
- 심각도: 낮음   · 종류: 글 · 영어
- 어디: `src/ui/words.js`(행마 글) · `src/ui/glossary.js:76-80`(낱말 상자) · en.js `:576-578`
- 무엇:
  | 기물 | 행마 글 ko / en | 낱말 상자 ko / en |
  |---|---|---|
  | 광대 | 붙은 적은 그냥, 먼 적은 그 적의 행마로 잡는다 / Takes any neighbor, or a foe by its own move | 적을 그 적의 행마로 잡는다(룩은 룩처럼, 나이트는 나이트처럼) / Takes each enemy with that enemy's own move (…) |
  | 까마귀 | …바뀌어도 계속 넘는다 / Can chain jumps | …모습이 바뀌어도 계속 넘는다 / Keeps jumping even after its form changes |
  | 화약병 | 붙은 적을 잡는다 … / Takes one step away … | 붙은 적을 잡으면 … / Takes one square away … |
  광대는 규칙 설명이 서로 다르고(붙은 적 예외가 상자에 없음), 상자는 voice.md가 막은 괄호를 쓴다. 까마귀 en 「Can chain jumps」는 「모습이 바뀌어도」를 잃었다. en 「foe」와 「enemy」가 섞인다(english-review 표에 없는 낱말).
- 고치는 방향: 행마 글을 기준으로 상자를 맞춘다. 광대 상자 「붙은 적은 그냥, 먼 적은 그 적의 행마로 잡는다」 / "Takes a neighbor freely, a distant enemy by that enemy's own move". 까마귀 en 행마 "Jumps a diagonal neighbor and lands beyond. Keeps jumping after it changes form". 화약병 en 둘 다 "Takes a neighbor. Enemies around it blow up and the chain ends". en 「foe」 → 「enemy」.
- 검증: `grep -n "foe" src/data/i18n/en.js src/ui/glossary.js` 0건, 상자 세 줄 안(glossary 머리 주석의 너비 170).

### U-22 영어 문구 다듬기 모음
- 심각도: 낮음   · 종류: 영어
- 어디: `src/data/i18n/en.js`(줄 번호), `src/ui/glossary.js`
- 무엇 · 고치는 방향:
  | 줄 | 한국어 | 지금 en | 제안 en | 까닭 |
  |---|---|---|---|---|
  | 144 | 익명으로 판 결과만 보내요 · 화면은 수집하지 않아요 | Anonymous results only. No screen recording. | Anonymous run results only · no screen recording | 끝 마침표 금지(english-review), 「 · 」 틀 |
  | 146 | 내보내지 못했어요 | Could not export | Couldn't export | 다른 실패 글은 모두 Couldn't |
  | 201 | 메인 화면 / 메인 화면으로 | Title / To Title | Main Menu / To Main Menu | 결과 화면 단추 「Title」이 낱말로 안 읽힘(`scan/ux/shots/en-scenes/06-result-lost.png`) |
  | 214 | 적이 다시 나타났다! | Enemies refill | Enemies return! | 대국 중 번쩍이는 한마디, 「!」 유지 |
  | 214 | 넘겼다(끊김을 무시함, `battle.js:701`) | Survived | Held! | 무엇을 넘겼는지 안 읽힘. ko도 「버텼다!」 제안 |
  | 222 · 392 | 한 칸 · 세 칸 · 다섯 칸! / 시계 한 칸 | One cell · FIVE CELLS! / lose one cell | One slot · FIVE SLOTS! / lose one tick | 업적은 「5 slots in a master's chest」, 같은 것을 둘로 부름. 시계는 cell보다 tick |
  | 34 | 아이디는 영문 소문자 · 숫자 · _ 3~20자 | Usernames: a to z, digits, _ · 3 to 20 long | 3–20 characters: a–z, 0–9 or _ | 「3 to 20 long」 비문 |
  | 55 | 이 기기만 연결이 끊겨요 | This device splits off | Only this device is unlinked | |
  | 210 | 가진 상금 두 배(최대 $10) | Double cash (max $10) | Double your purse (max $10) | 상금 = Purse |
  | 209 | 다음 상점 팩 칸 +1 · 다음 상점 리롤 2번 무료 | +1 bundle slot next visit · 2 free rerolls at next shop | +1 bundle slot next shop · 2 free rerolls next shop | 같은 꼴로 |
  | 391 | 패배 · 시계 −1 | Clock −1 | Lost · Clock −1 | 진 것이 빠짐 |
  | 399 | 대국마다 돌기둥 셋~다섯이 길을 막는다 | Three to five stone pillars stand | 3–5 stone pillars block the way each match | 뜻이 빠짐 |
  | 400 | 위 두 줄은 숲이라 놓을 수 없다 · 갈 수 있는 칸만 보인다 | Top two ranks are forest · your reach clears it | No drops on the top two ranks · only squares you can reach show | 「your reach clears it」 비문, 535도 같은 꼴 |
  | 103 | 목표 · 수 · 증원 | Moves & Recruits | Target, Moves & Recruits | 수업 이름에서 Target이 빠짐 |
  | 83 · 211 · 665 | 콤보 칸 풀이 · 잡은 수 · N 잡음 | Captures … / Captures / N captures | Takes this move … / Takes / N takes | english-review: 잡기 = Take |
  | glossary links | 점수 = 값 × 배수 … +3은 더하고 ×1.5는 곱한다 | +1 with every take. Score = Value × Mult | Score = Value × Mult. +1 per take. +3 adds, ×1.5 multiplies | 한국어의 반이 빠짐 |
  | glossary chain | 놓은 기물이 한 수 동안 적을 잇달아 잡는 것 | Every take one dropped piece makes in a move | All the takes one dropped piece makes in a single move | |
  | glossary step | …그 칸의 적을 잡으면 배수 ×2 | …Take on one: ×2 Mult | …Take an enemy on one: ×2 Mult | |
  | glossary scroll | 사 두었다가 쓰는 물건 칸 | Slots for things you buy now and use later | An item you buy now and use later | 낱말은 물건인데 풀이는 칸. ko도 「사 두었다가 쓰는 물건」 |
- 검증: `node tools/smoke.mjs --lang en`(글 넘침 · 잘린 글 0), `node --test`.

### U-23 「다음 오프닝 런던: 5관에 도달한다 1/5」 수가 붙어 읽힌다
- 심각도: 낮음   · 종류: 글
- 어디: `src/ui/screens/result.js`(`다음 오프닝 ${name}: ${text} ${have}/${need}`), en.js TEMPLATES `:696`
- 무엇: 「5관에 도달한다 1/5」 / "Reach Hall 5 1/5"(`scan/ux/shots/en-scenes/06-result-lost.png`, 상태를 고쳐 강제로 끝낸 판이지만 글은 실제 틀 그대로) — 과제의 수와 진행 수가 한 줄에 붙는다. 새 판 화면은 같은 것을 「(1/5)」로 쓴다.
- 고치는 방향: 「다음 오프닝 런던: 5관에 도달한다 (1/5)」 또는 진행을 작은 막대로. en "Next opening London: Reach Hall 5 (1/5)". 「다음 해금까지 관 2개」도 「관 2개를 더 돌파하면 해금」(en "Clear 2 more halls to unlock")으로 무엇을 할지 동사로.
- 검증: 결과 화면 캡처 ko · en.

### U-24 문서와 화면 낱말이 어긋난 곳(문서 갈래)
- 심각도: 낮음   · 종류: 글
- 어디: `docs/design-notes/voice.md` · `chess-terms.md` · `english-review.md` · `docs/history.md:54`
- 무엇: voice.md · english-review 시너지 목록은 「희생 / Sacrifice」인데 화면은 「불굴 / Resolve」(`glossary.js:24`, en.js `:452`). chess-terms 「상점 기물 올리기 단추는 『올리기』」인데 화면은 「○○으로 교체 $N」(`shop.js`). history 「남은 것」에 「격언 『외통 사냥꾼』」이 남아 있다(지금 「메이트 사냥꾼」).
- 고치는 방향: 문서를 화면에 맞추거나(불굴 · 교체), 교체 → 올리기로 화면을 맞춘다(사람 판단 — 「교체」는 바뀌는 것만, 「올리기」는 나아지는 느낌). 문서 갈래 커밋으로.
- 검증: `grep -n "희생 시너지\|올리기\|외통 사냥꾼" docs/design-notes/*.md docs/history.md`

### U-25 복기 갈림길 카드의 영어 점수 줄이 끊긴 말처럼 읽힌다
- 심각도: 낮음   · 종류: 영어
- 어디: en.js PRE `:615-620`(「내가 둔 수 … · 이기는 수 …」), `src/ui/review.js`
- 무엇: 첫 패배 뒤 카드 「Move 4 was the turning point / Knight on b3 would have won / You 560 · Winning line 1,150 / Target 730」(`scan/ux/shots/en-mobile-run/021-hint-replay.png`). 「You 560」은 주어만 있는 말이다. 같은 줄의 단추 「Replay」(다시 두기)와 머리 「Review · 0/1」의 0부터 세는 수도 처음 보는 사람에게 헷갈린다.
- 고치는 방향: en "Yours 560 · Best 1,150 · Target 730"(또는 "You scored 560 · Best line 1,150"). 머리 수는 1부터(「복기 · 1/1수」 / "Review · 1/1").
- 검증: smoke --lang en 복기 장면, 캡처.
