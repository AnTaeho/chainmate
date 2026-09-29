// 첫 판 대본 대국 스크린샷(CHM-22): 처음 켠 사람이 「새 판」을 눌러 킹과 두는 1관 연습을 걸음마다 한 장,
// 행마 보기가 열린 모습, 대본 뒤 처음 안내(킹 말풍선 — 상점), 건너뛰기 뒤 평범한 대국을 1배 · 3배, 한국어 · 영어로 찍는다.
//   node tools/shots-tutorial.mjs [--out docs/shots/tutorial] [--scale 1,3] [--lang ko,en]
//   영상은 tools/video-tutorial.mjs
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/tutorial'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const LANGS = opt('--lang', 'ko,en').split(',');

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
    await page.mouse.down(); await page.mouse.up(); await settle(60);
  }
  const away = () => page.mouse.move(2, 2);
  // 길이 말할 때까지(연출 · 대국 띠가 끝날 때까지)
  const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 60000 });
  return { page, context, ev, settle, shot, click, away, ready, region };
}

async function tutorial(sc, lang) {
  const s = await session(sc, lang);
  const { ev, settle, shot, click, away, ready } = s;
  await settle(400);
  await click('title:new');
  let n = 0;
  for (let guard = 0; guard < 80; guard++) {
    await ready();
    const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const st = g.steps[g.i]; const s = a.screen; return { i: g.i, ok: !!st.ok, target: typeof st.target === 'function' ? st.target(a) : st.target, moves: s.step && s.step.moves, end: s.step && s.step.end }; });
    if (!st) break;
    await away();
    await settle(500);
    await shot(`step-${String(++n).padStart(2, '0')}`);
    if (st.ok) { await click('guide:ok'); if (st.end) break; continue; }
    await click(st.target);
    if (st.moves) {
      await settle(500); await away();
      await shot('moves');
      await settle(0);
      await click('moves:back');
    }
  }
  // 막간(보상) → 상점: 대본 뒤 처음 안내(킹 말풍선)
  await settle(600);
  for (let k = 0; k < 6; k++) {
    const name = await ev(() => window.__app.screen.name);
    if (name === 'shop') break;
    const nx = await ev(() => { const r = window.__app.ui.regions.find((q) => q.id === 'next'); return r && r.id; });
    if (nx) await click(nx); else await ev(() => window.__app.next());
    await settle(500);
  }
  await away(); await settle(700);
  await shot('after-hint-shop');
  await s.context.close();
}

async function skipped(sc, lang) {
  const s = await session(sc, lang);
  const { settle, shot, click, away, ready } = s;
  await settle(400);
  await click('title:new');
  await ready(); await away(); await settle(300);
  await click('guide:skip');
  await settle(2600); await away();
  await shot('skipped');
  await s.context.close();
}

for (const sc of SCALES) for (const lang of LANGS) { await tutorial(sc, lang); await skipped(sc, lang); }
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
