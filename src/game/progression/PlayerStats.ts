import type { StatKey } from '../../data/blessings';

export type StatBlock = Record<StatKey, number>;

export const BASE_STATS: StatBlock = {
  maxHp: 100,
  moveSpeed: 285,
  damageMul: 1,
  dashCooldownMul: 1,
  spellCooldownMul: 1,
  resist: 0
};

interface TimedMod {
  stat: StatKey;
  add: number;
  remaining: number;
}

/**
 * Atributos do jogador: base × multiplicadores + somas permanentes + bônus temporários.
 */
export class PlayerStats {
  private mul: Partial<StatBlock> = {};
  private add: Partial<StatBlock> = {};
  private timed: TimedMod[] = [];

  constructor(private readonly base: StatBlock = BASE_STATS) {}

  addPermanent(stat: StatKey, opts: { mul?: number; add?: number }): void {
    if (opts.mul !== undefined) this.mul[stat] = (this.mul[stat] ?? 1) * opts.mul;
    if (opts.add !== undefined) this.add[stat] = (this.add[stat] ?? 0) + opts.add;
  }

  /** Bônus temporário; reaplicar o mesmo atributo renova a duração em vez de acumular. */
  addTimed(stat: StatKey, add: number, duration: number): void {
    const existing = this.timed.find((t) => t.stat === stat && t.add === add);
    if (existing) existing.remaining = Math.max(existing.remaining, duration);
    else this.timed.push({ stat, add, remaining: duration });
  }

  hasTimed(stat: StatKey): boolean {
    return this.timed.some((t) => t.stat === stat);
  }

  update(dt: number): void {
    for (const t of this.timed) t.remaining -= dt;
    this.timed = this.timed.filter((t) => t.remaining > 0);
  }

  get(stat: StatKey): number {
    let v = this.base[stat] * (this.mul[stat] ?? 1) + (this.add[stat] ?? 0);
    for (const t of this.timed) if (t.stat === stat) v += t.add;
    // teto global de redução de dano: 60% (Pele de Luz e bênçãos respeitam)
    if (stat === 'resist') v = Math.min(0.6, Math.max(0, v));
    return v;
  }

  snapshot(): StatBlock {
    const out = {} as StatBlock;
    (Object.keys(this.base) as StatKey[]).forEach((k) => (out[k] = this.get(k)));
    return out;
  }
}
