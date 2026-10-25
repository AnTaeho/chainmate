// 도감: 격언 · 기물 · 혼 · 세력(우두머리 명인 포함) · 명국 · 오프닝 · 판본. 본 것만 채워지고 나머지는 「?」. 명국은 모은 조각 수까지.
// 아직 안 연 묶음의 격언 · 특수 기물 · 혼은 「?」 대신 자물쇠 칸 — 누르면 해금 화면이 그 묶음을 펼친다(CHM-73). 본 적이 있으면(오늘의 대국 등) 잠겨 있어도 채워진다.
import { PAL, RARITY, EDITION_TINT } from '../../render/palette.js';
import { W, text, rrect, rframe, sprite, measure, slot, slotR, radiusOf } from '../../render/gfx.js';
import { PIECES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { MAXIMS } from '../../data/maxims.js';
import { FACTIONS, bossOf } from '../../data/factions.js';
import { drawCrest, CREST_SIZE } from '../../render/crests.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { EDITIONS } from '../../data/editions.js';
import { toggleGroup, rowWidth } from '../ui.js';
import { tipLines, miniShard, moveTip, cardBase, wrapName, drawName, fragmentSteps, rarityLine, soulGlyph, maximArt, editionArt, MAXIM_CELL, MAXIM_ICON_W } from '../parts.js';
import { SOULS, soulPrice } from '../../data/souls.js';
import { L } from '../lang.js';
import { OPENING_ORDER, UNLOCKS } from '../records.js';
import { pageHead, pageButtons, bottomBar, headTabX, HEAD_BIG } from './common.js';
import { PAGE, PAD_CARD, GAP_GROUP, LINE, BTN_H, SP, textY, rowBoxH } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { lockTier, lockIcon } from '../unlockview.js';

// 도감 격자(CHM-46): 칸 이름은 낱말 단위로 두 줄까지 — 굵게 → 보통 굵기. 두 줄로도 안 되는 이름이 탭에 하나라도 있으면 그 탭만 열 수를 하나 줄인다.
// 줄 높이 · 열 수는 본 것 · 안 본 것을 가리지 않고 탭의 모든 이름으로 잰다(도감이 차도 쪽이 바뀌지 않는다)
const GRID = { x: 12, w: W - 24, gap: 4, cols: [5, 4, 3] };
// 오른쪽 그림 자리(격언 · 판본 그림 칸 20 · 기물 16 · 혼 문양 9 · 문장 · 조각 셋)
const artW = (tab, e) => (e.piece ? 16 + 2 : e.soul ? 9 + 2 : tab === 'maxims' || tab === 'legends' || tab === 'editions' ? MAXIM_ICON_W : e.crest ? 12 + 2 : e.parts != null ? 18 + 2 : 0);
// 격자 자리: { cols, cw, pages: [[{ i, x, y, h, name, nameW }]] } — 쪽마다 들어가는 줄까지. 칸 높이는 탭의 가장 긴 이름 하나로 모두 같다(격자가 고르게).
// top: 격자 윗변(탭이 두 줄이면 그 아래)
export function codexLayout(tab, list, top = PAGE.bodyY) {
  const P = PAD_CARD, room = PAGE.btnY - GAP_GROUP - top;
  let cols = 0, cw = 0, names = null;
  for (const n of GRID.cols) {
    cols = n; cw = Math.floor((GRID.w - (n - 1) * GRID.gap) / n);
    names = list.map((e) => wrapName(e.name, cw - P * 2 - artW(tab, e)));
    if (names.every(Boolean)) break;
  }
  const pages = [[]];
  let y = top;
  const h = rowBoxH(P, Math.max(...names.map((q) => (q ? q.lines.length : 1))));
  for (let r = 0; r * cols < list.length; r++) {
    const idx = list.map((_, i) => i).slice(r * cols, r * cols + cols);
    if (pages[pages.length - 1].length && y + h > top + room) { pages.push([]); y = top; }
    idx.forEach((i, k) => pages[pages.length - 1].push({ i, x: GRID.x + k * (cw + GRID.gap), y, h, name: names[i], nameW: cw - P * 2 - artW(tab, list[i]) }));
    y += h + GRID.gap;
  }
  return { cols, cw, pages };
}

const TABS = [['maxims', '격언'], ['pieces', '기물'], ['souls', '혼'], ['factions', '세력'], ['legends', '명경기'], ['openings', '오프닝'], ['editions', '판본']];

export class CodexScreen {
  // tab · page: 해금 화면에서 돌아올 때 보던 자리로
  constructor(app, { tab = 'maxims', page = 0 } = {}) { this.app = app; this.tab = TABS.some(([id]) => id === tab) ? tab : 'maxims'; this.page = page; }
  // 해금 화면으로(tier: 펼칠 묶음). 돌아오면 이 탭 · 이 쪽
  toUnlocks(tier = null) { this.app.go('unlocks', { open: tier, from: 'codex', back: { tab: this.tab, page: this.page || 0 } }); }
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
  // 그릴 때만 그린다: 이 화면은 스스로 움직이지 않는다(움직이는 그림은 live()로 알린다)
  animating() { return false; }
  draw(ctx, ui) {
    // 큰 제목 오른쪽 가운데 줄에 같은 폭 탭. 한 줄에 안 들어가면(영어 — 큰 「Almanac」 + 탭 일곱) 넷 · 셋 두 줄(같은 폭), 격자는 그 아래
    pageHead(ctx, '도감', null, { big: true });
    const go = (id) => { this.tab = id; this.page = 0; this.app.sfx('pick'); };
    const tx0 = headTabX('도감'), { bw, w: oneW } = rowWidth(TABS.map(([, label]) => ({ label })), { gap: SP.s, min: 0 });
    const two = tx0 + oneW > W - PAGE.titleX;
    let tabEnd, gridTop = PAGE.bodyY;
    if (!two) tabEnd = toggleGroup(ctx, ui, 'codex:tab', TABS, this.tab, tx0, HEAD_BIG.tabY, go, { w: bw }).w + tx0;
    else {
      const r1 = toggleGroup(ctx, ui, 'codex:tab', TABS.slice(0, 4), this.tab, tx0, HEAD_BIG.tabY, go, { w: bw });
      toggleGroup(ctx, ui, 'codex:tab', TABS.slice(4), this.tab, tx0, HEAD_BIG.tabY + BTN_H + SP.s, go, { w: bw });
      tabEnd = r1.x + r1.w;
      gridTop = HEAD_BIG.tabY + BTN_H * 2 + SP.s + SP.m;
    }
    const list = this.entries();
    // 잠긴 칸: 아직 안 연 묶음의 것이고 본 적도 없다(특수 기물은 행마 보기에서 만난 적이 없다)
    const tier = this.app.records.unlockTier || 0, met = this.app.records.movesSeen || {};
    for (const e of list) {
      const t = lockTier(this.tab, e.id);
      if (t > tier && !(this.tab === 'pieces' ? met[e.id] : e.seen)) { e.lock = t; e.seen = false; }
    }
    const seen = list.filter((e) => e.seen).length;
    // 모은 수(굵게): 머리줄 오른쪽. 탭이 거기까지 차면 맨 아래 「해금」 오른쪽으로
    const count = `${seen} / ${list.length}`;
    // 해금 길로 들어가는 길: 첫 화면 아이콘 줄은 여덟 칸이면 좁아(칸 59) 도감 옆에 둔다
    const bar = bottomBar(ctx, ui, { back: { id: 'codex:back', onClick: () => this.app.go('title') }, extras: [{ id: 'codex:unlocks', label: '해금', tone: 'gold', onClick: () => this.toUnlocks() }] });
    if (tabEnd + SP.m + measure(count, true) <= W - PAGE.titleX) text(ctx, count, W - PAGE.titleX, HEAD_BIG.mid - 5, PAL.dim, { align: 'right', bold: true });
    else { const u = bar.extras[0]; text(ctx, count, u.x + u.w + SP.m, textY(PAGE.btnY, BTN_H), PAL.dim, { bold: true }); }
    // 칸 이름은 두 줄까지(낱말 단위). 한 줄(row)의 높이는 그 줄에서 가장 긴 이름에 맞추고, 쪽은 본 칸(머리줄 아래 ~ 단추 줄 위 묶음 틈)에 들어가는 줄까지
    const lay = codexLayout(this.tab, list, gridTop);
    const pages = lay.pages.length;
    const page = Math.min(this.page || 0, pages - 1);
    const P = PAD_CARD, cw = lay.cw;
    for (const c of lay.pages[page]) {
      const e = list[c.i], x = c.x, y = c.y, ch = c.h;
      const id = `codex:${e.id}`;
      // 자물쇠 칸은 눌린다 — 설명 자리 규칙에서는 다른 칸과 같은 격자 칸으로 본다(cell — app.js planNotes)
      if (e.lock) ui.region(id, x, y, cw, ch, { cell: true, onClick: () => this.toUnlocks(e.lock) });
      else ui.region(id, x, y, cw, ch, { tip: e.seen ? e.tip : null });
      openBox('card', x, y, cw, ch, P, { name: `도감 ${e.id}` });
      if (e.lock) {
        slot(ctx, x, y, cw, ch);
        if (ui.isHover(id)) rframe(ctx, x, y, cw, ch, slotR(cw, ch), PAL.gold);
        lockIcon(ctx, x + Math.floor((cw - 12) / 2), y + Math.floor((ch - 12) / 2), ui.isHover(id) ? 1 : 0.7);
        closeBox();
        continue;
      }
      if (!e.seen) {
        slot(ctx, x, y, cw, ch);
        text(ctx, '?', x + cw / 2, y + textY((ch - LINE) >> 1), PAL.dimDk, { align: 'center', bold: true });
        closeBox();
        continue;
      }
      cardBase(ctx, x, y, cw, ch, { fill: e.done ? '#f6d98a' : PAL.card, hover: ui.isHover(id), edge: e.awake ? PAL.gold : null, double: e.awake });
      // 왼쪽 등급 막대: 둥근 모서리 안쪽에 선 작은 알약
      const rr = radiusOf(cw, ch);
      rrect(ctx, x + (e.awake ? 4 : 2), y + rr, 2, ch - rr * 2, 1, e.col);
      // 이름(두 줄까지)은 칸 가운데 높이에, 오른쪽 그림(아이콘 12 · 기물 16 · 조각 셋)은 오른쪽 안 여백 안
      const nm = c.name, top = (ch - (nm ? nm.lines.length : 1) * LINE) >> 1;
      drawName(ctx, e.name, nm, x + P, [0, 1].map((k) => y + textY(top + k * LINE)), c.nameW, PAL.cardInk);
      // 명경기 칸(두 줄)은 그림 칸을 위로 붙이고 그 아래에 조각 셋
      const low = e.parts != null && ch >= MAXIM_CELL.inset + MAXIM_CELL.h + 5 + P;
      if (this.tab === 'maxims' || this.tab === 'legends') maximArt(ctx, e.id, x + cw - MAXIM_CELL.inset - MAXIM_CELL.w, y + (low ? MAXIM_CELL.inset : Math.floor((ch - MAXIM_CELL.h) / 2)));
      if (this.tab === 'editions') editionArt(ctx, e.id, x + cw - MAXIM_CELL.inset - MAXIM_CELL.w, y + Math.floor((ch - MAXIM_CELL.h) / 2));
      if (e.soul) soulGlyph(ctx, e.soul, x + cw - P - 9, y + Math.floor((ch - 9) / 2));
      if (e.piece) sprite(ctx, e.piece, 'w', x + cw - P - 16, y + Math.floor((ch - 22) / 2));
      if (e.crest) drawCrest(ctx, e.crest, x + cw - P - CREST_SIZE, y + Math.floor((ch - CREST_SIZE) / 2));
      if (e.parts != null) for (let k = 0; k < 3; k++) { if (k < e.parts) miniShard(ctx, x + cw - (low ? MAXIM_CELL.inset + 19 : P + 18) + k * 6, y + ch - P - 5, PAL.goldDk); }
      closeBox();
    }
    if (pages > 1) pageButtons(ctx, ui, 'codex', page, pages, (p) => { this.page = p; });
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') this.app.go('title');
    const i = TABS.findIndex(([id]) => id === this.tab);
    if (k === 'ArrowRight') { this.tab = TABS[(i + 1) % TABS.length][0]; this.page = 0; }
    if (k === 'ArrowLeft') { this.tab = TABS[(i + TABS.length - 1) % TABS.length][0]; this.page = 0; }
  }
}
