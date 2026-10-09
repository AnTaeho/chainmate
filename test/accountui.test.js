// 계정의 화면 쪽(CHM-72, src/ui/textfield.js · screens/account.js · rank.js): 입력 칸 놓기 셈(배율 · 여백 · 회전 · 위쪽에 쌓기 · 키보드에 가릴 때),
// 초점 동안 게임 키 막기, 화면을 떠날 때 치움, 한글 자판으로 친 아이디, 만들기 → 다른 기기에서 들어오기(당겨 합치기) → 비번 바꾸기 → 나가기(기기 기록 비움) → 지우기,
// 비번이 저장 · 콘솔 · 기록 보내기 · 화면 상태에 없음. 서버는 진짜 로직에 기억 저장소를 물린 가짜(helpers/fakeapi.js), DOM은 가짜(tools/fakedom.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { placeField, liftField, keyboardLift, createFields, USERNAME_FILTER, LIFT } from '../src/ui/textfield.js';
import { chooseFit, toClient } from '../src/ui/fit.js';
import { setLang } from '../src/ui/lang.js';
import { KEYS } from '../src/ui/save.js';
import { CLOUD_KEY } from '../src/ui/cloud.js';
import { PLAYER_KEY } from '../src/ui/rank.js';
import { hashKey } from '../api/_lib/service.js';
import { fakeApi } from './helpers/fakeapi.js';
import { installDom } from './helpers/dom.js';

before(async () => { await installDom(); });
after(() => { delete globalThis.document; delete globalThis.window; setLang('ko'); });

const DATE = '2026-10-08';
const PW = 'moonlit-rook-42', PW2 = 'second-knight-77';
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

// 기기 하나: 가짜 DOM + 진짜 boot(가짜 서버에 물린다). 저장은 기기마다 따로
async function device(api, { lang = 'ko', width = 1280, height = 720 } = {}) {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { boot } = await import('../src/main.js');
  const d = makeFakeDom({ width, height });
  if (lang !== 'ko') d.window.localStorage.setItem(KEYS.settings, JSON.stringify({ lang }));
  d.window.fetch = (url, init) => (String(url).startsWith('/api/') ? api.fetch(url, init) : Promise.resolve({ ok: true, status: 200 }));
  const app = await boot({ window: d.window, document: d.document, today: () => DATE, rankBase: '' });
  app.records.kingDone = true; app.records.coachSeen = { telemetry: true, bigText: true, rankName: true };
  const events = [];
  const track = app.track;
  app.track = (name, props, o) => { events.push([name, props]); return track(name, props, o); };
  let t = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; d.frame(t); } };
  const click = (id) => { frame(); const r = app.ui.regions.find((q) => q.id === id); assert.ok(r && r.enabled, `${id} (${(app.overlay || app.screen).name})`); r.onClick(); frame(); };
  const has = (id) => { frame(); return app.ui.regions.some((q) => q.id === id); };
  const open = () => { app.go('account'); frame(2); };
  const key = () => JSON.parse(d.window.localStorage.getItem(PLAYER_KEY)).key;
  await settle();
  return { d, app, events, frame, click, has, open, key, store: d.store };
}

test('입력 칸 놓기: 게임 좌표 → 창 좌표(배율 · 가장자리 여백) · 폰 세로는 구석에서 90도 돌린 자리', () => {
  const f = { x: 80, y: 60, w: 148, h: 18 };
  // 3배 · 여백 없음
  assert.deepEqual(placeField(f, { left: 0, top: 0, width: 1440, height: 810 }), { left: 240, top: 180, width: 444, height: 54, rot: false, scale: 3, font: 36 });
  // 2배 · 가장자리 여백(창 1280 × 720 — 캔버스 960 × 540이 가운데)
  assert.deepEqual(placeField(f, { left: 160, top: 90, width: 960, height: 540 }), { left: 320, top: 210, width: 296, height: 36, rot: false, scale: 2, font: 24 });
  // 소수 배율(작은 창)
  const s = placeField(f, { left: 10, top: 5, width: 360, height: 202.5 });
  assert.deepEqual([s.left, s.top, s.width, s.height, s.scale, s.font], [70, 50, 111, 13.5, 0.75, 9]);
  // 진짜 fit이 준 자리와 같다(여러 창 × dpr): 칸의 네 구석이 toClient와 맞는다
  for (const [vw, vh, dpr] of [[1440, 810, 1], [1280, 720, 2], [844, 390, 3], [1024, 768, 2], [500, 300, 1]]) {
    const fit = chooseFit({ vw, vh, dpr }), c = fit.canvas, rect = { left: c.left, top: c.top, width: c.width, height: c.height };
    const p = placeField(f, rect, false);
    assert.deepEqual([p.left, p.top], toClient(f.x, f.y, rect, false));
    assert.deepEqual([p.left + p.width, p.top + p.height], toClient(f.x + f.w, f.y + f.h, rect, false));
    assert.ok(p.left >= c.left && p.left + p.width <= c.left + c.width + 1e-9 && p.top >= c.top && p.top + p.height <= c.top + c.height + 1e-9, `${vw}×${vh}@${dpr} 캔버스 안`);
    assert.ok(Math.abs(p.font - 12 * fit.css) < 1e-9, '글 크기 = 12 × 도트의 CSS 크기');
  }
  // 폰 세로(390 × 844 @3 — 돌려 그린 화면): 게임 가로가 창 아래쪽으로, 게임 세로가 창 왼쪽으로 자란다
  const fit = chooseFit({ vw: 390, vh: 844, dpr: 3, coarse: true });
  assert.equal(fit.rot, true);
  // 돌린 틀 안의 캔버스 → 창 위의 세운 사각형(틀 (u, v) → 창 (창 폭 - v, u))
  const c = fit.canvas, rect = { left: 390 - c.top - c.height, top: c.left, width: c.height, height: c.width };
  const p = placeField(f, rect, true);
  assert.equal(p.rot, true);
  assert.ok(Math.abs(p.scale - rect.height / 480) < 1e-9);
  assert.deepEqual([p.left, p.top], toClient(f.x, f.y, rect, true), '칸의 왼쪽 위 구석(돌리는 축)');
  // 90도 돌린 뒤 칸이 덮는 창 위의 사각형: x는 left - 높이 ~ left, y는 top ~ top + 폭 — 반대 구석이 toClient와 맞는다
  const [fx, fy] = toClient(f.x + f.w, f.y + f.h, rect, true);
  assert.ok(Math.abs(p.left - p.height - fx) < 1e-9 && Math.abs(p.top + p.width - fy) < 1e-9, `돌린 칸의 반대 구석 ${p.left - p.height},${p.top + p.width} / ${fx},${fy}`);
  assert.ok(p.left - p.height >= rect.left - 1e-9 && p.left <= rect.left + rect.width + 1e-9 && p.top >= rect.top - 1e-9 && p.top + p.width <= rect.top + rect.height + 1e-9, '캔버스 안');
  // 위쪽에 쌓기(돌려 그린 화면에서 초점): 바로 선 칸이 창 폭 안에, 아래로 겹치지 않게
  const l0 = liftField(0, 390, 47), l1 = liftField(1, 390, 47);
  assert.deepEqual([l0.left, l0.width, l0.height, l0.font], [LIFT.pad, 390 - LIFT.pad * 2, 40, 16]);
  assert.ok(l0.labelTop >= 47 && l0.top === l0.labelTop + LIFT.label && l1.labelTop >= l0.top + l0.height + 8);
  assert.ok(l1.top + l1.height < 844 * 0.4, '둘 다 화면 위쪽 — 키보드에 가리지 않는다');
  // 키보드가 칸을 가리면 그만큼 올린다
  assert.equal(keyboardLift(150, 390), 0);
  assert.equal(keyboardLift(190, 180), 18);
  assert.equal(keyboardLift(172.5, 180, 8), 1);
  assert.equal(USERNAME_FILTER('Taeho_An 태호-12!'), 'taeho_an12');
});

test('입력 칸(DOM 없음): 값만 든다 · 그 프레임에 부르지 않은 칸은 치워진다 · 걸러 낸 글자를 안다', () => {
  const f = createFields();
  assert.equal(f.dom, false);
  f.begin(); f.field('user', { x: 0, y: 0, w: 10, h: 10, filter: USERNAME_FILTER }); f.field('pass', { x: 0, y: 20, w: 10, h: 10, type: 'password' }); f.end();
  assert.deepEqual(f.ids(), ['user', 'pass']);
  f.set('user', 'Taeho'); f.set('pass', 'Secret 12');
  assert.deepEqual([f.value('user'), f.value('pass'), f.rejected('user')], ['taeho', 'Secret 12', false]);
  f.set('user', '태호');
  assert.deepEqual([f.value('user'), f.rejected('user')], ['', true]);
  f.focus('pass');
  assert.equal(f.focused(), 'pass');
  f.begin(); f.field('user', { x: 0, y: 0, w: 10, h: 10 }); f.end();
  assert.deepEqual([f.ids(), f.focused(), f.value('pass')], [['user'], null, ''], '부르지 않은 칸은 값과 함께 사라진다');
  f.clear();
  assert.equal(f.count(), 0);
});

test('계정 화면의 입력 칸: 캔버스 위 그 자리에 <input> — 비번 관리자 · 폰 키보드용 속성 · 이름표 연결 · form 제출', async () => {
  const api = fakeApi();
  const a = await device(api);
  assert.equal(a.d.inputs().length, 0, '첫 화면에는 입력 칸이 없다');
  a.open();
  const { accountLayout } = await import('../src/ui/screens/account.js');
  const lay = accountLayout();
  const ins = a.d.inputs();
  assert.deepEqual(ins.map((el) => [el.id, el.type, el.name, el.attrs.autocomplete]), [['tf-user', 'text', 'username', 'username'], ['tf-pass', 'password', 'password', 'current-password']]);
  for (const el of ins) {
    assert.deepEqual([el.attrs.autocapitalize, el.attrs.spellcheck, el.attrs.autocorrect], ['off', 'false', 'off'], el.id);
    assert.equal(el.parent.tagName, 'FORM');
    const label = el.parent.children.find((c) => c.tagName === 'LABEL' && c.attrs.for === el.id);
    assert.ok(label && label.textContent, `${el.id} 이름표`);
  }
  assert.deepEqual(ins.map((el) => el.parent.children.find((c) => c.attrs.for === el.id).textContent), ['아이디', '비밀번호']);
  assert.deepEqual([ins[0].maxLength, ins[1].maxLength], [20, 72]);
  assert.ok(ins[0].parent.children.some((c) => c.tagName === 'BUTTON' && c.type === 'submit'), 'Enter로 내려면 제출 단추가 있어야 한다');
  // 자리: 창 1280 × 720 → 2배, 캔버스가 (160, 90)에. 입력 칸은 위쪽 띠(게임 y 110 위)
  const rect = a.d.screen.getBoundingClientRect();
  assert.deepEqual([rect.left, rect.top, rect.width, rect.height], [160, 90, 960, 540]);
  for (const [el, id] of [[ins[0], 'user'], [ins[1], 'pass']]) {
    const want = placeField(lay.fields[id], rect, false);
    assert.deepEqual([el.style.left, el.style.top, el.style.width, el.style.height, el.style.fontSize, el.style.transform], [`${want.left}px`, `${want.top}px`, `${want.width}px`, `${want.height}px`, '24px', ''], id);
    assert.ok(lay.fields[id].y + lay.fields[id].h <= 110, `${id}: 위쪽 띠`);
  }
  // 영어: 이름표도 옮긴다
  const e = await device(api, { lang: 'en' });
  e.open();
  assert.deepEqual(e.d.inputs().map((el) => el.parent.children.find((c) => c.attrs.for === el.id).textContent), ['Username', 'Password']);
  setLang('ko');
  // 창 크기가 바뀌면 다시 놓는다
  a.d.window.innerWidth = 1920; a.d.window.innerHeight = 1080;
  a.d.emit('orientationchange');
  a.frame();
  const rect2 = a.d.screen.getBoundingClientRect(), want2 = placeField(lay.fields.user, rect2, false);
  assert.equal(rect2.width, 1920);
  assert.deepEqual([ins[0].style.left, ins[0].style.width, ins[0].style.fontSize], [`${want2.left}px`, `${want2.width}px`, '48px']);
});

test('초점 동안 게임은 키를 받지 않는다(빈칸 · Enter · 방향키 · 숫자) · Esc는 초점만 푼다 · 캔버스를 누르면 초점이 풀린다', async () => {
  const a = await device(fakeApi());
  a.open();
  const seen = [];
  const key = a.app.key;
  a.app.key = (k) => { seen.push(k); return key(k); };
  a.d.input('user').focus();
  assert.equal(a.app.fields.focused(), 'user');
  for (const k of [' ', 'Enter', 'ArrowLeft', '1', 'Backspace', 'a']) a.d.key(k);
  assert.deepEqual(seen, [], '입력 칸에 초점이 있으면 게임에 닿지 않는다');
  assert.equal(a.app.screen.name, 'account');
  a.d.key('Escape');
  assert.deepEqual([seen, a.app.fields.focused(), a.app.screen.name], [[], null, 'account'], 'Esc는 초점만 푼다');
  a.d.key('Escape');
  assert.deepEqual([seen, a.app.screen.name], [['Escape'], 'title'], '초점이 없으면 게임이 받는다');
  // 캔버스를 누르면 초점이 풀린다
  a.open();
  a.d.input('pass').focus();
  a.d.mouse('mousedown', 470, 200); a.d.mouse('mouseup', 470, 200);
  assert.equal(a.app.fields.focused(), null);
});

test('화면을 떠나면 입력 칸이 남지 않는다: 돌아가기 · 탭 · 덮개 · 들어온 뒤 · 첫 화면', async () => {
  const api = fakeApi();
  const a = await device(api);
  const left = () => [a.d.inputs().length, a.d.document.body.children.filter((c) => c.tagName === 'FORM').length, a.app.fields.count()];
  a.open();
  assert.deepEqual(left(), [2, 1, 2]);
  a.click('acct:tab:link');
  assert.deepEqual([a.app.screen.name, left()], ['link', [0, 0, 0]], '탭을 바꾸면');
  a.click('acct:tab:account');
  assert.deepEqual(left(), [2, 1, 2]);
  a.d.input('pass').focus();
  a.app.openOverlay('settings'); a.frame();
  assert.deepEqual([left(), a.d.document.activeElement], [[0, 0, 0], null], '덮개가 뜨면 밑 화면의 칸도 치운다');
  a.app.closeOverlay(); a.frame();
  assert.deepEqual(left(), [2, 1, 2]);
  a.click('acct:back');
  assert.deepEqual([a.app.screen.name, left()], ['title', [0, 0, 0]], '뒤로');
  // 프레임이 돌지 않아도(app.go 그 자리에서) 치운다
  a.open();
  a.app.go('title');
  assert.deepEqual(left(), [0, 0, 0]);
  // 계정을 만들면 칸이 사라진다(들어와 있음 화면에는 칸이 없다)
  a.open();
  a.d.type('user', 'taeho_an'); a.d.type('pass', PW);
  a.click('acct:signup'); await settle(); a.frame(2);
  assert.deepEqual([a.app.screen.in(), left()], [true, [0, 0, 0]]);
  // 비번 바꾸기 → 칸 둘 → 그만 → 0, 지우기 둘째 확인 → 칸 하나 → Esc → 0
  a.click('acct:password');
  assert.deepEqual(a.d.inputs().map((el) => [el.id, el.attrs.autocomplete]), [['tf-cur', 'current-password'], ['tf-next', 'new-password']]);
  a.click('acct:forgot');
  assert.deepEqual(a.d.inputs().map((el) => el.id), ['tf-next'], '지금 비번 없이 정하는 길');
  a.click('acct:no');
  assert.deepEqual(left(), [0, 0, 0]);
  a.click('acct:delete'); a.click('acct:yes');
  assert.deepEqual(a.d.inputs().map((el) => [el.id, el.type]), [['tf-del', 'password']]);
  a.d.key('Escape'); a.frame();
  assert.deepEqual([a.app.screen.mode, left()], [null, [0, 0, 0]]);
});

test('한글 자판으로 친 아이디: 영문 · 숫자 · _만 남기고 한 줄로 알린다 — 조합 중에는 거르지 않는다', async () => {
  const a = await device(fakeApi());
  a.open();
  const { ACCOUNT_FAIL } = await import('../src/ui/screens/account.js');
  const el = a.d.input('user');
  el.focus();
  el.value = '샏'; el.emit('input', { isComposing: true });
  assert.equal(el.value, '샏', '조합 중인 글자는 두었다가');
  el.emit('compositionend');
  assert.deepEqual([el.value, a.app.fields.rejected('user')], ['', true], '끝나면 거른다');
  a.frame(2);
  assert.equal(a.app.screen.msg.text, ACCOUNT_FAIL.hangul);
  a.d.type('user', 'Taeho_An');
  assert.equal(el.value, 'taeho_an', '대문자는 소문자로');
  a.frame(2);
  assert.equal(a.app.screen.msg, null, '영문으로 치면 알림이 사라진다');
  // 한글만 넣고 내면 서버를 부르지 않는다
  a.d.type('user', 'ㅁㄴㅇ'); a.d.type('pass', PW);
  a.click('acct:login');
  assert.equal(a.app.screen.msg.text, ACCOUNT_FAIL.hangul);
});

test('계정 흐름: A 만들기 → B 들어오기(같은 이름 · 기록을 당겨 합침) → 비번 바꾸기 → B 나가기(기기 기록 비움 · 계정에는 남음) → A 지우기 — 비번은 어디에도 남지 않는다', async () => {
  const api = fakeApi();
  const logs = [], old = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(old)) console[k] = (...x) => logs.push(x.map(String).join(' '));
  try {
    const A = await device(api), B = await device(api);
    Object.assign(A.app.records, { runs: 6, bestAnte: 5 }); A.app.records.codex.maxims = { m1: true, m2: true }; A.app.saveRecords();
    Object.assign(B.app.records, { runs: 2, bestAnte: 7 }); B.app.records.codex.maxims = { m9: true }; B.app.saveRecords();
    // A: 계정 만들기(입력 칸에 친다 → 단추)
    A.open();
    assert.ok(A.has('acct:signup') && A.has('acct:login') && A.has('acct:privacy') && !A.has('acct:logout'));
    A.d.type('user', 'Taeho_An'); A.d.type('pass', PW);
    A.click('acct:signup'); await settle(); A.frame(2);
    assert.deepEqual([A.app.screen.acct.username, A.app.screen.msg.text], ['taeho_an', '계정을 만들었어요']);
    assert.ok(A.has('acct:password') && A.has('acct:logout') && A.has('acct:delete') && !A.has('acct:signup'));
    assert.ok(api.store.accounts.has('taeho_an'));
    const nameA = A.app.rank.player().name;
    await A.app.cloud.push(); await settle();
    // B: 틀린 비번 → 한 줄, 맞는 비번(Enter로 낸다) → 들어왔다
    B.open();
    B.d.type('user', 'taeho_an'); B.d.type('pass', 'wrong-password');
    B.click('acct:login'); await settle(); B.frame(2);
    assert.deepEqual([B.app.screen.msg.text, B.app.screen.msg.tone, B.app.screen.in()], ['아이디나 비밀번호가 맞지 않아요', 'red', false]);
    const oldKeyB = B.key();
    B.d.type('pass', PW);
    B.d.submit(); await settle(); B.frame(2);
    assert.equal(B.app.screen.in(), true);
    assert.deepEqual([B.app.screen.msg.text, B.app.screen.msg.gain.codex], ['로그인했어요', 2]);
    assert.equal(B.app.rank.player().name, nameA, '같은 이름');
    assert.notEqual(B.key(), oldKeyB);
    assert.equal(api.store.keys.get(hashKey(B.key())), api.store.keys.get(hashKey(A.key())), '같은 플레이어');
    assert.deepEqual([B.app.records.runs, B.app.records.bestAnte, Object.keys(B.app.records.codex.maxims).sort()], [6, 7, ['m1', 'm2', 'm9']], '기록을 당겨 합쳤다');
    assert.deepEqual(B.app.screen.acct, { username: 'taeho_an', devices: 2 });
    // A를 다시 켜면 B의 것까지 받는다
    await A.app.cloud.open(); await settle();
    assert.deepEqual([A.app.records.bestAnte, Object.keys(A.app.records.codex.maxims).sort()], [7, ['m1', 'm2', 'm9']]);
    // B: 비번 바꾸기(지금 비번 + 새 비번) — 틀리면 한 줄
    B.click('acct:password');
    B.d.type('cur', 'wrong-password'); B.d.type('next', PW2);
    B.click('acct:yes'); await settle(); B.frame(2);
    assert.deepEqual([B.app.screen.msg.text, B.app.screen.mode], ['비밀번호가 맞지 않아요', 'password']);
    B.d.type('cur', PW); B.d.type('next', PW2);
    B.click('acct:yes'); await settle(); B.frame(2);
    assert.deepEqual([B.app.screen.msg.text, B.app.screen.mode, B.d.inputs().length], ['비밀번호를 바꿨어요', null, 0]);
    // B: 판을 하나 두는 중에 나간다 → 확인 → 기기의 기록 · 판이 비고 새 사람이 된다. 계정 쪽에는 남는다
    B.app.newRun({ seed: 3 }); B.app.save(); B.app.toTitle();
    assert.ok(B.store.get(KEYS.run));
    B.open();
    B.click('acct:logout');
    assert.ok(B.app.screen.mode === 'logout' && B.has('acct:yes') && B.has('acct:no'));
    const keyIn = B.key();
    B.click('acct:yes'); await settle(); B.frame(2);
    assert.deepEqual([B.app.screen.in(), B.app.screen.msg.text], [false, '로그아웃했어요']);
    assert.notEqual(B.key(), keyIn);
    assert.deepEqual([B.app.records.runs, B.app.records.bestAnte, B.app.records.codex.maxims, B.app.records.kingDone], [0, 0, {}, true], '기기의 기록이 비었고 본 안내는 남았다');
    assert.deepEqual([B.store.get(KEYS.run), B.store.get(KEYS.runs), JSON.parse(B.store.get(KEYS.records)).runs, JSON.parse(B.store.get(CLOUD_KEY)).rev], [undefined, undefined, 0, 0]);
    assert.notEqual(B.app.rank.player().name, undefined);
    assert.deepEqual(B.app.rank.account(), { username: null, devices: 1 });
    const acctPlayer = api.store.keys.get(hashKey(A.key()));
    const kept = JSON.parse(api.store.saves.get(acctPlayer).blob);
    assert.deepEqual([kept.records.runs, kept.records.bestAnte, !!kept.run], [6, 7, true], '계정에는 남아 있다(나가기 앞에 올린 판까지)');
    assert.notEqual(api.store.keys.get(hashKey(B.key())), acctPlayer);
    // 빈 기기가 뒤늦게 올려도 계정의 저장은 그대로다
    B.app.cloud.touch(); await B.app.cloud.push(); await settle();
    assert.equal(JSON.parse(api.store.saves.get(acctPlayer).blob).records.runs, 6);
    assert.ok(B.has('acct:signup') && B.d.inputs().length === 2);
    // A: 계정 지우기 — 확인 둘 + 비번(옛 비번은 틀리다)
    A.open();
    A.click('acct:delete');
    assert.equal(A.app.screen.mode, 'delete1');
    A.click('acct:yes');
    assert.equal(A.app.screen.mode, 'delete2');
    A.d.type('del', PW);
    A.click('acct:yes'); await settle(); A.frame(2);
    assert.deepEqual([A.app.screen.msg.text, A.app.screen.mode, api.store.accounts.size], ['비밀번호가 맞지 않아요', 'delete2', 1]);
    A.d.type('del', PW2);
    A.d.submit(); await settle(); A.frame(2);
    assert.deepEqual([A.app.screen.in(), A.app.screen.msg.text, api.store.accounts.size], [false, '계정을 삭제했어요', 0]);
    assert.ok(!api.store.players.some((p) => p.id === acctPlayer) && !api.store.saves.has(acctPlayer));
    assert.deepEqual([A.app.records.runs, A.store.get(KEYS.run)], [0, undefined]);
    // 사건: 아이디 · 비번 · 열쇠가 없다
    const names = [...A.events, ...B.events].filter(([n]) => n.startsWith('account_'));
    assert.deepEqual(names, [
      ['account_signup', { ok: true, reason: null }], ['account_delete', {}],
      ['account_login', { ok: false, reason: 'bad' }], ['account_login', { ok: true, reason: null }], ['account_password', { reset: false }], ['account_logout', {}],
    ]);
    // 비번 · 아이디가 저장 · 콘솔 · 사건 · 화면 상태에 없다. 열쇠는 주소 · 본문에 없다(머리말로만)
    const secrets = [PW, PW2, 'wrong-password'];
    const dump = (x) => JSON.stringify([...x.store.entries()]) + JSON.stringify(x.events) + JSON.stringify({ ...x.app.screen, app: undefined }) + JSON.stringify(x.app.records) + JSON.stringify(x.app.settings);
    for (const x of [A, B]) for (const s of secrets) assert.ok(!dump(x).includes(s), `비번이 남았다: ${s}`);
    for (const x of [A, B]) assert.ok(!JSON.stringify([...x.store.entries()]).includes('taeho_an') && !JSON.stringify(x.events).includes('taeho_an'), '아이디는 저장 · 사건에 없다');
    assert.ok(!logs.join('\n').includes(PW) && !logs.join('\n').includes(PW2) && !logs.join('\n').includes('taeho_an'), '콘솔');
    assert.ok(api.calls.every((c) => !/[0-9a-f]{64}/.test(c.url) && !(c.body && c.body.key)), '열쇠는 주소 · 본문에 없다');
    assert.ok(api.calls.filter((c) => c.path.startsWith('/api/account')).every((c) => c.auth), '계정 길은 모두 머리말로');
    assert.ok(api.calls.every((c) => secrets.every((s) => !c.url.includes(s))), '비번은 주소에 없다');
  } finally { Object.assign(console, old); }
});

test('잠김 · 이미 있는 아이디 · 닿지 못함 · 다른 계정: 상태 한 줄 — 지금 비번 없이 새로 정하기 · 순위에 닿지 못하는 곳에서는 부르지 않는다', async () => {
  const api = fakeApi();
  const A = await device(api), B = await device(api);
  A.open();
  A.d.type('user', 'taeho_an'); A.d.type('pass', PW);
  A.click('acct:signup'); await settle(); A.frame(2);
  // B: 이미 있는 아이디 · 약한 비번 · 짧은 아이디
  B.open();
  const say = async (user, pass, btn) => { B.d.type('user', user); B.d.type('pass', pass); B.click(btn); await settle(); B.frame(2); return B.app.screen.msg && B.app.screen.msg.text; };
  assert.equal(await say('taeho_an', PW, 'acct:signup'), '이미 쓰고 있는 아이디예요');
  assert.equal(await say('bobby', 'password', 'acct:signup'), '비밀번호는 8자 이상 · 흔한 것은 안 돼요');
  assert.equal(await say('ab', PW, 'acct:signup'), '아이디는 영문 소문자 · 숫자 · _ 3~20자');
  B.d.type('user', ''); B.d.type('pass', '');
  B.click('acct:login');
  assert.equal(B.app.screen.msg.text, '아이디와 비밀번호를 입력하세요');
  // 다섯 번 틀리면 잠긴다 — 몇 분 뒤
  for (let i = 0; i < 5; i++) assert.equal(await say('taeho_an', 'wrong-password', 'acct:login'), '아이디나 비밀번호가 맞지 않아요');
  assert.equal(await say('taeho_an', PW, 'acct:login'), '잠겼어요 · 15분 뒤에 다시 로그인하세요');
  assert.deepEqual(B.events.at(-1), ['account_login', { ok: false, reason: 'locked' }]);
  // 닿지 못함
  api.mode = 'fail';
  assert.equal(await say('taeho_an', PW, 'acct:login'), '연결하지 못했어요');
  api.mode = 'ok';
  // 다른 계정으로 들어와 있는 기기
  assert.equal(await say('bobby', PW2, 'acct:signup'), '계정을 만들었어요');
  B.click('acct:logout'); B.click('acct:no');
  const r = await B.app.rank.login('taeho_an', PW);
  assert.deepEqual(r, { ok: false, why: 'locked', wait: 15 });
  api.store.limits.clear();
  assert.deepEqual(await B.app.rank.login('taeho_an', PW), { ok: false, why: 'other' });
  // A: 지금 비번을 잊었다 → 들어와 있는 기기에서 새로 정한다
  A.click('acct:password'); A.click('acct:forgot');
  A.d.type('next', PW2);
  A.d.submit(); await settle(); A.frame(2);
  assert.equal(A.app.screen.msg.text, '비밀번호를 바꿨어요');
  assert.deepEqual(A.events.at(-1), ['account_password', { reset: true }]);
  const C = await device(api);
  assert.equal((await C.app.rank.login('taeho_an', PW2)).ok, true, '새 비번으로 들어온다');
  // 순위에 닿지 못하는 곳(로컬 서버): 계정 길을 한 번도 부르지 않는다
  const { createRank } = await import('../src/ui/rank.js');
  const n = api.calls.length;
  const off = createRank({ fetch: api.fetch, host: 'localhost' });
  assert.deepEqual([off.account(), await off.accountLoad(), (await off.signup('zzz_zzz', PW)).ok, (await off.login('taeho_an', PW2)).ok, (await off.logout()).ok, (await off.deleteAccount(PW2)).ok], [null, null, false, false, false, false]);
  assert.equal(api.calls.length, n);
});
