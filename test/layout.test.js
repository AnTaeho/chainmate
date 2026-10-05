// 글 상자가 내용에 맞춰(hug) 480×270 안에 들어가는지 — 연기 시험이 그리지 않는 물건 · 정석 · 명인 · 수업 글까지 한국어 · 영어로 잰다.
// 글 폭은 연기 시험의 가짜 캔버스(Galmuri11 글자 폭 표)로 잰다. docs/design-notes/layout.md 「격자와 여백」 · 「상점 · 금빛 꾸러미」
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

let dom, M;
before(async () => {
  dom = await installDom();
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
    moves: await import('../src/ui/screens/moves.js'),
    codex: await import('../src/ui/screens/codex.js'),
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

// CHM-40: 다시 놓기 단추는 손 이름표 줄에 있어 격언 칸 자리를 먹지 않는다 — 첫 수 전 · 기본 다섯 칸도 한 줄(이름이 다 보인다)
test('오른쪽 칸: 다시 놓기가 보이는 첫 수 전에도 격언 다섯 칸은 한 줄 · 단추는 희생 앞에 들어간다', () => {
  const { RX, RW } = M.battle;
  const run = M.run.createRun({ seed: 1, draft: false });
  const self = { run, canReboard: () => true };
  const lay = M.battle.BattleScreen.prototype.rightLayout.call(self, run);
  assert.equal(M.parts.maximColumnH(run, lay.room).cols, 1);
  // 묘수 0 · 1 · 2개와 다시 놓기가 희생 단추(폭 62, 틈 3) 앞에 들어간다
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const n of [0, 1, 2]) {
      run.consumables = ['freeze', 'reload'].slice(0, n).map((id) => ({ kind: 'tactic', id }));
      const row = M.battle.BattleScreen.prototype.handRowLayout.call(self);
      assert.ok(row.rb != null && row.rb + 15 <= RX + RW - 62 - 3, `${lang} 묘수 ${n}: 다시 놓기 ${row.rb}`);
      // 「손」 글자: 한국어는 묘수가 없으면 단추와 같이 들어간다. 영어 「Hand」(31)는 단추와 같이 못 들어가 첫 수 전에만 빠진다
      if (n === 0 && lang === 'ko') assert.ok(row.label, `${lang}: 「손」 글자`);
      if (n === 0) assert.ok(M.battle.BattleScreen.prototype.handRowLayout.call({ run, canReboard: () => false }).label, `${lang}: 첫 수 뒤 「손」 글자`);
    }
  }
  M.lang.setLang('ko');
});

// CHM-40: 격언 이름이 한 줄 격언 칸(대국 · 상점 오른쪽 칸 폭, 아이콘은 이름이 굵게 들어갈 때만)에 들어간다.
// 보통 굵기까지 허용. 영어의 체스 명경기 넷은 실제 이름을 지키고 「…」를 허용한다(docs/design-notes/english-review.md)
test('격언 이름: 한 줄 격언 칸에 「…」 없이 들어간다(한국어 · 영어)', async () => {
  const { MAXIMS } = await import('../src/data/maxims.js');
  const { LEGENDS } = await import('../src/data/legends.js');
  const { RW } = M.battle;
  const KEEP = new Set(['immortal', 'opera', 'century', 'evergreen']);
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const m of [...MAXIMS, ...LEGENDS]) {
      if (lang === 'en' && KEEP.has(m.id)) continue;
      const name = M.lang.L(String(m.name));
      const room = RW - M.frame.PAD_CARD * 2 - M.parts.maximIconW(m.name, RW);
      assert.ok(M.text.textWidth(name, false) <= room || M.text.textWidth(name, true) <= room, `${lang} ${m.id} 「${name}」 ${M.text.textWidth(name, false)} > ${room}`);
    }
  }
  M.lang.setLang('ko');
});

// CHM-41: 두루마리 이름. 넓은 칸(두루마리 둘 이하, 폭 112)은 그림 옆 이름 자리(65)에 「…」 없이 들어간다(보통 굵기까지).
// 좁은 칸(셋 이상, 폭 55 — 이름 자리 36)은 줄의 이름이 다 굵게 들어가면 이름, 아니면 줄 전체를 띠 + 그림으로 그린다.
// 기보 두루마리는 옛 저장에만 남아 재지 않는다(기보는 얻는 순간 쓰인다, CHM-33)
const scrollItems = async () => {
  const { TACTICS } = await import('../src/data/tactics.js');
  const { SOULS } = await import('../src/data/souls.js');
  const { ENGRAVINGS } = await import('../src/data/engravings.js');
  return [{ kind: 'evolve' }, { kind: 'awaken' }, ...TACTICS.map((t) => ({ kind: 'tactic', id: t.id })), ...SOULS.map((s) => ({ kind: 'soul', id: s.id })), ...ENGRAVINGS.map((e) => ({ kind: 'engraving', id: e.id }))];
};
test('두루마리 이름: 넓은 칸 이름 자리에 「…」 없이 들어간다(한국어 · 영어)', async () => {
  const S = await import('../src/ui/screens/shop.js');
  const { RW } = M.battle;
  const room = S.scrollNameRoom(RW);
  assert.equal(room, 65);
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const c of await scrollItems()) {
      const name = M.lang.L(S.scrollName(c));
      assert.ok(M.text.textWidth(name, false) <= room, `${lang} ${c.kind} ${c.id || ''} 「${name}」 ${M.text.textWidth(name, false)} > ${room}`);
    }
  }
  M.lang.setLang('ko');
});
test('두루마리 좁은 칸: 줄의 이름이 다 굵게 들어갈 때만 이름, 하나라도 넘치면 줄 전체가 그림', async () => {
  const S = await import('../src/ui/screens/shop.js');
  const { RW } = M.battle;
  const w = Math.floor((RW - M.frame.LIST_GAP) / 2);
  assert.equal(S.scrollNameRoom(w), 36);
  const freeze = { kind: 'tactic', id: 'freeze' }, evolve = { kind: 'evolve' }, glass = { kind: 'engraving', id: 'glass' }, echo = { kind: 'soul', id: 'echo' }, awaken = { kind: 'awaken' };
  M.lang.setLang('ko');
  assert.equal(S.scrollRowNames([freeze, evolve], w), true);
  // 한국어는 모든 두루마리 이름이 좁은 칸에 굵게 들어간다 — 좁은 칸도 늘 이름
  for (const c of await scrollItems()) assert.ok(M.text.textWidth(S.scrollName(c), true) <= 36, `ko 「${S.scrollName(c)}」`);
  M.lang.setLang('en');
  assert.equal(S.scrollRowNames([freeze, evolve], w), false); // Freeze 44 · Evolve 42
  assert.equal(S.scrollRowNames([glass, echo], w), true); // Glass 32 · Echo 31
  assert.equal(S.scrollRowNames([glass, awaken], w), false); // 하나만 넘쳐도 줄 전체가 그림
  assert.equal(S.scrollRowNames([glass, undefined], w), true); // 빈 칸은 따지지 않는다
  assert.equal(S.scrollRowNames([undefined, awaken], w), false);
  M.lang.setLang('ko');
});

test('정석 카드: 셋이 같은 높이로 본 칸 안(모든 정석, 한국어 · 영어)', async () => {
  const { JOSEKIS } = await import('../src/data/josekis.js');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const h = M.draft.josekiCardH(JOSEKIS.map((j) => j.id));
    assert.ok(M.frame.TOP + h <= BOTTOM, `${lang} 정석 카드 ${h}`);
  }
});

test('관 선택: 세력 띠 · 카드 셋(1~7관 명인 · 8관 대가)이 본 칸 안', async () => {
  const { FACTIONS, FINAL_FACTION } = await import('../src/data/factions.js');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const f of FACTIONS) for (const ante of [1, 4, 7, 8]) {
      if ((ante === 8) !== (f.id === FINAL_FACTION)) continue;
      const run = M.run.createRun({ seed: 1, draft: false });
      run.ante = ante; run.factions[ante - 1] = f.id;
      const plan = M.select.selectPlan(run);
      const h = plan.H;
      assert.ok(M.frame.TOP + h <= 270 - M.frame.GAP_GROUP, `${lang} ${f.id} ${ante}관 ${h}`);
      // 연습 · 정식 카드는 세력 띠 아래, 제 내용이 들어가고 아랫변이 명인 카드와 같다
      for (const i of [0, 1]) assert.ok(plan.cards[i].h >= M.select.selectLays(run)[i].h && plan.cards[i].y + plan.cards[i].h === plan.cards[2].y + plan.cards[2].h, `${lang} ${f.id} 카드 ${i}`);
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
  // 깨우기 · 혼 깃든 기물도 진열에 나온다(깨우기는 금이 간 혼이 있을 때 — CHM-42 전엔 이 목록에 없어 160 한도도 재지 않았다)
  for (const s of D.souls.SOULS) a.push({ kind: 'piece', t: 'N', soul: s.id });
  a.push({ kind: 'evolve' }, { kind: 'awaken' }, { kind: 'gamble', id: 'potion' }, { kind: 'gamble', id: 'roulette' });
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
    // 진열 카드는 찜 책갈피 자리를 머릿말에서 뺀다(hold, CHM-58 F) — 머릿말이 한 줄 더 접혀도 한도 안
    for (const it of items) for (const hold of [false, true]) {
      const h = M.parts.itemCardH(it, CARD.w, { run, hold });
      assert.ok(TOP + h + GAP_GROUP + pack + GAP_GROUP + 28 <= BOTTOM, `${lang} ${it.kind} ${it.id || it.t || it.form || it.legend} ${it.edition || ''}${hold ? ' 찜' : ''} ${h}`);
    }
  }
});

// CHM-42: 진열 카드 글은 카드 폭 안에서 낱말 단위로만 줄을 바꾼다. 머릿말 「Awakening」이 값과 딱지 사이(60)에 안 들어가 「Awakenin / g」로,
// 쓰는 법 「Use on a cracked soul」(143) · 「금이 간 혼에 쓴다」(99)가 줄 바꿈 없이 카드(안쪽 94) 밖으로 나갔다. 값은 두 자리(가장 넓은 꼴)
test('진열 카드 글: 머릿말은 낱말 단위로만 줄을 바꾸고 · 모든 줄이 카드 안쪽 폭 안(모든 물건 · 한국어 · 영어)', async () => {
  const { CARD } = M.frame;
  const { TAB, TAB_GAP } = await import('../src/ui/kinds.js');
  const { EDITION_BY_ID } = await import('../src/data/editions.js');
  const run = M.run.createRun({ seed: 1, draft: false });
  const items = await allItems(true);
  let n = 0;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    // hold: 진열 카드(찜 책갈피가 값 왼쪽에 선다 — 첫 줄 폭에서 책갈피 자리를 뺀다, CHM-58 F)
    for (const it of items) for (const hold of [false, true]) {
      const lay = M.parts.itemCardLayout(it, CARD.w, { run, hold });
      const tag = `${lang} ${it.kind} ${it.id || it.t || it.form || it.legend || ''} ${it.edition || ''}${hold ? ' 찜' : ''}`;
      const head = lay.kinds.map(([l]) => l);
      // 낱말이 줄 사이에서 끊기지 않았다: 줄마다 원래 머릿말의 낱말들로만 이뤄진다
      const whole = [M.parts.ITEM_KIND[it.kind], it.edition ? EDITION_BY_ID[it.edition].name : ''].flatMap((s) => M.lang.L(s).split(' '));
      for (const word of head.filter(Boolean).join(' ').split(' ')) assert.ok(whole.includes(word), `${tag}: 머릿말이 낱말 가운데서 끊겼다 ${JSON.stringify(head)}`);
      // 첫 줄은 값 옆, 다음 줄은 딱지 뒤 끝까지
      const priceW = M.text.textWidth(`$${it.price}`, true) + 2 + TAB + TAB_GAP + (hold ? M.parts.HOLD_MARK.w + M.parts.HOLD_MARK.gap : 0);
      head.forEach((l, k) => assert.ok(M.text.textWidth(l) <= (k ? lay.IW - TAB - TAB_GAP : lay.IW - priceW), `${tag}: 머릿말 ${k + 1}째 줄 「${l}」 ${M.text.textWidth(l)}`));
      for (const [l] of lay.lines) assert.ok(M.text.textWidth(l) <= lay.IW, `${tag}: 「${l}」 ${M.text.textWidth(l)} > ${lay.IW}`);
      n++;
    }
  }
  assert.ok(n > 400, `잰 물건 ${n}`);
  M.lang.setLang('ko');
});

// CHM-42: 금빛 꾸러미가 붙어 꾸러미 칸이 셋(폭 72)이면 봉투 없이 이름 → 값. 이름(앞 낱말)이 하나라도 굵게 안 들어가면
// 그 줄 셋을 다 작은 봉투 + 값으로(두루마리 좁은 칸과 같은 규칙) — 영어 「Engraving」(63 > 58)이 「Engrav…」로 잘렸다
test('꾸러미 좁은 칸: 줄의 이름이 다 굵게 들어갈 때만 이름, 하나라도 넘치면 줄 전체가 봉투 + 값', async () => {
  const S = await import('../src/ui/screens/shop.js');
  const { CENTER, CARD } = M.frame;
  const w = Math.floor((CENTER.w - 2 * 4) / 3);
  assert.equal(w, 72);
  assert.equal(S.packNameRoom(w), 58);
  const kinds = ['piece', 'chart', 'engraving', 'golden'].map((kind) => ({ kind, price: 4 }));
  M.lang.setLang('ko');
  for (const pk of kinds) assert.ok(M.text.textWidth(S.packShortName(pk), true) <= 58, `ko 「${S.packShortName(pk)}」`);
  assert.equal(S.packRowNames(kinds, w), true);
  M.lang.setLang('en');
  assert.equal(S.packRowNames([{ kind: 'piece' }, { kind: 'chart' }, { kind: 'golden' }], w), true); // Piece 35 · Tome 36 · Golden 43
  assert.equal(S.packRowNames([{ kind: 'piece' }, { kind: 'engraving' }, { kind: 'golden' }], w), false); // Engraving 63
  assert.equal(S.packRowNames([{ kind: 'engraving' }, { kind: 'chart' }], CARD.w), true); // 넓은 칸(봉투 + 이름)은 따지지 않는다
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    // 작은 봉투 칸: 값(「공짜」 · 「Free」 · 두 자리 값)이 봉투 오른쪽 자리에 들어가고, 칸 높이는 그대로(상점 줄 끝 268)
    const lay = S.packCellLayout({ kind: 'engraving' }, w, { names: false });
    assert.ok(lay.small && lay.h === S.packCellH({ kind: 'engraving' }, w), `${lang} 작은 봉투 칸 ${lay.h}`);
    for (const s of [M.lang.L('공짜'), '$12']) assert.ok(M.text.textWidth(s, true) <= lay.tw, `${lang} 「${s}」 ${M.text.textWidth(s, true)} > ${lay.tw}`);
  }
  M.lang.setLang('ko');
});

// CHM-58 ②: 건너뛰기 패 글은 관 선택 카드 판 아래 온 폭에 두 줄까지(세 줄이면 영어 카드가 본 칸을 넘는다 — 관 선택 시험)
test('건너뛰기 패 글: 모든 패가 카드 폭에 두 줄 안, 낱말 가운데서 끊기지 않는다(한국어 · 영어)', async () => {
  const { CHART_FORMS } = await import('../src/data/charts.js');
  const run = M.run.createRun({ seed: 1, draft: false });
  const IW = M.select.blindLayout(run, 0).IW;
  const tags = [{ kind: 'money', amount: 12 }, ...CHART_FORMS.map((form) => ({ kind: 'chart', form })), ...['piece', 'chart', 'engraving'].map((pack) => ({ kind: 'pack', pack })), ...['slot', 'reroll', 'double', 'golden', 'fragment'].map((kind) => ({ kind }))];
  assert.equal(M.select.tagText({ kind: 'money', amount: 5 }), '$5 받기'); // 옛 기록의 패도 읽힌다
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const t of tags) {
      const s = M.select.tagText(t), lines = M.text.wrap(s, IW, true);
      assert.ok(s && lines.length <= 2, `${lang} ${t.kind} ${JSON.stringify(lines)}`);
      for (const l of lines) assert.ok(M.text.textWidth(l, true) <= IW, `${lang} ${t.kind} 「${l}」`);
    }
  }
  M.lang.setLang('ko');
});

// CHM-58 ②: 건너뛰기 패 「꾸러미 칸 +1」에 금빛 꾸러미가 붙으면 꾸러미 칸이 넷(폭 53) — 이름이든 작은 봉투 + 값이든 칸 안에
test('꾸러미 칸 넷: 이름 또는 작은 봉투 + 값이 칸 안(한국어 · 영어)', async () => {
  const S = await import('../src/ui/screens/shop.js');
  const { CENTER } = M.frame;
  const w = Math.floor((CENTER.w - 3 * 4) / 4);
  assert.equal(w, 53);
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const packs = ['piece', 'chart', 'engraving', 'golden'].map((kind) => ({ kind, price: kind === 'golden' ? 0 : 5 }));
    const names = S.packRowNames(packs, w);
    const lay = S.packCellLayout(packs[0], w, { names });
    for (const pk of packs) {
      const strs = names ? [S.packShortName(pk)] : [];
      strs.push(pk.price ? `$${pk.price}` : M.lang.L('공짜'), '$12');
      for (const t of strs) assert.ok(M.text.textWidth(t, true) <= lay.tw, `${lang} ${pk.kind} 「${t}」 ${M.text.textWidth(t, true)} > ${lay.tw}`);
    }
  }
  M.lang.setLang('ko');
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

test('줄 바꿈: 문장부호(마침표 · 쉼표 · 가운뎃점 …)는 줄 머리에 오지 않는다 — 처음 안내 전부 · 한국어 · 영어', async () => {
  const { HINTS } = await import('../src/ui/coach.js');
  const { wrap, CLOSE_PUNCT } = M.text;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const w of [60, 80, 100, 160]) for (const [id, s] of Object.entries(HINTS)) {
      const lines = wrap(s, w);
      for (const l of lines) assert.ok(!CLOSE_PUNCT.test(l), `${lang} ${w} ${id}: ${JSON.stringify(lines)}`);
      assert.equal(lines.join('').replace(/[ ·]/g, ''), M.lang.L(s).replace(/[ ·]/g, ''), `${lang} ${w} ${id} 글자가 빠지지 않는다`);
    }
  }
  // 1배 옛 영어 증원 안내(폭 116 말풍선 안 100): 「reinforcements.」가 100을 넘어 글자로 끊기면 「. Enemies」로 줄이 시작됐다
  M.lang.setLang('en');
  const inc = wrap('Dotted shadows are reinforcements. Enemies land there when this move ends', 100);
  assert.ok(inc.every((l) => !CLOSE_PUNCT.test(l)), JSON.stringify(inc));
  // 지금 영어 안내는 낱말을 글자로 끊지 않는다
  assert.equal(wrap(HINTS.incoming, 100).join(' '), M.lang.L(HINTS.incoming), JSON.stringify(wrap(HINTS.incoming, 100)));
  // 글자 단위로 끊는 긴 낱말: 쉼표 · 마침표가 여럿 이어져도 앞 글자와 함께 내린다
  assert.deepEqual(wrap('abcdefghij.,', 60).filter((l) => CLOSE_PUNCT.test(l)), []);
  M.lang.setLang('ko');
});

// 행마 보기(CHM-26): 탭 셋 · 카드 두 칸 × 두 줄 · 쪽마다 고르게. 행마 글은 카드 안 세 줄까지, 이름은 「새로」와 한 줄
test('행마 보기: 행마 글은 세 줄 안, 상자는 화면 틀(8 ~ 262) 안, 특수 기물은 쪽마다 셋', async () => {
  const { moves, text, frame } = M;
  const w = await import('../src/ui/words.js');
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const t of 'PNBRQKZLOSWTEVMD') {
      const n = text.wrap(w.PIECE_MOVE[t], moves.textW()).length;
      assert.ok(n <= moves.MOVE_LINES, `${lang} ${t} 행마 글 ${n}줄`);
      assert.ok(text.textWidth(w.PIECE_NAME[t], true) + text.textWidth('새로', true) + 6 <= moves.textW(), `${lang} ${t} 이름 + 새로`);
    }
    // 머리 줄: 제목 · 탭 셋 · 돌아가기가 한 줄에
    const tabs = moves.MOVE_TABS.reduce((a, [, l]) => a + Math.max(44, text.textWidth(l, true) + 6) + 4, -4);
    const head = text.textWidth('행마', true) + 8 + tabs + 8 + Math.max(64, text.textWidth('돌아가기', true) + 8);
    assert.ok(head <= moves.cardW() * 2 + 6, `${lang} 머리 줄 ${head}`);
  }
  M.lang.setLang('ko');
  const P = frame.PAD_BOX, h = P + frame.BTN_S + frame.GAP_GROUP + moves.cardH() * 2 + 6 + frame.GAP_GROUP + frame.BTN_S + P;
  assert.ok(Math.floor((270 - h) / 2) >= 8, `상자 높이 ${h}`);
  assert.deepEqual([9, 6, 4, 5, 8, 15].map((n) => { const { pages, per } = moves.movesPages(n); return [pages, per]; }), [[3, 3], [2, 3], [1, 4], [2, 3], [2, 4], [4, 4]]);
  // 기본 · 특수는 늘 전부, 「새로」는 「이 판」에서 온다
  const list = [{ t: 'V', board: true, hand: false, fairy: true, fresh: true }];
  assert.deepEqual(moves.movesTab('basic', list).map((x) => x.t), ['P', 'N', 'B', 'R', 'Q', 'K']);
  const fairy = moves.movesTab('fairy', list);
  assert.equal(fairy.length, 10);
  assert.deepEqual(fairy.filter((x) => x.fresh).map((x) => x.t), ['V']);
});

// CHM-46: 도감 격자 칸 이름은 낱말 단위로 두 줄까지 — 한 줄(row)은 가장 긴 이름의 높이, 두 줄로도 안 되는 이름이 있는 탭만 열을 줄인다
test('도감 격자: 모든 탭 · 모든 이름이 두 줄 안(낱말 단위), 줄 높이는 그 줄의 가장 긴 이름, 쪽은 단추 줄 위', async () => {
  const { codex, frame, parts, text } = M;
  const { LEGENDS } = await import('../src/data/legends.js');
  const room = frame.PAGE.btnY - frame.GAP_GROUP;
  const seen = {};
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const c = { maxims: {}, legends: {}, legendsDone: {}, editions: {}, souls: {}, factions: {}, masters: {} };
    for (const l of LEGENDS) c.legends[l.id] = 1;
    const scr = new codex.CodexScreen({ records: { codex: c, unlocked: { openings: [] } } });
    for (const tab of ['maxims', 'pieces', 'souls', 'factions', 'legends', 'openings', 'editions']) {
      scr.tab = tab;
      const list = scr.entries(), lay = codex.codexLayout(tab, list);
      const cells = lay.pages.flat();
      assert.equal(cells.length, list.length, `${lang} ${tab} 칸 수`);
      assert.ok(lay.cols * lay.cw + (lay.cols - 1) * 4 <= 456, `${lang} ${tab} 격자 폭`);
      for (const q of cells) {
        const e = list[q.i], nm = q.name;
        assert.ok(nm, `${lang} ${tab} 「${M.lang.L(e.name)}」 두 줄에 안 들어간다(열 ${lay.cols})`);
        assert.ok(nm.lines.length <= 2 && nm.lines.join(' ') === M.lang.L(e.name), `${lang} ${tab} ${JSON.stringify(nm.lines)}`);
        for (const l of nm.lines) assert.ok(text.textWidth(l, !nm.thin) <= q.nameW, `${lang} ${tab} 「${l}」 ${text.textWidth(l, !nm.thin)} > ${q.nameW}`);
        // 줄 높이 = 그 줄에서 가장 긴 이름(한 줄 28 · 두 줄 42)
        const row = cells.filter((o) => o.y === q.y && lay.pages.findIndex((p) => p.includes(o)) === lay.pages.findIndex((p) => p.includes(q)));
        assert.equal(q.h, frame.rowBoxH(frame.PAD_CARD, Math.max(...row.map((o) => o.name.lines.length))));
        assert.ok(q.y + q.h <= room, `${lang} ${tab} 칸 아래 ${q.y + q.h} > ${room}`);
      }
      // 열을 줄였다면 하나 더 많은 열에선 두 줄에 안 들어가는 이름이 있다
      if (lay.cols < 5) {
        const cw = Math.floor((456 - lay.cols * 4) / (lay.cols + 1));
        assert.ok(list.some((e) => !parts.wrapName(e.name, cw - frame.PAD_CARD * 2 - (lay.cw - frame.PAD_CARD * 2 - cells.find((o) => o.i === list.indexOf(e)).nameW))), `${lang} ${tab} 열 ${lay.cols}`);
      }
      seen[`${lang} ${tab}`] = `${lay.cols}열 ${lay.pages.length}쪽 ${cells.filter((q) => q.name.lines.length > 1).length}두줄`;
    }
  }
  // 두 줄이 실제로 쓰이는 탭이 있다(영어 격언 · 명경기)
  assert.match(seen['en maxims'], /[1-9]\d*두줄/);
  assert.match(seen['en legends'], /[1-9]\d*두줄/);
  M.lang.setLang('ko');
});

// CHM-46: 판 틀 왼쪽 칸 머리 칸 화면 이름 · 짜임 칸 레퍼토리 이름 · 수업 고르기 이름은 두 줄까지(낱말 단위)
test('두 줄 이름: 머리 칸 화면 이름 · 레퍼토리 이름 · 수업 이름이 낱말 단위 두 줄 안, 머리 칸은 그 줄 수로 hug', async () => {
  const { parts, frame, common, text } = M;
  const { JOSEKIS } = await import('../src/data/josekis.js');
  const { PACK_NAME } = await import('../src/ui/words.js');
  const room = frame.LEFT.w - frame.PAD_BOX * 2;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    const titles = ['상점', '레퍼토리', '관 선택', ...Object.values(PACK_NAME)];
    for (const t of titles) {
      const nm = parts.wrapName(t, room);
      assert.ok(nm && nm.lines.length <= 2, `${lang} 머리 칸 「${M.lang.L(t)}」`);
      // 머리 칸 높이: 제목 줄마다 18
      assert.equal(common.headLayout(nm.lines.length, 0).h - common.headLayout(1, 0).h, (nm.lines.length - 1) * frame.LINE_TITLE);
    }
    for (const j of JOSEKIS) {
      const nm = parts.wrapName(j.name, room);
      assert.ok(nm && nm.lines.length <= 2, `${lang} 레퍼토리 「${M.lang.L(j.name)}」`);
    }
    // 수업 고르기: 보통 굵기, 단추 32 안에 두 줄(14 × 2)이 테와 2 이상 띄워 들어간다
    for (const L of M.lessons.LESSONS) {
      const nm = parts.wrapName(L.title, 140 - frame.PAD_BOX - 4 - 32, { bold: false });
      assert.ok(nm && nm.lines.length <= 2 && !nm.thin, `${lang} 수업 「${M.lang.L(L.title)}」`);
      for (const l of nm.lines) assert.ok(text.textWidth(l) <= 96);
    }
  }
  // 영어 「Engraving Bundle」 · 「Stepping Stones」는 두 줄
  M.lang.setLang('en');
  assert.deepEqual(parts.wrapName('각인 꾸러미', room).lines, ['Engraving', 'Bundle']);
  assert.deepEqual(parts.wrapName('발판', room).lines, ['Stepping', 'Stones']);
  M.lang.setLang('ko');
  // 두 줄 단추: 첫 줄 잉크 위 · 둘째 줄 잉크 아래가 테(32의 첫 · 끝 줄)와 2 이상, 빠지는 줄(2)은 테에 닿지 않는다
  const top = (32 - 2 * frame.LINE) >> 1;
  const ink0 = frame.textY(top), ink1 = frame.textY(top + frame.LINE) + 11;
  assert.ok(ink0 - 1 >= 2 && 31 - ink1 >= 2 && ink1 + 2 <= 30, `수업 단추 두 줄 ${ink0} · ${ink1}`);
});

// 짜임 칸: 레퍼토리 이름이 두 줄이 되어도(영어 「Stepping Stones」) 시너지 이름표 줄과 레퍼토리 줄이 칸 안 —
// 칩 줄이 하나도 안 들어가면 이름표 줄 오른쪽 「+N」(제목 두 줄 · 레퍼토리 넷 줄 = 영어 각인 꾸러미 + Stepping Stones를 낀 레퍼토리 셋)
test('짜임 칸: 두 줄 머리 칸 · 두 줄 레퍼토리 이름 · 레퍼토리 셋이어도 시너지 이름표 줄과 레퍼토리 줄이 칸 안에 들어간다', () => {
  const { common, frame } = M;
  const { PAD_BOX: P, LINE, GAP_IN, GAP_GROUP, FAM_ROW, FAM_H } = frame;
  for (const [titleLines, jsLines] of [[1, 3], [1, 4], [2, 3], [2, 4], [2, 2]]) {
    const st = common.sideStack(common.headLayout(titleLines, 0).h, common.footLayout(3).h);
    const jsH = GAP_GROUP + LINE + GAP_IN + jsLines * LINE;
    assert.ok(P * 2 + LINE + jsH <= st.mid.h, `제목 ${titleLines}줄 · 레퍼토리 ${jsLines}줄: 짜임 칸 ${st.mid.h}`);
    // 레퍼토리 셋이 한 줄씩이면 칩 줄 하나는 들어간다(지금까지와 같다)
    if (titleLines === 1 && jsLines === 3) assert.ok(P * 2 + LINE + GAP_IN + FAM_ROW + jsH <= st.mid.h);
  }
  assert.equal(FAM_ROW - FAM_H, 2);
});

// CHM-46: 마스터전 머리 칸 제목은 이름만(「마스터」는 빨간 빛깔과 말풍선) — 여덟 이름이 굵게 한 줄(96)에 들어간다
test('마스터전 제목: 마스터 여덟 이름이 머리 칸 제목 줄에 굵게 들어간다(한국어 · 영어)', async () => {
  const { MASTER_BY_ID } = await import('../src/data/masters.js');
  const { frame, text } = M;
  const room = frame.LEFT.w - frame.PAD_BOX * 2;
  for (const lang of LANGS) {
    M.lang.setLang(lang);
    for (const m of Object.values(MASTER_BY_ID)) assert.ok(text.textWidth(m.name, true) <= room, `${lang} ${M.lang.L(m.name)} ${text.textWidth(m.name, true)}`);
  }
  M.lang.setLang('ko');
});

// 다음 수(CHM-60): 손 카드 오른쪽 끝의 좁은 칸 — 카드 1~5장과 겹치지 않고, 넷째 카드의 「!?」 딱지와도 겹치지 않고, 화면 안
test('다음 수 칸: 손 카드 · 「!?」 딱지와 겹치지 않고 오른쪽 칸 안에 든다', async () => {
  const { handTagRect } = await import('../src/ui/annot.js');
  const B = M.battle;
  const lay = B.BattleScreen.prototype.rightLayout.call({});
  const col = B.nextColumn(lay);
  const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  assert.equal(col.x + col.w, B.RX + B.RW);
  assert.ok(col.y >= lay.handY && col.y + col.h <= BOTTOM, `칸 ${col.y}~${col.y + col.h}`);
  for (const r of col.slots) assert.ok(r.w >= 10 && r.h >= 11 + 2, '반 크기 기물(8×11)이 테 안에 든다');
  for (let n = 1; n <= 5; n++) {
    for (let i = 0; i < n; i++) {
      const hr = B.BattleScreen.prototype.handRect.call({}, i, n, lay);
      assert.ok(hr.w >= 17, `${n}장 카드 폭 ${hr.w}(기물 16이 든다)`);
      assert.ok(!over(hr, col), `${n}장 ${i}째 카드가 다음 수 칸과 겹친다`);
      for (const lift of [0, 4]) assert.ok(!over(handTagRect(hr.x, hr.y - lift, hr.w, 0), col), `${n}장 ${i}째 「!?」`);
    }
  }
  // 넷이면 카드는 22(전에는 25)
  assert.equal(B.BattleScreen.prototype.handRect.call({}, 0, 4, lay).w, 22);
});

// CHM-68 뒤: 연줄로 명경기 조각이 흔해져 전설 화면에 격언을 많이 들고 들어온다. 가진 격언 칸이 넘치면 여러 줄로 나란히(아이콘만),
// 새 전설 칸은 맨 아래 한 줄 — 모두 제목(2배, y 22 ~ 44) 밑 · 「계속」(y 244) 위 · 화면 안에. 「최대」는 격언 칸이 끝까지 찬 판:
// 기본 칸 5 + 흑요 판본 10(칸을 스스로 가져온다) + 다른 전설 넷 = 19. 칸 폭이 아이콘(24)을 담는 4줄까지면 20개가 든다.
test('전설 화면 격언 칸: 칸이 끝까지 찬 판(흑요 포함)도 제목 밑 · 「계속」 위 · 화면 안, 칸끼리 겹치지 않는다', async () => {
  const L = await import('../src/ui/screens/legend.js');
  const { MAXIMS } = await import('../src/data/maxims.js');
  const { LEGENDS } = await import('../src/data/legends.js');
  const TITLE_BOTTOM = 22 + 22, BUTTON_TOP = 270 - 26;
  const check = (n, tag) => {
    const lay = L.legendSlots(n);
    const all = [...lay.rects, lay.slot];
    for (const r of all) {
      assert.ok(r.x >= 0 && r.x + r.w <= 480 && r.y >= 0 && r.y + r.h <= 270, `${tag}: 화면 밖 ${JSON.stringify(r)}`);
      assert.ok(r.y > TITLE_BOTTOM, `${tag}: 제목과 겹침 y ${r.y}`);
      assert.ok(r.y + r.h < BUTTON_TOP, `${tag}: 「계속」과 겹침 ${r.y + r.h}`);
      assert.ok(r.x >= L.LEGEND_RX && r.x + r.w <= L.LEGEND_RX + L.LEGEND_RW, `${tag}: 오른쪽 칸 밖`);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${tag}: 칸 ${i} · ${j} 겹침`);
    }
    if (lay.narrow) assert.ok(lay.cw >= 24, `${tag}: 아이콘(24)이 칸 폭 ${lay.cw}에 안 든다`);
    else assert.equal(lay.cw, L.LEGEND_RW);
    return lay;
  };
  // 다섯까지는 예전과 같은 한 줄(이름이 보인다), 그 위는 여러 줄
  for (let n = 0; n <= 20; n++) {
    const lay = check(n, `가진 격언 ${n}`);
    if (n <= 5) assert.equal(lay.cols, 1, `가진 격언 ${n}`);
  }
  // 실제 판 상태로: 격언 칸 5를 끝까지 · 흑요 10 · 다른 전설 넷
  const run = M.run.createRun({ seed: 1, draft: false });
  const plain = MAXIMS.filter((m) => m.rarity !== 'legendary');
  run.maxims = plain.slice(0, 15).map((m, i) => ({ uid: 100 + i, id: m.id, data: {}, edition: i < 10 ? 'obsidian' : null, paid: 5 }));
  assert.equal(M.run.maximCount(run), M.run.maximCapacity(run));
  const legend = LEGENDS[0].id;
  for (const l of LEGENDS) run.maxims.push({ uid: 200 + run.maxims.length, id: l.id, data: {}, edition: null, paid: 0, legendary: true });
  const others = run.maxims.filter((m) => m.id !== legend).length;
  assert.equal(others, 19);
  check(others, '칸이 끝까지 찬 판');
  // smoke가 만난 판(격언 다섯 + 전설 셋)
  assert.equal(check(8, 'smoke 판').cols, 2);
});
