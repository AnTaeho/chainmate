// 첫 수업 목록: 기초 · 대국 · 판 세 묶음, 끝낸 수업에 표. 누르면 그 수업부터.
// 수업 흐름(처음 켬 → 수업 → 첫 판)과 수업 ⑩ 「상점과 가족」(연습용 판 위에서 따라 하는 길)도 여기서.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect } from '../../render/gfx.js';
import { button } from '../ui.js';
import { createRun } from '../../sim/run.js';
import { createRng, fork } from '../../sim/rng.js';
import { LESSONS, LESSON_GROUPS } from '../lessons.js';
import { startGuide } from '../coach.js';
import { TERMS } from '../glossary.js';
import { wrap } from '../../render/text.js';
import { L } from '../lang.js';

const seenOf = (app) => app.records.lessonsSeen || {};

// 처음 켰나(기록 · 판 · 본 수업이 모두 비었다) → 첫 수업으로
export function firstLaunch(app) {
  const r = app.records;
  if (r.lessonsDone || r.runs > 0 || Object.keys(seenOf(app)).length || app.hasSave()) return false;
  app.lessonFrom = 'first';
  app.go('lesson', { index: 0, phase: 'demo' });
  return true;
}

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
    { screen: 'shop', target: 'shop:buy:0', say: '진열의 격언 「기사도」를 산다 — 격언은 판 내내 붙어 있다', done: () => run.maxims.length > 0 },
    { screen: 'shop', target: 'maxim:0', say: '산 격언은 오른쪽 칸에 들어간다. 효과는 카드에 적혀 있다', ok: true },
    { screen: 'shop', target: 'shop:pack:0', say: '기물 꾸러미를 연다 — 셋 중 하나를 고른다',
      done: () => {
        if (run.phase !== 'pack' || !on('pack')) return false;
        run.pack.options = [{ kind: 'piece', t: 'L' }, { kind: 'piece', t: 'O' }, { kind: 'piece', t: 'B' }];
        return true;
      } },
    { screen: 'pack', target: 'pack:pick:0', say: '낙타를 고른다 — 나이트처럼 뛰는 체스 밖의 기물', done: () => run.phase === 'shop' && on('shop') && run.deck.some((p) => p.t === 'L') },
    { screen: 'shop', target: 'fam:leap', say: '기사도와 낙타는 둘 다 도약 가족 — 둘이 모여 도약 효과가 켜졌다(2 · 4 · 6마다 하나씩)', ok: true },
  ], () => lessonDone(app, i));
}

export class LessonsScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const app = this.app, seen = seenOf(app);
    if (this.terms) return this.drawTerms(ctx, ui);
    text(ctx, '첫 수업', W / 2, 10, PAL.gold, { align: 'center', bold: true });
    const colW = 140, x0 = Math.floor((W - colW * 3 - 16) / 2);
    LESSON_GROUPS.forEach((g, gi) => {
      const x = x0 + gi * (colW + 8);
      const list = LESSONS.map((L, i) => ({ L, i })).filter((o) => o.L.group === g.id);
      box(ctx, x, 32, colW, 196, PAL.feltDk, PAL.frameDk);
      text(ctx, g.name, x + colW / 2, 38, PAL.dim, { align: 'center', bold: true });
      list.forEach(({ L, i }, k) => {
        const y = 58 + k * 40, id = `lessons:${i}`;
        const done = !!seen[L.id];
        button(ctx, ui, id, x + 6, y, colW - 12, 32, '', { onClick: () => openLesson(app, i, 'list') });
        // 끝낸 수업은 번호 자리에 표
        if (done) { rect(ctx, x + 12, y + 16, 2, 2, PAL.gold); rect(ctx, x + 14, y + 18, 2, 2, PAL.gold); for (let q = 0; q < 4; q++) rect(ctx, x + 16 + q * 2, y + 16 - q * 2, 2, 2, PAL.gold); }
        else text(ctx, `${i + 1}`, x + 24, y + 10, PAL.dim, { bold: true, align: 'right' });
        text(ctx, L.title, x + 30, y + 10, done ? PAL.ink : PAL.dim);
      });
    });
    button(ctx, ui, 'lessons:terms', W / 2 - 88, 240, 84, 18, '낱말 풀이', { onClick: () => { this.terms = true; } });
    button(ctx, ui, 'lessons:back', W / 2 + 4, 240, 84, 18, '돌아가기', { onClick: () => app.toTitle() });
  }
  // 낱말 풀이: 글 안에서 빛나는 낱말 열한 개를 한곳에
  drawTerms(ctx, ui) {
    text(ctx, '낱말 풀이', W / 2, 10, PAL.gold, { align: 'center', bold: true });
    box(ctx, 16, 28, W - 32, 206, PAL.feltDk, PAL.frameDk);
    TERMS.forEach((t, k) => {
      const y = 34 + k * 18;
      text(ctx, t.word, 24, y, PAL.gold, { bold: true });
      text(ctx, wrap(L(t.say), W - 32 - 84)[0], 96, y, PAL.ink);
    });
    button(ctx, ui, 'lessons:back', W / 2 - 42, 240, 84, 18, '돌아가기', { onClick: () => { this.terms = false; } });
  }
  key(k) { if (k === 'Escape') { if (this.terms) this.terms = false; else this.app.toTitle(); } }
}
