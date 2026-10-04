// 두 배 도트(CHM-39, docs/design-notes/layout.md 「빛과 움직임」): 기물은 32×44 마스크를 16×22 자리에 반 도트로 그린다.
// 화면 배율 N = 1(또는 1배 오프스크린 캔버스)이면 16×22 마스크 그대로 — 32×44를 반으로 줄인 섞인 도트가 나오면 안 된다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, S, gfx, look, HI;
before(async () => {
  dom = await installDom();
  S = await import('../src/render/sprites.js');
  gfx = await import('../src/render/gfx.js');
  look = await import('../src/render/look.js');
  HI = (await import('../src/render/sprites-hi.js')).SPR_HI;
});
after(() => { delete globalThis.document; delete globalThis.window; });

const withN = (n, fn) => { const keep = look.LOOK.n; look.LOOK.n = n; try { return fn(); } finally { look.LOOK.n = keep; } };
// 그리기 호출을 적는 캔버스. scale을 주면 getTransform이 그 배율을 돌려준다
function rec(scale = null) {
  const calls = [];
  const base = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000' };
  if (scale != null) base.getTransform = () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
  const ctx = new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, calls };
}

test('32×44 마스크: 16×22 기물마다 하나씩, 44줄 × 32칸, 허용 문자만', () => {
  assert.deepEqual(Object.keys(HI).sort(), Object.keys(S.SPR).sort());
  for (const [k, rows] of Object.entries(HI)) {
    assert.equal(rows.length, 44, k);
    for (const r of rows) {
      assert.equal(r.length, 32, `${k} ${r}`);
      assert.match(r, /^[.#dcxl]+$/, `${k} ${r}`);
    }
    // 1배 마스크에 금빛 자리(c) · 흐린 몸(x)이 있으면 두 배에도 있다(같은 기물로 읽히게)
    for (const ch of ['c', 'x']) if (S.SPR[k].some((r) => r.includes(ch))) assert.ok(rows.some((r) => r.includes(ch)), `${k} ${ch}`);
  }
});

test('l(1px 줄)은 테 빛깔 한 점이고, 제 둘레에 테를 만들지 않는다', () => {
  const rows = HI.S;
  const px = new Map(S.spritePixelsHi('S').map(([x, y, t]) => [`${x},${y}`, t]));
  const isBody = (x, y) => rows[y] && rows[y][x] && rows[y][x] !== '.' && rows[y][x] !== 'l';
  let lines = 0, bare = 0;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === 'l') { lines++; assert.equal(px.get(`${x},${y}`), 'o'); }
    if (ch === '.' && !(isBody(x - 1, y) || isBody(x + 1, y) || isBody(x, y - 1) || isBody(x, y + 1))) { assert.ok(!px.has(`${x},${y}`), `${x},${y}`); bare++; }
  }));
  assert.ok(lines > 10 && bare > 0);
});

test('spriteCanvas: hi면 32×44, 아니면 16×22 · 캐시는 둘을 가른다', () => {
  for (const t of Object.keys(S.SPR)) {
    const lo = S.spriteCanvas(t, 'w', null, 0, false), hi = S.spriteCanvas(t, 'w', null, 0, true);
    assert.deepEqual([lo.width, lo.height], [16, 22], t);
    assert.deepEqual([hi.width, hi.height], [32, 44], t);
  }
  for (const [eng, tier] of [['gold', 0], ['glass', 3], ['feather', 2], [null, 1]]) {
    assert.equal(S.spriteCanvas('N', 'w', eng, tier, true).width, 32);
    assert.equal(S.spriteCanvas('N', 'w', eng, tier, false).width, 16);
  }
  const o = S.outlineCanvas('R', '#000', false, true), o1 = S.outlineCanvas('R', '#000', true, false);
  assert.deepEqual([o.width, o.height, o1.width, o1.height], [36, 48, 18, 24]);
});

test('gfx.sprite: N = 1이면 16×22 그림, N = 3이면 32×44 그림을 같은 16×22 자리에', () => {
  for (const [n, w] of [[1, 16], [2, 32], [3, 32], [4, 32]]) {
    withN(n, () => {
      const { ctx, calls } = rec();
      gfx.sprite(ctx, 'Q', 'b', 40, 30, { tier: 3, soul: 'echo', awake: true });
      const img = calls.filter((c) => c[0] === 'drawImage');
      const body = img[img.length - 1];
      assert.equal(body[1].width, w, `N ${n}`);
      assert.deepEqual(body.slice(2), [40, 30, 16, 22], `N ${n}`);
      // 반 도트 덧그림(기운 점 · 혼 기운)은 N ≥ 2에서 구운 그림을 정수 칸 상자에 — 0.5 칸 fillRect는 N = 3에서 번진다
      const half = calls.filter((c) => c[0] === 'fillRect' && c.slice(1).some((v) => v % 1));
      assert.equal(half.length, 0, `N ${n}`);
      if (n >= 2) for (const c of img) assert.ok(c.slice(2).every((v) => Number.isInteger(v)), `N ${n} ${c.slice(2)}`);
    });
  }
});

test('1배 캔버스에 그리면 N이 3이어도 16×22(타이틀 시연 판의 연출 같은 오프스크린)', () => {
  withN(3, () => {
    assert.equal(S.hiFor(rec(1).ctx), false);
    assert.equal(S.hiFor(rec(3).ctx), true);
    assert.equal(S.hiFor(rec(3).ctx, 0.6), false); // 멀리 작게 세운 기물(3 × 0.6 < 2)
    const { ctx, calls } = rec(1);
    gfx.sprite(ctx, 'K', 'w', 0, 0);
    assert.equal(calls.find((c) => c[0] === 'drawImage')[1].width, 16);
  });
  // N = 1이어도 두 배로 그리는 곳(사슬 칸의 큰 기물)은 32×44가 1:1
  withN(1, () => { assert.equal(S.hiFor(rec(1).ctx, 2), true); assert.equal(S.hiFor(rec().ctx), false); });
});

test('조각은 두 배에서도 16×22 칸 안의 자리', () => {
  for (const hi of [false, true]) {
    const chips = S.spriteChips('N', 'g', null, hi);
    assert.ok(chips.length > 20);
    for (const c of chips) assert.ok(c.x >= 0 && c.x < 16 && c.y >= 0 && c.y < 22 && Number.isInteger(c.x) && typeof c.col === 'string');
  }
});

// 특수 기물 다시 짜기(CHM-55, docs/design-notes/fairies.md): 뺀 넷(대주교 A · 재상 C · 야간기사 H · 메뚜기 G)은 그림이 없고,
// 새 다섯(꺾쇠 T · 물수제비 E · 까마귀 V · 광대 M · 화약병 D)은 1배 · 두 배 둘 다 있다
const FAIRY_ART = ['L', 'O', 'S', 'W', 'Z', 'T', 'E', 'V', 'M', 'D'];
test('특수 기물 그림: 남는 다섯 + 새 다섯, 뺀 넷은 없다', async () => {
  const { FAIRY_SPR } = await import('../src/render/fairy-sprites.js');
  const fairy = Object.keys(FAIRY_SPR).filter((k) => k !== 'X' && k !== 'J'); // 벽 · 보석은 판 위 사물
  assert.deepEqual(fairy.sort(), [...FAIRY_ART].sort());
  for (const t of FAIRY_ART) { assert.ok(S.SPR[t], `1배 ${t}`); assert.ok(HI[t], `두 배 ${t}`); }
  for (const t of ['A', 'C', 'H', 'G']) { assert.ok(!S.SPR[t], `1배 ${t}`); assert.ok(!HI[t], `두 배 ${t}`); }
});
test('data의 기물은 모두 그림이 있다', async () => {
  const { PIECES } = await import('../src/data/pieces.js');
  for (const t of Object.keys(PIECES)) {
    assert.ok(S.SPR[t] && HI[t], t);
  }
});
