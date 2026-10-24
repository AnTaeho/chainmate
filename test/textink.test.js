// 글자 세로 자리 보정(docs/design-notes/layout.md 「글자 세로 자리 보정」): 기준선은 'alphabetic', 기준 글자 「가A」의 잉크(measureText actualBoundingBox)를
// 글자 띠(11줄) 가운데에 놓는다. 글자 그림은 그리는 곳의 화소 배율로 굽고, 그림 칸 안의 큰 글자는 잰 잉크 높이로 가운데에 놓인다. 색은 hsl(…)도 읽는다
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, text, gfx, pal, surface;
before(async () => {
  dom = await installDom();
  surface = await import('../src/render/surface.js');
  text = await import('../src/render/text.js');
  gfx = await import('../src/render/gfx.js');
  pal = await import('../src/render/palette.js');
});
after(() => { text.clearTextCache(); surface.setCanvasFactory(null); });
beforeEach(() => { text.clearTextCache(); surface.setCanvasFactory(() => dom.document.createElement('canvas')); delete dom.document.fonts.check; });

// 잉크를 재는 가짜 캔버스: measureText가 잉크 위 asc · 아래 desc(글꼴 크기에 비례, 12px 기준)를 돌려주고, fillText(기준선 y)의 잉크를 그 줄들에 칠한다
function inkFactory(asc, desc, calls) {
  return (w, h) => {
    const c = { width: w, height: h, ink: null };
    const px = (f) => Number((String(f).match(/([\d.]+)px/) || [0, 12])[1]) / 12;
    const ctx = {
      canvas: c, font: '', fillStyle: '#000', textBaseline: 'top', imageSmoothingEnabled: false,
      measureText(s) { const k = px(this.font); return { width: [...String(s)].length * 6 * k, actualBoundingBoxAscent: asc * k, actualBoundingBoxDescent: desc * k }; },
      fillText(s, x, y) { const k = px(this.font); c.ink = [Math.round(y - asc * k), Math.round(y + desc * k)]; calls.push({ s, y, font: this.font, base: this.textBaseline }); },
      getImageData(x, y, ww, hh) {
        const d = new Uint8ClampedArray(ww * hh * 4);
        if (c.ink) for (let r = Math.max(0, c.ink[0]); r < Math.min(hh, c.ink[1]); r++) for (let i = 0; i < ww; i++) d[(r * ww + i) * 4 + 3] = 255;
        return { data: d, width: ww, height: hh };
      },
      drawImage() {}, scale() {}, setTransform() {}, fillRect() {},
    };
    c.getContext = () => ctx;
    return c;
  };
}

test('색: rgb가 16진 색을 예전처럼 읽는다', () => {
  assert.deepEqual(pal.rgb('#1b2b27'), [0x1b, 0x2b, 0x27]);
  assert.deepEqual(pal.rgb('#ffffff'), [255, 255, 255]);
});

test('색: rgb가 hsl(h,s%,l%)을 읽는다(브라우저가 칠하는 색과 같은 값)', () => {
  assert.deepEqual(pal.rgb('hsl(0,70%,70%)'), [232, 125, 125]);
  assert.deepEqual(pal.rgb('hsl(120,70%,70%)'), [125, 232, 125]);
  assert.deepEqual(pal.rgb('hsl(240,70%,70%)'), [125, 125, 232]);
  assert.deepEqual(pal.rgb('hsl(40,85%,60%)'), [240, 182, 66]);
  assert.deepEqual(pal.rgb('hsl(360, 90%, 65%)'), pal.rgb('hsl(0,90%,65%)'));
  // 돌아가는 색 어느 것도 검정이 아니다
  for (let h = 0; h < 360; h += 10) assert.ok(pal.rgb(`hsl(${h},70%,70%)`).every((v) => v >= 100 && v <= 255), `hue ${h}`);
});

test('보정: 잉크를 못 재는 가짜 캔버스에서는 type.js의 잰 값으로 · 잉크 상자는 글자 띠(0 ~ 10줄)', async () => {
  const { FACE, INK_H } = await import('../src/render/type.js');
  const calls = [];
  surface.setCanvasFactory((w, h) => {
    const c = dom.document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillText = (s, x, y) => calls.push({ s, y });
    return c;
  });
  const img = text.textImage('?', 'hsl(200,70%,70%)', true);
  const [asc, desc] = FACE.bold.ink;
  assert.equal(calls.find((c) => c.s === '?').y, Math.round(2 + (INK_H - asc - desc) / 2 + asc));
  assert.deepEqual(text.inkBox(img), { top: 0, bottom: 10, h: 11 });
});

test('보정: 기준 글자의 잉크가 글자 띠(text()의 y부터 11줄) 가운데에 선다 · 굵기마다 한 번만 잰다', () => {
  for (const [asc, desc] of [[9, 1], [9, 0], [7, 2]]) {
    text.clearTextCache();
    const calls = [];
    surface.setCanvasFactory(inkFactory(asc, desc, calls));
    for (const [s, bold] of [['가', false], ['A', false], ['?', true], ['$4', true]]) {
      const img = text.textImage(s, '#ffffff', bold);
      const last = calls.filter((c) => c.s === s).pop();
      assert.equal(last.base, 'alphabetic');
      const ink = text.inkBox(img);
      // 잉크 위아래 여백이 같다(띠 11 − 잉크 높이를 반씩, 정수 화소로 1 안)
      assert.ok(Math.abs(ink.top - (11 - asc - desc) / 2) <= 1, `${s} ${asc}/${desc} top ${ink.top}`);
      assert.equal(ink.h, asc + desc);
    }
  }
});

test('보정: 그리는 곳의 배율(k)로 굽는다 — 그림은 k배, 논리 크기 · 잉크 상자는 같다', () => {
  surface.setCanvasFactory(inkFactory(9, 1, []));
  const a = text.textImage('가', '#ffffff', false, 1), b = text.textImage('가', '#ffffff', false, 3);
  assert.notEqual(a, b);
  assert.equal(b.c.width, a.c.width * 3);
  assert.equal(b.c.height, a.c.height * 3);
  assert.equal(b.cw, a.cw);
  assert.equal(b.w, a.w);
  // 기준선은 그 배율의 화소에 맞추므로 잉크 자리는 1배 화소 반 안에서 같다
  for (const k of ['top', 'bottom', 'h']) assert.ok(Math.abs(text.inkBox(b)[k] - text.inkBox(a)[k]) <= 0.5, `${k} ${text.inkBox(b)[k]} ${text.inkBox(a)[k]}`);
  assert.equal(text.textImage('가', '#ffffff', false, 3), b, '같은 배율은 캐시');
});

test('보정: 글꼴이 오기 전에는 재지 않고, 온 뒤에 캐시를 비우고 잰다', () => {
  const calls = [];
  let ready = false;
  dom.document.fonts.check = () => ready;
  surface.setCanvasFactory(inkFactory(7, 2, calls));
  const early = text.textImage('가', '#ffffff', false);
  const earlyY = calls.filter((c) => c.s === '가').pop().y;
  ready = true;
  const late = text.textImage('가', '#ffffff', false);
  assert.notEqual(late, early, '글꼴이 오기 전의 글자 그림은 버린다');
  const lateY = calls.filter((c) => c.s === '가').pop().y;
  // 글꼴이 온 뒤 잰 잉크(7 · 2)로: 띠 위 2 + (11 − 9) / 2 + 7 = 10
  assert.equal(lateY, 10);
  assert.notEqual(earlyY, undefined);
});

test('가운데: textMid가 높이 26 칸 안에 2배 「?」의 잉크를 위아래 같은 여백으로 놓는다', () => {
  for (const [asc, desc] of [[9, 1], [8, 0]]) {
    text.clearTextCache();
    surface.setCanvasFactory(inkFactory(asc, desc, []));
    const drawn = [];
    const ctx = { globalAlpha: 1, drawImage: (c, x, y, w, h) => drawn.push({ x, y, w, h }) };
    gfx.textMid(ctx, '?', 100, 46, 26, 'hsl(10,70%,70%)', { align: 'center', bold: true, scale: 2 });
    const img = text.textImage('?', 'hsl(10,70%,70%)', true, 2), ink = text.inkBox(img);
    // 그림 위(drawn y) + (잉크 위 − 그림 위) × 2 = 잉크 위. 잉크 위 − 칸 위 ≈ (26 − 잉크 높이 × 2) / 2
    const inkTop = drawn[0].y + (ink.top - img.top) * 2;
    assert.ok(Math.abs(inkTop - 46 - (26 - ink.h * 2) / 2) <= 1, `${asc}/${desc}: ${inkTop}`);
  }
});
