import { FINAL_BOSS as C } from '../../data/v03';
export class CaimDefense {
  mode: 'none' | 'shieldWarning' | 'shield' | 'rupture' | 'ritual' | 'punish' =
    'none';
  timer = 0;
  shield = 0;
  posture = 0;
  shieldCd = 4500;
  ritualCd = 11000;
  uses = 0;
  private proximity = 0;
  update(
    dt: number,
    distance: number,
    phase: number,
    threats: number,
    ready: boolean,
  ): 'wave' | 'ritualComplete' | null {
    this.shieldCd -= dt;
    this.ritualCd -= dt;
    this.timer += dt;
    this.proximity =
      distance < 165 ? this.proximity + dt : Math.max(0, this.proximity - dt);
    if (this.mode === 'none' && ready && threats <= 1) {
      if (phase === 3 && this.ritualCd <= 0) {
        this.mode = 'ritual';
        this.timer = 0;
        this.posture = C.ritualPosture;
        this.ritualCd = C.ritualCooldown;
      } else if (
        this.proximity > 1100 &&
        this.shieldCd <= 0 &&
        this.uses < C.shieldBudget * phase
      ) {
        this.mode = 'shieldWarning';
        this.timer = 0;
        this.shieldCd = C.shieldCooldown;
        this.uses++;
        this.proximity = 0;
      }
    }
    if (this.mode === 'shieldWarning' && this.timer >= C.shieldWarn) {
      this.mode = 'shield';
      this.timer = 0;
      this.shield = C.shieldHp;
    }
    if (this.mode === 'shield' && this.timer >= C.shieldMs) {
      this.mode = 'none';
      this.shield = 0;
    }
    if (this.mode === 'rupture' && this.timer >= C.waveWarn) {
      this.mode = 'punish';
      this.timer = 0;
      return 'wave';
    }
    if (this.mode === 'ritual' && this.timer >= C.ritualMs) {
      this.mode = 'punish';
      this.timer = 0;
      return 'ritualComplete';
    }
    if (this.mode === 'punish' && this.timer >= 1600) {
      this.mode = 'none';
      this.timer = 0;
    }
    return null;
  }
  absorb(damage: number, posture: number): boolean {
    if (this.mode === 'shield') {
      this.shield = Math.max(0, this.shield - damage);
      if (this.shield === 0) {
        this.mode = 'rupture';
        this.timer = 0;
      }
      return true;
    }
    if (this.mode === 'ritual') {
      this.posture -= posture;
      if (this.posture <= 0) {
        this.mode = 'punish';
        this.timer = 0;
      }
    }
    return false;
  }
}
