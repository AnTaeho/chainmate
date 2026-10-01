// 물건 종류 표시 스크린샷(CHM-37): 1배(창 480×270)와 3배(창 1440×810)로 찍는다.
//   node tools/shots-kinds.mjs [--prefix before|after] [--out docs/shots/kinds] [--only 이름] [--scale 1|3] [--lang ko|en]
// 찍는 것:
//   1-shop     상점: 은박 격언 · 혼 진열, 기물 · 기보 꾸러미, 두루마리 넷(좁은 칸: 전술 · 진화 · 각인 · 혼)
//   2-shop     상점: 기보 · 각인 진열, 각인 · 금빛 꾸러미, 두루마리 둘(넓은 칸: 깨우기 · 전술)
//   2b-shop    상점: 명경기 조각 · 깨우기 진열, 꾸러미 셋(봉투 없는 좁은 칸), 두루마리 넷(전술 · 귀한 혼 · 기보 · 각인)
//   3-shop     상점: 물약 · 혼 깃든 기물 진열, 두루마리 셋(혼 · 각인 · 진화)
//   4-shop     상점: 진화 · 전술 진열, 두루마리 둘(넓은 칸: 혼 · 진화)
//   5-pack-open  각인 꾸러미 봉투가 열리기 직전
//   6-pack     기보 꾸러미 카드 셋
//   7-pack-golden 금빛 꾸러미(판본 격언 셋 + 명경기 조각)
//   8-reward   대국 승리 보상(물건이 없는 막간 — 바뀌지 않는다)
//   9-codex    도감 혼 탭
// Playwright는 저장소 의존성에 넣지 않는다(전역 또는 NPM_CONFIG_PREFIX).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/kinds')));
const ONLY = opt('--only', null);
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const LANG = opt('--lang', 'ko');

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
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

const SETUP = `
  const a = window.__app; a._sp = a._sp || a.speed; a.speed = a._sp; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
  const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.battle = null; r.money = 24;
  r.maxims = ['chivalry', 'quick_change'].map((id, i) => ({ uid: 50 + i, id, data: {}, edition: null, paid: 4 }));
  r.deck.push({ id: 71, t: 'B', eng: null, edition: null, soul: 'relay' });
  a.toasts = [];
`;
const SHOP = (display, consumables = [], packs = [{ kind: 'piece', price: 4 }, { kind: 'chart', price: 4 }]) => `r.phase = 'shop'; r.consumableSlots = Math.max(2, ${consumables.length}); r.consumables = ${JSON.stringify(consumables)}; r.shop = { rng: null, display: ${JSON.stringify(display)}, packs: ${JSON.stringify(packs)}, rerolls: 0, promoted: false, removed: false }; a.go('shop');`;
const PACK = (kind, options) => `r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; r.phase = 'pack'; r.pack = { kind: '${kind}', options: ${JSON.stringify(options)} }; a.go('pack');`;

const SCENES = [
  { name: '1-shop', src: SHOP([{ kind: 'maxim', id: 'chivalry', edition: 'foil', price: 7 }, { kind: 'soul', id: 'martyr', price: 9 }], [{ kind: 'tactic', id: 'freeze' }, { kind: 'evolve' }, { kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }]) },
  { name: '2-shop', src: SHOP([{ kind: 'chart', form: 'R', price: 4 }, { kind: 'engraving', id: 'glass', price: 5 }], [{ kind: 'awaken' }, { kind: 'tactic', id: 'reload' }], [{ kind: 'engraving', price: 4 }, { kind: 'golden', price: 6 }]) },
  { name: '2b-shop', src: SHOP([{ kind: 'fragment', legend: 'immortal', price: 6 }, { kind: 'awaken', price: 8 }], [{ kind: 'tactic', id: 'freeze' }, { kind: 'soul', id: 'martyr' }, { kind: 'chart', form: 'N' }, { kind: 'engraving', id: 'marble' }], [{ kind: 'piece', price: 4 }, { kind: 'engraving', price: 4 }, { kind: 'golden', price: 0 }]) },
  { name: '3-shop', src: SHOP([{ kind: 'gamble', id: 'potion', price: 5 }, { kind: 'piece', t: 'N', soul: 'spring', price: 9 }], [{ kind: 'soul', id: 'hunger' }, { kind: 'engraving', id: 'gold' }, { kind: 'evolve' }]) },
  { name: '4-shop', src: SHOP([{ kind: 'evolve', price: 6 }, { kind: 'tactic', id: 'taunt', price: 4 }], [{ kind: 'soul', id: 'hunger' }, { kind: 'evolve' }]) },
  { name: '5-pack-open', src: PACK('engraving', [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }]) + ` a.speed = () => 0; a.screen.t = 0;`, wait: 300 },
  { name: '6-pack', src: PACK('chart', [{ kind: 'chart', form: 'N' }, { kind: 'chart', form: 'R' }, { kind: 'chart', form: 'B' }]) },
  { name: '7-pack-golden', src: PACK('golden', [{ kind: 'maxim', id: 'memory', edition: 'foil' }, { kind: 'maxim', id: 'chivalry', edition: 'rainbow' }, { kind: 'maxim', id: 'quick_change', edition: 'pearl' }, { kind: 'fragment', legend: 'immortal' }]) },
  { name: '8-reward', src: `r.last = { score: 640, target: 600, overflow: 1, reason: 'clear' }; a.go('reward', { reward: { base: 4, moves: 2, interest: 2, total: 8 }, events: [] });`, wait: 2500 },
  { name: '9-codex', src: `a.records.codex.souls = { hunger: true, hunter: true, retro: true, echo: true, relay: true, martyr: true, transcend: true, homing: true }; a.records.codex.awake = { martyr: true, hunger: true }; a.go('codex'); a.screen.tab = 'souls';` },
];

for (const sc of SCALES) {
  const page = await browser.newPage({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => {
    window.__autoDraft = true;
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1 }));
  }, LANG);
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
  for (const s of SCENES) {
    if (ONLY && !s.name.includes(ONLY)) continue;
    await page.mouse.move(2, 2);
    await ev((src) => new Function(src)(), SETUP + s.src);
    await settle(s.wait ?? 1500);
    await shot(s.name);
  }
  await page.close();
}
console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
