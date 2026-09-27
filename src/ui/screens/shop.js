// 상점: 진열 2 + 꾸러미 2 + 다시 진열 + 나가기. 오른쪽 격언 칸(끌어서 순서 바꾸기 · 눌러 팔기), 두루마리 칸(눌러 쓰기),
// 아래 주머니(눌러 승급 · 버리기).
import { hint as coachHint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { wrap } from '../../render/text.js';
import { W, text, box, rect, frame, sprite, dots } from '../../render/gfx.js';
import { canBuy, sellPrice, canSell, maximCapacity, maximCount, engravingInfo } from '../../sim/run.js';
import { SHOP, PROMOTE, rerollCost } from '../../sim/shop.js';
import { CHARTS } from '../../data/charts.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { button } from '../ui.js';
import { maximColumn, itemCard, itemKeys, itemTip, itemEffect, effectHead, itemExtraTip, targetPanel, pieceCard, pieceTip, chartTip, tipLines, fragmentStrip, cornerTicks, envelope, tacticIcon, engravingEmblem, soulEmblem } from '../parts.js';
import { tierOf, ENG_EDGE } from '../../render/sprites.js';
import { familyCounts, FAMILY_BY_ID, setName } from '../../data/families.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { TACTIC_BY_ID, evolveTo } from '../../data/tactics.js';
const ENG_NAME = (id) => engravingInfo(id).name;
import { familyStrip, familyRises, josekiBadges } from '../parts-depth.js';
import { PACK_NAME, PIECE_NAME, PIECE_MOVE, PART_NAME, josa } from '../words.js';
import { topBar } from './common.js';

const RX = 360, RW = 112;
const CARD_W = 100, CARD_H = 116;

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
    ui.region(id, px, py, cw, ch, { onClick: pick ? () => pick(p) : null, tip: () => pieceTip(p) });
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

// 두루마리 한 칸: 왼쪽 그림(각인 = 재료, 혼 = 기운, 진화 = 자라는 화살, 기보 = 모습 윤곽), 오른쪽 이름
export function consumableCard(ctx, c, x, y, w, h, hover) {
  const edge = c.kind === 'engraving' ? ENG_EDGE[c.id] || PAL.gold : c.kind === 'soul' ? SOUL_BY_ID[c.id].col : null;
  box(ctx, x, y, w, h, c.kind === 'chart' ? '#e8dcc0' : PAL.card, hover ? PAL.gold : PAL.frameDk);
  if (edge) frame(ctx, x + 1, y + 1, w - 2, h - 2, edge);
  const ay = y + Math.floor((h - 18) / 2);
  rect(ctx, x + 2, ay, 18, 18, '#1b2b27');
  if (c.kind === 'engraving') engravingEmblem(ctx, c.id, x - 1, ay - 5, { sq: false });
  else if (c.kind === 'soul') soulEmblem(ctx, c.id, x - 1, ay - 4, 0, { sq: false });
  else if (c.kind === 'evolve') { rect(ctx, x + 5, ay + 11, 3, 3, PAL.ink); for (let i = 0; i < 4; i++) rect(ctx, x + 9 + i, ay + 10 - i, 1, 1, PAL.gold); rect(ctx, x + 12, ay + 4, 5, 6, PAL.gold); }
  else if (c.kind === 'tactic') tacticIcon(ctx, c.id, x + 3, ay + 4);
  else if (c.kind === 'chart') { dots(ctx, x + 2, ay, 18, 18, PAL.dim, 2); sprite(ctx, c.form, 'w', x + 3, ay - 3, { alpha: 0.9 }); }
  const name = c.kind === 'chart' ? `${PIECE_NAME[c.form]}` : c.kind === 'evolve' ? '진화' : c.kind === 'tactic' ? TACTIC_BY_ID[c.id].name : c.kind === 'soul' ? SOUL_BY_ID[c.id].name : engravingInfo(c.id).name;
  if (w < 80) { text(ctx, name, x + 21 + Math.floor((w - 21) / 2), y + Math.floor(h / 2) - 6, PAL.cardInk, { align: 'center', bold: true }); return; }
  // 넓은 칸: 이름 아래에 효과 앞머리 한 줄(다 못 적으면 「…」)
  text(ctx, name, x + 23, y + 2, PAL.cardInk, { bold: true });
  // 「 — 」 뒤의 덧붙임(대가 · 횟수)은 칸에서 뺀다
  const head = effectHead(itemEffect(c)), main = head.split(' — ')[0];
  const ls = wrap(main, w - 26);
  text(ctx, ls.length > 1 || main !== head ? `${ls[0].replace(/\s*[·—,]$/, '')}…` : ls[0] || '', x + 23, y + 14, PAL.cardDim);
}
// 진열 · 꾸러미 말풍선은 주머니 오른쪽 빈자리에(옆 카드를 가리지 않게)
const TIP_AT = { x: 196, y: 174 };
export const consumableTip = (c) => (c.kind === 'evolve' || c.kind === 'tactic' ? itemTip(c) : c.kind === 'chart' ? chartTip(c.form) : c.kind === 'soul' ? tipLines(`${SOUL_BY_ID[c.id].name}의 혼`, [SOUL_BY_ID[c.id].text, '기물 하나에 깃든다']) : tipLines(`${engravingInfo(c.id).name} 각인`, engravingInfo(c.id).text));

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
    for (const id of rises) { this.famFx[id] = this.app.time; this.app.toast(`${setName(id)} ${familyCounts(this.run)[id]}`, FAMILY_BY_ID[id].col); }
    this.app.sfx('fanfare');
  }
  // 기보로 한 단계 자라면 빛 기둥, 각인을 새기면 반짝
  fx(e) {
    if (e.type === 'gamble') {
      this.flash = { id: e.pieceId, t0: this.app.time };
      const what = e.to ? `${PIECE_NAME[e.from]} › ${PIECE_NAME[e.to]}` : e.soul ? `${PIECE_NAME[e.piece]} · ${SOUL_BY_ID[e.soul].name}의 혼` : `${PIECE_NAME[e.piece]} · ${ENG_NAME(e.eng)} 각인`;
      this.app.toast(what, PAL.gold, 2.2);
      this.app.sfx('sparkle');
    }
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
    text(ctx, '진열', 12, 28, PAL.dim);
    // 진열 카드는 효과를 적을 만큼 넓게(가리키지 않아도 읽힌다)
    shop.display.forEach((it, i) => {
      const x = 12 + i * 104, y = 40, id = `shop:buy:${i}`;
      const ok = canBuy(run, it);
      ui.region(id, x, y, CARD_W, CARD_H, { enabled: ok, onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), tip: () => itemExtraTip(it), tipAt: TIP_AT, keys: () => itemKeys(it), preview: true });
      itemCard(ctx, it, x, y, CARD_W, CARD_H, { hover: ui.isHover(id) && ok, sold: it.sold, t: ui.time + i, run, ui, under: { onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), enabled: ok } });
      if (!it.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, CARD_W, CARD_H, PAL.shadow); ctx.globalAlpha = 1; }
    });
    // 꾸러미
    text(ctx, '꾸러미', 222, 28, PAL.dim);
    shop.packs.forEach((pk, i) => {
      const x = 222 + i * 66, y = 40, id = `shop:pack:${i}`;
      const ok = !pk.sold && run.money >= pk.price;
      ui.region(id, x, y, 62, CARD_H, { enabled: ok, onClick: () => this.act({ type: 'buyPack', slot: i }, 'pack') });
      this.packCard(ctx, pk, x, y, 62, CARD_H, ui.isHover(id) && ok);
      if (!pk.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, 62, CARD_H, PAL.shadow); ctx.globalAlpha = 1; }
    });
    const rc = rerollCost(run);
    button(ctx, ui, 'shop:reroll', 12, 160, 204, 18, `다시 진열 $${rc}`, { enabled: run.money >= rc, onClick: () => this.act({ type: 'reroll' }, 'coin') });
    button(ctx, ui, 'shop:leave', 222, 160, 128, 18, '나가기', { onClick: () => this.leave(), tone: 'gold' });
    // 주머니
    text(ctx, `주머니 ${run.deck.length}`, 12, 184, PAL.dim);

    const since = (fx, d) => (fx && app.time - fx.t0 < d ? (app.time - fx.t0) / d : null);
    const fp = since(this.flash, 0.3), gp = since(this.grow, 0.5);
    bagRow(ctx, ui, run, 12, 198, 330, {
      pick: (p) => this.pickPiece(p), glow: !!this.target, selectedId: this.menu && this.menu.kind === 'piece' ? this.menu.id : this.target ? this.target.pieceId : null,
      flash: fp != null ? { id: this.flash.id, p: fp } : null, grow: gp != null ? { form: this.grow.form, p: gp } : null,
    });
    // 가족 띠(주머니 아래)
    familyStrip(ctx, ui, run, 12, 256, 330, { time: app.time, fx: this.famFx, max: 6 });
    // 오른쪽: 격언
    text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 32, PAL.dim);
    josekiBadges(ctx, ui, run, RX + 56, 33);
    fragmentStrip(ctx, ui, run, RX + RW, 32, { align: 'right' });
    const col = maximColumn(ctx, ui, run, RX, 46, RW, 146, {
      onClick: (i) => { this.menu = this.menu && this.menu.kind === 'maxim' && this.menu.index === i ? null : { kind: 'maxim', index: i }; this.target = null; },
      drag: (i, mx, my) => this.dropMaxim(i, my, col),
      hotIndex: this.menu && this.menu.kind === 'maxim' ? this.menu.index : -1,
    });
    this.col = col;
    // 두루마리
    // 칸마다 한 줄씩(두 칸): 이름 아래에 효과 앞머리가 보이게 오른쪽 판 너비를 다 쓴다. 칸이 셋 이상이면 두 줄 두 칸씩 좁게
    const wide = run.consumableSlots <= 2;
    text(ctx, '두루마리', RX, 197, PAL.dim);
    for (let i = 0; i < run.consumableSlots; i++) {
      const [x, y, cw, ch] = wide ? [RX, 210 + i * 30, RW, 28] : [RX + (i % 2) * 57, 216 + Math.floor(i / 2) * 26, 55, 24];
      const c = run.consumables[i];
      if (!c) { frame(ctx, x, y, cw, ch, PAL.feltHi); continue; }
      const id = `cons:${i}`;
      ui.region(id, x, y, cw, ch, { onClick: () => this.useConsumable(i), tip: () => consumableTip(c), keys: () => itemKeys(c) });
      consumableCard(ctx, c, x, y, cw, ch, ui.isHover(id) || (this.target && this.target.index === i));
    }
    this.drawMenu(ctx, ui);
    // 두루마리를 쓰는 중: 고른 기물이 어떻게 되는지 미리 보이고 확인을 받는다
    if (this.target && run.consumables[this.target.index]) {
      const c = run.consumables[this.target.index];
      const p = this.target.pieceId != null ? run.deck.find((x) => x.id === this.target.pieceId) : null;
      targetPanel(ctx, ui, run, c, p, 12, 156, 338, {
        to: p && c.kind === 'evolve' ? evolveTo(run.seed, p) : null,
        onConfirm: () => { const i = this.target.index, id = this.target.pieceId; this.target = null; this.act({ type: 'use', index: i, target: id }, 'engrave'); },
        onCancel: () => { this.target = null; },
      });
    }
    // 처음 안내(한 번에 하나, 앞의 것부터)
    if (!this.menu && !this.target) {
      coachHint(app, 'shop', 'shop:buy:0');
      if (run.consumables.length) coachHint(app, 'scroll', 'cons:0');
      const fam = ui.regions.find((r) => r.id.startsWith('fam:'));
      if (fam) coachHint(app, 'family', fam.id);
      if (run.maxims.length) coachHint(app, 'maximSell', 'maxim:0');
    }
  }

  packCard(ctx, pk, x, y, w, h, hover) {
    envelope(ctx, x, y + 12, w, h - 58, pk.kind, { hover });
    const name = PACK_NAME[pk.kind].split(' ');
    text(ctx, name[0], x + w / 2, y - 1, PAL.ink, { align: 'center', bold: true });
    // 봉투 속: 무엇 셋 중 하나
    const inside = { piece: '기물 셋 중 하나', chart: '기보 셋 중 하나', engraving: '각인 셋 중 하나', golden: '판본 격언 셋 중 하나' }[pk.kind] || '';
    if (!pk.sold) wrap(inside, w - 2).slice(0, 2).forEach((l, k) => text(ctx, l, x + w / 2, y + h - 44 + k * 12, PAL.dim, { align: 'center' }));
    if (pk.sold) {
      ctx.globalAlpha = 0.7; rect(ctx, x, y + 12, w, h - 30, PAL.feltDk); ctx.globalAlpha = 1;
      text(ctx, '열었다', x + w / 2, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
    } else text(ctx, pk.price ? `$${pk.price}` : '공짜', x + w / 2, y + h - 14, PAL.gold, { align: 'center', bold: true });
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
      if (!run.shop.removed) opts.push(['shop:remove', `빼기 $${SHOP.removePrice}`, run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin, () => this.act({ type: 'remove', pieceId: p.id }, 'discard')]);
      if (!opts.length) opts.push(['shop:none', '이번 상점에선 끝', false, null]);
      const w = 112, h = opts.length * 20 + 4;
      const x = Math.min(r.x, 340 - w), y = r.y - h - 2;
      box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
      opts.forEach(([id, label, ok, fn], k) => button(ctx, ui, id, x + 2, y + 2 + k * 20, w - 4, 18, label, { enabled: ok, onClick: () => { this.menu = null; if (fn) fn(); } }));
    }
  }

  pickPiece(p) {
    if (this.target) {
      // 고르면 미리 보기, 확인 단추로 쓴다
      const c = this.run.consumables[this.target.index];
      if (c && c.kind === 'evolve' && !evolveTo(this.run.seed, p)) { this.app.toast('이 기물은 자랄 곳이 없다', PAL.dim); return; }
      this.target = { ...this.target, pieceId: this.target.pieceId === p.id ? null : p.id };
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
