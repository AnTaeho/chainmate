// 빛과 움직임의 손잡이(docs/design-notes/layout.md 「빛과 움직임」).
// n: 뒷면 캔버스 배율(화면이 정수 N배로 그린다 — 480×270 좌표는 그대로, setTransform(N)). 움직이는 것만 1/N 칸에 선다.
// calm: 움직임 줄이기(흐르는 배경 · 빛 떨림이 멈춘다. 그림자와 멈춘 빛은 남는다).
// flow · shadow · glow · sway: 세기(시안 비교용으로 window.__look이 덮어쓸 수 있다).
export const LOOK = { n: 1, calm: false, flow: 1.6, shadow: 0.45, glow: 1, sway: 1 };
if (typeof globalThis !== 'undefined' && globalThis.__look) Object.assign(LOOK, globalThis.__look);

// 그릴 때만 그린다(layout.md 「빛과 움직임」): 시간 따라 모습이 바뀌는 것을 그리면 live()를 부른다 — 다음 프레임도 그린다
// beat(t, rate, phase): 초당 rate번 계단처럼 바뀌는 것 — floor(t × rate + phase)를 돌려주고, 그 값이 바뀌는 프레임에 그리게 한다(t는 app.time)
export const MOTION = { live: false, beats: new Map() };
export const live = () => { MOTION.live = true; };
export const beat = (t, rate, phase = 0) => {
  const k = Math.floor(t * rate + phase);
  MOTION.beats.set(`${rate}:${phase}`, [rate, phase, k]);
  return k;
};

// 1/N 칸에 맞춘다(N = 1이면 정수 칸)
export const snap = (v) => Math.round(v * LOOK.n) / LOOK.n;
