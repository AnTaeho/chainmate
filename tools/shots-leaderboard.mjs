// CHM-70 순위 화면 쪽: 브라우저(Playwright 크로미움 · 웹킷)로 찍고 확인한다.
//   node tools/shots-leaderboard.mjs [--out docs/shots/leaderboard] [--scale 3] [--only chromium|webkit]
//     가짜 서버(진짜 요청 → 응답 로직 api/_lib/service.js + 기억 저장소 — test/helpers/fakeapi.js)를 로컬에 띄워 화면 상태를 모두 찍는다(after-*).
//     끝에 python3 -m http.server(빈 포트 — /api 없음)로 그대로 열어, 오늘의 대국을 끝내고 순위 화면을 열어도 /api 요청 · 알림이 0인지 본다.
//   node tools/shots-leaderboard.mjs --live http://localhost:3210
//     진짜 서버(vercel dev — 로컬 코드 + 실제 DB)로: 봇이 둔 오늘의 대국을 화면에 그대로 넣어 끝내고 → 순위에 오르는지 → 순위 화면 → 다시 짓기(live-*).
//     만든 플레이어는 곧바로 test 표시를 하고(.env.local의 직접 연결) 끝나면 지운다(tools/daily-e2e.mjs --cleanup과 같은 길). 열쇠는 찍지 않는다.
// 순위는 배포 주소 · 앱에서만 부른다 — 이 도구는 게임이 저절로 켜지지 않게 하고(window.__CHAINMATE_NO_BOOT__) boot({ rankBase })로 주소 머리를 넣어 켠다.
// 봇 판은 Node에서 두고(오늘의 대국은 날짜마다 같은 판) 그 명령 줄을 화면의 app.cmd에 차례로 넣는다 — 제출은 게임의 길 그대로 나간다.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDailyRun } from '../src/sim/daily.js';
import { hashKey } from '../api/_lib/service.js';
import { playRun } from './shopbot.mjs';
import { fakeApi, seedBoard, demoRows, LONG_KO, LONG_EN } from '../test/helpers/fakeapi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/leaderboard'));
const SC = Number(opt('--scale', 3));
const LIVE = (opt('--live', '') || '').replace(/\/$/, '');
const ONLY = opt('--only', null);
const PLAYER_KEY = 'chainmate.player.v1';
// 가짜 서버의 「오늘」: 봇(smart)이 6관 정식 대국에서 지는 날 · 8관을 이기는 날
const DAY_LOST = '2026-10-08', DAY_WON = '2026-10-06';
const shift = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const botCache = new Map();
function botCmds(date, policy = 'smart') {
  const k = `${date}:${policy}`;
  if (!botCache.has(k)) { const run = createDailyRun(date); playRun(run, policy); botCache.set(k, JSON.parse(JSON.stringify(run.cmds))); console.log(`봇 판 ${date} ${policy}: ${run.phase} ${run.ante}관 · 명령 ${run.cmds.length}개`); }
  return botCache.get(k);
}

// ── 로컬 서버: 정적 파일 + /api(지금 물린 가짜 서버 world). world.mode 'fail'이면 연결을 끊고, 'hang'이면 답하지 않는다
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const fileOf = (url) => {
  const u = decodeURIComponent(new URL(url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  return p.startsWith(ROOT) && fs.existsSync(p) && !fs.statSync(p).isDirectory() ? p : null;
};
let world = null;
const hung = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    if (!world || world.mode === 'fail') { req.socket.destroy(); return; }
    if (world.mode === 'hang') { hung.push(res); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await world.fetch(req.url, { method: req.method, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined });
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

// 가짜 서버 하나: 그날 · 전날에 다른 사람들의 성적을 넣어 둔다
async function newWorld(date, { others = 24, yesterday = 13 } = {}) {
  let rng = 20261008;
  const api = fakeApi({ build: 'shots', now: () => Date.parse(`${date}T12:00:00Z`), rand: () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x80000000; } });
  if (others) await seedBoard(api, date, demoRows(others));
  if (yesterday) await seedBoard(api, shift(date, -1), demoRows(yesterday));
  world = api;
  return api;
}

// 화면 하나. base: 게임을 여는 주소. rank: boot에 넘길 주소 머리(없으면 게임이 저절로 켜진다 — 순위는 닿지 못함). today: 고정 날짜
async function open(browser, { lang = 'ko', base = `http://localhost:${port}`, rank = true, today = null, scale = SC, storage = {}, save = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 480 * scale, height: 270 * scale }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const seen = { api: [], out: [] };
  page.on('pageerror', (e) => note(`페이지 오류 ${e}`));
  page.on('request', (r) => { const u = r.url(); if (new URL(u).pathname.startsWith('/api/')) seen.api.push(`${r.method()} ${new URL(u).pathname}`); else if (!u.startsWith(base)) seen.out.push(u); });
  await page.addInitScript(({ lang, rank, storage }) => {
    if (rank) window.__CHAINMATE_NO_BOOT__ = true;
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.clear();
      localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, telemetry: false }));
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    }
  }, { lang, rank, storage });
  await page.goto(`${base}/index.html`);
  if (rank) await page.evaluate(async (today) => { const m = await import('/src/main.js'); await m.boot({ rankBase: '', ...(today ? { today: () => today } : {}) }); }, today);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  // 첫 판 대본 · 기록 알림 · 처음 안내는 치운다
  await page.evaluate((save) => { const a = window.__app; a.records.kingDone = true; a.records.runs = 3; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true }; a.saveRecords(); if (save) { a.newRun({ seed: 7 }); a.go('title'); } }, save);
  await page.waitForFunction(() => window.__app.ui.regions.length > 0 && window.__app.stats.frames > 2);
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
  // 봇이 둔 명령 줄을 그대로 넣어 오늘의 대국을 끝낸다(제출은 게임의 길로 나간다)
  const playDaily = (cmds) => ev((cmds) => { const a = window.__app; a.newRun({ daily: true }); for (const c of cmds) a.cmd(c); a.goPhase(); return { phase: a.run.phase, ante: a.run.ante, screen: a.screen.name, date: a.run.daily }; }, cmds);
  const status = () => ev(() => { const a = window.__app, st = a.rank.status(a.run ? a.run.daily : a.today()); return { phase: st.phase, rank: st.rank ?? null, total: st.total ?? null, me: !!st.me, around: (st.around || []).length }; });
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await settle(150); } };
  return { page, context, seen, settle, ev, region, point, click, shot, snap, away, layout, playDaily, status, until };
}

// ── 진짜 서버(vercel dev)로 확인
async function live(browserType, name) {
  const { direct } = await import('./db-migrate.mjs');
  const sql = direct();
  const browser = await browserType.launch();
  console.log(`[${name}] 진짜 서버 ${LIVE}`);
  let hash = null;
  try {
    const s = await open(browser, { base: LIVE });
    const date = await s.ev(() => window.__app.today());
    const st0 = await s.playDaily(botCmds(date, 'random'));
    check('오늘의 대국을 봇 판으로 끝냈다', st0.screen === 'result', `${date} · ${st0.phase} ${st0.ante}관`);
    // 만든 플레이어에 곧바로 test 표시(지울 수 있게). 열쇠는 Node 안에서 해시로만 쓴다
    const key = await s.until(() => s.ev((k) => { try { return JSON.parse(localStorage.getItem(k)).key; } catch { return null; } }, PLAYER_KEY));
    hash = key ? hashKey(key) : null;
    const marked = hash ? await sql.query('update players set test = true where key_hash = $1 returning id', [hash]) : [];
    check('만든 플레이어에 test 표시', marked.length === 1);
    const st = await s.until(async () => { const q = await s.status(); return q.phase !== 'pending' && q.phase !== 'none' ? q : null; }, 40000);
    check('순위에 올랐다(서버가 다시 두어 등수를 돌려줬다)', !!st && st.phase === 'ok' && st.rank >= 1 && st.me, st ? `${st.phase} · ${st.rank}등 / ${st.total}명 · 이웃 ${st.around}줄` : '답 없음');
    const row = await sql.query('select s.ante, s.blind, s.won, s.score_total from daily_scores s join players p on p.id = s.player_id where p.key_hash = $1', [hashKey(key || '')]);
    check('DB에 그날 성적이 남았다', row.length === 1, row.length ? `${row[0].ante}관 ${row[0].blind + 1}번째 대국 · 점수 합 ${row[0].score_total}` : '');
    await s.settle(600);
    check('결과 화면 글 넘침 없음', (await s.layout()).length === 0);
    await s.shot(`live-result-${name}`);
    await s.click('result:rank');
    await s.until(async () => !!(await s.region('rank:mine')));
    check('순위 화면에 내 줄이 붙박혔다', !!(await s.region('rank:mine')));
    check('순위 화면 글 넘침 없음', (await s.layout()).length === 0);
    await s.shot(`live-rank-${name}`);
    await s.click('rank:tab:yesterday'); await s.settle(1500);
    await s.shot(`live-rank-yesterday-${name}`);
    await s.click('rank:back'); await s.click('result:title'); await s.click('title:settings');
    const before = await s.ev(() => window.__app.rank.player().name);
    await s.click('set:name');
    const after = await s.until(() => s.ev((b) => { const n = window.__app.rank.player().name; return n !== b ? n : null; }, before));
    check('다시 짓기 → 이름이 바뀌었다', !!after, `「${before}」 → 「${after}」`);
    await s.shot(`live-settings-${name}`);
    check('/api 요청이 나갔다', s.seen.api.length > 0, [...new Set(s.seen.api)].join(' · '));
    check('다른 곳으로 나간 요청 없음', s.seen.out.length === 0, s.seen.out.slice(0, 3).join(' '));
    await s.context.close();
  } finally {
    await browser.close();
    // 표시가 안 된 채 끊겼어도 만든 플레이어는 해시로 지운다(성적 · 명령 줄도 같이)
    if (hash) await sql.query('delete from players where key_hash = $1', [hash]).catch((e) => note(`플레이어 지우기 실패 ${e.message}`));
  }
}

// ── 가짜 서버로 화면 상태를 모두 찍는다
async function shots(browserType, name) {
  const tag = name === 'chromium' ? '' : `-${name}`;
  const browser = await browserType.launch();
  console.log(`[${name}] 가짜 서버 http://localhost:${port}`);
  const lay = async (s, what) => { const bad = await s.layout(); if (bad.length) note(`${name} ${what} 글 넘침: ${bad.slice(0, 3).join(' | ')}`); };
  try {
    // 첫 화면: 여섯 칸(저장 없음) · 일곱 칸(저장 있음 — 「순위」를 가리킨 채)
    for (const lang of ['ko', 'en']) {
      await newWorld(DAY_LOST);
      const en = lang === 'en' ? '-en' : '';
      let s = await open(browser, { lang, today: DAY_LOST });
      await s.settle(700);
      if (lang === 'ko') { await lay(s, '첫 화면 여섯 칸'); await s.shot(`after-title-6${tag}`); }
      await s.context.close();
      s = await open(browser, { lang, today: DAY_LOST, save: true });
      await s.settle(700);
      await s.point('title:rank');
      await lay(s, `첫 화면 일곱 칸 ${lang}`);
      await s.snap(`after-title-7${en}${tag}`);
      // 순위 화면: 오늘 안 둠
      await s.click('title:rank');
      await s.until(async () => !!(await s.region('rank:play')));
      if (lang === 'ko') { await lay(s, '안 둠'); await s.shot(`after-rank-unplayed${tag}`); }
      await s.context.close();

      // 진 판: 결과 카드 → 순위 보기 → 내 쪽 → 어제 → 설정 이름 줄 → 다시 짓기
      s = await open(browser, { lang, today: DAY_LOST });
      await s.playDaily(botCmds(DAY_LOST));
      let st = await s.until(async () => { const q = await s.status(); return q.phase === 'ok' && q.me ? q : null; });
      check(`${name} ${lang} 진 판이 순위에 올랐다`, !!st, st ? `${st.rank}등 / ${st.total}명 · 이웃 ${st.around}줄` : '');
      await s.settle(400);
      await lay(s, `결과 카드 진 판 ${lang}`);
      await s.shot(`after-card-lost${en}${tag}`);
      await s.click('result:rank');
      await s.until(async () => !!(await s.region('rank:mine')));
      await lay(s, `순위 오늘 ${lang}`);
      await s.shot(`after-rank-today${en}${tag}`);
      if (lang === 'ko') {
        await s.click('rank:mine'); await s.settle(400);
        await lay(s, '순위 내 쪽');
        await s.shot(`after-rank-mine${tag}`);
        await s.click('rank:tab:yesterday'); await s.settle(500);
        await lay(s, '순위 어제');
        await s.shot(`after-rank-yesterday${tag}`);
      }
      await s.click('rank:back');
      // 처음 안내: 순위에 이름이 생긴 뒤 첫 화면에서 한 번(설정 칸을 가리킨다)
      await s.ev(() => { window.__app.records.coachSeen.rankName = false; });
      await s.click('result:title'); await s.settle(400);
      check(`${name} ${lang} 첫 화면 처음 안내`, (await s.ev(() => window.__app.hintShown && window.__app.hintShown.id)) === 'rankName');
      await s.shot(`after-title-hint${en}${tag}`);
      await s.click('title:settings');
      await lay(s, `설정 이름 줄 ${lang}`);
      if (lang === 'ko') {
        await s.shot(`after-settings-name${tag}`);
        await s.point('set:name');
        await s.snap(`after-settings-name-point${tag}`);
        const before = await s.ev(() => window.__app.rank.player().name);
        await s.click('set:name');
        const after = await s.until(() => s.ev((b) => { const n = window.__app.rank.player().name; return n !== b ? n : null; }, before));
        check(`${name} 다시 짓기`, !!after, `「${before}」 → 「${after}」`);
        await s.shot(`after-settings-rerolled${tag}`);
      }
      // 가장 넓은 이름: 서버의 내 이름을 바꾸고 새로 켠다(저장의 이름도 같이)
      const key = await s.ev((k) => JSON.parse(localStorage.getItem(k)).key, PLAYER_KEY);
      const long = lang === 'ko' ? LONG_KO : LONG_EN;
      Object.assign(world.store.players.find((p) => p.keyHash === hashKey(key)), long);
      await s.context.close();
      s = await open(browser, { lang, today: DAY_LOST, storage: { [PLAYER_KEY]: JSON.stringify({ key, ...long }) } });
      await s.click('title:settings');
      await lay(s, `설정 긴 이름 ${lang}`);
      await s.shot(`after-settings-long${en}${tag}`);
      if (lang === 'ko') {
        await s.click('set:back'); await s.click('title:rank');
        await s.until(async () => !!(await s.region('rank:mine')));
        await s.click('rank:mine'); await s.settle(400);
        await lay(s, '순위 긴 이름');
        await s.shot(`after-rank-long${tag}`);
      }
      await s.context.close();

      // 이긴 판(다른 날)
      await newWorld(DAY_WON);
      s = await open(browser, { lang, today: DAY_WON });
      await s.playDaily(botCmds(DAY_WON));
      st = await s.until(async () => { const q = await s.status(); return q.phase === 'ok' && q.me ? q : null; });
      check(`${name} ${lang} 이긴 판이 순위에 올랐다`, !!st, st ? `${st.rank}등 / ${st.total}명` : '');
      await s.settle(400);
      await lay(s, `결과 카드 이긴 판 ${lang}`);
      await s.shot(`after-card-won${en}${tag}`);
      await s.context.close();
    }
    // 확인 중: 서버가 답하지 않는 동안
    await newWorld(DAY_LOST);
    let s = await open(browser, { today: DAY_LOST });
    await s.settle(300);
    world.mode = 'hang';
    await s.playDaily(botCmds(DAY_LOST));
    await s.settle(500);
    check(`${name} 확인 중`, (await s.status()).phase === 'pending');
    await lay(s, '결과 카드 확인 중');
    await s.shot(`after-card-pending${tag}`);
    for (const r of hung.splice(0)) r.destroy();
    await s.context.close();
    // 새 배포: 판을 두는 사이 배포 식별자가 바뀌었다
    await newWorld(DAY_LOST);
    s = await open(browser, { today: DAY_LOST });
    await s.settle(300);
    world.setBuild('next-build');
    await s.playDaily(botCmds(DAY_LOST));
    check(`${name} 새 배포 → 내지 못함`, !!(await s.until(async () => (await s.status()).phase === 'stale')), `제출 ${world.named('/api/daily/submit').length}번 · 오른 성적 ${world.store.scores.filter((q) => q.date === DAY_LOST).length - 24}`);
    await s.settle(300);
    await lay(s, '결과 카드 새 배포');
    await s.shot(`after-card-stale${tag}`);
    await s.context.close();
    // 빈 순위표
    await newWorld(DAY_LOST, { others: 0, yesterday: 0 });
    s = await open(browser, { today: DAY_LOST });
    await s.click('title:rank');
    await s.until(async () => !!(await s.region('rank:play')));
    await lay(s, '빈 순위표');
    await s.shot(`after-rank-empty${tag}`);
    await s.context.close();
    // 닿지 못함
    await newWorld(DAY_LOST);
    world.mode = 'fail';
    s = await open(browser, { today: DAY_LOST });
    await s.click('title:rank');
    await s.settle(800);
    check(`${name} 닿지 못함: 알림 없음`, (await s.ev(() => window.__app.toasts.length)) === 0);
    await lay(s, '닿지 못함');
    await s.shot(`after-rank-unreached${tag}`);
    await s.playDaily(botCmds(DAY_LOST));
    await s.until(async () => (await s.status()).phase === 'unreached');
    await s.settle(300);
    await lay(s, '결과 카드 닿지 못함');
    await s.shot(`after-card-unreached${tag}`);
    await s.context.close();
    // 1배 화면 한 장
    if (name === 'chromium') {
      await newWorld(DAY_LOST);
      s = await open(browser, { today: DAY_LOST, scale: 1 });
      await s.playDaily(botCmds(DAY_LOST));
      await s.until(async () => (await s.status()).phase === 'ok');
      await s.click('result:rank');
      await s.until(async () => !!(await s.region('rank:mine')));
      await lay(s, '1배 순위');
      await s.shot('after-rank-today');
      await s.context.close();
    }
  } finally {
    await browser.close();
  }
}

// ── /api가 없는 로컬 서버(python3 -m http.server): 게임을 그대로 열어 오늘의 대국을 끝내고 순위 화면 · 설정을 열어도 /api로 0건, 알림 0
async function plain(browserType, name) {
  const free = await new Promise((ok) => { const t = http.createServer(); t.listen(0, () => { const p = t.address().port; t.close(() => ok(p)); }); });
  const py = spawn('python3', ['-m', 'http.server', String(free), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const base = `http://localhost:${free}`;
  const browser = await browserType.launch();
  try {
    for (let i = 0; i < 50; i++) { try { const r = await fetch(`${base}/index.html`); if (r.ok) break; } catch { /* 아직 */ } await new Promise((r) => setTimeout(r, 100)); }
    const s = await open(browser, { base, rank: false });
    const date = await s.ev(() => window.__app.today());
    const st = await s.playDaily(botCmds(date, 'random'));
    await s.settle(600);
    const toasts = [await s.ev(() => window.__app.toasts.length)];
    await s.shot(`after-local-result-${name}`);
    // 닿지 못하는 카드에는 「순위 보기」가 없다 — 첫 화면의 「순위」로 연다
    await s.click('result:title'); await s.click('title:rank'); await s.settle(600);
    toasts.push(await s.ev(() => window.__app.toasts.length));
    await s.shot(`after-local-rank-${name}`);
    await s.click('rank:tab:yesterday'); await s.settle(400);
    await s.click('rank:back'); await s.click('title:settings'); await s.settle(300);
    toasts.push(await s.ev(() => window.__app.toasts.length));
    const stored = await s.ev((k) => [localStorage.getItem(k), localStorage.getItem('chainmate.rankq.v1'), !!window.__app.ui.regions.find((r) => r.id === 'set:name')], PLAYER_KEY);
    check(`[${name}] python3 -m http.server(${free}): 오늘의 대국을 끝냈다`, st.screen === 'result', `${date} · ${st.phase} ${st.ante}관`);
    check(`[${name}] /api로 나간 요청 0건`, s.seen.api.length === 0, `${s.seen.api.length}건`);
    check(`[${name}] 알림(오류 팝업) 0`, toasts.every((n) => n === 0), toasts.join(' · '));
    check(`[${name}] 열쇠 · 대기열을 저장에 쓰지 않았다 · 설정에 이름 줄 없음`, stored[0] == null && stored[1] == null && !stored[2]);
    check(`[${name}] 다른 곳으로 나간 요청 없음`, s.seen.out.length === 0, s.seen.out.slice(0, 3).join(' '));
    await s.context.close();
  } finally {
    await browser.close();
    py.kill();
  }
}

const types = [['chromium', pw.chromium], ['webkit', pw.webkit]].filter(([n]) => !ONLY || ONLY === n);
try {
  if (LIVE) {
    try { for (const [n, t] of types) await live(t, n); }
    finally {
      // 시험 플레이어 지우기(성적 · 명령 줄도 같이 — cascade). 남은 수를 찍는다
      console.log(execFileSync('node', [path.join(ROOT, 'tools/daily-e2e.mjs'), '--cleanup'], { encoding: 'utf8' }).trim());
    }
  } else {
    for (const [n, t] of types) { await shots(t, n); await plain(t, n); }
  }
} catch (e) { note(`중단: ${e.stack || e}`); }
srv.close(); srv.closeAllConnections?.();
console.log(errors.length ? `어긋남 ${errors.length}: ${errors.join(' | ')}` : '어긋남 0');
process.exit(errors.length ? 1 : 0);
