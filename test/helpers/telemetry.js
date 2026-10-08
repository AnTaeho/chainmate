// 기록 보내기 시험의 가짜 바깥(CHM-63): fetch · sendBeacon · 저장 · 타이머 · 시계를 가짜로 넘겨 나간 요청을 모은다.
import { createTelemetry } from '../../src/ui/telemetry.js';

export const HOST = 'chainmate.papercut.kr';
export const settle = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

// 나간 요청을 적는 가짜 망. net.mode: 'ok' | 'fail'(거절) | 'hang'(답이 안 온다)
export function fakeNet() {
  const net = { mode: 'ok', sent: [] };
  net.fetch = (url, init = {}) => {
    net.sent.push({ via: 'fetch', url, init, body: init.body, events: JSON.parse(init.body).batch });
    if (net.mode === 'hang') return new Promise(() => {});
    if (net.mode === 'fail') return Promise.reject(new Error('net'));
    return Promise.resolve({ ok: true, status: 200 });
  };
  net.beacon = (url, body) => { net.sent.push({ via: 'beacon', url, body, events: JSON.parse(body).batch }); return true; };
  net.events = () => net.sent.flatMap((r) => r.events);
  net.named = (name) => net.events().filter((e) => e.event === name);
  return net;
}

export function fakeStorage() {
  const mem = new Map();
  return { mem, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
}

// 조건이 다 맞는 수집기(배포 주소 · 자동화 아님 · 켬). opts로 하나씩 어긋나게 한다
export function fakeTel(opts = {}) {
  const net = fakeNet(), storage = fakeStorage();
  const clock = { t: Date.UTC(2026, 9, 8, 12, 0, 0) };
  const timers = [];
  const state = { on: true };
  const tel = createTelemetry({
    fetch: net.fetch, beacon: net.beacon, storage, host: HOST, platform: 'web', version: '0.1.0',
    ua: 'Mozilla/5.0 AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    enabled: () => state.on, now: () => clock.t,
    context: () => ({ lang: 'ko', dan: 2, screen_w: 1280, screen_h: 720, scale: 2, screen: 'battle' }),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: (id) => { timers[id - 1] = null; },
    ...opts,
  });
  // 걸린 타이머를 모두 울린다(10초가 지난 셈)
  const ring = () => { const list = timers.splice(0); for (const t of list) if (t) t.fn(); };
  return { tel, net, storage, clock, timers, state, ring };
}

// 가짜 DOM에 배포 주소 · fetch · sendBeacon을 붙인다(main.js boot()가 수집기를 그대로 만든다). 돌려주는 값: 나간 요청을 적는 가짜 망
export function wireDom(dom, { host = HOST, webdriver = false } = {}) {
  const net = fakeNet();
  const w = dom.window;
  w.location = { hostname: host };
  w.fetch = net.fetch;
  w.navigator = { sendBeacon: net.beacon, webdriver, userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' };
  w.setTimeout = () => 0; w.clearTimeout = () => {};
  // 남은 것을 내보낸다(화면이 숨는 것처럼)
  net.flush = () => { dom.emit('pagehide'); return net.events(); };
  return net;
}
