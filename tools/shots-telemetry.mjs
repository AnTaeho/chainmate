// CHM-63 기록 보내기: 브라우저(Playwright 크로미움 · 웹킷)에서 ① 로컬 서버로 열어 판을 조금 두는 동안 수집 주소로 나간 요청을 센다(0건이어야 한다)
// ② 첫 화면 알림 · 설정 화면(한국어 · 영어)을 찍는다 ③ 배포 주소인 척 열어(주소 · 수집 주소 모두 가로챈다 — 밖으로는 아무것도 안 나간다) 묶음이 실제로 나가는지 본다.
//   node tools/shots-telemetry.mjs [--out docs/shots/telemetry] [--scale 3]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/telemetry'));
const SC = Number(opt('--scale', 3));
const COLLECT = 'us.i.posthog.com';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const fileOf = (url) => {
  const u = decodeURIComponent(new URL(url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  return p.startsWith(ROOT) && fs.existsSync(p) && !fs.statSync(p).isDirectory() ? p : null;
};
const srv = http.createServer((req, res) => {
  const p = fileOf(req.url);
  if (!p) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

// 판을 조금 둔다: 새 판 → 레퍼토리 → 두기 → 명령 몇 개 → 화면을 떠나는 사건
const PLAY = () => {
  const app = window.__app;
  app.records.kingDone = true; app.records.runs = 1;
  app.newRun({ seed: 7 });
  if (app.run.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
  app.cmd({ type: 'play' });
  app.goPhase();
  app.openOverlay('settings');
  window.dispatchEvent(new Event('error'));
  window.dispatchEvent(new Event('pagehide'));
  return { webdriver: navigator.webdriver, host: location.hostname, tid: localStorage.getItem('chainmate.tid.v1') };
};

async function open(browser, { lang = 'ko', url = `http://localhost:${port}/index.html`, live = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 480 * SC, height: 270 * SC }, deviceScaleFactor: 1 });
  const out = { requests: [], batches: [] };
  if (live) {
    // 배포 주소를 로컬 파일로, 수집 주소를 가짜 답으로 가로챈다
    await context.route('https://chainmate.papercut.kr/**', (route) => {
      const p = fileOf(route.request().url());
      return p ? route.fulfill({ status: 200, contentType: TYPES[path.extname(p)] || 'application/octet-stream', body: fs.readFileSync(p) }) : route.fulfill({ status: 404, body: '' });
    });
    await context.route(`https://${COLLECT}/**`, (route) => {
      const r = route.request();
      out.batches.push({ method: r.method(), type: r.headers()['content-type'] || '', events: (JSON.parse(r.postData() || '{}').batch || []).map((e) => e.event) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"status":"Ok"}' });
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (r.url().includes(COLLECT) || r.url().includes('posthog')) out.requests.push(`${r.method()} ${r.url()}`); });
  await page.addInitScript((lang) => {
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.clear();
      if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang }));
    }
  }, lang);
  await page.goto(url);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const settle = (ms) => page.waitForTimeout(ms);
  const region = (id) => page.evaluate((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
  const point = async (id) => { const r = await region(id); if (!r) throw new Error(`no region ${id}`); const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 9)); await page.mouse.move(x, y); await settle(80); };
  const click = async (id) => { await point(id); await page.mouse.down(); await page.mouse.up(); await settle(80); };
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: await page.locator('#screen').boundingBox() }); console.log('찍음', name); };
  return { page, context, out, settle, point, click, shot };
}

// ① 로컬 서버: 엔진마다 판을 두어도 0건(자동화 브라우저 + localhost). 크로미움은 자동화 표시를 지운 채로도(localhost만으로) 0건
const zero = [];
for (const [name, type, launch] of [['chromium', pw.chromium, {}], ['webkit', pw.webkit, {}], ['chromium(자동화 표시 없음)', pw.chromium, { args: ['--disable-blink-features=AutomationControlled'] }]]) {
  const browser = await type.launch(launch);
  const s = await open(browser);
  await s.settle(400);
  const info = await s.page.evaluate(PLAY);
  await s.settle(600);
  zero.push(`${name} ${s.out.requests.length}건(webdriver ${info.webdriver} · ${info.host} · 익명 ID ${info.tid ? '만듦' : '없음'})`);
  if (s.out.requests.length || info.tid) errors.push(`${name}: 로컬에서 기록이 나갔다 ${s.out.requests.join(' ')}`);
  await browser.close();
}
console.log(`로컬 서버 → ${COLLECT} 요청: ${zero.join(' · ')}`);

// ② 스크린샷: 첫 화면 알림 · 설정(가리키기 전 · 기록 보내기를 가리킨 때 · 끈 때), 한국어 · 영어
for (const [engine, type] of [['', pw.chromium], ['-webkit', pw.webkit]]) {
  const browser = await type.launch();
  for (const lang of ['ko', 'en']) {
    const tag = `${lang === 'ko' ? '' : '-en'}${engine}@${SC}x`;
    const s = await open(browser, { lang });
    // 하늘의 사슬이 조용한 때를 기다린다
    await s.settle(700);
    await s.shot(`title-note${tag}`);
    await s.click('title:settings');
    await s.page.mouse.move(4, 4); await s.settle(120);
    await s.shot(`settings${tag}`);
    await s.point('set:telemetry');
    await s.shot(`settings-point${tag}`);
    await s.click('set:telemetry');
    await s.shot(`settings-off${tag}`);
    await s.click('set:telemetry');
    await s.click('set:back');
    await s.page.mouse.move(4, 4); await s.settle(200);
    await s.shot(`title-after${tag}`);
    await s.context.close();
  }
  await browser.close();
}

// ③ 배포 주소인 척: 묶음이 실제로 나가는가(가로채서 밖으로는 안 나간다). 자동화 표시를 지워야 조건이 맞는다
{
  const browser = await pw.chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const s = await open(browser, { url: 'https://chainmate.papercut.kr/index.html', live: true });
  await s.settle(400);
  const info = await s.page.evaluate(PLAY);
  await s.settle(800);
  const names = s.out.batches.flatMap((b) => b.events);
  console.log(`배포 주소인 척(가로챔, webdriver ${info.webdriver} · ${info.host}): 묶음 ${s.out.batches.length}개 · 사건 ${names.length}건 [${names.join(', ')}] · ${[...new Set(s.out.batches.map((b) => `${b.method} ${b.type}`))].join(' / ')}`);
  if (!names.includes('app_open') || !names.includes('run_start') || !names.includes('$exception')) errors.push('배포 주소인 척: 묶음이 나가지 않았다');
  // 같은 조건에서 자동화 표시가 있으면 0건
  const auto = await pw.chromium.launch();
  const a = await open(auto, { url: 'https://chainmate.papercut.kr/index.html', live: true });
  await a.settle(400);
  await a.page.evaluate(PLAY);
  await a.settle(600);
  console.log(`배포 주소인 척 + 자동화 브라우저: 묶음 ${a.out.batches.length}개`);
  if (a.out.batches.length) errors.push('자동화 브라우저에서 기록이 나갔다');
  await auto.close();
  await browser.close();
}
srv.close();
console.log(errors.length ? `어긋남 ${errors.length}: ${errors.join(' | ')}` : '어긋남 0');
process.exit(errors.length ? 1 : 0);
