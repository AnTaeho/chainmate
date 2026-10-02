// 설정(덮개): 소리 크기 · 음악 · 연출 속도 ×1/×2/×4 · 화면 흔들림 · 큰 글자 · 언어 · 처음 안내 · 움직임 줄이기,
// 맨 아래 수업 · 킹과 다시 두기(다음 새 판의 첫 대국을 킹과 둔다, CHM-22) · 기록 내보내기(사람 판 기록 JSON, CHM-50) · 돌아가기.
// 기록 내보내기는 줄 하나를 더하면 상자가 화면(270)을 넘어 맨 아래 단추 줄에 둔다.
import { PAL } from '../../render/palette.js';
import { W, text, box, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { setLang } from '../lang.js';
import { PAD_BOX, GAP_GROUP, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

export class SettingsScreen {
  constructor(app, { back = null } = {}) { this.app = app; this.back = back; }
  draw(ctx, ui) {
    const app = this.app, s = app.settings;
    // 막간 상자(hug): 제목 → 묶음 틈 → 줄 여덟(이름표 · 단추 18, 사이 묶음 틈) → 묶음 틈 → 맨 아래 단추 줄
    const RH = 18, f = flow(PAD_BOX), ty = f.line(true);
    const rowTops = Array.from({ length: 8 }, () => f.gap(GAP_GROUP).space(RH));
    const btnTop = f.gap(GAP_GROUP).space(18);
    // 맨 아래 단추 넷(글에 맞춘 폭, 글과 테 사이 2 이상 — 영어 「Replay with the King」 · 「Export runs」)
    const lw = Math.max(64, measure('수업', true) + 8), kw = Math.max(96, measure('킹과 다시 두기', true) + 8), ew = Math.max(72, measure('기록 내보내기', true) + 8), bw = 72;
    const w = Math.max(240, lw + kw + ew + bw + 8 * 3 + PAD_BOX * 2), h = f.y + PAD_BOX, x = Math.floor((W - w) / 2), y = Math.floor((270 - h) / 2);
    openBox('panel', x, y, w, h, PAD_BOX, { name: '설정' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '설정', W / 2, y + ty, PAL.gold, { align: 'center', bold: true });
    const row = (i, label) => { const top = y + rowTops[i]; text(ctx, label, x + PAD_BOX + 4, textY(top, RH), PAL.ink); return top; };
    const set = (k, v) => { s[k] = v; app.saveSettings(); if (app.audio) app.audio.apply(s); };
    // 손가락 구역(CHM-52): 줄 사이 틈(8)을 반씩, ± 단추는 바깥쪽과 숫자 쪽으로 6씩, 연출 속도는 단추 사이 틈(4)을 반씩
    const G = { u: 4, d: 4 }, GM = { ...G, l: 6, r: 6 }, GS = { ...G, l: 2, r: 2 };
    let yy = row(0, '소리');
    button(ctx, ui, 'set:vol-', x + 120, yy, 20, 18, '-', { onClick: () => set('volume', Math.max(0, Math.round((s.volume - 0.1) * 10) / 10)), grow: GM });
    text(ctx, `${Math.round(s.volume * 10)}`, x + 156, textY(yy, RH), PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:vol+', x + 172, yy, 20, 18, '+', { onClick: () => set('volume', Math.min(1, Math.round((s.volume + 0.1) * 10) / 10)), grow: GM });
    yy = row(1, '음악');
    button(ctx, ui, 'set:mus-', x + 120, yy, 20, 18, '-', { onClick: () => set('music', Math.max(0, Math.round((s.music - 0.1) * 10) / 10)), grow: GM });
    text(ctx, `${Math.round(s.music * 10)}`, x + 156, textY(yy, RH), PAL.ink, { align: 'center', bold: true });
    button(ctx, ui, 'set:mus+', x + 172, yy, 20, 18, '+', { onClick: () => set('music', Math.min(1, Math.round((s.music + 0.1) * 10) / 10)), grow: GM });
    yy = row(2, '연출 속도');
    [1, 2, 4].forEach((v, i) => button(ctx, ui, `set:speed${v}`, x + 120 + i * 34, yy, 30, 18, `×${v}`, { onClick: () => set('speed', v), tone: s.speed === v ? 'gold' : 'plain', grow: GS }));
    yy = row(3, '화면 흔들림');
    button(ctx, ui, 'set:shake', x + 120, yy, 64, 18, s.shake ? '켬' : '끔', { onClick: () => set('shake', !s.shake), tone: s.shake ? 'gold' : 'plain', grow: G });
    yy = row(5, '언어');
    button(ctx, ui, 'set:lang', x + 120, yy, 64, 18, s.lang === 'en' ? 'English' : '한국어', { onClick: () => { set('lang', s.lang === 'en' ? 'ko' : 'en'); setLang(s.lang); }, grow: G });
    yy = row(4, '큰 글자');
    button(ctx, ui, 'set:big', x + 120, yy, 64, 18, s.big ? '켬' : '끔', { onClick: () => set('big', !s.big), tone: s.big ? 'gold' : 'plain', grow: G });
    yy = row(6, '처음 안내');
    button(ctx, ui, 'set:coach', x + 120, yy, 30, 18, s.coach === false ? '끔' : '켬', { onClick: () => set('coach', s.coach === false), tone: s.coach === false ? 'plain' : 'gold', grow: G });
    // 글에 맞춘 폭(글과 테 사이 2 — 영어 「Show again」 · 「First Lessons」)
    const rw = Math.max(78, measure('다시 보기', true) + 6);
    button(ctx, ui, 'set:coachReset', x + w - PAD_BOX - rw, yy, rw, 18, '다시 보기', { onClick: () => { app.records.coachSeen = {}; app.saveRecords(); set('coach', true); app.toast('처음 안내를 다시 보인다', PAL.gold); }, grow: G });
    yy = row(7, '움직임 줄이기');
    button(ctx, ui, 'set:calm', x + 120, yy, 64, 18, s.calm ? '켬' : '끔', { onClick: () => set('calm', !s.calm), tone: s.calm ? 'gold' : 'plain', grow: G });
    const bx0 = Math.floor(W / 2 - (lw + kw + ew + bw + 24) / 2), by = y + btnTop;
    button(ctx, ui, 'set:lessons', bx0, by, lw, 18, '수업', { onClick: () => { app.closeOverlay(); app.guide = null; if (app.run && app.run.scratch) app.run = null; app.fx.clear(); app.go('lessons'); }, grow: G });
    const again = !!app.records.kingAgain;
    button(ctx, ui, 'set:king', bx0 + lw + 8, by, kw, 18, '킹과 다시 두기', { tone: again ? 'gold' : 'plain', onClick: () => { app.records.kingAgain = !again; app.saveRecords(); if (!again) app.toast('다음 새 판은 킹과 둔다', PAL.gold); }, grow: G });
    button(ctx, ui, 'set:export', bx0 + lw + kw + 16, by, ew, 18, '기록 내보내기', { onClick: () => app.exportRuns(), grow: G });
    button(ctx, ui, 'set:back', bx0 + lw + kw + ew + 24, by, bw, 18, '돌아가기', { onClick: () => this.close(), grow: G });
    closeBox();
  }
  close() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  key(k) { if (k === 'Escape' || k === 'Enter') this.close(); }
}
