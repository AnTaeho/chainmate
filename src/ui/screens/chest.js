// 명인의 상자: 다섯 칸 릴이 돌다가 왼쪽부터 멈춘다. 불 켜진 칸(가운데부터)에 물건이 선다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, sprite, radiusOf } from '../../render/gfx.js';
import { rpath } from '../../render/light.js';
import { wrap } from '../../render/text.js';
import { CHARTS } from '../../data/charts.js';
import { ENGRAVING_BY_ID } from '../../data/engravings.js';
import { PIECE_NAME } from '../words.js';
import { shardIcon, awakenArt, artW, edgeRing } from '../parts.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { LINE, GAP_IN, SP, ART_H, INK_H, flow, textY } from '../frame.js';
import { interlude, interludeLayout, INTER } from './common.js';

export function chestItemText(it) {
  if (!it) return '';
  if (it.kind === 'money') return `상금 +${it.money}`;
  if (it.kind === 'chart') return CHARTS[it.form].name;
  if (it.kind === 'engrave') return `${PIECE_NAME[it.piece]}에 ${ENGRAVING_BY_ID[it.eng].name} 각인`;
  if (it.kind === 'edition') return '판본';
  if (it.kind === 'piece') return PIECE_NAME[it.t];
  if (it.kind === 'awaken') return `${SOUL_BY_ID[it.soul].name}의 혼이 깨어난다`;
  return '';
}

// 칸 안 그림은 두 배로, 칸 가운데 (cx, cy)에
const K = 2;
// 금화(지름 14 × K): 잉크 테 · 금 몸 · 왼쪽 위 빛
function coin(ctx, cx, cy) {
  const disc = (r, col, d = 0) => { ctx.beginPath(); ctx.arc(cx + d, cy + d, r * K, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
  disc(7, PAL.frameDk); disc(6, PAL.goldDk); disc(5.2, PAL.gold, -0.6 * K);
}
// 그림 크기(논리 px, K배 전)
function scaled(ctx, cx, cy, w, h, draw) {
  ctx.save(); ctx.translate(cx - (w * K) / 2, cy - (h * K) / 2); ctx.scale(K, K); draw(); ctx.restore();
}
function drawItem(ctx, it, cx, cy) {
  if (it.kind === 'money') { coin(ctx, cx, cy); text(ctx, '$', cx, cy - (INK_H * K) / 2, PAL.cardInk, { align: 'center', bold: true, scale: K }); }
  // 기물 그림(16 × 22)은 K배 상자가 (cx, cy) 가운데에 오게(sprite는 발밑 가운데에 맞춰 키운다)
  else if (it.kind === 'chart') sprite(ctx, it.form, 'b', cx - 8, cy, { sx: K, sy: K });
  else if (it.kind === 'engrave') sprite(ctx, it.piece, 'w', cx - 8, cy, { sx: K, sy: K, eng: it.eng });
  else if (it.kind === 'piece') sprite(ctx, it.t, 'w', cx - 8, cy, { sx: K, sy: K });
  else if (it.kind === 'awaken') { const aw = artW({ kind: 'awaken' }); scaled(ctx, cx, cy, aw, ART_H, () => awakenArt(ctx, 0, 0, 0)); }
  else scaled(ctx, cx, cy, 16, 14, () => shardIcon(ctx, 0, 0));
}
const SPIN = [{ kind: 'money', money: 2 }, { kind: 'chart', form: 'N' }, { kind: 'engrave', piece: 'P', eng: 'gold' }, { kind: 'chart', form: 'Q' }, { kind: 'chart', form: 'R' }];
// 릴 칸(그림 K배가 들게) · 칸 사이
const CELL = { w: 56, h: 64, gap: SP.s };
const REEL_W = 5 * CELL.w + 4 * CELL.gap;
const TIP_ROOM = 76;

export class ChestScreen {
  constructor(app, { chest }) {
    this.app = app;
    this.chest = chest;
    this.t = 0;
    this.stopped = 0;
    this.flash = 0;
    app.sfx('chestOpen');
  }
  stopAt(i) { return 0.9 + i * 0.42; }
  // 릴이 도는 동안 · 번쩍이는 동안
  animating() { return this.stopped < this.chest.cells.length || this.flash > 0; }
  update(dt) {
    this.t += dt * this.app.speed();
    const n = this.chest.cells.length;
    while (this.stopped < n && this.t >= this.stopAt(this.stopped)) {
      const cell = this.chest.cells[this.stopped];
      this.app.sfx(cell.lit ? 'reelLit' : 'reelStop', this.stopped);
      this.stopped++;
      if (this.stopped === n) {
        if (this.chest.count >= 5) { this.flash = 1.2; this.app.sfx('fanfare'); this.app.shake(3, 0.4); }
        else if (this.chest.count >= 3) { this.flash = 0.5; this.app.sfx('sparkle'); }
      }
    }
    if (this.flash > 0) this.flash -= dt;
  }
  // 본문 쌓기(끝 장면 높이로 미리 잡아 릴이 멈춰도 상자가 커지지 않는다): 릴 → 큰 덩이 틈 → 칸 수(다섯이면 두 배) → 묶음 안 틈 → 받은 것(「 · 」로 이어 줄바꿈)
  body() {
    const c = this.chest, big = c.count >= 5, f = flow(0);
    const reel = f.space(CELL.h);
    f.gap(INTER.gap);
    const count = big ? f.space(LINE * 2) + ((LINE * 2 - INK_H * 2) >> 1) : f.line();
    f.gap(GAP_IN);
    const items = wrap(c.cells.filter((x) => x.lit).map((x) => chestItemText(x.item)).join(' · '), REEL_W).map((l) => [l, f.line()]);
    // 칸을 가리키면 그 아래에 낱말 상자가 뜬다(받은 것 줄은 접힌다) — 「계속」 위에 그 자리를 남긴다
    return { reel, count, items, big, h: Math.max(f.y, CELL.h + TIP_ROOM) };
  }
  draw(ctx, ui) {
    const c = this.chest, B = this.body();
    // 다섯 칸 · 세 칸의 금빛 번쩍임은 상자 둘레에(상자 · 단추는 덮지 않는다)
    const fl = this.surroundFlash();
    if (fl) { ctx.globalAlpha = fl.a; rect(ctx, 0, 0, W, H, fl.col); ctx.globalAlpha = 1; }
    const w = REEL_W + INTER.pad * 2, x = Math.floor((W - w) / 2);
    const y = Math.floor((H - interludeLayout(B.h).h) / 2);
    const done = this.stopped >= c.cells.length;
    // 받은 것 줄은 칸을 가리키는 동안 접는다 — 그 칸의 설명이 바로 아래에 같은 것을 말한다(CHM-34)
    const pointing = ui.hover && ui.hover.id.startsWith('chest:cell:');
    interlude(ctx, ui, x, y, w, B.h, (g, bx, by) => {
      c.cells.forEach((cell, i) => {
        const cx0 = bx + i * (CELL.w + CELL.gap), cy0 = by + B.reel;
        const stop = i < this.stopped, lit = stop && cell.lit;
        box(g, cx0, cy0, CELL.w, CELL.h, lit ? PAL.card : PAL.well, lit ? PAL.gold : PAL.frameDk);
        const mx = cx0 + (CELL.w >> 1), my = cy0 + (CELL.h >> 1);
        if (!stop) {
          const k = Math.floor(this.t * 14 + i * 3);
          const it = SPIN[k % SPIN.length];
          const off = Math.floor((this.t * 14 * 32) % 32) - 16;
          // 도는 그림은 칸 안쪽 둥근 모서리에서 잘린다
          g.save(); rpath(g, cx0 + 1, cy0 + 1, CELL.w - 2, CELL.h - 2, radiusOf(CELL.w, CELL.h) - 1); g.clip();
          g.globalAlpha = 0.6;
          drawItem(g, it, mx, my + off);
          g.globalAlpha = 1;
          g.restore();
        } else if (lit) {
          ui.region(`chest:cell:${i}`, cx0, cy0, CELL.w, CELL.h, { keys: [chestItemText(cell.item)] });
          drawItem(g, cell.item, mx, my);
          edgeRing(g, cx0, cy0, CELL.w, CELL.h, -1, PAL.gold);
        } else text(g, '·', mx, textY(my - (LINE >> 1)), PAL.dimDk, { align: 'center', bold: true });
      });
      if (done && !pointing) {
        const cx = bx + (REEL_W >> 1);
        text(g, B.big ? '다섯 칸!' : c.count >= 3 ? '세 칸' : '한 칸', cx, by + B.count, c.count >= 3 ? PAL.gold : PAL.ink, { align: 'center', bold: true, scale: B.big ? 2 : 1 });
        for (const [l, ly] of B.items) text(g, l, cx, by + ly, PAL.ink, { align: 'center' });
      }
    }, { title: '마스터의 상자', titleCol: PAL.gold, name: '마스터의 상자', buttons: [{ id: 'next', label: '계속', tone: 'gold', onClick: () => this.next() }] });
  }
  // 다섯 칸 · 세 칸의 금빛 번쩍임 — 게임 캔버스와 여백 판(main.js)이 같이 쓴다
  surroundFlash() { return this.flash > 0 ? { col: PAL.gold, a: Math.min(0.5, this.flash * 0.5) } : null; }
  next() {
    if (this.stopped < this.chest.cells.length) { this.t = 99; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ') this.next(); }
}
