// 계정(CHM-72, docs/design-notes/leaderboard.md 「계정」 · layout.md 24절): 판 밖 틀. 「기기 잇기」 화면과 탭으로 오간다(탭 「아이디」 · 「기기 잇기」).
//   계정 없음: 왼쪽 「아이디」 「비번」 입력 칸 + [들어오기] [계정 만들기], 오른쪽 알림 줄 + [개인정보 처리방침].
//   들어와 있음: 왼쪽 「아이디 taeho_an · 기기 2대」 + [비번 바꾸기] [나가기] [계정 지우기], 오른쪽에 고른 일(비번 칸 · 확인).
// 글자는 브라우저 입력 칸(app.fields — src/ui/textfield.js)으로 받는다. 값은 내는 순간에만 읽고 화면 상태에 두지 않는다.
// 서버와 주고받는 것은 app.rank · app.cloud가 한다 — 화면은 열쇠를 모른다.
import { PAL } from '../../render/palette.js';
import { W, text, box, slot, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { btnW, buttonRow } from '../ui.js';
import { pageHead, bottomBar } from './common.js';
import { PAGE, PAD_BOX, LINE, BTN_H, SP, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { L } from '../lang.js';
import { accountProps } from '../telemetry.js';
import { USERNAME_FILTER } from '../textfield.js';
import { gainText } from './link.js';

export const PRIVACY_URL = 'privacy.html';
export const FIELD_H = 18, LABEL_W = 68, MSG_LINES = 2;
// 머리줄(기기 잇기 화면과 같이 쓴다): 큰 제목 「계정」 + 탭 「아이디」 · 「기기 연결」(같은 폭)
export const ACCOUNT_TABS = [['account', '아이디'], ['link', '기기 연결']];
export function accountTabs(ctx, ui, app, cur) {
  pageHead(ctx, '계정', null, { big: true, tabs: { ui, prefix: 'acct', list: ACCOUNT_TABS, cur, go: (id) => { if (id !== cur) { app.sfx('pick'); app.go(id); } } } });
}

// 칸 자리(재는 쪽 test/layout.test.js와 같이 쓴다). 입력 칸은 위쪽 띠(y 110 위)에 둔다 — 폰 키보드가 올라와도 보이게.
// 줄 사이 4(묶음 안), 세로로 쌓은 단추 사이 8. 상자 높이는 그리는 쪽이 상태마다 내용에 맞춘다(h는 가장 큰 것 — 들어와 있음)
export function accountLayout() {
  const P = PAD_BOX, y = PAGE.bodyY, IN = SP.s;
  // 왼쪽 칸이 조금 넓다: 가장 넓은 아이디(「m」 스무 자 212)가 안 여백 안에 한 줄로 든다
  const lw = 232, gap = SP.m;
  const titleY = y + P, r1 = titleY + LINE + IN, r2 = r1 + FIELD_H + IN, msgY = r2 + FIELD_H + IN, btnY = msgY + MSG_LINES * LINE + IN;
  const btn2Y = btnY + BTN_H + SP.m, btn3Y = btn2Y + BTN_H + SP.m, h = btn3Y + BTN_H + P - y;
  const left = { x: PAGE.titleX, y, w: lw, h }, right = { x: PAGE.titleX + lw + gap, y, w: W - PAGE.titleX * 2 - lw - gap, h };
  const cell = (b, top) => ({ x: b.x + P + LABEL_W, y: top, w: b.w - P * 2 - LABEL_W, h: FIELD_H });
  return {
    left, right, titleY, r1, r2, msgY, btnY, btn2Y, btn3Y,
    fields: { user: cell(left, r1), pass: cell(left, r2), cur: cell(right, r1), next: cell(right, r2), del: cell(right, r1) },
    privacyY: y + h - P - BTN_H,
  };
}

// 계정 없음의 단추 둘(로그인 · 계정 만들기): 같은 폭, 한 줄에 안 들어가면 세로로
const outBtnW = () => Math.max(btnW('로그인'), btnW('로그인 중'), btnW('계정 만들기'));
const outStacked = (w) => outBtnW() * 2 + SP.m > w - PAD_BOX * 2;

// 상태 한 줄(붉은 것 · 금빛 것)
export const ACCOUNT_FAIL = {
  bad: '아이디나 비밀번호가 맞지 않아요', taken: '이미 쓰고 있는 아이디예요', username: '아이디는 영문 소문자 · 숫자 · _ 3~20자', weak: '비밀번호는 8자 이상 · 흔한 것은 안 돼요',
  other: '다른 계정으로 로그인되어 있어요 · 먼저 로그아웃하세요', has: '이 기기는 이미 로그인되어 있어요', limit: '오늘은 더 할 수 없어요 · 내일 다시 해 주세요',
  unreached: '연결하지 못했어요', empty: '아이디와 비밀번호를 입력하세요', hangul: '아이디는 영문으로 입력하세요', wrongpw: '비밀번호가 맞지 않아요', nopw: '비밀번호를 입력하세요',
};
export const lockedText = (min) => `잠겼어요 · ${min}분 뒤에 다시 로그인하세요`;
export const ACCOUNT_OK = { made: '계정을 만들었어요', in: '로그인했어요', changed: '비밀번호를 바꿨어요', out: '로그아웃했어요', gone: '계정을 삭제했어요' };
export const ACCOUNT_INFO = ['어느 기기에서든 로그인하면 기록과 순위 이름이 따라와요', '비밀번호를 잊으면 로그인된 기기에서만 새로 정할 수 있어요', '아이디는 남에게 보이지 않아요'];
export const LOGOUT_TEXT = '이 기기의 기록이 지워져요 · 계정에는 남아 있어요';
export const DELETE_TEXT = '계정과 기록 · 순위 성적이 모두 삭제돼요 · 되돌릴 수 없어요';
export const DELETE_TEXT2 = '비밀번호를 입력하면 삭제돼요';
export const FORGOT_TEXT = '지금 비밀번호 없이 새로 정해요';

export class AccountScreen {
  constructor(app) {
    this.app = app;
    this.acct = app.rank.account();   // { username | null, devices } | null(아직 모름)
    this.mode = null;                 // null · 'password' · 'logout' · 'delete1' · 'delete2'
    this.forgot = false;              // 비번 바꾸기: 지금 비번 없이
    this.msg = null;                  // { text, tone: 'red' | 'gold', gain }
    this.busy = false;
    this.unreached = false;
    app.rank.accountLoad().then((a) => { if (a) this.acct = a; else this.unreached = true; }, () => { this.unreached = true; }).finally(() => app.invalidate());
  }
  // 입력 · 답(invalidate)이 올 때만 바뀐다
  animating() { return false; }
  in() { return !!(this.acct && this.acct.username); }
  fail(why, r = null) { this.msg = { text: why === 'locked' ? lockedText((r && r.wait) || 15) : ACCOUNT_FAIL[why] || ACCOUNT_FAIL.unreached, tone: 'red' }; }
  good(id) { this.msg = { text: ACCOUNT_OK[id], tone: 'gold', gain: null }; this.app.sfx('buy'); }
  // 내는 순간에만 입력 칸을 읽는다
  creds() {
    const f = this.app.fields, username = f.value('user'), password = f.value('pass');
    if (!username || !password) { this.fail(f.rejected('user') ? 'hangul' : 'empty'); return null; }
    return { username, password };
  }
  run(p, done) {
    this.busy = true; this.msg = null;
    this.app.fields.blur();
    return p.then((r) => { this.busy = false; done(r); }, () => { this.busy = false; this.fail('unreached'); }).finally(() => this.app.invalidate());
  }

  signup() {
    const app = this.app, c = this.busy ? null : this.creds();
    if (!c) return;
    this.run(app.rank.signup(c.username, c.password), (r) => {
      app.track('account_signup', accountProps(r), { always: true });
      if (!r.ok) return this.fail(r.why, r);
      this.acct = app.rank.account();
      this.good('made');
      app.cloud.touch(); // 이 기기의 기록을 계정의 저장으로 올려 둔다
    });
  }
  login() {
    const app = this.app, c = this.busy ? null : this.creds();
    if (!c) return;
    this.run(app.rank.login(c.username, c.password), async (r) => {
      app.track('account_login', accountProps(r), { always: true });
      if (!r.ok) return this.fail(r.why, r);
      this.acct = app.rank.account();
      this.good('in');
      // 계정의 저장을 당겨 와 이 기기의 것과 합쳐 올린다(기기 잇기와 같은 길)
      const m = this.msg, got = await app.cloud.join();
      if (got.ok) m.gain = got.gain;
    });
  }
  // 나가기 · 지우기 앞에 이 기기의 것을 계정에 올려 둔다. 못 올리면 그만둔다(기록을 잃지 않게)
  logout() {
    const app = this.app;
    if (this.busy) return;
    this.run(app.cloud.push().then((up) => (up ? app.rank.logout() : { ok: false, why: 'unreached' })), (r) => {
      this.mode = null;
      if (!r.ok) { if (r.why === 'none') this.acct = app.rank.account(); return this.fail('unreached'); }
      app.track('account_logout', {}, { always: true });
      app.wipeDevice();
      this.acct = app.rank.account();
      this.good('out');
    });
  }
  password() {
    const app = this.app, f = app.fields;
    if (this.busy) return;
    const next = f.value('next'), current = this.forgot ? null : f.value('cur');
    if (!next || (!this.forgot && !current)) return this.fail('nopw');
    this.run(app.rank.setPassword(next, current), (r) => {
      if (!r.ok) return this.fail(r.why === 'bad' ? 'wrongpw' : r.why, r);
      app.track('account_password', { reset: !!r.reset }, { always: true });
      this.mode = null; this.forgot = false;
      this.good('changed');
    });
  }
  remove() {
    const app = this.app, password = app.fields.value('del');
    if (this.busy) return;
    if (!password) return this.fail('nopw');
    this.run(app.rank.deleteAccount(password), (r) => {
      if (!r.ok) return this.fail(r.why === 'bad' ? 'wrongpw' : r.why, r);
      app.track('account_delete', {}, { always: true });
      app.wipeDevice();
      this.acct = app.rank.account();
      this.mode = null;
      this.good('gone');
    });
  }
  open(mode) { this.mode = mode; this.msg = null; this.forgot = false; this.app.sfx('pick'); }
  leave() { this.app.toTitle(); }

  // 입력 칸 하나: 캔버스에 이름표와 칸 바탕, 그 위에 브라우저 입력 칸
  cell(ctx, id, label, at, spec) {
    text(ctx, label, at.x - LABEL_W, textY(at.y, FIELD_H), PAL.ink);
    slot(ctx, at.x, at.y, at.w, at.h);
    this.app.fields.field(id, { ...at, label: L(label), ...spec });
  }
  // 상태 줄(두 줄까지): 붉은 것 · 금빛 것 + 합쳐진 것 한 줄
  say(ctx, b, lay) {
    const m = this.msg;
    if (!m) return;
    const lines = wrap(m.text, b.w - PAD_BOX * 2), g = lines.length < MSG_LINES ? gainText(m.gain) : null;
    lines.slice(0, MSG_LINES).forEach((l, i) => text(ctx, l, b.x + PAD_BOX, textY(lay.msgY + i * LINE), m.tone === 'gold' ? PAL.gold : PAL.red, { bold: m.tone === 'gold' }));
    if (g) text(ctx, g, b.x + PAD_BOX, textY(lay.msgY + lines.length * LINE), PAL.ink);
  }
  // 단추 한 줄(같은 폭 · 사이 8 — 29절). 바쁜 동안은 꺼 둔다
  row(ctx, ui, x, y, list, w = null) {
    return buttonRow(ctx, ui, list.map(([id, label, opts]) => ({ id, label, enabled: !this.busy, ...opts })), x, y, { w });
  }

  // 오른쪽 칸 알림 줄(알아 둘 것): 문단 자리 · 처리방침 단추 y
  infoLay(lay) {
    const w = lay.right.w - PAD_BOX * 2;
    let y = lay.titleY + LINE + SP.s;
    const paras = ACCOUNT_INFO.map((s, i) => { if (i) y += SP.s; const lines = wrap(s, w), top = y; y += lines.length * LINE; return { lines, top }; });
    return { paras, privacyY: y + SP.m };
  }
  // 두 상자의 높이: 이 상태에서 내용이 더 긴 쪽에 맞춘다(hug)
  boxH(lay) {
    const mode = this.in() ? this.mode : null;
    const left = (this.in() ? lay.btn3Y : outStacked(lay.left.w) ? lay.btn2Y : lay.btnY) + BTN_H;
    const rows = mode ? this.modeRows(mode, lay) : null;
    const right = rows ? rows[rows.length - 1].y + BTN_H : this.infoLay(lay).privacyY + BTN_H;
    return Math.max(left, right) + PAD_BOX - lay.left.y;
  }
  draw(ctx, ui) {
    const app = this.app, lay = accountLayout(), h = this.boxH(lay);
    lay.left = { ...lay.left, h }; lay.right = { ...lay.right, h };
    accountTabs(ctx, ui, app, 'account');
    if (this.in()) this.drawIn(ctx, ui, lay); else this.drawOut(ctx, ui, lay);
    this.drawRight(ctx, ui, lay);
    bottomBar(ctx, ui, { back: { id: 'acct:back', onClick: () => this.leave() } });
  }

  // 계정 없음: 아이디 · 비번 + [들어오기] [계정 만들기]
  drawOut(ctx, ui, lay) {
    const b = lay.left, P = PAD_BOX, f = this.app.fields;
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: '아이디로 로그인' });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, PAL.frameHi);
    text(ctx, '아이디로 로그인', b.x + P, textY(lay.titleY), PAL.dim);
    this.cell(ctx, 'user', '아이디', lay.fields.user, { type: 'text', autocomplete: 'username', name: 'username', max: 20, filter: USERNAME_FILTER, hint: 'next', enter: () => f.focus('pass') });
    this.cell(ctx, 'pass', '비밀번호', lay.fields.pass, { type: 'password', autocomplete: 'current-password', name: 'password', max: 72, hint: 'go', enter: () => this.login() });
    // 한글 자판으로 친 아이디는 걸러진다 — 한 줄로 알린다
    if (f.rejected('user') && !this.msg) this.fail('hangul');
    else if (this.msg && this.msg.text === ACCOUNT_FAIL.hangul && !f.rejected('user')) this.msg = null;
    if (this.unreached && !this.msg && !this.acct) text(ctx, ACCOUNT_FAIL.unreached, b.x + P, textY(lay.msgY), PAL.dim);
    this.say(ctx, b, lay);
    // 둘이 한 줄에 같은 폭으로 안 들어가면(영어) 세로로 같은 폭
    const login = ['acct:login', this.busy ? '로그인 중' : '로그인', { tone: 'gold', onClick: () => this.login() }];
    const signup = ['acct:signup', '계정 만들기', { onClick: () => this.signup() }];
    if (outStacked(b.w)) {
      const bw = outBtnW();
      this.row(ctx, ui, b.x + P, lay.btnY, [login], bw);
      this.row(ctx, ui, b.x + P, lay.btn2Y, [signup], bw);
    } else this.row(ctx, ui, b.x + P, lay.btnY, [login, signup], outBtnW());
    closeBox();
  }

  // 들어와 있음: 아이디 · 기기 수 + 할 일 셋
  drawIn(ctx, ui, lay) {
    const b = lay.left, P = PAD_BOX, a = this.acct;
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: '이 기기의 계정' });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, PAL.gold);
    text(ctx, '이 기기의 계정', b.x + P, textY(lay.titleY), PAL.dim);
    // 「아이디」 이름표는 아이디 옆에 들어갈 때만(가장 넓은 아이디면 뺀다)
    const wide = measure(a.username) > b.w - P * 2 - LABEL_W;
    if (!wide) text(ctx, '아이디', b.x + P, textY(lay.r1, FIELD_H), PAL.dim);
    text(ctx, a.username, b.x + P + (wide ? 0 : LABEL_W), textY(lay.r1, FIELD_H), PAL.goldHi);
    if (a.devices != null) text(ctx, `기기 ${a.devices}대`, b.x + P, textY(lay.r2, FIELD_H), PAL.ink);
    if (!this.mode) this.say(ctx, b, lay);
    // 할 일 셋은 세로로 같은 폭(가장 넓은 글)
    const x = b.x + P, bw = Math.max(btnW('비밀번호 바꾸기'), btnW('로그아웃'), btnW('계정 삭제'));
    this.row(ctx, ui, x, lay.btnY, [['acct:password', '비밀번호 바꾸기', { tone: this.mode === 'password' ? 'gold' : 'plain', onClick: () => this.open('password') }]], bw);
    this.row(ctx, ui, x, lay.btn2Y, [['acct:logout', '로그아웃', { tone: this.mode === 'logout' ? 'gold' : 'plain', onClick: () => this.open('logout') }]], bw);
    this.row(ctx, ui, x, lay.btn3Y, [['acct:delete', '계정 삭제', { tone: this.mode === 'delete1' || this.mode === 'delete2' ? 'gold' : 'plain', onClick: () => this.open('delete1') }]], bw);
    closeBox();
  }

  // 고른 일의 단추 줄: [하기 · 취소]가 한 줄에 같은 폭으로 안 들어가면(영어) 세로로, 그 아래 줄(비번 잊음)은 다음 칸에.
  // 돌려주는 값 [{ items, y, w }] — 줄 자리는 btnY · btn2Y · btn3Y
  modeRows(mode, lay) {
    const stop = ['acct:no', '취소', { onClick: () => { this.mode = null; this.msg = null; } }];
    const yes = {
      password: ['acct:yes', this.busy ? '변경 중' : '변경', { tone: 'gold', onClick: () => this.password() }],
      logout: ['acct:yes', this.busy ? '로그아웃 중' : '로그아웃', { tone: 'red', onClick: () => this.logout() }],
      delete1: ['acct:yes', '계속', { tone: 'red', onClick: () => this.open('delete2') }],
      delete2: ['acct:yes', this.busy ? '삭제 중' : '계정 삭제', { tone: 'red', onClick: () => this.remove() }],
    }[mode];
    const extra = mode === 'password' ? [['acct:forgot', this.forgot ? '비밀번호를 알아요' : '비밀번호를 잊었어요', { onClick: () => { this.forgot = !this.forgot; this.msg = null; } }]] : [];
    const ys = [lay.btnY, lay.btn2Y, lay.btn3Y], inner = lay.right.w - PAD_BOX * 2;
    const w = Math.max(...[yes, stop].map(([, l]) => btnW(l)));
    const rows = w * 2 + SP.m <= inner ? [{ items: [yes, stop], w }] : [{ items: [yes], w }, { items: [stop], w }];
    for (const e of extra) rows.push({ items: [e], w: null });
    return rows.map((r, i) => ({ ...r, y: ys[i] }));
  }
  // 오른쪽 칸: 알림 줄 또는 고른 일
  drawRight(ctx, ui, lay) {
    const app = this.app, b = lay.right, P = PAD_BOX, x = b.x + P, mode = this.in() ? this.mode : null;
    const title = { password: '비밀번호 바꾸기', logout: '로그아웃', delete1: '계정 삭제', delete2: '계정 삭제' }[mode] || '알아 둘 것';
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: title });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, mode === 'delete1' || mode === 'delete2' ? PAL.red : PAL.frameHi);
    text(ctx, title, x, textY(lay.titleY), PAL.dim);
    const para = (s, y, col = PAL.ink) => { const lines = wrap(s, b.w - P * 2); lines.forEach((l, i) => text(ctx, l, x, textY(y + i * LINE), col)); return y + lines.length * LINE; };
    if (mode) { this.say(ctx, b, lay); for (const r of this.modeRows(mode, lay)) this.row(ctx, ui, x, r.y, r.items, r.w); }
    if (mode === 'password') {
      if (this.forgot) para(FORGOT_TEXT, lay.r1 + 2, PAL.dim);
      else this.cell(ctx, 'cur', '현재', lay.fields.cur, { type: 'password', autocomplete: 'current-password', name: 'current-password', max: 72, hint: 'next', enter: () => app.fields.focus('next') });
      this.cell(ctx, 'next', '새로', lay.fields.next, { type: 'password', autocomplete: 'new-password', name: 'new-password', max: 72, hint: 'go', enter: () => this.password() });
    } else if (mode === 'logout') {
      para(LOGOUT_TEXT, lay.r1);
    } else if (mode === 'delete1') {
      para(DELETE_TEXT, lay.r1);
    } else if (mode === 'delete2') {
      this.cell(ctx, 'del', '비밀번호', lay.fields.del, { type: 'password', autocomplete: 'current-password', name: 'password', max: 72, hint: 'go', enter: () => this.remove() });
      para(DELETE_TEXT2, lay.r2 + 2, PAL.red);
    } else {
      const info = this.infoLay(lay);
      for (const p of info.paras) p.lines.forEach((l, i) => text(ctx, l, x, textY(p.top + i * LINE), PAL.ink));
      this.row(ctx, ui, x, info.privacyY, [['acct:privacy', '개인정보 처리방침', { enabled: true, onClick: () => { if (!app.openPage(PRIVACY_URL)) app.toast('열지 못했어요', PAL.ink); } }]]);
    }
    closeBox();
  }

  key(k) {
    if (k !== 'Escape') return;
    if (this.mode) { this.mode = null; this.msg = null; } else this.leave();
  }
}
