// 첫 수업 목록: 기초 · 대국 · 판 세 묶음, 끝낸 수업에 표. 누르면 그 수업부터.
// 수업 흐름(처음 켬 → 수업 → 첫 판)과 수업 ⑩ 「상점과 가족」(연습용 판 위에서 따라 하는 길)도 여기서.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect } from '../../render/gfx.js';
import { button } from '../ui.js';
import { createRun } from '../../sim/run.js';
import { createRng, fork } from '../../sim/rng.js';
import { LESSONS, LESSON_GROUPS } from '../lessons.js';
import { startGuide } from '../coach.js';
import { TERMS, TERM_GROUPS, termWord, termSay } from '../glossary.js';
import { pageHead, pageButtons } from './common.js';
import { wrapName, drawName } from '../parts.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, LIST_GAP, flow, textY, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const TERM_DEF_X = 120; // 낱말 풀이: 풀이 글이 시작하는 x
const TERM_BOX = { x: 12, h: PAGE.btnY - 8 - PAGE.bodyY }; // 낱말 풀이: 본 칸 상자(왼쪽 x · 쪽의 가장 큰 높이 — 쪽마다 내용에 맞춘다)
const LESSON_BTN = 32; // 수업 목록 단추 높이
import { wrap } from '../../render/text.js';
import { L } from '../lang.js';

const seenOf = (app) => app.records.lessonsSeen || {};

// 수업 i를 연다(판 수업 ②는 상점 길)
export function openLesson(app, i, from = app.lessonFrom) {
  app.lessonFrom = from;
  app.guide = null;
  if (LESSONS[i].shop) return startLessonShop(app, i);
  app.go('lesson', { index: i, phase: 'demo' });
}

// 수업이 끝나면: 본 것으로 적고, 목록에서 왔으면 목록으로, 아니면 다음 수업(끝이면 첫 판)
export function lessonDone(app, i) {
  finishLessons.mark(app, LESSONS[i].id);
  app.track('lesson_done', { id: LESSONS[i].id }, { always: true });
  if (app.run && app.run.scratch) app.run = null;
  if (app.lessonFrom === 'list') return app.go('lessons');
  if (LESSONS[i + 1]) return openLesson(app, i + 1);
  finishLessons(app);
}

// 수업을 다 했거나 건너뛰었다: 이어 둘 판이 있으면 타이틀로, 없으면 곧바로 1관(처음 안내가 켜진 채)
export function finishLessons(app) {
  app.records.lessonsDone = true;
  app.saveRecords();
  app.fx.clear();
  app.guide = null;
  if (app.run && app.run.scratch) app.run = null;
  const from = app.lessonFrom;
  app.lessonFrom = null;
  if (from === 'list') return app.go('lessons');
  if (app.hasSave() || from === 'settings') return app.toTitle();
  app.newRun();
  if (app.run && app.run.phase === 'draft') app.autoPlay = true;
  if (app.run && app.run.phase === 'select') { const ev = app.cmd({ type: 'play' }); app.go('battle', { events: ev }); }
}
finishLessons.mark = (app, id) => {
  if (!app.records.lessonsSeen) app.records.lessonsSeen = {};
  app.records.lessonsSeen[id] = true;
  app.saveRecords();
};

// 수업 ⑩ 상점과 가족: 연습용 판(남기지 않는다)의 상점에서 격언 사기 → 꾸러미 열기 → 낙타 고르기 → 가족 띠
export function startLessonShop(app, i) {
  const run = createRun({ seed: 3, draft: false });
  run.scratch = true;
  run.money = 10;
  run.phase = 'shop';
  run.shop = {
    rng: fork(createRng(3), 'lesson-shop'),
    display: [{ kind: 'maxim', id: 'chivalry', price: 5, sold: false }, { kind: 'piece', t: 'R', price: 4, sold: false }],
    packs: [{ kind: 'piece', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }],
    rerolls: 0, promoted: false, removed: false,
  };
  app.run = run;
  app.fx.clear();
  app.go('shop');
  const on = (name) => app.screen && app.screen.name === name;
  startGuide(app, [
    { screen: 'shop', target: 'shop:buy:0', say: '진열의 격언 「기사도」를 사 봐. 격언은 판이 끝날 때까지 효과가 있어', done: () => run.maxims.length > 0 },
    { screen: 'shop', target: 'maxim:0', say: '산 격언은 오른쪽 칸에 들어가. 효과는 카드에 적혀 있어', ok: true },
    { screen: 'shop', target: 'shop:pack:0', say: '기물 팩을 열어 봐. 셋 중 하나를 고르면 돼',
      done: () => {
        if (run.phase !== 'pack' || !on('pack')) return false;
        run.pack.options = [{ kind: 'piece', t: 'L' }, { kind: 'piece', t: 'O' }, { kind: 'piece', t: 'B' }];
        return true;
      } },
    { screen: 'pack', target: 'pack:pick:0', say: '낙타를 골라 봐. 나이트처럼 뛰는 특수 기물이야', done: () => run.phase === 'shop' && on('shop') && run.deck.some((p) => p.t === 'L') },
    { screen: 'shop', target: 'fam:leap', say: '기사도와 낙타로 기사 시너지가 2개야. 첫 효과가 켜졌고, 4개 · 6개면 더 켜져', ok: true },
  ], () => lessonDone(app, i));
}

export class LessonsScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const app = this.app, seen = seenOf(app);
    if (this.terms) return this.drawTerms(ctx, ui);
    pageHead(ctx, '튜토리얼');
    const colW = 140, x0 = Math.floor((W - colW * 3 - 16) / 2);
    // 묶음 칸 쌓기: 묶음 이름(제목 줄) → 묶음 틈 → 수업 단추들(사이 GAP_GROUP) — 세 칸은 가장 긴 칸의 높이
    const groups = LESSON_GROUPS.map((g) => LESSONS.map((L, i) => ({ L, i })).filter((o) => o.L.group === g.id));
    const colH = Math.max(...groups.map((list) => PAD_BOX * 2 + 18 + GAP_GROUP + list.length * LESSON_BTN + (list.length - 1) * GAP_GROUP));
    LESSON_GROUPS.forEach((g, gi) => {
      const x = x0 + gi * (colW + 8), list = groups[gi];
      const top = PAGE.bodyY, f = flow(top + PAD_BOX);
      openBox('panel', x, top, colW, colH, PAD_BOX, { name: `수업 묶음 ${g.id}` });
      box(ctx, x, top, colW, colH, PAL.feltDk, PAL.frameDk);
      text(ctx, g.name, x + colW / 2, f.line(true), PAL.dim, { align: 'center', bold: true });
      f.gap(GAP_GROUP);
      list.forEach(({ L, i }, k) => {
        if (k) f.gap(GAP_GROUP);
        const y = f.space(LESSON_BTN), id = `lessons:${i}`;
        const done = !!seen[L.id];
        button(ctx, ui, id, x + PAD_BOX, y, colW - PAD_BOX * 2, LESSON_BTN, '', { onClick: () => openLesson(app, i, 'list') });
        // 끝낸 수업은 번호 자리에 표
        const ty = y + textY(0, LESSON_BTN) + 1;
        if (done) { rect(ctx, x + 14, y + 16, 2, 2, PAL.gold); rect(ctx, x + 16, y + 18, 2, 2, PAL.gold); for (let q = 0; q < 4; q++) rect(ctx, x + 18 + q * 2, y + 16 - q * 2, 2, 2, PAL.gold); }
        else text(ctx, `${i + 1}`, x + 26, ty, PAL.dim, { bold: true, align: 'right' });
        // 수업 이름은 두 줄까지(낱말 단위) — 단추 32에 두 줄(14 × 2)이 테와 2씩 띄워 들어간다
        const nw = colW - PAD_BOX - 4 - 32, nm = wrapName(L.title, nw, { bold: false });
        const ys = nm && nm.lines.length > 1 ? nm.lines.map((_, k) => y + textY(((LESSON_BTN - nm.lines.length * LINE) >> 1) + k * LINE)) : [ty];
        drawName(ctx, L.title, nm, x + 32, ys, nw, done ? PAL.ink : PAL.dim, { bold: false });
      });
      closeBox();
    });
    button(ctx, ui, 'lessons:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => app.toTitle() });
    button(ctx, ui, 'lessons:terms', W - PAGE.titleX - 100, PAGE.btnY, 100, PAGE.btnH, '용어 사전', { onClick: () => { this.terms = true; } });
  }
  // 낱말 풀이: 카드 옆 낱말 상자와 같은 표(glossary.js TERMS)를 묶음 탭(대국 · 판 · 물건 · 모음)과 쪽으로
  drawTerms(ctx, ui) {
    // 판 밖 틀: 머리줄(제목 · 탭) + 본 칸 + 맨 아래 단추 줄(돌아가기 왼쪽 · 쪽 넘기기 오른쪽)
    pageHead(ctx, '용어 사전');
    const tab = this.termTab || 'battle';
    const tw = 62;
    TERM_GROUPS.forEach(([id, name], k) => {
      button(ctx, ui, `terms:tab:${id}`, 90 + k * (tw + 4), 5, tw, BTN_S, name, { tone: id === tab ? 'gold' : 'plain', onClick: () => { this.termTab = id; this.termPage = 0; } });
    });
    const pages = this.termPages(tab);
    const page = Math.min(this.termPage || 0, pages.length - 1);
    const pg = pages[page];
    const bh = pg.h;
    openBox('panel', TERM_BOX.x, PAGE.bodyY, W - TERM_BOX.x * 2, bh, PAD_BOX, { name: '용어 사전' });
    box(ctx, TERM_BOX.x, PAGE.bodyY, W - TERM_BOX.x * 2, bh, PAL.feltDk, PAL.frameDk);
    for (const row of pg.rows) {
      text(ctx, termWord(row.id), TERM_BOX.x + PAD_BOX, textY(row.y), PAL.gold, { bold: true });
      row.lines.forEach((l, k) => text(ctx, l, TERM_DEF_X, textY(row.y + k * LINE), PAL.ink));
    }
    closeBox();
    if (pages.length > 1) pageButtons(ctx, ui, 'terms', page, pages.length, (p) => { this.termPage = p; });
    button(ctx, ui, 'lessons:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => { this.terms = false; } });
  }
  // 한 묶음의 낱말을 쪽으로 나눈다: 낱말마다 풀이 줄들(본문 줄), 낱말 사이 GAP_GROUP. 쪽 높이는 상자 안 여백 안(TERM_BOX.h)
  termPages(tab) {
    const pages = [{ rows: [] }];
    const y0 = PAGE.bodyY + PAD_BOX, yEnd = PAGE.bodyY + TERM_BOX.h - PAD_BOX;
    let y = y0;
    for (const t of TERMS.filter((q) => q.group === tab)) {
      const lines = wrap(termSay(t.id), W - TERM_BOX.x - PAD_BOX - TERM_DEF_X);
      const h = lines.length * LINE;
      const cur = pages[pages.length - 1];
      if (cur.rows.length && y + GAP_GROUP + h > yEnd) { pages.push({ rows: [] }); y = y0; }
      const pg = pages[pages.length - 1];
      if (pg.rows.length) y += GAP_GROUP;
      pg.rows.push({ id: t.id, y, lines });
      y += h;
      pg.h = y + PAD_BOX - PAGE.bodyY;
    }
    return pages;
  }
  key(k) {
    if (this.terms && (k === 'ArrowLeft' || k === 'ArrowRight')) { const n = this.termPages(this.termTab || 'battle').length; this.termPage = Math.max(0, Math.min(n - 1, (this.termPage || 0) + (k === 'ArrowLeft' ? -1 : 1))); return; }
    if (k === 'Escape') { if (this.terms) this.terms = false; else this.app.toTitle(); }
  }
}
