// 여러 화면이 같이 쓰는 조각: 격언 칸, 손 기물 카드, 상금, 말풍선 내용.
import { PAL, RARITY, EDITION_TINT } from '../render/palette.js';
import { box, rect, text, frame, dots, sprite, measure, line } from '../render/gfx.js';
import { button } from './ui.js';
import { ENG_EDGE, tierOf } from '../render/sprites.js';
import { maximFamilies, FAMILY_BY_ID } from '../data/families.js';
import { PIECES, chartForm } from '../data/pieces.js';
import { SOUL_BY_ID } from '../data/souls.js';
import { TACTIC_BY_ID } from '../data/tactics.js';
import { L } from './lang.js';
import { familyGlyphs } from './parts-depth.js';
import { maximInfo, engravingInfo, maximCapacity, maximCount } from '../sim/run.js';
import { EDITION_BY_ID } from '../data/editions.js';
import { CHARTS, chartText } from '../data/charts.js';
import { PIECE_NAME, PIECE_MOVE } from './words.js';
import { wrap } from '../render/text.js';
import { LEGEND_BY_ID, LEGENDS } from '../data/legends.js';
import { drawIcon } from '../render/icons.js';

// 말풍선 내용(제목 · 줄들)을 너비에 맞게
export function tipLines(title, body, w = 150, extra = []) {
  const lines = [];
  for (const s of [].concat(body)) if (s) for (const l of wrap(s, w - 10)) lines.push(l);
  return { title, lines: [...lines, ...extra], w };
}

export function maximTip(m) {
  const info = maximInfo(m.id);
  const extra = [];
  if (m.edition) {
    const e = EDITION_BY_ID[m.edition];
    extra.push([`${e.name} · ${e.text}`, PAL.goldDk]);
  }
  const fams = maximFamilies(m.id);
  if (fams.length) extra.push([fams.map((f) => FAMILY_BY_ID[f].name).join(' · '), FAMILY_BY_ID[fams[0]].col === '#efbd55' ? PAL.goldDk : PAL.cardDim]);
  if (info.rarity === 'legendary' && info.story) for (const l of wrap(`${info.year ? info.year + ' · ' : ''}${info.story}`, 140)) extra.push([l, PAL.goldDk]);
  return tipLines(info.name, info.text, 150, extra);
}

export function pieceTip(p) {
  const lines = [];
  if (PIECE_MOVE[p.t]) lines.push(PIECE_MOVE[p.t]);
  if (p.eng) { const e = engravingInfo(p.eng.id); lines.push(`${e.name} 각인 · ${e.text}`); }
  if (p.soul && SOUL_BY_ID[p.soul]) { const s = SOUL_BY_ID[p.soul]; lines.push(`${s.name}의 혼 · ${L(s.text)}`); }
  return tipLines(PIECE_NAME[p.t], lines);
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

// 격언 카드 하나(이름 + 동사). h가 작으면 이름만.
export function maximCard(ctx, m, x, y, w, h, { off = false, hot = false, lift = 0, t = 0 } = {}) {
  const info = maximInfo(m.id);
  const legendary = info.rarity === 'legendary';
  const obsidian = m.edition === 'obsidian';
  y -= lift;
  const fill = legendary ? '#f6d98a' : obsidian ? '#231a2c' : PAL.card;
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
  if (h >= 14) drawIcon(ctx, m.id, x + w - 15, y + Math.floor((h - 12) / 2), off ? 0.35 : 1);
  text(ctx, info.name, x + 6, y + Math.max(2, Math.min(3, h - 14)), ink, { bold: true });
  if (h >= 28) {
    const sub = off ? '잠듦' : m.edition ? EDITION_BY_ID[m.edition].name : legendary ? '전설' : info.verb;
    text(ctx, sub, x + 6, y + 16, off ? PAL.red : obsidian ? '#b89ad8' : PAL.cardDim);
  }
  if (off) { rect(ctx, x + 4, y + Math.floor(h / 2), w - 8, 1, PAL.red); }
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

// 격언 칸 목록(오른쪽 판). 칸 수에 맞춰 카드 높이를 줄인다. 돌려주는 값: 카드 자리들
export function maximColumn(ctx, ui, run, x, y, w, hTotal, { idPrefix = 'maxim', offUids = [], onClick = null, drag = null, hotIndex = -1 } = {}) {
  const maxims = run.maxims;
  const cap = maximCapacity(run);
  const legends = maxims.filter((m) => m.legendary).length;
  const slots = Math.max(cap + legends, maxims.length);
  const gap = 4;
  const h = Math.min(32, Math.floor((hTotal + gap) / slots) - gap);
  const spots = [];
  for (let i = 0; i < slots; i++) {
    const yy = y + i * (h + gap);
    const m = maxims[i];
    if (!m) {
      dots(ctx, x, yy, w, h, PAL.feltHi, 3);
      continue;
    }
    const id = `${idPrefix}:${i}`;
    const r = ui.region(id, x, yy, w, h, { tip: () => maximTip(m), onClick: onClick ? () => onClick(i, m) : null, drag: drag ? true : false, onDrop: drag ? (mx, my) => drag(i, mx, my) : null });
    const dragging = ui.drag && ui.drag.region === r && ui.drag.moved;
    if (dragging) { dots(ctx, x, yy, w, h, PAL.gold, 2); spots.push({ i, x, y: yy, w, h }); continue; }
    maximCard(ctx, m, x, yy, w, h, { off: offUids.includes(m.uid), hot: ui.isHover(id) || hotIndex === i, lift: ui.isHover(id) && (onClick || drag) ? 1 : 0, t: ui.time + i * 0.37 });
    spots.push({ i, x, y: yy, w, h });
  }
  // 끌고 있는 카드는 마우스를 따라 그린다
  if (ui.drag && ui.drag.moved && ui.drag.region.id.startsWith(idPrefix + ':')) {
    const i = Number(ui.drag.region.id.split(':')[1]);
    if (maxims[i]) maximCard(ctx, maxims[i], ui.mouse.x - Math.floor(w / 2), ui.mouse.y - Math.floor(h / 2), w, h, { hot: true, t: ui.time });
  }
  return { spots, h, gap, slots, count: maximCount(run), cap };
}

// 손 기물 카드: 각인은 기물 몸의 톤으로, 카드는 안쪽 테만 각인 색. tier: 그 종류의 기보 단계
export const ENG_FILL = { ivory: '#f7efdb', glass: '#bfe0e6', gold: '#f3d27a', ebony: '#6b5a52', silver: '#d8dee6', feather: '#e8e0f0' };
export function pieceCard(ctx, p, x, y, w, h, { lift = 0, selected = false, hover = false, dim = false, alpha = 1, tier = 0, time = null, flash = 0 } = {}) {
  const yy = y - lift;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  box(ctx, x, yy, w, h, PAL.light, selected ? PAL.gold : hover ? PAL.goldDk : PAL.frameDk);
  rect(ctx, x + 1, yy + 1, w - 2, 1, PAL.cardHi);
  if (selected) frame(ctx, x - 1, yy - 1, w + 2, h + 2, PAL.gold);
  if (p.eng && ENG_EDGE[p.eng.id]) { frame(ctx, x + 1, yy + 1, w - 2, h - 2, ENG_EDGE[p.eng.id]); cornerTicks(ctx, x + 2, yy + 2, w - 4, h - 4, ENG_EDGE[p.eng.id]); }
  sprite(ctx, p.t, 'w', x + Math.floor((w - 16) / 2), yy + Math.floor((h - 22) / 2) + 1, { alpha: dim ? 0.5 : 1, eng: p.eng ? p.eng.id : null, tier, time, soul: p.soul || null });
  if (flash > 0) { ctx.globalAlpha = flash * 0.8; rect(ctx, x + 1, yy + 1, w - 2, h - 2, PAL.white); ctx.globalAlpha = 1; }
  if (alpha !== 1) ctx.globalAlpha = 1;
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
const EMBLEM = {
  gold: { c: { o: '#6b4410', m: '#c8902c', h: '#efbd55', w: '#fff1b8' }, g: ['.....oooooo.....', '...oommmmmmoo...', '..ommhhhhhhmmo..', '.omhhwwhhhhhhmo.', '.omhwwhhhhhhhmo.', 'omhhhhmmmmhhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhmhhhhmhhhmo', 'omhhhhmmmmhhhhmo', '.omhhhhhhhhhhmo.', '.omhhhhhhhhhhmo.', '..ommhhhhhhmmo..', '...oommmmmmoo...', '.....oooooo.....'] },
  silver: { c: { o: '#4a5560', m: '#9aa6b0', h: '#d8dee6', w: '#ffffff' }, g: ['................', '................', '..oooooooooooo..', '.ohhhhhhhhhhhmo.', '.ohwwhhhhhhhhmo.', '.ohwhhhhhhhhhmo.', '.ohhhhhwhhhhhmo.', '.ohhhhwhhhhhhmo.', '.ohhhwhhhhhhhmo.', '.ohhhhhhhhhwhmo.', '.ohhhhhhhhwhhmo.', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................', '................'] },
  ivory: { c: { o: '#8a6a4a', m: '#d8c4a4', h: '#f7efdb', w: '#ffffff' }, g: ['..........oo....', '.........ohho...', '........ohwho...', '.......ohwhho...', '......ohwhhmo...', '.....ohhhhmo....', '....ohhhhmo.....', '...ohhhhmo......', '..ohhhhmo.......', '..ohhhmo........', '.ohhhmo.........', '.ohhmmo.........', '.ohmmo..........', '..oooo..........', '................', '................'] },
  ebony: { c: { o: '#1e1612', m: '#3e2f28', h: '#6b5a52', w: '#c8902c' }, g: ['................', '................', '...ooooooooo....', '..ohhmhhhhhmoo..', '..ohmhhhmhhhhmo.', '.ohhmhhhmhhhhmo.', '.ohmhhhhmhhhhhmo', '.ommmhhhhmmhhhmo', '.ohhhmmhhhhmmmmo', '.ohhhhhmhhhhhhmo', '..ohhhhmhhhwhmo.', '..ommmmmmmmmmo..', '...oooooooooo...', '................', '................', '................'] },
  glass: { c: { o: '#3f7f8a', m: '#6fb8c4', h: '#bfe0e6', w: '#ffffff' }, g: ['.......o........', '......owo.......', '......owho......', '.....owhho......', '.....owhhho.....', '....owhhhho.....', '....owhhhhmo....', '...owhhhhhmo....', '...owhhhhhhmo...', '..owhhhhhhhmo...', '..owhhhhhhhhmo..', '.owhhhhhhhhhmo..', '.ommmmmmmmmmmmo.', '..oooooooooooo..', '................', '................'] },
  feather: { c: { o: '#3a6a60', m: '#6fd1bf', h: '#e8e0f0', w: '#ffffff' }, g: ['...........ooo..', '.........oohhmo.', '........ohhhhmo.', '.......ohhhhmo..', '......ohhwhmo...', '.....ohhwhmo....', '....ohhwhmo.....', '....ohwhmo......', '...ohwhmo.......', '...owhmo........', '..owmo..........', '..omo...........', '.oo.............', 'o...............', '................', '................'] },
};
export function engravingEmblem(ctx, id, x, y, { sq = true } = {}) {
  if (sq) { rect(ctx, x, y, 22, 26, '#1b2b27'); rect(ctx, x + 1, y + 1, 20, 1, '#2a3a33'); }
  const e = EMBLEM[id];
  if (!e) return;
  e.g.forEach((r, j) => { for (let i = 0; i < 16; i++) { const k = r[i]; if (k !== '.') rect(ctx, x + 3 + i, y + 5 + j, 1, 1, e.c[k]); } });
}
// 혼 그림: 기물 없이 혼의 빛깔로 도는 기운(혼도 주머니의 어느 기물에나 깃든다)
export function soulEmblem(ctx, id, x, y, t = 0, { sq = true } = {}) {
  const s = SOUL_BY_ID[id];
  if (sq) rect(ctx, x, y, 22, 26, '#1b2b27');
  const cx = x + 11, cy = y + 13;
  for (let r = 8; r >= 2; r -= 2) { ctx.globalAlpha = 0.18 + (8 - r) * 0.06; for (let a = 0; a < 24; a++) { const q = (a / 24) * Math.PI * 2; rect(ctx, Math.round(cx + Math.cos(q) * r), Math.round(cy + Math.sin(q) * r), 1, 1, s.col); } }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 3; k++) { const q = t * 2 + (k * Math.PI * 2) / 3; rect(ctx, Math.round(cx + Math.cos(q) * 6), Math.round(cy + Math.sin(q) * 6), 2, 2, s.col); }
  rect(ctx, cx - 1, cy - 1, 3, 3, PAL.white);
}
// 진화 그림: 체스 기물 › 이형(나이트 › 야간기사)
export function evolveArt(ctx, x, y, t = 0) {
  rect(ctx, x, y, 44, 26, '#1b2b27');
  sprite(ctx, 'N', 'w', x + 1, y + 2);
  const k = Math.floor(t * 3) % 2;
  for (let i = 0; i < 3; i++) rect(ctx, x + 19 + i + k, y + 11 + i, 1, 1, PAL.gold), rect(ctx, x + 19 + i + k, y + 15 - i, 1, 1, PAL.gold);
  sprite(ctx, 'H', 'w', x + 26, y + 2, { tier: 1 });
}

// 카드에 적는 효과 한 줄(말풍선은 덧붙임만)
export const CHESS_MOVE = { P: '대각선 앞 한 칸의 적을 먹는다', N: 'ㄱ자로 뛰어 먹는다', B: '대각선으로 미끄러져 먹는다', R: '가로 · 세로로 미끄러져 먹는다', Q: '여덟 방향으로 미끄러져 먹는다' };
export function itemEffect(it) {
  if (it.kind === 'maxim') return maximInfo(it.id).text;
  if (it.kind === 'chart') return chartText(it.form);
  if (it.kind === 'engraving') return engravingInfo(it.id).text;
  if (it.kind === 'piece') return (it.soul ? `${SOUL_BY_ID[it.soul].name}의 혼: ${L(SOUL_BY_ID[it.soul].text)}` : PIECE_MOVE[it.t] || CHESS_MOVE[it.t] || '');
  if (it.kind === 'soul') return SOUL_BY_ID[it.id].text;
  if (it.kind === 'evolve') return '주머니 기물 하나가 그 종류의 이형으로 자란다';
  if (it.kind === 'tactic') return TACTIC_BY_ID[it.id].text;
  if (it.kind === 'gamble') return it.id === 'potion' ? '주머니의 아무 기물에 아무 혼이나 각인이 붙는다' : '주머니의 아무 기물이 아무 이형이 된다';
  if (it.kind === 'fragment') return `조각 셋을 모으면 전설: ${LEGEND_BY_ID[it.legend].text}`;
  return '';
}
// 어떻게 쓰나(카드 아래 흐린 한 줄)
export function itemUse(it) {
  if (it.kind === 'engraving') return '주머니 기물 하나에 새긴다';
  if (it.kind === 'soul') return '주머니 기물 하나에 깃든다';
  if (it.kind === 'evolve') return '주머니 기물 하나를 고른다';
  if (it.kind === 'tactic') return '대국 중 떨구기 전에 쓴다';
  if (it.kind === 'piece') return '주머니에 들어온다';
  return '';
}

// 작은 동전 아이콘 + 상금
export function moneyText(ctx, n, x, y, align = 'left') {
  return text(ctx, `$${n}`, x, y, PAL.gold, { bold: true, align });
}

// 무르기 아이콘(돌아가는 화살)
export function discardIcon(ctx, x, y, col) {
  rect(ctx, x + 1, y, 5, 1, col); rect(ctx, x, y + 1, 1, 5, col); rect(ctx, x + 1, y + 6, 5, 1, col);
  rect(ctx, x + 6, y + 4, 1, 2, col); rect(ctx, x + 5, y - 1, 1, 3, col); rect(ctx, x + 6, y, 1, 1, col);
}

// 패널: 윗변 한 줄 빛, 아랫변 한 줄 그늘
export function panel(ctx, x, y, w, h) {
  box(ctx, x, y, w, h, PAL.feltDk, PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, '#1f302a');
  rect(ctx, x + 1, y + h - 2, w - 2, 1, '#0e1813');
}

export const labelW = (s) => measure(s);

// ── 꾸러미 봉투: 접힌 덮개 · 봉랍(기물 상아 · 기보 청록 · 각인 자줏빛 · 금빛 금별).
// open 0 → 1: 봉랍이 금 가며 깨지고(0~0.4) 덮개가 젖혀진다(0.4~1)
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
  // 봉랍
  const [col, hi, dk] = SEAL[kind] || SEAL.piece;
  const sx = x + Math.floor(w / 2), sy = cy - 2;
  const crack = Math.min(1, open / 0.4);
  if (flap < 0.3) {
    const R = 6;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const d = i * i + j * j;
      if (d > R * R) continue;
      const half = i < 0 ? -1 : 1;
      const off = crack > 0.3 ? Math.round(half * crack * 3) : 0;
      const drop = crack > 0.3 ? Math.round(crack * crack * 4) : 0;
      rect(ctx, sx + i + off, sy + j + drop, 1, 1, d > (R - 1) * (R - 1) ? dk : (i + j < -3 ? hi : col));
    }
    // 봉랍 무늬: 금빛은 별, 나머지는 작은 기물 머리
    if (crack < 0.3) {
      if (gold) { for (const [i, j] of [[0, -3], [-1, -1], [0, -1], [1, -1], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-1, 1], [0, 1], [1, 1], [-2, 3], [2, 3], [-1, 2], [1, 2]]) rect(ctx, sx + i, sy + j, 1, 1, dk); }
      else { rect(ctx, sx - 1, sy - 3, 2, 2, dk); rect(ctx, sx - 2, sy - 1, 4, 1, dk); rect(ctx, sx - 1, sy, 2, 2, dk); rect(ctx, sx - 3, sy + 2, 6, 1, dk); }
    } else rect(ctx, sx, sy - 5, 1, 11, dk);
  }
}

// ── 상점 · 꾸러미 물건 카드
export const ITEM_KIND = { maxim: '격언', chart: '기보', engraving: '각인', piece: '기물', fragment: '명국 조각', soul: '혼', evolve: '진화', tactic: '묘수', gamble: '도박' };

export function itemName(it) {
  if (it.kind === 'maxim') return maximInfo(it.id).name;
  if (it.kind === 'chart') return CHARTS[it.form].name;
  if (it.kind === 'engraving') return `${engravingInfo(it.id).name} 각인`;
  if (it.kind === 'piece') return PIECE_NAME[it.t];
  if (it.kind === 'soul') return `${SOUL_BY_ID[it.id].name}의 혼`;
  if (it.kind === 'evolve') return '진화';
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
  if (it.kind === 'engraving') { const e = engravingInfo(it.id); return tipLines(`${e.name} 각인`, [e.text, '주머니의 기물 하나에 새긴다']); }
  if (it.kind === 'piece') return tipLines(PIECE_NAME[it.t], [PIECE_MOVE[it.t], it.soul ? `${SOUL_BY_ID[it.soul].name}의 혼 · ${L(SOUL_BY_ID[it.soul].text)}` : '', '주머니에 들어온다']);
  if (it.kind === 'soul') { const s = SOUL_BY_ID[it.id]; return tipLines(`${s.name}의 혼`, [L(s.text), '주머니의 기물 하나에 깃든다']); }
  if (it.kind === 'gamble') return tipLines(it.id === 'potion' ? '수상한 물약' : '룰렛', it.id === 'potion' ? '주머니의 아무 기물에 아무 혼이나 각인이 붙는다' : '주머니의 아무 기물이 아무 이형이 된다');
  if (it.kind === 'evolve') return tipLines('진화', ['주머니의 기물 하나가 그 종류의 이형으로 자란다', '폰 › 궁수 · 나이트 › 야간기사 · 낙타 · 비숍 › 대주교 · 룩 › 재상 · 포 · 유령 · 퀸 › 아마존']);
  if (it.kind === 'tactic') { const x = TACTIC_BY_ID[it.id]; return tipLines(`묘수 ${x.name}`, [x.text, '대국 중 떨구기 전에 쓴다']); }
  if (it.kind === 'fragment') { const l = LEGEND_BY_ID[it.legend]; return tipLines(`${l.name} · 첫 조각`, [l.story, `전설: ${l.text}`]); }
  return null;
}

// 카드에 이미 적힌 것 말고 덧붙일 것만(가족 · 이야기 · 진화 갈래). 없으면 null
export function itemExtraTip(it) {
  const lines = [];
  const fams = it.kind === 'maxim' ? maximFamilies(it.id) : it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy ? PIECES[it.t].families : it.kind === 'soul' ? SOUL_BY_ID[it.id].families : [];
  if (fams.length) lines.push(`가족: ${fams.map((f) => FAMILY_BY_ID[f].name).join(' · ')} — 같은 가족을 2 · 4 · 6 모으면 효과`);
  if (it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy) lines.push(`기보는 ${PIECE_NAME[chartForm(it.t)]} 모습을 따른다`);
  if (it.kind === 'maxim') { const info = maximInfo(it.id); if (info.rarity === 'legendary' && info.story) lines.push(`${info.year ? info.year + ' · ' : ''}${info.story}`); }
  if (it.kind === 'evolve') lines.push('폰 › 궁수 · 나이트 › 야간기사 · 낙타 · 비숍 › 대주교 · 룩 › 재상 · 포 · 유령 · 퀸 › 아마존');
  if (it.kind === 'chart') lines.push('모습: 사슬 한가운데 내 기물이 지금 입은 기물');
  if (it.kind === 'fragment') lines.push(LEGEND_BY_ID[it.legend].story);
  return lines.length ? tipLines(itemName(it), lines, 170) : null;
}

// 명국 조각 모양(금빛 깨진 판 조각)
export function shardIcon(ctx, x, y, col = PAL.gold, dk = PAL.goldDk) {
  const rows = ['..####..', '.######.', '########', '#######.', '.#####..', '..###...', '...#....'];
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') rect(ctx, x + i * 2, y + j * 2, 2, 2, (i + j) % 4 === 0 ? PAL.goldHi : j > 3 ? dk : col); });
}

export function itemCard(ctx, it, x, y, w, h, { hover = false, sold = false, price = true, scaleX = 1, golden = false, t = 0, run = null } = {}) {
  const t0 = t;
  if (scaleX <= 0.02) return;
  if (scaleX !== 1) {
    const nw = Math.max(2, Math.round(w * scaleX));
    x += Math.floor((w - nw) / 2); w = nw;
  }
  if (w >= 88) return itemCardWide(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run });
  const back = scaleX < 1 && it._back;
  const fill = golden ? '#f6d98a' : it.kind === 'fragment' ? '#f3e2b0' : PAL.card;
  box(ctx, x, y, w, h, fill, hover ? PAL.gold : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
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
    lines.slice(0, 2).forEach((l, k) => text(ctx, l, cx, y + 40 + k * 13, PAL.cardInk, { align: 'center', bold: true }));
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
  } else if (it.kind === 'soul') {
    const s = SOUL_BY_ID[it.id];
    frame(ctx, x + 1, y + 1, w - 2, h - 2, s.col);
    rect(ctx, cx - 11, y + 20, 22, 26, '#1b2b27');
    soulEmblem(ctx, it.id, cx - 11, y + 20, t);
    text(ctx, s.name, cx, y + 50, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'fragment') {
    shardIcon(ctx, cx - 8, y + 22);
    const lines = wrap(LEGEND_BY_ID[it.legend].name, w - 8, true);
    lines.slice(0, 2).forEach((l, k) => text(ctx, l, cx, y + 42 + k * 13, PAL.cardInk, { align: 'center', bold: true }));
  }
  if (sold) {
    ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
    text(ctx, '샀다', cx, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
  } else if (price && it.price != null) {
    text(ctx, `$${it.price}`, cx, y + h - 15, PAL.goldDk, { align: 'center', bold: true });
  }
}

// 넓은 카드(상점 진열 · 꾸러미): 윗줄 종류 · 가족, 그림 옆에 이름, 그 아래 효과를 늘 적는다. 쓰는 법은 흐리게 맨 아래.
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
  if (it.kind === 'tactic') { rect(ctx, x, y, 22, 26, '#1b2b27'); tacticIcon(ctx, it.id, x + 3, y + 7); return 22; }
  if (it.kind === 'gamble') { rect(ctx, x, y, 22, 26, '#1b2b27'); text(ctx, '?', x + 11, y + 2, `hsl(${Math.floor(t * 200) % 360},70%,70%)`, { align: 'center', bold: true, scale: 2 }); return 22; }
  if (it.kind === 'fragment') { shardIcon(ctx, x + 3, y + 5); return 22; }
  return 0;
}
function itemCardWide(ctx, it, x, y, w, h, { hover, sold, price, golden, t, run }) {
  const fill = golden ? '#f6d98a' : it.kind === 'fragment' ? '#f3e2b0' : PAL.card;
  box(ctx, x, y, w, h, fill, hover ? PAL.gold : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  const edge = it.kind === 'engraving' ? ENG_EDGE[it.id] : it.kind === 'soul' ? SOUL_BY_ID[it.id].col : null;
  if (edge) { frame(ctx, x + 1, y + 1, w - 2, h - 2, edge); cornerTicks(ctx, x + 3, y + 3, w - 6, h - 6, edge, 3); }
  if (it.kind === 'maxim') rect(ctx, x + 2, y + 2, w - 4, 2, RARITY[maximInfo(it.id).rarity]);
  if (it.edition && !sold) editionShine(ctx, it.edition, x, y, w, h, t);
  if (hover) frame(ctx, x, y, w, h, PAL.gold);
  text(ctx, ITEM_KIND[it.kind], x + 5, y + 4, PAL.cardDim);
  const fams = it.kind === 'maxim' ? maximFamilies(it.id) : it.kind === 'piece' && PIECES[it.t] && PIECES[it.t].fairy ? PIECES[it.t].families : it.kind === 'soul' ? SOUL_BY_ID[it.id].families : [];
  if (fams.length) familyGlyphs(ctx, fams, x + w - 8 * fams.length - 3, y + 6);
  const aw = itemArt(ctx, it, x + 5, y + 18, t, run);
  const nx = x + 5 + aw + 4, nw = x + w - 4 - nx;
  const name = it.kind === 'chart' ? `${PIECE_NAME[it.form]} 모습` : it.kind === 'engraving' ? engravingInfo(it.id).name : it.kind === 'soul' ? SOUL_BY_ID[it.id].name : itemName(it);
  const nl = wrap(name, nw, true).slice(0, 2);
  nl.forEach((l, k) => text(ctx, l, nx, y + 18 + (nl.length === 1 ? 7 : 0) + k * 13, PAL.cardInk, { bold: true }));
  rect(ctx, x + 5, y + 47, w - 10, 1, edge || PAL.cardDim);
  const foot = (price && it.price != null && !sold) ? 16 : 2;
  const use = wrap(itemUse(it), w - 10).slice(0, 2);
  let yy = y + 50;
  const bottom = y + h - foot - use.length * 12;
  const lines = [];
  for (const l of wrap(itemEffect(it), w - 10)) lines.push([l, PAL.cardInk]);
  if (it.kind === 'chart' && run) lines.push([`${run.charts[it.form] || 0} › ${(run.charts[it.form] || 0) + 1}단계`, PAL.cardDim]);
  if (it.edition) for (const l of wrap(`${EDITION_BY_ID[it.edition].name}: ${L(EDITION_BY_ID[it.edition].text)}`, w - 10)) lines.push([l, PAL.goldDk]);
  for (const [l, c] of lines) { if (yy + 12 > bottom) break; text(ctx, l, x + 5, yy, c); yy += 12; }
  use.forEach((l, k) => text(ctx, l, x + 5, bottom + k * 12, PAL.cardDim));
  if (sold) {
    ctx.globalAlpha = 0.7; rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.feltDk); ctx.globalAlpha = 1;
    text(ctx, '샀다', x + w / 2, y + h / 2 - 6, PAL.dim, { align: 'center', bold: true });
  } else if (price && it.price != null) text(ctx, `$${it.price}`, x + w / 2, y + h - 14, PAL.goldDk, { align: 'center', bold: true });
}

// 새기기 · 깃들기 · 자라기 미리 보기: 고른 기물이 어떻게 되는지 보이고 확인을 받는다(기물을 누르자마자 새기지 않는다).
// what: { kind: 'engraving'|'soul'|'evolve', id }, p: 고른 기물(없으면 고르라는 말), to: 진화 결과 종류
export function targetPanel(ctx, ui, run, what, p, x, y, w, { to = null, onConfirm = null, onCancel = null, idPrefix = 'target' } = {}) {
  const h = 40;
  ui.region(`${idPrefix}:panel`, x, y, w, h, {});
  box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
  const verb = what.kind === 'engraving' ? '새긴다' : what.kind === 'soul' ? '깃든다' : '자란다';
  const eff = what.kind === 'engraving' ? `${engravingInfo(what.id).name}: ${L(engravingInfo(what.id).text)}` : what.kind === 'soul' ? `${SOUL_BY_ID[what.id].name}의 혼: ${L(SOUL_BY_ID[what.id].text)}` : '체스 기물이 그 종류의 이형으로 자란다';
  if (!p) {
    text(ctx, what.kind === 'engraving' ? '주머니에서 새길 기물을 고른다' : what.kind === 'soul' ? '주머니에서 깃들 기물을 고른다' : '주머니에서 자랄 기물을 고른다', x + 6, y + 4, PAL.gold, { bold: true });
    const l = wrap(eff, w - 70)[0];
    text(ctx, l, x + 6, y + 21, PAL.ink);
  } else {
    const after = what.kind === 'engraving' ? { ...p, eng: { id: what.id } } : what.kind === 'soul' ? { ...p, soul: what.id } : { ...p, t: to || p.t };
    pieceCard(ctx, p, x + 5, y + 6, 20, 28, { tier: tierOf(run.charts[chartForm(p.t)]) });
    for (let i = 0; i < 3; i++) { rect(ctx, x + 29 + i, y + 17 + i, 1, 1, PAL.gold); rect(ctx, x + 29 + i, y + 23 - i, 1, 1, PAL.gold); }
    pieceCard(ctx, after, x + 35, y + 6, 20, 28, { tier: tierOf(run.charts[chartForm(after.t)]), time: ui.time, selected: true });
    const name = what.kind === 'evolve' ? `${PIECE_NAME[p.t]} › ${PIECE_NAME[after.t]}` : `${PIECE_NAME[p.t]}에 ${what.kind === 'engraving' ? `${engravingInfo(what.id).name} 각인` : `${SOUL_BY_ID[what.id].name}의 혼`}`;
    text(ctx, name, x + 62, y + 4, PAL.gold, { bold: true });
    const l = wrap(what.kind === 'evolve' ? (PIECE_MOVE[after.t] || '') : eff, w - 62 - 66)[0] || '';
    text(ctx, l, x + 62, y + 21, PAL.ink);
    if (onConfirm) button(ctx, ui, `${idPrefix}:ok`, x + w - 62, y + 4, 56, 16, verb, { tone: 'gold', onClick: onConfirm });
  }
  if (onCancel) button(ctx, ui, `${idPrefix}:cancel`, x + w - 62, y + 21, 56, 15, '그만', { onClick: onCancel });
}

// ── 불멸의 기보 조각 띠: 조각을 하나라도 모은 명국마다 작은 조각 + 모은 수. 올리면 명국 · 조각 · 재현 조건(첫 조각 뒤에만).
export function miniShard(ctx, x, y, col = PAL.gold) {
  const rows = ['.###.', '#####', '####.', '.##..', '..#..'];
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, j === 0 && i === 1 ? PAL.goldHi : col); });
}
export function fragmentTip(run, l) {
  const f = run.fragments[l.id] || {};
  const parts = [['first', '첫 조각'], ['feat', '재현'], ['gold', '금빛']].map(([k, n]) => `${f[k] ? '■' : '□'} ${n}`).join('  ');
  const lines = [parts];
  if (f.first && !f.feat) lines.push(`재현: ${l.feat}`);
  if (f.first && f.feat && !f.gold) lines.push('황금 기물을 먹고 이기면 금빛 조각');
  return tipLines(l.name, lines, 170);
}
export function fragmentStrip(ctx, ui, run, x, y, { align = 'left' } = {}) {
  const list = LEGENDS.filter((l) => { const f = run.fragments[l.id]; return f && (f.first || f.feat || f.gold) && !run.legends.includes(l.id); });
  const w = 15;
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
export function tacticIcon(ctx, id, x, y) {
  const G = {
    freeze: ['.......#........', '...#...#...#....', '....#..#..#.....', '.....#.#.#......', '......###.......', '.#############..', '......###.......', '.....#.#.#......', '....#..#..#.....', '...#...#...#....', '.......#........'],
    reload: ['................', '..##########....', '..#........#....', '..##########....', '................', '.......##.......', '.......##.......', '....########....', '....########....', '.......##.......', '.......##.......'],
    taunt: ['......##........', '.....####....#..', '.....####...#...', '......##...#....', '....######......', '......##........', '......##........', '.....####.......', '....######......', '...########.....', '................'],
  }[id] || [];
  const col = { freeze: '#9fd3e0', reload: '#efbd55', taunt: '#df8a45' }[id] || '#ffffff';
  G.forEach((r, j) => { for (let i = 0; i < 16; i++) if (r[i] === '#') rect(ctx, x + i, y + j, 1, 1, col); });
}
