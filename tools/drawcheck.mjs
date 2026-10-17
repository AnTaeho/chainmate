// 그릴 때만 그리기 확인(CHM-75, docs/design-notes/layout.md 「빛과 움직임」 · 「그릴 때만 그린다」): 실제 브라우저(Playwright 크로미움 — GPU)로 게임을 열어
// 프레임마다 그리되(alwaysDraw) 그리기 판단(app.lastWant)은 그대로 셈한다. 판단이 「안 그려도 된다」였는데 캔버스가 지난 프레임과 달라진 프레임이 어김이다.
//   node tools/drawcheck.mjs [--scale 1440x810] [--only title,shop,...]
// 게임 루프(requestAnimationFrame)를 도구가 잡아 1/60초씩 돌리고, 프레임마다 캔버스 화소를 지난 프레임과 견준다.
// 장면: 첫 화면(움직임 줄이기 포함) · 첫 판 대본 대국 · 실제 대국(놓기 · 잡기 · 콤보 · 가리킴) · 상점(가리킴 · 끌기 · 사기 · 리롤) · 팩 열기 ·
//   도감(가리킴 · 탭 · 쪽 넘김) · 해금 · 설정 바꾸기(움직임 줄이기 · 말) · 결과 · 알림 · 도움말 팁 · 하이라이트 · 계정 입력 칸 · 창 크기 바꾸기.
// 정적 파일은 도구가 스스로 띄운 서버(127.0.0.1:8793)로 연다. Playwright는 저장소 의존성에 넣지 않는다 — PLAYWRIGHT(index.mjs 경로) · 'playwright' · 전역 순.
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
const PORT = 8793;

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

// ── 정적 서버(여러 모듈을 한꺼번에 받아도 끊기지 않게 Node로)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
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

async function openPage({ reducedMotion = 'no-preference', lang = 'ko', fresh = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(INIT);
  await page.addInitScript(({ lang }) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ volume: 0, music: 0, lang, telemetry: false }));
  }, { lang });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => window.__app && window.__raf);
  await page.evaluate((fresh) => {
    const a = window.__app;
    a.alwaysDraw = true; // 늘 그리되 판단은 셈한다
    if (!fresh) a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
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

// ── 1. 첫 화면 · 결과 · 상점 · 도감 · 해금 · 설정 · 알림 · 창 크기
{
  const page = await openPage();
  const h = helpers(page);
  await scene(page, 'title idle 8s', async () => { await h.step(480); await h.hoverAll(/^title:/, 8); await h.move(1, 1, 30); });
  await scene(page, 'battle drops/captures/combo + hover', async () => {
    await h.ev(BATTLE); await h.step(30);
    for (let k = 0; k < 10; k++) {
      await h.settle();
      await h.hoverAll(/^hand:/, 5, 6);
      await h.hoverAll(/^sq:/, 2, 8);
      const done = await page.evaluate(async (k) => {
        const a = window.__app; const { legalCommands } = await import('/src/sim/battle.js');
        const b = a.run.battle; if (!b || b.status === 'won' || b.status === 'lost' || a.screen.name !== 'battle') return true;
        const cmds = legalCommands(b).filter((c) => c.type !== 'reboard');
        const drops = cmds.filter((c) => c.type === 'drop');
        const c = (drops.length ? drops : cmds)[(k * 7) % (drops.length || cmds.length)];
        if (!c) return true;
        a.screen.send(c); return false;
      }, k);
      if (done) break;
      await h.settle();
    }
    await h.move(240, 200, 1); await h.step(240); // 손이 들썩이는 쉼(2.5초 뒤)
  });
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

// ── 2. 도움말 팁(처음 본 사람) · 첫 판 대본 대국
{
  const page = await openPage({ fresh: true });
  const h = helpers(page);
  await scene(page, 'coach hints (shop)', async () => {
    await h.ev(SHOP); await h.step(120);
    for (let i = 0; i < 4; i++) { await h.click(1, 1, 60); await h.step(60); }
  });
  await scene(page, 'tutorial script battle', async () => {
    await h.ev(() => { const a = window.__app; a.toTitle(); a.records.kingDone = false; a.records.runs = 0; a.records.lessonsDone = 0; a.newRun({ script: true }); });
    for (let i = 0; i < 40; i++) {
      await h.step(40);
      await h.settle();
      const tgt = await page.evaluate(() => {
        const a = window.__app, g = a.guide; if (!g) return null;
        const ok = a.ui.regions.find((q) => q.id === 'guide:ok'); if (ok) return [ok.x + ok.w / 2, ok.y + ok.h / 2];
        const st = g.steps[g.i]; if (!st) return null;
        const id = typeof st.target === 'function' ? st.target(a) : st.target;
        const q = id && a.ui.regions.find((x) => x.id === id);
        return q ? [q.x + q.w / 2, q.y + q.h / 2] : null;
      });
      if (!tgt) { if (!(await page.evaluate(() => !!window.__app.guide))) break; continue; }
      await h.click(Math.floor(tgt[0]), Math.floor(tgt[1]), 4);
    }
    await h.step(120);
  });
  results.push({ name: '(errors fresh)', errors: page.errors.slice(0, 5) });
  await done(page);
}

// ── 3. 움직임 줄이기(기기 설정) · 영어
{
  const page = await openPage({ reducedMotion: 'reduce' });
  const h = helpers(page);
  await scene(page, 'title idle 8s (reduced motion)', async () => { await h.step(480); });
  await scene(page, 'shop (reduced motion)', async () => { await h.ev(SHOP); await h.step(60); await h.hoverAll(/^(shop:buy|deck:)/, 8); await h.step(60); });
  results.push({ name: '(errors calm)', errors: page.errors.slice(0, 5) });
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
