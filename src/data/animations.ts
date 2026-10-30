import type { AnimDef, AnimFrame } from '../game/animation/FrameTimeline';

/**
 * Animações por quadros a partir do atlas `characters` (tools/build_atlases.py).
 * Todos os quadros estão normalizados olhando para a DIREITA; o jogo espelha.
 *
 * Ataques usam fases (windup/active/recovery): o ComboController define o tempo
 * e a animação escolhe o quadro pela fase — o dano só existe na fase 'active'.
 * Em modo livre, `ms` é a duração do quadro.
 */
const f = (
  name: string,
  ms: number,
  phase?: AnimFrame['phase'],
  event?: string,
): AnimFrame => ({ name, ms, phase, event });
const A = (n: number): string => `atriox_combat_${String(n).padStart(2, '0')}`;
const S = (n: number): string => `atriox_solar_${String(n).padStart(2, '0')}`;
const CM = (n: number): string => `caim_move_${String(n).padStart(2, '0')}`;
const CB = (n: number): string => `caim_blood_${String(n).padStart(2, '0')}`;
const W = (n: number): string => `wyvern_${String(n).padStart(2, '0')}`;

export interface AtlasMeta {
  atrioxRunOrder: string[];
  caimRunOrder: string[];
  origins: Record<
    string,
    { originX: number; originY: number; sourceW: number; sourceH: number }
  >;
}

export function buildAnimations(meta: AtlasMeta): Record<string, AnimDef> {
  const run = (
    meta.atrioxRunOrder?.length
      ? meta.atrioxRunOrder
      : Array.from(
          { length: 12 },
          (_, i) => `atriox_run_${String(i).padStart(2, '0')}`,
        )
  ).map((n) => f(n, 72, undefined, undefined));
  // marcadores de passo (poeira/som) em dois pontos opostos do ciclo
  run[0].event = 'step';
  run[Math.floor(run.length / 2)].event = 'step';

  const defs: AnimDef[] = [
    // ------------------------------------------------------------------ ATRIOX
    { key: 'atriox.idle', loop: true, frames: [f(A(7), 1000)] },
    { key: 'atriox.run', loop: true, frames: run },
    {
      key: 'atriox.attack_1',
      loop: false,
      frames: [
        f(A(8), 1, 'windup'),
        f(A(6), 1, 'active', 'hit'),
        f(A(6), 1, 'recovery'),
        f(A(7), 1.4, 'recovery'),
      ],
    },
    {
      key: 'atriox.attack_2',
      loop: false,
      frames: [
        f(A(3), 1, 'windup'),
        f(A(9), 1, 'active', 'hit'),
        f(A(10), 1, 'active'),
        f(A(11), 1, 'recovery'),
      ],
    },
    {
      key: 'atriox.attack_3',
      loop: false,
      frames: [
        f(A(4), 1, 'windup'),
        f(A(5), 1, 'active', 'hit'),
        f(A(5), 1, 'recovery'),
        f(A(3), 1.3, 'recovery'),
      ],
    },
    {
      key: 'atriox.attack_3_glory',
      loop: false,
      frames: [
        f(S(0), 1, 'windup'),
        f(S(1), 1, 'active', 'hit'),
        f(S(2), 1, 'recovery'),
        f(A(3), 1, 'recovery'),
      ],
    },
    {
      key: 'atriox.dash',
      loop: false,
      frames: [f(A(1), 50), f(A(2), 120), f(A(0), 90)],
    },
    {
      key: 'atriox.dash_radiant',
      loop: false,
      frames: [f(S(9), 40), f(S(10), 70), f(S(11), 70), f(S(12), 90)],
    },
    {
      key: 'atriox.cast',
      loop: false,
      frames: [
        f(S(5), 1, 'windup'),
        f(S(6), 1, 'active', 'release'),
        f(S(6), 1, 'recovery'),
      ],
    },
    {
      key: 'atriox.cast_sun',
      loop: false,
      frames: [
        f(S(5), 1, 'windup'),
        f(S(6), 1, 'windup'),
        f(S(8), 1, 'active', 'release'),
        f(S(8), 1, 'recovery'),
      ],
    },
    {
      key: 'atriox.avatar',
      loop: false,
      frames: [
        f(S(13), 420),
        f(S(14), 380, undefined, 'avatar'),
        f(S(15), 900, undefined, 'beam'),
        f(S(16), 600),
      ],
    },
    { key: 'atriox.hurt', loop: false, frames: [f(A(12), 220)] },
    {
      key: 'atriox.bloodStunned',
      loop: true,
      frames: [f(A(13), 170), f(A(15), 170), f(A(14), 220), f(A(15), 170)],
    },
    { key: 'atriox.dead', loop: false, frames: [f(A(12), 99999)] },

    // ------------------------------------------------------------------ CAIM
    { key: 'caim.idle', loop: true, frames: [f(CM(23), 700), f(CM(17), 700)] },
    {
      key: 'caim.run',
      loop: true,
      frames: meta.caimRunOrder.map((n) => f(n, 85)),
    },
    {
      key: 'caim.claw',
      loop: false,
      frames: [
        f(CM(12), 1, 'windup'),
        f(CM(13), 1, 'windup'),
        f(CM(14), 1, 'active', 'hit'),
        f(CM(11), 1, 'recovery'),
      ],
    },
    {
      key: 'caim.blink',
      loop: false,
      frames: [
        f(CM(18), 1, 'windup'),
        f(CM(19), 1, 'active'),
        f(CM(20), 1, 'active'),
        f(CM(21), 1, 'active'),
        f(CM(22), 1, 'recovery'),
      ],
    },
    {
      key: 'caim.pool',
      loop: false,
      frames: [
        f(CB(1), 1, 'windup'),
        f(CB(2), 1, 'windup'),
        f(CB(3), 1, 'active', 'release'),
        f(CB(4), 1, 'recovery'),
      ],
    },
    {
      key: 'caim.eruption',
      loop: false,
      frames: [
        f(CB(5), 1, 'windup'),
        f(CB(6), 1, 'active', 'release'),
        f(CB(7), 1, 'recovery'),
      ],
    },
    {
      key: 'caim.summon',
      loop: false,
      frames: [
        f(CB(8), 1, 'windup'),
        f(CB(9), 1, 'windup'),
        f(CB(10), 1, 'active', 'release'),
        f(CB(11), 1, 'recovery'),
      ],
    },
    { key: 'caim.reaction', loop: false, frames: [f(CM(15), 520)] },
    {
      key: 'caim.dead',
      loop: false,
      frames: [f(CM(15), 300), f(CB(8), 99999)],
    },

    // ------------------------------------------------------------------ WYVERN
    {
      key: 'wyvern.materialize',
      loop: false,
      frames: [f(W(8), 250), f(W(9), 250), f(W(10), 250), f(W(11), 200)],
    },
    {
      key: 'wyvern.fly',
      loop: true,
      frames: [f(W(0), 110), f(W(1), 110), f(W(2), 110), f(W(3), 120)],
    },
    { key: 'wyvern.windup', loop: true, frames: [f(W(7), 160), f(W(6), 9999)] },
    { key: 'wyvern.charge', loop: true, frames: [f(W(5), 9999)] },
    {
      key: 'wyvern.recovery',
      loop: true,
      frames: [f(W(4), 200), f(W(11), 220), f(W(0), 200)],
    },
    {
      key: 'wyvern.dissolve',
      loop: false,
      frames: [f(W(10), 160), f(W(9), 160), f(W(8), 220)],
    },

    // ------------------------------------------------------------------ BÊNÇÃO (quadros compostos)
    {
      key: 'apollon.blessing',
      loop: false,
      frames: [0, 1, 2, 3, 4, 5].map((i) =>
        f(
          `apollon_blessing_${String(i).padStart(2, '0')}`,
          [1500, 1500, 1400, 1300, 1600, 2200][i],
        ),
      ),
    },
  ];
  const advanced = (key: string, sheet: string, start: number): AnimDef => ({
    key,
    loop: false,
    frames: Array.from({ length: 6 }, (_, i) =>
      f(
        `${sheet}_${String(start + i).padStart(2, '0')}`,
        i === 0 ? 160 : 110,
        i < 2 ? 'windup' : i < 4 ? 'active' : 'recovery',
        i === 2 ? 'hit' : undefined,
      ),
    ),
  });
  defs.push(
    advanced('atriox.return_cut', 'atriox_advanced', 0),
    advanced('atriox.ascending', 'atriox_advanced', 6),
    advanced('atriox.execution_mark', 'atriox_advanced', 12),
    advanced('atriox.orbit', 'atriox_advanced_solar', 0),
    advanced('atriox.second_step', 'atriox_advanced_solar', 6),
    advanced('atriox.captive_sun', 'atriox_advanced_solar', 12),
    {
      key: 'atriox.charge_hold',
      loop: true,
      frames: [f('atriox_advanced_07', 160), f('atriox_advanced_08', 160)],
    },
  );
  const tm = (i: number) => `toknar_move_${String(i).padStart(2, '0')}`;
  const tc = (i: number) => `toknar_combat_${String(i).padStart(2, '0')}`;
  defs.push(
    {
      key: 'toknar.idle',
      loop: true,
      frames: [0, 1, 2, 3].map((i) => f(tm(i), 180)),
    },
    {
      key: 'toknar.run',
      loop: true,
      frames: [4, 5, 6, 7, 8, 9, 10, 11].map((i) => f(tm(i), 95)),
    },
    {
      key: 'toknar.rage',
      loop: false,
      frames: [12, 13, 14, 15].map((i) => f(tm(i), 230)),
    },
  );
  for (const [move, start] of [
    ['cleave', 0],
    ['spin', 4],
    ['charge', 8],
    ['hunger', 0],
    ['feast', 12],
  ] as const)
    defs.push({
      key: `toknar.${move}`,
      loop: false,
      frames: [
        f(tc(start), 180, 'windup'),
        f(tc(start + 1), 150, 'active', 'hit'),
        f(tc(start + 2), 150, 'active'),
        f(tc(start + 3), 260, 'recovery'),
      ],
    });
  const out: Record<string, AnimDef> = {};
  for (const d of defs) out[d.key] = d;
  return out;
}
