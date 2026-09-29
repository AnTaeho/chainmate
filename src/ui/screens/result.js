// 판 결과: 이김/짐, 도달 관, 최고 한 수(작은 판에 다시 둔다), 목표에 모자란 점수(아슬아슬), 모은 조각,
// 새 도감 칸 · 해금 알림 · 다음 해금까지. 「다시」 / 「타이틀」.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite, num, short, fitNum, line, measure } from '../../render/gfx.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { shardIcon } from '../parts.js';
import { nextUnlock } from '../records.js';
import { rating } from './setup.js';
import { lerp } from '../anim.js';
import { PAD_BOX, LINE, GAP_GROUP, GAP_IN, flow } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const Q = 16, MX = 330, ROW_R = 300; // 다시 보기 판: 칸 16px. 윗변 MY는 결과 상자 자리에 따라(draw가 정한다). ROW_R: 기록 줄 수치의 오른끝
let MY = 50;
const STEP = 0.5;

export class ResultScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    const run = app.run;
    this.won = run.phase === 'won';
    const played = run.log.filter((l) => !l.skipped);
    this.best = played.reduce((a, l) => Math.max(a, l.best || 0), 0);
    const last = played[played.length - 1];
    this.last = last;
    this.short = !this.won && last && last.target ? Math.max(0, last.target - last.score) : 0;
    this.pct = last && last.target ? Math.floor((last.score / last.target) * 100) : 0;
    this.replay = run.bestReplay || null;
    app.sfx(this.won ? 'fanfare' : 'lose');
    this.out = app.finishRun() || { unlocked: [], dan: null, fresh: 0 };
    this.next = nextUnlock(app.records);
  }
  update(dt) { this.t += dt; }

  xy(sq) { return { x: MX + (sq & 7) * Q, y: MY + (7 - (sq >> 3)) * Q }; }
  drawReplay(ctx) {
    const r = this.replay;
    box(ctx, MX - 4, MY - 4, Q * 8 + 8, Q * 8 + 8, PAL.frame, PAL.frameDk);
    for (let rr = 0; rr < 8; rr++) for (let f = 0; f < 8; f++) rect(ctx, MX + f * Q, MY + rr * Q, Q, Q, (rr + f) % 2 ? PAL.dark : PAL.light);
    if (!r) return;
    const n = r.caps.length;
    const cycle = 0.8 + n * STEP + 1.6;
    const t = this.t % cycle - 0.8;          // < 0: 떨구기 전
    const done = t < 0 ? -1 : Math.min(n, Math.floor(t / STEP));
    const p = t < 0 ? 0 : Math.min(1, (t - done * STEP) / 0.25);
    // 적: 먹힌 것은 지운다
    const gone = new Set(r.caps.slice(0, Math.max(0, done)).map((c) => c.to));
    const cur = done >= 0 && done < n ? r.caps[done] : null;
    if (cur && p >= 1) gone.add(cur.to);
    r.board.forEach((c, sq) => {
      if (!c || c.mine || gone.has(sq)) return;
      const { x, y } = this.xy(sq);
      sprite(ctx, c.t, 'b', x, y - 6, { alpha: 0.9 });
    });
    if (t < 0) return;
    // 지나온 길
    let pos = r.drop.sq, form = r.drop.piece;
    const path = [pos];
    for (let i = 0; i < Math.min(done, n); i++) { pos = r.caps[i].to; form = r.caps[i].after; path.push(pos); }
    for (let i = 0; i + 1 < path.length; i++) { const a = this.xy(path[i]), b = this.xy(path[i + 1]); line(ctx, a.x + 8, a.y + 8, b.x + 8, b.y + 8, PAL.gold); }
    let x = this.xy(pos).x, y = this.xy(pos).y;
    if (cur) {
      const a = this.xy(cur.from), b = this.xy(cur.to);
      x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p);
      form = p >= 1 ? cur.after : cur.form;
    }
    sprite(ctx, form, 'w', x, y - 6);
    if (done >= n) {
      const e = this.xy(pos);
      frame(ctx, e.x, e.y, Q, Q, r.reason === 'cut' ? PAL.red : PAL.gold);
    }
  }

  // 막간 상자(hug, PAD_BOX): 왼쪽은 큰 제목(두 배) → 묶음 틈 → 기록 줄 → 묶음 틈 → 모은 조각, 오른쪽은 최고 한 수 판.
  // 아래로 묶음 틈 → 판 밖에 남은 것(한 줄씩) → 묶음 틈 → 단추 줄
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    const x = 12, w = W - 24, P = PAD_BOX;
    const rows = [];
    // 수치 줄: 이름표(x + P + 8) 오른쪽부터 오른끝(ROW_R)까지에 안 들어가면 수를 짧은 꼴로(끝없는 대국의 큰 수)
    const room = (label) => ROW_R - (x + P + 8 + measure(label) + 6);
    const nums = (label, f) => { const s = f(num); return measure(s, true) <= room(label) ? s : f(short); };
    if (this.last) rows.push(['도달', `${run.ante}관 ${KIND_NAME[this.last.kind]}`]);
    rows.push(['최고 한 수', fitNum(this.replay ? Math.max(this.best, this.replay.score) : this.best, room('최고 한 수'))]);
    if (!this.won && this.last) {
      rows.push(['마지막 대국', nums('마지막 대국', (n) => `${n(this.last.score)} / ${n(this.last.target)}`)]);
      if (this.short > 0) rows.push(['모자란 점수', nums('모자란 점수', (n) => `${n(this.short)} (${this.pct}%)`)]);
    }
    rows.push(['상금', `$${run.money}`]);
    const got = LEGENDS.filter((l) => run.fragments[l.id] && (run.fragments[l.id].first || run.fragments[l.id].feat || run.fragments[l.id].gold)).slice(0, 3);
    // 판 밖에 남은 것: 새 도감 칸 · 해금 · 다음 해금까지
    const notes = [];
    if (this.out.fresh) notes.push([`도감 ${this.out.fresh}칸을 새로 채웠다`, PAL.ink]);
    if (this.out.deeper) notes.push([`끝없는 대국 가장 깊은 곳 ${this.out.endless}관`, PAL.gold]);
    for (const id of this.out.unlocked) notes.push([`오프닝 「${OPENINGS[id].name}」이 열렸다`, PAL.gold]);
    if (this.out.dan) notes.push([`레이팅 ${rating(this.out.dan)}이 열렸다`, PAL.gold]);
    if (!this.out.unlocked.length && this.next) notes.push([`다음 해금 ${OPENINGS[this.next.id].name}: ${this.next.text} ${this.next.have}/${this.next.need}`, PAL.dim]);
    if (run.daily) notes.push([`오늘의 대국 ${run.daily}`, PAL.goldDk]);
    const shown = notes.slice(-3);
    // 상자 윗변을 0으로 재고(오른쪽 판: 이름표 → 4 → 판 → 4 → 점수) 화면 가운데에 놓는다
    const f = flow(P);
    const titleY = f.space(LINE * 2);
    f.gap(GAP_GROUP);
    const rowYs = rows.map(() => f.line());
    let fragY = null, fragYs = [];
    if (got.length) { f.gap(GAP_GROUP); fragY = f.line(); f.gap(GAP_IN); fragYs = got.map(() => f.line()); }
    const boardTop = P + LINE + 4;
    f.y = Math.max(f.y, boardTop + Q * 8 + 4 + LINE);
    const noteYs = shown.map((_, i) => (i ? f : f.gap(GAP_GROUP)).line());
    const btnY = f.gap(GAP_GROUP).space(18);
    const h = f.y + P, y = Math.max(0, Math.floor((270 - h) / 2));
    MY = y + boardTop;
    const by = y + btnY;
    for (const a of [rowYs, fragYs, noteYs]) a.forEach((v, i) => { a[i] = v + y; });
    const tY = y + titleY, fY = fragY == null ? null : y + fragY;
    openBox('panel', x, y, w, h, P, { name: '결과' });
    box(ctx, x, y, w, h, PAL.feltDk, this.won ? PAL.gold : PAL.red);
    const title = run.endless && !this.won ? `끝없는 대국 ${run.ante}관` : this.won ? '여덟 관을 꺾었다' : '판이 끝났다';
    // 큰 제목은 두 배, 왼쪽 칸(판 왼쪽까지)에 안 들어가면(영어) 한 배 굵게 — 같은 줄 높이 가운데
    const leftW = MX - 4 - GAP_GROUP - (x + P);
    const big = measure(title, true) * 2 <= leftW;
    text(ctx, title, x + P + Math.floor(leftW / 2), big ? tY : tY + LINE - 7, this.won || run.endless ? PAL.gold : PAL.red, { align: 'center', bold: true, scale: big ? 2 : 1 });
    rows.forEach(([a, b], i) => {
      text(ctx, a, x + P + 8, rowYs[i], PAL.dim);
      text(ctx, b, ROW_R, rowYs[i], a === '모자란 점수' ? PAL.red : PAL.ink, { align: 'right', bold: true });
    });
    // 최고 한 수 다시 보기
    text(ctx, '최고 한 수', MX + 64, MY - 4 - LINE, PAL.dim, { align: 'center' });
    this.drawReplay(ctx);
    if (this.replay) text(ctx, fitNum(this.replay.score, Q * 8 + 8), MX + 64, MY + Q * 8 + 4, PAL.gold, { align: 'center', bold: true });
    // 조각
    if (got.length) {
      text(ctx, '모은 조각', x + P + 8, fY, PAL.dim);
      got.forEach((l, i) => {
        const f2 = run.fragments[l.id];
        const n = (f2.first ? 1 : 0) + (f2.feat ? 1 : 0) + (f2.gold ? 1 : 0);
        const yl = fragYs[i];
        text(ctx, l.name, x + P + 8, yl, run.legends.includes(l.id) ? PAL.gold : PAL.ink);
        for (let k = 0; k < 3; k++) {
          if (k < n) shardIcon(ctx, 236 + k * 22, yl - 1, PAL.gold, PAL.goldDk);
          else rect(ctx, 238 + k * 22, yl + 4, 10, 6, PAL.frame);
        }
      });
    }
    shown.forEach(([s2, c], i) => text(ctx, s2, W / 2, noteYs[i], c, { align: 'center' }));
    if (this.won) {
      button(ctx, ui, 'result:endless', W / 2 - 150, by, 90, 18, '계속 두기', { onClick: () => this.endless() });
      button(ctx, ui, 'result:again', W / 2 - 45, by, 90, 18, '다시', { onClick: () => this.again(), tone: 'gold' });
      button(ctx, ui, 'result:title', W / 2 + 60, by, 90, 18, '타이틀', { onClick: () => app.toTitle() });
    } else {
      button(ctx, ui, 'result:again', W / 2 - 100, by, 90, 18, '다시', { onClick: () => this.again(), tone: 'gold' });
      button(ctx, ui, 'result:title', W / 2 + 10, by, 90, 18, '타이틀', { onClick: () => app.toTitle() });
    }
    closeBox();
  }
  again() { const r = this.app.run; this.app.newRun({ opening: r.opening, dan: r.dan, daily: !!r.daily }); }
  endless() { this.app.cmd({ type: 'endless' }); this.app.goPhase(); }
  key(k) { if (k === 'Enter') this.again(); else if (k === 'Escape') this.app.toTitle(); }
}
