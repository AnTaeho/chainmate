// 배포 판본 주소(CHM-75): Vercel 빌드 명령. 정적 파일을 dist/에 모으고 index.html의 style.css · src/ 주소에 v/<판본>/을 붙인다.
// 저장소 파일은 건드리지 않는다(로컬 놀이는 빌드 없이 그대로). `node tools/stamp.mjs [--out dist]`
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 배포에 싣는 정적 파일(api/는 Vercel이 저장소 루트에서 따로 짓는다)
export const STATIC = ['index.html', 'style.css', 'manifest.webmanifest', 'privacy.html', 'src', 'assets'];
const ATTR = /\b(href|src)="(style\.css|src\/[^"]+)"/g;

function walk(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).filter((n) => n !== '.DS_Store').sort().flatMap((n) => walk(root, path.posix.join(rel, n)));
}

// 판본 = /v/ 아래로 나가는 파일(src/ · style.css)의 내용 해시 — 내용이 같으면 배포가 바뀌어도 캐시가 산다
export function buildId(root = ROOT) {
  const h = crypto.createHash('sha256');
  for (const f of [...walk(root, 'src'), 'style.css']) h.update(f).update('\0').update(fs.readFileSync(path.join(root, f))).update('\0');
  return h.digest('hex').slice(0, 10);
}

export function stampHtml(html, id) {
  if (!/^[0-9a-z]+$/.test(id)) throw new Error(`판본 이름이 이상하다: ${id}`);
  if (/\b(?:href|src)="v\//.test(html)) throw new Error('index.html에 이미 판본 주소가 있다');
  const out = html.replace(ATTR, (_, attr, url) => `${attr}="v/${id}/${url}"`);
  if (out === html) throw new Error('index.html에 판본을 붙일 주소가 없다');
  return out;
}

// /v/<판본>/style.css에서 글꼴은 판본 밖 같은 주소(/assets/fonts/…)로 — preload와 같은 URL이라 두 번 받지 않는다
export function stampCss(css) {
  return css.replace(/url\("assets\//g, 'url("/assets/');
}

export function stamp({ root = ROOT, out = path.join(ROOT, 'dist'), id = buildId(root) } = {}) {
  if (path.resolve(out) === path.resolve(root)) throw new Error('저장소 루트에는 쓰지 않는다');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of STATIC) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true, filter: (s) => path.basename(s) !== '.DS_Store' });
  fs.writeFileSync(path.join(out, 'index.html'), stampHtml(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), id));
  fs.writeFileSync(path.join(out, 'style.css'), stampCss(fs.readFileSync(path.join(root, 'style.css'), 'utf8')));
  return id;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'dist');
  const id = stamp({ out });
  console.log(`판본 ${id} → ${path.relative(process.cwd(), out) || out}`);
}
