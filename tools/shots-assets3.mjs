// 안 3 그림 검사(CHM-77 3단계, docs/design-notes/art3.md): 아이콘 · 문장 · 초상 · 물건 그림 · 주사위 · 봉투 · 행마 그림 · 타이틀을 찍는다.
//   python3 tools/serve.py <포트> 를 띄운 뒤  node tools/shots-assets3.mjs --port <포트> --out <폴더> [--sizes 960x540,1440x810] [--only 이름]
// 장면: sheet(모든 그림 모음판 — 화면과 같은 배율의 오프스크린) · shop · codex-<탭> · master · coach · pack · moves-<탭> · tip · title
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './_lib/browser.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8000));
const OUT = path.resolve(opt('--out', 'docs/shots/art3-assets'));
const ONLY = opt('--only', null);
const SIZES = opt('--sizes', '960x540,1440x810').split(',').map((s) => s.split('x').map(Number));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const want = (name) => !ONLY || ONLY.split(',').some((o) => name.includes(o) || o.includes(name));

async function open(w, h, { coach = false } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', calm: false }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ v: 1, runs: 3, tutorialAsked: true }));
    window.__autoDraft = true;
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen && document.fonts.status === 'loaded', null, { timeout: 20000 });
  await page.evaluate(() => { window.__app.welcomeShut = true; if (window.__app.overlay && window.__app.overlay.name === 'welcome') window.__app.closeOverlay(); });
  if (!coach) await page.evaluate(() => { window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
async function toXY(page, gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
async function region(page, id) { return ev(page, (id) => { const r = window.__app.ui.regions.find((x) => (id instanceof RegExp ? id.test(x.id) : x.id === id)); return r && { id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id); }
async function hover(page, id) { const r = await region(page, id); if (!r) throw new Error(`no region ${id}`); const [x, y] = await toXY(page, r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await page.waitForTimeout(350); }
async function click(page, id) { const r = await region(page, id); if (!r) throw new Error(`no region ${id}`); const [x, y] = await toXY(page, r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(120); }
const away = async (page, ms = 300) => { await page.mouse.move(2, 2); await page.waitForTimeout(ms); };
async function shot(page, tag, name) {
  const box = await page.locator('#screen').boundingBox();
  const file = path.join(OUT, `${name}-${tag}.png`);
  await page.screenshot({ path: file, clip: box });
  console.log('찍음', file);
}

const SHOP = () => {
  const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const [id, edition] of [['chivalry', null], ['quick_change', null], ['first_move', null], ['vault', null], ['sacrifice', null]]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
  r.consumableSlots = 4; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
  r.money = 60; r.phase = 'shop';
  r.shop = { rng: { s: 77 }, display: [{ kind: 'maxim', id: 'pawn_march', price: 3, sold: false }, { kind: 'engraving', id: 'gold', price: 4, sold: false }, { kind: 'soul', id: 'hunter', price: 4, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'golden', price: 6, sold: false }], rerolls: 0, promoted: false, removed: false };
  a.go('shop');
};
const SHOP2 = () => {
  const a = window.__app; const r = a.run;
  r.shop.display = [{ kind: 'tactic', id: 'taunt', price: 3, sold: false }, { kind: 'gamble', id: 'roulette', price: 3, sold: false }, { kind: 'maxim', id: 'coronation', price: 4, sold: false }];
  r.shop.packs = [{ kind: 'piece', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }];
  a.go('shop');
};

// 모음판: 모든 그림을 화면 배율 n의 오프스크린 캔버스에(아이콘 · 딱지 · 봉투 · 문장 · 초상 · 그림 칸 · 주사위 · 행마 · 별)
async function sheet(page, n) {
  return ev(page, async (n) => {
    const [icons, kinds, crests, portraits, parts, F, art, dice, diag, M, L, E, S, stars] = await Promise.all([
      import('/src/render/icons.js'), import('/src/ui/kinds.js'), import('/src/render/crests.js'), import('/src/render/portraits.js'), import('/src/ui/parts.js'),
      import('/src/data/factions.js'), import('/src/ui/art.js'), import('/src/render/dice.js'), import('/src/ui/diagram.js'), import('/src/data/maxims.js'),
      import('/src/data/legends.js'), import('/src/data/engravings.js'), import('/src/data/souls.js'), import('/src/ui/stars.js')]);
    const W = 480, H = 400;
    const c = document.createElement('canvas'); c.width = W * n; c.height = H * n;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(n, 0, 0, n, 0, 0);
    g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#1a1f45'; g.fillRect(0, 64, W, H - 64);
    // 아이콘: 밝은 바탕 위 · 어두운 바탕 위
    icons.ICON_IDS.forEach((id, i) => icons.drawIcon(g, id, 3 + (i % 30) * 16, 3 + Math.floor(i / 30) * 15));
    icons.ICON_IDS.forEach((id, i) => icons.drawIconLight(g, id, 3 + (i % 30) * 16, 68 + Math.floor(i / 30) * 15));
    // 종류 딱지 · 봉투
    const KK = Object.keys(kinds.KIND);
    KK.forEach((k, i) => kinds.kindTab(g, k, 3 + i * 17, 116));
    ['piece', 'chart', 'engraving', 'golden'].forEach((k, i) => parts.envelope(g, 196 + i * 36, 118, 32, 24, k, { open: 0 }));
    [0.2, 0.5, 1].forEach((o, i) => parts.envelope(g, 344 + i * 40, 118, 32, 24, 'engraving', { open: o }));
    parts.envelope(g, 3, 136, 60, 44, 'piece'); parts.envelope(g, 68, 136, 60, 44, 'golden');
    // 문장: 1배 · 2배 · 흐림
    F.FACTIONS.forEach((f, i) => { crests.drawCrest(g, f.id, 134 + i * 16, 146); crests.drawCrest(g, f.id, 134 + i * 16, 162, { dim: true }); crests.drawCrest(g, f.id, 266 + i * 26, 144, { scale: 2 }); });
    // 초상 1배 · 2배
    portraits.PORTRAIT_IDS.forEach((id, i) => portraits.drawPortrait(g, id, 3 + i * 34, 184));
    portraits.PORTRAIT_IDS.slice(0, 3).forEach((id, i) => portraits.drawPortrait(g, id, 280 + i * 66, 184, 2));
    // 그림 칸: 격언 · 전설 75
    const items = [...M.MAXIMS.map((m) => ({ kind: 'maxim', id: m.id })), ...L.LEGENDS.map((l) => ({ kind: 'maxim', id: l.id }))];
    items.forEach((it, i) => art.itemArt(g, it, 3 + (i % 20) * 24, 220 + Math.floor(i / 20) * 28));
    const more = [...E.ENGRAVINGS.map((e) => ({ kind: 'engraving', id: e.id })), ...S.SOULS.map((s) => ({ kind: 'soul', id: s.id })),
      ...['freeze', 'reload', 'taunt'].map((id) => ({ kind: 'tactic', id })), { kind: 'fragment' }, { kind: 'gamble', id: 'potion' }, { kind: 'gamble', id: 'roulette' }, { kind: 'awaken' }, { kind: 'piece', t: 'Q' }];
    more.forEach((it, i) => art.itemArt(g, it, 3 + (i % 20) * 24, 334 + Math.floor(i / 20) * 28));
    art.itemArt(g, { kind: 'evolve' }, 435, 362);
    // 두루마리 칸 크기(18 × 22) · 격언 작은 칸(20 × 22)
    // 주사위 · 별 · 행마
    dice.diceIcon(g, 290, 368, '#f2ead8');
    stars.drawStars(g, 3, 300, 366, '#efbd55');
    ['P', 'N', 'B', 'R', 'Q', 'K', 'O', 'M'].forEach((t, i) => diag.moveDiagram(g, t, 3 + i * 38, H - 0 - 36 + 0));
    return c.toDataURL('image/png');
  }, n);
}

for (const [w, h] of SIZES) {
  const n = Math.round(w / 480), tag = `N${n}`;
  if (want('sheet')) {
    const page = await open(w, h);
    const url = await sheet(page, n);
    const file = path.join(OUT, `sheet-${tag}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('찍음', file);
    await page.close();
  }
  if (want('shop') || want('pack')) {
    const page = await open(w, h);
    await ev(page, SHOP); await away(page, 900);
    if (want('shop')) {
      await shot(page, tag, 'shop');
      await ev(page, SHOP2); await away(page, 900);
      await shot(page, tag, 'shop2');
      await hover(page, /^shop:buy:2/); await shot(page, tag, 'shop2-tip');
      await ev(page, SHOP); await away(page, 600);
    }
    if (want('pack')) {
      await click(page, 'shop:pack:0'); await page.waitForTimeout(260); await shot(page, tag, 'pack-opening');
      await page.waitForTimeout(1600); await away(page, 300); await shot(page, tag, 'pack-open');
    }
    await page.close();
  }
  if (want('codex') || want('tip')) {
    const page = await open(w, h);
    await ev(page, () => { const a = window.__app; a.records.codex = a.records.codex || {}; const c = a.records.codex; });
    await ev(page, async () => {
      const a = window.__app; const c = a.records.codex;
      const [{ MAXIMS }, { SOULS }, { LEGENDS }] = await Promise.all([import('/src/data/maxims.js'), import('/src/data/souls.js'), import('/src/data/legends.js')]);
      c.maxims = Object.fromEntries(MAXIMS.map((m) => [m.id, 1])); c.souls = Object.fromEntries(SOULS.map((s) => [s.id, 1])); c.legends = Object.fromEntries(LEGENDS.map((l) => [l.id, 2]));
      const { FACTIONS } = await import('/src/data/factions.js'); c.factions = Object.fromEntries(FACTIONS.map((f) => [f.id, 1]));
      a.records.unlockTier = 99;
      a.go('codex');
    });
    for (const tab of ['maxims', 'souls', 'factions', 'legends', 'pieces']) {
      if (!want('codex') && !(tab === 'pieces' && want('tip'))) continue;
      await ev(page, (tab) => { const s = window.__app.screen; s.tab = tab; s.page = 0; }, tab); await away(page);
      if (want('codex')) await shot(page, tag, `codex-${tab}`);
    }
    if (want('tip')) {
      // 기물 탭: 비숍(곧은 대각) · 포(받침 보기 판) 설명 상자의 행마 그림
      for (const [t, name] of [['B', 'tip-piece'], ['O', 'tip-fairy']]) {
        for (let pg = 0; pg < 3; pg++) {
          await ev(page, (pg) => { const s = window.__app.screen; s.tab = 'pieces'; s.page = pg; }, pg); await away(page, 200);
          if (await region(page, `codex:${t}`)) { await hover(page, `codex:${t}`); await shot(page, tag, name); break; }
        }
      }
    }
    await page.close();
  }
  if (want('master')) {
    const page = await open(w, h);
    await ev(page, () => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 2; r.blind = 2; const e = a.cmd({ type: 'play' }); a.go('battle', { events: e }); });
    await page.mouse.move(2, 2); await page.waitForTimeout(700); await shot(page, tag, 'master-intro');
    await page.waitForTimeout(1300); await shot(page, tag, 'master-intro2');
    await ev(page, () => { const s = window.__app.screen; s.banner = { title: '마스터 대가', sub: '마지막 관의 마스터', t: 0.5, life: 9999, col: '#df5a45', master: 'grandmaster' }; });
    await page.waitForTimeout(300); await shot(page, tag, 'master-banner');
    await page.close();
  }
  if (want('select')) {
    const page = await open(w, h);
    await ev(page, () => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay && a.closeOverlay(); a.newRun({ seed: 21 }); const r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); r.ante = 3; r.blind = 2; r.phase = 'select'; r.shop = null; r.draft = null; r.drafted = [1, 3, 5]; r.money = 12; a.toasts = []; a.goPhase(); });
    await away(page, 700); await shot(page, tag, 'select');
    await page.close();
  }
  if (want('coach')) {
    const page = await open(w, h, { coach: true });
    await ev(page, () => { const a = window.__app; a.overlay = null; a.nextSeed = 21; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 1; r.blind = 0; const e = a.cmd({ type: 'play' }); a.go('battle', { events: e }); });
    await away(page, 2500); await shot(page, tag, 'coach');
    await page.close();
  }
  if (want('moves')) {
    const page = await open(w, h);
    await ev(page, () => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const e = a.cmd({ type: 'play' }); a.go('battle', { events: e }); });
    await away(page, 2600);
    await click(page, 'btn:moves');
    for (const tab of ['board', 'basic', 'fairy']) { const r = await region(page, `moves:tab:${tab}`); if (!r) continue; await click(page, `moves:tab:${tab}`); await away(page); await shot(page, tag, `moves-${tab}`); }
    await page.close();
  }
  if (want('juice')) {
    // 손맛: 부서지는 기물 조각 · 연기 · 반짝이 · 색종이 · 나는 동전을 한꺼번에 띄우고 도중을 찍는다
    const page = await open(w, h);
    await ev(page, () => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const e = a.cmd({ type: 'play' }); a.go('battle', { events: e }); });
    await away(page, 2600);
    await ev(page, async () => {
      const a = window.__app, s = a.screen, J = await import('/src/ui/juice.js');
      s.shatter(36, 'Q', 'b'); s.shatter(27, 'N', 'g');
      J.sparkBurst(a.fx, 60, 80, { n: 20 }); J.confetti(a.fx, 240, 120, { n: 40 }); J.flyCoins(a.fx, 200, 200, 60, 230, { n: 5 });
    });
    await page.waitForTimeout(140); await shot(page, tag, 'juice');
    await page.close();
  }
  if (want('title')) {
    const page = await open(w, h);
    await ev(page, () => window.__app.go('title')); await away(page, 1500); await shot(page, tag, 'title');
    await page.close();
  }
}
console.log('오류', errors.length, errors.slice(0, 5).join(' | '));
await browser.close();
