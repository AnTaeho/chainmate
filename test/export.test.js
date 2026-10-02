// 기록 내보내기 길(CHM-54): 손가락 기기는 공유 시트(navigator.share, 파일 하나), 그 밖은 파일로 받기, 안 되면 클립보드.
// iOS 앱(WKWebView)은 <a download>가 아무 일도 하지 않으므로 받았다고 하지 않는다. 앱은 돌려 그리지 않는다.
// 가짜 DOM(tools/fakedom.mjs)에 navigator · File · URL · Blob · body를 붙여 main.js boot()를 그대로 부른다.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { keepRow } from '../src/ui/runlog.js';

let makeFakeDom, boot;
before(async () => {
  ({ makeFakeDom } = await import('../tools/fakedom.mjs'));
  const first = makeFakeDom();
  globalThis.document = first.document; globalThis.window = first.window;
  const { setCanvasFactory } = await import('../src/render/surface.js');
  setCanvasFactory(() => first.document.createElement('canvas'));
  ({ boot } = await import('../src/main.js'));
});

// touch: 손가락 기기((pointer: coarse)) · app: Tauri 앱 · share: navigator.share 흉내(없으면 null) · body: <a download>를 받을 수 있나
function makeDom({ width = 1280, height = 720, dpr = 1, touch = false, app = false, share = null, body = true, clipboard = null } = {}) {
  const dom = makeFakeDom({ width, height, dpr });
  const w = dom.window, d = dom.document;
  w.matchMedia = (q) => ({ matches: touch ? q === '(pointer: coarse)' : q === '(pointer: fine)' });
  const calls = { share: [], canShare: 0, clicked: [] };
  w.navigator = { maxTouchPoints: touch ? 5 : 0 };
  if (share) {
    w.navigator.canShare = (data) => { calls.canShare++; return !!(data && data.files && data.files.every((f) => f instanceof File)); };
    w.navigator.share = (data) => { calls.share.push(data); return share(data); };
  }
  if (clipboard) w.navigator.clipboard = { writeText: clipboard };
  if (app) w.__TAURI_INTERNALS__ = {};
  w.File = File; w.Blob = Blob;
  w.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL() {} };
  w.setTimeout = () => 0; w.clearTimeout = () => {};
  if (body) {
    d.body = { appendChild() {} };
    const make = d.createElement;
    d.createElement = (tag) => (tag === 'a' ? { style: {}, click() { calls.clicked.push(this.download); }, remove() {} } : make(tag));
  }
  w.localStorage.setItem('chainmate.settings.v1', JSON.stringify({ coach: false }));
  return { dom, calls };
}
const tick = (app, n = 2) => { for (let i = 0; i < n; i++) app.frame((app.last || 0) + 16); };
async function open(opts) {
  const { dom, calls } = makeDom(opts);
  const app = await boot({ window: dom.window, document: dom.document });
  tick(app);
  keepRow(app.store, { id: 'a', seed: 1 });
  keepRow(app.store, { id: 'b', seed: 2 });
  app.openOverlay('settings'); tick(app);
  const btn = app.ui.regions.find((r) => r.id === 'set:export');
  assert.ok(btn, '내보내기 단추');
  return { dom, calls, app, btn };
}
const lastMsg = (app) => (app.toasts.at(-1) || {}).msg;

test('손가락 기기 + share: 누른 손가락을 떼는 그 순간(touchend 안) 공유 시트를 연다 — 파일 하나 · 이름 · JSON 형식', async () => {
  let done;
  const { dom, calls, app, btn } = await open({ touch: true, share: () => new Promise((ok) => { done = ok; }) });
  const listeners = dom.screen.listeners;
  const at = dom.clientOf(btn.x + btn.w / 2, btn.y + btn.h / 2);
  const t = { identifier: 0, ...at };
  const ev = { preventDefault() {}, touches: [t], changedTouches: [t] };
  for (const fn of listeners.touchstart) fn(ev);
  assert.equal(calls.share.length, 0);
  for (const fn of listeners.touchend) fn({ ...ev, touches: [] });
  // await 하나 없이 이미 불렸다(사용자 동작 안)
  assert.equal(calls.share.length, 1, 'touchend 안에서 share');
  const { files } = calls.share[0];
  assert.equal(files.length, 1);
  assert.ok(files[0] instanceof File);
  assert.match(files[0].name, /^chainmate-runs-\d{8}-\d{4}\.json$/);
  assert.equal(files[0].type, 'application/json');
  const got = JSON.parse(await files[0].text());
  assert.equal(got.kind, 'chainmate-runs');
  assert.equal(got.runs.length, 2);
  assert.equal(calls.clicked.length, 0, '받기 길로 가지 않는다');
  assert.notEqual(lastMsg(app), '판 2개를 내보냈다', '공유를 마치기 전에 알리지 않는다');
  done();
  await new Promise((ok) => setImmediate(ok));
  assert.equal(lastMsg(app), '판 2개를 내보냈다');
});

test('손가락 기기 + share: 단추가 돌려주는 값은 Promise "share"', async () => {
  const { calls, app, btn } = await open({ touch: true, share: () => Promise.resolve() });
  assert.equal(await btn.onClick(), 'share');
  assert.equal(calls.share.length, 1);
  assert.equal(lastMsg(app), '판 2개를 내보냈다');
});

test('공유를 그만두면(AbortError) 알림 없이 "cancel" — 성공 · 실패 어느 쪽도 말하지 않는다', async () => {
  const abort = () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
  const { calls, app, btn } = await open({ touch: true, share: abort, clipboard: () => Promise.resolve() });
  const before = app.toasts.length;
  assert.equal(await btn.onClick(), 'cancel');
  assert.equal(calls.share.length, 1);
  assert.equal(app.toasts.length, before, '알림 없음');
  assert.equal(calls.clicked.length, 0);
});

test('공유가 다른 까닭으로 실패하면 클립보드로 — 복사도 안 되면 「내보내지 못했다」', async () => {
  const deny = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
  let a = await open({ touch: true, share: deny, clipboard: () => Promise.resolve() });
  assert.equal(await a.btn.onClick(), 'copy');
  assert.equal(lastMsg(a.app), '판 2개를 복사했다');
  a = await open({ touch: true, share: deny });
  assert.equal(await a.btn.onClick(), 'fail');
  assert.equal(lastMsg(a.app), '내보내지 못했다');
});

test('share가 없으면 받기 길: 손가락 웹(옛 브라우저)도 데스크톱 웹도 <a download>', async () => {
  for (const touch of [true, false]) {
    const { calls, app, btn } = await open({ touch });
    assert.equal(btn.onClick(), 'file', `touch ${touch}`);
    assert.equal(calls.clicked.length, 1);
    assert.match(calls.clicked[0], /^chainmate-runs-.*\.json$/);
    assert.equal(lastMsg(app), '판 2개를 내보냈다');
  }
});

test('데스크톱(마우스)은 share가 있어도 받기 길 — 데스크톱 크롬 · 사파리 · 맥 앱', async () => {
  for (const app of [false, true]) {
    const o = await open({ app, share: () => Promise.resolve() });
    assert.equal(o.btn.onClick(), 'file', `app ${app}`);
    assert.equal(o.calls.share.length, 0);
    assert.equal(o.calls.clicked.length, 1);
  }
});

test('손가락 기기의 앱(iOS WKWebView)에 share가 없으면 받았다고 하지 않고 클립보드로', async () => {
  let o = await open({ touch: true, app: true, clipboard: () => Promise.resolve() });
  assert.equal(await o.btn.onClick(), 'copy');
  assert.equal(o.calls.clicked.length, 0, '<a download>를 누르지 않는다');
  assert.equal(lastMsg(o.app), '판 2개를 복사했다');
  o = await open({ touch: true, app: true });
  assert.equal(await o.btn.onClick(), 'fail');
  assert.equal(lastMsg(o.app), '내보내지 못했다');
});

test('앱은 돌려 그리지 않는다: 같은 세로 손가락 창(390×844 · dpr 3)에서 웹은 돌리고 앱은 그대로', async () => {
  const fits = {};
  for (const app of [false, true]) {
    const { dom } = makeDom({ width: 390, height: 844, dpr: 3, touch: true, app });
    const a = await boot({ window: dom.window, document: dom.document });
    fits[app ? 'app' : 'web'] = dom.window.__fit;
    assert.equal(a.coarse, true, '손가락 기기라는 것은 그대로(처음 안내 · 누르는 구역)');
  }
  assert.equal(fits.web.rot, true);
  assert.equal(fits.app.rot, false);
});
