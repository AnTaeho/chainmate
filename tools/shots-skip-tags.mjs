// 건너뛰기 패 여덟(CHM-58 ②) — 실제 화면 스크린샷: 관 선택(한국어 · 영어, 낱말 상자) · 패 여덟 모음 · 꾸러미 칸 셋(꾸러미 칸 패 뒤 상점) ·
// 상점 없이 열린 꾸러미(꾸러미 · 금빛 꾸러미 패). 시안 도구(시안 1 · 2 · 3)를 옮겨 시안 덮어쓰기 없이 구현 화면을 찍는다.
//   NPM_CONFIG_PREFIX=<playwright 있는 곳> node tools/shots-skip-tags.mjs   → docs/shots/skip-tags/after-*.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, 'docs/shots/skip-tags');
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
await new Promise((ok) => srv.listen(0, ok)); // 빈 포트(사람이 쓰는 8123은 건드리지 않는다)
const port = srv.address().port;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master', 'preview', 'pack', 'maxim', 'scroll', 'bag', 'reroll', 'promote'];
const KINDS = ['money', 'chart', 'pack', 'slot', 'reroll', 'double', 'golden', 'fragment'];

// 새 판 하나를 연다(처음 안내는 본 것으로). 이어서 setup(app)을 페이지 안에서
async function session(sc, lang) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  await page.waitForTimeout(300);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev((SEEN) => {
    const a = window.__app;
    a.settings.coach = false;
    a.records.kingDone = true; // 첫 판 대본 대국 없이
    const factions = ['peasants', 'cavalry', 'abbey', 'fortress', 'hunters', 'heralds', 'mercs', 'royal'];
    a.records.coachSeen = Object.fromEntries([...SEEN, ...factions.map((f) => `faction_${f}`)].map((k) => [k, true]));
  }, SEEN);
  const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  const away = async () => { const [x, y] = await toXY(124, 150); await page.mouse.move(x, y); await page.waitForTimeout(250); };
  const shot = async (file, clip = null) => {
    const b = await page.locator('#screen').boundingBox();
    const c = clip ? { x: b.x + clip.x * sc, y: b.y + clip.y * sc, width: clip.w * sc, height: clip.h * sc } : b;
    await page.screenshot({ path: path.join(OUT, file), clip: c });
    console.log('찍음', file);
  };
  return { page, context, ev, toXY, region, away, shot };
}

// 판 시드 찾기: ante관 blind 대국의 패가 kinds[blind]인 시드(판의 첫 레퍼토리 관은 건너뛰도록 draft 없이 잰다)
async function findSeed(s, ante, kinds) {
  return s.ev(async ({ ante, kinds }) => {
    const { createRun, blindInfo } = await import('/src/sim/run.js');
    for (let seed = 1; seed < 20000; seed++) {
      const r = createRun({ seed, draft: false });
      if (kinds.every((k, b) => k == null || blindInfo(r, ante, b).tag.kind === k)) return seed;
    }
    return null;
  }, { ante, kinds });
}
// 시드로 새 판 → (레퍼토리 고르기) → ante관 blind 대국 앞의 관 선택
async function openAt(s, seed, ante, money = 12) {
  await s.ev(async ({ seed, ante, money }) => {
    const a = window.__app;
    const { syncBoards } = await import('/src/sim/run.js');
    a.nextSeed = seed; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    r.ante = ante; r.blind = 0; r.boards = null; r.money = money;
    syncBoards(r);
    a.go('select');
  }, { seed, ante, money });
  await s.page.waitForTimeout(400);
}

// 1. 관 선택: 연습 꾸러미 패 · 정식 두 배 패(한국어 1배 · 3배, 영어 3배) + 가리킨 카드의 낱말 상자
{
  const s0 = await session(1, 'ko');
  const seed = await findSeed(s0, 3, ['pack', 'golden']);
  await s0.context.close();
  for (const [lang, sc] of [['ko', 1], ['ko', 3], ['en', 3]]) {
    const s = await session(sc, lang);
    await openAt(s, seed, 3);
    await s.away();
    await s.shot(`after-select-${lang}${sc === 1 ? '' : `@${sc}x`}.png`);
    if (sc === 3) {
      const r = await s.region('select:board:1');
      const [x, y] = await s.toXY(r.x + r.w / 2, r.y + r.h - 40); await s.page.mouse.move(x, y); await s.page.waitForTimeout(700);
      await s.shot(`after-select-${lang}-hover@3x.png`);
    }
    await s.context.close();
  }
}

// 2. 패 여덟 모음(연습 카드 하나씩) — 위 줄 한국어 · 아래 줄 영어
{
  const parts = { ko: [], en: [] };
  const s0 = await session(1, 'ko');
  const seeds = {};
  for (const k of KINDS) seeds[k] = await findSeed(s0, 3, [k]);
  await s0.context.close();
  for (const lang of ['ko', 'en']) {
    for (const k of KINDS) {
      const s = await session(3, lang);
      await openAt(s, seeds[k], 3);
      await s.away();
      const r = await s.region('select:board:0');
      const f = `_after-all8-${lang}-${k}.png`;
      await s.shot(f, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 });
      parts[lang].push(f);
      await s.context.close();
    }
  }
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const img = (f) => `<img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}">`;
  const row = (lang) => `<div class="r">${parts[lang].map(img).join('')}</div>`;
  await page.setContent(`<html><body style="margin:0;background:#10140f"><style>.r{display:flex;gap:12px;align-items:flex-start}img{display:block}</style><div id="g" style="display:inline-flex;flex-direction:column;gap:12px;padding:12px">${row('ko')}${row('en')}</div></body></html>`);
  await page.locator('#g').screenshot({ path: path.join(OUT, 'after-all8@3x.png') });
  console.log('찍음 after-all8@3x.png');
  await ctx.close();
  for (const l of ['ko', 'en']) for (const f of parts[l]) fs.unlinkSync(path.join(OUT, f));
}

// 3. 꾸러미 칸 셋: 1관 연습을 꾸러미 칸 패로 건너뛰고 정식 대국을 끝낸 뒤 상점(한국어 · 영어)
// 4. 상점 없이 열린 꾸러미: 1관 연습을 꾸러미 패 · 금빛 꾸러미 패로 건너뛴 순간
{
  const s0 = await session(1, 'ko');
  const slot = await findSeed(s0, 1, ['slot']), pack = await findSeed(s0, 1, ['pack']), golden = await findSeed(s0, 1, ['golden']);
  await s0.context.close();
  for (const lang of ['ko', 'en']) {
    const s = await session(3, lang);
    await s.ev(async ({ seed }) => {
      const a = window.__app;
      const { stepBattle } = await import('/tools/bot.mjs');
      a.nextSeed = seed; a.newRun();
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      a.run.money = 14;
      a.cmd({ type: 'skip' });
      a.cmd({ type: 'play' });
      a.run.battle.target = 0;
      while (a.run.phase === 'battle') if (!stepBattle(a.run.battle, (c) => a.cmd(c))) break;
      a.go('shop');
    }, { seed: slot });
    await s.page.waitForTimeout(600);
    await s.away();
    await s.shot(`after-shop-packs3-${lang}@3x.png`);
    await s.context.close();
  }
  for (const [name, seed] of [['pack', pack], ['golden', golden]]) for (const lang of ['ko', 'en']) {
    const s = await session(3, lang);
    await s.ev(async ({ seed }) => {
      const a = window.__app;
      a.nextSeed = seed; a.newRun();
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      a.go('select');
      a.screen.skip();
    }, { seed });
    await s.page.waitForTimeout(1800);
    await s.away();
    await s.shot(`after-tagpack-${name}-${lang}@3x.png`);
    await s.context.close();
  }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
