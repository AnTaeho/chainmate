// 일시정지(덮개): 계속 · 설정 · 타이틀로.
import { PAL } from '../../render/palette.js';
import { W, text, box } from '../../render/gfx.js';
import { button } from '../ui.js';

export class PauseScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const app = this.app;
    const x = 170, y = 70, w = 140, h = 124;
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '멈춤', W / 2, y + 8, PAL.gold, { align: 'center', bold: true });
    button(ctx, ui, 'pause:resume', x + 20, y + 32, w - 40, 18, '계속', { onClick: () => app.closeOverlay(), tone: 'gold' });
    button(ctx, ui, 'pause:settings', x + 20, y + 58, w - 40, 18, '설정', { onClick: () => app.openOverlay('settings', { back: 'pause' }) });
    button(ctx, ui, 'pause:title', x + 20, y + 84, w - 40, 18, '타이틀로', { onClick: () => app.toTitle() });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.closeOverlay(); }
}
