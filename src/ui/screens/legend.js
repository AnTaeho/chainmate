// 전설 완성: 화면이 멈추고 → 그 명국의 마지막 수를 판 위에 다시 두고 → 금박 격언이 떨어져 여섯째 칸에 박힌다 + 전용 한 소절.
// 누르거나 Enter면 끝 장면으로 건너뛴다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, rframe, sprite, seg, slot, R_SM } from '../../render/gfx.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { wrap } from '../../render/text.js';
import { maximCellH, maximCard, maximTip, edgeRing } from '../parts.js';
import { REPLAYS, sqOf } from '../replays.js';
import { LIST_GAP, LINE, SP, flow } from '../frame.js';
import { interlude, interludeLayout, INTER } from './common.js';

// 막간 상자: 화면 끝 여백 SP.m 안 온 폭 · 온 높이. 본문(판 · 이야기 · 격언 칸)은 제목과 「계속」 사이
const BOX = { x: SP.m, y: SP.m, w: W - SP.m * 2, h: H - SP.m * 2 };
const BODY_H = BOX.h - (interludeLayout(1).h - 1);
const BODY = { x: BOX.x + INTER.pad, y: BOX.y + interludeLayout(1).bodyY, w: BOX.w - INTER.pad * 2, h: BODY_H };
// 작은 판: 칸 18px, 테 4 — 본문 높이 가운데
const Q = 18, FR = SP.s, MX = BODY.x + FR, MY = BODY.y + ((BODY.h - Q * 8) >> 1);
// 작은 판의 기물은 칸(18px) 안에 들게 줄여 그린다(16×22 → 13×17)
const MK = 17 / 22;
const mini = (ctx, t, side, x, y) => sprite(ctx, t, side, x + 1, y - 4, { sx: MK, sy: MK });
const STEP = 0.6, T_FREEZE = 0.5;

// 오른쪽 격언 칸 자리: 판 윗변부터 상자 안 아랫변까지(「계속」은 가운데라 겹치지 않는다).
// 가진 격언은 칸이 다 들어가면 한 줄(이름 한 줄 칸), 안 들어가면 2 · 3 · 4줄로 나란히(아이콘만 — maximColumn과 같다).
// 새 전설 칸은 늘 맨 아래 폭 112 한 줄(이름이 보인다). 아이콘(24)이 들어가는 칸 폭은 4줄(26)까지라
// 가진 격언 20개(4줄 × 5칸)까지 화면 안이다 — 격언 칸 5 + 흑요 10 + 다른 전설 4 = 19가 규칙상 넉넉한 최대.
export const LEGEND_RW = 112, LEGEND_RX = BODY.x + BODY.w - LEGEND_RW, LEGEND_TOP = MY - FR, LEGEND_BOT = BOX.y + BOX.h - INTER.pad;
export function legendSlots(nOthers) {
  const h = maximCellH(), step = h + LIST_GAP;
  const fitRows = Math.max(0, Math.floor((LEGEND_BOT - LEGEND_TOP - h) / step));
  let cols = 1;
  while (cols < 4 && Math.ceil(nOthers / cols) > fitRows) cols++;
  const cw = cols === 1 ? LEGEND_RW : Math.floor((LEGEND_RW - (cols - 1) * LIST_GAP) / cols);
  const rows = Math.ceil(nOthers / cols);
  const rects = [];
  for (let i = 0; i < nOthers; i++) rects.push({ x: LEGEND_RX + (i % cols) * (cw + LIST_GAP), y: LEGEND_TOP + Math.floor(i / cols) * step, w: cw, h });
  const slot = { x: LEGEND_RX, y: LEGEND_TOP + rows * step, w: LEGEND_RW, h };
  return { cols, cw, rows, h, rects, slot, narrow: cols > 1 };
}

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
  // 멈춤 · 다시 두기 · 격언이 떨어져 빛살이 퍼질 때까지
  animating() { return this.t < this.tDrop + 1.3; }
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
    box(ctx, MX - FR, MY - FR, Q * 8 + FR * 2, Q * 8 + FR * 2, PAL.frame, PAL.frameDk);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) rect(ctx, MX + f * Q, MY + r * Q, Q, Q, (r + f) % 2 ? PAL.dark : PAL.light);
    const n = this.rp.moves.length;
    const done = Math.max(0, Math.min(n, Math.floor(t / STEP)));
    const cur = t >= 0 && done < n ? done : -1;
    const p = cur >= 0 ? Math.min(1, (t - cur * STEP) / 0.3) : 0;
    const at = this.board(done);
    // 지나온 수의 선
    for (let i = 0; i < done; i++) { const a = this.xy(this.rp.moves[i][0]), b = this.xy(this.rp.moves[i][1]); seg(ctx, a.x + Q / 2, a.y + Q / 2, b.x + Q / 2, b.y + Q / 2, PAL.gold); }
    const moving = cur >= 0 ? this.rp.moves[cur] : null;
    for (const [sq, pc] of at) {
      if (moving && sq === moving[0]) continue;
      if (moving && sq === moving[1] && p >= 1) continue;
      const { x, y } = this.xy(sq);
      const falling = this.rp.end === 'mate' && done >= n && sq === this.rp.king;
      const gold = this.rp.end === 'promote' && done >= n && pc.t === 'P' && sqOf(sq).r === 7;
      if (falling) {
        const k = Math.min(1, (t - n * STEP) / 0.5);
        ctx.save(); ctx.translate(x + Q / 2, y + Q); ctx.rotate(k * k * Math.PI / 2); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1 - k * 0.4;
        ctx.scale(MK, MK); sprite(ctx, 'K', pc.side, -8, -21); ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      mini(ctx, gold ? 'Q' : pc.t, gold ? 'q' : pc.side, x, y);
    }
    if (moving) {
      const pc = this.board(cur).get(moving[0]);
      const a = this.xy(moving[0]), b = this.xy(moving[1]);
      if (pc) mini(ctx, pc.t, pc.side, a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p);
      if (p >= 1) rframe(ctx, b.x, b.y, Q, Q, R_SM, PAL.gold);
    }
    if (done >= n && this.rp.end) {
      const mark = this.rp.end === 'mate' ? '#' : this.rp.end === 'check' ? '+' : '=Q';
      text(ctx, mark, MX + Q * 8 - SP.s, MY + SP.xs, PAL.gold, { align: 'right', bold: true, scale: 2, shadow: PAL.shadow });
    }
  }
  // 가운데 이야기 칸: 판 오른쪽 SP.l부터 격언 칸 왼쪽 SP.l까지
  storyCol() { const x0 = MX + Q * 8 + FR + INTER.pad, x1 = LEGEND_RX - INTER.pad; return { cx: (x0 + x1) >> 1, w: x1 - x0 }; }
  draw(ctx, ui) {
    const l = this.l, t = this.t;
    // 멈춤: 금빛 번쩍(여백 판도 같이) — 상자 둘레에
    const fl = this.surroundFlash();
    if (fl) { ctx.globalAlpha = fl.a; rect(ctx, 0, 0, W, H, fl.col); ctx.globalAlpha = 1; }
    interlude(ctx, ui, BOX.x, BOX.y, BOX.w, BODY_H, () => this.drawBody(ctx, ui), {
      title: l.name, titleCol: PAL.gold, name: '전설',
      buttons: [{ id: 'next', label: '계속', tone: t >= this.tDone ? 'gold' : 'plain', onClick: () => this.next() }],
    });
  }
  drawBody(ctx, ui) {
    const l = this.l, t = this.t;
    this.drawReplay(ctx);
    // 가운데: 「불멸의 기보 · 해」(보조) → 이야기 → 큰 덩이 틈 → 전설 효과(떨어진 뒤)
    const { cx, w } = this.storyCol(), f = flow(MY - FR);
    text(ctx, l.year ? `불멸의 기보 · ${l.year}` : '불멸의 기보', cx, f.line(), PAL.dim, { align: 'center' });
    f.gap(SP.s);
    wrap(l.story, w).forEach((s) => text(ctx, s, cx, f.line(), PAL.ink, { align: 'center' }));
    f.gap(INTER.gap);
    if (t >= this.tDrop + 0.4) {
      const a = Math.min(1, (t - this.tDrop - 0.4) / 0.4);
      wrap(l.text, w).forEach((s) => text(ctx, s, cx, f.line(), PAL.gold, { align: 'center', alpha: a }));
    }
    // 오른쪽: 격언 칸. 금박 격언이 위에서 떨어져 맨 아래 빈 칸에 박힌다
    const run = this.app.run;
    const RX = LEGEND_RX, RW = LEGEND_RW;
    const maxims = run ? run.maxims.filter((m) => m.id !== this.id) : [];
    // 격언 칸(이름 한 줄 — maximCellH), 사이 LIST_GAP. 칸이 많으면 여러 줄로 나란히(이름은 가리키면 말풍선에)
    const lay = legendSlots(maxims.length), h = lay.h;
    maxims.forEach((m, i) => {
      const r = lay.rects[i];
      ui.region(`legend:maxim:${i}`, r.x, r.y, r.w, r.h, { tip: () => maximTip(m) });
      maximCard(ctx, m, r.x, r.y, r.w, r.h, { t: ui.time, narrow: lay.narrow });
    });
    const slotY = lay.slot.y;
    const k = Math.max(0, Math.min(1, (t - this.tDrop) / 0.5));
    const y = Math.round(-40 + (slotY + 40) * (k * k));
    if (k < 1) slot(ctx, RX, slotY, RW, h);
    if (t >= this.tDrop) {
      maximCard(ctx, { id: this.id, uid: -1, edition: null }, RX, y, RW, h, { t: ui.time, overlay: k < 1 });
      edgeRing(ctx, RX, y, RW, h, -1, PAL.gold);
      if (k >= 1) {
        const r = (t - this.tDrop - 0.5) * 40;
        if (r < 30) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.beginPath(); ctx.arc(RX + RW / 2 + Math.cos(a) * (RW / 2 + r), slotY + h / 2 + Math.sin(a) * (h / 2 + r * 0.5), 1.2, 0, Math.PI * 2); ctx.fillStyle = PAL.goldHi; ctx.fill(); }
      }
    }
  }
  // 화면 전체 번쩍임 — 게임 캔버스와 여백 판(main.js)이 같이 쓴다
  surroundFlash() { return this.t < T_FREEZE ? { col: PAL.goldHi, a: 0.5 * (1 - this.t / T_FREEZE) } : null; }
  next() {
    if (this.t < this.tDone) { this.t = this.tDone; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); }
}
