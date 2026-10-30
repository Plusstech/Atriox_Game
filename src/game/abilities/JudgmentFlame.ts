import type { SpellDef } from '../../data/abilities';
import type { HitboxSystem } from '../combat/HitboxSystem';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { Effects } from '../fx/Effects';
import { Sfx } from '../audio/Sfx';

export interface SpellContext {
  hitboxes: HitboxSystem;
  projectiles: ProjectileSystem;
  effects: Effects;
  damageMul(): number;
  /** chamado no ponto de explosão (gatilho das bênçãos "spellImpact") */
  onImpact(x: number, y: number): void;
}

/**
 * Executor da Chama do Julgamento: projétil de luz solar que explode em área.
 * Lógica de tempo/cooldown fica no SpellController; aqui só a manifestação.
 * Novas magias implementam a mesma assinatura `cast(x, y, angle)`.
 */
export class JudgmentFlame {
  constructor(
    private readonly def: SpellDef,
    private readonly ctx: SpellContext
  ) {}

  /** Brilho de preparação na mão de Atriox. */
  charge(x: number, y: number): void {
    Sfx.castCharge();
    this.ctx.effects.telegraphPulse(x, y, 0xffd77a);
    this.ctx.effects.embersAt(x, y, 6);
  }

  cast(x: number, y: number, angle: number): void {
    const d = this.def;
    Sfx.fireball();
    this.ctx.effects.hitSpark(x + Math.cos(angle) * 30, y - 46 + Math.sin(angle) * 30, angle, false, 0xffc060);
    this.ctx.projectiles.fire({
      x: x + Math.cos(angle) * 26,
      y: y + Math.sin(angle) * 26,
      angle,
      speed: d.projectileSpeed,
      range: d.projectileRange,
      radius: d.projectileRadius,
      team: 'player',
      texture: 'fireball',
      height: 46,
      additive: true,
      scale: 0.75,
      trail: { texture: 'p_ember', tint: 0xffa040, frequency: 12, scale: 2.2, lifespan: 320 },
      onHit: (t) => {
        this.ctx.hitboxes.spawn({
          shape: { kind: 'circle', x: t.x, y: t.y, radius: 1 },
          team: 'player',
          damage: d.directDamage * this.ctx.damageMul(),
          knockback: 120,
          duration: 1,
          tag: 'spell_direct',
          knockbackDir: { x: Math.cos(angle), y: Math.sin(angle) }
        });
        return true;
      },
      onEnd: (ex, ey) => this.explode(ex, ey)
    });
  }

  private explode(x: number, y: number): void {
    const d = this.def;
    this.ctx.hitboxes.spawn({
      shape: { kind: 'circle', x, y, radius: d.explosionRadius },
      team: 'player',
      damage: d.explosionDamage * this.ctx.damageMul(),
      knockback: d.knockback,
      duration: 60,
      tag: 'spell_explosion',
      meta: { heavy: true }
    });
    this.ctx.effects.explosion(x, y, d.explosionRadius);
    this.ctx.effects.shake(180, 0.006);
    Sfx.explosion();
    this.ctx.onImpact(x, y);
  }
}
