// 화면 연기 시험: 가짜 캔버스 · 가짜 입력으로 실제 src/main.js를 부팅해, 봇 명령을 화면 누르기로 바꿔 판을 끝까지 돈다.
//   node tools/smoke.mjs [--seed 3] [--runs 2] [--verbose]
// 확인: 예외 0 · 모든 화면 방문 · 프레임당 그리기 시간 · 한 수 연출 시간(×1) · 저장 → 이어 하기.
import { makeFakeDom } from './fakedom.mjs';
import { decideBattle } from './bot.mjs';
import { lineCommands } from '../src/sim/solver.js';
import { canBuy } from '../src/sim/run.js';
import { evolveTo } from '../src/data/tactics.js';
import { isHidden } from '../src/sim/battle.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEED = Number(opt('--seed', 3));
const LANG = opt('--lang', 'ko');
const RUNS = Number(opt('--runs', 2));
const VERBOSE = args.includes('--verbose');
const log = (...a) => { if (VERBOSE) console.log(...a); };

globalThis.__CHAINMATE_NO_BOOT__ = true;
const dom = makeFakeDom({ width: 1366, height: 700, dpr: 1.25 });
globalThis.document = dom.document;
globalThis.window = dom.window;
const { boot } = await import('../src/main.js');
const lessonMod = await import('../src/ui/lessons.js');
const { termsIn, TERM_BY_ID, KEY_MAX } = await import('../src/ui/glossary.js');

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
function pump(n = 1, dt = 1000 / 60) { for (let i = 0; i < n; i++) { t += dt; dom.frame(t); if (app && app.hintShown) hintsShown.add(app.hintShown.id); } }
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
function hover(id) {
  const r = region(id);
  if (!r) return false;
  dom.mouse('mousemove', r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  pump(1);
  return true;
}
const pvSeen = { capture: 0, drop: 0, cut: 0, kb: 0, touch: 0 };
// 칸 말풍선: 증원 그림자 · 노림수
const tipSeen = { incoming: 0, forced: 0, path: 0 };
const newsSeen = { battles: 0, icons: 0 };
const objTips = { step: 0, gate: 0, highway: 0, wall: 0, gem: 0 };
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
  const expect = termsIn([...(h && h.keys ? h.keys() : []), tip ? tip.lines.filter((l) => !(l && l.chips)).map((l) => (Array.isArray(l) ? l[0] : l)).join(' ') : null]).length;
  if (boxes.length) keySeen[kind]++; else if (expect) { keySeen.none = (keySeen.none || 0) + 1; if (VERBOSE) console.log('상자 없음', id); }
  if (boxes.length > KEY_MAX) keySeen.many++;
  const own = ownKind(id);
  if (own && boxes.some((b) => b.id === own)) { keySeen.own++; if (VERBOSE) console.log('카드 종류 상자', id, own); }
  for (const b of boxes) {
    if (TERM_BY_ID[b.id].basic) { keySeen.basic++; if (VERBOSE) console.log('기본 낱말 상자', id, b.id); }
    if (cross(b, r)) keySeen.overlap++;
    if (b.x < 0 || b.y < 0 || b.x + b.w > 480 || b.y + b.h > 270) keySeen.off++;
  }
}
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
  if (b.status === 'chain') {
    // 사슬 한가운데서 이어 하기(드묾): 먹을 칸 하나
    const t = s.clickable();
    click(`sq:${t.list[0]}`);
    idle();
    return;
  }
  const d = decideBattle(b);
  if (!d) throw new Error('no decision');
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
  const objSq = { step: (b.rules.steps || [])[0], gate: (b.rules.gates || [])[0], highway: (b.rules.highways || []).length ? b.rules.highways[0] + 8 * 3 : undefined, wall: b.board.findIndex((c) => c && c.t === 'X'), gem: b.board.findIndex((c) => c && c.t === 'J') };
  for (const [k, sq] of Object.entries(objSq)) if (sq != null && sq >= 0 && objTips[k] < 5 && !isHidden(b, sq)) { hover(`sq:${sq}`); if (hoverTip()) objTips[k]++; }
  const ghost = (b.incoming || []).find((r) => !b.board[r.sq]);
  if (ghost && tipSeen.incoming < 20) { hover(`sq:${ghost.sq}`); if (hoverTip()) tipSeen.incoming++; }
  click(`hand:${d.play.handIndex}`);
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
        const piece = c.kind === 'evolve' ? run.deck.find((x) => evolveTo(run.seed, x)) : run.deck[0];
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
  keyBoxesAt(`pack:pick:${i}`, 'pack');
  click(`pack:pick:${i}`);
  if (pack.options[i].kind === 'engraving' && app.screen.name === 'pack') {
    click(`deck:${app.run.deck[0].id}`);
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
  let steps = 0;
  while (steps++ < 4000) {
    const name = screen();
    if (name === 'result') break;
    if (name === 'draft') { pump(40); for (let k = 0; k < app.run.draft.options.length; k++) keyBoxesAt(`draft:${k}`, 'draft'); click(`draft:${Math.floor(rnd() * app.run.draft.options.length)}`); pump(60); continue; }
    if (name === 'select' && !tipSeen.path) { hover('select:path'); if (hoverTip()) tipSeen.path++; }
    if (name === 'select') { if (app.run.blind < 2 && rnd() < 0.15) click('select:skip'); else click('select:play'); pump(2); continue; }
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
for (const t of ['masters', 'legends', 'openings', 'editions', 'maxims']) click(`codex:tab:${t}`);
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
console.log(`프레임 ${ms.length} · 그리기 평균 ${avg.toFixed(2)}ms · p99 ${pct(0.99).toFixed(2)}ms · 최대 ${ms[ms.length - 1].toFixed(2)}ms · 그리기 호출 ${dom.counter.calls}`);
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
console.log(`판 위 사물 말풍선: 발판 ${objTips.step} · 문 ${objTips.gate} · 고속도로 ${objTips.highway} · 벽 ${objTips.wall} · 보석 ${objTips.gem}`);
console.log(`이어 하기: ${reloaded ? '확인' : '못 함'} · 설정: ${settingsSeen ? '확인' : '못 함'} · 격언 끌기: ${draggedMaxim ? '확인' : '못 함'}`);
console.log(`소리 마디 ${dom.audioCalls.nodes}`);
console.log(`예외 ${errors.length} · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
let fail = false;
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
console.log(`낱말 상자: 진열 ${keySeen.shop} · 꾸러미 ${keySeen.pack} · 정석 ${keySeen.draft} · 카드와 겹침 ${keySeen.overlap} · 화면 밖 ${keySeen.off} · 손가락 두 번 ${keySeen.touch} · 상자 없음 ${keySeen.none || 0} · 셋 넘음 ${keySeen.many} · 기본 낱말 ${keySeen.basic} · 카드 종류 ${keySeen.own} · 시너지 칩 ${keySeen.chip}(상자 ${keySeen.chipBox})`);
if (!keySeen.shop || !keySeen.pack || !keySeen.draft || keySeen.overlap || keySeen.off || !keySeen.touch || keySeen.none || keySeen.many || keySeen.basic || keySeen.own || !keySeen.chip || keySeen.chipBox) { console.log('낱말 상자를 보지 못했거나, 카드를 가리거나, 둘을 넘거나, 기본 낱말을 띄웠다'); fail = true; }
if (!pvSeen.capture || !pvSeen.drop || !pvSeen.kb || !pvSeen.touch) { console.log('미리 보기 경로를 다 지나지 못했다'); fail = true; }
if (!tipSeen.incoming || !tipSeen.forced || !tipSeen.path) { console.log('말풍선(증원 · 노림수 · 판의 길)을 보지 못했다'); fail = true; }
if (dom.audioCalls.nodes < 100) { console.log('소리가 거의 나지 않았다'); fail = true; }
if (mt.length && mt[mt.length - 1] > 4) { console.log('한 수 연출이 4초를 넘는다'); fail = true; }
if (pct(0.99) > 16) { console.log('프레임 p99가 16ms를 넘는다'); fail = true; }
if (ims.length && ims[Math.floor(ims.length * 0.99)] > 50) { console.log('누르기 처리 p99가 50ms를 넘는다'); fail = true; }
console.log(fail ? 'SMOKE FAIL' : 'SMOKE OK');
process.exit(fail ? 1 : 0);
