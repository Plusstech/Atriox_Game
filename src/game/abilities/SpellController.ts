import type { SpellDef } from '../../data/abilities';
import { Cooldown } from '../systems/Cooldown';

export type SpellEvent = 'castStart' | 'release';

/**
 * Lógica de uma magia com tempo de conjuração e cooldown.
 * O que acontece no "release" é responsabilidade de quem consome o evento
 * (ex.: JudgmentFlame cria o projétil e os efeitos).
 */
export class SpellController {
  casting = false;
  elapsed = 0;
  readonly cooldown: Cooldown;

  constructor(public def: SpellDef) {
    this.cooldown = new Cooldown(def.cooldown);
  }

  tryCast(cooldownMul = 1): boolean {
    if (this.casting || !this.cooldown.ready) return false;
    this.casting = true;
    this.elapsed = 0;
    this.cooldown.trigger(cooldownMul);
    return true;
  }

  cancel(): void {
    this.casting = false;
  }

  update(dt: number): SpellEvent[] {
    this.cooldown.update(dt);
    if (!this.casting) return [];
    this.elapsed += dt;
    if (this.elapsed >= this.def.castTime) {
      this.casting = false;
      return ['release'];
    }
    return [];
  }
}
