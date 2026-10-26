// 화면 점검 캡처(읽기 전용): node cap.mjs --size iphone|hd|portrait --lang ko|en [--only re]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/antaeho/workspace/projects/chainmate';
const OUTBASE = '/private/tmp/claude-501/-Users-antaeho-workspace-projects-chainmate/8f330b3b-72b7-4640-9007-8007bff18851/scratchpad/scan/screens';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SIZE = opt('--size', 'iphone');
const LANG = opt('--lang', 'ko');
const ONLY = opt('--only', null);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const SIZES = {
  iphone: { w: 734, h: 343, dpr: 3, engine: 'webkit', touch: true, ua: UA },
  hd: { w: 1280, h: 720, dpr: 1, engine: 'chromium' },
  portrait: { w: 393, h: 659, dpr: 3, engine: 'webkit', touch: true, ua: UA },
};
const S = SIZES[SIZE];
const OUT = path.join(OUTBASE, `${SIZE}-${LANG}`);
fs.mkdirSync(OUT, { recursive: true });

const pw = await import('/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const { fakeApi, seedBoard, demoRows } = await import(`${ROOT}/test/helpers/fakeapi.js`);
const TODAY = '2026-10-08';
const api = fakeApi({ build: 'cap', now: () => Date.parse(`${TODAY}T12:00:00Z`), rand: (() => { let r = 7; return () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x80000000); })() });
await seedBoard(api, TODAY, demoRows(24));
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await api.fetch(req.url, { method: req.method, headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {}, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined });
    let body = ''; try { body = JSON.stringify(await r.json()); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(r.status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(body); return;
  }
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', 1024, ok));
const PORT = srv.address().port;
let browser;
const errors = [];
const log = [];
try {
  browser = await pw[S.engine].launch();
  async function open({ fresh = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dpr, hasTouch: !!S.touch, ...(S.ua ? { userAgent: S.ua } : {}) });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${page.__scene}: ${String(e).slice(0, 300)}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.__scene} console: ${m.text().slice(0, 300)}`); });
    await page.addInitScript(({ lang, fresh }) => {
      window.__CHAINMATE_NO_BOOT__ = true;
      if (!fresh) window.__autoDraft = true;
      window.__rng = () => ({ s: 77 });
      localStorage.clear();
      localStorage.setItem('chainmate.settings.v1', JSON.stringify({ volume: 0, music: 0, lang, telemetry: false }));
    }, { lang: LANG, fresh });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.evaluate(async (today) => { const m = await import('/src/main.js'); m.boot({ rankBase: '', today: () => today }); }, TODAY);
    await page.waitForFunction(() => window.__app && window.__app.screen, null, { timeout: 30000 });
    await page.evaluate((fresh) => {
      const a = window.__app;
      a.settings.volume = 0; a.settings.music = 0; a.settings.speed = 2;
      if (!fresh) {
        a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true });
        a.records.tutorialAsked = true; a.records.lessonsDone = true;
        if (a.overlay && a.overlay.name === 'welcome') a.closeOverlay();
      }
      if (a.achvQueue) a.achvQueue.length = 0;
    }, fresh);
    await page.waitForTimeout(500);
    return page;
  }
  let page = await open();
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms = 400) => page.waitForTimeout(ms);
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(['battle', 'lesson', 'review'].includes(s.name) && s.busy); }, null, { timeout: 30000 }).catch(() => {});
  const toXY = async (gx, gy) => ev(([gx, gy]) => { const r = window.__app.canvas.getBoundingClientRect(); const rot = window.__fit && window.__fit.rot; if (!rot) return [r.left + (gx * r.width) / 480, r.top + (gy * r.height) / 270]; return [r.left + r.width - (gy * r.width) / 270, r.top + (gx * r.height) / 480]; }, [gx, gy]);
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  const regions = (src) => ev((src) => { const rx = new RegExp(src); return window.__app.ui.regions.filter((q) => rx.test(q.id) && q.w > 0).map((q) => q.id); }, src);
  async function click(id) {
    const r = await region(id); if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
    if (S.touch) await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); }
    await settle(80);
  }
  async function hover(id) {
    const r = await region(id); if (!r) return false;
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
    await page.mouse.move(x, y); await settle(150); return true;
  }
  const away = async () => { const [x, y] = await toXY(1, 1); await page.mouse.move(x, y); await settle(60); };
  async function shot(name) {
    const png = await page.screenshot();
    fs.writeFileSync(path.join(OUT, `${name}.png`), png);
    const info = await ev(() => { const a = window.__app; return { screen: a.screen && a.screen.name, overlay: a.overlay && a.overlay.name, k: window.__fit && window.__fit.k, rot: window.__fit && window.__fit.rot }; });
    log.push(`${name} ${JSON.stringify(info)}`);
    console.log('찍음', name, JSON.stringify(info));
  }
  async function scene(name, body) {
    if (ONLY && !new RegExp(ONLY).test(name)) return;
    page.__scene = name;
    try { await body(); } catch (e) { errors.push(`${name} 실패: ${String(e).split('\n')[0]}`); console.log('실패', name, String(e).split('\n')[0]); }
  }
  async function fresh(f = false) { await page.context().close(); page = await open({ fresh: f }); }
  const plan = () => ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
    return d && { hand: d.handIndex, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)) };
  });
  // 명령을 직접 보내 한 수 둔다(창 크기 상관없이)
  const send = (c) => ev((c) => window.__app.screen.send(c), c);

  const BATTLE_OPT = (opt) => {
    const a = window.__app; a.overlay = null; a.nextSeed = opt.seed ?? 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    for (const id of (opt.maxims || ['chivalry', 'quick_change', 'first_move', 'whim', 'sacrifice'])) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 });
    r.ante = opt.ante ?? 3; r.blind = opt.blind ?? 0;
    if (opt.josekis) r.josekis = opt.josekis;
    if (opt.money) r.money = opt.money;
    const ev = a.cmd({ type: 'play' });
    const b = r.battle;
    if (opt.rules) Object.assign(b.rules, opt.rules);
    if (opt.fog) { b.rules.fog = opt.fog; b.revealed = []; }
    a.go('battle', { events: opt.banner ? ev : [] });
  };
  const SHOP = () => {
    const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    for (const [id, edition] of [['chivalry', null], ['quick_change', 'foil'], ['first_move', null], ['whim', 'rainbow'], ['sacrifice', null]]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
    r.consumableSlots = 4; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
    if (r.deck[0]) r.deck[0].soul = 'echo';
    r.money = 60; r.phase = 'shop'; r.ante = 3;
    r.shop = { rng: window.__rng(), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'N', price: 6, sold: false, edition: 'pearl' }, { kind: 'soul', id: 'echo', price: 4, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }, { kind: 'piece', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
    a.go('shop');
  };

  // ── 판 밖
  await scene('01-title', async () => { await ev(() => window.__app.toTitle()); await settle(1800); await away(); await shot('01-title'); });
  await scene('01b-title-hover', async () => { const ids = await regions('^title:'); if (ids[1]) { await hover(ids[1]); await shot('01b-title-hover'); } });
  await scene('02-settings', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.openOverlay('settings'); }); await settle(400); await away(); await shot('02-settings'); });
  await scene('03-lessons', async () => { await ev(async () => { const a = window.__app; a.overlay = null; const { LESSONS } = await import('/src/ui/lessons.js'); a.records.lessonsSeen = Object.fromEntries(LESSONS.slice(0, 3).map((L) => [L.id, true])); a.go('lessons'); }); await settle(400); await away(); await shot('03-lessons'); });
  await scene('03b-lessons-end', async () => { await ev(async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); a.records.lessonsSeen = Object.fromEntries(LESSONS.map((L) => [L.id, true])); a.go('lessons', { end: true }); }); await settle(1200); await away(); await shot('03b-lessons-end'); });
  for (let i = 0; i < 8; i++) {
    await scene(`04-lesson-${i}`, async () => {
      await ev((i) => window.__app.go('lesson', { index: i }), i);
      await settle(2200); await away(); await shot(`04-lesson-${i}-demo`);
      await ev((i) => window.__app.go('lesson', { index: i, phase: 'play' }), i);
      await settle(700); await away(); await shot(`04-lesson-${i}-play`);
    });
  }
  await scene('05-setup', async () => {
    await ev(() => { const a = window.__app; const r = a.records; r.runs = 7; r.wins = 1; r.bestAnte = 8; r.unlocked = { openings: ['standard', 'london', 'queens_gambit'], dan: 2 }; a.toTitle(); a.go('setup'); });
    await settle(500); await away(); await shot('05-setup');
  });
  await scene('06-codex', async () => {
    await ev(() => {
      const a = window.__app, r = a.records;
      for (const id of ['quick_change', 'first_move', 'whim', 'wall_breaker', 'sacrifice', 'edge', 'center', 'chivalry', 'payback', 'coronation']) r.codex.maxims[id] = true;
      for (const id of ['fog', 'mirror', 'grandmaster']) r.codex.masters[id] = true;
      r.codex.legends = { immortal: 3, century: 1 }; r.codex.legendsDone = { immortal: true }; r.codex.editions = { foil: true, rainbow: true };
      a.toTitle(); a.go('codex');
    });
    await settle(400);
    for (const t of ['maxims', 'pieces', 'souls', 'factions', 'legends', 'openings', 'editions']) {
      try { await click(`codex:tab:${t}`); } catch { /* */ }
      await settle(250); await away(); await shot(`06-codex-${t}`);
      if (t === 'maxims' || t === 'pieces' || t === 'legends') { const ids = (await regions('^codex:(?!tab|back|prev|next|page)')); if (ids[0]) { await hover(ids[0]); await shot(`06-codex-${t}-tip`); } }
    }
  });
  await scene('07-records', async () => {
    await ev(() => { const a = window.__app; const r = a.records; Object.assign(r, { runs: 14, wins: 5, bestAnte: 8, mates: 9, legends: 1, brilliants: 3, bestBrilliant: { score: 18240, weight: 3, pieces: ['B', 'P'], ante: 4 } }); r.bestMove = { score: 24800, steps: ['N', 'R', 'B', 'Q', 'Q', 'R', 'N', 'K'], ante: 6 }; a.toTitle(); a.go('records'); });
    await settle(400); await away(); await shot('07-records');
    await ev(() => { const a = window.__app; a.records.achv = a.records.achv || {}; a.go('records', { tab: 'achv' }); }); await settle(400); await away(); await shot('07b-achv');
  });
  await scene('08-unlocks', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.go('unlocks'); }); await settle(400); await away(); await shot('08-unlocks'); });
  await scene('09-rank', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.go('rank'); }); await settle(1500); await away(); await shot('09-rank'); });
  await scene('10-link', async () => { await ev(() => window.__app.go('link')); await settle(800); await away(); await shot('10-link'); try { await click('link:code'); await settle(1200); await shot('10b-link-code'); } catch { /* */ } });
  await scene('11-account', async () => { await ev(() => window.__app.go('account')); await settle(800); await away(); await shot('11-account'); });

  // ── 판 안
  await scene('12-draft', async () => { await ev(() => { window.__autoDraft = false; const a = window.__app; a.toTitle(); a.nextSeed = 33; a.newRun(); if (a.run.phase === 'draft') a.go('draft'); }); await settle(1400); await away(); await shot('12-draft'); await ev(() => { window.__autoDraft = true; }); });
  await scene('13-select', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.newRun({ seed: 7 }); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.goPhase(); }); await settle(800); await away(); await shot('13-select');
    if (await hover('select:path')) await shot('13b-select-path-tip');
    const st = await regions('^select:chal|chal'); if (st[0]) { await hover(st[0]); await shot('13c-select-challenge-tip'); }
  });
  await scene('13d-select-master', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.newRun({ seed: 3 }); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.run.factions[0] = 'hunters'; while (a.run.phase === 'select' && a.run.blind < 2) { a.cmd({ type: 'skip' }); if (a.run.phase === 'pack') a.cmd({ type: 'skipPack' }); } a.goPhase(); }); await settle(800); await away(); await shot('13d-select-master'); });
  await scene('13e-select-ante6', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.newRun({ seed: 9 }); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.run.ante = 6; a.run.blind = 1; a.goPhase(); }); await settle(800); await away(); await shot('13e-select-ante6'); });
  await scene('14-daily', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.newRun({ daily: true }); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.goPhase(); }); await settle(1500); await away(); await shot('14-daily'); });
  await scene('15-battle-banner', async () => { await ev(BATTLE_OPT, { banner: true }); await settle(450); await away(); await shot('15-battle-banner'); });
  await scene('15b-battle-early', async () => { await ev(BATTLE_OPT, {}); await settle(2200); await away(); await shot('15b-battle-early');
    if (await hover('hand:0')) await shot('15c-tip-hand');
    const sqs = await ev(() => { const b = window.__app.run.battle; return b.board.map((c, i) => (c && !c.mine ? i : -1)).filter((i) => i >= 0); });
    if (sqs[0] != null && await hover(`sq:${sqs[0]}`)) await shot('15d-tip-square');
    if (await hover('maxim:0')) await shot('15e-tip-maxim');
    const fam = await regions('^fam:'); if (fam[0]) { await hover(fam[0]); await shot('15f-tip-family'); }
    const chal = await regions('^challenge'); if (chal[0]) { await hover(chal[0]); await shot('15g-tip-challenge'); }
  });
  await scene('16-battle-combo', async () => {
    await ev(BATTLE_OPT, { seed: 11, ante: 3 }); await settle(2200);
    const p = await plan(); if (!p) throw new Error('no plan');
    await click(`hand:${p.hand}`); await settle(250); await away(); await shot('16a-battle-lift');
    await send({ type: 'drop', handIndex: p.hand, sq: p.sq }); await idle();
    for (let i = 0; i < Math.min(3, p.line.length - 1); i++) { await send({ type: 'capture', sq: p.line[i] }); await idle(); }
    if (p.line.length > 1 && await hover(`sq:${p.line[Math.min(3, p.line.length - 1)]}`)) await shot('16b-battle-preview');
    await away(); await settle(300); await shot('16c-battle-combo');
  });
  await scene('17-battle-crowded', async () => {
    await ev(BATTLE_OPT, { seed: 44, ante: 7, josekis: ['stepping', 'gates', 'highway'], maxims: ['chivalry', 'quick_change', 'first_move', 'whim', 'sacrifice', 'diagonal'] });
    await ev(() => { const r = window.__app.run; r.consumables = [{ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'taunt' }]; });
    await settle(2400); await away(); await shot('17-battle-crowded');
  });
  await scene('17b-battle-ante8-master', async () => { await ev(BATTLE_OPT, { seed: 5, ante: 8, blind: 2 }); await settle(3500); await away(); await shot('17b-battle-ante8'); });
  await scene('18-master-intro', async () => { await ev(BATTLE_OPT, { seed: 11, ante: 2, blind: 2, banner: true }); await settle(700); await shot('18-master-intro'); await settle(2500); await away(); await shot('18b-master-battle'); });
  await scene('19-sacrifice', async () => {
    await ev(() => {
      const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun();
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      a.run.charts.N = 2; a.run.consumables = [{ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'reload' }];
      a.cmd({ type: 'play' }); a.go('battle', { events: [] });
      const b = a.run.battle; const sq = (n) => (Number(n[1]) - 1) * 8 + 'abcdefgh'.indexOf(n[0]);
      b.board = Array(64).fill(null);
      for (const [n, t] of Object.entries({ h7: 'K', c7: 'B', d7: 'P', g6: 'P', d5: 'P', e5: 'P', e4: 'P', e3: 'N' })) b.board[sq(n)] = { t, id: 700 + sq(n) };
      b.incoming = []; b.incomingNext = [];
      b.hand = ['P', 'N', 'P', 'B', 'R', 'Q', 'N'].map((t, i) => ({ t, id: 900 + i, eng: null }));
      b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
      b.offered = ['Q', 'R'].map((t, i) => ({ t, id: 980 + i, eng: null }));
      b.target = 150; a.screen.banner = null; a.screen.sync();
    });
    await settle(400); await away(); await shot('19a-hand7');
    await click('hand:3'); await settle(200); await away(); await shot('19b-sac-selected');
    await click('btn:discard'); await idle(); await settle(600); await away(); await shot('19c-sacrificed');
  });
  await scene('20-pause', async () => { await ev(BATTLE_OPT, {}); await settle(2000); await ev(() => window.__app.openOverlay('pause')); await settle(300); await away(); await shot('20-pause');
    await ev(() => window.__app.openOverlay('settings', { back: 'pause' })); await settle(300); await shot('20b-settings-over-pause');
    await ev(() => { const a = window.__app; a.closeOverlay(); a.screen.openMoves && a.screen.openMoves(); }); await settle(400); await away(); await shot('20c-moves');
  });
  await scene('21-shop', async () => { await ev(SHOP); await settle(900); await away(); await shot('21-shop');
    if (await hover('shop:buy:0')) await shot('21b-shop-tip-maxim');
    if (await hover('shop:buy:1')) await shot('21c-shop-tip-piece');
    if (await hover('maxim:2')) await shot('21d-shop-tip-owned');
    const d = await regions('^deck:'); if (d[0]) { await hover(d[0]); await shot('21e-shop-tip-deck'); }
    await ev(() => { const r = window.__app.run; r.shop.packs[0].sold = false; }); try { await click('shop:pack:0'); await settle(1600); await away(); await shot('21f-pack'); } catch (e) { errors.push(`pack: ${e}`); }
  });
  await scene('22-reward', async () => {
    await ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.run.last = { score: 5200, target: 3000, overflow: 1 }; a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 2, overflow: 0, earned: 1, total: 9, challenge: 2 }, events: [] }); });
    await settle(2200); await away(); await shot('22-reward');
  });
  await scene('23-chest', async () => { await ev(() => window.__app.go('chest', { chest: { count: 5, cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'piece', t: 'R' } }, { lit: true, item: { kind: 'engrave', piece: 'P', eng: 'gold' } }, { lit: true, item: { kind: 'awaken', soul: 'echo' } }] } })); await settle(4000); await away(); await shot('23-chest'); });
  await scene('24-awaken', async () => { await ev(() => { const a = window.__app; const p = a.run.deck[0]; p.soul = 'echo'; a.go('awaken', { awaken: { soul: 'echo', piece: p.t, pieceId: p.id, src: 'golden' } }); }); await settle(2500); await away(); await shot('24-awaken'); });
  await scene('25-legend', async () => { await ev(() => window.__app.go('legend', { legend: 'immortal' })); await settle(4500); await away(); await shot('25-legend'); });
  await scene('26-result', async () => {
    await ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 3; r.log.push({ ante: 3, blind: 0, kind: 'practice', score: 1200, target: 3000, best: 800 }); r.phase = 'lost'; a.go('result'); });
    await settle(1200); await away(); await shot('26-result-lost');
    await ev(() => { const a = window.__app; a.overlay = null; a.nextSeed = 11; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); const r = a.run; r.ante = 8; r.log.push({ ante: 8, blind: 2, kind: 'master', score: 9000, target: 6000, best: 3000 }); r.phase = 'won'; a.go('result'); });
    await settle(2500); await away(); await shot('26b-result-won');
  });
  await scene('27-review', async () => {
    await ev(BATTLE_OPT, { ante: 8, seed: 3 }); await settle(2000);
    for (let k = 0; k < 30; k++) {
      await idle();
      const r = await ev(async () => { const a = window.__app; const { legalCommands } = await import('/src/sim/battle.js'); const b = a.screen.live && a.screen.live(); if (!b || a.screen.name !== 'battle' || b.status === 'won' || b.status === 'lost') return 'end'; const c = legalCommands(b).filter((c) => c.type !== 'reboard' && c.type !== 'discard'); if (!c.length) return 'none'; a.screen.send(c[0]); return 'ok'; });
      if (r !== 'ok') break;
    }
    await settle(4000); await away(); await shot('27-review-card');
    try { await click('btn:replay'); await settle(1500); await away(); await shot('27b-review-screen'); } catch { /* */ }
  });

  // ── 처음 본 사람: 처음 켬 덮개 · 도움말 팁
  await fresh(true);
  await scene('28-welcome', async () => { await ev(() => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.toTitle(); a.welcomeShut = false; a.records.tutorialAsked = false; a.records.runs = 0; a.records.lessonsDone = false; }); await settle(1800); await away(); await shot('28-welcome'); });
  await scene('29-coach-battle', async () => { await ev(() => { const a = window.__app; a.overlay = null; a.records.tutorialAsked = true; a.welcomeShut = true; }); await ev(BATTLE_OPT, {}); await settle(2600); await away(); await shot('29-coach-battle'); });
  await scene('29b-coach-challenge', async () => { await ev(() => { const a = window.__app; a.records.coachSeen = { telemetry: true }; }); await ev(BATTLE_OPT, { seed: 10 }); await settle(2600); await away(); await shot('29b-coach-battle2'); });
  await scene('29c-coach-shop', async () => { await ev(SHOP); await settle(1500); await away(); await shot('29c-coach-shop'); });
  await scene('29d-coach-select', async () => { await ev(() => { const a = window.__app; a.toTitle(); a.newRun({ seed: 7 }); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); a.goPhase(); }); await settle(1500); await away(); await shot('29d-coach-select'); });
} finally {
  if (browser) await browser.close();
  srv.close();
  fs.writeFileSync(path.join(OUT, '_log.txt'), [...log, '', '# errors', ...errors].join('\n'));
  console.log(errors.length ? `오류 ${errors.length}\n${errors.join('\n')}` : '오류 0');
}
