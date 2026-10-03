// CHM-57 스크린샷: 특수 기물 연출 — 꺾쇠 꺾임(움직이는 중 · 남은 사슬 길) · 물수제비 튕김 · 까마귀 잇따라 넘기 · 화약병 터짐 ·
// 결과 다시 보기(꺾인 길 · 궁수 제자리 쏘기 · 터진 적 지움). 장면 판은 tools/fairy-fx-scenes.mjs.
//   node tools/shots-fairy-fx.mjs [--out docs/shots/fairy-fx] [--scale 3]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENES, REPLAY, pageScene, pageResult } from './fairy-fx-scenes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/fairy-fx'));
const SCALES = opt('--scale', '3').split(',').map(Number);

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
const sqOf = (k) => (Number(k[1]) - 1) * 8 + 'abcdefgh'.indexOf(k[0]);

async function session(sc) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // 화면 멈추기(window.__hold): 정한 순간에 그리기를 멈춰 그 장면을 찍는다
  await page.addInitScript(() => {
    localStorage.clear();
    window.__hold = false;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => (window.__hold ? window.requestAnimationFrame(cb) : cb(t)));
  });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = sc === 1 ? '' : `@${sc}x`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
    await page.mouse.move(x, y); await settle(60);
    await page.mouse.down(); await page.mouse.up(); await settle(30);
  }
  const away = async () => { const [x, y] = await toXY(300, 266); await page.mouse.move(x, y); };
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000, polling: 100 });
  // 그 프레임에 조건이 참이면 멈춘다(cond는 페이지 안에서 (app, screen) → bool)
  const holdWhen = (src) => ev((src) => { const a = window.__app, f = a.frame.bind(a), cond = new Function('a', 's', `return (${src});`); a.frame = (t) => { f(t); if (!window.__hold && cond(a, a.screen)) window.__hold = true; }; }, src);
  const held = () => page.waitForFunction(() => window.__hold, null, { timeout: 20000, polling: 50 });
  return { page, context, ev, settle, shot, click, away, idle, holdWhen, held };
}

// 장면을 깔고 떨군 뒤 먹을 칸을 차례로 누른다. hold: 멈출 조건(문자열), name: 찍을 이름
async function play(s, key, hold, name, { after = null } = {}) {
  const sc = SCENES[key];
  await s.ev(pageScene, sc); await s.settle(400);
  await s.click('hand:0'); await s.click(`sq:${sqOf(sc.drop)}`); await s.idle();
  if (hold) await s.holdWhen(hold);
  for (const c of sc.clicks) {
    await s.click(`sq:${sqOf(c)}`); await s.away();
    await s.page.waitForFunction(() => window.__hold || !window.__app.screen.busy, null, { timeout: 30000, polling: 50 });
    if (await s.ev(() => window.__hold)) break;
  }
  if (hold) await s.held(); else { await s.idle(); await s.away(); await s.settle(after || 300); }
  await s.shot(name);
}

for (const sc of SCALES) {
  const runs = [
    // 1 꺾쇠: 두 번째 꺾는 칸(c5)을 막 지나 e5로 미끄러지는 중 — 지나온 길이 흐린 금빛으로 끌려온다
    ['bend', "s.view.mover && s.view.mover.route && s.view.mover.route.kind === 'bend' && s.view.mover.seen >= 2 && s.view.mover.p >= 0.8", '1-bend-move'],
    // 2 꺾쇠가 먹은 뒤: 사슬 길이 b2 → c2 → c5 → e5로 꺾여 남는다(꺾은 칸에 금빛 점)
    ['bend', null, '2-bend-trail'],
    // 3 물수제비: 두 번째 튕김(f8) 순간 — 물방울이 튄다
    ['bounce', "s.view.mover && s.view.mover.route && s.view.mover.route.kind === 'bend' && s.view.mover.seen >= 2 && s.view.mover.p >= 0.9", '3-bounce'],
    // 4 까마귀: 나이트가 된 뒤 e7 비숍을 넘는 포물선 꼭대기(넘은 적은 깨진다)
    ['hop', `s.view.mover && s.view.mover.route && s.view.mover.route.kind === 'hop' && s.view.mover.from === ${sqOf('f6')} && s.view.mover.p >= 0.56`, '4-hop-chain'],
    // 5 화약병: 터진 지 0.07초 — 둘레 칸이 번쩍이고 불티 · 충격파
    ['blast', "s.blastAt != null && a.time - s.blastAt >= 0.07", '5-blast'],
  ];
  for (const [key, hold, name] of runs) {
    const s = await session(sc);
    await s.settle(300);
    if (key === 'blast') await s.ev(() => { const a = window.__app; a.settings.coach = false; });
    await s.ev(pageScene, SCENES[key]); await s.settle(200);
    if (key === 'blast') await s.ev(() => { const s = window.__app.screen, f = s.blastFx.bind(s); s.blastFx = (...x) => { s.blastAt = window.__app.time; return f(...x); }; });
    await play(s, key, hold, name);
    await s.context.close();
  }
  // 6~8 결과 다시 보기: 시간을 멈춰 그 순간을 그린다(꺾쇠 꺾인 길 · 궁수 화살 · 터진 적이 지워진 끝)
  for (const [t, name] of [[0.98, '6-result-bend'], [1.95, '7-result-shot'], [3.2, '8-result-blast']]) {
    const s = await session(sc);
    await s.settle(300);
    await s.ev(pageResult, REPLAY);
    await s.ev((t) => { const r = window.__app.screen; r.update = () => {}; r.t = t; }, t);
    await s.away(); await s.settle(400);
    await s.shot(name);
    await s.context.close();
  }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
