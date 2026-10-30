import type { BossDef, BossMoveDef } from '../../data/bosses';

export type BossState = 'intro' | 'chase' | 'windup' | 'active' | 'recovery' | 'transition' | 'dead';

export type BossEvent =
  | { type: 'phaseChange'; phase: 2 }
  | { type: 'transitionEnd' }
  | { type: 'moveWindup'; move: BossMoveDef }
  | { type: 'moveActive'; move: BossMoveDef }
  | { type: 'moveEnd'; move: BossMoveDef };

/** IA do miniboss (lógica pura). RNG injetável para testes determinísticos. */
export class BossBrain {
  state: BossState = 'intro';
  phase: 1 | 2 = 1;
  timer = 0;
  move: BossMoveDef | null = null;
  private lastMove: string | null = null;
  private chaseTime = 0;

  constructor(
    private readonly def: BossDef,
    private readonly rng: () => number = Math.random
  ) {}

  get speedMul(): number {
    return this.phase === 2 ? this.def.phase2SpeedMul : 1;
  }

  get invulnerable(): boolean {
    return this.state === 'transition' || this.state === 'intro' || this.state === 'dead';
  }

  windupOf(m: BossMoveDef): number {
    return m.windup * (this.phase === 2 ? this.def.phase2WindupMul : 1);
  }

  recoveryOf(m: BossMoveDef): number {
    return m.recovery * (this.phase === 2 ? this.def.phase2RecoveryMul : 1);
  }

  get windupProgress(): number {
    if (this.state !== 'windup' || !this.move) return 0;
    return Math.min(1, this.timer / this.windupOf(this.move));
  }

  startFight(): void {
    if (this.state === 'intro') this.set('chase');
  }

  kill(): void {
    this.state = 'dead';
    this.move = null;
  }

  /** Escolhe um golpe válido para a distância atual (pesos, evitando repetir). */
  pickMove(distance: number): BossMoveDef | null {
    const options = this.def.moves.filter(
      (m) => m.phases.includes(this.phase) && distance >= m.minDist && distance <= m.maxDist
    );
    if (options.length === 0) return null;
    const weights = options.map((m) => (m.id === this.lastMove ? m.weight * 0.35 : m.weight));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng() * total;
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  update(dt: number, ctx: { distance: number; hpRatio: number }): BossEvent[] {
    const ev: BossEvent[] = [];
    if (this.state === 'dead' || this.state === 'intro') return ev;
    this.timer += dt;

    if (this.phase === 1 && ctx.hpRatio <= this.def.phase2Threshold && this.state !== 'transition') {
      this.phase = 2;
      this.move = null;
      this.set('transition');
      ev.push({ type: 'phaseChange', phase: 2 });
      return ev;
    }

    switch (this.state) {
      case 'transition':
        if (this.timer >= this.def.transitionDuration) {
          this.set('chase');
          ev.push({ type: 'transitionEnd' });
        }
        break;
      case 'chase': {
        this.chaseTime += dt;
        // pequena pausa entre golpes; após muito tempo perseguindo, força investida/inferno
        if (this.timer < 200) break;
        let m = this.pickMove(ctx.distance);
        if (!m && this.chaseTime > 2200) m = this.pickMove(this.def.moves.find((x) => x.id === 'charge')!.minDist + 1);
        if (m) {
          this.move = m;
          this.chaseTime = 0;
          this.set('windup');
          ev.push({ type: 'moveWindup', move: m });
        }
        break;
      }
      case 'windup':
        if (this.move && this.timer >= this.windupOf(this.move)) {
          this.set('active');
          ev.push({ type: 'moveActive', move: this.move });
        }
        break;
      case 'active':
        if (this.move && this.timer >= this.move.active) {
          this.set('recovery');
          ev.push({ type: 'moveEnd', move: this.move });
        }
        break;
      case 'recovery':
        if (this.move && this.timer >= this.recoveryOf(this.move)) {
          this.lastMove = this.move.id;
          this.move = null;
          this.set('chase');
        }
        break;
    }
    return ev;
  }

  private set(s: BossState): void {
    this.state = s;
    this.timer = 0;
  }
}
