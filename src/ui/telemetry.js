// 기록 보내기(CHM-63, docs/design-notes/telemetry.md): 우리가 고른 사건만 PostHog로 보낸다. 바깥 스크립트 없이 fetch · sendBeacon으로.
// 보내는 조건(아래 모두): 호스트가 TELEMETRY_HOSTS이거나 앱(Tauri) · navigator.webdriver 아님 · 설정 「기록 보내기」 켬. 그 밖은 한 건도 안 나간다.
// 판 사건은 화면이 따로 부르지 않는다: app.cmd가 명령마다 commandEvents(아래 표)로 옮긴다. 수업 · 대본 대국 · scratch 판은 app.js가 거른다.
// DOM을 모른다 — fetch · beacon · storage · 타이머를 받아 쓴다(시험은 가짜를 넘긴다).
import { POSTHOG, TELEMETRY_HOSTS } from '../config.js';

export const TID_KEY = 'chainmate.tid.v1';   // 익명 ID { id, since }. 브라우저 저장을 지우면 새 사람으로 세어진다
// batch 건이 차거나 every ms마다 묶어 보낸다. queue: 못 보낸 채 쌓아 두는 상한. bytes: 사건 하나의 상한. errors: 세션당 오류 건수
export const LIMITS = { batch: 20, every: 10000, queue: 200, bytes: 30000, errors: 5, beacon: 60000 };

const defaultByte = () => {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint8Array(1))[0];
  return Math.floor(Math.random() * 256);
};
const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
const dashed = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
export function uuid4(byte = defaultByte) {
  const b = Array.from({ length: 16 }, () => byte());
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  return dashed(hex(b));
}
// 세션 ID는 UUIDv7(앞 48비트가 시각 ms) — PostHog 세션 표가 읽는 꼴
export function uuid7(ms, byte = defaultByte) {
  const b = Array.from({ length: 16 }, () => byte());
  for (let i = 5, t = Math.floor(ms); i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  return dashed(hex(b));
}
// 브라우저 엔진 어림(UA 글자는 보내지 않는다)
export function engineOf(ua = '') {
  if (/Firefox\//.test(ua)) return 'gecko';
  if (/Chrom(e|ium)\/|Edg\//.test(ua)) return 'chromium';
  if (/AppleWebKit\//.test(ua)) return 'webkit';
  return 'other';
}
const bytesOf = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; } return n; };

// 오류 스택 → PostHog 오류 추적이 읽는 프레임(크로미움 「at f (url:1:2)」 · 웹킷 · 게코 「f@url:1:2」). 호출 차례는 바깥 → 안(맨 끝이 던진 곳)
export function stackFrames(stack = '') {
  const out = [];
  for (const line of String(stack).split('\n')) {
    const m = line.match(/^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?\s*$/) || line.match(/^(.*?)@(.*?):(\d+):(\d+)\s*$/);
    if (!m) continue;
    out.push({ platform: 'web:javascript', function: m[1] || '?', filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: true });
  }
  return out.reverse().slice(-30);
}
const firstStackLine = (stack = '') => String(stack).split('\n').map((l) => l.trim()).find((l) => /:\d+:\d+\)?$/.test(l)) || '';

// opts: fetch · beacon(url, body) · storage(localStorage 꼴) · host(주소창 호스트) · platform('web' | 'desktop' | 'ios') · webdriver ·
//   enabled()(설정) · context()({ lang, dan, screen_w, screen_h, scale, screen }) · version · ua · now · setTimer · clearTimer
//   distinctId · extra: 자가 확인(tools/telemetry-selftest.mjs)이 시험용 ID와 표시를 넣는다
export function createTelemetry({
  fetch = null, beacon = null, storage = null, host = '', platform = 'web', webdriver = false,
  enabled = () => true, context = () => ({}), version = null, ua = '', now = () => Date.now(),
  setTimer = (fn, ms) => { const t = setTimeout(fn, ms); if (t && t.unref) t.unref(); return t; }, clearTimer = (t) => clearTimeout(t),
  config = POSTHOG, hosts = TELEMETRY_HOSTS, byte = defaultByte, distinctId = null, extra = null,
} = {}) {
  const allowed = !!fetch && !webdriver && (platform !== 'web' || hosts.includes(host));
  const live = () => { try { return allowed && enabled() !== false; } catch { return false; } };
  const session = uuid7(now(), byte);
  const engine = engineOf(ua);
  const stats = { queued: 0, sent: 0, dropped: 0, requests: 0 };
  let queue = [];        // 아직 안 보낸 사건
  let held = null;       // 한 번 실패한 묶음(다음 차례에 한 번 더)
  let sending = false, timer = null;
  let who = null;        // { id, since, first }
  const errSeen = new Set();
  let errCount = 0;

  // 익명 ID: 처음 보낼 때 만든다(보내지 않는 곳에서는 저장에 아무것도 쓰지 않는다)
  function identity() {
    if (who) return who;
    const t = now();
    if (distinctId) return (who = { id: distinctId, since: t, first: true });
    try {
      const d = JSON.parse((storage && storage.getItem(TID_KEY)) || 'null');
      if (d && typeof d.id === 'string') return (who = { id: d.id, since: Number(d.since) || t, first: false });
    } catch { /* 새로 만든다 */ }
    who = { id: uuid4(byte), since: t, first: true };
    try { if (storage) storage.setItem(TID_KEY, JSON.stringify({ id: who.id, since: who.since })); } catch { /* 저장이 막히면 켤 때마다 새 사람 */ }
    return who;
  }

  function common() {
    let c = {};
    try { c = context() || {}; } catch { c = {}; }
    return {
      app_version: version, platform, engine,
      lang: c.lang ?? null, dan: c.dan ?? null, screen_w: c.screen_w ?? null, screen_h: c.screen_h ?? null, scale: c.scale ?? null,
      $session_id: session, $lib: 'chainmate',
      // 사람 프로필을 만들지 않고, IP와 그로 어림한 위치를 남기지 않는다
      $process_person_profile: false, $geoip_disable: true, $ip: '0.0.0.0',
      ...(extra || {}),
    };
  }

  const arm = () => { if (timer == null && (queue.length || held)) timer = setTimer(() => { timer = null; flush(); }, LIMITS.every); };
  const disarm = () => { if (timer != null) { clearTimer(timer); timer = null; } };
  const bodyOf = (batch) => JSON.stringify({ api_key: config.key, batch });
  // 본문은 text/plain으로 보낸다(미리 묻는 요청 없이 — posthog-js와 같은 길)
  const post = (body, keepalive = false) => {
    stats.requests++;
    return fetch(`${config.host}/batch/`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, ...(keepalive ? { keepalive: true } : {}) });
  };

  function track(name, props = {}) {
    if (!live()) return false;
    const id = identity().id;
    let ev = { event: name, distinct_id: id, properties: { ...common(), ...props }, timestamp: new Date(now()).toISOString() };
    // 너무 큰 사건: 판 요약의 큰 배열(대국별 줄부터)을 뺀다
    if (bytesOf(JSON.stringify(ev)) > LIMITS.bytes && ev.properties.row) {
      const row = { ...ev.properties.row };
      ev = { ...ev, properties: { ...ev.properties, row, row_trimmed: true } };
      for (const k of ['log', 'buys', 'lostAt']) { delete row[k]; if (bytesOf(JSON.stringify(ev)) <= LIMITS.bytes) break; }
    }
    if (bytesOf(JSON.stringify(ev)) > LIMITS.bytes) { stats.dropped++; return false; }
    queue.push(ev); stats.queued++;
    if (queue.length > LIMITS.queue) { stats.dropped += queue.length - LIMITS.queue; queue = queue.slice(queue.length - LIMITS.queue); }
    if (queue.length >= LIMITS.batch) flush(); else arm();
    return true;
  }

  // 묶어 보내기. 실패한 묶음은 다음 차례에 한 번 더 보내고, 또 안 되면 버린다(게임은 모른다)
  function flush() {
    if (sending || !allowed) return null;
    const batch = held ? held : queue.splice(0, LIMITS.batch);
    const retry = !!held;
    held = null;
    if (!batch.length) return null;
    disarm();
    sending = true;
    const done = (ok) => {
      sending = false;
      if (ok) stats.sent += batch.length;
      else if (!retry) held = batch;
      else stats.dropped += batch.length;
      if (queue.length >= LIMITS.batch) flush(); else arm();
    };
    let p;
    try { p = Promise.resolve(post(bodyOf(batch))).then((r) => done(!!r && r.ok !== false), () => done(false)); } catch { done(false); p = null; }
    return p;
  }

  // 화면이 숨거나 떠날 때: 남은 것을 sendBeacon으로(없으면 keepalive fetch). 돌아오는 답은 기다리지 않는다
  function flushNow() {
    if (!allowed) return 0;
    disarm();
    const all = [...(held || []), ...queue];
    held = null; queue = [];
    let sent = 0;
    for (let i = 0; i < all.length;) {
      // 비콘 하나는 64KB까지라 건수와 크기 둘 다로 자른다
      let n = 1;
      while (i + n < all.length && n < LIMITS.batch && bytesOf(bodyOf(all.slice(i, i + n + 1))) <= LIMITS.beacon) n++;
      const body = bodyOf(all.slice(i, i + n));
      let ok = false;
      try {
        if (beacon) { stats.requests++; ok = beacon(`${config.host}/batch/`, body) !== false; }
        else { Promise.resolve(post(body, true)).catch(() => {}); ok = true; }
      } catch { ok = false; }
      if (ok) { stats.sent += n; sent += n; } else stats.dropped += n;
      i += n;
    }
    return sent;
  }

  // 켤 때 한 번
  function open() {
    if (!live()) return false;
    const w = identity();
    return track('app_open', { first: w.first, days_since_first: Math.max(0, Math.floor((now() - w.since) / 86400000)) });
  }

  // 오류: 같은 메시지 + 첫 스택 줄은 세션당 한 번, 세션당 LIMITS.errors 건까지
  function error(err, props = {}) {
    if (!live()) return false;
    const message = String((err && err.message) || err || 'unknown').slice(0, 500);
    const stack = (err && err.stack) || '';
    const key = `${message}|${firstStackLine(stack)}`;
    if (errSeen.has(key) || errCount >= LIMITS.errors) return false;
    errSeen.add(key); errCount++;
    const type = (err && err.name) || 'Error';
    let screen = null;
    try { screen = (context() || {}).screen ?? null; } catch { screen = null; }
    return track('$exception', {
      $exception_list: [{ type, value: message, mechanism: { handled: false, synthetic: false }, stacktrace: { type: 'raw', frames: stackFrames(stack) } }],
      $exception_type: type, $exception_message: message, $exception_level: 'error',
      screen, ...props,
    });
  }

  // 설정에서 끄는 순간: 마지막으로 한 번 알리고 곧바로 보낸다(그 뒤로는 enabled()가 거짓이라 조용하다)
  function off() {
    if (!live()) return false;
    track('telemetry_off');
    return flush();
  }

  return { track, flush, flushNow, open, error, off, live, stats, session, allowed, get pending() { return queue.length + (held ? held.length : 0); } };
}

// ── 판 사건 표: 명령 하나가 낸 규칙 사건(applyRun의 events)을 보낼 사건으로 옮긴다. 순수 함수(DOM · 저장 없음).
const itemId = (it) => it.id ?? it.form ?? it.t ?? it.legend ?? null;
const shown = (it) => ({ kind: it.kind, id: itemId(it) });

// 명령 바로 앞의 판 모습(commandEvents가 견줄 것)
export function telBefore(run) {
  const s = run.phase === 'shop' ? run.shop : null;
  return {
    phase: run.phase, ante: run.ante, blind: run.blind, logLen: run.log.length,
    scripted: !!(run.battle && run.battle.script),
    draft: run.draft ? [...run.draft.options] : null,
    pack: run.pack ? { kind: run.pack.kind, offered: run.pack.options.map(shown) } : null,
    shop: s ? {
      rerolls: s.rerolls || 0,
      bought: s.display.filter((x) => x.sold).length + (s.packs || []).filter((x) => x.sold).length,
      shown: [...s.display.map(shown), ...(s.packs || []).map((p) => ({ kind: 'pack', id: p.kind }))],
      packs: (s.packs || []).map((p) => ({ kind: p.kind, price: p.price ?? null })),
    } : null,
  };
}

// 규칙 사건 → 보낼 사건. (e, c) → [이름, 속성] | null. c = { run, cmd, before }
export const EVENT_MAP = {
  joseki: (e, c) => ['draft_pick', { ante: c.before.ante, offered: c.before.draft || [], picked: e.id }],
  buy: (e, c) => ['shop_buy', { ante: c.before.ante, kind: e.item.kind, id: itemId(e.item), price: e.item.price ?? null, held: !!e.item.kept }],
  packOpen: (e, c) => {
    if (c.cmd.type !== 'buyPack') return null;
    const pk = c.before.shop && c.before.shop.packs[c.cmd.slot];
    return ['shop_buy', { ante: c.before.ante, kind: 'pack', id: e.kind, price: pk ? pk.price : null, held: false }];
  },
  skip: (e, c) => ['skip_blind', { ante: c.before.ante, blind: c.before.blind, tag: e.tag ? e.tag.kind : null }],
  hold: (e, c) => (e.on && c.run.hold ? ['hold', { ante: c.before.ante, ...shown(c.run.hold.item) }] : null),
  ignite: (e) => ['ignite', { ante: e.ante, by: e.by, captures: e.captures }],
  brilliant: (e, c) => ['brilliant', { ante: c.before.ante, blind: c.before.blind }],
  legend: (e) => ['legend_done', { id: e.legend }],
  awaken: (e) => ['awaken', { soul: e.soul }],
  clockLost: (e) => ['clock_lost', { ante: e.ante, blind: e.blind, clock: e.clock }],
};

const round2 = (x) => Math.round(x * 100) / 100;
// reason: mate · target(목표를 넘김 — 규칙 이름 score) · gomoku(레퍼토리 「오목」) · moves(수가 다함) · stuck(둘 곳이 없음)
export function battleEndProps(b) {
  return {
    ante: b.ante, blind: b.blind, kind: b.kind, won: !!b.won, reason: b.reason === 'score' ? 'target' : b.reason,
    ratio: b.target ? round2(b.score / b.target) : null,
    moves_used: b.moves, first_move_win: !!b.won && b.moves === 1, sacrifices: b.discarded || 0,
  };
}

// 명령 하나가 끝난 뒤: 보낼 사건 [이름, 속성] 차례. 대본 대국 중의 명령은 튜토리얼 사건만 낸다
export function commandEvents(run, cmd, events, before) {
  const out = [];
  const c = { run, cmd, before };
  if (cmd.type === 'unscript') return [['tutorial_skip', {}]];
  if (before.scripted) {
    if (run.log.length > before.logLen) out.push(['tutorial_done', { won: !!run.log[run.log.length - 1].won }]);
    return out;
  }
  for (const e of events) { const m = EVENT_MAP[e.type] && EVENT_MAP[e.type](e, c); if (m) out.push(m); }
  for (let i = before.logLen; i < run.log.length; i++) if (!run.log[i].skipped) out.push(['battle_end', battleEndProps(run.log[i])]);
  if ((cmd.type === 'pick' || cmd.type === 'skipPack') && before.pack) {
    const o = cmd.type === 'pick' ? before.pack.offered[cmd.index] : null;
    out.push(['pack_pick', { ante: before.ante, kind: before.pack.kind, offered: before.pack.offered, ...(o ? { picked: o } : { skipped: true }) }]);
  }
  if (cmd.type === 'leave' && before.shop) {
    // 산 수: 다시 진열하면 팔린 칸이 갈려 진열로는 못 센다 — 판 기록(run.track.buys)의 이 상점 몫으로 센다(꾸러미에서 고른 것은 빼고)
    const buys = run.track && run.track.buys ? run.track.buys.filter((x) => x.a === before.ante && x.b === before.blind && !x.pack).length : before.shop.bought;
    out.push(['shop_leave', { ante: before.ante, money_left: run.money, bought: buys, rerolls: before.shop.rerolls, shown: before.shop.shown }]);
  }
  return out;
}

export function runStartProps(run, { script = false } = {}) {
  return { dan: run.dan || 0, opening: run.opening ?? null, daily: !!run.daily, script: !!script };
}

// 판 끝: runRow 한 줄을 통째로(row) + 대시보드에서 바로 쓸 납작한 속성
const END = { won: 'win', lost: 'lose', quit: 'quit', endless: 'endless' };
export function runEndProps(row) {
  return {
    won: !!row.won, end: END[row.end] || row.end, ante: row.ante, blind: row.blind, dan: row.dan || 0, opening: row.opening ?? null,
    daily: !!row.daily,
    josekis: [...(row.josekis || [])], maxims: [...(row.final || [])], legends: [...(row.legends || [])],
    families_max: Math.max(0, ...Object.values(row.fam || {})),
    skips: (row.log || []).filter((x) => x.skipped).length,
    holds: row.holds ? row.holds.carried || 0 : 0,
    ignite_at: row.ignite ? row.ignite.at : null,
    brilliants: row.brilliants || 0, battles: row.battles || 0, duration_s: row.sec || 0,
    row,
  };
}
