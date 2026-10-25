// 희생 2부(CHM-43) 주석 딱지 자리: 손 카드 「!?」(기보 표와 겹치면 왼쪽 위) · 판 위 「!!」(가장자리 칸이면 판 안쪽으로 뒤집기) ·
// 바친 기물 줄(자리가 모자라면 「+N」) · 영어 희생 단추 폭. docs/design-notes/layout.md 「!? · !! 주석」
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let M;
before(async () => {
  await installDom();
  M = {
    annot: await import('../src/ui/annot.js'),
    parts: await import('../src/ui/parts.js'),
    battle: await import('../src/ui/screens/battle.js'),
    board3: await import('../src/render/board3.js'),
    gfx: await import('../src/render/gfx.js'),
    ui: await import('../src/ui/ui.js'),
    lang: await import('../src/ui/lang.js'),
    run: await import('../src/sim/run.js'),
  };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });

// 아무 그리기나 받는 가짜 그리기 판(딱지는 둥근 칸 · 글꼴 글자라 겹침은 네모 셈으로 잰다)
const fakeCtx = () => new Proxy({ globalAlpha: 1 }, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => { t[k] = v; return true; } });
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('!? 딱지: 기보 표가 없으면 오른쪽 위, 있으면 왼쪽 위 — 기보 표와 겹치지 않는다', () => {
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
      assert.ok(!cross(r, chartBadgeRect(x, y, w, level)), `w ${w} 기보 ${level}: 딱지와 기보 표가 겹친다`);
      // 기보 표 자리에 그대로 두었다면 겹쳤다(옮기는 까닭)
      assert.ok(cross(plain, chartBadgeRect(x, y, w, level)), `w ${w} 기보 ${level}: 오른쪽 위 자리는 기보 표와 겹친다`);
      // 그려도 던지지 않는다(둥근 칸 · 글꼴 글자)
      drawAnnot(fakeCtx(), '!?', r.x, r.y, ANNOT.red);
      M.parts.chartBadge(fakeCtx(), level, x + w - 1, y + 1);
    }
  }
  // 손 오른끝 카드의 딱지도 화면(480) 안
  const { RX, RW } = M.battle;
  const r = handTagRect(RX + RW - 25, 232, 25, 0);
  assert.ok(r.x + r.w <= 480, `오른끝 ${r.x + r.w}`);
});

test('!! 딱지: 판 64칸 어디서든 판 자리 안 — 판 자리 밖으로 나갈 칸만 안쪽으로 뒤집고, 늘 그 칸의 기물 기둥에 걸친다', () => {
  const { boardTagRect, annotSize } = M.annot;
  const { S, BX, BY } = M.battle;
  const { projectSq, center, PIECE_UP } = M.board3;
  const { w, h } = annotSize('!!', 2);
  for (let sq = 0; sq < 64; sq++) {
    const r = boardTagRect(sq);
    assert.ok(r.x >= BX && r.y >= BY && r.x + r.w <= BX + S * 8 && r.y + r.h <= BY + S * 8, `칸 ${sq}: ${JSON.stringify(r)}`);
    // 뒤집기 전 자리(칸 가운데 오른쪽 위)가 판 자리 밖일 때만 뒤집는다
    const c = center(sq), x0 = Math.round(c.x + 4), y0 = Math.round(c.y - PIECE_UP - h + 8);
    assert.equal(r.flipX, x0 + w > BX + S * 8, `칸 ${sq} 가로 뒤집기`);
    assert.equal(r.flipY, y0 < BY, `칸 ${sq} 세로 뒤집기`);
    const b = projectSq(sq).box;
    assert.ok(cross(r, { x: b.x, y: b.y - PIECE_UP, w: b.w, h: b.h + PIECE_UP }), `칸 ${sq}: 딱지가 메이트 친 칸(기물 기둥)에 걸친다`);
  }
  // 정면 판의 h8(오른쪽 위 구석)은 가로로 뒤집지 않아도 판 자리 안에 든다
  assert.ok(!boardTagRect(63).flipX);
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

test('희생 단추: 폭 62 알약 + 아이콘, 이름이 안 들어가는 영어는 「Sac」 — 테와 글 사이 2 이상, 손 이름표 줄이 단추 앞에 든다', () => {
  const { discardButton } = M.battle;
  const { pillR } = M.ui;
  for (const [lang, label] of [['ko', '희생'], ['en', 'Sac']]) {
    M.lang.setLang(lang);
    const b = discardButton(), tw = M.gfx.measure(b.label, true) + 10;
    assert.deepEqual(b, { w: 62, icon: true, label });
    assert.ok(pillR(b.w, 18, tw) >= 8, `${lang}: 알약 모서리 ${pillR(b.w, 18, tw)}`);
    // 손 이름표 줄(CHM-40)은 단추를 뺀 자리에 맞춘다
    const run = M.run.createRun({ seed: 1, draft: false });
    run.consumables = [{ kind: 'tactic', id: run.consumables[0] ? run.consumables[0].id : 'fork' }];
    const row = M.battle.BattleScreen.prototype.handRowLayout.call({ run, canReboard: () => true });
    const last = row.rb != null ? row.rb + 15 : row.tactics.length ? row.tactics[row.tactics.length - 1].x + 15 : M.battle.RX;
    assert.ok(last <= M.battle.RX + M.battle.RW - b.w - 2, `손 줄 끝 ${last}`);
  }
  M.lang.setLang('ko');
});
