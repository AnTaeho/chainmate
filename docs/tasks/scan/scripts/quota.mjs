const pw = await import('/Users/antaeho/workspace/projects/papercut/node_modules/playwright/index.mjs');
import http from 'node:http';
const srv = http.createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<p>x</p>'); });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
for (const e of ['webkit', 'chromium']) {
  const b = await pw[e].launch(); const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/`);
  const r = await p.evaluate(() => {
    localStorage.clear();
    const chunk = 'a'.repeat(100000), chunkK = '가'.repeat(100000); let n = 0;
    try { for (;;) { localStorage.setItem('k' + n, chunk); n++; } } catch (e) {}
    const ascii = n * 100000; localStorage.clear(); n = 0;
    try { for (;;) { localStorage.setItem('k' + n, chunkK); n++; } } catch (e) {}
    const kor = n * 100000; localStorage.clear();
    return { ascii, kor };
  });
  console.log(e, JSON.stringify(r));
  await b.close();
}
srv.close();
