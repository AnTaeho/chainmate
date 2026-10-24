// 카드 들림(빛과 움직임): 가리키면 조금 들리고, 누르면 가라앉는다. 가만히 있을 때는 움직이지 않는다.
// 그리기 변환만 바꾼다 — 레이아웃 기록(layoutlog)은 원래 네모를 쓴다. tilt를 주면 늘 그만큼 기운 채로 그린다(상점 걸린 카드, 누르는 구역은 tiltHit).
// N배(N ≥ 2)는 1/N 칸씩 부드럽게, 1배는 정수 칸으로 움직인다. 움직임 줄이기에서도 들림 · 가라앉음은 남는다.
import { LOOK, snap, live } from '../render/look.js';
import { shade, unshaded } from '../render/light.js';

const state = new Map();
// 그린 차례(swayBegin): 그리지 않은 프레임에는 지난 그림의 카드 시각만 옮긴다(swaySettle — 그렸다면 했을 일과 같다)
let drawNo = 0, clockNow = null;
export function swayBegin(clock) { drawNo++; clockNow = clock; }
export function swaySettle(clock) { for (const s of state.values()) if (s.n === drawNo) s.t = clock + s.off; }

// key: 카드마다 다른 이름(부드럽게 따라가기), (x, y, w, h): 원래 네모, fn(c): 카드를 원래 좌표로 c에 그린다
// hover · press: 가리킴 · 누름, shadow: 밑 그림자, amt: 들림 세기
// tilt: 기울기(라디안, 시계 방향 +) · pivot: 도는 점(기본 카드 가운데)
export function sway(ctx, time, key, x, y, w, h, fn, { hover = false, press = false, shadow = true, amt = 1, tilt = 0, pivot = null } = {}) {
  let s = state.get(key);
  const now = time;
  if (!s || now - s.t > 0.5 || now < s.t) { s = { dy: 0, t: now }; state.set(key, s); }
  const dt = Math.min(0.1, Math.max(0, now - s.t));
  s.t = now;
  s.n = drawNo; s.off = now - (clockNow ?? now);
  if (state.size > 400) { for (const [k, v] of state) if (now - v.t > 2) state.delete(k); }
  // 목표 들림(도트, 위가 −)
  const dy = press ? 1 : hover ? -1.5 * LOOK.sway * amt : 0;
  // 부드럽게 따라간다(가리킴이 바뀌어도 튀지 않게)
  s.dy += (dy - s.dy) * Math.min(1, dt * 14);
  if (Math.abs(s.dy - dy) < 0.01) s.dy = dy;
  else live();
  const oy = LOOK.n >= 2 ? snap(s.dy) : Math.round(s.dy);
  if (tilt) {
    // 기운 카드: 그림자까지 같이 돌리고, 구운 글 · 그림이 계단지지 않게 이 안에서만 부드럽게 늘인다
    const [px, py] = pivot || [x + w / 2, y + h / 2];
    ctx.save();
    ctx.translate(px, py); ctx.rotate(tilt); ctx.translate(-px, -py);
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    try {
      if (shadow) shade(ctx, x, y, w, h, 3 + Math.max(0, Math.round(-s.dy)));
      ctx.translate(0, oy);
      if (shadow) unshaded(() => fn(ctx)); else fn(ctx);
    } finally { ctx.imageSmoothingEnabled = sm; ctx.restore(); }
    return;
  }
  if (shadow) shade(ctx, x, y, w, h, 3 + Math.max(0, Math.round(-s.dy)));
  const body = (c) => (shadow ? unshaded(() => fn(c)) : fn(c));
  if (!oy) { body(ctx); return; }
  ctx.save();
  ctx.translate(0, oy);
  try { body(ctx); } finally { ctx.restore(); }
}

// 기운 카드의 누르는 구역: 돌린 네모를 감싼 네모(x, y, w, h)와 그 안에서 실제 카드 모양만 받는 hit(ui.region opts)
export function tiltHit(x, y, w, h, tilt, pivot = null) {
  const [px, py] = pivot || [x + w / 2, y + h / 2];
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([qx, qy]) => [px + (qx - px) * c - (qy - py) * s, py + (qx - px) * s + (qy - py) * c]);
  const x0 = Math.floor(Math.min(...pts.map((q) => q[0]))), y0 = Math.floor(Math.min(...pts.map((q) => q[1])));
  const x1 = Math.ceil(Math.max(...pts.map((q) => q[0]))), y1 = Math.ceil(Math.max(...pts.map((q) => q[1])));
  // 누른 점을 거꾸로 돌려 원래 네모 안인지 본다
  const hit = (mx, my) => { const dx = mx - px, dy = my - py; const ux = px + dx * c + dy * s, uy = py - dx * s + dy * c; return ux >= x && ux < x + w && uy >= y && uy < y + h; };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, hit };
}
