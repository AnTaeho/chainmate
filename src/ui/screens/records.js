// 기록: 판 수 · 이긴 판 · 최고 도달 · 최고 한 수(점수와 사슬 모습 줄) · 외통 · 탁월수 · 전설 완성 · 단 · 오늘의 대국.
// 오른쪽: 최고 한 수 · 가장 큰 탁월수(점수 · 바친 기물 · 곱한 배수, CHM-43).
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, sprite, fitNum, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { danName } from './setup.js';
import { pageHead } from './common.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, GAP_IN, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { brilliantMult } from '../../data/sacrifice.js';
import { ANNOT, drawAnnot, annotSize } from '../annot.js';

export class RecordsScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const r = this.app.records;
    pageHead(ctx, '기록');
    const d = r.daily && r.daily.date === this.app.today() ? r.daily : null;
    const rows = [
      ['판', `${r.runs}`], ['이긴 판', `${r.wins}`], ['최고 도달', r.bestAnte ? `${r.bestAnte}관` : '-'],
      ['체크메이트', `${r.mates}`], ['탁월수 !!', `${r.brilliants || 0}`], ['전설 완성', `${r.legends}`], ['신의 한 수(★★★)', `${(r.grades['★★★'] || 0) + (r.grades['∞'] || 0)}`],
      ['열린 레이팅', danName(r.unlocked.dan)],
      ['끝없는 대국', r.bestEndless ? `${r.bestEndless}관` : '-'],
      ['오늘의 대국', d ? `${d.won ? '이김' : `${d.ante}관`} · ${d.runs}판` : '아직'],
      ['첫 수업', r.lessonsDone ? '끝' : '아직'],
    ];
    // 목록 줄은 본문 줄(LINE), 본 칸 윗변부터
    rows.forEach(([a, b], i) => {
      text(ctx, a, 40, textY(PAGE.bodyY + i * LINE), PAL.dim);
      text(ctx, b, 240, textY(PAGE.bodyY + i * LINE), PAL.ink, { align: 'right', bold: true });
    });
    // 최고 한 수(hug): 이름표 · 점수 → 묶음 틈 → 사슬 모습(여덟씩 줄) → 묶음 안 틈 → 관
    const bx = 270, bw = 196, P = PAD_BOX, f = flow(PAGE.bodyY + P);
    const head = f.line();
    f.gap(GAP_GROUP);
    const steps = r.bestMove ? r.bestMove.steps.slice(0, 16) : [];
    const sy = f.space(r.bestMove ? Math.ceil(steps.length / 8) * 26 - 4 : LINE);
    const ay = r.bestMove ? f.gap(GAP_IN).line() : null;
    const bh = f.y + P - PAGE.bodyY;
    openBox('panel', bx, PAGE.bodyY, bw, bh, P, { name: '최고 한 수' });
    box(ctx, bx, PAGE.bodyY, bw, bh, PAL.feltDk, PAL.frameDk);
    text(ctx, '최고 한 수', bx + P, head, PAL.dim);
    if (r.bestMove) {
      text(ctx, fitNum(r.bestMove.score, bw - P * 2 - measure('최고 한 수') - 6), bx + bw - P, head, PAL.gold, { align: 'right', bold: true });
      steps.forEach((t, i) => sprite(ctx, t, 'w', bx + P + (i % 8) * 22, sy + Math.floor(i / 8) * 26));
      text(ctx, `${r.bestMove.ante}관`, bx + bw - P, ay, PAL.dim, { align: 'right' });
    } else text(ctx, '아직', bx + P, textY(sy), PAL.dimDk);
    closeBox();
    // 가장 큰 탁월수(hug): 이름표 · 점수 → 묶음 틈 → 바친 기물(여덟씩 줄) 뒤에 청록 「×N」 → 묶음 안 틈 → 관
    const bb = r.bestBrilliant, by = PAGE.bodyY + bh + GAP_GROUP, g = flow(by + P);
    const bhead = g.line();
    g.gap(GAP_GROUP);
    const offered = bb ? (bb.pieces || []).slice(0, 8) : [];
    const oy = g.space(bb ? 22 : LINE);
    const bay = bb && bb.ante ? g.gap(GAP_IN).line() : null;
    const bbh = g.y + P - by;
    openBox('panel', bx, by, bw, bbh, P, { name: '가장 큰 탁월수' });
    box(ctx, bx, by, bw, bbh, PAL.feltDk, PAL.frameDk);
    text(ctx, '가장 큰 탁월수', bx + P, bhead, PAL.dim);
    if (bb) {
      text(ctx, fitNum(bb.score, bw - P * 2 - measure('가장 큰 탁월수') - 6), bx + bw - P, bhead, PAL.gold, { align: 'right', bold: true });
      offered.forEach((t, i) => sprite(ctx, t, 'w', bx + P + i * 22, oy, { alpha: 0.7 }));
      const mark = `×${brilliantMult(bb.weight || 0)}`, sz = annotSize(mark);
      drawAnnot(ctx, mark, bx + P + offered.length * 22 + 2, oy + 11 - Math.floor(sz.h / 2), ANNOT.teal);
      if (bay != null) text(ctx, `${bb.ante}관`, bx + bw - P, bay, PAL.dim, { align: 'right' });
    } else text(ctx, '아직', bx + P, textY(oy), PAL.dimDk);
    closeBox();
    button(ctx, ui, 'records:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => this.app.go('title') });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.go('title'); }
}
