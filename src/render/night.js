// 첫 화면 「달밤」(CHM-49, docs/design-notes/layout.md 「첫 화면」): 하늘 그라데이션 · 달(빛무리 · 분화구) · 반짝이는 별 ·
// 세 겹 기물 실루엣(정수 배율, 평행 이동) · 가장자리 어둡기, 그리고 하늘의 사슬(src/ui/skychain.js 장면)을 그린다.
// 그리기 함수는 모두 (g, x0, y0, w, h): 세계 좌표 [x0, x0 + w) × [y0, y0 + h)를 칠하고, g의 (0, 0) = 세계 (x0, y0).
// 게임 캔버스는 (0, 0, 480, 270) 둘레를, 여백 판(backdrop.js)은 창 전체를 같은 함수로 칠한다 — 겹치는 곳은 같은 도트다.
import { makeCanvas, context } from './surface.js';
import { fitPiece, fitAt, pieceMask, drawMask, pieceCanvas, scaleOf } from './pieces3.js';
import { INK, bake } from './vec.js';
import { LOOK, snap } from './look.js';
import { rect, dot, text, fine, measure } from './gfx.js';
import { PAL } from './palette.js';
import { openBox, closeBox } from './layoutlog.js';

const W = 480, H = 270;
const mod = (a, m) => ((a % m) + m) % m;

// ── 멈춘 바탕: 하늘(도트 한 줄마다 한 빛깔) fillRect만 쓴다(여백 판 시험의 기록 캔버스가 도트마다 잰다). 달은 벡터(drawNightLive)
const SKY = [[0, [0x0a, 0x0c, 0x26]], [0.6, [0x1d, 0x22, 0x56]], [1, [0x0c, 0x0e, 0x24]]];
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
export function paintNight(g, x0, y0, w, h) {
  const top = SKY[0][1], bot = SKY[SKY.length - 1][1];
  // 위(y < 0)는 맨 위 빛깔, 아래(y ≥ 270)는 맨 아래 빛깔 그대로
  if (y0 < 0) { g.fillStyle = `rgb(${top.join(',')})`; g.fillRect(0, 0, w, Math.min(0, y0 + h) - y0); }
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) { g.fillStyle = skyColor(y); g.fillRect(0, y - y0, w, 1); }
  if (y0 + h > H) { g.fillStyle = `rgb(${bot.join(',')})`; g.fillRect(0, Math.max(H, y0) - y0, w, y0 + h - Math.max(H, y0)); }
}
// 달(안 3 벡터): 달무리 + 크림 두 톤(왼쪽 빛 · 오른쪽 그늘) + 잉크 테 + 그늘진 분화구. 배율마다 한 번 굽는다
function paintMoon(g) {
  const M = MOON, c = M.halo;
  const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  circle(c, c, M.halo); g.fillStyle = 'rgba(255,240,200,0.07)'; g.fill();
  circle(c, c, M.r); g.fillStyle = '#f3e7c4'; g.fill();
  g.save(); circle(c, c, M.r); g.clip(); circle(c + M.r * 0.55, c + M.r * 0.2, M.r * 1.02); g.fillStyle = '#dccfa8'; g.fill();
  for (const [dx, dy, r] of M.craters) { circle(c + dx, c + dy, r); g.fillStyle = '#c9b98e'; g.fill(); circle(c + dx - r * 0.25, c + dy - r * 0.25, r * 0.7); g.fillStyle = '#e4d6b0'; g.fill(); }
  g.restore();
  circle(c, c, M.r); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
}
const moonImg = (n) => bake('moon', MOON.halo * 2, MOON.halo * 2, n, paintMoon);
// 별 하나: 둥근 빛 점(굵은 별은 네 뿔 반짝). 5 × 5 상자, 배율마다 한 번
const starImg = (big, n) => bake(`nstar${big ? 1 : 0}`, 5, 5, n, (g) => {
  g.fillStyle = '#fff8e8';
  if (big) { g.beginPath(); for (let i = 0; i < 8; i++) { const q = (i * Math.PI) / 4, d = i % 2 ? 0.55 : 2.3; (i ? g.lineTo : g.moveTo).call(g, 2.5 + Math.cos(q) * d, 2.5 + Math.sin(q) * d); } g.closePath(); g.fill(); return; }
  g.globalAlpha = 0.35; g.beginPath(); g.arc(2.5, 2.5, 1.1, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1; g.beginPath(); g.arc(2.5, 2.5, 0.6, 0, Math.PI * 2); g.fill();
});

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
export const SIL_LAYERS = [[0.15, 2, 214, '#212759'], [0.35, 3, 236, '#161a40'], [0.7, 3, 262, '#0a0c22']];
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
// 실루엣 한 빛깔: 16sc × 22sc 상자에 맞춘 벡터 기물 모양(pieces3.js pieceMask — 크기 · 빛깔 · 배율마다 한 번 굽는다).
// 게임 캔버스(N배)와 여백 판(1배)이 같은 상자 · 같은 자리에 제 배율로 그린다
function drawSil(g, kind, col, x, y, sc) {
  const f = fitAt(x, y, 16 * sc, 22 * sc);
  drawMask(g, pieceMask(kind, col, { w: f.w, n: scaleOf(g) }), f.cx, f.cy);
}
// 움직이는 바탕: 별(tw로 반짝임) · 실루엣(t로 흐름). 세계 범위 그대로(흔들림은 부르는 쪽이 옮긴다)
export function drawNightLive(g, x0, y0, w, h, t, tw) {
  const n = scaleOf(g), small = starImg(false, n), big = starImg(true, n);
  for (const [x, y, ph] of starsIn(x0, y0, w, h)) { g.globalAlpha = starAlpha(tw, ph); g.drawImage(Math.floor(ph * 10) % 6 === 0 ? big : small, x - x0 - 2, y - y0 - 2, 5, 5); }
  g.globalAlpha = 1;
  const M = MOON, mr = M.halo;
  if (M.x + mr > x0 && M.x - mr < x0 + w && M.y + mr > y0 && M.y - mr < y0 + h) g.drawImage(moonImg(n), M.x - mr - x0, M.y - mr - y0, mr * 2, mr * 2);
  for (const s of silhouettesIn(t, x0, y0, w, h)) drawSil(g, s.kind, SIL_LAYERS[s.layer][3], s.x - x0, s.y - y0, s.sc);
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
// 기물 상자(32 × 44 그림 칸 크기)에 맞춘 벡터 기물(pieces3.js fitPiece)과 그 모양 한 빛깔(빛 테 · 흰 번쩍임)
const boxOf = (sc, x, y) => fitAt(snap(x), snap(y), 32 * sc.u, 44 * sc.u);
const ENEMY_RIM = '#9fd3e0', HERO_RIM = PAL.gold;
function piece(g, sc, type, side, x, y, alpha = 1) {
  fitPiece(g, type, side, snap(x), snap(y), 32 * sc.u, 44 * sc.u, { alpha });
}
function mask(g, sc, type, col, x, y, alpha, grow) {
  const f = boxOf(sc, x, y), n = scaleOf(g);
  drawMask(g, pieceMask(type, col, { w: f.w, n, grow: grow ? Math.max(1, Math.round(sc.px * n)) : 0 }), f.cx, f.cy, alpha);
}
function rim(g, sc, type, col, x, y, alpha) { mask(g, sc, type, col, x, y, alpha, true); }

// 먹은 자리 하나: 먼지(떨어진 쿵) · 금빛 고리 · 도트 조각(먹힌 기물 그림 4×4 조각, 중력) · 불티 · 「×N」
// keep: 「×N」이 넘지 않을 네모 { x0, x1, y1 }(부제) — 그 아래에서 튀는 높이만 줄인다(시간표 · 다른 자리는 그대로, CHM-48)
function drawHit(g, sc, h, keep = null) {
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
    // 조각: 먹힌 기물 그림을 4 × 4 칸으로 잘라 흩는다
    const f = boxOf(sc, h.x, h.y), im = pieceCanvas(h.type, 'b', { w: f.w, n: scaleOf(g) });
    const sw = im.cv.width / 4, sh = im.cv.height / 4, dw = im.w / 4, dh = im.h / 4, x0 = f.cx - im.ox, y0 = f.cy - im.oy;
    const tt = h.age;
    g.globalAlpha = Math.max(0, 1 - tt / 1.1);
    for (let cy2 = 0; cy2 < 4; cy2++) for (let cx2 = 0; cx2 < 4; cx2++) {
      const id = cy2 * 4 + cx2, vx = (cx2 - 1.5) * 26 * p + Math.sin(id * 12.9) * 10, vy = -40 - (3 - cy2) * 12 + Math.cos(id * 7.3) * 10;
      const x = x0 + cx2 * dw + vx * tt, y = y0 + cy2 * dh + vy * tt + 160 * tt * tt;
      g.drawImage(im.cv, cx2 * sw, cy2 * sh, sw, sh, snap(x), snap(y), dw, dh);
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
    const s = `×${h.n}`, scale = h.final ? 2 : 1, top = h.y - 6 * z - (h.final ? 4 : 0);
    // 튀는 높이 12도트. 부제 바로 아래 자리(y 108 · 112)에서는 부제 밑변까지만
    let jump = 12;
    if (keep) { const hw = (measure(s, true) * scale) / 2; if (cx + hw > keep.x0 && cx - hw < keep.x1) jump = Math.max(0, Math.min(12, top - keep.y1)); }
    const a = h.age / 0.9, bounce = (a < 0.2 ? -12 * Math.sin(((a / 0.2) * Math.PI) / 2) : -12 + (a - 0.2) * 6) * (jump / 12);
    const al = a > 0.7 ? (1 - a) / 0.3 : 1;
    text(g, s, cx, top + bounce, h.final ? PAL.goldHi : PAL.gold, { align: 'center', bold: true, scale, shadow: PAL.shadow, alpha: al });
  }
}

// 장면 하나(skychain.js skyScene)를 그린다. 흔들림은 부르는 쪽이 옮긴다. 자리는 1/N 칸(fine), 그림 한 칸은 기기 화소 정수
// keep: 「×N」이 넘지 않을 네모(부제, drawHit)
export function drawSky(g, st, sc = skyScale(), keep = null) {
  const z = 1.5 * sc.u;
  openBox('fx', 0, 0, W, H, 0, { loose: true, name: '하늘의 사슬' });
  fine(() => {
    for (const e of st.enemies) {
      if (st.eaten.includes(e.i)) continue;
      rim(g, sc, e.t, ENEMY_RIM, e.x, e.y, 0.55);
      piece(g, sc, e.t, 'b', e.x, e.y);
    }
    // 지나온 길: 4칸마다 둥근 금빛 점
    g.globalAlpha = 0.45;
    for (const [x0, y0, x1, y1] of st.trail) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, L / 4);
      for (let i = 0; i <= L / 4; i++) { const f = i / n; dot(g, x0 + (x1 - x0) * f + 10 * z - 0.2, y0 + (y1 - y0) * f + 16 * z - 0.2, 1.4, PAL.gold); }
    }
    g.globalAlpha = 1;
    const h = st.hero;
    h.ghosts.forEach(([x, y], k) => piece(g, sc, h.t, 'w', x, y, 0.35 - k * 0.09));
    if (h.alpha > 0) {
      rim(g, sc, h.t, HERO_RIM, h.x, h.y, 0.9 * h.alpha);
      if (h.white) mask(g, sc, h.t, '#ffffff', h.x, h.y, h.alpha, false);
      else piece(g, sc, h.t, 'w', h.x, h.y, h.alpha);
    }
    for (const hit of st.hits) drawHit(g, sc, hit, keep);
  });
  closeBox();
}
