/** Constantes globais do jogo. */
export const GAME_W = 1280;
export const GAME_H = 720;

/** Mundo da arena (px) */
export const WORLD_W = 2400;
export const WORLD_H = 1720;

/** Área caminhável (o restante é parede, borda e abismo) */
export const FLOOR = { x: 170, y: 330, w: 2060, h: 1210 };
export const ARENA_CENTER = { x: FLOOR.x + FLOOR.w / 2, y: FLOOR.y + FLOOR.h / 2 + 20 };

/** Profundidades de desenho. Entidades usam a coordenada Y (ordenação 2.5D). */
export const DEPTH = {
  background: -100000,
  decal: -90000,
  telegraph: -80000,
  shadow: -70000,
  groundFx: -60000,
  overlayFx: 200000,
  vignette: 300000
};

/**
 * Escalas de exibição dos personagens do atlas (altura em pé no atlas: Atriox 228 px,
 * Caim 238 px). Atriox ≈ 128 px no mundo; com o zoom da câmera ≈ 141 px na tela.
 */
export const ATRIOX_SCALE = 0.56;
export const CAIM_SCALE = 0.56;
export const WYVERN_SCALE = 0.62;

/** Zoom da câmera: valoriza os personagens sem esconder telegraphs fora da tela */
export const CAMERA_ZOOM = 1.1;

/**
 * Ferramentas de desenvolvimento (painel, hooks de teste).
 * Ativas em `npm run dev`; em produção apenas se VITE_DEV_TOOLS=true.
 */
export const DEV_TOOLS: boolean = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';

export const FONT_TITLE = 'Georgia, "Times New Roman", serif';
export const FONT_UI = 'Georgia, "Times New Roman", serif';

export const COLORS = {
  black: 0x0b0809,
  iron: 0x5b5f66,
  gold: 0xe8b24a,
  goldBright: 0xffd77a,
  ivory: 0xf1e3c4,
  bloodRed: 0x8e1b1f,
  ember: 0xff7a2a,
  danger: 0xff3b1f,
  hex: {
    gold: '#e8b24a',
    goldBright: '#ffd77a',
    ivory: '#f1e3c4',
    dim: '#a89878',
    red: '#d0473a',
    ember: '#ff9b3d'
  }
};
