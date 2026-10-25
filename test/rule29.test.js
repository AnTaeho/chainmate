// 통일 규칙(docs/design-notes/layout.md 29절)의 공통 부품: 단추 폭 · 단추 줄 · 토글 무리 · 판 밖 머리줄 · 아래 단추 줄 · 막간 상자 · 모서리
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, LL, ui, common, gfx, frame, text, ctx;
before(async () => {
  dom = await installDom();
  LL = await import('../src/render/layoutlog.js');
  ui = await import('../src/ui/ui.js');
  common = await import('../src/ui/screens/common.js');
  gfx = await import('../src/render/gfx.js');
  frame = await import('../src/ui/frame.js');
  text = await import('../src/render/text.js');
  ctx = dom.document.createElement('canvas').getContext('2d');
});
after(async () => { LL.LOG.on = false; const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); });
beforeEach(() => { LL.LOG.on = true; LL.logBegin(); });

const box = (id) => LL.LOG.boxes.find((b) => b.name === `단추 ${id}`);

test('토큰: 간격 자 여섯 단 · 단추 높이 하나(옛 이름은 같은 값) · 모서리 둘', () => {
  assert.deepEqual(Object.values(frame.SP), [2, 4, 8, 12, 16, 24]);
  assert.equal(frame.BTN_S, frame.BTN_H);
  assert.equal(frame.PAGE.btnH, frame.BTN_H);
  assert.deepEqual([gfx.R_SM, gfx.R_LG, gfx.R_BIG], [4, 6, 6]);
  for (const [w, h] of [[8, 8], [20, 22], [30, 17], [108, 160], [24, 24]]) assert.ok([gfx.R_SM, gfx.R_LG].includes(gfx.radiusOf(w, h)), `${w}×${h}`);
  assert.equal(gfx.slotR(200, 30), gfx.R_SM);
});

test('단추 폭: 글 + 양쪽 12, 가장 좁아도 64 · 폭을 안 주면 글에 맞춘다', () => {
  assert.equal(ui.btnW('뒤로'), 64);
  const long = '기록 내보내기';
  assert.equal(ui.btnW(long), text.textWidth(long, true) + 24);
  const u = new ui.UI();
  ui.button(ctx, u, 'auto', 10, 10, null, null, long);
  assert.deepEqual([box('auto').w, box('auto').h], [ui.btnW(long), frame.BTN_H]);
});

test('단추 줄: 같은 폭(가장 넓은 글) · 사이 8 · 왼끝 · 가운데 · 오른끝', () => {
  const u = new ui.UI();
  const items = [{ id: 'a', label: '튜토리얼' }, { id: 'b', label: '기록 내보내기' }, { id: 'c', label: '뒤로' }];
  const bw = ui.btnW('기록 내보내기');
  for (const [anchor, x, x0] of [['left', 20, 20], ['center', 240, 240 - Math.floor((bw * 3 + 16) / 2)], ['right', 468, 468 - (bw * 3 + 16)]]) {
    LL.logBegin();
    const row = ui.buttonRow(ctx, u, items, x, 100, { anchor });
    assert.equal(row.x, x0, anchor);
    assert.deepEqual(items.map((it) => box(it.id).x), [x0, x0 + bw + 8, x0 + (bw + 8) * 2], anchor);
    assert.ok(items.every((it) => box(it.id).w === bw && box(it.id).h === frame.BTN_H), anchor);
  }
});

test('토글 무리: 같은 폭 · 고른 것만 금빛 · 누르면 값을 넘긴다', () => {
  const u = new ui.UI();
  let got = null;
  const row = ui.toggleGroup(ctx, u, 'speed', [[1, '×1'], [2, '×2'], [4, '×4']], 2, 0, 0, (v) => { got = v; }, { min: 0 });
  assert.equal(new Set(row.rects.map((r) => r.w)).size, 1);
  u.find('speed:4').onClick();
  assert.equal(got, 4);
});

test('판 밖 머리줄: 큰 제목 (12, 4) · 탭은 제목 오른쪽 8 · 머리 기록', () => {
  const u = new ui.UI();
  const tabs = [['today', '오늘'], ['yesterday', '어제']];
  const out = common.pageHead(ctx, '순위', '오늘 · 25명', { big: true, tabs: { ui: u, prefix: 'rank', list: tabs, cur: 'today', go: () => {} } });
  assert.deepEqual(LL.LOG.heads.map((h) => [h.s, h.x, h.y]), [['순위', 12, 4]]);
  const t0 = box('rank:tab:today');
  assert.equal(t0.x, 12 + common.headW('순위') + 8);
  assert.equal(t0.y, common.HEAD_BIG.tabY);
  assert.equal(out.tabEnd, t0.x + common.headTabsW(tabs));
});

test('아래 단추 줄: 「뒤로」 (12, 244) 폭 80 · 주 단추 오른쪽 끝 · 사이 단추는 「뒤로」 오른쪽 8부터', () => {
  const u = new ui.UI();
  common.bottomBar(ctx, u, { back: { id: 'back' }, primary: { id: 'go', label: '시작', tone: 'gold' }, extras: [{ id: 'x1', label: '해금' }] });
  const b = box('back'), p = box('go'), x = box('x1');
  assert.deepEqual([b.x, b.y, b.w, b.h], [12, 244, 80, 18]);
  assert.equal(p.x + p.w, 480 - 12);
  assert.equal(x.x, 12 + 80 + 8);
});

test('막간 상자: 안 위 12에 두 배 제목 · 본문은 제목 아래 12 · 단추 줄은 안 아래 12에 가운데', () => {
  const u = new ui.UI();
  const lay = common.interlude(ctx, u, 100, 40, 280, 50, null, { title: '승리', buttons: [{ id: 'ok', label: '계속' }, { id: 'more', label: '하이라이트' }] });
  assert.equal(lay.bodyY, 12 + 28 + 12);
  assert.equal(lay.h, 12 + 28 + 12 + 50 + 12 + 18 + 12);
  const a = box('ok'), c = box('more');
  assert.equal(a.y + a.h, 40 + lay.h - 12);
  assert.equal(a.w, c.w);
  assert.equal(c.x + c.w - 240, 240 - a.x);
  assert.equal(LL.checkLayout().length, 0);
});
