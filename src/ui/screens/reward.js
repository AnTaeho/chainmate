// 대국 승리: 보상이 한 줄씩(기본 · 남은 수 · 적립 · 외통 · 넘친 목표 · 대국 중 번 상금) 쌓인다.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, num, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { PAD_BOX, LINE, GAP_GROUP, flow, BTN_S, inkY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { flyCoins, boldText, stepScale, CAP } from '../juice.js';
import { live } from '../../render/look.js';

export class RewardScreen {
  constructor(app, { reward, events = [] }) {
    this.app = app;
    this.t = 0;
    const r = reward;
    const last = app.run.last || {};
    this.last = last;
    this.lines = [['기본 보상', r.base]];
    if (r.moves) this.lines.push([`남은 수 ${r.moves}`, r.moves]);
    if (r.interest) this.lines.push(['이자', r.interest]);
    if (r.mate) this.lines.push(['체크메이트', r.mate]);
    if (r.overflow) this.lines.push([`목표 초과 ×${last.overflow}`, r.overflow]);
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
    // 금액(오른쪽 맞춤, x + w − P − 12) 바로 오른쪽 칸에서 솟아 같은 칸으로 「합」 줄까지 내려간다 — 금액 · 이름 글을 덮지 않는다
    const xr = g.x + g.w - g.P - 4;
    flyCoins(app.fx, xr, g.y + g.lay.rows[i] + 5, xr, g.y + g.lay.total + 5, { n, seed: i * 17 + v, rise: 8, jitter: 0, onHit: () => { this.sum += v / n; this.kick = app.time; } });
  }
  // 상자 자리(그리기와 동전이 같이 쓴다)
  geom() {
    const last = this.last, lay = this.layout();
    const scoreLine = `점수 ${num(last.score || 0)} / 목표 ${num(last.target || 0)}`;
    const title = last.reason === 'mate' ? '체크메이트 승리' : '대국 승리', stamp = last.overflow >= 2 ? `목표 ×${last.overflow}` : null;
    const sw = stamp ? measure(stamp, true) + 8 : 0;
    const w = Math.max(240, measure(scoreLine) + PAD_BOX * 2 + 8, stamp ? measure(title, true) * 2 + (sw + PAD_BOX + 4) * 2 : 0), h = lay.h;
    return { lay, scoreLine, title, stamp, sw, w, h, x: Math.floor((W - w) / 2), y: Math.floor((270 - h) / 2), P: PAD_BOX };
  }
  // 막간 상자 쌓기(PAD_BOX · 토큰): 큰 제목(두 배, 줄 LINE × 2) → 묶음 틈 → 점수 줄 → 묶음 틈 → 보상 줄들 → 묶음 틈(가운데 가로줄) → 합 · 상금 · 금빛 꾸러미 → 묶음 틈 → 계속
  layout() {
    const f = flow(PAD_BOX);
    const title = f.space(LINE * 2);
    f.gap(GAP_GROUP);
    const score = f.line();
    f.gap(GAP_GROUP);
    const rows = this.lines.map(() => f.line());
    const rule = f.y + Math.floor(GAP_GROUP / 2);
    f.gap(GAP_GROUP);
    const total = f.line(), money = f.line(), gold = this.gold ? f.line() : null;
    f.gap(GAP_GROUP);
    const btn = f.space(18);
    return { title, score, rows, rule, total, money, gold, btn, h: f.y + PAD_BOX };
  }
  draw(ctx, ui) {
    const app = this.app, last = this.last;
    // 폭도 글에 맞춘다(끝없는 대국의 큰 점수 줄): 240 이상. 넘친 목표 도장(제목 옆)이 있으면 가운데 제목과 4 띄울 만큼 넓힌다(영어 「Match Won」)
    const { lay, scoreLine, title, stamp, sw, w, h, x, y, P } = this.geom();
    openBox('panel', x, y, w, h, P, { name: '보상' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
    text(ctx, title, W / 2, y + lay.title, PAL.gold, { align: 'center', bold: true, scale: 2 });
    if (stamp) {
      const col = last.overflow >= 5 ? PAL.red : PAL.gold, s = stamp;
      openBox('edge', x + w - sw - P, y + P + 6, sw, BTN_S, 1, { name: '넘친 목표' });
      box(ctx, x + w - sw - P, y + P + 6, sw, BTN_S, PAL.feltDk, col);
      text(ctx, s, x + w - P - sw / 2, inkY(y + P + 6, BTN_S), col, { align: 'center', bold: true });
      closeBox();
    }
    text(ctx, scoreLine, W / 2, y + lay.score, PAL.ink, { align: 'center' });
    this.lines.forEach(([label, v], i) => {
      if (i >= this.shown) return;
      text(ctx, label, x + P + 12, y + lay.rows[i], PAL.dim);
      text(ctx, `$${v}`, x + w - P - 12, y + lay.rows[i], PAL.gold, { align: 'right', bold: true });
    });
    // 「합」 줄은 처음부터 서 있고 동전이 닿을 때마다 오르며 튄다(0.25초, 큰 수는 상자 밖 연출 자리에)
    rect(ctx, x + P + 8, y + lay.rule, w - P * 2 - 16, 1, PAL.frameHi);
    text(ctx, '합', x + P + 12, y + lay.total, PAL.ink, { bold: true });
    const done = this.shown > this.lines.length && !app.fx.list.some((f) => f.coin);
    const sumS = `$${done ? this.total : Math.min(this.total, Math.round(this.sum))}`;
    const k = app.reducedMotion ? 1 : (app.time - this.kick) / 0.25;
    if (k >= 0 && k < 1) {
      live();
      openBox('fx', x + w - P - 60, y + lay.total - 8, 60, 28, 0, { loose: true, name: '오르는 합' });
      boldText(ctx, sumS, x + w - P - 12, y + lay.total + 6 - 6 * stepScale(1 + 0.6 * (1 - k)), k < 0.3 ? PAL.white : PAL.gold, { align: 'right', scale: stepScale(1 + 0.6 * (1 - k)) });
      closeBox();
    } else text(ctx, sumS, x + w - P - 12, y + lay.total, PAL.gold, { align: 'right', bold: true });
    if (this.shown > this.lines.length) {
      text(ctx, `상금 $${app.run.money}`, W / 2, y + lay.money, PAL.ink, { align: 'center' });
      if (this.gold) text(ctx, '금빛 팩이 상점에 나왔어요', W / 2, y + lay.gold, PAL.gold, { align: 'center', bold: true });
    }
    button(ctx, ui, 'next', W / 2 - 40, y + lay.btn, 80, 18, '계속', { onClick: () => this.next(), tone: 'gold' });
    closeBox();
  }
  next() {
    if (this.shown <= this.lines.length) { this.t = 99; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); else if (k === 'Escape') this.app.openOverlay('pause'); }
}
