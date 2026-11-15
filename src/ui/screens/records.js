// 기록: 위에 표 판넬 둘(판 — 판 수 · 이긴 판 · 최고 도달 · 끝없는 대국 · 돌파한 관 · 열린 레이팅 / 수 — 체크메이트 · 탁월수 · 전설 완성 · 신의 한 수 · 오늘의 대국 · 튜토리얼),
// 아래에 같은 높이 판넬 둘: 최고 한 수(점수와 사슬 모습 줄) · 가장 큰 탁월수(점수 · 바친 기물 · 곱한 배수, CHM-43).
// 묶음 판넬(29절 「묶음」): 이름은 흐림 왼쪽, 값은 판넬 오른끝(안 여백 8)에 오른쪽 맞춤 — 아래 판넬의 점수와 같은 오른선. 값은 굵게 크림, 빈 값(아직 · -)은 보통 흐림.
// 탭 둘(29절 제목 자리 1): 「전적」(위 표 · 판넬) · 「업적」(세 칸 격자 — 받은 것은 크림 카드 + 금빛 메달, 못 받은 것은 빈 칸에 조건, 숨은 것은 「?」).
import { PAL } from '../../render/palette.js';
import { W, text, sprite, fitNum, measure, slot } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { danName } from './setup.js';
import { pageHead, bottomBar, pageButtons, HEAD_BIG, groupLayout, groupPanel, statRow } from './common.js';
import { PAGE, PAD_CARD, LINE, LINE_TITLE, SP, GAP_IN, GAP_GROUP, GROUP, textY } from '../frame.js';
import { cardBase } from '../parts.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { achvHave, achvDone } from '../achievements.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { brilliantMult } from '../../data/sacrifice.js';
import { ANNOT, drawAnnot, annotSize } from '../annot.js';

const STEP = 22, ART_H = 22;             // 사슬 모습 기물 칸
// 표 판넬 하나: 줄마다 이름(흐림) · 값(판넬 오른끝). 돌려주는 값은 판넬 높이
export const recordPanelH = (n) => groupLayout(0, Array.from({ length: n }, () => ({ h: LINE }))).h;
export function recordPanel(ctx, rows, x, y, w, name) {
  const g = groupLayout(y, rows.map(() => ({ h: LINE })));
  groupPanel(ctx, x, y, w, g.h, { box: name }, () => rows.forEach(([a, b], i) => statRow(ctx, a, b, x + GROUP.padX, x + w - GROUP.padX, textY(g.rows[i]))));
  return g.h;
}

// 업적 격자: 세 칸, 칸 높이는 모든 업적의 조건 줄 수 중 가장 큰 것으로 같다(받아도 쪽이 바뀌지 않는다).
// 칸 안: 안 여백 → 메달 · 이름(제목 줄, 오른끝에 「N/M」) → 묶음 안 틈 → 조건(본문, 낱말 단위 줄바꿈) → 안 여백
export const ACHV_GRID = { cols: 3, gap: SP.s, medal: 12 };
export function achvLayout(top = PAGE.bodyY) {
  const P = PAD_CARD, { cols, gap } = ACHV_GRID;
  const cw = Math.floor((W - PAGE.titleX * 2 - (cols - 1) * gap) / cols);
  const conds = ACHIEVEMENTS.map((a) => wrap(a.text, cw - P * 2));
  const h = P * 2 + LINE + GAP_IN + Math.max(...conds.map((c) => c.length)) * LINE;
  const room = PAGE.btnY - GAP_GROUP - top, rows = Math.max(1, Math.floor((room + gap) / (h + gap))), per = rows * cols;
  const pages = [];
  ACHIEVEMENTS.forEach((a, i) => {
    const k = i % per, pg = Math.floor(i / per);
    (pages[pg] || (pages[pg] = [])).push({ i, x: PAGE.titleX + (k % cols) * (cw + gap), y: top + Math.floor(k / cols) * (h + gap), cond: conds[i] });
  });
  return { cw, h, pages };
}
// 메달: 받은 것은 금빛 동그라미(잉크 테 1 · 밝은 속 원), 못 받은 것은 흐린 테만
export function medal(ctx, x, y, d, done) {
  const r = d / 2, cx = x + r, cy = y + r;
  const disc = (rr, col) => { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
  if (done) { disc(r, PAL.frameDk); disc(r - 1, PAL.gold); disc(r - 3, PAL.goldHi); disc(r - 4, PAL.gold); }
  else { disc(r, PAL.dimDk); disc(r - 1, PAL.feltDk); }
}

export class RecordsScreen {
  constructor(app, { tab = 'stats' } = {}) { this.app = app; this.tab = tab === 'achv' ? 'achv' : 'stats'; this.page = 0; }
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    const r = this.app.records;
    const go = (id) => { this.tab = id; this.page = 0; this.app.sfx('pick'); };
    const { tabEnd } = pageHead(ctx, '기록', null, { big: true, tabs: { ui, prefix: 'records', list: [['stats', '전적'], ['achv', '업적']], cur: this.tab, go } });
    bottomBar(ctx, ui, { back: { id: 'records:back', onClick: () => this.app.go('title') } });
    if (this.tab === 'achv') return this.drawAchv(ctx, ui, tabEnd);
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
    // 판넬 넷: 화면을 반씩(사이 8), 위 표 판넬 → 판넬 사이 8 → 아래 판넬(같은 높이)
    const pw = Math.floor((W - PAGE.titleX * 2 - GROUP.gap) / 2), px = [PAGE.titleX, PAGE.titleX + pw + GROUP.gap];
    const th = recordPanel(ctx, runs, px[0], PAGE.bodyY, pw, '판 표');
    recordPanel(ctx, moves, px[1], PAGE.bodyY, pw, '수 표');
    // 아래 판넬: 이름(금빛 굵게) · 관(굵게 흐림) · 점수(굵게 크림, 오른끝) → 4 → 기물 줄(아홉씩, 줄 사이 4)
    const P = GROUP.padX, per = Math.floor((pw - P * 2) / STEP);
    const steps = r.bestMove ? r.bestMove.steps.slice(0, 16) : [];
    const bb = r.bestBrilliant, offered = bb ? (bb.pieces || []).slice(0, per - 1) : [];
    const artRows = Math.max(1, Math.ceil(steps.length / per));
    const py = PAGE.bodyY + th + GROUP.gap;
    const g = groupLayout(py, [{ h: artRows * ART_H + (artRows - 1) * SP.s }], { name: true }), ph = g.h, ay = g.rows[0];
    const head = (x, label, ante, score) => {
      const ty = textY(py + GROUP.padBtn, LINE_TITLE), lw = measure(label, true);
      if (ante) text(ctx, `${ante}관`, x + P + lw + SP.m, ty, PAL.dim, { bold: true });
      if (score != null) text(ctx, fitNum(score, pw - P * 2 - lw - SP.m * 2 - (ante ? measure(`${ante}관`, true) + SP.m : 0)), x + pw - P, ty, PAL.ink, { align: 'right', bold: true });
    };
    groupPanel(ctx, px[0], py, pw, ph, { name: '최고 한 수' }, () => {
      head(px[0], '최고 한 수', r.bestMove && r.bestMove.ante, r.bestMove ? r.bestMove.score : null);
      if (r.bestMove) steps.forEach((t, i) => sprite(ctx, t, 'w', px[0] + P + (i % per) * STEP, ay + Math.floor(i / per) * (ART_H + SP.s)));
      else text(ctx, '아직', px[0] + P, textY(ay), PAL.dim);
    });
    groupPanel(ctx, px[1], py, pw, ph, { name: '가장 큰 탁월수' }, () => {
      head(px[1], '가장 큰 탁월수', bb && bb.ante, bb ? bb.score : null);
      if (bb) {
        offered.forEach((t, i) => sprite(ctx, t, 'w', px[1] + P + i * STEP, ay, { alpha: 0.7 }));
        const mark = `×${brilliantMult(bb.weight || 0)}`, sz = annotSize(mark);
        drawAnnot(ctx, mark, px[1] + P + offered.length * STEP + SP.xs, ay + (ART_H >> 1) - Math.floor(sz.h / 2), ANNOT.teal);
      } else text(ctx, '아직', px[1] + P, textY(ay), PAL.dim);
    });
  }
  drawAchv(ctx, ui, tabEnd) {
    const r = this.app.records, lay = achvLayout(), P = PAD_CARD, { medal: MD } = ACHV_GRID;
    const done = ACHIEVEMENTS.filter((a) => achvDone(r, a.id)).length;
    // 받은 수(굵게): 머리줄 오른쪽 끝(탭과 겹치면 쪽 단추 왼쪽)
    const count = `${done} / ${ACHIEVEMENTS.length}`;
    if (tabEnd + SP.m + measure(count, true) <= W - PAGE.titleX) text(ctx, count, W - PAGE.titleX, HEAD_BIG.mid - 5, PAL.dim, { align: 'right', bold: true });
    const pages = lay.pages.length, page = Math.min(this.page || 0, pages - 1);
    for (const c of lay.pages[page]) {
      const a = ACHIEVEMENTS[c.i], got = achvDone(r, a.id), x = c.x, y = c.y, cw = lay.cw, ch = lay.h;
      openBox('card', x, y, cw, ch, P, { name: `업적 ${a.id}` });
      if (!got && a.secret) {
        slot(ctx, x, y, cw, ch);
        text(ctx, '?', x + cw / 2, y + textY((ch - LINE) >> 1), PAL.dimDk, { align: 'center', bold: true });
        closeBox();
        continue;
      }
      if (got) cardBase(ctx, x, y, cw, ch, { edge: PAL.gold });
      else slot(ctx, x, y, cw, ch);
      const ty = y + textY(P);
      medal(ctx, x + P, y + P + ((LINE - MD) >> 1), MD, got);
      // 쌓는 업적은 이름 줄 오른끝에 「N/M」(받은 뒤에도 남긴다)
      if (a.need > 1) text(ctx, `${achvHave(a, r)}/${a.need}`, x + cw - P, ty, got ? PAL.goldDk : PAL.dim, { align: 'right', bold: true });
      text(ctx, a.name, x + P + MD + SP.s, ty, got ? PAL.cardInk : PAL.ink, { bold: true });
      c.cond.forEach((l, k) => text(ctx, l, x + P, ty + LINE + GAP_IN + k * LINE, got ? PAL.cardDim : PAL.dim));
      closeBox();
    }
    if (pages > 1) pageButtons(ctx, ui, 'records', page, pages, (p) => { this.page = p; });
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') this.app.go('title');
    if (k === 'ArrowRight' || k === 'ArrowLeft') { this.tab = this.tab === 'stats' ? 'achv' : 'stats'; this.page = 0; }
  }
}
