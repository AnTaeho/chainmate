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
// 간격 자(layout.md 29절): 2 · 4 · 8 · 12 · 16 · 24 여섯 단만 쓴다(테 1 빼고)
export const SP = { xs: 2, s: 4, m: 8, l: 12, xl: 16, xxl: 24 };
export const BTN_H = 18;                     // 단추 높이 하나(첫 화면 큰 단추 · 수업 「시작」만 BTN_HERO)
export const BTN_HERO = 26;
export const BTN_MIN = 64;                   // 글에 맞춘 단추의 가장 좁은 폭
export const BTN_PAD = SP.l;                 // 글에 맞춘 단추의 글 양옆 여백
// 판 밖 틀: 제목(12, 4) · 「뒤로」(12, 244) 폭 80 · 주 단추 오른쪽 끝(W − 12 − 폭)
export const PAGE = { titleX: SP.l, titleY: 8, ruleY: 25, bodyY: 32, btnY: 244, btnH: BTN_H, backW: 80, gap: SP.m };

// ── 글 간격 토큰(docs/design-notes/layout.md 「격자와 여백」): 이름 하나가 뜻 하나, 값도 하나다.
//   PAD_BOX     상자(판넬 · 말풍선 · 낱말 상자 · 처음 안내 · 풀이 칸 · 막간 상자) 안 여백
//   PAD_CARD    카드(물건 · 정석 · 관 · 격언 칸 · 두루마리 · 꾸러미 칸) 안 여백
//   LINE        본문 줄 높이(윗줄 윗변 → 아랫줄 윗변). 글자(12)는 줄 가운데
//   LINE_TITLE  제목 줄 높이(카드 이름 · 화면 이름 · 말풍선 제목). 글자는 줄 가운데
//   GAP_IN      한 묶음 안(머릿말 → 제목)에 더하는 틈
//   GAP_GROUP   묶음과 묶음 사이 틈(제목 묶음 → 본문 → 칩 줄, 판넬과 판넬 사이, 카드 줄 → 단추)
// 상자는 내용에 맞춘다(hug): 높이 = 안 여백 × 2 + 줄 높이의 합 + 묶음 틈. 그리는 쪽과 재는 쪽이 같은 흐름(flow)을 쓴다.
// 그리는 쪽은 그릴 때마다 여기서 읽는다(미리 계산해 두지 않는다 — 시안 applySpacing이 값을 바꾼다).
export let PAD_BOX = 8;
export let PAD_CARD = 7;                  // 29절 예외: 8이면 상점 진열 카드 · 관 선택 · 전설 · 하이라이트 띠가 넘친다(화면 단계에서 8로)
export let LINE = 14;
export let LINE_TITLE = 18;
export let GAP_IN = 4;
export let GAP_GROUP = 8;
export const FONT_H = 12;                    // 글꼴 크기(논리 12px — src/render/type.js)
import { INK_H } from '../render/type.js';
export { INK_H };                            // 글자 띠: text()의 y부터 11줄(한글 · 숫자 · 대문자의 잉크가 이 가운데에). g j p q y , 는 2줄 더 내려간다
// 줄 윗변 top, 줄 높이 lh일 때 text()에 넘길 y: 잉크(11)가 줄 가운데에 온다(본문 줄 위 1 · 아래 2, 제목 줄 위 3 · 아래 4)
export const textY = (top, lh = LINE) => top + ((lh - INK_H) >> 1);
// 테가 있는 작은 칸(단추 · 칩 · 작은 표) 높이 h 안에서 글 y: 잉크가 가운데(남는 줄이 홀수면 아래가 한 줄 더)
export const inkY = (top, h) => top + ((h - INK_H) >> 1);

// 흐름: 위에서 아래로 줄 · 묶음을 쌓는 자(재기와 그리기가 같이 쓴다). y는 다음 줄 윗변.
//   line(title) → 그 줄의 text y를 돌려주고 줄 높이만큼 내려간다. gap(g)은 첫 줄 앞에서는 무시한다.
export function flow(y0 = 0) {
  const f = {
    y: y0, top: y0, started: false,
    gap(g) { if (f.started) f.y += g; return f; },
    line(title = false) { const lh = title ? LINE_TITLE : LINE; const ty = textY(f.y, lh); f.y += lh; f.started = true; return ty; },
    lines(n, title = false) { const out = []; for (let i = 0; i < n; i++) out.push(f.line(title)); return out; },
    space(h) { const t = f.y; f.y += h; f.started = true; return t; },
    get h() { return f.y - f.top; },
  };
  return f;
}
// 줄 하나의 [윗변, 아랫변](text y와 줄 높이로) — 설명 자리 접기(fold.js)가 판넬 안 줄을 가린다
export const rowSpan = (ty, lh = LINE) => { const top = ty - ((lh - INK_H) >> 1); return [top, top + lh]; };
// 한 줄 상자(판넬 한 줄 · 격언 칸): 높이
export const rowBoxH = (pad = PAD_BOX, lines = 1) => pad * 2 + lines * LINE;

// 토큰이 아닌 칸 크기(글 간격과 따로 움직이지 않는 것)
// 작은 칸의 안 여백(글과 테 사이 EDGE_PAD 이상 — 연기 시험 「안 여백 검사」 src/render/layoutlog.js EDGE_CLEAR와 같다):
//   칠한 칩 = 2 + 잉크 11 + 2 = 15, 테 두른 칩 = 1 + 2 + 11 + 2 + 1 = 17.
//   단추는 아래로 빠지는 글자(영어 Skip · Swap)가 아래 테에 닿지 않게 한 줄 더: 18(작은 단추도 같다)
export const EDGE_PAD = 2;                   // 작은 칸(칩 · 단추 · 작은 표) 안 여백: 글과 테(칠한 바탕 끝) 사이
export const CHIP_H = 15;                    // 시너지 칩(카드 · 말풍선 — 칠한 바탕, 테 없음)
export const CHIP_ROW = 17;                  // 시너지 칩 줄(칩 15 + 2)
export const CHIP_PAD = 3;                   // 칩(시너지 칩 · 띠 · 왼쪽 칸 시너지 줄) 안 가로 여백 — 폭은 글에 맞춘다
export const FAM_H = 17;                     // 테 두른 시너지 칩(대국 띠 · 왼쪽 칸 시너지 세로 줄)
export const FAM_ROW = 19;                   // 왼쪽 칸 시너지 세로 줄(칩 17 + 2)
export const BTN_S = BTN_H;                  // 옛 이름(작은 단추) — BTN_H와 같다
export const ART_H = 26;                     // 물건 카드 그림 칸 높이
export const LIST_GAP = 2;                   // 세로로 잇는 같은 칸(격언 칸 · 두루마리 칸) 사이

// ── 시안: 글 간격 토큰 덮어쓰기(화면 모습만 — 저장 · 규칙과 상관없다). 상자가 내용에 맞추므로 상자 크기도 따라 바뀐다.
//   「pad8,card7,line14,title18,in4,group8」 꼴: pad PAD_BOX · card PAD_CARD · line LINE · title LINE_TITLE · in GAP_IN · group GAP_GROUP.
//   브라우저는 주소 ?spacing=…, 연기 시험 · 도구는 globalThis.__SPACING(모듈을 부르기 전에).
export function applySpacing(spec) {
  for (const part of String(spec).split(',').map((q) => q.trim()).filter(Boolean)) {
    const m = part.match(/^([a-z]+)(-?\d+)$/);
    const v = m ? Number(m[2]) : NaN;
    if (!m) throw new Error(`글 간격 시안을 읽지 못했다: ${part}`);
    if (m[1] === 'pad') PAD_BOX = v;
    else if (m[1] === 'card') PAD_CARD = v;
    else if (m[1] === 'line') LINE = v;
    else if (m[1] === 'title') LINE_TITLE = v;
    else if (m[1] === 'in') GAP_IN = v;
    else if (m[1] === 'group') GAP_GROUP = v;
    else throw new Error(`글 간격 시안을 읽지 못했다: ${part}`);
  }
}
const spacingSpec = globalThis.__SPACING ?? (typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('spacing') : null);
if (spacingSpec) applySpacing(spacingSpec);
