// 안 3 벡터(docs/design-notes/art3.md): 주사위 · 종류 문양 · 꾸러미 봉투 · 행마 그림이 (그림, 크기, 배율 N)마다 한 번 구운 그림 하나를 정수 칸에 붙인다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom } from './helpers/dom.js';

let D, K, E, G;
before(async () => {
  await installDom();
  D = await import('../src/render/dice.js');
  K = await import('../src/ui/kinds.js');
  E = await import('../src/ui/envelope.js');
  G = await import('../src/ui/diagram.js');
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
const images = (calls) => calls.filter((c) => c[0] === 'drawImage').map(([, c, ...r]) => [c.width, c.height, ...r]);

test('Path2D를 쓰지 않는다', () => {
  for (const f of ['src/render/dice.js', 'src/ui/kinds.js', 'src/ui/envelope.js', 'src/ui/diagram.js']) assert.ok(!/Path2D/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')), f);
});

test('주사위: 배율 N의 그림 하나를 7×7 자리에, 같은 빛깔 · 배율은 한 번만 굽는다', () => {
  for (const n of [1, 2, 3]) {
    const r = rec(n);
    D.diceIcon(r.ctx, 10, 20, '#f2ead8');
    assert.deepEqual(images(r.calls), [[7 * n, 7 * n, 10, 20, 7, 7]]);
  }
  assert.equal(D.diceCanvas('#f2ead8', 2), D.diceCanvas('#f2ead8', 2));
});

test('종류 문양: 열한 종류 모두 12×12 자리에 그림 하나, 딱지 · 띠 가운데', () => {
  for (const k of Object.keys(K.KIND)) for (const n of [1, 2, 3]) {
    const t = rec(n);
    K.kindTab(t.ctx, k, 10, 20);
    assert.deepEqual(images(t.calls), [[12 * n, 12 * n, 11, 21, 12, 12]], `${k} 딱지 ×${n}`);
    const b = rec(n);
    K.kindBand(b.ctx, k, 10, 20, 26);
    assert.deepEqual(images(b.calls), [[12 * n, 12 * n, 11, 27, 12, 12]], `${k} 띠 ×${n}`);
  }
  assert.notEqual(K.glyphCanvas('maxim', '#fff', 12, 2), K.glyphCanvas('chart', '#fff', 12, 2));
});

test('꾸러미 봉투: 그림 하나를 정수 칸에, 열리면 위로 솟을 자리만큼 크다 · 걸음마다 한 번 굽는다', () => {
  for (const n of [1, 2, 3]) for (const kind of Object.keys(E.ENV_COL)) {
    const h = rec(n);
    E.envelope(h.ctx, 10, 20, 28, 22, kind);
    E.envelope(h.ctx, 50, 20, 96, 66, kind, { open: 0.4 });
    E.envelope(h.ctx, 50, 20, 12, 10, kind, { open: 1, hover: true });
    assert.deepEqual(images(h.calls), [
      [28 * n, 22 * n, 10, 20, 28, 22],
      [96 * n, (66 + E.ENV_RISE) * n, 50, 20 - E.ENV_RISE, 96, 66 + E.ENV_RISE],
      [12 * n, (10 + E.ENV_RISE) * n, 50, 20 - E.ENV_RISE, 12, 10 + E.ENV_RISE],
    ], `${kind} ×${n}`);
  }
});

test('행마 그림: 그릴 수 있는 기물마다 DIAG_SIZE 그림 하나, 없는 것은 그리지 않는다', () => {
  assert.equal(G.DIAG_SIZE, 34);
  for (const t of 'PNBRQKZLOSWTEVMD') for (const n of [1, 3]) {
    const r = rec(n);
    G.moveDiagram(r.ctx, t, 5, 6);
    assert.deepEqual(images(r.calls), [[34 * n, 34 * n, 5, 6, 34, 34]], `${t} ×${n}`);
  }
  const r = rec(2);
  G.moveDiagram(r.ctx, 'X', 0, 0);
  assert.equal(r.calls.length, 0);
});
