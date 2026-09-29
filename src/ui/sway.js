// 카드 들림(빛과 움직임): 가리키면 조금 들리고, 누르면 가라앉는다. 가만히 있을 때는 움직이지 않고, 기울지도 않는다.
// 그리기 변환(translate)만 바꾼다 — 누르는 구역(ui.region)과 레이아웃 기록(layoutlog)은 원래 네모를 쓴다.
// N배(N ≥ 2)는 1/N 칸씩 부드럽게, 1배는 정수 칸으로 움직인다. 움직임 줄이기에서도 들림 · 가라앉음은 남는다.
import { LOOK, snap } from '../render/look.js';
import { shade, unshaded } from '../render/light.js';

const state = new Map();

// key: 카드마다 다른 이름(부드럽게 따라가기), (x, y, w, h): 원래 네모, fn(c): 카드를 원래 좌표로 c에 그린다
// hover · press: 가리킴 · 누름, shadow: 밑 그림자, amt: 들림 세기
export function sway(ctx, time, key, x, y, w, h, fn, { hover = false, press = false, shadow = true, amt = 1 } = {}) {
  let s = state.get(key);
  const now = time;
  if (!s || now - s.t > 0.5 || now < s.t) { s = { dy: 0, t: now }; state.set(key, s); }
  const dt = Math.min(0.1, Math.max(0, now - s.t));
  s.t = now;
  if (state.size > 400) { for (const [k, v] of state) if (now - v.t > 2) state.delete(k); }
  // 목표 들림(도트, 위가 −)
  const dy = press ? 1 : hover ? -1.5 * LOOK.sway * amt : 0;
  // 부드럽게 따라간다(가리킴이 바뀌어도 튀지 않게)
  s.dy += (dy - s.dy) * Math.min(1, dt * 14);
  if (Math.abs(s.dy - dy) < 0.01) s.dy = dy;
  const oy = LOOK.n >= 2 ? snap(s.dy) : Math.round(s.dy);
  if (shadow) shade(ctx, x, y, w, h, 2 + Math.max(0, Math.round(-s.dy)));
  const body = (c) => (shadow ? unshaded(() => fn(c)) : fn(c));
  if (!oy) { body(ctx); return; }
  ctx.save();
  ctx.translate(0, oy);
  try { body(ctx); } finally { ctx.restore(); }
}
