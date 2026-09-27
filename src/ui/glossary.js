// 낱말 풀이: 세계의 말 중 처음 보는 사람이 막히는 낱말 열한 개. 글 안에서 빛깔로 두드러지고, 가리키면(누르면) 한 줄 풀이.
// 풀이는 여기 한 곳에만 둔다(카드 · 말풍선 · 수업 목록이 같은 표를 쓴다).
import { wrap } from '../render/text.js';
import { PAL } from '../render/palette.js';
import { text, measure } from '../render/gfx.js';
import { L, getLang } from './lang.js';

export const TERMS = [
  { id: 'drop', word: '떨구기', re: /떨[구군궈굴]\S*/, en: /\bdrop\w*/i, say: '손의 기물을 판에 내려놓는다 — 그 자리에서 먹을 적이 닿는 칸에만' },
  { id: 'chain', word: '사슬', re: /사슬/, en: /\bchains?\b/i, say: '떨군 기물이 잇달아 먹는 한 줄 — 먹을 적이 없으면 끝난다' },
  { id: 'value', word: '값', re: /값/, en: /\bvalue\b/i, say: '사슬에서 먹은 적의 값을 더한 수(폰 10 · 나이트 30 · 룩 50 · 퀸 90)' },
  { id: 'links', word: '연쇄', re: /연쇄/, en: /\blinks?\b/i, say: '먹을 때마다 1씩 느는 수 — 점수 = 값 × 연쇄' },
  { id: 'form', word: '모습', re: /모습/, en: /\bform\b/i, say: '사슬 도중 내 기물이 지금 입은 기물 — 먹은 적의 모습이 된다' },
  { id: 'threat', word: '노림수', re: /노림수|노려\S*|노리는/, en: /\bthreat\w*|\bguard\w*/i, say: '방금 먹은 칸을 노리는 적 — 다음에는 그 적을 먹어야 한다' },
  { id: 'reply', word: '응수', re: /응수/, en: /\brepl(?:y|ies)\b/i, say: '노림수를 먹어 사슬을 잇는 것' },
  { id: 'cut', word: '끊김', re: /끊[김긴기겨]\S*/, en: /\bbreaks?\b|\bbroken\b/i, say: '노림수를 지금 모습으로 먹지 못하면 사슬이 끝나고 내 기물은 되잡힌다' },
  { id: 'reinforce', word: '증원', re: /증원/, en: /\breinforce\w*/i, say: '수가 끝날 때마다 점선 그림자 자리로 들어오는 적' },
  { id: 'mate', word: '외통', re: /외통/, en: /\b(?:check)?mate\b/i, say: '지키는 적이 없는 킹을 먹는다 — 점수와 상관없이 곧바로 이긴다' },
  { id: 'bag', word: '주머니', re: /주머니/, en: /\bbag\b/i, say: '이번 판의 내 기물들 — 손은 여기서 뽑는다' },
];
export const TERM_BY_ID = Object.fromEntries(TERMS.map((t) => [t.id, t]));

// 한 줄을 [조각, 낱말 id | null]로 가른다(옮긴 뒤의 글에서)
export function splitTerms(s) {
  const en = getLang() === 'en';
  const out = [];
  let rest = s;
  while (rest) {
    let best = null;
    for (const t of TERMS) {
      const m = (en ? t.en : t.re).exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { t, m };
    }
    if (!best) { out.push([rest, null]); break; }
    if (best.m.index) out.push([rest.slice(0, best.m.index), null]);
    out.push([best.m[0], best.t.id]);
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

export const termTip = (id) => ({ title: L(TERM_BY_ID[id].word), lines: wrap(L(TERM_BY_ID[id].say), 160).map((l) => [l, PAL.cardInk]), w: 170 });

// 낱말을 두드러지게 한 줄. ui와 under(밑 구역: 누르기 · 켜짐을 물려받는다)가 있으면 낱말마다 풀이 구역을 단다.
export function richText(ctx, s, x, y, col, { termCol = PAL.goldDk, ui = null, under = null, bold = false } = {}) {
  s = L(String(s));
  let xx = x;
  for (const [part, id] of splitTerms(s)) {
    const w = measure(part, bold);
    text(ctx, part, xx, y, id ? termCol : col, { bold });
    if (id && ui) ui.region(`term:${id}:${Math.round(xx)}:${y}`, xx, y, w, 12, { onClick: under ? under.onClick : null, enabled: !(under && under.enabled === false), tip: () => termTip(id) });
    xx += w;
  }
  return xx - x;
}
