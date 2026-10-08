// 순위(CHM-70, docs/design-notes/leaderboard.md 「화면」): 오늘의 대국 순위 서버(/api)와 주고받는 쪽. DOM을 모른다 —
// fetch · storage · 달력을 받아 쓴다(시험 · 연기 시험은 가짜를 넘긴다). 화면은 여기의 「지금 아는 것」(status · board · player)만 읽는다.
// 부르는 조건: 호스트가 RANK_HOSTS이거나 앱(Tauri)이고 navigator.webdriver가 아닐 때. 그 밖(로컬 서버 · 미리 보기 배포 · 자동화 브라우저)에서는
// /api를 한 번도 부르지 않고 저장에도 아무것도 쓰지 않는다 — 화면은 「순위에 닿지 못했다」 한 줄. 설정 「기록 보내기」와는 상관없다(순위는 스스로 올리는 것).
// base: 도구 전용(연기 시험 · 스크린샷 · 실제 서버 확인)이 주소 머리를 직접 준다 — 주면 호스트 · webdriver 조건을 보지 않는다.
import { RANK_HOSTS, RANK_APP_BASE } from '../config.js';
import { nameText } from '../data/names.js';

export const PLAYER_KEY = 'chainmate.player.v1'; // { key, a, n } — 열쇠 원문은 이 기기의 저장에만 있다
export const QUEUE_KEY = 'chainmate.rankq.v1';   // { date, cmds } — 못 보낸 판 하나(그날 것만)
export const CACHE_MS = 30000;                   // 같은 쪽은 이만큼 다시 묻지 않는다
export const RETRY_MS = 5000;                    // 닿지 못한 쪽을 다시 묻기까지
export const PAGE = 10;                          // 순위표 한 쪽(api/_lib/service.js LIMITS.page)

const DAY = 86400000;
// 날짜(YYYY-MM-DD)를 n일 옮긴다
export const shiftDate = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// status(date)의 phase: none(낸 것 없음) · pending(확인 중) · ok(올랐다 — rank · total · me · around) · stale(새 배포 — 다시 보내지 않는다) · unreached(닿지 못함)
// board(date, page)의 phase: loading · ok(data) · unreached
export function createRank({
  fetch = null, storage = null, today = localToday, lang = () => 'ko', base = null,
  host = '', platform = 'web', webdriver = false, hosts = RANK_HOSTS, now = () => Date.now(),
} = {}) {
  const allowed = !!fetch && (base != null || (!webdriver && (platform !== 'web' || hosts.includes(host))));
  const root = base != null ? base : platform !== 'web' ? RANK_APP_BASE : '';
  const stats = { requests: 0 };
  let build = null, helloP = null;
  let me = undefined;          // { key, a, n } | null(없음) | undefined(아직 저장을 안 읽음)
  let rerolls = null;          // 오늘 남은 다시 짓기(서버가 알려 준 뒤에만)
  let playerP = null, checked = false;
  let stale = false;
  const subs = new Map();      // date → status
  const pages = new Map();     // `${date}:${page}` → { phase, data, at, p }
  const rank = { allowed, stats, onResult: null };

  // 돌려주는 것: { status(0 = 닿지 못함), body }. key: 열쇠 — Authorization 머리말로만 싣는다(CHM-72 — 주소 · 본문에 싣지 않는다)
  async function call(method, path, body = null, more = null, key = null) {
    stats.requests++;
    let res;
    try {
      const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { Authorization: `Bearer ${key}` } : {}) };
      res = await fetch(root + path, { method, cache: 'no-store', ...(body || key ? { headers } : {}), ...(body ? { body: JSON.stringify(body) } : {}), ...(more || {}) });
    } catch { return { status: 0, body: null }; }
    let j = null;
    try { j = await res.json(); } catch { /* JSON이 아니다(다른 서버가 답했다) */ }
    // 서버 오류 · 우리 API가 아닌 답은 닿지 못한 것으로 본다
    if (!j || typeof j !== 'object' || res.status >= 500) return { status: 0, body: null };
    return { status: res.status, body: j };
  }

  // ── 플레이어 열쇠
  function load() {
    if (me !== undefined) return me;
    me = null;
    try {
      const d = JSON.parse((storage && storage.getItem(PLAYER_KEY)) || 'null');
      if (d && typeof d.key === 'string' && /^[0-9a-f]{64}$/.test(d.key) && Number.isInteger(d.a) && Number.isInteger(d.n)) me = { key: d.key, a: d.a, n: d.n };
    } catch { /* 깨진 저장은 없는 것으로 */ }
    return me;
  }
  function keep(p) {
    me = p ? { key: p.key, a: p.a, n: p.n } : null;
    if (p && typeof p.rerolls === 'number') rerolls = p.rerolls;
    try { if (storage) { if (me) storage.setItem(PLAYER_KEY, JSON.stringify(me)); else storage.removeItem(PLAYER_KEY); } } catch { /* 저장이 막히면 켤 때마다 새 사람 */ }
    return me;
  }
  // 열쇠가 없으면 만들고, 있으면 세션에 한 번 서버에 물어 이름 · 남은 다시 짓기를 맞춘다(모르는 열쇠면 새로 만든다). 못 닿으면 가진 것 그대로(없으면 null)
  function ensurePlayer() {
    if (!allowed) return Promise.resolve(null);
    if (playerP) return playerP;
    const had = load();
    if (had && checked) return Promise.resolve(had);
    playerP = (async () => {
      let r = had ? await call('POST', '/api/player', {}, null, had.key) : null;
      if (r && r.status === 0) return had;
      if (!r || (r.status === 401 && r.body.error === 'unknown_key')) r = await call('POST', '/api/player', {});
      if (r.status !== 200) return had && r.status !== 401 ? had : load();
      checked = true;
      const changed = !had || had.a !== r.body.a || had.n !== r.body.n || had.key !== r.body.key;
      const p = keep(r.body);
      if (changed && had) pages.clear(); // 다른 사람이 됐다(모르는 열쇠) — 앞의 열쇠로 받은 쪽은 버린다
      return p;
    })().finally(() => { playerP = null; });
    return playerP;
  }
  // 화면이 읽는 내 이름(열쇠는 돌려주지 않는다). 저장에 없으면 null
  rank.player = () => { const p = allowed ? load() : null; return p ? { a: p.a, n: p.n, name: nameText(p.a, p.n, lang()), rerolls } : null; };
  rank.nameOf = (row) => nameText(row.a, row.n, lang());
  rank.ensurePlayer = () => ensurePlayer().then(() => rank.player());

  // 다시 짓기: { ok, name } | { ok: false, why: 'limit' | 'unreached' }
  rank.reroll = async () => {
    const p = await ensurePlayer();
    if (!p) return { ok: false, why: 'unreached' };
    let r = await call('POST', '/api/player', { reroll: true }, null, p.key);
    if (r.status === 401) { checked = false; keep(null); const q = await ensurePlayer(); return q ? { ok: true, name: nameText(q.a, q.n, lang()) } : { ok: false, why: 'unreached' }; }
    if (r.status === 429) { rerolls = 0; return { ok: false, why: 'limit' }; }
    if (r.status !== 200) return { ok: false, why: 'unreached' };
    keep(r.body);
    pages.clear();
    for (const st of subs.values()) if (st.phase === 'ok') refresh(st);
    return { ok: true, name: nameText(me.a, me.n, lang()) };
  };

  // ── 배포 식별자
  function hello() {
    if (build) return Promise.resolve(build);
    if (!helloP) helloP = call('GET', '/api/hello').then((r) => { helloP = null; if (r.status === 200 && typeof r.body.build === 'string') build = r.body.build; return build; });
    return helloP;
  }

  // ── 대기열(못 보낸 판 하나)
  const queued = () => { try { const q = JSON.parse((storage && storage.getItem(QUEUE_KEY)) || 'null'); return q && typeof q.date === 'string' && Array.isArray(q.cmds) ? q : null; } catch { return null; } };
  const enqueue = (date, cmds) => { try { if (storage) storage.setItem(QUEUE_KEY, JSON.stringify({ date, cmds })); } catch { /* 저장이 막히면 버린다 */ } };
  const dequeue = (date) => { try { const q = queued(); if (storage && (!q || date == null || q.date === date)) storage.removeItem(QUEUE_KEY); } catch { /* 그대로 */ } };
  let retrying = null;
  // 켤 때 · 순위 화면을 열 때 한 번 더 보낸다. 그날 것이 아니면 버린다
  rank.retry = () => {
    if (!allowed) return Promise.resolve(null);
    if (retrying) return retrying;
    const q = queued();
    if (!q) return Promise.resolve(null);
    if (q.date !== today()) { dequeue(null); return Promise.resolve(null); }
    retrying = rank.submit(q.date, q.cmds).finally(() => { retrying = null; });
    return retrying;
  };
  rank.queued = () => { const q = queued(); return q ? q.date : null; };

  // ── 순위표
  async function fetchBoard(date, page) {
    const p = await ensurePlayer();
    const r = await call('GET', `/api/daily/board?date=${date}&page=${page}`, null, null, p ? p.key : null);
    return r.status === 200 && Array.isArray(r.body.rows) ? r.body : null;
  }
  // 지금 아는 쪽을 돌려주고(없으면 loading), 낡았으면 뒤에서 다시 묻는다. page는 1부터
  rank.board = (date, page = 1) => {
    if (!allowed) return { phase: 'unreached', data: null };
    const k = `${date}:${page}`;
    let e = pages.get(k);
    const t = now();
    if (!e) { e = { phase: 'loading', data: null, at: -Infinity, p: null }; pages.set(k, e); }
    const old = t - e.at >= (e.phase === 'unreached' ? RETRY_MS : CACHE_MS);
    if (!e.p && old) {
      e.p = fetchBoard(date, page).then((data) => {
        e.p = null; e.at = now();
        if (pages.get(k) !== e) return;
        if (data) { e.phase = 'ok'; e.data = data; } else if (!e.data) e.phase = 'unreached';
      });
    }
    return { phase: e.phase, data: e.data };
  };
  // 닿지 못한 쪽을 곧바로 다시 묻게 한다(탭을 다시 누를 때)
  rank.forget = () => { for (const [k, e] of pages) if (e.phase !== 'ok' && !e.p) pages.delete(k); };

  // ── 제출
  const settle = (date, st) => { subs.set(date, st); if (rank.onResult) { try { rank.onResult(date, st); } catch { /* 게임은 모른다 */ } } return st; };
  // 내 둘레(결과 카드의 이웃)를 내 쪽에서 읽는다 — 순위 화면이 곧 쓸 쪽도 함께 데워진다
  async function refresh(st) {
    if (!st.rank) return;
    const data = await fetchBoard(st.date, Math.ceil(st.rank / PAGE));
    if (!data || !data.me) return;
    pages.set(`${st.date}:${data.page}`, { phase: 'ok', data, at: now(), p: null });
    st.rank = data.me.rank; st.total = data.total; st.me = data.me; st.around = data.around;
  }
  // 오늘의 대국 판이 끝났을 때: 명령 줄을 낸다. 돌려주는 것: 그 날의 status
  rank.submit = async (date, cmds) => {
    if (!allowed || !Array.isArray(cmds)) return null;
    if (stale) return settle(date, { date, phase: 'stale' });
    subs.set(date, { date, phase: 'pending' });
    const fail = () => { enqueue(date, cmds); return settle(date, { date, phase: 'unreached' }); };
    const b = await hello();
    if (!b) return fail();
    let p = await ensurePlayer();
    if (!p) return fail();
    let r = await call('POST', '/api/daily/submit', { date, build: b, cmds }, null, p.key);
    if (r.status === 401) { checked = false; keep(null); p = await ensurePlayer(); if (!p) return fail(); r = await call('POST', '/api/daily/submit', { date, build: b, cmds }, null, p.key); }
    if (r.status === 0) return fail();
    dequeue(date);
    // 새로 배포됐다: 규칙이 다를 수 있어 서버가 다시 두지 않는다 — 이 세션에서는 더 보내지 않는다
    if (r.status === 409) { stale = true; return settle(date, { date, phase: 'stale' }); }
    for (const k of [...pages.keys()]) if (k.startsWith(`${date}:`)) pages.delete(k);
    const st = { date, phase: 'ok', sent: r.status === 200, improved: r.status === 200 && !!r.body.improved, rank: r.status === 200 ? r.body.rank : null, total: r.status === 200 ? r.body.total : null, me: null, around: [] };
    // 거절(422 · 429 …)은 조용히 버린다 — 앞서 낸 기록이 있으면 그 등수를 보인다
    if (r.status !== 200) {
      const data = await fetchBoard(date, 1);
      if (!data || !data.me) return settle(date, { date, phase: 'none', sent: false });
      st.rank = data.me.rank; st.total = data.total;
    }
    await refresh(st);
    return settle(date, st);
  };
  rank.status = (date) => (allowed ? subs.get(date) || { date, phase: 'none' } : { date, phase: 'unreached' });
  rank.stale = () => stale;

  // ── 기기 잇기 · 클라우드 저장(CHM-71, leaderboard.md 「기기 잇기 · 클라우드 저장」): 열쇠가 드는 부름은 모두 여기서 한다 — 열쇠는 밖으로 나가지 않는다.
  // 서버가 열쇠를 모르면(401) 열쇠를 버린다(다음에 필요할 때 새로 만든다)
  // 그 사이 열쇠가 바뀌었으면(들어오기 · 나가기) 늦게 온 옛 열쇠의 401은 흘려보낸다
  const lost = (r, used = null) => { if (r.status === 401 && r.body && r.body.error === 'unknown_key' && (!used || (me && me.key === used))) { checked = false; keep(null); pages.clear(); } return r; };
  rank.hasKey = () => allowed && !!load();
  // 이 기기의 코드: { ok, code, ttl } | { ok: false, why: 'limit' | 'unreached' }
  rank.linkCode = async () => {
    for (let i = 0; i < 2; i++) {
      const p = await ensurePlayer();
      if (!p) break;
      const r = lost(await call('POST', '/api/link/code', {}, null, p.key), p.key);
      if (r.status === 401) continue;
      if (r.status === 200 && typeof r.body.code === 'string') return { ok: true, code: r.body.code, ttl: r.body.ttl };
      return { ok: false, why: r.status === 429 ? 'limit' : 'unreached' };
    }
    return { ok: false, why: 'unreached' };
  };
  // 다른 기기의 코드를 넣는다: 받은 새 열쇠로 갈아탄다. { ok, name, devices } | { ok: false, why: 'bad' | 'expired' | 'self' | 'limit' | 'unreached' }
  rank.linkRedeem = async (code) => {
    for (let i = 0; i < 2; i++) {
      const p = await ensurePlayer();
      if (!p) break;
      const r = lost(await call('POST', '/api/link/redeem', { code }, null, p.key), p.key);
      if (r.status === 401) continue;
      if (r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.key || '')) {
        keep(r.body); checked = true; pages.clear(); subs.clear();
        return { ok: true, name: nameText(me.a, me.n, lang()), devices: r.body.devices };
      }
      return { ok: false, why: { 404: 'bad', 410: 'expired', 429: 'limit', 409: 'account' }[r.status] || (r.status === 400 && r.body.error === 'self' ? 'self' : r.status === 400 ? 'bad' : 'unreached') };
    }
    return { ok: false, why: 'unreached' };
  };
  // 이어진 기기 수(열쇠가 없으면 묻지 않는다). 못 닿으면 null
  rank.devices = async () => {
    const p = allowed ? load() : null;
    if (!p) return null;
    const r = lost(await call('POST', '/api/link/devices', {}, null, p.key), p.key);
    return r.status === 200 && Number.isInteger(r.body.devices) ? r.body.devices : null;
  };
  // 이 기기 떼기: 열쇠는 그대로, 서버에서 새 플레이어가 된다. { ok } | { ok: false, why: 'alone' | 'unreached' }
  rank.unlink = async () => {
    const p = allowed ? load() : null;
    if (!p) return { ok: false, why: 'unreached' };
    const r = lost(await call('POST', '/api/link/unlink', {}, null, p.key), p.key);
    if (r.status === 200) { keep({ ...r.body, key: p.key }); pages.clear(); subs.clear(); if (account) account = { username: null, devices: 1 }; return { ok: true }; }
    return { ok: false, why: r.status === 400 ? 'alone' : 'unreached' };
  };
  // 저장 덩이 읽기(열쇠가 없으면 묻지 않는다 — status -1). { status, rev, blob }
  rank.saveGet = async () => {
    const p = allowed ? load() : null;
    if (!p) return { status: -1 };
    const r = lost(await call('GET', '/api/save', null, null, p.key), p.key);
    return r.status === 200 ? { status: 200, rev: r.body.rev || 0, blob: r.body.blob || null } : { status: r.status };
  };
  // 저장 덩이 올리기(열쇠가 없으면 make일 때만 만든다). { status, rev, blob(409일 때 서버 것) }
  rank.savePut = async (baseRev, blob, { keepalive = false, make = true } = {}) => {
    const p = !allowed ? null : make ? await ensurePlayer() : load();
    if (!p) return { status: 0 };
    const r = lost(await call('PUT', '/api/save', { baseRev, blob }, keepalive ? { keepalive: true } : null, p.key), p.key);
    return { status: r.status, rev: r.body ? r.body.rev : null, blob: r.body ? r.body.blob || null : null };
  };

  // ── 계정(CHM-72, leaderboard.md 「계정」): 아이디 · 비번은 본문으로 한 번 나갈 뿐 여기에도 저장에도 남기지 않는다.
  let account = null;          // { username | null, devices } — 서버가 알려 준 뒤에만
  const mins = (r) => Math.max(1, Math.round(((r.body && r.body.retryAfter) || 60) / 60));
  const taken = (r) => { keep(r.body); checked = true; pages.clear(); subs.clear(); };
  // 화면이 읽는 계정(아이디는 본인 화면에만 보인다). 아직 모르면 null
  rank.account = () => (allowed ? account : null);
  // 서버에 묻는다. 열쇠가 없으면 묻지 않고 「계정 없음」. 못 닿으면 null
  rank.accountLoad = async () => {
    const p = allowed ? load() : null;
    if (!allowed) return null;
    if (!p) { account = { username: null, devices: null }; return account; }
    const r = lost(await call('GET', '/api/account', null, null, p.key), p.key);
    if (r.status === 401) { account = { username: null, devices: null }; return account; }
    if (r.status !== 200) return null;
    account = { username: r.body.username || null, devices: r.body.devices };
    return account;
  };
  // 계정 만들기: 지금 기기의 플레이어에 붙인다. { ok, username } | { ok: false, why: 'taken' | 'username' | 'weak' | 'has' | 'limit' | 'unreached' }
  rank.signup = async (username, password) => {
    for (let i = 0; i < 2; i++) {
      const p = await ensurePlayer();
      if (!p) break;
      const r = lost(await call('POST', '/api/account/signup', { username, password }, null, p.key), p.key);
      if (r.status === 401) continue;
      if (r.status === 200) { account = { username: r.body.username, devices: account && account.devices ? account.devices : 1 }; return { ok: true, username: r.body.username }; }
      const e = r.body ? r.body.error : null;
      return { ok: false, why: { taken: 'taken', has_account: 'has', bad_username: 'username', weak_password: 'weak', signup_limit: 'limit', bad_request: 'username' }[e] || 'unreached' };
    }
    return { ok: false, why: 'unreached' };
  };
  // 들어오기: 받은 새 열쇠로 갈아탄다(기기 잇기의 넣기와 같다). { ok, name, devices, username } | { ok: false, why: 'bad' | 'locked'(wait 분) | 'other' | 'unreached' }
  rank.login = async (username, password) => {
    for (let i = 0; i < 2; i++) {
      const p = await ensurePlayer();
      if (!p) break;
      const r = lost(await call('POST', '/api/account/login', { username, password }, null, p.key), p.key);
      const e = r.body ? r.body.error : null;
      if (r.status === 401 && e === 'unknown_key') continue;
      if (r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.key || '')) {
        taken(r);
        account = { username: r.body.username, devices: r.body.devices };
        return { ok: true, name: nameText(me.a, me.n, lang()), devices: r.body.devices, username: r.body.username };
      }
      if (r.status === 429) return { ok: false, why: 'locked', wait: mins(r) };
      return { ok: false, why: r.status === 401 || r.status === 400 ? 'bad' : r.status === 409 ? 'other' : 'unreached' };
    }
    return { ok: false, why: 'unreached' };
  };
  // 나가기: 이 기기는 새 빈 플레이어의 새 열쇠를 받는다. { ok } | { ok: false, why: 'none' | 'unreached' }
  rank.logout = async () => {
    const p = allowed ? load() : null;
    if (!p) return { ok: false, why: 'unreached' };
    const r = lost(await call('POST', '/api/account/logout', {}, null, p.key), p.key);
    if (r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.key || '')) { taken(r); dequeue(null); account = { username: null, devices: 1 }; return { ok: true }; }
    if (r.status === 400 && r.body.error === 'no_account') { account = { username: null, devices: account ? account.devices : null }; return { ok: false, why: 'none' }; }
    return { ok: false, why: 'unreached' };
  };
  // 비번 바꾸기: current가 없으면 「들어와 있는 기기에서 새로 정하기」. { ok, reset } | { ok: false, why: 'bad' | 'weak' | 'limit' | 'unreached' }
  rank.setPassword = async (next, current = null) => {
    const p = allowed ? load() : null;
    if (!p) return { ok: false, why: 'unreached' };
    const r = lost(await call('POST', '/api/account/password', { next, ...(current ? { current } : {}) }, null, p.key), p.key);
    if (r.status === 200) return { ok: true, reset: !current };
    const e = r.body ? r.body.error : null;
    return { ok: false, why: e === 'bad_login' ? 'bad' : e === 'weak_password' || e === 'bad_request' ? 'weak' : r.status === 429 ? 'limit' : 'unreached', ...(r.status === 429 ? { wait: mins(r) } : {}) };
  };
  // 계정 지우기: 서버에서 모두 지우고 이 기기는 새 빈 플레이어. { ok } | { ok: false, why: 'bad' | 'limit' | 'unreached' }
  rank.deleteAccount = async (password) => {
    const p = allowed ? load() : null;
    if (!p) return { ok: false, why: 'unreached' };
    const r = lost(await call('POST', '/api/account/delete', { password }, null, p.key), p.key);
    if (r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.key || '')) { taken(r); dequeue(null); account = { username: null, devices: 1 }; return { ok: true }; }
    const e = r.body ? r.body.error : null;
    return { ok: false, why: e === 'bad_login' || e === 'bad_request' ? 'bad' : r.status === 429 ? 'limit' : 'unreached', ...(r.status === 429 ? { wait: mins(r) } : {}) };
  };

  // 켤 때: 배포 식별자를 받아 두고(실패해도 조용히), 못 보낸 판이 있으면 한 번 더
  rank.open = async () => {
    if (!allowed) return false;
    await hello();
    await rank.retry();
    return !!build;
  };
  return rank;
}
