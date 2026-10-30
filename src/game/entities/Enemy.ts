import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBrain } from '../ai/EnemyBrain';
import { Health } from '../combat/DamageSystem';
import type { ActiveHitbox, HitboxSystem, Hurtbox } from '../combat/HitboxSystem';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import { angleDiff, degToRad, length, normalize } from '../combat/geometry';
import type { Effects } from '../fx/Effects';
import { DEPTH } from '../config/constants';
import { Sfx } from '../audio/Sfx';
import { newEntityId, type CollideFn, type Combatant, type HitInfo } from './types';

export interface EnemyContext {
  hitboxes: HitboxSystem;
  projectiles: ProjectileSystem;
  effects: Effects;
  collide: CollideFn;
  onDeath(e: Enemy): void;
  onDamaged(e: Enemy, amount: number, hit: HitInfo): void;
}

interface WeaponRig {
  ox: number;
  oy: number;
  rest: number;
  windup: number;
  strike: number;
  behind: boolean;
}

/** Posição do ombro e ângulos da arma por arquétipo (coordenadas da textura, pés = 0,0). */
const RIGS: Record<string, WeaponRig> = {
  recruit: { ox: 22, oy: -82, rest: 1.15, windup: -2.3, strike: 1.0, behind: false },
  archer: { ox: 20, oy: -75, rest: 0.7, windup: 0, strike: 0, behind: false },
  guardian: { ox: -26, oy: -111, rest: 1.3, windup: -2.6, strike: 1.2, behind: true }
};

/** Inimigo comum: IA por máquina de estados + rig visual (corpo + braço/arma). */
export class Enemy implements Combatant {
  readonly id = newEntityId();
  readonly brain: EnemyBrain;
  readonly health: Health;
  readonly hurtbox: Hurtbox;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  private knock = { x: 0, y: 0 };
  private lunge = { x: 0, y: 0, t: 0 };
  facing = 1;
  attackAngle = 0;
  private strafeDir = Math.random() < 0.5 ? 1 : -1;
  private strafeTimer = 0;
  private patrol = { x: 0, y: 0 };
  private flashTimer = 0;
  /** definido pelo StatusSystem da arena (apenas visual) */
  burning = false;
  private owned: ActiveHitbox[] = [];
  removed = false;
  private readonly rig: WeaponRig;

  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private weapon: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private weaponTween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: EnemyDef,
    x: number,
    y: number,
    private readonly ctx: EnemyContext
  ) {
    this.x = x;
    this.y = y;
    this.patrol = { x, y };
    this.brain = new EnemyBrain(def);
    this.health = new Health(def.hp);
    this.hurtbox = { id: this.id, team: 'enemy', x, y, radius: def.radius, alive: true, invulnerable: false };
    this.rig = RIGS[def.kind];

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(def.radius * 4, def.radius * 1.4);
    this.telegraph = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.hpBar = scene.add.graphics().setDepth(DEPTH.overlayFx - 30);
    this.body = scene.add.image(0, 0, def.texture).setOrigin(0.5, (scene.textures.get(def.texture).getSourceImage().height - 4) / scene.textures.get(def.texture).getSourceImage().height);
    this.weapon = scene.add.image(this.rig.ox, this.rig.oy, def.weaponTexture).setOrigin(0.03, 0.5).setRotation(this.rig.rest);
    this.container = scene.add.container(x, y, this.rig.behind ? [this.weapon, this.body] : [this.body, this.weapon]);
    this.container.setScale(def.scale);
    // surgimento
    this.container.setAlpha(0);
    this.container.setScale(def.scale * 0.6, def.scale * 1.3);
    scene.tweens.add({ targets: this.container, alpha: 1, scaleX: def.scale, scaleY: def.scale, duration: 260, ease: 'Back.easeOut' });
    this.brain.forceAggro();
  }

  get dead(): boolean {
    return this.brain.isDead;
  }

  get chestY(): number {
    return this.y - 60 * this.def.scale;
  }

  update(dt: number, player: { x: number; y: number; dead: boolean }): void {
    if (this.removed) return;
    if (this.dead) {
      this.syncVisual(dt);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = player.dead ? 99999 : length(dx, dy);
    const toPlayer = Math.atan2(dy, dx);

    const events = this.brain.update(dt, { distance: dist });
    for (const ev of events) {
      if (ev === 'windupStart') this.beginWindup(toPlayer);
      else if (ev === 'attackStart') this.strike();
      else if (ev === 'attackEnd') this.restWeapon(this.def.kind === 'archer' ? 0 : 220);
    }

    // ---------------- movimento por estado
    let tvx = 0;
    let tvy = 0;
    const st = this.brain.state;
    const sp = this.def.speed;
    if (st === 'patrol') {
      const pd = length(this.patrol.x - this.x, this.patrol.y - this.y);
      if (pd < 10) this.patrol = { x: this.x + (Math.random() - 0.5) * 200, y: this.y + (Math.random() - 0.5) * 140 };
      const n = normalize(this.patrol.x - this.x, this.patrol.y - this.y);
      tvx = n.x * sp * 0.4;
      tvy = n.y * sp * 0.4;
    } else if (st === 'chase') {
      const n = normalize(dx, dy);
      if (this.def.kind === 'archer') {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 1200 + Math.random() * 1400;
          this.strafeDir *= -1;
        }
        const min = this.def.minRange ?? 200;
        let radial = 0;
        if (dist < min) radial = -1;
        else if (dist > this.def.attackRange * 0.9) radial = 1;
        const px = -n.y * this.strafeDir;
        const py = n.x * this.strafeDir;
        tvx = (n.x * radial + px * 0.8) * sp;
        tvy = (n.y * radial + py * 0.8) * sp;
      } else if (dist > this.def.attackRange * 0.75) {
        tvx = n.x * sp;
        tvy = n.y * sp;
      }
    } else if (st === 'windup') {
      // acompanha o jogador no início do windup, depois trava a direção (leitura justa)
      if (this.brain.windupProgress < 0.6) {
        const d = angleDiff(this.attackAngle, toPlayer);
        this.attackAngle += d * Math.min(1, dt / 120);
      }
    }
    const blend = Math.min(1, dt / 120);
    this.vx += (tvx - this.vx) * blend;
    this.vy += (tvy - this.vy) * blend;

    let mvx = this.vx;
    let mvy = this.vy;
    if (this.lunge.t > 0) {
      this.lunge.t -= dt;
      mvx += this.lunge.x;
      mvy += this.lunge.y;
    }
    const kd = Math.exp(-dt / 110);
    this.knock.x *= kd;
    this.knock.y *= kd;
    mvx += this.knock.x;
    mvy += this.knock.y;
    const r = this.ctx.collide(this.x + (mvx * dt) / 1000, this.y + (mvy * dt) / 1000, this.def.radius);
    this.x = r.x;
    this.y = r.y;

    // orientação
    if (st === 'windup' || st === 'attack' || st === 'recovery') this.facing = Math.cos(this.attackAngle) >= 0 ? 1 : -1;
    else if (Math.abs(dx) > 8) this.facing = dx >= 0 ? 1 : -1;

    // arco do arqueiro mira o jogador
    if (this.def.kind === 'archer' && !this.weaponTween?.isPlaying()) {
      const local = this.facing > 0 ? this.attackAngle : Math.PI - this.attackAngle;
      const aim = st === 'windup' ? Phaser.Math.Angle.Wrap(local) * 0.6 : this.rig.rest;
      this.weapon.setRotation(this.weapon.rotation + (aim - this.weapon.rotation) * Math.min(1, dt / 80));
      if (st !== 'windup') this.attackAngle = toPlayer;
    }

    this.drawTelegraph(player);
    this.syncVisual(dt);
  }

  private beginWindup(toPlayer: number): void {
    this.attackAngle = toPlayer;
    this.vx *= 0.2;
    this.vy *= 0.2;
    this.ctx.effects.telegraphPulse(this.x, this.chestY - 10, 0xff3b1f);
    Sfx.telegraph(this.def.kind === 'guardian');
    if (this.def.kind !== 'archer') {
      this.weaponTween?.stop();
      this.weaponTween = this.scene.tweens.add({ targets: this.weapon, rotation: this.rig.windup, duration: this.def.windup * 0.7, ease: 'Sine.easeOut' });
      // antecipação: corpo se inclina para trás
      this.scene.tweens.add({ targets: this.body, angle: -6, duration: this.def.windup * 0.7, yoyo: false });
    } else {
      this.weapon.setRotation(0);
    }
  }

  private strike(): void {
    const a = this.attackAngle;
    const d = this.def;
    this.scene.tweens.add({ targets: this.body, angle: 5, duration: 90, yoyo: true, onComplete: () => this.body.setAngle(0) });
    if (d.attackShape === 'projectile') {
      Sfx.arrow();
      const ox = this.x + Math.cos(a) * 20;
      const oy = this.y + Math.sin(a) * 20;
      this.ctx.projectiles.fire({
        x: ox,
        y: oy,
        angle: a,
        speed: d.projectileSpeed ?? 420,
        range: 900,
        radius: d.hitRadius,
        team: 'enemy',
        texture: 'arrow',
        height: 48,
        trail: { texture: 'p_ember', tint: 0xff6040, frequency: 30, scale: 0.8, lifespan: 220 },
        onHit: (t) => {
          this.ctx.hitboxes.spawn({
            shape: { kind: 'circle', x: t.x, y: t.y, radius: 1 },
            team: 'enemy',
            damage: d.damage,
            knockback: d.knockback,
            duration: 1,
            tag: 'arrow',
            knockbackDir: { x: Math.cos(a), y: Math.sin(a) }
          });
          return true;
        }
      });
      this.scene.tweens.add({ targets: this.weapon, x: this.rig.ox - 6, duration: 60, yoyo: true });
      return;
    }
    Sfx.enemyAttack();
    this.weaponTween?.stop();
    this.weaponTween = this.scene.tweens.add({ targets: this.weapon, rotation: this.rig.strike, duration: 90, ease: 'Cubic.easeIn' });
    if (d.attackShape === 'sector') {
      const sp = (d.lunge ?? 0) / (d.active / 1000);
      this.lunge = { x: Math.cos(a) * sp, y: Math.sin(a) * sp, t: d.active };
      this.owned.push(
        this.ctx.hitboxes.spawn({
          shape: { kind: 'sector', x: this.x, y: this.y, radius: d.hitRadius, angle: a, halfArc: degToRad((d.hitArcDeg ?? 90) / 2) },
          team: 'enemy',
          damage: d.damage,
          knockback: d.knockback,
          duration: d.active,
          tag: `${d.kind}_slash`,
          follow: () => ({ x: this.x, y: this.y })
        })
      );
      this.ctx.effects.slash(this.x, this.y - 30, a, 'slash_enemy', d.hitRadius * 0.9, { duration: 160, flipY: this.facing < 0 });
    } else {
      const cx = this.x + Math.cos(a) * 40;
      const cy = this.y + Math.sin(a) * 40;
      this.owned.push(
        this.ctx.hitboxes.spawn({
          shape: { kind: 'circle', x: cx, y: cy, radius: d.hitRadius },
          team: 'enemy',
          damage: d.damage,
          knockback: d.knockback,
          duration: d.active,
          tag: `${d.kind}_slam`
        })
      );
      this.ctx.effects.shockRing(cx, cy, d.hitRadius, 0xff7a40, 360);
      this.ctx.effects.dustPuff(cx, cy, 10);
      this.ctx.effects.shake(140, 0.005);
      Sfx.slam();
    }
  }

  private restWeapon(delay: number): void {
    this.weaponTween?.stop();
    this.weaponTween = this.scene.tweens.add({ targets: this.weapon, rotation: this.rig.rest, delay, duration: 280, ease: 'Sine.easeInOut' });
  }

  private drawTelegraph(player: { x: number; y: number }): void {
    const g = this.telegraph;
    g.clear();
    if (this.brain.state !== 'windup') return;
    const p = this.brain.windupProgress;
    const a = this.attackAngle;
    const d = this.def;
    const red = 0xff3b1f;
    if (d.attackShape === 'sector') {
      const half = degToRad((d.hitArcDeg ?? 90) / 2);
      g.fillStyle(red, 0.1);
      g.slice(this.x, this.y, d.hitRadius, a - half, a + half, false);
      g.fillPath();
      g.fillStyle(red, 0.28);
      g.slice(this.x, this.y, d.hitRadius * p, a - half, a + half, false);
      g.fillPath();
      g.lineStyle(2, red, 0.65);
      g.slice(this.x, this.y, d.hitRadius, a - half, a + half, false);
      g.strokePath();
    } else if (d.attackShape === 'circle') {
      const cx = this.x + Math.cos(a) * 40;
      const cy = this.y + Math.sin(a) * 40;
      g.fillStyle(red, 0.1);
      g.fillCircle(cx, cy, d.hitRadius);
      g.fillStyle(red, 0.3);
      g.fillCircle(cx, cy, d.hitRadius * p);
      g.lineStyle(3, red, 0.7);
      g.strokeCircle(cx, cy, d.hitRadius);
    } else {
      const len = Math.min(900, length(player.x - this.x, player.y - this.y) + 200);
      const flash = p > 0.82;
      g.lineStyle(flash ? 3 : 2, flash ? 0xfff0e0 : red, 0.25 + 0.6 * p);
      g.lineBetween(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len);
    }
  }

  private syncVisual(dt: number): void {
    this.container.setPosition(this.x, this.y);
    this.container.setDepth(this.y);
    this.container.scaleX = Math.abs(this.container.scaleX) * this.facing;
    this.shadow.setPosition(this.x, this.y + 2);
    this.hurtbox.x = this.x;
    this.hurtbox.y = this.y;
    this.hurtbox.alive = !this.dead;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.body.setTintFill(0xffffff);
      this.weapon.setTintFill(0xffffff);
    } else if (!this.dead) {
      if (this.burning) {
        this.body.setTint(0xffb080);
        this.weapon.clearTint();
      } else if (this.brain.state === 'windup' && this.brain.windupProgress > 0.75) {
        this.body.setTint(0xffc0b0);
        this.weapon.setTint(0xff9070);
      } else {
        this.body.clearTint();
        this.weapon.clearTint();
      }
    }
    // barra de vida discreta
    const g = this.hpBar;
    g.clear();
    if (!this.dead && this.health.current < this.health.max) {
      const w = 46 * this.def.scale + 10;
      const top = this.y - (this.body.height - 10) * this.def.scale - 12;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(this.x - w / 2 - 1, top - 1, w + 2, 6);
      g.fillStyle(this.burning ? 0xff8a3a : 0xc0303a, 1);
      g.fillRect(this.x - w / 2, top, w * this.health.ratio, 4);
    }
  }

  receiveHit(hit: HitInfo): number {
    if (this.dead || this.removed) return 0;
    const dealt = this.health.damage(Math.round(hit.damage));
    if (dealt <= 0) return 0;
    if (hit.tag === 'burn') {
      // dano contínuo: sem stagger nem empurrão
      this.flashTimer = 30;
      this.ctx.onDamaged(this, dealt, hit);
      if (this.health.dead) this.die();
      return dealt;
    }
    this.flashTimer = 70;
    const kb = hit.knockback * (1 - this.def.knockbackResist);
    this.knock.x = hit.dirX * kb;
    this.knock.y = hit.dirY * kb;
    const staggered = this.brain.onHit(hit.damage);
    if (staggered) {
      this.cancelOwned();
      this.restWeapon(0);
      this.lunge.t = 0;
    }
    this.ctx.onDamaged(this, dealt, hit);
    if (this.health.dead) this.die();
    return dealt;
  }

  private cancelOwned(): void {
    for (const h of this.owned) h.cancel();
    this.owned = [];
  }

  private die(): void {
    if (this.brain.isDead) return;
    this.brain.kill();
    this.cancelOwned();
    this.telegraph.clear();
    this.hpBar.clear();
    this.hurtbox.alive = false;
    this.ctx.onDeath(this);
    Sfx.enemyDie();
    this.ctx.effects.deathBurst(this.x, this.y, 0xff9a50);
    this.body.setTint(0x6a2a20);
    this.weapon.setTint(0x6a2a20);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleY: this.def.scale * 0.2,
      angle: this.facing * -20,
      delay: 120,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => this.destroy()
    });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 520 });
  }

  /** Remoção imediata (fim de onda/partida). */
  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.cancelOwned();
    this.weaponTween?.stop();
    this.container.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
    this.hpBar.destroy();
  }
}
