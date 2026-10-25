// 꽉 채움(fit.js chooseFit fill): 소수 배율이어도 캔버스 · 뒷면이 기기 화소에 맞는지, 정수 배율보다 작아지지 않는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFit, fillBack, FILL_STEP, GW, GH } from '../src/ui/fit.js';
import { LOOK, grid, span } from '../src/render/look.js';

const WINDOWS = [[734, 343, 3], [1280, 720, 1], [1920, 950, 1], [1920, 950, 2], [1470, 956, 2], [1366, 700, 1.25], [844, 390, 3], [2560, 1300, 2], [1024, 768, 1], [600, 340, 1]];
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('꽉 채움: 배율은 1/30 칸, 캔버스는 기기 화소 정수 크기 · 자리, 정수 배율보다 작지 않고 창 안에 든다', () => {
  for (const [vw, vh, dpr] of WINDOWS) {
    const a = chooseFit({ vw, vh, dpr }), b = chooseFit({ vw, vh, dpr, fill: true });
    const tag = `${vw}x${vh}@${dpr}`;
    assert.ok(b.k >= a.k - 1e-9, tag);
    assert.ok(near(b.k * FILL_STEP, Math.round(b.k * FILL_STEP)), `${tag} k ${b.k}`);
    const c = b.canvas;
    for (const v of [c.left, c.top, c.width, c.height]) assert.ok(near(v * dpr, Math.round(v * dpr)), `${tag} ${v}`);
    assert.ok(near(c.width * dpr, GW * b.k) && near(c.height * dpr, GH * b.k), tag);
    assert.ok(c.left >= -1e-9 && c.top >= -1e-9 && c.left + c.width <= vw + 1e-6 && c.top + c.height <= vh + 1e-6, tag);
    // 뒷면 480n × 270n은 정수, 기기 화소의 정수 j배
    const j = Math.round(b.k / b.n);
    assert.ok(near(b.k / b.n, j), tag);
    assert.ok(near(GW * b.n, Math.round(GW * b.n)) && near(GH * b.n, Math.round(GH * b.n)), `${tag} n ${b.n}`);
    if (b.fill) {
      assert.ok(b.n <= 5 + 1e-9, tag);
      // 캔버스 자리는 j의 배수(여백 판 화소와 뒷면 화소가 같은 격자), dpr이 정수면 CSS 화소 정수
      assert.equal(Math.round(c.left * dpr) % j, 0, tag);
      if (Number.isInteger(dpr)) assert.ok(Number.isInteger(c.left) && Number.isInteger(c.top), tag);
      // 여백 판: 도트 (ox, oy)가 게임 (0, 0) — 변환으로 뒷면 화소 (left / j, top / j)에
      const p = b.pad;
      assert.ok(near(p.dev.tx + p.ox * p.s, (c.left * dpr) / j) && near(p.dev.ty + p.oy * p.s, (c.top * dpr) / j), tag);
      assert.ok(p.dev.tx <= 1e-9 && p.dev.ty <= 1e-9, tag);
      assert.ok(p.dev.tx + p.cols * p.s >= p.dev.w - 1e-6 && p.dev.ty + p.rows * p.s >= p.dev.h - 1e-6, tag);
    }
  }
});

test('꽉 채움: 정수로 딱 맞는 창 · 480×270보다 작은 창은 정수 배율과 같다', () => {
  for (const [vw, vh, dpr] of [[960, 540, 1], [1440, 810, 1], [400, 220, 1]]) assert.deepEqual(chooseFit({ vw, vh, dpr, fill: true }), chooseFit({ vw, vh, dpr }));
});

test('꽉 채움 뒷면 배율: 상한을 넘으면 정수 j로 나눈다', () => {
  assert.deepEqual(fillBack(3.5), { n: 3.5, j: 1 });
  assert.deepEqual(fillBack(5.5), { n: 2.75, j: 2 });
  assert.deepEqual(fillBack(7), { n: 3.5, j: 2 });
  assert.deepEqual(fillBack(7, 4), { n: 3.5, j: 2 });
  assert.deepEqual(fillBack(7, 8), { n: 7, j: 1 });
  assert.equal(fillBack(9.6).j, 2);
  assert.deepEqual(fillBack(4.4), { n: 4.4, j: 1 }); // 폰 dpr 3 가로 · 세로는 반으로 떨어지지 않는다
});

test('소수 배율의 칸 맞춤: 자리 · 오른쪽 끝이 기기 화소, 테 1은 어디서나 round(N) 화소', () => {
  const keep = LOOK.n;
  try {
    LOOK.n = 3.5;
    for (let x = 0; x < 40; x++) {
      const X = grid(x + 0.3);
      assert.ok(near(X * 3.5, Math.round(X * 3.5)));
      assert.ok(near(span(X, 1) * 3.5, 4), `x ${x}`);
      assert.ok(near((X + span(X, 20)) * 3.5, Math.round((X + span(X, 20)) * 3.5)));
    }
    LOOK.n = 3;
    assert.equal(grid(4.6), 5);
    assert.equal(span(5, 2.4), 2);
  } finally { LOOK.n = keep; }
});

// 창 끝 비움(gutter): 손가락 기기 브라우저에서 창 위 · 아래 끝 누름을 주소창 · 도구 막대가 먹는다 — 캔버스를 그만큼 안쪽에
test('꽉 채움 gutter: 캔버스가 창 위 · 아래 끝에서 그만큼 떨어지고, 정수 배율보다 작아지지 않는다 · 정수 배율은 그대로', () => {
  const g = { top: 12, bottom: 12 };
  const f = chooseFit({ vw: 734, vh: 343, dpr: 3, coarse: true, fill: true, gutter: g });
  assert.ok(f.canvas.top >= 12 && f.canvas.top + f.canvas.height <= 343 - 12, JSON.stringify(f.canvas));
  assert.ok(f.k >= chooseFit({ vw: 734, vh: 343, dpr: 3, coarse: true }).k, `k ${f.k}`);
  assert.deepEqual(chooseFit({ vw: 734, vh: 343, dpr: 3, coarse: true, gutter: g }), chooseFit({ vw: 734, vh: 343, dpr: 3, coarse: true }));
  // 돌려 그린 폰 세로: 창의 위 · 아래(돌린 틀의 왼쪽 · 오른쪽)
  const r = chooseFit({ vw: 393, vh: 659, dpr: 3, coarse: true, fill: true, gutter: g });
  assert.equal(r.rot, true);
  assert.ok(r.canvas.left >= 12 && r.canvas.left + r.canvas.width <= 659 - 12, JSON.stringify(r.canvas));
});
