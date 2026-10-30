/**
 * Dons de Apollon — Sóbele da Glória e do Orgulho, emanação do Segundo Sol.
 * Proposta de jogo: a intervenção direta do deus é limitada; os dons são
 * manifestações da luz que Atriox canaliza pela runa no peito.
 */
export type ApollonGiftId =
  | 'glory_blade'
  | 'second_sun'
  | 'radiant_impetus'
  | 'avatar'
  | 'return_cut'
  | 'ascending'
  | 'execution_mark'
  | 'orbit'
  | 'second_step'
  | 'forge'
  | 'captive_sun'
  | 'glory_oath'
  | 'universal_power'
  | 'universal_vitality';

export interface ApollonGift {
  requires: ApollonGiftId[];
  incompatible: ApollonGiftId[];
  maxLevel: number;
  evolution: string;
  animation: string;
  icon: string;
  effects: string[];
  id: ApollonGiftId;
  name: string;
  category: 'Combo' | 'Magia' | 'Mobilidade' | 'Especial';
  description: string;
  key?: string;
  color: number;
  glyph: string;
}

type GiftSeed = Omit<
  ApollonGift,
  | 'requires'
  | 'incompatible'
  | 'maxLevel'
  | 'evolution'
  | 'animation'
  | 'icon'
  | 'effects'
> &
  Partial<ApollonGift>;
const seeds: GiftSeed[] = [
  {
    id: 'glory_blade',
    name: 'Lâmina da Glória',
    category: 'Combo',
    description:
      'O 3º golpe lança uma meia-lua solar: 22 de dano, atravessa inimigos (1 acerto por alvo), alcance 480.',
    color: 0xffd77a,
    glyph: '☾',
  },
  {
    id: 'second_sun',
    name: 'Juízo do Segundo Sol',
    category: 'Magia',
    description:
      'Q: marca uma área no cursor; após 0,6 s um pilar de luz cai e causa 42 de dano. Recarga 7 s.',
    key: 'Q',
    color: 0xfff1b0,
    glyph: '✷',
  },
  {
    id: 'radiant_impetus',
    name: 'Ímpeto Radiante',
    category: 'Mobilidade',
    description:
      'O dash deixa um rastro solar (10 de dano por alvo) e purifica o sangue que atravessa por 1,5 s.',
    color: 0xffb347,
    glyph: '»',
  },
  {
    id: 'avatar',
    name: 'Manifestação de Apollon',
    category: 'Especial',
    description:
      'F (com Glória cheia): o tempo dos inimigos para; Apollon libera um feixe à frente e uma explosão solar ao redor de Atriox.',
    key: 'F',
    color: 0xf5e6ff,
    glyph: '❂',
  },
  {
    id: 'return_cut',
    name: 'Corte de Retorno',
    category: 'Mobilidade',
    glyph: '↶',
    color: 0xffd77a,
    description:
      'Após o dash, clique em até 0,85 s: contra-ataque com avanço de 65 px. Esquiva precisa: +30% de dano.',
    evolution: 'Contra-ataque causa +25% de dano.',
    animation: 'return_cut',
  },
  {
    id: 'ascending',
    name: 'Sentença Ascendente',
    category: 'Combo',
    glyph: '↑',
    color: 0xffd77a,
    description:
      'Mantenha o ataque após o clique e solte com a carga acesa: 54 de dano e 85 de postura. Carga perfeita aos 0,85 s.',
    evolution: 'Golpe carregado causa +25% de dano e postura.',
    animation: 'ascending',
  },
  {
    id: 'execution_mark',
    name: 'Marca do Carrasco',
    category: 'Combo',
    glyph: '✥',
    color: 0xffbd60,
    requires: ['ascending'],
    description:
      'Finalizador marca por 6 s. Sentença consome a marca: explosão de 38 de dano.',
    evolution: 'Explosão da marca causa +25% de dano.',
    animation: 'execution_mark',
  },
  {
    id: 'orbit',
    name: 'Órbita da Lâmina',
    category: 'Combo',
    glyph: '◌',
    color: 0xffe08a,
    description:
      'Finalizador cria 1 lâmina por 6,5 s. O próximo dash a dispara: 24 de dano, 1 acerto por alvo.',
    evolution: 'Lâmina disparada causa +25% de dano.',
    animation: 'orbit',
  },
  {
    id: 'second_step',
    name: 'Passo do Segundo Sol',
    category: 'Mobilidade',
    glyph: '♊',
    color: 0xffefbb,
    description:
      'Esquive perto de uma hitbox ativa: por 4 s, seu próximo corte ganha um eco de 50% do dano.',
    evolution: 'Eco passa a causar 65% do dano.',
    animation: 'second_step',
  },
  {
    id: 'forge',
    name: 'Forja Radiante',
    category: 'Magia',
    glyph: '⚒',
    color: 0xffb347,
    description:
      'Conjurar magia prepara 3 cortes solares: +10 de dano e alcance aumentado. Expiram em 6,5 s.',
    evolution: 'Cortes forjados recebem +15 de dano.',
    animation: 'orbit',
  },
  {
    id: 'captive_sun',
    name: 'Sol Cativo',
    category: 'Magia',
    glyph: '☀',
    color: 0xffef88,
    key: 'R',
    description:
      'R: sol estacionário por 9 s. Acerte a até 300 px para alimentar (máx. 6). R de novo: detonar.',
    evolution: 'Detonação causa +25% de dano.',
    animation: 'captive_sun',
  },
  {
    id: 'glory_oath',
    name: 'Juramento da Glória',
    category: 'Especial',
    glyph: '♜',
    color: 0xffd77a,
    description:
      'Acertos variados e esquivas precisas geram mais Glória; repetir ação rende 35%. Dano recebido perde 14.',
    evolution: 'Ações variadas geram +25% de Glória.',
  },
  {
    id: 'universal_power',
    name: 'Vigor da lâmina',
    category: 'Combo',
    glyph: '+',
    color: 0xffd77a,
    maxLevel: 99,
    description:
      'Melhoria universal: +5% de dano por nível (até +50%). Depois, cura 30.',
    evolution: '+5% de dano (até +50%). Níveis seguintes curam 30.',
  },
  {
    id: 'universal_vitality',
    name: 'Vigor do sentinela',
    category: 'Especial',
    glyph: '♥',
    color: 0xe08070,
    maxLevel: 99,
    description: 'Melhoria universal: +5 de vida máxima (até +100), cura 25.',
    evolution: '+5 de vida máxima (até +100), cura 25.',
  },
];

export const APOLLON_GIFTS: ApollonGift[] = seeds.map((g) => ({
  requires: [],
  incompatible: [],
  maxLevel: 2,
  evolution: 'Evolução: +25% da potência do dom.',
  animation: g.id,
  icon: g.glyph,
  effects: [g.id],
  ...g,
}));

export function getGift(id: string): ApollonGift | undefined {
  return APOLLON_GIFTS.find((g) => g.id === id);
}

export const GLORY_BLADE = { damage: 22, speed: 760, range: 480, radius: 46 };
export const SECOND_SUN = {
  cooldown: 7000,
  castMs: 420,
  delay: 600,
  radius: 92,
  damage: 42,
  maxRange: 460,
};
export const RADIANT_IMPETUS = { damage: 10, purifyMs: 1500, width: 40 };
/**
 * Especial: enquanto dura, o tempo dos inimigos para (IA, golpes, projéteis e poças congelados).
 * Feixe horizontal + explosão solar em volta de Atriox no fim; carência ao sair.
 */
export const AVATAR = {
  gloryMax: 100,
  gloryPerHit: 3,
  gloryPerKill: 10,
  beamLength: 620,
  beamWidth: 180,
  tickMs: 180,
  tickDamage: 26,
  castMs: 2300,
  beamFrom: 800,
  beamTo: 1700,
  novaAt: 1750,
  novaRadius: 300,
  novaDamage: 50,
  graceMs: 900,
};

/** Bênção final (persistente entre partidas): o dash purifica o sangue mesmo sem o Ímpeto. */
export const BLESSING_OF_GLORY = {
  id: 'blessing_of_glory',
  name: 'Bênção da Glória',
  description:
    'O dash radiante passa a purificar temporariamente áreas de sangue (4 s), em todas as próximas partidas.',
  purifyMs: 4000,
  quote: 'O que fazes em vida ecoa na eternidade.',
};
