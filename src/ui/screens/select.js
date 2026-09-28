// 관 선택: 연습 · 정식 · 명인 세 장. 목표 · 보상 · 명인 규칙 · 건너뛰면 받는 패. 「두기」 / 「건너뛰기」.
// 떠나온 상점이 있으면 위 띠 왼쪽에 「상점」(돌아가 더 살 수 있다 — 진열 · 꾸러미는 떠날 때 그대로).
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, fitNum, frame, measure } from '../../render/gfx.js';
import { blindInfo, REWARD, ANTES, canReopenShop } from '../../sim/run.js';
import { MASTER_BY_ID, FINAL_MASTER } from '../../data/masters.js';
import { CHARTS } from '../../data/charts.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, BTN_H, cardX, PAD_CARD, LINE, GAP_IN, GAP_GROUP, flow, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { tipLines, fitText } from '../parts.js';
import { drawPortrait } from '../../render/portraits.js';

// 마지막 관(대가)의 왕관 9×7
const CROWN = ['#...#...#', '##..#..##', '##.###.##', '#########', '#########', '.........', '#########'];

// 판의 길: 1관~8관 구슬, 8관은 왕관. 지난 관은 금빛, 지금 관은 밝게 숨 쉬고, 남은 관은 흐리게
export function antePath(ctx, ui, run, cx, y, time) {
  if (run.endless) { text(ctx, `끝없는 대국 ${run.ante}관`, cx, y, PAL.gold, { align: 'center', bold: true }); return; }
  const label = `${run.ante}관 / ${ANTES}관`;
  const step = 14, pw = 8, cw = CROWN[0].length;
  const trackW = (ANTES - 1) * step + cw;
  const lw = measure(label, true);
  const x0 = Math.round(cx - (lw + 10 + trackW) / 2);
  text(ctx, label, x0, y, PAL.ink, { bold: true });
  const px = x0 + lw + 10, py = y + 2;
  rect(ctx, px + 4, py + 4, (ANTES - 1) * step, 1, PAL.feltHi);
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  for (let i = 0; i < ANTES; i++) {
    const a = i + 1, x = px + i * step;
    const done = a < run.ante, cur = a === run.ante;
    if (a === ANTES) {
      const col = done ? PAL.gold : cur ? PAL.red : PAL.redDk;
      if (cur) { ctx.globalAlpha = 0.35 + 0.35 * pulse; rect(ctx, x - 2, py - 3, cw + 4, CROWN.length + 4, PAL.red); ctx.globalAlpha = 1; }
      CROWN.forEach((row, j) => { for (let k = 0; k < cw; k++) if (row[k] === '#') rect(ctx, x + k, py - 1 + j, 1, 1, col); });
      continue;
    }
    if (done) box(ctx, x, py, pw, pw, PAL.gold, PAL.goldDk);
    else if (cur) {
      box(ctx, x, py, pw, pw, PAL.goldHi, PAL.gold);
      ctx.globalAlpha = 0.3 + 0.5 * pulse; frame(ctx, x - 2, py - 2, pw + 4, pw + 4, PAL.goldHi); ctx.globalAlpha = 1;
    } else box(ctx, x, py, pw, pw, PAL.feltDk, PAL.dimDk);
  }
  const fm = MASTER_BY_ID[FINAL_MASTER];
  ui.region('select:path', x0, y - 2, lw + 10 + trackW, 16, { tip: () => tipLines(`${ANTES}관 · ${fm.name}`, '꺾으면 판을 이긴다') });
}

export const tagText = (tag) => (tag.kind === 'money' ? `상금 +${tag.amount}` : tag.kind === 'chart' ? `${CHARTS[tag.form].name} 한 장` : '');

// 대국 카드 쌓기(재기와 그리기가 같이 쓴다 — PAD_CARD): 종류(제목) → 묶음 틈 → 목표 · 이기면 → 묶음 틈(가운데 가로줄) →
// 명인(초상 옆 이름 → 묶음 안 틈 → 규칙 글) 또는 「건너뛰면」 → 받는 것 → 묶음 틈 → 단추 줄(지난 대국은 「이김」 · 「건너뜀」)
const PORTRAIT = 36;
const BAR = { y: 2, h: BTN_S }; // 본 칸 위 띠의 작은 단추(상점 화면 띠와 같다)
// 대국 카드 셋은 본 칸을 꽉 채운다(사이 4 — 명인 규칙 글이 한 줄이라도 덜 접히게)
const SEL = { gap: 4, get w() { return Math.floor((MAIN.w - this.gap * 2) / 3); } };
const selX = (i) => MAIN.x + i * (SEL.w + SEL.gap);
export function blindLayout(run, i, w = SEL.w) {
  const info = blindInfo(run, run.ante, i);
  const master = info.kind === 'master';
  const P = PAD_CARD, IW = w - P * 2, f = flow(P);
  const out = { info, master, IW };
  out.kind = f.line(true);
  f.gap(GAP_GROUP);
  // 이름표 · 수치 한 줄(넘치면 수치를 다음 줄 오른쪽에 — 그 줄에도 안 들어가는 큰 수는 짧은 꼴 3.1T)
  const row = (label, val, bold = true) => {
    if (typeof val === 'number') val = fitNum(val, IW, bold);
    const two = measure(label) + 6 + measure(val, bold) > IW;
    const ly = f.line();
    return { label, val, ly, vy: two ? f.line() : ly };
  };
  out.rows = [row('목표', info.target), row('이기면', master ? `$${REWARD.base[info.kind]} + 상자` : `$${REWARD.base[info.kind]}`)];
  out.rule = f.y + Math.floor(GAP_GROUP / 2);
  f.gap(GAP_GROUP);
  if (master) {
    const m = MASTER_BY_ID[info.master];
    out.m = m;
    // 초상 옆 이름: 굵게 두 줄까지, 넘치면 보통 굵기(영어 「Master Iron Wall」)
    let names = wrap(`명인 ${m.name}`, IW - PORTRAIT - 6, true);
    out.nameBold = names.length <= 2;
    if (!out.nameBold) names = wrap(`명인 ${m.name}`, IW - PORTRAIT - 6, false);
    const top = f.space(Math.max(PORTRAIT, names.length * LINE));
    out.portrait = top;
    const nf = flow(top + Math.max(0, Math.floor((PORTRAIT - names.length * LINE) / 2)));
    out.names = names.map((l) => [l, nf.line()]);
    f.gap(GAP_IN);
    out.lines = wrap(m.text, IW).map((l) => [l, f.line()]);
  } else {
    out.skipLabel = f.line();
    f.gap(GAP_IN);
    out.lines = wrap(tagText(info.tag), IW, true).map((l) => [l, f.line()]);
  }
  f.gap(GAP_GROUP);
  out.btn = f.space(BTN_H);
  out.h = f.y + P;
  return out;
}

export class SelectScreen {
  constructor(app) { this.app = app; this.notes = 'side'; }
  // 판 틀: 왼쪽 칸(관 선택 · 시너지 · 정석 · 상금 — 설명 자리) + 본 칸(대국 카드 셋 — 가장 긴 카드에 맞춘 높이 · 판의 길 ·
  // 떠나온 상점이 있으면 판의 길 띠 왼쪽에 「상점」)
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    runSide(ctx, ui, app, '관 선택');
    pauseButton(ctx, ui, app);
    // 처음 시계를 잃은 뒤: 시계 줄을 가리키는 한 줄
    if (run.log.some((x) => x.clockLost)) hint(app, 'clock', 'clock');
    // 판의 길은 본 칸 위 띠(카드 줄이 내용에 맞춰 길어지므로 아래를 비운다)
    antePath(ctx, ui, run, MAIN.x + MAIN.w / 2, 5, app.time);
    const lays = [0, 1, 2].map((i) => blindLayout(run, i));
    const h = Math.max(...lays.map((q) => q.h));
    for (let i = 0; i < 3; i++) {
      const lay = lays[i], info = lay.info, master = lay.master;
      const x = selX(i), y = TOP, w = SEL.w;
      const cur = i === run.blind;
      const past = i < run.blind;
      const log = run.log.find((l) => l.ante === run.ante && l.blind === i);
      const edge = cur ? (master ? PAL.red : PAL.gold) : PAL.frameDk;
      if (cur) frame(ctx, x - 1, y - 1, w + 2, h + 2, edge);
      openBox('card', x, y, w, h, PAD_CARD, { name: `대국 카드 ${i}` });
      box(ctx, x, y, w, h, cur ? PAL.feltDk : PAL.felt, edge);
      const ink = cur ? PAL.ink : PAL.dim;
      const P = PAD_CARD;
      fitText(ctx, KIND_NAME[info.kind], x + P, y + lay.kind, w - P * 2, master ? PAL.red : cur ? PAL.gold : PAL.dim);
      lay.rows.forEach((r, k) => {
        text(ctx, r.label, x + P, y + r.ly, PAL.dim);
        text(ctx, r.val, x + w - P, y + r.vy, k ? PAL.gold : ink, { align: 'right', bold: true });
      });
      rect(ctx, x + P, y + lay.rule, w - P * 2, 1, PAL.frameDk);
      if (master) {
        // 명인 카드: 가리키면 글 안 낱말의 상자(두기 단추는 뒤에 그려 먼저 눌린다)
        ui.region(`select:card:${i}`, x, y, w, h, { keys: [lay.m.text] });
        box(ctx, x + P, y + lay.portrait, PORTRAIT, PORTRAIT, PAL.felt, cur ? PAL.red : PAL.frameDk);
        drawPortrait(ctx, info.master, x + P + 2, y + lay.portrait + 2, 1, cur ? 1 : 0.6);
        for (const [l, ly] of lay.names) text(ctx, l, x + P + PORTRAIT + 6, y + ly, PAL.red, { bold: lay.nameBold });
        for (const [l, ly] of lay.lines) richText(ctx, l, x + P, y + ly, ink, { termCol: PAL.gold });
      } else {
        text(ctx, '건너뛰면', x + P, y + lay.skipLabel, PAL.dim);
        for (const [l, ly] of lay.lines) text(ctx, l, x + P, y + ly, cur ? PAL.gold : PAL.dim, { bold: true });
      }
      // 단추 줄은 카드 아래 안 여백 위(세 카드가 같은 높이라 같은 줄)
      const by = y + h - P - BTN_H;
      if (past) {
        const lost = log && !log.skipped && log.won === false;
        text(ctx, log && log.skipped ? '건너뜀' : lost ? '짐 · 시계 −1' : '이김', x + w / 2, by + 3, lost ? PAL.red : PAL.dim, { align: 'center', bold: true });
      } else if (cur) {
        if (master) { button(ctx, ui, 'select:play', x + P, by, w - P * 2, BTN_H, '두기', { onClick: () => this.play(), tone: 'red' }); hint(this.app, 'master', 'select:play'); }
        else {
          button(ctx, ui, 'select:play', x + P, by, 38, BTN_H, '두기', { onClick: () => this.play(), tone: 'gold' });
          button(ctx, ui, 'select:skip', x + P + 42, by, w - P * 2 - 42, BTN_H, '건너뛰기', { onClick: () => this.skip() });
        }
      }
      closeBox();
    }
    // 떠나온 상점으로: 본 칸 위 띠 왼쪽(상점의 「다음 대국」과 같은 띠 · 같은 높이). 카드 줄 아래는 긴 명인 카드가 다 쓴다
    if (canReopenShop(run)) {
      const label = '상점';
      button(ctx, ui, 'select:shop', MAIN.x, BAR.y, measure(label, true) + 16, BAR.h, label, { onClick: () => this.toShop() });
    }
  }
  toShop() {
    this.app.cmd({ type: 'shop' });
    this.app.sfx('click');
    this.app.goPhase();
  }
  play() {
    const ev = this.app.cmd({ type: 'play' });
    this.app.sfx('start');
    this.app.go('battle', { events: ev });
  }
  skip() {
    const ev = this.app.cmd({ type: 'skip' });
    const s = ev.find((e) => e.type === 'skip');
    if (s) this.app.toast(`건너뜀 · ${tagText(s.tag)}`, PAL.gold);
    this.app.sfx('coin');
    this.app.goPhase();
  }
  key(k) {
    if (k === 'Enter' || k === ' ') this.play();
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
