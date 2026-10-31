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
  // Clean-body sheets supplied after v0.3. Preserve reading order: 3 anticipation,
  // 2 impact/follow-through and 3 recovery frames. The same rising cut is reused
  // for the heavy finisher and Sentença; the combat controllers define timing.
  const cleanMelee = (key: string, sheet: string): AnimDef => ({
    key,
    loop: false,
    frames: Array.from({ length: 8 }, (_, i) =>
      f(
        `${sheet}_${String(i).padStart(2, '0')}`,
        60,
        i < 3 ? 'windup' : i < 5 ? 'active' : 'recovery',
        i === 3 ? 'hit' : undefined,
      ),
    ),
  });
  const guardFrames = Array.from({ length: 4 }, (_, i) =>
    f(`atriox_guard_${String(i).padStart(2, '0')}`, 180),
  );
  // v0.5: finalizador diagonal próprio (atriox_combo_3). O quadro 05 não é usado:
  // a ponta da espada da pose vizinha atravessa a perna na folha original.
  const diagonal = (key: string): AnimDef => ({
    key,
    loop: false,
    frames: [
      f('atriox_diagonal_00', 60, 'windup'),
      f('atriox_diagonal_01', 60, 'windup'),
      f('atriox_diagonal_02', 80, 'windup'),
      f('atriox_diagonal_03', 45, 'active', 'hit'),
      f('atriox_diagonal_04', 75, 'active'),
      f('atriox_diagonal_06', 60, 'recovery'),
      f('atriox_diagonal_07', 60, 'recovery'),
    ],
  });
  defs.push(
    { key: 'atriox.idle', loop: true, frames: guardFrames },
    cleanMelee('atriox.attack_1', 'atriox_horizontal'),
    cleanMelee('atriox.attack_2', 'atriox_return'),
    diagonal('atriox.attack_3'),
    diagonal('atriox.attack_3_glory'),
  );
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
    cleanMelee('atriox.return_cut', 'atriox_horizontal'),
    cleanMelee('atriox.ascending', 'atriox_ascending'),
    advanced('atriox.execution_mark', 'atriox_advanced', 12),
    advanced('atriox.orbit', 'atriox_advanced_solar', 0),
    advanced('atriox.second_step', 'atriox_advanced_solar', 6),
    advanced('atriox.captive_sun', 'atriox_advanced_solar', 12),
    {
      key: 'atriox.charge_hold',
      loop: true,
      frames: Array.from({ length: 4 }, (_, i) =>
        f(`atriox_charge_${String(i).padStart(2, '0')}`, 160),
      ),
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
  // v0.5 — no modo sincronizado o `ms` é o PESO do quadro dentro da fase.
  // A antecipação é distribuída por vários quadros (sem pose congelada por ~1 s).
  const tk = (i: number) => `toknar_ceifa_${String(i).padStart(2, '0')}`;
  const tf = (i: number) => `toknar_fome_${String(i).padStart(2, '0')}`;
  defs.push(
    {
      // Ceifa Voraz: 3 cortes em 1280 ms (impactos em 0, 400 e 1080 ms — ToknarBrain).
      // Corte 1 horizontal; corte 2 é o retorno baixo; o 3º sobe de novo e espera (atrasado).
      key: 'toknar.cleave',
      loop: false,
      frames: [
        f(tk(0), 200, 'windup'),
        f(tk(1), 230, 'windup'),
        f(tk(2), 250, 'windup'),
        f(tk(3), 80, 'active', 'hit'),
        f(tk(4), 120, 'active'),
        f(tk(5), 200, 'active'),
        f(tk(6), 160, 'active', 'hit'),
        f(tk(1), 200, 'active'),
        f(tk(2), 320, 'active'),
        f(tk(3), 80, 'active', 'hit'),
        f(tk(4), 120, 'active'),
        f(tk(5), 300, 'recovery'),
        f(tk(6), 380, 'recovery'),
        f(tk(7), 420, 'recovery'),
      ],
    },
    {
      // Rhaesis tem fome: preparação própria e golpe no chão (não reaproveita a Ceifa).
      key: 'toknar.hunger',
      loop: false,
      frames: [
        f(tf(0), 220, 'windup'),
        f(tf(1), 380, 'windup'),
        f(tf(2), 650, 'windup'),
        f(tf(3), 70, 'active', 'hit'),
        f(tf(4), 110, 'active'),
        f(tf(5), 420, 'recovery'),
        f(tf(6), 420, 'recovery'),
        f(tf(7), 460, 'recovery'),
      ],
    },
    {
      key: 'toknar.spin',
      loop: false,
      frames: [
        f(tc(4), 450, 'windup'),
        f(tc(5), 450, 'windup'),
        f(tc(6), 1, 'active'),
        f(tc(7), 500, 'recovery'),
        f(tm(12), 850, 'recovery'),
      ],
    },
    // Carnificina: giro contínuo em loop durante a fase ativa
    { key: 'toknar.spin_loop', loop: true, frames: [6, 7, 4, 5].map((i) => f(tc(i), 75)) },
    {
      key: 'toknar.charge',
      loop: false,
      frames: [
        f(tm(0), 300, 'windup'),
        f(tc(8), 700, 'windup'),
        f(tc(9), 1, 'active'),
        f(tc(10), 450, 'recovery'),
        f(tc(11), 450, 'recovery'),
        f(tm(0), 400, 'recovery'),
      ],
    },
    // Investida: corrida acelerada durante o deslocamento comprometido
    { key: 'toknar.charge_loop', loop: true, frames: [4, 5, 6, 7, 8, 9, 10, 11].map((i) => f(tm(i), 58)) },
    {
      key: 'toknar.feast',
      loop: false,
      frames: [
        f(tc(12), 500, 'windup'),
        f(tc(13), 500, 'windup'),
        f(tc(14), 1, 'active'),
        f(tc(15), 700, 'recovery'),
        f(tm(0), 600, 'recovery'),
      ],
    },
    // Banquete: canalização com o machado fincado (loop interrompível por postura)
    { key: 'toknar.feast_loop', loop: true, frames: [f(tc(13), 260), f(tc(14), 320)] },
    // Postura quebrada: curvado sobre o machado, ofegante
    { key: 'toknar.broken', loop: true, frames: [f(tf(4), 300), f(tf(5), 300)] },
    { key: 'toknar.dead', loop: false, frames: [f(tf(4), 260), f(tc(14), 99999)] },
  );

  // ------------------------------------------------------------------ CAIM 3/4 (v0.5)
  const cp = (i: number) => `caim_pool3q_${String(i).padStart(2, '0')}`;
  const ce = (i: number) => `caim_erupt3q_${String(i).padStart(2, '0')}`;
  defs.push(
    {
      key: 'caim.pool',
      loop: false,
      frames: [
        f(cp(0), 1, 'windup'),
        f(cp(1), 1, 'windup'),
        f(cp(2), 1.2, 'windup'),
        f(cp(3), 1, 'active', 'release'),
        f(cp(4), 1, 'active'),
        f(cp(5), 1, 'recovery'),
      ],
    },
    {
      key: 'caim.eruption',
      loop: false,
      frames: [
        f(ce(0), 0.8, 'windup'),
        f(ce(1), 1, 'windup'),
        f(ce(2), 1.2, 'windup'),
        f(ce(3), 1, 'active', 'release'),
        f(ce(4), 1, 'active'),
        f(ce(5), 1, 'recovery'),
      ],
    },
    // defesas (loops enquanto duram): Manto da Servidão e Colheita dos Servos
    { key: 'caim.shield', loop: true, frames: [f(cp(3), 380), f(cp(4), 420)] },
    { key: 'caim.ritual', loop: true, frames: [f(ce(3), 420), f(ce(4), 480)] },
  );

  // ------------------------------------------------------------------ CARRASCO (v0.5)
  const cr = (k: string, i: number) => `carrasco_${k}_${String(i).padStart(2, '0')}`;
  const heavy = (key: string, k: string): AnimDef => ({
    key,
    loop: false,
    frames: [
      f(cr(k, 0), 0.7, 'windup'),
      f(cr(k, 1), 1, 'windup'),
      f(cr(k, 2), 1.3, 'windup'),
      f(cr(k, 3), 1, 'active', 'hit'),
      f(cr(k, 4), 1, 'active'),
      f(cr(k, 5), 1, 'recovery'),
      f(cr(k, 6), 1, 'recovery'),
      f(cr(k, 7), 1.2, 'recovery'),
    ],
  });
  defs.push(
    { key: 'carrasco.idle', loop: true, frames: [0, 1, 2, 3].map((i) => f(cr('idle', i), 220)) },
    { key: 'carrasco.run', loop: true, frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f(cr('run', i), 105)) },
    heavy('carrasco.sweep', 'sweep'),
    heavy('carrasco.overhead', 'execute'),
    heavy('carrasco.inferno', 'execute'),
    {
      key: 'carrasco.charge',
      loop: false,
      frames: [
        f(cr('idle', 3), 0.35, 'windup'),
        f(cr('charge', 0), 0.65, 'windup'),
        f(cr('charge', 1), 1, 'active'),
        f(cr('charge', 6), 1, 'recovery'),
        f(cr('charge', 7), 1.4, 'recovery'),
      ],
    },
    { key: 'carrasco.charge_loop', loop: true, frames: [1, 2, 3, 4, 5].map((i) => f(cr('charge', i), 70)) },
    { key: 'carrasco.broken', loop: true, frames: [0, 1, 2, 3].map((i) => f(cr('broken', i), 240)) },
    { key: 'carrasco.hurt', loop: false, frames: [f(cr('hurt', 0), 70), f(cr('hurt', 1), 90), f(cr('hurt', 2), 90), f(cr('hurt', 3), 90)] },
    { key: 'carrasco.rage', loop: true, frames: [f(cr('execute', 1), 300), f(cr('execute', 2), 500)] },
    { key: 'carrasco.dead', loop: false, frames: [0, 1, 2, 3].map((i) => f(cr('death', i), i === 3 ? 99999 : 260)) },
  );

  // ------------------------------------------------------------------ GOBLIN / ORC (v0.5)
  const melee4 = (char: string, runMs: number): AnimDef[] => {
    const n = (k: string, i: number) => `${char}_${k}_${String(i).padStart(2, '0')}`;
    return [
      { key: `${char}.run`, loop: true, frames: [0, 1, 2, 3].map((i) => f(n('run', i), runMs)) },
      {
        key: `${char}.attack`,
        loop: false,
        frames: [
          f(n('run', 3), 0.6, 'windup'),
          f(n('attack', 0), 1.4, 'windup'),
          f(n('attack', 1), 1, 'active', 'hit'),
          f(n('attack', 2), 1, 'active'),
          f(n('attack', 3), 1, 'recovery'),
          f(n('run', 0), 0.6, 'recovery'),
        ],
      },
      { key: `${char}.hurt`, loop: true, frames: [f(n('fall', 0), 9999)] },
      { key: `${char}.dead`, loop: false, frames: [f(n('fall', 0), 120), f(n('fall', 1), 160), f(n('fall', 2), 180), f(n('fall', 3), 99999)] },
    ];
  };
  defs.push(...melee4('goblin', 85), ...melee4('orc', 120));

  // ------------------------------------------------------------------ WYVERN SELVAGEM (v0.5)
  const ww = (k: string, i: number) => `wyvwild_${k}_${String(i).padStart(2, '0')}`;
  defs.push(
    { key: 'wyvern_wild.materialize', loop: true, frames: [0, 1, 2, 3].map((i) => f(ww('fly', i), 120)) },
    { key: 'wyvern_wild.fly', loop: true, frames: [0, 1, 2, 3].map((i) => f(ww('fly', i), 115)) },
    { key: 'wyvern_wild.windup', loop: true, frames: [f(ww('attack', 0), 260), f(ww('attack', 1), 9999)] },
    { key: 'wyvern_wild.charge', loop: true, frames: [f(ww('attack', 2), 120), f(ww('attack', 3), 120)] },
    { key: 'wyvern_wild.recovery', loop: true, frames: [f(ww('fall', 0), 260), f(ww('fly', 2), 260), f(ww('fly', 3), 260)] },
    { key: 'wyvern_wild.dissolve', loop: false, frames: [0, 1, 2, 3].map((i) => f(ww('fall', i), i === 3 ? 99999 : 170)) },
  );
  // ------------------------------------------------------------------ PROVAÇÃO (complementos v0.5)
  // No modo sincronizado o `ms` é o peso do quadro na fase (ver FrameTimeline).
  const n2 = (c: string, k: string, i: number) => `${c}_${k}_${String(i).padStart(2, '0')}`;
  defs.push(
    { key: 'recruit.run', loop: true, frames: [0, 1, 2, 3].map((i) => f(n2('recruit', 'run', i), 90)) },
    {
      key: 'recruit.attack',
      loop: false,
      frames: [
        f(n2('recruit', 'run', 3), 0.4, 'windup'),
        f(n2('recruit', 'atk', 0), 1, 'windup'),
        f(n2('recruit', 'atk', 1), 1.1, 'windup'),
        f(n2('recruit', 'atk', 2), 1, 'active', 'hit'),
        f(n2('recruit', 'atk', 3), 1, 'active'),
        f(n2('recruit', 'atk', 4), 0.6, 'recovery'),
        f(n2('recruit', 'atk', 5), 1, 'recovery'),
        f(n2('recruit', 'atk', 6), 1, 'recovery'),
        f(n2('recruit', 'atk', 7), 1, 'recovery'),
      ],
    },
    { key: 'recruit.hurt', loop: true, frames: [f(n2('recruit', 'fall', 0), 9999)] },
    { key: 'recruit.dead', loop: false, frames: [1, 2, 3, 5].map((i, k) => f(n2('recruit', 'fall', i), k === 3 ? 99999 : 150)) },

    { key: 'archer.run', loop: true, frames: [0, 1, 2, 3].map((i) => f(n2('archer', 'run', i), 95)) },
    {
      key: 'archer.attack',
      loop: false,
      frames: [
        f(n2('archer', 'shot', 0), 0.8, 'windup'),
        f(n2('archer', 'shot', 1), 1, 'windup'),
        f(n2('archer', 'shot', 2), 1, 'windup'),
        f(n2('archer', 'shot', 3), 1.2, 'windup'),
        f(n2('archer', 'shot', 4), 1, 'active', 'hit'),
        f(n2('archer', 'shot', 5), 1.2, 'recovery'),
        f(n2('archer', 'shot', 0), 0.8, 'recovery'),
      ],
    },
    { key: 'archer.hurt', loop: true, frames: [f(n2('archer', 'fall', 0), 9999)] },
    { key: 'archer.dead', loop: false, frames: [1, 3, 4, 7].map((i, k) => f(n2('archer', 'fall', i), k === 3 ? 99999 : 150)) },

    { key: 'guardian.run', loop: true, frames: [0, 1, 2, 3].map((i) => f(n2('guardian', 'run', i), 130)) },
    {
      key: 'guardian.attack',
      loop: false,
      frames: [
        f(n2('guardian', 'slam', 0), 0.8, 'windup'),
        f(n2('guardian', 'slam', 1), 1, 'windup'),
        f(n2('guardian', 'slam', 2), 1.2, 'windup'),
        f(n2('guardian', 'slam', 3), 1, 'active', 'hit'),
        f(n2('guardian', 'slam', 4), 1, 'recovery'),
        f(n2('guardian', 'slam', 5), 1, 'recovery'),
      ],
    },
    { key: 'guardian.hurt', loop: true, frames: [f(n2('guardian', 'fall', 0), 9999)] },
    { key: 'guardian.dead', loop: false, frames: [1, 2, 3].map((i, k) => f(n2('guardian', 'fall', i), k === 2 ? 99999 : 180)) },

    // Avatar: Atriox invoca sozinho; a emanação de Apollon é um sprite separado (apollon_avatar_*)
    { key: 'atriox.avatar', loop: false, frames: [f(S(5), 380), f(S(6), 520), f(S(8), 1600)] },
  );

  // ------------------------------------------------------------------ SÊLUN (PROMPT_SELUN_GAME_OVER)
  // Golpes de 8 poses: 0–2 preparação, 3 impacto, 4–5 continuação, 6–7 recuperação.
  const sl = (k: string, i: number) => `selun_${k}_${String(i).padStart(2, '0')}`;
  const strike8 = (key: string, k: string): AnimDef => ({
    key,
    loop: false,
    frames: [
      f(sl(k, 0), 0.8, 'windup'),
      f(sl(k, 1), 1, 'windup'),
      f(sl(k, 2), 1.2, 'windup'),
      f(sl(k, 3), 1, 'active', 'hit'),
      f(sl(k, 4), 1, 'active'),
      f(sl(k, 5), 1, 'active'),
      f(sl(k, 6), 1, 'recovery'),
      f(sl(k, 7), 1.2, 'recovery'),
    ],
  });
  const loopOf = (key: string, k: string, ids: number[], ms: number): AnimDef => ({ key, loop: true, frames: ids.map((i) => f(sl(k, i), ms)) });
  defs.push(
    loopOf('selun.idle', 'idle', [0, 1, 2, 3], 240),
    loopOf('selun.run', 'run', [0, 1, 2, 3, 4, 5, 6, 7], 100),
    strike8('selun.horizon', 'horizon'),
    strike8('selun.sentence', 'sentence'),
    {
      // Decreto do Fim: ergue a espada, finca e aponta; as fendas saem durante a fase ativa
      key: 'selun.decree',
      loop: false,
      frames: [
        f(sl('decree', 0), 0.7, 'windup'),
        f(sl('decree', 1), 1, 'windup'),
        f(sl('decree', 2), 1, 'windup'),
        f(sl('decree', 3), 1, 'windup'),
        f(sl('decree', 4), 1, 'active', 'hit'),
        f(sl('decree', 5), 2, 'active'),
        f(sl('decree', 6), 1, 'recovery'),
        f(sl('decree', 7), 1, 'recovery'),
      ],
    },
    {
      // Investida: 3 entrada, 4 loop (selun.dash_loop), 3 freio
      key: 'selun.dash',
      loop: false,
      frames: [
        f(sl('dash', 0), 1, 'windup'),
        f(sl('dash', 1), 1, 'windup'),
        f(sl('dash', 2), 1.2, 'windup'),
        f(sl('dash', 3), 1, 'active', 'hit'),
        f(sl('dash', 7), 1, 'recovery'),
        f(sl('dash', 8), 1, 'recovery'),
        f(sl('dash', 9), 1.2, 'recovery'),
      ],
    },
    loopOf('selun.dash_loop', 'dash', [3, 4, 5, 6], 70),
    {
      // Canalização: 3 entrada, 4 loop (selun.channel_loop), 3 saída/interrupção
      key: 'selun.channel',
      loop: false,
      frames: [
        f(sl('channel', 0), 1, 'windup'),
        f(sl('channel', 1), 1, 'windup'),
        f(sl('channel', 2), 1, 'windup'),
        f(sl('channel', 3), 1, 'active', 'hit'),
        f(sl('channel', 7), 1, 'recovery'),
        f(sl('channel', 8), 1, 'recovery'),
        f(sl('channel', 9), 1, 'recovery'),
      ],
    },
    loopOf('selun.channel_loop', 'channel', [3, 4, 5, 6], 220),
    loopOf('selun.stagger', 'stagger', [0, 1, 2, 3], 260),
    { key: 'selun.hurt', loop: false, frames: [0, 1, 2, 3].map((i) => f(sl('hurt', i), 70)) },
    { key: 'selun.fury', loop: false, frames: [0, 1, 2, 3].map((i) => f(sl('fury', i), i === 3 ? 400 : 300)) },
    { key: 'selun.fall', loop: false, frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f(sl('fall', i), i === 7 ? 99999 : 200)) },
    { key: 'selun.recompose', loop: false, frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f(sl('recompose', i), 205)) },
    // Última Palavra: espada fincada (pose do Decreto) durante a contagem
    { key: 'selun.plant', loop: true, frames: [f(sl('decree', 4), 600), f(sl('decree', 3), 600)] },
  );

  const out: Record<string, AnimDef> = {};
  for (const d of defs) out[d.key] = d;
  return out;
}
