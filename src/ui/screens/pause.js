// 일시정지(덮개): 계속 · 설정 · 메인 화면 · (판 안이면) 그만두기. 막간 상자(29절 제목 자리 3): 두 배 제목 가운데, 단추 셋은 같은 폭 한 줄 가운데.
import { W } from '../../render/gfx.js';
import { rowWidth } from '../ui.js';
import { INTER, interlude, interludeLayout } from './common.js';

export class PauseScreen {
  constructor(app) { this.app = app; }
  // 멈춤 동안은 뒤 화면의 연출 시계도 멈춘다(대국 연출이 덮개 밑에서 흘러가던 것)
  update() {}
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const app = this.app;
    const buttons = [
      { id: 'pause:resume', label: '계속', onClick: () => app.closeOverlay(), tone: 'gold' },
      { id: 'pause:settings', label: '설정', onClick: () => app.openOverlay('settings', { back: 'pause' }) },
      { id: 'pause:title', label: '메인 화면', onClick: () => app.toTitle() },
    ];
    // 판 그만두기(U-15): 판 안에서만(수업 · 연습용 판은 없다) — 확인 상자를 거친다
    if (app.run && !app.run.scratch && app.screen && app.screen.name !== 'lesson' && app.runInProgress()) buttons.push({ id: 'pause:quit', label: '그만두기', onClick: () => app.askQuitRun() });
    const w = rowWidth(buttons).w + INTER.pad * 2, h = interludeLayout(0).h;
    interlude(ctx, ui, Math.floor((W - w) / 2), Math.floor((270 - h) / 2), w, 0, null, { title: '멈춤', buttons, name: '멈춤' });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.closeOverlay(); }
}
