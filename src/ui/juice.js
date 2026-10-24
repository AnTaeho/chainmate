// 손맛 연출(layout.md 28절): 잡기 연기 · 동전 · 색종이 · 화면 번쩍 · 굵은 테 글 · 진열 반짝 띠 · 상금 흔들림.
// 모두 Fx(따로 도는 효과)라 한 수 연출 시간(Seq)을 늘리지 않는다. 무작위는 시드, 개수는 CAP 안. 움직임 줄이기면 부르는 쪽이 끄거나 정지 그림으로(동전은 날리지 않고 상금 수 빛만).
import { PAL } from '../render/palette.js';
import { W, H, rect, text, measure } from '../render/gfx.js';
import { live, beat, LOOK } from '../render/look.js';
import { INK, bake, scaleOf } from '../render/vec.js';

const TAU = Math.PI * 2;

export const CAP = { chips: 12, puffs: 7, coins: 6, coinsLine: 6, confetti: 40, sparks: 24 };
export const seeded = (seed) => { let s = (seed * 2654435761) & 0x7fffffff || 1; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
// 1/N 칸 계단의 배율(뒷면 N배에서 글자 도트가 고르게 선다)
export const stepScale = (s) => Math.round(s * LOOK.n) / LOOK.n;

// 연기 덩어리: 잡힌 칸에서 흰 둥근 덩어리가 부풀었다 오그라들며 흩어진다. 테를 먼저 다 깔고 흰 몸을 얹어 한 덩이 구름으로 보인다
export function puff(fx, x, y, { n = 7, seed = 1, power = 1 } = {}) {
  const r = seeded(seed), parts = [];
  const m = Math.min(CAP.puffs, n);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + r() * 0.7, sp = (22 + r() * 22) * (0.8 + power * 0.2);
    parts.push({ x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 12, s: 6 + Math.floor(r() * 4), d: r() * 0.05 });
  }
  const size = (p, k) => Math.max(1, Math.round(p.s * (k < 0.3 ? 0.5 + (k / 0.3) * 0.7 : 1.2 - ((k - 0.3) / 0.7) * 1.15) * (1 + power * 0.1)));
  fx.add({
    life: 0.45, layer: 1, parts,
    update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.88; p.vy *= 0.88; } },
    draw: (ctx, e) => {
      const ks = e.parts.map((p) => Math.max(0, (e.t - p.d) / (e.life - p.d)));
      ctx.globalAlpha = 0.9;
      e.parts.forEach((p, i) => { const k = ks[i]; if (k > 0 && k < 1) blob(ctx, p.x, p.y, size(p, k) + 2, PAL.frameDk); });
      e.parts.forEach((p, i) => { const k = ks[i]; if (k > 0 && k < 1) blob(ctx, p.x, p.y, size(p, k), k < 0.5 ? PAL.white : PAL.silver); });
      ctx.globalAlpha = 1;
    },
  });
}
function blob(ctx, cx, cy, s, col) {
  ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, TAU); ctx.fillStyle = col; ctx.fill();
}
// 부서진 조각 하나: 기울어진 사각 조각(벡터, 돌며 난다). (x, y)는 조각 상자 왼쪽 위
export function chip(ctx, x, y, w, h, col, a = 0) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h * 0.25); ctx.lineTo(w * 0.3, h / 2); ctx.lineTo(-w / 2, h * 0.35); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
// 네 뿔 반짝(반지름 r)
function spark(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const q = (i * Math.PI) / 4, d = i % 2 ? r * 0.3 : r; (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + Math.cos(q) * d, y + Math.sin(q) * d); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// 화면 번쩍: 온 화면을 덮는 빛(0.2초 안팎). col 흰빛 · 금빛
export function screenFlash(fx, { col = PAL.white, a = 0.5, life = 0.22 } = {}) {
  return fx.add({ life, layer: 1, draw: (ctx, e) => { ctx.globalAlpha = a * (1 - e.t / e.life) ** 2; rect(ctx, -8, -8, W + 16, H + 16, col); ctx.globalAlpha = 1; } });
}

// 반짝이 터짐: 한 점에서 네 뿔 반짝이 사방으로 튀고 천천히 가라앉는다
export function sparkBurst(fx, x, y, { n = 16, seed = 3, cols = [PAL.goldHi, PAL.gold, PAL.white], speed = 80, life = 0.7 } = {}) {
  const r = seeded(seed), parts = [];
  const m = Math.min(CAP.sparks, n);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + r() * 0.3, sp = speed * (0.5 + r() * 0.7);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75 - 20, col: cols[i % cols.length], big: r() < 0.4 });
  }
  return fx.add({
    life, layer: 1, parts,
    update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 70 * dt; } },
    draw: (ctx, e) => {
      const k = e.t / e.life;
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      for (const p of e.parts) {
        if (p.big && k < 0.55) spark(ctx, p.x + 0.5, p.y + 0.5, 2.2, p.col);
        else { ctx.beginPath(); ctx.arc(p.x + 0.5, p.y + 0.5, 0.7, 0, TAU); ctx.fillStyle = p.col; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    },
  });
}

// 색종이: 위에서 터져 흩날리며 떨어지는 종이 조각(돌며, 폭이 줄었다 펴지는 것으로 뒤집힘을 보인다)
const CONFETTI = ['#efbd55', '#df5a45', '#72c24e', '#9fd3e0', '#f2ead8', '#c58ae0'];
// area(): 그 안에서만 보이는 { clip, avoid } 네모(결과 화면 — 제목 줄 안, 제목 글 위는 지나가지 않는다). 없으면 화면 뒤 층에 온 화면
export function confetti(fx, x, y, { n = 36, seed = 5, spread = 200, life = 1.6, tag = null, area = null } = {}) {
  const r = seeded(seed), parts = [];
  const m = Math.min(CAP.confetti, n);
  for (let i = 0; i < m; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.4, sp = spread * (0.45 + r() * 0.65);
    parts.push({ x: x + (r() - 0.5) * 20, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col: CONFETTI[i % CONFETTI.length], ph: r() * 6, w: 3 + (i % 2) });
  }
  // 색종이는 화면 그림 뒤 층(app.js — 'back')에 그린다: 보상 상자 뒤로 떨어져 상자 안 글을 가리지 않는다
  const e = fx.add({
    life, layer: area ? 1 : 'back', parts, confetti: true,
    update: (dt, f) => { for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy = p.vy * 0.96 + 190 * dt; p.ph += dt * 9; } },
    draw: (ctx, f) => {
      const k = f.t / f.life;
      const ar = area ? area() : null;
      if (area && !ar) return;
      if (ar) { ctx.save(); ctx.beginPath(); ctx.rect(ar.clip.x, ar.clip.y, ar.clip.w, ar.clip.h); ctx.clip(); }
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const av = ar && ar.avoid;
      for (const p of f.parts) {
        if (av && p.x > av.x - 4 && p.x < av.x + av.w && p.y > av.y - 4 && p.y < av.y + av.h) continue;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 0.35); ctx.scale(Math.max(0.15, Math.abs(Math.cos(p.ph))), 1);
        ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -1.5, p.w, 3); ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (ar) ctx.restore();
    },
  });
  if (tag) e[tag] = true;
  return e;
}

// 「$」 동전(11×11): 금 두 톤 둥근 판 + 잉크 테 + 안쪽 고리 + 가운데 $(안 3 벡터). 배율 N마다 한 번 굽는다
function paintCoin(g) {
  g.beginPath(); g.arc(5.5, 5.5, 4.9, 0, TAU); g.fillStyle = PAL.gold; g.fill();
  g.save(); g.beginPath(); g.rect(5.8, 0, 6, 11); g.clip(); g.beginPath(); g.arc(5.5, 5.5, 4.9, 0, TAU); g.fillStyle = PAL.goldDk; g.fill(); g.restore();
  g.beginPath(); g.arc(5.5, 5.5, 4.9, 0, TAU); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
  g.beginPath(); g.arc(5.5, 5.5, 3.4, 0, TAU); g.strokeStyle = 'rgba(107,68,16,0.55)'; g.lineWidth = 0.6; g.stroke();
  g.beginPath(); g.moveTo(7, 3.9); g.bezierCurveTo(6.2, 3.2, 4, 3.3, 4.1, 4.6); g.bezierCurveTo(4.2, 5.8, 7, 5.2, 7, 6.5); g.bezierCurveTo(7, 7.8, 4.8, 7.8, 4, 7.1);
  g.moveTo(5.5, 2.6); g.lineTo(5.5, 8.4);
  g.strokeStyle = '#6b4410'; g.lineWidth = 0.9; g.lineCap = 'round'; g.stroke();
}
export function drawCoin(ctx, x, y, { alpha = 1, sx = 1 } = {}) {
  const c = bake('coin', 11, 11, scaleOf(ctx), paintCoin);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const w = Math.max(1, Math.round(11 * sx));
  ctx.drawImage(c, x + Math.floor((11 - w) / 2), y, w, 11);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// 동전이 (x0, y0)에서 솟았다가 (x1, y1)로 날아간다. n개는 조금씩 늦게. 닿을 때마다 onHit(동전 소리 · 상금 흔들림)
// jitter: 솟는 자리의 좌우 흩어짐(보상 화면은 0 — 금액 오른쪽 한 줄로 내려가 글을 덮지 않는다). carry: 대국이 끝나 막간으로 넘어가도 이어 난다
export function flyCoins(fx, x0, y0, x1, y1, { n = 3, seed = 9, delay = 0, onHit = null, rise = 22, jitter = 14, carry = false } = {}) {
  const r = seeded(seed), m = Math.min(CAP.coins, n);
  for (let i = 0; i < m; i++) {
    const d = delay + i * 0.06, ox = (r() - 0.5) * jitter, up = rise + r() * (jitter ? 10 : 0);
    fx.add({
      life: d + 0.62, layer: 1, coin: true, carry, hit: false,
      update: (dt, e) => { if (!e.hit && e.t >= d + 0.55) { e.hit = true; if (onHit) onHit(i); } },
      draw: (ctx, e) => {
        const t = e.t - d;
        if (t < 0) return;
        let x, y;
        if (t < 0.22) { const k = t / 0.22, q = 1 - (1 - k) * (1 - k); x = x0 + ox * q; y = y0 - up * q; }
        else { const k = Math.min(1, (t - 0.22) / 0.33), q = k * k; const sx = x0 + ox, sy = y0 - up; x = sx + (x1 - sx) * q; y = sy + (y1 - sy) * q - Math.sin(k * Math.PI) * 10; }
        const spin = Math.abs(Math.cos(t * 14));
        if (t >= 0.55) { const k = (t - 0.55) / 0.07; ctx.globalAlpha = 1 - k; spark(ctx, x1 + 5.5, y1 + 5.5, 3 + k * 5, PAL.goldHi); ctx.globalAlpha = 1; return; }
        drawCoin(ctx, x - 5, y - 5, { sx: Math.max(0.25, spin) });
      },
    });
  }
}

// 굵은 테 글: 잉크 테(글자 1배 기준 edgeW) 위에 굵은 글. 큰 이름표 · 꽂히는 수
export function boldText(ctx, s, x, y, col, { scale = 2, align = 'center', edge = PAL.frameDk, alpha = 1, edgeW = 0.75 } = {}) {
  const w = measure(s, true) * scale;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  // 굵은 글꼴 + 잉크 테 한 겹(둥근 이음 선을 한 번 구워 깐다 — 옛 여덟 방향 찍기는 벡터 글자 둘레가 흐린 네모 덩이가 됐다)
  text(ctx, s, lx, y, col, { bold: true, scale, alpha, edge, edgeW });
  return w;
}

// 진열 반짝 띠(귀함 · 전설 카드): 3.2초마다 한 번, 빗금 띠가 왼쪽 위에서 오른쪽 아래로 0.5초 동안 지나간다.
// 띠가 지나는 동안은 live, 쉬는 동안은 다음 띠가 시작하는 때를 beat로 알린다(첫 인자는 시각 그대로, 카드마다 어긋남은 phase)
export const SHEEN = { period: 3.2, pass: 0.6 };
export function sheen(ctx, x, y, w, h, time, phase = 0) {
  if (LOOK.calm) return;
  const rate = 1 / SHEEN.period, ph = phase * 0.37 % 1;
  beat(time, rate, ph);
  const k = ((time * rate + ph) % 1) * SHEEN.period / SHEEN.pass;
  if (k >= 1) return;
  live();
  const span = w + h, at = -10 + k * (span + 20);
  ctx.save();
  ctx.beginPath(); ctx.rect(Math.round(x) + 2, Math.round(y) + 2, Math.round(w) - 4, Math.round(h) - 4); ctx.clip();
  // 빗금 띠 셋(평행사변형): 금빛 앞 줄 · 흰 띠 · 흰 뒤 줄
  for (const [o, bw, col, a] of [[-3, 3, PAL.goldHi, 0.35], [0, 7, PAL.white, 0.85], [10, 3, PAL.white, 0.5]]) {
    const x1 = x + at + o;
    ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 + bw, y); ctx.lineTo(x1 + bw - h, y + h); ctx.lineTo(x1 - h, y + h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// 상금 수 흔들림: 바뀐 순간부터 0.4초 좌우로 흔들리고 빛깔이 번진다(상금 줄 · moneyRow). 동전이 닿으면 kickMoney로 한 번 더
// 기준값은 판마다(run): 판이 바뀌거나 이어 하기로 처음 그릴 때는 흔들지 않고 기준만 잡는다
const MONEY = { n: null, t: -9, up: true, run: null };
export function kickMoney(time) { MONEY.t = time; MONEY.up = true; }
export function moneyShake(n, time, run = null) {
  if (MONEY.run !== run) { MONEY.run = run; MONEY.n = n; MONEY.t = -9; }
  if (MONEY.n !== n) { if (MONEY.n != null) { MONEY.t = time; MONEY.up = n > MONEY.n; } MONEY.n = n; }
  const k = (time - MONEY.t) / 0.4;
  if (k < 0 || k >= 1) return null;
  live();
  return { dx: LOOK.calm ? 0 : -Math.round(Math.abs(Math.sin(k * Math.PI * 7)) * 3 * (1 - k)), hot: 1 - k, up: MONEY.up }; // 왼쪽으로만 떤다(오른쪽 테에 붙지 않게)
}
