// 타이틀: 큰 도트 글자, 새 판 · 이어 하기 · 설정. 뒤로 기물이 천천히 떨어지며 갈아입는다.
import { PAL } from '../../render/palette.js';
import { W, H, text, sprite, rect } from '../../render/gfx.js';
import { button } from '../ui.js';

const TYPES = ['P', 'N', 'B', 'R', 'Q', 'K'];

export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.seed = 12345;
    this.drops = [];
    for (let i = 0; i < 14; i++) this.drops.push(this.spawn(true));
  }
  rnd() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  spawn(anywhere = false) {
    return {
      x: Math.floor(this.rnd() * (W - 16)),
      y: anywhere ? Math.floor(this.rnd() * H) - 22 : -24,
      v: 6 + this.rnd() * 10,
      t: TYPES[Math.floor(this.rnd() * 6)],
      side: this.rnd() < 0.5 ? 'w' : 'b',
      flip: 0, next: 1 + this.rnd() * 4,
    };
  }
  update(dt) {
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.next -= dt;
      if (d.flip > 0) {
        d.flip -= dt;
        if (d.flip <= 0.1 && !d.swapped) { d.t = d.to; d.swapped = true; }
      } else if (d.next <= 0) {
        d.to = TYPES[Math.floor(this.rnd() * 6)];
        d.flip = 0.2; d.swapped = false; d.next = 2 + this.rnd() * 4;
      }
    }
    this.drops = this.drops.map((d) => (d.y > H + 4 ? this.spawn() : d));
  }
  draw(ctx, ui) {
    const app = this.app;
    for (const d of this.drops) {
      const sx = d.flip > 0 ? Math.abs(d.flip - 0.1) / 0.1 : 1;
      sprite(ctx, d.t, d.flip > 0 ? 's' : d.side, d.x, Math.round(d.y), { alpha: 0.28, sx });
    }
    text(ctx, '체인메이트', W / 2, 44, PAL.goldDk, { align: 'center', bold: true, scale: 3 });
    text(ctx, '체인메이트', W / 2, 42, PAL.gold, { align: 'center', bold: true, scale: 3, shadow: null });
    text(ctx, '잡으면 그것이 된다', W / 2, 92, PAL.ink, { align: 'center' });
    const has = app.hasSave();
    const items = [];
    if (has) items.push(['title:continue', '이어 하기', () => app.continueRun(), 'gold']);
    items.push(['title:new', '새 판', () => app.go('setup'), has ? 'plain' : 'gold']);
    items.push(['title:daily', '오늘의 대국', () => app.newRun({ daily: true }), 'plain']);
    items.push(['title:codex', '도감', () => app.go('codex'), 'plain']);
    items.push(['title:records', '기록', () => app.go('records'), 'plain']);
    items.push(['title:settings', '설정', () => app.openOverlay('settings'), 'plain']);
    const bw = 120, bh = 16, x = (W - bw) / 2;
    items.forEach(([id, label, fn, tone], i) => button(ctx, ui, id, x, 116 + i * 21, bw, bh, label, { onClick: fn, tone }));
    rect(ctx, 0, H - 1, W, 1, PAL.feltDk);
  }
  key(k) {
    if (k === 'Enter' || k === ' ') { if (!this.app.continueRun()) this.app.go('setup'); }
  }
}
