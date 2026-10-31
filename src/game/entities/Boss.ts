import Phaser from 'phaser';
import type { BossDef, BossMoveDef } from '../../data/bosses';
import { BossBrain } from '../ai/BossBrain';
import { Health } from '../combat/DamageSystem';
import type { ActiveHitbox, HitboxSystem, Hurtbox } from '../combat/HitboxSystem';
import { angleDiff, degToRad, length, normalize } from '../combat/geometry';
import type { Effects } from '../fx/Effects';
import { DEPTH } from '../config/constants';
import { Sfx } from '../audio/Sfx';
import { newEntityId, type CollideFn, type Combatant, type HitInfo } from './types';
import { SpriteAnimator, getLibrary } from '../animation/SpriteAnimator';

export interface BossContext {
  hitboxes: HitboxSystem;
  effects: Effects;
  collide: CollideFn;
  onDamaged(amount: number, hit: HitInfo): void;
  onPhaseChange(): void;
  onDeath(): void;
}

const seq = (p: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${p}_${String(i).padStart(2, '0')}`);

/**
 * O Carrasco da Provação — primeiro chefe (personagem original do jogo).
 * v0.5: capuz carmesim, placas gastas e machado de execução (folhas carrasco_*),
 * animado por quadros sincronizados com as fases do golpe; postura quebrável.
 */
export class Boss implements Combatant {
  readonly id = newEntityId();
  readonly brain: BossBrain;
  readonly health: Health;
  readonly hurtbox: Hurtbox;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  facing = -1;
  attackAngle = Math.PI / 2;
  private charge = { x: 0, y: 0, active: false };
  private owned: ActiveHitbox[] = [];
  private flashTimer = 0;
  removed = false;
  /** caminhando na introdução (controlado pela cena) */
  scripted = true;

  readonly container: Phaser.GameObjects.Container;
  private anim: SpriteAnimator;
  private body: Phaser.GameObjects.Sprite;
  private hurtFlash = 0;
  private shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Graphics;
  private aura: Phaser.GameObjects.Particles.ParticleEmitter;
  private glow: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: BossDef,
    x: number,
    y: number,
    private readonly ctx: BossContext,
    rng: () => number = Math.random
  ) {
    this.x = x;
    this.y = y;
    this.brain = new BossBrain(def, rng);
    this.health = new Health(def.hp);
    this.hurtbox = { id: this.id, team: 'enemy', x, y, radius: def.radius, alive: true, invulnerable: true };

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(def.radius * 4.2, def.radius * 1.5);
    this.glow = scene.add.image(x, y - 10, 'light').setDepth(DEPTH.groundFx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3010).setAlpha(0);
    this.glow.setDisplaySize(320, 170);
    this.telegraph = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.anim = new SpriteAnimator(scene, getLibrary(scene), 'carrasco', 0, 0, 'carrasco.idle');
    this.body = this.anim.sprite;
    this.container = scene.add.container(x, y, [this.body]).setScale(def.scale);
    this.aura = scene.add.particles(0, 0, 'p_ember', {
      x: { min: -40, max: 40 },
      y: { min: -150, max: 0 },
      speedY: { min: -90, max: -30 },
      lifespan: { min: 500, max: 1000 },
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff5020, 0xffa040],
      blendMode: 'ADD',
      frequency: 45,
      emitting: false
    });
  }

  /** quadro atual do atlas (testes/inspeção) */
  get frameName(): string {
    return this.body.frame.name;
  }

  get dead(): boolean {
    return this.brain.state === 'dead';
  }

  get chestY(): number {
    return this.y - 120 * this.def.scale;
  }

  get hpRatio(): number {
    return this.health.ratio;
  }

  /** Movimento roteirizado da introdução. */
  walkTo(x: number, y: number, dt: number, speed = 90): boolean {
    const d = length(x - this.x, y - this.y);
    if (d < 4) {
      this.syncVisual(dt);
      return true;
    }
    const n = normalize(x - this.x, y - this.y);
    this.x += (n.x * speed * dt) / 1000;
    this.y += (n.y * speed * dt) / 1000;
    this.facing = n.x >= 0 ? 1 : -1;
    this.anim.play('carrasco.run');
    this.anim.update(dt, speed / this.def.speed);
    this.syncVisual(dt);
    return false;
  }

  startFight(): void {
    this.scripted = false;
    this.brain.startFight();
  }

  /** Parado em guarda (conversa antes da luta). */
  idle(dt: number, lookAt: { x: number }): void {
    this.facing = lookAt.x >= this.x ? 1 : -1;
    this.anim.play('carrasco.idle');
    this.anim.update(dt);
    this.syncVisual(dt);
  }

  update(dt: number, player: { x: number; y: number; dead: boolean }): void {
    if (this.removed || this.scripted) return;
    if (this.dead) {
      this.anim.update(dt);
      this.syncVisual(dt);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = player.dead ? 99999 : length(dx, dy);
    const toPlayer = Math.atan2(dy, dx);

    for (const ev of this.brain.update(dt, { distance: dist, hpRatio: this.health.ratio })) {
      if (ev.type === 'moveWindup') this.beginWindup(ev.move, toPlayer);
      else if (ev.type === 'moveActive') this.executeMove(ev.move);
      else if (ev.type === 'moveEnd') this.endMove(ev.move);
      else if (ev.type === 'phaseChange') this.enterPhase2();
    }

    let tvx = 0;
    let tvy = 0;
    const st = this.brain.state;
    if (st === 'chase') {
      const n = normalize(dx, dy);
      if (dist > 110) {
        tvx = n.x * this.def.speed * this.brain.speedMul;
        tvy = n.y * this.def.speed * this.brain.speedMul;
      }
      this.facing = dx >= 0 ? 1 : -1;
    } else if (st === 'windup' && this.brain.move) {
      if (this.brain.windupProgress < 0.6) {
        const d = angleDiff(this.attackAngle, toPlayer);
        this.attackAngle += d * Math.min(1, dt / 160);
      }
      this.facing = Math.cos(this.attackAngle) >= 0 ? 1 : -1;
    }

    if (this.charge.active) {
      tvx = this.charge.x;
      tvy = this.charge.y;
    }
    const blend = this.charge.active ? 1 : Math.min(1, dt / 160);
    this.vx += (tvx - this.vx) * blend;
    this.vy += (tvy - this.vy) * blend;
    const r = this.ctx.collide(this.x + (this.vx * dt) / 1000, this.y + (this.vy * dt) / 1000, this.def.radius);
    this.x = r.x;
    this.y = r.y;
    if (this.charge.active) {
      if (Math.random() < 0.5) this.ctx.effects.dustPuff(this.x, this.y, 2);
      if (r.blocked) {
        // bateu na parede: interrompe a investida com impacto
        this.charge.active = false;
        this.vx = this.vy = 0;
        this.ctx.effects.shake(160, 0.006);
        this.ctx.effects.dustPuff(this.x, this.y, 10);
        this.ctx.effects.atlasFx(this.x + this.facing * 50, this.y - 40, seq('fxc_impact', 6), { frameMs: 55, depth: this.y + 5 });
        Sfx.slam();
      }
    }

    this.drawTelegraph();
    this.animate(dt);
    this.syncVisual(dt);
  }

  /** Quadros pela fase da IA (sincronizados); loops só em corrida, investida, fúria e tontura. */
  private animate(dt: number): void {
    const b = this.brain;
    const st = b.state;
    const m = b.move;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (st === 'transition') {
      this.anim.play('carrasco.rage');
      this.anim.update(dt);
    } else if (st === 'broken') {
      this.anim.play('carrasco.broken');
      this.anim.update(dt);
    } else if ((st === 'windup' || st === 'active' || st === 'recovery') && m) {
      if (m.id === 'charge' && st === 'active') {
        this.anim.play('carrasco.charge_loop');
        this.anim.update(dt);
        return;
      }
      this.anim.play(`carrasco.${m.id}`);
      if (st === 'windup') this.anim.sync('windup', b.timer / b.windupOf(m));
      else if (st === 'active') this.anim.sync('active', b.timer / m.active);
      else this.anim.sync('recovery', b.timer / b.recoveryOf(m));
    } else if (this.hurtFlash > 0) {
      // reação curta (super armor: não interrompe a IA)
      this.anim.play('carrasco.hurt');
      this.anim.update(dt);
    } else {
      const moving = Math.hypot(this.vx, this.vy) > 25;
      this.anim.play(moving ? 'carrasco.run' : 'carrasco.idle');
      this.anim.update(dt, moving ? Math.max(0.6, Math.hypot(this.vx, this.vy) / this.def.speed) : 1);
    }
  }

  private beginWindup(m: BossMoveDef, toPlayer: number): void {
    this.attackAngle = toPlayer;
    this.facing = Math.cos(toPlayer) >= 0 ? 1 : -1;
    this.vx *= 0.2;
    this.vy *= 0.2;
    Sfx.telegraph(true);
    this.ctx.effects.telegraphPulse(this.x, this.chestY, m.id === 'inferno' ? 0xff8a20 : 0xff3b1f);
  }

  private executeMove(m: BossMoveDef): void {
    const a = this.attackAngle;
    const team = 'enemy' as const;
    switch (m.id) {
      case 'overhead': {
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'rect', x: this.x, y: this.y, angle: a, length: m.length!, width: m.width! },
            team,
            damage: m.damage,
            knockback: m.knockback,
            delay: 60,
            duration: m.active,
            tag: 'boss_overhead',
            knockbackDir: { x: Math.cos(a), y: Math.sin(a) }
          })
        );
        this.scene.time.delayedCall(70, () => {
          const ex = this.x + Math.cos(a) * m.length! * 0.75;
          const ey = this.y + Math.sin(a) * m.length! * 0.75;
          this.ctx.effects.atlasFx(ex, ey - 30, seq('fxc_impact', 6), { frameMs: 55, scale: 1.2, depth: ey + 5 });
          this.ctx.effects.dustPuff(ex, ey, 12);
          this.ctx.effects.scorch(ex, ey, 50);
          this.ctx.effects.shake(200, 0.009);
          Sfx.slam();
        });
        break;
      }
      case 'sweep': {
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'sector', x: this.x, y: this.y, radius: m.radius!, angle: a, halfArc: degToRad(m.arcDeg! / 2) },
            team,
            damage: m.damage,
            knockback: m.knockback,
            duration: m.active,
            tag: 'boss_sweep',
            follow: () => ({ x: this.x, y: this.y })
          })
        );
        this.ctx.effects.atlasFx(this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 50 - 60, seq('fxc_slash_h', 6), { frameMs: 45, scale: 1.1, flipX: Math.cos(a) < 0, depth: this.y + 5 });
        this.ctx.effects.shake(140, 0.004);
        Sfx.swing(2);
        break;
      }
      case 'charge': {
        const sp = m.speed ?? 900;
        this.charge = { x: Math.cos(a) * sp, y: Math.sin(a) * sp, active: true };
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'circle', x: this.x, y: this.y, radius: this.def.radius + 26 },
            team,
            damage: m.damage,
            knockback: m.knockback,
            duration: m.active,
            tag: 'boss_charge',
            follow: () => ({ x: this.x, y: this.y }),
            knockbackDir: { x: Math.cos(a), y: Math.sin(a) }
          })
        );
        Sfx.dash();
        break;
      }
      case 'inferno': {
        const r0 = m.radius!;
        this.owned.push(
          this.ctx.hitboxes.spawn({
            shape: { kind: 'circle', x: this.x, y: this.y, radius: r0 },
            team,
            damage: m.damage,
            knockback: m.knockback,
            delay: 60,
            duration: 120,
            tag: 'boss_inferno'
          }),
          this.ctx.hitboxes.spawn({
            shape: { kind: 'ring', x: this.x, y: this.y, inner: r0 - 16, outer: r0 + 16 },
            team,
            damage: Math.round(m.damage * 0.7),
            knockback: m.knockback * 0.7,
            delay: 120,
            duration: m.active,
            grow: m.speed,
            tag: 'boss_inferno_ring'
          })
        );
        const ring = this.scene.add.image(this.x, this.y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6a20).setDepth(DEPTH.groundFx + 20);
        const s0 = r0 / 118;
        const s1 = (r0 + ((m.speed ?? 380) * m.active) / 1000) / 118;
        ring.setScale(s0, s0 * 0.62);
        this.scene.tweens.add({
          targets: ring,
          scaleX: s1,
          scaleY: s1 * 0.62,
          delay: 120,
          duration: m.active,
          ease: 'Linear',
          onComplete: () => ring.destroy()
        });
        this.scene.tweens.add({ targets: ring, alpha: 0.2, delay: 120 + m.active * 0.6, duration: m.active * 0.4 });
        this.scene.time.delayedCall(60, () => {
          this.ctx.effects.explosion(this.x, this.y, r0 * 0.9);
          this.ctx.effects.shake(300, 0.012);
          Sfx.explosion();
          Sfx.slam();
        });
        break;
      }
    }
  }

  private endMove(m: BossMoveDef): void {
    this.charge.active = false;
    if (m.id === 'charge') this.ctx.effects.dustPuff(this.x, this.y, 8);
  }

  private enterPhase2(): void {
    this.cancelOwned();
    this.charge.active = false;
    this.telegraph.clear();
    Sfx.bossRoar();
    this.ctx.effects.flash(260, 255, 120, 60);
    this.ctx.effects.shake(900, 0.008);
    this.ctx.effects.shockRing(this.x, this.y, 260, 0xff4020, 700);
    this.aura.start();
    this.aura.startFollow(this.container);
    this.scene.tweens.add({ targets: this.glow, alpha: 0.55, duration: 600 });
    this.ctx.onPhaseChange();
  }

  private drawTelegraph(): void {
    const g = this.telegraph;
    g.clear();
    const m = this.brain.move;
    if (this.brain.state !== 'windup' || !m) return;
    const p = this.brain.windupProgress;
    const a = this.attackAngle;
    const col = m.id === 'inferno' ? 0xff8a20 : 0xff3b1f;
    const strong = p > 0.8;
    switch (m.id) {
      case 'overhead':
      case 'charge': {
        const L = m.length!;
        const W = m.width! + (m.id === 'charge' ? this.def.radius : 0);
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const px = -uy * (W / 2);
        const py = ux * (W / 2);
        const quad = (len: number): Phaser.Geom.Point[] => [
          new Phaser.Geom.Point(this.x + px, this.y + py),
          new Phaser.Geom.Point(this.x + ux * len + px, this.y + uy * len + py),
          new Phaser.Geom.Point(this.x + ux * len - px, this.y + uy * len - py),
          new Phaser.Geom.Point(this.x - px, this.y - py)
        ];
        g.fillStyle(col, 0.12);
        g.fillPoints(quad(L), true);
        g.fillStyle(col, strong ? 0.4 : 0.26);
        g.fillPoints(quad(L * p), true);
        g.lineStyle(3, strong ? 0xffe0c0 : col, 0.8);
        g.strokePoints(quad(L), true);
        if (m.id === 'charge') {
          const tx = this.x + ux * L;
          const ty = this.y + uy * L;
          g.fillStyle(col, 0.7);
          g.fillTriangle(tx + ux * 26, ty + uy * 26, tx + px * 0.9, ty + py * 0.9, tx - px * 0.9, ty - py * 0.9);
        }
        break;
      }
      case 'sweep': {
        const half = degToRad(m.arcDeg! / 2);
        g.fillStyle(col, 0.12);
        g.slice(this.x, this.y, m.radius!, a - half, a + half, false);
        g.fillPath();
        g.fillStyle(col, strong ? 0.4 : 0.26);
        g.slice(this.x, this.y, m.radius! * p, a - half, a + half, false);
        g.fillPath();
        g.lineStyle(3, strong ? 0xffe0c0 : col, 0.8);
        g.slice(this.x, this.y, m.radius!, a - half, a + half, false);
        g.strokePath();
        break;
      }
      case 'inferno': {
        const r = m.radius!;
        g.fillStyle(col, 0.14);
        g.fillCircle(this.x, this.y, r);
        g.fillStyle(col, strong ? 0.42 : 0.26);
        g.fillCircle(this.x, this.y, r * p);
        g.lineStyle(3, strong ? 0xffe0c0 : col, 0.85);
        g.strokeCircle(this.x, this.y, r);
        // anéis que indicam a onda que se expandirá
        g.lineStyle(2, col, 0.25 * p);
        g.strokeCircle(this.x, this.y, r + 90);
        g.strokeCircle(this.x, this.y, r + 180);
        break;
      }
    }
  }

  private syncVisual(dt: number): void {
    this.container.setPosition(this.x, this.y);
    this.container.setDepth(this.y);
    this.container.scaleX = Math.abs(this.container.scaleX) * this.facing;
    this.shadow.setPosition(this.x, this.y + 3);
    this.glow.setPosition(this.x, this.y - 10);
    this.hurtbox.x = this.x;
    this.hurtbox.y = this.y;
    this.hurtbox.alive = !this.dead;
    this.hurtbox.invulnerable = this.brain.invulnerable || this.scripted;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.body.setTintFill(0xffffff);
    } else if (!this.dead) {
      if (this.brain.state === 'transition') {
        const k = Math.sin(this.scene.time.now / 60) > 0;
        this.body.setTint(k ? 0xff9070 : 0xffffff);
      } else if (this.brain.state === 'broken') {
        this.body.setTint(0xc8f0e8);
      } else if (this.brain.state === 'windup' && this.brain.windupProgress > 0.75) {
        this.body.setTint(0xffd0b8);
      } else if (this.brain.phase === 2) {
        this.body.setTint(0xffc4b0);
      } else {
        this.body.clearTint();
      }
    }
  }

  receiveHit(hit: HitInfo): number {
    if (this.dead || this.hurtbox.invulnerable) return 0;
    const broken = this.brain.state === 'broken';
    const dealt = this.health.damage(Math.round(hit.damage * (broken ? 1.3 : 1)));
    if (dealt <= 0) return 0;
    this.flashTimer = 60;
    // super armor: só um empurrão mínimo e uma reação curta quando está andando
    if (!this.charge.active && this.brain.state === 'chase') {
      this.x += hit.dirX * 3;
      this.y += hit.dirY * 3;
      if (hit.heavy || hit.damage >= 20) this.hurtFlash = 260;
    }
    // postura: golpes básicos desgastam pouco, pesados e carregados muito
    if (hit.tag !== 'burn' && this.brain.hitPosture((hit.posture ?? (hit.tag === 'charged' ? 85 : hit.heavy ? 40 : hit.basic ? 12 : 6)) * (hit.postureMul ?? 1))) {
      this.cancelOwned();
      this.charge.active = false;
      this.vx = this.vy = 0;
      this.telegraph.clear();
      this.ctx.effects.floatingText(this.x, this.chestY - 40, 'POSTURA QUEBRADA', '#80e0d0', 20);
      this.ctx.effects.shake(200, 0.006);
      Sfx.slam();
    }
    this.ctx.onDamaged(dealt, hit);
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
    this.charge.active = false;
    this.telegraph.clear();
    this.hurtbox.alive = false;
    this.aura.stop();
    this.body.setTint(0xb07060);
    // queda completa desenhada (4 quadros), depois desaparece
    this.anim.play('carrasco.dead', true);
    this.scene.tweens.add({ targets: this.container, alpha: 0, delay: 1900, duration: 900, onComplete: () => this.destroy() });
    this.scene.tweens.add({ targets: [this.glow, this.shadow], alpha: 0, delay: 1300, duration: 900 });
    this.ctx.onDeath();
  }

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.cancelOwned();
    this.container.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
    this.aura.destroy();
    this.glow.destroy();
  }
}
