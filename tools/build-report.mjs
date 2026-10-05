// 빌드 단면(CHM-65) 집계: 판 하네스 `--build`가 남긴 판마다의 build 열쇠(tools/build.mjs buildLog)를 관별로 모은다.
//   run.mjs가 「빌드」 절을 찍을 때 쓰고(buildReport), dump를 다시 읽어 여러 측정을 합쳐 볼 때도 쓴다:
//   node tools/build-report.mjs <run.mjs --dump 파일> [다른 dump …]
// 무리: 이긴 판 · 진 판 · 점화한 판 · 못 한 판. 관 k의 단면 = 관 k의 마스터전 뒤 상점을 떠난 짜임(관 k+1을 맞는 짜임).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { B } from '../src/sim/run.js';
import { SMART } from './shopbot.mjs';
import { firstBelow, SPEND_KEYS, SPEND_NAME, EARN_KEYS, EARN_NAME } from './build.mjs';

const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const pct = (xs, p) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const share = (xs, fn) => (xs.length ? xs.filter(fn).length / xs.length : NaN);
const sumObj = (o) => Object.values(o || {}).reduce((a, x) => a + x, 0);

// 판 하나 → 집계에 쓸 꼴
export function runView(r) {
  const snaps = (r.build && r.build.snaps) || [];
  return { seed: r.seed, won: !!r.won, ante: r.ante, ignite: !!r.ignite, snaps, shops: (r.build && r.build.shops) || [], other: (r.build && r.build.other) || 0, at: (k) => snaps.find((s) => s.ante === k) || null };
}
export const groupsOf = (V) => [['전체', V], ['이긴 판', V.filter((v) => v.won)], ['진 판', V.filter((v) => !v.won)], ['점화', V.filter((v) => v.ignite)], ['점화 못 함', V.filter((v) => !v.ignite)]];

// 관 k(1~7) 단면의 힘 비율(다음 관 연습 목표 대비, 대국판 n개 평균 점수 ÷ 목표)
export function powerTable(V) {
  const out = [];
  for (let k = 1; k <= 7; k++) {
    const row = { ante: k, next: k + 1, groups: {} };
    for (const [g, xs] of groupsOf(V)) {
      const rs = xs.map((v) => v.at(k)).filter((s) => s && s.power).map((s) => s.power.ratio);
      row.groups[g] = { n: rs.length, p25: r3(pct(rs, 0.25)), p50: r3(pct(rs, 0.5)), p75: r3(pct(rs, 0.75)), below1: r3(share(rs, (x) => x < 1)) };
    }
    // 관 k+1을 넘긴 판 · 관 k+1에서 끝난 판(관 k 단면이 있는 판 중)
    const has = V.filter((v) => v.at(k) && v.at(k).power);
    const pass = has.filter((v) => v.won || v.ante > k + 1), died = has.filter((v) => !v.won && v.ante === k + 1);
    const q = (xs) => { const rs = xs.map((v) => v.at(k).power.ratio); return { n: rs.length, p25: r3(pct(rs, 0.25)), p50: r3(pct(rs, 0.5)), p75: r3(pct(rs, 0.75)), below1: r3(share(rs, (x) => x < 1)) }; };
    row.pass = q(pass); row.died = q(died);
    out.push(row);
  }
  return out;
}
// 진 판을 끝난 관으로 나눠, 그 앞 관들의 단면 힘 비율 p50(행 = 끝난 관, 열 = 단면 관)
export function deathMatrix(V) {
  const out = [];
  for (let d = 2; d <= 8; d++) {
    const xs = V.filter((v) => !v.won && v.ante === d);
    if (!xs.length) continue;
    const cells = {};
    for (let k = 1; k < d; k++) { const rs = xs.map((v) => v.at(k)).filter((s) => s && s.power).map((s) => s.power.ratio); cells[k] = { n: rs.length, p50: r3(pct(rs, 0.5)) }; }
    out.push({ died: d, n: xs.length, cells });
  }
  // 이긴 판의 같은 열(견줄 기준)
  const won = V.filter((v) => v.won), cells = {};
  for (let k = 1; k <= 7; k++) { const rs = won.map((v) => v.at(k)).filter((s) => s && s.power).map((s) => s.power.ratio); cells[k] = { n: rs.length, p50: r3(pct(rs, 0.5)) }; }
  out.push({ died: 'won', n: won.length, cells });
  return out;
}
// 처음 1 밑으로 내려간 단면의 관(없으면 '없음')
export function belowTable(V) {
  const out = {};
  for (const [g, xs] of groupsOf(V).slice(1, 3)) {
    const c = {};
    for (const v of xs) { const k = firstBelow(v.snaps); c[k ?? '없음'] = (c[k ?? '없음'] || 0) + 1; }
    out[g] = { n: xs.length, at: c };
  }
  return out;
}

// 상금: 관마다 번 것(종류별) · 쓴 것(종류별) · 관 끝에 가진 것 · 상점을 떠날 때 남긴 돈. 판 하나의 평균(그 관 단면이 있는 판)
export function moneyTable(V) {
  const out = [];
  for (let k = 1; k <= 8; k++) {
    const row = { ante: k, reserve: SMART.reserve(k), groups: {} };
    for (const [g, xs] of groupsOf(V).slice(0, 3)) {
      const ss = xs.map((v) => v.at(k)).filter(Boolean);
      const shops = xs.flatMap((v) => v.shops.filter((s) => s.ante === k && s.out != null));
      const earn = Object.fromEntries(EARN_KEYS.map((e) => [e, r3(mean(ss.map((s) => (s.earn || {})[e] || 0)))]));
      const spend = Object.fromEntries(SPEND_KEYS.map((e) => [e, r3(mean(ss.map((s) => (s.spend || {})[e] || 0)))]));
      row.groups[g] = {
        n: ss.length, earn, spend, earnSum: r3(mean(ss.map((s) => sumObj(s.earn)))), spendSum: r3(mean(ss.map((s) => sumObj(s.spend)))),
        held: r3(mean(ss.map((s) => s.money))), heldP50: pct(ss.map((s) => s.money), 0.5),
        shops: shops.length, left: r3(mean(shops.map((s) => s.out))), leftP50: pct(shops.map((s) => s.out), 0.5),
        leftOverReserve: r3(share(shops, (s) => s.out > SMART.reserve(k) + 4)), leftAtCap: r3(share(shops, (s) => s.out >= 25)),
      };
    }
    out.push(row);
  }
  return out;
}

// 진열: 상점 하나에 보인 카드 · 산 카드, 안 산 카드 중 보였을 때 살 돈이 있었던 것.
// 「좋은 것」 어림: 귀한(rare) 격언 · 판본 격언 · ×배수 격언(봇의 득 재기는 다시 돌리지 않는다 — 카드 등급 · 꼴로 어림한다).
// 마지막 진열(떠날 때 보이던 것)의 안 산 카드는 떠날 때 돈으로: 적립(SMART.reserve)을 남기고 살 수 있었나 · 헐어야 했나.
export const GOOD = { rare: (it) => it.k === 'maxim' && it.r === 'rare', edition: (it) => it.k === 'maxim' && !!it.e, x: (it) => it.k === 'maxim' && it.f === 'x' };
export function displayTable(V) {
  const out = [];
  for (let k = 1; k <= 8; k++) {
    const row = { ante: k, groups: {} };
    for (const [g, xs] of groupsOf(V).slice(0, 3)) {
      const shops = xs.flatMap((v) => v.shops.filter((s) => s.ante === k));
      const items = shops.flatMap((s) => s.items);
      const kinds = {};
      for (const it of items) { const o = kinds[it.k] || (kinds[it.k] = { seen: 0, bought: 0, affUnbought: 0 }); o.seen++; if (it.b) o.bought++; else if (it.a) o.affUnbought++; }
      const good = {};
      for (const [name, fn] of Object.entries(GOOD)) {
        const gi = items.filter(fn);
        good[name] = { seen: gi.length, bought: gi.filter((it) => it.b).length, affUnbought: gi.filter((it) => !it.b && it.a).length, cant: gi.filter((it) => !it.b && !it.a).length };
      }
      // 마지막 진열의 안 산 카드 중 좋은 것: 떠날 때 돈으로 적립을 남기고 살 수 있었나
      let keep = 0, breakR = 0, cant = 0;
      for (const s of shops) {
        if (s.out == null) continue;
        const last = Math.max(0, ...s.items.map((it) => it.g));
        for (const it of s.items) {
          if (it.b || it.g !== last || !(GOOD.rare(it) || GOOD.edition(it) || GOOD.x(it))) continue;
          if (s.out - it.p >= SMART.reserve(k)) keep++; else if (s.out >= it.p) breakR++; else cant++;
        }
      }
      row.groups[g] = { shops: shops.length, perShop: r3(items.length / Math.max(1, shops.length)), boughtShare: r3(share(items, (it) => it.b)), kinds, good, lastGood: { keep, breakR, cant },
        packs: { seen: shops.reduce((a, s) => a + s.packs.length, 0), bought: shops.reduce((a, s) => a + s.packs.filter((p) => p.b).length, 0) } };
    }
    out.push(row);
  }
  return out;
}

// 무엇을 가진 판이 이기나: 관 k 단면의 특징마다 가진 판 · 그 판 승률 · 안 가진 판 승률(그 관 단면이 있는 판 중)
export const FEATURES = {
  'x2': ['×배수 격언 둘 이상', (s) => s.form.x >= 2],
  'x0': ['×배수 격언 없음', (s) => s.form.x === 0],
  'ed': ['판본 격언 하나 이상', (s) => sumObj(s.editions) >= 1],
  'fam4': ['시너지 4 이상', (s) => s.fam >= 4],
  'fam6': ['시너지 6 이상', (s) => s.fam >= 6],
  'fairy2': ['특수 기물 둘 이상', (s) => s.fairies >= 2],
  'soul': ['혼 하나 이상', (s) => s.souls >= 1],
  'eng2': ['각인 둘 이상', (s) => s.engraved >= 2],
};
export function featureTable(V) {
  const out = [];
  for (let k = 1; k <= 7; k++) {
    const has = V.filter((v) => v.at(k));
    // 기보 레벨 합은 그 관의 가운데값으로 나눈다
    const med = pct(has.map((v) => v.at(k).charts), 0.5);
    const feats = { ...FEATURES, chartHi: [`기보 레벨 합 ≥ 그 관 가운데값(${med})`, (s) => s.charts >= med] };
    const row = { ante: k, n: has.length, win: r3(share(has, (v) => v.won)), feats: {} };
    for (const [id, [name, fn]] of Object.entries(feats)) {
      const y = has.filter((v) => fn(v.at(k))), n = has.filter((v) => !fn(v.at(k)));
      row.feats[id] = { name, n: y.length, win: r3(share(y, (v) => v.won)), nWithout: n.length, winWithout: r3(share(n, (v) => v.won)) };
    }
    // 이긴 판 · 진 판의 평균 단면
    const avg = (xs, fn) => r3(mean(xs.map((v) => fn(v.at(k)))));
    const W = has.filter((v) => v.won), L = has.filter((v) => !v.won);
    const cols = { maxims: (s) => s.maxims, x: (s) => s.form.x, m: (s) => s.form.m, v: (s) => s.form.v, o: (s) => s.form.o, ed: (s) => sumObj(s.editions), rare: (s) => (s.rarity.rare || 0), charts: (s) => s.charts, chartTop: (s) => (s.chartTop ? s.chartTop[1] : 0), engraved: (s) => s.engraved, souls: (s) => s.souls, awake: (s) => s.awake, fam: (s) => s.fam, deck: (s) => s.deck, fairies: (s) => s.fairies, money: (s) => s.money };
    row.avg = { won: Object.fromEntries(Object.entries(cols).map(([c, fn]) => [c, avg(W, fn)])), lost: Object.fromEntries(Object.entries(cols).map(([c, fn]) => [c, avg(L, fn)])) };
    out.push(row);
  }
  return out;
}

// 곡선과 힘의 관별 오름: 목표 B[k]/B[k−1](k = 2~8)와 이긴 판 힘(관 k−1 단면 점수 → 관 k 단면 점수, 대국판은 관 k → 관 k+1)
// 단면 점수는 다음 관 대국판에서 잰 것이라 관 k 단면 ÷ 관 k−1 단면 = 관 k+1 판의 힘 ÷ 관 k 판의 힘 — 목표 오름 B[k]/B[k−1]과 같은 자리.
export function growthTable(V) {
  const out = [];
  for (let k = 2; k <= 7; k++) {
    const row = { from: k, to: k + 1, curve: r3(B[k] / B[k - 1]), groups: {} };
    for (const [g, xs] of groupsOf(V).slice(0, 3)) {
      const pairs = xs.map((v) => [v.at(k - 1), v.at(k)]).filter(([a, b]) => a && b && a.power && b.power && a.power.mean > 0);
      const per = pairs.map(([a, b]) => b.power.mean / a.power.mean);
      const ma = pct(pairs.map(([a]) => a.power.mean), 0.5), mb = pct(pairs.map(([, b]) => b.power.mean), 0.5);
      row.groups[g] = { n: pairs.length, perRunP50: r3(pct(per, 0.5)), perRunP25: r3(pct(per, 0.25)), perRunP75: r3(pct(per, 0.75)), medians: r3(mb / ma) };
    }
    out.push(row);
  }
  return out;
}

export function buildAggregate(R) {
  const V = R.map(runView);
  return {
    runs: V.length, won: V.filter((v) => v.won).length, ignited: V.filter((v) => v.ignite).length, ledgerOther: V.reduce((a, v) => a + v.other, 0),
    curve: B.slice(), reserve: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => SMART.reserve(k)),
    power: powerTable(V), death: deathMatrix(V), below: belowTable(V), money: moneyTable(V), display: displayTable(V), features: featureTable(V), growth: growthTable(V),
  };
}

// run.mjs 「빌드」 절(표로 찍고 JSON 열쇠 build로 돌려준다)
export function buildReport(R, { pc, f, f2, table }) {
  const A = buildAggregate(R);
  const p = (x) => (x == null ? '-' : f2(x));
  console.log(`\n빌드(tools/build.mjs): 판 ${A.runs} · 이김 ${A.won} · 점화 ${A.ignited} · 상금 흐름을 못 나눈 명령 ${A.ledgerOther}. 관 k 단면 = 관 k 마스터전 뒤 상점을 떠난 짜임, 힘 = 관 k+1 연습 대국판 ${R[0] && R[0].build && R[0].build.snaps.find((s) => s.power) ? R[0].build.snaps.find((s) => s.power).power.scores.length : '-'}개 첫 손 최선 ÷ 관 k+1 연습 목표`);
  console.log('힘 비율 p50 (p25~p75) · 1 밑 몫 — 무리별, 그리고 관 k+1을 넘긴 판 / 관 k+1에서 끝난 판');
  const G = ['전체', '이긴 판', '진 판', '점화', '점화 못 함'];
  table(['관 k→k+1', ...G, '넘김', '거기서 끝남'], A.power.map((r) => [`${r.ante}→${r.next}`,
    ...G.map((g) => { const x = r.groups[g]; return x.n ? `${p(x.p50)} (${p(x.p25)}~${p(x.p75)}) ${pc(x.below1)} /${x.n}` : '-'; }),
    ...[r.pass, r.died].map((x) => (x.n ? `${p(x.p50)} ${pc(x.below1)} /${x.n}` : '-'))]));
  console.log('진 판을 끝난 관으로 나눈 단면 힘 비율 p50(열 = 단면 관 k)');
  table(['끝난 관', '판', ...[1, 2, 3, 4, 5, 6, 7].map(String)], A.death.map((r) => [r.died === 'won' ? '이긴 판' : String(r.died), String(r.n), ...[1, 2, 3, 4, 5, 6, 7].map((k) => (r.cells[k] && r.cells[k].n ? p(r.cells[k].p50) : '-'))]));
  console.log(`처음 1 밑인 단면 관: ${Object.entries(A.below).map(([g, x]) => `${g} ${x.n}판 — ${Object.entries(x.at).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`).join(' / ')}`);
  console.log('상금(판 하나 평균): 번 것 · 쓴 것 · 관 끝에 가진 것 · 상점을 떠날 때 남긴 돈 p50 · 적립+4 넘게 남긴 상점 몫 — 이긴 판 / 진 판');
  table(['관', '적립', '번 것', '쓴 것', '가진 것', '남긴 돈 p50', '적립+4 넘게', '진 판 번 것', '쓴 것', '가진 것', '남긴 돈 p50', '적립+4 넘게'], A.money.map((r) => {
    const w = r.groups['이긴 판'], l = r.groups['진 판'];
    return [String(r.ante), String(r.reserve), f(w.earnSum, 1), f(w.spendSum, 1), f(w.held, 1), String(w.leftP50 ?? '-'), pc(w.leftOverReserve), f(l.earnSum, 1), f(l.spendSum, 1), f(l.held, 1), String(l.leftP50 ?? '-'), pc(l.leftOverReserve)];
  }));
  console.log('쓴 곳(판 하나 평균, 전체): ' + SPEND_KEYS.map((k) => SPEND_NAME[k]).join(' · '));
  table(['관', ...SPEND_KEYS.map((k) => SPEND_NAME[k]), ...EARN_KEYS.map((k) => EARN_NAME[k])], A.money.map((r) => { const x = r.groups['전체']; return [String(r.ante), ...SPEND_KEYS.map((k) => f(x.spend[k], 1)), ...EARN_KEYS.map((k) => f(x.earn[k], 1))]; }));
  console.log('진열의 좋은 것(귀한 · 판본 · ×배수 격언): 보임 / 삼 / 살 돈 있었는데 안 삼 — 이긴 판 | 진 판, 마지막 진열의 안 산 좋은 것: 적립 남기고 살 수 있었음 · 헐어야 · 못 삼');
  table(['관', '이긴 판 상점', '귀한', '판본', '×배수', '마지막', '진 판 상점', '귀한', '판본', '×배수', '마지막'], A.display.map((r) => {
    const cell = (x) => [String(x.shops), ...['rare', 'edition', 'x'].map((k) => `${x.good[k].seen}/${x.good[k].bought}/${x.good[k].affUnbought}`), `${x.lastGood.keep}·${x.lastGood.breakR}·${x.lastGood.cant}`];
    return [String(r.ante), ...cell(r.groups['이긴 판']), ...cell(r.groups['진 판'])];
  }));
  console.log('관 k 단면의 특징별 판 승률(가진 판 / 안 가진 판, 그 관 단면이 있는 판 중)');
  const fids = Object.keys(A.features[0].feats);
  table(['관', '판', '승률', ...fids], A.features.map((r) => [String(r.ante), String(r.n), pc(r.win), ...fids.map((id) => { const x = r.feats[id]; return `${pc(x.win)}/${pc(x.winWithout)} (${x.n})`; })]));
  console.log(`  특징: ${fids.map((id) => `${id} ${A.features[0].feats[id].name}`).join(' · ')}`);
  console.log('곡선과 힘의 오름: 목표 B[k]/B[k−1] · 이긴 판 · 진 판 힘의 오름(관 k−1 단면 → 관 k 단면 점수, 판마다 비의 p50 · 가운데값끼리의 비)');
  table(['관', '목표 ×', '이긴 판 p50', '가운데값 비', '판', '진 판 p50', '가운데값 비', '판'], A.growth.map((r) => {
    const w = r.groups['이긴 판'], l = r.groups['진 판'];
    return [`${r.from}→${r.to}`, f2(r.curve), p(w.perRunP50), p(w.medians), String(w.n), p(l.perRunP50), p(l.medians), String(l.n)];
  }));
  return A;
}

// CLI: dump 여러 개를 합쳐 같은 표를 찍고 JSON을 표준 출력 끝에(--json 경로를 주면 파일로)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jsonAt = process.argv.indexOf('--json');
  const files = process.argv.slice(2).filter((x, i, a) => !x.startsWith('--') && a[i - 1] !== '--json');
  const R = files.flatMap((fn) => JSON.parse(readFileSync(fn, 'utf8')).runs);
  const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
  const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  const dw = (x) => [...String(x)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  const table = (cols, rows) => { const w = cols.map((c, i) => Math.max(dw(c), ...rows.map((r) => dw(r[i])))); const line = (r) => r.map((x, i) => ' '.repeat(w[i] - dw(x)) + x).join('  '); console.log(line(cols)); for (const r of rows) console.log(line(r)); };
  console.log(`dump ${files.join(' + ')}`);
  const A = buildReport(R, { pc, f, f2: (x) => f(x, 2), table });
  if (jsonAt > 0) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.argv[jsonAt + 1], JSON.stringify(A, null, 1) + '\n'); }
}
