// 두 배 도트 2단계(CHM-39): 격언 아이콘 · 종류 딱지 문양 · 세력 문장 · 카드 그림 · 초상을 화면 배율 2 이상에서 반 도트로 그린다.
// 1배(N = 1) 화면은 옛 그림 그대로 — 두 배로 크게 그리는 곳(좁은 격언 칸 24×24 · 문장 2배 · 마스터 띠 초상 2배)만 두 배 그림이 1:1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let dom, HI, icons, kinds, crests, parts, portraits, gfx, factions;
const fills = []; // 초상 1배 캔버스에 쓴 빛깔
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  // 캔버스마다 fillStyle을 적는다(초상 1배 빛깔 모으기)
  setCanvasFactory(() => {
    const c = dom.document.createElement('canvas');
    const real = c.getContext();
    const ctx = new Proxy(real, { set(t, k, v) { if (k === 'fillStyle') fills.push(v); t[k] = v; return true; } });
    c.getContext = () => ctx;
    return c;
  });
  HI = await import('../src/render/art-hi.js');
  icons = await import('../src/render/icons.js');
  kinds = await import('../src/ui/kinds.js');
  crests = await import('../src/render/crests.js');
  parts = await import('../src/ui/parts.js');
  portraits = await import('../src/render/portraits.js');
  gfx = await import('../src/render/gfx.js');
  factions = await import('../src/data/factions.js');
});
after(() => { delete globalThis.document; delete globalThis.window; });

// 그리기 호출을 적는 캔버스. getTransform이 배율 scale을 돌려준다(화면 배율 N과 같다)
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
const halfFills = (calls) => calls.filter((c) => c[0] === 'fillRect' && c.slice(1).some((v) => v % 1));

// 원래 마스크 → 두 배 마스크: 크기 2배 · 원래 문자만 · 도트 하나의 빛깔이 제 2×2 반 도트에 남는다(다듬기가 지운 도트가 없다)
function checkPair(name, lo, hi, width = null) {
  const rows = width ? lo.map((r) => r.padEnd(width, '.')) : lo;
  const w = rows[0].length, h = rows.length;
  assert.equal(hi.length, h * 2, `${name} 줄 수`);
  const chars = new Set(['.', ...rows.join('')]);
  hi.forEach((r, y) => {
    assert.equal(r.length, w * 2, `${name} ${y}줄 폭`);
    for (const ch of r) assert.ok(chars.has(ch), `${name} 낯선 문자 ${ch}`);
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    const blk = [hi[2 * y][2 * x], hi[2 * y][2 * x + 1], hi[2 * y + 1][2 * x], hi[2 * y + 1][2 * x + 1]];
    assert.ok(blk.filter((c) => c === ch).length >= 2, `${name} (${x},${y}) ${ch} → ${blk.join('')}`);
  }
}

test('두 배 마스크: 원래 그림마다 하나씩, 크기 2배, 원래 문자만, 빠진 도트 없음', () => {
  assert.deepEqual(Object.keys(HI.ICON_HI).sort(), [...icons.ICON_IDS].sort());
  for (const id of icons.ICON_IDS) checkPair(`icon ${id}`, icons.ICON_ROWS[id], HI.ICON_HI[id]);
  assert.deepEqual(Object.keys(HI.KIND_HI).sort(), Object.keys(kinds.KIND).sort());
  for (const [k, v] of Object.entries(kinds.KIND)) checkPair(`kind ${k}`, v.g, HI.KIND_HI[k]);
  assert.deepEqual(Object.keys(HI.CREST_HI).sort(), Object.keys(crests.CREST).sort());
  for (const [k, v] of Object.entries(crests.CREST)) checkPair(`crest ${k}`, v, HI.CREST_HI[k]);
  assert.deepEqual(Object.keys(HI.TACTIC_HI).sort(), Object.keys(parts.TACTIC_G).sort());
  for (const [k, v] of Object.entries(parts.TACTIC_G)) checkPair(`tactic ${k}`, v, HI.TACTIC_HI[k], 16);
  // 명경기 조각: 8×7을 2도트씩 그린 16×14 → 두 번 다듬은 32×28
  assert.equal(HI.SHARD_HI.length, 28);
  for (const r of HI.SHARD_HI) assert.match(r, /^[.chd]{32}$/);
});

// 초상 1배 캔버스는 처음 만들 때 빛깔을 모은다 — 다른 시험이 먼저 만들면 캐시에서 나와 빛깔이 비므로 앞에 둔다
test('초상 두 배: 64×64, 1배 그림의 빛깔만(안개의 반투명 줄은 아래 빛깔과 섞인다)', () => {
  for (const id of portraits.PORTRAIT_IDS) {
    fills.length = 0;
    const lo = portraits.portraitCanvas(id, false);
    assert.deepEqual([lo.width, lo.height], [32, 32]);
    const loCols = new Set(fills.filter((f) => typeof f === 'string' && f[0] === '#').map((f) => f.toLowerCase()));
    const translucent = fills.some((f) => typeof f === 'string' && f.startsWith('rgba'));
    const cells = portraits.portraitCellsHi(id);
    assert.equal(cells.length, 64 * 64);
    const hiCols = new Set(cells.filter(Boolean).map((v) => v.split('@')[0]));
    const strange = [...hiCols].filter((c) => !loCols.has(c));
    if (!translucent) assert.deepEqual(strange, [], id);
    else assert.ok(strange.length <= 4, `${id} 섞인 빛깔 ${strange}`);
    // 비어 있지 않고(얼굴이 있다) 1배보다 칸이 네 배쯤
    const n = cells.filter(Boolean).length;
    assert.ok(n > 1500, `${id} ${n}`);
    assert.deepEqual([portraits.portraitCanvas(id, true).width, portraits.portraitCanvas(id, true).height], [64, 64]);
  }
});

test('그리는 곳: N = 1은 옛 그림, N = 3은 두 배 그림을 같은 자리에(반 칸 fillRect 없음)', () => {
  const fid = factions.FACTIONS[0].id;
  const cases = [
    ['아이콘', (ctx) => icons.drawIcon(ctx, 'chivalry', 10, 20), [12, 24], [10, 20, 12, 12]],
    ['문장', (ctx) => crests.drawCrest(ctx, fid, 10, 20), [null, 24], [10, 20, 12, 12]],
    ['전술', (ctx) => parts.tacticIcon(ctx, 'freeze', 10, 20), [null, 32], [10, 20, 16, 11]],
    ['명경기 조각', (ctx) => parts.shardIcon(ctx, 10, 20), [null, 32], [10, 20, 16, 14]],
    ['종류 딱지', (ctx) => kinds.kindTab(ctx, 'chart', 10, 20), [null, 24], [11, 21, 12, 12]],
    ['종류 띠', (ctx) => kinds.kindBand(ctx, 'tactic', 10, 20, 26), [null, 24], [11, 27, 12, 12]],
    ['초상', (ctx) => portraits.drawPortrait(ctx, 'fog', 10, 20), [32, 64], [10, 20, 32, 32]],
  ];
  for (const [name, draw, [loW, hiW], box] of cases) {
    const lo = rec(1);
    draw(lo.ctx);
    const li = images(lo.calls);
    if (loW == null) assert.equal(li.length, 0, `${name} 1배는 도트로 찍는다`);
    else assert.equal(li[li.length - 1][1].width, loW, `${name} 1배`);
    const hi = rec(3);
    draw(hi.ctx);
    const hiImg = images(hi.calls);
    assert.equal(hiImg.length, 1, `${name} 3배는 그림 하나`);
    assert.equal(hiImg[0][1].width, hiW, `${name} 3배`);
    assert.deepEqual(hiImg[0].slice(2), box, `${name} 자리`);
    assert.equal(halfFills(hi.calls).length, 0, `${name} 반 칸 fillRect`);
  }
});

test('두 배로 크게 그리는 곳은 N = 1에서도 두 배 그림이 1:1(문장 2배 · 초상 2배)', () => {
  const fid = factions.FACTIONS[0].id;
  const c = rec(1);
  crests.drawCrest(c.ctx, fid, 0, 0, { scale: 2 });
  assert.deepEqual([images(c.calls)[0][1].width, ...images(c.calls)[0].slice(4)], [24, 24, 24]);
  const p = rec(1);
  portraits.drawPortrait(p.ctx, 'grandmaster', 0, 0, 2);
  assert.deepEqual([images(p.calls)[0][1].width, ...images(p.calls)[0].slice(4)], [64, 64, 64]);
});

test('격언 칸 그림: 3배는 그림 칸 20 × 22를 구운 그림 하나(40 × 44)로 정수 칸에, 좁은 칸은 가운데 · 1배는 옛 아이콘', () => {
  const C = parts.MAXIM_CELL;
  assert.deepEqual([C.w, C.h], [20, 22]);
  for (const [narrow, w, ax] of [[false, 112, 112 - C.inset - C.w], [true, 54, (54 - C.w) / 2]]) {
    const h = rec(3);
    parts.maximCard(h.ctx, { id: 'chivalry', uid: 1, data: {} }, 0, 0, w, 28, { narrow });
    const im = images(h.calls).filter((x) => x[1].width === C.w * 2 && x[1].height === C.h * 2);
    assert.equal(im.length, 1, `좁은 칸 ${narrow}`);
    assert.deepEqual(im[0].slice(2), [ax, 3, C.w, C.h]);
    const lo = rec(1);
    parts.maximCard(lo.ctx, { id: 'chivalry', uid: 1, data: {} }, 0, 0, w, 28, { narrow });
    assert.ok(images(lo.calls).some((x) => x[1].width === 12 && x[4] === 12), '1배는 옛 12×12 아이콘');
  }
});

test('꾸러미 봉투: 구운 그림 하나를 정수 칸에(3배는 반 칸 도트, 열리면 위로 솟을 자리만큼 크다)', async () => {
  const env = await import('../src/ui/envelope.js');
  for (const [n, u] of [[1, 1], [3, 2]]) {
    const h = rec(n);
    env.envelope(h.ctx, 10, 20, 28, 22, 'chart');
    env.envelope(h.ctx, 50, 20, 96, 66, 'golden', { open: 0.4 });
    const im = images(h.calls);
    assert.equal(im.length, 2);
    assert.deepEqual([im[0][1].width, im[0][1].height, ...im[0].slice(2)], [28 * u, 22 * u, 10, 20, 28, 22]);
    assert.deepEqual([im[1][1].width, im[1][1].height, ...im[1].slice(2)], [96 * u, (66 + env.ENV_RISE) * u, 50, 20 - env.ENV_RISE, 96, 66 + env.ENV_RISE]);
    assert.equal(halfFills(h.calls).length, 0);
  }
});

test('타이틀 시연 판: 기물 그림을 판 하나에 하나로(hi를 주면 줄마다 배율이 달라도 같은 그림)', () => {
  for (const sy of [0.75, 0.9, 1.1]) {
    const r = rec(2);
    gfx.sprite(r.ctx, 'N', 'w', 0, 0, { sx: sy, sy, hi: true });
    assert.equal(images(r.calls).pop()[1].width, 32, `sy ${sy}`);
  }
});

test('주사위(설정 「다시 짓기」, CHM-70): 반 칸 그림은 1배 그림과 짝 · 잉크가 7×7 자리를 꽉 채운다 · 배율에 맞는 그림을 7×7 자리에 찍는다', async () => {
  const D = await import('../src/render/dice.js');
  const { inkBox } = await import('../src/render/ink.js');
  checkPair('dice', D.DICE_ROWS, D.DICE_HI);
  assert.deepEqual(inkBox(D.DICE_ROWS), { x: 0, y: 0, w: D.DICE, h: D.DICE });
  assert.deepEqual(inkBox(D.DICE_HI), { x: 0, y: 0, w: D.DICE * 2, h: D.DICE * 2 });
  // 눈 다섯(네 귀 · 가운데)은 두 배에서도 뚫려 있다
  for (const [x, y] of [[1, 1], [5, 1], [3, 3], [1, 5], [5, 5]]) { assert.equal(D.DICE_ROWS[y][x], '.'); assert.equal(D.DICE_HI[y * 2][x * 2], '.'); }
  const draws = [];
  const ctx = (scale) => ({ getTransform: () => ({ a: scale, b: 0 }), drawImage: (c, x, y, w, h) => draws.push([c.width, c.height, x, y, w, h]) });
  D.diceIcon(ctx(1), 10, 20, '#fff');
  D.diceIcon(ctx(3), 10, 20, '#fff');
  assert.deepEqual(draws, [[7, 7, 10, 20, 7, 7], [14, 14, 10, 20, 7, 7]]);
});
