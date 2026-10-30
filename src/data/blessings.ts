/**
 * Bênçãos experimentais. Totalmente baseadas em dados:
 *  - efeitos "stat" alteram atributos de forma permanente durante a partida;
 *  - efeitos "trigger" reagem a eventos de combate e produzem "ações"
 *    executadas por um único executor (ArenaScene.runBlessingAction).
 * Nenhum outro arquivo precisa conhecer o id de uma bênção específica.
 */
export type StatKey = 'maxHp' | 'moveSpeed' | 'damageMul' | 'dashCooldownMul' | 'spellCooldownMul' | 'resist';

export type BlessingTrigger = 'basicHit' | 'kill' | 'spellImpact' | 'damaged' | 'comboFinisher';

export type BlessingAction =
  | { kind: 'burn'; dps: number; duration: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'groundFire'; radius: number; dps: number; duration: number }
  | { kind: 'timedStat'; stat: StatKey; add: number; duration: number }
  | { kind: 'wave'; damage: number; speed: number; range: number; width: number };

export type BlessingEffect =
  | { type: 'stat'; stat: StatKey; mul?: number; add?: number }
  | { type: 'trigger'; on: BlessingTrigger; action: BlessingAction; /** cooldown interno (ms) */ icd?: number };

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  color: number;
  glyph: string;
  effects: BlessingEffect[];
}

export const BLESSINGS: BlessingDef[] = [
  {
    id: 'burning_blade',
    name: 'Lâmina Ardente',
    description: 'Ataques básicos aplicam Queimadura: 6 de dano por segundo durante 3 s.',
    color: 0xff7a2a,
    glyph: '✹',
    effects: [{ type: 'trigger', on: 'basicHit', action: { kind: 'burn', dps: 6, duration: 3000 } }]
  },
  {
    id: 'trial_blood',
    name: 'Sangue da Provação',
    description: 'Eliminar um inimigo restaura 5 de vida.',
    color: 0xc0303a,
    glyph: '♥',
    effects: [{ type: 'trigger', on: 'kill', action: { kind: 'heal', amount: 5 } }]
  },
  {
    id: 'judgment_step',
    name: 'Passo do Julgamento',
    description: 'O cooldown do Dash é reduzido em 35%.',
    color: 0xf2d27a,
    glyph: '»',
    effects: [{ type: 'stat', stat: 'dashCooldownMul', mul: 0.65 }]
  },
  {
    id: 'lingering_fire',
    name: 'Fogo Persistente',
    description: 'A Chama do Julgamento deixa uma área em chamas: 16 de dano por segundo durante 3 s.',
    color: 0xff9b3d,
    glyph: '☀',
    effects: [{ type: 'trigger', on: 'spellImpact', action: { kind: 'groundFire', radius: 90, dps: 16, duration: 3000 } }]
  },
  {
    id: 'unbreakable_will',
    name: 'Vontade Inquebrável',
    description: 'Ao receber dano, ganha +40% de resistência durante 3 s.',
    color: 0x9fb6c8,
    glyph: '◈',
    effects: [{ type: 'trigger', on: 'damaged', action: { kind: 'timedStat', stat: 'resist', add: 0.4, duration: 3000 } }]
  },
  {
    id: 'consecrated_strike',
    name: 'Golpe Consagrado',
    description: 'O Julgamento da Lâmina (3º golpe) libera uma onda de luz que causa 18 de dano.',
    color: 0xfff1b0,
    glyph: '✦',
    effects: [
      { type: 'trigger', on: 'comboFinisher', action: { kind: 'wave', damage: 18, speed: 620, range: 360, width: 70 } }
    ]
  }
];

export function getBlessing(id: string): BlessingDef | undefined {
  return BLESSINGS.find((b) => b.id === id);
}
