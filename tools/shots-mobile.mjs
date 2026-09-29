// 화면 맞춤 스크린샷(CHM-28): 기기를 흉내 내어 창 전체를 찍는다(게임 캔버스 밖의 가장자리까지).
//   node tools/shots-mobile.mjs [--prefix before|after] [--out docs/shots/mobile] [--only 기기이름] [--engine webkit|chromium]
// 기기마다 타이틀 · 대국 · 상점을 찍고, 캔버스 크기(CSS · 뒷면)를 표로 적는다. 폰 세로는 세로 안내 화면이 뜬다.
// 터치가 있는 기기는 page.touchscreen.tap으로 「새 판」 → 대본 대국 첫 수(나이트 떨구기 → 룩 → 퀸)까지 눌러 본다.
// 폰 · 태블릿은 webkit(없으면 chromium 기기 흉내), 데스크톱은 chromium.
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
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/mobile'));
const ONLY = opt('--only', null);
const ENGINE = opt('--engine', null);

// 이름 · 창(CSS) · dpr · 터치 · 엔진
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DEVICES = [
  { name: 'iphone15-portrait', w: 393, h: 659, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  { name: 'iphone15-landscape', w: 734, h: 343, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  // 홈 화면에 추가해 전체 화면으로 열었을 때(주소창 없음)
  { name: 'iphone15-fullscreen', w: 852, h: 393, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  { name: 'ipad-portrait', w: 810, h: 1080, dpr: 2, touch: true, engine: 'webkit', ua: UA_IPAD },
  { name: 'ipad-landscape', w: 1080, h: 810, dpr: 2, touch: true, engine: 'webkit', ua: UA_IPAD },
  { name: 'mac-1920x960', w: 1920, h: 960, dpr: 2, touch: false, engine: 'chromium' },
  // 사람이 보낸 맥 사파리 전체 화면(1440×810이 뜬 창) — 맥북 에어 13형 기본 해상도
  { name: 'mac-1470x956', w: 1470, h: 956, dpr: 2, touch: false, engine: 'chromium' },
  { name: 'desktop-1280x720', w: 1280, h: 720, dpr: 1, touch: false, engine: 'chromium' },
];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
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
const pw = await loadPlaywright();
const browsers = {};
async function browserFor(engine) {
  if (ENGINE) engine = ENGINE;
  if (!browsers[engine]) {
    try { browsers[engine] = await pw[engine].launch(); } catch (e) {
      if (engine === 'chromium') throw e;
      console.log(`${engine}를 못 열어 chromium 기기 흉내로 찍는다: ${String(e).split('\n')[0]}`);
      return browserFor('chromium');
    }
  }
  return browsers[engine];
}
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const table = [];

async function session(d, { fresh = false } = {}) {
  const browser = await browserFor(d.engine);
  const context = await browser.newContext({
    viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, hasTouch: d.touch,
    // webkit은 isMobile을 모른다
    ...(d.touch && browser.browserType().name() === 'chromium' ? { isMobile: true } : {}),
    ...(d.ua ? { userAgent: d.ua } : {}),
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${d.name}: ${String(e)}`));
  await page.addInitScript((fresh) => { if (!fresh) window.__autoDraft = true; }, fresh);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  if (!fresh) await page.evaluate(() => { localStorage.clear(); window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  else await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(400); // 크기 다시 고르기(늦춘 resize)가 끝나게
  return { context, page, ev: (fn, arg) => page.evaluate(fn, arg), settle: (ms) => page.waitForTimeout(ms) };
}

async function shotsFor(d) {
  const { context, page, ev, settle } = await session(d);
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${d.name}-${name}.png`) });
    console.log('찍음', `${PREFIX}-${d.name}-${name}`);
  };
  const size = await ev(() => {
    const c = document.getElementById('screen');
    const r = c.getBoundingClientRect();
    const turn = document.getElementById('turn');
    const turned = !!(turn && getComputedStyle(turn).display !== 'none');
    return { cssW: Math.round(r.width * 100) / 100, cssH: Math.round(r.height * 100) / 100, left: r.left, top: r.top, back: `${c.width}×${c.height}`, turned, scale: window.__app.scale };
  });
  table.push({ name: d.name, view: `${d.w}×${d.h}`, dpr: d.dpr, ...size });
  // 타이틀
  await ev(() => { window.__app.go('title'); });
  await settle(1200);
  await shot('title');
  // 대국(판 11, 첫 대국)
  await ev(() => { const a = window.__app; a.newRun({ seed: 11 }); a.cmd({ type: 'play' }); a.go('battle', { events: [] }); });
  await settle(2600);
  await shot('battle');
  // 상점: 봇이 대국을 끝까지 두고 첫 상점에서 멈춘다
  await ev(async () => {
    const { playRun } = await import('/tools/shopbot.mjs');
    const a = window.__app;
    a.newRun({ seed: 11 });
    playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
    a.run.money = 30; a.fx.clear(); a.goPhase();
  });
  await settle(900);
  await shot('shop');
  // 멈춤 덮개(판 밖 가장자리도 같이 어두워지나)
  await ev(() => window.__app.openOverlay('pause'));
  await settle(300);
  await shot('pause');
  await context.close();
}

// 터치로 새 판 → 대본 대국 첫 수. 걸음 번호가 5(첫 수 끝 — 「점수」 설명)에 닿으면 된 것
async function touchFlow(d) {
  const { context, page, ev, settle } = await session(d, { fresh: true });
  const turned = await ev(() => { const t = document.getElementById('turn'); return !!(t && getComputedStyle(t).display !== 'none'); });
  if (turned) { await context.close(); return { name: d.name, result: '세로 안내(건너뜀)' }; }
  const toXY = async (id) => {
    const r = await ev((id) => { const q = window.__app.ui.regions.find((x) => x.id === id); return q && { x: q.x, y: q.y, w: q.w, h: q.h }; }, id);
    if (!r) return null;
    const b = await page.locator('#screen').boundingBox();
    return [b.x + ((r.x + r.w / 2) * b.width) / 480, b.y + ((r.y + Math.min(r.h / 2, 16)) * b.height) / 270];
  };
  const tap = async (id) => { const p = await toXY(id); if (!p) throw new Error(`no region ${id}`); await page.touchscreen.tap(p[0], p[1]); await settle(120); };
  const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 30000 });
  const log = [];
  try {
    await settle(300);
    await tap('title:new');
    for (let guard = 0; guard < 16; guard++) {
      await ready();
      const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const s = g.steps[g.i]; return { i: g.i, ok: !!s.ok, target: typeof s.target === 'function' ? s.target(a) : s.target }; });
      if (!st || st.i >= 5) { log.push(st ? `걸음 ${st.i}` : '길 없음'); break; }
      const id = st.ok ? 'guide:ok' : st.target;
      await tap(id);
      // 손가락은 먹기 · 떨구기를 한 번 누르면 미리 보기, 한 번 더 누르면 둔다
      let after = await ev(() => window.__app.guide && window.__app.guide.i);
      if (after === st.i) { await tap(id); after = await ev(() => window.__app.guide && window.__app.guide.i); log.push(`${st.i}:${id}×2`); } else log.push(`${st.i}:${id}`);
    }
    await settle(1500);
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${d.name}-touch-first-move.png`) });
  } catch (e) { log.push(`막힘 ${String(e).split('\n')[0]}`); }
  const i = await ev(() => window.__app.guide && window.__app.guide.i);
  await context.close();
  return { name: d.name, result: i >= 5 ? `첫 수 끝(걸음 ${i})` : `멈춤(걸음 ${i})`, log: log.join(' → ') };
}

const touchResults = [];
for (const d of DEVICES) {
  if (ONLY && !d.name.includes(ONLY)) continue;
  await shotsFor(d);
  if (d.touch) touchResults.push(await touchFlow(d));
}
for (const b of Object.values(browsers)) await b.close();
srv.close();
console.log('\n기기 | 창 | dpr | 캔버스 CSS | 뒷면 | 왼쪽·위 | 세로 안내');
for (const r of table) console.log(`${r.name} | ${r.view} | ${r.dpr} | ${r.cssW}×${r.cssH} | ${r.back} | ${r.left},${r.top} | ${r.turned ? '예' : '아니오'}`);
console.log('\n터치 흐름');
for (const r of touchResults) console.log(`${r.name}: ${r.result}${r.log ? ` (${r.log})` : ''}`);
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
