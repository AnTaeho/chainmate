// 도구 공용(C-7): Playwright 불러오기 · 저장소 정적 서버. 도구마다 복사해 쓰던 것을 한 곳에 — 고칠 때 한 번만.
// Playwright는 저장소 의존성이 아니다: PLAYWRIGHT 환경 변수(모듈 경로) → 이 기기에 깔린 것 → npm 전역(NPM_CONFIG_PREFIX) 차례로 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

export const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

// root 아래 파일을 내주는 서버(빈 포트 — listen(0)). 경로는 path.relative로 재서 root 밖(이름 앞부분만 같은 형제 폴더 포함)은 404.
// handle(req, res): 먼저 받아 처리했으면 참(가짜 /api 등)
export function serveRoot(root, { handle = null } = {}) {
  const srv = http.createServer(async (req, res) => {
    if (handle && (await handle(req, res))) return;
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(root, u === '/' ? 'index.html' : u);
    const rel = path.relative(root, p);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, () => ok(srv)));
}
