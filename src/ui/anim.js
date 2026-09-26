// 연출 시간표. Seq = 차례로 도는 막는 연출(대국 사건), Fx = 따로 도는 효과(조각 · 반짝임 · 떠오르는 글자).
// 시간은 초. 앱이 연출 속도(×1 · ×2 · ×4)를 곱해 넘긴다.
export class Seq {
  constructor() { this.q = []; this.cur = null; this.total = 0; }
  add(step) { this.q.push(step); this.total += step.dur || 0; if (this.trace) this.trace.push([step.label, step.dur || 0]); return step; }
  get busy() { return !!this.cur || this.q.length > 0; }
  update(dt) {
    for (let guard = 0; guard < 500; guard++) {
      if (!this.cur) {
        if (!this.q.length) return;
        this.cur = this.q.shift();
        this.cur.t = 0;
        if (this.cur.begin) this.cur.begin(this.cur);
      }
      const c = this.cur;
      const dur = c.dur || 0;
      const left = dur - c.t;
      if (dt < left) {
        c.t += dt;
        if (c.tick) c.tick(c.t / dur, c);
        return;
      }
      dt -= Math.max(0, left);
      c.t = dur;
      if (c.tick) c.tick(1, c);
      if (c.done) c.done(c);
      this.cur = null;
    }
  }
  flush() { this.update(1e9); }
}

export class Fx {
  constructor() { this.list = []; }
  add(e) { e.t = 0; this.list.push(e); return e; }
  update(dt) {
    for (const e of this.list) { e.t += dt; if (e.update) e.update(dt, e); }
    this.list = this.list.filter((e) => e.t < e.life);
  }
  draw(ctx, layer = 0) { for (const e of this.list) if ((e.layer || 0) === layer && e.draw) e.draw(ctx, e); }
  clear() { this.list = []; }
}

export const ease = {
  out: (p) => 1 - (1 - p) * (1 - p),
  in: (p) => p * p,
  inOut: (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)),
  back: (p) => { const s = 1.7; const q = p - 1; return q * q * ((s + 1) * q + s) + 1; },
};
export const lerp = (a, b, p) => a + (b - a) * p;
