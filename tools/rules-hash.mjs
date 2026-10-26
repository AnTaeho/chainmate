// 규칙 파일 해시(src/sim/rules.js RULES_VERSION을 지키는 값): src/sim · src/data(화면 글 i18n 빼고) · api/_lib/verify.js 내용을
// 줄 머리 주석(//)을 빼고 이어 sha256. 쓰기: node tools/rules-hash.mjs [--write] — --write면 test/fixtures/rules-hash.json을 지금 값으로.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['src/data/i18n', 'src/sim/rules.js']);
function walk(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir)).sort()) {
    const p = `${dir}/${f}`;
    if (SKIP.has(p)) continue;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}
export function rulesFiles() { return [...walk('src/sim'), ...walk('src/data'), 'api/_lib/verify.js']; }
export function rulesHash() {
  const h = createHash('sha256');
  for (const p of rulesFiles()) {
    const body = readFileSync(join(ROOT, p), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    h.update(`${p}\n${body}\n`);
  }
  return h.digest('hex');
}
export const FIXTURE = join(ROOT, 'test/fixtures/rules-hash.json');

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') {
  const { RULES_VERSION } = await import('../src/sim/rules.js');
  const now = { version: RULES_VERSION, hash: rulesHash() };
  if (process.argv.includes('--write')) { mkdirSync(dirname(FIXTURE), { recursive: true }); writeFileSync(FIXTURE, JSON.stringify(now, null, 2) + '\n'); }
  console.log(JSON.stringify(now));
}
