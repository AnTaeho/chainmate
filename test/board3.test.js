// 판 투영(안 3, docs/design-notes/art3.md 3절): 칸 가운데 · 꼭짓점 · 누르는 구역이 서로 맞는다 — 손잡이 셋 모두
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, VIEW, AREA, setView, center, projectSq, unproject, sqBox, order, picker, hitBox, PIECE_UP, bodyW } from '../src/render/board3.js';
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

// 기물이 선 칸은 그 몸(머리 · 관)도 가진다 — 머리를 누르면 뒤 칸이 잡히던 것(안 3 마름모 판)
for (const name of Object.keys(VIEWS)) {
  test(`누르기 ${name}: 머리는 그 기물 칸, 겹치면 앞 기물, 빈 칸은 마름모, 구역 가운데는 늘 그 칸`, () => {
    const keep = VIEW.name;
    try {
      setView(name);
      const full = picker(() => PIECE_UP), empty = picker(() => 0);
      const ui = new UI();
      ui.begin();
      for (let sq = 0; sq < 64; sq++) { const b = hitBox(sq); ui.region(`sq:${sq}`, b.x, b.y, b.w, b.h, { hit: (x, y) => full(x, y) === sq }); }
      for (let sq = 0; sq < 64; sq++) {
        const c = center(sq);
        // 머리(가운데 위 20) · 관 꼭대기(위 23)는 그 칸 — 뒤에 선 기물보다 앞이라서
        for (const up of [20, PIECE_UP - 1]) {
          assert.equal(full(c.x, c.y - up), sq, `칸 ${sq} 위 ${up}`);
          assert.equal(ui.hitIn(ui.regions, c.x, c.y - up).id, `sq:${sq}`, `칸 ${sq} 위 ${up} 구역`);
        }
        // 빈 판이면 같은 자리는 마름모(뒤 칸이나 판 밖)
        assert.equal(empty(c.x, c.y - 20), unproject(c.x, c.y - 20));
        // 구역 bbox 가운데는 빈 판 · 가득 찬 판 모두 그 칸(연기 시험 · 찍기 도구가 누르는 자리)
        const b = hitBox(sq), mx = b.x + Math.floor(b.w / 2), my = b.y + Math.floor(b.h / 2);
        assert.equal(full(mx, my), sq, `칸 ${sq} 구역 가운데(가득)`);
        assert.equal(empty(mx, my), sq, `칸 ${sq} 구역 가운데(빈 판)`);
      }
      // 앞 기물이 뒤 기물 몸을 덮는 자리는 앞 기물: 두 몸이 겹치는 곳마다
      const o = order();
      for (let i = 0; i < 64; i++) for (let j = i + 1; j < 64; j++) {
        const back = o[i], front = o[j], a = center(back), f = center(front);
        if (Math.abs(a.x - f.x) >= 2 * bodyW() || f.y - a.y >= PIECE_UP + 2 || f.y === a.y) continue;
        const y = Math.max(a.y - PIECE_UP, f.y - PIECE_UP), x = (a.x + f.x) / 2;
        if (y >= Math.min(a.y, f.y) + 2) continue;
        assert.equal(full(x, y), front, `칸 ${back} 몸과 ${front} 몸이 겹친 자리`);
      }
      // 뒤 칸 바닥 위로 앞 칸 기물 머리가 올라온 자리: 앞 칸이 비면 뒤 칸, 서 있으면 앞 칸
      for (let sq = 0; sq < 64; sq++) {
        const c = center(sq), y = c.y - 15, behind = unproject(c.x, y);
        if (behind == null || behind === sq) continue;
        assert.equal(picker((q) => (q === sq ? PIECE_UP : 0))(c.x, y), sq, `칸 ${sq} 머리가 칸 ${behind} 바닥 위`);
        assert.equal(picker((q) => (q === behind ? PIECE_UP : 0))(c.x, y), behind, `칸 ${sq}가 비면 뒤 칸 ${behind}`);
      }
    } finally { setView(keep); }
  });
}
