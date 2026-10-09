// 하이라이트 카드(CHM-73): 칸 계산(기물 1 · 8 · 아주 많이, 격언 0 · 6 · 아주 많이)과 글이 한국어 · 영어에서 칸 안에 드는지,
// 결과 화면 단추가 뜨는 조건, 옛 저장(최고 한 수에 사슬 길이가 없다)에서도 그려지는지. 글 폭은 가짜 캔버스의 글자 폭 표로 잰다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { finishedRun } from './helpers/hlrun.js';

let dom, M;
before(async () => {
  dom = await installDom();
  M = {
    lang: await import('../src/ui/lang.js'),
    gfx: await import('../src/render/gfx.js'),
    log: await import('../src/render/layoutlog.js'),
    hl: await import('../src/ui/highlight.js'),
    screen: await import('../src/ui/screens/highlight.js'),
    result: await import('../src/ui/screens/result.js'),
    maxims: await import('../src/data/maxims.js'),
    josekis: await import('../src/data/josekis.js'),
  };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });
const LANGS = ['ko', 'en'];
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// 카드를 한 번 그리고 칸 계산 · 넘친 곳 · 줄인 글을 돌려준다
function drawn(run, ox = 0, oy = 0) {
  const { LOG, logBegin, checkLayout } = M.log, ctx = dom.document.createElement('canvas').getContext('2d');
  LOG.on = true;
  try {
    logBegin();
    const lay = M.hl.highlightLayout(run, ox, oy);
    M.hl.drawHighlight(ctx, run, lay);
    return { lay, bad: checkLayout().map((q) => q.msg), clips: LOG.clips.slice(), texts: LOG.texts.slice() };
  } finally { LOG.on = false; }
}

test('기물 줄: 1 · 8 · 14개는 2배 한 줄, 15개부터 1배 두 줄, 아주 많으면 「+N」 — 모두 판넬 안', () => {
  const { bagSpots } = M.hl, x = 22, y = 60, w = 356;
  for (const n of [1, 2, 6, 8, 12, 14, 15, 16, 21, 30, 45, 58, 59, 80, 200]) {
    const b = bagSpots(n, x, y, w), sw = 16 * b.scale, sh = 22 * b.scale;
    assert.equal(b.scale, n <= 14 ? 2 : 1, `${n}개 배율`);
    assert.equal(b.spots.length + (b.more ? b.more.n : 0), n, `${n}개를 다 센다`);
    assert.equal(!!b.more, n > 58, `${n}개 「+N」`);
    for (const s of b.spots) assert.ok(s.x >= x && s.x + sw <= x + w && s.y >= y + 2 && s.y + sh <= y + 50 - 2, `${n}개 자리 ${s.x},${s.y}`);
    // 한 줄 안의 걸음: 2배는 24 이상(그림 폭 32의 3/4), 1배는 12 이상
    const rows = new Map();
    for (const s of b.spots) rows.set(s.y, [...(rows.get(s.y) || []), s.x]);
    assert.equal(rows.size, b.scale === 2 ? 1 : 2, `${n}개 줄 수`);
    for (const xs of rows.values()) for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= (b.scale === 2 ? 24 : 12), `${n}개 걸음 ${xs[i] - xs[i - 1]}`);
    if (b.more) assert.ok(b.more.x + M.gfx.measure(`+${b.more.n}`) <= x + w, `${n}개 「+N」 자리`);
  }
});

test('격언 칸: 0 · 1 · 3 · 6 · 8 · 9 · 20 · 40개 — 칸끼리 겹치지 않고 띠 안, 아홉부터는 그림만(한국어 · 영어)', () => {
  const { maximSpots } = M.hl, x = 14, w = 372;
  const pool = M.maxims.MAXIMS.filter((m) => m.rarity !== 'legendary');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 20, 26, 27, 40]) {
      const g = maximSpots(Array.from({ length: n }, (_, i) => ({ id: pool[i % pool.length].id })), x, 100, w);
      assert.ok(g.rows <= 2 && g.h <= 59, `${lang} ${n}개 줄 ${g.rows}`);
      assert.equal(g.cells.length + (g.more ? g.more.n : 0), n, `${lang} ${n}개를 다 센다`);
      if (n > 8) assert.ok(g.narrow, `${lang} ${n}개는 그림만`);
      if (n <= 3) assert.equal(g.rows, n ? 1 : 0, `${lang} ${n}개 한 줄`);
      const all = [...g.cells, ...(g.more ? [g.more] : [])];
      for (const c of all) assert.ok(c.x >= x && c.x + c.w <= x + w && c.w >= 24, `${lang} ${n}개 칸 ${c.x} 폭 ${c.w}`);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!cross(all[i], all[j]), `${lang} ${n}개 칸 ${i} ∩ ${j}`);
    }
  }
  M.lang.setLang('ko');
});

test('카드 글: 기물 · 격언 수를 바꿔도 넘침 0 · 줄인 글 0, 띠끼리 겹치지 않는다(한국어 · 영어, 이긴 판 · 진 판 · 끝없는 대국 · 큰 수)', () => {
  const { CARD, highlightLayout } = M.hl;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const cases = [];
    for (const deck of [1, 8, 14, 15, 30, 80]) for (const maxims of [0, 3, 6, 8, 9, 20]) cases.push({ deck, maxims });
    cases.push({ won: false, ante: 3 }, { won: false, ante: 12, endless: true, score: 9876543210987654 }, { score: 999999999999999 }, { score: 1234567890 }, { chain: 0, score: 40 }, { josekis: 0 }, { josekis: 1 });
    // 꼬리표: 가장 긴 레이팅(2400) · 오늘의 대국
    cases.push({ dan: 8 }, { dan: 8, won: false, ante: 7 }, { daily: '2026-10-09' });
    for (const o of cases) {
      const run = Object.assign(finishedRun(o), o.dan != null ? { dan: o.dan } : {}, o.daily ? { daily: o.daily } : {}), tag = `${lang} ${JSON.stringify(o)}`;
      if (o.dan === 8) assert.equal(M.lang.L(highlightLayout(run).tag.s), lang === 'en' ? 'Rating 2400' : '레이팅 2400', tag);
      if (o.daily) assert.equal(highlightLayout(run).tag.s, '오늘의 대국', tag);
      const { lay, bad, clips } = drawn(run, 40, 8);
      assert.deepEqual(bad, [], tag);
      assert.deepEqual(clips.map((c) => c.src), [], `${tag}: 줄인 글`);
      // 띠의 차례: 이름표 줄 → 기물 판넬 → 격언 칸 → 아래 띠
      assert.ok(lay.subY + 13 <= lay.bag.y, `${tag}: 이름표 줄이 판넬에 닿는다`);
      const bottom = lay.grid.rows ? Math.max(...lay.grid.cells.map((c) => c.y + c.h)) : lay.bag.y + lay.bag.h;
      assert.ok(bottom + 2 <= lay.tagY, `${tag}: 격언 칸이 아래 띠에 닿는다(${bottom} · ${lay.tagY})`);
      // 아래 띠: 꼬리표와 「최고 한 수」 줄, 큰 글과 점수가 서로 닿지 않는다
      const m = M.gfx.measure;
      assert.ok(m(lay.tag.s, true) + 10 <= lay.w - m(lay.note), `${tag}: 꼬리표 · 최고 한 수`);
      assert.ok(lay.headW + 12 <= lay.w - m(lay.score, true) * 2, `${tag}: 큰 글 · 점수 ${lay.headW} + ${m(lay.score, true) * 2}`);
      assert.ok(lay.bandY + 26 <= 8 + CARD.h - 3, `${tag}: 아래 띠가 금테 안`);
      if (o.score === 1234567890 || !o.score) assert.ok(lay.big, `${tag}: 큰 글은 두 배`);
    }
    // 흔한 판(여덟 관 · 일곱 자리 점수)은 점수를 다 적는다
    assert.equal(highlightLayout(finishedRun()).score, '47,318,700', `${lang}: 점수`);
  }
  M.lang.setLang('ko');
});

test('격언 이름 · 레퍼토리 이름: 모든 격언이 여섯 칸 · 여덟 칸에서 줄이지 않고 들어가거나 그림만 남고, 레퍼토리 셋은 한 줄 안(한국어 · 영어)', () => {
  const ids = M.maxims.MAXIMS.map((m) => m.id), J = M.josekis.JOSEKIS;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const per of [6, 8]) {
      for (let i = 0; i < ids.length; i += per) {
        const { bad, clips } = drawn(finishedRun({ maxims: ids.slice(i, i + per) }));
        assert.deepEqual(bad, [], `${lang} 격언 ${i}~`);
        assert.deepEqual(clips.map((c) => c.src), [], `${lang} 격언 ${i}~: 줄인 글`);
      }
    }
    // 레퍼토리: 가장 넓은 이름 셋도 줄 안(이름표는 자리가 남을 때만), 이름끼리 10 이상
    const wide = [...J].sort((a, b) => M.gfx.measure(b.name, true) - M.gfx.measure(a.name, true)).slice(0, 3).map((j) => j.id);
    for (let i = 0; i + 3 <= J.length; i += 3) {
      for (const list of [J.slice(i, i + 3).map((j) => j.id), wide]) {
        const { lay, bad } = drawn(finishedRun({ josekis: list }));
        assert.deepEqual(bad, [], `${lang} 레퍼토리 ${list}`);
        assert.equal(lay.names.length, 3, `${lang} 레퍼토리 ${list}: 셋 다`);
        assert.ok(lay.names[0].x >= lay.x + (lay.label ? M.gfx.measure('이 판의 콤비네이션') + 12 : 0), `${lang} 레퍼토리 ${list}: 왼끝`);
        for (let k = 1; k < 3; k++) assert.ok(lay.names[k - 1].x + lay.names[k - 1].w + 10 <= lay.names[k].x, `${lang} 레퍼토리 ${list}: 사이`);
      }
    }
  }
  M.lang.setLang('ko');
});

test('옛 저장: 최고 한 수에 사슬 길이가 없으면 먹기 줄을 세고, 먹기 줄도 없으면 사슬을 빼고 그린다 · 최고 한 수가 없는 판은 카드가 없다', () => {
  const { chainOf, hasHighlight, highlightLayout } = M.hl;
  const old = finishedRun({ old: true, chain: 9 });
  assert.equal(old.bestReplay.captures, undefined);
  assert.equal(chainOf(old.bestReplay), 9);
  assert.equal(highlightLayout(old).note, '최고 한 수 · 사슬 9');
  assert.deepEqual(drawn(old).bad, []);
  // 사슬 길이가 적혀 있으면 그 수(터져 함께 먹힌 적은 먹기 줄에 없다)
  assert.equal(chainOf({ ...old.bestReplay, captures: 11 }), 11);
  const bare = finishedRun();
  bare.bestReplay = { score: 120 }; delete bare.josekis; delete bare.maxims;
  assert.equal(highlightLayout(bare).note, '최고 한 수');
  assert.deepEqual(drawn(bare).bad, []);
  assert.ok(hasHighlight(old) && hasHighlight(bare));
  assert.ok(!hasHighlight(null) && !hasHighlight({ ...old, bestReplay: null }) && !hasHighlight({ ...old, deck: [] }));
});

// 가짜 DOM으로 켠 앱(순위 · 기록 보내기는 닿지 않는다)
async function bootApp(lang = 'ko') {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { boot } = await import('../src/main.js');
  const d = makeFakeDom();
  if (lang !== 'ko') d.window.localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang }));
  const app = await boot({ window: d.window, document: d.document, today: () => '2026-10-09', rankBase: '' });
  app.records.kingDone = true; app.records.coachSeen = { telemetry: true, bigText: true, rankName: true };
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
  const frame = () => { const { LOG, checkLayout } = M.log; LOG.on = true; try { app.frame((app.last || 0) + 16); return { bad: checkLayout().map((q) => q.msg), boxes: LOG.boxes.slice() }; } finally { LOG.on = false; } };
  const has = (id) => app.ui.regions.some((r) => r.id === id);
  const reg = (id) => app.ui.regions.find((r) => r.id === id);
  return { app, d, settle, frame, has, reg };
}

test('결과 화면 단추: 최고 한 수가 있는 판에만 「하이라이트」 — 이긴 판은 넷 · 진 판은 셋이 상자 안에서 닿지 않는다(한국어 · 영어)', async () => {
  for (const lang of LANGS) {
    const a = await bootApp(lang);
    for (const won of [true, false]) {
      for (const best of [true, false]) {
        a.app.run = finishedRun({ won });
        if (!best) a.app.run.bestReplay = null;
        a.app.go('result', { quiet: true });
        const f = a.frame(), tag = `${lang} ${won ? '이긴 판' : '진 판'} ${best ? '최고 한 수 있음' : '없음'}`;
        assert.deepEqual(f.bad, [], tag);
        assert.equal(a.has('result:highlight'), best, tag);
        const ids = [...(won ? ['result:endless'] : []), 'result:again', ...(best ? ['result:highlight'] : []), 'result:title'];
        const rs = ids.map((id) => a.reg(id)), box = f.boxes.find((q) => q.name === '결과');
        assert.ok(rs.every(Boolean), `${tag}: 단추 ${ids}`);
        assert.ok(rs[0].x >= box.x + 8 && rs.at(-1).x + rs.at(-1).w <= box.x + box.w - 8, `${tag}: 단추 줄이 상자 안`);
        for (let i = 1; i < rs.length; i++) assert.ok(rs[i - 1].x + rs[i - 1].w + 8 <= rs[i].x, `${tag}: 단추 사이`);
        // 단추 줄은 화면 가운데에 선다
        assert.ok(Math.abs(rs[0].x + (rs.at(-1).x + rs.at(-1).w) - 480) <= 1, `${tag}: 가운데`);
      }
    }
    M.lang.setLang('ko');
  }
});

test('하이라이트 덮개: 열면 그림을 미리 만들고 · 「그림 저장」 「닫기」가 카드 아래 · Esc와 바깥 누르기로 닫힌다 · 공유를 못 하는 곳은 「공유」가 없다(한국어 · 영어)', async () => {
  const { CARD } = M.hl, { HL } = M.screen;
  for (const lang of LANGS) {
    const a = await bootApp(lang);
    for (const o of [{}, { won: false, ante: 4, deck: 22, maxims: 11 }, { old: true, maxims: 0, deck: 1 }]) {
      const tag = `${lang} ${JSON.stringify(o)}`;
      a.app.run = finishedRun(o);
      a.app.go('result', { quiet: true }); a.frame();
      a.reg('result:highlight').onClick();
      assert.equal(a.app.overlay && a.app.overlay.name, 'highlight', tag);
      await a.settle();
      const f = a.frame();
      assert.deepEqual(f.bad, [], tag);
      assert.ok(a.app.overlay.blob && a.app.overlay.blob.size === CARD.w * CARD.scale * CARD.h * CARD.scale, `${tag}: 1200 × 675`);
      const card = f.boxes.find((q) => q.name === '하이라이트 카드'), save = a.reg('hl:save'), close = a.reg('hl:close');
      assert.deepEqual([card.x, card.y, card.w, card.h], [HL.x, HL.y, 400, 225], tag);
      assert.ok(save && save.enabled && close && !a.has('hl:share'), `${tag}: 단추`);
      assert.ok(save.y >= card.y + card.h + 4 && save.y + save.h <= 270 - 4 && save.x + save.w < close.x, `${tag}: 단추 자리`);
      assert.ok(!a.has('result:again'), `${tag}: 밑 화면 단추는 막힌다`);
      // 카드 안을 누르면 그대로, Esc로 닫힌다
      a.app.pointer('down', 240, 120); a.app.pointer('up', 240, 120);
      assert.ok(a.app.overlay, `${tag}: 카드 안 누르기`);
      a.app.key('Escape');
      assert.equal(a.app.overlay, null, `${tag}: Esc`);
      // 바깥 누르기 · 닫기 단추
      a.frame(); a.reg('result:highlight').onClick(); a.frame();
      a.app.pointer('down', 10, 260); a.app.pointer('up', 10, 260);
      assert.equal(a.app.overlay, null, `${tag}: 바깥 누르기`);
      a.frame();
      assert.equal(a.app.screen.name, 'result', `${tag}: 결과 화면이 남는다`);
      a.reg('result:highlight').onClick(); a.frame(); a.reg('hl:close').onClick();
      assert.equal(a.app.overlay, null, `${tag}: 닫기`);
    }
    M.lang.setLang('ko');
  }
});

test('그림 저장 · 공유: 누른 그 순간 안에서 미리 만든 그림을 넘긴다 · 공유할 수 있을 때만 「공유」 · 기록 사건에 그림 · 이름을 싣지 않는다', async () => {
  const { HighlightScreen } = M.screen;
  const ui = { press: null, region: (id, x, y, w, h, o = {}) => { const r = { id, x, y, w, h, enabled: o.enabled !== false, ...o }; ui.list.push(r); return r; }, isHover: () => false, list: [] };
  const make = ({ can = true, save = true, shared = 'shared' } = {}) => {
    const calls = [], toasts = [], events = [];
    const app = {
      run: finishedRun(), ui, closeOverlay() { calls.push(['close']); },
      track: (name, props) => events.push([name, props]), toast: (s) => toasts.push(s),
      canShareImage: (name, blob) => can && !!blob, saveImage: (name, blob) => { calls.push(['save', name, blob]); return save; },
      shareImage: (name, blob) => { calls.push(['share', name, blob]); return shared ? Promise.resolve(shared) : null; },
    };
    const s = new HighlightScreen(app);
    const draw = () => { ui.list = []; s.draw(dom.document.createElement('canvas').getContext('2d'), ui); return ui.list.map((r) => r.id); };
    return { s, app, calls, toasts, events, draw };
  };
  const tick = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
  // 그림이 만들어지기 전: 저장은 꺼져 있고 공유는 없다
  const a = make();
  assert.deepEqual(a.draw(), ['hl:save', 'hl:close']);
  assert.equal(ui.list[0].enabled, false);
  assert.deepEqual(a.events, [['highlight_open', {}]]);
  await tick();
  assert.deepEqual(a.draw(), ['hl:save', 'hl:share', 'hl:close']);
  assert.equal(ui.list[0].enabled, true);
  // 공유: onClick 안에서 곧바로 불린다(Promise를 기다리기 전)
  ui.list[1].onClick();
  assert.deepEqual(a.calls.at(-1).slice(0, 2), ['share', 'chainmate-highlight.png']);
  assert.equal(a.calls.at(-1)[2], a.s.blob);
  await tick();
  assert.deepEqual(a.events.at(-1), ['highlight_share', { ok: true }]);
  assert.deepEqual(a.toasts, []);
  ui.list[0].onClick();
  assert.deepEqual(a.calls.at(-1), ['save', 'chainmate-highlight.png', a.s.blob]);
  assert.deepEqual(a.events.at(-1), ['highlight_save', {}]);
  assert.deepEqual(a.toasts, ['그림을 저장했다']);
  // 그만둠: 알림 없이 ok false · 실패: 알림
  for (const [shared, toast] of [['cancel', []], ['fail', ['공유하지 못했다']], [null, ['공유하지 못했다']]]) {
    const b = make({ shared }); await tick(); b.draw();
    ui.list[1].onClick(); await tick();
    assert.deepEqual(b.events.at(-1), ['highlight_share', { ok: false }], String(shared));
    assert.deepEqual(b.toasts, toast, String(shared));
  }
  // 공유를 못 하는 곳 · 받기가 안 되는 곳
  const c = make({ can: false, save: false }); await tick();
  assert.deepEqual(c.draw(), ['hl:save', 'hl:close']);
  ui.list[0].onClick();
  assert.deepEqual(c.toasts, ['저장하지 못했다']);
  assert.deepEqual(c.events, [['highlight_open', {}]]);
  // 사건 속성에는 ok만
  for (const [, props] of [...a.events, ...c.events]) assert.ok(Object.keys(props).every((k) => k === 'ok'));
});

test('최고 한 수 기록: 대국 화면이 사슬 길이(captures)를 같이 남긴다', async () => {
  const { BattleScreen } = await import('../src/ui/screens/battle.js');
  const run = { bestReplay: null }, me = { rec: { board: [], drop: { sq: 0, piece: 'R' }, caps: [] } };
  BattleScreen.prototype.record.call(me, [{ type: 'capture', from: 0, to: 1, piece: 'P', form: 'R' }, { type: 'pierce', sq: 9 }, { type: 'end', score: 300, reason: 'end', captures: 1 }], run);
  assert.equal(run.bestReplay.captures, 1);
  assert.equal(M.hl.chainOf(run.bestReplay), 1);
});
