// 기록 합치기(CHM-71, docs/design-notes/leaderboard.md 「기기 잇기 · 클라우드 저장」): 두 기기의 기록 덩이를 하나로.
// 순수 함수 — 교환 · 결합 법칙이 서고 merge(a, a) = a(고른 꼴 norm(a) 기준). 새 기록 칸을 더하면 RULES에도 규칙을 넣는다(test/merge.test.js가 잡는다).
import { emptyRecords, gradeKeys, OPENING_ORDER } from './records.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
// 차례를 정할 수 없는 둘: JSON 글이 큰 쪽(어느 쪽을 먼저 주어도 같은 답)
const byText = (a, b) => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

const max = (a, b) => Math.max(num(a), num(b));
const or = (a, b) => !!a || !!b;
// 열쇠마다: 수는 큰 쪽, 그 밖은 켜진 쪽(도감 칸 · 본 안내 — legends는 모은 조각 수)
const union = (a, b) => {
  const out = {};
  for (const src of [a, b]) for (const [k, v] of Object.entries(isObj(src) ? src : {})) {
    out[k] = typeof v === 'number' || typeof out[k] === 'number' ? max(out[k], v) : or(out[k], v);
  }
  return out;
};
// 최고 기록 { score, … }: 점수가 큰 쪽. 없는 쪽은 진다
const best = (a, b) => {
  if (!isObj(a) || !isObj(b)) return isObj(a) ? a : isObj(b) ? b : null;
  return num(a.score) !== num(b.score) ? (num(a.score) > num(b.score) ? a : b) : byText(a, b);
};
const openings = (a, b) => {
  const all = [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].filter((x) => typeof x === 'string');
  const at = (id) => { const i = OPENING_ORDER.indexOf(id); return i < 0 ? OPENING_ORDER.length : i; };
  return all.sort((x, y) => at(x) - at(y) || (x < y ? -1 : x > y ? 1 : 0));
};
// 오늘의 대국: 날짜가 늦은 쪽. 같은 날이면 더 좋은 판 + 둔 판 수는 큰 쪽
const daily = (a, b) => {
  if (!isObj(a) || !isObj(b)) return isObj(a) ? a : isObj(b) ? b : null;
  if (a.date !== b.date) return String(a.date) > String(b.date) ? a : b;
  const { runs: ra, ...x } = a, { runs: rb, ...y } = b;
  return { ...best(x, y), runs: max(ra, rb) };
};
// 판마다 새로 본 것 { seed, keys }: 같은 판이면 합집합, 다른 판이면 글이 큰 쪽
const runNew = (a, b) => {
  if (!isObj(a) || !isObj(b)) return isObj(a) ? a : isObj(b) ? b : null;
  if (a.seed !== b.seed) return byText(a, b);
  return { seed: a.seed, keys: [...new Set([...(a.keys || []), ...(b.keys || [])])].sort() };
};
// 규칙이 없는 칸(옛 기록 · 앞으로 생길 칸): 수는 큰 쪽 · 참거짓은 켜진 쪽 · 객체는 칸마다 · 그 밖은 글이 큰 쪽
const loose = (a, b) => {
  if (a === undefined || a === null) return b === undefined ? a : b;
  if (b === undefined || b === null) return a;
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
  if (isObj(a) && isObj(b)) { const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = loose(a[k], b[k]); return out; }
  return byText(a, b);
};

// 칸마다 합치는 규칙(문서의 표와 같다)
export const RULES = {
  v: () => 1,
  runs: max, wins: max, mates: max, legends: max, brilliants: max, reviews: max, reviewReplays: max,
  bestAnte: max, bestEndless: max,
  bestMove: best, bestBrilliant: best,
  grades: (a, b) => union(gradeKeys(a), gradeKeys(b)),
  codex: (a, b) => { const out = {}; for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) out[k] = union((a || {})[k], (b || {})[k]); return out; },
  unlocked: (a, b) => ({ ...loose(a, b), openings: openings((a || {}).openings, (b || {}).openings), dan: max((a || {}).dan, (b || {}).dan) }),
  danWins: union,
  daily,
  lessonsDone: or, kingDone: or,
  lessonsSeen: union, coachSeen: union, movesSeen: union,
  runNew,
  // 이 기기의 취향(다음 새 판 · 마지막에 고른 것): 덩이에 싣지 않는다(LOCAL_ONLY). 규칙은 법칙을 지키려고만 둔다
  kingAgain: or, lastOpening: loose, lastDan: loose,
};
// 서버에 올리지 않고, 받은 것으로 덮지도 않는 칸
export const LOCAL_ONLY = ['kingAgain', 'lastOpening', 'lastDan'];

// 고른 꼴: 없는 칸을 채우고(옛 기록) 해금 차례 · 평가 열쇠를 맞춘다
export function normRecords(r) {
  const base = emptyRecords(), x = isObj(r) ? r : {};
  return mergeRaw({ ...base, ...x, codex: { ...base.codex, ...(isObj(x.codex) ? x.codex : {}) }, unlocked: { ...base.unlocked, ...(isObj(x.unlocked) ? x.unlocked : {}) } }, base);
}
function mergeRaw(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const v = (RULES[k] || loose)(a[k], b[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
export function mergeRecords(a, b) { return mergeRaw(normRecords(a), normRecords(b)); }

// 서버에 올릴 꼴(이 기기의 취향을 뺀다) · 받은 것을 이 기기 것에 합친 꼴(취향은 이 기기 것 그대로)
export function cloudRecords(r) { const out = { ...r }; for (const k of LOCAL_ONLY) delete out[k]; return out; }
export function mergeInto(local, remote) {
  const out = mergeRecords(cloudRecords(local), cloudRecords(isObj(remote) ? remote : {}));
  for (const k of LOCAL_ONLY) if (local[k] !== undefined) out[k] = local[k];
  return out;
}

// 합쳐서 늘어난 것(기기 잇기 화면의 한 줄): 도감 칸 · 열린 레퍼토리 · 판 수 · 도달한 관
const cells = (r) => Object.values(r.codex || {}).reduce((n, kind) => n + Object.values(kind || {}).filter(Boolean).length, 0);
export function mergeGain(before, after) {
  const a = normRecords(before), b = normRecords(after);
  return {
    codex: Math.max(0, cells(b) - cells(a)),
    openings: Math.max(0, b.unlocked.openings.length - a.unlocked.openings.length),
    runs: Math.max(0, b.runs - a.runs),
    ante: b.bestAnte > a.bestAnte ? b.bestAnte : 0,
  };
}
