// 꾸러미 열기: 카드가 차례로 뒤집히며 나오고 하나를 고른다(건너뛰기 가능). 금빛 꾸러미는 금빛.
// 각인이면 고른 뒤 주머니에서 새길 기물을 누른다. 금빛 꾸러미의 격언을 칸이 찬 채로 고르면 격언 칸이 펼쳐지고,
// 옛 격언 하나를 골라 바꾼다(팔고 받는다). 격언 칸은 평소엔 위 띠의 이름표 「격언 5/5」 — 누르면 펼쳐 판다.
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { box, rect, measure } from '../../render/gfx.js';
import { hasMaximRoom, canSell, sellPrice, maximCapacity, maximCount } from '../../sim/run.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { CHARTS } from '../../data/charts.js';
import { button } from '../ui.js';
import { itemCard, itemRowH, itemKeys, itemExtraTip, itemEffect, itemName, maximGrid, maximGridH, envelope, targetPanel, targetOk, cardBase, fitText, shardIcon } from '../parts.js';
import { PACK_NAME, PART_NAME } from '../words.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, BTN_H, GAP_GROUP, LIST_GAP, PAD_CARD, flow, BTN_S } from '../frame.js';
import { bagRow } from './shop.js';
import { familyCounts } from '../../data/families.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

// 봉투가 열리는 시간, 카드 i가 뒤집히기 시작하는 때
const OPEN = 0.4;
const flipAt = (i) => OPEN + i * 0.18;

// 명국 조각 칸(금빛 꾸러미의 넷째 것): 카드 줄 아래 건너뛰기 줄 왼쪽. 조각 그림 옆에 이름 → 「조각 셋이면 전설」 두 줄(꾸러미 칸과 같은 42)
const SHARD_ART = 22;
export function shardCellLayout(w) {
  const P = PAD_CARD, tx = P + SHARD_ART + 4;
  const f = flow(P);
  const name = f.line(), effect = f.line();
  return { tx, tw: w - tx - P, name, effect, h: Math.max(f.y, P + 26) + P };
}
// 위 띠의 격언 이름표 단추(판 틀 위 띠 — 관 선택의 「상점」 단추와 같은 자리 · 높이)
const TAG_Y = 2;
export const maximTagW = (run) => measure(`격언 ${maximCount(run)}/${maximCapacity(run)}`, true) + 12;

// 꾸러미 화면 자리(재기와 그리기가 같이 쓴다 — test/layout.test.js).
// 금빛 꾸러미의 명국 조각은 카드 줄 밖(건너뛰기 줄)으로 빼서, 판본 격언 카드 셋이 늘 폭 108이다.
// panel: 격언 칸을 펼쳤으면 { pick: 칸이 차서 바꾸려는 격언 카드 번호 | null } — 카드 줄 자리에 [고른 카드] + 격언 칸
export function packLayout(run, pack, panel = null) {
  const golden = pack.kind === 'golden';
  const all = pack.options.map((o, i) => i);
  const out = all.filter((i) => golden && pack.options[i].kind === 'fragment');
  const cards = all.filter((i) => !out.includes(i));
  const n = cards.length;
  const fit = n * CARD.w + (n - 1) * CARD.gap <= MAIN.w;
  const gap = fit ? CARD.gap : 4;
  const cw = fit ? CARD.w : Math.floor((MAIN.w - (n - 1) * gap) / n);
  const x0 = MAIN.x + Math.floor((MAIN.w - n * cw - (n - 1) * gap) / 2);
  const ch = itemRowH(cards.map((i) => pack.options[i]), cw, { run });
  const tag = pack.options.some((o) => o.kind === 'maxim');
  let top = ch, grid = null, chosen = null;
  if (panel) {
    // 고른 카드가 있으면 첫 칸 자리에 그 카드, 격언 칸은 둘째 · 셋째 칸 자리에 두 칸씩. 없으면 세 칸씩
    const pick = panel.pick != null;
    const cols = pick ? 2 : 3;
    grid = { x: pick ? MAIN.x + CARD.w + CARD.gap : MAIN.x, y: TOP, cols, h: maximGridH(run, cols, LIST_GAP) };
    chosen = pick ? { x: MAIN.x, y: TOP, w: CARD.w, h: itemRowH([pack.options[panel.pick]], CARD.w, { run }) } : null;
    top = Math.max(grid.h, chosen ? chosen.h : 0);
  }
  const rowY = TOP + top + GAP_GROUP;
  const cw2 = 2 * CARD.w + CARD.gap;
  const cell = !panel && out.length ? { i: out[0], x: MAIN.x, y: rowY, w: cw2, h: shardCellLayout(cw2).h } : null;
  const rowH = cell ? cell.h : BTN_H;
  const skip = { x: cell ? MAIN.x + MAIN.w - 100 : MAIN.x + Math.floor(MAIN.w / 2) - 50, y: rowY + Math.floor((rowH - BTN_H) / 2), w: 100 };
  return { cards, n, cw, gap, x0, ch, tag, grid, chosen, cell, rowY, rowH, skip, bottom: rowY + rowH };
}

export class PackScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.engraveIndex = null;
    this.sellMenu = null;     // 펼친 격언 칸에서 고른 옛 격언
    this.panel = null;        // 격언 칸을 펼쳤으면 { pick: 칸이 차서 바꾸려는 격언 카드 번호 | null }
    this.notes = 'side';
    app.sfx('pack');
  }
  get run() { return this.app.run; }
  update(dt) {
    const before = this.t;
    this.t += dt * this.app.speed();
    const n = this.run.pack ? this.run.pack.options.length : 0;
    if (before < 0.12 && this.t >= 0.12) this.app.sfx('engrave');
    for (let i = 0; i < n; i++) { const at = flipAt(i) + 0.12; if (before < at && this.t >= at) this.app.sfx('flip'); }
  }
  pick(i) {
    const o = this.run.pack.options[i];
    if (this.t < flipAt(i) + 0.2) { this.t = 10; return; }
    if (o.kind === 'engraving') { this.engraveIndex = this.engraveIndex === i ? null : i; this.engraveTarget = null; return; }
    if (o.kind === 'maxim' && !hasMaximRoom(this.run, o.edition)) {
      // 칸이 찼으면 격언 칸을 펼쳐 옛 격언 하나와 바꾼다(팔 수 있는 격언이 없으면 그대로 막는다)
      if (!this.run.maxims.some(canSell)) { this.app.toast('격언 칸이 찼다', PAL.red); return; }
      this.panel = { pick: i };
      this.sellMenu = null;
      return;
    }
    this.finish({ type: 'pick', index: i });
  }
  togglePanel() {
    this.panel = this.panel ? null : { pick: null };
    this.sellMenu = null;
  }
  // 바꾸기: 고른 옛 격언을 팔고 곧바로 새 격언을 받는다(명령 둘 — 규칙은 그대로)
  swap(k) {
    const i = this.panel.pick;
    this.panel = null; this.sellMenu = null;
    try { this.app.cmd({ type: 'sell', index: k }); } catch { this.app.toast('할 수 없다', PAL.red); return; }
    this.app.sfx('coin');
    if (!hasMaximRoom(this.run, this.run.pack.options[i].edition)) { this.app.toast('격언 칸이 찼다', PAL.red); return; }
    this.finish({ type: 'pick', index: i });
  }
  finish(cmd) {
    let ev;
    this.app.shopFamBefore = familyCounts(this.run);
    try { ev = this.app.cmd(cmd); } catch { this.app.toast('할 수 없다', PAL.red); return; }
    this.app.sfx('pick');
    const legend = ev.find((e) => e.type === 'legend');
    for (const e of ev) {
      if (e.type === 'fragment') this.app.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6);
      if (e.type === 'chart') this.app.toast(`${CHARTS[e.form].name} ${e.level}`, PAL.gold);
    }
    // 상점으로 돌아가 주머니에서 자라는 · 새겨지는 모습을 보인다
    this.app.shopFx = ev.filter((e) => e.type === 'chart' || e.type === 'engrave' || e.type === 'ensoul');
    if (legend) this.app.flow([['legend', { legend: legend.legend }]]);
    else if (this.run.phase !== 'pack') this.app.goPhase();
  }
  // 판 틀: 왼쪽 칸(꾸러미 이름 · 시너지 · 정석 · 상금 — 설명 자리) + 본 칸(위 띠 격언 이름표 · 카드 줄 · 건너뛰기 줄(명국 조각 칸) · 새기기 · 펼친 격언 칸)
  draw(ctx, ui) {
    const run = this.run, pack = run.pack;
    if (!pack) return;
    const gold = pack.kind === 'golden';
    runSide(ctx, ui, this.app, PACK_NAME[pack.kind]);
    pauseButton(ctx, ui, this.app);
    // 새길 기물을 고르는 동안은 카드 줄 자리에 미리 보기 판(고른 각인 · 기물이 어떻게 되는지)과 주머니 — 「그만」이면 카드 줄로 돌아간다
    if (this.engraveIndex != null) {
      const o = pack.options[this.engraveIndex];
      const p = this.engraveTarget != null ? run.deck.find((x) => x.id === this.engraveTarget) : null;
      const th = targetPanel(ctx, ui, run, o, p, MAIN.x, TOP, MAIN.w, {
        onConfirm: () => this.finish({ type: 'pick', index: this.engraveIndex, target: this.engraveTarget }),
        onCancel: () => { this.engraveIndex = null; this.engraveTarget = null; },
        onBack: () => { this.engraveTarget = null; },
      });
      bagRow(ctx, ui, run, MAIN.x, TOP + th + GAP_GROUP, MAIN.w, { pick: (q) => { if (targetOk(o, q)) this.engraveTarget = this.engraveTarget === q.id ? null : q.id; }, glow: true, selectedId: this.engraveTarget, can: (q) => targetOk(o, q), bottom: 268 });
      return;
    }
    const lay = packLayout(run, pack, this.panel);
    // 위 띠: 격언 이름표(누르면 격언 칸을 펼친다 · 접는다)
    if (lay.tag) button(ctx, ui, 'pack:maxims', MAIN.x, TAG_Y, maximTagW(run), BTN_H, `격언 ${maximCount(run)}/${maximCapacity(run)}`, { tone: this.panel ? 'gold' : 'plain', onClick: () => this.togglePanel() });
    if (this.panel) this.drawPanel(ctx, ui, lay);
    else this.drawCards(ctx, ui, lay, gold);
    if (this.panel) button(ctx, ui, 'pack:back', lay.skip.x, lay.skip.y, lay.skip.w, BTN_H, '그만', { onClick: () => this.togglePanel() });
    else button(ctx, ui, 'pack:skip', lay.skip.x, lay.skip.y, lay.skip.w, BTN_H, '건너뛰기', { onClick: () => this.finish({ type: 'skipPack' }) });
    if (this.t > 1.2 && !this.panel) hint(this.app, 'pack', 'pack:pick:0');
  }
  // 카드가 차례로 뒤집힌다. 금빛 꾸러미의 명국 조각은 건너뛰기 줄 왼쪽 칸
  drawCards(ctx, ui, lay, gold) {
    const run = this.run, pack = run.pack;
    const { cw, ch, gap, x0, n } = lay;
    const flipCard = (o, i, x, y, w, h, draw) => {
      const p = Math.max(0, Math.min(1, (this.t - flipAt(i)) / 0.24));
      const id = `pack:pick:${i}`;
      const scaleX = Math.abs(1 - 2 * p);
      const shown = p >= 0.5;
      ui.region(id, x, y, w, h, { onClick: () => this.pick(i), tip: shown ? () => itemExtraTip(o) : null, keys: shown ? () => itemKeys(o) : null, preview: true });
      if (!shown) {
        const nw = Math.max(2, Math.round(w * scaleX));
        if (this.t < OPEN) return;
        box(ctx, x + Math.floor((w - nw) / 2), y, nw, h, gold ? PAL.gold : '#c9a36a', PAL.frameDk);
        if (nw > 20) rect(ctx, x + Math.floor(w / 2) - 6, y + Math.min(46, Math.floor(h / 2) - 6), 12, 12, gold ? PAL.goldHi : '#e6c690');
      } else draw(scaleX, ui.isHover(id));
    };
    lay.cards.forEach((i, k) => {
      const o = pack.options[i];
      const x = x0 + k * (cw + gap), y = TOP;
      flipCard(o, i, x, y, cw, ch, (scaleX, hover) => itemCard(ctx, o, x, y, cw, ch, { hover, price: false, scaleX, wide: true, golden: gold && o.kind !== 'fragment' && !o.edition, t: ui.time + k, run, ui, under: { onClick: () => this.pick(i) } }));
    });
    if (lay.cell) {
      const { i, x, y, w, h } = lay.cell;
      const o = pack.options[i];
      flipCard(o, i, x, y, w, h, (scaleX, hover) => {
        if (scaleX < 0.98) { const nw = Math.max(2, Math.round(w * scaleX)); cardBase(ctx, x + Math.floor((w - nw) / 2), y, nw, h, { fill: '#f3e2b0' }); return; }
        const s = shardCellLayout(w);
        openBox('card', x, y, w, h, PAD_CARD, { name: '명경기 조각 칸' });
        cardBase(ctx, x, y, w, h, { fill: '#f3e2b0', hover });
        shardIcon(ctx, x + PAD_CARD + 3, y + Math.floor((h - 14) / 2));
        fitText(ctx, itemName(o), x + s.tx, y + s.name, s.tw, PAL.cardInk);
        fitText(ctx, itemEffect(o), x + s.tx, y + s.effect, s.tw, PAL.cardInk, { bold: false });
        closeBox();
      });
    }
    // 봉투: 봉랍이 깨지고 덮개가 젖혀진 뒤 카드가 솟아 나온다
    if (this.t < OPEN + 0.25) {
      const k = Math.min(1, this.t / OPEN);
      const fade = this.t < OPEN ? 1 : 1 - (this.t - OPEN) / 0.25;
      const ew = 96, eh = 66, ex = Math.floor(x0 + (n * cw + (n - 1) * gap) / 2 - ew / 2), ey = 50 + Math.round(Math.max(0, this.t - OPEN) * 60);
      ctx.globalAlpha = Math.max(0, fade);
      envelope(ctx, ex, ey, ew, eh, pack.kind, { open: k });
      ctx.globalAlpha = 1;
    }
  }
  // 펼친 격언 칸: 카드 줄 자리에 [칸이 차서 고른 격언 카드] + 지금 격언 칸. 옛 격언을 누르면 그 칸에 「바꾸기」(고른 카드가 있을 때) 또는 「팔기 $N」
  drawPanel(ctx, ui, lay) {
    const run = this.run, pack = run.pack;
    if (lay.chosen) {
      const { x, y, w, h } = lay.chosen;
      const o = pack.options[this.panel.pick];
      ui.region('pack:chosen', x, y, w, h, { tip: () => itemExtraTip(o), keys: () => itemKeys(o) });
      itemCard(ctx, o, x, y, w, h, { hover: true, price: false, wide: true, t: ui.time, run, ui });
    }
    const g = lay.grid;
    const spots = maximGrid(ctx, ui, run, g.x, g.y, g.cols, CARD.w, CARD.gap, LIST_GAP, { onClick: (i) => { this.sellMenu = this.sellMenu === i ? null : i; }, hotIndex: this.sellMenu ?? -1 });
    if (this.sellMenu == null) return;
    const m = run.maxims[this.sellMenu];
    const spot = spots.find((q) => q.i === this.sellMenu);
    if (!m || !spot || !canSell(m)) { this.sellMenu = null; return; }
    // 단추: 고른 격언 칸 오른쪽 끝에 겹쳐(칸 위에 뜬다)
    const bx = spot.x + spot.w - 62, by = spot.y + 5, k = this.sellMenu;
    openBox('tile', bx, by, 60, BTN_S, 0, { overlay: true, name: '팔기' });
    if (lay.chosen) button(ctx, ui, 'pack:swap', bx, by, 60, BTN_S, '바꾸기', { tone: 'gold', onClick: () => this.swap(k) });
    else button(ctx, ui, 'pack:sell', bx, by, 60, BTN_S, `팔기 $${sellPrice(m)}`, { tone: 'red', onClick: () => { this.sellMenu = null; this.app.cmd({ type: 'sell', index: k }); this.app.sfx('coin'); } });
    closeBox();
  }
  key(k) {
    if (k === 'Escape') { if (this.engraveIndex != null) this.engraveIndex = null; else if (this.panel) this.togglePanel(); else this.finish({ type: 'skipPack' }); }
    else if (/^[1-4]$/.test(k) && !this.panel) this.pick(Number(k) - 1);
  }
}
