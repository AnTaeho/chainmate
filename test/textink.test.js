// 글자 세로 자리 보정(docs/design-notes/layout.md 「글자 세로 자리 보정」): 글자 그림은 브라우저의 'top' 기준선이 어디든 같은 줄에 서고,
// 그림 칸 안의 큰 글자는 잰 잉크 높이로 가운데에 놓인다. 색은 hsl(…)도 읽는다(도박 카드 「?」가 검정으로 나오던 것)
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

// 잉크를 그리는 가짜 캔버스: fillText(y)의 잉크가 y − 1 + drop 줄부터 rows줄(크로미움은 drop 0 — y = 1이면 0번째 줄, Safari는 2)
function inkFactory(drop, calls, rows = 11) {
  return (w, h) => {
    const c = { width: w, height: h, ink: null };
    const ctx = {
      canvas: c, font: '', fillStyle: '#000', textBaseline: 'top', imageSmoothingEnabled: false,
      measureText: (s) => ({ width: [...String(s)].length * 6 }),
      fillText(s, x, y) { c.ink = y - 1 + drop; calls.push({ s, y, font: this.font }); },
      getImageData(x, y, ww, hh) {
        const d = new Uint8ClampedArray(ww * hh * 4);
        if (c.ink !== null) for (let r = Math.max(0, c.ink); r < Math.min(hh, c.ink + rows); r++) for (let i = 0; i < ww; i++) d[(r * ww + i) * 4 + 3] = 255;
        return { data: d, width: ww, height: hh };
      },
      putImageData(img) { c.put = img; },
      drawImage() {},
    };
    c.getContext = () => ctx;
    return c;
  };
}
const topRow = (img) => { const d = img.c.put.data, w = img.c.width; for (let y = 0; y < img.c.height; y++) if (d[y * w * 4 + 3]) return y; return -1; };

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

test('보정: 잉크를 못 재는 가짜 캔버스에서는 0(fillText y = 1) · 잉크 상자는 0 ~ 10줄', () => {
  const calls = [];
  surface.setCanvasFactory((w, h) => {
    const c = dom.document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillText = (s, x, y) => calls.push({ s, y });
    return c;
  });
  const img = text.textImage('?', 'hsl(200,70%,70%)', true);
  assert.equal(calls.find((c) => c.s === '?').y, 1);
  assert.deepEqual(text.inkBox(img), { top: 0, bottom: 10, h: 11 });
});

test('보정: 기준선이 같은 브라우저(크로미움)에서는 그리는 자리가 그대로다', () => {
  const calls = [];
  surface.setCanvasFactory(inkFactory(0, calls));
  const img = text.textImage('가', '#ffffff', false);
  assert.equal(calls.find((c) => c.s === '가').y, 1);
  assert.equal(topRow(img), 0);
});

test('보정: 2px 아래에 그리는 브라우저(Safari)에서도 잉크가 같은 줄에 선다 · 굵기마다 한 번만 잰다', () => {
  for (const drop of [2, -1, 5]) {
    text.clearTextCache();
    const calls = [];
    surface.setCanvasFactory(inkFactory(drop, calls));
    for (const [s, bold] of [['가', false], ['A', false], ['?', true], ['$4', true]]) {
      const img = text.textImage(s, '#ffffff', bold);
      assert.equal(calls.filter((c) => c.s === s).pop().y, 1 - drop, `${s} drop ${drop}`);
      assert.equal(topRow(img), 0, `${s} drop ${drop}`);
      assert.deepEqual(text.inkBox(img), { top: 0, bottom: 10, h: 11 });
    }
    assert.equal(calls.filter((c) => c.s === '가A').length, 2, '기준 글자는 보통 · 굵게 한 번씩');
  }
});

test('보정: 글꼴이 오기 전에는 재지 않고, 온 뒤에 캐시를 비우고 잰다', () => {
  const calls = [];
  let ready = false;
  dom.document.fonts.check = () => ready;
  surface.setCanvasFactory(inkFactory(2, calls));
  const early = text.textImage('가', '#ffffff', false);
  assert.equal(calls.filter((c) => c.s === '가A').length, 0);
  assert.equal(calls.filter((c) => c.s === '가').pop().y, 1);
  ready = true;
  const late = text.textImage('가', '#ffffff', false);
  assert.notEqual(late, early, '글꼴이 오기 전의 글자 그림은 버린다');
  assert.equal(calls.filter((c) => c.s === '가').pop().y, -1);
  assert.equal(topRow(late), 0);
});

test('가운데: textMid가 높이 26 칸 안에 2배 「?」를 위아래 2px 여백으로 놓는다', () => {
  for (const drop of [0, 2]) {
    text.clearTextCache();
    surface.setCanvasFactory(inkFactory(drop, []));
    const drawn = [];
    const ctx = { globalAlpha: 1, drawImage: (c, x, y, w, h) => drawn.push({ x, y, w, h }) };
    gfx.textMid(ctx, '?', 100, 46, 26, 'hsl(10,70%,70%)', { align: 'center', bold: true, scale: 2 });
    // 잉크 0 ~ 10줄 × 2 = 22px → 그림의 위가 48, 잉크 48 ~ 69(칸 46 ~ 71)
    assert.equal(drawn[0].y, 48, `drop ${drop}`);
  }
  // 잉크가 낮고 짧은 글자(3 ~ 8줄, 6줄)도 잉크가 가운데다: 2배 12px → 위 여백 7 → 그림의 위 = 46 + 7 − 3 × 2
  text.clearTextCache();
  const short = inkFactory(3, [], 6);
  surface.setCanvasFactory((w, h) => { const c = short(w, h); const ctx = c.getContext(); const ft = ctx.fillText; ctx.fillText = function (s, x, y) { ft.call(this, s, x, s === '가A' ? y - 3 : y); }; return c; });
  const drawn = [];
  gfx.textMid({ globalAlpha: 1, drawImage: (c, x, y) => drawn.push(y) }, 'o', 0, 46, 26, '#ffffff', { scale: 2 });
  assert.equal(drawn[0], 47);
});
