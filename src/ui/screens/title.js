// 타이틀: 큰 도트 글자, 새 판 · 이어 하기 · 첫 수업 · 설정. 뒤로 흐린 판에서 풀이기가 실제 규칙 · 실제 연출로 사슬을 계속 둔다(소리 없음).
import { PAL } from '../../render/palette.js';
import { W, H, text, rect } from '../../render/gfx.js';
import { button } from '../ui.js';
import { createBattle, apply } from '../../sim/battle.js';
import { bestMove } from '../../sim/solver.js';
import { Fx } from '../anim.js';
import { BattleScreen } from './battle.js';

// 시연 판이 그리는 구역은 버린다(메뉴 뒤라 누를 수 없다)
const NO_UI = { region() {}, isHover: () => false, hover: null };

export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.round = 0;
    this.newBoard();
  }
  newBoard() {
    const k = this.round++;
    const hold = { b: createBattle({ seed: 101 + k * 7, ante: 1 + (k % 3), kind: 'practice' }) };
    this.hold = hold;
    this.fx = new Fx();
    this.demo = new BattleScreen(this.app, { quiet: true, fx: this.fx, source: { kind: 'demo', live: () => hold.b, cmd: (c) => apply(hold.b, c), run: null, after: () => { this.rest = 0.9; } } });
    this.demo.noPreview = true;
    this.demo.boardOnly = true;   // 판만 그린다(목표 막대 · 왼쪽 숫자 없음)
    this.line = null;
    this.rest = 0.8;
  }
  step() {
    const d = this.demo, b = this.hold.b;
    if (d.busy) return;
    if (this.line && this.line.length && b.status === 'chain') { d.send({ type: 'capture', sq: this.line.shift() }); return; }
    if (b.status !== 'play') { this.newBoard(); return; }
    const m = bestMove(b, { maxNodes: 4000 });
    if (!m) { this.newBoard(); return; }
    this.line = m.line.slice();
    d.send({ type: 'drop', handIndex: m.handIndex, sq: m.sq });
  }
  update(dt) {
    this.demo.update(dt);
    this.fx.update(dt * this.app.speed());
    if ((this.rest -= dt) <= 0 && !this.demo.busy) { this.rest = this.line && this.line.length ? 0.35 : 0; this.step(); }
  }
  draw(ctx, ui) {
    const app = this.app;
    this.demo.drawBoard(ctx, NO_UI);
    this.fx.draw(ctx, 1);
    // 메뉴 뒤라 어둡게 덮는다
    ctx.globalAlpha = 0.6;
    rect(ctx, 0, 0, W, H, PAL.shadow);
    ctx.globalAlpha = 1;
    text(ctx, '체인메이트', W / 2, 44, PAL.goldDk, { align: 'center', bold: true, scale: 3 });
    text(ctx, '체인메이트', W / 2, 42, PAL.gold, { align: 'center', bold: true, scale: 3, shadow: null });
    text(ctx, '잡으면 그것이 된다', W / 2, 92, PAL.ink, { align: 'center' });
    const has = app.hasSave();
    const items = [];
    if (has) items.push(['title:continue', '이어 하기', () => app.continueRun(), 'gold']);
    // 처음 켰으면(기록이 비었으면) 새 판은 첫 수업부터
    const first = !app.records.lessonsDone && app.records.runs === 0;
    items.push(['title:new', '새 판', () => (first ? app.go('lesson') : app.go('setup')), has ? 'plain' : 'gold']);
    items.push(['title:lesson', '첫 수업', () => app.go('lesson'), 'plain']);
    items.push(['title:daily', '오늘의 대국', () => app.newRun({ daily: true }), 'plain']);
    items.push(['title:codex', '도감', () => app.go('codex'), 'plain']);
    items.push(['title:records', '기록', () => app.go('records'), 'plain']);
    items.push(['title:settings', '설정', () => app.openOverlay('settings'), 'plain']);
    const bw = 120, bh = 16, x = (W - bw) / 2;
    items.forEach(([id, label, fn, tone], i) => button(ctx, ui, id, x, 110 + i * 20, bw, bh, label, { onClick: fn, tone }));
    rect(ctx, 0, H - 1, W, 1, PAL.feltDk);
  }
  key(k) {
    if (k === 'Enter' || k === ' ') { if (!this.app.continueRun()) this.app.go(!this.app.records.lessonsDone && this.app.records.runs === 0 ? 'lesson' : 'setup'); }
  }
}
