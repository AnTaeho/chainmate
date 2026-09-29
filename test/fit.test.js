// 화면 맞춤(src/ui/fit.js, docs/design-notes/layout.md 「화면 맞춤」): 여러 창 × dpr에서 배율 K · 뒷면 N · 자리 · 여백 판 · 세로 안내
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFit, backScale, GW, GH } from '../src/ui/fit.js';

// [이름, 창 w, h, dpr, 손가락, 기대 K, 기대 CSS w×h, 세로 안내]
const CASES = [
  ['아이폰 15 세로', 393, 659, 3, true, 2, '320×180', true],
  ['아이폰 15 가로(사파리)', 734, 343, 3, true, 3, '480×270', false],
  ['아이폰 15 가로(전체 화면)', 852, 393, 3, true, 4, '640×360', false],
  ['아이패드 세로', 810, 1080, 2, true, 3, '720×405', false],
  ['아이패드 가로', 1080, 810, 2, true, 4, '960×540', false],
  ['맥 1920×960', 1920, 960, 2, false, 7, '1680×945', false],
  ['맥북 에어 1470×956', 1470, 956, 2, false, 6, '1440×810', false],
  ['모니터 1280×720', 1280, 720, 1, false, 2, '960×540', false],
  ['모니터 1920×1080', 1920, 1080, 1, false, 4, '1920×1080', false],
  ['창 1366×700 dpr 1.25', 1366, 700, 1.25, false, 3, '1152×648', false],
  ['안드로이드 세로 360×740', 360, 740, 3, true, 2, '320×180', true],
  ['안드로이드 가로 740×360', 740, 360, 3, true, 4, '640×360', false],
  ['좁은 데스크톱 창 세로', 400, 800, 1, false, 400 / 480, '400×225', false],
];

for (const [name, vw, vh, dpr, coarse, k, css, turn] of CASES) {
  test(`화면 맞춤: ${name}`, () => {
    const f = chooseFit({ vw, vh, dpr, coarse });
    assert.equal(f.k, k);
    assert.equal(`${Math.round(f.canvas.width * 100) / 100}×${Math.round(f.canvas.height * 100) / 100}`, css);
    assert.equal(f.turn, turn);
    // 캔버스가 창 안에 든다
    assert.ok(f.canvas.left >= 0 && f.canvas.top >= 0);
    assert.ok(f.canvas.left + f.canvas.width <= vw + 1e-9 && f.canvas.top + f.canvas.height <= vh + 1e-9);
    if (Number.isInteger(k)) {
      // 자리는 기기 화소 정수(반 화소에 걸려 흐려지지 않는다), 크기는 기기 화소 480K × 270K
      assert.ok(Number.isInteger(Math.round(f.canvas.left * dpr * 1e6) / 1e6), `left ${f.canvas.left * dpr}`);
      assert.ok(Number.isInteger(Math.round(f.canvas.top * dpr * 1e6) / 1e6), `top ${f.canvas.top * dpr}`);
      assert.equal(Math.round(f.canvas.width * dpr), GW * k);
      // 여백 판: 창 끝까지 덮고, 도트 격자가 게임과 같다(게임 (0, 0) = 여백 판 (ox, oy))
      const p = f.pad;
      assert.ok(p.left <= 1e-9 && p.top <= 1e-9 && p.left + p.width >= vw - 1e-9 && p.top + p.height >= vh - 1e-9);
      assert.ok(Math.abs(p.left + (p.ox * k) / dpr - f.canvas.left) < 1e-9);
      assert.ok(Math.abs(p.top + (p.oy * k) / dpr - f.canvas.top) < 1e-9);
      assert.ok(p.cols >= p.ox + GW && p.rows >= p.oy + GH);
      // 뒷면 캔버스 배율은 1~4, K 이하
      assert.ok(f.n >= 1 && f.n <= 4 && f.n <= k);
    }
  });
}

test('뒷면 배율 N: K를 나누는 2~4 중 가장 큰 것, 없으면 min(K, 4)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(backScale), [1, 2, 3, 4, 4, 3, 4, 4, 3, 2, 4]);
  assert.equal(backScale(0.8), 1);
});

test('N이 K를 나누지 못해도 도트 하나는 기기 화소 K×K로 고르다(가장 가까운 화소 고르기)', () => {
  for (const k of [5, 7, 11]) {
    const n = backScale(k);
    // 기기 화소 j의 가운데가 가리키는 뒷면 화소 → 그 도트 번호가 floor(j / K)와 같다
    for (let j = 0; j < k * 40; j++) {
      const back = Math.floor(((j + 0.5) * n) / k);
      assert.equal(Math.floor(back / n), Math.floor(j / k));
    }
  }
});

test('안전 영역(노치)을 비켜 앉는다: 아이폰 가로 전체 화면, 좌우 59 · 아래 21', () => {
  const f = chooseFit({ vw: 852, vh: 393, dpr: 3, inset: { left: 59, right: 59, top: 0, bottom: 21 }, coarse: true });
  assert.equal(f.k, 4);
  assert.ok(f.canvas.left >= 59 && f.canvas.left + f.canvas.width <= 852 - 59);
  assert.ok(f.canvas.top + f.canvas.height <= 393 - 21);
  // 여백 판은 노치 뒤까지 창 전체
  assert.ok(f.pad.left <= 0 && f.pad.left + f.pad.width >= 852);
});

test('dpr 1 모니터는 예전과 같은 정수배 · 가운데', () => {
  const f = chooseFit({ vw: 1280, vh: 720, dpr: 1 });
  assert.deepEqual(f.canvas, { left: 160, top: 90, width: 960, height: 540 });
  assert.equal(f.n, 2);
});
