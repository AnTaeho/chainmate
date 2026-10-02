// 옛 저장의 뺀 기물(CHM-55: 대주교 A · 재상 C · 야간기사 H · 메뚜기 G)을 새 기물로 바꿔 읽는다(pieces.js OLD_PIECE).
// 판(주머니 · 대국 판 · 손 · 사슬 · 상점 · 꾸러미 · 기록 줄) · 기록(가장 큰 한 수 · 탁월수) · 사람 판 기록 어디에 남았든 같은 길로 바꾼다.
// 기물 id가 사는 자리를 열쇠로 알아본다 — 칸 번호(수)와 다른 글자 id(혼 · 격언 · 세력 …)는 건드리지 않는다.
import { OLD_PIECE } from '../data/pieces.js';

// 값이 기물 id 하나인 열쇠(capture의 from · to는 칸 번호라 수일 때는 그대로 — 진화 사건의 from · to만 글자)
const ONE = new Set(['t', 'form', 'piece', 'dropType', 'from', 'to', 'after', 'promoteTo', 'prev']);
// 기물 id 배열인 열쇠
const LIST = new Set(['forms', 'steps', 'pieces', 'fairies', 'absorbed', 'traitors', 'offered', 'becomes']);
// 기물 id를 열쇠로 쓰는 표(같은 새 id로 모이면 더한다)
const TABLE = new Set(['worn', 'took', 'mix', 'unique', 'reinforceMix']);
// 기물 글자 줄(사슬 요약 caps · 먹을 때의 모습 took)
const LETTERS = new Set(['caps', 'took']);

const swap = (x) => (typeof x === 'string' && OLD_PIECE[x] ? OLD_PIECE[x] : x);

function walk(v, key) {
  if (Array.isArray(v)) {
    if (LIST.has(key)) return v.map((x) => (typeof x === 'string' ? swap(x) : walk(x, null)));
    return v.map((x) => walk(x, null));
  }
  if (v && typeof v === 'object') {
    if (TABLE.has(key)) {
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        const nk = swap(k);
        out[nk] = typeof x === 'number' && typeof out[nk] === 'number' ? out[nk] + x : walk(x, k);
      }
      return out;
    }
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = walk(x, k);
    return out;
  }
  if (typeof v === 'string') {
    if (ONE.has(key)) return swap(v);
    if (LETTERS.has(key)) return [...v].map(swap).join('');
    // 주머니 요약 줄(runlog · 하네스 deck: 「A B:gold C」)
    if (key === 'deck') return v.split(' ').map((w) => { const [t, ...rest] = w.split(':'); return [swap(t), ...rest].join(':'); }).join(' ');
  }
  return v;
}

// 뺀 기물 id가 하나라도 있나(없으면 저장을 그대로 둔다 — 새 저장은 손대지 않는다)
const OLD_RE = new RegExp(`"(?:${Object.keys(OLD_PIECE).join('|')})"|"caps":"[^"]*[${Object.keys(OLD_PIECE).join('')}]`);
export const hasOldPieces = (obj) => obj != null && OLD_RE.test(JSON.stringify(obj));

// 판 · 기록 · 사람 판 기록 무엇이든: 바꾼 새 객체를 돌려준다(옛 것이 없으면 받은 그대로)
export function renameOldPieces(obj) {
  if (!hasOldPieces(obj)) return obj;
  return walk(obj, null);
}
