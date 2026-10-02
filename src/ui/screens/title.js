// 타이틀: 달빛 아래의 기원. 밤하늘 · 별 · 달 · 멀리 거대한 기물 실루엣 · 안개 · 원근 체스 바닥(한 번 그려 캐시),
// 그 바닥 위에 눕힌 판에서 풀이기가 실제 규칙 · 실제 연출로 사슬을 계속 둔다(소리 없음). 반딧불 · 로고 빛 · 시연만 매 프레임.
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, H, text, rect, sprite } from '../../render/gfx.js';
import { makeCanvas, context } from '../../render/surface.js';
import { spritePixels, hiFor } from '../../render/sprites.js';
import { textImage } from '../../render/text.js';
import { L } from '../lang.js';
import { createBattle, apply } from '../../sim/battle.js';
import { bestMove } from '../../sim/solver.js';
import { Fx } from '../anim.js';
import { BattleScreen, BX, BY, S } from './battle.js';

// 시연 판이 그리는 구역은 버린다(메뉴 뒤라 누를 수 없다)
const NO_UI = { region() {}, isHover: () => false, hover: null };
const HOR = 150;

// ── 정적 배경: 장면을 게임 좌표 [x0, x0 + w) × [y0, y0 + h)에 칠한다(g의 (0, 0) = 게임 (x0, y0)).
// 게임 캔버스는 (0, 0, 480, 270)을, 여백 판은 창 전체(음수 좌표 · 480 너머)를 같은 함수로 칠한다 — 겹치는 곳은 같은 도트라 이음새가 없다.
// 하늘 · 별은 창 끝까지, 원근 바닥은 같은 소실점에서 칸이 넓어지며 이어진다. 달 · 큰 실루엣은 게임 판 안의 제자리.
const mod = (a, m) => ((a % m) + m) % m;
const SKY = ['#070c0e', '#0a1214', '#0d181a', '#10201f', '#132722', '#172d26'];
const STAR_H = HOR - 20;
// 별은 480 × 130 칸마다 90개. 게임 판이 덮는 칸(0, 0)은 예전 그대로(씨앗 7), 다른 칸은 칸 번호로 씨앗
function starCell(ci, cj) {
  let s = ci === 0 && cj === 0 ? 7 : 1 + mod((ci * 73856093) ^ (cj * 19349663), 2147483645);
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * STAR_H); out.push([ci * W + x, cj * STAR_H + y, rnd() < 0.2 ? '#fff1b8' : '#5d6f68']); }
  return out;
}
export function paintScene(g, x0, y0, w, h) {
  const x1 = x0 + w, y1 = y0 + h;
  const R = (x, y, rw, rh) => g.fillRect(x - x0, y - y0, rw, rh);
  // 하늘: 위(y < 0)는 가장 어두운 빛깔 그대로
  if (y0 < 0) { g.fillStyle = SKY[0]; R(x0, y0, w, Math.min(0, y1) - y0); }
  for (let y = Math.max(0, y0); y < Math.min(HOR, y1); y++) {
    const u = (y / HOR) * SKY.length, k = Math.min(SKY.length - 1, Math.floor(u)), f = u % 1;
    g.fillStyle = SKY[k]; R(x0, y, w, 1);
    if (k + 1 < SKY.length) { g.fillStyle = SKY[k + 1]; for (let x = x0 + mod(y - x0, 2); x < x1; x += 2) if (mod(x * 7 + y * 3, 10) / 10 < f) R(x, y, 1, 1); }
  }
  for (let cj = Math.floor(y0 / STAR_H); cj <= Math.min(0, Math.floor((y1 - 1) / STAR_H)); cj++) {
    for (let ci = Math.floor(x0 / W); ci <= Math.floor((x1 - 1) / W); ci++) for (const [x, y, col] of starCell(ci, cj)) { g.fillStyle = col; R(x, y, 1, 1); }
  }
  // 달(크레이터)과 옅은 달무리
  const MX = 404, MY = 46, MR = 20;
  for (let y = -MR - 8; y <= MR + 8; y++) for (let x = -MR - 8; x <= MR + 8; x++) {
    const d = Math.hypot(x, y);
    if (d <= MR) { g.fillStyle = d > MR - 2 ? '#d9cfae' : mod(x * 3 + y * 5, 11) === 0 ? '#cfc4a0' : '#eee5c7'; R(MX + x, MY + y, 1, 1); }
    else if (d < MR + 8 && mod(x + y, 2) === 0 && d < MR + 8 - (d - MR)) { g.fillStyle = 'rgba(238,229,199,0.08)'; R(MX + x, MY + y, 1, 1); }
  }
  for (const [x, y, r] of [[-6, -4, 4], [5, 6, 3], [8, -8, 2]]) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) { g.fillStyle = '#d6cba8'; R(MX + x + i, MY + y + j, 1, 1); }
  // 멀리 거대한 기물 실루엣(달 쪽 가장자리에 빛). 판 밖 둘은 더 멀리 있는 작은 것(넓은 여백에서만 보인다)
  const sil = (t, x, y, sc, col, rim) => { for (const [i, j, k] of spritePixels(t)) { g.fillStyle = (k === 'h' || (k === 'o' && i > 8)) && rim ? rim : col; R(x + i * sc, y + j * sc, sc, sc); } };
  sil('R', 12, 26, 6, '#0b1513', '#1c2e28');
  sil('K', 318, 8, 7, '#0a1311', '#22362f');
  sil('N', 96, 66, 4, '#0d1816', '#1d302a');
  sil('B', 250, 70, 4, '#0d1816', '#1d302a');
  sil('P', -78, 104, 2, '#0e1a17', '#1a2b26');
  sil('R', 530, 100, 2, '#0e1a17', '#1a2b26');
  // 지평선 안개
  g.fillStyle = 'rgba(46,64,60,0.5)';
  for (let y = Math.max(HOR - 26, y0); y < Math.min(HOR, y1); y++) for (let x = x0 + mod(y - x0, 2); x < x1; x += 2) if (mod(x + y * 3, 7) < (y - (HOR - 26)) / 6) R(x, y, 1, 1);
  // 원근 체스 바닥: 같은 소실점(240, 150)에서 줄을 창 끝까지 잇는다(판 아래로도 칸이 넓어지며). 같은 빛깔 칸은 한 번에 칠한다
  const N = 12;
  const rowY = (j) => HOR + Math.round(120 * Math.pow(j / N, 1.7));
  for (let j = 0; rowY(j) < y1; j++) {
    const ya = rowY(j), yb = rowY(j + 1);
    if (yb <= y0) continue;
    for (let y = Math.max(ya, y0); y < Math.min(yb, y1); y++) {
      const fw = 6 + (y - HOR) * 0.9, near = Math.min(1, (y - HOR) / 120);
      let run = x0, cur = null;
      for (let x = x0; x <= x1; x++) {
        let col = null;
        if (x < x1) {
          const k = Math.floor((x - 240) / fw + 100);
          const light = mod(k + j, 2) === 0;
          const glow = Math.max(0, 1 - Math.abs(x - 240) / 260) * near;
          col = light ? (glow > 0.45 ? '#3e4f40' : '#2a3a33') : (glow > 0.45 ? '#233129' : '#18241f');
        }
        if (col !== cur) { if (cur) { g.fillStyle = cur; R(run, y, x - run, 1); } cur = col; run = x; }
      }
    }
    if (ya >= y0) { g.fillStyle = 'rgba(0,0,0,0.25)'; R(x0, ya, w, 1); }
  }
  // 게임 판 아래(y ≥ 270)의 가까운 바닥은 차츰 밤빛에 잠긴다 — 270에서 0으로 시작해 이음새가 없고, 큰 칸이 시선을 끌지 않는다
  for (let y = Math.max(H, y0); y < y1; y++) {
    const a = Math.round(0.6 * Math.min(1, (y - H) / 200) * 100) / 100;
    if (a > 0) { g.fillStyle = `rgba(7,12,14,${a})`; R(x0, y, w, 1); }
  }
}
let backdrop = null;
function drawBackdrop() {
  const c = makeCanvas(W, H);
  paintScene(context(c), 0, 0, W, H);
  return c;
}
export const TITLE_SCENE = { key: 'title', paint: paintScene };

// ── 로고: 금빛 3단 명암 + 어두운 그림자(한 번). 몇 초마다 빛이 한 번 스친다
let logo = null;
function drawLogo() {
  const s = L('체인메이트'), sc = 3;
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
  return { c, body, w, h };
}
let glint = null;
let shadeCv = null;
function logoGlint(p) {
  const L0 = logo;
  if (!glint) glint = makeCanvas(L0.w, L0.h);
  const g = context(glint);
  g.clearRect(0, 0, L0.w, L0.h);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(L0.body, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const x = Math.round(-30 + p * (L0.w + 60));
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let y = 0; y < L0.h; y++) g.fillRect(x - Math.floor(y * 0.5), y, 5, 1);
  g.globalCompositeOperation = 'source-over';
  return glint;
}

// ── 눕힌 판: 시연 판을 오프스크린에 그리고 한 줄씩 원근으로 옮긴다(먼 줄은 좁고 촘촘하게)
const SRC = { x: BX - 6, y: BY - 6, w: S * 8 + 12, h: S * 8 + 12 };
const DST = { cx: 296, top: 146, bot: 262, wTop: 176, wBot: 262 };
const ROWS = (() => {
  const out = [];
  const n = DST.bot - DST.top;
  const iT = 1 / DST.wTop, iB = 1 / DST.wBot;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const w = DST.wTop + (DST.wBot - DST.wTop) * t;
    const v = (iT - 1 / w) / (iT - iB);
    out.push({ y: DST.top + k, w: Math.round(w), sy: Math.min(SRC.h - 1, Math.floor(v * SRC.h)), shade: 0.45 * (1 - t) });
  }
  return out;
})();

// 판 그림 속 한 점(판 캔버스 좌표) → 화면 위 자리와 그 줄의 배율
function project(bx, by) {
  const v = Math.max(0, Math.min(1, by / SRC.h));
  const iT = 1 / DST.wTop, iB = 1 / DST.wBot;
  const w = 1 / (iT - v * (iT - iB));
  const t = (w - DST.wTop) / (DST.wBot - DST.wTop);
  const y = DST.top + t * (DST.bot - DST.top);
  const s = w / SRC.w;
  return { x: DST.cx + (bx - SRC.w / 2) * s, y, s };
}

export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.round = 0;
    this.sel = 0;
    this.newBoard();
    if (!backdrop) backdrop = drawBackdrop();
    logo = null;
    this.boardCv = makeCanvas(SRC.w, SRC.h);
  }
  newBoard() {
    const k = this.round++;
    const hold = { b: createBattle({ seed: 101 + k * 7, ante: 1 + (k % 3), kind: 'practice', rules: { reboards: 0 } }) };
    this.hold = hold;
    this.fx = new Fx();
    this.demo = new BattleScreen(this.app, { quiet: true, fx: this.fx, source: { kind: 'demo', live: () => hold.b, cmd: (c) => apply(hold.b, c), run: null, after: () => { this.rest = 0.9; } } });
    this.demo.noPreview = true;
    this.demo.boardOnly = true;   // 판만 그린다(목표 막대 · 왼쪽 숫자 없음)
    this.line = null;
    this.rest = 0.8;
  }
  step() {
    const d = this.demo, b = this.hold.b;
    if (d.busy) return;
    if (this.line && this.line.length && b.status === 'chain') { d.send({ type: 'capture', sq: this.line.shift() }); return; }
    if (b.status !== 'play') { this.newBoard(); return; }
    const m = bestMove(b, { maxNodes: 4000 });
    if (!m) { this.newBoard(); return; }
    this.line = m.line.slice();
    d.send({ type: 'drop', handIndex: m.handIndex, sq: m.sq });
  }
  update(dt) {
    this.demo.update(dt);
    this.fx.update(dt * this.app.speed());
    if ((this.rest -= dt) <= 0 && !this.demo.busy) { this.rest = this.line && this.line.length ? 0.35 : 0; this.step(); }
  }
  items() {
    const app = this.app;
    const has = app.hasSave();
    const items = [];
    if (has) items.push(['title:continue', '이어 하기', () => app.continueRun()]);
    // 처음 켰으면(또는 설정 「킹과 다시 두기」) 새 판은 곧바로 킹과 두는 첫 대국부터
    items.push(['title:new', '새 판', () => (app.wantsScript() ? app.newRun({ script: true }) : app.go('setup'))]);
    items.push(['title:lesson', '수업', () => app.go('lessons')]);
    items.push(['title:daily', '오늘의 대국', () => app.newRun({ daily: true })]);
    items.push(['title:codex', '도감', () => app.go('codex')]);
    items.push(['title:records', '기록', () => app.go('records')]);
    items.push(['title:settings', '설정', () => app.openOverlay('settings')]);
    return items;
  }
  // 여백 판이 창 전체로 이어 칠하는 장면(main.js · src/render/backdrop.js)
  surroundScene() { return TITLE_SCENE; }
  draw(ctx, ui) {
    const app = this.app, time = app.time;
    if (app.pixelScale && app.pixelScale < 2 && !app.settings.big) hint(app, 'bigText', 'title:settings');
    ctx.drawImage(backdrop, 0, 0);
    this.drawDemo(ctx);
    // 반딧불 불티: 천천히 떠오르며 깜빡인다
    for (let i = 0; i < 24; i++) {
      const sx = (i * 97 + 13) % W, sy = 262 - ((i * 53 + time * (6 + (i % 5))) % 150);
      const x = Math.round(sx + Math.sin(time * 0.7 + i) * 6);
      const a = 0.35 + 0.45 * Math.max(0, Math.sin(time * 1.3 + i * 2.1));
      ctx.globalAlpha = a; rect(ctx, x, Math.round(sy), 1, 1, PAL.goldHi); ctx.globalAlpha = 1;
    }
    // 로고와 한마디
    if (!logo) logo = drawLogo();
    const lx = Math.round(W / 2 - logo.w / 2), ly = 40;
    ctx.drawImage(logo.c, lx, ly);
    const cyc = time % 5;
    if (cyc < 0.9) ctx.drawImage(logoGlint(cyc / 0.9), lx, ly);
    text(ctx, '잡고, 바뀌고, 또 잡는다', W / 2, 92, PAL.ink, { align: 'center', shadow: PAL.shadow });
    // 메뉴(왼쪽 아래): 고른 단추는 금빛 + 「›」, 나머지는 반투명 어두운 판
    const items = this.items();
    const hot = items.findIndex(([id]) => ui.isHover(id));
    if (hot >= 0) this.sel = hot;
    this.sel = Math.min(this.sel, items.length - 1);
    const bw = 112, bh = 16, x = 16, y0 = H - 12 - items.length * 20;
    items.forEach(([id, label, fn], i) => {
      const y = y0 + i * 20;
      ui.region(id, x, y, bw, bh, { onClick: fn });
      const on = i === this.sel;
      const oy = on && ui.press && ui.press.id === id ? 1 : 0;
      if (on) { rect(ctx, x, y + oy, bw, bh, PAL.gold); rect(ctx, x, y + bh - 1 + oy, bw, 1, '#6b4410'); rect(ctx, x, y + oy, bw, 1, PAL.goldHi); }
      else { ctx.globalAlpha = 0.85; rect(ctx, x, y, bw, bh, '#132019'); ctx.globalAlpha = 1; rect(ctx, x, y + bh - 1, bw, 1, PAL.frame); }
      text(ctx, label, x + 8, y + 2 + oy, on ? PAL.linkInk : PAL.ink, { bold: true });
      if (on) text(ctx, '›', x + bw - 12, y + 2 + oy, PAL.linkInk, { bold: true });
    });
  }
  // 시연 판을 바닥 위로(원근). 먼 줄일수록 밤빛에 잠긴다
  drawDemo(ctx) {
    const g = context(this.boardCv);
    g.clearRect(0, 0, SRC.w, SRC.h);
    g.save();
    g.translate(-SRC.x, -SRC.y);
    const sink = [];
    this.demo.pieceSink = sink;
    this.demo.drawBoard(g, NO_UI);
    this.demo.pieceSink = null;
    this.fx.draw(g, 1);
    g.restore();
    // 판 그림자
    ctx.globalAlpha = 0.35;
    rect(ctx, DST.cx - DST.wBot / 2 + 4, DST.bot, DST.wBot - 4, 3, '#000000');
    ctx.globalAlpha = 1;
    for (const r of ROWS) {
      const x = Math.round(DST.cx - r.w / 2);
      ctx.drawImage(this.boardCv, 0, r.sy, SRC.w, 1, x, r.y, r.w, 1);
    }
    // 먼 쪽 어둠(한 번 그려 둔 덮개)
    if (!shadeCv) {
      shadeCv = makeCanvas(W, H);
      const g2 = context(shadeCv);
      for (const r of ROWS) { g2.globalAlpha = 0.18 + r.shade; g2.fillStyle = '#0a1311'; g2.fillRect(Math.round(DST.cx - r.w / 2), r.y, r.w, 1); }
    }
    ctx.drawImage(shadeCv, 0, 0);
    // 기물은 눕힌 판 위에 세워서(먼 것부터, 멀수록 작게)
    const placed = sink.map((p) => ({ ...p, at: project(p.x + 8 - SRC.x, p.y + 21 - SRC.y) })).sort((a, b) => a.at.y - b.at.y);
    // 기물 그림(16×22 · 32×44)은 판 하나에 하나: 줄마다 배율(0.75~1.1)로 고르면 2배 화면(N 2)에서 먼 줄과 가까운 줄의 그림이 갈렸다
    const hi = hiFor(ctx);
    for (const p of placed) {
      const { x, y, s } = p.at;
      const sc = Math.max(0.6, s);
      const sx = (p.opts.sx ?? 1) * sc, sy = sc;
      sprite(ctx, p.type, p.side, Math.round(x - 8), Math.round(y - 21), { ...p.opts, sx, sy, hi });
    }
  }
  key(k) {
    const items = this.items();
    if (k === 'ArrowDown') { this.sel = (this.sel + 1) % items.length; this.app.sfx('pick'); }
    else if (k === 'ArrowUp') { this.sel = (this.sel + items.length - 1) % items.length; this.app.sfx('pick'); }
    else if (k === 'Enter' || k === ' ') items[Math.min(this.sel, items.length - 1)][2]();
  }
}
