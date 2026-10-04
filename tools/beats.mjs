// 박자표(CHM-66): 쾌감 사건의 등급 표 한 곳 + 판마다 사건을 시간순으로 모으는 기록기 + 판 하나의 박자 지표.
// 판 하네스 `node tools/run.mjs … --beats`가 쓴다(꺼져 있으면 아무것도 하지 않는다). 등급 매기기 · 지표 셈은 순수 함수
// (test/beats.test.js). 기록기는 판(run)을 읽기만 한다 — 상태 · 난수를 건드리지 않아 켜도 끄도 판 결과는 같다.
//
// 시간축: (관, 대국 번호, 대국 안 수 번호). 대국 번호 bi는 판에서 실제로 둔 대국의 차례(1부터, 건너뛴 대국은 세지 않는다).
// 수 번호 m은 그 사건이 난 수(1부터, 희생은 그 뒤에 둘 수의 번호). 대국 밖(상점 · 꾸러미 · 건너뛰기 패)의 사건은 m = 0이고
// 바로 앞에 끝난 대국 bi에 붙인다(그 상점은 그 대국의 보상 자리). 첫 대국 앞의 사건(정석 고르기 · 1관 건너뛰기 패)은 bi = 1.
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { SOUL_BY_ID } from '../src/data/souls.js';
import { familyCounts, THRESHOLDS } from '../src/data/families.js';

// ── 등급 표. key → [등급, 표에 보일 이름, 어디서 오는가]
export const BEAT_TABLE = {
  // 작음(S)
  grade3:   ['S', '★(사슬 3)', 'grade n 3'],
  ov2:      ['S', '넘침 ×2', 'overflow tier 2'],
  promote:  ['S', '프로모션', 'promote(사슬 안, sq 있음)'],
  fam2:     ['S', '시너지 2 문턱', 'familyCounts 최댓값이 2에 닿음(사건 없음 — 판 상태로 셈)'],
  sac:      ['S', '희생 「!?」', 'discard'],
  // 중간(M)
  grade5:   ['M', '★★(사슬 5)', 'grade n 5'],
  ov5:      ['M', '넘침 ×5', 'overflow tier 5'],
  golden:   ['M', '금빛 적 먹음', 'golden'],
  mate:     ['M', '체크메이트', 'mate'],
  edition:  ['M', '판본 · 귀한 격언 얻음', "maxim(edition 있음 또는 rarity 'rare') · edition"],
  rareSoul: ['M', '귀한 혼 얻음', "ensoul · buy(piece + soul) · gamble(soul), 혼 rarity 'rare'"],
  frag1:    ['M', '첫 조각', "fragment part 'first'"],
  fam4:     ['M', '시너지 4 문턱', 'familyCounts 최댓값이 4에 닿음'],
  chest3:   ['M', '마스터 상자 3칸', 'chest count 3'],
  crack:    ['M', '혼에 금이 감', 'crack'],
  goldPack: ['M', '금빛 꾸러미', "goldenPack · packOpen(kind 'golden', from 'tag')"],
  // 큼(L)
  grade8:   ['L', '★★★(사슬 8)', 'grade n 8'],
  grade12:  ['L', '∞(사슬 12)', 'grade n 12'],
  ov10:     ['L', '넘침 ×10', 'overflow tier 10'],
  brilliant:['L', '탁월수 「!!」', 'brilliant'],
  fragFeat: ['L', '재현 조각', "fragment part 'feat'"],
  fragGold: ['L', '금빛 조각', "fragment part 'gold'"],
  legend:   ['L', '전설 완성', 'legend'],
  chest5:   ['L', '상자 5칸', 'chest count 5'],
  awaken:   ['L', '혼 각성', 'awaken'],
  fam6:     ['L', '시너지 6 문턱', 'familyCounts 최댓값이 6에 닿음'],
};
export const TIER = Object.fromEntries(Object.entries(BEAT_TABLE).map(([k, v]) => [k, v[0]]));
export const RANK = { S: 1, M: 2, L: 3 };
// 엔진 점화: 판에서 처음 사슬 8 이상 또는 넘침 ×10
export const IGNITION = new Set(['grade8', 'grade12', 'ov10']);
const GRADE_KEY = { 3: 'grade3', 5: 'grade5', 8: 'grade8', 12: 'grade12' };
const OV_KEY = { 2: 'ov2', 5: 'ov5', 10: 'ov10' };
const FRAG_KEY = { first: 'frag1', feat: 'fragFeat', gold: 'fragGold' };
const rareSoul = (id) => !!(id && SOUL_BY_ID[id] && SOUL_BY_ID[id].rarity === 'rare');

// 사건 하나 → 등급 표의 key(없으면 null). 순수.
export function beatKey(e) {
  switch (e.type) {
    case 'grade': return GRADE_KEY[e.n] || null;
    case 'overflow': return OV_KEY[e.tier] || null;            // ×1(목표에 닿음)은 표에 없다
    case 'promote': return e.sq != null ? 'promote' : null;    // 상점의 프로모션(pieceId)은 사슬 쾌감이 아니다
    case 'discard': return 'sac';
    case 'golden': return 'golden';
    case 'mate': return 'mate';
    case 'maxim': { const m = MAXIM_BY_ID[e.id]; return e.edition || (m && m.rarity === 'rare') ? 'edition' : null; }
    case 'edition': return 'edition';
    case 'ensoul': return rareSoul(e.soul) ? 'rareSoul' : null;
    case 'gamble': return rareSoul(e.soul) ? 'rareSoul' : null;
    case 'buy': return e.item && e.item.kind === 'piece' && rareSoul(e.item.soul) ? 'rareSoul' : null; // 혼 두루마리(kind soul)는 쓸 때 ensoul로
    case 'fragment': return FRAG_KEY[e.part] || null;
    case 'chest': return e.count >= 5 ? 'chest5' : e.count >= 3 ? 'chest3' : null;
    case 'crack': return 'crack';
    case 'goldenPack': return 'goldPack';
    case 'packOpen': return e.kind === 'golden' && e.from === 'tag' ? 'goldPack' : null; // 상점의 공짜 금빛 꾸러미를 여는 것은 goldenPack에서 이미 셌다
    case 'brilliant': return 'brilliant';
    case 'legend': return 'legend';
    case 'awaken': return 'awaken';
    default: return null;
  }
}
export const beatTier = (e) => { const k = beatKey(e); return k ? TIER[k] : null; };

// 시너지 문턱: 가족 수 최댓값이 before → now로 바뀔 때 새로 넘은 문턱의 key들. 순수.
export function famKeys(before, now) {
  return THRESHOLDS.filter((t) => before < t && now >= t).map((t) => 'fam' + t);
}
const famMax = (run) => Math.max(0, ...Object.values(familyCounts(run)));

// ── 기록기. 판 하나에 하나(beatLog(run) — 판을 만든 바로 뒤). record(run, events, b, mu, logLen)를 명령마다(shopbot act가) 부른다.
// b = 명령 앞의 run.battle(대국이 끝나도 같은 객체), mu = 명령 앞의 b.movesUsed, logLen = 명령 앞의 run.log 길이.
// 돌려주는 rows(판 요약의 beats 열쇠):
//   ev: [bi, 관, m, key]  battles: [bi, 관, 대국(0~2), 이김 1/0, 끝난 까닭, 점수, 목표, 쓴 수, 둘 수 있던 수, 목표를 처음 넘긴 수 | null]
//   seen: { edition | golden | frag: [bi …] } — 드문 층이 「보인」 대국(진열 · 꾸러미에 판본 격언 · 첫 조각 카드, 판에 금빛 적)
export function beatLog(run) {
  const out = { ev: [], battles: [], seen: { edition: [], golden: [], frag: [] } };
  let bi = 0, fam = famMax(run), cross = null;
  const shown = new WeakSet();
  const at = () => Math.max(1, bi);
  const look = (list) => {
    for (const it of list || []) {
      if (!it || shown.has(it)) continue;
      shown.add(it);
      if (it.kind === 'maxim' && it.edition) out.seen.edition.push(at());
      if (it.kind === 'fragment') out.seen.frag.push(at());
    }
  };
  return {
    rows: out,
    record(run, events, b, mu, logLen) {
      const inBattle = !!b;
      const m = inBattle ? mu + 1 : 0;
      for (const e of events) {
        if (e.type === 'battleStart') { bi++; cross = null; continue; }
        const k = beatKey(e);
        if (k) out.ev.push([at(), run.ante, inBattle ? m : 0, k]);
      }
      if (inBattle && b.target && cross == null && b.score >= b.target) cross = b.movesUsed;
      // 대국이 끝났다: 판(런)이 log에 한 줄을 남긴다
      const row = inBattle && run.log.length > logLen ? run.log.at(-1) : null;
      if (row && !row.skipped) {
        out.battles.push([bi, row.ante, row.blind, row.won ? 1 : 0, row.reason, row.score, row.target, b.movesUsed, b.movesUsed + b.movesLeft, cross]);
        if (row.goldenSeen) out.seen.golden.push(bi);
      }
      // 판 상태로 세는 것: 시너지 문턱 · 진열 · 꾸러미에 보인 드문 카드
      const now = famMax(run);
      if (now > fam) { for (const k of famKeys(fam, now)) out.ev.push([at(), run.ante, inBattle ? m : 0, k]); fam = now; }
      if (run.shop && (run.phase === 'shop' || run.phase === 'pack')) look(run.shop.display);
      if (run.phase === 'pack' && run.pack) look(run.pack.options);
    },
  };
}

// ── 판 하나의 지표(순수). beats = beatLog().rows
// 가장 긴 연속: 대국 1..n 가운데 marked에 없는 대국이 가장 길게 이어진 수
export function longestDry(n, marked) {
  let best = 0, cur = 0;
  for (let i = 1; i <= n; i++) { if (marked.has(i)) cur = 0; else best = Math.max(best, ++cur); }
  return best;
}
// 진 대국 점수/목표 층
export const NEAR_EDGES = [0.5, 0.8, 0.95, 1];
export const NEAR_NAMES = ['<0.5', '0.5~0.8', '0.8~0.95', '0.95~1'];
export function nearTier(ratio) {
  for (let i = 0; i < NEAR_EDGES.length; i++) if (ratio < NEAR_EDGES[i]) return i;
  return NEAR_EDGES.length - 1; // 진 대국은 1 밑이다(외통 없이 목표를 넘기면 그 수로 이긴다)
}
// 이긴 대국이 목표를 처음 넘긴 수의 자리: 0 앞 1/3 · 1 가운데 · 2 끝 1/3 (자리 = 넘긴 수 / 둘 수 있던 수)
export function crossThird(cross, max) {
  const p = cross / max;
  return p <= 1 / 3 ? 0 : p <= 2 / 3 ? 1 : 2;
}
// 드문 층 간격: 나온 대국 번호들(같은 대국은 하나로) → 처음까지의 대국 수 · 다음까지의 간격들
export function gaps(list) {
  const u = [...new Set(list)].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < u.length; i++) out.push(u[i] - u[i - 1]);
  return { first: u.length ? u[0] : null, gaps: out, n: u.length };
}

export function runBeats(beats) {
  const B = beats.battles, n = B.length;
  const cnt = { S: 0, M: 0, L: 0 };
  const perBattle = new Map(B.map((x) => [x[0], { S: 0, M: 0, L: 0 }]));
  const markM = new Set(), markL = new Set();
  let firstL = null, ignite = null;
  const first = {};
  for (const [bi, ante, , k] of beats.ev) {
    const t = TIER[k];
    cnt[t]++;
    const pb = perBattle.get(bi);
    if (pb) pb[t]++;
    if (RANK[t] >= 2) markM.add(bi);
    if (t === 'L') { markL.add(bi); if (firstL == null) firstL = bi; }
    if (IGNITION.has(k) && ignite == null) ignite = { bi, ante };
    if (first[k] == null) first[k] = { bi, ante };
  }
  const lost = B.filter((x) => !x[3] && x[6]), won = B.filter((x) => x[3]);
  const crossed = won.filter((x) => x[9] != null);
  return {
    battles: n, ...cnt,
    perBattle: B.map((x) => ({ ante: x[1], won: !!x[3], ...perBattle.get(x[0]) })),
    dryM: longestDry(n, markM), dryL: longestDry(n, markL), noL: cnt.L === 0,
    firstL, ignite,
    fam: { 2: first.fam2 || null, 4: first.fam4 || null, 6: first.fam6 || null },
    near: lost.map((x) => ({ ante: x[1], tier: nearTier(x[5] / x[6]) })),
    late: crossed.map((x) => ({ ante: x[1], last2: x[9] >= x[8] - 1, third: crossThird(x[9], x[8]) })),
    mateUnder: won.filter((x) => x[9] == null).length, // 목표 밑에서 체크메이트로 이긴 대국
    rare: {
      edition: { seen: gaps(beats.seen.edition), got: gaps(beats.ev.filter((e) => e[3] === 'edition').map((e) => e[0])) },
      golden: { seen: gaps(beats.seen.golden), got: gaps(beats.ev.filter((e) => e[3] === 'golden').map((e) => e[0])) },
      frag: { seen: gaps(beats.seen.frag), got: gaps(beats.ev.filter((e) => e[3] === 'frag1').map((e) => e[0])) },
    },
  };
}
