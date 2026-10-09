// 낱말 풀이: 사람이 만나는 말과 그 한 문장 풀이(docs/design-notes/voice.md · terms.md). 풀이는 여기 한 곳에만 둔다 —
// 글 안에서 빛깔로 두드러지는 낱말 · 카드 옆 낱말 상자 · 낱말 풀이 화면 · 대국 상자 말풍선이 같은 표를 쓴다.
//   re / en   글 안에서 찾는 꼴(한국어 · 영어). null이면 글 안에서 찾지 않고, 구역이 이름으로 넘길 때만(수 · 손 · 판처럼 흔한 말)
//   group     낱말 풀이 화면의 탭: battle 대국 · run 판 · item 물건 · set 시너지
//   풀이(say · enSay)는 낱말 상자(너비 170)에 세 줄 안으로 들어가게 짧게.
// 시너지 이름(「불굴 시너지」)은 같은 자리에서 시작하는 짧은 낱말(시너지)보다 먼저 둔다(splitTerms는 앞의 것을 고른다).
import { wrap } from '../render/text.js';
import { PAL } from '../render/palette.js';
import { text, measure, box, rect } from '../render/gfx.js';
import { L, getLang } from './lang.js';
import { PAD_BOX, GAP_GROUP, flow } from './frame.js';
import { openBox, closeBox, logClip } from '../render/layoutlog.js';

const T = (id, group, word, enWord, re, en, say, enSay, basic = false) => ({ id, group, word, enWord, re, en, say, enSay, basic });
// 기본 낱말(basic): 첫 수업이 가르치는 말. 글 안에서 빛깔을 받지 않고 카드 옆 상자도 띄우지 않는다(docs/design-notes/voice.md).
//   값 · 배수 칸처럼 그 낱말 자체를 가리킬 때({ id } 꼴로 넘길 때)만 상자가 뜬다.
const B = (...a) => T(...a, true);
export const TERMS = [
  // ── 시너지(옛 모음 · 가족): 이름은 명사 하나. 글 안에서는 「기사 시너지」 꼴만 찾는다(「기사도」 · 「야간기사」에 걸리지 않게)
  T('fam_leap', 'set', '기사 시너지', 'Rider', /기사 시너지/, /\bRider synergy\b/i, '나이트처럼 뛰어서 먹을수록 점수가 커진다', 'Grows with every take that leaps like a knight'),
  T('fam_line', 'set', '성채 시너지', 'Fortress', /성채 시너지/, /\bFortress synergy\b/i, '가로 · 세로로 길게 미끄러질수록 점수가 커진다', 'Grows as you slide far in straight lines'),
  T('fam_diag', 'set', '사제 시너지', 'Cleric', /사제 시너지/, /\bCleric synergy\b/i, '대각선으로 먹을 때 값 · 배수가 붙는다', 'Diagonal takes earn Value and Mult'),
  T('fam_change', 'set', '변신 시너지', 'Shift', /변신 시너지/, /\bShift synergy\b/i, '모습이 자주 바뀔수록 점수가 커진다', 'Grows as your form keeps changing'),
  T('fam_sacrifice', 'set', '불굴 시너지', 'Resolve', /불굴 시너지/, /\bResolve synergy\b/i, '사슬이 끊겨도 점수가 커진다', 'Broken chains still score big'),
  T('fam_crown', 'set', '왕관 시너지', 'Crown', /왕관 시너지/, /\bCrown synergy\b/i, '프로모션 · 퀸 · 체크메이트에 점수가 붙는다', 'Promotions, queens and checkmates score more'),
  T('fam_march', 'set', '행진 시너지', 'March', /행진 시너지/, /\bMarch synergy\b/i, '폰으로 시작한 사슬이 커진다', 'Chains started by a pawn grow bigger'),
  T('fam_hunt', 'set', '사냥 시너지', 'Hunt', /사냥 시너지/, /\bHunt synergy\b/i, '같은 종류의 적을 잇달아 먹으면 점수가 커진다', 'Grows as you take the same kind in a row'),
  T('fam_counter', 'set', '역습 시너지', 'Counter', /역습 시너지/, /\bCounter synergy\b/i, '지키는 적을 먹을수록 점수가 커진다', 'Grows as you take guards'),
  T('fam_ambush', 'set', '매복 시너지', 'Ambush', /매복 시너지/, /\bAmbush synergy\b/i, '증원을 먹고 증원 자리에 놓을수록 점수가 커진다', 'Grows as you take recruits and drop where they arrive'),
  T('set', 'set', '시너지', 'Synergy', /시너지/, /\bsynerg(?:y|ies)\b/i, '같은 시너지를 2 · 4 · 6개 모으면 효과가 하나씩 켜진다', 'Collect 2, 4 and 6 of one synergy to switch on its effects'),
  // ── 대국
  B('drop', 'battle', '놓기', 'Drop', /놓[기는을으아았]\S*/, /\bdrop\w*/i, '적을 먹을 수 있는 안전한 빈칸에 손의 기물을 놓는다', 'Place a piece from your hand on a safe empty square with prey in reach'),
  B('chain', 'battle', '사슬', 'Chain', /사슬/, /\bchains?\b/i, '놓은 기물이 한 수 동안 적을 잇달아 먹는 것', 'Every take one dropped piece makes in a move'),
  B('value', 'battle', '값', 'Value', /값/, /\bvalue\b/i, '먹은 적의 값을 더한 수. 폰 10 · 나이트 30 · 룩 50 · 퀸 90', 'What the chain took, added up. Pawn 10 · knight 30 · rook 50 · queen 90'),
  B('links', 'battle', '배수', 'Mult', /배수/, /\bmult\b/i, '먹을 때마다 +1. 점수 = 값 × 배수', '+1 with every take. Score = Value × Mult'),
  B('form', 'battle', '모습', 'Form', /모습/, /\bforms?\b/i, '내 기물이 지금 어떤 기물인지. 그 기물의 행마로 먹는다', 'What your piece is now. It takes with that move'),
  B('change', 'battle', '갈아입기', 'Change', /갈아입\S*/, /\bchanges? form\b/i, '적을 먹으면 그 적과 같은 기물이 된다', 'Take an enemy and become that piece'),
  T('threat', 'battle', '지키는 적', 'Guard', /지키는 적|지키던 적|지켜진 \S+/, /\bguard\w*/i, '방금 먹은 칸을 지키는 적. 다음엔 이 적을 먹어야 이어진다', 'An enemy guarding the square you just took. Take it next to keep going'),
  T('cut', 'battle', '끊김', 'Break', /끊[김긴기겨]\S*/, /\bbreaks?\b|\bbroken\b/i, '지키는 적을 못 먹으면 사슬이 끝난다. 그때까지 점수는 받는다', 'Miss a guard and the chain ends. You keep the score so far'),
  T('promote', 'battle', '프로모션', 'Promotion', /프로모션\S*/, /\bpromot\w*/i, '폰 모습으로 여덟째 줄에 가면 퀸이 된다', 'A pawn that reaches the 8th rank becomes a queen'),
  T('mate', 'battle', '체크메이트', 'Checkmate', /체크메이트|(?<!체인)메이트/, /\b(?:check)?mat(?:e|ing)\b/i, '지키는 적이 없는 킹을 먹으면 곧바로 이긴다', 'Take an unguarded king and win at once'),
  T('reinforce', 'battle', '증원', 'Recruit', /증원/, /\brecruits?\b/i, '수가 끝날 때 ▼ 그림자 자리로 들어오는 새 적', 'A new enemy that arrives on a ▼ shadow when the move ends'),
  B('move', 'battle', '수', 'Move', null, null, '기물 하나를 놓고 사슬이 끝나면 한 수. 대국마다 횟수가 정해져 있다', 'One drop and its chain. Each match gives you a set number'),
  B('hand', 'battle', '손', 'Hand', null, null, '지금 손에 든 기물. 덱에서 뽑는다', 'The pieces you hold, drawn from your deck'),
  B('bag', 'battle', '덱', 'Deck', /덱/, /\bdeck\b/i, '이번 판에 가진 기물 전부', 'Every piece you own this run'),
  B('swap', 'battle', '희생', 'Sacrifice', /희생(?! 시너지)/, /\bsacrific(?:e|es|ed)\b(?! synergy)/i, '손의 기물 하나를 내주고 새로 뽑는다. 그 기물은 이번 대국에 돌아오지 않는다', 'Give up a piece in hand and draw anew. It stays out for this match'),
  T('brilliant', 'battle', '탁월수', 'Brilliant', /탁월수/, /\bBrilliant\b/, '희생하고 새로 뽑은 기물로 곧바로 체크메이트. 희생한 기물이 무거울수록 배수가 크게 곱해진다. 명경기 조각도 하나 얻는다', 'Checkmate at once with the piece a sacrifice drew. The heavier the piece you gave up, the bigger the Mult. Also earns a Classic Fragment'),
  B('goal', 'battle', '목표', 'Target', null, null, '대국을 이기는 점수', 'The score that wins the match'),
  // ── 판
  T('run', 'run', '판', 'Run', null, null, '1관부터 8관까지의 한 도전. 지면 처음부터', 'One attempt from Hall 1 to Hall 8. Lose it and start over'),
  T('hall', 'run', '관', 'Hall', null, null, '연습 대국 · 정식 대국 · 마스터전. 8관까지', 'A practice, a rated and a master match. Eight halls in all'),
  T('match', 'run', '대국', 'Match', null, null, '목표 점수를 넘기면 이기는 한 번의 승부', 'One game you win by reaching the Target'),
  T('faction', 'run', '세력', 'Faction', null, null, '관 하나를 차지한 적. 세력마다 나오는 적 · 버릇 · 마스터가 다르다', 'The foe holding a hall. Each brings its own enemies, habit and master'),
  T('habit', 'run', '버릇', 'Habit', null, null, '세력의 작은 규칙. 그 관의 대국 셋에 모두 붙는다', 'A light rule a faction sets on all three matches in its hall'),
  T('master', 'run', '마스터', 'Master', /마스터(?:전)?/, null, '세력의 우두머리. 관의 마지막 대국에 특수 규칙 하나를 붙인다', 'The faction\'s leader. Bends one rule in the hall\'s last match'),
  B('money', 'run', '상금', 'Purse', null, null, '상점에서 쓰는 돈. 대국을 이기면 받는다', 'Money for the shop. Win matches to earn it'),
  T('pack', 'run', '팩', 'Bundle', /팩/, /\bbundles?\b/i, '열면 셋 중 하나를 고른다', 'Open it and keep one of three'),
  T('scroll', 'run', '두루마리', 'Scroll', /두루마리/, /\bscrolls?\b/i, '사 두었다가 쓰는 물건 칸', 'Slots for things you buy now and use later'),
  T('golden', 'run', '금빛 적', 'Golden enemy', /금빛 적/, /\bgolden (?:enemy|enemies|piece)\b/i, '값을 두 번 주는 적. 이기면 금빛 팩', 'Its Value counts twice. Win for a golden bundle'),
  T('trait', 'run', '특성', 'Trait', /특성/, /\btraits?\b/i, '4관부터 적 발밑에 붙는 작은 문양', 'A small mark at an enemy\'s feet, from Hall 4 on'),
  T('wall', 'run', '벽', 'Wall', null, null, '먹을 수 없는 돌. 미끄러지는 길을 막는다', 'A stone you cannot take. It blocks sliding pieces'),
  T('gem', 'run', '보석', 'Gem', /보석/, /\bgems?\b/i, '먹으면 상금 +2. 모습은 안 바뀐다', 'Take it for +$2. Your form stays'),
  T('step', 'run', '발판', 'Golden step', /발판/, /\bgolden steps?\b/i, '레퍼토리 「발판」의 금빛 칸. 그 칸의 적을 먹으면 배수 ×2', 'Gold squares from the Stepping Stones repertoire. Take on one: ×2 Mult'),
  // ── 물건
  T('maxim', 'item', '격언', 'Maxim', /격언/, /\bmaxims?\b/i, '사면 판 내내 효과를 낸다', 'Buy it once and it works all run'),
  T('chart', 'item', '기보', 'Tome', /(?<!불멸의 )기보/, /\btomes?\b/i, '모습 하나의 단계를 올린다. 그 모습으로 먹을 때마다 값과 배수를 더 받는다', 'Levels up one form. Takes in that form earn more'),
  T('engraving', 'item', '각인', 'Engraving', /각인/, /\bengrav\w*/i, '기물 하나에 새긴다. 그 기물로 시작한 사슬에서 효과를 낸다', 'Carved into one piece. Works on chains it starts'),
  T('soul', 'item', '혼', 'Soul', /혼(?=$|[\s이을은의]|이나)/, /\bsouls?\b/i, '기물 하나에 붙는 특별한 규칙', 'A special rule that lives in one piece'),
  T('joseki', 'item', '레퍼토리', 'Repertoire', /레퍼토리/, /\brepertoires?\b/i, '1 · 3 · 5관 앞에서 고르는 큰 선택. 판 끝까지 간다', 'A big pick before Halls 1, 3 and 5. Lasts all run'),
  T('tactic', 'item', '전술', 'Tactic', /전술/, /\btactics?\b/i, '놓기 전에 눌러 한 번 쓴다', 'Tap it before you drop to use it once'),
  T('evolve', 'item', '진화', 'Evolve', /진화/, /\bevol\w*/i, '체스 기물 하나를 특수 기물로 키운다', 'Turns one chess piece into a special piece'),
  T('fairy', 'item', '특수 기물', 'Special piece', /특수 기물/, /\bspecial pieces?\b/i, '체스에 없는 행마를 가진 기물', 'A piece with a move chess does not have'),
  // 특수 기물 다섯(CHM-55): 행마가 체스와 크게 달라 글 안에서 만나면 상자로 풀어 준다
  T('p_T', 'item', '꺾쇠', 'Bracket', /꺾쇠/, /\bbrackets?\b/i, '룩처럼 가다가 빈칸에서 직각으로 두 번까지 꺾을 수 있다', 'Slides like a rook and may turn up to twice at right angles on empty squares'),
  T('p_E', 'item', '물수제비', 'Skipper', /물수제비/, /\bskippers?\b/i, '비숍처럼 가다가 판 끝에서 튕긴다. 두 번까지', 'Slides like a bishop and bounces off the board edge, up to twice'),
  T('p_V', 'item', '까마귀', 'Crow', /까마귀/, /\bcrows?\b/i, '대각선으로 붙은 적을 넘어 먹고 그 뒤 빈칸에 선다. 모습이 바뀌어도 계속 넘는다', 'Jumps a diagonal neighbor to take it and lands beyond. Keeps jumping even after its form changes'),
  T('p_M', 'item', '광대', 'Jester', /광대/, /\bjesters?\b/i, '적을 그 적의 행마로 먹는다(룩은 룩처럼, 나이트는 나이트처럼)', "Takes each enemy with that enemy's own move (a rook like a rook, a knight like a knight)"),
  T('p_D', 'item', '화약병', 'Powder', /화약병/, /\bpowder\b/i, '붙은 적을 먹으면 그 주변의 적도 터진다. 사슬은 거기서 끝난다', 'Takes one square away and blows up the enemies around it. The chain ends there'),
  T('edition', 'item', '판본', 'Edition', /판본/, /\beditions?\b/i, '격언에 드물게 붙는 빛깔. 효과가 하나 더 붙는다', 'A rare finish on a maxim. It adds one more effect'),
  T('fragment', 'item', '명경기 조각', 'Fragment', /명경기 조각/, /\bfragments?\b/i, '전설 격언의 조각. 셋을 모으면 전설', 'Part of a legendary maxim. Three make the legend'),
  T('feat', 'item', '재현', 'Reenactment', /재현/, /\breenact\w*/i, '명경기의 한 장면을 대국에서 해내는 것. 해내면 둘째 조각을 받는다', 'Pull off a moment from a classic game. Earns the second fragment'),
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
// { skip: id }는 그 낱말을 빼라는 표시다(카드가 자기 종류 낱말을 효과 글에 품고 있을 때 — parts.js itemKeys).
export function termsIn(list) {
  const out = [];
  const skip = new Set(list.filter((s) => s && typeof s === 'object' && s.skip).map((s) => s.skip));
  const push = (id) => { if (id && TERM_BY_ID[id] && !out.includes(id) && !skip.has(id)) out.push(id); };
  for (const s of list) {
    if (!s) continue;
    if (typeof s === 'object') { push(s.id); continue; }
    for (const [, id] of splitTerms(L(String(s)))) if (id && !TERM_BY_ID[id].basic) push(id);
  }
  return out;
}
export const KEY_MAX = 2; // 카드 하나에 상자 둘까지
const keyLines = (id, w) => wrap(termSay(id), w - PAD_BOX * 2);
// 낱말 상자 자리: 낱말(제목 줄) → 묶음 틈 → 풀이 줄들. 재기와 그리기가 같이 쓴다
// maxH: 자리 규칙이 준 높이(placement.js clip). 넘치면 뒤의 줄부터 빼고 「…」 한 줄로 마친다(말풍선과 같다)
function keyLayout(id, w, maxH = Infinity) {
  const all = keyLines(id, w);
  const make = (src) => {
    const f = flow(PAD_BOX);
    const words = wrap(termWord(id), w - PAD_BOX * 2, true).map((l) => [l, f.line(true)]);
    f.gap(GAP_GROUP);
    const lines = src.map((l) => [l, f.line()]);
    return { words, lines, h: f.y + PAD_BOX };
  };
  let lay = make(all);
  for (let k = all.length - 1; k >= 0 && lay.h > maxH; k--) lay = make([...all.slice(0, k), '…']);
  return lay;
}
// 낱말 상자 높이(폭 w). 폭은 설명 묶음이 정한다(말풍선과 같은 폭 — placement.js)
export const keyHeight = (id, w, maxH = Infinity) => keyLayout(id, w, maxH).h;
// 상자에 띄울 낱말: 앞에서 KEY_MAX개, 가리킨 낱말(hot)은 꼭 넣는다
export function keyList(ids, hot = null, max = KEY_MAX) {
  let list = ids.slice(0, max);
  if (hot && ids.includes(hot) && !list.includes(hot)) list = [...list.slice(0, max - 1), hot];
  return list;
}
// 낱말 상자 하나를 (x, y)에 폭 w로. 그린 네모를 돌려준다(연기 시험이 센다).
// note: 낱말 옆에 붙이는 지금 값(시너지 상자의 「5/6」 — 판 틀에서 설명이 왼쪽 칸의 시너지 줄을 덮으므로)
export function drawKeyBox(ctx, id, x, y, w, hot = false, note = null, maxH = Infinity) {
  const lay = keyLayout(id, w, maxH), h = lay.h, P = PAD_BOX;
  openBox('note', x, y, w, h, P, { overlay: true, name: `낱말 ${id}` });
  // 말풍선과 같은 카드 빛깔(한 묶음): 뒤 판넬(어두운 초록)과 톤이 갈린다. 낱말은 말풍선 글 속 낱말과 같은 짙은 금빛
  box(ctx, x, y, w, h, PAL.card, hot ? PAL.gold : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  for (const [l, ly] of lay.words) text(ctx, l, x + P, y + ly, PAL.goldDk, { bold: true });
  const last = lay.words[lay.words.length - 1];
  if (note && last && measure(last[0], true) + 6 + measure(note) <= w - P * 2) text(ctx, note, x + w - P, y + last[1], PAL.cardInk, { align: 'right' });
  for (const [l, ly] of lay.lines) text(ctx, l, x + P, y + ly, PAL.cardInk);
  const cut = lay.lines.some(([l]) => l === '…');
  if (cut) logClip('cut', termWord(id), '…', w); // 자리 높이로 자른 낱말 상자(CHM-34 — 설계)
  closeBox();
  return { id, x, y, w, h, cut };
}
