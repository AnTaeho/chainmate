// 낱말 풀이: 사람이 만나는 말과 그 한 문장 풀이(docs/design-notes/terms.md). 풀이는 여기 한 곳에만 둔다 —
// 글 안에서 빛깔로 두드러지는 낱말 · 카드 옆 낱말 상자 · 낱말 풀이 화면 · 대국 상자 말풍선이 같은 표를 쓴다.
//   re / en   글 안에서 찾는 꼴(한국어 · 영어). null이면 글 안에서 찾지 않고, 구역이 이름으로 넘길 때만(수 · 손 · 판처럼 흔한 말)
//   group     낱말 풀이 화면의 탭: battle 대국 · run 판 · item 물건 · set 모음
//   풀이(say · enSay)는 낱말 상자(너비 170)에 세 줄 안으로 들어가게 짧게.
// 모음 이름(「끊김 모음」 · 「승급 모음」)은 같은 자리에서 시작하는 짧은 낱말(끊김 · 승급)보다 먼저 둔다(splitTerms는 앞의 것을 고른다).
import { wrap } from '../render/text.js';
import { PAL } from '../render/palette.js';
import { text, measure, box, rect } from '../render/gfx.js';
import { L, getLang } from './lang.js';

const T = (id, group, word, enWord, re, en, say, enSay) => ({ id, group, word, enWord, re, en, say, enSay });
export const TERMS = [
  // ── 모음(옛 가족): 이름이 곧 무엇에 점수가 붙는지
  T('fam_leap', 'set', '뛰기 모음', 'Jump set', /뛰기 모음/, /\bJump set\b/i, '나이트처럼 뛰어서 먹을 때 점수가 붙는 모음', 'Scores when you take by jumping, like a knight'),
  T('fam_line', 'set', '가로세로 모음', 'Straight set', /가로세로 모음/, /\bStraight set\b/i, '가로 · 세로로 미끄러져 먹을 때 점수가 붙는 모음', 'Scores when you slide straight to take'),
  T('fam_diag', 'set', '대각선 모음', 'Diagonal set', /대각선 모음/, /\bDiagonal set\b/i, '대각선으로 먹을 때 점수가 붙는 모음', 'Scores when you take diagonally'),
  T('fam_change', 'set', '갈아입기 모음', 'Change set', /갈아입기 모음/, /\bChange set\b/i, '모습이 바뀔 때마다 점수가 붙는 모음', 'Scores each time your form changes'),
  T('fam_sacrifice', 'set', '끊김 모음', 'Break set', /끊김 모음/, /\bBreak set\b/i, '사슬이 끊길 때 점수가 붙고, 끊김을 한 번 넘기는 모음', 'Scores when a chain breaks, and can shrug off one break'),
  T('fam_crown', 'set', '승급 모음', 'Promotion set', /승급 모음/, /\bPromotion set\b/i, '승급 · 퀸 · 외통에 점수가 붙는 모음', 'Scores on promotion, queens and mate'),
  T('fam_march', 'set', '폰 사슬 모음', 'Pawn chain set', /폰 사슬 모음/, /\bPawn chain set\b/i, '폰으로 떨군 사슬에 점수가 붙는 모음', 'Scores on chains dropped by a pawn'),
  T('fam_hunt', 'set', '같은 적 모음', 'Same prey set', /같은 적 모음/, /\bSame prey set\b/i, '같은 종류의 적을 잇달아 먹을 때 점수가 붙는 모음', 'Scores when you take the same kind twice in a row'),
  T('set', 'set', '모음', 'Set', /모음/, /\bsets?\b/i, '같은 모음의 격언 · 특수 기물 · 정석 · 혼을 2 · 4 · 6개 모으면 효과가 하나씩 켜진다', 'Collect 2, 4 and 6 maxims, special pieces, joseki or souls of one set to switch on its effects'),
  // ── 대국
  T('drop', 'battle', '떨구기', 'Drop', /떨[구군궈굴]\S*/, /\bdrop\w*/i, '손의 기물을 판에 놓는 것 — 먹을 적이 닿고, 어느 적도 지키지 않는 빈칸에만', 'Put a hand piece on an empty, unguarded square that reaches prey'),
  T('chain', 'battle', '사슬', 'Chain', /사슬/, /\bchains?\b/i, '떨군 기물이 한 수 안에 잇달아 먹는 줄 — 더 먹을 적이 없으면 끝난다', 'The run of takes your dropped piece makes in one move — it ends when nothing is in reach'),
  T('value', 'battle', '값', 'Value', /값/, /\bvalue\b/i, '사슬에서 먹은 적의 값을 더한 수(폰 10 · 나이트 30 · 룩 50 · 퀸 90)', 'The sum of what the chain took (pawn 10 · knight 30 · rook 50 · queen 90)'),
  T('links', 'battle', '배수', 'Mult', /배수/, /\bmult\b/i, '먹을 때마다 1씩 늘고, 사슬이 끝나면 값에 곱한다 — 점수 = 값 × 배수', 'Rises by 1 with every take and multiplies value when the chain ends — score = value × mult'),
  T('form', 'battle', '모습', 'Form', /모습/, /\bforms?\b/i, '사슬 도중 내 기물이 지금 어떤 기물인지 — 그 기물의 행마로 다음 적을 먹는다', 'Which piece your chain is right now — it takes the next enemy with that piece\'s move'),
  T('change', 'battle', '갈아입기', 'Change', /갈아입\S*/, /\bchanges? form\b/i, '적을 먹으면 내 기물이 그 적과 같은 기물로 바뀌는 것', 'Taking an enemy turns your piece into that same piece'),
  T('threat', 'battle', '지키는 적', 'Guard', /지키는 적|지키던 적|지켜진 \S+/, /\bguard\w*/i, '방금 먹은 칸을 지키는 적(붉은 선) — 다음엔 이 적을 먹어야 사슬이 이어진다', 'An enemy guarding the square you just took (red line) — take it next or the chain breaks'),
  T('cut', 'battle', '끊김', 'Break', /끊[김긴기겨]\S*/, /\bbreaks?\b|\bbroken\b/i, '지키는 적을 지금 모습으로 못 먹으면 사슬이 끝나고 내 기물은 잡힌다(점수는 받는다)', 'If your form cannot take the guard, the chain ends and your piece is taken (you keep the score)'),
  T('promote', 'battle', '승급', 'Promotion', /승급\S*/, /\bpromot\w*/i, '폰 모습으로 맨 윗줄에 닿으면 곧바로 퀸 모습이 된다', 'A pawn form reaching the top row turns into a queen at once'),
  T('mate', 'battle', '외통', 'Mate', /외통/, /\b(?:check)?mat(?:e|ing)\b/i, '지키는 적이 없는 킹을 먹는 것 — 점수와 상관없이 곧바로 이긴다', 'Taking a king nobody guards — you win at once, whatever the score'),
  T('reinforce', 'battle', '증원', 'Reinforcement', /증원/, /\breinforce\w*/i, '수가 끝날 때마다 점선 그림자(▼) 자리로 들어오는 새 적', 'New enemies that land on the dotted shadows (▼) when a move ends'),
  T('move', 'battle', '수', 'Move', null, null, '기물 하나를 떨궈 사슬을 푸는 한 번 — 대국마다 쓸 수 있는 수가 정해져 있다', 'One drop and its chain — each match gives you a set number of moves'),
  T('hand', 'battle', '손', 'Hand', null, null, '지금 쥔 기물들 — 주머니에서 뽑는다', 'The pieces you hold now — drawn from your bag'),
  T('bag', 'battle', '주머니', 'Bag', /주머니/, /\bbag\b/i, '이번 판에 가진 기물 전부 — 대국마다 섞어 손으로 뽑는다', 'Every piece you own this run — shuffled each match and drawn into your hand'),
  T('swap', 'battle', '바꾸기', 'Redraw', /바꾸기/, /\bredraws?\b/i, '손에서 고른 기물을 버리고 주머니에서 새로 쥐는 것', 'Throw back the pieces you picked from your hand and draw new ones'),
  T('goal', 'battle', '목표', 'Target', null, null, '대국을 이기는 점수 — 수를 다 쓰기 전에 닿아야 한다', 'The score that wins the match — reach it before your moves run out'),
  // ── 판
  T('run', 'run', '판', 'Run', null, null, '1관부터 8관까지 한 번의 도전 전체 — 지면 처음부터', 'One whole try from Hall 1 to Hall 8 — lose and you start over'),
  T('hall', 'run', '관', 'Hall', null, null, '대국 셋(연습 · 정식 · 명인) 묶음 — 8관까지', 'Three matches (practice · rated · master) — eight halls in all'),
  T('match', 'run', '대국', 'Match', null, null, '목표 점수가 있는 한 번의 겨루기', 'One contest with a target score'),
  T('master', 'run', '명인', 'Master', /명인/, null, '관마다 마지막 대국의 상대 — 규칙 하나를 비튼다', 'The last opponent of each hall — bends one rule'),
  T('money', 'run', '상금', 'Purse', null, null, '상점에서 쓰는 돈 — 대국을 이기면 받는다', 'Money for the shop — earned by winning matches'),
  T('pack', 'run', '꾸러미', 'Bundle', /꾸러미/, /\bbundles?\b/i, '열면 물건 셋이 나오고 그중 하나를 고른다', 'Opens into three things — you keep one'),
  T('scroll', 'run', '두루마리', 'Scroll', /두루마리/, /\bscrolls?\b/i, '사 두었다가 쓰는 물건(기보 · 각인 · 혼 · 진화 · 묘수)이 들어가는 칸', 'Slots for things you buy now and use later (studies · engravings · souls · evolutions · tricks)'),
  T('golden', 'run', '금빛 적', 'Golden enemy', /금빛 적/, /\bgolden (?:enemy|enemies|piece)\b/i, '금빛으로 빛나는 적 — 값을 한 번 더 받고, 이기면 금빛 꾸러미', 'A glowing gold enemy — its value counts twice, and winning brings a golden bundle'),
  T('trait', 'run', '특성', 'Trait', /특성/, /\btraits?\b/i, '4관부터 적에게 붙는 성질 — 발밑의 작은 문양', 'A quirk enemies carry from Hall 4 — the small mark at their feet'),
  T('wall', 'run', '벽', 'Wall', null, null, '먹을 수 없는 판 위 돌 — 미끄러지는 길을 막는다', 'A stone on the board you cannot take — it blocks sliding'),
  T('gem', 'run', '보석', 'Gem', /보석/, /\bgems?\b/i, '먹으면 상금 +2 — 먹어도 내 모습은 그대로', 'Take it for Purse +2 — your form stays the same'),
  T('step', 'run', '발판', 'Golden step', /발판/, /\bgolden steps?\b/i, '정석 「발판」이 판에 까는 금빛 칸 — 그 위의 적을 먹으면 배수 ×2', 'Golden squares from the joseki Stepping Stones — takes on them: mult ×2'),
  // ── 물건
  T('maxim', 'item', '격언', 'Maxim', /격언/, /\bmaxims?\b/i, '사면 오른쪽 칸에 붙어 판이 끝날 때까지 늘 효과를 낸다', 'Bought once, it sits in the right-hand column and works for the rest of the run'),
  T('chart', 'item', '기보', 'Study', /(?<!불멸의 )기보/, /\bstud(?:y|ies)\b|\bcharts?\b/i, '한 모습의 단계를 올린다 — 그 모습으로 먹을 때마다 값 · 배수가 더 붙는다', 'Levels up one form — every take in that form adds more value and mult'),
  T('engraving', 'item', '각인', 'Engraving', /각인/, /\bengrav\w*/i, '주머니 기물 하나에 새긴다 — 그 기물로 떨군 사슬이 끝날 때 효과', 'Carved into one piece in your bag — works when a chain it dropped ends'),
  T('soul', 'item', '혼', 'Soul', /혼(?=$|[\s이을은의]|이나)/, /\bsouls?\b/i, '주머니 기물 하나에 깃드는 특별한 규칙 — 그 기물로 떨군 사슬 내내', 'A special rule living in one piece — it holds for every chain that piece drops'),
  T('joseki', 'item', '정석', 'Joseki', /정석/, /\bjoseki\b/i, '1 · 3 · 5관 첫 대국 앞에서 셋 중 하나를 고르는 큰 선택 — 판 끝까지 간다', 'A big pick of one from three before Halls 1, 3 and 5 — it lasts the whole run'),
  T('tactic', 'item', '묘수', 'Trick', /묘수/, /\btricks?\b/i, '대국 중 떨구기 전에 눌러 한 번 쓰는 수', 'Tap it before a drop to use it once in a match'),
  T('evolve', 'item', '진화', 'Evolution', /진화/, /\bevol\w*/i, '주머니의 체스 기물 하나를 특수 기물로 키운다(나이트 › 야간기사 등)', 'Grows one chess piece in your bag into a special piece (knight › nightrider …)'),
  T('fairy', 'item', '특수 기물', 'Special piece', /특수 기물/, /\bspecial pieces?\b/i, '체스에 없는 행마를 가진 기물(대주교 · 낙타 · 포 …)', 'A piece with a move chess does not have (archbishop · camel · cannon …)'),
  T('edition', 'item', '판본', 'Edition', /판본/, /\beditions?\b/i, '드물게 격언에 붙는 빛깔 — 효과가 하나 더 붙는다', 'A rare finish on a maxim — it adds one more effect'),
  T('fragment', 'item', '명국 조각', 'Fragment', /명국 조각/, /\bfragments?\b/i, '전설 격언의 조각 — 첫 조각 · 재현 · 금빛 셋을 모으면 전설', 'A piece of a legendary maxim — collect first · reenactment · golden to make the legend'),
  T('feat', 'item', '재현', 'Reenactment', /재현/, /\breenact\w*/i, '명국의 한 장면을 대국에서 해내는 것 — 해내면 둘째 조각', 'Pulling off a classic game\'s moment in a match — earns the second fragment'),
];
export const TERM_GROUPS = [['battle', '대국'], ['run', '판'], ['item', '물건'], ['set', '모음']];
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
export const termTip = (id) => ({ title: termWord(id), lines: wrap(termSay(id), 160).map((l) => [l, PAL.cardInk]), w: 170 });

// 낱말을 두드러지게 한 줄. ui가 있으면 낱말 자리를 적어 둔다(ui.termSpans) — 가리키면 그 낱말 상자가 금빛 테로 켜진다.
// 낱말 자리는 누르기 · 가리키기를 가로채지 않는다(밑의 카드가 그대로 받는다). under는 옛 호출과 맞추려고 남겼다.
export function richText(ctx, s, x, y, col, { termCol = PAL.goldDk, ui = null, under = null, bold = false } = {}) {
  s = L(String(s));
  let xx = x;
  for (const [part, id] of splitTerms(s)) {
    const w = measure(part, bold);
    text(ctx, part, xx, y, id ? termCol : col, { bold });
    if (id && ui && ui.termSpans) ui.termSpans.push({ id, x: xx, y, w, h: 12 });
    xx += w;
  }
  return xx - x;
}

// ── 낱말 상자(Slay the Spire의 키워드 상자처럼): 카드 · 말풍선 옆에 낱말마다 제목 + 한 문장, 위에서 아래로 쌓는다.
// 글(한국어 글 · 옮긴 글)과 { id } 꼴의 이름을 받아 처음 나온 차례대로 낱말 id를 모은다.
export function termsIn(list) {
  const out = [];
  const push = (id) => { if (id && TERM_BY_ID[id] && !out.includes(id)) out.push(id); };
  for (const s of list) {
    if (!s) continue;
    if (typeof s === 'object') { push(s.id); continue; }
    for (const [, id] of splitTerms(L(String(s)))) push(id);
  }
  return out;
}
export const KEY_W = 176;
const KEY_GAP = 2;
const keyLines = (id) => wrap(termSay(id), KEY_W - 10);
const keyH = (id) => 16 + keyLines(id).length * 13 + 3;
// 자리 잡기: 피할 네모들(avoid[0] = 카드, 그다음 말풍선) 어느 것과도 겹치지 않는 세로 줄을 찾는다.
// 카드 오른쪽 → 왼쪽 → 말풍선 오른쪽 → 왼쪽 차례로, 카드 윗변에 가깝게. 다 안 들어가면 뒤에서부터 상자를 뺀다.
export function layoutKeyBoxes(ids, avoid, { max = 4, hot = null, W = 480, H = 270 } = {}) {
  let list = ids.slice(0, max);
  if (hot && ids.includes(hot) && !list.includes(hot)) list = [...list.slice(0, max - 1), hot];
  if (!list.length || !avoid.length) return null;
  const heights = list.map(keyH);
  const pref = avoid[0].y;
  const xs = [];
  for (const a of avoid) xs.push(a.x + a.w + 3, a.x - KEY_W - 3);
  for (let n = list.length; n >= 1; n--) {
    const total = heights.slice(0, n).reduce((u, v) => u + v, 0) + KEY_GAP * (n - 1);
    if (total > H - 4) continue;
    for (const x of xs) {
      if (x < 2 || x + KEY_W > W - 2) continue;
      const blocks = avoid.filter((a) => a.x < x + KEY_W && a.x + a.w > x).map((a) => [a.y - 2, a.y + a.h + 2]).sort((u, v) => u[0] - v[0]);
      let cur = 2, best = null;
      const tryIv = (lo, hi) => {
        if (hi - lo < total) return;
        const y = Math.max(lo, Math.min(hi - total, pref));
        if (!best || Math.abs(y - pref) < Math.abs(best - pref)) best = y;
      };
      for (const [lo, hi] of blocks) { if (lo > cur) tryIv(cur, lo); cur = Math.max(cur, hi); }
      tryIv(cur, H - 2);
      if (best != null) return { x, y: best, list: list.slice(0, n), heights: heights.slice(0, n) };
    }
  }
  return null;
}
// 그린 상자 네모들을 돌려준다(연기 시험이 센다)
export function drawKeyBoxes(ctx, ids, avoid, opts = {}) {
  const lay = layoutKeyBoxes(ids, avoid, opts);
  if (!lay) return [];
  const out = [];
  let y = lay.y;
  lay.list.forEach((id, i) => {
    const h = lay.heights[i], x = lay.x;
    box(ctx, x, y, KEY_W, h, '#16231f', id === opts.hot ? PAL.gold : PAL.frameDk);
    rect(ctx, x + 1, y + 1, KEY_W - 2, 1, '#2a3a33');
    text(ctx, termWord(id), x + 5, y + 2, PAL.gold, { bold: true });
    keyLines(id).forEach((l, k) => text(ctx, l, x + 5, y + 16 + k * 13, PAL.ink));
    out.push({ id, x, y, w: KEY_W, h });
    y += h + KEY_GAP;
  });
  return out;
}
