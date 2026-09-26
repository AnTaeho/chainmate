# 데스크톱 포장 준비(Tauri)

실제 설치는 하지 않았다. 게임은 빌드 없는 정적 파일(`index.html` · `style.css` · `src/` · `assets/`)이라 어떤 웹뷰 포장에도 그대로 들어간다. 아래는 Tauri 2로 감쌀 때의 절차와 정해 둘 것.

## 왜 Tauri
- 결과물이 작다(수 MB, 시스템 웹뷰 사용). Electron은 크롬을 통째로 싣는다(100MB+).
- 우리 쪽 코드는 순수 브라우저 JS라 Rust 쪽은 창 설정뿐이다.
- 걱정: 운영체제마다 웹뷰가 다르다(Windows WebView2 · macOS WKWebView · Linux WebKitGTK). WebAudio · `image-rendering: pixelated` · `document.fonts`는 셋 다 된다. 리눅스 WebKitGTK의 WebAudio 지연은 사람 귀로 한 번 들어 봐야 한다.

## 절차
1. 도구: Rust(stable) + Node. `npm create tauri-app@latest`는 쓰지 않고 기존 저장소에 붙인다.
2. `npx -y @tauri-apps/cli@2 init` — 물음에:
   - 앱 이름 `chainmate`, 창 제목 `체인메이트`
   - web assets 위치: `..`(저장소 뿌리. 빌드 단계 없음)
   - dev server URL: `http://localhost:8000`(`npm run serve`), 빌드/개발 명령은 비워 둔다
3. `src-tauri/tauri.conf.json`:
   ```json
   {
     "app": { "windows": [{ "title": "체인메이트", "width": 1440, "height": 810, "minWidth": 480, "minHeight": 270, "resizable": true, "fullscreen": false }] },
     "bundle": { "identifier": "com.chainmate.game", "icon": ["icons/icon.png"] },
     "build": { "frontendDist": "..", "devUrl": "http://localhost:8000" }
   }
   ```
   `frontendDist`에 저장소 전체가 실리지 않게 `.taurignore`(또는 따로 `dist/`로 복사하는 한 줄 스크립트)로 `docs/ · test/ · tools/ · node_modules/`를 뺀다.
4. `npx -y @tauri-apps/cli@2 dev`로 띄워 본다 → `npx -y @tauri-apps/cli@2 build`.

## 창 크기
- 기본 1440×810(= 480×270 ×3). 최소 480×270. `src/main.js`의 `fit()`이 장치 화소 기준 정수배로 맞추고 남는 곳은 레터박스라 창 크기를 자유로 둬도 된다.
- 전체 화면: F11(또는 설정 화면에 단추) → Tauri `window.setFullscreen`. 지금 게임 코드에는 없다(웹에서는 브라우저가 한다).

## 저장 위치
- 지금은 `localStorage`(키 `chainmate.run.v1` · `chainmate.settings.v1` · `chainmate.records.v1`, `src/ui/save.js`). Tauri 웹뷰의 localStorage는 앱 데이터 폴더 안에 남는다:
  - Windows `%APPDATA%\com.chainmate.game\`
  - macOS `~/Library/Application Support/com.chainmate.game/`
  - Linux `~/.local/share/com.chainmate.game/`
- 웹뷰 저장소는 지워지기 쉽다(캐시 정리). 판 기록 · 해금이 남아야 하므로 포장판은 `@tauri-apps/plugin-store`(JSON 파일)로 옮기는 편이 낫다: `makeStore(storage)`가 `getItem · setItem · removeItem` 세 개만 쓰니 같은 꼴의 감싸개 하나면 된다(동기 API라 시작할 때 한 번 읽어 메모리에 두고, 쓸 때 비동기로 흘려보낸다).
- Steam 클라우드 저장은 이 파일 하나(`records` + `run` + `settings`)를 동기화 대상으로 걸면 된다.

## 남은 것(포장 전에)
- 아이콘: 기물 스프라이트(나이트 16×22)를 256·512로 정수배 확대한 PNG. 코드로 뽑는 도구가 필요(`tools/shots.mjs` 방식으로).
- 소리 시작: 웹은 첫 누르기 뒤에만 소리를 켠다(`src/audio/audio.js unlock`). 데스크톱 웹뷰도 대개 같은 규칙이라 그대로 둔다.
- 오른쪽 누르기 메뉴는 이미 막았다(`contextmenu`). 새로 고침 키(F5 · Ctrl+R)는 Tauri에서 막아 둘 것(판은 명령마다 저장되니 잃는 것은 없다).
