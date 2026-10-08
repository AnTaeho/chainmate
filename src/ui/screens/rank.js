// 순위(CHM-70, docs/design-notes/leaderboard.md 「화면」 · layout.md 「순위」): 오늘의 대국 순위표(판 밖 틀)와 결과 화면의 순위 카드.
// 자료는 src/ui/rank.js가 아는 것만 읽는다(app.rank.board · status) — 화면은 서버를 직접 부르지 않는다.
//   순위 화면: 머리줄(제목 · 「오늘 · 어제」 탭 · 날짜와 사람 수) → 머릿줄 → 열 줄 → 붙박은 내 줄(금빛) 또는 「오늘의 대국 두기」 → 단추 줄(쪽 넘김)
//   결과 카드: 「오늘 14등 / 312명」 · 「순위 보기」 → 내 위아래 이웃(자리가 되는 만큼 둘씩 · 하나씩 · 내 줄만)
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, measure, num, fitNum } from '../../render/gfx.js';
import { button } from '../ui.js';
import { pageHead, tabRow } from './common.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, GAP_IN, BTN_S, textY, inkY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { getLang } from '../lang.js';
import { shiftDate, PAGE as PER } from '../rank.js';

const en = () => getLang() === 'en';
const MINE_BG = '#3a3014', CARD_BG = '#0e1814';
// 닿은 곳: 이겼으면 「8관 이김」, 아니면 「7관 마스터전」. 영어는 줄 폭에 맞춘 짧은 꼴(Hall 7 Master — 결과 화면의 「Master Match」보다 짧다)
const KIND = { ko: ['연습 대국', '정식 대국', '마스터전'], en: ['Practice', 'Rated', 'Master'] };
export const reachText = (r) => (en()
  ? `Hall ${r.ante} ${r.won ? 'Won' : KIND.en[r.blind] || ''}`
  : `${r.ante}관 ${r.won ? '이김' : KIND.ko[r.blind] || ''}`);
// 좁은 카드의 닿은 곳: 관만(이겼으면 「이김」)
const reachShort = (r) => (r.won ? '이김' : `${r.ante}관`);
export const dayText = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}월 ${d}일`; };
export const peopleText = (n) => `${num(n)}명`;

// ── 순위 표의 칸(판 밖 틀 본 칸). 가장 긴 이름(한국어 130 · 영어 173) · 큰 점수(「3,482,150」 63) · 네 자리 인원(「14 / 1,204」)이 들어간다:
//   등수 20 ~ 57(「9,999」) · 이름 76 ~ 249 · 닿은 곳 268 ~ 362(「Hall 8 Practice」 94) · 점수 397 ~ 460.
//   내 줄의 「14 / 1,204」가 이름 칸을 넘으면 그 줄만 이름 · 닿은 곳을 오른쪽으로 민다(colsFor)
export const COL = { x0: 12, x1: W - 12, rank: 20, name: 76, reach: 268, score: W - 20, gap: 8 };
export const BOARD = { get headY() { return PAGE.bodyY; }, get rowsY() { return PAGE.bodyY + LINE + 4; }, get mineH() { return PAD_BOX * 2 + LINE; }, get mineY() { return PAGE.btnY - GAP_GROUP - (PAD_BOX * 2 + LINE); } };
// 한 줄의 글 자리: { rank, name, reach, score(오른끝), scoreRoom }. 재는 쪽(test/layout.test.js)과 그리는 쪽이 같이 쓴다
export function colsFor(rankLabel, name, reach, bold = false) {
  const nx = Math.max(COL.name, COL.rank + measure(rankLabel, true) + COL.gap);
  const rx = Math.max(COL.reach, nx + measure(name, bold) + COL.gap);
  return { rank: COL.rank, name: nx, reach: rx, score: COL.score, scoreRoom: COL.score - (rx + measure(reach) + COL.gap) };
}
function rowLine(ctx, r, name, top, { mine = false, total = null } = {}) {
  const ty = textY(top), c = mine ? PAL.gold : PAL.ink;
  const label = total != null ? `${num(r.rank)} / ${num(total)}` : num(r.rank), reach = reachText(r);
  const at = colsFor(label, name, reach, mine);
  text(ctx, label, at.rank, ty, mine ? PAL.gold : r.rank <= 3 ? PAL.goldHi : PAL.dim, { bold: mine || r.rank <= 3 });
  text(ctx, name, at.name, ty, c, { bold: mine });
  text(ctx, reach, at.reach, ty, r.won || mine ? PAL.gold : PAL.dim);
  text(ctx, fitNum(r.score, at.scoreRoom), at.score, ty, c, { align: 'right', bold: true });
}

// 쪽 넘기기(맨 아래 단추 줄 오른쪽): ‹ · 「14/121」 · ›. 쪽 글 칸은 가장 넓은 꼴(「121/121」)에 맞춘다 — 공통 pageButtons는 두 자리 쪽까지만 들어간다
function pager(ctx, ui, page, pages, go) {
  const lw = Math.max(40, measure(`${pages}/${pages}`) + 12), nx = W - PAGE.titleX - 36, px = nx - lw - 36;
  button(ctx, ui, 'rank:prev', px, PAGE.btnY, 36, PAGE.btnH, '‹', { enabled: page > 0, onClick: () => go(page - 1) });
  text(ctx, `${page + 1}/${pages}`, px + 36 + Math.floor(lw / 2), PAGE.btnY + 3, PAL.dim, { align: 'center' });
  button(ctx, ui, 'rank:next', nx, PAGE.btnY, 36, PAGE.btnH, '›', { enabled: page < pages - 1, onClick: () => go(page + 1) });
}

export class RankScreen {
  // back: 'result'면 돌아가기가 결과 화면으로(소리 없이 다시 연다)
  constructor(app, { back = null } = {}) {
    this.app = app; this.back = back;
    this.tab = 'today'; this.page = 0;
    this.seen = null; // 이 날짜에서 마지막으로 본 { date, total, pages, me } — 쪽을 넘기는 동안 머리줄 · 내 줄이 깜박이지 않게
    app.rank.forget();
    app.rank.retry();
    app.track('rank_open', { tab: this.tab });
  }
  date() { const t = this.app.today(); return this.tab === 'today' ? t : shiftDate(t, -1); }
  setTab(id) { if (id === this.tab) return; this.tab = id; this.page = 0; this.seen = null; this.app.rank.forget(); this.app.sfx('pick'); this.app.track('rank_open', { tab: id }); }
  go(p) { this.page = p; this.app.sfx('pick'); }
  leave() { const app = this.app; if (this.back === 'result' && app.run) app.go('result', { quiet: true }); else app.toTitle(); }
  draw(ctx, ui) {
    const app = this.app, date = this.date();
    const v = app.rank.board(date, this.page + 1), d = v.data;
    if (d) this.seen = { date, total: d.total, pages: d.pages, me: d.me };
    const seen = this.seen && this.seen.date === date ? this.seen : null;
    pageHead(ctx, '순위', seen ? `${dayText(date)} · ${peopleText(seen.total)}` : dayText(date));
    tabRow(ctx, ui, 'rank', [['today', '오늘'], ['yesterday', '어제']], this.tab, PAGE.titleX + measure('순위', true) + 10, 5, BTN_S, (id) => this.setTab(id));
    const pages = seen ? seen.pages : 1;
    if (this.page > pages - 1) this.page = pages - 1;
    // 머릿줄
    [['이름', COL.name, 'left'], ['닿은 곳', COL.reach, 'left'], ['점수', COL.score, 'right']].forEach(([s, x, align]) => text(ctx, s, x, textY(BOARD.headY), PAL.dimDk, { align }));
    rect(ctx, COL.x0, BOARD.headY + LINE + 1, COL.x1 - COL.x0, 1, PAL.feltHi);
    const say = (s) => text(ctx, s, W / 2, textY(BOARD.rowsY + 4 * LINE), PAL.dim, { align: 'center' });
    if (d && d.rows.length) {
      d.rows.forEach((r, i) => {
        const top = BOARD.rowsY + i * LINE, mine = !!d.me && d.me.rank === r.rank;
        openBox('tile', COL.x0, top, COL.x1 - COL.x0, LINE, 0, { name: `순위 줄 ${r.rank}` });
        if (i % 2) { ctx.globalAlpha = 0.5; rect(ctx, COL.x0, top, COL.x1 - COL.x0, LINE, PAL.feltDk); ctx.globalAlpha = 1; }
        if (mine) { rect(ctx, COL.x0, top, COL.x1 - COL.x0, LINE, MINE_BG); rect(ctx, COL.x0, top, 2, LINE, PAL.gold); }
        rowLine(ctx, r, app.rank.nameOf(r), top, { mine });
        closeBox();
      });
    } else if (d) say('아직 아무도 두지 않았다');
    else say(v.phase === 'unreached' ? '순위에 닿지 못했다' : '순위표를 펴는 중');
    // 붙박은 내 줄: 본 칸 아랫변. 오늘 아직 안 뒀으면 그 자리에 「오늘의 대국 두기」
    if (seen) {
      const my = BOARD.mineY, bw = COL.x1 - COL.x0, me = seen.me;
      openBox('panel', COL.x0, my, bw, BOARD.mineH, PAD_BOX, { name: '내 순위' });
      box(ctx, COL.x0, my, bw, BOARD.mineH, PAL.feltDk, me ? PAL.gold : PAL.frameHi);
      if (me) {
        ui.region('rank:mine', COL.x0, my, bw, BOARD.mineH, { onClick: () => this.go(Math.floor((me.rank - 1) / PER)) });
        rowLine(ctx, me, app.rank.nameOf(me), my + PAD_BOX, { mine: true, total: seen.total });
      } else if (this.tab === 'today') {
        text(ctx, '오늘은 아직 두지 않았다', COL.rank, textY(my + PAD_BOX), PAL.dim);
        const pw = measure('오늘의 대국 두기', true) + 20;
        button(ctx, ui, 'rank:play', COL.x1 - 6 - pw, my + 6, pw, BTN_S, '오늘의 대국 두기', { tone: 'gold', onClick: () => app.newRun({ daily: true }) });
      } else text(ctx, '어제는 두지 않았다', COL.rank, textY(my + PAD_BOX), PAL.dim);
      closeBox();
    }
    if (pages > 1) pager(ctx, ui, this.page, pages, (p) => this.go(p));
    button(ctx, ui, 'rank:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '돌아가기', { onClick: () => this.leave() });
  }
  key(k) {
    const pages = this.seen ? this.seen.pages : 1;
    if (k === 'Escape' || k === 'Enter') this.leave();
    else if (k === 'ArrowRight' && this.page < pages - 1) this.go(this.page + 1);
    else if (k === 'ArrowLeft' && this.page > 0) this.go(this.page - 1);
  }
}
