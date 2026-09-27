// 꾸러미 열기: 카드가 차례로 뒤집히며 나오고 하나를 고른다(건너뛰기 가능). 금빛 꾸러미는 금빛.
// 각인이면 고른 뒤 주머니에서 새길 기물을 누른다. 금빛 꾸러미의 격언을 칸이 찬 채로 받으려면 격언을 먼저 판다.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect } from '../../render/gfx.js';
import { hasMaximRoom, canSell, sellPrice, maximCapacity, maximCount } from '../../sim/run.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { CHARTS } from '../../data/charts.js';
import { button } from '../ui.js';
import { itemCard, itemTip, maximColumn } from '../parts.js';
import { PACK_NAME, PART_NAME } from '../words.js';
import { topBar } from './common.js';
import { bagRow } from './shop.js';

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
    for (let i = 0; i < n; i++) { const at = 0.15 + i * 0.18 + 0.12; if (before < at && this.t >= at) this.app.sfx('flip'); }
  }
  pick(i) {
    const o = this.run.pack.options[i];
    if (this.t < 0.15 + i * 0.18 + 0.2) { this.t = 10; return; }
    if (o.kind === 'engraving') { this.engraveIndex = this.engraveIndex === i ? null : i; return; }
    if (o.kind === 'maxim' && !hasMaximRoom(this.run, o.edition)) { this.app.toast('격언 칸이 찼다', PAL.red); return; }
    this.finish({ type: 'pick', index: i });
  }
  finish(cmd) {
    let ev;
    try { ev = this.app.cmd(cmd); } catch { this.app.toast('할 수 없다', PAL.red); return; }
    this.app.sfx('pick');
    const legend = ev.find((e) => e.type === 'legend');
    for (const e of ev) {
      if (e.type === 'fragment') this.app.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6);
      if (e.type === 'chart') this.app.toast(`${CHARTS[e.form].name} ${e.level}`, PAL.gold);
    }
    // 상점으로 돌아가 주머니에서 자라는 · 새겨지는 모습을 보인다
    this.app.shopFx = ev.filter((e) => e.type === 'chart' || e.type === 'engrave');
    if (legend) this.app.flow([['legend', { legend: legend.legend }]]);
    else if (this.run.phase !== 'pack') this.app.goPhase();
  }
  draw(ctx, ui) {
    const run = this.run, pack = run.pack;
    if (!pack) return;
    const gold = pack.kind === 'golden';
    topBar(ctx, ui, this.app, PACK_NAME[pack.kind]);
    const n = pack.options.length;
    const cw = 76, ch = 104, gap = 14;
    const x0 = Math.floor((W - n * cw - (n - 1) * gap) / 2) - (pack.options.some((o) => o.kind === 'maxim') ? 50 : 0);
    pack.options.forEach((o, i) => {
      const at = 0.15 + i * 0.18;
      const p = Math.max(0, Math.min(1, (this.t - at) / 0.24));
      const x = x0 + i * (cw + gap), y = 44;
      const id = `pack:pick:${i}`;
      const scaleX = Math.abs(1 - 2 * p);
      const shown = p >= 0.5;
      ui.region(id, x, y, cw, ch, { onClick: () => this.pick(i), tip: shown ? () => itemTip(o) : null });
      if (!shown) {
        const nw = Math.max(2, Math.round(cw * scaleX));
        box(ctx, x + Math.floor((cw - nw) / 2), y, nw, ch, gold ? PAL.gold : '#c9a36a', PAL.frameDk);
        if (nw > 20) rect(ctx, x + Math.floor(cw / 2) - 6, y + 46, 12, 12, gold ? PAL.goldHi : '#e6c690');
      } else itemCard(ctx, o, x, y, cw, ch, { hover: ui.isHover(id), price: false, scaleX, golden: gold && o.kind !== 'fragment' && !o.edition, t: ui.time + i, run });
      if (this.engraveIndex === i) { rect(ctx, x, y + ch + 2, cw, 2, PAL.gold); }
    });
    if (this.engraveIndex != null) {
      text(ctx, '새길 기물', 12, 172, PAL.gold, { bold: true });
      bagRow(ctx, ui, run, 12, 188, 330, { pick: (p) => this.finish({ type: 'pick', index: this.engraveIndex, target: p.id }), glow: true });
    }
    button(ctx, ui, 'pack:skip', W / 2 - 50 - (pack.options.some((o) => o.kind === 'maxim') ? 50 : 0), 160, 100, 18, '건너뛰기', { onClick: () => this.finish({ type: 'skipPack' }) });
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
  }
  key(k) {
    if (k === 'Escape') { if (this.engraveIndex != null) this.engraveIndex = null; else this.finish({ type: 'skipPack' }); }
    else if (/^[1-4]$/.test(k)) this.pick(Number(k) - 1);
  }
}
