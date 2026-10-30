import Phaser from 'phaser';
import { ATRIOX_COMBO, type ComboStepDef } from '../../data/attacks';
import { ATRIOX_DASH, JUDGMENT_FLAME } from '../../data/abilities';
import { ComboController } from '../combat/ComboController';
import { DashController } from '../combat/DashController';
import { SpellController } from '../abilities/SpellController';
import { Health, computeDamage } from '../combat/DamageSystem';
import type { Hurtbox } from '../combat/HitboxSystem';
import { stepVelocity } from '../systems/Movement';
import { length, type Vec } from '../combat/geometry';
import { PlayerStats } from '../progression/PlayerStats';
import { AtrioxAnimator, type AnimState, type PoseMeta } from '../animation/AtrioxAnimator';
import { ATRIOX_SCALE, DEPTH } from '../config/constants';
import type { CollideFn, Combatant, HitInfo } from './types';

export interface PlayerInput {
  move: Vec;
  aimX: number;
  aimY: number;
  attackPressed: boolean;
  dashPressed: boolean;
  castPressed: boolean;
}

export interface PlayerHooks {
  onAttackStart(step: ComboStepDef, index: number, angle: number): void;
  onAttackActive(step: ComboStepDef, index: number, angle: number): void;
  onCastStart(angle: number): void;
  onCastRelease(angle: number): void;
  onDash(dir: Vec): void;
  onDashTick(): void;
  onDamaged(amount: number, hit: HitInfo): void;
  onDeath(): void;
  onFootstep(x: number, y: number): void;
  /** ajuste opcional de mira (aim assist leve) */
  aimAssist?(x: number, y: number, angle: number, range: number): number;
}

const ACCEL = 3400;
const DECEL = 3800;
const POST_HIT_INVULN = 700;
const HURT_TIME = 190;
const INPUT_BUFFER = 160;

/** Atriox Cinder controlado pelo jogador. */
export class Player implements Combatant {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly radius = 16;
  readonly stats = new PlayerStats();
  readonly health: Health;
  readonly combo = new ComboController(ATRIOX_COMBO);
  readonly dash = new DashController(ATRIOX_DASH);
  readonly spell = new SpellController(JUDGMENT_FLAME);
  readonly animator: AtrioxAnimator;
  readonly hurtbox: Hurtbox;
  private shadow: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  aimAngle = 0;
  attackAngle = 0;
  facing = 1;
  dead = false;
  godMode = false;
  /** bloqueia comandos (introdução do chefe, menus) */
  locked = false;
  hurtTimer = 0;
  postHitInvuln = 0;
  private knock = { x: 0, y: 0 };
  private lunge = { x: 0, y: 0, t: 0 };
  private buffers = { attack: 0, dash: 0, cast: 0 };
  private stepAcc = 0;
  private dashTickAcc = 0;
  /** estatísticas para o tutorial */
  readonly usage = { moved: false, attacked: false, dashed: false, cast: false };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    poses: Record<string, PoseMeta>,
    private readonly hooks: PlayerHooks
  ) {
    this.x = x;
    this.y = y;
    this.health = new Health(this.stats.get('maxHp'));
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(70, 24);
    this.glow = scene.add.image(x, y - 6, 'light').setDepth(DEPTH.groundFx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb860).setAlpha(0.22);
    this.glow.setDisplaySize(220, 120);
    this.animator = new AtrioxAnimator(scene, x, y, poses, ATRIOX_SCALE);
    this.hurtbox = { id: 0, team: 'player', x, y, radius: this.radius, alive: true, invulnerable: false };
  }

  get invulnerable(): boolean {
    return this.godMode || this.dash.invulnerable || this.postHitInvuln > 0;
  }

  get sprite(): Phaser.GameObjects.Sprite {
    return this.animator.sprite;
  }

  /** Ponto aproximado do peito (para efeitos e mira). */
  get chestY(): number {
    return this.y - 46;
  }

  update(dt: number, input: PlayerInput, collide: CollideFn): void {
    if (this.dead) {
      this.animator.set('death');
      this.animator.update(dt, this.x, this.y, this.y);
      this.syncAux();
      return;
    }
    if (this.postHitInvuln > 0) this.postHitInvuln -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    this.stats.update(dt);

    this.aimAngle = Math.atan2(input.aimY - this.chestY, input.aimX - this.x);

    // ---------------- comandos (com buffer curto)
    if (!this.locked) {
      if (input.attackPressed) this.buffers.attack = INPUT_BUFFER;
      if (input.dashPressed) this.buffers.dash = INPUT_BUFFER;
      if (input.castPressed) this.buffers.cast = INPUT_BUFFER;
    }
    this.buffers.attack -= dt;
    this.buffers.dash -= dt;
    this.buffers.cast -= dt;

    if (this.buffers.dash > 0 && this.dash.canDash() && this.combo.phase !== 'active') {
      if (this.combo.attacking) this.combo.cancel();
      if (this.spell.casting) {
        this.spell.cancel();
        this.spell.cooldown.reset();
      }
      const d = length(input.move.x, input.move.y) > 0.1 ? input.move : { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
      if (this.dash.tryDash(d.x, d.y, this.stats.get('dashCooldownMul'))) {
        this.buffers.dash = 0;
        this.buffers.attack = Math.min(this.buffers.attack, 0);
        this.lunge.t = 0;
        this.usage.dashed = true;
        if (Math.abs(this.dash.dir.x) > 0.1) this.facing = Math.sign(this.dash.dir.x);
        this.hooks.onDash(this.dash.dir);
      }
    }

    const dashing = this.dash.state === 'dashing';
    if (this.buffers.cast > 0 && !dashing && !this.spell.casting && this.spell.cooldown.ready && (!this.combo.attacking || this.combo.canCancel())) {
      if (this.combo.attacking) this.combo.cancel();
      if (this.spell.tryCast(this.stats.get('spellCooldownMul'))) {
        this.buffers.cast = 0;
        this.usage.cast = true;
        this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
        this.hooks.onCastStart(this.aimAngle);
      }
    }

    if (this.buffers.attack > 0 && !dashing && !this.spell.casting && this.hurtTimer <= 0) {
      this.combo.press();
      this.buffers.attack = 0;
      this.usage.attacked = true;
    }

    // ---------------- combo (eventos separam animação de dano)
    for (const ev of this.combo.update(dt)) {
      if (ev.type === 'stepStart') {
        const assisted = this.hooks.aimAssist?.(this.x, this.y, this.aimAngle, ev.step.range + 60) ?? this.aimAngle;
        this.attackAngle = assisted;
        this.facing = Math.cos(assisted) >= 0 ? 1 : -1;
        this.hooks.onAttackStart(ev.step, ev.index, assisted);
      } else if (ev.type === 'activeStart') {
        const sp = ev.step.lunge / (ev.step.active / 1000);
        this.lunge = { x: Math.cos(this.attackAngle) * sp, y: Math.sin(this.attackAngle) * sp, t: ev.step.active };
        this.hooks.onAttackActive(ev.step, ev.index, this.attackAngle);
      }
    }

    for (const ev of this.dash.update(dt)) {
      if (ev === 'dashEnd') {
        this.vx *= 0.25;
        this.vy *= 0.25;
      }
    }

    for (const ev of this.spell.update(dt)) {
      if (ev === 'release') this.hooks.onCastRelease(this.aimAngle);
    }

    // ---------------- movimento
    const move = this.locked ? { x: 0, y: 0 } : input.move;
    if (length(move.x, move.y) > 0.1) this.usage.moved = true;
    if (this.dash.state === 'dashing') {
      this.vx = this.dash.dir.x * this.dash.speed;
      this.vy = this.dash.dir.y * this.dash.speed;
      this.dashTickAcc += dt;
      if (this.dashTickAcc >= 26) {
        this.dashTickAcc = 0;
        this.hooks.onDashTick();
      }
    } else {
      let factor = 1;
      if (this.combo.attacking) factor = this.combo.current?.moveFactor ?? 0.25;
      else if (this.spell.casting) factor = 0.3;
      if (this.dash.state === 'recovering') factor = Math.min(factor, 0.5);
      if (this.hurtTimer > 0) factor = Math.min(factor, 0.35);
      const v = stepVelocity({ x: this.vx, y: this.vy }, move, { maxSpeed: this.stats.get('moveSpeed') * factor, accel: ACCEL, decel: DECEL }, dt);
      this.vx = v.x;
      this.vy = v.y;
    }

    let mvx = this.vx;
    let mvy = this.vy;
    if (this.lunge.t > 0) {
      this.lunge.t -= dt;
      mvx += this.lunge.x;
      mvy += this.lunge.y;
    }
    const kd = Math.exp(-dt / 90);
    this.knock.x *= kd;
    this.knock.y *= kd;
    mvx += this.knock.x;
    mvy += this.knock.y;

    const r = collide(this.x + (mvx * dt) / 1000, this.y + (mvy * dt) / 1000, this.radius);
    this.x = r.x;
    this.y = r.y;

    // ---------------- orientação
    if (this.combo.attacking) this.facing = Math.cos(this.attackAngle) >= 0 ? 1 : -1;
    else if (this.spell.casting) this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
    else if (this.dash.state !== 'dashing' && Math.abs(this.vx) > 25) this.facing = Math.sign(this.vx);

    // ---------------- passos
    const speed = length(this.vx, this.vy);
    if (speed > 60 && this.dash.state !== 'dashing') {
      this.stepAcc += dt;
      if (this.stepAcc > 200) {
        this.stepAcc = 0;
        this.hooks.onFootstep(this.x, this.y);
      }
    }

    // ---------------- animação
    this.animator.facing = this.facing;
    this.animator.set(this.pickAnim(speed));
    if (this.combo.attacking && this.combo.current) {
      const s = this.combo.current;
      const e = this.combo.elapsed;
      if (this.combo.phase === 'windup') {
        this.animator.attackPhase = 'windup';
        this.animator.phaseT = e / s.windup;
      } else if (this.combo.phase === 'active') {
        this.animator.attackPhase = 'active';
        this.animator.phaseT = (e - s.windup) / s.active;
      } else {
        this.animator.attackPhase = 'recovery';
        this.animator.phaseT = (e - s.windup - s.active) / s.recovery;
      }
    } else if (this.spell.casting) {
      this.animator.phaseT = this.spell.elapsed / this.spell.def.castTime;
    }
    this.animator.update(dt, this.x, this.y, this.y);
    // pisca durante invulnerabilidade pós-dano
    this.animator.setAlpha(this.postHitInvuln > 0 && Math.floor(this.postHitInvuln / 70) % 2 === 0 ? 0.45 : 1);
    this.syncAux();
  }

  private pickAnim(speed: number): AnimState {
    if (this.hurtTimer > 0 && !this.combo.attacking) return 'hurt';
    if (this.dash.state === 'dashing') return 'dash';
    if (this.spell.casting) return 'cast';
    if (this.combo.attacking && this.combo.current) return this.combo.current.id;
    if (this.dash.state === 'recovering') return 'dash';
    return speed > 40 ? 'run' : 'idle';
  }

  private syncAux(): void {
    this.shadow.setPosition(this.x, this.y + 2);
    this.glow.setPosition(this.x, this.y - 4);
    this.hurtbox.x = this.x;
    this.hurtbox.y = this.y;
    this.hurtbox.alive = !this.dead;
    this.hurtbox.invulnerable = this.invulnerable;
  }

  receiveHit(hit: HitInfo): number {
    if (this.dead || this.invulnerable) return 0;
    const dmg = computeDamage(hit.damage, { resist: this.stats.get('resist') });
    const dealt = this.health.damage(dmg);
    this.postHitInvuln = POST_HIT_INVULN;
    this.hurtTimer = HURT_TIME;
    this.knock.x = hit.dirX * hit.knockback * 0.7;
    this.knock.y = hit.dirY * hit.knockback * 0.7;
    if (this.combo.phase === 'windup') this.combo.interrupt();
    if (this.spell.casting) this.spell.cancel();
    this.animator.flash(80);
    this.hooks.onDamaged(dealt, hit);
    if (this.health.dead) this.die();
    return dealt;
  }

  heal(amount: number): number {
    return this.health.heal(amount);
  }

  private die(): void {
    this.dead = true;
    this.combo.interrupt();
    this.dash.stop();
    this.spell.cancel();
    this.vx = this.vy = 0;
    this.animator.play('death', true);
    this.hooks.onDeath();
  }

  setVisible(v: boolean): void {
    this.animator.sprite.setVisible(v);
    this.shadow.setVisible(v);
    this.glow.setVisible(v);
  }

  destroy(): void {
    this.animator.destroy();
    this.shadow.destroy();
    this.glow.destroy();
  }
}
