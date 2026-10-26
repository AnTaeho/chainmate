// 기물 크기 견주기 시트(읽기 전용): 실제로 쓰는 상자 크기마다 16종 × 편
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/Users/antaeho/workspace/projects/chainmate';
const OUT = '/private/tmp/claude-501/-Users-antaeho-workspace-projects-chainmate/8f330b3b-72b7-4640-9007-8007bff18851/scratchpad/scan/screens/sheet';
fs.mkdirSync(OUT, { recursive: true });
const pw = await import('/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', 1024, ok));
const browser = await pw.webkit.launch();
try {
  for (const [name, vw, vh, dpr] of [['iphone', 734, 343, 3], ['hd', 1280, 720, 1]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
    await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('chainmate.settings.v1', JSON.stringify({ volume: 0, music: 0, lang: 'ko', telemetry: false })); });
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
    await page.waitForFunction(() => window.__app && window.__app.screen);
    await page.evaluate(async () => {
      const { fitPiece } = await import('/src/render/pieces3.js');
      const a = window.__app; if (a.overlay) a.closeOverlay();
      const c = a.canvas;
      const T = ['P', 'N', 'B', 'R', 'Q', 'K', 'Z', 'L', 'O', 'S', 'W', 'T', 'E', 'V', 'M', 'D'];
      a.draw = () => {
        const g = c.getContext('2d');
        const k = c.width / 480;
        g.setTransform(k, 0, 0, k, 0, 0);
        g.fillStyle = '#262c5f'; g.fillRect(0, 0, 480, 270);
        // 줄: [이름, 상자 w, h, 바탕, 편]
        const rows = [['판칸20', 16, 22, 'sq', 'w'], ['판칸20', 16, 22, 'sq', 'b'], ['손36x29', 36, 29, '#f7eedb', 'w'], ['콤보12x16', 12, 16, '#12153a', 'w'], ['다음12x18', 12, 18, '#12153a', 'w'], ['상점16x22', 16, 22, '#f7eedb', 'w'], ['복기8x11', 8, 11, '#262c5f', 'w'], ['금빛', 16, 22, 'sq', 'g']];
        let y = 4;
        for (const [nm, w, h, bg, side] of rows) {
          const cell = Math.max(24, w + 6), ch = h + 6;
          T.forEach((t, i) => {
            const x = 4 + i * 29;
            if (bg === 'sq') { g.fillStyle = i % 2 ? '#7f8bb0' : '#efe6d2'; g.fillRect(x, y, 20, 20); fitPiece(g, t, side, x + 2, y + 20 - 22 + 2, 16, 22); }
            else { g.fillStyle = bg; g.fillRect(x, y, Math.min(cell, 28), ch); fitPiece(g, t, side, x + (Math.min(cell, 28) - w) / 2, y + 3, w, h); }
          });
          y += (bg === 'sq' ? 22 : ch) + 4;
        }
      };
      a.invalidate && a.invalidate();
    });
    await page.waitForTimeout(600);
    fs.writeFileSync(path.join(OUT, `${name}.png`), await page.screenshot());
    await page.close();
  }
} finally { await browser.close(); srv.close(); }
