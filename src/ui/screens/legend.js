// 전설 완성: 화면이 멈추고 → 그 명국의 마지막 수를 판 위에 다시 두고 → 금박 격언이 떨어져 여섯째 칸에 박힌다 + 전용 한 소절.
// 누르거나 Enter면 끝 장면으로 건너뛴다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite, line } from '../../render/gfx.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { maximCard } from '../parts.js';
import { REPLAYS, sqOf } from '../replays.js';

const Q = 20, MX = 24, MY = 58; // 작은 판: 칸 20px
// 작은 판의 기물은 칸(20px) 안에 들게 줄여 그린다(16×22 → 14×19)
const MK = 19 / 22;
const mini = (ctx, t, side, x, y) => sprite(ctx, t, side, x + 2, y - 2, { sx: MK, sy: MK });
const STEP = 0.6, T_FREEZE = 0.5;

export class LegendScreen {
  constructor(app, { legend }) {
    this.app = app;
    this.id = legend;
    this.l = LEGEND_BY_ID[legend];
    this.rp = REPLAYS[legend] || { pieces: [], moves: [], end: null };
    this.t = 0;
    this.tDrop = T_FREEZE + this.rp.moves.length * STEP + 0.8;
    this.tDone = this.tDrop + 0.9;
    this.rang = false;
    app.sfx('legend');
    app.hitstop(0.2);
  }
  update(dt) {
    const before = this.t;
    this.t += dt * this.app.speed();
    this.rp.moves.forEach((m, i) => { const at = T_FREEZE + i * STEP + 0.25; if (before < at && this.t >= at) this.app.sfx(i === this.rp.moves.length - 1 ? 'mate' : 'drop'); });
    if (before < this.tDrop + 0.5 && this.t >= this.tDrop + 0.5) { this.app.sfx('promote'); this.app.shake(2, 0.2); }
  }
  // 수 i가 지난 뒤의 판(기물 위치)
  board(upto) {
    const at = new Map();
    for (const [t, side, sq] of this.rp.pieces) at.set(sq, { t, side });
    for (let i = 0; i < upto; i++) {
      const [a, b] = this.rp.moves[i];
      const p = at.get(a);
      at.delete(a);
      if (p) at.set(b, p);
    }
    return at;
  }
  xy(name) { const { f, r } = sqOf(name); return { x: MX + f * Q, y: MY + (7 - r) * Q }; }
  drawReplay(ctx) {
    const t = this.t - T_FREEZE;
    box(ctx, MX - 4, MY - 4, Q * 8 + 8, Q * 8 + 8, PAL.frame, PAL.frameDk);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) rect(ctx, MX + f * Q, MY + r * Q, Q, Q, (r + f) % 2 ? PAL.dark : PAL.light);
    const n = this.rp.moves.length;
    const done = Math.max(0, Math.min(n, Math.floor(t / STEP)));
    const cur = t >= 0 && done < n ? done : -1;
    const p = cur >= 0 ? Math.min(1, (t - cur * STEP) / 0.3) : 0;
    const at = this.board(done);
    // 지나온 수의 선
    for (let i = 0; i < done; i++) { const a = this.xy(this.rp.moves[i][0]), b = this.xy(this.rp.moves[i][1]); line(ctx, a.x + 10, a.y + 10, b.x + 10, b.y + 10, PAL.gold); }
    const moving = cur >= 0 ? this.rp.moves[cur] : null;
    for (const [sq, pc] of at) {
      if (moving && sq === moving[0]) continue;
      if (moving && sq === moving[1] && p >= 1) continue;
      const { x, y } = this.xy(sq);
      const falling = this.rp.end === 'mate' && done >= n && sq === this.rp.king;
      const gold = this.rp.end === 'promote' && done >= n && pc.t === 'P' && sqOf(sq).r === 7;
      if (falling) {
        const k = Math.min(1, (t - n * STEP) / 0.5);
        ctx.save(); ctx.translate(x + 10, y + Q); ctx.rotate(k * k * Math.PI / 2); ctx.globalAlpha = 1 - k * 0.4;
        ctx.scale(MK, MK); sprite(ctx, 'K', pc.side, -8, -21); ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      mini(ctx, gold ? 'Q' : pc.t, gold ? 'q' : pc.side, x, y);
    }
    if (moving) {
      const pc = this.board(cur).get(moving[0]);
      const a = this.xy(moving[0]), b = this.xy(moving[1]);
      if (pc) mini(ctx, pc.t, pc.side, a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p);
      if (p >= 1) frame(ctx, b.x, b.y, Q, Q, PAL.gold);
    }
    if (done >= n && this.rp.end) {
      const mark = this.rp.end === 'mate' ? '#' : this.rp.end === 'check' ? '+' : '=Q';
      text(ctx, mark, MX + Q * 8 - 4, MY + 2, PAL.gold, { align: 'right', bold: true, scale: 2, shadow: PAL.shadow });
    }
  }
  draw(ctx, ui) {
    const l = this.l, t = this.t;
    // 멈춤: 금빛 번쩍
    if (t < T_FREEZE) { ctx.globalAlpha = 0.5 * (1 - t / T_FREEZE); rect(ctx, 0, 0, W, H, PAL.goldHi); ctx.globalAlpha = 1; }
    text(ctx, '불멸의 기보', W / 2, 8, PAL.goldDk, { align: 'center', bold: true });
    text(ctx, l.name, W / 2, 22, PAL.gold, { align: 'center', bold: true, scale: 2, shadow: PAL.shadow });
    this.drawReplay(ctx);
    // 가운데: 해 · 이야기 · 전설 효과(떨어진 뒤)
    const cx = 268;
    if (l.year) text(ctx, String(l.year), cx, 62, PAL.dim, { align: 'center' });
    wrap(l.story, 150).forEach((s, i) => text(ctx, s, cx, 78 + i * 13, PAL.ink, { align: 'center' }));
    if (t >= this.tDrop + 0.4) {
      const a = Math.min(1, (t - this.tDrop - 0.4) / 0.4);
      wrap(l.text, 150).forEach((s, i) => text(ctx, s, cx, 138 + i * 13, PAL.gold, { align: 'center', alpha: a }));
    }
    // 오른쪽: 격언 칸. 금박 격언이 위에서 떨어져 여섯째 칸에 박힌다
    const run = this.app.run;
    const RX = 356, RW = 112;
    const maxims = run ? run.maxims.filter((m) => m.id !== this.id) : [];
    const slots = Math.max(6, maxims.length + 1);
    const h = Math.min(28, Math.floor((200 + 4) / slots) - 4);
    maxims.forEach((m, i) => maximCard(ctx, m, RX, 50 + i * (h + 4), RW, h, { t: ui.time }));
    const slotY = 50 + maxims.length * (h + 4);
    const k = Math.max(0, Math.min(1, (t - this.tDrop) / 0.5));
    const y = Math.round(-40 + (slotY + 40) * (k * k));
    if (k < 1) frame(ctx, RX, slotY, RW, h, PAL.goldDk);
    if (t >= this.tDrop) {
      maximCard(ctx, { id: this.id, uid: -1, edition: null }, RX, y, RW, h, { t: ui.time });
      frame(ctx, RX - 1, y - 1, RW + 2, h + 2, PAL.gold);
      if (k >= 1) {
        const r = (t - this.tDrop - 0.5) * 40;
        if (r < 30) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rect(ctx, RX + RW / 2 + Math.cos(a) * (RW / 2 + r), slotY + h / 2 + Math.sin(a) * (h / 2 + r * 0.5), 2, 2, PAL.goldHi); }
      }
    }
    button(ctx, ui, 'next', W / 2 - 40, H - 26, 80, 18, '계속', { onClick: () => this.next(), tone: t >= this.tDone ? 'gold' : 'plain' });
  }
  next() {
    if (this.t < this.tDone) { this.t = this.tDone; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); }
}
