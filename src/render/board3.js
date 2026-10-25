// 대국 판의 투영(안 3, docs/design-notes/art3.md 3절): 칸 (f, r)과 화면 자리를 잇는다. 화면은 이 모듈의 project · unproject · 칸 경로 · 뒤에서 앞 차례만 쓴다.
// 손잡이는 VIEW.name 하나(diamond · shallow · flat, 지금은 정면 shallow) — 바꾸면 판 · 누르기 · 연출이 같이 따라간다. DOM 없이 돈다(연기 시험의 가짜 캔버스).
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';
import { LOOK, snap } from './look.js';
import { glyph } from './texture.js';
import { textGen } from './text.js';

// rot: 판을 돌린 각(도), tilt: 세로 눌림(칸 높이 / 칸 폭). 정면 판의 w: 판 폭(왼쪽 단 좌표 몫을 남긴다), bottom: 판 · 좌표가 내려올 수 있는 y(손 부채 위),
// rank: 단 좌표가 a줄 밖으로 나가는 칸 수(정면 판은 기물이 a줄 밖을 안 덮는다). tilt를 0.7 아래로 내리면 칸 높이가 PIECE_UP보다 너무 낮아 hitBox 가운데가 뒤 칸에 걸린다
export const VIEWS = {
  diamond: { rot: 45, tilt: 0.786 },
  shallow: { rot: 0, tilt: 0.72, w: 200, bottom: 206, rank: 0.45 },
  flat: { rot: 0, tilt: 1 },
};
export const VIEW = { name: 'shallow' };
// 판이 들어갈 자리(대국 화면의 판 자리 — battle.js BX · BY · S × 8과 같다)
export const AREA = { x: 128, y: 14, w: 224, h: 224 };
export const DEPTH = 5;     // 판 두께
export const RIM = 0.14;    // 칸 밖 크림 테(칸 단위)
export const PIECE_UP = 24; // 기물 꼭대기가 칸 가운데 위로 솟는 높이(기물 그림 26 중 받침 아래 2를 뺀 것)

let G = null;
export function setView(name) { if (!VIEWS[name]) throw new Error(`view ${name}`); VIEW.name = name; G = null; }
export function geo() { if (!G || G.name !== VIEW.name) G = build(VIEW.name); return G; }

function build(name) {
  const { rot, tilt, w: bw, bottom: yMax = AREA.y + AREA.h } = VIEWS[name];
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // 판 폭(8칸)이 자리 폭에 맞게: 반 칸 걸음을 정수로 둬 칸 가운데가 정수 자리에 선다
  const span = 8 * (Math.abs(c) + Math.abs(s));
  // 폭에 맞추되, 높이(판 + 솟는 기물 + 두께 · 좌표)가 자리를 넘으면 높이에 맞춘다(정면 판)
  const room = yMax - AREA.y - PIECE_UP - DEPTH - 8;
  const u = Math.min((bw || AREA.w) / span, room / ((Math.abs(s) + Math.abs(c)) * tilt * 7.5));
  const ef = { x: Math.round(u * c * 2) / 2, y: Math.round(u * s * tilt * 2) / 2 };
  const er = { x: Math.round(u * s * 2) / 2, y: -Math.round(u * c * tilt * 2) / 2 };
  // 판 모서리(단위 원점) → 자리 안 가운데. 위로 솟는 기물(PIECE_UP)과 아래 두께 · 좌표 글자를 넣어 세로 가운데
  const raw = (f, r) => ({ x: f * ef.x + r * er.x, y: f * ef.y + r * er.y });
  const cs = [raw(0, 0), raw(8, 0), raw(8, 8), raw(0, 8)];
  const minX = Math.min(...cs.map((p) => p.x)), maxX = Math.max(...cs.map((p) => p.x));
  const minY = Math.min(...cs.map((p) => p.y)), maxY = Math.max(...cs.map((p) => p.y));
  const cy = [];
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) cy.push(raw(f + 0.5, r + 0.5).y);
  const top = Math.min(minY, Math.min(...cy) - PIECE_UP), bottom = maxY + DEPTH + 8;
  const ox = Math.round(AREA.x + AREA.w / 2 - (minX + maxX) / 2);
  const oy = Math.round((AREA.y + yMax) / 2 - (top + bottom) / 2);
  const det = ef.x * er.y - ef.y * er.x;
  const g = { name, ef, er, ox, oy, det };
  g.at = (f, r) => ({ x: ox + f * ef.x + r * er.x, y: oy + f * ef.y + r * er.y });
  // 반 칸 폭 · 높이(칸 bbox의 반)
  g.hw = (Math.abs(ef.x) + Math.abs(er.x)) / 2;
  g.hh = (Math.abs(ef.y) + Math.abs(er.y)) / 2;
  const corners = [g.at(0, 0), g.at(8, 0), g.at(8, 8), g.at(0, 8)];
  g.bounds = box4(corners);
  g.order = Array.from({ length: 64 }, (_, i) => i).sort((p, q) => {
    const A = g.at((p & 7) + 0.5, (p >> 3) + 0.5), B = g.at((q & 7) + 0.5, (q >> 3) + 0.5);
    return A.y - B.y || A.x - B.x;
  });
  return g;
}
const box4 = (pts) => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  return { x, y, w: Math.ceil(Math.max(...xs)) - x, h: Math.ceil(Math.max(...ys)) - y };
};

// 칸 가운데(이어진 자리: f · r은 칸 번호, 소수도 된다 — 움직이는 기물)
export const centerAt = (f, r) => geo().at(f + 0.5, r + 0.5);
export const center = (sq) => centerAt(sq & 7, sq >> 3);
// 칸 하나: 가운데 · 꼭대기(가장 위 꼭짓점) · 네 꼭짓점(a1 쪽부터 돌아간다) · bbox
export function project(f, r) {
  const g = geo();
  const pts = [g.at(f, r), g.at(f + 1, r), g.at(f + 1, r + 1), g.at(f, r + 1)];
  const c = g.at(f + 0.5, r + 0.5);
  const top = pts.reduce((m, p) => (p.y < m.y ? p : m), pts[0]);
  return { x: c.x, y: c.y, top, pts, box: box4(pts) };
}
export const projectSq = (sq) => project(sq & 7, sq >> 3);
// 화면 자리 → 칸(판 밖이면 null)
export function unproject(x, y) {
  const g = geo(), dx = x - g.ox, dy = y - g.oy;
  const f = (dx * g.er.y - dy * g.er.x) / g.det, r = (g.ef.x * dy - g.ef.y * dx) / g.det;
  if (!(f >= 0 && f < 8 && r >= 0 && r < 8)) return null;
  return Math.floor(r) * 8 + Math.floor(f);
}
// 칸 bbox(바닥 칸만)
export const sqBox = (sq) => projectSq(sq).box;

// ── 누르기: 기물 · 사물이 선 칸은 그 몸 상자(가운데 ±BODY_W, 위로 몸 높이, 아래로 BODY_DOWN)도 가진다.
// 기물은 모든 바닥 위에 그리니 몸이 바닥을 이기고, 몸끼리는 앞(그리는 차례 뒤)이 이긴다. 빈 칸은 바닥 칸
export const BODY_W = 11, BODY_DOWN = 2;
// 사물의 몸 높이: 벽은 들인 윗면 꼭짓점까지, 보석은 윗면 띠까지
export function thingTop(t, g = geo()) { return t === 'X' ? Math.ceil(WALL.h + g.hh * WALL.inset) : 15; }
// topOf(sq) → 그 칸 몸 높이(0이면 빈 칸). 돌려주는 것: (x, y) → 칸(판 밖이면 null)
export function picker(topOf) {
  const g = geo(), tops = new Array(64), cx = new Array(64), cy = new Array(64);
  for (let sq = 0; sq < 64; sq++) { const c = center(sq); tops[sq] = topOf(sq) || 0; cx[sq] = c.x; cy[sq] = c.y; }
  return (x, y) => {
    for (let i = 63; i >= 0; i--) {
      const sq = g.order[i], h = tops[sq];
      if (h && x >= cx[sq] - BODY_W && x < cx[sq] + BODY_W && y >= cy[sq] - h && y < cy[sq] + BODY_DOWN) return sq;
    }
    return unproject(x, y);
  };
}
// 칸 누르는 구역의 bbox: 바닥 칸 + 가장 큰 몸(PIECE_UP). 기물 유무와 상관없이 같은 상자라, 가운데(가운데에서 위로 반 칸쯤)는
// 앞 칸 기물에 가리지 않아 늘 그 칸이다 — 연기 시험 · 찍기 도구의 bbox 가운데 누르기
export function hitBox(sq) {
  const g = geo(), c = center(sq);
  const x = Math.floor(c.x - g.hw), y = Math.floor(c.y - PIECE_UP);
  return { x, y, w: Math.ceil(c.x + g.hw) - x, h: Math.ceil(c.y + g.hh) - y };
}
// 뒤에서 앞 차례(칸 가운데의 화면 y, 같으면 x)
export const order = () => geo().order;
// 판 테두리 bbox(칸만)
export const bounds = () => geo().bounds;

// 칸 경로: inset만큼 가운데 쪽으로 줄인 사각(투영한 칸). 경로만 만든다
export function sqPath(ctx, sq, inset = 0) {
  const g = geo(), f = sq & 7, r = sq >> 3;
  const k = Math.max(0, 0.5 - inset / (2 * g.hw));
  const p = [g.at(f + 0.5 - k, r + 0.5 - k), g.at(f + 0.5 + k, r + 0.5 - k), g.at(f + 0.5 + k, r + 0.5 + k), g.at(f + 0.5 - k, r + 0.5 + k)];
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
}
export function fillSq(ctx, sq, col, inset = 0) { sqPath(ctx, sq, inset); ctx.fillStyle = col; ctx.fill(); }
// 테(선 굵기 w, 논리 px): 선이 칸 안쪽에 서게 반 굵기만큼 더 들인다
export function strokeSq(ctx, sq, col, w = 1, inset = 0, dash = null) {
  sqPath(ctx, sq, inset + w / 2);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'miter';
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}
// 칸 안에만 그린다(빗금 · 안개 줄)
export function clipSq(ctx, sq, fn, inset = 0) {
  ctx.save(); sqPath(ctx, sq, inset); ctx.clip();
  try { fn(sqBox(sq)); } finally { ctx.restore(); }
}
// 칸 가운데 고리(다음에 잡을 적)
export function ringSq(ctx, sq, col, w = 1, k = 0.62) {
  const g = geo(), c = center(sq);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, g.hw * k, g.hh * k, 0, 0, Math.PI * 2);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
// 판 테두리 경로(grow: 칸 단위로 바깥으로)
export function boardPath(ctx, grow = 0, px = 0) {
  const g = geo(), e = grow + px / (2 * g.hw);
  const p = [g.at(-e, -e), g.at(8 + e, -e), g.at(8 + e, 8 + e), g.at(-e, 8 + e)];
  ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
}

// ── 판 그림: 그림자 · 두께 · 크림 테 · 칸 · 좌표 글자를 N배 캔버스에 한 번 굽는다(세력 빛깔 · 배율 · 손잡이가 바뀌면 다시)
const SIDE_L = '#2e367a', SIDE_R = '#1f255c', INK = '#12153a';
const boardCache = new Map();
export function boardImage(n = LOOK.n) {
  const g = geo();
  const key = `${g.name}|${n}|${PAL.light}|${PAL.dark}|${textGen()}`; // 글꼴이 오면(textGen) 좌표 글자를 다시 굽는다
  let c = boardCache.get(key);
  if (c) return c;
  const b = g.bounds, pad = 22;
  const x0 = b.x - pad, y0 = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2 + DEPTH + 8;
  const cv = makeCanvas(w * n, h * n), x = context(cv);
  x.imageSmoothingEnabled = true;
  x.setTransform(n, 0, 0, n, -x0 * n, -y0 * n);
  const rim = [g.at(-RIM, -RIM), g.at(8 + RIM, -RIM), g.at(8 + RIM, 8 + RIM), g.at(-RIM, 8 + RIM)];
  const poly = (pts, dx = 0, dy = 0) => { x.beginPath(); x.moveTo(pts[0].x + dx, pts[0].y + dy); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i].x + dx, pts[i].y + dy); x.closePath(); };
  // 단색 그림자(틀 문법: 아래 · 오른쪽)
  x.globalAlpha = 0.45; x.fillStyle = PAL.drop; poly(rim, 3, DEPTH + 4); x.fill(); x.globalAlpha = 1;
  // 두께: 아래를 보는 변마다 옆면(왼쪽을 보면 밝게)
  for (let i = 0; i < 4; i++) {
    const p = rim[i], q = rim[(i + 1) % 4];
    const nx = q.y - p.y, ny = -(q.x - p.x); // 바깥 법선(시계 방향 꼭짓점이면 바깥)
    const out = (g.det < 0 ? -1 : 1);
    if (ny * out <= 0.01) continue;
    poly([p, q, { x: q.x, y: q.y + DEPTH }, { x: p.x, y: p.y + DEPTH }]);
    x.fillStyle = nx * out < 0 ? SIDE_L : SIDE_R; x.fill();
    x.strokeStyle = INK; x.lineWidth = 1; x.lineJoin = 'round'; x.stroke();
  }
  poly(rim); x.fillStyle = PAL.light; x.fill(); x.strokeStyle = INK; x.lineWidth = 1; x.stroke();
  for (let sq = 0; sq < 64; sq++) fillSq(x, sq, ((sq & 7) + (sq >> 3)) % 2 ? PAL.light : PAL.dark);
  // 좌표: 판 밖 가장자리(a~h는 1단 바깥 — 앞쪽이라 기물이 안 덮는다, 1~8은 a줄 바깥 — a줄 기물 머리보다 위로 비켜 rankOut만큼). 흐린 빛깔로 조용히
  x.fillStyle = PAL.dim; x.globalAlpha = 0.8;
  for (let f = 0; f < 8; f++) { const p = g.at(f + 0.5, -0.75); glyph(x, 'abcdefgh'[f], p.x - 1.5, p.y - 2.5); }
  for (let r = 0; r < 8; r++) { const p = g.at(-rankOut(g, r), r + 0.5); glyph(x, String(r + 1), p.x - 1.5, p.y - 2.5); }
  x.globalAlpha = 1;
  c = { cv, x: x0, y: y0, w, h };
  if (boardCache.size > 12) boardCache.clear();
  boardCache.set(key, c);
  return c;
}
// r단 좌표(1~8)가 a줄 바깥으로 나가는 칸 수: 글자(높이 6, 폭 5) 상자가 a줄 어느 칸의 기물(칸 가운데 ±11, 위로 PIECE_UP)과도 안 겹치는 가장 가까운 거리.
// 1은 앞 칸 기물이 없어 0.75(왼쪽 칸 배수 칸 옆으로 나가지 않는다)
export function rankOut(g = geo(), r = 7) {
  for (let d = VIEWS[g.name].rank ?? 0.75; d < 2.5; d += 0.05) {
    const clear = [...Array(8).keys()].every((k) => {
      const p = g.at(-d, r + 0.5), c = g.at(0.5, k + 0.5);
      return Math.abs(p.x - c.x) > 11 + 3 || p.y + 3 < c.y - PIECE_UP - 1 || p.y - 3 > c.y + 3;
    });
    if (clear) return d;
  }
  return 1.5;
}
export function drawBoardImage(ctx, n = LOOK.n) {
  const b = boardImage(n);
  ctx.drawImage(b.cv, b.x, b.y, b.w, b.h);
}

// ── 판 위 사물(벽 · 보석): 투영한 칸에서 세운 벡터 그림. 모든 칸이 같은 모양이라 (사물, 크기, 배율, 손잡이)마다 한 번 굽고 칸 가운데에 붙인다
export const THINGS = new Set(['X', 'J']);
const WALL = { top: '#a9b3ae', inner: '#8c9792', left: '#77827d', right: '#535d59', mortar: '#3a423f', h: 7, inset: 0.84 };
const GEM = { light: '#6fd8e6', dark: '#2f9fb0', table: '#bff3f8', facet: '#1f7280', hi: '#ffffff' };
const thingCache = new Map();
// f: 판 위 크기에 대한 배율(판 밖 맞춤 그림이 쓴다). 돌려주는 것: { cv, w, h, ox, oy(칸 가운데 자리), below(가운데에서 그림 아래까지) }
export function thingImage(t, n = LOOK.n, f = 1) {
  const g = geo();
  f = Math.round(f * 8) / 8;
  const key = `${t}|${g.name}|${n}|${f}`;
  let c = thingCache.get(key);
  if (c) return c;
  // 칸 가운데를 원점으로 한 꼭짓점(벽은 조금 들여 세운다)
  const k = t === 'X' ? WALL.inset / 2 : 0;
  const ef = { x: g.ef.x * f, y: g.ef.y * f }, er = { x: g.er.x * f, y: g.er.y * f };
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: (a * ef.x + b * er.x) * k, y: (a * ef.y + b * er.y) * k }));
  const H = WALL.h * f;
  const box = t === 'X'
    ? { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)) - H, y1: Math.max(...pts.map((p) => p.y)) }
    : { x0: -9 * f, x1: 9 * f, y0: -15 * f, y1: 4 * f };
  const pad = 2, x0 = Math.floor(box.x0) - pad, y0 = Math.floor(box.y0) - pad;
  const w = Math.ceil(box.x1) + pad - x0, h = Math.ceil(box.y1) + pad - y0;
  const cv = makeCanvas(w * n, h * n), x = context(cv);
  x.imageSmoothingEnabled = true;
  x.setTransform(n, 0, 0, n, -x0 * n, -y0 * n);
  const lw = Math.max(1 / n, 0.9 * f);
  x.lineJoin = 'round';
  const poly = (ps, dy = 0) => { x.beginPath(); x.moveTo(ps[0].x, ps[0].y + dy); for (let i = 1; i < ps.length; i++) x.lineTo(ps[i].x, ps[i].y + dy); x.closePath(); };
  const seg = (a, b, col, wd) => { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.strokeStyle = col; x.lineWidth = wd; x.stroke(); };
  const mix = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  if (t === 'X') {
    // 낮은 돌 덩이: 아래를 보는 옆면 둘(왼쪽 밝게) → 윗면. 옆면에 줄눈 한 줄 · 엇갈린 이음매
    const top = pts.map((p) => ({ x: p.x, y: p.y - H }));
    for (let i = 0; i < 4; i++) {
      const p = pts[i], q = pts[(i + 1) % 4];
      if ((p.y + q.y) / 2 <= 0.01) continue;
      const tp = top[i], tq = top[(i + 1) % 4];
      poly([tp, tq, q, p]);
      x.fillStyle = (p.x + q.x) / 2 < 0 ? WALL.left : WALL.right; x.fill();
      const ml = mix(tp, p, 0.5), mr = mix(tq, q, 0.5);
      seg(ml, mr, WALL.mortar, lw * 0.8);
      seg(mix(mix(tp, tq, 0.35), mix(p, q, 0.35), 0), mix(mix(tp, tq, 0.35), mix(p, q, 0.35), 0.5), WALL.mortar, lw * 0.8);
      seg(mix(mix(tp, tq, 0.7), mix(p, q, 0.7), 0.5), mix(mix(tp, tq, 0.7), mix(p, q, 0.7), 1), WALL.mortar, lw * 0.8);
      poly([tp, tq, q, p]); x.strokeStyle = INK; x.lineWidth = lw; x.stroke();
    }
    poly(top); x.fillStyle = WALL.top; x.fill();
    const inn = top.map((p) => ({ x: p.x * 0.62, y: p.y * 0.62 - H * 0.38 }));
    poly(inn); x.strokeStyle = WALL.inner; x.lineWidth = lw * 0.9; x.stroke();
    poly(top); x.strokeStyle = INK; x.lineWidth = lw; x.stroke();
    c = { below: box.y1 };
  } else {
    // 보석: 칸 위에 선 깎은 돌(정면) — 바닥 그림자 · 왼쪽 밝은 면 · 오른쪽 그늘 면 · 윗면 띠 · 면 금 · 빛 한 점
    x.globalAlpha = 0.3; x.beginPath(); x.ellipse(0, 1.5 * f, 7.5 * f, 2.4 * f, 0, 0, Math.PI * 2); x.fillStyle = '#000'; x.fill(); x.globalAlpha = 1;
    const P = (a, b) => ({ x: a * f, y: b * f });
    const TL = P(-5, -13), TR = P(5, -13), R = P(8.5, -8), B = P(0, 1.5), L = P(-8.5, -8), ML = P(-2.5, -8), MR = P(2.5, -8);
    poly([TL, TR, R, B, L]); x.fillStyle = GEM.light; x.fill();
    x.save(); x.beginPath(); x.rect(0, -20 * f, 20 * f, 30 * f); x.clip(); poly([TL, TR, R, B, L]); x.fillStyle = GEM.dark; x.fill(); x.restore();
    poly([TL, TR, MR, ML]); x.fillStyle = GEM.table; x.fill();
    seg(L, R, GEM.facet, lw * 0.8); seg(ML, B, GEM.facet, lw * 0.8); seg(MR, B, GEM.facet, lw * 0.8);
    seg(TL, ML, GEM.facet, lw * 0.8); seg(TR, MR, GEM.facet, lw * 0.8);
    poly([TL, TR, R, B, L]); x.strokeStyle = INK; x.lineWidth = lw; x.stroke();
    x.beginPath(); x.arc(-3.5 * f, -10.5 * f, 1.1 * f, 0, Math.PI * 2); x.fillStyle = GEM.hi; x.fill();
    c = { below: 1.5 * f + 2.4 * f };
  }
  Object.assign(c, { cv, n, w: cv.width / n, h: cv.height / n, ox: -x0, oy: -y0 });
  if (thingCache.size > 60) thingCache.clear();
  thingCache.set(key, c);
  return c;
}
// 그리는 곳의 배율(정수): vec.js scaleOf와 같이 12배까지(각성 막간 카드 3배 × N 3 = 9)
const nOf = (ctx) => { const m = ctx && ctx.getTransform ? ctx.getTransform() : null; const a = m && typeof m.a === 'number' ? Math.hypot(m.a, m.b) : LOOK.n; return Math.max(1, Math.min(12, Math.round(a))); };
// 판 위: 칸 가운데 (cx, cy)에
export function drawThing(ctx, t, cx, cy, alpha = 1) { drawThing2(ctx, thingImage(t, nOf(ctx)), cx, cy, alpha); }
// 판 밖: 기물 크기(120 상자 논리 폭 w120)에 맞춘 사물을 가운데 cx, 아래 by에
export function drawThingFit(ctx, t, cx, by, w120, alpha = 1) {
  const c = thingImage(t, nOf(ctx), w120 / 22);
  drawThing2(ctx, c, cx, by - c.below, alpha);
}
function drawThing2(ctx, c, cx, cy, alpha) {
  const a0 = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(c.cv, snap(cx - c.ox), snap(cy - c.oy), c.w, c.h);
  ctx.globalAlpha = a0;
}
