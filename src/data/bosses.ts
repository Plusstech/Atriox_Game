import type { CaimDef } from '../game/ai/CaimBrain';

/**
 * O Carrasco da Provação — personagem ORIGINAL criado para este protótipo.
 * Não existe na história canônica de Atriox Cinder.
 */
export type BossMoveId = 'overhead' | 'sweep' | 'charge' | 'inferno';

export interface BossMoveDef {
  id: BossMoveId;
  name: string;
  phases: (1 | 2)[];
  minDist: number;
  maxDist: number;
  weight: number;
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: number;
  /** parâmetros de forma, interpretados pelo Boss.ts */
  length?: number;
  width?: number;
  radius?: number;
  arcDeg?: number;
  speed?: number;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  hp: number;
  speed: number;
  radius: number;
  phase2Threshold: number;
  phase2SpeedMul: number;
  phase2RecoveryMul: number;
  phase2WindupMul: number;
  transitionDuration: number;
  moves: BossMoveDef[];
  scale: number;
  /** postura quebrável (v0.5) */
  posture?: number;
  breakMs?: number;
  breakImmunity?: number;
}

export const EXECUTIONER: BossDef = {
  id: 'executioner',
  name: 'O Carrasco da Provação',
  title: 'Veterano do Campo de Provação',
  hp: 1050,
  speed: 112,
  radius: 40,
  phase2Threshold: 0.5,
  phase2SpeedMul: 1.3,
  phase2RecoveryMul: 0.68,
  phase2WindupMul: 0.85,
  transitionDuration: 1500,
  scale: 0.8,
  posture: 150,
  breakMs: 1600,
  breakImmunity: 6500,
  moves: [
    {
      id: 'overhead',
      name: 'Golpe Frontal',
      phases: [1, 2],
      minDist: 0,
      maxDist: 190,
      weight: 3,
      windup: 820,
      active: 140,
      recovery: 900,
      damage: 22,
      knockback: 420,
      length: 210,
      width: 86
    },
    {
      id: 'sweep',
      name: 'Varredura Horizontal',
      phases: [1, 2],
      minDist: 0,
      maxDist: 165,
      weight: 3,
      windup: 700,
      active: 160,
      recovery: 820,
      damage: 18,
      knockback: 360,
      radius: 170,
      arcDeg: 220
    },
    {
      id: 'charge',
      name: 'Investida',
      phases: [1, 2],
      minDist: 180,
      maxDist: 560,
      weight: 2,
      windup: 650,
      active: 380,
      recovery: 850,
      damage: 20,
      knockback: 460,
      length: 380,
      width: 80,
      speed: 1000
    },
    {
      id: 'inferno',
      name: 'Execução Ardente',
      phases: [2],
      minDist: 0,
      maxDist: 9999,
      weight: 2.2,
      windup: 900,
      active: 900,
      recovery: 900,
      damage: 20,
      knockback: 380,
      radius: 150,
      speed: 380
    }
  ]
};

/**
 * Caim Morvaigne — Arcano de Drevagna, líder da Liga Sóbele, controla sangue
 * e Wyverns infectadas (segundo a fonte canônica). Atriox o derrota na história.
 */
export const CAIM: CaimDef & { name: string; title: string } = {
  name: 'Caim Morvaigne',
  title: 'Arcano de Drevagna',
  hp: 2050,
  speed: 205,
  radius: 22,
  preferredMin: 210,
  preferredMax: 350,
  windup: { pool: 650, eruption: 800, claw: 420, blink: 260, summon: 700 },
  cast: { pool: 450, eruption: 600, claw: 160, blink: 420, summon: 900 },
  recovery: { pool: 650, eruption: 750, claw: 700, blink: 250, summon: 700 },
  cooldowns: { pool: 2600, eruption: 7000, claw: 1400, blink: 3200, summon: 11000 },
  maxWyverns: [1, 2, 3],
  phase2At: 0.7,
  reactionMs: 520,
  staggerDamage: 110
};
