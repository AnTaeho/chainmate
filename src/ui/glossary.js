// 낱말 풀이: 사람이 만나는 말과 그 한 문장 풀이(docs/design-notes/voice.md · terms.md). 풀이는 여기 한 곳에만 둔다 —
// 글 안에서 빛깔로 두드러지는 낱말 · 카드 옆 낱말 상자 · 낱말 풀이 화면 · 대국 상자 말풍선이 같은 표를 쓴다.
//   re / en   글 안에서 찾는 꼴(한국어 · 영어). null이면 글 안에서 찾지 않고, 구역이 이름으로 넘길 때만(수 · 손 · 판처럼 흔한 말)
//   group     낱말 풀이 화면의 탭: battle 대국 · run 판 · item 물건 · set 시너지
//   풀이(say · enSay)는 낱말 상자(너비 170)에 세 줄 안으로 들어가게 짧게.
// 시너지 이름(「희생 시너지」)은 같은 자리에서 시작하는 짧은 낱말(시너지)보다 먼저 둔다(splitTerms는 앞의 것을 고른다).
import { wrap } from '../render/text.js';
import { PAL } from '../render/palette.js';
import { text, measure, box, rect } from '../render/gfx.js';
import { L, getLang } from './lang.js';

const T = (id, group, word, enWord, re, en, say, enSay, basic = false) => ({ id, group, word, enWord, re, en, say, enSay, basic });
// 기본 낱말(basic): 첫 수업이 가르치는 말. 글 안에서 빛깔을 받지 않고 카드 옆 상자도 띄우지 않는다(docs/design-notes/voice.md).
//   값 · 배수 칸처럼 그 낱말 자체를 가리킬 때({ id } 꼴로 넘길 때)만 상자가 뜬다.
const B = (...a) => T(...a, true);
export const TERMS = [
  // ── 시너지(옛 모음 · 가족): 이름은 명사 하나. 글 안에서는 「기사 시너지」 꼴만 찾는다(「기사도」 · 「야간기사」에 걸리지 않게)
  T('fam_leap', 'set', '기사 시너지', 'Rider synergy', /기사 시너지/, /\bRider synergy\b/i, '나이트처럼 뛰어서 먹을수록 커진다', 'Grows as you take by jumping, like a knight'),
  T('fam_line', 'set', '성채 시너지', 'Castle synergy', /성채 시너지/, /\bCastle synergy\b/i, '가로 · 세로로 길게 미끄러질수록 커진다', 'Grows as you slide far in straight lines'),
  T('fam_diag', 'set', '사제 시너지', 'Cleric synergy', /사제 시너지/, /\bCleric synergy\b/i, '대각선으로 먹을 때 값 · 배수가 붙는다', 'Diagonal takes earn value and mult'),
  T('fam_change', 'set', '변신 시너지', 'Shift synergy', /변신 시너지/, /\bShift synergy\b/i, '모습이 자주 바뀔수록 커진다', 'Grows as your form keeps changing'),
  T('fam_sacrifice', 'set', '희생 시너지', 'Sacrifice synergy', /희생 시너지/, /\bSacrifice synergy\b/i, '사슬이 끊겨도 점수가 커진다', 'Broken chains score big too'),
  T('fam_crown', 'set', '왕관 시너지', 'Crown synergy', /왕관 시너지/, /\bCrown synergy\b/i, '승급 · 퀸 · 외통에 점수가 붙는다', 'Promotion, queens and mate score more'),
  T('fam_march', 'set', '행진 시너지', 'March synergy', /행진 시너지/, /\bMarch synergy\b/i, '폰으로 시작한 사슬이 커진다', 'Chains started by a pawn grow'),
  T('fam_hunt', 'set', '사냥 시너지', 'Hunt synergy', /사냥 시너지/, /\bHunt synergy\b/i, '같은 적을 잇달아 먹으면 커진다', 'Grows as you take the same kind in a row'),
  T('set', 'set', '시너지', 'Synergy', /시너지/, /\bsynerg(?:y|ies)\b/i, '같은 시너지를 2 · 4 · 6개 모으면 효과가 하나씩 켜진다', 'Collect 2, 4 and 6 of one synergy to switch on its effects'),
  // ── 대국
  B('drop', 'battle', '떨구기', 'Drop', /떨[구군궈굴]\S*/, /\bdrop\w*/i, '먹을 적이 닿는 안전한 빈칸에 손의 기물을 놓는다', 'Put a hand piece on a safe empty square with prey in reach'),
  B('chain', 'battle', '사슬', 'Chain', /사슬/, /\bchains?\b/i, '떨군 기물이 한 수에 잇달아 먹는 줄', 'The run of takes one dropped piece makes in a move'),
  B('value', 'battle', '값', 'Value', /값/, /\bvalue\b/i, '먹은 적의 값을 더한 수. 폰 10 · 나이트 30 · 룩 50 · 퀸 90', 'What the chain took, added up. Pawn 10 · knight 30 · rook 50 · queen 90'),
  B('links', 'battle', '배수', 'Mult', /배수/, /\bmult\b/i, '먹을 때마다 +1. 점수 = 값 × 배수', '+1 with every take. Score = value × mult'),
  B('form', 'battle', '모습', 'Form', /모습/, /\bforms?\b/i, '내 기물이 지금 무슨 기물인지. 그 행마로 먹는다', 'Which piece yours is right now. It takes with that move'),
  B('change', 'battle', '갈아입기', 'Change', /갈아입\S*/, /\bchanges? form\b/i, '적을 먹으면 그 적과 같은 기물이 된다', 'Take an enemy and become that piece'),
  T('threat', 'battle', '지키는 적', 'Guard', /지키는 적|지키던 적|지켜진 \S+/, /\bguard\w*/i, '방금 먹은 칸을 지키는 적. 다음엔 이 적을 먹어야 이어진다', 'An enemy guarding the square you just took. Take it next to go on'),
  T('cut', 'battle', '끊김', 'Break', /끊[김긴기겨]\S*/, /\bbreaks?\b|\bbroken\b/i, '지키는 적을 못 먹으면 사슬이 끝나고 기물을 잃는다. 점수는 받는다', 'Miss the guard and the chain ends and your piece is lost. You keep the score'),
  T('promote', 'battle', '승급', 'Promotion', /승급\S*/, /\bpromot\w*/i, '폰 모습으로 맨 윗줄에 닿으면 퀸이 된다', 'A pawn form reaching the top row becomes a queen'),
  T('mate', 'battle', '외통', 'Mate', /외통/, /\b(?:check)?mat(?:e|ing)\b/i, '지키는 적이 없는 킹을 먹으면 곧바로 이긴다', 'Take a king nobody guards and win at once'),
  T('reinforce', 'battle', '증원', 'Reinforcement', /증원/, /\breinforce\w*/i, '수가 끝날 때 ▼ 그림자 자리로 들어오는 새 적', 'New enemies that land on the ▼ shadows when a move ends'),
  B('move', 'battle', '수', 'Move', null, null, '기물 하나를 떨궈 사슬을 푸는 한 번. 대국마다 정해져 있다', 'One drop and its chain. Each match gives a set number'),
  B('hand', 'battle', '손', 'Hand', null, null, '지금 쥔 기물. 주머니에서 뽑는다', 'The pieces you hold, drawn from your bag'),
  B('bag', 'battle', '주머니', 'Bag', /주머니/, /\bbag\b/i, '이번 판에 가진 기물 전부', 'Every piece you own this run'),
  B('swap', 'battle', '버리기', 'Discard', /버리기/, /\bdiscards?\b/i, '손에서 고른 기물을 버리고 새로 뽑는다', 'Throw away the picked pieces and draw new ones'),
  B('goal', 'battle', '목표', 'Target', null, null, '대국을 이기는 점수', 'The score that wins the match'),
  // ── 판
  T('run', 'run', '판', 'Run', null, null, '1관부터 8관까지의 한 도전. 지면 처음부터', 'One try from Hall 1 to Hall 8. Lose and start over'),
  T('hall', 'run', '관', 'Hall', null, null, '연습 · 정식 · 명인 대국 셋. 8관까지', 'Practice, rated and master matches. Eight halls'),
  T('match', 'run', '대국', 'Match', null, null, '목표 점수에 닿아야 이기는 한 번의 겨루기', 'One contest you win by reaching the target'),
  T('master', 'run', '명인', 'Master', /명인/, null, '관마다 마지막 상대. 규칙 하나를 비튼다', 'The last opponent of each hall. Bends one rule'),
  B('money', 'run', '상금', 'Purse', null, null, '상점에서 쓰는 돈. 대국을 이기면 받는다', 'Money for the shop, earned by winning'),
  T('pack', 'run', '꾸러미', 'Bundle', /꾸러미/, /\bbundles?\b/i, '열면 셋 중 하나를 고른다', 'Open it and keep one of three'),
  T('scroll', 'run', '두루마리', 'Scroll', /두루마리/, /\bscrolls?\b/i, '사 두었다가 쓰는 물건 칸', 'Slots for things you buy now and use later'),
  T('golden', 'run', '금빛 적', 'Golden enemy', /금빛 적/, /\bgolden (?:enemy|enemies|piece)\b/i, '값을 두 번 주는 적. 이기면 금빛 꾸러미', 'Its value counts twice. Win for a golden bundle'),
  T('trait', 'run', '특성', 'Trait', /특성/, /\btraits?\b/i, '4관부터 적 발밑에 붙는 작은 문양', 'The small mark at an enemy\'s feet from Hall 4'),
  T('wall', 'run', '벽', 'Wall', null, null, '먹을 수 없는 돌. 미끄러지는 길을 막는다', 'A stone you cannot take. It blocks sliding'),
  T('gem', 'run', '보석', 'Gem', /보석/, /\bgems?\b/i, '먹으면 상금 +2. 모습은 그대로', 'Take it for purse +2. Your form stays'),
  T('step', 'run', '발판', 'Golden step', /발판/, /\bgolden steps?\b/i, '정석 「발판」의 금빛 칸. 그 위 적을 먹으면 배수 ×2', 'Gold squares from the Stepping Stones joseki. Takes there: ×2 Mult'),
  // ── 물건
  T('maxim', 'item', '격언', 'Maxim', /격언/, /\bmaxims?\b/i, '사면 판 내내 효과를 낸다', 'Buy it once and it works all run'),
  T('chart', 'item', '기보', 'Study', /(?<!불멸의 )기보/, /\bstud(?:y|ies)\b|\bcharts?\b/i, '한 모습의 단계를 올린다. 그 모습으로 먹을 때 더 받는다', 'Levels up one form. Takes in that form earn more'),
  T('engraving', 'item', '각인', 'Engraving', /각인/, /\bengrav\w*/i, '기물 하나에 새긴다. 그 기물로 시작한 사슬에 효과', 'Carved into one piece. Works on chains it starts'),
  T('soul', 'item', '혼', 'Soul', /혼(?=$|[\s이을은의]|이나)/, /\bsouls?\b/i, '기물 하나에 깃드는 특별한 규칙', 'A special rule living in one piece'),
  T('joseki', 'item', '정석', 'Joseki', /정석/, /\bjoseki\b/i, '1 · 3 · 5관 앞에서 고르는 큰 선택. 판 끝까지 간다', 'A big pick before Halls 1, 3 and 5. It lasts the whole run'),
  T('tactic', 'item', '묘수', 'Trick', /묘수/, /\btricks?\b/i, '떨구기 전에 눌러 한 번 쓴다', 'Tap it before a drop to use it once'),
  T('evolve', 'item', '진화', 'Evolution', /진화/, /\bevol\w*/i, '체스 기물 하나를 특수 기물로 키운다', 'Grows one chess piece into a special piece'),
  T('fairy', 'item', '특수 기물', 'Special piece', /특수 기물/, /\bspecial pieces?\b/i, '체스에 없는 행마를 가진 기물', 'A piece with a move chess does not have'),
  T('edition', 'item', '판본', 'Edition', /판본/, /\beditions?\b/i, '격언에 드물게 붙는 빛깔. 효과가 하나 더 붙는다', 'A rare finish on a maxim. It adds one more effect'),
  T('fragment', 'item', '명국 조각', 'Fragment', /명국 조각/, /\bfragments?\b/i, '전설 격언의 조각. 셋을 모으면 전설', 'A piece of a legendary maxim. Three make the legend'),
  T('feat', 'item', '재현', 'Reenactment', /재현/, /\breenact\w*/i, '명국의 한 장면을 대국에서 해낸다. 둘째 조각을 준다', 'Pull off a classic game\'s moment. Earns the second fragment'),
];
export const TERM_GROUPS = [['battle', '대국'], ['run', '판'], ['item', '물건'], ['set', '시너지']];
export const TERM_BY_ID = Object.fromEntries(TERMS.map((t) => [t.id, t]));

// 한 줄을 [조각, 낱말 id | null]로 가른다(옮긴 뒤의 글에서)
export function splitTerms(s) {
  const en = getLang() === 'en';
  const out = [];
  let rest = s;
  while (rest) {
    let best = null;
    for (const t of TERMS) {
      const re = en ? t.en : t.re;
      if (!re) continue;
      const m = re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { t, m };
    }
    if (!best) { out.push([rest, null]); break; }
    if (best.m.index) out.push([rest.slice(0, best.m.index), null]);
    out.push([best.m[0], best.t.id]);
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

export const termWord = (id) => (getLang() === 'en' ? TERM_BY_ID[id].enWord : TERM_BY_ID[id].word);
export const termSay = (id) => (getLang() === 'en' ? TERM_BY_ID[id].enSay : TERM_BY_ID[id].say);
export const termTip = (id) => ({ title: termWord(id), body: [], extra: [[termSay(id), PAL.cardInk]], w: 170 });

// 낱말을 두드러지게 한 줄. ui가 있으면 낱말 자리를 적어 둔다(ui.termSpans) — 가리키면 그 낱말 상자가 금빛 테로 켜진다.
// 기본 낱말(떨구기 · 사슬 · 값 · 배수 …)은 빛깔도 자리도 받지 않는다(글이 알록달록해지지 않게).
// 낱말 자리는 누르기 · 가리키기를 가로채지 않는다(밑의 카드가 그대로 받는다). under는 옛 호출과 맞추려고 남겼다.
export function richText(ctx, s, x, y, col, { termCol = PAL.goldDk, ui = null, under = null, bold = false } = {}) {
  s = L(String(s));
  let xx = x;
  for (const [part, id] of splitTerms(s)) {
    const w = measure(part, bold);
    const lit = id && !TERM_BY_ID[id].basic;
    text(ctx, part, xx, y, lit ? termCol : col, { bold });
    if (lit && ui && ui.termSpans) ui.termSpans.push({ id, x: xx, y, w, h: 12 });
    xx += w;
  }
  return xx - x;
}

// ── 낱말 상자(Slay the Spire의 키워드 상자처럼): 카드 · 말풍선 옆에 낱말마다 제목 + 한 문장, 위에서 아래로 쌓는다.
// 글(한국어 글 · 옮긴 글)과 { id } 꼴의 이름을 받아 처음 나온 차례대로 낱말 id를 모은다.
// 글에서 찾은 기본 낱말은 뺀다. { id } 꼴은 그 낱말 자체를 가리킨 것이라(값 · 배수 칸) 기본 낱말이어도 남긴다.
export function termsIn(list) {
  const out = [];
  const push = (id) => { if (id && TERM_BY_ID[id] && !out.includes(id)) out.push(id); };
  for (const s of list) {
    if (!s) continue;
    if (typeof s === 'object') { push(s.id); continue; }
    for (const [, id] of splitTerms(L(String(s)))) if (id && !TERM_BY_ID[id].basic) push(id);
  }
  return out;
}
export const KEY_MAX = 2; // 카드 하나에 상자 둘까지
const keyLines = (id, w) => wrap(termSay(id), w - 10);
// 낱말 상자 높이(폭 w). 폭은 설명 묶음이 정한다(말풍선과 같은 폭 — placement.js)
export const keyHeight = (id, w) => 16 + keyLines(id, w).length * 13 + 3;
// 상자에 띄울 낱말: 앞에서 KEY_MAX개, 가리킨 낱말(hot)은 꼭 넣는다
export function keyList(ids, hot = null, max = KEY_MAX) {
  let list = ids.slice(0, max);
  if (hot && ids.includes(hot) && !list.includes(hot)) list = [...list.slice(0, max - 1), hot];
  return list;
}
// 낱말 상자 하나를 (x, y)에 폭 w로. 그린 네모를 돌려준다(연기 시험이 센다).
// note: 낱말 옆에 붙이는 지금 값(시너지 상자의 「5/6」 — 판 틀에서 설명이 왼쪽 칸의 시너지 줄을 덮으므로)
export function drawKeyBox(ctx, id, x, y, w, hot = false, note = null) {
  const h = keyHeight(id, w);
  box(ctx, x, y, w, h, '#16231f', hot ? PAL.gold : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, '#2a3a33');
  text(ctx, termWord(id), x + 5, y + 2, PAL.gold, { bold: true });
  if (note && measure(termWord(id), true) + 6 + measure(note) <= w - 10) text(ctx, note, x + w - 5, y + 2, PAL.ink, { align: 'right' });
  keyLines(id, w).forEach((l, k) => text(ctx, l, x + 5, y + 16 + k * 13, PAL.ink));
  return { id, x, y, w, h };
}
