// 빛과 움직임의 손잡이(docs/design-notes/layout.md 「빛과 움직임」).
// n: 뒷면 캔버스 배율(화면이 정수 N배로 그린다 — 480×270 좌표는 그대로, setTransform(N)). 움직이는 것만 1/N 칸에 선다.
// calm: 움직임 줄이기(흐르는 배경 · 빛 떨림이 멈춘다. 그림자와 멈춘 빛은 남는다).
// flow · shadow · glow · sway: 세기(시안 비교용으로 window.__look이 덮어쓸 수 있다).
export const LOOK = { n: 1, calm: false, flow: 1.6, shadow: 0.45, glow: 1, sway: 1 };
if (typeof globalThis !== 'undefined' && globalThis.__look) Object.assign(LOOK, globalThis.__look);

// 그릴 때만 그린다(layout.md 「빛과 움직임」): 시간 따라 모습이 바뀌는 것을 그리면 live()를 부른다 — 다음 프레임도 그린다
// beat(t, rate, phase): 초당 rate번 계단처럼 바뀌는 것 — floor(t × rate + phase)를 돌려주고, 그 값이 바뀌는 프레임에 그리게 한다(t는 app.time)
export const MOTION = { live: false, beats: new Map(), now: 0 };
export const live = () => { MOTION.live = true; };
export const beat = (t, rate, phase = 0) => {
  const k = Math.floor(t * rate + phase);
  MOTION.beats.set(`${rate}:${phase}`, [rate, phase, k]);
  return k;
};
// 카드마다 엇갈린 시각(t = app.time + 칸 차례)으로 그리는 계단: 그 차이를 phase로 적는다(MOTION.now = 그리는 순간의 app.time — app.frame이 둔다)
export const beatAt = (t, rate) => beat(MOTION.now, rate, (t - MOTION.now) * rate);

// 1/N 칸에 맞춘다(N = 1이면 정수 칸). 꽉 채움(N이 소수)이면 1/N 칸이 곧 기기 화소다
// (소수 배율의 반 칸 자리는 부동소수 잡음으로 위아래가 갈리지 않게 늘 위로 — 테 1이 3 · 4 화소로 갈리지 않는다)
export const snap = (v) => (Number.isInteger(LOOK.n) ? Math.round(v * LOOK.n) : Math.round(v * LOOK.n + 1e-6)) / LOOK.n;
// 꽉 채움(layout.md 「화면 맞춤」): 뒷면 배율이 소수면 멈춘 자리도 정수 칸에 둔 뒤 기기 화소에 맞춘다. 정수 배율이면 Math.round 그대로
export const frac = () => !Number.isInteger(LOOK.n);
export const grid = (v) => (Number.isInteger(LOOK.n) ? Math.round(v) : snap(Math.round(v)));
// 칸 하나(x0, 너비 w): 정수 배율이면 Math.round(w), 소수면 오른쪽 끝도 기기 화소에 맞춘 너비(1 논리 px 테는 어디서나 같은 기기 화소 수)
export const span = (x0, w) => (Number.isInteger(LOOK.n) ? Math.round(w) : snap(x0 + Math.round(w)) - x0);
