// CHM-57: 특수 기물 연출의 길(src/ui/fxroute.js) — 꺾쇠 · 물수제비가 꺾은 칸(via)을 거쳐 지나는 칸 목록, 까마귀 넘기 · 궁수 쏘기의 길,
// 결과 다시 보기의 판 상태(터진 적 지움 · 궁수 제자리 · 꺾인 길), 대국 화면이 다시 보기용으로 남기는 기록
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { boardFrom, parseSq as S, sqName, captures, pathVia, TURNS, BOUNCES, emptyBoard } from '../src/sim/board.js';
import { createRng, int, next } from '../src/sim/rng.js';
import { capRoute, routeSquares, routeAt, routeLen, bendDur, replayState, isShot } from '../src/ui/fxroute.js';

const F = (s) => s & 7, R = (s) => s >> 3;
const names = (list) => list.map(sqName);
const edge = (s) => F(s) === 0 || F(s) === 7 || R(s) === 0 || R(s) === 7;

test('꺾쇠: 두 번 꺾는 길은 축이 번갈아 꺾은 칸 둘을 거친다', () => {
  // b2 → e5: 곧장 꺾는 칸 b5 · e2를 적으로 막아 두 번 꺾어야 닿는다
  const b = boardFrom({ e5: 'N', b5: 'P', e2: 'P', h8: 'K' });
  b[S('b2')] = { t: 'T', mine: true };
  assert.ok(captures(b, 'T', S('b2')).includes(S('e5')));
  const via = pathVia(b, 'T', S('b2'), S('e5'));
  assert.ok(via >= 0);
  const r = capRoute({ from: S('b2'), to: S('e5'), at: S('e5'), via, form: 'T' });
  assert.equal(r.kind, 'bend');
  assert.equal(r.pts.length, 4, `꺾은 칸 둘: ${names(r.pts)}`);
  assert.equal(r.pts[2], via);
  const sqs = routeSquares(r.pts);
  assert.equal(sqs.at(-1), S('e5'));
  for (const s of sqs.slice(0, -1)) assert.equal(b[s], null, `${sqName(s)}는 빈칸`);
  // 한 번 꺾는 길: a1 → d4(a4로 올라가 오른쪽)
  const one = capRoute({ from: S('a1'), to: S('d4'), at: S('d4'), via: S('a4'), form: 'T' });
  assert.deepEqual(names(one.pts), ['a1', 'a4', 'd4']);
  assert.deepEqual(names(routeSquares(one.pts)), ['a2', 'a3', 'a4', 'b4', 'c4', 'd4']);
  // 두 번(손으로): a1 → b1 → b4 → d4? 마지막 걸음 가로(b4 → d4), from은 b줄에 없으니 첫 꺾음은 (b, 1)
  assert.deepEqual(names(capRoute({ from: S('a1'), to: S('d4'), at: S('d4'), via: S('b4'), form: 'T' }).pts), ['a1', 'b1', 'b4', 'd4']);
});

test('물수제비: 가장자리에서 튕긴 길(한 번 · 두 번)을 거꾸로 되짚는다', () => {
  // c1 → a3에서 튕겨 → d6
  assert.deepEqual(names(capRoute({ from: S('c1'), to: S('d6'), at: S('d6'), via: S('a3'), form: 'E' }).pts), ['c1', 'a3', 'd6']);
  // 두 번: b2 → a3(튕김) → f8(튕김) → h6
  const two = capRoute({ from: S('b2'), to: S('h6'), at: S('h6'), via: S('f8'), form: 'E' });
  assert.deepEqual(names(two.pts), ['b2', 'a3', 'f8', 'h6']);
  assert.deepEqual(names(routeSquares(two.pts)), ['a3', 'b4', 'c5', 'd6', 'e7', 'f8', 'g7', 'h6']);
  // 가장자리에 선 채 출발(그 칸에서는 튕기지 않는다): a3 → f8 → h6
  assert.deepEqual(names(capRoute({ from: S('a3'), to: S('h6'), at: S('h6'), via: S('f8'), form: 'E' }).pts), ['a3', 'f8', 'h6']);
  // 곧게 닿으면(via -1) 꺾지 않는다
  assert.equal(capRoute({ from: S('c1'), to: S('f4'), at: S('f4'), via: -1, form: 'E' }).kind, 'line');
});

test('무작위 판 3000: 규칙이 먹는 칸마다 되짚은 길이 행마 모양 · 꺾음 수 · 빈칸을 지킨다', () => {
  const rng = createRng(57);
  let two = { T: 0, E: 0 }, bent = { T: 0, E: 0 }, total = 0;
  for (let n = 0; n < 3000; n++) {
    const form = n % 2 ? 'E' : 'T';
    const b = emptyBoard();
    const k = 4 + int(rng, 10);
    for (let i = 0; i < k; i++) { const s = int(rng, 64); b[s] = { t: next(rng) < 0.12 ? 'X' : 'P', id: i }; }
    let from = int(rng, 64);
    while (b[from]) from = (from + 1) % 64;
    b[from] = { t: form, mine: true };
    for (const to of captures(b, form, from)) {
      total++;
      const via = pathVia(b, form, from, to);
      const r = capRoute({ from, to, at: to, via, form });
      const pts = r.pts, corners = pts.slice(1, -1);
      assert.equal(pts[0], from); assert.equal(pts.at(-1), to);
      if (via < 0) { assert.equal(corners.length, 0); continue; }
      bent[form]++;
      assert.equal(corners.at(-1), via, '마지막 꺾음 = via');
      assert.ok(corners.length <= (form === 'T' ? TURNS : BOUNCES));
      if (corners.length === 2) two[form]++;
      for (let i = 0; i + 1 < pts.length; i++) {
        const df = F(pts[i + 1]) - F(pts[i]), dr = R(pts[i + 1]) - R(pts[i]);
        if (form === 'T') assert.ok((df === 0) !== (dr === 0), `가로 · 세로 걸음 ${names(pts)}`);
        else assert.ok(df !== 0 && Math.abs(df) === Math.abs(dr), `대각 걸음 ${names(pts)}`);
      }
      if (form === 'T') for (let i = 1; i + 1 < pts.length; i++) { const a = F(pts[i]) === F(pts[i - 1]), c = F(pts[i + 1]) === F(pts[i]); assert.notEqual(a, c, `축이 번갈아 ${names(pts)}`); }
      else for (const c of corners) assert.ok(edge(c), `튕긴 칸은 가장자리 ${names(pts)}`);
      for (const s of routeSquares(pts).slice(0, -1)) assert.ok(!b[s], `지나는 칸은 빈칸 ${names(pts)} · ${sqName(s)}`);
    }
  }
  assert.ok(total > 3000 && bent.T > 100 && bent.E > 100, JSON.stringify({ total, bent }));
  assert.ok(two.T > 20 && two.E > 20, `두 번 꺾은 길도 나온다 ${JSON.stringify(two)}`);
});

test('까마귀 넘기 · 궁수 쏘기 · 광대가 흉내 낸 꺾쇠의 길', () => {
  const hop = capRoute({ from: S('d4'), to: S('e5'), at: S('f6'), form: 'N', hop: true });
  assert.equal(hop.kind, 'hop'); assert.deepEqual(names(hop.pts), ['d4', 'f6']); assert.equal(hop.over, S('e5'));
  const shot = capRoute({ from: S('d4'), to: S('d6'), at: S('d4'), form: 'S', stay: true });
  assert.equal(shot.kind, 'shot'); assert.deepEqual(shot.pts, [S('d4')]);
  assert.ok(isShot({ from: S('d4'), to: S('d6'), at: S('d4') }), '옛 기록: 서는 칸 = 출발 칸이면 쏘기');
  assert.ok(!isShot({ from: S('d4'), to: S('d6') }), 'at이 없는 옛 기록은 움직인 것');
  assert.equal(capRoute({ from: S('a1'), to: S('d4'), at: S('d4'), via: S('a4'), form: 'M', move: 'T' }).kind, 'bend');
});

test('길 위 자리: 꺾는 칸에서 잠깐 서고, 연출 시간은 0.42초 안', () => {
  const pts = [S('b2'), S('a3'), S('f8'), S('h6')];
  let stops = new Set(), lastLeg = 0;
  for (let i = 0; i <= 200; i++) {
    const a = routeAt(pts, i / 200);
    assert.ok(a.i >= lastLeg, '걸음은 뒤로 가지 않는다'); lastLeg = a.i;
    if (a.corner > 0) stops.add(a.corner);
  }
  assert.deepEqual([...stops].sort(), [1, 2]);
  assert.deepEqual(routeAt(pts, 1), { i: 2, k: 1, corner: -1 });
  assert.equal(routeLen(pts), 8);
  assert.ok(bendDur(pts) <= 0.42 && bendDur([S('a1'), S('a4'), S('d4')]) < bendDur(pts));
});

// 결과 다시 보기의 판 상태
const replay = (drop, caps, board = {}) => ({ drop, caps, board: boardFrom(board), score: 1, reason: 'end' });
test('다시 보기: 화약병에 터진 적은 판에서 지운다', () => {
  const r = replay({ sq: S('d5'), piece: 'D' }, [{ from: S('d5'), to: S('c6'), at: S('c6'), piece: 'N', form: 'D', after: 'D', gone: [S('b7'), S('c7'), S('d7')] }],
    { c6: 'N', b7: 'R', c7: 'P', d7: 'B', h8: 'K' });
  const mid = replayState(r, 0, 0.5);
  assert.equal(mid.gone.size, 0, '닿기 전에는 그대로');
  const end = replayState(r, 1, 0);
  assert.deepEqual([...end.gone].sort((a, b) => a - b), [S('c6'), S('b7'), S('c7'), S('d7')].sort((a, b) => a - b));
  assert.ok(!end.gone.has(S('h8')), '킹은 남는다');
  assert.equal(end.pos, S('c6'));
});
test('다시 보기: 궁수는 제자리에서 쏘고 먹힌 칸만 빈다', () => {
  const r = replay({ sq: S('d4'), piece: 'S' }, [
    { from: S('d4'), to: S('d6'), at: S('d4'), piece: 'N', form: 'S', after: 'N', stay: true },
    { from: S('d4'), to: S('f5'), at: S('f5'), piece: 'B', form: 'N', after: 'B' },
  ], { d6: 'N', f5: 'B' });
  const s1 = replayState(r, 1, 0);
  assert.equal(s1.pos, S('d4'), '궁수는 움직이지 않는다');
  assert.equal(s1.form, 'N');
  assert.deepEqual(s1.shots, [[S('d4'), S('d6')]]);
  assert.equal(s1.trail.length, 0, '쏘기는 지나온 길이 아니다');
  assert.ok(s1.gone.has(S('d6')));
  const mid = replayState(r, 0, 0.5);
  assert.equal(mid.pos, S('d4')); assert.equal(mid.route.kind, 'shot'); assert.ok(!mid.gone.has(S('d6')));
  const s2 = replayState(r, 2, 0);
  assert.equal(s2.pos, S('f5')); assert.deepEqual(s2.trail, [[S('d4'), S('f5')]]);
});
test('다시 보기: 꺾인 길 · 넘기는 길 위로(넘은 적은 가운데쯤 지운다)', () => {
  const r = replay({ sq: S('b2'), piece: 'T' }, [
    { from: S('b2'), to: S('e5'), at: S('e5'), via: S('c5'), piece: 'V', form: 'T', after: 'V' },
    { from: S('e5'), to: S('f6'), at: S('g7'), piece: 'P', form: 'V', after: 'P' },
  ], { e5: 'V', f6: 'P' });
  const s1 = replayState(r, 1, 0);
  assert.deepEqual(names(s1.trail[0]), ['b2', 'c2', 'c5', 'e5']);
  const hopA = replayState(r, 1, 0.4), hopB = replayState(r, 1, 0.6);
  assert.equal(hopA.route.kind, 'hop');
  assert.ok(!hopA.gone.has(S('f6')) && hopB.gone.has(S('f6')));
  assert.equal(hopB.pos, S('e5'), '닿기 전 자리는 출발 칸');
  assert.equal(replayState(r, 2, 0).pos, S('g7'));
});

// 대국 화면이 남기는 다시 보기 기록(BattleScreen.record)
let battle;
before(async () => {
  await installDom();
  battle = await import('../src/ui/screens/battle.js');
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); });

test('기록: 꺾은 칸 · 넘기 · 쏘기 · 터진 적이 다시 보기 기록에 남는다', () => {
  const me = { rec: { board: [], drop: { sq: S('d5'), piece: 'T' }, caps: [] } }, run = { bestReplay: null };
  battle.BattleScreen.prototype.record.call(me, [
    { type: 'capture', from: S('b2'), to: S('e5'), at: S('e5'), via: S('c5'), piece: 'V', form: 'T' },
    { type: 'transform', sq: S('e5'), from: 'T', to: 'V' },
    { type: 'capture', from: S('e5'), to: S('f6'), at: S('g7'), via: -1, piece: 'S', form: 'V' },
    { type: 'capture', from: S('g7'), to: S('g5'), at: S('g7'), via: -1, piece: 'D', form: 'S', stay: true },
    { type: 'capture', from: S('g7'), to: S('h8'), at: S('h8'), via: -1, piece: 'N', form: 'D' },
    { type: 'explode', sq: S('h8'), at: S('h8'), squares: [S('g8')], pieces: ['P'] },
    { type: 'pierce', sq: S('g8'), piece: 'P', src: 'powder' },
    { type: 'end', score: 99, reason: 'blast' },
  ], run);
  const c = run.bestReplay.caps;
  assert.equal(c[0].via, S('c5')); assert.equal(c[0].after, 'V');
  assert.equal(c[1].via, undefined, '곧은 길은 via를 남기지 않는다');
  assert.equal(c[2].stay, true);
  assert.deepEqual(c[3].gone, [S('g8')]);
  assert.equal(run.bestReplay.reason, 'blast');
});
