// 화면 쪽 순수 데이터(그림 마스크 · 명국 재생 · 문구)의 모양 검사. DOM 없이 돈다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_IDS } from '../src/render/icons.js';
import { SPR, SW, SH } from '../src/render/sprites.js';
import { REPLAYS, sqOf } from '../src/ui/replays.js';
import { MAXIMS } from '../src/data/maxims.js';
import { LEGENDS } from '../src/data/legends.js';
import fs from 'node:fs';

test('격언 · 전설 아이콘은 모두 있고 12×12', () => {
  const src = fs.readFileSync(new URL('../src/render/icons.js', import.meta.url), 'utf8');
  for (const id of [...MAXIMS.map((m) => m.id), ...LEGENDS.map((l) => l.id)]) assert.ok(ICON_IDS.includes(id), id);
  const body = src.slice(src.indexOf('const I = {'), src.indexOf('};', src.indexOf('const I = {')));
  for (const m of body.matchAll(/(\w+): \[([^\]]+)\]/g)) {
    const rows = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    assert.equal(rows.length, 12, m[1]);
    for (const r of rows) assert.equal(r.length, 12, `${m[1]} ${r}`);
  }
});

test('기물 스프라이트는 16×22', () => {
  for (const [k, rows] of Object.entries(SPR)) {
    assert.equal(rows.length, SH, k);
    for (const r of rows) assert.equal(r.length, SW, k);
  }
});

test('명국 재생: 명국마다 있고, 수의 출발 칸에 기물이 있다', () => {
  for (const l of LEGENDS) {
    const rp = REPLAYS[l.id];
    assert.ok(rp, l.id);
    const at = new Map(rp.pieces.map(([t, side, sq]) => [sq, t]));
    for (const [a, b] of rp.moves) {
      assert.ok(at.has(a), `${l.id} ${a}`);
      const t = at.get(a);
      at.delete(a);
      at.set(b, t);
      const s = sqOf(b);
      assert.ok(s.f >= 0 && s.f < 8 && s.r >= 0 && s.r < 8);
    }
  }
});

test('화면 글에 만든 쪽 말 · 설명서 말투가 없다', () => {
  const bad = /엔진|시뮬|스폰|틱|버프|트리거|쿨다운|팩|이벤트|클릭하|누르세요|하세요|하십시오|아니라/;
  const dirs = ['src/ui', 'src/ui/screens', 'src/data'];
  for (const d of dirs) for (const f of fs.readdirSync(new URL(`../${d}`, import.meta.url))) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(new URL(`../${d}/${f}`, import.meta.url), 'utf8');
    // 문자열 안의 글만(주석 빼고)
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    for (const m of code.matchAll(/'([^'\n]*[가-힣][^'\n]*)'|`([^`\n]*[가-힣][^`\n]*)`/g)) {
      const s = m[1] || m[2];
      assert.ok(!bad.test(s), `${d}/${f}: ${s}`);
    }
  }
});

test('영어: 데이터 글(이름 · 효과 · 이야기 · 재현 · 단 · 해금 · 정석 · 혼 · 특성 · 묘수 · 행마)이 모두 옮겨진다', async () => {
  const { missing } = await import('../src/ui/lang.js');
  const { MASTERS } = await import('../src/data/masters.js');
  const { ENGRAVINGS } = await import('../src/data/engravings.js');
  const { EDITIONS } = await import('../src/data/editions.js');
  const { OPENINGS } = await import('../src/data/openings.js');
  const { CHARTS, chartText } = await import('../src/data/charts.js');
  const { DANS } = await import('../src/sim/run.js');
  const { UNLOCKS } = await import('../src/ui/records.js');
  const { JOSEKIS } = await import('../src/data/josekis.js');
  const { SOULS } = await import('../src/data/souls.js');
  const { TRAITS } = await import('../src/data/traits.js');
  const { TACTICS } = await import('../src/data/tactics.js');
  const { PIECE_MOVE, PIECE_NAME } = await import('../src/ui/words.js');
  const all = [
    ...JOSEKIS.flatMap((j) => [j.name, j.text]), ...SOULS.flatMap((x) => [x.name, x.text]), ...TRAITS.flatMap((x) => [x.name, x.text]),
    ...TACTICS.flatMap((x) => [x.name, x.text]), ...Object.values(PIECE_MOVE), ...Object.values(PIECE_NAME),
    ...MAXIMS.flatMap((m) => [m.name, m.text, m.verb]), ...MASTERS.flatMap((m) => [m.name, m.text]),
    ...LEGENDS.flatMap((l) => [l.name, l.story, l.text, l.feat, l.verb]), ...ENGRAVINGS.flatMap((e) => [e.name, e.text]),
    ...EDITIONS.flatMap((e) => [e.name, e.text]), ...Object.values(OPENINGS).flatMap((o) => [o.name, o.text]),
    ...Object.keys(CHARTS).flatMap((f) => [CHARTS[f].name, chartText(f)]), ...DANS.map((d) => d.text), ...UNLOCKS.map((u) => u.text),

    // 말풍선에만 보이는 덧말
    ...[...MAXIMS, ...SOULS, ...JOSEKIS].map((x) => x.more).filter(Boolean),
  ];
  assert.deepEqual(missing(all), []);
});

test('낱말 풀이: 낱말마다 한국어 · 영어 이름과 풀이가 있고, 시너지(가족)마다 낱말이 있다', async () => {
  const { TERMS, TERM_GROUPS, splitTerms } = await import('../src/ui/glossary.js');
  const { FAMILIES } = await import('../src/data/families.js');
  const ids = TERMS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TERMS) {
    assert.ok(t.word && t.enWord && t.say && t.enSay, t.id);
    assert.ok(TERM_GROUPS.some(([g]) => g === t.group), t.id);
    assert.ok(!/엔진|스폰|버프|트리거|시뮬/.test(t.say), t.id);
  }
  for (const f of FAMILIES) assert.ok(ids.includes(`fam_${f.id}`), f.id);
  // 시너지 이름은 같은 자리에서 시작하는 짧은 낱말(시너지)보다 먼저 잡히고, 「기사도」 · 「야간기사」에는 걸리지 않는다
  assert.deepEqual(splitTerms('희생 시너지 · 왕관 시너지').filter(([, id]) => id).map(([, id]) => id), ['fam_sacrifice', 'fam_crown']);
  assert.deepEqual(splitTerms('기사도 · 야간기사').filter(([, id]) => id), []);
});

test('낱말 상자: 기본 낱말은 글에서 찾아도 상자를 띄우지 않고, 카드 하나에 둘까지', async () => {
  const { termsIn, keyList, TERM_BY_ID } = await import('../src/ui/glossary.js');
  // 상자 높이는 글 너비로 잰다: 연기 시험의 가짜 캔버스(글자 너비만 흉내)를 꽂는다
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { setCanvasFactory } = await import('../src/render/surface.js');
  const dom = makeFakeDom();
  setCanvasFactory(() => dom.document.createElement('canvas'));
  assert.deepEqual(termsIn(['나이트로 시작: 배수 ×1.5']), []);
  assert.deepEqual(termsIn(['끊긴 사슬: 배수 +8']), ['cut']);
  // 그 낱말 자체를 가리킨 것({ id })은 기본 낱말이어도 남는다(값 · 배수 칸)
  assert.deepEqual(termsIn([{ id: 'links' }]), ['links']);
  for (const id of ['drop', 'chain', 'value', 'links', 'form', 'hand', 'bag', 'move', 'goal', 'money']) assert.ok(TERM_BY_ID[id].basic, id);
  assert.equal(keyList(['fam_leap', 'fairy', 'threat', 'cut']).length, 2);
  // 가리킨 낱말은 둘 안에 꼭 든다
  assert.deepEqual(keyList(['fam_leap', 'fairy', 'threat'], 'threat'), ['fam_leap', 'threat']);
  setCanvasFactory(null);
});

test('설명 자리: 판 틀은 왼쪽 칸에 가리킨 것의 윗변 높이로, 판 밖은 가리킨 것 바로 아래(모자라면 위)', async () => {
  const { placeNotes, placeBubble, SIDE_X, SIDE_W, NOTE_W } = await import('../src/ui/placement.js');
  // 판 틀: 어디를 가리키든 x · 폭이 같고 윗변만 따라간다
  for (const card of [{ x: 128, y: 22, w: 108, h: 150 }, { x: 246, y: 22, w: 108, h: 150 }, { x: 364, y: 22, w: 108, h: 150 }]) {
    const p = placeNotes('side', card, [40, 45]);
    assert.deepEqual([p.x, p.w, p.y, p.n], [SIDE_X, SIDE_W, 22, 2]);
  }
  // 아래 끝의 것은 화면 안으로 당긴다
  const low = placeNotes('side', { x: 364, y: 230, w: 26, h: 36 }, [60]);
  assert.equal(low.y + 60, 268);
  // 왼쪽 칸 안의 것은 그 아래(모자라면 위) — 가리킨 것을 덮지 않는다
  const inside = placeNotes('side', { x: 8, y: 98, w: 48, h: 22 }, [40]);
  assert.equal(inside.y, 123);
  const bag = placeNotes('side', { x: 8, y: 240, w: 112, h: 22 }, [40]);
  assert.equal(bag.y + 40, 237);
  // 판 밖: 바로 아래 왼끝 맞춤, 오른쪽 끝이면 오른끝 맞춤
  const a = placeNotes('below', { x: 12, y: 32, w: 88, h: 24 }, [50]);
  assert.deepEqual([a.x, a.y, a.w], [12, 59, NOTE_W]);
  const b = placeNotes('below', { x: 380, y: 32, w: 88, h: 24 }, [50]);
  assert.equal(b.x + b.w, 468);
  // 아래에 누를 것이 있으면 위로
  const c = placeNotes('below', { x: 12, y: 200, w: 88, h: 24 }, [30], { avoid: [{ x: 12, y: 244, w: 80, h: 18 }] });
  assert.equal(c.y + 30, 197);
  // 다 안 들어가면 뒤의 것부터 뺀다
  assert.equal(placeNotes('side', { x: 200, y: 50, w: 28, h: 28 }, [120, 100, 90]).n, 2);
  // 왼쪽 칸 안의 것인데 위 · 아래 어디에도 안 들어가면 넓은 쪽으로 화면 끝까지 당긴다(안 뜨지는 않는다)
  const sq = placeNotes('side', { x: 14, y: 77, w: 100, h: 13 }, [180]);
  assert.ok(sq.squeezed && sq.y + 180 === 268);
  // 처음 안내도 같은 자리(판 틀은 왼쪽 칸, 화살표는 오른쪽)
  const h = placeBubble('side', { x: 300, y: 100, w: 28, h: 28 }, 40);
  assert.deepEqual([h.x, h.y, h.arrow], [SIDE_X, 100, 'right']);
});
