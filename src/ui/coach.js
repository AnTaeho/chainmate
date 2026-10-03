// 처음 안내: 무언가를 처음 만나는 순간에 그 자리를 가리키는 한 줄(말풍선 + 화살표).
//   hint  — 화면이 그리는 중에 app.hint(id, 구역 id)로 부른다. 처음 한 번만, 누르면 사라지고 본 것으로 적는다.
//           설정 「처음 안내」로 끄고, 「안내 다시 보기」로 본 기록을 지운다.
//   guide — 수업(상점과 가족) · 첫 판 대본 대국처럼 차례로 따라 하는 길. 지금 가리키는 구역만 누를 수 있다.
//   말하는 이는 내 편 킹(bubble): 상아 몸 · 금관 킹이 말풍선 머리에서 말하고, 말할 때 살짝 들썩이며 기쁠 때 금관이 반짝인다.
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect, frame, lift, sprite, measure } from '../render/gfx.js';
import { SPR, SW } from '../render/sprites.js';
import { LOOK } from '../render/look.js';
import { wrap } from '../render/text.js';
import { L } from './lang.js';
import { placeBubble, noteMode, noteWidth } from './placement.js';
import { PAD_BOX, GAP_GROUP, GAP_IN, flow, BTN_S, inkY, textY } from './frame.js';
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
  next: '흐린 둘은 다음에 손에 들어올 기물. 위가 먼저 온다',
  maximSell: '격언을 누르면 팔 수 있고, 끌면 순서가 바뀐다',
  joseki: '고른 레퍼토리는 가리키면 무엇을 하는지 보인다',
  tactic: '전술은 떨구기 전에 눌러 이번 대국에 한 번 쓴다',
  bigText: '창이 작아 글이 작다. 설정에서 큰 글자를 켤 수 있다',
  clock: '대국을 지면 시계 한 칸이 준다. 시계를 다 쓰면 판이 끝난다',
  crack: '혼에 금이 갔다. 금빛 적 · 마스터의 상자 · 깨우기로 깨어난다',
  replay: '이길 길도 이 대국의 실제 뽑기와 증원 그대로 둔 길이다',
  brilliant: '이 기물로 곧바로 메이트하면 탁월수. 바친 기물이 무거울수록 배수가 커지고 명경기 조각도 하나 얻는다',
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

// 화면이 그리는 중에 부른다: 이번 프레임에 보일 수 있는 안내 후보(부른 차례대로).
// 화면은 말하는 것이 그 순간 화면에 있을 때만 부른다(격언 안내는 진열에 격언이 있을 때 — CHM-36).
export function hint(app, id, regionId) {
  if (app.guide || app.settings.coach === false || seen(app, id) || !HINTS[id]) return;
  if (!app.hintNow) app.hintNow = [];
  app.hintNow.push({ id, regionId });
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
  if (!g || app.overlay) return true;   // 덮개(행마 보기 · 멈춤)는 길과 상관없이 누른다
  const st = g.steps[g.i];
  if (!st || (g.hold && g.hold(app))) return true;   // 길이 쉬는 동안(연출 중)은 막지 않는다
  const r = guideRegion(app, st);
  // 가리키는 구역 밖은 누를 수 없다(「알았다」 · 「건너뛰기」 단추는 안내가 그린다). 멈춤(≡)은 늘 눌린다
  const inside = (q) => q && x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h;
  const reg = (id) => app.ui.regions.find((q) => q.id === id);
  return inside(r) || inside(reg('guide:ok')) || inside(reg('guide:skip')) || inside(reg('btn:pause'));
}

function guideRegion(app, st) {
  const id = typeof st.target === 'function' ? st.target(app) : st.target;
  if (!id) return null;
  return app.ui.regions.find((q) => q.id === id) || null;
}

// opts.hold(app): 참이면 길이 쉰다(어둡게 누르지도, 말하지도, 막지도 않는다 — 대국 연출 중)
// opts.skip(): 있으면 말풍선에 「건너뛰기」 단추
export function startGuide(app, steps, onDone, opts = {}) {
  app.guide = { steps, i: 0, onDone, t: 0, hold: opts.hold || null, skip: opts.skip || null };
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

// 이번 프레임에 뜰 킹 말풍선의 자리(그리기 전에 — 설명 자리 접기 fold.js가 쓴다). 없으면 null. 상태는 바꾸지 않는다
export function coachPlan(app) {
  const g = app.guide;
  let r = null, say = null, opts = {};
  if (g) {
    const st = g.steps[g.i];
    if (!st || (g.hold && g.hold(app))) return null;
    if (st.screen && app.screen && app.screen.name !== st.screen) return null;
    r = guideRegion(app, st); say = st.say;
    opts = { ok: st.ok ? '알았다' : null, okLabel: st.okLabel, skip: st.noSkip ? null : g.skip };
  } else {
    const onScreen = (q) => q && q.w > 0 && q.h > 0 && q.x >= 0 && q.y >= 0 && q.x + q.w <= W && q.y + q.h <= H;
    for (const c of app.hintNow || []) { const q = app.ui.regions.find((x) => x.id === c.regionId); if (onScreen(q)) { r = q; say = HINTS[c.id]; break; } }
    if (!r) return null;
  }
  return { r, rect: bubbleRect(app, r, say, opts) };
}
// 킹 말풍선 네모(bubble과 같은 셈)
function bubbleRect(app, r, say, { ok = null, okLabel = null, skip = null } = {}) {
  const mode = noteMode(app.screen);
  const w = noteWidth(mode);
  const lay = bubbleLayout(say, w, { ok: ok ? okLabel || '알았다' : null, skip: skip ? '건너뛰기' : null });
  const p = placeBubble(mode, r, lay.h, { W, H });
  return { x: p.x, y: p.y, w, h: lay.h, arrow: p.arrow, lay };
}

// 그리기(맨 위, 말풍선보다 먼저)
export function drawCoach(ctx, app) {
  const ui = app.ui;
  const g = app.guide;
  app.coachDim = 0;
  if (g) {
    const st = g.steps[g.i];
    app.hintNow = null;
    if (!st || (g.hold && g.hold(app))) return;
    if (st.screen && app.screen && app.screen.name !== st.screen) return;
    const r = guideRegion(app, st);
    if (r) {
      // 가리키는 곳만 밝게
      ctx.globalAlpha = 0.45;
      app.coachDim = 0.45; // 여백 판도 같이 어둡게(main.js)
      rect(ctx, 0, 0, W, r.y, PAL.shadow); rect(ctx, 0, r.y + r.h, W, H - r.y - r.h, PAL.shadow);
      rect(ctx, 0, r.y, r.x, r.h, PAL.shadow); rect(ctx, r.x + r.w, r.y, W - r.x - r.w, r.h, PAL.shadow);
      ctx.globalAlpha = 1;
    }
    const okFn = () => { if (typeof st.ok === 'function') st.ok(app); g.i++; g.t = 0; if (g.i >= g.steps.length) { app.guide = null; if (g.onDone) g.onDone(); } };
    bubble(ctx, ui, app, r, st.say, { ok: st.ok ? okFn : null, okLabel: st.okLabel, skip: st.noSkip ? null : g.skip, joy: !!st.joy });
    return;
  }
  const list = app.hintNow || [];
  app.hintNow = null;
  app.hintRect = null;
  // 앞의 후보부터, 가리킬 구역이 이번 프레임 화면 안에 그려진 것 하나
  const onScreen = (q) => q && q.w > 0 && q.h > 0 && q.x >= 0 && q.y >= 0 && q.x + q.w <= W && q.y + q.h <= H;
  let h = null, r = null;
  for (const c of list) { const q = ui.regions.find((x) => x.id === c.regionId); if (onScreen(q)) { h = c; r = q; break; } }
  if (!h) { app.hintShown = null; return; }
  app.hintShown = h;
  bubble(ctx, ui, app, r, HINTS[h.id]);
}

// 킹 말풍선: 자리는 설명 묶음과 같은 규칙(placement.js placeBubble).
//   판 틀: 왼쪽 칸에 가리키는 것의 줄 높이로, 화살표는 오른쪽(가리키는 것 쪽). 가리키는 것에는 금빛 테가 깜박인다.
//          왼쪽 칸 안의 것을 가리키면 그 바로 아래(모자라면 위), 화살표는 위(아래)로.
//   판 밖 틀: 가리키는 것 바로 아래(모자라면 위).
// 쌓기: 안 여백 → 머리(킹 얼굴 · 이름 「킹」, KING_HEAD) → 묶음 안 틈 → 글 줄들 → (묶음 틈 → 단추 줄) → 안 여백
// 시안 셋(docs/shots/tutorial/draft-*)에서 1 「머리줄」을 골랐다: 2 「기대기」는 킹이 상자 위 칸을 덮고, 3 「초상 칸」은 첫 줄이 좁아 글이 끊겼다.
// ok가 있으면 「알았다」(okLabel), skip이 있으면 「건너뛰기」 단추. joy면 금관이 반짝인다.
export const KING_HEAD = 18;
const KING_NAME = '킹';
// 금관 자리(킹 스프라이트의 c 칸, 위 여덟 줄)
const CROWN = (() => { const out = []; SPR.K.slice(0, 8).forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'c') out.push([i, j]); }); return out; })();
// 말이 바뀐 때(들썩임은 말이 바뀐 뒤 잠깐)
let talkSay = null, talkT0 = 0;
// 단추 폭: 글에 맞춘다(글과 테 사이 4 이상)
export const bubbleBtnW = (label) => Math.max(40, measure(label, true) + 8);
export function bubbleLayout(say, w, { ok = null, skip = null } = {}) {
  const f = flow(PAD_BOX);
  const headTop = f.space(KING_HEAD);
  f.gap(GAP_IN);
  const lines = wrap(say, w - PAD_BOX * 2);
  const ys = lines.map(() => f.line());
  // 단추 줄: 「알았다」 · 「건너뛰기」가 한 줄에 안 들어가면 두 줄(「알았다」 위)
  const labels = [ok, skip].filter(Boolean);
  const oneRow = labels.reduce((a, l) => a + bubbleBtnW(l) + 4, -4) <= w - PAD_BOX * 2;
  const rows = labels.length ? (oneRow ? [labels] : labels.map((l) => [l])) : [];
  const rowYs = rows.map((_, k) => (k ? f.gap(GAP_IN) : f.gap(GAP_GROUP)).space(BTN_S));
  return { lines, ys, headTop, rows, rowYs, h: f.y + PAD_BOX };
}
export function drawKing(ctx, app, x, y, { joy = false } = {}) {
  const calm = LOOK.calm;
  // 말이 바뀐 뒤 0.9초 동안 1px 들썩인다(말하는 중)
  const t = app.time - talkT0;
  const hop = !calm && t < 0.9 && Math.floor(t * 8) % 2 ? -1 : 0;
  sprite(ctx, 'K', 'w', x, y + hop);
  if (!joy) return;
  // 기쁨: 금관 칸이 차례로 빛나고, 관 둘레에 반짝이 넷
  const k = calm ? 0 : Math.floor(app.time * 10);
  CROWN.forEach(([i, j], n) => { if (calm || (n + k) % 4 === 0) rect(ctx, x + i, y + hop + j, 1, 1, PAL.white); });
  const stars = [[-3, 1], [SW + 1, 2], [-1, -3], [SW - 2, -3]];
  stars.forEach(([sx, sy], n) => {
    if (!calm && (Math.floor(app.time * 4) + n) % 2) return;
    const cx = x + sx, cy = y + hop + sy;
    rect(ctx, cx, cy - 1, 1, 3, PAL.goldHi); rect(ctx, cx - 1, cy, 3, 1, PAL.goldHi);
  });
}
export function bubble(ctx, ui, app, r, say, { ok = null, okLabel = null, skip = null, joy = false } = {}) {
  if (say !== talkSay) { talkSay = say; talkT0 = app.time; }
  const okText = ok ? okLabel || '알았다' : null, skipText = skip ? '건너뛰기' : null;
  const p = bubbleRect(app, r, say, { ok, okLabel, skip });
  const { x, y, w, h, lay } = p;
  app.hintRect = { x, y, w, h };
  if (r && p.arrow === 'right') {
    // 가리키는 것: 금빛 테(1px)가 깜박인다
    ctx.globalAlpha = LOOK.calm ? 1 : 0.6 + 0.4 * Math.sin(app.time * 6);
    frame(ctx, r.x, r.y, r.w, r.h, PAL.goldHi);
    ctx.globalAlpha = 1;
  }
  const bh = lay.h;
  openBox('note', x, y, w, bh, PAD_BOX, { overlay: true, name: '킹 말풍선' });
  lift(ctx, x, y, w, bh);
  box(ctx, x, y, w, bh, PAL.card, PAL.gold);
  if (r && p.arrow) {
    for (let k = 0; k < 5; k++) {
      const n = (4 - k) * 2 + 1, c = k === 0 ? PAL.gold : PAL.card;
      if (p.arrow === 'right') {
        const ay = Math.max(y + 4, Math.min(y + bh - 5, Math.round(r.y + r.h / 2)));
        rect(ctx, x + w + k, ay - (4 - k), 1, n, c);
      } else {
        const ax = Math.max(x + 6, Math.min(x + w - 7, Math.round(r.x + r.w / 2)));
        rect(ctx, ax - (4 - k), p.arrow === 'up' ? y - 1 - k : y + bh + k, n, 1, c);
      }
    }
  }
  const P = PAD_BOX;
  // 머리줄: 킹(16×22, 머리 줄 위로 조금 솟는다) · 이름 · 가는 줄
  drawKing(ctx, app, x + P - 2, y + lay.headTop - 6, { joy });
  const nw = measure(KING_NAME, true);
  text(ctx, KING_NAME, x + P + 18, textY(y + lay.headTop, KING_HEAD), PAL.goldDk, { bold: true });
  rect(ctx, x + P + 22 + nw, y + lay.headTop + 9, w - P * 2 - 22 - nw, 1, PAL.cardDim);
  lay.lines.forEach((l, k) => text(ctx, l, x + P, y + lay.ys[k], PAL.cardInk));
  const act = { [okText]: [ok, 'gold', 'guide:ok'], [skipText]: [skip, 'plain', 'guide:skip'] };
  lay.rows.forEach((row, k) => {
    const by = y + lay.rowYs[k];
    let bx = x + w - P;
    for (const label of row) {
      const [fn, tone, id] = act[label], bw = bubbleBtnW(label);
      bx -= bw;
      ui.region(id, bx, by, bw, BTN_S, { onClick: fn });
      openBox('edge', bx, by, bw, BTN_S, 1, { name: label });
      const hov = ui.isHover(id);
      box(ctx, bx, by, bw, BTN_S, tone === 'gold' ? (hov ? PAL.goldHi : PAL.gold) : hov ? PAL.cardHi : PAL.card, tone === 'gold' ? PAL.frameDk : PAL.goldDk);
      text(ctx, label, bx + bw / 2, inkY(by, BTN_S), tone === 'gold' ? PAL.linkInk : PAL.cardInk, { align: 'center', bold: true });
      closeBox();
      bx -= 4;
    }
  });
  closeBox();
}
