// 틀 조각(docs/design-notes/layout.md 「틀 셋」): 멈춤 단추 · 판 밖 머리줄 · 판 틀의 왼쪽 칸.
import { PAL } from '../../render/palette.js';
import { W, text, rect, measure } from '../../render/gfx.js';
import { ANTES } from '../../sim/run.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { panel, tipLines, fragmentStrip, fitText } from '../parts.js';
import { button } from '../ui.js';
import { familyList } from '../parts-depth.js';
import { LEFT, PAUSE, PAGE, SIDE_ROWS, PAD_BOX, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, FAM_ROW, ROW_TEXT } from '../frame.js';

export function pauseButton(ctx, ui, app, x = PAUSE.x, y = PAUSE.y) {
  const id = 'btn:pause';
  ui.region(id, x - 2, y - 2, 16, 14, { onClick: () => app.openOverlay('pause') });
  const col = ui.isHover(id) ? PAL.gold : PAL.dim;
  rect(ctx, x + 1, y + 1, 10, 2, col); rect(ctx, x + 1, y + 5, 10, 2, col); rect(ctx, x + 1, y + 9, 10, 2, col);
}

// 판 밖 틀의 머리줄: 왼쪽 제목(금빛 굵게) · 오른쪽 보조 글(흐림) · 가로줄
export function pageHead(ctx, title, right = null) {
  text(ctx, title, PAGE.titleX, PAGE.titleY, PAL.gold, { bold: true });
  if (right != null) text(ctx, right, W - PAGE.titleX, PAGE.titleY, PAL.dim, { align: 'right' });
  rect(ctx, 8, PAGE.ruleY, W - 16, 1, PAL.feltHi);
}

// 관 줄(머리 칸 첫 줄): 「3/8관」 · 끝없는 대국은 「9관」
export const hallText = (run) => (run && !run.endless ? `${run.ante}/${ANTES}관` : `${run ? run.ante : 1}관`);

// 판 틀의 왼쪽 칸(대국 말고): 머리 칸(관 · 화면 이름) · 짜임 칸(시너지 · 정석 · 명국 조각) · 상금 · 주머니.
// 모두 가리키면 말풍선이 뜨는 것뿐이고 누를 것은 없다 — 이 칸이 판 틀의 설명 자리다(placement.js 'side').
export function runSide(ctx, ui, app, title) {
  const run = app.run;
  const L = LEFT.x, LW = LEFT.w;
  const P = PAD_BOX.panel;
  panel(ctx, L, SIDE_ROWS.head, LW, SIDE_ROWS.headH);
  text(ctx, hallText(run), L + P, SIDE_ROWS.head + PAD_BOX.top, PAL.dim);
  fitText(ctx, title, L + P, SIDE_ROWS.head + PAD_BOX.top + LINE.body + GAP_IN.head, LW - P * 2, PAL.gold);
  // 짜임 칸: 시너지(세로 칩) → 정석 이름. 칸은 머리 칸과 상금 칸 사이(판넬 사이 틈 GAP_GROUP.side)
  const { top, end } = buildBox();
  panel(ctx, L, top, LW, end - top);
  let y = top + PAD_BOX.build;
  const js = run.josekis || [];
  const labelH = LINE_TITLE.label + GAP_IN.label;
  const jsH = js.length ? labelH + js.length * LINE.body + GAP_GROUP.build : 0;
  const famRows = Math.max(0, Math.floor((end - PAD_BOX.build - jsH - (y + labelH)) / FAM_ROW));
  const shown = familyList(ctx, ui, run, L + P, y + labelH, LW - P * 2, famRows, { time: app.time, fx: app.screen && app.screen.famFx });
  if (shown) { text(ctx, '시너지', L + P, y, PAL.dim); y += labelH + shown * FAM_ROW + GAP_GROUP.build; }
  if (js.length) {
    text(ctx, '정석', L + P, y, PAL.dim);
    y += labelH;
    js.forEach((id) => {
      const j = JOSEKI_BY_ID[id];
      ui.region(`joseki:${id}`, L + 4, y - 1, LW - 8, 13, { tip: () => tipLines(j.name, [j.text, j.more], 150, j.families.length ? [{ chips: j.families }] : []) });
      fitText(ctx, j.name, L + P, y, LW - P * 2, ui.isHover(`joseki:${id}`) ? PAL.goldHi : TIER_COL[j.tier]);
      y += LINE.body;
    });
  }
  // 상금 · 주머니(대국과 같은 자리)
  moneyPanel(ctx, ui, run);
  panel(ctx, L, SIDE_ROWS.bag, LW, SIDE_ROWS.rowH);
  text(ctx, '주머니', L + P, SIDE_ROWS.bag + ROW_TEXT, PAL.dim);
  text(ctx, `${run.deck.length}`, L + LW - P, SIDE_ROWS.bag + ROW_TEXT, PAL.ink, { align: 'right' });
}

// 짜임 칸 자리: 머리 칸 아래 ~ 상금 칸 위(판넬 사이 틈만큼 띄운다)
export const buildBox = () => ({ top: SIDE_ROWS.head + SIDE_ROWS.headH + GAP_GROUP.side, end: SIDE_ROWS.money - GAP_GROUP.side });

// 판 밖 틀의 쪽 넘기기: 맨 아래 단추 줄 오른쪽(‹ · 쪽 · ›)
export function pageButtons(ctx, ui, prefix, page, pages, go) {
  const x = W - PAGE.titleX - 112;
  button(ctx, ui, `${prefix}:prev`, x, PAGE.btnY, 36, PAGE.btnH, '‹', { enabled: page > 0, onClick: () => go(page - 1) });
  text(ctx, `${page + 1}/${pages}`, x + 56, PAGE.btnY + 3, PAL.dim, { align: 'center' });
  button(ctx, ui, `${prefix}:next`, x + 76, PAGE.btnY, 36, PAGE.btnH, '›', { enabled: page < pages - 1, onClick: () => go(page + 1) });
}

// 상금 칸(판 틀 왼쪽 칸 · 대국과 같은 자리): 「상금」 · 모은 명국 조각(들어가는 만큼) · 금액
export function moneyPanel(ctx, ui, run) {
  const L = LEFT.x, LW = LEFT.w, y = SIDE_ROWS.money;
  panel(ctx, L, y, LW, SIDE_ROWS.rowH);
  const P = PAD_BOX.panel, ty = y + ROW_TEXT;
  text(ctx, '상금', L + P, ty, PAL.dim);
  const amt = `$${run.money}`;
  const fx = L + P + measure('상금') + 4;
  fragmentStrip(ctx, ui, run, fx, ty, { max: Math.floor((L + LW - P - measure(amt, true) - 3 - fx) / 13), step: 13 });
  text(ctx, amt, L + LW - P, ty, PAL.gold, { align: 'right', bold: true });
}
