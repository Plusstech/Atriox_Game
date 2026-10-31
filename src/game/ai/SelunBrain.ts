import { SELUN, type SelunMove } from '../../data/selun';

/**
 * IA do Sêlun (lógica pura, sem Phaser).
 *
 * - Relógio de COMBATE ATIVO: só avança em idle/golpe/postura/canalização. Pausa,
 *   diálogo, transição de fase, queda aparente e recomposição não contam.
 * - Fase decidida pelo TEMPO (45 s / 100 s), nunca pelo dano.
 * - Manifestação: vida zera → queda aparente → recomposição (evento próprio,
 *   NUNCA "chefe derrotado").
 * - Postura quebra fora de transições/execução; 2 s de janela, depois 3 s de proteção.
 * - Última Palavra aos 180 s: só começa com Sêlun livre (idle/recuperação) e o
 *   jogador fora de recuperação; contagem de 5 s; termina em execução.
 * - Morte do jogador tem precedência: stop() encerra tudo (uma transição terminal).
 */
export type SelunState =
  | 'intro'
  | 'idle'
  | 'windup'
  | 'active'
  | 'recovery'
  | 'stagger'
  | 'channel'
  | 'transition'
  | 'fallen'
  | 'recompose'
  | 'execution'
  | 'done';

export type SelunEvent =
  | { type: 'phase'; phase: number }
  | { type: 'windup'; move: SelunMove }
  | { type: 'strike'; move: SelunMove }
  | { type: 'decreeSeq'; index: number }
  | { type: 'recover'; move: SelunMove }
  | { type: 'channelComplete' }
  | { type: 'channelInterrupted' }
  | { type: 'staggered' }
  | { type: 'staggerEnd' }
  | { type: 'fallen' }
  | { type: 'recomposed'; count: number }
  | { type: 'gravity' }
  | { type: 'lastWord' }
  | { type: 'execute' };

const COUNTED: ReadonlySet<SelunState> = new Set(['idle', 'windup', 'active', 'recovery', 'stagger', 'channel']);

export interface SelunCtx {
  distance: number;
  /** jogador apto a sofrer a Última Palavra (sem recuperação/stun) */
  playerReady: boolean;
}

export class SelunBrain {
  state: SelunState = 'intro';
  timer = 0;
  activeMs = 0;
  phase = 1;
  move: SelunMove | null = null;
  posture: number = SELUN.posture;
  protectMs = 0;
  breaks = 0;
  recompositions = 0;
  /** próximos golpes do combo atual (cada um com o seu aviso) */
  queue: SelunMove[] = [];
  private gravityCd = 6000;
  private cycle = 0;

  constructor(private readonly rng: () => number = Math.random) {}

  /** recompõe a manifestação? (tangível) */
  get tangible(): boolean {
    return !['intro', 'transition', 'fallen', 'recompose', 'execution', 'done'].includes(this.state);
  }

  get canBreak(): boolean {
    return this.protectMs <= 0 && ['idle', 'windup', 'active', 'recovery', 'channel'].includes(this.state);
  }

  /** atacando agora (golpe, canalização) — durante a postura quebrada Sêlun não ataca */
  get attacking(): boolean {
    return this.state === 'windup' || this.state === 'active' || this.state === 'channel';
  }

  durations(m: SelunMove): { windup: number; active: number; recovery: number } {
    const M = SELUN.moves;
    switch (m) {
      case 'horizon':
        return { windup: M.horizon.windup, active: M.horizon.active, recovery: M.horizon.recovery };
      case 'sentence':
        return { windup: M.sentence.windup, active: M.sentence.active, recovery: M.sentence.recovery };
      case 'decree':
        return { windup: M.decree.windup, active: this.decreeSequences * (M.decree.announceMs + M.decree.gapMs), recovery: M.decree.recovery };
      case 'dash':
        return { windup: M.dash.windup, active: M.dash.active, recovery: M.dash.recovery };
      case 'channel':
        return { windup: M.channel.windup, active: M.channel.announceMs + 200, recovery: M.channel.recovery };
    }
  }

  get decreeSequences(): number {
    return this.phase >= 3 ? SELUN.moves.decree.sequences : 2;
  }

  get phaseForTime(): number {
    return this.activeMs >= SELUN.phase3At ? 3 : this.activeMs >= SELUN.phase2At ? 2 : 1;
  }

  /** segundos restantes até a Última Palavra (para a interface) */
  get untilLastWordMs(): number {
    return Math.max(0, SELUN.lastWordAt - this.activeMs);
  }

  start(): void {
    if (this.state === 'intro') this.set('idle');
  }

  /** Morte do jogador (ou saída): encerra sem novas transições. */
  stop(): void {
    this.state = 'done';
    this.queue = [];
    this.move = null;
  }

  /** Desgaste de postura. Retorna true se quebrou. */
  hitPosture(amount: number): SelunEvent[] {
    if (!this.canBreak || amount <= 0) return [];
    this.posture -= amount;
    if (this.posture > 0) return [];
    const ev: SelunEvent[] = [];
    if (this.state === 'channel') ev.push({ type: 'channelInterrupted' });
    this.posture = SELUN.posture;
    this.breaks++;
    this.queue = [];
    this.move = null;
    this.set('stagger');
    ev.push({ type: 'staggered' });
    return ev;
  }

  /** Manifestação zerou (chamado pela entidade). */
  manifestationBroken(): SelunEvent[] {
    if (!this.tangible) return [];
    this.queue = [];
    this.move = null;
    this.set('fallen');
    return [{ type: 'fallen' }];
  }

  update(dt: number, ctx: SelunCtx): SelunEvent[] {
    const ev: SelunEvent[] = [];
    if (this.state === 'intro' || this.state === 'done' || dt <= 0) return ev;
    this.timer += dt;
    if (COUNTED.has(this.state)) {
      this.activeMs += dt;
      this.protectMs = Math.max(0, this.protectMs - dt);
      this.gravityCd -= dt;
    }

    // Última Palavra: nunca em transição, queda, recomposição, golpe em curso ou com o jogador se recuperando
    if (
      this.activeMs >= SELUN.lastWordAt &&
      (this.state === 'idle' || (this.state === 'recovery' && this.timer > 120)) &&
      ctx.playerReady
    ) {
      this.queue = [];
      this.move = null;
      this.set('execution');
      ev.push({ type: 'lastWord' });
      return ev;
    }

    // troca de fase pelo tempo (entre golpes)
    const ph = this.phaseForTime;
    if (ph > this.phase && (this.state === 'idle' || this.state === 'recovery')) {
      this.phase = ph;
      this.queue = [];
      this.move = null;
      this.set('transition');
      ev.push({ type: 'phase', phase: ph });
      return ev;
    }

    switch (this.state) {
      case 'idle': {
        if (this.phase >= 3 && this.gravityCd <= 0) {
          this.gravityCd = 12_000;
          ev.push({ type: 'gravity' });
        }
        const gap = this.queue.length ? 260 : SELUN.gapMs[this.phase - 1];
        if (this.timer >= gap) this.begin(this.queue.shift() ?? this.pickCombo(ctx.distance), ev);
        break;
      }
      case 'windup': {
        const d = this.durations(this.move!);
        if (this.timer >= d.windup) {
          if (this.move === 'channel') {
            this.set('channel');
          } else {
            this.set('active');
            ev.push({ type: 'strike', move: this.move! });
          }
        }
        break;
      }
      case 'channel':
        if (this.timer >= SELUN.moves.channel.channelMs) {
          this.set('active');
          ev.push({ type: 'channelComplete' });
        }
        break;
      case 'active': {
        const m = this.move!;
        const d = this.durations(m);
        if (m === 'decree') {
          const step = SELUN.moves.decree.announceMs + SELUN.moves.decree.gapMs;
          const idx = Math.floor((this.timer - dt) / step);
          const now = Math.floor(this.timer / step);
          if (this.timer - dt <= 0) ev.push({ type: 'decreeSeq', index: 0 });
          for (let k = Math.max(1, idx + 1); k <= now && k < this.decreeSequences; k++) ev.push({ type: 'decreeSeq', index: k });
        }
        if (this.timer >= d.active) {
          this.set('recovery');
          ev.push({ type: 'recover', move: m });
        }
        break;
      }
      case 'recovery':
        if (this.timer >= this.durations(this.move!).recovery) {
          this.move = null;
          this.set('idle');
        }
        break;
      case 'stagger':
        if (this.timer >= SELUN.breakMs) {
          this.protectMs = SELUN.breakProtectMs;
          this.set('idle');
          ev.push({ type: 'staggerEnd' });
        }
        break;
      case 'transition':
        if (this.timer >= SELUN.transitionMs) this.set('idle');
        break;
      case 'fallen':
        if (this.timer >= SELUN.fallMs) this.set('recompose');
        break;
      case 'recompose':
        if (this.timer >= SELUN.recomposeMs) {
          this.recompositions++;
          this.set('idle');
          ev.push({ type: 'recomposed', count: this.recompositions });
        }
        break;
      case 'execution':
        if (this.timer >= SELUN.lastWordMs) {
          this.state = 'done';
          ev.push({ type: 'execute' });
        }
        break;
    }
    return ev;
  }

  private begin(m: SelunMove, ev: SelunEvent[]): void {
    this.move = m;
    this.set('windup');
    ev.push({ type: 'windup', move: m });
  }

  /**
   * Diretor: fase 1 golpes isolados; fase 2 combinações de 2 (Decreto entra);
   * fase 3 combinações de 3 e a canalização. O Decreto e a canalização nunca
   * se somam no mesmo combo (espaço seguro reservado).
   */
  private pickCombo(distance: number): SelunMove {
    this.cycle++;
    const pick = <T>(a: readonly T[]): T => a[Math.floor(this.rng() * a.length) % a.length];
    const melee: SelunMove = distance > 330 ? 'dash' : pick(['horizon', 'sentence'] as const);
    if (this.phase === 1) return this.cycle % 3 === 0 ? pick(['horizon', 'sentence', 'dash'] as const) : melee;
    if (this.phase === 2) {
      if (this.cycle % 3 === 0) return 'decree';
      this.queue = [distance > 330 ? 'horizon' : pick(['sentence', 'horizon'] as const)];
      return melee;
    }
    if (this.cycle % 4 === 0) return 'channel';
    if (this.cycle % 4 === 2) {
      this.queue = [pick(['horizon', 'sentence'] as const)];
      return 'decree';
    }
    // investida pode encadear o Horizonte (com novo aviso)
    this.queue = melee === 'dash' ? ['horizon', 'sentence'] : [pick(['dash', 'horizon'] as const), pick(['sentence', 'horizon'] as const)];
    return melee;
  }

  private set(s: SelunState): void {
    this.state = s;
    this.timer = 0;
  }
}
