import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { flashAllowed, particleScale, save, shakeScale } from '../services';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Efeitos audiovisuais de combate. Somente apresentação:
 * nenhuma regra de dano vive aqui.
 */
export class Effects {
  private sparks: Emitter;
  private embers: Emitter;
  private smoke: Emitter;
  private dust: Emitter;
  private blood: Emitter;
  private glow: Emitter;

  constructor(private readonly scene: Phaser.Scene) {
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = DEPTH.overlayFx - 10): Emitter => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, maxParticles: 32, ...cfg });
      e.setDepth(depth);
      return e;
    };
    this.sparks = mk('p_spark', {
      speed: { min: 140, max: 420 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 220, max: 480 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      gravityY: 380
    });
    this.embers = mk('p_ember', {
      speed: { min: 30, max: 160 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 500, max: 1200 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      gravityY: -60
    });
    this.smoke = mk(
      'p_smoke',
      {
        speed: { min: 10, max: 70 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 600, max: 1100 },
        scale: { start: 0.6, end: 1.8 },
        alpha: { start: 0.7, end: 0 },
        gravityY: -30
      },
      DEPTH.groundFx + 5
    );
    this.dust = mk(
      'p_dust',
      {
        speed: { min: 20, max: 80 },
        angle: { min: 180, max: 360 },
        lifespan: { min: 300, max: 600 },
        scale: { start: 0.8, end: 1.6 },
        alpha: { start: 0.6, end: 0 }
      },
      DEPTH.groundFx
    );
    this.blood = mk(
      'p_blood',
      {
        speed: { min: 60, max: 220 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 250, max: 500 },
        scale: { start: 1, end: 0.3 },
        alpha: { start: 0.9, end: 0 },
        gravityY: 500
      },
      DEPTH.overlayFx - 20
    );
    this.glow = mk('p_glow', {
      speed: { min: 0, max: 30 },
      lifespan: { min: 200, max: 400 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.7, end: 0 },
      blendMode: 'ADD'
    });
  }

  private q(n: number): number {
    return Math.max(1, Math.round(n * particleScale()));
  }

  shake(duration: number, intensity: number): void {
    const s = shakeScale();
    if (s <= 0 || intensity <= 0) return;
    this.scene.cameras.main.shake(duration, intensity * s, false);
  }

  flash(duration: number, r: number, g: number, b: number): void {
    if (!flashAllowed()) return;
    this.scene.cameras.main.flash(duration, r, g, b, false);
  }

  /** Faíscas direcionais + brilho no ponto de impacto. */
  hitSpark(x: number, y: number, angle: number, heavy = false, tint = 0xffd77a): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(this.q(heavy ? 18 : 9), x, y);
    this.glow.setParticleTint(tint);
    this.glow.explode(heavy ? 2 : 1, x, y);
    const n = this.q(heavy ? 7 : 4);
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * 1.2;
      const s = this.scene.add.image(x, y, 'p_streak').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlayFx).setTint(tint);
      s.setRotation(a);
      s.setScale(heavy ? 1.6 : 1.1, 1);
      const d = (heavy ? 90 : 60) + Math.random() * 40;
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        scaleX: 0.1,
        alpha: 0,
        duration: 180 + Math.random() * 120,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy()
      });
    }
  }

  bloodSpray(x: number, y: number): void {
    this.blood.explode(this.q(6), x, y);
  }

  /** Arco de lâmina (textura em crescente) orientado pelo ângulo do golpe. */
  slash(x: number, y: number, angle: number, key: string, radius: number, opts: { flipY?: boolean; duration?: number; tint?: number; arcSpin?: number } = {}): void {
    const img = this.scene.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlayFx - 5);
    const s = radius / 128;
    img.setRotation(angle - (opts.arcSpin ?? 0.35) * (opts.flipY ? -1 : 1));
    img.setScale(s * 0.82, s * 0.82 * (opts.flipY ? -1 : 1));
    if (opts.tint !== undefined) img.setTint(opts.tint);
    this.scene.tweens.add({
      targets: img,
      rotation: angle + (opts.arcSpin ?? 0.35) * (opts.flipY ? -1 : 1),
      scaleX: s * 1.04,
      scaleY: s * 1.04 * (opts.flipY ? -1 : 1),
      duration: opts.duration ?? 150,
      ease: 'Cubic.easeOut'
    });
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      delay: (opts.duration ?? 150) * 0.45,
      duration: (opts.duration ?? 150) * 0.9,
      onComplete: () => img.destroy()
    });
  }

  /**
   * Efeito desenhado (atlas): toca os quadros `names` uma vez e some.
   * Rastros e fissuras das folhas de VFX ficam separados do corpo do personagem.
   */
  atlasFx(
    x: number,
    y: number,
    names: string[],
    opts: { frameMs?: number; flipX?: boolean; rotation?: number; scale?: number; scaleX?: number; scaleY?: number; depth?: number; blend?: boolean; alpha?: number; tint?: number } = {}
  ): Phaser.GameObjects.Sprite | null {
    if (!names.length || !this.scene.textures.exists('characters')) return null;
    const tex = this.scene.textures.get('characters');
    const frames = names.filter((n) => tex.has(n));
    if (!frames.length) return null;
    const s = this.scene.add
      .sprite(x, y, 'characters', frames[0])
      .setOrigin(0.5)
      .setFlipX(!!opts.flipX)
      .setRotation(opts.rotation ?? 0)
      .setScale(opts.scaleX ?? opts.scale ?? 1, opts.scaleY ?? opts.scale ?? 1)
      .setAlpha(opts.alpha ?? 1)
      .setDepth(opts.depth ?? DEPTH.overlayFx - 40);
    if (opts.blend) s.setBlendMode(Phaser.BlendModes.ADD);
    if (opts.tint !== undefined) s.setTint(opts.tint);
    const ms = opts.frameMs ?? 55;
    let i = 0;
    this.scene.time.addEvent({
      delay: ms,
      repeat: frames.length - 1,
      callback: () => {
        i++;
        if (!s.active) return;
        if (i >= frames.length) s.destroy();
        else s.setFrame(frames[i]);
      }
    });
    return s;
  }

  dustPuff(x: number, y: number, n = 3): void {
    this.dust.explode(this.q(n), x, y);
  }

  embersAt(x: number, y: number, n = 6): void {
    this.embers.explode(this.q(n), x, y);
  }

  smokeAt(x: number, y: number, n = 4): void {
    this.smoke.explode(this.q(n), x, y);
  }

  shockRing(x: number, y: number, radius: number, tint: number, duration = 380, startScale = 0.2): void {
    const r = this.scene.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundFx + 10).setTint(tint);
    r.setScale(startScale * (radius / 118), startScale * (radius / 118) * 0.62);
    this.scene.tweens.add({
      targets: r,
      scaleX: radius / 118,
      scaleY: (radius / 118) * 0.62,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => r.destroy()
    });
  }

  explosion(x: number, y: number, radius: number): void {
    const core = this.scene.add.image(x, y - 10, 'p_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlayFx).setTint(0xffd27a);
    core.setScale(0.4);
    this.scene.tweens.add({
      targets: core,
      scale: (radius / 32) * 1.5,
      alpha: { from: 1, to: 0 },
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => core.destroy()
    });
    this.shockRing(x, y, radius * 1.2, 0xff9b3d, 420);
    this.sparks.setParticleTint(0xffc060);
    this.sparks.explode(this.q(26), x, y - 10);
    this.embers.explode(this.q(20), x, y);
    this.smoke.explode(this.q(8), x, y - 10);
    this.scorch(x, y, radius * 0.7);
  }

  /** Marca de queimadura temporária no chão. */
  scorch(x: number, y: number, r: number): void {
    const s = this.scene.add.image(x, y, 'shadow').setDepth(DEPTH.decal + 10).setAlpha(0.55).setTint(0x1a0a04);
    s.setDisplaySize(r * 2.2, r * 1.1);
    this.scene.tweens.add({ targets: s, alpha: 0, delay: 3500, duration: 2500, onComplete: () => s.destroy() });
  }

  /** Imagem fantasma (afterimage) de um sprite, para o dash. */
  afterimage(src: Phaser.GameObjects.Sprite, tint = 0xffc860): void {
    const g = this.scene.add.image(src.x, src.y, src.texture.key, src.frame.name);
    g.setOrigin(src.originX, src.originY);
    g.setScale(src.scaleX, src.scaleY);
    g.setFlipX(src.flipX);
    g.setRotation(src.rotation);
    g.setDepth(src.depth - 1);
    g.setTintFill(tint);
    g.setAlpha(0.32);
    g.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  damageNumber(x: number, y: number, amount: number, color = '#f1e3c4', big = false): void {
    if (!save.data.settings.damageNumbers) return;
    const t = this.scene.add
      .text(x + (Math.random() - 0.5) * 20, y, `${amount}`, {
        fontFamily: 'Georgia, serif',
        fontSize: big ? '30px' : '20px',
        fontStyle: 'bold',
        color,
        stroke: '#140a08',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlayFx + 50);
    t.setScale(big ? 1.5 : 1.25);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      delay: 260,
      duration: 520,
      ease: 'Cubic.easeIn',
      onComplete: () => t.destroy()
    });
  }

  floatingText(x: number, y: number, text: string, color: string, size = 18): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, fontStyle: 'italic', color, stroke: '#140a08', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlayFx + 60);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
  }

  /** Selo no chão que antecede o surgimento de um inimigo. */
  spawnSigil(x: number, y: number, duration: number, tint = 0xd0473a): void {
    const s = this.scene.add.image(x, y, 'sigil').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundFx).setTint(tint);
    s.setScale(0.05, 0.03);
    this.scene.tweens.add({ targets: s, scaleX: 0.42, scaleY: 0.26, duration: duration * 0.5, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: s, angle: 90, duration });
    this.scene.tweens.add({ targets: s, alpha: { from: 0.9, to: 0 }, delay: duration * 0.8, duration: 400, onComplete: () => s.destroy() });
    const l = this.scene.add.image(x, y - 20, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundFx + 1).setTint(tint).setAlpha(0);
    l.setScale(0.6, 0.45);
    this.scene.tweens.add({ targets: l, alpha: 0.7, duration: duration * 0.9, yoyo: true, onComplete: () => l.destroy() });
  }

  spawnBurst(x: number, y: number, tint = 0xff6a3a): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(this.q(14), x, y - 30);
    this.smoke.explode(this.q(6), x, y - 10);
    this.shockRing(x, y, 70, tint, 300);
  }

  deathBurst(x: number, y: number, tint = 0xffb060): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(this.q(16), x, y - 30);
    this.embers.explode(this.q(14), x, y - 20);
    this.smoke.explode(this.q(6), x, y - 20);
  }

  /** Área de fogo persistente (visual). */
  groundFire(x: number, y: number, radius: number, duration: number): void {
    const base = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundFx + 2).setTint(0xff6a20);
    base.setDisplaySize(radius * 2.6, radius * 1.6);
    base.setAlpha(0);
    this.scene.tweens.add({ targets: base, alpha: 0.75, duration: 150 });
    this.scene.tweens.add({ targets: base, alpha: 0, delay: duration - 400, duration: 400, onComplete: () => base.destroy() });
    const fire = this.scene.add.particles(x, y, 'p_ember', {
      maxParticles: 20,
      x: { min: -radius * 0.85, max: radius * 0.85 },
      y: { min: -radius * 0.45, max: radius * 0.45 },
      speedY: { min: -120, max: -40 },
      speedX: { min: -15, max: 15 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 2.2, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD',
      frequency: 30 / particleScale(),
      quantity: 2
    });
    fire.setDepth(y);
    this.scene.time.delayedCall(duration, () => {
      fire.stop();
      this.scene.time.delayedCall(800, () => fire.destroy());
    });
  }

  telegraphPulse(x: number, y: number, tint = 0xff3b1f): void {
    const l = this.scene.add.image(x, y, 'p_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlayFx).setTint(tint);
    l.setScale(0.3);
    this.scene.tweens.add({ targets: l, scale: 1.4, alpha: { from: 1, to: 0 }, duration: 220, onComplete: () => l.destroy() });
  }
}
