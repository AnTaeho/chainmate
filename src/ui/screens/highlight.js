// 하이라이트(덮개, CHM-73): 결과 화면 「하이라이트」 — 카드 한 장, 그 아래 「그림 저장」 · 「공유」 · 「닫기」. Esc · 바깥 누르기로 닫힌다.
// 그림은 열 때 미리 만들어 둔다(공유 시트는 누른 그 순간 안에서 열어야 한다). 공유를 못 하는 곳에서는 「공유」 단추가 없다.
import { PAL } from '../../render/palette.js';
import { W, H, rect } from '../../render/gfx.js';
import { button } from '../ui.js';
import { BTN_H } from '../frame.js';
import { CARD, HIGHLIGHT_FILE, highlightLayout, drawHighlight, highlightBlob } from '../highlight.js';

export const HL = { x: (W - CARD.w) >> 1, y: 8, btnY: 241, btnW: 90, gap: 15 };

export class HighlightScreen {
  constructor(app) {
    this.app = app;
    this.run = app.run;
    this.blob = null;
    this.canShare = false;
    highlightBlob(this.run).then((b) => { this.blob = b; this.canShare = !!b && app.canShareImage(HIGHLIGHT_FILE, b); });
    app.track('highlight_open', {});
  }
  update() {}
  draw(ctx, ui) {
    // 밑의 결과 화면 단추가 카드 아래 단추 뒤로 비치지 않게 한 겹 더 어둡게
    ctx.globalAlpha = 0.6; rect(ctx, 0, 0, W, H, PAL.shadow); ctx.globalAlpha = 1;
    drawHighlight(ctx, this.run, highlightLayout(this.run, HL.x, HL.y));
    const list = [['hl:save', '그림 저장', () => this.save(), 'gold', !!this.blob]];
    if (this.canShare) list.push(['hl:share', '공유', () => this.share(), 'plain', true]);
    list.push(['hl:close', '닫기', () => this.app.closeOverlay(), 'plain', true]);
    const x0 = (W - (list.length * HL.btnW + (list.length - 1) * HL.gap)) >> 1;
    list.forEach(([id, label, onClick, tone, enabled], i) => button(ctx, ui, id, x0 + i * (HL.btnW + HL.gap), HL.btnY, HL.btnW, BTN_H, label, { onClick, tone, enabled }));
  }
  save() {
    const app = this.app, ok = app.saveImage(HIGHLIGHT_FILE, this.blob);
    if (ok) { app.toast('그림을 저장했다', PAL.gold); app.track('highlight_save', {}); } else app.toast('저장하지 못했다', PAL.red);
  }
  // 누른 그 순간 안에서 공유 시트를 연다(앞에 await를 두지 않는다). 그만두면 알림 없이
  share() {
    const app = this.app, sent = app.shareImage(HIGHLIGHT_FILE, this.blob);
    if (!sent) { app.toast('공유하지 못했다', PAL.red); app.track('highlight_share', { ok: false }); return; }
    sent.then((r) => { if (r === 'fail') app.toast('공유하지 못했다', PAL.red); app.track('highlight_share', { ok: r === 'shared' }); });
  }
  // 카드와 단추 밖을 누르면 닫힌다
  pointerDown(x, y) {
    const inCard = x >= HL.x && x < HL.x + CARD.w && y >= HL.y && y < HL.y + CARD.h;
    if (!inCard && !this.app.ui.press) this.app.closeOverlay();
  }
  key(k) { if (k === 'Escape') this.app.closeOverlay(); }
}
