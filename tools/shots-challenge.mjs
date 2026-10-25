// 대국 도전 스크린샷: 관 선택 카드 · 대국 중 도전 줄(쉬는 판 · 콤보 중 진행 · 이룬 순간) · 보상 · 진 대국 결과 · 처음 안내.
//   node tools/shots-challenge.mjs [--out docs/shots/challenge] [--only battle,select] [--size 1440x810,844x390] [--lang ko,en]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/challenge'));
const ONLY = opt('--only', '') ? opt('--only', '').split(',') : null;
const SIZES = opt('--size', '1440x810,844x390').split(',').map((s) => s.split('x').map(Number));
const LANGS = opt('--lang', 'ko,en').split(',');
const want = (k) => !ONLY || ONLY.includes(k);

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

const RECORDS = { v: 1, runs: 3, wins: 0, bestAnte: 2, tutorialAsked: true, lessonsDone: true };

async function open({ w, h, lang, coach = true }) {
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
  await page.evaluate(async (coach) => {
    const a = window.__app; const { HINTS } = await import('/src/ui/coach.js');
    a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).filter((k) => coach || k !== 'challenge').map((k) => [k, true]));
    if (a.achvQueue) a.achvQueue.length = 0; a.saveRecords();
  }, coach);
  return page;
}
async function shot(page, name, { move = true, wait = 400 } = {}) {
  if (move) await page.mouse.move(1, 1);
  if (wait) await page.waitForTimeout(wait);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('찍음', file);
}
// 판 seed로 첫 대국(또는 둘째)을 연다
async function battle(page, seed, blind = 0) {
  await page.evaluate(([seed, blind]) => {
    const a = window.__app; a.newRun({ seed });
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    if (blind > 0) a.cmd({ type: 'skip' });
    const e0 = a.cmd({ type: 'play' });
    a.go('battle', { events: e0 });
  }, [seed, blind]);
  await idle(page);
}
const idle = (page) => page.waitForFunction(() => { const s = window.__app.screen; return s.view && !s.busy && !s.banner && !s.intro; }, null, { timeout: 20000 });
// 가장 좋은 수의 줄(놓기 + 잡기들)
const bestLine = (page, opts = {}) => page.evaluate(async (opts) => {
  const { bestMove, lineCommands } = await import('/src/sim/solver.js');
  const r = bestMove(window.__app.run.battle, opts);
  return [{ type: 'drop', handIndex: r.handIndex, sq: r.sq }, ...lineCommands(r.line)];
}, opts);
async function send(page, c) { await page.evaluate((c) => window.__app.screen.send(c), c); await idle(page); }

for (const [w, h] of SIZES) for (const lang of LANGS) {
  const tag = `${lang}-${w}`;
  if (want('select')) {
    const page = await open({ w, h, lang });
    await page.evaluate(() => {
      const a = window.__app; a.newRun({ seed: 10 });
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      a.goPhase();
    });
    await shot(page, `select-${tag}`);
    // 7관 정식(영어 큰 목표 · 긴 도전 글이 가장 긴 카드)
    await page.evaluate(() => { const a = window.__app; a.run.ante = 7; a.run.blind = 1; a.go('select'); });
    await shot(page, `select7-${tag}`);
    await page.close();
  }
  if (want('battle')) {
    const page = await open({ w, h, lang });
    // 10번 판 연습 대국: 「한 콤보에 4번 잡기」 — 가장 좋은 수가 다섯을 잡아 넷째에서 채우고 이긴다
    await battle(page, 10);
    await shot(page, `battle-idle-${tag}`);
    // 띠 아래쪽(뒷줄 칸 구역이 올라오는 곳)을 가리켜도 도전 말풍선
    const hov = await page.evaluate(async () => { const a = window.__app, r = a.canvas.getBoundingClientRect(); return [r.left + (240.5 / 480) * r.width, r.top + (17.5 / 270) * r.height]; });
    await page.mouse.move(hov[0], hov[1]);
    await page.waitForTimeout(300);
    console.log('띠 아래쪽 가리킴', await page.evaluate(() => (window.__app.ui.hover ? window.__app.ui.hover.id : null)));
    await shot(page, `battle-tip-${tag}`, { move: false, wait: 300 });
    const line = await bestLine(page);
    for (const c of line.slice(0, 3)) await send(page, c);
    await shot(page, `battle-progress-${tag}`);
    await send(page, line[3]);
    // 미리 보기: 넷째 잡기를 겨누면 띠의 「4/4」가 깜빡이고 테가 금빛
    await page.evaluate((sq) => { const s = window.__app.screen; s.tapSq = sq; window.__app.invalidate(); }, line[4].sq);
    await shot(page, `battle-preview-${tag}`, { move: false, wait: 200 });
    await page.evaluate(() => { window.__app.screen.tapSq = null; });
    await send(page, line[4]);
    await shot(page, `battle-met-${tag}`, { wait: 60 });
    await page.evaluate((c) => window.__app.screen.send(c), line[5]);
    await page.waitForFunction(() => window.__app.screen.constructor.name === 'RewardScreen', null, { timeout: 20000 });
    await shot(page, `reward-${tag}`, { wait: 2600 });
    await page.close();
    // 20번 판: 첫 수로 「지키는 적 둘」을 이루고 대국이 이어진다 — 이룬 순간(알림 · 반짝) · 도장
    const p2 = await open({ w, h, lang });
    await battle(p2, 20);
    const l2 = await bestLine(p2);
    for (const c of l2.slice(0, -1)) await send(p2, c);
    await p2.evaluate((c) => window.__app.screen.send(c), l2[l2.length - 1]);
    await p2.waitForFunction(() => window.__app.screen.view.chDone, null, { timeout: 20000, polling: 'raf' });
    await shot(p2, `battle-done-${tag}`, { wait: 150 });
    await idle(p2);
    await shot(p2, `battle-stamp-${tag}`, { wait: 2600 });
    await p2.close();
    // 진 대국: 20번 판에서 수를 하나만 남기고 같은 수 — 도전 상금이 상금 줄로 날아간다
    const p3 = await open({ w, h, lang });
    await battle(p3, 20);
    await p3.evaluate(() => { window.__app.run.battle.movesLeft = 1; window.__app.screen.sync(); });
    const l3 = await bestLine(p3);
    for (const c of l3.slice(0, -1)) await send(p3, c);
    await p3.evaluate((c) => window.__app.screen.send(c), l3[l3.length - 1]);
    await p3.waitForFunction(() => window.__app.run.last && window.__app.screen.view && window.__app.screen.view.chDone, null, { timeout: 20000, polling: 'raf' });
    await shot(p3, `battle-lost-${tag}`, { wait: 700 });
    await p3.close();
  }
  if (want('hint')) {
    const page = await open({ w, h, lang, coach: false });
    await battle(page, 10);
    await shot(page, `hint-${tag}`, { wait: 600 });
    await page.close();
  }
}

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
