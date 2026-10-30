import Phaser from 'phaser';
import { ATRIOX_COMBO, type ComboStepDef } from '../../data/attacks';
import { ATRIOX_DASH, JUDGMENT_FLAME, type SpellDef } from '../../data/abilities';
import { AVATAR, SECOND_SUN, type ApollonGiftId } from '../../data/apollon';
import { ComboController } from '../combat/ComboController';
import { DashController } from '../combat/DashController';
import { SpellController } from '../abilities/SpellController';
import { Health, computeDamage } from '../combat/DamageSystem';
import type { Hurtbox } from '../combat/HitboxSystem';
import { stepVelocity } from '../systems/Movement';
import { length, type Vec } from '../combat/geometry';
import { PlayerStats } from '../progression/PlayerStats';
import { AtrioxAnimator, type AnimState } from '../animation/AtrioxAnimator';
import type { AnimLibrary } from '../animation/SpriteAnimator';
import { ATRIOX_SCALE, DEPTH } from '../config/constants';
import type { CollideFn, Combatant, HitInfo } from './types';

export interface PlayerInput {
  move: Vec;
  aimX: number;
  aimY: number;
  attackPressed: boolean;
  dashPressed: boolean;
  castPressed: boolean;
  sunPressed: boolean;
  avatarPressed: boolean;
}

export interface PlayerHooks {
  onAttackStart(step: ComboStepDef, index: number, angle: number): void;
  onAttackActive(step: ComboStepDef, index: number, angle: number): void;
  onCastStart(angle: number): void;
  onCastRelease(angle: number): void;
  onSunStart(x: number, y: number): void;
  onSunRelease(x: number, y: number): void;
  onAvatarStart(facing: number): void;
  onAvatarBeam(facing: number): void;
  onDash(dir: Vec, radiant: boolean): void;
  onDashTick(fromX: number, fromY: number, toX: number, toY: number): void;
  onDamaged(amount: number, hit: HitInfo): void;
  onDeath(): void;
  onFootstep(x: number, y: number): void;
  aimAssist?(x: number, y: number, angle: number, range: number): number;
}

const ACCEL = 3600;
const DECEL = 4200;
const POST_HIT_INVULN = 700;
const HURT_TIME = 200;
/** buffer curto de input (ms) */
const INPUT_BUFFER = 120;

const SUN_DEF: SpellDef = { ...JUDGMENT_FLAME, id: 'second_sun', name: 'Juízo do Segundo Sol', castTime: SECOND_SUN.castMs, cooldown: SECOND_SUN.cooldown };

/** Atriox Cinder controlado pelo jogador. */
export class Player implements Combatant {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly radius = 16;
  readonly stats = new PlayerStats();
  readonly health: Health;
  readonly combo = new ComboController(ATRIOX_COMBO, INPUT_BUFFER);
  readonly dash = new DashController(ATRIOX_DASH);
  readonly spell = new SpellController(JUDGMENT_FLAME);
  readonly sun = new SpellController(SUN_DEF);
  readonly animator: AtrioxAnimator;
  readonly hurtbox: Hurtbox;
  readonly gifts = new Set<ApollonGiftId>();
  /** purificação do sangue pelo dash (ms); 0 = sem purificação */
  dashPurifyMs = 0;
  glory = 0;
  private shadow: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  aimAngle = 0;
  attackAngle = 0;
  facing = 1;
  dead = false;
  godMode = false;
  /** bloqueia comandos (introduções, menus) */
  locked = false;
  /** dominado pelo sangue de Caim: não age */
  stunned = false;
  /** cena final: oculto e sem controle */
  cinematic = false;
  hurtTimer = 0;
  postHitInvuln = 0;
  avatarT = -1;
  private avatarBeamFired = false;
  private sunTarget = { x: 0, y: 0 };
  private knock = { x: 0, y: 0 };
  private lunge = { x: 0, y: 0, t: 0 };
  private buffers = { attack: 0, dash: 0, cast: 0, sun: 0, avatar: 0 };
  readonly usage = { moved: false, attacked: false, dashed: false, cast: false };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    lib: AnimLibrary,
    private readonly hooks: PlayerHooks
  ) {
    this.x = x;
    this.y = y;
    this.health = new Health(this.stats.get('maxHp'));
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(78, 24);
    this.glow = scene.add.image(x, y - 6, 'light').setDepth(DEPTH.groundFx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb860).setAlpha(0.2);
    this.glow.setDisplaySize(220, 120);
    this.animator = new AtrioxAnimator(scene, x, y, lib, ATRIOX_SCALE);
    this.hurtbox = { id: 0, team: 'player', x, y, radius: this.radius, alive: true, invulnerable: false };
  }

  get invulnerable(): boolean {
    return this.godMode || this.dash.invulnerable || this.postHitInvuln > 0 || this.avatarT >= 0 || this.cinematic;
  }

  get sprite(): Phaser.GameObjects.Sprite {
    return this.animator.sprite;
  }

  get chestY(): number {
    return this.y - 62;
  }

  get radiant(): boolean {
    return this.gifts.has('radiant_impetus');
  }

  /** Esvazia comandos pendentes (perda de foco, stun, cinemática). */
  clearInput(): void {
    this.buffers = { attack: 0, dash: 0, cast: 0, sun: 0, avatar: 0 };
  }

  setStunned(v: boolean): void {
    if (v === this.stunned) return;
    this.stunned = v;
    this.clearInput();
    if (v) {
      this.combo.interrupt();
      this.spell.cancel();
      this.sun.cancel();
      this.dash.stop();
      this.lunge.t = 0;
    }
  }

  update(dt: number, input: PlayerInput, collide: CollideFn): void {
    if (this.dead) {
      this.animator.set('dead');
      this.animator.update(dt, this.x, this.y, this.y);
      this.syncAux();
      return;
    }
    if (this.postHitInvuln > 0) this.postHitInvuln -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    this.stats.update(dt);

    this.aimAngle = Math.atan2(input.aimY - this.chestY, input.aimX - this.x);
    const canAct = !this.locked && !this.stunned && !this.cinematic && this.avatarT < 0;

    // ---------------- comandos com buffer curto (120 ms)
    if (canAct) {
      if (input.attackPressed) this.buffers.attack = INPUT_BUFFER;
      if (input.dashPressed) this.buffers.dash = INPUT_BUFFER;
      if (input.castPressed) this.buffers.cast = INPUT_BUFFER;
      if (input.sunPressed && this.gifts.has('second_sun')) this.buffers.sun = INPUT_BUFFER;
      if (input.avatarPressed && this.gifts.has('avatar')) this.buffers.avatar = INPUT_BUFFER;
    } else {
      this.clearInput();
    }
    for (const k of Object.keys(this.buffers) as (keyof typeof this.buffers)[]) this.buffers[k] -= dt;

    // dash: cancela preparação/recuperação de golpes e conjurações (nunca a janela ativa)
    if (canAct && this.buffers.dash > 0 && this.dash.canDash() && this.combo.phase !== 'active') {
      if (this.combo.attacking) this.combo.cancel();
      for (const sp of [this.spell, this.sun]) {
        if (sp.casting) {
          sp.cancel();
          sp.cooldown.reset();
        }
      }
      // direção: movimento atual; parado → para onde o personagem está olhando
      const d = length(input.move.x, input.move.y) > 0.1 ? input.move : { x: this.facing, y: 0 };
      if (this.dash.tryDash(d.x, d.y, this.stats.get('dashCooldownMul'))) {
        this.buffers.dash = 0;
        this.lunge.t = 0;
        this.usage.dashed = true;
        if (Math.abs(this.dash.dir.x) > 0.1) this.facing = Math.sign(this.dash.dir.x);
        this.hooks.onDash(this.dash.dir, this.radiant);
      }
    }

    const dashing = this.dash.state === 'dashing';
    const castReady = !dashing && !this.spell.casting && !this.sun.casting && (!this.combo.attacking || this.combo.canCancel());

    if (canAct && this.buffers.avatar > 0 && castReady && this.glory >= AVATAR.gloryMax) {
      if (this.combo.attacking) this.combo.cancel();
      this.buffers.avatar = 0;
      this.glory = 0;
      this.avatarT = 0;
      this.avatarBeamFired = false;
      this.vx = this.vy = 0;
      this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
      this.hooks.onAvatarStart(this.facing);
    }

    if (canAct && this.buffers.sun > 0 && castReady && this.sun.cooldown.ready) {
      if (this.combo.attacking) this.combo.cancel();
      if (this.sun.tryCast()) {
        this.buffers.sun = 0;
        const dx = input.aimX - this.x;
        const dy = input.aimY - this.y;
        const dl = Math.max(1, length(dx, dy));
        const r = Math.min(SECOND_SUN.maxRange, dl);
        this.sunTarget = { x: this.x + (dx / dl) * r, y: this.y + (dy / dl) * r };
        this.facing = dx >= 0 ? 1 : -1;
        this.hooks.onSunStart(this.sunTarget.x, this.sunTarget.y);
      }
    }

    if (canAct && this.buffers.cast > 0 && castReady && this.spell.cooldown.ready) {
      if (this.combo.attacking) this.combo.cancel();
      if (this.spell.tryCast(this.stats.get('spellCooldownMul'))) {
        this.buffers.cast = 0;
        this.usage.cast = true;
        this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
        this.hooks.onCastStart(this.aimAngle);
      }
    }

    // ataque: o clique fica no buffer por 120 ms e só entra quando o combo aceita
    if (canAct && this.buffers.attack > 0 && !dashing && !this.spell.casting && !this.sun.casting && this.hurtTimer <= 0) {
      if (this.combo.press()) {
        this.buffers.attack = 0;
        this.usage.attacked = true;
      }
    }

    // ---------------- combo (a lógica define o tempo; a animação acompanha)
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
    for (const ev of this.spell.update(dt)) if (ev === 'release') this.hooks.onCastRelease(this.aimAngle);
    for (const ev of this.sun.update(dt)) if (ev === 'release') this.hooks.onSunRelease(this.sunTarget.x, this.sunTarget.y);

    if (this.avatarT >= 0) {
      this.avatarT += dt;
      if (!this.avatarBeamFired && this.avatarT >= AVATAR.beamFrom) {
        this.avatarBeamFired = true;
        this.hooks.onAvatarBeam(this.facing);
      }
      if (this.avatarT >= AVATAR.castMs) this.avatarT = -1;
    }

    // ---------------- movimento
    const move = canAct ? input.move : { x: 0, y: 0 };
    if (length(move.x, move.y) > 0.1) this.usage.moved = true;
    const maxSpeed = this.stats.get('moveSpeed');
    if (this.dash.state === 'dashing') {
      this.vx = this.dash.dir.x * this.dash.speed;
      this.vy = this.dash.dir.y * this.dash.speed;
    } else {
      let factor = 1;
      if (this.combo.attacking) factor = this.combo.current?.moveFactor ?? 0.25;
      else if (this.spell.casting || this.sun.casting) factor = 0.3;
      if (this.dash.state === 'recovering') factor = Math.min(factor, 0.6);
      if (this.hurtTimer > 0) factor = Math.min(factor, 0.35);
      if (this.stunned || this.avatarT >= 0 || this.cinematic) factor = 0;
      const v = stepVelocity({ x: this.vx, y: this.vy }, move, { maxSpeed: maxSpeed * factor, accel: ACCEL, decel: DECEL }, dt);
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

    const px = this.x;
    const py = this.y;
    const r = collide(this.x + (mvx * dt) / 1000, this.y + (mvy * dt) / 1000, this.radius);
    this.x = r.x;
    this.y = r.y;
    if (this.dash.state === 'dashing') this.hooks.onDashTick(px, py, this.x, this.y);

    // ---------------- orientação (o sprite só espelha; não gira para mirar)
    if (this.combo.attacking) this.facing = Math.cos(this.attackAngle) >= 0 ? 1 : -1;
    else if (this.spell.casting) this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
    else if (this.dash.state !== 'dashing' && this.avatarT < 0 && !this.sun.casting && Math.abs(this.vx) > 25) this.facing = Math.sign(this.vx);

    // ---------------- animação
    const speed = length(this.vx, this.vy);
    const a = this.animator;
    a.facing = this.facing;
    a.runRate = speed / maxSpeed;
    a.set(this.pickAnim(speed));
    if (this.combo.attacking && this.combo.current) {
      const s = this.combo.current;
      const e = this.combo.elapsed;
      if (this.combo.phase === 'windup') {
        a.attackPhase = 'windup';
        a.phaseT = e / s.windup;
      } else if (this.combo.phase === 'active') {
        a.attackPhase = 'active';
        a.phaseT = (e - s.windup) / s.active;
      } else {
        a.attackPhase = 'recovery';
        a.phaseT = (e - s.windup - s.active) / s.recovery;
      }
    } else if (this.spell.casting || this.sun.casting) {
      const sp = this.spell.casting ? this.spell : this.sun;
      const p = sp.elapsed / sp.def.castTime;
      a.attackPhase = p < 0.85 ? 'windup' : 'active';
      a.phaseT = p < 0.85 ? p / 0.85 : (p - 0.85) / 0.15;
    } else if (a.state === 'cast' || a.state === 'cast_sun') {
      a.attackPhase = 'recovery';
      a.phaseT = 1;
    }
    a.update(dt, this.x, this.y, this.y);
    for (const ev of a.events) if (ev.frame?.event === 'step') this.hooks.onFootstep(this.x, this.y);
    a.setAlpha(this.postHitInvuln > 0 && Math.floor(this.postHitInvuln / 70) % 2 === 0 ? 0.5 : 1);
    this.syncAux();
  }

  private pickAnim(speed: number): AnimState {
    if (this.cinematic) return 'cinematic';
    if (this.stunned) return 'bloodStunned';
    if (this.avatarT >= 0) return 'avatar';
    if (this.dash.state === 'dashing') return this.radiant ? 'dash_radiant' : 'dash';
    if (this.hurtTimer > 0 && !this.combo.attacking) return 'hurt';
    if (this.sun.casting) return 'cast_sun';
    if (this.spell.casting) return 'cast';
    if (this.combo.attacking && this.combo.current) {
      const id = this.combo.current.id;
      return id === 'attack_3' && this.gifts.has('glory_blade') ? 'attack_3_glory' : id;
    }
    if (this.dash.state === 'recovering') return this.radiant ? 'dash_radiant' : 'dash';
    // pequena margem evita alternar idle/run em velocidades mínimas
    return speed > 45 ? 'run' : 'idle';
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
    if (!this.stunned) this.hurtTimer = HURT_TIME;
    this.knock.x = hit.dirX * hit.knockback * (this.stunned ? 0.2 : 0.7);
    this.knock.y = hit.dirY * hit.knockback * (this.stunned ? 0.2 : 0.7);
    if (this.combo.phase === 'windup') this.combo.interrupt();
    if (this.spell.casting) this.spell.cancel();
    if (this.sun.casting) this.sun.cancel();
    this.animator.flash(80);
    this.hooks.onDamaged(dealt, hit);
    if (this.health.dead) this.die();
    return dealt;
  }

  heal(amount: number): number {
    return this.health.heal(amount);
  }

  addGlory(n: number): void {
    if (!this.gifts.has('avatar')) return;
    this.glory = Math.min(AVATAR.gloryMax, this.glory + n);
  }

  private die(): void {
    this.dead = true;
    this.stunned = false;
    this.avatarT = -1;
    this.combo.interrupt();
    this.dash.stop();
    this.spell.cancel();
    this.sun.cancel();
    this.clearInput();
    this.vx = this.vy = 0;
    this.animator.play('dead', true);
    this.hooks.onDeath();
  }

  setVisible(v: boolean): void {
    this.animator.setVisible(v);
    this.shadow.setVisible(v);
    this.glow.setVisible(v);
  }

  destroy(): void {
    this.animator.destroy();
    this.shadow.destroy();
    this.glow.destroy();
  }
}
