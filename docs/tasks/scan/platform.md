# 기기 · 입력 · 플랫폼 점검(체인메이트, main f2275d0 기준, 2026-10-26)

재료 폴더: `/private/tmp/claude-501/-Users-antaeho-workspace-projects-chainmate/8f330b3b-72b7-4640-9007-8007bff18851/scratchpad/scan/platform/` (아래 「재료/」). 도구는 모두 저장소 밖 사본이고, 저장소 파일은 건드리지 않았다.
- 손가락 견주기 원문: 재료/touch.txt · touch.json (`PLAYWRIGHT=… node tools/touch-audit.mjs --json …`, WebKit, 장면 28 × 판 6)
- 작은 누름 자리 표: 재료/tapsize-touch.txt(손가락 판, 넓힌 구역 기준) · tapsize.txt(마우스 그림 기준)
- 그리기 · 메모리 탐침: 재료/perfprobe.mjs · padprobe.mjs · memprobe.mjs · dprprobe.mjs · retinaprobe.mjs · whoprobe.mjs · shopwho.mjs
- 화면 맞춤 셈: 재료/fits.mjs · fits2.mjs(fit.js `chooseFit`을 그대로 부른다)

손가락 견주기 결과 요약: 손가락 고치기(UI.snap) 뒤 진짜로 다른 것은 거의 없다. 「다름」 41줄 가운데 남는 것은 P-5(상점 찜 ↔ 다음 대국)뿐이고, 나머지는 P-15의 도구 잡음이다.

---

### P-1 창 끝 비움 때문에 안드로이드 · 큰 아이폰에서 판이 정수 배율 때보다 작아졌다
- 심각도: 중간   · 종류: 화면 맞춤
- 어디: 안드로이드 크롬 가로 915×412 dpr 2.625, 851×393, 780×360, 아이폰 16 Pro Max 사파리 932×370. `src/main.js:104-108`(`edgeGutter`), `src/ui/fit.js:46-47`
- 무엇: `edgeGutter`는 손가락 기기 브라우저면 모두 위 · 아래 12 CSS 화소를 비운다. 그런데 이 문제(창 끝 누름을 도구 막대가 먹음)는 아이폰 사파리에만 있다. 높이가 24 줄면 K가 1/30 칸으로 내려가 정수 K보다 작아진다. `node 재료/fits2.mjs`:
  - 915×412: 꽉 채움+비움 689×387(K 3.77) / 비움 없는 꽉 채움 731×411(K 4) / 정수 731×411(K 4)
  - 851×393: 652×367 / 698×393 / 698×393
  - 780×360: 597×336 / 640×360 / 640×360
  - 932×370: 613×345 / 656×369 / 640×360
  - 안태호 아이폰 17(874×402, 보이는 높이 352): 581×327로 정수 480×270보다 크다. 여기는 괜찮다.
  꽉 채움을 기본으로 바꾼 뒤 이 기기들은 이전 기본(정수)보다 판이 6~7% 작다.
- 고치는 방향: ① `edgeGutter`를 iOS 사파리(홈 화면 앱 아님)에만 준다. 판별은 `navigator.maxTouchPoints > 0 && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && !navigator.standalone`. ② 덧붙여 `chooseFit`에서 비움을 넣은 꽉 채움 K가 비움 없는 정수 K보다 작으면 정수 쪽(또는 비움 없는 꽉 채움)을 고른다. `test/fit.test.js`에 위 네 창을 넣는다.
- 검증: `node --test test/fit.test.js`에 새 경우를 넣어 915×412 · coarse · 안드로이드 UA가 K 4가 되는지 본다. `node tools/shots-scale.mjs`. 아이폰 17 i17-fill 판은 그대로 581×327인지 `node tools/touch-audit.mjs --configs i17-fill --only title`로 본다.

### P-2 비운 뒤에도 창 끝 20 CSS 화소 띠에 걸친 단추가 남았다(아이폰 사파리 가로)
- 심각도: 중간   · 종류: 터치
- 어디: 아이폰 가로 734×343 꽉 채움(land-fill), 아이폰 17(i17-fill). 첫 화면 · 상점 · 도감 · 기록 · 순위 · 계정 · 수업. 재료/touch.txt 「창 끝」 표
- 무엇: 창 끝에서 그림까지의 거리(CSS 화소):
  - 첫 화면 아래 단추 여섯(`title:lesson` … `title:settings`): 아래 13.0. 그림 높이가 51.8이라 가운데를 누르면 띠 밖이지만, 아래쪽 가장자리를 누르면 띠 안이다.
  - 상점 `shop:reroll` · `shop:leave`(다음 대국): 위 14.4. 손 덱 `deck:#` 아래 16.5, 두루마리 `cons:2` · `cons:3` 아래 15.4.
  - 탭 줄(`codex:tab:*` · `records:tab:*` · `rank:tab:*` · `acct:tab:*`): 위 19.1. 수업 `lesson:skip` · 대국 `btn:moves` 위 14.4.
  - `btn:pause`는 구역이 캔버스 밖 여백까지 넓어(구역 위 −8) 괜찮다.
  클라우드 도구로는 iOS 도구 막대 되살리기를 흉내 낼 수 없다.
- 고치는 방향: 그림은 그대로 두고, 손가락 기기에서 창 끝에 닿은 단추의 누르는 구역만 바깥쪽 캔버스 끝(−여백)까지 넓힌다. `btn:pause`가 이미 쓰는 길(`button(... { grow: { u: Infinity } })`)을 탭 줄 · 상점 위 단추 · 첫 화면 아래 단추에 쓴다. 이웃과는 겹치지 않는 쪽만 넓힌다. 위쪽 띠는 비움(12)을 위 · 아래 따로 둘 수 있게(`gutter.top` · `gutter.bottom`) 해 두면 실기기 확인 뒤 한쪽만 키울 수 있다.
- 검증: `node tools/touch-audit.mjs --configs land-fill,i17-fill`의 「창 끝」 표에서 위 단추들의 「구역 위」가 0 이하로 나와야 한다. 「다름」 표에 steal 0. 실기기 아이폰 사파리 가로에서 첫 화면 아래 단추의 아래 끝 · 상점 「다음 대국」 위 끝을 눌러 본다(사람 확인).

### P-3 iOS에서 전화 · 시리 · 다른 앱 소리 뒤 게임 소리가 돌아오지 않을 수 있다
- 심각도: 중간   · 종류: 소리
- 어디: 아이폰 사파리 · 홈 화면 앱. `src/audio/audio.js:464-478`, `src/main.js:256-260`
- 무엇: `unlock()`은 상태가 `'suspended'`일 때만 `resume()`을 부르고, `resume()`은 `paused`가 참일 때만 돈다. `paused`는 `suspend()`가 `'running'`인 컨텍스트를 쉬게 했을 때만 켜진다. iOS WebKit은 전화 · 시리 · 다른 앱이 소리를 가져가면 상태를 `'interrupted'`로 둔다. 숨기 전에 이미 끊겼다면 `paused`가 안 켜지고, 돌아와 화면을 눌러도 `'suspended'`가 아니라 다시 켜지지 않는다. 다시 불러올 때까지 소리가 없다. 코드만 읽고 판단했고 실기기로 재현하지는 않았다.
- 고치는 방향: `unlock()`에서 `ctx.state !== 'running' && ctx.state !== 'closed'`이면 `resume()`. `ctx.onstatechange`에서 `'interrupted'`를 보면 `paused = true`. `visibilitychange` visible에서도 같은 판단으로 잇는다.
- 검증: `test/`에 가짜 AudioContext(state `'interrupted'`)로 `unlock()` 뒤 resume이 불리는지 보는 시험. 실기기: 게임 소리를 켜고 시리를 불렀다가 돌아와 한 번 눌러 소리가 나는지(사람 확인).

### P-4 꽉 채움에서 맥북 · 1440p · 4K는 뒷면이 기기 화소의 반 해상도라 그림이 거칠다
- 심각도: 중간   · 종류: 화면 맞춤
- 어디: 맥북 전체 화면 1470×956 dpr 2(K 6.07 → j 2 → 뒷면 1456×819를 CSS가 2배), 2560×1440 dpr 1(K 5.33 → 뒷면 1280×720 ×2), 4K dpr 1 · 1.5(K 8 → 정수 길로 n 4, 뒷면 1920×1080 ×2). `src/ui/fit.js:7`(`FILL_CAP = 5`), `fillBack`, `backScale`
- 무엇: K가 상한 5를 넘으면 정수 j로 나누는데, K가 5를 조금만 넘어도 j = 2가 되어 n이 3 언저리로 떨어진다. `image-rendering: pixelated`로 2배 늘리니 벡터 기물 · 글 가장자리가 계단진다. 같은 창(1470×956@2)의 견줌 그림: 재료/retina-cap5.png(지금) · 재료/retina-cap7.png(`?fitcap=7`). 나이트 윤곽과 숫자가 눈에 띄게 다르다. 대가: 캔버스 메모리 18.5 → 59.7MB, 그리기 p99 1.4 → 1.7ms(크로미움).
- 고치는 방향: 상한을 배율 대신 화소 수로 둔다(예: 뒷면 ≤ 약 5.5MP이면 j = 1). 마우스 기기(`!coarse`)에만 올리고 폰은 지금대로 둬도 된다. 정수 길의 `backScale` 상한 4도 같은 화소 수 기준으로 맞춘다.
- 검증: `node --test test/fit.test.js`(1470×956@2 → n 6.07 · j 1 경우 더함), `node tools/drawcheck.mjs --scale 1470x956 --fit fill` 어김 0, `node tools/shots-scale.mjs`로 견줌 그림.

### P-5 상점 찜 책갈피 바로 위가 「다음 대국」이라 조금만 빗나가도 상점을 떠난다
- 심각도: 중간   · 종류: 터치
- 어디: 상점, 모든 손가락 판. `src/ui/screens/shop.js:213-217`(`holdHit` `u: 0`), `:558`(`leave`), 재료/shop-landfill.png
- 무엇: 둘째 진열 카드의 책갈피(`shop:hold:1`, 31×31 @ 302,22)와 `shop:leave`(69×18 @ 283,2) 사이가 2 도트다. touch-audit near: 「(317,20) 누름 → 기대 shop / 손가락 select」. 책갈피 위를 살짝 빗누르면 되돌릴 수 없는 「다음 대국」이 눌린다(남은 돈으로 살 기회가 사라진다). 마우스 그림 기준 손가락 판 거리 2.4 CSS 화소.
- 고치는 방향(하나 고른다): ① `shop:leave`에 `preview: true`(손가락이면 두 번 — 첫 누름에 「한 번 더 누르면 다음 대국」 말풍선). ② 책갈피 그림을 1~2 도트 내리고 `holdHit` 위쪽 여유를 0으로 둔 채 `shop:leave` 구역 아래를 `grow`로 줄인다. ①이 단순하고 키보드 Enter와도 어긋나지 않는다(P-11).
- 검증: `node tools/touch-audit.mjs --only shop --configs land-fill,port-fill`에서 `shop:hold:1` near 줄이 사라져야 한다. `npm test` · `npm run smoke`.

### P-6 저장이 꽉 차면 판 진행이 말없이 사라진다
- 심각도: 중간   · 종류: 저장
- 어디: 모든 기기, 오래 둔 사람. `src/ui/app.js:302-306`(`app.save`), `:130`(`saveRecords`), `src/ui/runlog.js:13-20`, `src/sim/runlog.js:9`(`RUNLOG_MAX = 200`)
- 무엇: 잰 크기(smoke 사본으로 판 6개, 재료/smoke-ls.txt 끝 줄 `LSMAX`): 사람 판 기록 `chainmate.runs.v1` 110,001자(판 하나 약 18KB), 진행 중인 판 `run.v1` 33KB, 기록 4KB. 저장 한도(재료/quota.mjs): WebKit · 크로미움 모두 ASCII 약 520만 자, WebKit은 한글이 섞이면 260만 자. 판 기록 200줄이면 약 360만 자라 끝없는 대국이 많은 사람은 한도에 닿는다. `keepRow`는 제 것만 덜어 다시 쓴다. `app.save` · `saveRecords`는 `store.set`이 거짓을 돌려줘도 무시하니, 판 기록이 자리를 다 차지하면 진행 중인 판 저장이 조용히 실패한다. 다시 열면 앞 마디로 돌아간다. 아이폰 사파리(홈 화면 앱 아님)는 7일 동안 안 열면 스크립트 저장소를 지운다. 기기를 잇지 않은 사람은 기록 · 플레이어 열쇠를 함께 잃는다.
- 고치는 방향: ① 판 기록을 줄 수 대신 글자 수(예: 120만 자)로 자른다. ② `app.save` · `saveRecords`가 실패하면 판 기록을 4분의 1 덜고 한 번 더 쓴다. 그래도 안 되면 알림 한 번(「저장 공간이 모자라요」). ③ iOS 사파리(홈 화면 앱 아님)에서 판을 3번 끝낸 뒤 처음 안내(`coach.js hint`)로 「기기 잇기 · 계정」을 한 번 권한다.
- 검증: `test/`에 한도가 있는 가짜 storage(예: 40만 자)로 판 기록을 채운 뒤 `app.save`가 판을 남기는지 보는 시험. `npm test`.

### P-7 화면 비율(dpr)만 바뀌면 다시 맞추지 않는다(모니터를 옮길 때)
- 심각도: 중간   · 종류: 화면 맞춤
- 어디: 데스크톱 · 외장 모니터(dpr 1)와 맥북 화면(dpr 2) 사이로 창을 옮길 때. `src/main.js:143-150`
- 무엇: `resize` · `visualViewport resize` · `orientationchange` · `pageshow`만 듣는다. CSS 크기가 그대로면 dpr이 바뀌어도 사건이 없다. 재료/dprprobe.mjs(크로미움 CDP로 dpr 2 → 1 → 2, 크기 그대로): `resize` 0번, `__fit`은 dpr 2 셈 그대로, 뒷면 1440×810 그대로. 1배 모니터에서 연 창을 레티나로 옮기면 반 해상도로 흐리게 남는다. 반대로 옮기면 캔버스 자리가 반 기기 화소에 걸린다.
- 고치는 방향: `main.js`에 `matchMedia(`(resolution: ${devicePixelRatio}dppx)`)`의 `change`를 듣고 `later()`를 부른다. 바뀔 때마다 새 dpr로 다시 건다.
- 검증: dprprobe와 같은 방식(CDP `Emulation.setDeviceMetricsOverride`로 dpr만 바꿈)으로 `__fit.k / __fit.css`가 새 dpr과 같아지는지 본다. 도구로 남기려면 `tools/shots-scale.mjs`에 한 장면 더.

### P-8 쉬는 화면이 초당 60번 그린다: 관 선택 구슬 숨, 혼 · 깨우기 그림, 첫 화면 여백 판
- 심각도: 중간   · 종류: 성능
- 어디: 아이폰 가로 꽉 채움(뒷면 1696×954, 여백 판 2202×1029). `src/ui/screens/select.js:55`(`antePath` `live()`), `src/ui/art.js:238`(혼 · 깨우기 `live()`), `src/render/backdrop.js:75-95` + 첫 화면 `surroundScene`
- 무엇: 재료/perfprobe.mjs · whoprobe.mjs · shopwho.mjs · padprobe.mjs(크로미움, `alwaysDraw: false`, 734×343@3 손가락):
  - 관 선택: 그림/초 60. `live()`를 부르는 곳은 `antePath` 하나(지금 관 구슬의 사인 숨). layout.md 9절은 관 선택을 「늘 거짓」으로 적어 두었다. 움직임 줄이기(`LOOK.calm`)여도 숨은 계속된다.
  - 상점(에디션 없는 진열): 그림/초 60. `itemArt`의 혼(도는 점 셋) · 깨우기(반짝임) `live()`. 혼 두루마리를 들고 있으면 상점 내내 60번 그린다.
  - 첫 화면: 게임 60/초 + 여백 판 35/초. 여백 판은 꽉 채움에서 기기 화소 그대로(2202×1029, 약 227만 화소)라 정수 배율(도트 해상도 여백 판) 때보다 칠하는 값이 크다. 크로미움 CPU 6배 느림: 첫 화면 18fps, 상점 19fps(도감은 60 — 안 그리니까).
  - 대국 쉼: 34/초(문서 표는 12 · 18).
  무엇을 그리든 손에 든 폰이 쉬지 못하고 배터리를 쓴다.
- 고치는 방향: 구슬 숨 · 깨우기 반짝임은 `beat(app.time, 6)` 계단으로 바꾼다(초당 6번). 혼의 도는 점은 `LOOK.calm`이면 멈추고, 아니면 `beat(app.time, 12)`. 첫 화면 여백 판은 움직이는 층(별 · 실루엣)을 도트 해상도 캔버스에 따로 굽거나 초당 12번으로 묶는다. layout.md 9절 표(대국 쉼 수치 · 관 선택)를 잰 값에 맞춘다.
- 검증: `node tools/drawcheck.mjs` 어김 0(계단으로 바꾼 뒤 「건너뜀인데 화소가 바뀐」 프레임이 없어야 한다), `node tools/drawcheck.mjs --scale 1280x720 --fit fill`. 재료/perfprobe.mjs 같은 방식으로 관 선택 · 상점 그림/초 ≤ 12.

### P-9 오늘의 대국이 배포마다 「업데이트됐어요」로 순위에서 빠진다(문서만 바꾼 배포도)
- 심각도: 중간   · 종류: 저장
- 어디: 순위 제출. `api/_lib/http.js:10`(`BUILD = VERCEL_DEPLOYMENT_ID …`), `src/ui/rank.js:111-116`(`hello`가 세션에 한 번), `:186`(409 → stale), `:124-131`(`retry`)
- 무엇: 서버 식별자가 배포 ID라 문서 · 화면만 바꾼 배포에도 바뀐다. 화면은 세션 처음에 받은 `build`를 끝까지 쓴다. 아이폰 홈 화면 앱처럼 며칠씩 다시 불러오지 않는 사람은 그사이 배포가 한 번만 있어도 오늘의 대국을 끝냈을 때 409 stale이 되고, 다시 열기 안내도 없다. 옛 판본에서 시작한 판을 새로 켜 이어 두면 새 식별자가 실려 규칙이 바뀐 경우 422로 조용히 버려진다(leaderboard.md에 적혀 있다). 그 밖에: 대기열은 날짜가 오늘이 아니면 버린다(`rank.js:128`). 서버는 ±1일을 받으니 자정 직전에 끝낸 판이 사라진다. `online` 사건에 다시 보내지 않는다. 대기열은 하나뿐이라 그날 낸 더 좋은 판이 나중 판에 덮인다.
- 고치는 방향: ① 서버 · 화면이 같은 규칙 해시를 쓴다. `tools/stamp.mjs`에서 `src/sim` · `src/data` · `api/_lib/verify.js` 내용 해시를 만들어 `dist`의 작은 json과 함수 환경에 같이 싣는다. ② 오늘의 대국을 시작할 때 `run.build`에 그 값을 적고 제출은 그 값을 보낸다. 규칙이 다르면 422 대신 409가 나 사용자가 까닭을 본다. ③ `visibilitychange` visible과 오늘의 대국 시작 앞에서 `/api/hello`를 다시 묻고, 다르면 「새 판본이 있어요 — 다시 열기」 단추를 보인다. ④ `retry`는 하루 전 것까지 보내고, `window` `online`에서 `rank.retry()` · `cloud.push()`.
- 검증: `test/rank.test.js`에 가짜 서버(`test/helpers/fakeapi.js`)로 build가 바뀐 경우 · 어제 대기열 · online 재시도 경우를 더한다. 푸시 뒤 `node tools/daily-e2e.mjs https://chainmate.papercut.kr`.

### P-10 끊긴 손가락(touchcancel)이 끌던 격언을 맨 위로 옮긴다
- 심각도: 낮음   · 종류: 터치
- 어디: 상점 격언 끌기 중 전화 · 알림 · 시스템 몸짓. `src/main.js:310`, `src/ui/ui.js:100-110`, `src/ui/screens/shop.js:543-547`
- 무엇: `touchcancel`은 `app.pointer('up', -1, -1)`을 부른다. ① 끌던 중이면 `ui.up`이 `onDrop(-1, -1)` → `dropMaxim`이 `my = -1`로 `to = 0`을 셈해 격언을 첫 자리로 옮긴다(순서가 점수에 닿는다). ② 누르고 있던 구역이 왼쪽 위 끝이면 `snap('up', -1, -1)`이 그 구역 안으로 붙여 눌린 것으로 친다. 재료/cancel.mjs(40×16 단추 @ 4,4, 손가락 35 → clicked 1). 지금 화면에서 걸리는 구역은 `lessons:endcover`(하는 일 없음)뿐이지만(재료/cancelprobe.mjs), 왼쪽 위에 단추가 생기면 바로 드러난다.
- 고치는 방향: `app.pointer('cancel')`을 새로 두어 `ui.press = null; ui.drag = null; ui.move(-1, -1)`만 하고 snap · onClick · onDrop을 거치지 않는다. `main.js` touchcancel이 그것을 부른다.
- 검증: `test/touch-snap.test.js`에 끌기 도중 cancel → 격언 순서 그대로, 왼쪽 위 단추 누른 채 cancel → onClick 0 경우를 더한다. `npm test`.

### P-11 키보드: 수정 키 · Enter 연타가 뜻밖의 동작을 한다
- 심각도: 낮음   · 종류: 키보드
- 어디: 데스크톱. `src/main.js:319-326`, `src/ui/screens/battle.js:2673-2674`, `shop.js:569`, `reward.js:135-139`
- 무엇: ① `keydown`이 Shift · Meta · Control · Alt와 그 조합을 그대로 `app.key`로 넘긴다. 점화 막간은 「아무 키나 닫는다」, 마스터 등장은 「다른 키는 넘긴다」여서 Cmd+Tab(창 바꾸기) · Cmd+Shift+4(화면 찍기)를 누르면 연출이 넘어간다. Cmd+1~5는 `preventDefault`로 막혀 브라우저 탭 바꾸기 대신 손 카드가 골라진다. ② 보상 Enter(펼침 넘김) → Enter(상점으로) → Enter(상점 `leave`)로 Enter를 세 번 연타하면 상점을 사지 않고 지나간다. 상점 Enter는 확인 없이 바로 떠난다.
- 고치는 방향: `main.js`에서 `e.metaKey || e.ctrlKey || e.altKey`면 넘기지 않고 `preventDefault`도 하지 않는다. `['Shift','Meta','Control','Alt','CapsLock']` 단독 키도 넘기지 않는다. 상점은 들어온 뒤 0.6초 동안 Enter를 받지 않거나, 손가락과 같게 「한 번 더 Enter」로(P-5와 같은 길).
- 검증: `test/`에서 `app.key` 경로 시험(가짜 keydown에 metaKey) 또는 smoke에 Cmd+1 · 막간 중 Shift 줄. `npm run smoke`.

### P-12 손가락으로 화면을 넘기면 다음 화면에 말풍선이 저절로 뜬다
- 심각도: 낮음   · 종류: 터치
- 어디: 결과 「새 판」 → 레퍼토리(draft), 손가락. `src/ui/app.js:243-255`(`app.go`), `src/ui/ui.js:49-55`
- 무엇: 손가락을 떼도 `ui.mouse`가 그 자리에 남고(탭하면 설명 방식), `app.go`는 `press` · `drag` · `previewId`만 비운다. 재료/ghostprobe.mjs: `result:again` 탭 → draft 화면에서 `hover draft:0`, 말풍선 1 · 낱말 상자 2가 누르지도 않은 카드에 떠 있다. 같은 자리 대국 → 상점 · 첫 화면 → 도감 등은 그 자리에 구역이 없어 괜찮았다.
- 고치는 방향: `app.go` · `openOverlay` · `closeOverlay`에서 `app.touch`이면 `app.ui.move(-1, -1)`.
- 검증: ghostprobe와 같은 순서를 `test/touch-snap.test.js`에 넣어 hover null. `node tools/touch-audit.mjs --only result,welcome`에서 tip · keys 잡음 줄이 줄어야 한다.

### P-13 표준 단추 높이가 손가락 판에서 21 CSS 화소이고, 이웃과 사이가 좁은 줄은 붙이기도 못 돕는다
- 심각도: 낮음   · 종류: 터치
- 어디: 아이폰 가로 꽉 채움(도트 하나 1.18 CSS 화소, 32 CSS 화소 = 27 도트). 재료/tapsize-touch.txt(손가락 판에서 넓힌 구역 기준)
- 무엇: `BTN_H` 18 도트 → 21.2 CSS 화소. 넓히지 않은 줄: 도감 · 기록 · 순위 · 계정 · 행마 탭(사이 4.7), `select:play` · `select:skip`(사이 4.7), `shop:reroll` · `shop:leave`(사이 1.2~2.4), 대국 묘수 칸 `tactic:#` 15×15 → 17.7×17.7(넓히기 없음, 사이 1.2), 판 칸 23.6 폭. 설정 줄은 이미 25.9로 넓혀 서로 닿아 있다. 빈 자리 붙이기(`UI.snap`)는 사이가 몇 화소뿐이라 거의 쓰이지 않는다. 묘수 · 판 칸은 미리 보기(두 번 누름)라 잘못 눌러도 되돌릴 수 있다.
- 고치는 방향: 탭 줄 · 관 선택 단추 줄 · 상점 위 단추 줄에 설정처럼 `grow`(위 · 아래로 이웃과 반씩, 바깥쪽은 P-2처럼 창 끝까지)를 준다. 묘수 칸은 `growHit`으로 손 이름표 줄 높이까지.
- 검증: 재료/tapsize-touch.mjs를 다시 돌려 해당 줄의 높이 ≥ 26 CSS 화소. `node tools/touch-audit.mjs` steal 0.

### P-14 홈 화면 앱을 망 없이 열면 아무것도 안 뜬다
- 심각도: 낮음   · 종류: 저장
- 어디: 아이폰 · 안드로이드 홈 화면 앱, 지하철 등. `manifest.webmanifest`, layout.md 10절 「버린 안: 서비스 워커」
- 무엇: 서비스 워커가 없어서 이미 받은 판본도 망이 없으면 다시 열리지 않는다. 게임은 켠 뒤에는 망 없이 돈다(순위 · 저장 맞추기는 조용히 실패). 버린 까닭은 「캐시 판을 손으로 올리다 잊으면 옛 코드가 남는다」였다. 지금은 `src/` · `style.css`가 `/v/<판본>/` 주소에 immutable로 나가니(vercel.json), 판본 이름이 곧 캐시 열쇠다.
- 고치는 방향(사용자 결정 필요 — 예전에 버린 안): `index.html`은 network-first(실패하면 캐시), `/v/<판본>/…` · `assets/`는 cache-first인 작은 워커. 판본은 html이 가리키는 주소가 바꾸니 손으로 올릴 값이 없다. 옛 `/v/` 캐시는 activate에서 지금 html이 가리키지 않는 것을 지운다.
- 검증: Playwright `context.setOffline(true)` 뒤 다시 열어 첫 화면이 그려지는지 보는 도구 한 줄. 실기기 비행기 모드에서 홈 화면 앱 열기(사람 확인).

### P-15 손가락 견주기 도구의 남은 다름은 대부분 도구 잡음이다
- 심각도: 낮음   · 종류: 터치
- 어디: `tools/touch-audit.mjs`
- 무엇: 이번 실행(재료/touch.txt, 「다름」 41줄)에서 따로 확인한 것:
  - `codex:center` · `codex:E` 「손가락 codex / 마우스 unlocks」: 따로 떼어 손가락으로 누르면 unlocks로 간다(재료/codexprobe.mjs). 앞 장면(result 등)이 기록(`unlockTier` · 본 칸)을 바꾸어 마우스 판과 손가락 판의 자물쇠 칸이 달라진 탓이다.
  - `result:unlocks` drift · near: 마우스 · 손가락 둘 다 탭 한 번에 unlocks로 간다(재료/resultprobe.mjs). 기대값을 잡는 차례 탓이다.
  - `welcome` · `result` · `lessons-end` · `reward` · `chest` · `awaken` · `legend`의 tip · keys 수: 화면을 넘긴 뒤 남은 가리킴(P-12) · 처음 안내 수 차이.
  - `select:play` near (154,207): 그 자리는 `select:board:0`(판 보기 말풍선) 구역 안이라 붙이기 문제가 아니다. `cons:2` near (387,238): `cons:0`까지 1 도트 · `cons:2`까지 2 도트라 붙이기 규칙대로다.
  진짜는 P-5 하나뿐이다. 잡음이 많으면 다음 사람이 진짜를 놓친다.
- 고치는 방향: `enter()`에서 설정뿐 아니라 `app.records`도 장면마다 처음 값(JSON 복사)으로 되돌린다. 비교 전 `ui.move(-1,-1)`로 가리킴을 비우고, 「다음 화면의 tip · keys」는 화면 이름이 같을 때만 견준다.
- 검증: `node tools/touch-audit.mjs` 전부 → 「다름」이 P-5(고친 뒤면 0)만 남아야 한다.

### P-16 마우스 · 오른쪽 누르기 · 휠의 작은 빈틈
- 심각도: 낮음   · 종류: 키보드
- 어디: 데스크톱. `src/main.js:274-278`
- 무엇: ① `mousemove`가 캔버스에만 있어 마우스가 캔버스 밖(여백 판)으로 나가도 마지막 가리킴 · 말풍선이 남는다. ② `contextmenu` 막기가 캔버스에만 있어 여백 판에서 오른쪽을 누르면 「이미지 저장」 메뉴가 뜬다. ③ 휠을 듣지 않는다. 도감 · 순위 · 기록 · 행마 보기의 쪽 넘기기를 휠 · 트랙패드로 할 수 없다(단추만).
- 고치는 방향: 캔버스 `mouseleave` → `app.pointer('move', -1, -1)`. `contextmenu` 막기를 `#stage`로 옮긴다. `wheel`(passive)을 받아 화면에 `wheel(dir)`가 있으면 부른다(도감 · 순위 · 기록 · 행마 쪽 넘기기, 쌓인 양 1번에 한 쪽).
- 검증: `npm run smoke`(smoke에 mouseleave · wheel 한 줄씩).

### P-17 창 크기를 끌어 바꾸면 굽은 그림 캐시가 배율마다 쌓인다(상한 안에서)
- 심각도: 낮음   · 종류: 성능
- 어디: 데스크톱 창 끌기, 폰 주소창이 오르내려 K가 3.53 ↔ 3.8로 오갈 때. `src/render/vec.js:67-77`, `src/render/pieces3.js:150-165`, `src/render/text.js`, `src/ui/app.js:90-97`
- 무엇: 캐시 열쇠에 배율 n이 들어 있어, n이 바뀌면 옛 n의 캔버스가 개수 상한(4000 · 3000)까지 남는다. 재료/memprobe.mjs(1470×956@2, 창 크기 25번 바꿈): 캔버스 159개 18MB → 895개 51MB에서 멈춘다. 새는 것은 아니지만 iOS 사파리 캔버스 메모리 한도를 생각하면 반을 버리는 셈이다.
- 고치는 방향: `app.setScale`에서 n이 바뀌면 `vec.js` `CACHE` · `pieces3.js` `CACHE` · `MASKS`를 비운다(글자 캐시는 화소 합 상한이 있어 그대로 둬도 된다).
- 검증: memprobe 같은 방식으로 크기를 25번 바꾼 뒤 캔버스 MB가 시작 값의 1.5배 안. `npm test`.

### P-18 여러 탭에서 열면 늦은 탭이 기록 · 판을 덮어쓴다
- 심각도: 낮음   · 종류: 저장
- 어디: 데스크톱 탭 두 개. `src/ui/app.js`(저장 경로 전부), `storage` 사건 듣기 없음
- 무엇: 탭마다 `app.records` · `app.run`을 메모리에 들고 통째로 쓴다. 옛 탭에서 설정 하나만 바꿔도 다른 탭이 쌓은 도감 · 해금 기록을 덮는다. 클라우드가 켜져 있으면 다음 409 합치기로 기록은 대부분 돌아오지만, 진행 중인 판과 클라우드 밖(로컬 · 열쇠 없음)은 잃는다. 코드만 읽고 판단했다.
- 고치는 방향: `window` `storage` 사건에서 `chainmate.records.v1`이 바뀌면 `mergeInto`로 합치고, `chainmate.run.v1`이 바뀌면 이 탭의 판을 「다른 창에서 이어 두는 중」으로 막고 다시 불러오기를 권한다.
- 검증: Playwright로 같은 문맥에 페이지 둘을 열어 한쪽 기록을 바꾼 뒤 다른 쪽 `app.records`에 합쳐졌는지 보는 도구 한 줄.

---

## 문제없이 지나간 것(확인만)
- 판을 둘 때 기기를 돌리기(734×343 ↔ 393×659 여섯 번 + orientationchange, WebKit): 예외 0, 연출이 끝까지 가고 화면 그대로(재료/rotprobe.mjs).
- 상점 떠나기 · 정석 고르기 처리 시간: 실제 WebKit 1~8ms(재료/leaveprobe.mjs). smoke가 적는 「누르기 처리 최대 357ms」는 가짜 DOM · 레이아웃 기록의 값이다.
- `node tools/smoke.mjs --window 734x343@3`: 예외 0, 프레임 p99 13.03ms · 최대 16.61ms(가짜 캔버스 — 실제 그리기 값은 아니다), 글 넘침 0, 잘린 글 1(허용). 마지막 SMOKE 줄은 출력을 잘라 보아 확인하지 못했다.
- 화면 맞춤 이상한 창: 400×300@2 꽉 채움 400×225(정수는 240×135로 작았다), 아이패드 세로 820×1180은 돌리지 않고 816×459(설계대로), 1280×720@1.5 · 1536×864@1.25는 K 4로 꽉 찬다.
- 저장소가 막혀도(`localStorage` 던짐) `main.js:19-20`이 저장 없이 돈다.
