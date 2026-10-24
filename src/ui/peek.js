// 판 보기(CHM-61, docs/design-notes/agency.md E · layout.md 17절): 관 선택 카드의 작은 판과 왼쪽 칸의 큰 판.
// 그리는 것은 두기를 누르면 열릴 대국 상태(run.js previewBattle) 그대로 — 적 · 벽 · 보석 · 금빛 적 · 첫 증원 예고, 안개 칸은 안개.
// 손 · 덱은 그리지 않는다(대국을 열 때 섞는다).
import { PAL } from '../render/palette.js';
import { rect, sprite } from '../render/gfx.js';
import { INK, blitVec } from '../render/vec.js';
import { isHidden, visibleIncoming } from '../sim/battle.js';
import { PIECES } from '../data/pieces.js';

// 작은 판: 칸 PEEK.cell(테 1 둘레). 적은 종류마다 빛깔 둥근 말(킹 붉음 · 퀸 보라 · 룩 파랑 · 비숍 초록 · 나이트 주황 · 폰 짙은 밤 · 특수 기물 청록)
export const PEEK = { cell: 5, big: 12 };
export const peekSize = (cell = PEEK.cell) => cell * 8 + 2;
// 작은 판 칸: 대국 판과 같은 빛깔(모습을 따른다)
const SQ = { get light() { return PAL.light; }, get dark() { return PAL.dark; } };
export const PEEK_INK = { K: PAL.red, Q: '#b27ad6', R: '#4f86d4', B: '#4f9f5c', N: '#d98a2c', P: '#3b2c20', fairy: '#2f9f97', X: '#7a8288', J: '#9fe6ee' };
export const peekInk = (t) => PEEK_INK[t] || (PIECES[t] && PIECES[t].fairy ? PEEK_INK.fairy : PEEK_INK.P);
// 판 칸 → 그림 자리(흰 쪽이 아래: 0번 줄이 맨 아래)
const at = (x, y, c, sq) => ({ x: x + 1 + (sq & 7) * c, y: y + 1 + (7 - (sq >> 3)) * c });
// 첫 증원 예고(이번 수 뒤 · 그림자 읽기면 두 수 뒤까지): 칸 → 몇째 물결
function ghosts(b) {
  const out = new Map();
  visibleIncoming(b).forEach((wave, k) => { for (const r of wave || []) if (!b.board[r.sq] && !isHidden(b, r.sq) && !out.has(r.sq)) out.set(r.sq, { t: r.t, k }); });
  return out;
}
// 안개 칸: 안개 빛깔에 옅은 빗금 둘
function fogCell(g, x, y, c) {
  g.fillStyle = PAL.fog; g.fillRect(x, y, c, c);
  g.save(); g.beginPath(); g.rect(x, y, c, c); g.clip();
  g.strokeStyle = PAL.fogHi; g.lineWidth = Math.max(0.5, c / 10);
  g.beginPath(); for (const o of [c * 0.35, c * 0.85]) { g.moveTo(x + o - c, y + c); g.lineTo(x + o, y); g.moveTo(x + o, y + c); g.lineTo(x + o + c, y); } g.stroke();
  g.restore();
}
const disc = (g, cx, cy, r, fill, lw) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } };

// 작은 판(카드 안, 안 3 벡터): 잉크 테 · 판 칸 · 적은 종류 빛깔 둥근 말(잉크 테), 킹은 금 점, 벽은 돌 네모, 보석은 마름모, 증원 예고는 점선 고리.
// 판 상태 · 칸 크기 · 모습 빛깔 · 배율마다 한 번 굽는다. (x, y)는 테 바깥 왼쪽 위
export function miniBoard(ctx, b, x, y, { cell = PEEK.cell, dim = false } = {}) {
  const c = cell, n = c * 8, gh = ghosts(b);
  const sig = b.board.map((q, sq) => (isHidden(b, sq) ? '~' : q && !q.mine ? q.t + (q.gold ? '*' : '') : gh.has(sq) ? `g${gh.get(sq).k}` : '.')).join('');
  blitVec(ctx, `peek:${sig}:${c}:${dim ? 1 : 0}:${PAL.light}${PAL.dark}${PAL.fog}`, x, y, n + 2, n + 2, (g, N) => {
    const lw = Math.max(0.6, 1 / N);
    g.fillStyle = INK; g.fillRect(0, 0, n + 2, n + 2);
    for (let sq = 0; sq < 64; sq++) {
      const p = at(0, 0, c, sq), r = sq >> 3, f = sq & 7, cx = p.x + c / 2, cy = p.y + c / 2;
      if (isHidden(b, sq)) { fogCell(g, p.x, p.y, c); continue; }
      g.fillStyle = (r + f) % 2 ? SQ.light : SQ.dark; g.fillRect(p.x, p.y, c, c);
      const q = b.board[sq];
      if (q && !q.mine) {
        if (q.t === 'X') { g.fillStyle = PEEK_INK.X; g.fillRect(p.x + 0.5, p.y + 0.5, c - 1, c - 1); g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(p.x + 0.5, p.y + 0.5, c - 1, c - 1); continue; }
        if (q.t === 'J') { g.beginPath(); g.moveTo(cx, p.y + 0.6); g.lineTo(p.x + c - 0.6, cy); g.lineTo(cx, p.y + c - 0.6); g.lineTo(p.x + 0.6, cy); g.closePath(); g.fillStyle = PEEK_INK.J; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); continue; }
        disc(g, cx, cy, c * 0.38, q.gold ? PAL.gold : peekInk(q.t), lw);
        if (q.t === 'K') disc(g, cx, cy, c * 0.14, PAL.goldHi, 0);
        continue;
      }
      const w = gh.get(sq);
      if (w) { g.globalAlpha = w.k ? 0.5 : 1; g.setLineDash([c * 0.18, c * 0.14]); g.beginPath(); g.arc(cx, cy, c * 0.32, 0, Math.PI * 2); g.strokeStyle = PAL.shadow; g.lineWidth = lw; g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    }
    if (dim) { g.globalAlpha = 0.45; g.fillStyle = PAL.felt; g.fillRect(0, 0, n + 2, n + 2); g.globalAlpha = 1; }
  });
}

// 큰 판(왼쪽 칸 설명 자리): 반 크기 기물 그림(8 × 11)을 칸 12에. (x, y)는 테 바깥 왼쪽 위
export function bigBoard(ctx, b, x, y, { cell = PEEK.big } = {}) {
  const c = cell, n = c * 8;
  rect(ctx, x, y, n + 2, n + 2, INK);
  const g = ghosts(b);
  for (let sq = 0; sq < 64; sq++) {
    const p = at(x, y, c, sq), r = sq >> 3, f = sq & 7;
    if (isHidden(b, sq)) { fogCell(ctx, p.x, p.y, c); continue; }
    rect(ctx, p.x, p.y, c, c, (r + f) % 2 ? PAL.light : PAL.dark);
    const cell0 = b.board[sq];
    // 반 크기 기물: sprite는 16 × 22 자리의 아래 가운데에 8 × 11로 그린다 — 칸 안 (2, 1)에 오게 당긴다
    const px = p.x + Math.floor((c - 8) / 2) - 4, py = p.y + Math.floor((c - 11) / 2) - 11;
    if (cell0 && !cell0.mine) {
      if (cell0.gold) { ctx.globalAlpha = 0.5; rect(ctx, p.x + 1, p.y + 1, c - 2, c - 2, PAL.gold); ctx.globalAlpha = 1; }
      sprite(ctx, cell0.t, cell0.gold ? 'g' : 'b', px, py, { sx: 0.5, sy: 0.5 });
      continue;
    }
    const gh = g.get(sq);
    if (gh) {
      ctx.setLineDash([2, 1.5]); ctx.strokeStyle = gh.k ? PAL.dimDk : PAL.shadow; ctx.lineWidth = 1; ctx.strokeRect(p.x + 1, p.y + 1, c - 2, c - 2); ctx.setLineDash([]);
      sprite(ctx, gh.t, 'b', px, py, { sx: 0.5, sy: 0.5, alpha: gh.k ? 0.2 : 0.35 });
    }
  }
}
