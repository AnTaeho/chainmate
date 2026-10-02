// 첫 화면 스크린샷(CHM-49): 1배 · 2배 · 3배 창에서 게임이 그 배율로 그린 모습을 찍는다.
//   node tools/shots-title.mjs [--out docs/shots/title] [--scale 1,2,3] [--only 이름]
// 장면: 저장 없음 · 있음(한국어 · 영어), 움직임 줄이기, 먹는 순간 셋(멈칫 · 조각 · 다섯째 번쩍), 창 전체(여백 판이 장면을 잇는지 — 흔들리는 순간).
// 하늘의 사슬 시계(screen.T)와 게임 시계(app.time)를 정해 두고 화면의 update를 멈춰 같은 장면을 찍는다.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/title'));
const ONLY = opt('--only', null);
const SCALES = opt('--scale', '1,2,3').split(',').map(Number);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
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
const { DROP, STEP, A_ANT, A_DASH, CYC } = await import('../src/ui/skychain.js');
const HIT = (s) => DROP + (s - 1) * STEP + A_ANT + A_DASH; // s번째를 먹는 순간

async function open(viewport, { lang = 'ko', save = false, calm = false } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ lang, calm }) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, calm, coach: false }));
  }, { lang, calm });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && window.__app.screen.name === 'title');
  await page.evaluate((save) => {
    const a = window.__app;
    a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
    if (save) { a.newRun({ seed: 7 }); a.run = null; }
    a.go('title');
  }, save);
  await page.mouse.move(1, 1);
  return page;
}
// 시계를 정하고 멈춘다(화면 update를 빼 두면 사슬 시계가 서고, app.time은 덮어써 별 · 단추도 선다)
async function freeze(page, T, time = 7.3) {
  await page.evaluate(({ T, time }) => {
    const a = window.__app, s = a.screen;
    s.update = () => {}; s.T = T;
    const keep = a.update;
    a.update = (dt) => { keep(dt); a.time = time; };
  }, { T, time });
  await page.waitForTimeout(250);
}
async function shot(page, name, sc, { full = false } = {}) {
  if (ONLY && !name.includes(ONLY)) return;
  const tag = sc === 1 ? '' : `@${sc}x`;
  const file = path.join(OUT, `${name}${tag}.png`);
  if (full) await page.screenshot({ path: file });
  else await page.screenshot({ path: file, clip: await page.locator('#screen').boundingBox() });
  console.log('찍음', path.relative(ROOT, file));
}

for (const sc of SCALES) {
  const vp = { width: 480 * sc, height: 270 * sc };
  for (const lang of ['ko', 'en']) {
    for (const save of [false, true]) {
      const page = await open(vp, { lang, save });
      await freeze(page, HIT(2) + 0.62);
      await shot(page, `${lang}-${save ? 'save' : 'nosave'}`, sc);
      await page.close();
    }
  }
  const calm = await open(vp, { calm: true });
  await freeze(calm, 3.3);
  await shot(calm, 'ko-calm', sc);
  await calm.close();
  // 먹는 순간 셋: 둘째의 멈칫(하얗게 번쩍) · 셋째의 조각과 불티 · 다섯째의 화면 번쩍
  const page = await open(vp);
  // 위쪽 자리(y 112 · 108)를 먹고 「×N」이 가장 높이 튄 순간(0.18초, CHM-48): 첫 바퀴 넷째(190, 112) · 둘째 바퀴 둘째(190, 112) · 다섯째(372, 108)
  for (const [name, T] of [['hit-stop', HIT(2) + 0.03], ['hit-shards', HIT(3) + 0.22], ['hit-fifth', HIT(5) + 0.04],
    ['hit-high', HIT(4) + 0.18], ['hit-high-2', CYC + HIT(2) + 0.18], ['hit-high-final', CYC + HIT(5) + 0.18]]) {
    await freeze(page, T);
    await shot(page, name, sc);
  }
  await page.close();
}
// 창 전체(맥북 에어 전체 화면 · 아이패드 세로처럼 여백이 큰 창): 다섯째를 먹고 흔들리는 순간에도 가장자리가 이어지는지
for (const [name, vp] of [['window-wide', { width: 1700, height: 900 }], ['window-tall', { width: 900, height: 1100 }]]) {
  if (!SCALES.includes(3) && !ONLY) continue;
  const page = await open(vp);
  await freeze(page, HIT(5) + 0.12);
  await shot(page, name, 1, { full: true });
  await page.close();
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exitCode = 1; }
