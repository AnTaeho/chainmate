// 첫 화면 「달밤」(CHM-49, docs/design-notes/layout.md 「첫 화면」): 하늘 그라데이션 · 달(빛무리 · 분화구) · 반짝이는 별 ·
// 세 겹 기물 실루엣(정수 배율, 평행 이동) · 가장자리 어둡기, 그리고 하늘의 사슬(src/ui/skychain.js 장면)을 그린다.
// 그리기 함수는 모두 (g, x0, y0, w, h): 세계 좌표 [x0, x0 + w) × [y0, y0 + h)를 칠하고, g의 (0, 0) = 세계 (x0, y0).
// 게임 캔버스는 (0, 0, 480, 270) 둘레를, 여백 판(backdrop.js)은 창 전체를 같은 함수로 칠한다 — 겹치는 곳은 같은 도트다.
import { makeCanvas, context } from './surface.js';
import { spritePixels, spritePixelsHi, spriteCanvas } from './sprites.js';
import { LOOK, snap } from './look.js';
import { rect, text, fine } from './gfx.js';
import { PAL } from './palette.js';
import { openBox, closeBox } from './layoutlog.js';

const W = 480, H = 270;
const mod = (a, m) => ((a % m) + m) % m;

// ── 멈춘 바탕: 하늘(도트 한 줄마다 한 빛깔) · 달. fillRect만 쓴다(여백 판 시험의 기록 캔버스가 도트마다 잰다)
const SKY = [[0, [0x0a, 0x1a, 0x2a]], [0.6, [0x17, 0x3a, 0x44]], [1, [0x0c, 0x1d, 0x1f]]];
export function skyColor(y) {
  const v = Math.max(0, Math.min(1, (y + 0.5) / H));
  let i = 0;
  while (i < SKY.length - 2 && v > SKY[i + 1][0]) i++;
  const [a, ca] = SKY[i], [b, cb] = SKY[i + 1];
  const f = (v - a) / (b - a);
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export const MOON = { x: 380, y: 58, r: 28, halo: 64, craters: [[-9, -7, 4], [7, 5, 6], [-3, 12, 3], [12, -10, 3]] };
// 도트 원: 중심은 도트 모서리(cx, cy), 도트 가운데가 반지름 안이면 칠한다(줄마다 한 번)
function disc(g, x0, y0, cx, cy, r, col) {
  g.fillStyle = col;
  for (let y = Math.ceil(cy - r - 0.5); y <= Math.floor(cy + r - 0.5); y++) {
    const d = y + 0.5 - cy, hw = Math.sqrt(Math.max(0, r * r - d * d));
    const xa = Math.ceil(cx - hw - 0.5), xb = Math.floor(cx + hw - 0.5);
    if (xb >= xa) g.fillRect(xa - x0, y - y0, xb - xa + 1, 1);
  }
}
export function paintNight(g, x0, y0, w, h) {
  const top = SKY[0][1], bot = SKY[SKY.length - 1][1];
  // 위(y < 0)는 맨 위 빛깔, 아래(y ≥ 270)는 맨 아래 빛깔 그대로
  if (y0 < 0) { g.fillStyle = `rgb(${top.join(',')})`; g.fillRect(0, 0, w, Math.min(0, y0 + h) - y0); }
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) { g.fillStyle = skyColor(y); g.fillRect(0, y - y0, w, 1); }
  if (y0 + h > H) { g.fillStyle = `rgb(${bot.join(',')})`; g.fillRect(0, Math.max(H, y0) - y0, w, y0 + h - Math.max(H, y0)); }
  const M = MOON;
  disc(g, x0, y0, M.x, M.y, M.halo, 'rgba(255,240,200,0.07)');
  disc(g, x0, y0, M.x, M.y, M.r, '#f3e7c4');
  for (const [dx, dy, r] of M.craters) disc(g, x0, y0, M.x + dx, M.y + dy, r, '#dccfa8');
}

// ── 별: 480 × 150 칸마다 70개. 게임 칸(0, 0)은 시안 그대로(i × 131, i × 47), 다른 칸은 칸 번호 씨앗. 위(y < 150)에만
const STAR_W = 480, STAR_H = 150, STAR_N = 70;
const starCache = new Map();
function starCell(ci, cj) {
  const key = `${ci},${cj}`;
  let out = starCache.get(key);
  if (out) return out;
  out = [];
  if (ci === 0 && cj === 0) for (let i = 0; i < STAR_N; i++) out.push([(i * 131) % STAR_W, (i * 47) % STAR_H, i * 2.3]);
  else {
    let s = 1 + mod((ci * 73856093) ^ (cj * 19349663), 2147483645);
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < STAR_N; i++) out.push([Math.floor(rnd() * STAR_W), Math.floor(rnd() * STAR_H), rnd() * 7]);
  }
  for (const p of out) { p[0] += ci * STAR_W; p[1] += cj * STAR_H; }
  if (starCache.size > 64) starCache.clear();
  starCache.set(key, out);
  return out;
}
export function starsIn(x0, y0, w, h) {
  const out = [];
  for (let cj = Math.floor(y0 / STAR_H); cj <= Math.min(0, Math.floor((y0 + h - 1) / STAR_H)); cj++) {
    for (let ci = Math.floor(x0 / STAR_W); ci <= Math.floor((x0 + w - 1) / STAR_W); ci++) for (const p of starCell(ci, cj)) if (p[0] >= x0 && p[0] < x0 + w && p[1] >= y0 && p[1] < y0 + h) out.push(p);
  }
  return out;
}
export const starAlpha = (tw, ph) => 0.25 + 0.6 * Math.max(0, Math.sin(tw * 1.4 + ph));

// ── 실루엣 세 겹: [흐름 빠르기, 도트 배율(16×22 그림 한 도트가 몇 도트), 바닥 y, 빛깔]. 시안의 3 · 4 · 5배(3배 화면 기기 화소)를
// 1배 그림의 정수 배율 2 · 3 · 3으로 — 여백 판(도트 해상도)과 같은 그림이어야 게임 캔버스 가장자리에서 이어진다
export const SIL_LAYERS = [[0.15, 2, 214, '#1c3a3f'], [0.35, 3, 236, '#132a2d'], [0.7, 3, 262, '#0a1517']];
const SIL_KINDS = ['K', 'Q', 'R', 'B', 'N', 'P'];
const SIL_PERIOD = 620, SIL_N = 14;
// 겹마다 흐른 거리(정수 도트). 같은 겹의 실루엣은 함께 한 도트씩 옮겨 간다 — 여백 판은 이 값이 바뀔 때만 다시 칠한다
export const silShift = (t) => SIL_LAYERS.map(([sp]) => Math.round(t * sp * 18));
// 그 범위에 걸치는 실루엣: { kind, layer, x, y, sc } (x, y 정수 도트, 그림 왼쪽 위). 620도트마다 되풀이(시안은 -70에서 튀어 사라졌다)
export function silhouettesIn(t, x0, y0, w, h) {
  const out = [], shift = silShift(t);
  SIL_LAYERS.forEach(([, sc, base], L) => {
    const sw = 16 * sc, sh = 22 * sc, y = base - sh;
    if (y >= y0 + h || base <= y0) return;
    for (let i = 0; i < SIL_N; i++) {
      const x1 = mod(i * 47 + L * 29 - shift[L], SIL_PERIOD) - 70;
      for (let m = Math.floor((x0 - sw - x1) / SIL_PERIOD) + 1; x1 + m * SIL_PERIOD < x0 + w; m++) {
        const x = x1 + m * SIL_PERIOD;
        if (x + sw > x0) out.push({ kind: SIL_KINDS[(i * 5 + L) % 6], layer: L, x, y, sc });
      }
    }
  });
  return out;
}
const silCache = new Map();
function silCanvas(kind, col) {
  const key = `${kind}${col}`;
  let c = silCache.get(key);
  if (c) return c;
  c = makeCanvas(16, 22);
  const g = context(c);
  g.fillStyle = col;
  for (const [x, y] of spritePixels(kind)) g.fillRect(x, y, 1, 1);
  silCache.set(key, c);
  return c;
}
// 움직이는 바탕: 별(tw로 반짝임) · 실루엣(t로 흐름). 세계 범위 그대로(흔들림은 부르는 쪽이 옮긴다)
export function drawNightLive(g, x0, y0, w, h, t, tw) {
  g.fillStyle = '#fff8e8';
  for (const [x, y, ph] of starsIn(x0, y0, w, h)) { g.globalAlpha = starAlpha(tw, ph); g.fillRect(x - x0, y - y0, 1, 1); }
  g.globalAlpha = 1;
  for (const s of silhouettesIn(t, x0, y0, w, h)) g.drawImage(silCanvas(s.kind, SIL_LAYERS[s.layer][3]), s.x - x0, s.y - y0, 16 * s.sc, 22 * s.sc);
}

// ── 가장자리 어둡기: 게임 가운데(240, 135)에서 107도트까지 0, 300도트에서 0.5(그 밖은 0.5). 한 번 구워 늘 같은 자리에(흔들리지 않는다)
const VIG_IN = 320 / 3, VIG_OUT = 300, VIG_A = 0.5;
export const vignetteAlpha = (x, y) => VIG_A * Math.max(0, Math.min(1, (Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) - VIG_IN) / (VIG_OUT - VIG_IN)));
const vigCache = new Map();
export function drawVignette(g, x0, y0, w, h) {
  const key = `${x0},${y0},${w},${h}`;
  let c = vigCache.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    const cg = context(c);
    const img = cg.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = Math.round(vignetteAlpha(x0 + x, y0 + y) * 255);
    cg.putImageData(img, 0, 0);
    if (vigCache.size > 4) vigCache.clear();
    vigCache.set(key, c);
  }
  g.drawImage(c, 0, 0, w, h);
}

// ── 하늘의 사슬 그리기 ──────────────────────────────────────────────
// 기물 크기: 시안은 3배 화면에서 32×44 그림 한 도트를 기기 화소 2로 그렸다(⅔ 도트). 배율마다 기기 화소 정수로 맞춘다:
// N = 2 → 1(16×22 도트) · 3 → 2(21⅓ × 29⅓) · 4 → 3(24 × 33). N = 1은 옛 16×22 그림 한 도트 = 한 도트.
// u: 32×44 그림 한 칸의 도트 크기, px: 그리는 그림 한 칸의 도트 크기(1배 그림은 1)
export function skyScale(n = LOOK.n) {
  if (n < 2) return { hi: false, u: 0.5, px: 1 };
  const p = Math.max(1, Math.round((2 * n) / 3));
  return { hi: true, u: p / n, px: p / n };
}
const maskCache = new Map();
// 기물 모양(몸 · 테)을 한 빛깔로. grow: 네 이웃으로 한 칸 넓힌 빛 테(캔버스가 둘레 한 칸 크다)
function maskCanvas(type, hi, col, grow) {
  const key = `${type}${hi ? 2 : 1}${col}${grow ? 'g' : ''}`;
  let c = maskCache.get(key);
  if (c) return c;
  const px = (hi ? spritePixelsHi(type) : spritePixels(type)) || spritePixels('P');
  const k = hi ? 2 : 1, w = 16 * k, h = 22 * k, e = grow ? 1 : 0;
  c = makeCanvas(w + 2 * e, h + 2 * e);
  const g = context(c);
  g.fillStyle = col;
  for (const [x, y] of px) {
    if (grow) { g.fillRect(x, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 1, y + 2, 1, 1); }
    else g.fillRect(x, y, 1, 1);
  }
  maskCache.set(key, c);
  return c;
}
const ENEMY_RIM = '#9fd3e0', HERO_RIM = PAL.gold;
function piece(g, sc, type, side, x, y, alpha = 1) {
  const img = spriteCanvas(type, side, null, 0, sc.hi);
  g.globalAlpha = alpha;
  g.drawImage(img, snap(x), snap(y), 32 * sc.u, 44 * sc.u);
  g.globalAlpha = 1;
}
function rim(g, sc, type, col, x, y, alpha) {
  const img = maskCanvas(type, sc.hi, col, true);
  g.globalAlpha = alpha;
  g.drawImage(img, snap(x) - sc.px, snap(y) - sc.px, img.width * sc.px, img.height * sc.px);
  g.globalAlpha = 1;
}

// 먹은 자리 하나: 먼지(떨어진 쿵) · 금빛 고리 · 도트 조각(먹힌 기물 그림 4×4 조각, 중력) · 불티 · 「×N」
function drawHit(g, sc, h) {
  const z = 1.5 * sc.u, p = 1 + (h.n - 2) * 0.35;
  const cx = h.x + 10 * z, cy = h.y + 14 * z;
  if (h.dust) {
    const a = h.age / 0.3;
    g.globalAlpha = Math.max(0, 1 - a);
    for (let i = 0; i < 8; i++) rect(g, h.x + 10 * z + (i - 3.5) * 4 * (1 + a * 2), h.y + 28 * z - a * 4 - (i % 2) * 2, 2, 2, '#b8c7c0');
    g.globalAlpha = 1;
    return;
  }
  if (h.age < 0.45) {
    const a = h.age / 0.45, r = (6 + a * 22) * p;
    g.globalAlpha = 1 - a;
    for (let j = 0; j < 16; j++) { const ang = (j / 16) * Math.PI * 2; rect(g, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.8, 2, 2, j % 2 ? PAL.goldHi : PAL.gold); }
    g.globalAlpha = 1;
  }
  if (h.age < 1.1 && h.type) {
    const im = spriteCanvas(h.type, 'b', null, 0, sc.hi);
    // 조각 자리: 32×44 그림은 8 × 11 칸씩, 1배 16×22 그림은 4칸 · 줄 6 · 5 · 6 · 5
    const cols = sc.hi ? [0, 8, 16, 24] : [0, 4, 8, 12], cw = sc.hi ? 8 : 4;
    const rows = sc.hi ? [0, 11, 22, 33] : [0, 6, 11, 17], rh = sc.hi ? [11, 11, 11, 11] : [6, 5, 6, 5];
    const tt = h.age;
    g.globalAlpha = Math.max(0, 1 - tt / 1.1);
    for (let cy2 = 0; cy2 < 4; cy2++) for (let cx2 = 0; cx2 < 4; cx2++) {
      const id = cy2 * 4 + cx2, vx = (cx2 - 1.5) * 26 * p + Math.sin(id * 12.9) * 10, vy = -40 - (3 - cy2) * 12 + Math.cos(id * 7.3) * 10;
      const x = h.x + cols[cx2] * sc.px + vx * tt, y = h.y + rows[cy2] * sc.px + vy * tt + 160 * tt * tt;
      g.drawImage(im, cols[cx2], rows[cy2], cw, rh[cy2], snap(x), snap(y), cw * sc.px, rh[cy2] * sc.px);
    }
    g.globalAlpha = 1;
  }
  if (h.age < 0.5 && h.type) {
    const tt = h.age;
    g.globalAlpha = Math.max(0, 1 - tt / 0.5);
    for (let j = 0; j < 14 + h.n * 2; j++) {
      const ang = j * 2.39996, sp = (60 + (j % 5) * 22) * p, s = j % 3 ? 1 : 2;
      rect(g, cx + Math.cos(ang) * sp * tt, cy + Math.sin(ang) * sp * tt + 80 * tt * tt, s, s, j % 2 ? '#fff8e8' : PAL.goldHi);
    }
    g.globalAlpha = 1;
  }
  if (h.age < 0.9) {
    const a = h.age / 0.9, bounce = a < 0.2 ? -12 * Math.sin(((a / 0.2) * Math.PI) / 2) : -12 + (a - 0.2) * 6;
    const al = a > 0.7 ? (1 - a) / 0.3 : 1;
    text(g, `×${h.n}`, cx, h.y - 6 * z - (h.final ? 4 : 0) + bounce, h.final ? PAL.goldHi : PAL.gold, { align: 'center', bold: true, scale: h.final ? 2 : 1, shadow: PAL.shadow, alpha: al });
  }
}

// 장면 하나(skychain.js skyScene)를 그린다. 흔들림은 부르는 쪽이 옮긴다. 자리는 1/N 칸(fine), 그림 한 칸은 기기 화소 정수
export function drawSky(g, st, sc = skyScale()) {
  const z = 1.5 * sc.u;
  openBox('fx', 0, 0, W, H, 0, { loose: true, name: '하늘의 사슬' });
  fine(() => {
    for (const e of st.enemies) {
      if (st.eaten.includes(e.i)) continue;
      rim(g, sc, e.t, ENEMY_RIM, e.x, e.y, 0.55);
      piece(g, sc, e.t, 'b', e.x, e.y);
    }
    // 지나온 길: 4도트마다 금빛 점
    g.globalAlpha = 0.45;
    for (const [x0, y0, x1, y1] of st.trail) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, L / 4);
      for (let i = 0; i <= L / 4; i++) { const f = i / n; rect(g, x0 + (x1 - x0) * f + 10 * z, y0 + (y1 - y0) * f + 16 * z, 1, 1, PAL.gold); }
    }
    g.globalAlpha = 1;
    const h = st.hero;
    h.ghosts.forEach(([x, y], k) => piece(g, sc, h.t, 'w', x, y, 0.35 - k * 0.09));
    if (h.alpha > 0) {
      rim(g, sc, h.t, HERO_RIM, h.x, h.y, 0.9 * h.alpha);
      if (h.white) { g.globalAlpha = h.alpha; g.drawImage(maskCanvas(h.t, sc.hi, '#ffffff', false), snap(h.x), snap(h.y), 32 * sc.u, 44 * sc.u); g.globalAlpha = 1; }
      else piece(g, sc, h.t, 'w', h.x, h.y, h.alpha);
    }
    for (const hit of st.hits) drawHit(g, sc, hit);
  });
  closeBox();
}
