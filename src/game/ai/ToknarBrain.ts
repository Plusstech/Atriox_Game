import { TOKNAR } from '../../data/v03';
export type ToknarMove = keyof typeof TOKNAR.moves;
export type ToknarState =
  | 'intro'
  | 'chase'
  | 'windup'
  | 'active'
  | 'recovery'
  | 'transition'
  | 'broken'
  | 'dead';
export type ToknarEvent = 'windup' | 'strike' | 'phase' | 'heal' | 'end';
/** Monotonic phases, capped lifesteal and interruptible posture, independent of rendering. */
export class ToknarBrain {
  state: ToknarState = 'intro';
  phase = 1;
  timer = 0;
  move: ToknarMove = 'cleave';
  posture = TOKNAR.posture;
  immunity = 0;
  strikes = 0;
  private cooldown = 500;
  private feastCd = 10000;
  private drainUsed = 0;
  private cycle = 0;
  start(): void {
    this.state = 'chase';
    this.timer = 0;
  }
  kill(): void {
    this.state = 'dead';
  }
  drain(damage: number): number {
    if (this.state === 'dead' || damage <= 0) return 0;
    const heal = Math.max(
      0,
      Math.min(
        TOKNAR.drainCap - this.drainUsed,
        damage * TOKNAR.drain * (this.move === 'hunger' ? 2 : 1),
      ),
    );
    this.drainUsed += heal;
    return heal;
  }
  hitPosture(amount: number): boolean {
    if (
      this.immunity > 0 ||
      this.state === 'broken' ||
      this.state === 'transition' ||
      this.state === 'dead' ||
      this.state === 'intro'
    )
      return false;
    this.posture -= amount;
    if (this.posture > 0) return false;
    this.state = 'broken';
    this.timer = 0;
    this.immunity = TOKNAR.breakMs + TOKNAR.breakImmunity;
    this.posture = TOKNAR.posture;
    return true;
  }
  update(dt: number, distance: number, hp: number): ToknarEvent[] {
    if (this.state === 'dead' || this.state === 'intro') return [];
    this.timer += dt;
    this.immunity = Math.max(0, this.immunity - dt);
    this.feastCd -= dt;
    const phase = hp <= TOKNAR.phases[1] ? 3 : hp <= TOKNAR.phases[0] ? 2 : 1;
    if (phase > this.phase) {
      this.phase = phase;
      this.state = 'transition';
      this.timer = 0;
      return ['phase'];
    }
    const m = TOKNAR.moves[this.move];
    switch (this.state) {
      case 'transition':
        if (this.timer >= TOKNAR.transitionMs) this.start();
        break;
      case 'broken':
        if (this.timer >= TOKNAR.breakMs) {
          this.state = 'recovery';
          this.timer = 0;
        }
        break;
      case 'chase':
        this.cooldown -= dt;
        if (this.cooldown <= 0 && (distance < 230 || this.timer > 1800)) {
          this.cycle++;
          this.move =
            this.phase === 3 && this.feastCd <= 0
              ? 'feast'
              : distance > 240
                ? 'charge'
                : this.phase >= 2 && this.cycle % 3 === 0
                  ? 'hunger'
                  : this.cycle % 2 === 0
                    ? 'spin'
                    : 'cleave';
          if (this.move === 'feast') this.feastCd = 16000;
          this.state = 'windup';
          this.timer = 0;
          this.strikes = 0;
          return ['windup'];
        }
        break;
      case 'windup':
        if (this.timer >= m.windup) {
          this.state = 'active';
          this.timer = 0;
          this.strikes = 1;
          this.drainUsed = 0;
          return this.move === 'feast' ? [] : ['strike'];
        }
        break;
      case 'active': {
        // Two quick cuts, then a deliberately delayed third. Each has its own hit ID.
        const offsets = [0, 400, 1080];
        if (
          this.move === 'cleave' &&
          this.strikes < 3 &&
          this.timer >= offsets[this.strikes]
        ) {
          this.strikes++;
          this.drainUsed = 0;
          return ['strike'];
        }
        const duration = this.move === 'cleave' ? 1280 : m.active;
        if (this.timer >= duration) {
          this.state = 'recovery';
          this.timer = 0;
          return this.move === 'feast' ? ['heal', 'end'] : ['end'];
        }
        break;
      }
      case 'recovery':
        if (this.timer >= m.recovery) {
          this.start();
          this.cooldown = 380;
        }
        break;
    }
    return [];
  }
}
