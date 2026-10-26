// 처음 켠 사람 길 훑기: node play.mjs <ko|en> <mobile|desktop> <tutorial|run>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import('/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs');

const ROOT = '/Users/antaeho/workspace/projects/chainmate';
const [LANG = 'ko', VP = 'mobile', MODE = 'run', MAXSTEP = '600'] = process.argv.slice(2);
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', `${LANG}-${VP}-${MODE}`);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const browser = await chromium.launch();
const log = [];
const play = { seen: new Set() };
const L = (s) => { log.push(s); console.log(s); };
try {
  const mobile = VP === 'mobile';
  const ctx = await browser.newContext(mobile ? { viewport: { width: 734, height: 343 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, LANG);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  let n = 0;
  const shot = async (name) => { const f = path.join(OUT, `${String(++n).padStart(3, '0')}-${name}.png`); await page.screenshot({ path: f }); L(`SHOT ${f}`); return f; };
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  async function toXY(gx, gy) {
    return ev(([gx, gy]) => { const c = document.getElementById('screen'); const b = c.getBoundingClientRect(); return [b.left + (gx * b.width) / 480, b.top + (gy * b.height) / 270]; }, [gx, gy]);
  }
  async function tapXY(gx, gy) { const [x, y] = await toXY(gx, gy); if (mobile) await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y, { steps: 4 }); await wait(120); await page.mouse.down(); await page.mouse.up(); } await wait(150); }
  async function click(id, ms = 150) { const r = await region(id); if (!r) return false; await wait(ms); await tapXY(r.x + r.w / 2, r.y + r.h / 2); return true; }
  const state = () => ev(() => { const a = window.__app; return { scr: a.screen && a.screen.name, ov: a.overlay && a.overlay.name, hint: a.hintShown && a.hintShown.id, hintRegion: a.hintShown && a.hintShown.regionId, guide: !!a.guide, toasts: a.toasts.map((t) => t.msg), busy: !!(a.screen && a.screen.busy), regions: a.ui.regions.map((r) => r.id) }; });
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'lesson') && s.busy); }, null, { timeout: 30000 }).catch(() => {});

  await wait(1500);
  let st = await state();
  L(`start ${JSON.stringify({ scr: st.scr, ov: st.ov, hint: st.hint, ps: await ev(() => window.__app.pixelScale) })}`);
  await shot('title-first');

  if (MODE === 'tutorial') {
    await click('welcome:lesson');
    await wait(800);
    // 수업마다: 시범 첫 장면 · 내 차례 걸음마다 · 끝
    for (let k = 0; k < 400; k++) {
      st = await state();
      if (st.scr === 'lessons') { await shot('lessons-end'); break; }
      if (st.scr === 'lesson') {
        const info = await ev(() => { const s = window.__app.screen; return { i: s.index, phase: s.phase, si: s.si, at: s.at, step: s.step, say: s.say, ended: s.ended }; });
        const key = `${info.i}-${info.phase}-${info.at}`;
        if (!play.seen.has(key)) { play.seen.add(key); L(`LESSON ${key} say=${info.say}`); await shot(`lesson${info.i + 1}-${info.phase}-${info.at}`); }
        if (info.phase === 'demo') { await wait(2500); await tapXY(240, 140); await wait(600); continue; }
        if (info.ended || !info.step) { await wait(500); continue; }
        await idle();
        const s = info.step;
        if (s.moves) { await click('btn:moves'); await wait(700); await shot(`lesson${info.i + 1}-moves`); await page.keyboard.press('Escape'); await wait(400); continue; }
        if (s.pick != null) { await click(`hand:${s.pick}`); await wait(300); continue; }
        if (s.discard) { await click('btn:discard'); await wait(500); continue; }
        const sq = await ev((s) => { const scr = window.__app.screen; const t = scr.clickable(); return t.list[0]; }, s);
        if (sq != null) { await click(`sq:${sq}`); await wait(500); continue; }
        await wait(300); continue;
      }
      if (st.scr === 'shop' || st.scr === 'pack') {
        const g = await ev(() => { const a = window.__app; const gd = a.guide; if (!gd) return null; const s = gd.steps[gd.i]; return { i: gd.i, say: s && s.say, target: s && (typeof s.target === 'function' ? s.target(a) : s.target), ok: !!(s && s.ok) }; });
        if (g) {
          const key = `shop-${g.i}`;
          if (!play.seen.has(key)) { play.seen.add(key); L(`GUIDE ${g.i} ${g.say}`); await wait(500); await shot(`lesson8-guide-${g.i}`); }
          if (g.ok) { await click('guide:ok'); await wait(500); continue; }
          if (await click(g.target)) { await wait(700); continue; }
        }
        await wait(400); continue;
      }
      await wait(300);
    }
    // 목록 끝 카드 → 새 판
    await wait(800);
    await shot('end-card');
    await click('lessons:play'); await wait(1500);
    await shot('after-tutorial-newrun');
    st = await state(); L(`after tutorial: ${st.scr} hint=${st.hint}`);
  } else {
    await click('welcome:play');
    await wait(1000);
    const seenScr = new Set(), seenHint = new Set();
    let battles = 0, lose = false;
    for (let k = 0; k < Number(MAXSTEP); k++) {
      st = await state();
      const name = st.ov || st.scr;
      if (!seenScr.has(name)) { seenScr.add(name); await wait(700); await shot(`screen-${name}`); }
      if (st.hint && !seenHint.has(st.hint)) {
        seenHint.add(st.hint);
        const txt = await ev(() => { const a = window.__app; return a.hintRect; });
        L(`HINT ${st.hint} on ${name} region=${st.hintRegion} rect=${JSON.stringify(txt)}`);
        await shot(`hint-${st.hint}`);
      }
      if (st.hint) { await click(st.hintRegion, 200); await wait(300); continue; }
      if (st.toasts.length) L(`TOAST ${name}: ${st.toasts.join(' | ')}`);
      if (name === 'draft') { await wait(800); if (!(await click('draft:0'))) await wait(400); else { await wait(500); await click('draft:ok').catch(() => {}); } await wait(800); continue; }
      if (name === 'select') { await wait(500); await click('select:play'); await wait(800); continue; }
      if (name === 'battle') {
        await idle();
        const d = await ev(async (lose) => {
          const b = window.__app.run && window.__app.run.battle;
          if (!b) return null;
          if (b.status === 'chain') { const l = window.__app.screen.clickable().list; return l.length ? { sq: l[lose ? l.length - 1 : 0] } : null; }
          if (b.status !== 'play') return null;
          if (lose) { const sc = window.__app.screen; return { hand: 0, any: true }; }
          const { decideBattle } = await import('/tools/bot.mjs');
          const x = decideBattle(b);
          return x && (x.play ? { hand: x.play.handIndex, drop: x.play.sq } : { discard: x.discard });
        }, lose);
        if (!d) { await wait(300); continue; }
        if (d.sq != null) { await click(`sq:${d.sq}`); continue; }
        if (d.discard) { for (const i of d.discard) await click(`hand:${i}`); await click('btn:discard'); await wait(400); continue; }
        await click(`hand:${d.hand}`); await wait(250);
        let sq = d.drop;
        if (d.any) sq = await ev(() => { const l = window.__app.screen.clickable().list; return l.length ? l[l.length - 1] : null; });
        if (sq == null) { await click('btn:discard'); await wait(300); continue; }
        await click(`sq:${sq}`); await wait(300);
        continue;
      }
      if (['reward', 'chest', 'legend', 'awaken'].includes(name)) { await wait(800); battles++; if (battles >= 4) lose = true; if (!(await click('next'))) await page.keyboard.press('Enter'); await wait(600); continue; }
      if (name === 'shop') {
        const plan = await ev(async () => {
          const { canBuy } = await import('/src/sim/run.js');
          const r = window.__app.run;
          const i = r.shop.display.findIndex((it) => canBuy(r, it) && (it.kind === 'maxim' || it.kind === 'piece'));
          const p = r.shop.packs.findIndex((pk) => !pk.sold && r.money >= pk.price);
          return { buy: i, pack: p };
        });
        if (plan.buy >= 0) { await click(`shop:buy:${plan.buy}`); await wait(700); continue; }
        if (plan.pack >= 0) { await click(`shop:pack:${plan.pack}`); await wait(700); continue; }
        await click('shop:leave'); await wait(800); continue;
      }
      if (name === 'pack') {
        const i = await ev(() => { const o = window.__app.run.pack.options; const k = o.findIndex((x) => x.kind !== 'engraving'); return k < 0 ? 0 : k; });
        if (!(await click(`pack:pick:${i}`))) { await click('pack:skip'); await wait(400); continue; }
        await wait(500);
        if (await region('target:ok')) { await shot('pack-target'); await click(`deck:${await ev(() => window.__app.run.deck[0].id)}`); await wait(400); await click('target:ok'); }
        await wait(600); continue;
      }
      if (name === 'result') { await wait(1500); await shot('result'); break; }
      if (name === 'title') { L('back at title'); break; }
      await wait(400);
    }
    L(`screens: ${[...seenScr].join(',')}`);
    L(`hints: ${[...seenHint].join(',')}`);
  }
  L(`errors: ${errors.length} ${errors.join(' / ')}`);
  await ctx.close();
} finally {
  await browser.close();
  srv.close();
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
}
