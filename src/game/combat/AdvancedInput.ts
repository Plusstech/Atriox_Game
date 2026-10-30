import { SKILLS } from '../../data/v03';
export type AdvancedAction = 'charged' | 'counter';
/** Single arbitration point: dash/special/magic cancel charge; tap keeps the normal combo. */
export class AdvancedInput {
  heldMs = 0;
  charging = false;
  counterMs = 0;
  action: AdvancedAction | null = null;
  elapsed = 0;
  perfect = false;
  private fired = false;
  reset(): void {
    this.heldMs = 0;
    this.charging = false;
    this.counterMs = 0;
    this.action = null;
    this.elapsed = 0;
    this.fired = false;
  }
  dash(): void {
    this.charging = false;
    this.heldMs = 0;
    this.counterMs = SKILLS.counterWindow;
    this.action = null;
  }
  update(
    dt: number,
    input: {
      held: boolean;
      released: boolean;
      pressed: boolean;
      cancel: boolean;
      chargeGift: boolean;
      counterGift: boolean;
      ready: boolean;
    },
  ): { basic: boolean; hit: AdvancedAction | null } {
    this.counterMs = Math.max(0, this.counterMs - dt);
    if (input.cancel) {
      this.charging = false;
      this.heldMs = 0;
    }
    if (
      !input.cancel &&
      input.chargeGift &&
      input.held &&
      input.ready &&
      !this.action
    ) {
      this.heldMs += dt;
      this.charging = this.heldMs >= SKILLS.chargeMin;
    }
    let basic = input.pressed;
    if (input.released && this.charging && !input.cancel && input.ready) {
      this.action = 'charged';
      this.perfect = Math.abs(this.heldMs - SKILLS.chargePerfect) <= 130;
      this.elapsed = 0;
      this.fired = false;
      this.heldMs = 0;
      this.charging = false;
      basic = false;
    } else if (input.released || !input.held) {
      this.heldMs = 0;
      this.charging = false;
    }
    if (
      basic &&
      input.counterGift &&
      this.counterMs > 0 &&
      input.ready &&
      !this.action &&
      !input.cancel
    ) {
      this.action = 'counter';
      this.elapsed = 0;
      this.fired = false;
      this.counterMs = 0;
      basic = false;
    }
    let hit: AdvancedAction | null = null;
    if (this.action) {
      this.elapsed += dt;
      if (!this.fired && this.elapsed >= SKILLS.chargeWindup) {
        hit = this.action;
        this.fired = true;
      }
      const duration =
        SKILLS.chargeWindup +
        SKILLS.chargeActive +
        (this.action === 'charged' ? SKILLS.chargeRecovery : 270);
      if (this.elapsed >= duration) this.action = null;
      basic = false;
    }
    return { basic, hit };
  }
}
