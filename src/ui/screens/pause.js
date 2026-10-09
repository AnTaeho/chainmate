// 일시정지(덮개): 계속 · 설정 · 타이틀로.
import { PAL } from '../../render/palette.js';
import { W, text, box } from '../../render/gfx.js';
import { button } from '../ui.js';
import { PAD_BOX, GAP_GROUP, flow } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

export class PauseScreen {
  constructor(app) { this.app = app; }
  // 멈춤 동안은 뒤 화면의 연출 시계도 멈춘다(대국 연출이 덮개 밑에서 흘러가던 것)
  update() {}
  draw(ctx, ui) {
    const app = this.app;
    // 막간 상자(hug): 제목(제목 줄) → 묶음 틈 → 단추 셋(사이 묶음 틈)
    const f = flow(PAD_BOX), ty = f.line(true);
    const ids = [['pause:resume', '계속', () => app.closeOverlay(), 'gold'], ['pause:settings', '설정', () => app.openOverlay('settings', { back: 'pause' }), 'plain'], ['pause:title', '메인 화면으로', () => app.toTitle(), 'plain']];
    const ys = ids.map(() => f.gap(GAP_GROUP).space(18));
    const w = 140, h = f.y + PAD_BOX, x = Math.floor((W - w) / 2), y = Math.floor((270 - h) / 2);
    openBox('panel', x, y, w, h, PAD_BOX, { name: '멈춤' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '멈춤', W / 2, y + ty, PAL.gold, { align: 'center', bold: true });
    ids.forEach(([id, label, fn, tone], i) => button(ctx, ui, id, x + 20, y + ys[i], w - 40, 18, label, { onClick: fn, tone }));
    closeBox();
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.closeOverlay(); }
}
