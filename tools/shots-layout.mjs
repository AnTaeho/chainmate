// 레이아웃 점검 스크린샷: 모든 화면과, 화면마다 가리킬 수 있는 것(말풍선 · 낱말 상자가 뜨는 구역)을 하나씩 가리킨 모습.
//   node tools/shots-layout.mjs [--prefix before|after] [--lang ko|en] [--out docs/shots/layout] [--only 이름] [--spacing pad8,card7,line14,title18,in3,group8] [--det]
//   --spacing: 글 간격 토큰을 덮어쓴 모습(src/ui/frame.js SPACING — 시안 찍기용). --det: 시계 · 무작위를 멈춰 같은 코드면 같은 그림(고치기 전후 픽셀 견주기)
// 파일: <prefix>-<번호>-<화면>.png(가리키지 않은 모습)와 <prefix>-<번호>-<화면>~<구역>.png(그 구역을 가리킨 모습). 480×270 1배.
// 번호는 장면 차례에 묶여 before · after가 같은 이름으로 짝이 된다. 영어(--lang en)는 대표 화면만, 이름 앞에 en-.
// 가리킨 모습마다 그린 설명 네모(말풍선 · 낱말 상자 · 처음 안내)를 <prefix>[-en].json에 남긴다(보고서 · 견주기용).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const LANG = opt('--lang', 'ko');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/layout'));
const ONLY = opt('--only', null);
const TAG = LANG === 'en' ? 'en-' : '';
const SPACING = opt('--spacing', null);
const DET = args.includes('--det');
const QUICK = args.includes('--quick'); // 가리킨 모습은 빼고 장면마다 한 장만

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
fs.mkdirSync(OUT, { recursive: true });
// --det: 페이지 시계를 멈춰 두고 기다림만큼 손으로 흘린다(연출 · 반짝임이 찍는 때에 따라 달라지지 않게)
const settle = (ms = 300) => (DET ? page.clock.runFor(ms) : page.waitForTimeout(ms));
async function until(fn) {
  if (!DET) return page.waitForFunction(fn, null, { timeout: 20000 });
  for (let i = 0; i < 400; i++) { if (await ev(fn)) return; await page.clock.runFor(50); }
  throw new Error(`기다림 초과: ${fn}`);
}
if (DET) {
  // 화면 연출의 Math.random도 같은 씨앗으로
  await page.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
}
const ev = (fn, arg) => page.evaluate(fn, arg);
const log = {};
let shots = 0;

// 도트 화면이라 빛깔이 적다: 256색 안이면 색인 PNG로(RGBA PNG의 1/3쯤). 넘치면 RGB
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(rgba, w, h) {
  const cols = new Map();
  for (let i = 0; i < rgba.length && cols.size <= 256; i += 4) { const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]; if (!cols.has(k)) cols.set(k, cols.size); }
  const indexed = cols.size <= 256;
  const bpp = indexed ? 1 : 3;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * bpp + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = y * (w * bpp + 1) + 1 + x * bpp;
      if (indexed) raw[o] = cols.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
      else { raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2]; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = indexed ? 3 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (indexed) { const pl = Buffer.alloc(cols.size * 3); for (const [k, i] of cols) { pl[i * 3] = k >> 16; pl[i * 3 + 1] = (k >> 8) & 255; pl[i * 3 + 2] = k & 255; } parts.push(chunk('PLTE', pl)); }
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
// 글 넘침(src/render/layoutlog.js): 찍는 장마다 실제 글꼴로 잰다 — 연기 시험(가짜 글 폭)과 짝
const overflow = new Map();
async function shot(file, rects = null) {
  if (ONLY && !file.includes(ONLY)) return;
  for (const q of await ev(async () => (await import('/src/render/layoutlog.js')).checkLayout())) if (!overflow.has(q.msg)) overflow.set(q.msg, file);
  const b64 = await ev(() => { const c = document.getElementById('screen'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode.apply(null, d.subarray(i, i + 8192)); return btoa(s); });
  fs.writeFileSync(path.join(OUT, `${file}.png`), encodePng(Buffer.from(b64, 'base64'), 480, 270));
  if (rects) log[file] = rects;
  shots++;
}
const regions = () => ev(() => window.__app.ui.regions.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, tip: !!r.tip, keys: !!r.keys, click: !!r.onClick && r.enabled })));
async function moveTo(gx, gy) {
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + ((gx + 0.5) * box.width) / 480, box.y + ((gy + 0.5) * box.height) / 270);
}
async function clickId(id) {
  const r = (await regions()).find((q) => q.id === id);
  if (!r) throw new Error(`no region ${id} on ${await ev(() => window.__app.screen.name)}`);
  await moveTo(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  await page.mouse.down(); await page.mouse.up();
  await settle(80);
}
// 설명 네모: 말풍선(app.tipRect) · 낱말 상자(app.keyBoxes) · 처음 안내(app.hintRect)
const drawn = () => ev(() => { const a = window.__app; return { tip: a.tipRect || null, keys: a.keyBoxes || [], hint: a.hintRect || null }; });

// 가리킬 것 고르기: 같은 종류(구역 id의 앞머리)가 많으면 고루 몇 개만(판 칸 10 · 주머니 4 · 도감 4)
const kindOf = (id) => id.replace(/:[^:]*$/, '');
const CAP = { sq: 10, deck: 4, codex: 4 };
function pickHovers(list) {
  const out = [];
  const byKind = new Map();
  for (const r of list) { if (!r.tip && !r.keys) continue; const k = kindOf(r.id); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(r); }
  for (const [k, rs] of byKind) {
    const cap = CAP[k] || 99;
    if (rs.length <= cap) { out.push(...rs); continue; }
    for (let i = 0; i < cap; i++) out.push(rs[Math.round((i * (rs.length - 1)) / (cap - 1))]);
  }
  return out;
}
const safe = (id) => id.replace(/[:/]/g, '_');

let no = 0;
// 장면 하나: setup(페이지 안) → 기다림 → 기본 한 장 → 가리킬 것마다 한 장
async function scene(name, setup, { wait = 400, hover = true, before = null } = {}) {
  no++;
  const base = `${PREFIX}-${String(no).padStart(2, '0')}-${TAG}${name}`;
  if (ONLY && !base.includes(ONLY) && !ONLY.startsWith(`${PREFIX}-`)) { /* 이름으로 거른다 */ }
  await moveTo(-50, -50).catch(() => {});
  await page.mouse.move(0, 0);
  await ev(() => window.__app.pointer('move', -10, -10));
  if (setup) await ev(setup);
  if (before) await before();
  await settle(wait);
  await ev(() => window.__app.pointer('move', -10, -10));
  await settle(60);
  await shot(base, await drawn());
  if (!hover || QUICK) return;
  for (const r of pickHovers(await regions())) {
    await moveTo(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
    await settle(90);
    let d = await drawn();
    // 글 캐시가 비어 한 프레임이 늦으면 한 번 더 기다린다
    if (!d.tip && !d.keys.length) { await settle(250); d = await drawn(); }
    if (!d.tip && !d.keys.length) continue;
    await shot(`${base}~${safe(r.id)}`, { region: { id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }, ...d });
  }
}

// ── 준비: 빈 저장소 · 처음 안내는 본 것으로(따로 안내 장면에서만 켠다) · 두 배 빠르기
await page.goto(`http://localhost:${srv.address().port}/index.html${SPACING ? `?spacing=${encodeURIComponent(SPACING)}` : ''}`);
await ev((lang) => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 2 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
}, LANG);
await page.reload();
await until(() => window.__app && window.__app.screen);
await ev(async () => { (await import('/src/render/layoutlog.js')).LOG.on = true; });
await ev(async () => {
  const a = window.__app;
  const { HINTS } = await import('/src/ui/coach.js');
  a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true]));
  a.records.lessonsSeen = { drop: true, become: true, chain: true, reply: true };
  a.records.runs = 7; a.records.wins = 1; a.records.bestAnte = 8; a.records.mates = 3;
  a.records.unlocked = { openings: ['standard', 'london', 'queens_gambit'], dan: 2 };
  a.records.bestMove = { score: 48210, steps: ['N', 'B', 'R', 'Q', 'P', 'Q', 'R', 'K'], ante: 6 };
  for (const id of ['quick_change', 'first_move', 'whim', 'wall_breaker', 'sacrifice', 'edge', 'center', 'chivalry', 'payback', 'coronation']) a.records.codex.maxims[id] = true;
  for (const id of ['fog', 'mirror', 'grandmaster']) a.records.codex.masters[id] = true;
  a.records.codex.legends = { immortal: 3, century: 1 }; a.records.codex.legendsDone = { immortal: true };
  a.records.codex.editions = { foil: true, rainbow: true };
  a.saveRecords();
  window.__fill = (r, { maxims = 5 } = {}) => {
    const add = (id, edition = null, legendary = false) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5, ...(legendary ? { legendary: true } : {}) });
    const list = [['chivalry'], ['quick_change', 'foil'], ['first_move'], ['whim', 'rainbow'], ['sacrifice'], ['wall_breaker']];
    for (const [id, ed] of list.slice(0, maxims)) add(id, ed);
    r.josekis = ['gates', 'stepping'];
    r.fragments.century = { first: true, feat: false, gold: false };
    r.fragments.opera = { first: true, feat: true, gold: false };
    r.deck.push({ id: 80, t: 'O', eng: null }, { id: 81, t: 'S', eng: null, soul: 'echo' }, { id: 82, t: 'L', eng: { id: 'glass' } });
    r.consumableSlots = 4;
    r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
    r.money = 23;
  };
});
const fresh = (seed, extra = '') => `localStorage.removeItem('chainmate.run.v1'); window.__app.closeOverlay(); window.__app.nextSeed = ${seed}; window.__app.newRun(); ${extra}`;
const js = (src) => new Function(src);

const ko = LANG !== 'en';
// ── 판 밖
if (ko) {
  await scene('title', () => window.__app.toTitle(), { wait: 900 });
  await scene('lessons', () => window.__app.go('lessons'));
  await scene('glossary', () => { const a = window.__app; a.go('lessons'); a.screen.terms = true; });
  await scene('lesson', () => window.__app.go('lesson', { index: 2, phase: 'play' }), { wait: 700 });
  await scene('setup', () => window.__app.go('setup'));
  await scene('codex', () => window.__app.go('codex'));
  await scene('codex-pieces', () => { const a = window.__app; a.go('codex'); a.screen.tab = 'pieces'; });
  await scene('records', () => window.__app.go('records'));
}
// ── 판: 관 선택 · 정석 · 대국
await scene('select', js(fresh(7, "const r = window.__app.run; if (r.phase === 'draft') { window.__app.cmd({ type: 'joseki', index: 0 }); window.__app.goPhase(); }")));
if (ko) await scene('select-master', js(fresh(3, "const a = window.__app; if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.run.masters[0] = 'fog'; a.cmd({ type: 'skip' }); a.cmd({ type: 'skip' }); a.goPhase();")));
await scene('draft', js(fresh(7)), { wait: 1600 });
if (ko) await scene('draft-ante3', js(fresh(7, "const a = window.__app, r = a.run; a.cmd({ type: 'joseki', index: 0 }); r.ante = 3; r.blind = 0; r.draft = { ante: 3, options: ['martyr_vow', 'knight_oath', 'highway'] }; r.phase = 'draft'; a.goPhase();")), { wait: 1600 });
const battleSrc = (seed, extra) => fresh(seed, `const a = window.__app, r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); ${extra} a.cmd({ type: 'play' }); a.go('battle', { events: [] });`);
await scene('battle', js(battleSrc(7, '')), { wait: 2600 });
if (ko) {
  await scene('battle-master', js(battleSrc(3, "a.run.masters[0] = 'mirror'; a.cmd({ type: 'skip' }); a.cmd({ type: 'skip' });")), { wait: 3400 });
  await scene('battle-fog', js(battleSrc(3, "a.run.masters[0] = 'fog'; a.cmd({ type: 'skip' }); a.cmd({ type: 'skip' });")), { wait: 3400 });
}
await scene('battle-full', js(battleSrc(11, "window.__fill(r); r.ante = 5; r.blind = 0;")), { wait: 2800 });
if (ko) {
  // 들고 있는 모습 · 사슬 중(지키는 적)
  await scene('battle-chain', js(battleSrc(3, '')), {
    wait: 200,
    before: async () => {
      await settle(2600);
      const plan = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return { hand: d.handIndex, sq: d.sq, line: d.line }; });
      await clickId(`hand:${plan.hand}`); await clickId(`sq:${plan.sq}`);
      await until(() => !window.__app.screen.busy);
      await clickId(`sq:${plan.line[0]}`);
      await until(() => !window.__app.screen.busy);
    },
  });
  // 막간
  await scene('reward', js(fresh(7, "const a = window.__app; if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 0, overflow: 0, earned: 1, total: 7 }, events: [] });")), { wait: 2200 });
  await scene('chest', () => window.__app.go('chest', { chest: { count: 3, tier: 'uncommon', cells: [{ lit: false, item: null }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'engrave', piece: 'P', pieceId: 1, eng: 'ivory' } }, { lit: false, item: null }] } }), { wait: 2600 });
}
// ── 상점 · 꾸러미
const shopSrc = (seed, extra = '') => fresh(seed, `const a = window.__app, r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); r.phase = 'shop'; ${extra} a.goPhase();`);
// 상점은 진열이 비어 있을 수 있어 직접 채운다(격언 · 기물 이형)
const stock = "r.shop = r.shop || {}; r.shop.display = [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'C', price: 6, sold: false }]; r.shop.packs = [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }]; r.shop.rerolls = 0; r.shop.promoted = false; r.shop.removed = false;";
await scene('shop', js(shopSrc(11, stock)), {
  wait: 500,
  before: async () => { await ev(async () => { const r = window.__app.run; if (!r.shop.rng) { const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); } }); },
});
if (ko) await scene('shop-few', js(fresh(7, `const a = window.__app, r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); r.phase = 'shop'; ${stock} a.goPhase();`)), {
  wait: 500,
  before: async () => { await ev(async () => { const r = window.__app.run; const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); r.money = 30; }); },
});
const packSrc = (kind, options) => shopSrc(11, `${stock} r.phase = 'pack'; r.pack = { kind: '${kind}', options: ${JSON.stringify(options)} };`);
await scene('pack-piece', js(packSrc('piece', [{ kind: 'piece', t: 'L' }, { kind: 'piece', t: 'C' }, { kind: 'piece', t: 'B' }])), { wait: 1600 });
if (ko) await scene('pack-chart', js(packSrc('chart', [{ kind: 'chart', form: 'N' }, { kind: 'chart', form: 'Q' }, { kind: 'chart', form: 'P' }])), { wait: 1600 });
await scene('pack-engraving', js(packSrc('engraving', [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }])), { wait: 1600 });
if (ko) {
  await scene('pack-engraving-target', js(packSrc('engraving', [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }])), {
    wait: 200,
    before: async () => { await settle(1600); await clickId('pack:pick:1'); const id = await ev(() => window.__app.run.deck[2].id); await clickId(`deck:${id}`); },
  });
  await scene('pack-golden', js(packSrc('golden', [{ kind: 'maxim', id: 'chivalry', edition: 'foil' }, { kind: 'maxim', id: 'light_step', edition: 'pearl' }, { kind: 'fragment', legend: 'immortal' }])), { wait: 1600 });
  await scene('shop-scroll-target', js(shopSrc(11, stock)), {
    wait: 200,
    before: async () => { await ev(async () => { const r = window.__app.run; const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); }); await settle(300); await clickId('cons:0'); const id = await ev(() => window.__app.run.deck[1].id); await clickId(`deck:${id}`); },
  });
  await scene('legend', () => { const a = window.__app; a.settings.speed = 1; a.go('legend', { legend: 'immortal' }); }, { wait: 3600, hover: false });
  await ev(() => { window.__app.settings.speed = 2; });
  await scene('result', js(fresh(7, "const a = window.__app; a.run.phase = 'lost'; a.run.log.push({ ante: 1, blind: 1, kind: 'official', score: 740, target: 900, best: 420, won: false }); a.go('result');")), { wait: 600 });
  await scene('pause', () => window.__app.openOverlay('pause'));
  await scene('settings', () => window.__app.openOverlay('settings', { back: 'pause' }));
  await ev(() => window.__app.closeOverlay());
  // 처음 안내(한 번에 하나): 정석 · 상점 · 꾸러미 · 대국(증원)
  // 이 장면의 안내만 켠다(앞 장면에서 켠 것은 다시 본 것으로)
  const hintOn = (ids) => ev(async (ids) => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); for (const id of ids) delete a.records.coachSeen[id]; }, ids);
  await scene('hint-draft', js(fresh(7)), { wait: 1800, hover: false, before: () => hintOn(['draft']) });
  await scene('hint-shop', js(shopSrc(11, stock)), { wait: 600, hover: false, before: async () => { await ev(async () => { const r = window.__app.run; const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); }); await hintOn(['shop']); } });
  await scene('hint-shop-family', js(shopSrc(11, stock)), { wait: 600, hover: false, before: async () => { await ev(async () => { const r = window.__app.run; const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); }); await hintOn(['family']); } });
  await scene('hint-pack', js(packSrc('piece', [{ kind: 'piece', t: 'L' }, { kind: 'piece', t: 'C' }, { kind: 'piece', t: 'B' }])), { wait: 1800, hover: false, before: () => hintOn(['pack']) });
  await scene('hint-battle', js(battleSrc(7, '')), { wait: 2800, hover: false, before: () => hintOn(['incoming', 'family']) });
  // 새 장면(고치기 전 짝 없음): 혼 · 묘수 진열(그림자 카드 글), 수업 ⑩ 따라 하는 길의 말풍선, 도감 둘째 쪽
  await hintOn([]);
  await scene('shop-souls', js(shopSrc(11, "r.shop = { display: [{ kind: 'soul', id: 'shade', price: 6, sold: false }, { kind: 'tactic', id: 'freeze', price: 3, sold: false }], packs: [{ kind: 'golden', price: 0, sold: false }, { kind: 'piece', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };")), {
    wait: 500,
    before: async () => { await ev(async () => { const r = window.__app.run; const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'layout'); }); },
  });
  await scene('lesson-guide', async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); const { openLesson } = await import('/src/ui/screens/lessons.js'); openLesson(a, LESSONS.findIndex((L) => L.shop), 'shots'); }, { wait: 900, hover: false });
  await scene('lesson-guide-2', null, { wait: 300, hover: false, before: async () => { await clickId('shop:buy:0'); await settle(600); } });
  await ev(() => { const a = window.__app; a.guide = null; a.toTitle(); });
  await scene('codex-page2', () => { const a = window.__app; a.go('codex'); a.screen.page = 1; });
}

// --only로 몇 장만 다시 찍으면 있던 기록에 합친다
const logFile = path.join(OUT, `${PREFIX}${LANG === 'en' ? '-en' : ''}.json`);
const prev = ONLY && fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
fs.writeFileSync(logFile, JSON.stringify({ ...prev, ...log }, null, 1));
console.log(`찍음 ${shots}장 · 장면 ${no}`);
// 보류(docs/design-notes/layout.md 「보류」): 상점 · 금빛 꾸러미 장면은 따로 센다(연기 시험과 같은 목록)
const heldFile = (f) => /-shop|pack-golden|lesson-guide/.test(f);
const bad = [...overflow].filter(([, f]) => !heldFile(f)), held = [...overflow].filter(([, f]) => heldFile(f));
console.log(`글 넘침 ${bad.length}${bad.length ? '\n  ' + bad.map(([m, f]) => `${f}: ${m}`).join('\n  ') : ''}`);
console.log(`보류 화면 넘침 ${held.length}${held.length ? '\n  ' + held.map(([m, f]) => `${f}: ${m}`).join('\n  ') : ''}`);
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
