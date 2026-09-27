// 소개 영상 녹화: 실제 게임을 브라우저(Playwright chromium)로 열어 정해진 각본을 둔다(약 70초).
//   node tools/video.mjs [--out docs/media] [--ffmpeg 경로]
// 결과: <out>/chainmate-play.webm, ffmpeg(libx264)가 있으면 <out>/chainmate-play.mp4(H.264 · yuv420p), 장면 시각 <out>/chapters.md.
//   --first: 「처음 켠 사람의 첫 10분」 — 빈 저장소로 켜서 수업 열을 손으로 두고, 처음 안내를 읽으며 첫 판을 2관까지(960×540).
//            결과 <out>/first-play.mp4 · <out>/first-play.md
// Playwright는 저장소 의존성에 넣지 않는다(전역 설치나 npx -y로). ffmpeg는 PATH · --ffmpeg · FFMPEG 순으로 찾는다.
// 화면 크기: 뷰포트를 480×270으로 녹화하면 1440×810으로 늘릴 때 흐려져서, 뷰포트를 1440×810으로 두고 게임이 정수배(×3)로 그리게 한다.
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
const FIRST = args.includes('--first');
const W = FIRST ? 960 : 1440, H = FIRST ? 540 : 810;
const SEED = 72;   // 첫 대국에서 여섯을 잇는 사슬(!!)이 나오는 판(풀이기로 찾음)

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
if (!FIRST) await page.addInitScript(() => { window.__autoDraft = true; });
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

async function intro() {
  // 1 타이틀: 흐린 판에서 풀이기가 사슬을 둔다
  await park();
  mark('타이틀 시연');
  await wait(3200);

  // 2 첫 수업 2 「잡으면 그것이 된다」: 시범 → 내 차례(미리 보기를 보며)
  await ev(() => window.__app.go('lesson', { index: 1 }));
  mark('첫 수업 2 · 시범');
  await page.waitForFunction(() => window.__app.screen.phase === 'play', null, { timeout: 30000 });
  mark('첫 수업 2 · 내 차례');
  await wait(500);
  await click('hand:0', 500);
  await hover('sq:10', 900);
  await click('sq:10', 200);
  await idle();
  await hover('sq:27', 1300);
  await click('sq:27', 100);
  await idle();
  await hover('sq:59', 1000);
  await click('sq:59', 100);
  await page.waitForFunction(() => window.__app.screen.name !== 'lesson' || window.__app.screen.index !== 1, null, { timeout: 30000 }).catch(() => {});

  // 3 평소 대국: 미리 보기를 보며 여섯을 잇는 사슬(!!)
  await ev((seed) => { const a = window.__app; a.records.lessonsDone = true; a.saveRecords(); a.newRun({ seed }); }, SEED);
  await park();
  mark('1관 대국 · 긴 사슬');
  await wait(1400);
  await click('select:play', 300);
  await wait(1800);
  const plan = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return { hand: d.handIndex, sq: d.sq, line: d.line }; });
  await click(`hand:${plan.hand}`, 500);
  await hover(`sq:${plan.sq}`, 900);
  await click(`sq:${plan.sq}`, 100);
  await idle();
  for (const c of plan.line) {
    const sq = typeof c === 'number' ? c : c.sq;
    await hover(`sq:${sq}`, 900);
    await click(`sq:${sq}`, 100);
    await idle();
  }
  mark('사슬 끝 · 넘친 목표');
  await page.waitForFunction(() => window.__app.screen.name !== 'battle', null, { timeout: 30000 }).catch(() => {});

  // 4 보상 → 상점: 격언을 사서 격언 칸에
  if (await ev(() => window.__app.screen.name === 'reward')) { await wait(2600); await click('next', 300); }
  await ev(() => { window.__app.run.money = 30; });
  await park();
  mark('상점 · 격언 사기');
  await wait(800);
  await hover('shop:buy:0', 1600);
  await click('shop:buy:0', 200);
  await wait(1400);

  // 5 명인의 상자 릴
  await ev(() => { window.__app.go('chest', { chest: { count: 5, tier: 'rare', cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'Q' } }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'engrave', piece: 'Q', pieceId: 1, eng: 'glass' } }, { lit: true, item: { kind: 'chart', form: 'N' } }] } }); });
  await park();
  mark('명인의 상자');
  await wait(5500);

  // 6 전설 완성
  await ev(() => { window.__app.go('legend', { legend: 'immortal' }); });
  mark('전설 · 불멸의 대국');
  await wait(7000);
  await ev(() => { window.__app.go('title'); });
  mark('끝');
  await wait(2000);

}

// 처음 켠 사람의 첫 10분: 사람 손 빠르기로(글을 읽는 틈을 두고) 둔다
async function firstTen() {
  const LIMIT = 9.5 * 60 * 1000;
  const late = () => Date.now() - t0 > LIMIT;
  const scr = () => ev(() => window.__app.screen.name);
  mark('처음 켬 — 곧바로 첫 수업 1의 시범');
  const lessons = await ev(async () => (await import('/src/ui/lessons.js')).LESSONS.map((L) => ({ title: L.title, shop: !!L.shop, steps: L.steps || null })));
  for (let i = 0; i < lessons.length; i++) {
    const L = lessons[i];
    if (L.shop) {
      await page.waitForFunction(() => !!window.__app.guide, null, { timeout: 30000 });
      mark(`수업 ${i + 1} · ${L.title}(가리키는 곳만 눌린다)`);
      for (let k = 0; k < 8; k++) {
        const st = await ev(() => { const g = window.__app.guide; return g && g.steps[g.i] ? { target: g.steps[g.i].target, ok: !!g.steps[g.i].ok } : null; });
        if (!st) break;
        await wait(2400);
        await click(st.ok ? 'guide:ok' : st.target, 500);
        await wait(900);
      }
      continue;
    }
    await page.waitForFunction((i) => { const s = window.__app.screen; return s.name === 'lesson' && s.index === i; }, i, { timeout: 60000 });
    mark(`수업 ${i + 1} · ${L.title} — 시범`);
    await page.waitForFunction(() => window.__app.screen.phase === 'play', null, { timeout: 60000 });
    mark(`수업 ${i + 1} · 내 차례`);
    await wait(1500);
    for (let k = 0; k < L.steps.length; k++) {
      await idle();
      const st = L.steps[k];
      if (st.pick != null) { await click(`hand:${st.pick}`, 900); continue; }
      if (st.discard) { await click('btn:discard', 1200); await wait(900); continue; }
      const sq = await ev(() => { const s = window.__app.screen; const l = s.clickable().list; return l[l.length - 1]; });
      await hover(`sq:${sq}`, st.say ? 1600 : 900);
      await click(`sq:${sq}`, 100);
    }
    await page.waitForFunction((i) => { const s = window.__app.screen; return !(s.name === 'lesson' && s.index === i); }, i, { timeout: 30000 }).catch(() => {});
  }
  // 첫 판: 처음 안내를 읽고 누른다
  mark('수업 끝 — 곧바로 첫 판(정석 고르기)');
  for (let g = 0; g < 400 && !late(); g++) {
    const name = await scr();
    if (name === 'draft') { await wait(3200); await click('draft:0', 900); await wait(1200); continue; }
    if (name === 'select') { await wait(1800); await click('select:play', 700); await wait(1500); continue; }
    if (name === 'battle') { if (!(await playBattle())) await wait(300); continue; }
    if (name === 'reward' || name === 'chest' || name === 'legend') { await wait(2200); await click('next', 400); continue; }
    if (name === 'shop') { await shopTurn(); continue; }
    if (name === 'pack') { await wait(2600); const i = await ev(() => { const o = window.__app.run.pack.options; const k = o.findIndex((x) => x.kind !== 'engraving'); return k < 0 ? 0 : k; }); await click(`pack:pick:${i}`, 1200); if (await region('target:ok')) { await click(`deck:${await ev(() => window.__app.run.deck[0].id)}`, 900); await wait(1500); await click('target:ok', 600); } await wait(1000); continue; }
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
let shopSeen = 0;
async function shopTurn() {
  shopSeen++;
  if (shopSeen === 1) mark('첫 상점 — 처음 안내');
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

if (FIRST) await firstTen(); else await intro();

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
const md = [FIRST ? '# 처음 켠 사람의 첫 10분' : '# 소개 영상 장면', '', `\`tools/video.mjs${FIRST ? ' --first' : ''}\`로 녹화(${W}×${H}, 약 ${Math.round(total * scale)}초). 시각은 영상 시작부터.`, '', '| 시각 | 장면 |', '|---|---|', ...chapters.map(([t, s]) => `| ${fmt(t * scale)} | ${s} |`), ''];
fs.writeFileSync(path.join(OUT, FIRST ? 'first-play.md' : 'chapters.md'), md.join('\n'));
for (const f of [webm, mp4]) if (f && fs.existsSync(f)) console.log(path.relative(ROOT, f), (fs.statSync(f).size / 1e6).toFixed(2) + 'MB');
console.log(`길이 ${(total * scale).toFixed(1)}s(벽시계 ${total.toFixed(1)}s) · 페이지 오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
