// 미리 받기 줄(CHM-75, tools/preload.mjs): index.html의 줄이 지금의 정적 import 그래프 · 글꼴과 같은가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticGraph, preloadBlock, currentBlock } from '../tools/preload.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('미리 받기: index.html의 줄이 src/main.js의 정적 import 그래프 · style.css 글꼴과 같다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const block = currentBlock(html);
  assert.ok(block, 'index.html에 미리 받기 표시가 없다');
  assert.equal(block, preloadBlock(), '모듈 · 글꼴이 바뀌었다 — `node tools/preload.mjs`로 다시 쓴다');
});

test('미리 받기: 그래프의 파일이 모두 있고 import()로만 부르는 소리 모듈은 뺀다', () => {
  const graph = staticGraph();
  assert.equal(graph[0], 'src/main.js');
  for (const f of graph) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  assert.ok(!graph.includes('src/audio/audio.js'));
});
