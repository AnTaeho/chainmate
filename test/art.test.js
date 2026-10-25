// 물건 그림 칸(CHM-69 · 안 3, docs/design-notes/art3.md 7절 「문양 문법」): 격언 · 전설은 가족 상자 + 가족 모양 + 문양, 각인 · 혼 · 전술 · 조각 · 도박 · 깨우기는
// 제 물건 그림. 모든 물건이 그림을 갖고, (물건, 칸 크기, 배율 N)마다 한 번 구운 그림 하나를 정수 칸에 붙인다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inkBox, centre, margins, GLYPH } from '../src/render/ink.js';
import { MAXIMS } from '../src/data/maxims.js';
import { LEGENDS } from '../src/data/legends.js';
import { ENGRAVINGS } from '../src/data/engravings.js';
import { TACTICS } from '../src/data/tactics.js';
import { SOULS } from '../src/data/souls.js';
import { EDITIONS } from '../src/data/editions.js';

let dom, art, kinds, emblems, icons;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  art = await import('../src/ui/art.js');
  kinds = await import('../src/ui/kinds.js');
  emblems = await import('../src/render/emblems.js');
  icons = await import('../src/render/icons.js');
});
after(() => { delete globalThis.document; delete globalThis.window; });

function rec(scale) {
  const calls = [];
  const base = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000', getTransform: () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 }) };
  const ctx = new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, calls };
}
const images = (calls) => calls.filter((c) => c[0] === 'drawImage');

// 그림 칸에 서는 모든 물건(기물 · 기보 · 진화 밖)
const allItems = () => [
  ...MAXIMS.map((m) => ({ kind: 'maxim', id: m.id })), ...LEGENDS.map((l) => ({ kind: 'maxim', id: l.id })),
  ...ENGRAVINGS.map((e) => ({ kind: 'engraving', id: e.id })), ...TACTICS.map((x) => ({ kind: 'tactic', id: x.id })),
  ...SOULS.map((s) => ({ kind: 'soul', id: s.id })),
  { kind: 'fragment', legend: 'immortal' }, { kind: 'gamble', id: 'potion' }, { kind: 'gamble', id: 'roulette' }, { kind: 'awaken' },
  ...EDITIONS.map((e) => ({ kind: 'edition', id: e.id })),
];

test('잉크 상자: 마스크에서 바로 재고, 가운데 놓으면 네 여백이 같다', () => {
  const b = inkBox(['.....', '..##.', '..#..', '.....']);
  assert.deepEqual(b, { x: 2, y: 1, w: 2, h: 2 });
  assert.equal(inkBox(['...', '...']), null);
  assert.deepEqual(centre(8, 8, b), { x: 1, y: 2 });
  assert.deepEqual(margins(8, 8, b), { L: 3, R: 3, T: 3, B: 3, dx: 0, dy: 0 });
});

test('문양: 격언 70 · 전설 5가 모두 문양을 갖고 아이콘과 같은 문양이다, 첫 화면 메뉴 여덟 · 자물쇠도', () => {
  assert.equal(MAXIMS.length + LEGENDS.length, 75);
  for (const id of [...MAXIMS, ...LEGENDS].map((m) => m.id)) assert.ok(emblems.MOTIF[id], id);
  for (const id of ['menu_continue', 'menu_new', 'menu_lesson', 'menu_daily', 'menu_codex', 'menu_records', 'menu_settings', 'menu_rank', 'lock']) assert.ok(icons.ICON_IDS.includes(id), id);
  assert.deepEqual([...icons.ICON_IDS].sort(), Object.keys(emblems.MOTIF).sort());
});

test('문양 문법: 동사마다 가족 하나, 가족마다 상자 빛깔 · 뒤 모양이 다르고 규칙 빛깔(금 · 붉은 · 하늘)을 쓰지 않는다', () => {
  const RULE = ['#efbd55', '#f6be45', '#df5a45', '#ef6a52', '#6fb3c8'];
  for (const m of MAXIMS) assert.ok(art.FAMILY[art.familyOf(m.id)], m.id);
  for (const l of LEGENDS) assert.equal(art.familyOf(l.id), 'legend');
  const fams = Object.values(art.FAMILY);
  assert.equal(new Set(fams.map((f) => f.box)).size, fams.length);
  assert.equal(new Set(fams.map((f) => f.shape)).size, fams.length);
  for (const f of fams) for (const c of [f.box, f.halo]) assert.ok(!RULE.includes(c.toLowerCase()), c);
  // 동사 하나는 가족 하나에만
  const verbs = fams.flatMap((f) => f.verbs);
  assert.equal(new Set(verbs).size, verbs.length);
});

test('그림 칸: 모든 물건이 칸 크기마다 구운 그림 하나를 정수 칸에(N배 캔버스), 같은 물건 · 크기 · 배율이면 한 번만 굽는다', () => {
  for (const it of allItems()) for (const n of [1, 2, 3]) for (const [w, h] of [[22, 26], [20, 22], [18, 22]]) {
    const { ctx, calls } = rec(n);
    art.itemArt(ctx, it, 10.4, 20.6, 0, null, { w, h });
    const im = images(calls);
    assert.ok(im.length >= 1, `${it.kind} ${it.id || ''}`);
    const [, cv, x, y, iw, ih] = im[0];
    assert.deepEqual([x, y, iw, ih], [10, 21, w, h], `${it.kind} ${it.id || ''} 자리`);
    assert.deepEqual([cv.width, cv.height], [w * n, h * n], `${it.kind} ${it.id || ''} N${n}`);
    const again = rec(n); art.itemArt(again.ctx, it, 0, 0, 0, null, { w, h });
    assert.equal(images(again.calls)[0][1], cv, '다시 굽지 않는다');
  }
});

test('작은 그림: 아이콘 12 · 혼 표 9 · 조각 16×14 · 전술 16×11이 그 자리에 구운 그림 하나', () => {
  for (const n of [1, 2, 3]) {
    const cases = [
      [(c) => icons.drawIcon(c, 'chivalry', 3, 4), [3, 4, 12, 12]],
      [(c) => art.soulGlyph(c, 'echo', 3, 4), [3, 4, 9, 9]],
      [(c) => art.shardIcon(c, 3, 4), [3, 4, 16, 14]],
      [(c) => art.tacticIcon(c, 'freeze', 3, 4), [3, 4, 16, 11]],
    ];
    for (const [fn, want] of cases) {
      const { ctx, calls } = rec(n); fn(ctx);
      const im = images(calls);
      assert.equal(im.length, 1);
      assert.deepEqual(im[0].slice(2), want);
      assert.deepEqual([im[0][1].width, im[0][1].height], [want[2] * n, want[3] * n]);
      assert.ok(!calls.some((c) => c[0] === 'fillRect'), '도트 fillRect 없음');
    }
  }
});

test('Path2D를 쓰지 않는다(연기 시험의 가짜 캔버스에 없다)', () => {
  for (const f of ['src/render/vec.js', 'src/render/emblems.js', 'src/ui/art.js', 'src/render/icons.js', 'src/ui/stars.js']) assert.ok(!/Path2D/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')), f);
});

test('종류 문양: 열한 종류(레퍼토리 깃발까지, CHM-73) 모두 잉크 10×10 안', () => {
  assert.equal(Object.keys(kinds.KIND).length, 11);
  for (const [k, v] of Object.entries(kinds.KIND)) {
    const b = inkBox(v.g);
    assert.ok(b.w <= GLYPH && b.h <= GLYPH, `${k} ${b.w}×${b.h}`);
  }
});

test('종류 딱지 · 띠: 문양 잉크가 딱지(14×14) · 띠(14×26) 한가운데(벗어남 0)', () => {
  for (const [k, v] of Object.entries(kinds.KIND)) {
    const b = inkBox(v.g);
    for (const [w, h] of [[kinds.TAB, kinds.TAB], [kinds.BAND, 26]]) { const g = margins(w, h, b); assert.deepEqual([g.dx, g.dy], [0, 0], `${k} ${w}×${h} 왼 ${g.L} 오른 ${g.R} 위 ${g.T} 아래 ${g.B}`); }
  }
});

test('그림 칸 폭: 진화만 넓다', () => {
  assert.equal(art.artW({ kind: 'evolve' }), 44);
  assert.equal(art.artW({ kind: 'maxim' }), 22);
});
