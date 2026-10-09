// 계정(CHM-72, docs/design-notes/leaderboard.md 「계정」 · layout.md 24절): 판 밖 틀. 「기기 잇기」 화면과 탭으로 오간다(탭 「아이디」 · 「기기 잇기」).
//   계정 없음: 왼쪽 「아이디」 「비번」 입력 칸 + [들어오기] [계정 만들기], 오른쪽 알림 줄 + [개인정보 처리방침].
//   들어와 있음: 왼쪽 「아이디 taeho_an · 기기 2대」 + [비번 바꾸기] [나가기] [계정 지우기], 오른쪽에 고른 일(비번 칸 · 확인).
// 글자는 브라우저 입력 칸(app.fields — src/ui/textfield.js)으로 받는다. 값은 내는 순간에만 읽고 화면 상태에 두지 않는다.
// 서버와 주고받는 것은 app.rank · app.cloud가 한다 — 화면은 열쇠를 모른다.
import { PAL } from '../../render/palette.js';
import { W, text, box, measure } from '../../render/gfx.js';
import { wrap } from '../../render/text.js';
import { button } from '../ui.js';
import { pageHead, tabRow } from './common.js';
import { PAGE, PAD_BOX, LINE, GAP_GROUP, BTN_S, textY } from '../frame.js';
import { openBox, closeBox } from '../../render/layoutlog.js';
import { L } from '../lang.js';
import { accountProps } from '../telemetry.js';
import { USERNAME_FILTER } from '../textfield.js';
import { gainText } from './link.js';

const CARD_BG = '#0e1814';
export const PRIVACY_URL = 'privacy.html';
export const FIELD_H = 18, LABEL_W = 68, MSG_LINES = 2;
// 탭 줄(기기 잇기 화면과 같이 쓴다)
export const ACCOUNT_TABS = [['account', '아이디'], ['link', '기기 잇기']];
export function accountTabs(ctx, ui, app, cur) {
  tabRow(ctx, ui, 'acct', ACCOUNT_TABS, cur, PAGE.titleX + measure('계정', true) + 10, 5, BTN_S, (id) => { if (id !== cur) { app.sfx('pick'); app.go(id); } });
}

// 칸 자리(재는 쪽 test/layout.test.js와 같이 쓴다). 입력 칸은 위쪽 띠(y 110 위)에 둔다 — 폰 키보드가 올라와도 보이게
export function accountLayout() {
  const P = PAD_BOX, y = PAGE.bodyY, h = PAGE.btnY - GAP_GROUP - y;
  const left = { x: 12, y, w: 224, h }, right = { x: W - 12 - 224, y, w: 224, h };
  const titleY = y + P, r1 = titleY + LINE + 6, r2 = r1 + FIELD_H + 6, msgY = r2 + FIELD_H + 6, btnY = msgY + MSG_LINES * LINE + 4;
  const cell = (b, top) => ({ x: b.x + P + LABEL_W, y: top, w: b.w - P * 2 - LABEL_W, h: FIELD_H });
  return {
    left, right, titleY, r1, r2, msgY, btnY, btn2Y: btnY + BTN_S + 6, btn3Y: btnY + (BTN_S + 6) * 2,
    fields: { user: cell(left, r1), pass: cell(left, r2), cur: cell(right, r1), next: cell(right, r2), del: cell(right, r1) },
    privacyY: y + h - P - BTN_S,
  };
}

// 상태 한 줄(붉은 것 · 금빛 것)
export const ACCOUNT_FAIL = {
  bad: '아이디나 비번이 맞지 않는다', taken: '이미 쓰고 있는 아이디예요', username: '아이디는 영문 소문자 · 숫자 · _ 3~20자', weak: '비번은 8자 이상 · 흔한 것은 안 된다',
  other: '이 기기는 다른 계정으로 들어와 있다 · 먼저 나간다', has: '이 기기는 이미 계정에 들어와 있다', limit: '오늘은 더 할 수 없어요 · 내일 다시 해 주세요',
  unreached: '연결하지 못했어요', empty: '아이디와 비번을 넣는다', hangul: '아이디는 영문으로 입력하세요', wrongpw: '비번이 맞지 않는다', nopw: '비번을 넣는다',
};
export const lockedText = (min) => `잠겼다 · ${min}분 뒤에 다시 들어온다`;
export const ACCOUNT_OK = { made: '만들었다', in: '들어왔다', changed: '비번을 바꿨다', out: '나갔다', gone: '계정을 지웠다' };
export const ACCOUNT_INFO = ['어느 기기에서든 들어오면 기록과 순위 이름이 따라온다', '비번을 잊으면 들어와 있는 기기에서만 새로 정할 수 있다', '아이디는 남에게 보이지 않아요'];
export const LOGOUT_TEXT = '이 기기의 기록이 지워져요 · 계정에는 남아 있어요';
export const DELETE_TEXT = '계정과 기록 · 순위 성적이 모두 지워진다 · 되돌릴 수 없다';
export const DELETE_TEXT2 = '비번을 넣으면 지워진다';
export const FORGOT_TEXT = '지금 비번 없이 새로 정한다';

export class AccountScreen {
  constructor(app) {
    this.app = app;
    this.acct = app.rank.account();   // { username | null, devices } | null(아직 모름)
    this.mode = null;                 // null · 'password' · 'logout' · 'delete1' · 'delete2'
    this.forgot = false;              // 비번 바꾸기: 지금 비번 없이
    this.msg = null;                  // { text, tone: 'red' | 'gold', gain }
    this.busy = false;
    this.unreached = false;
    app.rank.accountLoad().then((a) => { if (a) this.acct = a; else this.unreached = true; }, () => { this.unreached = true; });
  }
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
    return p.then((r) => { this.busy = false; done(r); }, () => { this.busy = false; this.fail('unreached'); });
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
    box(ctx, at.x, at.y, at.w, at.h, CARD_BG, PAL.frameHi);
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
  // 글에 맞춘 단추를 왼쪽부터 놓는다
  row(ctx, ui, x, y, list) {
    for (const [id, label, opts] of list) {
      const w = Math.max(44, measure(label, true) + 14);
      button(ctx, ui, id, x, y, w, BTN_S, label, { enabled: !this.busy, ...opts });
      x += w + 6;
    }
  }

  draw(ctx, ui) {
    const app = this.app, lay = accountLayout();
    pageHead(ctx, '계정');
    accountTabs(ctx, ui, app, 'account');
    if (this.in()) this.drawIn(ctx, ui, lay); else this.drawOut(ctx, ui, lay);
    this.drawRight(ctx, ui, lay);
    button(ctx, ui, 'acct:back', PAGE.titleX, PAGE.btnY, 80, PAGE.btnH, '돌아가기', { onClick: () => this.leave() });
  }

  // 계정 없음: 아이디 · 비번 + [들어오기] [계정 만들기]
  drawOut(ctx, ui, lay) {
    const b = lay.left, P = PAD_BOX, f = this.app.fields;
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: '아이디로 들어오기' });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, PAL.frameHi);
    text(ctx, '아이디로 들어오기', b.x + P, textY(lay.titleY), PAL.dim);
    this.cell(ctx, 'user', '아이디', lay.fields.user, { type: 'text', autocomplete: 'username', name: 'username', max: 20, filter: USERNAME_FILTER, hint: 'next', enter: () => f.focus('pass') });
    this.cell(ctx, 'pass', '비번', lay.fields.pass, { type: 'password', autocomplete: 'current-password', name: 'password', max: 72, hint: 'go', enter: () => this.login() });
    // 한글 자판으로 친 아이디는 걸러진다 — 한 줄로 알린다
    if (f.rejected('user') && !this.msg) this.fail('hangul');
    else if (this.msg && this.msg.text === ACCOUNT_FAIL.hangul && !f.rejected('user')) this.msg = null;
    if (this.unreached && !this.msg && !this.acct) text(ctx, ACCOUNT_FAIL.unreached, b.x + P, textY(lay.msgY), PAL.dim);
    this.say(ctx, b, lay);
    this.row(ctx, ui, b.x + P, lay.btnY, [
      ['acct:login', this.busy ? '들어오는 중' : '들어오기', { tone: 'gold', onClick: () => this.login() }],
      ['acct:signup', '계정 만들기', { onClick: () => this.signup() }],
    ]);
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
    const x = b.x + P;
    this.row(ctx, ui, x, lay.btnY, [['acct:password', '비번 바꾸기', { tone: this.mode === 'password' ? 'gold' : 'plain', onClick: () => this.open('password') }]]);
    this.row(ctx, ui, x, lay.btn2Y, [['acct:logout', '나가기', { tone: this.mode === 'logout' ? 'gold' : 'plain', onClick: () => this.open('logout') }]]);
    this.row(ctx, ui, x, lay.btn3Y, [['acct:delete', '계정 지우기', { tone: this.mode === 'delete1' || this.mode === 'delete2' ? 'gold' : 'plain', onClick: () => this.open('delete1') }]]);
    closeBox();
  }

  // 오른쪽 칸: 알림 줄 또는 고른 일
  drawRight(ctx, ui, lay) {
    const app = this.app, b = lay.right, P = PAD_BOX, x = b.x + P, mode = this.in() ? this.mode : null;
    const title = { password: '비번 바꾸기', logout: '나가기', delete1: '계정 지우기', delete2: '계정 지우기' }[mode] || '알아 둘 것';
    openBox('panel', b.x, b.y, b.w, b.h, P, { name: title });
    box(ctx, b.x, b.y, b.w, b.h, PAL.feltDk, mode === 'delete1' || mode === 'delete2' ? PAL.red : PAL.frameHi);
    text(ctx, title, x, textY(lay.titleY), PAL.dim);
    const para = (s, y, col = PAL.ink) => { const lines = wrap(s, b.w - P * 2); lines.forEach((l, i) => text(ctx, l, x, textY(y + i * LINE), col)); return y + lines.length * LINE; };
    const stop = ['acct:no', '그만', { onClick: () => { this.mode = null; this.msg = null; } }];
    if (mode) this.say(ctx, b, lay);
    if (mode === 'password') {
      if (this.forgot) para(FORGOT_TEXT, lay.r1 + 2, PAL.dim);
      else this.cell(ctx, 'cur', '지금 비번', lay.fields.cur, { type: 'password', autocomplete: 'current-password', name: 'current-password', max: 72, hint: 'next', enter: () => app.fields.focus('next') });
      this.cell(ctx, 'next', '새 비번', lay.fields.next, { type: 'password', autocomplete: 'new-password', name: 'new-password', max: 72, hint: 'go', enter: () => this.password() });
      this.row(ctx, ui, x, lay.btnY, [['acct:yes', this.busy ? '정하는 중' : '정하기', { tone: 'gold', onClick: () => this.password() }], stop]);
      this.row(ctx, ui, x, lay.btn2Y, [['acct:forgot', this.forgot ? '지금 비번을 안다' : '지금 비번을 잊었다', { onClick: () => { this.forgot = !this.forgot; this.msg = null; } }]]);
    } else if (mode === 'logout') {
      para(LOGOUT_TEXT, lay.r1);
      this.row(ctx, ui, x, lay.btnY, [['acct:yes', this.busy ? '나가는 중' : '나가기', { tone: 'red', onClick: () => this.logout() }], stop]);
    } else if (mode === 'delete1') {
      para(DELETE_TEXT, lay.r1);
      this.row(ctx, ui, x, lay.btnY, [['acct:yes', '계속', { tone: 'red', onClick: () => this.open('delete2') }], stop]);
    } else if (mode === 'delete2') {
      this.cell(ctx, 'del', '비번', lay.fields.del, { type: 'password', autocomplete: 'current-password', name: 'password', max: 72, hint: 'go', enter: () => this.remove() });
      para(DELETE_TEXT2, lay.r2 + 2, PAL.red);
      this.row(ctx, ui, x, lay.btnY, [['acct:yes', this.busy ? '지우는 중' : '계정 지우기', { tone: 'red', onClick: () => this.remove() }], stop]);
    } else {
      let y = lay.titleY + LINE + 6;
      for (const s of ACCOUNT_INFO) y = para(s, y) + 6;
      this.row(ctx, ui, x, lay.privacyY, [['acct:privacy', '개인정보 처리방침', { enabled: true, onClick: () => { if (!app.openPage(PRIVACY_URL)) app.toast('열지 못했어요', PAL.ink); } }]]);
    }
    closeBox();
  }

  key(k) {
    if (k !== 'Escape') return;
    if (this.mode) { this.mode = null; this.msg = null; } else this.leave();
  }
}
