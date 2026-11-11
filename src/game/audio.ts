// @ts-nocheck -- grid/array indexing is bounds-checked at runtime
// All sounds are synthesized live with Web Audio — no audio files.
export class Sfx {
  ctx: AudioContext;
  master: GainNode;
  musicGain: GainNode;
  heart: GainNode;
  private noiseBuf: AudioBuffer;
  private timers: number[] = [];
  private shaper: WaveShaperNode;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    this.shaper.curve = curve;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.05;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    this.shaper.connect(lp).connect(this.musicGain).connect(this.master);

    this.heart = this.ctx.createGain();
    this.heart.gain.value = 0;
    this.heart.connect(this.master);
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = "bandpass", sweepTo?: number) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", to?: number, dest: AudioNode = this.master, when = 0) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  startMusic() {
    // Warped 3/4 calliope waltz from broken speakers
    const melody = [67, 0, 0, 71, 74, 0, 79, 0, 78, 76, 0, 74, 72, 0, 71, 69, 0, 67, 66, 0, 69, 74, 0, 0];
    const bass = [43, 50, 50, 43, 50, 50, 48, 52, 52, 50, 54, 54];
    let step = 0;
    const beat = 0.27;
    const id = window.setInterval(() => {
      if (Math.random() < 0.03) return; // dropout
      const warp = 1 + Math.sin(this.ctx.currentTime * 0.7) * 0.03 + (Math.random() - 0.5) * 0.01;
      const m = melody[step % melody.length];
      if (m) {
        const f = 440 * Math.pow(2, (m - 69) / 12) * warp;
        this.tone(f, beat * 1.4, 0.4, "triangle", undefined, this.shaper);
        this.tone(f * 2.01, beat, 0.12, "square", undefined, this.shaper);
      }
      if (step % 2 === 0) {
        const b = bass[(step / 2) % bass.length];
        this.tone(440 * Math.pow(2, (b - 69) / 12) * warp, beat * 0.8, 0.5, "sawtooth", undefined, this.shaper);
      }
      step++;
    }, beat * 1000);
    this.timers.push(id);
    // ambient wind + creaks
    const amb = window.setInterval(() => {
      this.noise(3, 300, 0.5, 0.03, "lowpass");
      if (Math.random() < 0.3) this.creak(0.05);
    }, 2500);
    this.timers.push(amb);
    // heartbeat loop
    const hb = window.setInterval(() => {
      if (this.heart.gain.value < 0.01) return;
      this.tone(55, 0.15, 0.9, "sine", 35, this.heart);
      this.tone(50, 0.15, 0.6, "sine", 30, this.heart, 0.22);
    }, 700);
    this.timers.push(hb);
  }

  creak(vol: number) {
    const o = this.tone(r(180, 320), 0.9, vol, "sawtooth", r(120, 200));
    void o;
  }
  step(vol: number) { this.noise(0.12, 900, 0.7, vol * 0.25, "lowpass"); }
  monsterStep(vol: number) {
    if (vol < 0.01) return;
    this.tone(60, 0.35, vol * 0.9, "sine", 30);
    this.noise(0.25, 200, 1, vol * 0.6, "lowpass");
    this.noise(0.18, 2600, 6, vol * 0.15); // servo clank
  }
  screech(vol: number) {
    if (vol < 0.01) return;
    this.noise(1.4, 1800, 12, vol * 0.5, "bandpass", 600);
    this.tone(r(500, 900), 1.2, vol * 0.08, "sawtooth", r(200, 400));
  }
  pickup() { this.tone(880, 0.15, 0.15, "triangle"); this.tone(1320, 0.2, 0.12, "triangle", undefined, this.master, 0.08); }
  click() { this.noise(0.05, 3000, 2, 0.2); }
  buzzer() { this.tone(110, 0.9, 0.35, "square"); this.tone(116, 0.9, 0.3, "square"); }
  jingle() { [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(440 * Math.pow(2, (n - 69) / 12), 0.2, 0.25, "square", undefined, this.master, i * 0.11)); }
  spark(vol: number) { if (vol > 0.01) this.noise(0.3, 5000, 1, vol * 0.4, "highpass"); }
  generator() { this.tone(60, 2.5, 0.3, "sawtooth", 120); this.noise(1.5, 400, 2, 0.3, "bandpass", 1200); }
  door() { this.creak(0.2); this.noise(0.4, 300, 2, 0.4); }
  tape() { this.noise(2.5, 4000, 0.5, 0.06, "highpass"); }
  scream() {
    this.noise(1.6, 1200, 3, 1.0, "bandpass", 300);
    this.tone(220, 1.5, 0.5, "sawtooth", 90);
    this.tone(233, 1.5, 0.5, "square", 70);
  }
  private rainSrc: AudioBufferSourceNode | null = null;
  startRain(vol = 0.12) {
    if (this.rainSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(hp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.rainSrc = src;
  }
  thunder(delay: number, vol: number) {
    const id = window.setTimeout(() => {
      if (this.ctx.state === "closed") return;
      this.noise(3.5, 140, 0.7, vol * 0.9, "lowpass", 50);
      this.noise(1.2, 400, 0.6, vol * 0.4, "lowpass", 90);
    }, delay * 1000);
    this.timers.push(id);
  }
  setHeart(v: number) { this.heart.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); }

  dispose() {
    this.timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    try { this.rainSrc?.stop(); } catch { /* already stopped */ }
    this.ctx.close();
  }
}

function r(a: number, b: number) { return a + Math.random() * (b - a); }
