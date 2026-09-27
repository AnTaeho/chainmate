// 깊이 층의 화면 조각: 가족 문양 · 가족 띠(켜진 가족과 다음 문턱) · 문턱을 넘는 순간.
import { PAL } from '../render/palette.js';
import { rect, text, box, frame } from '../render/gfx.js';
import { FAMILIES, FAMILY_BY_ID, THRESHOLDS, familyCounts, levelOf, setName } from '../data/families.js';
import { tipLines, setLine } from './parts.js';
import { L } from './lang.js';
import { JOSEKI_BY_ID, TIER_COL } from '../data/josekis.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { wrap } from '../render/text.js';

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
  // 효과 글에 「 · 」가 들어 있어 영어로 옮길 때 쪼개지지 않게 먼저 옮긴다
  const lines = [];
  // 문턱과 효과를 헷갈리지 않게 「2개 모으면: …」
  THRESHOLDS.forEach((th, i) => { for (const l of wrap(`${L(`${Math.max(1, th - drop)}개 모으면`)}: ${L(f.text[i])}`, 160)) lines.push([l, n >= th - drop ? PAL.goldDk : PAL.cardDim]); });
  return tipLines(`${setName(id)} ${n}`, [], 170, lines);
}

// 가족 띠: 하나라도 모인 가족을 많은 순으로 칩 하나씩(문양 + 「3/4」). 켜진 가족은 제 빛깔 테.
// fx: { [id]: 문턱을 막 넘은 때(초) } — 넘은 가족 칩이 빛나며 커진다
export function familyStrip(ctx, ui, build, x, y, w, { time = 0, fx = null, max = 4, idPrefix = 'fam', counts = null } = {}) {
  const n = counts || familyCounts(build);
  const list = FAMILIES.filter((f) => n[f.id] > 0).sort((a, b) => n[b.id] - n[a.id]).slice(0, max);
  const cw = Math.floor((w - (max - 1) * 2) / max);
  list.forEach((f, k) => {
    const cx = x + k * (cw + 2);
    const lv = levelOf(n[f.id]);
    const next = THRESHOLDS[lv];
    const id = `${idPrefix}:${f.id}`;
    ui.region(id, cx, y, cw, 13, { tip: () => familyTip(f.id, n[f.id]) });
    const since = fx && fx[f.id] != null ? time - fx[f.id] : 99;
    const glow = since < 1.2 ? 1 - since / 1.2 : 0;
    box(ctx, cx, y, cw, 13, lv ? '#132019' : PAL.feltDk, lv ? f.col : PAL.frameDk);
    if (glow > 0) {
      ctx.globalAlpha = glow * 0.6; rect(ctx, cx - 2, y - 2, cw + 4, 17, f.col); ctx.globalAlpha = 1;
      frame(ctx, cx - 1 - Math.round(glow * 2), y - 1 - Math.round(glow * 2), cw + 2 + Math.round(glow * 4), 15 + Math.round(glow * 4), PAL.goldHi);
    }
    familyGlyph(ctx, f.id, cx + 3, y + 4, lv ? f.col : PAL.dim);
    text(ctx, next ? `${n[f.id]}/${next}` : `${n[f.id]}`, cx + cw - 3, y, lv ? PAL.ink : PAL.dim, { align: 'right' });
  });
  return n;
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
    ui.region(`joseki:${id}`, bx, y, 11, 11, { tip: () => tipLines(j.name, j.families.length ? [j.text, setLine('정석', j.families)] : j.text) });
    box(ctx, bx, y, 11, 11, '#132019', TIER_COL[j.tier]);
    if (j.families[0]) familyGlyph(ctx, j.families[0], bx + 3, y + 3, TIER_COL[j.tier]);
    else rect(ctx, bx + 4, y + 4, 3, 3, TIER_COL[j.tier]);
  });
  return (run.josekis || []).length * 12;
}

// 적 특성 문양(발밑 왼쪽 5×5): 방패 · 폭약 · 거울 · 성채 · 배신자
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
