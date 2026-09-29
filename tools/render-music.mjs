// 음악을 파일로 뽑는다(CHM-29): 곡마다 층 0 · 2 · 4를 OfflineAudioContext로 합성해 docs/media/music/<곡>-L<층>.mp3로 둔다.
//   node tools/render-music.mjs [--seconds 25] [--gain 4.5] [--layers 0,2,4] [--tracks battle,master,shop,title] [--out docs/media/music] [--wav]
// 게임과 같은 src/audio/audio.js를 브라우저(Playwright chromium)에서 불러 renderMusic으로 예약하고 렌더한다.
// 음량은 설정 최대(volume 1 · music 1)로 합성한 뒤 모든 파일에 같은 배율(--gain, 기본 4.5)을 곱한다 — 곡 · 층끼리 크기를 견줄 수 있게.
// mp3는 ffmpeg로 만든다(없으면 --wav). Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SECONDS = +opt('--seconds', 25);
const LAYERS = opt('--layers', '0,2,4').split(',').map(Number);
const TRACKS = opt('--tracks', 'battle,master,shop,title').split(',');
const OUT = path.resolve(ROOT, opt('--out', 'docs/media/music'));
const WAV = args.includes('--wav');
const RATE = 44100;
const GAIN = +opt('--gain', 4.5);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>render</title>'); return; }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${port}/`);

fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const track of TRACKS) {
  for (const L of LAYERS) {
    // 페이지 안에서 합성 → 16비트 WAV → base64
    const r = await page.evaluate(async ({ track, L, SECONDS, RATE, GAIN }) => {
      const { createAudio } = await import('/src/audio/audio.js');
      const off = new OfflineAudioContext(2, Math.ceil(RATE * SECONDS), RATE);
      const audio = createAudio(window, { context: off, strict: true });
      audio.apply({ volume: 1, music: 1 });
      if (!audio.renderMusic(track, L, SECONDS)) throw new Error(`no track ${track}`);
      const buf = await off.startRendering();
      const chs = [buf.getChannelData(0), buf.getChannelData(1)];
      let peak = 0;
      for (const d of chs) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      const gain = GAIN;
      // 끝 0.4초는 사라지게(되풀이 중간에서 자른 자리가 뚝 끊기지 않게)
      const n = buf.length, fadeN = Math.floor(RATE * 0.4);
      const bytes = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
      bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
      bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
      str(36, 'data'); bytes.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) {
        const f = i > n - fadeN ? (n - i) / fadeN : 1;
        for (let c = 0; c < 2; c++) {
          const v = Math.max(-1, Math.min(1, chs[c][i] * gain * f));
          bytes.setInt16(44 + i * 4 + c * 2, Math.round(v * 32767), true);
        }
      }
      const u8 = new Uint8Array(bytes.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return { b64: btoa(bin), peak, loop: audio.loopSeconds(track) };
    }, { track, L, SECONDS, RATE, GAIN });
    const base = path.join(OUT, `${track}-L${L}`);
    fs.writeFileSync(`${base}.wav`, Buffer.from(r.b64, 'base64'));
    let file = `${base}.wav`;
    if (!WAV) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.wav`, '-codec:a', 'libmp3lame', '-b:a', '128k', `${base}.mp3`]);
      fs.unlinkSync(`${base}.wav`);
      file = `${base}.mp3`;
    }
    rows.push({ track, L, peak: r.peak, loop: r.loop, file: path.relative(ROOT, file), kb: Math.round(fs.statSync(file).size / 1024) });
    console.log(`${track.padEnd(7)} 층 ${L}  한 바퀴 ${r.loop.toFixed(1)}초  원래 최고점 ${r.peak.toFixed(3)}  → ${path.relative(ROOT, file)} (${Math.round(fs.statSync(file).size / 1024)}KB)`);
  }
}
await browser.close();
srv.close();
console.log(`${rows.length}개, ${SECONDS}초씩`);
