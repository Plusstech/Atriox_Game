import Phaser from 'phaser';
import { shapeHitsCircle } from './geometry';
import type { Hurtbox, Team } from './HitboxSystem';

export interface ProjectileSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  radius: number;
  team: Team;
  texture: string;
  /** altura visual acima do chão (o projétil "voa" na altura do peito) */
  height?: number;
  tint?: number;
  additive?: boolean;
  scale?: number;
  trail?: { texture: string; tint: number; frequency: number; scale: number; lifespan: number };
  /** chamado ao atingir um alvo; retorna true para destruir o projétil */
  onHit(target: Hurtbox, p: Projectile): boolean;
  /** chamado quando o projétil termina (alcance, parede ou impacto) */
  onEnd?(x: number, y: number, p: Projectile): void;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled = 0;
  dead = false;
  readonly hitIds = new Set<number>();
  sprite: Phaser.GameObjects.Image;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, public readonly spec: ProjectileSpec) {
    this.x = spec.x;
    this.y = spec.y;
    this.vx = Math.cos(spec.angle) * spec.speed;
    this.vy = Math.sin(spec.angle) * spec.speed;
    const h = spec.height ?? 40;
    this.shadow = scene.add.image(this.x, this.y, 'shadow').setDisplaySize(spec.radius * 2.4, spec.radius).setAlpha(0.5).setDepth(-70000);
    this.sprite = scene.add.image(this.x, this.y - h, spec.texture).setRotation(spec.angle);
    if (spec.scale) this.sprite.setScale(spec.scale);
    if (spec.tint !== undefined) this.sprite.setTint(spec.tint);
    if (spec.additive) this.sprite.setBlendMode(Phaser.BlendModes.ADD);
    if (spec.trail) {
      this.trail = scene.add.particles(0, 0, spec.trail.texture, {
        speed: { min: 5, max: 40 },
        lifespan: spec.trail.lifespan,
        scale: { start: spec.trail.scale, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: spec.trail.tint,
        blendMode: 'ADD',
        frequency: spec.trail.frequency
      });
      this.trail.startFollow(this.sprite);
    }
  }

  get height(): number {
    return this.spec.height ?? 40;
  }

  sync(): void {
    this.sprite.setPosition(this.x, this.y - this.height);
    this.sprite.setDepth(this.y + 5);
    this.trail?.setDepth(this.y + 4);
    this.shadow.setPosition(this.x, this.y);
  }

  destroy(): void {
    this.dead = true;
    this.sprite.destroy();
    this.shadow.destroy();
    if (this.trail) {
      const t = this.trail;
      t.stopFollow();
      t.stop();
      t.scene?.time.delayedCall(600, () => t.destroy());
    }
  }
}

/** Projéteis (flechas, Chama do Julgamento). Colisão própria contra hurtboxes e cenário. */
export class ProjectileSystem {
  private list: Projectile[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly blocked: (x: number, y: number) => boolean
  ) {}

  get count(): number {
    return this.list.length;
  }

  fire(spec: ProjectileSpec): Projectile {
    const p = new Projectile(this.scene, spec);
    p.sync();
    this.list.push(p);
    return p;
  }

  update(dt: number, targets: readonly Hurtbox[]): void {
    for (const p of this.list) {
      if (p.dead) continue;
      // sub-passos evitam atravessar alvos em velocidade alta
      const stepLen = Math.max(1, Math.ceil((p.spec.speed * dt) / 1000 / 12));
      const sdt = dt / stepLen;
      for (let i = 0; i < stepLen && !p.dead; i++) {
        const dx = (p.vx * sdt) / 1000;
        const dy = (p.vy * sdt) / 1000;
        p.x += dx;
        p.y += dy;
        p.traveled += Math.sqrt(dx * dx + dy * dy);
        for (const t of targets) {
          if (!t.alive || t.invulnerable || t.team === p.spec.team || p.hitIds.has(t.id)) continue;
          if (shapeHitsCircle({ kind: 'circle', x: p.x, y: p.y, radius: p.spec.radius }, t.x, t.y, t.radius)) {
            p.hitIds.add(t.id);
            if (p.spec.onHit(t, p)) {
              this.end(p);
              break;
            }
          }
        }
        if (p.dead) break;
        if (p.traveled >= p.spec.range || this.blocked(p.x, p.y)) this.end(p);
      }
      if (!p.dead) p.sync();
    }
    this.list = this.list.filter((p) => !p.dead);
  }

  private end(p: Projectile): void {
    if (p.dead) return;
    p.spec.onEnd?.(p.x, p.y, p);
    p.destroy();
  }

  /** Remove projéteis de um time (ex.: transição de fase). */
  clearTeam(team: Team): void {
    for (const p of this.list) if (p.spec.team === team) p.destroy();
    this.list = this.list.filter((p) => !p.dead);
  }

  clear(): void {
    for (const p of this.list) p.destroy();
    this.list = [];
  }
}
