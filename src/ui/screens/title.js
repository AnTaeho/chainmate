// 첫 화면(CHM-49, docs/design-notes/layout.md 「첫 화면」): 달밤 하늘에서 흰 기물이 검은 기물 다섯을 차례로 먹으며 그 모습으로 바뀐다
// (하늘의 사슬 — src/ui/skychain.js 시간표 · src/render/night.js 그림). 로고는 글자마다 정수 칸으로 오르내리고,
// 주인공 단추 하나(저장이 있으면 「이어 하기」, 없으면 「새 판」)가 금빛으로 숨 쉬며, 나머지는 아래 도트 아이콘 줄이다.
// 바탕(하늘 · 달 · 별 · 실루엣 · 가장자리 어둡기)은 여백 판이 창 전체로 같은 함수로 이어 칠한다(surroundScene).
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, rect, frame } from '../../render/gfx.js';
import { makeCanvas, context } from '../../render/surface.js';
import { textImage, textWidth, wrap } from '../../render/text.js';
import { drawIcon } from '../../render/icons.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { paintNight, drawNightLive, drawVignette, drawSky, skyScale, silShift } from '../../render/night.js';
import { skyScene, skyShake, calmScene } from '../skychain.js';
import { L } from '../lang.js';

// 멈춘 바탕(하늘 · 달)은 게임 둘레 8도트까지 한 번 칠해 둔다 — 흔들려 옮겨 깔아도 가장자리가 비지 않는다
const M = 8;
let still = null;
function stillCanvas() {
  if (!still) { still = makeCanvas(W + 2 * M, H + 2 * M); paintNight(context(still), -M, -M, W + 2 * M, H + 2 * M); }
  return still;
}
export const TITLE_SCENE = { key: 'title-night', paint: paintNight };

// ── 로고: 금빛 3단 명암 + 어두운 그림자. 글자마다 따로 구워 정수 칸으로 오르내린다(회전 없음)
function bakeLetter(s, sc) {
  const img = textImage(s, '#ffffff', true);
  const w = img.w * sc + 4, h = img.h * sc + 4;
  const c = makeCanvas(w, h), g = context(c);
  const put = (col, dx, dy) => { const t = textImage(s, col, true); g.drawImage(t.c, dx, dy, t.c.width * sc, t.h * sc); };
  put('#1a0f05', 3, 3); put('#6b4410', 2, 2);
  // 몸: 위 금빛 · 가운데 금 · 아래 짙은 금(글자 모양 안에만)
  const body = makeCanvas(w, h), b = context(body);
  const t = textImage(s, '#efbd55', true);
  b.drawImage(t.c, 0, 0, t.c.width * sc, t.h * sc);
  b.globalCompositeOperation = 'source-atop';
  const top = 3 * sc, mid = 7 * sc;
  b.fillStyle = '#fff1b8'; b.fillRect(0, 0, w, top + sc);
  b.fillStyle = '#efbd55'; b.fillRect(0, top + sc, w, mid - top);
  b.fillStyle = '#c8902c'; b.fillRect(0, mid + sc, w, h);
  b.fillStyle = '#efbd55'; b.fillRect(0, mid + sc * 3, w, h);
  g.drawImage(body, 0, 0);
  return c;
}
let logo = null;
function bakeLogo() {
  const s = L('체인메이트'), sc = 3, chars = [...s];
  const letters = [];
  chars.forEach((ch, i) => { if (ch !== ' ') letters.push({ c: bakeLetter(ch, sc), x: textWidth(chars.slice(0, i).join(''), true) * sc, i }); });
  return { s, letters, w: textWidth(s, true) * sc + 4, h: 16 * sc + 4 };
}
export const LOGO_Y = 34, SUB_Y = 82;
export const HERO = { w: 112, h: 26, y: 196 };
export const ROW = { y: 226, cw: 72, box: 22, boxH: 16 };

const ICON = { 'title:continue': 'menu_continue', 'title:new': 'menu_new', 'title:lesson': 'menu_lesson', 'title:daily': 'menu_daily', 'title:codex': 'menu_codex', 'title:records': 'menu_records', 'title:settings': 'menu_settings' };

export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.sel = 0;     // 0 = 주인공 단추, 1… = 아이콘 줄
    this.row = 1;     // 아이콘 줄에서 마지막으로 고른 칸(위아래로 오갈 때)
    this.T = 0;       // 하늘의 사슬 시계
    logo = null;
    this.snap = null;
  }
  update(dt) { this.T += dt; }
  // 메뉴: [주인공, …아이콘 줄]. 항목 · 동작은 예전과 같다. 저장이 있으면 「이어 하기」가 주인공, 「새 판」은 줄 첫 칸
  items() {
    const app = this.app;
    const has = app.hasSave();
    const cont = ['title:continue', '이어 하기', () => app.continueRun()];
    // 처음 켰으면(또는 설정 「킹과 다시 두기」) 새 판은 곧바로 킹과 두는 첫 대국부터
    const fresh = ['title:new', '새 판', () => (app.wantsScript() ? app.newRun({ script: true }) : app.go('setup'))];
    const rest = [
      ['title:lesson', '수업', () => app.go('lessons')],
      ['title:daily', '오늘의 대국', () => app.newRun({ daily: true })],
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
    return { st, shake, flash: calm ? 0 : st.flashAll, nt: calm ? 0 : this.T, tw: app.time, calm };
  }
  // 여백 판이 창 전체로 이어 칠하는 장면(main.js · src/render/backdrop.js): 멈춘 바탕 + 움직이는 층(별 · 실루엣, 흔들림을 따라) + 가장자리 어둡기
  surroundScene() {
    const f = this.snap || this.sky();
    const tw = Math.floor(f.tw * 12) / 12;
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
    if (app.pixelScale && app.pixelScale < 2 && !app.settings.big) hint(app, 'bigText', 'title:settings');
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
    drawSky(ctx, f.st, skyScale());
    ctx.restore();
    drawVignette(ctx, 0, 0, W, H);
    if (f.flash > 0) { ctx.globalAlpha = f.flash; rect(ctx, 0, 0, W, H, '#fff8e8'); ctx.globalAlpha = 1; }
    this.drawLogo(ctx, f.calm);
    text(ctx, '잡고, 바뀌고, 또 잡는다', W / 2, SUB_Y, PAL.ink, { align: 'center', bold: true, shadow: PAL.shadow });
    this.drawMenu(ctx, ui);
  }
  drawLogo(ctx, calm) {
    if (!logo || logo.s !== L('체인메이트')) logo = bakeLogo();
    const lx = Math.round(W / 2 - logo.w / 2), t = this.app.time;
    for (const { c, x, i } of logo.letters) {
      const bob = calm ? 0 : Math.round(Math.sin(t * 2.2 + i * 0.8) * 2);
      ctx.drawImage(c, lx + x, LOGO_Y + bob);
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
    ui.region(hid, hx - 4, HERO.y - 5, HERO.w + 8, ROW.y - (HERO.y - 5), { onClick: hfn });
    rect(ctx, hx + 2, HERO.y + 3, HERO.w, HERO.h, 'rgba(0,0,0,0.45)');
    if (this.sel === 0) frame(ctx, hx - 2, hy - 2, HERO.w + 4, HERO.h + 4, PAL.goldHi);
    openBox('edge', hx, hy, HERO.w, HERO.h, 0, { name: '첫 화면 단추' });
    rect(ctx, hx, hy, HERO.w, HERO.h, PAL.gold);
    rect(ctx, hx, hy, HERO.w, 2, PAL.goldHi);
    rect(ctx, hx, hy + HERO.h - 3, HERO.w, 3, '#6b4410');
    text(ctx, hlabel, W / 2, hy + 6, PAL.linkInk, { align: 'center', bold: true });
    closeBox();
    // 아이콘 줄: 같은 폭 칸, 칸마다 어두운 상자 + 도트 아이콘 + 이름(넘치면 낱말 단위 두 줄). 고른 칸은 한 칸 들리고 금빛 테
    const row = items.slice(1), n = row.length, x0 = Math.round(W / 2 - (n * ROW.cw) / 2);
    row.forEach(([id, label, fn], k) => {
      const i = k + 1, on = this.sel === i;
      const cx = x0 + k * ROW.cw + ROW.cw / 2, rx = x0 + k * ROW.cw + 2, rw = ROW.cw - 4, rh = H - ROW.y;
      ui.region(id, rx, ROW.y, rw, rh, { onClick: fn });
      openBox('tile', rx, ROW.y, rw, rh, 0, { name: id });
      const lift = (on ? 1 : 0) - pressed(id);
      const bx = cx - ROW.box / 2, by = ROW.y + 2 - lift;
      ctx.globalAlpha = 0.85; rect(ctx, bx, by, ROW.box, ROW.boxH, '#081012'); ctx.globalAlpha = 1;
      if (on) frame(ctx, bx - 1, by - 1, ROW.box + 2, ROW.boxH + 2, PAL.gold);
      drawIcon(ctx, ICON[id], cx - 6, by + 2);
      const lines = wrap(label, rw - 2);
      const ly = (lines.length > 1 ? ROW.y + 20 : ROW.y + 22) - lift;
      lines.forEach((s, j) => text(ctx, s, cx, ly + j * 11, on ? PAL.goldHi : PAL.dim, { align: 'center', shadow: PAL.shadow }));
      closeBox();
    });
  }
  key(k) {
    const items = this.items(), n = items.length;
    const pick = (i) => { if (i !== this.sel) { this.sel = i; if (i > 0) this.row = i; this.app.sfx('pick'); } };
    if (k === 'ArrowRight') pick((this.sel + 1) % n);
    else if (k === 'ArrowLeft') pick((this.sel + n - 1) % n);
    else if (k === 'ArrowUp') pick(0);
    else if (k === 'ArrowDown') { if (this.sel === 0) pick(Math.min(Math.max(1, this.row), n - 1)); }
    else if (k === 'Enter' || k === ' ') items[Math.min(this.sel, n - 1)][2]();
  }
}
