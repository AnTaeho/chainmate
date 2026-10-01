// 두 배 도트 스크린샷(CHM-39): 기물이 그려지는 장면을 1배(창 480×270, 뒷면 N 1)와 3배(창 1440×810, N 3)로 찍는다.
//   node tools/shots-dot2x.mjs [--prefix before|after] [--out docs/shots/dot2x] [--scale 1,3] [--only 이름]
// 장면: 대국(여러 기물 · 금빛 적 · 벽 · 보석 · 각인 · 기보 금) · 상점 · 행마 보기 탭 셋 · 도감 기물 · 타이틀.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/dot2x'));
const ONLY = opt('--only', null);
const SCALES = opt('--scale', '1,3').split(',').map(Number);

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
const port = srv.address().port;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

for (const sc of SCALES) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', coach: false, calm: true }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3, tutorialDone: true }));
    window.__autoDraft = true;
  });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded');
  await page.evaluate(() => { window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = sc === 1 ? '' : `@${sc}x`;
  async function shot(name) {
    if (ONLY && !name.includes(ONLY)) return;
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}${tag}.png`), clip: box });
    console.log('찍음', `${PREFIX}-${name}${tag}`, '뒷면 N', await ev(() => window.__app.scale));
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await settle(80);
  }
  const away = async () => { await page.mouse.move(2, 2); await settle(300); };

  // 타이틀
  await ev(() => { window.__app.go('title'); });
  await away(); await settle(1500);
  await shot('title');

  // 대국: 적 자리를 여러 기물 · 금빛 적으로 바꾸고 벽 · 보석을 놓는다. 손은 각인 넷 + 기보 금
  await ev(() => {
    const a = window.__app;
    a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    Object.assign(r.charts, { N: 5, B: 3, R: 1 });
    const e0 = a.cmd({ type: 'play' });
    const b = r.battle;
    const kinds = ['P', 'N', 'B', 'R', 'Q', 'A', 'C', 'Z', 'L', 'H', 'G', 'O', 'S', 'W'];
    let k = 0;
    b.board.forEach((c, sq) => {
      if (!c || c.mine || c.t === 'K' || c.t === 'X' || c.t === 'J') return;
      c.t = kinds[k % kinds.length];
      c.gold = k % 4 === 1;
      k++;
    });
    const free = [];
    b.board.forEach((c, sq) => { if (!c && sq >= 16) free.push(sq); });
    for (const t of ['A', 'C', 'H', 'G', 'O', 'W', 'Z', 'L', 'S']) { if (k >= kinds.length + 6 || !free.length) break; const sq = free.splice(Math.floor(free.length / 2), 1)[0]; b.board[sq] = { t, id: b.nextId++, born: -1, gold: k % 3 === 0 }; k++; }
    if (free.length) b.board[free.shift()] = { t: 'X', id: b.nextId++, born: -1 };
    if (free.length) b.board[free.pop()] = { t: 'J', id: b.nextId++, born: -1 };
    const hand = [['N', null], ['R', 'gold'], ['B', 'glass'], ['Q', 'feather'], ['P', 'ebony']];
    b.hand = hand.map(([t, eng], i) => ({ id: 900 + i, t, eng: eng ? { id: eng } : null, edition: null }));
    const spec = b.mods.find((m) => m.id === 'charts');
    if (spec) spec.data.levels = { ...r.charts };
    a.go('battle', { events: e0 });
  });
  await settle(2600);
  await away();
  await shot('battle');
  await click('hand:0');
  await away(); await settle(300);
  await shot('battle-pick');

  // 행마 보기 탭 셋(첫 쪽)
  await click('btn:moves');
  for (const tab of ['board', 'basic', 'fairy']) {
    await click(`moves:tab:${tab}`);
    await away();
    let n = 1;
    await shot(`moves-${tab}-${n}`);
    for (let r = await region('moves:next'); r && r.enabled; r = await region('moves:next')) { await click('moves:next'); await away(); await shot(`moves-${tab}-${++n}`); }
  }

  // 상점: 봇이 대국을 끝까지 두고 첫 상점에서 멈춘다
  await ev(async () => {
    const { playRun } = await import('/tools/shopbot.mjs');
    const a = window.__app;
    a.closeOverlay && a.closeOverlay();
    a.newRun({ seed: 11 });
    playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
    a.run.money = 30;
    a.fx.clear();
    a.goPhase();
  });
  await away(); await settle(900);
  await shot('shop');

  // 도감 기물(쪽마다)
  await ev(() => { const a = window.__app; a.closeOverlay && a.closeOverlay(); a.go('codex'); a.screen.tab = 'pieces'; a.screen.page = 0; });
  await away();
  await shot('codex-pieces-1');
  if (await region('codex:next')) { await ev(() => { window.__app.screen.page = 1; }); await away(); await shot('codex-pieces-2'); }
  await context.close();
}
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
