// 업적 판정(src/data/achievements.js): 명령 하나가 끝날 때 사건에서 기록 칸(feats · mastersBeaten · synergyTop)을 채우고,
// 기록으로 새로 닿은 업적을 records.achv에 적어 돌려준다. 순수 함수라 Node에서도 돈다(규칙 코드는 업적을 모른다).
import { ACHIEVEMENTS } from '../data/achievements.js';
import { familyCounts } from '../data/families.js';

const up = (o, k, v) => { if (v > (o[k] || 0)) o[k] = v; };

// 한 콤보에서 거친 모습: 놓은 기물 + 먹을 때마다의 모습 + 마지막에 바뀐 모습(chainSummary — 사슬 상태가 없을 때)
export function formsOf(h) {
  const s = new Set([h.piece, ...(h.took || '')]);
  const caps = h.caps || '';
  const last = caps[caps.length - 1];
  if (last && last !== 'K' && last !== 'J') s.add(last);
  s.delete(undefined);
  return s.size;
}

// 사건에서 기록 칸을 채운다. battle · chain: 명령 앞의 대국 · 사슬(이긴 대국은 명령 뒤 run.battle이 비어 앞에서 잡아 둔다)
export function noteFeats(rec, run, events, battle = null, chain = null) {
  const F = rec.feats || (rec.feats = {});
  for (const e of events) {
    if (e.type === 'cutIgnored') F.unbroken = (F.unbroken || 0) + 1;
    else if (e.type === 'overflow') up(F, 'overflow', e.tier || 0);
    else if (e.type === 'chest') up(F, 'chest', e.count || 0);
    else if (e.type === 'win' && e.reason === 'gomoku') F.gomoku = (F.gomoku || 0) + 1;
    else if (e.type === 'end') {
      up(F, 'score', e.score || 0);
      const h = battle && battle.history ? battle.history[battle.history.length - 1] : null;
      if (!h || h.score !== e.score) continue;
      const took = h.took || '';
      up(F, 'forms', chain && chain.done && Array.isArray(chain.forms) ? chain.forms.length : formsOf(h));
      up(F, 'promos', h.promotions || 0);
      up(F, 'replies', h.forced || 0);
      if (took.includes('K')) F.kingTook = (F.kingTook || 0) + 1;
      if (took.length && /^P+$/.test(took)) up(F, 'pawnRun', took.length);
      if (h.reason === 'mate' && h.move === 0) F.firstMate = (F.firstMate || 0) + 1;
    }
    // 마스터전 승리: 판(런)이 같은 명령 안에서 run.last에 대국 줄을 적는다
    if (e.type === 'win' && run && run.last && run.last.won && run.last.kind === 'master' && run.last.master) {
      (rec.mastersBeaten || (rec.mastersBeaten = {}))[run.last.master] = true;
    }
  }
  // 시너지: 지금 짜임의 시너지 수(가장 많이 모은 것을 남긴다)
  if (run && run.deck) {
    const top = rec.synergyTop || (rec.synergyTop = {});
    for (const [id, n] of Object.entries(familyCounts(run))) if (n > 0) up(top, id, n);
  }
  return rec;
}

// 지금 값 · 닿을 값(화면의 「N/M」)
export const achvHave = (a, rec) => Math.min(a.need, Math.max(0, Number(a.have(rec)) || 0));
export const achvDone = (rec, id) => !!(rec.achv && rec.achv[id]);

// 기록으로 새로 닿은 업적을 적고 그 id들을 돌려준다(이미 받은 것은 다시 주지 않는다)
export function checkAchievements(rec) {
  const got = rec.achv || (rec.achv = {});
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    if ((Number(a.have(rec)) || 0) >= a.need) { got[a.id] = true; out.push(a.id); }
  }
  return out;
}
