// 홈 화면 아이콘(PWA · iOS): 펠트 위 벡터 킹(src/render/pieces3.js pieceCanvas)을 PNG로 굽는다.
//   node tools/icons.mjs → assets/icons/icon-192.png · icon-512.png · icon-maskable-512.png · apple-touch-icon.png(180)
//   node tools/icons.mjs --desktop → desktop/icon-1024.png(데스크톱 앱 아이콘 원본, `cargo tauri icon`에 넣는다)
// 브라우저(Playwright, 저장소 의존성 밖 전역)에서 게임과 같은 그리기로 굽는다 — 작은 정적 서버를 잠깐 띄운다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/icons');

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><body></body>'); return; }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/`);

// size: 한 변 화소, fit: 킹 상자 높이 / 한 변(가려 자르는 아이콘은 가운데 80% 원 안에 들게 작게)
async function bake(size, fit) {
  const url = await page.evaluate(async ({ size, fit }) => {
    const [{ pieceCanvas, fitAt }, { PAL }] = await Promise.all([import('/src/render/pieces3.js'), import('/src/render/palette.js')]);
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = PAL.felt; g.fillRect(0, 0, size, size);
    // 뒤 달무리: 가운데가 조금 밝은 둥근 판 + 잉크 고리
    const r = size * 0.4;
    g.beginPath(); g.arc(size / 2, size / 2, r, 0, Math.PI * 2); g.fillStyle = PAL.feltDk; g.fill();
    g.beginPath(); g.arc(size / 2, size / 2, r * 0.8, 0, Math.PI * 2); g.fillStyle = '#2f3672'; g.fill();
    // 킹: 16 × 22 비율 상자를 가운데에(받침 아래가 상자 아래)
    const bh = size * fit, bw = (bh * 16) / 22, bx = (size - bw) / 2, by = (size - bh) / 2 + size * 0.02;
    const f = fitAt(bx, by, bw, bh), k = pieceCanvas('K', 'w', { n: 1, w: f.w });
    g.imageSmoothingEnabled = true;
    g.drawImage(k.cv, f.cx - k.ox, f.cy - k.oy, k.w, k.h);
    return c.toDataURL('image/png');
  }, { size, fit });
  return Buffer.from(url.split(',')[1], 'base64');
}

const write = (file, buf, size) => { fs.writeFileSync(file, buf); console.log('구움', path.relative(ROOT, file), `${size}×${size}`); };
if (process.argv.includes('--desktop')) {
  // 데스크톱 앱(.icns): 같은 그림을 1024로. 웹 아이콘은 건드리지 않는다
  write(path.join(ROOT, 'desktop/icon-1024.png'), await bake(1024, 0.68), 1024);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, size, fit] of [['icon-192.png', 192, 0.68], ['icon-512.png', 512, 0.68], ['apple-touch-icon.png', 180, 0.66], ['icon-maskable-512.png', 512, 0.5]]) write(path.join(OUT, name), await bake(size, fit), size);
}
await browser.close();
srv.close();
