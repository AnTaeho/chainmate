// 판 결과: 이김/짐, 도달 관, 최고 한 수(작은 판에 다시 둔다 — 대국 화면과 같은 길), 목표에 모자란 점수(아슬아슬), 모은 조각,
// 새 도감 칸 · 해금 알림 · 다음 해금까지. 「다시」 / 「하이라이트」(CHM-73, 최고 한 수가 있는 판만) / 「타이틀」. 오늘의 대국이면 순위 카드(CHM-70, screens/rank.js).
// quiet: 순위 화면에서 돌아올 때 — 소리를 다시 내지 않는다
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite, num, short, fitNum, line, measure, fine } from '../../render/gfx.js';
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
import { replayState, routeAt } from '../fxroute.js';
import { rankCard, drawRankCard, CARD_NEIGHBOURS } from './rank.js';
import { hasHighlight } from '../highlight.js';

const Q = 16, MX = 330, ROW_R = 300; // 다시 보기 판: 칸 16px. 윗변 MY는 결과 상자 자리에 따라(draw가 정한다). ROW_R: 기록 줄 수치의 오른끝
let MY = 50;
const STEP = 0.5;
export const RESULT_BTN = { 2: [90, 20], 3: [90, 15], 4: [84, 8] }; // 단추 수 → [폭, 사이]

export class ResultScreen {
  constructor(app, { quiet = false } = {}) {
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
    if (!quiet) app.sfx(this.won ? 'fanfare' : 'lose');
    this.out = app.finishRun() || { unlocked: [], dan: null, fresh: 0 };
    this.next = nextUnlock(app.records);
  }
  update(dt) { this.t += dt; }

  xy(sq) { return { x: MX + (sq & 7) * Q, y: MY + (7 - (sq >> 3)) * Q }; }
  // 다시 보기(CHM-57): 대국 화면과 같은 길 — 꺾쇠 · 물수제비는 꺾은 칸을 거치고, 넘기는 넘은 칸 너머로 작은 포물선,
  // 궁수 모습은 제자리에서 화살을 쏘고, 화약병 · 폭약으로 터진 적도 판에서 지운다(fxroute.js replayState)
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
    const st = replayState(r, done, p);
    r.board.forEach((c, sq) => {
      if (!c || c.mine || st.gone.has(sq)) return;
      const { x, y } = this.xy(sq);
      sprite(ctx, c.t, 'b', x, y - 6, { alpha: 0.9 });
    });
    if (t < 0) return;
    const mid = (sq) => { const a = this.xy(sq); return { x: a.x + 8, y: a.y + 8 }; };
    const poly = (pts, col) => { for (let i = 0; i + 1 < pts.length; i++) { const a = mid(pts[i]), b = mid(pts[i + 1]); line(ctx, a.x, a.y, b.x, b.y, col); } };
    // 지나온 길(꺾인 길은 꺾은 칸을 거쳐) · 제자리 쏘기는 점선 대신 짧은 화살 줄
    for (const pts of st.trail) poly(pts, PAL.gold);
    for (const [a0, b0] of st.shots) { const a = mid(a0), b = mid(b0); line(ctx, a.x, a.y, b.x, b.y, PAL.goldDk); frame(ctx, this.xy(b0).x, this.xy(b0).y, Q, Q, PAL.goldDk); }
    let { x, y } = this.xy(st.pos);
    let moving = false;
    const cur = st.cur, rt = st.route;
    if (cur && p < 1) {
      if (rt.kind === 'shot') {
        // 화살: 제자리에서 먹을 칸까지 날아간다
        const a = mid(cur.from), b = mid(cur.to);
        fine(() => { const hx = lerp(a.x, b.x, p), hy = lerp(a.y, b.y, p); line(ctx, a.x, a.y, hx, hy, PAL.goldHi); rect(ctx, hx - 1, hy - 1, 2, 2, PAL.white); });
      } else if (rt.kind === 'bend') {
        const at = routeAt(rt.pts, p), a = this.xy(rt.pts[at.i]), b = this.xy(rt.pts[at.i + 1]);
        x = lerp(a.x, b.x, at.k); y = lerp(a.y, b.y, at.k); moving = true;
        // 지나온 몫: 꺾은 칸까지 + 지금 자리까지
        poly(rt.pts.slice(0, at.i + 1), PAL.goldDk);
        { const c = mid(rt.pts[at.i]); fine(() => line(ctx, c.x, c.y, x + 8, y + 8, PAL.goldDk)); }
      } else {
        const a = this.xy(rt.pts[0]), b = this.xy(rt.pts[1]);
        x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p) - (rt.kind === 'hop' ? Math.sin(p * Math.PI) * 6 : 0); moving = true;
      }
    }
    // 다시 보기의 움직이는 기물은 소수점 자리로
    if (moving) fine(() => sprite(ctx, st.form, 'w', x, y - 6)); else sprite(ctx, st.form, 'w', x, y - 6);
    if (done >= n) {
      const e = this.xy(st.pos);
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
    if (this.out.fresh) notes.push([`도감 ${this.out.fresh}칸을 새로 채웠어요`, PAL.ink]);
    if (this.out.deeper) notes.push([`끝없는 대국 최고 도달 ${this.out.endless}관`, PAL.gold]);
    for (const id of this.out.unlocked) notes.push([`오프닝 「${OPENINGS[id].name}」이 열렸어요`, PAL.gold]);
    if (this.out.dan) notes.push([`레이팅 ${rating(this.out.dan)}이 열렸어요`, PAL.gold]);
    if (!this.out.unlocked.length && this.next) notes.push([`다음 해금 ${OPENINGS[this.next.id].name}: ${this.next.text} ${this.next.have}/${this.next.need}`, PAL.dim]);
    // 순위 카드(CHM-70): 오늘의 대국 판이면 왼쪽 칸 아래에. 카드가 「오늘의 대국 날짜」 줄을 대신한다
    const hasCard = !!rankCard(app, run, 0);
    if (run.daily && !hasCard) notes.push([`오늘의 대국 ${run.daily}`, PAL.goldDk]);
    // 상자 윗변을 0으로 재고(오른쪽 판: 이름표 → 4 → 판 → 4 → 점수) 화면 가운데에 놓는다.
    // 카드의 이웃 줄은 판 밖 알림 한 줄이 살아남는 가장 큰 수(둘씩 → 하나씩 → 내 줄만 → 머리만)로, 알림은 270 안에 들어가는 만큼(셋까지)
    const boardTop = P + LINE + 4;
    const lay = (n) => {
      const f = flow(P), o = { f };
      o.titleY = f.space(LINE * 2);
      f.gap(GAP_GROUP);
      o.rowYs = rows.map(() => f.line());
      o.fragY = null; o.fragYs = [];
      if (got.length) { f.gap(GAP_GROUP); o.fragY = f.line(); f.gap(GAP_IN); o.fragYs = got.map(() => f.line()); }
      o.card = hasCard ? rankCard(app, run, n) : null;
      if (o.card) { f.gap(GAP_GROUP); o.cardY = f.space(o.card.h); }
      f.y = Math.max(f.y, boardTop + Q * 8 + 4 + LINE);
      o.room = Math.floor((270 - (f.y + GAP_GROUP + 18 + P) - GAP_GROUP) / LINE);
      return o;
    };
    let L0 = null;
    for (const n of hasCard ? CARD_NEIGHBOURS : [0]) { L0 = lay(n); if (L0.room >= Math.min(1, notes.length)) break; }
    const { f, titleY, rowYs, fragY, fragYs, card } = L0;
    const shown = L0.room > 0 ? notes.slice(-Math.min(3, L0.room)) : [];
    const noteYs = shown.map((_, i) => (i ? f : f.gap(GAP_GROUP)).line());
    const btnY = f.gap(GAP_GROUP).space(18);
    const h = f.y + P, y = Math.max(0, Math.floor((270 - h) / 2));
    MY = y + boardTop;
    const by = y + btnY;
    for (const a of [rowYs, fragYs, noteYs]) a.forEach((v, i) => { a[i] = v + y; });
    const tY = y + titleY, fY = fragY == null ? null : y + fragY;
    openBox('panel', x, y, w, h, P, { name: '결과' });
    box(ctx, x, y, w, h, PAL.feltDk, this.won ? PAL.gold : PAL.red);
    const title = run.endless && !this.won ? `끝없는 대국 ${run.ante}관` : this.won ? '8관 돌파!' : '판이 끝났어요';
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
    if (card) drawRankCard(ctx, ui, app, card, x + P, y + L0.cardY, leftW);
    shown.forEach(([s2, c], i) => text(ctx, s2, W / 2, noteYs[i], c, { align: 'center' }));
    // 단추 줄: (계속 두기) · 다시 · (하이라이트) · 타이틀 — 넷이면 폭 84 · 사이 8, 셋은 90 · 15, 둘은 90 · 20
    const btns = [];
    if (this.won) btns.push(['result:endless', '계속 두기', () => this.endless(), 'plain']);
    btns.push(['result:again', '다시', () => this.again(), 'gold']);
    if (hasHighlight(run)) btns.push(['result:highlight', '하이라이트', () => app.openOverlay('highlight'), 'plain']);
    btns.push(['result:title', '타이틀', () => app.toTitle(), 'plain']);
    const [bw, bg] = RESULT_BTN[btns.length];
    const bx = W / 2 - Math.floor((btns.length * bw + (btns.length - 1) * bg) / 2);
    btns.forEach(([id, label, onClick, tone], i) => button(ctx, ui, id, bx + i * (bw + bg), by, bw, 18, label, { onClick, tone }));
    closeBox();
  }
  again() { const r = this.app.run; this.app.newRun({ opening: r.opening, dan: r.dan, daily: !!r.daily }); }
  endless() { this.app.cmd({ type: 'endless' }); this.app.goPhase(); }
  key(k) { if (k === 'Enter') this.again(); else if (k === 'Escape') this.app.toTitle(); }
}
