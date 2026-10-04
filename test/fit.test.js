// 화면 맞춤(src/ui/fit.js, docs/design-notes/layout.md 「화면 맞춤」): 여러 창 × dpr에서 배율 K · 뒷면 N · 자리 · 여백 판 · 폰 세로 돌려 그리기 · 누른 자리
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFit, backScale, toGame, toClient, GW, GH } from '../src/ui/fit.js';

// [이름, 창 w, h, dpr, 손가락, 기대 K, 기대 CSS w×h, 돌려 그림]
const CASES = [
  ['아이폰 15 세로(사파리)', 393, 659, 3, true, 4, '640×360', true],
  ['아이폰 15 세로(홈 화면)', 393, 852, 3, true, 4, '640×360', true],
  ['아이폰 15 가로(사파리)', 734, 343, 3, true, 3, '480×270', false],
  ['아이폰 15 가로(전체 화면)', 852, 393, 3, true, 4, '640×360', false],
  ['아이패드 세로', 810, 1080, 2, true, 3, '720×405', false],
  ['아이패드 가로', 1080, 810, 2, true, 4, '960×540', false],
  ['맥 1920×960', 1920, 960, 2, false, 7, '1680×945', false],
  ['맥북 에어 1470×956', 1470, 956, 2, false, 6, '1440×810', false],
  ['모니터 1280×720', 1280, 720, 1, false, 2, '960×540', false],
  ['모니터 1920×1080', 1920, 1080, 1, false, 4, '1920×1080', false],
  ['창 1366×700 dpr 1.25', 1366, 700, 1.25, false, 3, '1152×648', false],
  ['안드로이드 세로 360×740', 360, 740, 3, true, 4, '640×360', true],
  ['작은 폰 세로 320×568 dpr 2', 320, 568, 2, true, 2, '480×270', true],
  ['안드로이드 가로 740×360', 740, 360, 3, true, 4, '640×360', false],
  ['좁은 데스크톱 창 세로', 400, 800, 1, false, 400 / 480, '400×225', false],
];

for (const [name, W0, H0, dpr, coarse, k, css, rot] of CASES) {
  test(`화면 맞춤: ${name}`, () => {
    const f = chooseFit({ vw: W0, vh: H0, dpr, coarse });
    assert.equal(f.k, k);
    assert.equal(`${Math.round(f.canvas.width * 100) / 100}×${Math.round(f.canvas.height * 100) / 100}`, css);
    assert.equal(f.rot, rot);
    // 돌려 그리면 틀은 창의 가로 · 세로를 바꾼 것 — 아래 검사는 모두 틀 안에서
    const vw = rot ? H0 : W0, vh = rot ? W0 : H0;
    assert.deepEqual(f.frame, { width: vw, height: vh });
    // 돌린 뒤 도트 하나는 1 CSS 화소 이상(12px 글이 12px 이상)
    if (rot) assert.ok(f.css >= 1);
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

test('돌리는 기준: 손가락 + 세로 + 도트가 1 CSS 화소 미만일 때만', () => {
  // 같은 창이어도 마우스 기기(좁은 데스크톱 창)는 그대로
  assert.equal(chooseFit({ vw: 393, vh: 659, dpr: 3, coarse: false }).rot, false);
  // 손가락이어도 가로면 그대로
  assert.equal(chooseFit({ vw: 659, vh: 393, dpr: 3, coarse: true }).rot, false);
  // 아이패드 세로(도트 1.5 CSS 화소)는 그대로 — 810×1080은 「화면 맞춤: 아이패드 세로」가 잰다
  assert.equal(chooseFit({ vw: 768, vh: 1024, dpr: 2, coarse: true }).rot, false);
});

test('돌려 그릴 때 안전 영역도 돌린 축으로 비킨다: 홈 화면 아이폰 세로, 위 59(섬) · 아래 34(홈 막대)', () => {
  const inset = { top: 59, bottom: 34, left: 0, right: 0 };
  const f = chooseFit({ vw: 393, vh: 852, dpr: 3, inset, coarse: true });
  assert.equal(f.rot, true);
  assert.equal(f.k, 4);
  // 틀의 왼쪽 = 창 위(섬), 틀의 오른쪽 = 창 아래(홈 막대)
  assert.ok(f.canvas.left >= 59, `left ${f.canvas.left}`);
  assert.ok(f.canvas.left + f.canvas.width <= 852 - 34, `right ${f.canvas.left + f.canvas.width}`);
  // 여백 판은 틀 전체(섬 · 홈 막대 뒤까지)
  assert.ok(f.pad.left <= 0 && f.pad.top <= 0 && f.pad.left + f.pad.width >= 852 && f.pad.top + f.pad.height >= 393);
  // 창 오른쪽 · 왼쪽 안전 영역(가로 폰을 세로 사파리로 열었을 때는 없다) → 틀의 위 · 아래
  const g = chooseFit({ vw: 393, vh: 659, dpr: 3, inset: { top: 0, bottom: 0, left: 20, right: 30 }, coarse: true });
  assert.ok(g.canvas.top >= 30 && g.canvas.top + g.canvas.height <= 393 - 20);
});

test('누른 자리 → 게임 도트: 돌리지 않으면 예전 그대로', () => {
  const rect = { left: 160, top: 90, width: 960, height: 540 };
  assert.deepEqual(toGame(160, 90, rect, false), [0, 0]);
  assert.deepEqual(toGame(160 + 959.9, 90 + 539.9, rect, false), [479, 269]);
  assert.deepEqual(toGame(160 + 2 * 100 + 1, 90 + 2 * 50 + 1, rect, false), [100, 50]);
});

test('누른 자리 → 게임 도트: 돌려 그리면 게임 (0, 0)은 창 오른쪽 위, (479, 269)는 창 왼쪽 아래', () => {
  // 아이폰 세로 393×659: 캔버스 640×360이 돌아 창 위에서 360×640으로 선다
  const f = chooseFit({ vw: 393, vh: 659, dpr: 3, coarse: true });
  const c = f.canvas;
  // 틀 (u, v) → 창 (vw - v, u)
  const rect = { left: 393 - (c.top + c.height), top: c.left, width: c.height, height: c.width };
  const eps = 0.01;
  assert.deepEqual(toGame(rect.left + rect.width - eps, rect.top + eps, rect, true), [0, 0]);
  assert.deepEqual(toGame(rect.left + eps, rect.top + rect.height - eps, rect, true), [479, 269]);
  // 게임 오른쪽 위(479, 0)는 창 오른쪽 아래
  assert.deepEqual(toGame(rect.left + rect.width - eps, rect.top + rect.height - eps, rect, true), [479, 0]);
  // 도트 가운데를 왕복하면 같은 도트
  for (const [gx, gy] of [[0, 0], [240, 135], [17, 250], [479, 269], [333, 4]]) {
    const [cx, cy] = toClient(gx + 0.5, gy + 0.5, rect, true);
    assert.deepEqual(toGame(cx, cy, rect, true), [gx, gy]);
    const [dx, dy] = toClient(gx + 0.5, gy + 0.5, rect, false);
    assert.deepEqual(toGame(dx, dy, rect, false), [gx, gy]);
  }
});
