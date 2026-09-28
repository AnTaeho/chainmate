// 금빛 꾸러미 전후 스크린샷(CHM-12: 명국 조각이 붙어 카드가 넷이면 판본 격언 카드가 격언 칸과 겹치던 것). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-golden-pack.mjs [--prefix before|after] [--out docs/shots/golden-pack] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-). 격언 칸은 다섯이 다 찼다:
//   golden4        카드 넷(가장 긴 판본 격언 그림자 읽기 · 증원 사냥 흑요 · 대국의 기억 은박 + 명국 조각)
//   golden4-full   칸이 찬 채로 대국의 기억(은박)을 누른 순간
//   golden4-swap   그다음 격언 칸의 둘째 격언을 누른 순간
//   golden4-label  격언 이름표를 누른 순간(이름표가 있을 때만)
//   golden3        카드 셋(명국 조각 없이)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/golden-pack'));
const ONLY = opt('--only', null);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(HERE, u === '/' ? 'index.html' : u);
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
fs.mkdirSync(OUT, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);
const settle = (ms) => page.clock.runFor(ms);

// 글 넘침(src/render/layoutlog.js): 찍는 장마다 실제 글꼴로 잰다
const overflow = [];
async function shot(name) {
  for (const q of await ev(async () => (await import('/src/render/layoutlog.js')).checkLayout())) overflow.push(`${name}: ${q.msg}`);
  const urls = await ev(() => {
    const c = document.getElementById('screen');
    const big = document.createElement('canvas');
    big.width = c.width * 3; big.height = c.height * 3;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, big.width, big.height);
    return [c.toDataURL('image/png'), big.toDataURL('image/png')];
  });
  const base = path.join(OUT, `${PREFIX}-${name}`);
  fs.writeFileSync(`${base}.png`, Buffer.from(urls[0].split(',')[1], 'base64'));
  fs.writeFileSync(`${base}@3x.png`, Buffer.from(urls[1].split(',')[1], 'base64'));
  console.log('찍음', path.relative(HERE, `${base}.png`));
}

async function boot(lang) {
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await ev((lang) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 2 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
  }, lang);
  await page.reload();
  for (let i = 0; i < 200 && !(await ev(() => !!(window.__app && window.__app.screen))); i++) await settle(50);
  await ev(async () => {
    const a = window.__app;
    const { HINTS } = await import('/src/ui/coach.js');
    a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true]));
    a.saveRecords();
    (await import('/src/render/layoutlog.js')).LOG.on = true;
  });
}
const regionOf = (id) => ev((id) => { const r = window.__app.ui.regions.find((q) => q.id === id); return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null; }, id);
async function moveTo(gx, gy) {
  const b = await page.locator('#screen').boundingBox();
  await page.mouse.move(b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270);
}
async function clickId(id) {
  const r = await regionOf(id);
  if (!r) return false;
  await moveTo(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  await page.mouse.down(); await page.mouse.up();
  await settle(80);
  return true;
}
// 격언 칸 다섯이 찬 판의 금빛 꾸러미
const FULL = [['chivalry'], ['quick_change', 'foil'], ['first_move'], ['whim', 'rainbow'], ['sacrifice']];
const PACK = (options) => `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.nextSeed = 11; a.newRun(); const r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.maxims = []; for (const [id, ed] of ${JSON.stringify(FULL)}) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: ed || null, paid: 5 });
  r.money = 12; r.shop = { display: [], packs: [], rerolls: 0, promoted: false, removed: false }; r.phase = 'pack'; r.pack = { kind: 'golden', options: ${JSON.stringify(options)} }; a.go('pack');`;
const FOUR = [{ kind: 'maxim', id: 'shadow_reading', edition: 'obsidian' }, { kind: 'maxim', id: 'reinforce_hunt', edition: 'obsidian' }, { kind: 'maxim', id: 'memory', edition: 'foil' }, { kind: 'fragment', legend: 'immortal' }];
const scenes = [
  ['golden4', PACK(FOUR), []],
  ['golden4-full', PACK(FOUR), ['pack:pick:2']],
  ['golden4-swap', PACK(FOUR), ['pack:pick:2', 'maxim:1']],
  ['golden4-label', PACK(FOUR), ['pack:maxims']],
  ['golden3', PACK(FOUR.slice(0, 3)), []],
];
for (const lang of ['ko', 'en']) {
  await boot(lang);
  for (const [name, src, clicks] of scenes) {
    const file = `${lang === 'en' ? 'en-' : ''}${name}`;
    if (ONLY && !file.includes(ONLY)) continue;
    await moveTo(-1, -1);
    try { await ev(new Function(src)); } catch (e) { console.log('건너뜀', file, String(e).slice(0, 80)); continue; }
    await settle(2000);
    let ok = true;
    for (const id of clicks) if (!(await clickId(id))) { console.log('건너뜀', file, `${id} 없음`); ok = false; break; }
    if (!ok) continue;
    await moveTo(-1, -1);
    await settle(150);
    await shot(file);
  }
}
console.log(`글 넘침 ${overflow.length}${overflow.length ? '\n  ' + overflow.join('\n  ') : ''}`);
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
