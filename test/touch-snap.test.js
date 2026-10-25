// 손가락 자리 고치기(UI.snap — docs/tasks/handoff-touch.md): 빈 자리 누름은 가까운 작은 구역으로 붙이고, 떼며 밀린 손가락은 누른 구역으로 되돌린다.
// 마우스(touch 거짓)는 늘 그대로다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UI, TAP_SLOP } from '../src/ui/ui.js';

// 한 프레임 그린 것처럼 구역을 적는다
function frame(ui, list) {
  ui.begin();
  for (const [id, x, y, w, h, opts] of list) ui.region(id, x, y, w, h, { onClick: () => ui.clicks.push(id), ...(opts || {}) });
  ui.end();
}
function make({ touch = true, finger = 35 } = {}) {
  const ui = new UI();
  ui.touch = touch; ui.finger = finger; ui.clicks = [];
  return ui;
}
// app.pointer와 같은 차례: snap → down/up
const tap = (ui, [dx, dy], [ux, uy] = [dx, dy]) => {
  const d = ui.snap('down', dx, dy); ui.down(...d);
  const u = ui.snap('up', ux, uy); return ui.up(...u);
};

test('마우스는 고치지 않는다: 빈 자리 누름 · 밀린 뗌 모두 아무 일도 없다', () => {
  const ui = make({ touch: false, finger: 0 });
  frame(ui, [['a', 100, 100, 15, 15]]);
  assert.deepEqual(ui.snap('down', 98, 98), [98, 98]);
  tap(ui, [105, 105], [117, 105]);
  assert.deepEqual(ui.clicks, []);
});

test('빈 자리 누름: 손가락 크기로 넓힌 작은 구역 안이면 그 구역이 눌린다', () => {
  const ui = make();
  frame(ui, [['chip', 100, 100, 15, 15]]);
  // (35 − 15) / 2 = 10 도트까지
  assert.deepEqual(ui.snap('down', 91, 107), [100, 107]);
  tap(ui, [91, 107]);
  assert.deepEqual(ui.clicks, ['chip']);
  // 넘으면 그대로
  assert.deepEqual(ui.snap('down', 89, 107), [89, 107]);
});

test('다른 구역 위의 누름은 그대로다 · 둘 다 닿으면 가까운 쪽', () => {
  const ui = make();
  frame(ui, [['a', 100, 100, 15, 15], ['b', 120, 100, 15, 15], ['big', 0, 0, 60, 60]]);
  assert.deepEqual(ui.snap('down', 30, 30), [30, 30]); // big 위
  assert.deepEqual(ui.snap('down', 116, 105), [114, 105]); // a 끝 114까지 2 · b 첫 120까지 4
  assert.deepEqual(ui.snap('down', 118, 105), [120, 105]);
});

test('꺼진 구역 · passive · 누를 것 없는 구역에는 붙지 않는다', () => {
  const ui = make();
  ui.begin();
  ui.region('off', 100, 100, 15, 15, { enabled: false, onClick: () => {} });
  ui.region('deco', 200, 100, 15, 15, { passive: true, tip: { title: 'x' } });
  ui.region('plain', 300, 100, 15, 15);
  ui.end();
  for (const x of [95, 195, 295]) assert.deepEqual(ui.snap('down', x, 105), [x, 105]);
});

test('떼며 밀림: 누른 구역에서 손가락 크기 + TAP_SLOP 안이면 누른 구역이 눌린다(옆 구역으로 밀려도)', () => {
  const ui = make();
  frame(ui, [['a', 100, 100, 15, 15], ['b', 116, 100, 15, 15]]);
  tap(ui, [107, 107], [119, 107]); // b 위에서 뗌
  assert.deepEqual(ui.clicks, ['a']);
  ui.clicks = [];
  // a 끝(114)에서 10 + TAP_SLOP 넘게 떨어지면 누름이 아니다
  tap(ui, [107, 107], [114 + 10 + TAP_SLOP + 1, 107]);
  assert.deepEqual(ui.clicks, []);
});

test('끌기는 고치지 않는다: 끌어 놓은 자리 그대로 onDrop', () => {
  const ui = make();
  let drop = null;
  frame(ui, [['card', 100, 100, 30, 40, { drag: true, onDrop: (x, y) => { drop = [x, y]; } }]]);
  const d = ui.snap('down', 110, 110); ui.down(...d);
  ui.move(140, 110); // 8도트 넘게 — 끌기
  const u = ui.snap('up', 141, 110);
  assert.equal(ui.up(...u), 'drag');
  assert.deepEqual(drop, [141, 110]);
});

test('모양 구역(hit): 붙인 자리가 모양 밖이면 가운데로, 가운데도 밖이면 붙이지 않는다', () => {
  const ui = make();
  frame(ui, [
    ['diamond', 100, 100, 20, 20, { hit: (x, y) => Math.abs(x - 110) + Math.abs(y - 110) <= 10 }],
    ['corner', 200, 100, 20, 20, { hit: (x, y) => x === 219 && y === 119 }],
  ]);
  assert.deepEqual(ui.snap('down', 95, 95), [110, 110]);
  assert.deepEqual(ui.snap('down', 195, 95), [195, 95]);
});

test('미리 보기 묶음: 카드와 그 위 도장은 어느 쪽을 눌러도 같은 미리 보기 — 두 번째 누름이 고른다', () => {
  const ui = make();
  frame(ui, [['draft:0', 100, 100, 60, 80, { preview: 'draft:0' }], ['draft:0:stamp', 140, 92, 24, 14, { preview: 'draft:0' }]]);
  tap(ui, [120, 140]);
  assert.deepEqual([ui.clicks, ui.previewId], [[], 'draft:0']);
  tap(ui, [150, 98]); // 도장을 눌러도 같은 묶음 — 고른다
  assert.deepEqual([ui.clicks, ui.previewId], [['draft:0:stamp'], null]);
});

test('미리 보기 구역(preview: true)은 손가락 첫 누름에 실행하지 않는다 · 마우스는 곧바로', () => {
  const ui = make();
  frame(ui, [['btn:reboard', 100, 100, 15, 14, { preview: true }]]);
  tap(ui, [107, 107]);
  assert.deepEqual(ui.clicks, []);
  tap(ui, [107, 107]);
  assert.deepEqual(ui.clicks, ['btn:reboard']);
  const m = make({ touch: false, finger: 0 });
  frame(m, [['btn:reboard', 100, 100, 15, 14, { preview: true }]]);
  tap(m, [107, 107]);
  assert.deepEqual(m.clicks, ['btn:reboard']);
});
