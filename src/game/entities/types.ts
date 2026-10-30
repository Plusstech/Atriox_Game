import type { Hurtbox } from '../combat/HitboxSystem';

export interface HitInfo {
  damage: number;
  knockback: number;
  /** direção normalizada do empurrão */
  dirX: number;
  dirY: number;
  tag: string;
  /** golpe básico do jogador (dispara bênçãos de "basicHit") */
  basic?: boolean;
  heavy?: boolean;
  posture?: number;
}

/** Qualquer coisa que pode receber dano. */
export interface Combatant {
  readonly hurtbox: Hurtbox;
  /** Retorna o dano efetivamente aplicado (0 = ignorado). */
  receiveHit(hit: HitInfo): number;
}

export type CollideFn = (x: number, y: number, r: number) => { x: number; y: number; blocked: boolean };

let nextId = 1;
export function newEntityId(): number {
  return nextId++;
}
