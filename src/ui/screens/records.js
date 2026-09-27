// 기록: 판 수 · 이긴 판 · 최고 관 · 최고 한 수(점수와 사슬 모습 줄) · 외통 · 전설 완성 · 단 · 오늘의 대국.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, sprite, num } from '../../render/gfx.js';
import { button } from '../ui.js';
import { today } from '../records.js';
import { danName } from './setup.js';

export class RecordsScreen {
  constructor(app) { this.app = app; }
  draw(ctx, ui) {
    const r = this.app.records;
    text(ctx, '기록', 12, 8, PAL.gold, { bold: true });
    rect(ctx, 8, 25, W - 16, 1, PAL.feltHi);
    const d = r.daily && r.daily.date === today() ? r.daily : null;
    const rows = [
      ['판', `${r.runs}`], ['이긴 판', `${r.wins}`], ['최고 관', r.bestAnte ? `${r.bestAnte}관` : '-'],
      ['외통', `${r.mates}`], ['전설 완성', `${r.legends}`], ['신의 한 수(!!!)', `${(r.grades['!!!'] || 0) + (r.grades['∞'] || 0)}`],
      ['열린 단', danName(r.unlocked.dan)],
      ['끝없는 대국', r.bestEndless ? `${r.bestEndless}관` : '-'],
      ['오늘의 대국', d ? `${d.won ? '이김' : `${d.ante}관`} · ${d.runs}판` : '아직'],
      ['첫 수업', r.lessonsDone ? '끝' : '아직'],
    ];
    rows.forEach(([a, b], i) => {
      text(ctx, a, 40, 34 + i * 16, PAL.dim);
      text(ctx, b, 240, 34 + i * 16, PAL.ink, { align: 'right', bold: true });
    });
    // 최고 한 수
    box(ctx, 270, 40, 196, 120, PAL.feltDk, PAL.frameDk);
    text(ctx, '최고 한 수', 280, 46, PAL.dim);
    if (r.bestMove) {
      text(ctx, num(r.bestMove.score), 456, 46, PAL.gold, { align: 'right', bold: true });
      const steps = r.bestMove.steps.slice(0, 16);
      steps.forEach((t, i) => sprite(ctx, t, 'w', 280 + (i % 8) * 22, 70 + Math.floor(i / 8) * 26));
      text(ctx, `${r.bestMove.ante}관`, 456, 140, PAL.dim, { align: 'right' });
    } else text(ctx, '아직', 280, 70, PAL.dimDk);
    button(ctx, ui, 'records:back', 12, H - 26, 80, 18, '돌아가기', { onClick: () => this.app.go('title') });
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.go('title'); }
}
