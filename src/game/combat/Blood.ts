/**
 * Sangue de Caim (lógica pura).
 *
 * Poças: anunciadas (warning) → ativas → desaparecendo. Só a área lógica
 * (círculo) importa para as regras; o brilho visual é desenhado à parte.
 *
 * Exposição: permanecer numa poça ativa enche a barra; ao atingir 1,
 * Atriox é dominado (stun) por tempo limitado e ganha imunidade temporária
 * à reaplicação. Durante a invulnerabilidade do dash a exposição NÃO sobe
 * (o dash atravessa a poça), mas também não cai.
 */
export type PoolState = 'warning' | 'active' | 'fading';

export interface BloodPool {
  id: number;
  x: number;
  y: number;
  r: number;
  state: PoolState;
  t: number;
  warnMs: number;
  lifeMs: number;
  fadeMs: number;
  /** purificada (inativa) até este tempo restante; 0 = não purificada */
  purified: number;
}

export interface PoolRules {
  maxActive: number;
  /** distância mínima entre centros (garante chão seguro entre poças) */
  minSpacing: number;
  radius: number;
  warnMs: number;
  lifeMs: number;
  fadeMs: number;
}

export const DEFAULT_POOL_RULES: PoolRules = {
  maxActive: 3,
  minSpacing: 230,
  radius: 105,
  warnMs: 950,
  lifeMs: 6500,
  fadeMs: 600
};

export class BloodPoolSystem {
  pools: BloodPool[] = [];
  private nextId = 1;

  constructor(public rules: PoolRules = { ...DEFAULT_POOL_RULES }) {}

  /** Poças que ainda contam no limite (anunciadas ou ativas). */
  get liveCount(): number {
    return this.pools.filter((p) => p.state !== 'fading').length;
  }

  /** Verifica se uma nova poça pode ser criada neste ponto. */
  canPlace(x: number, y: number, r = this.rules.radius): boolean {
    if (this.liveCount >= this.rules.maxActive) return false;
    for (const p of this.pools) {
      if (p.state === 'fading') continue;
      if (Math.hypot(p.x - x, p.y - y) < Math.max(this.rules.minSpacing, p.r + r + 20)) return false;
    }
    return true;
  }

  spawn(x: number, y: number, r = this.rules.radius): BloodPool | null {
    if (!this.canPlace(x, y, r)) return null;
    const p: BloodPool = { id: this.nextId++, x, y, r, state: 'warning', t: 0, warnMs: this.rules.warnMs, lifeMs: this.rules.lifeMs, fadeMs: this.rules.fadeMs, purified: 0 };
    this.pools.push(p);
    return p;
  }

  update(dt: number): void {
    for (const p of this.pools) {
      p.t += dt;
      if (p.purified > 0) p.purified = Math.max(0, p.purified - dt);
      if (p.state === 'warning' && p.t >= p.warnMs) {
        p.state = 'active';
        p.t = 0;
      } else if (p.state === 'active' && p.t >= p.lifeMs) {
        p.state = 'fading';
        p.t = 0;
      }
    }
    this.pools = this.pools.filter((p) => !(p.state === 'fading' && p.t >= p.fadeMs));
  }

  /** Poça ativa (e não purificada) que contém o ponto. */
  activeAt(x: number, y: number, bodyR = 0): BloodPool | null {
    for (const p of this.pools) {
      if (p.state !== 'active' || p.purified > 0) continue;
      if (Math.hypot(p.x - x, p.y - y) <= p.r - bodyR * 0.5) return p;
    }
    return null;
  }

  /** Purifica temporariamente as poças tocadas pelo segmento (dash radiante). */
  purifySegment(x0: number, y0: number, x1: number, y1: number, width: number, ms: number): number {
    let n = 0;
    for (const p of this.pools) {
      if (p.state === 'fading') continue;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.y - y0) * dy) / L2));
      const d = Math.hypot(x0 + dx * t - p.x, y0 + dy * t - p.y);
      if (d <= p.r + width) {
        p.purified = Math.max(p.purified, ms);
        n++;
      }
    }
    return n;
  }

  /** Remove tudo imediatamente (sala concluída, chefe morto). */
  clear(): void {
    this.pools = [];
  }

  /** Faz todas as poças desaparecerem suavemente. */
  fadeAll(): void {
    for (const p of this.pools) {
      if (p.state !== 'fading') {
        p.state = 'fading';
        p.t = 0;
      }
    }
  }
}

export interface ExposureRules {
  /** ms contínuos dentro do sangue até a dominação */
  fillMs: number;
  /** ms para esvaziar totalmente fora do sangue */
  drainMs: number;
  stunMs: number;
  /** imunidade após o fim do stun */
  immunityMs: number;
}

export const DEFAULT_EXPOSURE: ExposureRules = { fillMs: 1150, drainMs: 900, stunMs: 1500, immunityMs: 2600 };

export type ExposureEvent = 'stunStart' | 'stunEnd';

export class BloodExposure {
  value = 0;
  stun = 0;
  immunity = 0;

  constructor(public rules: ExposureRules = { ...DEFAULT_EXPOSURE }) {}

  get stunned(): boolean {
    return this.stun > 0;
  }

  /**
   * @param inBlood   o jogador está dentro de uma poça ativa
   * @param protectedNow  invulnerável (dash/cinemática/morto): não acumula
   */
  update(dt: number, inBlood: boolean, protectedNow: boolean): ExposureEvent[] {
    const ev: ExposureEvent[] = [];
    if (this.stun > 0) {
      this.stun -= dt;
      if (this.stun <= 0) {
        this.stun = 0;
        this.value = 0;
        this.immunity = this.rules.immunityMs;
        ev.push('stunEnd');
      }
      return ev;
    }
    if (this.immunity > 0) {
      this.immunity = Math.max(0, this.immunity - dt);
      this.value = Math.max(0, this.value - dt / this.rules.drainMs);
      return ev;
    }
    if (inBlood && !protectedNow) {
      this.value = Math.min(1, this.value + dt / this.rules.fillMs);
      if (this.value >= 1) {
        this.stun = this.rules.stunMs;
        ev.push('stunStart');
      }
    } else if (!inBlood) {
      this.value = Math.max(0, this.value - dt / this.rules.drainMs);
    }
    return ev;
  }

  reset(): void {
    this.value = 0;
    this.stun = 0;
    this.immunity = 0;
  }
}
