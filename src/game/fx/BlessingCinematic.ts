import Phaser from 'phaser';
import { ATLAS_KEY, type AnimLibrary } from '../animation/SpriteAnimator';
import { ATRIOX_SCALE, DEPTH } from '../config/constants';

/**
 * Cena: Apollon abençoa Atriox (proposta narrativa após a vitória sobre Caim).
 *
 * Usa os 6 quadros compostos da folha da bênção com crossfade em camadas
 * (dois sprites alternando opacidade), luz aditiva e o texto da citação.
 * Se o atlas não estiver disponível, a cena roda só com luz e texto.
 */
export class BlessingCinematic {
  private a: Phaser.GameObjects.Sprite | null = null;
  private b: Phaser.GameObjects.Sprite | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private frames: { name: string; ms: number }[] = [];
  private index = -1;
  private t = 0;
  private elapsed = 0;
  done = false;
  /** momentos-chave para a UI */
  quoteShown = false;
  readonly skipAfter = 1500;
  private onQuote: () => void;
  private onEnd: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    lib: AnimLibrary | undefined,
    x: number,
    private readonly y: number,
    facing: number,
    hooks: { onQuote: () => void; onEnd: () => void }
  ) {
    this.onQuote = hooks.onQuote;
    this.onEnd = hooks.onEnd;
    const def = lib?.anims['apollon.blessing'];
    const o = lib?.origins['apollon'];
    if (def && o && scene.textures.exists(ATLAS_KEY)) {
      this.frames = def.frames.map((f) => ({ name: f.name, ms: f.ms }));
      for (const k of ['a', 'b'] as const) {
        const s = scene.add.sprite(x, y, ATLAS_KEY, this.frames[0].name).setOrigin(o.originX, o.originY).setScale(ATRIOX_SCALE).setDepth(y + 1).setAlpha(0);
        s.setFlipX(facing < 0);
        this[k] = s;
      }
    } else {
      this.frames = [1500, 1500, 1400, 1300, 1600, 2200].map((ms, i) => ({ name: String(i), ms }));
    }
    this.glow = scene.add.image(x, y - 80, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd77a).setDepth(DEPTH.groundFx + 30).setAlpha(0);
    this.glow.setDisplaySize(700, 520);
    this.next();
  }

  get canSkip(): boolean {
    return this.elapsed >= this.skipAfter && !this.done;
  }

  private next(): void {
    this.index++;
    this.t = 0;
    if (this.index >= this.frames.length) {
      this.finish();
      return;
    }
    if (this.index === 2 && !this.quoteShown) {
      this.quoteShown = true;
      this.onQuote();
    }
    // crossfade: o sprite "de cima" assume o quadro novo e aparece sobre o anterior
    if (this.a && this.b) {
      const top = this.index % 2 === 0 ? this.a : this.b;
      const bottom = top === this.a ? this.b : this.a;
      top.setFrame(this.frames[this.index].name, false, false);
      top.setDepth(this.y + 2);
      bottom.setDepth(this.y + 1);
      this.scene.tweens.add({ targets: top, alpha: 1, duration: this.index === 0 ? 500 : 320, ease: 'Sine.easeInOut' });
      this.scene.tweens.add({ targets: bottom, alpha: 0, delay: 200, duration: 320 });
    }
    const glowA = [0.15, 0.35, 0.6, 0.85, 0.7, 0.25][this.index] ?? 0.2;
    if (this.glow) this.scene.tweens.add({ targets: this.glow, alpha: glowA, duration: 500 });
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    this.elapsed += dt;
    if (this.t >= this.frames[this.index].ms) this.next();
  }

  /** Pula para o final (sem cortes bruscos: fade rápido). */
  skip(): void {
    if (this.done) return;
    if (!this.quoteShown) {
      this.quoteShown = true;
      this.onQuote();
    }
    this.index = this.frames.length - 2;
    this.next();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    const targets = [this.a, this.b, this.glow].filter((x) => !!x);
    this.scene.tweens.add({ targets, alpha: 0, duration: 600, onComplete: () => this.destroy() });
    this.onEnd();
  }

  destroy(): void {
    for (const o of [this.a, this.b, this.glow]) o?.destroy();
    this.a = this.b = this.glow = null;
  }
}
