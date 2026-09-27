// 설정(덮개): 소리 크기 · 음악 · 연출 속도 ×1/×2/×4 · 화면 흔들림.
import { PAL } from '../../render/palette.js';
import { W, text, box } from '../../render/gfx.js';
import { button } from '../ui.js';
import { setLang } from '../lang.js';

export class SettingsScreen {
  constructor(app, { back = null } = {}) { this.app = app; this.back = back; }
  draw(ctx, ui) {
    const app = this.app, s = app.settings;
    const x = 130, y = 26, w = 220, h = 224;
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '설정', W / 2, y + 8, PAL.gold, { align: 'center', bold: true });
    const row = (i, label) => { text(ctx, label, x + 12, y + 34 + i * 26, PAL.ink); return y + 30 + i * 26; };
    const set = (k, v) => { s[k] = v; app.saveSettings(); if (app.audio) app.audio.apply(s); };
    let yy = row(0, '소리');
    button(ctx, ui, 'set:vol-', x + 110, yy, 20, 18, '-', { onClick: () => set('volume', Math.max(0, Math.round((s.volume - 0.1) * 10) / 10)) });
    text(ctx, `${Math.round(s.volume * 10)}`, x + 146, yy + 3, PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:vol+', x + 162, yy, 20, 18, '+', { onClick: () => set('volume', Math.min(1, Math.round((s.volume + 0.1) * 10) / 10)) });
    yy = row(1, '음악');
    button(ctx, ui, 'set:mus-', x + 110, yy, 20, 18, '-', { onClick: () => set('music', Math.max(0, Math.round((s.music - 0.1) * 10) / 10)) });
    text(ctx, `${Math.round(s.music * 10)}`, x + 146, yy + 3, PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:mus+', x + 162, yy, 20, 18, '+', { onClick: () => set('music', Math.min(1, Math.round((s.music + 0.1) * 10) / 10)) });
    yy = row(2, '연출 속도');
    [1, 2, 4].forEach((v, i) => button(ctx, ui, `set:speed${v}`, x + 110 + i * 34, yy, 30, 18, `×${v}`, { onClick: () => set('speed', v), tone: s.speed === v ? 'gold' : 'plain' }));
    yy = row(3, '화면 흔들림');
    button(ctx, ui, 'set:shake', x + 110, yy, 64, 18, s.shake ? '켬' : '끔', { onClick: () => set('shake', !s.shake), tone: s.shake ? 'gold' : 'plain' });
    yy = row(5, '언어');
    button(ctx, ui, 'set:lang', x + 110, yy, 64, 18, s.lang === 'en' ? 'English' : '한국어', { onClick: () => { set('lang', s.lang === 'en' ? 'ko' : 'en'); setLang(s.lang); } });
    yy = row(4, '큰 글자');
    button(ctx, ui, 'set:big', x + 110, yy, 64, 18, s.big ? '켬' : '끔', { onClick: () => set('big', !s.big), tone: s.big ? 'gold' : 'plain' });
    button(ctx, ui, 'set:lessons', W / 2 - 92, y + h - 26, 88, 18, '첫 수업 다시', { onClick: () => { app.closeOverlay(); app.run = null; app.fx.clear(); app.go('lesson'); } });
    button(ctx, ui, 'set:back', W / 2 + 4, y + h - 26, 80, 18, '돌아가기', { onClick: () => this.close() });
  }
  close() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  key(k) { if (k === 'Escape' || k === 'Enter') this.close(); }
}
