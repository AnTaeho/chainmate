// 꾸러미 열기: 카드가 차례로 뒤집히며 나오고 하나를 고른다(건너뛰기 가능). 금빛 꾸러미는 금빛.
// 각인이면 고른 뒤 주머니에서 새길 기물을 누른다. 금빛 꾸러미의 격언을 칸이 찬 채로 받으려면 격언을 먼저 판다.
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, text, box, rect } from '../../render/gfx.js';
import { hasMaximRoom, canSell, sellPrice, maximCapacity, maximCount } from '../../sim/run.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { CHARTS } from '../../data/charts.js';
import { button } from '../ui.js';
import { itemCard, itemExtraTip, maximColumn, envelope, targetPanel } from '../parts.js';
import { PACK_NAME, PART_NAME } from '../words.js';
import { topBar } from './common.js';
import { bagRow } from './shop.js';
import { familyCounts } from '../../data/families.js';

// 봉투가 열리는 시간, 카드 i가 뒤집히기 시작하는 때
const OPEN = 0.4;
const flipAt = (i) => OPEN + i * 0.18;

export class PackScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.engraveIndex = null;
    this.sellMenu = null;
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
    if (o.kind === 'maxim' && !hasMaximRoom(this.run, o.edition)) { this.app.toast('격언 칸이 찼다', PAL.red); return; }
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
  draw(ctx, ui) {
    const run = this.run, pack = run.pack;
    if (!pack) return;
    const gold = pack.kind === 'golden';
    topBar(ctx, ui, this.app, PACK_NAME[pack.kind]);
    const n = pack.options.length;
    const cw = 104, ch = 112, gap = 10;
    const x0 = Math.floor((W - n * cw - (n - 1) * gap) / 2) - (pack.options.some((o) => o.kind === 'maxim') ? 54 : 0);
    pack.options.forEach((o, i) => {
      const at = flipAt(i);
      const p = Math.max(0, Math.min(1, (this.t - at) / 0.24));
      const x = x0 + i * (cw + gap), y = 36;
      const id = `pack:pick:${i}`;
      const scaleX = Math.abs(1 - 2 * p);
      const shown = p >= 0.5;
      ui.region(id, x, y, cw, ch, { onClick: () => this.pick(i), tip: shown ? () => itemExtraTip(o) : null, tipAt: { x: Math.min(W - 176, x), y: 178 } });
      if (!shown) {
        const nw = Math.max(2, Math.round(cw * scaleX));
        if (this.t < OPEN) return;
        box(ctx, x + Math.floor((cw - nw) / 2), y, nw, ch, gold ? PAL.gold : '#c9a36a', PAL.frameDk);
        if (nw > 20) rect(ctx, x + Math.floor(cw / 2) - 6, y + 46, 12, 12, gold ? PAL.goldHi : '#e6c690');
      } else itemCard(ctx, o, x, y, cw, ch, { hover: ui.isHover(id), price: false, scaleX, golden: gold && o.kind !== 'fragment' && !o.edition, t: ui.time + i, run });
      if (this.engraveIndex === i) { rect(ctx, x, y + ch + 2, cw, 2, PAL.gold); }
    });
    // 봉투: 봉랍이 깨지고 덮개가 젖혀진 뒤 카드가 솟아 나온다
    if (this.t < OPEN + 0.25) {
      const k = Math.min(1, this.t / OPEN);
      const fade = this.t < OPEN ? 1 : 1 - (this.t - OPEN) / 0.25;
      const ew = 96, eh = 66, ex = Math.floor(x0 + (n * cw + (n - 1) * gap) / 2 - ew / 2), ey = 70 + Math.round(Math.max(0, this.t - OPEN) * 60);
      ctx.globalAlpha = Math.max(0, fade);
      envelope(ctx, ex, ey, ew, eh, pack.kind, { open: k });
      ctx.globalAlpha = 1;
    }
    if (this.engraveIndex != null) {
      // 기물을 고르면 새긴 모습을 미리 보이고, 「새긴다」로 확인한다
      const o = pack.options[this.engraveIndex];
      const p = this.engraveTarget != null ? run.deck.find((x) => x.id === this.engraveTarget) : null;
      targetPanel(ctx, ui, run, o, p, 12, 150, 330, {
        onConfirm: () => this.finish({ type: 'pick', index: this.engraveIndex, target: this.engraveTarget }),
        onCancel: () => { this.engraveIndex = null; this.engraveTarget = null; },
      });
      bagRow(ctx, ui, run, 12, 196, 330, { pick: (q) => { this.engraveTarget = this.engraveTarget === q.id ? null : q.id; }, glow: true, selectedId: this.engraveTarget });
    }
    if (this.engraveIndex == null) button(ctx, ui, 'pack:skip', W / 2 - 50 - (pack.options.some((o) => o.kind === 'maxim') ? 54 : 0), 154, 100, 18, '건너뛰기', { onClick: () => this.finish({ type: 'skipPack' }) });
    // 금빛 꾸러미: 격언 칸과 팔기
    if (pack.options.some((o) => o.kind === 'maxim')) {
      const RX = 360, RW = 112;
      text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 32, PAL.dim);
      const col = maximColumn(ctx, ui, run, RX, 46, RW, 170, { onClick: (i) => { this.sellMenu = this.sellMenu === i ? null : i; }, hotIndex: this.sellMenu ?? -1 });
      if (this.sellMenu != null) {
        const m = run.maxims[this.sellMenu];
        const spot = col.spots.find((s) => s.i === this.sellMenu);
        if (m && spot && canSell(m)) button(ctx, ui, 'pack:sell', RX - 70, spot.y + Math.floor(spot.h / 2) - 9, 66, 18, `팔기 $${sellPrice(m)}`, { tone: 'red', onClick: () => { const i = this.sellMenu; this.sellMenu = null; this.app.cmd({ type: 'sell', index: i }); this.app.sfx('coin'); } });
        else this.sellMenu = null;
      }
    }
    if (this.t > 1.2 && this.engraveIndex == null) hint(this.app, 'pack', 'pack:pick:0');
  }
  key(k) {
    if (k === 'Escape') { if (this.engraveIndex != null) this.engraveIndex = null; else this.finish({ type: 'skipPack' }); }
    else if (/^[1-4]$/.test(k)) this.pick(Number(k) - 1);
  }
}
