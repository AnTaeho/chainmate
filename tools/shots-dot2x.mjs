// 두 배 도트 스크린샷(CHM-39): 기물이 그려지는 장면을 1배(창 480×270, 뒷면 N 1)와 3배(창 1440×810, N 3)로 찍는다.
//   node tools/shots-dot2x.mjs [--prefix before|after] [--out docs/shots/dot2x] [--scale 1,3] [--only 이름] [--set stage1|stage2]
// stage1 장면: 대국(여러 기물 · 금빛 적 · 벽 · 보석 · 각인 · 기보 금) · 상점 · 행마 보기 탭 셋 · 도감 기물 · 타이틀.
// stage2 장면(2단계 — 아이콘 · 딱지 문양 · 문장 · 초상 · 카드 그림): 타이틀 · 상점 · 대국(격언 칸) · 관 선택 · 마스터 띠 · 그림 모음판.
//   파일 이름은 stage2-<prefix>-<장면>. 2배(N 2)는 타이틀만 찍는다(시연 판의 줄마다 마스크가 바뀌던 배율).
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/dot2x'));
const ONLY = opt('--only', null);
const SET = opt('--set', 'stage1');
const SCALES = opt('--scale', SET === 'stage2' ? '1,2,3' : '1,3').split(',').map(Number);
const NAME = SET === 'stage2' ? `stage2-${PREFIX}` : PREFIX;

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

for (const sc of SCALES) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', coach: false, calm: true }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3, tutorialDone: true }));
    window.__autoDraft = true;
  });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded');
  await page.evaluate(() => { window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = sc === 1 ? '' : `@${sc}x`;
  async function shot(name) {
    if (ONLY && !name.includes(ONLY)) return;
    if (SET === 'stage2' && sc === 2 && name !== 'title') return;
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${NAME}-${name}${tag}.png`), clip: box });
    console.log('찍음', `${NAME}-${name}${tag}`, '뒷면 N', await ev(() => window.__app.scale));
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await settle(80);
  }
  const away = async () => { await page.mouse.move(2, 2); await settle(300); };

  // ── 2단계 장면
  async function stage2() {
    // 상점: 봇이 첫 상점까지 두고 멈춘다(격언 · 각인 · 기보 · 꾸러미 딱지)
    await ev(async () => {
      const { playRun } = await import('/tools/shopbot.mjs');
      const a = window.__app;
      a.closeOverlay && a.closeOverlay();
      a.newRun({ seed: 11 });
      playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
      a.run.money = 30;
      a.fx.clear();
      a.goPhase();
    });
    await away(); await settle(900);
    await shot('shop');
    // 대국: 격언 칸 다섯(아이콘)
    await ev(() => {
      const a = window.__app;
      a.newRun({ seed: 11 });
      const r = a.run;
      if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      ['chivalry', 'coronation', 'vault', 'lucky_coin', 'opera'].forEach((id, i) => r.maxims.push({ uid: 800 + i, id, data: {}, edition: null, paid: 0 }));
      const e0 = a.cmd({ type: 'play' });
      a.go('battle', { events: e0 });
    });
    await settle(2600); await away();
    await shot('battle');
    // 마스터 띠(초상 64×64): 띠를 멈춰 세운다
    await ev(() => { const s = window.__app.screen; s.banner = { title: '마스터 대가', sub: '마지막 관의 마스터', t: 0.5, life: 9999, col: '#df5a45', master: 'grandmaster' }; });
    await settle(300);
    await shot('banner');
    // 관 선택(세력 문장 2배 · 마스터 초상 1배): 3관, 마스터 차례
    await ev(() => {
      const a = window.__app;
      localStorage.removeItem('chainmate.run.v1'); a.closeOverlay && a.closeOverlay();
      a.newRun({ seed: 21 });
      const r = a.run;
      if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      r.ante = 3; r.blind = 2; r.phase = 'select'; r.shop = null; r.draft = null; r.drafted = [1, 3, 5];
      r.money = 12; a.toasts = [];
      a.goPhase();
    });
    await away(); await settle(600);
    await shot('select');
    // 그림 모음판: 화면과 같은 배율의 오프스크린 캔버스에 아이콘 · 딱지 · 문장 · 초상 · 카드 그림을 모두 그린다
    if ((!ONLY || 'sheet'.includes(ONLY)) && sc !== 2) {
      const url = await ev(async (n) => {
        const [{ drawIcon, ICON_IDS }, kinds, { drawCrest }, { drawPortrait, PORTRAIT_IDS }, parts, { FACTIONS }] = await Promise.all([
          import('/src/render/icons.js'), import('/src/ui/kinds.js'), import('/src/render/crests.js'), import('/src/render/portraits.js'), import('/src/ui/parts.js'), import('/src/data/factions.js')]);
        const W = 480, H = 270;
        const c = document.createElement('canvas'); c.width = W * n; c.height = H * n;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(n, 0, 0, n, 0, 0);
        g.fillStyle = '#e3d6b8'; g.fillRect(0, 0, W, 112);
        g.fillStyle = '#1c2a26'; g.fillRect(0, 112, W, H - 112);
        ICON_IDS.forEach((id, i) => drawIcon(g, id, 4 + (i % 25) * 19, 4 + Math.floor(i / 25) * 17));
        const KK = Object.keys(kinds.KIND);
        KK.forEach((k, i) => kinds.kindTab(g, k, 4 + i * 18, 60));
        ['piece', 'chart', 'engraving', 'golden'].forEach((k, i) => parts.envelope(g, 4 + (KK.length + 1) * 18 + i * 32, 56, 28, 22, k, { open: i === 3 ? 0.4 : 0 }));
        FACTIONS.forEach((f, i) => { drawCrest(g, f.id, 4 + i * 16, 80); drawCrest(g, f.id, 140 + i * 28, 80, { scale: 2 }); });
        FACTIONS.forEach((f, i) => drawCrest(g, f.id, 4 + i * 16, 96, { dim: true }));
        PORTRAIT_IDS.forEach((id, i) => drawPortrait(g, id, 4 + i * 36, 116));
        PORTRAIT_IDS.slice(0, 7).forEach((id, i) => drawPortrait(g, id, 4 + i * 68, 152, 2));
        const EM = ['gold', 'silver', 'ivory', 'ebony', 'glass', 'feather', 'bronze', 'iron', 'amber', 'jade', 'coral', 'marble'];
        EM.forEach((id, i) => parts.engravingEmblem(g, id, 300 + (i % 6) * 24, 116 + Math.floor(i / 6) * 28));
        ['freeze', 'reload', 'taunt'].forEach((id, i) => { g.fillStyle = '#1b2b27'; parts.tacticIcon(g, id, 300 + i * 20, 220); });
        parts.shardIcon(g, 370, 220);
        return c.toDataURL('image/png');
      }, sc);
      fs.writeFileSync(path.join(OUT, `${NAME}-sheet${tag}.png`), Buffer.from(url.split(',')[1], 'base64'));
      console.log('찍음', `${NAME}-sheet${tag}`);
    }
  }

  // 타이틀
  await ev(() => { window.__app.go('title'); });
  await away(); await settle(1500);
  await shot('title');
  if (SET === 'stage2') { await stage2(); await context.close(); continue; }

  // 대국: 적 자리를 여러 기물 · 금빛 적으로 바꾸고 벽 · 보석을 놓는다. 손은 각인 넷 + 기보 금
  await ev(() => {
    const a = window.__app;
    a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    Object.assign(r.charts, { N: 5, B: 3, R: 1 });
    const e0 = a.cmd({ type: 'play' });
    const b = r.battle;
    const kinds = ['P', 'N', 'B', 'R', 'Q', 'Z', 'L', 'O', 'S', 'W', 'T', 'E', 'V', 'M', 'D'];
    let k = 0;
    b.board.forEach((c, sq) => {
      if (!c || c.mine || c.t === 'K' || c.t === 'X' || c.t === 'J') return;
      c.t = kinds[k % kinds.length];
      c.gold = k % 4 === 1;
      k++;
    });
    const free = [];
    b.board.forEach((c, sq) => { if (!c && sq >= 16) free.push(sq); });
    for (const t of ['T', 'E', 'V', 'M', 'D', 'O', 'W', 'Z', 'L', 'S']) { if (k >= kinds.length + 6 || !free.length) break; const sq = free.splice(Math.floor(free.length / 2), 1)[0]; b.board[sq] = { t, id: b.nextId++, born: -1, gold: k % 3 === 0 }; k++; }
    if (free.length) b.board[free.shift()] = { t: 'X', id: b.nextId++, born: -1 };
    if (free.length) b.board[free.pop()] = { t: 'J', id: b.nextId++, born: -1 };
    const hand = [['N', null], ['R', 'gold'], ['B', 'glass'], ['Q', 'feather'], ['P', 'ebony']];
    b.hand = hand.map(([t, eng], i) => ({ id: 900 + i, t, eng: eng ? { id: eng } : null, edition: null }));
    const spec = b.mods.find((m) => m.id === 'charts');
    if (spec) spec.data.levels = { ...r.charts };
    a.go('battle', { events: e0 });
  });
  await settle(2600);
  await away();
  await shot('battle');
  await click('hand:0');
  await away(); await settle(300);
  await shot('battle-pick');

  // 행마 보기 탭 셋(첫 쪽)
  await click('btn:moves');
  for (const tab of ['board', 'basic', 'fairy']) {
    await click(`moves:tab:${tab}`);
    await away();
    let n = 1;
    await shot(`moves-${tab}-${n}`);
    for (let r = await region('moves:next'); r && r.enabled; r = await region('moves:next')) { await click('moves:next'); await away(); await shot(`moves-${tab}-${++n}`); }
  }

  // 상점: 봇이 대국을 끝까지 두고 첫 상점에서 멈춘다
  await ev(async () => {
    const { playRun } = await import('/tools/shopbot.mjs');
    const a = window.__app;
    a.closeOverlay && a.closeOverlay();
    a.newRun({ seed: 11 });
    playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
    a.run.money = 30;
    a.fx.clear();
    a.goPhase();
  });
  await away(); await settle(900);
  await shot('shop');

  // 도감 기물(쪽마다)
  await ev(() => { const a = window.__app; a.closeOverlay && a.closeOverlay(); a.go('codex'); a.screen.tab = 'pieces'; a.screen.page = 0; });
  await away();
  await shot('codex-pieces-1');
  if (await region('codex:next')) { await ev(() => { window.__app.screen.page = 1; }); await away(); await shot('codex-pieces-2'); }
  await context.close();
}
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
