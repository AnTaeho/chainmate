// CHM-71 기기 잇기: 브라우저(Playwright 크로미움 · 웹킷)로 찍고 확인한다.
//   node tools/shots-link.mjs [--out docs/shots/link] [--scale 3] [--only chromium|webkit]
//     가짜 서버(진짜 요청 → 응답 로직 api/_lib/service.js + 기억 저장소 — test/helpers/fakeapi.js)를 로컬에 띄우고 기기 둘(브라우저 컨텍스트 둘 — 저장이 따로)로
//     설정의 자리 · 기기 잇기 화면의 상태(처음 · 코드 받음 · 숫자 넣는 중 · 확인 · 이어짐 · 틀린 코드 · 시간 지남 · 닿지 못함 · 기기 2대 · 떼기 확인) · 영어 · 1배를 찍는다.
//   node tools/shots-link.mjs --live http://localhost:3210
//     진짜 서버(vercel dev — 로컬 코드 + 실제 DB)로: 크로미움 기기가 코드를 받고 → 웹킷 기기가 화면의 숫자판을 눌러 넣고 → 웹킷에서 오늘의 대국을 봇 판으로 끝내면
//     → 크로미움을 다시 켰을 때 기록 화면 · 순위의 내 줄이 같은지 본다(live-*). 만든 플레이어는 test 표시를 하고 끝나면 지운다. 열쇠 · 코드는 찍지 않는다(코드가 보이는 화면은 그림으로도 남기지 않는다).
// 순위 · 저장은 배포 주소 · 앱에서만 부른다 — 이 도구는 boot({ rankBase })로 주소 머리를 넣어 켠다. Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDailyRun } from '../src/sim/daily.js';
import { hashKey } from '../api/_lib/service.js';
import { playRun } from './shopbot.mjs';
import { fakeApi, LONG_KO, LONG_EN } from '../test/helpers/fakeapi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/link'));
const SC = Number(opt('--scale', 3));
const LIVE = (opt('--live', '') || '').replace(/\/$/, '');
const ONLY = opt('--only', null);
const PLAYER_KEY = 'chainmate.player.v1';
const DAY = '2026-10-08';
// 칸 차례와 상관없이 같은가
const canon = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (x, y) => JSON.stringify(canon(x)) === JSON.stringify(canon(y));

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

// ── 로컬 서버: 정적 파일 + /api(지금 물린 가짜 서버 world). world.mode 'fail'이면 연결을 끊는다
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const fileOf = (url) => {
  const u = decodeURIComponent(new URL(url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  return p.startsWith(ROOT) && fs.existsSync(p) && !fs.statSync(p).isDirectory() ? p : null;
};
let world = null;
const clock = { t: Date.parse(`${DAY}T12:00:00Z`) };
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    if (!world || world.mode === 'fail') { req.socket.destroy(); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await world.fetch(req.url, { method: req.method, headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {}, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined });
    let body = '';
    try { body = JSON.stringify(await r.json()); } catch { res.writeHead(404, { 'content-type': 'text/html' }); res.end('<h1>404</h1>'); return; }
    res.writeHead(r.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  const p = fileOf(req.url);
  if (!p) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const note = (m) => { errors.push(m); console.log(`  ✗ ${m}`); };
const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) errors.push(name); };
function newWorld() {
  let rng = 20261008;
  clock.t = Date.parse(`${DAY}T12:00:00Z`);
  world = fakeApi({ build: 'shots', now: () => clock.t, rand: () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x80000000; } });
  return world;
}

// 기기 하나(브라우저 컨텍스트 — 저장이 따로다). base: 게임을 여는 주소. today: 고정 날짜(가짜 서버). records: 미리 채울 기록 칸
async function open(browser, { lang = 'ko', base = `http://localhost:${port}`, today = null, scale = SC, records = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 480 * scale, height: 270 * scale }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const seen = { api: [], out: [] };
  page.on('pageerror', (e) => note(`페이지 오류 ${e}`));
  page.on('request', (r) => { const u = r.url(); if (new URL(u).pathname.startsWith('/api/')) seen.api.push(`${r.method()} ${new URL(u).pathname}`); else if (!u.startsWith(base)) seen.out.push(u); });
  await page.addInitScript(({ lang }) => {
    window.__CHAINMATE_NO_BOOT__ = true;
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.clear();
      localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, telemetry: false }));
    }
  }, { lang });
  const boot = async () => {
    await page.evaluate(async (today) => { const m = await import('/src/main.js'); await m.boot({ rankBase: '', ...(today ? { today: () => today } : {}) }); }, today);
    await page.waitForFunction(() => window.__app && window.__app.screen);
    // 첫 판 대본 · 기록 알림 · 처음 안내는 치운다
    await page.evaluate((records) => { const a = window.__app; a.records.kingDone = true; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true }; if (records) Object.assign(a.records, records); a.saveRecords(); }, records);
    await page.waitForFunction(() => window.__app.ui.regions.length > 0 && window.__app.stats.frames > 2);
  };
  await page.goto(`${base}/index.html`);
  await boot();
  const settle = (ms = 250) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id);
  const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
  const point = async (id) => { const r = await region(id); if (!r) throw new Error(`구역이 없다 ${id} (화면 ${await ev(() => (window.__app.overlay || window.__app.screen).name)})`); const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 9)); await page.mouse.move(x, y); await settle(80); };
  const click = async (id) => { await point(id); await page.mouse.down(); await page.mouse.up(); await settle(); };
  const away = async () => { const [x, y] = await toXY(476, 30); await page.mouse.move(x, y); await settle(120); };
  const snap = async (name) => { const f = `${name}@${scale}x.png`; await page.screenshot({ path: path.join(OUT, f), clip: await page.locator('#screen').boundingBox() }); console.log('  찍음', f); };
  const shot = async (name) => { await away(); await snap(name); };
  // 넘친 글(연기 시험과 같은 검사)을 이 프레임에 잰다
  const layout = () => ev(async () => { const LL = await import('/src/render/layoutlog.js'); LL.LOG.on = true; window.__app.draw(); const bad = LL.checkLayout().map((q) => q.msg); LL.LOG.on = false; return bad; });
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await settle(150); } };
  const toLink = async () => { await click('title:settings'); await click('set:link'); await click('acct:tab:link'); await until(() => ev(() => window.__app.screen.name === 'link')); };
  const scr = () => ev(() => { const s = window.__app.screen; return { mine: s.mine && s.mine.phase, entry: s.entry && s.entry.phase, fail: s.entry && s.entry.fail, digits: s.entry && s.entry.digits, devices: s.devices, name: s.entry && s.entry.name, gain: s.entry && s.entry.gain }; });
  const code = () => ev(() => window.__app.screen.mine.code);
  // 숫자판을 눌러 넣는다(그림의 단추를 마우스로)
  const type = async (digits) => { for (const d of digits) await click(`link:key:${d}`); };
  const reboot = async () => { await page.reload(); await boot(); };
  return { page, context, seen, settle, ev, region, point, click, shot, snap, away, layout, until, toLink, scr, code, type, reboot };
}

// 기록 조금(도감 · 판 수) — 합쳐진 것 한 줄이 보이게
const RECORDS_A = { runs: 14, wins: 2, bestAnte: 6, codex: { maxims: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i}`, true])), masters: {}, factions: { peasants: true }, legends: {}, legendsDone: {}, openings: { standard: true }, editions: {}, souls: {}, awake: {} } };
const RECORDS_B = { runs: 3, bestAnte: 2 };

// ── 가짜 서버로 화면 상태를 모두 찍는다
async function shots(browserType, name) {
  const tag = name === 'chromium' ? '' : `-${name}`;
  const browser = await browserType.launch();
  console.log(`[${name}] 가짜 서버 http://localhost:${port}`);
  const lay = async (s, what) => { const bad = await s.layout(); if (bad.length) note(`${name} ${what} 글 넘침: ${bad.slice(0, 3).join(' | ')}`); };
  try {
    for (const lang of ['ko', 'en']) {
      const en = lang === 'en' ? '-en' : '', ko = lang === 'ko';
      newWorld();
      const a = await open(browser, { lang, today: DAY, records: RECORDS_A });
      const b = await open(browser, { lang, today: DAY, records: RECORDS_B });
      // 설정의 자리: 이름이 없을 때(언어 줄 오른끝) · 가리켰을 때(제목 자리에 한 줄)
      await a.click('title:settings');
      await lay(a, `설정 ${lang}`);
      if (ko) { await a.shot(`settings${tag}`); await a.point('set:link'); await a.snap(`settings-point${tag}`); }
      await a.click('set:link');
      await a.click('acct:tab:link');
      // 처음
      await a.until(() => a.ev(() => window.__app.screen.name === 'link'));
      await lay(a, `처음 ${lang}`);
      if (ko) await a.shot(`first${tag}`);
      // 코드 받음
      await a.click('link:code');
      await a.until(async () => (await a.scr()).mine === 'code');
      await a.settle(300);
      await lay(a, `코드 받음 ${lang}`);
      await a.shot(`code${en}${tag}`);
      const code = await a.code();
      // B: 틀린 코드 → 한 줄
      await b.toLink();
      if (ko) {
        await b.type('12345678'); await b.click('link:key:go'); await b.click('link:yes');
        await b.until(async () => (await b.scr()).fail === 'bad');
        await lay(b, '틀린 코드');
        await b.shot(`bad${tag}`);
      }
      // 숫자 넣는 중 → 확인 → 이어졌다
      await b.type(code.slice(0, 5));
      await lay(b, `넣는 중 ${lang}`);
      if (ko) await b.shot(`typing${tag}`);
      await b.type(code.slice(5)); await b.click('link:key:go');
      await lay(b, `확인 ${lang}`);
      await b.shot(`confirm${en}${tag}`);
      await b.click('link:yes');
      const done = await b.until(async () => { const q = await b.scr(); return q.entry === 'done' && q.gain ? q : null; });
      check(`${name} ${lang} 이어졌다: 같은 이름 · 합쳐진 것`, !!done && done.name === (await a.ev(() => window.__app.rank.player().name)) && done.gain.codex === 13, done ? `「${done.name}」 · 도감 +${done.gain.codex}` : '');
      await lay(b, `이어짐 ${lang}`);
      await b.shot(`done${en}${tag}`);
      // A: 띄워 둔 코드가 쓰인 것을 안다(몇 초 안에)
      const back = await a.until(async () => (await a.scr()).mine === 'linked', 15000);
      check(`${name} ${lang} 코드를 낸 쪽도 이어진 것을 안다`, !!back);
      await a.settle(400);
      await lay(a, `코드 쪽 이어짐 ${lang}`);
      if (ko) await a.shot(`code-linked${tag}`);
      // 기기 2대: 다시 열면 아래 한 줄 + 이 기기 떼기
      await a.click('link:back'); await a.toLink();
      await a.until(async () => (await a.scr()).devices === 2);
      await lay(a, `기기 2대 ${lang}`);
      await a.shot(`devices${en}${tag}`);
      if (ko) {
        await a.click('link:unlink');
        await lay(a, '떼기 확인');
        await a.shot(`unlink-ask${tag}`);
        await a.click('link:unlink:no');
        // 시간 지남: 받은 코드가 10분을 넘겼다(서버 시계를 민다) — 넣은 쪽에 한 줄, 낸 쪽은 코드를 거둔다
        const c = await open(browser, { lang, today: DAY });
        await a.click('link:code');
        await a.until(async () => (await a.scr()).mine === 'code');
        const old = await a.code();
        clock.t += 601000;
        await c.toLink();
        await c.type(old); await c.click('link:key:go'); await c.click('link:yes');
        await c.until(async () => (await c.scr()).fail === 'expired');
        await lay(c, '시간 지남');
        await c.shot(`expired${tag}`);
        await a.ev(() => { const m = window.__app.screen.mine; m.until = window.__app.cloud.now() - 1; });
        await a.until(async () => (await a.scr()).mine === 'expired');
        await lay(a, '내 코드 시간 지남');
        await a.shot(`code-expired${tag}`);
        // 닿지 못함: 코드 받기 · 넣기 둘 다 한 줄씩
        world.mode = 'fail';
        await c.type('48271593'); await c.click('link:key:go'); await c.click('link:yes');
        await c.until(async () => (await c.scr()).fail === 'unreached');
        await c.click('link:code');
        await c.until(async () => (await c.scr()).mine === 'unreached');
        check(`${name} 닿지 못함: 알림 없음`, (await c.ev(() => window.__app.toasts.length)) === 0);
        await lay(c, '닿지 못함');
        await c.shot(`unreached${tag}`);
        world.mode = 'ok';
        await c.context.close();
        // 가장 넓은 이름: 설정의 이름 줄 옆 자리
        const key = await a.ev((k) => JSON.parse(localStorage.getItem(k)).key, PLAYER_KEY);
        const p = world.store.players.find((q) => q.id === world.store.keys.get(hashKey(key)));
        Object.assign(p, LONG_KO);
        await a.ev(({ k, long }) => { const d = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify({ ...d, ...long })); }, { k: PLAYER_KEY, long: LONG_KO });
        await a.reboot();
        await a.click('title:settings');
        await lay(a, '설정 긴 이름');
        await a.shot(`settings-name${tag}`);
      } else {
        const key = await a.ev((k) => JSON.parse(localStorage.getItem(k)).key, PLAYER_KEY);
        Object.assign(world.store.players.find((q) => q.id === world.store.keys.get(hashKey(key))), LONG_EN);
        await a.ev(({ k, long }) => { const d = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify({ ...d, ...long })); }, { k: PLAYER_KEY, long: LONG_EN });
        await a.reboot();
        await a.click('title:settings');
        await lay(a, '설정 긴 이름 en');
        await a.shot(`settings-name-en${tag}`);
      }
      await a.context.close(); await b.context.close();
    }
    // 1배 화면 한 장
    if (name === 'chromium') {
      newWorld();
      const s = await open(browser, { today: DAY, scale: 1, records: RECORDS_A });
      await s.toLink(); await s.click('link:code');
      await s.until(async () => (await s.scr()).mine === 'code');
      await s.type('4827');
      await lay(s, '1배');
      await s.shot('code');
      await s.context.close();
    }
  } finally { await browser.close(); }
}

// ── 진짜 서버(vercel dev)로: 크로미움 기기 A ↔ 웹킷 기기 B
async function live() {
  const { direct, cleanupTests, cleanupLine } = await import('./db-migrate.mjs');
  const sql = direct();
  const mark = async (s) => {
    const key = await s.until(() => s.ev((k) => { try { return JSON.parse(localStorage.getItem(k)).key; } catch { return null; } }, PLAYER_KEY));
    const hit = key ? await sql.query('update players set test = true where id = (select player_id from player_keys where key_hash = $1) returning id::text as id', [hashKey(key)]) : [];
    return hit.length === 1 ? hit[0].id : null;
  };
  const ca = await pw.chromium.launch(), wb = await pw.webkit.launch();
  console.log(`진짜 서버 ${LIVE} — 크로미움(A) · 웹킷(B)`);
  try {
    console.log(cleanupLine(await cleanupTests(sql)));
    const a = await open(ca, { base: LIVE, records: RECORDS_A }), b = await open(wb, { base: LIVE, records: RECORDS_B });
    const date = await a.ev(() => window.__app.today());
    // A: 코드 받기
    await a.toLink(); await a.click('link:code');
    check('A(크로미움): 코드를 받았다', !!(await a.until(async () => (await a.scr()).mine === 'code')));
    const aid = await mark(a);
    check('A의 플레이어에 test 표시', !!aid);
    // 코드가 보이는 화면(코드 받음 · 확인)은 찍지 않는다 — 진짜 코드를 그림으로 남기지 않는다
    const code = await a.code();
    // B: 플레이어를 먼저 만들어 표시해 두고(끊겨도 지울 수 있게) 화면의 숫자판으로 넣는다
    await b.ev(() => window.__app.rank.ensurePlayer());
    const bid = await mark(b);
    check('B의 플레이어에 test 표시', !!bid && bid !== aid);
    await b.toLink(); await b.type(code); await b.click('link:key:go');
    await b.click('link:yes');
    const done = await b.until(async () => { const q = await b.scr(); return q.entry === 'done' && q.gain ? q : q.fail ? q : null; }, 30000);
    const nameA = await a.ev(() => window.__app.rank.player().name);
    check('B(웹킷): 이어졌다 — 같은 이름 · 합쳐진 것 한 줄', !!done && done.entry === 'done' && done.name === nameA && done.gain.codex === 13, done ? `${done.entry} ${done.fail || ''} · 「${done.name}」 · 도감 +${done.gain && done.gain.codex}` : '답 없음');
    check('B 화면 글 넘침 없음', (await b.layout()).length === 0);
    await b.shot('live-done-webkit');
    const rows = await sql.query('select player_id::text as id from player_keys where player_id = $1::bigint', [aid]);
    const gone = await sql.query('select count(*)::int as n from players where id = $1::bigint', [bid]);
    check('DB: 열쇠 둘이 한 플레이어 · B의 옛 플레이어는 없다', rows.length === 2 && gone[0].n === 0, `열쇠 ${rows.length} · 옛 플레이어 ${gone[0].n}`);
    check('A: 띄워 둔 코드가 쓰인 것을 안다', !!(await a.until(async () => (await a.scr()).mine === 'linked', 20000)));
    await a.settle(600);
    await a.shot('live-linked-chromium');
    // B: 오늘의 대국을 봇 판으로 끝낸다(제출은 게임의 길로 나간다)
    const run = createDailyRun(date); playRun(run, 'random');
    const cmds = JSON.parse(JSON.stringify(run.cmds));
    console.log(`  봇 판 ${date} random: ${run.phase} ${run.ante}관 · 명령 ${cmds.length}개`);
    await b.click('link:back');
    const puts = () => b.seen.api.filter((q) => q === 'PUT /api/save').length;
    const before = puts();
    const end = await b.ev((cmds) => { const a = window.__app; a.newRun({ daily: true }); for (const c of cmds) a.cmd(c); a.goPhase(); return { phase: a.run.phase, ante: a.run.ante, screen: a.screen.name }; }, cmds);
    check('B: 오늘의 대국을 끝냈다', end.screen === 'result', `${end.phase} ${end.ante}관`);
    const st = await b.until(() => b.ev(() => { const a = window.__app, s = a.rank.status(a.run.daily); return s.phase === 'ok' && s.me ? { rank: s.rank, total: s.total, me: s.me } : null; }), 40000);
    check('B: 순위에 올랐다', !!st, st ? `${st.rank}등 / ${st.total}명` : '답 없음');
    await b.settle(500);
    await b.shot('live-result-webkit');
    // 판이 끝난 뒤의 기록이 올라갈 때까지(15초 묶음)
    check('B: 끝난 판의 기록을 올렸다', !!(await b.until(async () => puts() > before, 30000)), `PUT /api/save ${puts() - before}번`);
    await b.settle(800);
    const recB = await b.ev(() => { const r = window.__app.records; return { runs: r.runs, bestAnte: r.bestAnte, daily: r.daily, cells: Object.values(r.codex).reduce((n, k) => n + Object.values(k).filter(Boolean).length, 0) }; });
    // A: 다시 켠다 → 당겨 온다 → 기록 화면 · 순위의 내 줄
    await a.reboot();
    const recA = await a.until(() => a.ev((want) => { const r = window.__app.records; const got = { runs: r.runs, bestAnte: r.bestAnte, daily: r.daily, cells: Object.values(r.codex).reduce((n, k) => n + Object.values(k).filter(Boolean).length, 0) }; return got.runs === want ? got : null; }, recB.runs), 20000);
    check('A(다시 켬): 기록이 B와 같다', !!recA && same(recA, recB), `A ${JSON.stringify(recA)} · B ${JSON.stringify(recB)}`);
    await a.click('title:records'); await a.settle(400);
    check('A 기록 화면 글 넘침 없음', (await a.layout()).length === 0);
    await a.shot('live-records-chromium');
    await a.ev(() => window.__app.toTitle()); await a.settle(300);
    await a.click('title:rank');
    await a.until(async () => !!(await a.region('rank:mine')));
    const mineA = await a.ev((d) => window.__app.rank.board(d, 1).data.me, date);
    await b.click('result:rank');
    await b.until(async () => !!(await b.region('rank:mine')));
    const mineB = await b.ev((d) => window.__app.rank.board(d, 1).data.me, date);
    check('순위의 내 줄이 두 기기에서 같다', !!mineA && JSON.stringify(mineA) === JSON.stringify(mineB) && mineA.rank === st.rank, `${mineA && mineA.rank}등 · ${mineA && mineA.ante}관 · 점수 합 ${mineA && mineA.score}`);
    await a.shot('live-rank-chromium'); await b.shot('live-rank-webkit');
    // A 기기 잇기 화면: 기기 2대 · 마지막으로 맞춘 때
    await a.click('rank:back'); await a.toLink();
    check('A: 기기 2대가 이어져 있다', !!(await a.until(async () => (await a.scr()).devices === 2)));
    await a.shot('live-devices-chromium');
    check('/api 요청이 나갔다 · 다른 곳으로 나간 요청 없음', a.seen.api.length > 0 && b.seen.api.length > 0 && a.seen.out.length + b.seen.out.length === 0, `A ${[...new Set(a.seen.api)].join(' · ')} | B ${[...new Set(b.seen.api)].join(' · ')}`);
  } finally {
    await ca.close(); await wb.close();
    const r = await cleanupTests(sql);
    console.log(cleanupLine(r));
    if (Object.values(r.left).some(Boolean)) note('시험 자료가 남았다');
  }
}

const types = [['chromium', pw.chromium], ['webkit', pw.webkit]].filter(([n]) => !ONLY || ONLY === n);
try {
  if (LIVE) await live();
  else for (const [n, t] of types) await shots(t, n);
} catch (e) { note(`중단: ${e.stack || e}`); }
srv.close(); srv.closeAllConnections?.();
console.log(errors.length ? `어긋남 ${errors.length}: ${errors.join(' | ')}` : '어긋남 0');
process.exit(errors.length ? 1 : 0);
