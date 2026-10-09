// CHM-72 계정: 브라우저(Playwright 크로미움 · 웹킷)로 찍고 확인한다. 글자는 진짜 입력 칸(<input>)에 키보드로 친다.
//   node tools/shots-account.mjs [--out docs/shots/account] [--scale 3] [--only chromium|webkit]
//     가짜 서버(진짜 요청 → 응답 로직 api/_lib/service.js + 기억 저장소 — test/helpers/fakeapi.js)를 로컬에 띄우고 기기 둘(브라우저 컨텍스트 둘 — 저장이 따로)로
//     계정 없음 · 입력 중 · 만들었다 · 들어와 있음 · 맞지 않음 · 잠김 · 비번 바꾸기 · 나가기 확인 · 지우기 확인 둘 · 영어 넷 · 폰 가로 · 폰 세로(돌려 그린 화면 — 칸의 자리와 초점이 간 뒤) · privacy.html을 찍는다.
//     찍는 김에 입력 칸의 자리(캔버스가 그린 칸과 겹치나) · 초점 동안 키 막기 · 한글 자판 · 남은 입력 칸 0도 본다.
//   node tools/shots-account.mjs --live http://localhost:3210
//     진짜 서버(vercel dev — 로컬 코드 + 실제 DB)로: 기기 A(크로미움)가 가입 → 기기 B(웹킷)가 들어오기 → 같은 이름 · 기록 → B 나가기 → A에서 계정 지우기.
//     만든 플레이어는 test 표시를 하고 끝나면 지운다. 열쇠 · 비번은 찍지 않는다.
// 순위 · 저장 · 계정은 배포 주소 · 앱에서만 부른다 — 이 도구는 boot({ rankBase })로 주소 머리를 넣어 켠다. Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashKey, LIMITS } from '../api/_lib/service.js';
import { usernameId } from '../api/_lib/auth.js';
import { fakeApi } from '../test/helpers/fakeapi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/account'));
const SC = Number(opt('--scale', 3));
const LIVE = (opt('--live', '') || '').replace(/\/$/, '');
const ONLY = opt('--only', null);
const PLAYER_KEY = 'chainmate.player.v1';
const DAY = '2026-10-08';
const USER = 'taeho_an', PW = 'moonlit-rook-42', PW2 = 'second-knight-77';

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

// 기기 하나(브라우저 컨텍스트 — 저장이 따로다). view: { w, h, dpr, touch } 창(없으면 480 × 270의 scale배)
async function open(browser, { lang = 'ko', base = `http://localhost:${port}`, today = null, scale = SC, records = null, view = null } = {}) {
  const chromium = browser.browserType().name() === 'chromium';
  const context = await browser.newContext(view
    ? { viewport: { width: view.w, height: view.h }, deviceScaleFactor: view.dpr, hasTouch: !!view.touch, ...(view.touch && chromium ? { isMobile: true } : {}) }
    : { viewport: { width: 480 * scale, height: 270 * scale }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const seen = { api: [], out: [], urls: [] };
  page.on('pageerror', (e) => note(`페이지 오류 ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) note(`콘솔 오류 ${m.text()}`); });
  page.on('request', (r) => { const u = r.url(); if (new URL(u).pathname.startsWith('/api/')) { seen.api.push(`${r.method()} ${new URL(u).pathname}`); seen.urls.push(u); } else if (!u.startsWith(base)) seen.out.push(u); });
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
    await page.evaluate((records) => { const a = window.__app; a.records.kingDone = true; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true }; if (records) Object.assign(a.records, records); a.saveRecords(); }, records);
    await page.waitForFunction(() => window.__app.ui.regions.length > 0 && window.__app.stats.frames > 2);
  };
  await page.goto(`${base}/index.html`);
  await boot();
  const settle = (ms = 250) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id);
  // 게임 좌표 → 창 좌표(돌려 그린 화면이면 돌린 축으로 — src/ui/fit.js toClient)
  const toXY = (gx, gy) => ev(async ([gx, gy]) => { const F = await import('/src/ui/fit.js'); return F.toClient(gx + 0.5, gy + 0.5, document.getElementById('screen').getBoundingClientRect(), !!(window.__fit && window.__fit.rot)); }, [gx, gy]);
  const point = async (id) => { const r = await region(id); if (!r) throw new Error(`구역이 없다 ${id} (화면 ${await ev(() => (window.__app.overlay || window.__app.screen).name)})`); const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 9)); if (view && view.touch) return [x, y]; await page.mouse.move(x, y); await settle(80); return [x, y]; };
  const click = async (id) => { const [x, y] = await point(id); if (view && view.touch) await page.touchscreen.tap(x, y); else { await page.mouse.down(); await page.mouse.up(); } await settle(); };
  const away = async () => { if (view && view.touch) return; const [x, y] = await toXY(476, 30); await page.mouse.move(x, y); await settle(120); };
  // 캔버스만(여백 없이) — 입력 칸은 캔버스 위에 겹쳐 있어 창을 그 사각형으로 잘라 찍는다
  const snap = async (name, { full = false } = {}) => { const f = `${name}@${view ? `${view.dpr}x` : `${scale}x`}.png`; await page.screenshot({ path: path.join(OUT, f), ...(full ? {} : { clip: await page.locator('#screen').boundingBox() }) }); console.log('  찍음', f); };
  const shot = async (name, o) => { await away(); await snap(name, o); };
  const layout = () => ev(async () => { const LL = await import('/src/render/layoutlog.js'); LL.LOG.on = true; window.__app.draw(); const bad = LL.checkLayout().map((q) => q.msg); LL.LOG.on = false; return bad; });
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await settle(150); } };
  const toAccount = async () => { await click('title:settings'); await click('set:link'); await until(() => ev(() => window.__app.screen.name === 'account')); await settle(200); };
  const scr = () => ev(() => { const s = window.__app.screen; return { name: s.name, in: s.in ? s.in() : null, mode: s.mode, msg: s.msg && s.msg.text, tone: s.msg && s.msg.tone, gain: s.msg && s.msg.gain, acct: s.acct, busy: s.busy }; });
  // 진짜 입력 칸을 눌러 초점을 주고 키보드로 친다(앞의 글은 지운다)
  const input = (id) => page.locator(`#tf-${id}`);
  const focus = async (id) => { if (view && view.touch) await input(id).tap(); else await input(id).click(); await settle(120); };
  const type = async (id, text) => { await focus(id); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type(text, { delay: 12 }); await settle(80); };
  const inputs = () => ev(() => document.querySelectorAll('input').length);
  const done = async () => until(async () => { const q = await scr(); return q.busy ? null : q; });
  // 입력 칸이 캔버스가 그린 칸 자리에 놓였나: 칸의 네 구석(게임 좌표)을 창 좌표로 옮긴 것과 <input>의 사각형을 견준다(돌려 그린 화면이면 돌린 사각형)
  const aligned = (id) => ev(async (id) => {
    const F = await import('/src/ui/fit.js'), K = await import('/src/ui/screens/account.js');
    const f = K.accountLayout().fields[id], rect = document.getElementById('screen').getBoundingClientRect(), rot = !!(window.__fit && window.__fit.rot);
    const p = [F.toClient(f.x, f.y, rect, rot), F.toClient(f.x + f.w, f.y + f.h, rect, rot)];
    const want = { left: Math.min(p[0][0], p[1][0]), top: Math.min(p[0][1], p[1][1]), right: Math.max(p[0][0], p[1][0]), bottom: Math.max(p[0][1], p[1][1]) };
    const el = document.getElementById(`tf-${id}`);
    if (!el) return { ok: false, why: '칸 없음' };
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const off = Math.max(Math.abs(b.left - want.left), Math.abs(b.top - want.top), Math.abs(b.right - want.right), Math.abs(b.bottom - want.bottom));
    return { ok: off <= 1, off: Math.round(off * 100) / 100, rot, font: cs.fontFamily.split(',')[0].replace(/"/g, ''), size: parseFloat(cs.fontSize), css: window.__fit.css, box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], label: !!document.querySelector(`label[for="tf-${id}"]`) };
  }, id);
  const reboot = async () => { await page.reload(); await boot(); };
  return { page, context, seen, settle, ev, region, point, click, shot, snap, away, layout, until, toAccount, scr, input, focus, type, inputs, done, aligned, reboot, key: (k) => page.keyboard.press(k) };
}

const RECORDS_A = { runs: 14, wins: 2, bestAnte: 6, codex: { maxims: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i}`, true])), masters: {}, factions: { peasants: true }, legends: {}, legendsDone: {}, openings: { standard: true }, editions: {}, souls: {}, awake: {} } };
const RECORDS_B = { runs: 3, bestAnte: 2 };

// ── 가짜 서버로 화면 상태를 모두 찍는다
async function shots(browserType, name) {
  const tag = `-${name}`;
  const browser = await browserType.launch();
  console.log(`[${name}] 가짜 서버 http://localhost:${port}`);
  const lay = async (s, what) => { const bad = await s.layout(); if (bad.length) note(`${name} ${what} 글 넘침: ${bad.slice(0, 3).join(' | ')}`); };
  try {
    for (const lang of ['ko', 'en']) {
      const en = lang === 'en' ? '-en' : '', ko = lang === 'ko';
      newWorld();
      const a = await open(browser, { lang, today: DAY, records: RECORDS_A });
      const b = await open(browser, { lang, today: DAY, records: RECORDS_B });
      // 계정 없음
      await a.toAccount();
      await lay(a, `없음 ${lang}`);
      const at = [await a.aligned('user'), await a.aligned('pass')];
      check(`${name} ${lang} 입력 칸이 그린 칸 위에 놓였다(어긋남 1px 안) · Galmuri11 · 이름표 연결`, at.every((q) => q.ok && q.font === 'Galmuri11' && q.label && Math.abs(q.size - 12 * q.css) < 0.01), at.map((q) => `${q.off}px ${q.box.join(',')} ${q.font} ${q.size}px`).join(' | '));
      await a.shot(`none${en}${tag}`);
      if (ko) {
        // 초점 동안 게임은 키를 받지 않는다: 빈칸 · Enter · 숫자에 화면이 그대로, Esc는 초점만 푼다
        await a.focus('user');
        for (const k of ['Space', 'Digit1', 'ArrowLeft']) await a.key(k);
        check(`${name} 초점 동안 키: 화면 그대로 · 친 글자는 칸에(빈칸은 걸러진다)`, (await a.scr()).name === 'account' && (await a.input('user').inputValue()) === '1', await a.input('user').inputValue());
        await a.key('Escape');
        check(`${name} Esc는 초점만 푼다`, (await a.scr()).name === 'account' && (await a.ev(() => document.activeElement === document.body || document.activeElement === null)));
        // 한글 자판으로 친 아이디: 걸러지고 한 줄
        await a.focus('user');
        await a.key('Meta+A'); await a.key('Backspace');
        await a.page.keyboard.insertText('ㅅㅁ도ㅐ');
        await a.settle(200);
        check(`${name} 한글 자판으로 친 아이디: 칸이 비고 「아이디는 영문으로 친다」`, (await a.input('user').inputValue()) === '' && (await a.scr()).msg === '아이디는 영문으로 입력하세요', `칸 「${await a.input('user').inputValue()}」 · ${(await a.scr()).msg}`);
        await lay(a, '한글 자판');
        await a.shot(`hangul${tag}`);
        // 입력 중: 아이디를 치고 비번 칸에 초점(가려진 글자)
        await a.type('user', 'Taeho_An');
        check(`${name} 대문자는 소문자로`, (await a.input('user').inputValue()) === USER);
        await a.type('pass', PW);
        await a.snap(`typing${tag}`);
        // 붙여넣기
        await a.focus('pass'); await a.key('Meta+A'); await a.key('Backspace');
        await a.ev((pw) => { const el = document.getElementById('tf-pass'); el.focus(); document.execCommand('insertText', false, pw); }, PW);
        check(`${name} 붙여넣기(insertText)가 된다`, (await a.input('pass').inputValue()) === PW);
        // Enter는 비번 칸에서 들어오기 — 없는 아이디라 「맞지 않는다」
        await a.key('Enter');
        const q0 = await a.done();
        check(`${name} 비번 칸의 Enter = 들어오기(없는 아이디 → 맞지 않는다)`, q0.msg === '아이디나 비번이 맞지 않는다' && q0.name === 'account', q0.msg);
        await lay(a, '맞지 않음');
        await a.shot(`bad${tag}`);
      }
      // 만들기
      await a.type('user', USER); await a.type('pass', PW);
      await a.click('acct:signup');
      const made = await a.done();
      check(`${name} ${lang} 만들었다 · 입력 칸 0`, made.in === true && made.acct.username === USER && (await a.inputs()) === 0, `${made.msg}`);
      await lay(a, `만들었다 ${lang}`);
      if (ko) await a.shot(`made${tag}`);
      await a.ev(() => window.__app.cloud.push());
      await a.settle(300);
      // B: 들어오기 → 들어와 있음(합쳐진 것 한 줄)
      await b.toAccount();
      await b.type('user', USER); await b.type('pass', PW);
      await b.click('acct:login');
      const got = await b.until(async () => { const q = await b.scr(); return q.in && q.gain ? q : q.tone === 'red' ? q : null; });
      const nameA = await a.ev(() => window.__app.rank.player().name);
      check(`${name} ${lang} 들어왔다 — 같은 이름 · 합쳐진 것 한 줄 · 기기 2대`, !!got && got.in && got.gain.codex === 13 && got.acct.devices === 2 && (await b.ev(() => window.__app.rank.player().name)) === nameA, got ? `${got.msg} · 도감 +${got.gain && got.gain.codex} · 「${nameA}」` : '답 없음');
      await lay(b, `들어와 있음 ${lang}`);
      await b.shot(`in${en}${tag}`);
      // 비번 바꾸기 화면 · 나가기 확인 · 지우기 확인 둘
      await b.click('acct:password');
      const pa = [await b.aligned('cur'), await b.aligned('next')];
      check(`${name} ${lang} 비번 바꾸기 칸 둘이 그린 칸 위에`, pa.every((q) => q.ok), pa.map((q) => `${q.off}px`).join(' · '));
      await lay(b, `비번 바꾸기 ${lang}`);
      if (ko) { await b.type('cur', PW); await b.type('next', PW2); await b.snap(`password${tag}`); await b.click('acct:forgot'); await lay(b, '지금 비번 없이'); await b.shot(`password-forgot${tag}`); }
      await b.click('acct:logout');
      await lay(b, `나가기 확인 ${lang}`);
      if (ko) await b.shot(`logout-confirm${tag}`);
      await b.click('acct:delete');
      await lay(b, `지우기 확인 1 ${lang}`);
      if (ko) await b.shot(`delete-confirm1${tag}`);
      await b.click('acct:yes');
      await b.type('del', 'wrong-password');
      await b.click('acct:yes');
      const wrong = await b.done();
      check(`${name} ${lang} 지우기: 틀린 비번이면 지워지지 않는다`, wrong.mode === 'delete2' && wrong.in === true && world.store.accounts.size === 1, wrong.msg);
      await lay(b, `지우기 확인 2 ${lang}`);
      await b.shot(`delete-confirm2${en}${tag}`);
      // 칸에 초점을 주고 Esc 두 번: 처음은 초점만 풀고(확인은 그대로), 다음은 확인을 닫는다(화면은 그대로)
      await b.focus('del'); await b.key('Escape');
      const e1 = await b.scr(), n1 = await b.inputs();
      await b.key('Escape'); await b.settle(200);
      const e2 = await b.scr();
      check(`${name} ${lang} Esc 두 번: 초점 풀기 → 확인 닫기 · 입력 칸 0`, e1.mode === 'delete2' && n1 === 1 && e2.mode == null && e2.name === 'account' && (await b.inputs()) === 0);
      // 잠김 · 닿지 못함: 다른 기기 C
      const c = await open(browser, { lang, today: DAY });
      await c.toAccount();
      for (let i = 0; i < LIMITS.loginFails; i++) { await c.type('user', USER); await c.type('pass', `wrong-pass-${i}`); await c.click('acct:login'); await c.done(); }
      await c.type('pass', PW); await c.click('acct:login');
      const locked = await c.done();
      check(`${name} ${lang} 다섯 번 틀리면 잠긴다(맞는 비번도) — 몇 분 뒤`, /15/.test(locked.msg || '') && locked.in === false && locked.tone === 'red', locked.msg);
      await lay(c, `잠김 ${lang}`);
      await c.shot(`locked${en}${tag}`);
      if (ko) {
        world.mode = 'fail';
        await c.type('pass', PW); await c.click('acct:login');
        const un = await c.done();
        check(`${name} 닿지 못함: 한 줄 · 알림 없음`, un.msg === '연결하지 못했어요' && (await c.ev(() => window.__app.toasts.length)) === 0, un.msg);
        await lay(c, '닿지 못함');
        await c.shot(`unreached${tag}`);
        world.mode = 'ok';
        // 이미 있는 아이디
        world.store.limits.clear();
        await c.type('user', USER); await c.type('pass', PW2); await c.click('acct:signup');
        const tk = await c.done();
        check(`${name} 이미 있는 아이디`, tk.msg === '이미 쓰고 있는 아이디예요', tk.msg);
        await lay(c, '이미 있는 아이디');
        await c.shot(`taken${tag}`);
        // 화면을 떠나면 입력 칸이 남지 않는다: 탭 · 돌아가기
        await c.click('acct:tab:link');
        const n1 = await c.inputs();
        await c.click('acct:tab:account'); const n2 = await c.inputs();
        await c.click('acct:back'); const n3 = await c.inputs();
        check(`${name} 화면을 떠나면 남은 입력 칸 0(탭 ${n1} · 돌아옴 ${n2} · 첫 화면 ${n3})`, n1 === 0 && n2 === 2 && n3 === 0 && (await c.ev(() => document.querySelectorAll('form').length)) === 0);
        // B: 나가기 → 기기의 기록이 빈다
        await b.click('acct:logout'); await b.click('acct:yes');
        const out = await b.done();
        const rec = await b.ev(() => ({ runs: window.__app.records.runs, run: localStorage.getItem('chainmate.run.v1'), name: window.__app.rank.player().name }));
        check(`${name} 나가기: 기기의 기록이 비고 새 이름 · 계정에는 남는다`, out.in === false && out.msg === '나갔다' && rec.runs === 0 && rec.run === null && rec.name !== nameA && world.store.accounts.size === 1, `판 ${rec.runs} · 「${rec.name}」`);
        await lay(b, '나갔다');
        await b.shot(`out${tag}`);
        // A: 지우기
        await a.click('acct:delete'); await a.click('acct:yes');
        await a.type('del', PW); await a.key('Enter');
        const del = await a.done();
        check(`${name} 지우기(Enter로 낸다): 계정이 사라진다`, del.in === false && del.msg === '계정을 지웠다' && world.store.accounts.size === 0, del.msg);
        await a.shot(`deleted${tag}`);
        // 비번 · 열쇠가 저장 · 주소에 없다
        const stores = (await a.ev(() => JSON.stringify(Object.entries(localStorage)))) + (await b.ev(() => JSON.stringify(Object.entries(localStorage)))) + (await c.ev(() => JSON.stringify(Object.entries(localStorage))));
        check(`${name} 비번 · 아이디가 기기의 저장에 없다`, ![PW, PW2, USER, 'wrong-pass'].some((s) => stores.includes(s)));
        check(`${name} 열쇠 · 비번이 요청 주소에 없다`, [...a.seen.urls, ...b.seen.urls, ...c.seen.urls].every((u) => !/[0-9a-f]{64}/.test(u) && !u.includes(PW) && !u.includes('key=')), `요청 ${a.seen.urls.length + b.seen.urls.length + c.seen.urls.length}건`);
      }
      await a.context.close(); await b.context.close(); await c.context.close();
    }
    // 폰 가로(844 × 390 @3) · 폰 세로(390 × 844 @3 — 돌려 그린 화면): 칸의 자리와 초점이 간 뒤
    for (const [vname, view] of [['phone-landscape', { w: 844, h: 390, dpr: 3, touch: true }], ['phone-portrait', { w: 390, h: 844, dpr: 3, touch: true }]]) {
      newWorld();
      const s = await open(browser, { today: DAY, view });
      await s.toAccount();
      const rot = await s.ev(() => !!window.__fit.rot);
      const at = [await s.aligned('user'), await s.aligned('pass')];
      check(`${name} ${vname}(${rot ? '돌려 그린 화면' : '그대로'}): 입력 칸이 그린 칸 위에`, at.every((q) => q.ok) && rot === (vname === 'phone-portrait'), at.map((q) => `${q.off}px ${q.box.join(',')}`).join(' | '));
      await lay(s, vname);
      await s.snap(`${vname}${tag}`, { full: true });
      // 초점: 가로는 그 자리, 세로(돌려 그린 화면)는 위쪽에 바로 선 칸 둘
      await s.focus('user');
      await s.page.keyboard.type(USER, { delay: 10 });
      const f = await s.ev(() => { const el = document.getElementById('tf-user'), b = el.getBoundingClientRect(), p = document.getElementById('tf-pass').getBoundingClientRect(); return { v: el.value, top: Math.round(b.top), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), ptop: Math.round(p.top), lift: document.querySelector('form.tf').classList.contains('lift'), tr: el.style.transform, vw: innerWidth, vh: innerHeight }; });
      if (rot) check(`${name} ${vname} 초점: 칸이 화면 위쪽에 바로 선다(키보드 위) · 친 글자가 들어간다`, f.lift && f.tr === '' && f.v === USER && f.top < f.vh * 0.2 && f.ptop + f.h < f.vh * 0.4 && f.w >= f.vw - 40 && f.h >= 36, JSON.stringify(f));
      else check(`${name} ${vname} 초점: 칸은 화면 위쪽 절반 안 · 친 글자가 들어간다`, !f.lift && f.v === USER && f.top + f.h < f.vh * 0.5, JSON.stringify(f));
      await s.snap(`${vname}-focus${tag}`, { full: true });
      await s.key('Escape');
      await s.settle(200);
      const back = await s.aligned('user');
      check(`${name} ${vname} 초점이 풀리면 제자리`, back.ok && (await s.ev(() => !document.querySelector('form.tf').classList.contains('lift'))), `${back.off}px`);
      await s.context.close();
    }
    // 개인정보 처리방침 쪽
    {
      const context = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const res = await page.goto(`http://localhost:${port}/privacy.html`);
      const info = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent), todo: document.querySelectorAll('.todo').length, ext: [...document.querySelectorAll('script, link[rel=stylesheet], img')].length }));
      check(`${name} privacy.html: 열린다 · 한국어 + 영어 · 바깥 자원 0 · TODO(사람) ${info.todo}곳`, res.status() === 200 && info.h1.length === 2 && info.ext === 0 && info.todo > 0, info.h1.join(' / '));
      await page.screenshot({ path: path.join(OUT, `privacy${tag}@2x.png`), fullPage: true });
      console.log('  찍음', `privacy${tag}@2x.png`);
      await context.close();
    }
  } finally { await browser.close(); }
}

// ── 진짜 서버(vercel dev)로: 크로미움 기기 A ↔ 웹킷 기기 B. 아이디 · 비번은 그때그때 지어 쓴다
async function live() {
  const { direct, cleanupTests, cleanupLine } = await import('./db-migrate.mjs');
  const sql = direct();
  const rnd = () => [...crypto.getRandomValues(new Uint8Array(5))].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 9);
  const U = `e2e_${rnd()}`, P = `Aa-${rnd()}-${rnd()}`;
  const keyOf = (s) => s.until(() => s.ev((k) => { try { return JSON.parse(localStorage.getItem(k)).key; } catch { return null; } }, PLAYER_KEY));
  const mark = async (s) => {
    const key = await keyOf(s);
    const hit = key ? await sql.query('update players set test = true where id = (select player_id from player_keys where key_hash = $1) returning id::text as id', [hashKey(key)]) : [];
    return hit.length === 1 ? hit[0].id : null;
  };
  // 전체 한도 줄(who 0 — 틀린 들어오기 · 가입을 센 것): 손대기 전 값을 적어 두었다가 되돌린다
  const ALL = "kind in ('loginall', 'signupall') and who = 0";
  const before = new Map((await sql.query(`select kind, bucket, n from link_limits where ${ALL}`)).map((r) => [`${r.kind}|${r.bucket}`, r.n]));
  const wipe = async () => {
    for (const r of await sql.query(`select kind, bucket from link_limits where ${ALL}`)) {
      const n = before.get(`${r.kind}|${r.bucket}`);
      if (n == null) await sql.query('delete from link_limits where kind = $1 and who = 0 and bucket = $2', [r.kind, r.bucket]);
      else await sql.query('update link_limits set n = $3 where kind = $1 and who = 0 and bucket = $2', [r.kind, r.bucket, n]);
    }
    await sql.query("delete from link_limits where kind in ('login', 'loginlock') and who = $1::bigint", [usernameId(U)]);
    const r = await cleanupTests(sql);
    const stray = (await sql.query("select count(*)::int as n from accounts where username like 'e2e\\_%'"))[0].n;
    console.log(`${cleanupLine(r)} · e2e 계정 ${stray}`);
    if (Object.values(r.left).some(Boolean) || stray) note('시험 자료가 남았다');
  };
  const ca = await pw.chromium.launch(), wb = await pw.webkit.launch();
  console.log(`진짜 서버 ${LIVE} — 크로미움(A) · 웹킷(B)`);
  try {
    await wipe();
    const a = await open(ca, { base: LIVE, records: RECORDS_A }), b = await open(wb, { base: LIVE, records: RECORDS_B });
    // 플레이어를 먼저 만들어 표시해 둔다(끊겨도 지울 수 있게)
    await a.ev(() => window.__app.rank.ensurePlayer()); await b.ev(() => window.__app.rank.ensurePlayer());
    const aid = await mark(a), bid = await mark(b);
    check('A · B의 플레이어에 test 표시', !!aid && !!bid && aid !== bid);
    // A(크로미움): 진짜 입력 칸에 타이핑 → [계정 만들기]
    await a.toAccount();
    await a.type('user', U.toUpperCase()); await a.type('pass', P);
    await a.click('acct:signup');
    const made = await a.until(async () => { const q = await a.scr(); return !q.busy && (q.in || q.tone === 'red') ? q : null; }, 40000);
    check('A(크로미움): 타이핑으로 계정을 만들었다(아이디는 소문자로) · 입력 칸 0', !!made && made.in && made.acct.username === U && (await a.inputs()) === 0, made ? made.msg : '답 없음');
    const row = await sql.query('select player_id::text as id, pw_hash from accounts where username = $1', [U]);
    check('DB: 계정이 A의 플레이어에 붙었다 · 비번은 scrypt 해시', row.length === 1 && row[0].id === aid && /^scrypt\$32768\$8\$1\$/.test(row[0].pw_hash) && !row[0].pw_hash.includes(P));
    await a.ev(() => window.__app.cloud.push());
    await a.shot('live-made-chromium');
    const nameA = await a.ev(() => window.__app.rank.player().name);
    // B(웹킷): 틀린 비번 → 한 줄, 맞는 비번을 치고 Enter → 들어왔다
    await b.toAccount();
    await b.type('user', U); await b.type('pass', `${P}x`);
    await b.click('acct:login');
    const bad = await b.until(async () => { const q = await b.scr(); return !q.busy && q.msg ? q : null; }, 40000);
    check('B(웹킷): 틀린 비번 → 「아이디나 비번이 맞지 않는다」', !!bad && bad.msg === '아이디나 비번이 맞지 않는다' && !bad.in, bad && bad.msg);
    await b.type('pass', P);
    await b.key('Enter');
    const got = await b.until(async () => { const q = await b.scr(); return q.in && q.gain ? q : null; }, 60000);
    check('B(웹킷): 타이핑 + Enter로 들어왔다 — 같은 이름 · 합쳐진 것 한 줄 · 기기 2대', !!got && got.gain.codex === 13 && got.acct.devices === 2 && (await b.ev(() => window.__app.rank.player().name)) === nameA, got ? `${got.msg} · 도감 +${got.gain.codex}` : '답 없음');
    const recB = await b.ev(() => ({ runs: window.__app.records.runs, bestAnte: window.__app.records.bestAnte }));
    check('B: 기록이 A의 것과 합쳐졌다', recB.runs === 14 && recB.bestAnte === 6, JSON.stringify(recB));
    check('B 화면 글 넘침 없음', (await b.layout()).length === 0);
    await b.shot('live-in-webkit');
    const keys = await sql.query('select count(*)::int as n from player_keys where player_id = $1::bigint', [aid]);
    const goneB = await sql.query('select count(*)::int as n from players where id = $1::bigint', [bid]);
    check('DB: 열쇠 둘이 계정의 플레이어 · B의 옛 플레이어는 없다', keys[0].n === 2 && goneB[0].n === 0, `열쇠 ${keys[0].n} · 옛 플레이어 ${goneB[0].n}`);
    // B: 나가기 → 확인 → 기기의 기록이 빈다
    await b.click('acct:logout'); await b.click('acct:yes');
    const out = await b.until(async () => { const q = await b.scr(); return !q.busy && q.msg ? q : null; }, 60000);
    const nb = await mark(b);
    const recOut = await b.ev(() => ({ runs: window.__app.records.runs, name: window.__app.rank.player().name }));
    check('B: 나갔다 — 기기의 기록이 비고 새 이름(새 플레이어)', !!out && out.in === false && out.msg === '나갔다' && recOut.runs === 0 && recOut.name !== nameA && !!nb && nb !== aid, `${out && out.msg} · 판 ${recOut.runs}`);
    const save = await sql.query('select blob from saves where player_id = $1::bigint', [aid]);
    check('DB: 계정의 저장 · 열쇠 하나는 그대로', save.length === 1 && JSON.parse(save[0].blob).records.runs === 14 && (await sql.query('select count(*)::int as n from player_keys where player_id = $1::bigint', [aid]))[0].n === 1);
    await b.shot('live-out-webkit');
    // A: 계정 지우기 — 확인 둘 + 비번(타이핑)
    await a.click('acct:delete'); await a.click('acct:yes');
    await a.type('del', P);
    await a.click('acct:yes');
    const del = await a.until(async () => { const q = await a.scr(); return !q.busy && q.msg ? q : null; }, 60000);
    const na = await mark(a);
    check('A: 계정을 지웠다 — 이 기기는 새 빈 플레이어', !!del && del.in === false && del.msg === '계정을 지웠다' && !!na && na !== aid, del && del.msg);
    const left = await sql.query(`select (select count(*)::int from accounts where username = $2) as accounts, (select count(*)::int from players where id = $1::bigint) as players,
      (select count(*)::int from player_keys where player_id = $1::bigint) as keys, (select count(*)::int from saves where player_id = $1::bigint) as saves`, [aid, U]);
    check('DB: 계정 · 플레이어 · 열쇠 · 저장이 모두 0', Object.values(left[0]).every((n) => n === 0), JSON.stringify(left[0]));
    await a.shot('live-deleted-chromium');
    await a.click('acct:back'); await b.click('acct:back');
    check('남은 입력 칸 0', (await a.inputs()) + (await b.inputs()) === 0);
    check('/api 요청이 나갔다 · 다른 곳으로 나간 요청 없음 · 열쇠 · 비번이 주소에 없다', a.seen.api.length > 0 && b.seen.api.length > 0 && a.seen.out.length + b.seen.out.length === 0 && [...a.seen.urls, ...b.seen.urls].every((u) => !/[0-9a-f]{64}/.test(u) && !u.includes(P)), `A ${[...new Set(a.seen.api)].join(' · ')} | B ${[...new Set(b.seen.api)].join(' · ')}`);
  } finally {
    await ca.close(); await wb.close();
    await wipe();
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
