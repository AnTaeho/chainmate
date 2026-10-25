// 틀 조각(docs/design-notes/layout.md 「틀 셋」): 멈춤 단추 · 판 밖 머리줄 · 판 틀의 왼쪽 칸.
import { PAL } from '../../render/palette.js';
import { W, text, rect, rrect, measure, box, R_LG } from '../../render/gfx.js';
import { live } from '../../render/look.js';
import { ANTES } from '../../sim/run.js';
import { JOSEKI_BY_ID, TIER_COL } from '../../data/josekis.js';
import { panel, tipLines, optLine, fragmentStrip, wrapName, drawName } from '../parts.js';
import { button, fingerDots, growHit, btnW, buttonRow, toggleGroup, rowWidth } from '../ui.js';
import { familyList, familyMore } from '../parts-depth.js';
import { familyCounts } from '../../data/families.js';
import { LEFT, PAUSE, PAGE, M, PAD_BOX, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, FAM_ROW, FAM_H, BTN_H, SP, flow, rowSpan, textY } from '../frame.js';
import { wrap } from '../../render/text.js';
import { openBox, closeBox, logClip, logHead } from '../../render/layoutlog.js';
import { L as L_ } from '../lang.js';
import { emberMark } from '../ignite.js';
import { moneyShake } from '../juice.js';
import { glowText } from '../../render/light.js';
import { blitVec } from '../../render/vec.js';

// 세력 빛깔을 짙은 판넬 위 글자로 읽히게 조금 밝힌다
export function lightHue(hex, k = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// 멈춤 단추(≡): 마우스 기기는 10×10 그림 · 16×14 구역. 손가락 기기(CHM-52)는 그림을 14×12로 키우고(오른쪽 · 아래로만 — 왼쪽은 정석 표 ·
// 「행마」 · 수업 건너뛰기가 붙어 있다), 누르는 구역은 실제 화면 44pt까지 오른쪽 · 위로 넓힌다(캔버스 밖 여백까지 — main.js가 틀 전체에서 손가락을 받는다).
// 아래는 본 칸 윗변(TOP 22) 앞에서 멈춘다
export function pauseButton(ctx, ui, app, x = PAUSE.x, y = PAUSE.y) {
  const id = 'btn:pause';
  const need = fingerDots(app);
  if (need) {
    const r = growHit(x - 2, y - 2, 18, 18, need, { r: Infinity, u: Infinity, d: 0 });
    ui.region(id, r.x, r.y, r.w, r.h, { onClick: () => app.openOverlay('pause') });
  } else ui.region(id, x - 2, y - 2, 16, 14, { onClick: () => app.openOverlay('pause') });
  const col = ui.isHover(id) ? PAL.gold : PAL.dim;
  // 둥근 끝 막대 셋(안 3 시안)
  if (need) { for (const dy of [1, 6, 11]) rrect(ctx, x + 1, y + dy, 14, 2, 1, col); return; }
  for (const dy of [1, 5, 9]) rrect(ctx, x + 1, y + dy, 10, 2, 1, col);
}

// 판 밖 틀의 머리줄(29절 제목 자리 1): 큰 제목(크림 두 배 굵게, (12, 4)) · 탭은 제목 오른쪽 8 · 보조 글은 오른쪽 끝(W − 12, 흐림).
// 보조 글이 제목 · 탭 오른쪽 8 안에 안 들면 오른쪽 맞춤 두 줄(본문 줄 14 둘 = 큰 제목 높이 28).
// big 없이 부르면 옛 작은 머리줄(금빛 1배 + 가로줄) — 화면 단계에서 모두 big으로 옮긴다.
// tabs: { ui, prefix, list: [[id, 글]], cur, go, min } — 같은 폭 알약(toggleGroup), 단추 id는 `${prefix}:tab:${id}`. 돌려주는 값 { tabEnd }(탭 오른끝, 없으면 제목 끝)
export const HEAD_BIG = { x: PAGE.titleX, y: 4, mid: 15, gap: SP.m };
HEAD_BIG.tabY = HEAD_BIG.mid - (BTN_H >> 1);
export const headW = (title) => measure(title, true) * 2;
export const headTabX = (title) => HEAD_BIG.x + headW(title) + HEAD_BIG.gap;
export function pageHead(ctx, title, right = null, { big = false, tabs = null } = {}) {
  if (big) {
    logHead(title, HEAD_BIG.x, HEAD_BIG.y);
    text(ctx, title, HEAD_BIG.x, HEAD_BIG.y, PAL.ink, { bold: true, scale: 2 });
    let tabEnd = HEAD_BIG.x + headW(title);
    if (tabs) {
      const row = toggleGroup(ctx, tabs.ui, `${tabs.prefix}:tab`, tabs.list, tabs.cur, headTabX(title), HEAD_BIG.tabY, tabs.go, { min: tabs.min ?? 0 });
      tabEnd = row.x + row.w;
    }
    if (right != null) {
      const room = W - PAGE.titleX - tabEnd - HEAD_BIG.gap;
      if (measure(L_(String(right))) <= room) text(ctx, right, W - PAGE.titleX, HEAD_BIG.mid - 5, PAL.dim, { align: 'right' });
      else wrap(right, room).forEach((l, i) => text(ctx, l, W - PAGE.titleX, textY(HEAD_BIG.y + i * LINE), PAL.dim, { align: 'right' }));
    }
    return { tabEnd };
  }
  text(ctx, title, PAGE.titleX, PAGE.titleY, PAL.gold, { bold: true });
  if (right != null) text(ctx, right, W - PAGE.titleX, PAGE.titleY, PAL.dim, { align: 'right' });
  rect(ctx, 8, PAGE.ruleY, W - 16, 1, PAL.feltHi);
  return { tabEnd: PAGE.titleX + measure(title, true) };
}
// 머리줄 탭 줄 폭(제목 옆에 들어가는지 미리 잴 때)
export const headTabsW = (list, min = 0) => rowWidth(list.map(([, label]) => ({ label })), { gap: SP.s, min }).w;

// 판 밖 틀의 맨 아래 단추 줄(29절): 「뒤로」 (12, 244) 폭 80, 주 단추는 오른쪽 끝(W − 12 − 폭), 그 사이 단추(extras)는 「뒤로」 오른쪽 8부터 같은 폭 · 사이 8.
// 단추마다 { id, label, onClick, tone, enabled, tip }. back의 label을 안 주면 「뒤로」. 돌려주는 값 { back, primary, extras }(네모)
export function bottomBar(ctx, ui, { back = null, primary = null, extras = [] } = {}) {
  const y = PAGE.btnY, out = { back: null, primary: null, extras: [] };
  if (back) {
    const { id, label = '뒤로', ...o } = back;
    button(ctx, ui, id, PAGE.titleX, y, PAGE.backW, BTN_H, label, o);
    out.back = { x: PAGE.titleX, y, w: PAGE.backW, h: BTN_H };
  }
  if (primary) {
    const { id, label, w, ...o } = primary;
    const pw = w ?? btnW(label, { icon: !!o.icon });
    const px = W - PAGE.titleX - pw;
    button(ctx, ui, id, px, y, pw, BTN_H, label, o);
    out.primary = { x: px, y, w: pw, h: BTN_H };
  }
  if (extras.length) out.extras = buttonRow(ctx, ui, extras, PAGE.titleX + (back ? PAGE.backW + PAGE.gap : 0), y).rects;
  return out;
}

// 막간 상자(29절 제목 자리 3 — 보상 · 결과 · 상자 · 전설 · 각성 · 멈춤): 안 위 12에 두 배 제목 가운데(줄 28),
// 본문은 제목 아래 12, 단추 줄은 안 아래 12에 가운데 한 줄(같은 폭 · 사이 8). bodyH: 본문 높이, buttons: 단추가 있는지
export const INTER = { pad: SP.l, titleH: 28, gap: SP.l };
export function interludeLayout(bodyH, { title = true, buttons = true } = {}) {
  const P = INTER.pad;
  let y = P;
  const titleY = title ? y + ((INTER.titleH - 22) >> 1) : null;
  if (title) y += INTER.titleH + INTER.gap;
  const bodyY = y;
  y += bodyH;
  const btnY = buttons ? y + (bodyH > 0 ? INTER.gap : 0) : null;
  if (buttons) y = btnY + BTN_H;
  return { titleY, bodyY, btnY, h: y + P };
}
// 막간 상자를 (x, y) 폭 w로 그린다(높이는 interludeLayout으로). body(ctx, x, y, w)가 본문을 그린다(안 여백 pad 안쪽 폭).
// opts: { title, titleCol(기본 크림 — 이기고 지는 막간만 금빛 · 붉은), fill, edge, buttons: [{ id, label, ... }], name }
export function interlude(ctx, ui, x, y, w, bodyH, body = null, { title = null, titleCol = PAL.ink, fill = PAL.feltDk, edge = PAL.frameDk, buttons = [], name = '막간 상자' } = {}) {
  const lay = interludeLayout(bodyH, { title: !!title, buttons: buttons.length > 0 });
  const P = INTER.pad;
  openBox('panel', x, y, w, lay.h, P, { name });
  box(ctx, x, y, w, lay.h, fill, edge, { r: R_LG });
  if (title) text(ctx, title, x + Math.floor(w / 2), y + lay.titleY, titleCol, { align: 'center', bold: true, scale: 2 });
  if (body) body(ctx, x + P, y + lay.bodyY, w - P * 2);
  if (buttons.length) buttonRow(ctx, ui, buttons, x + Math.floor(w / 2), y + lay.btnY, { anchor: 'center' });
  closeBox();
  return { x, y, w, h: lay.h, ...lay };
}

// 관 줄(머리 칸 첫 줄): 「3/8관」 · 끝없는 대국은 「9관」
export const hallText = (run) => (run && !run.endless ? `${run.ante}/${ANTES}관` : `${run ? run.ante : 1}관`);

// ── 판 틀의 왼쪽 칸 쌓기(docs/design-notes/layout.md 「왼쪽 칸」): 판넬마다 내용에 맞춘 높이(hug).
// 머리 칸은 위(y 8)에서부터, 아래 칸(상금 · 덱 — 대국은 그 위에 수 · 희생)은 아래(y 262)에서부터 쌓고,
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
// 판 틀의 왼쪽 칸(대국 말고): 머리 칸(관 · 화면 이름) · 짜임 칸(시너지 · 정석) · 아래 칸(상금 · 덱).
// 모두 가리키면 말풍선이 뜨는 것뿐이고 누를 것은 없다 — 이 칸이 판 틀의 설명 자리다(placement.js 'side').
// 시계(밤샘 2 D1): 판의 목숨. 칸마다 작은 둥근 시계 판(9×9 — 안 3 시안의 크림 판 · 잉크 테 · 바늘 둘), 잃은 칸은 빈 자리 빛깔로 꺼진다.
// 잃는 순간(app.clockFx)에는 그 칸이 붉게 깜빡이며 금이 간다. 오른쪽 끝(x2)에 붙인다. 모양마다 한 번 굽는다(vec.js blitVec)
const DIAL_FACE = { alive: [PAL.card, PAL.frameDk], lost: [PAL.slot, PAL.slotEdge], blink: [PAL.red, PAL.redDk] };
function dialPaint(state, crack) {
  return (g, k) => {
    const [face, rim] = DIAL_FACE[state], lw = Math.max(1, 1 / k);
    g.beginPath(); g.arc(4.5, 4.5, 4.5, 0, Math.PI * 2); g.fillStyle = rim; g.fill();
    g.beginPath(); g.arc(4.5, 4.5, 4.5 - lw, 0, Math.PI * 2); g.fillStyle = face; g.fill();
    if (state !== 'lost') {
      g.strokeStyle = state === 'blink' ? PAL.white : PAL.frameDk; g.lineWidth = Math.max(1 / k, 0.9); g.lineCap = 'round';
      g.beginPath(); g.moveTo(4.5, 2); g.lineTo(4.5, 4.5); g.lineTo(6.6, 4.5); g.stroke();
    }
    if (crack) { g.strokeStyle = PAL.red; g.lineWidth = Math.max(1 / k, 0.8); g.lineJoin = 'round'; g.beginPath(); g.moveTo(2, 1.6); g.lineTo(3.6, 3.8); g.lineTo(3, 5); g.lineTo(5.6, 7.6); g.stroke(); }
  };
}
export function clockPips(ctx, run, x2, ty, time = 0, fx = null) {
  const max = run.clockMax || run.clock || 0;
  const step = 11;
  for (let i = 0; i < max; i++) {
    const x = x2 - (max - i) * step + 2, y = ty + 1;
    const alive = i < run.clock;
    const breaking = fx && fx.idx === i && fx.t < 2.0;
    if (breaking) live();
    const blink = breaking && Math.floor(fx.t * 10) % 2;
    const state = blink ? 'blink' : alive || breaking ? 'alive' : 'lost';
    const crack = !!(breaking && fx.t > 0.5);
    blitVec(ctx, `dial:${state}:${crack ? 1 : 0}:${DIAL_FACE[state].join()}`, x, y, 9, 9, dialPaint(state, crack));
  }
}
export const clockTip = (run) => tipLines('시계', [`${run.clock} / ${run.clockMax || run.clock}`, '대국을 지면 한 칸을 잃고 다음 대국으로 가요', '다 잃으면 판이 끝나요']);
// 아래 칸의 시계 줄(대국 · 판 틀 왼쪽 칸 공통)
export const clockRow = (app, run) => ({ id: 'clock', label: '시계', tip: () => clockTip(run), draw: (ctx2, ty) => { text(ctx2, '시계', LEFT.x + PAD_BOX, ty, PAL.dim); clockPips(ctx2, run, LEFT.x + LEFT.w - PAD_BOX, ty, app.time, app.clockFx); } });
export const hasClock = (run) => !!run && !run.scratch && (run.clockMax || 0) > 0;

const JS_IND = 6; // 두 줄 레퍼토리 이름의 둘째 줄 들임
export function runSide(ctx, ui, app, title) {
  const run = app.run;
  const L = LEFT.x, LW = LEFT.w, P = PAD_BOX;
  const clock = hasClock(run);
  // 화면 이름은 두 줄까지(낱말 단위 — 영어 「Engraving Bundle」), 머리 칸은 그 줄 수로 hug
  const tn = wrapName(title, LW - P * 2);
  const head = headLayout(tn ? tn.lines.length : 1, 0), foot = footLayout(clock ? 3 : 2);
  const st = sideStack(head.h, foot.h);
  openBox('panel', L, st.head.y, LW, head.h, P, { name: '머리 칸' });
  panel(ctx, L, st.head.y, LW, head.h);
  ui.sideItem(L, st.head.y, LW, head.h, { rows: [rowSpan(st.head.y + head.kicker), ...head.titles.map((t) => rowSpan(st.head.y + t, LINE_TITLE))] });
  text(ctx, hallText(run), L + P, st.head.y + head.kicker, PAL.dim);
  // 점화(CHM-67): 관 줄 옆에 불씨 — 가리키면 이 판의 콤비네이션
  if (run.ignite && !run.scratch) emberMark(ctx, ui, run.ignite, L + P + measure(hallText(run)) + 4, st.head.y + head.kicker);
  drawName(ctx, title, tn, L + P, head.titles.map((t) => st.head.y + t), LW - P * 2, PAL.gold);
  closeBox();
  // 짜임 칸: 시너지(이름표 → 세로 칩) → 묶음 틈 → 정석(이름표 → 이름 줄). 칸은 머리 칸과 아래 칸 사이
  const { y: top, h: midH } = st.mid;
  openBox('panel', L, top, LW, midH, P, { name: '짜임 칸' });
  panel(ctx, L, top, LW, midH);
  const rows = ui.sideItem(L, top, LW, midH, { rows: [] }).rows;
  const js = run.josekis || [];
  const labelH = LINE + GAP_IN;
  // 레퍼토리 이름도 두 줄까지(영어 「Stepping Stones」) — 줄마다 본문 줄 하나. 둘째 줄은 JS_IND만큼 들여 다음 이름과 갈린다
  const jn = js.map((id) => { const q = wrapName(JOSEKI_BY_ID[id].name, LW - P * 2); return q && q.lines.length > 1 ? wrapName(JOSEKI_BY_ID[id].name, LW - P * 2 - JS_IND) : q; });
  const jsLines = jn.reduce((n, q) => n + (q ? q.lines.length : 1), 0);
  let jsH = js.length ? GAP_GROUP + labelH + jsLines * LINE : 0;
  const famRows = Math.max(0, Math.floor((midH - P * 2 - labelH - jsH) / FAM_ROW));
  // 시너지 이름표 줄이 모자라면 레퍼토리 이름표 → 이름 사이 틈을 접는다(영어 두 줄 머리 칸 + 레퍼토리 넷 줄)
  const jsIn = js.length && !famRows && midH - P * 2 - jsH < LINE ? 0 : GAP_IN;
  jsH -= GAP_IN - jsIn;
  const f = flow(top + P);
  if (famRows && familyCount(run)) {
    const ly = f.line();
    f.gap(GAP_IN);
    const shown = familyList(ctx, ui, run, L + P, f.y, LW - P * 2, famRows, { time: app.time, fx: app.screen && app.screen.famFx });
    text(ctx, '시너지', L + P, ly, PAL.dim);
    rows.push(rowSpan(ly));
    for (let k = 0; k < shown; k++) rows.push([f.y + k * FAM_ROW, f.y + k * FAM_ROW + FAM_H]);
    f.space(shown * FAM_ROW - (FAM_ROW - FAM_H));
  } else if (familyCount(run) && midH - P * 2 - jsH >= LINE) {
    // 칩 줄이 하나도 안 들어가면(두 줄 머리 칸 · 두 줄 레퍼토리 이름 · 레퍼토리 셋 — CHM-46) 이름표 줄 오른쪽에 「+N」 — 가리키면 시너지 전부
    const ly = f.line();
    text(ctx, '시너지', L + P, ly, PAL.dim);
    familyMore(ctx, ui, run, L + P + measure('시너지') + 4, ly);
    rows.push(rowSpan(ly));
  }
  if (js.length) {
    f.gap(GAP_GROUP);
    const jy = f.line();
    text(ctx, '레퍼토리', L + P, jy, PAL.dim);
    rows.push(rowSpan(jy));
    f.gap(jsIn);
    js.forEach((id, k) => {
      const j = JOSEKI_BY_ID[id], n = jn[k] ? jn[k].lines.length : 1;
      const top1 = f.y, ys = [];
      for (let q = 0; q < n; q++) { rows.push([f.y, f.y + LINE]); ys.push(f.line()); }
      ui.region(`joseki:${id}`, L + 4, top1, LW - 8, n * LINE, { tip: () => tipLines(j.name, [j.text, j.more], 150, j.families.length ? [optLine({ chips: j.families })] : []) });
      const col = ui.isHover(`joseki:${id}`) ? PAL.goldHi : TIER_COL[j.tier];
      if (n > 1) { if (jn[k].thin) logClip('thin', L_(j.name), L_(j.name), LW - P * 2 - JS_IND); jn[k].lines.forEach((l, q) => text(ctx, l, L + P + (q ? JS_IND : 0), ys[q], col, { bold: !jn[k].thin })); }
      else drawName(ctx, j.name, jn[k], L + P, ys, LW - P * 2, col);
    });
  }
  closeBox();
  drawFoot(ctx, ui, [...(clock ? [clockRow(app, run)] : []), { money: run }, { label: '덱', val: `${run.deck.length}` }]);
}

// 탭 줄(도감 · 행마 보기): 이름마다 글에 맞춘 폭(글과 테 사이 3 — 굵은 글꼴이 테에 붙어 보이지 않게, 가장 좁아도 44), 사이 4, 고른 탭은 금빛. 끝난 x를 돌려준다
// pad: 글 양옆 여백 합(기본 8 — 큰 제목 옆 탭은 알약 끝이 글에 붙지 않게 넓힌다)
export function tabRow(ctx, ui, prefix, tabs, cur, x, y, h, go, pad = 8) {
  for (const [id, label] of tabs) {
    const tw = Math.max(44, measure(label, true) + pad);
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
  // 상금이 바뀌면(벌기 · 쓰기 · 동전이 닿음) 수가 좌우로 흔들리고 빛이 번진다(juice.js moneyShake — 움직임 줄이기면 빛만)
  const sh = ui ? moneyShake(run.money, ui.time, run) : null;
  if (sh) { const aw = measure(amt, true); glowText(ctx, L + LW - P - aw, ty, aw, 12, sh.up ? PAL.goldHi : PAL.red, 0.7 * sh.hot, 7); }
  text(ctx, amt, L + LW - P + (sh ? sh.dx : 0), ty, sh && sh.hot > 0.6 ? (sh.up ? PAL.white : PAL.red) : PAL.gold, { align: 'right', bold: true });
}
