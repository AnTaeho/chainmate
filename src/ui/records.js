// 판 밖에 남는 것(힘은 남기지 않는다): 기록 · 도감 · 오프닝 해금 · 단 해금 · 오늘의 대국.
// 저장은 localStorage 한 덩이(KEYS.records). 순수 함수라 Node에서도 돈다.
import { KEYS } from './save.js';
import { OLD_GRADE_MARK } from '../sim/chain.js';
import { renameOldPieces } from '../sim/oldsave.js';

export const OPENING_ORDER = ['standard', 'london', 'sicilian', 'queens_gambit', 'rook_endgame'];
// 해금 과제(내가 정한 것): 판마다 하나씩 보이는 「다음 해금까지」
export const UNLOCKS = [
  { id: 'london', text: '5관에 닿는다', have: (r) => r.bestAnte, need: 5 },
  { id: 'sicilian', text: '체크메이트로 다섯 번 이긴다', have: (r) => r.mates, need: 5 },
  { id: 'queens_gambit', text: '한 사슬에 여덟을 먹는다', have: (r) => (r.grades['★★★'] || 0) + (r.grades['∞'] || 0), need: 1 },
  { id: 'rook_endgame', text: '불멸의 기보 하나를 완성한다', have: (r) => r.legends, need: 1 },
];
export const MAX_DAN = 8;

export function emptyRecords() {
  return {
    v: 1,
    runs: 0, wins: 0, bestAnte: 0,
    bestMove: null,            // { score, steps: [모습…], ante }
    mates: 0, legends: 0, grades: {},
    brilliants: 0,             // 탁월수 !!(희생한 바로 다음 수로 체크메이트, CHM-35)
    bestBrilliant: null,       // { score, weight, pieces, ante } 가장 큰 탁월수
    codex: { maxims: {}, masters: {}, factions: {}, legends: {}, legendsDone: {}, openings: { standard: true }, editions: {}, souls: {}, awake: {} },
    unlocked: { openings: ['standard'], dan: 0 },
    danWins: {},
    bestEndless: 0,            // 끝없는 대국에서 닿은 가장 깊은 관
    daily: null,               // { date, ante, blind, won, score, runs }
    lessonsDone: false,        // 첫 수업을 끝까지 두었나(건너뛰어도)
    lessonsSeen: {},           // { [수업 id]: true } 끝낸 수업(목록의 표)
    coachSeen: {},             // { [안내 id]: true } 본 처음 안내
    reviews: 0,                // 복기 갈림길 카드를 본 수(길 있음 · 길 없음, CHM-59)
    reviewReplays: 0,          // 갈림길 카드에서 「다시 두기」를 누른 수
  };
  // 칸을 더하면 기기 사이 합치는 규칙도 넣는다(src/ui/merge.js RULES, CHM-71)
}

export function loadRecords(store) {
  const r = renameOldPieces(store.get(KEYS.records, null)); // 뺀 기물(CHM-55)이 남은 가장 큰 한 수 · 탁월수
  const base = emptyRecords();
  if (!r || r.v !== 1) return base;
  return { ...base, ...r, codex: { ...base.codex, ...(r.codex || {}) }, unlocked: { ...base.unlocked, ...(r.unlocked || {}) }, grades: gradeKeys(r.grades) };
}

// 사슬 평가 열쇠: 옛 기록의 「!」 · 「!!」 · 「!!!」를 별로 옮긴다(둘 다 있으면 더한다, CHM-47)
export function gradeKeys(g) {
  const out = {};
  for (const [k, v] of Object.entries(g || {})) { const nk = OLD_GRADE_MARK[k] || k; out[nk] = (out[nk] || 0) + v; }
  return out;
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
    if (e.type === 'brilliant') {
      rec.brilliants = (rec.brilliants || 0) + 1;
      if (!rec.bestBrilliant || e.score > rec.bestBrilliant.score) rec.bestBrilliant = { score: e.score, weight: e.weight, pieces: e.pieces.slice(), ante: run ? run.ante : null };
    }
    if (e.type === 'legend') { rec.legends++; if (!rec.codex.legendsDone[e.legend]) { rec.codex.legendsDone[e.legend] = true; fresh.push(`legendsDone:${e.legend}`); } }
    // 혼 각성(CHM-17): 깨운 혼은 도감 혼 탭의 각성 칸에 남는다
    if (e.type === 'awaken') mark(rec, 'awake', e.soul, fresh);
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
  // 혼: 만난 혼(진열 두루마리 · 혼 깃든 진열 기물 · 가진 두루마리 · 주머니)
  for (const p of run.deck) mark(rec, 'souls', p.soul, fresh);
  for (const c of run.consumables || []) if (c.kind === 'soul') mark(rec, 'souls', c.id, fresh);
  if (run.shop) for (const it of run.shop.display) mark(rec, 'souls', it.kind === 'soul' ? it.id : it.kind === 'piece' ? it.soul : null, fresh);
  if (run.pack) for (const o of run.pack.options) { if (o.kind === 'maxim') { mark(rec, 'maxims', o.id, fresh); if (o.edition) mark(rec, 'editions', o.edition, fresh); } }
  if (run.battle) for (const s of run.battle.mods) {
    if (s.kind === 'master' || MASTER_IDS.has(s.id)) mark(rec, 'masters', s.id, fresh);
    // 세력: 그 세력과 대국을 두면 도감 세력 탭이 채워진다
    if (typeof s.id === 'string' && s.id.startsWith('faction:')) mark(rec, 'factions', s.id.slice(8), fresh);
  }
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

// 끝없는 대국이 끝났을 때(이긴 판은 이미 세었다): 닿은 관만 남긴다
export function finishEndless(rec, run) {
  if (!run.endless) return false;
  const deeper = run.ante > (rec.bestEndless || 0);
  rec.bestEndless = Math.max(rec.bestEndless || 0, run.ante);
  return deeper;
}

// 다음 해금 하나(결과 화면 · 판 준비 화면에 보인다)
export function nextUnlock(rec) {
  const u = UNLOCKS.find((x) => !rec.unlocked.openings.includes(x.id));
  if (!u) return null;
  return { id: u.id, text: u.text, have: Math.min(u.have(rec), u.need), need: u.need };
}

// 오늘의 대국 시드(날짜 → 시드)는 src/sim/daily.js — 서버도 같은 것을 쓴다(CHM-70)
export { dailySeed } from '../sim/daily.js';
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
