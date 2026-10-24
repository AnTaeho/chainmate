// 격언 · 전설 문양과 첫 화면 메뉴 아이콘(안 3, docs/design-notes/art3.md 7절 「문양 문법」): 24 × 24 설계 상자에 그리는 벡터 붓.
// 같은 문양이 아이콘(12 × 12)과 물건 그림 칸(가족 빛깔 칸 + 가족 모양 + 문양)에 선다. 몸은 크림 두 톤 + 잉크 테, 금 · 붉은 · 하늘은 규칙 빛깔만.
import { INK, ROLE, trace, two } from './vec.js';
import { pieceGlyph } from './pieces3.js';

const TAU = Math.PI * 2;
// 경로 글의 x 범위(M L Q C의 인자는 모두 x, y 짝)
function spanX(sh) {
  let x0 = Infinity, x1 = -Infinity;
  const list = Array.isArray(sh) && typeof sh[0] === 'number' ? [sh] : Array.isArray(sh) ? sh : [sh];
  for (const p of list) {
    if (typeof p === 'string') { const v = p.match(/-?\d*\.?\d+/g).map(Number); for (let i = 0; i < v.length; i += 2) { x0 = Math.min(x0, v[i]); x1 = Math.max(x1, v[i]); } }
    else { x0 = Math.min(x0, p[0] - p[2]); x1 = Math.max(x1, p[0] + p[2]); }
  }
  return [x0, x1];
}
const f = (v) => Math.round(v * 100) / 100;
const P = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
const rr = (x, y, w, h, r) => `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
const starPts = (cx, cy, r, ri, n = 5, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i * Math.PI) / n, q = i % 2 ? ri : r; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; });

// 붓: g는 설계 단위로 변환된 캔버스, k = 설계 한 단위의 기기 화소
export function pen(g, k) {
  const O = Math.max(1.5, 1 / k); // 잉크 테(설계 단위) — 기기 화소 1 밑으로 가늘어지지 않는다
  const col = (role) => (Array.isArray(role) ? role : ROLE[role] || [role, role]);
  const p = {
    O, g,
    shape(sh, role = 'cream', { split = null, lw = O, line = INK } = {}) {
      const [l, d] = col(role);
      const [x0, x1] = spanX(sh);
      two(g, sh, l, d, split ?? (x0 + x1) / 2 + (x1 - x0) * 0.06, line, lw);
    },
    flat(sh, c) { const [l] = col(c); two(g, sh, l, l, 0, INK, 0); },
    stroke(d, c = INK, w = O) { g.beginPath(); trace(g, d); g.strokeStyle = col(c)[0]; g.lineWidth = Math.max(w, 1 / k); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); },
    // 테 두른 굵은 선(화살대 · 끈): 잉크 넓게 → 빛깔 좁게
    band(d, c = 'cream', w = 2.4) { p.stroke(d, INK, w + O * 2); p.stroke(d, c, w); },
    piece(t, cx, by, h, side = 'w') { pieceGlyph(g, t, side, cx, by, h, k, O); },
    disc(cx, cy, r, c = 'cream', o = {}) { p.shape([cx, cy, r, r], c, o); },
    dot(cx, cy, r, c = INK) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = col(c)[0]; g.fill(); },
    ring(cx, cy, r, w, c = 'cream') { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.strokeStyle = INK; g.lineWidth = w + O * 2; g.stroke(); g.strokeStyle = col(c)[0]; g.lineWidth = w; g.stroke(); },
    poly(pts, c = 'cream', o) { p.shape(P(pts), c, o); },
    rect(x, y, w, h, c = 'cream', r = 0, o) { p.shape(r ? rr(x, y, w, h, r) : P([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]), c, o); },
    star(cx, cy, r, c = 'gold', n = 5, ri = 0.45) { p.poly(starPts(cx, cy, r, r * ri, n), c); },
    spark(cx, cy, r, c = 'gold') { p.poly(starPts(cx, cy, r, r * 0.3, 4, 0), c); },
    // 곧은 화살: (x1, y1) → (x2, y2), w = 대 굵기
    arrow(x1, y1, x2, y2, c = 'gold', w = 2.6) {
      const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
      const hl = Math.min(L * 0.55, w * 2), hw = w * 1.35, sw = w / 2, bx = x2 - ux * hl, by = y2 - uy * hl;
      p.poly([[x1 + nx * sw, y1 + ny * sw], [bx + nx * sw, by + ny * sw], [bx + nx * hw, by + ny * hw], [x2, y2], [bx - nx * hw, by - ny * hw], [bx - nx * sw, by - ny * sw], [x1 - nx * sw, y1 - ny * sw]], c);
    },
    // 둥근 화살: 가운데 (cx, cy) 반지름 r, a0 → a1(라디안, 끝에 화살촉)
    arc(cx, cy, r, a0, a1, c = 'cream', w = 2.6) {
      const N = 14, dir = Math.sign(a1 - a0), hl = (w * 2) / r, ae = a1 - dir * hl;
      const out = [], inn = [];
      for (let i = 0; i <= N; i++) { const a = a0 + ((ae - a0) * i) / N; out.push([cx + Math.cos(a) * (r + w / 2), cy + Math.sin(a) * (r + w / 2)]); inn.push([cx + Math.cos(a) * (r - w / 2), cy + Math.sin(a) * (r - w / 2)]); }
      const hw = w * 1.35, tip = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
      const b1 = [cx + Math.cos(ae) * (r + hw), cy + Math.sin(ae) * (r + hw)], b2 = [cx + Math.cos(ae) * (r - hw), cy + Math.sin(ae) * (r - hw)];
      p.poly([...out, b1, tip, b2, ...inn.reverse()], c);
    },
    // 꺾쇠: dir 'up' · 'down' · 'right'(가운데 (cx, cy), 폭 w · 높이 h, 굵기 t)
    chevron(cx, cy, w, h, c = 'gold', t = 2.4, dir = 'up') {
      if (dir === 'right') { p.poly([[cx - w / 2, cy - h / 2], [cx + w / 2, cy], [cx - w / 2, cy + h / 2], [cx - w / 2, cy + h / 2 - t], [cx + w / 2 - t * 1.3, cy], [cx - w / 2, cy - h / 2 + t]], c); return; }
      const s = dir === 'down' ? -1 : 1;
      p.poly([[cx - w / 2, cy + (s * h) / 2], [cx, cy - (s * h) / 2], [cx + w / 2, cy + (s * h) / 2], [cx + w / 2 - t, cy + (s * h) / 2], [cx, cy - (s * h) / 2 + s * t * 1.3], [cx - w / 2 + t, cy + (s * h) / 2]], c);
    },
    outline(sh) { two(g, sh, 'rgba(0,0,0,0)', null, 0, INK, O); },
    crown(cx, by, w, h, c = 'gold') {
      const x0 = cx - w / 2, x1 = cx + w / 2, t = by - h;
      p.poly([[x0, by], [x0 - w * 0.06, t + h * 0.1], [x0 + w * 0.25, t + h * 0.5], [cx, t - h * 0.05], [x1 - w * 0.25, t + h * 0.5], [x1 + w * 0.06, t + h * 0.1], [x1, by]], c);
      for (const [x, y] of [[x0 - w * 0.06, t + h * 0.1], [cx, t - h * 0.05], [x1 + w * 0.06, t + h * 0.1]]) p.disc(x, y, Math.max(1.1, w * 0.09), c);
    },
    coin(cx, cy, r, c = 'gold') { p.disc(cx, cy, r, c); p.stroke(`M${cx - r * 0.55} ${cy - r * 0.2} Q${cx - r * 0.5} ${cy - r * 0.6} ${cx} ${cy - r * 0.6}`, '#fff6d6', Math.max(0.9, r * 0.18)); g.beginPath(); g.arc(cx, cy, r * 0.62, 0, TAU); g.strokeStyle = col(c)[1]; g.lineWidth = Math.max(0.8, r * 0.14); g.stroke(); },
    link(cx, cy, w, h, a = 0, c = 'cream', t = 2.2) {
      g.save(); g.translate(cx, cy); g.rotate(a);
      const d = rr(-w / 2, -h / 2, w, h, h / 2);
      p.stroke(d, INK, t + O * 2); p.stroke(d, c, t);
      g.restore();
    },
    // 판 n × n(칸 s): 밝은 칸 크림 · 어두운 칸 남색, cell(i, j)가 빛깔을 주면 그 칸만 바꾼다
    board(x, y, n, s, cell = () => null) {
      const sq = (cx, cy, c) => p.flat(P([[cx, cy], [cx + s, cy], [cx + s, cy + s], [cx, cy + s]]), c);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = cell(i, j), dark = (i + j) % 2;
        sq(x + i * s, y + j * s, c === 'dark' || (c == null && dark) ? '#5a6299' : c && c !== 'light' ? c : '#f7eedb');
      }
      g.beginPath(); trace(g, P([[x, y], [x + n * s, y], [x + n * s, y + n * s], [x, y + n * s]])); g.strokeStyle = INK; g.lineWidth = O; g.lineJoin = 'round'; g.stroke();
    },
    // 적(남색) 폰 머리 하나 — 작은 자리의 「적」 표
    foe(cx, by, h) { p.piece('P', cx, by, h, 'b'); },
    tri(cx, cy, s, c = 'red', down = true) { const d = down ? 1 : -1; p.poly([[cx - s, cy - d * s * 0.7], [cx + s, cy - d * s * 0.7], [cx, cy + d * s * 0.8]], c); },
    cross(cx, cy, r, c = 'red') { p.ring(cx, cy, r, 1.5, c); p.band(`M${cx} ${cy - r - 2.6} L${cx} ${cy - r + 2.2} M${cx} ${cy + r - 2.2} L${cx} ${cy + r + 2.6} M${cx - r - 2.6} ${cy} L${cx - r + 2.2} ${cy} M${cx + r - 2.2} ${cy} L${cx + r + 2.6} ${cy}`, c, 1.5); },
    // 발자국: 발바닥 + 발가락 넷
    foot(cx, cy, s, a = 0) {
      g.save(); g.translate(cx, cy); g.rotate(a); g.scale(s, s);
      const o = { lw: O / s };
      p.shape('M0 -2.6 C2.8 -2.6 3.2 0.5 2.6 3 C2.1 5.2 -2.1 5.2 -2.6 3 C-3.2 0.5 -2.8 -2.6 0 -2.6 Z', 'cream', o);
      for (const [x, y, r] of [[-2.4, -4.6, 1.15], [-0.6, -5.6, 1.15], [1.3, -5.4, 1.05], [2.9, -4.2, 0.95]]) p.shape([x, y, r, r], 'cream', o);
      g.restore();
    },
  };
  return p;
}

// 문양(설계 상자 24 × 24). 모양은 data/maxims.js의 이름 · 효과에서 하나씩 골랐다
export const MOTIF = {
  // ── 놓기
  chivalry: (p) => { p.piece('N', 14, 22.5, 19); p.star(5.5, 6, 4.2); },
  pawn_march: (p) => { p.arrow(4.5, 17, 4.5, 4); p.arrow(19.5, 17, 19.5, 4); p.piece('P', 12, 22.5, 16); },
  light_step: (p) => { p.foot(7.5, 16.5, 1.25, -0.3); p.foot(15.5, 9, 1.25, 0.3); p.spark(20, 19, 3.2, 'gold'); },
  youngest: (p) => { p.piece('R', 16, 20, 15); p.piece('P', 8.5, 23, 12); p.star(8.5, 6, 3.4); },
  eldest: (p) => { p.piece('P', 18.5, 21, 10); p.piece('Q', 10, 23, 19); p.star(19, 5.5, 3.4); },
  // ── 갈아입기
  quick_change: (p) => { p.arc(12, 12, 7.5, -Math.PI * 0.95, -Math.PI * 0.05); p.arc(12, 12, 7.5, Math.PI * 0.05, Math.PI * 0.95); },
  whim: (p) => {
    p.band('M12 12 L12 23', '#b5895c', 2);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 - Math.PI / 4; p.g.save(); p.g.translate(12, 11); p.g.rotate(a); p.shape('M0 0 L0 -9.5 C4.5 -9.5 7 -6.5 7 -3 Z', i % 2 ? 'gold' : 'cream'); p.g.restore(); }
    p.disc(12, 11, 1.8, '#b5895c');
  },
  steadfast: (p) => {
    p.ring(12, 5, 2.4, 1.8);
    p.band('M12 7.5 L12 20', 'cream', 2.6); p.band('M7 11 L17 11', 'cream', 2.2);
    p.band('M4 14 C4.5 19.5 9 21 12 21 C15 21 19.5 19.5 20 14', 'cream', 2.4);
  },
  coronation: (p) => { p.piece('Q', 12, 23, 17); p.spark(4, 6, 3.4); p.spark(20.5, 9, 2.6); },
  homecoming: (p) => { p.poly([[5, 12], [12, 5.5], [19, 12], [17, 12], [17, 20], [7, 20], [7, 12]]); p.rect(10.4, 14.5, 3.2, 5.5, 'navy'); p.arc(12, 12, 10, Math.PI * 0.15, Math.PI * 0.85, 'gold', 2); },
  collector_forms: (p) => { p.piece('B', 6.5, 21, 13); p.piece('N', 17.5, 21, 13); p.piece('P', 12, 23.5, 12); },
  disguise: (p) => {
    p.shape('M2 9 C6 6.5 9 7.5 12 9.5 C15 7.5 18 6.5 22 9 C22 15 18.5 17 15.5 16 C13.8 15.4 13 13.6 12 13.6 C11 13.6 10.2 15.4 8.5 16 C5.5 17 2 15 2 9 Z');
    p.shape('M5 11.2 C6.5 10 8.5 10 9.6 11.6 C8.4 12.8 6.2 12.8 5 11.2 Z', 'navy'); p.shape('M14.4 11.6 C15.5 10 17.5 10 19 11.2 C17.8 12.8 15.6 12.8 14.4 11.6 Z', 'navy');
    p.stroke('M12 18 L12 22', INK, 1.4);
  },
  // ── 잡기
  low_stance: (p) => { p.piece('P', 9, 22.5, 14); p.chevron(19, 7, 7, 4, 'gold', 2.2, 'down'); p.chevron(19, 12.5, 7, 4, 'gold', 2.2, 'down'); },
  diagonal: (p) => { p.arrow(9, 15, 21.5, 2.5, 'cream', 2.6); p.piece('B', 7.5, 23, 15); },
  wall_breaker: (p) => { p.piece('R', 11, 23, 18); p.stroke('M12 6 L9.5 10 L12.5 12.5 L10 16', INK, 1.4); p.poly([[18, 6], [21.5, 5], [21, 8.5]], 'cream'); p.poly([[19, 11], [22.5, 11.5], [20.5, 14]], 'cream'); },
  long_chain: (p) => { p.link(6, 17, 9, 5.2, -0.8); p.link(12, 12, 9, 5.2, -0.8, 'gold'); p.link(18, 7, 9, 5.2, -0.8); },
  long_road: (p) => { for (let i = 0; i < 3; i++) p.rect(1.5 + i * 5.2, 16, 4, 4, 'cream', 0.6); p.arc(14, 20, 9, -Math.PI * 0.95, -Math.PI * 0.08, 'gold', 2.4); p.foe(21, 23.5, 7); },
  edge: (p) => p.board(2, 2, 4, 5, (i, j) => (i === 0 || j === 0 || i === 3 || j === 3 ? ((i + j) % 2 ? '#d48b1c' : '#f6be45') : (i + j) % 2 ? 'dark' : 'light')),
  center: (p) => p.board(2, 2, 4, 5, (i, j) => (i > 0 && i < 3 && j > 0 && j < 3 ? ((i + j) % 2 ? '#d48b1c' : '#f6be45') : null)),
  vault: (p) => {
    p.rect(3, 6, 18, 15, 'silver', 1.5); p.rect(5, 8, 14, 11, '#9aa7b1', 1);
    p.ring(12, 13.5, 3.2, 1.4, 'silver'); p.stroke('M12 10.3 L12 12.2 M15.2 13.5 L13.3 13.5', INK, 1.2);
    p.coin(18.5, 5, 3.6);
  },
  queen_hunt: (p) => { p.piece('Q', 9.5, 23, 19, 'b'); p.cross(17, 8, 4.6, 'red'); },
  bare_board: (p) => { p.board(2, 2, 4, 5, (i, j) => ((i + j) % 2 ? 'dark' : 'light')); p.foe(17, 21.5, 8); },
  rook_lift: (p) => { p.piece('R', 9, 23, 17); p.arrow(19.5, 20, 19.5, 3, 'gold', 2.6); },
  cavalry_charge: (p) => { p.stroke('M1.5 9 L5.5 9 M1 14 L5 14 M2 19 L6 19', INK, 1.5); p.piece('N', 13, 23, 18); p.chevron(21.5, 13, 4, 7, 'gold', 2, 'right'); },
  long_diagonal: (p) => { for (let i = 0; i < 3; i++) p.rect(2 + i * 5.5, 16 - i * 5.5, 5, 5, i === 0 ? 'cream' : '#5a6299', 0.4); p.arrow(4, 19, 21.5, 2.5, 'gold', 2.4); },
  encircle: (p) => { p.rect(8.5, 8.5, 7, 7, 'gold', 1); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; p.disc(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, 2.4, 'navy'); } },
  combo: (p) => { p.star(6, 17, 4.6, 'cream', 6, 0.5); p.star(12, 11.5, 4.6, 'cream', 6, 0.5); p.star(18, 6, 4.6, 'gold', 6, 0.5); },
  checkerboard: (p) => p.board(3, 3, 3, 6),
  last_square: (p) => { p.rect(3, 12, 18, 9, '#5a6299', 1); p.rect(12, 12, 9, 9, 'gold', 0.8); p.band('M16.5 16 L16.5 3', 'cream', 1.6); p.poly([[16.5, 3.5], [22.5, 6], [16.5 , 9]], 'red'); },
  nobility: (p) => { p.piece('R', 7.5, 23, 15, 'b'); p.piece('Q', 16.5, 23, 17, 'b'); p.crown(12, 6, 10, 5); },
  farmer: (p) => {
    for (const [x, a] of [[8.5, -0.35], [12, 0], [15.5, 0.35]]) { p.stroke(`M12 22 L${x + Math.sin(a) * 4} 8`, INK, 1.4); }
    for (const [x, y, a] of [[7, 6.5, -0.35], [12, 5, 0], [17, 6.5, 0.35]]) { p.shape(`M${x} ${y - 4} C${x + 2.4} ${y - 1.5} ${x + 2.4} ${y + 1.5} ${x} ${y + 4} C${x - 2.4} ${y + 1.5} ${x - 2.4} ${y - 1.5} ${x} ${y - 4} Z`, 'cream'); }
    p.band('M8.5 15 L15.5 15', 'gold', 1.8); p.foe(19.5, 23.5, 7);
  },
  lucky_coin: (p) => {
    p.coin(12, 12, 9.5);
    for (const a of [0, 1, 2, 3]) { const q = a * (Math.PI / 2) + Math.PI / 4; p.disc(12 + Math.cos(q) * 2.6, 12 + Math.sin(q) * 2.6, 2.4, '#7fb85f'); }
    p.stroke('M12 12 L14 17', INK, 1.2);
  },
  pilgrimage: (p) => {
    p.ring(12, 12, 9.5, 1.6, 'cream');
    p.poly(starPts(12, 12, 9.5, 2.6, 4, -Math.PI / 2), 'cream');
    p.disc(12, 12, 2.2, 'gold');
  },
  // ── 프로모션
  back_rank_dream: (p) => { p.band('M2 4 L22 4', 'gold', 2.2); p.crown(12, 11, 9, 4.5); p.piece('P', 12, 23, 11); },
  promotion_feast: (p) => {
    p.shape('M5 4 L19 4 C19 11 16 13.5 13.4 14 L13.4 18.5 L17 21 L7 21 L10.6 18.5 L10.6 14 C8 13.5 5 11 5 4 Z', 'gold');
    p.crown(12, 11, 7, 4, 'cream'); p.spark(21, 15, 2.6, 'cream');
  },
  promotion_road: (p) => { p.shape('M7 23 L10.5 11 L13.5 11 L17 23 Z', 'cream'); p.stroke('M12 13 L12 15 M12 17.5 L12 20', INK, 1.3); p.crown(12, 9.5, 12, 6.5); },
  promotion_rush: (p) => { p.stroke('M2 12 L6 12 M3 16.5 L7 16.5 M2 21 L6 21', INK, 1.5); p.piece('P', 13, 23, 15); p.arrow(20.5, 13, 20.5, 2, 'gold', 2.4); },
  // ── 끊김 · 희생
  sacrifice: (p) => {
    p.g.save(); p.g.translate(12, 22); p.g.rotate(-0.22); p.g.translate(-12, -22);
    p.shape('M12 8.5 C17.5 8.5 19.5 13 19.5 16 C19.5 20 16 22.5 12 22.5 C8 22.5 4.5 20 4.5 16 C4.5 13 6.5 8.5 12 8.5 Z', 'cream');
    p.disc(12, 7, 4.2, 'cream'); p.dot(10.5, 6.6, 0.85); p.dot(13.5, 6.6, 0.85);
    p.shape('M6 17.5 C9 19.2 15 19.2 18 17.5 C17.6 20.6 15 21.8 12 21.8 C9 21.8 6.4 20.6 6 17.5 Z', 'red', { lw: 0 });
    p.g.restore();
    p.stroke('M2.5 20 C2 17 2.6 14.5 4 13 M21.5 20 C22 17 21.4 14.5 20 13', INK, 1.3);
  },
  payback: (p) => { p.link(6, 15, 8.5, 5, -0.3); p.link(18, 15, 8.5, 5, 0.3); p.poly([[11, 11], [13, 13.5], [11, 16], [13, 18.5]], 'red', { lw: p.O }); p.arc(12, 13, 8, -Math.PI * 0.15, -Math.PI * 0.95, 'red', 2.2); },
  close_call: (p) => { p.link(7, 17, 9, 5, -0.6); p.link(15, 12, 9, 5, -0.6); p.rect(18, 1.5, 4, 9.5, 'red', 1.5); p.disc(20, 14, 2.2, 'red'); },
  reversal: (p) => { p.band('M5 22 L5 13 C5 6 12 3.5 16 6', 'cream', 2.6); p.poly([[14.5, 2.5], [21, 6.5], [14.5, 10]], 'cream'); p.poly([[2.5, 22], [7.5, 22], [5, 17.5]], 'red'); },
  no_regrets: (p) => { p.arc(12, 12, 7.5, -Math.PI * 0.6, Math.PI * 1.15, 'cream'); p.band('M4 20 L20 4', 'red', 2.4); },
  second_thought: (p) => { p.arc(10, 13, 7, -Math.PI * 0.6, Math.PI * 1.15, 'cream'); p.band('M19.5 2 L19.5 9 M16 5.5 L23 5.5', 'gold', 2.2); },
  thrift: (p) => {
    p.shape('M5 10 C3 14 3 21 12 21 C21 21 21 14 19 10 Z', '#b5895c');
    p.shape('M7 10 C7 6 17 6 17 10 Z', '#b5895c'); p.disc(9.5, 6.6, 1.6, 'gold'); p.disc(14.5, 6.6, 1.6, 'gold');
    p.coin(12, 15.5, 3.6);
  },
  // ── 체크메이트
  mate_hunter: (p) => { p.piece('K', 9.5, 23, 20, 'b'); p.cross(17, 8, 4.6, 'red'); },
  kings_neck: (p) => { p.piece('K', 12, 23, 21, 'b'); p.g.save(); p.g.translate(12, 13.4); p.g.scale(1, 0.38); p.ring(0, 0, 5.6, 3.6, 'red'); p.g.restore(); },
  memory: (p) => {
    p.shape('M12 7 C9 5 5 5 2 6 L2 20 C5 19 9 19 12 21 Z'); p.shape('M12 7 C15 5 19 5 22 6 L22 20 C19 19 15 19 12 21 Z');
    p.stroke('M4.5 10 L9.5 9.5 M4.5 13 L9.5 12.5 M4.5 16 L9 15.6', INK, 1); p.crown(17, 15, 6, 4);
  },
  kings_step: (p) => { p.piece('K', 8.5, 23, 19, 'b'); p.foot(17.5, 18.5, 1, 0.2); p.foot(19.5, 8.5, 1, 0.2); },
  // ── 수
  first_move: (p) => { p.band('M6 22 L6 3', 'cream', 1.8); p.poly([[6.5, 3.5], [20, 7.5], [6.5, 12.5]], 'gold'); p.shape('M10.5 6 L12.6 5.2 L12.6 11 L10.8 11.6 Z', 'cream', { lw: p.O * 0.7 }); p.rect(2, 20, 20, 2.5, 'cream', 1); },
  last_move: (p) => {
    p.rect(5, 2, 14, 2.4, '#b5895c', 1); p.rect(5, 19.6, 14, 2.4, '#b5895c', 1);
    p.shape('M7 4.4 L17 4.4 C17 9 13.5 10.5 13 12 C13.5 13.5 17 15 17 19.6 L7 19.6 C7 15 10.5 13.5 11 12 C10.5 10.5 7 9 7 4.4 Z', 'silver');
    p.shape('M8.4 19.6 C9 16.5 11 15.5 12 15.5 C13 15.5 15 16.5 15.6 19.6 Z', 'gold', { lw: 0 }); p.shape('M10 7 L14 7 C13.4 8.6 12.4 9.4 12 10 C11.6 9.4 10.6 8.6 10 7 Z', 'gold', { lw: 0 });
  },
  second_wind: (p) => {
    p.band('M2 8 L14 8 C18 8 19 3.5 15.5 3 C13 2.7 12.5 5 13.5 6', 'cream', 1.9);
    p.band('M2 13 L19 13 C23 13 23 18.5 19.5 18.5 C17.5 18.5 17 17 17.5 16', 'cream', 1.9);
    p.band('M4 18 L12 18', 'cream', 1.9);
  },
  all_in: (p) => { for (let i = 0; i < 4; i++) p.shape([12, 20 - i * 3.3, 7, 2.4], i % 2 ? '#d48b1c' : 'gold'); p.rect(19.5, 2, 3.5, 8.5, 'red', 1.5); p.disc(21.2, 13.5, 1.9, 'red'); },
  // ── 덱 · 증원 · 지키는 적 · 각인 · 기보 · 혼 · 격언 · 콤보
  empty_bag: (p) => { p.shape('M7 9 C3 13 3 21 12 21 C21 21 21 13 17 9 Z', '#b5895c'); p.shape([12, 8.5, 6, 2.2], '#5a3a20'); p.stroke('M8 5 L10 8 M16 5 L14 8', INK, 1.2); },
  small_bag: (p) => { p.shape('M9 10 C5 13 5 20 12 20 C19 20 19 13 15 10 Z', '#b5895c'); p.shape('M9.5 10 L8.5 6.5 L15.5 6.5 L14.5 10 Z', '#b5895c'); p.band('M9 10 L15 10', 'gold', 1.4); p.coin(18.5, 18.5, 3.6); },
  welcome: (p) => { p.shape('M4 22 L4 11 C4 4 20 4 20 11 L20 22 Z', '#7a5a3a'); p.shape('M7 22 L7 11.5 C7 7 17 7 17 11.5 L17 22 Z', '#2a2f5a'); p.foe(12, 22, 9); p.tri(12, 4.2, 3.4); },
  shadow_reading: (p) => { p.shape('M1.5 12 C6 5 18 5 22.5 12 C18 19 6 19 1.5 12 Z'); p.disc(12, 12, 4.6, 'navy'); p.dot(12, 12, 2.2, INK); p.dot(10.6, 10.6, 1.1, '#ffffff'); },
  reinforce_hunt: (p) => { p.foe(9, 23, 15); p.tri(9, 4, 3); p.cross(17.5, 13, 4.6, 'red'); },
  full_board: (p) => p.board(2, 2, 4, 5, (i, j) => ((i + j) % 2 ? 'dark' : 'light')) || [0, 1, 2, 3].forEach((i) => [0, 1, 2, 3].forEach((j) => p.disc(4.5 + i * 5, 4.5 + j * 5, 1.5, 'navy'))),
  ambusher: (p) => {
    p.shape('M2 21 C0 16 3 12 6.5 12.5 C7 7 13 5 15.5 9 C19 7.5 23.5 11 22 15 C24 18 23 21 21 21 Z', '#6f9a58');
    p.shape('M6.5 14.4 C7.5 13 9.5 13 10.3 14.6 C9.5 15.8 7.5 15.8 6.5 14.4 Z', '#fff6d6'); p.shape('M13.7 14.6 C14.5 13 16.5 13 17.5 14.4 C16.5 15.8 14.5 15.8 13.7 14.6 Z', '#fff6d6');
    p.dot(8.6, 14.5, 0.9); p.dot(15.6, 14.5, 0.9);
  },
  ivory_tower: (p) => { p.shape('M8 22 L9 9 L15 9 L16 22 Z'); p.shape('M7 9.5 L12 1.5 L17 9.5 Z', 'cream'); p.rect(10.8, 12, 2.4, 3.6, 'navy', 1); p.rect(6, 21, 12, 2.2, 'cream', 1); },
  blacksmith: (p) => {
    p.shape('M3 15 L21 15 L19 17.5 L15 17.5 L16 22 L8 22 L9 17.5 L5 17.5 Z', '#6b7480');
    p.band('M14 12 L20 4', '#b5895c', 2); p.shape('M10 4 L15 0.8 L18.5 5.5 L13.5 8.6 Z', 'silver'); p.spark(7, 9, 3, 'gold');
  },
  collector: (p) => { for (let i = 0; i < 3; i++) { p.rect(4 + i * 0.8, 15 - i * 5, 16, 4.6, 'cream', 1); p.rect(4 + i * 0.8, 15 - i * 5, 3, 4.6, '#5fb3a6', 0.6); } },
  specialty: (p) => { p.poly([[7, 2], [11, 2], [13, 11], [9, 11]], '#5fb3a6'); p.poly([[13, 2], [17, 2], [15, 11], [11, 11]], '#3f8f86'); p.disc(12, 15, 6.5, 'silver'); p.star(12, 15, 4, 'cream'); },
  reply_master: (p) => {
    for (const s of [1, -1]) { p.band(`M${12 - s * 9} 21 L${12 + s * 8} 3`, 'silver', 2.2); p.band(`M${12 - s * 9.5 + s * 1.5} 16 L${12 - s * 9.5 + s * 5.5} 18.5`, '#b5895c', 2); }
    p.foe(12, 23.5, 7);
  },
  mad_horse: (p) => { p.band('M2.5 2 L2.5 23', '#5a6299', 2.4); p.piece('N', 13, 23, 19); p.poly([[19, 1.5], [15.5, 8], [18.5, 8], [16.5, 13], [22, 6], [19, 6], [21, 1.5]], 'gold'); },
  loner: (p) => { p.stroke('M12 3 A0 0 0 0 0 12 3', INK, 0); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; p.dot(12 + Math.cos(a) * 9.5, 13 + Math.sin(a) * 9.5, 1.1, '#f7eedb'); } p.foe(12, 21, 13); },
  counter_book: (p) => {
    p.rect(4, 3, 16, 19, '#94545c', 1.5); p.rect(4, 3, 3, 19, '#6e3a42', 1);
    p.band('M9.5 17.5 L17.5 7.5', 'silver', 1.6); p.band('M17.5 17.5 L9.5 7.5', 'silver', 1.6);
  },
  soul_collector: (p) => {
    p.shape('M6 9 L18 9 L19 21 L5 21 Z', '#cfe6ee'); p.rect(5, 6, 14, 3, '#b5895c', 1);
    for (const [x, c] of [[8.6, '#d27fd6'], [12, '#6fd1bf'], [15.4, '#f0a060']]) p.shape(`M${x} 11 C${x + 2.2} 14 ${x + 2.2} 18.5 ${x} 18.5 C${x - 2.2} 18.5 ${x - 2.2} 14 ${x} 11 Z`, c);
  },
  asceticism: (p) => { p.rect(8, 9, 8, 13, 'cream', 1); p.shape('M12 1.5 C15 5 14.5 8 12 8.5 C9.5 8 9 5 12 1.5 Z', 'gold'); p.stroke('M12 8.5 L12 10', INK, 1.2); p.rect(4, 21, 16, 2, '#b5895c', 1); },
  gambler: (p) => {
    p.rect(2, 9, 11, 11, 'cream', 2); for (const [x, y] of [[4.8, 11.8], [7.5, 14.5], [10.2, 17.2]]) p.dot(x, y, 1.1);
    p.rect(11, 3, 11, 11, 'cream', 2); for (const [x, y] of [[13.8, 5.8], [19.2, 5.8], [13.8, 11.2], [19.2, 11.2]]) p.dot(x, y, 1.1);
  },
  // ── 전설
  immortal: (p) => { p.band('M12 12 C9 6 3 6 3 12 C3 18 9 18 12 12 C15 6 21 6 21 12 C21 18 15 18 12 12', 'gold', 3.2); },
  opera: (p) => {
    p.shape('M2 4 C6 2.5 10 2.5 13 4 C13 11 11 15 7.5 15 C4 15 2 11 2 4 Z', 'cream'); p.dot(5.3, 7.5, 1.1); p.dot(9.7, 7.5, 1.1); p.stroke('M5 11 C6.5 12.5 8.5 12.5 10 11', INK, 1.1);
    p.shape('M11 9 C14 7.5 18 7.5 22 9 C22 16 20 20 16.5 20 C13 20 11 16 11 9 Z', '#5a6299'); p.dot(14.3, 12.5, 1.1, '#f7eedb'); p.dot(18.7, 12.5, 1.1, '#f7eedb'); p.stroke('M14 17 C15.5 15.5 17.5 15.5 19 17', '#f7eedb', 1.1);
  },
  century: (p) => {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = Math.PI / 2 + s * (0.5 + i * 0.5), x = 12 + Math.cos(a) * 9.5, y = 12.5 + Math.sin(a) * 9.5; p.shape([x, y, 2.6, 1.3, a + Math.PI / 2], '#7fb85f'); }
    p.piece('Q', 12, 19.5, 13);
  },
  evergreen: (p) => { p.poly([[12, 1.5], [17, 8], [14.5, 8], [19.5, 14], [16, 14], [21, 20], [3, 20], [8, 14], [4.5, 14], [9.5, 8], [7, 8]], '#6f9a58'); p.rect(10.5, 20, 3, 3, '#b5895c', 0.5); },
  eight_pawns: (p) => { p.piece('P', 5, 19, 10); p.piece('P', 19, 19, 10); p.piece('P', 8.5, 21.5, 12); p.piece('P', 15.5, 21.5, 12); p.piece('P', 12, 23.5, 14); },
  // ── 첫 화면 메뉴(CHM-49) · 자물쇠
  menu_continue: (p) => p.poly([[6, 3], [20, 12], [6, 21]], 'cream'),
  menu_new: (p) => { p.piece('P', 10.5, 23, 18); p.band('M19 2 L19 9 M15.5 5.5 L22.5 5.5', 'gold', 2); },
  menu_lesson: (p) => { p.shape('M12 6 C9 4 5 4 2 5 L2 20 C5 19 9 19 12 21 Z'); p.shape('M12 6 C15 4 19 4 22 5 L22 20 C19 19 15 19 12 21 Z'); p.stroke('M4.5 9 L9.5 8.6 M4.5 12 L9.5 11.6 M14.5 8.6 L19.5 9 M14.5 11.6 L19.5 12', INK, 1); },
  menu_daily: (p) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; p.band(`M${12 + Math.cos(a) * 7.5} ${12 + Math.sin(a) * 7.5} L${12 + Math.cos(a) * 10.5} ${12 + Math.sin(a) * 10.5}`, 'gold', 1.8); } p.disc(12, 12, 5.5, 'gold'); },
  menu_codex: (p) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.rect(2.5 + i * 6.6, 2.5 + j * 6.6, 5.4, 5.4, (i + j) % 2 ? '#5a6299' : 'cream', 1); },
  menu_records: (p) => { p.crown(12, 19, 17, 11); p.rect(3.5, 19.5, 17, 2.6, 'gold', 1); },
  menu_settings: (p) => {
    const pts = [];
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, r = i % 4 < 2 ? 10.5 : 8; pts.push([12 + Math.cos(a + 0.1) * r, 12 + Math.sin(a + 0.1) * r]); }
    p.poly(pts, 'silver'); p.disc(12, 12, 3.4, 'navy');
  },
  menu_rank: (p) => {
    p.shape('M6 3 L18 3 C18 10 16 13 12 13.5 C8 13 6 10 6 3 Z', 'gold');
    p.stroke('M6 5 C2 5 2 10 7 10.5 M18 5 C22 5 22 10 17 10.5', INK, 2.6); p.stroke('M6 5 C2 5 2 10 7 10.5 M18 5 C22 5 22 10 17 10.5', '#f6be45', 1.1);
    p.rect(10.6, 13, 2.8, 4.5, 'gold'); p.rect(6.5, 17.5, 11, 4, '#b5895c', 1);
  },
  lock: (p) => { p.ring(12, 9, 5, 2.2, 'silver'); p.rect(4, 10, 16, 12, 'silver', 2); p.disc(12, 14.6, 1.8, 'navy'); p.rect(11.2, 15, 1.6, 3.6, 'navy'); },
};

// 문양 하나를 설계 상자 24 × 24 → (x, y) 한 변 size(논리)에. n은 g의 배율
export function drawMotif(g, id, x, y, size, n) {
  const m = MOTIF[id];
  if (!m) return false;
  const s = size / 24;
  g.save(); g.translate(x, y); g.scale(s, s);
  m(pen(g, s * n));
  g.restore();
  return true;
}
