// 벡터 문장 · 초상(안 3, docs/design-notes/art3.md): 모든 세력 · 마스터가 제 그림을 갖고, 배율마다 한 번 구워 정수 칸에 붙인다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let crests, portraits, FACTIONS, MASTERS;
before(async () => {
  await installDom();
  crests = await import('../src/render/crests.js');
  portraits = await import('../src/render/portraits.js');
  ({ FACTIONS } = await import('../src/data/factions.js'));
  ({ MASTERS } = await import('../src/data/masters.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });

function rec(scale) {
  const calls = [];
  const base = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000', getTransform: () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 }) };
  const ctx = new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, calls };
}
const images = (calls) => calls.filter((c) => c[0] === 'drawImage');

test('문장: 세력마다 제 문장이 있고, 배율 N마다 12 × scale 자리를 N배로 구운 그림 하나를 정수 칸에', () => {
  for (const f of FACTIONS) assert.ok(crests.CREST_IDS.includes(f.crest), f.id);
  for (const f of FACTIONS) for (const n of [1, 2, 3]) for (const scale of [1, 2]) for (const dim of [false, true]) {
    const { ctx, calls } = rec(n);
    crests.drawCrest(ctx, f.id, 10.4, 20.6, { scale, dim });
    const im = images(calls);
    assert.equal(im.length, 1, `${f.id} n${n}`);
    const [, cv, x, y, w, h] = im[0];
    assert.deepEqual([x, y, w, h], [10, 21, 12 * scale, 12 * scale]);
    assert.deepEqual([cv.width, cv.height], [12 * scale * n, 12 * scale * n]);
    assert.ok(!calls.some((c) => c[0] === 'fillRect'), '도트 fillRect 없음');
  }
});

test('문장: 같은 세력 · 배율이면 한 번만 굽는다, 흐림은 따로', () => {
  const a = rec(2), b = rec(2), c = rec(2);
  crests.drawCrest(a.ctx, FACTIONS[0].id, 0, 0);
  crests.drawCrest(b.ctx, FACTIONS[0].id, 5, 5);
  crests.drawCrest(c.ctx, FACTIONS[0].id, 0, 0, { dim: true });
  assert.equal(images(a.calls)[0][1], images(b.calls)[0][1]);
  assert.notEqual(images(a.calls)[0][1], images(c.calls)[0][1]);
});

test('초상: 마스터마다 제 그림, 32 × scale 자리를 N배로 구운 그림 하나', () => {
  const ids = new Set(portraits.PORTRAIT_IDS);
  for (const m of MASTERS) assert.ok(ids.has(m.id), m.id);
  for (const id of portraits.PORTRAIT_IDS) for (const n of [1, 2, 3]) for (const scale of [1, 2, 4]) {
    const { ctx, calls } = rec(n);
    portraits.drawPortrait(ctx, id, 3, 4, scale, 0.5);
    const im = images(calls);
    assert.equal(im.length, 1, `${id} n${n} ×${scale}`);
    const [, cv, x, y, w, h] = im[0];
    assert.deepEqual([x, y, w, h], [3, 4, 32 * scale, 32 * scale]);
    assert.deepEqual([cv.width, cv.height], [32 * scale * n, 32 * scale * n]);
  }
  assert.deepEqual([portraits.portraitCanvas('fog', true).width, portraits.portraitCanvas('fog', false).width], [64, 32]);
});
