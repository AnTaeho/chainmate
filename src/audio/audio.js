// 소리: WebAudio 합성만(파일 없음). 첫 누르기 전에는 소리를 켜지 않는다(브라우저 규칙).
// 효과음 play(이름, 인수) · 음악(대국 · 명인 · 상점 · 타이틀)은 update에서 조금씩 앞서 예약한다.
// 대국 음악은 사슬이 길어질수록 층이 하나씩 더해진다(저음 → 화음 → 박 → 아르페지오).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → Hz
// 먹기 음계: 도레미파솔라시(장음계), 한 옥타브를 넘으면 다음 옥타브
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const captureNote = (n) => { const k = Math.max(0, n - 1); return 72 + MAJOR[k % 7] + 12 * Math.floor(k / 7); };

export function createAudio(win = globalThis) {
  const AC = win && (win.AudioContext || win.webkitAudioContext);
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  const conf = { volume: 0.6, music: 0.5 };
  const mus = { track: null, step: 0, next: 0, layers: 0 };

  function ensure() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.connect(master);
      const n = Math.floor(ctx.sampleRate * 1);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      applyGains();
    } catch { ctx = null; }
    return ctx;
  }
  function applyGains() {
    if (!ctx) return;
    sfxBus.gain.value = conf.volume * 0.5;
    musBus.gain.value = conf.music * conf.volume * 0.22;
  }

  // ── 합성 조각
  function tone(freq, { t = 0, dur = 0.12, type = 'triangle', vol = 0.3, attack = 0.005, slide = null, bus = sfxBus, filter = null } = {}) {
    if (!ctx) return;
    const at = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; node.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(at); o.stop(at + dur + 0.05);
  }
  function noise({ t = 0, dur = 0.1, vol = 0.2, freq = 2000, type = 'bandpass', q = 1, sweep = null, bus = sfxBus } = {}) {
    if (!ctx) return;
    const at = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, at); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(at, Math.random() * 0.5); src.stop(at + dur + 0.02);
  }
  function bell(freq, { t = 0, dur = 0.9, vol = 0.18 } = {}) {
    tone(freq, { t, dur, type: 'sine', vol });
    tone(freq * 2.76, { t, dur: dur * 0.6, type: 'sine', vol: vol * 0.4 });
    tone(freq * 5.4, { t, dur: dur * 0.3, type: 'sine', vol: vol * 0.2 });
  }
  const arp = (notes, gap, opts = {}) => notes.forEach((n, i) => tone(NOTE(n), { t: i * gap, ...opts }));

  const SFX = {
    click: () => tone(1200, { dur: 0.03, type: 'square', vol: 0.05 }),
    pick: () => tone(900, { dur: 0.04, type: 'square', vol: 0.06, slide: 1100 }),
    drop: () => { tone(200, { dur: 0.1, type: 'sine', vol: 0.4, slide: 90 }); noise({ dur: 0.05, vol: 0.12, freq: 900 }); },
    capture: (n = 1) => {
      const f = NOTE(captureNote(n));
      tone(f, { dur: 0.16, type: 'triangle', vol: 0.32 });
      tone(f * 2, { dur: 0.08, type: 'square', vol: 0.05 });
      noise({ dur: 0.05, vol: 0.12, freq: 3000 });
    },
    transform: () => { noise({ dur: 0.07, vol: 0.18, freq: 4000, q: 2, sweep: 7000 }); tone(1400, { t: 0.01, dur: 0.08, type: 'sine', vol: 0.08, slide: 2600 }); },
    promote: () => { bell(NOTE(84), { vol: 0.2 }); bell(NOTE(91), { t: 0.12, vol: 0.14 }); },
    cut: () => { tone(120, { dur: 0.3, type: 'sine', vol: 0.5, slide: 50 }); noise({ dur: 0.18, vol: 0.25, freq: 300, type: 'lowpass' }); },
    mate: () => {
      [48, 55, 60, 64].forEach((n, i) => tone(NOTE(n), { t: 0.05 * i, dur: 1.4, type: 'sawtooth', vol: 0.12, filter: { freq: 1400 } }));
      noise({ dur: 0.5, vol: 0.3, freq: 120, type: 'lowpass' });
      bell(NOTE(76), { t: 0.25, dur: 1.2, vol: 0.14 });
    },
    grade: (mark) => {
      const k = { '!': 3, '!!': 4, '!!!': 5, '∞': 7 }[mark] || 3;
      arp([72, 76, 79, 84, 88, 91, 96].slice(0, k), 0.045, { dur: 0.14, type: 'square', vol: 0.06 });
      if (mark === '∞') noise({ t: 0.2, dur: 0.6, vol: 0.08, freq: 6000, q: 0.5 });
    },
    forced: () => { tone(NOTE(57), { dur: 0.08, type: 'square', vol: 0.06 }); tone(NOTE(56), { t: 0.08, dur: 0.1, type: 'square', vol: 0.06 }); },
    tick: () => tone(2400, { dur: 0.015, type: 'square', vol: 0.03 }),
    gather: () => noise({ dur: 0.25, vol: 0.12, freq: 400, q: 2, sweep: 3000 }),
    boom: (score = 0) => {
      tone(90, { dur: 0.25, type: 'sine', vol: 0.55, slide: 45 });
      noise({ dur: 0.18, vol: 0.2, freq: 700, type: 'lowpass' });
      if (score >= 1000) bell(NOTE(84), { t: 0.02, dur: 0.5, vol: 0.08 });
    },
    count: () => { for (let i = 0; i < 8; i++) tone(1800 + i * 90, { t: i * 0.035, dur: 0.02, type: 'square', vol: 0.03 }); },
    coin: (i = 0) => { const b = 1 + Math.min(6, i) * 0.03; tone(988 * b, { dur: 0.06, type: 'square', vol: 0.07 }); tone(1319 * b, { t: 0.06, dur: 0.16, type: 'square', vol: 0.07 }); },
    overflow: (tier = 1) => {
      const k = { 1: 2, 2: 3, 5: 4, 10: 6 }[tier] || 2;
      arp([60, 64, 67, 72, 76, 79], 0.05, { dur: 0.2, type: 'sawtooth', vol: 0.05, filter: { freq: 2400 } });
      noise({ dur: 0.2 + k * 0.08, vol: 0.06 * k, freq: 800, q: 0.7, sweep: 6000 });
    },
    reinforce: () => tone(160, { dur: 0.08, type: 'triangle', vol: 0.12, slide: 120 }),
    discard: () => noise({ dur: 0.12, vol: 0.15, freq: 2500, q: 0.8, sweep: 1200 }),
    win: () => arp([72, 76, 79, 84], 0.09, { dur: 0.25, type: 'square', vol: 0.08 }),
    lose: () => arp([67, 63, 60, 55], 0.14, { dur: 0.35, type: 'triangle', vol: 0.18 }),
    golden: () => { bell(NOTE(96), { dur: 0.6, vol: 0.12 }); for (let i = 0; i < 6; i++) tone(NOTE(96 + (i % 3) * 4), { t: 0.05 + i * 0.04, dur: 0.05, type: 'sine', vol: 0.05 }); },
    glass: () => { noise({ dur: 0.25, vol: 0.2, freq: 6000, q: 3 }); tone(3200, { dur: 0.12, type: 'sine', vol: 0.05, slide: 2000 }); },
    refill: () => noise({ dur: 0.5, vol: 0.15, freq: 300, q: 1, sweep: 5000 }),
    start: () => { bell(NOTE(48), { dur: 1.2, vol: 0.2 }); tone(NOTE(36), { dur: 0.8, type: 'sine', vol: 0.3 }); },
    pack: () => noise({ dur: 0.18, vol: 0.18, freq: 3500, q: 1, sweep: 900 }),
    flip: () => noise({ dur: 0.05, vol: 0.12, freq: 2200, q: 1 }),
    chart: () => arp([79, 84], 0.06, { dur: 0.2, type: 'sine', vol: 0.12 }),
    engrave: () => { noise({ dur: 0.1, vol: 0.14, freq: 5000, q: 4 }); bell(NOTE(88), { t: 0.05, dur: 0.4, vol: 0.08 }); },
    chestOpen: () => { noise({ dur: 0.4, vol: 0.12, freq: 250, q: 5, sweep: 180 }); tone(NOTE(55), { t: 0.2, dur: 0.4, type: 'triangle', vol: 0.12 }); },
    reelStop: () => { tone(700, { dur: 0.04, type: 'square', vol: 0.06 }); noise({ dur: 0.03, vol: 0.1, freq: 1500 }); },
    reelLit: (i = 0) => { tone(700, { dur: 0.04, type: 'square', vol: 0.06 }); bell(NOTE(79 + i * 2), { t: 0.02, dur: 0.5, vol: 0.12 }); },
    sparkle: () => { for (let i = 0; i < 8; i++) tone(NOTE(88 + (i * 5) % 12), { t: i * 0.04, dur: 0.08, type: 'sine', vol: 0.06 }); },
    fanfare: () => {
      arp([60, 64, 67, 72, 67, 72, 76, 84], 0.1, { dur: 0.3, type: 'square', vol: 0.07 });
      [48, 55, 60].forEach((n) => tone(NOTE(n), { t: 0.8, dur: 1.2, type: 'sawtooth', vol: 0.07, filter: { freq: 1800 } }));
    },
    fragment: () => arp([84, 88, 91], 0.07, { dur: 0.4, type: 'sine', vol: 0.12 }),
    // 전설 한 소절: 느린 금빛 선율 + 종
    legend: () => {
      const mel = [[72, 0], [76, 0.25], [79, 0.5], [84, 0.75], [83, 1.1], [79, 1.35], [81, 1.6], [84, 2.0]];
      for (const [n, t] of mel) { tone(NOTE(n), { t, dur: 0.45, type: 'triangle', vol: 0.14 }); }
      [48, 55, 64].forEach((n) => tone(NOTE(n), { dur: 2.6, type: 'sine', vol: 0.12 }));
      bell(NOTE(96), { t: 2.0, dur: 1.4, vol: 0.12 });
    },
  };

  // ── 음악: 16걸음 되풀이. 층 0 저음 · 1 화음 · 2 박 · 3 아르페지오
  const TRACKS = {
    battle: { bpm: 84, bass: [45, 0, 0, 0, 40, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0], chord: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [55, 59, 62]], arp: [69, 72, 76, 72] },
    master: { bpm: 96, bass: [38, 0, 38, 0, 38, 0, 44, 0, 38, 0, 38, 0, 37, 0, 44, 0], chord: [[50, 53, 57], [50, 53, 56], [49, 53, 56], [50, 53, 57]], arp: [62, 65, 68, 65] },
    shop: { bpm: 112, bass: [48, 0, 55, 0, 53, 0, 55, 0, 48, 0, 55, 0, 57, 0, 55, 0], chord: [[60, 64, 67], [60, 64, 67], [57, 60, 65], [59, 62, 67]], arp: [72, 76, 79, 76], light: true },
    title: { bpm: 70, bass: [45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0], chord: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]], arp: [] },
  };
  function scheduleStep(tr, step, at, layers) {
    const t = at - ctx.currentTime;
    const beat = 60 / tr.bpm / 2; // 8분
    const b = tr.bass[step % 16];
    if (b) tone(NOTE(b), { t, dur: beat * 3.5, type: tr.light ? 'triangle' : 'sine', vol: 0.5, bus: musBus });
    if (step % 4 === 0 && (layers >= 1 || tr === TRACKS.title || tr.light)) {
      const ch = tr.chord[Math.floor(step / 4) % 4];
      for (const n of ch) tone(NOTE(n), { t, dur: beat * 4, type: 'triangle', vol: tr.light ? 0.08 : 0.07, attack: 0.08, bus: musBus });
    }
    if (layers >= 2 && step % 2 === 0) noise({ t, dur: 0.04, vol: step % 4 === 0 ? 0.18 : 0.08, freq: 8000, type: 'highpass', bus: musBus });
    if (layers >= 3 && tr.arp.length) tone(NOTE(tr.arp[step % tr.arp.length] + (layers >= 4 ? 12 : 0)), { t, dur: beat * 0.9, type: 'square', vol: 0.05, bus: musBus });
  }
  function musicFor(app) {
    const s = app.screen && app.screen.name;
    if (!s) return null;
    if (s === 'battle') {
      const b = app.screen.b;
      const master = b && b.kind === 'master';
      const v = app.screen.view;
      const n = v && v.chain ? v.chain.path.length - 1 : 0;
      mus.layers = n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : master ? 1 : 0;
      return master ? 'master' : 'battle';
    }
    if (s === 'shop' || s === 'pack' || s === 'select') { mus.layers = 1; return 'shop'; }
    if (s === 'title' || s === 'result') { mus.layers = 0; return 'title'; }
    return mus.track;
  }

  return {
    get ready() { return !!ctx; },
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    },
    apply(settings) { conf.volume = settings.volume ?? conf.volume; conf.music = settings.music ?? conf.music; applyGains(); },
    play(name, arg) {
      if (!ctx || conf.volume <= 0) return;
      const f = SFX[name];
      if (f) { try { f(arg); } catch { /* 소리 실패는 무시 */ } }
    },
    update(dt, app) {
      if (!ctx || ctx.state !== 'running' && ctx.state !== undefined) return;
      const want = musicFor(app);
      if (want !== mus.track) { mus.track = want; mus.step = 0; mus.next = ctx.currentTime + 0.05; }
      const tr = TRACKS[mus.track];
      if (!tr || conf.music <= 0) return;
      const stepDur = 60 / tr.bpm / 2;
      if (mus.next < ctx.currentTime) mus.next = ctx.currentTime + 0.02;
      while (mus.next < ctx.currentTime + 0.2) {
        scheduleStep(tr, mus.step, mus.next, mus.layers);
        mus.step = (mus.step + 1) % 16;
        mus.next += stepDur;
      }
    },
    names: Object.keys(SFX),
  };
}
