// 관 선택: 연습 · 정식 · 명인 세 장. 목표 · 보상 · 명인 규칙 · 건너뛰면 받는 패. 「두기」 / 「건너뛰기」.
// 떠나온 상점이 있으면 위 띠 왼쪽에 「상점」(돌아가 더 살 수 있다 — 진열 · 꾸러미는 떠날 때 그대로).
// 판 보기(CHM-61, layout.md 17절): 지금 · 남은 대국 카드마다 작은 판(두기를 누르면 열릴 그 판), 카드를 가리키면 왼쪽 칸에 크게.
import { richText } from '../glossary.js';
import { hint } from '../coach.js';
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, fitNum, frame, measure } from '../../render/gfx.js';
import { blindInfo, REWARD, ANTES, canReopenShop, TAG_RULES } from '../../sim/run.js';
import { MASTER_BY_ID, FINAL_MASTER } from '../../data/masters.js';
import { CHARTS } from '../../data/charts.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { KIND_NAME, PACK_NAME, josa } from '../words.js';
import { drawIcon, drawIconLight } from '../../render/icons.js';
import { kindTab } from '../kinds.js';
import { envelope } from '../parts.js';
import { L } from '../lang.js';
import { runSide, pauseButton } from './common.js';
import { MAIN, TOP, CARD, BTN_H, cardX, PAD_CARD, LINE, GAP_IN, GAP_GROUP, flow, BTN_S } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { tipLines, fitText } from '../parts.js';
import { drawPortrait } from '../../render/portraits.js';
import { FACTION_BY_ID, bossOf } from '../../data/factions.js';
import { drawCrest, CREST_SIZE } from '../../render/crests.js';
import { factionFor } from '../../sim/run.js';
import { lightHue } from './common.js';
import { previewBattle } from '../../sim/run.js';
import { miniBoard, bigBoard, peekSize, PEEK } from '../peek.js';


// 마지막 관(대가)의 왕관 9×7
const CROWN = ['#...#...#', '##..#..##', '##.###.##', '#########', '#########', '.........', '#########'];

// 판의 길: 1관~8관 구슬, 8관은 왕관. 지난 관은 금빛, 지금 관은 밝게 숨 쉬고, 남은 관은 흐리게
export function antePath(ctx, ui, run, cx, y, time) {
  if (run.endless) { text(ctx, `끝없는 대국 ${run.ante}관`, cx, y, PAL.gold, { align: 'center', bold: true }); return; }
  const label = `${run.ante}관 / ${ANTES}관`;
  const step = 14, pw = 8, cw = CROWN[0].length;
  const trackW = (ANTES - 1) * step + cw;
  const lw = measure(label, true);
  const x0 = Math.round(cx - (lw + 10 + trackW) / 2);
  text(ctx, label, x0, y, PAL.ink, { bold: true });
  const px = x0 + lw + 10, py = y + 2;
  rect(ctx, px + 4, py + 4, (ANTES - 1) * step, 1, PAL.feltHi);
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  for (let i = 0; i < ANTES; i++) {
    const a = i + 1, x = px + i * step;
    const done = a < run.ante, cur = a === run.ante;
    if (a === ANTES) {
      const col = done ? PAL.gold : cur ? PAL.red : PAL.redDk;
      if (cur) { ctx.globalAlpha = 0.35 + 0.35 * pulse; rect(ctx, x - 2, py - 3, cw + 4, CROWN.length + 4, PAL.red); ctx.globalAlpha = 1; }
      CROWN.forEach((row, j) => { for (let k = 0; k < cw; k++) if (row[k] === '#') rect(ctx, x + k, py - 1 + j, 1, 1, col); });
      continue;
    }
    // 다음 관: 구슬 대신 그 세력의 문장(상점에서 대비하게 — 설계서 「순서」)
    if (a === run.ante + 1) {
      const nf = factionFor(run, a);
      drawCrest(ctx, nf, x - 2, py - 2);
      const f = FACTION_BY_ID[nf];
      ui.region('select:next', x - 3, py - 3, CREST_SIZE + 2, CREST_SIZE + 2, { tip: () => tipLines(`다음 관 · ${f.name}`, f.habit.text) });
      continue;
    }
    if (done) box(ctx, x, py, pw, pw, PAL.gold, PAL.goldDk);
    else if (cur) {
      box(ctx, x, py, pw, pw, PAL.goldHi, PAL.gold);
      ctx.globalAlpha = 0.3 + 0.5 * pulse; frame(ctx, x - 2, py - 2, pw + 4, pw + 4, PAL.goldHi); ctx.globalAlpha = 1;
    } else box(ctx, x, py, pw, pw, PAL.feltDk, PAL.dimDk);
  }
  const fm = MASTER_BY_ID[FINAL_MASTER];
  ui.region('select:path', x0, y - 2, lw + 10 + trackW, 16, { tip: () => tipLines(`${ANTES}관 · ${FACTION_BY_ID[factionFor(run, ANTES)].name}`, josa(`마스터 ${fm.name}`, '을/를') + ' 꺾으면 판을 이긴다') });
}

// 건너뛰기 패(CHM-58 ②, 시안 2 「아이콘 + 글」 — docs/shots/skip-tags/): 받는 것 글(한국어 열쇠 — 그릴 때 옮긴다)과 그림.
// 그림 icon: ['icon', 격언 아이콘] · ['light', 먹을 옅은 금으로 칠한 격언 아이콘] · ['tab', 종류 딱지] · ['env', 꾸러미 봉투] · ['slot', 봉투 + 「+」]
const TAG_VIEW = {
  money: { text: (t) => `$${t.amount} 받기`, icon: () => ['icon', 'thrift'] },
  chart: { text: (t) => `${CHARTS[t.form].name} 한 장`, icon: () => ['tab', 'chart'] },
  pack: { text: (t) => `${PACK_NAME[t.pack]} 하나 열기`, icon: (t) => ['env', t.pack] },
  slot: { text: () => `다음 상점 꾸러미 칸 +${TAG_RULES.packs}`, icon: () => ['slot', 'piece'] },
  reroll: { text: () => `다음 상점에서 다시 진열 ${TAG_RULES.rerolls}번`, icon: () => ['light', 'second_thought'] },
  double: { text: () => `가진 상금 두 배(최대 $${TAG_RULES.doubleMax})`, icon: () => ['icon', 'vault'] },
  golden: { text: () => '판본 격언 셋 중 하나 고르기', icon: () => ['env', 'golden'] },
  fragment: { text: () => '명경기 조각 하나', icon: () => ['tab', 'fragment'] },
};
// 옛 패(CHM-58 전 저장의 기록: 상금 +5)도 같은 글로 읽힌다
export const tagText = (tag) => (tag && TAG_VIEW[tag.kind] ? TAG_VIEW[tag.kind].text(tag) : '');
// 패 그림 12×12를 (x, y)에 sc배로(관 선택 카드는 2배)
export function tagIcon(ctx, tag, x, y, sc = 1) {
  const v = tag && TAG_VIEW[tag.kind];
  if (!v) return;
  const [k, id] = v.icon(tag);
  // 봉투는 늘이지 않고 그 크기(12 × 10의 sc배)로 바로 그린다 — 테 1칸 · 문양이 또렷하게
  if (k === 'env' || k === 'slot') envelope(ctx, Math.round(x), Math.round(y) + sc, 12 * sc, 10 * sc, id);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(sc, sc);
  if (k === 'icon') drawIcon(ctx, id, 0, 0);
  else if (k === 'light') drawIconLight(ctx, id, 0, 0);
  else if (k === 'tab') kindTab(ctx, id, -1, -1);
  // 꾸러미 칸 +1: 봉투 오른쪽 위에 금빛 「+」
  else if (k === 'slot') { rect(ctx, 8, 0, 4, 4, PAL.feltDk); rect(ctx, 9, 1, 3, 1, PAL.goldHi); rect(ctx, 10, 0, 1, 3, PAL.goldHi); }
  ctx.restore();
}

// 대국 카드 쌓기(재기와 그리기가 같이 쓴다 — PAD_CARD): 종류(제목) → 묶음 틈 → 목표 · 이기면 → 묶음 틈(가운데 가로줄) →
// 명인(초상 옆 이름 → 묶음 안 틈 → 규칙 글) 또는 「건너뛰면」 → 받는 것 → 묶음 틈 → 단추 줄(지난 대국은 「이김」 · 「건너뜀」)
const PORTRAIT = 36;
const TAG_ICON = 24; // 건너뛰기 패 그림(12 × 2배)
const BAR = { y: 2, h: BTN_S }; // 본 칸 위 띠의 작은 단추(상점 화면 띠와 같다)
// 대국 카드 셋은 본 칸을 꽉 채운다(사이 4 — 명인 규칙 글이 한 줄이라도 덜 접히게)
const SEL = { gap: 4, get w() { return Math.floor((MAIN.w - this.gap * 2) / 3); } };
const selX = (i) => MAIN.x + i * (SEL.w + SEL.gap);
// tight: 카드 줄이 본 칸을 넘을 때(영어 7 · 8관 큰 목표가 두 줄 + 패 글 두 줄 + 두 줄 세력 띠) 목표 · 이기면 수치를 짧은 꼴(470K)로 한 줄에 — selectLays
export function blindLayout(run, i, w = SEL.w, { tight = false } = {}) {
  const blind = i;
  const info = blindInfo(run, run.ante, i);
  const master = info.kind === 'master';
  const P = PAD_CARD, IW = w - P * 2, f = flow(P);
  const out = { info, master, IW };
  // 판 보기(CHM-61): 지금 대국부터 남은 대국 카드에 작은 판. 지난 대국은 없다
  const peek = blind >= run.blind;
  const BW = peekSize();
  out.kind = f.line(true);
  f.gap(GAP_GROUP);
  // 이름표 · 수치 한 줄(넘치면 수치를 다음 줄 오른쪽에 — 그 줄에도 안 들어가는 큰 수는 짧은 꼴 3.1T)
  const row = (label, val, bold = true) => {
    if (typeof val === 'number') val = fitNum(val, tight ? IW - measure(label) - 6 : IW, bold);
    const two = measure(label) + 6 + measure(val, bold) > IW;
    const ly = f.line();
    return { label, val, ly, vy: two ? f.line() : ly };
  };
  out.rows = [row('목표', info.target), row('이기면', master ? `$${REWARD.base[info.kind]} + 상자` : `$${REWARD.base[info.kind]}`)];
  out.rule = f.y + Math.floor(GAP_GROUP / 2);
  f.gap(GAP_GROUP);
  if (master) {
    const m = MASTER_BY_ID[info.master];
    out.m = m;
    // 초상 옆 이름: 굵게 두 줄까지, 넘치거나 낱말 하나가 굵게 안 들어가면 보통 굵기.
    // 보통 굵기로도 낱말이 초상 옆에 안 들어가면(영어 「Grandmaster」 · 「Castellan」) 초상 아래 온 폭에 쓴다(낱말 가운데서 끊지 않게)
    // 작은 판이 있으면(지금 · 남은 마스터전) 초상 옆 이름 대신 판 — 아래 peek
    const full = `마스터 ${m.name}`, nameW = IW - PORTRAIT - 6, words = L(full).split(' '); // 낱말은 옮긴 글에서 센다
    const fits = (w, bold) => words.every((x) => measure(x, bold) <= w);
    out.nameX = PORTRAIT + 6;
    let names = wrap(full, nameW, true);
    out.nameBold = names.length <= 2 && fits(nameW, true);
    if (!out.nameBold) names = wrap(full, nameW, false);
    if (peek) {
      // 초상(왼쪽) · 작은 판(오른쪽) 한 줄. 마스터 이름은 카드를 가리키면 왼쪽 칸 큰 판의 제목에(카드 높이가 본 칸에 들게)
      const rh = Math.max(PORTRAIT, BW), top = f.space(rh);
      out.portrait = top + ((rh - PORTRAIT) >> 1);
      out.peek = { x: IW - BW, y: top + ((rh - BW) >> 1) };
      out.names = [];
    } else if (!fits(nameW, false)) {
      out.nameX = 0;
      out.nameBold = fits(IW, true) && wrap(full, IW, true).length <= 2;
      names = wrap(full, IW, out.nameBold);
      out.portrait = f.space(PORTRAIT); // 이름 줄은 초상 바로 아래(줄 위 여백이 틈이 된다 — 8관 영어 명인 카드가 본 칸에 들어가게)
      out.names = names.map((l) => [l, f.line()]);
    } else {
      const top = f.space(Math.max(PORTRAIT, names.length * LINE));
      out.portrait = top;
      const nf = flow(top + Math.max(0, Math.floor((PORTRAIT - names.length * LINE) / 2)));
      out.names = names.map((l) => [l, nf.line()]);
    }
    f.gap(GAP_IN);
    out.lines = wrap(m.text, IW).map((l) => [l, f.line()]);
  } else if (peek) {
    // 시안 2(CHM-58 ②): 작은 판 왼쪽에 「건너뛰면」 → 그 아래 패 그림(2배, 24), 받는 것 글은 판 아래 온 폭(두 줄까지)
    const top = f.y;
    out.skipLabel = f.line();
    f.gap(GAP_IN);
    out.icon2 = { x: 0, y: f.space(TAG_ICON) };
    out.peek = { x: IW - BW, y: top };
    f.y = Math.max(f.y, top + BW);
    f.gap(GAP_IN);
    out.lines = wrap(tagText(info.tag), IW, true).map((l) => [l, f.line()]);
  } else {
    out.skipLabel = f.line();
    f.gap(GAP_IN);
    out.lines = wrap(tagText(info.tag), IW, true).map((l) => [l, f.line()]);
  }
  f.gap(GAP_GROUP);
  out.btn = f.space(BTN_H);
  out.h = f.y + P;
  return out;
}

// 세력 띠: 문장 2배 왼쪽, 이름(제목 줄) → 버릇(본문 줄, 접힌다). 폭 = 연습 · 정식 카드 둘
const CREST2 = CREST_SIZE * 2;
export function bandLayout(fa, w) {
  const P = PAD_CARD, tx = P + CREST2 + 6, f = flow(P);
  const name = f.line(true);
  const lines = wrap(fa.habit.text, w - tx - P).map((l) => [l, f.line()]);
  return { w, tx, name, lines, h: Math.max(P * 2 + CREST2, f.y + P) };
}
// 카드 셋의 쌓기: 본 칸(아래 여백 GAP_GROUP)을 넘으면 수치를 짧은 꼴로 다시 쌓는다
export function selectLays(run) {
  const lays = [0, 1, 2].map((i) => blindLayout(run, i));
  if (TOP + selectPlan(run, lays).H <= 270 - GAP_GROUP) return lays;
  return [0, 1, 2].map((i) => blindLayout(run, i, SEL.w, { tight: true }));
}
// 관 선택의 자리: 연습 · 정식 카드는 세력 띠 아래, 명인 카드는 본 칸 위부터 온 높이. 아랫변은 셋이 같다
export function selectPlan(run, lays = selectLays(run)) {
  const fa = FACTION_BY_ID[blindInfo(run).faction];
  const band = bandLayout(fa, SEL.w * 2 + SEL.gap);
  const low = Math.max(lays[0].h, lays[1].h);
  const H = Math.max(lays[2].h, band.h + SEL.gap + low);
  const y = TOP + band.h + SEL.gap;
  return { band, H, cards: [{ y, h: TOP + H - y }, { y, h: TOP + H - y }, { y: TOP, h: H }] };
}

export class SelectScreen {
  constructor(app) { this.app = app; this.notes = 'side'; this.peeks = new Map(); }
  // 판 보기: 두기를 누르면 열릴 대국(previewBattle). 판(런)이 바뀐 만큼만 다시 잰다
  peekOf(run, i) {
    const key = JSON.stringify([run.ante, run.blind, run.retry, run.boards && run.boards[i], run.maxims, run.josekis, run.charts, run.fragments, run.deck.length]);
    const hit = this.peeks.get(i);
    if (hit && hit.key === key) return hit.b;
    const b = previewBattle(run, i);
    this.peeks.set(i, { key, b });
    return b;
  }
  // 판 틀: 왼쪽 칸(관 선택 · 시너지 · 정석 · 상금 — 설명 자리) + 본 칸(대국 카드 셋 — 가장 긴 카드에 맞춘 높이 · 판의 길 ·
  // 떠나온 상점이 있으면 판의 길 띠 왼쪽에 「상점」)
  draw(ctx, ui) {
    const app = this.app, run = app.run;
    const fid = blindInfo(run).faction, fa = FACTION_BY_ID[fid];
    runSide(ctx, ui, app, '관 선택');
    pauseButton(ctx, ui, app);
    // 처음 시계를 잃은 뒤: 시계 줄을 가리키는 한 줄
    if (run.log.some((x) => x.clockLost)) hint(app, 'clock', 'clock');
    // 판의 길은 본 칸 위 띠(카드 줄이 내용에 맞춰 길어지므로 아래를 비운다)
    antePath(ctx, ui, run, MAIN.x + MAIN.w / 2, 5, app.time);
    const lays = selectLays(run);
    const plan = selectPlan(run, lays);
    // 세력 띠: 연습 · 정식 카드 위(문장 2배 · 이름 · 버릇), 명인 카드는 오른쪽에 온 높이
    // 시안(docs/shots/factions/draft1~4)에서 4를 골랐다 — 보고서 docs/reports/factions.md 「화면」
    {
      const bd = plan.band, bx = selX(0), by = TOP;
      openBox('card', bx, by, bd.w, bd.h, PAD_CARD, { name: '세력 띠' });
      box(ctx, bx, by, bd.w, bd.h, PAL.feltDk, fa.hue);
      drawCrest(ctx, fid, bx + PAD_CARD, by + Math.floor((bd.h - CREST_SIZE * 2) / 2), { scale: 2 });
      text(ctx, fa.name, bx + bd.tx, by + bd.name, lightHue(fa.hue), { bold: true });
      bd.lines.forEach(([l, ly]) => text(ctx, l, bx + bd.tx, by + ly, PAL.ink));
      ui.region('faction', bx, by, bd.w, bd.h, { tip: () => tipLines(fa.name, [fa.habit.text, `마스터 ${bossOf(fid).name}`, bossOf(fid).text]) });
      closeBox();
      // 새 세력을 처음 만나는 관 선택: 버릇 한 줄(처음 안내)
      hint(app, `faction_${fid}`, 'faction');
    }
    for (let i = 0; i < 3; i++) {
      const lay = lays[i], info = lay.info, master = lay.master;
      const x = selX(i), w = SEL.w;
      const { y, h } = plan.cards[i];
      const cur = i === run.blind;
      const past = i < run.blind;
      const log = run.log.find((l) => l.ante === run.ante && l.blind === i);
      const edge = cur ? (master ? PAL.red : PAL.gold) : PAL.frameDk;
      if (cur) frame(ctx, x - 1, y - 1, w + 2, h + 2, edge);
      openBox('card', x, y, w, h, PAD_CARD, { name: `대국 카드 ${i}` });
      box(ctx, x, y, w, h, cur ? PAL.feltDk : PAL.felt, edge);
      const ink = cur ? PAL.ink : PAL.dim;
      const P = PAD_CARD;
      fitText(ctx, KIND_NAME[info.kind], x + P, y + lay.kind, w - P * 2, master ? PAL.red : cur ? PAL.gold : PAL.dim);
      lay.rows.forEach((r, k) => {
        text(ctx, r.label, x + P, y + r.ly, PAL.dim);
        text(ctx, r.val, x + w - P, y + r.vy, k ? PAL.gold : ink, { align: 'right', bold: true });
      });
      rect(ctx, x + P, y + lay.rule, w - P * 2, 1, PAL.frameDk);
      // 판 보기: 카드를 가리키면 왼쪽 칸에 그 판을 크게(마스터전 카드는 규칙 글의 낱말 상자도). 단추는 뒤에 그려 먼저 눌린다
      const pv = lay.peek ? this.peekOf(run, i) : null;
      if (pv) {
        const BS = peekSize(PEEK.big);
        const tip = { title: master ? `마스터 ${lay.m.name}` : KIND_NAME[info.kind], titleCol: master ? PAL.redDk : null, body: [], block: { h: BS, draw: (c, bx, by, bw) => bigBoard(c, pv, bx + ((bw - BS) >> 1), by) } };
        ui.region(`select:board:${i}`, x, y, w, h, { tip, keys: [master ? lay.m.text : tagText(info.tag)] });
        miniBoard(ctx, pv, x + P + lay.peek.x, y + lay.peek.y, { dim: !cur });
        if (cur) hint(this.app, 'preview', `select:board:${i}`);
        if (ui.isHover(`select:board:${i}`)) this.app.trackOnce('peek_hover', { ante: run.ante, blind: i });
      }
      if (master) {
        // 명인 카드: 가리키면 글 안 낱말의 상자(두기 단추는 뒤에 그려 먼저 눌린다)
        if (!pv) ui.region(`select:card:${i}`, x, y, w, h, { keys: [lay.m.text] });
        box(ctx, x + P, y + lay.portrait, PORTRAIT, PORTRAIT, PAL.felt, cur ? PAL.red : PAL.frameDk);
        drawPortrait(ctx, info.master, x + P + 2, y + lay.portrait + 2, 1, cur ? 1 : 0.6);
        for (const [l, ly] of lay.names) text(ctx, l, x + P + lay.nameX, y + ly, PAL.red, { bold: lay.nameBold });
        for (const [l, ly] of lay.lines) richText(ctx, l, x + P, y + ly, ink, { termCol: PAL.gold });
      } else {
        text(ctx, '건너뛰면', x + P, y + lay.skipLabel, PAL.dim);
        if (lay.icon2) tagIcon(ctx, info.tag, x + P + lay.icon2.x, y + lay.icon2.y, 2);
        // 받는 것 글 안 낱말(꾸러미 · 판본 · 명경기 조각)은 밝게 — 가리키면 낱말 상자(위 select:board keys)
        for (const [l, ly] of lay.lines) richText(ctx, l, x + P, y + ly, cur ? PAL.gold : PAL.dim, { bold: true, termCol: cur ? PAL.goldHi : PAL.dim });
      }
      // 단추 줄은 카드 아래 안 여백 위(세 카드가 같은 높이라 같은 줄)
      const by = y + h - P - BTN_H;
      if (past) {
        const lost = log && !log.skipped && log.won === false;
        text(ctx, log && log.skipped ? '건너뜀' : lost ? '짐 · 시계 −1' : '이김', x + w / 2, by + 3, lost ? PAL.red : PAL.dim, { align: 'center', bold: true });
      } else if (cur) {
        if (master) { button(ctx, ui, 'select:play', x + P, by, w - P * 2, BTN_H, '두기', { onClick: () => this.play(), tone: 'red' }); hint(this.app, 'master', 'select:play'); }
        else {
          button(ctx, ui, 'select:play', x + P, by, 38, BTN_H, '두기', { onClick: () => this.play(), tone: 'gold' });
          button(ctx, ui, 'select:skip', x + P + 42, by, w - P * 2 - 42, BTN_H, '건너뛰기', { onClick: () => this.skip() });
        }
      }
      closeBox();
    }
    // 떠나온 상점으로: 본 칸 위 띠 왼쪽(상점의 「다음 대국」과 같은 띠 · 같은 높이). 카드 줄 아래는 긴 명인 카드가 다 쓴다
    if (canReopenShop(run)) {
      const label = '상점';
      button(ctx, ui, 'select:shop', MAIN.x, BAR.y, measure(label, true) + 16, BAR.h, label, { onClick: () => this.toShop() });
    }
  }
  toShop() {
    this.app.cmd({ type: 'shop' });
    this.app.sfx('click');
    this.app.goPhase();
  }
  play() {
    const ev = this.app.cmd({ type: 'play' });
    this.app.sfx('start');
    this.app.go('battle', { events: ev });
  }
  skip() {
    const ev = this.app.cmd({ type: 'skip' });
    const s = ev.find((e) => e.type === 'skip');
    // 꾸러미 패는 알림 없이 곧바로 꾸러미 화면(이름은 왼쪽 칸 머리에) — 알림이 위 띠 격언 이름표를 덮었다
    if (s && this.app.run.phase !== 'pack') this.app.toast(`건너뜀 · ${tagText(s.tag)}${s.tag.kind === 'double' ? ` · +$${s.money || 0}` : ''}`, PAL.gold);
    this.app.sfx('coin');
    this.app.goPhase();
  }
  key(k) {
    if (k === 'Enter' || k === ' ') this.play();
    else if (k === 'Escape') this.app.openOverlay('pause');
  }
}
