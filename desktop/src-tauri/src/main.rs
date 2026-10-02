// 체인메이트 데스크톱 포장: 저장소 루트의 정적 게임(desktop/dist로 모은 것)을 창 하나에 띄운다.
// 게임 코드는 건드리지 않는다. 저장은 webview의 localStorage(앱 데이터 폴더)에 남는다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("체인메이트 창을 열지 못했다");
}
