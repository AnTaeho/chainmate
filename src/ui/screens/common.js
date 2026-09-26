// 화면 위쪽 띠: 제목 · 상금 · 멈춤 단추
import { PAL } from '../../render/palette.js';
import { W, text, rect } from '../../render/gfx.js';

export function pauseButton(ctx, ui, app, x = W - 18, y = 5) {
  const id = 'btn:pause';
  ui.region(id, x - 2, y - 2, 16, 14, { onClick: () => app.openOverlay('pause') });
  const col = ui.isHover(id) ? PAL.gold : PAL.dim;
  rect(ctx, x + 1, y + 1, 10, 2, col); rect(ctx, x + 1, y + 5, 10, 2, col); rect(ctx, x + 1, y + 9, 10, 2, col);
}

export function topBar(ctx, ui, app, title) {
  const run = app.run;
  text(ctx, title, 12, 8, PAL.gold, { bold: true });
  text(ctx, `$${run.money}`, W - 30, 8, PAL.gold, { bold: true, align: 'right' });
  pauseButton(ctx, ui, app);
  rect(ctx, 8, 25, W - 16, 1, PAL.feltHi);
}
