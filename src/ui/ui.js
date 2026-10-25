// 즉시 모드 화면 조작: 그리는 동안 누를 수 있는 구역(region)을 적어 두고, 입력은 지난 프레임의 구역에 맞춘다.
// 구역 id는 연기 시험(tools/smoke.mjs)이 찾아 누르는 이름표이기도 하다.
import { richText } from './glossary.js';
import { moveDiagram, DIAG_SIZE, DIAG_W } from './diagram.js';
import { PAL } from '../render/palette.js';
import { box, rect, rrect, rframe, text, measure, lift, inner } from '../render/gfx.js';
import { familyChips, chipRows, chipBlockH, chipText } from './parts-depth.js';
import { wrap } from '../render/text.js';
import { PAD_BOX, LINE, GAP_IN, GAP_GROUP, EDGE_PAD, INK_H, flow, inkY, BTN_H, BTN_MIN, BTN_PAD, SP } from './frame.js';
import { openBox, closeBox, logClip, LOG, logFrame, arcInset } from '../render/layoutlog.js';

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
    this.finger = 0;       // 손가락 기기면 44pt가 몇 도트인지(app이 그릴 때마다 넘긴다 — fingerDots), 마우스면 0
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
      // hit: 네모(bbox) 안에서 모양을 더 가린다(투영한 판 칸 — board3.js unproject)
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h && (!r.hit || r.hit(x, y))) return r;
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
  // 손가락 자리 고치기(app.pointer가 down · up 앞에 부른다 — 화면의 pointerDown도 고친 자리를 받는다). 마우스면 그대로.
  // down: 아무 구역도 없는 자리를 누르면, 손가락 크기(finger)로 넓혔을 때 그 자리를 덮는 가장 가까운 구역 안으로 붙인다(빈 자리만 — 다른 구역을 뺏지 않는다)
  // up: 누른 구역에서 손가락이 떼며 조금 밀려도(손가락 크기 + TAP_SLOP 안) 누른 구역 안으로 되돌린다(끌기는 그대로)
  snap(kind, x, y) {
    if (!this.touch || !this.finger) return [x, y];
    const reach = (r, pad = 0) => {
      const ex = Math.max(0, (this.finger - r.w) / 2) + pad, ey = Math.max(0, (this.finger - r.h) / 2) + pad;
      const dx = Math.max(r.x - x, 0, x - (r.x + r.w - 1)), dy = Math.max(r.y - y, 0, y - (r.y + r.h - 1));
      return dx <= ex && dy <= ey ? dx * dx + dy * dy : -1;
    };
    const into = (r) => {
      const p = [Math.min(Math.max(x, r.x), r.x + r.w - 1), Math.min(Math.max(y, r.y), r.y + r.h - 1)];
      if (!r.hit || r.hit(p[0], p[1])) return p;
      const c = [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
      return r.hit(c[0], c[1]) ? c : null;
    };
    if (kind === 'down') {
      if (this.hitIn(this.regions, x, y)) return [x, y];
      let best = null, bd = Infinity;
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const r = this.regions[i];
        if (r.passive || !r.enabled || !(r.onClick || r.drag || r.tip || r.keys) || r.w <= 0 || r.h <= 0) continue;
        const d = reach(r);
        if (d >= 0 && d < bd) { const p = into(r); if (p && this.hitIn(this.regions, p[0], p[1]) === r) { best = p; bd = d; } }
      }
      return best || [x, y];
    }
    const p = this.press;
    if (!p || (this.drag && this.drag.moved)) return [x, y];
    const hit = this.hitIn(this.regions, x, y);
    if (hit && hit.id === p.id) return [x, y];
    let cur = null;
    for (let i = this.regions.length - 1; i >= 0 && !cur; i--) if (this.regions[i].id === p.id) cur = this.regions[i];
    if (!cur || reach(cur, TAP_SLOP) < 0) return [x, y];
    const q = into(cur);
    return q && this.hitIn(this.regions, q[0], q[1]) === cur ? q : [x, y];
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

// 손가락 누르는 구역(CHM-52): 손가락 기기면 실제 화면 44pt(CSS 화소)를 도트로 몇 칸인지. 마우스 기기면 0(구역을 넓히지 않는다).
// app.pixelScale = 도트 하나의 CSS 크기(main.js), app.coarse = 손가락 기기(첫 그림부터), app.touch = 손가락으로 누른 적 있음
export const FINGER_PT = 44;
// 손가락을 떼며 밀려도 누른 것으로 치는 거리(도트, 손가락 크기로 넓힌 구역 밖으로 — UI.snap). 끌기로 치는 거리(ui.move 8)와 같다
export const TAP_SLOP = 8;
export function fingerDots(app) {
  if (!app || !(app.coarse || app.touch)) return 0;
  return Math.ceil(FINGER_PT / (app.pixelScale > 0 ? app.pixelScale : 1));
}
// 누르는 구역 (x, y, w, h)를 need 도트까지 넓힌다. room = 쪽마다 넓힐 수 있는 최대 도트 { l, r, u, d }(없으면 0).
// 모자라는 몫은 넓힐 수 있는 쪽에 반씩, 한쪽이 막히면 다른 쪽이 나머지를 진다. 그림은 그대로, 구역만 넓어진다
export function growHit(x, y, w, h, need, room = {}) {
  const side = (deficit, a, b) => {
    if (deficit <= 0) return [0, 0];
    let ea = Math.min(a, Math.ceil(deficit / 2)), eb = Math.min(b, deficit - ea);
    ea = Math.min(a, deficit - eb);
    return [ea, eb];
  };
  const [l, r] = side(need - w, room.l || 0, room.r || 0);
  const [u, d] = side(need - h, room.u || 0, room.d || 0);
  return { x: x - l, y: y - u, w: w + l + r, h: h + u + d };
}

// 버튼: 글자 버튼(도트 테두리). 누를 수 없으면 흐리게.
// label이 비면 아이콘(7)만 가운데 — 이름은 tip(말풍선)으로.
// grow: 손가락 기기에서 누르는 구역을 넓힐 수 있는 쪽마다 최대 도트 { l, r, u, d }(이웃 단추 · 칸과 겹치지 않는 만큼, CHM-52). 그림은 그대로
// 알약 모서리: 높이의 반까지, 글(잉크 윗줄 · 아랫줄)이 둥근 끝에서 EDGE_PAD 넘게 떨어지는 가장 큰 반지름(좁은 단추는 덜 둥글다 — layoutlog.js 안 여백 검사와 같은 셈)
export function pillR(w, h, tw) {
  const slack = (w - tw) / 2 - 1 - EDGE_PAD, top = inkY(0, h), bot = h - top - INK_H;
  for (let r = Math.floor(h / 2); r > 0; r--) if (Math.max(arcInset(r, top), arcInset(r, bot)) <= slack - 0.5) return r;
  return 0;
}
// 글에 맞춘 단추 폭(29절): 글 + 양쪽 BTN_PAD(12), 가장 좁아도 min(BTN_MIN 64). icon이면 아이콘 자리(10)를 더한다
export const btnW = (label, { icon = false, min = BTN_MIN } = {}) => Math.max(min, (label ? measure(label, true) : 0) + (icon ? 10 : 0) + BTN_PAD * 2);
// w · h를 null로 주면 w는 btnW(글), h는 BTN_H
export function button(ctx, ui, id, x, y, w, h, label, { enabled = true, onClick = null, tone = 'plain', icon = null, tip = null, grow = null } = {}) {
  if (w == null) w = btnW(label, { icon: !!icon });
  if (h == null) h = BTN_H;
  const g = grow && ui.finger ? growHit(x, y, w, h, ui.finger, grow) : { x, y, w, h };
  const r = ui.region(id, g.x, g.y, g.w, g.h, { enabled, onClick, ...(tip ? { tip } : {}) });
  const hov = enabled && ui.isHover(id);
  const pressed = hov && ui.press && ui.press.id === id;
  // 알약 단추(안 3 — layout.md 27절): 크림(보조) · 금빛(주) · 붉은(위험), 꺼진 단추는 빈 자리 빛깔. 잉크 테 1 + 바로 아래 잉크 그림자 2(누르면 1 내려앉고 1)
  const fills = {
    plain: [PAL.btn, PAL.cardInk],
    gold: [PAL.gold, PAL.cardInk],
    red: [PAL.btnRed, PAL.btnRedInk],
    card: [PAL.btn, PAL.cardInk],
    dark: [PAL.slot, PAL.ink],
  };
  let [fill, ink] = fills[tone] || fills.plain;
  if (!enabled) { fill = PAL.slot; ink = PAL.dimDk; }
  const oy = pressed ? 1 : 0;
  const tw0 = label ? measure(label, true) + (icon ? 10 : 0) : 7;
  const pr = pillR(w, h, tw0);
  openBox('edge', x, y + oy, w, h, 1, { name: `단추 ${id}`, r: pr });
  const d = enabled ? 2 - oy : 0;
  if (LOG.on) logFrame(Math.round(x), Math.round(y + oy), Math.round(w), Math.round(h));
  if (d > 0) rrect(ctx, x, y + oy + d, w, h, pr, PAL.drop);
  rrect(ctx, x, y + oy, w, h, pr, hov ? (tone === 'gold' ? PAL.goldDk : PAL.gold) : !enabled ? PAL.slotEdge : PAL.frameDk);
  inner(ctx, x, y + oy, w, h, Math.max(0, pr - 1), hov && tone === 'gold' ? PAL.goldHi : fill);
  const tw = tw0;
  let tx = x + Math.floor((w - tw) / 2);
  const ty = inkY(y, h) + oy;
  if (icon) { icon(ctx, tx, ty + 2, ink); tx += 10; }
  if (label) text(ctx, label, tx, ty, ink, { bold: true });
  closeBox();
  return r;
}

// 단추 한 줄(29절): 모두 같은 폭(가장 넓은 글의 btnW — w로 정할 수 있다), 사이 gap(8). anchor: x가 줄의 왼끝 left · 가운데 center · 오른끝 right.
// items: [{ id, label, onClick, tone, enabled, icon, tip, grow }]. 돌려주는 값 { x, w(줄 폭), bw(단추 폭), rects }
export function rowWidth(items, { gap = SP.m, w = null, min = BTN_MIN } = {}) {
  const bw = w ?? Math.max(0, ...items.map((it) => btnW(it.label, { icon: !!it.icon, min })));
  return { bw, w: items.length ? items.length * bw + (items.length - 1) * gap : 0 };
}
export function buttonRow(ctx, ui, items, x, y, { anchor = 'left', gap = SP.m, w = null, h = BTN_H, min = BTN_MIN } = {}) {
  const { bw, w: total } = rowWidth(items, { gap, w, min });
  const x0 = anchor === 'center' ? x - Math.floor(total / 2) : anchor === 'right' ? x - total : x;
  const rects = items.map((it, i) => {
    const bx = x0 + i * (bw + gap);
    const { id, label, ...opts } = it;
    button(ctx, ui, id, bx, y, bw, h, label, opts);
    return { id, x: bx, y, w: bw, h };
  });
  return { x: x0, w: total, bw, rects };
}
// 토글 무리(켬 · 끔 · ×1 · 한국어 — 29절): 같은 폭, 고른 것은 금빛. options [[값, 글]], 단추 id는 `${prefix}:${값}`. 사이 gap(4)
export function toggleGroup(ctx, ui, prefix, options, cur, x, y, go, { anchor = 'left', gap = SP.s, w = null, h = BTN_H, min = BTN_MIN, enabled = true } = {}) {
  const items = options.map(([v, label]) => ({ id: `${prefix}:${v}`, label, tone: cur === v ? 'gold' : 'plain', enabled, onClick: () => go(v) }));
  return buttonRow(ctx, ui, items, x, y, { anchor, gap, w, h, min });
}

// 말풍선 내용을 폭 w에 맞춘 줄들. 말풍선은 만들 때 폭을 모른다(자리 규칙이 폭을 정한다 — placement.js):
// tip.body(글) · tip.extra([글, 빛깔] · { chips })를 여기서 줄바꿈한다. 옛 꼴(tip.lines만)은 줄마다 다시 줄바꿈한다.
// 행마 그림(tip.diagram)은 폭이 넉넉하면(150 이상) 본문 왼쪽, 좁으면 제목 아래 한 줄을 다 쓰고 글은 그 아래.
// 쌓기(frame.js 토큰): 안 여백 PAD_BOX → 제목(제목 줄) → 묶음 틈 → [그림 → 묶음 안 틈] → 본문 줄들 → 묶음 틈 → 칩 줄 → 안 여백
const diagSide = (tip, w) => !!tip.diagram && w >= 150;
// 덜 중요한 줄({ opt: 줄 } — parts.js optLine): 자리가 모자라면 「…」로 자르기 전에 먼저 뺀다
const unOpt = (l) => (l && l.opt !== undefined ? l.opt : l);
// 묶음 가름줄({ sep: true } — TIP_SEP): 한 말풍선에 풀이 둘 이상(지키는 적 + 판 위 사물)을 담을 때 사이에 가는 줄
export const TIP_SEP = Object.freeze({ sep: true });
const isSep = (l) => !!(l && l.sep);
const SEP_H = SP.s * 2 + 1;
export function tipRows(tip, w, { dropOpt = false } = {}) {
  const tw = w - PAD_BOX * 2 - (diagSide(tip, w) ? DIAG_W : 0);
  const src0 = tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || [];
  const src = (dropOpt ? src0.filter((l) => !(l && l.opt !== undefined)) : src0).map(unOpt);
  const out = [];
  out.starts = []; // 글 한 줄(줄바꿈 앞)이 시작하는 줄 번호 — 자를 때 문장 가운데서 끊지 않게
  for (const l of src) {
    if (!l) continue;
    if (isSep(l)) { if (out.length && !isSep(out[out.length - 1])) out.push(l); continue; }
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
    rrect(ctx, x, my, 7, 7, 2, PAL.goldDk);
    ctx.beginPath(); ctx.moveTo(x + 1.8, my + 3.6); ctx.lineTo(x + 3, my + 5); ctx.lineTo(x + 5.4, my + 2);
    ctx.strokeStyle = PAL.card; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    return;
  }
  rframe(ctx, x, my, 7, 7, 2, STEP_INK[st]);
  if (st === 'next') rframe(ctx, x + 1, my + 1, 5, 5, 1, PAL.goldDk);
}
const isChips = (l) => !!(l && l.chips);
// 말풍선 자리 재기: 재기와 그리기가 같은 흐름을 쓴다. 돌려주는 값 { h, title, diag, rows: [{ l, y }], cut }(y는 글 · 칩 윗변)
// maxH: 자리 규칙이 준 높이(placement.js clip). 넘치면 뒤의 줄부터 빼고 「…」 한 줄로 마친다(cut) — 재는 높이와 그리는 높이가 늘 같다
export const TIP_CUT = '…';
// 말풍선 제목 빛깔: 낱말 상자(glossary.js drawKeyBox) 제목과 같은 짙은 금빛 — 묶음으로 쌓여도 제목 빛깔이 하나다
export const TIP_TITLE = PAL.goldDk;
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
  while (rows.length && isSep(rows[rows.length - 1])) rows = rows.slice(0, -1);
  if (cut) rows = [...rows, [TIP_CUT, PAL.cardDim]];
  f.gap(GAP_GROUP);
  // 그림 칸(tip.block { h, draw }, 판 보기의 큰 판 — CHM-61): 제목 아래 온 폭. 자를 때도 남는다(그것이 말풍선의 본 내용)
  if (tip.block) { out.block = f.space(tip.block.h); if (rows.length) f.gap(GAP_IN); }
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
    if (isSep(l)) { out.rows.push({ l, y: f.space(SEP_H) }); return; }
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
  for (const [l, ly] of lay.titles) text(ctx, l, x + P, y + ly, tip.titleCol || TIP_TITLE, { bold: true });
  if (lay.diagOn) moveDiagram(ctx, tip.diagram.t, x + P, y + lay.diag, { dir: tip.diagram.dir || 1 });
  if (tip.block) tip.block.draw(ctx, x + P, y + lay.block, w - P * 2);
  for (const { l, y: ly } of lay.rows) {
    if (isChips(l)) { familyChips(ctx, l.chips, x + P + dx, y + ly, lay.tw); continue; }
    if (isSep(l)) { rect(ctx, x + P + dx, y + ly + SP.s, lay.tw, 1, PAL.cardDim); continue; }
    if (l.step) { if (l.mark) stepMark(ctx, l.step, x + P + dx, y + ly); text(ctx, l.s, x + P + dx + STEP_IN, y + ly, STEP_INK[l.step], { bold: l.step === 'next' }); continue; }
    if (Array.isArray(l)) text(ctx, l[0], x + P + dx, y + ly, l[1]);
    else richText(ctx, l, x + P + dx, y + ly, PAL.cardDim, { termCol: PAL.goldDk });
  }
  // 자리 높이로 자른 말풍선(CHM-34 — 설계): 「잘린 글」 검사가 허용 목록으로 가른다
  if (lay.cut) logClip('cut', lay.titles.map(([l]) => l).join(' '), TIP_CUT, w);
  closeBox();
  return { x, y, w, h, cut: lay.cut, lean: !!lay.lean && !lay.cut };
}
// 말풍선 글(낱말 상자가 찾을 낱말): 줄바꿈 앞의 글이라 줄에 잘린 낱말(「기사 / 시너지」)도 찾는다. 글 조각마다 하나씩
export function tipTexts(tip) {
  const src = (tip.body ? [...tip.body, ...(tip.extra || [])] : tip.lines || []).map(unOpt);
  return src.filter((l) => l && !l.chips && !l.sep).map((l) => String(l.step ? l.s : Array.isArray(l) ? l[0] : l));
}

// 큰 글자 설정: 말풍선 하나를 두 배 글자로 화면 아래 가운데에(고정 자리, 낱말 상자 없음)
export function bigTooltip(ctx, tip) {
  const all = [];
  if (tip.title) all.push([tip.title, tip.titleCol || TIP_TITLE, true]);
  for (const l of tipRows(tip, 236)) { if (isSep(l)) continue; const [s, col] = l && l.chips ? [chipText(l.chips), PAL.cardDim] : l && l.step ? [l.mark ? `${stepGlyph(l.step)} ${l.s}` : `  ${l.s}`, STEP_INK[l.step]] : Array.isArray(l) ? l : [l, PAL.cardDim]; all.push([s, col, false]); }
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
