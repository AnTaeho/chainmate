// CHM-73 하이라이트 카드: 브라우저(Playwright 웹킷 · 크로미움)로 찍고 확인한다.
//   node tools/shots-highlight.mjs [--out docs/shots/highlight] [--scale 3] [--only webkit|chromium]
//     끝난 판을 세워(test/helpers/hlrun.js) 결과 화면 → 「하이라이트」를 진짜 마우스로 열고, 연 모습과 「그림 저장」으로 받은 PNG 자체를 남긴다.
//     장면: 이긴 판 · 진 판(한국어 · 영어) · 기물 적은 판 · 많은 판, 그림만: 기물 14 · 15(2배 → 1배 두 줄의 문턱) · 아주 많은 판 · 끝없는 대국의 큰 수.
//     찍는 김에 글 넘침 · 받은 그림의 크기(1200 × 675) · Esc와 바깥 누르기 · 「공유」 단추가 뜨는 조건 · 다른 곳으로 나간 요청 0도 본다.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/highlight'));
const SC = Number(opt('--scale', 3));
const ONLY = opt('--only', null);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const base = `http://localhost:${srv.address().port}`;
const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const errors = [], files = [];
const note = (m) => { errors.push(m); console.log(`  ✗ ${m}`); };
const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) errors.push(name); };
// PNG 머리에서 크기를 읽는다
const pngSize = (buf) => (buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);

// [이름, 언어, 판, 결과 화면 위에 연 모습도 찍나]
const SCENES = [
  ['won', 'ko', {}, true],
  ['won', 'en', {}, true],
  ['lost', 'ko', { won: false, ante: 5, deck: 10, maxims: 4, josekis: 2, chain: 9, score: 48200 }, true],
  ['lost', 'en', { won: false, ante: 5, deck: 10, maxims: 4, josekis: 2, chain: 9, score: 48200 }, true],
  ['few', 'ko', { won: false, ante: 2, deck: 6, maxims: 0, josekis: 1, chain: 3, score: 640 }, true],
  ['many', 'ko', { deck: 24, maxims: 12, chain: 20, score: 812345600 }, true],
  ['deck14', 'ko', { deck: 14, maxims: 7 }, false],
  ['deck15', 'ko', { deck: 15, maxims: 8 }, false],
  ['most', 'ko', { deck: 60, maxims: 20, chain: 12 }, false],
  ['endless', 'en', { won: false, endless: true, ante: 31, deck: 18, maxims: 9, score: 9876543210987654 }, false],
];

async function shots(type, name) {
  const browser = await type.launch();
  try {
    for (const lang of ['ko', 'en']) {
      const context = await browser.newContext({ viewport: { width: 480 * SC, height: 270 * SC }, deviceScaleFactor: 1, acceptDownloads: true });
      const page = await context.newPage();
      const out = [];
      page.on('pageerror', (e) => note(`${name} 페이지 오류 ${e}`));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) note(`${name} 콘솔 오류 ${m.text()}`); });
      page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:')) out.push(r.url()); });
      await page.addInitScript((lang) => {
        window.__CHAINMATE_NO_BOOT__ = true;
        localStorage.clear();
        localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, telemetry: false }));
      }, lang);
      await page.goto(`${base}/index.html`);
      await page.evaluate(async () => { const m = await import('/src/main.js'); await m.boot({ rankBase: '' }); });
      await page.waitForFunction(() => window.__app && window.__app.screen && window.__app.stats.frames > 2);
      const ev = (fn, arg) => page.evaluate(fn, arg);
      const settle = (ms = 250) => page.waitForTimeout(ms);
      const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h, enabled: r.enabled }; }, id);
      const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
      const press = async (gx, gy) => { const [x, y] = await toXY(gx, gy); await page.mouse.move(x, y); await settle(80); await page.mouse.down(); await page.mouse.up(); await settle(); };
      const click = async (id) => { const r = await region(id); if (!r) throw new Error(`구역이 없다 ${id}`); await press(r.x + r.w / 2, r.y + r.h / 2); };
      const overlay = () => ev(() => (window.__app.overlay ? window.__app.overlay.name : null));
      const layout = () => ev(async () => { const LL = await import('/src/render/layoutlog.js'); LL.LOG.on = true; window.__app.draw(); const bad = LL.checkLayout().map((q) => q.msg); LL.LOG.on = false; return bad; });
      const snap = async (f) => { const [x, y] = await toXY(476, 266); await page.mouse.move(x, y); await settle(150); await page.screenshot({ path: path.join(OUT, f), clip: await page.locator('#screen').boundingBox() }); files.push(f); console.log('  찍음', f); };
      for (const [scene, sl, o, onResult] of SCENES) {
        if (sl !== lang) continue;
        const tag = `${name} ${lang} ${scene}`;
        await ev(async (o) => {
          const a = window.__app, { finishedRun } = await import('/test/helpers/hlrun.js');
          a.records.kingDone = true; a.records.coachSeen = { telemetry: true, bigText: true, rankName: true };
          a.overlay = null; a.toasts = []; a.run = finishedRun(o); a.go('result', { quiet: true });
        }, o);
        await settle(400);
        if (scene === 'won' && lang === 'ko') await snap(`result-button-${lang}-${name}@${SC}x.png`);
        await click('result:highlight');
        const ready = await page.waitForFunction(() => window.__app.overlay && window.__app.overlay.blob, null, { timeout: 5000 }).then(() => true, () => false);
        check(`${tag}: 열림 · 그림이 미리 만들어졌다`, (await overlay()) === 'highlight' && ready);
        const bad = await layout();
        check(`${tag}: 글 넘침 0`, bad.length === 0, bad.slice(0, 3).join(' | '));
        if (onResult) await snap(`open-${scene}-${lang}-${name}@${SC}x.png`);
        // 「그림 저장」: 진짜로 받은 파일이 내보낸 그림이다
        const save = await region('hl:save');
        const got = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
        await click('hl:save');
        const dl = await got, f = `card-${scene}-${lang}-${name}.png`;
        if (dl) { await dl.saveAs(path.join(OUT, f)); files.push(f); }
        const size = dl ? pngSize(fs.readFileSync(path.join(OUT, f))) : null;
        check(`${tag}: 받은 그림 1200 × 675 PNG`, !!save && save.enabled && !!size && size[0] === 1200 && size[1] === 675 && dl.suggestedFilename() === 'chainmate-highlight.png', size ? `${size.join(' × ')} · ${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)}KB` : '받지 못함');
        if (scene === 'won') {
          const share = !!(await region('hl:share')), can = await ev(() => typeof navigator.share === 'function' && typeof navigator.canShare === 'function');
          console.log(`  · ${tag}: 「공유」 단추 ${share ? '있음' : '없음'}(navigator.share ${can ? '있음' : '없음'})`);
          check(`${tag}: 「공유」는 공유할 수 있을 때만`, share === (can && (await ev(() => { try { return navigator.canShare({ files: [new File([window.__app.overlay.blob], 'a.png', { type: 'image/png' })] }); } catch { return false; } }))));
          // 카드 안 누르기는 그대로, Esc · 바깥 누르기 · 「닫기」로 닫힌다
          await press(240, 120);
          const stay = await overlay();
          await page.keyboard.press('Escape'); await settle();
          const esc = await overlay();
          await click('result:highlight'); await press(6, 262);
          const outside = await overlay();
          await click('result:highlight'); await click('hl:close');
          check(`${tag}: 카드 안 누르기는 그대로 · Esc · 바깥 누르기 · 닫기`, stay === 'highlight' && esc === null && outside === null && (await overlay()) === null && (await ev(() => window.__app.screen.name)) === 'result');
        } else await page.keyboard.press('Escape');
        await settle(100);
      }
      check(`${name} ${lang}: 다른 곳으로 나간 요청 0`, out.length === 0, out.slice(0, 3).join(' '));
      await context.close();
    }
  } finally { await browser.close(); }
}

const types = [['webkit', pw.webkit], ['chromium', pw.chromium]].filter(([n]) => !ONLY || ONLY === n);
try {
  for (const [n, t] of types) await shots(t, n);
} catch (e) { note(`중단: ${e.stack || e}`); }
srv.close(); srv.closeAllConnections?.();
console.log(`그림 ${files.length}장: ${files.join(' ')}`);
console.log('서버 · 브라우저 닫음');
console.log(errors.length ? `어긋남 ${errors.length}: ${errors.join(' | ')}` : '어긋남 0');
process.exit(errors.length ? 1 : 0);
