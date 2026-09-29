// 카드 흔들림(빛과 움직임): 가만히 있는 카드는 아주 조금 떠오르고 기울며 숨 쉬고, 가리키면 커서 쪽으로 기울며 들리고, 누르면 가라앉는다.
// 그리기 변환(translate · rotate)만 바꾼다 — 누르는 구역(ui.region)과 레이아웃 기록(layoutlog)은 원래 네모를 쓴다.
// 1배(N = 1)는 돌리지도 숨 쉬지도 않는다(12px 글이 계단으로 부서지고 1도트씩 떨린다). 움직임 줄이기면 숨 쉬기와 기울기는 멈추고 들림 · 가라앉음만 남는다.
import { LOOK, snap } from '../render/look.js';
import { shade, unshaded } from '../render/light.js';
import { makeCanvas } from '../render/surface.js';

const DEG = Math.PI / 180;
const state = new Map();

const phaseOf = (key) => { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return ((h >>> 0) % 1000) / 1000 * Math.PI * 2; };

// key: 카드마다 다른 이름(위상 · 부드럽게 따라가기), (x, y, w, h): 원래 네모, fn(c): 카드를 원래 좌표로 c에 그린다
// hover · press: 가리킴 · 누름, mx: 커서 x(기울 쪽), still: 연출 중이라 흔들지 않는다, shadow: 밑 그림자
export function sway(ctx, time, key, x, y, w, h, fn, { hover = false, press = false, mx = null, still = false, shadow = true, amt = 1 } = {}) {
  let s = state.get(key);
  const now = time;
  if (!s || now - s.t > 0.5 || now < s.t) { s = { a: 0, dy: 0, t: now }; state.set(key, s); }
  const dt = Math.min(0.1, Math.max(0, now - s.t));
  s.t = now;
  if (state.size > 400) { for (const [k, v] of state) if (now - v.t > 2) state.delete(k); }
  const ph = phaseOf(key);
  // 1배는 숨 쉬기도 멈춘다(정수 칸 1도트 들썩임은 글을 떨리게 한다) — 가리킴 · 누름의 들림만
  const calm = LOOK.calm || still || LOOK.n < 2;
  const k = LOOK.sway * amt;
  // 목표 기울기(도) · 들림(도트, 위가 −)
  let a = 0, dy = 0;
  if (!calm) {
    a = Math.sin(time * 0.9 + ph) * 1.1 * k;
    dy = Math.sin(time * 1.4 + ph * 1.7) * 0.7 * k;
  }
  if (hover) {
    dy = -1.5 * k;
    if (!calm && mx != null) a = Math.max(-1, Math.min(1, (mx - (x + w / 2)) / (w / 2))) * 2 * k;
  }
  if (press) { dy = 1; a = 0; }
  // 부드럽게 따라간다(가리킴이 바뀌어도 튀지 않게)
  const f = Math.min(1, dt * 14);
  s.a += (a - s.a) * f;
  s.dy += (dy - s.dy) * f;
  const n = LOOK.n;
  const ang = n >= 2 ? s.a * DEG : 0;
  const oy = n >= 2 ? snap(s.dy) : Math.round(s.dy);
  if (shadow) shade(ctx, x, y, w, h, 2 + Math.max(0, Math.round(-s.dy)));
  const body = (c) => (shadow ? unshaded(() => fn(c)) : fn(c));
  if (!ang && !oy) { body(ctx); return; }
  const cx = x + w / 2, cy = y + h / 2;
  if (!ang) {
    ctx.save();
    ctx.translate(0, oy);
    try { body(ctx); } finally { ctx.restore(); }
    return;
  }
  // 기울 때: 카드를 N배 뒷면 캔버스에 곧게 그린 뒤, 그 그림을 네모 도트 그대로(가장 가까운 화소) 돌려 붙인다.
  // 카드 테 · 바탕(fillRect)을 바로 돌리면 가장자리가 섞인 빛깔로 번진다 — 이렇게 하면 모든 화소가 제 빛깔 하나다
  const P = PAD, ow = (w + P * 2) * n, oh = (h + P * 2) * n;
  const c = offscreen(ow, oh);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, ow, oh);
  c.setTransform(n, 0, 0, n, -(x - P) * n, -(y - P) * n);
  c.imageSmoothingEnabled = false;
  c.globalAlpha = 1;
  body(c);
  ctx.save();
  ctx.translate(cx, cy + oy);
  ctx.rotate(ang);
  ctx.translate(-cx, -cy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c.canvas, 0, 0, ow, oh, x - P, y - P, w + P * 2, h + P * 2);
  ctx.restore();
}

// 기울어진 카드를 곧게 그려 둘 뒷면(카드보다 PAD 도트 넓게 — 판본 빛 · 고른 테가 카드 밖으로 조금 나온다)
const PAD = 8;
let off = null, offCtx = null;
function offscreen(w, h) {
  if (!off || off.width < w || off.height < h) {
    off = makeCanvas(Math.max(w, off ? off.width : 0), Math.max(h, off ? off.height : 0));
    offCtx = off.getContext('2d'); // 읽지 않으니 willReadFrequently 없이
  }
  return offCtx;
}

// 가리킨 카드에 흔들림을 넘길 커서 x
export const cursorX = (ui) => (ui && ui.mouse ? ui.mouse.x : null);
