// 정석 고르기(깊이 E): 1 · 3 · 5관의 첫 대국 앞. 카드 셋이 차례로 뒤집히며 나오고(등급 빛: 은 · 금 · 무지개) 하나를 고른다.
import { sway } from '../sway.js';
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { familyChips, chipRows, chipBlockH } from '../parts-depth.js';
import { cardBase, tipLines, CARD_CHIP_ROWS } from '../parts.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, PAD_CARD, GAP_IN, GAP_GROUP, flow } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const TIER_NAME = { silver: '은', gold: '금', rainbow: '무지개' };
const CW = CARD.w;
// 정석 카드 쌓기(재기와 그리기가 같이 쓴다 — PAD_CARD): 등급(머릿말) → 묶음 안 틈 → 이름(제목 줄) → 묶음 틈(가운데 가로줄) → 효과 글 → 묶음 틈 → 시너지 칩
function josekiLayout(j, w = CW) {
  const P = PAD_CARD, IW = w - P * 2, f = flow(P);
  const tier = f.line();
  f.gap(GAP_IN);
  const names = wrap(j.name, IW, true).map((l) => [l, f.line(true)]);
  const rule = f.y + Math.floor(GAP_GROUP / 2);
  f.gap(GAP_GROUP);
  const lines = wrap(j.text, IW).map((l) => [l, f.line()]);
  let chips = null;
  if (j.families.length) { f.gap(GAP_GROUP); chips = f.space(chipBlockH(chipRows(j.families, IW, CARD_CHIP_ROWS))); }
  return { IW, tier, names, rule, lines, chips, h: f.y + P };
}
export const josekiCardH = (ids) => Math.max(0, ...ids.map((id) => josekiLayout(JOSEKI_BY_ID[id]).h));
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
    runSide(ctx, ui, this.app, '레퍼토리');
    pauseButton(ctx, ui, this.app);
    if (!d) return;
    const opts = this.chosen ? this.chosenOpts || [] : d.options;
    if (!this.chosen) this.chosenOpts = d.options.slice();
    const n = opts.length;
    const x0 = MAIN.x + Math.floor((MAIN.w - n * CW - (n - 1) * CARD.gap) / 2);
    const time = this.app.time;
    const CH = josekiCardH(opts);
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
      // 흔들림(sway.js): 다 뒤집힌 레퍼토리 카드는 숨 쉬고, 가리키면 기울며 들린다. 고른 뒤에는 멈춘다
      sway(ctx, time, `${uid}:${id}`, x, y, CW, CH, (c) => this.drawCard(c, ui, j, i, x, y, xx, nw, CH, col, hov, picked, faded, id), { hover: hov, press: hov && ui.press && ui.press.id === uid, mx: ui.mouse.x, still: p < 1 || !!this.chosen, shadow: p >= 1 && !faded });
    });
    // 안내는 왼쪽 칸에서 오른쪽을 가리키므로 바로 옆 첫 카드에(정석 고르기 전체에 대한 한 줄)
    if (!this.chosen && this.t > 1.2) hint(this.app, 'draft', 'draft:0');
  }
  drawCard(ctx, ui, j, i, x, y, xx, nw, CH, col, hov, picked, faded, id) {
    {
      if (faded) ctx.globalAlpha = 0.35;
      // 카드(물건 카드와 같은 자리): 등급 테 · 모서리 꺾쇠, 왼쪽 위 등급 → 이름 → 가로줄 → 효과 글 → 맨 아래 왼쪽 시너지 칩
      cardBase(ctx, xx, y, nw, CH, { hover: hov, edge: col, double: j.tier !== 'silver', ticks: true, line: picked ? PAL.white : PAL.frameDk });
      if (nw < CW - 4) { ctx.globalAlpha = 1; return; }
      const lay = josekiLayout(j), P = PAD_CARD;
      openBox('card', x, y, CW, CH, P, { name: `레퍼토리 ${id}` });
      text(ctx, TIER_NAME[j.tier], x + P, y + lay.tier, j.tier === 'silver' ? PAL.cardDim : PAL.goldDk);
      for (const [l, ly] of lay.names) text(ctx, l, x + P, y + ly, PAL.cardInk, { bold: true });
      rect(ctx, x + P, y + lay.rule, lay.IW, 1, col);
      for (const [l, ly] of lay.lines) richText(ctx, l, x + P, y + ly, PAL.cardInk, { ui, under: { onClick: () => this.pick(i) } });
      if (lay.chips != null) familyChips(ctx, j.families, x + P, y + lay.chips + (CH - lay.h), lay.IW, CARD_CHIP_ROWS);
      closeBox();
      if (picked) { const k = Math.min(1, (this.t - this.chosen.t) / 0.3); ctx.globalAlpha = 0.5 * (1 - k); rect(ctx, x, y, CW, CH, PAL.white); ctx.globalAlpha = 1; }
      ctx.globalAlpha = 1;
    }
  }
  key(k) {
    if (/^[1-3]$/.test(k)) this.pick(Number(k) - 1);
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
