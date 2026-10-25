// 꾸러미 봉투(CHM-69, docs/design-notes/layout.md 「종류 표시」 · art3.md 안 3): 크림 종이 몸 + 종류 빛깔 두 톤 덮개 + 잉크 테, 덮개 끝에 종류 문양을 찍은 둥근 밀랍 도장.
// 폭 · 높이 · 열림(open 0 → 1)을 받는 그림 하나를 상점 칸 · 작은 표 · 여는 연출 · 건너뛰기 패가 같이 쓴다. (종류, 크기, 열림 걸음, 가리킴, 배율 N)마다 한 번 굽는다.
import { PAL } from '../render/palette.js';
import { place } from '../render/gfx.js';
import { bake, scaleOf, INK, put } from '../render/vec.js';
import { PACK_KIND, glyphCanvas } from './kinds.js';

// 몸 종이 · 종이 그늘 · 덮개 · 덮개 그늘과 도장 문양 · 도장 · 젖힌 덮개 안쪽
export const ENV_COL = {
  piece: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#a88860', dk: '#6b5132', hi: '#d8c4a4' },
  chart: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#3f8f86', dk: '#1d4a45', hi: '#8fd3c6' },
  engraving: { body: '#efe3c7', bodyDk: '#cdbd98', flap: '#8a4a6a', dk: '#4a2438', hi: '#d690b4' },
  golden: { body: '#f3d27a', bodyDk: '#c8902c', flap: '#c8902c', dk: '#6b4410', hi: '#fff1b8' },
};
export const ENV_RISE = 12; // 젖혀진 덮개가 봉투 위로 솟는 높이
export const ENV_TEAR = 3;  // 덮개가 갈라지는 틈(반 폭)
const STEPS = 20;           // 열림을 끊는 걸음(구운 그림 수)

const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
// 봉투 모양(논리 단위): 덮개 끝 y · 도장 반지름 · 테 굵기
export function envShape(W, H) {
  const fe = Math.round(H * 0.62 * 2) / 2;
  const r = Math.min(W, H) * 0.2;
  const lw = W >= 60 ? 1.4 : W >= 24 ? 1 : 0.8;
  return { fe, r, lw, seal: fe - r * 0.15 };
}

// 둥근 네모 경로
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

function paint(g, W, H, n, kind, open, hover) {
  const F = ENV_COL[kind] || ENV_COL.piece, S = envShape(W, H), mid = W / 2;
  const line = hover ? PAL.white : INK, lw = Math.max(S.lw, 1 / n) * (hover ? 1.3 : 1), cr = Math.min(2, W / 12);
  const crack = Math.min(1, open / 0.4), flap = Math.max(0, (open - 0.4) / 0.6);
  const tear = crack > 0.3 ? crack * ENV_TEAR * Math.min(1, W / 40) : 0;
  const tipY = S.fe + (-ENV_RISE - S.fe) * flap;
  const ins = lw / 2;
  // 젖혀진 덮개(봉투 위로 솟은 안쪽 종이)는 몸 뒤에
  if (tipY < 0) {
    g.beginPath(); g.moveTo(ins, ins + 0.5); g.lineTo(mid, tipY + ins); g.lineTo(W - ins, ins + 0.5); g.closePath();
    g.fillStyle = F.hi; g.fill(); g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  }
  // 몸: 빛(왼쪽) · 그늘(오른쪽 0.42) · 아래 접힌 두 날개 줄
  rr(g, ins, ins, W - lw, H - lw, cr); g.fillStyle = F.body; g.fill();
  g.save(); rr(g, ins, ins, W - lw, H - lw, cr); g.clip();
  g.fillStyle = mix(F.body, F.bodyDk, 0.4); g.fillRect(W * 0.58, 0, W, H);
  g.beginPath(); g.moveTo(0, H); g.lineTo(mid, H * 0.5); g.lineTo(W, H); g.strokeStyle = F.bodyDk; g.lineWidth = Math.max(lw * 0.7, 1 / n); g.stroke();
  if (kind === 'golden' && W >= 24) {
    g.fillStyle = F.hi;
    for (const [fx, fy] of [[0.12, 0.8], [0.86, 0.8], [0.2, 0.58], [0.8, 0.62]]) {
      const x = W * fx, y = H * fy, s = W / 40;
      g.beginPath(); g.moveTo(x, y - 2 * s); g.lineTo(x + 0.6 * s, y - 0.6 * s); g.lineTo(x + 2 * s, y); g.lineTo(x + 0.6 * s, y + 0.6 * s); g.lineTo(x, y + 2 * s); g.lineTo(x - 0.6 * s, y + 0.6 * s); g.lineTo(x - 2 * s, y); g.lineTo(x - 0.6 * s, y - 0.6 * s); g.closePath(); g.fill();
    }
  }
  if (tipY < 0) { g.fillStyle = mix(F.flap, INK, 0.45); g.fillRect(0, 0, W, Math.max(1.5, H * 0.09)); }
  g.restore();
  rr(g, ins, ins, W - lw, H - lw, cr); g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  if (tipY < 0) return;
  // 덮개: 위 모서리에 걸린 두 쪽(갈라지면 끝에서부터 틈만큼 벌어진다). 왼쪽 빛 · 오른쪽 그늘
  const halves = [[-1, F.flap], [1, mix(F.flap, F.dk, 0.35)]];
  const half = (side) => { const tx = mid + side * tear; g.beginPath(); g.moveTo(side < 0 ? ins : W - ins, ins); g.lineTo(mid, ins); g.lineTo(tx, tipY); g.closePath(); };
  for (const [side, col] of halves) { half(side); g.fillStyle = col; g.fill(); }
  g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'round';
  if (tear) for (const [side] of halves) { half(side); g.stroke(); }
  else { g.beginPath(); g.moveTo(ins, ins); g.lineTo(mid, tipY); g.lineTo(W - ins, ins); g.stroke(); }
  // 도장: 덮개 끝에 걸친 둥근 밀랍(쪽마다 잘라 틈만큼 옮긴다) — 덮개가 젖히기 시작하면 감춘다
  if (flap < 0.3 && S.r * n >= 3) for (const [side] of halves) {
    const sy = S.seal * (tipY / S.fe), sx = mid + side * tear * (sy / S.fe);
    g.save(); g.beginPath(); g.rect(side < 0 ? sx - 4 * W : sx, -4 * H, 4 * W, 8 * H); g.clip();
    g.beginPath(); g.arc(sx, sy, S.r, 0, Math.PI * 2); g.fillStyle = F.hi; g.fill();
    g.save(); g.beginPath(); g.rect(sx + S.r * 0.15, sy - S.r * 2, S.r * 2, S.r * 4); g.clip();
    g.beginPath(); g.arc(sx, sy, S.r, 0, Math.PI * 2); g.fillStyle = mix(F.hi, F.flap, 0.45); g.fill(); g.restore();
    if (S.r * 2 * n >= 10) {
      const gs = S.r * 1.3;
      g.drawImage(glyphCanvas(PACK_KIND[kind] || 'piece', F.dk, Math.round(gs * 4) / 4, n), sx - gs / 2, sy - gs / 2, gs, gs);
    }
    g.beginPath(); g.arc(sx, sy, S.r, 0, Math.PI * 2); g.strokeStyle = line; g.lineWidth = Math.max(lw * 0.85, 1 / n); g.stroke();
    if (tear) { g.beginPath(); g.moveTo(sx, sy - S.r); g.lineTo(sx, sy + S.r); g.stroke(); }
    g.restore();
  }
}

// 봉투를 (x, y)에 w × h로. open 0 = 닫힘, 0.4 = 덮개가 갈라짐, 1 = 덮개가 젖혀짐
export function envelope(ctx, x, y, w, h, kind, { open = 0, hover = false } = {}) {
  const n = scaleOf(ctx), q = Math.round(Math.max(0, Math.min(1, open)) * STEPS);
  const top = q ? ENV_RISE : 0;
  const c = bake(`env:${kind}:${q}:${hover ? 1 : 0}`, w, h + top, n, (g) => { g.translate(0, top); paint(g, w, h, n, kind, q / STEPS, hover); });
  put(ctx, c, n, place(x), place(y - top), w, h + top);
}
