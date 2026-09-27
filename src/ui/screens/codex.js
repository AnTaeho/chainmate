// 도감: 격언 · 명인 · 명국 · 오프닝 · 판본. 본 것만 채워지고 나머지는 「?」. 명국은 모은 조각 수까지.
import { PAL, RARITY, EDITION_TINT } from '../../render/palette.js';
import { W, H, text, box, rect, frame, sprite } from '../../render/gfx.js';
import { PIECES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { MAXIMS } from '../../data/maxims.js';
import { MASTERS } from '../../data/masters.js';
import { LEGENDS } from '../../data/legends.js';
import { OPENINGS } from '../../data/openings.js';
import { EDITIONS } from '../../data/editions.js';
import { button } from '../ui.js';
import { tipLines, miniShard, moveTip } from '../parts.js';
import { drawIcon } from '../../render/icons.js';
import { OPENING_ORDER, UNLOCKS } from '../records.js';

const TABS = [['maxims', '격언'], ['pieces', '기물'], ['masters', '명인'], ['legends', '명국'], ['openings', '오프닝'], ['editions', '판본']];

export class CodexScreen {
  constructor(app) { this.app = app; this.tab = 'maxims'; }
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
  draw(ctx, ui) {
    text(ctx, '도감', 12, 8, PAL.gold, { bold: true });
    TABS.forEach(([id, label], i) => button(ctx, ui, `codex:tab:${id}`, 44 + i * 58, 5, 54, 16, label, { tone: this.tab === id ? 'gold' : 'plain', onClick: () => { this.tab = id; this.app.sfx('pick'); } }));
    rect(ctx, 8, 25, W - 16, 1, PAL.feltHi);
    const list = this.entries();
    const seen = list.filter((e) => e.seen).length;
    text(ctx, `${seen} / ${list.length}`, W - 12, 8, PAL.dim, { align: 'right' });
    const cols = 5, cw = 88, ch = 24;
    list.forEach((e, i) => {
      const x = 12 + (i % cols) * (cw + 4), y = 32 + Math.floor(i / cols) * (ch + 4);
      const id = `codex:${e.id}`;
      ui.region(id, x, y, cw, ch, { tip: e.seen ? e.tip : null });
      if (!e.seen) {
        box(ctx, x, y, cw, ch, PAL.feltDk, PAL.frameDk);
        text(ctx, '?', x + cw / 2, y + 6, PAL.dimDk, { align: 'center', bold: true });
        return;
      }
      box(ctx, x, y, cw, ch, e.done ? '#f6d98a' : PAL.card, ui.isHover(id) ? PAL.gold : PAL.frameDk);
      rect(ctx, x + 1, y + 2, 2, ch - 3, e.col);
      text(ctx, e.name, x + 6, y + 6, PAL.cardInk, { bold: true });
      if (this.tab === 'maxims' || this.tab === 'legends') drawIcon(ctx, e.id, x + cw - 15, y + 6, 0.9);
      if (e.piece) sprite(ctx, e.piece, 'w', x + cw - 19, y + 1);
      if (e.parts != null) for (let k = 0; k < 3; k++) { if (k < e.parts) miniShard(ctx, x + cw - 36 + k * 6, y + 17, PAL.goldDk); }
    });
    button(ctx, ui, 'codex:back', 12, H - 26, 80, 18, '돌아가기', { onClick: () => this.app.go('title') });
  }
  key(k) {
    if (k === 'Escape' || k === 'Enter') this.app.go('title');
    const i = TABS.findIndex(([id]) => id === this.tab);
    if (k === 'ArrowRight') this.tab = TABS[(i + 1) % TABS.length][0];
    if (k === 'ArrowLeft') this.tab = TABS[(i + TABS.length - 1) % TABS.length][0];
  }
}
