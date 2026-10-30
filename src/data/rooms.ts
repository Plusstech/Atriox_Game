import type { SpawnGroup } from './waves';

/**
 * Tipos de recompensa mostrados nas portas ANTES da escolha.
 * - blessing: bênção experimental (1 de 3)
 * - apollon:  dom de Apollon (1 de 3 entre os ainda não obtidos)
 * - vitality: +20 de vida máxima e cura completa
 */
export type RewardKind = 'blessing' | 'apollon' | 'vitality';

export interface RoomDef {
  id: string;
  name: string;
  subtitle: string;
  kind: 'prep' | 'combat' | 'boss';
  theme: 'trial' | 'nemeia';
  boss?: 'executioner' | 'toknar' | 'caim';
  waves?: SpawnGroup[];
  /** quantas portas a sala anterior oferece para chegar aqui */
  doors: number;
  rewardPool: RewardKind[];
}

export const REWARD_INFO: Record<
  RewardKind,
  { label: string; color: number; glyph: string }
> = {
  blessing: { label: 'Bênção', color: 0xff9b3d, glyph: '✦' },
  apollon: { label: 'Dom de Apollon', color: 0xffe08a, glyph: '☀' },
  vitality: { label: 'Vitalidade', color: 0xd0473a, glyph: '♥' },
};

export const ROOMS: RoomDef[] = [
  {
    id: 'prep',
    name: 'Campo de Provação',
    subtitle: 'Liga Sóbele',
    kind: 'prep',
    theme: 'trial',
    doors: 0,
    rewardPool: [],
  },
  {
    id: 'trial-1',
    name: 'Primeira Provação',
    subtitle: 'Recrutas da Liga',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
    waves: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'recruit', count: 3 }] },
      {
        whenAliveAtMost: 1,
        spawns: [
          { kind: 'recruit', count: 2 },
          { kind: 'archer', count: 2 },
        ],
      },
    ],
  },
  {
    id: 'trial-2',
    name: 'Segunda Provação',
    subtitle: 'Guardiões e atiradores',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing', 'vitality'],
    waves: [
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'recruit', count: 2 },
          { kind: 'guardian', count: 1 },
          { kind: 'archer', count: 1 },
        ],
      },
      {
        whenAliveAtMost: 1,
        spawns: [
          { kind: 'archer', count: 2 },
          { kind: 'recruit', count: 2 },
        ],
      },
    ],
  },
  ...Array.from(
    { length: 3 },
    (_, i): RoomDef => ({
      id: `build-${i + 1}`,
      name: [
        'Passagem das Cinzas',
        'Pátio dos Juramentos',
        'Forja do Sentinela',
      ][i],
      subtitle: 'Prepare sua build para Rhaesis',
      kind: 'combat',
      theme: 'trial',
      doors: 2,
      rewardPool: ['apollon', 'blessing'],
      waves: [
        {
          whenAliveAtMost: 0,
          spawns: [
            { kind: 'recruit', count: 2 + i },
            { kind: 'archer', count: 1 },
            { kind: 'guardian', count: 1 },
          ],
        },
      ],
    }),
  ),
  {
    id: 'executioner',
    name: 'Câmara do Carrasco',
    subtitle: 'Veterano do Campo de Provação',
    kind: 'boss',
    boss: 'executioner',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing', 'vitality'],
  },
  {
    id: 'toknar',
    name: 'Fosso de Rhaesis',
    subtitle: 'Toknar — o sangue alimenta o machado',
    kind: 'boss',
    boss: 'toknar',
    theme: 'nemeia',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
  },
  {
    id: 'nemeia',
    name: 'Arena de Nemeia',
    subtitle: 'A cidade em chamas',
    kind: 'boss',
    boss: 'caim',
    theme: 'nemeia',
    doors: 2,
    rewardPool: ['apollon', 'vitality', 'blessing'],
  },
];
