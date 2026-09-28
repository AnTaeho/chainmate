// 글 상자가 내용에 맞춰(hug) 480×270 안에 들어가는지 — 연기 시험이 그리지 않는 물건 · 정석 · 명인 · 수업 글까지 한국어 · 영어로 잰다.
// 글 폭은 연기 시험의 가짜 캔버스(Galmuri11 글자 폭 표)로 잰다. docs/design-notes/layout.md 「격자와 여백」 · 「상점 · 금빛 꾸러미」
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let dom, M;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  setCanvasFactory(() => dom.document.createElement('canvas'));
  M = {
    lang: await import('../src/ui/lang.js'),
    text: await import('../src/render/text.js'),
    frame: await import('../src/ui/frame.js'),
    common: await import('../src/ui/screens/common.js'),
    parts: await import('../src/ui/parts.js'),
    draft: await import('../src/ui/screens/draft.js'),
    select: await import('../src/ui/screens/select.js'),
    lesson: await import('../src/ui/screens/lesson.js'),
    battle: await import('../src/ui/screens/battle.js'),
    run: await import('../src/sim/run.js'),
    lessons: await import('../src/ui/lessons.js'),
  };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });
const LANGS = ['ko', 'en'];
const BOTTOM = 270 - 2;

test('토큰: 이름마다 한 값(후보 2) · 시안 덮어쓰기는 이름 하나를 바꾼다', () => {
  const F = M.frame;
  assert.deepEqual([F.PAD_BOX, F.PAD_CARD, F.LINE, F.LINE_TITLE, F.GAP_IN, F.GAP_GROUP], [8, 7, 14, 18, 3, 8]);
  // 잉크(11줄)는 줄 가운데: 본문 줄은 위 1 · 아래 2, 제목 줄은 위 3 · 아래 4
  assert.equal(F.textY(100, 14), 101);
  assert.equal(F.textY(100, 18), 103);
  F.applySpacing('line16');
  assert.equal(F.LINE, 16);
  F.applySpacing('line14');
  assert.equal(F.rowBoxH(F.PAD_CARD), 28);
});

test('대국 왼쪽 칸: 머리 칸 · 값 × 배수 · 사슬 칸 · 아래 칸이 위아래로 쌓여 사슬 칸이 남는다(수업 제목 두 줄 · 영어 포함)', () => {
  const { headLayout, footLayout, sideStack } = M.common;
  const { LEFT, PAD_BOX, GAP_GROUP } = M.frame;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    // 대국: 제목 한 줄, 목표 · 점수(상금이 관 줄에 안 들어가면 한 줄 더), 아래 칸 넷
    for (const rows of [2, 3]) {
      const st = sideStack(headLayout(1, rows).h, footLayout(4).h);
      const chain = st.mid.h - M.battle.VAL_H - GAP_GROUP;
      assert.ok(chain >= 22 + 4, `${lang} 대국 사슬 칸 ${chain}`);
      if (rows === 2) assert.ok(chain >= 44 + 4, `${lang} 대국 사슬 칸(두 배 모습) ${chain}`);
    }
    // 수업: 제목이 줄바꿈되고 상금 줄이 없다
    for (const L of M.lessons.LESSONS) {
      const n = M.text.wrap(L.title, LEFT.w - PAD_BOX * 2, true).length;
      const st = sideStack(headLayout(n, 2).h, footLayout(3).h);
      assert.ok(st.mid.h - M.battle.VAL_H - GAP_GROUP >= 26, `${lang} 수업 ${L.id}`);
    }
  }
});

test('오른쪽 칸: 격언 다섯 칸 · 시너지 띠 · 손 이름표 · 손이 화면 안, 칸이 늘면 두 줄로', () => {
  const lay = M.battle.BattleScreen.prototype.rightLayout.call({});
  const { TOP } = M.frame;
  const run = M.run.createRun({ seed: 1, draft: false });
  const five = M.parts.maximColumnH(run, lay.room);
  assert.equal(five.cols, 1);
  assert.ok(TOP + five.used <= lay.stripY - M.frame.GAP_GROUP);
  assert.equal(lay.handY + lay.HAND_H, BOTTOM);
  run.maximSlots = 7;
  const seven = M.parts.maximColumnH(run, lay.room);
  assert.equal(seven.cols, 2);
  assert.ok(seven.used <= lay.room);
});

test('정석 카드: 셋이 같은 높이로 본 칸 안(모든 정석, 한국어 · 영어)', async () => {
  const { JOSEKIS } = await import('../src/data/josekis.js');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const h = M.draft.josekiCardH(JOSEKIS.map((j) => j.id));
    assert.ok(M.frame.TOP + h <= BOTTOM, `${lang} 정석 카드 ${h}`);
  }
});

test('관 선택: 명인 카드(1~7관 명인 · 8관 대가)가 본 칸 안', async () => {
  const { MASTERS, FINAL_MASTER } = await import('../src/data/masters.js');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const m of MASTERS) for (const ante of [1, 4, 7, 8]) {
      if ((ante === 8) !== (m.id === FINAL_MASTER)) continue;
      const run = M.run.createRun({ seed: 1, draft: false });
      run.ante = ante; run.masters[ante - 1] = m.id;
      const h = Math.max(...[0, 1, 2].map((i) => M.select.blindLayout(run, i).h));
      assert.ok(M.frame.TOP + h <= 270 - M.frame.GAP_GROUP, `${lang} ${m.id} ${ante}관 ${h}`);
    }
  }
});

test('수업 할 일: 모든 걸음 글이 손 이름표 줄 위에 들어간다', () => {
  const lay = M.battle.BattleScreen.prototype.rightLayout.call({});
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const L of M.lessons.LESSONS) for (const st of L.steps || []) {
      if (!st.say) continue;
      const h = M.lesson.lessonPanelLayout(st.say, true).h;
      assert.ok(M.frame.TOP + h <= lay.rowY - M.frame.GAP_GROUP, `${lang} ${L.id}: ${st.say} (${h})`);
    }
  }
});

test('꾸러미(기물 · 기보 · 각인): 카드 셋 → 건너뛰기, 새기기 미리 보기 → 주머니 한 줄이 화면 안', async () => {
  const { PIECES } = await import('../src/data/pieces.js');
  const { CHARTS } = await import('../src/data/charts.js');
  const { ENGRAVINGS } = await import('../src/data/engravings.js');
  const { TOP, GAP_GROUP, BTN_H, CARD, MAIN } = M.frame;
  const run = M.run.createRun({ seed: 1, draft: false });
  const items = [
    ...Object.keys(PIECES).filter((t) => !PIECES[t].thing && t !== 'K').map((t) => ({ kind: 'piece', t })),
    ...Object.keys(CHARTS).map((form) => ({ kind: 'chart', form })),
    ...ENGRAVINGS.map((e) => ({ kind: 'engraving', id: e.id })),
  ];
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const h = M.parts.itemRowH(items, CARD.w, { run });
    assert.ok(TOP + h + GAP_GROUP + BTN_H <= BOTTOM, `${lang} 꾸러미 카드 ${h}`);
    for (const e of ENGRAVINGS) {
      const th = M.parts.targetPanelLayout(run, { kind: 'engraving', id: e.id }, run.deck[0], MAIN.w).h;
      assert.ok(TOP + th + GAP_GROUP + 28 <= BOTTOM, `${lang} 새기기 ${e.id} ${th}`);
      // 바꾸기(옛 각인 › 새 각인)
      for (const o of ENGRAVINGS) if (o.id !== e.id) {
        const lay = M.parts.targetPanelLayout(run, { kind: 'engraving', id: e.id }, { ...run.deck[0], eng: { id: o.id } }, MAIN.w);
        assert.equal(lay.swap, o.id);
        assert.ok(TOP + lay.h + GAP_GROUP + 28 <= BOTTOM, `${lang} 바꾸기 ${o.id} › ${e.id} ${lay.h}`);
      }
    }
  }
});

// 상점 · 금빛 꾸러미에 나오는 물건 모두(판본 격언 · 명국 조각 포함)
async function allItems(price = true) {
  const D = {};
  for (const n of ['maxims', 'souls', 'tactics', 'engravings', 'legends', 'editions', 'pieces', 'charts']) D[n] = await import(`../src/data/${n}.js`);
  const a = [];
  for (const m of D.maxims.MAXIMS) { a.push({ kind: 'maxim', id: m.id }); for (const e of D.editions.EDITIONS) a.push({ kind: 'maxim', id: m.id, edition: e.id }); }
  for (const t of Object.keys(D.pieces.PIECES)) if (!D.pieces.PIECES[t].thing && t !== 'K') a.push({ kind: 'piece', t });
  for (const s of D.souls.SOULS) a.push({ kind: 'soul', id: s.id });
  for (const s of D.tactics.TACTICS) a.push({ kind: 'tactic', id: s.id });
  for (const s of D.engravings.ENGRAVINGS) a.push({ kind: 'engraving', id: s.id });
  for (const f of Object.keys(D.charts.CHARTS)) a.push({ kind: 'chart', form: f });
  for (const l of D.legends.LEGENDS) a.push({ kind: 'fragment', legend: l.id });
  a.push({ kind: 'evolve' }, { kind: 'gamble', id: 'potion' }, { kind: 'gamble', id: 'roulette' });
  if (price) for (const it of a) it.price = 13;
  return a;
}

test('상점: 모든 진열 카드(판본 · 명국 조각 포함) → 꾸러미 칸 → 주머니 한 줄이 화면 안(한국어 · 영어)', async () => {
  const { packCellH } = await import('../src/ui/screens/shop.js');
  const { TOP, GAP_GROUP, CARD } = M.frame;
  const run = M.run.createRun({ seed: 1, draft: false });
  const items = await allItems(true);
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const pack = Math.max(...['piece', 'chart', 'engraving', 'golden'].map((kind) => Math.max(packCellH({ kind }, CARD.w), packCellH({ kind }, 72))));
    for (const it of items) {
      const h = M.parts.itemCardH(it, CARD.w, { run });
      assert.ok(TOP + h + GAP_GROUP + pack + GAP_GROUP + 28 <= BOTTOM, `${lang} ${it.kind} ${it.id || it.t || it.form || it.legend} ${it.edition || ''} ${h}`);
    }
  }
});

// 금빛 꾸러미: 판본 격언 셋(+ 명국 조각은 카드 줄 밖 건너뛰기 줄 왼쪽 칸). 격언 칸은 위 띠 이름표로 접혀 있고, 칸이 찬 채로 고르면 펼친다.
// 모든 판본 격언 × 한국어 · 영어 × 격언 칸 다섯 · 일곱(흑요 둘)으로 카드 줄 · 건너뛰기 줄 · 펼친 격언 칸(고른 카드 + 두 칸씩, 이름표로 펼치면 세 칸씩)을 잰다
async function goldenPackCheck(withFragment) {
  const P = await import('../src/ui/screens/pack.js');
  const { TOP, MAIN, CARD, BTN_H } = M.frame;
  const run = M.run.createRun({ seed: 1, draft: false });
  const add = (id, edition = null) => run.maxims.push({ uid: run.nextUid++, id, data: {}, edition, paid: 5 });
  const items = (await allItems(false)).filter((it) => it.edition);
  const frag = { kind: 'fragment', legend: 'century' };
  let worst = 0, n = 0;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const maxims of [5, 7]) {
      run.maxims = [];
      for (const [id, ed] of [['chivalry'], ['quick_change', 'foil'], ['first_move'], ['whim', 'rainbow'], ['sacrifice'], ['wall_breaker', 'obsidian'], ['collector_forms', 'obsidian']].slice(0, maxims)) add(id, ed);
      // 격언 이름표는 위 띠(카드 줄 위 · 멈춤 단추 왼쪽)
      assert.ok(2 + BTN_H <= TOP && MAIN.x + P.maximTagW(run) < 460, `${lang} 이름표 ${P.maximTagW(run)}`);
      for (const it of items) {
        const pack = { kind: 'golden', options: withFragment ? [it, it, it, frag] : [it, it, it] };
        const lay = P.packLayout(run, pack);
        const tag = `${lang} 칸${maxims} ${it.id} ${it.edition}`;
        // 카드는 늘 셋 · 폭 108(명국 조각은 카드 줄 밖)
        assert.equal(lay.n, 3, tag);
        assert.equal(lay.cw, CARD.w, tag);
        assert.equal(!!lay.cell, withFragment, tag);
        assert.ok(lay.bottom <= BOTTOM, `${tag}: 카드 ${lay.ch} · 줄 끝 ${lay.bottom}`);
        if (lay.cell) assert.ok(lay.cell.x + lay.cell.w < lay.skip.x, `${tag}: 명국 조각 칸이 건너뛰기와 겹친다`);
        worst = Math.max(worst, lay.bottom);
        // 펼친 격언 칸
        for (const panel of [{ pick: 0 }, { pick: null }]) {
          const q = P.packLayout(run, pack, panel);
          assert.ok(q.bottom <= BOTTOM, `${tag} 펼침 ${panel.pick}: 줄 끝 ${q.bottom}`);
          if (q.chosen) assert.ok(q.chosen.x + q.chosen.w < q.grid.x, `${tag}: 고른 카드가 격언 칸과 겹친다`);
        }
        n++;
      }
    }
  }
  assert.ok(n > 500 && worst > TOP, `잰 경우 ${n} · 가장 낮은 줄 끝 ${worst}`);
}
test('금빛 꾸러미(카드 셋): 판본 격언 카드 → 건너뛰기 줄 · 펼친 격언 칸이 화면 안(모든 판본 격언 · 한국어 · 영어)', () => goldenPackCheck(false));
test('금빛 꾸러미(카드 넷 — 명국 조각): 판본 격언 카드 셋(폭 108) → 건너뛰기 줄의 명국 조각 칸 · 펼친 격언 칸이 화면 안(모든 판본 격언 · 한국어 · 영어)', () => goldenPackCheck(true));

test('기보 수준 표: 손 · 주머니는 그 모습의 기보 수준을 읽고, 이형은 바탕 체스 모습의 기보를 따른다', async () => {
  const { PIECES, chartForm } = await import('../src/data/pieces.js');
  const run = M.run.createRun({ seed: 1, draft: false });
  Object.assign(run.charts, { P: 1, N: 3, B: 0, R: 5, Q: 2 });
  assert.equal(M.parts.chartLevel(run, 'N'), 3);
  assert.equal(M.parts.chartLevel(run, 'B'), 0);
  assert.equal(M.parts.chartLevel(null, 'N'), 0);
  for (const t of Object.keys(PIECES)) if (PIECES[t].fairy) assert.equal(M.parts.chartLevel(run, t), run.charts[chartForm(t)] || 0, t);
});

test('각인 · 혼 바꾸기: 같은 종류가 있으면 옛 것 › 새 것, 같은 것은 고를 수 없다 · 상점 두루마리 폭(224)에서도 화면 안(한국어 · 영어)', async () => {
  const { ENGRAVINGS } = await import('../src/data/engravings.js');
  const { SOULS } = await import('../src/data/souls.js');
  const { TOP, GAP_GROUP, CENTER } = M.frame;
  const run = M.run.createRun({ seed: 1, draft: false });
  const p = run.deck[0];
  assert.equal(M.parts.targetOk({ kind: 'engraving', id: 'glass' }, { ...p, eng: { id: 'glass' } }), false);
  assert.equal(M.parts.targetOk({ kind: 'engraving', id: 'glass' }, { ...p, eng: { id: 'gold' } }), true);
  assert.equal(M.parts.targetOk({ kind: 'soul', id: 'echo' }, { ...p, soul: 'echo' }), false);
  assert.equal(M.parts.targetOk({ kind: 'soul', id: 'echo' }, { ...p, soul: 'hunger', eng: { id: 'echo' } }), true);
  assert.equal(M.parts.targetOk({ kind: 'evolve' }, p), true);
  // 각인만 있는 기물에 혼 · 혼만 있는 기물에 각인은 바꾸기가 아니다(한 기물에 각인 하나 + 혼 하나)
  assert.equal(M.parts.targetPanelLayout(run, { kind: 'soul', id: 'echo' }, { ...p, eng: { id: 'gold' } }, CENTER.w).swap, null);
  assert.equal(M.parts.targetPanelLayout(run, { kind: 'engraving', id: 'gold' }, { ...p, soul: 'echo' }, CENTER.w).swap, null);
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const cases = [
      ...ENGRAVINGS.flatMap((a) => ENGRAVINGS.filter((b) => b.id !== a.id).map((b) => [{ kind: 'engraving', id: a.id }, { ...p, eng: { id: b.id } }])),
      ...SOULS.flatMap((a) => SOULS.filter((b) => b.id !== a.id).map((b) => [{ kind: 'soul', id: a.id }, { ...p, soul: b.id }])),
    ];
    for (const [what, q] of cases) {
      const lay = M.parts.targetPanelLayout(run, what, q, CENTER.w);
      assert.ok(lay.swap, `${lang} ${what.id}`);
      // 상점: 미리 보기 → 주머니 한 줄(28)이 화면 안
      assert.ok(TOP + lay.h + GAP_GROUP + 28 <= BOTTOM, `${lang} 상점 바꾸기 ${lay.swap} › ${what.id} ${lay.h}`);
    }
  }
});

test('큰 수: 끝없는 대국의 13~16자리 수가 제 칸 폭 안에(값 × 배수 곱 · 머리 칸 · 관 선택 목표, 한국어 · 영어)', async () => {
  const { fitNum, measure } = await import('../src/render/gfx.js');
  const { LEFT, PAD_BOX, EDGE_PAD } = M.frame;
  const BIG = [1719572936961, 6184890789926, 999999999999999, 9876543210987654];
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const rooms = { '값 × 배수': LEFT.w - (1 + EDGE_PAD) * 2, '목표': LEFT.w - PAD_BOX * 2 - measure('목표') - 4, '점수': LEFT.w - PAD_BOX * 2 - measure('점수') - 4 };
    for (const n of BIG) for (const [k, room] of Object.entries(rooms)) assert.ok(measure(fitNum(n, room), true) <= room, `${lang} ${k} ${n} → ${fitNum(n, room)}`);
    // 관 선택 카드: 목표 수치가 카드 안 폭(IW) 안
    const run = M.run.createRun({ seed: 1, draft: false });
    run.endless = true;
    for (const ante of [29, 33, 36]) {
      run.ante = ante;
      for (let i = 0; i < 3; i++) {
        const lay = M.select.blindLayout(run, i);
        for (const r of lay.rows) assert.ok(measure(r.val, true) <= lay.IW, `${lang} ${ante}관 카드 ${i} ${r.label} ${r.val}`);
      }
    }
  }
  M.lang.setLang('ko');
});
