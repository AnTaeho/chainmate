// 관 선택: 연습 · 정식 · 명인 세 장. 목표 · 보상 · 명인 규칙 · 건너뛰면 받는 패. 「두기」 / 「건너뛰기」.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, num, frame, measure } from '../../render/gfx.js';
import { blindInfo, REWARD, ANTES } from '../../sim/run.js';
import { MASTER_BY_ID, FINAL_MASTER } from '../../data/masters.js';
import { CHARTS } from '../../data/charts.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { topBar } from './common.js';
import { fragmentStrip, tipLines } from '../parts.js';
import { drawPortrait } from '../../render/portraits.js';

// 마지막 관(대가)의 왕관 9×7
const CROWN = ['#...#...#', '##..#..##', '##.###.##', '#########', '#########', '.........', '#########'];

// 판의 길: 1관~8관 구슬, 8관은 왕관. 지난 관은 금빛, 지금 관은 밝게 숨 쉬고, 남은 관은 흐리게
export function antePath(ctx, ui, run, cx, y, time) {
  if (run.endless) { text(ctx, `끝없는 대국 ${run.ante}관`, cx, y, PAL.gold, { align: 'center', bold: true }); return; }
  const label = `${run.ante}관 / ${ANTES}관`;
  const step = 14, pw = 8, cw = CROWN[0].length;
  const trackW = (ANTES - 1) * step + cw;
  const lw = measure(label, true);
  const x0 = Math.round(cx - (lw + 10 + trackW) / 2);
  text(ctx, label, x0, y, PAL.ink, { bold: true });
  const px = x0 + lw + 10, py = y + 2;
  rect(ctx, px + 4, py + 4, (ANTES - 1) * step, 1, PAL.feltHi);
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  for (let i = 0; i < ANTES; i++) {
    const a = i + 1, x = px + i * step;
    const done = a < run.ante, cur = a === run.ante;
    if (a === ANTES) {
      const col = done ? PAL.gold : cur ? PAL.red : PAL.redDk;
      if (cur) { ctx.globalAlpha = 0.35 + 0.35 * pulse; rect(ctx, x - 2, py - 3, cw + 4, CROWN.length + 4, PAL.red); ctx.globalAlpha = 1; }
      CROWN.forEach((row, j) => { for (let k = 0; k < cw; k++) if (row[k] === '#') rect(ctx, x + k, py - 1 + j, 1, 1, col); });
      continue;
    }
    if (done) box(ctx, x, py, pw, pw, PAL.gold, PAL.goldDk);
    else if (cur) {
      box(ctx, x, py, pw, pw, PAL.goldHi, PAL.gold);
      ctx.globalAlpha = 0.3 + 0.5 * pulse; frame(ctx, x - 2, py - 2, pw + 4, pw + 4, PAL.goldHi); ctx.globalAlpha = 1;
    } else box(ctx, x, py, pw, pw, PAL.feltDk, PAL.dimDk);
  }
  const fm = MASTER_BY_ID[FINAL_MASTER];
  ui.region('select:path', x0, y - 2, lw + 10 + trackW, 16, { tip: () => tipLines(`${ANTES}관 · ${fm.name}`, '꺾으면 판을 이긴다'), tipAt: { x: Math.round(cx - 75), y: y - 56 } });
}

export const tagText = (tag) => (tag.kind === 'money' ? `상금 +${tag.amount}` : tag.kind === 'chart' ? `${CHARTS[tag.form].name} 한 장` : '');

export class SelectScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    topBar(ctx, ui, app, `${run.ante}관`);
    fragmentStrip(ctx, ui, run, 60, 8);
    antePath(ctx, ui, run, W / 2, 242, app.time);
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
      text(ctx, master ? `$${REWARD.base[info.kind]} + 상자` : `$${REWARD.base[info.kind]}`, x + w - 10, y + 46, PAL.gold, { align: 'right', bold: true });
      rect(ctx, x + 8, y + 64, w - 16, 1, PAL.frameDk);
      if (master) {
        const m = MASTER_BY_ID[info.master];
        box(ctx, x + w - 44, y + 68, 36, 36, PAL.felt, cur ? PAL.red : PAL.frameDk);
        drawPortrait(ctx, info.master, x + w - 42, y + 70, 1, cur ? 1 : 0.6);
        wrap(`명인 ${m.name}`, w - 60, true).slice(0, 2).forEach((l, k) => text(ctx, l, x + 10, y + 72 + k * 13, PAL.red, { bold: true }));
        wrap(m.text, w - 20).slice(0, 4).forEach((l, k) => text(ctx, l, x + 10, y + 108 + k * 13, ink));
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
