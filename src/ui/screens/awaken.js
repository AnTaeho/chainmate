// 혼 각성(CHM-17): 금이 간 혼이 깨어나는 짧은 막간. 금이 번지고(0 ~ BURST) → 금빛이 터지며 흔들림 · 종소리 → 금테 카드와 각성 한 줄.
// 어디서 왔나(src): 'golden' 금빛 적을 먹고 이긴 대국 · 'chest' 마스터의 상자 · 'scroll' 두루마리 「깨우기」.
// 누르거나 Enter면 끝 장면으로 건너뛰고, 한 번 더 누르면 다음으로. 움직임 줄이기면 번쩍 · 흔들림 없이.
// 시안 셋(가운데 막간 / 가로 띠 / 문양 빛기둥) 가운데 어느 기물이 깨어났는지 보이는 막간을 골랐다 — docs/shots/souls/draft-*-awaken
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { PIECE_NAME } from '../words.js';
import { button } from '../ui.js';
import { pieceCard } from '../parts.js';
import { PAD_BOX, LINE, GAP_GROUP, flow, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { L } from '../lang.js';

const BURST = 0.55, DONE = 1.3;
export const AWAKEN_FROM = { golden: '금빛 적을 먹고 이겼다', chest: '마스터의 상자', scroll: '깨우기' };

export class AwakenScreen {
  constructor(app, { awaken }) {
    this.app = app;
    this.e = awaken;
    this.s = SOUL_BY_ID[awaken.soul];
    const p = app.run && app.run.deck.find((x) => x.id === awaken.pieceId);
    this.p = p ? { ...p } : { id: -1, t: awaken.piece, eng: null, soul: awaken.soul, awake: true };
    this.t = 0;
    app.sfx('crack');
  }
  update(dt) {
    const before = this.t;
    this.t += dt * this.app.speed();
    if (before < BURST && this.t >= BURST) {
      this.app.sfx('awaken');
      if (!this.app.reducedMotion) { this.app.shake(2, 0.25); this.app.hitstop(0.08); }
    }
  }
  // 화면 전체 번쩍임(여백 판도 같이): 터지는 순간 금빛
  surroundFlash() {
    if (this.app.reducedMotion) return null;
    const k = (this.t - BURST) / 0.35;
    return k >= 0 && k < 1 ? { col: PAL.goldHi, a: 0.45 * (1 - k) } : null;
  }
  // 글 줄: 제목(두 배) · 혼 이름 · 각성 한 줄 · 어디서
  lines(w) {
    const s = this.s;
    return {
      title: '혼이 깨어났다',
      name: `${s.name}의 혼 · ${PIECE_NAME[this.p.t]}`,
      awake: wrap(`각성 · ${L(s.awake)}`, w),
      from: AWAKEN_FROM[this.e.src] || '',
    };
  }
  // 카드(20 × 28)를 k배로: 터지기 전에는 금이 번지고, 뒤에는 금테
  card(ctx, x, y, k) {
    const t = this.t, burst = t >= BURST;
    const p = burst ? { ...this.p, awake: true } : { ...this.p, awake: false, links: 99 };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    pieceCard(ctx, p, 0, 0, 20, 28, { time: this.app.time });
    // 금이 번진다: 왼쪽 위에서 오른쪽 아래로 틈이 자란다
    if (!burst) {
      const n = Math.floor((t / BURST) * 14);
      for (let i = 0; i < n; i++) rect(ctx, 2 + i + (i % 3 === 1 ? 1 : 0), 1 + Math.floor(i * 1.8), 1, 1, i % 2 ? this.s.col : PAL.ink);
    }
    ctx.restore();
    if (burst && !this.app.reducedMotion) {
      // 금빛 살: 카드 둘레로 퍼졌다 사라진다
      const q = Math.min(1, (t - BURST) / 0.6);
      const cx = x + 10 * k, cy = y + 14 * k;
      ctx.globalAlpha = 1 - q;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.6, r0 = 14 * k * 0.6 + q * 30, r1 = r0 + 6 + q * 10;
        for (let r = r0; r < r1; r += 2) rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2, i % 2 ? PAL.goldHi : PAL.gold);
      }
      ctx.globalAlpha = 1;
    }
  }
  draw(ctx, ui) {
    const t = this.t, done = t >= DONE;
    const tone = done ? 'gold' : 'plain';
    // 가운데 막간: 금 테 상자 안에 제목 → 큰 카드 → 이름 · 각성 한 줄 · 어디서 → 계속
    const w = 232, P = PAD_BOX, IW = w - P * 2;
    const L1 = this.lines(IW);
    const f = flow(P);
    const title = f.space(LINE * 2);
    f.gap(GAP_GROUP);
    const cardY = f.space(28 * 3);
    f.gap(GAP_GROUP);
    const nameY = f.line(true);
    const awakeY = L1.awake.map(() => f.line());
    const fromY = L1.from ? f.line() : null;
    f.gap(GAP_GROUP);
    const btnY = f.space(BTN_S);
    const h = f.y + P, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    openBox('panel', x, y, w, h, P, { name: '각성' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
    text(ctx, L1.title, W / 2, y + title, PAL.gold, { align: 'center', bold: true, scale: 2 });
    this.card(ctx, W / 2 - 30, y + cardY, 3);
    text(ctx, L1.name, W / 2, y + nameY, this.s.col, { align: 'center', bold: true });
    const a = done ? 1 : Math.max(0, Math.min(1, (t - BURST) / 0.4));
    L1.awake.forEach((l, i) => text(ctx, l, W / 2, y + awakeY[i], PAL.gold, { align: 'center', alpha: a }));
    if (fromY != null) text(ctx, L1.from, W / 2, y + fromY, PAL.dim, { align: 'center' });
    button(ctx, ui, 'next', W / 2 - 40, y + btnY, 80, BTN_S, '계속', { onClick: () => this.next(), tone });
    closeBox();
  }
  next() {
    if (this.t < DONE) { if (this.t < BURST) this.app.sfx('awaken'); this.t = DONE; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ' || k === 'Escape') this.next(); }
}

// 각성 막간 줄: 사건 목록에서 각성마다 하나(대국 뒤 · 상자 뒤 · 상점에서)
export const awakenFlow = (events, extra = {}) => events.filter((e) => e.type === 'awaken').map((e) => ['awaken', { awaken: e, ...extra }]);
