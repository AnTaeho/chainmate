// 「처음 켠 사람의 첫 몇 분」 영상(CHM-25): 빈 저장소로 켜서 타이틀 → 「새 판」 → 킹과 두는 대본 대국 → 보상 → 첫 상점 → 레퍼토리 →
// 1관 정식 관 선택, 처음 안내를 읽으며 3분 안쪽까지(960×540). Playwright recordVideo로 벽시계대로 녹화한다.
//   node tools/video.mjs --first [--out docs/media] [--ffmpeg 경로]   (tools/video.mjs가 이 파일로 넘긴다)
// 결과 <out>/first-play.mp4 · <out>/first-play.md
// Playwright는 저장소 의존성에 넣지 않는다(전역 설치나 NPM_CONFIG_PREFIX). ffmpeg는 PATH · --ffmpeg · FFMPEG 순으로 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const RAW = path.join(OUT, 'raw');
const FIRST = true;
const W = 960, H = 540;

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  const g = execSync('npm root -g').toString().trim();
  return import(path.join(g, 'playwright', 'index.mjs'));
}
function findFfmpeg() {
  for (const c of [opt('--ffmpeg', null), process.env.FFMPEG, 'ffmpeg']) {
    if (!c) continue;
    try { if (execFileSync(c, ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().includes('libx264')) return c; } catch { /* 없음 */ }
  }
  return null;
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

fs.mkdirSync(RAW, { recursive: true });
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
// 먼저 빈 저장소로 한 번 연다(녹화 밖): 처음 켠 사람의 타이틀
const prep = await browser.newPage();
await prep.goto(`http://localhost:${port}/index.html`);
await prep.evaluate(() => localStorage.clear());
await prep.close();

const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: RAW, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const chapters = [];
const mark = (s) => { const t = (Date.now() - t0) / 1000; chapters.push([t, s]); console.log(t.toFixed(1) + 's', s); };
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'lesson') && s.busy); }, null, { timeout: 30000 });
const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + (gx * b.width) / 480, b.y + (gy * b.height) / 270]; }
async function hover(id, ms = 300) { const r = await region(id); if (!r) return false; const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y, { steps: 14 }); await wait(ms); return true; }
async function click(id, ms = 250) { if (!(await hover(id, ms))) throw new Error('no region ' + id); await page.mouse.down(); await page.mouse.up(); await wait(80); }
async function park() { const [x, y] = await toXY(470, 262); await page.mouse.move(x, y, { steps: 8 }); }

// 처음 켠 사람의 첫 몇 분(CHM-25, 새 흐름): 타이틀 → 「새 판」 → 킹과 두는 대본 대국 → 보상 → 첫 상점(처음 안내) →
// 레퍼토리 고르기 → 1관 정식 관 선택(농민군 안내) → 정식 · 마스터전을 이어 둔다. 사람 손 빠르기로(글을 읽는 틈을 두고), 3분 안.
async function firstTen() {
  const LIMIT = 2.9 * 60 * 1000;
  const late = () => Date.now() - t0 > LIMIT;
  const scr = () => ev(() => window.__app.screen.name);
  const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 60000 });
  mark('처음 켬 — 타이틀');
  await park();
  await wait(2600);
  await click('title:new', 700);
  mark('새 판 — 킹과 두는 첫 대국(대본)');
  for (let guard = 0; guard < 80; guard++) {
    await ready();
    const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const st = g.steps[g.i], s = a.screen; return { ok: !!st.ok, target: typeof st.target === 'function' ? st.target(a) : st.target, moves: !!(s.step && s.step.moves), end: !!(s.step && s.step.end), long: st.say.length }; });
    if (!st) break;
    // 킹의 말을 읽을 틈: 알았다 걸음은 길게, 누르는 걸음은 짧게
    await wait(st.ok ? 700 + st.long * 30 : 350 + st.long * 10);
    if (st.ok) { await click('guide:ok', 300); if (st.end) break; continue; }
    await click(st.target, 300);
    if (st.moves) { mark('행마 보기'); await wait(2200); await click('moves:back', 350); }
  }
  // 대본 뒤: 처음 안내(킹 말풍선)를 읽고 누른다
  const FIRST_MARK = { reward: '대본 대국 끝 — 보상', shop: '첫 상점 — 처음 안내(킹 말풍선)', draft: '레퍼토리 고르기(대본 대국 뒤)', select: '1관 정식 관 선택 — 농민군 처음 안내', pack: '첫 꾸러미' };
  const firstSeen = new Set();
  for (let g = 0; g < 400 && !late(); g++) {
    const name = await scr();
    if (!firstSeen.has(name) && FIRST_MARK[name]) { firstSeen.add(name); mark(FIRST_MARK[name]); }
    const hint = await ev(() => window.__app.hintShown && window.__app.hintShown.id);
    if (hint && name !== 'battle') { await wait(2400); await click(await ev(() => window.__app.hintShown.regionId), 500); await wait(500); continue; }
    if (name === 'draft') { if (await ev(() => !!window.__app.screen.chosen)) { await wait(300); continue; } await wait(3000); if (await region('draft:0')) await click('draft:0', 900); await wait(1200); continue; }
    if (name === 'select') { await wait(1800); await click('select:play', 700); await wait(1500); continue; }
    if (name === 'battle') { if (!(await playBattle())) await wait(300); continue; }
    if (name === 'reward' || name === 'chest' || name === 'legend') { await wait(2200); await click('next', 400); continue; }
    if (name === 'shop') { await shopTurn(); continue; }
    if (name === 'pack') { await wait(2600); const i = await ev(() => { const o = window.__app.run.pack.options; const k = o.findIndex((x) => x.kind !== 'engraving'); return k < 0 ? 0 : k; }); if (!(await region(`pack:pick:${i}`))) { await wait(400); continue; } await click(`pack:pick:${i}`, 1200); if (await region('target:ok')) { await click(`deck:${await ev(() => window.__app.run.deck[0].id)}`, 900); await wait(1500); await click('target:ok', 600); } await wait(1000); continue; }
    if (name === 'result') { mark('판이 끝났다'); break; }
    await wait(400);
  }
  mark('끝');
  await wait(1500);
}
async function playBattle() {
  await idle();
  const d = await ev(async () => {
    const b = window.__app.run && window.__app.run.battle;
    if (!b) return null;
    if (b.status === 'chain') { const l = window.__app.screen.clickable().list; return l.length ? { sq: l[0] } : null; }
    if (b.status !== 'play') return null;
    const { decideBattle } = await import('/tools/bot.mjs');
    const x = decideBattle(b);
    return x && (x.play ? { hand: x.play.handIndex, drop: x.play.sq } : { discard: x.discard });
  });
  if (!d) return false;
  if (d.sq != null) { await hover(`sq:${d.sq}`, 700); await click(`sq:${d.sq}`, 80); return true; }
  if (d.discard) { for (const i of d.discard) await click(`hand:${i}`, 500); await click('btn:discard', 700); return true; }
  await wait(900);
  await click(`hand:${d.hand}`, 700);
  await hover(`sq:${d.drop}`, 1100);
  await click(`sq:${d.drop}`, 80);
  return true;
}
async function shopTurn() {
  await wait(2600);
  const plan = await ev(async () => {
    const { canBuy } = await import('/src/sim/run.js');
    const r = window.__app.run;
    const i = r.shop.display.findIndex((it) => canBuy(r, it) && (it.kind === 'maxim' || it.kind === 'piece'));
    const p = r.shop.packs.findIndex((pk) => !pk.sold && r.money >= pk.price);
    return { buy: i, pack: p };
  });
  if (plan.buy >= 0) { await hover(`shop:buy:${plan.buy}`, 2200); await click(`shop:buy:${plan.buy}`, 300); await wait(1500); return; }
  if (plan.pack >= 0) { await hover(`shop:pack:${plan.pack}`, 1500); await click(`shop:pack:${plan.pack}`, 300); await wait(1200); return; }
  await wait(1200);
  await click('shop:leave', 500);
  await wait(1200);
}

await firstTen();

const vpath = await page.video().path();
await ctx.close();
await browser.close();
srv.close();
const total = (Date.now() - t0) / 1000;

const webm = FIRST ? null : path.join(OUT, 'chainmate-play.webm');
const mp4 = path.join(OUT, FIRST ? 'first-play.mp4' : 'chainmate-play.mp4');
const ff = findFfmpeg();
if (ff) {
  // webm은 VP9로 다시 눌러 작게, mp4는 H.264 · yuv420p(어디서나 열리게)
  if (webm) execFileSync(ff, ['-y', '-loglevel', 'error', '-i', vpath, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-an', webm]);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-i', vpath, '-c:v', 'libx264', '-preset', 'slow', '-crf', FIRST ? '30' : '26', '-r', FIRST ? '30' : '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
} else {
  fs.copyFileSync(vpath, webm || path.join(OUT, 'first-play.webm'));
  console.log('ffmpeg(libx264)를 못 찾아 webm만 남긴다');
}
fs.rmSync(RAW, { recursive: true, force: true });

// 녹화 영상의 시계는 벽시계보다 조금 느리게 간다(이 환경에서 ~1.13배). 장면 시각은 영상 길이에 맞춰 늘린다
let scale = 1;
if (ff) {
  let info = '';
  try { execFileSync(ff, ['-hide_banner', '-i', mp4], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { info = String(e.stderr || ''); }
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (m) scale = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / total;
}
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const md = [FIRST ? '# 처음 켠 사람의 첫 몇 분' : '# 소개 영상 장면', '', `\`tools/video.mjs${FIRST ? ' --first' : ''}\`로 녹화(${W}×${H}, 약 ${Math.round(total * scale)}초). 시각은 영상 시작부터.`, '', '| 시각 | 장면 |', '|---|---|', ...chapters.map(([t, s]) => `| ${fmt(t * scale)} | ${s} |`), ''];
fs.writeFileSync(path.join(OUT, FIRST ? 'first-play.md' : 'chapters.md'), md.join('\n'));
for (const f of [webm, mp4]) if (f && fs.existsSync(f)) console.log(path.relative(ROOT, f), (fs.statSync(f).size / 1e6).toFixed(2) + 'MB');
console.log(`길이 ${(total * scale).toFixed(1)}s(벽시계 ${total.toFixed(1)}s) · 페이지 오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
