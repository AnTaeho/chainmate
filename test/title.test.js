// 첫 화면(CHM-49, docs/design-notes/layout.md 「첫 화면」): 하늘의 사슬 시간표 · 먹는 차례와 모습 바뀜 · 움직임 줄이기 정지 · 메뉴 구역
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, S, T, N, LOOK;
before(async () => {
  dom = await installDom();
  S = await import('../src/ui/skychain.js');
  T = await import('../src/ui/screens/title.js');
  N = await import('../src/render/night.js');
  LOOK = (await import('../src/render/look.js')).LOOK;
});
after(() => { delete globalThis.document; delete globalThis.window; });

const CHESS = new Set(['P', 'N', 'B', 'R', 'Q', 'K']);

test('하늘의 사슬: 같은 시각이면 같은 장면(무작위 없음)', () => {
  for (const t of [0, 0.3, 0.71, 1.0, 2.37, S.CYC - 0.01, S.CYC * 3 + 4.4, 123.456]) {
    assert.deepEqual(S.skyScene(t), S.skyScene(t));
    assert.deepEqual(S.skyShake(t, S.skyScene(t).shake), S.skyShake(t, S.skyScene(t).shake));
  }
  // 흔들림은 정수 도트, 세기를 넘지 않는다
  for (let t = 0; t < S.CYC * 2; t += 0.013) {
    const st = S.skyScene(t), [dx, dy] = S.skyShake(t, st.shake);
    assert.ok(Number.isInteger(dx) && Number.isInteger(dy));
    assert.ok(Math.abs(dx) <= Math.ceil(st.shake) && Math.abs(dy) <= Math.ceil(st.shake));
  }
});

test('하늘의 사슬: 폰이 위에서 떨어져 다섯을 차례로 먹고, 먹을 때마다 먹은 기물 모습이 된다', () => {
  for (const round of [0, 1, 2, 7]) {
    const t0 = round * S.CYC;
    const drop = S.skyScene(t0 + 0.01);
    assert.equal(drop.hero.t, 'P');
    assert.ok(drop.hero.y < 0, '위에서 떨어진다');
    assert.deepEqual(drop.eaten, []);
    const order = S.orderOf(round);
    assert.equal(new Set(order).size, 5, '다섯 자리는 모두 다르다');
    for (let s = 1; s <= 5; s++) {
      // s번째를 먹은 직후(멈칫 중)
      const st = S.skyScene(t0 + S.DROP + (s - 1) * S.STEP + S.A_ANT + S.A_DASH + 0.02);
      const want = order.slice(0, s);
      assert.deepEqual(st.eaten, want, `${round}판 ${s}번째 먹은 자리`);
      const e = st.enemies[order[s - 1]];
      assert.equal(st.hero.t, e.t, '먹은 기물로 바뀐다');
      assert.ok(CHESS.has(e.t));
      assert.equal(st.hero.white, 1, '닿는 순간 하얗게 번쩍');
      assert.ok(st.shake > 0, '흔들림');
      const hit = st.hits.find((h) => h.n === s + 1 && !h.dust);
      assert.ok(hit && hit.type === e.t, `×${s + 1}`);
      assert.equal(st.flashAll > 0, s === 5, '화면 번쩍임은 다섯째만');
    }
    // 사슬이 길수록 흔들림이 세다
    const shakeAt = (s) => S.skyScene(t0 + S.DROP + (s - 1) * S.STEP + S.A_ANT + S.A_DASH + 0.001).shake;
    for (let s = 2; s <= 5; s++) assert.ok(shakeAt(s) > shakeAt(s - 1), `흔들림 ${s}`);
    // 다섯 뒤 사라진다
    assert.equal(S.skyScene(t0 + S.CYC - 0.01).hero.alpha, 0);
  }
});

test('하늘의 사슬: 멈칫 동안 떠다님도 선다, 다섯째 멈칫은 2.5배', () => {
  const at = (s, d) => S.skyScene(S.DROP + (s - 1) * S.STEP + S.A_ANT + S.A_DASH + d).enemies.map((e) => [e.x, e.y]);
  assert.deepEqual(at(1, 0.01), at(1, 0.07));
  assert.notDeepEqual(at(1, 0.01), at(1, 0.15));
  assert.deepEqual(at(5, 0.01), at(5, 0.19));
});

// 그리기 호출을 적는 캔버스
function rec() {
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false, fillStyle: '#000' }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a.map((v) => (v && typeof v === 'object' ? `${v.width}x${v.height}` : v))]); }; },
    set(t, k, v) { if (k === 'globalAlpha' || k === 'fillStyle') calls.push([`=${k}`, v]); t[k] = v; return true; },
  });
  return { ctx, calls };
}
async function makeApp({ save = false, calm = false } = {}) {
  const { createApp } = await import('../src/ui/app.js');
  const app = createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage, reducedMotion: calm });
  app.hasSave = () => save;
  app.go('title');
  return app;
}
function drawTitle(app, ctx) {
  app.ui.begin();
  app.screen.draw(ctx, app.ui);
  const ids = app.ui.regions.map((r) => r.id);
  app.ui.end();
  return ids;
}

test('움직임 줄이기: 하늘의 사슬 · 흔들림 · 번쩍임 · 로고 · 실루엣이 한 장면으로 선다(별 · 단추는 그대로)', async () => {
  const app = await makeApp({ calm: true });
  const scr = app.screen;
  const a = rec(), b = rec();
  app.time = 5; scr.T = 3.1; drawTitle(app, a.ctx);
  app.time = 5; scr.T = 9.73; drawTitle(app, b.ctx);
  assert.deepEqual(a.calls, b.calls, '사슬 시계가 흘러도 같은 그림');
  const f = scr.sky();
  assert.deepEqual(f.shake, [0, 0]);
  assert.equal(f.flash, 0);
  assert.equal(f.st.hits.length, 0);
  // 여백 판의 움직이는 층: 실루엣 · 흔들림 열쇠가 같다(별 반짝임 몫만 바뀐다)
  scr.T = 3.1; const k1 = scr.surroundScene().live.key; scr.T = 50; const k2 = scr.surroundScene().live.key;
  assert.equal(k1, k2);
  // 별은 반짝인다: 시각이 바뀌면 그림이 바뀐다
  const c = rec(); app.time = 5.6; drawTitle(app, c.ctx);
  assert.notDeepEqual(a.calls, c.calls);
  // 움직임 줄이기가 아니면 사슬 시계로 그림이 바뀐다
  const live = await makeApp();
  const d = rec(), e = rec();
  live.time = 5; live.screen.T = 3.1; drawTitle(live, d.ctx);
  live.time = 5; live.screen.T = 3.6; drawTitle(live, e.ctx);
  assert.notDeepEqual(d.calls, e.calls);
});

test('메뉴: 구역 일곱(저장 있음) · 여섯(저장 없음), 주인공 단추가 먼저, 키보드로 고른다', async () => {
  const ALL = ['title:continue', 'title:new', 'title:lesson', 'title:daily', 'title:codex', 'title:records', 'title:settings'];
  for (const n of [1, 2, 3]) {
    LOOK.n = n;
    const yes = await makeApp({ save: true });
    const ids = drawTitle(yes, rec().ctx);
    assert.deepEqual(ids, ALL, `저장 있음 N ${n}`);
    assert.equal(yes.screen.items()[0][0], 'title:continue');
    const no = await makeApp({ save: false });
    const ids2 = drawTitle(no, rec().ctx);
    assert.deepEqual(ids2, ALL.slice(1), `저장 없음 N ${n}`);
    assert.equal(no.screen.items()[0][0], 'title:new');
  }
  LOOK.n = 1;
  // 구역: 화면 안, 서로 겹치지 않고, 아이콘 칸은 누르기 쉬운 크기(높이 44 · 폭 60 이상)
  const app = await makeApp({ save: true });
  drawTitle(app, rec().ctx);
  const rs = app.ui.regions;
  for (const r of rs) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 480 && r.y + r.h <= 270, r.id);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} · ${b.id} 겹침`);
  }
  for (const r of rs.slice(1)) assert.ok(r.h >= 44 && r.w >= 60, `${r.id} ${r.w}×${r.h}`);
  assert.ok(rs[0].h >= 30 && rs[0].w >= 112);
  // 키보드: 아래 → 줄, 좌우 → 옆 칸, 위 → 주인공, Enter → 그 항목
  const scr = app.screen;
  assert.equal(scr.sel, 0);
  scr.key('ArrowDown'); assert.equal(scr.sel, 1);
  scr.key('ArrowRight'); scr.key('ArrowRight'); assert.equal(scr.sel, 3);
  scr.key('ArrowUp'); assert.equal(scr.sel, 0);
  scr.key('ArrowDown'); assert.equal(scr.sel, 3, '줄로 돌아가면 고르던 칸');
  scr.key('ArrowLeft'); scr.key('ArrowLeft'); scr.key('ArrowLeft'); assert.equal(scr.sel, 0);
  scr.key('ArrowLeft'); assert.equal(scr.sel, 6, '왼쪽 끝에서 돌아 줄 끝');
  scr.key('Enter');
  assert.equal(app.overlay && app.overlay.name, 'settings');
});

test('하늘의 사슬 그림: 기물 한 칸은 기기 화소 정수, N = 1은 16×22 그림', () => {
  for (const n of [1, 2, 3, 4]) {
    const sc = N.skyScale(n);
    assert.equal(sc.hi, n >= 2);
    if (n >= 2) assert.ok(Number.isInteger(Math.round(sc.u * n * 1e9) / 1e9), `N ${n}`);
    else assert.equal(sc.px, 1);
  }
  LOOK.n = 1;
  const { ctx, calls } = rec();
  N.drawSky(ctx, S.skyScene(S.DROP + S.A_ANT + S.A_DASH + 0.3), N.skyScale(1));
  const imgs = calls.filter((c) => c[0] === 'drawImage');
  assert.ok(imgs.length > 0);
  for (const c of imgs) assert.notEqual(c[1], '32x44', 'N = 1에서 두 배 그림을 쓰지 않는다');
});
