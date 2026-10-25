// 업적: 판 밖에 남는 배지(힘은 남기지 않는다 — 받는 것은 배지와 팡파르뿐). 모두 뿌리의 동사나 판의 걸음에 매단다.
// 필드: id · name(명사형) · text(조건 「~다」) · have(기록) → 지금 값 · need(닿을 값, 2 이상이면 화면에 「N/M」) · secret(받기 전엔 「?」)
// have는 기록(app.records)만 읽는다 — 한 콤보 안의 것은 src/ui/achievements.js noteFeats가 records.feats에 먼저 적는다.
import { MASTERS } from './masters.js';
import { LEGENDS } from './legends.js';
import { FAMILIES } from './families.js';
import { OPENINGS } from './openings.js';

const F = (r, k) => ((r.feats || {})[k]) || 0;
const G = (r, mark) => ((r.grades || {})[mark]) || 0;
const on = (o) => Object.values(o || {}).filter(Boolean).length;
const yes = (b) => (b ? 1 : 0);
const bestScore = (r) => Math.max(F(r, 'score'), r.bestMove ? r.bestMove.score || 0 : 0);
const danWon = (r, d) => yes(Object.entries(r.danWins || {}).some(([k, n]) => Number(k) >= d && n > 0));
const OPENING_IDS = Object.keys(OPENINGS);
export const SYNERGY_TOP = 5;

export const ACHIEVEMENTS = [
  // 잡기 · 콤보
  { id: 'combo3', name: '좋은 수', text: '한 수에 적 셋을 잡는다', have: (r) => G(r, '★'), need: 1 },
  { id: 'combo5', name: '전술', text: '한 수에 적 다섯을 잡는다', have: (r) => G(r, '★★'), need: 1 },
  { id: 'combo8', name: '신의 한 수', text: '한 수에 적 여덟을 잡는다', have: (r) => G(r, '★★★'), need: 1 },
  { id: 'combo12', name: '불멸', text: '한 수에 적 열둘을 잡는다', have: (r) => G(r, '∞'), need: 1 },
  // 갈아입기
  { id: 'forms3', name: '세 얼굴', text: '한 콤보에서 모습 셋을 거친다', have: (r) => yes(F(r, 'forms') >= 3), need: 1 },
  { id: 'forms5', name: '다섯 얼굴', text: '한 콤보에서 모습 다섯을 거친다', have: (r) => yes(F(r, 'forms') >= 5), need: 1 },
  { id: 'forms6', name: '천의 얼굴', text: '한 콤보에서 모습 여섯을 거친다', have: (r) => yes(F(r, 'forms') >= 6), need: 1 },
  // 응수 · 끊김
  { id: 'replies3', name: '맞받아치기', text: '한 콤보에서 지키는 적을 셋 잡는다', have: (r) => yes(F(r, 'replies') >= 3), need: 1 },
  { id: 'unbroken', name: '꺾이지 않는 수', text: '끊길 자리에서 콤보를 잇는다', have: (r) => F(r, 'unbroken'), need: 1 },
  // 프로모션
  { id: 'promote1', name: '첫 퀸', text: '폰 모습으로 끝줄에 닿아 프로모션한다', have: (r) => yes(F(r, 'promos') >= 1), need: 1 },
  { id: 'promote2', name: '두 번의 퀸', text: '한 콤보에서 프로모션을 두 번 한다', have: (r) => yes(F(r, 'promos') >= 2), need: 1 },
  // 체크메이트
  { id: 'mate1', name: '체크메이트', text: '체크메이트로 대국을 이긴다', have: (r) => r.mates || 0, need: 1 },
  { id: 'mateFirst', name: '첫 수 메이트', text: '대국의 첫 수로 체크메이트한다', have: (r) => F(r, 'firstMate'), need: 1 },
  { id: 'mate25', name: '킹 사냥꾼', text: '체크메이트로 스물다섯 번 이긴다', have: (r) => r.mates || 0, need: 25 },
  { id: 'brilliant1', name: '탁월수', text: '희생한 바로 다음 수로 체크메이트한다', have: (r) => r.brilliants || 0, need: 1 },
  { id: 'brilliant5', name: '탁월수 다섯', text: '탁월수를 다섯 번 둔다', have: (r) => r.brilliants || 0, need: 5 },
  // 점수
  { id: 'score10k', name: '만 점', text: '한 수로 1만 점을 낸다', have: (r) => yes(bestScore(r) >= 1e4), need: 1 },
  { id: 'score1m', name: '백만 점', text: '한 수로 100만 점을 낸다', have: (r) => yes(bestScore(r) >= 1e6), need: 1 },
  { id: 'score100m', name: '억 점', text: '한 수로 1억 점을 낸다', have: (r) => yes(bestScore(r) >= 1e8), need: 1 },
  { id: 'overflow10', name: '열 배', text: '대국 목표의 열 배를 넘긴다', have: (r) => yes(F(r, 'overflow') >= 10), need: 1 },
  // 판의 걸음: 관 · 마스터 · 레이팅
  { id: 'hall1', name: '첫 관문', text: '1관을 돌파한다', have: (r) => yes((r.bestAnte || 0) >= 2 || (r.wins || 0) > 0), need: 1 },
  { id: 'hall4', name: '반환점', text: '4관을 돌파한다', have: (r) => yes((r.bestAnte || 0) >= 5 || (r.wins || 0) > 0), need: 1 },
  { id: 'master1', name: '첫 마스터', text: '마스터를 처음 이긴다', have: (r) => on(r.mastersBeaten), need: 1 },
  { id: 'master8', name: '마스터 여덟', text: '마스터 여덟을 모두 이긴다', have: (r) => on(r.mastersBeaten), need: MASTERS.length },
  { id: 'chest5', name: '다섯 칸 상자', text: '마스터의 상자에서 다섯 칸을 받는다', have: (r) => yes(F(r, 'chest') >= 5), need: 1 },
  { id: 'runWin', name: '기원의 주인', text: '8관 마스터를 이겨 판을 이긴다', have: (r) => r.wins || 0, need: 1 },
  { id: 'dan4', name: '레이팅 1600', text: '레이팅 1600 이상으로 판을 이긴다', have: (r) => danWon(r, 4), need: 1 },
  { id: 'dan8', name: '레이팅 2400', text: '레이팅 2400으로 판을 이긴다', have: (r) => danWon(r, 8), need: 1 },
  { id: 'openings5', name: '다섯 오프닝', text: '오프닝 다섯으로 모두 판을 이긴다', have: (r) => OPENING_IDS.filter((id) => (r.openingDan || {})[id] != null).length, need: OPENING_IDS.length },
  { id: 'endless12', name: '끝없는 밤', text: '끝없는 대국에서 12관에 닿는다', have: (r) => yes((r.bestEndless || 0) >= 12), need: 1 },
  { id: 'daily', name: '오늘의 승자', text: '오늘의 대국을 8관까지 이긴다', have: (r) => Math.max(F(r, 'daily'), yes(r.daily && r.daily.won)), need: 1 },
  // 전설 · 시너지
  { id: 'legend1', name: '불멸의 기보', text: '명경기 하나를 전설로 완성한다', have: (r) => r.legends || 0, need: 1 },
  { id: 'legend5', name: '명경기 다섯', text: '명경기 다섯을 모두 전설로 완성한다', have: (r) => on((r.codex || {}).legendsDone), need: LEGENDS.length },
  { id: 'synergy1', name: '시너지 완성', text: '시너지 하나를 5까지 모은다', have: (r) => yes(Object.values(r.synergyTop || {}).some((n) => n >= SYNERGY_TOP)), need: 1 },
  { id: 'synergyAll', name: '열 가지 시너지', text: '시너지 열 가지를 모두 5까지 모은다', have: (r) => FAMILIES.filter((f) => ((r.synergyTop || {})[f.id] || 0) >= SYNERGY_TOP).length, need: FAMILIES.length },
  // 숨은 업적(받기 전엔 「?」)
  { id: 'kingTake', name: '킹의 행차', text: '킹 모습으로 적을 잡는다', have: (r) => F(r, 'kingTook'), need: 1, secret: true },
  { id: 'pawnRun', name: '폰의 진군', text: '한 콤보에서 폰 모습으로만 적 다섯을 잡는다', have: (r) => yes(F(r, 'pawnRun') >= 5), need: 1, secret: true },
  { id: 'gomoku', name: '오목', text: '한 줄에 다섯 칸을 밟아 대국을 이긴다', have: (r) => F(r, 'gomoku'), need: 1, secret: true },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
