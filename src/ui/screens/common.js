// 틀 조각(docs/design-notes/layout.md 「틀 셋」): 멈춤 단추 · 판 밖 머리줄 · 판 틀의 왼쪽 칸.
import { PAL } from '../../render/palette.js';
import { W, text, rect, measure } from '../../render/gfx.js';
import { ANTES } from '../../sim/run.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { panel, tipLines, optLine, fragmentStrip, fitText } from '../parts.js';
import { button } from '../ui.js';
import { familyList } from '../parts-depth.js';
import { familyCounts } from '../../data/families.js';
import { LEFT, PAUSE, PAGE, M, PAD_BOX, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, FAM_ROW, FAM_H, flow, rowSpan } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

// 세력 빛깔을 짙은 판넬 위 글자로 읽히게 조금 밝힌다
export function lightHue(hex, k = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

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

// ── 판 틀의 왼쪽 칸 쌓기(docs/design-notes/layout.md 「왼쪽 칸」): 판넬마다 내용에 맞춘 높이(hug).
// 머리 칸은 위(y 8)에서부터, 아래 칸(상금 · 주머니 — 대국은 그 위에 수 · 희생)은 아래(y 262)에서부터 쌓고,
// 가운데 칸(짜임 칸 · 대국의 사슬 칸)이 남는 높이를 가진다. 판넬 사이는 GAP_GROUP.
export const SIDE = { top: M, bottom: 270 - M };
// 머리 칸: 머릿말(관) → 묶음 안 틈 → 제목(화면 이름, 제목 줄 · 줄 수 titleLines) → [묶음 틈 → 본문 줄 rows개]
export function headLayout(titleLines = 1, rows = 0) {
  const f = flow(PAD_BOX);
  const kicker = f.line();
  f.gap(GAP_IN);
  const titles = f.lines(titleLines, true);
  let body = [];
  if (rows) { f.gap(GAP_GROUP); body = f.lines(rows); }
  return { kicker, titles, rows: body, h: f.y + PAD_BOX };
}
// 아래 칸: 본문 줄 n개(이름표 왼쪽 · 값 오른쪽)
export function footLayout(n) {
  const f = flow(PAD_BOX);
  const rows = [];
  for (let i = 0; i < n; i++) { const top = f.y; rows.push({ top, y: f.line() }); }
  return { rows, h: f.y + PAD_BOX };
}
// 세 칸의 자리: head · foot 높이를 받아 { head, mid, foot } 네모(y · h)
export function sideStack(headH, footH) {
  const head = { y: SIDE.top, h: headH };
  const foot = { y: SIDE.bottom - footH, h: footH };
  const midY = head.y + head.h + GAP_GROUP;
  return { head, foot, mid: { y: midY, h: foot.y - GAP_GROUP - midY } };
}
// 명국 조각이 날아드는 곳: 아래 칸의 상금 줄(끝에서 둘째 줄) 조각 자리
export const shardTo = () => ({ x: LEFT.x + 44, y: SIDE.bottom - PAD_BOX - LINE * 2 + 6 });

// 판넬 한 줄: 이름표(흐림) 왼쪽 · 값 오른쪽
function rowText(ctx, label, val, y, { valCol = PAL.ink, bold = false } = {}) {
  const L = LEFT.x, LW = LEFT.w, P = PAD_BOX;
  text(ctx, label, L + P, y, PAL.dim);
  if (val != null) text(ctx, val, L + LW - P, y, valCol, { align: 'right', bold });
}
// 아래 칸 그리기. rows: [{ id?, label, val, tip?, money?: run }] — money 줄은 「상금」 · 명국 조각 · 금액
export function drawFoot(ctx, ui, rows, name = '아래 칸') {
  const lay = footLayout(rows.length);
  const L = LEFT.x, LW = LEFT.w, y0 = SIDE.bottom - lay.h, P = PAD_BOX;
  openBox('panel', L, y0, LW, lay.h, P, { name });
  panel(ctx, L, y0, LW, lay.h);
  ui.sideItem(L, y0, LW, lay.h, { rows: lay.rows.map((q) => [y0 + q.top, y0 + q.top + LINE]) });
  rows.forEach((r, i) => {
    const { top, y } = lay.rows[i];
    const ry = y0 + top, ty = y0 + y;
    if (r.id) ui.region(r.id, L, i ? ry : y0, LW, (i === rows.length - 1 ? y0 + lay.h : ry + LINE) - (i ? ry : y0), { tip: r.tip });
    if (r.money) { moneyRow(ctx, ui, r.money, ty); return; }
    if (r.draw) { r.draw(ctx, ty); return; }
    rowText(ctx, r.label, r.val, ty, r);
  });
  closeBox();
  return { y: y0, h: lay.h, rows: lay.rows.map((q) => y0 + q.top) };
}

const familyCount = (run) => Object.values(familyCounts(run)).filter((n) => n > 0).length;
// 판 틀의 왼쪽 칸(대국 말고): 머리 칸(관 · 화면 이름) · 짜임 칸(시너지 · 정석) · 아래 칸(상금 · 주머니).
// 모두 가리키면 말풍선이 뜨는 것뿐이고 누를 것은 없다 — 이 칸이 판 틀의 설명 자리다(placement.js 'side').
// 시계(밤샘 2 D1): 판의 목숨. 칸마다 작은 시계 판(9×9) — 남은 칸은 상아 판에 먹 바늘, 잃은 칸은 어둡게 꺼진다.
// 잃는 순간(app.clockFx)에는 그 칸이 붉게 깜빡이며 금이 간다. 오른쪽 끝(x2)에 붙인다.
// 시안(docs/shots/night2/draft-*): 1 시계 판(고름) · 2 숫자 「2 / 3」 · 3 수 · 희생(옛 버리기)과 같은 네모 구슬
const DIAL = ['..#####..', '.#.....#.', '#...#...#', '#...#...#', '#...##..#', '#.......#', '#.......#', '.#.....#.', '..#####..'];
export function clockPips(ctx, run, x2, ty, time = 0, fx = null) {
  const max = run.clockMax || run.clock || 0;
  const step = 11;
  for (let i = 0; i < max; i++) {
    const x = x2 - (max - i) * step + 2, y = ty + 1;
    const alive = i < run.clock;
    const breaking = fx && fx.idx === i && fx.t < 2.0;
    const blink = breaking && Math.floor(fx.t * 10) % 2;
    const rim = blink ? PAL.red : alive ? PAL.goldDk : PAL.frame;
    const face = blink ? PAL.redDk : alive ? PAL.ink : PAL.feltDk;
    DIAL.forEach((row, j) => { for (let k = 0; k < 9; k++) {
      const inside = j > 0 && j < 8 && k > 0 && k < 8 && !(row[k] === '#' && (j === 0 || j === 8 || k === 0 || k === 8));
      if ((j === 0 || j === 8 || k === 0 || k === 8 || (j === 1 && (k === 1 || k === 7)) || (j === 7 && (k === 1 || k === 7))) && row[k] === '#') rect(ctx, x + k, y + j, 1, 1, rim);
      else if (inside && row[k] === '#') rect(ctx, x + k, y + j, 1, 1, alive || breaking ? PAL.frameDk : PAL.frame);
      else if (inside && row[k] === '.' && !((j === 1 || j === 7) && (k === 1 || k === 7))) rect(ctx, x + k, y + j, 1, 1, face);
    } });
    if (breaking && fx.t > 0.5) { rect(ctx, x + 2, y + 2, 1, 1, PAL.red); rect(ctx, x + 3, y + 3, 1, 1, PAL.red); rect(ctx, x + 5, y + 5, 1, 1, PAL.red); rect(ctx, x + 6, y + 6, 1, 1, PAL.red); }
  }
}
export const clockTip = (run) => tipLines('시계', [`${run.clock} / ${run.clockMax || run.clock}`, '대국을 지면 한 칸을 잃고 다음 대국으로 간다', '다 잃으면 판이 끝난다']);
// 아래 칸의 시계 줄(대국 · 판 틀 왼쪽 칸 공통)
export const clockRow = (app, run) => ({ id: 'clock', label: '시계', tip: () => clockTip(run), draw: (ctx2, ty) => { text(ctx2, '시계', LEFT.x + PAD_BOX, ty, PAL.dim); clockPips(ctx2, run, LEFT.x + LEFT.w - PAD_BOX, ty, app.time, app.clockFx); } });
export const hasClock = (run) => !!run && !run.scratch && (run.clockMax || 0) > 0;

export function runSide(ctx, ui, app, title) {
  const run = app.run;
  const L = LEFT.x, LW = LEFT.w, P = PAD_BOX;
  const clock = hasClock(run);
  const head = headLayout(1, 0), foot = footLayout(clock ? 3 : 2);
  const st = sideStack(head.h, foot.h);
  openBox('panel', L, st.head.y, LW, head.h, P, { name: '머리 칸' });
  panel(ctx, L, st.head.y, LW, head.h);
  ui.sideItem(L, st.head.y, LW, head.h, { rows: [rowSpan(st.head.y + head.kicker), rowSpan(st.head.y + head.titles[0], LINE_TITLE)] });
  text(ctx, hallText(run), L + P, st.head.y + head.kicker, PAL.dim);
  fitText(ctx, title, L + P, st.head.y + head.titles[0], LW - P * 2, PAL.gold);
  closeBox();
  // 짜임 칸: 시너지(이름표 → 세로 칩) → 묶음 틈 → 정석(이름표 → 이름 줄). 칸은 머리 칸과 아래 칸 사이
  const { y: top, h: midH } = st.mid;
  openBox('panel', L, top, LW, midH, P, { name: '짜임 칸' });
  panel(ctx, L, top, LW, midH);
  const rows = ui.sideItem(L, top, LW, midH, { rows: [] }).rows;
  const js = run.josekis || [];
  const labelH = LINE + GAP_IN;
  const jsH = js.length ? GAP_GROUP + labelH + js.length * LINE : 0;
  const famRows = Math.max(0, Math.floor((midH - P * 2 - labelH - jsH) / FAM_ROW));
  const f = flow(top + P);
  if (famRows && familyCount(run)) {
    const ly = f.line();
    f.gap(GAP_IN);
    const shown = familyList(ctx, ui, run, L + P, f.y, LW - P * 2, famRows, { time: app.time, fx: app.screen && app.screen.famFx });
    text(ctx, '시너지', L + P, ly, PAL.dim);
    rows.push(rowSpan(ly));
    for (let k = 0; k < shown; k++) rows.push([f.y + k * FAM_ROW, f.y + k * FAM_ROW + FAM_H]);
    f.space(shown * FAM_ROW - (FAM_ROW - FAM_H));
  }
  if (js.length) {
    f.gap(GAP_GROUP);
    const jy = f.line();
    text(ctx, '레퍼토리', L + P, jy, PAL.dim);
    rows.push(rowSpan(jy));
    f.gap(GAP_IN);
    js.forEach((id) => {
      const j = JOSEKI_BY_ID[id];
      const top1 = f.y, ty = f.line();
      rows.push([top1, top1 + LINE]);
      ui.region(`joseki:${id}`, L + 4, top1, LW - 8, LINE, { tip: () => tipLines(j.name, [j.text, j.more], 150, j.families.length ? [optLine({ chips: j.families })] : []) });
      fitText(ctx, j.name, L + P, ty, LW - P * 2, ui.isHover(`joseki:${id}`) ? PAL.goldHi : TIER_COL[j.tier]);
    });
  }
  closeBox();
  drawFoot(ctx, ui, [...(clock ? [clockRow(app, run)] : []), { money: run }, { label: '주머니', val: `${run.deck.length}` }]);
}

// 탭 줄(도감 · 행마 보기): 이름마다 글에 맞춘 폭(글과 테 사이 2 이상, 가장 좁아도 44), 사이 4, 고른 탭은 금빛. 끝난 x를 돌려준다
export function tabRow(ctx, ui, prefix, tabs, cur, x, y, h, go) {
  for (const [id, label] of tabs) {
    const tw = Math.max(44, measure(label, true) + 6);
    button(ctx, ui, `${prefix}:tab:${id}`, x, y, tw, h, label, { tone: cur === id ? 'gold' : 'plain', onClick: () => go(id) });
    x += tw + 4;
  }
  return x - 4;
}

// 판 밖 틀의 쪽 넘기기: 맨 아래 단추 줄 오른쪽(‹ · 쪽 · ›)
export function pageButtons(ctx, ui, prefix, page, pages, go) {
  const x = W - PAGE.titleX - 112;
  button(ctx, ui, `${prefix}:prev`, x, PAGE.btnY, 36, PAGE.btnH, '‹', { enabled: page > 0, onClick: () => go(page - 1) });
  text(ctx, `${page + 1}/${pages}`, x + 56, PAGE.btnY + 3, PAL.dim, { align: 'center' });
  button(ctx, ui, `${prefix}:next`, x + 76, PAGE.btnY, 36, PAGE.btnH, '›', { enabled: page < pages - 1, onClick: () => go(page + 1) });
}

// 상금 줄(아래 칸 안): 「상금」 · 모은 명국 조각(들어가는 만큼) · 금액. ty는 글 y
export function moneyRow(ctx, ui, run, ty) {
  const L = LEFT.x, LW = LEFT.w, P = PAD_BOX;
  text(ctx, '상금', L + P, ty, PAL.dim);
  const amt = `$${run.money}`;
  const fx = L + P + measure('상금') + 4;
  fragmentStrip(ctx, ui, run, fx, ty + 1, { max: Math.floor((L + LW - P - measure(amt, true) - 3 - fx) / 13), step: 13 });
  text(ctx, amt, L + LW - P, ty, PAL.gold, { align: 'right', bold: true });
}
