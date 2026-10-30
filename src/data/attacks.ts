/**
 * Combo básico de Atriox. Todos os tempos em milissegundos.
 *
 *  |--windup--|--active--|------recovery------|
 *                        ^ chainFrom: a partir daqui um input "bufferizado" inicia o próximo golpe
 *
 * - windup:   preparação; dano ainda não é aplicado (pode ser cancelado por dash).
 * - active:   a hitbox existe somente nesta janela.
 * - recovery: pós-golpe; pode ser cancelado por dash/magia, ou encadeado no próximo golpe.
 * - resetAfter: tempo após o fim do golpe em que um novo clique ainda continua o combo.
 */
export interface ComboStepDef {
  id: 'attack_1' | 'attack_2' | 'attack_3';
  name: string;
  damage: number;
  windup: number;
  active: number;
  recovery: number;
  chainFrom: number;
  resetAfter: number;
  /** alcance da hitbox em setor (px) */
  range: number;
  /** abertura total do setor em graus */
  arcDeg: number;
  knockback: number;
  /** avanço do personagem ao golpear (px) */
  lunge: number;
  shake: number;
  hitstop: number;
  /** multiplicador de velocidade de movimento durante o golpe */
  moveFactor: number;
  finisher?: boolean;
}

export const ATRIOX_COMBO: ComboStepDef[] = [
  {
    id: 'attack_1',
    name: 'Corte Ascendente',
    damage: 12,
    windup: 70,
    active: 90,
    recovery: 180,
    chainFrom: 190,
    resetAfter: 260,
    range: 104,
    arcDeg: 120,
    knockback: 150,
    lunge: 26,
    shake: 0,
    hitstop: 45,
    moveFactor: 0.25
  },
  {
    id: 'attack_2',
    name: 'Corte Cruzado',
    damage: 14,
    windup: 85,
    active: 100,
    recovery: 200,
    chainFrom: 215,
    resetAfter: 260,
    range: 118,
    arcDeg: 190,
    knockback: 180,
    lunge: 32,
    shake: 0.002,
    hitstop: 55,
    moveFactor: 0.25
  },
  {
    id: 'attack_3',
    name: 'Julgamento da Lâmina',
    damage: 30,
    windup: 180,
    active: 110,
    recovery: 380,
    chainFrom: 600,
    resetAfter: 0,
    range: 140,
    arcDeg: 150,
    knockback: 460,
    lunge: 64,
    shake: 0.008,
    hitstop: 95,
    moveFactor: 0.1,
    finisher: true
  }
];
