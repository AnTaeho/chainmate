// 첫 수업: 고정 판 넷. 판마다 시범(흐린 손가락이 실제 연출로 한 번 둔다 → 판이 처음으로) → 내 차례(누를 곳만 빛난다).
// 대국 화면을 그대로 쓰고, 누를 곳만 좁힌다. 규칙은 실제 sim.
import { PAL } from '../../render/palette.js';
import { text, rect, frame } from '../../render/gfx.js';
import { apply } from '../../sim/battle.js';
import { BattleScreen, BX, BY, S, LX, LW, sqXY } from './battle.js';
import { panel } from '../parts.js';
import { LESSONS, lessonBattle, lessonSq, lessonDrops } from '../lessons.js';
import { lerp } from '../anim.js';

export class LessonScreen extends BattleScreen {
  constructor(app, { index = 0, phase = 'demo' } = {}) {
    const L = LESSONS[index];
    const hold = { b: lessonBattle(L) };
    super(app, { source: { kind: 'lesson', live: () => hold.b, cmd: (c) => apply(hold.b, c), run: null } });
    this.hold = hold;
    this.index = index;
    this.L = L;
    this.phase = phase;
    this.hideGain = true;
    this.noPreview = !L.preview;
    this.bigFlip = !!L.bigFlip;
    this.wait = 0;
    if (phase === 'demo') this.startDemo();
  }

  // ── 시범: 손가락이 손 → 떨굴 칸 → 먹을 적 순으로 간다
  startDemo() {
    const route = this.L.demo.map(lessonSq);
    const steps = [{ hand: 0 }, { sq: route[0], kind: 'drop' }, ...route.slice(1).map((sq) => ({ sq, kind: 'capture' }))];
    this.demo = { steps, i: 0, t: 0, stage: 'move', from: { x: 240, y: 262 }, at: { x: 240, y: 262 }, press: 0, done: false };
  }
  stepXY(st) {
    if (st.hand != null) {
      const r = this.app.ui.regions.find((x) => x.id === `hand:${st.hand}`);
      return r ? { x: r.x + r.w / 2, y: r.y + 16 } : { x: 380, y: 240 };
    }
    const p = sqXY(st.sq);
    return { x: p.x + 16, y: p.y + 18 };
  }
  updateDemo(dt) {
    const d = this.demo;
    if (d.done) {
      if ((d.after = (d.after || 0) + dt) > 1.1) this.app.go('lesson', { index: this.index, phase: 'play' });
      return;
    }
    if (this.busy) return;
    const st = d.steps[d.i];
    if (!st) { if (this.ended) d.done = true; return; }
    const sp = this.app.speed();
    d.t += dt * sp;
    const to = this.stepXY(st);
    if (d.stage === 'move') {
      const k = Math.min(1, d.t / 0.75);
      const e = k * k * (3 - 2 * k);
      d.at = { x: lerp(d.from.x, to.x, e), y: lerp(d.from.y, to.y, e) };
      if (k >= 1) { d.stage = 'hold'; d.t = 0; if (st.sq != null) this.tapSq = st.sq; }
    } else if (d.stage === 'hold') {
      d.at = to;
      if (d.t > (st.sq != null && this.L.preview ? 0.7 : 0.3)) {
        d.press = 0.2;
        this.demoAct = true;
        if (st.hand != null) this.toggle(st.hand);
        else this.clickSq(st.sq);
        this.demoAct = false;
        d.from = to; d.stage = 'move'; d.t = 0; d.i++;
      }
    }
  }
  skipDemo() { if (this.phase === 'demo') this.app.go('lesson', { index: this.index, phase: 'play' }); }

  // ── 내 차례: 길의 다음 걸음만
  filterTargets(t, b) {
    if (this.phase !== 'play') return t;
    if (t.kind === 'drop') { const ok = lessonDrops(b, this.L); return { ...t, list: t.list.filter((s) => ok.includes(s)) }; }
    if (t.kind === 'capture') { const want = lessonSq(this.L.path[b.chain.captures.length + 1]); return { ...t, list: t.list.filter((s) => s === want) }; }
    return t;
  }
  missSq() { if (this.phase === 'play' && !this.busy) this.app.shake(1, 0.1); }
  toggle(i) { if (this.phase === 'play' || this.demoAct) super.toggle(i); }
  clickSq(sq) { if (this.phase === 'play' || this.demoAct) super.clickSq(sq); }
  pointerDown(x, y) { super.pointerDown(x, y); if (this.phase === 'demo') this.skipDemo(); }
  key(k) {
    if (this.phase === 'demo' && k !== 'Escape') { this.skipDemo(); return; }
    super.key(k);
  }

  afterSeq() {
    this.fast = false;
    this.sync();
    const b = this.hold.b;
    if (b.status === 'play' || b.status === 'chain') return;
    this.ended = true;
    if (this.phase === 'play') {
      this.word(b.status === 'won' ? '좋은 수' : '다시', b.status === 'won' ? PAL.gold : PAL.red, 1.2, 2);
      if (b.status === 'won') { this.snd('win'); this.burst(lessonSq(this.L.path[this.L.path.length - 1]), PAL.gold, 24); }
      this.wait = 1.4;
    }
  }
  update(dt) {
    super.update(dt);
    if (this.demo && this.phase === 'demo') { this.updateDemo(dt); if (this.demo.press > 0) this.demo.press -= dt; }
    if (this.phase === 'play' && this.ended && (this.wait -= dt) <= 0) this.next();
  }
  next() {
    const app = this.app, b = this.hold.b;
    if (b.status !== 'won') return app.go('lesson', { index: this.index, phase: 'play' });
    if (this.index + 1 < LESSONS.length) return app.go('lesson', { index: this.index + 1, phase: 'demo' });
    app.records.lessonsDone = true;
    app.saveRecords();
    app.fx.clear();
    // 이어 둘 판이 있으면(설정에서 다시 본 경우) 타이틀로. 없으면 곧바로 1관 연습 대국.
    if (app.hasSave()) return app.toTitle();
    app.newRun();
    if (app.run && app.run.phase === 'select') { const ev = app.cmd({ type: 'play' }); app.go('battle', { events: ev }); }
  }

  // ── 그리기
  draw(ctx, ui) {
    super.draw(ctx, ui);
    const t = `첫 수업 ${this.index + 1}/${LESSONS.length} · ${this.L.title}`;
    text(ctx, t, BX + S * 4, 1, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    if (this.phase === 'demo' && this.demo && !this.demo.done) this.drawFinger(ctx);
  }
  drawBoard(ctx, ui) {
    super.drawBoard(ctx, ui);
    if (this.phase !== 'play') return;
    const t = this.clickable();
    const pulse = Math.floor(this.app.time * 4) % 2;
    if (t.kind === 'capture') for (const sq of t.list) { const { x, y } = sqXY(sq); frame(ctx, x + pulse, y + pulse, S - pulse * 2, S - pulse * 2, PAL.goldHi, 2); }
  }
  drawRight(ctx, ui) {
    super.drawRight(ctx, ui);
    const b = this.live();
    if (this.phase === 'play' && b && b.status === 'play' && !this.sel.length && !this.busy) {
      const r = ui.regions.find((x) => x.id === 'hand:0');
      if (r) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.app.time * 6); frame(ctx, r.x - 2, r.y + 2, r.w + 4, 40, PAL.goldHi, 1); ctx.globalAlpha = 1; }
    }
  }
  drawLeft(ctx, ui) {
    super.drawLeft(ctx, ui);
    panel(ctx, LX, 8, LW, 58);
    LESSONS.forEach((L, i) => {
      const col = i === this.index ? PAL.gold : i < this.index ? PAL.dim : PAL.dimDk;
      text(ctx, L.title, LX + 5, 11 + i * 13, col, { bold: i === this.index });
    });
    // 주머니 · 수 칸은 수업에서 뜻이 없어 덮는다
    rect(ctx, LX, 240, LW, 22, PAL.felt);
  }
  // 흐린 도트 손가락
  drawFinger(ctx) {
    const { x, y } = this.demo.at;
    const px = Math.round(x), py = Math.round(y) + (this.demo.press > 0 ? 1 : 0);
    const F = ['#.....', '##....', '#o#...', '#oo#..', '#ooo#.', '#oooo#', '#oo###', '#o#o#.', '##.#o#', '....##'];
    ctx.globalAlpha = 0.72;
    F.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = row[i]; if (c !== '.') rect(ctx, px + i, py + j, 1, 1, c === '#' ? PAL.shadow : PAL.white); } });
    if (this.demo.press > 0) { ctx.globalAlpha = this.demo.press * 2; frame(ctx, px - 5, py - 5, 11, 11, PAL.white); }
    ctx.globalAlpha = 1;
  }
}
