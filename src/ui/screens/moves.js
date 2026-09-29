// 행마 보기(덮개, CHM-22): 대국 오른쪽 위 「행마」 단추. 지금 판과 손에 있는 기물의 행마 그림을 한 장에.
// 처음 보는 특수 기물이 맨 앞(본 것은 records.movesSeen), 판에 있는 기물은 금빛 테. 카드를 가리키면 행마 글.
import { PAL } from '../../render/palette.js';
import { W, text, box, frame, sprite, measure } from '../../render/gfx.js';
import { button } from '../ui.js';
import { tipLines, fitText } from '../parts.js';
import { moveDiagram, hasDiagram, DIAG_SIZE } from '../diagram.js';
import { PIECES, FAIRIES } from '../../data/pieces.js';
import { PIECE_NAME, PIECE_MOVE } from '../words.js';
import { isHidden } from '../../sim/battle.js';
import { PAD_BOX, PAD_CARD, GAP_GROUP, flow, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';

const ORDER = ['P', 'N', 'B', 'R', 'Q', 'K', ...FAIRIES];
const COLS = 4, CW = 104, GAP = 6;
// 카드: 안 여백 → 행마 그림(34) | 이름 줄(14) · 틈 2 · 기물(22) → 안 여백
const cardH = () => PAD_CARD * 2 + Math.max(DIAG_SIZE, 14 + 2 + 22);

// 보일 기물: [{ t, board, hand, fresh }] — 처음 보는 특수 기물 → 특수 기물 → 체스 기물
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

export class MovesScreen {
  constructor(app, { battle = null } = {}) {
    this.app = app;
    const b = battle ? battle.live() || battle.b : app.run && app.run.battle;
    const rec = app.records;
    this.list = movesList(b, rec.movesSeen || {});
    // 본 것으로 적는다(다음에 열면 맨 앞에 서지 않는다)
    rec.movesSeen = { ...(rec.movesSeen || {}), ...Object.fromEntries(this.list.filter((x) => x.fairy).map((x) => [x.t, true])) };
    app.saveRecords();
  }
  draw(ctx, ui) {
    const app = this.app, list = this.list;
    const CH = cardH(), rows = Math.max(1, Math.ceil(list.length / COLS)), cols = Math.min(COLS, Math.max(1, list.length));
    // 막간 상자(hug): 머리 줄(제목 왼쪽 · 돌아가기 오른쪽, 단추 높이) → 묶음 틈 → 카드 줄들(사이 GAP)
    // 돌아가기를 머리 줄에 둔다: 카드를 가리키면 말풍선이 카드 아래로 뜨는데, 그 자리에 누를 것이 없게
    const f = flow(PAD_BOX), by = f.space(18), ty = textY(by, 18) - 1;
    const top = f.gap(GAP_GROUP).space(rows * CH + (rows - 1) * GAP);
    const w = Math.max(160, PAD_BOX * 2 + cols * CW + (cols - 1) * GAP), h = f.y + PAD_BOX;
    const x = Math.floor((W - w) / 2), y = Math.floor((270 - h) / 2);
    openBox('panel', x, y, w, h, PAD_BOX, { name: '행마 보기' });
    box(ctx, x, y, w, h, PAL.feltDk, PAL.frameHi);
    text(ctx, '행마', x + PAD_BOX, y + ty, PAL.gold, { bold: true });
    const x0 = x + Math.floor((w - (cols * CW + (cols - 1) * GAP)) / 2);
    list.forEach((it, i) => {
      const cx = x0 + (i % COLS) * (CW + GAP), cy = y + top + Math.floor(i / COLS) * (CH + GAP);
      ui.region(`moves:${it.t}`, cx, cy, CW, CH, { tip: () => tipLines(PIECE_NAME[it.t], PIECE_MOVE[it.t]) });
      openBox('card', cx, cy, CW, CH, PAD_CARD, { name: `행마 ${it.t}` });
      box(ctx, cx, cy, CW, CH, '#132019', it.board ? PAL.gold : PAL.frameDk);
      if (it.board) frame(ctx, cx + 1, cy + 1, CW - 2, CH - 2, PAL.goldDk);
      moveDiagram(ctx, it.t, cx + PAD_CARD, cy + PAD_CARD, { dir: it.hand ? 1 : -1 });
      const tx = cx + PAD_CARD + DIAG_SIZE + 5;
      fitText(ctx, PIECE_NAME[it.t], tx, textY(cy + PAD_CARD), cx + CW - PAD_CARD - tx, it.fairy ? PAL.gold : PAL.ink);
      sprite(ctx, it.t, it.hand ? 'w' : 'b', tx, cy + CH - PAD_CARD - 22);
      if (it.fresh) text(ctx, '새로', cx + CW - PAD_CARD - measure('새로', true), cy + CH - PAD_CARD - 11, PAL.gold, { bold: true });
      closeBox();
    });
    const bw = Math.max(64, measure('돌아가기', true) + 8);
    button(ctx, ui, 'moves:back', x + w - PAD_BOX - bw, y + by, bw, 18, '돌아가기', { onClick: () => app.closeOverlay() });
    closeBox();
  }
  key(k) { if (k === 'Escape' || k === 'Enter') this.app.closeOverlay(); }
}
