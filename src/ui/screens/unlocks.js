// 해금 길(CHM-73, docs/design-notes/layout.md 26절): 스물한 칸이 가로로 놓이고 지나온 몫은 금빛이다.
// 길 보기 — 칸마다 그 묶음의 작은 그림(열렸으면 물건 그림, 잠겼으면 종류 그림), 지금 자리에 표, 다음 칸 아래 남은 관 수, 아래 칸에 요약.
// 칸을 누르면 그 묶음을 펼친다 — 연 묶음은 효과 글이 든 카드(넷까지, 넘으면 쪽), 잠긴 묶음은 뒷면. 「뒤로」는 펼친 것을 접고, 한 번 더 누르면 온 곳으로.
//   args.open  펼친 채로 열 묶음(결과 화면의 「N개 열렸어요」 · 도감의 자물쇠 칸)
//   args.from  돌아갈 곳 'codex' | 'result'  · args.back 돌아갈 화면에 넘길 것(도감의 탭 · 쪽)
import { PAL } from '../../render/palette.js';
import { W, text, rect, frame, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { panel } from '../parts.js';
import { hint } from '../coach.js';
import { pageHead, pageButtons } from './common.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { MAX_TIER } from '../../data/unlocks.js';
import { unlockState, bundle, bundleNames, bundleKinds, bundleCard, bundleCardH, backCard, BACK_W, BACK_H, miniArt, kindCell, MINI, progressBar, BAR_H, lockLine, nextLine } from '../unlockview.js';

// 길: 21칸(칸 20 · 사이 2) — 9 + 21 × 22 − 2 = 469
export const PATH = { x: 9, pitch: 22, cw: MINI.w, nodeY: 40, node: 8, colY: 52, row: MINI.h + 1, rows: 5 };
const LEFT_Y = PATH.colY + PATH.rows * PATH.row + 6;   // 다음 칸 아래 한 줄
const PANEL = { x: 8, y: 190, w: W - 16 };
// 펼친 묶음: 카드 폭 108(상점 진열 카드와 같은 폭 — 88이면 효과 글이 200까지 길어진다) · 한 쪽에 넷까지
export const CARDS = { y: 54, w: 108, gap: 8, per: 4, maxH: PAGE.btnY - GAP_GROUP - 54 };
const cx = (t) => PATH.x + t * PATH.pitch + PATH.cw / 2;
// 쪽 나누기: 넷이 넘으면 쪽마다 고르게(다섯은 3 · 2)
export function bundlePages(n) {
  const pages = Math.max(1, Math.ceil(n / CARDS.per));
  return { pages, per: Math.max(1, Math.ceil(n / pages)) };
}
// 묶음의 카드 높이: 쪽을 넘겨도 그대로이게 묶음에서 가장 긴 카드
export const bundleRowH = (items) => Math.max(0, ...items.map((b) => bundleCardH(b, CARDS.w)));

export class UnlocksScreen {
  constructor(app, { open = null, from = 'codex', back = null } = {}) {
    this.app = app;
    this.from = from; this.back = back;
    this.sel = open != null && open >= 0 && open <= MAX_TIER ? open : null;
    this.page = 0;
    app.track('unlocks_open', { from, tier: app.records.unlockTier || 0 }, { always: true });
  }
  select(t) {
    this.sel = this.sel === t ? null : t;
    this.page = 0;
    this.app.sfx('pick');
  }
  leave() {
    if (this.sel != null) { this.sel = null; this.page = 0; return; }
    if (this.from === 'result' && this.app.run) return this.app.go('result', { quiet: true });
    this.app.go('codex', this.back || {});
  }
  draw(ctx, ui) {
    const st = unlockState(this.app.records);
    pageHead(ctx, '해금', `돌파한 관 ${st.gates}`);
    this.drawPath(ctx, ui, st);
    if (this.sel == null) this.drawOverview(ctx, ui, st);
    else this.drawBundle(ctx, ui, st, this.sel);
    button(ctx, ui, 'unlocks:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => this.leave() });
  }
  // 길과 마디: 지나온 몫은 금빛, 다음 칸까지는 온 만큼. 지금 자리는 마디 위 세모, 펼친 묶음은 마디 둘레 흰 테
  drawPath(ctx, ui, st) {
    const P = PATH, railY = P.nodeY + 3;
    rect(ctx, cx(0), railY, cx(MAX_TIER) - cx(0), 2, PAL.frame);
    rect(ctx, cx(0), railY, Math.round(cx(st.tier) - cx(0) + (st.next != null ? st.p * P.pitch : 0)), 2, PAL.gold);
    for (let t = 0; t <= MAX_TIER; t++) {
      const x = P.x + t * P.pitch, open = t <= st.tier, nx = cx(t) - P.node / 2;
      // 펼친 동안은 마디 둘레만, 길 보기에서는 그림 줄까지 한 구역
      const h = this.sel == null ? P.colY + P.rows * P.row - (P.nodeY - 10) : P.node + 14;
      ui.region(`unlocks:${t}`, x, P.nodeY - 10, P.cw, h, { onClick: () => this.select(t) });
      rect(ctx, nx, P.nodeY, P.node, P.node, open ? PAL.gold : PAL.feltDk);
      frame(ctx, nx, P.nodeY, P.node, P.node, open ? PAL.goldDk : t === st.next ? PAL.gold : PAL.frame);
      if (open) rect(ctx, nx + 1, P.nodeY + 1, P.node - 2, 1, PAL.goldHi);
      if (t === st.tier) for (let k = 0; k < 4; k++) rect(ctx, nx + k, P.nodeY - 7 + k, P.node - 2 * k, 1, PAL.goldHi);
      if (t === this.sel) frame(ctx, nx - 2, P.nodeY - 2, P.node + 4, P.node + 4, PAL.white);
      else if (this.sel != null && ui.isHover(`unlocks:${t}`)) frame(ctx, nx - 2, P.nodeY - 2, P.node + 4, P.node + 4, PAL.dim);
    }
  }
  // 길 보기: 칸마다 그림 줄(다섯까지), 다음 칸 아래 남은 관 수, 아래 칸에 가장 최근에 연 묶음 · 다음 묶음 · 막대
  drawOverview(ctx, ui, st) {
    const P = PATH;
    for (let t = 0; t <= MAX_TIER; t++) {
      const x = P.x + t * P.pitch, open = t <= st.tier, items = bundle(t);
      // 처음부터 열린 묶음은 수가 많아 종류마다 한 칸
      const kinds = t === 0 ? [...new Set(items.map((b) => b.kind))] : null;
      if (kinds) kinds.forEach((k, i) => kindCell(ctx, k, x, P.colY + i * P.row));
      else items.slice(0, P.rows).forEach((b, i) => miniArt(ctx, b, x, P.colY + i * P.row, open));
      const n = kinds ? kinds.length : Math.min(P.rows, items.length);
      const here = t === st.tier, next = t === st.next;
      if (here || next || ui.isHover(`unlocks:${t}`)) frame(ctx, x - 1, P.colY - 1, P.cw + 2, n * P.row + 1, here ? PAL.goldHi : next ? PAL.goldDk : PAL.dim);
    }
    if (st.next != null) {
      const s = st.left > 0 ? `관 ${st.left}개 더` : '다음 판에 열려요', tw = measure(s);
      text(ctx, s, Math.max(PAGE.titleX, Math.min(W - PAGE.titleX - tw, Math.round(cx(st.next) - tw / 2))), LEFT_Y, PAL.gold);
    }
    // 아래 칸(두 줄): 이름표 칸은 두 이름표 중 긴 쪽에 맞춘다
    const { x: px, y: py, w: pw } = PANEL, ph = PAD_BOX * 2 + LINE * 2, lx = px + PAD_BOX, rx = px + pw - PAD_BOX;
    const head = st.tier ? '최근에 연 것' : '처음부터', vx = lx + Math.max(measure(head), measure('다음')) + 10;
    openBox('panel', px, py, pw, ph, PAD_BOX, { name: '해금 아래 칸' });
    panel(ctx, px, py, pw, ph);
    const y1 = textY(py + PAD_BOX), y2 = y1 + LINE;
    text(ctx, head, lx, y1, PAL.dim);
    // 이름이 한 줄에 안 들어가면(영어) 종류와 수로
    const names = st.tier ? bundleNames(st.tier) : bundleKinds(0);
    text(ctx, measure(names, true) <= rx - vx ? names : bundleKinds(st.tier), vx, y1, PAL.ink, { bold: true });
    if (st.next == null) text(ctx, '모두 열었어요', lx, y2, PAL.gold, { bold: true });
    else {
      const kinds = bundleKinds(st.next), s = nextLine(st), tw = measure(s);
      text(ctx, '다음', lx, y2, PAL.dim);
      text(ctx, kinds, vx, y2, PAL.ink);
      text(ctx, s, rx, y2, PAL.gold, { align: 'right' });
      // 막대는 종류 글과 남은 관 글 사이에 남는 만큼(96까지)
      const bx0 = vx + measure(kinds) + 12, bw = Math.min(96, rx - tw - 8 - bx0);
      if (bw >= 32) progressBar(ctx, rx - tw - 8 - bw, y2 + Math.floor((11 - BAR_H) / 2), bw, st.p);
    }
    closeBox();
    // 처음 한 번: 지금 자리의 마디를 가리킨다(말풍선이 아래 칸의 글을 덮지 않게 마디만)
    ui.region('unlocks:here', cx(st.tier) - P.node / 2 - 2, P.nodeY - 10, P.node + 4, P.node + 12, { passive: true });
    hint(this.app, 'unlocks', 'unlocks:here');
  }
  // 펼친 묶음: 연 묶음은 카드, 잠긴 묶음은 뒷면과 언제 열리는지 한 줄
  drawBundle(ctx, ui, st, t) {
    const items = bundle(t), open = t <= st.tier;
    // 뒷면은 좁아도 되니 한 줄에 다(다섯까지), 카드는 쪽으로 나눈다
    const { pages, per } = open ? bundlePages(items.length) : { pages: 1, per: items.length }, page = Math.min(this.page, pages - 1);
    const shown = items.slice(page * per, page * per + per), n = shown.length;
    const w = open ? CARDS.w : BACK_W, h = open ? Math.min(CARDS.maxH, bundleRowH(items)) : BACK_H;
    const x0 = Math.round((W - (n * w + (n - 1) * CARDS.gap)) / 2);
    shown.forEach((b, i) => {
      const x = x0 + i * (w + CARDS.gap);
      if (open) bundleCard(ctx, b, x, CARDS.y, w, h, this.app.time, ui);
      else backCard(ctx, b.kind, x, CARDS.y, w, h, { next: t === st.next });
    });
    if (!open) text(ctx, lockLine(st, t), W / 2, CARDS.y + h + GAP_GROUP + 1, t === st.next ? PAL.gold : PAL.dim, { align: 'center' });
    if (pages > 1) pageButtons(ctx, ui, 'unlocks', page, pages, (p) => { this.page = p; });
  }
  key(k) {
    if (k === 'Escape') return this.leave();
    if (this.sel == null) { if (k === 'Enter') this.leave(); return; }
    const { pages } = this.sel <= (this.app.records.unlockTier || 0) ? bundlePages(bundle(this.sel).length) : { pages: 1 };
    if (k === 'ArrowRight') { if (this.page < pages - 1) this.page++; else if (this.sel < MAX_TIER) { this.sel++; this.page = 0; } }
    if (k === 'ArrowLeft') { if (this.page > 0) this.page--; else if (this.sel > 0) { this.sel--; this.page = 0; } }
  }
}
