// 해금(CHM-73, docs/design-notes/layout.md 26절): 해금 화면 · 결과 화면 · 도감이 같이 쓰는 조각 — 묶음 · 진행 막대 · 카드 · 뒷면 · 작은 그림.
// 단계와 문턱은 src/data/unlocks.js, 기록은 records.gates · records.unlockTier.
import { PAL } from '../render/palette.js';
import { rrect, box, slot, text, measure } from '../render/gfx.js';
import { drawIcon } from '../render/icons.js';
import { UNLOCK_TIERS, UNLOCK_KINDS, UNLOCK_GATES, unlockProgress, tierOf } from '../data/unlocks.js';
import { MAXIMS } from '../data/maxims.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { ENGRAVING_BY_ID } from '../data/engravings.js';
import { JOSEKI_BY_ID, TIER_COL } from '../data/josekis.js';
import { PIECE_NAME } from './words.js';
import { KIND, kindGlyph, kindTab, tabW, TAB, TAB_GAP } from './kinds.js';
import { CELL, maximArt, EMBLEM, itemArt } from './art.js';
import { cardBase, itemCard, itemCardH, CARD_CHIP_ROWS, edgeRing } from './parts.js';
import { familyChips } from './parts-depth.js';
import { josekiLayout } from './screens/draft.js';
import { LINE, PAD_CARD, GAP_IN } from './frame.js';
import { openBox, closeBox } from '../render/layoutlog.js';
import { L } from './lang.js';

export const KIND_OF = { maxims: 'maxim', pieces: 'piece', souls: 'soul', engravings: 'engraving', josekis: 'joseki' };
export const KIND_LABEL = { maxim: '격언', piece: '기물', soul: '혼', engraving: '각인', joseki: '레퍼토리' };
const ORDER = ['pieces', 'maxims', 'souls', 'engravings', 'josekis'];
const MAXIM_BY_ID = Object.fromEntries(MAXIMS.map((m) => [m.id, m]));
const nameOf = (kind, id) => (kind === 'maxim' ? MAXIM_BY_ID[id].name : kind === 'piece' ? PIECE_NAME[id] : kind === 'soul' ? `${SOUL_BY_ID[id].name}의 혼` : kind === 'engraving' ? ENGRAVING_BY_ID[id].name : JOSEKI_BY_ID[id].name);

// 지금 자리(기록에서): { tier, gates, next, left, p }
export const unlockState = (rec) => unlockProgress(rec.unlockTier || 0, rec.gates || 0);
// 묶음 하나: 기물 → 격언 → 혼 → 각인 → 레퍼토리 차례 [{ kind, id, name }]
export function bundle(tier) {
  const t = UNLOCK_TIERS[tier], out = [];
  for (const k of ORDER) for (const id of t[k]) out.push({ kind: KIND_OF[k], id, name: nameOf(KIND_OF[k], id) });
  return out;
}
export const bundleSize = (tier) => ORDER.reduce((n, k) => n + UNLOCK_TIERS[tier][k].length, 0);
// 「낙타 · 기마 돌격 · 사막」 — 낱말마다 옮긴다
export const bundleNames = (tier) => bundle(tier).map((b) => L(b.name)).join(' · ');
// 「격언 3 · 레퍼토리 1」
export function bundleKinds(tier) {
  const n = {};
  for (const b of bundle(tier)) n[b.kind] = (n[b.kind] || 0) + 1;
  return Object.entries(n).map(([k, v]) => `${KIND_LABEL[k]} ${v}`).join(' · ');
}
// 도감 탭의 칸이 열리는 단계(해금과 상관없는 탭 · 체스 기물은 -1)
export const lockTier = (tab, id) => (UNLOCK_KINDS.includes(tab) ? tierOf(tab, id) : -1);
// 그 묶음이 언제 열리나 한 줄(잠긴 묶음): 남은 관 · 문턱은 넘었고 다음 판 · 앞 묶음이 먼저
export function lockLine(st, tier) {
  const left = UNLOCK_GATES[tier] - st.gates;
  if (left > 0) return `관을 ${left}개 더 돌파하면 열려요`;
  return tier === st.next ? '다음 판이 끝나면 열려요' : '앞의 묶음부터 한 판에 하나씩 열려요';
}
// 다음 묶음까지 한 줄(결과 화면 · 해금 화면 아래 칸)
export const nextLine = (st) => (st.left > 0 ? `다음 해금까지 관 ${st.left}개` : '다음 판이 끝나면 열려요');

// 얇은 진행 막대(높이 4): 빈 자리 알약에 금빛 알약
export const BAR_H = 4;
export function progressBar(ctx, x, y, w, p) {
  slot(ctx, x - 1, y - 1, w + 2, BAR_H + 2);
  const fw = Math.max(0, Math.min(w, Math.round(w * p)));
  if (fw) rrect(ctx, x, y, fw, BAR_H, Math.min(BAR_H / 2, fw / 2), PAL.gold);
}

// 자물쇠(12 × 12, icons.js lock): 도감의 잠긴 칸
export const lockIcon = (ctx, x, y, alpha = 1) => drawIcon(ctx, 'lock', x, y, alpha);

// ── 카드
// 물건 카드로 그릴 꼴(상점 카드와 같은 그리기 — 값은 적지 않는다)
const itemOf = (b) => (b.kind === 'piece' ? { kind: 'piece', t: b.id } : { kind: b.kind, id: b.id });
export const bundleCardH = (b, w) => (b.kind === 'joseki' ? josekiLayout(JOSEKI_BY_ID[b.id], w).h : itemCardH(itemOf(b), w, { price: false }));
// 레퍼토리 카드: 고르기 화면과 같은 쌓기(이름 → 가로줄 → 효과 글 → 시너지 칩), 머릿말은 종류 딱지 + 「레퍼토리」
function josekiCard(ctx, id, x, y, w, h) {
  const j = JOSEKI_BY_ID[id], col = TIER_COL[j.tier], lay = josekiLayout(j, w), P = PAD_CARD;
  openBox('card', x, y, w, h, P, { name: `레퍼토리 ${id}` });
  cardBase(ctx, x, y, w, h, { edge: col, double: j.tier !== 'silver', ticks: true });
  kindTab(ctx, 'joseki', x + P, y + P, tabW(measure(KIND_LABEL.joseki)));
  text(ctx, KIND_LABEL.joseki, x + P + TAB + TAB_GAP, y + lay.tier, PAL.ink);
  for (const [l, ly] of lay.names) text(ctx, l, x + P, y + ly, PAL.cardInk, { bold: true });
  rrect(ctx, x + P, y + lay.rule, lay.IW, 1, 0, col);
  for (const [l, ly] of lay.lines) text(ctx, l, x + P, y + ly, PAL.cardInk);
  if (lay.chips != null) familyChips(ctx, j.families, x + P, y + lay.chips + (h - lay.h), lay.IW, CARD_CHIP_ROWS);
  closeBox();
}
// 연 묶음의 카드 한 장: 효과 글이 든 실제 카드
export function bundleCard(ctx, b, x, y, w, h, t = 0, ui = null) {
  if (b.kind === 'joseki') return josekiCard(ctx, b.id, x, y, w, h);
  itemCard(ctx, itemOf(b), x, y, w, h, { price: false, t, ui });
}
// 뒷면 카드: 깊은 남색 카드에 종류 그림과 종류 이름만(이름 · 효과는 가린다). next면 금빛 테
export const BACK_W = 84, BACK_H = 96;
export function backCard(ctx, kind, x, y, w, h, { next = false } = {}) {
  openBox('card', x, y, w, h, PAD_CARD, { name: `뒷면 ${kind}` });
  box(ctx, x, y, w, h, PAL.slot, next ? PAL.gold : PAL.frameDk);
  edgeRing(ctx, x, y, w, h, 3, next ? PAL.goldDk : PAL.slotEdge);
  const gy = y + Math.floor((h - TAB - GAP_IN - LINE) / 2), gx = x + Math.floor((w - TAB) / 2);
  rrect(ctx, gx, gy, TAB, TAB, 3, KIND[kind].bg);
  kindGlyph(ctx, kind, gx, gy, TAB, TAB);
  text(ctx, KIND_LABEL[kind], x + Math.floor(w / 2), gy + TAB + GAP_IN + 1, PAL.dim, { align: 'center' });
  closeBox();
}

// ── 해금 길의 작은 그림 칸(20 × 22)
export const MINI = { w: 20, h: 22 };
// 열렸으면 그 물건의 그림, 잠겼으면 흐린 종류 그림
export function miniArt(ctx, b, x, y, open) {
  if (!open) {
    slot(ctx, x, y, MINI.w, MINI.h, { r: 3 });
    kindGlyph(ctx, b.kind, x, y, MINI.w, MINI.h, PAL.dimDk);
    return;
  }
  if (b.kind === 'maxim') return maximArt(ctx, b.id, x, y);
  if (b.kind === 'piece' || b.kind === 'soul' || (b.kind === 'engraving' && EMBLEM[b.id])) { itemArt(ctx, itemOf(b), x, y, 0, null, MINI); return; }
  rrect(ctx, x, y, MINI.w, MINI.h, 3, CELL.bg);
  if (b.kind === 'joseki') kindGlyph(ctx, 'joseki', x, y, MINI.w, MINI.h, TIER_COL[JOSEKI_BY_ID[b.id].tier]);
  else kindGlyph(ctx, b.kind, x, y, MINI.w, MINI.h);
}
// 종류만 보이는 칸(처음부터 열린 묶음처럼 수가 많을 때): 종류 그림
export function kindCell(ctx, kind, x, y) {
  rrect(ctx, x, y, MINI.w, MINI.h, 3, CELL.bg);
  kindGlyph(ctx, kind, x, y, MINI.w, MINI.h);
}
