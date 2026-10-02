// 희생 2부(CHM-43) 주석 딱지 자리: 손 카드 「!?」(기보 표와 겹치면 왼쪽 위) · 판 위 「!!」(가장자리 칸이면 판 안쪽으로 뒤집기) ·
// 바친 기물 줄(자리가 모자라면 「+N」) · 영어 희생 단추 폭. docs/design-notes/layout.md 「!? · !! 주석」
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let M;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  const dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  M = {
    annot: await import('../src/ui/annot.js'),
    parts: await import('../src/ui/parts.js'),
    battle: await import('../src/ui/screens/battle.js'),
    gfx: await import('../src/render/gfx.js'),
    lang: await import('../src/ui/lang.js'),
    run: await import('../src/sim/run.js'),
  };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });

// 칠한 칸을 모으는 가짜 그리기 판(그린 도트의 자리로 겹침을 잰다)
function recorder() {
  const px = new Set();
  const ctx = { globalAlpha: 1, fillStyle: '', fillRect(x, y, w, h) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px.add(`${x + i},${y + j}`); } };
  return { ctx, px };
}
const overlap = (a, b) => [...a].some((k) => b.has(k));
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('!? 딱지: 기보 표가 없으면 오른쪽 위, 있으면 왼쪽 위 — 기보 표의 도트와 겹치지 않는다', () => {
  const { handTagRect, drawAnnot, ANNOT, chartBadgeRect } = M.annot;
  for (const w of [20, 22, 25, 26]) {
    const x = 400, y = 232, h = 36;
    const plain = handTagRect(x, y, w, 0);
    assert.equal(plain.left, false);
    assert.ok(plain.x + plain.w > x + w - 4 && plain.y < y, `w ${w}: 오른쪽 위 구석에 걸친다`);
    for (const level of [1, 5, 12, 99]) {
      const r = handTagRect(x, y, w, level);
      assert.equal(r.left, true, `w ${w} 기보 ${level}: 왼쪽 위로 옮긴다`);
      assert.ok(r.x < x + 4 && r.y < y, `w ${w} 기보 ${level}: 왼쪽 위 구석`);
      const a = recorder(), b = recorder();
      drawAnnot(a.ctx, '!?', r.x, r.y, ANNOT.red);
      M.parts.chartBadge(b.ctx, level, x + w - 1, y + 1);
      assert.ok(!overlap(a.px, b.px), `w ${w} 기보 ${level}: 딱지와 기보 표가 겹친다`);
      assert.ok(!cross(r, chartBadgeRect(x, y, w, level)), `w ${w} 기보 ${level}: 네모가 겹친다`);
      // 기보 표 자리에 그대로 두었다면 겹쳤다(옮기는 까닭)
      const c = recorder();
      drawAnnot(c.ctx, '!?', plain.x, plain.y, ANNOT.red);
      assert.ok(overlap(c.px, b.px), `w ${w} 기보 ${level}: 오른쪽 위 자리는 기보 표와 겹친다`);
    }
  }
  // 손 오른끝 카드의 딱지도 화면(480) 안
  const { RX, RW } = M.battle;
  const r = handTagRect(RX + RW - 25, 232, 25, 0);
  assert.ok(r.x + r.w <= 480, `오른끝 ${r.x + r.w}`);
});

test('!! 딱지: 판 64칸 어디서든 판 안 — 오른쪽 끝 줄은 왼쪽으로, 맨 윗줄은 아래로 뒤집는다', () => {
  const { boardTagRect } = M.annot;
  const { S, BX, BY, sqXY } = M.battle;
  for (let sq = 0; sq < 64; sq++) {
    const r = boardTagRect(sq, { bx: BX, by: BY, S });
    const f = sq & 7, rank = sq >> 3;
    assert.ok(r.x >= BX && r.y >= BY && r.x + r.w <= BX + S * 8 && r.y + r.h <= BY + S * 8, `칸 ${sq}: ${JSON.stringify(r)}`);
    assert.equal(r.flipX, f === 7, `칸 ${sq} 가로 뒤집기`);
    assert.equal(r.flipY, rank === 7, `칸 ${sq} 세로 뒤집기`);
    const s = sqXY(sq);
    assert.ok(cross(r, { x: s.x, y: s.y, w: S, h: S }), `칸 ${sq}: 딱지가 메이트 친 칸에 걸친다`);
  }
  // 시안(B1)의 칸: h7 — 오른쪽 끝이라 왼쪽 위
  const h7 = boardTagRect(55, { bx: BX, by: BY, S });
  assert.ok(h7.flipX && !h7.flipY);
});

test('바친 기물 줄: 다 들어가면 모두, 모자라면 앞에서부터 + 「+N」, 늘 자리 안', () => {
  const { offeredRow, moreW } = M.annot;
  assert.deepEqual(offeredRow(0, 100, 118).xs, []);
  const two = offeredRow(2, 100, 118);
  assert.equal(two.shown, 2); assert.equal(two.more, 0);
  for (let room = 0; room <= 60; room++) for (let n = 1; n <= 9; n++) {
    const r = offeredRow(n, 100, 100 + room);
    assert.equal(r.shown + r.more, n, `n ${n} 자리 ${room}`);
    const right = r.more ? r.moreX + moreW(r.more) : r.shown ? r.xs[r.shown - 1] + 8 : 100;
    if (r.fits) assert.ok(right <= 100 + room, `n ${n} 자리 ${room}: 끝 ${right}`);
    if (r.more) assert.ok(r.fits || r.shown === 0, `n ${n} 자리 ${room}: 실루엣을 둔 채 넘쳤다`);
  }
  // 대국 기본 짜임(수 4 · 희생 3): 희생 구슬 뒤 19칸 — 둘까지는 실루엣, 셋부터 「+N」
  assert.equal(offeredRow(2, 99, 118).more, 0);
  const three = offeredRow(3, 99, 118);
  assert.ok(three.more > 0 && three.fits, JSON.stringify(three));
  const many = offeredRow(12, 99, 118);
  assert.ok(many.fits && many.more >= 10, JSON.stringify(many));
});

test('희생 단추: 한국어는 아이콘 + 「희생」 62, 영어 「Sacrifice」는 아이콘 없이 글에 맞춘 폭 — 테와 글 사이 2 이상', () => {
  const { discardButton } = M.battle;
  M.lang.setLang('ko');
  assert.deepEqual(discardButton(), { w: 62, icon: true });
  M.lang.setLang('en');
  const b = discardButton(), tw = M.gfx.measure('희생', true);
  assert.equal(M.lang.L('희생'), 'Sacrifice');
  assert.equal(b.icon, false);
  assert.ok(b.w >= tw + 1 * 2 + 2 * 2 + 1, `폭 ${b.w} · 글 ${tw}`);
  // 손 이름표 줄(CHM-40)은 넓어진 단추를 뺀 자리에 맞춘다
  const run = M.run.createRun({ seed: 1, draft: false });
  run.consumables = [{ kind: 'tactic', id: run.consumables[0] ? run.consumables[0].id : 'fork' }];
  const row = M.battle.BattleScreen.prototype.handRowLayout.call({ run, canReboard: () => true });
  const last = row.rb != null ? row.rb + 15 : row.tactics.length ? row.tactics[row.tactics.length - 1].x + 15 : M.battle.RX;
  assert.ok(last <= M.battle.RX + M.battle.RW - b.w - 3, `손 줄 끝 ${last}`);
  M.lang.setLang('ko');
});
