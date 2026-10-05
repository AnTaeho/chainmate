// 점화 의식(CHM-67, docs/design-notes/ignite.md · layout.md 20절): 판에서 처음 사슬 8 이상 또는 넘침 ×10이 나온 사슬(run.ignite)을
// 사슬이 끝난 뒤 막간으로 다시 보인다 — 어두워진 판 위에 먹은 차례대로 길을 다시 긋고(번호), 오른쪽 칸에 「이 판의 콤비네이션」 카드가 앉는다.
// 탭 · 아무 키면 닫히고, 앉은 뒤 2초면 저절로 닫힌다. 막간은 한 수 연출(seq) 밖이다. 뒤에는 왼쪽 칸에 불씨 아이콘이 남는다.
// 판 상태는 읽기만 한다(기록은 규칙 run.js checkIgnite).
import { PAL } from '../render/palette.js';
import { text, rect, box, frame, line, sprite, num, short, measure, fine, W, H } from '../render/gfx.js';
import { glow } from '../render/light.js';
import { openBox, closeBox, layerUp } from '../render/layoutlog.js';
import { PAD_BOX, GAP_IN, GAP_GROUP, RIGHT, flow } from './frame.js';
import { capRoute } from './fxroute.js';
import { tipLines } from './parts.js';

// 시간표(초): 길 긋기 0 ~ PATH, 카드 낙하 DROP ~ LAND, 앉은 뒤 STAY면 닫힘. 움직임 줄이기면 길 · 카드가 처음부터 다 보이고 STAY 뒤 닫힘
export const COMBO = { PATH: 0.9, DROP: 0.75, LAND: 1.0, STAY: 2.0 };
export const comboLand = (calm) => (calm ? 0 : COMBO.LAND);
export const comboClose = (calm) => comboLand(calm) + COMBO.STAY;

// 불씨 아이콘 7 × 9(r 붉은 테 · g 금 · y 밝은 금) — 1배에서도 뭉개지지 않는 남는 표시
const EMBER = ['...r...', '..rr...', '..rgr..', '.rggr.r', '.rgggrr', 'rggyggr', 'rgyyygr', 'rgyyygr', '.rrrrr.'];
const EC = { r: PAL.red, g: PAL.gold, y: PAL.goldHi };
export const EMBER_W = 7, EMBER_H = 9;
export function drawEmber(ctx, x, y) {
  EMBER.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (EC[row[i]]) rect(ctx, x + i, y + j, 1, 1, EC[row[i]]); });
}
// 가리키면 뜨는 짧은 말풍선: 「이 판의 콤비네이션」 + 「N 먹음 · 점수」(제목 줄과 한 줄 — 좁은 왼쪽 칸에서 「N 먹음」이 끊기지 않게)
export const IGNITE_TITLE = '이 판의 콤비네이션';
export const igniteLine = (ig) => `${ig.captures} 먹음 · ${num(ig.score)}`;
// 글 줄(ty = text y) 왼쪽 x에 불씨를 그리고 가리킬 구역을 둔다. 돌려주는 값: 차지한 폭(틈 포함)
export function emberMark(ctx, ui, ig, x, ty, id = 'ignite:mark') {
  if (!ig) return 0;
  drawEmber(ctx, x, ty + 1);
  ui.region(id, x - 1, ty - 1, EMBER_W + 2, 13, { tip: () => tipLines(IGNITE_TITLE, igniteLine(ig), 150) });
  return EMBER_W + 4;
}

// 막간 상태: { t, data(사건 = run.ignite 사본), calm }
export const openCombo = (data, calm) => ({ t: 0, data, calm: !!calm });

// 먹기 하나의 길(칸 가운데 점들): 제자리 쏘기는 쏜 칸까지 점선, 그 밖은 capRoute의 길(꺾쇠 · 물수제비는 꺾은 칸을 거쳐)
function capPts(c, ctr) {
  if (c.stay) return { dotted: true, pts: [ctr(c.from), ctr(c.to)] };
  return { dotted: false, pts: capRoute(c).pts.map(ctr) };
}
const segLen = (pts) => { let n = 0; for (let i = 0; i + 1 < pts.length; i++) n += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); return n; };
function thick(ctx, x0, y0, x1, y1, col) { line(ctx, x0, y0, x1, y1, col); line(ctx, x0 + 1, y0, x1 + 1, y1, col); line(ctx, x0, y0 + 1, x1, y1 + 1, col); }
// 길을 q(0 ~ 1)만큼 긋는다
function drawRoute(ctx, r, q) {
  let left = segLen(r.pts) * q;
  for (let i = 0; i + 1 < r.pts.length && left > 0; i++) {
    const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y), k = Math.min(1, left / Math.max(1, len));
    const ex = a.x + (b.x - a.x) * k, ey = a.y + (b.y - a.y) * k;
    if (r.dotted) { const n = Math.max(1, Math.floor((len * k) / 4)); for (let j = 0; j <= n; j += 2) { const u = j / n; rect(ctx, Math.round(a.x + (ex - a.x) * u), Math.round(a.y + (ey - a.y) * u), 2, 2, PAL.gold); } }
    else thick(ctx, a.x, a.y, ex, ey, PAL.gold);
    left -= len;
  }
}

// 카드 쌓기(재기와 그리기가 같은 흐름): 머릿말 → 묶음 안 틈 → 이름(제목 줄) → 묶음 틈 → 모습 줄 → 가는 줄 → 먹은 수 → 값 × 배수 · 점수
export function comboCard(ig) {
  const P = PAD_BOX, CW = RIGHT.w, inner = CW - P * 2;
  const f = flow(P);
  const kick = f.line();
  f.gap(GAP_IN);
  const title = f.line(true);
  f.gap(GAP_GROUP);
  const row = f.space(22);
  f.gap(GAP_IN);
  const rule = f.space(1);
  f.gap(GAP_IN);
  const caps = f.line();
  // 값 × 배수와 점수가 한 줄에 안 들어가면(큰 수 · 영어) 점수를 다음 줄로
  let vm = `${num(ig.value)} × ${num(ig.mult)}`;
  if (measure(vm) > inner) vm = `${short(ig.value)} × ${short(ig.mult)}`;
  const sc = measure(num(ig.score), true) <= inner ? num(ig.score) : short(ig.score);
  const one = measure(vm) + 6 + measure(sc, true) <= inner;
  const vmY = f.line(), scY = one ? vmY : f.line();
  const steps = ig.steps, nShow = steps.length > 5 ? 4 : steps.length;
  return { P, CW, CH: f.y + P, kick, title, row, rule, caps, vm, sc, vmY, scY, nShow, more: steps.length - nShow };
}

// 막간 그리기. geo = { BX, BY, S, sqXY }. 판 위 길 · 번호는 재지 않는 상자(움직이는 것), 카드는 판넬 상자로 잰다(앉은 뒤)
export function drawCombo(ctx, g, { BX, BY, S, sqXY }) {
  const ig = g.data, t = g.t, W8 = S * 8, calm = g.calm;
  layerUp(); // 덮개처럼: 밑 화면(격언 칸 · 손)과는 상자 겹침을 재지 않는다
  const fade = calm ? 1 : Math.min(1, t / 0.2);
  ctx.globalAlpha = fade * 0.45; rect(ctx, 0, 0, W, H, PAL.shadow);
  ctx.globalAlpha = fade * 0.45; rect(ctx, BX, BY, W8, W8, PAL.shadow); ctx.globalAlpha = 1;
  // 사슬의 길: 먹은 차례대로 이어진다. 먹은 칸에 차례 숫자
  const ctr = (sq) => { const p = sqXY(sq); return { x: p.x + S / 2 - 1, y: p.y + S / 2 - 1 }; };
  const n = ig.path.length, upto = calm ? n : Math.min(n, (t / COMBO.PATH) * n);
  openBox('fx', BX, BY, W8, W8, 0, { loose: true, name: '콤비네이션 길' });
  const marks = [];
  ig.path.forEach((c, i) => {
    const q = Math.max(0, Math.min(1, upto - i));
    if (q > 0) drawRoute(ctx, capPts(c, ctr), q);
    if (q >= 1) marks.push({ sq: c.to, i: i + 1 });
  });
  { const p = sqXY(ig.drop); frame(ctx, p.x + 9, p.y + 9, 10, 10, PAL.goldHi, 2); }
  for (const m of marks) {
    const p = sqXY(m.sq);
    rect(ctx, p.x + 11, p.y + 11, 6, 6, PAL.goldDk); rect(ctx, p.x + 12, p.y + 12, 4, 4, PAL.goldHi);
    text(ctx, String(m.i), p.x + 3, p.y + 2, PAL.goldHi, { bold: true, shadow: PAL.shadow });
  }
  closeBox();
  // 카드: 위에서 떨어져 오른쪽 칸(격언 · 손 자리)에 앉는다 — 판 위의 길을 가리지 않게
  const t0 = calm ? 0 : COMBO.DROP, land = comboLand(calm);
  if (t < t0) return null;
  const k = calm ? 1 : Math.min(1, (t - t0) / (land - t0));
  const L = comboCard(ig), cx = RIGHT.x, R = cx + L.CW - L.P;
  const y1 = Math.round(BY + (W8 - L.CH) / 2), cy = Math.round(y1 - (1 - k * k) * 160);
  const draw = () => {
    openBox('panel', cx, cy, L.CW, L.CH, L.P, { name: '콤비네이션', loose: k < 1 });
    rect(ctx, cx + 2, cy + 3, L.CW, L.CH, PAL.shadow);
    box(ctx, cx, cy, L.CW, L.CH, PAL.card, PAL.goldDk);
    frame(ctx, cx + 2, cy + 2, L.CW - 4, L.CH - 4, PAL.gold);
    text(ctx, '이 판의', cx + L.P, cy + L.kick, PAL.cardDim);
    text(ctx, '콤비네이션', cx + L.P, cy + L.title, PAL.goldDk, { bold: true });
    // 거쳐 간 모습(앞에서 넷, 넘치면 「+N」)
    ig.steps.slice(0, L.nShow).forEach((tp, i) => sprite(ctx, tp, 'w', cx + L.P + i * 18, cy + L.row, {}));
    if (L.more > 0) text(ctx, `+${L.more}`, cx + L.P + L.nShow * 18 + 1, cy + L.row + 5, PAL.cardDim, { bold: true });
    rect(ctx, cx + L.P, cy + L.rule, L.CW - L.P * 2, 1, PAL.cardDim);
    text(ctx, '먹은 수', cx + L.P, cy + L.caps, PAL.cardDim);
    text(ctx, String(ig.captures), R, cy + L.caps, PAL.cardInk, { align: 'right', bold: true });
    text(ctx, L.vm, cx + L.P, cy + L.vmY, PAL.cardDim);
    text(ctx, L.sc, R, cy + L.scY, PAL.goldDk, { align: 'right', bold: true });
    closeBox();
  };
  if (k < 1) fine(draw); else draw();
  if (!calm && k >= 1 && t < land + 0.5) glow(ctx, cx - 6, cy - 6, L.CW + 12, L.CH + 12, PAL.goldHi, 0.6 * (1 - (t - land) / 0.5), 10);
  return { x: cx, y: cy, w: L.CW, h: L.CH };
}
