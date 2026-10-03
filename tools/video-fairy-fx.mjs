// 특수 기물 연출 짧은 영상(15초 안, CHM-57): 꺾쇠 두 번 꺾기 → 물수제비 두 번 튕기기 → 까마귀 잇따라 넘기 → 화약병 터짐 → 결과 다시 보기.
//   node tools/video-fairy-fx.mjs [--out docs/media]  → <out>/fairy-fx.mp4 (1440×810, 게임이 3배로 그린 화면, H.264)
// 장면 판은 tools/fairy-fx-scenes.mjs. Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역). ffmpeg는 PATH에서 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENES, REPLAY, pageScene, pageResult } from './fairy-fx-scenes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const RAW = path.join(OUT, 'raw-fairy-fx');
const W = 1440, H = 810, MAX = 15;

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
fs.mkdirSync(RAW, { recursive: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: RAW, size: { width: W, height: H } } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.addInitScript(() => localStorage.clear());
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const sqOf = (k) => (Number(k[1]) - 1) * 8 + 'abcdefgh'.indexOf(k[0]);
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
async function click(id, ms = 120) {
  const r = await region(id);
  if (!r) throw new Error('no region ' + id);
  const [x, y] = toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
  await page.mouse.move(x, y, { steps: 6 }); await wait(ms);
  await page.mouse.down(); await wait(50); await page.mouse.up();
}
const away = () => page.mouse.move(W * 0.6, H - 3, { steps: 4 });

await ev(pageScene, SCENES.bend);
await wait(600);
const start = (Date.now() - t0) / 1000;
for (const key of ['bend', 'bounce', 'hop', 'blast']) {
  const sc = SCENES[key];
  if (key !== 'bend') { await ev(pageScene, sc); await wait(250); }
  await click('hand:0', 60); await click(`sq:${sqOf(sc.drop)}`, 60); await away(); await idle();
  for (const c of sc.clicks) { await click(`sq:${sqOf(c)}`, 60); await away(); await idle(); }
  // 꺾쇠 장면은 사슬이 g6 폰을 기다리는 채로 꺾인 길을 잠깐 보인다(다음 장면이 사슬을 걷어 낸다)
  await wait(key === 'blast' ? 350 : key === 'bend' ? 550 : 250);
}
// 결과 다시 보기: 꺾인 길 → 넘기 → 궁수 제자리 쏘기 → 화약병 터짐(한 바퀴)
await ev(pageResult, REPLAY);
await ev(() => { window.__app.screen.t = 0.6; }); // 떨구기 전 멈춤(0.8초)을 줄여 곧바로 길을 보인다
await wait(2900);
const took = (Date.now() - t0) / 1000 - start;
const end = start + Math.min(took, MAX);
if (took > MAX) console.log(`장면이 ${took.toFixed(1)}초라 ${MAX}초에서 자른다`);
const vpath = await page.video().path();
await ctx.close(); await browser.close(); srv.close();
if (errors.length) console.log('오류', errors.slice(0, 3));
const mp4 = path.join(OUT, 'fairy-fx.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
fs.rmSync(RAW, { recursive: true, force: true });
console.log('영상', path.relative(ROOT, mp4), `${(end - start).toFixed(1)}초`);
