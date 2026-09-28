// 「글 넘침」 전후 스크린샷(사람이 보낸 대국 화면 2026-09-28 「글자 삐져나가는 거」와 모든 화면 점검에서 고친 곳). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-overflow.mjs [--prefix before|after] [--out docs/shots/overflow] [--root 다른 저장소 사본] [--only 이름]
//   --root: 그 폴더의 화면을 찍는다(고치기 전 커밋을 git archive로 푼 사본 — 스크립트는 이 저장소 것). 장면이 그 판에 없는 화면을 부르면 건너뛴다
// 찍는 것(영어는 이름 앞에 en-):
//   battle-editions   격언 다섯(흔함 · 귀함 겹테 · 은박 점선) · 정석 둘 · 시너지 여섯 · 손 넷 — 사람이 보낸 장면
//   battle-chip       같은 대국에서 시너지 칩을 가리킨 모습
//   battle-more       같은 대국에서 시너지 띠의 「+N」을 가리킨 모습(가려진 시너지 전부가 말풍선에)
//   shop              상점(위 띠 단추 · 카드 칩 · 왼쪽 칸 시너지 줄)
//   shop-opened       연 꾸러미 칸(영어 「Opened」가 봉투에 걸치던 곳)
//   codex · settings · reward-stamp   탭 · 단추 · 넘친 목표 도장
//   big-maxim · big-chip   큰 글자 설정에서 격언 칸 · 시너지 칩을 가리킨 모습
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const ROOT = path.resolve(opt('--root', HERE));
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/overflow'));
const ONLY = opt('--only', null);

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
fs.mkdirSync(OUT, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
// 시계를 멈춰 두고 손으로 흘린다(반짝임 · 연출이 찍는 때에 따라 달라지지 않게)
await page.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);
const settle = (ms) => page.clock.runFor(ms);

async function shot(name) {
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
    a.records.codex.maxims = Object.fromEntries(['chivalry', 'quick_change', 'first_move', 'whim', 'edge', 'center', 'payback', 'coronation'].map((id) => [id, true]));
    a.saveRecords();
  });
}
// 판 하나를 세운다: 사람이 보낸 격언 다섯 · 정석 둘 · 기물 몇
const RUN = `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.nextSeed = 11; a.newRun(); const r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.maxims = []; for (const [id, ed] of [['collector_forms'], ['long_chain'], ['first_move'], ['empty_bag'], ['kings_neck', 'foil']]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: ed || null, paid: 5 });
  r.josekis = ['gates', 'stepping']; r.ante = 5; r.blind = 0; r.money = 23;`;
const SHOP = `r.phase = 'shop'; r.shop = { rng: null, display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'C', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: SOLD }], rerolls: 0, promoted: false, removed: false }; a.goPhase();`;
const scenes = [
  ['battle-editions', `${RUN} a.cmd({ type: 'play' }); a.go('battle', { events: [] });`, 2800, null],
  ['battle-chip', `${RUN} a.cmd({ type: 'play' }); a.go('battle', { events: [] });`, 2800, 'fam:'],
  ['battle-more', `${RUN} a.cmd({ type: 'play' }); a.go('battle', { events: [] });`, 2800, 'fam:more'],
  ['shop', `${RUN} ${SHOP.replace('SOLD', 'false')}`, 600, null],
  ['shop-opened', `${RUN} ${SHOP.replace('SOLD', 'true')}`, 600, null],
  ['codex', `const a = window.__app; a.go('codex');`, 400, null],
  ['settings', `const a = window.__app; a.toTitle(); a.openOverlay('settings');`, 400, null],
  // 큰 글자 설정: 말풍선은 화면 아래 가운데 두 배 글자(격언 칸 · 시너지 칩을 가리킨 모습)
  ['big-maxim', `${RUN} a.settings.big = true; a.cmd({ type: 'play' }); a.go('battle', { events: [] });`, 2800, 'maxim:0'],
  ['big-chip', `${RUN} a.settings.big = true; a.cmd({ type: 'play' }); a.go('battle', { events: [] });`, 2800, 'fam:'],
  ['reward-stamp', `${RUN} r.last = { score: 260000, target: 50000, overflow: 5, reason: 'score' }; a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 0, overflow: 5, earned: 1, total: 12 }, events: [] });`, 2200, null],
];
for (const lang of ['ko', 'en']) {
  await boot(lang);
  for (const [name, src, wait, hover] of scenes) {
    const file = `${lang === 'en' ? 'en-' : ''}${name}`;
    if (ONLY && !file.includes(ONLY)) continue;
    await ev(() => window.__app.pointer('move', -10, -10));
    await ev(() => { window.__app.settings.big = false; });
    try { await ev(new Function(src)); } catch (e) { console.log('건너뜀', file, String(e).slice(0, 80)); continue; }
    await settle(wait);
    if (hover) {
      const r = await ev((p) => { const q = window.__app.ui.regions.find((x) => x.id.startsWith(p)); return q && { x: q.x + (q.w >> 1), y: q.y + (q.h >> 1) }; }, hover);
      if (r) { await ev((r) => window.__app.pointer('move', r.x, r.y), r); await settle(200); }
    }
    await shot(file);
  }
}
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
