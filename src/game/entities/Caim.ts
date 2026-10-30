import { CaimDefense } from '../ai/CaimDefense';
import { FINAL_BOSS } from '../../data/v03';
import Phaser from 'phaser';
import { CAIM } from '../../data/bosses';
import { CaimBrain, type CaimAction } from '../ai/CaimBrain';
import { Health } from '../combat/DamageSystem';
import type {
  ActiveHitbox,
  HitboxSystem,
  Hurtbox,
} from '../combat/HitboxSystem';
import type { BloodPoolSystem } from '../combat/Blood';
import { degToRad, length, normalize } from '../combat/geometry';
import type { Effects } from '../fx/Effects';
import { CAIM_SCALE, DEPTH, FLOOR } from '../config/constants';
import { SpriteAnimator, type AnimLibrary } from '../animation/SpriteAnimator';
import { Sfx } from '../audio/Sfx';
import {
  newEntityId,
  type CollideFn,
  type Combatant,
  type HitInfo,
} from './types';

export interface CaimContext {
  hitboxes: HitboxSystem;
  effects: Effects;
  collide: CollideFn;
  pools: BloodPoolSystem;
  wyvernCount(): number;
  spawnWyvern(x: number, y: number): void;
  onPhase2(): void;
  onDeath(): void;
  onDamaged(amount: number): void;
}

const CLAW = {
  radius: 118,
  arcDeg: 130,
  damage: 14,
  knockback: 300,
  lunge: 46,
};

/** Caim Morvaigne — chefe da Arena de Nemeia. */
export class Caim implements Combatant {
  private visuals: Phaser.GameObjects.GameObject[] = [];
  readonly defense = new CaimDefense();
  private volleyCd = 2800;
  readonly id = newEntityId();
  readonly brain: CaimBrain;
  readonly health: Health;
  readonly hurtbox: Hurtbox;
  readonly name = CAIM.name;
  readonly title = CAIM.title;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  facing = -1;
  private aim = 0;
  private strafe = 1;
  private strafeT = 0;
  private blinkTarget = { x: 0, y: 0 };
  private flash = 0;
  private owned: ActiveHitbox[] = [];
  removed = false;
  /** introdução roteirizada */
  scripted = true;
  private readonly anim: SpriteAnimator;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Graphics;
  private aura: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    lib: AnimLibrary,
    x: number,
    y: number,
    private readonly ctx: CaimContext,
    rng: () => number = Math.random,
  ) {
    this.x = x;
    this.y = y;
    this.brain = new CaimBrain(CAIM, rng);
    this.health = new Health(CAIM.hp);
    this.hurtbox = {
      id: this.id,
      team: 'enemy',
      x,
      y,
      radius: CAIM.radius + 4,
      alive: true,
      invulnerable: true,
    };
    this.shadow = scene.add
      .image(x, y, 'shadow')
      .setDepth(DEPTH.shadow)
      .setDisplaySize(84, 26);
    this.telegraph = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.anim = new SpriteAnimator(scene, lib, 'caim', x, y, 'caim.idle');
    this.anim.sprite.setScale(CAIM_SCALE);
    this.aura = scene.add.particles(0, 0, 'p_blood', {
      x: { min: -26, max: 26 },
      y: { min: -10, max: 4 },
      speedY: { min: -40, max: -10 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      frequency: 90,
    });
    this.aura.setDepth(DEPTH.groundFx + 3);
  }

  get dead(): boolean {
    return this.brain.dead;
  }

  get hpRatio(): number {
    return this.health.ratio;
  }

  get chestY(): number {
    return this.y - 75;
  }

  /** Introdução: caminha até o ponto. */
  walkTo(x: number, y: number, dt: number): boolean {
    const d = length(x - this.x, y - this.y);
    if (d < 4) {
      this.anim.play('caim.idle');
      this.anim.update(dt);
      this.sync(dt);
      return true;
    }
    const n = normalize(x - this.x, y - this.y);
    this.x += n.x * 150 * (dt / 1000);
    this.y += n.y * 150 * (dt / 1000);
    this.facing = n.x >= 0 ? 1 : -1;
    this.anim.play('caim.run');
    this.anim.update(dt);
    this.sync(dt);
    return false;
  }

  startFight(): void {
    this.scripted = false;
    this.brain.start();
  }

  update(dt: number, player: { x: number; y: number; dead: boolean }): void {
    this.visuals = this.visuals.filter((v) => !!v.scene);
    if (this.removed || this.scripted) return;
    if (this.dead) {
      this.anim.update(dt);
      this.sync(dt);
      return;
    }
    const distance = length(player.x - this.x, player.y - this.y);
    const defenseEvent = this.defense.update(
      dt,
      distance,
      this.brain.phase,
      this.ctx.wyvernCount() + this.ctx.pools.liveCount,
      this.brain.state === 'reposition',
    );
    if (defenseEvent === 'wave') {
      this.ctx.effects.shockRing(
        this.x,
        this.y,
        FINAL_BOSS.waveRadius,
        0xff3040,
        220,
      );
      this.ctx.hitboxes.spawn({
        shape: {
          kind: 'circle',
          x: this.x,
          y: this.y,
          radius: FINAL_BOSS.waveRadius,
        },
        team: 'enemy',
        damage: FINAL_BOSS.waveDamage,
        knockback: 180,
        duration: 130,
        tag: 'caim_servitude',
      });
    }
    if (defenseEvent === 'ritualComplete') {
      this.ctx.pools.rules.maxActive = FINAL_BOSS.poolMax[this.brain.phase - 1];
      for (const ang of [0, Math.PI])
        this.ctx.pools.spawn(
          player.x + Math.cos(ang) * 300,
          player.y + Math.sin(ang) * 300,
          FINAL_BOSS.poolRadius,
        );
    }
    if (this.defense.mode !== 'none') {
      this.cancelAttacksForDefense();
      this.anim.play(
        this.defense.mode === 'ritual' ? 'caim.summon' : 'caim.pool',
      );
      this.anim.update(dt);
      this.telegraph.clear();
      const wave = this.defense.mode === 'rupture';
      this.telegraph.lineStyle(3, wave ? 0xffe0c0 : 0xff3040, 0.9);
      this.telegraph.strokeCircle(
        this.x,
        this.y,
        wave ? FINAL_BOSS.waveRadius : 65,
      );

      this.sync(dt);
      return;
    }
    this.volleyCd -= dt;
    // The volley has a committed direction, delayed hitbox, visible line, and no full-arena spread.
    if (
      this.volleyCd <= 0 &&
      this.brain.state === 'reposition' &&
      this.ctx.wyvernCount() <= 1 &&
      this.ctx.pools.liveCount < 3
    ) {
      this.volleyCd = this.brain.phase >= 2 ? 3400 : 4800;
      const aim = Math.atan2(player.y - this.y, player.x - this.x);
      for (const offset of this.brain.phase >= 2 ? [-0.2, 0, 0.2] : [0]) {
        const angle = aim + offset,
          x = this.x,
          y = this.y;
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'circle', x, y, radius: 17 },
            team: 'enemy',
            damage: FINAL_BOSS.volleyDamage,
            knockback: 100,
            delay: 750,
            duration: 1600,
            velocity: { x: Math.cos(angle) * 360, y: Math.sin(angle) * 360 },
            tag: 'caim_infected',
          }),
        );
        const g = this.scene.add.graphics().setDepth(DEPTH.telegraph);
        g.lineStyle(2, 0xff4050, 0.5);
        g.lineBetween(
          x,
          y,
          x + Math.cos(angle) * 570,
          y + Math.sin(angle) * 570,
        );
        const orb = this.scene.add
          .image(x, y - 35, 'blessing_orb')
          .setScale(0.28)
          .setTint(0xff3040)
          .setDepth(y + 5);
        this.visuals.push(g, orb);
        this.scene.tweens.add({
          targets: orb,
          x: x + Math.cos(angle) * 576,
          y: y - 35 + Math.sin(angle) * 576,
          delay: 750,
          duration: 1600,
          onStart: () => g.destroy(),
          onComplete: () => orb.destroy(),
        });
        this.scene.time.delayedCall(2400, () => g.destroy());
      }
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = player.dead ? 9999 : length(dx, dy);
    const toP = Math.atan2(dy, dx);
    const canPool =
      this.ctx.pools.canPlace(player.x, player.y) ||
      this.ctx.pools.liveCount < this.ctx.pools.rules.maxActive;

    for (const ev of this.brain.update(dt, {
      distance: dist,
      hpRatio: this.health.ratio,
      wyverns: this.ctx.wyvernCount(),
      canPool,
    })) {
      if (ev.type === 'windup') this.beginWindup(ev.action, toP, player);
      else if (ev.type === 'cast') this.cast(ev.action, player);
      else if (ev.type === 'end') this.endAction(ev.action);
      else if (ev.type === 'phase2') this.enterPhase2();
    }

    // ---------------- movimento
    let tvx = 0;
    let tvy = 0;
    const st = this.brain.state;
    if (st === 'reposition') {
      const n = normalize(dx, dy);
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 1400 + Math.random() * 1200;
        this.strafe *= -1;
      }
      let radial = 0;
      if (dist < CAIM.preferredMin) radial = -1;
      else if (dist > CAIM.preferredMax) radial = 1;
      const sp = CAIM.speed * (this.brain.phase >= 2 ? 1.15 : 1);
      tvx = (n.x * radial - n.y * this.strafe * 0.7) * sp;
      tvy = (n.y * radial + n.x * this.strafe * 0.7) * sp;
      this.facing = dx >= 0 ? 1 : -1;
    } else if (st === 'cast' && this.brain.action === 'blink') {
      const n = normalize(
        this.blinkTarget.x - this.x,
        this.blinkTarget.y - this.y,
      );
      const d = length(
        this.blinkTarget.x - this.x,
        this.blinkTarget.y - this.y,
      );
      const sp = Math.min(
        1100,
        (d / Math.max(16, CAIM.cast.blink - this.brain.timer)) * 1000,
      );
      tvx = n.x * sp;
      tvy = n.y * sp;
    }
    const k = st === 'cast' ? 1 : Math.min(1, dt / 120);
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;
    const r = this.ctx.collide(
      this.x + (this.vx * dt) / 1000,
      this.y + (this.vy * dt) / 1000,
      CAIM.radius,
    );
    this.x = r.x;
    this.y = r.y;

    // ---------------- animação (estados → animações; ações sincronizadas pela fase)
    const a = this.brain.action;
    if (st === 'reposition')
      this.anim.play(length(this.vx, this.vy) > 40 ? 'caim.run' : 'caim.idle');
    else if (st === 'reaction') this.anim.play('caim.reaction');
    else if (a) {
      this.anim.play(`caim.${a}`);
      const total =
        st === 'windup'
          ? CAIM.windup[a]
          : st === 'cast'
            ? CAIM.cast[a]
            : CAIM.recovery[a];
      const phase =
        st === 'windup' ? 'windup' : st === 'cast' ? 'active' : 'recovery';
      this.anim.sync(phase, this.brain.timer / total);
    }
    if (st === 'reposition' || st === 'reaction') this.anim.update(dt);

    this.drawTelegraph(player);
    this.sync(dt);
  }

  private beginWindup(
    a: CaimAction,
    toP: number,
    player: { x: number; y: number },
  ): void {
    this.aim = toP;
    this.facing = Math.cos(toP) >= 0 ? 1 : -1;
    this.vx *= 0.2;
    this.vy *= 0.2;
    if (a === 'claw') {
      Sfx.telegraph(false);
      this.ctx.effects.telegraphPulse(this.x, this.chestY, 0xd01a2a);
    } else if (a === 'blink') {
      // salta para longe do jogador, dentro da arena
      const away =
        Math.atan2(this.y - player.y, this.x - player.x) +
        (Math.random() - 0.5) * 1.4;
      const d = CAIM.preferredMax;
      this.blinkTarget = {
        x: Phaser.Math.Clamp(
          player.x + Math.cos(away) * d,
          FLOOR.x + 80,
          FLOOR.x + FLOOR.w - 80,
        ),
        y: Phaser.Math.Clamp(
          player.y + Math.sin(away) * d,
          FLOOR.y + 80,
          FLOOR.y + FLOOR.h - 80,
        ),
      };
    } else {
      Sfx.telegraph(a === 'summon');
      this.ctx.effects.telegraphPulse(this.x, this.chestY - 20, 0xb0101a);
    }
  }

  private cast(a: CaimAction, player: { x: number; y: number }): void {
    const pools = this.ctx.pools;
    switch (a) {
      case 'pool': {
        // poça no jogador; se não couber, tenta pontos próximos — nunca sobrepõe poças existentes
        const tries: [number, number][] = [[0, 0]];
        for (let i = 0; i < 8; i++)
          tries.push([
            Math.cos((i / 8) * Math.PI * 2) * 140,
            Math.sin((i / 8) * Math.PI * 2) * 140,
          ]);
        for (const [ox, oy] of tries) {
          const px = Phaser.Math.Clamp(
            player.x + ox,
            FLOOR.x + 100,
            FLOOR.x + FLOOR.w - 100,
          );
          const py = Phaser.Math.Clamp(
            player.y + oy,
            FLOOR.y + 100,
            FLOOR.y + FLOOR.h - 100,
          );
          if (pools.spawn(px, py)) break;
        }
        Sfx.fireball();
        break;
      }
      case 'eruption': {
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < 3; i++) {
          const ang = base + (i / 3) * Math.PI * 2;
          const px = Phaser.Math.Clamp(
            player.x + Math.cos(ang) * 250,
            FLOOR.x + 100,
            FLOOR.x + FLOOR.w - 100,
          );
          const py = Phaser.Math.Clamp(
            player.y + Math.sin(ang) * 250,
            FLOOR.y + 100,
            FLOOR.y + FLOOR.h - 100,
          );
          pools.spawn(px, py, FINAL_BOSS.poolRadius);
        }
        Sfx.explosion();
        break;
      }
      case 'claw': {
        const sp = CLAW.lunge / (CAIM.cast.claw / 1000);
        this.vx = Math.cos(this.aim) * sp;
        this.vy = Math.sin(this.aim) * sp;
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: {
              kind: 'sector',
              x: this.x,
              y: this.y,
              radius: CLAW.radius,
              angle: this.aim,
              halfArc: degToRad(CLAW.arcDeg / 2),
            },
            team: 'enemy',
            damage: CLAW.damage,
            knockback: CLAW.knockback,
            duration: CAIM.cast.claw,
            tag: 'caim_claw',
            follow: () => ({ x: this.x, y: this.y }),
          }),
        );
        this.ctx.effects.slash(
          this.x,
          this.y - 50,
          this.aim,
          'slash_enemy',
          CLAW.radius,
          { duration: 170, flipY: this.facing < 0, tint: 0xff4050 },
        );
        Sfx.enemyAttack();
        break;
      }
      case 'blink':
        this.ctx.effects.bloodSpray(this.x, this.y - 40);
        this.ctx.effects.smokeAt(this.x, this.y - 30, 6);
        Sfx.dash();
        break;
      case 'summon': {
        const n = Math.min(2, this.brain.maxWyverns - this.ctx.wyvernCount());
        for (let i = 0; i < n; i++) {
          // nunca diretamente sobre Atriox
          for (let t = 0; t < 20; t++) {
            const ang = Math.random() * Math.PI * 2;
            const px = Phaser.Math.Clamp(
              this.x + Math.cos(ang) * 160,
              FLOOR.x + 100,
              FLOOR.x + FLOOR.w - 100,
            );
            const py = Phaser.Math.Clamp(
              this.y + Math.sin(ang) * 120,
              FLOOR.y + 100,
              FLOOR.y + FLOOR.h - 100,
            );
            if (length(px - player.x, py - player.y) >= 300) {
              this.ctx.spawnWyvern(px, py);
              break;
            }
          }
        }
        Sfx.bossRoar();
        this.ctx.effects.shake(300, 0.004);
        break;
      }
    }
  }

  private endAction(a: CaimAction): void {
    if (a === 'claw' || a === 'blink') this.vx = this.vy = 0;
    this.cancelOwned();
  }

  private enterPhase2(): void {
    Sfx.bossRoar();
    this.ctx.effects.flash(220, 160, 0, 20);
    this.ctx.effects.shake(600, 0.007);
    this.ctx.effects.shockRing(this.x, this.y, 240, 0xc0101a, 700);
    this.aura.setFrequency(35);
    this.ctx.onPhase2();
  }

  private drawTelegraph(_player: { x: number; y: number }): void {
    const g = this.telegraph;
    g.clear();
    if (this.brain.state !== 'windup' || this.brain.action !== 'claw') return;
    const p = this.brain.windupProgress;
    const half = degToRad(CLAW.arcDeg / 2);
    const red = 0xd01a2a;
    g.fillStyle(red, 0.12);
    g.slice(
      this.x,
      this.y,
      CLAW.radius,
      this.aim - half,
      this.aim + half,
      false,
    );
    g.fillPath();
    g.fillStyle(red, 0.3);
    g.slice(
      this.x,
      this.y,
      CLAW.radius * p,
      this.aim - half,
      this.aim + half,
      false,
    );
    g.fillPath();
    g.lineStyle(2, red, 0.7);
    g.slice(
      this.x,
      this.y,
      CLAW.radius,
      this.aim - half,
      this.aim + half,
      false,
    );
    g.strokePath();
  }

  private sync(dt: number): void {
    const sp = this.anim.sprite;
    sp.setPosition(this.x, this.y);
    sp.setFlipX(this.facing < 0);
    sp.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 2);
    this.aura.setPosition(this.x, this.y);
    this.hurtbox.x = this.x;
    this.hurtbox.y = this.y;
    this.hurtbox.alive = !this.dead;
    // invulnerável na introdução e durante o salto (esquiva)
    this.hurtbox.invulnerable =
      this.scripted ||
      (this.brain.state === 'cast' && this.brain.action === 'blink');
    if (this.flash > 0) {
      this.flash -= dt;
      sp.setTintFill(0xffffff);
    } else if (!this.dead) {
      if (this.brain.state === 'windup' && this.brain.windupProgress > 0.7)
        sp.setTint(0xffc0c0);
      else sp.clearTint();
    }
  }

  receiveHit(hit: HitInfo): number {
    if (this.dead || this.hurtbox.invulnerable) return 0;
    if (
      this.defense.absorb(
        hit.damage,
        hit.posture ?? (hit.tag === 'charged' ? 85 : hit.heavy ? 40 : 12),
      )
    ) {
      this.flash = 50;
      return 0;
    }
    const dealt = this.health.damage(
      Math.round(hit.damage * (this.defense.mode === 'punish' ? 1.25 : 1)),
    );
    if (dealt <= 0) return 0;
    this.flash = hit.tag === 'burn' ? 30 : 60;
    if (hit.tag !== 'burn' && this.brain.onDamage(dealt)) {
      this.cancelOwned();
      Sfx.hit(true);
    }
    this.ctx.onDamaged(dealt);
    if (this.health.dead) this.die();
    return dealt;
  }

  private cancelAttacksForDefense(): void {
    this.clearVisuals();
    this.cancelOwned();
    this.vx = this.vy = 0;
  }

  private cancelOwned(): void {
    for (const h of this.owned) h.cancel();
    this.owned = [];
  }

  private die(): void {
    if (this.dead) return;
    this.brain.kill();
    this.clearVisuals();
    this.cancelOwned();
    this.telegraph.clear();
    this.hurtbox.alive = false;
    this.aura.stop();
    this.anim.play('caim.dead', true);
    this.scene.tweens.add({
      targets: this.anim.sprite,
      alpha: 0,
      delay: 1400,
      duration: 1100,
    });
    this.scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      delay: 1400,
      duration: 1100,
    });
    this.ctx.onDeath();
  }

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.clearVisuals();
    this.cancelOwned();
    this.scene.tweens.killTweensOf([this.anim.sprite, this.shadow]);
    this.anim.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
    this.aura.destroy();
  }

  private clearVisuals(): void {
    for (const v of this.visuals) {
      this.scene.tweens.killTweensOf(v);
      v.destroy();
    }
    this.visuals = [];
  }
}
