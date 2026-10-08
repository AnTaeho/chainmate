// 순위 시험용 기억 저장소: api/_lib/store.js createStore와 같은 꼴(같은 뜻)을 배열로. 줄 세우기는 api/_lib/rank.js.
import { compareRank, better } from '../../api/_lib/rank.js';

export function memStore() {
  const players = [], scores = [], logs = new Map();
  let seq = 0, tick = 0;
  const ranked = (date) => scores.filter((s) => s.date === date)
    .sort((x, y) => compareRank(x, y) || x.at - y.at || x.pid - y.pid).map((s, i) => ({ ...s, rank: i + 1 }));
  return {
    players, scores, logs,
    async createPlayer(keyHash, a, n) { const p = { id: String(++seq), keyHash, a, n, rd: null, rn: 0, sd: null, sn: 0 }; players.push(p); return { id: p.id, a, n }; },
    async getPlayer(keyHash, today) { const p = players.find((x) => x.keyHash === keyHash); return p ? { id: p.id, a: p.a, n: p.n, rerolls: p.rd === today ? p.rn : 0 } : null; },
    async reroll(id, a, n, today, limit) {
      const p = players.find((x) => x.id === id);
      if (p.rd === today && p.rn >= limit) return null;
      p.rn = p.rd === today ? p.rn + 1 : 1; p.rd = today; p.a = a; p.n = n;
      return { a, n, rerolls: p.rn };
    },
    async bumpSubmit(id, today, limit) {
      const p = players.find((x) => x.id === id);
      if (p.sd === today && p.sn >= limit) return false;
      p.sn = p.sd === today ? p.sn + 1 : 1; p.sd = today;
      return true;
    },
    async putScore(id, date, r, build, cmdsText) {
      const i = scores.findIndex((s) => s.pid === Number(id) && s.date === date);
      if (i >= 0 && !better(r, scores[i])) return false;
      const s = { pid: Number(id), date, ...r, build, at: ++tick };
      if (i >= 0) scores[i] = s; else scores.push(s);
      logs.set(`${id}:${date}`, cmdsText);
      return true;
    },
    async standing(id, date) {
      const all = ranked(date), me = all.find((s) => s.pid === Number(id));
      if (!me) return { best: null, rank: null, total: all.length };
      return { best: { ante: me.ante, blind: me.blind, won: me.won, score: me.score_total, battles: me.battles, moves: me.moves, ignite: me.ignite }, rank: me.rank, total: all.length };
    },
    async board(date, offset, size, id = null, span = 2) {
      const all = ranked(date).map((s) => ({ ...s, pid: String(s.pid) }));
      const me = id == null ? null : all.find((s) => s.pid === id);
      const rowOf = (s) => { const p = players.find((x) => x.id === s.pid); return { rank: s.rank, a: p.a, n: p.n, ante: s.ante, blind: s.blind, won: s.won, score: s.score_total }; };
      return {
        total: all.length, rows: all.slice(offset, offset + size).map(rowOf),
        me: me ? rowOf(me) : null,
        around: me ? all.filter((s) => Math.abs(s.rank - me.rank) <= span).map(rowOf) : [],
      };
    },
  };
}
