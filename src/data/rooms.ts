import type { SpawnGroup } from './waves';
import type { ArenaTheme } from '../game/fx/ArenaPainter';

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
  theme: ArenaTheme;
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

/**
 * Ordem da campanha (v0.5): salas iniciais → Carrasco → salas → Toknar → salas → Caim.
 * Inimigos novos são apresentados sozinhos antes de serem combinados:
 * goblins (trial-1), orcs saqueadores (trial-2), wyverns selvagens (build-2).
 */
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
    subtitle: 'Goblins: rápidos e frágeis',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
    waves: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'goblin', count: 2 }] },
      { whenAliveAtMost: 0, spawns: [{ kind: 'goblin', count: 4 }] },
    ],
  },
  {
    id: 'trial-2',
    name: 'Segunda Provação',
    subtitle: 'Orcs saqueadores: ataque pelos flancos',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing', 'vitality'],
    waves: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'orc', count: 1 }] },
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'orc', count: 1 },
          { kind: 'goblin', count: 2 },
        ],
      },
    ],
  },
  {
    id: 'build-1',
    name: 'Passagem das Cinzas',
    subtitle: 'Recrutas da Liga e saqueadores',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
    waves: [
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'recruit', count: 2 },
          { kind: 'archer', count: 2 },
        ],
      },
      {
        whenAliveAtMost: 1,
        spawns: [
          { kind: 'guardian', count: 1 },
          { kind: 'goblin', count: 2 },
        ],
      },
    ],
  },
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
    id: 'build-2',
    name: 'Ninho das Wyverns',
    subtitle: 'Wyverns selvagens: observe a sombra',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
    waves: [
      { whenAliveAtMost: 0, spawns: [{ kind: 'wyvern_wild', count: 1 }] },
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'wyvern_wild', count: 2 },
          { kind: 'goblin', count: 2 },
        ],
      },
    ],
  },
  {
    id: 'build-3',
    name: 'Pátio dos Juramentos',
    subtitle: 'Prepare sua build para Rhaesis',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing', 'vitality'],
    waves: [
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'orc', count: 2 },
          { kind: 'archer', count: 1 },
        ],
      },
      {
        whenAliveAtMost: 1,
        spawns: [
          { kind: 'goblin', count: 3 },
          { kind: 'guardian', count: 1 },
        ],
      },
    ],
  },
  {
    id: 'toknar',
    name: 'Fosso de Rhaesis',
    subtitle: 'Toknar — o sangue alimenta o machado',
    kind: 'boss',
    boss: 'toknar',
    theme: 'toknar',
    doors: 2,
    rewardPool: ['apollon', 'blessing'],
  },
  {
    id: 'build-4',
    name: 'Forja do Sentinela',
    subtitle: 'A última preparação antes de Caim',
    kind: 'combat',
    theme: 'trial',
    doors: 2,
    rewardPool: ['apollon', 'blessing', 'vitality'],
    waves: [
      {
        whenAliveAtMost: 0,
        spawns: [
          { kind: 'orc', count: 1 },
          { kind: 'recruit', count: 2 },
          { kind: 'wyvern_wild', count: 1 },
        ],
      },
      {
        whenAliveAtMost: 1,
        spawns: [
          { kind: 'guardian', count: 1 },
          { kind: 'goblin', count: 2 },
          { kind: 'archer', count: 1 },
        ],
      },
    ],
  },
  {
    id: 'nemeia',
    name: 'Campo em Ruínas',
    subtitle: 'Caim Morvaigne — as wyverns observam das rochas',
    kind: 'boss',
    boss: 'caim',
    theme: 'caim',
    doors: 2,
    rewardPool: ['apollon', 'vitality', 'blessing'],
  },
];
