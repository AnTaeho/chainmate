// 탁월수 짧은 영상(약 8초, CHM-43): 비숍을 바친다(카드가 흩어지고 나이트가 들어온다 · !?) → 새로 뽑은 나이트를 떨궈 사슬 → 킹을 먹어 메이트 → 탁월수 !! · ×3.
//   node tools/video-brilliant.mjs [--out docs/media]  → <out>/brilliant.mp4 (1440×810, 게임이 3배로 그린 화면, H.264)
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역). ffmpeg는 PATH에서 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const RAW = path.join(OUT, 'raw-brilliant');
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
// 장면은 tools/shots-sacrifice.mjs 「바친 직후」와 같은 판(손 폰 · 나이트 · 폰 · 비숍, 주머니 맨 앞 나이트, h7 킹)
await ev(() => {
  localStorage.clear();
  const a = window.__app;
  a.settings.coach = false;
  a.nextSeed = 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  a.cmd({ type: 'play' }); a.go('battle', { events: [] });
  const b = a.run.battle;
  const sq = (n) => (Number(n[1]) - 1) * 8 + 'abcdefgh'.indexOf(n[0]);
  b.board = Array(64).fill(null);
  for (const [n, t] of Object.entries({ h7: 'K', c7: 'B', d7: 'P', g6: 'P', d5: 'P', e5: 'P', e4: 'P', e3: 'N' })) b.board[sq(n)] = { t, id: 700 + sq(n) };
  b.incoming = []; b.incomingNext = [];
  b.hand = ['P', 'N', 'P', 'B'].map((t, i) => ({ t, id: 900 + i, eng: null }));
  b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
  b.target = 150;
  a.screen.banner = null;
  a.screen.sync();
});
await wait(700);
const start = (Date.now() - t0) / 1000;
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
async function hover(id, ms = 300) { const r = await region(id); if (!r) return false; const [x, y] = toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16)); await page.mouse.move(x, y, { steps: 14 }); await wait(ms); return true; }
async function click(id, ms = 250) { if (!(await hover(id, ms))) throw new Error('no region ' + id); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(60); }

await page.mouse.move(W * 0.6, H - 3); await wait(500);
await click('hand:3', 400);
await click('btn:discard', 400); await idle();
await page.mouse.move(W * 0.6, H - 3, { steps: 10 }); await wait(1100);
const plan = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const b = window.__app.run.battle, i = b.hand.findIndex((p) => p.id === 950);
  const d = bestMove(b, { handIndices: [i], preferMate: true });
  return { hand: i, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)), mate: !!d.mate };
});
if (!plan.mate) throw new Error('새로 뽑은 나이트의 메이트 줄이 없다');
await click(`hand:${plan.hand}`, 350);
await click(`sq:${plan.sq}`, 350); await idle();
for (const sq of plan.line) { await click(`sq:${sq}`, 300); await idle(); }
await wait(900);
const end = (Date.now() - t0) / 1000;
const vpath = await page.video().path();
await ctx.close(); await browser.close(); srv.close();
if (errors.length) console.log('오류', errors.slice(0, 3));
const mp4 = path.join(OUT, 'brilliant.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
fs.rmSync(RAW, { recursive: true, force: true });
console.log('영상', path.relative(ROOT, mp4), `${(end - start).toFixed(1)}초`);
