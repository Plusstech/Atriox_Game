import { shapeHitsCircle, type Shape, type Vec } from './geometry';

export type Team = 'player' | 'enemy';

/** Corpo que pode ser atingido. */
export interface Hurtbox {
  id: number;
  team: Team | 'neutral';
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  invulnerable: boolean;
}

export interface HitboxSpec {
  shape: Shape;
  /** time de quem ataca: só atinge hurtboxes de outros times */
  team: Team;
  damage: number;
  knockback: number;
  /** atraso antes de ficar ativa (ms) */
  delay?: number;
  /** tempo ativa (ms) */
  duration: number;
  /** identifica a origem (ex.: 'attack_3', 'spell', 'boss_sweep') */
  tag: string;
  /** reposiciona a forma a cada atualização (ex.: seguir quem ataca) */
  follow?: () => Vec;
  /** desloca a forma (px/s) */
  velocity?: Vec;
  /** crescimento do raio/anel (px/s) */
  grow?: number;
  /** se definido, atinge o mesmo alvo novamente após este intervalo (ms) — áreas de dano contínuo */
  rehitInterval?: number;
  /** direção fixa do knockback; se ausente, empurra a partir do centro da forma */
  knockbackDir?: Vec;
  /** dados livres para os consumidores */
  meta?: Record<string, unknown>;
}

export class ActiveHitbox {
  age = 0;
  readonly hitAt = new Map<number, number>();
  cancelled = false;

  constructor(public readonly spec: HitboxSpec) {}

  get delay(): number {
    return this.spec.delay ?? 0;
  }

  get active(): boolean {
    return !this.cancelled && this.age >= this.delay && this.age < this.delay + this.spec.duration;
  }

  get done(): boolean {
    return this.cancelled || this.age >= this.delay + this.spec.duration;
  }

  cancel(): void {
    this.cancelled = true;
  }
}

export interface HitResult {
  box: ActiveHitbox;
  target: Hurtbox;
}

/**
 * Hitboxes temporárias, separadas das animações.
 * Uma hitbox só causa dano enquanto `active` e atinge cada alvo uma única vez
 * (ou periodicamente, se `rehitInterval`).
 */
export class HitboxSystem {
  private boxes: ActiveHitbox[] = [];

  get all(): readonly ActiveHitbox[] {
    return this.boxes;
  }

  spawn(spec: HitboxSpec): ActiveHitbox {
    const box = new ActiveHitbox({ ...spec, shape: { ...spec.shape } as Shape });
    this.boxes.push(box);
    return box;
  }

  clear(): void {
    this.boxes.length = 0;
  }

  update(dt: number, targets: readonly Hurtbox[]): HitResult[] {
    const results: HitResult[] = [];
    for (const box of this.boxes) {
      const wasActive = box.active;
      box.age += dt;
      const s = box.spec;
      if (s.follow) {
        const p = s.follow();
        s.shape.x = p.x;
        s.shape.y = p.y;
      }
      if (box.age < box.delay) continue;
      if (s.velocity && (wasActive || box.active)) {
        s.shape.x += (s.velocity.x * dt) / 1000;
        s.shape.y += (s.velocity.y * dt) / 1000;
      }
      if (s.grow && (wasActive || box.active)) {
        const g = (s.grow * dt) / 1000;
        if (s.shape.kind === 'circle' || s.shape.kind === 'sector') s.shape.radius += g;
        else if (s.shape.kind === 'ring') {
          s.shape.inner += g;
          s.shape.outer += g;
        }
      }
      // a hitbox precisa estar ativa durante (ao menos parte de) este passo
      const activeNow = !box.cancelled && box.age >= box.delay && box.age - dt < box.delay + s.duration;
      if (!activeNow) continue;
      for (const t of targets) {
        if (!t.alive || t.invulnerable || t.team === s.team) continue;
        const last = box.hitAt.get(t.id);
        if (last !== undefined) {
          if (s.rehitInterval === undefined || box.age - last < s.rehitInterval) continue;
        }
        if (shapeHitsCircle(s.shape, t.x, t.y, t.radius)) {
          box.hitAt.set(t.id, box.age);
          results.push({ box, target: t });
        }
      }
    }
    this.boxes = this.boxes.filter((b) => !b.done);
    return results;
  }
}
