// 화면 연기 시험: 가짜 캔버스 · 가짜 입력으로 실제 src/main.js를 부팅해, 봇 명령을 화면 누르기로 바꿔 판을 끝까지 돈다.
//   node tools/smoke.mjs [--seed 3] [--runs 2] [--verbose] [--lang en] [--spacing pad8,line14,…]
// 확인: 예외 0 · 모든 화면 방문 · 프레임당 그리기 시간 · 한 수 연출 시간(×1) · 저장 → 이어 하기.
import { makeFakeDom } from './fakedom.mjs';
import { decideBattle } from './bot.mjs';
import { lineCommands } from '../src/sim/solver.js';
import { canBuy } from '../src/sim/run.js';
import { evolveTo } from '../src/data/tactics.js';
import { isHidden, canReboard } from '../src/sim/battle.js';
import { reboardOn } from '../src/sim/tuning.js';
const { targetOk } = await import('../src/ui/parts.js');
const { FAMILIES, familyCounts } = await import('../src/data/families.js');
const { L } = await import('../src/ui/lang.js');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEED = Number(opt('--seed', 3));
const LANG = opt('--lang', 'ko');
const RUNS = Number(opt('--runs', 2));
const VERBOSE = args.includes('--verbose');
// --spacing pad8,card7,line14,title18,in3,group8: 글 간격 시안으로 자리 규칙을 잰다(src/ui/frame.js applySpacing)
if (opt('--spacing', null)) globalThis.__SPACING = opt('--spacing', null);
const log = (...a) => { if (VERBOSE) console.log(...a); };

globalThis.__CHAINMATE_NO_BOOT__ = true;
const dom = makeFakeDom({ width: 1366, height: 700, dpr: 1.25 });
globalThis.document = dom.document;
globalThis.window = dom.window;
const { boot } = await import('../src/main.js');
const lessonMod = await import('../src/ui/lessons.js');
const { termsIn, TERM_BY_ID, KEY_MAX } = await import('../src/ui/glossary.js');
const { tipTexts } = await import('../src/ui/ui.js');
const P = await import('../src/ui/placement.js');
// 글 넘침(docs/design-notes/layout.md 「검사」): 프레임마다 그린 글이 제 상자(안 여백 안)를 넘는지, 상자끼리 겹치는지, 화면 밖인지
const LL = await import('../src/render/layoutlog.js');
LL.LOG.on = true;
// 보류: 사람이 고를 때까지 따로 세는 화면(docs/design-notes/layout.md 「보류」). 지금은 없다
// (카드 넷인 금빛 꾸러미는 명국 조각을 건너뛰기 줄로 빼고 격언 칸을 접어 풀었다 — CHM-12)
const HELD = {};
const heldOf = () => null;
const flow = { frames: 0, text: 0, pad: 0, overlap: 0, screen: 0, held: 0, heldBy: {}, seen: new Map() };
function flowCheck() {
  if (!app) return;
  flow.frames++;
  const held = heldOf();
  for (const q of LL.checkLayout()) {
    const key = `${screen()}${held ? `(${held})` : ''} ${q.msg}`;
    if (flow.seen.has(key)) continue;
    flow.seen.set(key, held ? 'held' : q.what);
    if (held) { flow.held++; flow.heldBy[held] = (flow.heldBy[held] || 0) + 1; } else flow[q.what]++;
  }
}

const errors = [];
const apps = [];
const visited = new Set();
let t = 0;
let app = null;

async function start() {
  if (LANG !== 'ko') dom.store.set('chainmate.settings.v1', JSON.stringify({ lang: LANG }));
  app = await boot({ window: dom.window, document: dom.document });
  apps.push(app);
  app.onError = (e) => { errors.push(e); console.error(e); };
  pump(2);
}
const seen = () => { for (const v of app.visited) visited.add(v); };
// 처음 안내: 떠 본 안내 id
const hintsShown = new Set();
const previewSeen = { scroll: 0, pack: 0 };
const goldSeen = { swap: 0, sell: 0, bad: [] };
function pump(n = 1, dt = 1000 / 60) { for (let i = 0; i < n; i++) { t += dt; dom.frame(t); flowCheck(); if (app && app.hintShown) { hintsShown.add(app.hintShown.id); hintCheck(); } } }
function region(id) { return app.ui.regions.find((r) => r.id === id) || null; }
function click(id) {
  const r = region(id);
  if (!r) throw new Error(`no region ${id} on ${app.overlay ? app.overlay.name : app.screen.name}`);
  const gx = r.x + Math.floor(r.w / 2), gy = r.y + Math.floor(r.h / 2);
  dom.mouse('mousemove', gx, gy);
  dom.mouse('mousedown', gx, gy);
  dom.mouse('mouseup', gx, gy);
  pump(1);
  return r;
}
function drag(id, toGx, toGy) {
  const r = region(id);
  if (!r) return false;
  const gx = r.x + Math.floor(r.w / 2), gy = r.y + Math.floor(r.h / 2);
  dom.mouse('mousemove', gx, gy); dom.mouse('mousedown', gx, gy); pump(1);
  dom.mouse('mousemove', toGx, toGy); pump(1);
  dom.mouse('mouseup', toGx, toGy); pump(1);
  return true;
}
// 오른쪽 누르기 · 끌기(판 위 표시)
function rightAt(id, toId = id) {
  const a = region(id), b = region(toId);
  if (!a || !b) throw new Error(`no region ${!a ? id : toId} on ${screen()}`);
  const c = (r) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
  dom.mouse('mousemove', ...c(a)); dom.mouse('mousedown', ...c(a), 2); pump(1);
  dom.mouse('mousemove', ...c(b)); pump(1);
  dom.mouse('mouseup', ...c(b), 2); pump(1);
}
function hover(id) {
  const r = region(id);
  if (!r) return false;
  dom.mouse('mousemove', r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  pump(1);
  return true;
}
const marksSeen = { board: 0, clear: false, shop: 0 };
// 관 선택 → 상점 → 관 선택(떠나온 상점으로 돌아가기): 오간 수 · 단추가 없어야 할 때 있음 · 오가며 바뀐 것
// 사슬 몫이 목표를 넘긴 채 사슬이 이어지는 순간: 잰 수 · 입력이 막힌 수(연출 중 · 누를 칸 없음 · 대국이 끝남)
const passSeen = { n: 0, blocked: 0 };
const shopBack = { trips: 0, stray: 0, changed: 0, overlap: 0 };
const pvSeen = { capture: 0, drop: 0, cut: 0, kb: 0, touch: 0 };
// 칸 말풍선: 증원 그림자 · 노림수
const tipSeen = { incoming: 0, forced: 0, path: 0 };
const newsSeen = { battles: 0, icons: 0 };
const objTips = { step: 0, gate: 0, highway: 0, wall: 0, gem: 0, trap: 0 };
// 밤샘 2: 시계(대국을 지고 다음 대국으로) · 다시 놓기(첫 수 전 단추)
// 세력(factions.js): 판마다 섞인 차례 · 대국에서 만난 세력 · 관 선택의 세력 띠와 다음 관 문장 · 처음 안내
const facSeen = { met: new Set(), orders: new Set(), runs: 0, band: 0, next: 0, bad: [] };
const n2 = { forced: false, clockBefore: null, clockLost: 0, clockShop: 0, clockNext: 0, clockBad: [], reboard: 0, reboardBot: 0, reboardBad: 0, tried: false, waitNext: false };
// 손은 하나만 든다: 둘을 차례로 눌러도 든 것은 나중 것 하나, 든 것을 다시 누르면 놓인다
const pickSeen = { swap: 0, swapBad: 0, off: 0, offBad: 0 };
// 낱말 상자: 카드를 가리키면 옆에 낱말 상자가 1개 이상, 카드 · 말풍선을 가리지 않고 화면 안에.
// 카드 하나에 둘까지(KEY_MAX), 기본 낱말(떨구기 · 사슬 · 값 · 배수 …)은 띄우지 않는다(docs/design-notes/voice.md)
// 카드의 종류(격언 · 각인 · 정석 …)는 상자로 띄우지 않고, 시너지 칩 · 띠는 말풍선 하나만(상자 없음)
const keySeen = { shop: 0, pack: 0, draft: 0, overlap: 0, off: 0, touch: 0, many: 0, basic: 0, own: 0, chip: 0, chipBox: 0 };
const OWN = { maxim: 'maxim', chart: 'chart', engraving: 'engraving', fragment: 'fragment', soul: 'soul', evolve: 'evolve', tactic: 'tactic' };
function ownKind(id) {
  if (id.startsWith('draft:')) return 'joseki';
  const m = id.match(/^(shop:buy|pack:pick):(\d+)$/);
  if (!m) return null;
  const it = m[1] === 'shop:buy' ? app.run.shop.display[+m[2]] : app.run.pack.options[+m[2]];
  return it ? OWN[it.kind] || null : null;
}
function chipBoxes() {
  for (const r of app.ui.regions.filter((q) => q.id.startsWith('fam:')).slice(0, 2)) {
    hover(r.id); keySeen.chip++;
    if ((app.keyBoxes || []).length) keySeen.chipBox++;
  }
}
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function keyBoxesAt(id, kind) {
  if (keySeen[kind] >= 60 || !hover(id)) return;
  const r = region(id), boxes = app.keyBoxes || [];
  // 카드 글 · 말풍선 글에 낱말이 있는데 상자가 없으면 따로 센다(체스 기물 카드처럼 낱말이 없는 카드는 빼고)
  const h = app.ui.hover, tip = h && h.tip ? h.tip() : null;
  const expect = termsIn([...(h && h.keys ? h.keys() : []), ...(tip ? tipTexts(tip) : [])]).length;
  // 설명 묶음이 화면에 다 안 들어가 상자를 뺀 것(layout.md 「설명 자리 규칙」 — 뒤의 상자부터 뺀다)은 따로 센다
  const dropped = app.noteStack ? app.noteStack.dropped : 0;
  if (boxes.length) keySeen[kind]++; else if (expect && dropped) { keySeen.dropped = (keySeen.dropped || 0) + 1; if (VERBOSE) console.log('자리가 없어 뺀 상자', id); } else if (expect) { keySeen.none = (keySeen.none || 0) + 1; if (VERBOSE) console.log('상자 없음', id); }
  if (boxes.length > KEY_MAX) keySeen.many++;
  const own = ownKind(id);
  if (own && boxes.some((b) => b.id === own)) { keySeen.own++; if (VERBOSE) console.log('카드 종류 상자', id, own); }
  for (const b of boxes) {
    if (TERM_BY_ID[b.id].basic) { keySeen.basic++; if (VERBOSE) console.log('기본 낱말 상자', id, b.id); }
    if (cross(b, r)) keySeen.overlap++;
    if (b.x < 0 || b.y < 0 || b.x + b.w > 480 || b.y + b.h > 270) keySeen.off++;
  }
}
// ── 자리 규칙(docs/design-notes/layout.md 「설명 자리 규칙」): 화면의 말풍선 · 낱말 상자가 뜨는 구역을 모두 가리켜 보고
//   판 틀(screen.notes 'side')은 왼쪽 칸(x 6 · 폭 116)에 가리킨 것의 윗변 높이로(왼쪽 칸 안의 것은 그 아래 · 위),
//   판 밖 틀은 가리킨 것 바로 아래(왼끝 · 오른끝 맞춤) 또는 바로 위. 묶음은 같은 x · 폭, 2px 틈으로 이어진다.
//   화면 밖 · 가리킨 것 · 누를 수 있는 다른 구역(켜진 단추 · 카드 · 칸)을 덮으면 어긴 것.
const place = { n: 0, side: 0, below: 0, rule: 0, chain: 0, off: 0, self: 0, cover: 0, none: 0, squeezed: 0, squeezedIds: [], hint: 0, hintBad: 0, screens: new Set(), kinds: new Map(), bad: [] };
const CAP_KIND = { sq: 14, deck: 6, codex: 8, hand: 4 };
const kindOf = (id) => id.replace(/:[^:]*$/, '');
function placeBad(what, id, detail = '') { place[what]++; if (place.bad.length < 12) place.bad.push(`${screen()} ${id} ${what} ${detail}`); }
function checkStack(id) {
  const st = app.noteStack;
  // 말풍선이 있는 구역인데 아무것도 안 떴다(자리가 없어 버린 것)
  const h = app.ui.hover, tip = h && h.tip ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null;
  if (tip && (!st || !st.rects.length)) { placeBad('none', id); return false; }
  if (!st || !st.rects.length) return false;
  // 왼쪽 칸 안의 것인데 위 · 아래 어디에도 안 들어가 당겨 놓은 것: 가리킨 것을 덮어도 어긴 것으로 치지 않고 센다
  if (st.squeezed) { place.squeezed++; if (place.squeezedIds.length < 6) place.squeezedIds.push(`${screen()} ${id}`); return true; }
  const a = st.anchor, rs = st.rects;
  place.n++; place[st.mode === 'side' ? 'side' : 'below']++; place.screens.add(screen());
  const top = rs[0].y, bot = rs[rs.length - 1].y + rs[rs.length - 1].h, total = bot - top;
  // 묶음: 같은 x · 폭, 2px 틈
  rs.forEach((r, k) => { if (r.x !== rs[0].x || r.w !== rs[0].w || (k && r.y !== rs[k - 1].y + rs[k - 1].h + P.NOTE_GAP)) placeBad('chain', id); });
  let rel = null;
  if (st.mode === 'side') {
    if (rs[0].x !== P.SIDE_X || rs[0].w !== P.SIDE_W) placeBad('rule', id, `x ${rs[0].x} w ${rs[0].w}`);
    if (P.inSide(a)) rel = top === a.y + a.h + P.NOTE_OFF ? 'side-below' : bot === a.y - P.NOTE_OFF ? 'side-above' : null;
    else rel = top === a.y ? 'side-row' : top === Math.max(2, Math.min(268 - total, a.y)) ? 'side-row(당김)' : null;
  } else {
    const hx = rs[0].x === a.x ? 'left' : rs[0].x + rs[0].w === a.x + a.w ? 'right' : rs[0].x === 2 || rs[0].x + rs[0].w === 478 ? 'edge' : null;
    const vy = top === a.y + a.h + P.NOTE_OFF ? 'below' : bot === a.y - P.NOTE_OFF ? 'above' : null;
    rel = hx && vy ? `${vy}-${hx}` : null;
  }
  if (!rel) placeBad('rule', id, `${st.mode} top ${top} anchor ${a.x},${a.y},${a.w},${a.h}`);
  const k = `${screen()} ${kindOf(id)}`;
  if (!place.kinds.has(k)) place.kinds.set(k, new Set());
  if (rel) place.kinds.get(k).add(rel.replace('(당김)', ''));
  if (top < 0 || bot > 270 || rs[0].x < 0 || rs[0].x + rs[0].w > 480) placeBad('off', id);
  const stack = { x: rs[0].x, y: top, w: rs[0].w, h: total };
  if (cross(stack, a)) placeBad('self', id);
  const inA = (r) => r.x >= a.x && r.y >= a.y && r.x + r.w <= a.x + a.w && r.y + r.h <= a.y + a.h;
  for (const r of app.ui.regions) if (r.onClick && r.enabled && r.id !== id && !inA(r) && cross(stack, r)) { placeBad('cover', id, r.id); break; }
  return true;
}
// 지금 화면에서 가리킬 수 있는 것을 모두(같은 종류가 많으면 고루 몇 개만)
function notesCheck() {
  const byKind = new Map();
  for (const r of app.ui.regions) { if (!r.tip && !r.keys) continue; const k = kindOf(r.id); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(r.id); }
  for (const [k, ids] of byKind) {
    const cap = CAP_KIND[k] || 99;
    const pick = ids.length <= cap ? ids : Array.from({ length: cap }, (_, i) => ids[Math.round((i * (ids.length - 1)) / (cap - 1))]);
    for (const id of pick) if (hover(id)) { checkStack(id); if (id.endsWith(':more')) moreCheck(id); }
  }
  dom.mouse('mousemove', -10, -10); pump(1);
}
// 시너지 「+N」(대국 띠 · 왼쪽 칸 시너지 줄): 가리키면 줄에 못 놓은 시너지가 모두 말풍선에 있고, 말풍선이 화면 안에 다 뜬다
const moreSeen = { n: 0, battle6: 0, screens: new Set(), bad: [] };
function moreCheck(id) {
  const pre = id.slice(0, -':more'.length);
  const n = familyCounts(app.run);
  const shown = new Set(app.ui.regions.filter((r) => r.id.startsWith(`${pre}:`) && r.id !== id).map((r) => r.id.slice(pre.length + 1)));
  const hidden = FAMILIES.filter((f) => n[f.id] > 0 && !shown.has(f.id));
  const h = app.ui.hover, tip = h && h.tip ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null;
  const lines = tip ? tipTexts(tip) : [];
  const missed = hidden.filter((f) => !lines.some((l) => l.startsWith(`${L(f.name)} `)));
  const st = app.noteStack, rs = st && st.rects && st.rects[0];
  const whole = rs && rs.y >= 0 && rs.y + rs.h <= 270;
  moreSeen.n++; moreSeen.screens.add(screen());
  if (screen() === 'battle' && FAMILIES.filter((f) => n[f.id] > 0).length >= 6) moreSeen.battle6++;
  if (!hidden.length || missed.length || !whole || !String(tip.title).includes(`+${hidden.length}`)) moreSeen.bad.push(`${screen()} ${id} 가려짐 ${hidden.length} · 빠짐 ${missed.map((f) => f.id).join(',') || 0}${whole ? '' : ' · 화면에 다 안 뜸'}`);
}
// 처음 안내 말풍선도 같은 자리(판 틀은 왼쪽 칸)
const hintChecked = new Set();
function hintCheck() {
  const h = app.hintShown, r = app.hintRect;
  if (!h || !r || hintChecked.has(h.id)) return;
  hintChecked.add(h.id); place.hint++;
  const s = app.overlay || app.screen;
  const side = s && s.notes === 'side';
  if (side ? r.x !== P.SIDE_X || r.w !== P.SIDE_W : r.w !== P.NOTE_W) { place.hintBad++; if (place.bad.length < 12) place.bad.push(`${screen()} 안내 ${h.id} x ${r.x} w ${r.w}`); }
  if (r.y < 0 || r.y + r.h > 270) place.hintBad++;
}
// 화면 종류마다 몇 번까지(판마다 짜임이 달라 여러 번)
const notesCount = {};
function notesOnce(key, n = 3) { if ((notesCount[key] || 0) >= n) return; notesCount[key] = (notesCount[key] || 0) + 1; notesCheck(); }

// 손가락: 진열 카드를 처음 누르면 사지 않고 보이기만, 한 번 더 누르면 산다
function touchBuy(i) {
  const it = app.run.shop.display[i], money = app.run.money;
  app.touch = true;
  try {
    click(`shop:buy:${i}`);
    if (it.sold || app.run.money !== money) throw new Error('touch: first tap on a shop card should only preview');
    const shown = (app.keyBoxes || []).length;
    click(`shop:buy:${i}`);
    if (it.sold && shown) keySeen.touch++;
  } finally { app.touch = false; }
}
const hoverTip = () => { const h = app.ui.hover; return !!(h && h.tip && (typeof h.tip === 'function' ? h.tip() : h.tip)); };
const screen = () => (app.overlay ? app.overlay.name : app.screen.name);
function idle(max = 3000) {
  let n = 0;
  while ((app.screen.name === 'battle' || app.screen.name === 'lesson') && app.screen.busy && n < max) { pump(1); n++; }
  if (n >= max) throw new Error('animation never ends');
  return n;
}

// ── 한 수 연출 시간(×1): 사건 순서가 만든 연출 길이의 합
const moveTimes = [];
let worst = null;
function measureSeq(s) {
  moveTimes.push(s.seq.total);
  if (!worst || s.seq.total > worst.total) {
    const by = {};
    for (const [l, d] of s.seq.trace || []) by[l] = (by[l] || 0) + d;
    worst = { total: s.seq.total, by };
  }
  s.seq.trace = [];
}

// ── 화면별 할 일
let rngS = SEED * 7919;
const rnd = () => { rngS = (rngS * 1103515245 + 12345) & 0x7fffffff; return rngS / 0x7fffffff; };
let paused = false, settingsSeen = false, draggedMaxim = false, reloaded = false;

function battleStep() {
  const s = app.screen;
  const b = app.run.battle;
  // 대국 첫 띠의 「새로」 줄(이번 판에서 처음 나온 것)
  if (s.banner && s.banner.news && !s.newsCounted) { s.newsCounted = true; newsSeen.battles++; newsSeen.icons += s.banner.news.length; }
  if (!paused) { dom.key('Escape'); pump(1); if (screen() !== 'pause') throw new Error('pause did not open'); click('pause:settings'); click('set:speed4'); click('set:shake'); click('set:big'); click('set:big'); click('set:back'); click('pause:resume'); paused = true; settingsSeen = true; }
  if (!s.busy) notesOnce(b.status === 'chain' ? 'battle-chain' : 'battle', 6);
  if (b.status === 'chain') {
    // 사슬 한가운데서 이어 하기(드묾): 먹을 칸 하나
    const t = s.clickable();
    click(`sq:${t.list[0]}`);
    idle();
    return;
  }
  // 시계: 2관 첫 대국을 한 번 일부러 진다(수 하나 · 먼 목표) → 시계 한 칸을 잃고 보상 없이 상점(CHM-20)을 거쳐 다음 대국으로 가야 한다
  if (!n2.forced && app.run.ante === 2 && b.movesUsed === 0 && !s.busy && app.run.clock > 1) {
    n2.forced = true; n2.clockBefore = { clock: app.run.clock, ante: app.run.ante, blind: app.run.blind, money: app.run.money };
    b.movesLeft = 1; b.target = 1e12; s.sync();
  }
  // 판 조정의 다시 놓기를 끄면(tuning.js) 단추가 없어야 한다
  if (!reboardOn() && region('btn:reboard')) n2.reboardBad++;
  // 다시 놓기: 3관부터 한 번은 단추를 눌러 본다(판이 바뀌고 손은 그대로 · 단추가 사라진다)
  if (!n2.tried && app.run.ante >= 3 && canReboard(b) && !s.busy && region('btn:reboard')) {
    n2.tried = true;
    const before = JSON.stringify(b.board), hand = JSON.stringify(b.hand);
    click('btn:reboard'); idle();
    const nb = app.run.battle;
    if (!nb || JSON.stringify(nb.board) === before || JSON.stringify(nb.hand) !== hand || region('btn:reboard')) n2.reboardBad++;
    n2.reboard++;
    return;
  }
  const d = decideBattle(b);
  if (!d) throw new Error('no decision');
  if (d.reboard) {
    if (!region('btn:reboard')) { n2.reboardBad++; throw new Error('bot wants to reboard but no button'); }
    click('btn:reboard'); idle();
    n2.reboard++; n2.reboardBot++;
    return;
  }
  if (d.discard) {
    for (const i of d.discard) click(`hand:${i}`);
    s.seq.total = 0;
    click('btn:discard');
    idle();
    return;
  }
  s.seq.total = 0;
  s.seq.trace = [];
  // 증원 그림자 위에 올리면 말풍선
  // 판 위 사물(발판 · 문 · 고속도로 줄 · 벽 · 보석) 칸에 올리면 말풍선
  const objSq = { step: (b.rules.steps || [])[0], gate: (b.rules.gates || [])[0], highway: (b.rules.highways || []).length ? b.rules.highways[0] + 8 * 3 : undefined, wall: b.board.findIndex((c) => c && c.t === 'X'), gem: b.board.findIndex((c) => c && c.t === 'J'), trap: (b.rules.traps || []).find((q) => !b.board[q]) };
  for (const [k, sq] of Object.entries(objSq)) if (sq != null && sq >= 0 && objTips[k] < 5 && !isHidden(b, sq)) { hover(`sq:${sq}`); if (hoverTip()) objTips[k]++; }
  const ghost = (b.incoming || []).find((r) => !b.board[r.sq]);
  if (ghost && tipSeen.incoming < 20) { hover(`sq:${ghost.sq}`); if (hoverTip()) tipSeen.incoming++; }
  const other = b.hand.findIndex((_, i) => i !== d.play.handIndex);
  if (other >= 0 && pickSeen.swap < 6) {
    click(`hand:${other}`);
    if (pickSeen.off < 2) { click(`hand:${other}`); pickSeen.off++; if (s.sel.length) pickSeen.offBad++; click(`hand:${other}`); }
    click(`hand:${d.play.handIndex}`);
    pickSeen.swap++;
    if (s.sel.length !== 1 || s.sel[0] !== d.play.handIndex) pickSeen.swapBad++;
  } else click(`hand:${d.play.handIndex}`);
  // 미리 보기: 떨굴 칸 위에 올리면 첫 먹이 고리
  hover(`sq:${d.play.sq}`);
  if (s.pvNow && s.pvNow.kind === 'drop' && s.pvNow.next.length) pvSeen.drop++;
  click(`sq:${d.play.sq}`);
  idle();
  let k = 0;
  for (const c of lineCommands(d.play.line)) {
    if (!app.run.battle || app.screen.name !== 'battle') break;
    if (c.type === 'capture') {
      // 먹을 적 위에 올려 미리 보기를 보고(바뀐 모습 = 실제로 먹은 뒤 모습), 가끔은 화살표 · 터치 두 번으로 먹는다
      const cb = app.run.battle;
      if (cb.target && cb.status === 'chain' && cb.score + Math.floor(cb.chain.value * cb.chain.mult) >= cb.target) {
        passSeen.n++;
        if (s.busy || app.run.phase !== 'battle' || !s.clickable().list.includes(c.sq)) passSeen.blocked++;
      }
      if (cb.chain && cb.chain.forced && tipSeen.forced < 20) { hover(`sq:${cb.chain.forced[0]}`); if (hoverTip()) tipSeen.forced++; }
      hover(`sq:${c.sq}`);
      const pv = s.pvNow;
      if (pv && pv.kind === 'capture' && pv.sq === c.sq) {
        pvSeen.capture++;
        if (pv.cut) pvSeen.cut++;
      }
      if (k === 1 && pvSeen.kb < 3) {
        dom.mouse('mousemove', 0, 0); pump(1);
        const list = s.clickable().list;
        const idx = list.indexOf(c.sq);
        for (let j = 0; j <= idx; j++) dom.key('ArrowRight');
        pump(1);
        if (s.pvNow && s.pvNow.sq === c.sq) pvSeen.kb++;
        dom.key('Enter');
        pump(1);
        idle();
        k++;
        continue;
      }
      if (k === 2 && pvSeen.touch < 3) {
        app.touch = true;
        click(`sq:${c.sq}`);
        if (s.busy) throw new Error('touch: first tap should only preview');
        if (s.pvNow && s.pvNow.sq === c.sq) pvSeen.touch++;
        click(`sq:${c.sq}`);
        app.touch = false;
        idle();
        k++;
        continue;
      }
    }
    click(`sq:${c.sq}`);
    idle();
    k++;
  }
  measureSeq(s);
}

function shopStep() {
  const run = app.run;
  notesOnce('shop', 6);
  // 격언 끌어 순서 바꾸기(한 번)
  if (!draggedMaxim && run.maxims.length >= 2) {
    const a = region('maxim:0'), b = region('maxim:1');
    if (a && b) { drag('maxim:0', b.x + 10, b.y + b.h - 2); draggedMaxim = true; }
  }
  for (let guard = 0; guard < 12 && app.screen.name === 'shop'; guard++) {
    const shop = run.shop;
    const i = shop.display.findIndex((it) => canBuy(run, it));
    if (i >= 0) keyBoxesAt(`shop:buy:${i}`, 'shop');
    if (keySeen.chip < 20) chipBoxes();
    if (i >= 0 && !keySeen.touch && app.screen.name === 'shop') { touchBuy(i); continue; }
    if (i >= 0 && rnd() < 0.8) { click(`shop:buy:${i}`); continue; }
    const p = shop.packs.findIndex((pk) => !pk.sold && run.money >= pk.price);
    if (p >= 0 && rnd() < 0.6) { click(`shop:pack:${p}`); return; }
    if (run.consumables.length) {
      const c = run.consumables[0];
      click('cons:0');
      if (c.kind === 'engraving' || c.kind === 'soul' || c.kind === 'evolve') {
        // 같은 각인 · 혼이 이미 있는 기물은 흐리고 눌리지 않는다(docs/tasks/backlog.md 6): 고를 수 있는 기물로
        const piece = c.kind === 'evolve' ? run.deck.find((x) => evolveTo(run.seed, x)) : run.deck.find((x) => targetOk(c, x));
        if (!piece) { click('target:cancel'); break; }
        const n = run.consumables.length;
        click(`deck:${piece.id}`);
        // 고르면 먼저 미리 보기, 확인해야 쓴다
        if (run.consumables.length !== n || !region('target:ok')) throw new Error('scroll used without a preview');
        previewSeen.scroll++;
        click('target:ok');
      }
      continue;
    }
    if (!shop.promoted && run.money >= 3 && rnd() < 0.3) {
      const piece = run.deck.find((x) => x.t !== 'Q');
      click(`deck:${piece.id}`);
      const opt = app.ui.regions.find((r) => r.id.startsWith('shop:promote:') && r.enabled);
      if (opt) click(opt.id); else dom.key('Escape');
      continue;
    }
    if (run.maxims.length >= 4 && rnd() < 0.3) { click('maxim:0'); if (region('shop:sell')) click('shop:sell'); continue; }
    if (run.money >= 5 + shop.rerolls && rnd() < 0.2) { click('shop:reroll'); continue; }
    break;
  }
  if (app.screen.name === 'shop') click('shop:leave');
}

function packStep() {
  const pack = app.run.pack;
  let i = pack.options.findIndex((o) => o.kind !== 'maxim' || app.run.maxims.length < 5);
  if (i < 0 || rnd() < 0.15) { click('pack:skip'); return; }
  pump(60);
  pump(40);
  notesOnce('pack', 6);
  keyBoxesAt(`pack:pick:${i}`, 'pack');
  click(`pack:pick:${i}`);
  // 칸이 찬 채로 격언을 고르면 격언 칸이 펼쳐진다(바꾸기) — 판을 도는 봇은 「그만」 뒤 건너뛴다
  if (app.screen.name === 'pack' && app.screen.panel) { click('pack:back'); click('pack:skip'); return; }
  if (app.screen.name === 'pack' && app.screen.engraveIndex != null) notesOnce('pack-target', 2);
  if (pack.options[i].kind === 'engraving' && app.screen.name === 'pack') {
    click(`deck:${app.run.deck.find((x) => targetOk(pack.options[i], x)).id}`);
    if (app.run.phase !== 'pack' || !region('target:ok')) throw new Error('engraved without a preview');
    previewSeen.pack++;
    click('target:ok');
  }
}

async function reload() {
  // 새로 부팅한 것처럼: 같은 저장소로 앱을 다시 만든다
  const phase = app.run.phase, ante = app.run.ante, money = app.run.money;
  seen();
  // 앞 앱은 같은 가짜 창에 듣개가 남아 있다: 누르기가 앞 앱 화면에도 닿지 않게 끊는다
  app.pointer = () => {}; app.key = () => {};
  app = await boot({ window: dom.window, document: dom.document });
  apps.push(app);
  app.onError = (e) => { errors.push(e); console.error(e); };
  pump(2);
  click('title:continue');
  if (app.run.phase !== phase || app.run.ante !== ante || app.run.money !== money) throw new Error(`continue restored a different run ${JSON.stringify([phase, ante, money, app.run.phase, app.run.ante, app.run.money, app.screen.name])}`);
  reloaded = true;
  log('  이어 하기 확인', phase, ante);
}

async function playOne(seed, { inject = null, opening = null, dan = null, daily = false } = {}) {
  app.nextSeed = seed;
  if (screen() !== 'title') app.toTitle();
  pump(1);
  if (daily) click('title:daily');
  else {
    click('title:new');
    if (opening) click(`setup:op:${opening}`);
    if (dan != null) click(`setup:dan:${dan}`);
    click('setup:start');
    if (opening && app.run.opening !== opening) throw new Error('opening not chosen');
    if (dan != null && app.run.dan !== dan) throw new Error('dan not chosen');
  }
  if (inject) inject(app.run);
  if (app.run.factions) { facSeen.runs++; facSeen.orders.add(app.run.factions.join(',')); }
  let steps = 0;
  while (steps++ < 4000) {
    const name = screen();
    if (name === 'result') break;
    if (name === 'battle' && app.run && app.run.battle) { const fm = app.run.battle.mods.find((m) => String(m.id).startsWith('faction:')); if (fm) facSeen.met.add(fm.id.slice(8)); else facSeen.bad.push(`세력 없는 대국 ${app.run.ante}관`); }
    if (name === 'select') {
      if (region('faction')) facSeen.band++; else facSeen.bad.push(`세력 띠 없음 ${app.run.ante}관`);
      if (app.run.ante < 7 && !app.run.endless) { if (region('select:next')) facSeen.next++; else facSeen.bad.push(`다음 관 문장 없음 ${app.run.ante}관`); }
    }
    if (name === 'draft') { pump(40); notesOnce('draft', 4); for (let k = 0; k < app.run.draft.options.length; k++) keyBoxesAt(`draft:${k}`, 'draft'); click(`draft:${Math.floor(rnd() * app.run.draft.options.length)}`); pump(60); continue; }
    if (name === 'select' && !tipSeen.path) { hover('select:path'); if (hoverTip()) tipSeen.path++; }
    if (name === 'select' && !app.run.shop && region('select:shop')) shopBack.stray++;
    if (name === 'select' && app.run.shop && shopBack.trips < 2 && region('select:shop')) {
      const b = region('select:shop'), p = region('select:path');
      if (p && b.x < p.x + p.w && p.x < b.x + b.w && b.y < p.y + p.h && p.y < b.y + b.h) shopBack.overlap++;
      const keep = JSON.stringify([app.run.shop, app.run.money, app.run.ante, app.run.blind]);
      click('select:shop'); pump(2);
      if (screen() !== 'shop') throw new Error(`select:shop → ${screen()}`);
      click('shop:leave'); pump(2);
      if (screen() !== 'select' || JSON.stringify([app.run.shop, app.run.money, app.run.ante, app.run.blind]) !== keep) shopBack.changed++;
      shopBack.trips++;
      continue;
    }
    // 시계를 잃은 뒤: 판이 이어져 상점이 열리고(보상 없음 · 상금 그대로) 시계가 한 칸 줄었나 · 상점을 떠나 다음 대국을 두면 센다
    // 외통은 목표와 상관없이 이긴다(세력마다 판이 달라 일부러 진 대국이 외통으로 끝날 수 있다): 다음 대국에서 다시 진다
    if ((name === 'shop' || name === 'select') && n2.clockBefore && !n2.waitNext && app.run.log.at(-1) && app.run.log.at(-1).reason === 'mate') { n2.forced = false; n2.clockBefore = null; }
    if ((name === 'shop' || name === 'select') && n2.clockBefore && !n2.waitNext) {
      const c = n2.clockBefore, last = app.run.log.at(-1);
      n2.clockLost++;
      if (name !== 'shop' || !last || !last.clockLost || app.run.clock !== c.clock - 1 || app.run.phase !== 'shop' || app.run.money !== c.money || (app.run.last && app.run.last.reward)) n2.clockBad.push(`${c.ante}:${c.blind} ${name} ${app.run.clock}/${c.clock} 상금 ${app.run.money}/${c.money}`);
      else n2.clockShop++;
      n2.waitNext = true;
    }
    if (name === 'select') { notesOnce('select', 4); if (n2.waitNext || !(app.run.blind < 2 && rnd() < 0.15)) click('select:play'); else click('select:skip'); pump(2); if (n2.waitNext && screen() === 'battle') { n2.clockNext++; n2.waitNext = false; n2.clockBefore = null; } continue; }
    if (name === 'chest') { click('next'); pump(2); notesOnce('chest', 4); click('next'); pump(1); continue; }
    if (name === 'battle') { idle(); if (app.screen.name === 'battle' && app.run.battle) battleStep(); else pump(1); continue; }
    if (name === 'reward' || name === 'chest' || name === 'legend') { click('next'); pump(1); if (screen() === name) click('next'); continue; }
    if (name === 'shop') { if (!reloaded && !inject) { await reload(); continue; } shopStep(); continue; }
    if (name === 'pack') { packStep(); continue; }
    if (name === 'pause') { click('pause:resume'); continue; }
    throw new Error(`stuck on ${name}`);
  }
  const run = app.run;
  log(`판 seed ${seed}: ${run.phase} ${run.ante}관 ${run.blind} · 격언 ${run.maxims.map((m) => m.id).join(',')}`);
  return run;
}

// 첫 수업 열: 처음 켜면 타이틀 없이 수업 1의 시범. 시범을 끝까지 보고, 누를 수 없는 칸은 반응이 없고,
// 걸음대로 두면 다음 수업 → 수업 ⑩(상점 길: 가리키는 곳만 눌린다) → 1관 첫 대국
function playLesson(i) {
  const s = app.screen;
  if (i === 2) notesOnce('lesson', 1);
  if (s.name !== 'lesson' || s.index !== i || s.phase !== 'demo') throw new Error(`lesson ${i} not in demo`);
  for (let n = 0; n < 4000 && app.screen === s; n++) pump(1);
  const p = app.screen;
  if (p.index !== i || p.phase !== 'play') throw new Error(`lesson ${i} demo did not end`);
  let wrongTried = false;
  for (let k = 0; k < p.steps.length; k++) {
    idle();
    const st = p.steps[k];
    if (p.si !== k) throw new Error(`lesson ${i} at step ${p.si}, expected ${k}`);
    if (st.pick != null) {
      if (st.pick > 0 || p.view.hand.length > 1) { click(`hand:${p.view.hand.length - 1 === st.pick ? 0 : p.view.hand.length - 1}`); if (p.sel.length) throw new Error('lesson picked a wrong piece'); }
      click(`hand:${st.pick}`);
    } else if (st.discard) click('btn:discard');
    else {
      const list = p.clickable().list;
      if (!list.length) throw new Error(`lesson ${i} step ${k} has nothing to press`);
      if ('drop' in st && !wrongTried) {
        wrongTried = true;
        const off = [...Array(64).keys()].find((sq) => !list.includes(sq) && !p.view.board[sq]);
        click(`sq:${off}`);
        if (p.busy || p.hold.b.status !== 'play') throw new Error('lesson reacted to a wrong square');
        if (!p.sel.length) click(`hand:${p.steps[k - 1].pick}`);
      }
      if (st.cap && list.length !== 1) throw new Error(`lesson ${i} step ${k} shows ${list.length} targets`);
      click(`sq:${list[list.length - 1]}`);
    }
  }
  for (let n = 0; n < 900 && app.screen === p; n++) pump(1);
  if (p.hold.b.status !== 'won') throw new Error(`lesson ${i} not won`);
  lessonLog.push(`${i + 1} ${p.L.title} ${p.hold.b.score}`);
}
function playShopLesson(i) {
  if (!app.guide || app.screen.name !== 'shop') throw new Error('shop lesson did not open');
  // 가리키지 않은 곳은 눌리지 않는다
  const money = app.run.money;
  click('shop:buy:1');
  if (app.run.money !== money) throw new Error('guide let a wrong press through');
  for (let n = 0; n < 40 && app.guide; n++) {
    const st = app.guide.steps[app.guide.i];
    pump(30);
    if (st.ok) click('guide:ok'); else click(st.target);
    pump(30);
  }
  if (app.guide) throw new Error('shop lesson guide stuck');
  lessonLog.push(`${i + 1} 상점`);
}
function lessons() {
  if (screen() !== 'lesson' || app.screen.index !== 0) throw new Error('first launch did not open the first lesson');
  const { LESSONS } = lessonMod;
  for (let i = 0; i < LESSONS.length; i++) {
    if (LESSONS[i].shop) playShopLesson(i); else playLesson(i);
  }
  for (let n = 0; n < 200 && screen() === 'draft' && app.run.phase === 'draft'; n++) { pump(90); click('draft:0'); pump(60); }
  if (screen() !== 'battle' || !app.run || app.run.ante !== 1 || !app.records.lessonsDone) throw new Error(`lessons did not lead to the first battle (${screen()})`);
  if (app.run.scratch) throw new Error('lesson run leaked');
  app.toTitle();
  pump(1);
}
const lessonLog = [];

const t0 = performance.now();
await start();
lessons();
const results = [];
for (let k = 0; k < RUNS; k++) results.push(await playOne(SEED + k));
// 판 밖: 도감 · 기록 화면, 오프닝과 단을 모두 연 뒤 시실리안 3단 판, 오늘의 대국
click('result:title');
click('title:codex');
for (const t of ['factions', 'legends', 'openings', 'editions', 'pieces', 'maxims']) { click(`codex:tab:${t}`); notesCheck(); if (region('codex:next') && region('codex:next').enabled) { click('codex:next'); notesCheck(); click('codex:prev'); } }
click('codex:back');
click('title:records');
click('records:back');
click('title:lesson');
if (!region('lessons:9')) throw new Error('lesson list incomplete');
click('lessons:terms');
// 낱말 풀이: 묶음마다 쪽을 넘겨 본다(글이 옮겨지는지 · 예외가 없는지)
for (const g of ['battle', 'run', 'item', 'set']) { click(`terms:tab:${g}`); for (let k = 0; k < 4 && region('terms:next') && region('terms:next').enabled; k++) click('terms:next'); }
click('lessons:back');
click('lessons:back');
if (app.records.runs < RUNS) throw new Error('records did not count runs');
app.records.unlocked.openings = ['standard', 'london', 'sicilian', 'queens_gambit', 'rook_endgame'];
app.records.unlocked.dan = 8;
results.push(await playOne(SEED + 50, { opening: 'sicilian', dan: 3 }));
results.push(await playOne(0, { daily: true }));
if (!app.run.daily || !app.records.daily) throw new Error('daily not recorded');
// 전설 셋을 쥐여 준 판: 상록(다시 떨구기) · 오페라(판 다시 채우기) · 불멸(끊김 넘기기)의 연출
results.push(await playOne(SEED + 100, {
  inject: (run) => {
    for (const id of ['evergreen', 'opera', 'immortal']) run.maxims.push({ uid: run.nextUid++, id, data: {}, edition: null, paid: 0, legendary: true });
    run.legends.push('evergreen', 'opera', 'immortal');
    run.fragments.century = { first: true, feat: false, gold: false };
  },
}));
// 이긴 판이면 끝없는 대국으로 이어 두다가 진다
let endless = false;
if (app.run.phase === 'won') {
  // 쥐여 준 전설을 거둬야 끝없는 대국이 몇 관 안에 끝난다
  app.run.maxims = app.run.maxims.filter((m) => !m.legendary);
  click('result:endless');
  endless = true;
  for (let steps = 0; steps < 3000 && screen() !== 'result'; steps++) {
    const name = screen();
    if (name === 'draft') { pump(40); click('draft:0'); pump(60); continue; }
    if (name === 'select') { click('select:play'); pump(2); continue; }
    if (name === 'battle') { idle(); if (app.screen.name === 'battle' && app.run.battle) battleStep(); else pump(1); continue; }
    if (name === 'reward' || name === 'chest' || name === 'legend') { click('next'); pump(1); if (screen() === name) click('next'); continue; }
    if (name === 'shop') { shopStep(); continue; }
    if (name === 'pack') { packStep(); continue; }
    throw new Error(`stuck on ${name}`);
  }
  if (!app.records.bestEndless) throw new Error('endless not recorded');
  log('  끝없는 대국', app.run.ante, '관까지');
}
// 결과 화면에서 다시 → 타이틀, 전설 장면 직접
click('result:title');
app.run = results[results.length - 1];
app.flow([['legend', { legend: 'century' }]]);
pump(30);
click('next');

// 자리 규칙: 판이 우연히 만들지 않을 수도 있는 장면을 세워서(격언 다섯 · 시너지 넷 · 정석 둘 · 두루마리 넷 · 금빛 꾸러미 · 각인 새기기 · 5관 대국)
{
  const { createRng, fork } = await import('../src/sim/rng.js');
  const fill = (r) => {
    const add = (id, edition = null) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
    for (const [id, ed] of [['chivalry'], ['quick_change', 'foil'], ['first_move'], ['whim', 'rainbow'], ['sacrifice']]) add(id, ed);
    r.josekis = ['gates', 'stepping'];
    r.fragments.century = { first: true, feat: false, gold: false };
    r.deck.push({ id: 80, t: 'O', eng: null }, { id: 81, t: 'S', eng: null, soul: 'echo' }, { id: 82, t: 'L', eng: { id: 'glass' } });
    r.consumableSlots = 4;
    r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
    r.money = 30;
  };
  const stock = (r) => { r.shop = { rng: fork(createRng(3), 'layout'), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'C', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false }; };
  const scene = (setup) => { app.overlay = null; app.nextSeed = 11; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 }); fill(app.run); setup(app.run); pump(90); notesCheck(); };
  scene((r) => { r.phase = 'shop'; stock(r); app.go('shop'); });
  scene((r) => { r.phase = 'shop'; stock(r); app.go('shop'); pump(2); click('cons:0'); click(`deck:${r.deck[1].id}`); });
  scene((r) => { r.phase = 'pack'; stock(r); r.pack = { kind: 'golden', options: [{ kind: 'maxim', id: 'chivalry', edition: 'foil' }, { kind: 'maxim', id: 'light_step', edition: 'pearl' }, { kind: 'fragment', legend: 'immortal' }] }; app.go('pack'); });
  scene((r) => { r.phase = 'pack'; stock(r); r.pack = { kind: 'engraving', options: [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }] }; app.go('pack'); pump(90); click('pack:pick:1'); click(`deck:${r.deck[2].id}`); });
  // 카드 넷인 금빛 꾸러미(CHM-12): 가장 긴 판본 격언 · 명국 조각 · 격언 칸 다섯이 찬 채로 — 조각은 건너뛰기 줄, 격언 칸은 위 띠 이름표.
  // 칸이 찬 채로 격언을 고르면 격언 칸이 펼쳐지고 옛 격언 하나와 바꾼다 · 이름표를 누르면 펼쳐 판다
  const golden4 = [{ kind: 'maxim', id: 'shadow_reading', edition: 'obsidian' }, { kind: 'maxim', id: 'reinforce_hunt', edition: 'obsidian' }, { kind: 'maxim', id: 'memory', edition: 'foil' }, { kind: 'fragment', legend: 'immortal' }];
  scene((r) => { r.phase = 'pack'; stock(r); r.pack = { kind: 'golden', options: golden4.map((o) => ({ ...o })) }; app.go('pack'); });
  {
    const r = app.run, before = r.maxims.map((m) => m.id), money = r.money;
    if (!region('pack:maxims') || region('maxim:0') || !region('pack:pick:3') || app.screen.panel) goldSeen.bad.push('접힌 격언 칸 · 명국 조각 칸이 없다');
    click('pack:pick:2'); pump(2);
    if (!app.screen.panel || app.screen.panel.pick !== 2 || !region('maxim:1') || !region('pack:chosen') || region('pack:skip')) goldSeen.bad.push('칸이 찬 채로 고른 격언에 격언 칸이 펼쳐지지 않았다');
    notesCheck();
    click('maxim:1'); pump(2);
    if (!region('pack:swap')) goldSeen.bad.push('바꾸기 단추가 없다');
    notesCheck();
    click('pack:swap'); pump(2);
    const after = app.run.maxims.map((m) => m.id);
    if (app.run.phase !== 'shop' || after.length !== before.length || after.includes(before[1]) || !after.includes('memory') || app.run.money <= money) goldSeen.bad.push(`바꾸기가 어긋났다 ${before.join(',')} › ${after.join(',')}`);
    else goldSeen.swap++;
  }
  scene((r) => { r.phase = 'pack'; stock(r); r.pack = { kind: 'golden', options: golden4.map((o) => ({ ...o })) }; app.go('pack'); });
  {
    const n = app.run.maxims.length;
    click('pack:maxims'); pump(2);
    if (!app.screen.panel || app.screen.panel.pick != null || !region('maxim:0') || !region('pack:back')) goldSeen.bad.push('이름표를 눌러도 격언 칸이 펼쳐지지 않았다');
    notesCheck();
    click('maxim:0'); pump(2);
    if (!region('pack:sell')) goldSeen.bad.push('팔기 단추가 없다');
    else { click('pack:sell'); pump(2); if (app.run.maxims.length !== n - 1) goldSeen.bad.push('팔기가 어긋났다'); else goldSeen.sell++; }
    click('pack:back'); pump(2);
    if (app.screen.panel || !region('pack:pick:0') || !region('pack:skip')) goldSeen.bad.push('「그만」 뒤 카드 줄로 돌아오지 않았다');
    // 자리가 생겼으니 은박 격언은 곧바로 받는다
    click('pack:pick:2'); pump(2);
    if (app.run.phase !== 'shop' || !app.run.maxims.some((m) => m.id === 'memory')) goldSeen.bad.push('자리가 생긴 뒤 격언을 곧바로 받지 못했다');
  }
  scene((r) => { r.ante = 3; r.blind = 0; r.draft = { ante: 3, options: ['martyr_vow', 'knight_oath', 'highway'] }; r.phase = 'draft'; app.go('draft'); });
  scene((r) => { r.factions[0] = 'hunters'; app.cmd({ type: 'skip' }); app.cmd({ type: 'skip' }); app.goPhase(); });
  scene((r) => { r.ante = 5; r.blind = 0; app.cmd({ type: 'play' }); app.go('battle', { events: [] }); pump(200); });
  // 사람이 보낸 대국 화면(2026-09-28 「글자 삐져나가는 거」): 격언 다섯(귀함 겹테 · 은박 점선 · 흔함) · 판본 · 시너지 넷 · 손 넷 — 격언 칸 · 칩 · 단추의 글이 테에 닿지 않는지.
  // 판본은 넷을 모두(자개 · 무지개 · 흑요도) 한 번씩 지나간다
  for (const eds of [[null, null, null, null, 'foil'], ['pearl', null, 'rainbow', null, 'obsidian']]) {
    scene((r) => {
      r.maxims = [];
      ['collector_forms', 'long_chain', 'first_move', 'empty_bag', 'kings_neck'].forEach((id, k) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: eds[k], paid: 5 }));
      r.ante = 5; r.blind = 0; app.cmd({ type: 'play' }); app.go('battle', { events: [] }); pump(200);
    });
    click(`hand:0`); pump(30); click(`hand:0`); pump(10);
  }
  // 판 위 표시: 오른쪽 누르기 = 칸 칠(멈춤이 열리지 않는다) · 오른쪽 끌기 = 화살표(곧은 · 나이트) · 같은 것 다시 = 지움 · 왼쪽 누르기 = 모두 지움
  {
    const mk = () => app.screen.marks;
    rightAt('sq:27');
    if (app.overlay || screen() !== 'battle' || !mk().squares.has(27)) throw new Error('right-click did not mark a square (or opened pause)');
    rightAt('sq:27'); if (mk().squares.size) throw new Error('right-click again did not unmark');
    rightAt('sq:27'); rightAt('sq:28');
    rightAt('sq:8', 'sq:40'); rightAt('sq:1', 'sq:18');
    if (mk().arrows.length !== 2 || mk().squares.size !== 2) throw new Error('right-drag did not draw arrows');
    rightAt('sq:1', 'sq:18'); if (mk().arrows.length !== 1) throw new Error('same arrow did not remove');
    marksSeen.board = mk().count;
    click('sq:63');
    if (mk().count || app.overlay) throw new Error('left-click did not clear marks');
    marksSeen.clear = true;
    dom.mouse('mousemove', 20, 20); dom.mouse('mousedown', 20, 20, 2); dom.mouse('mouseup', 20, 20, 2); pump(1);
    if (app.overlay || mk().count) throw new Error('right-click off the board did something');
    dom.key('Escape'); pump(1); if (screen() !== 'pause') throw new Error('Esc no longer pauses'); click('pause:resume');
  }
  scene((r) => { r.phase = 'shop'; stock(r); app.go('shop'); });
  for (const id of ['shop:buy:0', 'shop:leave', 'maxim:0', 'cons:0']) {
    if (!region(id)) continue;
    const before = JSON.stringify([app.run.money, app.run.maxims.length, app.run.consumables.length]);
    rightAt(id);
    if (app.overlay || screen() !== 'shop' || JSON.stringify([app.run.money, app.run.maxims.length, app.run.consumables.length]) !== before) throw new Error(`right-click on ${id} did something`);
    marksSeen.shop++;
  }
  app.go('chest', { chest: { count: 3, tier: 'uncommon', cells: [{ lit: false, item: null }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'engrave', piece: 'P', pieceId: 1, eng: 'ivory' } }, { lit: false, item: null }] } });
  pump(200); notesCheck();
  app.toTitle(); pump(1);
}

// 큰 수(CHM-10): 끝없는 대국 깊은 관의 13~16자리 수 — 관 선택 카드의 목표, 대국 머리 칸 목표 · 점수, 값 × 배수 칸이 터지며 보이는 곱,
// 결과 · 기록 · 보상의 수치 줄. 글 넘침(flowCheck)에 더해 같은 상자 안의 글끼리 겹침(이름표와 수치)도 잰다
const bigSeen = { battle: 0, select: 0, result: 0, records: 0, reward: 0, overlap: [] };
{
  const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const look = (key, n = 1) => {
    pump(n);
    bigSeen[key]++;
    const ts = LL.LOG.texts.filter((q) => q.s.trim() && !(q.box && q.box.loose));
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i], b = ts[j];
      if (a.box === b.box && a.layer === b.layer && cross(a, b) && bigSeen.overlap.length < 12) bigSeen.overlap.push(`${screen()} 「${a.s}」 ∩ 「${b.s}」`);
    }
  };
  const BIG = [1719572936961, 6184890789926, 999999999999999, 9876543210987654];
  // 결과 화면은 판을 기록에 적는다(finishRun) — 세운 장면이 기록(끝없는 대국 깊이 · 판 수)을 바꾸지 않게 되돌린다
  const saved = JSON.stringify(app.records);
  const deep = (ante) => { app.overlay = null; app.nextSeed = 11; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 }); const r = app.run; r.endless = true; r.ante = ante; r.blind = 0; return r; };
  for (const ante of [29, 33, 36]) {
    const r = deep(ante); r.phase = 'select'; app.goPhase(); look('select', 60);
    app.cmd({ type: 'play' }); app.go('battle', { events: [] }); pump(200);
    const v = app.screen.view;
    for (const n of BIG) {
      v.score = n; v.target = Math.round(n * 0.7); v.gather = null; v.count = null; look('battle', 2);
      v.gather = { p: 1, value: 1234567, mult: 98765, score: n, burst: true }; look('battle', 2);
      v.gather = null; v.count = { from: 0, to: n, p: 0.3 }; look('battle', 2); v.count = null;
    }
  }
  for (const n of BIG) {
    const r = deep(29);
    r.last = { score: n, target: Math.round(n * 0.6), overflow: 1, reason: 'score' };
    app.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 0, overflow: 1, earned: 1, total: 7 }, events: [] }); look('reward', 200);
    const r2 = deep(29);
    r2.log.push({ ante: 29, blind: 0, kind: 'practice', score: Math.round(n / 3), target: n, best: Math.round(n / 2) });
    r2.bestReplay = { board: Array(64).fill(null), drop: { sq: 27, piece: 'N' }, caps: [{ from: 27, to: 44, form: 'N', after: 'B' }], score: n, reason: 'end' };
    r2.phase = 'lost';
    app.go('result'); look('result', 60);
    app.records.bestMove = { score: n, steps: ['P', 'N', 'B', 'R', 'Q', 'N', 'B', 'R', 'Q'], ante: 29 };
    app.go('records'); look('records', 5);
  }
  app.records = JSON.parse(saved); app.saveRecords();
  app.toTitle(); pump(1);
}

// 기보가 보이는 곳(docs/tasks/backlog.md 5): 기보가 붙은 모습으로 먹으면 청록 몫이 뜬다 · 기보를 쓰면 그 모습의 기물이 자란다(단계가 바뀌면 크게)
const chartSeen = { run: 0, scene: 0, grow: 0, tick: 0, growBad: 0 };
{
  chartSeen.run = app.stats.chartPops || 0;
  const setup = (fn) => { app.overlay = null; app.nextSeed = 11; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 }); fn(app.run); pump(90); };
  setup((r) => { Object.assign(r.charts, { P: 2, N: 2, B: 2, R: 2, Q: 2 }); const e0 = app.cmd({ type: 'play' }); app.go('battle', { events: e0 }); pump(200); });
  const before = app.stats.chartPops || 0;
  for (let n = 0; n < 6 && app.screen.name === 'battle' && app.run.battle && app.run.battle.status === 'play' && (app.stats.chartPops || 0) === before; n++) {
    const d = decideBattle(app.run.battle);
    if (!d) break;
    if (d.discard) { for (const i of d.discard) click(`hand:${i}`); click('btn:discard'); idle(); continue; }
    click(`hand:${d.play.handIndex}`); click(`sq:${d.play.sq}`); idle();
    for (const c of lineCommands(d.play.line)) { if (app.screen.name !== 'battle' || !app.run.battle || app.run.battle.status !== 'chain') break; click(`sq:${c.sq}`); idle(); }
  }
  chartSeen.scene = (app.stats.chartPops || 0) - before;
  // 상점에서 기보 두루마리: 나이트 2 → 3(동 → 은, 크게) · 3 → 4(수준만)
  for (const [from, big] of [[2, true], [3, false]]) {
    setup((r) => { r.phase = 'shop'; r.battle = null; r.charts.N = from; r.consumables = [{ kind: 'chart', form: 'N' }]; r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; app.go('shop'); });
    click('cons:0');
    const g = app.screen.grow;
    if (!g || g.form !== 'N' || g.big !== big || g.from !== from || g.to !== from + 1) chartSeen.growBad++;
    else if (big) chartSeen.grow++; else chartSeen.tick++;
    pump(70);
  }
  app.toTitle(); pump(1);
}

// 각인 · 혼 덮어쓰기(docs/tasks/backlog.md 6): 이미 같은 종류가 있는 기물을 고르면 옛 것 › 새 것 확인(target:swap).
// 「그만」이면 대상 고르기로(두루마리 · 꾸러미 · 기물 그대로), 「바꾸기」면 새 것으로. 같은 것이 새겨진 기물은 고를 수 없다
const swapSeen = { same: 0, shopBack: 0, shopSwap: 0, soulSwap: 0, packBack: 0, packSwap: 0, bad: [] };
{
  const bad = (m) => swapSeen.bad.push(m);
  const setup = (fn) => { app.overlay = null; app.nextSeed = 11; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 }); fn(app.run); pump(90); };
  const stock = (r) => { r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; };
  // 상점 두루마리: 유리 각인 → 유리가 있는 기물(고를 수 없다) → 금이 있는 기물(확인) → 그만 → 다시 → 바꾸기. 이어서 혼(굶주림 → 메아리)
  setup((r) => { r.phase = 'shop'; r.battle = null; stock(r); r.deck[1].eng = { id: 'gold' }; r.deck[2].eng = { id: 'glass' }; r.deck[3].soul = 'hunger'; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }]; app.go('shop'); });
  {
    const r = app.run, s = () => app.screen;
    const [gold, glass, hunger] = [r.deck[1], r.deck[2], r.deck[3]];
    click('cons:0');
    click(`deck:${glass.id}`);
    if (s().target && s().target.pieceId == null && !region('target:ok')) swapSeen.same++; else bad('같은 각인이 있는 기물이 골라졌다');
    click(`deck:${gold.id}`);
    if (!region('target:swap') || !region('target:ok') || r.consumables.length !== 2 || gold.eng.id !== 'gold') bad('금 각인 기물에 확인이 뜨지 않았다');
    // 옛 문양을 가리키면 옛 효과(설명 자리 규칙 · 영어 옮김도 같이 잰다)
    if (!hover('target:swap') || !hoverTip()) bad('옛 문양 말풍선이 뜨지 않았다');
    notesCheck();
    click('target:cancel');
    if (s().target && s().target.index === 0 && s().target.pieceId == null && r.consumables.length === 2 && gold.eng.id === 'gold' && !region('target:swap')) swapSeen.shopBack++; else bad('상점 「그만」이 대상 고르기로 돌아가지 않았다');
    click(`deck:${gold.id}`);
    click('target:ok');
    if (gold.eng.id === 'glass' && r.consumables.length === 1 && r.consumables[0].kind === 'soul') swapSeen.shopSwap++; else bad('상점 「바꾸기」가 새 각인으로 바꾸지 않았다');
    pump(30);
    click('cons:0');
    click(`deck:${hunger.id}`);
    if (!region('target:swap')) bad('혼이 있는 기물에 확인이 뜨지 않았다');
    click('target:ok');
    if (hunger.soul === 'echo' && !r.consumables.length) swapSeen.soulSwap++; else bad('혼 「바꾸기」가 새 혼으로 바꾸지 않았다');
    pump(30);
  }
  // 꾸러미 각인: 유리를 골라 금이 있는 기물 → 그만(꾸러미 그대로) → 다시 → 바꾸기
  setup((r) => { r.phase = 'pack'; r.battle = null; stock(r); r.deck[1].eng = { id: 'gold' }; r.pack = { kind: 'engraving', options: [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }] }; app.go('pack'); pump(90); });
  {
    const r = app.run, gold = r.deck[1];
    click('pack:pick:0');
    click(`deck:${gold.id}`);
    if (!region('target:swap')) bad('꾸러미에서 금 각인 기물에 확인이 뜨지 않았다');
    notesCheck();
    click('target:cancel');
    if (screen() === 'pack' && r.phase === 'pack' && r.pack && app.screen.engraveIndex === 0 && app.screen.engraveTarget == null && gold.eng.id === 'gold') swapSeen.packBack++; else bad('꾸러미 「그만」이 대상 고르기로 돌아가지 않았다');
    click(`deck:${gold.id}`);
    click('target:ok');
    if (gold.eng.id === 'glass' && r.phase === 'shop') swapSeen.packSwap++; else bad('꾸러미 「바꾸기」가 새 각인으로 바꾸지 않았다');
    pump(30);
  }
  app.toTitle(); pump(1);
}

// 처음 켠 사람이 수업을 건너뛴다 → 곧바로 1관 · 처음 안내를 끄면 뜨지 않는다
let skipOk = false;
const hintFail = ['shop', 'pack', 'draft', 'family'].filter((id) => !hintsShown.has(id) || !app.records.coachSeen[id]);
const mainApp = app;
{
  seen();
  app.pointer = () => {}; app.key = () => {};
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  app = await boot({ window: dom.window, document: dom.document });
  apps.push(app);
  app.onError = (e) => { errors.push(e); console.error(e); };
  pump(2);
  if (screen() !== 'lesson') throw new Error('fresh boot did not open lessons');
  click('lesson:skip');
  pump(2);
  if (!app.records.lessonsDone || !app.run || app.run.ante !== 1) throw new Error('skip did not start the first run');
  app.settings.coach = false;
  for (let n = 0; n < 200 && screen() === 'draft'; n++) { pump(40); if (app.hintShown) throw new Error('hint shown while off'); if (region('draft:0')) click('draft:0'); pump(60); }
  if (app.hintShown) throw new Error('hint shown while off');
  skipOk = true;
  log('  수업 건너뛰기 · 안내 끄기 확인');
  seen();
  app = mainApp;
}
seen();
const need = ['title', 'lesson', 'lessons', 'setup', 'select', 'battle', 'reward', 'chest', 'shop', 'pack', 'result', 'pause', 'settings', 'legend', 'codex', 'records'];
const missing = need.filter((n) => !visited.has(n));
const ms = app.stats.drawMs.slice().sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] || 0;
const avg = ms.reduce((a, x) => a + x, 0) / Math.max(1, ms.length);
const mt = moveTimes.slice().sort((a, b) => a - b);
console.log(`연기 시험 seed ${SEED}: 판 ${results.length} (${results.map((r) => `${r.phase} ${r.ante}관`).join(' · ')})`);
console.log(`프레임 ${ms.length} · 그리기 평균 ${avg.toFixed(2)}ms · p99 ${pct(0.99).toFixed(2)}ms · 최대 ${ms[ms.length - 1].toFixed(2)}ms · 그리기 호출 ${dom.counter.calls} · 화면 배율 ${app.scale}(캔버스 ${dom.screen.width}×${dom.screen.height})`);
console.log(`한 수 연출(×1) 평균 ${(mt.reduce((a, x) => a + x, 0) / Math.max(1, mt.length)).toFixed(2)}s · 최대 ${(mt[mt.length - 1] || 0).toFixed(2)}s (${mt.length}수)`);
if (VERBOSE && worst) console.log('가장 긴 수', JSON.stringify(worst));
const ims = [];
for (const a of apps) ims.push(...(a.stats.inputMs || []));
ims.sort((a, b) => a - b);
console.log(`누르기 처리 ${ims.length}번 · 평균 ${(ims.reduce((a, x) => a + x, 0) / Math.max(1, ims.length)).toFixed(2)}ms · p99 ${(ims[Math.floor(ims.length * 0.99)] || 0).toFixed(2)}ms · 최대 ${(ims[ims.length - 1] || 0).toFixed(2)}ms`);
console.log(`방문 화면: ${[...visited].join(' ')}`);
console.log(`끝없는 대국: ${endless ? `${app.records.bestEndless}관` : '못 감'}`);
console.log(`첫 수업: ${lessonLog.join(' · ')}`);
console.log(`미리 보기: 먹기 ${pvSeen.capture} · 끊김 ${pvSeen.cut} · 떨구기 ${pvSeen.drop} · 화살표 ${pvSeen.kb} · 터치 ${pvSeen.touch}`);
console.log(`말풍선: 증원 ${tipSeen.incoming} · 노림수 ${tipSeen.forced} · 판의 길 ${tipSeen.path}`);
console.log(`대국 띠 「새로」: 대국 ${newsSeen.battles} · 그림 ${newsSeen.icons}`);
console.log(`손 고르기: 둘을 차례로 ${pickSeen.swap}(둘 이상 남음 ${pickSeen.swapBad}) · 다시 눌러 놓기 ${pickSeen.off}(안 놓임 ${pickSeen.offBad})`);
console.log(`판 위 사물 말풍선: 발판 ${objTips.step} · 문 ${objTips.gate} · 고속도로 ${objTips.highway} · 벽 ${objTips.wall} · 보석 ${objTips.gem} · 함정 ${objTips.trap}`);
console.log(`시계 · 다시 놓기: 시계를 잃고 상점 ${n2.clockLost} → ${n2.clockShop} → 다음 대국 ${n2.clockNext}(어긋남 ${n2.clockBad.length}${n2.clockBad.length ? ': ' + n2.clockBad.join(' | ') : ''}) · 다시 놓기${reboardOn() ? '' : '(끔)'} ${n2.reboard}(봇 ${n2.reboardBot}, 어긋남 ${n2.reboardBad})`);
console.log(`이어 하기: ${reloaded ? '확인' : '못 함'} · 설정: ${settingsSeen ? '확인' : '못 함'} · 격언 끌기: ${draggedMaxim ? '확인' : '못 함'}`);
console.log(`판 위 표시: 칸 · 화살표 ${marksSeen.board} · 왼쪽 누르기로 지움 ${marksSeen.clear ? '확인' : '못 함'} · 상점 오른쪽 누르기 ${marksSeen.shop}(아무 일 없음)`);
console.log(`사슬 중 목표를 넘긴 채 먹기: ${passSeen.n}번 · 입력이 막힘 ${passSeen.blocked}`);
console.log(`관 선택 → 상점 → 관 선택: ${shopBack.trips}번 · 바뀐 것 ${shopBack.changed} · 상점 없이 단추 ${shopBack.stray} · 판의 길과 겹침 ${shopBack.overlap}`);
console.log(`소리 마디 ${dom.audioCalls.nodes}`);
console.log(`예외 ${errors.length} · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
let fail = false;
console.log(`세력: 판 ${facSeen.runs}개 · 서로 다른 차례 ${facSeen.orders.size} · 대국에서 만난 세력 ${facSeen.met.size}(${[...facSeen.met].join(' ')}) · 관 선택 세력 띠 ${facSeen.band} · 다음 관 문장 ${facSeen.next} · 어긋남 ${facSeen.bad.length}${facSeen.bad.length ? ': ' + facSeen.bad.slice(0, 5).join(' | ') : ''}`);
if (facSeen.met.size < 5 || facSeen.orders.size < Math.min(2, facSeen.runs) || facSeen.bad.length) { console.log('세력이 다섯 넘게 나오지 않았거나, 판마다 차례가 같거나, 관 선택에 세력이 안 보였다'); fail = true; }
if (!pickSeen.swap || !pickSeen.off || pickSeen.swapBad || pickSeen.offBad) { console.log('손에서 기물이 하나만 들리지 않는다'); fail = true; }
if (!passSeen.n || passSeen.blocked) { console.log('사슬 중 목표를 넘긴 장면을 못 봤거나, 그때 입력이 막혔다'); fail = true; }
if (!shopBack.trips || shopBack.changed || shopBack.stray || shopBack.overlap) { console.log('관 선택에서 상점으로 오가지 못했거나, 오가며 상점이 바뀌었거나, 상점이 없는데 단추가 있거나, 단추가 판의 길과 겹친다'); fail = true; }
if (!n2.clockLost || !n2.clockShop || !n2.clockNext || n2.clockBad.length || (reboardOn() && !n2.reboard) || n2.reboardBad || (!reboardOn() && n2.reboard)) { console.log('시계를 잃고 상점을 거쳐 다음 대국으로 가지 못했거나, 다시 놓기가 어긋났다'); fail = true; }
if (marksSeen.board !== 3 || !marksSeen.clear || !marksSeen.shop) { console.log('판 위 표시(오른쪽 누르기)를 다 확인하지 못했다'); fail = true; }
if (LANG !== 'ko') {
  const { untranslated } = await import('../src/ui/lang.js');
  console.log(`옮기지 못한 글 ${untranslated.size}${untranslated.size ? ': ' + [...untranslated].slice(0, 40).join(' | ') : ''}`);
  if (untranslated.size) fail = true;
}
if (errors.length) fail = true;
if (missing.length) { console.log(`못 간 화면: ${missing.join(' ')}`); fail = true; }
if (!reloaded) fail = true;
if (lessonLog.length !== lessonMod.LESSONS.length) fail = true;
if (!skipOk) { console.log('수업 건너뛰기 · 처음 안내 끄기를 확인하지 못했다'); fail = true; }
if (hintFail.length) { console.log(`처음 안내가 뜨고 사라지지 않았다: ${hintFail.join(' ')}`); fail = true; }
console.log(`처음 안내: ${[...hintsShown].join(' ')}`);
console.log(`새기기 미리 보기: 두루마리 ${previewSeen.scroll} · 꾸러미 ${previewSeen.pack}`);
console.log(`각인 · 혼 바꾸기: 같은 것 흐림 ${swapSeen.same} · 상점 그만 ${swapSeen.shopBack} · 바꾸기 ${swapSeen.shopSwap} · 혼 ${swapSeen.soulSwap} · 꾸러미 그만 ${swapSeen.packBack} · 바꾸기 ${swapSeen.packSwap}${swapSeen.bad.length ? ` · 어긋남: ${swapSeen.bad.join(' | ')}` : ''}`);
if (swapSeen.bad.length || !swapSeen.same || !swapSeen.shopBack || !swapSeen.shopSwap || !swapSeen.soulSwap || !swapSeen.packBack || !swapSeen.packSwap) { console.log('각인 · 혼을 덮어쓰기 전에 확인하지 않았거나, 「그만」 · 「바꾸기」가 어긋났다'); fail = true; }
console.log(`기보 몫: 판을 도는 동안 ${chartSeen.run} · 세운 대국 ${chartSeen.scene} · 기보를 쓴 순간 크게 ${chartSeen.grow} · 수준만 ${chartSeen.tick}(어긋남 ${chartSeen.growBad})`);
if (!chartSeen.scene || !chartSeen.grow || !chartSeen.tick || chartSeen.growBad) { console.log('기보 몫 연출이 뜨지 않았거나 기보를 쓴 순간이 자라지 않았다'); fail = true; }
console.log(`낱말 상자: 진열 ${keySeen.shop} · 꾸러미 ${keySeen.pack} · 정석 ${keySeen.draft} · 카드와 겹침 ${keySeen.overlap} · 화면 밖 ${keySeen.off} · 손가락 두 번 ${keySeen.touch} · 상자 없음 ${keySeen.none || 0} · 자리가 없어 뺌 ${keySeen.dropped || 0} · 셋 넘음 ${keySeen.many} · 기본 낱말 ${keySeen.basic} · 카드 종류 ${keySeen.own} · 시너지 칩 ${keySeen.chip}(상자 ${keySeen.chipBox})`);
if (!keySeen.shop || !keySeen.pack || !keySeen.draft || keySeen.overlap || keySeen.off || !keySeen.touch || keySeen.none || keySeen.many || keySeen.basic || keySeen.own || !keySeen.chip || keySeen.chipBox) { console.log('낱말 상자를 보지 못했거나, 카드를 가리거나, 둘을 넘거나, 기본 낱말을 띄웠다'); fail = true; }
if (!pvSeen.capture || !pvSeen.drop || !pvSeen.kb || !pvSeen.touch) { console.log('미리 보기 경로를 다 지나지 못했다'); fail = true; }
if (!tipSeen.incoming || !tipSeen.forced || !tipSeen.path) { console.log('말풍선(증원 · 노림수 · 판의 길)을 보지 못했다'); fail = true; }
if (dom.audioCalls.nodes < 100) { console.log('소리가 거의 나지 않았다'); fail = true; }
if (mt.length && mt[mt.length - 1] > 4) { console.log('한 수 연출이 4초를 넘는다'); fail = true; }
if (pct(0.99) > 16) { console.log('프레임 p99가 16ms를 넘는다'); fail = true; }
if (ims.length && ims[Math.floor(ims.length * 0.99)] > 50) { console.log('누르기 처리 p99가 50ms를 넘는다'); fail = true; }
const kinds = [...place.kinds].map(([k, v]) => `${k}=${[...v].join('/')}`);
console.log(`자리 규칙: 가리킨 것 ${place.n}(판 틀 ${place.side} · 판 밖 ${place.below}, 화면 ${place.screens.size}) · 어김 ${place.rule} · 묶음 끊김 ${place.chain} · 화면 밖 ${place.off} · 가리킨 것 덮음 ${place.self} · 누를 것 덮음 ${place.cover} · 안 뜸 ${place.none} · 당겨 놓음 ${place.squeezed}${place.squeezedIds.length ? ` (${place.squeezedIds.join(', ')})` : ''} · 처음 안내 ${place.hint}(어김 ${place.hintBad})`);
if (VERBOSE) console.log('종류별 자리: ' + kinds.join(' · '));
if (place.bad.length) console.log('어긴 곳: ' + place.bad.join(' | '));
if (place.n < 100 || place.rule || place.chain || place.off || place.self || place.cover || place.none || place.hintBad) { console.log('설명이 규약의 자리에 뜨지 않았거나 누를 것 · 화면 밖을 덮었다'); fail = true; }
console.log(`시너지 +N 말풍선: ${moreSeen.n}번(${[...moreSeen.screens].join(' ')}) · 시너지 여섯 이상 대국 ${moreSeen.battle6} · 어긋남 ${moreSeen.bad.length}${moreSeen.bad.length ? `: ${moreSeen.bad.slice(0, 6).join(' | ')}` : ''}`);
if (!moreSeen.battle6 || moreSeen.bad.length) { console.log('시너지 여섯 이상 대국에서 「+N」을 가리켜 보지 못했거나, 가려진 시너지가 말풍선에 다 없다'); fail = true; }
const flowN = flow.text + flow.pad + flow.overlap + flow.screen;
console.log(`금빛 꾸러미 격언 칸: 바꾸기 ${goldSeen.swap} · 팔기 ${goldSeen.sell} · 어긋남 ${goldSeen.bad.length}${goldSeen.bad.length ? `: ${goldSeen.bad.join(' | ')}` : ''}`);
if (!goldSeen.swap || !goldSeen.sell || goldSeen.bad.length) { console.log('금빛 꾸러미의 격언 칸(펼치기 · 바꾸기 · 팔기)이 어긋났다'); fail = true; }
console.log(`큰 수 장면: 대국 ${bigSeen.battle} · 관 선택 ${bigSeen.select} · 결과 ${bigSeen.result} · 기록 ${bigSeen.records} · 보상 ${bigSeen.reward} · 글끼리 겹침 ${bigSeen.overlap.length}${bigSeen.overlap.length ? `: ${bigSeen.overlap.join(' | ')}` : ''}`);
if (!bigSeen.battle || !bigSeen.select || !bigSeen.result || !bigSeen.records || !bigSeen.reward || bigSeen.overlap.length) { console.log('큰 수 장면을 다 지나지 못했거나, 이름표와 수치가 겹쳤다'); fail = true; }
console.log(`글 넘침 ${flowN}(글이 상자 밖 ${flow.text} · 테에 붙음 ${flow.pad} · 상자 겹침 ${flow.overlap} · 화면 밖 ${flow.screen}) · 잰 프레임 ${flow.frames} · 보류 ${flow.held}(${Object.entries(flow.heldBy).map(([k, n]) => `${HELD[k]} ${n}`).join(' · ') || '없음'})`);
if (flow.held) fail = true;
if (flowN) { console.log('넘친 곳: ' + [...flow.seen].filter(([, w]) => w !== 'held').map(([k]) => k).slice(0, VERBOSE ? 5000 : 40).join('\n  ')); fail = true; }
if (VERBOSE && flow.held) console.log('보류 화면에서 넘친 곳: ' + [...flow.seen].filter(([, w]) => w === 'held').map(([k]) => k).slice(0, 60).join('\n  '));
console.log(fail ? 'SMOKE FAIL' : 'SMOKE OK');
process.exit(fail ? 1 : 0);
