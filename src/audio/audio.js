// 소리: WebAudio 합성만(파일 없음). 첫 누르기 전에는 소리를 켜지 않는다(브라우저 규칙).
// 효과음 play(이름, 인수) · 음악(대국 · 마스터전 · 상점 · 타이틀)은 update에서 조금씩 앞서 예약한다.
// 음악(CHM-29): 대국 · 상점 · 타이틀은 밤의 체스 클럽 재즈, 마스터전만 명경기의 방 바로크(라단조).
// 곡마다 A · B 부분을 form 순서로 되풀이하고, 사슬이 길어질수록 층이 더해진다.
//   재즈  0 걷는 베이스 · 1 전자 피아노 화음 · 2 붓 스네어와 라이드 · 3 박이 두 배(스윙 8분) · 4 비브라폰 선율
//   바로크 0 통주저음 · 1 분산화음 · 2 소프라노 · 3 대위 선율 · 4 저음 8분과 16분 분산화음
// 음악은 효과음 자리(2kHz 언저리)를 비워 두고, 큰 효과음이 날 때 잠깐 내려앉는다. 곡을 바꾸면 0.5초 사라지고 들어온다.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → Hz
// 먹기 음계: 도레미파솔라시(장음계), 한 옥타브를 넘으면 다음 옥타브
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const captureNote = (n) => { const k = Math.max(0, n - 1); return 72 + MAJOR[k % 7] + 12 * Math.floor(k / 7); };

// opts.context: 이미 만든 컨텍스트(OfflineAudioContext로 곡을 파일로 뽑을 때 · 시험). opts.strict: 음악 예약의 예외를 삼키지 않는다(시험).
export function createAudio(win = globalThis, opts = {}) {
  const AC = win && (win.AudioContext || win.webkitAudioContext);
  let ctx = null, master = null, sfxBus = null, musBus = null, musDuck = null, noiseBuf = null, epLfo = null, vibLfo = null;
  const conf = { volume: 0.6, music: 0.5 };
  const mus = { track: null, pos: 0, next: 0, layers: 0 };
  const lanes = {}; // 곡마다 제 길(곡 음량 · 전자 피아노 트레몰로 · 비브라폰 트레몰로) — 곡 바꿀 때 길째로 사라지고 들어온다

  function ensure() {
    if (ctx || !(AC || opts.context)) return ctx;
    try {
      ctx = opts.context || new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      // 음악 길: 음량 → 효과음 자리 비우기(2.2kHz 언저리 -6dB) → 윗소리 걷기(6.5kHz) → 효과음 따라 내려앉기 → 마스터
      musBus = ctx.createGain();
      const eq = ctx.createBiquadFilter(); eq.type = 'peaking'; eq.frequency.value = 2200; eq.Q.value = 0.8; eq.gain.value = -6;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500; lp.Q.value = 0.5;
      musDuck = ctx.createGain(); musDuck.gain.value = 1;
      musBus.connect(eq); eq.connect(lp); lp.connect(musDuck); musDuck.connect(master);
      const n = Math.floor(ctx.sampleRate * 1);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      epLfo = lfo(4.2, 0.16);
      vibLfo = lfo(5.4, 0.28);
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
    grow: () => { arp([72, 79, 84, 91], 0.06, { dur: 0.22, type: 'sine', vol: 0.1 }); bell(NOTE(96), { t: 0.24, dur: 0.6, vol: 0.1 }); },
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
    // 혼의 금(CHM-17): 사기 그릇에 금이 가는 짧은 두 번의 딱 소리 · 각성: 금이 터지며 솟는 쓸기 + 종 화음
    crack: () => { noise({ dur: 0.04, vol: 0.22, freq: 7000, q: 5 }); noise({ t: 0.07, dur: 0.05, vol: 0.18, freq: 5200, q: 5 }); tone(NOTE(79), { t: 0.07, dur: 0.12, type: 'triangle', vol: 0.05, slide: NOTE(74) }); },
    awaken: () => { noise({ dur: 0.35, vol: 0.16, freq: 800, q: 1.5, sweep: 7000 }); bell(NOTE(84), { t: 0.3, dur: 0.9, vol: 0.16 }); bell(NOTE(88), { t: 0.36, dur: 0.9, vol: 0.12 }); bell(NOTE(91), { t: 0.42, dur: 1.1, vol: 0.12 }); },
    // 탁월수 !!(CHM-43): 메이트 화음 위에 얹히는 맑은 두 종(5도 위로 뛴다) + 위로 쓸어 올리는 반짝임. 메이트 소리와 겹쳐 울린다
    brilliant: () => {
      bell(NOTE(91), { dur: 0.7, vol: 0.13 }); bell(NOTE(98), { t: 0.09, dur: 0.9, vol: 0.11 });
      for (let i = 0; i < 5; i++) tone(NOTE(86 + i * 3), { t: 0.02 + i * 0.03, dur: 0.06, type: 'sine', vol: 0.045 });
      noise({ t: 0.05, dur: 0.3, vol: 0.05, freq: 5000, q: 0.7, sweep: 9000 });
    },
    // 전설 한 소절: 느린 금빛 선율 + 종
    legend: () => {
      const mel = [[72, 0], [76, 0.25], [79, 0.5], [84, 0.75], [83, 1.1], [79, 1.35], [81, 1.6], [84, 2.0]];
      for (const [n, t] of mel) { tone(NOTE(n), { t, dur: 0.45, type: 'triangle', vol: 0.14 }); }
      [48, 55, 64].forEach((n) => tone(NOTE(n), { dur: 2.6, type: 'sine', vol: 0.12 }));
      bell(NOTE(96), { t: 2.0, dur: 1.4, vol: 0.12 });
    },
  };

  // ── 음악
  // 층마다 켜지는 것은 곡의 at(재즈) · 바로크는 층 번호 그대로. 걸음 = 8분음표, 한 마디 8걸음.
  function lfo(rate, depth) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = rate;
    const d = ctx.createGain(); d.gain.value = depth;
    o.connect(d); o.start();
    return d;
  }
  function lane(name) {
    if (lanes[name]) return lanes[name];
    const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(musBus);
    const ep = ctx.createGain(); ep.gain.value = 0.82; ep.connect(out); epLfo.connect(ep.gain);
    const vib = ctx.createGain(); vib.gain.value = 0.7; vib.connect(out); vibLfo.connect(vib.gain);
    return (lanes[name] = { out, ep, vib });
  }
  function glide(p, v, at, dur) {
    if (p.cancelScheduledValues) p.cancelScheduledValues(at);
    if (dur <= 0) { p.setValueAtTime(v, at); return; }
    p.setValueAtTime(p.value, at);
    p.linearRampToValueAtTime(v, at + dur);
  }
  const FADE = 0.5;
  function switchTo(want, fade = FADE) {
    const now = ctx.currentTime;
    if (mus.track && lanes[mus.track]) glide(lanes[mus.track].out.gain, 0.0001, now, fade);
    mus.track = want; mus.pos = 0; mus.next = now + 0.05;
    if (want && TRACKS[want]) glide(lane(want).out.gain, 1, now, fade);
  }
  // 큰 효과음이 나면 음악이 잠깐 내려앉았다 돌아온다
  const DUCK = new Set(['capture', 'promote', 'cut', 'mate', 'grade', 'boom', 'overflow', 'win', 'lose', 'golden', 'legend', 'fanfare', 'grow', 'fragment', 'start', 'brilliant']);
  function duck() {
    const p = musDuck.gain, now = ctx.currentTime;
    if (p.cancelScheduledValues) p.cancelScheduledValues(now);
    p.setValueAtTime(p.value > 0 ? p.value : 1, now);
    p.linearRampToValueAtTime(0.7, now + 0.02);
    p.linearRampToValueAtTime(1, now + 0.4);
  }

  // 목소리 조각: 끝나면 이은 마디를 끊어 쌓이지 않게 한다
  const done = (src, nodes) => { src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* 이미 끊김 */ } } }; };
  function osc(freq, type, at, end, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, at);
    o.connect(dest); o.start(at); o.stop(end);
    return o;
  }
  // 튕기는 엔벨로프: 올라가서 → sustain 비율까지 빨리 → 끝까지 천천히
  function pluck(at, vol, attack, knee, kneeT, dur, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * knee), at + kneeT);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(dest);
    return g;
  }
  // 콘트라베이스: 사인 + 삼각파를 낮게 거른다
  function upright(n, at, dur, vol, dest) {
    const f = NOTE(n), end = at + dur + 0.05;
    const g = pluck(at, vol, 0.012, 0.4, 0.2, dur, dest);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.8; lp.connect(g);
    const a = osc(f, 'sine', at, end, lp); osc(f, 'triangle', at, end, lp);
    done(a, [lp, g]);
  }
  // 전자 피아노: 사인 둘을 살짝 어긋나게 + 두 배음의 짧은 쇳소리, 트레몰로는 길(lane.ep)이 건다
  function epiano(n, at, dur, vol, dest) {
    const f = NOTE(n), end = at + dur + 0.3;
    const g = pluck(at, vol, 0.012, 0.55, 0.35, dur + 0.25, dest);
    const a = osc(f, 'sine', at, end, g); osc(f * 1.0035, 'sine', at, end, g);
    const tg = pluck(at, vol * 0.22, 0.004, 0.2, 0.12, 0.35, dest);
    const t = osc(f * 2, 'sine', at, at + 0.4, tg);
    done(a, [g]); done(t, [tg]);
  }
  // 비브라폰: 사인 + 네 배음(쇠막대), 모터 트레몰로는 길(lane.vib)
  function vibes(n, at, dur, vol, dest) {
    const f = NOTE(n), end = at + dur + 0.05;
    const g = pluck(at, vol, 0.004, 0.45, 0.25, dur, dest);
    const a = osc(f, 'sine', at, end, g);
    const hg = pluck(at, vol * 0.14, 0.002, 0.15, 0.08, 0.3, dest);
    const h = osc(f * 4, 'sine', at, at + 0.35, hg);
    done(a, [g]); done(h, [hg]);
  }
  // 하프시코드: 톱니 8'과 4'을 거르개가 빠르게 닫히며 튕긴다
  function harpsi(n, at, dur, vol, dest) {
    const f = NOTE(n), end = at + dur + 0.05;
    const g = pluck(at, vol, 0.002, 0.35, 0.09, dur, dest);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(700, f * 2.5), at + Math.min(0.4, dur * 0.7));
    lp.connect(g);
    const a = osc(f, 'sawtooth', at, end, lp); osc(f * 2.003, 'sawtooth', at, end, lp);
    done(a, [lp, g]);
  }
  // 거른 잡음: 붓 스네어 · 하이햇 · 라이드
  function hiss(at, dur, vol, type, freq, q, dest, attack = 0.002) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = pluck(at, vol, attack, 0.5, attack + dur * 0.3, dur, dest);
    src.connect(f); f.connect(g);
    src.start(at, Math.random() * 0.4); src.stop(at + dur + 0.02);
    done(src, [f, g]);
  }
  function kick(at, vol, dest) {
    const g = pluck(at, vol, 0.004, 0.3, 0.05, 0.16, dest);
    const o = osc(62, 'sine', at, at + 0.2, g);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    done(o, [g]);
  }
  // 걷는 베이스의 넷째 박: 다음 마디 뿌리로 반음 다가간다
  const approach = (from, to) => (from > to ? to + 1 : to - 1);

  // ── 재즈 한 걸음
  function jazzStep(tr, pos, at, L, b, ln) {
    const bars = tr.bars, bi = Math.floor(pos / 8) % bars.length, s = pos % 8;
    const bar = bars[bi], nx = bars[(bi + 1) % bars.length], A = tr.at, out = ln.out;
    const t = at + (s % 2 ? tr.swing * b : 0); // 스윙: 둘째 8분을 뒤로 민다
    const [r, w1, w2] = bar.w;
    // 베이스(층 0부터)
    if (tr.bass === 'walk') {
      if (s % 2 === 0) { const q = s / 2; upright(q < 3 ? bar.w[q] : approach(w2, nx.w[0]), at, b * 1.9, q === 0 ? 0.15 : 0.13, out); }
    } else if (tr.bass === 'two') {
      if (s === 0) upright(r, at, b * 3.6, 0.15, out);
      if (s === 4) upright(w2, at, b * 3.2, 0.12, out);
      if (s === 7 && L >= A.beat) upright(approach(w2, nx.w[0]), t, b * 0.9, 0.08, out);
    } else {
      if (s === 0) upright(r, at, b * 7.5, 0.16, out);
      if (s === 4 && w1) upright(w1, at, b * 3.8, 0.08, out);
    }
    // 전자 피아노 화음
    if (L >= A.ch) {
      for (const [st, len, v] of bar.comp) if (st === s) for (const n of bar.ch) epiano(n, t, b * len, tr.epVol * v, ln.ep);
    }
    // 붓 스네어 · 라이드 · 하이햇
    if (L >= A.beat) {
      const bv = tr.beatVol;
      if (s % 2 === 0) { hiss(at, b * 1.8, 0.03 * bv, 'bandpass', 1500, 0.6, out, 0.03); hiss(at, 0.12, (s % 4 === 0 ? 0.05 : 0.075) * bv, 'bandpass', 6500, 1.2, out); }
      if (s === 2 || s === 6) { hiss(at, 0.07, 0.11 * bv, 'bandpass', 2600, 0.7, out); hiss(at, 0.035, 0.06 * bv, 'highpass', 7500, 0.7, out); }
      if (L >= A.dense) {
        if (s % 2) { hiss(t, 0.09, 0.055 * bv, 'bandpass', 6500, 1.2, out); hiss(t, 0.05, 0.03 * bv, 'bandpass', 2400, 0.7, out); }
        if (s === 0 || s === 5) kick(s === 0 ? at : t, 0.12 * bv, out);
      }
    }
    // 비브라폰 선율
    if (L >= A.lead) { const m = bar.m[s]; if (m) vibes(m, t, tr.leadDur * b, tr.leadVol, ln.vib); }
  }

  // ── 바로크 한 걸음(라단조, 곧은 박)
  const MINOR = [2, 4, 5, 7, 9, 10, 0]; // 라단조 음계(라 미 파 솔 라 시b 도)
  const HARM = [2, 4, 5, 7, 9, 10, 1]; //  딸림화음에서는 도# (화성 단음계)
  const fold = (n, lo) => { while (n < lo) n += 12; while (n >= lo + 12) n -= 12; return n; };
  function scaleNote(root, deg, lo, harm) {
    const pcs = harm ? HARM : MINOR, list = [];
    for (let m = lo - 12; m < lo + 36; m++) if (pcs.includes(((m % 12) + 12) % 12)) list.push(m);
    const i = list.indexOf(fold(root, lo));
    return list[Math.max(0, Math.min(list.length - 1, i + deg))];
  }
  const RUN = [[2, 1, 0, 1, 2, 3, 4, 3], [4, 3, 2, 1, 0, 1, 2, 1]]; // 대위 선율: 강박은 늘 화음 음
  function baroqueStep(tr, pos, at, L, b, ln) {
    const bars = tr.bars, bi = Math.floor(pos / 8) % bars.length, s = pos % 8;
    const bar = bars[bi], out = ln.out, r = bar.r;
    // 0 통주저음: 뿌리 · 옥타브 · 5도 · 옥타브(4분), 층 4면 8분 사이사이 옥타브
    if (s % 2 === 0) harpsi([r, r + 12, r + bar.tri[2], r + 12][s / 2], at, b * 1.7, 0.24, out);
    else if (L >= 4) harpsi(r + 12, at, b * 0.8, 0.1, out);
    // 1 분산화음(알토, 52~63)
    if (L >= 1) {
      const tones = bar.tri.map((x) => fold(r + x, 52)).sort((x, y) => x - y);
      const pat = [0, 1, 2, 1];
      harpsi(tones[pat[s % 4]], at, b * 0.95, 0.1, out);
      if (L >= 4) harpsi(tones[pat[(s + 1) % 4]], at + b / 2, b * 0.5, 0.07, out);
    }
    // 2 소프라노(4분)
    if (L >= 2 && s % 2 === 0) { const n = bar.sop[s / 2]; if (n) harpsi(n, at, b * 2.2, 0.12, out); }
    // 3 대위 선율(테너 위, 8분 음계 걸음)
    if (L >= 3) harpsi(scaleNote(r, RUN[bi % 2][s], 62, bar.harm), at, b * 0.9, 0.08, out);
  }

  // ── 곡
  // 재즈 마디: w = 걷는 베이스 앞 세 박(넷째 박은 다음 뿌리로 다가감), ch = 전자 피아노 화음(뿌리 뺀 짜임), m = 비브라폰 8분 여덟(0 쉼)
  const J = (w, ch, m) => ({ w, ch, m });
  // 바로크 마디: r = 뿌리, tri = 화음(뿌리부터 반음), sop = 소프라노 4분 넷(0 이어 울림), harm = 도#
  const B = (r, tri, sop, harm = false) => ({ r, tri, sop, harm });
  const mi = [0, 3, 7], ma = [0, 4, 7], dim = [0, 3, 6];
  const TRACKS = {
    // 대국: 라 도리안 쪽 ii-V-I, 92 · 스윙. A A' B A' 16마디
    battle: {
      style: jazzStep, bpm: 92, swing: 0.3, bass: 'walk', at: { ch: 1, beat: 2, dense: 3, lead: 4 },
      epVol: 0.045, beatVol: 1, leadVol: 0.07, leadDur: 3,
      sections: {
        A: { comp: [[0, 6, 1], [5, 1.5, 0.7]], bars: [
          J([38, 41, 45], [53, 57, 60, 64], [0, 0, 69, 72, 76, 0, 74, 0]), // Dm9
          J([43, 41, 40], [53, 57, 59, 64], [0, 77, 0, 76, 74, 0, 71, 0]), // G13
          J([36, 40, 43], [52, 55, 59, 62], [72, 0, 0, 0, 0, 76, 79, 0]), // Cmaj9
          J([45, 43, 40], [55, 58, 61, 64], [81, 0, 0, 79, 76, 0, 73, 0]), // A7b9
        ] },
        A2: { comp: [[0, 3, 1], [3, 2, 0.7], [6, 2, 0.6]], bars: [
          J([38, 41, 45], [53, 57, 60, 64], [77, 0, 76, 74, 0, 72, 0, 69]),
          J([43, 41, 40], [53, 57, 59, 64], [71, 0, 0, 74, 0, 77, 76, 0]),
          J([36, 40, 43], [52, 55, 59, 62], [76, 0, 74, 0, 72, 0, 71, 0]),
          J([45, 43, 40], [55, 58, 61, 64], [69, 0, 73, 76, 79, 0, 82, 0]),
        ] },
        B: { comp: [[0, 2, 0.9], [3, 3, 0.8], [7, 1, 0.6]], bars: [
          J([43, 41, 38], [53, 57, 58, 62], [0, 0, 74, 77, 81, 0, 79, 0]), // Gm9
          J([36, 40, 43], [52, 57, 58, 62], [0, 76, 0, 74, 69, 0, 70, 0]), // C13
          J([41, 45, 48], [52, 55, 57, 60], [72, 0, 0, 76, 0, 79, 81, 0]), // Fmaj9
          J([46, 45, 41], [53, 57, 62, 64], [0, 0, 76, 0, 74, 0, 69, 0]), // Bbmaj7#11
        ] },
      },
      form: ['A', 'A2', 'B', 'A2'],
    },
    // 상점: 바장조, 조금 빠르고 밝게. 두 박 베이스 · 가벼운 붓 · 높은 비브라폰. A B 8마디
    shop: {
      style: jazzStep, bpm: 104, swing: 0.22, bass: 'two', at: { ch: 0, beat: 1, dense: 99, lead: 2 },
      epVol: 0.042, beatVol: 0.7, leadVol: 0.065, leadDur: 2.5,
      sections: {
        A: { comp: [[0, 2, 1], [3, 1.5, 0.7], [6, 1.5, 0.6]], bars: [
          J([41, 45, 48], [57, 60, 64, 67], [79, 0, 77, 76, 0, 0, 72, 0]), // Fmaj9
          J([38, 41, 45], [53, 57, 60, 64], [74, 0, 0, 0, 0, 0, 0, 0]), // Dm9
          J([43, 46, 50], [53, 57, 58, 62], [74, 0, 77, 0, 0, 0, 0, 0]), // Gm9
          J([36, 40, 43], [52, 57, 58, 62], [76, 0, 74, 72, 0, 0, 0, 0]), // C13
        ] },
        B: { comp: [[0, 3, 1], [5, 2, 0.7]], bars: [
          J([45, 48, 52], [55, 60, 64, 67], [76, 0, 79, 0, 84, 0, 0, 0]), // Am7
          J([38, 42, 45], [54, 57, 60, 64], [81, 0, 78, 0, 0, 0, 0, 0]), // D9
          J([43, 46, 50], [53, 57, 58, 62], [77, 0, 74, 0, 70, 0, 0, 0]), // Gm9
          J([36, 40, 43], [52, 57, 58, 62], [72, 0, 0, 76, 0, 79, 0, 0]), // C13
        ] },
      },
      form: ['A', 'B'],
    },
    // 타이틀: 가단조 발라드 66, 여백 많게. 화음과 베이스, 드문 비브라폰. A B 8마디
    title: {
      style: jazzStep, bpm: 66, swing: 0.34, bass: 'ballad', at: { ch: 0, beat: 99, dense: 99, lead: 1 },
      epVol: 0.045, beatVol: 0, leadVol: 0.06, leadDur: 6,
      sections: {
        A: { comp: [[0, 8, 1]], bars: [
          J([45, 52], [55, 59, 60, 64], [76, 0, 0, 0, 0, 0, 0, 0]), // Am9
          J([41, 48], [52, 55, 57, 59], [0, 0, 0, 0, 71, 0, 0, 0]), // Fmaj7#11
          J([38, 45], [53, 57, 60, 64], [72, 0, 0, 0, 0, 0, 0, 0]), // Dm9
          J([40, 47], [50, 53, 56, 60], [0, 0, 68, 0, 0, 0, 0, 0]), // E7b9#5
        ] },
        B: { comp: [[0, 6, 1], [6, 2, 0.5]], bars: [
          J([36, 43], [52, 55, 59, 62], [74, 0, 0, 0, 0, 0, 0, 0]), // Cmaj9
          J([46, 41], [53, 57, 62, 64], [0, 0, 0, 0, 69, 0, 0, 0]), // Bbmaj7#11
          J([45, 52], [55, 59, 60, 64], [71, 0, 0, 0, 72, 0, 0, 0]), // Am9
          J([40, 47], [50, 53, 56, 60], [0, 0, 0, 0, 68, 0, 0, 0]), // E7b9#5
        ] },
      },
      form: ['A', 'B'],
    },
    // 마스터전: 라단조 바로크 108. A(5도권 8마디) B(라단조 내림 4도 4마디) 12마디
    master: {
      style: baroqueStep, bpm: 108,
      sections: {
        A: { bars: [
          B(38, mi, [74, 77, 76, 74]), B(43, mi, [74, 70, 72, 74]), B(36, ma, [76, 72, 74, 76]), B(41, ma, [77, 76, 77, 72]),
          B(46, ma, [74, 72, 70, 74]), B(40, dim, [70, 69, 67, 70]), B(45, ma, [73, 76, 79, 76], true), B(38, mi, [74, 0, 0, 69]),
        ] },
        B: { bars: [
          B(38, mi, [81, 77, 74, 77]), B(36, ma, [79, 76, 72, 76]), B(34, ma, [77, 74, 70, 74]), B(33, ma, [76, 73, 69, 73], true),
        ] },
      },
      form: ['A', 'B'],
    },
  };
  for (const tr of Object.values(TRACKS)) tr.bars = tr.form.flatMap((k) => tr.sections[k].bars.map((x) => ({ ...x, comp: tr.sections[k].comp })));

  function pump(until) {
    const tr = TRACKS[mus.track], ln = lane(mus.track), b = 60 / tr.bpm / 2;
    while (mus.next < until) {
      try { tr.style(tr, mus.pos, mus.next, mus.layers, b, ln); } catch (e) { if (opts.strict) throw e; /* 소리 실패는 무시 */ }
      mus.pos = (mus.pos + 1) % (tr.bars.length * 8);
      mus.next += b;
    }
  }
  function musicFor(app) {
    const s = app.screen && app.screen.name;
    if (!s) return null;
    if (s === 'battle' || s === 'lesson') {
      const b = app.screen.b;
      const master = b && b.kind === 'master';
      const v = app.screen.view;
      const n = v && v.chain ? v.chain.path.length - 1 : 0;
      mus.layers = n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : master ? 1 : 0;
      return master ? 'master' : 'battle';
    }
    if (s === 'shop' || s === 'pack' || s === 'select' || s === 'draft') { mus.layers = 2; return 'shop'; }
    if (s === 'title' || s === 'result' || s === 'setup' || s === 'codex' || s === 'records' || s === 'lessons') { mus.layers = 1; return 'title'; }
    // 보상 · 상자 · 전설: 곡은 잇되 화음까지만(금빛 효과음이 들리게)
    if (s === 'reward' || s === 'chest' || s === 'legend') mus.layers = Math.min(mus.layers, 1);
    return mus.track;
  }

  return {
    get ready() { return !!ctx; },
    get music() { return { track: mus.track, layers: mus.layers }; },
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    },
    apply(settings) { conf.volume = settings.volume ?? conf.volume; conf.music = settings.music ?? conf.music; applyGains(); },
    play(name, arg) {
      if (!ctx || conf.volume <= 0) return;
      const f = SFX[name];
      if (f) { try { f(arg); if (DUCK.has(name)) duck(); } catch { /* 소리 실패는 무시 */ } }
    },
    update(dt, app) {
      if (!ctx || ctx.state !== 'running' && ctx.state !== undefined) return;
      const want = musicFor(app);
      if (want !== mus.track) switchTo(want);
      if (!TRACKS[mus.track] || conf.music <= 0) return;
      if (mus.next < ctx.currentTime) mus.next = ctx.currentTime + 0.02;
      pump(ctx.currentTime + 0.2);
    },
    // 곡 하나를 층 layers로 seconds초 앞까지 한꺼번에 예약한다(tools/render-music.mjs · 시험). 사라지고 들어오기 없이 곧바로.
    renderMusic(name, layers, seconds) {
      if (!ensure() || !TRACKS[name]) return false;
      switchTo(name, 0);
      mus.layers = layers;
      pump(ctx.currentTime + seconds);
      return true;
    },
    // 곡의 한 바퀴 길이(초)
    loopSeconds(name) { const tr = TRACKS[name]; return tr ? (tr.bars.length * 8 * 60) / tr.bpm / 2 : 0; },
    tracks: ['battle', 'master', 'shop', 'title'],
    names: Object.keys(SFX),
  };
}
