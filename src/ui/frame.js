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
// 왼쪽 칸 안의 칸(윗변): 머리 · 상금 · 주머니. 짜임 칸은 그 사이(판넬 사이 틈 GAP_GROUP.side — common.js buildBox).
// 대국은 머리 칸이 넷째 줄까지(headH 58), 그 아래 점수 · 값 × 배수 · 사슬 · 수 칸을 판넬 사이 틈으로 잇는다(battle.js drawLeft)
export const SIDE_ROWS = { head: 8, headH: 32, battleHeadH: 58, money: 212, bag: 240, rowH: 22 };
export const SHARD_TO = { x: 52, y: 220 };  // 명국 조각이 날아드는 곳(상금 칸 안 조각 줄)
// 판 밖 틀
export const PAGE = { titleX: 12, titleY: 8, ruleY: 25, bodyY: 32, btnY: 244, btnH: 18 };
export const BTN_H = 18;                     // 보통 단추 높이(판넬 안 작은 단추 16)

// ── 글 간격 토큰: 상자와 글 사이, 줄과 줄 사이, 묶음과 묶음 사이. 이름 하나가 뜻 하나다.
//   PAD_BOX     상자(판넬 · 말풍선 · 낱말 상자 · 처음 안내 · 풀이 칸) 안 여백
//   PAD_CARD    카드(물건 · 정석 · 관 · 격언 칸 · 두루마리) 안 여백
//   LINE        본문 줄 간격(윗줄 윗변 → 아랫줄 윗변). body 판넬 · 말풍선 · 상자, card 카드 효과 글
//   LINE_TITLE  제목 줄(제목 · 이름표 윗변 → 그 아래 첫 줄 윗변, GAP_IN 빼고)
//   GAP_IN      한 묶음 안(머릿말 → 제목, 제목 → 본문)에 더하는 틈
//   GAP_GROUP   묶음과 묶음 사이 틈(본문 → 칩 줄, 카드의 이름 묶음 → 효과 묶음, 왼쪽 칸 판넬 사이)
// 값은 자리마다 적는다: 지금 화면은 자리마다 조금씩 다른 값을 써 왔고(말풍선 여백 5 · 판넬 6 …), 표의 값이 그 모습 그대로다.
// 시안(applySpacing)은 이름 하나의 모든 자리를 한 값으로 맞춘다. 그리는 쪽은 그릴 때마다 여기서 읽는다(미리 계산해 두지 않는다).
// 고정 크기 칸(카드 높이 · 대국 왼쪽 칸 · 격언 칸 · 판)은 그대로 두고 그 안의 글 자리만 토큰을 따른다.
export const PAD_BOX = {
  panel: 6,      // 판넬 글 x(왼쪽 칸 · 새기기 미리 보기 · 수업 「할 일」)
  top: 3,        // 판넬 첫 줄 위(머리 칸 · 사슬 칸)
  build: 4,      // 짜임 칸(시너지 · 정석) 위 · 아래
  pips: 1,       // 수 · 버리기 칸 첫 줄 위
  target: 4,     // 새기기 미리 보기 첫 줄 위
  lesson: 4,     // 수업 「할 일」 칸 위 · 아래
  preview: 8,    // 먹으면 칸(대국 오른쪽) 글 x
  previewTop: 4, // 먹으면 칸 첫 줄 위
  pack: 3,       // 상점 꾸러미 칸 첫 줄 위
  tip: 5,        // 말풍선 네 변
  key: 5,        // 낱말 상자 글 x
  keyTop: 2,     // 낱말 상자 낱말 위
  keyEnd: 3,     // 낱말 상자 마지막 줄 아래
  coach: 6,      // 처음 안내 글 x
  coachTop: 4,   // 처음 안내 위 · 아래
  terms: 8,      // 낱말 풀이 화면 글 x
  termsTop: 6,   // 낱말 풀이 화면 첫 줄 위
  lessons: 6,    // 수업 목록 칸 묶음 이름 위
};
export const PAD_CARD = {
  item: 5,       // 물건 카드 글 x(왼쪽)
  itemTop: 4,    // 물건 카드 종류 위
  itemRight: 4,  // 물건 카드 이름 오른쪽
  itemBottom: 2, // 물건 카드 값 · 칩 아래
  joseki: 6,     // 정석 카드 네 변(위는 josekiTop)
  josekiTop: 4,
  blind: 6,      // 관 선택 카드 글 x
  blindTop: 5,
  maxim: 6,      // 격언 칸 글 x
  maximTop: 3,
  scroll: 2,     // 두루마리 칸(넓은 칸) 이름 위
};
export const LINE = {
  body: 13,      // 판넬 · 말풍선 · 상자 · 처음 안내 · 풀이 · 카드 이름 두 줄
  card: 12,      // 카드 효과 글 · 꾸러미 칸 · 두루마리 칸 둘째 줄
};
export const LINE_TITLE = {
  tip: 14,       // 말풍선 제목
  key: 14,       // 낱말 상자 낱말
  label: 14,     // 이름표(「시너지」 · 「정석」 · 「건너뛰면」) → 목록
  head: 13,      // 대국 머리 칸 화면 이름 → 목표
  blind: 14,     // 관 선택 카드 종류(「연습 대국」) → 목표
  lesson: 16,    // 수업 「할 일」 → 글
  lessons: 14,   // 수업 목록 묶음 이름 → 단추
  pack: 13,      // 꾸러미 칸 이름 → 속
  target: 17,    // 새기기 미리 보기 이름 → 효과
};
export const GAP_IN = {
  tip: 0, key: 0, label: 0, blind: 5, lesson: 0, lessons: 0, pack: 0, target: 0,
  head: 0,       // 머리 칸 관(머릿말) → 화면 이름
  head2: 0,      // 대국 머리 칸 화면 이름 → 목표
  item: 0,       // 물건 카드 종류(머릿말) → 이름
  joseki: 0,     // 정석 카드 등급(머릿말) → 이름
};
export const GAP_GROUP = {
  tip: 0,        // 말풍선 본문 → 칩 줄
  tipDiag: 3,    // 말풍선 행마 그림 → 글
  card: 6,       // 물건 카드 이름 묶음 → 효과 묶음(가로줄은 그 가운데)
  joseki: 5,     // 정석 카드 이름 묶음 → 효과 묶음
  blind: 8,      // 관 선택 카드 목표 · 보상 → 아래 묶음
  blindMaster: 6,// 관 선택 명인 초상 · 이름 → 명인 글
  side: 4,       // 왼쪽 칸 판넬 사이
  build: 4,      // 짜임 칸 안 시너지 → 정석
  terms: 5,      // 낱말 풀이 낱말 사이
  lessons: 6,    // 수업 목록 묶음 이름 → 단추
};
// 토큰이 아닌 칸 크기(글 간격과 따로 움직이지 않는 것)
export const CHIP_ROW = 13;                  // 시너지 칩 줄(칩 11 + 2)
export const FAM_ROW = 15;                   // 왼쪽 칸 시너지 세로 줄(칩 13 + 2)
export const ROW_TEXT = 5;                   // 한 줄 판넬(높이 22 · 24) 안 글 높이 — 가운데에 둔다
export const ART_H = 26;                     // 물건 카드 그림 칸 높이

// ── 시안: 글 간격 토큰 덮어쓰기(화면 모습만 — 저장 · 규칙과 상관없다).
//   「pad8,card7,line14,title18,in3,group8」 꼴: pad PAD_BOX · card PAD_CARD · line LINE · title LINE_TITLE · in GAP_IN · group GAP_GROUP.
//   이름 하나의 모든 자리를 그 값으로 맞춘다. 브라우저는 주소 ?spacing=…, 연기 시험 · 도구는 globalThis.__SPACING(모듈을 부르기 전에).
const SPACING_KEYS = { pad: PAD_BOX, card: PAD_CARD, line: LINE, title: LINE_TITLE, in: GAP_IN, group: GAP_GROUP };
export function applySpacing(spec) {
  for (const part of String(spec).split(',').map((q) => q.trim()).filter(Boolean)) {
    const m = part.match(/^([a-z]+)(-?\d+)$/);
    if (!m || !SPACING_KEYS[m[1]]) throw new Error(`글 간격 시안을 읽지 못했다: ${part}`);
    const t = SPACING_KEYS[m[1]];
    for (const k of Object.keys(t)) t[k] = Number(m[2]);
  }
}
const spacingSpec = globalThis.__SPACING ?? (typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('spacing') : null);
if (spacingSpec) applySpacing(spacingSpec);
