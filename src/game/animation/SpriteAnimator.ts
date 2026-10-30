import Phaser from 'phaser';
import { FrameTimeline, type AnimDef, type AnimPhase, type TimelineEvent } from './FrameTimeline';

export const ATLAS_KEY = 'characters';

/** Animações e origens carregadas do atlas (preenchido no BootScene). */
export interface AnimLibrary {
  anims: Record<string, AnimDef>;
  origins: Record<string, { originX: number; originY: number; sourceW: number; sourceH: number }>;
}

export function getLibrary(scene: Phaser.Scene): AnimLibrary {
  return scene.registry.get('animLibrary') as AnimLibrary;
}

/**
 * Liga uma FrameTimeline (lógica pura) a um Sprite do Phaser.
 * - A origem do sprite é fixa por personagem (pivô nos pés), então trocar
 *   de quadro nunca desloca o personagem.
 * - `play()` com a mesma animação não reinicia.
 */
export class SpriteAnimator {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly timeline = new FrameTimeline();
  private currentName = '';
  speed = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly lib: AnimLibrary,
    readonly char: string,
    x: number,
    y: number,
    initial: string
  ) {
    const o = lib.origins[char] ?? { originX: 0.5, originY: 0.95 };
    const def = lib.anims[initial];
    this.sprite = scene.add.sprite(x, y, ATLAS_KEY, def?.frames[0].name);
    this.sprite.setOrigin(o.originX, o.originY);
    if (def) this.play(initial, true);
  }

  get key(): string | null {
    return this.timeline.key;
  }

  has(key: string): boolean {
    return !!this.lib.anims[key];
  }

  def(key: string): AnimDef | undefined {
    return this.lib.anims[key];
  }

  play(key: string, restart = false): TimelineEvent[] {
    const d = this.lib.anims[key];
    if (!d) return [];
    const ev = this.timeline.play(d, restart);
    this.apply();
    return ev;
  }

  update(dt: number, rate = 1): TimelineEvent[] {
    const ev = this.timeline.update(dt * this.speed, rate);
    if (ev.length) this.apply();
    return ev;
  }

  sync(phase: AnimPhase, progress: number): TimelineEvent[] {
    const ev = this.timeline.sync(phase, progress);
    if (ev.length) this.apply();
    return ev;
  }

  /** Mostra um quadro específico (inspetor de animações). */
  showIndex(i: number): void {
    const d = this.timeline.def;
    if (!d) return;
    this.timeline.index = Math.max(0, Math.min(d.frames.length - 1, i));
    this.timeline.t = 0;
    this.apply();
  }

  private apply(): void {
    const f = this.timeline.frame;
    if (!f || f.name === this.currentName) return;
    this.currentName = f.name;
    this.sprite.setFrame(f.name, false, false);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
