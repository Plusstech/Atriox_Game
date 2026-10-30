/**
 * IA de Caim Morvaigne (lógica pura).
 * Estados: intro → reposition ⇄ windup → cast → recovery; summon; reaction; dead.
 * Ações: 'pool' (poça de sangue no jogador), 'eruption' (poças em triângulo, fase 2),
 *        'claw' (garra corpo a corpo), 'blink' (salto de reposicionamento), 'summon' (wyverns).
 */
export type CaimState = 'intro' | 'reposition' | 'windup' | 'cast' | 'recovery' | 'reaction' | 'dead';
export type CaimAction = 'pool' | 'eruption' | 'claw' | 'blink' | 'summon';

export interface CaimDef {
  hp: number;
  speed: number;
  radius: number;
  preferredMin: number;
  preferredMax: number;
  windup: Record<CaimAction, number>;
  cast: Record<CaimAction, number>;
  recovery: Record<CaimAction, number>;
  cooldowns: Record<CaimAction, number>;
  maxWyverns: [number, number];
  phase2At: number;
  reactionMs: number;
  /** dano numa janela curta que provoca reação (interrupção) */
  staggerDamage: number;
}

export interface CaimContext {
  distance: number;
  hpRatio: number;
  wyverns: number;
  /** é possível criar uma poça perto do jogador agora? */
  canPool: boolean;
}

export type CaimEvent =
  | { type: 'windup'; action: CaimAction }
  | { type: 'cast'; action: CaimAction }
  | { type: 'end'; action: CaimAction }
  | { type: 'phase2' }
  | { type: 'reaction' };

export class CaimBrain {
  state: CaimState = 'intro';
  action: CaimAction | null = null;
  timer = 0;
  phase: 1 | 2 = 1;
  private cds: Record<CaimAction, number> = { pool: 1200, eruption: 4000, claw: 0, blink: 2500, summon: 3500 };
  private recentDamage = 0;
  private idle = 0;

  constructor(
    readonly def: CaimDef,
    private readonly rng: () => number = Math.random
  ) {}

  get dead(): boolean {
    return this.state === 'dead';
  }

  get maxWyverns(): number {
    return this.def.maxWyverns[this.phase - 1];
  }

  get windupProgress(): number {
    if (this.state !== 'windup' || !this.action) return 0;
    return Math.min(1, this.timer / this.def.windup[this.action]);
  }

  start(): void {
    if (this.state === 'intro') this.set('reposition');
  }

  kill(): void {
    this.state = 'dead';
    this.action = null;
  }

  /** Dano recebido. Golpes fortes em sequência causam reação (exceto durante o cast). */
  onDamage(amount: number): boolean {
    if (this.state === 'dead' || this.state === 'intro') return false;
    this.recentDamage += amount;
    if (this.recentDamage >= this.def.staggerDamage && (this.state === 'windup' || this.state === 'reposition' || this.state === 'recovery')) {
      this.recentDamage = 0;
      this.action = null;
      this.set('reaction');
      return true;
    }
    return false;
  }

  /** Escolha da próxima ação (pura, com RNG injetável). */
  choose(ctx: CaimContext): CaimAction | null {
    const c = this.cds;
    if (ctx.distance < 110 && c.claw <= 0) return 'claw';
    if (ctx.distance < 170 && c.blink <= 0) return 'blink';
    if (ctx.wyverns < this.maxWyverns && c.summon <= 0) return 'summon';
    const opts: [CaimAction, number][] = [];
    if (ctx.canPool && c.pool <= 0) opts.push(['pool', 3]);
    if (this.phase === 2 && ctx.canPool && c.eruption <= 0) opts.push(['eruption', 2]);
    if (ctx.distance > this.def.preferredMax && c.blink <= 0) opts.push(['blink', 1]);
    if (opts.length === 0) return null;
    const total = opts.reduce((s, o) => s + o[1], 0);
    let r = this.rng() * total;
    for (const [a, w] of opts) {
      r -= w;
      if (r <= 0) return a;
    }
    return opts[opts.length - 1][0];
  }

  update(dt: number, ctx: CaimContext): CaimEvent[] {
    const ev: CaimEvent[] = [];
    if (this.state === 'dead' || this.state === 'intro') return ev;
    this.timer += dt;
    this.recentDamage = Math.max(0, this.recentDamage - dt * 0.02);
    for (const k of Object.keys(this.cds) as CaimAction[]) this.cds[k] = Math.max(0, this.cds[k] - dt);

    if (this.phase === 1 && ctx.hpRatio <= this.def.phase2At) {
      this.phase = 2;
      this.cds.summon = 0;
      ev.push({ type: 'phase2' });
    }

    switch (this.state) {
      case 'reposition': {
        this.idle += dt;
        if (this.timer < 450) break;
        const a = this.choose(ctx);
        if (a) {
          this.action = a;
          this.idle = 0;
          this.set('windup');
          ev.push({ type: 'windup', action: a });
        }
        break;
      }
      case 'windup':
        if (this.action && this.timer >= this.def.windup[this.action] * (this.phase === 2 ? 0.85 : 1)) {
          this.set('cast');
          ev.push({ type: 'cast', action: this.action });
        }
        break;
      case 'cast':
        if (this.action && this.timer >= this.def.cast[this.action]) {
          this.cds[this.action] = this.def.cooldowns[this.action] * (this.phase === 2 ? 0.75 : 1);
          ev.push({ type: 'end', action: this.action });
          this.set('recovery');
        }
        break;
      case 'recovery':
        if (this.action && this.timer >= this.def.recovery[this.action] * (this.phase === 2 ? 0.8 : 1)) {
          this.action = null;
          this.set('reposition');
        }
        break;
      case 'reaction':
        if (this.timer >= this.def.reactionMs) {
          this.cds.blink = 0;
          this.set('reposition');
        }
        break;
    }
    return ev;
  }

  private set(s: CaimState): void {
    this.state = s;
    this.timer = 0;
  }
}
