// CHM-25 자잘한 것 정리의 전후 스크린샷: 고치기 전 코드와 고친 뒤 코드에서 같은 장면을 1배 · 3배로 찍는다.
//   node tools/shots-cleanup.mjs --tag before|after [--out docs/shots/cleanup] [--scale 1,3] [--only 1,2,4,5,6]
//   1 영어 증원 안내 줄바꿈(대본을 건너뛴 1관 연습) · 2 대본 대국 뒤 농민군 처음 안내(1관 정식 관 선택)
//   4 대본 중 Esc · ≡ 단추(멈춤) · 5 각인 바꾸기 확인에서 Esc(상점 · 꾸러미) · 6 완성한 명경기가 있는 도감
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TAG = opt('--tag', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/cleanup'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const ONLY = opt('--only', '1,2,4,5,6').split(',');

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
const notes = [];

async function session(sc, lang, { coach = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(([lang, coach]) => { localStorage.clear(); localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, coach })); }, [lang, coach]);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = `${lang === 'ko' ? '' : `-${lang}`}-${TAG}${sc === 1 ? '' : `@${sc}x`}`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function hover(id, dx = null, dy = null) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + (dx ?? r.w / 2), r.y + (dy ?? Math.min(r.h / 2, 16)));
    await page.mouse.move(x, y); await settle(80);
  }
  async function click(id) { await hover(id); await page.mouse.down(); await page.mouse.up(); await settle(80); }
  const away = () => page.mouse.move(2, 2);
  const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 60000 });
  return { page, context, ev, settle, shot, click, hover, away, ready, region };
}

// 대본 대국을 걸음대로 끝까지(행마 보기는 열고 닫는다)
async function playScript(s) {
  const { ev, click, ready, settle } = s;
  for (let guard = 0; guard < 80; guard++) {
    await ready();
    const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const st = g.steps[g.i]; const s = a.screen; return { ok: !!st.ok, target: typeof st.target === 'function' ? st.target(a) : st.target, moves: s.step && s.step.moves, end: s.step && s.step.end }; });
    if (!st) break;
    await settle(150);
    if (st.ok) { await click('guide:ok'); if (st.end) break; continue; }
    await click(st.target);
    if (st.moves) { await settle(400); await click('moves:back'); }
  }
}

// 1: 영어 증원 안내(대본을 건너뛴 평범한 1관 연습의 첫 화면)
async function s1(sc) {
  const s = await session(sc, 'en');
  await s.settle(400);
  await s.click('title:new');
  await s.ready(); await s.away(); await s.settle(300);
  await s.click('guide:skip');
  await s.settle(2600); await s.away(); await s.settle(200);
  const h = await s.ev(() => window.__app.hintShown && window.__app.hintShown.id);
  if (h !== 'incoming') notes.push(`1 ${sc}x: 뜬 안내 ${h}`);
  await s.shot('1-incoming');
  await s.context.close();
}

// 2: 대본 대국 뒤 보상 → 상점 → 레퍼토리 → 1관 정식 관 선택. 처음 보는 곳마다 뜬 안내를 적고, 농민군 안내가 뜬 화면을 찍는다
async function s2(sc) {
  const s = await session(sc, 'ko');
  const { ev, click, settle, away, shot } = s;
  await settle(400);
  await click('title:new');
  await playScript(s);
  const seen = [];
  let shotDone = false;
  for (let k = 0; k < 40; k++) {
    await settle(700); await away(); await settle(200);
    const st = await ev(() => { const a = window.__app; return { screen: a.screen.name, hint: a.hintShown && a.hintShown.id, region: a.hintShown && a.hintShown.regionId }; });
    if (st.hint) {
      seen.push(`${st.hint}@${st.screen}`);
      if (st.hint.startsWith('faction_')) { await shot('2-faction'); shotDone = true; break; }
      await click(st.region);
      continue;
    }
    if (st.screen === 'battle') break;
    if (await s.region('next')) await click('next');
    else if (st.screen === 'shop') await click('shop:leave');
    else if (st.screen === 'draft') { await click('draft:0'); await settle(300); }
    else if (st.screen === 'select') { await shot('2-faction'); shotDone = true; break; }
  }
  notes.push(`2 ${sc}x: 뜬 안내 ${seen.join(' ') || '없음'}${shotDone ? '' : ' · 찍지 못함'}`);
  await s.context.close();
}

// 4: 대본 첫 걸음에서 Esc, 그리고 오른쪽 위 ≡ 단추
async function s4(sc) {
  const s = await session(sc, 'ko');
  const { ev, click, settle, away, shot, page } = s;
  await settle(400);
  await click('title:new');
  await s.ready(); await away(); await settle(300);
  await page.keyboard.press('Escape'); await settle(300);
  notes.push(`4 ${sc}x: Esc 뒤 덮개 ${await ev(() => window.__app.overlay && window.__app.overlay.name)}`);
  await shot('4-script-esc');
  await ev(() => window.__app.closeOverlay());
  await settle(200);
  await click('btn:pause'); await away(); await settle(300);
  notes.push(`4 ${sc}x: ≡ 뒤 덮개 ${await ev(() => window.__app.overlay && window.__app.overlay.name)}`);
  await shot('4-script-pause-button');
  await s.context.close();
}

// 5: 두루마리(유리 각인)를 금 각인이 있는 기물에 — 바꾸기 확인에서 Esc(상점 · 꾸러미)
async function s5(sc) {
  const s = await session(sc, 'ko', { coach: false });
  const { ev, click, settle, away, shot, page } = s;
  await settle(300);
  const setup = (kind) => ev((kind) => {
    const app = window.__app;
    app.overlay = null; app.nextSeed = 11; app.newRun();
    const r = app.run;
    if (r.phase === 'draft') app.cmd({ type: 'joseki', index: 0 });
    r.battle = null;
    r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false };
    r.deck[1].eng = { id: 'gold' };
    if (kind === 'shop') { r.phase = 'shop'; r.consumables = [{ kind: 'engraving', id: 'glass' }]; app.go('shop'); }
    else { r.phase = 'pack'; r.pack = { kind: 'engraving', options: [{ kind: 'engraving', id: 'glass' }, { kind: 'engraving', id: 'gold' }, { kind: 'engraving', id: 'feather' }] }; app.go('pack'); }
    return r.deck[1].id;
  }, kind);
  for (const kind of ['shop', 'pack']) {
    const gid = await setup(kind);
    await settle(1600);
    await click(kind === 'shop' ? 'cons:0' : 'pack:pick:0');
    await click(`deck:${gid}`); await away(); await settle(300);
    await shot(`5-${kind}-swap`);
    await page.keyboard.press('Escape'); await settle(300); await away(); await settle(200);
    const st = await ev(() => { const s = window.__app.screen; return JSON.stringify(s.name === 'shop' ? s.target : { engraveIndex: s.engraveIndex, engraveTarget: s.engraveTarget }); });
    notes.push(`5 ${sc}x ${kind}: Esc 뒤 ${st}`);
    await shot(`5-${kind}-esc`);
  }
  await s.context.close();
}

// 6: 완성한 명경기가 있는 도감(명경기 탭) — 칸마다 가리켜 누를 것을 덮는지 보고, 가장 아래로 긴 말풍선을 찍는다
async function s6(sc, lang) {
  const s = await session(sc, lang, { coach: false });
  const { ev, click, settle, shot, hover } = s;
  await settle(300);
  await ev(() => {
    const app = window.__app, c = app.records.codex;
    for (const id of ['immortal', 'opera', 'century', 'evergreen', 'eight_pawns']) { c.legends[id] = 3; c.legendsDone[id] = true; }
    app.go('title');
  });
  await settle(200);
  await click('title:codex'); await click('codex:tab:legends');
  const ids = await ev(() => window.__app.ui.regions.filter((r) => /^codex:/.test(r.id) && !/^codex:(tab|back|next|prev)/.test(r.id)).map((r) => r.id));
  let worst = null;
  for (const id of ids) {
    await hover(id, 4, 4); await settle(120);
    const st = await ev((id) => {
      const a = window.__app, rs = (a.noteStack && a.noteStack.rects) || (a.tipRect ? [a.tipRect] : []);
      const cross = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      const cov = a.ui.regions.filter((q) => q.onClick && q.enabled !== false && q.id !== id && rs.some((r) => cross(r, q))).map((q) => q.id);
      return { bottom: Math.max(0, ...rs.map((r) => r.y + r.h)), cov };
    }, id);
    notes.push(`6 ${lang} ${sc}x ${id}: 아래 ${st.bottom}${st.cov.length ? ` · 덮음 ${st.cov.join(',')}` : ''}`);
    if (!worst || st.bottom > worst.bottom) worst = { id, ...st };
  }
  await hover(worst.id, 4, 4); await settle(200);
  await shot('6-codex-legend');
  await s.context.close();
}

for (const sc of SCALES) {
  if (ONLY.includes('1')) await s1(sc);
  if (ONLY.includes('2')) await s2(sc);
  if (ONLY.includes('4')) await s4(sc);
  if (ONLY.includes('5')) await s5(sc);
  if (ONLY.includes('6')) for (const lang of ['ko', 'en']) await s6(sc, lang);
}
await browser.close();
srv.close();
for (const n of notes) console.log(n);
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
