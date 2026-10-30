import type { DashDef } from '../../data/abilities';
import { normalize, type Vec } from './geometry';

export type DashState = 'ready' | 'dashing' | 'recovering';
export type DashEvent = 'dashStart' | 'dashEnd' | 'recoverEnd' | 'iframesEnd' | 'chargeRestored';

/**
 * Dash com cargas (lógica pura).
 * - `maxCharges` cargas; cada uma recarrega em `rechargeMs` (uma de cada vez, em sequência).
 * - Intervalo mínimo entre dashes (`minGap`) evita consumo duplo por repetição de tecla.
 * - Invulnerabilidade `iframes` ≤ duração do dash.
 */
export class DashController {
  state: DashState = 'ready';
  dir: Vec = { x: 1, y: 0 };
  elapsed = 0;
  iframeRemaining = 0;
  charges: number;
  /** progresso (ms) da recarga da próxima carga */
  rechargeT = 0;
  private gap = 0;
  /** multiplicador de recarga (bênçãos) */
  rechargeMul = 1;

  constructor(private readonly def: DashDef) {
    this.charges = def.charges;
  }

  get maxCharges(): number {
    return this.def.charges;
  }

  get rechargeTime(): number {
    return this.def.rechargeMs * this.rechargeMul;
  }

  /** 0..1 da carga em recarga (1 = todas cheias) */
  get rechargeProgress(): number {
    if (this.charges >= this.def.charges) return 1;
    return Math.min(1, this.rechargeT / this.rechargeTime);
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
    return this.state !== 'dashing' && this.charges > 0 && this.gap <= 0;
  }

  tryDash(dx: number, dy: number, rechargeMul = 1): boolean {
    if (!this.canDash()) return false;
    this.rechargeMul = rechargeMul;
    const d = normalize(dx, dy);
    this.dir = d.x === 0 && d.y === 0 ? { ...this.dir } : d;
    this.state = 'dashing';
    this.elapsed = 0;
    this.iframeRemaining = Math.min(this.def.iframes, this.def.duration);
    this.charges--;
    this.gap = this.def.minGap;
    return true;
  }

  update(dt: number): DashEvent[] {
    const ev: DashEvent[] = [];
    if (this.gap > 0) this.gap -= dt;
    if (this.charges < this.def.charges) {
      this.rechargeT += dt;
      while (this.rechargeT >= this.rechargeTime && this.charges < this.def.charges) {
        this.rechargeT -= this.rechargeTime;
        this.charges++;
        ev.push('chargeRestored');
      }
      if (this.charges >= this.def.charges) this.rechargeT = 0;
    }
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

  /** Interrompe (morte, atordoamento). Não devolve cargas. */
  stop(): void {
    this.state = 'ready';
    this.iframeRemaining = 0;
  }
}
