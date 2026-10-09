// 하이라이트 카드(CHM-73): 끝난 판의 덱 기물과 격언을 그림 한 장으로. 400 × 225 칸에 그리고 3배(1200 × 675)로 내보낸다.
// 칸 계산(highlightLayout)과 그리기(drawHighlight)가 같은 값을 쓴다 — 결과 화면 덮개(screens/highlight.js)와 내보낸 그림이 같은 그림이다.
import { PAL } from '../render/palette.js';
import { W, H, text, rect, frame, sprite, measure, short, fitNum } from '../render/gfx.js';
import { feltCanvas } from '../render/texture.js';
import { makeCanvas, context } from '../render/surface.js';
import { tierOf } from '../render/sprites.js';
import { LOG, openBox, closeBox } from '../render/layoutlog.js';
import { JOSEKI_BY_ID, TIER_COL } from '../data/josekis.js';
import { maximInfo } from '../sim/run.js';
import { maximCard, maximCellH, panel, chartLevel } from './parts.js';
import { IGNITE_TITLE } from './ignite.js';
import { PAD_CARD } from './frame.js';

export const CARD = { w: 400, h: 225, scale: 3 };
export const SITE = 'chainmate.papercut.kr';
export const HIGHLIGHT_FILE = 'chainmate-highlight.png';
const SIDE = 14;                               // 카드 안 좌우 여백
const MID = { y: 57, h: 114 };                 // 기물 판넬과 격언 칸이 서는 띠(둘을 묶어 이 띠 가운데에)
const BAG_H = 50, BAG_PAD = 8, MID_GAP = 5;
const BIG = { w: 32, h: 44, max: 30, min: 24 };   // 2배 기물: 걸음이 24 밑이면(15개부터) 겹침이 지나치다
const SMALL = { w: 16, h: 22, max: 22, min: 12 }; // 1배 기물 두 줄
const CELL_GAP = 6, ROW_GAP = 3, NAMED_W = 120, ICON_W = 55, ICON_MIN = 24;
const NAME_GAP = 10, BAND_GAP = 12;

// 보여 줄 것이 있는 판인가(한 수도 못 두고 끝난 판은 최고 한 수가 없다)
export const hasHighlight = (run) => !!(run && run.bestReplay && Array.isArray(run.deck) && run.deck.length);
// 사슬 길이. 옛 저장의 최고 한 수에는 captures가 없어 먹기 줄을 센다
export const chainOf = (r) => (r ? r.captures ?? (r.caps ? r.caps.length : 0) : 0);

// 기물 자리: 2배 한 줄 → 걸음이 모자라면 1배 두 줄 → 그래도 넘치면 「+N」
export function bagSpots(n, x, y, w) {
  const stepOf = (k, size) => Math.min(size.max, k > 1 ? Math.floor((w - size.w) / (k - 1)) : size.max);
  const row = (k, size, step, yy) => { const x0 = x + Math.floor((w - (step * (k - 1) + size.w)) / 2); return Array.from({ length: k }, (_, i) => ({ x: x0 + i * step, y: yy })); };
  if (stepOf(n, BIG) >= BIG.min) return { scale: 2, spots: row(n, BIG, stepOf(n, BIG), y + 3), more: null };
  const cap = Math.floor((w - SMALL.w) / SMALL.min) + 1;
  const shown = n <= cap * 2 ? n : cap * 2 - 3, top = n > shown ? cap : Math.ceil(shown / 2), step = stepOf(top, SMALL);
  const a = row(top, SMALL, step, y + 2), b = row(top, SMALL, step, y + 2 + SMALL.h + 2).slice(0, shown - top);
  return { scale: 1, spots: [...a, ...b], more: n > shown ? { n: n - shown, x: b[b.length - 1].x + step + 2, y: b[0].y + 5 } : null };
}

// 격언 칸 자리: 셋까지 한 줄, 그 위는 두 줄. 이름이 하나라도 굵게 안 들어가거나 아홉부터는 그림만(대국 오른쪽 칸의 좁은 칸과 같다)
export function maximSpots(maxims, x, y, w) {
  const n = maxims.length, h = maximCellH();
  if (!n) return { cells: [], rows: 0, narrow: false, more: null, h: 0 };
  const fit = (cols, cap) => Math.min(cap, Math.floor((w - CELL_GAP * (cols - 1)) / cols));
  let cols = n <= 3 ? n : Math.ceil(n / 2), cw = fit(cols, NAMED_W), shown = n;
  const narrow = n > 8 || maxims.some((m) => measure(maximInfo(m.id).name, true) > cw - PAD_CARD * 2);
  if (narrow) {
    const most = Math.floor((w + CELL_GAP) / (ICON_MIN + CELL_GAP));
    if (cols > most) { cols = most; shown = cols * 2 - 1; }
    cw = fit(cols, ICON_W);
  }
  const x0 = x + Math.floor((w - (cols * cw + (cols - 1) * CELL_GAP)) / 2);
  const at = (i) => ({ x: x0 + (i % cols) * (cw + CELL_GAP), y: y + Math.floor(i / cols) * (h + ROW_GAP), w: cw, h });
  const rows = Math.ceil((shown + (n > shown ? 1 : 0)) / cols);
  return { cells: Array.from({ length: shown }, (_, i) => at(i)), rows, narrow, more: n > shown ? { n: n - shown, ...at(shown) } : null, h: rows * h + (rows - 1) * ROW_GAP };
}

// 카드의 모든 자리와 글. (ox, oy): 카드 왼쪽 위
export function highlightLayout(run, ox = 0, oy = 0) {
  const r = run.bestReplay || {}, x = ox + SIDE, right = ox + CARD.w - SIDE, w = right - x;
  // 레퍼토리 이름(오른쪽 맞춤): 이름표와 한 줄에 안 들어가면 이름표를 빼고, 그래도 넘치면 뒤 이름부터 뺀다
  const names = (run.josekis || []).map((id) => JOSEKI_BY_ID[id]).filter(Boolean).map((j) => ({ s: j.name, col: TIER_COL[j.tier], w: measure(j.name, true) }));
  const span = () => names.reduce((a, j) => a + j.w, 0) + NAME_GAP * Math.max(0, names.length - 1);
  const label = span() + BAND_GAP + measure(IGNITE_TITLE) <= w;
  while (names.length && span() > w) names.pop();
  { let nx = right; for (let i = names.length - 1; i >= 0; i--) { nx -= names[i].w; names[i].x = nx; nx -= NAME_GAP; } }
  // 기물 판넬 + 격언 칸
  const maxims = run.maxims || [];
  const gh0 = maximSpots(maxims, x, 0, w).h;
  const top = oy + MID.y + ((MID.h - (BAG_H + (gh0 ? MID_GAP + gh0 : 0))) >> 1);
  const bag = { x, y: top, w, h: BAG_H, ...bagSpots(run.deck.length, x + BAG_PAD, top, w - BAG_PAD * 2) };
  const grid = maximSpots(maxims, x, top + BAG_H + MID_GAP, w);
  // 아래 띠: 윗줄 = 꼬리표 · 「최고 한 수 · 사슬 N」, 아랫줄 = 큰 글 · 점수
  const tag = run.phase === 'won' ? { s: '여덟 관을 꺾었다', col: PAL.gold } : run.endless ? { s: '끝없는 대국', col: PAL.gold } : { s: '닿은 곳', col: PAL.dim };
  const head = `이 덱으로 ${run.ante}관`, chain = chainOf(r), score = r.score || 0;
  const note = chain > 0 ? `최고 한 수 · 사슬 ${chain}` : '최고 한 수';
  // 큰 글은 두 배, 짧은 꼴 점수와도 한 줄에 안 들어가면 한 배 굵게. 점수는 남은 폭에 1,234 꼴이 안 들어가면 짧은 꼴
  const big = measure(head, true) * 2 + BAND_GAP + measure(short(score), true) * 2 <= w;
  const headW = measure(head, true) * (big ? 2 : 1);
  return {
    ox, oy, x, right, w, names, label, bag, grid, tag, head, note, big, headW,
    score: fitNum(score, Math.floor((w - headW - BAND_GAP) / 2)),
    logoY: oy + 9, siteY: oy + 16, ruleY: oy + 36, subY: oy + 41, tagY: oy + 176, bandY: oy + 193,
  };
}

// 카드 그리기. 움직이는 것이 없다(내보낸 그림과 화면의 카드가 같아야 한다)
export function drawHighlight(ctx, run, lay = highlightLayout(run)) {
  const { ox, oy, x, right, w, bag, grid } = lay;
  openBox('panel', ox, oy, CARD.w, CARD.h, 4, { name: '하이라이트 카드' });
  // 두 겹 금테 + 천 바탕(화면이 쓰는 천 그림에서 잘라 쓴다)
  rect(ctx, ox, oy, CARD.w, CARD.h, PAL.goldDk);
  ctx.drawImage(feltCanvas(W + 16, H + 16), 0, 0, CARD.w - 2, CARD.h - 2, ox + 1, oy + 1, CARD.w - 2, CARD.h - 2);
  frame(ctx, ox + 2, oy + 2, CARD.w - 4, CARD.h - 4, PAL.gold);
  text(ctx, '체인메이트', x, lay.logoY, PAL.gold, { bold: true, scale: 2 });
  text(ctx, SITE, right, lay.siteY, PAL.dim, { align: 'right' });
  rect(ctx, x, lay.ruleY, w, 1, PAL.feltHi);
  if (lay.label) text(ctx, IGNITE_TITLE, x, lay.subY, PAL.dim);
  for (const j of lay.names) text(ctx, j.s, j.x, lay.subY, j.col, { bold: true });
  panel(ctx, bag.x, bag.y, bag.w, bag.h);
  bag.spots.forEach((s, i) => {
    const p = run.deck[i];
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(bag.scale, bag.scale);
    sprite(ctx, p.t, 'w', 0, 0, { eng: p.eng ? p.eng.id : null, soul: p.soul || null, awake: !!p.awake, tier: tierOf(chartLevel(run, p.t)) });
    ctx.restore();
  });
  if (bag.more) text(ctx, `+${bag.more.n}`, bag.more.x, bag.more.y, PAL.dim);
  grid.cells.forEach((c, i) => maximCard(ctx, run.maxims[i], c.x, c.y, c.w, c.h, { narrow: grid.narrow }));
  if (grid.more) text(ctx, `+${grid.more.n}`, grid.more.x + (grid.more.w >> 1), grid.more.y + PAD_CARD + 1, PAL.dim, { align: 'center' });
  text(ctx, lay.tag.s, x, lay.tagY, lay.tag.col, { bold: lay.tag.col !== PAL.dim });
  text(ctx, lay.note, right, lay.tagY, PAL.dim, { align: 'right' });
  text(ctx, lay.head, x, lay.big ? lay.bandY : lay.bandY + 6, PAL.ink, { bold: true, scale: lay.big ? 2 : 1, shadow: PAL.shadow });
  text(ctx, lay.score, right, lay.bandY, PAL.gold, { bold: true, scale: 2, align: 'right', shadow: PAL.shadow });
  closeBox();
}

// 내보낼 그림: 화면과 따로 둔 1200 × 675 캔버스. 글 넘침 기록기는 이 그림을 적지 않는다
export function highlightCanvas(run) {
  const c = makeCanvas(CARD.w * CARD.scale, CARD.h * CARD.scale), ctx = context(c), on = LOG.on;
  LOG.on = false;
  try { ctx.scale(CARD.scale, CARD.scale); drawHighlight(ctx, run); } finally { LOG.on = on; }
  return c;
}
// PNG 덩이(Promise<Blob | null>). 캔버스가 PNG를 못 만들면 null
export function highlightBlob(run) {
  return new Promise((ok) => {
    try {
      const c = highlightCanvas(run);
      if (typeof c.toBlob === 'function') c.toBlob((b) => ok(b || null), 'image/png');
      else if (typeof c.convertToBlob === 'function') c.convertToBlob({ type: 'image/png' }).then(ok, () => ok(null));
      else ok(null);
    } catch { ok(null); }
  });
}
