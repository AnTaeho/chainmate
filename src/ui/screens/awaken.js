// 혼 각성(CHM-17): 금이 간 혼이 깨어나는 짧은 막간. 금이 번지고(0 ~ BURST) → 금빛이 터지며 흔들림 · 종소리 → 금테 카드와 각성 한 줄.
// 어디서 왔나(src): 'golden' 금빛 적을 먹고 이긴 대국 · 'chest' 마스터의 상자 · 'scroll' 두루마리 「깨우기」.
// 누르거나 Enter면 끝 장면으로 건너뛰고, 한 번 더 누르면 다음으로. 움직임 줄이기면 번쩍 · 흔들림 없이.
// 시안 셋(가운데 막간 / 가로 띠 / 문양 빛기둥) 가운데 어느 기물이 깨어났는지 보이는 막간을 골랐다 — docs/shots/souls/draft-*-awaken
import { PAL } from '../../render/palette.js';
import { W, H, text, measure, seg, soulSpark } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { SOUL_BY_ID } from '../../data/souls.js';
import { PIECE_NAME } from '../words.js';
import { pieceCard, soulMark } from '../parts.js';
import { flow } from '../frame.js';
import { interlude, interludeLayout, INTER } from './common.js';
import { L } from '../lang.js';

const BURST = 0.55, DONE = 1.3;
export const AWAKEN_FROM = { golden: '금빛 적을 잡고 이겼어요', chest: '마스터의 상자', scroll: '깨우기' };

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
  // 금이 번지고 터져 끝 장면이 될 때까지(그 뒤 금테 카드의 반짝임은 그리는 함수가 live를 부른다)
  animating() { return this.t < DONE; }
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
    // 혼 기운(한 점)은 카드 왼쪽 위 바깥에 따로 — 기물 그림에 붙이면 각성 금테 밑에 반쯤 숨는다
    pieceCard(ctx, { ...p, soul: null }, 0, 0, 20, 28, { time: this.app.time });
    soulMark(ctx, p, 0, 0, 20, 28, this.app.time);
    soulSpark(ctx, -4.5, -1, this.s.col, this.app.time);
    // 금이 번진다: 왼쪽 위에서 오른쪽 아래로 틈이 자란다
    if (!burst) {
      const n = Math.floor((t / BURST) * 14);
      if (n > 1) {
        // 잉크 틈 위에 혼 빛깔 가는 금
        const path = () => { ctx.beginPath(); for (let i = 0; i < n; i++) { const px = 2.5 + i + (i % 3 === 1 ? 1 : 0), py = 1.5 + i * 1.8; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } };
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        path(); ctx.strokeStyle = PAL.cardInk; ctx.lineWidth = 0.9; ctx.stroke();
        path(); ctx.strokeStyle = this.s.col; ctx.lineWidth = 0.45; ctx.stroke();
      }
    }
    ctx.restore();
    if (burst && !this.app.reducedMotion) {
      // 금빛 살: 카드 둘레로 퍼졌다 사라진다
      const q = Math.min(1, (t - BURST) / 0.6);
      const cx = x + 10 * k, cy = y + 14 * k;
      ctx.globalAlpha = 1 - q;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.6, r0 = 14 * k * 0.6 + q * 30, r1 = r0 + 6 + q * 10;
        seg(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8, i % 2 ? PAL.goldHi : PAL.gold, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
  draw(ctx, ui) {
    const t = this.t, done = t >= DONE;
    // 막간 상자: 제목 → 큰 카드 → 이름 · 각성 한 줄 · 어디서 → 계속
    // 폭은 글에 맞춘다(영어 제목 「The soul awakens」가 두 배 글씨로 232를 넘는다)
    const title = '혼이 깨어났다', w = Math.max(232, measure(title, true) * 2 + INTER.pad * 2 + 8), IW = w - INTER.pad * 2;
    const L1 = this.lines(IW);
    const f = flow(0);
    const cardY = f.space(28 * 3);
    f.gap(INTER.gap);
    const nameY = f.line(true);
    const awakeY = L1.awake.map(() => f.line());
    const fromY = L1.from ? f.line() : null;
    const bodyH = f.y, h = interludeLayout(bodyH).h, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    const a = done ? 1 : Math.max(0, Math.min(1, (t - BURST) / 0.4));
    interlude(ctx, ui, x, y, w, bodyH, (c, bx, by, bw) => {
      const cx = bx + (bw >> 1);
      this.card(c, cx - 30, by + cardY, 3);
      text(c, L1.name, cx, by + nameY, this.s.col, { align: 'center', bold: true });
      L1.awake.forEach((l, i) => text(c, l, cx, by + awakeY[i], PAL.gold, { align: 'center', alpha: a }));
      if (fromY != null) text(c, L1.from, cx, by + fromY, PAL.dim, { align: 'center' });
    }, { title, edge: PAL.gold, name: '각성', buttons: [{ id: 'next', label: '계속', tone: done ? 'gold' : 'plain', onClick: () => this.next() }] });
  }
  next() {
    if (this.t < DONE) { if (this.t < BURST) this.app.sfx('awaken'); this.t = DONE; return; }
    this.app.next();
  }
  key(k) { if (k === 'Enter' || k === ' ' || k === 'Escape') this.next(); }
}

// 각성 막간 줄: 사건 목록에서 각성마다 하나(대국 뒤 · 상자 뒤 · 상점에서)
export const awakenFlow = (events, extra = {}) => events.filter((e) => e.type === 'awaken').map((e) => ['awaken', { awaken: e, ...extra }]);
