// 빛과 움직임 스크린샷: 대국 · 상점 · 꾸러미 · 관 선택 · 타이틀을 1배(창 480×270)와 3배(창 1440×810)로 찍는다.
//   node tools/shots-light.mjs [--prefix before|after|draft-1] [--out docs/shots/light-motion] [--only 이름] [--scale 1|3] [--knobs '{"flow":0.5}']
//   --frames N: 대국에서 연속 프레임 N장(80ms 간격)을 <prefix>-frames-NN@3x.png로(움직임 기록)
//   --knobs: 시안용 손잡이(window.__look, src/render/look.js LOOK에 덮어쓴다)
// 3배는 창을 1440×810으로 열어 게임이 실제로 3배로 그린 모습을 찍는다(1배를 늘린 것과 다르다 — 소수점 움직임 · 기울기가 보인다).
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
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/light-motion'));
const ONLY = opt('--only', null);
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const KNOBS = opt('--knobs', null);
const FRAMES = Number(opt('--frames', 0));

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
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

for (const sc of SCALES) {
  const page = await browser.newPage({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((k) => { window.__autoDraft = true; if (k) window.__look = JSON.parse(k); }, KNOBS);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  await page.evaluate(() => { localStorage.clear(); window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
  const tag = sc === 1 ? '' : `@${sc}x`;
  async function shot(name) {
    if (ONLY && !name.includes(ONLY)) return;
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}${tag}.png`), clip: box });
    console.log('찍음', `${PREFIX}-${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function hover(id) { const r = await region(id); if (!r) return false; const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await settle(120); return true; }
  async function click(id) { if (!(await hover(id))) throw new Error(`no region ${id}`); await page.mouse.down(); await page.mouse.up(); await settle(60); }
  const away = async () => { await page.mouse.move(2, 2); };

  // 타이틀
  await ev(() => { window.__app.go('title'); });
  await away(); await settle(1500);
  await shot('title');
  // 관 선택(판 7)
  await ev(() => { window.__app.newRun({ seed: 7 }); });
  await away(); await settle(500);
  await shot('select');
  // 대국: 짜임이 찬 판(격언 · 판본), 가장 좋은 수를 떨구고 두 번 먹은 뒤
  await ev(() => {
    const a = window.__app;
    a.newRun({ seed: 11 });
    const r = a.run;
    const add = (id, edition = null) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
    add('quick_change', 'foil'); add('first_move'); add('whim', 'rainbow'); add('wall_breaker');
    r.money = 23;
    a.cmd({ type: 'play' });
    a.go('battle', { events: [] });
  });
  await settle(2600);
  const plan = await ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
    return { hand: d.handIndex, sq: d.sq, line: d.line };
  });
  await click(`hand:${plan.hand}`);
  await click(`sq:${plan.sq}`);
  await idle();
  for (let i = 0; i < Math.min(2, plan.line.length - 1); i++) { const c = plan.line[i]; await click(`sq:${typeof c === 'number' ? c : c.sq}`); await idle(); }
  await away(); await settle(700);
  await shot('battle');
  if (FRAMES && sc === 3 && !ONLY) {
    // 다음 먹기의 연출을 연속 프레임으로
    const c = plan.line[Math.min(2, plan.line.length - 1)];
    const r = await region(`sq:${typeof c === 'number' ? c : c.sq}`);
    if (r) {
      const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
      for (let k = 0; k < FRAMES; k++) {
        const box = await page.locator('#screen').boundingBox();
        await page.screenshot({ path: path.join(OUT, `${PREFIX}-frames-${String(k).padStart(2, '0')}@3x.png`), clip: box });
        await settle(80);
      }
      await idle();
    }
  }
  // 상점: 봇이 대국을 끝까지 두고 첫 상점에서 멈춘다
  await ev(async () => {
    const { playRun } = await import('/tools/shopbot.mjs');
    const a = window.__app;
    a.newRun({ seed: 11 });
    playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
    a.run.money = 30;
    a.fx.clear();
    a.goPhase();
  });
  await away(); await settle(900);
  await shot('shop');
  if (await hover('shop:buy:0')) { await settle(200); await shot('shop-hover'); }
  await ev(() => { const r = window.__app.run; if (r.shop.packs[0].sold) r.shop.packs[0].sold = false; r.money = 30; });
  await click('shop:pack:0');
  await away(); await settle(1500);
  await shot('pack');
  await page.close();
}
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
