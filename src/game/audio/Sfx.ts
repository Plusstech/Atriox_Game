/**
 * Áudio 100% sintetizado em tempo real via WebAudio (sem arquivos, sem licenças de terceiros).
 * Substituível por samples definitivos no futuro mantendo a mesma API.
 */
type Wave = OscillatorType;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private music: { nodes: AudioNode[]; drumTimer: number | null; intensity: number; filter: BiquadFilterNode } | null = null;
  private volumes = { master: 0.8, music: 0.5, sfx: 0.9 };
  enabled = true;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Deve ser chamado a partir de um gesto do usuário (clique/tecla). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) {
          this.enabled = false;
          return;
        }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.enabled = false;
    }
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.7, t, 0.05);
  }

  private throttle(key: string, ms: number): boolean {
    if (!this.ready || !this.enabled) return false;
    const now = performance.now();
    const prev = this.last.get(key) ?? 0;
    if (now - prev < ms) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, slideTo?: number, delay = 0, bus?: GainNode): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    freq: number,
    slideTo?: number,
    q = 1,
    delay = 0,
    attack = 0.005
  ): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- combate
  swing(step: number): void {
    if (!this.throttle('swing', 40)) return;
    const heavy = step >= 2;
    this.noise(heavy ? 0.26 : 0.16, heavy ? 0.5 : 0.35, 'bandpass', heavy ? 700 : 1400, heavy ? 2600 : 4200, 1.4);
    if (heavy) this.tone(140, 0.25, 'sawtooth', 0.06, 70);
  }

  hit(heavy = false): void {
    if (!this.throttle('hit', 35)) return;
    this.tone(heavy ? 120 : 170, heavy ? 0.22 : 0.12, 'sine', heavy ? 0.7 : 0.45, 45);
    this.noise(heavy ? 0.2 : 0.09, heavy ? 0.55 : 0.4, 'lowpass', heavy ? 1800 : 3200, 300, 0.8);
    this.tone(heavy ? 900 : 1300, 0.05, 'square', 0.05, 600);
  }

  /** golpe defendido por escudo: estalo metálico curto */
  block(): void {
    if (!this.throttle('block', 60)) return;
    this.tone(1650, 0.09, 'square', 0.06, 1100);
    this.tone(2400, 0.06, 'triangle', 0.05, 1800);
    this.noise(0.08, 0.3, 'highpass', 3000, 1600, 0.9);
  }

  /** dialogo: letra revelada */
  blip(): void {
    if (!this.throttle('blip', 45)) return;
    this.tone(640, 0.03, 'triangle', 0.025, 560);
  }

  enemyAttack(): void {
    if (!this.throttle('enemyAttack', 60)) return;
    this.noise(0.14, 0.25, 'bandpass', 900, 2200, 1.2);
  }

  telegraph(big = false): void {
    if (!this.throttle('telegraph', 90)) return;
    this.tone(big ? 220 : 520, big ? 0.35 : 0.12, 'triangle', big ? 0.18 : 0.07, big ? 160 : 700);
  }

  playerHurt(): void {
    if (!this.throttle('playerHurt', 80)) return;
    this.tone(240, 0.22, 'sawtooth', 0.18, 90);
    this.noise(0.18, 0.4, 'lowpass', 1500, 200);
  }

  enemyDie(): void {
    if (!this.throttle('enemyDie', 50)) return;
    this.noise(0.4, 0.35, 'lowpass', 1200, 120, 0.7);
    this.tone(200, 0.35, 'triangle', 0.15, 60);
  }

  dash(): void {
    if (!this.throttle('dash', 50)) return;
    this.noise(0.2, 0.32, 'highpass', 900, 4800, 0.7);
    this.tone(500, 0.12, 'sine', 0.06, 1100);
  }

  castCharge(): void {
    if (!this.throttle('cast', 80)) return;
    this.tone(300, 0.25, 'sine', 0.12, 900);
    this.tone(450, 0.25, 'triangle', 0.06, 1350);
  }

  fireball(): void {
    if (!this.throttle('fireball', 60)) return;
    this.noise(0.35, 0.35, 'lowpass', 2400, 600, 1);
    this.tone(180, 0.3, 'sawtooth', 0.06, 90);
  }

  explosion(): void {
    if (!this.throttle('explosion', 50)) return;
    this.noise(0.7, 0.7, 'lowpass', 2600, 90, 0.6);
    this.tone(90, 0.5, 'sine', 0.6, 35);
  }

  arrow(): void {
    if (!this.throttle('arrow', 40)) return;
    this.tone(1200, 0.08, 'triangle', 0.06, 500);
    this.noise(0.1, 0.18, 'highpass', 2500, 6000);
  }

  slam(): void {
    if (!this.throttle('slam', 60)) return;
    this.tone(70, 0.6, 'sine', 0.8, 30);
    this.noise(0.5, 0.6, 'lowpass', 900, 80, 0.5);
  }

  bossRoar(): void {
    if (!this.throttle('roar', 300)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(70, t + 1.2);
    lfo.frequency.value = 18;
    lg.gain.value = 12;
    lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.5);
    lfo.stop(t + 1.5);
    this.noise(1.2, 0.3, 'bandpass', 400, 200, 0.8, 0, 0.1);
  }

  burnTick(): void {
    if (!this.throttle('burn', 120)) return;
    this.noise(0.08, 0.08, 'bandpass', 2500, 1500, 2);
  }

  heal(): void {
    if (!this.throttle('heal', 100)) return;
    this.tone(660, 0.18, 'sine', 0.08, 990);
    this.tone(990, 0.22, 'sine', 0.05, 1320, 0.06);
  }

  // ---------------------------------------------------------------- interface
  uiMove(): void {
    if (!this.throttle('uiMove', 40)) return;
    this.tone(880, 0.05, 'triangle', 0.05);
  }

  uiConfirm(): void {
    if (!this.throttle('uiConfirm', 60)) return;
    this.tone(523, 0.12, 'triangle', 0.1);
    this.tone(784, 0.18, 'triangle', 0.08, undefined, 0.07);
  }

  blessing(): void {
    if (!this.throttle('blessing', 200)) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.09, undefined, i * 0.07));
    this.noise(0.8, 0.08, 'highpass', 3000, 8000, 0.5, 0, 0.2);
  }

  waveStart(): void {
    if (!this.throttle('wave', 300)) return;
    this.tone(110, 0.9, 'sawtooth', 0.12, 104);
    this.tone(165, 0.9, 'sawtooth', 0.08, 156);
    this.noise(0.5, 0.25, 'lowpass', 400, 80, 0.5);
  }

  victory(): void {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 1.6, 'triangle', 0.1, undefined, i * 0.12));
  }

  defeat(): void {
    [220, 207, 196, 147].forEach((f, i) => this.tone(f, 1.4, 'sawtooth', 0.06, f * 0.98, i * 0.28));
  }

  // ---------------------------------------------------------------- música ambiente
  /** Drone sombrio procedural + tambor grave que acompanha a intensidade do combate. */
  startMusic(): void {
    if (!this.ready || this.music) return;
    const c = this.ctx!;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 3;
    const out = c.createGain();
    out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 3);
    filter.connect(out).connect(this.musicBus);
    const nodes: AudioNode[] = [filter, out];
    for (const [f, type, det] of [
      [55, 'sawtooth', 0],
      [55, 'sawtooth', 7],
      [82.4, 'triangle', -4],
      [110, 'sine', 3]
    ] as [number, Wave, number][]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = type === 'sawtooth' ? 0.12 : 0.18;
      o.connect(g).connect(filter);
      o.start();
      nodes.push(o, g);
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(filter.frequency);
    lfo.start();
    nodes.push(lfo, lg);
    this.music = { nodes, drumTimer: null, intensity: 0, filter };
    let beat = 0;
    this.music.drumTimer = window.setInterval(() => {
      if (!this.music || !this.ready) return;
      const k = this.music.intensity;
      beat++;
      if (k <= 0.05) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(80, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
      const accent = beat % 4 === 0 ? 1 : beat % 2 === 0 ? 0.6 : 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45 * k * accent + 0.0002, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.4);
    }, 430);
  }

  setIntensity(k: number): void {
    if (!this.music || !this.ctx) return;
    this.music.intensity = Math.max(0, Math.min(1, k));
    this.music.filter.frequency.setTargetAtTime(380 + 500 * this.music.intensity, this.ctx.currentTime, 0.8);
  }
}

export const Sfx = new SfxEngine();
