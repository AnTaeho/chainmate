// 명인의 상자: 다섯 칸 릴이 돌다가 왼쪽부터 멈춘다. 불 켜진 칸(가운데부터)에 물건이 선다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite } from '../../render/gfx.js';
import { CHARTS } from '../../data/charts.js';
import { ENGRAVING_BY_ID } from '../../data/engravings.js';
import { button } from '../ui.js';
import { PIECE_NAME } from '../words.js';
import { shardIcon } from '../parts.js';
import { LINE, GAP_GROUP, textY } from '../frame.js';

export function chestItemText(it) {
  if (!it) return '';
  if (it.kind === 'money') return `상금 +${it.money}`;
  if (it.kind === 'chart') return CHARTS[it.form].name;
  if (it.kind === 'engrave') return `${PIECE_NAME[it.piece]}에 ${ENGRAVING_BY_ID[it.eng].name} 각인`;
  if (it.kind === 'edition') return '판본';
  return '';
}

function drawItem(ctx, it, x, y) {
  if (it.kind === 'money') { rect(ctx, x + 4, y + 4, 12, 12, PAL.gold); rect(ctx, x + 6, y + 6, 8, 8, PAL.goldDk); text(ctx, '$', x + 10, y + 3, PAL.goldHi, { align: 'center', bold: true }); }
  else if (it.kind === 'chart') sprite(ctx, it.form, 'b', x + 2, y - 2);
  else if (it.kind === 'engrave') sprite(ctx, it.piece, 'w', x + 2, y - 2, { eng: it.eng });
  else shardIcon(ctx, x + 2, y + 2);
}
const SPIN = [{ kind: 'money', money: 2 }, { kind: 'chart', form: 'N' }, { kind: 'engrave', piece: 'P', eng: 'gold' }, { kind: 'chart', form: 'Q' }, { kind: 'chart', form: 'R' }];

export class ChestScreen {
  constructor(app, { chest }) {
    this.app = app;
    this.chest = chest;
    this.t = 0;
    this.stopped = 0;
    this.flash = 0;
    app.sfx('chestOpen');
  }
  stopAt(i) { return 0.9 + i * 0.42; }
  update(dt) {
    this.t += dt * this.app.speed();
    const n = this.chest.cells.length;
    while (this.stopped < n && this.t >= this.stopAt(this.stopped)) {
      const cell = this.chest.cells[this.stopped];
      this.app.sfx(cell.lit ? 'reelLit' : 'reelStop', this.stopped);
      this.stopped++;
      if (this.stopped === n) {
        if (this.chest.count >= 5) { this.flash = 1.2; this.app.sfx('fanfare'); this.app.shake(3, 0.4); }
        else if (this.chest.count >= 3) { this.flash = 0.5; this.app.sfx('sparkle'); }
      }
    }
    if (this.flash > 0) this.flash -= dt;
  }
  draw(ctx, ui) {
    const c = this.chest;
    const x0 = 90, y = 56, cw = 56, ch = 64, gap = 4;
    text(ctx, '마스터의 상자', W / 2, 22, PAL.gold, { align: 'center', bold: true, scale: 2 });
    box(ctx, x0 - 8, y - 8, 5 * cw + 4 * gap + 16, ch + 16, PAL.frame, PAL.frameDk);
    c.cells.forEach((cell, i) => {
      const x = x0 + i * (cw + gap);
      const done = i < this.stopped;
      const lit = done && cell.lit;
      box(ctx, x, y, cw, ch, lit ? PAL.card : PAL.feltDk, lit ? PAL.gold : PAL.frameDk);
      if (!done) {
        const k = Math.floor(this.t * 14 + i * 3);
        const it = SPIN[k % SPIN.length];
        const off = Math.floor((this.t * 14 * 16) % 16);
        ctx.globalAlpha = 0.6;
        drawItem(ctx, it, x + 18, y + 18 + off - 8);
        ctx.globalAlpha = 1;
        rect(ctx, x + 1, y + 1, cw - 2, 6, PAL.feltDk); rect(ctx, x + 1, y + ch - 7, cw - 2, 6, PAL.feltDk);
      } else if (lit) {
        ui.region(`chest:cell:${i}`, x, y, cw, ch, { keys: [chestItemText(cell.item)] });
        drawItem(ctx, cell.item, x + 18, y + 16);
        frame(ctx, x - 1, y - 1, cw + 2, ch + 2, PAL.gold);
      } else {
        text(ctx, '·', x + cw / 2, y + 24, PAL.dimDk, { align: 'center', bold: true });
      }
    });
    if (this.stopped >= c.cells.length) {
      const items = c.cells.filter((x) => x.lit).map((x) => chestItemText(x.item));
      // 칸 수(다섯이면 두 배) → 묶음 틈 → 받은 것 한 줄씩(본문 줄)
      const cy = y + ch + 8 + GAP_GROUP, big = c.count >= 5;
      text(ctx, c.count >= 5 ? '다섯 칸!' : c.count >= 3 ? '세 칸' : '한 칸', W / 2, big ? cy : textY(cy), c.count >= 3 ? PAL.gold : PAL.ink, { align: 'center', bold: true, scale: big ? 2 : 1 });
      const iy = cy + (big ? LINE * 2 : LINE) + GAP_GROUP;
      items.forEach((s, k) => text(ctx, s, W / 2, textY(iy + k * LINE), PAL.ink, { align: 'center' }));
    }
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.5);
      rect(ctx, 0, 0, W, H, PAL.gold);
      ctx.globalAlpha = 1;
    }
    button(ctx, ui, 'next', W / 2 - 40, H - 28, 80, 18, '계속', { onClick: () => this.next(), tone: 'gold' });
  }
  next() {
    if (this.stopped < this.chest.cells.length) { this.t = 99; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); }
}
