// 도박 카드 「?」 고침 — 브라우저별 스크린샷과 잰 값(docs/design-notes/layout.md 「글자 세로 자리 보정」).
//   NPM_CONFIG_PREFIX=<playwright 있는 곳> node tools/shots-fix-gamble.mjs [--browsers chromium,webkit] [--out docs/shots/fix-gamble] [--scale 3]
//   상점(도박 둘: 물약 · 룰렛) 전체 · 물약 카드만 · 좁은 카드(뒤집히는 순간의 길, 따로 그린 것) · 글자 잉크 자리 표
// 시계를 멈춰 찍는다(같은 브라우저에서 두 번 찍으면 같은 그림 — 고치기 전후를 화소로 견줄 수 있게)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/fix-gamble')));
const BROWSERS = opt('--browsers', 'chromium,webkit').split(',');
const SC = Number(opt('--scale', 3));

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok)); // 빈 포트(8123은 건드리지 않는다)
const port = srv.address().port;
const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master', 'preview', 'pack', 'maxim', 'scroll', 'bag', 'reroll', 'promote', 'maximSell', 'crack', 'hold'];
const GLYPHS = [['?', true], ['가', false], ['가', true], ['A', false], ['A', true], ['$4', true], ['g', false]];

for (const name of BROWSERS) {
  let browser;
  try { browser = await pw[name].launch(); } catch (e) { console.log(name, '못 띄움 —', String(e).split('\n')[0]); continue; }
  const context = await browser.newContext({ viewport: { width: 480 * SC, height: 270 * SC }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.addInitScript(() => { localStorage.clear(); });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const tick = (ms) => page.clock.runFor(ms);
  await tick(300);
  // 상점: 왼쪽 물약 · 오른쪽 룰렛
  await page.evaluate(({ SEEN }) => {
    const a = window.__app;
    a.settings.coach = false;
    a.records.kingDone = true;
    a.records.coachSeen = Object.fromEntries(SEEN.map((k) => [k, true]));
    localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    r.battle = null; r.money = 24; a.toasts = [];
    r.phase = 'shop'; r.consumables = [];
    r.shop = { rng: null, display: [{ kind: 'gamble', id: 'potion', price: 2 }, { kind: 'gamble', id: 'roulette', price: 2 }], packs: [{ kind: 'piece', price: 4 }, { kind: 'chart', price: 4 }], rerolls: 0, promoted: false, removed: false };
    a.go('shop');
  }, { SEEN });
  const box = await page.locator('#screen').boundingBox();
  const toXY = (gx, gy) => [box.x + ((gx + 0.5) * box.width) / 480, box.y + ((gy + 0.5) * box.height) / 270];
  await page.mouse.move(...toXY(470, 262));
  await tick(1000);
  await page.screenshot({ path: path.join(OUT, `shop-${name}@${SC}x.png`), clip: box });
  const card = await page.evaluate(() => { const r = window.__app.ui.regions.find((x) => x.id === 'shop:buy:0'); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; });
  if (!card) throw new Error('물약 카드 구역이 없다');
  const k = box.width / 480;
  await page.screenshot({ path: path.join(OUT, `card-${name}@${SC}x.png`), clip: { x: box.x + card.x * k, y: box.y + card.y * k, width: card.w * k, height: card.h * k } });

  // 화면에서 잰다: 물약 카드 안 어두운 칸(#1b2b27)과 그 안 「?」 잉크(480×270 좌표)
  const onScreen = await page.evaluate((card) => {
    const src = document.querySelector('#screen'), n = src.width / 480;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const at = (x, y) => { const i = (y * c.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const isBox = ([r, gg, b]) => r === 0x1b && gg === 0x2b && b === 0x27;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = card.y * n; y < (card.y + card.h) * n; y++) for (let x = card.x * n; x < (card.x + card.w) * n; x++) if (isBox(at(x, y))) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    // 칸은 22×26: 왼쪽 위 모서리에서 그만큼만 본다(잉크가 칸 아래로 나가면 칸 색 줄이 모자라 보일 수 있으니 모서리 기준)
    const W = 22 * n, H = 26 * n;
    let top = -1, bot = -1; const cols = new Set();
    for (let y = by0 - 4 * n; y < by0 + H + 8 * n; y++) for (let x = bx0; x < bx0 + W; x++) {
      const p = at(x, y); const inside = y >= by0 && y < by0 + H;
      // 잉크: 칸 안에서는 칸 색이 아닌 것, 칸 밖(위아래)에서는 「?」와 같은 색
      if (inside ? !isBox(p) : cols.has(p.join())) { if (top < 0) top = y; bot = y; if (inside) cols.add(p.join()); }
    }
    return { n, box: [by0 / n, (by0 + H) / n - 1], ink: top < 0 ? null : [top / n, bot / n], col: [...cols][0] || null };
  }, card);

  // 글자 잉크 줄(textImage 결과의 첫 · 끝 줄)
  const ink = await page.evaluate(async (GLYPHS) => {
    const { textImage } = await import('/src/render/text.js');
    const out = {};
    for (const [s, bold] of GLYPHS) {
      const im = textImage(s, '#ffffff', bold);
      const d = im.c.getContext('2d').getImageData(0, 0, im.c.width, im.c.height).data;
      let top = -1, bot = -1;
      for (let y = 0; y < im.c.height; y++) for (let x = 0; x < im.c.width; x++) if (d[(y * im.c.width + x) * 4 + 3]) { if (top < 0) top = y; bot = y; }
      out[`${s}${bold ? ' 굵게' : ''}`] = `${top}~${bot}`;
    }
    return out;
  }, GLYPHS);

  // 좁은 카드(뒤집히는 순간에만 그리는 길 narrowCard): 도박은 꾸러미에 들지 않아 화면에서는 만나기 어렵다 — 같은 그리기 함수로 따로 그려 찍는다
  await page.evaluate(async (SC) => {
    const { itemCard } = await import('/src/ui/parts.js');
    const c = document.createElement('canvas'); c.id = 'narrow'; c.width = 76; c.height = 96;
    c.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${76 * SC}px;height:${96 * SC}px;image-rendering:pixelated;background:#16221e`;
    document.body.appendChild(c);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    itemCard(g, { kind: 'gamble', id: 'potion', price: 2 }, 6, 6, 64, 84, { t: 0.4, run: window.__app.run });
  }, SC);
  await page.locator('#narrow').screenshot({ path: path.join(OUT, `narrow-${name}@${SC}x.png`) });

  console.log(`${name} ${browser.version()} | 칸 y ${onScreen.box.join('~')} · 「?」 잉크 y ${onScreen.ink ? onScreen.ink.map(Math.floor).join('~') : '없음'} (위 여백 ${onScreen.ink ? onScreen.ink[0] - onScreen.box[0] : '-'} · 아래 여백 ${onScreen.ink ? onScreen.box[1] - Math.floor(onScreen.ink[1]) : '-'}) · 색 rgb(${onScreen.col}) | 글자 잉크 줄 ${JSON.stringify(ink)}`);
  await browser.close();
}
srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
