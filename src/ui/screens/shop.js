// 상점: 진열 2 + 꾸러미 2 + 다시 진열 + 다음 대국. 오른쪽 격언 칸(끌어서 순서 바꾸기 · 눌러 팔기), 두루마리 칸(눌러 쓰기),
// 아래 주머니(눌러 승급 · 빼기).
import { sway } from '../sway.js';
import { hint as coachHint } from '../coach.js';
import { PAL, RARITY } from '../../render/palette.js';
import { wrap } from '../../render/text.js';
import { W, text, box, rect, frame, measure } from '../../render/gfx.js';
import { canBuy, sellPrice, canSell, maximCapacity, maximCount, engravingInfo } from '../../sim/run.js';
import { SHOP, PROMOTE, rerollCost } from '../../sim/shop.js';
import { CHARTS } from '../../data/charts.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { button, growHit } from '../ui.js';
import { fitText, cardBase, maximColumn, maximColumnH, itemCard, itemRowH, itemKeys, itemTip, itemEffect, effectHead, itemExtraTip, targetPanel, pieceCard, pieceTip, chartTip, tipLines, fragmentStrip, cornerTicks, envelope, itemArt, chartLevel, SEAL, targetOk, isSwap, rarityLine, HOLD_MARK, itemName, itemCardLayout } from '../parts.js';
import { EDITION_BY_ID } from '../../data/editions.js';
import { chartForm } from '../../data/pieces.js';
import { tierOf, ENG_EDGE } from '../../render/sprites.js';
import { familyCounts, FAMILY_BY_ID, setName } from '../../data/families.js';
import { SOUL_BY_ID, isCracked } from '../../data/souls.js';
import { kindBand, BAND } from '../kinds.js';
import { awakenFlow } from './awaken.js';
import { TACTIC_BY_ID, evolveTo } from '../../data/tactics.js';
const ENG_NAME = (id) => engravingInfo(id).name;
import { familyStrip, familyRises, josekiBadges } from '../parts-depth.js';
import { PACK_NAME, PIECE_NAME, PIECE_MOVE, PART_NAME, josa } from '../words.js';
import { runSide, pauseButton, shardTo } from './common.js';
import { RIGHT, CENTER, CARD, TOP, PAD_CARD, LINE, GAP_IN, GAP_GROUP, LIST_GAP, flow, textY, inkY, rowBoxH, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { L } from '../lang.js';

const RX = RIGHT.x, RW = RIGHT.w;
// 판 틀(docs/design-notes/layout.md 「상점」): 가운데 칸 위 띠에 「진열」 이름표 · 다시 진열 · 다음 대국, 그 아래로 진열 카드 줄(hug) →
// 꾸러미 줄(hug) → 주머니(남는 높이). 오른쪽 칸은 격언 칸 → 두루마리(아래에서부터). 묶음 사이 GAP_GROUP
const CARD_W = CARD.w, BAR_Y = 2, BAR_H = BTN_S, BOTTOM = 270 - 2, BAG_MIN = 28;

// 주머니 줄: 작은 기물 카드들. pick(p)이 있으면 누를 수 있다.
// flash: { id, p } 각인을 막 새긴 기물(0.3초 반짝)
// grow: { form, p, big, from, to, exact } 기보로 자라는 모습 — 그 모습(이형은 바탕 모습)의 기물마다 옛 톤 · 옛 수준에서 반짝이며 새 톤 · 새 수준으로,
//   단계가 바뀌면(big) 빛 기둥까지. exact: 그 종류만(진화)
// can(p): 고를 수 있는 기물인가(아니면 흐리고 눌리지 않는다 — 같은 각인 · 혼이 이미 있는 기물)
// bottom: 줄이 여럿이면 이 아래로 넘지 않게 줄 간격을 줄인다(카드가 겹쳐 쌓인다)
export function bagRow(ctx, ui, run, x, y, w, { pick = null, glow = false, selectedId = null, idPrefix = 'deck', flash = null, grow = null, can = null, bottom = 268 } = {}) {
  const n = run.deck.length;
  const cw = 20, ch = 28;
  let per = Math.max(1, Math.floor((w + 3) / (cw + 3)));
  let rows = Math.ceil(n / per), hstep = cw + 3;
  // 줄을 쌓을 높이가 없으면(긴 진열 카드 아래 큰 주머니 — 용병단 땅의 배신자로 주머니가 열넷까지 는다) 한 줄에 옆으로 겹쳐 놓는다
  if (rows > 1 && bottom - y < ch + (rows - 1) * 8) { per = n; rows = 1; hstep = Math.max(4, Math.floor((w - cw) / Math.max(1, n - 1))); }
  const step = rows > 1 ? Math.max(4, Math.min(ch + 3, Math.floor((bottom - y - ch) / (rows - 1)))) : ch + 3;
  // 줄 간격이 가장 좁아도 넘치면(주머니가 커진 긴 판 — 시계로 판이 길어졌다) 줄을 위로 올린다
  if (rows > 1 && y + (rows - 1) * step + ch > bottom) y = bottom - ch - (rows - 1) * step;
  // 줄 자리를 기록기에 남긴다(글은 없다 — 화면 밖 · 다른 칸과 겹침만 잰다)
  openBox('tile', x, y, w, (rows - 1) * step + ch, 0, { name: '주머니 줄' });
  closeBox();
  run.deck.forEach((p, i) => {
    const col = i % per, row = Math.floor(i / per);
    const px = x + col * hstep, py = y + row * step;
    const id = `${idPrefix}:${p.id}`;
    const ok = !can || can(p);
    ui.region(id, px, py, cw, ch, { onClick: pick && ok ? () => pick(p) : null, tip: () => pieceTip(p) });
    const hov = ui.isHover(id);
    let fl = flash && flash.id === p.id ? 1 - flash.p : 0;
    let level = chartLevel(run, p.t), gl = 0;
    const growing = grow && (grow.exact ? grow.form === p.t : grow.from != null && chartForm(p.t) === grow.form);
    if (growing && grow.from != null) {
      // 반짝이는 순간(GROW_TURN)에 옛 수준 → 새 수준. 흰 빛이 바뀌는 때를 덮는다
      const g = grow.p;
      if (g < GROW_TURN) level = grow.from;
      fl = Math.max(fl, Math.max(0, 1 - Math.abs(g - GROW_TURN) / 0.22) * (grow.big ? 1 : 0.75));
      gl = g < GROW_TURN ? 0 : 1 - (g - GROW_TURN) / (1 - GROW_TURN);
    }
    pieceCard(ctx, p, px, py, cw, ch, { lift: hov && pick && ok ? 1 : 0, selected: selectedId === p.id, hover: hov && ok, dim: !ok, tier: tierOf(level), level, glow: gl, time: ui.time + i, flash: fl });
    if (growing) { if (grow.big || grow.from == null) growPillar(ctx, px, py, cw, ch, grow.p); else growSparks(ctx, px, py, cw, ch, grow.p); }
    if (glow && pick && ok) { const a = 0.4 + 0.3 * Math.sin(ui.time * 6); ctx.globalAlpha = a; frame(ctx, px - 1, py - 1, cw + 2, ch + 2, PAL.gold); ctx.globalAlpha = 1; }
  });
}

// 기보로 자라는 연출 길이: 단계가 바뀌면(빛 기둥) · 수준만 오르면(청록 반짝). 옛 모습이 새 모습으로 바뀌는 때(비율)
export const GROW_BIG = 0.8, GROW_SMALL = 0.6, GROW_TURN = 0.35;
// 수준만 오르는 순간: 카드 둘레에서 청록 점이 솟아오른다
export function growSparks(ctx, x, y, w, h, p) {
  const a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
  ctx.globalAlpha = Math.max(0, a);
  for (let k = 0; k < 6; k++) {
    const sx = x + 2 + ((k * 7) % (w - 3)), sy = y + h - 4 - Math.round((p * 22 + (k % 3) * 5));
    rect(ctx, sx, sy, 1, 2, k % 2 ? SEAL.chart[1] : PAL.white);
  }
  ctx.globalAlpha = 1;
}
// 기보로 자라는 순간: 기물 위로 빛 기둥이 솟고 반짝임이 흩어진다
export function growPillar(ctx, x, y, w, h, p) {
  const a = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
  const cx = x + Math.floor(w / 2);
  const top = y - Math.round(18 * Math.min(1, p * 2.5));
  ctx.globalAlpha = 0.55 * a; rect(ctx, cx - 4, top, 8, y + h - top, PAL.goldHi);
  ctx.globalAlpha = 0.9 * a; rect(ctx, cx - 1, top - 2, 2, y + h - top + 2, PAL.white);
  ctx.globalAlpha = a;
  for (let k = 0; k < 6; k++) {
    const ang = k * 1.05 + p * 3, r = 4 + p * 14;
    rect(ctx, Math.round(cx + Math.cos(ang) * r), Math.round(y + h / 2 + Math.sin(ang) * r * 0.8), 1, 1, PAL.goldHi);
  }
  ctx.globalAlpha = 1;
}

// 두루마리 이름(한국어 열쇠 — 그릴 때 옮긴다)
export const scrollName = (c) => (c.kind === 'chart' ? `${PIECE_NAME[c.form]}` : c.kind === 'evolve' ? '진화' : c.kind === 'awaken' ? '깨우기' : c.kind === 'tactic' ? TACTIC_BY_ID[c.id].name : c.kind === 'soul' ? SOUL_BY_ID[c.id].name : engravingInfo(c.id).name);
// 두루마리 칸이 좁은가(셋 이상 — 두 칸씩)
const scrollNarrow = (w) => w < 80;
// 이름 자리 폭(그리는 자리와 같다): 띠(1 + BAND) · 틈 2 뒤부터. 좁은 칸은 테 안쪽 한 칸까지(55 → 36),
// 넓은 칸은 그림(18) · 틈 4 뒤부터 오른쪽 여백 PAD_CARD까지(112 → 65)
export const scrollNameRoom = (w) => (scrollNarrow(w) ? w - 2 - (1 + BAND + 2) : w - PAD_CARD - (1 + BAND + 2 + 1 + 18 + 4));
// 좁은 칸 한 줄(두 칸)에 이름을 쓰는가(CHM-41): 그 줄의 모든 이름이 굵게 들어갈 때만. 하나라도 안 들어가면 줄 전체를 띠 + 그림으로 —
// 한 줄 안에서 이름 칸과 그림 칸이 섞이지 않게. 빈 칸은 따지지 않는다
export const scrollRowNames = (cs, w) => cs.filter(Boolean).every((c) => measure(scrollName(c), true) <= scrollNameRoom(w));

// 두루마리 한 칸(이름 한 줄 — 높이 rowBoxH(PAD_CARD)): 왼쪽 띠(종류 바탕 + 문양, kinds.js — CHM-37) → 혼은 등급 막대 →
// 넓은 칸은 그림(각인 = 재료, 혼 = 기운, 진화 = 자라는 화살, 기보 = 모습 윤곽) + 이름. 좁은 칸(셋 이상 — 두 칸씩)은 줄의 이름이 다 굵게 들어가면
// 이름만, 아니면 그림만(띠 뒤 자리 가운데, CHM-41 — scrollRowNames). 효과 · 이름은 가리키면 왼쪽 칸 설명에.
// 띠는 혼 · 각인 테(x + 1) 왼변을 덮고 위 · 오른쪽 · 아래 테는 남는다
export function consumableCard(ctx, c, x, y, w, h, hover, { names = true } = {}) {
  const edge = c.kind === 'engraving' ? ENG_EDGE[c.id] || PAL.gold : c.kind === 'soul' ? SOUL_BY_ID[c.id].col : c.kind === 'awaken' ? PAL.gold : null;
  const P = PAD_CARD, narrow = scrollNarrow(w);
  // 좁은 칸은 이름 자리가 좁아(55 − 띠) 안 여백을 테 안쪽 한 칸까지 쓴다(한글 석 자 36)
  openBox('card', x, y, w, h, narrow ? { x: 2, y: P } : P, { name: `두루마리 ${c.kind}` });
  cardBase(ctx, x, y, w, h, { fill: c.kind === 'chart' ? '#e8dcc0' : PAL.card, hover, edge });
  const name = scrollName(c);
  kindBand(ctx, c.kind, x + 1, y + 1, h - 2);
  // 혼 두루마리: 띠 오른끝(문양 옆 빈 줄)에 겹쳐 등급 빛깔 막대(격언 칸의 등급 막대와 같은 규칙) — 이름과 한 칸 띄운다
  if (c.kind === 'soul') rect(ctx, x + BAND, y + 2, 2, h - 4, RARITY[SOUL_BY_ID[c.id].rarity]);
  const bx = x + 1 + BAND + 2; // 띠(와 등급 막대) 뒤 글 · 그림이 서는 왼끝
  const ay = y + Math.floor((h - SCROLL_ART.h) / 2);
  if (narrow && names) { const nx = bx, nw = scrollNameRoom(w); fitText(ctx, name, nx + Math.floor(nw / 2), y + textY(P), nw, PAL.cardInk, { align: 'center' }); closeBox(); return; }
  if (narrow) { scrollArt(ctx, c, bx + Math.floor((scrollNameRoom(w) - 18) / 2), ay); closeBox(); return; }
  const ax = bx + 1;
  scrollArt(ctx, c, ax, ay);
  const nx = ax + 18 + 4;
  fitText(ctx, name, nx, y + textY(P), scrollNameRoom(w), PAL.cardInk);
  closeBox();
}
// 두루마리 그림(18 × 22): 진열 카드와 같은 그림을 좁은 그림 칸에(art.js itemArt — 진화는 겹 꺾쇠만)
const SCROLL_ART = { w: 18, h: 22 };
function scrollArt(ctx, c, ax, ay) { itemArt(ctx, c, ax, ay, 0, null, SCROLL_ART); }
// 꾸러미 칸 쌓기(재기와 그리기가 같이 쓴다): 왼쪽 봉투(ENV), 오른쪽 이름 → 값(두 줄, 봉투 높이 가운데).
// 봉투 속 「무엇 셋 중 하나」는 가리키면 왼쪽 칸 설명에(packTip)
const ENV = { w: 28, h: 22 };
const PACK_INSIDE = { piece: '기물 셋 중 하나', chart: '기보 셋 중 하나', engraving: '각인 셋 중 하나', golden: '판본 격언 셋 중 하나' };
export const packTip = (pk) => tipLines(PACK_NAME[pk.kind], PACK_INSIDE[pk.kind] || '');
const PACK_GAP = 4;
// 좁은 칸(셋 — 폭 100 아래)은 봉투 없이 이름 → 값
const packEnv = (w) => w >= 100;
// 좁은 칸 한 줄(셋)의 이름이 하나라도 굵게 안 들어가면(영어 「Engraving」 63 > 58, CHM-42) 그 줄 셋을 다 작은 봉투(ENV_S) + 값으로 —
// 봉랍 자리 딱지가 종류를, 금빛 봉투가 금빛 꾸러미를 말한다. 두루마리 좁은 칸(CHM-41 scrollRowNames)과 같은 규칙: 한 줄 안에서 섞지 않는다
const ENV_S = { w: 24, h: 20 };
// 꾸러미 칸이 넷(건너뛰기 패 「꾸러미 칸 +1」에 금빛 꾸러미가 붙은 상점, CHM-58 — 폭 53)이면 봉투를 더 작게(ENV_XS) 해서 값 자리를 남긴다
const ENV_XS = { w: 14, h: 12 };
export function packCellLayout(pk, w, { names = true } = {}) {
  const P = PAD_CARD, env = packEnv(w), small = !env && !names;
  // 아주 좁은 칸(넷)의 작은 봉투 칸은 봉투를 위에, 값을 그 아래 가운데에(stack) — 옆에 두면 「Free」가 안 들어간다
  const stack = small && w < 60, es = stack ? ENV_XS : ENV_S;
  const tx = env ? P + ENV.w + 4 : small && !stack ? P + es.w + 4 : P, tw = w - tx - P;
  const f = flow(P);
  const name = f.line(), price = f.line();
  const h = Math.max(f.y, env ? P + ENV.h : 0) + P;
  return { tx, tw, price, name, small, stack, es, env: env ? Math.floor((h - ENV.h) / 2) : stack ? P - 2 : small ? Math.floor((h - es.h) / 2) : null, h };
}
export const packCellH = (pk, w) => packCellLayout(pk, w).h;
// 좁은 칸 이름(꾸러미 이름의 앞 낱말 — 「각인 꾸러미」 → 「각인」)과 그 자리 폭
export const packShortName = (pk) => L(PACK_NAME[pk.kind].split(' ')[0]);
export const packNameRoom = (w) => packCellLayout({}, w).tw;
export const packRowNames = (packs, w) => packEnv(w) || packs.every((pk) => measure(packShortName(pk), true) <= packNameRoom(w));
// 주머니의 기물을 골라 쓰는 두루마리(처음 안내 「두루마리를 누르고 주머니의 기물을 골라 쓴다」의 대상)
const SCROLL_ON_PIECE = ['engraving', 'soul', 'evolve', 'awaken'];
export const consumableTip = (c) => (c.kind === 'evolve' || c.kind === 'tactic' || c.kind === 'awaken' ? itemTip(c) : c.kind === 'chart' ? chartTip(c.form) : c.kind === 'soul' ? tipLines(`${SOUL_BY_ID[c.id].name}의 혼`, [SOUL_BY_ID[c.id].text, SOUL_BY_ID[c.id].more, '기물 하나에 깃든다'], 150, [rarityLine(SOUL_BY_ID[c.id].rarity)]) : tipLines(`${engravingInfo(c.id).name} 각인`, engravingInfo(c.id).text));

// ── 찜(CHM-58 F, docs/design-notes/layout.md 19절): 진열 카드 위 테에서 늘어진 책갈피(값 왼쪽). 누르면 찜, 다시 누르면 풀린다.
// 리본(위 테 금빛 띠) = 이 상점에서 찜했거나 지난 상점에서 넘어온 카드, 채운 책갈피 = 다음 상점까지 맡아 둔 카드(run.hold).
// 넘어온 카드(kept)는 리본에 빈 책갈피로 선다 — 다시 누르면 채워져 그다음 상점에도 남는다
const isHeld = (run, i) => !!run.hold && run.hold.slot === i;
const HOLD_ROWS = [
  'EEEEEEEEE',
  'EFHFFFFFE', 'EFHFFFFFE', 'EFHFFFFFE', 'EFHFFFFFE', 'EFHFFFFFE', 'EFHFFFFFE', 'EFHFFFFFE', 'EFFFFFFFE', 'EFFFFFFFE',
  'EFFFEFFFE',
  'EFFE.EFFE',
  'EFE...EFE',
  'EE.....EE',
];
export function bookmark(ctx, bx, by, filled, hover = false) {
  const col = { E: filled ? PAL.goldDk : hover ? PAL.gold : PAL.cardDim, F: filled ? PAL.gold : PAL.card, H: filled ? PAL.goldHi : PAL.card };
  HOLD_ROWS.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') rect(ctx, bx + i, by + j, 1, 1, col[row[i]]); });
}
// 책갈피 자리(카드 안): 값 글 왼쪽에 gap 띄우고, 위 테에서 한 칸 아래부터 늘어진다
export function holdMarkAt(it, x, y, w) {
  const pw = it.price != null ? measure(`$${it.price}`, true) : 0;
  return { x: x + w - PAD_CARD - pw - HOLD_MARK.gap - HOLD_MARK.w, y: y + 1 };
}
// 누르는 자리: 책갈피 둘레 3, 손가락이면 44pt까지 넓힌다(위로는 띠 단추 밑 2까지, 오른쪽은 값 글 앞까지 — 카드 밖 · 띠는 덮지 않는다)
function holdHit(ui, m) {
  const x = m.x - 3, y = m.y - 3, w = HOLD_MARK.w + 6, h = HOLD_MARK.h + 5;
  return ui.finger ? growHit(x, y, w, h, ui.finger, { l: 14, r: HOLD_MARK.gap - 1, u: 0, d: 12 }) : { x, y, w, h };
}
// 찜한 카드 · 넘어온 카드를 가리키면 말풍선 첫 줄에 그 사실(금빛 한 줄)
export function holdLine(run, it, i) {
  if (it.sold) return null;
  if (isHeld(run, i)) return '찜했다 · 다음 상점까지 남는다';
  if (it.kept) return '지난 상점에서 찜한 카드';
  return null;
}
// 판본 이름이 머릿말에 못 들어간 진열 카드(영어 긴 판본 이름 — parts.js itemCardLayout): 말풍선에 「판본 · 효과」(격언 칸 말풍선과 같은 꼴)
export function editionLine(run, it) {
  if (!it.edition) return null;
  const e = EDITION_BY_ID[it.edition];
  const head = itemCardLayout(it, CARD_W, { run, hold: true }).kinds.map(([l]) => l).join(' ');
  return head.includes(L(e.name)) ? null : `${L(e.name)} · ${L(e.text)}`;
}
function withHoldLine(tip, run, it, i) {
  const lines = [holdLine(run, it, i), editionLine(run, it)].filter(Boolean).map((l) => [l, PAL.goldDk]);
  if (!lines.length) return tip;
  if (!tip) return tipLines(itemName(it), [], 150, lines);
  return { ...tip, extra: [...lines, ...(tip.extra || [])] };
}

export class ShopScreen {
  constructor(app) {
    this.app = app;
    this.menu = null;      // { kind: 'maxim', index } | { kind: 'piece', id }
    this.target = null;    // 각인 두루마리를 쓸 대상 고르기 { index }
    this.notes = 'side';   // 설명 자리: 왼쪽 칸(placement.js)
    const fx = app.shopFx || [];
    app.shopFx = null;
    for (const e of fx) this.fx(e);
    if (app.shopFamBefore) { this.noteFamilies(app.shopFamBefore); app.shopFamBefore = null; }
  }
  // 가족 문턱을 막 넘었으면 그 칩이 빛나며 커지고 한 번 울린다
  noteFamilies(before) {
    const rises = familyRises(before, familyCounts(this.run));
    if (!rises.length) return;
    this.famFx = this.famFx || {};
    for (const id of rises) { this.famFx[id] = this.app.time; this.app.toast(`${setName(id)} ${familyCounts(this.run)[id]}`, FAMILY_BY_ID[id].col); }
    this.app.sfx('fanfare');
  }
  // 기보로 한 단계 자라면 빛 기둥, 각인을 새기면 반짝
  fx(e) {
    if (e.type === 'gamble') {
      this.flash = { id: e.pieceId, t0: this.app.time };
      const what = e.to ? `${PIECE_NAME[e.from]} › ${PIECE_NAME[e.to]}` : e.soul ? `${PIECE_NAME[e.piece]} · ${SOUL_BY_ID[e.soul].name}의 혼` : `${PIECE_NAME[e.piece]} · ${ENG_NAME(e.eng)} 각인`;
      this.app.toast(what, PAL.gold, 2.2);
      this.app.sfx('sparkle');
    }
    if (e.type === 'evolve') { this.grow = { form: e.to, t0: this.app.time, big: true, exact: true }; this.app.sfx('grow'); }
    // 기보: 그 모습의 기물마다 한 단계 자란다(단계 동 · 은 · 금이 바뀌면 빛 기둥, 수준만 오르면 청록 반짝)
    if (e.type === 'chart') {
      const big = tierOf(e.level) > tierOf(e.level - 1);
      this.grow = { form: e.form, t0: this.app.time, big, from: e.level - 1, to: e.level };
      this.app.sfx(big ? 'grow' : 'sparkle');
    }
    if (e.type === 'engrave' || e.type === 'ensoul') this.flash = { id: e.pieceId, t0: this.app.time };
  }
  get run() { return this.app.run; }

  act(cmd, sound = 'click') {
    let ev;
    const before = familyCounts(this.run);
    try { ev = this.app.cmd(cmd); } catch (e) { this.app.toast('할 수 없다', PAL.red); return null; }
    this.noteFamilies(before);
    this.app.sfx(sound);
    for (const e of ev) {
      if (e.type === 'fragment') {
        this.app.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6);
        this.app.sfx('fragment');
        const r = this.app.ui.hover;
        const to = shardTo();
        this.app.flyShard(r ? r.x + r.w / 2 : 240, r ? r.y + r.h / 2 : 100, to.x, to.y);
      }
      if (e.type === 'legend') { this.app.flow([['legend', { legend: e.legend, back: 'shop' }]]); return ev; }
      if (e.type === 'awaken') { this.app.flow(awakenFlow([e])); return ev; }
      if (e.type === 'chart') {
        this.app.toast(`${CHARTS[e.form].name} ${e.level}`, PAL.gold);
      }
      this.fx(e);
    }
    if (this.run.phase === 'pack') this.app.go('pack', { events: ev });
    else if (this.run.phase !== 'shop') this.app.goPhase();
    return ev;
  }

  // 가운데 칸 자리: 진열 줄 높이(두 카드 중 긴 것) · 꾸러미 줄 높이 · 주머니 윗변
  centerLayout() {
    const run = this.run, shop = run.shop;
    const cardH = itemRowH(shop.display, CARD_W, { run, hold: true });
    const packY = TOP + cardH + GAP_GROUP;
    // 꾸러미 칸은 가운데 칸 폭을 나눠 쓴다(둘이면 108, 금빛 꾸러미가 붙어 셋이면 72)
    const n = Math.max(1, shop.packs.length), packW = n <= 2 ? CARD_W : Math.floor((CENTER.w - (n - 1) * PACK_GAP) / n);
    const packH = Math.max(0, ...shop.packs.map((pk) => packCellH(pk, packW)));
    return { cardH, packY, packH, packW, bagY: packY + packH + GAP_GROUP };
  }
  // 오른쪽 칸 자리: 두루마리(아래에서부터, 넓은 칸은 한 줄에 하나 · 셋 이상은 두 칸씩) → 이름표 → 격언 칸(남는 높이)
  rightLayout() {
    const run = this.run, ch = rowBoxH(PAD_CARD);
    const wide = run.consumableSlots <= 2;
    const rows = wide ? run.consumableSlots : Math.ceil(run.consumableSlots / 2);
    const scrollY = BOTTOM - (rows * ch + (rows - 1) * LIST_GAP);
    const labelY = scrollY - GAP_IN - LINE;
    return { wide, ch, scrollY, labelY, room: labelY - GAP_GROUP - TOP };
  }
  // 판 틀(docs/design-notes/layout.md): 왼쪽 칸(상점 · 시너지 · 정석 · 상금 · 주머니 수 — 설명 자리),
  // 가운데(띠: 진열 · 다시 진열 · 다음 대국 / 진열 둘 · 꾸러미 둘 · 주머니), 오른쪽 칸(격언 · 두루마리)
  draw(ctx, ui) {
    const app = this.app, run = this.run, shop = run.shop;
    runSide(ctx, ui, app, '상점');
    pauseButton(ctx, ui, app);
    const CX = CENTER.x, lay = this.centerLayout();
    text(ctx, '진열', CX, textY(BAR_Y, BAR_H), PAL.dim);
    const rc = rerollCost(run);
    const leaveW = measure('다음 대국', true) + 12, rerollW = Math.max(80, measure(`다시 진열 $${rc}`, true) + 12);
    button(ctx, ui, 'shop:leave', CX + CENTER.w - leaveW, BAR_Y, leaveW, BAR_H, '다음 대국', { onClick: () => this.leave(), tone: 'gold' });
    button(ctx, ui, 'shop:reroll', CX + CENTER.w - leaveW - 4 - rerollW, BAR_Y, rerollW, BAR_H, `다시 진열 $${rc}`, { enabled: run.money >= rc, onClick: () => this.act({ type: 'reroll' }, 'coin') });
    // 두루마리를 쓰는 중: 진열 · 꾸러미 자리에 미리 보기 판(고른 기물이 어떻게 되는지 보이고 확인을 받는다), 그 아래 주머니
    let bagY = lay.bagY;
    const target = this.target && run.consumables[this.target.index];
    if (target) {
      const p = this.target.pieceId != null ? run.deck.find((x) => x.id === this.target.pieceId) : null;
      const th = targetPanel(ctx, ui, run, target, p, CX, TOP, CENTER.w, {
        to: p && target.kind === 'evolve' ? evolveTo(run.seed, p) : null,
        onConfirm: () => { const i = this.target.index, id = this.target.pieceId; this.target = null; this.act({ type: 'use', index: i, target: id }, 'engrave'); },
        onCancel: () => { this.target = null; },
        onBack: () => { this.target = { index: this.target.index }; },
      });
      bagY = TOP + th + GAP_GROUP;
    } else {
      // 진열 카드는 효과를 다 적는다(가리키지 않아도 읽힌다). 두 카드는 긴 쪽 높이에 맞춘다
      shop.display.forEach((it, i) => {
        const x = CX + i * (CARD_W + 8), y = TOP, id = `shop:buy:${i}`;
        const ok = canBuy(run, it);
        ui.region(id, x, y, CARD_W, lay.cardH, { enabled: ok, onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), tip: () => withHoldLine(itemExtraTip(it), run, it, i), keys: () => itemKeys(it), preview: true });
        // 찜 책갈피: 카드 구역 뒤에 적어 카드보다 먼저 눌린다(살 돈이 모자란 카드도 찜할 수 있다)
        const held = isHeld(run, i), mark = holdMarkAt(it, x, y, CARD_W), hid = `shop:hold:${i}`;
        if (!it.sold) {
          const g = holdHit(ui, mark);
          ui.region(hid, g.x, g.y, g.w, g.h, { onClick: () => this.act({ type: 'hold', slot: i }, 'pick'), tip: () => tipLines(held ? '찜했다' : '찜', held ? '다음 상점 진열에 그대로 남는다' : it.kept ? '지난 상점에서 찜한 카드. 다시 찜하면 다음 상점에도 남는다' : '다음 상점까지 맡아 둔다', 130) });
        }
        // 들림(sway.js): 가리키면 들리고, 누르면 가라앉는다
        const hov = (ui.isHover(id) && ok) || ui.isHover(hid);
        sway(ctx, ui.time, `${id}:${it.kind}:${it.id || it.form || it.t || ''}`, x, y, CARD_W, lay.cardH, (c) => {
          itemCard(c, it, x, y, CARD_W, lay.cardH, { hover: hov && ok, sold: it.sold, t: ui.time + i, run, ui, under: { onClick: () => this.act({ type: 'buy', slot: i }, 'coin'), enabled: ok }, hold: true });
          if (!it.sold && !ok) { c.globalAlpha = 0.35; rect(c, x, y, CARD_W, lay.cardH, PAL.shadow); c.globalAlpha = 1; }
          if (it.sold) return;
          // 리본: 찜했거나 넘어온 카드는 위 테에 금빛 띠
          if (held || it.kept) { rect(c, x + 1, y - 1, CARD_W - 2, 3, PAL.gold); rect(c, x + 1, y - 1, CARD_W - 2, 1, PAL.goldHi); }
          bookmark(c, mark.x, mark.y, held, ui.isHover(hid));
        }, { hover: hov, press: hov && ui.press && (ui.press.id === id || ui.press.id === hid) });
      });
      // 꾸러미: 진열 아래 칸 둘(금빛 꾸러미가 붙으면 셋)
      shop.packs.forEach((pk, i) => {
        const pw = lay.packW, x = CX + i * (pw + (pw === CARD_W ? 8 : PACK_GAP)), y = lay.packY, id = `shop:pack:${i}`;
        const ok = !pk.sold && run.money >= pk.price;
        ui.region(id, x, y, pw, lay.packH, { enabled: ok, onClick: () => this.act({ type: 'buyPack', slot: i }, 'pack'), tip: () => packTip(pk), preview: true });
        const hov = ui.isHover(id) && ok;
        sway(ctx, ui.time, `${id}:${pk.kind}`, x, y, pw, lay.packH, (c) => {
          this.packCard(c, pk, x, y, pw, lay.packH, hov, packRowNames(shop.packs, pw));
          if (!pk.sold && !ok) { c.globalAlpha = 0.35; rect(c, x, y, pw, lay.packH, PAL.shadow); c.globalAlpha = 1; }
        }, { hover: hov, press: hov && ui.press && ui.press.id === id, amt: 0.6 });
      });
    }
    // 주머니(가운데 아래 — 남는 높이). 수는 왼쪽 칸 「주머니」.
    // 진열 카드는 ≤ 160이라 주머니 한 줄(BAG_MIN)이 늘 남는다(test/layout.test.js). 그래도 모자라면 화면 안에 붙인다(연기 시험이 겹침으로 잡는다)
    bagY = Math.min(bagY, BOTTOM - BAG_MIN);
    const since = (fx, d) => (fx && app.time - fx.t0 < d ? (app.time - fx.t0) / d : null);
    const fp = since(this.flash, 0.3), gp = since(this.grow, this.grow && !this.grow.big ? GROW_SMALL : GROW_BIG);
    bagRow(ctx, ui, run, CX, bagY, CENTER.w, {
      pick: (p) => this.pickPiece(p), glow: !!this.target, selectedId: this.menu && this.menu.kind === 'piece' ? this.menu.id : this.target ? this.target.pieceId : null,
      flash: fp != null ? { id: this.flash.id, p: fp } : null, grow: gp != null ? { ...this.grow, p: gp } : null, bottom: BOTTOM,
      can: target ? (p) => targetOk(target, p) : null,
    });
    // 오른쪽 칸: 격언 → 두루마리
    const rl = this.rightLayout();
    text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 8, PAL.dim);
    const col = maximColumn(ctx, ui, run, RX, TOP, RW, rl.room, {
      onClick: (i) => { this.menu = this.menu && this.menu.kind === 'maxim' && this.menu.index === i ? null : { kind: 'maxim', index: i }; this.target = null; },
      drag: (i, mx, my) => this.dropMaxim(i, my, col),
      hotIndex: this.menu && this.menu.kind === 'maxim' ? this.menu.index : -1,
    });
    this.col = col;
    text(ctx, '두루마리', RX, textY(rl.labelY), PAL.dim);
    for (let i = 0; i < run.consumableSlots; i++) {
      const cw = rl.wide ? RW : Math.floor((RW - LIST_GAP) / 2);
      const x = rl.wide ? RX : RX + (i % 2) * (cw + LIST_GAP), y = rl.scrollY + (rl.wide ? i : Math.floor(i / 2)) * (rl.ch + LIST_GAP);
      const c = run.consumables[i];
      if (!c) { frame(ctx, x, y, cw, rl.ch, PAL.feltHi); continue; }
      const id = `cons:${i}`;
      ui.region(id, x, y, cw, rl.ch, { onClick: () => this.useConsumable(i), tip: () => consumableTip(c), keys: () => itemKeys(c), preview: true });
      // 좁은 칸은 줄(두 칸)마다 이름 · 그림을 함께 고른다(CHM-41)
      const row = i - (i % 2), names = rl.wide || scrollRowNames(run.consumables.slice(row, Math.min(row + 2, run.consumableSlots)), cw);
      consumableCard(ctx, c, x, y, cw, rl.ch, ui.isHover(id) || (this.target && this.target.index === i), { names });
    }
    this.drawMenu(ctx, ui);
    // 처음 안내(한 번에 하나, 앞의 것부터). 말하는 것이 화면에 있을 때만 — 없으면 아껴 두었다가 처음 보이는 상점에서(CHM-36)
    if (!this.menu && !this.target) {
      // 대국을 지고 들어온 상점(CHM-20): 시계 줄을 먼저 가리킨다
      if (run.last && run.last.clockLost) coachHint(app, 'clock', 'clock');
      // 혼에 처음 금이 간 뒤(CHM-17): 금이 간 기물을 가리킨다
      const cracked = run.deck.find(isCracked);
      if (cracked) coachHint(app, 'crack', `deck:${cracked.id}`);
      // 격언 안내는 진열에 아직 안 산 격언이 있을 때 그 카드를
      const mx = shop.display.findIndex((it) => it.kind === 'maxim' && !it.sold);
      if (mx >= 0) coachHint(app, 'shop', `shop:buy:${mx}`);
      // 찜 안내(CHM-58 F)는 진열에 안 산 카드가 있는 첫 상점에서 그 카드의 책갈피를(격언 안내 다음)
      const hx = shop.display.findIndex((it) => !it.sold);
      if (hx >= 0) coachHint(app, 'hold', `shop:hold:${hx}`);
      // 두루마리 안내는 기물을 골라 쓰는 두루마리(각인 · 혼 · 진화 · 깨우기)에
      const sc = run.consumables.findIndex((c) => SCROLL_ON_PIECE.includes(c.kind));
      if (sc >= 0) coachHint(app, 'scroll', `cons:${sc}`);
      const fam = ui.regions.find((r) => r.id.startsWith('fam:'));
      if (fam) coachHint(app, 'family', fam.id);
      // 팔기 안내는 팔 수 있는 격언에(전설은 못 판다)
      const sell = run.maxims.findIndex(canSell);
      if (sell >= 0) coachHint(app, 'maximSell', `maxim:${sell}`);
    }
  }

  // 꾸러미 칸: 왼쪽 봉투, 오른쪽 이름 → 값(packCellLayout). 봉투 속은 가리키면(packTip)
  packCard(ctx, pk, x, y, w, h, hover, names = true) {
    const lay = packCellLayout(pk, w, { names });
    openBox('card', x, y, w, h, PAD_CARD, { name: `꾸러미 ${pk.kind}` });
    box(ctx, x, y, w, h, PAL.feltDk, hover ? PAL.gold : PAL.frameDk);
    const P = PAD_CARD;
    // 연 꾸러미는 작은 봉투 칸이어도 봉투 없이 칸 가운데 「열었다」(봉투 오른쪽 34에 영어 「Opened」가 안 들어간다)
    if (lay.env != null && !(pk.sold && lay.small)) envelope(ctx, lay.stack ? x + ((w - lay.es.w) >> 1) : x + P, y + lay.env, lay.small ? lay.es.w : ENV.w, lay.small ? lay.es.h : ENV.h, pk.kind, { hover });
    if (pk.sold) {
      ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
      // 봉투가 있으면 글 칸(봉투 오른쪽) 가운데 — 영어 「Opened」가 봉투에 걸치지 않게
      text(ctx, '열었다', lay.small ? x + Math.floor(w / 2) : x + lay.tx + Math.floor(lay.tw / 2), inkY(y, h), PAL.dim, { align: 'center', bold: true });
      closeBox();
      return;
    }
    // 작은 봉투 칸: 이름 없이 봉투 오른쪽에 값 한 줄(칸 높이 가운데)
    if (lay.small) {
      if (lay.stack) text(ctx, pk.price ? `$${pk.price}` : '공짜', x + Math.floor(w / 2), y + lay.price, PAL.gold, { bold: true, align: 'center' });
      else text(ctx, pk.price ? `$${pk.price}` : '공짜', x + lay.tx, inkY(y, h), PAL.gold, { bold: true });
      closeBox();
      return;
    }
    // 좁은 칸(셋 · 넷)은 작은 봉투를 값 줄 오른쪽에(이름 줄은 폭을 다 쓴다)
    if (lay.env == null) envelope(ctx, x + w - P - ENV_XS.w, y + lay.price - ((LINE - 11) >> 1) + 1, ENV_XS.w, ENV_XS.h, pk.kind, { hover });
    fitText(ctx, packShortName(pk), x + lay.tx, y + lay.name, lay.tw, PAL.ink);
    text(ctx, pk.price ? `$${pk.price}` : '공짜', x + lay.tx, y + lay.price, PAL.gold, { bold: true });
    closeBox();
  }

  drawMenu(ctx, ui) {
    const run = this.run, m = this.menu;
    if (!m) return;
    if (m.kind === 'maxim') {
      const mx = run.maxims[m.index];
      const spot = this.col && this.col.spots.find((s) => s.i === m.index);
      if (!mx || !spot) { this.menu = null; return; }
      const y = spot.y + Math.floor(spot.h / 2) - 9;
      openBox('tile', RX - 70, y, 66, 18, 0, { overlay: true, name: '팔기' });
      if (canSell(mx)) button(ctx, ui, 'shop:sell', RX - 70, y, 66, 18, `팔기 $${sellPrice(mx)}`, { onClick: () => { this.menu = null; this.act({ type: 'sell', index: m.index }, 'coin'); }, tone: 'red' });
      closeBox();
    } else if (m.kind === 'piece') {
      const p = run.deck.find((x) => x.id === m.id);
      const r = ui.last.find((x) => x.id === `deck:${m.id}`) || ui.regions.find((x) => x.id === `deck:${m.id}`);
      if (!p || !r) { this.menu = null; return; }
      const opts = [];
      if (!run.shop.promoted) for (const to of PROMOTE[p.t] || []) opts.push([`shop:promote:${to}`, `${josa(PIECE_NAME[to], '으로/로')} 올리기 $${SHOP.promotePrice}`, run.money >= SHOP.promotePrice, () => this.act({ type: 'promote', pieceId: p.id, to }, 'promote')]);
      if (!run.shop.removed) opts.push(['shop:remove', `빼기 $${SHOP.removePrice}`, run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin, () => this.act({ type: 'remove', pieceId: p.id }, 'discard')]);
      if (!opts.length) opts.push(['shop:none', '이번 상점에선 끝', false, null]);
      // 차림표 폭은 가장 긴 단추 글에 맞춘다(영어 「Promote to Knight $3」)
      const w = Math.max(112, ...opts.map(([, label]) => measure(label, true) + 12)) + 4, h = opts.length * 20 + 4;
      const x = Math.min(r.x, CENTER.x + CENTER.w - w), y = r.y - h - 2;
      openBox('tile', x, y, w, h, 0, { overlay: true, name: '기물 차림표' });
      box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
      opts.forEach(([id, label, ok, fn], k) => button(ctx, ui, id, x + 2, y + 2 + k * 20, w - 4, 18, label, { enabled: ok, onClick: () => { this.menu = null; if (fn) fn(); } }));
      closeBox();
    }
  }

  pickPiece(p) {
    if (this.target) {
      // 고르면 미리 보기, 확인 단추로 쓴다
      const c = this.run.consumables[this.target.index];
      if (c && !targetOk(c, p)) return;
      if (c && c.kind === 'evolve' && !evolveTo(this.run.seed, p)) { this.app.toast('이 기물은 자랄 곳이 없다', PAL.dim); return; }
      this.target = { ...this.target, pieceId: this.target.pieceId === p.id ? null : p.id };
      return;
    }
    this.menu = this.menu && this.menu.kind === 'piece' && this.menu.id === p.id ? null : { kind: 'piece', id: p.id };
  }

  useConsumable(i) {
    const c = this.run.consumables[i];
    if (!c) return;
    this.menu = null;
    if (c.kind === 'engraving' || c.kind === 'soul' || c.kind === 'evolve' || c.kind === 'awaken') { this.target = this.target && this.target.index === i ? null : { index: i }; return; }
    if (c.kind === 'tactic') { this.app.toast('대국 중에 쓴다', PAL.dim); return; }
    this.act({ type: 'use', index: i }, 'chart');
  }

  dropMaxim(from, my, col) {
    if (!col) return;
    let to = col.spots.findIndex((s) => my < s.y + s.h / 2);
    if (to < 0) to = this.run.maxims.length - 1;
    to = Math.min(to, this.run.maxims.length - 1);
    if (to === from) return;
    // 전설은 늘 오른쪽 끝(아래)에 남긴다
    const legendAt = this.run.maxims.findIndex((m) => m.legendary);
    if (this.run.maxims[from].legendary) return;
    if (legendAt >= 0 && to >= legendAt) to = legendAt - (from < legendAt ? 1 : 0);
    if (to === from || to < 0) return;
    this.menu = null;
    this.act({ type: 'moveMaxim', from, to }, 'pick');
  }

  leave() { this.menu = null; this.target = null; this.act({ type: 'leave' }, 'click'); }

  key(k) {
    if (k === 'Escape') {
      // 바꾸기 확인에서는 「그만」과 같게 대상 고르기로, 그 밖에는 고르던 것을 닫는다
      if (this.target && this.target.pieceId != null) {
        const c = this.run.consumables[this.target.index], p = this.run.deck.find((x) => x.id === this.target.pieceId);
        if (c && isSwap(c, p)) { this.target = { index: this.target.index }; return; }
      }
      if (this.menu || this.target) { this.menu = null; this.target = null; return; }
      this.app.openOverlay('pause');
    } else if (k === 'Enter') this.leave();
  }
}
