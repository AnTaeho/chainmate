// 대국 화면(mockup 배치). 가운데 8×8 판, 왼쪽 판(관 · 목표 · 점수 · 값 × 연쇄 · 사슬 모습 줄 · 수 · 무르기 · 상금 · 주머니),
// 오른쪽(격언 칸 · 손).
// 규칙은 명령으로만 진행하고, 돌아온 사건을 차례로 연출(Seq)하는 동안 화면은 「보이는 판」(view)을 그린다.
import { PAL } from '../../render/palette.js';
import { W, H, text, box, rect, frame, dots, line, sprite, num, digits, measure } from '../../render/gfx.js';
import { spriteChips, spriteCanvas, outlineCanvas, TONE } from '../../render/sprites.js';
import { dropSquaresFor, visibleIncoming, isHidden, overflowTier } from '../../sim/battle.js';
import { chainCaptures, chainRedrops } from '../../sim/chain.js';
import { reach } from '../../sim/board.js';
import { previewCapture, previewDrop } from '../../sim/solver.js';
import { REWARD, maximCapacity, maximCount } from '../../sim/run.js';
import { MASTER_BY_ID } from '../../data/masters.js';
import { LEGEND_BY_ID } from '../../data/legends.js';
import { Seq, ease, lerp } from '../anim.js';
import { button } from '../ui.js';
import { maximColumn, pieceCard, pieceTip, discardIcon, panel, tipLines, fragmentStrip } from '../parts.js';
import { KIND_SHORT, PIECE_NAME, PART_NAME, josa } from '../words.js';
import { pauseButton } from './common.js';
import { drawPortrait } from '../../render/portraits.js';
import { wrap } from '../../render/text.js';

export const S = 28, BX = 128, BY = 30; // 판 위에 목표 막대 자리를 두려고 mockup(23)보다 7px 내렸다
export const sqXY = (sq) => ({ x: BX + (sq & 7) * S, y: BY + (7 - (sq >> 3)) * S });
export const LX = 8, LW = 112, RX = 360, RW = 112;
const clone = (x) => JSON.parse(JSON.stringify(x));

// 값 · 연쇄 상자에 들어가는 짧은 숫자
export function short(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 10 && n % 1) return n.toFixed(1);
  if (a < 100 && n % 1) return n.toFixed(1);
  if (a < 10000) return Math.floor(n).toLocaleString('en-US');
  const units = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K']];
  for (const [u, s] of units) if (a >= u) { const v = n / u; return (v < 100 ? v.toFixed(1) : Math.floor(v)) + s; }
  return String(Math.floor(n));
}
// 빗금(노림수 · 끊김): 붉은색을 못 가려도 무늬로 알아보게
function hatch(ctx, x, y, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < S * 2; i += 5) for (let j = 0; j < S; j++) { const k = i - j; if (k >= 0 && k < S) ctx.fillRect(x + k, y + j, 1, 1); }
}
// 점선(미리 보기의 길)
function dotLine(ctx, x0, y0, x1, y1, col, step = 3) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i += step) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}
// 증원 그림자의 떨어질 표(▼ 5×3)
function dropMark(ctx, x, y, col) {
  rect(ctx, x, y, 5, 1, col); rect(ctx, x + 1, y + 1, 3, 1, col); rect(ctx, x + 2, y + 2, 1, 1, col);
}
// 칸 말풍선을 그 칸 바로 아래(넘치면 위)에: 옆 칸의 미리 보기와 오른쪽 패널을 덜 가리게
function sqTip(x, y, title, body, w = 130) {
  const tip = tipLines(title, body, w);
  const h = 10 + 14 + tip.lines.length * 13;
  const ty = y + S + 2 + h > 268 ? y - h - 2 : y + S + 2;
  return { tip, tipAt: { x: x + S / 2 - w / 2, y: ty } };
}
const FALL = 0.2, FALL_PX = 14; // 증원이 위에서 떨어지는 시간(×1) · 높이

// 칸 안의 둥근 고리(다음에 먹을 적)
function ringAt(ctx, x, y, col, thick = 1) {
  for (let k = 0; k < thick; k++) {
    const o = k;
    for (let i = 10; i < 18; i++) { rect(ctx, x + i, y + 3 + o, 1, 1, col); rect(ctx, x + i, y + 24 - o, 1, 1, col); rect(ctx, x + 3 + o, y + i, 1, 1, col); rect(ctx, x + 24 - o, y + i, 1, 1, col); }
    for (const [px, py] of [[8, 5], [9, 4], [18, 4], [19, 5], [5, 8], [4, 9], [22, 8], [23, 9], [4, 18], [5, 19], [23, 18], [22, 19], [8, 22], [9, 23], [18, 23], [19, 22]]) rect(ctx, x + px, y + py, 1, 1, col);
    for (const [px, py] of [[6, 6], [7, 6], [6, 7], [20, 6], [21, 6], [21, 7], [6, 20], [6, 21], [7, 21], [21, 20], [20, 21], [21, 21]]) rect(ctx, x + px, y + py, 1, 1, col);
  }
}
// 먹으러 가는 시간: 미끄러지는 기물은 지나는 칸 수만큼, 나이트는 L자로 한 번 튀고, 폰 · 킹은 한 칸
const dist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
function moveDur(form, from, to) {
  if (form === 'N') return 0.2;
  if (form === 'P' || form === 'K') return 0.12;
  return 0.08 + 0.035 * Math.min(7, dist(from, to));
}
// 움직이는 기물의 자리(p 0→1): 나이트는 긴 다리 → 짧은 다리, 작은 포물선
export function moverXY(form, from, to, p) {
  const a = sqXY(from), c = sqXY(to);
  if (form !== 'N') return { x: lerp(a.x, c.x, p), y: lerp(a.y, c.y, p) };
  const df = (to & 7) - (from & 7);
  const mid = Math.abs(df) === 2 ? { x: c.x, y: a.y } : { x: a.x, y: c.y };
  const q = ease.inOut(p);
  const k = q < 2 / 3 ? q * 1.5 : (q - 2 / 3) * 3;
  const pt = q < 2 / 3 ? { x: lerp(a.x, mid.x, k), y: lerp(a.y, mid.y, k) } : { x: lerp(mid.x, c.x, k), y: lerp(mid.y, c.y, k) };
  return { x: pt.x, y: pt.y - Math.sin(p * Math.PI) * 9 };
}
const bagTip = (b) => {
  const counts = {};
  for (const p of b.bag) counts[p.t] = (counts[p.t] || 0) + 1;
  const parts = ['P', 'N', 'B', 'R', 'Q'].filter((t) => counts[t]).map((t) => `${PIECE_NAME[t]} ${counts[t]}`);
  return tipLines('주머니', parts.length ? parts.join(' · ') : '비었다');
};

// 대국이 어디서 오나: 판(런)의 대국(기본) · 첫 수업 · 타이틀 시연. 화면은 같은 규칙 · 같은 연출을 쓴다.
//   live()   지금 둘 수 있는 대국(끝나 판에서 빠졌으면 null)
//   cmd(c)   명령 하나 → 사건 배열
//   run      판(런) 상태(없으면 상금 · 격언 칸 · 막간을 그리지 않는다)
export const runSource = (app) => ({ kind: 'run', live: () => app.run.battle, cmd: (c) => app.cmd(c), get run() { return app.run; } });

export class BattleScreen {
  constructor(app, { events = [], source = null, quiet = false, fx = null } = {}) {
    this.app = app;
    this.src = source || runSource(app);
    this.quiet = quiet;            // 소리 · 흔들림 · 알림 없음(타이틀 시연)
    this.fx = fx || app.fx;
    this.seq = new Seq();
    this.sel = [];
    this.view = {};
    this.runEvents = [];
    this.bRef = this.src.live();
    this.drops = null;
    this.fast = false;
    this.banner = null;
    this.stamp = null;
    this.lastEnd = null;
    this.sync();
    const info = events.find((e) => e.type === 'battleStart');
    const b = this.bRef;
    const m = b.mods.find((s) => MASTER_BY_ID[s.id]);
    if (m) { this.banner = { title: `명인 ${MASTER_BY_ID[m.id].name}`, sub: MASTER_BY_ID[m.id].text, t: 0, life: 2.6, col: PAL.red, master: m.id }; this.snd('start'); }
    else if (info && this.run) this.banner = { title: `${this.run.ante}관 · ${KIND_SHORT[b.kind]} 대국`, sub: `목표 ${num(b.target)}`, t: 0, life: 1.4, col: PAL.gold };
  }

  // 판 한가운데 뜨는 큰 글자는 대국 화면과 함께 사라진다(보상 화면 글자를 덮지 않게)
  onLeave() { this.fx.list = this.fx.list.filter((e) => !e.word); }
  get run() { return this.src.run; }
  live() { return this.src.live(); }
  get b() { return this.live() || this.bRef; }
  snd(name, arg) { if (!this.quiet) this.app.sfx(name, arg); }
  shake(px, dur) { if (!this.quiet) this.app.shake(px, dur); }
  hitstop(sec) { if (!this.quiet) this.app.hitstop(sec); }
  toast(msg, col, dur) { if (!this.quiet) this.app.toast(msg, col, dur); }
  get busy() { return this.seq.busy; }

  // 규칙 상태에서 보이는 판을 다시 읽는다(연출이 끝날 때마다)
  sync() {
    const b = this.b;
    const v = this.view;
    v.board = clone(b.board);
    v.hand = clone(b.hand);
    v.score = b.score; v.target = b.target;
    v.movesLeft = b.movesLeft; v.moves = b.rules.moves;
    v.discardsLeft = b.discardsLeft; v.discards = b.rules.discards;
    v.bag = b.bag.length; v.deckSize = b.deckSize;
    v.mover = null; v.flip = null; v.dropIn = null; v.cut = null; v.gather = null; v.count = null; v.lift = null;
    const c = b.chain;
    if (c && !c.done) {
      v.chain = {
        sq: c.sq, form: c.form, value: c.value, mult: c.mult,
        steps: [...c.captures.map((x) => x.form), c.form],
        path: [c.dropSq, ...c.captures.map((x) => x.to)],
        forced: c.forced ? c.forced.slice() : null, awaiting: c.awaiting ? chainRedrops(b) : null,
        cut: false,
      };
    } else v.chain = null;
    this.targets = null;
    this.drops = null;
    this.pvCache = new Map();
    this.tapSq = null;
    this.kbIdx = null;
    this.sel = this.sel.filter((i) => i < v.hand.length);
  }

  // 지금 누를 수 있는 칸(판이 바뀔 때만 다시 잰다)
  clickable() {
    if (this.busy) return { kind: null, list: [] };
    const b = this.live();
    if (!b) return { kind: null, list: [] };
    if (!this.targets) {
      if (b.status === 'chain') this.targets = b.chain.awaiting ? { kind: 'redrop', list: chainRedrops(b) } : { kind: 'capture', list: chainCaptures(b) };
      else if (b.status === 'play' && this.sel.length === 1) {
        const i = this.sel[0];
        if (!this.drops || this.drops.i !== i) this.drops = { i, list: dropSquaresFor(b, b.hand[i]) };
        this.targets = { kind: 'drop', list: this.drops.list };
      } else this.targets = { kind: null, list: [] };
      this.targets = this.filterTargets(this.targets, b);
    }
    return this.targets;
  }
  // 첫 수업이 누를 곳을 좁힌다(평소 대국은 그대로)
  filterTargets(t) { return t; }
  // 누를 수 없는 칸을 눌렀다
  missSq() {}

  // 미리 보기: 지금 겨누는 칸(마우스 · 화살표 · 첫 누르기)과 그 결과. 규칙 조회는 칸마다 한 번.
  aimSq(ui) {
    const t = this.clickable();
    if (!t.list.length || this.noPreview) return null;
    const h = ui.hover && ui.hover.id.startsWith('sq:') ? Number(ui.hover.id.slice(3)) : null;
    if (h != null && t.list.includes(h)) return h;
    if (this.tapSq != null && t.list.includes(this.tapSq)) return this.tapSq;
    if (this.kbIdx != null) return t.list[((this.kbIdx % t.list.length) + t.list.length) % t.list.length];
    return null;
  }
  preview(sq) {
    const t = this.clickable();
    const b = this.live();
    if (!b || sq == null) return null;
    const key = `${t.kind}:${this.sel[0]}:${sq}`;
    if (!this.pvCache) this.pvCache = new Map();
    if (!this.pvCache.has(key)) {
      let pv = null;
      try {
        if (t.kind === 'capture') pv = { kind: 'capture', ...previewCapture(b, sq) };
        else if (t.kind === 'drop') pv = { kind: 'drop', ...previewDrop(b, this.sel[0], sq) };
      } catch { pv = null; }
      if (pv) pv.next = pv.next.filter((s) => !isHidden(b, s));
      this.pvCache.set(key, pv);
    }
    return this.pvCache.get(key);
  }

  toggle(i) {
    const b = this.live();
    if (this.busy || !b || b.status !== 'play' || i >= b.hand.length) return;
    this.sel = this.sel.includes(i) ? this.sel.filter((x) => x !== i) : [...this.sel, i].sort((x, y) => x - y);
    this.targets = null;
    this.snd('pick');
  }

  clickSq(sq) {
    if (this.busy) { this.fast = true; return; }
    const b = this.live();
    if (!b) return;
    const t = this.clickable();
    if (t.list.includes(sq)) {
      if (this.app.touch && !this.noPreview && (t.kind === 'capture' || t.kind === 'drop') && this.tapSq !== sq) { this.tapSq = sq; this.snd('pick'); return; }
      this.tapSq = null;
      if (t.kind === 'capture') this.send({ type: 'capture', sq });
      else if (t.kind === 'redrop') this.send({ type: 'redrop', sq });
      else if (t.kind === 'drop') { const i = this.sel[0]; this.sel = []; this.send({ type: 'drop', handIndex: i, sq }); }
      return;
    }
    if (b.status === 'play' && this.sel.length) { this.sel = []; this.targets = null; }
    this.missSq(sq);
  }

  discard() {
    const b = this.live();
    if (this.busy || !b || b.status !== 'play' || !this.sel.length || b.discardsLeft <= 0 || !b.bag.length) return;
    const idx = this.sel;
    this.sel = [];
    this.send({ type: 'discard', handIndices: idx });
  }

  send(cmd) {
    const bRef = this.live();
    this.bRef = bRef;
    const v = this.view;
    const run = this.run;
    if (cmd.type === 'drop') this.slow = this.src.kind === 'lesson' || (!!run && !run.log.some((x) => !x.skipped) && bRef.history.length < 3);
    if (cmd.type === 'drop' && run) this.rec = { board: clone(bRef.board), drop: { sq: cmd.sq, piece: bRef.hand[cmd.handIndex].t }, caps: [], ante: run.ante };
    const events = this.src.cmd(cmd);
    if (run) this.record(events, run);
    const post = clone(bRef.board);
    for (const e of events) if (e.type === 'reinforce') post[e.sq] = null;
    if (cmd.type === 'drop') v.hand.splice(cmd.handIndex, 1);
    this.targets = null;
    this.play(events, post, cmd);
  }

  // 이번 판 최고 한 수를 다시 보기용으로 남긴다(결과 화면이 작은 판에 다시 둔다)
  record(events, run) {
    const r = this.rec;
    if (!r) return;
    for (const e of events) {
      if (e.type === 'capture') r.caps.push({ from: e.from, to: e.to, piece: e.piece, form: e.form, after: e.form });
      else if ((e.type === 'transform' || e.type === 'promote') && r.caps.length) r.caps[r.caps.length - 1].after = e.type === 'promote' ? 'Q' : e.to;
      else if (e.type === 'refill' || e.type === 'redrop') r.broken = true;
      else if (e.type === 'end') {
        if (!r.broken && (!run.bestReplay || e.score > run.bestReplay.score)) run.bestReplay = { ...r, score: e.score, reason: e.reason };
        this.rec = null;
      }
    }
  }

  // ── 사건 → 연출
  play(events, post, cmd) {
    const app = this.app, v = this.view, seq = this.seq;
    // 한 수의 연출이 쌓인 시간(moveT)이 1.3초를 넘으면 뒤 걸음을 줄여 간다: 한 수 연출이 4초(×1) 안에 들게.
    // 사슬 끝의 곱 · 외통은 줄이지 않는다(그 순간이 보상이라서).
    if (cmd && cmd.type === 'drop') { this.moveT = 0; this.matesInMove = 0; }
    const pace = () => { const T = this.moveT || 0; return T < 1.3 ? 1 : Math.max(0.01, (2.3 - T) / 1.0); };
    let label = '';
    const add = (dur, o = {}) => {
      const d = label === 'mate' && !this.matesInMove++ ? dur : dur * pace();
      this.moveT = (this.moveT || 0) + d;
      return seq.add({ dur: d, label, ...o });
    };
    // 같은 순간의 점수 사건(격언 · 기보 반응)은 한 걸음으로 묶는다
    const merged = [];
    for (const e of events) {
      const prev = merged[merged.length - 1];
      if (e.type === 'score' && prev && prev.type === 'scoreGroup') prev.list.push(e);
      else if (e.type === 'score') merged.push({ type: 'scoreGroup', list: [e] });
      else merged.push(e);
    }
    for (const e of merged) {
      label = e.type;
      switch (e.type) {
        case 'drop': add(0.14, {
          begin: () => {
            v.board[e.sq] = { t: e.piece, mine: true };
            v.chain = { sq: e.sq, form: e.piece, value: 0, mult: 0, steps: [e.piece], path: [e.sq], forced: null, awaiting: null, cut: false };
            v.dropIn = { sq: e.sq, p: 0 };
            this.snd('drop');
          },
          tick: (p) => { v.dropIn.p = p; },
          done: () => { v.dropIn = null; },
        }); break;
        case 'redrop': add(0.14, {
          begin: () => {
            v.board[e.sq] = { t: e.piece, mine: true };
            v.chain.sq = e.sq; v.chain.awaiting = null; v.chain.path.push(e.sq);
            v.dropIn = { sq: e.sq, p: 0 };
            this.snd('drop');
          },
          tick: (p) => { v.dropIn.p = p; },
          done: () => { v.dropIn = null; },
        }); break;
        case 'capture': add(moveDur(v.chain ? v.chain.form : 'N', e.from, e.to), {
          begin: () => {
            const c = v.chain;
            v.board[e.from] = null;
            v.mover = { from: e.from, to: e.to, form: c.form, p: 0 };
            c.forced = null;
          },
          tick: (p) => { v.mover.p = v.mover.form === 'N' ? p : ease.out(p); },
          done: () => {
            const c = v.chain;
            const victim = v.board[e.to];
            v.board[e.to] = { t: c.form, mine: true };
            v.mover = null;
            c.sq = e.to; c.path.push(e.to); c.steps.push(c.form);
            c.value += e.value; c.mult += 1;
            this.shatter(e.to, victim ? victim.t : e.piece, victim && victim.gold ? 'g' : 'b');
            this.flash(e.to, PAL.white);
            this.pop(`+${e.value}`, 'value');
            this.snd('capture', c.path.length - 1);
            this.shake(1, 0.08);
          },
        }); break;
        case 'golden': add(0.12, { begin: () => { this.burst(e.sq, PAL.gold, 20); this.dust(e.sq, 26); this.snd('golden'); this.shake(1, 0.1); } }); break;
        case 'scoreGroup': add(0.05 + 0.03 * Math.min(3, e.list.length), {
          begin: () => {
            const c = v.chain;
            if (!c) return;
            let dv = 0, dm = 0, xm = 1;
            for (const x of e.list) {
              if (x.value) { c.value += x.value; dv += x.value; }
              if (x.mult) { c.mult += x.mult; dm += x.mult; }
              if (x.xmult) { c.mult *= x.xmult; xm *= x.xmult; }
            }
            if (dv) this.pop(`+${short(dv)}`, 'value');
            if (dm) this.pop(`+${short(dm)}`, 'mult');
            if (xm !== 1) this.pop(`×${Number(xm.toFixed(2))}`, 'mult', dm ? 10 : 0);
            this.snd('tick', c.mult);
          },
        }); break;
        case 'money': if (e.src !== 'chest') add(0.05, { begin: () => { this.pop(`$${e.money}`, 'money'); this.snd('coin'); } }); break;
        case 'transform': add(this.bigFlip ? 0.4 : 0.1, {
          begin: () => { v.flip = { sq: e.sq, p: 0, from: e.from, to: e.to, big: this.bigFlip }; this.snd('transform'); this.formName(e.sq, e.to); if (this.bigFlip) { this.hitstop(0.2); this.shake(2, 0.15); } },
          tick: (p) => { v.flip.p = p; if (p >= 0.5 && v.chain) { v.chain.form = e.to; v.chain.steps[v.chain.steps.length - 1] = e.to; if (v.board[e.sq] && v.board[e.sq].mine) v.board[e.sq].t = e.to; } },
          done: () => { if (v.flip && v.flip.big) this.burst(e.sq, PAL.gold, 18); v.flip = null; this.sparkle(e.sq, PAL.silver, 6); },
        });
        // 모습이 바뀐 순간 한 박자 멈춘다(새 이름을 읽을 틈). 긴 사슬 뒤쪽에서는 다른 걸음처럼 줄어든다
        { const d = 0.25 * pace(); this.moveT = (this.moveT || 0) + d; seq.add({ dur: d, label: 'hold' }); } break;
        case 'promote': add(0.3, {
          begin: () => { v.lift = { sq: e.sq, p: 0 }; this.snd('promote'); },
          tick: (p) => { v.lift.p = p; if (p >= 0.5 && v.chain) { v.chain.form = 'Q'; v.chain.steps[v.chain.steps.length - 1] = 'Q'; if (v.board[e.sq]) v.board[e.sq].t = 'Q'; } },
          done: () => { v.lift = null; this.sparkle(e.sq, PAL.gold, 12); this.word('승급', PAL.gold); },
        }); break;
        case 'grade': add(0.2, { begin: () => this.gradeStamp(e) }); break;
        case 'forced': add(0.1, { begin: () => { if (v.chain) v.chain.forced = e.attackers.slice(); this.snd('forced'); } }); break;
        case 'cutIgnored': add(0.2, { begin: () => { this.sparkle(e.sq, PAL.silver, 10); this.word('넘겼다', PAL.silver); } }); break;
        case 'cut':
          add(0.15, { begin: () => { v.cut = { sq: e.sq, attackers: e.attackers, p: 0 }; if (v.chain) v.chain.cut = true; this.snd('cut'); this.hitstop(0.12); this.shake(2, 0.15); } });
          add(0.3, { tick: (p) => { v.cut.p = p; } });
          break;
        case 'mate': add(0.5, {
          begin: () => { this.topple(e.sq); this.word('외통', PAL.gold, 1.6, 4); this.snd('mate'); this.hitstop(0.25); this.shake(3, 0.3); },
        }); break;
        case 'refill': add(0.35, {
          begin: () => { this.word('판이 다시 채워진다', PAL.gold, 1.1, 1); this.snd('refill'); },
          done: () => { v.board = clone(post); if (v.chain) { v.chain.path = [e.sq]; } },
        }); break;
        case 'redropReady': add(0.15, {
          begin: () => { if (v.chain) { v.board[v.chain.sq] = null; v.chain.awaiting = e.squares.slice(); } this.word('다시 떨군다', PAL.gold, 1); },
        }); break;
        case 'end': this.endSteps(e); break;
        case 'overflow': add(0.08, {
          begin: () => {
            const big = { 1: 1, 2: 2, 5: 3, 10: 4 }[e.tier] || 1;
            if (this.src.kind !== 'lesson') this.word(e.tier === 1 ? '목표 달성' : `목표 ×${e.tier}`, e.tier >= 5 ? PAL.red : PAL.gold, 1 + big * 0.2, Math.min(3, big));
            this.ring = { t: 0, life: 0.5 + big * 0.15, col: e.tier >= 10 ? PAL.white : e.tier >= 5 ? PAL.red : PAL.gold };
            this.snd('overflow', e.tier); this.shake(big, 0.2 + big * 0.05);
          },
        }); break;
        case 'shatter': add(0.2, { begin: () => { this.toast(`유리 각인 ${josa(PIECE_NAME[e.piece], '이/가')} 깨졌다`, PAL.sky); this.snd('glass'); } }); break;
        // 증원은 위에서 떨어져 들어온다. 떨어지는 시간은 한 수 연출 길이에 넣지 않는다(update가 따로 센다)
        case 'reinforce': add(0.1, {
          begin: () => {
            v.board[e.sq] = post[e.sq] || { t: e.piece, id: -1 };
            if (this.app.reducedMotion) this.flash(e.sq, PAL.dim);
            else (this.falls || (this.falls = new Map())).set(e.sq, 0);
            this.snd('reinforce');
          },
        }); break;
        case 'regrip': add(0.45, {
          begin: () => { this.word('손을 새로 쥔다', PAL.gold, 1.2, 1); this.snd('discard'); },
          done: () => { const b = this.bRef; v.hand = clone(b.hand); v.bag = b.bag.length; },
        }); break;
        case 'discard': add(0.22, {
          begin: () => { this.snd('discard'); },
          done: () => { const b = this.bRef; v.hand = clone(b.hand); v.discardsLeft = b.discardsLeft; v.bag = b.bag.length; },
        }); break;
        case 'win': if (this.src.kind === 'lesson') break; add(0.25, { begin: () => { this.word('대국 승리', PAL.gold, 1.2, 2); this.snd('win'); } }); break;
        case 'lose': if (this.src.kind === 'lesson') break; add(0.6, { begin: () => { this.word(e.reason === 'stuck' ? '떨굴 곳이 없다' : '수가 다했다', PAL.red, 1.4, 1); this.snd('lose'); } }); break;
        case 'fragment': add(0.05, { begin: () => { this.toast(`${LEGEND_BY_ID[e.legend].name} · ${PART_NAME[e.part]}`, PAL.gold, 2.6); this.snd('fragment'); this.app.flyShard(BX + 112, BY + 112, RX + RW - 30, 10); } }); this.runEvents.push(e); break;
        default: this.runEvents.push(e);
      }
    }
    add(0, { done: () => this.afterSeq() });
  }

  endSteps(e) {
    const app = this.app, v = this.view;
    const add = (d, o) => { this.moveT = (this.moveT || 0) + d; return this.seq.add({ dur: d, label: 'end', ...o }); };
    add(0.25, {
      begin: () => {
        if (v.chain) { v.chain.value = e.value; v.chain.mult = e.mult; }
        v.gather = { p: 0, value: e.value, mult: e.mult, score: e.score };
        if (v.chain && v.board[v.chain.sq] && v.board[v.chain.sq].mine) v.board[v.chain.sq] = null;
        this.snd('gather');
      },
      tick: (p) => { v.gather.p = ease.in(p); },
    });
    add(0.2, {
      begin: () => {
        v.gather.burst = true; this.snd('boom', e.score); this.shake(e.score >= v.target ? 2 : 1, 0.12);
        const parts = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push({ x: LX + 56, y: 109, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50 }); }
        this.fx.add({
          life: 0.4, layer: 1, parts,
          update: (dt, f) => { for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; } },
          draw: (c, f) => { c.globalAlpha = 1 - f.t / f.life; for (const p of f.parts) rect(c, p.x, p.y, 2, 2, PAL.goldHi); c.globalAlpha = 1; },
        });
      },
    });
    const from = v.score;
    add(0.3, {
      begin: () => { v.count = { from, to: from + e.score, p: 0 }; this.snd('count'); },
      tick: (p) => { v.count.p = ease.out(p); },
      done: () => {
        v.score = from + e.score;
        v.count = null;
        this.lastEnd = { value: e.value, mult: e.mult, score: e.score, reason: e.reason, steps: v.chain ? v.chain.steps.slice() : [] };
        if (this.run && e.score > 0 && app.noteMove(e.score, this.lastEnd.steps) && app.records.runs + app.records.wins > 0) this.toast('최고 한 수', PAL.gold);
        v.gather = null;
        v.chain = null;
        v.cut = null;
        if (this.glow) this.glow.fading = true;
        if (this.bRef) { v.movesLeft = this.bRef.movesLeft; }
      },
    });
  }

  afterSeq() {
    this.fast = false;
    const app = this.app;
    if (this.src.after) { this.sync(); this.src.after(this); return; }
    if (app.run.phase === 'battle') { this.sync(); return; }
    // 대국이 끝났다: 막간(보상 · 상자 · 전설) 뒤 국면 화면으로
    const ev = this.runEvents;
    const list = [];
    const reward = ev.find((e) => e.type === 'reward');
    if (reward) list.push(['reward', { reward, events: ev }]);
    const chest = ev.find((e) => e.type === 'chest');
    if (chest) list.push(['chest', { chest }]);
    for (const e of ev) if (e.type === 'legend') list.push(['legend', { legend: e.legend }]);
    app.flow(list);
  }

  // ── 효과
  center(sq) { const p = sqXY(sq); return { x: p.x + 14, y: p.y + 14 }; }
  shatter(sq, type, side) {
    const { x, y } = sqXY(sq);
    const chips = spriteChips(type, side);
    const n = 14;
    let seed = sq * 97 + chips.length;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = [];
    for (let i = 0; i < n; i++) {
      const c = chips[Math.floor(rnd() * chips.length)];
      parts.push({ x: x + 6 + c.x, y: y + 3 + c.y, vx: (c.x - 8) * 6 + (rnd() - 0.5) * 30, vy: -40 - rnd() * 50, col: c.col, s: rnd() < 0.3 ? 2 : 1 });
    }
    this.fx.add({
      life: 0.7, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const p of e.parts) rect(ctx, p.x, p.y, p.s, p.s, p.col); ctx.globalAlpha = 1; },
    });
  }
  burst(sq, col, n) {
    const { x, y } = this.center(sq);
    const parts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; parts.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 }); }
    this.fx.add({
      life: 0.5, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } },
      draw: (ctx, e) => { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life); for (const p of e.parts) rect(ctx, p.x, p.y, 2, 2, col); ctx.globalAlpha = 1; },
    });
  }
  sparkle(sq, col, n) {
    const { x, y } = sqXY(sq);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: x + 3 + ((i * 7 + sq * 3) % 22), y: y + 2 + ((i * 11 + sq) % 22) });
    this.fx.add({
      life: 0.35, layer: 1,
      draw: (ctx, e) => { const k = e.t / e.life; ctx.globalAlpha = 1 - k; for (const p of pts) { rect(ctx, p.x, p.y - k * 6, 1, 1, col); rect(ctx, p.x - 1, p.y - k * 6, 3, 1, col); } ctx.globalAlpha = 1; },
    });
  }
  flash(sq, col) {
    const { x, y } = sqXY(sq);
    this.fx.add({ life: 0.15, layer: 1, draw: (ctx, e) => { ctx.globalAlpha = 0.6 * (1 - e.t / e.life); rect(ctx, x, y, S, S, col); ctx.globalAlpha = 1; } });
  }
  pop(s, where, dy = 0) {
    if (this.boardOnly) return;
    const pos = where === 'value' ? { x: LX + 24, y: 96 - dy } : where === 'mult' ? { x: LX + 88, y: 96 - dy } : { x: LX + LW - 20, y: 210 };
    const col = where === 'value' ? PAL.val : where === 'mult' ? PAL.gold : PAL.gold;
    this.fx.add({ life: 0.6, layer: 1, draw: (ctx, e) => { const k = e.t / e.life; text(ctx, s, pos.x, pos.y - 6 - k * 10, col, { align: 'center', bold: true, alpha: 1 - k * k, shadow: PAL.shadow }); } });
  }
  word(s, col, life = 1, scale = 2) {
    this.fx.add({
      life, layer: 1, word: true,
      draw: (ctx, e) => {
        const k = e.t / e.life;
        const sc = k < 0.1 ? scale + 1 : scale;
        text(ctx, s, BX + 112, BY + 100 - (sc * 6), col, { align: 'center', bold: true, scale: sc, shadow: PAL.shadow, alpha: k > 0.7 ? (1 - k) / 0.3 : 1 });
      },
    });
  }
  // 모습이 바뀐 칸 위로 새 모습 이름이 떠오르며 사라진다(「룩!」)
  formName(sq, t) {
    const c = this.center(sq);
    const s = `${PIECE_NAME[t]}!`;
    this.fx.add({
      life: 0.9, layer: 1,
      draw: (ctx, e) => {
        const k = e.t / e.life;
        const w = measure(s, true) * 2 + 10, h = 27;
        const rise = Math.round(ease.out(Math.min(1, k * 1.6)) * 6);
        const above = c.y - 14 - h - 2 >= BY;
        const y = above ? c.y - 14 - h - rise : c.y + 14 + 2 + rise;
        const x = Math.round(Math.max(BX + 2, Math.min(BX + S * 8 - w - 2, c.x - w / 2)));
        ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        box(ctx, x, y, w, h, PAL.feltDk, PAL.gold);
        text(ctx, s, x + w / 2, y + 2, PAL.gold, { align: 'center', bold: true, scale: 2 });
        ctx.globalAlpha = 1;
      },
    });
  }
  // 먹힌 킹이 천천히 쓰러진다
  topple(sq) {
    const { x, y } = sqXY(sq);
    this.fx.add({
      life: 1.0, layer: 1,
      draw: (ctx, e) => {
        const k = Math.min(1, e.t / 0.55);
        const ang = (k * k) * Math.PI / 2;
        ctx.save();
        ctx.globalAlpha = e.t < 0.7 ? 1 : Math.max(0, 1 - (e.t - 0.7) / 0.3);
        ctx.translate(x + 6 + 14, y + 3 + 21);
        ctx.rotate(ang);
        ctx.drawImage(spriteCanvas('K', 'b'), -14, -21);
        ctx.restore();
      },
    });
  }
  // 금가루: 위로 튀었다가 천천히 내려앉는 점
  dust(sq, n) {
    const { x, y } = this.center(sq);
    let seed = sq * 31 + 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = [];
    for (let i = 0; i < n; i++) parts.push({ x: x + (rnd() - 0.5) * 20, y: y + (rnd() - 0.5) * 10, vx: (rnd() - 0.5) * 60, vy: -30 - rnd() * 70, c: rnd() < 0.3 ? PAL.goldHi : PAL.gold });
    this.fx.add({
      life: 1.1, layer: 1, parts,
      update: (dt, e) => { for (const p of e.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.97; } },
      draw: (ctx, e) => { for (const p of e.parts) { ctx.globalAlpha = Math.max(0, 1 - e.t / e.life) * (Math.floor(e.t * 20 + p.x) % 3 ? 1 : 0.4); rect(ctx, p.x, p.y, 1, 1, p.c); } ctx.globalAlpha = 1; },
    });
  }
  // 점수 칸의 불꽃: 목표를 넘기면 붙고, 넘친 층(×2 · ×5 · ×10)마다 세진다
  updateFlames(dt) {
    const v = this.view;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const tier = v.target ? overflowTier(score, v.target) : 0;
    this.flames = (this.flames || []).filter((f) => (f.t += dt) < f.life);
    if (!tier || this.app.reducedMotion) return;
    const rate = { 1: 20, 2: 40, 5: 70, 10: 110 }[tier];
    this.flameAcc = (this.flameAcc || 0) + dt * rate;
    while (this.flameAcc >= 1) {
      this.flameAcc -= 1;
      const r = Math.random();
      this.flames.push({ x: LX + 4 + Math.random() * (LW - 8), y: 70, vy: -(18 + Math.random() * (14 + tier * 3)), t: 0, life: 0.4 + r * 0.5, tier });
    }
  }
  drawFlames(ctx) {
    for (const f of this.flames || []) {
      const k = f.t / f.life;
      const col = f.tier >= 10 && k < 0.3 ? PAL.white : k < 0.35 ? PAL.goldHi : k < 0.7 ? PAL.gold : PAL.red;
      ctx.globalAlpha = 1 - k * 0.6;
      const s = k < 0.4 ? (f.tier >= 5 ? 3 : 2) : 1;
      rect(ctx, f.x + Math.sin((f.t + f.x) * 12) * 1.5, f.y + f.vy * f.t, s, s + (k < 0.3 ? 1 : 0), col);
    }
    ctx.globalAlpha = 1;
  }

  gradeStamp(e) {
    const cols = { '!': PAL.white, '!!': PAL.gold, '!!!': PAL.red, '∞': null };
    this.stamp = { mark: e.mark, t: 0, life: 1.1, col: cols[e.mark] };
    this.glow = { mark: e.mark, fade: 0 };
    this.snd('grade', e.mark);
    this.shake({ '!': 1, '!!': 2, '!!!': 3, '∞': 4 }[e.mark] || 1, 0.25);
  }

  pointerDown() { this.idleT = 0; }
  update(dt) {
    this.idleT = (this.idleT || 0) + dt;
    // 판 전체의 처음 세 사슬과 첫 수업은 연출 속도 설정과 상관없이 ×1(눈이 규칙을 따라잡을 때까지)
    const sp = (this.slow ? 1 : this.app.speed()) * (this.fast ? 5 : 1);
    this.seq.update(dt * sp);
    if (this.falls) for (const [sq, t] of this.falls) {
      const nt = t + dt * sp;
      if (nt >= FALL) { this.falls.delete(sq); this.flash(sq, PAL.dim); } else this.falls.set(sq, nt);
    }
    if (this.glow && this.glow.fading) { this.glow.fade += dt * this.app.speed(); if (this.glow.fade > 0.6) this.glow = null; }
    if (this.ring) { this.ring.t += dt * this.app.speed(); if (this.ring.t > this.ring.life) this.ring = null; }
    this.updateFlames(dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.stamp) { this.stamp.t += dt * this.app.speed(); if (this.stamp.t > this.stamp.life) this.stamp = null; }
  }

  // ── 그리기
  draw(ctx, ui) {
    this.drawBoard(ctx, ui);
    this.drawLeft(ctx, ui);
    this.drawRight(ctx, ui);
    this.drawOver(ctx);
  }

  // 목표는 막대로: 지금 점수는 채움, 이번 사슬로 얻을 몫(값 × 연쇄)은 빗금으로 미리 차오른다.
  // 목표를 넘기면 막대가 ×2 · ×5 · ×10 눈금으로 늘어나고 채움 끝에 불이 붙는다.
  drawGoalBar(ctx) {
    const v = this.view, tgt = v.target;
    if (!tgt || this.boardOnly) return;
    const time = this.app.time;
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const live = v.chain && !v.gather ? Math.floor(v.chain.value * v.chain.mult) : v.gather && !v.count ? v.gather.score : 0;
    const total = score + live;
    const maxMul = total <= tgt ? 1 : total <= 2 * tgt ? 2 : total <= 5 * tgt ? 5 : 10;
    const maxV = tgt * maxMul;
    const X = BX, Y = 14, Wd = S * 8, Hh = 7;
    box(ctx, X - 1, Y - 1, Wd + 2, Hh + 2, PAL.feltDk, PAL.frameDk);
    const fill = Math.round(Wd * Math.min(1, score / maxV));
    const hot = score >= tgt;
    rect(ctx, X, Y, fill, Hh, hot ? PAL.gold : PAL.goldDk);
    if (fill > 1) rect(ctx, X, Y, fill, 1, PAL.goldHi);
    const gw = Math.round(Wd * Math.min(1, total / maxV)) - fill;
    if (gw > 0) {
      ctx.fillStyle = PAL.gold;
      for (let i = 0; i < gw; i++) for (let j = 0; j < Hh; j++) if ((i + j + Math.floor(time * 8)) % 3 === 0) ctx.fillRect(X + fill + i, Y + j, 1, 1);
      if (!this.hideGain) text(ctx, `+${num(live)}`, Math.min(X + Wd - 20, X + fill + gw / 2), 0, PAL.gold, { align: 'center', bold: true, shadow: PAL.shadow });
    }
    // 눈금: 목표(×1)는 흰 막대, 넘친 층은 작은 숫자
    for (const m of [1, 2, 5, 10]) {
      if (m > maxMul) break;
      const tx = X + Math.round((Wd * m) / maxV * tgt) - 1;
      rect(ctx, tx, Y - 3, 2, Hh + 6, m === 1 ? PAL.white : PAL.red);
      if (m > 1) { rect(ctx, tx - 7, Y - 8, 1, 1, PAL.red); rect(ctx, tx - 5, Y - 6, 1, 1, PAL.red); rect(ctx, tx - 6, Y - 7, 1, 1, PAL.red); rect(ctx, tx - 7, Y - 6, 1, 1, PAL.red); rect(ctx, tx - 5, Y - 8, 1, 1, PAL.red); digits(ctx, m, tx - 3, Y - 9, PAL.red); }
    }
    // 불: 목표를 넘기면 채움 끝에서 불꽃이 인다
    if (hot && !this.app.reducedMotion) {
      const ex = X + fill;
      for (let i = 0; i < 6; i++) {
        const k = (time * 3 + i / 6) % 1;
        rect(ctx, ex - 4 + ((i * 5) % 9) - Math.round(Math.sin(time * 9 + i) * 1.5), Y - 1 - Math.round(k * 9), k < 0.4 ? 2 : 1, k < 0.4 ? 2 : 1, k < 0.3 ? PAL.goldHi : k < 0.6 ? PAL.gold : PAL.red);
      }
    }
  }

  drawBoard(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, time = app.time;
    this.drawGoalBar(ctx);
    box(ctx, BX - 6, BY - 6, S * 8 + 12, S * 8 + 12, PAL.frame, PAL.frameDk);
    rect(ctx, BX - 5, BY - 5, S * 8 + 10, 1, PAL.frameHi);
    // 사슬 평가의 테두리 불빛: 흰 → 금 → 붉은 금 → 무지개. 사슬이 끝나면 사그라든다
    if (this.glow) {
      const g = this.glow;
      const a = Math.max(0, 1 - g.fade / 0.6) * (0.75 + 0.25 * Math.sin(time * 10));
      const hue = Math.floor(time * 360) % 360;
      const cols = { '!': [PAL.white], '!!': [PAL.gold, PAL.goldHi], '!!!': [PAL.red, PAL.gold, PAL.red], '∞': [`hsl(${hue},85%,60%)`, `hsl(${(hue + 90) % 360},85%,60%)`, `hsl(${(hue + 180) % 360},85%,60%)`] }[g.mark];
      ctx.globalAlpha = a;
      cols.forEach((c, i) => frame(ctx, BX - 6 + i, BY - 6 + i, S * 8 + 12 - i * 2, S * 8 + 12 - i * 2, c, 1));
      ctx.globalAlpha = 1;
    }
    if (this.ring) {
      const k = this.ring.t / this.ring.life;
      ctx.globalAlpha = Math.max(0, 1 - k);
      const o = Math.round(k * 10);
      frame(ctx, BX - 6 - o, BY - 6 - o, S * 8 + 12 + o * 2, S * 8 + 12 + o * 2, this.ring.col, 2);
      ctx.globalAlpha = 1;
    }
    const t = this.clickable();
    const tset = new Set(t.list);
    const forced = v.chain && v.chain.forced ? new Set(v.chain.forced) : null;
    const openKings = b.hints && b.hints.openKings ? new Set(b.hints.openKings) : null;
    // 증원 그림자: 이번 수 뒤(k 0) · 그다음 수 뒤(k 1)
    const ghosts = new Map();
    visibleIncoming(b).forEach((wave, k) => { for (const r of wave || []) if (!v.board[r.sq] && !isHidden(b, r.sq) && !ghosts.has(r.sq)) ghosts.set(r.sq, { t: r.t, k }); });
    for (let sq = 0; sq < 64; sq++) {
      const { x, y } = sqXY(sq);
      const f = sq & 7, r = sq >> 3;
      rect(ctx, x, y, S, S, (r + f) % 2 ? PAL.light : PAL.dark);
      if (isHidden(b, sq)) {
        rect(ctx, x, y, S, S, PAL.fog);
        for (let k = 0; k < S; k += 4) rect(ctx, x + ((k + (r * 2)) % S), y + k, 2, 1, PAL.fogHi);
      }
      const id = `sq:${sq}`;
      const g = ghosts.get(sq);
      const tipOpt = g ? sqTip(x, y, `증원 · ${PIECE_NAME[g.t]}`, g.k ? '두 수 뒤에 들어온다' : '이번 수 뒤에 들어온다') : null;
      ui.region(id, x, y, S, S, { onClick: () => this.clickSq(sq), ...tipOpt });
      if (tset.has(sq) && t.kind !== 'capture') {
        const pulse = 0.22 + 0.12 * Math.sin(time * 5);
        ctx.globalAlpha = pulse; rect(ctx, x, y, S, S, PAL.gold); ctx.globalAlpha = 1;
        frame(ctx, x + 1, y + 1, S - 2, S - 2, PAL.goldHi);
      }
      if (ui.isHover(id) && tset.has(sq)) frame(ctx, x, y, S, S, PAL.white);
    }
    // 증원 그림자: 점선 테 안에 빈 윤곽(속이 비어 판 위의 적과 섞이지 않는다)과 흔들리는 ▼. 두 수 앞은 윤곽도 점선
    for (const [sq, g] of ghosts) {
      const { x, y } = sqXY(sq);
      dots(ctx, x, y, S, S, g.k ? PAL.dimDk : PAL.shadow, 2);
      ctx.drawImage(outlineCanvas(g.t, TONE.b.o, g.k > 0), x + 5, y + 5);
      const bob = Math.floor(time * 3 + sq * 0.37) % 2;
      ctx.globalAlpha = g.k ? 0.5 : 1;
      dropMark(ctx, x + 12, y + 1 + bob, TONE.b.o);
      ctx.globalAlpha = 1;
    }
    // 사슬 길
    if (v.chain) {
      const path = v.chain.path;
      for (let i = 0; i + 1 < path.length; i++) {
        const a = this.center(path[i]), c = this.center(path[i + 1]);
        line(ctx, a.x, a.y, c.x, c.y, PAL.gold);
      }
      for (let i = 1; i < path.length; i++) {
        const { x, y } = sqXY(path[i]);
        frame(ctx, x, y, S, S, PAL.gold);
      }
    }
    // 지금 모습의 행마선: 다음 먹기를 기다릴 때 갈 수 있는 칸을 흐리게(막히면 끊긴다)
    if (v.chain && !this.busy && !v.chain.awaiting && !v.cut && b.status === 'chain') this.drawReach(ctx, v.chain.form, v.chain.sq);
    // 기물
    for (let sq = 0; sq < 64; sq++) {
      const c = v.board[sq];
      if (!c) continue;
      if (isHidden(b, sq) && !c.mine) continue;
      const { x, y } = sqXY(sq);
      if (c.mine) {
        if (v.mover) continue;
        let sx = 1, dy = 0, side = 'w';
        if (v.flip && v.flip.sq === sq) { sx = Math.abs(1 - 2 * v.flip.p); side = 's'; }
        if (v.dropIn && v.dropIn.sq === sq) dy = -Math.round((1 - v.dropIn.p) * 10);
        if (v.lift && v.lift.sq === sq) { dy = -Math.round(Math.sin(v.lift.p * Math.PI) * 8); side = 'q'; }
        let alpha = 1;
        if (v.cut && v.cut.sq === sq) alpha = 1 - v.cut.p;
        sprite(ctx, c.t, side, x + 6, y + 3 + dy, { sx, alpha });
        continue;
      }
      let dy = 0;
      if (t.kind === 'capture' && tset.has(sq)) dy = Math.floor(time * 4 + sq * 0.37) % 2 ? -2 : -1;
      if (this.falls && this.falls.has(sq)) { const p = this.falls.get(sq) / FALL; dy -= Math.round((1 - p * p) * FALL_PX); }
      if (openKings && openKings.has(sq) && c.t === 'K') {
        const a = 0.5 + 0.3 * Math.sin(time * 4);
        ctx.globalAlpha = a; frame(ctx, x + 2, y + 2, S - 4, S - 4, PAL.gold); ctx.globalAlpha = 1;
      }
      if (forced && forced.has(sq)) {
        if (Math.floor(time * 6) % 2 === 0) frame(ctx, x, y, S, S, PAL.red, 2);
        ctx.globalAlpha = 0.25; rect(ctx, x, y, S, S, PAL.red); ctx.globalAlpha = 1;
        hatch(ctx, x, y, PAL.redDk);
      }
      sprite(ctx, c.t, c.gold ? 'g' : 'b', x + 6, y + 3 + dy);
      if (c.gold) {
        const k = Math.floor(time * 8 + sq) % 12;
        if (k < 3) rect(ctx, x + 8 + k * 4, y + 4 + k * 3, 1, 1, PAL.goldHi);
      }
      if (t.kind === 'capture' && tset.has(sq) && ui.isHover(`sq:${sq}`)) frame(ctx, x, y, S, S, PAL.white);
    }
    // 움직이는 내 기물
    if (v.mover) {
      const m = moverXY(v.mover.form, v.mover.from, v.mover.to, v.mover.p);
      sprite(ctx, v.mover.form, 'w', m.x + 6, m.y + 3);
    }
    this.drawPreview(ctx, ui);
    // 끊김: 노린 적에서 붉은 선 · 금
    if (v.cut) {
      const c = this.center(v.cut.sq);
      for (const s of v.cut.attackers) { const a = this.center(s); line(ctx, a.x, a.y, c.x, c.y, PAL.red); }
      const { x, y } = sqXY(v.cut.sq);
      line(ctx, x + 4, y + 3, x + 12, y + 12, PAL.red); line(ctx, x + 12, y + 12, x + 9, y + 18, PAL.red); line(ctx, x + 9, y + 18, x + 22, y + 26, PAL.red);
      frame(ctx, x, y, S, S, PAL.red, 2);
      hatch(ctx, x, y, PAL.red);
    }
    // 응수 칸
    if (v.chain && v.chain.forced && !v.cut) {
      const { x, y } = sqXY(v.chain.sq);
      if (Math.floor(time * 6) % 2 === 0) frame(ctx, x, y, S, S, PAL.red, 2);
    }
  }

  drawReach(ctx, form, from) {
    const v = this.view, o = this.center(from);
    const slide = form === 'R' || form === 'B' || form === 'Q';
    ctx.globalAlpha = 0.4;
    for (const s of reach(v.board, form, from, 1)) {
      const c = this.center(s);
      if (slide) dotLine(ctx, o.x, o.y, c.x, c.y, PAL.goldHi, 2);
      if (!v.board[s]) { if (slide) rect(ctx, c.x - 1, c.y - 1, 2, 2, PAL.goldHi); else frame(ctx, c.x - 3, c.y - 3, 6, 6, PAL.goldHi); }
    }
    ctx.globalAlpha = 1;
  }

  // 먹기 전에 「그것」이 보인다: 겨눈 적 칸에 바뀐 모습, 다음에 먹을 적에 고리(응수면 붉은 빗금), 끊기면 붉은 금
  drawPreview(ctx, ui) {
    const v = this.view;
    const aim = this.busy ? null : this.aimSq(ui);
    const pv = aim != null ? this.preview(aim) : null;
    this.pvNow = pv;
    if (!pv) return;
    const time = this.app.time;
    const T = sqXY(pv.sq), tc = this.center(pv.sq);
    if (pv.kind === 'capture' && v.chain) {
      const fc = this.center(v.chain.sq);
      dotLine(ctx, fc.x, fc.y, tc.x, tc.y, PAL.goldHi);
      frame(ctx, T.x, T.y, S, S, PAL.gold);
      sprite(ctx, pv.form, 'w', T.x + 6, T.y + 2, { alpha: 0.62 + 0.12 * Math.sin(time * 6) });
      if (pv.cut) {
        for (const s of pv.cut) { const a = this.center(s); dotLine(ctx, a.x, a.y, tc.x, tc.y, PAL.red, 2); const A = sqXY(s); ringAt(ctx, A.x, A.y, PAL.red, 2); }
        line(ctx, T.x + 5, T.y + 5, T.x + 22, T.y + 22, PAL.red); line(ctx, T.x + 22, T.y + 5, T.x + 5, T.y + 22, PAL.red);
        return;
      }
    } else if (pv.kind === 'drop') {
      sprite(ctx, pv.form, 'w', T.x + 6, T.y + 3, { alpha: 0.5 });
    }
    for (const s of pv.next) {
      const A = sqXY(s), c = this.center(s);
      const reply = pv.forced && pv.forced.includes(s);
      dotLine(ctx, tc.x, tc.y, c.x, c.y, reply ? PAL.red : PAL.gold);
      if (reply) { ctx.globalAlpha = 0.6; hatch(ctx, A.x, A.y, PAL.red); ctx.globalAlpha = 1; }
      ringAt(ctx, A.x, A.y, reply ? PAL.red : PAL.gold, 2);
    }
  }

  // 오른쪽 작은 패널: 지금 [모습] › 먹으면 [모습], 얻을 값 · 연쇄, 그다음
  drawPreviewPanel(ctx) {
    const pv = this.pvNow, v = this.view;
    if (!pv || pv.kind !== 'capture' || !v.chain) return;
    panel(ctx, RX, 22, RW, 88);
    text(ctx, '지금', RX + 21, 26, PAL.dim, { align: 'center' });
    text(ctx, '먹으면', RX + 77, 26, PAL.dim, { align: 'center' });
    box(ctx, RX + 8, 40, 26, 34, PAL.light, PAL.frameDk);
    sprite(ctx, v.chain.form, 'w', RX + 13, 46);
    text(ctx, '›', RX + 49, 49, PAL.gold, { align: 'center', bold: true, scale: 2 });
    box(ctx, RX + 64, 40, 26, 34, pv.cut ? PAL.red : PAL.gold, PAL.frameDk);
    sprite(ctx, pv.form, 'w', RX + 69, 46);
    text(ctx, `+${short(pv.value)}`, RX + 8, 88, PAL.val, { bold: true });
    text(ctx, `연쇄 +${short(pv.mult)}`, RX + RW - 8, 88, PAL.gold, { align: 'right', bold: true });
    panel(ctx, RX, 114, RW, 22);
    const [msg, col] = pv.cut ? ['되잡힌다', PAL.red] : pv.mate ? ['외통', PAL.gold] : pv.redrop ? ['다시 떨군다', PAL.gold]
      : pv.done ? ['사슬이 끝난다', PAL.dim] : pv.forced ? [`응수 ${pv.next.length}`, PAL.red] : [`다음에 먹을 적 ${pv.next.length}`, PAL.gold];
    text(ctx, msg, RX + 8, 119, col, { bold: true });
  }

  drawLeft(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    const master = b.mods.find((s) => MASTER_BY_ID[s.id]);
    panel(ctx, LX, 8, LW, 58);
    text(ctx, `${b.ante}관 · ${KIND_SHORT[b.kind]} 대국`, LX + 6, 12, PAL.dim);
    text(ctx, '목표', LX + 6, 27, PAL.dim);
    text(ctx, num(v.target), LX + LW - 6, 27, PAL.ink, { align: 'right', bold: true });
    if (master) {
      const m = MASTER_BY_ID[master.id];
      ui.region('master', LX + 2, 40, LW - 4, 16, { tip: () => tipLines(`명인 ${m.name}`, m.text) });
      text(ctx, `명인 ${m.name}`, LX + 6, 42, PAL.red, { bold: true });
    } else text(ctx, `이기면 $${REWARD.base[b.kind]}`, LX + 6, 42, PAL.goldDk);
    // 점수(목표를 넘기면 불붙는다)
    const score = v.count ? lerp(v.count.from, v.count.to, v.count.p) : v.score;
    const hot = v.target && score >= v.target;
    panel(ctx, LX, 70, LW, 24);
    if (hot) {
      const k = Math.floor(app.time * 10) % 3;
      frame(ctx, LX, 70, LW, 24, k ? PAL.gold : PAL.red);
    }
    this.drawFlames(ctx);
    text(ctx, '점수', LX + 6, 75, PAL.dim);
    text(ctx, num(score), LX + LW - 6, 75, hot ? PAL.gold : PAL.ink, { align: 'right', bold: true });
    // 값 × 연쇄
    const c = v.chain;
    const g = v.gather;
    const val = g ? g.value : c ? c.value : 0;
    const mul = g ? g.mult : c ? c.mult : 0;
    const gp = g ? g.p : 0;
    const dx = Math.round(gp * 32);
    if (v.count) {
      // 곱이 점수 칸으로 흘러 들어간다
      const k = v.count.p;
      const tx = lerp(LX + LW / 2, LX + LW - 30, k), ty = lerp(103, 75, k);
      text(ctx, num(v.count.to - v.count.from), tx, ty, PAL.gold, { align: 'center', bold: true, alpha: 1 - k * 0.8, shadow: PAL.shadow });
    }
    if (g && g.burst) {
      box(ctx, LX, 98, LW, 22, PAL.gold, PAL.frameDk);
      text(ctx, num(g.score), LX + LW / 2, 103, PAL.linkInk, { align: 'center', bold: true });
    } else {
      box(ctx, LX + dx, 98, 48, 22, PAL.val, PAL.frameDk);
      text(ctx, short(val), LX + dx + 24, 103, PAL.valInk, { align: 'center', bold: true });
      if (!g) text(ctx, '×', LX + 56, 103, PAL.ink, { align: 'center', bold: true });
      box(ctx, LX + 64 - dx, 98, 48, 22, PAL.link, PAL.frameDk);
      text(ctx, short(mul), LX + 88 - dx, 103, PAL.linkInk, { align: 'center', bold: true });
    }
    // 사슬 모습 줄
    // 지나온 모습은 작게, 지금 모습은 크게(2배)
    panel(ctx, LX, 124, LW, 52);
    const steps = c ? c.steps : this.lastEnd ? this.lastEnd.steps : [];
    const a = c ? 1 : 0.45;
    const past = steps.slice(Math.max(0, steps.length - 4), -1);
    past.forEach((tp, i) => sprite(ctx, tp, 'w', LX + 5 + i * 19, 148, { alpha: a }));
    if (steps.length > 4) text(ctx, `+${steps.length - 4}`, LX + 5, 127, PAL.dim);
    const cur = steps[steps.length - 1];
    if (cur) {
      if (c && c.cut) { ctx.globalAlpha = 0.35; rect(ctx, LX + LW - 40, 126, 36, 48, PAL.red); ctx.globalAlpha = 1; }
      ctx.globalAlpha = a;
      ctx.drawImage(spriteCanvas(cur, 'w'), LX + LW - 38, 128, 32, 44);
      ctx.globalAlpha = 1;
    }
    // 수 · 무르기
    panel(ctx, LX, 180, LW, 28);
    text(ctx, '수', LX + 6, 181, PAL.dim);
    for (let i = 0; i < v.moves; i++) rect(ctx, LX + 52 + i * 14, 184, 10, 7, i < v.movesLeft ? PAL.gold : PAL.frame);
    text(ctx, '무르기', LX + 6, 194, PAL.dim);
    for (let i = 0; i < v.discards; i++) rect(ctx, LX + 52 + i * 14, 197, 10, 7, i < v.discardsLeft ? PAL.red : PAL.frame);
    if (run) {
      panel(ctx, LX, 212, LW, 22);
      text(ctx, '상금', LX + 6, 217, PAL.dim);
      text(ctx, `$${run.money}`, LX + LW - 6, 217, PAL.gold, { align: 'right', bold: true });
    }
    panel(ctx, LX, 240, LW, 22);
    ui.region('bag', LX, 240, LW, 22, { tip: () => bagTip(this.b) });
    text(ctx, '주머니', LX + 6, 245, PAL.dim);
    text(ctx, `${v.bag} / ${v.deckSize}`, LX + LW - 6, 245, PAL.ink, { align: 'right' });
  }

  drawRight(ctx, ui) {
    const app = this.app, v = this.view, b = this.b, run = this.run;
    pauseButton(ctx, ui, app, RX + RW - 12, 6);
    if (run) {
      text(ctx, `격언 ${maximCount(run)}/${maximCapacity(run)}`, RX, 8, PAL.dim);
      fragmentStrip(ctx, ui, run, RX + RW - 18, 8, { align: 'right' });
      const off = b.mods.filter((s) => s.off && s.uid != null).map((s) => s.uid);
      maximColumn(ctx, ui, run, RX, 22, RW, 180, { offUids: off });
    }
    this.drawPreviewPanel(ctx);
    // 손
    text(ctx, '손', RX, 206, PAL.dim);
    const live = this.live();
    const canDiscard = !this.busy && live && live.status === 'play' && this.sel.length > 0 && live.discardsLeft > 0 && live.bag.length > 0;
    button(ctx, ui, 'btn:discard', RX + RW - 62, 203, 62, 16, '무르기', { enabled: !!canDiscard, onClick: () => this.discard(), icon: discardIcon, tone: canDiscard ? 'red' : 'plain' });
    const n = Math.max(1, v.hand.length);
    const w = Math.min(26, Math.floor((RW - (n - 1) * 3) / n));
    const gap = n > 1 ? Math.floor((RW - w * n) / (n - 1)) : 0;
    v.hand.forEach((p, i) => {
      const x = RX + i * (w + Math.min(gap, 4)), y = 224;
      const id = `hand:${i}`;
      const selected = this.sel.includes(i);
      ui.region(id, x, y - 4, w, 40, { onClick: () => this.toggle(i), tip: p.eng ? () => pieceTip(p) : null });
      const hov = ui.isHover(id);
      const usable = live && live.status === 'play' && !this.busy;
      // 한동안 아무것도 들지 않으면 손이 차례로 살짝 들썩인다(누를 곳이 손이라는 것을 글 없이)
      const nudge = usable && !this.sel.length && this.idleT > 2.5 && Math.floor(app.time * 3) % v.hand.length === i ? 2 : 0;
      pieceCard(ctx, p, x, y, w, 36, { lift: selected ? 4 : hov && usable ? 1 : nudge, selected, hover: hov || nudge > 0, dim: !usable });
    });
  }

  drawOver(ctx) {
    if (this.banner) {
      const bn = this.banner;
      const a = Math.min(1, bn.t * 6, (bn.life - bn.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      const bh = bn.master ? 86 : 44, by = BY + 106 - bh / 2;
      rect(ctx, BX - 6, by, S * 8 + 12, bh, PAL.shadow);
      ctx.globalAlpha = Math.max(0, a);
      if (bn.master) {
        // 초상이 오른쪽에서 미끄러져 들어온다(64×64)
        const k = Math.min(1, bn.t / 0.35);
        const px = Math.round(BX + 150 + (1 - k * k * (3 - 2 * k)) * 90);
        drawPortrait(ctx, bn.master, px, by + 6, 2);
        rect(ctx, BX - 6, by, S * 8 + 12, 1, PAL.red); rect(ctx, BX - 6, by + bh - 1, S * 8 + 12, 1, PAL.red);
        text(ctx, bn.title, BX + 4, by + 14, bn.col, { bold: true, scale: 2 });
        wrap(bn.sub, 140).slice(0, 3).forEach((l, i) => text(ctx, l, BX + 4, by + 42 + i * 12, PAL.ink));
      } else {
        text(ctx, bn.title, BX + 112, by + 6, bn.col, { align: 'center', bold: true, scale: 2 });
        text(ctx, bn.sub, BX + 112, by + 30, PAL.ink, { align: 'center' });
      }
      ctx.globalAlpha = 1;
    }
    if (this.stamp) {
      const st = this.stamp;
      const k = st.t / st.life;
      const sc = k < 0.08 ? 7 : 5;
      const col = st.col || `hsl(${Math.floor(this.app.time * 400) % 360},90%,65%)`;
      text(ctx, st.mark, BX + 200, BY + 4, col, { align: 'right', bold: true, scale: sc, shadow: PAL.shadow, alpha: k > 0.75 ? (1 - k) / 0.25 : 1 });
    }
  }

  key(k) {
    const b = this.live();
    this.idleT = 0;
    if (k === 'Escape') {
      if (this.sel.length) { this.sel = []; this.targets = null; return; }
      this.app.openOverlay('pause');
      return;
    }
    if (this.busy) { this.fast = true; return; }
    if (/^[1-5]$/.test(k)) this.toggle(Number(k) - 1);
    else if (k === ' ') this.discard();
    else if (/^Arrow/.test(k)) {
      // 화살표: 누를 수 있는 칸(먹을 적 · 떨굴 칸)을 차례로 겨눈다(미리 보기가 따라온다)
      const t = this.clickable();
      if (t.list.length) this.kbIdx = (this.kbIdx ?? -1) + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1);
    } else if (k === 'Enter' && b) {
      const t = this.clickable();
      if (this.kbIdx != null && t.list.length) this.clickSq(t.list[((this.kbIdx % t.list.length) + t.list.length) % t.list.length]);
      else if (b.status === 'chain' && t.list.length === 1) this.clickSq(t.list[0]);
    }
  }
}
