import Phaser from 'phaser';
import { WyvernBrain, WYVERN } from '../ai/WyvernBrain';
import { Health } from '../combat/DamageSystem';
import type { ActiveHitbox, HitboxSystem, Hurtbox } from '../combat/HitboxSystem';
import { angleDiff, length, normalize } from '../combat/geometry';
import type { Effects } from '../fx/Effects';
import { DEPTH, WYVERN_SCALE } from '../config/constants';
import { SpriteAnimator, type AnimLibrary } from '../animation/SpriteAnimator';
import { Sfx } from '../audio/Sfx';
import { newEntityId, type CollideFn, type Combatant, type HitInfo } from './types';

export interface WyvernContext {
  hitboxes: HitboxSystem;
  effects: Effects;
  collide: CollideFn;
  onDeath(w: Wyvern): void;
}

/**
 * Wyvern infectada invocada por Caim.
 * Voa sobre a própria sombra (posição lógica = chão). A hitbox é um círculo no chão,
 * independente da envergadura das asas.
 */
export class Wyvern implements Combatant {
  readonly id = newEntityId();
  readonly brain: WyvernBrain;
  readonly health: Health;
  readonly hurtbox: Hurtbox;
  x: number;
  y: number;
  private alt = 90;
  private vx = 0;
  private vy = 0;
  private orbitAngle: number;
  private orbitDir = Math.random() < 0.5 ? 1 : -1;
  private dir = { x: 1, y: 0 };
  facing = 1;
  removed = false;
  private flash = 0;
  private owned: ActiveHitbox[] = [];
  private readonly anim: SpriteAnimator;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    lib: AnimLibrary,
    x: number,
    y: number,
    private readonly ctx: WyvernContext
  ) {
    this.x = x;
    this.y = y;
    this.brain = new WyvernBrain(WYVERN);
    this.health = new Health(WYVERN.hp);
    this.hurtbox = { id: this.id, team: 'enemy', x, y, radius: WYVERN.hitRadius, alive: true, invulnerable: true };
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(120, 34).setAlpha(0.6);
    this.telegraph = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.hpBar = scene.add.graphics().setDepth(DEPTH.overlayFx - 30);
    this.anim = new SpriteAnimator(scene, lib, 'wyvern', x, y - this.alt, 'wyvern.materialize');
    this.anim.sprite.setScale(WYVERN_SCALE);
    ctx.effects.spawnSigil(x, y, 800, 0xc0182a);
  }

  get dead(): boolean {
    return this.brain.state === 'dead';
  }

  update(dt: number, player: { x: number; y: number; dead: boolean }): void {
    if (this.removed) return;
    if (this.dead) {
      this.anim.update(dt);
      this.sync(dt);
      return;
    }
    const W = this.brain.def;
    const toP = Math.atan2(player.y - this.y, player.x - this.x);
    for (const ev of this.brain.update(dt)) {
      if (ev === 'flying') this.anim.play('wyvern.fly');
      else if (ev === 'windup') {
        this.anim.play('wyvern.windup', true);
        this.dir = { x: Math.cos(toP), y: Math.sin(toP) };
        Sfx.telegraph(false);
      } else if (ev === 'lock') {
        this.ctx.effects.telegraphPulse(this.x, this.y - this.alt, 0xff2a2a);
      } else if (ev === 'charge') {
        this.anim.play('wyvern.charge', true);
        Sfx.dash();
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'circle', x: this.x, y: this.y, radius: W.hitRadius + 6 },
            team: 'enemy',
            damage: W.damage,
            knockback: 320,
            duration: this.brain.chargeMs,
            tag: 'wyvern_charge',
            follow: () => ({ x: this.x, y: this.y }),
            knockbackDir: { ...this.dir }
          })
        );
      } else if (ev === 'recover') {
        this.anim.play('wyvern.recovery', true);
        this.cancelOwned();
      }
    }

    let tvx = 0;
    let tvy = 0;
    let targetAlt = 85;
    const st = this.brain.state;
    if (st === 'materialize') {
      targetAlt = 85;
    } else if (st === 'fly') {
      this.orbitAngle += this.orbitDir * dt * 0.0007;
      const rr = (W.orbitMin + W.orbitMax) / 2;
      const gx = player.x + Math.cos(this.orbitAngle) * rr;
      const gy = player.y + Math.sin(this.orbitAngle) * rr * 0.75;
      const n = normalize(gx - this.x, gy - this.y);
      const d = length(gx - this.x, gy - this.y);
      const sp = Math.min(190, d * 3);
      tvx = n.x * sp;
      tvy = n.y * sp;
    } else if (st === 'windup') {
      targetAlt = 55;
      if (!this.brain.locked) {
        const cur = Math.atan2(this.dir.y, this.dir.x);
        const na = cur + angleDiff(cur, toP) * Math.min(1, dt / 90);
        this.dir = { x: Math.cos(na), y: Math.sin(na) };
      }
    } else if (st === 'charge') {
      targetAlt = 22;
      tvx = this.dir.x * W.chargeSpeed;
      tvy = this.dir.y * W.chargeSpeed;
    } else if (st === 'recovery') {
      targetAlt = 34;
    }
    const k = st === 'charge' ? 1 : Math.min(1, dt / 140);
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;
    const r = this.ctx.collide(this.x + (this.vx * dt) / 1000, this.y + (this.vy * dt) / 1000, 24);
    this.x = r.x;
    this.y = r.y;
    if (st === 'charge' && r.blocked) {
      this.brain.endChargeEarly();
      this.anim.play('wyvern.recovery', true);
      this.cancelOwned();
      this.ctx.effects.dustPuff(this.x, this.y, 8);
    }
    this.alt += (targetAlt - this.alt) * Math.min(1, dt / 160);

    if (st === 'windup' || st === 'charge') this.facing = this.dir.x >= 0 ? 1 : -1;
    else if (Math.abs(player.x - this.x) > 10) this.facing = player.x >= this.x ? 1 : -1;

    this.anim.update(dt);
    this.drawTelegraph();
    this.sync(dt);
  }

  private drawTelegraph(): void {
    const g = this.telegraph;
    g.clear();
    if (this.brain.state !== 'windup') return;
    const p = this.brain.windupProgress;
    const W = this.brain.def;
    const L = W.chargeDistance;
    const w = W.hitRadius + 6;
    const ux = this.dir.x;
    const uy = this.dir.y;
    const px = -uy * w;
    const py = ux * w;
    const quad = (len: number): Phaser.Geom.Point[] => [
      new Phaser.Geom.Point(this.x + px, this.y + py),
      new Phaser.Geom.Point(this.x + ux * len + px, this.y + uy * len + py),
      new Phaser.Geom.Point(this.x + ux * len - px, this.y + uy * len - py),
      new Phaser.Geom.Point(this.x - px, this.y - py)
    ];
    const locked = this.brain.locked;
    g.fillStyle(0xd01a2a, 0.12);
    g.fillPoints(quad(L), true);
    g.fillStyle(0xd01a2a, locked ? 0.34 : 0.2);
    g.fillPoints(quad(L * p), true);
    g.lineStyle(2, locked ? 0xffd0c0 : 0xd01a2a, 0.8);
    g.strokePoints(quad(L), true);
  }

  private sync(dt: number): void {
    const sp = this.anim.sprite;
    sp.setPosition(this.x, this.y - this.alt);
    sp.setFlipX(this.facing < 0);
    sp.setDepth(this.y + 40);
    this.shadow.setPosition(this.x, this.y + 2);
    const sh = Phaser.Math.Clamp(1.1 - this.alt / 220, 0.5, 1);
    this.shadow.setDisplaySize(130 * sh, 36 * sh);
    this.hurtbox.x = this.x;
    this.hurtbox.y = this.y;
    this.hurtbox.alive = !this.dead;
    this.hurtbox.invulnerable = !this.brain.tangible;
    if (this.brain.state === 'materialize') sp.setAlpha(Math.min(1, this.brain.timer / this.brain.def.materializeMs + 0.2));
    if (this.flash > 0) {
      this.flash -= dt;
      sp.setTintFill(0xffffff);
    } else if (!this.dead) {
      if (this.brain.state === 'windup' && this.brain.locked) sp.setTint(0xffb0a0);
      else sp.clearTint();
    }
    const g = this.hpBar;
    g.clear();
    if (!this.dead && this.health.current < this.health.max) {
      const top = this.y - this.alt - 70;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(this.x - 26, top - 1, 52, 6);
      g.fillStyle(0xc0303a, 1);
      g.fillRect(this.x - 25, top, 50 * this.health.ratio, 4);
    }
  }

  receiveHit(hit: HitInfo): number {
    if (this.dead || this.removed || !this.brain.tangible) return 0;
    const dealt = this.health.damage(Math.round(hit.damage));
    if (dealt <= 0) return 0;
    this.flash = hit.tag === 'burn' ? 30 : 70;
    if (this.brain.state !== 'charge' && hit.tag !== 'burn') {
      this.vx += hit.dirX * hit.knockback * 0.6;
      this.vy += hit.dirY * hit.knockback * 0.6;
    }
    if (this.health.dead) this.die();
    return dealt;
  }

  private cancelOwned(): void {
    for (const h of this.owned) h.cancel();
    this.owned = [];
  }

  private die(): void {
    if (this.dead) return;
    this.brain.kill();
    this.cancelOwned();
    this.telegraph.clear();
    this.hpBar.clear();
    this.hurtbox.alive = false;
    this.anim.play('wyvern.dissolve', true);
    this.ctx.effects.deathBurst(this.x, this.y - this.alt, 0xd0202a);
    this.ctx.effects.bloodSpray(this.x, this.y - this.alt);
    this.ctx.onDeath(this);
    Sfx.enemyDie();
    this.scene.tweens.add({ targets: this.anim.sprite, alpha: 0, delay: 250, duration: 450, onComplete: () => this.destroy() });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 600 });
  }

  /** Dissolve sem contar como abate (fim da luta). */
  dissolve(): void {
    if (this.removed) return;
    if (!this.dead) {
      this.brain.kill();
      this.cancelOwned();
      this.telegraph.clear();
      this.hpBar.clear();
      this.hurtbox.alive = false;
      this.anim.play('wyvern.dissolve', true);
    }
    this.scene.tweens.add({ targets: [this.anim.sprite, this.shadow], alpha: 0, duration: 500, onComplete: () => this.destroy() });
  }

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.cancelOwned();
    this.scene.tweens.killTweensOf([this.anim.sprite, this.shadow]);
    this.anim.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
    this.hpBar.destroy();
  }
}
