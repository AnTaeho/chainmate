// 튜토리얼 목록: 장 셋(기초 · 대국 · 판), 끝낸 수업에 표, 아래 큰 단추 「이어서」(안 끝낸 첫 수업부터 차례로). 누르면 그 수업 하나.
// 흐름(처음 켬 덮개 「튜토리얼부터」 · 「이어서」 → 수업을 차례로 → 끝 카드 「새 판」)과 수업 「상점과 시너지」(연습용 판 위에서 따라 하는 길)도 여기서.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, R_SM } from '../../render/gfx.js';
import { button } from '../ui.js';
import { createRun } from '../../sim/run.js';
import { createRng, fork } from '../../sim/rng.js';
import { LESSONS, LESSON_GROUPS, SHOP_FAMILY_SAY } from '../lessons.js';
import { startGuide, kingNoteLayout, kingNote } from '../coach.js';
import { TERMS, TERM_GROUPS, termWord, termSay } from '../glossary.js';
import { pageHead, pageButtons, bottomBar } from './common.js';
import { wrapName, drawName } from '../parts.js';
import { PAGE, PAD_BOX, LINE, LINE_TITLE, GAP_GROUP, BTN_H, BTN_HERO, SP, flow, textY } from '../frame.js';
import { openBox, closeBox, layerUp } from '../../render/layoutlog.js';

const TERM_DEF_X = 120; // 낱말 풀이: 풀이 글이 시작하는 x
const TERM_BOX = { x: PAGE.titleX, h: PAGE.btnY - SP.l - PAGE.bodyY }; // 낱말 풀이: 본 칸 상자(왼쪽 x · 쪽의 가장 큰 높이 — 쪽마다 내용에 맞춘다)
// 수업 칸(목록 칸 — 단추가 아니다): 이름 두 줄(14 × 2) + 위아래 2. 칸 사이 4
const LESSON_H = LINE * 2 + SP.s, LESSON_GAP = SP.s;
export const GO = { w: 176, h: BTN_HERO }; // 목록 아래 큰 단추(「이어서」 · 「새 판」 — 29절 수업 「시작」 26)
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
    { screen: 'shop', target: 'fam:leap', say: SHOP_FAMILY_SAY, ok: true },
  ], () => lessonDone(app, i));
}

// 16 × 16 번호 원(벡터): 잉크 원, 끝냈으면 금빛 속 + 잉크 표
function numberDisc(ctx, x, y, done) {
  const cx = x + 8, cy = y + 8;
  ctx.fillStyle = PAL.frameDk;
  ctx.beginPath(); ctx.ellipse(cx, cy, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (!done) return;
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.ellipse(cx, cy, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 4.5, y + 8.5); ctx.lineTo(x + 7, y + 11); ctx.lineTo(x + 11.5, y + 5.5);
  ctx.save(); ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.frameDk; ctx.stroke(); ctx.restore();
}

export class LessonsScreen {
  constructor(app, { end = false } = {}) { this.app = app; this.end = end; }
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(끝 카드의 킹은 kingNote가 live()로 알린다)
  animating() { return false; }
  surroundDim() { return this.end && !this.terms ? 0.6 : 0; } // 끝 카드의 어둡기를 여백 판도 같이(app.surround)
  draw(ctx, ui) {
    const app = this.app, seen = seenOf(app);
    if (this.terms) return this.drawTerms(ctx, ui);
    const done = LESSONS.filter((L) => seen[L.id]).length, next = nextLesson(app);
    pageHead(ctx, '튜토리얼', `${done}/${LESSONS.length}`, { big: true });
    // 장 판넬 셋: 판 밖 폭(12 ~ 468)을 사이 8로 나눈다
    const colW = Math.floor((W - PAGE.titleX * 2 - SP.m * 2) / 3), x0 = PAGE.titleX;
    // 장 칸 쌓기: 장 이름(제목 줄) → 묶음 안 틈 → 수업 칸들(사이 4) — 세 칸은 가장 긴 칸의 높이
    const groups = LESSON_GROUPS.map((g) => LESSONS.map((L, i) => ({ L, i })).filter((o) => o.L.group === g.id));
    const colH = Math.max(...groups.map((list) => PAD_BOX * 2 + LINE_TITLE + SP.s + list.length * LESSON_H + (list.length - 1) * LESSON_GAP));
    const top = PAGE.bodyY;
    LESSON_GROUPS.forEach((g, gi) => {
      const x = x0 + gi * (colW + 8), list = groups[gi];
      const f = flow(top + PAD_BOX);
      openBox('panel', x, top, colW, colH, PAD_BOX, { name: `수업 장 ${g.id}` });
      box(ctx, x, top, colW, colH, PAL.feltDk);
      const n = list.filter(({ L }) => seen[L.id]).length;
      const ty = f.line(true);
      text(ctx, g.name, x + PAD_BOX, ty, PAL.gold, { bold: true });
      text(ctx, `${n}/${list.length}`, x + colW - PAD_BOX, ty, n === list.length ? PAL.gold : PAL.dim, { align: 'right', bold: true });
      f.gap(SP.s);
      list.forEach(({ L, i }, k) => {
        if (k) f.gap(LESSON_GAP);
        const y = f.space(LESSON_H), id = `lessons:${i}`, cx = x + PAD_BOX, cw = colW - PAD_BOX * 2;
        const ok = !!seen[L.id];
        // 목록 칸(크림 칸 · 모서리 4): 누르면 그 수업 하나. 가리키면 금빛 테
        ui.region(id, cx, y, cw, LESSON_H, { onClick: () => openLesson(app, i, 'list') });
        openBox('tile', cx, y, cw, LESSON_H, 0, { name: `수업 칸 ${i}` });
        box(ctx, cx, y, cw, LESSON_H, ok ? PAL.slot : PAL.btn, ui.isHover(id) ? PAL.gold : PAL.frameDk, { r: R_SM, drop: 0 });
        closeBox();
        // 번호 원: 끝낸 수업은 금빛 원에 잉크 표, 아니면 잉크 원에 번호(다음 수업은 금빛)
        const sx = cx + SP.s, sy = y + ((LESSON_H - 16) >> 1);
        numberDisc(ctx, sx, sy, ok);
        if (!ok) text(ctx, `${i + 1}`, sx + 8, textY(sy, 16), i === next ? PAL.gold : PAL.ink, { bold: true, align: 'center' });
        // 수업 이름은 두 줄까지(낱말 단위) — 칸 32에 두 줄(14 × 2)이 테와 2씩 띄워 들어간다. 끝낸 수업은 어두운 칸에 흐린 글
        const nx = sx + 16 + SP.s, nw = cx + cw - SP.s - nx, nm = wrapName(L.title, nw, { bold: false });
        const ys = nm && nm.lines.length > 1 ? nm.lines.map((_, q) => y + textY(((LESSON_H - nm.lines.length * LINE) >> 1) + q * LINE)) : [y + textY(0, LESSON_H)];
        drawName(ctx, L.title, nm, nx, ys, nw, ok ? PAL.dim : PAL.cardInk, { bold: false });
      });
      closeBox();
    });
    // 큰 단추: 안 끝낸 첫 수업부터 차례로(하나도 안 했으면 「처음부터」), 다 끝냈으면 판으로
    const gy = top + colH + SP.l, gx = Math.floor(W / 2 - GO.w / 2);
    const label = next < 0 ? playLabel(app) : done ? '이어서' : '처음부터';
    button(ctx, ui, 'lessons:go', gx, gy, GO.w, GO.h, label, { tone: 'gold', onClick: () => (next < 0 ? play(app) : startTutorial(app, 'flow')) });
    bottomBar(ctx, ui, { back: { id: 'lessons:back', onClick: () => app.toTitle() }, primary: { id: 'lessons:terms', label: '용어 사전', onClick: () => { this.terms = true; } } });
    if (this.end) this.drawEnd(ctx, ui);
  }
  // 끝 카드: 목록 위를 어둡게 덮고 킹이 말한다 — 「새 판」(저장된 판이 있으면 「이어 하기」) · 「목록」
  drawEnd(ctx, ui) {
    const app = this.app;
    ui.regions = []; // 목록 단추는 막는다(덮개처럼)
    layerUp();
    ui.region('lessons:endcover', 0, 0, W, H, { onClick: () => {} });
    ctx.globalAlpha = 0.6; rect(ctx, 0, 0, W, H, PAL.shadow); ctx.globalAlpha = 1;
    const w = 200, lay = kingNoteLayout(END_SAY, w), btnY = lay.h + GAP_GROUP - PAD_BOX, h = btnY + BTN_H + PAD_BOX;
    const x = Math.floor(W / 2 - w / 2), y = Math.floor(H / 2 - h / 2);
    const bw = Math.floor((w - PAD_BOX * 2 - SP.m) / 2);
    kingNote(ctx, app, x, y, w, END_SAY, { ...lay, h }, { joy: true, name: '튜토리얼 끝', inner: () => {
      // 손가락 구역(CHM-52): 덮개라 바깥쪽은 막힘 없이, 두 단추 사이는 반씩
      button(ctx, ui, 'lessons:list', x + PAD_BOX, y + btnY, bw, BTN_H, '목록', { onClick: () => { this.end = false; }, grow: { l: Infinity, r: 4, u: Infinity, d: Infinity } });
      button(ctx, ui, 'lessons:play', x + w - PAD_BOX - bw, y + btnY, bw, BTN_H, playLabel(app), { tone: 'gold', onClick: () => play(app), grow: { l: 4, r: Infinity, u: Infinity, d: Infinity } });
    } });
  }
  // 낱말 풀이: 카드 옆 낱말 상자와 같은 표(glossary.js TERMS)를 묶음 탭(대국 · 판 · 물건 · 모음)과 쪽으로
  drawTerms(ctx, ui) {
    // 판 밖 틀: 머리줄(제목 · 탭) + 본 칸 + 맨 아래 단추 줄(돌아가기 왼쪽 · 쪽 넘기기 오른쪽)
    // 큰 제목 오른쪽 가운데 줄에 탭. 다 안 들어가면 작은 제목 · 윗줄 탭(옛 머리줄)
    const tab = this.termTab || 'battle';
    pageHead(ctx, '용어 사전', null, { big: true, tabs: { ui, prefix: 'terms', list: TERM_GROUPS, cur: tab, go: (id) => { this.termTab = id; this.termPage = 0; } } });
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
    bottomBar(ctx, ui, { back: { id: 'lessons:back', onClick: () => { this.terms = false; } } });
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
