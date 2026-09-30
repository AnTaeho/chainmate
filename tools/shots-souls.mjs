// 혼 등급 · 각성 스크린샷(CHM-17): 1배(창 480×270)와 3배(창 1440×810)로 찍는다.
//   node tools/shots-souls.mjs [--prefix before|after|draft-1] [--out docs/shots/souls] [--only 이름] [--scale 1|3] [--lang ko|en]
//   --variant N: 시안 번호(화면이 window.__soulv로 읽는다 — 시안을 고른 뒤에는 쓰지 않는다)
// 찍는 것:
//   1-shop    상점: 귀한 혼 두루마리 · 혼 깃든 기물, 두루마리 칸의 혼 둘(흔함 · 드묾)
//   2-shop    상점: 흔한 혼 · 드문 혼 두루마리, 흔한 혼 말풍선
//   3-codex   도감 혼 탭(본 혼 · 못 본 혼, 귀한 혼 말풍선)
// Playwright는 저장소 의존성에 넣지 않는다(전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/souls')));
const ONLY = opt('--only', null);
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const LANG = opt('--lang', 'ko');
const VARIANT = opt('--variant', null);

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

// 판 하나를 새로 깔고(시드 11) 짜임을 얹은 뒤 src를 돌린다
const SETUP = `
  const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
  const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.battle = null; r.money = 24;
  r.maxims = ['chivalry', 'quick_change', 'hunter_maxim'].filter((id) => id !== 'hunter_maxim').map((id, i) => ({ uid: 50 + i, id, data: {}, edition: null, paid: 4 }));
  r.deck.push({ id: 71, t: 'B', eng: null, edition: null, soul: 'relay' }, { id: 72, t: 'R', eng: null, edition: null, soul: 'martyr' });
  a.toasts = [];
`;
const SHOP = (display, consumables = []) => `r.phase = 'shop'; r.consumables = ${JSON.stringify(consumables)}; r.shop = { rng: null, display: ${JSON.stringify(display)}, packs: [{ kind: 'piece', price: 4 }, { kind: 'chart', price: 4 }], rerolls: 0, promoted: false, removed: false }; a.go('shop');`;

const SCENES = [
  { name: '1-shop', src: SHOP([{ kind: 'soul', id: 'martyr', price: 9 }, { kind: 'piece', t: 'N', soul: 'spring', price: 9 }], [{ kind: 'soul', id: 'hunger' }, { kind: 'soul', id: 'echo' }]), hover: 'shop:buy:0' },
  { name: '2-shop', src: SHOP([{ kind: 'soul', id: 'hunter', price: 4 }, { kind: 'soul', id: 'duel', price: 6 }]), hover: 'shop:buy:1' },
  // 주머니: 금이 간 혼(계주, 사슬 5/5) · 깨어난 혼(순교자) · 금까지 가는 혼(굶주림 3/5), 금이 간 기물 말풍선
  { name: '4-deck', src: `Object.assign(r.deck.find((p) => p.id === 71), { links: 5 }); Object.assign(r.deck.find((p) => p.id === 72), { links: 5, awake: true }); r.deck.push({ id: 73, t: 'N', eng: null, edition: null, soul: 'hunger', links: 3 });` + SHOP([{ kind: 'maxim', id: 'edge', edition: null, price: 4 }, { kind: 'awaken', price: 8 }]), hover: 'deck:71' },
  { name: '5-deck', src: `Object.assign(r.deck.find((p) => p.id === 71), { links: 5 }); Object.assign(r.deck.find((p) => p.id === 72), { links: 5, awake: true });` + SHOP([{ kind: 'maxim', id: 'edge', edition: null, price: 4 }, { kind: 'soul', id: 'echo', price: 6 }]), hover: 'deck:72' },
  // 각성 막간(마스터의 상자에서): 터지는 순간(0.75초) · 끝 장면
  { name: '6-awaken', src: `Object.assign(r.deck.find((p) => p.id === 72), { links: 5, awake: true }); r.phase = 'shop'; r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; a.go('awaken', { awaken: { pieceId: 72, piece: 'R', soul: 'martyr', src: 'chest' } });`, wait: 700 },
  { name: '7-awaken', src: `Object.assign(r.deck.find((p) => p.id === 72), { links: 5, awake: true }); r.phase = 'shop'; r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; a.go('awaken', { awaken: { pieceId: 72, piece: 'R', soul: 'martyr', src: 'chest' } });`, wait: 2000 },
  { name: '3-codex', src: `a.records.codex.souls = { hunger: true, hunter: true, retro: true, echo: true, relay: true, martyr: true, transcend: true, homing: true }; a.go('codex'); a.screen.tab = 'souls';`, hover: 'codex:martyr' },
];

for (const sc of SCALES) {
  const page = await browser.newPage({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(([lang, v]) => {
    window.__autoDraft = true;
    if (v) { window.__soulv = Number(v); window.__awakev = Number(v); }
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1 }));
  }, [LANG, VARIANT]);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  await page.evaluate(() => { window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = sc === 1 ? '' : `@${sc}x`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}${tag}.png`), clip: box });
    console.log('찍음', `${PREFIX}-${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id || x.id.startsWith(id)); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function hover(id) { const r = await region(id); if (!r) { console.log('구역 없음', id); return; } const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 12)); await page.mouse.move(x, y); await settle(200); }
  for (const s of SCENES) {
    if (ONLY && !s.name.includes(ONLY)) continue;
    await page.mouse.move(2, 2);
    await ev((src) => new Function(src)(), SETUP + s.src);
    await settle(s.wait ?? 1500);
    if (s.run) await s.run({ ev, settle, hover, region, page, toXY });
    if (s.hover) await hover(s.hover);
    if (s.wait == null) await settle(300);
    await shot(s.name);
  }
  await page.close();
}
console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
