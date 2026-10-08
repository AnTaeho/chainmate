// 클라우드 저장(CHM-71, docs/design-notes/leaderboard.md 「기기 잇기 · 클라우드 저장」): 기록 · 진행 중인 판 · 설정 몇 칸을 서버의 한 덩이와 맞춘다.
// 서버와 주고받는 것은 src/ui/rank.js가 한다(열쇠는 거기서 나오지 않는다). 순위와 같은 조건에서만 돈다(배포 주소 · 앱, webdriver 아님) — 그 밖에서는 0건, 저장에도 안 쓴다.
// 맞추는 때: 켤 때 당겨 합치고 달라졌으면 올린다 · 판이 끝날 때 · 상점을 떠날 때 · 관 선택에 설 때 올린다(15초에 한 번까지) · 화면이 가려질 때 한 번.
// 실패하면 조용히 넘어가고 다음 때 다시 한다. 화면에는 아무것도 띄우지 않는다.
import { KEYS } from './save.js';
import { setLang } from './lang.js';
import { mergeInto, cloudRecords, mergeGain } from './merge.js';
import { saveSyncProps } from './telemetry.js';

export const CLOUD_KEY = 'chainmate.cloud.v1'; // { rev, runAt(판이 끝난 때), setAt, snap, at(마지막으로 맞춘 때), sum }
export const PUSH_GAP = 15000;                 // 올리기 사이 최소 간격
export const KEEPALIVE_MAX = 60000;            // 화면이 가려질 때 올리기(keepalive)는 64KiB까지만 나간다
export const BLOB_MAX = 190000;                // 서버 본문 한도(200KB)에 못 미치게
// 옮기는 설정: 게임 쪽 취향만. 소리 · 연출 속도 · 흔들림 · 큰 글자 · 움직임 줄이기(기기 취향)와 기록 보내기(동의)는 기기마다 둔다
export const SYNC_SETTINGS = { lang: (v) => v === 'ko' || v === 'en', coach: (v) => typeof v === 'boolean', replay: (v) => typeof v === 'boolean' };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const bytes = (s) => { let n = s.length; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 0x7f) n += c > 0x7ff ? 2 : 1; } return n; };

export function createCloud({ rank, now = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) } = {}) {
  const on = !!rank && !!rank.allowed;
  const stats = { pulled: 0, pushed: 0, conflict: 0, skipped: 0 };
  const cloud = { on, stats, now };
  let app = null, state = null, timer = null, dirty = false, busy = null, sent = null, lastPush = -Infinity, parked = null;

  const st = () => (state ||= { rev: 0, runAt: 0, setAt: 0, snap: null, at: 0, sum: null, ...(app.store.get(CLOUD_KEY, null) || {}) });
  const keep = () => { if (on) app.store.set(CLOUD_KEY, st()); };
  const pick = () => Object.fromEntries(Object.keys(SYNC_SETTINGS).filter((k) => app.settings[k] !== undefined).map((k) => [k, app.settings[k]]));
  const playing = () => !!app.run && !app.run.scratch && app.run.phase !== 'won' && app.run.phase !== 'lost';
  const localRunAt = () => { const r = app.store.get(KEYS.run, null); return r ? r.updatedAt || 0 : st().runAt || 0; };
  // 하루 한 번 요약(기록 보내기 save_sync): 날이 바뀌면 지난 날의 수를 보낸다
  const count = (k) => {
    stats[k]++;
    const day = app.today(), s = st();
    if (!s.sum || s.sum.date !== day) { tell(); s.sum = { date: day, pulled: 0, pushed: 0, conflict: 0 }; }
    s.sum[k]++;
  };
  function tell() {
    const p = saveSyncProps(st().sum);
    if (p) app.track('save_sync', p, { always: true });
    st().sum = null;
  }

  cloud.attach = (a) => { app = a; };
  // 이 기기의 덩이
  function blob() {
    const run = app.store.get(KEYS.run, null), s = st();
    return { v: 1, records: cloudRecords(app.records), run, runAt: run ? run.updatedAt || 0 : s.runAt || 0, settings: pick(), setAt: s.setAt || 0 };
  }
  // 받은 판이 더 늦으면 이 기기의 판을 갈아 끼운다. 지금 판을 두는 중이면 덮지 않고 두었다가 첫 화면으로 돌아올 때 다시 견준다
  function takeRun(run, runAt) {
    if (!(runAt > localRunAt())) return false;
    if (playing()) { parked = { run, runAt }; return false; }
    if (run) app.store.set(KEYS.run, run); else app.store.del(KEYS.run);
    st().runAt = runAt;
    return true;
  }
  cloud.settle = () => { const p = parked; parked = null; if (on && p && takeRun(p.run, p.runAt)) keep(); };
  // 받은 덩이를 이 기기에 합친다: 기록은 합치고(merge.js) · 판과 설정은 늦은 쪽
  function apply(remote) {
    if (!isObj(remote)) return;
    const merged = mergeInto(app.records, remote.records);
    if (JSON.stringify(merged) !== JSON.stringify(app.records)) {
      for (const k of Object.keys(app.records)) delete app.records[k];
      Object.assign(app.records, merged);
      app.store.set(KEYS.records, app.records);
    }
    const s = st();
    if (isObj(remote.settings) && (remote.setAt || 0) > (s.setAt || 0)) {
      for (const [k, ok] of Object.entries(SYNC_SETTINGS)) if (ok(remote.settings[k])) app.settings[k] = remote.settings[k];
      setLang(app.settings.lang);
      app.store.set(KEYS.settings, app.settings);
      s.setAt = remote.setAt; s.snap = JSON.stringify(pick());
    }
    if (remote.run === null || isObj(remote.run)) takeRun(remote.run, remote.runAt || 0);
  }

  // 당겨 와 합친다. 돌려주는 것: { ok, gain(합쳐서 늘어난 것) } — 서버에 저장이 없어도 ok
  cloud.pull = async () => {
    if (!on) return { ok: false };
    const r = await rank.saveGet();
    if (r.status !== 200) { if (r.status === 401) { st().rev = 0; sent = null; keep(); } return { ok: false }; }
    const before = JSON.parse(JSON.stringify(app.records)), s = st();
    if (r.rev > 0) apply(r.blob);
    s.rev = r.rev; s.at = now();
    count('pulled');
    // 서버 것이 합친 것과 같으면 다시 올리지 않는다
    sent = r.rev > 0 && JSON.stringify(r.blob) === JSON.stringify(blob()) ? JSON.stringify(blob()) : null;
    keep();
    return { ok: true, gain: mergeGain(before, app.records) };
  };

  // 올린다(달라진 것이 있을 때만). 409면 서버 것을 합쳐 한 번 더
  async function send({ keepalive = false, make = true } = {}) {
    for (let turn = 0; turn < 2; turn++) {
      let b = blob(), text = JSON.stringify(b), n = bytes(text);
      // 너무 크면 사람 판 기록용 세기(run.track)부터 뺀다. 그래도 크면 이번에는 올리지 않는다
      if (n > BLOB_MAX && b.run && b.run.track) { b = { ...b, run: { ...b.run, track: undefined } }; text = JSON.stringify(b); n = bytes(text); }
      if (n > BLOB_MAX) { stats.skipped++; return false; }
      const s = st();
      if (text === sent && s.rev > 0) { dirty = false; return true; }
      dirty = false;
      lastPush = now();
      const r = await rank.savePut(s.rev, b, { keepalive: keepalive && n <= KEEPALIVE_MAX, make });
      if (r.status === 200 && Number.isInteger(r.rev)) { s.rev = r.rev; s.at = now(); sent = text; count('pushed'); keep(); return true; }
      if (r.status === 401) { s.rev = 0; sent = null; keep(); }
      if (r.status !== 409) { dirty = true; return false; }
      count('conflict');
      apply(r.blob);
      s.rev = Number.isInteger(r.rev) ? r.rev : 0;
      keep();
    }
    dirty = true;
    return false;
  }
  cloud.push = (opts) => {
    if (!on || !app) return Promise.resolve(false);
    if (busy) { dirty = true; return busy; }
    busy = send(opts).catch(() => false).finally(() => { busy = null; });
    return busy;
  };
  // 달라졌다고만 적어 둔다(기록 · 설정을 저장할 때)
  cloud.mark = () => { if (on) dirty = true; };
  // 맞추는 때(판이 끝남 · 상점을 떠남 · 관 선택에 섬): 15초에 한 번까지 묶어 올린다. 여기서 처음으로 열쇠가 생긴다
  cloud.touch = () => {
    if (!on || !app) return;
    dirty = true;
    if (timer != null) return;
    const wait = Math.max(0, lastPush + PUSH_GAP - now());
    timer = setTimer(() => { timer = null; if (dirty) cloud.push(); }, wait);
  };
  // 화면이 가려질 때: 달라진 것이 있으면 한 번 올린다(열쇠가 없으면 만들지 않는다)
  cloud.hidden = () => {
    if (!on || !app || !dirty || !rank.hasKey()) return Promise.resolve(false);
    if (timer != null) { clearTimer(timer); timer = null; }
    return cloud.push({ keepalive: true, make: false });
  };
  // 켤 때: 열쇠가 있으면 당겨 와 합치고, 달라졌으면 올린다
  cloud.open = async () => {
    if (!on || !app) return false;
    const s = st();
    if (s.sum && s.sum.date !== app.today()) { tell(); keep(); }
    if (!rank.hasKey()) return false;
    const r = await cloud.pull();
    if (!r.ok) return false;
    await cloud.push({ make: false });
    return true;
  };
  // 코드로 이은 뒤 · 이쪽 코드가 쓰인 뒤: 당겨 합치고 곧바로 올린다. 돌려주는 것: pull의 답
  cloud.join = async () => {
    const r = await cloud.pull();
    if (r.ok) await cloud.push();
    return r;
  };
  // 이 기기를 뗀 뒤: 서버에서 새 저장(rev 1)이 됐다 — 다음에 올릴 때 409로 맞춰진다
  cloud.reset = () => { if (!on) return; st().rev = 0; sent = null; dirty = true; keep(); };

  // ── app이 알려 주는 것
  // 끝난 판의 저장을 지운 때(다른 기기의 늦지 않은 판이 되살아나지 않게)
  cloud.noteRunEnd = () => { if (!on || !app) return; st().runAt = now(); dirty = true; keep(); };
  // 옮기는 설정이 바뀐 때를 적는다(처음에는 지금 값을 기준으로만 둔다)
  cloud.noteSettings = () => {
    if (!on || !app) return;
    const s = st(), snap = JSON.stringify(pick());
    if (s.snap === snap) return;
    if (s.snap != null) { s.setAt = now(); dirty = true; }
    s.snap = snap;
    keep();
  };
  // 화면이 읽는 것: 마지막으로 맞춘 때(ms, 없으면 0)
  cloud.status = () => (on && app ? { at: st().at || 0, rev: st().rev || 0 } : { at: 0, rev: 0 });
  return cloud;
}
