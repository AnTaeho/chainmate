// CHM-33 · CHM-36 스크린샷: 진열에서 기보를 산 순간(두루마리 칸이 찬 채로 — 칸은 그대로, 주머니의 그 모습 기물이 자란다),
// 대본 대국을 건너뛴 뒤 진열에 격언이 없는 첫 상점(격언 안내 없음), 격언이 처음 보이는 상점(격언 안내)을 1배 · 3배로 찍는다.
//   node tools/shots-fix-33-36.mjs [--out docs/shots/fix-33-36] [--scale 1,3] [--lang ko]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/fix-33-36'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const LANGS = opt('--lang', 'ko').split(',');

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

async function session(sc, lang) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
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
  const away = async () => { const [x, y] = await toXY(300, 262); await page.mouse.move(x, y); };
  return { page, context, ev, settle, shot, click, away };
}

// 기보를 산 순간: 나이트 모습 2 → 3(동 → 은, 빛 기둥). 두루마리 칸 둘이 찬 채로 산다
async function chartBuy(sc, lang) {
  const s = await session(sc, lang);
  const { ev, settle, shot, click } = s;
  await settle(300);
  await ev(() => {
    const a = window.__app;
    a.settings.coach = false;
    a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    r.phase = 'shop'; r.battle = null; r.money = 12; r.charts.N = 2;
    r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }];
    r.shop = { rng: null, display: [{ kind: 'chart', form: 'N', price: 3, sold: false }, { kind: 'maxim', id: 'light_step', price: 5, sold: false }], packs: [{ kind: 'piece', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
    a.go('shop');
  });
  await settle(700);
  await shot('chart-before');
  await click('shop:buy:0');
  await settle(260);
  await shot('chart-bought');
  await settle(900);
  await s.away();
  await settle(200);
  await shot('chart-after');
  const st = await ev(() => ({ n: window.__app.run.charts.N, cons: window.__app.run.consumables.length }));
  if (st.n !== 3 || st.cons !== 2) errors.push(`기보를 산 뒤 ${JSON.stringify(st)}`);
  await s.context.close();
}

// 대본 대국 건너뛰기(시드 6) → 연습을 이긴다 → 첫 상점(진열에 격언 없음) → 레퍼토리 → 1관 정식을 이긴다 → 상점(격언이 처음 보인다)
async function skipShops(sc, lang) {
  const s = await session(sc, lang);
  const { ev, settle, shot, click, away } = s;
  await settle(300);
  await ev(() => { window.__app.nextSeed = 6; });
  await click('title:new');
  await page(s).waitForFunction(() => { const a = window.__app, g = a.guide; return g && !(g.hold && g.hold(a)) && a.ui.regions.some((r) => r.id === 'guide:skip'); }, null, { timeout: 60000 });
  await click('guide:skip');
  await settle(300);
  // 대국은 봇 명령으로(같은 명령 — 화면은 상점부터 본다)
  const win = () => ev(async () => {
    const { stepBattle } = await import('/tools/bot.mjs');
    const a = window.__app;
    while (a.run.phase === 'battle') if (!stepBattle(a.run.battle, (c) => a.cmd(c))) break;
    a.fx.clear(); a.flowQueue = []; a.goPhase();
    return a.run.phase;
  });
  if ((await win()) !== 'shop') errors.push('건너뛴 연습을 이기고 상점에 오지 못했다');
  await away();
  await settle(1800);
  const first = await ev(() => ({ maxim: window.__app.run.shop.display.some((it) => it.kind === 'maxim'), hint: window.__app.hintShown && window.__app.hintShown.id }));
  if (first.maxim || first.hint === 'shop') errors.push(`첫 상점: ${JSON.stringify(first)}`);
  await shot('skip-shop-no-maxim');
  await ev(() => {
    const a = window.__app;
    a.cmd({ type: 'leave' });
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.cmd({ type: 'play' });
    a.flowQueue = []; a.goPhase();
  });
  if ((await win()) !== 'shop') errors.push('1관 정식을 이기고 상점에 오지 못했다');
  await away();
  await settle(1800);
  const second = await ev(() => ({ maxim: window.__app.run.shop.display.some((it) => it.kind === 'maxim'), hint: window.__app.hintShown && window.__app.hintShown.id, screen: window.__app.screen.name, overlay: window.__app.overlay && window.__app.overlay.name, seen: Object.keys(window.__app.records.coachSeen || {}) }));
  if (!second.maxim || second.hint !== 'shop') errors.push(`격언이 처음 보인 상점: ${JSON.stringify(second)}`);
  await shot('skip-shop-first-maxim');
  console.log('  첫 상점', JSON.stringify(first), '· 다음 상점', JSON.stringify(second));
  await s.context.close();
}
const page = (s) => s.page;

for (const sc of SCALES) for (const lang of LANGS) { await chartBuy(sc, lang); await skipShops(sc, lang); }
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 8)) console.log(e); process.exitCode = 1; }
