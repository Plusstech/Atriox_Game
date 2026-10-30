import type { DashDef } from '../../data/abilities';
import { normalize, type Vec } from './geometry';
import { Cooldown } from '../systems/Cooldown';

export type DashState = 'ready' | 'dashing' | 'recovering';
export type DashEvent = 'dashStart' | 'dashEnd' | 'recoverEnd' | 'iframesEnd';

/** Lógica pura do dash: deslocamento, invulnerabilidade e cooldown. */
export class DashController {
  state: DashState = 'ready';
  dir: Vec = { x: 1, y: 0 };
  elapsed = 0;
  iframeRemaining = 0;
  readonly cooldown: Cooldown;

  constructor(private readonly def: DashDef) {
    this.cooldown = new Cooldown(def.cooldown);
  }

  get speed(): number {
    return this.def.distance / (this.def.duration / 1000);
  }

  get invulnerable(): boolean {
    return this.iframeRemaining > 0;
  }

  get busy(): boolean {
    return this.state !== 'ready';
  }

  canDash(): boolean {
    return this.state !== 'dashing' && this.cooldown.ready;
  }

  tryDash(dx: number, dy: number, cooldownMul = 1): boolean {
    if (!this.canDash()) return false;
    const d = normalize(dx, dy);
    this.dir = d.x === 0 && d.y === 0 ? { ...this.dir } : d;
    this.state = 'dashing';
    this.elapsed = 0;
    this.iframeRemaining = this.def.iframes;
    this.cooldown.trigger(cooldownMul);
    return true;
  }

  update(dt: number): DashEvent[] {
    const ev: DashEvent[] = [];
    this.cooldown.update(dt);
    if (this.iframeRemaining > 0) {
      this.iframeRemaining -= dt;
      if (this.iframeRemaining <= 0) {
        this.iframeRemaining = 0;
        ev.push('iframesEnd');
      }
    }
    if (this.state === 'ready') return ev;
    this.elapsed += dt;
    if (this.state === 'dashing' && this.elapsed >= this.def.duration) {
      this.state = 'recovering';
      ev.push('dashEnd');
    }
    if (this.state === 'recovering' && this.elapsed >= this.def.duration + this.def.recovery) {
      this.state = 'ready';
      ev.push('recoverEnd');
    }
    return ev;
  }

  /** Interrompe (ex.: morte). */
  stop(): void {
    this.state = 'ready';
    this.iframeRemaining = 0;
  }
}
