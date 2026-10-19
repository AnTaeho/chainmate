// 손맛 연출(layout.md 28절): 잡기 연기 · 동전 · 색종이 · 화면 번쩍 · 굵은 테 글 · 진열 반짝 띠 · 상금 흔들림.
// 모두 Fx(따로 도는 효과)라 한 수 연출 시간(Seq)을 늘리지 않는다. 무작위는 시드, 개수는 CAP 안. 움직임 줄이기면 부르는 쪽이 끄거나 정지 그림으로.
import { PAL } from '../render/palette.js';
import { W, H, rect, text, measure } from '../render/gfx.js';
import { live, beat, LOOK } from '../render/look.js';

export const CAP = { chips: 12, puffs: 7, coins: 6, coinsLine: 6, confetti: 40, sparks: 24 };
export const seeded = (seed) => { let s = (seed * 2654435761) & 0x7fffffff || 1; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
// 1/N 칸 계단의 배율(뒷면 N배에서 글자 도트가 고르게 선다)
export const stepScale = (s) => Math.round(s * LOOK.n) / LOOK.n;

// 연기 덩어리: 잡힌 칸에서 흰 덩어리가 부풀었다 오그라들며 흩어진다(네모 둘을 겹친 둥근 도트). 테를 먼저 다 깔고 흰 몸을 얹어 한 덩이 구름으로 보인다
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
  const h = s / 2;
  if (s <= 3) { rect(ctx, cx - h, cy - h, s, s, col); return; }
  const c = s >= 7 ? 2 : 1;
  rect(ctx, cx - h + c, cy - h, s - 2 * c, s, col);
  rect(ctx, cx - h, cy - h + c, s, s - 2 * c, col);
  if (c === 2) rect(ctx, cx - h + 1, cy - h + 1, s - 2, s - 2, col);
}

// 화면 번쩍: 온 화면을 덮는 빛(0.2초 안팎). col 흰빛 · 금빛
export function screenFlash(fx, { col = PAL.white, a = 0.5, life = 0.22 } = {}) {
  return fx.add({ life, layer: 1, draw: (ctx, e) => { ctx.globalAlpha = a * (1 - e.t / e.life) ** 2; rect(ctx, -8, -8, W + 16, H + 16, col); ctx.globalAlpha = 1; } });
}

// 반짝이 터짐: 한 점에서 별 반짝(십자 도트)이 사방으로 튀고 천천히 가라앉는다
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
        if (p.big && k < 0.55) { rect(ctx, p.x - 1, p.y, 3, 1, p.col); rect(ctx, p.x, p.y - 1, 1, 3, p.col); }
        else rect(ctx, p.x, p.y, 1, 1, p.col);
      }
      ctx.globalAlpha = 1;
    },
  });
}

// 색종이: 위에서 터져 흩날리며 떨어지는 도트 조각(가로 · 세로로 납작해졌다 펴지는 것으로 뒤집힘을 보인다)
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
        const flat = Math.abs(Math.sin(p.ph)) < 0.35; rect(ctx, p.x, p.y, flat ? 1 : p.w, flat ? p.w : 3, p.col);
      }
      ctx.globalAlpha = 1;
      if (ar) ctx.restore();
    },
  });
  if (tag) e[tag] = true;
  return e;
}

// 「$」 동전(11×11): 금빛 둥근 판 + 어두운 테 + 가운데 $. 한 번 굽고 늘 같은 그림
let coinImg = null;
function coinCanvas() {
  if (coinImg) return coinImg;
  const n = 4, c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c || !c.getContext) return null;
  c.width = 11 * n; c.height = 11 * n;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(n, n);
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(3, 0, 5, 11, PAL.goldDk); px(0, 3, 11, 5, PAL.goldDk); px(1, 1, 9, 9, PAL.goldDk);
  px(3, 1, 5, 9, PAL.gold); px(1, 3, 9, 5, PAL.gold); px(2, 2, 7, 7, PAL.gold);
  px(3, 1, 4, 1, PAL.goldHi); px(2, 2, 1, 2, PAL.goldHi); px(1, 3, 1, 2, PAL.goldHi);
  // $: 5×7 도트
  const D = PAL.goldDk, S = ['.###.', '#.#..', '.###.', '..#.#', '.###.'];
  px(5, 2, 1, 7, D);
  S.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') px(3 + i, 3 + j, 1, 1, D); }));
  coinImg = c;
  return c;
}
export function drawCoin(ctx, x, y, { alpha = 1, sx = 1 } = {}) {
  const c = coinCanvas();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const w = Math.max(1, Math.round(11 * sx));
  if (c) ctx.drawImage(c, x + Math.floor((11 - w) / 2), y, w, 11);
  else { rect(ctx, x, y, 11, 11, PAL.gold); }
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// 동전이 (x0, y0)에서 솟았다가 (x1, y1)로 날아간다. n개는 조금씩 늦게. 닿을 때마다 onHit(동전 소리 · 상금 흔들림)
// jitter: 솟는 자리의 좌우 흩어짐(보상 화면은 0 — 금액 오른쪽 한 줄로 내려가 글을 덮지 않는다)
export function flyCoins(fx, x0, y0, x1, y1, { n = 3, seed = 9, delay = 0, onHit = null, rise = 22, jitter = 14 } = {}) {
  const r = seeded(seed), m = Math.min(CAP.coins, n);
  for (let i = 0; i < m; i++) {
    const d = delay + i * 0.06, ox = (r() - 0.5) * jitter, up = rise + r() * (jitter ? 10 : 0);
    fx.add({
      life: d + 0.62, layer: 1, coin: true, hit: false,
      update: (dt, e) => { if (!e.hit && e.t >= d + 0.55) { e.hit = true; if (onHit) onHit(i); } },
      draw: (ctx, e) => {
        const t = e.t - d;
        if (t < 0) return;
        let x, y;
        if (t < 0.22) { const k = t / 0.22, q = 1 - (1 - k) * (1 - k); x = x0 + ox * q; y = y0 - up * q; }
        else { const k = Math.min(1, (t - 0.22) / 0.33), q = k * k; const sx = x0 + ox, sy = y0 - up; x = sx + (x1 - sx) * q; y = sy + (y1 - sy) * q - Math.sin(k * Math.PI) * 10; }
        const spin = Math.abs(Math.cos(t * 14));
        if (t >= 0.55) { const k = (t - 0.55) / 0.07; ctx.globalAlpha = 1 - k; rect(ctx, x1 - 1 - k * 4, y1 + 5, 3 + k * 8, 1, PAL.goldHi); rect(ctx, x1 + 5, y1 - 1 - k * 4, 1, 3 + k * 8, PAL.goldHi); ctx.globalAlpha = 1; return; }
        drawCoin(ctx, x - 5, y - 5, { sx: Math.max(0.25, spin) });
      },
    });
  }
}

// 굵은 테 글: 어두운 테 두 겹(1 · 2도트 여덟 방향) 위에 글. 큰 이름표 · 꽂히는 수
export function boldText(ctx, s, x, y, col, { scale = 2, align = 'center', edge = PAL.shadow, alpha = 1 } = {}) {
  const w = measure(s, true) * scale;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const o = Math.max(1, Math.round(scale / 2));
  for (const d of [o + 1, o]) for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) text(ctx, s, lx + dx * d, y + dy * d, edge, { bold: true, scale });
  text(ctx, s, lx, y, col, { bold: true, scale });
  if (alpha !== 1) ctx.globalAlpha = 1;
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
  for (let yy = 0; yy < h; yy += 2) {
    const cx = x + at - yy;
    ctx.globalAlpha = 0.35; rect(ctx, cx - 3, y + yy, 3, 2, PAL.goldHi);
    ctx.globalAlpha = 0.85; rect(ctx, cx, y + yy, 7, 2, PAL.white);
    ctx.globalAlpha = 0.5; rect(ctx, cx + 10, y + yy, 3, 2, PAL.white);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// 상금 수 흔들림: 바뀐 순간부터 0.4초 좌우로 흔들리고 빛깔이 번진다(상금 줄 · moneyRow). 동전이 닿으면 kickMoney로 한 번 더
const MONEY = { n: null, t: -9, up: true };
export function kickMoney(time) { MONEY.t = time; MONEY.up = true; }
export function moneyShake(n, time) {
  if (MONEY.n !== n) { if (MONEY.n != null) { MONEY.t = time; MONEY.up = n > MONEY.n; } MONEY.n = n; }
  const k = (time - MONEY.t) / 0.4;
  if (k < 0 || k >= 1) return null;
  live();
  return { dx: LOOK.calm ? 0 : -Math.round(Math.abs(Math.sin(k * Math.PI * 7)) * 3 * (1 - k)), hot: 1 - k, up: MONEY.up }; // 왼쪽으로만 떤다(오른쪽 테에 붙지 않게)
}
