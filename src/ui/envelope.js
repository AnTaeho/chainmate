// 꾸러미 봉투(CHM-69, docs/design-notes/layout.md 「종류 표시」): 종류마다 통째로 그린 봉투 — 덮개 빛깔(나무 · 청록 · 자주 · 금)과 덮개에 눌러 찍은 종류 문양.
// 폭 · 높이 · 열림(open 0 → 1)을 받는 그림 하나를 상점 칸 · 작은 표 · 여는 연출 · 건너뛰기 패가 같이 쓴다. 화면 배율 2 이상이면 반 칸 도트로 굽는다.
import { PAL } from '../render/palette.js';
import { place } from '../render/gfx.js';
import { makeCanvas, context } from '../render/surface.js';
import { hiFor } from '../render/sprites.js';
import { KIND_HI } from '../render/art-hi.js';
import { inkBox } from '../render/ink.js';
import { KIND, PACK_KIND } from './kinds.js';

// 몸 종이 · 종이 그늘 · 덮개 · 덮개 테와 찍힌 문양 · 눌린 자국의 밝은 줄
export const ENV_COL = {
  piece: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#a88860', dk: '#6b5132', hi: '#d8c4a4' },
  chart: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#3f8f86', dk: '#1d4a45', hi: '#8fd3c6' },
  engraving: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#8a4a6a', dk: '#4a2438', hi: '#d690b4' },
  golden: { body: '#f3d27a', bodyDk: '#c8902c', flap: '#c8902c', dk: '#6b4410', hi: '#fff1b8' },
};
export const ENV_RISE = 12; // 젖혀진 덮개가 봉투 위로 솟는 높이
export const ENV_TEAR = 3;  // 덮개가 갈라지는 틈(반 폭)
const STEPS = 20;           // 열림을 끊는 걸음(구운 그림 수)

// 봉투 모양(도트 단위): u 테 · e 덮개 테 굵기 · fe 덮개 끝 줄(덮개 안 높이가 짝수 — 문양이 한가운데 서게) · st 곧은 덮개 끝 · tip 덮개 끝 반 폭
export function envShape(W, H, u) {
  const e = Math.max(1, Math.round(W / 56)), f0 = Math.round(H * 0.68), fe = f0 + ((f0 - e - u) % 2), st = Math.round(H * 0.18), tip = Math.round(W * 0.18);
  return { e, fe, st, tip, half: (y) => (y < st ? W / 2 - u : Math.round(W / 2 - u - ((y - st) / (fe - st)) * (W / 2 - u - tip))) };
}
// 덮개에 찍는 문양: 잉크 10 × n 도트가 덮개 높이의 0.84 안인 가장 큰 것. n = 1은 1배 마스크, 2 이상은 반 칸 마스크를 n / 2배. 안 들어가면 null(빈 덮개)
export function envGlyph(kind, W, H, u) {
  const k = PACK_KIND[kind] || 'piece', S = envShape(W, H, u);
  let n = Math.floor(((S.fe - u) * 0.84) / 10);
  if (n < 1) return null;
  if (n > 1) n -= n % 2;
  const rows = n === 1 ? KIND[k].g : KIND_HI[k], m = n === 1 ? 1 : n / 2, b = inkBox(rows);
  return { rows, m, b, x: Math.floor((W - b.w * m) / 2) - b.x * m, y: u + Math.floor((S.fe - S.e - u - b.h * m) / 2) - b.y * m };
}

function paint(g, W, H, u, kind, open, hover, ox, oy) {
  const F = ENV_COL[kind] || ENV_COL.piece, S = envShape(W, H, u), { e, fe } = S, mid = W / 2;
  const R = (x, y, w, h, c) => { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); } };
  R(0, 0, W, H, hover ? PAL.white : PAL.frameDk); R(u, u, W - 2 * u, H - 2 * u, F.body); R(u, H - 2 * u, W - 2 * u, u, F.bodyDk);
  // 아래 접힌 두 날개: 두 귀에서 가운데로
  const slope = (H * 0.6) / W;
  for (let i = 0; i < mid - u; i++) { const yy = H - 2 * u - Math.round(i * slope); R(u + i, yy, e + 1, e, F.bodyDk); R(W - u - i - e - 1, yy, e + 1, e, F.bodyDk); }
  if (kind === 'golden' && W >= 40) for (const [fx, fy] of [[0.11, 0.77], [0.86, 0.77], [0.18, 0.55], [0.8, 0.59]]) { const x = Math.round(W * fx), y = Math.round(H * fy); R(x, y - e, e, 3 * e, F.hi); R(x - e, y, 3 * e, e, F.hi); }
  // 덮개: 0~0.4 끝에서부터 갈라지고, 0.4~1 위로 젖혀진다
  const crack = Math.min(1, open / 0.4), flap = Math.max(0, (open - 0.4) / 0.6);
  const tear = crack > 0.3 ? Math.round(crack * ENV_TEAR * u) : 0;
  const tipY = Math.round(fe + (-ENV_RISE * u - fe) * flap);
  const rows = []; // 줄마다 [반 폭, 가운데 틈]
  if (tipY > u) {
    for (let y = u; y < tipY; y++) {
      const p = (y - u) / (tipY - u), half = S.half(u + p * (fe - u)), gap = Math.round(tear * p);
      rows[y] = [half, gap];
      R(mid - half, y, half - gap, 1, F.flap); R(mid + gap, y, half - gap, 1, F.flap);
      R(mid - half, y, e, 1, F.dk); R(mid + half - e, y, e, 1, F.dk);
      if (gap) { R(mid - gap - e, y, e, 1, F.dk); R(mid + gap, y, e, 1, F.dk); }
    }
    const [half, gap] = rows[tipY - 1];
    R(mid - half, tipY - e, half - gap, e, F.dk); R(mid + gap, tipY - e, half - gap, e, F.dk);
    R(u, u, W - 2 * u, 1, F.hi);
  } else {
    // 젖혀진 덮개의 안쪽(밝은 종이)과 벌어진 입
    R(u, u, W - 2 * u, e, F.dk);
    for (let y = tipY; y < 0; y++) {
      const p = (0 - y) / (0 - tipY), half = S.half(u + p * (fe - u)), gap = Math.round(tear * p);
      R(mid - half, y, half - gap, 1, F.hi); R(mid + gap, y, half - gap, 1, F.hi);
      R(mid - half, y, e, 1, F.dk); R(mid + half - e, y, e, 1, F.dk);
    }
    const half = S.half(fe);
    R(mid - half, tipY, half - tear, e, F.dk); R(mid + tear, tipY, half - tear, e, F.dk);
  }
  // 눌러 찍은 문양: 밝은 눌린 자국 위에 짙은 문양. 갈라지면 두 쪽이 틈만큼 벌어지고, 덮개 밖은 그리지 않는다
  const G = flap < 0.3 ? envGlyph(kind, W, H, u) : null;
  if (!G) return;
  const dot = (x, y, c, a) => {
    const side = x + G.m / 2 < mid ? -1 : 1, r = rows[y];
    if (!r) return;
    const xx = x + side * r[1];
    if (Math.abs(xx + (side < 0 ? 0 : G.m) - mid) > r[0] - e || y + G.m > tipY - e) return;
    g.globalAlpha = a; R(xx, y, G.m, G.m, c); g.globalAlpha = 1;
  };
  for (const [dy, c, a] of [[G.m, F.hi, 0.55], [0, F.dk, 1]]) G.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') dot(G.x + i * G.m, G.y + j * G.m + dy, c, a); });
}

const BAKED = new Map();
// 봉투를 (x, y)에 w × h로. open 0 = 닫힘, 0.4 = 덮개가 갈라짐, 1 = 덮개가 젖혀짐
export function envelope(ctx, x, y, w, h, kind, { open = 0, hover = false } = {}) {
  const u = hiFor(ctx) ? 2 : 1, q = Math.round(Math.max(0, Math.min(1, open)) * STEPS);
  const top = q ? ENV_RISE : 0;
  const key = `${kind}:${w}x${h}:${u}:${q}:${hover ? 1 : 0}`;
  let c = BAKED.get(key);
  if (!c) {
    c = makeCanvas(w * u, (h + top) * u);
    paint(context(c), w * u, h * u, u, kind, q / STEPS, hover, 0, top * u);
    BAKED.set(key, c);
  }
  ctx.drawImage(c, place(x), place(y - top), w, h + top);
}
