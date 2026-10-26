// 창 끝 비움은 iOS 사파리에만(P-1): 안드로이드 크롬 가로는 비우지 않아 꽉 채움이 정수 배율 이상, 아이폰 사파리는 창 위 · 아래 끝에서 12
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

async function fitOn(ua, width, height, dpr) {
  const dom = await installDom({ width, height, dpr });
  dom.window.matchMedia = (q) => ({ matches: /coarse/.test(q) });
  dom.window.navigator = { userAgent: ua, maxTouchPoints: 5 };
  const { boot } = await import(`../src/main.js?${ua.length}-${width}`);
  await boot({ window: dom.window, document: dom.document });
  return dom.window.__fit;
}

test('안드로이드 크롬 가로 915×412@2.625: 비움 없이 꽉 채움 K 4', async () => {
  const f = await fitOn(ANDROID, 915, 412, 2.625);
  assert.equal(f.k, 4);
});

test('아이폰 사파리 가로 734×343@3: 캔버스가 창 위 · 아래 끝에서 12 이상', async () => {
  const f = await fitOn(IPHONE, 734, 343, 3);
  assert.ok(f.canvas.top >= 12 && f.canvas.top + f.canvas.height <= 343 - 12, JSON.stringify(f.canvas));
});

test('마우스 기기 맥북 전체 화면 1470×956@2: 꽉 채움 뒷면이 기기 화소 그대로(j 1, P-4) · 손가락 기기는 상한 5', async () => {
  const dom = await installDom({ width: 1470, height: 956, dpr: 2 });
  dom.window.navigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 };
  const { boot } = await import('../src/main.js?mac');
  await boot({ window: dom.window, document: dom.document });
  const f = dom.window.__fit;
  assert.ok(f.k > 6 && f.n === f.k, `k ${f.k} n ${f.n}`);
  const { chooseFit, FILL_CAP } = await import('../src/ui/fit.js');
  assert.ok(chooseFit({ vw: 1470, vh: 956, dpr: 2, coarse: true, fill: true, cap: FILL_CAP }).n < 6);
});

test('화면 비율만 바뀌면(다른 모니터로 옮김) 다시 맞춘다 · 배율이 바뀌면 옛 배율 굽기를 버린다(P-7 · P-17)', async () => {
  const dom = await installDom({ width: 1280, height: 720, dpr: 1 });
  const fns = [];
  dom.window.matchMedia = (q) => ({ matches: false, media: q, addEventListener: (t, fn) => fns.push(fn), removeEventListener: () => {} });
  const { boot } = await import('../src/main.js?dpr');
  const app = await boot({ window: dom.window, document: dom.document });
  const k0 = dom.window.__fit.k;
  const { bake } = await import('../src/render/vec.js');
  const first = bake('t', 4, 4, app.scale, () => {});
  assert.equal(bake('t', 4, 4, app.scale, () => {}), first, '같은 배율은 캐시');
  dom.window.devicePixelRatio = 2;
  fns.splice(0).forEach((fn) => fn());
  assert.ok(Math.abs(dom.window.__fit.k - k0 * 2) < 0.05, `새 dpr로 다시 맞춤 ${k0} → ${dom.window.__fit.k}`);
  assert.ok(fns.length >= 1, '새 dpr 질의를 다시 건다');
  assert.notEqual(bake('t', 4, 4, 2, () => {}), first, '배율이 바뀌면 굽기를 버린다');
});
