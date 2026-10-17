// 미리 받기 줄(CHM-75): index.html의 표시 사이에 글꼴 preload와 src/main.js가 정적으로 부르는 모듈 전부의 modulepreload를 쓴다.
// 모듈을 더하거나 글꼴을 다시 줄이면 `node tools/preload.mjs` — test/preload.test.js가 어긋남을 잡는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const START = '<!-- 미리 받기: node tools/preload.mjs가 쓴다 -->';
export const END = '<!-- /미리 받기 -->';

// 정적 import · export … from · import './x.js'만 따라간다(import()는 뺀다)
const STATIC = [/^\s*(?:import|export)\s[^;]*?\sfrom\s*['"](\.{1,2}\/[^'"]+)['"]/gms, /^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm];

export function staticGraph(root = ROOT, entry = 'src/main.js') {
  const seen = [entry];
  for (let i = 0; i < seen.length; i++) {
    const file = seen[i];
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    for (const re of STATIC) {
      for (const m of src.matchAll(re)) {
        const dep = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
        if (!seen.includes(dep)) seen.push(dep);
      }
    }
  }
  return seen;
}

export function fontUrls(root = ROOT) {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  return [...css.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((m) => m[1]);
}

export function preloadBlock(root = ROOT) {
  const lines = [
    START,
    ...fontUrls(root).map((u) => `<link rel="preload" href="${u}" as="font" type="font/woff2" crossorigin>`),
    ...staticGraph(root).map((m) => `<link rel="modulepreload" href="${m}">`),
    END,
  ];
  return lines.join('\n');
}

export function currentBlock(html) {
  const a = html.indexOf(START), b = html.indexOf(END);
  return a < 0 || b < a ? null : html.slice(a, b + END.length);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const old = currentBlock(html);
  if (!old) { console.error(`index.html에 ${START} … ${END} 표시가 없다`); process.exit(1); }
  const next = preloadBlock();
  fs.writeFileSync(file, html.replace(old, next));
  console.log(`글꼴 ${fontUrls().length} · 모듈 ${staticGraph().length}${old === next ? ' (그대로)' : ''}`);
}
