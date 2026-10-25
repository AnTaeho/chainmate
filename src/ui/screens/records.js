// 기록: 위에 표 둘(판 — 판 수 · 이긴 판 · 최고 도달 · 끝없는 대국 · 돌파한 관 · 열린 레이팅 / 수 — 체크메이트 · 탁월수 · 전설 완성 · 신의 한 수 · 오늘의 대국 · 튜토리얼),
// 아래에 같은 높이 판넬 둘: 최고 한 수(점수와 사슬 모습 줄) · 가장 큰 탁월수(점수 · 바친 기물 · 곱한 배수, CHM-43).
// 표 규칙(29절): 이름 열은 가장 긴 이름 + 16, 수치는 그 뒤 수치 열 끝에 오른쪽 맞춤. 수치는 굵게, 낱말(아직 · 끝 · -)은 보통.
import { PAL } from '../../render/palette.js';
import { W, text, box, sprite, fitNum, measure } from '../../render/gfx.js';
import { danName } from './setup.js';
import { pageHead, bottomBar } from './common.js';
import { PAGE, PAD_BOX, LINE, SP, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { brilliantMult } from '../../data/sacrifice.js';
import { ANNOT, drawAnnot, annotSize } from '../annot.js';

const ROW = LINE + SP.s;                 // 표 줄 14 + 사이 4
const STEP = 22, ART_H = 22;             // 사슬 모습 기물 칸
const hasNum = (s) => /\d/.test(s);
// 표 하나: 이름 열(가장 긴 이름 + 16) + 수치 열(가장 긴 수치). 돌려주는 값은 표 폭
export function recordTable(ctx, rows, x, y) {
  const lw = Math.max(...rows.map(([a]) => measure(a))) + SP.xl;
  const vw = Math.max(...rows.map(([, b]) => measure(b, hasNum(b))));
  rows.forEach(([a, b], i) => {
    const ty = textY(y + i * ROW);
    text(ctx, a, x, ty, PAL.dim);
    text(ctx, b, x + lw + vw, ty, PAL.ink, { align: 'right', bold: hasNum(b) });
  });
  return lw + vw;
}

export class RecordsScreen {
  constructor(app) { this.app = app; }
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const r = this.app.records;
    pageHead(ctx, '기록', null, { big: true });
    const d = r.daily && r.daily.date === this.app.today() ? r.daily : null;
    const runs = [
      ['판', `${r.runs}`], ['이긴 판', `${r.wins}`], ['최고 도달', r.bestAnte ? `${r.bestAnte}관` : '-'],
      ['끝없는 대국', r.bestEndless ? `${r.bestEndless}관` : '-'], ['돌파한 관', `${r.gates || 0}`], ['열린 레이팅', danName(r.unlocked.dan)],
    ];
    const moves = [
      ['체크메이트', `${r.mates}`], ['탁월수 !!', `${r.brilliants || 0}`], ['전설 완성', `${r.legends}`],
      ['신의 한 수(★★★)', `${(r.grades['★★★'] || 0) + (r.grades['∞'] || 0)}`],
      ['오늘의 대국', d ? `${d.won ? '승리' : `${d.ante}관`} · ${d.runs}판` : '아직'], ['튜토리얼', r.lessonsDone ? '끝' : '아직'],
    ];
    // 판넬 둘은 화면을 반씩(사이 8), 표는 각 판넬의 왼끝에 맞춘다
    const pw = Math.floor((W - PAGE.titleX * 2 - SP.m) / 2), px = [PAGE.titleX, PAGE.titleX + pw + SP.m];
    recordTable(ctx, runs, px[0], PAGE.bodyY);
    recordTable(ctx, moves, px[1], PAGE.bodyY);
    // 판넬(같은 높이): 이름표 · 점수 → 묶음 안 틈 → 기물 줄(아홉씩, 줄 사이 4)
    const P = PAD_BOX, per = Math.floor((pw - P * 2) / STEP);
    const steps = r.bestMove ? r.bestMove.steps.slice(0, 16) : [];
    const bb = r.bestBrilliant, offered = bb ? (bb.pieces || []).slice(0, per - 1) : [];
    const artRows = Math.max(1, Math.ceil(steps.length / per));
    const ph = P * 2 + LINE + SP.s + artRows * ART_H + (artRows - 1) * SP.s;
    const py = PAGE.bodyY + ROW * 6 - SP.s + SP.l;
    const head = (x, label, ante, score) => {
      const ty = textY(py + P);
      text(ctx, label, x + P, ty, PAL.dim);
      const lw = measure(label);
      if (ante) text(ctx, `${ante}관`, x + P + lw + SP.m, ty, PAL.dim, { bold: true });
      if (score != null) text(ctx, fitNum(score, pw - P * 2 - lw - SP.m * 2 - (ante ? measure(`${ante}관`, true) + SP.m : 0)), x + pw - P, ty, PAL.gold, { align: 'right', bold: true });
    };
    const ay = py + P + LINE + SP.s;
    openBox('panel', px[0], py, pw, ph, P, { name: '최고 한 수' });
    box(ctx, px[0], py, pw, ph, PAL.feltDk, PAL.frameDk);
    head(px[0], '최고 한 수', r.bestMove && r.bestMove.ante, r.bestMove ? r.bestMove.score : null);
    if (r.bestMove) steps.forEach((t, i) => sprite(ctx, t, 'w', px[0] + P + (i % per) * STEP, ay + Math.floor(i / per) * (ART_H + SP.s)));
    else text(ctx, '아직', px[0] + P, textY(ay), PAL.dimDk);
    closeBox();
    openBox('panel', px[1], py, pw, ph, P, { name: '가장 큰 탁월수' });
    box(ctx, px[1], py, pw, ph, PAL.feltDk, PAL.frameDk);
    head(px[1], '가장 큰 탁월수', bb && bb.ante, bb ? bb.score : null);
    if (bb) {
      offered.forEach((t, i) => sprite(ctx, t, 'w', px[1] + P + i * STEP, ay, { alpha: 0.7 }));
      const mark = `×${brilliantMult(bb.weight || 0)}`, sz = annotSize(mark);
      drawAnnot(ctx, mark, px[1] + P + offered.length * STEP + SP.xs, ay + (ART_H >> 1) - Math.floor(sz.h / 2), ANNOT.teal);
    } else text(ctx, '아직', px[1] + P, textY(ay), PAL.dimDk);
    closeBox();
    bottomBar(ctx, ui, { back: { id: 'records:back', onClick: () => this.app.go('title') } });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.go('title'); }
}
