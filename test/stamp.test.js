// 배포 판본 주소(CHM-75, tools/stamp.mjs): index.html의 style.css · src/ 주소만 v/<판본>/을 얻고 나머지는 그대로인가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampHtml, stampCss, buildId, stamp, STATIC } from '../tools/stamp.mjs';
import { currentBlock, preloadBlock } from '../tools/preload.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const ID = 'abc123def0';

test('판본 주소: style.css · src/ 주소 전부가 v/<판본>/을 얻고 다른 줄은 그대로', () => {
  const out = stampHtml(html, ID);
  const a = html.split('\n'), b = out.split('\n');
  assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) { assert.doesNotMatch(a[i], /(href|src)="(src\/|style\.css)/, a[i]); continue; }
    changed++;
    assert.equal(b[i].replace(`v/${ID}/`, ''), a[i]);
  }
  const srcRefs = [...html.matchAll(/(?:href|src)="src\//g)].length;
  assert.ok(srcRefs > 100, `src 주소 ${srcRefs}`);
  assert.equal(changed, srcRefs + 1); // + style.css
  assert.match(out, new RegExp(`<script type="module" src="v/${ID}/src/main.js">`));
  assert.match(out, /href="manifest\.webmanifest"/);
  assert.match(out, /href="assets\/icons\/icon-192\.png"/);
});

test('판본 주소: 미리 받기 줄은 판본을 떼면 지금 그래프와 같다', () => {
  const block = currentBlock(stampHtml(html, ID));
  assert.ok(block);
  assert.equal(block.replaceAll(`v/${ID}/`, ''), preloadBlock());
});

test('판본 주소: 두 번 붙이지 않고 이상한 판본 이름은 받지 않는다', () => {
  assert.throws(() => stampHtml(stampHtml(html, ID), ID), /이미/);
  assert.throws(() => stampHtml(html, '../x'));
  assert.throws(() => stampHtml('<p>no refs</p>', ID), /없다/);
});

test('판본 주소: 글꼴 preload와 판본 style.css가 가리키는 글꼴이 같은 URL이다', () => {
  const page = 'https://chainmate.papercut.kr/';
  const out = stampHtml(html, ID);
  const preloads = [...out.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map((m) => new URL(m[1], page).href);
  const cssUrl = new URL(out.match(/rel="stylesheet" href="([^"]+)"/)[1], page);
  const fonts = [...stampCss(css).matchAll(/url\("([^"]+)"\)/g)].map((m) => new URL(m[1], cssUrl).href);
  assert.ok(fonts.length >= 2);
  assert.deepEqual(preloads.sort(), fonts.sort());
  for (const f of fonts) assert.match(f, /^https:\/\/chainmate\.papercut\.kr\/assets\/fonts\//);
});

test('판본 주소: 판본은 src · style.css 내용으로 정해지고 빌드는 저장소 파일을 건드리지 않는다', () => {
  assert.match(buildId(), /^[0-9a-f]{10}$/);
  assert.equal(buildId(), buildId());
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-'));
  try {
    const id = stamp({ out });
    for (const f of STATIC) assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.equal(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), stampHtml(html, id));
    assert.equal(fs.readFileSync(path.join(out, 'src/main.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8'));
    assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), html);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
  assert.throws(() => stamp({ out: ROOT }), /루트/);
});
