import {
  APOLLON_GIFTS,
  type ApollonGift,
  type ApollonGiftId,
} from '../../data/apollon';

export interface GiftOffer {
  gift: ApollonGift;
  level: number;
  evolution: boolean;
  description: string;
}
/** Offers are snapshots. Generation never mutates the build. */
export class GiftBuild {
  readonly levels = new Map<ApollonGiftId, number>();
  constructor(readonly owned: Set<ApollonGiftId>) {}
  level(id: ApollonGiftId): number {
    return this.levels.get(id) ?? (this.owned.has(id) ? 1 : 0);
  }
  valid(g: ApollonGift): boolean {
    return (
      (g.id.startsWith('universal') || this.level(g.id) < g.maxLevel) &&
      g.requires.every((id) => this.owned.has(id)) &&
      !g.incompatible.some((id) => this.owned.has(id))
    );
  }
  offers(rng: () => number = Math.random): GiftOffer[] {
    const main = APOLLON_GIFTS.filter(
      (g) => this.valid(g) && !g.id.startsWith('universal'),
    );
    const pool =
      main.length >= 2
        ? main
        : [
            ...main,
            ...APOLLON_GIFTS.filter(
              (g) => g.id.startsWith('universal') && this.valid(g),
            ),
          ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 2).map((g) => this.offer(g));
  }
  offer(gift: ApollonGift): GiftOffer {
    const level = this.level(gift.id) + 1;
    return {
      gift,
      level,
      evolution: level > 1,
      description: level > 1 ? gift.evolution : gift.description,
    };
  }
  grant(id: ApollonGiftId): boolean {
    const gift = APOLLON_GIFTS.find((g) => g.id === id);
    if (!gift || !this.valid(gift)) return false;
    this.levels.set(id, this.level(id) + 1);
    this.owned.add(id);
    return true;
  }
}
