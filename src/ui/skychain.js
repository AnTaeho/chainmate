// 첫 화면 「하늘의 사슬」 시간표(CHM-49, docs/design-notes/layout.md 「첫 화면」). 그림 없이 장면만 셈한다 — Node에서 돈다.
// 검은 기물 여덟 자리가 떠 있고, 위에서 떨어진 흰 폰이 다섯을 차례로 먹으며 먹은 기물로 바뀐다. 다섯 뒤 사라지고 새 폰이 떨어진다.
// 한 번 먹을 때: 예비(뒤로 4도트) 0.14 → 돌진(가속, 잔상 셋) 0.17 → 멈칫 0.08(다섯째 2.5배, 그동안 떠다님도 선다).
// 좌표는 480×270 도트, 기물 자리는 기물 그림의 왼쪽 위. 같은 T면 늘 같은 장면이다(무작위 없음).
// 규칙 엔진은 돌리지 않는다 — 그림만이다.
export const SKY_TYPES = ['B', 'R', 'N', 'Q', 'P', 'B', 'R', 'N'];
export const SKY_SPOTS = [[70, 118], [150, 150], [345, 120], [410, 160], [95, 176], [372, 108], [190, 112], [300, 168]];
export const DROP = 0.55, STEP = 1.05, TAIL = 1.0, CYC = DROP + STEP * 5 + TAIL;
export const A_ANT = 0.14, A_DASH = 0.17, A_STOP = 0.08; // 예비 · 돌진 · 멈칫
export const HIT_LIFE = 1.2;
// 움직임 줄이기에서 멈춰 둘 한 장면: 둘을 먹고 셋째로 가기 직전(흩어지는 조각 · 번쩍임 없이)
export const CALM_T = DROP + STEP * 2 + 0.02;

export function enemiesAt(t, round) {
  return SKY_SPOTS.map(([x, y], i) => ({ i, t: SKY_TYPES[(i + round) % SKY_TYPES.length], x: x + Math.sin(t * 0.7 + i) * 6, y: y + Math.sin(t * 0.9 + i * 1.3) * 5 }));
}
// 판마다(round) 먹는 차례: 여덟 자리 중 서로 다른 다섯. 넷은 시안 그대로 두 칸 걸러, 다섯째는 첫 자리 옆 칸
// (시안은 i × 2가 8에서 첫 자리로 돌아와 다섯째가 이미 먹은 빈 자리를 먹었다)
export function orderOf(round) { return [0, 1, 2, 3, 4].map((i) => (i * 2 + (i >= 4 ? 1 : 0) + (round % 2) + round * 3) % SKY_SPOTS.length); }

// 한 시점의 장면. hero: 흰 기물(t 종류 · x · y · ghosts 잔상 · white 하얗게 번쩍 · alpha), eaten: 먹힌 자리 번호,
// hits: 먹은 자리의 연출(age 지난 시간 · n 배수 · type 먹힌 종류 · final 다섯째 · dust 떨어진 먼지), shake: 흔들림 세기(도트), flashAll: 화면 번쩍임 세기
export function skyScene(T) {
  const round = Math.floor(T / CYC), k = T - round * CYC;
  const order = orderOf(round);
  const st = { round, order, hero: { t: 'P', x: 240, y: 130, ghosts: [], white: 0, alpha: 1 }, eaten: [], hits: [], shake: 0, flashAll: 0, trail: [], enemies: null };
  if (k < DROP) {
    const m = k / DROP;
    st.hero.y = -30 + m * m * 160;
    st.enemies = enemiesAt(T, round);
    for (let g = 1; g <= 3; g++) { const mm = Math.max(0, m - g * 0.06); st.hero.ghosts.push([240, -30 + mm * mm * 160]); }
    return st;
  }
  const kk = k - DROP, n = Math.min(5, Math.floor(kk / STEP)), u = kk - n * STEP;
  // 떨어진 쿵(첫 0.3초)
  if (kk < 0.3) { st.shake = (1 - kk / 0.3) * 2; st.hits.push({ x: 240, y: 130, age: kk, n: 1, dust: true }); }
  // 멈칫 보정: 지금까지 지난 멈칫 시간만큼 떠다님 시계를 늦춘다
  const stops = Math.min(n, 5) * A_STOP + (n < 5 && u > A_ANT + A_DASH ? Math.min(u - A_ANT - A_DASH, n === 4 ? A_STOP * 2.5 : A_STOP) : 0);
  const en = enemiesAt(T - stops, round);
  st.enemies = en;
  let px = 240, py = 130;
  for (let s = 0; s < n; s++) {
    const e = en[order[s]];
    st.eaten.push(e.i); st.hero.t = e.t; st.trail.push([px, py, e.x, e.y]); px = e.x; py = e.y;
    const age = kk - (s * STEP + A_ANT + A_DASH);
    if (age < HIT_LIFE) st.hits.push({ x: e.x, y: e.y, age, n: s + 2, type: e.t, final: s === 4 });
  }
  if (n >= 5) {
    st.hero.x = px; st.hero.y = py; st.hero.alpha = Math.max(0, 1 - ((kk - 5 * STEP) / TAIL) * 1.6);
    const age = kk - (4 * STEP + A_ANT + A_DASH);
    st.shake = Math.max(0, 1 - age / 0.5) * 6;
    st.flashAll = Math.max(0, 1 - age / 0.25) * 0.5;
    return st;
  }
  const e = en[order[n]];
  const dx = e.x - px, dy = e.y - py, len = Math.hypot(dx, dy) || 1;
  if (u < A_ANT) {
    const m = u / A_ANT;
    st.hero.x = px - (dx / len) * 4 * Math.sin((m * Math.PI) / 2); st.hero.y = py - (dy / len) * 4 * Math.sin((m * Math.PI) / 2);
  } else if (u < A_ANT + A_DASH) {
    const m = (u - A_ANT) / A_DASH, a = m * m * m; // 가속
    const sx = px - (dx / len) * 4, sy = py - (dy / len) * 4;
    st.hero.x = sx + (e.x - sx) * a; st.hero.y = sy + (e.y - sy) * a;
    for (let g = 1; g <= 3; g++) { const aa = Math.max(0, m - g * 0.12); st.hero.ghosts.push([sx + (e.x - sx) * aa ** 3, sy + (e.y - sy) * aa ** 3]); }
    st.trail.push([px, py, st.hero.x, st.hero.y]);
  } else {
    st.hero.x = e.x; st.hero.y = e.y; st.eaten.push(e.i); st.hero.t = e.t; st.trail.push([px, py, e.x, e.y]);
    const age = u - A_ANT - A_DASH, stopLen = n === 4 ? A_STOP * 2.5 : A_STOP;
    st.hero.white = age < stopLen + 0.05 ? 1 : 0;
    const power = 1 + n * 0.6;
    st.shake = Math.max(0, 1 - age / 0.35) * 2 * power;
    if (n === 4) st.flashAll = Math.max(0, 1 - age / 0.25) * 0.5;
    st.hits.push({ x: e.x, y: e.y, age, n: n + 2, type: e.t, final: n === 4 });
  }
  return st;
}

// 흔들림: 정수 도트로만(세기 sh 도트까지). 같은 T면 같은 자리
export function skyShake(T, sh) {
  if (!(sh > 0)) return [0, 0];
  return [Math.round(Math.sin(T * 91) * sh) || 0, Math.round(Math.cos(T * 77) * sh) || 0];
}

// 움직임 줄이기: 한 장면으로 멈춘다 — 흔들림 · 번쩍임 · 조각 없이, 지나온 길은 남긴다
export function calmScene() {
  const st = skyScene(CALM_T);
  st.hits = []; st.shake = 0; st.flashAll = 0; st.hero.ghosts = []; st.hero.white = 0;
  return st;
}
