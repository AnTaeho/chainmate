// 대국 승리: 보상이 한 줄씩(기본 · 남은 수 · 적립 · 외통 · 넘친 목표 · 대국 중 번 상금) 쌓인다.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, num } from '../../render/gfx.js';
import { button } from '../ui.js';

export class RewardScreen {
  constructor(app, { reward, events = [] }) {
    this.app = app;
    this.t = 0;
    const r = reward;
    const last = app.run.last || {};
    this.last = last;
    this.lines = [['대국 기본', r.base]];
    if (r.moves) this.lines.push([`남은 수 ${r.moves}`, r.moves]);
    if (r.interest) this.lines.push(['적립', r.interest]);
    if (r.mate) this.lines.push(['외통', r.mate]);
    if (r.overflow) this.lines.push([`넘친 목표 ×${last.overflow}`, r.overflow]);
    if (r.earned) this.lines.push(['대국 중 번 상금', r.earned]);
    this.total = r.total;
    this.gold = events.some((e) => e.type === 'goldenPack');
    this.shown = 0;
    this.step = 0.32;
  }
  update(dt) {
    this.t += dt * this.app.speed();
    const n = Math.min(this.lines.length + 1, Math.floor(this.t / this.step));
    while (this.shown < n) {
      this.shown++;
      const line = this.lines[this.shown - 1];
      // 한 줄의 상금이 한 개씩 동전 소리로(최대 여섯)
      this.coins = (this.coins || 0) + (line ? Math.min(6, line[1]) : 0);
      if (!line) this.app.sfx('coin', 8);
    }
    this.coinT = (this.coinT || 0) - dt * this.app.speed();
    if (this.coins > 0 && this.coinT <= 0) { this.coins--; this.coinT = 0.05; this.app.sfx('coin', this.coinN = (this.coinN || 0) + 1); }
  }
  draw(ctx, ui) {
    const app = this.app, last = this.last;
    const x = 120, y = 24, w = 240, h = 222;
    box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
    text(ctx, last.reason === 'mate' ? '외통 승리' : '대국 승리', W / 2, y + 10, PAL.gold, { align: 'center', bold: true, scale: 2 });
    text(ctx, `점수 ${num(last.score || 0)} / 목표 ${num(last.target || 0)}`, W / 2, y + 40, PAL.ink, { align: 'center' });
    this.lines.forEach(([label, v], i) => {
      if (i >= this.shown) return;
      const yy = y + 62 + i * 16;
      text(ctx, label, x + 20, yy, PAL.dim);
      text(ctx, `$${v}`, x + w - 20, yy, PAL.gold, { align: 'right', bold: true });
    });
    if (this.shown > this.lines.length) {
      const yy = y + 66 + this.lines.length * 16;
      rect(ctx, x + 16, yy - 3, w - 32, 1, PAL.frameHi);
      text(ctx, '합', x + 20, yy + 2, PAL.ink, { bold: true });
      text(ctx, `$${this.total}`, x + w - 20, yy + 2, PAL.gold, { align: 'right', bold: true });
      text(ctx, `상금 $${app.run.money}`, W / 2, yy + 22, PAL.ink, { align: 'center' });
      if (this.gold) text(ctx, '금빛 꾸러미가 상점에 나왔다', W / 2, yy + 38, PAL.gold, { align: 'center', bold: true });
    }
    button(ctx, ui, 'next', W / 2 - 40, y + h - 26, 80, 18, '계속', { onClick: () => this.next(), tone: 'gold' });
  }
  next() {
    if (this.shown <= this.lines.length) { this.t = 99; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); else if (k === 'Escape') this.app.openOverlay('pause'); }
}
