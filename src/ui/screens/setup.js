// 판 준비: 오프닝(해금된 것) · 단(이긴 단 + 1까지). 잠긴 오프닝은 「?」와 해금 과제.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite } from '../../render/gfx.js';
import { OPENINGS } from '../../data/openings.js';
import { DANS } from '../../sim/run.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { OPENING_ORDER, UNLOCKS, nextUnlock } from '../records.js';
import { pageHead } from './common.js';
import { PAGE, LINE } from '../frame.js';

export const danName = (d) => (d ? `${d}단` : '없음');

export class SetupScreen {
  constructor(app) {
    this.app = app;
    const rec = app.records;
    this.opening = rec.lastOpening && rec.unlocked.openings.includes(rec.lastOpening) ? rec.lastOpening : 'standard';
    this.dan = Math.min(rec.lastDan ?? rec.unlocked.dan, rec.unlocked.dan);
  }
  start() {
    const rec = this.app.records;
    rec.lastOpening = this.opening; rec.lastDan = this.dan;
    this.app.saveRecords();
    this.app.newRun({ opening: this.opening, dan: this.dan });
  }
  draw(ctx, ui) {
    const rec = this.app.records;
    pageHead(ctx, '새 판');
    text(ctx, '오프닝', 12, 32, PAL.dim);
    OPENING_ORDER.forEach((id, i) => {
      const op = OPENINGS[id];
      const open = rec.unlocked.openings.includes(id);
      const x = 12 + i * 92, y = 46, w = 86, h = 92;
      const sel = this.opening === id;
      const rid = `setup:op:${id}`;
      const unlock = UNLOCKS.find((u) => u.id === id);
      // 잠긴 오프닝은 카드가 해금 과제를 적는다(말풍선 없음)
      ui.region(rid, x, y, w, h, { enabled: open, onClick: () => { this.opening = id; this.app.sfx('pick'); } });
      box(ctx, x, y, w, h, open ? PAL.feltDk : PAL.felt, sel ? PAL.gold : ui.isHover(rid) && open ? PAL.goldDk : PAL.frameDk);
      if (sel) frame(ctx, x - 1, y - 1, w + 2, h + 2, PAL.gold);
      if (!open) {
        text(ctx, '?', x + w / 2, y + 16, PAL.dimDk, { align: 'center', bold: true, scale: 3 });
        wrap(unlock.text, w - 8).slice(0, 4).forEach((l, k) => text(ctx, l, x + w / 2, y + 48 + k * 11, PAL.dimDk, { align: 'center' }));
        return;
      }
      text(ctx, op.name, x + w / 2, y + 5, sel ? PAL.gold : PAL.ink, { align: 'center', bold: true });
      // 주머니 모습: 작은 기물 여덟(두 줄)
      op.bag.forEach((t, k) => sprite(ctx, t, 'w', x + 4 + (k % 4) * 20, y + 20 + Math.floor(k / 4) * 20));
      const extra = [];
      if (op.rules.hand) extra.push(`손 ${op.rules.hand}`);
      if (op.rules.moves) extra.push(`수 ${op.rules.moves}`);
      if (op.run.maximSlots) extra.push(`격언 칸 ${op.run.maximSlots}`);
      text(ctx, extra.join(' · '), x + w / 2, y + h - 16, PAL.gold, { align: 'center' });
    });
    // 단
    text(ctx, '단', 12, 148, PAL.dim);
    for (let d = 0; d <= 8; d++) {
      const open = d <= rec.unlocked.dan;
      button(ctx, ui, `setup:dan:${d}`, 12 + d * 50, 162, 46, 18, open ? danName(d) : '?', { enabled: open, tone: this.dan === d ? 'gold' : 'plain', onClick: () => { this.dan = d; this.app.sfx('pick'); } });
    }
    const rules = DANS.filter((x) => x.n <= this.dan).map((x) => x.text);
    wrap(rules.length ? rules.join(' · ') : '더하는 규칙 없음', W - 30).slice(0, 3).forEach((l, k) => text(ctx, l, 14, 188 + k * LINE.body, this.dan ? PAL.red : PAL.dim));
    const nu = nextUnlock(rec);
    if (nu) text(ctx, `다음 해금 ${OPENINGS[nu.id].name}: ${nu.text} (${nu.have}/${nu.need})`, 14, 230, PAL.dim);
    button(ctx, ui, 'setup:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '돌아가기', { onClick: () => this.app.go('title') });
    button(ctx, ui, 'setup:start', W - PAGE.titleX - 100, PAGE.btnY, 100, PAGE.btnH, '두기', { onClick: () => this.start(), tone: 'gold' });
  }
  key(k) {
    if (k === 'Enter') this.start();
    else if (k === 'Escape') this.app.go('title');
  }
}
