import type { EnemyKind } from './enemies';

/**
 * Cada onda é uma sequência de grupos. Um grupo surge quando o número de
 * inimigos vivos cai para `whenAliveAtMost` ou menos.
 */
/** O que uma onda pode trazer: inimigos comuns ou wyverns selvagens (entidade própria). */
export type SpawnKind = EnemyKind | 'wyvern_wild';

export interface SpawnGroup {
  whenAliveAtMost: number;
  spawns: { kind: SpawnKind; count: number }[];
}

export interface WaveDef {
  name: string;
  groups: SpawnGroup[];
}

export const WAVES: WaveDef[] = [
  {
    name: 'Primeira Provação',
    groups: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'recruit', count: 3 }] },
      { whenAliveAtMost: 1, spawns: [{ kind: 'recruit', count: 2 }, { kind: 'archer', count: 2 }] }
    ]
  },
  {
    name: 'Segunda Provação',
    groups: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'recruit', count: 2 }, { kind: 'guardian', count: 1 }, { kind: 'archer', count: 1 }] },
      { whenAliveAtMost: 1, spawns: [{ kind: 'archer', count: 2 }, { kind: 'recruit', count: 2 }] },
      { whenAliveAtMost: 1, spawns: [{ kind: 'guardian', count: 1 }, { kind: 'recruit', count: 3 }] }
    ]
  }
];
