// 화면 배율 비교 스크린샷(정수 배율 · 꽉 채움): 창 셋 × 장면 다섯을 기기 화소로 찍고, 테 · 글자 · 기물 가장자리를 확대해 잘라 낸다.
//   node tools/shots-scale.mjs [--fit int|fill] [--prefix 이름] [--out 폴더] [--sizes iphone,hd,fhd] [--scenes title,select,battle,shop,achv]
// --fit은 주소에 ?fit=int|fill을 붙인다(기본은 꽉 채움 — 그 설정이 없는 옛 판본은 무시하고 정수 배율로 돈다). 찍은 뒤 캔버스 크기 · 배율과
// 「뒷면 = 기기 화소」인 창에서는 뒷면 캔버스 화소와 찍은 화소의 차(1:1로 붙었나)를 적는다.
// Playwright는 저장소 의존성에 넣지 않는다 — PLAYWRIGHT(index.mjs 경로) · 'playwright' · 전역 순.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FIT = opt('--fit', 'int');
const PREFIX = opt('--prefix', FIT);
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/scale'));
const SIZES = {
  iphone: { w: 734, h: 343, dpr: 3, engine: 'webkit', touch: true },
  hd: { w: 1280, h: 720, dpr: 1, engine: 'chromium' },
  fhd: { w: 1920, h: 950, dpr: 1, engine: 'chromium' },
  fhd2: { w: 1920, h: 950, dpr: 2, engine: 'chromium' },
  win125: { w: 1366, h: 700, dpr: 1.25, engine: 'chromium' },
};
const WANT = opt('--sizes', 'iphone,hd,fhd').split(',');
const SCENES = new Set(opt('--scenes', 'title,select,battle,shop,achv').split(','));
// 확대해 볼 곳(게임 좌표): 장면마다 테 · 글자 · 기물이 들어간 곳
const CROPS = {
  title: [['logo', 150, 40, 90, 40], ['button', 180, 150, 120, 40]],
  select: [['card', 20, 40, 100, 60], ['text', 150, 110, 120, 50]],
  battle: [['panel', 4, 4, 110, 60], ['board', 160, 120, 70, 70], ['hand', 360, 170, 110, 60]],
  shop: [['card', 120, 40, 110, 70], ['text', 10, 10, 110, 50]],
  achv: [['row', 20, 40, 160, 50], ['tab', 10, 4, 160, 30]],
};
const ZOOM = 4;

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
const browsers = {};
const browserFor = async (e) => (browsers[e] ||= await pw[e].launch());
// WebKit이 없는 곳(클라우드 — 내려받기가 막힌 곳)에서는 아이폰 창도 손가락을 흉내 내는 Chromium으로 찍는다
try { await browserFor('webkit'); } catch { for (const S of Object.values(SIZES)) if (S.engine === 'webkit') S.engine = 'chromium'; console.log('# WebKit 없음 — Chromium으로'); }
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const table = [];

// 찍은 PNG를 잘라 확대한다(브라우저 캔버스로 — 화소 그대로 키운다)
const tool = await (await browserFor('chromium')).newPage();
async function cropZoom(png, x, y, w, h, file) {
  const data = await tool.evaluate(async ([b64, x, y, w, h, z]) => {
    const im = new Image();
    im.src = `data:image/png;base64,${b64}`;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = w * z; c.height = h * z;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, x, y, w, h, 0, 0, w * z, h * z);
    return c.toDataURL('image/png').split(',')[1];
  }, [png.toString('base64'), x, y, w, h, ZOOM]);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}
// 뒷면 캔버스(게임이 그린 화소)와 찍은 화소를 견준다: 1:1로 붙었으면 차가 0에 가깝다
async function compareBacking(page, png, rect, dpr) {
  const back = await page.evaluate(() => { const c = document.getElementById('screen'); return { w: c.width, h: c.height, data: c.toDataURL('image/png').split(',')[1] }; });
  const devW = Math.round(rect.width * dpr), devH = Math.round(rect.height * dpr);
  if (back.w !== devW || back.h !== devH) return null;
  return tool.evaluate(async ([shot, bk, x0, y0, w, h]) => {
    const load = async (b) => { const im = new Image(); im.src = `data:image/png;base64,${b}`; await im.decode(); return im; };
    const [a, b] = await Promise.all([load(shot), load(bk)]);
    const read = (im, sx, sy) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, sx, sy, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const B = read(b, 0, 0);
    // 찍은 자리를 기기 화소 ±1 옮겨 가며 가장 잘 맞는 자리를 찾는다(WebKit은 캔버스를 1 기기 화소 밀어 그리기도 한다)
    let best = null;
    for (const dy of [0, -1, 1]) for (const dx of [0, -1, 1]) {
      const A = read(a, x0 + dx, y0 + dy);
      let max = 0, sum = 0, n = 0, big = 0;
      for (let i = 0; i < A.length; i += 4) {
        if (B[i + 3] < 255) continue; // 비친 곳(뒤 여백 판이 섞인다)은 빼고 견준다
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        max = Math.max(max, d); sum += d; n++; if (d > 8) big++;
      }
      const r = { max, mean: n ? sum / n : 0, over8: n ? big / n : 0, n, dx, dy };
      if (!best || r.mean < best.mean) best = r;
    }
    return best;
  }, [png.toString('base64'), back.data, Math.round(rect.left * dpr), Math.round(rect.top * dpr), devW, devH]);
}

for (const sizeName of WANT) {
  const S = SIZES[sizeName];
  const browser = await browserFor(S.engine);
  const page = await browser.newPage({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dpr, hasTouch: !!S.touch, isMobile: !!S.touch && S.engine !== 'webkit' ? true : undefined });
  page.on('pageerror', (e) => errors.push(`${sizeName}: ${String(e.stack || e).split('\n').slice(0, 2).join(' ')}`));
  await page.addInitScript(() => { window.__autoDraft = true; });
  const q = `?fit=${FIT}`;
  await page.goto(`http://localhost:${port}/index.html${q}`);
  await page.waitForFunction(() => window.__app && window.__app.screen, null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    const a = window.__app;
    a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
    a.settings.coach = false; a.settings.volume = 0; a.settings.music = 0;
    a.records.tutorialAsked = true; a.records.lessonsDone = true;
    if (a.achvQueue) a.achvQueue.length = 0;
    a.overlay = null;
  });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000 });
  const rectOf = () => ev(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
  async function toXY(gx, gy) { const b = await rectOf(); return [b.left + ((gx + 0.5) * b.width) / 480, b.top + ((gy + 0.5) * b.height) / 270]; }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2);
    if (S.touch) await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); }
    await settle(80);
  }
  const away = async () => { if (!S.touch) await page.mouse.move(1, 1); };

  async function shot(scene) {
    await away(); await settle(500);
    const png = await page.screenshot();
    const base = `${PREFIX}-${sizeName}-${scene}`;
    fs.writeFileSync(path.join(OUT, `${base}.png`), png);
    const rect = await rectOf();
    const info = await ev(() => { const f = window.__fit, c = document.getElementById('screen'); return { k: f.k, n: f.n, css: f.css, back: `${c.width}×${c.height}` }; });
    for (const [name, gx, gy, gw, gh] of CROPS[scene] || []) {
      const x = Math.round((rect.left + (gx * rect.width) / 480) * S.dpr), y = Math.round((rect.top + (gy * rect.height) / 270) * S.dpr);
      const w = Math.round((gw * rect.width) / 480 * S.dpr), h = Math.round((gh * rect.height) / 270 * S.dpr);
      await cropZoom(png, x, y, w, h, path.join(OUT, `${base}-zoom-${name}.png`));
    }
    const cmp = await compareBacking(page, png, rect, S.dpr);
    const row = { size: sizeName, scene, ...info, canvasCss: `${rect.width}×${rect.height}@${rect.left},${rect.top}`, devLeft: rect.left * S.dpr, oneToOne: cmp ? `밀림 ${cmp.dx},${cmp.dy} · max ${cmp.max} · 평균 ${cmp.mean.toFixed(2)} · 8 넘는 화소 ${(cmp.over8 * 100).toFixed(2)}%` : '뒷면 ≠ 기기 화소' };
    table.push(row);
    console.log('찍음', base, JSON.stringify(row));
  }

  if (SCENES.has('title')) { await ev(() => window.__app.go('title')); await settle(1500); await shot('title'); }
  if (SCENES.has('select')) { await ev(() => window.__app.newRun({ seed: 7 })); await settle(900); await shot('select'); }
  if (SCENES.has('battle')) {
    await ev(() => {
      const a = window.__app;
      a.newRun({ seed: 11 });
      const r = a.run;
      const add = (id, edition = null) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
      add('quick_change', 'foil'); add('first_move'); add('whim', 'rainbow'); add('wall_breaker');
      r.money = 23;
      if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
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
    if (S.touch) await click(`sq:${plan.sq}`).catch(() => {});
    await idle();
    for (let i = 0; i < Math.min(2, plan.line.length - 1); i++) {
      const c = plan.line[i], id = `sq:${typeof c === 'number' ? c : c.sq}`;
      await click(id); if (S.touch) await click(id).catch(() => {});
      await idle();
    }
    await settle(700);
    await shot('battle');
  }
  if (SCENES.has('shop')) {
    await ev(async () => {
      const { playRun } = await import('/tools/shopbot.mjs');
      const a = window.__app;
      a.newRun({ seed: 11 });
      playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
      a.run.money = 30;
      a.fx.clear();
      a.goPhase();
    });
    await settle(900);
    await shot('shop');
  }
  if (SCENES.has('achv')) { await ev(() => { const a = window.__app; a.toTitle(); a.go('records', { tab: 'achv' }); }); await settle(600); await shot('achv'); }
  await page.close();
}
await tool.close();
for (const b of Object.values(browsers)) await b.close();
srv.close();
fs.writeFileSync(path.join(OUT, `${PREFIX}-table.json`), JSON.stringify(table, null, 1));
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 8)) console.log(e); process.exitCode = 1; }
