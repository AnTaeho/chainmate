// 물건 종류 표시(CHM-37, docs/design-notes/layout.md 「종류 표시」): 진열 · 꾸러미 · 두루마리에 나오는 모든 물건 종류가
// 딱지 표(src/ui/kinds.js KIND)에 문양 · 빛깔을 가진다. 새 종류를 상점에 더하고 표를 잊으면 여기서 잡힌다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let K, P, S, RARITY;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  const dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  K = await import('../src/ui/kinds.js');
  P = await import('../src/ui/parts.js');
  S = await import('../src/sim/shop.js');
  ({ RARITY } = await import('../src/render/palette.js'));
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); });

// 픽셀을 적어 두는 가짜 그리기 판
const recorder = () => { const px = []; return { px, fillStyle: '', globalAlpha: 1, fillRect(x, y, w, h) { px.push({ x, y, w, h, c: this.fillStyle }); } }; };

test('종류 딱지: 진열 · 꾸러미 · 두루마리에 나오는 모든 종류가 문양 · 빛깔을 가진다', () => {
  const shown = new Set([
    ...Object.keys(P.ITEM_KIND),                // 카드 머릿말이 이름을 붙이는 종류
    ...S.SHOP.kindWeights.map(([k]) => k),      // 진열 칸 무게
    'awaken', 'fragment',                       // 금 간 혼이 있을 때 · 명경기 조각
  ]);
  for (const k of shown) {
    const e = K.KIND[k];
    assert.ok(e, `${k}: 딱지 표에 없다`);
    assert.match(e.col, /^#[0-9a-f]{6}$/, `${k} 문양 빛깔`);
    assert.match(e.bg, /^#[0-9a-f]{6}$/, `${k} 바탕 빛깔`);
    assert.equal(e.g.length, 12, `${k} 문양 줄 수`);
    for (const row of e.g) assert.match(row, /^[.#]{12}$/, `${k} 문양 줄 「${row}」`);
    assert.ok(e.g.join('').includes('#'), `${k} 빈 문양`);
  }
  // 표에만 있고 아무 데도 안 나오는 종류는 없다
  for (const k of Object.keys(K.KIND)) assert.ok(shown.has(k), `${k}: 나오지 않는 종류`);
  // 꾸러미(봉투)도 안에 든 종류의 딱지를 쓴다
  for (const pk of [...S.SHOP.packKinds, 'golden']) assert.ok(K.KIND[K.PACK_KIND[pk]], `꾸러미 ${pk}`);
});

test('종류 딱지: 문양끼리 · 빛깔끼리 갈린다, 혼은 드묾 등급 빛깔과 멀다', () => {
  const ks = Object.keys(K.KIND);
  const glyphs = new Set(ks.map((k) => K.KIND[k].g.join('')));
  assert.equal(glyphs.size, ks.length, '같은 문양');
  const cols = new Set(ks.map((k) => K.KIND[k].col));
  assert.equal(cols.size, ks.length, '같은 문양 빛깔');
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  assert.equal(K.KIND.soul.col, K.KIND_SOUL);
  assert.ok(dist(K.KIND_SOUL, RARITY.uncommon) > 100, `혼 ${K.KIND_SOUL} · 드묾 ${RARITY.uncommon} 거리 ${dist(K.KIND_SOUL, RARITY.uncommon).toFixed(0)}`);
});

test('종류 딱지 · 띠: 정한 네모 밖에 그리지 않는다', () => {
  for (const k of Object.keys(K.KIND)) {
    const c = recorder();
    K.kindTab(c, k, 10, 20);
    assert.ok(c.px.every((p) => p.x >= 10 && p.y >= 20 && p.x + p.w <= 10 + K.TAB && p.y + p.h <= 20 + K.TAB), `${k} 딱지`);
    assert.ok(c.px.some((p) => p.c === K.KIND[k].col) && c.px.some((p) => p.c === K.KIND[k].bg), `${k} 딱지 빛깔`);
    const b = recorder();
    K.kindBand(b, k, 10, 20, 26);
    assert.ok(b.px.every((p) => p.x >= 10 && p.y >= 20 && p.x + p.w <= 10 + K.BAND && p.y + p.h <= 20 + 26), `${k} 띠`);
  }
});
