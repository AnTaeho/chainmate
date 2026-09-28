// 즉시 모드 화면 조작: 그리는 동안 누를 수 있는 구역(region)을 적어 두고, 입력은 지난 프레임의 구역에 맞춘다.
// 구역 id는 연기 시험(tools/smoke.mjs)이 찾아 누르는 이름표이기도 하다.
import { richText } from './glossary.js';
import { moveDiagram, DIAG_SIZE, DIAG_W } from './diagram.js';
import { PAL } from '../render/palette.js';
import { box, rect, text, frame, measure } from '../render/gfx.js';
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
    this.touch = false;    // 손가락으로 누르는 중(app이 넘긴다)
    this.previewId = null; // 손가락: 한 번 누른 카드(한 번 더 누르면 산다 · 고른다)
  }
  begin() { this.last = this.regions; this.regions = []; this.termSpans = []; }
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
    if (this.drag && (Math.abs(x - this.drag.x) > 3 || Math.abs(y - this.drag.y) > 3)) this.drag.moved = true;
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
export function button(ctx, ui, id, x, y, w, h, label, { enabled = true, onClick = null, tone = 'plain', icon = null } = {}) {
  const r = ui.region(id, x, y, w, h, { enabled, onClick });
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
  const tw = measure(label, true) + (icon ? 10 : 0);
  let tx = x + Math.floor((w - tw) / 2);
  const ty = inkY(y, h) + oy;
  if (icon) { icon(ctx, tx, ty + 2, ink); tx += 10; }
  text(ctx, label, tx, ty, ink, { bold: true });
  closeBox();
  return r;
}

// 말풍선 내용을 폭 w에 맞춘 줄들. 말풍선은 만들 때 폭을 모른다(자리 규칙이 폭을 정한다 — placement.js):
// tip.body(글) · tip.extra([글, 빛깔] · { chips })를 여기서 줄바꿈한다. 옛 꼴(tip.lines만)은 줄마다 다시 줄바꿈한다.
// 행마 그림(tip.diagram)은 폭이 넉넉하면(150 이상) 본문 왼쪽, 좁으면 제목 아래 한 줄을 다 쓰고 글은 그 아래.
// 쌓기(frame.js 토큰): 안 여백 PAD_BOX → 제목(제목 줄) → 묶음 틈 → [그림 → 묶음 안 틈] → 본문 줄들 → 묶음 틈 → 칩 줄 → 안 여백
const diagSide = (tip, w) => !!tip.diagram && w >= 150;
export function tipRows(tip, w) {
  const tw = w - PAD_BOX * 2 - (diagSide(tip, w) ? DIAG_W : 0);
  const src = tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || [];
  const out = [];
  for (const l of src) {
    if (!l) continue;
    if (l.chips) { out.push(l); continue; }
    if (Array.isArray(l)) { for (const q of wrap(String(l[0]), tw)) out.push([q, l[1]]); continue; }
    for (const q of wrap(String(l), tw)) out.push(q);
  }
  return out;
}
const isChips = (l) => !!(l && l.chips);
// 말풍선 자리 재기: 재기와 그리기가 같은 흐름을 쓴다. 돌려주는 값 { h, title, diag, rows: [{ l, y }] }(y는 글 · 칩 윗변)
function tipLayout(tip, w) {
  const side = diagSide(tip, w);
  const tw = w - PAD_BOX * 2 - (side ? DIAG_W : 0);
  const f = flow(PAD_BOX);
  const out = { rows: [], diag: null, tw, side };
  // 제목은 제목 줄(길면 줄바꿈)
  out.titles = tip.title ? wrap(String(tip.title), w - PAD_BOX * 2, true).map((l) => [l, f.line(true)]) : [];
  const rows = tipRows(tip, w);
  f.gap(GAP_GROUP);
  const bodyTop = f.y;
  if (tip.diagram && !side) { out.diag = f.space(DIAG_SIZE + 1) + 1; f.gap(GAP_IN); }
  else if (tip.diagram) out.diag = bodyTop + 1;
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
export const tipHeight = (tip, w) => tipLayout(tip, w).h;
// 말풍선 하나를 (x, y)에 폭 w로 그린다(자리는 placement.js가 정해 넘긴다). 그린 네모를 돌려준다
export function tooltip(ctx, x, y, tip, w) {
  const lay = tipLayout(tip, w);
  const P = PAD_BOX, h = lay.h, dx = lay.side ? DIAG_W : 0;
  openBox('note', x, y, w, h, P, { overlay: true, name: '말풍선' });
  box(ctx, x, y, w, h, PAL.card, PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  for (const [l, ly] of lay.titles) text(ctx, l, x + P, y + ly, tip.titleCol || PAL.cardInk, { bold: true });
  if (tip.diagram) moveDiagram(ctx, tip.diagram.t, x + P, y + lay.diag, { dir: tip.diagram.dir || 1 });
  for (const { l, y: ly } of lay.rows) {
    if (isChips(l)) { familyChips(ctx, l.chips, x + P + dx, y + ly, lay.tw); continue; }
    if (Array.isArray(l)) text(ctx, l[0], x + P + dx, y + ly, l[1]);
    else richText(ctx, l, x + P + dx, y + ly, PAL.cardDim, { termCol: PAL.goldDk });
  }
  frame(ctx, x, y, w, h, PAL.frameDk);
  closeBox();
  return { x, y, w, h };
}
// 말풍선 글(낱말 상자가 찾을 낱말): 줄바꿈 앞의 글이라 줄에 잘린 낱말(「기사 / 시너지」)도 찾는다. 글 조각마다 하나씩
export function tipTexts(tip) {
  const src = tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || [];
  return src.filter((l) => l && !l.chips).map((l) => String(Array.isArray(l) ? l[0] : l));
}

// 큰 글자 설정: 말풍선 하나를 두 배 글자로 화면 아래 가운데에(고정 자리, 낱말 상자 없음)
export function bigTooltip(ctx, tip) {
  const all = [];
  if (tip.title) all.push([tip.title, tip.titleCol || PAL.cardInk, true]);
  for (const l of tipRows(tip, 236)) { const [s, col] = l && l.chips ? [chipText(l.chips), PAL.cardDim] : Array.isArray(l) ? l : [l, PAL.cardDim]; all.push([s, col, false]); }
  // 두 배 글자: 줄 높이도 두 배(LINE × 2), 안 여백은 PAD_BOX
  const P = PAD_BOX, LH = LINE * 2;
  const bw = Math.min(476, Math.max(...all.map(([s, , b]) => measure(s, b))) * 2 + P * 2);
  const bh = P * 2 + all.length * LH;
  const x = Math.floor((480 - bw) / 2), y = 268 - bh;
  openBox('note', x, y, bw, bh, P, { overlay: true, name: '큰 말풍선' });
  box(ctx, x, y, bw, bh, PAL.card, PAL.frameDk);
  all.forEach(([s, col, b], i) => text(ctx, s, x + P, y + P + i * LH + (LH - 24) / 2 - 2, col, { bold: b, scale: 2 }));
  closeBox();
  return { x, y, w: bw, h: bh };
}
