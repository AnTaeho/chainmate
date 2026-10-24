// 안 3 벡터 그림의 공용 붓(docs/design-notes/art3.md): 경로 글(M L Q C Z) · 두 톤(왼쪽 빛 · 오른쪽 그늘) + 잉크 테 · N배 한 번 굽기.
// Path2D는 쓰지 않는다(연기 시험의 가짜 캔버스에 없다). 그림은 (열쇠, 크기, 배율 N)마다 한 번 굽고 그릴 때는 붙이기 한 번.
import { makeCanvas, context } from './surface.js';
import { LOOK } from './look.js';
import { place } from './gfx.js';

export const INK = '#12153a';
// 빛깔 역할(5절): 크림 몸 · 그늘, 금 · 붉은 · 하늘은 규칙 빛깔
export const ROLE = {
  cream: ['#f7eedb', '#dcc9a2'],
  gold: ['#f6be45', '#d48b1c'],
  red: ['#ef6a52', '#c24a36'],
  sky: ['#8fcbdc', '#5a9bb0'],
  navy: ['#4a5296', '#343a86'],
  silver: ['#e4eef4', '#b8c4cc'],
  ink: [INK, INK],
};

// 경로 글 → 캔버스 경로(이미 beginPath한 위에 더한다). 대문자 M L Q C Z만
export function trace(x, d) {
  const t = d.match(/[MLQCZ]|-?\d*\.?\d+/g);
  let i = 0, cmd = null;
  const n = () => Number(t[i++]);
  while (i < t.length) {
    if (/[MLQCZ]/.test(t[i])) cmd = t[i++];
    if (cmd === 'M') x.moveTo(n(), n());
    else if (cmd === 'L') x.lineTo(n(), n());
    else if (cmd === 'Q') x.quadraticCurveTo(n(), n(), n(), n());
    else if (cmd === 'C') x.bezierCurveTo(n(), n(), n(), n(), n(), n());
    else if (cmd === 'Z') x.closePath();
  }
}
// 모양 하나 또는 여럿: 경로 글 · 타원 [cx, cy, rx, ry, 돌림]
export function shapePath(x, sh) {
  x.beginPath();
  const list = Array.isArray(sh) && typeof sh[0] === 'number' ? [sh] : Array.isArray(sh) ? sh : [sh];
  for (const p of list) {
    if (typeof p === 'string') trace(x, p);
    else { const r = p[4] || 0; x.moveTo(p[0] + p[2] * Math.cos(r), p[1] + p[2] * Math.sin(r)); x.ellipse(p[0], p[1], p[2], p[3], r, 0, Math.PI * 2); x.closePath(); }
  }
}
// 두 톤 몸 하나: 빛 → split 오른쪽을 그늘로 → 테(lw 0이면 테 없음)
export function two(x, sh, light, shade, split, line = INK, lw = 0) {
  shapePath(x, sh); x.fillStyle = light; x.fill();
  if (shade && shade !== light) { x.save(); x.beginPath(); x.rect(split, -1e4, 2e4, 2e4); x.clip(); shapePath(x, sh); x.fillStyle = shade; x.fill(); x.restore(); }
  if (lw > 0) { shapePath(x, sh); x.strokeStyle = line; x.lineWidth = lw; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
}
// 선 하나(테 빛깔 새김 · 화살대)
export function line(x, d, col, lw) {
  x.beginPath(); trace(x, d); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
}

// 그리는 곳의 실제 배율(뒷면 N × 그리기 변환) — 정수로 굽는다. 12배까지(각성 막간 카드는 3배 × N 3 = 9)
export function scaleOf(ctx) {
  const m = ctx && ctx.getTransform ? ctx.getTransform() : null;
  const a = m && typeof m.a === 'number' ? Math.hypot(m.a, m.b) : LOOK.n;
  return Math.max(1, Math.min(12, Math.round(a)));
}
// 한 번 굽기: w × h 논리 크기를 N배 캔버스에. paint(g, k)는 논리 좌표로 그린다(k = N, 선 바닥 1 / k)
const CACHE = new Map();
export function bake(key, w, h, n, paint) {
  const k = `${key}|${w}x${h}|${n}`;
  let c = CACHE.get(k);
  if (c) return c;
  c = makeCanvas(Math.max(1, Math.ceil(w * n)), Math.max(1, Math.ceil(h * n)));
  const g = context(c);
  g.imageSmoothingEnabled = true;
  g.setTransform(n, 0, 0, n, 0, 0);
  paint(g, n);
  if (CACHE.size > 4000) CACHE.clear();
  CACHE.set(k, c);
  return c;
}
// 구운 그림을 (x, y)에 w × h로. 정수 칸에 놓는다(N = 3에서 번지지 않게 — fine 안이면 1/N 칸)
export function blitVec(ctx, key, x, y, w, h, paint, alpha = 1) {
  const c = bake(key, w, h, scaleOf(ctx), paint);
  const a0 = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(c, place(x), place(y), w, h);
  if (alpha !== 1) ctx.globalAlpha = a0;
  return c;
}
