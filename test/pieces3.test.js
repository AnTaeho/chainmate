// 벡터 기물(안 3, docs/design-notes/art3.md): 모든 기물 · 사물이 한 길(pieces3.js)로 그려지고, 판 밖은 정면 그림을 상자에 맞춘다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom } from './helpers/dom.js';

let P3, B3, gfx, look, PIECES;
before(async () => {
  await installDom();
  P3 = await import('../src/render/pieces3.js');
  B3 = await import('../src/render/board3.js');
  gfx = await import('../src/render/gfx.js');
  look = await import('../src/render/look.js');
  ({ PIECES } = await import('../src/data/pieces.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });

const withN = (n, fn) => { const keep = look.LOOK.n; look.LOOK.n = n; try { return fn(); } finally { look.LOOK.n = keep; } };
function rec(scale = null) {
  const calls = [];
  const base = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000' };
  if (scale != null) base.getTransform = () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
  const ctx = new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, calls };
}

test('data의 기물은 모두 제 벡터 모양(사물은 판 위 그림)이 있고, 뺀 기물은 바탕 기물로', () => {
  for (const t of Object.keys(PIECES)) {
    assert.equal(P3.artOf(t), t, t);
    assert.ok(P3.SHAPES.has(t) || B3.THINGS.has(t), t);
  }
  for (const t of ['A', 'C', 'H', 'G', '?']) assert.equal(P3.artOf(t), 'P', t);
  assert.equal(gfx.artOf, P3.artOf);
});

test('Path2D를 쓰지 않는다(연기 시험의 가짜 캔버스에 없다)', () => {
  for (const f of ['src/render/pieces3.js', 'src/render/board3.js']) assert.ok(!/Path2D/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')), f);
});

test('pieceCanvas: 크기 w · 배율 n에 맞춰 굽고, 열쇠가 다르면 다른 그림', () => {
  const a = P3.pieceCanvas('L', 'w', { n: 1, w: 22 }), b = P3.pieceCanvas('L', 'w', { n: 3, w: 22 }), c = P3.pieceCanvas('L', 'w', { n: 3, w: 11 });
  assert.ok(Math.abs(b.cv.width - a.cv.width * 3) <= 3);
  assert.ok(Math.abs(c.cv.width * 2 - b.cv.width) <= 2);
  assert.ok(Math.abs(a.w - b.w) <= 1 && a.ox === b.ox && a.oy === b.oy);
  assert.equal(P3.pieceCanvas('L', 'w', { n: 1, w: 22 }), a);
  for (const side of ['w', 'b', 'g', 's', 'q']) for (const t of [...P3.SHAPES]) assert.ok(P3.pieceCanvas(t, side, { n: 2 }).cv.width > 0, `${t}${side}`);
  for (const eng of ['gold', 'glass', 'ebony']) assert.notEqual(P3.pieceCanvas('W', 'w', { eng, n: 2 }), P3.pieceCanvas('W', 'w', { n: 2 }));
});

test('gfx.sprite: 16 × 22 상자 안에 벡터 기물 하나 — 받침 아래가 상자 아래, 가로 가운데, 기기 화소 자리', () => {
  for (const n of [1, 2, 3]) withN(n, () => {
    for (const t of ['P', 'K', 'L', 'M', 'D', 'W']) {
      const { ctx, calls } = rec();
      gfx.sprite(ctx, t, 'b', 40, 30, { tier: 3, soul: 'echo', awake: true });
      const img = calls.filter((c) => c[0] === 'drawImage');
      const body = img[img.length - 1], [, cv, x, y, w, h] = body;
      assert.ok(cv.width > 0);
      assert.ok(Math.abs(x + w / 2 - 48) <= 1, `${t} N ${n} 가운데 ${x} ${w}`);
      assert.ok(x >= 40 - 3 && x + w <= 56 + 3 && y >= 30 - 4 && y + h <= 52 + 4, `${t} N ${n} ${body.slice(2)}`);
      for (const c of img) assert.ok(c.slice(2, 4).every((v) => Number.isInteger(v * n)), `${t} N ${n} ${c.slice(2)}`);
      const half = calls.filter((c) => c[0] === 'fillRect' && c.slice(1).some((v) => v % 1));
      assert.equal(half.length, 0);
    }
  });
});

test('1배 오프스크린에 그리면 N이 3이어도 1배로 굽는다(타이틀 시연 판)', () => {
  withN(3, () => {
    const a = rec(1), b = rec(3);
    gfx.sprite(a.ctx, 'K', 'w', 0, 0); gfx.sprite(b.ctx, 'K', 'w', 0, 0);
    const wa = a.calls.find((c) => c[0] === 'drawImage')[1].width, wb = b.calls.find((c) => c[0] === 'drawImage')[1].width;
    assert.ok(Math.abs(wb - wa * 3) <= 3, `${wa} ${wb}`);
  });
});

test('조각은 16 × 22 칸 안의 자리(특수 기물 · 사물 포함)', () => {
  for (const t of Object.keys(PIECES)) {
    const chips = P3.pieceChips(t, t === 'V' ? 'g' : 'b');
    assert.ok(chips.length > 20, t);
    for (const c of chips) assert.ok(c.x >= 0 && c.x < 16 && c.y >= 0 && c.y < 22 && Number.isInteger(c.x) && typeof c.col === 'string', t);
  }
});

test('판 위 사물: 벽은 칸 마름모 안에 선 낮은 덩이, 보석은 칸 가운데 — 칸마다 같은 그림 하나', () => {
  const g = B3.geo(), wall = B3.thingImage('X', 2), gem = B3.thingImage('J', 2);
  assert.ok(wall.w <= g.hw * 2 + 6 && wall.h >= 8, `${wall.w} ${wall.h}`);
  assert.ok(gem.w < wall.w + 2);
  assert.equal(B3.thingImage('X', 2), wall);
  const { ctx, calls } = rec(2);
  withN(2, () => { P3.piece3(ctx, 'X', 'b', 100, 100); P3.piece3(ctx, 'J', 'b', 120, 100); });
  const img = calls.filter((c) => c[0] === 'drawImage');
  assert.deepEqual(img.map((c) => c[1]), [wall.cv, gem.cv]);
});
