// CHM-50 사람 판 기록: 브라우저(Playwright chromium)에서 실제 화면으로 판을 봇으로 두어 끝내고(대국은 tools/bot.mjs, 상점은 떠나기),
// 설정 「기록 내보내기」를 눌러 받은 JSON을 남긴다. 설정 화면을 1배 · 3배(한국어 · 영어)로 찍는다.
//   node tools/shots-human-runs.mjs [--out docs/shots/human-runs] [--json <받은 JSON 둘 곳>] [--scale 1,3] [--runs 2]
// 받은 JSON은 node tools/humans.mjs <파일>로 요약한다. Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/human-runs'));
const JSON_OUT = opt('--json', null);
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const RUNS = Number(opt('--runs', 2));

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

async function session(sc, lang = 'ko', keep = null) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(([lang, keep]) => {
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.clear();
      if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, coach: false }));
      else localStorage.setItem('chainmate.settings.v1', JSON.stringify({ coach: false }));
      if (keep) localStorage.setItem('chainmate.runs.v1', keep);
    }
  }, [lang, keep]);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 9));
    await page.mouse.move(x, y); await settle(60);
    await page.mouse.down(); await page.mouse.up(); await settle(60);
  }
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
  }
  return { page, context, ev, settle, click, shot };
}

// 판 하나를 봇으로: 레퍼토리 첫째 · 대국은 bot.mjs stepBattle · 상점과 꾸러미는 떠난다. stopAfter: 대국 수(그만둔 판 만들기)
async function playRun(s, { seed = null, title = false, stopAfter = Infinity } = {}) {
  await s.ev(async ([seed, title, stopAfter]) => {
    const a = window.__app;
    const { stepBattle } = await import('/tools/bot.mjs');
    if (title) a.screen.items().find(([id]) => id === 'title:new')[2]();
    else { a.nextSeed = seed; a.newRun(); }
    let battles = 0;
    await new Promise((ok) => setTimeout(ok, 1500)); // 판 시간(실제 초)이 쌓이게 프레임을 1.5초 돌린다
    for (let g = 0; g < 4000 && a.run && a.run.phase !== 'lost' && a.run.phase !== 'won'; g++) {
      const ph = a.run.phase;
      if (ph === 'draft') a.cmd({ type: 'joseki', index: 0 });
      else if (ph === 'select') { if (battles >= stopAfter) break; a.cmd({ type: 'play' }); }
      else if (ph === 'battle') { if (!stepBattle(a.run.battle, (c) => a.cmd(c), {})) break; if (a.run.phase !== 'battle') battles++; }
      else if (ph === 'shop') a.cmd({ type: 'leave' });
      else if (ph === 'pack') a.cmd({ type: 'skipPack' });
      // 판 시간이 흐르게 프레임을 조금씩 돌린다
      if (g % 20 === 0) await new Promise((ok) => setTimeout(ok, 16));
    }
    a.fx.clear(); a.goPhase();
  }, [seed, title, stopAfter]);
  await s.settle(400);
}

// ── 판을 두고 내보내기(한국어 1배)
const s = await session(1);
await playRun(s, { title: true });                       // 처음 켬: 킹과 두는 대본 대국으로 시작한 판
for (let i = 1; i < RUNS; i++) await playRun(s, { seed: 4242 + i });
await playRun(s, { seed: 777, stopAfter: 2 });           // 대국 둘만 두고
await playRun(s, { seed: 778, stopAfter: 0 });           // 새 판으로 덮어쓴다 → 앞 판은 「그만둠」
await s.ev(() => window.__app.toTitle());
await s.settle(300);
await s.click('title:settings').catch(async () => { await s.ev(() => window.__app.openOverlay('settings')); });
await s.settle(300);
const [download] = await Promise.all([s.page.waitForEvent('download', { timeout: 10000 }), s.click('set:export')]);
const got = JSON_OUT ? path.resolve(JSON_OUT) : path.join(OUT, download.suggestedFilename());
fs.mkdirSync(path.dirname(got), { recursive: true });
await download.saveAs(got);
const toast = await s.ev(() => (window.__app.toasts.at(-1) || {}).msg);
console.log('받음', download.suggestedFilename(), '→', got, `(${fs.statSync(got).size} 바이트) · 알림 「${toast}」`);
await s.settle(150);
await s.shot('settings-exported');
const keep = await s.ev(() => localStorage.getItem('chainmate.runs.v1'));
const sizes = await s.ev(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])));
console.log('저장 크기(글자 수):', JSON.stringify(sizes));
await s.context.close();

// ── 설정 화면(판 기록이 있는 채로) 1배 · 3배, 한국어 · 영어
for (const lang of ['ko', 'en']) for (const sc of SCALES) {
  const t = await session(sc, lang, keep);
  await t.ev(() => window.__app.openOverlay('settings'));
  await t.settle(400);
  await t.page.mouse.move(1, 1);
  await t.shot('settings');
  await t.context.close();
}

await browser.close();
srv.close();
if (errors.length) { console.error('페이지 오류', errors); process.exit(1); }
