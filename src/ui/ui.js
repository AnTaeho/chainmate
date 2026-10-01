// 즉시 모드 화면 조작: 그리는 동안 누를 수 있는 구역(region)을 적어 두고, 입력은 지난 프레임의 구역에 맞춘다.
// 구역 id는 연기 시험(tools/smoke.mjs)이 찾아 누르는 이름표이기도 하다.
import { richText } from './glossary.js';
import { moveDiagram, DIAG_SIZE, DIAG_W } from './diagram.js';
import { PAL } from '../render/palette.js';
import { box, rect, text, frame, measure, lift } from '../render/gfx.js';
import { familyChips, chipRows, chipBlockH, chipText } from './parts-depth.js';
import { wrap } from '../render/text.js';
import { PAD_BOX, LINE, GAP_IN, GAP_GROUP, flow, inkY } from './frame.js';
import { openBox, closeBox } from '../render/layoutlog.js';

export class UI {
  constructor() {
    this.regions = [];
    this.last = [];
    this.mouse = { x: -1, y: -1 };
    this.hover = null;
    this.press = null;     // 누른 구역
    this.drag = null;      // { region, x, y, moved }
    this.time = 0;
    this.termSpans = [];   // 글 안 낱말 자리(richText가 적는다)
    this.side = [];        // 판 틀 왼쪽 칸 판넬(설명 자리 접기 — fold.js)
    this.touch = false;    // 손가락으로 누르는 중(app이 넘긴다)
    this.previewId = null; // 손가락: 한 번 누른 카드(한 번 더 누르면 산다 · 고른다)
  }
  begin() { this.last = this.regions; this.regions = []; this.termSpans = []; this.side = []; }
  // 판 틀 왼쪽 칸의 판넬 하나(설명 자리 접기 — fold.js). rows: 판넬 안 줄들의 [윗변, 아랫변](있으면 묶음에 닿은 줄만 비운다),
  // blank(ctx): 통째로 비운 모습을 그린다(없으면 판넬 바탕으로 칠한다)
  sideItem(x, y, w, h, { rows = null, blank = null } = {}) { const it = { x, y, w, h, rows, blank }; this.side.push(it); return it; }
  end() { this.hover = this.hitIn(this.regions, this.mouse.x, this.mouse.y); }
  region(id, x, y, w, h, opts = {}) {
    const r = { id, x, y, w, h, enabled: opts.enabled !== false, ...opts };
    this.regions.push(r);
    return r;
  }
  isHover(id) { return this.hover && this.hover.id === id; }
  hitIn(list, x, y) {
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.passive) continue;
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
    }
    return null;
  }
  find(id) { return this.regions.find((r) => r.id === id) || null; }
  // 입력
  move(x, y) {
    this.mouse.x = x; this.mouse.y = y;
    this.hover = this.hitIn(this.regions, x, y);
    // 끌기로 치는 거리: 손가락은 떨림이 커서 8도트(3도트면 3배 화면의 폰에서 누르기가 끌기로 바뀐다)
    const slop = this.touch ? 8 : 3;
    if (this.drag && (Math.abs(x - this.drag.x) > slop || Math.abs(y - this.drag.y) > slop)) this.drag.moved = true;
  }
  down(x, y) {
    this.move(x, y);
    const r = this.hitIn(this.regions, x, y);
    this.press = r;
    if (r && r.enabled && r.drag) this.drag = { region: r, x, y, moved: false };
    return r;
  }
  up(x, y) {
    this.move(x, y);
    const r = this.hitIn(this.regions, x, y);
    const p = this.press;
    const d = this.drag;
    this.press = null;
    this.drag = null;
    if (d && d.moved) {
      if (d.region.onDrop) d.region.onDrop(x, y, r);
      return 'drag';
    }
    if (r && p && r.id === p.id && r.enabled && r.onClick) {
      // 손가락으로는 preview 카드를 처음 누르면 말풍선 · 낱말 상자만 보이고, 한 번 더 눌러야 산다 · 고른다
      if (this.touch && r.preview && this.previewId !== r.id) { this.previewId = r.id; return r; }
      this.previewId = null;
      r.onClick(r);
      return r;
    }
    if (!r || r.id !== this.previewId) this.previewId = null;
    return null;
  }
}

// 버튼: 글자 버튼(도트 테두리). 누를 수 없으면 흐리게.
// label이 비면 아이콘(7)만 가운데 — 이름은 tip(말풍선)으로
export function button(ctx, ui, id, x, y, w, h, label, { enabled = true, onClick = null, tone = 'plain', icon = null, tip = null } = {}) {
  const r = ui.region(id, x, y, w, h, { enabled, onClick, ...(tip ? { tip } : {}) });
  const hov = enabled && ui.isHover(id);
  const pressed = hov && ui.press && ui.press.id === id;
  const fills = {
    plain: [PAL.feltDk, PAL.ink],
    gold: [PAL.gold, PAL.linkInk],
    red: [PAL.red, PAL.cardHi],
    card: [PAL.card, PAL.cardInk],
  };
  let [fill, ink] = fills[tone] || fills.plain;
  if (!enabled) { fill = PAL.feltDk; ink = PAL.dimDk; }
  const oy = pressed ? 1 : 0;
  openBox('edge', x, y + oy, w, h, 1, { name: `단추 ${id}` });
  box(ctx, x, y + oy, w, h, fill, hov ? PAL.gold : PAL.frameDk);
  // 윗변 한 줄 빛 · 아랫변 한 줄 그늘(누르면 1px 내려앉고 빛이 사라진다)
  if (!pressed) rect(ctx, x + 1, y + 1 + oy, w - 2, 1, hov ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)');
  rect(ctx, x + 1, y + h - 2 + oy, w - 2, 1, 'rgba(0,0,0,0.28)');
  const tw = label ? measure(label, true) + (icon ? 10 : 0) : 7;
  let tx = x + Math.floor((w - tw) / 2);
  const ty = inkY(y, h) + oy;
  if (icon) { icon(ctx, tx, ty + 2, ink); tx += 10; }
  if (label) text(ctx, label, tx, ty, ink, { bold: true });
  closeBox();
  return r;
}

// 말풍선 내용을 폭 w에 맞춘 줄들. 말풍선은 만들 때 폭을 모른다(자리 규칙이 폭을 정한다 — placement.js):
// tip.body(글) · tip.extra([글, 빛깔] · { chips })를 여기서 줄바꿈한다. 옛 꼴(tip.lines만)은 줄마다 다시 줄바꿈한다.
// 행마 그림(tip.diagram)은 폭이 넉넉하면(150 이상) 본문 왼쪽, 좁으면 제목 아래 한 줄을 다 쓰고 글은 그 아래.
// 쌓기(frame.js 토큰): 안 여백 PAD_BOX → 제목(제목 줄) → 묶음 틈 → [그림 → 묶음 안 틈] → 본문 줄들 → 묶음 틈 → 칩 줄 → 안 여백
const diagSide = (tip, w) => !!tip.diagram && w >= 150;
// 덜 중요한 줄({ opt: 줄 } — parts.js optLine): 자리가 모자라면 「…」로 자르기 전에 먼저 뺀다
const unOpt = (l) => (l && l.opt !== undefined ? l.opt : l);
export function tipRows(tip, w, { dropOpt = false } = {}) {
  const tw = w - PAD_BOX * 2 - (diagSide(tip, w) ? DIAG_W : 0);
  const src0 = tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || [];
  const src = (dropOpt ? src0.filter((l) => !(l && l.opt !== undefined)) : src0).map(unOpt);
  const out = [];
  out.starts = []; // 글 한 줄(줄바꿈 앞)이 시작하는 줄 번호 — 자를 때 문장 가운데서 끊지 않게
  for (const l of src) {
    if (!l) continue;
    out.starts.push(out.length);
    if (l.chips) { out.push(l); continue; }
    // 걸음 줄(명국 조각): 앞에 표시 네모, 넘친 글은 표시 오른쪽에 맞춰 내려 쓴다
    if (l.step) { wrap(String(l.s), tw - STEP_IN, l.step === 'next').forEach((q, k) => out.push({ step: l.step, s: q, mark: k === 0 })); continue; }
    if (Array.isArray(l)) { for (const q of wrap(String(l[0]), tw)) out.push([q, l[1]]); continue; }
    for (const q of wrap(String(l), tw)) out.push(q);
  }
  return out;
}
// 걸음 줄: done 얻었다(체크 · 진한 글) · next 다음에 할 것(짙은 금빛 네모 · 굵게) · todo 남았다(빈 네모 · 흐린 글) · step 판 밖(도감 — 빈 네모 · 본문 글)
export const STEP_IN = 10;
const STEP_INK = { done: PAL.cardInk, next: PAL.goldDk, todo: '#a18f70', step: PAL.cardDim };
export const stepGlyph = (st) => (st === 'done' ? '■' : '□');
// 표시 네모 7 × 7: 글 잉크(11) 가운데 줄에 맞춘다
function stepMark(ctx, st, x, y) {
  const my = y + 2;
  if (st === 'done') {
    rect(ctx, x, my, 7, 7, PAL.goldDk);
    for (const [dx, dy] of [[1, 3], [2, 4], [3, 5], [4, 4], [5, 3], [6, 2]]) rect(ctx, x + dx, my + dy, 1, 1, PAL.cardHi);
    return;
  }
  frame(ctx, x, my, 7, 7, STEP_INK[st]);
  if (st === 'next') frame(ctx, x + 1, my + 1, 5, 5, PAL.goldDk);
}
const isChips = (l) => !!(l && l.chips);
// 말풍선 자리 재기: 재기와 그리기가 같은 흐름을 쓴다. 돌려주는 값 { h, title, diag, rows: [{ l, y }], cut }(y는 글 · 칩 윗변)
// maxH: 자리 규칙이 준 높이(placement.js clip). 넘치면 뒤의 줄부터 빼고 「…」 한 줄로 마친다(cut) — 재는 높이와 그리는 높이가 늘 같다
export const TIP_CUT = '…';
function tipLayout(tip, w, maxH = Infinity) {
  let all = tipRows(tip, w);
  let lay = tipLayoutRows(tip, w, all, !!tip.diagram, false);
  if (lay.h <= maxH) return lay;
  // 덜 중요한 줄(optLine)부터, 다음은 행마 그림(행마는 대국 「행마」 보기에 있다), 그래도 넘치면 뒤의 줄부터 「…」로
  const lean = tipRows(tip, w, { dropOpt: true });
  const thin = lean.length < all.length;
  const mark = (q) => { q.lean = thin || !!tip.diagram; return q; };
  if (thin) { all = lean; lay = tipLayoutRows(tip, w, all, !!tip.diagram, false); if (lay.h <= maxH) return mark(lay); }
  if (tip.diagram) { lay = tipLayoutRows(tip, w, all, false, false); if (lay.h <= maxH) return mark(lay); }
  // 글 한 줄 단위로 뒤에서부터 뺀다(문장 가운데서 끊지 않는다). 첫 글 줄도 안 들어가면 줄바꿈한 줄 단위로
  const starts = all.starts || [0], firstEnd = starts.length > 1 ? starts[1] : all.length;
  const cuts = [];
  for (let i = starts.length - 1; i >= 1; i--) cuts.push(starts[i]);
  for (let k = firstEnd - 1; k >= 0; k--) cuts.push(k);
  for (const k of cuts) {
    lay = tipLayoutRows(tip, w, all.slice(0, k), false, true);
    if (lay.h <= maxH) return mark(lay);
  }
  return mark(lay);
}
function tipLayoutRows(tip, w, rows, diagOn, cut) {
  const side = diagOn && diagSide(tip, w);
  const tw = w - PAD_BOX * 2 - (side ? DIAG_W : 0);
  const f = flow(PAD_BOX);
  const out = { rows: [], diag: null, tw, side, cut, diagOn };
  // 제목은 제목 줄(길면 줄바꿈)
  out.titles = tip.title ? wrap(String(tip.title), w - PAD_BOX * 2, true).map((l) => [l, f.line(true)]) : [];
  if (cut) rows = [...rows, [TIP_CUT, PAL.cardDim]];
  f.gap(GAP_GROUP);
  const bodyTop = f.y;
  if (diagOn && !side) { out.diag = f.space(DIAG_SIZE + 1) + 1; f.gap(GAP_IN); }
  else if (diagOn) out.diag = bodyTop + 1;
  rows.forEach((l, i) => {
    if (isChips(l)) {
      if (i && !isChips(rows[i - 1])) f.gap(GAP_GROUP);
      const n = chipRows(l.chips, tw);
      out.rows.push({ l, y: f.space(chipBlockH(n)) });
      return;
    }
    out.rows.push({ l, y: f.line() });
  });
  if (side) f.y = Math.max(f.y, bodyTop + DIAG_SIZE + 1);
  out.h = f.y + PAD_BOX;
  return out;
}
export const tipHeight = (tip, w, maxH = Infinity) => tipLayout(tip, w, maxH).h;
// 말풍선 하나를 (x, y)에 폭 w로 그린다(자리는 placement.js가 정해 넘긴다 — 높이가 모자라면 maxH로 자른다). 그린 네모를 돌려준다
export function tooltip(ctx, x, y, tip, w, maxH = Infinity) {
  const lay = tipLayout(tip, w, maxH);
  const P = PAD_BOX, h = lay.h, dx = lay.side ? DIAG_W : 0;
  openBox('note', x, y, w, h, P, { overlay: true, name: '말풍선' });
  box(ctx, x, y, w, h, PAL.card, PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  for (const [l, ly] of lay.titles) text(ctx, l, x + P, y + ly, tip.titleCol || PAL.cardInk, { bold: true });
  if (lay.diagOn) moveDiagram(ctx, tip.diagram.t, x + P, y + lay.diag, { dir: tip.diagram.dir || 1 });
  for (const { l, y: ly } of lay.rows) {
    if (isChips(l)) { familyChips(ctx, l.chips, x + P + dx, y + ly, lay.tw); continue; }
    if (l.step) { if (l.mark) stepMark(ctx, l.step, x + P + dx, y + ly); text(ctx, l.s, x + P + dx + STEP_IN, y + ly, STEP_INK[l.step], { bold: l.step === 'next' }); continue; }
    if (Array.isArray(l)) text(ctx, l[0], x + P + dx, y + ly, l[1]);
    else richText(ctx, l, x + P + dx, y + ly, PAL.cardDim, { termCol: PAL.goldDk });
  }
  frame(ctx, x, y, w, h, PAL.frameDk);
  closeBox();
  return { x, y, w, h, cut: lay.cut, lean: !!lay.lean && !lay.cut };
}
// 말풍선 글(낱말 상자가 찾을 낱말): 줄바꿈 앞의 글이라 줄에 잘린 낱말(「기사 / 시너지」)도 찾는다. 글 조각마다 하나씩
export function tipTexts(tip) {
  const src = (tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || []).map(unOpt);
  return src.filter((l) => l && !l.chips).map((l) => String(l.step ? l.s : Array.isArray(l) ? l[0] : l));
}

// 큰 글자 설정: 말풍선 하나를 두 배 글자로 화면 아래 가운데에(고정 자리, 낱말 상자 없음)
export function bigTooltip(ctx, tip) {
  const all = [];
  if (tip.title) all.push([tip.title, tip.titleCol || PAL.cardInk, true]);
  for (const l of tipRows(tip, 236)) { const [s, col] = l && l.chips ? [chipText(l.chips), PAL.cardDim] : l && l.step ? [l.mark ? `${stepGlyph(l.step)} ${l.s}` : `  ${l.s}`, STEP_INK[l.step]] : Array.isArray(l) ? l : [l, PAL.cardDim]; all.push([s, col, false]); }
  // 두 배 글자: 줄 높이도 두 배(LINE × 2), 안 여백은 PAD_BOX
  const P = PAD_BOX, LH = LINE * 2;
  const bw = Math.min(476, Math.max(...all.map(([s, , b]) => measure(s, b))) * 2 + P * 2);
  const bh = P * 2 + all.length * LH;
  const x = Math.floor((480 - bw) / 2), y = 268 - bh;
  openBox('note', x, y, bw, bh, P, { overlay: true, name: '큰 말풍선' });
  lift(ctx, x, y, bw, bh);
  box(ctx, x, y, bw, bh, PAL.card, PAL.frameDk);
  all.forEach(([s, col, b], i) => text(ctx, s, x + P, y + P + i * LH + (LH - 24) / 2 - 2, col, { bold: b, scale: 2 }));
  closeBox();
  return { x, y, w: bw, h: bh };
}
