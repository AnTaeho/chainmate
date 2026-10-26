// 튜토리얼 수업: 수업마다 시범(흐린 손가락이 실제 연출로 한 번 둔다 → 판이 처음으로) → 내 차례(지금 누를 곳만 빛나고, 오른쪽 칸에서 킹이 할 일을 말한다).
// 대국 화면을 그대로 쓰고, 누를 곳만 걸음(lessons.js steps)으로 좁힌다. 규칙은 실제 sim.
import { richText } from '../glossary.js';
import { PAL } from '../../render/palette.js';
import { text, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { apply } from '../../sim/battle.js';
import { previewDrop } from '../../sim/solver.js';
import { BattleScreen, BX, S, LX, LW, RX, RW, sqCenter, HAND } from './battle.js';
import { strokeSq } from '../../render/board3.js';
import { PAD_BOX, TOP, PAUSE, BTN_S, SP, LINE, LINE_TITLE } from '../frame.js';
import { button } from '../ui.js';
import { kingNoteLayout, kingNote, pointRing } from '../coach.js';
import { LESSONS, LESSON_GROUPS, lessonBattle, lessonSq } from '../lessons.js';
import { lerp } from '../anim.js';
import { live as motion, beat } from '../../render/look.js';
import { finishLessons, lessonDone } from './lessons.js';

// 킹의 말 상자(오른쪽 칸 위 — 수업에는 격언이 없다): 킹 머리줄 → 묶음 안 틈 → 할 일 글 → 묶음 틈 → 「누르면 직접」(보기 때만)
export const DEMO_FOOT = '화면을 눌러 직접 해 봐';
// 시범 자체가 가르칠 거리인 수업(L.demo — 「지키는 적부터」는 한 번 끊겨 보인다)은 누름으로 건너뛰지 않고 끝까지 보여 준다(U-10)
export const DEMO_WATCH = '다 보면 직접 해 봐';
export function lessonPanelLayout(say, demo) { return kingNoteLayout(say, RW, demo ? (demo === 'watch' ? DEMO_WATCH : DEMO_FOOT) : null); }

const AFTER_SEC = 3; // 끝맺는 한 줄이 떠 있는 시간
const BAND_Y = SP.s; // 판 위 띠(29절 제목 자리 4): 화면 윗변에서 4

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
    if (st.moves) return reg('btn:moves', 6) || { x: 440, y: 10 };
    if (st.discard) return reg('btn:discard', 8) || { x: 440, y: 210 };
    let sq = lessonSq(st.drop ?? st.cap);
    if (sq == null && 'drop' in st) sq = this.clickable().list[0];
    if (sq == null) return { x: 240, y: 140 };
    const p = sqCenter(sq);
    return { x: p.x + 2, y: p.y + 4 };
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
    if (st.moves) this.si++; // 시범은 「행마」를 가리켜 누르기만 한다(덮개는 내 차례에 연다)
    else if (st.pick != null) this.toggle(st.pick);
    else if (st.discard) this.discard();
    else {
      let sq = lessonSq(st.drop ?? st.cap);
      if (sq == null) sq = this.clickable().list[0];
      this.tapSq = sq;
      this.clickSq(sq);
    }
  }
  skipDemo() { if (this.phase === 'demo' && !this.L.demo) this.app.go('lesson', { index: this.index, phase: 'play' }); }

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
  // 「행마」: 언제든 열 수 있고, 「행마」 걸음이면 넘어간다
  openMoves() {
    if (this.phase !== 'play') return;
    const st = this.step;
    if (st && st.moves) this.si++;
    super.openMoves();
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
      // 끝맺는 한 줄(after)은 알림으로, 다 읽을 때까지 머문다
      if (won && this.L.after) { this.toast(this.L.after, PAL.gold, AFTER_SEC); this.wait = AFTER_SEC; }
    }
  }
  // 보기(손가락이 혼자 둔다)는 내내 움직인다
  animating() { return super.animating() || this.phase === 'demo'; }
  achvSpot() { return null; } // 판 위 줄은 띠가 쓴다 — 업적 알림은 알림 자리(toastSpot)
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
  // 가는 곳에 맞는 이름: 처음 켬 덮개에서 왔으면 곧바로 판으로(건너뛰기), 목록 · 「이어서」 흐름은 목록으로
  get skipLabel() { return this.app.lessonFrom === 'welcome' ? '건너뛰기' : '목록'; }

  // ── 그리기
  draw(ctx, ui) {
    super.draw(ctx, ui);
    const g = LESSON_GROUPS.find((x) => x.id === this.L.group);
    // 판 위 한 줄: 판 폭에 안 들어가면(영어) 수업 번호만 — 제목은 왼쪽 머리 칸에 있다
    const full = `튜토리얼 ${this.index + 1}/${LESSONS.length} · ${this.L.title}`;
    const t = measure(full, true) <= S * 8 ? full : `튜토리얼 ${this.index + 1}/${LESSONS.length}`;
    text(ctx, t, BX + S * 4, BAND_Y, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    this.drawTopRow(ctx, ui);
    this.drawPress(ctx, ui);
    if (this.phase === 'demo' && this.demo && !this.demo.done) this.drawFinger(ctx);
  }
  drawBoard(ctx, ui) {
    super.drawBoard(ctx, ui);
    const t = this.clickable();
    const pulse = t.kind === 'capture' && t.list.length ? beat(this.app.time, 4) % 2 : 0;
    if (t.kind === 'capture') for (const sq of t.list) strokeSq(ctx, sq, PAL.goldHi, 2, pulse * 2);
  }
  drawRight(ctx, ui) {
    super.drawRight(ctx, ui);
    // 킹의 말(오른쪽 칸 위 — 수업에는 격언이 없다). 이긴 뒤에는 금관이 반짝인다
    const demo = this.phase === 'demo' && (this.L.demo ? 'watch' : true), lay = lessonPanelLayout(this.say, demo);
    const won = this.ended && this.hold.b.status === 'won';
    kingNote(ctx, this.app, RX, TOP, RW, this.say, lay, { joy: won, name: '킹 말 · 할 일', line: (l, x, y) => richText(ctx, l, x, y, PAL.cardInk, { termCol: PAL.goldDk, ui }) });
  }
  // 누를 곳이 손이면 그 카드에 숨 쉬는 테, 희생 · 행마면 단추에(이름표 줄의 「행마」까지 그린 뒤)
  drawPress(ctx, ui) {
    const st = this.step;
    if (this.phase === 'play' && st && !this.busy) {
      const id = st.pick != null ? `hand:${st.pick}` : st.discard ? 'btn:discard' : st.moves ? 'btn:moves' : null;
      const r = id && ui.regions.find((x) => x.id === id);
      if (!r) return;
      motion(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.app.time * 6);
      if (st.pick != null) {
        // 손 카드: 부채의 그 카드 자리(크기 · 들림 · 기울기)를 그대로 따라 두른다
        const n = this.view.hand.length, hr = this.handRect(st.pick, n), y = hr.y - (this.sel.includes(st.pick) ? HAND.lift : 0);
        const px = hr.x + hr.w / 2, py = y + hr.h * 1.2;
        ctx.save(); ctx.translate(px, py); ctx.rotate(hr.rot); ctx.translate(-px, -py);
        pointRing(ctx, { x: hr.x, y, w: hr.w, h: hr.h }, PAL.goldHi, 2);
        ctx.restore();
      } else pointRing(ctx, r, PAL.goldHi, 2);
      ctx.globalAlpha = 1;
    }
  }
  // 오른쪽 칸 위 이름표 줄(멈춤 단추 왼쪽): 「건너뛰기」(처음 켬 덮개에서 왔을 때) 또는 「목록」 · 「행마」(대국과 같은 자리)
  drawTopRow(ctx, ui) {
    // 대국과 같은 「행마」 단추(폭 · 손가락 구역): 왼쪽은 「건너뛰기」 · 「목록」이 붙어 있어 넓히지 않는다
    // 왼쪽 단추가 글 + 10을 지키는 만큼만 넓힌다(영어 「Skip」 · 「Moves」)
    const tw = measure('행마', true), lw = measure(this.skipLabel, true) + 10;
    const mw = Math.max(tw + 10, Math.min(tw + 14, PAUSE.x - 4 - 4 - RX - lw)), mx = PAUSE.x - 4 - mw;
    button(ctx, ui, 'btn:moves', mx, 2, mw, BTN_S, '행마', { onClick: () => this.openMoves(), grow: { u: Infinity, d: Math.max(0, TOP - 1 - (2 + BTN_S)) } });
    button(ctx, ui, 'lesson:skip', RX, 2, mx - 4 - RX, BTN_S, this.skipLabel, { onClick: () => this.skipAll(), grow: { u: Infinity, d: Math.max(0, TOP - 1 - (2 + BTN_S)) } });
  }
  // 두 줄 제목: 둘째 줄은 본문 줄 높이(14)로 붙이고, 남는 자리는 「점수」 이름표 앞 틈이 된다(대국 이름 칸 높이는 그대로)
  leftLayout() {
    const lay = super.leftLayout();
    if (lay.titles.length > 1) lay.titles = lay.titles.map((t, k) => t + k * (LINE - LINE_TITLE));
    return lay;
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
  // 흐린 손가락(화살 모양 벡터 — 잉크 테 · 흰 몸). 누르는 순간 둥근 고리가 퍼진다
  drawFinger(ctx) {
    const { x, y } = this.demo.at;
    const px = Math.round(x) + 0.5, py = Math.round(y) + 0.5 + (this.demo.press > 0 ? 1 : 0);
    const P = [[0, 0], [0, 9.5], [2.3, 7.4], [3.8, 10.6], [5.4, 9.9], [3.9, 6.8], [6.8, 6.6]];
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    P.forEach(([dx, dy], k) => (k ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
    ctx.closePath();
    ctx.fillStyle = PAL.white; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = PAL.frameDk; ctx.stroke();
    if (this.demo.press > 0) {
      ctx.globalAlpha = Math.min(1, this.demo.press * 2);
      ctx.beginPath(); ctx.ellipse(px, py, 5.5, 5.5, 0, 0, Math.PI * 2);
      ctx.lineWidth = 1.2; ctx.strokeStyle = PAL.white; ctx.stroke();
    }
    ctx.restore();
  }
}
