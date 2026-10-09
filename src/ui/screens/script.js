// 첫 판 대본 대국(CHM-22): 처음 켠 사람의 1관 연습. 대국 화면을 그대로 쓰고(판의 진짜 첫 대국 — 점수 · 보상 · 시계 · 기록이 평소처럼 든다),
// 걸음(src/ui/tutorial.js)마다 누를 곳 하나만 밝히며 킹이 말한다. 어둡게 누르기 · 누를 곳 막기 · 말풍선은 따라 하는 길(coach.js startGuide).
// ② 끊김은 대국 복사본에서 한 번 끊겨 보고(실제 규칙), 「되돌린다」로 복사본을 버린다 — 진짜 대국은 그대로다.
import { apply } from '../../sim/battle.js';
import { PAL } from '../../render/palette.js';
import { BattleScreen } from './battle.js';
import { TUTORIAL_STEPS as STEPS, stepSq, firstStepOf } from '../tutorial.js';
import { startGuide, markSeen } from '../coach.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export class ScriptScreen extends BattleScreen {
  constructor(app, args = {}) {
    const hold = { scratch: null };
    const source = {
      kind: 'script',
      live: () => hold.scratch || app.run.battle,
      cmd: (c) => (hold.scratch ? apply(hold.scratch, c) : app.cmd(c)),
      get run() { return app.run; },
    };
    super(app, { ...args, source });
    this.hold = hold;
    const b = app.run.battle;
    // 이어 하기로 돌아왔으면 그 수의 첫 걸음부터(사슬 한가운데면 사슬이 끝날 때까지 누를 곳을 좁히지 않는다)
    this.free = b.status === 'chain';
    this.k = firstStepOf(b.movesUsed + (this.free ? 1 : 0));
    this.flowReady = false;
    startGuide(app, STEPS.map((st, i) => ({
      target: () => this.targetOf(i),
      say: st.say,
      ok: st.ok ? () => this.okStep(i) : null,
      okLabel: st.okLabel || null,
      joy: !!st.joy,
      noSkip: !!st.end,
      done: st.ok ? null : () => this.k > i,
    })), null, { hold: () => this.holding(), skip: () => this.skip() });
    app.guide.i = this.k;
    app.guide.owner = this;
    if (STEPS[this.k] && STEPS[this.k].try) this.beginTry();
  }
  get step() { return STEPS[this.k] || null; }
  // 화면을 떠나면 길도 닫는다(타이틀 · 막간 · 건너뛰기)
  onLeave() { super.onLeave(); if (this.app.guide && this.app.guide.owner === this) this.app.guide = null; }
  // 판의 기록(최고 한 수 · 다시 보기)은 복사본에서 둔 수를 적지 않는다
  get rehearsal() { return !!this.hold.scratch; }

  // 걸음이 가리키는 구역
  targetOf(i) {
    const st = STEPS[i];
    if (st.pick) { const h = this.view.hand.findIndex((p) => p.t === st.pick); return h >= 0 ? `hand:${h}` : null; }
    if (st.drop || st.cap || st.sq) return `sq:${stepSq(st)}`;
    if (st.discard) return 'btn:discard';
    if (st.moves) return 'btn:moves';
    return st.target || null;
  }
  // 길이 쉬는 때: 연출 · 대국 띠 · 다른 화면 · 사슬을 이어 두는 중 · 대국이 끝나 막간을 기다리기 전
  holding() {
    const b = this.live();
    if (this.app.screen !== this || this.busy || this.banner) return true;
    if (this.free && b && b.status === 'chain') return true;
    const st = this.step;
    return !!(st && st.end && !this.flowReady);
  }
  okStep(i) {
    const st = STEPS[i];
    this.k = i + 1;
    if (st.rewind) this.rewind();
    if (st.sq === 'd6') markSeen(this.app, 'incoming'); // 증원 그림자는 킹이 가르쳤다
    if (st.end) { this.app.guide = null; BattleScreen.prototype.afterSeq.call(this); return; }
    if (this.step && this.step.try) this.beginTry();
  }
  // ② 한 번 끊겨 보기: 진짜 대국의 복사본에서 둔다
  beginTry() {
    this.hold.scratch = clone(this.app.run.battle);
    this.bRef = this.hold.scratch;
    this.targets = null;
  }
  rewind() {
    this.hold.scratch = null;
    this.bRef = this.app.run.battle;
    this.sel = []; this.targets = null; this.drops = null; this.pvCache = null;
    this.sync();
    this.word('되돌리기', PAL.gold, 1, 2);
    this.snd('pick');
  }
  skip() {
    const app = this.app;
    app.guide = null;
    this.hold.scratch = null;
    if (app.run.phase !== 'battle') { BattleScreen.prototype.afterSeq.call(this); return; }
    const ev = app.cmd({ type: 'unscript' });
    app.fx.clear();
    app.go('battle', { events: ev });
  }

  // ── 누를 곳: 지금 걸음만
  filterTargets(t) {
    if (this.free) return t;
    const st = this.step;
    if (!st) return { ...t, list: [] };
    if (t.kind === 'drop') return { ...t, list: st.drop ? t.list.filter((s) => s === stepSq(st)) : [] };
    if (t.kind === 'capture') return { ...t, list: st.cap ? t.list.filter((s) => s === stepSq(st)) : [] };
    if (t.kind === 'redrop') return { ...t, list: [] };
    return t;
  }
  toggle(i) {
    const st = this.step, p = this.view.hand[i];
    if (this.free || !st || !st.pick || !p || p.t !== st.pick || this.sel.includes(i)) return;
    super.toggle(i);
    if (this.sel.includes(i)) this.k++;
  }
  discard() {
    const st = this.step;
    if (!st || !st.discard) return;
    super.discard();
  }
  openMoves() {
    const st = this.step;
    if (st && st.moves) this.k++;
    super.openMoves();
  }
  // 명령이 실제로 나가면 걸음을 넘긴다
  send(cmd) {
    const st = this.step;
    if (!this.free && st && ((cmd.type === 'drop' && st.drop) || (cmd.type === 'capture' && st.cap) || (cmd.type === 'discard' && st.discard))) this.k++;
    super.send(cmd);
  }
  afterSeq() {
    const b = this.live();
    if (this.free && b && b.status !== 'chain') this.free = false;
    // 대국이 끝났다: 킹의 마지막 말을 듣고 나서 막간으로
    if (!this.hold.scratch && this.app.run.phase !== 'battle') {
      this.fast = false;
      this.sync();
      this.flowReady = true;
      const end = STEPS.findIndex((s) => s.end);
      this.k = end;
      if (this.app.guide) this.app.guide.i = end;
      else BattleScreen.prototype.afterSeq.call(this);
      return;
    }
    super.afterSeq();
  }
}
