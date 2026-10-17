// 글자 폭 · 줄 바꿈 · 숫자 글 캐시(CHM-75): 캐시를 거쳐도 거치지 않은 것과 같은 값, 글자 캐시를 비우면 다시 잰다, 돌려준 줄을 고쳐도 캐시는 그대로
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, text, gfx, surface, lang, LL, parts;
let unit = 6;
before(async () => {
  dom = await installDom();
  surface = await import('../src/render/surface.js');
  text = await import('../src/render/text.js');
  gfx = await import('../src/render/gfx.js');
  lang = await import('../src/ui/lang.js');
  LL = await import('../src/render/layoutlog.js');
  parts = await import('../src/ui/parts.js');
});
after(() => { text.clearTextCache(); surface.setCanvasFactory(null); lang.setLang('ko'); });
beforeEach(() => {
  unit = 6;
  surface.setCanvasFactory((w, h) => ({ width: w, height: h, getContext: () => ({ font: '', measureText: (s) => ({ width: [...String(s)].length * unit }) }) }));
  text.clearTextCache();
});

test('숫자 글: 값마다 한 번 만들어도 같은 글(-0 · 큰 수 · 소수 · 수 아닌 것 포함)', () => {
  const raw = (n) => { if (!isFinite(n)) return '∞'; const v = Math.floor(n); if (Math.abs(v) >= 1e15) return v.toExponential(2).replace('+', ''); return v.toLocaleString('en-US'); };
  for (const n of [0, -0, 1, 999, 1234, -5678.9, 1e15, 2.5e17, Infinity, NaN, '42', undefined]) {
    assert.equal(gfx.num(n), raw(n), String(n));
    assert.equal(gfx.num(n), raw(n), `${String(n)} 두 번째`);
  }
  assert.equal(gfx.short(1234567), '1.2M');
  assert.equal(gfx.short(1234567), '1.2M');
  assert.equal(gfx.short(-0), gfx.short(-0));
  assert.equal(gfx.short(7.25), '7.3');
});

test('폭: 캐시를 비우면(글꼴이 옴) 새로 잰다 · 비운 횟수가 늘어난다', () => {
  assert.equal(text.textWidth('가나다'), 18);
  unit = 7;
  assert.equal(text.textWidth('가나다'), 18, '같은 글은 캐시에서');
  const g = text.textGen();
  text.clearTextCache();
  assert.equal(text.textGen(), g + 1);
  assert.equal(text.textWidth('가나다'), 21);
});

test('줄 바꿈: 돌려준 줄을 고쳐도 다음 결과는 그대로', () => {
  const a = text.wrap('하나 둘 셋 넷 다섯 여섯', 40);
  const copy = [...a];
  a.push('덧붙임'); a[0] = 'x';
  assert.deepEqual(text.wrap('하나 둘 셋 넷 다섯 여섯', 40), copy);
  const nm = parts.wrapName('하나 둘', 20);
  nm.lines.push('x');
  assert.deepEqual(parts.wrapName('하나 둘', 20).lines, ['하나', '둘']);
});

test('줄 바꿈: 레이아웃 기록 중에는 캐시를 거치지 않아 끊긴 낱말이 매번 적힌다', () => {
  text.wrap('가나다라마바사아자차', 30);
  LL.LOG.on = true;
  try {
    for (let k = 0; k < 2; k++) {
      LL.logBegin();
      text.wrap('가나다라마바사아자차', 30);
      assert.equal(LL.LOG.clips.filter((c) => c.kind === 'char').length, 1, `${k}번째 프레임`);
    }
  } finally { LL.LOG.on = false; }
});
