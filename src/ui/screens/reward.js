// 대국 승리: 보상이 한 줄씩(기본 · 남은 수 · 적립 · 외통 · 넘친 목표 · 도전 상금 · 대국 중 번 상금) 쌓인다.
import { PAL } from '../../render/palette.js';
import { W, text, rect, rrect, num, measure, R_SM } from '../../render/gfx.js';
import { LINE, GAP_GROUP, SP, BTN_H, flow, inkY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { flyCoins, boldText, stepScale, CAP } from '../juice.js';
import { live } from '../../render/look.js';
import { interlude, interludeLayout, INTER } from './common.js';
import { CHALLENGE_TEXT } from '../../data/challenges.js';

// 이름 · 수치가 섞인 한 줄: 조각 [글, 굵게?, 빛깔]을 이어 그린다(이름 보통 · 수치 굵게 — 29절). align: left | center | right
const segW = (segs) => segs.reduce((n, [s, b]) => n + measure(s, b), 0);
function mixed(ctx, segs, x, y, { align = 'left' } = {}) {
  let cx = align === 'center' ? x - Math.floor(segW(segs) / 2) : align === 'right' ? x - segW(segs) : x;
  for (const [s, b, col] of segs) { text(ctx, s, cx, y, col, { bold: b }); cx += measure(s, b); }
}
const STAMP_H = BTN_H;

export class RewardScreen {
  constructor(app, { reward, events = [] }) {
    this.app = app;
    this.t = 0;
    const r = reward;
    const last = app.run.last || {};
    this.last = last;
    // [이름, 상금, 이름 뒤 수치(굵게)]
    this.lines = [['기본 보상', r.base]];
    if (r.moves) this.lines.push(['남은 수', r.moves, `${r.moves}`]);
    if (r.interest) this.lines.push(['이자', r.interest]);
    if (r.mate) this.lines.push(['체크메이트', r.mate]);
    if (r.overflow) this.lines.push(['목표 초과', r.overflow, `×${last.overflow}`]);
    if (r.challenge) this.lines.push([CHALLENGE_TEXT.purse, r.challenge]);
    if (r.earned) this.lines.push(['대국 중 얻은 상금', r.earned]);
    this.total = r.total;
    this.gold = events.some((e) => e.type === 'goldenPack');
    this.shown = 0;
    this.step = 0.32;
    this.sum = 0;      // 「합」 줄: 동전이 닿을 때마다 오른다
    this.kick = -9;    // 마지막으로 동전이 닿은 때(합이 튄다)
  }
  // 줄이 하나씩 쌓이는 동안(동전 소리는 그림이 아니다)
  animating() { return this.shown <= this.lines.length; }
  update(dt) {
    this.t += dt * this.app.speed();
    const n = Math.min(this.lines.length + 1, Math.floor(this.t / this.step));
    while (this.shown < n) {
      this.shown++;
      const line = this.lines[this.shown - 1];
      // 줄의 상금이 「$」 동전으로 솟아 「합」 줄로 날아간다(28절). 움직임 줄이기면 합이 곧바로 오른다
      if (line) this.coinsOf(this.shown - 1, line[1]);
      // 한 줄의 상금이 한 개씩 동전 소리로(최대 여섯)
      this.coins = (this.coins || 0) + (line ? Math.min(6, line[1]) : 0);
      if (!line) this.app.sfx('coin', 8);
    }
    this.coinT = (this.coinT || 0) - dt * this.app.speed();
    if (this.coins > 0 && this.coinT <= 0) { this.coins--; this.coinT = 0.05; this.app.sfx('coin', this.coinN = (this.coinN || 0) + 1); }
  }
  // 떠나면 날던 동전을 거둔다(다음 화면 — 상점 — 위로 떨어지지 않게)
  onLeave() { this.app.fx.list = this.app.fx.list.filter((e) => !e.coin); }
  coinsOf(i, v) {
    const app = this.app;
    if (app.reducedMotion || !v) { this.sum += v; this.kick = app.time; return; }
    const g = this.geom(), n = Math.max(1, Math.min(CAP.coinsLine, v));
    // 금액(오른쪽 맞춤) 바로 오른쪽 칸에서 솟아 같은 칸으로 「합」 줄까지 내려간다 — 금액 · 이름 글을 덮지 않는다
    const xr = g.x + g.w - INTER.pad - SP.s, by = g.y + g.lay.bodyY;
    flyCoins(app.fx, xr, by + g.body.rows[i] + 5, xr, by + g.body.total + 5, { n, seed: i * 17 + v, rise: 8, jitter: 0, onHit: () => { this.sum += v / n; this.kick = app.time; } });
  }
  // 점수 줄 조각: 「점수 500 / 목표 150」(이름 보통 · 수치 굵게)
  scoreSegs() {
    const last = this.last;
    return [['점수', false, PAL.ink], [' ', false, PAL.ink], [num(last.score || 0), true, PAL.ink], [' / ', false, PAL.dim], ['목표', false, PAL.ink], [' ', false, PAL.ink], [num(last.target || 0), true, PAL.ink]];
  }
  // 막간 상자 본문 쌓기(상자 안 위부터): 점수 줄 → 묶음 틈 → 보상 줄들 → 묶음 틈(가운데 가로줄) → 합 · 상금 · 금빛 꾸러미
  body() {
    const f = flow(0);
    const score = f.line();
    f.gap(GAP_GROUP);
    const rows = this.lines.map(() => f.line());
    const rule = f.y + Math.floor(GAP_GROUP / 2);
    f.gap(GAP_GROUP);
    const total = f.line(), money = f.line(), gold = this.gold ? f.line() : null;
    return { score, rows, rule, total, money, gold, h: f.y };
  }
  // 상자 자리(그리기와 동전이 같이 쓴다). 폭은 글에 맞춘다(끝없는 대국의 큰 점수 줄): 240 이상.
  // 넘친 목표 도장(제목 줄 오른쪽)이 있으면 가운데 제목과 SP.m 띄울 만큼 넓힌다(영어 「Match Won」)
  geom() {
    const last = this.last, body = this.body(), lay = interludeLayout(body.h);
    const title = last.reason === 'mate' ? '체크메이트 승리' : '대국 승리', stamp = last.overflow >= 2 ? `목표 ×${last.overflow}` : null;
    const sw = stamp ? measure(stamp, true) + SP.m * 2 : 0;
    const w = Math.max(240, segW(this.scoreSegs()) + INTER.pad * 2 + SP.m * 2, stamp ? measure(title, true) * 2 + (sw + INTER.pad + SP.m) * 2 : 0);
    return { lay, body, title, stamp, sw, w, h: lay.h, x: Math.floor((W - w) / 2), y: Math.floor((270 - lay.h) / 2) };
  }
  // 업적 알림이 피할 상자(app.js coverSpot)
  coverBox() { const g = this.geom(); return { x: g.x, y: g.y, w: g.w, h: g.h }; }
  draw(ctx, ui) {
    const app = this.app, last = this.last;
    const { body: B, title, stamp, sw, w, x, y } = this.geom();
    const done = this.shown > this.lines.length && !app.fx.list.some((f) => f.coin);
    const box = interlude(ctx, ui, x, y, w, B.h, (c, bx, by, bw) => {
      mixed(c, this.scoreSegs(), bx + (bw >> 1), by + B.score, { align: 'center' });
      // 보상 줄: 이름(흐림, 이름 뒤 수치는 굵게) · 금액(오른쪽, 굵게) — 이름 · 금액은 안쪽 SP.m
      const L0 = bx + SP.m, R0 = bx + bw - SP.m;
      this.lines.forEach(([label, v, n], i) => {
        if (i >= this.shown) return;
        mixed(c, n ? [[label, false, PAL.dim], [' ', false, PAL.dim], [n, true, PAL.dim]] : [[label, false, PAL.dim]], L0, by + B.rows[i]);
        text(c, `$${v}`, R0, by + B.rows[i], PAL.gold, { align: 'right', bold: true });
      });
      // 「합」 줄은 처음부터 서 있고 동전이 닿을 때마다 오르며 튄다(0.25초, 큰 수는 상자 밖 연출 자리에)
      rect(c, bx, by + B.rule, bw, 1, PAL.frameHi);
      text(c, '합', L0, by + B.total, PAL.ink);
      const sumS = `$${done ? this.total : Math.min(this.total, Math.round(this.sum))}`;
      const k = app.reducedMotion ? 1 : (app.time - this.kick) / 0.25;
      if (k >= 0 && k < 1) {
        live();
        openBox('fx', R0 - 60, by + B.total - 8, 60, 28, 0, { loose: true, name: '오르는 합' });
        boldText(c, sumS, R0, by + B.total + 6 - 6 * stepScale(1 + 0.6 * (1 - k)), k < 0.3 ? PAL.white : PAL.gold, { align: 'right', scale: stepScale(1 + 0.6 * (1 - k)) });
        closeBox();
      } else text(c, sumS, R0, by + B.total, PAL.gold, { align: 'right', bold: true });
      if (this.shown > this.lines.length) {
        mixed(c, [['상금', false, PAL.ink], [' ', false, PAL.ink], [`$${app.run.money}`, true, PAL.gold]], bx + (bw >> 1), by + B.money, { align: 'center' });
        if (this.gold) text(c, '금빛 팩이 상점에 나왔어요', bx + (bw >> 1), by + B.gold, PAL.gold, { align: 'center', bold: true });
      }
      // 넘친 목표 도장: 제목 줄 오른쪽 끝, 칠한 칩(모서리 R_SM)
      if (stamp) {
        const col = last.overflow >= 5 ? PAL.red : PAL.gold;
        const sx = x + w - INTER.pad - sw, sy = y + INTER.pad + ((INTER.titleH - STAMP_H) >> 1);
        openBox('edge', sx, sy, sw, STAMP_H, 1, { name: '넘친 목표' });
        rrect(c, sx, sy, sw, STAMP_H, R_SM, col);
        text(c, stamp, sx + (sw >> 1), inkY(sy, STAMP_H), PAL.cardInk, { align: 'center', bold: true });
        closeBox();
      }
    }, { title, titleCol: PAL.gold, edge: PAL.gold, name: '보상', buttons: [{ id: 'next', label: '계속', tone: 'gold', onClick: () => this.next() }] });
    return box;
  }
  next() {
    if (this.shown <= this.lines.length) { this.t = 99; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); else if (k === 'Escape') this.app.openOverlay('pause'); }
}
