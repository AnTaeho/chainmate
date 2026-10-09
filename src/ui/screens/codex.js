// 도감: 격언 · 기물 · 혼 · 세력(우두머리 명인 포함) · 명국 · 오프닝 · 판본. 본 것만 채워지고 나머지는 「?」. 명국은 모은 조각 수까지.
import { PAL, RARITY, EDITION_TINT } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite, measure } from '../../render/gfx.js';
import { PIECES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { MAXIMS } from '../../data/maxims.js';
import { FACTIONS, bossOf } from '../../data/factions.js';
import { drawCrest, CREST_SIZE } from '../../render/crests.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { EDITIONS } from '../../data/editions.js';
import { button } from '../ui.js';
import { tipLines, miniShard, moveTip, cardBase, wrapName, drawName, fragmentSteps, rarityLine, soulGlyph, maximArt, MAXIM_CELL, MAXIM_ICON_W } from '../parts.js';
import { SOULS, soulPrice } from '../../data/souls.js';
import { L } from '../lang.js';
import { OPENING_ORDER, UNLOCKS } from '../records.js';
import { pageHead, pageButtons, tabRow } from './common.js';
import { PAGE, PAD_CARD, LIST_GAP, GAP_GROUP, LINE, textY, rowBoxH, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

// 도감 격자(CHM-46): 칸 이름은 낱말 단위로 두 줄까지 — 굵게 → 보통 굵기. 두 줄로도 안 되는 이름이 탭에 하나라도 있으면 그 탭만 열 수를 하나 줄인다.
// 줄 높이 · 열 수는 본 것 · 안 본 것을 가리지 않고 탭의 모든 이름으로 잰다(도감이 차도 쪽이 바뀌지 않는다)
const GRID = { x: 12, w: W - 24, gap: 4, cols: [5, 4, 3] };
// 오른쪽 그림 자리(격언 그림 칸 20 · 기물 16 · 혼 문양 9 · 문장 · 조각 셋)
const artW = (tab, e) => (e.piece ? 16 + 2 : e.soul ? 9 + 2 : tab === 'maxims' || tab === 'legends' ? MAXIM_ICON_W : e.crest ? 12 + 2 : e.parts != null ? 18 + 2 : 0);
// 격자 자리: { cols, cw, pages: [[{ i, x, y, h, name, nameW }]] } — 쪽마다 들어가는 줄까지, 줄 높이는 그 줄의 가장 긴 이름
export function codexLayout(tab, list) {
  const P = PAD_CARD, room = PAGE.btnY - GAP_GROUP - PAGE.bodyY;
  let cols = 0, cw = 0, names = null;
  for (const n of GRID.cols) {
    cols = n; cw = Math.floor((GRID.w - (n - 1) * GRID.gap) / n);
    names = list.map((e) => wrapName(e.name, cw - P * 2 - artW(tab, e)));
    if (names.every(Boolean)) break;
  }
  const pages = [[]];
  let y = PAGE.bodyY;
  for (let r = 0; r * cols < list.length; r++) {
    const idx = list.map((_, i) => i).slice(r * cols, r * cols + cols);
    const lines = Math.max(...idx.map((i) => (names[i] ? names[i].lines.length : 1)));
    const h = rowBoxH(P, lines);
    if (pages[pages.length - 1].length && y + h > PAGE.bodyY + room) { pages.push([]); y = PAGE.bodyY; }
    idx.forEach((i, k) => pages[pages.length - 1].push({ i, x: GRID.x + k * (cw + GRID.gap), y, h, name: names[i], nameW: cw - P * 2 - artW(tab, list[i]) }));
    y += h + GRID.gap;
  }
  return { cols, cw, pages };
}

const TABS = [['maxims', '격언'], ['pieces', '기물'], ['souls', '혼'], ['factions', '세력'], ['legends', '명경기'], ['openings', '오프닝'], ['editions', '판본']];

export class CodexScreen {
  constructor(app) { this.app = app; this.tab = 'maxims'; this.page = 0; }
  entries() {
    const c = this.app.records.codex;
    if (this.tab === 'maxims') return MAXIMS.map((m) => ({ id: m.id, seen: !!c.maxims[m.id], name: m.name, tip: () => tipLines(m.name, [m.text, `${m.verb} · $${m.price}`]), col: RARITY[m.rarity] }));
    // 기물: 체스 여섯과 이형 아홉(이형은 행마 한 줄)
    if (this.tab === 'pieces') return Object.values(PIECES).map((p) => ({ id: p.id, seen: true, name: PIECE_NAME[p.id], piece: p.id, tip: () => moveTip(PIECE_NAME[p.id], p.id, [PIECE_MOVE[p.id] || '', `값 ${p.value}`]), col: p.fairy ? PAL.gold : PAL.dim }));
    // 혼: 만난 혼만. 왼쪽 막대는 등급 빛깔(격언과 같은 규칙), 오른쪽은 혼의 문양
    // 각성 칸: 깨운 적이 있는 혼은 금테와 각성 한 줄, 아직이면 「각성 · ?」(도감의 빈칸)
    if (this.tab === 'souls') return SOULS.map((s) => { const aw = !!(c.awake || {})[s.id]; return { id: s.id, seen: !!(c.souls || {})[s.id] || aw, name: s.name, soul: s.id, awake: aw, tip: () => tipLines(`${s.name}의 혼`, [s.text, s.more], 150, [rarityLine(s.rarity), [`$${soulPrice(s.id)}`, PAL.cardDim], [aw ? `각성 · ${L(s.awake)}` : '각성 · ?', aw ? PAL.goldDk : PAL.cardDim]]), col: RARITY[s.rarity] }; });
    // 세력: 만난 세력만(세력 전 기록은 만난 명인의 세력으로 친다). 말풍선에 버릇과 우두머리
    if (this.tab === 'factions') {
      const met = (f) => !!((c.factions || {})[f.id] || (c.masters || {})[f.boss]);
      return FACTIONS.map((f) => ({ id: f.id, seen: met(f), name: f.name, crest: f.id, tip: () => tipLines(f.name, [f.habit.text, `마스터 ${bossOf(f.id).name}`, bossOf(f.id).text]), col: f.hue }));
    }
    if (this.tab === 'legends') return LEGENDS.map((l) => ({ id: l.id, seen: (c.legends[l.id] || 0) > 0 || !!c.legendsDone[l.id], name: l.name, parts: c.legends[l.id] || 0, done: !!c.legendsDone[l.id], tip: () => tipLines(l.name, [`전설: ${l.text}`, ...fragmentSteps(l, c.legendsDone[l.id] ? { first: true, feat: true, gold: true } : null)]), col: PAL.gold }));
    if (this.tab === 'openings') return OPENING_ORDER.map((id) => { const o = OPENINGS[id]; const u = UNLOCKS.find((x) => x.id === id); const open = this.app.records.unlocked.openings.includes(id); return { id, seen: open, name: o.name, tip: () => (open ? tipLines(o.name, o.text) : tipLines('잠김', u.text)), col: PAL.gold }; });
    return EDITIONS.map((e) => ({ id: e.id, seen: !!c.editions[e.id], name: e.name, tip: () => tipLines(e.name, e.text), col: EDITION_TINT[e.id] }));
  }
  // 판 밖 틀: 머리줄(제목 · 탭 · 모은 수) + 격자(다섯 칸, 이름이 두 줄로도 안 들어가면 넷 — 넘치면 쪽) + 맨 아래 단추 줄. 칸 말풍선은 칸 바로 아래(마지막 줄은 위)
  draw(ctx, ui) {
    pageHead(ctx, '도감');
    // 탭은 제목 오른쪽부터(영어 제목이 길어도 겹치지 않게)
    const tx0 = Math.max(44, PAGE.titleX + measure('도감', true) + 8);
    // 탭 폭은 이름마다 글에 맞춘다(common.js tabRow — 영어 「Masters」 · 「Opening」이 테에 붙지 않고 오른쪽 모은 수에 닿지 않게)
    const tabEnd = tabRow(ctx, ui, 'codex', TABS, this.tab, tx0, 5, BTN_S, (id) => { this.tab = id; this.page = 0; this.app.sfx('pick'); });
    const list = this.entries();
    const seen = list.filter((e) => e.seen).length;
    // 모은 수: 머리줄 오른쪽. 탭이 거기까지 차면(영어 — 탭 일곱) 맨 아래 「돌아가기」 오른쪽으로
    const count = `${seen} / ${list.length}`;
    if (tabEnd + 8 + measure(count) <= W - PAGE.titleX) text(ctx, count, W - PAGE.titleX, PAGE.titleY, PAL.dim, { align: 'right' });
    else text(ctx, count, PAGE.titleX + 80 + 8, PAGE.btnY + 3, PAL.dim);
    // 칸 이름은 두 줄까지(낱말 단위). 한 줄(row)의 높이는 그 줄에서 가장 긴 이름에 맞추고, 쪽은 본 칸(머리줄 아래 ~ 단추 줄 위 묶음 틈)에 들어가는 줄까지
    const lay = codexLayout(this.tab, list);
    const pages = lay.pages.length;
    const page = Math.min(this.page || 0, pages - 1);
    const P = PAD_CARD, cw = lay.cw;
    for (const c of lay.pages[page]) {
      const e = list[c.i], x = c.x, y = c.y, ch = c.h;
      const id = `codex:${e.id}`;
      ui.region(id, x, y, cw, ch, { tip: e.seen ? e.tip : null });
      openBox('card', x, y, cw, ch, P, { name: `도감 ${e.id}` });
      if (!e.seen) {
        box(ctx, x, y, cw, ch, PAL.feltDk, PAL.frameDk);
        text(ctx, '?', x + cw / 2, y + textY((ch - LINE) >> 1), PAL.dimDk, { align: 'center', bold: true });
        closeBox();
        continue;
      }
      cardBase(ctx, x, y, cw, ch, { fill: e.done ? '#f6d98a' : PAL.card, hover: ui.isHover(id) });
      if (e.awake) { frame(ctx, x + 1, y + 1, cw - 2, ch - 2, PAL.gold); frame(ctx, x + 2, y + 2, cw - 4, ch - 4, PAL.goldDk); }
      rect(ctx, x + 1, y + 2, 2, ch - 3, e.col);
      // 이름(두 줄까지)은 칸 가운데 높이에, 오른쪽 그림(아이콘 12 · 기물 16 · 조각 셋)은 오른쪽 안 여백 안
      const nm = c.name, top = (ch - (nm ? nm.lines.length : 1) * LINE) >> 1;
      drawName(ctx, e.name, nm, x + P, [0, 1].map((k) => y + textY(top + k * LINE)), c.nameW, PAL.cardInk);
      // 명경기 칸(두 줄)은 그림 칸을 위로 붙이고 그 아래에 조각 셋
      const low = e.parts != null && ch >= MAXIM_CELL.inset + MAXIM_CELL.h + 5 + P;
      if (this.tab === 'maxims' || this.tab === 'legends') maximArt(ctx, e.id, x + cw - MAXIM_CELL.inset - MAXIM_CELL.w, y + (low ? MAXIM_CELL.inset : Math.floor((ch - MAXIM_CELL.h) / 2)));
      if (e.soul) soulGlyph(ctx, e.soul, x + cw - P - 9, y + Math.floor((ch - 9) / 2));
      if (e.piece) sprite(ctx, e.piece, 'w', x + cw - P - 16, y + Math.floor((ch - 22) / 2));
      if (e.crest) drawCrest(ctx, e.crest, x + cw - P - CREST_SIZE, y + Math.floor((ch - CREST_SIZE) / 2));
      if (e.parts != null) for (let k = 0; k < 3; k++) { if (k < e.parts) miniShard(ctx, x + cw - (low ? MAXIM_CELL.inset + 19 : P + 18) + k * 6, y + ch - P - 5, PAL.goldDk); }
      closeBox();
    }
    button(ctx, ui, 'codex:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => this.app.go('title') });
    if (pages > 1) pageButtons(ctx, ui, 'codex', page, pages, (p) => { this.page = p; });
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') this.app.go('title');
    const i = TABS.findIndex(([id]) => id === this.tab);
    if (k === 'ArrowRight') { this.tab = TABS[(i + 1) % TABS.length][0]; this.page = 0; }
    if (k === 'ArrowLeft') { this.tab = TABS[(i + TABS.length - 1) % TABS.length][0]; this.page = 0; }
  }
}
