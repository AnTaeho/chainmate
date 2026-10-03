// 판 보기(CHM-61, docs/design-notes/agency.md E · layout.md 17절): 관 선택 카드의 작은 판과 왼쪽 칸의 큰 판.
// 그리는 것은 두기를 누르면 열릴 대국 상태(run.js previewBattle) 그대로 — 적 · 벽 · 보석 · 금빛 적 · 첫 증원 예고, 안개 칸은 안개.
// 손 · 주머니는 그리지 않는다(대국을 열 때 섞는다).
import { PAL } from '../render/palette.js';
import { rect, frame, dots, sprite } from '../render/gfx.js';
import { isHidden, visibleIncoming } from '../sim/battle.js';
import { PIECES } from '../data/pieces.js';

// 작은 판: 칸 PEEK.cell(테 1 둘레). 적은 종류마다 빛깔(킹 붉음 · 퀸 보라 · 룩 파랑 · 비숍 초록 · 나이트 주황 · 폰 짙은 밤 · 특수 기물 청록)
export const PEEK = { cell: 5, big: 12 };
export const peekSize = (cell = PEEK.cell) => cell * 8 + 2;
const SQ = { light: '#cdb68b', dark: '#8f6743' };
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
function fogCell(ctx, x, y, c, r) {
  rect(ctx, x, y, c, c, PAL.fog);
  for (let k = 0; k < c; k += 2) rect(ctx, x + ((k + r) % c), y + k, 1, 1, PAL.fogHi);
}

// 작은 판(카드 안): (x, y)는 테 바깥 왼쪽 위
export function miniBoard(ctx, b, x, y, { cell = PEEK.cell, dim = false } = {}) {
  const c = cell, n = c * 8;
  rect(ctx, x, y, n + 2, n + 2, PAL.frameDk);
  const g = ghosts(b);
  const m = c >= 5 ? 1 : 0, k = c - m * 2; // 기물 네모: 칸 안 여백 1(칸 5 이상)
  for (let sq = 0; sq < 64; sq++) {
    const p = at(x, y, c, sq), r = sq >> 3, f = sq & 7;
    if (isHidden(b, sq)) { fogCell(ctx, p.x, p.y, c, r); continue; }
    rect(ctx, p.x, p.y, c, c, (r + f) % 2 ? SQ.light : SQ.dark);
    const cell0 = b.board[sq];
    if (cell0 && !cell0.mine) {
      if (cell0.t === 'X') { rect(ctx, p.x, p.y, c, c, PEEK_INK.X); rect(ctx, p.x, p.y, c, 1, '#a3abb0'); continue; }
      if (cell0.t === 'J') { const h = c >> 1; rect(ctx, p.x + h, p.y + m, 1, k, PEEK_INK.J); rect(ctx, p.x + m, p.y + h, k, 1, PEEK_INK.J); continue; }
      const ink = cell0.gold ? PAL.gold : peekInk(cell0.t);
      rect(ctx, p.x + m, p.y + m, k, k, ink);
      if (cell0.gold) rect(ctx, p.x + m, p.y + m, 1, 1, PAL.goldHi);
      // 킹: 가운데 한 점을 밝게(메이트할 과녁)
      if (cell0.t === 'K' && k >= 3) rect(ctx, p.x + (c >> 1), p.y + (c >> 1), 1, 1, PAL.goldHi);
      continue;
    }
    const gh = g.get(sq);
    if (gh) { ctx.globalAlpha = gh.k ? 0.5 : 1; frame(ctx, p.x + m, p.y + m, k, k, PAL.shadow); ctx.globalAlpha = 1; }
  }
  if (dim) { ctx.globalAlpha = 0.45; rect(ctx, x, y, n + 2, n + 2, PAL.felt); ctx.globalAlpha = 1; }
}

// 큰 판(왼쪽 칸 설명 자리): 반 크기 기물 그림(8 × 11)을 칸 12에. (x, y)는 테 바깥 왼쪽 위
export function bigBoard(ctx, b, x, y, { cell = PEEK.big } = {}) {
  const c = cell, n = c * 8;
  rect(ctx, x, y, n + 2, n + 2, PAL.frameDk);
  const g = ghosts(b);
  for (let sq = 0; sq < 64; sq++) {
    const p = at(x, y, c, sq), r = sq >> 3, f = sq & 7;
    if (isHidden(b, sq)) { fogCell(ctx, p.x, p.y, c, r); continue; }
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
      dots(ctx, p.x, p.y, c, c, gh.k ? PAL.dimDk : PAL.shadow, 2);
      sprite(ctx, gh.t, 'b', px, py, { sx: 0.5, sy: 0.5, alpha: gh.k ? 0.2 : 0.35 });
    }
  }
}
