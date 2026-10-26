// 첫 화면(CHM-49, docs/design-notes/layout.md 「첫 화면」): 달밤 하늘에서 흰 기물이 검은 기물 다섯을 차례로 먹으며 그 모습으로 바뀐다
// (하늘의 사슬 — src/ui/skychain.js 시간표 · src/render/night.js 그림). 로고는 글자마다 정수 칸으로 오르내리고,
// 주인공 단추 하나(저장이 있으면 「이어 하기」, 없으면 「새 판」)가 금빛으로 숨 쉬며, 나머지는 아래 아이콘 줄이다.
// 바탕(하늘 · 달 · 별 · 실루엣 · 가장자리 어둡기)은 여백 판이 창 전체로 같은 함수로 이어 칠한다(surroundScene).
import { hint, markSeen } from '../coach.js';
import { inkY, SP, BTN_HERO } from '../frame.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, rect, rrect, rframe, box, measure, selectRing, R_SM, inner } from '../../render/gfx.js';
import { pillR, EDGE_REACH } from '../ui.js';
import { makeCanvas, context } from '../../render/surface.js';
import { LOOK } from '../../render/look.js';
import { put } from '../../render/vec.js';
import { textImage, textWidth, wrap, textGen, inkBox } from '../../render/text.js';
import { drawIcon } from '../../render/icons.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { paintNight, drawNightLive, drawVignette, drawSky, skyScale, silShift, MOON } from '../../render/night.js';
import { skyScene, skyShake, calmScene } from '../skychain.js';
import { L, getLang } from '../lang.js';

// 멈춘 바탕(하늘 · 달)은 게임 둘레 8도트까지 한 번 칠해 둔다 — 흔들려 옮겨 깔아도 가장자리가 비지 않는다
const M = 8;
let still = null;
function stillCanvas() {
  if (!still) { still = makeCanvas(W + 2 * M, H + 2 * M); paintNight(context(still), -M, -M, W + 2 * M, H + 2 * M); }
  return still;
}
export const TITLE_SCENE = { key: 'title-night', paint: paintNight };

// ── 로고(안 3): 금 두 톤(위 빛 · 아래 그늘) + 잉크 남색 두께(오른쪽 아래로 세 칸 밀어 쌓는다). 글자마다 따로 구워 정수 칸으로 오르내린다(회전 없음).
// 화면 배율 n으로 구워(글꼴을 sc × n배로) 어느 N에서나 또렷하다. 명암 띠는 잰 잉크 높이의 3/11 · 7/11 자리
function bakeLetter(s, sc, n) {
  const img = textImage(s, '#ffffff', true, sc * n);
  const w = img.cw * sc + 4, h = img.h * sc + 4;
  const c = makeCanvas(Math.ceil(w * n), Math.ceil(h * n)), g = context(c);
  g.scale(n, n);
  const put = (col, dx, dy) => { const t = textImage(s, col, true, sc * n); g.drawImage(t.c, dx, dy, t.cw * sc, t.h * sc); };
  put('#0a0c22', 3, 3); put('#12153a', 2, 2); put('#12153a', 1, 1);
  // 몸: 위 금빛 · 가운데 금 · 아래 짙은 금(글자 모양 안에만)
  const body = makeCanvas(c.width, c.height), b = context(body);
  b.scale(n, n);
  const t = textImage(s, '#efbd55', true, sc * n);
  b.drawImage(t.c, 0, 0, t.cw * sc, t.h * sc);
  b.globalCompositeOperation = 'source-atop';
  const ink = inkBox(img), y0 = (ink.top - img.top) * sc, ih = ink.h * sc;
  const top = y0 + (ih * 3) / 11, mid = y0 + (ih * 7) / 11;
  b.fillStyle = '#f9d77e'; b.fillRect(0, 0, w, top);
  b.fillStyle = '#f6be45'; b.fillRect(0, top, w, mid - top);
  b.fillStyle = '#d48b1c'; b.fillRect(0, mid, w, h);
  b.fillStyle = '#d48b1c'; b.fillRect(0, mid + sc * 2, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(body, 0, 0);
  return { c, w, h, dy: img.top * sc };
}
let logo = null;
function bakeLogo() {
  const s = L('체인메이트'), sc = 3, n = LOOK.n, chars = [...s];
  const letters = [];
  chars.forEach((ch, i) => { if (ch !== ' ') letters.push({ ...bakeLetter(ch, sc, n), x: textWidth(chars.slice(0, i).join(''), true) * sc, i }); });
  return { s, n, gen: textGen(), letters, w: textWidth(s, true) * sc + 4 };
}
export const LOGO_Y = 34, SUB_Y = 82;
export const TELEMETRY_NOTE = '판 결과를 익명으로 수집해요 · 설정에서 끌 수 있어요';
export const NOTE_Y = 4, NOTE_H = 16;
// 알림 줄 오른쪽의 「처리방침」: 누르면 개인정보 처리방침 쪽을 새 탭으로 연다(CHM-72). 알림은 그대로 둔다
export const NOTE_LINK = '처리방침', NOTE_URL = 'privacy.html';
export function noteLayout() {
  const tw = measure(TELEMETRY_NOTE), lw = measure(NOTE_LINK, true), w = 8 + tw + 10 + lw + 8, x = Math.round(W / 2 - w / 2);
  return { x, w, textX: x + 8, link: { x: x + 8 + tw + 6, y: NOTE_Y, w: lw + 8, h: NOTE_H } };
}
export const HERO = { w: 112, h: BTN_HERO, y: 196, drop: SP.xs, ring: SP.s };
// 아이콘 줄 칸 폭: 여섯 칸까지 72, 일곱 칸(저장이 있을 때 — 「순위」가 든 뒤, CHM-70)이면 화면 폭에 맞춰 68
export const ROW = { y: 226, cw: 72, box: 22, boxH: 16 };
// 영어 이름이 칸 폭(64)을 넘어 두 줄이 되는 칸의 짧은 이름 — 화면 아래 끝에 붙지 않게
const ROW_SHORT_EN = { 'title:daily': 'Daily' };
export const rowCw = (n) => (n * ROW.cw > W - 4 ? Math.floor((W - 4) / n) : ROW.cw);

const ICON = { 'title:continue': 'menu_continue', 'title:new': 'menu_new', 'title:lesson': 'menu_lesson', 'title:daily': 'menu_daily', 'title:rank': 'menu_rank', 'title:codex': 'menu_codex', 'title:records': 'menu_records', 'title:settings': 'menu_settings' };


export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.sel = 0;     // 0 = 주인공 단추, 1… = 아이콘 줄
    this.row = 1;     // 아이콘 줄에서 마지막으로 고른 칸(위아래로 오갈 때)
    this.T = 0;       // 하늘의 사슬 시계
    this.snap = null;
  }
  update(dt) {
    this.T += dt;
    // 처음 켠 사람(판 · 수업 기록이 없다): 킹이 튜토리얼을 권하는 덮개(screens/welcome.js). Esc로 닫으면 이번 실행 동안은 다시 안 뜬다
    const app = this.app;
    if (!app.overlay && !app.welcomeShut && app.screen === this && app.wantsTutorial()) app.openOverlay('welcome');
  }
  // 메뉴: [주인공, …아이콘 줄]. 항목 · 동작은 예전과 같다. 저장이 있으면 「이어 하기」가 주인공, 「새 판」은 줄 첫 칸
  items() {
    const app = this.app;
    const has = app.hasSave();
    const cont = ['title:continue', '이어 하기', () => app.continueRun()];
    const fresh = ['title:new', '새 판', () => app.go('setup')];
    const rest = [
      ['title:lesson', '튜토리얼', () => app.go('lessons')],
      ['title:daily', '오늘의 대국', () => app.askNewRun({ daily: true })],
      ['title:rank', '순위', () => app.go('rank')],
      ['title:codex', '도감', () => app.go('codex')],
      ['title:records', '기록', () => app.go('records')],
      ['title:settings', '설정', () => app.openOverlay('settings')],
    ];
    return has ? [cont, fresh, ...rest] : [fresh, ...rest];
  }
  // 이 프레임의 하늘: 움직임 줄이기면 한 장면 · 실루엣 멈춤 · 흔들림 · 번쩍임 없음(별 · 달 · 단추는 그대로)
  sky() {
    const app = this.app, calm = app.reducedMotion;
    const st = calm ? calmScene() : skyScene(this.T);
    const shake = calm || !app.settings.shake ? [0, 0] : skyShake(this.T, st.shake);
    // 별 반짝임: 움직임 줄이기면 여백 판과 같은 초당 12번으로
    return { st, shake, flash: calm ? 0 : st.flashAll, nt: calm ? 0 : this.T, tw: calm ? Math.floor(app.time * 12) / 12 : app.time, calm };
  }
  // 여백 판이 창 전체로 이어 칠하는 장면(main.js · src/render/backdrop.js): 멈춘 바탕 + 움직이는 층(별 · 실루엣, 흔들림을 따라) + 가장자리 어둡기
  surroundScene() {
    const f = this.snap || this.sky();
    const tw = f.calm ? f.tw : Math.floor(f.tw * 12) / 12;
    return {
      ...TITLE_SCENE,
      live: {
        key: `${silShift(f.nt).join(',')}|${tw}|${f.shake.join(',')}`,
        shake: f.shake,
        draw: (g, x0, y0, w, h) => drawNightLive(g, x0, y0, w, h, f.nt, tw),
        over: drawVignette,
      },
    };
  }
  // 다섯째를 먹는 순간의 화면 번쩍임 — 여백 판도 같은 세기로
  surroundFlash() { const f = this.snap; return f && f.flash > 0 ? { col: '#fff8e8', a: f.flash } : null; }
  draw(ctx, ui) {
    const app = this.app;
    // 큰 글자 안내는 판을 한 번 끝낸 뒤 첫 화면에서(처음 켠 사람은 튜토리얼 · 첫 판 권유가 먼저 — U-8)
    if (app.pixelScale && app.pixelScale < 2 && !app.settings.big && (app.records.runs || 0) > 0) hint(app, 'bigText', 'title:settings');
    // 순위에 이름이 생긴 뒤 첫 화면에 돌아온 순간 한 번(CHM-70): 이름은 설정에서 다시 짓는다 — 설정 칸을 가리킨다.
    // 가리키는 네모는 설정 칸에서 화면 오른끝까지(누르지 못하는 구역 — drawMenu): 말풍선(폭 176)이 오른끝에 붙어 주인공 단추를 덮지 않는다
    if (app.rank.player()) hint(app, 'rankName', 'title:settings:tip');
    const f = (this.snap = this.sky());
    const [dx, dy] = f.shake;
    // 달밤: 멈춘 바탕 · 별 · 실루엣(흔들림을 따라 정수 칸으로 옮긴다)
    ctx.save();
    ctx.translate(dx - M, dy - M);
    ctx.drawImage(stillCanvas(), 0, 0);
    drawNightLive(ctx, -M, -M, W + 2 * M, H + 2 * M, f.nt, f.tw);
    ctx.restore();
    // 하늘의 사슬
    ctx.save();
    ctx.translate(dx, dy);
    // 「×N」은 부제(그림자 한 줄 포함) 밑변 아래 두 도트까지만 튄다 — 흔들림만큼 옮긴 좌표로(CHM-48)
    const sw = textWidth('잡고, 변하고, 또 잡는다', true);
    drawSky(ctx, f.st, skyScale(), { x0: W / 2 - sw / 2 - dx, x1: W / 2 + sw / 2 - dx, y1: SUB_Y + 14 - dy });
    ctx.restore();
    drawVignette(ctx, 0, 0, W, H);
    if (f.flash > 0) { ctx.globalAlpha = f.flash; rect(ctx, 0, 0, W, H, '#fff8e8'); ctx.globalAlpha = 1; }
    this.drawLogo(ctx, f.calm);
    text(ctx, '잡고, 변하고, 또 잡는다', W / 2, SUB_Y, PAL.ink, { align: 'center', bold: true, shadow: PAL.shadow });
    this.drawMenu(ctx, ui);
    this.drawNote(ctx);
  }
  // 기록 보내기 알림(CHM-63): 켜져 있으면 처음 한 번, 화면 맨 위 작은 줄. 무엇이든 누르면 사라지고 다시 안 뜬다(설정 「다시 보기」로 되살린다)
  noteOn() { const app = this.app; return app.settings.telemetry !== false && !(app.records.coachSeen && app.records.coachSeen.telemetry); }
  seeNote() { if (this.noteOn()) markSeen(this.app, 'telemetry'); }
  pointerDown(x, y) {
    if (this.noteOn() && x != null) {
      const k = noteLayout().link;
      if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h + 4) { this.app.openPage(NOTE_URL); return; }
    }
    this.seeNote();
  }
  drawNote(ctx) {
    if (!this.noteOn()) return;
    const { x, w, textX, link } = noteLayout();
    const r = pillR(w, NOTE_H, w - 16);
    openBox('edge', x, NOTE_Y, w, NOTE_H, 0, { name: '기록 알림', r });
    ctx.globalAlpha = 0.8; rrect(ctx, x, NOTE_Y, w, NOTE_H, r, PAL.deep); ctx.globalAlpha = 1;
    text(ctx, TELEMETRY_NOTE, textX, inkY(NOTE_Y, NOTE_H), PAL.ink);
    text(ctx, NOTE_LINK, link.x + 4, inkY(NOTE_Y, NOTE_H), PAL.gold, { bold: true });
    closeBox();
  }
  drawLogo(ctx, calm) {
    // 말이 바뀌거나 글꼴이 다시 오면(글자 캐시를 비우면) 다시 굽는다
    if (!logo || logo.s !== L('체인메이트') || logo.gen !== textGen() || logo.n !== LOOK.n) logo = bakeLogo();
    // 가운데에 두되 달(원판) 왼쪽 8 앞에서 멈춘다 — 영어 「CHAINMATE」는 가운데면 달에 닿는다
    const lx = Math.min(Math.round(W / 2 - logo.w / 2), MOON.x - MOON.r - SP.m - logo.w), t = this.app.time;
    for (const { c, x, i, w, h, dy } of logo.letters) {
      const bob = calm ? 0 : Math.round(Math.sin(t * 2.2 + i * 0.8) * 2);
      put(ctx, c, logo.n, lx + x, LOGO_Y + bob + dy, w, h);
    }
  }
  drawMenu(ctx, ui) {
    const app = this.app, items = this.items();
    const hot = items.findIndex(([id]) => ui.isHover(id));
    if (hot >= 0) { this.sel = hot; if (hot > 0) this.row = hot; }
    this.sel = Math.min(this.sel, items.length - 1);
    const pressed = (id) => (ui.press && ui.press.id === id ? 1 : 0);
    // 주인공 단추: 금빛, 위로 한 칸 숨 쉰다. 고르면 옅은 금 테
    const [hid, hlabel, hfn] = items[0];
    const hx = W / 2 - HERO.w / 2, up = Math.round(Math.max(0, Math.sin(app.time * 3))) - pressed(hid);
    const hy = HERO.y - up;
    const R = HERO.ring;
    ui.region(hid, hx - R, HERO.y - R, HERO.w + R * 2, ROW.y - (HERO.y - R), { onClick: hfn });
    // 금빛 알약(ui.js button과 같은 문법, 높이 BTN_HERO): 잉크 테 1 + 아래 잉크 그림자(숨 쉬어도 그림자는 바닥에), 고르면 바깥 크림 고리
    const pr = pillR(HERO.w, HERO.h, measure(hlabel, true));
    rrect(ctx, hx, HERO.y + HERO.drop, HERO.w, HERO.h, pr, PAL.drop);
    if (this.sel === 0) rframe(ctx, hx - R, hy - R, HERO.w + R * 2, HERO.h + R * 2, pr + R, PAL.edge, 1);
    openBox('edge', hx, hy, HERO.w, HERO.h, 1, { name: '첫 화면 단추', r: pr });
    rrect(ctx, hx, hy, HERO.w, HERO.h, pr, PAL.frameDk);
    inner(ctx, hx, hy, HERO.w, HERO.h, pr - 1, ui.isHover(hid) ? PAL.goldHi : PAL.gold);
    text(ctx, hlabel, W / 2, inkY(hy, HERO.h), PAL.cardInk, { align: 'center', bold: true });
    closeBox();
    // 아이콘 줄: 같은 폭 칸, 칸마다 둥근 남색 칸 + 벡터 아이콘 + 이름(넘치면 낱말 단위 두 줄). 고른 칸은 한 칸 들리고 금빛 테
    const row = items.slice(1), n = row.length, CW = rowCw(n), x0 = Math.round(W / 2 - (n * CW) / 2);
    row.forEach(([id, label, fn], k) => {
      const i = k + 1, on = this.sel === i;
      const cx = x0 + k * CW + CW / 2, rx = x0 + k * CW + 2, rw = CW - 4, rh = H - ROW.y;
      // 손가락: 누르는 구역은 캔버스 밑 여백(창 끝 비움)까지 — 아이콘 칸 아래쪽을 누르면 iOS 도구 막대 띠에 걸렸다(P-2)
      ui.region(id, rx, ROW.y, rw, rh + (ui.finger ? EDGE_REACH : 0), { onClick: fn });
      if (id === 'title:settings') ui.region('title:settings:tip', rx, ROW.y, W - 2 - rx, rh, { passive: true });
      openBox('tile', rx, ROW.y, rw, rh, 0, { name: id });
      const lift = (on ? 1 : 0) - pressed(id);
      const bx = cx - ROW.box / 2, by = ROW.y + 2 - lift;
      // 아이콘 칸: 둥근 남색 칸(잉크 테), 고르면 바깥 금빛 고리. 기록 알림이 떠 있는 동안 설정 칸에 금빛 고리가 깜박인다
      const blink = id === 'title:settings' && this.noteOn() && (app.reducedMotion || Math.floor(app.time * 2) % 2 === 0);
      box(ctx, bx, by, ROW.box, ROW.boxH, PAL.feltDk, PAL.frameDk, { r: R_SM, drop: on ? 2 : 1 });
      if (on || blink) selectRing(ctx, bx, by, ROW.box, ROW.boxH, { r: R_SM, col: on ? PAL.gold : PAL.goldHi });
      drawIcon(ctx, ICON[id], cx - 6, by + 2);
      // 일곱 칸(폭 68)은 구역 폭을 다 쓴다 — 「오늘의 대국」(63)이 한 줄에 들어간다. 영어가 두 줄이면 짧은 이름(ROW_SHORT_EN)
      let lines = wrap(label, n > 6 ? rw : rw - 2);
      if (lines.length > 1 && getLang() === 'en' && ROW_SHORT_EN[id]) lines = [ROW_SHORT_EN[id]];
      const ly = (lines.length > 1 ? ROW.y + 20 : ROW.y + 2 + ROW.boxH + SP.s) - lift;
      lines.forEach((s, j) => text(ctx, s, cx, ly + j * 11, on ? PAL.goldHi : PAL.dim, { align: 'center', shadow: PAL.shadow }));
      closeBox();
    });
  }
  key(k) {
    this.seeNote();
    const items = this.items(), n = items.length;
    const pick = (i) => { if (i !== this.sel) { this.sel = i; if (i > 0) this.row = i; this.app.sfx('pick'); } };
    if (k === 'ArrowRight') pick((this.sel + 1) % n);
    else if (k === 'ArrowLeft') pick((this.sel + n - 1) % n);
    else if (k === 'ArrowUp') pick(0);
    else if (k === 'ArrowDown') { if (this.sel === 0) pick(Math.min(Math.max(1, this.row), n - 1)); }
    else if (k === 'Enter' || k === ' ') items[Math.min(this.sel, n - 1)][2]();
  }
}
