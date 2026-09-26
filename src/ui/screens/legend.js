// 전설 완성: 명국 이름 · 해 · 이야기 · 전설 효과. 금박 격언이 여섯째 칸에 들어온다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame } from '../../render/gfx.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';

export class LegendScreen {
  constructor(app, { legend }) {
    this.app = app;
    this.l = LEGEND_BY_ID[legend];
    this.t = 0;
    app.sfx('legend');
  }
  update(dt) { this.t += dt * this.app.speed(); }
  draw(ctx, ui) {
    const l = this.l;
    const k = Math.min(1, this.t / 0.6);
    ctx.globalAlpha = 0.25 * k; rect(ctx, 0, 0, W, H, PAL.gold); ctx.globalAlpha = 1;
    text(ctx, '불멸의 기보', W / 2, 18, PAL.goldDk, { align: 'center', bold: true });
    text(ctx, l.name, W / 2, 36, PAL.gold, { align: 'center', bold: true, scale: 2, shadow: PAL.shadow });
    if (l.year) text(ctx, String(l.year), W / 2, 64, PAL.dim, { align: 'center' });
    wrap(l.story, 300).forEach((s, i) => text(ctx, s, W / 2, 82 + i * 14, PAL.ink, { align: 'center' }));
    const y = Math.round(118 + (1 - Math.min(1, this.t / 0.9)) * -80);
    box(ctx, 150, y, 180, 80, '#f6d98a', PAL.frameDk);
    rect(ctx, 151, y + 1, 178, 1, PAL.goldHi);
    frame(ctx, 149, y - 1, 182, 82, PAL.gold);
    text(ctx, l.name, W / 2, y + 6, PAL.cardInk, { align: 'center', bold: true });
    wrap(l.text, 168).forEach((s, i) => text(ctx, s, W / 2, y + 24 + i * 13, PAL.cardDim, { align: 'center' }));
    button(ctx, ui, 'next', W / 2 - 40, H - 30, 80, 18, '계속', { onClick: () => this.app.next(), tone: 'gold' });
  }
  key(k) { if (k === 'Enter' || k === ' ') this.app.next(); }
}
