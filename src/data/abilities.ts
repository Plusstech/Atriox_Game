/**
 * Habilidades de Atriox. A lógica (SpellController) só conhece estes números;
 * os efeitos visuais ficam em fx/Effects.ts. Para trocar a magia, crie outra
 * definição e outro "executor" em abilities/.
 */
export interface DashDef {
  /** duração do deslocamento (ms) */
  duration: number;
  /** distância total percorrida (px) */
  distance: number;
  /** invulnerabilidade a partir do início (ms) — sempre ≤ duração */
  iframes: number;
  /** número de cargas */
  charges: number;
  /** tempo para recarregar UMA carga (ms) */
  rechargeMs: number;
  /** intervalo mínimo entre dois dashes (ms) */
  minGap: number;
  /** pequena recuperação após o dash (ms) */
  recovery: number;
}

export const ATRIOX_DASH: DashDef = {
  duration: 170,
  distance: 200,
  iframes: 150,
  charges: 2,
  rechargeMs: 950,
  minGap: 110,
  recovery: 60
};

export interface SpellDef {
  id: string;
  name: string;
  description: string;
  castTime: number;
  cooldown: number;
  projectileSpeed: number;
  projectileRange: number;
  projectileRadius: number;
  directDamage: number;
  explosionRadius: number;
  explosionDamage: number;
  knockback: number;
}

export const JUDGMENT_FLAME: SpellDef = {
  id: 'judgment_flame',
  name: 'Chama do Julgamento',
  description:
    'Atriox concentra a luz solar da runa em seu peito e dispara uma chama de julgamento que explode ao tocar o inimigo.',
  castTime: 240,
  cooldown: 3200,
  projectileSpeed: 640,
  projectileRange: 620,
  projectileRadius: 16,
  directDamage: 14,
  explosionRadius: 96,
  explosionDamage: 34,
  knockback: 320
};
