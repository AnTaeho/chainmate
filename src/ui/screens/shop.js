// 상점: 진열 2 + 꾸러미 2 + 다시 진열 + 다음 대국. 오른쪽 격언 칸(끌어서 순서 바꾸기 · 눌러 팔기), 두루마리 칸(눌러 쓰기),
// 아래 주머니(눌러 승급 · 버리기).
import { hint as coachHint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { wrap } from '../../render/text.js';
import { W, text, box, rect, frame, sprite, dots, measure } from '../../render/gfx.js';
import { canBuy, sellPrice, canSell, maximCapacity, maximCount, engravingInfo } from '../../sim/run.js';
import { SHOP, PROMOTE, rerollCost } from '../../sim/shop.js';
import { CHARTS } from '../../data/charts.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { button } from '../ui.js';
import { fitText, cardBase, maximColumn, maximColumnH, itemCard, itemRowH, itemKeys, itemTip, itemEffect, effectHead, itemExtraTip, targetPanel, pieceCard, pieceTip, chartTip, tipLines, fragmentStrip, cornerTicks, envelope, tacticIcon, engravingEmblem, soulEmblem, chartLevel, SEAL, targetOk } from '../parts.js';
import { chartForm } from '../../data/pieces.js';
import { tierOf, ENG_EDGE } from '../../render/sprites.js';
import { familyCounts, FAMILY_BY_ID, setName } from '../../data/families.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { TACTIC_BY_ID, evolveTo } from '../../data/tactics.js';
const ENG_NAME = (id) => engravingInfo(id).name;
import { familyStrip, familyRises, josekiBadges } from '../parts-depth.js';
import { PACK_NAME, PIECE_NAME, PIECE_MOVE, PART_NAME, josa } from '../words.js';
import { runSide, pauseButton, shardTo } from './common.js';
import { RIGHT, CENTER, CARD, TOP, PAD_CARD, LINE, GAP_IN, GAP_GROUP, LIST_GAP, flow, textY, rowBoxH } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const RX = RIGHT.x, RW = RIGHT.w;
// 판 틀(docs/design-notes/layout.md 「상점」): 가운데 칸 위 띠에 「진열」 이름표 · 다시 진열 · 다음 대국, 그 아래로 진열 카드 줄(hug) →
// 꾸러미 줄(hug) → 주머니(남는 높이). 오른쪽 칸은 격언 칸 → 두루마리(아래에서부터). 묶음 사이 GAP_GROUP
const CARD_W = CARD.w, BAR_Y = 3, BAR_H = 16, BOTTOM = 270 - 2, BAG_MIN = 28;

// 주머니 줄: 작은 기물 카드들. pick(p)이 있으면 누를 수 있다.
// flash: { id, p } 각인을 막 새긴 기물(0.3초 반짝)
// grow: { form, p, big, from, to, exact } 기보로 자라는 모습 — 그 모습(이형은 바탕 모습)의 기물마다 옛 톤 · 옛 수준에서 반짝이며 새 톤 · 새 수준으로,
//   단계가 바뀌면(big) 빛 기둥까지. exact: 그 종류만(진화)
// can(p): 고를 수 있는 기물인가(아니면 흐리고 눌리지 않는다 — 같은 각인 · 혼이 이미 있는 기물)
// bottom: 줄이 여럿이면 이 아래로 넘지 않게 줄 간격을 줄인다(카드가 겹쳐 쌓인다)
export function bagRow(ctx, ui, run, x, y, w, { pick = null, glow = false, selectedId = null, idPrefix = 'deck', flash = null, grow = null, can = null, bottom = 268 } = {}) {
  const n = run.deck.length;
  const cw = 20, ch = 28;
  const per = Math.max(1, Math.floor((w + 3) / (cw + 3)));
  const rows = Math.ceil(n / per);
  const step = rows > 1 ? Math.max(4, Math.min(ch + 3, Math.floor((bottom - y - ch) / (rows - 1)))) : ch + 3;
  // 줄 자리를 기록기에 남긴다(글은 없다 — 화면 밖 · 다른 칸과 겹침만 잰다)
  openBox('tile', x, y, w, (rows - 1) * step + ch, 0, { name: '주머니 줄' });
  closeBox();
  run.deck.forEach((p, i) => {
    const col = i % per, row = Math.floor(i / per);
    const px = x + col * (cw + 3), py = y + row * step;
    const id = `${idPrefix}:${p.id}`;
    const ok = !can || can(p);
    ui.region(id, px, py, cw, ch, { onClick: pick && ok ? () => pick(p) : null, tip: () => pieceTip(p) });
    const hov = ui.isHover(id);
    let fl = flash && flash.id === p.id ? 1 - flash.p : 0;
    let level = chartLevel(run, p.t), gl = 0;
    const growing = grow && (grow.exact ? grow.form === p.t : grow.from != null && chartForm(p.t) === grow.form);
    if (growing && grow.from != null) {
      // 반짝이는 순간(GROW_TURN)에 옛 수준 → 새 수준. 흰 빛이 바뀌는 때를 덮는다
      const g = grow.p;
      if (g < GROW_TURN) level = grow.from;
      fl = Math.max(fl, Math.max(0, 1 - Math.abs(g - GROW_TURN) / 0.22) * (grow.big ? 1 : 0.75));
      gl = g < GROW_TURN ? 0 : 1 - (g - GROW_TURN) / (1 - GROW_TURN);
    }
    pieceCard(ctx, p, px, py, cw, ch, { lift: hov && pick && ok ? 1 : 0, selected: selectedId === p.id, hover: hov && ok, dim: !ok, tier: tierOf(level), level, glow: gl, time: ui.time + i, flash: fl });
    if (growing) { if (grow.big || grow.from == null) growPillar(ctx, px, py, cw, ch, grow.p); else growSparks(ctx, px, py, cw, ch, grow.p); }
    if (glow && pick && ok) { const a = 0.4 + 0.3 * Math.sin(ui.time * 6); ctx.globalAlpha = a; frame(ctx, px - 1, py - 1, cw + 2, ch + 2, PAL.gold); ctx.globalAlpha = 1; }
  });
}

// 기보로 자라는 연출 길이: 단계가 바뀌면(빛 기둥) · 수준만 오르면(청록 반짝). 옛 모습이 새 모습으로 바뀌는 때(비율)
export const GROW_BIG = 0.8, GROW_SMALL = 0.6, GROW_TURN = 0.35;
// 수준만 오르는 순간: 카드 둘레에서 청록 점이 솟아오른다
export function growSparks(ctx, x, y, w, h, p) {
  const a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
  ctx.globalAlpha = Math.max(0, a);
  for (let k = 0; k < 6; k++) {
    const sx = x + 2 + ((k * 7) % (w - 3)), sy = y + h - 4 - Math.round((p * 22 + (k % 3) * 5));
    rect(ctx, sx, sy, 1, 2, k % 2 ? SEAL.chart[1] : PAL.white);
  }
  ctx.globalAlpha = 1;
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

// 두루마리 한 칸(이름 한 줄 — 높이 rowBoxH(PAD_CARD)): 넓은 칸은 왼쪽 그림(각인 = 재료, 혼 = 기운, 진화 = 자라는 화살, 기보 = 모습 윤곽) + 이름,
// 좁은 칸(셋 이상 — 두 칸씩)은 이름만. 효과는 가리키면 왼쪽 칸 설명에
export function consumableCard(ctx, c, x, y, w, h, hover) {
  const edge = c.kind === 'engraving' ? ENG_EDGE[c.id] || PAL.gold : c.kind === 'soul' ? SOUL_BY_ID[c.id].col : null;
  openBox('card', x, y, w, h, PAD_CARD, { name: `두루마리 ${c.kind}` });
  cardBase(ctx, x, y, w, h, { fill: c.kind === 'chart' ? '#e8dcc0' : PAL.card, hover, edge });
  const name = c.kind === 'chart' ? `${PIECE_NAME[c.form]}` : c.kind === 'evolve' ? '진화' : c.kind === 'tactic' ? TACTIC_BY_ID[c.id].name : c.kind === 'soul' ? SOUL_BY_ID[c.id].name : engravingInfo(c.id).name;
  const P = PAD_CARD, narrow = w < 80;
  if (narrow) { fitText(ctx, name, x + Math.floor(w / 2), y + textY(P), w - P * 2, PAL.cardInk, { align: 'center' }); closeBox(); return; }
  const ax = x + 2, ay = y + Math.floor((h - 18) / 2);
  rect(ctx, ax + 2, ay, 18, 18, '#1b2b27');
  if (c.kind === 'engraving') engravingEmblem(ctx, c.id, ax - 1, ay - 5, { sq: false });
  else if (c.kind === 'soul') soulEmblem(ctx, c.id, ax - 1, ay - 4, 0, { sq: false });
  else if (c.kind === 'evolve') { rect(ctx, ax + 5, ay + 11, 3, 3, PAL.ink); for (let i = 0; i < 4; i++) rect(ctx, ax + 9 + i, ay + 10 - i, 1, 1, PAL.gold); rect(ctx, ax + 12, ay + 4, 5, 6, PAL.gold); }
  else if (c.kind === 'tactic') tacticIcon(ctx, c.id, ax + 3, ay + 4);
  else if (c.kind === 'chart') { dots(ctx, ax + 2, ay, 18, 18, PAL.dim, 2); sprite(ctx, c.form, 'w', ax + 3, ay - 3, { alpha: 0.9 }); }
  const nx = x + 26;
  fitText(ctx, name, nx, y + textY(P), x + w - P - nx, PAL.cardInk);
  closeBox();
}
// 꾸러미 칸 쌓기(재기와 그리기가 같이 쓴다): 왼쪽 봉투(ENV), 오른쪽 이름 → 값(두 줄, 봉투 높이 가운데).
// 봉투 속 「무엇 셋 중 하나」는 가리키면 왼쪽 칸 설명에(packTip)
const ENV = { w: 26, h: 20 };
const PACK_INSIDE = { piece: '기물 셋 중 하나', chart: '기보 셋 중 하나', engraving: '각인 셋 중 하나', golden: '판본 격언 셋 중 하나' };
export const packTip = (pk) => tipLines(PACK_NAME[pk.kind], PACK_INSIDE[pk.kind] || '');
const PACK_GAP = 4;
// 좁은 칸(셋 — 폭 100 아래)은 봉투 없이 이름 → 값
const packEnv = (w) => w >= 100;
export function packCellLayout(pk, w) {
  const P = PAD_CARD, tx = packEnv(w) ? P + ENV.w + 4 : P, tw = w - tx - P;
  const f = flow(P);
  const name = f.line(), price = f.line();
  const h = Math.max(f.y, packEnv(w) ? P + ENV.h : 0) + P;
  return { tx, tw, price, name, env: packEnv(w) ? Math.floor((h - ENV.h) / 2) : null, h };
}
export const packCellH = (pk, w) => packCellLayout(pk, w).h;
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
    if (e.type === 'evolve') { this.grow = { form: e.to, t0: this.app.time, big: true, exact: true }; this.app.sfx('grow'); }
    // 기보: 그 모습의 기물마다 한 단계 자란다(단계 동 · 은 · 금이 바뀌면 빛 기둥, 수준만 오르면 청록 반짝)
    if (e.type === 'chart') {
      const big = tierOf(e.level) > tierOf(e.level - 1);
      this.grow = { form: e.form, t0: this.app.time, big, from: e.level - 1, to: e.level };
      this.app.sfx(big ? 'grow' : 'sparkle');
    }
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
        const to = shardTo();
        this.app.flyShard(r ? r.x + r.w / 2 : 240, r ? r.y + r.h / 2 : 100, to.x, to.y);
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

  // 가운데 칸 자리: 진열 줄 높이(두 카드 중 긴 것) · 꾸러미 줄 높이 · 주머니 윗변
  centerLayout() {
    const run = this.run, shop = run.shop;
    const cardH = itemRowH(shop.display, CARD_W, { run });
    const packY = TOP + cardH + GAP_GROUP;
    // 꾸러미 칸은 가운데 칸 폭을 나눠 쓴다(둘이면 108, 금빛 꾸러미가 붙어 셋이면 72)
    const n = Math.max(1, shop.packs.length), packW = n <= 2 ? CARD_W : Math.floor((CENTER.w - (n - 1) * PACK_GAP) / n);
    const packH = Math.max(0, ...shop.packs.map((pk) => packCellH(pk, packW)));
    return { cardH, packY, packH, packW, bagY: packY + packH + GAP_GROUP };
  }
  // 오른쪽 칸 자리: 두루마리(아래에서부터, 넓은 칸은 한 줄에 하나 · 셋 이상은 두 칸씩) → 이름표 → 격언 칸(남는 높이)
  rightLayout() {
    const run = this.run, ch = rowBoxH(PAD_CARD);
    const wide = run.consumableSlots <= 2;
    const rows = wide ? run.consumableSlots : Math.ceil(run.consumableSlots / 2);
    const scrollY = BOTTOM - (rows * ch + (rows - 1) * LIST_GAP);
    const labelY = scrollY - GAP_IN - LINE;
    return { wide, ch, scrollY, labelY, room: labelY - GAP_GROUP - TOP };
  }
  // 판 틀(docs/design-notes/layout.md): 왼쪽 칸(상점 · 시너지 · 정석 · 상금 · 주머니 수 — 설명 자리),
  // 가운데(띠: 진열 · 다시 진열 · 다음 대국 / 진열 둘 · 꾸러미 둘 · 주머니), 오른쪽 칸(격언 · 두루마리)
  draw(ctx, ui) {
    const app = this.app, run = this.run, shop = run.shop;
    runSide(ctx, ui, app, '상점');
    pauseButton(ctx, ui, app);
    const CX = CENTER.x, lay = this.centerLayout();
    text(ctx, '진열', CX, textY(BAR_Y, BAR_H), PAL.dim);
    const rc = rerollCost(run);
    const leaveW = measure('다음 대국', true) + 12, rerollW = 80;
    button(ctx, ui, 'shop:leave', CX + CENTER.w - leaveW, BAR_Y, leaveW, BAR_H, '다음 대국', { onClick: () => this.leave(), tone: 'gold' });
    button(ctx, ui, 'shop:reroll', CX + CENTER.w - leaveW - 4 - rerollW, BAR_Y, rerollW, BAR_H, `다시 진열 $${rc}`, { enabled: run.money >= rc, onClick: () => this.act({ type: 'reroll' }, 'coin') });
    // 두루마리를 쓰는 중: 진열 · 꾸러미 자리에 미리 보기 판(고른 기물이 어떻게 되는지 보이고 확인을 받는다), 그 아래 주머니
    let bagY = lay.bagY;
    const target = this.target && run.consumables[this.target.index];
    if (target) {
      const p = this.target.pieceId != null ? run.deck.find((x) => x.id === this.target.pieceId) : null;
      const th = targetPanel(ctx, ui, run, target, p, CX, TOP, CENTER.w, {
        to: p && target.kind === 'evolve' ? evolveTo(run.seed, p) : null,
        onConfirm: () => { const i = this.target.index, id = this.target.pieceId; this.target = null; this.act({ type: 'use', index: i, target: id }, 'engrave'); },
        onCancel: () => { this.target = null; },
        onBack: () => { this.target = { index: this.target.index }; },
      });
      bagY = TOP + th + GAP_GROUP;
    } else {
      // 진열 카드는 효과를 다 적는다(가리키지 않아도 읽힌다). 두 카드는 긴 쪽 높이에 맞춘다
      shop.display.forEach((it, i) => {
        const x = CX + i * (CARD_W + 8), y = TOP, id = `shop:buy:${i}`;
        const ok = canBuy(run, it);
        ui.region(id, x, y, CARD_W, lay.cardH, { enabled: ok, onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), tip: () => itemExtraTip(it), keys: () => itemKeys(it), preview: true });
        itemCard(ctx, it, x, y, CARD_W, lay.cardH, { hover: ui.isHover(id) && ok, sold: it.sold, t: ui.time + i, run, ui, under: { onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), enabled: ok } });
        if (!it.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, CARD_W, lay.cardH, PAL.shadow); ctx.globalAlpha = 1; }
      });
      // 꾸러미: 진열 아래 칸 둘(금빛 꾸러미가 붙으면 셋)
      shop.packs.forEach((pk, i) => {
        const pw = lay.packW, x = CX + i * (pw + (pw === CARD_W ? 8 : PACK_GAP)), y = lay.packY, id = `shop:pack:${i}`;
        const ok = !pk.sold && run.money >= pk.price;
        ui.region(id, x, y, pw, lay.packH, { enabled: ok, onClick: () => this.act({ type: 'buyPack', slot: i }, 'pack'), tip: () => packTip(pk) });
        this.packCard(ctx, pk, x, y, pw, lay.packH, ui.isHover(id) && ok);
        if (!pk.sold && !ok) { ctx.globalAlpha = 0.35; rect(ctx, x, y, pw, lay.packH, PAL.shadow); ctx.globalAlpha = 1; }
      });
    }
    // 주머니(가운데 아래 — 남는 높이). 수는 왼쪽 칸 「주머니」.
    // 진열 카드는 ≤ 160이라 주머니 한 줄(BAG_MIN)이 늘 남는다(test/layout.test.js). 그래도 모자라면 화면 안에 붙인다(연기 시험이 겹침으로 잡는다)
    bagY = Math.min(bagY, BOTTOM - BAG_MIN);
    const since = (fx, d) => (fx && app.time - fx.t0 < d ? (app.time - fx.t0) / d : null);
    const fp = since(this.flash, 0.3), gp = since(this.grow, this.grow && !this.grow.big ? GROW_SMALL : GROW_BIG);
    bagRow(ctx, ui, run, CX, bagY, CENTER.w, {
      pick: (p) => this.pickPiece(p), glow: !!this.target, selectedId: this.menu && this.menu.kind === 'piece' ? this.menu.id : this.target ? this.target.pieceId : null,
      flash: fp != null ? { id: this.flash.id, p: fp } : null, grow: gp != null ? { ...this.grow, p: gp } : null, bottom: BOTTOM,
      can: target ? (p) => targetOk(target, p) : null,
    });
    // 오른쪽 칸: 격언 → 두루마리
    const rl = this.rightLayout();
    text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 8, PAL.dim);
    const col = maximColumn(ctx, ui, run, RX, TOP, RW, rl.room, {
      onClick: (i) => { this.menu = this.menu && this.menu.kind === 'maxim' && this.menu.index === i ? null : { kind: 'maxim', index: i }; this.target = null; },
      drag: (i, mx, my) => this.dropMaxim(i, my, col),
      hotIndex: this.menu && this.menu.kind === 'maxim' ? this.menu.index : -1,
    });
    this.col = col;
    text(ctx, '두루마리', RX, textY(rl.labelY), PAL.dim);
    for (let i = 0; i < run.consumableSlots; i++) {
      const cw = rl.wide ? RW : Math.floor((RW - LIST_GAP) / 2);
      const x = rl.wide ? RX : RX + (i % 2) * (cw + LIST_GAP), y = rl.scrollY + (rl.wide ? i : Math.floor(i / 2)) * (rl.ch + LIST_GAP);
      const c = run.consumables[i];
      if (!c) { frame(ctx, x, y, cw, rl.ch, PAL.feltHi); continue; }
      const id = `cons:${i}`;
      ui.region(id, x, y, cw, rl.ch, { onClick: () => this.useConsumable(i), tip: () => consumableTip(c), keys: () => itemKeys(c) });
      consumableCard(ctx, c, x, y, cw, rl.ch, ui.isHover(id) || (this.target && this.target.index === i));
    }
    this.drawMenu(ctx, ui);
    // 처음 안내(한 번에 하나, 앞의 것부터)
    if (!this.menu && !this.target) {
      coachHint(app, 'shop', 'shop:buy:0');
      if (run.consumables.length) coachHint(app, 'scroll', 'cons:0');
      const fam = ui.regions.find((r) => r.id.startsWith('fam:'));
      if (fam) coachHint(app, 'family', fam.id);
      if (run.maxims.length) coachHint(app, 'maximSell', 'maxim:0');
    }
  }

  // 꾸러미 칸: 왼쪽 봉투, 오른쪽 이름 → 값(packCellLayout). 봉투 속은 가리키면(packTip)
  packCard(ctx, pk, x, y, w, h, hover) {
    const lay = packCellLayout(pk, w);
    openBox('card', x, y, w, h, PAD_CARD, { name: `꾸러미 ${pk.kind}` });
    box(ctx, x, y, w, h, PAL.feltDk, hover ? PAL.gold : PAL.frameDk);
    const P = PAD_CARD;
    if (lay.env != null) envelope(ctx, x + P, y + lay.env, ENV.w, ENV.h, pk.kind, { hover });
    if (pk.sold) {
      ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
      text(ctx, '열었다', x + w / 2, y + Math.floor(h / 2) - 6, PAL.dim, { align: 'center', bold: true });
      closeBox();
      return;
    }
    fitText(ctx, PACK_NAME[pk.kind].split(' ')[0], x + lay.tx, y + lay.name, lay.tw, PAL.ink);
    text(ctx, pk.price ? `$${pk.price}` : '공짜', x + lay.tx, y + lay.price, PAL.gold, { bold: true });
    closeBox();
  }

  drawMenu(ctx, ui) {
    const run = this.run, m = this.menu;
    if (!m) return;
    if (m.kind === 'maxim') {
      const mx = run.maxims[m.index];
      const spot = this.col && this.col.spots.find((s) => s.i === m.index);
      if (!mx || !spot) { this.menu = null; return; }
      const y = spot.y + Math.floor(spot.h / 2) - 9;
      openBox('tile', RX - 70, y, 66, 18, 0, { overlay: true, name: '팔기' });
      if (canSell(mx)) button(ctx, ui, 'shop:sell', RX - 70, y, 66, 18, `팔기 $${sellPrice(mx)}`, { onClick: () => { this.menu = null; this.act({ type: 'sell', index: m.index }, 'coin'); }, tone: 'red' });
      closeBox();
    } else if (m.kind === 'piece') {
      const p = run.deck.find((x) => x.id === m.id);
      const r = ui.last.find((x) => x.id === `deck:${m.id}`) || ui.regions.find((x) => x.id === `deck:${m.id}`);
      if (!p || !r) { this.menu = null; return; }
      const opts = [];
      if (!run.shop.promoted) for (const to of PROMOTE[p.t] || []) opts.push([`shop:promote:${to}`, `${josa(PIECE_NAME[to], '으로/로')} 승급 $${SHOP.promotePrice}`, run.money >= SHOP.promotePrice, () => this.act({ type: 'promote', pieceId: p.id, to }, 'promote')]);
      if (!run.shop.removed) opts.push(['shop:remove', `빼기 $${SHOP.removePrice}`, run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin, () => this.act({ type: 'remove', pieceId: p.id }, 'discard')]);
      if (!opts.length) opts.push(['shop:none', '이번 상점에선 끝', false, null]);
      // 차림표 폭은 가장 긴 단추 글에 맞춘다(영어 「Promote to Knight $3」)
      const w = Math.max(112, ...opts.map(([, label]) => measure(label, true) + 12)) + 4, h = opts.length * 20 + 4;
      const x = Math.min(r.x, CENTER.x + CENTER.w - w), y = r.y - h - 2;
      openBox('tile', x, y, w, h, 0, { overlay: true, name: '기물 차림표' });
      box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
      opts.forEach(([id, label, ok, fn], k) => button(ctx, ui, id, x + 2, y + 2 + k * 20, w - 4, 18, label, { enabled: ok, onClick: () => { this.menu = null; if (fn) fn(); } }));
      closeBox();
    }
  }

  pickPiece(p) {
    if (this.target) {
      // 고르면 미리 보기, 확인 단추로 쓴다
      const c = this.run.consumables[this.target.index];
      if (c && !targetOk(c, p)) return;
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
