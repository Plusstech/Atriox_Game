/**
 * Inimigos comuns. Recruta/atirador/guardião: treinamento do Campo de Provação.
 * Goblin e orc saqueador (v0.5): inimigos das primeiras fases com folhas próprias.
 * Todos são criações originais do jogo — NÃO são antagonistas canônicos da história.
 */
export type EnemyKind = 'recruit' | 'archer' | 'guardian' | 'goblin' | 'orc';
export type EnemyAttackShape = 'sector' | 'circle' | 'projectile';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  /** raio do corpo para colisão / hurtbox */
  radius: number;
  detectRange: number;
  /** distância em que inicia o ataque */
  attackRange: number;
  /** distância mínima preferida (inimigos à distância) */
  minRange?: number;
  windup: number;
  active: number;
  recovery: number;
  /** tempo extra entre ataques */
  attackCooldown: number;
  damage: number;
  knockback: number;
  attackShape: EnemyAttackShape;
  /** setor: raio e abertura; círculo: raio */
  hitRadius: number;
  hitArcDeg?: number;
  /** avanço no golpe */
  lunge?: number;
  projectileSpeed?: number;
  /** dano necessário em um único golpe para interromper (stagger) */
  poise: number;
  hurtDuration: number;
  /** resistência a knockback (0..1) */
  knockbackResist: number;
  scale: number;
  /** rig procedural (corpo + arma) */
  texture?: string;
  weaponTexture?: string;
  /** quadros do atlas: `${anim}.run|attack|hurt|dead`; altura visual (px do mundo) para a barra de vida */
  sprite?: { char: string; anim: string; height: number };
  /** escudo frontal: reduz dano vindo da frente (arco em graus); golpes pesados quebram a guarda */
  shield?: { arcDeg: number; reduction: number };
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  recruit: {
    kind: 'recruit',
    name: 'Recruta da Provação',
    hp: 46,
    speed: 150,
    radius: 18,
    detectRange: 640,
    attackRange: 70,
    windup: 480,
    active: 120,
    recovery: 650,
    attackCooldown: 350,
    damage: 9,
    knockback: 220,
    attackShape: 'sector',
    hitRadius: 92,
    hitArcDeg: 110,
    lunge: 38,
    poise: 1,
    hurtDuration: 260,
    knockbackResist: 0,
    scale: 0.62,
    sprite: { char: 'recruit', anim: 'recruit', height: 124 },
    texture: 'enemy_recruit',
    weaponTexture: 'weapon_sword'
  },
  archer: {
    kind: 'archer',
    name: 'Atirador da Provação',
    hp: 34,
    speed: 135,
    radius: 16,
    detectRange: 760,
    attackRange: 420,
    minRange: 230,
    windup: 650,
    active: 60,
    recovery: 700,
    attackCooldown: 900,
    damage: 8,
    knockback: 140,
    attackShape: 'projectile',
    hitRadius: 10,
    projectileSpeed: 430,
    poise: 1,
    hurtDuration: 260,
    knockbackResist: 0,
    scale: 0.6,
    sprite: { char: 'archer', anim: 'archer', height: 123 },
    texture: 'enemy_archer',
    weaponTexture: 'weapon_bow'
  },
  guardian: {
    kind: 'guardian',
    name: 'Guardião da Provação',
    hp: 150,
    speed: 82,
    radius: 26,
    detectRange: 700,
    attackRange: 105,
    windup: 950,
    active: 140,
    recovery: 1050,
    attackCooldown: 500,
    damage: 18,
    knockback: 380,
    attackShape: 'circle',
    hitRadius: 120,
    poise: 28,
    hurtDuration: 320,
    knockbackResist: 0.75,
    scale: 0.66,
    sprite: { char: 'guardian', anim: 'guardian', height: 155 },
    texture: 'enemy_guardian',
    weaponTexture: 'weapon_mace'
  },
  goblin: {
    kind: 'goblin',
    name: 'Goblin',
    hp: 30,
    speed: 215,
    radius: 15,
    detectRange: 700,
    attackRange: 92,
    windup: 380,
    active: 110,
    recovery: 520,
    attackCooldown: 450,
    damage: 8,
    knockback: 160,
    attackShape: 'sector',
    hitRadius: 88,
    hitArcDeg: 80,
    lunge: 74,
    poise: 1,
    hurtDuration: 240,
    knockbackResist: 0,
    scale: 0.62,
    sprite: { char: 'goblin', anim: 'goblin', height: 96 }
  },
  orc: {
    kind: 'orc',
    name: 'Orc saqueador',
    hp: 120,
    speed: 118,
    radius: 24,
    detectRange: 700,
    attackRange: 112,
    windup: 760,
    active: 140,
    recovery: 900,
    attackCooldown: 600,
    damage: 16,
    knockback: 340,
    attackShape: 'sector',
    hitRadius: 128,
    hitArcDeg: 120,
    lunge: 54,
    poise: 30,
    hurtDuration: 340,
    knockbackResist: 0.6,
    scale: 0.66,
    sprite: { char: 'orc', anim: 'orc', height: 136 },
    shield: { arcDeg: 120, reduction: 0.8 }
  }
};
