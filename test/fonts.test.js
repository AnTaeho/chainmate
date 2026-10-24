// 줄인 글꼴(CHM-75 · 안 3, tools/fonts.py): 게임이 쓰는 글자가 모두 들었나 · 글자표와 파일 · style.css가 맞나.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLYPHS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fonts/glyphs.json'), 'utf8'));
const RERUN = '글꼴을 다시 줄여야 한다: `uv run --no-project --with fonttools --with brotli python tools/fonts.py` 뒤 `node tools/preload.mjs` · `node tools/fontwidths.mjs` (tools/fonts.py 머리말)';

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('글꼴: src · index.html · privacy.html · style.css · manifest의 모든 글자가 줄인 글꼴에 있다', () => {
  const known = new Set([...GLYPHS.covered, ...GLYPHS.missingInSource]);
  const files = [...jsFiles(path.join(ROOT, 'src')), ...['index.html', 'privacy.html', 'style.css', 'manifest.webmanifest'].map((f) => path.join(ROOT, f))];
  const miss = new Map();
  for (const f of files) {
    for (const ch of fs.readFileSync(f, 'utf8')) {
      if (ch.codePointAt(0) < 0x20 || known.has(ch)) continue;
      if (!miss.has(ch)) miss.set(ch, path.relative(ROOT, f));
    }
  }
  const list = [...miss].slice(0, 20).map(([ch, f]) => `${ch}(U+${ch.codePointAt(0).toString(16).toUpperCase()}, ${f})`).join(' ');
  assert.equal(miss.size, 0, `글꼴에 없는 글자 ${miss.size}개: ${list}\n${RERUN}`);
});

test('글꼴: 출력 ASCII를 모두 덮고, 굵은 글이 넘기는 글자는 보통 글 파일에 있다', () => {
  const covered = new Set(GLYPHS.covered);
  for (let c = 0x20; c < 0x7f; c++) assert.ok(covered.has(String.fromCharCode(c)), `ASCII ${c} 없음 — ${RERUN}`);
  for (const ch of GLYPHS.boldFallback) assert.ok(covered.has(ch), ch);
  // 원본 둘 다에 없는 글자는 주석에만 있다(화면에 그리지 않는다)
  assert.ok([...GLYPHS.missingInSource].every((ch) => '≈⊄章紋'.includes(ch)), GLYPHS.missingInSource);
});

test('글꼴: style.css가 가리키는 파일이 글자표의 파일이고 내용 해시가 맞다', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const urls = [...css.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(urls, Object.keys(GLYPHS.fonts).sort(), RERUN);
  for (const [rel, meta] of Object.entries(GLYPHS.fonts)) {
    const data = fs.readFileSync(path.join(ROOT, rel));
    const digest = crypto.createHash('sha256').update(data).digest('hex');
    assert.equal(digest, meta.sha256, `${rel} 내용이 글자표와 다르다 — ${RERUN}`);
    assert.ok(rel.includes(`.${digest.slice(0, 8)}.`), `${rel} 이름의 해시가 내용과 다르다 — ${RERUN}`);
  }
  // 옛 해시 파일이 남지 않는다
  const served = fs.readdirSync(path.join(ROOT, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).map((f) => `assets/fonts/${f}`).sort();
  assert.deepEqual(served, urls);
});
