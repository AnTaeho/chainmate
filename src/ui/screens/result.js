// 판 결과: 이김/짐, 도달 관, 최고 한 수, 목표에 모자란 점수(아슬아슬), 모은 조각. 「다시」 / 「타이틀」.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, num } from '../../render/gfx.js';
import { LEGENDS } from '../../data/legends.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { shardIcon } from '../parts.js';
import { OPENINGS } from '../../data/openings.js';
import { nextUnlock } from '../records.js';

export class ResultScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    const run = app.run;
    this.won = run.phase === 'won';
    const played = run.log.filter((l) => !l.skipped);
    this.best = played.reduce((a, l) => Math.max(a, l.best || 0), 0);
    const last = played[played.length - 1];
    this.last = last;
    this.short = !this.won && last && last.target ? Math.max(0, last.target - last.score) : 0;
    this.pct = last && last.target ? Math.floor((last.score / last.target) * 100) : 0;
    app.sfx(this.won ? 'fanfare' : 'lose');
    this.out = app.finishRun() || { unlocked: [], dan: null, fresh: 0 };
    this.next = nextUnlock(app.records);
  }
  update(dt) { this.t += dt; }
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    const x = 90, y = 16, w = 300, h = 238;
    box(ctx, x, y, w, h, PAL.feltDk, this.won ? PAL.gold : PAL.red);
    text(ctx, this.won ? '여덟 관을 꺾었다' : '판이 끝났다', W / 2, y + 10, this.won ? PAL.gold : PAL.red, { align: 'center', bold: true, scale: 2 });
    const rows = [];
    if (this.last) rows.push(['도달', `${run.ante}관 ${KIND_NAME[this.last.kind]}`]);
    rows.push(['최고 한 수', num(this.best)]);
    if (!this.won && this.last) {
      rows.push(['마지막 대국', `${num(this.last.score)} / ${num(this.last.target)}`]);
      if (this.short > 0) rows.push(['모자란 점수', `${num(this.short)} (${this.pct}%)`]);
    }
    rows.push(['상금', `$${run.money}`]);
    rows.forEach(([a, b], i) => {
      text(ctx, a, x + 24, y + 46 + i * 16, PAL.dim);
      text(ctx, b, x + w - 24, y + 46 + i * 16, i === 3 && this.short > 0 ? PAL.red : PAL.ink, { align: 'right', bold: true });
    });
    // 조각
    const yy = y + 52 + rows.length * 16;
    const got = LEGENDS.filter((l) => run.fragments[l.id] && (run.fragments[l.id].first || run.fragments[l.id].feat || run.fragments[l.id].gold));
    if (got.length) {
      text(ctx, '모은 조각', x + 24, yy, PAL.dim);
      got.forEach((l, i) => {
        const f = run.fragments[l.id];
        const n = (f.first ? 1 : 0) + (f.feat ? 1 : 0) + (f.gold ? 1 : 0);
        const yl = yy + 16 + i * 16;
        text(ctx, l.name, x + 24, yl, run.legends.includes(l.id) ? PAL.gold : PAL.ink);
        for (let k = 0; k < 3; k++) {
          if (k < n) shardIcon(ctx, x + w - 80 + k * 20, yl, PAL.gold, PAL.goldDk);
          else rect(ctx, x + w - 78 + k * 20, yl + 4, 10, 6, PAL.frame);
        }
      });
    }
    // 판 밖에 남은 것: 새 도감 칸 · 해금 · 다음 해금까지
    const ny = y + h - 64;
    const notes = [];
    if (this.out.fresh) notes.push([`도감 ${this.out.fresh}칸을 새로 채웠다`, PAL.ink]);
    for (const id of this.out.unlocked) notes.push([`오프닝 「${OPENINGS[id].name}」이 열렸다`, PAL.gold]);
    if (this.out.dan) notes.push([`${this.out.dan}단이 열렸다`, PAL.gold]);
    if (!this.out.unlocked.length && this.next) notes.push([`다음 해금 ${OPENINGS[this.next.id].name}: ${this.next.text} ${this.next.have}/${this.next.need}`, PAL.dim]);
    if (run.daily) notes.push([`오늘의 대국 ${run.daily}`, PAL.goldDk]);
    notes.slice(-3).forEach(([s, c], i) => text(ctx, s, W / 2, ny - (notes.slice(-3).length - 1 - i) * 14, c, { align: 'center' }));
    const by = y + h - 28;
    if (this.won) {
      button(ctx, ui, 'result:endless', x + 20, by, 80, 18, '계속 두기', { onClick: () => this.endless() });
      button(ctx, ui, 'result:again', x + 110, by, 80, 18, '다시', { onClick: () => this.again(), tone: 'gold' });
      button(ctx, ui, 'result:title', x + 200, by, 80, 18, '타이틀', { onClick: () => app.toTitle() });
    } else {
      button(ctx, ui, 'result:again', x + 50, by, 90, 18, '다시', { onClick: () => this.again(), tone: 'gold' });
      button(ctx, ui, 'result:title', x + 160, by, 90, 18, '타이틀', { onClick: () => app.toTitle() });
    }
  }
  again() { const r = this.app.run; this.app.newRun({ opening: r.opening, dan: r.dan, daily: !!r.daily }); }
  endless() { this.app.cmd({ type: 'endless' }); this.app.goPhase(); }
  key(k) { if (k === 'Enter') this.again(); else if (k === 'Escape') this.app.toTitle(); }
}
