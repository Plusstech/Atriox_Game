/**
 * Sêlun — O Fim do Infinito (PROMPT_SELUN_GAME_OVER).
 * Encontro invencível após concluir o nível SELUN.triggerWave do Infinito
 * (Provação da Eternidade). Representa o GAME OVER; Apollon revive Atriox.
 * Todos os números são parâmetros iniciais de ajuste.
 */
export const SELUN = {
  /** ÚNICO gatilho: concluir este nível do Infinito chama Sêlun (antes de qualquer nível seguinte) */
  triggerWave: 10,
  radius: 34,
  speed: 128,
  scale: 0.78,
  /** vida da MANIFESTAÇÃO (feedback de dano). Zerar → queda aparente → recomposição. */
  manifestHp: 900,
  fallMs: 1700,
  recomposeMs: 1700,
  posture: 220,
  breakMs: 2000,
  breakProtectMs: 3000,
  /** fases por TEMPO de combate ativo (ms) */
  phase2At: 45_000,
  phase3At: 100_000,
  transitionMs: 1300,
  /** Última Palavra: aos 180 s de combate ativo, contagem de 5 s */
  lastWordAt: 180_000,
  lastWordMs: 5000,
  /** concessão permanente exige ≥ 20 s de combate ativo OU ≥ 1 quebra de postura */
  grantMinActiveMs: 20_000,
  /** teto por evento, antes das defesas (fração da vida máxima do jogador) */
  maxEventFraction: 0.65,
  /** intervalo mínimo entre acertos do mesmo grupo (espada/rastro/chão de um golpe) */
  groupWindowMs: 450,
  gapMs: [900, 650, 480],
  moves: {
    horizon: { name: 'Horizonte Partido', windup: 650, lockAt: 0.62, active: 160, recovery: 720, damage: 24, range: 175, waveDamage: 18, waveSpeed: 900, waveRange: 1300, waveWidth: 80 },
    sentence: { name: 'Sentença do Abismo', windup: 900, lockBefore: 450, active: 150, recovery: 760, damage: 26, radius: 115, maxReach: 340, ringDamage: 16, ringMax: 430, ringMs: 720, ringWidth: 34, zoneMs: 2200, zoneRadius: 80, zoneDamage: 7 },
    decree: { name: 'Decreto do Fim', windup: 1200, sequences: 3, announceMs: 720, strikeMs: 140, gapMs: 520, recovery: 1400, damage: 26, width: 66, length: 980, count: 4, spacing: 170 },
    dash: { name: 'Passo do Carrasco', windup: 620, lockAt: 0.65, active: 640, recovery: 620, damage: 28, speed: 1100, width: 90 },
    channel: { name: 'Tributo ao Silêncio', windup: 420, channelMs: 2500, recovery: 900, spokes: 6, announceMs: 850, damage: 24, width: 70, length: 760 },
    gravity: { name: 'Peso do Fim', announceMs: 700, activeMs: 3000, radius: 175, slow: 0.2, count: 2 },
    echo: { delay: 700, warnMs: 480 }
  }
} as const;

export type SelunMove = 'horizon' | 'sentence' | 'decree' | 'dash' | 'channel';

// ------------------------------------------------------------------ bênçãos permanentes de Apollon

export type ApollonBlessingId = 'solar_heart' | 'dawn_blade' | 'aurora_step' | 'unbroken_will' | 'light_skin' | 'pain_memory' | 'return_spark';

export interface ApollonBlessing {
  id: ApollonBlessingId;
  name: string;
  max: number;
  /** efeito com `lvl` níveis (texto curto) */
  effect(lvl: number): string;
}

const pct = (v: number) => `${Math.round(v)}%`;

export const APOLLON_BLESSINGS: ApollonBlessing[] = [
  { id: 'solar_heart', name: 'Coração Solar', max: 5, effect: (l) => `+${pct(8 * l)} de vida máxima` },
  { id: 'dawn_blade', name: 'Lâmina do Amanhecer', max: 5, effect: (l) => `+${pct(6 * l)} de dano` },
  { id: 'aurora_step', name: 'Passo da Aurora', max: 5, effect: (l) => `−${pct(4 * l)} na recarga da esquiva` },
  { id: 'unbroken_will', name: 'Vontade Inquebrável', max: 5, effect: (l) => `+${pct(10 * l)} de dano de postura` },
  { id: 'light_skin', name: 'Pele de Luz', max: 5, effect: (l) => `+${3 * l} p.p. de redução de dano` },
  { id: 'pain_memory', name: 'Memória da Dor', max: 5, effect: (l) => `esquiva perfeita: +${pct(5 * l)} de dano por 4 s` },
  { id: 'return_spark', name: 'Centelha de Retorno', max: 3, effect: (l) => `esquiva perfeita: cura ${l}% da vida (recarga 8 s)` }
];

export const FIRST_OFFER: ApollonBlessingId[] = ['solar_heart', 'dawn_blade', 'aurora_step'];
export const BRASA = { name: 'Brasa de Apollon', postureBonus: 0.1 };

export type BlessingLevels = Partial<Record<ApollonBlessingId, number>>;

export function blessingDef(id: string): ApollonBlessing | undefined {
  return APOLLON_BLESSINGS.find((b) => b.id === id);
}

export function eligibleBlessings(levels: BlessingLevels): ApollonBlessing[] {
  return APOLLON_BLESSINGS.filter((b) => (levels[b.id] ?? 0) < b.max);
}

/**
 * Ofertas: na primeira derrota, as três fixas; depois até 3 elegíveis distintas
 * (sorteadas). Nunca oferece uma bênção já no máximo.
 */
export function pickOffers(levels: BlessingLevels, firstDefeat: boolean, rng: () => number = Math.random): ApollonBlessingId[] {
  const pool = eligibleBlessings(levels).map((b) => b.id);
  if (firstDefeat) {
    const fixed = FIRST_OFFER.filter((id) => pool.includes(id));
    if (fixed.length === 3) return fixed;
  }
  const out: ApollonBlessingId[] = [];
  const rest = [...pool];
  while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return out;
}

/** Atributos derivados dos níveis (sempre a partir da base: nunca multiplica valor já modificado). */
export function blessingModifiers(levels: BlessingLevels, ember = false) {
  const l = (id: ApollonBlessingId) => Math.max(0, Math.min(blessingDef(id)!.max, levels[id] ?? 0));
  return {
    maxHpMul: 1 + 0.08 * l('solar_heart'),
    damageMul: 1 + 0.06 * l('dawn_blade'),
    dashRechargeMul: 1 - 0.04 * l('aurora_step'),
    postureMul: 1 + 0.1 * l('unbroken_will') + (ember ? BRASA.postureBonus : 0),
    resistAdd: 0.03 * l('light_skin'),
    painDamage: 0.05 * l('pain_memory'),
    sparkHeal: 0.01 * l('return_spark')
  };
}

/** Teto global de redução de dano (Pele de Luz respeita). */
export const RESIST_CAP = 0.6;

export interface SelunFeats {
  activeMs: number;
  breaks: number;
  recompositions: number;
  perfectDodges: number;
  phase: number;
}

/** Morte elegível para nível permanente? (senão, só a Brasa temporária) */
export function grantEligible(f: SelunFeats): boolean {
  return f.activeMs >= SELUN.grantMinActiveMs || f.breaks >= 1;
}
