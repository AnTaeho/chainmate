// 숙적(보고서 docs/reports/goty.md): 내 콤보를 끊은 적이 판의 숙적이 된다. 규칙은 sim(battle.js placeNemesis · nemesisCut,
// chain.js takeNemesis, run.js endBattle)에, 수치와 스위치는 tuning.js NEMESIS에. 여기는 화면 글과 단마다의 모습만.
import { NEMESIS } from '../sim/tuning.js';
import { TRAIT_BY_ID } from './traits.js';

// 단 lv(1~3)의 특성(방패 · 파수꾼) · 현상금
export const nemesisTrait = (lv) => TRAIT_BY_ID[NEMESIS.traits[Math.min(NEMESIS.traits.length, lv) - 1]] || null;
export const nemesisBounty = (lv) => NEMESIS.bounty[Math.min(NEMESIS.bounty.length, lv) - 1] || 0;

// 화면 글(영어는 src/data/i18n/en.js). 이름표는 명사형, 알림 「~해요」, 효과 글 「조건: 효과」
export const NEMESIS_TEXT = {
  name: '숙적',                          // 판 위 표시 · 카드의 이름표
  born: '이 적이 숙적이 됐어요',         // 대국 사건 nemesis { kind: 'new' } — 끊은 적의 칸에서
  back: '숙적이 돌아왔어요',             // 숙적이 선 대국을 열 때(run.battle.nem.placed)
  up: '숙적이 더 세졌어요',              // 대국 사건 nemesis { kind: 'up' }
  taken: '숙적을 잡았어요',              // 대국 사건 nemesis { kind: 'taken' }
  bounty: (n) => `잡으면: 상금 +${n}`,  // 숙적 상자의 효과 줄(이긴 대국에만 받는다)
  grow: '또 끊기면 더 세진다',           // 숙적 상자의 둘째 줄(단이 NEMESIS.max면 빼기)
};
