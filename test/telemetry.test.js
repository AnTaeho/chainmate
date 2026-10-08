// 기록 보내기(CHM-63, docs/design-notes/telemetry.md): 조건이 안 맞으면 한 건도 안 나가는가, 묶어 보내기 · 상한, 오류 중복 제거,
// run_end가 판 요약(runRow)을 통째로 싣는가, 30KB 줄이기, 끈 뒤 조용한가, 속성에 사람을 가리킬 것이 없는가, 판 사건 표, PostHog 응답 읽기.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/dom.js';
import { fakeTel, wireDom, settle, HOST } from './helpers/telemetry.js';
import { shopRun, playToShop } from './helpers/run.js';
import { createRun, applyRun, canBuy } from '../src/sim/run.js';
import { newTrack, trackBefore, trackCommand, runRow } from '../src/sim/runlog.js';
import { stepBattle } from '../tools/bot.mjs';
import { LIMITS, TID_KEY, telBefore, commandEvents, runEndProps, runStartProps, stackFrames, engineOf, uuid4, uuid7 } from '../src/ui/telemetry.js';
import { POSTHOG } from '../src/config.js';
import { KEYS } from '../src/ui/save.js';
import { loadRuns } from '../src/ui/runlog.js';
import { parseRows, rowsQuery } from '../tools/posthog.mjs';

// 하네스 dump와 같은 열쇠 + 사람 판에만 있는 열쇠(test/runlog.test.js와 같은 기준)
const DUMP_KEYS = ['seed', 'won', 'ante', 'blind', 'log', 'bought', 'final', 'money', 'fragments', 'legends', 'legendAt', 'editions', 'seen', 'holds', 'deck', 'charts', 'deckSize', 'fam', 'josekis', 'fairies', 'best', 'souls', 'cracked', 'awakened', 'ignite'];
const HUMAN_ONLY = ['human', 'id', 'end', 'dan', 'opening', 'daily', 'endless', 'startedAt', 'endedAt', 'sec', 'battles', 'sacrifices', 'brilliants', 'lostAt', 'buys', 'script', 'app'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// 판 하나를 끝까지(레퍼토리 첫째 · 상점은 그냥 떠남) 두고 세어 둔 track과 함께
function playedRun(seed = 1000003) {
  const run = createRun({ seed, dan: 0, draft: true });
  const track = newTrack({ startedAt: 1, app: { version: '0.1.0', commit: null, platform: 'web' } });
  const sent = [];
  const act = (cmd) => { const b = trackBefore(run), tb = telBefore(run); const ev = applyRun(run, cmd); trackCommand(track, run, cmd, ev, b); sent.push(...commandEvents(run, cmd, ev, tb)); return ev; };
  for (let guard = 0; guard < 5000 && run.phase !== 'lost' && run.phase !== 'won'; guard++) {
    if (run.phase === 'draft') act({ type: 'joseki', index: 0 });
    else if (run.phase === 'select') act({ type: 'play' });
    else if (run.phase === 'battle') { if (!stepBattle(run.battle, act, {})) throw new Error('stuck'); }
    else if (run.phase === 'shop') act({ type: 'leave' });
    else if (run.phase === 'pack') act({ type: 'skipPack' });
  }
  return { run, track, sent };
}

// ── 보내는 조건
test('조건이 안 맞으면 한 건도 안 나가고 저장에도 아무것도 안 쓴다(호스트 · webdriver · 끔)', async () => {
  for (const [why, opts] of [['localhost', { host: 'localhost' }], ['미리 보기 배포', { host: 'chainmate-git-x.vercel.app' }], ['빈 호스트', { host: '' }], ['webdriver', { webdriver: true }], ['fetch 없음', { fetch: null }]]) {
    const t = fakeTel(opts);
    assert.equal(t.tel.open(), false, why);
    for (let i = 0; i < 40; i++) assert.equal(t.tel.track('battle_end', { ante: 1 }), false, why);
    assert.equal(t.tel.error(new Error('x')), false, why);
    t.tel.flush(); t.tel.flushNow(); t.ring(); await settle();
    assert.equal(t.net.sent.length, 0, why);
    assert.equal(t.timers.length, 0, why);
    assert.equal(t.storage.mem.size, 0, why);
  }
  const off = fakeTel();
  off.state.on = false;
  off.tel.open(); off.tel.track('x'); off.tel.flushNow();
  assert.equal(off.net.sent.length, 0, '설정 끔');
  assert.equal(off.storage.mem.size, 0);
});

test('앱(Tauri)은 호스트와 상관없이 보낸다 · 배포 주소의 웹도 보낸다', () => {
  for (const opts of [{ platform: 'desktop', host: 'tauri.localhost' }, { platform: 'ios', host: '' }, { platform: 'web', host: HOST }]) {
    const t = fakeTel(opts);
    assert.equal(t.tel.open(), true);
    t.tel.flushNow();
    assert.equal(t.net.events().length, 1);
    assert.equal(t.net.events()[0].properties.platform, opts.platform);
  }
});

test('앱: 로컬 서버 · 자동화 브라우저 · 설정 끔에서는 판을 두어도 0건, 수업 판(scratch)의 명령은 배포 주소에서도 0건', async () => {
  const play = async (wire, settings = null) => {
    const { makeFakeDom } = await import('../tools/fakedom.mjs');
    const d = makeFakeDom();
    const net = wireDom(d, wire);
    if (settings) d.window.localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    const app = await boot({ window: d.window, document: d.document });
    tick(app);
    return { app, net, d };
  };
  for (const [why, wire, settings] of [['localhost', { host: 'localhost' }], ['127.0.0.1', { host: '127.0.0.1' }], ['webdriver', { webdriver: true }], ['끔', {}, { telemetry: false }]]) {
    const { app, net, d } = await play(wire, settings);
    app.records.kingDone = true; app.records.runs = 1;
    app.newRun({ seed: 7 });
    app.cmd({ type: 'joseki', index: 0 }); app.cmd({ type: 'play' });
    d.emit('error', { error: new Error('boom') });
    assert.equal(net.flush().length, 0, why);
    assert.equal(d.store.has(TID_KEY), false, why);
  }
  // 배포 주소: 켜면 app_open, 수업 ⑩의 연습 판에서는 판 사건이 안 나간다(설정 · 수업 진행만 예외)
  const { app, net } = await play({});
  const { startLessonShop } = await import('../src/ui/screens/lessons.js');
  startLessonShop(app, 9);
  assert.ok(app.run.scratch);
  app.cmd({ type: 'buy', slot: 0 });
  app.track('review_open', { ante: 1 });
  assert.deepEqual(net.flush().map((e) => e.event), ['app_open']);
});

// ── 묶어 보내기
test('스무 건이 차면 곧바로, 그 전에는 10초 뒤에 한 묶음으로 보낸다', async () => {
  const t = fakeTel();
  for (let i = 0; i < LIMITS.batch - 1; i++) t.tel.track('battle_end', { i });
  assert.equal(t.net.sent.length, 0);
  assert.deepEqual(t.timers.filter(Boolean).map((x) => x.ms), [LIMITS.every], '타이머 하나');
  t.tel.track('battle_end', { i: 19 });
  assert.equal(t.net.sent.length, 1);
  assert.equal(t.net.sent[0].events.length, 20);
  assert.equal(t.net.sent[0].url, `${POSTHOG.host}/batch/`);
  assert.equal(JSON.parse(t.net.sent[0].body).api_key, POSTHOG.key);
  await settle();
  for (let i = 0; i < 3; i++) t.tel.track('hold', { i });
  assert.equal(t.net.sent.length, 1);
  t.ring(); await settle();
  assert.equal(t.net.sent.length, 2);
  assert.equal(t.net.sent[1].events.length, 3);
  assert.equal(t.tel.pending, 0);
  assert.equal(t.tel.stats.sent, 23);
});

test('못 보내면 한 번만 다시 보내고 버린다 · 쌓이는 것은 200건까지', async () => {
  const t = fakeTel();
  t.net.mode = 'fail';
  for (let i = 0; i < 3; i++) t.tel.track('hold', { i });
  t.ring(); await settle();
  assert.equal(t.net.sent.length, 1);
  assert.equal(t.tel.pending, 3, '한 번 실패한 묶음은 쥐고 있다');
  t.ring(); await settle();
  assert.equal(t.net.sent.length, 2, '다시 한 번');
  assert.equal(t.tel.pending, 0, '두 번째도 안 되면 버린다');
  assert.equal(t.tel.stats.dropped, 3);
  t.ring(); await settle();
  assert.equal(t.net.sent.length, 2, '더 보내지 않는다');
  // 답이 안 오는 동안 쌓인다: 상한 200(오래된 것부터 버린다)
  const h = fakeTel();
  h.net.mode = 'hang';
  for (let i = 0; i < 500; i++) h.tel.track('hold', { i });
  assert.equal(h.net.sent.length, 1, '보내는 중에는 겹쳐 보내지 않는다');
  assert.equal(h.tel.pending, LIMITS.queue);
  // 화면이 숨으면 남은 것을 비콘으로, 스무 건씩
  assert.equal(h.tel.flushNow(), LIMITS.queue);
  const beacons = h.net.sent.filter((r) => r.via === 'beacon');
  assert.equal(beacons.length, LIMITS.queue / LIMITS.batch);
  assert.ok(beacons.every((r) => r.events.length <= LIMITS.batch));
  assert.equal(beacons.at(-1).events.at(-1).properties.i, 499, '새 것이 남는다');
  assert.equal(h.tel.pending, 0);
});

test('익명 ID는 저장에 한 번 만들어 두고 다시 쓴다 · app_open은 처음 켠 사람과 지난 날을 싣는다', () => {
  const a = fakeTel();
  a.tel.open(); a.tel.flushNow();
  const first = a.net.events()[0];
  assert.match(first.distinct_id, UUID);
  assert.deepEqual([first.properties.first, first.properties.days_since_first], [true, 0]);
  assert.equal(JSON.parse(a.storage.mem.get(TID_KEY)).id, first.distinct_id);
  // 사흘 뒤 다시 켠다(같은 저장)
  const b = fakeTel({ storage: a.storage, now: () => a.clock.t + 3 * 86400000 + 5000 });
  b.tel.open(); b.tel.flushNow();
  const again = b.net.events()[0];
  assert.equal(again.distinct_id, first.distinct_id);
  assert.deepEqual([again.properties.first, again.properties.days_since_first], [false, 3]);
  assert.notEqual(again.properties.$session_id, first.properties.$session_id, '세션은 켤 때마다 새로');
  // 저장을 지우면 새 사람
  const c = fakeTel();
  c.tel.open(); c.tel.flushNow();
  assert.notEqual(c.net.events()[0].distinct_id, first.distinct_id);
  assert.match(uuid4(), UUID);
  assert.equal(uuid7(Date.UTC(2026, 9, 8))[14], '7');
});

// ── 오류
test('오류: 같은 메시지 + 첫 스택 줄은 세션에 한 번, 세션당 다섯 건까지', () => {
  const t = fakeTel();
  // 그리기 루프가 초당 60번 던진다
  const boom = () => { try { null.x; } catch (e) { return e; } };
  const same = [];
  for (let i = 0; i < 600; i++) { try { null.x; } catch (e) { same.push(t.tel.error(e)); } }
  assert.equal(same.filter(Boolean).length, 1);
  for (let i = 0; i < 20; i++) t.tel.error(new Error(`다른 오류 ${i}`));
  t.tel.error(boom());
  t.tel.error('글만 온 오류');
  t.tel.flushNow();
  const ex = t.net.named('$exception');
  assert.equal(ex.length, LIMITS.errors);
  const p = ex[0].properties;
  assert.equal(p.screen, 'battle');
  assert.equal(p.app_version, '0.1.0');
  assert.equal(p.$exception_list.length, 1);
  assert.equal(p.$exception_list[0].type, 'TypeError');
  assert.ok(p.$exception_list[0].value.length > 0);
  assert.equal(p.$exception_list[0].stacktrace.type, 'raw');
  assert.ok(p.$exception_list[0].stacktrace.frames.length > 0);
  assert.ok(p.$exception_list[0].stacktrace.frames.every((f) => f.filename && f.lineno > 0));
});

test('스택 읽기: 크로미움 · 웹킷 · 게코 꼴', () => {
  const chrome = stackFrames('TypeError: x\n    at draw (https://chainmate.papercut.kr/src/ui/app.js:323:11)\n    at https://chainmate.papercut.kr/src/main.js:210:9');
  assert.deepEqual(chrome.map((f) => [f.function, f.filename.split('/').pop(), f.lineno, f.colno]), [['?', 'main.js', 210, 9], ['draw', 'app.js', 323, 11]]);
  const webkit = stackFrames('draw@https://chainmate.papercut.kr/src/ui/app.js:323:11\n@https://chainmate.papercut.kr/src/main.js:210:9');
  assert.deepEqual(webkit.map((f) => [f.function, f.lineno]), [['?', 210], ['draw', 323]]);
  assert.deepEqual(stackFrames(''), []);
  assert.deepEqual([engineOf('Mozilla/5.0 Gecko/20100101 Firefox/140.0'), engineOf('Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0 Safari/537.36'), engineOf('Mozilla/5.0 AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15'), engineOf('')], ['gecko', 'chromium', 'webkit', 'other']);
});

// ── 판 끝
test('run_end는 판 요약(runRow)의 열쇠를 모두 row에 싣고, 납작한 속성도 함께 싣는다', () => {
  const { run, track } = playedRun();
  const row = runRow(run, track, { end: 'lost', endedAt: '2026-10-08T12:00:00.000Z' });
  assert.deepEqual(Object.keys(row).sort(), [...DUMP_KEYS, ...HUMAN_ONLY].sort(), 'runRow 열쇠가 바뀌면 여기와 telemetry.md도');
  const t = fakeTel();
  assert.equal(t.tel.track('run_end', runEndProps(row)), true);
  t.tel.flushNow();
  const p = t.net.named('run_end')[0].properties;
  assert.deepStrictEqual(p.row, JSON.parse(JSON.stringify(row)), '판 줄은 그대로');
  assert.equal(p.row_trimmed, undefined);
  assert.deepEqual([p.won, p.end, p.ante, p.blind, p.dan, p.opening], [false, 'lose', row.ante, row.blind, 0, row.opening]);
  assert.deepEqual(p.josekis, row.josekis);
  assert.deepEqual(p.maxims, row.final);
  assert.deepEqual(p.legends, row.legends);
  assert.equal(p.families_max, Math.max(0, ...Object.values(row.fam)));
  assert.equal(p.skips, row.log.filter((x) => x.skipped).length);
  assert.equal(p.holds, row.holds.carried);
  assert.equal(p.ignite_at, row.ignite ? row.ignite.at : null);
  assert.deepEqual([p.brilliants, p.battles, p.duration_s], [row.brilliants, row.battles, row.sec]);
  assert.deepEqual(['won', 'lost', 'quit', 'endless'].map((end) => runEndProps({ ...row, end }).end), ['win', 'lose', 'quit', 'endless']);
});

test('사건 하나가 30KB를 넘으면 판 줄의 대국별 줄을 빼고 row_trimmed를 단다', () => {
  const { run, track } = playedRun();
  const row = runRow(run, track, { end: 'lost' });
  const big = { ...row, log: Array.from({ length: 40 }, () => row.log).flat() };
  assert.ok(JSON.stringify(big).length > LIMITS.bytes);
  const t = fakeTel();
  t.tel.track('run_end', runEndProps(big));
  t.tel.flushNow();
  const ev = t.net.named('run_end')[0], p = ev.properties;
  assert.equal(p.row_trimmed, true);
  assert.equal(p.row.log, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(ev)) <= LIMITS.bytes);
  for (const k of [...DUMP_KEYS, ...HUMAN_ONLY]) if (!['log', 'buys', 'lostAt'].includes(k)) assert.ok(k in p.row, k);
  assert.deepEqual([p.won, p.end, p.battles], [false, 'lose', row.battles], '납작한 속성은 그대로');
  assert.ok(Array.isArray(big.log) && big.log.length > 0, '넘겨받은 줄은 건드리지 않는다');
});

// ── 끄기
test('끄는 순간 telemetry_off를 마지막으로 곧바로 보내고 그 뒤로는 조용하다', async () => {
  const t = fakeTel();
  t.tel.open();
  t.tel.track('run_start', { dan: 0 });
  t.tel.off();
  t.state.on = false;
  await settle();
  assert.deepEqual(t.net.events().map((e) => e.event), ['app_open', 'run_start', 'telemetry_off']);
  assert.equal(t.net.sent.length, 1, '타이머를 기다리지 않는다');
  for (let i = 0; i < 50; i++) assert.equal(t.tel.track('battle_end', { i }), false);
  assert.equal(t.tel.error(new Error('뒤')), false);
  t.ring(); t.tel.flushNow(); await settle();
  assert.equal(t.net.events().length, 3);
  // 다시 켜면 같은 ID로 이어 보낸다
  t.state.on = true;
  t.tel.track('setting_change', { key: 'telemetry', value: true });
  t.tel.flushNow();
  assert.equal(t.net.events().at(-1).distinct_id, t.net.events()[0].distinct_id);
});

// ── 판 사건 표
test('명령 길: 레퍼토리 · 대국 끝 · 상점 사기 · 떠나기 · 건너뛰기 · 찜 · 꾸러미가 표대로 옮겨진다', () => {
  const { sent } = playedRun();
  const names = sent.map(([n]) => n);
  const of = (name) => sent.filter(([n]) => n === name).map(([, p]) => p);
  assert.equal(names[0], 'draft_pick');
  const d = of('draft_pick')[0];
  assert.ok(d.offered.length >= 2 && d.offered.includes(d.picked) && d.ante === 1);
  const b = of('battle_end');
  assert.ok(b.length >= 3);
  for (const x of b) {
    assert.deepEqual(Object.keys(x).sort(), ['ante', 'blind', 'first_move_win', 'kind', 'moves_used', 'ratio', 'reason', 'sacrifices', 'won'].sort());
    assert.ok(['mate', 'target', 'gomoku', 'moves', 'stuck'].includes(x.reason), x.reason);
    assert.equal(x.ratio, Math.round(x.ratio * 100) / 100);
    assert.equal(x.first_move_win, x.won && x.moves_used === 1);
  }
  const l = of('shop_leave');
  assert.ok(l.length >= 1);
  assert.ok(l[0].shown.length >= 2 && l[0].shown.every((s) => s.kind && 'id' in s));
  assert.deepEqual([l[0].bought, l[0].rerolls], [0, 0]);
  assert.equal(typeof l[0].money_left, 'number');
  assert.ok(of('clock_lost').length >= 1);
  // 상점: 사기 · 찜 · 다시 진열 뒤 떠나기 · 꾸러미
  const run = shopRun(3);
  run.money = 99;
  run.track = newTrack();
  // 앱과 같은 차례: 규칙 → 보낼 사건 → 판 기록
  const act = (cmd) => { const b = trackBefore(run), tb = telBefore(run); const ev = applyRun(run, cmd); const out = commandEvents(run, cmd, ev, tb); trackCommand(run.track, run, cmd, ev, b); return out; };
  const slot = run.shop.display.findIndex((it) => canBuy(run, it));
  const it = { ...run.shop.display[slot] };
  const bought = act({ type: 'buy', slot }).find(([n]) => n === 'shop_buy')[1];
  assert.deepEqual(bought, { ante: 1, kind: it.kind, id: it.id ?? it.form ?? it.t ?? it.legend, price: it.price, held: false });
  const hs = run.shop.display.findIndex((x) => !x.sold);
  assert.deepEqual(act({ type: 'hold', slot: hs }).map(([n]) => n), ['hold']);
  assert.deepEqual(act({ type: 'hold', slot: hs }), [], '찜을 풀 때는 보내지 않는다');
  const pk = run.shop.packs.findIndex((x) => !x.sold);
  const kind = run.shop.packs[pk].kind, price = run.shop.packs[pk].price;
  assert.deepEqual(act({ type: 'buyPack', slot: pk }), [['shop_buy', { ante: 1, kind: 'pack', id: kind, price, held: false }]]);
  const offered = run.pack.options.length;
  const pick = act({ type: 'skipPack' }).find(([n]) => n === 'pack_pick')[1];
  assert.deepEqual([pick.kind, pick.offered.length, pick.skipped, pick.picked], [kind, offered, true, undefined]);
  act({ type: 'reroll' });
  const leave = act({ type: 'leave' }).find(([n]) => n === 'shop_leave')[1];
  assert.deepEqual([leave.bought, leave.rerolls, leave.money_left], [2, 1, run.money]);
  // 건너뛰기
  const sk = act({ type: 'skip' }).find(([n]) => n === 'skip_blind')[1];
  assert.deepEqual(Object.keys(sk).sort(), ['ante', 'blind', 'tag']);
  assert.equal(typeof sk.tag, 'string');
  assert.equal(run.log.at(-1).skipped, true);
  // 꾸러미에서 고르기
  const r2 = playToShop(createRun({ seed: 11, draft: false }));
  r2.money = 99;
  const act2 = (cmd) => { const tb = telBefore(r2); return commandEvents(r2, cmd, applyRun(r2, cmd), tb); };
  act2({ type: 'buyPack', slot: 0 });
  const i = r2.pack.options.findIndex((o) => o.kind === 'piece' || o.kind === 'chart' || o.kind === 'fragment');
  if (i >= 0) {
    const picked = act2({ type: 'pick', index: i }).find(([n]) => n === 'pack_pick')[1];
    assert.ok(picked.picked && picked.picked.kind && !picked.skipped);
  }
});

test('대본 대국 중의 명령은 튜토리얼 사건만 낸다', async () => {
  const run = createRun({ seed: 5, script: true });
  assert.deepEqual(runStartProps(run, { script: true }), { dan: 0, opening: run.opening ?? null, daily: false, script: true });
  applyRun(run, { type: 'play' });
  assert.ok(run.battle.script);
  const sent = [];
  const act = (cmd) => { const tb = telBefore(run); const ev = applyRun(run, cmd); sent.push(...commandEvents(run, cmd, ev, tb)); return ev; };
  while (run.phase === 'battle') stepBattle(run.battle, act, {});
  assert.deepEqual(sent.map(([n]) => n), ['tutorial_done']);
  const r2 = createRun({ seed: 5, script: true });
  applyRun(r2, { type: 'play' });
  const tb = telBefore(r2);
  assert.deepEqual(commandEvents(r2, { type: 'unscript' }, applyRun(r2, { type: 'unscript' }), tb), [['tutorial_skip', {}]]);
});

// ── 앱에 걸린 길(main.js boot 그대로, 배포 주소인 척)
let boot;
before(async () => {
  await installDom();
  ({ boot } = await import('../src/main.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });
async function liveApp(settings = null) {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const d = makeFakeDom();
  const net = wireDom(d);
  if (settings) d.window.localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  const app = await boot({ window: d.window, document: d.document });
  tick(app);
  return { app, net, d };
}
const finishBattle = (app) => { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; };
function playOut(app) {
  for (let guard = 0; guard < 5000 && app.run.phase !== 'lost' && app.run.phase !== 'won'; guard++) {
    const ph = app.run.phase;
    if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
    else if (ph === 'select') app.cmd({ type: 'play' });
    else if (ph === 'battle') finishBattle(app);
    else if (ph === 'shop') app.cmd({ type: 'leave' });
    else if (ph === 'pack') app.cmd({ type: 'skipPack' });
  }
}

test('앱: 켜면 app_open, 판을 끝까지 두면 run_start … run_end 한 번 — row는 기기에 남긴 줄과 같다', async () => {
  const { app, net } = await liveApp();
  app.records.kingDone = true; app.records.runs = 1;
  app.newRun({ seed: 1000003 });
  playOut(app);
  const kept = loadRuns(app.store);
  // 결과 화면 · 복기가 줄을 갈아 끼워도 run_end는 한 번
  app.goPhase(); tick(app);
  app.keepRun(app.run, 'lost');
  const evs = net.flush();
  const names = evs.map((e) => e.event);
  assert.equal(names[0], 'app_open');
  assert.equal(names[1], 'run_start');
  assert.equal(names.filter((n) => n === 'run_end').length, 1);
  assert.equal(names.at(-1), 'run_end');
  assert.ok(names.indexOf('battle_end') > 0 && names.lastIndexOf('battle_end') < names.indexOf('run_end'));
  const end = evs.find((e) => e.event === 'run_end').properties;
  assert.equal(kept.length, 1);
  assert.deepStrictEqual(end.row, kept[0]);
  for (const k of [...DUMP_KEYS, ...HUMAN_ONLY]) assert.ok(k in end.row, k);
  assert.equal(end.end, 'lose');
  assert.equal(evs.filter((e) => e.event === 'battle_end').length, kept[0].battles);
  // 공통 속성
  for (const e of evs) {
    const p = e.properties;
    assert.deepEqual([p.app_version, p.platform, p.engine, p.lang, p.scale], ['0.1.0', 'web', 'chromium', 'ko', app.scale], e.event);
    assert.ok(p.screen_w > 0 && p.screen_h > 0 && typeof p.dan === 'number', e.event);
    assert.match(p.$session_id, UUID);
    assert.match(e.distinct_id, UUID);
    assert.ok(!Number.isNaN(Date.parse(e.timestamp)));
  }
  assert.equal(new Set(evs.map((e) => e.properties.$session_id)).size, 1);
});

test('앱: 처음 켠 사람의 대본 대국은 걸음 · 끝만 나가고, 그 대국의 battle_end는 안 나간다 · 건너뛰면 tutorial_skip', async () => {
  const { app, net } = await liveApp();
  app.screen.items().find(([id]) => id === 'title:new')[2]();
  tick(app, 4);
  assert.equal(app.run.battle.script, 'king');
  finishBattle(app);
  tick(app, 2);
  const names = net.flush().map((e) => e.event);
  assert.deepEqual(names.filter((n) => n !== 'tutorial_step'), ['app_open', 'run_start', 'tutorial_done']);
  assert.ok(names.includes('tutorial_step'));
  const b = await liveApp();
  b.app.screen.items().find(([id]) => id === 'title:new')[2]();
  tick(b.app, 2);
  b.app.screen.skip();
  assert.ok(b.net.flush().some((e) => e.event === 'tutorial_skip'));
});

test('앱: 설정을 바꾸면 setting_change, 기록 보내기를 끄면 telemetry_off 뒤로 조용하고 저장에 남는다', async () => {
  const { app, net, d } = await liveApp();
  app.openOverlay('settings'); tick(app);
  const press = (id) => { const r = app.ui.regions.find((q) => q.id === id); assert.ok(r, id); r.onClick(); tick(app); };
  press('set:shake');
  press('set:telemetry');
  assert.equal(app.settings.telemetry, false);
  assert.equal(JSON.parse(d.store.get(KEYS.settings)).telemetry, false);
  await settle();
  const off = net.events().map((e) => e.event);
  assert.deepEqual(off, ['app_open', 'setting_change', 'telemetry_off']);
  assert.deepEqual(net.named('setting_change')[0].properties.key, 'shake');
  press('set:shake'); press('set:calm');
  app.records.kingDone = true; app.records.runs = 1;
  app.newRun({ seed: 7 });
  app.cmd({ type: 'joseki', index: 0 }); app.cmd({ type: 'play' });
  d.emit('error', { error: new Error('boom') });
  assert.equal(net.flush().length, 3, '끈 뒤로는 아무것도');
  // 다시 켠다
  app.openOverlay('settings'); tick(app);
  press('set:telemetry');
  assert.deepEqual(net.flush().at(-1).properties.key, 'telemetry');
  // 꺼 둔 채 다시 켠 앱은 app_open도 안 보낸다
  const cold = await liveApp({ telemetry: false });
  assert.equal(cold.net.flush().length, 0);
});

test('앱: 창의 오류 · 거절된 약속이 $exception으로, 같은 것은 한 번만', async () => {
  const { app, net, d } = await liveApp();
  const err = new Error('그리다 터짐');
  for (let i = 0; i < 120; i++) d.emit('error', { error: err, message: err.message });
  d.emit('unhandledrejection', { reason: new TypeError('약속이 깨짐') });
  const ex = net.flush().filter((e) => e.event === '$exception');
  assert.deepEqual(ex.map((e) => e.properties.$exception_list[0].value), ['그리다 터짐', '약속이 깨짐']);
  assert.deepEqual(ex.map((e) => e.properties.screen), ['title', 'title']);
  assert.equal(app.screen.name, 'title');
});

// ── 사람을 가리킬 것
test('속성에 이름 · 시드 · 주소 · UA가 없다(판 줄 row 안의 판 시드만 예외) · 사람 프로필과 IP는 끈다', async () => {
  const { app, net, d } = await liveApp();
  app.records.kingDone = true; app.records.runs = 1;
  app.newRun({ seed: 1000003 });
  playOut(app);
  d.emit('error', { error: new Error('x') });
  const evs = net.flush();
  assert.ok(evs.length > 10);
  const BAD = /seed|name|email|user_?agent|^ua$|^\$?(ip|host|url|referrer|current_url|pathname|device_id|user_id)$|^\$set|^\$anon|distinct/i;
  const ALLOW = new Set(['$ip', 'filename']);
  const walk = (o, path, skipRow) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (skipRow && k === 'row') continue;
      assert.ok(ALLOW.has(k) || !BAD.test(k), `${path}.${k}`);
      walk(v, `${path}.${k}`, false);
    }
  };
  for (const e of evs) {
    assert.deepEqual(Object.keys(e).sort(), ['distinct_id', 'event', 'properties', 'timestamp']);
    walk(e.properties, e.event, true);
    assert.equal(e.properties.$process_person_profile, false, e.event);
    assert.equal(e.properties.$geoip_disable, true, e.event);
    assert.equal(e.properties.$ip, '0.0.0.0', e.event);
  }
  const start = evs.find((e) => e.event === 'run_start').properties;
  assert.ok(!JSON.stringify(start).includes('1000003'), '판을 시작할 때 시드는 보내지 않는다');
  // 판 줄 밖에는 판 시드가 어디에도 없다
  for (const e of evs) { const { row, ...rest } = e.properties; assert.ok(!JSON.stringify(rest).includes('1000003'), e.event); }
  // 저장에 남는 것은 익명 ID와 처음 켠 때뿐
  assert.deepEqual(Object.keys(JSON.parse(d.store.get(TID_KEY))).sort(), ['id', 'since']);
  // 요청은 수집 주소로만
  assert.ok(net.sent.every((r) => r.url === `${POSTHOG.host}/batch/`));
});

// ── 첫 화면 알림
test('첫 화면 알림: 켜져 있으면 한 번 뜨고, 누르면 사라져 다시 안 뜬다 · 꺼 두면 안 뜬다', async () => {
  const { app, d } = await liveApp();
  const { LOG } = await import('../src/render/layoutlog.js');
  const { TELEMETRY_NOTE } = await import('../src/ui/screens/title.js');
  LOG.on = true;
  const shown = () => { tick(app); return LOG.texts.some((q) => q.s === TELEMETRY_NOTE); };
  try {
    assert.equal(shown(), true);
    d.mouse('mousedown', 240, 120); d.mouse('mouseup', 240, 120);
    assert.equal(shown(), false);
    assert.equal(app.records.coachSeen.telemetry, true);
    app.go('title');
    assert.equal(shown(), false);
    app.records.coachSeen = {};
    assert.equal(shown(), true, '설정 「다시 보기」로 되살린다');
    app.settings.telemetry = false;
    assert.equal(shown(), false);
  } finally { LOG.on = false; }
});

// ── 분석 도구
test('PostHog 응답 읽기: row가 글이든 객체든 판 줄로, 같은 id는 뒤의 것, 빠진 대국 줄은 빈 배열', () => {
  const { run, track } = playedRun();
  const row = runRow(run, track, { end: 'won' });
  const endless = { ...row, end: 'endless', ante: 11 };
  const { log, ...noLog } = { ...row, id: 'trimmed:1' };
  assert.ok(log);
  const json = {
    columns: ['row', 'row_trimmed', 'distinct_id', 'timestamp'],
    results: [
      [JSON.stringify(row), null, 'a', '2026-10-08T01:00:00Z'],
      [JSON.stringify({ ...row, id: 'other:2', won: false, end: 'lost' }), null, 'b', '2026-10-08T02:00:00Z'],
      [endless, null, 'a', '2026-10-08T03:00:00Z'],
      [JSON.stringify(noLog), 'true', 'c', '2026-10-08T04:00:00Z'],
      ['{깨진 글', null, 'd', '2026-10-08T05:00:00Z'],
      [null, null, 'e', '2026-10-08T06:00:00Z'],
    ],
  };
  const got = parseRows(json);
  assert.deepEqual(got.runs.map((r) => [r.id, r.end]), [['other:2', 'lost'], [row.id, 'endless'], ['trimmed:1', 'won']]);
  assert.deepEqual([got.bad, got.trimmed, got.people], [2, 1, 3]);
  assert.deepEqual(got.runs[2].log, []);
  assert.deepStrictEqual(got.runs[0].log, JSON.parse(JSON.stringify(row.log)));
  assert.deepEqual(parseRows({ results: [] }), { runs: [], bad: 0, trimmed: 0, people: 0 });
  assert.match(rowsQuery(30), /event = 'run_end'.*interval 30 day.*selftest is null/);
});
