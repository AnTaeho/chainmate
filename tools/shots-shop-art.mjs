// 상점 카드 그림 정돈(CHM-69) — 그림 판 · 장면 스크린샷과 화면에서 잰 잉크 상자 표(docs/design-notes/layout.md 「종류 표시」).
//   NPM_CONFIG_PREFIX=<playwright 있는 곳> node tools/shots-shop-art.mjs [--out docs/shots/shop-art] [--browsers webkit,chromium] [--do sheets,scenes,measure]
//   sheets:  after-maxims · after-maxims-vs-old · after-engravings-tactics-souls · after-all (@6x)
//   scenes:  상점 셋 + 영어 · 두루마리가 찬 상점 · 꾸러미 여는 화면 셋 · 관 선택 · 도감 · 대국 (@3x) · 1배 상점
//   measure: 종류 딱지 10 · 그림 칸 전부 · 봉투 넷의 잉크 상자를 캔버스 화소에서 잰다 → after-ink.md
// 파일 이름은 after-<이름>-<브라우저>@Nx.png. 시계를 멈춰 찍는다. 서버는 빈 포트(8123은 건드리지 않는다).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/shop-art')));
const BROWSERS = opt('--browsers', 'webkit,chromium').split(',');
const DO = opt('--do', 'sheets,scenes,measure').split(',');
const PRE = opt('--prefix', 'after');

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master', 'preview', 'pack', 'maxim', 'scroll', 'bag', 'reroll', 'promote', 'maximSell', 'crack', 'hold', 'sacrifice', 'moves'];

// ── 페이지 안에서: 그림 판을 #sheet 캔버스(S배)에 그리고, 잴 네모 목록을 돌려준다
async function sheetIn({ name, S }) {
  const P = await import('/src/ui/parts.js');
  const A = await import('/src/ui/art.js');
  const K = await import('/src/ui/kinds.js');
  const E = await import('/src/ui/envelope.js');
  const G = await import('/src/render/gfx.js');
  const IC = await import('/src/render/icons.js');
  const { PAL } = await import('/src/render/palette.js');
  const D = {};
  for (const n of ['maxims', 'legends', 'engravings', 'tactics', 'souls']) D[n] = await import(`/src/data/${n}.js`);
  const { maximInfo } = await import('/src/sim/run.js');
  const { wrap } = await import('/src/render/text.js');
  const run = window.__app.run;
  const maxims = [...D.maxims.MAXIMS, ...D.legends.LEGENDS].map((m) => ({ kind: 'maxim', id: m.id }));
  const rects = [];
  let W = 480, H = 270, draw = () => {};
  const label = (g, s, cx, y, w, col = PAL.dim) => wrap(String(s), w, false).slice(0, 2).forEach((l, k) => G.text(g, l, cx, y + k * 12, col, { align: 'center' }));
  if (name === 'maxims' || name === 'maxims-vs-old') {
    const vs = name === 'maxims-vs-old', per = vs ? 8 : 10, cw = vs ? 74 : 58, ch = 54;
    W = 8 + per * cw; H = 8 + Math.ceil(maxims.length / per) * ch;
    draw = (g) => maxims.forEach((it, i) => {
      const x = 8 + (i % per) * cw, y = 8 + Math.floor(i / per) * ch, ax = x + Math.floor((cw - 8 - (vs ? 22 + 6 + 24 : 22)) / 2);
      A.itemArt(g, it, ax, y, 0, run);
      rects.push({ group: 'art', key: `maxim:${it.id}`, x: ax, y, w: 22, h: 26 });
      if (vs) { G.rect(g, ax + 28, y + 1, 24, 24, PAL.card); g.save(); g.translate(ax + 28, y + 1); g.scale(2, 2); IC.drawIcon(g, it.id, 0, 0); g.restore(); }
      label(g, maximInfo(it.id).name, x + Math.floor((cw - 8) / 2), y + 28, cw - 6, PAL.ink);
    });
  } else if (name === 'ets') {
    const groups = [
      ['각인', D.engravings.ENGRAVINGS.map((e) => [{ kind: 'engraving', id: e.id }, e.name])],
      ['전술 · 조각 · 도박 · 깨우기', [...D.tactics.TACTICS.map((x) => [{ kind: 'tactic', id: x.id }, x.name]), [{ kind: 'fragment', legend: 'immortal' }, '명경기 조각'], [{ kind: 'gamble', id: 'potion' }, '물약'], [{ kind: 'gamble', id: 'roulette' }, '룰렛'], [{ kind: 'awaken' }, '깨우기'], [{ kind: 'evolve' }, '진화']]],
      ['혼', D.souls.SOULS.map((s) => [{ kind: 'soul', id: s.id }, s.name])],
    ];
    const cw = 52, per = 8;
    const rowsOf = (n) => Math.ceil(n / per);
    W = 8 + per * cw; H = 8 + groups.reduce((s, [, l]) => s + 14 + rowsOf(l.length) * 78, 0);
    draw = (g) => {
      let y = 8;
      for (const [title, list] of groups) {
        G.text(g, title, 8, y, PAL.gold, { bold: true }); y += 14;
        list.forEach(([it, nm], i) => {
          const x = 8 + (i % per) * cw, yy = y + Math.floor(i / per) * 78, w = A.artW(it), ax = x + Math.floor((cw - 8 - w) / 2);
          A.itemArt(g, it, ax, yy, 0, run);
          rects.push({ group: 'art', key: `${it.kind}:${it.id || ''}`, x: ax, y: yy, w, h: 26 });
          // 두루마리 칸의 좁은 그림 칸(18 × 22)
          const sx = x + Math.floor((cw - 8 - 18) / 2);
          if (it.kind !== 'fragment' && it.kind !== 'gamble') { A.itemArt(g, it, sx, yy + 28, 0, run, { w: 18, h: 22 }); rects.push({ group: 'scroll', key: `${it.kind}:${it.id || ''}`, x: sx, y: yy + 28, w: 18, h: 22 }); }
          label(g, nm, x + Math.floor((cw - 8) / 2), yy + 52, cw - 4, PAL.ink);
        });
        y += rowsOf(list.length) * 78;
      }
    };
  } else if (name === 'all') {
    const items = [
      { kind: 'maxim', id: 'chivalry', price: 5 }, { kind: 'maxim', id: 'vault', edition: 'foil', price: 7 }, { kind: 'chart', form: 'R', price: 4 }, { kind: 'engraving', id: 'ebony', price: 5 },
      { kind: 'soul', id: 'spring', price: 6 }, { kind: 'evolve', price: 6 }, { kind: 'tactic', id: 'freeze', price: 4 }, { kind: 'gamble', id: 'potion', price: 2 },
      { kind: 'gamble', id: 'roulette', price: 2 }, { kind: 'piece', t: 'N', price: 5 }, { kind: 'awaken', price: 8 }, { kind: 'fragment', legend: 'immortal', price: 6 },
    ];
    const cw = 108, gap = 6, per = 6;
    const rh = P.itemRowH(items, cw, { run });
    const packY = 8 + 2 * (rh + gap) + 6;
    W = 8 + per * (cw + gap); H = packY + 150;
    const kinds = Object.keys(K.KIND), packs = ['piece', 'chart', 'engraving', 'golden'];
    draw = (g) => {
      items.forEach((it, i) => {
        const x = 8 + (i % per) * (cw + gap), y = 8 + Math.floor(i / per) * (rh + gap);
        P.itemCard(g, it, x, y, cw, rh, { t: 0, run });
        const lay = P.itemCardLayout(it, cw, { run });
        rects.push({ group: 'card-tab', key: it.kind, x: x + 7, y: y + lay.tabY, w: 14, h: 14, bg: K.KIND[it.kind].bg });
        rects.push({ group: 'card-art', key: `${it.kind}:${it.id || it.t || it.form || ''}`, x: x + 7, y: y + lay.art, w: A.artW(it), h: 26 });
      });
      // 종류 딱지 열 · 띠 열
      kinds.forEach((k, i) => {
        K.kindTab(g, k, 8 + i * 18, packY); rects.push({ group: 'tab', key: k, x: 8 + i * 18, y: packY, w: 14, h: 14, bg: K.KIND[k].bg });
        K.kindBand(g, k, 8 + i * 18, packY + 18, 26); rects.push({ group: 'band', key: k, x: 8 + i * 18, y: packY + 18, w: 14, h: 26, bg: K.KIND[k].bg });
      });
      // 봉투: 상점 칸 28×22 · 좁은 칸 24×20 · 아주 좁은 칸 14×12 · 건너뛰기 패 12×10(관 선택 카드는 그 두 배 24×20) · 여는 연출 96×66(닫힘 · 갈라짐 · 젖혀짐)
      packs.forEach((k, i) => {
        const x = 200 + i * 112, y = packY;
        E.envelope(g, x, y, 28, 22, k); rects.push({ group: 'envelope', key: `${k} 28×22`, x, y, w: 28, h: 22, kind: k });
        E.envelope(g, x + 32, y + 1, 24, 20, k); rects.push({ group: 'envelope', key: `${k} 24×20`, x: x + 32, y: y + 1, w: 24, h: 20, kind: k });
        E.envelope(g, x + 60, y + 5, 14, 12, k); rects.push({ group: 'envelope', key: `${k} 14×12`, x: x + 60, y: y + 5, w: 14, h: 12, kind: k });
        E.envelope(g, x + 78, y + 6, 12, 10, k); rects.push({ group: 'envelope', key: `${k} 12×10`, x: x + 78, y: y + 6, w: 12, h: 10, kind: k });
      });
      packs.forEach((k, i) => [0, 0.4, 1].forEach((o, j) => { if (j === 0 || i === j) E.envelope(g, j === 0 ? 8 + i * 104 : 416 + (i - 1) * 104, packY + 64, 96, 66, k, { open: o }); }));
      rects.push(...packs.map((k, i) => ({ group: 'envelope', key: `${k} 96×66`, x: 8 + i * 104, y: packY + 64, w: 96, h: 66, kind: k })));
    };
  }
  let c = document.getElementById('sheet');
  if (c) c.remove();
  c = document.createElement('canvas'); c.id = 'sheet'; c.dataset.w = W; c.width = W * S; c.height = H * S;
  c.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${W * S}px;height:${H * S}px;image-rendering:pixelated`;
  document.body.appendChild(c);
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(S, 0, 0, S, 0, 0);
  g.fillStyle = '#16211d'; g.fillRect(0, 0, W, H);
  draw(g);
  return { W, H, rects };
}

// ── 페이지 안에서: 캔버스 화소로 네모마다 잉크 상자를 잰다(논리 칸 단위, 반 칸까지)
async function measureIn({ sel, rects }) {
  const E = await import('/src/ui/envelope.js');
  const src = document.querySelector(sel);
  const S = sel === '#sheet' ? src.width / Number(src.dataset.w) : src.width / 480;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const near = (i, col) => Math.abs(d[i] - col[0]) + Math.abs(d[i + 1] - col[1]) + Math.abs(d[i + 2] - col[2]) < 12;
  const out = [];
  for (const r of rects) {
    const bgs = r.kind ? null : (r.bg ? [r.bg] : ['#1b2b27', '#2a3a33']).map(hex);
    const env = r.kind ? { F: E.ENV_COL[r.kind], u: S >= 2 ? 0.5 : 1 } : null;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    let px0 = Math.round(r.x * S), py0 = Math.round(r.y * S), px1 = Math.round((r.x + r.w) * S), py1 = Math.round((r.y + r.h) * S);
    let shape = null, dk = null, top = 0, bot = r.h;
    if (env) {
      // 봉투: 덮개 안쪽(테 빼고)의 짙은 문양 화소만
      const dot = env.u, W = r.w / dot, H = r.h / dot, uu = dot === 0.5 ? 2 : 1;
      shape = E.envShape(W, H, uu); dk = hex(env.F.dk);
      top = uu * dot; bot = (shape.fe - shape.e) * dot;
      shape.dot = dot; shape.W = W; shape.uu = uu;
    }
    for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) {
      const i = (y * c.width + x) * 4;
      if (env) {
        const ly = (y - py0) / S, lx = (x - px0) / S, row = Math.floor(ly / shape.dot);
        if (ly < top || ly >= bot) continue;
        const half = shape.half(row) - shape.e;
        if (Math.abs(lx + 0.5 / S - r.w / 2) >= half * shape.dot) continue;
        if (!near(i, dk)) continue;
      } else if (bgs.some((b) => near(i, b))) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) { out.push({ ...r, ink: null }); continue; }
    const L = (x0 - px0) / S, R = (px1 - 1 - x1) / S, T = (y0 - py0) / S - top, B = bot - (y1 + 1 - py0) / S;
    out.push({ group: r.group, key: r.key, w: r.w, h: r.h, ink: { w: (x1 - x0 + 1) / S, h: (y1 - y0 + 1) / S }, L, R, T, B, dx: (L - R) / 2, dy: (T - B) / 2 });
  }
  return out;
}

const SHOPS = [
  { display: [{ kind: 'maxim', id: 'kings_step', price: 5 }, { kind: 'engraving', id: 'ebony', price: 5 }], cons: [{ kind: 'tactic', id: 'freeze' }], packs: [{ kind: 'piece', price: 4 }, { kind: 'chart', price: 4 }], maxims: ['chivalry', 'vault', 'thrift'] },
  { display: [{ kind: 'chart', form: 'R', price: 4 }, { kind: 'gamble', id: 'potion', price: 2 }], cons: [{ kind: 'engraving', id: 'ivory' }], packs: [{ kind: 'engraving', price: 4 }, { kind: 'golden', price: 6 }], maxims: ['coronation', 'low_stance', 'close_call', 'eight_pawns', 'ambusher'] },
  { display: [{ kind: 'evolve', price: 6 }, { kind: 'soul', id: 'spring', price: 6 }], room: 1, cons: [{ kind: 'soul', id: 'ripple' }, { kind: 'evolve' }, { kind: 'tactic', id: 'taunt' }], packs: [{ kind: 'piece', price: 4 }, { kind: 'engraving', price: 4 }, { kind: 'golden', price: 0 }], maxims: ['homecoming', 'second_thought', 'payback'] },
];
const SCROLLS = { display: [{ kind: 'tactic', id: 'reload', price: 4 }, { kind: 'piece', t: 'N', soul: 'inherit', price: 9 }], cons: [{ kind: 'awaken' }, { kind: 'tactic', id: 'freeze' }, { kind: 'engraving', id: 'iron' }, { kind: 'soul', id: 'inherit' }], packs: [{ kind: 'piece', price: 4 }, { kind: 'chart', price: 4 }, { kind: 'engraving', price: 4 }, { kind: 'golden', price: 6 }], maxims: ['all_in', 'pilgrimage', 'soul_collector', 'reversal', 'disguise', 'opera', 'diagonal', 'long_diagonal'] };

async function openShop(page, s) {
  await page.evaluate(({ s, SEEN }) => {
    const a = window.__app;
    a.settings.coach = false; a.records.kingDone = true;
    a.records.coachSeen = Object.fromEntries(SEEN.map((k) => [k, true]));
    localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    r.battle = null; r.money = 24; a.toasts = [];
    r.maxims = s.maxims.map((id, i) => ({ uid: 800 + i, id, data: {}, edition: null, paid: 4 }));
    r.phase = 'shop'; r.consumableSlots = Math.max(2, s.cons.length + (s.room || 0)); r.consumables = s.cons;
    r.shop = { rng: null, display: s.display, packs: s.packs, rerolls: 0, promoted: false, removed: false };
    a.go('shop');
  }, { s, SEEN });
}

const table = {};
for (const name of BROWSERS) {
  let browser;
  try { browser = await pw[name].launch(); } catch (e) { console.log(name, '못 띄움 —', String(e).split('\n')[0]); continue; }
  const session = async (sc, lang = 'ko') => {
    const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript((lang) => { localStorage.clear(); localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1 })); }, lang);
    await page.goto(`http://localhost:${port}/index.html`);
    await page.waitForFunction(() => window.__app && window.__app.screen);
    await page.evaluate(() => document.fonts.ready);
    await page.clock.runFor(300);
    const shot = async (file) => { const box = await page.locator('#screen').boundingBox(); await page.mouse.move(box.x + box.width * 0.26, box.y + box.height * 0.99); await page.clock.runFor(200); await page.screenshot({ path: path.join(OUT, `${PRE}-${file}-${name}${sc === 1 ? '' : `@${sc}x`}.png`), clip: box }); console.log('찍음', `${PRE}-${file}-${name}`); };
    return { page, context, shot };
  };

  if (DO.includes('sheets') || DO.includes('measure')) {
    const { page, context } = await session(1);
    await openShop(page, SHOPS[0]);
    await page.clock.runFor(300);
    const rows = [];
    for (const [sheet, file] of [['maxims', 'maxims'], ['maxims-vs-old', 'maxims-vs-old'], ['ets', 'engravings-tactics-souls'], ['all', 'all']]) {
      const S = 6;
      await page.setViewportSize({ width: 480, height: 270 });
      const sh = await page.evaluate(sheetIn, { name: sheet, S });
      await page.setViewportSize({ width: sh.W * S, height: sh.H * S });
      if (DO.includes('sheets')) { await page.locator('#sheet').screenshot({ path: path.join(OUT, `${PRE}-${file}-${name}@6x.png`) }); console.log('찍음', `${PRE}-${file}-${name}@6x`); }
      if (DO.includes('measure') && sheet !== 'maxims-vs-old') rows.push(...await page.evaluate(measureIn, { sel: '#sheet', rects: sh.rects }));
    }
    table[name] = rows;
    await context.close();
  }

  if (DO.includes('scenes')) {
    for (const [lang, sc, list] of [['ko', 3, [0, 1, 2]], ['en', 3, [1]], ['ko', 1, [1]]]) {
      // 영어 좁은 두루마리 칸은 이름 대신 그림(CHM-41)
      if (lang === 'en') { const s = await session(sc, lang); await openShop(s.page, SCROLLS); await s.page.clock.runFor(900); await s.shot('shop-scrolls-en'); await s.context.close(); }
      const s = await session(sc, lang);
      for (const i of list) { await openShop(s.page, SHOPS[i]); await s.page.clock.runFor(900); await s.shot(`shop${i + 1}${lang === 'en' ? '-en' : ''}`); }
      if (lang === 'ko' && sc === 3) {
        await openShop(s.page, SCROLLS); await s.page.clock.runFor(900); await s.shot('shop-scrolls');
        // 꾸러미 여는 화면: 닫힘 · 덮개가 갈라짐 · 덮개가 젖혀짐(연출 시계를 그 순간에 세운다)
        for (const [tag, t, kind] of [['pack-1-closed', 0, 'engraving'], ['pack-2-split', 0.15, 'engraving'], ['pack-3-open', 0.38, 'engraving'], ['pack-golden-split', 0.15, 'golden']]) {
          await s.page.evaluate(({ t, kind }) => {
            const a = window.__app, r = a.run;
            r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; r.phase = 'pack';
            r.pack = { kind, options: kind === 'golden' ? [{ kind: 'maxim', id: 'memory', edition: 'foil' }, { kind: 'maxim', id: 'chivalry', edition: 'rainbow' }, { kind: 'maxim', id: 'vault', edition: 'pearl' }] : [{ kind: 'engraving', id: 'ebony' }, { kind: 'engraving', id: 'ivory' }, { kind: 'engraving', id: 'iron' }] };
            a.go('pack'); a.screen.update = () => {}; a.screen.t = t;
          }, { t, kind });
          await s.page.clock.runFor(100); await s.shot(tag);
        }
        await s.page.evaluate(() => { const a = window.__app; a.screen.t = 10; });
        await s.page.clock.runFor(300); await s.shot('pack-cards');
        // 관 선택: 건너뛰기 패가 꾸러미 · 금빛 꾸러미인 카드
        const seed = await s.page.evaluate(async () => {
          const { createRun, blindInfo } = await import('/src/sim/run.js');
          for (let seed = 1; seed < 20000; seed++) { const r = createRun({ seed, draft: false }); if (blindInfo(r, 3, 0).tag.kind === 'pack' && ['golden', 'slot'].includes(blindInfo(r, 3, 1).tag.kind)) return seed; }
          return null;
        });
        await s.page.evaluate(async (seed) => {
          const a = window.__app; const { syncBoards } = await import('/src/sim/run.js');
          a.nextSeed = seed; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
          const r = a.run; r.ante = 3; r.blind = 0; r.boards = null; r.money = 12; syncBoards(r); a.go('select');
        }, seed);
        await s.page.clock.runFor(600); await s.shot('select');
        // 도감 격언 탭
        await s.page.evaluate(async () => { const a = window.__app; const { MAXIMS } = await import('/src/data/maxims.js'); a.records.codex.maxims = Object.fromEntries(MAXIMS.map((m) => [m.id, true])); a.go('codex'); a.screen.tab = 'maxims'; a.screen.page = 0; });
        await s.page.clock.runFor(400); await s.shot('codex-maxims');
        // 대국: 격언 칸 + 손 줄 전술
        await s.page.evaluate(() => {
          const a = window.__app; a.newRun({ seed: 11 }); const r = a.run;
          if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
          ['kings_step', 'thrift', 'ambusher', 'vault', 'opera'].forEach((id, i) => r.maxims.push({ uid: 800 + i, id, data: {}, edition: null, paid: 0 }));
          r.consumableSlots = 3; r.consumables = [{ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'reload' }, { kind: 'tactic', id: 'taunt' }];
          const e0 = a.cmd({ type: 'play' }); a.go('battle', { events: e0 });
        });
        await s.page.clock.runFor(3000); await s.shot('battle');
      }
      await s.context.close();
    }
  }
  await browser.close();
}
srv.close();

if (DO.includes('measure')) {
  // 표: 묶음마다 벗어남(가로 · 세로) 0이 아닌 것 · 과녁 밖을 센다. 기물 · 기보 · 진화는 예외(가로만 · 스프라이트)
  const EXC = /^(piece|chart|evolve)/;
  const lines = ['# 화면에서 잰 잉크 상자(CHM-69)', '', '`node tools/shots-shop-art.mjs --do measure`가 쓴다. 논리 칸 단위(@6x 캔버스 화소에서). 벗어남 = (왼 − 오른) / 2 · (위 − 아래) / 2.', ''];
  for (const [name, rows] of Object.entries(table)) {
    lines.push(`## ${name}`, '', '| 묶음 | 수 | 벗어남 0 아님 | 과녁 밖 | 예외 |', '|---|---|---|---|---|');
    const groups = [...new Set(rows.map((r) => r.group))];
    const bad = [];
    for (const gr of groups) {
      const rs = rows.filter((r) => r.group === gr);
      const exc = rs.filter((r) => /art|scroll/.test(gr) && EXC.test(r.key));
      const rest = rs.filter((r) => !exc.includes(r));
      const off = rest.filter((r) => !r.ink || r.dx !== 0 || r.dy !== 0);
      const tgt = (r) => (gr === 'art' || gr === 'card-art' ? r.ink.w >= 14 && r.ink.w <= 18 && r.ink.h >= 16 && r.ink.h <= 20 : gr === 'scroll' ? r.ink.w <= 16 && r.ink.h <= 20 : /tab|band/.test(gr) ? r.ink.w <= 10 && r.ink.h <= 10 : true);
      const out = rest.filter((r) => r.ink && !tgt(r));
      lines.push(`| ${gr} | ${rs.length} | ${off.length} | ${out.length} | ${exc.map((r) => r.key).join(' · ') || '-'} |`);
      bad.push(...off.map((r) => `${gr} ${r.key} 벗어남 ${r.ink ? `${r.dx} · ${r.dy}` : '잉크 없음'}`), ...out.map((r) => `${gr} ${r.key} 과녁 밖 ${r.ink.w}×${r.ink.h}`));
    }
    lines.push('', bad.length ? bad.map((b) => `- ${b}`).join('\n') : '벗어남 0 · 과녁 밖 0', '', '| 묶음 | 물건 | 칸 | 잉크 | 왼 · 오른 · 위 · 아래 |', '|---|---|---|---|---|');
    for (const r of rows.filter((r) => !/^art$|^scroll$/.test(r.group) || EXC.test(r.key))) lines.push(`| ${r.group} | ${r.key} | ${r.w}×${r.h} | ${r.ink ? `${r.ink.w}×${r.ink.h}` : '-'} | ${r.ink ? [r.L, r.R, r.T, r.B].join(' · ') : '-'} |`);
    lines.push('');
    console.log(name, bad.length ? bad.join('\n') : '잉크 상자: 벗어남 0 · 과녁 밖 0', `(잰 것 ${rows.length})`);
  }
  fs.writeFileSync(path.join(OUT, `${PRE}-ink.md`), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, `${PRE}-ink.json`), JSON.stringify(table));
}
console.log(errors.length ? `오류 ${errors.length}\n${errors.slice(0, 5).join('\n')}` : '오류 없음');
