// 특수 기물 연출(CHM-57) 장면: tools/shots-fairy-fx.mjs(스크린샷) · tools/video-fairy-fx.mjs(영상)가 같은 판을 쓴다.
// 장면마다 손에 그 기물 하나, 떨굴 칸 · 먹을 칸 차례(clicks), 판(적).
export const SCENES = {
  // 꺾쇠: b2 → c2 → c5 → e5(곧장 꺾는 칸 b5 · e2를 적이 막아 두 번 꺾는다). g6 폰은 나이트가 된 뒤 다음 먹을 적(사슬이 이어져 길이 남는다)
  bend: { piece: 'T', drop: 'b2', clicks: ['e5'], board: { a8: 'K', e5: 'N', b5: 'P', e2: 'P', g6: 'P' } },
  // 물수제비: b2 → a3(튕김) → f8(튕김) → h6 룩(c1에서 한 번 튕기는 길은 f4 폰이 막는다)
  bounce: { piece: 'E', drop: 'b2', clicks: ['h6'], board: { a8: 'K', h6: 'R', f4: 'P' } },
  // 까마귀: d4 → e5 나이트를 넘어 f6, 나이트가 되어 e7 비숍을 넘어 d8 — 잇따라 넘기
  hop: { piece: 'V', drop: 'd4', clicks: ['e5', 'e7'], board: { h8: 'K', e5: 'N', e7: 'B' } },
  // 화약병: d5 → c6 나이트, 둘레 다섯이 함께 터진다
  blast: { piece: 'D', drop: 'd5', clicks: ['c6'], board: { h8: 'K', c6: 'N', b7: 'R', c7: 'P', d7: 'B', b6: 'P', b5: 'N' } },
};

// 결과 다시 보기: 꺾쇠의 꺾인 길 → 까마귀 넘기 → 궁수 제자리 쏘기 → 화약병 터짐(둘레 둘이 지워진다)
const n = (s) => (Number(s[1]) - 1) * 8 + 'abcdefgh'.indexOf(s[0]);
export const REPLAY = {
  board: (() => { const b = Array(64).fill(null); for (const [k, t] of Object.entries({ a8: 'K', e5: 'V', f6: 'S', g4: 'D', h5: 'N', h6: 'P', g6: 'P', b5: 'P', e2: 'P' })) b[n(k)] = { t, id: n(k) }; return b; })(),
  drop: { sq: n('b2'), piece: 'T' },
  caps: [
    { from: n('b2'), to: n('e5'), at: n('e5'), via: n('c5'), piece: 'V', form: 'T', after: 'V' },
    { from: n('e5'), to: n('f6'), at: n('g7'), piece: 'S', form: 'V', after: 'S', hop: true },
    { from: n('g7'), to: n('g5'), at: n('g7'), piece: 'D', form: 'S', after: 'D', stay: true },
    { from: n('g7'), to: n('h6'), at: n('h6'), piece: 'P', form: 'D', after: 'D', gone: [n('g6'), n('h5')] },
  ],
  score: 4820, reason: 'blast',
};
// REPLAY의 g5는 궁수가 쏠 적(D)이 서 있어야 한다 — 판에 g5 화약병을 더한다(g4는 남는 적)
REPLAY.board[n('g5')] = { t: 'D', id: n('g5') };

// 페이지 안에서: 1관 대국을 열고 장면 판을 깐다(손 = 그 기물 + 폰 셋, 목표는 닿지 않게)
export function pageScene(sc) {
  const a = window.__app;
  a.settings.coach = false;
  if (!a.run || a.screen.name !== 'battle') {
    a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.cmd({ type: 'play' }); a.go('battle', { events: [] });
  }
  const b = a.run.battle;
  // 앞 장면의 사슬이 남아 있으면 걷어 낸다(장면마다 새로 떨군다)
  b.chain = null; b.status = 'play';
  const sq = (k) => (Number(k[1]) - 1) * 8 + 'abcdefgh'.indexOf(k[0]);
  b.board = Array(64).fill(null);
  for (const [k, t] of Object.entries(sc.board)) b.board[sq(k)] = { t, id: 700 + sq(k), born: -1 };
  b.incoming = []; b.incomingNext = [];
  const k0 = (window.__sceneN = (window.__sceneN || 0) + 1) * 10;
  b.hand = [sc.piece, 'P', 'P', 'P'].map((t, i) => ({ t, id: 900 + k0 + i, eng: null }));
  b.target = 1e9; b.movesLeft = 9;
  a.screen.banner = null;
  a.screen.sync();
}
// 페이지 안에서: 진 판의 결과 화면에 REPLAY를 띄운다
export function pageResult(replay) {
  const a = window.__app;
  a.newRun({ seed: 11 });
  const r = a.run;
  r.log.push({ ante: 3, blind: 1, kind: 'practice', score: 1840, target: 2400, best: replay.score });
  r.bestReplay = replay;
  r.phase = 'lost';
  a.go('result');
}
