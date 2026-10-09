// 화면 연기 시험: 가짜 캔버스 · 가짜 입력으로 실제 src/main.js를 부팅해, 봇 명령을 화면 누르기로 바꿔 판을 끝까지 돈다.
//   node tools/smoke.mjs [--seed 3] [--runs 2] [--verbose] [--lang en] [--spacing pad8,line14,…]
// 확인: 예외 0 · 모든 화면 방문 · 프레임당 그리기 시간 · 한 수 연출 시간(×1) · 저장 → 이어 하기.
import { makeFakeDom } from './fakedom.mjs';
import { decideBattle, stepBattle } from './bot.mjs';
import { lineCommands, previewDrop, bestMove } from '../src/sim/solver.js';
import { canBuy, canSell, factionFor, targetFor } from '../src/sim/run.js';
import { PIECES } from '../src/data/pieces.js';
import { evolveTo } from '../src/data/tactics.js';
import { isHidden, canReboard, dropSquaresFor, nextDraws, visibleIncoming } from '../src/sim/battle.js';
import { boardFrom } from '../src/sim/board.js';
import { chainCaptures } from '../src/sim/chain.js';
import { reboardOn } from '../src/sim/tuning.js';
import { CRACK, isCracked } from '../src/data/souls.js';
import { verifyDaily, summarize } from '../api/_lib/verify.js';
const { targetOk } = await import('../src/ui/parts.js');
const { FAMILIES, familyCounts } = await import('../src/data/families.js');
const { L } = await import('../src/ui/lang.js');
const { LEGENDS } = await import('../src/data/legends.js');
const codexDone = { cells: 0, cover: 0 };
const codexAll = { pages: 0 };
// 진열 카드 종류 장면(CHM-42): 장면마다 잰 카드 상자 · 글 · 넘침
const shopCards = { scenes: [], boxes: 0, lines: 0, bad: 0 };

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEED = Number(opt('--seed', 3));
const LANG = opt('--lang', 'ko');
const RUNS = Number(opt('--runs', 2));
// 오늘의 대국 판의 날짜(그 판의 시드가 여기서 나온다). 달력을 읽으면 날마다 다른 판을 돌아 결과가 날짜에 달린다(CHM-63) — 고정해 넣는다.
// 다른 날짜의 판을 보려면 --date YYYY-MM-DD
const DATE = opt('--date', '2026-10-07');
const VERBOSE = args.includes('--verbose');
// --spacing pad8,card7,line14,title18,in3,group8: 글 간격 시안으로 자리 규칙을 잰다(src/ui/frame.js applySpacing)
if (opt('--spacing', null)) globalThis.__SPACING = opt('--spacing', null);
const log = (...a) => { if (VERBOSE) console.log(...a); };

globalThis.__CHAINMATE_NO_BOOT__ = true;
const dom = makeFakeDom({ width: 1366, height: 700, dpr: 1.25 });
globalThis.document = dom.document;
globalThis.window = dom.window;
// 기록 보내기(CHM-63): 가짜 fetch · sendBeacon으로 나간 요청을 센다 — 연기 시험에서는 한 건도 나가면 안 된다(보내는 호스트가 아니다)
const telSent = { n: 0 };
// 순위(CHM-70): /api로 가는 요청은 가짜 서버(진짜 요청 → 응답 로직 api/_lib/service.js + 기억 저장소 — test/helpers/fakeapi.js)가 받는다.
// 서버의 「오늘」은 연기 시험의 고정 날짜. 다른 사람들의 성적을 오늘 · 어제에 미리 넣어 둔다(쪽 넘김 · 긴 이름 · 큰 점수)
const { fakeApi, seedBoard, demoRows } = await import('../test/helpers/fakeapi.js');
const { shiftDate, PLAYER_KEY } = await import('../src/ui/rank.js');
let rankRng = 20261007;
const rankApi = fakeApi({ build: 'smoke', now: () => Date.parse(`${DATE}T12:00:00Z`), rand: () => { rankRng = (rankRng * 1103515245 + 12345) & 0x7fffffff; return rankRng / 0x80000000; } });
await seedBoard(rankApi, DATE, demoRows(24));
await seedBoard(rankApi, shiftDate(DATE, -1), demoRows(13));
const netSettle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
dom.window.fetch = async (url, init) => { if (String(url).startsWith('/api/')) return rankApi.fetch(url, init); telSent.n++; return { ok: true }; };
dom.window.navigator = { sendBeacon: () => { telSent.n++; return true; } };
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
// 잘린 글(docs/design-notes/layout.md 「잘린 글 검사」): fitText · 시너지 줄 · 말풍선 · 낱말 상자 · wrap이 줄이거나 자른 글(layoutlog.js logClip).
// 'thin' 보통 굵기로 줄임(설계상 허용 — 세기만), 'cut' 「…」, 'char' 낱말을 글자 단위로 끊음. 「…」 · 글자 끊김은 아래 둘 밖이면 실패.
// CLIP_OK: 의도한 잘림(이유와 함께). 고르는 조건은 좁게 — 같은 칸의 다른 이름이 잘리면 실패해야 한다.
const CLIP_OK = [
  { why: '영어 명경기 이름 넷 — 1열 격언 칸에서 실제 이름을 지키고 「…」(CHM-40, english-review.md)', ok: (c) => LANG === 'en' && c.kind === 'cut' && /^격언 (immortal|opera|century|evergreen)$/.test(c.box) },
  { why: '옛 저장 기보 두루마리 — 기보는 얻는 순간 쓰여 두루마리 칸에 들지 않는다(CHM-33), 옛 저장에만 남아 이름을 재지 않는다', ok: (c) => c.kind === 'cut' && c.box === '두루마리 chart' },
  { why: '설명 높이 자르기 — 자리 규칙이 준 높이에 안 들어가면 뒤 줄을 빼고 「…」(CHM-34, 설계)', ok: (c) => c.kind === 'cut' && (c.box === '말풍선' || c.box.startsWith('낱말 ')) },
];
// CLIP_HELD: smoke가 찾았으나 고칠지 설계 담당이 정할 잘림(보류). 세어 보류 줄에 찍고 실패시키지 않는다 — 고치면 여기서 뺀다.
// 언어 · 종류 · 상자 이름 · 원문이 모두 맞을 때만
// 2026-10-02 처음 켰을 때 찾은 것(CHM-45)은 CHM-46이 모두 고쳐 비었다. 줄마다 [언어, 종류, 상자 이름(없으면 ''), 원문 …]
const CLIP_HELD = [];
// 상자 이름은 앞머리로 맞춘다(「도감 opera」 ← 「도감」, 「수업 묶음 basic」 ← 「수업 묶음 」). 상자 없이 잰 글자 끊김은 ''만
const clipHeld = (c) => CLIP_HELD.find(([lang, kind, box, srcs]) => lang === LANG && kind === c.kind && (box ? c.box === box || c.box.startsWith(`${box} `) || (box.endsWith(' ') && c.box.startsWith(box)) : !c.box) && (srcs === '*' || srcs.includes(c.src))) || null;
const clips = { seen: new Map(), by: new Map(), frames: new Map(), maximW: new Set(), measured: new Set() };
function clipCheck() {
  const sc = screen();
  clips.frames.set(sc, (clips.frames.get(sc) || 0) + 1);
  for (const b of LL.LOG.boxes) if (/^격언 /.test(b.name || '') && !b.overlay && !b.loose && (sc === 'battle' || sc === 'shop')) clips.maximW.add(`${sc} ${b.w}`);
  for (const c of LL.LOG.clips) {
    if (c.loose) continue;
    const key = `${sc}|${c.kind}|${c.box}|${c.src}`;
    if (clips.seen.has(key)) continue;
    // 글자 끊김은 wrap()이 재기만 하고 버린 줄(「Grandmaster」를 초상 옆 폭으로 재 보고 온 폭으로 쓰는 것처럼)일 수 있다 — 끊긴 첫 조각이 이번 프레임에 그려졌을 때만 센다
    if (c.kind === 'char') {
      const first = c.shown.split(' / ')[0];
      // 낱말 풀이 글(richText)은 한 줄을 조각으로 그린다 — 같은 줄(y)의 조각을 x 차례로 이어 맞춘다
      const rows = new Map();
      for (const q of LL.LOG.texts) { if (!rows.has(q.y)) rows.set(q.y, []); rows.get(q.y).push(q); }
      const drawn = [...rows.values()].some((r) => r.some((q) => q.s === first) || r.sort((a, b) => a.x - b.x).map((q) => q.s).join('') === first);
      if (!drawn) { clips.measured.add(`${sc} 「${c.src}」 폭 ${c.w}`); continue; }
    }
    const ok = c.kind === 'thin' ? null : CLIP_OK.find((q) => q.ok(c));
    const held = c.kind === 'thin' || ok ? null : clipHeld(c);
    clips.seen.set(key, { ...c, screen: sc, ok: ok ? ok.why : null, held: !!held, bad: c.kind !== 'thin' && !ok && !held });
    if (!clips.by.has(sc)) clips.by.set(sc, { thin: 0, cut: 0, char: 0 });
    clips.by.get(sc)[c.kind]++;
  }
}
function flowCheck() {
  if (!app) return;
  clipCheck();
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
  app = await boot({ window: dom.window, document: dom.document, today: () => DATE, rankBase: '' });
  apps.push(app);
  app.onError = (e) => { errors.push(e); console.error(e); };
  pump(2);
}
const seen = () => { for (const v of app.visited) visited.add(v); };
// 처음 안내: 떠 본 안내 id
const hintsShown = new Set();
const previewSeen = { scroll: 0, pack: 0 };
const goldSeen = { swap: 0, sell: 0, bad: [] };
function pump(n = 1, dt = 1000 / 60) { for (let i = 0; i < n; i++) { t += dt; dom.frame(t); flowCheck(); if (app && app.hintShown) { hintsShown.add(app.hintShown.id); hintCheck(); hintSubject(); } if (app) { hintCover(); igniteWatch(); } } }

// ── 점화 막간(CHM-67): 판에서 처음 사슬 8 · 넘침 ×10 뒤에 열리고(판 · 대국 화면만, 대본 · scratch 판은 없음) 닫히는가, 판당 한 번인가,
// 떠 있는 동안 화면의 다른 구역이 눌리지 않는가. 첫 막간은 손 카드(없으면 판 칸)를 실제로 눌러 닫고(눌러도 고르기 · 규칙이 그대로),
// 둘째는 Enter로, 나머지는 저절로(앉은 뒤 2초) 닫힌다. 다른 구역의 가운데를 누르면 모두 막간 구역이 받아야 한다
const igSeen = { opened: 0, closed: 0, tap: 0, key: 0, auto: 0, regions: 0, leak: [], twice: 0, data: 0, maxT: 0, bad: [], perRun: new WeakMap(), busy: false };
function igniteWatch() {
  const s = app.screen;
  if (igSeen.busy || !s) return;
  const open = !!s.combo;
  if (open && igSeen.cur !== s.combo) {
    igSeen.busy = true;
    try {
      igSeen.cur = s.combo; igSeen.opened++;
      const run = app.run, n = (igSeen.perRun.get(run) || 0) + 1;
      igSeen.perRun.set(run, n);
      if (n > 1) igSeen.twice++;
      if (s.name !== 'battle' || !run || run.scratch || (run.battle && run.battle.script)) igSeen.bad.push(`막간이 열리면 안 되는 곳(${s.name}${run && run.scratch ? ' scratch' : ''})`);
      if (run && run.ignite && JSON.stringify(s.combo.data) === JSON.stringify({ type: 'ignite', ...run.ignite })) igSeen.data++;
      else igSeen.bad.push('막간의 사슬이 판의 점화 기록과 다르다');
      // 막간 구역이 맨 위에서 화면을 덮는가: 다른 구역 가운데를 누르면 막간 구역이 받는다
      const rs = app.ui.regions, top = rs[rs.length - 1];
      if (!top || top.id !== 'ignite') igSeen.bad.push(`막간 구역이 맨 위가 아니다(${top ? top.id : '없음'})`);
      for (const r of rs) {
        if (r.id === 'ignite' || r.passive) continue;
        igSeen.regions++;
        const h = app.ui.hitIn(rs, r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
        if (!h || h.id !== 'ignite') igSeen.leak.push(r.id);
      }
      const k = igSeen.opened;
      if (k === 1) {
        // 실제로 눌러 본다: 손 카드(없으면 판 칸) — 막간만 닫히고 고른 손 · 규칙 상태는 그대로
        const b = run.battle, target = rs.find((r) => r.id.startsWith('hand:')) || rs.find((r) => r.id.startsWith('sq:'));
        const before = b ? JSON.stringify({ h: b.history.length, s: b.status, hand: b.hand.map((p) => p.id) }) : '';
        const gx = target.x + Math.floor(target.w / 2), gy = target.y + Math.floor(target.h / 2);
        dom.mouse('mousemove', gx, gy); dom.mouse('mousedown', gx, gy); dom.mouse('mouseup', gx, gy);
        t += 1000 / 60; dom.frame(t);
        const after = b ? JSON.stringify({ h: b.history.length, s: b.status, hand: b.hand.map((p) => p.id) }) : '';
        if (s.combo) igSeen.bad.push('눌러도 막간이 닫히지 않았다');
        else if (before !== after || (s.sel && s.sel.length)) igSeen.bad.push(`막간을 누른 것이 ${target.id}로 샜다`);
        else igSeen.tap++;
      } else if (k === 2) {
        dom.key('Enter'); t += 1000 / 60; dom.frame(t);
        if (s.combo) igSeen.bad.push('Enter로 막간이 닫히지 않았다'); else igSeen.key++;
      }
    } finally { igSeen.busy = false; }
  }
  if (s.combo) igSeen.maxT = Math.max(igSeen.maxT, s.combo.t);
  if (!s.combo && igSeen.cur) { igSeen.closed++; if (igSeen.opened > 2 && igSeen.cur.t >= 2.9) igSeen.auto++; igSeen.cur = null; }
}
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
const n2 = { forced: false, clockBefore: null, clockLost: 0, clockShop: 0, clockNext: 0, clockBad: [], reboard: 0, reboardBot: 0, reboardBad: 0, tried: false, waitNext: false, worse: null };
// 복기(CHM-59): 진 대국마다 갈림길 카드(복기 중 → 카드 · 길 없음 · 찾지 못함), 「다시 두기」 화면(▶ 끝까지 → 이김, ◀ 한 번, 키 좌우), 「넘어가기」
const rvSeen = { unk: [], lost: 0, cards: 0, kinds: { path: 0, none: 0, unknown: 0 }, replays: 0, won: 0, back: 0, keys: 0, moveon: 0, frames: [], bad: [] };
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
const place = { n: 0, side: 0, below: 0, rule: 0, chain: 0, off: 0, self: 0, cover: 0, none: 0, cut: 0, lean: 0, cutIds: new Map(), hint: 0, hintBad: 0, screens: new Set(), kinds: new Map(), bad: [] };
const CAP_KIND = { sq: 14, deck: 6, codex: 8, hand: 4 };
const kindOf = (id) => id.replace(/:[^:]*$/, '');
function placeBad(what, id, detail = '') { place[what]++; if (place.bad.length < 12) place.bad.push(`${screen()} ${id} ${what} ${detail}`); }
// 설명이 덮은 글(CHM-34): 묶음 · 처음 안내가 그 아래 화면의 글(다른 판넬 · 카드 · 칩 · 가리킨 것)을 덮은 수. 화면마다
const cov = { n: 0, hit: 0, texts: 0, self: 0, folded: 0, hint: 0, hintHit: 0, by: new Map(), ex: [], hintSeen: new Set(), hintPrev: null };
function covTally(kind, id, rects, anchor) {
  const got = LL.coveredTexts(rects, anchor);
  const k = screen();
  if (!cov.by.has(k)) cov.by.set(k, { n: 0, hit: 0, texts: 0, self: 0, folded: 0 });
  const b = cov.by.get(k);
  b.n++; if (kind === 'note') cov.n++; else cov.hint++;
  // 접은 글(fold.js): 묶음이 걸친 왼쪽 칸 판넬에서 비운 글 — 덮은 것으로 세지 않고 따로
  const folded = LL.LOG.folded.filter((q) => q.s.trim()).length;
  b.folded += folded; cov.folded += folded;
  if (!got.length) return;
  const self = got.filter((q) => q.self).length;
  b.hit++; b.texts += got.length; b.self += self;
  if (kind === 'note') { cov.hit++; cov.texts += got.length; cov.self += self; } else cov.hintHit++;
  if (cov.ex.length < 400) cov.ex.push(`${k} ${kind === 'hint' ? '안내 ' : ''}${id}: ${got.map((q) => `${q.self ? '*' : ''}「${q.s}」`).join(' ')}`);
}
function hintCover() {
  const h = app.hintShown, r = app.hintRect;
  const key = h && r ? `${h.id}@${h.regionId}@${screen()}` : null;
  // 안내 자리는 그 전 프레임의 것으로 접는다 — 같은 안내가 두 프레임 이어 뜬 때 잰다
  if (key && key === cov.hintPrev && !cov.hintSeen.has(key)) { cov.hintSeen.add(key); covTally('hint', h.id, [r], region(h.regionId)); }
  cov.hintPrev = key;
}
function checkStack(id) {
  const st = app.noteStack;
  if (st && st.rects.length) covTally('note', id, st.rects, st.anchor);
  // 말풍선이 있는 구역인데 아무것도 안 떴다(자리가 없어 버린 것)
  const h = app.ui.hover, tip = h && h.tip ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null;
  if (tip && (!st || !st.rects.length)) { placeBad('none', id); return false; }
  if (!st || !st.rects.length) return false;
  // 말풍선 하나도 그 자리에 다 안 들어가 자른 것(「…」로 마침 — placement.js clip): 자리 규칙은 그대로 재고 따로 센다
  if (st.lean) place.lean++;
  if (st.cut) { place.cut++; const k = `${screen()} ${kindOf(id)}`; place.cutIds.set(k, (place.cutIds.get(k) || 0) + 1); if (VERBOSE) console.log(`잘림 ${screen()} ${id} ${st.full} → ${st.clip} (가리킨 것 y ${st.anchor.y})`); }
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
  if (top < 0 || bot > 270 || rs[0].x < 0 || rs[0].x + rs[0].w > 480) placeBad('off', id, `hs ${rs.map((r) => r.h).join('+')} top ${top} bot ${bot} anchor ${a.x},${a.y},${a.w},${a.h}`);
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
// 처음 안내가 말하는 것이 그 순간 화면에 있나(CHM-36). coach.js와 따로, 판 상태로 잰다:
// 가리키는 구역이 이 프레임 화면 안에 그려졌고, 그 구역이 안내가 말하는 바로 그것이다(격언 안내 → 진열의 안 산 격언 카드 …).
// 본 것으로 적힌 안내가 또 뜨면(같은 안내 두 번) 그것도 어긋남.
const subj = { n: 0, bad: [], ids: new Set() };
const num = (id, pre) => (id.startsWith(pre) && /^\d+$/.test(id.slice(pre.length)) ? Number(id.slice(pre.length)) : -1);
const scrName = () => (app.overlay ? app.overlay.name : app.screen.name);
function cellAt(sq) { const v = app.screen.view; return sq >= 0 && v && v.board ? v.board[sq] : null; }
const enemyAt = (sq, f) => { const c = cellAt(sq), b = app.run && app.run.battle; return !!(c && !c.mine && b && !isHidden(b, sq) && f(c)); };
const HINT_SUBJECT = {
  shop: (id, run) => scrName() === 'shop' && run.shop.display[num(id, 'shop:buy:')]?.kind === 'maxim' && !run.shop.display[num(id, 'shop:buy:')].sold,
  pack: (id, run) => scrName() === 'pack' && !!run.pack && !!run.pack.options[num(id, 'pack:pick:')] && run.pack.options.filter((o) => !(run.pack.kind === 'golden' && o.kind === 'fragment')).length === 3,
  scroll: (id, run) => ['engraving', 'soul', 'evolve', 'awaken'].includes(run.consumables[num(id, 'cons:')]?.kind),
  draft: (id, run) => scrName() === 'draft' && !!run.draft && !!run.draft.options[num(id, 'draft:')],
  family: (id) => id.startsWith('fam:'),
  master: (id, run) => scrName() === 'select' && id === 'select:play' && run.blind === 2,
  golden: (id) => enemyAt(num(id, 'sq:'), (c) => c.gold),
  trait: (id) => enemyAt(num(id, 'sq:'), (c) => c.trait),
  things: (id) => enemyAt(num(id, 'sq:'), (c) => PIECES[c.t] && PIECES[c.t].thing),
  incoming: (id, run) => { const sq = num(id, 'sq:'); return !!(run.battle && (run.battle.incoming || []).some((r) => r.sq === sq) && !cellAt(sq)); },
  fairy: (id) => { const p = app.screen.view && app.screen.view.hand && app.screen.view.hand[num(id, 'hand:')]; return !!(p && PIECES[p.t] && PIECES[p.t].fairy); },
  maximSell: (id, run) => canSell(run.maxims[num(id, 'maxim:')]),
  // 찜(CHM-58 F): 상점 진열의 안 산 카드의 책갈피
  hold: (id, run) => scrName() === 'shop' && !!run.shop.display[num(id, 'shop:hold:')] && !run.shop.display[num(id, 'shop:hold:')].sold,
  joseki: (id, run) => id.startsWith('joseki:') && run.josekis.length > 0,
  tactic: (id, run) => id.startsWith('tactic:') && run.consumables.some((c) => c.kind === 'tactic'),
  bigText: (id) => scrName() === 'title' && id === 'title:settings',
  clock: (id, run) => id === 'clock' && run.log.some((x) => x.clockLost),
  crack: (id, run) => { const p = run.deck.find((x) => `deck:${x.id}` === id); return !!(p && isCracked(p)); },
  // 탁월수(CHM-43): 가리킨 손 카드가 희생으로 새로 뽑은 기물(「!?」 딱지)
  // 복기(CHM-59): 길 있음 갈림길 카드의 「다시 두기」
  replay: (id) => id === 'btn:replay' && scrName() === 'battle' && !!app.screen.rv && app.screen.rv.phase === 'card' && app.screen.rv.res.kind === 'path',
  // 다음 수(CHM-60): 손 오른쪽 끝 칸, 주머니 맨 앞이 하나라도 있을 때
  next: (id, run) => id === 'next' && scrName() === 'battle' && !!run.battle && nextDraws(run.battle).length > 0,
  // 판 보기(CHM-61): 지금 대국 카드(작은 판이 있는 카드)
  preview: (id, run) => scrName() === 'select' && id === `select:board:${run.blind}`,
  // 순위(CHM-70): 순위에 이름이 생긴 뒤의 첫 화면 설정 칸(이름은 설정에서 다시 짓는다)
  rankName: (id) => scrName() === 'title' && id === 'title:settings:tip' && !!app.rank.player(),
  brilliant: (id, run) => { const p = app.screen.view && app.screen.view.hand && app.screen.view.hand[num(id, 'hand:')], off = run.battle && run.battle.offering; return !!(p && off && (off.drawn || []).includes(p.id)); },
};
function hintSubject() {
  const h = app.hintShown;
  if (!h) return;
  const key = `${h.id}@${h.regionId}@${scrName()}`;
  const r = region(h.regionId), run = app.run;
  let ok = !!r && r.x >= 0 && r.y >= 0 && r.x + r.w <= 480 && r.y + r.h <= 270;
  if (ok && h.id.startsWith('faction_')) ok = scrName() === 'select' && h.regionId === 'faction' && !!run && factionFor(run, run.ante) === h.id.slice(8);
  else if (ok) ok = !!HINT_SUBJECT[h.id] && (h.id === 'bigText' || h.id === 'rankName' || !!run) && HINT_SUBJECT[h.id](h.regionId, run);
  if (!subj.ids.has(key)) { subj.ids.add(key); subj.n++; }
  if (!ok && subj.bad.length < 20 && !subj.bad.includes(key)) subj.bad.push(key);
  // 같은 안내 두 번: 본 것으로 적힌 뒤 또 떴다
  const twice = `두 번 ${h.id}`;
  if (app.records.coachSeen && app.records.coachSeen[h.id] && !subj.bad.includes(twice)) subj.bad.push(twice);
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

// ── 다음 수(CHM-60): 결정마다 「보이던 둘」(화면 view.next = 규칙 nextDraws)이 실제로 그 차례로 손에 들어왔나.
// 손을 새로 쥔 결정은 주머니를 다시 섞으니 들어온 것 대신 새 차례가 화면에 곧바로 보이는지만 잰다.
const nextSeen = { moves: 0, drawn: 0, regrip: 0, view: 0, bad: [] };
// ── 판 보기(CHM-61): 관 선택마다 지금 대국 카드에 그려진 작은 판(화면 peekOf)과, 두기를 눌러 열린 대국의 시작 판이 같은가.
// 남은 대국 카드의 판도 적어 두었다가 그 대국 차례의 관 선택(건너뛴 뒤 · 상점 뒤)에서 같은 판인지 잰다(판 짓기 규칙이 바뀐 것 ·
// 금빛의 부름으로 금빛 적 확률이 올라 금빛만 더해진 것은 따로 센다 — 둘 다 보이는 판이 바뀌고 그 판으로 둔다).
// 그 사이 「그림자 읽기」 같은 것을 얻어 증원 예고가 더 멀리 보이게 된 것(판 · 안개는 같고 앞서 보인 예고가 지금 예고의 앞부분)도 따로 센다.
const peekSeen = { selects: 0, played: 0, same: 0, ahead: 0, aheadSame: 0, regen: 0, gold: 0, sight: 0, bad: [], shown: new Map() };
const peekLook = (b) => JSON.stringify({ board: b.board, incoming: visibleIncoming(b), hidden: b.board.map((_, sq) => isHidden(b, sq)) });
// 금빛 적만 더해졌나(나머지는 같고, 앞의 금빛은 그대로)
const noGold = (x) => JSON.stringify({ ...x, board: x.board.map((c) => c && { ...c, gold: undefined }) });
const goldOnly = (a, b) => noGold(a) === noGold(b) && a.board.every((c, q) => !(c && c.gold) || (b.board[q] && b.board[q].gold));
// 보이는 예고 수만 달라졌나(판 · 안개 같음, 짧은 쪽 예고가 긴 쪽의 앞부분)
const sightOnly = (a, b) => {
  if (JSON.stringify(a.board) !== JSON.stringify(b.board) || JSON.stringify(a.hidden) !== JSON.stringify(b.hidden)) return false;
  const [s, l] = a.incoming.length <= b.incoming.length ? [a.incoming, b.incoming] : [b.incoming, a.incoming];
  return s.length < l.length && JSON.stringify(s) === JSON.stringify(l.slice(0, s.length));
};
function peekSelect() {
  const run = app.run, scr = app.screen;
  if (!scr.peekOf) return null;
  peekSeen.selects++;
  for (let i = run.blind; i < 3; i++) {
    if (!region(`select:board:${i}`)) { peekSeen.bad.push(`${run.ante}:${i} 작은 판이 없다`); continue; }
    const look = peekLook(scr.peekOf(run, i)), key = `${run.seed}:${run.ante}:${i}:${run.retry || 0}`, gen = run.boards[i] && run.boards[i].gen;
    const was = peekSeen.shown.get(key);
    if (was && i === run.blind) {
      peekSeen.ahead++;
      if (was.look === look) peekSeen.aheadSame++;
      else if (was.gen !== gen) peekSeen.regen++;
      else if (goldOnly(JSON.parse(was.look), JSON.parse(look))) peekSeen.gold++;
      else if (sightOnly(JSON.parse(was.look), JSON.parse(look))) peekSeen.sight++;
      else peekSeen.bad.push(`${key} 앞서 보인 판과 다르다`);
    }
    if (!was) peekSeen.shown.set(key, { look, gen });
  }
  return peekLook(scr.peekOf(run, run.blind));
}
function peekPlayed(shown) {
  if (shown == null || !app.run.battle) return;
  peekSeen.played++;
  if (peekLook(app.run.battle) === shown) peekSeen.same++;
  else peekSeen.bad.push(`${app.run.ante}:${app.run.blind} 보인 판과 시작 판이 다르다`);
}
const nextIds = (xs) => (xs || []).map((p) => p.id).join(',');
function nextBad(msg) { if (nextSeen.bad.length < 8) nextSeen.bad.push(msg); }
function nextView(b) {
  const v = app.screen.view;
  nextSeen.view++;
  if (nextIds(v.next) !== nextIds(nextDraws(b))) nextBad(`화면 ${nextIds(v.next)} · 규칙 ${nextIds(nextDraws(b))}`);
  if (!region('next')) nextBad('다음 수 칸이 없다');
}
function nextBefore(b) {
  if (app.screen.name !== 'battle' || b.status !== 'play' || app.screen.busy) return null;
  nextView(b);
  return { b, shown: nextDraws(b).map((p) => p.id), hand: b.hand.map((p) => p.id), regrip: !!b.regrip };
}
function nextAfter(pre) {
  if (!pre) return;
  const b = pre.b;
  if (app.run.battle !== b || b.status !== 'play' || app.screen.name !== 'battle') return;
  nextSeen.moves++;
  if (!!b.regrip !== pre.regrip) { nextSeen.regrip++; nextView(b); return; }
  const got = b.hand.filter((p) => !pre.hand.includes(p.id)).map((p) => p.id);
  nextSeen.drawn += got.length;
  if (got.length <= pre.shown.length && got.join(',') !== pre.shown.slice(0, got.length).join(',')) nextBad(`보이던 ${pre.shown} · 들어온 ${got}`);
  nextView(b);
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
  if (!paused) { dom.key('Escape'); pump(1); if (screen() !== 'pause') throw new Error('pause did not open'); click('pause:settings'); click('set:speed4'); click('set:shake'); click('set:big'); click('set:big'); click('set:telemetry'); if (app.settings.telemetry !== false) throw new Error('telemetry setting did not turn off'); click('set:telemetry'); if (app.settings.telemetry !== true) throw new Error('telemetry setting did not turn on'); click('set:back'); click('pause:resume'); paused = true; settingsSeen = true; }
  if (!s.busy) notesOnce(b.status === 'chain' ? 'battle-chain' : 'battle', 6);
  if (b.status === 'chain') {
    // 사슬 한가운데서 이어 하기(드묾): 먹을 칸 하나
    const t = s.clickable();
    click(`sq:${t.list[0]}`);
    idle();
    return;
  }
  // 시계: 2관 첫 대국을 한 번 일부러 진다(수 하나 · 먼 목표) → 시계 한 칸을 잃고 보상 없이 상점(CHM-20)을 거쳐 다음 대국으로 가야 한다
  // 복기(CHM-59): 목표는 이 손의 최선 사슬 점수, 일부러 그보다 낮은 떨구기를 둔다 → 진 뒤 갈림길 카드가 그 수를 짚어야 한다
  if (!n2.forced && app.run.ante === 2 && b.movesUsed === 0 && !s.busy && app.run.clock > 1) {
    n2.forced = true; n2.clockBefore = { clock: app.run.clock, ante: app.run.ante, blind: app.run.blind, money: app.run.money };
    const collect = [], best = bestMove(b, { collect, preferMate: false });
    const worse = best && !best.mate && collect.find((c) => c.score < best.score && !c.mate);
    b.movesLeft = 1; b.target = worse ? b.score + best.score : 1e12; s.sync();
    n2.worse = worse ? { handIndex: worse.handIndex, sq: worse.sq, line: worse.line } : null;
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
  const d = n2.worse && b.movesUsed === 0 ? { play: n2.worse } : decideBattle(b);
  n2.worse = null;
  if (!d) throw new Error('no decision');
  const pre = nextBefore(b);
  if (d.reboard) {
    if (!region('btn:reboard')) { n2.reboardBad++; throw new Error('bot wants to reboard but no button'); }
    click('btn:reboard'); idle();
    n2.reboard++; n2.reboardBot++;
    // 다시 놓기는 판만 새로 깐다: 보이는 둘이 그대로
    if (pre && app.run.battle === b && nextDraws(b).map((p) => p.id).join(',') !== pre.shown.join(',')) nextBad(`다시 놓기 뒤 ${nextIds(nextDraws(b))} · 앞 ${pre.shown}`);
    nextAfter(pre);
    return;
  }
  if (d.discard) {
    for (const i of d.discard) click(`hand:${i}`);
    s.seq.total = 0;
    click('btn:discard');
    idle();
    nextAfter(pre);
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
  nextAfter(pre);
}

// 진 대국: 복기 중 한 줄 → 갈림길 카드(길 있음이면 판 위 「?」 · 「!」). 처음 길 있음 카드는 「다시 두기」, 그 밖은 「넘어가기」
function reviewStep() {
  const s = app.screen;
  rvSeen.lost++;
  let n = 0;
  while (app.screen === s && s.rv && s.rv.phase === 'think' && n < 1200) { pump(1); n++; }
  rvSeen.frames.push(n);
  if (app.screen !== s || !s.rv) { rvSeen.kinds.unknown++; const rr = s.reviewRes; rvSeen.unk.push(`${s.bRef ? s.bRef.ante : '?'}관 ${rr && rr.wall ? '시간' : `마디 ${rr ? rr.nodes : '?'}`}`); return; } // 찾지 못함: 카드 없이 지금 흐름
  const r = s.rv.res;
  rvSeen.cards++; rvSeen.kinds[r.kind]++;
  pump(2);
  if (r.kind === 'path') {
    if (!region('btn:replay') || !region('btn:moveon')) rvSeen.bad.push('길 있음 카드에 단추 둘이 없다');
    if (s.b.movesUsed !== r.move - 1) rvSeen.bad.push(`카드 판이 갈림길 상태가 아니다 ${s.b.movesUsed}/${r.move}`);
    if (app.run.log.at(-1).replay !== 'path') rvSeen.bad.push('대국 줄에 복기 결과가 없다');
    if (!rvSeen.replays) { notesOnce('review-card', 2); rvSeen.replays++; click('btn:replay'); pump(2); if (screen() !== 'review') rvSeen.bad.push(`다시 두기 → ${screen()}`); return; }
  } else if (region('btn:replay')) rvSeen.bad.push('길 없음 카드에 다시 두기');
  click('btn:moveon'); rvSeen.moveon++; pump(2);
  if (screen() === 'battle' && app.screen.rv) rvSeen.bad.push('넘어가기가 카드를 닫지 않았다');
}
// 다시 두기: ▶로 끝까지(마지막 수 뒤 이긴 대국) → ◀ 한 번(한 수 앞 상태로) → 키 →로 다시 끝까지 → 「넘어가기」
function reviewWalk() {
  let s = app.screen, guard = 0;
  const n = s.n;
  const toEnd = () => { while (guard++ < 40) { s = app.screen; idle2(s); if (s.i >= n) break; click('btn:forward'); pump(1); } s = app.screen; idle2(s); };
  toEnd();
  if (s.i !== n || s.live().status !== 'won') rvSeen.bad.push(`다시 두기 끝 ${s.i}/${n} ${s.live().status}`);
  else rvSeen.won++;
  notesOnce('review', 2);
  if (!rvSeen.back) {
    click('btn:back'); pump(2); rvSeen.back++;
    s = app.screen;
    if (s.name !== 'review' || s.i !== n - 1 || s.live().status === 'won') rvSeen.bad.push(`◀ 뒤 ${s.i}/${n}`);
    dom.key('ArrowRight'); pump(1); idle2(app.screen); rvSeen.keys++;
    s = app.screen;
    if (s.i !== n || s.live().status !== 'won') rvSeen.bad.push(`→ 뒤 ${s.i}/${n} ${s.live().status}`);
  }
  click('btn:moveon'); rvSeen.moveon++; pump(2);
  if (screen() === 'review') rvSeen.bad.push('다시 두기 넘어가기가 화면을 넘기지 않았다');
}
function idle2(s, max = 3000) { let k = 0; while (app.screen === s && (s.busy || s.playing) && k < max) { pump(1); k++; } if (k >= max) throw new Error('review animation never ends'); }

// 찜(CHM-58 F): 떠나기 전에 책갈피를 눌러 찜(처음엔 풀기 · 옮기기 · 손가락 한 번 누름도) → 다음 상점 같은 칸에 넘어왔나
const holdSeen = { on: 0, off: 0, moved: 0, touch: 0, carried: 0, dropped: 0, bought: 0, bad: [], want: null };
const holdKey = (it) => JSON.stringify({ ...it, price: undefined, sold: undefined, kept: undefined, base: undefined });
function holdArrive(run) {
  const w = holdSeen.want;
  holdSeen.want = null;
  if (!w || w.seed !== run.seed) return;
  const it = run.shop.display[w.slot];
  if (it && it.kept && holdKey(it) === w.key) { holdSeen.carried++; return; }
  // 그사이 같은 격언 · 첫 조각을 얻었으면 찜은 버린다(run.js holdStillGood)
  const gone = (w.kind === 'maxim' && run.maxims.some((m) => m.id === w.id)) || (w.kind === 'fragment' && run.fragments[w.legend] && run.fragments[w.legend].first);
  if (gone) { holdSeen.dropped++; return; }
  if (holdSeen.bad.length < 6) holdSeen.bad.push(`${run.ante}관: ${w.slot}칸 찜이 넘어오지 않았다`);
}
function holdBeforeLeave(run) {
  const shop = run.shop;
  const open = shop.display.map((it, i) => (!it.sold ? i : -1)).filter((i) => i >= 0);
  if (!open.length) return;
  const j = open[Math.floor(rnd() * open.length)];
  if (!region(`shop:hold:${j}`)) { holdSeen.bad.push(`${j}칸 책갈피 구역이 없다`); return; }
  const tap = (k) => { click(`shop:hold:${k}`); pump(1); };
  if (!holdSeen.off && open.length > 1) {
    tap(j); if (!run.hold || run.hold.slot !== j) holdSeen.bad.push('책갈피를 눌러도 찜이 안 됐다');
    tap(j); if (run.hold) holdSeen.bad.push('다시 눌러도 찜이 안 풀렸다'); else holdSeen.off++;
    const k = open.find((x) => x !== j); tap(k); tap(j); if (!run.hold || run.hold.slot !== j) holdSeen.bad.push('찜이 옮겨 가지 않았다'); else holdSeen.moved++;
  } else if (!holdSeen.touch) {
    // 손가락: 책갈피는 한 번 누르면 곧바로 찜(진열 카드처럼 두 번 누르지 않는다), 넓힌 구역 가장자리를 눌러도
    app.touch = true;
    try {
      pump(1);
      const r = region(`shop:hold:${j}`), money = run.money;
      if (!app.ui.finger || r.w < app.ui.finger || r.h < app.ui.finger) holdSeen.bad.push(`손가락 책갈피 구역이 작다 ${r.w}×${r.h} < ${app.ui.finger}`);
      const gx = r.x + 1, gy = r.y + r.h - 2;
      dom.mouse('mousemove', gx, gy); dom.mouse('mousedown', gx, gy); dom.mouse('mouseup', gx, gy); pump(1);
      if (!run.hold || run.hold.slot !== j || run.money !== money) holdSeen.bad.push('손가락 한 번에 찜이 안 됐다'); else holdSeen.touch++;
    } finally { app.touch = false; }
  } else if (!run.hold || run.hold.slot !== j) tap(j);
  if (run.hold) {
    const it = shop.display[run.hold.slot];
    holdSeen.on++;
    holdSeen.want = { seed: run.seed, slot: run.hold.slot, key: holdKey(it), kind: it.kind, id: it.id, legend: it.legend };
    notesOnce('shop-hold', 2);
  }
}

function shopStep() {
  const run = app.run;
  holdArrive(run);
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
    if (i >= 0 && rnd() < 0.8) { const kept = shop.display[i].kept; click(`shop:buy:${i}`); if (kept && shop.display[i].sold) holdSeen.bought++; continue; }
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
    if (run.money >= 5 + shop.rerolls && rnd() < 0.2) {
      const fixed = shop.display.map((it, k) => (!it.sold && (it.kept || (run.hold && run.hold.slot === k)) ? [k, holdKey(it)] : null)).filter(Boolean);
      click('shop:reroll');
      for (const [k, key] of fixed) if (holdKey(shop.display[k]) !== key && holdSeen.bad.length < 6) holdSeen.bad.push(`다시 진열이 찜한 ${k}칸을 바꿨다`);
      continue;
    }
    break;
  }
  if (app.screen.name === 'shop') { holdBeforeLeave(run); click('shop:leave'); }
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
  app = await boot({ window: dom.window, document: dom.document, today: () => DATE, rankBase: '' });
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
    if (name === 'select') { notesOnce('select', 4); const shown = peekSelect(); if (n2.waitNext || !(app.run.blind < 2 && rnd() < 0.15)) { click('select:play'); peekPlayed(shown); } else click('select:skip'); pump(2); if (n2.waitNext && screen() === 'battle') { n2.clockNext++; n2.waitNext = false; n2.clockBefore = null; } continue; }
    if (name === 'chest') { click('next'); pump(2); notesOnce('chest', 4); click('next'); pump(1); continue; }
    if (name === 'battle' && app.screen.rv) { reviewStep(); continue; }
    if (name === 'review') { reviewWalk(); continue; }
    if (name === 'battle') { idle(); if (app.screen.name === 'battle' && app.run.battle) battleStep(); else pump(1); continue; }
    // 각성 막간(금이 간 혼이 금빛 적을 먹고 이긴 뒤 저절로 열린다 — 판 흐름에 따라 이 길에서도 나온다)
    if (name === 'reward' || name === 'chest' || name === 'legend' || name === 'awaken') { if (name === 'awaken') pump(60); click('next'); pump(1); if (screen() === name) click('next'); continue; }
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
    // 꾸러미 걸음에서 Esc: 꾸러미를 넘기지 않고 멈춤이 열린다 → 계속이면 그 걸음에서 잇는다
    if (st.screen === 'pack' && screen() === 'pack') pauseCheck('수업 ⑩ 꾸러미');
    if (st.ok) click('guide:ok'); else click(st.target);
    pump(30);
  }
  if (app.guide) throw new Error('shop lesson guide stuck');
  lessonLog.push(`${i + 1} 상점`);
}
// 수업 열(타이틀 「수업」): 수업마다 목록에서 열고, 끝나면 목록으로 돌아온다
function lessons() {
  if (screen() !== 'title') app.toTitle();
  pump(1);
  click('title:lesson');
  const { LESSONS } = lessonMod;
  for (let i = 0; i < LESSONS.length; i++) {
    if (screen() !== 'lessons') throw new Error(`lesson list did not come back (${screen()})`);
    click(`lessons:${i}`);
    if (LESSONS[i].shop) playShopLesson(i); else playLesson(i);
    for (let n = 0; n < 60 && screen() !== 'lessons'; n++) pump(1);
  }
  if (app.run && app.run.scratch) throw new Error('lesson run leaked');
  click('lessons:back');
  pump(1);
}
// 첫 판 대본 대국(CHM-22): 처음 켜면 타이틀 → 「새 판」이 곧바로 킹과 두는 1관 연습. 걸음마다 가리킨 곳만 눌리고,
// 킹 말풍선은 왼쪽 칸(설명 자리)에서 가리킨 것 · 누를 것을 덮지 않는다. 끝나면 보상 → 상점(처음 안내도 킹 말풍선)
const movesTabs = [];
const scriptSeen = { steps: 0, moves: 0, blocked: 0, rewind: 0, won: false, score: 0, target: 0, shop: false, faction: false, bad: [] };
function guideCheck() {
  const g = app.guide, r = app.hintRect, st = g && g.steps[g.i];
  if (!st || !r) return;
  place.hint++;
  if (r.x !== P.SIDE_X || r.w !== P.SIDE_W || r.y < 0 || r.y + r.h > 270) { place.hintBad++; scriptSeen.bad.push(`자리 ${g.i} ${r.x},${r.y},${r.w},${r.h}`); }
  const tid = typeof st.target === 'function' ? st.target(app) : st.target;
  const tr = tid && region(tid);
  if (tr && cross(r, tr)) { place.self++; place.bad.push(`battle 킹 말풍선 ${g.i} 가리킨 것 ${tid}`); }
  for (const q of app.ui.regions) if (q.onClick && q.enabled && !q.id.startsWith('guide:') && cross(r, q)) { place.cover++; place.bad.push(`battle 킹 말풍선 ${g.i} 누를 것 ${q.id}`); break; }
}
// 따라 하는 길(대본 대국 · 수업 ⑩) 중의 멈춤: Esc · ≡ 단추가 늘 멈춤을 열고, 닫으면 길이 같은 걸음에서 잇는다
const pauseSeen = { esc: 0, button: 0, scriptDrop: 0, title: 0, resume: 0, skip: 0, lessonTitle: 0, bad: [] };
function pauseCheck(where) {
  const g = app.guide, i0 = g && g.i, sc = app.screen, phase = app.run && app.run.phase;
  dom.key('Escape'); pump(1);
  if (screen() === 'pause') pauseSeen.esc++; else pauseSeen.bad.push(`${where} Esc에 멈춤이 안 열림(${screen()})`);
  dom.key('Escape'); pump(1);
  if (app.overlay) pauseSeen.bad.push(`${where} Esc로 멈춤이 안 닫힘`);
  click('btn:pause');
  if (screen() === 'pause') pauseSeen.button++; else pauseSeen.bad.push(`${where} ≡에 멈춤이 안 열림(${screen()})`);
  click('pause:resume');
  if (app.overlay || app.guide !== g || app.guide.i !== i0 || app.screen !== sc || (app.run && app.run.phase) !== phase) pauseSeen.bad.push(`${where} 멈춤을 닫은 뒤 길이 어긋남`);
}
function firstPlay() {
  if (screen() !== 'title') throw new Error(`first launch did not open the title (${screen()})`);
  click('title:new');
  if (screen() !== 'battle' || !app.run.battle || app.run.battle.script !== 'king') throw new Error(`new run did not start the scripted battle (${screen()})`);
  if (app.visited.has('lesson') || app.visited.has('select') || app.visited.has('draft')) throw new Error('first launch went through lessons · select · draft');
  const s = app.screen;
  let measuring = false;
  for (let n = 0; n < 200 && app.guide; n++) {
    for (let k = 0; k < 900 && app.guide && app.guide.hold && app.guide.hold(app); k++) pump(1);
    idle();
    if (!app.guide) break;
    pump(2);
    guideCheck();
    scriptSeen.steps++;
    const st = app.guide.steps[app.guide.i], step = s.step;
    // 가리키지 않은 곳은 눌리지 않는다(빈 칸 · 손의 다른 기물)
    if (n === 1) { const before = JSON.stringify([s.sel, app.run.battle.movesUsed]); click('sq:36'); for (const h of [1, 2, 3]) if (region(`hand:${h}`)) click(`hand:${h}`); if (JSON.stringify([s.sel, app.run.battle.movesUsed]) !== before) scriptSeen.blocked = -99; else scriptSeen.blocked++; }
    if (n === 2 || (step && step.drop && !pauseSeen.scriptDrop++)) pauseCheck(`대본 걸음 ${app.guide.i}`);
    if (st.ok) { if (step && step.rewind) scriptSeen.rewind++; click('guide:ok'); continue; }
    const tid = st.target(app);
    if (!tid || !region(tid)) throw new Error(`script step ${app.guide.i} has no target (${tid})`);
    // 한 수 연출(×1): 떨구기부터 사슬 끝까지
    if (step && step.drop) { if (measuring) measureSeq(s); s.seq.total = 0; measuring = true; }
    click(tid);
    if (step && step.moves) {
      pump(2);
      if (screen() !== 'moves') throw new Error('moves overlay did not open');
      notesCheck();
      scriptSeen.moves++;
      click('moves:back');
    }
  }
  if (measuring) measureSeq(s);
  const last = app.run.log.at(-1);
  scriptSeen.won = !!(last && last.won); scriptSeen.score = last ? last.score : 0; scriptSeen.target = last ? last.target : 0;
  for (let n = 0; n < 8 && screen() !== 'shop'; n++) { if (region('next')) click('next'); else pump(30); }
  for (let n = 0; n < 60 && !app.hintShown; n++) pump(1);
  // 격언 안내는 진열에 격언이 있을 때만(CHM-36): 없으면 뜨지 않고 아껴 둔다
  const hasMaxim = screen() === 'shop' && app.run.shop.display.some((it) => it.kind === 'maxim' && !it.sold);
  scriptSeen.shop = screen() === 'shop' && (hasMaxim ? !!app.hintShown && app.hintShown.id === 'shop' : !(app.hintShown && app.hintShown.id === 'shop'));
  scriptSeen.shopMaxim = hasMaxim;
  // 대본 대국은 관 선택을 건너뛴다: 농민군 처음 안내는 그 뒤 처음 보는 관 선택(1관 정식)에서 뜬다(상점 → 레퍼토리 → 관 선택)
  for (let n = 0; n < 40; n++) {
    pump(80);
    if (screen() === 'select') break;
    if (app.hintShown) { click(app.hintShown.regionId); continue; }
    if (screen() === 'shop') click('shop:leave');
    else if (screen() === 'draft') click('draft:0');
  }
  for (let n = 0; n < 60 && !app.hintShown; n++) pump(1);
  scriptSeen.faction = screen() === 'select' && app.run.ante === 1 && app.run.blind === 1 && !!app.hintShown && app.hintShown.id === 'faction_peasants';
  app.toTitle();
  pump(1);
}
const lessonLog = [];

const t0 = performance.now();
await start();
firstPlay();
// 대본 중 멈춤 → 타이틀로: 길이 닫히고 타이틀이 눌린다 → 이어 하기면 대본이 그 수에서 이어진다 → 멈춤을 닫고 「건너뛰기」
{
  app.newRun({ script: true });
  for (let n = 0; n < 900 && app.guide && app.guide.hold(app); n++) pump(1);
  pump(2);
  dom.key('Escape'); pump(1);
  click('pause:title');
  if (screen() === 'title' && !app.guide && !app.overlay && region('title:continue')) pauseSeen.title++; else pauseSeen.bad.push(`대본 멈춤 → 타이틀로(${screen()}, 길 ${!!app.guide})`);
  click('title:continue');
  for (let n = 0; n < 900 && app.guide && app.guide.hold(app); n++) pump(1);
  pump(2);
  if (screen() === 'battle' && app.guide && app.run.battle && app.run.battle.script) pauseSeen.resume++; else pauseSeen.bad.push(`이어 하기가 대본으로 돌아오지 않음(${screen()})`);
  dom.key('Escape'); pump(1); click('pause:resume');
  if (region('guide:skip')) { click('guide:skip'); pump(2); }
  if (!app.guide && screen() === 'battle' && app.run.battle && !app.run.battle.script) pauseSeen.skip++; else pauseSeen.bad.push('멈춤을 닫은 뒤 「건너뛰기」가 평범한 대국을 열지 않음');
  app.toTitle(); pump(1);
}
lessons();
// 수업 ⑩ 중 멈춤 → 타이틀로: 길과 연습 판이 함께 닫힌다
{
  click('title:lesson');
  const i = lessonMod.LESSONS.findIndex((L) => L.shop);
  click(`lessons:${i}`);
  pump(30);
  dom.key('Escape'); pump(1);
  click('pause:title');
  if (screen() === 'title' && !app.guide && !app.run && region('title:lesson')) pauseSeen.lessonTitle++; else pauseSeen.bad.push(`수업 ⑩ 멈춤 → 타이틀로(${screen()}, 길 ${!!app.guide}, 판 ${!!app.run})`);
  click('title:lesson');
  if (screen() !== 'lessons') throw new Error('lesson list did not open after leaving lesson 10');
  click('lessons:back');
  pump(1);
}
const results = [];
for (let k = 0; k < RUNS; k++) results.push(await playOne(SEED + k));
// 판 밖: 도감 · 기록 화면, 오프닝과 단을 모두 연 뒤 시실리안 3단 판, 오늘의 대국
click('result:title');
click('title:codex');
for (const t of ['factions', 'legends', 'openings', 'editions', 'pieces', 'souls', 'maxims']) { click(`codex:tab:${t}`); notesCheck(); if (region('codex:next') && region('codex:next').enabled) { click('codex:next'); notesCheck(); click('codex:prev'); } }
click('codex:back');
// 완성한 명경기가 있는 도감(명경기 탭): 완성 칸의 말풍선(조각 세 걸음이 다 찬 풀이)이 누를 것(돌아가기 · 탭)을 덮지 않는다
{
  const c = app.records.codex, keep = JSON.stringify({ legends: c.legends, legendsDone: c.legendsDone });
  for (const l of LEGENDS) { c.legends[l.id] = 3; c.legendsDone[l.id] = true; }
  click('title:codex'); click('codex:tab:legends');
  const cover0 = place.cover;
  codexDone.cells = LEGENDS.filter((l) => region(`codex:${l.id}`) && region(`codex:${l.id}`).tip).length;
  notesCheck();
  codexDone.cover = place.cover - cover0;
  click('codex:back');
  Object.assign(c, JSON.parse(keep));
}
// 다 본 도감(CHM-46): 모든 탭 · 모든 쪽을 그려 칸 이름(두 줄까지)이 잘리지 않는지 「잘린 글」로 잰다 — 판에서 본 것만으론 긴 이름이 빠진다
{
  const c = app.records.codex, keep = JSON.stringify(c);
  const { MAXIMS } = await import('../src/data/maxims.js');
  const { SOULS } = await import('../src/data/souls.js');
  const { FACTIONS } = await import('../src/data/factions.js');
  const { EDITIONS } = await import('../src/data/editions.js');
  for (const m of MAXIMS) c.maxims[m.id] = true;
  c.souls = Object.fromEntries(SOULS.map((q) => [q.id, true]));
  c.factions = Object.fromEntries(FACTIONS.map((q) => [q.id, true]));
  for (const l of LEGENDS) c.legends[l.id] = Math.max(1, c.legends[l.id] || 0);
  for (const e of EDITIONS) c.editions[e.id] = true;
  click('title:codex');
  for (const t of ['maxims', 'pieces', 'souls', 'factions', 'legends', 'openings', 'editions']) {
    click(`codex:tab:${t}`); pump(1); codexAll.pages++;
    for (let n = 0; n < 12 && region('codex:next') && region('codex:next').enabled; n++) { click('codex:next'); pump(1); codexAll.pages++; }
  }
  click('codex:back');
  Object.assign(app.records.codex, JSON.parse(keep));
}
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
if (app.run.daily !== DATE || !app.records.daily || app.records.daily.date !== DATE) throw new Error('daily not recorded');
// 순위(CHM-70): 화면이 둔 오늘의 대국 판이 남긴 명령 줄(run.cmds)을 서버의 다시 두기(api/_lib/verify.js)에 넣어 같은 성적이 나오는지 잰다
const boardCheck = { cmds: 0, bytes: 0, ms: 0, same: false, screen: null, server: null, error: null };
{
  const run = app.run, sent = JSON.parse(JSON.stringify(run.cmds || null));
  boardCheck.cmds = sent ? sent.length : 0;
  boardCheck.bytes = JSON.stringify(sent).length;
  boardCheck.screen = summarize(run);
  const t0 = performance.now();
  try { const { used, ...got } = verifyDaily(DATE, sent); boardCheck.server = got; boardCheck.used = used; } catch (e) { boardCheck.error = `${e.code || e.message}${e.at != null ? ` @${e.at}` : ''}`; }
  boardCheck.ms = Math.round(performance.now() - t0);
  boardCheck.same = !!boardCheck.server && JSON.stringify(boardCheck.server) === JSON.stringify(boardCheck.screen) && boardCheck.used === boardCheck.cmds;
}
// ── 순위(CHM-70): 방금 끝낸 오늘의 대국 판이 순위에 오르고(제출 한 번), 결과 카드에 등수와 이웃이 보이고, 「순위 보기」 → 쪽 넘김 → 내 줄 → 어제 탭 →
// 돌아와 설정에서 다시 지으면 이름이 바뀐다. 그리는 동안 글 넘침 · 자리 규칙 · 처음 안내는 pump가 잰다
const rankSeen = { submit: 0, card: '', neighbours: 0, hint: 0, open: 0, pages: 0, turned: 0, mine: 0, yesterday: 0, back: 0, name: '', renamed: '', tip: 0, unreached: 0, unplayed: 0, play: 0, stale: 0, bad: [] };
{
  const { L } = await import('../src/ui/lang.js');
  const drew = (ko) => LL.LOG.texts.some((q) => q.s === L(ko));
  const bad = (m) => rankSeen.bad.push(m);
  if (screen() !== 'result') bad(`결과 화면이 아니다 ${screen()}`);
  pump(1);
  if (app.rank.status(DATE).phase === 'pending' && drew('확인 중')) rankSeen.pending = 1;
  await netSettle(); pump(3);
  const st = app.rank.status(DATE);
  rankSeen.submit = rankApi.named('/api/daily/submit').length;
  if (st.phase !== 'ok' || !st.me) bad(`제출 뒤 상태 ${st.phase}`);
  else {
    const want = summarize(app.run);
    if (st.me.ante !== want.ante || st.me.blind !== want.blind || st.me.won !== want.won || st.me.score !== want.score_total) bad('순위에 오른 성적이 화면 판과 다르다');
    rankSeen.card = `${st.rank}등/${st.total}명`;
    const card = LL.LOG.boxes.find((b) => b.name === '순위 카드');
    if (!card || card.y + card.h > 270) bad('결과 화면에 순위 카드가 없다');
    rankSeen.neighbours = LL.LOG.texts.filter((q) => q.box === card && st.around.some((r) => app.rank.nameOf(r) === q.s)).length;
    if (!drew(`오늘 ${st.rank}등`) || rankSeen.neighbours < 1) bad('카드에 등수 · 내 줄이 없다');
    click('result:rank'); pump(2); await netSettle(); pump(3);
    if (screen() !== 'rank') bad(`순위 보기 → ${screen()}`);
    else {
      rankSeen.open = 1;
      const d0 = app.rank.board(DATE, 1).data;
      rankSeen.pages = d0 ? d0.pages : 0;
      if (!d0 || d0.total !== 25 || d0.rows.length !== 10 || !region('rank:mine')) bad('순위표 첫 쪽이 어긋났다');
      const rowsDrawn = () => LL.LOG.boxes.filter((b) => /^순위 줄 /.test(b.name || '')).map((b) => Number(b.name.slice(5)));
      if (rowsDrawn().join() !== '1,2,3,4,5,6,7,8,9,10') bad(`첫 쪽 줄 ${rowsDrawn().join()}`);
      click('rank:next'); pump(1); await netSettle(); pump(3);
      if (rowsDrawn().join() === '11,12,13,14,15,16,17,18,19,20') rankSeen.turned++; else bad(`둘째 쪽 줄 ${rowsDrawn().join()}`);
      dom.key('ArrowRight'); pump(1); await netSettle(); pump(3);
      if (rowsDrawn().join() === '21,22,23,24,25') rankSeen.turned++; else bad(`셋째 쪽 줄 ${rowsDrawn().join()}`);
      if (region('rank:next').enabled) bad('마지막 쪽에서 다음 쪽 단추가 켜져 있다');
      click('rank:mine'); pump(1); await netSettle(); pump(3);
      if (app.screen.page === Math.floor((st.rank - 1) / 10) && rowsDrawn().includes(st.rank)) rankSeen.mine = 1; else bad('내 줄을 눌러도 내 쪽으로 가지 않았다');
      click('rank:tab:yesterday'); pump(1); await netSettle(); pump(3);
      const y = app.rank.board(shiftDate(DATE, -1), 1).data;
      if (y && y.total === 13 && y.me === null && rowsDrawn().length === 10 && drew('어제는 플레이하지 않았어요') && !region('rank:play')) rankSeen.yesterday = 1; else bad('어제 탭이 어긋났다');
      click('rank:next'); pump(1); await netSettle(); pump(3);
      click('rank:tab:today'); pump(1); await netSettle(); pump(3);
      click('rank:back'); pump(2);
      if (screen() === 'result' && region('result:rank')) rankSeen.back = 1; else bad(`돌아가기 → ${screen()}`);
    }
    // 설정의 이름 줄: 다시 지으면 이름이 바뀌고 순위표의 내 줄도 따라 바뀐다
    click('result:title'); pump(2);
    // 처음 안내: 순위에 이름이 생긴 뒤 첫 화면에서 한 번 — 설정 칸을 가리킨다. 누르면 사라지고 다시 안 뜬다
    for (let n = 0; n < 120 && !(app.hintShown && app.hintShown.id === 'rankName'); n++) pump(1);
    if (app.hintShown && app.hintShown.id === 'rankName') rankSeen.hint = 1;
    click('title:settings'); pump(2);
    if (!app.records.coachSeen.rankName) bad('이름 안내가 본 것으로 남지 않았다');
    const before = app.rank.player();
    rankSeen.name = before ? before.name : '';
    if (!before || !region('set:name') || !drew(before.name)) bad('설정에 이름 줄이 없다');
    else {
      hover('set:name'); pump(2);
      if (LL.LOG.texts.some((q) => q.s === L(`오늘 ${before.rerolls}번 더 바꿀 수 있어요`))) rankSeen.tip = 1; else bad('다시 짓기를 가리켜도 남은 횟수가 안 보인다');
      click('set:name'); pump(1); await netSettle(); pump(3);
      const after = app.rank.player();
      rankSeen.renamed = after.name;
      if (after.name === before.name || after.rerolls !== before.rerolls - 1 || !drew(after.name) || JSON.parse(dom.store.get(PLAYER_KEY)).a !== after.a) bad('다시 지어도 이름이 바뀌지 않았다');
      const mine = (await (await rankApi.fetch(`/api/daily/board?date=${DATE}`, { headers: { Authorization: `Bearer ${JSON.parse(dom.store.get(PLAYER_KEY)).key}` } })).json()).me;
      if (!mine || mine.a !== after.a || mine.n !== after.n) bad('서버의 내 줄 이름이 바뀌지 않았다');
    }
    click('set:back'); pump(2);
  }
  if (app.toasts.length) bad(`알림이 떴다: ${app.toasts.map((q) => q.msg).join(' / ')}`);
}
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
    if (name === 'battle' && app.screen.rv) { reviewStep(); continue; }
    if (name === 'review') { reviewWalk(); continue; }
    if (name === 'battle') { idle(); if (app.screen.name === 'battle' && app.run.battle) battleStep(); else pump(1); continue; }
    if (name === 'reward' || name === 'chest' || name === 'legend' || name === 'awaken') { if (name === 'awaken') pump(60); click('next'); pump(1); if (screen() === name) click('next'); continue; }
    if (name === 'shop') { shopStep(); continue; }
    if (name === 'pack') { packStep(); continue; }
    throw new Error(`stuck on ${name}`);
  }
  if (!app.records.bestEndless) throw new Error('endless not recorded');
  log('  끝없는 대국', app.run.ante, '관까지');
}
// ── 하이라이트 카드(CHM-73): 결과 화면 「하이라이트」 → 카드 + 미리 만든 그림(1200 × 675) → Esc · 바깥 누르기 · 「닫기」로 닫힌다. 글 넘침은 pump가 잰다.
// 그림을 기다리며 한 박자 쉬므로(순위 · 저장의 약속이 같이 풀린다) 순위 흐름 뒤, 끝없는 대국이 끝난 결과 화면에서 본다
const hlSeen = { button: 0, open: 0, image: 0, esc: 0, outside: 0, close: 0, bad: [] };
if (screen() === 'result' && app.run.bestReplay) {
  const s = hlSeen, open = () => { click('result:highlight'); pump(2); return screen() === 'highlight'; };
  s.button = region('result:highlight') ? 1 : 0;
  if (s.button && open()) {
    s.open = 1;
    await new Promise((r) => setImmediate(r)); pump(2);
    const b = app.overlay.blob;
    if (b && b.size === 1200 * 675 && region('hl:save').enabled) s.image = 1; else s.bad.push(`그림이 없다(${b && b.size})`);
    if (region('hl:share')) s.bad.push('공유를 못 하는 곳인데 「공유」 단추가 있다');
    dom.key('Escape'); pump(1);
    if (screen() === 'result') s.esc = 1;
    if (open()) { dom.mouse('mousedown', 5, 264); dom.mouse('mouseup', 5, 264); pump(1); if (screen() === 'result') s.outside = 1; }
    if (open()) { click('hl:close'); if (screen() === 'result') s.close = 1; }
  }
} else hlSeen.bad.push(`결과 화면에 최고 한 수가 없다(${screen()})`);
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
  const stock = (r) => { r.shop = { rng: fork(createRng(3), 'layout'), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'T', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false }; };
  const scene = (setup) => { app.overlay = null; app.nextSeed = 11; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 }); fill(app.run); setup(app.run); pump(90); notesCheck(); };
  scene((r) => { r.phase = 'shop'; stock(r); app.go('shop'); });
  scene((r) => { r.phase = 'shop'; stock(r); app.go('shop'); pump(2); click('cons:0'); click(`deck:${r.deck[1].id}`); });
  // 진열 카드 종류마다(CHM-42): 깨우기는 금이 간 혼이 있어야 진열에 나와(sim/shop.js) 봇 판이 거의 그리지 않는다.
  // 첫 장면은 tools/shots-kinds.mjs 「2b-shop」과 같은 그림(명경기 조각 · 깨우기 진열, 봉투 없는 꾸러미 셋, 두루마리 넷).
  // 장면마다 마지막 프레임의 진열 카드 상자 · 그 안의 글 수를 적어 둔다(글 넘침 검사가 그 줄을 잰 증거)
  const shopKinds = [
    [[{ kind: 'fragment', legend: 'immortal', price: 6 }, { kind: 'awaken', price: 8 }], [{ kind: 'tactic', id: 'freeze' }, { kind: 'soul', id: 'martyr' }, { kind: 'chart', form: 'N' }, { kind: 'engraving', id: 'marble' }], ['piece', 'engraving', 'golden']],
    [[{ kind: 'evolve', price: 6 }, { kind: 'tactic', id: 'taunt', price: 4 }], null, ['chart', 'engraving', 'golden']],
    [[{ kind: 'soul', id: 'martyr', price: 9 }, { kind: 'engraving', id: 'glass', price: 5 }], null, ['piece', 'chart']],
    [[{ kind: 'gamble', id: 'potion', price: 5 }, { kind: 'piece', t: 'N', soul: 'spring', price: 9 }], null, ['engraving', 'golden']],
    [[{ kind: 'chart', form: 'R', price: 4 }, { kind: 'maxim', id: 'shadow_reading', edition: 'obsidian', price: 12 }], null, ['piece', 'chart', 'golden']],
  ];
  for (const [display, cons, packs] of shopKinds) {
    scene((r) => {
      if (cons) { r.consumableSlots = 4; r.consumables = cons.map((c) => ({ ...c })); }
      r.phase = 'shop';
      r.shop = { rng: null, display: display.map((it) => ({ ...it, sold: false })), packs: packs.map((kind) => ({ kind, price: kind === 'golden' ? 0 : 4, sold: false })), rerolls: 0, promoted: false, removed: false };
      app.go('shop');
    });
    const cards = LL.LOG.boxes.filter((b) => /^카드 /.test(b.name));
    const lines = LL.LOG.texts.filter((q) => q.box && cards.includes(q.box) && q.s.trim());
    const bad = LL.checkLayout().filter((q) => cards.some((b) => q.msg.includes(`${b.name}@${b.x},${b.y} `)));
    shopCards.scenes.push(`${display.map((it) => it.kind).join(' · ')}: 카드 상자 ${cards.length} · 글 ${lines.length}${bad.length ? ` · 넘침 ${bad.length}` : ''}`);
    shopCards.boxes += cards.length; shopCards.lines += lines.length; shopCards.bad += bad.length;
  }
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
  // 긴 이름 격언 1열(잘린 글 검사): 전설 격언은 칸 수와 따로 들어와 기본 칸 다섯이면 여섯 칸(2열)이다. 1열에 전설 격언이 서는 것은
  // 격언 칸 4 레퍼토리(룩 엔딩) — 격언 셋 + 명경기 하나 = 칸 다섯, 대국 · 상점 오른쪽 칸 1열(폭 112).
  // 영어 명경기 이름 넷은 1열 칸에서 「…」(허용 목록), 이름이 긴 보통 격언(collector_forms · reinforce_hunt · shadow_reading)은 잘리면 안 된다
  for (const legend of ['immortal', 'opera', 'century', 'evergreen']) {
    const fill1 = (r) => {
      r.maxims = []; r.maximSlots = 4;
      ['collector_forms', 'reinforce_hunt', 'shadow_reading'].forEach((id) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 }));
      r.maxims.push({ uid: r.nextUid++, id: legend, data: {}, edition: null, paid: 0, legendary: true });
    };
    scene((r) => { fill1(r); r.ante = 5; r.blind = 0; app.cmd({ type: 'play' }); app.go('battle', { events: [] }); pump(60); });
    scene((r) => { fill1(r); r.phase = 'shop'; stock(r); app.go('shop'); });
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
  // 상점 진열에서 기보를 사는 순간(CHM-33): 나이트 2 → 3(동 → 은, 크게) · 3 → 4(수준만). 두루마리 칸이 차 있어도 사고, 칸은 그대로
  for (const [from, big] of [[2, true], [3, false]]) {
    setup((r) => { r.phase = 'shop'; r.battle = null; r.money = 20; r.charts.N = from; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }]; r.shop = { rng: null, display: [{ kind: 'chart', form: 'N', price: 3, sold: false }], packs: [], rerolls: 0, promoted: false, removed: false }; app.go('shop'); });
    click('shop:buy:0');
    const g = app.screen.grow;
    if (!g || g.form !== 'N' || g.big !== big || g.from !== from || g.to !== from + 1 || app.run.charts.N !== from + 1 || app.run.consumables.length !== 2) chartSeen.growBad++;
    else if (big) chartSeen.grow++; else chartSeen.tick++;
    pump(70);
  }
  app.toTitle(); pump(1);
}

// 각인 · 혼 덮어쓰기(docs/tasks/backlog.md 6): 이미 같은 종류가 있는 기물을 고르면 옛 것 › 새 것 확인(target:swap).
// 「그만」이면 대상 고르기로(두루마리 · 꾸러미 · 기물 그대로), 「바꾸기」면 새 것으로. 같은 것이 새겨진 기물은 고를 수 없다
const swapSeen = { same: 0, shopBack: 0, shopEsc: 0, shopSwap: 0, soulSwap: 0, packBack: 0, packEsc: 0, packSwap: 0, bad: [] };
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
    // Esc도 「그만」과 같다(대상 고르기 전체를 닫지 않는다)
    click(`deck:${gold.id}`);
    dom.key('Escape'); pump(1);
    if (screen() === 'shop' && s().target && s().target.index === 0 && s().target.pieceId == null && r.consumables.length === 2 && gold.eng.id === 'gold' && !region('target:swap')) swapSeen.shopEsc++; else bad('상점 바꾸기 확인에서 Esc가 대상 고르기로 돌아가지 않았다');
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
    dom.key('Escape'); pump(1);
    if (screen() === 'pack' && r.phase === 'pack' && r.pack && app.screen.engraveIndex === 0 && app.screen.engraveTarget == null && gold.eng.id === 'gold') swapSeen.packEsc++; else bad('꾸러미 바꾸기 확인에서 Esc가 대상 고르기로 돌아가지 않았다');
    click(`deck:${gold.id}`);
    click('target:ok');
    if (gold.eng.id === 'glass' && r.phase === 'shop') swapSeen.packSwap++; else bad('꾸러미 「바꾸기」가 새 각인으로 바꾸지 않았다');
    pump(30);
  }
  app.toTitle(); pump(1);
}

// 혼 각성 걸음(CHM-17): 주머니 모든 기물에 금 바로 앞의 혼(사슬 4/5) → 먹은 사슬 하나로 금이 간다(대국 글 · 금 소리, 한 수 연출 4초 안)
//   → 상점 처음 안내가 금 간 기물을 가리킨다 → 두루마리 깨우기: 금 없는 기물은 고를 수 없다 → 미리 보기 → 깨운다 → 각성 막간 → 상점, 기물에 금테.
//   마스터의 상자에서 깨우기 칸이 뜨는 모습도 그려 본다(글 넘침 · 자리 규칙이 같이 잰다)
const awakeSeen = { crack: 0, toast: 0, hint: 0, skip: 0, preview: 0, screen: 0, back: 0, chest: 0, bad: [] };
{
  const bad = (m) => awakeSeen.bad.push(m);
  app.overlay = null; app.nextSeed = 12; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  const r = app.run;
  for (const p of r.deck) Object.assign(p, { soul: 'hunger', links: CRACK.links - 1 });
  if (app.records.coachSeen) delete app.records.coachSeen.crack;
  app.settings.coach = true;
  app.goPhase(); pump(30);
  click('select:play'); pump(2);
  if (screen() !== 'battle') bad(`대국이 열리지 않았다(${screen()})`);
  else {
    idle();
    const b = app.run.battle, s = app.screen;
    b.target = 1; s.sync();
    const d = decideBattle(b);
    s.seq.total = 0; s.seq.trace = [];
    // 뜬 알림을 모은다: 목표 1이라 이 사슬이 점화(넘침 ×10, CHM-67)해 막간이 3초 떠 있는 동안 알림(2.4초)은 스러진다
    const toasts = [], toast0 = app.toast;
    app.toast = (msg, ...rest) => { toasts.push(msg); return toast0(msg, ...rest); };
    click(`hand:${d.play.handIndex}`); click(`sq:${d.play.sq}`); idle();
    for (const c of lineCommands(d.play.line)) { if (!app.run.battle || app.screen.name !== 'battle' || app.run.battle.status !== 'chain') break; click(`sq:${c.sq}`); idle(); }
    app.toast = toast0;
    measureSeq(s);
    if ((r.cracked || []).length) awakeSeen.crack++; else bad('금이 가지 않았다');
    if (toasts.some((m) => /금이 갔어요|cracked/.test(L(m)))) awakeSeen.toast++; else bad('금 글이 뜨지 않았다');
  }
  for (let k = 0; k < 20 && screen() !== 'shop'; k++) { pump(30); if (['reward', 'chest', 'legend', 'awaken'].includes(screen())) { click('next'); pump(1); if (region('next')) click('next'); } }
  if (screen() !== 'shop') bad(`상점으로 오지 않았다(${screen()})`);
  else {
    const cracked = r.deck.find(isCracked), other = r.deck.find((p) => !isCracked(p));
    pump(20);
    if (cracked && app.hintShown && app.hintShown.id === 'crack' && app.hintShown.regionId === `deck:${cracked.id}`) awakeSeen.hint++; else bad(`처음 안내(금)가 금 간 기물을 가리키지 않았다(${app.hintShown ? app.hintShown.id : '없음'})`);
    hintCheck();
    r.consumables = [{ kind: 'awaken' }];
    pump(2);
    click('cons:0'); pump(2);
    if (other) { click(`deck:${other.id}`); if (app.screen.target && app.screen.target.pieceId == null) awakeSeen.skip++; else bad('금 없는 기물이 골라졌다'); }
    click(`deck:${cracked.id}`); pump(2);
    if (region('target:ok')) awakeSeen.preview++; else bad('깨우기 미리 보기가 뜨지 않았다');
    notesCheck();
    click('target:ok'); pump(2);
    if (screen() === 'awaken') awakeSeen.screen++; else bad(`각성 막간이 열리지 않았다(${screen()})`);
    pump(120); notesCheck();
    click('next'); pump(2);
    if (screen() === 'awaken') click('next');
    pump(2);
    if (screen() === 'shop' && cracked.awake && !r.consumables.length) awakeSeen.back++; else bad(`각성 뒤 상점으로 돌아오지 않았다(${screen()} · ${cracked.awake})`);
    // 마스터의 상자: 세 칸, 마지막 칸이 깨우기
    const item = { kind: 'awaken', pieceId: other.id, piece: other.t, soul: 'hunger' };
    app.go('chest', { chest: { count: 3, tier: 'uncommon', cells: [{ lit: false, item: null }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item }, { lit: false, item: null }], items: [] } });
    pump(240); notesCheck();
    const cell = region('chest:cell:3');
    if (cell && cell.keys && /깨어난다|awakens/.test(L(cell.keys[0]))) awakeSeen.chest++; else bad('상자의 깨우기 칸 글이 없다');
    click('next'); pump(1); if (screen() === 'chest') click('next');
  }
  app.toTitle(); pump(1);
}

// 점화 막간 걸음(CHM-63): 봇 판에서 점화가 몇 번 나는지는 판 구성에 달렸다(오늘의 대국 판이 한 번 보태 주던 날만 셋이었다) —
//   「누름 · Enter · 저절로」가 그 우연에 기대지 않게 점화가 확실한 판을 심는다: 새 판 첫 대국을 사슬 8이 나는 판(test/helpers/run.js plantChain8 — 넘침 ×10은 3관부터만 센다)으로 갈아 끼우고 그 사슬을 둔다.
//   막간은 판당 한 번이라 판을 새로 열어, 적어도 한 번 · 저절로 닫히는 것까지 볼 때까지 거듭한다(앞의 둘은 igniteWatch가 눌러 · Enter로 닫는다)
const { plantChain8 } = await import('../test/helpers/run.js');
const ignPlant = { runs: 0, opened: 0, bad: [] };
for (let k = 0; k < 3 && (!k || igSeen.opened < 3 || !igSeen.auto); k++) {
  const bad = (m) => ignPlant.bad.push(m);
  app.overlay = null; app.nextSeed = 21 + k; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.goPhase(); pump(30);
  click('select:play'); pump(2);
  ignPlant.runs++;
  if (screen() !== 'battle') bad(`대국이 열리지 않았다(${screen()})`);
  else {
    idle();
    const b = app.run.battle, s = app.screen, before = igSeen.opened;
    const [drop, ...caps] = plantChain8(b);
    s.sync();
    click(`hand:${drop.handIndex}`); click(`sq:${drop.sq}`); idle();
    for (const c of caps) { if (!app.run.battle || app.screen.name !== 'battle' || app.run.battle.status !== 'chain') break; click(`sq:${c.sq}`); idle(); }
    // 막간이 저절로 닫힐 때까지(앉은 뒤 2초 — 넉넉히 6초)
    for (let n = 0; n < 360 && app.screen.combo; n++) pump(1);
    s.seq.trace = [];
    if (igSeen.opened === before + 1) ignPlant.opened++; else bad(`심은 판에서 막간이 열리지 않았다(${igSeen.opened - before})`);
  }
  app.toTitle(); pump(1);
}

// 탁월수 걸음(CHM-43): 봇 판은 탁월수가 드물어(판의 3%) 하나를 세운다. 손 폰 넷 · 주머니 맨 앞 나이트 · 판에 지키는 적 없는 킹 하나 →
//   폰 하나를 바친다(카드가 흩어지고 나이트가 들어온다) → 나이트에 「!?」 · 처음 안내 · 바친 줄 → 나이트를 들어 킹에 닿는 칸에 떨군다(「!?」가 사라진다) →
//   킹을 먹는다: 메이트 + 탁월수 「!!」(h8 — 오른쪽 끝 · 맨 윗줄이라 딱지가 아래 왼쪽으로 뒤집힌다) · 배수 ×2 · 기록. 한 수 연출(×1)을 잰다
//   탁월수 뒤 명경기 첫 조각(CHM-47): 판에 첫 조각이 하나 늘고, 조각 얻음 알림(「… · 첫 조각」)이 뜬다
const brillSeen = { sac: 0, deal: 0, tag: 0, hint: 0, row: 0, gone: 0, fx: 0, flip: 0, mult: 0, record: 0, frag: 0, sec: 0, bad: [] };
{
  const bad = (m) => brillSeen.bad.push(m);
  app.overlay = null; app.nextSeed = 14; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  if (app.records.coachSeen) delete app.records.coachSeen.brilliant;
  app.settings.coach = true;
  app.goPhase(); pump(30);
  click('select:play'); pump(2);
  if (screen() !== 'battle') bad(`대국이 열리지 않았다(${screen()})`);
  else {
    idle();
    for (let n = 0; n < 200 && app.screen.banner; n++) pump(1);
    const b = app.run.battle, s = app.screen;
    b.board = boardFrom({ h8: 'K' }); b.incoming = []; b.incomingNext = [];
    b.hand = ['P', 'P', 'P', 'P'].map((t, i) => ({ t, id: 900 + i, eng: null }));
    b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
    b.target = 1e9; b.discardsLeft = Math.max(1, b.discardsLeft);
    s.sync(); pump(2);
    const recBefore = app.records.brilliants || 0;
    click('hand:0'); click('btn:discard'); pump(1);
    if (s.view.hiding && s.view.hiding[0] === 0) brillSeen.sac++; else bad('바친 카드가 흩어지지 않았다');
    idle(); pump(3);
    const i = s.view.hand.findIndex((p) => p.id === 950);
    if (i >= 0 && s.dealIn && s.dealIn.ids.includes(950)) brillSeen.deal++; else bad('새로 뽑은 나이트가 손에 들어오지 않았다');
    if (s.view.drawn.includes(950)) brillSeen.tag++; else bad('새로 뽑은 기물에 「!?」가 없다');
    if (s.offeredLayout && s.offeredLayout.n === 1 && s.offeredLayout.shown === 1) brillSeen.row++; else bad(`바친 기물 줄이 어긋났다(${JSON.stringify(s.offeredLayout)})`);
    for (let n = 0; n < 30 && !app.hintShown; n++) pump(1);
    if (app.hintShown && app.hintShown.id === 'brilliant' && app.hintShown.regionId === `hand:${i}`) brillSeen.hint++; else bad(`처음 안내(탁월수)가 「!?」 카드를 가리키지 않았다(${app.hintShown ? `${app.hintShown.id}@${app.hintShown.regionId}` : '없음'})`);
    notesOnce('brilliant', 1);
    click(`hand:${i}`); pump(1);
    const K = 63, sq = dropSquaresFor(b, b.hand[i]).find((q) => previewDrop(b, i, q).next.includes(K));
    if (sq == null) bad('킹에 닿는 떨굴 칸이 없다');
    else {
      s.seq.total = 0; s.seq.trace = [];
      click(`sq:${sq}`); idle();
      if (!s.view.drawn.length) brillSeen.gone++; else bad('수를 둔 뒤에도 「!?」가 남았다');
      const fx0 = (app.stats && app.stats.brilliantFx) || 0;
      const firsts = () => Object.values(app.run.fragments || {}).filter((f) => f.first).length;
      const first0 = firsts();
      let sawMult = false, sawFrag = false;
      click(`sq:${K}`);
      for (let n = 0; n < 600 && app.screen === s && s.busy; n++) { pump(1); if (s.view.brill && s.view.brill.x === 2) sawMult = true; if (app.toasts.some((t) => t.msg.endsWith('첫 조각'))) sawFrag = true; }
      if (firsts() === first0 + 1 && sawFrag) brillSeen.frag++; else bad(`탁월수 뒤 명경기 조각이 보이지 않았다(첫 조각 ${first0} → ${firsts()}, 알림 ${sawFrag})`);
      measureSeq(s);
      brillSeen.sec = s.seq.total;
      if (((app.stats && app.stats.brilliantFx) || 0) > fx0) brillSeen.fx++; else bad('탁월수 「!!」가 뜨지 않았다');
      if (s.lastBrilliantTag && s.lastBrilliantTag.flipX && s.lastBrilliantTag.flipY) brillSeen.flip++; else bad(`h8 「!!」가 판 안쪽으로 뒤집히지 않았다(${JSON.stringify(s.lastBrilliantTag)})`);
      if (sawMult) brillSeen.mult++; else bad('배수 칸에 「×2」가 붙지 않았다');
      if ((app.records.brilliants || 0) === recBefore + 1 && app.records.bestBrilliant) brillSeen.record++; else bad('기록에 탁월수가 남지 않았다');
    }
  }
  for (let k = 0; k < 20 && screen() !== 'shop' && screen() !== 'select'; k++) { pump(30); if (region('next')) click('next'); }
  app.toTitle(); pump(1);
}

// 새 특수 기물(CHM-55): 까마귀는 먹은 칸(e5) 너머(f6)에 앉아 그려지고, 화약병은 둘레 적을 터뜨리고 사슬이 끝난다. 한 수 연출(×1)을 잰다
// CHM-57: 까마귀는 잇따라 넘고(짧은 포물선 둘), 꺾쇠는 두 번 꺾은 길 · 물수제비는 튕긴 길로 움직이며 사슬 길도 꺾여 남는다
const fairySeen = { land: 0, path: 0, gone: 0, blast: 0, board: 0, hops: 0, bend: 0, bounce: 0, trail: 0, sec: [], bad: [] };
{
  const bad = (m) => fairySeen.bad.push(m);
  app.overlay = null; app.nextSeed = 15; app.newRun(); if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.goPhase(); pump(30);
  click('select:play'); pump(2);
  if (screen() !== 'battle') bad(`대국이 열리지 않았다(${screen()})`);
  else {
    idle();
    for (let n = 0; n < 200 && app.screen.banner; n++) pump(1);
    const b = app.run.battle, s = app.screen;
    const at = (n) => n.charCodeAt(0) - 97 + 8 * (Number(n[1]) - 1);
    // 까마귀: d4에 떨궈 e5 나이트를 넘어 f6에 앉는다(나이트가 되어 g4 폰까지)
    // (CHM-57) e7 비숍을 더 놓아 나이트가 된 뒤에도 넘어 d8에 앉는다 — 넘기 둘
    b.board = boardFrom({ h8: 'K', e5: 'N', e7: 'B' }); b.incoming = []; b.incomingNext = [];
    b.hand = ['V', 'D', 'T', 'E'].map((t, i) => ({ t, id: 960 + i, eng: null }));
    b.target = 1e9; b.movesLeft = Math.max(4, b.movesLeft);
    let lastMover = null;
    const watch = () => { const m = s.view.mover; if (m && m !== lastMover) { lastMover = m; if (m.route && m.route.kind === 'hop') fairySeen.hops++; } };
    s.sync(); pump(2);
    click('hand:0'); pump(1);
    s.seq.total = 0; s.seq.trace = [];
    click(`sq:${at('d4')}`); idle();
    click(`sq:${at('e5')}`);
    let landed = false;
    for (let n = 0; n < 600 && app.screen === s && s.busy; n++) {
      pump(1);
      const v = s.view;
      if (v.board[at('f6')] && v.board[at('f6')].mine && !v.board[at('e5')] && !v.mover) landed = true;
      if (v.chain && v.chain.path.includes(at('f6'))) fairySeen.path = 1;
      watch();
    }
    if (landed) fairySeen.land++; else bad('까마귀가 앉는 칸(f6)에 그려지지 않았다');
    if (!fairySeen.path) bad('사슬 길에 앉는 칸이 없다');
    for (let n = 0; n < 4 && b.status === 'chain' && b.chain && !b.chain.done; n++) { const l = chainCaptures(b); if (!l.length) break; click(`sq:${l.includes(at('e7')) ? at('e7') : l[0]}`); for (let k = 0; k < 600 && s.busy; k++) { pump(1); watch(); } }
    idle();
    measureSeq(s); fairySeen.sec.push(s.seq.total);
    if (fairySeen.hops < 2) bad(`까마귀가 잇따라 넘지 않았다(넘기 ${fairySeen.hops})`);
    const cap = (b.history.at(-1) || {});
    if (cap.piece === 'V' && b.board[at('e5')] == null) fairySeen.gone++; else bad(`까마귀 사슬 기록이 어긋났다(${JSON.stringify(cap)})`);
    // 화약병: d5에 떨궈 c6 나이트를 먹으면 b7 · c7 · d7이 함께 터지고 사슬이 끝난다
    if (b.status === 'play') {
      b.board = boardFrom({ h8: 'K', c6: 'N', b7: 'R', c7: 'P', d7: 'B' }); b.incoming = []; b.incomingNext = [];
      s.sync(); pump(2);
      const i = b.hand.findIndex((p) => p.t === 'D');
      click(`hand:${i}`); pump(1);
      s.seq.total = 0; s.seq.trace = [];
      click(`sq:${at('d5')}`); idle();
      click(`sq:${at('c6')}`);
      for (let n = 0; n < 600 && app.screen === s && s.busy; n++) pump(1);
      idle();
      measureSeq(s); fairySeen.sec.push(s.seq.total);
      const h = b.history.at(-1) || {};
      if (h.piece === 'D' && h.reason === 'blast') fairySeen.blast++; else bad(`화약병 사슬이 터짐으로 끝나지 않았다(${JSON.stringify(h)})`);
      if (['b7', 'c7', 'd7', 'c6'].every((n) => !b.board[at(n)]) && b.board[at('h8')]) fairySeen.board++; else bad('터진 칸이 비지 않았다');
    } else bad(`까마귀 뒤 대국이 둘 차례가 아니다(${b.status})`);
    // 꺾쇠(CHM-57): b2에 떨궈 e5 나이트를 먹는다 — 곧장 꺾는 칸 b5 · e2를 적이 막아 두 번 꺾는 길(c2 · c5)로 간다
    // 물수제비: c1에 떨궈 a3에서 튕겨 d6 룩을 먹는다
    for (const [t, drop, target, map, key] of [['T', 'b2', 'e5', { h8: 'K', e5: 'N', b5: 'P', e2: 'P' }, 'bend'], ['E', 'c1', 'd6', { h8: 'K', d6: 'R' }, 'bounce']]) {
      if (b.status !== 'play') { bad(`${t} 앞에서 대국이 둘 차례가 아니다(${b.status})`); break; }
      b.board = boardFrom(map); b.incoming = []; b.incomingNext = [];
      s.sync(); pump(2);
      const i = b.hand.findIndex((p) => p.t === t);
      if (i < 0) { bad(`손에 ${t}가 없다`); break; }
      click(`hand:${i}`); pump(1);
      s.seq.total = 0; s.seq.trace = [];
      click(`sq:${at(drop)}`); idle();
      click(`sq:${at(target)}`);
      let corners = 0, trail = false;
      for (let n = 0; n < 600 && app.screen === s && s.busy; n++) {
        pump(1);
        const v = s.view, m = v.mover;
        if (m && m.route && m.route.kind === 'bend') corners = Math.max(corners, m.route.pts.length - 2);
        if (v.chain && (v.chain.bends || []).some((x) => x && x.length)) trail = true;
      }
      for (let n = 0; n < 4 && b.status === 'chain' && b.chain && !b.chain.done; n++) { const l = chainCaptures(b); if (!l.length) break; click(`sq:${l[0]}`); for (let k = 0; k < 600 && s.busy; k++) pump(1); }
      idle();
      measureSeq(s); fairySeen.sec.push(s.seq.total);
      if (corners >= (t === 'T' ? 2 : 1)) fairySeen[key]++; else bad(`${t}가 꺾인 길로 움직이지 않았다(꺾음 ${corners})`);
      if (trail) fairySeen.trail++; else bad(`${t}의 사슬 길이 꺾여 남지 않았다`);
    }
  }
  for (let k = 0; k < 20 && screen() !== 'shop' && screen() !== 'select'; k++) { pump(30); if (region('next')) click('next'); }
  app.toTitle(); pump(1);
}

// 처음 켠 사람이 수업을 건너뛴다 → 곧바로 1관 · 처음 안내를 끄면 뜨지 않는다
let skipOk = false;
// 처음 켠 사람이 대본 대국을 건너뛴다 → 평범한 1관 연습 · 처음 안내를 끄면 뜨지 않는다
const hintFail = ['shop', 'pack', 'draft', 'family'].filter((id) => !hintsShown.has(id) || !app.records.coachSeen[id]);
const mainApp = app;
{
  seen();
  app.pointer = () => {}; app.key = () => {};
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  app = await boot({ window: dom.window, document: dom.document, today: () => DATE, rankBase: '' });
  apps.push(app);
  app.onError = (e) => { errors.push(e); console.error(e); };
  pump(2);
  if (screen() !== 'title') throw new Error('fresh boot did not open the title');
  click('title:new');
  for (let n = 0; n < 600 && app.guide && app.guide.hold(app); n++) pump(1);
  pump(2);
  if (!app.guide || !region('guide:skip')) throw new Error('scripted battle has no skip');
  click('guide:skip');
  pump(2);
  if (app.guide || screen() !== 'battle' || !app.run.battle || app.run.battle.script || app.run.ante !== 1 || app.run.battle.target !== targetFor(1, 'practice')) throw new Error('skip did not start a plain practice battle');
  app.settings.coach = false;
  for (let n = 0; n < 200; n++) { pump(1); if (app.hintShown) throw new Error('hint shown while off'); }
  // 행마 보기는 평범한 대국에서도 열린다
  click('btn:moves');
  if (screen() !== 'moves') throw new Error('moves overlay did not open in a plain battle');
  // 탭 셋(CHM-26): 이 판 → 기본 기물 → 특수 기물, 쪽이 있으면 끝까지 넘긴다. 그리는 동안 글 넘침 · 테를 잰다(pump)
  if (app.overlay.tab !== 'board') throw new Error('moves overlay did not open on the board tab');
  for (const tab of ['board', 'basic', 'fairy']) {
    click(`moves:tab:${tab}`); pump(3);
    const cards = LL.LOG.boxes.filter((b) => /^행마 [A-Z]$/.test(b.name || '')).length;
    let pages = 1;
    for (let n = 0; n < 6 && region('moves:next') && region('moves:next').enabled; n++) { click('moves:next'); pump(3); pages++; }
    if (app.overlay.tab !== tab || !cards) throw new Error(`moves tab ${tab} did not show cards`);
    movesTabs.push(`${tab} ${cards}장 · 쪽 ${pages}`);
  }
  click('moves:back');
  skipOk = true;
  log('  대본 대국 건너뛰기 · 안내 끄기 확인');
  seen();
  app = mainApp;
}
// ── 대본 대국의 경로마다(CHM-36): 새로 켠 앱에서 경로를 지나 보상 → 상점 → 레퍼토리 → 1관 정식 관 선택까지,
// 뜬 처음 안내를 차례로 적는다. 안내가 말하는 것이 화면에 없으면 hintSubject가 어긋남으로 잡는다.
const paths = { rows: [], bad: [] };
async function freshBoot() {
  seen();
  app.pointer = () => {}; app.key = () => {};
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  await start();
  if (screen() !== 'title') throw new Error('fresh boot did not open the title');
}
// 아무 구역도 · 말풍선도 없는 빈 곳을 눌러 안내를 닫는다(누른 것이 아무 일도 하지 않게)
function dismissHint() {
  const inR = (x, y, r) => r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  for (let y = 266; y > 4; y -= 6) for (let x = 4; x < 476; x += 6) {
    if (app.ui.regions.some((r) => inR(x, y, r)) || inR(x, y, app.hintRect)) continue;
    dom.mouse('mousemove', x, y); dom.mouse('mousedown', x, y); dom.mouse('mouseup', x, y); pump(1);
    return;
  }
  throw new Error('no blank spot to dismiss a hint');
}
// 지금 화면에서 뜨는 안내를 차례로 보고 닫는다
function hintsHere() {
  const ids = [];
  for (let k = 0; k < 8; k++) {
    for (let n = 0; n < 90 && !app.hintShown; n++) pump(1);
    if (!app.hintShown) break;
    ids.push(app.hintShown.id);
    dismissHint(); pump(2);
  }
  return ids;
}
// 대본 걸음을 k째 걸음 앞까지(걸음대로 누른다)
function advanceScript(k = Infinity) {
  const s = app.screen;
  for (let n = 0; n < 200 && app.guide; n++) {
    for (let j = 0; j < 900 && app.guide && app.guide.hold(app); j++) pump(1);
    idle();
    if (!app.guide || app.guide.i >= k) break;
    pump(2);
    const st = app.guide.steps[app.guide.i], step = s.step;
    if (st.ok) { click('guide:ok'); continue; }
    click(st.target(app));
    if (step && step.moves) { pump(2); click('moves:back'); }
  }
}
// 대국이 끝난 뒤: 보상 → 상점(사지 않고 떠난다) → 레퍼토리 → 관 선택. 상점마다 진열에 격언이 있었나와 뜬 안내를 적는다.
// 1관 정식 관 선택에 닿거나 상점 shops개를 지나면 멈춘다(그 전 대국은 봇이 둔다)
function walkShops(name, { until = 'select', shops = 1 } = {}) {
  const out = [];
  let lastShop = null, seenShops = 0;
  for (let steps = 0; steps < 600; steps++) {
    const sc = screen();
    if (sc === 'result') break;
    if (sc === 'battle') { idle(); if (app.screen.name === 'battle' && app.run.battle) battleStep(); else pump(1); continue; }
    if (sc === 'reward' || sc === 'chest' || sc === 'legend') { click('next'); pump(1); if (screen() === sc && region('next')) click('next'); continue; }
    if (sc === 'awaken') { pump(60); if (region('next')) click('next'); else pump(60); continue; }
    if (sc === 'pause') { click('pause:resume'); continue; }
    if (sc === 'shop') {
      const key = `${app.run.ante}:${app.run.blind}`;
      if (key !== lastShop) {
        lastShop = key; seenShops++;
        const maxim = app.run.shop.display.some((it) => it.kind === 'maxim' && !it.sold);
        out.push({ where: `상점 ${key}`, maxim, ids: hintsHere() });
      }
      click('shop:leave'); pump(2);
      if (until === 'shopHint' && (out.some((o) => o.ids.includes('shop')) || seenShops >= shops)) break;
      continue;
    }
    if (sc === 'pack') { click('pack:skip'); continue; }
    if (sc === 'draft') { if (app.screen.chosen) { pump(10); continue; } pump(40); out.push({ where: '레퍼토리', ids: hintsHere() }); if (screen() === 'draft' && region('draft:0')) click('draft:0'); pump(30); continue; }
    if (sc === 'select') {
      if (until === 'select' && app.run.ante === 1 && app.run.blind >= 1) { out.push({ where: `관 선택 ${app.run.ante}:${app.run.blind}`, ids: hintsHere() }); break; }
      pump(30); hintsHere(); click('select:play'); pump(2); continue;
    }
    throw new Error(`${name}: stuck on ${sc}`);
  }
  return out;
}
const fmtPath = (out) => out.map((o) => `${o.where}${o.maxim === false ? '(격언 없음)' : o.maxim ? '(격언)' : ''} [${o.ids.join(' ') || '-'}]`).join(' → ');
function checkShops(name, out, { firstNoMaxim = false } = {}) {
  const shops = out.filter((o) => o.where.startsWith('상점'));
  for (const o of shops) if (!o.maxim && o.ids.includes('shop')) paths.bad.push(`${name}: 격언 없는 ${o.where}에 격언 안내`);
  const first = shops.find((o) => o.maxim);
  if (first && !first.ids.includes('shop')) paths.bad.push(`${name}: 격언이 처음 보인 ${first.where}에 격언 안내가 없다`);
  if (firstNoMaxim && (!shops.length || shops[0].maxim)) paths.bad.push(`${name}: 첫 상점에 격언이 없는 장면을 못 만들었다`);
  const ids = out.flatMap((o) => o.ids);
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (twice.length) paths.bad.push(`${name}: 같은 안내 두 번 ${twice.join(' ')}`);
  paths.rows.push(`${name}: ${fmtPath(out)}`);
}
{
  // ② 걸음마다 건너뛰기: 첫 걸음 · 손 들기 · 사슬 한가운데 · 복사본(한 번 끊겨 보기) · 되돌리기 앞 · 증원 · 행마 · 넷째 수
  await freshBoot();
  const at = [0, 1, 3, 4, 7, 8, 9, 14, 15, 21, 25];
  const ok = [];
  for (const k of at) {
    app.newRun({ script: true });
    advanceScript(k);
    pump(2);
    if (!app.guide || app.guide.i !== k || !region('guide:skip')) { paths.bad.push(`건너뛰기 ${k}: 그 걸음에 닿지 못함(${app.guide ? app.guide.i : '길 없음'})`); app.toTitle(); pump(1); continue; }
    click('guide:skip'); pump(2);
    const b = app.run.battle;
    if (app.guide || screen() !== 'battle' || !b || b.script || b.target !== targetFor(1, 'practice') || app.run.ante !== 1 || b.movesUsed !== 0 || app.screen.hold) paths.bad.push(`건너뛰기 ${k}: 평범한 1관 연습이 아니다`);
    else ok.push(k);
    app.toTitle(); pump(1);
  }
  paths.rows.push(`걸음마다 건너뛰기: ${ok.length}/${at.length} (걸음 ${ok.join(' · ')})`);
  // ② 건너뛰기 → 진열에 격언이 없는 첫 상점(시드 6) → 격언이 처음 보이는 상점
  await freshBoot();
  app.nextSeed = 6;
  click('title:new');
  advanceScript(0);
  click('guide:skip'); pump(2);
  checkShops('건너뛰기 → 상점', walkShops('skip', { until: 'shopHint', shops: 6 }), { firstNoMaxim: true });
  // ① 끝까지 두기는 firstPlay. 건너뛰기 뒤 1관 정식 관 선택까지(시드 6, 새로 켠 앱)
  await freshBoot();
  app.nextSeed = 6;
  click('title:new');
  advanceScript(0);
  click('guide:skip'); pump(2);
  checkShops('건너뛰기 → 관 선택', walkShops('skip-select'));
  // ③ 대본 중 멈춤 → 타이틀로 → 이어 하기 → 끝까지 → 관 선택
  await freshBoot();
  click('title:new');
  advanceScript(8);
  dom.key('Escape'); pump(1); click('pause:title');
  click('title:continue');
  for (let n = 0; n < 900 && app.guide && app.guide.hold(app); n++) pump(1);
  if (!app.guide || !app.run.battle || !app.run.battle.script) paths.bad.push('이어 하기: 대본으로 돌아오지 않았다');
  advanceScript();
  const resumed = walkShops('resume');
  checkShops('멈춤 → 이어 하기', resumed);
  // ④ 같은 앱에서 설정 「킹과 다시 두기」 → 다시 대본(본 안내는 다시 뜨지 않는다)
  app.toTitle(); pump(1);
  click('title:settings'); click('set:king'); click('set:back'); pump(1);
  click('title:new');
  if (!app.guide || !app.run.battle || !app.run.battle.script) paths.bad.push('킹과 다시 두기: 대본이 열리지 않았다');
  advanceScript();
  const again = walkShops('again');
  const before = new Set(resumed.flatMap((o) => o.ids));
  const rep = again.flatMap((o) => o.ids).filter((id) => before.has(id));
  if (rep.length) paths.bad.push(`킹과 다시 두기: 본 안내가 또 떴다 ${rep.join(' ')}`);
  paths.rows.push(`킹과 다시 두기: ${fmtPath(again)}`);
  app.toTitle(); pump(1);
  seen();
  app = mainApp;
}
// ── 기록 보내기 알림(CHM-63): 새로 켠 첫 화면 맨 위에 한 줄 → 누르면 사라지고 다시 안 뜬다 → 설정에서 끄면 처음부터 안 뜬다
const telNote = { shown: 0, gone: 0, again: 0, off: 0 };
{
  const mainApp = app;
  const noteBox = () => LL.LOG.boxes.some((b) => b.name === '기록 알림');
  await freshBoot(); pump(2);
  if (app.screen.noteOn() && noteBox()) telNote.shown = 1;
  dismissHint(); pump(2);
  if (!noteBox() && app.records.coachSeen && app.records.coachSeen.telemetry) telNote.gone = 1;
  app.go('title'); pump(2);
  if (!noteBox()) telNote.again = 1;
  await freshBoot(); app.settings.telemetry = false; pump(2);
  if (!noteBox()) telNote.off = 1;
  seen();
  app.pointer = () => {}; app.key = () => {};
  app = mainApp;
}

// ── 순위의 다른 상태(CHM-70): 새로 켠 앱에서 오늘 아직 안 둔 사람의 순위 화면(「오늘의 대국 두기」) · 서버에 닿지 못할 때(한 줄, 알림 없음)
{
  const mainApp = app;
  const { L } = await import('../src/ui/lang.js');
  const drew = (ko) => LL.LOG.texts.some((q) => q.s === L(ko));
  await freshBoot(); pump(2);
  click('title:rank'); pump(2); await netSettle(); pump(3);
  if (screen() === 'rank' && region('rank:play') && drew('오늘은 아직 플레이하지 않았어요') && !region('rank:mine')) rankSeen.unplayed = 1; else rankSeen.bad.push('오늘 안 둔 사람의 순위 화면이 어긋났다');
  click('rank:play'); pump(2);
  if (app.run && app.run.daily === DATE && Array.isArray(app.run.cmds)) rankSeen.play = 1; else rankSeen.bad.push('「오늘의 대국 두기」가 오늘의 대국을 열지 않았다');
  app.toTitle(); pump(1);
  rankApi.mode = 'fail';
  await freshBoot(); pump(2);
  click('title:rank'); pump(2); await netSettle(); pump(3);
  if (screen() === 'rank' && drew('순위를 불러오지 못했어요') && !region('rank:play') && !app.toasts.length) rankSeen.unreached = 1; else rankSeen.bad.push('닿지 못할 때의 순위 화면이 어긋났다');
  click('rank:tab:yesterday'); pump(2); await netSettle(); pump(3);
  if (!drew('순위를 불러오지 못했어요') || app.toasts.length) rankSeen.bad.push('닿지 못할 때 어제 탭이 어긋났다');
  click('rank:back'); pump(2);
  if (screen() !== 'title') rankSeen.bad.push(`닿지 못한 순위 화면에서 돌아가기 → ${screen()}`);
  rankApi.mode = 'ok';
  seen();
  app.pointer = () => {}; app.key = () => {};
  app = mainApp;
}

// ── 기기 잇기(CHM-71): 기기 둘(가짜 서버 하나 + 앱 둘 — 저장은 따로)로 코드 받기 → 넣기 → 같은 이름 → 한쪽에서 판을 두고 → 다른 쪽을 다시 켜면
// 기록 · 진행 중인 판이 보이는가(첫 화면 「이어 하기」가 그 판을 연다). 끝에 이 기기 떼기. 저장 덩이 올리기의 크기도 잰다
const linkSeen = { code: 0, typed: 0, name: '', same: 0, back: 0, run: '', cont: 0, records: '', line: 0, unlink: 0, frames: 0, flow: [], bad: [] };
{
  const mainApp = app;
  const bad = (m) => linkSeen.bad.push(m);
  const calm = (a) => { a.records.kingDone = true; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true }; a.saveRecords(); };
  await freshBoot(); calm(app); pump(2);
  const A = app;
  // 둘째 기기: 제 저장을 가진 가짜 DOM
  const domB = makeFakeDom({ width: 1366, height: 700, dpr: 1.25 });
  domB.window.fetch = dom.window.fetch; domB.window.navigator = dom.window.navigator;
  if (LANG !== 'ko') domB.store.set('chainmate.settings.v1', JSON.stringify({ lang: LANG }));
  let B = null, tB = 0;
  const bootB = async () => { if (B) { B.pointer = () => {}; B.key = () => {}; } B = await boot({ window: domB.window, document: domB.document, today: () => DATE, rankBase: '' }); apps.push(B); B.onError = (e) => { errors.push(e); console.error(e); }; };
  const frameB = (n = 1) => { for (let i = 0; i < n; i++) { tB += 1000 / 60; domB.frame(tB); linkSeen.frames++; for (const q of LL.checkLayout()) if (!linkSeen.flow.includes(q.msg)) linkSeen.flow.push(q.msg); } };
  const regionB = (id) => B.ui.regions.find((r) => r.id === id);
  const clickB = (id) => { const r = regionB(id); if (!r) throw new Error(`둘째 기기: no region ${id} on ${B.overlay ? B.overlay.name : B.screen.name}`); const gx = r.x + (r.w >> 1), gy = r.y + (r.h >> 1); domB.mouse('mousemove', gx, gy); domB.mouse('mousedown', gx, gy); domB.mouse('mouseup', gx, gy); frameB(1); };
  const drew = (ko) => LL.LOG.texts.some((q) => q.s === L(ko) || q.s.startsWith(L(ko)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await bootB(); calm(B); frameB(2);
  // A: 설정 → 기기 잇기 → 코드 받기
  click('title:settings'); pump(1); click('set:link'); pump(1); click('acct:tab:link'); pump(2);
  if (screen() !== 'link') bad(`설정의 기기 잇기 → ${screen()}`);
  click('link:code'); pump(1); await netSettle(24); pump(2);
  const code = A.screen.mine && A.screen.mine.code;
  if (/^\d{8}$/.test(code || '') && LL.LOG.texts.some((q) => q.s === `${code.slice(0, 4)} ${code.slice(4)}`) && drew('다른 기기에서 이 코드를 입력하세요')) linkSeen.code = 1; else bad('코드 받기가 큰 숫자를 띄우지 않았다');
  // B: 설정 → 기기 잇기 → 숫자판으로 넣기 → 확인 → 이어졌다
  clickB('title:settings'); clickB('set:link'); clickB('acct:tab:link'); frameB(2);
  for (const d of code || '') { clickB(`link:key:${d}`); linkSeen.typed++; }
  clickB('link:key:go'); frameB(1);
  if (!regionB('link:yes') || !regionB('link:no') || regionB('link:key:1')) bad('잇기 전 확인이 뜨지 않았다');
  clickB('link:yes'); await netSettle(36); frameB(3);
  linkSeen.name = A.rank.player() ? A.rank.player().name : '';
  if (B.screen.entry.phase === 'done' && B.rank.player() && B.rank.player().name === linkSeen.name && drew('연결됐어요') && LL.LOG.texts.some((q) => q.s === linkSeen.name)) linkSeen.same = 1; else bad(`넣은 기기가 같은 이름이 되지 않았다(${B.screen.entry.phase} · ${B.screen.entry.fail})`);
  // A: 띄워 둔 코드가 쓰인 것을 몇 초 안에 안다
  for (let i = 0; i < 4 && A.screen.mine.phase !== 'linked'; i++) { pump(330); await netSettle(24); pump(2); }
  await netSettle(24); pump(2);
  if (A.screen.mine.phase === 'linked' && A.screen.devices === 2 && drew('연결됐어요') && drew('기기 2대 연결됨')) linkSeen.back = 1; else bad('코드를 낸 기기가 이어진 것을 알지 못했다');
  click('link:back'); pump(2);
  if (screen() !== 'title') bad(`기기 잇기에서 돌아가기 → ${screen()}`);
  // A: 판 하나를 끝까지 두고(기록), 새 판을 첫 상점 뒤 관 선택까지 둔다(진행 중인 판)
  const play = (stop) => {
    for (let guard = 0; guard < 5000 && app.run.phase !== 'lost' && app.run.phase !== 'won' && !stop(app.run); guard++) {
      const ph = app.run.phase;
      if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
      else if (ph === 'select') app.cmd({ type: 'play' });
      else if (ph === 'battle') { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; }
      else if (ph === 'shop') app.cmd({ type: 'leave' });
      else if (ph === 'pack') app.cmd({ type: 'skipPack' });
    }
  };
  app.newRun({ seed: 1000003 }); play(() => false);
  app.goPhase(); pump(3);
  app.toTitle(); pump(1);
  app.newRun({ seed: 77 });
  let shops = 0;
  play((r) => r.phase === 'shop' && shops++ > 0);
  if (app.run.phase === 'shop') app.cmd({ type: 'leave' });
  const mine = { seed: app.run.seed, ante: app.run.ante, blind: app.run.blind, phase: app.run.phase, money: app.run.money, deck: app.run.deck.length };
  linkSeen.run = `${mine.ante}관 ${mine.blind + 1}번째 대국 ${mine.phase} · $${mine.money}`;
  app.toTitle(); pump(1);
  // 화면이 가려질 때 올린다(15초 묶음을 기다리지 않는다)
  await wait(5); dom.emit('pagehide'); await netSettle(36);
  // B: 다시 켠다 → 당겨 온다 → 첫 화면의 「이어 하기」가 그 판을 연다
  await bootB(); await netSettle(36); frameB(3);
  if (!regionB('title:continue')) bad('다른 기기의 진행 중인 판이 첫 화면에 보이지 않는다');
  else {
    clickB('title:continue'); frameB(2);
    const r = B.run;
    if (r && r.seed === mine.seed && r.ante === mine.ante && r.blind === mine.blind && r.phase === mine.phase && r.money === mine.money && r.deck.length === mine.deck && B.screen.name === 'select') linkSeen.cont = 1;
    else bad(`이어 하기가 다른 판을 열었다(${r ? `${r.seed} ${r.ante}관 ${r.phase}` : '없음'})`);
    B.toTitle(); frameB(1);
  }
  const cells = (rec) => Object.values(rec.codex).reduce((n, k) => n + Object.values(k).filter(Boolean).length, 0);
  clickB('title:records'); frameB(2);
  linkSeen.records = `판 ${B.records.runs} · 도감 ${cells(B.records)}칸 · 도달한 관 ${B.records.bestAnte}`;
  if (!(B.screen.name === 'records' && A.records.runs >= 1 && B.records.runs === A.records.runs && cells(B.records) === cells(A.records) && cells(B.records) > 1 && B.records.bestAnte === A.records.bestAnte && LL.LOG.texts.some((q) => q.s === `${A.records.runs}`))) bad(`다른 기기의 기록이 같지 않다(이쪽 판 ${A.records.runs} · 도감 ${cells(A.records)} / 저쪽 ${linkSeen.records})`);
  B.toTitle(); frameB(1);
  // B: 아래 한 줄 · 이 기기 떼기
  clickB('title:settings'); clickB('set:link'); clickB('acct:tab:link'); await netSettle(24); frameB(2);
  if (drew('기기 2대 연결됨') && regionB('link:unlink')) linkSeen.line = 1; else bad('이어진 기기 줄이 보이지 않는다');
  if (regionB('link:unlink')) { clickB('link:unlink'); frameB(1); clickB('link:unlink:yes'); await netSettle(24); frameB(2); }
  if (B.screen.devices === 1 && !regionB('link:unlink') && (await A.rank.devices()) === 1) linkSeen.unlink = 1; else bad('이 기기 떼기가 되지 않았다');
  for (const v of B.visited) visited.add(v);
  B.pointer = () => {}; B.key = () => {};
  seen();
  app.pointer = () => {}; app.key = () => {};
  app = mainApp;
}

// ── 계정(CHM-72): 기기 둘(가짜 서버 하나 + 앱 둘 — 저장은 따로)로 만들기 → 다른 기기에서 들어오기 → 같은 이름 · 기록 → 비번 바꾸기 → 나가기(기록 비움) → 지우기.
// 글자는 가짜 DOM의 입력 칸에 친다(input 사건). 화면을 떠난 뒤 남은 입력 칸은 0이어야 한다
const acctSeen = { made: 0, fields: 0, keys: 0, name: '', same: 0, records: '', changed: 0, out: 0, kept: 0, gone: 0, left: -1, frames: 0, flow: [], bad: [] };
{
  const mainApp = app;
  const bad = (m) => acctSeen.bad.push(m);
  const calm = (a) => { a.records.kingDone = true; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true }; a.saveRecords(); };
  const PW = 'moonlit-rook-42', PW2 = 'second-knight-77', USER = 'smoke_user';
  await freshBoot(); calm(app); pump(2);
  const A = app;
  Object.assign(A.records, { runs: 6, bestAnte: 5 }); A.records.codex.maxims = { m1: true, m2: true }; A.saveRecords();
  const domB = makeFakeDom({ width: 1366, height: 700, dpr: 1.25 });
  domB.window.fetch = dom.window.fetch; domB.window.navigator = dom.window.navigator;
  if (LANG !== 'ko') domB.store.set('chainmate.settings.v1', JSON.stringify({ lang: LANG }));
  let tB = 0;
  const B = await boot({ window: domB.window, document: domB.document, today: () => DATE, rankBase: '' });
  apps.push(B); B.onError = (e) => { errors.push(e); console.error(e); };
  const frameB = (n = 1) => { for (let i = 0; i < n; i++) { tB += 1000 / 60; domB.frame(tB); acctSeen.frames++; for (const q of LL.checkLayout()) if (!acctSeen.flow.includes(q.msg)) acctSeen.flow.push(q.msg); } };
  const clickB = (id) => { const r = B.ui.regions.find((q) => q.id === id); if (!r) throw new Error(`둘째 기기: no region ${id} on ${B.overlay ? B.overlay.name : B.screen.name}`); const gx = r.x + (r.w >> 1), gy = r.y + (r.h >> 1); domB.mouse('mousemove', gx, gy); domB.mouse('mousedown', gx, gy); domB.mouse('mouseup', gx, gy); frameB(1); };
  const drew = (ko) => LL.LOG.texts.some((q) => q.s === L(ko) || q.s.startsWith(L(ko)));
  const inputs = () => dom.inputs().length + domB.inputs().length;
  calm(B); frameB(2);
  // A: 설정 → 계정 → 아이디 · 비번을 치고 [계정 만들기]
  click('title:settings'); pump(1); click('set:link'); pump(2);
  if (screen() !== 'account') bad(`설정의 계정 → ${screen()}`);
  acctSeen.fields = dom.inputs().length;
  if (acctSeen.fields !== 2 || dom.inputs().some((el) => !el.attrs.autocomplete || el.attrs.autocapitalize !== 'off')) bad('계정 화면의 입력 칸 둘(아이디 · 비번)이 없다');
  // 초점 동안 게임은 키를 받지 않는다: 빈칸 · Enter에 화면이 바뀌지 않고, Esc는 초점만 푼다
  dom.type('user', USER);
  for (const k of [' ', 'Enter', '1', 'ArrowLeft']) dom.key(k);
  pump(1);
  dom.key('Escape'); pump(1);
  if (screen() === 'account' && A.fields.focused() == null && dom.inputs().length === 2) acctSeen.keys = 1; else bad(`입력 칸에 초점이 있는데 게임이 키를 받았다(${screen()})`);
  dom.type('user', USER); dom.type('pass', PW);
  click('acct:signup'); await netSettle(40); pump(2);
  if (A.screen.in() && drew('계정을 만들었어요') && LL.LOG.texts.some((q) => q.s === USER) && dom.inputs().length === 0) acctSeen.made = 1; else bad(`계정을 만들지 못했다(${A.screen.msg && A.screen.msg.text})`);
  await A.cloud.push(); await netSettle(24);
  acctSeen.name = A.rank.player() ? A.rank.player().name : '';
  // B: 설정 → 계정 → [들어오기] → 같은 이름 · 기록
  clickB('title:settings'); clickB('set:link'); frameB(2);
  domB.type('user', USER); domB.type('pass', PW);
  clickB('acct:login'); await netSettle(60); frameB(3);
  const cells = (a) => Object.values(a.records.codex).reduce((n, k) => n + Object.values(k).filter(Boolean).length, 0);
  acctSeen.records = `판 ${B.records.runs} · 도감 ${cells(B)}칸 · 도달한 관 ${B.records.bestAnte}`;
  if (B.screen.in() && B.rank.player() && B.rank.player().name === acctSeen.name && B.records.runs === A.records.runs && cells(B) === cells(A) && B.records.bestAnte === 5 && drew('로그인했어요')) acctSeen.same = 1; else bad(`들어온 기기가 같은 이름 · 기록이 되지 않았다(${B.screen.msg && B.screen.msg.text} · ${acctSeen.records})`);
  // B: 비번 바꾸기
  clickB('acct:password'); frameB(1);
  domB.type('cur', PW); domB.type('next', PW2);
  clickB('acct:yes'); await netSettle(40); frameB(2);
  if (B.screen.mode == null && drew('비밀번호를 바꿨어요') && domB.inputs().length === 0) acctSeen.changed = 1; else bad(`비번을 바꾸지 못했다(${B.screen.msg && B.screen.msg.text})`);
  // B: 나가기 → 확인 → 이 기기의 기록이 비고, 계정(A)에는 남는다
  clickB('acct:logout'); frameB(1);
  if (B.screen.mode !== 'logout' || !B.ui.regions.some((q) => q.id === 'acct:no')) bad('나가기 확인이 뜨지 않았다');
  clickB('acct:yes'); await netSettle(60); frameB(2);
  if (!B.screen.in() && B.records.runs === 0 && cells(B) === 1 && !domB.store.get('chainmate.run.v1') && drew('로그아웃했어요')) acctSeen.out = 1; else bad(`나간 뒤에도 기기에 기록이 남았다(판 ${B.records.runs} · 도감 ${cells(B)}칸)`);
  await A.cloud.open(); await netSettle(24);
  const acct = await A.rank.accountLoad();
  if (A.records.runs === 6 && acct && acct.username === USER && acct.devices === 1) acctSeen.kept = 1; else bad('나간 뒤 계정 쪽 기록이 달라졌다');
  B.toTitle(); frameB(2);
  // A: 계정 지우기 → 확인 둘 + 비번
  click('acct:delete'); pump(1); click('acct:yes'); pump(1);
  if (dom.inputs().length !== 1) bad('지우기 둘째 확인에 비번 칸이 없다');
  dom.type('del', PW2);
  click('acct:yes'); await netSettle(60); pump(2);
  if (!A.screen.in() && rankApi.store.accounts.size === 0 && A.records.runs === 0 && drew('계정을 삭제했어요')) acctSeen.gone = 1; else bad(`계정을 지우지 못했다(${A.screen.msg && A.screen.msg.text} · 계정 ${rankApi.store.accounts.size})`);
  click('acct:back'); pump(2);
  if (screen() !== 'title') bad(`계정에서 돌아가기 → ${screen()}`);
  acctSeen.left = inputs();
  // 비번은 어디에도 남지 않는다(두 기기의 저장)
  const kept = JSON.stringify([...dom.store.entries()]) + JSON.stringify([...domB.store.entries()]);
  if (kept.includes(PW) || kept.includes(PW2) || kept.includes(USER)) bad('아이디 · 비번이 기기의 저장에 남았다');
  for (const v of B.visited) visited.add(v);
  B.pointer = () => {}; B.key = () => {};
  seen();
  app.pointer = () => {}; app.key = () => {};
  app = mainApp;
}

seen();
const need = ['title', 'lesson', 'lessons', 'setup', 'select', 'battle', 'reward', 'chest', 'shop', 'pack', 'result', 'pause', 'settings', 'legend', 'codex', 'records', 'moves', 'review', 'rank', 'link', 'account', 'highlight'];
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
console.log(`첫 판 대본 대국: 걸음 ${scriptSeen.steps} · 행마 보기 ${scriptSeen.moves} · 되돌리기 ${scriptSeen.rewind} · 엉뚱한 곳 막힘 ${scriptSeen.blocked > 0 ? '확인' : '못 함'} · ${scriptSeen.won ? '승리' : '못 이김'} ${scriptSeen.score}/${scriptSeen.target} · 뒤 처음 안내(상점) ${scriptSeen.shop ? '확인' : '못 봄'} · 1관 정식 관 선택 농민군 안내 ${scriptSeen.faction ? '확인' : '못 봄'}${scriptSeen.bad.length ? ` · 어긋남 ${scriptSeen.bad.join(' | ')}` : ''}`);
console.log(`행마 보기 탭: ${movesTabs.join(' · ') || '못 봄'}`);
console.log(`첫 수업: ${lessonLog.join(' · ')}`);
console.log(`미리 보기: 먹기 ${pvSeen.capture} · 끊김 ${pvSeen.cut} · 떨구기 ${pvSeen.drop} · 화살표 ${pvSeen.kb} · 터치 ${pvSeen.touch}`);
console.log(`말풍선: 증원 ${tipSeen.incoming} · 노림수 ${tipSeen.forced} · 판의 길 ${tipSeen.path}`);
console.log(`대국 띠 「새로」: 대국 ${newsSeen.battles} · 그림 ${newsSeen.icons}`);
console.log(`손 고르기: 둘을 차례로 ${pickSeen.swap}(둘 이상 남음 ${pickSeen.swapBad}) · 다시 눌러 놓기 ${pickSeen.off}(안 놓임 ${pickSeen.offBad})`);
console.log(`판 위 사물 말풍선: 발판 ${objTips.step} · 문 ${objTips.gate} · 고속도로 ${objTips.highway} · 벽 ${objTips.wall} · 보석 ${objTips.gem} · 함정 ${objTips.trap}`);
console.log(`시계 · 다시 놓기: 시계를 잃고 상점 ${n2.clockLost} → ${n2.clockShop} → 다음 대국 ${n2.clockNext}(어긋남 ${n2.clockBad.length}${n2.clockBad.length ? ': ' + n2.clockBad.join(' | ') : ''}) · 다시 놓기${reboardOn() ? '' : '(끔)'} ${n2.reboard}(봇 ${n2.reboardBot}, 어긋남 ${n2.reboardBad})`);
{ const fr = rvSeen.frames.slice().sort((a, b) => a - b); console.log(`복기: 진 대국 ${rvSeen.lost} · 카드 ${rvSeen.cards}(길 ${rvSeen.kinds.path} · 길 없음 ${rvSeen.kinds.none} · 찾지 못함 ${rvSeen.kinds.unknown}) · 복기 중 프레임 p50 ${fr[fr.length >> 1] ?? '-'} · 최대 ${fr[fr.length - 1] ?? '-'} · 다시 두기 ${rvSeen.replays}(끝까지 이김 ${rvSeen.won} · ◀ ${rvSeen.back} · 키 ${rvSeen.keys}) · 넘어가기 ${rvSeen.moveon}${rvSeen.unk.length ? ` · 찾지 못한 대국 ${rvSeen.unk.join(', ')}` : ''} · 기록 본 수 ${app.records.reviews || 0} · 다시 두기 ${app.records.reviewReplays || 0}${rvSeen.bad.length ? ' · 어긋남 ' + rvSeen.bad.join(' | ') : ''}`); }
console.log(`이어 하기: ${reloaded ? '확인' : '못 함'} · 설정: ${settingsSeen ? '확인' : '못 함'} · 격언 끌기: ${draggedMaxim ? '확인' : '못 함'}`);
console.log(`판 위 표시: 칸 · 화살표 ${marksSeen.board} · 왼쪽 누르기로 지움 ${marksSeen.clear ? '확인' : '못 함'} · 상점 오른쪽 누르기 ${marksSeen.shop}(아무 일 없음)`);
console.log(`사슬 중 목표를 넘긴 채 먹기: ${passSeen.n}번 · 입력이 막힘 ${passSeen.blocked}`);
console.log(`관 선택 → 상점 → 관 선택: ${shopBack.trips}번 · 바뀐 것 ${shopBack.changed} · 상점 없이 단추 ${shopBack.stray} · 판의 길과 겹침 ${shopBack.overlap}`);
console.log(`소리 마디 ${dom.audioCalls.nodes}`);
console.log(`예외 ${errors.length} · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
let fail = false;
const fairyPages = (await import('../src/ui/screens/moves.js')).movesPages((await import('../src/data/pieces.js')).FAIRIES.length);
if (movesTabs.length !== 3 || movesTabs[2] !== `fairy ${fairyPages.per}장 · 쪽 ${fairyPages.pages}`) { console.log('행마 보기 탭 셋을 다 넘기지 못했다'); fail = true; }
console.log(`세력: 판 ${facSeen.runs}개 · 서로 다른 차례 ${facSeen.orders.size} · 대국에서 만난 세력 ${facSeen.met.size}(${[...facSeen.met].join(' ')}) · 관 선택 세력 띠 ${facSeen.band} · 다음 관 문장 ${facSeen.next} · 어긋남 ${facSeen.bad.length}${facSeen.bad.length ? ': ' + facSeen.bad.slice(0, 5).join(' | ') : ''}`);
if (facSeen.met.size < 5 || facSeen.orders.size < Math.min(2, facSeen.runs) || facSeen.bad.length) { console.log('세력이 다섯 넘게 나오지 않았거나, 판마다 차례가 같거나, 관 선택에 세력이 안 보였다'); fail = true; }
if (!pickSeen.swap || !pickSeen.off || pickSeen.swapBad || pickSeen.offBad) { console.log('손에서 기물이 하나만 들리지 않는다'); fail = true; }
if (!passSeen.n || passSeen.blocked) { console.log('사슬 중 목표를 넘긴 장면을 못 봤거나, 그때 입력이 막혔다'); fail = true; }
if (!shopBack.trips || shopBack.changed || shopBack.stray || shopBack.overlap) { console.log('관 선택에서 상점으로 오가지 못했거나, 오가며 상점이 바뀌었거나, 상점이 없는데 단추가 있거나, 단추가 판의 길과 겹친다'); fail = true; }
if (!n2.clockLost || !n2.clockShop || !n2.clockNext || n2.clockBad.length || (reboardOn() && !n2.reboard) || n2.reboardBad || (!reboardOn() && n2.reboard)) { console.log('시계를 잃고 상점을 거쳐 다음 대국으로 가지 못했거나, 다시 놓기가 어긋났다'); fail = true; }
if (!rvSeen.kinds.path || !rvSeen.replays || !rvSeen.won || !rvSeen.back || rvSeen.bad.length) { console.log('진 대국 → 갈림길 카드 → 다시 두기 → 넘어가기를 다 걷지 못했다'); fail = true; }
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
if (!skipOk) { console.log('대본 대국 건너뛰기 · 처음 안내 끄기를 확인하지 못했다'); fail = true; }
if (!scriptSeen.won || scriptSeen.moves !== 1 || scriptSeen.rewind !== 1 || scriptSeen.blocked <= 0 || !scriptSeen.shop || !scriptSeen.faction || scriptSeen.bad.length) { console.log('첫 판 대본 대국을 끝까지 지나지 못했거나, 행마 보기 · 되돌리기 · 누를 곳 막기 · 뒤 처음 안내(상점 · 농민군)가 어긋났다'); fail = true; }
console.log(`완성한 명경기 도감: 칸 ${codexDone.cells} · 누를 것 덮음 ${codexDone.cover}`);
console.log(`다 본 도감: 쪽 ${codexAll.pages}`);
if (codexAll.pages < 7) { console.log('다 본 도감의 탭을 다 지나지 못했다'); fail = true; }
if (codexDone.cells !== LEGENDS.length) { console.log('완성한 명경기 도감 칸을 모두 가리키지 못했다'); fail = true; }
console.log(`길 중 멈춤: Esc ${pauseSeen.esc} · ≡ ${pauseSeen.button} · 타이틀로 ${pauseSeen.title} · 이어 하기 ${pauseSeen.resume} · 닫고 건너뛰기 ${pauseSeen.skip} · 수업 ⑩ 타이틀로 ${pauseSeen.lessonTitle}${pauseSeen.bad.length ? ` · 어긋남 ${pauseSeen.bad.join(' | ')}` : ''}`);
if (pauseSeen.bad.length || pauseSeen.esc < 3 || pauseSeen.button < 3 || !pauseSeen.title || !pauseSeen.resume || !pauseSeen.skip || !pauseSeen.lessonTitle) { console.log('길 중에 멈춤이 열리지 않았거나, 닫은 뒤 · 타이틀로 · 건너뛰기가 어긋났다'); fail = true; }
if (hintFail.length) { console.log(`처음 안내가 뜨고 사라지지 않았다: ${hintFail.join(' ')}`); fail = true; }
console.log(`처음 안내: ${[...hintsShown].join(' ')}`);
console.log(`점화 막간: 심은 판 ${ignPlant.runs}(열림 ${ignPlant.opened}${ignPlant.bad.length ? ` · 어긋남: ${ignPlant.bad.join(' | ')}` : ''}) · 열림 ${igSeen.opened} · 닫힘 ${igSeen.closed}(누름 ${igSeen.tap} · Enter ${igSeen.key} · 저절로 ${igSeen.auto}) · 판의 기록과 같음 ${igSeen.data} · 한 판에 두 번 ${igSeen.twice} · 떠 있는 동안 잰 구역 ${igSeen.regions}(샌 것 ${igSeen.leak.length}${igSeen.leak.length ? ': ' + [...new Set(igSeen.leak)].slice(0, 8).join(' ') : ''}) · 가장 오래 ${igSeen.maxT.toFixed(2)}s${igSeen.bad.length ? ` · 어긋남: ${igSeen.bad.slice(0, 6).join(' | ')}` : ''}`);
if (ignPlant.bad.length || igSeen.opened < 3 || igSeen.closed !== igSeen.opened || !igSeen.tap || !igSeen.key || !igSeen.auto || igSeen.twice || igSeen.leak.length || igSeen.data !== igSeen.opened || igSeen.bad.length) { console.log('점화 막간이 열리고 닫히지 않았거나, 한 판에 두 번 열렸거나, 떠 있는 동안 다른 것이 눌렸다'); fail = true; }
console.log(`다음 수: 결정 ${nextSeen.moves}번 · 들어온 기물 ${nextSeen.drawn} · 손을 새로 쥠 ${nextSeen.regrip} · 화면 = 규칙 잰 수 ${nextSeen.view} · 어긋남 ${nextSeen.bad.length}${nextSeen.bad.length ? `: ${nextSeen.bad.join(' | ')}` : ''}`);
if (nextSeen.bad.length || nextSeen.moves < 10 || nextSeen.drawn < 10) { console.log('보이던 다음 둘이 실제로 그 차례로 들어오지 않았거나, 잰 결정이 너무 적다'); fail = true; }
console.log(`판 보기: 관 선택 ${peekSeen.selects} · 두기 ${peekSeen.played}(미리 본 판 = 시작 판 ${peekSeen.same}) · 앞서 본 판을 그 차례에 다시 ${peekSeen.ahead}(같음 ${peekSeen.aheadSame} · 판 짓기 규칙이 바뀌어 다시 지음 ${peekSeen.regen} · 금빛의 부름으로 금빛 적만 더해짐 ${peekSeen.gold} · 예고가 더 멀리 보임 ${peekSeen.sight}) · 어긋남 ${peekSeen.bad.length}${peekSeen.bad.length ? `: ${peekSeen.bad.slice(0, 8).join(' | ')}` : ''}`);
if (peekSeen.bad.length || peekSeen.played < 5 || peekSeen.same !== peekSeen.played || peekSeen.ahead < 3) { console.log('관 선택에 보인 판과 두기로 연 판이 다르거나, 잰 관 선택이 너무 적다'); fail = true; }
console.log(`처음 안내가 말하는 것: ${subj.n}곳 · 화면에 없음 ${subj.bad.length}${subj.bad.length ? `: ${subj.bad.join(' | ')}` : ''}`);
if (subj.bad.length) { console.log('처음 안내가 화면에 없는 것을 가리켰거나 같은 안내가 두 번 떴다'); fail = true; }
console.log(`대본 대국 경로: 끝까지 둔 뒤 상점 ${scriptSeen.shopMaxim ? '격언 있음 → 격언 안내' : '격언 없음 → 격언 안내 없음'}`);
for (const r of paths.rows) console.log(`  ${r}`);
if (paths.bad.length) { console.log(`대본 대국 경로 어긋남: ${paths.bad.join(' | ')}`); fail = true; }
console.log(`새기기 미리 보기: 두루마리 ${previewSeen.scroll} · 꾸러미 ${previewSeen.pack}`);
console.log(`혼 각성: 금 ${awakeSeen.crack} · 금 글 ${awakeSeen.toast} · 처음 안내 ${awakeSeen.hint} · 금 없는 기물 못 고름 ${awakeSeen.skip} · 미리 보기 ${awakeSeen.preview} · 막간 ${awakeSeen.screen} · 상점으로 ${awakeSeen.back} · 상자 칸 ${awakeSeen.chest}${awakeSeen.bad.length ? ` · 어긋남: ${awakeSeen.bad.join(' | ')}` : ''}`);
if (awakeSeen.bad.length || !awakeSeen.crack || !awakeSeen.screen || !awakeSeen.back || !awakeSeen.chest) { console.log('혼에 금이 가고 깨어나는 걸음이 어긋났다'); fail = true; }
console.log(`탁월수: 희생 ${brillSeen.sac} · 새 카드 ${brillSeen.deal} · !? ${brillSeen.tag} · 바친 줄 ${brillSeen.row} · 처음 안내 ${brillSeen.hint} · 둔 뒤 !? 사라짐 ${brillSeen.gone} · !! ${brillSeen.fx} · 가장자리 뒤집기 ${brillSeen.flip} · ×N ${brillSeen.mult} · 기록 ${brillSeen.record} · 명경기 조각 ${brillSeen.frag} · 연출 ${brillSeen.sec.toFixed(2)}s${brillSeen.bad.length ? ` · 어긋남: ${brillSeen.bad.join(' | ')}` : ''}`);
if (brillSeen.bad.length || !brillSeen.fx || !brillSeen.record || !brillSeen.frag) { console.log('희생 → 탁월수 걸음이 어긋났다'); fail = true; }
console.log(`특수 기물: 까마귀 앉는 칸 ${fairySeen.land} · 길 ${fairySeen.path} · 넘기 ${fairySeen.hops} · 기록 ${fairySeen.gone} · 화약병 터짐 ${fairySeen.blast} · 빈 칸 ${fairySeen.board} · 꺾쇠 꺾음 ${fairySeen.bend} · 물수제비 튕김 ${fairySeen.bounce} · 꺾인 길 ${fairySeen.trail} · 연출 ${fairySeen.sec.map((x) => x.toFixed(2) + 's').join(' / ')}${fairySeen.bad.length ? ` · 어긋남: ${fairySeen.bad.join(' | ')}` : ''}`);
if (fairySeen.bad.length || !fairySeen.land || !fairySeen.blast || !fairySeen.bend || !fairySeen.bounce) { console.log('새 특수 기물 걸음이 어긋났다'); fail = true; }
console.log(`각인 · 혼 바꾸기: 같은 것 흐림 ${swapSeen.same} · 상점 그만 ${swapSeen.shopBack} · Esc ${swapSeen.shopEsc} · 바꾸기 ${swapSeen.shopSwap} · 혼 ${swapSeen.soulSwap} · 꾸러미 그만 ${swapSeen.packBack} · Esc ${swapSeen.packEsc} · 바꾸기 ${swapSeen.packSwap}${swapSeen.bad.length ? ` · 어긋남: ${swapSeen.bad.join(' | ')}` : ''}`);
if (swapSeen.bad.length || !swapSeen.same || !swapSeen.shopBack || !swapSeen.shopEsc || !swapSeen.packEsc || !swapSeen.shopSwap || !swapSeen.soulSwap || !swapSeen.packBack || !swapSeen.packSwap) { console.log('각인 · 혼을 덮어쓰기 전에 확인하지 않았거나, 「그만」 · 「바꾸기」가 어긋났다'); fail = true; }
console.log(`기보 몫: 판을 도는 동안 ${chartSeen.run} · 세운 대국 ${chartSeen.scene} · 기보를 쓴 순간 크게 ${chartSeen.grow} · 수준만 ${chartSeen.tick}(어긋남 ${chartSeen.growBad})`);
if (!chartSeen.scene || !chartSeen.grow || !chartSeen.tick || chartSeen.growBad) { console.log('기보 몫 연출이 뜨지 않았거나 기보를 쓴 순간이 자라지 않았다'); fail = true; }
console.log(`찜: 찜 ${holdSeen.on} · 풀기 ${holdSeen.off} · 옮기기 ${holdSeen.moved} · 손가락 한 번 ${holdSeen.touch} · 다음 상점 같은 칸 ${holdSeen.carried} · 얻어서 버림 ${holdSeen.dropped} · 넘어온 카드 삼 ${holdSeen.bought}${holdSeen.bad.length ? ` · 어긋남: ${holdSeen.bad.join(' | ')}` : ''}`);
if (holdSeen.bad.length || !holdSeen.on || !holdSeen.off || !holdSeen.moved || !holdSeen.touch || !holdSeen.carried) { console.log('찜이 어긋났다(책갈피 · 풀기 · 손가락 · 다음 상점 같은 칸)'); fail = true; }
console.log(`낱말 상자: 진열 ${keySeen.shop} · 꾸러미 ${keySeen.pack} · 정석 ${keySeen.draft} · 카드와 겹침 ${keySeen.overlap} · 화면 밖 ${keySeen.off} · 손가락 두 번 ${keySeen.touch} · 상자 없음 ${keySeen.none || 0} · 자리가 없어 뺌 ${keySeen.dropped || 0} · 셋 넘음 ${keySeen.many} · 기본 낱말 ${keySeen.basic} · 카드 종류 ${keySeen.own} · 시너지 칩 ${keySeen.chip}(상자 ${keySeen.chipBox})`);
if (!keySeen.shop || !keySeen.pack || !keySeen.draft || keySeen.overlap || keySeen.off || !keySeen.touch || keySeen.none || keySeen.many || keySeen.basic || keySeen.own || !keySeen.chip || keySeen.chipBox) { console.log('낱말 상자를 보지 못했거나, 카드를 가리거나, 둘을 넘거나, 기본 낱말을 띄웠다'); fail = true; }
if (!pvSeen.capture || !pvSeen.drop || !pvSeen.kb || !pvSeen.touch) { console.log('미리 보기 경로를 다 지나지 못했다'); fail = true; }
if (!tipSeen.incoming || !tipSeen.forced || !tipSeen.path) { console.log('말풍선(증원 · 노림수 · 판의 길)을 보지 못했다'); fail = true; }
if (dom.audioCalls.nodes < 100) { console.log('소리가 거의 나지 않았다'); fail = true; }
if (mt.length && mt[mt.length - 1] > 4) { console.log('한 수 연출이 4초를 넘는다'); fail = true; }
if (pct(0.99) > 16) { console.log('프레임 p99가 16ms를 넘는다'); fail = true; }
if (ims.length && ims[Math.floor(ims.length * 0.99)] > 50) { console.log('누르기 처리 p99가 50ms를 넘는다'); fail = true; }
const kinds = [...place.kinds].map(([k, v]) => `${k}=${[...v].join('/')}`);
console.log(`자리 규칙: 가리킨 것 ${place.n}(판 틀 ${place.side} · 판 밖 ${place.below}, 화면 ${place.screens.size}) · 어김 ${place.rule} · 묶음 끊김 ${place.chain} · 화면 밖 ${place.off} · 가리킨 것 덮음 ${place.self} · 누를 것 덮음 ${place.cover} · 안 뜸 ${place.none} · 덜 중요한 줄을 뺌 ${place.lean} · 잘림(…) ${place.cut}${place.cutIds.size ? ` (${[...place.cutIds].map(([k, n]) => `${k} ${n}`).join(', ')})` : ''} · 처음 안내 ${place.hint}(어김 ${place.hintBad})`);
if (VERBOSE) console.log('종류별 자리: ' + kinds.join(' · '));
if (place.bad.length) console.log('어긴 곳: ' + place.bad.join(' | '));
if (place.n < 100 || place.rule || place.chain || place.off || place.self || place.cover || place.none || place.hintBad) { console.log('설명이 규약의 자리에 뜨지 않았거나 누를 것 · 화면 밖을 덮었다'); fail = true; }
console.log(`설명이 덮은 글: 가리킨 것 ${cov.n} · 덮음 ${cov.hit}(글 ${cov.texts} · 가리킨 것의 글 ${cov.self}) · 처음 안내 ${cov.hint}(덮음 ${cov.hintHit}) · 접은 글 ${cov.folded}`);
console.log(`  화면별: ${[...cov.by].map(([k, b]) => `${k} ${b.hit}/${b.n}(글 ${b.texts}${b.self ? ` · 가리킨 것 ${b.self}` : ''} · 접음 ${b.folded})`).join(' · ')}`);
if (cov.ex.length) console.log('  덮은 곳: ' + cov.ex.slice(0, VERBOSE ? 400 : 12).join('\n    '));
// 피할 수 없는 곳(docs/design-notes/layout.md 「설명 자리 규칙」): 도감 격자는 칸이 본 칸을 채워 바로 아래 · 위 어디든 이웃 칸을 덮는다(덜 덮는 자리를 고른다).
// 그 밖에서 다른 글을 덮거나, 어디서든 가리킨 것의 글 · 처음 안내가 덮으면 실패
const COVER_OK = new Set(['codex']);
const covBad = [...cov.by].filter(([k, b]) => b.hit && !COVER_OK.has(k));
if (covBad.length || cov.self || cov.hintHit) { console.log(`설명이 다른 글을 덮었다: ${covBad.map(([k, b]) => `${k} ${b.hit}`).join(' · ') || '-'} · 가리킨 것의 글 ${cov.self} · 처음 안내 ${cov.hintHit}`); fail = true; }
console.log(`시너지 +N 말풍선: ${moreSeen.n}번(${[...moreSeen.screens].join(' ')}) · 시너지 여섯 이상 대국 ${moreSeen.battle6} · 어긋남 ${moreSeen.bad.length}${moreSeen.bad.length ? `: ${moreSeen.bad.slice(0, 6).join(' | ')}` : ''}`);
if (!moreSeen.battle6 || moreSeen.bad.length) { console.log('시너지 여섯 이상 대국에서 「+N」을 가리켜 보지 못했거나, 가려진 시너지가 말풍선에 다 없다'); fail = true; }
const flowN = flow.text + flow.pad + flow.overlap + flow.screen;
console.log(`금빛 꾸러미 격언 칸: 바꾸기 ${goldSeen.swap} · 팔기 ${goldSeen.sell} · 어긋남 ${goldSeen.bad.length}${goldSeen.bad.length ? `: ${goldSeen.bad.join(' | ')}` : ''}`);
if (!goldSeen.swap || !goldSeen.sell || goldSeen.bad.length) { console.log('금빛 꾸러미의 격언 칸(펼치기 · 바꾸기 · 팔기)이 어긋났다'); fail = true; }
console.log(`큰 수 장면: 대국 ${bigSeen.battle} · 관 선택 ${bigSeen.select} · 결과 ${bigSeen.result} · 기록 ${bigSeen.records} · 보상 ${bigSeen.reward} · 글끼리 겹침 ${bigSeen.overlap.length}${bigSeen.overlap.length ? `: ${bigSeen.overlap.join(' | ')}` : ''}`);
if (!bigSeen.battle || !bigSeen.select || !bigSeen.result || !bigSeen.records || !bigSeen.reward || bigSeen.overlap.length) { console.log('큰 수 장면을 다 지나지 못했거나, 이름표와 수치가 겹쳤다'); fail = true; }
console.log(`진열 카드 종류 장면 ${shopCards.scenes.length}: 카드 상자 ${shopCards.boxes} · 글 ${shopCards.lines} · 넘침 ${shopCards.bad}\n  ${shopCards.scenes.join('\n  ')}`);
if (shopCards.boxes < shopCards.scenes.length * 2) { console.log('진열 카드 종류 장면에서 카드 상자를 다 재지 못했다'); fail = true; }
// 잘린 글: 화면별 · 잘린 곳(화면 · 종류 · 상자 · 원문 → 그려진 글 · 폭)
const clipAll = [...clips.seen.values()];
const clipN = (k, f = () => true) => clipAll.filter((c) => c.kind === k && f(c)).length;
const clipCut = clipN('cut'), clipChar = clipN('char'), clipThin = clipN('thin');
const clipOk = clipAll.filter((c) => c.ok), clipHeldL = clipAll.filter((c) => c.held), clipBad = clipAll.filter((c) => c.bad);
const KIND_WORD = { thin: '줄임', cut: '…', char: '글자 끊김' };
const clipRow = (c) => `${c.screen} ${KIND_WORD[c.kind]} [${c.box || '-'}] 「${c.src}」 → 「${c.shown}」 폭 ${c.w}`;
console.log(`잘린 글 ${clipCut + clipChar + clipThin}(… ${clipCut} · 줄임 ${clipThin} · 글자 끊김 ${clipChar}) · 허용 ${clipOk.length} · 보류 ${clipHeldL.length} · 목록 밖 ${clipBad.length} — ${LANG}`);
console.log(`  화면별: ${[...clips.by].map(([k, b]) => `${k} …${b.cut} · 줄임 ${b.thin} · 끊김 ${b.char}`).join(' | ') || '없음'}`);
console.log(`  잰 화면(프레임): ${[...clips.frames].map(([k, n]) => `${k} ${n}`).join(' · ')}`);
console.log(`  격언 칸 폭(대국 · 상점): ${[...clips.maximW].sort().join(' · ')}`);
const clipList = clipAll.filter((c) => c.kind !== 'thin');
if (clipList.length) console.log('  잘린 곳:\n    ' + clipList.map((c) => `${clipRow(c)}${c.ok ? ' (허용)' : c.held ? ' (보류)' : ' (목록 밖)'}`).join('\n    '));
if (clips.measured.size) console.log(`  재기만 한 글자 끊김(그리지 않음 — 세지 않는다): ${[...clips.measured].join(' · ')}`);
if (VERBOSE && clipThin) console.log('  줄인 곳:\n    ' + clipAll.filter((c) => c.kind === 'thin').map(clipRow).join('\n    '));
if (clipBad.length) { console.log(`허용 목록 밖에서 글이 잘렸다(「…」 · 글자 끊김) ${clipBad.length}`); fail = true; }
console.log(`글 검사: 넘침 ${flowN} · 잘린 글 …${clipCut} · 글자 끊김 ${clipChar} · 줄임 ${clipThin}(허용 ${clipOk.length} · 보류 ${clipHeldL.length} · 목록 밖 ${clipBad.length}) · 잰 프레임 ${flow.frames}`);
console.log(`글 넘침 ${flowN}(글이 상자 밖 ${flow.text} · 테에 붙음 ${flow.pad} · 상자 겹침 ${flow.overlap} · 화면 밖 ${flow.screen}) · 잰 프레임 ${flow.frames} · 보류 ${flow.held + clipHeldL.length}(${[...Object.entries(flow.heldBy).map(([k, n]) => `${HELD[k]} ${n}`), ...(clipHeldL.length ? [`잘린 글 ${clipHeldL.length} — 실패시키지 않음`] : [])].join(' · ') || '없음'})`);
if (flow.held) fail = true;
if (flowN) { console.log('넘친 곳: ' + [...flow.seen].filter(([, w]) => w !== 'held').map(([k]) => k).slice(0, VERBOSE ? 5000 : 40).join('\n  ')); fail = true; }
if (VERBOSE && flow.held) console.log('보류 화면에서 넘친 곳: ' + [...flow.seen].filter(([, w]) => w === 'held').map(([k]) => k).slice(0, 60).join('\n  '));
console.log(`기록 보내기: ${telSent.n}건 · 첫 화면 알림 ${telNote.shown ? '뜸' : '안 뜸'} · 누르면 사라짐 ${telNote.gone ? '확인' : '못 함'} · 다시 안 뜸 ${telNote.again ? '확인' : '못 함'} · 끄면 안 뜸 ${telNote.off ? '확인' : '못 함'}`);
if (!telNote.shown || !telNote.gone || !telNote.again || !telNote.off) { console.log('첫 화면의 기록 보내기 알림이 뜨고 사라지지 않았다'); fail = true; }
if (telSent.n) { console.log('연기 시험 중에 기록이 밖으로 나갔다'); fail = true; }
{
  const b = boardCheck, show = (r) => (r ? `${r.ante}관 ${r.blind + 1}번째 대국 · ${r.won ? '우승' : '짐'} · 점수 합 ${r.score_total} · 대국 ${r.battles} · 수 ${r.moves}` : '없음');
  console.log(`순위 확인: 화면 판 = 서버 셈 ${b.same ? '같음' : '다름'} — ${DATE} · 명령 ${b.cmds}개(${b.bytes}바이트) · 다시 두기 ${b.ms}ms · ${show(b.screen)}`);
  if (!b.same) { console.log(`화면이 둔 오늘의 대국 판과 서버의 다시 두기가 어긋났다: 화면 ${show(b.screen)} | 서버 ${b.error || show(b.server)}`); fail = true; }
}
{
  const r = rankSeen;
  console.log(`순위: 제출 ${r.submit} · 등수 표시 ${r.card || '없음'}(이웃 ${r.neighbours}줄) · 쪽 넘김 ${r.turned}(${r.pages}쪽) · 내 쪽으로 ${r.mine ? '확인' : '못 함'} · 어제 탭 ${r.yesterday ? '확인' : '못 함'} · 결과로 돌아옴 ${r.back ? '확인' : '못 함'} · 다시 짓기 ${r.renamed && r.renamed !== r.name ? `「${r.name}」 → 「${r.renamed}」` : '못 함'}(남은 횟수 줄 ${r.tip ? '확인' : '못 봄'}) · 처음 안내 ${r.hint ? '확인' : '못 봄'} · 안 둠 상태 ${r.unplayed ? '확인' : '못 봄'}(두기 ${r.play ? '확인' : '못 함'}) · 닿지 못함 상태 ${r.unreached ? '확인' : '못 봄'}${r.bad.length ? ` · 어긋남: ${r.bad.join(' | ')}` : ''}`);
  if (r.bad.length || r.submit !== 1 || !r.card || !r.open || r.turned !== 2 || !r.mine || !r.yesterday || !r.back || !r.renamed || r.renamed === r.name || !r.tip || !r.hint || !r.unplayed || !r.play || !r.unreached) { console.log('순위 흐름(제출 → 결과 카드 → 순위 화면 → 쪽 넘김 → 어제 → 다시 짓기)이 어긋났다'); fail = true; }
}
{
  const r = linkSeen, yes = (v) => (v ? '확인' : '못 함');
  // 저장 덩이: 연기 시험 내내 올린 본문(열쇠 · baseRev 포함)의 크기
  const sizes = rankApi.named('/api/save').filter((c) => c.method === 'PUT').map((c) => Buffer.byteLength(JSON.stringify(c.body))).sort((a, b) => a - b);
  console.log(`기기 잇기: 코드 받기 ${yes(r.code)} · 숫자판으로 넣기 ${r.typed}칸 · 같은 이름 ${r.same ? `「${r.name}」` : '못 함'} · 코드를 낸 쪽도 이어짐 ${yes(r.back)} · 한쪽 판(${r.run}) → 다른 쪽 이어 하기 ${yes(r.cont)} · 기록 같음(${r.records}) · 기기 2대 줄 ${yes(r.line)} · 이 기기 떼기 ${yes(r.unlink)} · 둘째 기기 글 넘침 ${r.flow.length}(프레임 ${r.frames}) · 저장 올리기 ${sizes.length}번(중간 ${sizes[sizes.length >> 1] || 0} · 최대 ${sizes.at(-1) || 0}바이트)${r.bad.length ? ` · 어긋남: ${r.bad.join(' | ')}` : ''}`);
  if (r.flow.length) console.log('  둘째 기기에서 넘친 곳: ' + r.flow.slice(0, 20).join('\n  '));
  if (r.bad.length || r.flow.length || !r.code || r.typed !== 8 || !r.same || !r.back || !r.cont || !r.line || !r.unlink || (sizes.at(-1) || 0) > 200 * 1024) { console.log('기기 잇기 흐름(코드 받기 → 넣기 → 같은 이름 → 판 · 기록이 건너감 → 떼기)이 어긋났다'); fail = true; }
}
{
  const r = acctSeen, yes = (v) => (v ? '확인' : '못 함');
  console.log(`계정: 만들기 ${yes(r.made)}(입력 칸 ${r.fields} · 초점 동안 키 막기 ${yes(r.keys)}) → 다른 기기에서 들어오기 → 같은 이름 ${r.same ? `「${r.name}」` : '못 함'} · 기록(${r.records}) → 비번 바꾸기 ${yes(r.changed)} → 나가기(기록 비움) ${yes(r.out)} · 계정에는 남음 ${yes(r.kept)} → 지우기 ${yes(r.gone)} · 남은 입력 칸 ${r.left} · 둘째 기기 글 넘침 ${r.flow.length}(프레임 ${r.frames})${r.bad.length ? ` · 어긋남: ${r.bad.join(' | ')}` : ''}`);
  if (r.flow.length) console.log('  둘째 기기에서 넘친 곳: ' + r.flow.slice(0, 20).join('\n  '));
  if (r.bad.length || r.flow.length || !r.made || !r.keys || !r.same || !r.changed || !r.out || !r.kept || !r.gone || r.left !== 0) { console.log('계정 흐름(만들기 → 들어오기 → 같은 이름 · 기록 → 비번 바꾸기 → 나가기 → 지우기 · 남은 입력 칸 0)이 어긋났다'); fail = true; }
}
{
  const r = hlSeen, yes = (v) => (v ? '확인' : '못 함');
  console.log(`하이라이트: 단추 ${yes(r.button)} · 열기 ${yes(r.open)} · 그림 1200 × 675 ${yes(r.image)} · Esc ${yes(r.esc)} · 바깥 누르기 ${yes(r.outside)} · 닫기 ${yes(r.close)}${r.bad.length ? ` · 어긋남: ${r.bad.join(' | ')}` : ''}`);
  if (r.bad.length || !r.button || !r.open || !r.image || !r.esc || !r.outside || !r.close) { console.log('하이라이트 카드(결과 화면 단추 → 열기 → 그림 → 닫기)가 어긋났다'); fail = true; }
}
console.log(fail ? 'SMOKE FAIL' : 'SMOKE OK');
process.exit(fail ? 1 : 0);
