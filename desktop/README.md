# 데스크톱 앱 (Tauri 2)

게임은 저장소 루트의 정적 파일 그대로다. 이 폴더는 그것을 맥 앱으로 감싸는 껍데기만 담는다.

- `collect.sh` — `index.html` · `style.css` · `manifest.webmanifest` · `src/` · `assets/`를 `desktop/dist/`로 모은다(docs · tools · test는 빼고). 빌드 · 개발 실행 전에 Tauri가 부른다.
- `src-tauri/` — Rust 껍데기(`main.rs`는 창 하나를 띄울 뿐), 창 · 번들 설정 `tauri.conf.json`, 아이콘 `icons/`.
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

서명이 없어서 다른 맥에서 처음 열면 Gatekeeper가 막는다(Finder에서 우클릭 → 열기).

## 알아 둘 것

- **창:** 기본 1440×842 · 최소 960×572. macOS 26에서는 제목 막대(32pt)가 webview 높이를 먹어서, 게임이 보는 크기가 1440×810(480×270의 3배) · 960×540(2배)이 되게 32를 더했다. 그 밖의 크기는 게임의 `fit.js`가 맞춘다.
- **저장:** 웹과 같은 localStorage. 앱에서는 `~/Library/WebKit/kr.papercut.chainmate/WebsiteData/`에 남아 껐다 켜도 이어진다. 개발 실행(`127.0.0.1:1430`)과 빌드한 앱(`tauri://localhost`)은 출처가 달라 저장을 나누지 않는다.
- **소리:** WebKit 자동 재생 정책대로 첫 누름 뒤에 소리가 난다(게임의 `audio.unlock()`).
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
