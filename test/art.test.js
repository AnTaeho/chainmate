// 그림 칸(CHM-69, layout.md 「종류 표시」): 격언 · 각인 · 전술 · 조각 · 도박 · 깨우기 · 혼 그림의 잉크 상자가 과녁(폭 14~18 · 높이 16~20) 안이고
// 칸 가운데에 선다. 마스크에서 바로 잰다(render/ink.js) — 화면에서 잰 값은 tools/shots-shop-art.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inkBox, centre, margins, inTarget, ART, TARGET, GLYPH } from '../src/render/ink.js';
import * as A16 from '../src/render/art16.js';
import * as HI from '../src/render/art-hi.js';
import { MAXIMS } from '../src/data/maxims.js';
import { LEGENDS } from '../src/data/legends.js';
import { ENGRAVINGS } from '../src/data/engravings.js';
import { TACTICS } from '../src/data/tactics.js';
import { SOULS } from '../src/data/souls.js';

let dom, art, kinds;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  art = await import('../src/ui/art.js');
  kinds = await import('../src/ui/kinds.js');
});
after(() => { delete globalThis.document; delete globalThis.window; });

test('잉크 상자: 마스크에서 바로 재고, 가운데 놓으면 네 여백이 같다', () => {
  const b = inkBox(['.....', '..##.', '..#..', '.....']);
  assert.deepEqual(b, { x: 2, y: 1, w: 2, h: 2 });
  assert.equal(inkBox(['...', '...']), null);
  assert.deepEqual(centre(8, 8, b), { x: 1, y: 2 });
  assert.deepEqual(margins(8, 8, b), { L: 3, R: 3, T: 3, B: 3, dx: 0, dy: 0 });
});

// 그림 칸에 서는 모든 물건(마스크로 그리는 종류)
const allItems = () => [
  ...MAXIMS.map((m) => ({ kind: 'maxim', id: m.id })), ...LEGENDS.map((l) => ({ kind: 'maxim', id: l.id })),
  ...ENGRAVINGS.map((e) => ({ kind: 'engraving', id: e.id })), ...TACTICS.map((x) => ({ kind: 'tactic', id: x.id })),
  ...SOULS.map((s) => ({ kind: 'soul', id: s.id })),
  { kind: 'fragment', legend: 'immortal' }, { kind: 'gamble', id: 'potion' }, { kind: 'gamble', id: 'roulette' }, { kind: 'awaken' },
];

test('그림 원본: 격언 75 · 각인 12 · 전술 3이 빠짐없이 있고 줄 길이가 고르다', () => {
  assert.equal(MAXIMS.length + LEGENDS.length, 75);
  assert.deepEqual(Object.keys(A16.MAXIM16).sort(), [...MAXIMS, ...LEGENDS].map((m) => m.id).sort());
  assert.deepEqual(Object.keys(A16.EMBLEM16).sort(), ENGRAVINGS.map((e) => e.id).sort());
  assert.deepEqual(Object.keys(A16.TACTIC16).sort(), TACTICS.map((x) => x.id).sort());
  assert.deepEqual(Object.keys(A16.SOUL7).sort(), SOULS.map((s) => s.id).sort());
  const sets = { ...A16.MAXIM16, ...A16.EMBLEM16, ...A16.TACTIC16, ...A16.SOUL7, SHARD16: A16.SHARD16, POTION16: A16.POTION16, ROULETTE16: A16.ROULETTE16, AWAKEN16: A16.AWAKEN16 };
  for (const [k, rows] of Object.entries(sets)) assert.ok(rows.every((r) => r.length === rows[0].length), `${k} 줄 길이`);
  for (const [k, rows] of Object.entries(A16.MAXIM16)) for (const ch of rows.join('')) assert.ok(ch === '.' || art.MAXIM_COL[ch], `${k} 낯선 문자 ${ch}`);
});

test('반 칸 그림: 원본의 두 배 크기, 원본 도트가 제 2×2 자리에 남는다(잉크 상자 = 원본의 두 배)', () => {
  const pairs = [
    ...Object.keys(A16.MAXIM16).map((k) => [k, A16.MAXIM16[k], HI.MAXIM_ART[k]]), ...Object.keys(A16.EMBLEM16).map((k) => [k, A16.EMBLEM16[k], HI.EMBLEM_ART[k]]),
    ...Object.keys(A16.TACTIC16).map((k) => [k, A16.TACTIC16[k], HI.TACTIC_ART[k]]), ...Object.keys(A16.SOUL7).map((k) => [k, A16.SOUL7[k], HI.SOUL_ART[k]]),
    ['shard', A16.SHARD16, HI.SHARD_ART], ['potion', A16.POTION16, HI.POTION_ART], ['roulette', A16.ROULETTE16, HI.ROULETTE_ART], ['awaken', A16.AWAKEN16, HI.AWAKEN_ART],
  ];
  for (const [k, lo, hi] of pairs) {
    assert.ok(hi, `${k} 반 칸 그림 없음 — node tools/art-hi.mjs`);
    assert.deepEqual([hi.length, hi[0].length], [lo.length * 2, lo[0].length * 2], `${k} 크기`);
    const a = inkBox(lo), b = inkBox(hi);
    assert.deepEqual(b, { x: a.x * 2, y: a.y * 2, w: a.w * 2, h: a.h * 2 }, `${k} 잉크 상자`);
  }
});

test('그림 칸: 모든 격언 · 각인 · 전술 · 혼 · 조각 · 도박 · 깨우기의 잉크가 과녁 안이고 칸 가운데(벗어남 0)', () => {
  const out = [];
  for (const it of allItems()) {
    const m = art.artMask(it);
    assert.ok(m, `${it.kind} ${it.id || ''} 그림 없음`);
    const b = inkBox(m.rows);
    const name = `${it.kind} ${it.id || ''} 잉크 ${b.w / 2}×${b.h / 2}`;
    if (!inTarget(b, 2)) out.push(name);
    const g = margins(ART.w * 2, ART.h * 2, b);
    assert.deepEqual([g.dx, g.dy], [0, 0], `${name} 벗어남`);
    assert.ok(g.L >= 4 && g.T >= 6, `${name} 여백`);
    // 빛깔표에 없는 문자는 그려지지 않는다
    for (const ch of new Set(m.rows.join(''))) assert.ok(ch === '.' || m.cols[ch], `${name} 문자 ${ch}`);
  }
  assert.deepEqual(out, [], `과녁(폭 ${TARGET.w} · 높이 ${TARGET.h}) 밖`);
});

test('두루마리 칸(18×22)에도 서는 그림: 각인 · 전술 · 혼 · 깨우기는 폭 16 · 높이 20 안', () => {
  for (const it of allItems().filter((x) => ['engraving', 'tactic', 'soul', 'awaken'].includes(x.kind))) {
    const b = inkBox(art.artMask(it).rows);
    assert.ok(b.w <= 32 && b.h <= 40, `${it.kind} ${it.id || ''} ${b.w / 2}×${b.h / 2}`);
    const g = margins(36, 44, b);
    assert.deepEqual([g.dx, g.dy], [0, 0]);
  }
});

test('종류 문양: 열 종류 모두 잉크 10×10 안', () => {
  assert.equal(Object.keys(kinds.KIND).length, 10);
  for (const [k, v] of Object.entries(kinds.KIND)) {
    const b = inkBox(v.g);
    assert.ok(b.w <= GLYPH && b.h <= GLYPH, `${k} ${b.w}×${b.h}`);
    const hb = inkBox(HI.KIND_HI[k]);
    assert.deepEqual([hb.w, hb.h], [b.w * 2, b.h * 2], `${k} 반 칸 문양`);
  }
});

test('기물 · 기보: 가로 잉크 자리를 스프라이트에서 잰다(1배 16 안 · 두 배 32 안)', () => {
  for (const t of ['P', 'N', 'B', 'R', 'Q', 'K', 'L']) {
    const lo = art.pieceBox(t, false), hi = art.pieceBox(t, true);
    assert.ok(lo.x >= 0 && lo.x + lo.w <= 16, `${t} 1배`);
    assert.ok(hi.x >= 0 && hi.x + hi.w <= 32, `${t} 두 배`);
  }
  assert.equal(art.artW({ kind: 'evolve' }), 44);
  assert.equal(art.artW({ kind: 'maxim' }), 22);
});
