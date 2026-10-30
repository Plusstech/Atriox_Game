/** Cooldown simples baseado em delta time (respeita hitstop/slow-motion). */
export class Cooldown {
  remaining = 0;
  private lastDuration: number;

  constructor(public duration: number) {
    this.lastDuration = duration;
  }

  get ready(): boolean {
    return this.remaining <= 0;
  }

  /** 0 = acabou de disparar, 1 = pronto */
  get progress(): number {
    if (this.lastDuration <= 0) return 1;
    return 1 - Math.max(0, this.remaining) / this.lastDuration;
  }

  trigger(mul = 1): void {
    this.lastDuration = this.duration * mul;
    this.remaining = this.lastDuration;
  }

  reset(): void {
    this.remaining = 0;
  }

  update(dt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }
}
