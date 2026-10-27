// 대국 도전(docs/ideas/goty.md 1 · 보고서 docs/reports/goty.md): 연습 · 정식 대국마다 콤보 하나로 이루는 과제가 하나 붙는다.
// 이기는 데는 필요 없고, 이루면 대국이 끝날 때 상금을 받는다. 판정은 끝난 콤보 요약(chain.js chainSummary) 하나로만 —
// 대국(battle.js endMove)과 봇의 줄 평가(tools/bot.mjs chaseRank)가 같은 check를 쓴다.
//   id · weight(뽑힐 무게) · bonus(어려운 도전의 상금 덤, CHALLENGE.reward에 더한다) · param(관, 난수, 세력) → 수치 칸 · check(h, ch) · text(ch) 화면 글(효과 글 「~다」)
//   화면만 쓰는 칸: short(ch) 좁은 자리의 이름표 · count(h) 콤보 중 진행 수(셀 수 있는 도전) · sticks: false(콤보 중에 맞아도 끝날 때 다시 본다)
// 대국 상태에 남는 것은 { id, n?, form?, reward, done }(JSON 왕복 안전). 규칙 코드는 이 표를 id로 찾을 뿐 id마다 갈리지 않는다.
import { int, next } from '../sim/rng.js';
import { CHALLENGE } from '../sim/tuning.js';
import { PIECES } from './pieces.js';

export { CHALLENGE };

// 끝내기 도전의 모습(체스 기물 셋 — 특수 기물 모습은 세력 · 해금에 따라 판에 없을 수 있다)
const END_FORMS = ['N', 'B', 'R'];
// 같은 글자가 가장 길게 잇단 수(같은 종류를 잇달아 잡음)
const runOf = (s) => { let best = 0, k = 0; for (let i = 0; i < s.length; i++) { k = i && s[i] === s[i - 1] ? k + 1 : 1; best = Math.max(best, k); } return best; };
const NUM = { 1: '하나', 2: '둘', 3: '셋', 4: '넷' };
// 「나이트로」 · 「비숍으로」 · 「룩으로」(받침이 없거나 ㄹ이면 「로」)
const withRo = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00, j = c >= 0 && c <= 11171 ? c % 28 : 0; return w + (j === 0 || j === 8 ? '로' : '으로'); };

export const CHALLENGES = [
  // 갈아입기: 떨군 모습까지 세어 서로 다른 모습 n가지(1~3관 4 · 4관 5 · 5관부터 6)
  { id: 'forms', weight: 1, param: (ante) => ({ n: ante >= 5 ? 6 : ante === 4 ? 5 : 4 }), check: (h, ch) => (h.forms || 0) >= ch.n, count: (h) => h.forms || 0, text: (ch) => `한 콤보에서 모습 ${ch.n}가지를 거친다`, short: (ch) => `모습 ${ch.n}가지 거치기` },
  // 잡기: 한 콤보에 n번(관이 오르면 하나씩)
  { id: 'take', weight: 1, param: (ante) => ({ n: 4 + Math.floor((ante - 1) / 2) }), check: (h, ch) => h.captures >= ch.n, count: (h) => h.captures || 0, text: (ch) => `한 콤보에 ${ch.n}번 잡는다`, short: (ch) => `한 콤보에 ${ch.n}번 잡기` },
  // 갈아입기: 콤보가 끝날 때의 모습(하나라도 잡은 콤보) — 콤보 중에 맞아도 끝날 때의 모습만 센다(sticks: false)
  { id: 'end', weight: 1, param: (ante, r) => ({ form: END_FORMS[int(r, END_FORMS.length)] }), check: (h, ch) => h.captures >= 1 && h.end === ch.form, sticks: false, text: (ch) => `${PIECES[ch.form].name} 모습으로 콤보를 끝낸다`, short: (ch) => `${withRo(PIECES[ch.form].name)} 끝내기` },
  // 응수: 지키는 적을 잡은 수(forcedReplies) — 1~2관 하나 · 3관 둘 · 4~5관 셋 · 6관부터 넷
  { id: 'guards', weight: 1, param: (ante) => ({ n: ante <= 2 ? 1 : ante === 3 ? 2 : ante <= 5 ? 3 : 4 }), check: (h, ch) => (h.forced || 0) >= (ch.n ?? 2), count: (h) => h.forced || 0, text: (ch) => `한 콤보에서 지키는 적을 ${NUM[ch.n ?? 2]} 잡는다`, short: (ch) => `지키는 적 ${NUM[ch.n ?? 2]} 잡기` },
  // 프로모션
  { id: 'promote', weight: 1, param: () => ({}), check: (h) => (h.promotions || 0) >= 1, text: () => '콤보 중에 프로모션한다', short: () => '콤보 중 프로모션' },
  // 체크메이트 — 무게 0(뽑지 않는다): 도전을 노리는 봇도 3~6%만 이뤘다(외통은 이미 대국을 끝내고 상금 +3을 준다). 보고서 「버린 안」
  { id: 'mate', weight: 0, param: () => ({}), check: (h) => (h.mates || 0) >= 1, text: () => '킹을 잡아 체크메이트한다', short: () => '킹 잡기' },
  // 사냥: 같은 종류를 n 잇달아 — 1~4관 둘 · 5관부터 셋
  { id: 'same', weight: 1, param: (ante) => ({ n: ante <= 4 ? 2 : 3 }), check: (h, ch) => runOf(h.caps || '') >= (ch.n ?? 3), text: (ch) => `같은 종류의 적을 ${NUM[ch.n ?? 3]} 잇달아 잡는다`, short: (ch) => `같은 종류 ${NUM[ch.n ?? 3]} 잇달아` },
];
export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

// 대국 종류 kind에 도전 하나를 뽑는다(r: 판 시드에서 갈라 낸 난수 — run.js challengeFor). 붙지 않으면 null
export function drawChallenge(r, ante, kind) {
  if (!CHALLENGE.on || !CHALLENGE.kinds.includes(kind)) return null;
  const pool = CHALLENGES.filter((c) => c.weight > 0);
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let x = next(r) * total, pick = pool[pool.length - 1];
  for (const c of pool) { if (x < c.weight) { pick = c; break; } x -= c.weight; }
  return { id: pick.id, ...pick.param(ante, r), reward: CHALLENGE.reward + (pick.bonus || 0), done: false };
}

// 끝난 콤보 요약 h가 도전 ch를 이루나(대국 · 봇 공용)
export const challengeMet = (ch, h) => !!(ch && h && CHALLENGE_BY_ID[ch.id] && CHALLENGE_BY_ID[ch.id].check(h, ch));
// 화면 글(효과 글 「~다」)
export const challengeText = (ch) => (ch && CHALLENGE_BY_ID[ch.id] ? CHALLENGE_BY_ID[ch.id].text(ch) : '');
// 좁은 자리의 이름표(명사형 — 대국 화면 왼쪽 칸 · 관 선택 카드). 온 글은 challengeText
export const challengeShort = (ch) => (ch && CHALLENGE_BY_ID[ch.id] ? CHALLENGE_BY_ID[ch.id].short(ch) : '');
// 콤보 중 진행(화면 — 셀 수 있는 도전만): h는 chainSummary 꼴(콤보 중이면 그 순간까지). { have, need } 또는 null
export function challengeProgress(ch, h) {
  const c = ch && CHALLENGE_BY_ID[ch.id];
  if (!c || !c.count) return null;
  return { have: Math.min(ch.n, c.count(h || {})), need: ch.n };
}
// 콤보 중에 조건이 맞으면 그 콤보가 끝날 때 이룬 것이 되나(끝 모습 도전은 끝날 때의 모습만 센다)
export const challengeSticks = (ch) => !!(ch && CHALLENGE_BY_ID[ch.id] && CHALLENGE_BY_ID[ch.id].sticks !== false);

// 화면 글(UI가 쓸 것 — 영어는 src/data/i18n/en.js). 이름표는 명사형, 알림 「~해요」, 효과 글 「조건: 효과」
export const CHALLENGE_TEXT = {
  name: '도전',                        // 대국 카드 · 대국 화면의 이름표
  done: '도전 성공',                   // 이룬 뒤의 이름표
  reward: (n) => `이루면: 상금 +${n}`, // 도전 글 아래 효과 줄
  toast: '도전을 이뤘어요',            // 이룬 콤보가 끝날 때 알림
  note: '이기는 데는 필요 없어요',     // 처음 볼 때 덧말
  skip: '건너뛰면 이 도전도 사라져요', // 관 선택의 건너뛰기 옆
  purse: '도전 상금',                  // 보상 내역 줄(run.last.reward.challenge · 진 대국은 run.last.challengeMoney)
};
