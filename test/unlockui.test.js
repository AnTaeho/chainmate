// 해금 화면 · 결과 화면의 해금 줄 · 도감의 자물쇠 칸(CHM-73): 가짜 DOM으로 켠 앱에서 그려 글 넘침 0과 누르는 길을 잰다(한국어 · 영어).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { finishedRun } from './helpers/hlrun.js';

let M;
before(async () => {
  await installDom();
  M = {
    lang: await import('../src/ui/lang.js'),
    log: await import('../src/render/layoutlog.js'),
    data: await import('../src/data/unlocks.js'),
    view: await import('../src/ui/unlockview.js'),
    screen: await import('../src/ui/screens/unlocks.js'),
  };
});
after(async () => { const { setCanvasFactory } = await import('../src/render/surface.js'); setCanvasFactory(null); M.lang.setLang('ko'); });
const LANGS = ['ko', 'en'];

async function bootApp(lang = 'ko') {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { boot } = await import('../src/main.js');
  const d = makeFakeDom();
  if (lang !== 'ko') d.window.localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang }));
  const sent = [];
  const app = await boot({ window: d.window, document: d.document, today: () => '2026-10-09', rankBase: '' });
  app.records.kingDone = true; app.records.coachSeen = { telemetry: true, bigText: true, rankName: true, unlocks: true };
  const real = app.track; app.track = (name, props, o) => { sent.push([name, props]); return real(name, props, o); };
  const frame = () => { const { LOG, checkLayout } = M.log; LOG.on = true; try { app.frame((app.last || 0) + 16); return { bad: checkLayout().map((q) => q.msg), boxes: LOG.boxes.slice(), texts: LOG.texts.slice() }; } finally { LOG.on = false; } };
  const has = (id) => app.ui.regions.some((r) => r.id === id);
  const reg = (id) => app.ui.regions.find((r) => r.id === id);
  const press = (id) => { const r = reg(id); assert.ok(r && r.onClick && r.enabled, `누를 것 ${id}`); r.onClick(); return frame(); };
  const at = (tier, gates = M.data.UNLOCK_GATES[tier]) => { app.records.unlockTier = tier; app.records.gates = gates; };
  return { app, sent, frame, has, reg, press, at };
}

test('해금 화면: 길 보기와 스물한 묶음을 펼친 모습 모두 글 넘침 0 · 상자가 화면 안(단계 0 · 3 · 20, 한국어 · 영어)', async () => {
  const { MAX_TIER } = M.data;
  for (const lang of LANGS) {
    const a = await bootApp(lang);
    for (const tier of [0, 3, MAX_TIER]) {
      a.at(tier, tier === 3 ? 10 : undefined);
      a.app.go('unlocks');
      let f = a.frame();
      assert.deepEqual(f.bad, [], `${lang} 단계 ${tier} 길 보기`);
      assert.equal(a.app.ui.regions.filter((r) => /^unlocks:\d+$/.test(r.id)).length, MAX_TIER + 1, '칸 스물하나');
      assert.ok(f.boxes.some((q) => q.name === '해금 아래 칸'));
      for (let t = 0; t <= MAX_TIER; t++) {
        a.app.screen.sel = t; a.app.screen.page = 0;
        const { pages } = t <= tier ? M.screen.bundlePages(M.view.bundleSize(t)) : { pages: 1 };
        for (let p = 0; p < pages; p++) {
          a.app.screen.page = p;
          f = a.frame();
          const tag = `${lang} 단계 ${tier} 묶음 ${t} ${p + 1}쪽`;
          assert.deepEqual(f.bad, [], tag);
          const cards = f.boxes.filter((q) => q.kind === 'card');
          assert.ok(cards.length >= 1 && cards.length <= (t <= tier ? 4 : 5), `${tag}: 카드 ${cards.length}`);
          for (const c of cards) assert.ok(c.x >= 8 && c.x + c.w <= 472 && c.y >= 50 && c.y + c.h <= 236, `${tag}: 카드 ${c.x},${c.y} ${c.w}×${c.h}`);
          assert.equal(cards.some((c) => /^뒷면/.test(c.name)), t > tier, `${tag}: 잠긴 묶음만 뒷면`);
          assert.equal(a.has('unlocks:next'), pages > 1, `${tag}: 쪽 단추`);
        }
        // 잠긴 묶음: 언제 열리는지 한 줄
        if (t > tier) assert.ok(f.texts.some((q) => q.s === M.lang.L(M.view.lockLine(M.view.unlockState(a.app.records), t))), `${lang} 묶음 ${t} 잠긴 줄`);
      }
    }
  }
  M.lang.setLang('ko');
});

test('해금 화면: 칸을 누르면 펼치고 다시 누르면 접힌다 · 「뒤로」는 펼친 것을 먼저 접고 온 곳으로 · 쪽 넘기기 · 열면 사건 하나', async () => {
  const a = await bootApp();
  a.at(3, 10);
  a.app.go('codex'); a.frame();
  a.press('codex:tab:souls');
  a.press('codex:unlocks');
  assert.equal(a.app.screen.name, 'unlocks');
  assert.deepEqual(a.sent.filter(([n]) => n === 'unlocks_open'), [['unlocks_open', { from: 'codex', tier: 3 }]]);
  assert.equal(a.app.screen.sel, null);
  a.press('unlocks:2'); assert.equal(a.app.screen.sel, 2);
  a.press('unlocks:2'); assert.equal(a.app.screen.sel, null);
  a.press('unlocks:0'); assert.equal(a.app.screen.sel, 0);
  a.press('unlocks:next'); assert.equal(a.app.screen.page, 1);
  a.app.key('ArrowRight'); assert.equal(a.app.screen.page, 2);
  a.app.key('ArrowLeft'); a.app.key('ArrowLeft'); a.app.key('ArrowLeft'); assert.deepEqual([a.app.screen.sel, a.app.screen.page], [0, 0], '첫 묶음 첫 쪽에서 멈춘다');
  a.press('unlocks:5'); assert.deepEqual([a.app.screen.sel, a.app.screen.page], [5, 0], '다른 칸을 누르면 그 묶음 첫 쪽');
  a.press('unlocks:back'); assert.equal(a.app.screen.sel, null); assert.equal(a.app.screen.name, 'unlocks');
  a.press('unlocks:back');
  assert.equal(a.app.screen.name, 'codex');
  assert.equal(a.app.screen.tab, 'souls', '보던 탭으로 돌아온다');
  // 처음 한 번: 지금 자리 마디를 가리키는 안내
  a.app.records.coachSeen.unlocks = false;
  a.app.go('unlocks'); a.frame(); a.frame();
  assert.equal(a.app.hintShown && a.app.hintShown.id, 'unlocks');
  assert.ok(a.has('unlocks:here') || a.app.ui.regions.some((r) => r.id === 'unlocks:here'));
});

test('결과 화면: 막대와 「다음 해금까지 관 N개」, 묶음이 열린 판은 금빛 「N개 열렸어요」 → 해금 화면이 그 묶음을 펼친 채 → 뒤로 두 번이면 결과', async () => {
  for (const lang of LANGS) {
    const a = await bootApp(lang), L = M.lang.L;
    // 누적 0에서 5관까지 간 판: +4 → 첫 묶음이 열리고, 다음(5)까지 관 1개
    a.app.run = finishedRun({ won: false, ante: 5 });
    a.app.go('result', { quiet: true });
    let f = a.frame();
    assert.deepEqual(f.bad, [], `${lang} 열린 판`);
    assert.deepEqual([a.app.records.gates, a.app.records.unlockTier], [4, 1]);
    assert.ok(f.texts.some((q) => q.s === L('다음 해금까지 관 1개')), `${lang}: 남은 관 글`);
    const btn = a.reg('result:unlocks'), again = a.reg('result:again'), box = f.boxes.find((q) => q.name === '결과');
    assert.ok(btn && btn.y + btn.h <= again.y - 4 && btn.x >= box.x + 8 && btn.x + btn.w <= box.x + box.w - 8, `${lang}: 단추 자리`);
    assert.ok(f.texts.some((q) => q.s === L(`${M.view.bundleSize(1)}개 열렸어요`)), `${lang}: 단추 글`);
    assert.deepEqual(a.sent.filter(([n]) => n === 'unlock_tier'), [['unlock_tier', { tier: 1, gates: 4 }]]);
    a.press('result:unlocks');
    assert.deepEqual([a.app.screen.name, a.app.screen.sel, a.app.screen.from], ['unlocks', 1, 'result']);
    a.press('unlocks:back'); assert.equal(a.app.screen.name, 'unlocks');
    a.press('unlocks:back');
    assert.equal(a.app.screen.name, 'result');
    f = a.frame();
    assert.ok(a.has('result:unlocks'), `${lang}: 돌아와도 단추가 남는다`);
    assert.deepEqual([a.app.records.gates, a.app.records.unlockTier, a.app.records.runs], [4, 1, 1], '다시 세지 않는다');
    // 안 열린 판: 막대와 글만
    a.at(3, 9);
    a.app.run = finishedRun({ won: false, ante: 2 });
    a.app.go('result', { quiet: true });
    f = a.frame();
    assert.deepEqual(f.bad, [], `${lang} 안 열린 판`);
    assert.ok(!a.has('result:unlocks') && f.texts.some((q) => q.s === L('다음 해금까지 관 2개')), `${lang}: 안 열린 판`);
    // 문턱은 넘었는데 한 판에 하나라 남은 몫: 다음 판이 끝나면
    a.at(0, 0);
    a.app.run = finishedRun({ won: true });
    a.app.go('result', { quiet: true });
    f = a.frame();
    assert.deepEqual(f.bad, [], `${lang} 이긴 판`);
    assert.deepEqual([a.app.records.gates, a.app.records.unlockTier], [8, 1]);
    assert.ok(a.has('result:unlocks') && a.has('result:endless') && f.texts.some((q) => q.s === L('다음 판이 끝나면 열려요')), `${lang}: 이긴 판`);
    // 다 연 뒤: 아무것도 없다
    a.at(M.data.MAX_TIER, 200);
    a.app.run = finishedRun({ won: false, ante: 6 });
    a.app.go('result', { quiet: true });
    f = a.frame();
    assert.deepEqual(f.bad, [], `${lang} 다 연 뒤`);
    assert.ok(!a.has('result:unlocks') && !f.texts.some((q) => /해금|unlock/i.test(q.s)), `${lang}: 다 연 뒤에는 해금 줄이 없다`);
    assert.equal(a.app.records.gates, 205, '관은 계속 쌓인다');
    // 마지막 묶음을 연 판: 막대 없이 단추만
    a.at(M.data.MAX_TIER - 1, 200);
    a.app.run = finishedRun({ won: false, ante: 2 });
    a.app.go('result', { quiet: true });
    f = a.frame();
    assert.deepEqual(f.bad, [], `${lang} 마지막 묶음`);
    assert.ok(a.has('result:unlocks') && a.app.records.unlockTier === M.data.MAX_TIER);
  }
  M.lang.setLang('ko');
});

test('새 판은 지금까지 연 묶음으로, 오늘의 대국은 전부 열린 판 — 끝나면 돌파한 관은 똑같이 쌓인다', async () => {
  const a = await bootApp();
  a.at(4, 13);
  a.app.newRun({ seed: 11 });
  assert.deepEqual(a.app.run.unlocked, M.data.unlockedAt(4));
  assert.deepEqual(a.app.run.rules.pieces, M.data.unlockedAt(4).pieces);
  a.app.newRun({ daily: true });
  assert.ok(!('unlocked' in a.app.run) && !('pieces' in a.app.run.rules), '오늘의 대국은 잠금이 없다');
  a.app.run.phase = 'lost'; a.app.run.ante = 4;
  a.app.run.log.push({ ante: 4, blind: 0, kind: 'practice', score: 10, target: 100, best: 10, won: false });
  a.app.go('result', { quiet: true }); a.frame();
  assert.deepEqual([a.app.records.gates, a.app.records.unlockTier], [16, 5]);
  // 킹과 두는 첫 대국도 새 판이다(처음 켠 사람은 단계 0)
  a.at(0, 0); a.app.records.kingAgain = true;
  a.app.newRun({ script: true });
  assert.ok(a.app.run.battle && a.app.run.battle.script, '대본 대국');
  assert.deepEqual(a.app.run.unlocked, M.data.unlockedAt(0));
  a.app.toTitle();
});
