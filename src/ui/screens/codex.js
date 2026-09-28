// 도감: 격언 · 명인 · 명국 · 오프닝 · 판본. 본 것만 채워지고 나머지는 「?」. 명국은 모은 조각 수까지.
import { PAL, RARITY, EDITION_TINT } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite, measure } from '../../render/gfx.js';
import { PIECES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { MAXIMS } from '../../data/maxims.js';
import { MASTERS } from '../../data/masters.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { EDITIONS } from '../../data/editions.js';
import { button } from '../ui.js';
import { tipLines, miniShard, moveTip, fitText, cardBase } from '../parts.js';
import { drawIcon } from '../../render/icons.js';
import { OPENING_ORDER, UNLOCKS } from '../records.js';
import { pageHead, pageButtons } from './common.js';
import { PAGE, PAD_CARD, LIST_GAP, GAP_GROUP, textY, rowBoxH } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const TABS = [['maxims', '격언'], ['pieces', '기물'], ['masters', '명인'], ['legends', '명국'], ['openings', '오프닝'], ['editions', '판본']];

export class CodexScreen {
  constructor(app) { this.app = app; this.tab = 'maxims'; this.page = 0; }
  entries() {
    const c = this.app.records.codex;
    if (this.tab === 'maxims') return MAXIMS.map((m) => ({ id: m.id, seen: !!c.maxims[m.id], name: m.name, tip: () => tipLines(m.name, [m.text, `${m.verb} · $${m.price}`]), col: RARITY[m.rarity] }));
    // 기물: 체스 여섯과 이형 아홉(이형은 행마 한 줄)
    if (this.tab === 'pieces') return Object.values(PIECES).map((p) => ({ id: p.id, seen: true, name: PIECE_NAME[p.id], piece: p.id, tip: () => moveTip(PIECE_NAME[p.id], p.id, [PIECE_MOVE[p.id] || '', `값 ${p.value}`]), col: p.fairy ? PAL.gold : PAL.dim }));
    if (this.tab === 'masters') return MASTERS.map((m) => ({ id: m.id, seen: !!c.masters[m.id], name: m.name, tip: () => tipLines(`명인 ${m.name}`, m.text), col: PAL.red }));
    if (this.tab === 'legends') return LEGENDS.map((l) => ({ id: l.id, seen: (c.legends[l.id] || 0) > 0 || !!c.legendsDone[l.id], name: l.name, parts: c.legends[l.id] || 0, done: !!c.legendsDone[l.id], tip: () => tipLines(l.name, [l.story, `전설: ${l.text}`, (c.legends[l.id] || 0) >= 1 ? `재현: ${l.feat}` : '']), col: PAL.gold }));
    if (this.tab === 'openings') return OPENING_ORDER.map((id) => { const o = OPENINGS[id]; const u = UNLOCKS.find((x) => x.id === id); const open = this.app.records.unlocked.openings.includes(id); return { id, seen: open, name: o.name, tip: () => (open ? tipLines(o.name, o.text) : tipLines('잠김', u.text)), col: PAL.gold }; });
    return EDITIONS.map((e) => ({ id: e.id, seen: !!c.editions[e.id], name: e.name, tip: () => tipLines(e.name, e.text), col: EDITION_TINT[e.id] }));
  }
  // 판 밖 틀: 머리줄(제목 · 탭 · 모은 수) + 격자(다섯 칸 × 일곱 줄, 넘치면 쪽) + 맨 아래 단추 줄. 칸 말풍선은 칸 바로 아래(마지막 줄은 위)
  draw(ctx, ui) {
    pageHead(ctx, '도감');
    // 탭은 제목 오른쪽부터(영어 제목이 길어도 겹치지 않게)
    const tx0 = Math.max(44, PAGE.titleX + measure('도감', true) + 8);
    TABS.forEach(([id, label], i) => button(ctx, ui, `codex:tab:${id}`, tx0 + i * 58, 5, 54, 16, label, { tone: this.tab === id ? 'gold' : 'plain', onClick: () => { this.tab = id; this.page = 0; this.app.sfx('pick'); } }));
    const list = this.entries();
    const seen = list.filter((e) => e.seen).length;
    text(ctx, `${seen} / ${list.length}`, W - PAGE.titleX, PAGE.titleY, PAL.dim, { align: 'right' });
    // 칸 하나 = 이름 한 줄(안 여백 PAD_CARD). 줄 수는 본 칸(머리줄 아래 ~ 단추 줄 위 묶음 틈)에 들어가는 만큼
    const cols = 5, cw = 88, ch = rowBoxH(PAD_CARD), gap = 4;
    const rows = Math.floor((PAGE.btnY - GAP_GROUP - PAGE.bodyY + gap) / (ch + gap)), per = cols * rows;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(this.page || 0, pages - 1);
    const P = PAD_CARD;
    list.slice(page * per, page * per + per).forEach((e, i) => {
      const x = 12 + (i % cols) * (cw + gap), y = PAGE.bodyY + Math.floor(i / cols) * (ch + gap);
      const id = `codex:${e.id}`;
      ui.region(id, x, y, cw, ch, { tip: e.seen ? e.tip : null });
      openBox('card', x, y, cw, ch, P, { name: `도감 ${e.id}` });
      if (!e.seen) {
        box(ctx, x, y, cw, ch, PAL.feltDk, PAL.frameDk);
        text(ctx, '?', x + cw / 2, y + textY(P), PAL.dimDk, { align: 'center', bold: true });
        closeBox();
        return;
      }
      cardBase(ctx, x, y, cw, ch, { fill: e.done ? '#f6d98a' : PAL.card, hover: ui.isHover(id) });
      rect(ctx, x + 1, y + 2, 2, ch - 3, e.col);
      // 오른쪽 그림(아이콘 12 · 기물 16 · 조각 셋)은 오른쪽 안 여백 안, 이름은 그 왼쪽까지
      const right = e.piece ? 16 + 2 : this.tab === 'maxims' || this.tab === 'legends' ? 12 + 3 : e.parts != null ? 18 + 3 : 0;
      fitText(ctx, e.name, x + P, y + textY(P), cw - P * 2 - right, PAL.cardInk);
      if (this.tab === 'maxims' || this.tab === 'legends') drawIcon(ctx, e.id, x + cw - P - 12, y + Math.floor((ch - 12) / 2), 0.9);
      if (e.piece) sprite(ctx, e.piece, 'w', x + cw - P - 16, y + Math.floor((ch - 22) / 2));
      if (e.parts != null) for (let k = 0; k < 3; k++) { if (k < e.parts) miniShard(ctx, x + cw - P - 18 + k * 6, y + ch - P - 5, PAL.goldDk); }
      closeBox();
    });
    button(ctx, ui, 'codex:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '돌아가기', { onClick: () => this.app.go('title') });
    if (pages > 1) pageButtons(ctx, ui, 'codex', page, pages, (p) => { this.page = p; });
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') this.app.go('title');
    const i = TABS.findIndex(([id]) => id === this.tab);
    if (k === 'ArrowRight') { this.tab = TABS[(i + 1) % TABS.length][0]; this.page = 0; }
    if (k === 'ArrowLeft') { this.tab = TABS[(i + TABS.length - 1) % TABS.length][0]; this.page = 0; }
  }
}
