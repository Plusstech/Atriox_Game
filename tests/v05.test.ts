import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import atlas from '../public/assets/atlas/characters.json';
import { buildAnimations } from '../src/data/animations';
import { FrameTimeline, type AnimDef } from '../src/game/animation/FrameTimeline';
import { BOSS_DIALOGUES, DialogueState, PORTRAITS, ARENA_IMAGES, SPEAKERS } from '../src/data/dialogues';
import { BossBrain } from '../src/game/ai/BossBrain';
import { EXECUTIONER } from '../src/data/bosses';
import { TOKNAR } from '../src/data/v03';
import { ROOMS } from '../src/data/rooms';
import { ENEMIES } from '../src/data/enemies';
import { WyvernBrain, WYVERN_WILD } from '../src/game/ai/WyvernBrain';
import { ToknarBrain } from '../src/game/ai/ToknarBrain';

const defs = buildAnimations(atlas.meta as never);

/** Maior tempo (ms) que um único quadro fica parado dentro de uma fase sincronizada. */
function longestHold(d: AnimDef, phase: 'windup' | 'active' | 'recovery', phaseMs: number): number {
  const fr = d.frames.filter((f) => f.phase === phase);
  const total = fr.reduce((s, f) => s + f.ms, 0);
  return Math.max(...fr.map((f) => (f.ms / total) * phaseMs));
}

describe('v0.5 — conversas pré-chefe', () => {
  it('confirmar completa a fala; depois avança; no fim encerra uma única vez', () => {
    const st = new DialogueState(BOSS_DIALOGUES.toknar);
    st.tick(50);
    expect(st.complete).toBe(false);
    expect(st.confirm()).toBe('completed');
    expect(st.visibleText).toBe(BOSS_DIALOGUES.toknar[0].text);
    expect(st.confirm()).toBe('next');
    expect(st.index).toBe(1);
    expect(st.visibleText).toBe('');
    st.tick(60_000);
    expect(st.complete).toBe(true);
    st.confirm();
    st.confirm();
    expect(st.confirm()).toBe('end');
    expect(st.done).toBe(true);
    expect(st.confirm()).toBe('end');
  });

  it('pular encerra sem avançar fala por fala', () => {
    const st = new DialogueState(BOSS_DIALOGUES.caim);
    st.skip();
    expect(st.done).toBe(true);
    expect(st.line).toBeNull();
  });

  it('os três chefes têm conversa, com Atriox e o chefe, e retratos existentes', () => {
    for (const id of ['executioner', 'toknar', 'caim'] as const) {
      const lines = BOSS_DIALOGUES[id];
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.some((l) => l.speaker === 'atriox')).toBe(true);
      expect(lines.some((l) => l.speaker !== 'atriox')).toBe(true);
      for (const l of lines) {
        const p = l.portrait ?? SPEAKERS[l.speaker].portraits[0];
        expect(PORTRAITS).toContain(p);
      }
    }
    for (const p of PORTRAITS) expect(existsSync(new URL(`../public/assets/portraits/${p}.webp`, import.meta.url)), p).toBe(true);
    for (const a of ARENA_IMAGES) expect(existsSync(new URL(`../public/assets/arenas/${a}.webp`, import.meta.url)), a).toBe(true);
  });
});

describe('v0.5 — animações sem pose congelada', () => {
  it('Ceifa: os três impactos da IA caem em quadros de impacto', () => {
    const d = defs['toknar.cleave'];
    const tl = new FrameTimeline();
    tl.play(d);
    for (const t of [0, 400, 1080]) {
      tl.sync('active', (t + 1) / 1280);
      expect(d.frames[tl.index].event, `impacto em ${t} ms`).toBe('hit');
    }
    // a IA realmente golpeia três vezes, com o terceiro atrasado
    const b = new ToknarBrain();
    b.start();
    b.move = 'cleave';
    b.state = 'windup';
    b.timer = 0;
    const strikes: number[] = [];
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += 10;
      if (b.update(10, 100, 1).includes('strike')) strikes.push(t);
      if ((b.state as string) === 'recovery') break;
    }
    expect(strikes).toHaveLength(3);
    expect(strikes[2] - strikes[1]).toBeGreaterThan(strikes[1] - strikes[0]);
  });

  it('nenhuma antecipação de Toknar ou do Carrasco segura um quadro por mais de 0,7 s', () => {
    for (const [move, m] of Object.entries(TOKNAR.moves)) {
      const d = defs[`toknar.${move}`];
      expect(d.frames.filter((f) => f.phase === 'windup').length, move).toBeGreaterThanOrEqual(2);
      expect(longestHold(d, 'windup', m.windup), move).toBeLessThanOrEqual(700);
    }
    for (const m of EXECUTIONER.moves) {
      const d = defs[`carrasco.${m.id}`];
      expect(d, m.id).toBeTruthy();
      expect(longestHold(d, 'windup', m.windup), m.id).toBeLessThanOrEqual(450);
    }
  });

  it('Fome tem preparação própria (não reutiliza a Ceifa) e golpe no chão', () => {
    const names = defs['toknar.hunger'].frames.map((f) => f.name);
    expect(names.every((n) => n.startsWith('toknar_fome_'))).toBe(true);
    expect(defs['toknar.hunger'].frames.filter((f) => f.event === 'hit')).toHaveLength(1);
  });

  it('trechos longos usam loops próprios (giro, investida, Banquete, postura)', () => {
    for (const k of ['toknar.spin_loop', 'toknar.charge_loop', 'toknar.feast_loop', 'toknar.broken', 'carrasco.charge_loop', 'carrasco.broken'])
      expect(defs[k]?.loop, k).toBe(true);
  });

  it('Caim conjura em 3/4 (folhas novas) e tem loops de escudo e ritual', () => {
    expect(defs['caim.pool'].frames.every((f) => f.name.startsWith('caim_pool3q_'))).toBe(true);
    expect(defs['caim.eruption'].frames.every((f) => f.name.startsWith('caim_erupt3q_'))).toBe(true);
    expect(defs['caim.shield'].loop && defs['caim.ritual'].loop).toBe(true);
  });

  it('goblin e orc: corrida, golpe sincronizado, reação e queda', () => {
    for (const c of ['goblin', 'orc']) {
      for (const k of ['run', 'attack', 'hurt', 'dead']) expect(defs[`${c}.${k}`], `${c}.${k}`).toBeTruthy();
      expect(defs[`${c}.attack`].frames.filter((f) => f.event === 'hit')).toHaveLength(1);
    }
  });
});

describe('v0.5 — complementos: inimigos da Provação, boneco e Apollon', () => {
  it('recruta, atirador e guardião usam quadros do atlas com impacto único no golpe', () => {
    for (const c of ['recruit', 'archer', 'guardian'] as const) {
      expect(ENEMIES[c].sprite?.char, c).toBe(c);
      for (const k of ['run', 'attack', 'hurt', 'dead']) expect(defs[`${c}.${k}`], `${c}.${k}`).toBeTruthy();
      const atk = defs[`${c}.attack`];
      expect(atk.frames.filter((f) => f.event === 'hit'), c).toHaveLength(1);
      expect(atk.frames.every((f) => f.name.startsWith(`${c}_`)), c).toBe(true);
      expect(longestHold(atk, 'windup', ENEMIES[c].windup), c).toBeLessThanOrEqual(420);
    }
  });

  it('Avatar: Atriox invoca sozinho (Apollon é um sprite separado com 8 quadros)', () => {
    const names = new Set((atlas as { textures: { frames: { filename: string }[] }[] }).textures.flatMap((t) => t.frames.map((f) => f.filename)));
    for (let i = 0; i < 8; i++) expect(names.has(`apollon_avatar_0${i}`)).toBe(true);
    for (let i = 0; i < 6; i++) {
      expect(names.has(`apollon_beam_0${i}`)).toBe(true);
      expect(names.has(`dummy_0${i}`)).toBe(true);
      expect(names.has(`fxg_impact_0${i}`)).toBe(true);
      expect(names.has(`wyvern_perch_0${i}`)).toBe(true);
    }
    for (let i = 0; i < 12; i++) expect(names.has(`crowd_orc_${String(i).padStart(2, '0')}`)).toBe(true);
    // as poses do avatar do Atriox não incluem a folha solar com Apollon pintado junto (13–16)
    expect(defs['atriox.avatar'].frames.some((f) => /atriox_solar_1[3-6]/.test(f.name))).toBe(false);
    expect(existsSync(new URL('../public/assets/fx/arrow.webp', import.meta.url))).toBe(true);
  });
});

describe('v0.5 — Carrasco: postura quebrável sem stagger infinito', () => {
  it('quebra uma vez, volta a perseguir e fica imune por um tempo', () => {
    const b = new BossBrain(EXECUTIONER, () => 0.5);
    b.startFight();
    expect(b.hitPosture(EXECUTIONER.posture! - 1)).toBe(false);
    expect(b.hitPosture(5)).toBe(true);
    expect(b.state).toBe('broken');
    expect(b.hitPosture(999)).toBe(false);
    b.update(EXECUTIONER.breakMs! + 10, { distance: 999, hpRatio: 1 });
    expect(b.state).toBe('chase');
    expect(b.hitPosture(999)).toBe(false); // ainda imune
    b.update(EXECUTIONER.breakImmunity! + 10, { distance: 9999, hpRatio: 1 });
    expect(b.hitPosture(999)).toBe(true);
  });

  it('não quebra durante a introdução nem na transição de fase', () => {
    const b = new BossBrain(EXECUTIONER, () => 0.5);
    expect(b.hitPosture(999)).toBe(false);
    b.startFight();
    b.update(10, { distance: 999, hpRatio: 0.4 });
    expect(b.state).toBe('transition');
    expect(b.hitPosture(999)).toBe(false);
  });
});

describe('v0.5 — campanha e inimigos', () => {
  it('ordem: salas → Carrasco → salas → Toknar → salas → Caim', () => {
    const ids = ROOMS.map((r) => r.id);
    const ex = ids.indexOf('executioner');
    const tk = ids.indexOf('toknar');
    const cm = ids.indexOf('nemeia');
    expect(ex).toBeGreaterThan(1);
    expect(tk).toBeGreaterThan(ex + 1);
    expect(cm).toBeGreaterThan(tk + 1);
    expect(ROOMS[tk].theme).toBe('toknar');
    expect(ROOMS[cm].theme).toBe('caim');
    for (const i of [ex + 1, tk + 1]) expect(ROOMS[i].kind).toBe('combat');
  });

  it('cada inimigo novo aparece sozinho antes de ser combinado', () => {
    for (const kind of ['goblin', 'orc', 'wyvern_wild']) {
      const room = ROOMS.find((r) => r.waves?.some((w) => w.spawns.some((s) => s.kind === kind)))!;
      const first = room.waves!.find((w) => w.spawns.some((s) => s.kind === kind))!;
      expect(first.spawns.map((s) => s.kind), `${kind} em ${room.id}`).toEqual([kind]);
    }
  });

  it('todo tipo de onda existe', () => {
    for (const r of ROOMS)
      for (const w of r.waves ?? [])
        for (const s of w.spawns) expect(s.kind === 'wyvern_wild' || s.kind in ENEMIES, s.kind).toBe(true);
  });

  it('goblin é ágil e frágil; orc é lento, resistente e tem escudo frontal', () => {
    const g = ENEMIES.goblin;
    const o = ENEMIES.orc;
    expect(g.speed).toBeGreaterThan(o.speed);
    expect(g.hp).toBeLessThan(o.hp);
    expect(g.windup).toBeLessThan(o.windup);
    expect(o.shield?.arcDeg).toBeGreaterThan(0);
    expect(g.shield).toBeUndefined();
  });

  it('wyvern selvagem desce intangível e não causa dano antes de pousar no voo', () => {
    const b = new WyvernBrain(WYVERN_WILD, () => 0.5);
    expect(b.tangible).toBe(false);
    b.update(WYVERN_WILD.materializeMs + 10);
    expect(b.state).toBe('fly');
    expect(b.tangible).toBe(true);
  });

  it('reforços de Toknar: só orcs/goblins, poucos, nas fases 2 e 3', () => {
    expect(Object.keys(TOKNAR.reinforcements).map(Number).sort()).toEqual([2, 3]);
    for (const list of Object.values(TOKNAR.reinforcements)) {
      expect(list.length).toBeLessThanOrEqual(3);
      for (const k of list) expect(['orc', 'goblin']).toContain(k);
    }
  });
});
