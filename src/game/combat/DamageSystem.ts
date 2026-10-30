/** Regras de dano e vida, sem dependência de Phaser. */

export interface DamageModifiers {
  damageMul?: number;
  /** 0..0.9 — fração de dano ignorada */
  resist?: number;
}

export function computeDamage(base: number, mods: DamageModifiers = {}): number {
  const mul = mods.damageMul ?? 1;
  const resist = Math.min(0.9, Math.max(0, mods.resist ?? 0));
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * mul * (1 - resist)));
}

export class Health {
  current: number;

  constructor(public max: number) {
    this.current = max;
  }

  get dead(): boolean {
    return this.current <= 0;
  }

  get ratio(): number {
    return this.max > 0 ? Math.max(0, this.current) / this.max : 0;
  }

  /** Aplica dano e retorna quanto foi efetivamente perdido. */
  damage(amount: number): number {
    if (this.dead || amount <= 0) return 0;
    const before = this.current;
    this.current = Math.max(0, this.current - amount);
    return before - this.current;
  }

  heal(amount: number): number {
    if (this.dead || amount <= 0) return 0;
    const before = this.current;
    this.current = Math.min(this.max, this.current + amount);
    return this.current - before;
  }

  setMax(max: number, healDelta = true): void {
    const delta = max - this.max;
    this.max = max;
    if (healDelta && delta > 0) this.current += delta;
    this.current = Math.min(this.current, this.max);
  }
}
