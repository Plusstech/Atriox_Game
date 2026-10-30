import { describe, expect, it } from 'vitest';
import { stepVelocity, inputVector } from '../src/game/systems/Movement';
import { ComboController, type ComboEvent } from '../src/game/combat/ComboController';
import { ATRIOX_COMBO } from '../src/data/attacks';
import { HitboxSystem, type Hurtbox } from '../src/game/combat/HitboxSystem';
import { shapeHitsCircle, length } from '../src/game/combat/geometry';
import { DashController } from '../src/game/combat/DashController';
import { ATRIOX_DASH, JUDGMENT_FLAME } from '../src/data/abilities';
import { SpellController } from '../src/game/abilities/SpellController';
import { Cooldown } from '../src/game/systems/Cooldown';
import { Health, computeDamage } from '../src/game/combat/DamageSystem';
import { EnemyBrain } from '../src/game/ai/EnemyBrain';
import { ENEMIES } from '../src/data/enemies';
import { BossBrain } from '../src/game/ai/BossBrain';
import { EXECUTIONER } from '../src/data/bosses';
import { WaveDirector } from '../src/game/systems/WaveDirector';
import { WAVES } from '../src/data/waves';
import { PlayerStats, BASE_STATS } from '../src/game/progression/PlayerStats';
import { BlessingSystem } from '../src/game/progression/BlessingSystem';
import { BLESSINGS, getBlessing } from '../src/data/blessings';
import { SaveSystem, SAVE_KEY, sanitize, type StorageLike } from '../src/game/systems/SaveSystem';

const MOVE = { maxSpeed: 300, accel: 4000, decel: 4000 };

function run(c: ComboController, ms: number, step = 16): ComboEvent[] {
  const out: ComboEvent[] = [];
  for (let t = 0; t < ms; t += step) out.push(...c.update(step));
  return out;
}

describe('1-2. Movimentação', () => {
  it('movimenta nas 8 direções', () => {
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    for (const [x, y] of dirs) {
      let v = { x: 0, y: 0 };
      for (let i = 0; i < 30; i++) v = stepVelocity(v, { x, y }, MOVE, 16);
      expect(Math.sign(v.x)).toBe(Math.sign(x));
      expect(Math.sign(v.y)).toBe(Math.sign(y));
    }
  });

  it('diagonal mantém a mesma velocidade máxima', () => {
    let v = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) v = stepVelocity(v, inputVector(false, true, false, true), MOVE, 16);
    expect(length(v.x, v.y)).toBeCloseTo(300, 3);
  });

  it('desacelera até parar sem input', () => {
    let v = { x: 300, y: 0 };
    for (let i = 0; i < 30; i++) v = stepVelocity(v, { x: 0, y: 0 }, MOVE, 16);
    expect(v.x).toBe(0);
  });
});

describe('3. Combo', () => {
  it('um clique executa só o primeiro golpe e depois para', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    const ev = run(c, 600);
    expect(ev.filter((e) => e.type === 'stepStart').length).toBe(1);
    expect(c.attacking).toBe(false);
  });

  it('clique em buffer encadeia o segundo golpe na janela', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    run(c, 100);
    expect(c.press()).toBe(true); // dentro da janela de 120 ms antes do encadeamento (190 ms)
    const ev = run(c, 400);
    const starts = ev.filter((e) => e.type === 'stepStart') as { index: number }[];
    expect(starts.map((s) => s.index)).toEqual([1]);
  });

  it('clique após o fim mas dentro de resetAfter continua o combo', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    run(c, 360); // golpe 1 termina em 340
    expect(c.attacking).toBe(false);
    c.press();
    run(c, 16);
    expect(c.index).toBe(1);
  });

  it('clique após resetAfter volta ao primeiro golpe', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    run(c, 340 + ATRIOX_COMBO[0].resetAfter + 100);
    c.press();
    run(c, 16);
    expect(c.index).toBe(0);
  });

  it('três cliques completam o combo; clique cedo demais no finalizador é recusado', () => {
    const c = new ComboController(ATRIOX_COMBO);
    const starts: number[] = [];
    for (let i = 0; i < 3; i++) {
      c.press();
      for (const e of run(c, 230)) if (e.type === 'stepStart') starts.push(e.index);
    }
    expect(starts).toEqual([0, 1, 2]);
    expect(c.press()).toBe(false);
    run(c, 1200);
    expect(c.attacking).toBe(false);
    c.press();
    for (const e of run(c, 32)) if (e.type === 'stepStart') starts.push(e.index);
    expect(starts[3]).toBe(0);
  });

  it('buffer de 120 ms: clique muito cedo não encadeia', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    run(c, 32);
    expect(c.press()).toBe(false);
    expect(c.buffered).toBe(false);
  });

  it('não pode cancelar durante a janela ativa', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    run(c, ATRIOX_COMBO[0].windup + 20);
    expect(c.phase).toBe('active');
    expect(c.cancel()).toBe(false);
    run(c, ATRIOX_COMBO[0].active);
    expect(c.phase).toBe('recovery');
    expect(c.cancel()).toBe(true);
  });

  it('dt muito grande não pula a janela ativa', () => {
    const c = new ComboController(ATRIOX_COMBO);
    c.press();
    const ev = c.update(5000);
    expect(ev.map((e) => e.type).slice(0, 4)).toEqual(['stepStart', 'activeStart', 'activeEnd', 'stepEnd']);
  });
});

describe('4-5. Hitboxes e dano', () => {
  const target = (): Hurtbox => ({ id: 1, team: 'enemy', x: 50, y: 0, radius: 10, alive: true, invulnerable: false });

  it('só causa dano enquanto ativa', () => {
    const hs = new HitboxSystem();
    hs.spawn({ shape: { kind: 'circle', x: 0, y: 0, radius: 60 }, team: 'player', damage: 10, knockback: 0, delay: 100, duration: 50, tag: 't' });
    expect(hs.update(50, [target()])).toHaveLength(0);
    expect(hs.update(60, [target()])).toHaveLength(1);
  });

  it('atinge cada alvo uma única vez', () => {
    const hs = new HitboxSystem();
    hs.spawn({ shape: { kind: 'circle', x: 0, y: 0, radius: 60 }, team: 'player', damage: 10, knockback: 0, duration: 200, tag: 't' });
    const t = target();
    let hits = 0;
    for (let i = 0; i < 10; i++) hits += hs.update(16, [t]).length;
    expect(hits).toBe(1);
  });

  it('não atinge o próprio time, mortos nem invulneráveis', () => {
    const hs = new HitboxSystem();
    hs.spawn({ shape: { kind: 'circle', x: 0, y: 0, radius: 60 }, team: 'enemy', damage: 10, knockback: 0, duration: 100, tag: 't' });
    const ts: Hurtbox[] = [target(), { ...target(), id: 2, team: 'player', alive: false }, { ...target(), id: 3, team: 'player', invulnerable: true }];
    expect(hs.update(16, ts)).toHaveLength(0);
  });

  it('expira e é removida', () => {
    const hs = new HitboxSystem();
    hs.spawn({ shape: { kind: 'circle', x: 0, y: 0, radius: 1 }, team: 'player', damage: 1, knockback: 0, duration: 30, tag: 't' });
    hs.update(50, []);
    expect(hs.all).toHaveLength(0);
  });

  it('setor respeita direção', () => {
    const s = { kind: 'sector' as const, x: 0, y: 0, radius: 100, angle: 0, halfArc: Math.PI / 4 };
    expect(shapeHitsCircle(s, 80, 0, 5)).toBe(true);
    expect(shapeHitsCircle(s, -80, 0, 5)).toBe(false);
    expect(shapeHitsCircle(s, 0, 80, 5)).toBe(false);
  });

  it('dano e vida', () => {
    const h = new Health(50);
    expect(h.damage(computeDamage(20, { resist: 0.5 }))).toBe(10);
    h.damage(100);
    expect(h.dead).toBe(true);
    expect(h.damage(5)).toBe(0);
    expect(h.heal(5)).toBe(0);
  });
});

describe('6-7. Dash e cooldowns', () => {
  it('ativa e encerra invulnerabilidade', () => {
    const d = new DashController(ATRIOX_DASH);
    expect(d.tryDash(1, 0)).toBe(true);
    expect(d.invulnerable).toBe(true);
    for (let t = 0; t < ATRIOX_DASH.iframes + 20; t += 10) d.update(10);
    expect(d.invulnerable).toBe(false);
    expect(ATRIOX_DASH.iframes).toBeLessThanOrEqual(ATRIOX_DASH.duration);
  });

  it('duas cargas, recarga sequencial e multiplicador', () => {
    const d = new DashController(ATRIOX_DASH);
    expect(d.tryDash(1, 0)).toBe(true);
    d.update(ATRIOX_DASH.duration + ATRIOX_DASH.recovery + 1);
    expect(d.charges).toBe(1);
    expect(d.tryDash(1, 0)).toBe(true);
    d.update(ATRIOX_DASH.duration + ATRIOX_DASH.recovery + 1);
    expect(d.charges).toBe(0);
    expect(d.tryDash(1, 0)).toBe(false);
    d.update(ATRIOX_DASH.rechargeMs);
    expect(d.charges).toBeGreaterThanOrEqual(1);
    expect(d.tryDash(1, 0, 0.5)).toBe(true);
    expect(d.rechargeTime).toBeCloseTo(ATRIOX_DASH.rechargeMs * 0.5);
  });

  it('dash sem direção mantém a última direção', () => {
    const d = new DashController(ATRIOX_DASH);
    d.tryDash(0, 0);
    expect(d.dir).toEqual({ x: 1, y: 0 });
  });

  it('magia: conjuração libera e entra em cooldown', () => {
    const s = new SpellController(JUDGMENT_FLAME);
    expect(s.tryCast()).toBe(true);
    expect(s.tryCast()).toBe(false);
    expect(s.update(JUDGMENT_FLAME.castTime)).toEqual(['release']);
    expect(s.cooldown.ready).toBe(false);
    s.update(JUDGMENT_FLAME.cooldown);
    expect(s.tryCast()).toBe(true);
  });

  it('Cooldown.progress', () => {
    const c = new Cooldown(1000);
    c.trigger();
    c.update(250);
    expect(c.progress).toBeCloseTo(0.25);
  });
});

describe('8. IA de inimigos', () => {
  it('ciclo chase → windup → attack → recovery', () => {
    const b = new EnemyBrain(ENEMIES.recruit);
    const ev: string[] = [];
    for (let i = 0; i < 200; i++) ev.push(...b.update(10, { distance: 50 }));
    expect(ev).toContain('windupStart');
    expect(ev).toContain('attackStart');
    expect(ev.indexOf('windupStart')).toBeLessThan(ev.indexOf('attackStart'));
  });

  it('inimigos mortos não atacam', () => {
    const b = new EnemyBrain(ENEMIES.recruit);
    b.update(10, { distance: 50 });
    b.update(10, { distance: 50 });
    b.kill();
    const ev: string[] = [];
    for (let i = 0; i < 300; i++) ev.push(...b.update(10, { distance: 10 }));
    expect(ev).toHaveLength(0);
    expect(b.canDealDamage).toBe(false);
    expect(b.onHit(999)).toBe(false);
  });

  it('poise: guardião ignora golpes leves', () => {
    const b = new EnemyBrain(ENEMIES.guardian);
    expect(b.onHit(12)).toBe(false);
    expect(b.onHit(30)).toBe(true);
    expect(b.state).toBe('hurt');
  });
});

describe('9. Miniboss', () => {
  it('muda para a fase 2 em 50% de vida e só uma vez', () => {
    const b = new BossBrain(EXECUTIONER, () => 0.1);
    b.startFight();
    const ev = b.update(16, { distance: 100, hpRatio: 0.49 });
    expect(ev).toEqual([{ type: 'phaseChange', phase: 2 }]);
    expect(b.phase).toBe(2);
    expect(b.invulnerable).toBe(true);
    let again = 0;
    for (let i = 0; i < 300; i++) again += b.update(16, { distance: 100, hpRatio: 0.3 }).filter((e) => e.type === 'phaseChange').length;
    expect(again).toBe(0);
  });

  it('golpe exclusivo da fase 2 não aparece na fase 1', () => {
    const b = new BossBrain(EXECUTIONER, () => 0.99);
    b.startFight();
    for (let i = 0; i < 50; i++) expect(b.pickMove(100)?.id).not.toBe('inferno');
  });

  it('fase 2 reduz recuperação', () => {
    const b = new BossBrain(EXECUTIONER);
    const m = EXECUTIONER.moves[0];
    const r1 = b.recoveryOf(m);
    b.startFight();
    b.update(16, { distance: 100, hpRatio: 0.4 });
    expect(b.recoveryOf(m)).toBeLessThan(r1);
  });

  it('chefe morto não age', () => {
    const b = new BossBrain(EXECUTIONER);
    b.startFight();
    b.kill();
    expect(b.update(1000, { distance: 50, hpRatio: 0 })).toHaveLength(0);
  });
});

describe('10. Fluxo da partida', () => {
  it('ondas → recompensa → chefe → vitória', () => {
    const d = new WaveDirector(WAVES);
    expect(d.startNextWave()[0].type).toBe('waveStart');
    let guard = 0;
    while (d.phase === 'wave' && guard++ < 20) d.tick(0);
    expect(d.phase).toBe('waveCleared');
    d.beginReward();
    d.startNextWave();
    while (d.phase === 'wave' && guard++ < 40) d.tick(0);
    d.beginReward();
    expect(d.startNextWave()[0].type).toBe('bossIntro');
    d.bossStart();
    expect(d.bossDefeated()[0].type).toBe('victory');
    expect(d.over).toBe(true);
    expect(d.playerDied()).toHaveLength(0);
  });

  it('derrota encerra a partida', () => {
    const d = new WaveDirector(WAVES);
    d.startNextWave();
    expect(d.playerDied()[0].type).toBe('defeat');
    expect(d.tick(0)).toHaveLength(0);
  });

  it('grupos só surgem quando vivos ≤ limite', () => {
    const d = new WaveDirector(WAVES);
    d.startNextWave();
    expect(d.tick(0)[0].type).toBe('spawnGroup');
    expect(d.tick(3)).toHaveLength(0);
    expect(d.tick(1)[0].type).toBe('spawnGroup');
    expect(d.tick(1)).toHaveLength(0);
  });
});

describe('11. Bênçãos', () => {
  it('Passo do Julgamento reduz cooldown do dash', () => {
    const stats = new PlayerStats();
    const bs = new BlessingSystem(stats);
    bs.grant(getBlessing('judgment_step')!);
    expect(stats.get('dashCooldownMul')).toBeCloseTo(0.65);
  });

  it('gatilhos produzem ações e oferta não repete bênçãos obtidas', () => {
    const stats = new PlayerStats();
    const bs = new BlessingSystem(stats);
    bs.grant(getBlessing('trial_blood')!);
    expect(bs.trigger('kill')[0].action).toEqual({ kind: 'heal', amount: 5 });
    expect(bs.trigger('basicHit')).toHaveLength(0);
    const offer = bs.rollOffer(() => 0.3);
    expect(offer).toHaveLength(3);
    expect(offer.some((b) => b.id === 'trial_blood')).toBe(false);
    expect(new Set(offer.map((b) => b.id)).size).toBe(3);
    expect(bs.grant(getBlessing('trial_blood')!)).toBe(false);
  });

  it('bônus temporário expira', () => {
    const stats = new PlayerStats();
    stats.addTimed('resist', 0.4, 1000);
    expect(stats.get('resist')).toBeCloseTo(0.4);
    stats.update(1001);
    expect(stats.get('resist')).toBe(BASE_STATS.resist);
  });

  it('todas as bênçãos têm efeitos válidos', () => {
    expect(BLESSINGS.length).toBeGreaterThanOrEqual(6);
    for (const b of BLESSINGS) expect(b.effects.length).toBeGreaterThan(0);
  });
});

describe('14. Save local', () => {
  const fake = (initial: Record<string, string> = {}): StorageLike & { m: Map<string, string> } => {
    const m = new Map(Object.entries(initial));
    return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };

  it('JSON corrompido volta ao padrão sem exceção', () => {
    const s = new SaveSystem(fake({ [SAVE_KEY]: '{isto não é json' }));
    expect(s.data.records.attempts).toBe(0);
    expect(s.lastError).toBeTruthy();
  });

  it('campos inválidos são sanitizados', () => {
    const d = sanitize({ settings: { masterVolume: 'alto', reduceShake: 1, graphics: 'ultra' }, records: { attempts: -5, bestTime: 'x' } });
    expect(d.settings.masterVolume).toBe(0.8);
    expect(d.settings.reduceShake).toBe(false);
    expect(d.settings.graphics).toBe('high');
    expect(d.records.attempts).toBe(0);
  });

  it('armazenamento que lança erro não quebra o save', () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('cota'); },
      removeItem: () => undefined
    };
    const s = new SaveSystem(broken);
    expect(s.save()).toBe(false);
    s.recordAttempt();
    expect(s.data.records.attempts).toBe(1);
  });

  it('persiste recordes', () => {
    const st = fake();
    const s = new SaveSystem(st);
    s.recordAttempt();
    s.recordRun({ victory: true, timeMs: 300000, highestWave: 3 });
    const s2 = new SaveSystem(st);
    expect(s2.data.records.bossVictories).toBe(1);
    expect(s2.data.records.bestTime).toBe(300000);
    expect(s2.recordRun({ victory: true, timeMs: 200000, highestWave: 3 }).newBest).toBe(true);
  });
});
