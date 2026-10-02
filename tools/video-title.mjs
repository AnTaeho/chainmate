// 첫 화면 짧은 영상(CHM-49, 약 10초): 폰이 떨어져 다섯을 먹고 사라지고 새 폰이 떨어지는 한 바퀴 반, 메뉴를 키보드로 한 번 옮긴다.
//   node tools/video-title.mjs [--out docs/media] [--seconds 10]  → <out>/title.mp4(1440×810, 게임이 3배로 그린 화면, 30fps, H.264, 소리 없음)
// 녹화 방식은 tools/video.mjs와 같다: requestAnimationFrame을 잡아 1/30초씩 손으로 돌리며 한 장씩 찍는다(벽시계와 상관없이 같은 영상).
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역). ffmpeg는 PATH에서 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const SECONDS = Number(opt('--seconds', 10));
const W = 1440, H = 810, FPS = 30;

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  window.__raf = null;
  window.requestAnimationFrame = (cb) => { window.__raf = cb; return 1; };
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ coach: false }));
});
await page.goto(`http://localhost:${srv.address().port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen && window.__raf);
const n = await page.evaluate(() => window.__fit.n);
if (n !== 3) throw new Error(`뒷면 배율이 3이 아니다(${n})`);
await page.evaluate(() => { const a = window.__app; a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); a.go('title'); });

fs.mkdirSync(OUT, { recursive: true });
const mp4 = path.join(OUT, 'title.mp4');
const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, no) => enc.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg ' + c)))));
const total = Math.round(SECONDS * FPS);
for (let F = 1; F <= total; F++) {
  // 6초쯤 키보드로 아이콘 줄을 한 칸씩 옮겨 고른 칸이 들썩이는 모습을 보인다
  const key = F === 6 * FPS ? 'ArrowDown' : F === Math.round(6.6 * FPS) || F === Math.round(7.2 * FPS) ? 'ArrowRight' : F === Math.round(8.4 * FPS) ? 'ArrowUp' : null;
  await page.evaluate(({ T, key }) => {
    if (key) window.__app.key(key);
    const cb = window.__raf; window.__raf = null;
    if (cb) cb(T);
  }, { T: (F * 1000) / FPS, key });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: 'png' });
  if (!enc.stdin.write(png)) await new Promise((ok) => enc.stdin.once('drain', ok));
}
enc.stdin.end();
await done;
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 3)); process.exitCode = 1; }
console.log('영상', path.relative(ROOT, mp4), `${SECONDS}초 · ${total}장`);
