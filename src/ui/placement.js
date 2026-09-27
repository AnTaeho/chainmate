// 설명 자리: 말풍선 · 낱말 상자 · 처음 안내가 어디에 뜨는지 한 곳에서 정한다(docs/design-notes/layout.md 「설명 자리 규칙」).
// 화면은 「이 화면은 어느 규칙인지」(screen.notes)만 넘긴다.
//   'side'  판 틀(관 선택 · 정석 · 대국 · 수업 · 상점 · 꾸러미): 고정 설명 자리 = 왼쪽 칸(x 6 · 폭 116).
//           윗변은 가리킨 것의 윗변 높이. 왼쪽 칸 안의 것을 가리키면 그 바로 아래(모자라면 바로 위).
//   'below' 판 밖 틀 · 막간: 가리킨 것 바로 아래(왼끝 맞춤, 넘치면 오른끝 맞춤). 모자라거나 누를 것을 덮으면 바로 위.
// 설명 묶음 = 말풍선 → 낱말 상자, 같은 폭 · 2px 틈의 세로 한 줄. 다 안 들어가면 뒤의 것부터 뺀다.
// 기하만 다룬다(그리기 · 글 줄바꿈은 ui.js · glossary.js). DOM 없음.
import { LEFT } from './frame.js';

export const NOTE_W = 176;               // 판 밖 틀의 묶음 폭
export const SIDE_X = LEFT.x - 2, SIDE_W = LEFT.w + 4; // 판 틀: 왼쪽 칸 위(6 · 116)
export const NOTE_GAP = 2;                // 묶음 안 틈
export const NOTE_OFF = 3;                // 가리킨 것과의 틈
const EDGE = 2;                           // 화면 가장자리 여백

export const noteMode = (screen) => (screen && screen.notes) || 'below';
export const noteWidth = (mode) => (mode === 'side' ? SIDE_W : NOTE_W);
// 왼쪽 칸 안의 것인가(판 틀)
export const inSide = (r) => r.x + r.w <= LEFT.x + LEFT.w + 4;

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const sum = (hs, n) => hs.slice(0, n).reduce((u, v) => u + v, 0) + NOTE_GAP * Math.max(0, n - 1);

// 묶음 자리. hs: 묶음 안 네모들의 높이(차례대로, noteWidth(mode) 폭으로 잰 것).
// avoid: 덮으면 안 되는 네모(누를 수 있는 구역 — 'below'에서 위로 뒤집는 데 쓴다).
// 돌려주는 값: { x, y, w, n, side } — n은 들어간 네모 수, side는 가리킨 것에서 본 쪽('right' 왼쪽 칸 · 'below' · 'above').
export function placeNotes(mode, anchor, hs, { W = 480, H = 270, avoid = [] } = {}) {
  if (!hs.length) return null;
  const w = noteWidth(mode);
  if (mode === 'side') {
    const x = SIDE_X;
    for (let n = hs.length; n >= 1; n--) {
      const total = sum(hs, n);
      if (inSide(anchor)) {
        const below = anchor.y + anchor.h + NOTE_OFF;
        if (below + total <= H - EDGE) return { x, y: below, w, n, side: 'below' };
        const above = anchor.y - NOTE_OFF - total;
        if (above >= EDGE) return { x, y: above, w, n, side: 'above' };
        continue;
      }
      if (total > H - EDGE * 2) continue;
      return { x, y: Math.max(EDGE, Math.min(H - EDGE - total, anchor.y)), w, n, side: 'right' };
    }
    // 왼쪽 칸 안의 것인데 말풍선 하나가 위 · 아래 어디에도 안 들어가면(영어의 긴 시너지 풀이): 넓은 쪽으로 화면 끝까지 당긴다.
    // 가리킨 것을 덮지만 설명이 안 뜨는 것보다 낫다(squeezed — 연기 시험이 따로 센다)
    const h0 = Math.min(hs[0], H - EDGE * 2);
    const roomBelow = H - EDGE - (anchor.y + anchor.h + NOTE_OFF), roomAbove = anchor.y - NOTE_OFF - EDGE;
    return { x, y: roomBelow >= roomAbove ? H - EDGE - h0 : EDGE, w, n: 1, side: roomBelow >= roomAbove ? 'below' : 'above', squeezed: true };
  }
  let x = anchor.x;
  if (x + w > W - EDGE) x = anchor.x + anchor.w - w;
  x = Math.max(EDGE, Math.min(W - EDGE - w, x));
  const clear = (r) => !avoid.some((a) => overlaps(r, a));
  for (let n = hs.length; n >= 1; n--) {
    const total = sum(hs, n);
    const below = anchor.y + anchor.h + NOTE_OFF;
    if (below + total <= H - EDGE && clear({ x, y: below, w, h: total })) return { x, y: below, w, n, side: 'below' };
    const above = anchor.y - NOTE_OFF - total;
    if (above >= EDGE && clear({ x, y: above, w, h: total })) return { x, y: above, w, n, side: 'above' };
  }
  // 어디에도 깨끗이 안 들어가면: 첫 네모만, 아래 · 위 중 넓은 쪽(화면 안으로 당긴다)
  const h0 = hs[0];
  const roomBelow = H - EDGE - (anchor.y + anchor.h + NOTE_OFF), roomAbove = anchor.y - NOTE_OFF - EDGE;
  const y = roomBelow >= roomAbove ? Math.min(H - EDGE - h0, anchor.y + anchor.h + NOTE_OFF) : Math.max(EDGE, anchor.y - NOTE_OFF - h0);
  return { x, y, w, n: 1, side: roomBelow >= roomAbove ? 'below' : 'above' };
}

// 처음 안내 말풍선 자리: 묶음과 같은 규칙(네모 하나). arrow는 화살표가 나가는 변('right' · 'up' · 'down' · null)
export function placeBubble(mode, anchor, h, opts = {}) {
  if (!anchor) { const w = noteWidth(mode); return { x: Math.floor(((opts.W || 480) - w) / 2), y: 110, w, arrow: null }; }
  const p = placeNotes(mode, anchor, [h], opts);
  const arrow = p.side === 'right' ? 'right' : p.side === 'below' ? 'up' : 'down';
  return { x: p.x, y: p.y, w: p.w, arrow };
}
