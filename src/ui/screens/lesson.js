// 첫 수업: 수업마다 시범(흐린 손가락이 실제 연출로 한 번 둔다 → 판이 처음으로) → 내 차례(지금 누를 곳만 빛나고, 오른쪽에 할 일 한 줄).
// 대국 화면을 그대로 쓰고, 누를 곳만 걸음(lessons.js steps)으로 좁힌다. 규칙은 실제 sim.
import { richText } from '../glossary.js';
import { PAL } from '../../render/palette.js';
import { text, rect, frame, box, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { apply } from '../../sim/battle.js';
import { previewDrop } from '../../sim/solver.js';
import { BattleScreen, BX, S, LX, LW, RX, RW, sqXY } from './battle.js';
import { PAD_BOX, GAP_IN, GAP_GROUP, TOP, PAUSE, flow, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { panel } from '../parts.js';
import { button } from '../ui.js';
import { LESSONS, LESSON_GROUPS, lessonBattle, lessonSq } from '../lessons.js';
import { lerp } from '../anim.js';
import { finishLessons, lessonDone } from './lessons.js';

// 할 일 판넬 쌓기(오른쪽 칸 위, PAD_BOX): 이름표 「보기」 · 「할 일」(왼쪽 칸 「시너지」 · 「정석」과 같은 이름표 줄) → 묶음 안 틈 → 글
// → 묶음 틈 → 「누르면 내 차례」(보기 때만)
export function lessonPanelLayout(say, demo) {
  const P = PAD_BOX, f = flow(TOP + P);
  const ty = f.line();
  f.gap(GAP_IN);
  const lines = wrap(say, RW - P * 2).map((l) => [l, f.line()]);
  const taps = demo ? wrap('누르면 내 차례', RW - P * 2).map((l, k) => [l, (k ? f : f.gap(GAP_GROUP)).line()]) : [];
  return { ty, lines, taps, h: f.y + P - TOP };
}

export class LessonScreen extends BattleScreen {
  constructor(app, { index = 0, phase = 'demo' } = {}) {
    const L = LESSONS[index];
    const hold = { b: lessonBattle(L) };
    super(app, { source: { kind: 'lesson', live: () => hold.b, cmd: (c) => apply(hold.b, c), run: null } });
    this.hold = hold;
    this.index = index;
    this.L = L;
    this.phase = phase;
    this.steps = phase === 'demo' ? (L.demo || L.steps) : L.steps;
    this.si = 0;
    this.hideGain = false;
    this.noPreview = !L.preview;
    this.bigFlip = !!L.bigFlip;
    this.wait = 0;
    if (phase === 'demo') this.startDemo();
  }
  // 지금 걸음(떨굴 차례에 든 기물을 놓았으면 드는 걸음으로 돌아간다)
  get at() {
    const st = this.steps[this.si], prev = this.steps[this.si - 1];
    return st && 'drop' in st && !this.sel.length && prev && prev.pick != null ? this.si - 1 : this.si;
  }
  get step() { return this.steps[this.at] || null; }
  // 지금 보일 한 줄: 이 걸음의 say, 없으면 앞 걸음의 say
  get say() {
    for (let i = Math.min(this.at, this.steps.length - 1); i >= 0; i--) if (this.steps[i].say) return this.steps[i].say;
    return '';
  }

  // ── 시범: 손가락이 걸음마다 누를 곳으로 간다
  startDemo() {
    this.demo = { i: 0, t: 0, stage: 'move', from: { x: 240, y: 262 }, at: { x: 240, y: 262 }, press: 0, done: false };
  }
  stepXY(st) {
    const reg = (id, dy = 16) => { const r = this.app.ui.regions.find((x) => x.id === id); return r ? { x: r.x + r.w / 2, y: r.y + Math.min(dy, r.h / 2) } : null; };
    if (st.pick != null) return reg(`hand:${st.pick}`) || { x: 380, y: 240 };
    if (st.discard) return reg('btn:discard', 8) || { x: 440, y: 210 };
    let sq = lessonSq(st.drop ?? st.cap);
    if (sq == null && 'drop' in st) sq = this.clickable().list[0];
    if (sq == null) return { x: 240, y: 140 };
    const p = sqXY(sq);
    return { x: p.x + 16, y: p.y + 18 };
  }
  updateDemo(dt) {
    const d = this.demo;
    if (d.done) {
      if ((d.after = (d.after || 0) + dt) > 1.3) this.app.go('lesson', { index: this.index, phase: 'play' });
      return;
    }
    if (this.busy) return;
    const st = this.step;
    if (!st) { if (this.ended || this.si >= this.steps.length) d.done = true; return; }
    d.t += dt * this.app.speed();
    const to = this.stepXY(st);
    if (d.stage === 'move') {
      const k = Math.min(1, d.t / 0.75);
      const e = k * k * (3 - 2 * k);
      d.at = { x: lerp(d.from.x, to.x, e), y: lerp(d.from.y, to.y, e) };
      if (k >= 1) { d.stage = 'hold'; d.t = 0; const sq = lessonSq(st.drop ?? st.cap); if (sq != null) this.tapSq = sq; }
    } else if (d.stage === 'hold') {
      d.at = to;
      if (d.t > (st.say ? 1.1 : 0.45)) {
        d.press = 0.2;
        this.demoAct = true;
        this.doStep(st);
        this.demoAct = false;
        d.from = to; d.stage = 'move'; d.t = 0;
      }
    }
  }
  // 걸음 하나를 실제로(시범 손가락)
  doStep(st) {
    if (st.pick != null) this.toggle(st.pick);
    else if (st.discard) this.discard();
    else {
      let sq = lessonSq(st.drop ?? st.cap);
      if (sq == null) sq = this.clickable().list[0];
      this.tapSq = sq;
      this.clickSq(sq);
    }
  }
  skipDemo() { if (this.phase === 'demo') this.app.go('lesson', { index: this.index, phase: 'play' }); }

  // ── 누를 곳: 지금 걸음만
  filterTargets(t, b) {
    const st = this.step;
    if (!st) return { ...t, list: [] };
    if (t.kind === 'drop') {
      if (!('drop' in st)) return { ...t, list: [] };
      if (st.drop) return { ...t, list: t.list.filter((s) => s === lessonSq(st.drop)) };
      // 떨굴 칸을 정하지 않은 걸음: 다음 걸음의 먹이를 먹을 수 있는 칸
      const next = this.steps[this.si + 1];
      const want = next && next.cap ? lessonSq(next.cap) : null;
      return { ...t, list: t.list.filter((s) => want == null || previewDrop(b, this.sel[0], s).next.includes(want)) };
    }
    if (t.kind === 'capture') return { ...t, list: st.cap ? t.list.filter((s) => s === lessonSq(st.cap)) : [] };
    return t;
  }
  missSq() { if (this.phase === 'play' && !this.busy) this.app.shake(1, 0.1); }
  canAct() { return this.phase === 'play' || this.demoAct; }
  toggle(i) {
    const st = this.step;
    if (!this.canAct() || !st || st.pick !== i || this.sel.includes(i)) return;
    const at = this.at;
    super.toggle(i);
    if (this.sel.includes(i)) this.si = at + 1;
  }
  clickSq(sq) {
    if (!this.canAct()) return;
    super.clickSq(sq);
  }
  discard() {
    const st = this.step;
    if (!this.canAct() || !st || !st.discard) return;
    super.discard();
  }
  // 명령이 실제로 나가면 걸음을 넘긴다
  send(cmd) {
    const st = this.steps[this.si];
    if (st && ((cmd.type === 'drop' && 'drop' in st) || (cmd.type === 'capture' && st.cap) || (cmd.type === 'discard' && st.discard))) this.si++;
    super.send(cmd);
  }
  pointerDown(x, y) {
    if (super.pointerDown) super.pointerDown(x, y);
    const p = this.app.ui.press;
    if (this.phase === 'demo' && !(p && p.id === 'lesson:skip')) this.skipDemo();
  }
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
      const won = b.status === 'won';
      this.word(won ? '좋은 수' : '다시', won ? PAL.gold : PAL.red, 1.2, 2);
      if (won) { this.snd('win'); const last = [...this.steps].reverse().find((s) => s.cap); if (last) this.burst(lessonSq(last.cap), PAL.gold, 24); }
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
    lessonDone(app, this.index);
  }
  skipAll() { finishLessons(this.app); }

  // ── 그리기
  draw(ctx, ui) {
    super.draw(ctx, ui);
    const g = LESSON_GROUPS.find((x) => x.id === this.L.group);
    // 판 위 한 줄: 판 폭에 안 들어가면(영어) 수업 번호만 — 제목은 왼쪽 머리 칸에 있다
    const full = `첫 수업 ${this.index + 1}/${LESSONS.length} · ${this.L.title}`;
    const t = measure(full, true) <= S * 8 ? full : `첫 수업 ${this.index + 1}/${LESSONS.length}`;
    text(ctx, t, BX + S * 4, 1, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    if (this.phase === 'demo' && this.demo && !this.demo.done) this.drawFinger(ctx);
  }
  drawBoard(ctx, ui) {
    super.drawBoard(ctx, ui);
    const t = this.clickable();
    const pulse = Math.floor(this.app.time * 4) % 2;
    if (t.kind === 'capture') for (const sq of t.list) { const { x, y } = sqXY(sq); frame(ctx, x + pulse, y + pulse, S - pulse * 2, S - pulse * 2, PAL.goldHi, 2); }
  }
  drawRight(ctx, ui) {
    super.drawRight(ctx, ui);
    // 할 일(오른쪽 격언 칸 자리 — 수업에는 격언이 없다): 「보기」 · 「할 일」(제목) → 묶음 틈 → 글 → 묶음 틈 → 「누르면 내 차례」(보기 때만)
    const P = PAD_BOX, { ty, lines, taps, h } = lessonPanelLayout(this.say, this.phase === 'demo');
    openBox('panel', RX, TOP, RW, h, P, { name: '할 일' });
    panel(ctx, RX, TOP, RW, h);
    text(ctx, this.phase === 'demo' ? '보기' : '할 일', RX + P, ty, this.phase === 'demo' ? PAL.dim : PAL.gold, { bold: true });
    for (const [l, ly] of lines) richText(ctx, l, RX + P, ly, PAL.ink, { termCol: PAL.gold, ui });
    for (const [l, ly] of taps) text(ctx, l, RX + RW - P, ly, PAL.dimDk, { align: 'right' });
    closeBox();
    // 누를 곳이 손이면 그 카드에 숨 쉬는 테, 바꾸기면 단추에
    const st = this.step;
    if (this.phase === 'play' && st && !this.busy) {
      const id = st.pick != null ? `hand:${st.pick}` : st.discard ? 'btn:discard' : null;
      const r = id && ui.regions.find((x) => x.id === id);
      if (r) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.app.time * 6); frame(ctx, r.x - 2, r.y - 2 + (st.pick != null ? 4 : 0), r.w + 4, st.pick != null ? 40 : r.h + 4, PAL.goldHi, 1); ctx.globalAlpha = 1; }
    }
    // 수업 건너뛰기(처음 켠 사람도 곧바로 판으로 갈 수 있게): 오른쪽 칸 위 이름표 줄(수업에는 격언이 없다), 멈춤 단추 왼쪽
    button(ctx, ui, 'lesson:skip', RX, 2, PAUSE.x - 6 - RX, BTN_S, '수업 건너뛰기', { onClick: () => this.skipAll() });
  }
  // 머리 칸: 대국 제목 대신 수업 묶음과 지금 수업(제목은 두 줄까지), 목표는 점수나 외통
  headSpec() {
    const g = LESSON_GROUPS.find((x) => x.id === this.L.group);
    const inGroup = LESSONS.filter((x) => x.group === this.L.group);
    return {
      kicker: `${g ? g.name : ''} ${inGroup.indexOf(this.L) + 1}/${inGroup.length}`,
      right: null,
      titles: wrap(this.L.title, LW - PAD_BOX * 2, true),
      titleCol: PAL.gold,
      master: null,
      target: this.L.target < 99999 ? `${this.L.target}` : '체크메이트',
    };
  }
  // 흐린 도트 손가락(1배에서도 보이게 테두리 · 흰 몸)
  drawFinger(ctx) {
    const { x, y } = this.demo.at;
    const px = Math.round(x), py = Math.round(y) + (this.demo.press > 0 ? 1 : 0);
    const F = ['#.....', '##....', '#o#...', '#oo#..', '#ooo#.', '#oooo#', '#oo###', '#o#o#.', '##.#o#', '....##'];
    ctx.globalAlpha = 0.9;
    F.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = row[i]; if (c !== '.') rect(ctx, px + i, py + j, 1, 1, c === '#' ? PAL.shadow : PAL.white); } });
    if (this.demo.press > 0) { ctx.globalAlpha = this.demo.press * 2; frame(ctx, px - 5, py - 5, 11, 11, PAL.white); }
    ctx.globalAlpha = 1;
  }
}
