// 특수 기물 연출의 길(CHM-57): capture 기록 하나(사건 · 사슬 기록 · 다시 보기 기록 모두 같은 열쇠) → 지나는 칸 목록.
// 규칙 쪽(board.js pathVia)은 마지막으로 꺾거나 튕긴 칸 하나(via)만 남긴다. 화면은 그 칸과 행마의 모양(꺾쇠는 축이 번갈아,
// 물수제비는 가장자리에서 거울처럼)으로 앞의 꺾임을 되짚는다 — 칸 계산만, 판 상태 · 그리기는 모른다(Node 시험이 돈다).
const F = (sq) => sq & 7, R = (sq) => sq >> 3;
const sq = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);
const edgeF = (s) => F(s) === 0 || F(s) === 7, edgeR = (s) => R(s) === 0 || R(s) === 7;
export const sqDist = (a, b) => Math.max(Math.abs(F(a) - F(b)), Math.abs(R(a) - R(b)));

// 궁수 모습: 제자리에서 쏜다. 옛 기록(stay가 없다)은 서는 칸이 출발 칸이면 쏜 것
export const isShot = (c) => (c.stay != null ? !!c.stay : (c.at ?? c.to) === c.from && c.from !== c.to);

// 꺾쇠: 마지막 걸음(via → to)과 축이 번갈아 간다. from이 via와 그 직각 축 위에 있으면 한 번, 아니면 두 번 꺾었다
export function hookCorners(from, via, to) {
  const lastH = R(via) === R(to);
  if (lastH ? F(from) === F(via) : R(from) === R(via)) return [via];
  const c1 = lastH ? sq(F(via), R(from)) : sq(F(from), R(via));
  return c1 >= 0 && c1 !== from ? [c1, via] : [via];
}
// 물수제비: via에서 튕긴 걸음(via → to)을 가장자리에 비춰 들어온 쪽을 얻고, 거꾸로 걸어 from이면 한 번,
// 먼저 닿은 가장자리 칸이 있으면 그 칸이 첫 튕김(거기서 한 번 더 비춰 거꾸로 걸어 from을 찾는다)
export function bounceCorners(from, via, to) {
  const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const reflect = (s, [df, dr]) => [F(s) === 0 || F(s) === 7 ? -df : df, R(s) === 0 || R(s) === 7 ? -dr : dr];
  const back = (start, [df, dr], stopAtEdge) => {
    for (let f = F(start) - df, r = R(start) - dr; f >= 0 && f < 8 && r >= 0 && r < 8; f -= df, r -= dr) {
      const s = sq(f, r);
      if (s === from) return { from: true };
      if (stopAtEdge && (edgeF(s) || edgeR(s))) return { edge: s };
    }
    return {};
  };
  const d1 = reflect(via, [sgn(F(to) - F(via)), sgn(R(to) - R(via))]);
  const a = back(via, d1, true);
  if (a.from || a.edge == null) return [via];
  const b = back(a.edge, reflect(a.edge, d1), false);
  return b.from ? [a.edge, via] : [via];
}

// 먹기 한 번의 길: { kind, pts }. kind = 'shot'(제자리 쏘기, pts = [from]) · 'hop'(넘어 앉기, over = 넘은 칸) ·
// 'bend'(꺾음 · 튕김, pts = [from, ...꺾은 칸, to]) · 'line'(그 밖, pts = [from, 서는 칸])
export function capRoute(c) {
  if (isShot(c)) return { kind: 'shot', pts: [c.from], to: c.to };
  const land = c.at ?? c.to;
  if (land !== c.to) return { kind: 'hop', pts: [c.from, land], over: c.to };
  const mv = c.move || c.form;
  if ((mv === 'T' || mv === 'E') && c.via != null && c.via >= 0 && c.via !== c.from) {
    const corners = mv === 'T' ? hookCorners(c.from, c.via, c.to) : bounceCorners(c.from, c.via, c.to);
    return { kind: 'bend', pts: [c.from, ...corners, c.to] };
  }
  return { kind: 'line', pts: [c.from, land] };
}
// 길이(칸 수)
export const routeLen = (pts) => { let n = 0; for (let i = 0; i + 1 < pts.length; i++) n += sqDist(pts[i], pts[i + 1]); return n; };
// 길 위의 칸 목록(출발 칸 빼고, 지나는 칸 차례대로) — 시험과 길 표시가 같이 쓴다
export function routeSquares(pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], n = sqDist(a, b);
    const df = Math.sign(F(b) - F(a)), dr = Math.sign(R(b) - R(a));
    for (let k = 1; k <= n; k++) out.push(sq(F(a) + df * k, R(a) + dr * k));
  }
  return out;
}
// 길 위 자리(p 0→1): 꺾는 칸마다 짧게 멈춘다(전체의 dwell 몫, 꺾음이 많으면 나눠 줄인다).
// { i: 걸음 번호, k: 그 걸음 안 0→1, corner: 멈춰 있는 꺾은 칸 번호(pts 번호) | -1 }
export function routeAt(pts, p, dwell = 0.1) {
  const legs = pts.length - 1;
  if (legs <= 0) return { i: 0, k: 1, corner: -1 };
  const corners = legs - 1, dw = corners ? Math.min(dwell, 0.24 / corners) : 0;
  const L = Math.max(1, routeLen(pts)), move = 1 - dw * corners;
  let t = Math.max(0, Math.min(1, p));
  for (let i = 0; i < legs; i++) {
    const span = (move * sqDist(pts[i], pts[i + 1])) / L;
    if (t <= span || i === legs - 1) return { i, k: span > 0 ? Math.min(1, t / span) : 1, corner: -1 };
    t -= span;
    if (t <= dw) return { i, k: 1, corner: i + 1 };
    t -= dw;
  }
  return { i: legs - 1, k: 1, corner: -1 };
}
// 꺾는 길의 연출 시간(×1): 지나는 칸만큼 미끄러지되 꺾음마다 짧은 멈춤, 길어도 0.42초 안(그 위로는 미끄러짐을 빠르게)
export const bendDur = (pts) => Math.min(0.42, 0.08 + 0.032 * Math.min(10, routeLen(pts)) + 0.045 * Math.max(0, pts.length - 2));

// 결과 다시 보기(screens/result.js)의 판 상태: 먹은 수 done(-1이면 떨구기 전) · 지금 먹기의 진행 p(0→1)에서
//   gone   판에서 지운 적 칸(먹힌 칸 + 화약병 · 폭약으로 터진 칸 gone)
//   pos · form  내 기물이 선 칸 · 모습(움직이는 중이면 출발 칸 · 먹기 전 모습)
//   trail  지나온 길(먹기마다 pts) · shots 제자리 쏘기 [from, to]
//   cur · route  지금 먹기와 그 길
export function replayState(r, done, p) {
  const caps = r.caps || [], n = caps.length;
  const gone = new Set(), trail = [], shots = [];
  let pos = r.drop.sq, form = r.drop.piece;
  const take = (c) => { gone.add(c.to); for (const s of c.gone || []) gone.add(s); };
  for (let i = 0; i < Math.min(Math.max(0, done), n); i++) {
    const c = caps[i], rt = capRoute(c);
    take(c);
    if (rt.kind === 'shot') shots.push([c.from, c.to]);
    else { trail.push(rt.pts); pos = rt.pts[rt.pts.length - 1]; }
    form = c.after ?? c.form;
  }
  const cur = done >= 0 && done < n ? caps[done] : null;
  const route = cur ? capRoute(cur) : null;
  if (cur) {
    // 넘은 적은 가운데쯤 깨지고, 그 밖은 닿을 때 지운다(쏘기는 화살이 닿을 때)
    if (p >= 1 || (route.kind === 'hop' && p >= 0.5)) gone.add(cur.to);
    if (p >= 1) { for (const s of cur.gone || []) gone.add(s); form = cur.after ?? cur.form; if (route.kind !== 'shot') pos = route.pts[route.pts.length - 1]; }
    else form = cur.form;
  }
  return { gone, pos, form, trail, shots, cur, route };
}
