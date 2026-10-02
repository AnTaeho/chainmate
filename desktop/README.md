# 데스크톱 · iOS 앱 (Tauri 2)

게임은 저장소 루트의 정적 파일 그대로다. 이 폴더는 그것을 맥 앱과 iOS 앱으로 감싸는 껍데기만 담는다. iOS는 아래 「iOS」 절.

- `collect.sh` — `index.html` · `style.css` · `manifest.webmanifest` · `src/` · `assets/`를 `desktop/dist/`로 모은다(docs · tools · test는 빼고). 빌드 · 개발 실행 전에 Tauri가 부른다.
- `src-tauri/` — Rust 껍데기(`lib.rs`의 `run()`이 창 하나를 띄울 뿐, 맥은 `main.rs`가 부르고 iOS는 `mobile_entry_point`로 들어온다), 창 · 번들 설정 `tauri.conf.json`, 아이콘 `icons/`.
- `src-tauri/gen/apple/` — iOS Xcode 프로젝트(`cargo tauri ios init`이 만들고 손본 것, 커밋한다). 빌드 산출물(`build/` · `Externals/` · `assets/`)은 무시한다.
- `icon-1024.png` — 앱 아이콘 원본. `node tools/icons.mjs --desktop`이 PWA 아이콘과 같은 그림으로 굽는다.

## 준비

```sh
# Rust(rustup)와 Xcode 명령줄 도구가 있어야 한다
export PATH="$HOME/.cargo/bin:$PATH"
cargo install tauri-cli --version "^2" --locked
```

## 명령 (모두 `desktop/`에서)

```sh
cargo tauri dev                          # 개발 실행(dist를 모아 띄운다, http://127.0.0.1:1430)
cargo tauri build --bundles app,dmg      # 서명 없는 .app · .dmg
node ../tools/icons.mjs --desktop && cargo tauri icon icon-1024.png -o src-tauri/icons   # 아이콘을 다시 굽기
```

결과물:

- `src-tauri/target/release/bundle/macos/Chainmate.app`
- `src-tauri/target/release/bundle/dmg/Chainmate_<버전>_aarch64.dmg`

서명이 없어서 내려받은 .dmg로 다른 맥에서 열면 Gatekeeper가 막는다. macOS 15부터는 우클릭 → 열기로 넘어갈 수 없다. 시스템 설정 → 개인정보 보호 및 보안 → 「그래도 열기」를 누르거나, 「손상되었다」고 나오면 `xattr -dr com.apple.quarantine /Applications/Chainmate.app`.

## 알아 둘 것

- **창:** 기본 1440×842 · 최소 960×572. macOS 26에서는 제목 막대(32pt)가 webview 높이를 먹어서, 게임이 보는 크기가 1440×810(480×270의 3배) · 960×540(2배)이 되게 32를 더했다. 그 밖의 크기는 게임의 `fit.js`가 맞춘다.
- **저장:** 웹과 같은 localStorage. 앱에서는 `~/Library/WebKit/kr.papercut.chainmate/WebsiteData/`에 남아 껐다 켜도 이어진다. 개발 실행(`127.0.0.1:1430`)과 빌드한 앱(`tauri://localhost`)은 출처가 달라 저장을 나누지 않는다.
- **소리:** WebKit 자동 재생 정책대로 첫 누름 뒤에 소리가 난다(게임의 `audio.unlock()`).
- **기록 내보내기(CHM-50):** 설정 「기록 내보내기」의 Blob 다운로드가 앱에서도 받아진다 — 묻지 않고 `~/Downloads/chainmate-runs-*.json`에 떨어진다(2026-10-02 debug 빌드로 확인). `collect.sh`가 모은 사본의 `src/version.js`에 커밋 해시를 적어 기록의 앱 판에 남는다.
- **오프라인:** 외부 요청이 없다(글꼴은 `assets/fonts`).
- 웹 배포(Vercel)는 `.vercelignore`가 `desktop`을 빼서 그대로다.

## 2단계: 서명 · 공증

필요한 것:

1. **Developer ID Application 인증서** — Apple Developer Program(연 $99)에서 만들어 키체인에 넣는다. `security find-identity -v -p codesigning`으로 이름을 확인한다.
2. **공증 자격** — 둘 중 하나.
   - Apple ID + 앱 전용 암호: 환경 변수 `APPLE_ID` · `APPLE_PASSWORD` · `APPLE_TEAM_ID`
   - App Store Connect API 키: `APPLE_API_ISSUER` · `APPLE_API_KEY` · `APPLE_API_KEY_PATH`(.p8 파일)
3. **`src-tauri/tauri.conf.json`의 `bundle.macOS.signingIdentity`** — 지금 `null`인 자리에 인증서 이름(`"Developer ID Application: 이름 (TEAMID)"`)을 넣는다. 환경 변수 `APPLE_SIGNING_IDENTITY`로 줘도 된다.

자격이 갖춰지면 `cargo tauri build --bundles app,dmg`가 서명하고 공증까지 맡긴다. 스팀에 올릴 때는 유니버설 빌드(`--target universal-apple-darwin`, `rustup target add x86_64-apple-darwin`)도 생각한다.

## iOS

앱스토어에 먼저 낸다(CHM-53). 웹(아이폰 사파리)은 방향을 잠글 수 없어 세로 폰에서 게임을 돌려 그리지만, 앱은 Info.plist로 가로에 묶는다. 맥 앱과 같은 `src-tauri/`를 쓰고, iOS만의 설정은 `src-tauri/gen/apple/`에 있다.

### 준비물

```sh
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
# Xcode(시뮬레이터 런타임 포함), xcodegen · cocoapods(brew). init이 libimobiledevice를 brew로 깐다
```

### 명령 (모두 `desktop/`에서)

```sh
cargo tauri ios build --debug --target aarch64-sim --ci     # 시뮬레이터용 .app → src-tauri/gen/apple/build/arm64-sim/Chainmate.app
xcrun simctl boot <UDID>                                     # xcrun simctl list devices available
xcrun simctl install <UDID> src-tauri/gen/apple/build/arm64-sim/Chainmate.app
xcrun simctl launch <UDID> kr.papercut.chainmate
xcrun simctl io <UDID> screenshot --mask=black shot.png
cargo tauri ios dev "iPhone 17"                              # 개발 실행(기기 이름을 주지 않으면 물어보며 멈춘다, 이번에는 안 써 봤다)
cargo tauri icon icon-1024.png                               # iOS 아이콘도 굽는다(아래 「아이콘」)
```

시뮬레이터가 여러 대 켜져 있으면 `booted` 대신 UDID를 쓴다. 첫 빌드는 Rust 의존성까지 몇 분 걸린다.

### 손본 곳 (`src-tauri/gen/apple/`)

`project.yml`(xcodegen 원본)과 `chainmate_iOS/Info.plist`를 함께 고친다. Xcode 프로젝트는 `xcodegen generate`로 다시 만든다. **`cargo tauri ios init`을 다시 돌리면 아래가 모두 지워진다.**

- **가로만:** `UISupportedInterfaceOrientations`(아이폰) · `~ipad` 모두 `LandscapeLeft` · `LandscapeRight`. 아이패드를 가로로 묶으면 `UIRequiresFullScreen`이 있어야 앱스토어가 받는다(멀티태스킹 규칙).
- **장면 생명 주기:** `UIApplicationSceneManifest`(`UIApplicationSupportsMultipleScenes` false). 이것이 없으면 webview가 가로에서도 세로의 안전 영역(위 62 · 아래 34, `screen.orientation` portrait)을 받아 게임이 K 3(480×270pt)으로 작아졌다. 넣은 뒤 왼 · 오 62 · 아래 20, K 4(640×360pt).
- **상태 막대 숨김:** `UIStatusBarHidden` · `UIViewControllerBasedStatusBarAppearance` false(아이패드 가로에서도).
- **이름:** `CFBundleDisplayName` 체인메이트, 영어 기기는 `en.lproj/InfoPlist.strings`의 Chainmate. 번들 ID `kr.papercut.chainmate`, `CFBundleDevelopmentRegion` ko.
- **수출 규정:** `ITSAppUsesNonExemptEncryption` false(업로드마다 묻지 않게).
- **띄우는 화면:** `LaunchScreen.storyboard` 바탕을 게임 바탕 #0b1210으로.
- **아이콘:** `cargo tauri icon icon-1024.png`이 `Assets.xcassets/AppIcon.appiconset`을 채운다. 앱스토어는 알파 채널이 있는 아이콘을 받지 않아서, 구운 뒤 알파를 뺐다(CoreGraphics `noneSkipLast`로 다시 쓰기, `sips -g hasAlpha`로 확인). 같은 명령이 `icons/`에 윈도 · 안드로이드 아이콘도 떨구니 지운다. 그림은 꽉 찬 정사각형 그대로(모서리는 iOS가 깎는다).

### 시뮬레이터에서 본 것 (2026-10-02, iPhone 17 · iOS 26.5, `docs/shots/ios/`)

- 타이틀 · 대국 · 상점 · 설정이 가로로 뜬다. webview가 아일랜드 · 홈 막대 밑까지 칠하고 여백 판이 가장자리를 채운다. 게임 캔버스는 안전 영역 안이다(아일랜드 쪽 62pt, 양쪽 모두).
- 기기를 세로로 돌려도 앱은 가로로 남는다(`07-device-portrait.png`). 게임의 「세로 폰이면 돌려 그리기」는 창이 늘 가로라 켜지지 않는다(`__fit.rot` false).
- 터치: XCUITest 좌표 탭(실제 터치 입력)으로 「새 판」 · 설정 · 연출 속도 · 기록 내보내기를 눌렀다.
- 저장: 설정 연출 속도 ×2 → 앱을 끄고 다시 켜도 ×2(`06-settings-relaunched.png`). localStorage는 앱 컨테이너 `Library/WebKit/kr.papercut.chainmate/WebsiteData/`에 남는다. 출처는 `tauri://localhost`.
- 소리: 첫 탭 뒤 오디오가 준비된다(`audio.ready`). 귀로 듣는 확인은 사람 몫이다.
- **기록 내보내기는 iOS에서 버려진다:** Blob `<a download>`가 아무 파일도 남기지 않는데 화면은 「판 1개를 내보냈다」고 한다(`05-export.png`). `navigator.share`(공유 시트)가 webview에 있다. 웹 코드 쪽에서 앱 + iOS일 때 `navigator.share({ files: [new File(...)] })`로 보내야 한다.
- 처음 안내 「창이 작아 글이 작다」가 타이틀에 뜬다(도트 하나 4/3pt < 2). 폰에서는 늘 뜨는 조건이다.

화면을 몰아 본 도구(저장소 밖): `ios_webkit_debug_proxy`(brew)로 webview에 JS를 넣고, 빈 호스트 앱 + UI 시험 타깃 하나(xcodegen)로 `XCUIDevice.shared.orientation` · 좌표 탭을 했다. 시험 메서드 이름을 `testRun`으로 두면 XCTest의 `testRun` 속성과 겹쳐 아무것도 돌지 않는다. 명령은 `.xctestrun`의 `EnvironmentVariables`로 넘겼다(시험 러너는 호스트 파일을 못 읽고, 클립보드 읽기는 붙여넣기 허락 창에서 멈춘다).

### 2단계: 실기기

1. **인증서:** 키체인에 「Apple Development: an981022@naver.com (N9R6FD3ZCS)」가 있다. 이 인증서가 팀 2FCXA77MC5 소속인지 Xcode → Settings → Accounts에서 확인한다.
2. **자동 서명 팀:** `tauri.conf.json`에 `"bundle": { "iOS": { "developmentTeam": "2FCXA77MC5" } }`(또는 환경 변수 `APPLE_DEVELOPMENT_TEAM`). 넣은 뒤 `cargo tauri ios init`을 다시 돌리지 말고 `project.yml`의 `DEVELOPMENT_TEAM`도 같은 값으로 두고 `xcodegen generate`.
3. **기기:** 아이폰을 USB로 잇고 「이 컴퓨터를 신뢰」, 설정 → 개인정보 보호 및 보안 → 개발자 모드 켜기. 자동 서명이 기기를 개발자 계정에 등록한다(Xcode가 이미 「안태호의 iPhone」을 본다).
4. `cargo tauri ios dev "안태호의 iPhone"` 또는 `cargo tauri ios build --debug` 뒤 Xcode(`--open`)로 설치.
5. **볼 것:** 무음 스위치. WKWebView 소리는 기본이 「주변 소리」라 무음 스위치를 켜면 게임 소리가 꺼진다. 게임 소리를 무음 스위치와 상관없이 내려면 네이티브에서 `AVAudioSession` 범주를 `playback`으로 둬야 한다(플러그인이나 `main.mm` — `main.mm`은 init이 다시 만든다). 실제 아일랜드 · 홈 막대 · 120Hz에서의 움직임, 손가락 끌기도 본다.

### 3단계: 앱스토어

1. **App ID · 앱 등록:** Developer 포털 Identifiers에 `kr.papercut.chainmate`, App Store Connect에 새 앱(이름 체인메이트 / Chainmate, 기본 언어 한국어, SKU 아무거나).
2. **배포 서명:** 「Apple Distribution: Taeho An (2FCXA77MC5)」가 있다. App Store 배포 프로필은 자동 서명이 만들거나 포털에서 만든다.
3. **빌드 · 올리기:** `cargo tauri ios build --export-method app-store-connect --build-number <N>` → `src-tauri/gen/apple/build/arm64/Chainmate.ipa`. Transporter 앱이나 `xcrun altool --upload-app`(App Store Connect API 키)로 올린다. 올릴 때마다 빌드 번호를 올린다.
4. **스크린샷:** 아이폰 6.9형 2868×1320(가로, iPhone 17 Pro Max 시뮬레이터) 필수. 아이패드도 받으므로 13형 2752×2064(iPad Pro 13 시뮬레이터)도 필수다. 아이패드를 빼려면 `TARGETED_DEVICE_FAMILY`를 1로.
5. **개인정보:** 앱 개인정보 「데이터 수집 안 함」(기록은 기기 안에만, 외부 요청 없음). 개인정보 처리방침 URL은 수집이 없어도 요구된다. 업로드 때 개인정보 매니페스트(`PrivacyInfo.xcprivacy`) 경고가 오면 그때 넣는다.
6. **연령 등급:** 설문에 모두 「없음」이면 4+.
7. **수출 규정:** Info.plist에 넣어 두었다(암호화 없음).
