// 체인메이트 데스크톱 포장: 창 하나를 띄우는 일은 lib.rs의 run()이 한다(iOS 앱과 같은 것).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chainmate_lib::run();
}
