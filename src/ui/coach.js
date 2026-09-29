// 처음 안내: 무언가를 처음 만나는 순간에 그 자리를 가리키는 한 줄(말풍선 + 화살표).
//   hint  — 화면이 그리는 중에 app.hint(id, 구역 id)로 부른다. 처음 한 번만, 누르면 사라지고 본 것으로 적는다.
//           설정 「처음 안내」로 끄고, 「안내 다시 보기」로 본 기록을 지운다.
//   guide — 수업(상점과 가족)처럼 차례로 따라 하는 길. 지금 가리키는 구역만 누를 수 있다.
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect, frame, lift } from '../render/gfx.js';
import { wrap } from '../render/text.js';
import { placeBubble, noteMode, noteWidth } from './placement.js';
import { PAD_BOX, GAP_GROUP, flow, BTN_S, inkY } from './frame.js';
import { openBox, closeBox } from '../render/layoutlog.js';

// 처음 만나는 것마다 한 줄. 글은 「언제 → 무엇」, 한 문장.
export const HINTS = {
  shop: '산 격언은 오른쪽 칸에서 판 내내 힘을 낸다',
  pack: '셋 중 하나를 고른다. 넘겨도 된다',
  scroll: '두루마리를 누르고 주머니의 기물을 골라 쓴다',
  draft: '레퍼토리는 판 끝까지 간다. 레퍼토리마다 시너지가 다르다',
  family: '같은 시너지를 2 · 4 · 6개 모으면 효과가 켜진다',
  master: '마스터는 규칙 하나를 비튼다',
  golden: '금빛 적을 먹고 이기면 금빛 꾸러미를 받는다',
  trait: '발밑 문양은 특성. 가리키면 무엇을 하는지 보인다',
  things: '벽과 보석은 가리키면 무엇을 하는지 보인다',
  fairy: '특수 기물은 체스에 없는 행마를 쓴다. 누르면 먹을 칸이 보인다',
  incoming: '점선 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다',
  maximSell: '격언을 누르면 팔 수 있고, 끌면 순서가 바뀐다',
  joseki: '고른 레퍼토리는 가리키면 무엇을 하는지 보인다',
  tactic: '전술은 떨구기 전에 눌러 이번 대국에 한 번 쓴다',
  bigText: '창이 작아 글이 작다. 설정에서 큰 글자를 켤 수 있다',
  clock: '대국을 지면 시계 한 칸이 준다. 시계를 다 쓰면 판이 끝난다',
  // 세력(factions.js): 새 세력을 처음 만나는 관 선택에서, 버릇만
  faction_peasants: '농민군 땅이다. 적 폰이 옆 칸도 지킨다',
  faction_cavalry: '기병대 땅이다. 증원이 나이트 무리로 온다',
  faction_abbey: '수도원 땅이다. 돌기둥이 길을 막는다',
  faction_fortress: '성채 땅이다. 성벽을 넘는 길은 문 하나다',
  faction_hunters: '숲 사냥꾼 땅이다. 위 두 줄은 숲이라 떨굴 수 없다',
  faction_heralds: '전령단 땅이다. 증원이 하나 더 온다',
  faction_mercs: '용병단 땅이다. 적 특성이 두 배로 붙는다',
  faction_royal: '왕궁 근위 땅이다. 킹을 지키는 적이 하나 더 있다',
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
  app.hintRect = null;
  if (!h) { app.hintShown = null; return; }
  const r = ui.regions.find((q) => q.id === h.regionId);
  if (!r) return;
  app.hintShown = h;
  bubble(ctx, ui, app, r, HINTS[h.id]);
}

// 말풍선 + 화살표: 자리는 설명 묶음과 같은 규칙(placement.js placeBubble).
//   판 틀: 왼쪽 칸에 가리키는 것의 줄 높이로, 화살표는 오른쪽(가리키는 것 쪽). 가리키는 것에는 금빛 테가 깜박인다.
//          왼쪽 칸 안의 것을 가리키면 그 바로 아래(모자라면 위), 화살표는 위(아래)로.
//   판 밖 틀: 가리키는 것 바로 아래(모자라면 위).
// ok가 있으면 「알았다」 단추(따라 하는 길).
export function bubble(ctx, ui, app, r, say, { ok = null } = {}) {
  const mode = noteMode(app.screen);
  const w = noteWidth(mode);
  const lines = wrap(say, w - PAD_BOX * 2);
  // 안 여백 → 글 줄들 → (묶음 틈 → 「알았다」 단추 줄) → 안 여백
  const f = flow(PAD_BOX);
  const ys = lines.map(() => f.line());
  const okY = ok ? f.gap(GAP_GROUP).space(BTN_S) : 0;
  const h = f.y + PAD_BOX;
  const p = placeBubble(mode, r, h, { W, H });
  const { x, y } = p;
  app.hintRect = { x, y, w, h };
  if (r && p.arrow === 'right') {
    // 가리키는 것: 금빛 테(1px)가 깜박인다
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(app.time * 6);
    frame(ctx, r.x, r.y, r.w, r.h, PAL.goldHi);
    ctx.globalAlpha = 1;
  }
  const bob = Math.round(Math.sin(app.time * 4));
  openBox('note', x, y + bob, w, h, PAD_BOX, { overlay: true, name: '처음 안내' });
  lift(ctx, x, y + bob, w, h);
  box(ctx, x, y + bob, w, h, PAL.card, PAL.gold);
  if (r && p.arrow) {
    for (let k = 0; k < 5; k++) {
      const n = (4 - k) * 2 + 1, c = k === 0 ? PAL.gold : PAL.card;
      if (p.arrow === 'right') {
        const ay = Math.max(y + 4, Math.min(y + h - 5, Math.round(r.y + r.h / 2) - bob)) + bob;
        rect(ctx, x + w + k, ay - (4 - k), 1, n, c);
      } else {
        const ax = Math.max(x + 6, Math.min(x + w - 7, Math.round(r.x + r.w / 2)));
        rect(ctx, ax - (4 - k), p.arrow === 'up' ? y + bob - 1 - k : y + bob + h + k, n, 1, c);
      }
    }
  }
  lines.forEach((l, k) => text(ctx, l, x + PAD_BOX, y + bob + ys[k], PAL.cardInk, { bold: k === 0 && lines.length === 1 }));
  if (ok) {
    const bx = x + w - PAD_BOX - 50, by = y + bob + okY;
    ui.region('guide:ok', bx, by, 50, BTN_S, { onClick: ok });
    openBox('edge', bx, by, 50, BTN_S, 1, { name: '알았다' });
    box(ctx, bx, by, 50, BTN_S, ui.isHover('guide:ok') ? PAL.goldHi : PAL.gold, PAL.frameDk);
    text(ctx, '알았다', bx + 25, inkY(by, BTN_S), PAL.linkInk, { align: 'center', bold: true });
    closeBox();
  }
  closeBox();
}
