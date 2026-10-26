// 확인 상자(덮개): 되돌릴 수 없는 누름 앞에 한 번 묻는다 — 끝나지 않은 판이 있을 때 「새 판」 · 「오늘의 대국」(U-2), 멈춤의 「판 그만두기」(U-15).
// 막간 상자(멈춤과 같은 꼴): 묻는 말 한두 줄 가운데, 단추 「돌아가기」(금빛 — Enter · Esc도 이쪽) · 하는 일(yes, 붉은 단추). 바깥을 눌러서는 닫히지 않는다.
// 시안 셋(2026-10-26): 묻는 말 한 줄 + 붉은 단추를 골랐다. 두 배 제목 「새로 시작할까요?」 + 풀이 줄은 같은 말을 두 번 해 상자만 커졌고, 크림 단추는 「돌아가기」와 무게가 같아 보였다
import { W, H, text, measure } from '../../render/gfx.js';
import { PAL } from '../../render/palette.js';
import { wrap } from '../../render/text.js';
import { rowWidth } from '../ui.js';
import { LINE, textY } from '../frame.js';
import { INTER, interlude, interludeLayout } from './common.js';

export const NEW_RUN_ASK = '지금 판을 그만두고 새로 시작할까요?';
export const QUIT_RUN_ASK = '지금 판을 그만둘까요? 그만둔 판은 이어 할 수 없어요';
const MAX_W = 280; // 상자 폭 상한(글이 길면 줄을 바꾼다)

export class ConfirmScreen {
  // say: 묻는 말 · yes: 하는 일 · yesLabel: 그 단추 이름 · back: 돌아갈 덮개 이름(없으면 덮개를 닫는다)
  constructor(app, { say, yes, yesLabel, back = null, title = null, tone = 'red' }) { Object.assign(this, { app, say, yes, yesLabel, back, title, tone }); }
  update() {}
  animating() { return false; }
  goBack() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  buttons() {
    return [
      { id: 'confirm:back', label: '돌아가기', tone: 'gold', onClick: () => this.goBack() },
      { id: 'confirm:yes', label: this.yesLabel, tone: this.tone, onClick: () => this.yes() },
    ];
  }
  draw(ctx, ui) {
    const P = INTER.pad, buttons = this.buttons(), lines = wrap(this.say, MAX_W - P * 2);
    const w = Math.min(MAX_W, Math.max(rowWidth(buttons).w + P * 2, ...lines.map((l) => measure(l) + P * 2)));
    const bodyH = lines.length * LINE, h = interludeLayout(bodyH, { title: !!this.title }).h;
    interlude(ctx, ui, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, bodyH, (c, x, y, iw) => {
      lines.forEach((l, k) => text(c, l, x + Math.floor(iw / 2), textY(y + k * LINE), PAL.ink, { align: 'center' }));
    }, { title: this.title, buttons, name: '확인 상자' });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.goBack(); }
}
