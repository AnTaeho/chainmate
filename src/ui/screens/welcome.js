// 처음 켬 덮개(docs/design-notes/tutorial.md): 판 · 수업 기록이 없는 사람이 첫 화면에 처음 오면 킹이 튜토리얼을 권한다.
// 「튜토리얼부터」(금빛) → 수업을 차례로, 「바로 시작」 → 새 판. 어느 쪽이든 records.tutorialAsked. 오른쪽 위 「×」 · Esc는 덮개만 닫는다(다음에 켜면 다시 권한다).
import { W, H, rect } from '../../render/gfx.js';
import { button } from '../ui.js';
import { PAD_BOX, GAP_GROUP, BTN_S } from '../frame.js';
import { kingNoteLayout, kingNote } from '../coach.js';
import { startTutorial } from './lessons.js';

export const WELCOME_SAY = '처음이야? 튜토리얼부터 해 볼래?';
export const WELCOME = { w: 220 };

export function welcomeLayout() {
  const lay = kingNoteLayout(WELCOME_SAY, WELCOME.w);
  const btnY = lay.h + GAP_GROUP - PAD_BOX, h = btnY + BTN_S + PAD_BOX;
  return { lay: { ...lay, h }, btnY, h, x: Math.floor(W / 2 - WELCOME.w / 2), y: Math.floor(H / 2 - h / 2) - 10 };
}

// 닫기 단추 그림(7×7 ×)
const cross = (ctx, x, y, col) => { for (let i = 0; i < 7; i++) { rect(ctx, x + i, y - 1 + i, 1, 1, col); rect(ctx, x + 6 - i, y - 1 + i, 1, 1, col); } };

export class WelcomeScreen {
  constructor(app) { this.app = app; }
  // 그릴 때만 그린다: 덮개는 스스로 움직이지 않는다(킹이 들썩이는 동안은 kingNote가 live()로 알린다)
  animating() { return false; }
  choose(pick) {
    const app = this.app;
    app.track('tutorial_offer', { pick }, { always: true });
    if (pick === 'close') { app.welcomeShut = true; app.closeOverlay(); return; }
    app.records.tutorialAsked = true;
    app.saveRecords();
    app.closeOverlay();
    if (pick === 'lesson') startTutorial(app, 'welcome');
    else app.newRun();
  }
  draw(ctx, ui) {
    const { lay, btnY, x, y } = welcomeLayout(), w = WELCOME.w;
    const bw = Math.floor((w - PAD_BOX * 2 - 6) / 2);
    kingNote(ctx, this.app, x, y, w, WELCOME_SAY, lay, { name: '튜토리얼 권하기', headRight: BTN_S + 4, inner: () => {
      // 닫기(킹 머리줄 오른쪽 끝): 바깥을 눌러서는 닫히지 않는다(실수로 닫히지 않게)
      button(ctx, ui, 'welcome:close', x + w - PAD_BOX - BTN_S, y + PAD_BOX, BTN_S, BTN_S, '', { onClick: () => this.choose('close'), icon: cross });
      button(ctx, ui, 'welcome:play', x + PAD_BOX, y + btnY, bw, BTN_S, '바로 시작', { onClick: () => this.choose('play') });
      button(ctx, ui, 'welcome:lesson', x + w - PAD_BOX - bw, y + btnY, bw, BTN_S, '튜토리얼부터', { tone: 'gold', onClick: () => this.choose('lesson') });
    } });
  }
  key(k) {
    if (k === 'Escape') this.choose('close');
    else if (k === 'Enter' || k === ' ') this.choose('lesson');
  }
}
