import Phaser from 'phaser';
import type { BloodPoolSystem } from '../combat/Blood';
import { DEPTH } from '../config/constants';

/**
 * Desenho das poças de sangue (só apresentação).
 * A área lógica é o círculo do BloodPoolSystem; aqui desenhamos exatamente
 * esse círculo (borda legível) + superfície animada por dentro.
 */
export class BloodRenderer {
  private g: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.groundFx - 2);
  }

  draw(sys: BloodPoolSystem, dt: number): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    for (const p of sys.pools) {
      if (p.state === 'warning') {
        const k = Math.min(1, p.t / p.warnMs);
        // anúncio: anel tracejado pulsante + preenchimento que cresce do centro
        g.fillStyle(0x6a0a10, 0.18 + 0.12 * k);
        g.fillCircle(p.x, p.y, p.r * k);
        g.lineStyle(3, 0xff3040, 0.5 + 0.4 * Math.abs(Math.sin(this.t / 90)));
        const seg = 20;
        for (let i = 0; i < seg; i += 2) {
          const a0 = (i / seg) * Math.PI * 2 + this.t / 900;
          const a1 = ((i + 1) / seg) * Math.PI * 2 + this.t / 900;
          g.beginPath();
          g.arc(p.x, p.y, p.r, a0, a1, false);
          g.strokePath();
        }
        continue;
      }
      const fade = p.state === 'fading' ? 1 - p.t / p.fadeMs : 1;
      const purified = p.purified > 0;
      const base = purified ? 0x8a6a2a : 0x5e0710;
      const mid = purified ? 0xd0a040 : 0x9a0c18;
      g.fillStyle(base, 0.78 * fade);
      g.fillCircle(p.x, p.y, p.r);
      // superfície animada: ondas concêntricas e brilho úmido
      for (let k = 0; k < 3; k++) {
        const ph = ((this.t / 1400 + k / 3) % 1);
        g.lineStyle(2, mid, (1 - ph) * 0.55 * fade);
        g.strokeCircle(p.x, p.y, p.r * (0.25 + 0.72 * ph));
      }
      g.fillStyle(mid, 0.35 * fade);
      g.fillCircle(p.x - p.r * 0.2, p.y - p.r * 0.15, p.r * 0.45);
      g.fillStyle(0xffc0c0, 0.12 * fade);
      g.fillCircle(p.x - p.r * 0.35, p.y - p.r * 0.3, p.r * 0.14);
      // borda legível
      g.lineStyle(3, purified ? 0xffe08a : 0xff2a3a, 0.85 * fade);
      g.strokeCircle(p.x, p.y, p.r);
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}
