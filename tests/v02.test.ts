import { describe, expect, it } from 'vitest';
import { FrameTimeline, type AnimDef } from '../src/game/animation/FrameTimeline';
import { BloodExposure, BloodPoolSystem } from '../src/game/combat/Blood';
import { CaimBrain } from '../src/game/ai/CaimBrain';
import { CAIM } from '../src/data/bosses';
import { WyvernBrain, WYVERN } from '../src/game/ai/WyvernBrain';
import { RunDirector } from '../src/game/systems/RunDirector';
import { ROOMS } from '../src/data/rooms';
import { HitboxSystem } from '../src/game/combat/HitboxSystem';
import { buildAnimations } from '../src/data/animations';
import atlas from '../public/assets/atlas/characters.json';

const run: AnimDef = { key: 'run', loop: true, frames: [0, 1, 2, 3].map((i) => ({ name: `r${i}`, ms: 70, event: i === 0 ? 'step' : undefined })) };
const atk: AnimDef = {
  key: 'atk',
  loop: false,
  frames: [
    { name: 'w', ms: 1, phase: 'windup' },
    { name: 'a', ms: 1, phase: 'active', event: 'hit' },
    { name: 'r1', ms: 1, phase: 'recovery' },
    { name: 'r2', ms: 1, phase: 'recovery' }
  ]
};

describe('Animação por quadros', () => {
  it('corrida não reinicia ao repetir play() com o mesmo estado', () => {
    const t = new FrameTimeline();
    t.play(run);
    t.update(150);
    const idx = t.index;
    expect(t.play(run)).toHaveLength(0);
    expect(t.index).toBe(idx);
  });

  it('30 s de corrida: ciclo contínuo, sem reinício e com passos regulares', () => {
    const t = new FrameTimeline();
    t.play(run);
    let steps = 0;
    let loops = 0;
    for (let ms = 0; ms < 30000; ms += 16) {
      t.play(run); // o Player chama play() todo quadro
      for (const e of t.update(16)) {
        if (e.type === 'frame' && e.frame?.event === 'step') steps++;
        if (e.type === 'loop') loops++;
      }
    }
    expect(loops).toBeGreaterThan(100);
    expect(Math.abs(steps - loops)).toBeLessThanOrEqual(1);
  });

  it('cadência proporcional à velocidade', () => {
    const a = new FrameTimeline();
    const b = new FrameTimeline();
    a.play(run);
    b.play(run);
    a.update(1000, 1);
    b.update(1000, 0.5);
    expect(a.elapsed).toBeCloseTo(b.elapsed * 2);
  });

  it('modo sincronizado: o quadro do impacto só aparece na fase ativa', () => {
    const t = new FrameTimeline();
    t.play(atk);
    t.sync('windup', 0.99);
    expect(t.frame?.name).toBe('w');
    const ev = t.sync('active', 0);
    expect(ev[0].frame?.event).toBe('hit');
    t.sync('recovery', 0.75);
    expect(t.frame?.name).toBe('r2');
  });

  it('animação sem loop completa e para no último quadro', () => {
    const t = new FrameTimeline();
    t.play({ key: 'x', loop: false, frames: [{ name: 'a', ms: 50 }, { name: 'b', ms: 50 }] });
    const ev = t.update(500);
    expect(ev.some((e) => e.type === 'complete')).toBe(true);
    expect(t.frame?.name).toBe('b');
  });

  it('todas as animações referenciam quadros que existem no atlas', () => {
    const names = new Set(atlas.textures.flatMap((t) => t.frames.map((f) => f.filename)));
    const anims = buildAnimations(atlas.meta as never);
    const missing: string[] = [];
    for (const a of Object.values(anims)) for (const f of a.frames) if (!names.has(f.name)) missing.push(`${a.key}:${f.name}`);
    expect(missing).toEqual([]);
    // cada ataque tem quadro de impacto na fase ativa
    for (const k of ['atriox.attack_1', 'atriox.attack_2', 'atriox.attack_3', 'atriox.attack_3_glory']) {
      expect(anims[k].frames.some((f) => f.phase === 'active' && f.event === 'hit')).toBe(true);
      expect(anims[k].frames[0].phase).toBe('windup');
    }
  });
});

describe('Dano único por golpe', () => {
  it('hitbox de golpe atinge cada alvo no máximo uma vez', () => {
    const hs = new HitboxSystem();
    hs.spawn({ shape: { kind: 'sector', x: 0, y: 0, radius: 120, angle: 0, halfArc: 1 }, team: 'player', damage: 10, knockback: 0, duration: 120, tag: 'attack_1' });
    const t = { id: 7, team: 'enemy' as const, x: 60, y: 0, radius: 16, alive: true, invulnerable: false };
    let hits = 0;
    for (let i = 0; i < 12; i++) hits += hs.update(16, [t]).length;
    expect(hits).toBe(1);
  });
});

describe('Sangue de Caim', () => {
  it('poça anunciada não domina; ativa domina após o limiar', () => {
    const pools = new BloodPoolSystem();
    const p = pools.spawn(0, 0)!;
    const ex = new BloodExposure();
    for (let t = 0; t < p.warnMs - 20; t += 16) {
      pools.update(16);
      ex.update(16, !!pools.activeAt(0, 0), false);
    }
    expect(ex.value).toBe(0);
    let stunned = false;
    for (let t = 0; t < 2000 && !stunned; t += 16) {
      pools.update(16);
      stunned = ex.update(16, !!pools.activeAt(0, 0), false).includes('stunStart');
    }
    expect(stunned).toBe(true);
    expect(ex.stunned).toBe(true);
  });

  it('stun tem duração limitada e gera imunidade contra reaplicação', () => {
    const ex = new BloodExposure();
    let t = 0;
    while (!ex.stunned && t < 5000) {
      ex.update(16, true, false);
      t += 16;
    }
    let ended = false;
    for (let k = 0; k < 400 && !ended; k++) ended = ex.update(16, true, false).includes('stunEnd');
    expect(ended).toBe(true);
    let again = false;
    for (let k = 0; k < Math.floor(ex.rules.immunityMs / 16) - 2; k++) again = again || ex.update(16, true, false).includes('stunStart');
    expect(again).toBe(false);
  });

  it('dash (invulnerável) não acumula exposição', () => {
    const ex = new BloodExposure();
    ex.update(300, true, true);
    expect(ex.value).toBe(0);
  });

  it('exposição drena fora do sangue', () => {
    const ex = new BloodExposure();
    ex.update(500, true, false);
    const v = ex.value;
    ex.update(400, false, false);
    expect(ex.value).toBeLessThan(v);
  });

  it('limite de poças e espaçamento mínimo garantem chão seguro', () => {
    const pools = new BloodPoolSystem();
    expect(pools.spawn(0, 0)).not.toBeNull();
    expect(pools.spawn(50, 0)).toBeNull();
    expect(pools.spawn(400, 0)).not.toBeNull();
    expect(pools.spawn(800, 0)).not.toBeNull();
    expect(pools.spawn(1200, 0)).toBeNull();
  });

  it('purificação desativa a poça temporariamente', () => {
    const pools = new BloodPoolSystem();
    pools.spawn(0, 0);
    pools.update(2000);
    expect(pools.activeAt(0, 0)).not.toBeNull();
    pools.purifySegment(-200, 0, 200, 0, 30, 1500);
    expect(pools.activeAt(0, 0)).toBeNull();
    pools.update(1600);
    expect(pools.activeAt(0, 0)).not.toBeNull();
  });
});

describe('Caim', () => {
  const ctx = { distance: 350, hpRatio: 1, wyverns: 0, canPool: true };

  it('invoca wyverns até o limite e não passa dele', () => {
    const b = new CaimBrain(CAIM, () => 0.5);
    b.start();
    const free = new CaimBrain(CAIM, () => 0.5);
    free.start();
    // força a recarga da invocação a zerar
    for (let i = 0; i < 300; i++) free.update(16, { ...ctx, wyverns: 3 });
    expect(free.choose({ ...ctx, wyverns: 0 })).toBe('summon');
    expect(free.choose({ ...ctx, wyverns: 2 })).not.toBe('summon');
  });

  it('ciclo windup → cast → recovery → reposition', () => {
    const b = new CaimBrain(CAIM, () => 0.1);
    b.start();
    const seen: string[] = [];
    for (let i = 0; i < 400; i++) for (const e of b.update(16, { ...ctx, wyverns: 2 })) seen.push(e.type);
    expect(seen).toContain('windup');
    expect(seen).toContain('cast');
    expect(seen).toContain('end');
  });

  it('fase 2 em 50% e reação a dano acumulado', () => {
    const b = new CaimBrain(CAIM);
    b.start();
    const ev = b.update(16, { ...ctx, hpRatio: 0.45 });
    expect(ev.some((e) => e.type === 'phase2')).toBe(true);
    expect(b.maxWyverns).toBe(CAIM.maxWyverns[1]);
    expect(b.onDamage(CAIM.staggerDamage + 1)).toBe(true);
    expect(b.state).toBe('reaction');
  });

  it('morto não age', () => {
    const b = new CaimBrain(CAIM);
    b.start();
    b.kill();
    expect(b.update(1000, ctx)).toHaveLength(0);
  });
});

describe('Wyvern', () => {
  it('materializa sem ser tangível, depois voa, anuncia, trava direção e investe', () => {
    const w = new WyvernBrain(WYVERN, () => 0);
    expect(w.tangible).toBe(false);
    const ev: string[] = [];
    for (let t = 0; t < 6000; t += 16) ev.push(...w.update(16));
    expect(ev.indexOf('flying')).toBeLessThan(ev.indexOf('windup'));
    expect(ev.indexOf('windup')).toBeLessThan(ev.indexOf('lock'));
    expect(ev.indexOf('lock')).toBeLessThan(ev.indexOf('charge'));
    expect(ev).toContain('recover');
  });

  it('só causa dano durante a investida; morta não age', () => {
    const w = new WyvernBrain();
    expect(w.harmful).toBe(false);
    w.kill();
    expect(w.update(5000)).toHaveLength(0);
  });
});

describe('Salas e portas', () => {
  it('preparação → portas → sala → limpa → recompensa → portas → … → vitória', () => {
    const d = new RunDirector(ROOMS, () => 0.3);
    expect(d.begin()[0].type).toBe('enterRoom');
    const doors = d.startCombat();
    expect(doors[0].type).toBe('doorsOpen');
    expect(d.chooseDoor(0)[0].type).toBe('enterRoom');
    expect(d.roomReward).not.toBeNull();
    d.startCombat();
    expect(d.phase).toBe('combat');
    let guard = 0;
    while (d.phase === 'combat' && guard++ < 20) d.tick(0);
    expect(d.phase).toBe('cleared');
    // saída bloqueada: não há portas enquanto a recompensa não foi tratada
    expect(d.chooseDoor(0)).toHaveLength(0);
    d.beginReward();
    expect(d.rewardTaken()[0].type).toBe('doorsOpen');
    for (let i = 0; i < 12 && !d.over; i++) {
      if (d.phase === 'doors') d.chooseDoor(0);
      if (d.phase === 'prep') d.startCombat();
      while (d.phase === 'combat') d.tick(0);
      if (d.phase === 'boss') d.bossDefeated();
      if (d.phase === 'cleared') d.rewardTaken();
    }
    expect(d.phase).toBe('victory');
    expect(d.room?.boss).toBe('caim');
  });

  it('portas mostram tipos de recompensa distintos antes da escolha', () => {
    const d = new RunDirector(ROOMS, () => 0.9);
    d.begin();
    const ev = d.startCombat();
    const opts = ev[0].type === 'doorsOpen' ? ev[0].options : [];
    expect(opts.length).toBe(2);
    expect(new Set(opts).size).toBe(2);
  });

  it('derrota encerra; nada mais acontece depois', () => {
    const d = new RunDirector(ROOMS);
    d.begin();
    expect(d.playerDied()[0].type).toBe('defeat');
    expect(d.tick(0)).toHaveLength(0);
    expect(d.playerDied()).toHaveLength(0);
  });
});
