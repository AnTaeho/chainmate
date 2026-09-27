// 상점: 진열 2 + 꾸러미 2 + 다시 진열 + 나가기. 오른쪽 격언 칸(끌어서 순서 바꾸기 · 눌러 팔기), 두루마리 칸(눌러 쓰기),
// 아래 주머니(눌러 승급 · 버리기).
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, frame, sprite } from '../../render/gfx.js';
import { canBuy, sellPrice, canSell, maximCapacity, maximCount, engravingInfo } from '../../sim/run.js';
import { SHOP, PROMOTE, rerollCost } from '../../sim/shop.js';
import { CHARTS } from '../../data/charts.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { button } from '../ui.js';
import { maximColumn, itemCard, itemTip, pieceCard, pieceTip, chartTip, tipLines, fragmentStrip, cornerTicks, envelope, tacticIcon } from '../parts.js';
import { tierOf, ENG_EDGE } from '../../render/sprites.js';
import { familyCounts, FAMILY_BY_ID } from '../../data/families.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { TACTIC_BY_ID } from '../../data/tactics.js';
import { familyStrip, familyRises, josekiBadges } from '../parts-depth.js';
import { PACK_NAME, PIECE_NAME, PIECE_MOVE, PART_NAME, josa } from '../words.js';
import { topBar } from './common.js';

const RX = 360, RW = 112;

// 주머니 줄: 작은 기물 카드들. pick(p)이 있으면 누를 수 있다.
// flash: { id, p } 각인을 막 새긴 기물(0.3초 반짝) · grow: { form, p } 기보로 자라는 모습(0.5초 빛 기둥)
export function bagRow(ctx, ui, run, x, y, w, { pick = null, glow = false, selectedId = null, idPrefix = 'deck', flash = null, grow = null } = {}) {
  const n = run.deck.length;
  const cw = 20, ch = 28;
  const per = Math.max(1, Math.floor((w + 3) / (cw + 3)));
  const rows = Math.ceil(n / per);
  const step = rows > 2 ? 16 : ch + 3;
  run.deck.forEach((p, i) => {
    const col = i % per, row = Math.floor(i / per);
    const px = x + col * (cw + 3), py = y + row * step;
    const id = `${idPrefix}:${p.id}`;
    ui.region(id, px, py, cw, ch, { onClick: pick ? () => pick(p) : null, tip: p.eng || PIECE_MOVE[p.t] ? () => pieceTip(p) : null });
    const hov = ui.isHover(id);
    const fl = flash && flash.id === p.id ? 1 - flash.p : 0;
    pieceCard(ctx, p, px, py, cw, ch, { lift: hov && pick ? 1 : 0, selected: selectedId === p.id, hover: hov, tier: tierOf(run.charts[p.t]), time: ui.time + i, flash: fl });
    if (grow && grow.form === p.t) growPillar(ctx, px, py, cw, ch, grow.p);
    if (glow && pick) { const a = 0.4 + 0.3 * Math.sin(ui.time * 6); ctx.globalAlpha = a; frame(ctx, px - 1, py - 1, cw + 2, ch + 2, PAL.gold); ctx.globalAlpha = 1; }
  });
}

// 기보로 자라는 순간: 기물 위로 빛 기둥이 솟고 반짝임이 흩어진다
export function growPillar(ctx, x, y, w, h, p) {
  const a = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
  const cx = x + Math.floor(w / 2);
  const top = y - Math.round(18 * Math.min(1, p * 2.5));
  ctx.globalAlpha = 0.55 * a; rect(ctx, cx - 4, top, 8, y + h - top, PAL.goldHi);
  ctx.globalAlpha = 0.9 * a; rect(ctx, cx - 1, top - 2, 2, y + h - top + 2, PAL.white);
  ctx.globalAlpha = a;
  for (let k = 0; k < 6; k++) {
    const ang = k * 1.05 + p * 3, r = 4 + p * 14;
    rect(ctx, Math.round(cx + Math.cos(ang) * r), Math.round(y + h / 2 + Math.sin(ang) * r * 0.8), 1, 1, PAL.goldHi);
  }
  ctx.globalAlpha = 1;
}

// 두루마리 한 칸
export function consumableCard(ctx, c, x, y, w, h, hover) {
  if (c.kind === 'chart') {
    box(ctx, x, y, w, h, '#e8dcc0', hover ? PAL.gold : PAL.frameDk);
    sprite(ctx, c.form, 'b', x + 3, y + Math.floor((h - 22) / 2)); text(ctx, '기보', x + 22, y + Math.floor(h / 2) - 6, PAL.cardInk, { bold: true });
    return;
  }
  if (c.kind === 'evolve' || c.kind === 'tactic') {
    box(ctx, x, y, w, h, PAL.card, hover ? PAL.gold : PAL.frameDk);
    if (c.kind === 'evolve') sprite(ctx, 'N', 'w', x + 3, y + Math.floor((h - 22) / 2), { tier: 3 });
    else tacticIcon(ctx, c.id, x + 3, y + Math.floor((h - 11) / 2));
    text(ctx, c.kind === 'evolve' ? '진화' : TACTIC_BY_ID[c.id].name, x + 20 + Math.floor((w - 20) / 2), y + Math.floor(h / 2) - 6, PAL.cardInk, { align: 'center', bold: true });
    return;
  }
  if (c.kind === 'soul') {
    const s = SOUL_BY_ID[c.id];
    box(ctx, x, y, w, h, PAL.card, hover ? PAL.gold : PAL.frameDk);
    frame(ctx, x + 1, y + 1, w - 2, h - 2, s.col);
    sprite(ctx, 'N', 'w', x + 3, y + Math.floor((h - 22) / 2), { soul: c.id });
    text(ctx, s.name, x + 20 + Math.floor((w - 20) / 2), y + Math.floor(h / 2) - 6, PAL.cardInk, { align: 'center', bold: true });
    return;
  }
  const col = ENG_EDGE[c.id] || PAL.gold;
  box(ctx, x, y, w, h, PAL.card, hover ? PAL.gold : PAL.frameDk);
  frame(ctx, x + 1, y + 1, w - 2, h - 2, col);
  cornerTicks(ctx, x + 2, y + 2, w - 4, h - 4, col);
  sprite(ctx, 'N', 'w', x + 3, y + Math.floor((h - 22) / 2), { eng: c.id });
  text(ctx, engravingInfo(c.id).name, x + 20 + Math.floor((w - 20) / 2), y + Math.floor(h / 2) - 6, PAL.cardInk, { align: 'center', bold: true });
}
// 진열 · 꾸러미 말풍선은 주머니 오른쪽 빈자리에(옆 카드를 가리지 않게)
const TIP_AT = { x: 196, y: 174 };
export const consumableTip = (c) => (c.kind === 'evolve' || c.kind === 'tactic' ? itemTip(c) : c.kind === 'chart' ? chartTip(c.form) : c.kind === 'soul' ? tipLines(`${SOUL_BY_ID[c.id].name}의 혼`, [SOUL_BY_ID[c.id].text, '주머니의 기물 하나에 깃든다']) : tipLines(`${engravingInfo(c.id).name} 각인`, engravingInfo(c.id).text));

export class ShopScreen {
  constructor(app) {
    this.app = app;
    this.menu = null;      // { kind: 'maxim', index } | { kind: 'piece', id }
    this.target = null;    // 각인 두루마리를 쓸 대상 고르기 { index }
    const fx = app.shopFx || [];
    app.shopFx = null;
    for (const e of fx) this.fx(e);
    if (app.shopFamBefore) { this.noteFamilies(app.shopFamBefore); app.shopFamBefore = null; }
  }
  // 가족 문턱을 막 넘었으면 그 칩이 빛나며 커지고 한 번 울린다
  noteFamilies(before) {
    const rises = familyRises(before, familyCounts(this.run));
    if (!rises.length) return;
    this.famFx = this.famFx || {};
    for (const id of rises) { this.famFx[id] = this.app.time; this.app.toast(`${FAMILY_BY_ID[id].name} ${familyCounts(this.run)[id]}`, FAMILY_BY_ID[id].col); }
    this.app.sfx('fanfare');
  }
  // 기보로 한 단계 자라면 빛 기둥, 각인을 새기면 반짝
  fx(e) {
    if (e.type === 'evolve') { this.grow = { form: e.to, t0: this.app.time }; this.app.sfx('grow'); }
    if (e.type === 'chart' && tierOf(e.level) > tierOf(e.level - 1)) { this.grow = { form: e.form, t0: this.app.time }; this.app.sfx('grow'); }
    if (e.type === 'engrave' || e.type === 'ensoul') this.flash = { id: e.pieceId, t0: this.app.time };
  }
  get run() { return this.app.run; }

  act(cmd, sound = 'click') {
    let ev;
    const before = familyCounts(this.run);
    try { ev = this.app.cmd(cmd); } catch (e) { this.app.toast('할 수 없다', PAL.red); return null; }
    this.noteFamilies(before);
    this.app.sfx(sound);
    for (const e of ev) {
      if (e.type === 'fragment') {
        this.app.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6);
        this.app.sfx('fragment');
        const r = this.app.ui.hover;
        this.app.flyShard(r ? r.x + r.w / 2 : 240, r ? r.y + r.h / 2 : 100, RX + RW - 8, 34);
      }
      if (e.type === 'legend') { this.app.flow([['legend', { legend: e.legend, back: 'shop' }]]); return ev; }
      if (e.type === 'chart') {
        this.app.toast(`${CHARTS[e.form].name} ${e.level}`, PAL.gold);
      }
      this.fx(e);
    }
    if (this.run.phase === 'pack') this.app.go('pack', { events: ev });
    else if (this.run.phase !== 'shop') this.app.goPhase();
    return ev;
  }

  draw(ctx, ui) {
    const app = this.app, run = this.run, shop = run.shop;
    topBar(ctx, ui, app, '상점');
    text(ctx, `${run.ante}관`, 60, 8, PAL.dim);
    // 진열
    text(ctx, '진열', 12, 32, PAL.dim);
    shop.display.forEach((it, i) => {
      const x = 12 + i * 74, y = 46, id = `shop:buy:${i}`;
      const ok = canBuy(run, it);
      ui.region(id, x, y, 68, 96, { enabled: ok, onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), tip: () => itemTip(it), tipAt: TIP_AT });
      itemCard(ctx, it, x, y, 68, 96, { hover: ui.isHover(id) && ok, sold: it.sold, t: ui.time + i, run });
      if (!it.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, 68, 96, PAL.shadow); ctx.globalAlpha = 1; }
    });
    // 꾸러미
    text(ctx, '꾸러미', 170, 32, PAL.dim);
    shop.packs.forEach((pk, i) => {
      const x = 170 + i * 74, y = 46, id = `shop:pack:${i}`;
      const ok = !pk.sold && run.money >= pk.price;
      ui.region(id, x, y, 68, 96, { enabled: ok, onClick: () => this.act({ type: 'buyPack', slot: i }, 'pack'), tip: () => tipLines(PACK_NAME[pk.kind], pk.kind === 'golden' ? '판본이 붙은 격언 셋 중 하나' : '셋 중 하나를 고른다'), tipAt: TIP_AT });
      this.packCard(ctx, pk, x, y, 68, 96, ui.isHover(id) && ok);
      if (!pk.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, 68, 96, PAL.shadow); ctx.globalAlpha = 1; }
    });
    const rc = rerollCost(run);
    button(ctx, ui, 'shop:reroll', 12, 150, 142, 18, `다시 진열 $${rc}`, { enabled: run.money >= rc, onClick: () => this.act({ type: 'reroll' }, 'coin') });
    button(ctx, ui, 'shop:leave', 244, 150, 68, 18, '나가기', { onClick: () => this.leave(), tone: 'gold' });
    // 주머니
    text(ctx, `주머니 ${run.deck.length}`, 12, 178, PAL.dim);
    const tk = this.target && run.consumables[this.target.index] ? run.consumables[this.target.index].kind : null;
    const hint = tk ? (tk === 'soul' ? '깃들 기물' : tk === 'evolve' ? '자랄 기물' : '새길 기물') : null;
    if (hint) text(ctx, hint, 100, 178, PAL.gold, { bold: true });
    const since = (fx, d) => (fx && app.time - fx.t0 < d ? (app.time - fx.t0) / d : null);
    const fp = since(this.flash, 0.3), gp = since(this.grow, 0.5);
    bagRow(ctx, ui, run, 12, 194, 330, {
      pick: (p) => this.pickPiece(p), glow: !!this.target, selectedId: this.menu && this.menu.kind === 'piece' ? this.menu.id : null,
      flash: fp != null ? { id: this.flash.id, p: fp } : null, grow: gp != null ? { form: this.grow.form, p: gp } : null,
    });
    // 가족 띠(주머니 아래)
    familyStrip(ctx, ui, run, 12, 254, 330, { time: app.time, fx: this.famFx, max: 6 });
    // 오른쪽: 격언
    text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 32, PAL.dim);
    josekiBadges(ctx, ui, run, RX + 56, 33);
    fragmentStrip(ctx, ui, run, RX + RW, 32, { align: 'right' });
    const col = maximColumn(ctx, ui, run, RX, 46, RW, 150, {
      onClick: (i) => { this.menu = this.menu && this.menu.kind === 'maxim' && this.menu.index === i ? null : { kind: 'maxim', index: i }; this.target = null; },
      drag: (i, mx, my) => this.dropMaxim(i, my, col),
      hotIndex: this.menu && this.menu.kind === 'maxim' ? this.menu.index : -1,
    });
    this.col = col;
    // 두루마리
    text(ctx, '두루마리', RX, 204, PAL.dim);
    for (let i = 0; i < run.consumableSlots; i++) {
      const x = RX + i * 57, y = 218, c = run.consumables[i];
      if (!c) { frame(ctx, x, y, 54, 28, PAL.feltHi); continue; }
      const id = `cons:${i}`;
      ui.region(id, x, y, 54, 28, { onClick: () => this.useConsumable(i), tip: () => consumableTip(c) });
      consumableCard(ctx, c, x, y, 54, 28, ui.isHover(id) || (this.target && this.target.index === i));
    }
    this.drawMenu(ctx, ui);
  }

  packCard(ctx, pk, x, y, w, h, hover) {
    envelope(ctx, x, y + 12, w, h - 30, pk.kind, { hover });
    const name = PACK_NAME[pk.kind].split(' ');
    text(ctx, name[0], x + w / 2, y - 1, PAL.ink, { align: 'center', bold: true });
    if (pk.sold) {
      ctx.globalAlpha = 0.7; rect(ctx, x, y + 12, w, h - 30, PAL.feltDk); ctx.globalAlpha = 1;
      text(ctx, '열었다', x + w / 2, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
    } else text(ctx, pk.price ? `$${pk.price}` : '공짜', x + w / 2, y + h - 15, PAL.gold, { align: 'center', bold: true });
  }

  drawMenu(ctx, ui) {
    const run = this.run, m = this.menu;
    if (!m) return;
    if (m.kind === 'maxim') {
      const mx = run.maxims[m.index];
      const spot = this.col && this.col.spots.find((s) => s.i === m.index);
      if (!mx || !spot) { this.menu = null; return; }
      const y = spot.y + Math.floor(spot.h / 2) - 9;
      if (canSell(mx)) button(ctx, ui, 'shop:sell', RX - 70, y, 66, 18, `팔기 $${sellPrice(mx)}`, { onClick: () => { this.menu = null; this.act({ type: 'sell', index: m.index }, 'coin'); }, tone: 'red' });
    } else if (m.kind === 'piece') {
      const p = run.deck.find((x) => x.id === m.id);
      const r = ui.last.find((x) => x.id === `deck:${m.id}`) || ui.regions.find((x) => x.id === `deck:${m.id}`);
      if (!p || !r) { this.menu = null; return; }
      const opts = [];
      if (!run.shop.promoted) for (const to of PROMOTE[p.t] || []) opts.push([`shop:promote:${to}`, `${josa(PIECE_NAME[to], '으로/로')} 승급 $${SHOP.promotePrice}`, run.money >= SHOP.promotePrice, () => this.act({ type: 'promote', pieceId: p.id, to }, 'promote')]);
      if (!run.shop.removed) opts.push(['shop:remove', `버리기 $${SHOP.removePrice}`, run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin, () => this.act({ type: 'remove', pieceId: p.id }, 'discard')]);
      if (!opts.length) opts.push(['shop:none', '이번 상점에선 끝', false, null]);
      const w = 112, h = opts.length * 20 + 4;
      const x = Math.min(r.x, 340 - w), y = r.y - h - 2;
      box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
      opts.forEach(([id, label, ok, fn], k) => button(ctx, ui, id, x + 2, y + 2 + k * 20, w - 4, 18, label, { enabled: ok, onClick: () => { this.menu = null; if (fn) fn(); } }));
    }
  }

  pickPiece(p) {
    if (this.target) {
      const i = this.target.index;
      this.target = null;
      this.act({ type: 'use', index: i, target: p.id }, 'engrave');
      return;
    }
    this.menu = this.menu && this.menu.kind === 'piece' && this.menu.id === p.id ? null : { kind: 'piece', id: p.id };
  }

  useConsumable(i) {
    const c = this.run.consumables[i];
    if (!c) return;
    this.menu = null;
    if (c.kind === 'engraving' || c.kind === 'soul' || c.kind === 'evolve') { this.target = this.target && this.target.index === i ? null : { index: i }; return; }
    if (c.kind === 'tactic') { this.app.toast('대국 중에 쓴다', PAL.dim); return; }
    this.act({ type: 'use', index: i }, 'chart');
  }

  dropMaxim(from, my, col) {
    if (!col) return;
    let to = col.spots.findIndex((s) => my < s.y + s.h / 2);
    if (to < 0) to = this.run.maxims.length - 1;
    to = Math.min(to, this.run.maxims.length - 1);
    if (to === from) return;
    // 전설은 늘 오른쪽 끝(아래)에 남긴다
    const legendAt = this.run.maxims.findIndex((m) => m.legendary);
    if (this.run.maxims[from].legendary) return;
    if (legendAt >= 0 && to >= legendAt) to = legendAt - (from < legendAt ? 1 : 0);
    if (to === from || to < 0) return;
    this.menu = null;
    this.act({ type: 'moveMaxim', from, to }, 'pick');
  }

  leave() { this.menu = null; this.target = null; this.act({ type: 'leave' }, 'click'); }

  key(k) {
    if (k === 'Escape') {
      if (this.menu || this.target) { this.menu = null; this.target = null; return; }
      this.app.openOverlay('pause');
    } else if (k === 'Enter') this.leave();
  }
}
