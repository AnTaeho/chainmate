// 기기 잇기(CHM-71, docs/design-notes/leaderboard.md 「기기 잇기 · 클라우드 저장」 · layout.md 23절): 판 밖 틀.
//   왼쪽 「이 기기의 코드」: [코드 받기] → 큰 숫자 여덟 자리 + 남은 시간 막대. 오른쪽 「다른 기기의 코드 넣기」: 숫자 여덟 칸 + 숫자판(키보드 숫자 · Backspace · Enter도).
//   아래 한 줄: 이어진 기기 수 · 마지막으로 맞춘 때 · [이 기기 떼기]. 서버와 주고받는 것은 app.rank · app.cloud가 한다 — 화면은 열쇠를 모른다.
import { PAL } from '../../render/palette.js';
import { W, text, box, rect, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { pageHead } from './common.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, BTN_S, textY, inkY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { linkRedeemProps } from '../telemetry.js';
import { mergeGain } from '../merge.js';
import { accountTabs } from './account.js';

export const CODE_LEN = 8;
export const POLL_SEC = 5;       // 코드를 띄운 동안 이어졌는지 묻는 간격
export const JOIN_TRIES = 3;     // 이어진 뒤 그 기기의 기록을 당겨 보는 횟수
const CARD_BG = '#0e1814';
// 숫자판: 세 줄 × 네 칸(오른쪽 칸이 지우기 · 0 · 잇기)
export const PAD_ROWS = [['1', '2', '3', 'del'], ['4', '5', '6', '0'], ['7', '8', '9', 'go']];

// 칸 자리(재는 쪽 test/layout.test.js와 같이 쓴다)
export function linkLayout() {
  const P = PAD_BOX, y = PAGE.bodyY, sh = P * 2 + BTN_S, sy = PAGE.btnY - GAP_GROUP - sh, h = sy - GAP_GROUP - y;
  const left = { x: 12, y, w: 224, h }, right = { x: W - 12 - 224, y, w: 224, h };
  const titleY = y + P, cellsY = titleY + LINE + 6, cw = 20, ch = 22, cg = 3, mid = 9;
  const cellsW = CODE_LEN * cw + (CODE_LEN - 2) * cg + mid, cx0 = right.x + Math.floor((right.w - cellsW) / 2);
  const cells = Array.from({ length: CODE_LEN }, (_, i) => ({ x: cx0 + i * (cw + cg) + (i >= 4 ? mid - cg : 0), y: cellsY, w: cw, h: ch }));
  const msgY = cellsY + ch + 4, padY = msgY + LINE + 4, kw = 48, kh = 24, gx = 5, gy = 4;
  const kx0 = right.x + Math.floor((right.w - (4 * kw + 3 * gx)) / 2);
  const keys = PAD_ROWS.flatMap((row, r) => row.map((k, c) => ({ k, x: kx0 + c * (kw + gx), y: padY + r * (kh + gy), w: kw, h: kh })));
  return { left, right, titleY, cells, msgY, padY, keys, status: { x: 12, y: sy, w: W - 24, h: sh }, grow: { l: gx >> 1, r: gx >> 1, u: gy >> 1, d: gy >> 1 } };
}
// 「4827 1593」
export const codeText = (code) => `${code.slice(0, 4)} ${code.slice(4)}`;
export const agoText = (ms) => { const m = Math.floor(ms / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; };
// 합쳐서 늘어난 것 한 줄(mergeGain) — 가장 눈에 띄는 것 하나. 늘어난 것이 없으면 null
export function gainText(g) {
  if (!g) return null;
  if (g.codex) return `도감 ${g.codex}칸이 새로 채워졌어요`;
  if (g.openings) return `레퍼토리 ${g.openings}개가 새로 열렸어요`;
  if (g.runs) return `판 ${g.runs}개가 더해졌어요`;
  return null;
}
// account: 계정에 들어와 있는 기기는 남의 코드를 넣지 못한다(CHM-72 — 넣으면 제 계정이 지워진다). 이 기기에서 코드를 받아 저쪽에 넣는다
export const REDEEM_FAIL = { bad: '코드가 맞지 않아요', expired: '시간이 지난 코드예요', self: '이 기기의 코드예요', limit: '잠시 뒤에 다시 입력해 주세요', unreached: '연결하지 못했어요', account: '이 기기에서 코드를 받으세요' };
export const CONFIRM_TEXT = '이 기기의 기록이 그 기기의 기록과 합쳐져요';
export const UNLINK_TEXT = '이 기기만 연결이 끊겨요 · 기록은 양쪽에 남아요';

export class LinkScreen {
  constructor(app) {
    this.app = app;
    this.mine = { phase: 'idle' };          // idle · loading · code(code, until, ttl) · expired · limit · unreached · linked(gain)
    this.entry = { phase: 'type', digits: '', fail: null }; // type · confirm · working · done(name, gain)
    this.devices = null;                    // 이어진 기기 수(서버가 알려 준 뒤에만)
    this.unlinking = null;                  // null · 'ask' · 'working'
    this.poll = 0;
    this.ask();
  }
  ask() { return this.app.rank.devices().then((n) => { if (n != null) this.devices = n; return n; }, () => null); }

  // ── 이 기기의 코드
  getCode() {
    const app = this.app;
    if (this.mine.phase === 'loading') return;
    this.mine = { phase: 'loading' };
    app.sfx('pick');
    // 숫자를 받기 전에 이 기기의 것을 먼저 올려 둔다(넣는 기기가 곧바로 받아 가게)
    app.cloud.push().then(() => app.rank.linkCode()).then((r) => {
      if (!r.ok) { this.mine = { phase: r.why === 'limit' ? 'limit' : 'unreached' }; return; }
      this.mine = { phase: 'code', code: r.code, ttl: r.ttl, until: app.cloud.now() + r.ttl, base: this.devices };
      this.poll = 0;
      app.track('link_code', {}, { always: true });
      // 코드를 받는 사이 플레이어가 생겼을 수 있다 — 기기 수를 맞춰 둔다
      this.ask().then((n) => { if (this.mine.phase === 'code' && this.mine.base == null) this.mine.base = n; });
    }, () => { this.mine = { phase: 'unreached' }; });
  }
  // 코드를 띄운 동안: 시간이 지나면 거두고, 몇 초마다 이어졌는지 묻는다
  update(dt) {
    const app = this.app, m = this.mine;
    // 이어진 뒤: 그 기기가 올린 것이 늦게 닿을 수 있어 몇 번 더 당겨 본다
    if (m.phase === 'linked' && m.tries < JOIN_TRIES && !m.busy) {
      this.poll += dt;
      if (this.poll >= POLL_SEC || !m.tries) this.joinMine(m);
      return;
    }
    if (m.phase !== 'code') return;
    if (app.cloud.now() >= m.until) { this.mine = { phase: 'expired' }; return; }
    this.poll += dt;
    if (this.poll < POLL_SEC || this.asking) return;
    this.poll = 0; this.asking = true;
    this.ask().then((n) => {
      this.asking = false;
      if (this.mine !== m || n == null || m.base == null || n <= m.base) return;
      // 다른 기기가 이 숫자를 넣었다: 그 기기의 기록을 당겨 온다
      this.mine = { phase: 'linked', gain: null, before: JSON.parse(JSON.stringify(app.records)), tries: 0, busy: false };
      app.sfx('buy');
    });
  }
  joinMine(m) {
    const app = this.app;
    this.poll = 0; m.tries++; m.busy = true;
    app.cloud.join().then(() => { m.busy = false; m.gain = mergeGain(m.before, app.records); if (gainText(m.gain)) m.tries = JOIN_TRIES; }, () => { m.busy = false; });
  }

  // ── 다른 기기의 코드 넣기
  press(k) {
    const e = this.entry;
    if (e.phase !== 'type') return;
    if (k === 'del') { if (e.digits) { e.digits = e.digits.slice(0, -1); e.fail = null; this.app.sfx('pick'); } return; }
    if (k === 'go') { if (e.digits.length === CODE_LEN) { e.phase = 'confirm'; this.app.sfx('pick'); } return; }
    if (e.digits.length >= CODE_LEN) return;
    e.digits += k; e.fail = null;
    this.app.sfx('pick');
  }
  redeem() {
    const app = this.app, e = this.entry;
    if (e.phase !== 'confirm') return;
    e.phase = 'working';
    app.rank.linkRedeem(e.digits).then(async (r) => {
      app.track('link_redeem', linkRedeemProps(r), { always: true });
      if (!r.ok) { this.entry = { phase: 'type', digits: '', fail: r.why }; return; }
      this.entry = { phase: 'done', name: r.name, gain: null };
      this.devices = r.devices;
      app.sfx('buy');
      const got = await app.cloud.join();
      if (got.ok) this.entry.gain = got.gain;
    }, () => { this.entry = { phase: 'type', digits: '', fail: 'unreached' }; });
  }
  unlink() {
    const app = this.app;
    this.unlinking = 'working';
    app.rank.unlink().then((r) => {
      this.unlinking = null;
      if (!r.ok) { app.toast('연결하지 못했어요', PAL.ink); return; }
      app.track('link_unlink', {}, { always: true });
      app.cloud.reset(); app.cloud.touch();
      this.devices = 1;
      if (this.mine.phase === 'linked') this.mine = { phase: 'idle' };
      if (this.entry.phase === 'done') this.entry = { phase: 'type', digits: '', fail: null };
      app.toast('연결을 끊었어요', PAL.gold);
    }, () => { this.unlinking = null; });
  }
  leave() { this.app.toTitle(); }

  draw(ctx, ui) {
    const app = this.app, lay = linkLayout(), P = PAD_BOX;
    // 계정(CHM-72)과 한 머리줄: 탭 「아이디」 · 「기기 잇기」
    pageHead(ctx, '계정');
    accountTabs(ctx, ui, app, 'link');
    this.drawMine(ctx, ui, lay);
    this.drawEntry(ctx, ui, lay);
    // 아래 한 줄: 이어진 기기 수 · 마지막으로 맞춘 때 · [이 기기 떼기]
    const s = lay.status, at = app.cloud.status().at;
    const linked = this.devices != null && this.devices >= 2;
    const parts = [this.devices == null ? null : linked ? `기기 ${this.devices}대 연결됨` : '연결된 기기 없음', at ? `마지막 동기화 ${agoText(Math.max(0, app.cloud.now() - at))}` : null].filter(Boolean);
    // 말할 것이 없으면(열쇠가 없다 · 닿지 못했다) 줄도 없다
    if (this.unlinking || parts.length) {
      openBox('panel', s.x, s.y, s.w, s.h, P, { name: '연결된 기기' });
      box(ctx, s.x, s.y, s.w, s.h, PAL.feltDk, PAL.frameHi);
      const ty = inkY(s.y + P, BTN_S);
      if (this.unlinking) {
        text(ctx, UNLINK_TEXT, s.x + P, ty, PAL.ink);
        const bw = Math.max(44, measure('연결 해제', true) + 12), cw = Math.max(44, measure('취소', true) + 12), x1 = s.x + s.w - P;
        button(ctx, ui, 'link:unlink:no', x1 - cw, s.y + P, cw, BTN_S, '취소', { enabled: this.unlinking === 'ask', onClick: () => { this.unlinking = null; } });
        button(ctx, ui, 'link:unlink:yes', x1 - cw - 6 - bw, s.y + P, bw, BTN_S, '연결 해제', { tone: 'red', enabled: this.unlinking === 'ask', onClick: () => this.unlink() });
      } else {
        text(ctx, parts.join(' · '), s.x + P, ty, linked ? PAL.ink : PAL.dim);
        if (linked) {
          const bw = measure('이 기기 연결 해제', true) + 12;
          button(ctx, ui, 'link:unlink', s.x + s.w - P - bw, s.y + P, bw, BTN_S, '이 기기 연결 해제', { onClick: () => { this.unlinking = 'ask'; app.sfx('pick'); } });
        }
      }
      closeBox();
    }
    button(ctx, ui, 'link:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '뒤로', { onClick: () => this.leave() });
  }

  drawMine(ctx, ui, lay) {
    const app = this.app, { left: b } = lay, P = PAD_BOX, m = this.mine, cx = b.x + (b.w >> 1);
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: '이 기기의 코드' });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, m.phase === 'linked' ? PAL.gold : PAL.frameHi);
    text(ctx, '이 기기의 코드', b.x + P, textY(lay.titleY), PAL.dim);
    const say = (s, y, col = PAL.dim, bold = false) => text(ctx, s, cx, textY(y), col, { align: 'center', bold });
    const get = (y) => { const bw = measure('코드 받기', true) + 24; button(ctx, ui, 'link:code', cx - (bw >> 1), y, bw, BTN_S, '코드 받기', { tone: 'gold', onClick: () => this.getCode() }); };
    const y0 = lay.cells[0].y;
    if (m.phase === 'code') {
      // 큰 숫자(두 배) + 남은 시간 막대
      const dw = 196, dh = 34, dx = cx - (dw >> 1);
      box(ctx, dx, y0, dw, dh, CARD_BG, PAL.gold);
      text(ctx, codeText(m.code), cx, y0 + 6, PAL.goldHi, { align: 'center', bold: true, scale: 2 });
      const k = Math.max(0, Math.min(1, (m.until - app.cloud.now()) / m.ttl)), by = y0 + dh + 6;
      rect(ctx, dx, by, dw, 3, PAL.feltHi);
      rect(ctx, dx, by, Math.round(dw * k), 3, k < 0.2 ? PAL.red : PAL.gold);
      say('다른 기기에서 이 코드를 입력하세요', by + 3 + 8, PAL.ink);
    } else if (m.phase === 'linked') {
      say('연결됐어요', y0 + 4, PAL.gold, true);
      const g = gainText(m.gain);
      if (g) say(g, y0 + 4 + LINE + 6, PAL.ink);
    } else if (m.phase === 'loading') say('코드 받는 중', y0 + 4);
    else if (m.phase === 'limit') { say('오늘은 더 받을 수 없어요', y0 + 4); say('내일 다시 받을 수 있어요', y0 + 4 + LINE); }
    else {
      if (m.phase === 'expired') say('시간이 지났어요', y0 + 4);
      if (m.phase === 'unreached') say('연결하지 못했어요', y0 + 4);
      get(m.phase === 'idle' ? y0 + 2 : y0 + 4 + LINE + 8);
    }
    closeBox();
  }

  drawEntry(ctx, ui, lay) {
    const { right: b } = lay, P = PAD_BOX, e = this.entry, cx = b.x + (b.w >> 1);
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: '다른 기기의 코드 입력' });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, e.phase === 'done' ? PAL.gold : PAL.frameHi);
    text(ctx, '다른 기기의 코드 입력', b.x + P, textY(lay.titleY), PAL.dim);
    if (e.phase === 'done') {
      // 「이어졌다 · 이름 졸린 수달」 + 합쳐진 것 한 줄
      const y0 = lay.cells[0].y + 4;
      text(ctx, '연결됐어요', cx, textY(y0), PAL.gold, { align: 'center', bold: true });
      // 「이름」 이름표는 이름 옆에 들어갈 때만(가장 넓은 영어 이름이면 뺀다)
      const nw = measure(e.name, true), lw = measure('이름') + 6 + nw <= b.w - P * 2 ? measure('이름') + 6 : 0, nx = cx - ((lw + nw) >> 1), ny = textY(y0 + LINE + 6);
      if (lw) text(ctx, '이름', nx, ny, PAL.dim);
      text(ctx, e.name, nx + lw, ny, PAL.ink, { bold: true });
      const g = gainText(e.gain);
      if (g) text(ctx, g, cx, textY(y0 + (LINE + 6) * 2), PAL.ink, { align: 'center' });
      closeBox();
      return;
    }
    // 숫자 여덟 칸(넷씩 띄운다). 다음에 들어갈 칸은 금빛 테
    lay.cells.forEach((c, i) => {
      const d = e.digits[i], next = e.phase === 'type' && i === e.digits.length;
      box(ctx, c.x, c.y, c.w, c.h, CARD_BG, next ? PAL.gold : d ? PAL.frameHi : PAL.frameDk);
      if (d) text(ctx, d, c.x + (c.w >> 1), inkY(c.y, c.h), PAL.goldHi, { align: 'center', bold: true });
    });
    if (e.phase === 'confirm' || e.phase === 'working') {
      // 잇기 전 확인
      const lines = wrap(CONFIRM_TEXT, b.w - P * 2);
      lines.forEach((l, i) => text(ctx, l, cx, textY(lay.msgY + 6 + i * LINE), PAL.ink, { align: 'center' }));
      const by = lay.msgY + 6 + lines.length * LINE + 10, gw = Math.max(64, measure('연결', true) + 16), nw = Math.max(64, measure('취소', true) + 16);
      const busy = e.phase === 'working';
      button(ctx, ui, 'link:yes', cx - gw - 4, by, gw, BTN_S, busy ? '연결 중' : '연결', { tone: 'gold', enabled: !busy, onClick: () => this.redeem() });
      button(ctx, ui, 'link:no', cx + 4, by, nw, BTN_S, '취소', { enabled: !busy, onClick: () => { e.phase = 'type'; } });
      closeBox();
      return;
    }
    if (e.fail) text(ctx, REDEEM_FAIL[e.fail] || REDEEM_FAIL.unreached, cx, textY(lay.msgY), PAL.red, { align: 'center' });
    const full = e.digits.length === CODE_LEN;
    for (const k of lay.keys) {
      const label = k.k === 'del' ? '지우기' : k.k === 'go' ? '연결' : k.k;
      const on = k.k === 'del' ? !!e.digits : k.k === 'go' ? full : !full;
      button(ctx, ui, `link:key:${k.k}`, k.x, k.y, k.w, k.h, label, { tone: k.k === 'go' && full ? 'gold' : 'plain', enabled: on, onClick: () => this.press(k.k), grow: lay.grow });
    }
    closeBox();
  }

  key(k) {
    const e = this.entry;
    if (this.unlinking === 'ask') { if (k === 'Escape') this.unlinking = null; else if (k === 'Enter') this.unlink(); return; }
    if (e.phase === 'confirm') { if (k === 'Enter') this.redeem(); else if (k === 'Escape' || k === 'Backspace') e.phase = 'type'; return; }
    if (e.phase === 'type') {
      if (/^[0-9]$/.test(k)) return this.press(k);
      if (k === 'Backspace') return this.press('del');
      if (k === 'Enter' && e.digits.length === CODE_LEN) return this.press('go');
    }
    if (k === 'Escape') this.leave();
  }
}
