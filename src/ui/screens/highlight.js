// 하이라이트(덮개, CHM-73): 결과 화면 「하이라이트」 — 카드 한 장, 그 아래 「그림 저장」 · 「공유」 · 「닫기」. Esc · 바깥 누르기로 닫힌다.
// 그림은 열 때 미리 만들어 둔다(공유 시트는 누른 그 순간 안에서 열어야 한다). 공유를 못 하는 곳에서는 「공유」 단추가 없다.
// 밑의 결과 화면은 덮개가 떠 있는 동안 단추 줄을 그리지 않는다(덮개 단추 사이로 비치지 않게)
import { PAL } from '../../render/palette.js';
import { W, H, rect } from '../../render/gfx.js';
import { buttonRow } from '../ui.js';
import { SP } from '../frame.js';
import { CARD, HIGHLIGHT_FILE, highlightLayout, drawHighlight, highlightBlob } from '../highlight.js';

export const HL = { x: (W - CARD.w) >> 1, y: SP.m };
HL.btnY = HL.y + CARD.h + SP.m;

export class HighlightScreen {
  constructor(app) {
    this.app = app;
    this.run = app.run;
    this.blob = null;
    this.canShare = false;
    highlightBlob(this.run).then((b) => { this.blob = b; this.canShare = !!b && app.canShareImage(HIGHLIGHT_FILE, b); app.invalidate(); });
    app.track('highlight_open', {});
  }
  update() {}
  animating() { return false; }
  surroundDim() { return 0.6; } // 밑 화면을 한 겹 더 어둡게 — 여백 판도 같이(app.surround)
  draw(ctx, ui) {
    // 밑의 결과 화면을 한 겹 더 어둡게
    ctx.globalAlpha = 0.6; rect(ctx, 0, 0, W, H, PAL.shadow); ctx.globalAlpha = 1;
    drawHighlight(ctx, this.run, highlightLayout(this.run, HL.x, HL.y));
    const list = [{ id: 'hl:save', label: '그림 저장', onClick: () => this.save(), tone: 'gold', enabled: !!this.blob }];
    if (this.canShare) list.push({ id: 'hl:share', label: '공유', onClick: () => this.share() });
    list.push({ id: 'hl:close', label: '닫기', onClick: () => this.app.closeOverlay() });
    buttonRow(ctx, ui, list, W / 2, HL.btnY, { anchor: 'center' });
  }
  save() {
    const app = this.app, ok = app.saveImage(HIGHLIGHT_FILE, this.blob);
    if (ok) { app.toast('그림을 저장했어요', PAL.gold); app.track('highlight_save', {}); } else app.toast('저장하지 못했어요', PAL.red);
  }
  // 누른 그 순간 안에서 공유 시트를 연다(앞에 await를 두지 않는다). 그만두면 알림 없이
  share() {
    const app = this.app, sent = app.shareImage(HIGHLIGHT_FILE, this.blob);
    if (!sent) { app.toast('공유하지 못했어요', PAL.red); app.track('highlight_share', { ok: false }); return; }
    sent.then((r) => { if (r === 'fail') app.toast('공유하지 못했어요', PAL.red); app.track('highlight_share', { ok: r === 'shared' }); });
  }
  // 카드와 단추 밖을 누르면 닫힌다
  pointerDown(x, y) {
    const inCard = x >= HL.x && x < HL.x + CARD.w && y >= HL.y && y < HL.y + CARD.h;
    if (!inCard && !this.app.ui.press) this.app.closeOverlay();
  }
  key(k) { if (k === 'Escape') this.app.closeOverlay(); }
}
