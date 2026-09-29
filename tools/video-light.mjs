// 빛과 움직임 짧은 영상(약 10초): 손 카드 흔들림 · 가리키면 기울기 → 떨구기 · 사슬(미끄러지는 기물 · 그림자 · 값 × 배수 빛) → 상점 카드 흔들림.
//   node tools/video-light.mjs [--out docs/media]  → <out>/light-motion.mp4 (1440×810, 게임이 3배로 그린 화면, H.264)
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
const RAW = path.join(OUT, 'raw-light');
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
// 준비(판 열기 · 첫 대국 들어가기)는 녹화 밖에서: 같은 페이지를 녹화 없이 먼저 데워 두지 않고, 녹화 시작 시각을 적어 잘라낸다
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: RAW, size: { width: W, height: H } } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__autoDraft = true; });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
await ev(() => { localStorage.clear(); const a = window.__app; a.settings.coach = false; a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); a.newRun({ seed: 72 }); a.cmd({ type: 'play' }); a.go('battle', { events: [] }); });
await wait(2600); // 대국 띠가 지나간다
const start = (Date.now() - t0) / 1000;
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
async function hover(id, ms = 300, dx = 0.5) { const r = await region(id); if (!r) return false; const [x, y] = toXY(r.x + r.w * dx, r.y + r.h / 2); await page.mouse.move(x, y, { steps: 14 }); await wait(ms); return true; }
async function click(id, ms = 250) { if (!(await hover(id, ms))) throw new Error('no region ' + id); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(60); }

// 손 카드: 가만히 숨 쉬는 모습 → 가리키며 좌우로 쓸어 기울기
await page.mouse.move(W / 2, 40); await wait(900);
await hover('hand:0', 350, 0.15); await hover('hand:0', 350, 0.85);
await hover('hand:1', 350, 0.2); await hover('hand:1', 350, 0.8);
const plan = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return { hand: d.handIndex, sq: d.sq, line: d.line }; });
await click(`hand:${plan.hand}`, 350);
await click(`sq:${plan.sq}`, 350); await idle();
for (const c of plan.line.slice(0, 4)) { const sq = typeof c === 'number' ? c : c.sq; await click(`sq:${sq}`, 260); await idle(); }
await wait(600);
const end = (Date.now() - t0) / 1000;
const vpath = await page.video().path();
await ctx.close(); await browser.close(); srv.close();
if (errors.length) console.log('오류', errors.slice(0, 3));
const mp4 = path.join(OUT, 'light-motion.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-to', end.toFixed(2), '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
fs.rmSync(RAW, { recursive: true, force: true });
console.log('영상', path.relative(ROOT, mp4), `${(end - start).toFixed(1)}초`);
