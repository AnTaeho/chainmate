// 깊이 층의 화면 조각: 시너지(옛 가족) 문양 · 칩 · 띠(켜진 시너지와 다음 문턱) · 문턱을 넘는 순간.
import { PAL } from '../render/palette.js';
import { rect, text, box, frame, measure } from '../render/gfx.js';
import { FAMILIES, FAMILY_BY_ID, THRESHOLDS, familyCounts, levelOf, setName } from '../data/families.js';
import { tipLines } from './parts.js';
import { L } from './lang.js';
import { JOSEKI_BY_ID, TIER_COL } from '../data/josekis.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { wrap } from '../render/text.js';
import { CHIP_ROW, FAM_ROW, CHIP_PAD } from './frame.js';
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

// 시너지 칩: 어두운 칸 안에 문양 + 「기사 +1」(카드가 시너지를 몇 개 채우는지). 너비를 돌려준다
export const chipLabel = (id, add = 1) => `${FAMILY_BY_ID[id].name} +${add}`;
// 칩: 안 가로 여백 CHIP_PAD → 문양(5) → 3 → 글 → CHIP_PAD
export const chipW = (id) => CHIP_PAD + 5 + 3 + measure(chipLabel(id)) + CHIP_PAD;
export function familyChip(ctx, id, x, y) {
  const w = chipW(id);
  openBox('tile', x, y - 1, w, 13, { x: CHIP_PAD, y: 0 }, { name: `칩 ${id}` });
  rect(ctx, x, y, w, 11, '#1b2b27');
  familyGlyph(ctx, id, x + CHIP_PAD, y + 3);
  text(ctx, chipLabel(id), x + CHIP_PAD + 8, y - 1, PAL.ink);
  closeBox();
  return w;
}
// 칩 여럿을 너비 안에 흘려 놓는다(넘치면 다음 줄). 쓴 줄 수를 돌려준다
export function familyChips(ctx, fams, x, y, w) {
  let xx = x, rows = fams.length ? 1 : 0;
  for (const id of fams) {
    const cw = chipW(id);
    if (xx > x && xx + cw > x + w) { xx = x; y += CHIP_ROW; rows++; }
    familyChip(ctx, id, xx, y);
    xx += cw + 3;
  }
  return rows;
}
export function chipRows(fams, w) {
  let xx = 0, rows = fams.length ? 1 : 0;
  for (const id of fams) { const cw = chipW(id); if (xx > 0 && xx + cw > w) { xx = 0; rows++; } xx += cw + 3; }
  return rows;
}
// 말풍선 · 좁은 곳에 적는 글 꼴: 「기사 +1 · 행진 +1」
export const chipText = (fams) => fams.map((f) => chipLabel(f)).join(' · ');

// 시너지 띠: 하나라도 모인 시너지를 많은 순으로 칩 하나씩(「기사 2/4」, 자리가 넉넉하면 문양도). 켜진 시너지는 제 빛깔 테.
// 칩 너비는 글에 맞추고, 너비 w를 넘는 칩은 놓지 않는다(대국 오른쪽 칸은 둘쯤).
// fx: { [id]: 문턱을 막 넘은 때(초) } — 넘은 시너지 칩이 빛나며 커진다
// rows: 줄 수(넘치면 다음 줄, 줄 사이 14)
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
      if (cx + cw > x + w) { if (row >= rows || cx === x) break; row++; cx = x; cy += 14; }
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
    ui.region(id, cx, cy, cw, 13, { tip: () => familyTip(f.id, n[f.id]), noKeys: true });
    const since = fx && fx[f.id] != null ? time - fx[f.id] : 99;
    const glow = since < 1.2 ? 1 - since / 1.2 : 0;
    openBox('tile', cx, cy, cw, 13, { x: CHIP_PAD, y: 0 }, { name: `띠 ${f.id}` });
    box(ctx, cx, cy, cw, 13, lv ? '#132019' : PAL.feltDk, lv ? f.col : PAL.frameDk);
    if (glow > 0) {
      ctx.globalAlpha = glow * 0.6; rect(ctx, cx - 2, cy - 2, cw + 4, 17, f.col); ctx.globalAlpha = 1;
      frame(ctx, cx - 1 - Math.round(glow * 2), cy - 1 - Math.round(glow * 2), cw + 2 + Math.round(glow * 4), 15 + Math.round(glow * 4), PAL.goldHi);
    }
    if (glyph) familyGlyph(ctx, f.id, cx + CHIP_PAD, cy + 4, lv ? f.col : PAL.dim);
    text(ctx, labelOf(f), cx + CHIP_PAD + (glyph ? 8 : 0), cy, lv ? PAL.ink : PAL.dim);
    closeBox();
  }
  if (spots.length < all.length) {
    const last = spots[spots.length - 1];
    const px = last ? last.x + last.w + 2 : x, py = last ? last.y : y;
    text(ctx, `+${all.length - spots.length}`, px + 1, py, PAL.dim);
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
    ui.region(id, x, yy, w, 13, { tip: () => familyTip(f.id, n[f.id]), noKeys: true });
    const since = fx && fx[f.id] != null ? time - fx[f.id] : 99;
    const glow = since < 1.2 ? 1 - since / 1.2 : 0;
    openBox('tile', x, yy, w, 13, { x: CHIP_PAD, y: 0 }, { name: `시너지 줄 ${f.id}` });
    box(ctx, x, yy, w, 13, lv ? '#132019' : PAL.feltDk, ui.isHover(id) ? PAL.gold : lv ? f.col : PAL.frameDk);
    if (glow > 0) { ctx.globalAlpha = glow * 0.6; rect(ctx, x - 2, yy - 2, w + 4, 17, f.col); ctx.globalAlpha = 1; }
    familyGlyph(ctx, f.id, x + CHIP_PAD, yy + 4, lv ? f.col : PAL.dim);
    const cnt = next ? `${n[f.id]}/${next}` : `${n[f.id]}`;
    const nx = x + CHIP_PAD + 8, room = w - CHIP_PAD * 2 - 8 - measure(cnt) - 4;
    // 이름이 길면(영어) 줄인다
    let nm = L(f.name);
    if (measure(nm) > room) { while (nm.length > 1 && measure(`${nm}…`) > room) nm = nm.slice(0, -1); nm = `${nm}…`; }
    text(ctx, nm, nx, yy, lv ? PAL.ink : PAL.dim);
    text(ctx, cnt, x + w - CHIP_PAD, yy, lv ? PAL.ink : PAL.dim, { align: 'right' });
    closeBox();
  });
  if (all.length > list.length && maxRows > 0) { text(ctx, `+${all.length - list.length}`, x + 3, y + list.length * FAM_ROW, PAL.dim); return list.length + 1; }
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
