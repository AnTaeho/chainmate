// 정석 고르기(깊이 E): 1 · 3 · 5관의 첫 대국 앞. 카드 셋이 차례로 뒤집히며 나오고(등급 빛: 은 · 금 · 무지개) 하나를 고른다.
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { familyChips, chipRows } from '../parts-depth.js';
import { cornerTicks, tipLines } from '../parts.js';
import { topBar } from './common.js';

const TIER_NAME = { silver: '은', gold: '금', rainbow: '무지개' };
const CW = 132, CH = 170, GAP = 12;
const at = (i) => 0.2 + i * 0.22;

export class DraftScreen {
  constructor(app) { this.app = app; this.t = 0; this.chosen = null; app.sfx('pack'); }
  get run() { return this.app.run; }
  update(dt) {
    const before = this.t;
    this.t += dt * this.app.speed();
    const n = this.run.draft ? this.run.draft.options.length : 0;
    for (let i = 0; i < n; i++) if (before < at(i) + 0.12 && this.t >= at(i) + 0.12) this.app.sfx('flip');
    if (this.chosen && this.t - this.chosen.t > 0.6) {
      this.chosen = null;
      if (this.app.autoPlay && this.run.phase === 'select') { this.app.autoPlay = false; const ev = this.app.cmd({ type: 'play' }); this.app.go('battle', { events: ev }); }
      else this.app.goPhase();
    }
  }
  pick(i) {
    if (this.chosen) return;
    if (this.t < at(i) + 0.25) { this.t = 10; return; }
    const id = this.run.draft.options[i];
    const ev = this.app.cmd({ type: 'joseki', index: i });
    this.app.sfx(JOSEKI_BY_ID[id].tier === 'rainbow' ? 'fanfare' : 'sparkle');
    for (const e of ev) if (e.type === 'evolve' || e.type === 'piece') this.app.toast('주머니가 바뀌었다', PAL.gold);
    this.chosen = { i, id, t: this.t };
  }
  draw(ctx, ui) {
    const run = this.run;
    const d = run.draft || (this.chosen ? { ante: run.ante, options: [] } : null);
    topBar(ctx, ui, this.app, `정석 · ${run.ante}관`);
    if (!d) return;
    const opts = this.chosen ? this.chosenOpts || [] : d.options;
    if (!this.chosen) this.chosenOpts = d.options.slice();
    const n = opts.length;
    const x0 = Math.floor((W - n * CW - (n - 1) * GAP) / 2);
    const time = this.app.time;
    opts.forEach((id, i) => {
      const j = JOSEKI_BY_ID[id];
      const p = Math.max(0, Math.min(1, (this.t - at(i)) / 0.26));
      const sx = Math.abs(1 - 2 * p);
      const x = x0 + i * (CW + GAP), y = 40;
      const uid = `draft:${i}`;
      ui.region(uid, x, y, CW, CH, { onClick: () => this.pick(i), preview: true, keys: () => [...j.families.map((f) => ({ id: `fam_${f}` })), j.text], tip: j.more ? () => tipLines(j.name, j.more) : null, tipAt: { x: x + 4, y: y + CH + 4 } });
      const hov = ui.isHover(uid) && !this.chosen;
      const nw = Math.max(2, Math.round(CW * sx)), xx = x + Math.floor((CW - nw) / 2);
      if (p < 0.5) { box(ctx, xx, y, nw, CH, '#2a3a33', PAL.frameDk); if (nw > 30) rect(ctx, xx + Math.floor(nw / 2) - 8, y + CH / 2 - 8, 16, 16, TIER_COL[j.tier]); return; }
      const col = j.tier === 'rainbow' ? `hsl(${Math.floor(time * 120 + i * 60) % 360},70%,70%)` : TIER_COL[j.tier];
      const picked = this.chosen && this.chosen.i === i;
      const faded = this.chosen && !picked;
      if (faded) ctx.globalAlpha = 0.35;
      box(ctx, xx, y - (hov ? 2 : 0), nw, CH, PAL.card, hov || picked ? PAL.white : PAL.frameDk);
      frame(ctx, xx + 1, y + 1 - (hov ? 2 : 0), nw - 2, CH - 2, col);
      if (j.tier !== 'silver') frame(ctx, xx + 3, y + 3 - (hov ? 2 : 0), nw - 6, CH - 6, col);
      cornerTicks(ctx, xx + 5, y + 5 - (hov ? 2 : 0), nw - 10, CH - 10, col, 4);
      if (nw < CW - 4) { ctx.globalAlpha = 1; return; }
      const yy = y - (hov ? 2 : 0);
      text(ctx, TIER_NAME[j.tier], x + CW / 2, yy + 10, j.tier === 'silver' ? PAL.cardDim : PAL.goldDk, { align: 'center' });
      wrap(j.name, CW - 16, true).slice(0, 2).forEach((l, k) => text(ctx, l, x + CW / 2, yy + 26 + k * 13, PAL.cardInk, { align: 'center', bold: true }));
      rect(ctx, x + 16, yy + 54, CW - 32, 1, col);
      wrap(j.text, CW - 18).slice(0, 6).forEach((l, k) => richText(ctx, l, x + 9, yy + 60 + k * 13, PAL.cardInk, { ui, under: { onClick: () => this.pick(i) } }));
      // 시너지 칩(「기사 +1」)
      if (j.families.length) familyChips(ctx, j.families, x + 9, yy + CH - 22 - (chipRows(j.families, CW - 18) - 1) * 13, CW - 18);
      if (picked) { const k = Math.min(1, (this.t - this.chosen.t) / 0.3); ctx.globalAlpha = 0.5 * (1 - k); rect(ctx, x, yy, CW, CH, PAL.white); ctx.globalAlpha = 1; }
      ctx.globalAlpha = 1;
    });
    // 가진 정석
    if (run.josekis.length) {
      text(ctx, '정석', 12, H - 26, PAL.dim);
      run.josekis.forEach((id, k) => text(ctx, JOSEKI_BY_ID[id].name, 50 + k * 110, H - 26, TIER_COL[JOSEKI_BY_ID[id].tier], { bold: true }));
    }
    if (!this.chosen && this.t > 1.2) hint(this.app, 'draft', 'draft:1');
  }
  key(k) {
    if (/^[1-3]$/.test(k)) this.pick(Number(k) - 1);
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
