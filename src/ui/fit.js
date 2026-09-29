// 화면 맞춤(docs/design-notes/layout.md 「화면 맞춤」): 480×270을 기기 화소의 정수 K배로 키우고, 남는 가장자리는 여백 판이 채운다.
// DOM을 모른다(main.js가 창 크기 · dpr · 안전 영역을 넘긴다). test/fit.test.js가 여러 창 × dpr로 잰다.
export const GW = 480, GH = 270;

// 뒷면 캔버스 배율 N(빛과 움직임): K를 나누는 2~4 중 가장 큰 것, 없으면 min(K, 4).
// N이 K를 나누지 못해도(K = 5 · 7) 도트 하나는 기기 화소 K×K로 고르다 — 도트 경계(N의 배수)가 늘 기기 화소 경계(K의 배수)에 떨어진다.
// 1/N 칸에 서는 움직이는 것만 칸 폭이 고르지 않다. 상한 4는 뒷면 캔버스를 1920×1080 안에 두려고.
export function backScale(k) {
  if (!Number.isInteger(k) || k <= 1) return 1;
  for (let d = 4; d >= 2; d--) if (d <= k && k % d === 0) return d;
  return Math.min(k, 4);
}

// vw · vh: 창(CSS 화소), dpr: 기기 화소 비, inset: 안전 영역(노치 · 홈 막대, CSS 화소), coarse: 손가락 기기(가리키기 없음)
// 돌려주는 것:
//   k       배율(기기 화소 / 도트). 창이 480×270 기기 화소보다 작으면 1 미만의 소수(흐려도 다 보이게)
//   n       뒷면 캔버스 배율
//   css     도트 하나의 CSS 크기(k / dpr) — 1 미만이면 12px 글이 12 CSS 화소보다 작다
//   canvas  { left, top, width, height } CSS 화소. left · top은 기기 화소 정수 자리(반 화소에 걸려 흐려지지 않게)
//   pad     여백 판: 도트 해상도 캔버스 { cols, rows, ox, oy, left, top, width, height } — 게임 도트 격자와 같은 격자,
//           게임 (0, 0) 도트가 여백 판 (ox, oy) 칸. 창 끝까지 덮는다
//   turn    폰 세로라 글을 읽기 어렵다(가로로 돌려 달라는 그림을 띄운다)
export function chooseFit({ vw, vh, dpr = 1, inset = null, coarse = false }) {
  dpr = dpr > 0 ? dpr : 1;
  const L = inset ? inset.left || 0 : 0, R = inset ? inset.right || 0 : 0, T = inset ? inset.top || 0 : 0, B = inset ? inset.bottom || 0 : 0;
  const vwD = Math.round(vw * dpr), vhD = Math.round(vh * dpr);
  const aw = Math.max(1, Math.round((vw - L - R) * dpr)), ah = Math.max(1, Math.round((vh - T - B) * dpr));
  let k = Math.floor(Math.min(aw / GW, ah / GH));
  if (k < 1) k = Math.min(aw / GW, ah / GH);
  const n = backScale(k);
  const wD = GW * k, hD = GH * k;
  const leftD = Math.round(L * dpr) + Math.floor((aw - wD) / 2);
  const topD = Math.round(T * dpr) + Math.floor((ah - hD) / 2);
  const canvas = { left: leftD / dpr, top: topD / dpr, width: wD / dpr, height: hD / dpr };
  // 여백 판: 게임 도트 격자를 창 끝까지 잇는다
  const ox = Math.max(0, Math.ceil(leftD / k)), oy = Math.max(0, Math.ceil(topD / k));
  const cols = ox + GW + Math.max(0, Math.ceil((vwD - leftD - wD) / k));
  const rows = oy + GH + Math.max(0, Math.ceil((vhD - topD - hD) / k));
  const pad = { cols, rows, ox, oy, left: (leftD - ox * k) / dpr, top: (topD - oy * k) / dpr, width: (cols * k) / dpr, height: (rows * k) / dpr };
  const css = k / dpr;
  const turn = !!coarse && vh > vw && css < 1;
  return { k, n, css, canvas, pad, turn };
}
