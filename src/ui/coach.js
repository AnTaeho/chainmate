// 처음 안내: 무언가를 처음 만나는 순간에 그 자리를 가리키는 한 줄(말풍선 + 화살표).
//   hint  — 화면이 그리는 중에 app.hint(id, 구역 id)로 부른다. 처음 한 번만, 누르면 사라지고 본 것으로 적는다.
//           설정 「처음 안내」로 끄고, 「안내 다시 보기」로 본 기록을 지운다.
//   guide — 수업 「상점과 시너지」처럼 차례로 따라 하는 길. 지금 가리키는 구역만 누를 수 있다.
//   TAUGHT — 튜토리얼 수업이 가르친 안내. 그 수업을 끝낸 사람에게는 판 안에서 다시 말하지 않는다(records.lessonsSeen).
//   말하는 이는 내 편 킹(bubble): 상아 몸 · 금관 킹이 말풍선 머리에서 말하고, 말할 때 살짝 들썩이며 기쁠 때 금관이 반짝인다.
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect, rframe, lift, sprite, measure, R_BIG } from '../render/gfx.js';
import { buttonRow, rowWidth } from './ui.js';
import { SW } from '../render/sprites.js';
import { LOOK, live } from '../render/look.js';
import { wrap } from '../render/text.js';
import { L } from './lang.js';
import { placeBubble, noteMode, noteWidth } from './placement.js';
import { PAD_BOX, GAP_GROUP, GAP_IN, flow, BTN_H, SP, textY } from './frame.js';
import { openBox, closeBox } from '../render/layoutlog.js';

// 처음 만나는 것마다 한 줄. 글은 「언제 → 무엇」, 한 문장.
export const HINTS = {
  // 튜토리얼을 건너뛴 사람의 첫 대국 첫 안내: 손 카드를 가리킨다(누르면 사라지고 그 누름이 기물을 든다 — U-5)
  firstDrop: '기물을 눌러 빛나는 칸에 놓아 봐',
  shop: '산 격언은 판 끝까지 오른쪽 칸에서 효과를 내',
  pack: '셋 중 하나를 고르거나 건너뛰어',
  scroll: '두루마리를 누른 뒤 덱에서 기물을 골라',
  draft: '레퍼토리는 판 끝까지 가고, 저마다 시너지가 달라',
  family: '같은 시너지를 2 · 4 · 5개 모으면 효과가 켜져',
  master: '마스터전에는 특수 규칙이 하나 붙어',
  golden: '금빛 적을 잡고 이기면 금빛 팩을 받아',
  trait: '발밑 문양(특성)을 누르면 설명이 나와',
  things: '벽이나 보석을 누르면 설명이 나와',
  fairy: '특수 기물을 누르면 체스에 없는 행마로 잡을 칸이 보여',
  incoming: '이 수가 끝나면 점선 칸에 증원이 들어와',
  next: '흐린 둘은 다음에 뽑을 기물이야',
  preview: '카드의 작은 판은 그 대국에서 만날 판 그대로야',
  maximSell: '격언을 누르면 팔 수 있고, 끌면 순서가 바뀌어',
  hold: '책갈피로 찜한 카드는 다음 상점에도 남아',
  joseki: '고른 레퍼토리를 누르면 효과가 나와',
  tactic: '전술은 놓기 전에 눌러서 이번 대국에 한 번 써',
  bigText: '글이 작으면 설정에서 큰 글자를 켜 봐',
  clock: '대국을 질 때마다 시계 한 칸이 줄고, 다 쓰면 판이 끝나',
  crack: '금 간 혼은 금빛 적 · 마스터의 상자 · 깨우기로 깨어나',
  replay: '이기는 수도 이 대국의 실제 뽑기와 증원 그대로야',
  rankName: '이름은 설정에서 바꿀 수 있어',
  unlocks: '칸을 누르면 그 묶음에 든 것을 볼 수 있어',
  // 대국 도전 · 숙적(docs/reports/goty.md): 처음 도전이 붙은 대국 · 처음 숙적이 생긴 순간
  challenge: '도전을 콤보 하나로 해내면 상금을 받아',
  nemesis: '내 콤보를 끊은 적은 숙적이 되고, 다시 나오면 잡아 갚을 수 있어',
  brilliant: '이 기물로 곧바로 메이트하면 탁월수야',
  // 세력(factions.js): 새 세력을 처음 만나는 관 선택에서, 버릇만
  faction_peasants: '농민군 땅이야. 적 폰이 옆 칸도 지켜',
  faction_cavalry: '기병대 땅이야. 증원으로 나이트와 낙타만 와',
  faction_abbey: '수도원 땅이야. 돌기둥이 길을 막아',
  faction_fortress: '성채 땅이야. 성벽을 넘는 길은 문 하나뿐이야',
  faction_hunters: '숲 사냥꾼 땅이야. 위 두 줄은 숲이라 놓을 수 없어',
  faction_heralds: '전령단 땅이야. 증원이 하나 더 와',
  faction_mercs: '용병단 땅이야. 적 특성이 두 배로 붙어',
  faction_royal: '왕궁 근위 땅이야. 킹을 지키는 적이 하나 더 있어',
};

// 조작 안내의 그림 칸(U-6 — 「그림 + 동사 한 줄」): 말풍선 머리줄 오른끝에 손가락 하나. tap 누르기 · drag 끌기(글이 「누르면」 · 「끌면」인 안내)
export const GESTURE = {
  firstDrop: 'tap', scroll: 'tap', maximSell: 'drag', hold: 'tap', tactic: 'tap', joseki: 'tap', unlocks: 'tap',
  trait: 'tap', things: 'tap', fairy: 'tap',
};
export const GESTURE_W = 14;
// 손가락(위를 가리킨 손 커서 꼴) 14 × 14 도트 그림: # 잉크 테 · o 크림 몸 · g 금빛 표시(tap 손끝 양옆 · drag 오른쪽 화살)
const HAND = [
  '.....##.......',
  '....#oo#......',
  '....#oo#......',
  '....#oo#......',
  '....#oo###....',
  '....#oo#oo###.',
  '.##.#oo#oo#oo#',
  '#oo##oooooooo#',
  '#ooooooooooo#.',
  '.#ooooooooooo#',
  '..#oooooooooo#',
  '...#ooooooo##.',
  '....#oooooo#..',
  '....########..',
];
const MARK = { tap: [[2, 0], [1, 1], [3, 2], [9, 0], [10, 1], [8, 2]], drag: [[11, 0], [9, 1], [10, 1], [11, 1], [12, 1], [11, 2]] };
const DOT = { '#': PAL.cardInk, o: PAL.cardHi };
export function gestureIcon(ctx, kind, x, y) {
  HAND.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (DOT[row[i]]) rect(ctx, x + i, y + j, 1, 1, DOT[row[i]]); });
  for (const [i, j] of MARK[kind] || []) rect(ctx, x + i, y + j, 1, 1, PAL.goldDk);
}

// 안내 id → 그것을 가르치는 튜토리얼 수업 id(src/ui/lessons.js). 여기 없는 안내는 튜토리얼에 없는 것이라 처음 한 번 뜬다
export const TAUGHT = {
  firstDrop: 'become', incoming: 'reinforce', fairy: 'fairy',
  shop: 'shop', pack: 'shop', family: 'shop',
};
export const taught = (app, id) => !!(TAUGHT[id] && app.records.lessonsSeen && app.records.lessonsSeen[TAUGHT[id]]);
const seen = (app, id) => !!(app.records.coachSeen && app.records.coachSeen[id]) || taught(app, id);

// 화면이 그리는 중에 부른다: 이번 프레임에 보일 수 있는 안내 후보(부른 차례대로).
// 화면은 말하는 것이 그 순간 화면에 있을 때만 부른다(격언 안내는 진열에 격언이 있을 때 — CHM-36).
// 한 화면에 안내 하나: 이 화면에서 안내 하나를 본 뒤에는 다음 화면(다음 대국 · 다음 상점)까지 쉰다 — 첫 대국 첫 수 전에 넷이 연달아 떴다(U-5)
export function hint(app, id, regionId) {
  if (app.guide || app.settings.coach === false || seen(app, id) || !HINTS[id]) return;
  if (app.hintRest && app.hintRest === app.screen) return;
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
  if (app.hintShown) { markSeen(app, app.hintShown.id); app.hintShown = null; app.hintNow = null; app.hintRest = app.screen; }
  const g = app.guide;
  if (!g || app.overlay) return true;   // 덮개(행마 보기 · 멈춤)는 길과 상관없이 누른다
  const st = g.steps[g.i];
  if (!st || (g.hold && g.hold(app))) return true;   // 길이 쉬는 동안(연출 중)은 막지 않는다
  const r = guideRegion(app, st);
  // 가리키는 구역 밖은 누를 수 없다(「알겠어」 · 「건너뛰기」 단추는 안내가 그린다). 멈춤(≡)은 늘 눌린다
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
    opts = { ok: st.ok ? '알겠어' : null, okLabel: st.okLabel, skip: st.noSkip ? null : g.skip };
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
  const lay = bubbleLayout(say, w, { ok: ok ? okLabel || '알겠어' : null, skip: skip ? '건너뛰기' : null });
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
  bubble(ctx, ui, app, r, HINTS[h.id], { gesture: GESTURE[h.id] || null });
}

// 킹 말풍선: 자리는 설명 묶음과 같은 규칙(placement.js placeBubble).
//   판 틀: 왼쪽 칸에 가리키는 것의 줄 높이로, 화살표는 오른쪽(가리키는 것 쪽). 가리키는 것에는 금빛 테가 깜박인다.
//          왼쪽 칸 안의 것을 가리키면 그 바로 아래(모자라면 위), 화살표는 위(아래)로.
//   판 밖 틀: 가리키는 것 바로 아래(모자라면 위).
// 쌓기: 안 여백 → 머리(킹 얼굴 · 이름 「킹」, KING_HEAD) → 묶음 안 틈 → 글 줄들 → (묶음 틈 → 단추 줄) → 안 여백
// 시안 셋(docs/shots/tutorial/draft-*)에서 1 「머리줄」을 골랐다: 2 「기대기」는 킹이 상자 위 칸을 덮고, 3 「초상 칸」은 첫 줄이 좁아 글이 끊겼다.
// ok가 있으면 「알겠어」(okLabel), skip이 있으면 「건너뛰기」 단추. joy면 금관이 반짝인다.
export const KING_HEAD = 18;
const KING_NAME = '킹';
// 머리줄 자리: 킹 그림(16×22)은 안 여백보다 2 왼쪽 · 6 위로 솟고, 이름은 그림 오른쪽 2, 가는 줄은 이름 뒤 4 · 머리줄 가운데
const KING_POS = { dx: -SP.xs, dy: -6, name: SW + SP.xs, rule: SP.s, ruleY: KING_HEAD >> 1 };
function kingHead(ctx, app, x, y, w, lay, joy, headRight = 0) {
  const P = PAD_BOX, nw = measure(KING_NAME, true), rx = P + KING_POS.name + nw + KING_POS.rule;
  drawKing(ctx, app, x + P + KING_POS.dx, y + lay.headTop + KING_POS.dy, { joy });
  text(ctx, KING_NAME, x + P + KING_POS.name, textY(y + lay.headTop, KING_HEAD), PAL.cardInk, { bold: true });
  rect(ctx, x + rx, y + lay.headTop + KING_POS.ruleY, w - P - rx - headRight, 1, PAL.cardDim);
}
// 말이 바뀐 때(들썩임은 말이 바뀐 뒤 잠깐)
let talkSay = null, talkT0 = 0;
export function bubbleLayout(say, w, { ok = null, skip = null } = {}) {
  const f = flow(PAD_BOX);
  const headTop = f.space(KING_HEAD);
  f.gap(GAP_IN);
  const lines = wrap(say, w - PAD_BOX * 2);
  const ys = lines.map(() => f.line());
  // 단추 줄: 「알겠어」 · 「건너뛰기」는 같은 폭(btnW), 한 줄(사이 8)에 안 들어가면 두 줄(「알겠어」 위)
  const labels = [ok, skip].filter(Boolean);
  const { bw, w: rowW } = rowWidth(labels.map((label) => ({ label })));
  const oneRow = rowW <= w - PAD_BOX * 2;
  const rows = labels.length ? (oneRow ? [labels] : labels.map((l) => [l])) : [];
  const rowYs = rows.map((_, k) => (k ? f.gap(GAP_IN) : f.gap(GAP_GROUP)).space(BTN_H));
  return { lines, ys, headTop, rows, rowYs, bw, h: f.y + PAD_BOX };
}
export function drawKing(ctx, app, x, y, { joy = false } = {}) {
  const calm = LOOK.calm;
  // 말이 바뀐 뒤 0.9초 동안 1px 들썩인다(말하는 중)
  const t = app.time - talkT0;
  const hop = !calm && t < 0.9 && Math.floor(t * 8) % 2 ? -1 : 0;
  sprite(ctx, 'K', 'w', x, y + hop);
  if (!joy) return;
  // 기쁨: 관 둘레에 네 갈래 반짝이 넷(벡터)
  const stars = [[-3, 1, 2], [SW + 1, 2, 2], [-1, -3, 1.6], [SW - 2, -3, 1.6]];
  stars.forEach(([sx, sy, s], n) => {
    if (!calm && (Math.floor(app.time * 4) + n) % 2) return;
    sparkle(ctx, x + sx + 0.5, y + hop + sy + 0.5, s, PAL.goldHi);
  });
}
function sparkle(ctx, cx, cy, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx, cy, cx + s, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + s);
  ctx.quadraticCurveTo(cx, cy, cx - s, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - s);
  ctx.fill();
}
function tri(ctx, pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.closePath(); ctx.fill();
}
// 가리키는 것 둘레의 둥근 테(바깥 pad): 낮은 것(단추 · 칩)은 알약, 큰 것(카드 · 판넬)은 큰 상자 모서리
export function pointRing(ctx, r, col, pad = 1) {
  const w = r.w + pad * 2, h = r.h + pad * 2;
  rframe(ctx, r.x - pad, r.y - pad, w, h, h <= 26 ? Math.floor(h / 2) : R_BIG + pad, col, 1);
}
export function bubble(ctx, ui, app, r, say, { ok = null, okLabel = null, skip = null, joy = false, gesture = null } = {}) {
  live(); // 테가 깜박이고 킹이 들썩인다
  if (say !== talkSay) { talkSay = say; talkT0 = app.time; }
  const okText = ok ? okLabel || '알겠어' : null, skipText = skip ? '건너뛰기' : null;
  const p = bubbleRect(app, r, say, { ok, okLabel, skip });
  const { x, y, w, h, lay } = p;
  app.hintRect = { x, y, w, h };
  if (r && p.arrow === 'right') {
    // 가리키는 것: 둥근 금빛 테가 깜박인다
    ctx.globalAlpha = LOOK.calm ? 1 : 0.6 + 0.4 * Math.sin(app.time * 6);
    pointRing(ctx, r, PAL.goldHi);
    ctx.globalAlpha = 1;
  }
  const bh = lay.h;
  openBox('note', x, y, w, bh, PAD_BOX, { overlay: true, name: '킹 말풍선' });
  lift(ctx, x, y, w, bh);
  box(ctx, x, y, w, bh, PAL.card, PAL.frameDk);
  if (r && p.arrow) {
    // 꼬리: 잉크 삼각형 위에 크림 삼각형(상자 테를 덮어 한 몸으로)
    if (p.arrow === 'right') {
      const ay = Math.max(y + 6, Math.min(y + bh - 7, Math.round(r.y + r.h / 2))) + 0.5, ex = x + w;
      tri(ctx, [ex - 1, ay - 5, ex + 5, ay, ex - 1, ay + 5], PAL.frameDk);
      tri(ctx, [ex - 2, ay - 3.6, ex + 3.4, ay, ex - 2, ay + 3.6], PAL.card);
    } else {
      const ax = Math.max(x + 7, Math.min(x + w - 8, Math.round(r.x + r.w / 2))) + 0.5;
      const up = p.arrow === 'up', ey = up ? y : y + bh, s = up ? -1 : 1;
      tri(ctx, [ax - 5, ey - s, ax, ey + s * 5, ax + 5, ey - s], PAL.frameDk);
      tri(ctx, [ax - 3.6, ey - s * 2, ax, ey + s * 3.4, ax + 3.6, ey - s * 2], PAL.card);
    }
  }
  const P = PAD_BOX;
  // 머리줄: 킹(16×22, 머리 줄 위로 조금 솟는다) · 이름 · 가는 줄
  kingHead(ctx, app, x, y, w, lay, joy, gesture ? GESTURE_W + SP.s : 0);
  if (gesture) gestureIcon(ctx, gesture, x + w - P - GESTURE_W, y + lay.headTop + ((KING_HEAD - HAND.length) >> 1));
  lay.lines.forEach((l, k) => text(ctx, l, x + P, y + lay.ys[k], PAL.cardInk));
  const act = { [okText]: [ok, 'gold', 'guide:ok'], [skipText]: [skip, 'plain', 'guide:skip'] };
  lay.rows.forEach((row, k) => {
    const items = row.map((label) => { const [onClick, tone, id] = act[label]; return { id, label, tone, onClick }; });
    buttonRow(ctx, ui, items, x + w - P, y + lay.rowYs[k], { anchor: 'right', w: lay.bw });
  });
  closeBox();
}

// 수업의 킹 말(오른쪽 칸에 고정): 말풍선과 같은 얼굴 · 꼴에 화살표만 없다. foot은 글 아래 흐린 줄(보기 때 「누르면 직접」)
export function kingNoteLayout(say, w, foot = null) {
  const f = flow(PAD_BOX);
  const headTop = f.space(KING_HEAD);
  f.gap(GAP_IN);
  const lines = wrap(say, w - PAD_BOX * 2);
  const ys = lines.map(() => f.line());
  const feet = foot ? wrap(foot, w - PAD_BOX * 2) : [];
  const fys = feet.map((_, k) => (k ? f : f.gap(GAP_GROUP)).line());
  return { headTop, lines, ys, feet, fys, h: f.y + PAD_BOX };
}
// line(글, x, y): 글 줄을 그리는 곳(수업은 값 · 배수 칸을 richText로). 없으면 짙은 글. inner(): 상자 안에 더 그릴 것(단추 줄)
// headRight: 머리줄 오른쪽에 비워 둘 폭(닫기 단추 자리)
export function kingNote(ctx, app, x, y, w, say, lay, { joy = false, line = null, name = '킹 말', inner = null, headRight = 0 } = {}) {
  if (say !== talkSay) { talkSay = say; talkT0 = app.time; }
  if (!LOOK.calm && (joy || app.time - talkT0 < 1)) live(); // 말이 바뀐 뒤 들썩이는 동안 · 금관이 반짝이는 동안
  openBox('panel', x, y, w, lay.h, PAD_BOX, { name });
  box(ctx, x, y, w, lay.h, PAL.card, PAL.frameDk);
  const P = PAD_BOX;
  kingHead(ctx, app, x, y, w, lay, joy, headRight);
  lay.lines.forEach((l, k) => (line ? line(l, x + P, y + lay.ys[k]) : text(ctx, l, x + P, y + lay.ys[k], PAL.cardInk)));
  lay.feet.forEach((l, k) => text(ctx, l, x + w - P, y + lay.fys[k], PAL.cardDim, { align: 'right' }));
  if (inner) inner();
  closeBox();
}
