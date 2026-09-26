// 관 선택: 연습 · 정식 · 명인 세 장. 목표 · 보상 · 명인 규칙 · 건너뛰면 받는 패. 「두기」 / 「건너뛰기」.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, num, frame } from '../../render/gfx.js';
import { blindInfo, REWARD } from '../../sim/run.js';
import { MASTER_BY_ID } from '../../data/masters.js';
import { CHARTS } from '../../data/charts.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { topBar } from './common.js';
import { fragmentStrip } from '../parts.js';

export const tagText = (tag) => (tag.kind === 'money' ? `상금 +${tag.amount}` : tag.kind === 'chart' ? `${CHARTS[tag.form].name} 한 장` : '');

export class SelectScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    topBar(ctx, ui, app, `${run.ante}관`);
    fragmentStrip(ctx, ui, run, 60, 8);
    for (let i = 0; i < 3; i++) {
      const info = blindInfo(run, run.ante, i);
      const x = 22 + i * 148, y = 34, w = 140, h = 196;
      const cur = i === run.blind;
      const past = i < run.blind;
      const log = run.log.find((l) => l.ante === run.ante && l.blind === i);
      const master = info.kind === 'master';
      const edge = cur ? (master ? PAL.red : PAL.gold) : PAL.frameDk;
      box(ctx, x, y, w, h, cur ? PAL.feltDk : PAL.felt, edge);
      if (cur) frame(ctx, x - 1, y - 1, w + 2, h + 2, edge);
      const ink = cur ? PAL.ink : PAL.dim;
      text(ctx, KIND_NAME[info.kind], x + w / 2, y + 8, master ? PAL.red : cur ? PAL.gold : PAL.dim, { align: 'center', bold: true });
      text(ctx, '목표', x + 10, y + 30, PAL.dim);
      text(ctx, num(info.target), x + w - 10, y + 30, ink, { align: 'right', bold: true });
      text(ctx, '이기면', x + 10, y + 46, PAL.dim);
      text(ctx, `$${REWARD.base[info.kind]}`, x + w - 10, y + 46, PAL.gold, { align: 'right', bold: true });
      rect(ctx, x + 8, y + 64, w - 16, 1, PAL.frameDk);
      if (master) {
        const m = MASTER_BY_ID[info.master];
        text(ctx, `명인 ${m.name}`, x + 10, y + 72, PAL.red, { bold: true });
        wrap(m.text, w - 20).forEach((l, k) => text(ctx, l, x + 10, y + 88 + k * 13, ink));
        text(ctx, '이기면 명인의 상자', x + 10, y + 140, PAL.goldDk);
      } else {
        text(ctx, '건너뛰면', x + 10, y + 72, PAL.dim);
        wrap(tagText(info.tag), w - 20).forEach((l, k) => text(ctx, l, x + 10, y + 88 + k * 13, cur ? PAL.gold : PAL.dim, { bold: true }));
      }
      if (past) {
        text(ctx, log && log.skipped ? '건너뜀' : '이김', x + w / 2, y + h - 26, PAL.dim, { align: 'center', bold: true });
      } else if (cur) {
        if (master) button(ctx, ui, 'select:play', x + 20, y + h - 30, w - 40, 20, '두기', { onClick: () => this.play(), tone: 'red' });
        else {
          button(ctx, ui, 'select:play', x + 8, y + h - 30, 60, 20, '두기', { onClick: () => this.play(), tone: 'gold' });
          button(ctx, ui, 'select:skip', x + 72, y + h - 30, 60, 20, '건너뛰기', { onClick: () => this.skip() });
        }
      }
    }
  }
  play() {
    const ev = this.app.cmd({ type: 'play' });
    this.app.sfx('start');
    this.app.go('battle', { events: ev });
  }
  skip() {
    const ev = this.app.cmd({ type: 'skip' });
    const s = ev.find((e) => e.type === 'skip');
    if (s) this.app.toast(`건너뜀 · ${tagText(s.tag)}`, PAL.gold);
    this.app.sfx('coin');
    this.app.goPhase();
  }
  key(k) {
    if (k === 'Enter' || k === ' ') this.play();
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
