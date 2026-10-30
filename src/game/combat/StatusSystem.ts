import type { Combatant } from '../entities/types';

interface Burn {
  target: Combatant & { burning?: boolean };
  dps: number;
  remaining: number;
  tick: number;
}

/** Efeitos de status contínuos (queimadura). Aplica dano via receiveHit com tag 'burn'. */
export class StatusSystem {
  private burns: Burn[] = [];
  static readonly TICK = 500;

  applyBurn(target: Combatant & { burning?: boolean }, dps: number, duration: number): void {
    if (!target.hurtbox.alive) return;
    const b = this.burns.find((x) => x.target === target);
    if (b) {
      b.dps = Math.max(b.dps, dps);
      b.remaining = Math.max(b.remaining, duration);
    } else {
      this.burns.push({ target, dps, remaining: duration, tick: 0 });
    }
    target.burning = true;
  }

  isBurning(target: Combatant): boolean {
    return this.burns.some((b) => b.target === target);
  }

  update(dt: number, onTick: (target: Combatant, damage: number) => void): void {
    for (const b of this.burns) {
      if (!b.target.hurtbox.alive) {
        b.remaining = 0;
        continue;
      }
      b.remaining -= dt;
      b.tick += dt;
      if (b.tick >= StatusSystem.TICK) {
        b.tick -= StatusSystem.TICK;
        onTick(b.target, Math.max(1, Math.round((b.dps * StatusSystem.TICK) / 1000)));
      }
    }
    for (const b of this.burns) if (b.remaining <= 0) b.target.burning = false;
    this.burns = this.burns.filter((b) => b.remaining > 0);
  }

  clear(): void {
    for (const b of this.burns) b.target.burning = false;
    this.burns = [];
  }
}
