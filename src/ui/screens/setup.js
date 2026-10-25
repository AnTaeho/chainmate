// 판 준비: 오프닝(해금된 것) · 레이팅(내부 값은 단 0~8 — 이긴 단 + 1까지, 화면은 800 + 200 × 단). 잠긴 오프닝은 「?」와 해금 과제.
import { PAL } from '../../render/palette.js';
import { W, text, box, slot, selectGlow, selectRing, sprite, measure, R_LG } from '../../render/gfx.js';
import { OPENINGS } from '../../data/openings.js';
import { DANS } from '../../sim/run.js';
import { wrap } from '../../render/text.js';
import { buttonRow } from '../ui.js';
import { OPENING_ORDER, UNLOCKS, nextUnlock } from '../records.js';
import { pageHead, bottomBar } from './common.js';
import { PAGE, LINE, PAD_CARD, GAP_IN, GAP_GROUP, BTN_H, SP, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

// 단 → 레이팅(표시만). 저장 · 규칙은 단 0~8 그대로
export const rating = (d) => 800 + 200 * (d || 0);
export const danName = (d) => `${rating(d)}`;

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
  // 오프닝 카드 쌓기(PAD_CARD): 열린 카드는 이름(제목 줄) → 묶음 틈 → 덱 모습(두 줄) → 묶음 틈 → 더하는 것,
  // 잠긴 카드는 「?」(두 배, 줄 28) → 묶음 틈 → 해금 과제 글. 다섯 카드는 가장 긴 카드의 높이
  cardLayout(id, w) {
    const open = this.app.records.unlocked.openings.includes(id);
    const P = PAD_CARD, f = flow(P);
    if (!open) {
      const q = f.space(28);
      f.gap(GAP_GROUP);
      const lines = wrap(UNLOCKS.find((u) => u.id === id).text, w - P * 2).map((l) => [l, f.line()]);
      return { open, q, lines, h: f.y + P };
    }
    const op = OPENINGS[id], IW = w - P * 2;
    const names = wrap(op.name, IW, true).map((l) => [l, f.line(true)]);
    f.gap(GAP_GROUP);
    const bag = f.space(42);
    const ex = [];
    if (op.rules.hand) ex.push(`손 ${op.rules.hand}`);
    if (op.rules.moves) ex.push(`수 ${op.rules.moves}`);
    if (op.run.maximSlots) ex.push(`격언 칸 ${op.run.maximSlots}`);
    const extras = ex.length ? wrap(ex.join(' · '), IW).map((l, k) => [l, (k ? f : f.gap(GAP_GROUP)).line()]) : [];
    return { open, names, bag, extras, h: f.y + P };
  }
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const rec = this.app.records;
    // 다음 오프닝(해금 과제)은 머리줄 오른쪽 보조 글
    const nu = nextUnlock(rec);
    pageHead(ctx, '새 판', nu ? `다음 오프닝 ${OPENINGS[nu.id].name}: ${nu.text} (${nu.have}/${nu.need})` : null, { big: true });
    const f = flow(PAGE.bodyY);
    text(ctx, '오프닝', PAGE.titleX, f.line(), PAL.dim);
    f.gap(GAP_IN);
    // 카드 다섯: 판 밖 폭(12 ~ 468)을 사이 8로 나눈다
    const n = OPENING_ORDER.length, w = Math.floor((W - PAGE.titleX * 2 - SP.m * (n - 1)) / n);
    const lays = OPENING_ORDER.map((id) => this.cardLayout(id, w)), h = Math.max(...lays.map((q) => q.h));
    const y = f.space(h);
    OPENING_ORDER.forEach((id, i) => {
      const op = OPENINGS[id], lay = lays[i];
      const open = lay.open;
      const x = PAGE.titleX + i * (w + SP.m);
      const sel = this.opening === id;
      const rid = `setup:op:${id}`;
      const unlock = UNLOCKS.find((u) => u.id === id);
      // 잠긴 오프닝은 카드가 해금 과제를 적는다(말풍선 없음)
      ui.region(rid, x, y, w, h, { enabled: open, onClick: () => { this.opening = id; this.app.sfx('pick'); } });
      openBox('card', x, y, w, h, PAD_CARD, { name: `오프닝 ${id}` });
      // 열린 오프닝은 크림 카드(고르면 바깥 금빛 고리 2), 잠긴 오프닝은 빈 자리
      if (!open) {
        slot(ctx, x, y, w, h);
        text(ctx, '?', x + w / 2, y + textY(lay.q, 28) - 3, PAL.dimDk, { align: 'center', bold: true, scale: 2 });
        for (const [l, ly] of lay.lines) text(ctx, l, x + w / 2, y + ly, PAL.dim, { align: 'center' });
        closeBox();
        return;
      }
      // 고른 카드: 빛은 카드 뒤, 금빛 테 1은 카드 위(29절)
      if (sel) selectGlow(ctx, x, y, w, h);
      box(ctx, x, y, w, h, PAL.card, !sel && ui.isHover(rid) ? PAL.gold : PAL.frameDk);
      if (sel) selectRing(ctx, x, y, w, h, { r: R_LG, glowA: 0 });
      for (const [l, ly] of lay.names) text(ctx, l, x + w / 2, y + ly, PAL.cardInk, { align: 'center', bold: true });
      // 덱 모습: 작은 기물 여덟(두 줄)
      const bx = x + Math.floor((w - 4 * 19 + 3) / 2);
      op.bag.forEach((t, k) => sprite(ctx, t, 'w', bx + (k % 4) * 19, y + lay.bag + Math.floor(k / 4) * 20));
      for (const [l, ly] of lay.extras) text(ctx, l, x + w / 2, y + ly, PAL.goldDk, { align: 'center' });
      closeBox();
    });
    // 레이팅(단): 이름표와 단추 줄 한 줄 → 묶음 틈 → 더하는 규칙
    f.gap(GAP_GROUP);
    const dy = f.space(BTN_H);
    text(ctx, '레이팅', PAGE.titleX, textY(dy, BTN_H), PAL.dim);
    // 레이팅 아홉: 같은 폭 토글(남는 폭을 사이 4로 나눈다)
    const dx = PAGE.titleX + measure('레이팅') + SP.m, dw = Math.floor((W - PAGE.titleX - dx - SP.s * 8) / 9);
    buttonRow(ctx, ui, Array.from({ length: 9 }, (_, d) => {
      const open = d <= rec.unlocked.dan;
      return { id: `setup:dan:${d}`, label: open ? danName(d) : '?', enabled: open, tone: this.dan === d ? 'gold' : 'plain', onClick: () => { this.dan = d; this.app.sfx('pick'); } };
    }), dx, dy, { w: dw, gap: SP.s });
    f.gap(GAP_GROUP);
    const rules = DANS.filter((x) => x.n <= this.dan).map((x) => x.text);
    wrap(rules.length ? rules.join(' · ') : '추가 규칙 없음', W - PAGE.titleX * 2).forEach((l) => text(ctx, l, PAGE.titleX, f.line(), this.dan ? PAL.red : PAL.dim));
    bottomBar(ctx, ui, { back: { id: 'setup:back', onClick: () => this.app.go('title') }, primary: { id: 'setup:start', label: '시작', tone: 'gold', onClick: () => this.start() } });
  }
  key(k) {
    if (k === 'Enter') this.start();
    else if (k === 'Escape') this.app.go('title');
  }
}
