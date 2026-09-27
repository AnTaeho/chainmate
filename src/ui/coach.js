// 처음 안내: 무언가를 처음 만나는 순간에 그 자리를 가리키는 한 줄(말풍선 + 화살표).
//   hint  — 화면이 그리는 중에 app.hint(id, 구역 id)로 부른다. 처음 한 번만, 누르면 사라지고 본 것으로 적는다.
//           설정 「처음 안내」로 끄고, 「안내 다시 보기」로 본 기록을 지운다.
//   guide — 수업(상점과 가족)처럼 차례로 따라 하는 길. 지금 가리키는 구역만 누를 수 있다.
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect } from '../render/gfx.js';
import { wrap } from '../render/text.js';

// 처음 만나는 것마다 한 줄. 글은 「언제 → 무엇」, 한 문장.
export const HINTS = {
  shop: '격언은 판 내내 붙어 있다 — 사면 오른쪽 칸에 들어간다',
  pack: '셋 중 하나를 고른다 — 고르지 않고 넘겨도 된다',
  scroll: '두루마리를 누르고 주머니의 기물을 골라 쓴다',
  draft: '판 끝까지 가는 큰 선택 — 고른 정석에 따라 가족 방향이 정해진다',
  family: '같은 가족을 모으면 2 · 4 · 6에서 효과가 켜진다',
  master: '명인 대국 — 명인은 규칙 하나를 비튼다',
  golden: '금빛 적을 먹으면 금빛 꾸러미를 받는다',
  trait: '특성이 있는 적 — 가리키면 무엇을 하는지 보인다',
  things: '판 위의 벽 · 보석 — 가리키면 무엇을 하는지 보인다',
  fairy: '체스 밖의 행마를 가진 기물 — 누르면 먹을 수 있는 칸이 보인다',
  incoming: '점선 그림자는 증원 — 이 수가 끝나면 그 칸에 적이 들어온다',
  maximSell: '격언을 누르면 팔 수 있다 — 끌어서 순서를 바꾼다',
  joseki: '고른 정석 — 가리키면 무엇을 하는지 보인다',
  tactic: '묘수 — 떨구기 전에 눌러 이번 대국에 한 번 쓴다',
  bigText: '창이 작아 글이 작게 보인다 — 설정에서 큰 글자를 켤 수 있다',
};

const seen = (app, id) => !!(app.records.coachSeen && app.records.coachSeen[id]);

// 화면이 그리는 중에 부른다: 이번 프레임에 보일 수 있는 안내 후보
export function hint(app, id, regionId) {
  if (app.guide || app.settings.coach === false || seen(app, id) || !HINTS[id]) return;
  if (!app.hintNow) app.hintNow = { id, regionId };
}

export function markSeen(app, id) {
  if (!app.records.coachSeen) app.records.coachSeen = {};
  app.records.coachSeen[id] = true;
  app.saveRecords();
}

// 누르면: 떠 있는 안내는 본 것으로 사라진다(누른 것은 그대로 전해진다)
export function coachDown(app, x, y) {
  if (app.hintShown) { markSeen(app, app.hintShown.id); app.hintShown = null; app.hintNow = null; }
  const g = app.guide;
  if (!g) return true;
  const st = g.steps[g.i];
  if (!st) return true;
  const r = guideRegion(app, st);
  // 가리키는 구역 밖은 누를 수 없다(「알았다」 단추는 안내가 그린다)
  const inside = (q) => q && x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h;
  return inside(r) || inside(app.ui.regions.find((q) => q.id === 'guide:ok'));
}

function guideRegion(app, st) {
  if (!st.target) return null;
  return app.ui.regions.find((q) => q.id === st.target) || null;
}

export function startGuide(app, steps, onDone) {
  app.guide = { steps, i: 0, onDone, t: 0 };
}

// 매 프레임: 길의 걸음이 끝났나
export function updateGuide(app, dt) {
  const g = app.guide;
  if (!g) return;
  g.t += dt;
  const st = g.steps[g.i];
  if (st && st.done && st.done(app)) { g.i++; g.t = 0; }
  if (g.i >= g.steps.length) { app.guide = null; if (g.onDone) g.onDone(); }
}

// 그리기(맨 위, 말풍선보다 먼저)
export function drawCoach(ctx, app) {
  const ui = app.ui;
  const g = app.guide;
  if (g) {
    const st = g.steps[g.i];
    if (!st) return;
    if (st.screen && app.screen && app.screen.name !== st.screen) return;
    const r = guideRegion(app, st);
    if (r) {
      // 가리키는 곳만 밝게
      ctx.globalAlpha = 0.45;
      rect(ctx, 0, 0, W, r.y, PAL.shadow); rect(ctx, 0, r.y + r.h, W, H - r.y - r.h, PAL.shadow);
      rect(ctx, 0, r.y, r.x, r.h, PAL.shadow); rect(ctx, r.x + r.w, r.y, W - r.x - r.w, r.h, PAL.shadow);
      ctx.globalAlpha = 1;
    }
    bubble(ctx, ui, app, r, st.say, { ok: st.ok ? () => { g.i++; g.t = 0; if (g.i >= g.steps.length) { app.guide = null; if (g.onDone) g.onDone(); } } : null });
    return;
  }
  const h = app.hintNow;
  app.hintNow = null;
  if (!h) { app.hintShown = null; return; }
  const r = ui.regions.find((q) => q.id === h.regionId);
  if (!r) return;
  app.hintShown = h;
  bubble(ctx, ui, app, r, HINTS[h.id]);
}

// 말풍선 + 화살표: 구역 아래(자리가 없으면 위)에 한 줄. ok가 있으면 「알았다」 단추.
export function bubble(ctx, ui, app, r, say, { ok = null } = {}) {
  const w = 240;
  const lines = wrap(say, w - 12);
  const h = 8 + lines.length * 13 + (ok ? 20 : 0);
  // 자리: 구역 아래 → 위 → 오른쪽 → 가운데. side: 화살표가 나가는 쪽
  let x, y, side = null;
  if (!r) { x = Math.floor((W - w) / 2); y = 110; }
  else {
    x = Math.max(4, Math.min(W - w - 4, Math.round(r.x + r.w / 2 - w / 2)));
    if (r.y + r.h + 8 + h <= H - 2) { y = r.y + r.h + 7; side = 'up'; }
    else if (r.y - 8 - h >= 2 && r.y - 8 - h > 40) { y = r.y - 7 - h; side = 'down'; }
    else if (r.x + r.w + 8 + w <= W - 2) { x = r.x + r.w + 7; y = Math.max(2, Math.min(H - h - 2, Math.round(r.y + r.h / 2 - h / 2))); side = 'left'; }
    else { y = Math.max(2, r.y - 7 - h); side = y === 2 ? null : 'down'; }
  }
  const bob = Math.round(Math.sin(app.time * 4));
  box(ctx, x, y + bob, w, h, PAL.card, PAL.gold);
  if (r && side) {
    for (let k = 0; k < 5; k++) {
      const n = (4 - k) * 2 + 1, c = k === 0 ? PAL.gold : PAL.card;
      if (side === 'left') { const ay = Math.max(y + 4, Math.min(y + h - 5, Math.round(r.y + r.h / 2))) + bob; rect(ctx, x - 1 - k, ay - (4 - k), 1, n, c); }
      else {
        const ax = Math.max(x + 6, Math.min(x + w - 7, Math.round(r.x + r.w / 2)));
        rect(ctx, ax - (4 - k), side === 'up' ? y + bob - 1 - k : y + bob + h + k, n, 1, c);
      }
    }
  }
  lines.forEach((l, k) => text(ctx, l, x + 6, y + bob + 4 + k * 13, PAL.cardInk, { bold: k === 0 && lines.length === 1 }));
  if (ok) {
    const bx = x + w - 56, by = y + bob + h - 18;
    ui.region('guide:ok', bx, by, 50, 14, { onClick: ok });
    box(ctx, bx, by, 50, 14, ui.isHover('guide:ok') ? PAL.goldHi : PAL.gold, PAL.frameDk);
    text(ctx, '알았다', bx + 25, by + 1, PAL.linkInk, { align: 'center', bold: true });
  }
}
