// 찜(CHM-58 F, docs/design-notes/agency.md 「F 찜 — 구현 뒤」) — 구현한 화면 스크린샷(시안 draft*는 같은 자리에 남아 있다).
//   NPM_CONFIG_PREFIX=<playwright 있는 곳> node tools/shots-hold.mjs   → docs/shots/hold/after-*.png
//   이번 상점에서 찜(한국어 · 영어) · 찜한 카드를 가리킴 · 다음 상점(넘어온 카드) · 처음 안내
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, 'docs/shots/hold');
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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master', 'preview', 'pack', 'maxim', 'scroll', 'bag', 'reroll', 'promote', 'maximSell', 'crack'];
const SEED = Number(process.env.SEED || 7);

async function session(sc, lang, { coach = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ lang }) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, { lang });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  await page.waitForTimeout(300);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(({ SEEN, coach }) => {
    const a = window.__app;
    a.settings.coach = coach;
    a.records.kingDone = true;
    const factions = ['peasants', 'cavalry', 'abbey', 'fortress', 'hunters', 'heralds', 'mercs', 'royal'];
    a.records.coachSeen = Object.fromEntries([...SEEN, ...factions.map((f) => `faction_${f}`)].map((k) => [k, true]));
  }, { SEEN, coach });
  const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  const moveTo = async (gx, gy) => { const [x, y] = await toXY(gx, gy); await page.mouse.move(x, y); await page.waitForTimeout(400); };
  const click = async (id) => { const r = await region(id); if (!r) throw new Error(`구역 없음 ${id}`); const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await page.waitForTimeout(150); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300); };
  const away = () => moveTo(470, 262);
  const shot = async (file) => { const b = await page.locator('#screen').boundingBox(); await page.screenshot({ path: path.join(OUT, file), clip: b }); console.log('찍음', file); };
  return { page, context, ev, toXY, region, moveTo, click, away, shot };
}

// 대국을 봇으로 두고 상점까지
const playToShop = (s) => s.ev(async () => {
  const a = window.__app;
  const { stepBattle } = await import('/tools/bot.mjs');
  a.cmd({ type: 'play' });
  a.run.battle.target = 0;
  while (a.run.phase === 'battle') if (!stepBattle(a.run.battle, (c) => a.cmd(c))) break;
  const ph = a.run.phase;
  a.go('shop');
  return ph;
});

// 2관 첫 상점: 오른쪽 칸에 판본 없는 격언(왼쪽은 격언 아닌 것)이 오도록 다시 진열한 뒤 상금을 9로(격언은 살 돈이 모자람)
async function firstShop(s, { edition = false } = {}) {
  await s.ev(async ({ seed }) => {
    const a = window.__app;
    const { syncBoards } = await import('/src/sim/run.js');
    a.nextSeed = seed; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    r.ante = 2; r.blind = 0; r.boards = null; r.money = 20;
    syncBoards(r);
  }, { seed: SEED });
  await playToShop(s);
  // 영어 긴 판본 이름(Obsidian): 드물어 굴려서는 잘 안 나오니 오른쪽 칸을 흑요 격언으로 바꿔 놓는다(값은 규칙대로)
  if (edition) {
    await s.ev(async () => {
      const r = window.__app.run;
      const { maximPrice, priceBonus } = await import('/src/sim/shop.js');
      r.shop.display[1] = { kind: 'maxim', id: 'encircle', edition: 'obsidian', price: maximPrice('encircle', 'obsidian') + priceBonus(r), sold: false };
      if (r.shop.display[0].kind === 'maxim') r.shop.display[0] = { kind: 'chart', form: 'N', price: 3, sold: false };
      r.money = 9;
    });
    await s.page.waitForTimeout(400);
    return 1;
  }
  const slot = await s.ev(({ edition }) => {
    const a = window.__app, r = a.run;
    const keep = { rerolls: r.shop.rerolls, freeUsed: r.shop.freeUsed, free: r.shop.free };
    let i = -1;
    for (let k = 0; k < 400; k++) {
      i = r.shop.display.findIndex((it) => it.kind === 'maxim' && (edition ? ['obsidian', 'rainbow'].includes(it.edition) : !it.edition));
      if (i === 1 && r.shop.display[0].kind !== 'maxim') break;
      r.money = 99; r.shop.rerolls = 0; a.cmd({ type: "reroll" });
    }
    Object.assign(r.shop, keep);
    r.money = 9;
    return i;
  }, { edition });
  await s.page.waitForTimeout(400);
  return slot;
}

// 이번 상점에서 찜 → (가리킴) → 다음 상점
async function holdScenes(lang, sc, { a, tip = null, b = null, edition = false }) {
  const s = await session(sc, lang);
  const slot = await firstShop(s, { edition });
  await s.click(`shop:hold:${slot}`);
  const held = await s.ev(() => window.__app.run.hold && window.__app.run.hold.slot);
  if (held !== slot) throw new Error(`찜이 안 됐다 ${held}`);
  await s.away();
  await s.shot(a);
  if (tip) {
    const card = await s.region(`shop:buy:${slot}`);
    await s.moveTo(card.x + 40, card.y + 60);
    await s.shot(tip);
  }
  if (b) {
    await s.ev(() => { const a = window.__app; a.cmd({ type: 'leave' }); a.goPhase(); });
    await s.page.waitForTimeout(400);
    await playToShop(s);
    const kept = await s.ev((slot) => { const r = window.__app.run; r.money = Math.max(r.money, 6); return !!r.shop.display[slot].kept; }, slot);
    if (!kept) throw new Error('다음 상점에 넘어오지 않았다');
    await s.page.waitForTimeout(400);
    await s.away();
    await s.shot(b);
  }
  console.log(lang, sc, '칸', slot);
  await s.context.close();
}

// 처음 안내: 처음 안내를 켜고 찜 안내만 안 본 것으로
async function hintScene(lang, sc, file) {
  const s = await session(sc, lang, { coach: true });
  await firstShop(s);
  await s.away();
  await s.page.waitForTimeout(400);
  const shown = await s.ev(() => window.__app.hintShown && window.__app.hintShown.id);
  if (shown !== 'hold') throw new Error(`처음 안내가 ${shown}`);
  await s.shot(file);
  await s.context.close();
}

await holdScenes('ko', 3, { a: 'after-1a@3x.png', tip: 'after-tip@3x.png', b: 'after-1b@3x.png' });
await holdScenes('en', 3, { a: 'after-1a-en@3x.png', tip: 'after-tip-en@3x.png', b: 'after-1b-en@3x.png' });
await holdScenes('en', 3, { a: 'after-edition-en@3x.png', tip: 'after-edition-tip-en@3x.png', edition: true });
await hintScene('ko', 3, 'after-hint@3x.png');
await hintScene('en', 3, 'after-hint-en@3x.png');
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
