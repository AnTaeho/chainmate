// 판 밖에 남는 것(힘은 남기지 않는다): 기록 · 도감 · 오프닝 해금 · 단 해금 · 오늘의 대국.
// 저장은 localStorage 한 덩이(KEYS.records). 순수 함수라 Node에서도 돈다.
import { KEYS } from './save.js';

export const OPENING_ORDER = ['standard', 'london', 'sicilian', 'queens_gambit', 'rook_endgame'];
// 해금 과제(내가 정한 것): 판마다 하나씩 보이는 「다음 해금까지」
export const UNLOCKS = [
  { id: 'london', text: '5관에 닿는다', have: (r) => r.bestAnte, need: 5 },
  { id: 'sicilian', text: '외통으로 다섯 번 이긴다', have: (r) => r.mates, need: 5 },
  { id: 'queens_gambit', text: '한 사슬에 여덟을 먹는다(!!!)', have: (r) => (r.grades['!!!'] || 0) + (r.grades['∞'] || 0), need: 1 },
  { id: 'rook_endgame', text: '불멸의 기보 하나를 완성한다', have: (r) => r.legends, need: 1 },
];
export const MAX_DAN = 8;

export function emptyRecords() {
  return {
    v: 1,
    runs: 0, wins: 0, bestAnte: 0,
    bestMove: null,            // { score, steps: [모습…], ante }
    mates: 0, legends: 0, grades: {},
    codex: { maxims: {}, masters: {}, legends: {}, legendsDone: {}, openings: { standard: true }, editions: {} },
    unlocked: { openings: ['standard'], dan: 0 },
    danWins: {},
    daily: null,               // { date, ante, blind, won, score, runs }
  };
}

export function loadRecords(store) {
  const r = store.get(KEYS.records, null);
  const base = emptyRecords();
  if (!r || r.v !== 1) return base;
  return { ...base, ...r, codex: { ...base.codex, ...(r.codex || {}) }, unlocked: { ...base.unlocked, ...(r.unlocked || {}) }, grades: { ...(r.grades || {}) } };
}

const mark = (rec, kind, id, fresh) => {
  if (id == null) return;
  if (!rec.codex[kind][id]) { rec.codex[kind][id] = true; fresh.push(`${kind}:${id}`); }
};

// 명령 하나가 끝날 때마다: 사건과 지금 판 상태에서 기록 · 도감을 채운다. fresh = 새로 채운 도감 칸 목록(판마다)
export function observe(rec, run, events, fresh = []) {
  for (const e of events) {
    if (e.type === 'win' && e.reason === 'mate') rec.mates++;
    if (e.type === 'grade') rec.grades[e.mark] = (rec.grades[e.mark] || 0) + 1;
    if (e.type === 'legend') { rec.legends++; if (!rec.codex.legendsDone[e.legend]) { rec.codex.legendsDone[e.legend] = true; fresh.push(`legendsDone:${e.legend}`); } }
    if (e.type === 'fragment') {
      const n = (e.have.first ? 1 : 0) + (e.have.feat ? 1 : 0) + (e.have.gold ? 1 : 0);
      const was = rec.codex.legends[e.legend] || 0;
      if (n > was) { rec.codex.legends[e.legend] = n; fresh.push(`legends:${e.legend}`); }
    }
  }
  if (!run) return fresh;
  mark(rec, 'openings', run.opening, fresh);
  for (const m of run.maxims) { if (!m.legendary) mark(rec, 'maxims', m.id, fresh); if (m.edition) mark(rec, 'editions', m.edition, fresh); }
  if (run.shop) for (const it of run.shop.display) { if (it.kind === 'maxim') { mark(rec, 'maxims', it.id, fresh); if (it.edition) mark(rec, 'editions', it.edition, fresh); } }
  if (run.pack) for (const o of run.pack.options) { if (o.kind === 'maxim') { mark(rec, 'maxims', o.id, fresh); if (o.edition) mark(rec, 'editions', o.edition, fresh); } }
  if (run.battle) for (const s of run.battle.mods) if (s.kind === 'master' || MASTER_IDS.has(s.id)) mark(rec, 'masters', s.id, fresh);
  rec.bestAnte = Math.max(rec.bestAnte, run.ante);
  return fresh;
}
const MASTER_IDS = new Set(['iron_wall', 'fog', 'mirror', 'hourglass', 'heavy_hand', 'silence', 'grudge', 'grandmaster']);

export function noteMove(rec, score, steps, ante) {
  if (!rec.bestMove || score > rec.bestMove.score) { rec.bestMove = { score, steps: steps.slice(0, 16), ante }; return true; }
  return false;
}

// 판이 끝났을 때: 판 수 · 이긴 판 · 단 해금 · 오프닝 해금. 돌려주는 값 { unlocked: [오프닝 id], dan: 새로 연 단 | null }
export function finishRun(rec, run, { daily = null } = {}) {
  const won = run.phase === 'won' || run.endless;
  rec.runs++;
  if (won) rec.wins++;
  rec.bestAnte = Math.max(rec.bestAnte, Math.min(run.ante, 8));
  const out = { unlocked: [], dan: null };
  const dan = run.dan || 0;
  if (won) {
    rec.danWins[dan] = (rec.danWins[dan] || 0) + 1;
    if (dan >= rec.unlocked.dan && dan < MAX_DAN) { rec.unlocked.dan = dan + 1; out.dan = dan + 1; }
  }
  for (const u of UNLOCKS) {
    if (rec.unlocked.openings.includes(u.id)) continue;
    if (u.have(rec) >= u.need) { rec.unlocked.openings.push(u.id); out.unlocked.push(u.id); }
  }
  if (daily) {
    const score = run.ante * 10 + (run.blind || 0) + (won ? 100 : 0);
    const d = rec.daily && rec.daily.date === daily ? rec.daily : { date: daily, score: -1, runs: 0 };
    d.runs++;
    if (score > d.score) Object.assign(d, { score, ante: run.ante, blind: run.blind, won });
    rec.daily = d;
  }
  return out;
}

// 다음 해금 하나(결과 화면 · 판 준비 화면에 보인다)
export function nextUnlock(rec) {
  const u = UNLOCKS.find((x) => !rec.unlocked.openings.includes(x.id));
  if (!u) return null;
  return { id: u.id, text: u.text, have: Math.min(u.have(rec), u.need), need: u.need };
}

// 오늘의 대국: 날짜(YYYY-MM-DD) → 시드. 같은 날엔 모두 같은 판.
export function dailySeed(date) {
  let h = 0x811c9dc5;
  const s = `chainmate:${date}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 2147483646 + 1;
}
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
