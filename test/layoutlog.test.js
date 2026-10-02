// 잘린 글 기록(layoutlog.js logClip — docs/design-notes/layout.md 「잘린 글 검사」): fitText · wrap이 글을 줄이거나 자르면 기록하고,
// 안 자르면 기록하지 않는다. 기록기가 꺼져 있으면(게임) 아무것도 쌓이지 않는다
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let dom, LL, parts, text, ctx;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  LL = await import('../src/render/layoutlog.js');
  parts = await import('../src/ui/parts.js');
  text = await import('../src/render/text.js');
  ctx = dom.document.createElement('canvas').getContext('2d');
});
after(async () => { LL.LOG.on = false; const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); });
beforeEach(() => { LL.LOG.on = true; LL.logBegin(); });

const NAME = 'Cavalry Charge';

test('잘린 글: fitText가 들어가면 기록하지 않는다', () => {
  parts.fitText(ctx, NAME, 0, 0, text.textWidth(NAME, true), '#fff');
  assert.equal(LL.LOG.clips.length, 0);
});

test('잘린 글: 굵게는 안 들고 보통 굵기로 들면 「줄임」 하나', () => {
  const s = 'Welcome Party', w = text.textWidth(s, false); // 굵게 99 · 보통 95(smoke가 찾은 영어 격언 칸)
  assert.ok(w < text.textWidth(s, true));
  LL.openBox('card', 0, 0, 120, 28, 7, { name: '격언 welcome' });
  parts.fitText(ctx, s, 0, 0, w, '#fff');
  LL.closeBox();
  assert.equal(LL.LOG.clips.length, 1);
  const [c] = LL.LOG.clips;
  assert.deepEqual([c.kind, c.src, c.shown, c.w, c.box], ['thin', s, s, w, '격언 welcome']);
});

test('잘린 글: 보통 굵기로도 넘치면 「…」 하나 — 원문 · 그려진 글 · 폭', () => {
  parts.fitText(ctx, NAME, 0, 0, 50, '#fff');
  assert.equal(LL.LOG.clips.length, 1);
  const [c] = LL.LOG.clips;
  assert.equal(c.kind, 'cut');
  assert.equal(c.src, NAME);
  assert.ok(c.shown.endsWith('…') && NAME.startsWith(c.shown.slice(0, -1)), c.shown);
  assert.equal(c.w, 50);
  assert.equal(c.box, '');
  // 그려진 글이 기록된 글과 같다
  assert.equal(LL.LOG.texts.at(-1).s, c.shown);
});

test('잘린 글: wrap이 낱말을 글자 단위로 끊으면 「글자 끊김」, 낱말 단위면 없음', () => {
  text.wrap('Cavalry Charge', 60);
  assert.equal(LL.LOG.clips.length, 0);
  const lines = text.wrap('Grandmaster', 40);
  assert.ok(lines.length > 1);
  assert.equal(LL.LOG.clips.length, 1);
  assert.deepEqual([LL.LOG.clips[0].kind, LL.LOG.clips[0].src, LL.LOG.clips[0].shown], ['char', 'Grandmaster', lines.join(' / ')]);
});

test('잘린 글: 기록기가 꺼져 있으면 쌓지 않고, 프레임 처음에 비운다', () => {
  parts.fitText(ctx, NAME, 0, 0, 30, '#fff');
  assert.equal(LL.LOG.clips.length, 1);
  LL.logBegin();
  assert.equal(LL.LOG.clips.length, 0);
  LL.LOG.on = false;
  parts.fitText(ctx, NAME, 0, 0, 30, '#fff');
  text.wrap('Grandmaster', 40);
  assert.equal(LL.LOG.clips.length, 0);
});
