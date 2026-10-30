import { BLESSINGS, type BlessingAction, type BlessingDef, type BlessingTrigger } from '../../data/blessings';
import type { PlayerStats } from './PlayerStats';

/**
 * Bênçãos possuídas e despacho de gatilhos.
 * O sistema não sabe o que cada bênção "faz": apenas aplica atributos
 * e devolve ações para o executor da cena.
 */
export class BlessingSystem {
  readonly owned: BlessingDef[] = [];
  private icd = new Map<string, number>();

  constructor(
    private readonly stats: PlayerStats,
    private readonly pool: BlessingDef[] = BLESSINGS
  ) {}

  has(id: string): boolean {
    return this.owned.some((b) => b.id === id);
  }

  /** Sorteia até `count` bênçãos distintas ainda não obtidas. */
  rollOffer(rng: () => number = Math.random, count = 3): BlessingDef[] {
    const available = this.pool.filter((b) => !this.has(b.id));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available.slice(0, count);
  }

  grant(def: BlessingDef): boolean {
    if (this.has(def.id)) return false;
    this.owned.push(def);
    for (const e of def.effects) {
      if (e.type === 'stat') this.stats.addPermanent(e.stat, { mul: e.mul, add: e.add });
    }
    return true;
  }

  update(dt: number): void {
    for (const [k, v] of this.icd) {
      const nv = v - dt;
      if (nv <= 0) this.icd.delete(k);
      else this.icd.set(k, nv);
    }
  }

  /** Retorna as ações disparadas por um evento de combate. */
  trigger(on: BlessingTrigger): { blessing: BlessingDef; action: BlessingAction }[] {
    const out: { blessing: BlessingDef; action: BlessingAction }[] = [];
    for (const b of this.owned) {
      b.effects.forEach((e, i) => {
        if (e.type !== 'trigger' || e.on !== on) return;
        const key = `${b.id}:${i}`;
        if (this.icd.has(key)) return;
        if (e.icd) this.icd.set(key, e.icd);
        out.push({ blessing: b, action: e.action });
      });
    }
    return out;
  }
}
