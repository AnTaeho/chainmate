// 장면 몇 개를 마우스를 치운 채 찍는다: node scenes.mjs <ko|en>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import('/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs');
const ROOT = '/Users/antaeho/workspace/projects/chainmate';
const [LANG = 'ko'] = process.argv.slice(2);
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', `${LANG}-scenes`);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, LANG);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => { await page.mouse.move(2, 2); await wait(900); const f = path.join(OUT, `${name}.png`); await page.screenshot({ path: f }); console.log('SHOT', f); };
  const go = (fn) => ev(fn);
  await wait(1200);
  await shot('01-title-welcome');
  await go(() => window.__app.overlay && window.__app.overlay.choose('play'));
  await wait(2000);
  await shot('02-draft');
  await go(() => { const s = window.__app.screen; s.pick ? s.pick(0) : null; });
  await wait(2500);
  await shot('03-after-draft');
  // 설정 · 멈춤 · 용어 사전 · 튜토리얼 목록
  await go(() => window.__app.openOverlay('pause')); await shot('04-pause');
  await go(() => window.__app.openOverlay('settings', { back: 'pause' })); await shot('05-settings-inrun');
  await go(() => window.__app.closeOverlay());
  // 결과 화면: 판을 잃은 것으로
  await go(async () => {
    const a = window.__app; const r = a.run;
    // 지는 대국을 강제로: 시계를 다 쓴 상태로 결과
    r.phase = 'lost'; a.keepRun(r, 'lost'); a.save(); a.goPhase();
  });
  await wait(1500); await shot('06-result-lost');
  await go(() => window.__app.toTitle()); await wait(800); await shot('07-title-after');
  await go(() => window.__app.go('lessons')); await shot('08-lessons-list');
  await go(() => { window.__app.screen.terms = true; }); await shot('09-glossary');
  await go(() => window.__app.go('records')); await shot('10-records');
  await go(() => window.__app.go('codex')); await shot('11-codex');
  await go(() => window.__app.go('rank')); await wait(1500); await shot('12-rank');
  await go(() => window.__app.go('setup')); await shot('13-setup');
  await go(() => window.__app.openOverlay('settings')); await shot('14-settings-title');
  console.log('errors', errors.length, errors.join(' / '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
