// 여러 화면이 같이 쓰는 조각: 격언 칸, 손 기물 카드, 상금, 말풍선 내용.
import { PAL, RARITY, EDITION_TINT } from '../render/palette.js';
import { box, rect, text, frame, dots, sprite, measure } from '../render/gfx.js';
import { maximInfo, engravingInfo, maximCapacity, maximCount } from '../sim/run.js';
import { EDITION_BY_ID } from '../data/editions.js';
import { CHARTS, chartText } from '../data/charts.js';
import { PIECE_NAME } from './words.js';
import { wrap } from '../render/text.js';
import { LEGEND_BY_ID, LEGENDS } from '../data/legends.js';
import { drawIcon } from '../render/icons.js';
import { L } from './lang.js';

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
  if (info.rarity === 'legendary' && info.story) for (const l of wrap(`${info.year ? info.year + ' · ' : ''}${info.story}`, 140)) extra.push([l, PAL.goldDk]);
  return tipLines(info.name, info.text, 150, extra);
}

export function pieceTip(p) {
  const lines = [];
  if (p.eng) { const e = engravingInfo(p.eng.id); lines.push(`${e.name} 각인 · ${e.text}`); }
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

// 손 기물 카드(각인 빛깔)
export const ENG_FILL = { ivory: '#f7efdb', glass: '#bfe0e6', gold: '#f3d27a', ebony: '#6b5a52', silver: '#d8dee6', feather: '#e8e0f0' };
export function pieceCard(ctx, p, x, y, w, h, { lift = 0, selected = false, hover = false, dim = false, alpha = 1 } = {}) {
  const yy = y - lift;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const fill = p.eng ? ENG_FILL[p.eng.id] || PAL.light : PAL.light;
  box(ctx, x, yy, w, h, fill, selected ? PAL.gold : hover ? PAL.goldDk : PAL.frameDk);
  if (selected) frame(ctx, x - 1, yy - 1, w + 2, h + 2, PAL.gold);
  if (p.eng && p.eng.id === 'glass') { rect(ctx, x + 3, yy + 3, 1, 6, '#ffffff'); rect(ctx, x + 5, yy + 3, 1, 3, '#ffffff'); }
  if (p.eng && p.eng.id === 'ivory') rect(ctx, x + 2, yy + 2, w - 4, 1, PAL.gold);
  if (p.eng && p.eng.id === 'gold') { rect(ctx, x + 2, yy + 2, 2, 2, PAL.goldDk); rect(ctx, x + w - 4, yy + 2, 2, 2, PAL.goldDk); }
  if (p.eng && p.eng.id === 'ebony') rect(ctx, x + 2, yy + h - 3, w - 4, 1, '#2a1f1b');
  if (p.eng && p.eng.id === 'silver') { rect(ctx, x + 2, yy + 2, 1, 1, '#ffffff'); rect(ctx, x + w - 3, yy + 2, 1, 1, '#ffffff'); }
  if (p.eng && p.eng.id === 'feather') { rect(ctx, x + w - 5, yy + 2, 1, 5, '#9a86b8'); rect(ctx, x + w - 6, yy + 3, 1, 3, '#9a86b8'); }
  sprite(ctx, p.t, 'w', x + Math.floor((w - 16) / 2), yy + Math.floor((h - 22) / 2) + 1, { alpha: dim ? 0.5 : 1 });
  if (alpha !== 1) ctx.globalAlpha = 1;
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

export function panel(ctx, x, y, w, h) { box(ctx, x, y, w, h, PAL.feltDk, PAL.frameDk); }

export const labelW = (s) => measure(s);

// ── 상점 · 꾸러미 물건 카드
export const ITEM_KIND = { maxim: '격언', chart: '기보', engraving: '각인', piece: '기물', fragment: '명국 조각' };

export function itemName(it) {
  if (it.kind === 'maxim') return maximInfo(it.id).name;
  if (it.kind === 'chart') return CHARTS[it.form].name;
  if (it.kind === 'engraving') return `${engravingInfo(it.id).name} 각인`;
  if (it.kind === 'piece') return PIECE_NAME[it.t];
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
  if (it.kind === 'piece') return tipLines(PIECE_NAME[it.t], '주머니에 들어온다');
  if (it.kind === 'fragment') { const l = LEGEND_BY_ID[it.legend]; return tipLines(`${l.name} · 첫 조각`, [l.story, `전설: ${l.text}`]); }
  return null;
}

// 명국 조각 모양(금빛 깨진 판 조각)
export function shardIcon(ctx, x, y, col = PAL.gold, dk = PAL.goldDk) {
  const rows = ['..####..', '.######.', '########', '#######.', '.#####..', '..###...', '...#....'];
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') rect(ctx, x + i * 2, y + j * 2, 2, 2, (i + j) % 4 === 0 ? PAL.goldHi : j > 3 ? dk : col); });
}

export function itemCard(ctx, it, x, y, w, h, { hover = false, sold = false, price = true, scaleX = 1, golden = false, t = 0 } = {}) {
  if (scaleX <= 0.02) return;
  if (scaleX !== 1) {
    const nw = Math.max(2, Math.round(w * scaleX));
    x += Math.floor((w - nw) / 2); w = nw;
  }
  const back = scaleX < 1 && it._back;
  const fill = golden ? '#f6d98a' : it.kind === 'fragment' ? '#f3e2b0' : PAL.card;
  box(ctx, x, y, w, h, fill, hover ? PAL.gold : PAL.frameDk);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.cardHi);
  if (it.edition && !sold) editionShine(ctx, it.edition, x, y, w, h, t);
  if (hover) frame(ctx, x, y, w, h, PAL.gold);
  if (w < 30 || back) return;
  text(ctx, ITEM_KIND[it.kind], x + w / 2, y + 4, PAL.cardDim, { align: 'center' });
  const cx = x + Math.floor(w / 2);
  if (it.kind === 'maxim') {
    const info = maximInfo(it.id);
    rect(ctx, x + 6, y + 19, w - 12, 2, RARITY[info.rarity]);
    drawIcon(ctx, it.id, cx - 6, y + 25);
    const lines = wrap(info.name, w - 8, true);
    lines.slice(0, 2).forEach((l, k) => text(ctx, l, cx, y + 40 + k * 13, PAL.cardInk, { align: 'center', bold: true }));
    if (it.edition) text(ctx, EDITION_BY_ID[it.edition].name, cx, y + h - 28, PAL.goldDk, { align: 'center' });
  } else if (it.kind === 'chart' || it.kind === 'piece') {
    const t = it.kind === 'chart' ? it.form : it.t;
    if (it.kind === 'chart') { box(ctx, cx - 13, y + 20, 26, 30, '#e8dcc0', PAL.cardDim); }
    sprite(ctx, t, it.kind === 'chart' ? 'b' : 'w', cx - 8, y + 24);
    text(ctx, it.kind === 'chart' ? `${PIECE_NAME[t]}` : PIECE_NAME[t], cx, y + 54, PAL.cardInk, { align: 'center', bold: true });
  } else if (it.kind === 'engraving') {
    box(ctx, cx - 11, y + 20, 22, 30, ENG_FILL[it.id] || PAL.light, PAL.cardDim);
    const e = engravingInfo(it.id);
    text(ctx, e.name, cx, y + 54, PAL.cardInk, { align: 'center', bold: true });
    text(ctx, L(e.name).slice(0, 1), cx, y + 29, PAL.cardInk, { align: 'center', bold: true });
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
