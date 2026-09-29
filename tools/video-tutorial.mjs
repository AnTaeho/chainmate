// 첫 판 대본 대국 영상(CHM-22, 1분 안쪽): 처음 켠 타이틀 → 「새 판」 → 킹과 두는 1관 연습 네 수(행마 보기 · 되돌리기 포함) → 보상.
//   node tools/video-tutorial.mjs [--out docs/media]  → <out>/tutorial.mp4 (1440×810, 게임이 3배로 그린 화면, H.264)
// 사람 손 빠르기로 누른다(킹의 말을 읽을 틈). Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역). ffmpeg는 PATH에서 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const RAW = path.join(OUT, 'raw-tutorial');
const W = 1440, H = 810;

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
await page.addInitScript(() => { localStorage.clear(); });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
await wait(600);
const start = (Date.now() - t0) / 1000;
async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
async function click(id, ms = 280) {
  const r = await region(id);
  if (!r) throw new Error('no region ' + id);
  const [x, y] = toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
  await page.mouse.move(x, y, { steps: 12 }); await wait(ms);
  await page.mouse.down(); await wait(80); await page.mouse.up(); await wait(60);
}
const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 60000 });

await wait(900);
await click('title:new', 400);
for (let guard = 0; guard < 80; guard++) {
  await ready();
  const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const st = g.steps[g.i], s = a.screen; return { ok: !!st.ok, target: typeof st.target === 'function' ? st.target(a) : st.target, moves: !!(s.step && s.step.moves), end: !!(s.step && s.step.end), long: st.say.length }; });
  if (!st) break;
  // 킹의 말을 읽을 틈: 알았다 걸음은 길게, 누르는 걸음은 짧게
  await wait(st.ok ? 800 + st.long * 32 : 400 + st.long * 12);
  if (st.ok) { await click('guide:ok'); if (st.end) break; continue; }
  await click(st.target);
  if (st.moves) { await wait(2600); await click('moves:back', 350); }
}
await wait(1400);
const nx = await region('next');
if (nx) { await click('next', 500); }
await wait(2200);
const end = (Date.now() - t0) / 1000;
const vpath = await page.video().path();
await ctx.close(); await browser.close(); srv.close();
if (errors.length) console.log('오류', errors.slice(0, 3));
const mp4 = path.join(OUT, 'tutorial.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
fs.rmSync(RAW, { recursive: true, force: true });
console.log('영상', path.relative(ROOT, mp4), `${(end - start).toFixed(1)}초`);
