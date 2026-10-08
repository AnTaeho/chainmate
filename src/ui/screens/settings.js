// 설정(덮개): 소리 크기 · 음악 · 연출 속도 ×1/×2/×4 · 화면 흔들림 · 복기 · 큰 글자 · 언어 · 처음 안내 · 움직임 줄이기 · 기록 보내기(CHM-63),
// 맨 아래 수업 · 킹과 다시 두기(다음 새 판의 첫 대국을 킹과 둔다, CHM-22) · 기록 내보내기(사람 판 기록 JSON, CHM-50) · 돌아가기.
// 기록 내보내기는 줄 하나를 더하면 상자가 화면(270)을 넘어 맨 아래 단추 줄에 둔다.
// 순위 이름(CHM-70): 「큰 글자」 · 「언어」 줄의 빈 오른쪽 반에 두 줄 — 윗줄 「이름 졸린 수달」, 아랫줄 주사위 「다시 짓기」. 순위에 오른 적이 있을 때만(열쇠가 있을 때) 보인다.
// 계정 · 기기 잇기(CHM-71 · CHM-72): 언어 줄 오른쪽, 「다시 짓기」 왼쪽에 단추 「계정」 하나(이름이 없으면 그 자리 오른끝). 판 밖(첫 화면에서 연 설정)에서만 · 순위에 닿는 곳에서만 보인다.
import { PAL } from '../../render/palette.js';
import { W, text, box, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { setLang } from '../lang.js';
import { PAD_BOX, GAP_GROUP, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { diceIcon } from '../../render/dice.js';

export const TELEMETRY_TIP = '이름 없이 판 결과만 보낸다 · 화면은 보지 않는다';
// 다시 짓기를 가리키면 제목 자리에 뜨는 한 줄(오늘 남은 횟수 — 서버가 알려 준 뒤에만)
export const rerollTip = (left) => (left == null ? '순위에 오르는 이름을 새로 짓는다' : left > 0 ? `오늘 ${left}번 더 지을 수 있다` : '오늘은 다 지었다 · 내일 다시 지을 수 있다');
// 이름 줄의 자리(재는 쪽 test/layout.test.js와 같이 쓴다): 이름은 오른끝 맞춤, 「이름」 이름표는 이름 왼쪽에 들어갈 때만
export const LINK_TIP = '아이디로 들어오거나 다른 기기와 잇는다';
export const NAME_X = 192;
export function nameRow(x, w, name) {
  const x0 = x + NAME_X, x1 = x + w - PAD_BOX, nw = measure(name, true), lw = measure('이름') + 6;
  return { x0, x1, nameX: x1 - nw, label: x1 - nw - lw >= x0 ? x1 - nw - lw : null };
}

// 기기 잇기 단추: 순위에 닿는 곳 · 판 밖에서만. 폭은 글에 맞춘다
export const linkShown = (app) => !!app.rank.allowed && !app.run;
// 계정(CHM-72): 같은 자리의 단추가 계정 화면(탭 「아이디」 · 「기기 잇기」)을 연다
export const LINK_LABEL = '계정';
export const linkW = () => measure(LINK_LABEL, true) + 16;

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
    // 기록 보내기를 가리키면 제목 자리에 무엇을 보내는지 한 줄(상자가 화면에 꽉 차 말풍선을 띄울 자리가 없다)
    const me = app.rank.player();
    if (ui.isHover('set:telemetry')) text(ctx, TELEMETRY_TIP, W / 2, y + ty, PAL.ink, { align: 'center' });
    else if (me && ui.isHover('set:name')) text(ctx, rerollTip(me.rerolls), W / 2, y + ty, PAL.ink, { align: 'center' });
    else if (ui.isHover('set:link')) text(ctx, LINK_TIP, W / 2, y + ty, PAL.ink, { align: 'center' });
    else text(ctx, '설정', W / 2, y + ty, PAL.gold, { align: 'center', bold: true });
    const row = (i, label) => { const top = y + rowTops[i]; text(ctx, label, x + PAD_BOX + 4, textY(top, RH), PAL.ink); return top; };
    const set = (k, v) => { s[k] = v; app.saveSettings(); if (app.audio) app.audio.apply(s); app.track('setting_change', { key: k, value: v }, { always: true }); };
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
    // 복기(CHM-59): 진 대국의 갈림길 카드. 줄을 더하면 상자가 화면(270)을 넘어 화면 흔들림 줄 오른쪽에 둔다
    const on = s.replay !== false, rbw = 30;
    text(ctx, '복기', x + w - PAD_BOX - rbw - 6, textY(yy, RH), PAL.ink, { align: 'right' });
    button(ctx, ui, 'set:replay', x + w - PAD_BOX - rbw, yy, rbw, 18, on ? '켬' : '끔', { onClick: () => set('replay', !on), tone: on ? 'gold' : 'plain', grow: G });
    yy = row(5, '언어');
    button(ctx, ui, 'set:lang', x + 120, yy, 64, 18, s.lang === 'en' ? 'English' : '한국어', { onClick: () => { set('lang', s.lang === 'en' ? 'ko' : 'en'); setLang(s.lang); }, grow: G });
    yy = row(4, '큰 글자');
    button(ctx, ui, 'set:big', x + 120, yy, 64, 18, s.big ? '켬' : '끔', { onClick: () => set('big', !s.big), tone: s.big ? 'gold' : 'plain', grow: G });
    // 순위 이름: 큰 글자 줄(4) 오른쪽에 이름, 언어 줄(5) 오른쪽에 「다시 짓기」
    let linkR = x + w - PAD_BOX;
    if (me) {
      const at = nameRow(x, w, me.name), top4 = y + rowTops[4], top5 = y + rowTops[5];
      if (at.label != null) text(ctx, '이름', at.label, textY(top4, RH), PAL.ink);
      text(ctx, me.name, at.x1, textY(top4, RH), PAL.gold, { align: 'right', bold: true });
      const nw = measure('다시 짓기', true) + 10 + 12;
      button(ctx, ui, 'set:name', at.x1 - nw, top5, nw, RH, '다시 짓기', { icon: diceIcon, enabled: !this.rolling && me.rerolls !== 0, onClick: () => this.reroll(), grow: G });
      linkR = at.x1 - nw - 6;
    }
    // 기기 잇기: 언어 줄(5), 「다시 짓기」 왼쪽
    if (linkShown(app)) {
      const lkw = linkW();
      button(ctx, ui, 'set:link', linkR - lkw, y + rowTops[5], lkw, RH, LINK_LABEL, { onClick: () => { app.closeOverlay(); app.go('account'); }, grow: G });
    }
    yy = row(6, '처음 안내');
    button(ctx, ui, 'set:coach', x + 120, yy, 30, 18, s.coach === false ? '끔' : '켬', { onClick: () => set('coach', s.coach === false), tone: s.coach === false ? 'plain' : 'gold', grow: G });
    // 글에 맞춘 폭(글과 테 사이 2 — 영어 「Show again」 · 「First Lessons」)
    const rw = Math.max(78, measure('다시 보기', true) + 6);
    button(ctx, ui, 'set:coachReset', x + w - PAD_BOX - rw, yy, rw, 18, '다시 보기', { onClick: () => { app.records.coachSeen = {}; app.saveRecords(); set('coach', true); app.toast('처음 안내를 다시 보인다', PAL.gold); }, grow: G });
    yy = row(7, '움직임 줄이기');
    button(ctx, ui, 'set:calm', x + 120, yy, 64, 18, s.calm ? '켬' : '끔', { onClick: () => set('calm', !s.calm), tone: s.calm ? 'gold' : 'plain', grow: G });
    // 기록 보내기(CHM-63): 줄을 더하면 상자가 화면(270)을 넘어 움직임 줄이기 줄 오른쪽에 둔다(복기와 같은 꼴)
    const tel = s.telemetry !== false;
    text(ctx, '기록 보내기', x + w - PAD_BOX - rbw - 6, textY(yy, RH), PAL.ink, { align: 'right' });
    button(ctx, ui, 'set:telemetry', x + w - PAD_BOX - rbw, yy, rbw, 18, tel ? '켬' : '끔', { onClick: () => app.setTelemetry(!tel), tone: tel ? 'gold' : 'plain', grow: G });
    const bx0 = Math.floor(W / 2 - (lw + kw + ew + bw + 24) / 2), by = y + btnTop;
    button(ctx, ui, 'set:lessons', bx0, by, lw, 18, '수업', { onClick: () => { app.closeOverlay(); app.guide = null; if (app.run && app.run.scratch) app.run = null; app.fx.clear(); app.go('lessons'); }, grow: G });
    const again = !!app.records.kingAgain;
    button(ctx, ui, 'set:king', bx0 + lw + 8, by, kw, 18, '킹과 다시 두기', { tone: again ? 'gold' : 'plain', onClick: () => { app.records.kingAgain = !again; app.saveRecords(); if (!again) app.toast('다음 새 판은 킹과 둔다', PAL.gold); }, grow: G });
    button(ctx, ui, 'set:export', bx0 + lw + kw + 16, by, ew, 18, '기록 내보내기', { onClick: () => app.exportRuns(), grow: G });
    button(ctx, ui, 'set:back', bx0 + lw + kw + ew + 24, by, bw, 18, '돌아가기', { onClick: () => this.close(), grow: G });
    closeBox();
  }
  // 이름 다시 짓기: 서버가 새 이름을 뽑는다. 닿지 못하면 한 줄 알림
  reroll() {
    const app = this.app;
    if (this.rolling) return;
    this.rolling = true;
    app.sfx('pick');
    app.rank.reroll().then((r) => {
      this.rolling = false;
      if (r.ok) { app.track('name_reroll', {}, { always: true }); return; }
      app.toast(r.why === 'limit' ? '오늘은 다 지었다' : '순위에 닿지 못했다', PAL.ink);
    }, () => { this.rolling = false; });
  }
  close() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  key(k) { if (k === 'Escape' || k === 'Enter') this.close(); }
}
