// CHM-47: 탁월수 → 명경기 조각 · 사슬 평가는 별(★ · ★★ · ★★★ · ∞) · 옛 기록 「!」 열쇠 옮기기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S } from '../src/sim/board.js';
import { createRun, applyRun } from '../src/sim/run.js';
import { GRADES, gradeOf, OLD_GRADE_MARK } from '../src/sim/chain.js';
import { LEGENDS } from '../src/data/legends.js';
import { emptyRecords, loadRecords, UNLOCKS } from '../src/ui/records.js';
import { KEYS } from '../src/ui/save.js';
import { starCount, starsW, STAR_ROWS, STAR_COL } from '../src/ui/stars.js';
import { STAR_HI, STAR_HI4 } from '../src/render/art-hi.js';

const P = (t, id) => ({ t, id, eng: null });
// 판(런)의 첫 대국을 탁월수 장면으로: 킹 하나(e5), 손 Q R P P, 주머니 맨 위 N — 퀸을 바치고 뽑은 나이트로 킹을 먹는다
function brilliantRun(seed = 5, dan = 0, fragments = {}) {
  const run = createRun({ draft: false, seed, dan });
  run.fragments = JSON.parse(JSON.stringify(fragments));
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.board = boardFrom({ e5: 'K' });
  b.incoming = []; b.incomingNext = [];
  b.hand = [P('Q', 904), P('R', 902), P('P', 903), P('P', 910)];
  b.bag = [P('N', 905), ...b.bag];
  b.target = 1e9;
  return run;
}
function playBrilliant(run) {
  const events = [];
  events.push(...applyRun(run, { type: 'discard', handIndices: [0] }));
  const b = run.battle;
  const hi = b.hand.findIndex((p) => p.id === 905);
  events.push(...applyRun(run, { type: 'drop', handIndex: hi, sq: S('d3') }));
  events.push(...applyRun(run, { type: 'capture', sq: S('e5') }));
  return events;
}
const all = (part) => Object.fromEntries(LEGENDS.map((l) => [l.id, { first: true, feat: part === 'feat', gold: false }]));

test('탁월수 → 첫 조각이 없는 명경기 하나의 첫 조각(사건 fragment, via brilliant) · 기록 줄에 남는다', () => {
  const run = brilliantRun();
  const ev = playBrilliant(run);
  const bi = ev.findIndex((e) => e.type === 'brilliant');
  const fi = ev.findIndex((e) => e.type === 'fragment' && e.via === 'brilliant');
  assert.ok(bi >= 0, '탁월수가 났다');
  assert.ok(fi > bi, '조각은 탁월수 뒤에 온다');
  const f = ev[fi];
  assert.equal(f.part, 'first');
  assert.equal(f.via, 'brilliant');
  assert.ok(LEGENDS.some((l) => l.id === f.legend));
  assert.equal(run.fragments[f.legend].first, true);
  assert.deepEqual(run.log.at(-1).brilliantFrags, [{ legend: f.legend, part: 'first' }]);
});

test('탁월수: 첫 조각이 이미 있는 명경기는 고르지 않는다', () => {
  const have = Object.fromEntries(LEGENDS.slice(0, LEGENDS.length - 1).map((l) => [l.id, { first: true, feat: false, gold: false }]));
  const run = brilliantRun(5, 0, have);
  const f = playBrilliant(run).find((e) => e.type === 'fragment' && e.via === 'brilliant');
  assert.equal(f.legend, LEGENDS.at(-1).id);
  assert.equal(f.part, 'first');
});

test('탁월수: 모든 명경기의 첫 조각이 있으면 재현 조각이 빠진 명경기에 재현 조각', () => {
  const have = all('first');
  for (const l of LEGENDS.slice(1)) have[l.id].feat = true;
  const run = brilliantRun(5, 0, have);
  const fr = playBrilliant(run).filter((e) => e.type === 'fragment');
  assert.equal(fr.length, 1);
  assert.deepEqual([fr[0].legend, fr[0].part, fr[0].via], [LEGENDS[0].id, 'feat', 'brilliant']);
  assert.equal(run.fragments[LEGENDS[0].id].feat, true);
});

test('탁월수: 재현 조각으로 셋이 모이면 전설 격언이 들어온다(사다리 그대로)', () => {
  const have = all('feat');
  have[LEGENDS[0].id] = { first: true, feat: false, gold: true };
  const run = brilliantRun(5, 0, have);
  const ev = playBrilliant(run);
  assert.ok(ev.some((e) => e.type === 'legend' && e.legend === LEGENDS[0].id));
  assert.ok(run.maxims.some((m) => m.legendary && m.id === LEGENDS[0].id));
});

test('탁월수: 첫 조각 · 재현 조각이 다 있으면 조각은 없다', () => {
  const run = brilliantRun(5, 0, all('feat'));
  const ev = playBrilliant(run);
  assert.ok(ev.some((e) => e.type === 'brilliant'));
  assert.ok(!ev.some((e) => e.type === 'fragment'));
  assert.deepEqual(run.log.at(-1).brilliantFrags, []);
});

test('탁월수 조각은 결정적이다: 같은 시드면 같은 명경기 · 시드가 다르면 갈릴 수 있다', () => {
  const pick = (seed) => playBrilliant(brilliantRun(seed)).find((e) => e.type === 'fragment' && e.via === 'brilliant').legend;
  assert.equal(pick(5), pick(5));
  const seen = new Set(Array.from({ length: 12 }, (_, i) => pick(100 + i)));
  assert.ok(seen.size >= 2, `시드마다 고르는 명경기가 갈린다(${[...seen]})`);
});

test('탁월수: 레이팅 3단부터 첫 조각은 반(「첫 조각이 반」) — 재현 조각은 그대로', () => {
  let got0 = 0, got3 = 0;
  for (let s = 0; s < 40; s++) {
    if (playBrilliant(brilliantRun(200 + s, 0)).some((e) => e.type === 'fragment' && e.via === 'brilliant')) got0++;
    if (playBrilliant(brilliantRun(200 + s, 3)).some((e) => e.type === 'fragment' && e.via === 'brilliant')) got3++;
  }
  assert.equal(got0, 40);
  assert.ok(got3 > 8 && got3 < 32, `3단 첫 조각 ${got3}/40`);
  const have = all('first');
  assert.ok(playBrilliant(brilliantRun(7, 3, have)).some((e) => e.type === 'fragment' && e.part === 'feat'));
});

test('사슬 평가 별: 3 ★ · 5 ★★ · 8 ★★★ · 12 ∞ · 화면 별 수와 빛깔', () => {
  assert.deepEqual(GRADES.map((g) => [g.n, g.mark]), [[3, '★'], [5, '★★'], [8, '★★★'], [12, '∞']]);
  assert.equal(gradeOf(4).mark, '★');
  assert.equal(gradeOf(9).mark, '★★★');
  assert.deepEqual(GRADES.map((g) => starCount(g.mark)), [1, 2, 3, 0]);
  assert.deepEqual(Object.keys(STAR_COL), ['★', '★★', '★★★']);
  assert.equal(new Set(Object.values(STAR_COL)).size, 3);
  assert.equal(starsW(3, 4), 3 * 9 * 4 + 2 * 4);
  // 두 배 도트: 18×18 · 36×36, 1배 별의 칠한 칸은 두 배 그림에서도 칠해져 있다(모양을 지킨다)
  assert.deepEqual([STAR_HI.length, STAR_HI[0].length, STAR_HI4.length, STAR_HI4[0].length], [18, 18, 36, 36]);
  STAR_ROWS.forEach((r, j) => [...r].forEach((ch, i) => {
    const sub = [STAR_HI[2 * j][2 * i], STAR_HI[2 * j][2 * i + 1], STAR_HI[2 * j + 1][2 * i], STAR_HI[2 * j + 1][2 * i + 1]].filter((x) => x === '#').length;
    assert.ok(ch === '#' ? sub >= 2 : sub <= 2, `별 (${i}, ${j})`);
  }));
  // 체스 주석 「!」 · 「!!」는 사슬 평가에 남지 않는다
  assert.ok(!GRADES.some((g) => g.mark.includes('!')));
});

test('옛 기록: 「!」 · 「!!」 · 「!!!」 열쇠를 별로 옮긴다(둘 다 있으면 더한다) · 해금 과제가 옛 기록을 센다', () => {
  assert.deepEqual(OLD_GRADE_MARK, { '!': '★', '!!': '★★', '!!!': '★★★' });
  const old = { ...emptyRecords(), grades: { '!': 7, '!!': 3, '!!!': 1, '∞': 2, '★★★': 1 } };
  const store = { get: (k, d) => (k === KEYS.records ? JSON.parse(JSON.stringify(old)) : d) };
  const rec = loadRecords(store);
  assert.deepEqual(rec.grades, { '★': 7, '★★': 3, '★★★': 2, '∞': 2 });
  const qg = UNLOCKS.find((u) => u.id === 'queens_gambit');
  assert.equal(qg.have(rec), 4);
  assert.ok(!qg.text.includes('!'), '해금 과제 글에 체스 주석이 없다');
  // 새 기록은 그대로
  const fresh = loadRecords({ get: () => ({ ...emptyRecords(), grades: { '★★': 1 } }) });
  assert.deepEqual(fresh.grades, { '★★': 1 });
});

// CHM-48: 재현 조각 사건은 그 사슬의 사건 뒤, 사슬 끝(end) 앞 — 대국 화면이 사슬 끝 셈 동안 알림을 띄우게(win 뒤면 보상 화면에서 떴다)
test('재현 조각: 대국을 끝낸 수면 사건이 탁월수 조각 뒤 · 사슬 끝(end) 앞 · win 앞에 온다', () => {
  const run = brilliantRun(5, 0, { opera: { first: true, feat: false, gold: false } });
  const ev = playBrilliant(run);
  const fi = ev.findIndex((e) => e.type === 'fragment' && e.legend === 'opera' && e.part === 'feat');
  const wi = ev.findIndex((e) => e.type === 'win');
  const ei = ev.findIndex((e) => e.type === 'end');
  assert.ok(fi >= 0, '첫 수 체크메이트로 오페라 대국 재현 조각');
  assert.ok(wi >= 0, '대국 승리');
  const bi = ev.findIndex((e) => e.type === 'fragment' && e.via === 'brilliant');
  assert.ok(bi >= 0 && bi < fi && fi < ei && ei < wi, `탁월수 조각 ${bi} < 재현 조각 ${fi} < end ${ei} < win ${wi}`);
  assert.equal(run.fragments.opera.feat, true);
});

test('재현 조각: 대국이 이어지는 수면 사건은 사슬 끝(end) 바로 앞에 온다', () => {
  const run = createRun({ draft: false, seed: 5, dan: 0 });
  run.fragments = { immortal: { first: true, feat: false, gold: false } };
  applyRun(run, { type: 'play' });
  const b = run.battle;
  b.board = boardFrom({ e5: 'R', e8: 'R' });
  b.incoming = []; b.incomingNext = [];
  b.hand = [P('N', 901), P('P', 902), P('P', 903), P('P', 904)];
  b.target = 1e9;
  const ev = [];
  ev.push(...applyRun(run, { type: 'drop', handIndex: 0, sq: S('c4') }));
  ev.push(...applyRun(run, { type: 'capture', sq: S('e5') }));
  ev.push(...applyRun(run, { type: 'capture', sq: S('e8') }));
  const fi = ev.findIndex((e) => e.type === 'fragment' && e.legend === 'immortal' && e.part === 'feat');
  assert.ok(fi >= 0, '끊기지 않고 룩 둘');
  assert.ok(!ev.some((e) => e.type === 'win' || e.type === 'lose'));
  assert.equal(ev[fi + 1].type, 'end');
});
