import Phaser from 'phaser';
import { TOKNAR } from '../../data/v03';
import { ToknarBrain } from '../ai/ToknarBrain';
import { Health } from '../combat/DamageSystem';
import type {
  ActiveHitbox,
  HitboxSystem,
  Hurtbox,
} from '../combat/HitboxSystem';
import { length, normalize } from '../combat/geometry';
import { SpriteAnimator, type AnimLibrary } from '../animation/SpriteAnimator';
import type { Effects } from '../fx/Effects';
import {
  newEntityId,
  type CollideFn,
  type Combatant,
  type HitInfo,
} from './types';
import { DEPTH } from '../config/constants';
import { Sfx } from '../audio/Sfx';

export class Toknar implements Combatant {
  readonly id = newEntityId();
  readonly brain = new ToknarBrain();
  readonly health = new Health(TOKNAR.hp);
  readonly hurtbox: Hurtbox;
  readonly name = 'TOKNAR';
  readonly title = 'Rhaesis, o machado faminto';
  readonly def = TOKNAR;
  scripted = false;
  removed = false;
  facing = 1;
  angle = 0;
  private anim: SpriteAnimator;
  private shadow: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private owned: ActiveHitbox[] = [];
  constructor(
    private scene: Phaser.Scene,
    lib: AnimLibrary,
    public x: number,
    public y: number,
    private ctx: {
      hitboxes: HitboxSystem;
      effects: Effects;
      collide: CollideFn;
      onDeath(): void;
      onPhase(): void;
    },
  ) {
    this.hurtbox = {
      id: this.id,
      team: 'enemy',
      x,
      y,
      radius: TOKNAR.radius,
      alive: true,
      invulnerable: false,
    };
    this.anim = new SpriteAnimator(scene, lib, 'toknar', x, y, 'toknar.idle');
    this.anim.sprite.setScale(0.72);
    this.shadow = scene.add
      .image(x, y, 'shadow')
      .setDisplaySize(145, 43)
      .setDepth(DEPTH.shadow);
    this.g = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.brain.start();
  }
  get dead(): boolean {
    return this.brain.state === 'dead';
  }
  get hpRatio(): number {
    return this.health.ratio;
  }
  get chestY(): number {
    return this.y - 110;
  }
  update(dt: number, p: { x: number; y: number; dead: boolean }): void {
    if (this.removed || this.dead) return;
    const b = this.brain;
    const dist = length(p.x - this.x, p.y - this.y);
    for (const ev of b.update(dt, p.dead ? 99999 : dist, this.hpRatio)) {
      if (ev === 'phase') {
        this.cancel();
        this.ctx.onPhase();
        Sfx.bossRoar();
      }
      if (ev === 'windup') {
        this.angle = Math.atan2(p.y - this.y, p.x - this.x);
        Sfx.telegraph(true);
      }
      if (ev === 'strike') this.strike();
      if (ev === 'end') this.cancel();
      if (ev === 'heal') {
        const n = this.health.heal(TOKNAR.feastHeal);
        this.ctx.effects.floatingText(
          this.x,
          this.chestY,
          `+${n} Rhaesis`,
          '#f06060',
          19,
        );
      }
    }
    const st = b.state;
    let vx = 0,
      vy = 0;
    if (st === 'chase' && dist > 120) {
      const n = normalize(p.x - this.x, p.y - this.y);
      vx = n.x * TOKNAR.speed;
      vy = n.y * TOKNAR.speed;
      this.facing = n.x >= 0 ? 1 : -1;
    }
    if (st === 'active' && (b.move === 'charge' || b.move === 'spin')) {
      const sp = b.move === 'charge' ? 730 : 150;
      vx = Math.cos(this.angle) * sp;
      vy = Math.sin(this.angle) * sp;
    }
    const r = this.ctx.collide(
      this.x + (vx * dt) / 1000,
      this.y + (vy * dt) / 1000,
      TOKNAR.radius,
    );
    this.x = r.x;
    this.y = r.y;
    if (st === 'active' && b.move === 'charge' && r.blocked) {
      this.cancel();
      b.state = 'recovery';
      b.timer = 0;
    }
    const key =
      st === 'transition'
        ? 'rage'
        : st === 'chase'
          ? 'run'
          : st === 'windup' || st === 'active' || st === 'recovery'
            ? b.move
            : st === 'broken'
              ? 'feast'
              : 'idle';
    this.anim.play(`toknar.${key}`);
    if (st === 'windup' || st === 'active' || st === 'recovery')
      this.anim.sync(
        st === 'windup' ? 'windup' : st === 'active' ? 'active' : 'recovery',
        b.timer /
          (st === 'windup'
            ? TOKNAR.moves[b.move].windup
            : st === 'recovery'
              ? TOKNAR.moves[b.move].recovery
              : b.move === 'cleave'
                ? 1280
                : TOKNAR.moves[b.move].active),
      );
    else this.anim.update(dt);
    this.anim.sprite
      .setPosition(this.x, this.y)
      .setDepth(this.y)
      .setFlipX(this.facing < 0);
    this.shadow.setPosition(this.x, this.y);
    Object.assign(this.hurtbox, {
      x: this.x,
      y: this.y,
      invulnerable: st === 'transition',
    });
    this.g.clear();
    if (st === 'windup' || (st === 'active' && b.move === 'feast')) {
      const m = TOKNAR.moves[b.move];
      const col = b.move === 'feast' ? 0x80e0d0 : 0xef3434;
      this.g.lineStyle(3, col, 0.9);
      this.g.fillStyle(col, 0.12);
      if (b.move === 'charge') {
        const ex = this.x + Math.cos(this.angle) * 450,
          ey = this.y + Math.sin(this.angle) * 450;
        this.g.lineBetween(this.x, this.y, ex, ey);
        this.g.strokeCircle(ex, ey, 60);
      } else {
        this.g.slice(
          this.x,
          this.y,
          b.move === 'feast' ? 100 : m.radius,
          this.angle - (b.move === 'spin' ? Math.PI : 1.25),
          this.angle + (b.move === 'spin' ? Math.PI : 1.25),
        );
        this.g.fillPath();
        this.g.strokePath();
      }
    }
  }
  private strike(): void {
    const m = TOKNAR.moves[this.brain.move];
    const spin = this.brain.move === 'spin',
      charge = this.brain.move === 'charge';
    this.owned.push(
      this.ctx.hitboxes.spawn({
        shape:
          spin || charge
            ? { kind: 'circle', x: this.x, y: this.y, radius: m.radius }
            : {
                kind: 'sector',
                x: this.x,
                y: this.y,
                radius: m.radius,
                angle: this.angle,
                halfArc: 1.25,
              },
        team: 'enemy',
        damage: m.damage,
        knockback: 300,
        duration: spin || charge ? m.active : 150,
        tag: `toknar_${this.brain.move}`,
        follow: () => ({ x: this.x, y: this.y }),
      }),
    );
    Sfx.swing(2);
  }
  confirmedDrain(dealt: number): void {
    const n = this.brain.drain(dealt);
    if (n > 0) {
      this.health.heal(n);
      this.ctx.effects.floatingText(
        this.x,
        this.chestY,
        `+${Math.round(n)}`,
        '#f06060',
        14,
      );
    }
  }
  receiveHit(hit: HitInfo): number {
    if (this.dead || this.hurtbox.invulnerable) return 0;
    const broken = this.brain.state === 'broken';
    const dealt = this.health.damage(hit.damage * (broken ? 1.3 : 1));
    if (
      this.brain.hitPosture(
        hit.posture ??
          (hit.tag === 'charged' ? 85 : hit.heavy ? 40 : hit.basic ? 13 : 5),
      )
    ) {
      this.cancel();
      this.ctx.effects.floatingText(
        this.x,
        this.chestY,
        'POSTURA QUEBRADA',
        '#80e0d0',
        20,
      );
    }
    if (this.health.dead) {
      this.brain.kill();
      this.cancel();
      this.hurtbox.alive = false;
      this.g.clear();
      this.scene.tweens.add({
        targets: this.anim.sprite,
        alpha: 0,
        duration: 1100,
      });
      this.ctx.onDeath();
    }
    return dealt;
  }
  private cancel(): void {
    this.owned.forEach((h) => h.cancel());
    this.owned = [];
  }
  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.cancel();
    this.scene.tweens.killTweensOf(this.anim.sprite);
    this.anim.destroy();
    this.shadow.destroy();
    this.g.destroy();
  }
}
