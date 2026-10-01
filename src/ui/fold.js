// 설명 자리 접기(CHM-34, docs/design-notes/layout.md 「설명 자리 규칙」): 판 틀의 설명 자리는 왼쪽 칸이고, 그 칸에는 판넬(머리 칸 · 짜임 칸 ·
// 값 × 배수 · 사슬 칸 · 아래 칸)이 쌓여 있다. 설명 묶음 · 처음 안내가 뜨는 동안, 묶음에 닿은 판넬 줄은 비운다(판넬 테와 바탕은 남는다) —
// 반쯤 가려진 글이 묶음 밖으로 비어져 나오지 않게. 묶음에 안 닿은 줄(관 · 화면 이름 · 가리킨 것)은 그대로 둔다.
// 화면은 왼쪽 칸 판넬을 그릴 때 ui.sideItem으로 적고(ui.js), app.js가 화면을 그린 바로 뒤(연출 · 안내 · 말풍선보다 먼저) foldSide를 부른다.
// 판 밖 틀('below')은 접지 않는다 — 격자 · 카드 줄이 그 화면의 본 내용이다.
// 시안(docs/shots/overlap/draft-*): 1 닿은 줄만 비우기(정함) · 2 흐리게 덮기(가려진 줄이 흐린 채 비친다) · 3 판넬째 걷기(관 · 화면 이름까지 사라진다)
import { PAL } from '../render/palette.js';
import { rect } from '../render/gfx.js';
import { foldLog } from '../render/layoutlog.js';

// 접는 모양: 'blank' 닿은 줄만 비우기(정한 안) · 'dim' 흐리게 덮기 · 'gone' 판넬째 걷기 · 'off' 접지 않음(시안 · 견주기용)
export const FOLD = { style: 'blank' };
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// items: ui.side(왼쪽 칸 판넬 [{ x, y, w, h, rows, blank }]), cover: 묶음 네모, anchor: 가리킨 것.
// ground(r): 그 네모를 배경(펠트)으로 다시 칠한다
export function foldSide(ctx, items, cover, anchor, ground = null) {
  if (FOLD.style === 'off' || !cover) return;
  // 받침(lift: 바깥 1px 테 + 아래 · 오른쪽 1px 그늘)까지
  const c = { x: cover.x - 1, y: cover.y - 1, w: cover.w + 3, h: cover.h + 3 };
  for (const it of items) {
    if (!cross(it, c)) continue;
    if (FOLD.style === 'gone' && ground) { ground(it); foldLog(it); continue; }
    const inner = { x: it.x + 1, y: it.y + 2, w: it.w - 2, h: it.h - 4 };
    if (it.rows) {
      // 줄이 있는 판넬: 묶음에 닿은 줄들이 든 띠만 비운다. 위 · 아래로 닿지 않은 줄은 남는다
      const hit = it.rows.filter(([t, b]) => t < c.y + c.h && c.y < b);
      if (!hit.length) continue;
      const above = it.rows.some(([, b]) => b <= c.y), below = it.rows.some(([t]) => t >= c.y + c.h);
      const y0 = above ? Math.min(...hit.map(([t]) => t)) : inner.y;
      const y1 = below ? Math.max(...hit.map(([, b]) => b)) : inner.y + inner.h;
      paint(ctx, { x: inner.x, y: y0, w: inner.w, h: y1 - y0 });
      continue;
    }
    if (anchor && cross(it, anchor)) {
      // 줄 없는 판넬이 가리킨 것을 품으면: 가리킨 것은 두고, 묶음이 있는 쪽(아래 · 위)만 비운다
      const down = c.y >= anchor.y + anchor.h - 1;
      const y0 = down ? anchor.y + anchor.h : inner.y, y1 = down ? inner.y + inner.h : anchor.y;
      if (y1 > y0) paint(ctx, { x: inner.x, y: y0, w: inner.w, h: y1 - y0 });
      continue;
    }
    if (it.blank && FOLD.style === 'blank') { it.blank(ctx, ground); foldLog(it); continue; }
    paint(ctx, inner);
  }
}
function paint(ctx, r) {
  if (r.h <= 0) return;
  if (FOLD.style === 'dim') {
    ctx.globalAlpha = 0.78; rect(ctx, r.x, r.y, r.w, r.h, PAL.feltDk); ctx.globalAlpha = 1;
    return;
  }
  rect(ctx, r.x, r.y, r.w, r.h, PAL.feltDk);
  foldLog(r);
}
