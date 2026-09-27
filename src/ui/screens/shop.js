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
import { fitText, cardBase, maximColumn, itemCard, itemKeys, itemTip, itemEffect, effectHead, itemExtraTip, targetPanel, pieceCard, pieceTip, chartTip, tipLines, fragmentStrip, cornerTicks, envelope, tacticIcon, engravingEmblem, soulEmblem } from '../parts.js';
import { tierOf, ENG_EDGE } from '../../render/sprites.js';
import { familyCounts, FAMILY_BY_ID, setName } from '../../data/families.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { TACTIC_BY_ID, evolveTo } from '../../data/tactics.js';
const ENG_NAME = (id) => engravingInfo(id).name;
import { familyStrip, familyRises, josekiBadges } from '../parts-depth.js';
import { PACK_NAME, PIECE_NAME, PIECE_MOVE, PART_NAME, josa } from '../words.js';
import { runSide, pauseButton } from './common.js';
import { RIGHT, CENTER, CARD, TOP, BTN_H, SHARD_TO } from '../frame.js';

const RX = RIGHT.x, RW = RIGHT.w;
// 가운데 칸: 진열(22 ~ 138) · 꾸러미(142 ~ 184) · 단추(188) · 주머니(210 ~ 268). 오른쪽 칸: 격언(22 ~ 178) · 두루마리(198 ~)
const CARD_W = CARD.w, CARD_H = 116, PACK_Y = 142, PACK_H = 42, BTN_Y = 188, BAG_Y = 210, MAXIM_H = 156, SCROLL_Y = 198;

// 주머니 줄: 작은 기물 카드들. pick(p)이 있으면 누를 수 있다.
// flash: { id, p } 각인을 막 새긴 기물(0.3초 반짝) · grow: { form, p } 기보로 자라는 모습(0.5초 빛 기둥)
// bottom: 줄이 여럿이면 이 아래로 넘지 않게 줄 간격을 줄인다(카드가 겹쳐 쌓인다)
export function bagRow(ctx, ui, run, x, y, w, { pick = null, glow = false, selectedId = null, idPrefix = 'deck', flash = null, grow = null, bottom = 268 } = {}) {
  const n = run.deck.length;
  const cw = 20, ch = 28;
  const per = Math.max(1, Math.floor((w + 3) / (cw + 3)));
  const rows = Math.ceil(n / per);
  const step = rows > 1 ? Math.min(ch + 3, Math.floor((bottom - y - ch) / (rows - 1))) : ch + 3;
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
  cardBase(ctx, x, y, w, h, { fill: c.kind === 'chart' ? '#e8dcc0' : PAL.card, hover, edge });
  // 좁은 칸(셋 이상): 그림은 위 가운데, 이름은 그 아래 칸 폭 전부(영어 이름이 그림 옆 32px에 들어가지 않았다)
  const narrow = w < 80;
  const ax = narrow ? x + Math.floor((w - 18) / 2) - 2 : x;
  const ay = narrow ? y + 1 : y + Math.floor((h - 18) / 2);
  rect(ctx, ax + 2, ay, 18, 18, '#1b2b27');
  if (c.kind === 'engraving') engravingEmblem(ctx, c.id, ax - 1, ay - 5, { sq: false });
  else if (c.kind === 'soul') soulEmblem(ctx, c.id, ax - 1, ay - 4, 0, { sq: false });
  else if (c.kind === 'evolve') { rect(ctx, ax + 5, ay + 11, 3, 3, PAL.ink); for (let i = 0; i < 4; i++) rect(ctx, ax + 9 + i, ay + 10 - i, 1, 1, PAL.gold); rect(ctx, ax + 12, ay + 4, 5, 6, PAL.gold); }
  else if (c.kind === 'tactic') tacticIcon(ctx, c.id, ax + 3, ay + 4);
  else if (c.kind === 'chart') { dots(ctx, ax + 2, ay, 18, 18, PAL.dim, 2); sprite(ctx, c.form, 'w', ax + 3, ay - 3, { alpha: 0.9 }); }
  const name = c.kind === 'chart' ? `${PIECE_NAME[c.form]}` : c.kind === 'evolve' ? '진화' : c.kind === 'tactic' ? TACTIC_BY_ID[c.id].name : c.kind === 'soul' ? SOUL_BY_ID[c.id].name : engravingInfo(c.id).name;
  if (narrow) { fitText(ctx, name, x + Math.floor(w / 2), y + h - 13, w - 4, PAL.cardInk, { align: 'center' }); return; }
  // 넓은 칸: 이름 아래에 효과 앞머리 한 줄(다 못 적으면 「…」)
  text(ctx, name, x + 23, y + 2, PAL.cardInk, { bold: true });
  // 「 — 」 뒤의 덧붙임(대가 · 횟수)은 칸에서 뺀다
  const head = effectHead(itemEffect(c)), main = head.split(' — ')[0];
  const ls = wrap(main, w - 26);
  text(ctx, ls.length > 1 || main !== head ? `${ls[0].replace(/\s*[·—,]$/, '')}…` : ls[0] || '', x + 23, y + 14, PAL.cardDim);
}
export const consumableTip = (c) => (c.kind === 'evolve' || c.kind === 'tactic' ? itemTip(c) : c.kind === 'chart' ? chartTip(c.form) : c.kind === 'soul' ? tipLines(`${SOUL_BY_ID[c.id].name}의 혼`, [SOUL_BY_ID[c.id].text, SOUL_BY_ID[c.id].more, '기물 하나에 깃든다']) : tipLines(`${engravingInfo(c.id).name} 각인`, engravingInfo(c.id).text));

export class ShopScreen {
  constructor(app) {
    this.app = app;
    this.menu = null;      // { kind: 'maxim', index } | { kind: 'piece', id }
    this.target = null;    // 각인 두루마리를 쓸 대상 고르기 { index }
    this.notes = 'side';   // 설명 자리: 왼쪽 칸(placement.js)
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
        this.app.flyShard(r ? r.x + r.w / 2 : 240, r ? r.y + r.h / 2 : 100, SHARD_TO.x, SHARD_TO.y);
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

  // 판 틀(docs/design-notes/layout.md): 왼쪽 칸(상점 · 시너지 · 정석 · 상금 · 주머니 수 — 설명 자리),
  // 가운데(진열 둘 · 꾸러미 둘 · 다시 진열 · 나가기 · 주머니), 오른쪽 칸(격언 · 두루마리)
  draw(ctx, ui) {
    const app = this.app, run = this.run, shop = run.shop;
    runSide(ctx, ui, app, '상점');
    pauseButton(ctx, ui, app);
    const CX = CENTER.x;
    text(ctx, '진열', CX, 8, PAL.dim);
    // 진열 카드는 효과를 적을 만큼 넓게(가리키지 않아도 읽힌다)
    shop.display.forEach((it, i) => {
      const x = CX + i * (CARD_W + 8), y = TOP, id = `shop:buy:${i}`;
      const ok = canBuy(run, it);
      ui.region(id, x, y, CARD_W, CARD_H, { enabled: ok, onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), tip: () => itemExtraTip(it), keys: () => itemKeys(it), preview: true });
      itemCard(ctx, it, x, y, CARD_W, CARD_H, { hover: ui.isHover(id) && ok, sold: it.sold, t: ui.time + i, run, ui, under: { onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), enabled: ok } });
      if (!it.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, CARD_W, CARD_H, PAL.shadow); ctx.globalAlpha = 1; }
    });
    // 꾸러미: 진열 아래 가로 칸 둘
    shop.packs.forEach((pk, i) => {
      const x = CX + i * (CARD_W + 8), y = PACK_Y, id = `shop:pack:${i}`;
      const ok = !pk.sold && run.money >= pk.price;
      ui.region(id, x, y, CARD_W, PACK_H, { enabled: ok, onClick: () => this.act({ type: 'buyPack', slot: i }, 'pack') });
      this.packCard(ctx, pk, x, y, CARD_W, PACK_H, ui.isHover(id) && ok);
      if (!pk.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, CARD_W, PACK_H, PAL.shadow); ctx.globalAlpha = 1; }
    });
    const rc = rerollCost(run);
    button(ctx, ui, 'shop:reroll', CX, BTN_Y, CARD_W, BTN_H, `다시 진열 $${rc}`, { enabled: run.money >= rc, onClick: () => this.act({ type: 'reroll' }, 'coin') });
    button(ctx, ui, 'shop:leave', CX + CARD_W + 8, BTN_Y, CARD_W, BTN_H, '나가기', { onClick: () => this.leave(), tone: 'gold' });
    // 주머니(가운데 아래). 수는 왼쪽 칸 「주머니」
    const since = (fx, d) => (fx && app.time - fx.t0 < d ? (app.time - fx.t0) / d : null);
    const fp = since(this.flash, 0.3), gp = since(this.grow, 0.5);
    bagRow(ctx, ui, run, CX, BAG_Y, CENTER.w, {
      pick: (p) => this.pickPiece(p), glow: !!this.target, selectedId: this.menu && this.menu.kind === 'piece' ? this.menu.id : this.target ? this.target.pieceId : null,
      flash: fp != null ? { id: this.flash.id, p: fp } : null, grow: gp != null ? { form: this.grow.form, p: gp } : null, bottom: 268,
    });
    // 오른쪽 칸: 격언
    text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 8, PAL.dim);
    const col = maximColumn(ctx, ui, run, RX, TOP, RW, MAXIM_H, {
      onClick: (i) => { this.menu = this.menu && this.menu.kind === 'maxim' && this.menu.index === i ? null : { kind: 'maxim', index: i }; this.target = null; },
      drag: (i, mx, my) => this.dropMaxim(i, my, col),
      hotIndex: this.menu && this.menu.kind === 'maxim' ? this.menu.index : -1,
    });
    this.col = col;
    // 두루마리: 두 칸이면 한 줄에 하나(이름 아래 효과 앞머리), 셋 이상이면 두 칸씩
    const wide = run.consumableSlots <= 2;
    text(ctx, '두루마리', RX, SCROLL_Y - 14, PAL.dim);
    for (let i = 0; i < run.consumableSlots; i++) {
      const [x, y, cw, ch] = wide ? [RX, SCROLL_Y + i * 32, RW, 28] : [RX + (i % 2) * 57, SCROLL_Y + Math.floor(i / 2) * 34, 55, 32];
      const c = run.consumables[i];
      if (!c) { frame(ctx, x, y, cw, ch, PAL.feltHi); continue; }
      const id = `cons:${i}`;
      ui.region(id, x, y, cw, ch, { onClick: () => this.useConsumable(i), tip: () => consumableTip(c), keys: () => itemKeys(c) });
      consumableCard(ctx, c, x, y, cw, ch, ui.isHover(id) || (this.target && this.target.index === i));
    }
    this.drawMenu(ctx, ui);
    // 두루마리를 쓰는 중: 고른 기물이 어떻게 되는지 미리 보이고 확인을 받는다(꾸러미 줄 자리)
    if (this.target && run.consumables[this.target.index]) {
      const c = run.consumables[this.target.index];
      const p = this.target.pieceId != null ? run.deck.find((x) => x.id === this.target.pieceId) : null;
      targetPanel(ctx, ui, run, c, p, CX, PACK_Y, CENTER.w, {
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

  // 꾸러미 칸(가로): 왼쪽 봉투와 그 아래 값, 오른쪽 이름(앞 낱말) · 봉투 속 「무엇 셋 중 하나」
  packCard(ctx, pk, x, y, w, h, hover) {
    box(ctx, x, y, w, h, PAL.feltDk, hover ? PAL.gold : PAL.frameDk);
    envelope(ctx, x + 4, y + 4, 30, 22, pk.kind, { hover });
    const tx = x + 38, tw = w - 42;
    fitText(ctx, PACK_NAME[pk.kind].split(' ')[0], tx, y + 3, tw, PAL.ink);
    const inside = { piece: '기물 셋 중 하나', chart: '기보 셋 중 하나', engraving: '각인 셋 중 하나', golden: '판본 격언 셋 중 하나' }[pk.kind] || '';
    if (pk.sold) {
      ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
      text(ctx, '열었다', x + w / 2, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
      return;
    }
    text(ctx, pk.price ? `$${pk.price}` : '공짜', x + 19, y + h - 15, PAL.gold, { align: 'center', bold: true });
    wrap(inside, tw).slice(0, 2).forEach((l, k) => text(ctx, l, tx, y + 16 + k * 12, PAL.dim));
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
      const x = Math.min(r.x, CENTER.x + CENTER.w - w), y = r.y - h - 2;
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
