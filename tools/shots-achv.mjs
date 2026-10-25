// 업적 · 도장 스크린샷: 기록 「업적」 탭(폰 844×390, 한국어 · 영어) · 업적 알림(대국, 하나 · 둘째) · 도장(새 판 · 레퍼토리 · 도감 오프닝 · 말풍선, 1440×810).
//   node tools/shots-achv.mjs [--out docs/shots/achv]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/achv'));

async function loadPlaywright() {
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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

// 받은 업적 몇 · 쌓는 업적의 진행 · 도장(오프닝 셋 · 레퍼토리 몇)
const RECORDS = {
  v: 1, runs: 14, wins: 3, bestAnte: 8, mates: 7, brilliants: 1, legends: 1, tutorialAsked: true, lessonsDone: true,
  grades: { '★': 40, '★★': 12, '★★★': 2 }, danWins: { 0: 1, 1: 1, 4: 1 }, unlocked: { openings: ['standard', 'london', 'sicilian', 'queens_gambit'], dan: 5 },
  bestMove: { score: 1520000, steps: ['P', 'N', 'B', 'R', 'Q'], ante: 7 }, gates: 40, unlockTier: 9,
  feats: { forms: 4, promos: 1, replies: 3, score: 1520000, overflow: 5, chest: 3 },
  mastersBeaten: { heavy_hand: true, mirror: true, fog: true }, synergyTop: { leap: 5, diag: 4, crown: 3 },
  codex: { legendsDone: { opera: true } },
  openingDan: { standard: 4, london: 0, sicilian: 1 }, josekiDan: {},
};

async function open({ w, h, lang }) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.evaluate(([rec, lang]) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1, volume: 0, music: 0 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify(rec));
  }, [RECORDS, lang]);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen, null, { timeout: 20000 });
  await page.evaluate(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.achvQueue.length = 0; a.saveRecords(); });
  return page;
}
async function shot(page, name, { keep = false } = {}) {
  if (!keep) await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('찍음', file);
}

// 구역 id의 가운데로 마우스를 옮긴다(말풍선)
async function hover(page, id) {
  await page.waitForFunction((id) => !!window.__app.ui.find(id), id, { timeout: 5000 }).catch(() => {});
  const at = await page.evaluate((id) => { const a = window.__app, r = a.ui.find(id), c = a.canvas.getBoundingClientRect(); return r && [c.left + ((r.x + r.w / 2) / 480) * c.width, c.top + ((r.y + r.h / 2) / 270) * c.height]; }, id);
  if (!at) throw new Error(`구역 없음 ${id}`);
  await page.mouse.move(at[0], at[1]);
}
// 대국 화면(쉬는 판)에서 업적 둘을 줄 세운다: 첫째 하나 → 첫째가 사라진 뒤 둘째
async function battleToasts(page, tag) {
  await page.evaluate(() => {
    const a = window.__app; a.newRun({ seed: 21 });
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const e0 = a.cmd({ type: 'play' });
    a.go('battle', { events: e0 });
  });
  await page.waitForFunction(() => !window.__app.screen.busy && !window.__app.screen.banner, null, { timeout: 20000 });
  await page.evaluate(() => { window.__app.achvQueue.push('combo8', 'forms5'); });
  await page.waitForTimeout(1100);
  await shot(page, `toast-battle${tag}-1`);
  await page.waitForFunction(() => { const a = window.__app; return !a.achvQueue.length && a.toasts.some((t) => t.achv && t.t > 0.4); }, null, { timeout: 20000 });
  await shot(page, `toast-battle${tag}-2`);
}

for (const lang of ['ko', 'en']) {
  const page = await open({ w: 844, h: 390, lang });
  await page.evaluate(() => window.__app.go('records', { tab: 'achv' }));
  await shot(page, `achv-${lang}-1`);
  await page.evaluate(() => { window.__app.screen.page = 2; window.__app.invalidate(); });
  await shot(page, `achv-${lang}-3`);
  await page.evaluate(() => window.__app.go('records'));
  await shot(page, `records-${lang}`);
  await page.close();
}

{
  const page = await open({ w: 1440, h: 810, lang: 'ko' });
  await battleToasts(page, '');
  await page.evaluate(() => { const a = window.__app; a.toasts.length = 0; a.toTitle(); a.go('setup'); });
  await shot(page, 'stamp-setup');
  await hover(page, 'setup:stamp:standard');
  await shot(page, 'stamp-setup-tip', { keep: true });
  await page.evaluate(() => { const a = window.__app; a.go('codex', { tab: 'openings' }); });
  await shot(page, 'stamp-codex');
  // 레퍼토리: 고를 셋 가운데 둘에 도장
  await page.evaluate(() => {
    const a = window.__app; a.newRun({ seed: 33 });
    const o = a.run.draft.options;
    a.records.josekiDan = { [o[0]]: 2, [o[2]]: 8 };
    a.go('draft');
  });
  await page.waitForTimeout(1600);
  await shot(page, 'stamp-draft');
  await hover(page, 'draft:2:stamp');
  await shot(page, 'stamp-draft-tip', { keep: true });
  await page.close();
}
{
  const page = await open({ w: 1440, h: 810, lang: 'en' });
  await battleToasts(page, '-en');
  await page.evaluate(() => { const a = window.__app; a.toasts.length = 0; a.toTitle(); a.go('setup'); });
  await hover(page, 'setup:stamp:standard');
  await shot(page, 'stamp-setup-tip-en', { keep: true });
  // 영어 레퍼토리: 셋째를 무지개 카드(가장 긴 등급 글 「Rainbow」)로 바꿔 넣고 셋 모두 도장 2400(그림만 — 규칙 판은 안 쓴다)
  await page.evaluate(async () => {
    const a = window.__app, { JOSEKIS } = await import('/src/data/josekis.js');
    a.newRun({ seed: 33 });
    a.run.draft.options[2] = JOSEKIS.find((j) => j.tier === 'rainbow').id;
    a.records.josekiDan = Object.fromEntries(a.run.draft.options.map((id) => [id, 8]));
    a.go('draft');
  });
  await page.waitForTimeout(1600);
  await shot(page, 'stamp-draft-en');
  await page.close();
}

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
