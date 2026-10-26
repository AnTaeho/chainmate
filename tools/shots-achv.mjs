// 업적 · 도장 스크린샷: 기록 「업적」 탭(폰 844×390, 한국어 · 영어) · 업적 알림(대국, 하나 · 둘째) · 도장(새 판 · 레퍼토리 · 도감 오프닝 · 말풍선, 1440×810).
// band: 도전 띠 자리를 빌린 업적 알림 → 수를 두면 걷히고 띠가 돌아온다. cover: 보상 상자 위 업적 알림(보상 줄 셋 · 일곱 — 상자 위 · 왼쪽 빈 칸)
//   node tools/shots-achv.mjs [--out docs/shots/achv] [--only records,stamp,band,cover] [--size 1440x810,844x390] [--lang ko,en]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveRoot } from './_lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/achv'));
const ONLY = opt('--only', '') ? opt('--only', '').split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const SIZES = opt('--size', '1440x810,844x390').split(',').map((s) => s.split('x').map(Number));
const LANGS = opt('--lang', 'ko,en').split(',');

const srv = await serveRoot(ROOT);
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

for (const lang of want('records') ? ['ko', 'en'] : []) {
  const page = await open({ w: 844, h: 390, lang });
  await page.evaluate(() => window.__app.go('records', { tab: 'achv' }));
  await shot(page, `achv-${lang}-1`);
  await page.evaluate(() => { window.__app.screen.page = 2; window.__app.invalidate(); });
  await shot(page, `achv-${lang}-3`);
  await page.evaluate(() => window.__app.go('records'));
  await shot(page, `records-${lang}`);
  await page.close();
}

if (want('stamp')) {
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
if (want('stamp')) {
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

// 도전 띠가 있는 대국(10번 판 연습 대국): 업적 알림이 띠 자리에 → 수를 두면(바빠지면) 걷히고 띠가 돌아온다
const idle = (page) => page.waitForFunction(() => { const s = window.__app.screen; return s.view && !s.busy && !s.banner && !s.intro; }, null, { timeout: 20000 });
const bestLine = (page) => page.evaluate(async () => {
  const { bestMove, lineCommands } = await import('/src/sim/solver.js');
  const r = bestMove(window.__app.run.battle);
  return [{ type: 'drop', handIndex: r.handIndex, sq: r.sq }, ...lineCommands(r.line)];
});
async function battle10(page) {
  await page.evaluate(() => {
    const a = window.__app; a.newRun({ seed: 10 });
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const e0 = a.cmd({ type: 'play' });
    a.go('battle', { events: e0 });
  });
  await idle(page);
}
for (const [w, h] of SIZES) for (const lang of LANGS) {
  const tag = `${lang}-${w}`;
  if (want('band')) {
    const page = await open({ w, h, lang });
    await battle10(page);
    await page.evaluate(() => { window.__app.achvQueue.push('combo8'); });
    await page.waitForFunction(() => window.__app.toasts.some((t) => t.achv && t.t > 0.3), null, { timeout: 20000 });
    await shot(page, `band-toast-${tag}`);
    const line = await bestLine(page);
    await page.evaluate((c) => window.__app.screen.send(c), line[0]);
    await page.waitForTimeout(150);
    console.log('수를 둔 뒤 업적 알림', await page.evaluate(() => window.__app.toasts.filter((t) => t.achv).length), '바쁨', await page.evaluate(() => !!window.__app.screen.busy));
    await shot(page, `band-after-${tag}`);
    await page.close();
  }
  if (want('cover')) {
    // 이기는 마지막 수 앞에 업적 셋을 줄 세운다 — 보상 상자에서 하나씩
    const page = await open({ w, h, lang });
    await battle10(page);
    const line = await bestLine(page);
    for (const c of line.slice(0, -1)) { await page.evaluate((c) => window.__app.screen.send(c), c); await idle(page); }
    await page.evaluate(() => { window.__app.achvQueue.push('combo8', 'forms5', 'mate1'); });
    await page.evaluate((c) => window.__app.screen.send(c), line[line.length - 1]);
    await page.waitForFunction(() => window.__app.screen.constructor.name === 'RewardScreen', null, { timeout: 20000 });
    await page.waitForFunction(() => window.__app.toasts.some((t) => t.achv && t.t > 0.3), null, { timeout: 20000 });
    await shot(page, `cover-reward-${tag}-1`);
    await page.waitForFunction(() => window.__app.toasts.some((t) => t.achv && t.t > 0.3) && window.__app.achvQueue.length === 1, null, { timeout: 20000 });
    await shot(page, `cover-reward-${tag}-2`);
    // 보상 줄 일곱(가장 높은 상자): 상자 위가 좁으면 왼쪽 빈 칸에 접어서
    await page.evaluate(() => {
      const a = window.__app; a.toasts.length = 0; a.achvQueue.length = 0;
      a.run.last.overflow = 3;
      a.go('reward', { reward: { base: 3, moves: 4, interest: 2, mate: 3, overflow: 6, challenge: 2, earned: 5, total: 25 }, events: [] });
      a.achvQueue.push('forms5');
    });
    // 상자 왼쪽 빈 칸도 좁으면(영어 넓은 상자) 다음 화면까지 기다린다
    const shown = await page.waitForFunction(() => window.__app.toasts.some((t) => t.achv && t.t > 0.3), null, { timeout: 6000 }).then(() => true, () => false);
    console.log('줄 일곱 보상의 업적 알림', shown ? '뜸' : '기다림', await page.evaluate(() => JSON.stringify(window.__app.screen.coverBox())));
    await page.waitForTimeout(1200);
    await shot(page, `cover-reward7-${tag}`);
    await page.close();
  }
}

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
