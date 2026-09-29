// 행마 보기(덮개, CHM-22 · 탭 CHM-26): 대국 오른쪽 위 「행마」 단추.
// 탭 셋: 「이 판」(지금 판과 손에 있는 기물, 처음 열 때) · 「기본 기물」(체스 여섯) · 「특수 기물」(아홉 전부, 아직 만나지 않은 것도).
// 카드마다 행마 그림 · 기물 · 이름 · 행마 글. 처음 보는 특수 기물은 「새로」(본 것은 records.movesSeen), 판에 있는 기물은 금빛 테(「이 판」).
// 네 장이 넘으면 쪽을 넘긴다(쪽마다 고르게 — 아홉은 3 · 3 · 3).
import { PAL } from '../../render/palette.js';
import { W, text, box, frame, sprite, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { fitText } from '../parts.js';
import { moveDiagram, hasDiagram, DIAG_SIZE } from '../diagram.js';
import { PIECES, FAIRIES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { isHidden } from '../../sim/battle.js';
import { PAD_BOX, PAD_CARD, GAP_GROUP, LINE, BTN_S, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { tabRow } from './common.js';

const BASIC = ['P', 'N', 'B', 'R', 'Q', 'K'];
const ORDER = [...BASIC, ...FAIRIES];
export const MOVE_TABS = [['board', '이 판'], ['basic', '기본 기물'], ['fairy', '특수 기물']];
// 카드: 두 줄 × 두 칸(사이 GAP), 폭은 상자(화면 − 바깥 여백 8 × 2)를 채운다
const COLS = 2, ROWS = 2, GAP = 6;
export const cardW = () => Math.floor((W - 16 - PAD_BOX * 2 - GAP) / COLS);
// 카드 안: 왼쪽 = 행마 그림(34) · 틈 2 · 기물(22), 오른쪽 = 이름 줄 · 틈 2 · 행마 글 세 줄까지
const SPRITE_H = 22, NAME_GAP = 5;
export const MOVE_LINES = 3;
export const textW = () => cardW() - PAD_CARD * 2 - DIAG_SIZE - NAME_GAP;
export const cardH = () => PAD_CARD * 2 + Math.max(DIAG_SIZE + 2 + SPRITE_H, LINE + 2 + MOVE_LINES * LINE);
const PAGE_BTN = 24;

// 「이 판」에 보일 기물: [{ t, board, hand, fresh }] — 처음 보는 특수 기물 → 특수 기물 → 체스 기물
export function movesList(b, seen = {}) {
  const on = new Set(), inHand = new Set();
  if (b) {
    b.board.forEach((c, sq) => { if (c && !c.mine && !isHidden(b, sq) && hasDiagram(c.t)) on.add(c.t); });
    for (const p of b.hand) if (hasDiagram(p.t)) inHand.add(p.t);
  }
  const all = ORDER.filter((t) => on.has(t) || inHand.has(t)).map((t) => ({ t, board: on.has(t), hand: inHand.has(t), fairy: !!PIECES[t].fairy, fresh: !!PIECES[t].fairy && !seen[t] }));
  const rank = (x) => (x.fresh ? 0 : x.fairy ? 1 : 2);
  return all.sort((a, c) => rank(a) - rank(c) || ORDER.indexOf(a.t) - ORDER.indexOf(c.t));
}

// 탭마다 보일 기물. 「기본 기물」 · 「특수 기물」은 늘 전부(내 쪽 모습), 「새로」는 「이 판」과 같다
export function movesTab(tab, list) {
  if (tab === 'board') return list;
  const fresh = new Set(list.filter((x) => x.fresh).map((x) => x.t));
  return (tab === 'basic' ? BASIC : FAIRIES).map((t) => ({ t, board: false, hand: true, fairy: !!PIECES[t].fairy, fresh: fresh.has(t) }));
}

// 쪽 나누기: 네 장이 넘으면 쪽마다 고르게
export function movesPages(n) {
  const pages = Math.max(1, Math.ceil(n / (COLS * ROWS)));
  return { pages, per: Math.max(1, Math.ceil(n / pages)) };
}

export class MovesScreen {
  constructor(app, { battle = null } = {}) {
    this.app = app;
    const b = battle ? battle.live() || battle.b : app.run && app.run.battle;
    const rec = app.records;
    this.list = movesList(b, rec.movesSeen || {});
    this.tab = 'board';
    this.page = 0;
    // 본 것으로 적는다(다음에 열면 맨 앞에 서지 않는다)
    rec.movesSeen = { ...(rec.movesSeen || {}), ...Object.fromEntries(this.list.filter((x) => x.fairy).map((x) => [x.t, true])) };
    app.saveRecords();
  }
  setTab(id) { if (id !== this.tab) { this.tab = id; this.page = 0; this.app.sfx('pick'); } }
  draw(ctx, ui) {
    const app = this.app;
    const items = movesTab(this.tab, this.list);
    const { pages, per } = movesPages(items.length);
    const page = Math.min(this.page, pages - 1);
    const shown = items.slice(page * per, page * per + per);
    const CW = cardW(), CH = cardH();
    // 상자 크기는 탭을 바꿔도 그대로(탭이 제자리에 있게): 카드 두 줄 + 쪽 줄(「특수 기물」은 늘 쪽이 넘어간다)
    // 막간 상자(hug): 머리 줄(제목 · 탭 왼쪽 · 돌아가기 오른쪽, 단추 높이) → 묶음 틈 → 카드 줄들 → 묶음 틈 → 쪽 줄
    // 돌아가기 · 탭을 머리 줄에 둔다: 카드에는 말풍선이 없고, 누를 것은 모두 카드 밖에 있다
    const f = flow(PAD_BOX), by = f.space(BTN_S), ty = textY(by, BTN_S) - 1;
    const top = f.gap(GAP_GROUP).space(ROWS * CH + (ROWS - 1) * GAP);
    const py = f.gap(GAP_GROUP).space(BTN_S);
    const w = PAD_BOX * 2 + COLS * CW + (COLS - 1) * GAP, h = f.y + PAD_BOX;
    const x = Math.floor((W - w) / 2), y = Math.floor((270 - h) / 2);
    openBox('panel', x, y, w, h, PAD_BOX, { name: '행마 보기' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '행마', x + PAD_BOX, y + ty, PAL.gold, { bold: true });
    tabRow(ctx, ui, 'moves', MOVE_TABS, this.tab, x + PAD_BOX + measure('행마', true) + 8, y + by, BTN_S, (id) => this.setTab(id));
    const x0 = x + PAD_BOX;
    shown.forEach((it, i) => this.card(ctx, it, x0 + (i % COLS) * (CW + GAP), y + top + Math.floor(i / COLS) * (CH + GAP), CW, CH));
    if (pages > 1) {
      // 쪽 줄: 가운데 ‹ 쪽 ›
      const label = `${page + 1}/${pages}`, lw = Math.max(28, measure(label) + 8), px = x + Math.floor((w - (PAGE_BTN * 2 + lw)) / 2);
      button(ctx, ui, 'moves:prev', px, y + py, PAGE_BTN, BTN_S, '‹', { enabled: page > 0, onClick: () => { this.page = page - 1; } });
      text(ctx, label, px + PAGE_BTN + lw / 2, y + textY(py, BTN_S), PAL.dim, { align: 'center' });
      button(ctx, ui, 'moves:next', px + PAGE_BTN + lw, y + py, PAGE_BTN, BTN_S, '›', { enabled: page < pages - 1, onClick: () => { this.page = page + 1; } });
    }
    const bw = Math.max(64, measure('돌아가기', true) + 8);
    button(ctx, ui, 'moves:back', x + w - PAD_BOX - bw, y + by, bw, BTN_S, '돌아가기', { onClick: () => app.closeOverlay() });
    closeBox();
  }
  // 카드 하나: 왼쪽 행마 그림 · 기물, 오른쪽 이름(「새로」는 이름 줄 오른끝) · 행마 글
  card(ctx, it, cx, cy, CW, CH) {
    const P = PAD_CARD, board = this.tab === 'board' && it.board;
    openBox('card', cx, cy, CW, CH, P, { name: `행마 ${it.t}` });
    box(ctx, cx, cy, CW, CH, '#132019', board ? PAL.gold : PAL.frameDk);
    if (board) frame(ctx, cx + 1, cy + 1, CW - 2, CH - 2, PAL.goldDk);
    const dir = this.tab === 'board' && !it.hand ? -1 : 1;
    moveDiagram(ctx, it.t, cx + P, cy + P, { dir });
    sprite(ctx, it.t, dir > 0 ? 'w' : 'b', cx + P + ((DIAG_SIZE - 16) >> 1), cy + P + DIAG_SIZE + 2);
    const tx = cx + P + DIAG_SIZE + NAME_GAP, tw = cx + CW - P - tx;
    const nw = it.fresh ? measure('새로', true) + 6 : 0;
    if (it.fresh) text(ctx, '새로', cx + CW - P - measure('새로', true), textY(cy + P), PAL.gold, { bold: true });
    fitText(ctx, PIECE_NAME[it.t], tx, textY(cy + P), tw - nw, it.fairy ? PAL.gold : PAL.ink);
    wrap(PIECE_MOVE[it.t], tw).slice(0, MOVE_LINES).forEach((s, k) => text(ctx, s, tx, textY(cy + P + LINE + 2 + k * LINE), PAL.ink));
    closeBox();
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') { this.app.closeOverlay(); return; }
    const i = MOVE_TABS.findIndex(([id]) => id === this.tab);
    if (k === 'ArrowRight') this.setTab(MOVE_TABS[(i + 1) % MOVE_TABS.length][0]);
    if (k === 'ArrowLeft') this.setTab(MOVE_TABS[(i + MOVE_TABS.length - 1) % MOVE_TABS.length][0]);
  }
}
