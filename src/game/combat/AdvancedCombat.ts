import Phaser from 'phaser';
import { SKILLS } from '../../data/v03';
import type { ArenaScene } from '../scenes/ArenaScene';
import type { Combatant } from '../entities/types';
import type { ComboStepDef } from '../../data/attacks';
import { shapeHitsCircle } from './geometry';
/** Gift effects have one executor. Secondary hits never enter the basic-hit graph. */
export class AdvancedCombat {
  marks = new Map<number, { target: Combatant; ms: number }>();
  orbitMs = 0;
  echoMs = 0;
  forgeMs = 0;
  forgeCharges = 0;
  precise = false;
  sun: { x: number; y: number; ms: number; energy: number } | null = null;
  private echo: {
    ms: number;
    x: number;
    y: number;
    angle: number;
    damage: number;
    range: number;
  } | null = null;
  private dashRewarded = false;
  private lastAction = '';
  private rewardHits = new Set<string>();
  private gfx: Phaser.GameObjects.Graphics;
  constructor(private a: ArenaScene) {
    this.gfx = a.add.graphics().setDepth(190000);
  }
  reset(): void {
    this.marks.clear();
    this.orbitMs = this.echoMs = this.forgeMs = this.forgeCharges = 0;
    this.sun = null;
    this.echo = null;
    this.precise = false;
    this.gfx.clear();
    this.rewardHits.clear();
  }
  destroy(): void {
    this.reset();
    this.gfx.destroy();
  }
  level(id: Parameters<ArenaScene['build']['level']>[0]): number {
    return this.a.build.level(id);
  }
  power(id: Parameters<ArenaScene['build']['level']>[0]): number {
    return 1 + Math.max(0, this.level(id) - 1) * 0.25;
  }
  glory(action: string, amount: number): void {
    const p = this.a.player;
    const mul = p.gifts.has('glory_oath')
      ? (action === this.lastAction ? SKILLS.gloryRepeat : 1.65) *
        this.power('glory_oath')
      : 1;
    p.addGlory(amount * mul * (1 + p.altarGlory));
    this.lastAction = action;
  }
  onDash(): void {
    this.dashRewarded = false;
    this.precise = false;
    if (this.orbitMs > 0) {
      this.orbitMs = 0;
      this.a.player.skillAnim = 'orbit';
      this.a.player.skillAnimMs = 300;
      this.a.hitboxes.spawn({
        shape: {
          kind: 'circle',
          x: this.a.player.x,
          y: this.a.player.y,
          radius: 32,
        },
        team: 'player',
        damage:
          SKILLS.orbitDamage *
          this.power('orbit') *
          this.a.player.stats.get('damageMul'),
        knockback: 160,
        duration: 650,
        velocity: {
          x: Math.cos(this.a.player.aimAngle) * 800,
          y: Math.sin(this.a.player.aimAngle) * 800,
        },
        tag: 'orbit_blade',
      });
      const p = this.a.player;
      const img = this.a.add
        .image(p.x, p.y - 55, 'slash_3')
        .setScale(0.3)
        .setTint(0xffd77a)
        .setDepth(p.y + 5);
      this.a.tweens.add({
        targets: img,
        x: p.x + Math.cos(p.aimAngle) * 520,
        y: p.y - 55 + Math.sin(p.aimAngle) * 520,
        alpha: 0,
        duration: 650,
        onComplete: () => img.destroy(),
      });
    }
  }
  cast(): void {
    if (this.level('forge')) {
      this.forgeMs = SKILLS.forgeMs;
      this.forgeCharges = SKILLS.forgeCharges;
    }
  }
  attack(step: ComboStepDef, angle: number): { damage: number; range: number } {
    const p = this.a.player;
    let damage = step.damage;
    const forged = this.forgeCharges > 0 && this.forgeMs > 0;
    if (forged) {
      damage += SKILLS.forgeDamage + (this.level('forge') - 1) * 5;
      this.forgeCharges--;
      p.skillAnim = 'orbit';
      p.skillAnimMs = 240;
    }
    if (step.finisher && this.level('orbit')) this.orbitMs = SKILLS.orbitMs;
    if (step.finisher && this.level('execution_mark')) {
      p.skillAnim = 'execution_mark';
      p.skillAnimMs = 300;
    }
    if (this.echoMs > 0) {
      this.echoMs = 0;
      this.echo = {
        ms: SKILLS.echoDelay,
        x: p.x,
        y: p.y,
        angle,
        range: step.range,
        damage:
          damage *
          (this.level('second_step') > 1 ? 0.65 : SKILLS.echoDamage) *
          p.stats.get('damageMul'),
      };
    }
    return { damage, range: step.range + (forged ? 32 : 0) };
  }
  confirmed(c: Combatant, tag: string, damage: number): void {
    if (tag === 'attack_3' && this.level('execution_mark'))
      this.marks.set(c.hurtbox.id, { target: c, ms: SKILLS.markMs });
    if (tag === 'charged') {
      const m = this.marks.get(c.hurtbox.id);
      if (m) {
        this.marks.delete(c.hurtbox.id);
        this.blast(
          c.hurtbox.x,
          c.hurtbox.y,
          SKILLS.markRadius,
          SKILLS.markDamage * this.power('execution_mark'),
          'mark_explosion',
        );
      }
    }
    // One feed/resource grant per action and target; repeats are intentionally diminished.
    const key = `${tag}:${c.hurtbox.id}`;
    if (
      this.sun &&
      ['attack_1', 'attack_2', 'attack_3', 'charged', 'counter'].includes(
        tag,
      ) &&
      Phaser.Math.Distance.Between(
        this.a.player.x,
        this.a.player.y,
        this.sun.x,
        this.sun.y,
      ) <= SKILLS.sunRange
    )
      this.sun.energy = Math.min(SKILLS.sunMax, this.sun.energy + 1);
    if (damage > 0) {
      this.glory(tag, 3);
      this.rewardHits.add(key);
      if (this.rewardHits.size > 300) this.rewardHits.clear();
    }
  }
  captive(): void {
    const p = this.a.player;
    if (!this.level('captive_sun')) return;
    if (this.sun) {
      const s = this.sun;
      this.sun = null;
      this.blast(
        s.x,
        s.y,
        SKILLS.sunRadius,
        (SKILLS.sunDamage + s.energy * SKILLS.sunPerFeed) *
          this.power('captive_sun'),
        'captive_explosion',
      );
    } else
      this.sun = {
        x: p.x + Math.cos(p.aimAngle) * 100,
        y: p.y + Math.sin(p.aimAngle) * 100,
        ms: SKILLS.sunMs,
        energy: 0,
      };
    p.skillAnim = 'captive_sun';
    p.skillAnimMs = 430;
  }
  private blast(
    x: number,
    y: number,
    radius: number,
    damage: number,
    tag: string,
  ): void {
    this.a.hitboxes.spawn({
      shape: { kind: 'circle', x, y, radius },
      team: 'player',
      damage: damage * this.a.player.stats.get('damageMul'),
      knockback: 180,
      duration: 100,
      tag,
      meta: { heavy: true, hitstop: 40 },
    });
    this.a.effects.explosion(x, y, radius);
  }
  update(dt: number): void {
    const p = this.a.player;
    this.orbitMs = Math.max(0, this.orbitMs - dt);
    this.echoMs = Math.max(0, this.echoMs - dt);
    this.forgeMs = Math.max(0, this.forgeMs - dt);
    if (this.sun) {
      this.sun.ms -= dt;
      if (this.sun.ms <= 0) this.sun = null;
    }
    for (const [id, m] of this.marks) {
      m.ms -= dt;
      if (m.ms <= 0 || !m.target.hurtbox.alive) this.marks.delete(id);
    }
    if (this.echo) {
      this.echo.ms -= dt;
      if (this.echo.ms <= 0) {
        const e = this.echo;
        this.echo = null;
        this.a.hitboxes.spawn({
          shape: {
            kind: 'sector',
            x: e.x,
            y: e.y,
            radius: e.range,
            angle: e.angle,
            halfArc: 1.2,
          },
          team: 'player',
          damage: e.damage,
          knockback: 60,
          duration: 90,
          tag: 'solar_echo',
        });
        this.a.effects.afterimage(p.sprite, 0xffd77a);
        this.a.effects.slash(e.x, e.y - 40, e.angle, 'slash_3', e.range, {
          tint: 0xffd77a,
          duration: 180,
        });
      }
    }
    if (
      p.dash.invulnerable &&
      p.dash.elapsed <= SKILLS.preciseMs &&
      !this.dashRewarded
    ) {
      const threat = this.a.hitboxes.all.some(
        (b) =>
          b.active &&
          b.spec.team === 'enemy' &&
          shapeHitsCircle(
            b.spec.shape,
            p.x,
            p.y,
            p.radius + SKILLS.preciseMargin,
          ),
      );
      if (threat) {
        this.dashRewarded = true;
        this.precise = true;
        if (this.level('second_step')) {
          this.echoMs = SKILLS.echoMs;
          p.skillAnim = 'second_step';
          p.skillAnimMs = 300;
        }
        this.glory('precise_dash', 12);
        this.a.ui()?.toast('Esquiva precisa!');
      }
    }
    const g = this.gfx;
    g.clear();
    if (p.advanced.charging) {
      g.lineStyle(
        4,
        p.advanced.heldMs >= SKILLS.chargePerfect - 130 &&
          p.advanced.heldMs <= SKILLS.chargePerfect + 130
          ? 0xffffff
          : 0xffcc55,
        1,
      );
      g.beginPath();
      g.arc(
        p.x,
        p.y,
        37,
        -Math.PI / 2,
        -Math.PI / 2 +
          Math.PI * 2 * Math.min(1, p.advanced.heldMs / SKILLS.chargeMax),
      );
      g.strokePath();
    }
    if (this.orbitMs > 0) {
      const t = this.a.time.now / 180;
      g.lineStyle(4, 0xffd77a, 0.9);
      g.lineBetween(
        p.x + Math.cos(t) * 65,
        p.y - 40 + Math.sin(t) * 28,
        p.x + Math.cos(t) * 65 + 14,
        p.y - 65 + Math.sin(t) * 28,
      );
    }
    if (this.sun) {
      g.fillStyle(0xffcf55, 0.45);
      g.fillCircle(this.sun.x, this.sun.y - 40, 18 + this.sun.energy * 2);
      g.lineStyle(2, 0xffd77a, 0.8);
      g.strokeCircle(this.sun.x, this.sun.y, SKILLS.sunRadius);
    }
    for (const m of this.marks.values()) {
      g.lineStyle(2, 0xffc060, 0.9);
      g.strokeCircle(m.target.hurtbox.x, m.target.hurtbox.y - 95, 13);
      g.lineBetween(
        m.target.hurtbox.x - 7,
        m.target.hurtbox.y - 95,
        m.target.hurtbox.x + 7,
        m.target.hurtbox.y - 95,
      );
      g.lineStyle(3, 0xffc060, 1);
      g.lineBetween(
        m.target.hurtbox.x - 14,
        m.target.hurtbox.y - 113,
        m.target.hurtbox.x - 14 + (28 * m.ms) / SKILLS.markMs,
        m.target.hurtbox.y - 113,
      );
    }
  }
  summary(): string {
    return [
      this.orbitMs > 0 ? `Lâmina ${Math.ceil(this.orbitMs / 1000)}s` : '',
      this.echoMs > 0 ? `Eco ${Math.ceil(this.echoMs / 1000)}s` : '',
      this.forgeMs > 0
        ? `Forja ${this.forgeCharges} cortes / ${Math.ceil(this.forgeMs / 1000)}s`
        : '',
      this.sun
        ? `Sol ${this.sun.energy}/${SKILLS.sunMax} · ${Math.ceil(this.sun.ms / 1000)}s · R detonar`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
