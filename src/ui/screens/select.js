// 관 선택: 연습 · 정식 · 명인 세 장. 목표 · 보상 · 명인 규칙 · 건너뛰면 받는 패. 「두기」 / 「건너뛰기」.
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, num, frame, measure } from '../../render/gfx.js';
import { blindInfo, REWARD, ANTES } from '../../sim/run.js';
import { MASTER_BY_ID, FINAL_MASTER } from '../../data/masters.js';
import { CHARTS } from '../../data/charts.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { KIND_NAME } from '../words.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, BTN_H, cardX } from '../frame.js';
import { tipLines } from '../parts.js';
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

export class SelectScreen {
  constructor(app) { this.app = app; this.notes = 'side'; }
  // 판 틀: 왼쪽 칸(관 선택 · 시너지 · 정석 · 상금 — 설명 자리) + 본 칸(대국 카드 셋 · 판의 길)
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    runSide(ctx, ui, app, '관 선택');
    pauseButton(ctx, ui, app);
    antePath(ctx, ui, run, MAIN.x + MAIN.w / 2, 246, app.time);
    for (let i = 0; i < 3; i++) {
      const info = blindInfo(run, run.ante, i);
      const x = cardX(i), y = TOP, w = CARD.w, h = 214;
      const cur = i === run.blind;
      const past = i < run.blind;
      const log = run.log.find((l) => l.ante === run.ante && l.blind === i);
      const master = info.kind === 'master';
      const edge = cur ? (master ? PAL.red : PAL.gold) : PAL.frameDk;
      box(ctx, x, y, w, h, cur ? PAL.feltDk : PAL.felt, edge);
      if (cur) frame(ctx, x - 1, y - 1, w + 2, h + 2, edge);
      const ink = cur ? PAL.ink : PAL.dim;
      const P = 6;
      text(ctx, KIND_NAME[info.kind], x + P, y + 5, master ? PAL.red : cur ? PAL.gold : PAL.dim, { bold: true });
      // 이름표 · 수치 한 줄(넘치면 수치를 다음 줄 오른쪽에)
      const row = (label, val, yy, col, bold = true) => {
        text(ctx, label, x + P, yy, PAL.dim);
        const two = measure(label) + 6 + measure(val, bold) > w - P * 2;
        text(ctx, val, x + w - P, two ? yy + 13 : yy, col, { align: 'right', bold });
        return two ? 26 : 13;
      };
      let yy = y + 24;
      yy += row('목표', num(info.target), yy, ink);
      yy += row('이기면', master ? `$${REWARD.base[info.kind]} + 상자` : `$${REWARD.base[info.kind]}`, yy, PAL.gold);
      rect(ctx, x + P, yy + 3, w - P * 2, 1, PAL.frameDk);
      yy += 8;
      if (master) {
        const m = MASTER_BY_ID[info.master];
        // 명인 카드: 가리키면 글 안 낱말의 상자(두기 단추는 뒤에 그려 먼저 눌린다)
        ui.region(`select:card:${i}`, x, y, w, h, { keys: [m.text] });
        box(ctx, x + P, yy, 36, 36, PAL.felt, cur ? PAL.red : PAL.frameDk);
        drawPortrait(ctx, info.master, x + P + 2, yy + 2, 1, cur ? 1 : 0.6);
        wrap(`명인 ${m.name}`, w - P * 2 - 42, true).slice(0, 2).forEach((l, k) => text(ctx, l, x + P + 42, yy + 4 + k * 13, PAL.red, { bold: true }));
        wrap(m.text, w - P * 2).slice(0, 5).forEach((l, k) => richText(ctx, l, x + P, yy + 42 + k * 13, ink, { termCol: PAL.gold }));
      } else {
        text(ctx, '건너뛰면', x + P, yy, PAL.dim);
        wrap(tagText(info.tag), w - P * 2).forEach((l, k) => text(ctx, l, x + P, yy + 14 + k * 13, cur ? PAL.gold : PAL.dim, { bold: true }));
      }
      const by = y + h - 24;
      if (past) {
        text(ctx, log && log.skipped ? '건너뜀' : '이김', x + w / 2, by + 3, PAL.dim, { align: 'center', bold: true });
      } else if (cur) {
        if (master) { button(ctx, ui, 'select:play', x + P, by, w - P * 2, BTN_H, '두기', { onClick: () => this.play(), tone: 'red' }); hint(this.app, 'master', 'select:play'); }
        else {
          button(ctx, ui, 'select:play', x + P, by, 38, BTN_H, '두기', { onClick: () => this.play(), tone: 'gold' });
          button(ctx, ui, 'select:skip', x + P + 42, by, w - P * 2 - 42, BTN_H, '건너뛰기', { onClick: () => this.skip() });
        }
      }
    }
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
