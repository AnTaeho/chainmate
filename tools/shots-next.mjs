// 다음 수(CHM-60) 스크린샷: 손 오른쪽 끝의 다음 둘 · 처음 안내 · 희생 직후(한 칸 당겨짐) · 주머니가 빌 때(하나 · 없음) · 영어(전술 둘 + 다시 놓기로 손 이름표 줄이 꽉 찬 때) · 손 다섯.
//   node tools/shots-next.mjs [--out docs/shots/next-draw] [--scale 1,3]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/next-draw'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
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
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'faction_peasants'];

async function session(sc, lang = 'ko') {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
    await page.mouse.move(x, y); await settle(60);
    await page.mouse.down(); await page.mouse.up(); await settle(30);
  }
  const away = async () => { const [x, y] = await toXY(300, 266); await page.mouse.move(x, y); };
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000, polling: 100 });
  return { page, context, ev, settle, shot, click, away, idle, region };
}

// 1관 연습 대국 하나를 연다. coach: 「다음 수」 처음 안내만 남긴다. tactics: 전술 둘을 쥐여 준다(손 이름표 줄이 꽉 찬 때)
async function battle(s, { coach = false, tactics = false, seed = 21 } = {}) {
  await s.settle(300);
  await s.ev(({ coach, tactics, seed, SEEN }) => {
    const a = window.__app;
    a.settings.coach = coach;
    a.records.coachSeen = Object.fromEntries((coach ? SEEN : [...SEEN, 'next']).map((k) => [k, true]));
    a.nextSeed = seed; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    if (tactics) a.run.consumables = [{ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'reload' }];
    a.cmd({ type: 'play' }); a.go('battle', { events: [] });
    a.screen.banner = null; a.screen.sync();
  }, { coach, tactics, seed, SEEN });
  await s.settle(400);
}

for (const sc of SCALES) {
  // 1 대국 시작: 손 넷 + 다음 둘
  { const s = await session(sc); await battle(s); await s.away(); await s.settle(200); await s.shot('1-next'); await s.context.close(); }
  // 2 처음 안내
  { const s = await session(sc); await battle(s, { coach: true }); await s.away(); await s.settle(900); await s.shot('2-hint'); await s.context.close(); }
  // 3 희생 직후: 보이던 첫째가 「!?」 카드로 들어오고 다음 둘이 한 칸 당겨진다 · 가리키면 왼쪽 칸에 이름
  {
    const s = await session(sc);
    await battle(s);
    await s.away(); await s.settle(200); await s.shot('3a-before-sacrifice');
    await s.click('hand:0'); await s.click('btn:discard'); await s.idle(); await s.settle(400);
    await s.away(); await s.settle(200); await s.shot('3b-sacrificed');
    const r = await s.region('next'); const b = await s.page.locator('#screen').boundingBox();
    await s.page.mouse.move(b.x + ((r.x + 5) * b.width) / 480, b.y + ((r.y + 8) * b.height) / 270); await s.settle(500);
    await s.shot('3c-tip');
    await s.context.close();
  }
  // 4 주머니가 빌 때: 하나 남음 · 다 씀
  {
    const s = await session(sc);
    await battle(s);
    await s.ev(() => { const a = window.__app, b = a.run.battle; b.bag = b.bag.slice(0, 1); a.screen.sync(); });
    await s.away(); await s.settle(200); await s.shot('4a-bag-one');
    await s.ev(() => { const a = window.__app, b = a.run.battle; b.bag = []; a.screen.sync(); });
    await s.away(); await s.settle(200); await s.shot('4b-bag-empty');
    await s.context.close();
  }
  // 5 영어: 전술 둘 + 다시 놓기(손 이름표 줄이 꽉 찬 때) · 희생 직후
  {
    const s = await session(sc, 'en');
    await battle(s, { tactics: true });
    await s.away(); await s.settle(200); await s.shot('5a-next');
    await s.click('hand:0'); await s.click('btn:discard'); await s.idle(); await s.settle(400);
    await s.away(); await s.settle(200); await s.shot('5b-sacrificed');
    await s.context.close();
  }
  // 6 영어 처음 안내
  { const s = await session(sc, 'en'); await battle(s, { coach: true }); await s.away(); await s.settle(900); await s.shot('6-hint'); await s.context.close(); }
  // 7 손 다섯(혼 「귀환」 등): 카드가 가장 좁을 때
  {
    const s = await session(sc);
    await battle(s);
    await s.ev(() => { const a = window.__app, b = a.run.battle; b.hand.push(b.bag.pop()); a.screen.sync(); });
    await s.away(); await s.settle(200); await s.shot('7-hand-five');
    await s.context.close();
  }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
