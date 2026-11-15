// 설정(덮개지만 판 밖 틀 — layout.md 29절 제목 자리 1): 큰 머리 「설정」 + 두 칸 넷 묶음(묶음마다 판넬) + 맨 아래 단추 줄.
//   왼쪽: 소리(소리 · 음악) · 화면(화면 흔들림 · 움직임 줄이기 · 큰 글자 · 언어). 오른쪽: 플레이(연출 속도 · 복기 · 도움말 팁 · 다시 보기) · 순위 · 기록(이름 · 이름 바꾸기 · 플레이 기록 전송).
//   맨 아래: 「뒤로」 · 튜토리얼 · 기록 내보내기, 오른쪽 끝 「계정」(판 밖 · 순위에 닿는 곳에서만). 이름 줄은 순위에 오른 적이 있을 때만(열쇠가 있을 때).
// 가리키면 무엇을 하는지 한 줄을 머리줄 오른쪽(보조 글 자리)에 쓴다.
import { PAL } from '../../render/palette.js';
import { W, H, text, measure } from '../../render/gfx.js';
import { flowLayer } from '../../render/light.js';
import { button, btnW, buttonRow, rowWidth } from '../ui.js';
import { setLang, getLang } from '../lang.js';
import { PAGE, BTN_H, SP, LINE, GROUP, textY } from '../frame.js';
import { pageHead, bottomBar, groupLayout, groupPanel, labelGap } from './common.js';
import { diceIcon } from '../../render/dice.js';

// 이름 바꾸기가 서버에 닿지 못했을 때(순위 화면의 「순위를 불러오지 못했어요」와 다른 일)
export const REROLL_FAIL = '이름을 바꾸지 못했어요 · 연결을 확인해 주세요';
export const TELEMETRY_TIP = '익명으로 판 결과만 보내요 · 화면은 수집하지 않아요';
// 이름 바꾸기를 가리키면 머리줄 오른쪽에 뜨는 한 줄(오늘 남은 횟수 — 서버가 알려 준 뒤에만)
export const rerollTip = (left) => (left == null ? '순위에 오르는 이름을 바꿔요' : left > 0 ? `오늘 ${left}번 더 바꿀 수 있어요` : '오늘은 더 바꿀 수 없어요 · 내일 다시 바꿀 수 있어요');
export const LINK_TIP = '로그인하거나 다른 기기와 연결해요';
// 계정 단추: 순위에 닿는 곳 · 판 밖에서만. 누르면 계정 화면(탭 「아이디」 · 「기기 연결」)
export const linkShown = (app) => !!app.rank.allowed && !app.run;
export const LINK_LABEL = '계정';
export const linkW = () => btnW(LINK_LABEL);

// 묶음마다 둥근 남색 판넬(29절 「묶음」 — 시안 A2): 이름(금빛 굵게) → 4 → 줄들(단추 줄 18, 사이 2), 판넬 사이 8.
// 줄: 이름표(크림) 왼쪽, 단추는 칸의 이름표 열 끝(판넬 안에서 가장 긴 이름표 + 16, 두 칸이 안 들어가면 12 · 8)
// ± 단추: 둘 + 숫자 칸이 단추 하나의 폭과 같게(묶음 안 단추 끝이 한 줄로 선다)
export const stepBtnW = () => Math.floor((togW() - NUM_W - IN * 2) / 2);
const NUM_W = 24;                          // ± 사이 숫자 칸
const ROW = BTN_H, IN = SP.s;
const SPEEDS = [1, 2, 4];
// 단추 열의 단추 하나짜리 줄(켬 · 끔 · 언어 · 다시 보기 · 이름 바꾸기)는 모두 같은 폭(가장 넓은 글)
export const togW = () => Math.max(...['켬', '끔', getLang() === 'en' ? 'English' : '한국어', '다시 보기'].map((s) => btnW(s)), btnW('이름 바꾸기', { icon: true }));
const speedW = () => rowWidth(SPEEDS.map((v) => ({ label: `×${v}` })), { gap: IN, min: 0 }).w;
const stepW = () => stepBtnW() * 2 + NUM_W + IN * 2;

// 묶음 넷(칸 0 · 1). 줄: { label, kind: 'step' | 'tog' | 'lang' | 'speed' | 'btn' | 'name' | 'reroll' }
export function settingsSections(app) {
  const me = app.rank.player();
  return [
    { col: 0, title: '소리', rows: [{ label: '소리', kind: 'step', key: 'volume', id: 'vol' }, { label: '음악', kind: 'step', key: 'music', id: 'mus' }] },
    { col: 0, title: '화면', rows: [{ label: '화면 흔들림', kind: 'tog', id: 'shake' }, { label: '움직임 줄이기', kind: 'tog', id: 'calm' }, { label: '큰 글자', kind: 'tog', id: 'big' }, { label: '언어', kind: 'lang', id: 'lang' }] },
    { col: 1, title: '플레이', rows: [{ label: '연출 속도', kind: 'speed' }, { label: '복기', kind: 'tog', id: 'replay' }, { label: '도움말 팁', kind: 'tog', id: 'coach' }, { label: '', kind: 'btn', id: 'coachReset' }] },
    { col: 1, title: me ? '순위 · 기록' : '기록', rows: [...(me ? [{ label: '이름', kind: 'name', name: me.name }, { label: '', kind: 'reroll' }] : []), { label: '플레이 기록 전송', kind: 'tog', id: 'telemetry' }] },
  ];
}
const ctlW = (r) => ({ step: stepW(), tog: togW(), lang: togW(), speed: speedW(), btn: togW(), reroll: togW(), name: 0 }[r.kind]);
const rowH = (r) => (r.kind === 'name' ? LINE : ROW);
// 칸 자리(재는 쪽 test/layout.test.js와 같이 쓴다): 칸마다 { x, w, lw(이름표 열), secs: [{ title, y, h, rows: [{ ...줄, y }] }] }, 끝 y(bottom).
// 두 칸의 끝 판넬은 아랫변을 같이 맞춘다(짧은 칸의 끝 판넬이 늘어난다 — 판넬 높이가 엇갈리지 않게)
export function settingsLayout(app) {
  const secs = settingsSections(app);
  const colsAt = (lg) => [0, 1].map((c) => {
    const mine = secs.filter((s) => s.col === c), rows = mine.flatMap((s) => s.rows);
    const lw = Math.max(...rows.filter((r) => r.kind !== 'name' && r.label).map((r) => measure(r.label))) + lg;
    return { lw, need: GROUP.padX * 2 + lw + Math.max(...rows.map(ctlW)), secs: mine };
  });
  const avail = W - PAGE.titleX * 2;
  const cols = colsAt(labelGap((g) => { const c = colsAt(g); return avail - c[0].need - c[1].need >= SP.m; }));
  // 칸 사이는 남는 만큼(24 · 16 · 12 · 8 중 들어가는 가장 큰 것)
  const room = avail - cols[0].need - cols[1].need;
  const gap = [SP.xxl, SP.xl, SP.l, SP.m].find((g) => g <= room) ?? SP.m;
  cols[0].x = PAGE.titleX; cols[0].w = cols[0].need;
  cols[1].x = PAGE.titleX + cols[0].need + gap; cols[1].w = W - PAGE.titleX - cols[1].x;
  let bottom = 0;
  for (const c of cols) {
    let y = PAGE.bodyY;
    c.secs = c.secs.map((s, k) => {
      if (k) y += GROUP.gap;
      const g = groupLayout(y, s.rows.map((r) => ({ h: rowH(r), kind: 'btn' })), { name: true });
      const out = { title: s.title, y, h: g.h, rows: s.rows.map((r, i) => ({ ...r, y: g.rows[i] })) };
      y += g.h;
      return out;
    });
    bottom = Math.max(bottom, y);
  }
  for (const c of cols) { const last = c.secs[c.secs.length - 1]; last.h = bottom - last.y; }
  return { cols, bottom };
}

export class SettingsScreen {
  constructor(app, { back = null } = {}) { this.app = app; this.back = back; }
  get opaque() { return true; } // 바탕을 다 덮는다 — 여백 판도 어둡게 하지 않는다(app.surround)
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const app = this.app, s = app.settings, me = app.rank.player();
    // 덮개지만 판 밖 화면처럼 바탕을 다 덮는다(밑 화면이 비치지 않게 — 판 밖 남색)
    flowLayer(ctx, app.time, null, -8, -8, W + 16, H + 16);
    // 가리킨 단추의 풀이 한 줄은 머리줄 오른쪽 보조 글 자리
    const aux = ui.isHover('set:telemetry') ? TELEMETRY_TIP : me && ui.isHover('set:name') ? rerollTip(me.rerolls) : ui.isHover('set:link') ? LINK_TIP : null;
    pageHead(ctx, '설정', aux, { big: true });
    const set = (k, v) => { s[k] = v; app.saveSettings(); if (app.audio) app.audio.apply(s); app.track('setting_change', { key: k, value: v }, { always: true }); };
    const lay = settingsLayout(app);
    // 손가락 구역(CHM-52): 줄 사이 틈(2)을 반씩, 옆 단추 사이(4)도 반씩
    const G = { u: GROUP.btnGap >> 1, d: GROUP.btnGap >> 1, l: IN >> 1, r: IN >> 1 };
    const tog = {
      shake: [s.shake, () => set('shake', !s.shake)],
      calm: [s.calm, () => set('calm', !s.calm)],
      big: [s.big, () => set('big', !s.big)],
      replay: [s.replay !== false, () => set('replay', s.replay === false)],
      coach: [s.coach !== false, () => set('coach', s.coach === false)],
      telemetry: [s.telemetry !== false, () => app.setTelemetry(s.telemetry === false)],
    };
    const step = (key, d) => set(key, Math.max(0, Math.min(1, Math.round((s[key] + d) * 10) / 10)));
    for (const c of lay.cols) {
      const lx = c.x + GROUP.padX, cx = lx + c.lw;
      for (const sec of c.secs) groupPanel(ctx, c.x, sec.y, c.w, sec.h, { name: sec.title }, () => {
        for (const r of sec.rows) {
          const y = r.y, ty = textY(y, rowH(r));
          if (r.label && r.kind !== 'name') text(ctx, r.label, lx, ty, PAL.ink);
          if (r.kind === 'step') {
            const SW = stepBtnW();
            button(ctx, ui, `set:${r.id}-`, cx, y, SW, ROW, '-', { onClick: () => step(r.key, -0.1), grow: G });
            text(ctx, `${Math.round(s[r.key] * 10)}`, cx + SW + IN + NUM_W / 2, ty, PAL.ink, { align: 'center', bold: true });
            button(ctx, ui, `set:${r.id}+`, cx + SW + IN * 2 + NUM_W, y, SW, ROW, '+', { onClick: () => step(r.key, 0.1), grow: G });
          } else if (r.kind === 'tog') {
            const [on, go] = tog[r.id];
            button(ctx, ui, `set:${r.id}`, cx, y, togW(), ROW, on ? '켬' : '끔', { onClick: go, tone: on ? 'gold' : 'plain', grow: G });
          } else if (r.kind === 'lang') {
            button(ctx, ui, 'set:lang', cx, y, togW(), ROW, s.lang === 'en' ? 'English' : '한국어', { onClick: () => { set('lang', s.lang === 'en' ? 'ko' : 'en'); setLang(s.lang); }, grow: G });
          } else if (r.kind === 'speed') {
            buttonRow(ctx, ui, SPEEDS.map((v) => ({ id: `set:speed${v}`, label: `×${v}`, tone: s.speed === v ? 'gold' : 'plain', onClick: () => set('speed', v), grow: G })), cx, y, { gap: IN, min: 0 });
          } else if (r.kind === 'btn') {
            button(ctx, ui, 'set:coachReset', cx, y, ctlW(r), ROW, '다시 보기', { onClick: () => { app.records.coachSeen = {}; app.saveRecords(); set('coach', true); app.toast('도움말 팁을 처음부터 다시 봐요', PAL.gold); }, grow: G });
          } else if (r.kind === 'name') {
            // 이름은 단추 열에, 거기 안 들어가면(가장 긴 영어 이름) 이름표 바로 뒤에
            const nw = measure(r.name, true), nx = cx + nw <= c.x + c.w - GROUP.padX ? cx : lx + measure(r.label) + SP.m;
            text(ctx, r.label, lx, ty, PAL.ink);
            text(ctx, r.name, nx, ty, PAL.gold, { bold: true });
          } else if (r.kind === 'reroll') {
            button(ctx, ui, 'set:name', cx, y, togW(), ROW, '이름 바꾸기', { icon: diceIcon, enabled: !this.rolling && me.rerolls !== 0, onClick: () => this.reroll(), grow: G });
          }
        }
      });
    }
    bottomBar(ctx, ui, {
      back: { id: 'set:back', onClick: () => this.close(), grow: G },
      extras: [
        { id: 'set:lessons', label: '튜토리얼', onClick: () => { app.closeOverlay(); app.guide = null; if (app.run && app.run.scratch) app.run = null; app.fx.clear(); app.go('lessons'); }, grow: G },
        { id: 'set:export', label: '기록 내보내기', onClick: () => app.exportRuns(), grow: G },
      ],
      primary: linkShown(app) ? { id: 'set:link', label: LINK_LABEL, onClick: () => { app.closeOverlay(); app.go('account'); }, grow: G } : null,
    });
  }
  // 이름 바꾸기: 서버가 새 이름을 뽑는다. 닿지 못하면 한 줄 알림
  reroll() {
    const app = this.app;
    if (this.rolling) return;
    this.rolling = true;
    app.sfx('pick');
    app.rank.reroll().then((r) => {
      this.rolling = false;
      if (r.ok) { app.track('name_reroll', {}, { always: true }); return; }
      app.toast(r.why === 'limit' ? '오늘은 더 바꿀 수 없어요' : REROLL_FAIL, PAL.ink);
    }, () => { this.rolling = false; });
  }
  close() { if (this.back) this.app.openOverlay(this.back); else this.app.closeOverlay(); }
  key(k) { if (k === 'Escape' || k === 'Enter') this.close(); }
}
