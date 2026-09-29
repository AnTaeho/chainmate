// 빛과 움직임의 손잡이(docs/design-notes/layout.md 「빛과 움직임」).
// n: 뒷면 캔버스 배율(화면이 정수 N배로 그린다 — 480×270 좌표는 그대로, setTransform(N)). 움직이는 것만 1/N 칸에 선다.
// calm: 움직임 줄이기(흐르는 배경 · 빛 떨림이 멈춘다. 그림자와 멈춘 빛은 남는다).
// flow · shadow · glow · sway: 세기(시안 비교용으로 window.__look이 덮어쓸 수 있다).
export const LOOK = { n: 1, calm: false, flow: 1.6, shadow: 0.45, glow: 1, sway: 1 };
if (typeof globalThis !== 'undefined' && globalThis.__look) Object.assign(LOOK, globalThis.__look);

// 1/N 칸에 맞춘다(N = 1이면 정수 칸)
export const snap = (v) => Math.round(v * LOOK.n) / LOOK.n;
