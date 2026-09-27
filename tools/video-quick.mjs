// 빠른 소개 영상 녹화(약 55초): 타이틀 → 첫 대국 긴 사슬 → 보상 → 상점 → 꾸러미 → 명인의 상자 → 전설. Playwright는 저장소 의존성이 아니다(npx 등으로 따로 둔다).
//   node tools/video-quick.mjs [출력 폴더]  → webm, 그 뒤 ffmpeg로 mp4

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = process.argv[2] || 'docs/media/raw';
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
const W = 1440, H = 810;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__autoDraft = true; });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
const mark = (s) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', s);
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
await page.evaluate(() => { localStorage.clear(); });
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
async function hover(id, ms = 300) { const r = await region(id); if (!r) return false; const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y, { steps: 12 }); await wait(ms); return true; }
async function click(id, ms = 250) { if (!(await hover(id, ms))) throw new Error('no region ' + id); await page.mouse.down(); await page.mouse.up(); await wait(80); }

mark('title'); await wait(4500);
await ev(() => { const a = window.__app; a.newRun({ seed: 72 }); });
mark('select'); await wait(2200);
await click('select:play', 500);
await wait(2600);
mark('battle');
const plan = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return { hand: d.handIndex, sq: d.sq, line: d.line }; });
await click(`hand:${plan.hand}`, 700); await wait(700);
await click(`sq:${plan.sq}`, 600); await idle(); await wait(500);
for (const c of plan.line) { const sq = typeof c === 'number' ? c : c.sq; await click(`sq:${sq}`, 650); await idle(); await wait(250); }
mark('chain done'); await wait(2500);
for (let g = 0; g < 40; g++) {
  const name = await ev(() => window.__app.screen.name);
  if (name !== 'battle') break;
  await idle();
  const d = await ev(async () => {
    const { decideBattle } = await import('/tools/bot.mjs');
    const b = window.__app.run.battle;
    if (b && b.status === 'chain') { const { chainCaptures, chainRedrops } = await import('/src/sim/chain.js'); const l = b.chain.awaiting ? chainRedrops(b) : chainCaptures(b); return { sqs: [l[0]] }; }
    if (!b || b.status !== 'play') return null;
    const d = decideBattle(b);
    return d && (d.play ? { hand: d.play.handIndex, sq: d.play.sq, line: d.play.line } : { discard: d.discard });
  });
  if (!d) { await wait(150); continue; }
  if (d.sqs) { await click(`sq:${d.sqs[0]}`, 300); await idle(); continue; }
  if (d.discard) { for (const i of d.discard) await click(`hand:${i}`, 250); await click('btn:discard', 300); await idle(); continue; }
  await click(`hand:${d.hand}`, 400); await click(`sq:${d.sq}`, 400); await idle();
  for (const c of d.line) { const sq = typeof c === 'number' ? c : c.sq; await click(`sq:${sq}`, 400); await idle(); }
}
mark('reward'); await wait(3500);
await click('next', 400); await wait(400);
await ev(() => { window.__app.run.money = 30; });
mark('shop'); await wait(1200);
await hover('shop:buy:0', 1800);
await hover('shop:buy:1', 1500);
await click('shop:buy:0', 300); await wait(1200);
await ev(() => { const r = window.__app.run; if (r.shop.packs[0].sold) r.shop.packs[0].sold = false; });
await click('shop:pack:0', 400);
mark('pack'); await wait(3000);
await ev(() => { window.__app.go('chest', { chest: { count: 5, tier: 'rare', cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'Q' } }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'engrave', piece: 'Q', pieceId: 1, eng: 'glass' } }, { lit: true, item: { kind: 'chart', form: 'N' } }] } }); });
mark('chest'); await wait(5500);
await ev(() => { window.__app.settings.speed = 1; window.__app.go('legend', { legend: 'immortal' }); });
mark('legend'); await wait(6500);
await ev(() => { window.__app.go('title'); });
mark('end'); await wait(2500);
const vpath = await page.video().path();
await ctx.close(); await browser.close(); srv.close();
console.log('VIDEO', vpath, 'errors', errors.length, errors.slice(0, 3));
