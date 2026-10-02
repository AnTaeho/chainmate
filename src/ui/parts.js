// 여러 화면이 같이 쓰는 조각: 격언 칸, 손 기물 카드, 상금, 말풍선 내용.
import { richText } from './glossary.js';
import { PAL, RARITY, EDITION_TINT } from '../render/palette.js';
import { box, rect, text, frame, dots, sprite, measure, line, digits, place } from '../render/gfx.js';
import { button } from './ui.js';
import { ENG_EDGE, tierOf, baked, hiFor } from '../render/sprites.js';
import { EMBLEM_HI, TACTIC_HI, SHARD_HI } from '../render/art-hi.js';
import { maximFamilies } from '../data/families.js';
import { PIECES, chartForm } from '../data/pieces.js';
import { SOUL_BY_ID, RARITY_NAME, isCracked, CRACK } from '../data/souls.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { L, getLang } from './lang.js';
import { familyGlyphs, familyChips, chipRows, chipBlockH, chipText, chipW } from './parts-depth.js';
import { maximInfo, engravingInfo, maximCapacity, maximCount } from '../sim/run.js';
import { EDITION_BY_ID } from '../data/editions.js';
import { CHARTS, chartText } from '../data/charts.js';
import { PIECE_NAME, PIECE_MOVE, FRAG_SOURCE } from './words.js';
import { wrap } from '../render/text.js';
import { LEGEND_BY_ID, LEGENDS } from '../data/legends.js';
import { drawIcon, iconCanvas } from '../render/icons.js';
import { shade, glow, flicker } from '../render/light.js';
import { hasDiagram, DIAG_W } from './diagram.js';
import { PAD_BOX, PAD_CARD, LINE, LINE_TITLE, GAP_IN, GAP_GROUP, ART_H, LIST_GAP, flow, textY, rowBoxH, BTN_S } from './frame.js';
import { openBox, closeBox, logClip } from '../render/layoutlog.js';
import { kindTab, TAB, TAB_GAP, PACK_KIND } from './kinds.js';

// 카드 바탕(물건 · 정석 · 두루마리 · 도감 칸이 같이 쓴다 — docs/design-notes/layout.md 「부품」):
// 바탕 · 짙은 테 · 윗변 한 줄 빛, edge가 있으면 안쪽 테(등급 · 각인 · 혼 빛깔, double이면 두 겹), 가리키면 금빛 테(들리지 않는다)
export function cardBase(ctx, x, y, w, h, { fill = PAL.card, hover = false, edge = null, double = false, ticks = false, line = PAL.frameDk } = {}) {
  shade(ctx, x, y, w, h);
  box(ctx, x, y, w, h, fill, hover ? PAL.gold : line);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  if (edge) {
    frame(ctx, x + 1, y + 1, w - 2, h - 2, edge);
    if (double) frame(ctx, x + 2, y + 2, w - 4, h - 4, edge);
    if (ticks) cornerTicks(ctx, x + 3, y + 3, w - 6, h - 6, edge, 3);
  }
}

// 좁은 칸에 이름 한 줄: 굵게 → 안 들어가면 보통 굵기 → 그래도 넘치면 끝을 「…」로(영어 이름이 칸을 넘지 않게)
export function fitText(ctx, s, x, y, w, col, { bold = true, align = 'left' } = {}) {
  s = L(String(s));
  if (measure(s, bold) <= w) return text(ctx, s, x, y, col, { bold, align });
  if (bold && measure(s, false) <= w) { logClip('thin', s, s, w); return text(ctx, s, x, y, col, { align }); }
  let t = s;
  while (t.length > 1 && measure(`${t}…`, false) > w) t = t.slice(0, -1);
  const shown = `${t.trimEnd()}…`;
  logClip('cut', s, shown, w);
  return text(ctx, shown, x, y, col, { align });
}

// 이름 두 줄(CHM-46): 낱말 단위로 max줄까지 — 굵게(bold면) → 보통 굵기. 한 낱말이라도 폭을 넘거나 줄이 넘치면 null(그때는 fitText).
// 칸 높이는 돌려준 줄 수로 hug 한다. thin이면 보통 굵기로 줄인 것(「잘린 글」 검사의 줄임 — 그리는 쪽이 logClip('thin'))
export function wrapName(s, w, { bold = true, max = 2 } = {}) {
  s = L(String(s));
  for (const b of bold ? [true, false] : [false]) {
    if (s.split(' ').some((word) => measure(word, b) > w)) continue;
    const lines = wrap(s, w, b);
    if (lines.length <= max) return { lines, thin: bold && !b };
  }
  return null;
}
// 이름 줄 그리기: wrapName 결과(없으면 한 줄 fitText). ys는 줄마다 글 y
export function drawName(ctx, s, nm, x, ys, w, col, { bold = true } = {}) {
  if (!nm) return fitText(ctx, s, x, ys[0], w, col, { bold });
  if (nm.thin) logClip('thin', L(String(s)), L(String(s)), w);
  nm.lines.forEach((l, k) => text(ctx, l, x, ys[k], col, { bold: bold && !nm.thin }));
}

// 말풍선 내용: 제목 · 글(body) · 덧줄(extra: [글, 빛깔] · { chips }). 줄바꿈은 그릴 때 자리 규칙의 폭으로(ui.js tipRows).
// w는 옛 호출과 맞추려고 남긴 값(말풍선 폭은 placement.js가 정한다)
// 덜 중요한 줄: 말풍선 자리가 모자라면 「…」로 자르기 전에 먼저 뺀다(ui.js tipLayout — CHM-34)
export const optLine = (l) => ({ opt: l });
export function tipLines(title, body, w = 150, extra = []) {
  return { title, body: [].concat(body).filter(Boolean), extra, w };
}

export function maximTip(m) {
  const info = maximInfo(m.id);
  const extra = [];
  if (m.edition) {
    const e = EDITION_BY_ID[m.edition];
    extra.push([`${e.name} · ${e.text}`, PAL.goldDk]);
  }
  const fams = maximFamilies(m.id);
  if (fams.length) extra.push({ chips: fams });
  if (info.rarity === 'legendary' && info.story) extra.push([`${info.year ? info.year + ' · ' : ''}${L(info.story)}`, PAL.goldDk]);
  return tipLines(info.name, [info.text, info.more], 150, extra);
}

// 기물 말풍선: 행마 글 옆에 작은 행마 그림(diagram.js). dir −1은 적(적 폰은 아래로 먹는다)
export function moveTip(title, t, body = [], { w = 212, dir = 1, extra = [] } = {}) {
  const tip = tipLines(title, body, w, extra);
  if (hasDiagram(t)) tip.diagram = { t, dir };
  return tip;
}
export function pieceTip(p) {
  const lines = [];
  if (PIECE_MOVE[p.t]) lines.push(PIECE_MOVE[p.t]);
  if (p.eng) { const e = engravingInfo(p.eng.id); lines.push(`${e.name} 각인 · ${e.text}`); }
  const extra = [];
  if (p.soul && SOUL_BY_ID[p.soul]) {
    const s = SOUL_BY_ID[p.soul];
    lines.push(`${s.name}의 혼 · ${L(s.text)}`);
    // 각성 사다리(CHM-17): 금까지 남은 사슬 · 금이 간 뒤 깨어나면 듣는 것 · 깨어난 뒤 듣는 것
    if (p.awake) extra.push([`각성 · ${L(s.awake)}`, PAL.goldDk]);
    else if (isCracked(p)) extra.push([`금이 갔다 · 깨어나면: ${L(s.awake)}`, PAL.goldDk]);
    else if (p.links) extra.push([`금 ${p.links}/${CRACK.links}`, PAL.cardDim]);
  }
  return moveTip(PIECE_NAME[p.t], p.t, lines, { extra });
}

export function chartTip(form, level = null) {
  return tipLines(CHARTS[form].name + (level ? ` · ${level}` : ''), chartText(form));
}

// 판본 빛깔(HOOKS 「등급과 빛깔」): 은박 = 가로로 흐르는 빛, 자개 = 무지갯빛 얼룩, 무지개 = 색 순환, 흑요 = 검은 광택 + 보랏빛 테.
// 카드를 그린 뒤 그 위에 얹는다. t = 화면 시간(초)
export function editionShine(ctx, edition, x, y, w, h, t) {
  if (!edition) return;
  if (edition === 'foil' || edition === 'obsidian') {
    const span = w + h + 20;
    const p = ((t * 55) % (span + 40)) - 20;
    ctx.globalAlpha = edition === 'foil' ? 0.45 : 0.3;
    for (let j = 1; j < h - 1; j++) {
      const bx = Math.round(x + p - j * 0.6);
      const x0 = Math.max(x + 1, bx), x1 = Math.min(x + w - 1, bx + 4);
      if (x1 > x0) rect(ctx, x0, y + j, x1 - x0, 1, edition === 'foil' ? '#ffffff' : '#c9a0ff');
    }
    ctx.globalAlpha = 1;
    frame(ctx, x, y, w, h, edition === 'foil' ? EDITION_TINT.foil : EDITION_TINT.obsidian);
  } else if (edition === 'pearl') {
    for (let i = 0; i < 7; i++) {
      const px = x + 5 + ((i * 37) % (w - 10)), py = y + 3 + ((i * 13) % (h - 6));
      ctx.globalAlpha = 0.55;
      rect(ctx, px, py, 2, 1, `hsl(${Math.floor(t * 90 + i * 51) % 360},70%,80%)`);
      ctx.globalAlpha = 1;
    }
    frame(ctx, x, y, w, h, `hsl(${Math.floor(t * 60) % 360},45%,82%)`);
  } else if (edition === 'rainbow') {
    const hue = Math.floor(t * 140) % 360;
    frame(ctx, x, y, w, h, `hsl(${hue},85%,60%)`);
    frame(ctx, x + 1, y + 1, w - 2, h - 2, `hsl(${(hue + 60) % 360},85%,70%)`);
  }
}

// 격언 칸 하나: 이름 한 줄(안 여백 PAD_CARD, 높이 = 여백 × 2 + 본문 줄 — maximCellH). 효과 · 판본 · 잠듦 까닭은 가리키면 왼쪽 칸 설명에.
// 잠들었으면 붉은 줄을 긋는다. overlay: 끄는 중인 카드(다른 칸 위에 뜬다)
// narrow(격언 칸이 두 줄로 나란히 — maximColumn): 이름 없이 아이콘만 두 배로 가운데(이름은 가리키면 말풍선에 — CHM-40)
export const maximCellH = () => rowBoxH(PAD_CARD);
// 이름 자리: 아이콘(12 + 틈 3)은 이름이 굵게 들어갈 때만 둔다(아이콘은 이름보다 덜 중요하다 — CHM-40)
export const maximIconW = (name, w) => (w >= 60 && measure(L(String(name)), true) <= w - PAD_CARD * 2 - 15 ? 15 : 0);
export function maximCard(ctx, m, x, y, w, h, { off = false, hot = false, lift = 0, t = 0, overlay = false, narrow = false } = {}) {
  const info = maximInfo(m.id);
  const legendary = info.rarity === 'legendary';
  const obsidian = m.edition === 'obsidian';
  y -= lift;
  openBox('card', x, y, w, h, PAD_CARD, { overlay, name: `격언 ${m.id}` });
  const fill = legendary ? '#f6d98a' : obsidian ? '#231a2c' : PAL.card;
  // 밑 그림자 · 판본 빛(칸 뒤 층, 판본 빛깔로 천천히 숨 쉰다)
  shade(ctx, x, y, w, h, 1 + Math.min(3, lift));
  if (m.edition) glow(ctx, x, y, w, h, EDITION_TINT[m.edition] || PAL.goldHi, 0.32 * flicker(t, 2.2, 0.35), 4);
  box(ctx, x, y, w, h, fill, PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, legendary ? PAL.goldHi : obsidian ? '#4a3a5c' : PAL.cardHi);
  rect(ctx, x + 1, y + 2, 2, h - 3, RARITY[info.rarity] || PAL.dim);
  if (legendary) {
    const k = Math.floor(t * 8) % 20;
    if (k < 4) rect(ctx, x + 10 + k * 22, y + 2 + (k % 2) * 3, 1, 1, PAL.white);
  }
  rarityTrim(ctx, info.rarity, x, y, w, h);
  editionShine(ctx, m.edition, x, y, w, h, t);
  if (hot) frame(ctx, x, y, w, h, PAL.gold);
  const ink = off ? PAL.cardDim : obsidian ? '#eadcff' : PAL.cardInk;
  const P = PAD_CARD;
  if (narrow) {
    const c = iconCanvas(m.id, hiFor(ctx, 2));
    if (c) {
      if (off) ctx.globalAlpha = 0.35;
      ctx.drawImage(c, Math.round(x + (w - 24) / 2), Math.round(y + (h - 24) / 2), 24, 24);
      ctx.globalAlpha = 1;
    }
  } else {
    // 아이콘(12)은 오른쪽 안 여백 안에, 이름은 그 왼쪽까지(넘치면 fitText가 보통 굵기 → 「…」)
    const iconW = maximIconW(info.name, w);
    if (iconW) drawIcon(ctx, m.id, x + w - P - 12, y + Math.floor((h - 12) / 2), off ? 0.35 : 1);
    fitText(ctx, info.name, x + P, y + textY(P), w - P * 2 - iconW, ink);
  }
  if (off) { rect(ctx, x + 4, y + Math.floor(h / 2), w - 8, 1, PAL.red); }
  closeBox();
}

// 등급별 테두리 무늬: 흔함 단색 · 드묾 점선 · 귀함 이중 테 · 전설 금박 모서리
export function rarityTrim(ctx, rarity, x, y, w, h) {
  const col = RARITY[rarity] || PAL.dim;
  if (rarity === 'uncommon') dots(ctx, x + 1, y + 1, w - 2, h - 2, col, 2);
  else if (rarity === 'rare') { frame(ctx, x + 1, y + 1, w - 2, h - 2, col); if (h > 10) frame(ctx, x + 3, y + 3, w - 6, h - 6, col); }
  else if (rarity === 'legendary') {
    const n = Math.min(5, Math.floor(h / 3));
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
      for (let k = 0; k < n; k++) { rect(ctx, cx + sx * k, cy, 1, 1, k % 2 ? PAL.goldHi : PAL.gold); rect(ctx, cx, cy + sy * k, 1, 1, k % 2 ? PAL.goldHi : PAL.gold); }
      rect(ctx, cx + sx, cy + sy, 1, 1, PAL.goldDk);
    }
  } else frame(ctx, x, y, w, h, '#5d4a33');
}

// 격언 칸 목록(오른쪽 칸): 칸 높이는 maximCellH(내용에 맞춘 높이), 칸 사이 LIST_GAP.
// 한 줄로 hTotal 안에 다 안 들어가면(전설 · 흑요 판본으로 칸이 늘면) 두 줄로 나란히(칸은 아이콘만). 돌려주는 값: 칸 자리들 · 쓴 높이(used)
export function maximColumnH(run, hTotal) {
  const slots = maximSlotsOf(run);
  const h = maximCellH(), one = slots * h + (slots - 1) * LIST_GAP;
  const cols = one <= hTotal ? 1 : 2;
  const rows = Math.ceil(slots / cols);
  return { slots, h, cols, rows, used: rows * h + (rows - 1) * LIST_GAP };
}
const maximSlotsOf = (run) => Math.max(maximCapacity(run) + run.maxims.filter((m) => m.legendary).length, run.maxims.length);
export function maximColumn(ctx, ui, run, x, y, w, hTotal, { idPrefix = 'maxim', offUids = [], onClick = null, drag = null, hotIndex = -1 } = {}) {
  const maxims = run.maxims;
  const cap = maximCapacity(run);
  const { slots, h, cols, used } = maximColumnH(run, hTotal);
  const gap = LIST_GAP;
  const cw = cols === 1 ? w : Math.floor((w - gap) / 2);
  const spots = [];
  for (let i = 0; i < slots; i++) {
    const xx = x + (i % cols) * (cw + gap), yy = y + Math.floor(i / cols) * (h + gap);
    const m = maxims[i];
    if (!m) {
      dots(ctx, xx, yy, cw, h, PAL.feltHi, 3);
      continue;
    }
    const id = `${idPrefix}:${i}`;
    const r = ui.region(id, xx, yy, cw, h, { tip: () => maximTip(m), keys: () => maximFamilies(m.id).map((f) => ({ id: `fam_${f}` })), onClick: onClick ? () => onClick(i, m) : null, drag: drag ? true : false, onDrop: drag ? (mx, my) => drag(i, mx, my) : null });
    const dragging = ui.drag && ui.drag.region === r && ui.drag.moved;
    if (dragging) { dots(ctx, xx, yy, cw, h, PAL.gold, 2); spots.push({ i, x: xx, y: yy, w: cw, h }); continue; }
    maximCard(ctx, m, xx, yy, cw, h, { narrow: cols === 2, off: offUids.includes(m.uid), hot: ui.isHover(id) || hotIndex === i, lift: ui.isHover(id) && (onClick || drag) ? 1 : 0, t: ui.time + i * 0.37 });
    spots.push({ i, x: xx, y: yy, w: cw, h });
  }
  // 끌고 있는 카드는 마우스를 따라 그린다
  if (ui.drag && ui.drag.moved && ui.drag.region.id.startsWith(idPrefix + ':')) {
    const i = Number(ui.drag.region.id.split(':')[1]);
    if (maxims[i]) maximCard(ctx, maxims[i], ui.mouse.x - Math.floor(cw / 2), ui.mouse.y - Math.floor(h / 2), cw, h, { narrow: cols === 2, hot: true, t: ui.time, overlay: true });
  }
  return { spots, h, gap, slots, used, count: maximCount(run), cap };
}

// 격언 칸 격자(금빛 꾸러미): cols 칸씩 줄을 이어, 칸 하나는 cw × maximCellH. 산 격언만 칸(빈 칸은 점선). 돌려주는 값: 칸 자리들
export function maximGrid(ctx, ui, run, x, y, cols, cw, gapX, gapY, { idPrefix = 'maxim', onClick = null, hotIndex = -1 } = {}) {
  const maxims = run.maxims;
  const slots = maximSlotsOf(run);
  const ch = maximCellH();
  const spots = [];
  for (let i = 0; i < slots; i++) {
    const xx = x + (i % cols) * (cw + gapX), yy = y + Math.floor(i / cols) * (ch + gapY);
    const m = maxims[i];
    if (!m) { dots(ctx, xx, yy, cw, ch, PAL.feltHi, 3); continue; }
    const id = `${idPrefix}:${i}`;
    ui.region(id, xx, yy, cw, ch, { tip: () => maximTip(m), keys: () => maximFamilies(m.id).map((f) => ({ id: `fam_${f}` })), onClick: onClick ? () => onClick(i, m) : null });
    maximCard(ctx, m, xx, yy, cw, ch, { hot: ui.isHover(id) || hotIndex === i, t: ui.time + i * 0.37 });
    spots.push({ i, x: xx, y: yy, w: cw, h: ch });
  }
  return spots;
}
export const maximGridH = (run, cols, gapY) => { const rows = Math.ceil(maximSlotsOf(run) / cols); return rows * maximCellH() + (rows - 1) * gapY; };

// 손 기물 카드: 각인은 기물 몸의 톤으로, 카드는 안쪽 테만 각인 색. tier: 그 종류의 기보 단계
export const ENG_FILL = { ivory: '#f7efdb', glass: '#bfe0e6', gold: '#f3d27a', ebony: '#6b5a52', silver: '#d8dee6', feather: '#e8e0f0' };
// 기보 수준: 이 기물 모습의 기보(이형은 바탕 체스 모습의 기보를 따른다 — scoring.js 'charts')
export const chartLevel = (run, t) => (run && run.charts ? run.charts[chartForm(t)] || 0 : 0);
// level: 기보 수준(1 이상이면 오른쪽 위 구석에 청록 표 — 동빛 단계는 1배에서 톤만으로 안 읽힌다) · glow: 표가 빛난다(0~1, 기보를 얻는 순간)
export function pieceCard(ctx, p, x, y, w, h, { lift = 0, selected = false, hover = false, dim = false, alpha = 1, tier = 0, level = 0, glow = 0, time = null, flash = 0 } = {}) {
  const yy = y - lift;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  box(ctx, x, yy, w, h, PAL.light, selected ? PAL.gold : hover ? PAL.goldDk : PAL.frameDk);
  rect(ctx, x + 1, yy + 1, w - 2, 1, PAL.cardHi);
  if (selected) frame(ctx, x - 1, yy - 1, w + 2, h + 2, PAL.gold);
  if (p.eng && ENG_EDGE[p.eng.id]) { frame(ctx, x + 1, yy + 1, w - 2, h - 2, ENG_EDGE[p.eng.id]); cornerTicks(ctx, x + 2, yy + 2, w - 4, h - 4, ENG_EDGE[p.eng.id]); }
  sprite(ctx, p.t, 'w', x + Math.floor((w - 16) / 2), yy + Math.floor((h - 22) / 2) + 1, { alpha: dim ? 0.5 : 1, eng: p.eng ? p.eng.id : null, tier, time, soul: p.soul || null });
  if (level > 0) chartBadge(ctx, level, x + w - 1, yy + 1, { dim, glow });
  if (p.soul && (p.awake || isCracked(p))) soulMark(ctx, p, x, yy, w, h, time, dim);
  if (flash > 0) { ctx.globalAlpha = flash * 0.8; rect(ctx, x + 1, yy + 1, w - 2, h - 2, PAL.white); ctx.globalAlpha = 1; }
  if (alpha !== 1) ctx.globalAlpha = 1;
}
// 혼의 금 · 각성 표(CHM-17): 금이 간 혼은 카드 왼쪽 위에서 흘러내리는 금(혼 빛깔로 비치는 틈), 깨어난 혼은 금빛 이중 테와 도는 모서리 빛.
// 시안 셋(금선 · 금테 / 구석 표 / 기운) 가운데 1배에서 가장 잘 보이는 것을 골랐다 — docs/shots/souls/draft-*-deck, 보고서 docs/reports/souls.md
const CRACK_PX = [[2, 1], [3, 2], [3, 3], [4, 4], [5, 4], [5, 5], [6, 6], [6, 7], [7, 8]];
export function soulMark(ctx, p, x, y, w, h, time = null, dim = false) {
  const s = SOUL_BY_ID[p.soul];
  if (!s) return;
  const t = time == null ? 0 : time;
  if (dim) ctx.globalAlpha *= 0.6;
  if (p.awake) {
    frame(ctx, x + 1, y + 1, w - 2, h - 2, PAL.gold);
    frame(ctx, x + 2, y + 2, w - 4, h - 4, PAL.goldDk);
    const k = Math.floor(t * 3) % 4, corners = [[x + 1, y + 1], [x + w - 2, y + 1], [x + w - 2, y + h - 2], [x + 1, y + h - 2]];
    const [ax, ay] = corners[k];
    rect(ctx, ax, ay, 1, 1, PAL.white);
  } else {
    for (const [dx, dy] of CRACK_PX) rect(ctx, x + dx, y + dy, 1, 1, PAL.ink);
    const k = 0.55 + 0.45 * Math.sin(t * 3.3);
    ctx.globalAlpha *= k;
    for (const [dx, dy] of CRACK_PX.slice(1, -1)) rect(ctx, x + dx + 1, y + dy, 1, 1, s.col);
    ctx.globalAlpha /= k;
  }
  if (dim) ctx.globalAlpha /= 0.6;
}
// 기보 수준 표: 오른끝 right · 윗변 y에 붙는 청록 칸(숫자 3 × 5 + 둘레 1). 돌려주는 값은 폭
export function chartBadge(ctx, level, right, y, { dim = false, glow = 0 } = {}) {
  const [, hi, dk] = SEAL.chart;
  const s = String(Math.min(99, level));
  const bw = s.length * 4 + 1, bh = 7, bx = right - bw;
  const a0 = ctx.globalAlpha;
  if (dim) ctx.globalAlpha = a0 * 0.6;
  rect(ctx, bx, y, bw, bh, glow > 0 ? mixHex(dk, hi, glow * 0.6) : dk);
  digits(ctx, s, bx + 1, y + 1, glow > 0.5 ? PAL.white : hi);
  ctx.globalAlpha = a0;
  return bw;
}
function mixHex(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}
// 네 모서리 꺾쇠
export function cornerTicks(ctx, x, y, w, h, col, n = 2) {
  rect(ctx, x, y, n, 1, col); rect(ctx, x, y, 1, n, col);
  rect(ctx, x + w - n, y, n, 1, col); rect(ctx, x + w - 1, y, 1, n, col);
  rect(ctx, x, y + h - 1, n, 1, col); rect(ctx, x, y + h - n, 1, n, col);
  rect(ctx, x + w - n, y + h - 1, n, 1, col); rect(ctx, x + w - 1, y + h - n, 1, n, col);
}
// 각인 그림: 기물 없이 재료 하나(금화 · 은판 · 상아 조각 · 흑단 나뭇조각 · 유리 조각 · 깃털). 16×16 도트, 22×26 어두운 칸 안에.
// 각인은 주머니의 어느 기물에나 새기므로 기물을 그리지 않는다(나이트를 그리면 나이트에만 붙는 것처럼 보였다).
export const EMBLEM = {
  gold: { c: { o: '#6b4410', m: '#c8902c', h: '#efbd55', w: '#fff1b8' }, g: ['.....oooooo.....', '...oommmmmmoo...', '..ommhhhhhhmmo..', '.omhhwwhhhhhhmo.', '.omhwwhhhhhhhmo.', 'omhhhhmmmmhhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhhmmmmhhhhmo', '.omhhhhhhhhhhmo.', '.omhhhhhhhhhhmo.', '..ommhhhhhhmmo..', '...oommmmmmoo...', '.....oooooo.....'] },
  silver: { c: { o: '#4a5560', m: '#9aa6b0', h: '#d8dee6', w: '#ffffff' }, g: ['................', '................', '..oooooooooooo..', '.ohhhhhhhhhhhmo.', '.ohwwhhhhhhhhmo.', '.ohwhhhhhhhhhmo.', '.ohhhhhwhhhhhmo.', '.ohhhhwhhhhhhmo.', '.ohhhwhhhhhhhmo.', '.ohhhhhhhhhwhmo.', '.ohhhhhhhhwhhmo.', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................', '................'] },
  ivory: { c: { o: '#8a6a4a', m: '#d8c4a4', h: '#f7efdb', w: '#ffffff' }, g: ['..........oo....', '.........ohho...', '........ohwho...', '.......ohwhho...', '......ohwhhmo...', '.....ohhhhmo....', '....ohhhhmo.....', '...ohhhhmo......', '..ohhhhmo.......', '..ohhhmo........', '.ohhhmo.........', '.ohhmmo.........', '.ohmmo..........', '..oooo..........', '................', '................'] },
  ebony: { c: { o: '#1e1612', m: '#3e2f28', h: '#6b5a52', w: '#c8902c' }, g: ['................', '................', '...ooooooooo....', '..ohhmhhhhhmoo..', '..ohmhhhmhhhhmo.', '.ohhmhhhmhhhhmo.', '.ohmhhhhmhhhhhmo', '.ommmhhhhmmhhhmo', '.ohhhmmhhhhmmmmo', '.ohhhhhmhhhhhhmo', '..ohhhhmhhhwhmo.', '..ommmmmmmmmmo..', '...oooooooooo...', '................', '................', '................'] },
  glass: { c: { o: '#3f7f8a', m: '#6fb8c4', h: '#bfe0e6', w: '#ffffff' }, g: ['.......o........', '......owo.......', '......owho......', '.....owhho......', '.....owhhho.....', '....owhhhho.....', '....owhhhhmo....', '...owhhhhhmo....', '...owhhhhhhmo...', '..owhhhhhhhmo...', '..owhhhhhhhhmo..', '.owhhhhhhhhhmo..', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................'] },
  feather: { c: { o: '#3a6a60', m: '#6fd1bf', h: '#e8e0f0', w: '#ffffff' }, g: ['...........ooo..', '.........oohhmo.', '........ohhhhmo.', '.......ohhhhmo..', '......ohhwhmo...', '.....ohhwhmo....', '....ohhwhmo.....', '....ohwhmo......', '...ohwhmo.......', '...owhmo........', '..owmo..........', '..omo...........', '.oo.............', 'o...............', '................', '................'] },
  // 밤샘 2: 청동 종 · 철 덩이 · 벌레 든 호박 · 비취 고리 · 산호 가지 · 결 있는 대리석
  bronze: { c: { o: '#5a3414', m: '#a0602a', h: '#d08a48', w: '#f0c090' }, g: ['.......oo.......', '......ommo......', '.....ohhhmo.....', '....ohwhhhmo....', '....ohwhhhmo....', '...ohwhhhhhmo...', '...ohhhhhhhmo...', '...ohhhhhhhmo...', '..ohhhhhhhhhmo..', '..ohhhhhhhhhmo..', '.ohhhhhhhhhhhmo.', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '.......oo.......', '......omo.......', '.......o........'] },
  iron: { c: { o: '#2a2e33', m: '#555c63', h: '#8a9299', w: '#c8d0d6' }, g: ['................', '................', '................', '....oooooooo....', '...ohhwhhhhmo...', '..ohhwhhhhhhmo..', '.ohhhhhhhhhhhmo.', 'ommmmmmmmmmmmmmo', 'ommmmmmmmmmmmmmo', '.oooooooooooooo.', '................', '................', '................', '................', '................', '................'] },
  amber: { c: { o: '#6a3a08', m: '#c87a14', h: '#f0a830', w: '#ffe0a0' }, g: ['.......oo.......', '......ohho......', '.....ohwhho.....', '.....owhhho.....', '....owhhhhmo....', '...ohwhhhhhmo...', '...owhhoohhmo...', '..ohhhoooohhmo..', '..ohhhhoohhhmo..', '..ohhhhhhhhhmo..', '..ohhhhhhhhhmo..', '...ohhhhhhhmo...', '....ommmmmmo....', '.....oooooo.....', '................', '................'] },
  jade: { c: { o: '#1e5a3a', m: '#3f9a60', h: '#7fd09a', w: '#d0ffe0' }, g: ['.....oooooo.....', '...oohhhhhhoo...', '..ohhwwhhhhhmo..', '.ohwwhhhhhhhhmo.', '.ohwhhooooohhmo.', 'ohhhho....ohhhmo', 'ohhho......ohhmo', 'ohhho......ohhmo', 'ohhho......ohhmo', 'ohhhho....ohhhmo', '.ohhhhooooohhmo.', '.ohhhhhhhhhhhmo.', '..ommhhhhhhmmo..', '...oommmmmmoo...', '.....oooooo.....', '................'] },
  coral: { c: { o: '#7a2a2a', m: '#d05a50', h: '#f08878', w: '#ffd0c8' }, g: ['..o.....o....o..', '.oho...oho..oho.', '.oho...oho..oho.', '.ohho..oho.ohho.', '..oho..ohooho...', '..ohhooohhhmo...', '...ohhhhhhmo....', '....ohhhhmo.....', '.....ohhmo......', '.....ohhmo......', '.....ohhmo......', '....ohhhhmo.....', '...ommmmmmmo....', '...ooooooooo....', '................', '................'] },
  marble: { c: { o: '#3a3a4a', m: '#7a70a8', h: '#e8e4f8', w: '#ffffff' }, g: ['................', '................', '.oooooooooooooo.', '.ohhhhhhhmhhhho.', '.ohwhhhhmhhhhho.', '.ohhhhhmhhhhhho.', '.ohhhhmhhhhhhmo.', '.ohhhhhmmhhhhmo.', '.ohhhhhhhmhhhmo.', '.ohhmhhhhhmhhmo.', '.ohhhmmhhhhhhmo.', '.ommmmmmmmmmmmo.', '.oooooooooooooo.', '................', '................', '................'] },
};
export function engravingEmblem(ctx, id, x, y, { sq = true } = {}) {
  if (sq) { rect(ctx, x, y, 22, 26, '#1b2b27'); rect(ctx, x + 1, y + 1, 20, 1, '#2a3a33'); }
  const e = EMBLEM[id];
  if (!e) return;
  // 화면 배율 2 이상: 32×32 반 도트 그림(art-hi.js, CHM-39 2단계)을 같은 16×16 자리에
  if (EMBLEM_HI[id] && hiFor(ctx)) { ctx.drawImage(baked(`emblem:${id}`, EMBLEM_HI[id], Object.fromEntries(Object.entries(e.c).map(([k, v]) => [k, [v, 1]]))), place(x + 3), place(y + 5), 16, 16); return; }
  e.g.forEach((r, j) => { for (let i = 0; i < 16; i++) { const k = r[i]; if (k !== '.') rect(ctx, x + 3 + i, y + 5 + j, 1, 1, e.c[k]); } });
}
// 혼 등급(흔함 · 드묾 · 귀함): 격언 등급 테와 같은 빛깔(palette RARITY). 혼 깃든 기물은 그 혼의 등급
export const soulRarity = (it) => (it.kind === 'soul' ? SOUL_BY_ID[it.id].rarity : it.kind === 'piece' && it.soul ? SOUL_BY_ID[it.soul].rarity : null);
export const rarityLine = (rarity) => [RARITY_NAME[rarity], RARITY[rarity]];
// 혼 그림: 기물 없이 혼의 빛깔로 도는 기운(혼도 주머니의 어느 기물에나 깃든다)
export function soulEmblem(ctx, id, x, y, t = 0, { sq = true } = {}) {
  const s = SOUL_BY_ID[id];
  if (sq) rect(ctx, x, y, 22, 26, '#1b2b27');
  const cx = x + 11, cy = y + 13;
  for (let r = 8; r >= 2; r -= 2) { ctx.globalAlpha = 0.18 + (8 - r) * 0.06; for (let a = 0; a < 24; a++) { const q = (a / 24) * Math.PI * 2; rect(ctx, Math.round(cx + Math.cos(q) * r), Math.round(cy + Math.sin(q) * r), 1, 1, s.col); } }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 3; k++) { const q = t * 2 + (k * Math.PI * 2) / 3; rect(ctx, Math.round(cx + Math.cos(q) * 6), Math.round(cy + Math.sin(q) * 6), 2, 2, s.col); }
  // 가운데 문양(5×5): 혼이 열여섯이 되어 빛깔만으로는 갈리지 않는다(밤샘 2)
  const g = SOUL_GLYPH[id];
  if (g) { rect(ctx, cx - 3, cy - 3, 7, 7, '#1b2b27'); g.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') rect(ctx, cx - 2 + i, cy - 2 + j, 1, 1, PAL.white); }); }
  else rect(ctx, cx - 1, cy - 1, 3, 3, PAL.white);
}
// 작은 혼 표(9×9): 혼 빛깔 바탕에 가운데 문양(도감 칸처럼 좁은 곳)
export function soulGlyph(ctx, id, x, y) {
  const s = SOUL_BY_ID[id];
  rect(ctx, x, y, 9, 9, '#1b2b27');
  frame(ctx, x, y, 9, 9, s.col);
  const g = SOUL_GLYPH[id];
  if (g) g.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') rect(ctx, x + 2 + i, y + 2 + j, 1, 1, PAL.white); });
}
export const SOUL_GLYPH = {
  absorb: ['.###.', '#...#', '#.###', '#....', '.####'], echo: ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  transcend: ['..#..', '.###.', '#.#.#', '..#..', '..#..'], hunger: ['#.#.#', '#.#.#', '#####', '..#..', '..#..'],
  hunter: ['..#..', '.###.', '##.##', '.###.', '..#..'], martyr: ['..#..', '#####', '..#..', '..#..', '..#..'],
  crown: ['##...', '###..', '####.', '#....', '#....'], shade: ['#...#', '.###.', '.....', '.###.', '#...#'],
  inherit: ['#####', '#...#', '#.#.#', '..#..', '.###.'], relay: ['#....', '.#...', '..###', '...#.', '....#'],
  retro: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'], duel: ['#...#', '##.##', '.###.', '##.##', '#...#'],
  reaper: ['.###.', '#.#.#', '#####', '.#.#.', '.....'], spring: ['#####', '...#.', '..#..', '.#...', '#####'],
  homing: ['.###.', '#...#', '#.#..', '..##.', '.###.'], ripple: ['.#.#.', '#...#', '..#..', '#...#', '.#.#.'],
};
// 두루마리 「깨우기」(CHM-17): 금 간 구슬에서 금빛이 새어 나온다
export const AWAKEN_TEXT = '금이 간 혼 하나가 깨어난다';
export const AWAKEN_MORE = '혼 깃든 기물로 사슬을 다섯 번 이으면 금이 간다';
export function awakenArt(ctx, x, y, t = 0, { sq = true } = {}) {
  if (sq) rect(ctx, x, y, 22, 26, '#1b2b27');
  const cx = x + 11, cy = y + 13;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = i * i + j * j; if (d <= 25) rect(ctx, cx + i, cy + j, 1, 1, d > 16 ? PAL.goldDk : i + j < -3 ? PAL.goldHi : PAL.gold); }
  for (const [i, j] of [[-1, -5], [0, -4], [0, -3], [1, -2], [1, -1], [0, 0], [1, 1], [2, 2], [2, 3]]) rect(ctx, cx + i, cy + j, 1, 1, PAL.ink);
  const k = Math.floor(t * 4) % 4;
  for (let r = 0; r < 4; r++) { const q = (r * Math.PI) / 2 + Math.PI / 4; const d = 7 + ((k + r) % 2); rect(ctx, Math.round(cx + Math.cos(q) * d), Math.round(cy + Math.sin(q) * d), 1, 1, PAL.goldHi); }
}
// 진화 그림: 체스 기물 › 이형(나이트 › 낙타)
export function evolveArt(ctx, x, y, t = 0) {
  rect(ctx, x, y, 44, 26, '#1b2b27');
  sprite(ctx, 'N', 'w', x + 1, y + 2);
  const k = Math.floor(t * 3) % 2;
  for (let i = 0; i < 3; i++) rect(ctx, x + 19 + i + k, y + 11 + i, 1, 1, PAL.gold), rect(ctx, x + 19 + i + k, y + 15 - i, 1, 1, PAL.gold);
  sprite(ctx, 'L', 'w', x + 26, y + 2, { tier: 1 });
}

// 카드에 적는 효과 한 줄(말풍선은 덧붙임만)
export function itemEffect(it) {
  if (it.kind === 'maxim') return maximInfo(it.id).text;
  if (it.kind === 'chart') return chartText(it.form);
  if (it.kind === 'engraving') return engravingInfo(it.id).text;
  if (it.kind === 'piece') return (it.soul ? `${SOUL_BY_ID[it.soul].name}의 혼: ${L(SOUL_BY_ID[it.soul].text)}` : PIECE_MOVE[it.t] || '');
  if (it.kind === 'soul') return SOUL_BY_ID[it.id].text;
  if (it.kind === 'evolve') return '체스 기물 하나가 특수 기물로 자란다';
  if (it.kind === 'awaken') return AWAKEN_TEXT;
  if (it.kind === 'tactic') return TACTIC_BY_ID[it.id].text;
  if (it.kind === 'gamble') return it.id === 'potion' ? '아무 기물에 무작위 혼이나 각인' : '아무 기물이 무작위 특수 기물로';
  // 명국 조각: 카드에는 한 줄(전설의 효과는 가리키면 — itemExtraTip)
  if (it.kind === 'fragment') return '조각 셋이면 전설';
  return '';
}
// 좁은 칸(격언 칸 둘째 줄)에 적는 효과: 첫 효과에서 조건을 뗀 것.
// 「조건: 효과」면 콜론 뒤, 아니면 끝의 수치(「값 +60」 · 「+4 Mult」). 수치가 없으면 첫 효과 그대로
export function effectPart(s) {
  s = L(String(s)).split(' · ')[0];
  const c = s.match(/^[^:]{1,60}?:\s+(.+)$/);
  if (c) return c[1];
  const n = s.match(/((?:값|배수|상금|희생|수) [+×−][\d.]+)$/) || s.match(/([+×−][\d.]+ (?:Mult|Value|Purse))$/);
  return n ? n[1] : s;
}
// 좁은 칸에 적는 효과 앞머리: 「언제」를 떼고 「무엇」부터(두루마리 칸). 전부는 가리키면 보인다.
export function effectHead(s) {
  s = L(String(s));
  // 「언제」는 첫 마디(「 — 」 앞)에서만 찾는다: 뒤에 붙은 대가(「대신 사슬이 끝나면 배수 −1」)를 앞머리로 올리지 않게
  const cut = s.indexOf(' — ');
  const first = cut >= 0 ? s.slice(0, cut) : s;
  const m = first.match(/^[^:]{1,60}?:\s+(.+)$/) || (getLang() === 'en' ? null : first.match(/^.*?(?:면|마다|순간|동안)\s+(.+)$/));
  return m ? m[1] + s.slice(first.length) : s;
}
// 어떻게 쓰나(카드 아래 흐린 한 줄)
export function itemUse(it) {
  if (it.kind === 'engraving') return '기물에 새긴다';
  if (it.kind === 'soul') return '기물에 깃든다';
  if (it.kind === 'evolve') return '기물이 자란다';
  if (it.kind === 'awaken') return '금이 간 혼에 쓴다';
  if (it.kind === 'tactic') return '대국 중에 쓴다';
  return '';
}

// 작은 동전 아이콘 + 상금
export function moneyText(ctx, n, x, y, align = 'left') {
  return text(ctx, `$${n}`, x, y, PAL.gold, { bold: true, align });
}

// 바꾸기 아이콘(돌아가는 화살)
export function discardIcon(ctx, x, y, col) {
  rect(ctx, x + 1, y, 5, 1, col); rect(ctx, x, y + 1, 1, 5, col); rect(ctx, x + 1, y + 6, 5, 1, col);
  rect(ctx, x + 6, y + 4, 1, 2, col); rect(ctx, x + 5, y - 1, 1, 3, col); rect(ctx, x + 6, y, 1, 1, col);
}

// 패널: 윗변 한 줄 빛, 아랫변 한 줄 그늘
export function panel(ctx, x, y, w, h) {
  shade(ctx, x, y, w, h);
  box(ctx, x, y, w, h, PAL.feltDk, PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, '#1f302a');
  rect(ctx, x + 1, y + h - 2, w - 2, 1, '#0e1813');
}

export const labelW = (s) => measure(s);

// ── 꾸러미 봉투: 접힌 덮개 · 봉랍 자리의 종류 딱지(기물 · 기보 · 각인 · 금빛은 판본 격언).
// open 0 → 1: 딱지가 갈라지고(0~0.4) 덮개가 젖혀진다(0.4~1). SEAL은 기보 표 · 봉투 밖 연출이 쓰는 빛깔(청록 등)
export const SEAL = { piece: ['#c8b48a', '#efe3c7', '#6b5132'], chart: ['#3f8f86', '#8fd3c6', '#1d4a45'], engraving: ['#8a4a6a', '#d690b4', '#4a2438'], golden: ['#c8902c', '#fff1b8', '#6b4410'] };
export function envelope(ctx, x, y, w, h, kind, { open = 0, hover = false } = {}) {
  const gold = kind === 'golden';
  const paper = gold ? PAL.gold : '#c9a36a', paperHi = gold ? PAL.goldHi : '#e6c690', paperDk = gold ? PAL.goldDk : '#8a6a3a';
  box(ctx, x, y, w, h, paper, hover ? PAL.white : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, paperHi);
  rect(ctx, x + 1, y + h - 2, w - 2, 1, paperDk);
  // 아래 접힌 두 날개(대각선)
  const cy = y + Math.floor(h * 0.62);
  line(ctx, x + 1, y + h - 2, x + Math.floor(w / 2), cy, paperDk);
  line(ctx, x + w - 2, y + h - 2, x + Math.floor(w / 2), cy, paperDk);
  // 위 덮개: 닫히면 아래로 뾰족, 열리면 위로 젖혀진다
  const flap = Math.max(0, (open - 0.4) / 0.6);
  const tipY = Math.round(cy + (y - 12 - cy) * flap);
  for (let i = 0; i <= w - 2; i++) {
    const k = 1 - Math.abs(i - (w - 2) / 2) / ((w - 2) / 2);
    const yy = Math.round(y + 1 + (tipY - y - 1) * k);
    if (flap < 0.5) { rect(ctx, x + 1 + i, y + 1, 1, Math.max(0, yy - y - 1), paper); rect(ctx, x + 1 + i, yy, 1, 1, paperDk); }
    else { rect(ctx, x + 1 + i, yy, 1, Math.max(0, y + 1 - yy), paperHi); rect(ctx, x + 1 + i, yy, 1, 1, paperDk); }
  }
  // 봉랍 자리에 안에 든 물건의 종류 딱지(kinds.js — 진열 카드의 딱지와 같은 것). 열리면 봉랍처럼 반으로 갈라져 떨어진다
  const sx = x + Math.floor(w / 2), sy = cy - 2;
  const crack = Math.min(1, open / 0.4);
  if (flap < 0.3) {
    const split = crack > 0.3 ? Math.round(crack * 3) : 0;
    const drop = crack > 0.3 ? Math.round(crack * crack * 4) : 0;
    kindTab(ctx, PACK_KIND[kind] || 'piece', sx - TAB / 2, sy - TAB / 2, { split, drop });
  }
}

// ── 상점 · 꾸러미 물건 카드
export const ITEM_KIND = { maxim: '격언', chart: '기보', engraving: '각인', piece: '기물', fragment: '명경기 조각', soul: '혼', evolve: '진화', tactic: '전술', gamble: '도박', awaken: '각성' };

export function itemName(it) {
  if (it.kind === 'maxim') return maximInfo(it.id).name;
  if (it.kind === 'chart') return CHARTS[it.form].name;
  if (it.kind === 'engraving') return `${engravingInfo(it.id).name} 각인`;
  if (it.kind === 'piece') return PIECE_NAME[it.t];
  if (it.kind === 'soul') return `${SOUL_BY_ID[it.id].name}의 혼`;
  if (it.kind === 'evolve') return '진화';
  if (it.kind === 'awaken') return '깨우기';
  if (it.kind === 'gamble') return it.id === 'potion' ? '수상한 물약' : '룰렛';
  if (it.kind === 'tactic') return TACTIC_BY_ID[it.id].name;
  if (it.kind === 'fragment') return LEGEND_BY_ID[it.legend].name;
  return '';
}

export function itemTip(it) {
  if (it.kind === 'maxim') {
    const t = maximTip(it);
    return t;
  }
  if (it.kind === 'chart') return chartTip(it.form);
  if (it.kind === 'engraving') { const e = engravingInfo(it.id); return tipLines(`${e.name} 각인`, [e.text, '기물 하나에 새긴다']); }
  if (it.kind === 'piece') return moveTip(PIECE_NAME[it.t], it.t, [PIECE_MOVE[it.t], it.soul ? `${SOUL_BY_ID[it.soul].name}의 혼 · ${L(SOUL_BY_ID[it.soul].text)}` : '', '주머니에 들어온다']);
  if (it.kind === 'soul') { const s = SOUL_BY_ID[it.id]; return tipLines(`${s.name}의 혼`, [L(s.text), '기물 하나에 깃든다'], 150, [rarityLine(s.rarity)]); }
  if (it.kind === 'gamble') return tipLines(it.id === 'potion' ? '수상한 물약' : '룰렛', it.id === 'potion' ? '아무 기물에 무작위 혼이나 각인' : '아무 기물이 무작위 특수 기물로');
  if (it.kind === 'awaken') return tipLines('깨우기', [AWAKEN_TEXT, AWAKEN_MORE]);
  if (it.kind === 'evolve') return tipLines('진화', ['체스 기물 하나가 특수 기물로 자란다', '폰 › 궁수 · 화약병 · 나이트 › 낙타 · 광대 · 비숍 › 물수제비 · 까마귀 · 룩 › 포 · 유령 · 꺾쇠 · 퀸 › 아마존']);
  if (it.kind === 'tactic') { const x = TACTIC_BY_ID[it.id]; return tipLines(`전술 ${x.name}`, [x.text, '대국 중 떨구기 전에 쓴다']); }
  if (it.kind === 'fragment') { const l = LEGEND_BY_ID[it.legend]; return tipLines(l.name, ['조각 셋이면 전설', ...fragmentSteps(l, {}), `전설: ${l.text}`]); }
  return null;
}

// 물건이 채우는 시너지(격언 · 특수 기물 종류 · 혼)
export const itemFams = (it) => (it.kind === 'maxim' ? maximFamilies(it.id) : it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy ? PIECES[it.t].families : it.kind === 'soul' ? SOUL_BY_ID[it.id].families : []);
// 카드 옆 낱말 상자에 넘길 카드 글: 시너지 → 특수 기물 → 효과 글의 드문 낱말(app.draw가 둘까지).
// 카드의 종류(격언 · 각인 · 혼 …)는 카드 윗줄이 이미 말하고 처음 안내가 풀어 주어 상자를 띄우지 않는다
export function itemKeys(it) {
  const out = itemFams(it).map((f) => ({ id: `fam_${f}` }));
  if (it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy) out.push({ id: 'fairy' });
  out.push(itemEffect(it));
  if (it.edition) out.push({ id: 'edition' });
  return out;
}
// 카드에 이미 적힌 것 말고 덧붙일 것만(이야기 · 진화 갈래 · 행마 그림). 시너지는 카드의 칩이 말한다. 없으면 null
export function itemExtraTip(it) {
  const lines = [];
  // 기물 카드: 행마 그림. 행마 글은 카드에 이미 있으면 되풀이하지 않는다(혼이 깃든 기물은 카드에 혼 글이 서므로 행마 글을 여기에 — CHM-34)
  const more = it.kind === 'maxim' ? maximInfo(it.id).more : it.kind === 'soul' ? SOUL_BY_ID[it.id].more : null;
  if (it.kind === 'piece' && PIECE_MOVE[it.t] && it.soul) lines.push(PIECE_MOVE[it.t]);
  // 덧말이 있으면 효과 글 전부 다음에(덧말만 홀로 뜨지 않게)
  else if (more) lines.push(itemEffect(it));
  if (more) lines.push(more);
  if (it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy) lines.push(`${PIECE_NAME[chartForm(it.t)]} 기보가 적용된다`);
  if (it.kind === 'maxim') { const info = maximInfo(it.id); if (info.rarity === 'legendary' && info.story) lines.push(`${info.year ? info.year + ' · ' : ''}${L(info.story)}`); }
  if (it.kind === 'evolve') lines.push('폰 › 궁수 · 화약병 · 나이트 › 낙타 · 광대 · 비숍 › 물수제비 · 까마귀 · 룩 › 포 · 유령 · 꺾쇠 · 퀸 › 아마존');
  // 명국 조각(진열 · 꾸러미): 이 카드가 첫 조각이다 — 세 걸음 중 첫째가 다음 걸음
  if (it.kind === 'fragment') lines.push(...fragmentSteps(LEGEND_BY_ID[it.legend], {}), `전설: ${LEGEND_BY_ID[it.legend].text}`);
  if (it.kind === 'piece') return moveTip(itemName(it), it.t, lines);
  return lines.length ? tipLines(itemName(it), lines, 170) : null;
}

// 명국 조각 모양(금빛 깨진 판 조각)
export const SHARD_ROWS = ['..####..', '.######.', '########', '#######.', '.#####..', '..###...', '...#....'];
export function shardIcon(ctx, x, y, col = PAL.gold, dk = PAL.goldDk) {
  // 화면 배율 2 이상: 두 번 다듬은 32×28 반 도트 조각(art-hi.js, CHM-39 2단계)을 같은 16×14 자리에
  if (hiFor(ctx)) { ctx.drawImage(baked(`shard:${col}:${dk}`, SHARD_HI, { c: [col, 1], h: [PAL.goldHi, 1], d: [dk, 1] }), place(x), place(y), 16, 14); return; }
  const rows = SHARD_ROWS;
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') rect(ctx, x + i * 2, y + j * 2, 2, 2, (i + j) % 4 === 0 ? PAL.goldHi : j > 3 ? dk : col); });
}

// wide: 폭이 88보다 좁아도 넓은 카드로(꾸러미 카드 넷 — 효과 글을 카드에 그대로 적는다)
export function itemCard(ctx, it, x, y, w, h, { hover = false, sold = false, price = true, scaleX = 1, golden = false, t = 0, run = null, ui = null, under = null, wide = false } = {}) {
  if (scaleX <= 0.02) return;
  if (scaleX !== 1) {
    const nw = Math.max(2, Math.round(w * scaleX));
    x += Math.floor((w - nw) / 2); w = nw;
  }
  if (scaleX === 1 && (w >= 88 || wide)) return itemCardWide(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run, ui: scaleX === 1 ? ui : null, under });
  // 좁은 카드는 뒤집히는 순간에만 그린다(연출 — 글 넘침은 재지 않는다)
  openBox('card', x, y, w, h, 0, { loose: true, name: '뒤집히는 카드' });
  narrowCard(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run });
  closeBox();
}
function narrowCard(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run }) {
  const t0 = t;
  const back = false;
  const fill = golden ? '#f6d98a' : it.kind === 'fragment' ? '#f3e2b0' : PAL.card;
  if (it.edition && !sold) glow(ctx, x, y, w, h, EDITION_TINT[it.edition] || PAL.goldHi, 0.35 * flicker(t, 2.2, 0.35), 6);
  cardBase(ctx, x, y, w, h, { fill, hover });
  if (it.edition && !sold) editionShine(ctx, it.edition, x, y, w, h, t);
  if (hover) frame(ctx, x, y, w, h, PAL.gold);
  if (w < 30 || back) return;
  text(ctx, ITEM_KIND[it.kind], x + w / 2, y + 4, PAL.cardDim, { align: 'center' });
  const cx = x + Math.floor(w / 2);
  if (it.kind === 'maxim' || (it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy)) {
    const fams = it.kind === 'maxim' ? maximFamilies(it.id) : PIECES[it.t].families;
    familyGlyphs(ctx, fams, x + w - 8 * fams.length - 1, y + 4);
  }
  if (it.kind === 'maxim') {
    const info = maximInfo(it.id);
    rect(ctx, x + 6, y + 19, w - 12, 2, RARITY[info.rarity]);
    drawIcon(ctx, it.id, cx - 6, y + 25);
    const lines = wrap(info.name, w - 8, true);
    lines.slice(0, 2).forEach((l, k) => text(ctx, l, cx, y + 40 + k * LINE, PAL.cardInk, { align: 'center', bold: true }));
    if (it.edition) text(ctx, EDITION_BY_ID[it.edition].name, cx, y + h - 28, PAL.goldDk, { align: 'center' });
  } else if (it.kind === 'chart' || it.kind === 'piece') {
    const t = it.kind === 'chart' ? it.form : it.t;
    if (it.kind === 'chart') {
      box(ctx, cx - 13, y + 20, 26, 30, '#e8dcc0', PAL.cardDim);
      // 사면 오를 단계를 작게 미리: 내 기물이 그 단계의 모습으로
      const lv = run ? run.charts[t] || 0 : null;
      if (lv != null) {
        sprite(ctx, t, 'w', cx - 8, y + 24, { tier: tierOf(lv + 1) });
        text(ctx, `${lv} › ${lv + 1}`, cx, y + 66, PAL.cardDim, { align: 'center' });
      } else sprite(ctx, t, 'b', cx - 8, y + 24);
    } else sprite(ctx, t, 'w', cx - 8, y + 24, { tier: run ? tierOf(run.charts[chartForm(t)]) : 0, soul: it.soul || null, time: t0 });
    text(ctx, PIECE_NAME[t], cx, y + 54, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'engraving') {
    const col = ENG_EDGE[it.id] || PAL.gold;
    frame(ctx, x + 1, y + 1, w - 2, h - 2, col);
    cornerTicks(ctx, x + 3, y + 3, w - 6, h - 6, col, 3);
    engravingEmblem(ctx, it.id, cx - 11, y + 20);
    const e = engravingInfo(it.id);
    text(ctx, e.name, cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
    rect(ctx, cx - 10, y + 63, 20, 1, col);
  } else if (it.kind === 'gamble') {
    rect(ctx, cx - 11, y + 20, 22, 26, '#1b2b27');
    const hue = Math.floor(t * 200) % 360;
    text(ctx, '?', cx, y + 24, `hsl(${hue},70%,70%)`, { align: 'center', bold: true, scale: 2 });
    text(ctx, it.id === 'potion' ? '물약' : '룰렛', cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'evolve' || it.kind === 'tactic') {
    rect(ctx, cx - 11, y + 20, 22, 26, '#1b2b27');
    if (it.kind === 'evolve') { rect(ctx, cx - 11, y + 20, 22, 26, '#1b2b27'); rect(ctx, cx - 7, y + 33, 3, 3, PAL.ink); for (let i = 0; i < 4; i++) rect(ctx, cx - 3 + i, y + 32 - i, 1, 1, PAL.gold); rect(ctx, cx + 1, y + 25, 6, 8, PAL.gold); }
    else tacticIcon(ctx, it.id, cx - 8, y + 25);
    text(ctx, it.kind === 'evolve' ? '진화' : TACTIC_BY_ID[it.id].name, cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'awaken') {
    frame(ctx, x + 1, y + 1, w - 2, h - 2, PAL.gold);
    awakenArt(ctx, cx - 11, y + 20, t);
    text(ctx, '깨우기', cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'soul') {
    const s = SOUL_BY_ID[it.id];
    frame(ctx, x + 1, y + 1, w - 2, h - 2, s.col);
    rect(ctx, x + 6, y + 16, w - 12, 2, RARITY[s.rarity]);
    rect(ctx, cx - 11, y + 20, 22, 26, '#1b2b27');
    soulEmblem(ctx, it.id, cx - 11, y + 20, t);
    text(ctx, s.name, cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'fragment') {
    shardIcon(ctx, cx - 8, y + 22);
    const lines = wrap(LEGEND_BY_ID[it.legend].name, w - 8, true);
    lines.slice(0, 2).forEach((l, k) => text(ctx, l, cx, y + 42 + k * LINE, PAL.cardInk, { align: 'center', bold: true }));
  }
  if (sold) {
    ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
    text(ctx, '샀다', cx, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
  } else if (price && it.price != null) {
    text(ctx, `$${it.price}`, cx, y + h - 15, PAL.goldDk, { align: 'center', bold: true });
  }
}

// 넓은 카드(상점 진열 · 꾸러미): 윗줄 종류, 그림 옆에 이름, 그 아래 효과를 늘 적는다. 맨 아래에 시너지 칩과 흐린 쓰는 법.
function itemArt(ctx, it, x, y, t, run) {
  if (it.kind === 'maxim') { rect(ctx, x, y, 22, 26, '#e3d6b8'); drawIcon(ctx, it.id, x + 5, y + 7); return 22; }
  if (it.kind === 'piece') { rect(ctx, x, y, 22, 26, '#e3d6b8'); sprite(ctx, it.t, 'w', x + 3, y + 2, { tier: run ? tierOf(run.charts[chartForm(it.t)]) : 0, soul: it.soul || null, time: t }); return 22; }
  if (it.kind === 'chart') {
    // 모습 표: 점선 테 안의 흐린 윤곽 = 「이 모습일 때」
    rect(ctx, x, y, 22, 26, '#e8dcc0');
    dots(ctx, x, y, 22, 26, PAL.cardDim, 2);
    const lv = run ? run.charts[it.form] || 0 : 0;
    sprite(ctx, it.form, 'w', x + 3, y + 2, { tier: tierOf(lv + 1) });
    return 22;
  }
  if (it.kind === 'engraving') { engravingEmblem(ctx, it.id, x, y); return 22; }
  if (it.kind === 'soul') { soulEmblem(ctx, it.id, x, y, t); return 22; }
  if (it.kind === 'evolve') { evolveArt(ctx, x, y, t); return 44; }
  if (it.kind === 'awaken') { awakenArt(ctx, x, y, t); return 22; }
  if (it.kind === 'tactic') { rect(ctx, x, y, 22, 26, '#1b2b27'); tacticIcon(ctx, it.id, x + 3, y + 7); return 22; }
  if (it.kind === 'gamble') { rect(ctx, x, y, 22, 26, '#1b2b27'); text(ctx, '?', x + 11, y + 2, `hsl(${Math.floor(t * 200) % 360},70%,70%)`, { align: 'center', bold: true, scale: 2 }); return 22; }
  if (it.kind === 'fragment') { shardIcon(ctx, x + 3, y + 5); return 22; }
  return 0;
}
// 넓은 카드 쌓기(재기와 그리기가 같이 쓴다 — PAD_CARD · 토큰):
//   종류(머릿말, 오른쪽에 값) → 묶음 안 틈 → 그림 · 이름(제목 줄, 두 줄까지) → 묶음 틈(가운데 가로줄) → 효과 글 줄들(단계 · 판본 · 쓰는 법)
//   → 묶음 틈 → 시너지 칩 줄 → 안 여백. 효과 글은 자르지 않는다 — 카드가 글에 맞춰 길어진다.
function itemNameOf(it) { return it.kind === 'chart' ? `${PIECE_NAME[it.form]} 모습` : it.kind === 'engraving' ? engravingInfo(it.id).name : it.kind === 'soul' ? SOUL_BY_ID[it.id].name : itemName(it); }
const artW = (it) => (it.kind === 'evolve' ? 44 : 22);
// 카드의 칩 줄 수(못 놓은 시너지는 「+N」 — 전부는 가리키면 말풍선에)
export const CARD_CHIP_ROWS = 1;
export function itemCardLayout(it, w, { run = null, price = true } = {}) {
  const P = PAD_CARD, IW = w - P * 2;
  const f = flow(P);
  const out = { IW };
  // 종류(머릿말)는 값 왼쪽까지(길면 줄바꿈 — 영어 「Classic Fragment」), 값은 첫 줄 오른쪽
  // 머릿말 자리는 종류 딱지 뒤부터(딱지 바탕 끝과 글 사이 2 — 문양은 바탕 안쪽 한 칸이라 눈에는 3), 값과는 2 띄운다.
  // 영어 판본 이름(「Obsidian」 54)과 두 자리 값이 한 줄에 들어야 진열 카드가 160을 넘지 않는다(test/layout.test.js)
  const priceW = (price && it.price != null ? measure(`$${it.price}`, true) + 2 : 0) + TAB + TAB_GAP;
  // 판본 격언은 머릿말이 판본 이름(금빛, 「무지개 격언」 — 값 옆에 안 들어가면 「무지개」), 판본 효과는 효과 글 끝 줄(금빛)
  let kind = ITEM_KIND[it.kind];
  if (it.edition) { const ed = EDITION_BY_ID[it.edition].name; kind = measure(`${ed} ${kind}`) <= IW - priceW ? `${ed} ${kind}` : ed; }
  out.kindCol = it.edition ? PAL.goldDk : PAL.cardDim;
  // 종류 딱지(kinds.js — 14 = 머릿말 줄 높이)는 첫 줄 왼쪽, 머릿말 글은 그 오른쪽
  out.tabY = f.y;
  out.kindX = P + TAB + TAB_GAP;
  // 첫 줄은 값 옆(IW − priceW), 둘째 줄부터는 값 아래라 딱지 뒤 끝까지(IW − 딱지). 낱말 단위로만 줄을 바꾼다 —
  // 첫 낱말이 값 옆에 안 들어가면 첫 줄을 비우고 둘째 줄에(영어 「Awakening」 66 > 60, CHM-42: 글자 단위로 「Awakenin / g」가 됐었다)
  out.kinds = wrapHead(kind, IW - priceW, IW - TAB - TAB_GAP).map((l) => [l, f.line()]);
  f.gap(GAP_IN);
  const nx = artW(it) + 4, nw = IW - nx - (PAD_CARD > 4 ? 0 : 0);
  out.nameX = P + nx;
  out.names = wrap(itemNameOf(it), nw, true);
  const nameH = out.names.length * LINE_TITLE;
  const headH = Math.max(ART_H, nameH);
  const headTop = f.space(headH);
  out.art = headTop + Math.floor((headH - ART_H) / 2);
  const nameTop = headTop + Math.floor((headH - nameH) / 2);
  out.nameYs = out.names.map((_, k) => textY(nameTop + k * LINE_TITLE, LINE_TITLE));
  out.rule = f.y + Math.floor(GAP_GROUP / 2);
  f.gap(GAP_GROUP);
  const lines = [];
  for (const l of wrap(itemEffect(it), IW)) lines.push([l, PAL.cardInk]);
  if (it.kind === 'chart' && run) lines.push([`${run.charts[it.form] || 0} › ${(run.charts[it.form] || 0) + 1}단계`, PAL.cardDim]);
  if (it.edition) for (const l of wrap(L(EDITION_BY_ID[it.edition].text), IW)) lines.push([l, PAL.goldDk]);
  // 쓰는 법도 카드 폭에서 줄을 바꾼다(「금이 간 혼에 쓴다」 99 · 「Use on a cracked soul」 143 > 94가 카드 밖으로 넘쳤다, CHM-42)
  if (itemUse(it)) for (const l of wrap(itemUse(it), IW)) lines.push([l, PAL.cardDim]);
  out.lines = lines.map(([l, c]) => [l, c, f.line()]);
  const fams = itemFams(it);
  out.fams = fams;
  if (fams.length) { f.gap(GAP_GROUP); out.chips = f.space(chipBlockH(chipRows(fams, IW, CARD_CHIP_ROWS))); }
  out.h = f.y + P;
  return out;
}
// 머릿말 줄 바꿈: 첫 줄 폭 w1(값 옆), 다음 줄부터 w2. 낱말 단위로만 — 첫 낱말이 w1에 안 들어가면 첫 줄은 비운다.
// w2에도 안 들어가는 낱말만 wrap()이 글자 단위로 끊는다(test/layout.test.js가 모든 물건에서 그런 낱말이 없는지 잰다)
export function wrapHead(s, w1, w2) {
  const out = [];
  let line = '';
  for (const word of L(String(s)).split(' ')) {
    const w = out.length ? w2 : w1;
    const tryLine = line ? `${line} ${word}` : word;
    if (measure(tryLine) <= w) { line = tryLine; continue; }
    if (line || !out.length) { out.push(line); line = ''; }
    if (measure(word) <= w2) { line = word; continue; }
    const parts = wrap(word, w2);
    out.push(...parts.slice(0, -1)); line = parts[parts.length - 1];
  }
  out.push(line);
  return out;
}
// 넓은 카드 높이(폭 w). 한 줄의 카드는 가장 긴 카드에 맞춘다(itemRowH)
export const itemCardH = (it, w, opts = {}) => itemCardLayout(it, w, opts).h;
export const itemRowH = (items, w, opts = {}) => Math.max(0, ...items.filter(Boolean).map((it) => itemCardH(it, w, opts)));
function itemCardWide(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run, ui, under }) {
  const fill = golden ? '#f6d98a' : it.kind === 'fragment' ? '#f3e2b0' : PAL.card;
  const edge = it.kind === 'engraving' ? ENG_EDGE[it.id] : it.kind === 'soul' ? SOUL_BY_ID[it.id].col : null;
  openBox('card', x, y, w, h, PAD_CARD, { name: `카드 ${it.kind}` });
  if (it.edition && !sold) glow(ctx, x, y, w, h, EDITION_TINT[it.edition] || PAL.goldHi, 0.35 * flicker(t, 2.2, 0.35), 6);
  cardBase(ctx, x, y, w, h, { fill, hover, edge, ticks: true });
  const rar = it.kind === 'maxim' ? maximInfo(it.id).rarity : soulRarity(it);
  if (rar) rect(ctx, x + 2, y + 2, w - 4, 2, RARITY[rar]);
  if (it.edition && !sold) editionShine(ctx, it.edition, x, y, w, h, t);
  if (hover) frame(ctx, x, y, w, h, PAL.gold);
  const lay = itemCardLayout(it, w, { run, price });
  const P = PAD_CARD;
  kindTab(ctx, it.kind, x + P, y + lay.tabY);
  for (const [l, ly] of lay.kinds) if (l) text(ctx, l, x + lay.kindX, y + ly, lay.kindCol);
  const showPrice = price && it.price != null && !sold;
  if (showPrice) text(ctx, `$${it.price}`, x + w - P, y + lay.kinds[0][1], PAL.goldDk, { align: 'right', bold: true });
  itemArt(ctx, it, x + P, y + lay.art, t, run);
  lay.names.forEach((l, k) => text(ctx, l, x + lay.nameX, y + lay.nameYs[k], PAL.cardInk, { bold: true }));
  rect(ctx, x + P, y + lay.rule, lay.IW, 1, edge || PAL.cardDim);
  for (const [l, c, ly] of lay.lines) { if (c === PAL.cardInk) richText(ctx, l, x + P, y + ly, c, { ui: sold ? null : ui, under }); else text(ctx, l, x + P, y + ly, c); }
  // 칩 줄은 카드 아랫변에 붙인다(한 줄의 카드가 같은 높이라 칩이 한 줄로 맞는다)
  if (lay.fams.length) familyChips(ctx, lay.fams, x + P, y + lay.chips + (h - lay.h), lay.IW, CARD_CHIP_ROWS);
  if (sold) {
    ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
    text(ctx, '샀다', x + w / 2, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
  }
  closeBox();
}

// 새기기 · 깃들기 · 자라기 미리 보기: 고른 기물이 어떻게 되는지 보이고 확인을 받는다(기물을 누르자마자 새기지 않는다).
// what: { kind: 'engraving'|'soul'|'evolve', id }, p: 고른 기물(없으면 고르라는 말), to: 진화 결과 종류
// 자리(재기와 그리기가 같이 쓴다): 안 여백 PAD_BOX, 왼쪽에 고른 기물 › 된 모습(기물을 골랐으면), 그 오른쪽에 이름(제목 줄) → 묶음 틈 → 효과 글.
// 단추(「새긴다」 · 「그만」)는 폭이 넉넉하면(300 이상) 오른쪽에 세로로, 좁으면 글 아래 줄에 나란히.
const TP_BTN = { w: 58, h: BTN_S }; // 영어 「Engrave」(52) + 글과 테 사이 2 × 2 + 테
// 한 기물에 각인 하나 · 혼 하나(run.js engrave · ensoul은 있던 것을 바꾼다). 같은 종류가 이미 있으면 그 id(바꾸기), 같은 것이면 고를 수 없다
export const heldOf = (what, p) => (!p ? null : what.kind === 'engraving' ? (p.eng ? p.eng.id : null) : what.kind === 'soul' ? p.soul || null : null);
export const targetOk = (what, p) => !what || (what.kind === 'awaken' ? isCracked(p) : heldOf(what, p) !== what.id || what.kind === 'evolve');
// 바꾸기 모양(「옛 › 새」 · 바꾸기/그만)인가: 고른 기물에 다른 각인 · 혼이 이미 있다. 이때 「그만」 · Esc는 대상 고르기로 돌아간다
export const isSwap = (what, p) => { const held = heldOf(what, p); return !!held && held !== what.id; };
const markName = (kind, id) => (kind === 'engraving' ? engravingInfo(id).name : SOUL_BY_ID[id].name);
function targetText(run, what, p, to) {
  if (what.kind === 'awaken') {
    if (!p) return { title: '주머니에서 깨울 기물을 고른다', body: AWAKEN_TEXT };
    const s = SOUL_BY_ID[p.soul];
    return { title: `${s.name}의 혼이 깨어난다`, body: `각성 · ${L(s.awake)}`, after: { ...p, awake: true } };
  }
  const eff = what.kind === 'engraving' ? `${engravingInfo(what.id).name}: ${L(engravingInfo(what.id).text)}` : what.kind === 'soul' ? `${SOUL_BY_ID[what.id].name}의 혼: ${L(SOUL_BY_ID[what.id].text)}` : '체스 기물이 특수 기물로 자란다';
  if (!p) return { title: what.kind === 'engraving' ? '주머니에서 새길 기물을 고른다' : what.kind === 'soul' ? '주머니에서 깃들 기물을 고른다' : '주머니에서 자랄 기물을 고른다', body: eff };
  const after = what.kind === 'engraving' ? { ...p, eng: { id: what.id } } : what.kind === 'soul' ? { ...p, soul: what.id } : { ...p, t: to || p.t };
  // 바꾸기: 옛 것 › 새 것(문양 둘과 이름 둘)
  const held = heldOf(what, p);
  // 금이 갔거나 깨어난 혼을 바꾸면 그 사다리도 사라진다(run.js setSoul)
  const lose = what.kind === 'soul' && (p.awake ? '각성이 사라진다' : isCracked(p) ? '금이 사라진다' : null);
  if (isSwap(what, p)) return { title: `${markName(what.kind, held)} › ${markName(what.kind, what.id)}`, body: lose ? [eff, lose] : eff, after, swap: held };
  const title = what.kind === 'evolve' ? `${PIECE_NAME[p.t]} › ${PIECE_NAME[after.t]}` : `${PIECE_NAME[p.t]}에 ${what.kind === 'engraving' ? `${engravingInfo(what.id).name} 각인` : `${SOUL_BY_ID[what.id].name}의 혼`}`;
  return { title, body: what.kind === 'evolve' ? (PIECE_MOVE[after.t] || '') : eff, after };
}
export function targetPanelLayout(run, what, p, w, { to = null } = {}) {
  const P = PAD_BOX, side = w >= 300;
  const { title, body, after, swap = null } = targetText(run, what, p, to);
  const artW = p ? 56 : 0;
  const tw = w - P * 2 - artW - (side ? TP_BTN.w + 8 : 0);
  const f = flow(P);
  const titles = wrap(title, tw, true).map((l) => [l, f.line(true)]);
  f.gap(GAP_GROUP);
  const lines = [].concat(body).flatMap((b) => wrap(b, tw)).map((l) => [l, f.line()]);
  let h = Math.max(f.y, P + (p ? 28 : 0), P + (side ? TP_BTN.h * 2 + GAP_IN : 0));
  let btnY = P;
  if (!side) { btnY = h + GAP_GROUP; h = btnY + TP_BTN.h; }
  return { h: h + P, titles, lines, tx: P + artW, btnY, side, after, swap };
}
// 바꾸기(고른 기물에 같은 종류가 이미 있으면): 그림 자리에 옛 문양 › 새 문양, 제목 「옛 이름 › 새 이름」, 단추 「바꾸기」 · 「그만」.
//   이때 「그만」은 onBack(대상 고르기로 — 두루마리 · 꾸러미는 그대로)
export function targetPanel(ctx, ui, run, what, p, x, y, w, { to = null, onConfirm = null, onCancel = null, onBack = null, idPrefix = 'target' } = {}) {
  const lay = targetPanelLayout(run, what, p, w, { to });
  const h = lay.h, P = PAD_BOX;
  ui.region(`${idPrefix}:panel`, x, y, w, h, {});
  openBox('panel', x, y, w, h, P, { name: '새기기 미리 보기' });
  box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
  const verb = lay.swap ? '바꾸기' : what.kind === 'engraving' ? '새긴다' : what.kind === 'soul' ? '깃든다' : what.kind === 'awaken' ? '깨운다' : '자란다';
  if (p && lay.swap) {
    // 옛 문양(가리키면 옛 효과) › 새 문양(금빛 테)
    const mark = (id, mx, my) => (what.kind === 'engraving' ? engravingEmblem(ctx, id, mx, my) : soulEmblem(ctx, id, mx, my, ui.time));
    const old = lay.swap;
    ui.region(`${idPrefix}:swap`, x + P, y + P + 1, 22, 26, { tip: () => (what.kind === 'engraving' ? tipLines(`${engravingInfo(old).name} 각인`, engravingInfo(old).text) : tipLines(`${SOUL_BY_ID[old].name}의 혼`, SOUL_BY_ID[old].text)) });
    mark(old, x + P, y + P + 1);
    for (let i = 0; i < 3; i++) { rect(ctx, x + P + 24 + i, y + P + 11 + i, 1, 1, PAL.gold); rect(ctx, x + P + 24 + i, y + P + 17 - i, 1, 1, PAL.gold); }
    mark(what.id, x + P + 30, y + P + 1);
    frame(ctx, x + P + 29, y + P, 24, 28, PAL.gold);
  } else if (p) {
    const after = lay.after;
    pieceCard(ctx, p, x + P, y + P, 20, 28, { tier: tierOf(chartLevel(run, p.t)), level: chartLevel(run, p.t) });
    for (let i = 0; i < 3; i++) { rect(ctx, x + P + 24 + i, y + P + 11 + i, 1, 1, PAL.gold); rect(ctx, x + P + 24 + i, y + P + 17 - i, 1, 1, PAL.gold); }
    pieceCard(ctx, after, x + P + 30, y + P, 20, 28, { tier: tierOf(chartLevel(run, after.t)), level: chartLevel(run, after.t), time: ui.time, selected: true });
  }
  for (const [l, ly] of lay.titles) text(ctx, l, x + lay.tx, y + ly, PAL.gold, { bold: true });
  for (const [l, ly] of lay.lines) text(ctx, l, x + lay.tx, y + ly, PAL.ink);
  // 단추: 오른쪽 세로(넓을 때) · 아래 줄 오른쪽부터 나란히(좁을 때)
  const bx = x + w - P - TP_BTN.w;
  const okAt = lay.side ? [bx, y + P] : [bx - TP_BTN.w - 4, y + lay.btnY];
  const noAt = lay.side ? [bx, y + P + TP_BTN.h + GAP_IN] : [bx, y + lay.btnY];
  if (p && onConfirm) button(ctx, ui, `${idPrefix}:ok`, okAt[0], okAt[1], TP_BTN.w, TP_BTN.h, verb, { tone: 'gold', onClick: onConfirm });
  const back = lay.swap && onBack ? onBack : onCancel;
  if (back) button(ctx, ui, `${idPrefix}:cancel`, noAt[0], noAt[1], TP_BTN.w, TP_BTN.h, '그만', { onClick: back });
  closeBox();
  return h;
}

// ── 불멸의 기보 조각 띠: 조각을 하나라도 모은 명국마다 작은 조각 + 모은 수. 올리면 명국 · 조각 · 재현 조건(첫 조각 뒤에만).
export function miniShard(ctx, x, y, col = PAL.gold) {
  const rows = ['.###.', '#####', '####.', '.##..', '..#..'];
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, j === 0 && i === 1 ? PAL.goldHi : col); });
}
// 조각 세 걸음(첫 → 재현 → 금빛 차례로만 모인다 — legends.js): 한 줄에 하나, 그 조각을 얻는 길로.
// f = 이 판의 조각({ first, feat, gold }). null이면 판 밖(도감): 얻은 것 · 다음 것을 가르지 않는다.
// 재현 조건은 첫 조각을 가진 뒤에만 드러난다(HOOKS 「불멸의 기보」) — 첫 조각이 없으면 「명국 재현」(낱말 상자가 풀어 준다)
export function fragmentSteps(l, f) {
  const feat = !f || f.first ? l.feat : '명경기 재현';
  const steps = [['first', `첫째: ${FRAG_SOURCE[l.source]}`], ['feat', `둘째: ${feat}`], ['gold', '셋째: 금빛 적을 먹고 이긴다']];
  const next = f ? steps.findIndex(([k]) => !f[k]) : -1;
  return steps.map(([k, s], i) => ({ step: !f ? 'step' : f[k] ? 'done' : i === next ? 'next' : 'todo', s }));
}
export function fragmentTip(run, l) {
  // 첫 줄은 걸음 셋이 말하는 것을 되풀이한다 — 자리가 모자라면 먼저 뺀다
  return tipLines(l.name, [optLine('조각 셋이면 전설'), ...fragmentSteps(l, run.fragments[l.id] || {})]);
}
// max: 놓을 수 있는 조각 수(좁은 칸 — 상금 칸 안)
export function fragmentStrip(ctx, ui, run, x, y, { align = 'left', max = 9, step = 15 } = {}) {
  const list = LEGENDS.filter((l) => { const f = run.fragments[l.id]; return f && (f.first || f.feat || f.gold) && !run.legends.includes(l.id); }).slice(0, Math.max(0, max));
  const w = step;
  let xx = align === 'right' ? x - list.length * w : x;
  for (const l of list) {
    const f = run.fragments[l.id];
    const n = (f.first ? 1 : 0) + (f.feat ? 1 : 0) + (f.gold ? 1 : 0);
    ui.region(`frag:${l.id}`, xx, y - 1, w - 1, 11, { tip: () => fragmentTip(run, l) });
    miniShard(ctx, xx, y + 2, ui.isHover(`frag:${l.id}`) ? PAL.goldHi : PAL.gold);
    ctx.fillStyle = PAL.gold;
    const DIG = { 1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'] };
    DIG[n].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '1') ctx.fillRect(xx + 7 + i, y + 2 + j, 1, 1); });
    xx += w;
  }
  return list.length * w;
}

// 묘수 그림 16×16: 빙결 = 눈송이 · 재장전 = 수 구슬 더하기 · 도발 = 손짓하는 폰
export const TACTIC_G = {
  freeze: ['.......#........', '...#...#...#....', '....#..#..#.....', '.....#.#.#......', '......###.......', '.#############..', '......###.......', '.....#.#.#......', '....#..#..#.....', '...#...#...#....', '.......#........'],
  reload: ['................', '..##########....', '..#........#....', '..##########....', '................', '.......##.......', '.......##.......', '....########....', '....########....', '.......##.......', '.......##.......'],
  taunt: ['......##........', '.....####....#..', '.....####...#...', '......##...#....', '....######......', '......##........', '......##........', '.....####.......', '....######......', '...########.....', '................'],
};
export const TACTIC_COL = { freeze: '#9fd3e0', reload: '#efbd55', taunt: '#df8a45' };
export function tacticIcon(ctx, id, x, y) {
  const G = TACTIC_G[id] || [];
  const col = TACTIC_COL[id] || '#ffffff';
  // 화면 배율 2 이상: 32×22 반 도트 그림(art-hi.js, CHM-39 2단계)을 같은 16×11 자리에
  if (TACTIC_HI[id] && hiFor(ctx)) { ctx.drawImage(baked(`tactic:${id}`, TACTIC_HI[id], { '#': [col, 1] }), place(x), place(y), 16, 11); return; }
  G.forEach((r, j) => { for (let i = 0; i < 16; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, col); });
}
