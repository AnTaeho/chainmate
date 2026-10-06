// 그림 칸의 잉크 상자(CHM-69, docs/design-notes/layout.md 「종류 표시」): 글자 줄 마스크에서 바로 잰다 — DOM 없이 Node에서 돈다.
// 그림은 칸 가운데가 아니라 잉크(빈칸이 아닌 도트)의 상자가 칸 가운데에 오게 놓는다.
export const ART = { w: 22, h: 26 };             // 그림 칸(진화만 폭 두 배)
export const TARGET = { w: [14, 18], h: [16, 20] }; // 잉크 크기 과녁(논리 칸)
export const GLYPH = 10;                          // 종류 문양 잉크 한 변(딱지 14 안)

// 마스크의 잉크 상자({ x, y, w, h } — 마스크 도트 단위). 빈 마스크는 null
export function inkBox(rows, blank = '.') {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== blank) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// 칸(cw × ch) 안에서 잉크 상자 b가 가운데 오도록 마스크 원점을 둘 자리
export const centre = (cw, ch, b) => ({ x: Math.floor((cw - b.w) / 2) - b.x, y: Math.floor((ch - b.h) / 2) - b.y });
// 그렇게 놓았을 때 네 여백과 벗어남(왼쪽 − 오른쪽, 위 − 아래의 절반)
export function margins(cw, ch, b) {
  const o = centre(cw, ch, b);
  const L = o.x + b.x, T = o.y + b.y, R = cw - L - b.w, B = ch - T - b.h;
  return { L, R, T, B, dx: (L - R) / 2, dy: (T - B) / 2 };
}
// 반 칸 마스크(unit = 2) · 논리 마스크(unit = 1)의 잉크 상자가 과녁 안인가
export const inTarget = (b, unit = 1) => b.w >= TARGET.w[0] * unit && b.w <= TARGET.w[1] * unit && b.h >= TARGET.h[0] * unit && b.h <= TARGET.h[1] * unit;
