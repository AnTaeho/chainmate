// 대국 판의 투영(안 3, docs/design-notes/art3.md 3절): 칸 (f, r)과 화면 자리를 잇는다. 화면은 이 모듈의 project · unproject · 칸 경로 · 뒤에서 앞 차례만 쓴다.
// 손잡이는 VIEW.name 하나(diamond · shallow · flat) — 바꾸면 판 · 누르기 · 연출이 같이 따라간다. DOM 없이 돈다(연기 시험의 가짜 캔버스).
import { PAL } from './palette.js';
import { makeCanvas, context } from './surface.js';
import { LOOK } from './look.js';
import { glyph } from './texture.js';

// rot: 판을 돌린 각(도), tilt: 세로 눌림(칸 높이 / 칸 폭)
export const VIEWS = {
  diamond: { rot: 45, tilt: 0.786 },
  shallow: { rot: 0, tilt: 0.75 },
  flat: { rot: 0, tilt: 1 },
};
export const VIEW = { name: 'diamond' };
// 판이 들어갈 자리(대국 화면의 판 자리 — battle.js BX · BY · S × 8과 같다)
export const AREA = { x: 128, y: 30, w: 224, h: 224 };
export const DEPTH = 5;     // 판 두께
export const RIM = 0.14;    // 칸 밖 크림 테(칸 단위)
export const PIECE_UP = 24; // 기물 꼭대기가 칸 가운데 위로 솟는 높이(기물 그림 26 중 받침 아래 2를 뺀 것)

let G = null;
export function setView(name) { if (!VIEWS[name]) throw new Error(`view ${name}`); VIEW.name = name; G = null; }
export function geo() { if (!G || G.name !== VIEW.name) G = build(VIEW.name); return G; }

function build(name) {
  const { rot, tilt } = VIEWS[name];
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // 판 폭(8칸)이 자리 폭에 맞게: 반 칸 걸음을 정수로 둬 칸 가운데가 정수 자리에 선다
  const span = 8 * (Math.abs(c) + Math.abs(s));
  // 폭에 맞추되, 높이(판 + 솟는 기물 + 두께 · 좌표)가 자리를 넘으면 높이에 맞춘다(정면 판)
  const room = AREA.h - PIECE_UP - DEPTH - 8;
  const u = Math.min(AREA.w / span, room / ((Math.abs(s) + Math.abs(c)) * tilt * 7.5));
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
  const oy = Math.round(AREA.y + AREA.h / 2 - (top + bottom) / 2);
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
// 칸 bbox(누르는 구역 — 가운데가 칸 가운데)
export const sqBox = (sq) => projectSq(sq).box;
// 뒤에서 앞 차례(칸 가운데의 화면 y, 같으면 x)
export const order = () => geo().order;
// 판 테두리 bbox(칸만)
export const bounds = () => geo().bounds;

// 칸 경로: inset만큼 가운데 쪽으로 줄인 사각(마름모). 경로만 만든다
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
  const key = `${g.name}|${n}|${PAL.light}|${PAL.dark}`;
  let c = boardCache.get(key);
  if (c) return c;
  const b = g.bounds, pad = 12;
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
  // 좌표: 판 밖 가장자리(a~h는 1단 바깥, 1~8은 a줄 바깥) — 3×5 글자를 정수 자리에
  x.fillStyle = PAL.dim;
  for (let f = 0; f < 8; f++) { const p = g.at(f + 0.5, -0.75); glyph(x, 'abcdefgh'[f], Math.round(p.x - 1), Math.round(p.y - 2)); }
  for (let r = 0; r < 8; r++) { const p = g.at(-0.75, r + 0.5); glyph(x, String(r + 1), Math.round(p.x - 1), Math.round(p.y - 2)); }
  c = { cv, x: x0, y: y0, w, h };
  if (boardCache.size > 12) boardCache.clear();
  boardCache.set(key, c);
  return c;
}
export function drawBoardImage(ctx, n = LOOK.n) {
  const b = boardImage(n);
  ctx.drawImage(b.cv, b.x, b.y, b.w, b.h);
}
