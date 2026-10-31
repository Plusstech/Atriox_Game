import Phaser from 'phaser';
import type { Hurtbox } from '../combat/HitboxSystem';
import { DEPTH } from '../config/constants';
import { ATLAS_KEY } from '../animation/SpriteAnimator';
import { newEntityId, type Combatant, type HitInfo } from './types';

/**
 * Boneco de treino do tutorial: recebe golpes, nunca morre, não ataca.
 * v0.5: quadros desenhados (boneco_treino_quebra_v2): parado, duas reações
 * ao golpe e três de quebra quando a Provação começa. Sem o atlas, usa a
 * textura procedural antiga.
 */
export class TrainingDummy implements Combatant {
  readonly id = newEntityId();
  readonly hurtbox: Hurtbox;
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private wobble?: Phaser.Tweens.Tween;
  private readonly atlas: boolean;
  private hits = 0;
  private restTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number
  ) {
    this.hurtbox = { id: this.id, team: 'neutral', x, y, radius: 20, alive: true, invulnerable: false };
    this.shadow = scene.add.image(x, y + 2, 'shadow').setDepth(DEPTH.shadow).setDisplaySize(70, 22);
    this.atlas = scene.textures.exists(ATLAS_KEY) && scene.textures.get(ATLAS_KEY).has('dummy_00');
    if (this.atlas) {
      const o = scene.registry.get('animLibrary')?.origins?.dummy ?? { originX: 0.5, originY: 0.95 };
      this.sprite = scene.add.image(x, y, ATLAS_KEY, 'dummy_00').setOrigin(o.originX, o.originY).setDepth(y).setScale(0.8);
    } else {
      this.sprite = scene.add.image(x, y, 'dummy').setOrigin(0.5, 0.97).setDepth(y).setScale(0.8);
    }
  }

  receiveHit(hit: HitInfo): number {
    this.wobble?.stop();
    this.sprite.setAngle(0);
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.sprite.active && this.sprite.clearTint());
    const dir = hit.dirX >= 0 ? 1 : -1;
    if (this.atlas) {
      // reação desenhada (alterna as duas poses) e volta à pose parada
      this.sprite.setFrame(this.hits++ % 2 === 0 ? 'dummy_01' : 'dummy_02');
      this.sprite.setFlipX(dir < 0);
      this.restTimer?.remove();
      this.restTimer = this.scene.time.delayedCall(260, () => this.sprite.active && this.sprite.setFrame('dummy_00').setFlipX(false));
    }
    this.wobble = this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: dir * Math.min(this.atlas ? 10 : 22, 4 + hit.knockback / 40), to: 0 },
      duration: 520,
      ease: 'Elastic.easeOut'
    });
    return Math.round(hit.damage);
  }

  /** Quebra desenhada (3 quadros) e some; usado quando a Provação começa. */
  shatter(): void {
    this.hurtbox.alive = false;
    this.wobble?.stop();
    this.restTimer?.remove();
    if (!this.atlas) {
      this.destroy();
      return;
    }
    this.sprite.setAngle(0).clearTint();
    const frames = ['dummy_03', 'dummy_04', 'dummy_05'];
    frames.forEach((f, i) => this.scene.time.delayedCall(i * 110, () => this.sprite.active && this.sprite.setFrame(f)));
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, delay: 900, duration: 500, onComplete: () => this.destroy() });
  }

  destroy(): void {
    this.wobble?.stop();
    this.restTimer?.remove();
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.sprite.destroy();
    this.shadow.destroy();
    this.hurtbox.alive = false;
  }
}
