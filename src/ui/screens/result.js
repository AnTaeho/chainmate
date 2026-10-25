// 판 결과: 이김/짐, 도달 관, 최고 한 수(작은 판에 다시 둔다 — 대국 화면과 같은 길), 목표에 모자란 점수(아슬아슬), 모은 조각,
// 새 도감 칸 · 오프닝 · 레이팅 알림 · 다음 오프닝까지. 「다시」 / 「하이라이트」(CHM-73, 최고 한 수가 있는 판만) / 「타이틀」. 오늘의 대국이면 순위 카드(CHM-70, screens/rank.js).
// 해금(CHM-73, layout.md 26절): 다음 묶음까지의 막대 + 남은 관 한 줄, 이번 판에 묶음이 열렸으면 금빛 「N개 열렸어요」 단추(해금 화면이 그 묶음을 펼친 채 열린다).
// quiet: 순위 화면에서 돌아올 때 — 소리를 다시 내지 않는다
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, rframe, sprite, num, short, fitNum, seg as line, measure, fine, slot, R_SM, R_LG } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { button, buttonRow, btnW } from '../ui.js';
import { KIND_NAME, josa } from '../words.js';
import { shardIcon } from '../parts.js';
import { nextUnlock } from '../records.js';
import { rating } from './setup.js';
import { lerp } from '../anim.js';
import { PAD_BOX, LINE, GAP_IN, SP, BTN_H, INK_H, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { replayState, routeAt } from '../fxroute.js';
import { rankCard, drawRankCard, CARD_NEIGHBOURS } from './rank.js';
import { lightHue } from './common.js';
import { hasHighlight } from '../highlight.js';
import { unlockState, bundleSize, nextLine, progressBar, BAR_H } from '../unlockview.js';
import { confetti, screenFlash, CAP } from '../juice.js';

// 다시 보기 판: 칸 16px, 판 틀 오른끝이 상자 안 여백에 닿는다(12 + 456 − 8 − 4 − 128). 윗변 MY는 결과 상자 자리에 따라(draw가 정한다)
const Q = 16, MX = 328;
let MY = 50;
const STEP = 0.5;
const HERO_LH = 28;            // 두 배 글 줄(제목 · 큰 수)
const SHARD = { w: 16 };       // 조각 그림 칸(art.js shardIcon 16 × 14)
export const UNLOCK_LABEL = '해금';
const UNLOCK_BAR = 48;         // 한 줄 꼴 막대의 가장 짧은 폭

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
    // 판 승리(8관 돌파): 화면 번쩍과 양쪽 위에서 색종이 두 번(28절). 움직임 줄이기면 없음
    // 색종이는 제목 줄(제목 양 끝에서 터짐) 안에서만 보이고 제목 글 위는 지나가지 않는다 — 상자 안 다른 글을 가리지 않게(titleBand는 그릴 때 잰다)
    if (!quiet && this.won && !app.reducedMotion) {
      screenFlash(app.fx, { col: PAL.goldHi, a: 0.45, life: 0.3 });
      this.burst = true;
    }
    this.out = app.finishRun() || { unlocked: [], dan: null, fresh: 0 };
    this.next = nextUnlock(app.records);
    this.opened = this.out.tier ?? null; // 이번 판에 열린 묶음(단계)
  }
  update(dt) { this.t += dt; }
  // 최고 한 수 다시 보기는 늘 돈다
  animating() { return !!this.replay; }

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
    for (const [a0, b0] of st.shots) { const a = mid(a0), b = mid(b0); line(ctx, a.x, a.y, b.x, b.y, PAL.goldDk); rframe(ctx, this.xy(b0).x, this.xy(b0).y, Q, Q, R_SM, PAL.goldDk); }
    let { x, y } = this.xy(st.pos);
    let moving = false;
    const cur = st.cur, rt = st.route;
    if (cur && p < 1) {
      if (rt.kind === 'shot') {
        // 화살: 제자리에서 먹을 칸까지 날아간다
        const a = mid(cur.from), b = mid(cur.to);
        fine(() => { const hx = lerp(a.x, b.x, p), hy = lerp(a.y, b.y, p); line(ctx, a.x, a.y, hx, hy, PAL.goldHi); ctx.beginPath(); ctx.arc(hx, hy, 1.3, 0, Math.PI * 2); ctx.fillStyle = PAL.white; ctx.fill(); });
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
      rframe(ctx, e.x, e.y, Q, Q, R_SM, r.reason === 'cut' ? PAL.red : PAL.gold);
    }
  }

  // 막간 상자(hug, PAD_BOX): 왼쪽 칸은 큰 제목(두 배) → 기록 표(이름 열 + 수치, 모은 조각도 표 줄) → 순위 카드 → 알림 줄 → 해금 줄,
  // 오른쪽 칸은 「최고 한 수」 → 다시 보기 판 → 그 점수(큰 수). 해금 줄은 왼쪽 칸 끝과 판 아래 중 상자가 덜 길어지는 쪽. 아래로 단추 줄
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    const x = 12, w = W - 24, P = PAD_BOX;
    const leftX = x + P, leftW = MX - 4 - SP.m - leftX, cx = MX + Q * 4;
    const best = this.replay ? Math.max(this.best, this.replay.score) : this.best;
    // 기록 표: 이름 열은 가장 긴 이름 + 16, 수치는 그 열 끝에서 가장 넓은 수치만큼(표째 왼쪽 칸 가운데)
    const got = LEGENDS.filter((l) => run.fragments[l.id] && (run.fragments[l.id].first || run.fragments[l.id].feat || run.fragments[l.id].gold)).slice(0, 3);
    const labels = [];
    if (this.last) labels.push('도달');
    if (!this.won && this.last) { labels.push('마지막 대국'); if (this.short > 0) labels.push('모자란 점수'); }
    labels.push('상금');
    if (got.length) labels.push('모은 조각');
    const labW = Math.max(...labels.map((l) => measure(l))) + SP.xl;
    const room = leftW - labW;
    const nums = (f) => { const s = f(num); return measure(s, true) <= room ? s : f(short); };
    const rows = [];
    if (this.last) rows.push({ label: '도달', value: `${run.ante}관 ${KIND_NAME[this.last.kind]}` });
    if (!this.won && this.last) {
      rows.push({ label: '마지막 대국', value: nums((n) => `${n(this.last.score)} / ${n(this.last.target)}`) });
      if (this.short > 0) rows.push({ label: '모자란 점수', value: nums((n) => `${n(this.short)} (${this.pct}%)`), col: PAL.red });
    }
    rows.push({ label: '상금', value: `$${run.money}` });
    got.forEach((l, i) => rows.push({ label: i ? '' : '모은 조각', legend: l, vw: measure(l.name) + SP.s + SHARD.w * 3 + SP.xs * 2 }));
    for (const r of rows) if (r.vw == null) r.vw = measure(r.value, true);
    const tableW = labW + Math.max(...rows.map((r) => r.vw));
    const tableX = leftX + Math.max(0, Math.floor((leftW - tableW) / 2));
    // 판 밖에 남은 것: 자리가 모자라면 앞의 것부터 빠진다 — 다음 오프닝까지 · 새 도감 칸 · 오늘의 대국 · 끝없는 대국 · 열린 오프닝 · 레이팅
    const notes = [];
    if (!this.out.unlocked.length && this.next) notes.push([`다음 오프닝 ${OPENINGS[this.next.id].name}: ${this.next.text} ${this.next.have}/${this.next.need}`, PAL.dim]);
    if (this.out.fresh) notes.push([`도감 ${this.out.fresh}칸을 새로 채웠어요`, PAL.ink]);
    // 순위 카드(CHM-70): 오늘의 대국 판이면 기록 표 아래에. 카드가 「오늘의 대국 날짜」 줄을 대신한다
    const hasCard = !!rankCard(app, run, 0);
    if (run.daily && !hasCard) notes.push([`오늘의 대국 ${run.daily}`, PAL.goldDk]);
    if (this.out.deeper) notes.push([`끝없는 대국 최고 도달 ${this.out.endless}관`, PAL.gold]);
    for (const id of this.out.unlocked) notes.push([`오프닝 ${josa(OPENINGS[id].name, '이/가')} 열렸어요`, PAL.gold]);
    if (this.out.dan) notes.push([`레이팅 ${rating(this.out.dan)}이 열렸어요`, PAL.gold]);
    // 해금: 다 연 뒤에는 아무것도 없다(마지막 묶음을 연 판만 단추)
    const st = unlockState(app.records);
    const un = st.next == null && this.opened == null ? null
      : { st, bar: st.next != null, line: st.next != null ? nextLine(st) : null, btn: this.opened != null ? `${bundleSize(this.opened)}개 열렸어요` : null };
    if (un) {
      un.btnW = un.btn ? btnW(un.btn) : 0;
      un.rowH = un.btn ? BTN_H : LINE;
      // 왼쪽 칸 꼴: 이름표 · 막대 · 글 · 단추 한 줄, 안 들어가면(영어) 이름표 · 막대 · 단추 → 막대 자리부터 글
      const lw = measure(UNLOCK_LABEL) + SP.m;
      un.oneRow = lw + UNLOCK_BAR + (un.line ? SP.m + measure(un.line) : 0) + (un.btn ? SP.m + un.btnW : 0) <= leftW;
      un.lines2 = !un.oneRow && un.line ? wrap(un.line, leftW - lw) : [];
      un.flowH = un.rowH + (un.lines2.length ? GAP_IN + un.lines2.length * LINE : 0);
      // 판 아래 꼴: 「해금」 · 막대 한 줄 → 글 → 단추
      un.sideLines = un.line ? wrap(un.line, Q * 8 + 8) : [];
      un.sideH = LINE + (un.sideLines.length ? GAP_IN + un.sideLines.length * LINE : 0) + (un.btn ? GAP_IN + BTN_H : 0);
    }
    // 오른쪽 칸(상자 윗변 0부터): 「최고 한 수」 → 4 → 판 틀 → 4 → 큰 수. 다시 보기가 없으면(옛 저장 · 다시 놓기가 든 수) 판 없이 큰 수만
    const capY = P, frameY = capY + LINE + GAP_IN;
    const heroY = this.replay ? frameY + Q * 8 + 8 + GAP_IN : frameY;
    const rightEnd = heroY + HERO_LH;
    const btnCost = SP.l + BTN_H + P;
    const lay = (n) => {
      const f = flow(P), o = { f };
      o.titleY = f.space(HERO_LH);
      f.gap(SP.m);
      o.rowYs = rows.map(() => f.space(LINE));
      o.card = hasCard ? rankCard(app, run, n) : null;
      if (o.card) { f.gap(SP.m); o.cardY = f.space(o.card.h); }
      // 해금 줄: 왼쪽 칸 끝 한 줄과 판 아래 중 상자가 덜 길어지는 쪽
      const sideCost = un ? Math.max(0, rightEnd + SP.m + un.sideH - Math.max(f.y, rightEnd)) : 0;
      o.unSide = !!un && sideCost < un.flowH + SP.m;
      const unFlow = un && !o.unSide ? SP.m + un.flowH : 0;
      const colEnd = (left) => Math.max(left, rightEnd + (o.unSide ? SP.m + un.sideH : 0));
      // 알림 줄: 왼쪽 칸 폭에서 줄을 바꾼 높이로 270 안에 드는 만큼(뒤의 것부터 셋까지)
      o.notes = [];
      let used = 0;
      for (const nt of notes.slice().reverse()) {
        if (o.notes.length >= 3) break;
        const lines = wrap(nt[0], leftW);
        const add = SP.m + lines.length * LINE + (o.notes.length ? GAP_IN - SP.m : 0);
        if (colEnd(f.y + used + add + unFlow) + btnCost > 270) break;
        used += add;
        o.notes.unshift({ lines, col: nt[1] });
      }
      o.fits = colEnd(f.y + used + unFlow) + btnCost <= 270;
      return o;
    };
    let L0 = null;
    for (const n of hasCard ? CARD_NEIGHBOURS : [0]) { L0 = lay(n); if (L0.fits && L0.notes.length >= Math.min(1, notes.length)) break; }
    const { f, titleY, rowYs, card } = L0;
    const noteYs = L0.notes.map((q, i) => { f.gap(i ? GAP_IN : SP.m); return q.lines.map(() => f.space(LINE)); });
    // 한 줄 꼴 해금 줄은 왼쪽 칸이 짧으면 큰 수 줄 밑변에 맞춘다(왼쪽 아래가 비지 않게)
    let unY = null;
    if (un && L0.unSide) unY = rightEnd + SP.m;
    else if (un) { unY = f.gap(SP.m).space(un.flowH); if (f.y < rightEnd) { unY = rightEnd - un.flowH; f.y = rightEnd; } }
    f.y = Math.max(f.y, rightEnd, un && L0.unSide ? unY + un.sideH : 0);
    const btnY = f.gap(SP.l).space(BTN_H);
    const h = f.y + P, y = Math.max(0, Math.floor((270 - h) / 2));
    MY = y + frameY + 4;
    openBox('panel', x, y, w, h, P, { name: '결과' });
    box(ctx, x, y, w, h, PAL.feltDk, this.won ? PAL.gold : PAL.red, { r: R_LG });
    // 큰 제목: 두 배, 왼쪽 칸 가운데(영어도 두 배 — 말을 줄여 맞췄다)
    const title = run.endless && !this.won ? `끝없는 대국 ${run.ante}관` : this.won ? '8관 돌파!' : '판이 끝났어요';
    const tY = y + titleY, tcx = leftX + Math.floor(leftW / 2), big2 = (HERO_LH - INK_H * 2) >> 1;
    text(ctx, title, tcx, tY + big2, this.won || run.endless ? PAL.gold : PAL.red, { align: 'center', bold: true, scale: 2 });
    {
      const tw = measure(title, true) * 2;
      this.titleBand = { clip: { x: x + 2, y: y + 2, w: leftW + P - 2, h: HERO_LH + P - 2 }, avoid: { x: tcx - tw / 2 - 1, y: tY + big2 - 1, w: tw + 2, h: INK_H * 2 + 2 } };
      if (this.burst) {
        this.burst = false;
        const area = () => (app.screen === this ? this.titleBand : null);
        confetti(app.fx, tcx - tw / 2 - 8, tY + 14, { n: CAP.confetti, seed: 11, spread: 150, life: 2, area });
        confetti(app.fx, tcx + tw / 2 + 8, tY + 14, { n: CAP.confetti, seed: 23, spread: 150, life: 2, area });
      }
    }
    // 기록 표
    const right = tableX + tableW;
    rows.forEach((r, i) => {
      const ty = textY(y + rowYs[i]);
      if (r.label) text(ctx, r.label, tableX, ty, PAL.dim);
      if (!r.legend) { text(ctx, r.value, right, ty, r.col || PAL.ink, { align: 'right', bold: true }); return; }
      const f2 = run.fragments[r.legend.id];
      const n = (f2.first ? 1 : 0) + (f2.feat ? 1 : 0) + (f2.gold ? 1 : 0);
      const sx = right - SHARD.w * 3 - SP.xs * 2;
      text(ctx, r.legend.name, sx - SP.s, ty, run.legends.includes(r.legend.id) ? PAL.gold : PAL.ink, { align: 'right' });
      for (let k = 0; k < 3; k++) {
        const kx = sx + k * (SHARD.w + SP.xs);
        if (k < n) shardIcon(ctx, kx, ty - 1, PAL.gold, PAL.goldDk);
        else slot(ctx, kx + SP.s, ty + 2, SHARD.w - SP.m, INK_H - 4);
      }
    });
    // 최고 한 수: 이름표 → 다시 보기 판 → 큰 수
    text(ctx, '최고 한 수', cx, textY(y + capY), PAL.dim, { align: 'center' });
    if (this.replay) this.drawReplay(ctx);
    text(ctx, fitNum(best, Math.floor((Q * 8 + 8) / 2)), cx, y + heroY + big2, PAL.gold, { align: 'center', bold: true, scale: 2 });
    // 순위 카드: 상자보다 한 단 밝은 판넬(세력 빛 그대로)
    if (card) drawRankCard(ctx, ui, app, card, leftX, y + L0.cardY, leftW, { fill: lightHue(PAL.feltDk, 0.08) });
    L0.notes.forEach((q, i) => q.lines.forEach((s2, j) => text(ctx, s2, tcx, textY(y + noteYs[i][j]), q.col, { align: 'center' })));
    if (un) this.drawUnlock(ctx, ui, un, y + unY, L0.unSide, leftX, leftW);
    // 단추 줄: (계속 두기) · 새 판 · (하이라이트) · 메인 화면 — 같은 폭, 사이 8, 화면 가운데. 하이라이트 덮개가 떠 있으면 덮개 단추 뒤로 비치지 않게 그리지 않는다
    if (!(app.overlay && app.overlay.name === 'highlight')) {
      const btns = [];
      if (this.won) btns.push({ id: 'result:endless', label: '계속 두기', onClick: () => this.endless() });
      btns.push({ id: 'result:again', label: '새 판', onClick: () => this.again(), tone: 'gold' });
      if (hasHighlight(run)) btns.push({ id: 'result:highlight', label: '하이라이트', onClick: () => app.openOverlay('highlight') });
      btns.push({ id: 'result:title', label: '메인 화면', onClick: () => app.toTitle() });
      buttonRow(ctx, ui, btns, W / 2, y + btnY, { anchor: 'center' });
    }
    closeBox();
  }
  // 해금 줄: 「해금」 이름표 + 막대, 그 뒤 남은 관 글 또는 금빛 「N개 열렸어요」 단추.
  // side: 판 아래(이름표 · 막대 한 줄 → 글 → 단추, 판 폭), 아니면 왼쪽 칸 끝 한 줄(이름표 · 막대 · 글 · 단추는 오른끝)
  drawUnlock(ctx, ui, un, y, side, leftX, leftW) {
    const go = () => this.app.go('unlocks', { open: this.opened, from: 'result' });
    const gold = (bx, by) => button(ctx, ui, 'result:unlocks', bx, by, un.btnW, BTN_H, un.btn, { tone: 'gold', onClick: go });
    const lw = measure(UNLOCK_LABEL);
    if (side) {
      const x0 = MX - 4, w = Q * 8 + 8, cx = x0 + w / 2;
      const ty = textY(y);
      text(ctx, UNLOCK_LABEL, x0, ty, PAL.dim);
      if (un.bar) progressBar(ctx, x0 + lw + SP.m, ty + ((INK_H - BAR_H) >> 1), w - lw - SP.m - 1, un.st.p);
      let yy = y + LINE;
      if (un.sideLines.length) { yy += GAP_IN; for (const s of un.sideLines) { text(ctx, s, cx, textY(yy), PAL.dim, { align: 'center' }); yy += LINE; } }
      if (un.btn) gold(Math.round(cx - un.btnW / 2), yy + GAP_IN);
      return;
    }
    const linew = un.oneRow && un.line ? measure(un.line) : 0;
    const ty = textY(y + ((un.rowH - LINE) >> 1)), lineCol = this.opened != null ? PAL.ink : PAL.dim;
    const bx = leftX + lw + SP.m;
    text(ctx, UNLOCK_LABEL, leftX, ty, PAL.dim);
    const barW = Math.max(UNLOCK_BAR, leftW - (bx - leftX) - (linew ? linew + SP.m : 0) - (un.btnW ? un.btnW + SP.m : 0));
    if (un.bar) progressBar(ctx, bx, ty + ((INK_H - BAR_H) >> 1), barW, un.st.p);
    if (linew) text(ctx, un.line, bx + (un.bar ? barW + SP.m : 0), ty, lineCol);
    if (un.btn) gold(leftX + leftW - un.btnW, y);
    un.lines2.forEach((s, i) => text(ctx, s, bx, textY(y + un.rowH + GAP_IN + i * LINE), lineCol));
  }
  again() { const r = this.app.run; this.app.newRun({ opening: r.opening, dan: r.dan, daily: !!r.daily }); }
  endless() { this.app.cmd({ type: 'endless' }); this.app.goPhase(); }
  key(k) { if (k === 'Enter') this.again(); else if (k === 'Escape') this.app.toTitle(); }
}
