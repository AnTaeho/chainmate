// 그릴 때만 그리기 확인(CHM-75, docs/design-notes/layout.md 「빛과 움직임」 · 「그릴 때만 그린다」): 실제 브라우저(Playwright 크로미움 — GPU)로 게임을 열어
// 프레임마다 그리되(alwaysDraw) 그리기 판단(app.lastWant)은 그대로 셈한다. 판단이 「안 그려도 된다」였는데 캔버스가 지난 프레임과 달라진 프레임이 어김이다.
//   node tools/drawcheck.mjs [--scale 1440x810] [--only title,shop,...]
// 게임 루프(requestAnimationFrame)를 도구가 잡아 1/60초씩 돌리고, 프레임마다 캔버스 화소를 지난 프레임과 견준다.
// 장면: 첫 화면(움직임 줄이기 포함) · 첫 판 대본 대국(끝까지) · 실제 대국(쉼 6초 · 손 들썩임 · 가리킴 · 놓기 · 잡기 · 긴 콤보 · 희생 · 평가 도장 · 마스터 등장 · 목표 넘김 · 동전 · 색종이 ·
//   강 · 문 · 안개 · 금빛 적 · 횃불 · 시계 깜빡임 · 움직임 줄이기) · 복기 갈림길 · 다시 두기 · 튜토리얼 수업 · 상점(가리킴 · 끌기 · 사기 · 리롤) · 팩 열기 ·
//   레퍼토리 · 보상 · 마스터의 상자 · 각성 · 전설 · 도감 · 해금 · 설정 바꾸기 · 결과 · 알림 · 도움말 팁 · 하이라이트 · 계정 · 기기 잇기 · 순위(가짜 서버) · 창 크기.
// 정적 파일과 /api(가짜 서버 test/helpers/fakeapi.js)는 도구가 스스로 띄운 서버(127.0.0.1:--port, 기본 8793)로 연다.
// Playwright는 저장소 의존성에 넣지 않는다 — PLAYWRIGHT(index.mjs 경로) · 'playwright' · 전역 순.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [VW, VH] = opt('--scale', '1440x810').split('x').map(Number);
const ONLY = opt('--only', null);
const PORT = Number(opt('--port', 8793));

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

// ── 정적 서버(여러 모듈을 한꺼번에 받아도 끊기지 않게 Node로)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
// 순위 · 기기 잇기 · 계정 장면의 가짜 서버(boot({ rankBase: '' })로 켠 페이지만 부른다)
const { fakeApi, seedBoard, demoRows } = await import('../test/helpers/fakeapi.js');
const TODAY = '2026-10-08';
const api = fakeApi({ build: 'drawcheck', now: () => Date.parse(`${TODAY}T12:00:00Z`), rand: (() => { let r = 7; return () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x80000000); })() });
await seedBoard(api, TODAY, demoRows(24));
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await api.fetch(req.url, { method: req.method, headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {}, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined });
    let body = '';
    try { body = JSON.stringify(await r.json()); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(r.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', 1024, ok));

// ── 페이지 안: 루프를 잡고, 프레임마다 화소를 견준다
const INIT = () => {
  window.requestAnimationFrame = (cb) => { window.__raf = cb; return 1; };
  window.__rng = () => ({ s: 77 }); // 상점 굴림 씨앗(src/sim/rng.js createRng 꼴)
  const dc = (window.__dc = { T: 0, prev: null, viol: [], frames: 0, skips: 0, scene: '', seen: new Set(), hints: 0 });
  window.__dcStep = (n = 1) => {
    const a = window.__app;
    for (let i = 0; i < n; i++) {
      dc.T += 1000 / 60;
      const cb = window.__raf; window.__raf = null;
      if (!cb) continue;
      cb(dc.T);
      dc.seen.add(a.overlay ? `${a.screen && a.screen.name}+${a.overlay.name}` : a.screen && a.screen.name);
      if (a.hintShown) dc.hints++;
      // 화면 캔버스에서 바로 읽으면 크로미움이 그 캔버스를 CPU 그리기로 바꿔(자주 읽는 캔버스) 다음 그림의 화소가 달라진다 — 따로 둔 캔버스에 옮겨 읽는다
      const c = a.canvas;
      if (!dc.copy) dc.copy = document.createElement('canvas');
      const cp = dc.copy;
      if (cp.width !== c.width || cp.height !== c.height) { cp.width = c.width; cp.height = c.height; }
      const g = cp.getContext('2d', { willReadFrequently: true });
      g.clearRect(0, 0, cp.width, cp.height);
      g.drawImage(c, 0, 0);
      const d = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
      dc.frames++;
      if (!a.lastWant) {
        dc.skips++;
        if (dc.prev && dc.prev.length === d.length) {
          const w = c.width;
          let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
          for (let k = 0; k < d.length; k++) if (d[k] !== dc.prev[k]) { const x = k % w, y = (k / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if (x1 >= 0 && dc.viol.length < 200) dc.viol.push({ scene: dc.scene, screen: a.screen && a.screen.name, overlay: a.overlay && a.overlay.name, time: +a.time.toFixed(3), bbox: [x0, y0, x1 + 1, y1 + 1].map((v) => Math.floor(v / a.scale)) });
        } else if (dc.prev) dc.viol.push({ scene: dc.scene, screen: a.screen && a.screen.name, time: +a.time.toFixed(3), bbox: 'canvas size changed on a skipped frame' });
      }
      dc.prev = d;
    }
  };
  // 한 장면을 다시 셈한다(지난 프레임은 남긴다 — 장면 사이 바뀜도 견준다)
  window.__dcScene = (name) => { dc.scene = name; dc.seen = new Set(); dc.hints = 0; const s = { frames: dc.frames, skips: dc.skips, viol: dc.viol.length }; return s; };
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function openPage({ reducedMotion = 'no-preference', lang = 'ko', fresh = false, rank = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(INIT);
  await page.addInitScript(({ lang, rank }) => {
    if (rank) window.__CHAINMATE_NO_BOOT__ = true;
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ volume: 0, music: 0, lang, telemetry: false }));
  }, { lang, rank });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  if (rank) await page.evaluate(async (today) => { const m = await import('/src/main.js'); m.boot({ rankBase: '', today: () => today }); }, TODAY);
  await page.waitForFunction(() => window.__app && window.__raf);
  await page.evaluate((fresh) => {
    const a = window.__app;
    a.alwaysDraw = true; // 늘 그리되 판단은 셈한다
    if (!fresh) { a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); a.records.tutorialAsked = true; if (a.overlay && a.overlay.name === 'welcome') a.closeOverlay(); }
  }, fresh);
  page.errors = errors;
  return page;
}

// 페이지를 닫으며 어김 자세히를 모은다
const details = [];
async function done(page) { details.push(...(await page.evaluate(() => window.__dc.viol))); await page.context().close(); }

// 장면 하나: 페이지 · 이름 · 몸통(도구 쪽 조작). 장면 전후의 프레임 · 건너뛴 프레임 · 어김을 센다
async function scene(page, name, body) {
  if (ONLY && !ONLY.split(',').some((k) => name.startsWith(k))) return;
  const s0 = await page.evaluate((n) => window.__dcScene(n), name);
  await body();
  const s1 = await page.evaluate(() => ({ frames: window.__dc.frames, skips: window.__dc.skips, viol: window.__dc.viol.length, seen: [...window.__dc.seen], hints: window.__dc.hints }));
  results.push({ name, frames: s1.frames - s0.frames, skips: s1.skips - s0.skips, viol: s1.viol - s0.viol, seen: s1.seen, hints: s1.hints });
}

function helpers(page) {
  const step = (n = 1) => page.evaluate((n) => window.__dcStep(n), n);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // 게임 좌표 → 창 좌표(보이는 캔버스 네모 기준)
  const client = async (x, y) => page.evaluate(([x, y]) => { const r = window.__app.canvas.getBoundingClientRect(); return [r.left + ((x + 0.5) / 480) * r.width, r.top + ((y + 0.5) / 270) * r.height]; }, [x, y]);
  const move = async (x, y, n = 1) => { const [cx, cy] = await client(x, y); await page.mouse.move(cx, cy); await step(n); };
  const click = async (x, y, n = 2) => { const [cx, cy] = await client(x, y); await page.mouse.move(cx, cy); await page.mouse.down(); await step(1); await page.mouse.up(); await step(n); };
  const regions = (re) => ev((src) => { const rx = new RegExp(src); return window.__app.ui.regions.filter((q) => rx.test(q.id) && q.w > 0 && q.h > 0 && !q.passive).map((q) => ({ id: q.id, x: Math.floor(q.x + q.w / 2), y: Math.floor(q.y + q.h / 2) })); }, re.source);
  const press = async (re, n = 4) => { const [r] = await regions(re); if (!r) return false; await click(r.x, r.y, n); return true; };
  const hoverAll = async (re, each = 6, max = 30) => { for (const r of (await regions(re)).slice(0, max)) await move(r.x, r.y, each); };
  // 대국 화면이 쉬기를 기다리며 프레임을 돈다
  const settle = (max = 900) => ev(async (max) => { const a = window.__app; for (let i = 0; i < max && a.screen && a.screen.busy; i++) window.__dcStep(1); }, max);
  return { step, ev, move, click, regions, press, hoverAll, settle };
}

const SHOP = () => {
  const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const [id, edition] of [['chivalry', null], ['quick_change', 'foil'], ['first_move', null], ['whim', 'rainbow'], ['sacrifice', null]]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
  r.consumableSlots = 4; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
  if (r.deck[0]) r.deck[0].soul = 'echo';
  r.money = 60; r.phase = 'shop';
  r.shop = { rng: window.__rng(), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'N', price: 6, sold: false, edition: 'pearl' }, { kind: 'soul', id: 'echo', price: 4, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
  a.go('shop');
};
// 움직이는 그림(판본 · 혼)이 없는 상점: 가만히 있으면 흐르는 배경만 바뀐다
const SHOP_PLAIN = () => {
  const a = window.__app; a.overlay = null; a.nextSeed = 12; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const id of ['chivalry', 'quick_change', 'first_move']) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 });
  r.money = 60; r.phase = 'shop';
  r.shop = { rng: window.__rng(), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'N', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
  a.go('shop');
};
const BATTLE = () => {
  const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const id of ['chivalry', 'quick_change', 'first_move', 'whim', 'sacrifice']) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 });
  r.ante = 3; r.blind = 0; a.cmd({ type: 'play' }); a.go('battle', { events: [] });
};

// 대국 하나를 꾸민다: 판 사물(강 · 문 · 고속도로) · 안개 · 금빛 적 · 횃불 · 특성 · 열린 킹 · 띠(대국 시작 사건)
const BATTLE_OPT = (opt) => {
  const a = window.__app; a.overlay = null; a.nextSeed = opt.seed ?? 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const id of ['chivalry', 'quick_change', 'first_move', 'whim', 'sacrifice']) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 });
  r.ante = opt.ante ?? 3; r.blind = 0;
  const ev = a.cmd({ type: 'play' });
  const b = r.battle;
  if (opt.rules) Object.assign(b.rules, opt.rules);
  if (opt.fog) { b.rules.fog = opt.fog; b.revealed = []; }
  if (opt.marks) {
    let n = 0;
    b.board.forEach((c) => { if (c && !c.mine && c.t !== 'K' && c.t !== 'X' && c.t !== 'J') { if (n === 0) c.gold = true; if (n === 1) c.muted = true; if (n === 2) c.trait = 'shield'; n++; } });
    b.hints = { ...(b.hints || {}), openKings: b.board.map((c, i) => (c && c.t === 'K' ? i : -1)).filter((i) => i >= 0) };
  }
  a.go('battle', { events: opt.banner ? ev : [] });
};
// 마스터 대국(관의 셋째 대국): 온 화면 등장 장면 → 마스터 띠
const MASTER = (opt = {}) => {
  const a = window.__app; a.overlay = null; a.nextSeed = opt.seed ?? 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run; r.ante = opt.ante ?? 2; r.blind = 2;
  const ev = a.cmd({ type: 'play' }); a.go('battle', { events: ev });
};
// 목표를 낮춰 첫 사슬이 목표를 넘기게(넘김 번쩍 · 꽂히는 점수 · 동전 · 대국 승리 색종이)
const LOW_TARGET = () => { const a = window.__app, b = a.run.battle; b.target = 40; a.screen.sync(); };
// 상점 진열에 명경기 조각(반짝 띠)
const SHOP_SHEEN = () => {
  const a = window.__app; a.overlay = null; a.nextSeed = 13; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run; r.money = 60; r.phase = 'shop';
  r.shop = { rng: window.__rng(), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'fragment', legend: 'immortal', part: 0, price: 4, sold: false }], packs: [{ kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
  a.go('shop');
};
// 다음 수: 둔 뒤 먹을 수가 가장 많은 것(긴 콤보). sac면 희생을 먼저
const PLAY = async ({ k, sac = false }) => {
  const a = window.__app; const { legalCommands, apply } = await import('/src/sim/battle.js'); const { cloneBattle } = await import('/src/sim/replay.js');
  const b = a.screen && a.screen.live && a.screen.live();
  if (!b || b.status === 'won' || b.status === 'lost' || !['battle', 'lesson', 'review'].includes(a.screen.name)) return 'end';
  const cmds = legalCommands(b).filter((c) => c.type !== 'reboard' && (sac ? c.type === 'discard' : c.type !== 'discard'));
  if (!cmds.length) return sac ? 'nosac' : 'none';
  const score = (c) => { try { const t = cloneBattle(b); apply(t, c); return t.status === 'chain' ? legalCommands(t).filter((x) => x.type === 'capture').length : -1; } catch { return -2; } };
  const sc = cmds.map((c, i) => [score(c), i, c]).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
  const top = sc.filter((x) => x[0] === sc[0][0]);
  const c = top[k % top.length][2];
  if (c.type === 'discard') a.screen.sel = [c.index ?? 0];
  a.screen.send(c); return c.type;
};

// ── 1. 첫 화면 · 결과 · 상점 · 도감 · 해금 · 설정 · 알림 · 창 크기
{
  const page = await openPage();
  const h = helpers(page);
  await scene(page, 'title idle 8s', async () => { await h.step(480); await h.hoverAll(/^title:/, 8); await h.move(1, 1, 30); });
  await scene(page, 'battle idle 6s (hand nudge at 2.5s)', async () => {
    await h.ev(BATTLE); await h.move(1, 1, 1); await h.step(360);
  });
  await scene(page, 'battle banner + idle', async () => { await h.ev(BATTLE_OPT, { banner: true }); await h.move(1, 1, 1); await h.step(300); });
  await scene(page, 'battle hover board/hand/maxims', async () => {
    await h.ev(BATTLE); await h.step(20);
    await h.hoverAll(/^(hand:|maxim|fam:|joseki|next$|goal$|box:|pips:|clock|bag$|btn:moves|btn:reboard|faction|sq:)/, 3, 90);
    await h.move(1, 1, 60);
  });
  await scene(page, 'battle select + aim drop squares', async () => {
    await h.ev(BATTLE); await h.step(20);
    await h.press(/^hand:0$/, 30);
    await h.hoverAll(/^sq:/, 2, 64); await h.step(40);
    await h.ev(() => window.__app.key('Escape')); await h.step(30);
    await h.press(/^hand:1$/, 120); await h.move(1, 1, 120);
  });
  await scene(page, 'battle drops/captures/long combo/sacrifice + hover', async () => {
    await h.ev(BATTLE); await h.step(30);
    for (let k = 0; k < 16; k++) {
      await h.settle();
      if (k % 3 === 0) { await h.hoverAll(/^hand:/, 3, 5); await h.hoverAll(/^sq:/, 2, 10); }
      const r = await h.ev(PLAY, { k, sac: k === 2 });
      if (r === 'end') break;
      await h.step(k % 2 ? 2 : 90); // 연출 도중에 가리키기도, 끝까지 보기도
    }
    await h.settle();
    await h.move(240, 200, 1); await h.step(240); // 손이 들썩이는 쉼(2.5초 뒤)
  });
  await scene(page, 'battle master intro (1.5s) + banner', async () => { await h.ev(MASTER); await h.move(1, 1, 1); await h.step(300); });
  await scene(page, 'battle master intro tap skip', async () => { await h.ev(MASTER, { ante: 4 }); await h.step(20); await h.click(240, 135, 2); await h.step(200); });
  await scene(page, 'battle overflow · slam · coins · win confetti', async () => {
    await h.ev(BATTLE); await h.step(20); await h.ev(LOW_TARGET);
    for (let k = 0; k < 6; k++) { await h.settle(); const r = await h.ev(PLAY, { k }); if (r === 'end') break; await h.step(2); }
    await h.settle(); await h.step(240);
  });
  await scene(page, 'shop sheen (fragment card)', async () => { await h.ev(SHOP_SHEEN); await h.move(1, 1, 1); await h.step(420); await h.hoverAll(/^shop:buy/, 20); await h.step(60); });
  await scene(page, 'result won (confetti)', async () => {
    await h.ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 8; r.log.push({ ante: 8, blind: 2, kind: 'master', score: 9000, target: 6000, best: 3000 }); r.phase = 'won'; a.go('result'); });
    await h.step(200); await h.move(1, 1, 60);
  });
  await scene(page, 'battle grade stamp · glow · ring', async () => {
    await h.ev(BATTLE); await h.step(10);
    for (const mark of ['★', '★★★', '∞']) { await h.ev((mark) => window.__app.screen.gradeStamp({ mark }), mark); await h.step(80); }
    await h.ev(() => { const s = window.__app.screen; if (s.glow) s.glow.fading = true; }); await h.step(80);
  });
  await scene(page, 'battle river · gates · highways', async () => { await h.ev(BATTLE_OPT, { rules: { river: true, gates: [27, 36], highways: [2, 5] } }); await h.move(1, 1, 1); await h.step(200); await h.hoverAll(/^sq:/, 2, 20); });
  await scene(page, 'battle gold · torch · trait · open kings', async () => { await h.ev(BATTLE_OPT, { marks: true }); await h.move(1, 1, 1); await h.step(200); await h.hoverAll(/^sq:/, 2, 20); });
  await scene(page, 'battle fog', async () => { await h.ev(BATTLE_OPT, { fog: 3 }); await h.move(1, 1, 1); await h.step(120); });
  await scene(page, 'battle clock blink', async () => {
    await h.ev(BATTLE); await h.step(10);
    await h.ev(() => { const a = window.__app; a.clockFx = { idx: Math.max(0, (a.run.clock || 1) - 1), t: 0 }; }); await h.step(200);
  });
  await scene(page, 'battle lost → review card → replay screen', async () => {
    await h.ev(BATTLE_OPT, { ante: 8, seed: 3 }); await h.step(10);
    for (let k = 0; k < 30; k++) { await h.settle(); const r = await h.ev(PLAY, { k }); if (r === 'end' || r === 'none') break; await h.step(3); }
    await h.settle();
    await h.ev(async () => { const a = window.__app; for (let i = 0; i < 600 && a.screen.name === 'battle' && a.screen.rv && a.screen.rv.phase === 'think'; i++) window.__dcStep(1); });
    await h.step(60); await h.hoverAll(/^btn:/, 6);
    if (await h.press(/^btn:replay$/, 60)) {
      for (let i = 0; i < 6; i++) { await h.press(/^btn:forward$/, 4); await h.ev(async () => { const a = window.__app, s = a.screen; for (let j = 0; j < 900 && s.name === 'review' && (s.busy || s.playing); j++) window.__dcStep(1); }); await h.step(30); }
      await h.press(/^btn:back$/, 30); await h.hoverAll(/^review:/, 6); await h.step(200);
    }
  });
  await scene(page, 'lesson demo + play', async () => {
    await h.ev(() => window.__app.go('lesson', { index: 0, phase: 'demo' })); await h.step(600);
    await h.ev(() => window.__app.go('lesson', { index: 0, phase: 'play' })); await h.step(60);
    for (let k = 0; k < 8; k++) {
      await h.settle();
      const tgt = await h.ev(() => { const s = window.__app.screen; if (s.name !== 'lesson') return null; const st = s.step; if (!st) return null; const id = st.pick != null ? `hand:${st.pick}` : st.discard ? 'btn:discard' : st.moves ? 'btn:moves' : null; if (id) return id; const t = s.clickable(); return t.list.length ? `sq:${t.list[0]}` : null; });
      if (!tgt) break;
      await h.press(new RegExp(`^${tgt}$`), 30);
      if (tgt === 'btn:moves') { await h.hoverAll(/^moves:/, 4, 6); await h.ev(() => window.__app.key('Escape')); await h.step(20); }
    }
    await h.step(200);
  });
  // 「행마」 걸음이 있는 수업(체스 밖의 행마): 행마 단추 숨 쉬는 테 → 행마 보기 → 닫고 이어 두기
  await scene(page, 'lesson moves step', async () => {
    await h.ev(async () => { const { LESSONS } = await import('/src/ui/lessons.js'); window.__app.go('lesson', { index: LESSONS.findIndex((L) => L.id === 'fairy'), phase: 'play' }); }); await h.step(90);
    for (let k = 0; k < 8; k++) {
      await h.settle();
      const tgt = await h.ev(() => { const s = window.__app.screen; if (s.name !== 'lesson') return null; const st = s.step; if (!st) return null; const id = st.pick != null ? `hand:${st.pick}` : st.moves ? 'btn:moves' : null; if (id) return id; const t = s.clickable(); return t.list.length ? `sq:${t.list[0]}` : null; });
      if (!tgt) break;
      await h.press(new RegExp(`^${tgt}$`), 30);
      if (tgt === 'btn:moves') { await h.step(40); await h.hoverAll(/^moves:/, 4, 6); await h.ev(() => window.__app.key('Escape')); await h.step(30); }
    }
    await h.step(240);
  });
  await scene(page, 'draft', async () => {
    await h.ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 21; a.newRun(); if (a.run.phase === 'draft') a.go('draft'); }); await h.step(100);
    await h.hoverAll(/^draft:/, 8); await h.move(1, 1, 30); await h.press(/^draft:1$/, 90);
  });
  await scene(page, 'reward', async () => {
    await h.ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.run.last = { score: 5200, target: 3000, overflow: 1 }; a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 2, overflow: 0, earned: 1, total: 9 }, events: [{ type: 'goldenPack' }] }); });
    await h.step(200); await h.hoverAll(/^next$/, 10); await h.move(1, 1, 60);
  });
  await scene(page, 'master chest', async () => {
    await h.ev(() => window.__app.go('chest', { chest: { count: 5, cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'piece', t: 'R' } }, { lit: true, item: { kind: 'engrave', piece: 'P', eng: 'gold' } }, { lit: true, item: { kind: 'awaken', soul: 'echo' } }] } }));
    await h.step(300); await h.hoverAll(/^chest:/, 6); await h.move(1, 1, 60);
  });
  await scene(page, 'awaken', async () => {
    await h.ev(() => { const a = window.__app; const p = a.run.deck[0]; p.soul = 'echo'; a.go('awaken', { awaken: { soul: 'echo', piece: p.t, pieceId: p.id, src: 'golden' } }); });
    await h.step(150); await h.move(1, 1, 60);
  });
  await scene(page, 'legend', async () => { await h.ev(() => window.__app.go('legend', { legend: 'immortal' })); await h.step(420); await h.hoverAll(/^legend:/, 6); await h.move(1, 1, 60); });
  await scene(page, 'result', async () => {
    await h.ev(() => { const a = window.__app; const r = a.run; if (!r) return; r.log.push({ ante: 3, blind: 0, kind: 'practice', score: 1200, target: 3000, best: 800 }); r.phase = 'lost'; a.go('result'); });
    await h.step(200); await h.hoverAll(/^result:/, 10);
    if (await h.press(/^result:highlight/, 30)) { await h.step(60); await h.hoverAll(/^hl:/, 6); await h.press(/^hl:close/, 20); }
    await h.step(60);
  });
  await scene(page, 'shop hover/buy/reroll/drag', async () => {
    await h.ev(SHOP); await h.step(60);
    await h.hoverAll(/^(shop:buy|shop:hold|shop:pack|deck:|fam:|maxim|joseki|clock)/, 8);
    await h.move(1, 1, 40);
    // 격언 끌기(자리 바꾸기)
    const ms = await h.regions(/^maxim:/);
    if (ms.length > 1) { const [a0, b0] = ms; const [x0, y0] = [a0.x, a0.y]; await h.move(x0, y0, 2); await page.mouse.down(); await h.step(2); for (let i = 1; i <= 8; i++) await h.move(Math.round(x0 + ((b0.x - x0) * i) / 8), Math.round(y0 + ((b0.y - y0) * i) / 8), 2); await page.mouse.up(); await h.step(30); }
    await h.press(/^shop:buy:0$/, 60);
    await h.press(/^shop:hold:1$/, 30);
    await h.press(/^shop:reroll$/, 60);
    await h.press(/^deck:/, 20); await h.step(20); await h.move(1, 1, 30);
    await h.ev(() => window.__app.toast('알림 확인', '#ffffff')); await h.step(200);
  });
  await scene(page, 'shop plain hover/buy/reroll/drag', async () => {
    await h.ev(SHOP_PLAIN); await h.step(60);
    await h.hoverAll(/^(shop:buy|shop:hold|shop:pack|deck:|fam:|maxim|joseki|clock|shop:leave|shop:reroll)/, 8);
    await h.move(1, 1, 60);
    const ms = await h.regions(/^maxim:/);
    if (ms.length > 1) { const [a0, b0] = ms; await h.move(a0.x, a0.y, 2); await page.mouse.down(); await h.step(2); for (let i = 1; i <= 8; i++) await h.move(Math.round(a0.x + ((b0.x - a0.x) * i) / 8), Math.round(a0.y + ((b0.y - a0.y) * i) / 8), 2); await page.mouse.up(); await h.step(40); }
    await h.press(/^shop:hold:0$/, 40);
    await h.press(/^shop:buy:1$/, 80);
    await h.press(/^shop:reroll$/, 80);
    await h.press(/^deck:/, 30); await h.move(1, 1, 30); await h.click(1, 1, 30);
    await h.ev(() => window.__app.toast('알림 확인', '#ffffff')); await h.step(200);
  });
  await scene(page, 'pack open', async () => {
    if (await h.press(/^shop:pack:0$/, 120)) { await h.hoverAll(/^pack:pick/, 8); await h.step(60); await h.press(/^pack:pick:0$/, 120); await h.step(120); }
  });
  await scene(page, 'settings toggles (calm · lang)', async () => {
    await h.ev(SHOP); await h.step(20);
    await h.ev(() => window.__app.openOverlay('settings')); await h.step(30);
    await h.hoverAll(/^set:/, 4);
    for (const id of ['set:shake', 'set:calm', 'set:big', 'set:lang', 'set:coach', 'set:vol+', 'set:vol-']) { await h.press(new RegExp(`^${id}$`), 30); }
    await h.press(/^set:back$/, 30);
    await h.step(120);
    await h.ev(() => window.__app.openOverlay('settings')); await h.step(10);
    for (const id of ['set:calm', 'set:lang', 'set:big', 'set:shake', 'set:coach']) await h.press(new RegExp(`^${id}$`), 20);
    await h.press(/^set:back$/, 60);
  });
  await scene(page, 'settings over codex (calm · lang · big)', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('codex'); }); await h.step(30);
    await h.ev(() => window.__app.openOverlay('settings')); await h.step(60);
    await h.hoverAll(/^set:/, 4);
    for (const id of ['set:calm', 'set:lang', 'set:big', 'set:shake', 'set:vol+', 'set:calm', 'set:lang', 'set:big', 'set:shake', 'set:vol-']) { await h.press(new RegExp(`^${id}$`), 40); }
    await h.press(/^set:back$/, 60);
    await h.hoverAll(/^codex:(?!tab|back)/, 4, 8); await h.step(60);
  });
  await scene(page, 'result (no replay)', async () => {
    await h.ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 3; r.log.push({ ante: 3, blind: 0, kind: 'practice', score: 1200, target: 3000, best: 800 }); r.phase = 'lost'; a.go('result'); });
    await h.step(120); await h.hoverAll(/^result:/, 10); await h.move(1, 1, 120);
  });
  await scene(page, 'codex hover/tabs/pages + toast', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('codex'); }); await h.step(40);
    for (const tab of ['maxims', 'pieces', 'souls', 'factions', 'legends', 'openings', 'editions']) {
      await h.press(new RegExp(`^codex:tab:${tab}$`), 20);
      await h.hoverAll(/^codex:(?!tab|back|prev|next|unlocks)/, 4, 12);
      await h.press(/^codex:next$/, 20); await h.press(/^codex:prev$/, 20);
    }
    await h.ev(() => window.__app.toast('도감 알림', '#ffffff')); await h.step(200);
  });
  await scene(page, 'unlocks', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('unlocks'); }); await h.step(40);
    for (let t = 0; t < 6; t++) await h.press(new RegExp(`^unlocks:${t}$`), 20);
    await h.hoverAll(/^unlock/, 6, 12); await h.step(60);
  });
  await scene(page, 'records · lessons · setup', async () => {
    for (const s of ['records', 'lessons', 'setup']) { await h.ev((s) => { const a = window.__app; a.toTitle(); a.go(s); }, s); await h.step(40); await h.hoverAll(/./, 3, 15); await h.step(30); }
  });
  // 업적 탭(쪽 넘김) · 줄 선 업적 알림(금빛 알림이 0.8초 사이로 뜨고 스러진다)
  await scene(page, 'achievements', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('records', { tab: 'achv' }); }); await h.step(30);
    for (let n = 0; n < 4; n++) { await h.press(/^records:next$/, 15); }
    await h.press(/^records:tab:stats$/, 15); await h.press(/^records:tab:achv$/, 15);
    await h.ev(() => { window.__app.achvQueue.push('combo3', 'mate1'); }); await h.step(260);
  });
  await scene(page, 'resize', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('codex'); }); await h.step(30);
    for (const [w, hh] of [[1000, 600], [VW, VH], [800, 450], [VW, VH]]) { await page.setViewportSize({ width: w, height: hh }); await sleep(300); await h.step(30); }
  });
  await scene(page, 'account text input', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('account'); }); await h.step(30);
    const f = await page.$('input');
    if (f) { await f.click(); await h.step(10); await page.keyboard.type('chain1', { delay: 10 }); await h.step(30); await page.keyboard.press('Tab'); await h.step(30); }
    await h.hoverAll(/^acct|^account/, 6); await h.step(30);
  });
  results.push({ name: '(errors)', errors: page.errors.slice(0, 5) });
  await done(page);
}

// ── 2. 도움말 팁(처음 본 사람) · 처음 켬 덮개 · 튜토리얼 목록
{
  const page = await openPage({ fresh: true });
  const h = helpers(page);
  await scene(page, 'coach hints (shop)', async () => {
    await h.ev(SHOP); await h.step(120);
    for (let i = 0; i < 4; i++) { await h.click(1, 1, 60); await h.step(60); }
  });
  // 처음 켬 덮개(킹이 튜토리얼을 권한다): 킹 들썩임 뒤 쉰다 → 단추를 가리킨다 → 「튜토리얼부터」 → 첫 수업 시범
  await scene(page, 'first-run welcome', async () => {
    await h.ev(() => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.toTitle(); a.welcomeShut = false; a.records.tutorialAsked = false; a.records.runs = 0; a.records.lessonsDone = false; a.records.lessonsSeen = {}; a.records.coachSeen = { telemetry: true }; });
    await h.step(120);
    await h.hoverAll(/^welcome:/, 10); await h.move(1, 1, 60);
    await h.press(/^welcome:lesson$/, 240);
    results.push({ name: '(welcome)', errors: [await page.evaluate(() => `덮개 뒤 화면 ${window.__app.screen.name} · 수업 ${window.__app.screen.index}`)] });
  });
  // 튜토리얼 목록: 반쯤 끝낸 기록 → 칸 · 「이어서」를 가리킨다 → 다 끝낸 끝 카드(금관 반짝임)
  await scene(page, 'tutorial list + end card', async () => {
    await h.ev(async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); a.toTitle(); a.records.tutorialAsked = true; a.records.lessonsSeen = Object.fromEntries(LESSONS.slice(0, 3).map((L) => [L.id, true])); a.go('lessons'); });
    await h.step(40); await h.hoverAll(/^lessons:/, 6); await h.move(1, 1, 60);
    await h.ev(async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); a.records.lessonsSeen = Object.fromEntries(LESSONS.map((L) => [L.id, true])); a.go('lessons', { end: true }); });
    await h.step(120); await h.hoverAll(/^lessons:(play|list)$/, 10); await h.move(1, 1, 30);
    await h.press(/^lessons:list$/, 60);
  });
  results.push({ name: '(errors fresh)', errors: page.errors.slice(0, 5) });
  await done(page);
}

// ── 3. 움직임 줄이기(기기 설정) · 영어
{
  const page = await openPage({ reducedMotion: 'reduce' });
  const h = helpers(page);
  await scene(page, 'title idle 8s (reduced motion)', async () => { await h.step(480); });
  await scene(page, 'battle master intro (reduced motion)', async () => { await h.ev(MASTER); await h.move(1, 1, 1); await h.step(240); });
  await scene(page, 'shop (reduced motion)', async () => { await h.ev(SHOP); await h.step(60); await h.hoverAll(/^(shop:buy|deck:)/, 8); await h.step(60); });
  await scene(page, 'battle (reduced motion)', async () => {
    await h.ev(BATTLE_OPT, { banner: true, marks: true }); await h.move(1, 1, 1); await h.step(240);
    for (let k = 0; k < 10; k++) { await h.settle(); const r = await h.ev(PLAY, { k, sac: k === 1 }); if (r === 'end') break; await h.step(k % 2 ? 3 : 60); }
    await h.settle(); await h.move(1, 1, 1); await h.step(240);
  });
  results.push({ name: '(errors calm)', errors: page.errors.slice(0, 5) });
  await done(page);
}
// ── 4. 순위 · 기기 잇기 · 계정(가짜 서버 — 망 답이 오면 invalidate로 그린다)
{
  const page = await openPage({ rank: true });
  const h = helpers(page);
  await scene(page, 'rank (fake api)', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('rank'); });
    for (let i = 0; i < 20; i++) { await sleep(50); await h.step(3); }
    await h.press(/^rank:tab:yesterday$/, 6); for (let i = 0; i < 20; i++) { await sleep(50); await h.step(3); }
    await h.press(/^rank:tab:today$/, 6); for (let i = 0; i < 10; i++) { await sleep(50); await h.step(3); }
    await h.hoverAll(/^rank:/, 4); await h.step(60);
  });
  await scene(page, 'link (fake api)', async () => {
    await h.ev(() => { const a = window.__app; a.go('link'); });
    for (let i = 0; i < 10; i++) { await sleep(50); await h.step(3); }
    await h.press(/^link:code$/, 6); for (let i = 0; i < 30; i++) { await sleep(50); await h.step(3); }
    for (const d of ['1', '2', '3']) await h.press(new RegExp(`^link:key:${d}$`), 4);
    await h.hoverAll(/^link:/, 4); await h.step(120);
  });
  await scene(page, 'account (fake api)', async () => {
    await h.ev(() => { const a = window.__app; a.go('account'); });
    for (let i = 0; i < 10; i++) { await sleep(50); await h.step(3); }
    const f = await page.$('input');
    if (f) { await f.click(); await h.step(4); await page.keyboard.type('drawchk1', { delay: 5 }); await page.keyboard.press('Tab'); await page.keyboard.type('pass1234', { delay: 5 }); await h.step(10); }
    await h.press(/^acct:signup$|^account:signup$/, 4); for (let i = 0; i < 30; i++) { await sleep(50); await h.step(3); }
    await h.hoverAll(/^acct|^account/, 4); await h.step(60);
  });
  results.push({ name: '(errors rank)', errors: page.errors.slice(0, 5) });
  await done(page);
}
{
  const page = await openPage({ lang: 'en' });
  const h = helpers(page);
  await scene(page, 'english shop · codex', async () => {
    await h.ev(SHOP); await h.step(60); await h.hoverAll(/^(shop:buy|deck:|fam:)/, 6);
    await h.ev(() => { const a = window.__app; a.toTitle(); a.go('codex'); }); await h.step(30); await h.hoverAll(/^codex:(?!tab|back)/, 4, 12);
  });
  results.push({ name: '(errors en)', errors: page.errors.slice(0, 5) });
  await done(page);
}

let total = 0, frames = 0, skips = 0;
console.log(`# drawcheck ${VW}x${VH} — 프레임마다 그리고, 그리기 판단이 「건너뜀」인 프레임의 화소가 지난 프레임과 달라지면 어김`);
for (const r of results) {
  if (r.errors) { if (r.errors.length) console.log(`${r.name}: ${r.errors.join(' | ')}`); continue; }
  total += r.viol; frames += r.frames; skips += r.skips;
  console.log(`${r.name.padEnd(40)} 프레임 ${String(r.frames).padStart(5)} · 건너뜀 ${String(r.skips).padStart(5)} (${r.frames ? Math.round((100 * r.skips) / r.frames) : 0}%) · 어김 ${r.viol} · 화면 ${r.seen.join(',')}${r.hints ? ` · 팁 ${r.hints}프레임` : ''}`);
}
for (const v of details.slice(0, 40)) console.log('  어김', JSON.stringify(v));
console.log(`합계: 프레임 ${frames} · 건너뜀 ${skips} (${frames ? Math.round((100 * skips) / frames) : 0}%) · 어김 ${total}`);
await browser.close();
srv.close();
process.exit(total ? 1 : 0);
