/**
 * Máquina de estados de IA dos inimigos comuns (lógica pura, sem Phaser).
 * idle → patrol → chase → windup → attack → recovery → chase ...
 * hurt interrompe chase/windup; dead é terminal e ignora tudo.
 */
export type EnemyState = 'idle' | 'patrol' | 'chase' | 'windup' | 'attack' | 'recovery' | 'hurt' | 'dead';

export interface EnemyBrainConfig {
  detectRange: number;
  attackRange: number;
  minRange?: number;
  windup: number;
  active: number;
  recovery: number;
  attackCooldown: number;
  hurtDuration: number;
  poise: number;
  /** tempo parado antes de patrulhar */
  idleTime?: number;
}

export interface BrainContext {
  distance: number;
}

export type BrainEvent = 'windupStart' | 'attackStart' | 'attackEnd' | 'recoveryEnd' | 'detected';

export class EnemyBrain {
  state: EnemyState = 'idle';
  timer = 0;
  private cooldown = 0;
  private aggro = false;

  constructor(private readonly cfg: EnemyBrainConfig) {}

  get isDead(): boolean {
    return this.state === 'dead';
  }

  /** Pode causar dano agora? Apenas na janela de ataque e vivo. */
  get canDealDamage(): boolean {
    return this.state === 'attack';
  }

  get windupProgress(): number {
    return this.state === 'windup' ? Math.min(1, this.timer / this.cfg.windup) : 0;
  }

  forceAggro(): void {
    this.aggro = true;
  }

  /**
   * Notifica dano recebido. Retorna true se o golpe interrompeu (stagger).
   * O ataque em andamento (janela ativa) não é interrompido — preserva leitura.
   */
  onHit(damage: number): boolean {
    if (this.state === 'dead') return false;
    this.aggro = true;
    if (damage < this.cfg.poise) return false;
    if (this.state === 'attack') return false;
    this.state = 'hurt';
    this.timer = 0;
    return true;
  }

  kill(): void {
    this.state = 'dead';
    this.timer = 0;
  }

  update(dt: number, ctx: BrainContext): BrainEvent[] {
    if (this.state === 'dead') return [];
    const ev: BrainEvent[] = [];
    this.timer += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    const c = this.cfg;

    if (!this.aggro && ctx.distance <= c.detectRange) {
      this.aggro = true;
      ev.push('detected');
    }

    switch (this.state) {
      case 'idle':
        if (this.aggro) this.set('chase');
        else if (this.timer >= (c.idleTime ?? 600)) this.set('patrol');
        break;
      case 'patrol':
        if (this.aggro) this.set('chase');
        else if (this.timer >= 1800) this.set('idle');
        break;
      case 'chase': {
        const inBand = ctx.distance <= c.attackRange && (c.minRange === undefined || ctx.distance >= c.minRange * 0.6);
        if (inBand && this.cooldown <= 0) {
          this.set('windup');
          ev.push('windupStart');
        }
        break;
      }
      case 'windup':
        if (this.timer >= c.windup) {
          this.set('attack');
          ev.push('attackStart');
        }
        break;
      case 'attack':
        if (this.timer >= c.active) {
          this.set('recovery');
          ev.push('attackEnd');
        }
        break;
      case 'recovery':
        if (this.timer >= c.recovery) {
          this.cooldown = c.attackCooldown;
          this.set('chase');
          ev.push('recoveryEnd');
        }
        break;
      case 'hurt':
        if (this.timer >= c.hurtDuration) {
          this.cooldown = Math.max(this.cooldown, 250);
          this.set('chase');
        }
        break;
    }
    return ev;
  }

  private set(s: EnemyState): void {
    this.state = s;
    this.timer = 0;
  }
}
