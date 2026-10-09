// 다시 두기(CHM-59, 복기): 갈림길 상태부터 이길 길을 수마다 실제 연출로 다시 둔다(대국 화면을 그대로 — 꺾인 길 · 넘기 · 쏘기 · 터짐).
// ▶ · → 다음 수, ◀ · ← 앞 수(그 수 앞 상태로 곧바로). 왼쪽 칸 사슬 자리에 그 수의 「?」 내 수 / 「!」 이길 길을 견준다.
// 「넘어가기」는 지금 흐름(막간 · 시계 · 상점)으로. 대국 복사본에서만 두고 판의 기록(최고 한 수 · 다시 보기)에는 적지 않는다.
import { apply } from '../../sim/battle.js';
import { cloneBattle } from '../../sim/replay.js';
import { PAL } from '../../render/palette.js';
import { text, rect, fitNum, measure, artOf } from '../../render/gfx.js';
import { spriteCanvas, hiFor, SW, SH } from '../../render/sprites.js';
import { BattleScreen, BX, S, LX, LW, RX } from './battle.js';
import { PAD_BOX, LINE, BTN_S, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { panel, tipLines, fitText } from '../parts.js';
import { button } from '../ui.js';
import { ANNOT, drawAnnot, annotSize } from '../annot.js';
import { stepLabel } from '../review.js';

const ALL = Array.from({ length: 64 }, (_, i) => i);
const triangle = (dir) => (ctx, x, y, col) => {
  for (let k = 0; k < 4; k++) rect(ctx, dir < 0 ? x + 3 - k : x + k, y - 1 + k, 1, 9 - k * 2, col);
};

export class ReviewScreen extends BattleScreen {
  // res: replay.js review() 결과(kind 'path') · trail: 대국 화면이 남긴 결정 기록 · list: 대국 뒤 막간 · clock: 잃은 시계 칸(상점에서 깜빡임) · at: 보일 상태(둔 수)
  constructor(app, args = {}) {
    const { res, trail, at = 0 } = args;
    // 갈림길 상태와 이길 길의 수마다 뒤 상태(안개는 걷는다 — 규칙은 칸 줄로만 안개를 보므로 둔 결과는 같다)
    const states = [cloneBattle(trail[res.at].state)];
    for (const st of res.best) { const t = cloneBattle(states[states.length - 1]); for (const c of st.cmds) apply(t, c); states.push(t); }
    for (const t of states) t.revealed = ALL.slice();
    const hold = { b: cloneBattle(states[at]) };
    super(app, { source: { kind: 'review', live: () => hold.b, cmd: (c) => apply(hold.b, c), get run() { return app.run; }, after: (scr) => scr.stepDone() } });
    this.hold = hold;
    this.args = args;
    this.res = res;
    this.states = states;
    this.i = at;          // 둔 이길 길 수
    this.queue = [];      // 이번 수에 남은 명령(사슬 먹기)
    this.playing = false;
    this.banner = null;   // 마스터 띠 · 대국 띠는 다시 띄우지 않는다
    this.hideGain = true; // 목표 막대 위 「+N」 자리에 「복기 · i/n수」
  }
  get rehearsal() { return true; }
  get n() { return this.res.best.length; }

  // ── 넘기기
  forward() {
    if (this.playing) { this.fast = true; return; }
    if (this.i >= this.n) return;
    this.queue = this.res.best[this.i].cmds.slice();
    this.playing = true;
    this.pump();
  }
  pump() {
    if (this.busy || !this.queue.length) return;
    const c = this.queue.shift();
    if (c.type === 'drop' || c.type === 'discard') this.sel = [];
    this.send(c);
  }
  // 연출이 끝날 때마다(BattleScreen.afterSeq → source.after). 남은 먹기는 update가 연출이 다 빠진 뒤에 둔다
  stepDone() {
    if (!this.queue.length && this.playing) { this.playing = false; this.i++; }
  }
  back() {
    const to = this.playing ? this.i : this.i - 1;
    if (to < 0) return;
    this.app.go('review', { ...this.args, at: to });
  }
  moveOn() {
    const app = this.app;
    if (this.args.clock != null) app.clockFx = { idx: this.args.clock, t: 0 };
    app.flow(this.args.list || []);
  }

  update(dt) {
    super.update(dt);
    if (this.queue.length) this.pump();
    this.idleT = 0; // 손이 들썩이지 않게(누를 손이 아니다)
  }
  // 손 · 판은 누르지 않는다
  clickable() { return { kind: null, list: [] }; }
  toggle() {}
  canReboard() { return false; }
  handRowLayout() { return { label: false, tactics: [], rb: null }; }
  // 손 이름표 줄 왼쪽: ◀ ▶
  drawTactics(ctx, ui, y) {
    const live = !this.busy || this.playing;
    button(ctx, ui, 'btn:back', RX, y, 20, BTN_S, '', { enabled: this.i > 0 || this.playing, onClick: () => this.back(), icon: triangle(-1), tip: () => tipLines('앞 수', []) });
    button(ctx, ui, 'btn:forward', RX + 23, y, 20, BTN_S, '', { enabled: live && this.i < this.n, onClick: () => this.forward(), icon: triangle(1), tone: this.i < this.n && !this.playing ? 'gold' : 'plain', tip: () => tipLines('다음 수', []) });
  }
  actionButton(ctx, ui, x, y, db) {
    button(ctx, ui, 'btn:moveon', x, y, db.w, BTN_S, '건너뛰기', { onClick: () => this.moveOn(), tone: this.i >= this.n && !this.playing ? 'gold' : 'plain' });
  }

  // 왼쪽 칸 사슬 자리: 이 수의 내 수(「?」) / 이길 길(「!」). 둔 뒤에는 방금 둔 수, 두기 전에는 다음 수.
  // 사슬 칸 높이(판 틀 쌓기가 남긴 높이)에 두 줄이 들어가게 안 여백을 줄인다
  drawChainPanel(ctx, ui, lay) {
    const cy = lay.chain.y, ch = lay.chain.h, PX = PAD_BOX;
    const P = Math.max(1, Math.min(PAD_BOX, Math.floor((ch - LINE * 2) / 2)));
    const idx = this.playing ? this.i : Math.max(0, Math.min(this.n - 1, this.i - (this.i > 0 ? 1 : 0)));
    const rows = [['?', ANNOT.red, stepLabel(this.res.mines[idx]), '내가 둔 수'], ['!', ANNOT.teal, stepLabel(this.res.best[idx]), '이기는 수']];
    openBox('panel', LX, cy, LW, ch, P, { name: '견주기' });
    panel(ctx, LX, cy, LW, ch);
    ui.sideItem(LX, cy, LW, ch);
    const top = cy + Math.floor((ch - LINE * 2) / 2);
    rows.forEach(([mark, tone, st, name], k) => {
      const ry = top + k * LINE, ty = textY(ry);
      ui.region(`review:${k}`, LX + 2, ry, LW - 4, LINE, { tip: () => tipLines(name, []) });
      const tag = annotSize(mark);
      drawAnnot(ctx, mark, LX + PX, ry + Math.floor((LINE - tag.h) / 2), tone);
      let x = LX + PX + tag.w + 3;
      if (!st) { text(ctx, '—', x, ty, PAL.dim); return; }
      if (st.t) { ctx.drawImage(spriteCanvas(artOf(st.t), 'w', null, 0, hiFor(ctx, 0.5)), x, ry + 1, SW / 2, SH / 2); x += SW / 2 + 3; }
      const g = fitNum(st.gain, 40);
      const gw = measure(g, true);
      fitText(ctx, st.label, x, ty, LX + LW - PX - gw - 4 - x, PAL.ink);
      text(ctx, g, LX + LW - PX, ty, k ? PAL.gold : PAL.ink, { align: 'right', bold: true });
    });
    closeBox();
  }
  drawOver(ctx) {
    super.drawOver(ctx);
    text(ctx, `복기 · ${this.i}/${this.n}수`, BX + (S * 8) / 2, 1, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
  }
  key(k) {
    if (k === 'ArrowRight' || (k === 'Enter' && this.i < this.n)) this.forward();
    else if (k === 'ArrowLeft') this.back();
    else if (k === 'Escape') this.app.openOverlay('pause');
    else if (k === 'Enter' || k === ' ') { if (!this.playing) this.moveOn(); }
  }
}
