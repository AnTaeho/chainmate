// mulberry32 시드 난수. 상태는 숫자 하나({ s })라 JSON으로 그대로 저장·복원된다.
// 함수형(잿길과 같은 꼴): next(rng), int(rng, n) … 상태 객체를 첫 인수로 받는다.
export function createRng(seed) {
  return { s: seed >>> 0 };
}

export function next(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// 0 ≤ k < n
export const int = (rng, n) => Math.floor(next(rng) * n);
export const pick = (rng, arr) => arr[int(rng, arr.length)];

// 제자리 Fisher–Yates. 같은 배열을 돌려준다.
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// 이름표로 독립된 하위 스트림을 만든다. 부모 상태는 건드리지 않는다
// (판 생성 · 주머니 · 증원이 서로의 뽑기 횟수에 흔들리지 않게).
export function fork(rng, label) {
  let h = 0x811c9dc5;
  const str = String(label);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  const child = { s: (rng.s ^ h) >>> 0 };
  next(child); // 첫 값을 한 번 섞어 부모와 상관을 끊는다
  return child;
}
