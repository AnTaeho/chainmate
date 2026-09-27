// 정석 고르기(깊이 E): 1 · 3 · 5관의 첫 대국 앞. 카드 셋이 차례로 뒤집히며 나오고(등급 빛: 은 · 금 · 무지개) 하나를 고른다.
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { familyChips, chipRows } from '../parts-depth.js';
import { cornerTicks, tipLines } from '../parts.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, CARD_ROW } from '../frame.js';

const TIER_NAME = { silver: '은', gold: '금', rainbow: '무지개' };
const CW = CARD.w, CH = 150, PADJ = 6; // 테가 두 겹이라 글은 x + 6
const at = (i) => 0.2 + i * 0.22;

export class DraftScreen {
  constructor(app) { this.app = app; this.t = 0; this.chosen = null; this.notes = 'side'; app.sfx('pack'); }
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
  // 판 틀: 왼쪽 칸(정석 · 가진 정석 · 시너지 · 상금 — 설명 자리) + 본 칸(카드 셋)
  draw(ctx, ui) {
    const run = this.run;
    const d = run.draft || (this.chosen ? { ante: run.ante, options: [] } : null);
    runSide(ctx, ui, this.app, '정석');
    pauseButton(ctx, ui, this.app);
    if (!d) return;
    const opts = this.chosen ? this.chosenOpts || [] : d.options;
    if (!this.chosen) this.chosenOpts = d.options.slice();
    const n = opts.length;
    const x0 = MAIN.x + Math.floor((MAIN.w - n * CW - (n - 1) * CARD.gap) / 2);
    const time = this.app.time;
    opts.forEach((id, i) => {
      const j = JOSEKI_BY_ID[id];
      const p = Math.max(0, Math.min(1, (this.t - at(i)) / 0.26));
      const sx = Math.abs(1 - 2 * p);
      const x = x0 + i * (CW + CARD.gap), y = TOP;
      const uid = `draft:${i}`;
      ui.region(uid, x, y, CW, CH, { onClick: () => this.pick(i), preview: true, keys: () => [...j.families.map((f) => ({ id: `fam_${f}` })), j.text], tip: j.more ? () => tipLines(j.name, j.more) : null });
      const hov = ui.isHover(uid) && !this.chosen;
      const nw = Math.max(2, Math.round(CW * sx)), xx = x + Math.floor((CW - nw) / 2);
      if (p < 0.5) { box(ctx, xx, y, nw, CH, '#2a3a33', PAL.frameDk); if (nw > 30) rect(ctx, xx + Math.floor(nw / 2) - 8, y + CH / 2 - 8, 16, 16, TIER_COL[j.tier]); return; }
      const col = j.tier === 'rainbow' ? `hsl(${Math.floor(time * 120 + i * 60) % 360},70%,70%)` : TIER_COL[j.tier];
      const picked = this.chosen && this.chosen.i === i;
      const faded = this.chosen && !picked;
      if (faded) ctx.globalAlpha = 0.35;
      // 카드(물건 카드와 같은 자리): 등급 테 · 모서리 꺾쇠, 왼쪽 위 등급 → 이름 → 가로줄 → 효과 글 → 맨 아래 왼쪽 시너지 칩
      box(ctx, xx, y, nw, CH, PAL.card, picked ? PAL.white : hov ? PAL.gold : PAL.frameDk);
      rect(ctx, xx + 1, y + 1, nw - 2, 1, PAL.cardHi);
      frame(ctx, xx + 1, y + 1, nw - 2, CH - 2, col);
      if (j.tier !== 'silver') frame(ctx, xx + 2, y + 2, nw - 4, CH - 4, col);
      cornerTicks(ctx, xx + 3, y + 3, nw - 6, CH - 6, col, 3);
      if (hov) frame(ctx, xx, y, nw, CH, PAL.gold);
      if (nw < CW - 4) { ctx.globalAlpha = 1; return; }
      text(ctx, TIER_NAME[j.tier], x + PADJ, y + 4, j.tier === 'silver' ? PAL.cardDim : PAL.goldDk);
      const nl = wrap(j.name, CW - PADJ * 2, true).slice(0, 2);
      nl.forEach((l, k) => text(ctx, l, x + PADJ, y + 17 + (nl.length === 1 ? 6 : 0) + k * 13, PAL.cardInk, { bold: true }));
      rect(ctx, x + PADJ, y + 45, CW - PADJ * 2, 1, col);
      const chipsY = y + CH - 6 - chipRows(j.families, CW - PADJ * 2) * 13;
      wrap(j.text, CW - PADJ * 2).forEach((l, k) => { if (y + 48 + (k + 1) * CARD_ROW <= chipsY) richText(ctx, l, x + PADJ, y + 48 + k * CARD_ROW, PAL.cardInk, { ui, under: { onClick: () => this.pick(i) } }); });
      if (j.families.length) familyChips(ctx, j.families, x + PADJ, chipsY + 1, CW - PADJ * 2);
      if (picked) { const k = Math.min(1, (this.t - this.chosen.t) / 0.3); ctx.globalAlpha = 0.5 * (1 - k); rect(ctx, x, y, CW, CH, PAL.white); ctx.globalAlpha = 1; }
      ctx.globalAlpha = 1;
    });
    if (!this.chosen && this.t > 1.2) hint(this.app, 'draft', 'draft:1');
  }
  key(k) {
    if (/^[1-3]$/.test(k)) this.pick(Number(k) - 1);
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
