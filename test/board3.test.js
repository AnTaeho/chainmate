// 판 투영(안 3, docs/design-notes/art3.md 3절): 칸 가운데 · 꼭짓점 · 누르는 구역이 서로 맞는다 — 손잡이 셋 모두
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, VIEW, AREA, setView, center, projectSq, unproject, sqBox, order } from '../src/render/board3.js';
import { UI } from '../src/ui/ui.js';

for (const name of Object.keys(VIEWS)) {
  test(`투영 ${name}: 칸 가운데는 그 칸으로 돌아오고, 판은 판 자리 안, 뒤에서 앞 차례는 화면 y 차례`, () => {
    const keep = VIEW.name;
    try {
      setView(name);
      for (let sq = 0; sq < 64; sq++) {
        const c = center(sq), p = projectSq(sq);
        assert.equal(unproject(c.x, c.y), sq, `칸 ${sq} 가운데`);
        // 꼭짓점에서 가운데 쪽으로 조금 들어간 자리도 같은 칸
        for (const q of p.pts) assert.equal(unproject(q.x + (c.x - q.x) * 0.1, q.y + (c.y - q.y) * 0.1), sq, `칸 ${sq} 꼭짓점 안쪽`);
        const b = sqBox(sq);
        assert.ok(b.x >= AREA.x && b.x + b.w <= AREA.x + AREA.w && b.y >= AREA.y && b.y + b.h <= AREA.y + AREA.h, `칸 ${sq} 판 자리 안`);
        // 연기 시험의 누르기(bbox 가운데)는 칸 가운데
        assert.equal(unproject(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2)), sq, `칸 ${sq} bbox 가운데`);
      }
      const ys = order().map((sq) => center(sq).y);
      for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1]);
      assert.equal(unproject(AREA.x - 5, AREA.y - 5), null);
    } finally { setView(keep); }
  });
}

test('누르는 구역: bbox가 겹치는 이웃 칸 중 마름모 판정(hit)이 맞는 칸만 잡힌다', () => {
  const ui = new UI();
  ui.begin();
  for (let sq = 0; sq < 64; sq++) { const b = sqBox(sq); ui.region(`sq:${sq}`, b.x, b.y, b.w, b.h, { hit: (x, y) => unproject(x, y) === sq }); }
  for (let sq = 0; sq < 64; sq++) {
    const c = center(sq);
    assert.equal(ui.hitIn(ui.regions, c.x, c.y).id, `sq:${sq}`);
    // 가운데에서 오른쪽 아래로 반 칸 가까이 비킨 자리(이웃 칸 bbox 안)는 이웃 칸이나 판 밖
    const p = projectSq(sq).pts[1], x = c.x + (p.x - c.x) * 0.9, y = c.y + (p.y - c.y) * 0.9;
    const h = ui.hitIn(ui.regions, x, y);
    assert.equal(h ? h.id : null, `sq:${sq}`);
  }
});
