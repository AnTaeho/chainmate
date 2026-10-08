// 순위(CHM-70) · 기기 잇기와 클라우드 저장(CHM-71) · 계정(CHM-72) 서버 로직: 요청 하나 → { status, body }. HTTP · DB를 모른다(저장소 · 시계 · 무작위를 받아 쓴다) — 시험은 가짜를 넘긴다.
// 오류는 { error: 코드 }뿐. API · 한도 표는 docs/design-notes/leaderboard.md.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { randomName } from '../../src/data/names.js';
import { verifyDaily, VerifyError, isDate, LIMITS as VERIFY_LIMITS } from './verify.js';
import { SCRYPT, cleanUsername, passwordOk, hashPassword, verifyPassword, usernameId } from './auth.js';

export const LIMITS = {
  body: 256 * 1024,        // 요청 본문(바이트)
  cmds: VERIFY_LIMITS.cmds, // 명령 수
  submits: 30,             // 플레이어당 하루 제출
  rerolls: 20,             // 플레이어당 하루 다시 짓기
  page: 10,                // 순위표 한 쪽
  around: 2,               // 내 위아래 줄
  dateSpan: 1,             // 제출 날짜: 서버 날짜(UTC) ± 며칠(시간대가 달라도 그 사람의 「오늘」이 들어온다)
  // 기기 잇기 · 클라우드 저장(CHM-71)
  codeTtl: 10 * 60 * 1000, // 옮기기 코드가 사는 시간
  codes: 10,               // 플레이어당 하루 코드 받기
  redeemFails: 10,         // 넣는 쪽 열쇠당 한 시간에 틀릴 수 있는 수
  lockFails: 500,          // 모두 합쳐 10분에 이만큼 틀리면 그 10분 동안 코드 넣기를 잠근다
  lockSpan: 10 * 60 * 1000,
  save: 200 * 1024,        // 저장 올리기 본문(바이트)
  saves: 500,              // 플레이어당 하루 저장 올리기
  saveDepth: 40,           // 저장 덩이의 가장 깊은 겹
  // 계정(CHM-72)
  account: 4 * 1024,       // 계정 길의 본문(바이트)
  loginFails: 5,           // 아이디당 15분에 틀릴 수 있는 수 — 닿으면 15분 잠근다
  loginSpan: 15 * 60 * 1000,
  loginLock: 15 * 60 * 1000,
  keyLoginFails: 20,       // 열쇠(플레이어)당 한 시간에 틀릴 수 있는 수
  loginAllFails: 1000,     // 모두 합쳐 10분에 이만큼 틀리면 그 10분 동안 들어오기를 잠근다
  loginAllSpan: 10 * 60 * 1000,
  signups: 3,              // 열쇠(플레이어)당 하루 계정 만들기
  signupAll: 500,          // 모두 합쳐 한 시간 계정 만들기(이미 있는 아이디를 물은 것도 센다)
  pwResets: 3,             // 지금 비번 없이 새 비번 정하기: 플레이어당 하루
};

const DAY = 86400000;
export const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const hashKey = (key) => createHash('sha256').update(key).digest('hex');
const isKey = (k) => typeof k === 'string' && /^[0-9a-f]{64}$/.test(k);
const err = (status, error, more = {}) => ({ status, body: { error, ...more } });
const ok = (body) => ({ status: 200, body });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const hashCode = (code) => createHash('sha256').update(`link:${code}`).digest('hex');
// 저장 덩이의 꼴: 최상위 열쇠 · 타입 · 깊이만 본다(크기는 본문 한도). 내용은 믿지도 읽지도 않는다 — 그 사람 자신의 저장이다
const BLOB_KEYS = ['v', 'records', 'run', 'runAt', 'settings', 'setAt'];
const stamp = (v) => v == null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
function deep(v, left) {
  if (!v || typeof v !== 'object') return true;
  if (left <= 0) return false;
  for (const x of Array.isArray(v) ? v : Object.values(v)) if (!deep(x, left - 1)) return false;
  return true;
}
export function blobOk(blob) {
  if (!isObj(blob) || blob.v !== 1 || Object.keys(blob).some((k) => !BLOB_KEYS.includes(k))) return false;
  if (!isObj(blob.records) || !(blob.run === null || isObj(blob.run)) || !stamp(blob.runAt) || !stamp(blob.setAt)) return false;
  if (blob.settings != null && (!isObj(blob.settings) || Object.keys(blob.settings).length > 8 || Object.values(blob.settings).some((v) => v !== null && typeof v === 'object'))) return false;
  return deep(blob, LIMITS.saveDepth);
}
const dayGap = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

// store: api/_lib/store.js createStore 꼴. build: 이 배포의 식별자. now: () => ms. newKey: () => 64자 16진수. rand: () => [0, 1)
// newCode: () => 숫자 여덟 자리 글
// scryptN: 비번 해시의 N(시험은 작은 값을 넘긴다)
export function createService({ store, build = 'dev', now = Date.now, newKey = () => randomBytes(32).toString('hex'), rand = Math.random, newCode = () => String(randomInt(0, 1e8)).padStart(8, '0'), scryptN = SCRYPT.N }) {
  const today = () => utcDate(now());
  const who = async (key) => (isKey(key) ? store.getPlayer(hashKey(key), today()) : null);
  const hourOf = () => new Date(now()).toISOString().slice(0, 13);
  const lockOf = () => `lock:${Math.floor(now() / LIMITS.lockSpan)}`;
  // ── 계정(CHM-72)
  const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const left = (span) => Math.ceil((span - (now() % span)) / 1000); // 이 창이 끝나기까지(초)
  const allOf = () => `login:${Math.floor(now() / LIMITS.loginAllSpan)}`;
  const failOf = () => `fail:${Math.floor(now() / LIMITS.loginSpan)}`;
  // 없는 아이디에도 같은 값의 해시 견줌을 한 번 한다(아이디가 있는지가 걸린 시간으로 새지 않게)
  let dummyP = null;
  const dummy = () => (dummyP ||= hashPassword(randomBytes(24).toString('hex'), { N: scryptN }));
  // 틀린 비번: 열쇠 · 전체 · (아이디) 한도를 센다. 아이디가 한도에 닿으면 잠근다. 답은 늘 같은 401
  const wrong = async (me, uid = null) => {
    await store.bump('loginkey', me.id, hourOf(), LIMITS.keyLoginFails);
    await store.bump('loginall', 0, allOf(), LIMITS.loginAllFails);
    if (uid != null) {
      const n = await store.bump('login', uid, failOf(), LIMITS.loginFails);
      if (n == null || n >= LIMITS.loginFails) await store.setMark('loginlock', uid, 'until', Math.ceil((now() + LIMITS.loginLock) / 60000));
    }
    return err(401, 'bad_login');
  };
  const keyBusy = async (me) => ((await store.peek('loginkey', me.id, hourOf())) >= LIMITS.keyLoginFails ? err(429, 'login_limit', { retryAfter: left(3600000) }) : null);
  // 이 기기를 새 빈 플레이어로: { key(새 열쇠), a, n, rerolls, devices: 1 }
  const blank = async () => {
    const fresh = newKey(), nm = randomName(rand);
    const p = await store.createPlayer(hashKey(fresh), nm.a, nm.n);
    return { key: fresh, a: p.a, n: p.n, rerolls: LIMITS.rerolls, devices: 1 };
  };
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
    // ── 기기 잇기(CHM-71)
    // { key } → { code, expiresAt, ttl }. 새로 받으면 앞의 코드는 무효. DB에는 코드의 해시만
    async linkCode(body) {
      const { key } = body || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      if ((await store.bump('code', p.id, today(), LIMITS.codes)) == null) return err(429, 'code_limit');
      const expiresAt = now() + LIMITS.codeTtl;
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        if (await store.putCode(p.id, hashCode(code), expiresAt)) return ok({ code, expiresAt, ttl: LIMITS.codeTtl });
      }
      return err(503, 'busy');
    },

    // { key, code } → { key(이 기기의 새 열쇠 — 코드를 낸 플레이어의 것), a, n, rerolls, devices }. 넣은 쪽의 옛 플레이어는 성적을 합친 뒤 지운다.
    // 차례: 꼴 → 전체 잠금 → key → 열쇠 한도 → 코드(없음 · 지남 · 자기 것) → 쓰기 → 합치기
    async linkRedeem(body) {
      const { key, code } = body || {};
      if (!isKey(key) || typeof code !== 'string' || !/^\d{8}$/.test(code)) return err(400, 'bad_request');
      if ((await store.peek('lock', 0, lockOf())) >= LIMITS.lockFails) return err(429, 'locked');
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      if ((await store.peek('redeem', me.id, hourOf())) >= LIMITS.redeemFails) return err(429, 'redeem_limit');
      const miss = async (status, error) => {
        await store.bump('redeem', me.id, hourOf(), LIMITS.redeemFails);
        await store.bump('lock', 0, lockOf(), LIMITS.lockFails);
        return err(status, error);
      };
      const hash = hashCode(code), c = await store.findCode(hash);
      if (!c || c.used) return miss(404, 'bad_code');
      if (c.expires <= now()) return miss(410, 'expired');
      if (c.playerId === me.id) return err(400, 'self');
      // 넣는 쪽에 계정이 붙어 있으면 막는다(옛 플레이어를 지우면 계정도 같이 지워진다) — 코드는 계정 쪽 기기에서 받는다
      if (await store.accountOfPlayer(me.id)) return err(409, 'has_account');
      if (!(await store.claimCode(hash, now()))) return miss(404, 'bad_code');
      const fresh = newKey();
      await store.absorb(me.id, c.playerId, hashKey(key), hashKey(fresh));
      const p = await store.getPlayer(hashKey(fresh), today());
      return ok({ key: fresh, a: p.a, n: p.n, rerolls: Math.max(0, LIMITS.rerolls - p.rerolls), devices: await store.keyCount(p.id) });
    },

    // { key } → { devices }(이 플레이어에 이어진 열쇠 수)
    async linkDevices(body) {
      const { key } = body || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      return ok({ devices: await store.keyCount(p.id) });
    },

    // { key } → 이 열쇠만 떼어 새 플레이어로(이름 · 저장 덩이 사본을 들고. 순위 성적은 남은 쪽에 둔다). 혼자인 열쇠는 400 not_linked
    async linkUnlink(body) {
      const { key } = body || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      if ((await store.keyCount(p.id)) < 2) return err(400, 'not_linked');
      // 새 플레이어의 players.key_hash(옛 칸)에는 쓰이지 않을 값을 채운다 — 이 열쇠의 해시는 떠나온 쪽의 옛 칸에 남아 있을 수 있다
      const id = await store.splitKey(hashKey(key), p.id, hashKey(`split:${newKey()}`));
      if (!id) return err(400, 'not_linked');
      return ok({ key, a: p.a, n: p.n, rerolls: LIMITS.rerolls, devices: 1 });
    },

    // ── 클라우드 저장(CHM-71)
    // { key } → { rev, updatedAt, blob } 또는 { rev: 0 }
    async saveGet(query) {
      const { key } = query || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      const s = await store.getSave(p.id);
      if (!s) return ok({ rev: 0 });
      return ok({ rev: s.rev, updatedAt: s.updatedAt, blob: JSON.parse(s.blob) });
    },

    // { key, baseRev, blob } → { rev, updatedAt } 또는 409 { error: 'conflict', rev, updatedAt, blob }(서버 것 — 합쳐서 다시 올린다)
    async savePut(body) {
      const { key, baseRev, blob } = body || {};
      if (!isKey(key) || !Number.isInteger(baseRev) || baseRev < 0) return err(400, 'bad_request');
      if (!blobOk(blob)) return err(400, 'bad_blob');
      const text = JSON.stringify(blob);
      if (Buffer.byteLength(text) > LIMITS.save) return err(413, 'too_large');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      if ((await store.bump('save', p.id, today(), LIMITS.saves)) == null) return err(429, 'save_limit');
      const rev = await store.putSave(p.id, baseRev, text, now());
      if (rev != null) return ok({ rev, updatedAt: now() });
      const s = await store.getSave(p.id);
      return err(409, 'conflict', s ? { rev: s.rev, updatedAt: s.updatedAt, blob: JSON.parse(s.blob) } : { rev: 0 });
    },

    // ── 계정(CHM-72): 플레이어에 붙는 자격 하나(아이디 · 비번 해시). 아이디 · 비번은 답의 오류 글에도 로그에도 싣지 않는다
    // { key } → { username | null, devices }
    async accountGet(query) {
      const { key } = query || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const p = await who(key);
      if (!p) return err(401, 'unknown_key');
      const a = await store.accountOfPlayer(p.id);
      return ok({ username: a ? a.username : null, devices: await store.keyCount(p.id) });
    },

    // { key, username, password } → { username }: 지금 기기의 플레이어에 계정을 붙인다(기록은 그대로).
    // 차례: 꼴 → key → 이미 계정 → 아이디 규칙 → 비번 규칙 → 전체 한도 → 이미 있는 아이디 → 열쇠 한도 → 만들기
    async accountSignup(body) {
      const { key, username, password } = body || {};
      if (!isKey(key) || !text(username, 64) || !text(password, 512)) return err(400, 'bad_request');
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      if (await store.accountOfPlayer(me.id)) return err(409, 'has_account');
      const name = cleanUsername(username);
      if (!name) return err(400, 'bad_username');
      if (!passwordOk(password, name)) return err(400, 'weak_password');
      if ((await store.bump('signupall', 0, hourOf(), LIMITS.signupAll)) == null) return err(429, 'signup_limit', { retryAfter: left(3600000) });
      if (await store.findAccount(name)) return err(409, 'taken');
      if ((await store.bump('signup', me.id, today(), LIMITS.signups)) == null) return err(429, 'signup_limit', { retryAfter: left(DAY) });
      if (!(await store.createAccount(me.id, name, await hashPassword(password, { N: scryptN })))) {
        return err(409, (await store.accountOfPlayer(me.id)) ? 'has_account' : 'taken');
      }
      return ok({ username: name });
    },

    // { key, username, password } → { key(이 기기의 새 열쇠 — 계정의 플레이어에 붙은 것), a, n, rerolls, devices, username }.
    // 기기 잇기의 넣기와 같은 길: 이 기기의 옛 플레이어 성적을 합친 뒤 지운다(화면이 저장 덩이를 당겨 합친다).
    // 차례: 꼴 → 전체 잠금 → key → 열쇠 한도 → 아이디 잠금 → 다른 계정 → 비번 견줌 → 합치기
    async accountLogin(body) {
      const { key, username, password } = body || {};
      if (!isKey(key) || !text(username, 64) || !text(password, 512)) return err(400, 'bad_request');
      if ((await store.peek('loginall', 0, allOf())) >= LIMITS.loginAllFails) return err(429, 'locked', { retryAfter: left(LIMITS.loginAllSpan) });
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      const busy = await keyBusy(me);
      if (busy) return busy;
      const name = cleanUsername(username);
      // 규칙에 안 맞는 아이디도 없는 아이디와 같은 길(같은 한도 · 같은 시간 · 같은 답)로 간다
      const uid = usernameId(name || username.trim().toLowerCase());
      const until = (await store.peek('loginlock', uid, 'until')) * 60000;
      if (until > now()) return err(429, 'locked', { retryAfter: Math.ceil((until - now()) / 1000) });
      const mine = await store.accountOfPlayer(me.id);
      if (mine && mine.username !== name) return err(409, 'other_account');
      const acct = name ? await store.findAccount(name) : null;
      const good = await verifyPassword(password, acct ? acct.hash : await dummy());
      if (!acct || !good) return wrong(me, uid);
      await store.setMark('login', uid, failOf(), 0);
      const done = (p, k) => ok({ key: k, a: p.a, n: p.n, rerolls: Math.max(0, LIMITS.rerolls - p.rerolls), devices: p.devices, username: name });
      // 이미 이 계정의 기기다: 열쇠는 그대로(합칠 것이 없다 — 합치면 계정의 플레이어가 지워진다)
      if (acct.playerId === me.id) return done({ ...me, devices: await store.keyCount(me.id) }, key);
      const fresh = newKey();
      await store.absorb(me.id, acct.playerId, hashKey(key), hashKey(fresh));
      const p = await store.getPlayer(hashKey(fresh), today());
      return done({ ...p, devices: await store.keyCount(p.id) }, fresh);
    },

    // { key } → 이 기기의 열쇠만 떼고 새 빈 플레이어로(기록 사본을 들고 가지 않는다). 계정 쪽 기록은 그대로다
    async accountLogout(body) {
      const { key } = body || {};
      if (!isKey(key)) return err(400, 'bad_request');
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      if (!(await store.accountOfPlayer(me.id))) return err(400, 'no_account');
      // 새 플레이어를 먼저 만든다 — 중간에 끊겨도 옛 열쇠가 살아 있다
      const out = await blank();
      await store.dropKey(hashKey(key), hashKey(`gone:${newKey()}`));
      return ok(out);
    },

    // { key, current?, next } → { ok }. current가 없으면 「들어와 있는 기기에서 새로 정하기」(열쇠가 곧 자격 — 하루 한도)
    async accountPassword(body) {
      const { key, current = null, next } = body || {};
      if (!isKey(key) || !text(next, 512) || (current != null && !text(current, 512))) return err(400, 'bad_request');
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      const mine = await store.accountOfPlayer(me.id);
      if (!mine) return err(400, 'no_account');
      if (current != null) {
        const busy = await keyBusy(me);
        if (busy) return busy;
        if (!(await verifyPassword(current, mine.hash))) return wrong(me);
      }
      if (!passwordOk(next, mine.username)) return err(400, 'weak_password');
      if (current == null && (await store.bump('pwreset', me.id, today(), LIMITS.pwResets)) == null) return err(429, 'reset_limit', { retryAfter: left(DAY) });
      await store.setPassword(me.id, await hashPassword(next, { N: scryptN }), now());
      return ok({ ok: true, reset: current == null });
    },

    // { key, password } → 계정 · 플레이어 · 열쇠 · 순위 성적 · 저장 덩이를 모두 지우고 이 기기는 새 빈 플레이어로
    async accountDelete(body) {
      const { key, password } = body || {};
      if (!isKey(key) || !text(password, 512)) return err(400, 'bad_request');
      const me = await who(key);
      if (!me) return err(401, 'unknown_key');
      const mine = await store.accountOfPlayer(me.id);
      if (!mine) return err(400, 'no_account');
      const busy = await keyBusy(me);
      if (busy) return busy;
      if (!(await verifyPassword(password, mine.hash))) return wrong(me);
      const out = await blank();
      await store.deletePlayer(me.id);
      return ok(out);
    },
  };
}
