// 홈 화면 아이콘(PWA · iOS): 펠트 위 상아 킹 도트 그림을 PNG로 굽는다. 저장소 의존성 없이 node zlib로 PNG를 쓴다.
//   node tools/icons.mjs → assets/icons/icon-192.png · icon-512.png · icon-maskable-512.png · apple-touch-icon.png(180)
//   node tools/icons.mjs --desktop → desktop/icon-1024.png(데스크톱 앱 아이콘 원본, `cargo tauri icon`에 넣는다)
// 그림은 도트 격자(32 또는 36 · 64칸)에 그리고 칸마다 정수 화소로 늘린다(흐림 없음).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spritePixels, TONE } from '../src/render/sprites.js';
import { feltWeave, FELT_WEAVE } from '../src/render/texture.js';
import { PAL, rgb } from '../src/render/palette.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/icons');

// 킹 빛깔: 상아(w) + 금관(c*)
const GOLD = { cf: '#eaa92c', ch: '#ffe79a', cs: '#b27414', co: '#5a3a0c', cd: '#b27414', cx: '#eaa92c' };
const kingCol = (t) => (t.startsWith('c') ? GOLD[t] || GOLD.cf : TONE.w[t] || TONE.w.f);

// dots: 격자 칸 수, k: 킹 한 도트가 몇 칸인가
function art(dots, k) {
  const g = Array.from({ length: dots }, (_, y) => Array.from({ length: dots }, (_, x) => [rgb(PAL.felt), ...FELT_WEAVE.slice(1).map(rgb)][feltWeave(x, y)]));
  const cx = dots / 2, cy = dots / 2;
  // 뒤 달무리: 가운데가 조금 밝은 둥근 판(도트 계단)
  for (let y = 0; y < dots; y++) for (let x = 0; x < dots; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (dots / 2);
    if (d < 0.78) g[y][x] = rgb(d < 0.62 ? '#2c4540' : PAL.feltHi);
  }
  const W = 16 * k, H = 22 * k;
  const ox = Math.round(cx - W / 2), oy = Math.round(cy - H / 2) + Math.round(k / 2);
  // 발밑 그림자
  for (let i = 3 * k; i < 13 * k; i++) for (let j = 0; j < k; j++) { const y = oy + H - k + j; if (g[y]) g[y][ox + i] = rgb('#101a17'); }
  for (const [i, j, t] of spritePixels('K')) {
    const c = rgb(kingCol(t));
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) g[oy + j * k + b][ox + i * k + a] = c;
  }
  return g;
}

function png(grid, px) {
  const n = grid.length * px;
  const raw = Buffer.alloc((n * 3 + 1) * n);
  for (let y = 0; y < n; y++) {
    raw[y * (n * 3 + 1)] = 0;
    for (let x = 0; x < n; x++) { const c = grid[Math.floor(y / px)][Math.floor(x / px)]; raw.set(c, y * (n * 3 + 1) + 1 + x * 3); }
  }
  const crcT = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 데스크톱 앱(.icns): 같은 그림을 1024로. 웹 아이콘은 건드리지 않는다
if (process.argv.includes('--desktop')) {
  const file = path.join(ROOT, 'desktop/icon-1024.png');
  fs.writeFileSync(file, png(art(32, 1), 32));
  console.log('구움', path.relative(ROOT, file), '1024×1024');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const out = [
  ['icon-192.png', art(32, 1), 6],
  ['icon-512.png', art(32, 1), 16],
  ['apple-touch-icon.png', art(36, 1), 5],
  // 가려 자르는 아이콘(maskable): 가운데 80% 원 안에 들게 격자를 넓힌다
  ['icon-maskable-512.png', art(64, 2), 8],
];
for (const [name, grid, px] of out) { fs.writeFileSync(path.join(OUT, name), png(grid, px)); console.log('구움', name, `${grid.length * px}×${grid.length * px}`); }
