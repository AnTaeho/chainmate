// 튜토리얼 목록: 장 셋(기초 · 대국 · 판), 끝낸 수업에 표, 아래 큰 단추 「이어서」(안 끝낸 첫 수업부터 차례로). 누르면 그 수업 하나.
// 흐름(처음 켬 덮개 「튜토리얼부터」 · 「이어서」 → 수업을 차례로 → 끝 카드 「새 판」)과 수업 「상점과 시너지」(연습용 판 위에서 따라 하는 길)도 여기서.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, slot } from '../../render/gfx.js';
import { button } from '../ui.js';
import { createRun } from '../../sim/run.js';
import { createRng, fork } from '../../sim/rng.js';
import { LESSONS, LESSON_GROUPS } from '../lessons.js';
import { startGuide, kingNoteLayout, kingNote } from '../coach.js';
import { TERMS, TERM_GROUPS, termWord, termSay } from '../glossary.js';
import { pageHead, pageButtons } from './common.js';
import { wrapName, drawName } from '../parts.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, flow, textY, BTN_S } from '../frame.js';
import { openBox, closeBox, layerUp } from '../../render/layoutlog.js';

const TERM_DEF_X = 120; // 낱말 풀이: 풀이 글이 시작하는 x
const TERM_BOX = { x: 12, h: PAGE.btnY - 8 - PAGE.bodyY }; // 낱말 풀이: 본 칸 상자(왼쪽 x · 쪽의 가장 큰 높이 — 쪽마다 내용에 맞춘다)
const LESSON_BTN = 32; // 수업 목록 단추 높이
export const GO = { w: 176, h: 24 }; // 목록 아래 큰 단추(「이어서」 · 「새 판」)
export const END_SAY = '튜토리얼 끝! 이제 진짜 판을 시작해 볼까?';
import { wrap } from '../../render/text.js';

const seenOf = (app) => app.records.lessonsSeen || {};
// 안 끝낸 첫 수업(after 뒤에서 먼저, 없으면 처음부터). 다 끝냈으면 -1
export function nextLesson(app, after = -1) {
  const seen = seenOf(app);
  const k = LESSONS.findIndex((L, i) => i > after && !seen[L.id]);
  return k >= 0 ? k : LESSONS.findIndex((L) => !seen[L.id]);
}
const allDone = (app) => nextLesson(app) < 0;

// 수업 i를 연다(판 수업 ②는 상점 길). from: 'list'(목록에서 하나) · 'flow'(목록 「이어서」) · 'welcome'(처음 켬 덮개)
export function openLesson(app, i, from = app.lessonFrom) {
  app.lessonFrom = from;
  app.guide = null;
  app.track('lesson_start', { id: LESSONS[i].id }, { always: true });
  if (LESSONS[i].shop) return startLessonShop(app, i);
  app.go('lesson', { index: i, phase: 'demo' });
}
// 튜토리얼 흐름: 안 끝낸 첫 수업부터(다 끝냈으면 끝 카드)
export function startTutorial(app, from = 'flow') {
  const i = nextLesson(app);
  if (i < 0) return app.go('lessons', { end: true });
  openLesson(app, i, from);
}

// 수업이 끝나면: 끝낸 것으로 적고, 막 다 끝냈으면 끝 카드, 목록에서 왔으면 목록으로, 흐름이면 다음 수업
export function lessonDone(app, i) {
  const was = allDone(app);
  finishLessons.mark(app, LESSONS[i].id);
  app.track('lesson_done', { id: LESSONS[i].id }, { always: true });
  if (app.run && app.run.scratch) app.run = null;
  if (!was && allDone(app)) { app.records.lessonsDone = true; app.saveRecords(); return app.go('lessons', { end: true }); }
  if (app.lessonFrom === 'list') return app.go('lessons');
  const next = nextLesson(app, i);
  if (next >= 0) return openLesson(app, next);
  app.go('lessons', { end: true });
}

// 수업 위 「건너뛰기」 · 「목록」: 처음 켬 덮개에서 왔으면 곧바로 판으로(저장된 판이 있으면 타이틀), 아니면 목록으로
export function finishLessons(app) {
  app.fx.clear();
  app.guide = null;
  if (app.run && app.run.scratch) app.run = null;
  const from = app.lessonFrom;
  app.lessonFrom = null;
  if (from !== 'welcome') return app.go('lessons');
  if (app.hasSave()) return app.toTitle();
  app.newRun();
}
finishLessons.mark = (app, id) => {
  if (!app.records.lessonsSeen) app.records.lessonsSeen = {};
  app.records.lessonsSeen[id] = true;
  app.saveRecords();
};
// 끝 카드 · 다 끝낸 목록의 큰 단추: 저장된 판이 있으면 이어 하기, 없으면 새 판
const playLabel = (app) => (app.hasSave() ? '이어 하기' : '새 판');
function play(app) { app.lessonFrom = null; if (!app.continueRun()) app.newRun(); }

// 수업 ⑩ 상점과 시너지: 연습용 판(남기지 않는다)의 상점에서 격언 사기 → 팩 열기 → 나이트 고르기 → 격언 하나 더 → 시너지 띠.
// 처음부터 열려 있는 격언 · 체스 기물만 쓴다(해금 단계 0)
export function startLessonShop(app, i) {
  const run = createRun({ seed: 3, draft: false, unlockTier: 0 });
  run.scratch = true;
  run.money = 14;
  run.phase = 'shop';
  run.shop = {
    rng: fork(createRng(3), 'lesson-shop'),
    display: [{ kind: 'maxim', id: 'chivalry', price: 5, sold: false }, { kind: 'maxim', id: 'first_move', price: 4, sold: false }],
    packs: [{ kind: 'piece', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }],
    rerolls: 0, promoted: false, removed: false,
  };
  app.run = run;
  app.fx.clear();
  app.go('shop');
  const on = (name) => app.screen && app.screen.name === name;
  const knights = run.deck.filter((p) => p.t === 'N').length;
  startGuide(app, [
    { screen: 'shop', target: 'shop:buy:0', say: '진열의 격언 「기사도」를 사 봐. 격언은 판이 끝날 때까지 효과가 있어', done: () => run.maxims.length > 0 },
    { screen: 'shop', target: 'maxim:0', say: '산 격언은 오른쪽 칸에 들어가. 효과는 카드에 적혀 있어', ok: true },
    { screen: 'shop', target: 'shop:pack:0', say: '기물 팩을 열어 봐. 셋 중 하나를 고르면 돼',
      done: () => {
        if (run.phase !== 'pack' || !on('pack')) return false;
        run.pack.options = [{ kind: 'piece', t: 'N' }, { kind: 'piece', t: 'R' }, { kind: 'piece', t: 'B' }];
        return true;
      } },
    { screen: 'pack', target: 'pack:pick:0', say: '나이트를 골라 봐. 기사도는 나이트로 시작할 때 효과를 내', done: () => run.phase === 'shop' && on('shop') && run.deck.filter((p) => p.t === 'N').length > knights },
    { screen: 'shop', target: 'shop:buy:1', say: '격언 「첫수」도 사 봐. 기사도와 같은 기사 시너지야', done: () => run.maxims.length > 1 },
    { screen: 'shop', target: 'fam:leap', say: '격언 둘로 기사 시너지가 2개야. 첫 효과가 켜졌고, 4개 · 6개면 더 켜져', ok: true },
  ], () => lessonDone(app, i));
}

export class LessonsScreen {
  constructor(app, { end = false } = {}) { this.app = app; this.end = end; }
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(끝 카드의 킹은 kingNote가 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const app = this.app, seen = seenOf(app);
    if (this.terms) return this.drawTerms(ctx, ui);
    const done = LESSONS.filter((L) => seen[L.id]).length, next = nextLesson(app);
    pageHead(ctx, '튜토리얼', `${done}/${LESSONS.length}`);
    const colW = 140, x0 = Math.floor((W - colW * 3 - 16) / 2);
    // 장 칸 쌓기: 장 이름(제목 줄) → 묶음 틈 → 수업 단추들(사이 GAP_GROUP) — 세 칸은 가장 긴 칸의 높이
    const groups = LESSON_GROUPS.map((g) => LESSONS.map((L, i) => ({ L, i })).filter((o) => o.L.group === g.id));
    const colH = Math.max(...groups.map((list) => PAD_BOX * 2 + 18 + GAP_GROUP + list.length * LESSON_BTN + (list.length - 1) * GAP_GROUP));
    const top = PAGE.bodyY + 4;
    LESSON_GROUPS.forEach((g, gi) => {
      const x = x0 + gi * (colW + 8), list = groups[gi];
      const f = flow(top + PAD_BOX);
      openBox('panel', x, top, colW, colH, PAD_BOX, { name: `수업 장 ${g.id}` });
      box(ctx, x, top, colW, colH, PAL.feltDk);
      const n = list.filter(({ L }) => seen[L.id]).length;
      const ty = f.line(true);
      text(ctx, g.name, x + PAD_BOX, ty, PAL.gold, { bold: true });
      text(ctx, `${n}/${list.length}`, x + colW - PAD_BOX, ty, n === list.length ? PAL.gold : PAL.dim, { align: 'right' });
      f.gap(GAP_GROUP);
      list.forEach(({ L, i }, k) => {
        if (k) f.gap(GAP_GROUP);
        const y = f.space(LESSON_BTN), id = `lessons:${i}`;
        const ok = !!seen[L.id];
        button(ctx, ui, id, x + PAD_BOX, y, colW - PAD_BOX * 2, LESSON_BTN, '', { onClick: () => openLesson(app, i, 'list') });
        // 번호 칸(움푹): 끝낸 수업은 금빛 표, 다음 수업은 금빛 번호
        const sx = x + PAD_BOX + 4, sy = y + 8;
        slot(ctx, sx, sy, 16, 16);
        if (ok) { rect(ctx, sx + 3, sy + 8, 2, 2, PAL.gold); rect(ctx, sx + 5, sy + 10, 2, 2, PAL.gold); for (let q = 0; q < 4; q++) rect(ctx, sx + 7 + q * 2, sy + 8 - q * 2, 2, 2, PAL.gold); }
        else text(ctx, `${i + 1}`, sx + 8, textY(sy, 16), i === next ? PAL.gold : PAL.dim, { bold: true, align: 'center' });
        // 수업 이름은 두 줄까지(낱말 단위) — 단추 32에 두 줄(14 × 2)이 테와 2씩 띄워 들어간다
        const nx = sx + 22, nw = x + colW - PAD_BOX - 4 - nx, nm = wrapName(L.title, nw, { bold: false });
        const ys = nm && nm.lines.length > 1 ? nm.lines.map((_, q) => y + textY(((LESSON_BTN - nm.lines.length * LINE) >> 1) + q * LINE)) : [y + textY(0, LESSON_BTN) + 1];
        drawName(ctx, L.title, nm, nx, ys, nw, ok ? PAL.dim : PAL.ink, { bold: false });
      });
      closeBox();
    });
    // 큰 단추: 안 끝낸 첫 수업부터 차례로(하나도 안 했으면 「처음부터」), 다 끝냈으면 판으로
    const gy = top + colH + 12, gx = Math.floor(W / 2 - GO.w / 2);
    const label = next < 0 ? playLabel(app) : done ? '이어서' : '처음부터';
    button(ctx, ui, 'lessons:go', gx, gy, GO.w, GO.h, label, { tone: 'gold', onClick: () => (next < 0 ? play(app) : startTutorial(app, 'flow')) });
    button(ctx, ui, 'lessons:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => app.toTitle() });
    button(ctx, ui, 'lessons:terms', W - PAGE.titleX - 100, PAGE.btnY, 100, PAGE.btnH, '용어 사전', { onClick: () => { this.terms = true; } });
    if (this.end) this.drawEnd(ctx, ui);
  }
  // 끝 카드: 목록 위를 어둡게 덮고 킹이 말한다 — 「새 판」(저장된 판이 있으면 「이어 하기」) · 「목록」
  drawEnd(ctx, ui) {
    const app = this.app;
    ui.regions = []; // 목록 단추는 막는다(덮개처럼)
    layerUp();
    ui.region('lessons:endcover', 0, 0, W, H, { onClick: () => {} });
    ctx.globalAlpha = 0.6; rect(ctx, 0, 0, W, H, PAL.shadow); ctx.globalAlpha = 1;
    const w = 200, lay = kingNoteLayout(END_SAY, w), btnY = lay.h + GAP_GROUP - PAD_BOX, h = btnY + BTN_S + PAD_BOX;
    const x = Math.floor(W / 2 - w / 2), y = Math.floor(H / 2 - h / 2);
    const bw = Math.floor((w - PAD_BOX * 2 - 6) / 2);
    kingNote(ctx, app, x, y, w, END_SAY, { ...lay, h }, { joy: true, name: '튜토리얼 끝', inner: () => {
      button(ctx, ui, 'lessons:list', x + PAD_BOX, y + btnY, bw, BTN_S, '목록', { onClick: () => { this.end = false; } });
      button(ctx, ui, 'lessons:play', x + w - PAD_BOX - bw, y + btnY, bw, BTN_S, playLabel(app), { tone: 'gold', onClick: () => play(app) });
    } });
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
    if (this.end) { if (k === 'Escape') this.end = false; else if (k === 'Enter' || k === ' ') play(this.app); return; }
    if (this.terms && (k === 'ArrowLeft' || k === 'ArrowRight')) { const n = this.termPages(this.termTab || 'battle').length; this.termPage = Math.max(0, Math.min(n - 1, (this.termPage || 0) + (k === 'ArrowLeft' ? -1 : 1))); return; }
    if (k === 'Escape') { if (this.terms) this.terms = false; else this.app.toTitle(); }
  }
}
