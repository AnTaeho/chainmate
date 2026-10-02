// 아이폰 맞춤(CHM-52, docs/design-notes/layout.md 「화면 맞춤」): 보이는 창과 그릴 수 있는 창 전체(full)를 나눠 잰다.
// 사람 그림(아이폰 17 홈 화면 세로): 화면 402×874, 페이지가 읽은 창 402×812(= 874 − 위 안전 영역 62), 아래 홈 막대 34.
// 고치기 전에는 틀 · 여백 판이 812에서 끝나 아래 62pt가 맨 바탕으로 비었다(캔버스는 창 y 100 ~ 740, 잘린 곳은 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFit, toGame, toClient, GW, GH } from '../src/ui/fit.js';
import { fingerDots, growHit } from '../src/ui/ui.js';

const I17 = { top: 62, right: 0, bottom: 34, left: 0 };
// 돌린 틀 안의 캔버스를 창 좌표 사각형으로(틀 (u, v) → 창 (fw − v, u))
function windowRect(f, fw) {
  const c = f.canvas;
  if (!f.rot) return { left: c.left, top: c.top, right: c.left + c.width, bottom: c.top + c.height };
  return { left: fw - (c.top + c.height), right: fw - c.top, top: c.left, bottom: c.left + c.width };
}
// 여백 판이 덮는 창 사각형
function padRect(f, fw) {
  const p = f.pad;
  if (!f.rot) return { left: p.left, top: p.top, right: p.left + p.width, bottom: p.top + p.height };
  return { left: fw - (p.top + p.height), right: fw - p.top, top: p.left, bottom: p.left + p.width };
}

test('돌린 축: 보이는 창 402×812 · 그릴 수 있는 창 402×874 — 여백 판이 아래 띠까지 덮고 캔버스는 보이는 창 · 안전 영역 안', () => {
  const f = chooseFit({ vw: 402, vh: 812, full: { width: 402, height: 874 }, dpr: 3, inset: I17, coarse: true });
  assert.equal(f.rot, true);
  assert.equal(f.k, 4);
  assert.deepEqual(f.frame, { width: 874, height: 402 });
  const w = windowRect(f, 402), p = padRect(f, 402);
  assert.ok(p.left <= 0 && p.top <= 0 && p.right >= 402 && p.bottom >= 874, JSON.stringify(p));
  assert.ok(w.left >= 0 && w.right <= 402 && w.top >= 62 && w.bottom <= 812, JSON.stringify(w));
  // 게임 가로는 창 세로로 640, 게임 세로는 창 가로로 360
  assert.equal(w.bottom - w.top, 640);
  assert.equal(w.right - w.left, 360);
});

test('고치기 전 꼴(full 없음)은 사람 그림과 같다: 틀 812 · 캔버스 창 y 100 ~ 740', () => {
  const f = chooseFit({ vw: 402, vh: 812, dpr: 3, inset: I17, coarse: true });
  assert.deepEqual(f.frame, { width: 812, height: 402 });
  const w = windowRect(f, 402);
  assert.deepEqual([w.top, w.bottom], [100, 740]);
  assert.ok(padRect(f, 402).bottom < 874);
});

test('홈 화면 앱: 화면 전체가 보이는 창이면 캔버스가 화면 가운데(창 y 131 ~ 771)', () => {
  const f = chooseFit({ vw: 402, vh: 874, full: { width: 402, height: 874 }, dpr: 3, inset: I17, coarse: true });
  const w = windowRect(f, 402);
  assert.deepEqual([w.top, w.bottom, f.k], [131, 771, 4]);
});

test('주소창이 펴져 보이는 창이 812 → 700으로 줄면: 섬 아래 남는 길이가 640 이상이면 K 4, 아니면 K 3. 어느 쪽이든 캔버스는 보이는 창 안', () => {
  for (const [vh, k] of [[812, 4], [760, 4], [702, 4], [700, 3]]) {
    const f = chooseFit({ vw: 402, vh, full: { width: 402, height: 874 }, dpr: 3, inset: I17, coarse: true });
    const w = windowRect(f, 402);
    assert.equal(f.k, k, `vh ${vh}`);
    assert.ok(w.top >= 62 && w.bottom <= vh, `vh ${vh}: ${w.top}~${w.bottom}`);
    assert.ok(padRect(f, 402).bottom >= 874);
  }
});

test('돌린 축 계산: 폭 · 높이를 바꿔 쓰지 않는다(창이 길쭉하면 게임 가로가 창 세로를 따른다)', () => {
  const f = chooseFit({ vw: 402, vh: 874, dpr: 3, coarse: true });
  // 돌린 틀의 가로 여유(874)는 게임 가로(480K)를, 세로 여유(402)는 게임 세로(270K)를 받는다
  assert.ok(f.canvas.width <= f.frame.width && f.canvas.height <= f.frame.height);
  assert.equal(f.canvas.width / f.canvas.height, GW / GH);
  // 누른 자리 왕복: 돌린 캔버스의 네 귀퉁이
  const w = windowRect(f, 402);
  const rect = { left: w.left, top: w.top, width: w.right - w.left, height: w.bottom - w.top };
  for (const [gx, gy] of [[0, 0], [479, 0], [0, 269], [479, 269], [240, 135]]) {
    const [cx, cy] = toClient(gx + 0.5, gy + 0.5, rect, true);
    assert.deepEqual(toGame(cx, cy, rect, true), [gx, gy]);
  }
});

test('가로 사파리: 보이는 창 874×352(주소창 펴짐) · 화면 874×402 — 돌리지 않고, 여백 판은 아래까지, 캔버스는 노치 · 보이는 창 안', () => {
  const inset = { top: 0, right: 62, bottom: 21, left: 62 };
  const f = chooseFit({ vw: 874, vh: 352, full: { width: 874, height: 402 }, dpr: 3, inset, coarse: true });
  assert.equal(f.rot, false);
  assert.equal(f.k, 3);
  const w = windowRect(f, 874), p = padRect(f, 874);
  assert.ok(w.left >= 62 && w.right <= 874 - 62 && w.top >= 0 && w.bottom <= 352, JSON.stringify(w));
  assert.ok(p.bottom >= 402 && p.right >= 874);
  // 접히면(보이는 창 = 화면) K 4
  const g = chooseFit({ vw: 874, vh: 402, full: { width: 874, height: 402 }, dpr: 3, inset, coarse: true });
  assert.equal(g.k, 4);
  assert.ok(windowRect(g, 874).bottom <= 402 - 21);
});

test('full이 보이는 창보다 작거나 없으면 보이는 창 그대로(데스크톱 · 옛 호출)', () => {
  const a = chooseFit({ vw: 1280, vh: 720, dpr: 1 });
  const b = chooseFit({ vw: 1280, vh: 720, dpr: 1, full: { width: 1000, height: 600 } });
  assert.deepEqual(a, b);
});

test('손가락 구역: 44pt를 도트로(돌린 아이폰 K 4 = 33도트, 가로 K 3 = 44도트), 마우스는 0', () => {
  assert.equal(fingerDots({ coarse: true, pixelScale: 4 / 3 }), 33);
  assert.equal(fingerDots({ touch: true, pixelScale: 1 }), 44);
  assert.equal(fingerDots({ coarse: false, touch: false, pixelScale: 1 }), 0);
  assert.equal(fingerDots(null), 0);
});

test('growHit: 막힌 쪽은 넘지 않고, 모자란 몫은 다른 쪽이 진다', () => {
  // 멈춤 단추: 왼쪽 · 아래 막힘 → 오른쪽 · 위로만
  assert.deepEqual(growHit(458, 3, 18, 18, 33, { r: Infinity, u: Infinity }), { x: 458, y: -12, w: 33, h: 33 });
  // 양쪽 열림: 반씩
  assert.deepEqual(growHit(10, 10, 20, 18, 30, { l: 9, r: 9, u: 9, d: 9 }), { x: 5, y: 4, w: 30, h: 30 });
  // 한쪽이 2만 열리면 나머지는 다른 쪽
  assert.deepEqual(growHit(10, 10, 20, 18, 30, { l: 2, r: 20 }), { x: 8, y: 10, w: 30, h: 18 });
  // 둘 다 조금만 열리면 그만큼만(그림은 그대로)
  assert.deepEqual(growHit(10, 10, 20, 18, 44, { u: 4, d: 4 }), { x: 10, y: 6, w: 20, h: 26 });
  // 이미 크면 그대로
  assert.deepEqual(growHit(0, 0, 50, 50, 44, { l: 9, r: 9, u: 9, d: 9 }), { x: 0, y: 0, w: 50, h: 50 });
});
