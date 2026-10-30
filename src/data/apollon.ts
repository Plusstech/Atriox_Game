/**
 * Dons de Apollon — Sóbele da Glória e do Orgulho, emanação do Segundo Sol.
 * Proposta de jogo: a intervenção direta do deus é limitada; os dons são
 * manifestações da luz que Atriox canaliza pela runa no peito.
 */
export type ApollonGiftId = 'glory_blade' | 'second_sun' | 'radiant_impetus' | 'avatar';

export interface ApollonGift {
  id: ApollonGiftId;
  name: string;
  category: 'Combo' | 'Magia' | 'Mobilidade' | 'Especial';
  description: string;
  key?: string;
  color: number;
  glyph: string;
}

export const APOLLON_GIFTS: ApollonGift[] = [
  {
    id: 'glory_blade',
    name: 'Lâmina da Glória',
    category: 'Combo',
    description: 'O 3º golpe lança uma meia-lua solar: 22 de dano, atravessa inimigos (1 acerto por alvo), alcance 480.',
    color: 0xffd77a,
    glyph: '☾'
  },
  {
    id: 'second_sun',
    name: 'Juízo do Segundo Sol',
    category: 'Magia',
    description: 'Q: marca uma área no cursor; após 0,6 s um pilar de luz cai e causa 42 de dano. Recarga 7 s.',
    key: 'Q',
    color: 0xfff1b0,
    glyph: '✷'
  },
  {
    id: 'radiant_impetus',
    name: 'Ímpeto Radiante',
    category: 'Mobilidade',
    description: 'O dash deixa um rastro solar (10 de dano por alvo) e purifica o sangue que atravessa por 1,5 s.',
    color: 0xffb347,
    glyph: '»'
  },
  {
    id: 'avatar',
    name: 'Avatar de Apollon',
    category: 'Especial',
    description: 'F (com Glória cheia): o tempo dos inimigos para; Apollon libera um feixe à frente e uma explosão solar ao redor de Atriox.',
    key: 'F',
    color: 0xf5e6ff,
    glyph: '❂'
  }
];

export function getGift(id: string): ApollonGift | undefined {
  return APOLLON_GIFTS.find((g) => g.id === id);
}

export const GLORY_BLADE = { damage: 22, speed: 760, range: 480, radius: 46 };
export const SECOND_SUN = { cooldown: 7000, castMs: 420, delay: 600, radius: 92, damage: 42, maxRange: 460 };
export const RADIANT_IMPETUS = { damage: 10, purifyMs: 1500, width: 40 };
/**
 * Especial: enquanto dura, o tempo dos inimigos para (IA, golpes, projéteis e poças congelados).
 * Feixe horizontal + explosão solar em volta de Atriox no fim; carência ao sair.
 */
export const AVATAR = {
  gloryMax: 100, gloryPerHit: 3, gloryPerKill: 10,
  beamLength: 620, beamWidth: 180, tickMs: 180, tickDamage: 26,
  castMs: 2300, beamFrom: 800, beamTo: 1700,
  novaAt: 1750, novaRadius: 300, novaDamage: 50,
  graceMs: 900
};

/** Bênção final (persistente entre partidas): o dash purifica o sangue mesmo sem o Ímpeto. */
export const BLESSING_OF_GLORY = {
  id: 'blessing_of_glory',
  name: 'Bênção da Glória',
  description: 'O dash radiante passa a purificar temporariamente áreas de sangue (4 s), em todas as próximas partidas.',
  purifyMs: 4000,
  quote: 'O que fazes em vida ecoa na eternidade.'
};
