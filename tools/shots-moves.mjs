// 행마 보기 탭 스크린샷(CHM-26): 대국에서 「행마」를 열고 이 판 · 기본 기물 · 특수 기물(쪽마다)을 1배(창 480×270)와 3배(창 1440×810)로 찍는다.
//   node tools/shots-moves.mjs [--out docs/shots/moves-tabs] [--lang ko,en] [--scale 1,3]
// 손 두 장을 포 · 메뚜기로 바꿔 「새로」가 보이게 한다. Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/moves-tabs'));
const LANGS = opt('--lang', 'ko,en').split(',');
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

for (const lang of LANGS) for (const sc of SCALES) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => { localStorage.clear(); localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, coach: false })); window.__autoDraft = true; }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
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

  await ev(() => {
    const a = window.__app;
    a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
    a.records.movesSeen = {};
    a.newRun({ seed: 11 });
    a.cmd({ type: 'play' });
    const b = a.run.battle;
    b.hand[0] = { ...b.hand[0], t: 'O' };
    if (b.hand[1]) b.hand[1] = { ...b.hand[1], t: 'G' };
    a.go('battle', { events: [] });
  });
  await settle(2600);
  await click('btn:moves');
  for (const tab of ['board', 'basic', 'fairy']) {
    await click(`moves:tab:${tab}`);
    await away();
    let n = 1;
    await shot(`moves-${tab}-${n}`);
    for (let r = await region('moves:next'); r && r.enabled; r = await region('moves:next')) {
      await click('moves:next'); await away();
      await shot(`moves-${tab}-${++n}`);
    }
  }
  await context.close();
}
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
