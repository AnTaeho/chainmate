// 즉시 모드 화면 조작: 그리는 동안 누를 수 있는 구역(region)을 적어 두고, 입력은 지난 프레임의 구역에 맞춘다.
// 구역 id는 연기 시험(tools/smoke.mjs)이 찾아 누르는 이름표이기도 하다.
import { PAL } from '../render/palette.js';
import { box, rect, text, frame, measure } from '../render/gfx.js';

export class UI {
  constructor() {
    this.regions = [];
    this.last = [];
    this.mouse = { x: -1, y: -1 };
    this.hover = null;
    this.press = null;     // 누른 구역
    this.drag = null;      // { region, x, y, moved }
    this.time = 0;
  }
  begin() { this.last = this.regions; this.regions = []; }
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
    if (r && p && r.id === p.id && r.enabled && r.onClick) { r.onClick(r); return r; }
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
  box(ctx, x, y + oy, w, h, fill, hov ? PAL.gold : PAL.frameDk);
  // 윗변 한 줄 빛 · 아랫변 한 줄 그늘(누르면 1px 내려앉고 빛이 사라진다)
  if (!pressed) rect(ctx, x + 1, y + 1 + oy, w - 2, 1, hov ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)');
  rect(ctx, x + 1, y + h - 2 + oy, w - 2, 1, 'rgba(0,0,0,0.28)');
  const tw = measure(label, true) + (icon ? 10 : 0);
  let tx = x + Math.floor((w - tw) / 2);
  const ty = y + Math.floor((h - 12) / 2) + oy;
  if (icon) { icon(ctx, tx, ty + 2, ink); tx += 10; }
  text(ctx, label, tx, ty, ink, { bold: true });
  return r;
}

// 말풍선: 제목 + 몇 줄. 화면 밖으로 나가지 않게.
export function tooltip(ctx, x, y, lines, { title = null, titleCol = PAL.cardInk, w = 150, scale = 1 } = {}) {
  if (scale > 1) return bigTooltip(ctx, lines, { title, titleCol, w });
  const pad = 5;
  const h = pad * 2 + (title ? 14 : 0) + lines.length * 13;
  let tx = Math.min(480 - w - 2, Math.max(2, x));
  let ty = y;
  if (ty + h > 268) ty = 268 - h;
  if (ty < 2) ty = 2;
  box(ctx, tx, ty, w, h, PAL.card, PAL.frameDk);
  rect(ctx, tx + 1, ty + 1, w - 2, 1, PAL.cardHi);
  let yy = ty + pad;
  if (title) { text(ctx, title, tx + pad, yy, titleCol, { bold: true }); yy += 14; }
  for (const l of lines) {
    const [s, col] = Array.isArray(l) ? l : [l, PAL.cardDim];
    text(ctx, s, tx + pad, yy, col);
    yy += 13;
  }
  frame(ctx, tx, ty, w, h, PAL.frameDk);
}

// 큰 글자 설정: 말풍선을 두 배 글자로 화면 아래 가운데에
function bigTooltip(ctx, lines, { title, titleCol, w }) {
  const all = [];
  if (title) all.push([title, titleCol, true]);
  for (const l of lines) { const [s, col] = Array.isArray(l) ? l : [l, PAL.cardDim]; all.push([s, col, false]); }
  const bw = Math.min(472, Math.max(...all.map(([s, , b]) => measure(s, b))) * 2 + 16);
  const bh = all.length * 26 + 10;
  const x = Math.floor((480 - bw) / 2), y = 268 - bh;
  box(ctx, x, y, bw, bh, PAL.card, PAL.frameDk);
  all.forEach(([s, col, b], i) => text(ctx, s, x + 8, y + 5 + i * 26, col, { bold: b, scale: 2 }));
}
