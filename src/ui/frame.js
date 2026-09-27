// 틀과 여백 수치(docs/design-notes/layout.md 「틀 셋」 · 「격자와 여백」). 모든 화면이 여기 값을 쓴다.
// 판 틀: 왼쪽 칸(정보 · 설명 자리, 누를 것 없음) + 본 칸 + (오른쪽 칸). 판 밖 틀: 머리줄 + 본 칸 + 맨 아래 단추 줄.
export const M = 8;                          // 바깥 여백
export const GAP = 8;                        // 칸 사이
export const LEFT = { x: 8, w: 112 };        // 왼쪽 칸(8 ~ 120)
export const MAIN = { x: 128, w: 344 };      // 본 칸(오른쪽 칸이 없는 화면: 128 ~ 472)
export const CENTER = { x: 128, w: 224 };    // 본 칸(오른쪽 칸이 있는 화면: 128 ~ 352 — 대국 판 · 상점)
export const RIGHT = { x: 360, w: 112 };     // 오른쪽 칸(360 ~ 472)
export const TOP = 22;                       // 판 틀의 본 칸 · 오른쪽 칸 윗변(오른쪽 위 멈춤 단추 아래)
export const PAUSE = { x: 460, y: 5 };       // 멈춤 단추(모든 화면 같은 자리)
export const CARD = { w: 108, gap: 10 };     // 판 틀 카드 줄(셋이면 128 · 246 · 364)
export const cardX = (i) => MAIN.x + i * (CARD.w + CARD.gap);
// 왼쪽 칸 안의 칸(윗변): 머리 · 짜임 · 상금 · 주머니. 대국은 머리 칸이 넷째 줄까지(8 ~ 66)
export const SIDE_ROWS = { head: 8, headH: 32, build: 44, buildEnd: 208, money: 212, bag: 240, rowH: 22 };
export const SHARD_TO = { x: 52, y: 220 };  // 명국 조각이 날아드는 곳(상금 칸 안 조각 줄)
// 판 밖 틀
export const PAGE = { titleX: 12, titleY: 8, ruleY: 25, bodyY: 32, btnY: 244, btnH: 18 };
export const ROW = 13;                       // 판넬 · 말풍선 글 한 줄
export const CARD_ROW = 12;                  // 카드 효과 글 한 줄
export const BTN_H = 18;                     // 보통 단추 높이(판넬 안 작은 단추 16)
