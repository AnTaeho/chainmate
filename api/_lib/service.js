// 순위(CHM-70) 서버 로직: 요청 하나 → { status, body }. HTTP · DB를 모른다(저장소 · 시계 · 무작위를 받아 쓴다) — 시험은 가짜를 넘긴다.
// 오류는 { error: 코드 }뿐. API · 한도 표는 docs/design-notes/leaderboard.md.
import { createHash, randomBytes } from 'node:crypto';
import { randomName } from '../../src/data/names.js';
import { verifyDaily, VerifyError, isDate, LIMITS as VERIFY_LIMITS } from './verify.js';

export const LIMITS = {
  body: 256 * 1024,        // 요청 본문(바이트)
  cmds: VERIFY_LIMITS.cmds, // 명령 수
  submits: 30,             // 플레이어당 하루 제출
  rerolls: 20,             // 플레이어당 하루 다시 짓기
  page: 10,                // 순위표 한 쪽
  around: 2,               // 내 위아래 줄
  dateSpan: 1,             // 제출 날짜: 서버 날짜(UTC) ± 며칠(시간대가 달라도 그 사람의 「오늘」이 들어온다)
};

const DAY = 86400000;
export const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const hashKey = (key) => createHash('sha256').update(key).digest('hex');
const isKey = (k) => typeof k === 'string' && /^[0-9a-f]{64}$/.test(k);
const err = (status, error, more = {}) => ({ status, body: { error, ...more } });
const ok = (body) => ({ status: 200, body });
const dayGap = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

// store: api/_lib/store.js createStore 꼴. build: 이 배포의 식별자. now: () => ms. newKey: () => 64자 16진수. rand: () => [0, 1)
export function createService({ store, build = 'dev', now = Date.now, newKey = () => randomBytes(32).toString('hex'), rand = Math.random }) {
  const today = () => utcDate(now());
  return {
    hello: async () => ok({ build }),

    // { key?, reroll? } → { key, a, n, rerolls(오늘 남은 다시 짓기) }. key가 없으면 새 플레이어
    async player(body) {
      const { key, reroll } = body || {};
      if (key != null && !isKey(key)) return err(400, 'bad_request');
      if (reroll != null && typeof reroll !== 'boolean') return err(400, 'bad_request');
      if (key == null) {
        if (reroll) return err(400, 'bad_request');
        const fresh = newKey(), nm = randomName(rand);
        const p = await store.createPlayer(hashKey(fresh), nm.a, nm.n);
        return ok({ key: fresh, a: p.a, n: p.n, rerolls: LIMITS.rerolls });
      }
      const p = await store.getPlayer(hashKey(key), today());
      if (!p) return err(401, 'unknown_key');
      if (!reroll) return ok({ key, a: p.a, n: p.n, rerolls: Math.max(0, LIMITS.rerolls - p.rerolls) });
      const nm = randomName(rand, p);
      const r = await store.reroll(p.id, nm.a, nm.n, today(), LIMITS.rerolls);
      if (!r) return err(429, 'reroll_limit');
      return ok({ key, a: r.a, n: r.n, rerolls: Math.max(0, LIMITS.rerolls - r.rerolls) });
    },

    // { key, date, build, cmds } → { ok, best, rank, total, improved }. 차례: 꼴 → key → build → date → 하루 한도 → 다시 두기 → 갈아 끼우기
    async submit(body) {
      const { key, date, build: theirs, cmds } = body || {};
      if (!isKey(key) || typeof theirs !== 'string' || theirs.length > 100 || !Array.isArray(cmds)) return err(400, 'bad_request');
      if (cmds.length > LIMITS.cmds) return err(413, 'too_many_cmds');
      const p = await store.getPlayer(hashKey(key), today());
      if (!p) return err(401, 'unknown_key');
      if (theirs !== build) return err(409, 'stale', { stale: true, build });
      if (!isDate(date) || Math.abs(dayGap(date, today())) > LIMITS.dateSpan) return err(422, 'bad_date');
      if (!(await store.bumpSubmit(p.id, today(), LIMITS.submits))) return err(429, 'submit_limit');
      let result, used;
      try { ({ used, ...result } = verifyDaily(date, cmds)); } catch (e) {
        if (e instanceof VerifyError) return err(422, e.code, e.at == null ? {} : { at: e.at });
        throw e;
      }
      // 남기는 명령 줄은 다시 둔 만큼만(우승 뒤 끝없는 대국은 뺀다)
      const improved = await store.putScore(p.id, date, result, build, JSON.stringify(cmds.slice(0, used)));
      const st = await store.standing(p.id, date);
      return ok({ ok: true, best: st.best, rank: st.rank, total: st.total, improved });
    },

    // { date?, page?, key? } → { date, total, page, pages, rows, me, around }. key는 없어도 된다(구경). 모르는 key도 구경으로 본다
    async board(query) {
      const { date = today(), page = '1', key = null } = query || {};
      if (!isDate(date) || dayGap(date, today()) > LIMITS.dateSpan) return err(400, 'bad_date');
      if (!/^\d{1,6}$/.test(String(page)) || Number(page) < 1) return err(400, 'bad_request');
      if (key != null && !isKey(key)) return err(400, 'bad_request');
      const p = key ? await store.getPlayer(hashKey(key), today()) : null;
      const pg = Number(page);
      const b = await store.board(date, (pg - 1) * LIMITS.page, LIMITS.page, p ? p.id : null, LIMITS.around);
      return ok({ date, total: b.total, page: pg, pages: Math.max(1, Math.ceil(b.total / LIMITS.page)), rows: b.rows, me: b.me, around: b.around });
    },
  };
}
