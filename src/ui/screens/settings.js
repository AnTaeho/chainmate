// 설정(덮개): 소리 크기 · 음악 · 연출 속도 ×1/×2/×4 · 화면 흔들림.
import { PAL } from '../../render/palette.js';
import { W, text, box } from '../../render/gfx.js';
import { button } from '../ui.js';
import { setLang } from '../lang.js';
import { PAD_BOX, GAP_GROUP, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

export class SettingsScreen {
  constructor(app, { back = null } = {}) { this.app = app; this.back = back; }
  draw(ctx, ui) {
    const app = this.app, s = app.settings;
    // 막간 상자(hug): 제목 → 묶음 틈 → 줄 일곱(이름표 · 단추 18, 사이 묶음 틈) → 묶음 틈 → 맨 아래 단추 줄
    const RH = 18, f = flow(PAD_BOX), ty = f.line(true);
    const rowTops = Array.from({ length: 7 }, () => f.gap(GAP_GROUP).space(RH));
    const btnTop = f.gap(GAP_GROUP).space(18);
    const w = 240, h = f.y + PAD_BOX, x = Math.floor((W - w) / 2), y = Math.floor((270 - h) / 2);
    openBox('panel', x, y, w, h, PAD_BOX, { name: '설정' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '설정', W / 2, y + ty, PAL.gold, { align: 'center', bold: true });
    const row = (i, label) => { const top = y + rowTops[i]; text(ctx, label, x + PAD_BOX + 4, textY(top, RH), PAL.ink); return top; };
    const set = (k, v) => { s[k] = v; app.saveSettings(); if (app.audio) app.audio.apply(s); };
    let yy = row(0, '소리');
    button(ctx, ui, 'set:vol-', x + 120, yy, 20, 18, '-', { onClick: () => set('volume', Math.max(0, Math.round((s.volume - 0.1) * 10) / 10)) });
    text(ctx, `${Math.round(s.volume * 10)}`, x + 156, textY(yy, RH), PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:vol+', x + 172, yy, 20, 18, '+', { onClick: () => set('volume', Math.min(1, Math.round((s.volume + 0.1) * 10) / 10)) });
    yy = row(1, '음악');
    button(ctx, ui, 'set:mus-', x + 120, yy, 20, 18, '-', { onClick: () => set('music', Math.max(0, Math.round((s.music - 0.1) * 10) / 10)) });
    text(ctx, `${Math.round(s.music * 10)}`, x + 156, textY(yy, RH), PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:mus+', x + 172, yy, 20, 18, '+', { onClick: () => set('music', Math.min(1, Math.round((s.music + 0.1) * 10) / 10)) });
    yy = row(2, '연출 속도');
    [1, 2, 4].forEach((v, i) => button(ctx, ui, `set:speed${v}`, x + 120 + i * 34, yy, 30, 18, `×${v}`, { onClick: () => set('speed', v), tone: s.speed === v ? 'gold' : 'plain' }));
    yy = row(3, '화면 흔들림');
    button(ctx, ui, 'set:shake', x + 120, yy, 64, 18, s.shake ? '켬' : '끔', { onClick: () => set('shake', !s.shake), tone: s.shake ? 'gold' : 'plain' });
    yy = row(5, '언어');
    button(ctx, ui, 'set:lang', x + 120, yy, 64, 18, s.lang === 'en' ? 'English' : '한국어', { onClick: () => { set('lang', s.lang === 'en' ? 'ko' : 'en'); setLang(s.lang); } });
    yy = row(4, '큰 글자');
    button(ctx, ui, 'set:big', x + 120, yy, 64, 18, s.big ? '켬' : '끔', { onClick: () => set('big', !s.big), tone: s.big ? 'gold' : 'plain' });
    yy = row(6, '처음 안내');
    button(ctx, ui, 'set:coach', x + 120, yy, 30, 18, s.coach === false ? '끔' : '켬', { onClick: () => set('coach', s.coach === false), tone: s.coach === false ? 'plain' : 'gold' });
    button(ctx, ui, 'set:coachReset', x + 154, yy, 78, 18, '다시 보기', { onClick: () => { app.records.coachSeen = {}; app.saveRecords(); set('coach', true); app.toast('처음 안내를 다시 보인다', PAL.gold); } });
    button(ctx, ui, 'set:lessons', W / 2 - 92, y + btnTop, 88, 18, '첫 수업', { onClick: () => { app.closeOverlay(); app.guide = null; if (app.run && app.run.scratch) app.run = null; app.fx.clear(); app.go('lessons'); } });
    button(ctx, ui, 'set:back', W / 2 + 4, y + btnTop, 80, 18, '돌아가기', { onClick: () => this.close() });
    closeBox();
  }
  close() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  key(k) { if (k === 'Escape' || k === 'Enter') this.close(); }
}
