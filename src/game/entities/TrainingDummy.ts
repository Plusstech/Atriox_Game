import Phaser from 'phaser';
import type { Hurtbox } from '../combat/HitboxSystem';
import { DEPTH } from '../config/constants';
import { newEntityId, type Combatant, type HitInfo } from './types';

/** Boneco de treino do tutorial: recebe golpes, nunca morre, não ataca. */
export class TrainingDummy implements Combatant {
  readonly id = newEntityId();
  readonly hurtbox: Hurtbox;
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private wobble?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number
  ) {
    this.hurtbox = { id: this.id, team: 'neutral', x, y, radius: 20, alive: true, invulnerable: false };
    this.shadow = scene.add.image(x, y + 2, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(70, 22);
    this.sprite = scene.add.image(x, y, 'dummy').setOrigin(0.5, 0.97).setDepth(y).setScale(0.8);
  }

  receiveHit(hit: HitInfo): number {
    this.wobble?.stop();
    this.sprite.setAngle(0);
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.sprite.active && this.sprite.clearTint());
    const dir = hit.dirX >= 0 ? 1 : -1;
    this.wobble = this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: dir * Math.min(22, 6 + hit.knockback / 30), to: 0 },
      duration: 520,
      ease: 'Elastic.easeOut'
    });
    return Math.round(hit.damage);
  }

  destroy(): void {
    this.wobble?.stop();
    this.sprite.destroy();
    this.shadow.destroy();
    this.hurtbox.alive = false;
  }
}
