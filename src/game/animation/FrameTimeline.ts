/**
 * Linha do tempo de animação por quadros (lógica pura, sem Phaser).
 *
 * - Duração individual por quadro.
 * - Marcadores (`event`) disparados quando o quadro começa.
 * - Fases (`phase`) para sincronizar golpes com a lógica de combate:
 *   o combate diz "estou na fase X com progresso t" e a timeline escolhe o quadro.
 * - `play()` com a mesma animação NÃO reinicia (corrida contínua).
 */
export type AnimPhase = 'windup' | 'active' | 'recovery';

export interface AnimFrame {
  name: string;
  /** duração em ms (modo livre) ou peso relativo dentro da fase (modo sincronizado) */
  ms: number;
  phase?: AnimPhase;
  event?: string;
}

export interface AnimDef {
  key: string;
  frames: AnimFrame[];
  loop: boolean;
}

export interface TimelineEvent {
  type: 'frame' | 'complete' | 'loop';
  frame?: AnimFrame;
  index?: number;
}

export class FrameTimeline {
  def: AnimDef | null = null;
  index = 0;
  /** tempo dentro do quadro atual */
  t = 0;
  /** tempo total desde play() */
  elapsed = 0;
  done = false;
  private synced = false;

  get frame(): AnimFrame | null {
    return this.def ? this.def.frames[this.index] : null;
  }

  get key(): string | null {
    return this.def?.key ?? null;
  }

  /** Inicia uma animação. Se já estiver tocando a mesma, mantém o progresso (salvo `restart`). */
  play(def: AnimDef, restart = false): TimelineEvent[] {
    if (!restart && this.def && this.def.key === def.key && !this.done) return [];
    this.def = def;
    this.index = 0;
    this.t = 0;
    this.elapsed = 0;
    this.done = false;
    this.synced = false;
    return [{ type: 'frame', frame: def.frames[0], index: 0 }];
  }

  /** Avança no modo livre. `rate` multiplica a velocidade (cadência da corrida). */
  update(dt: number, rate = 1): TimelineEvent[] {
    const ev: TimelineEvent[] = [];
    const d = this.def;
    if (!d || this.done || this.synced) return ev;
    this.t += dt * rate;
    this.elapsed += dt * rate;
    for (let guard = 0; guard < 64; guard++) {
      const f = d.frames[this.index];
      if (this.t < f.ms) break;
      this.t -= f.ms;
      if (this.index + 1 < d.frames.length) {
        this.index++;
        ev.push({ type: 'frame', frame: d.frames[this.index], index: this.index });
      } else if (d.loop) {
        this.index = 0;
        ev.push({ type: 'loop' });
        ev.push({ type: 'frame', frame: d.frames[0], index: 0 });
      } else {
        this.t = f.ms;
        this.done = true;
        ev.push({ type: 'complete' });
        break;
      }
    }
    return ev;
  }

  /**
   * Modo sincronizado: escolhe o quadro pela fase e progresso 0..1 informados
   * pela lógica de combate (o dano acontece no início da fase 'active').
   */
  sync(phase: AnimPhase, progress: number): TimelineEvent[] {
    const d = this.def;
    if (!d) return [];
    this.synced = true;
    const idx = FrameTimeline.frameForPhase(d, phase, progress);
    if (idx === this.index) return [];
    this.index = idx;
    return [{ type: 'frame', frame: d.frames[idx], index: idx }];
  }

  static frameForPhase(d: AnimDef, phase: AnimPhase, progress: number): number {
    const ids = d.frames.map((f, i) => (f.phase === phase ? i : -1)).filter((i) => i >= 0);
    if (ids.length === 0) {
      // sem quadros nessa fase: usa o último quadro da fase anterior disponível
      const order: AnimPhase[] = ['windup', 'active', 'recovery'];
      for (let k = order.indexOf(phase) - 1; k >= 0; k--) {
        const prev = d.frames.map((f, i) => (f.phase === order[k] ? i : -1)).filter((i) => i >= 0);
        if (prev.length) return prev[prev.length - 1];
      }
      return 0;
    }
    const total = ids.reduce((s, i) => s + d.frames[i].ms, 0);
    let acc = 0;
    const p = Math.min(0.9999, Math.max(0, progress)) * total;
    for (const i of ids) {
      acc += d.frames[i].ms;
      if (p < acc) return i;
    }
    return ids[ids.length - 1];
  }

  /** Duração total (modo livre). */
  static duration(d: AnimDef): number {
    return d.frames.reduce((s, f) => s + f.ms, 0);
  }
}
