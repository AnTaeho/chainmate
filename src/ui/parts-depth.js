// 깊이 층의 화면 조각: 시너지(옛 가족) 문양 · 칩 · 띠(켜진 시너지와 다음 문턱) · 문턱을 넘는 순간.
import { PAL } from '../render/palette.js';
import { rect, text, box, frame, measure } from '../render/gfx.js';
import { FAMILIES, FAMILY_BY_ID, THRESHOLDS, familyCounts, levelOf, setName } from '../data/families.js';
import { tipLines } from './parts.js';
import { L } from './lang.js';
import { JOSEKI_BY_ID, TIER_COL } from '../data/josekis.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { wrap } from '../render/text.js';
import { CHIP_H, CHIP_ROW, FAM_H, FAM_ROW, CHIP_PAD, LIST_GAP, inkY } from './frame.js';
import { openBox, closeBox } from '../render/layoutlog.js';

// 5×5 문양
const GLYPH = {
  leap: ['.##..', '#..#.', '#...#', '....#', '...##'],
  line: ['..#..', '..##.', '#####', '..##.', '..#..'],
  diag: ['##...', '.##..', '..##.', '...##', '....#'],
  change: ['###..', '#....', '#.#.#', '....#', '..###'],
  sacrifice: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  crown: ['#.#.#', '#####', '#####', '.....', '#####'],
  march: ['..#..', '.###.', '..#..', '.###.', '#####'],
  hunt: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  counter: ['.#...', '##...', '#####', '.#..#', '...##'],
  ambush: ['.###.', '#.#.#', '#####', '.#.#.', '#.#.#'],
};
export function familyGlyph(ctx, id, x, y, col = null, scale = 1) {
  const rows = GLYPH[id];
  if (!rows) return;
  const c = col || FAMILY_BY_ID[id].col;
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') rect(ctx, x + i * scale, y + j * scale, scale, scale, c); });
}
// 문양 여럿을 나란히(상점 카드 귀퉁이)
export function familyGlyphs(ctx, ids, x, y, { dark = true } = {}) {
  ids.forEach((id, k) => {
    if (dark) rect(ctx, x + k * 8 - 1, y - 1, 7, 7, '#1b2b27');
    familyGlyph(ctx, id, x + k * 8, y);
  });
}

export function familyTip(id, n, drop = 0) {
  const f = FAMILY_BY_ID[id];
  const lines = [];
  // 문턱과 효과: 「2개: …」. 효과 글에 「 · 」가 들어 있어 영어로 옮길 때 쪼개지지 않게 먼저 옮긴다
  THRESHOLDS.forEach((th, i) => lines.push([`${L(`${Math.max(1, th - drop)}개`)}: ${L(f.text[i])}`, n >= th - drop ? PAL.goldDk : PAL.cardDim]));
  return tipLines(`${setName(id)} ${n}`, [], 200, lines);
}

// 「+N」 말풍선: 줄에 못 놓은 시너지 전부. 시너지마다 「변신 2/4」(켜졌으면 진하게) → 켜진 효과 한 줄씩(「2개: …」)
// 가려진 시너지가 넷을 넘으면(시너지 열 — 밤샘 2) 이름 · 수만 적는다: 효과 줄까지 적으면 화면 아래로 넘친다
export function familyMoreTip(fams, n) {
  const lines = [];
  const detail = fams.length <= 4;
  for (const f of fams) {
    const lv = levelOf(n[f.id]), next = THRESHOLDS[lv];
    lines.push([`${L(f.name)} ${next ? `${n[f.id]}/${next}` : n[f.id]}`, lv ? PAL.cardInk : PAL.cardDim]);
    if (detail) THRESHOLDS.forEach((th, i) => { if (n[f.id] >= th) lines.push([`${L(`${th}개`)}: ${L(f.text[i])}`, PAL.goldDk]); });
  }
  return tipLines(`${L('시너지')} +${fams.length}`, [], 150, lines);
}
// 「+N」 글을 그리고, 가리키면 가려진 시너지 전부가 말풍선으로 뜨는 구역을 단다
function moreMark(ctx, ui, idPrefix, hidden, n, x, y) {
  const s = `+${hidden.length}`;
  ui.region(`${idPrefix}:more`, x - 1, y, measure(s) + 3, FAM_H, { tip: () => familyMoreTip(hidden, n), noKeys: true });
  text(ctx, s, x, inkY(y, FAM_H), ui.isHover(`${idPrefix}:more`) ? PAL.gold : PAL.dim);
}

// 시너지 칩: 어두운 칸 안에 문양 + 「기사 +1」(카드가 시너지를 몇 개 채우는지). 너비를 돌려준다
export const chipLabel = (id, add = 1) => `${FAMILY_BY_ID[id].name} +${add}`;
// 칩(칠한 바탕 CHIP_H, 테 없음): 안 가로 여백 CHIP_PAD → 문양(5) → 3 → 글 → CHIP_PAD. 글은 위아래 EDGE_PAD 안(잉크 11 가운데)
export const chipW = (id) => CHIP_PAD + 5 + 3 + measure(chipLabel(id)) + CHIP_PAD;
export function familyChip(ctx, id, x, y) {
  const w = chipW(id);
  openBox('edge', x, y, w, CHIP_H, 0, { name: `칩 ${id}` });
  rect(ctx, x, y, w, CHIP_H, '#1b2b27');
  familyGlyph(ctx, id, x + CHIP_PAD, y + ((CHIP_H - 5) >> 1));
  text(ctx, chipLabel(id), x + CHIP_PAD + 8, inkY(y, CHIP_H), PAL.ink);
  closeBox();
  return w;
}
// 칩 여럿을 너비 안에 흘려 놓는 자리(넘치면 다음 줄). maxRows 줄에 못 놓은 것은 마지막 줄 끝에 「+N」(자리가 모자라면 그 줄 마지막 칩을 뺀다)
const plusW = (k) => measure(`+${k}`) + 3;
function chipPlace(fams, w, maxRows = 99) {
  const out = [];
  let xx = 0, row = 0;
  for (const id of fams) {
    const cw = chipW(id);
    if (xx > 0 && xx + cw > w) { if (row + 1 >= maxRows) break; xx = 0; row++; }
    out.push({ id, x: xx, row, w: cw });
    xx += cw + 3;
  }
  while (out.length < fams.length && out.length) {
    const last = out[out.length - 1];
    if (last.x + last.w + 3 + plusW(fams.length - out.length) <= w) break;
    out.pop();
  }
  return { spots: out, rows: fams.length ? Math.max(1, ...out.map((s) => s.row + 1)) : 0, more: fams.length - out.length };
}
export function familyChips(ctx, fams, x, y, w, maxRows = 99) {
  const { spots, rows, more } = chipPlace(fams, w, maxRows);
  for (const s of spots) familyChip(ctx, s.id, x + s.x, y + s.row * CHIP_ROW);
  if (more) {
    const last = spots[spots.length - 1];
    const px = last ? x + last.x + last.w + 3 : x, py = y + (last ? last.row : 0) * CHIP_ROW;
    text(ctx, `+${more}`, px, inkY(py, CHIP_H), PAL.cardDim);
  }
  return rows;
}
export const chipRows = (fams, w, maxRows = 99) => chipPlace(fams, w, maxRows).rows;
// 칩 줄 묶음의 높이(줄 사이 CHIP_ROW − CHIP_H, 마지막 줄 아래 틈은 없다)
export const chipBlockH = (rows) => (rows ? rows * CHIP_ROW - (CHIP_ROW - CHIP_H) : 0);
// 말풍선 · 좁은 곳에 적는 글 꼴: 「기사 +1 · 행진 +1」
export const chipText = (fams) => fams.map((f) => chipLabel(f)).join(' · ');

// 시너지 띠: 하나라도 모인 시너지를 많은 순으로 칩 하나씩(「기사 2/4」, 자리가 넉넉하면 문양도). 켜진 시너지는 제 빛깔 테.
// 칩 너비는 글에 맞추고, 너비 w를 넘는 칩은 놓지 않는다(대국 오른쪽 칸은 둘쯤).
// fx: { [id]: 문턱을 막 넘은 때(초) } — 넘은 시너지 칩이 빛나며 커진다
// rows: 줄 수(넘치면 다음 줄). 칩은 테 두른 FAM_H(글과 테 사이 EDGE_PAD), 줄 사이 LIST_GAP
export function familyStrip(ctx, ui, build, x, y, w, { time = 0, fx = null, max = 4, idPrefix = 'fam', counts = null, glyph = true, rows = 1 } = {}) {
  const n = counts || familyCounts(build);
  const all = FAMILIES.filter((f) => n[f.id] > 0).sort((a, b) => levelOf(n[b.id]) - levelOf(n[a.id]) || n[b.id] - n[a.id]);
  const labelOf = (f) => { const next = THRESHOLDS[levelOf(n[f.id])]; return `${f.name} ${next ? `${n[f.id]}/${next}` : n[f.id]}`; };
  // 칩 폭은 글에 맞춘다(안 가로 여백 CHIP_PAD). 줄 rows개 안에 놓고, 못 놓은 시너지는 끝에 「+N」(자리가 모자라면 마지막 칩을 빼고)
  const cwOf = (f) => measure(labelOf(f)) + CHIP_PAD * 2 + (glyph ? 8 : 0);
  const place = (list) => {
    const out = [];
    let cx = x, cy = y, row = 1;
    for (const f of list) {
      const cw = cwOf(f);
      if (cx + cw > x + w) { if (row >= rows || cx === x) break; row++; cx = x; cy += FAM_H + LIST_GAP; }
      out.push({ f, x: cx, y: cy, w: cw });
      cx += cw + 2;
    }
    return out;
  };
  let spots = place(all.slice(0, max));
  const plusW = (k) => measure(`+${k}`) + 2;
  // 남은 수 표시 자리: 마지막 칩 뒤(같은 줄)에 안 들어가면 마지막 칩을 뺀다
  while (spots.length < all.length && spots.length) {
    const last = spots[spots.length - 1];
    if (last.x + last.w + 2 + plusW(all.length - spots.length) <= x + w) break;
    spots = spots.slice(0, -1);
  }
  for (const s of spots) {
    const { f } = s, cx = s.x, cy = s.y, cw = s.w;
    const lv = levelOf(n[f.id]);
    const id = `${idPrefix}:${f.id}`;
    // 칩 자체가 그 시너지라 말풍선 하나만(같은 풀이를 상자로 또 띄우지 않는다)
    ui.region(id, cx, cy, cw, FAM_H, { tip: () => familyTip(f.id, n[f.id]), noKeys: true });
    const since = fx && fx[f.id] != null ? time - fx[f.id] : 99;
    const glow = since < 1.2 ? 1 - since / 1.2 : 0;
    openBox('edge', cx, cy, cw, FAM_H, 1, { name: `띠 ${f.id}` });
    box(ctx, cx, cy, cw, FAM_H, lv ? '#132019' : PAL.feltDk, lv ? f.col : PAL.frameDk);
    if (glow > 0) {
      ctx.globalAlpha = glow * 0.6; rect(ctx, cx - 2, cy - 2, cw + 4, FAM_H + 4, f.col); ctx.globalAlpha = 1;
      frame(ctx, cx - 1 - Math.round(glow * 2), cy - 1 - Math.round(glow * 2), cw + 2 + Math.round(glow * 4), FAM_H + 2 + Math.round(glow * 4), PAL.goldHi);
    }
    if (glyph) familyGlyph(ctx, f.id, cx + CHIP_PAD, cy + ((FAM_H - 5) >> 1), lv ? f.col : PAL.dim);
    text(ctx, labelOf(f), cx + CHIP_PAD + (glyph ? 8 : 0), inkY(cy, FAM_H), lv ? PAL.ink : PAL.dim);
    closeBox();
  }
  if (spots.length < all.length) {
    const last = spots[spots.length - 1];
    const px = last ? last.x + last.w + 2 : x, py = last ? last.y : y;
    moreMark(ctx, ui, idPrefix, all.slice(spots.length), n, px + 1, py);
  }
  return n;
}

// 시너지 세로 줄(판 틀 왼쪽 칸): 한 줄에 하나(문양 + 「기사 5/6」), 많은 순. 켜진 시너지는 제 빛깔 테.
// 줄이 모자라면 마지막 줄은 「+N」. 그린 줄 수를 돌려준다. 구역 id는 띠와 같다(fam:기사 …)
export function familyList(ctx, ui, build, x, y, w, maxRows, { time = 0, fx = null, idPrefix = 'fam' } = {}) {
  const n = familyCounts(build);
  const all = FAMILIES.filter((f) => n[f.id] > 0).sort((a, b) => levelOf(n[b.id]) - levelOf(n[a.id]) || n[b.id] - n[a.id]);
  // 다 안 들어가면 마지막 줄은 「+N」(남은 시너지 수)
  const list = all.length > maxRows ? all.slice(0, Math.max(0, maxRows - 1)) : all;
  list.forEach((f, k) => {
    const yy = y + k * FAM_ROW;
    const lv = levelOf(n[f.id]);
    const next = THRESHOLDS[lv];
    const id = `${idPrefix}:${f.id}`;
    ui.region(id, x, yy, w, FAM_H, { tip: () => familyTip(f.id, n[f.id]), noKeys: true });
    const since = fx && fx[f.id] != null ? time - fx[f.id] : 99;
    const glow = since < 1.2 ? 1 - since / 1.2 : 0;
    openBox('edge', x, yy, w, FAM_H, 1, { name: `시너지 줄 ${f.id}` });
    box(ctx, x, yy, w, FAM_H, lv ? '#132019' : PAL.feltDk, ui.isHover(id) ? PAL.gold : lv ? f.col : PAL.frameDk);
    if (glow > 0) { ctx.globalAlpha = glow * 0.6; rect(ctx, x - 2, yy - 2, w + 4, FAM_H + 4, f.col); ctx.globalAlpha = 1; }
    familyGlyph(ctx, f.id, x + CHIP_PAD, yy + ((FAM_H - 5) >> 1), lv ? f.col : PAL.dim);
    const cnt = next ? `${n[f.id]}/${next}` : `${n[f.id]}`;
    const nx = x + CHIP_PAD + 8, room = w - CHIP_PAD * 2 - 8 - measure(cnt) - 4;
    // 이름이 길면(영어) 줄인다
    let nm = L(f.name);
    if (measure(nm) > room) { while (nm.length > 1 && measure(`${nm}…`) > room) nm = nm.slice(0, -1); nm = `${nm}…`; }
    text(ctx, nm, nx, inkY(yy, FAM_H), lv ? PAL.ink : PAL.dim);
    text(ctx, cnt, x + w - CHIP_PAD, inkY(yy, FAM_H), lv ? PAL.ink : PAL.dim, { align: 'right' });
    closeBox();
  });
  if (all.length > list.length && maxRows > 0) { moreMark(ctx, ui, idPrefix, all.slice(list.length), n, x + 3, y + list.length * FAM_ROW); return list.length + 1; }
  return list.length;
}

// 가족 단계가 올랐나(이전 수 → 지금 수). 오른 가족 id 목록
export function familyRises(before, after) {
  return FAMILIES.filter((f) => levelOf(after[f.id]) > levelOf(before[f.id] || 0)).map((f) => f.id);
}

// 가진 정석 작은 표(등급 빛 테 안에 첫 가족 문양). 올리면 이름 · 글
export function josekiBadges(ctx, ui, run, x, y) {
  (run.josekis || []).forEach((id, k) => {
    const j = JOSEKI_BY_ID[id];
    const bx = x + k * 12;
    ui.region(`joseki:${id}`, bx, y, 11, 11, { tip: () => tipLines(j.name, [j.text, j.more], 150, j.families.length ? [{ chips: j.families }] : []) });
    box(ctx, bx, y, 11, 11, '#132019', TIER_COL[j.tier]);
    if (j.families[0]) familyGlyph(ctx, j.families[0], bx + 3, y + 3, TIER_COL[j.tier]);
    else rect(ctx, bx + 4, y + 4, 3, 3, TIER_COL[j.tier]);
  });
  return (run.josekis || []).length * 12;
}

// 적 특성 문양(발밑 왼쪽 5×5): 방패 · 폭약 · 허수아비 · 파수꾼 · 배신자
const TRAIT_GLYPH = {
  shield: ['#####', '#####', '#####', '.###.', '..#..'],
  bomb: ['...#.', '..#..', '.###.', '#####', '.###.'],
  mirror: ['#####', '#...#', '#.#.#', '#...#', '#####'],
  fort: ['#.#.#', '#####', '#...#', '#.#.#', '#####'],
  traitor: ['..#..', '.##..', '#####', '.##..', '..#..'],
};
export function traitMark(ctx, id, x, y) {
  const rows = TRAIT_GLYPH[id];
  const tr = TRAIT_BY_ID[id];
  if (!rows || !tr) return;
  rect(ctx, x - 1, y - 1, 7, 7, '#0e1513');
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, tr.col); });
}
