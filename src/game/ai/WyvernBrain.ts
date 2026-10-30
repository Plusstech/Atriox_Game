/**
 * IA da wyvern invocada (lógica pura).
 * materialize → fly ⇄ windup → charge → recovery → fly … ; dead.
 * - Não causa dano enquanto se materializa.
 * - A direção da investida é comprometida no meio do windup.
 * - A recuperação é longa o bastante para contra-atacar.
 */
export type WyvernState = 'materialize' | 'fly' | 'windup' | 'charge' | 'recovery' | 'dead';

export interface WyvernDef {
  hp: number;
  materializeMs: number;
  windupMs: number;
  /** fração do windup após a qual a direção trava */
  lockAt: number;
  chargeDistance: number;
  chargeSpeed: number;
  recoveryMs: number;
  flyMinMs: number;
  flyMaxMs: number;
  orbitMin: number;
  orbitMax: number;
  damage: number;
  hitRadius: number;
}

export const WYVERN: WyvernDef = {
  hp: 60,
  materializeMs: 750,
  windupMs: 700,
  lockAt: 0.55,
  chargeDistance: 470,
  chargeSpeed: 880,
  recoveryMs: 1000,
  flyMinMs: 1600,
  flyMaxMs: 2800,
  orbitMin: 250,
  orbitMax: 360,
  damage: 13,
  hitRadius: 30
};

export type WyvernEvent = 'flying' | 'windup' | 'lock' | 'charge' | 'recover';

export class WyvernBrain {
  state: WyvernState = 'materialize';
  timer = 0;
  locked = false;
  private flyFor: number;

  constructor(
    readonly def: WyvernDef = WYVERN,
    private readonly rng: () => number = Math.random
  ) {
    this.flyFor = this.rollFly();
  }

  get chargeMs(): number {
    return (this.def.chargeDistance / this.def.chargeSpeed) * 1000;
  }

  get harmful(): boolean {
    return this.state === 'charge';
  }

  get tangible(): boolean {
    return this.state !== 'materialize' && this.state !== 'dead';
  }

  get windupProgress(): number {
    return this.state === 'windup' ? Math.min(1, this.timer / this.def.windupMs) : 0;
  }

  private rollFly(): number {
    return this.def.flyMinMs + this.rng() * (this.def.flyMaxMs - this.def.flyMinMs);
  }

  kill(): void {
    this.state = 'dead';
  }

  update(dt: number): WyvernEvent[] {
    const ev: WyvernEvent[] = [];
    if (this.state === 'dead') return ev;
    this.timer += dt;
    switch (this.state) {
      case 'materialize':
        if (this.timer >= this.def.materializeMs) {
          this.set('fly');
          ev.push('flying');
        }
        break;
      case 'fly':
        if (this.timer >= this.flyFor) {
          this.set('windup');
          this.locked = false;
          ev.push('windup');
        }
        break;
      case 'windup':
        if (!this.locked && this.timer >= this.def.windupMs * this.def.lockAt) {
          this.locked = true;
          ev.push('lock');
        }
        if (this.timer >= this.def.windupMs) {
          this.set('charge');
          ev.push('charge');
        }
        break;
      case 'charge':
        if (this.timer >= this.chargeMs) {
          this.set('recovery');
          ev.push('recover');
        }
        break;
      case 'recovery':
        if (this.timer >= this.def.recoveryMs) {
          this.flyFor = this.rollFly();
          this.set('fly');
          ev.push('flying');
        }
        break;
    }
    return ev;
  }

  /** Interrompe a investida (bateu em parede). */
  endChargeEarly(): void {
    if (this.state === 'charge') this.set('recovery');
  }

  private set(s: WyvernState): void {
    this.state = s;
    this.timer = 0;
  }
}
