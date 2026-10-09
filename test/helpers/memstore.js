// 순위 시험용 기억 저장소: api/_lib/store.js createStore와 같은 꼴(같은 뜻)을 배열로. 줄 세우기는 api/_lib/rank.js.
import { compareRank, better } from '../../api/_lib/rank.js';

export function memStore() {
  const players = [], scores = [], logs = new Map();
  const keys = new Map(), codes = new Map(), limits = new Map(), saves = new Map(); // CHM-71
  const accounts = new Map(); // CHM-72: username → { playerId, username, hash }
  let seq = 0, tick = 0;
  const ranked = (date) => scores.filter((s) => s.date === date)
    .sort((x, y) => compareRank(x, y) || x.at - y.at || x.pid - y.pid).map((s, i) => ({ ...s, rank: i + 1 }));
  return {
    players, scores, logs, keys, codes, limits, saves, accounts,
    async createPlayer(keyHash, a, n) { const p = { id: String(++seq), a, n, rd: null, rn: 0, sd: null, sn: 0 }; players.push(p); keys.set(keyHash, p.id); return { id: p.id, a, n }; },
    async getPlayer(keyHash, today) {
      if (!keys.has(keyHash)) return null;
      const p = players.find((x) => x.id === keys.get(keyHash));
      return p ? { id: p.id, a: p.a, n: p.n, rerolls: p.rd === today ? p.rn : 0 } : null;
    },
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
    // ── 기기 잇기 · 클라우드 저장(CHM-71)
    async keyCount(id) { return [...keys.values()].filter((v) => v === id).length; },
    async bump(kind, who, bucket, limit) { const k = `${kind}:${who}:${bucket}`, n = limits.get(k) || 0; if (n >= limit) return null; limits.set(k, n + 1); return n + 1; },
    async peek(kind, who, bucket) { return limits.get(`${kind}:${who}:${bucket}`) || 0; },
    async putCode(id, codeHash, expires) {
      for (const [h, c] of codes) if (c.playerId === id) codes.delete(h);
      if (codes.has(codeHash)) return false;
      codes.set(codeHash, { playerId: id, expires, used: false });
      return true;
    },
    async findCode(codeHash) { const c = codes.get(codeHash); return c ? { ...c } : null; },
    async claimCode(codeHash, now) { const c = codes.get(codeHash); if (!c || c.used || c.expires <= now) return false; c.used = true; return true; },
    async absorb(from, to, oldKeyHash, newKeyHash) {
      for (const s of scores.filter((x) => x.pid === Number(from))) {
        const i = scores.findIndex((x) => x.pid === Number(to) && x.date === s.date);
        if (i >= 0 && !better(s, scores[i])) continue;
        const moved = { ...s, pid: Number(to) }; // 낸 차례(at)는 그대로
        if (i >= 0) scores[i] = moved; else scores.push(moved);
        if (logs.has(`${from}:${s.date}`)) logs.set(`${to}:${s.date}`, logs.get(`${from}:${s.date}`));
      }
      keys.set(newKeyHash, to);
      for (const [h, v] of keys) if (v === from && h !== oldKeyHash) keys.set(h, to);
      // 플레이어를 지우면 딸린 것도 지워진다(cascade)
      for (let i = scores.length - 1; i >= 0; i--) if (scores[i].pid === Number(from)) scores.splice(i, 1);
      for (const k of [...logs.keys()]) if (k.startsWith(`${from}:`)) logs.delete(k);
      for (const [h, v] of keys) if (v === from) keys.delete(h);
      for (const [h, c] of codes) if (c.playerId === from) codes.delete(h);
      saves.delete(from);
      for (const [u, a] of accounts) if (a.playerId === from) accounts.delete(u);
      players.splice(players.findIndex((x) => x.id === from), 1);
    },
    async splitKey(keyHash, id) {
      const old = players.find((x) => x.id === id);
      if (!old || keys.get(keyHash) !== id) return null;
      const p = { id: String(++seq), a: old.a, n: old.n, rd: null, rn: 0, sd: null, sn: 0 };
      players.push(p);
      if (saves.has(id)) saves.set(p.id, { ...saves.get(id), rev: 1 });
      keys.set(keyHash, p.id);
      return p.id;
    },
    async getSave(id) { const s = saves.get(id); return s ? { ...s } : null; },
    async putSave(id, baseRev, blobText, now) {
      const s = saves.get(id);
      if ((s ? s.rev : 0) !== baseRev) return null;
      saves.set(id, { rev: baseRev + 1, blob: blobText, updatedAt: now });
      return baseRev + 1;
    },
    // ── 계정(CHM-72)
    async findAccount(username) { const a = accounts.get(username); return a ? { ...a } : null; },
    async accountOfPlayer(id) { const a = [...accounts.values()].find((x) => x.playerId === id); return a ? { username: a.username, hash: a.hash } : null; },
    async createAccount(id, username, hash) {
      if (accounts.has(username) || [...accounts.values()].some((x) => x.playerId === id)) return false;
      accounts.set(username, { playerId: id, username, hash, changed: 0 });
      return true;
    },
    async setPassword(id, hash, now) { const a = [...accounts.values()].find((x) => x.playerId === id); if (a) { a.hash = hash; a.changed = now; } },
    async dropKey(keyHash) { keys.delete(keyHash); },
    async deletePlayer(id) {
      for (let i = scores.length - 1; i >= 0; i--) if (scores[i].pid === Number(id)) scores.splice(i, 1);
      for (const k of [...logs.keys()]) if (k.startsWith(`${id}:`)) logs.delete(k);
      for (const [h, v] of keys) if (v === id) keys.delete(h);
      for (const [h, c] of codes) if (c.playerId === id) codes.delete(h);
      for (const [u, a] of accounts) if (a.playerId === id) accounts.delete(u);
      for (const k of [...limits.keys()]) { const [kind, who] = k.split(':'); if (who === id && kind !== 'login' && kind !== 'loginlock') limits.delete(k); }
      saves.delete(id);
      const i = players.findIndex((x) => x.id === id);
      if (i >= 0) players.splice(i, 1);
    },
    async setMark(kind, who, bucket, n) { limits.set(`${kind}:${who}:${bucket}`, n); },
  };
}
