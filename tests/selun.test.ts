import { describe, expect, it } from 'vitest';
import { SelunBrain, type SelunEvent } from '../src/game/ai/SelunBrain';
import { SELUN, APOLLON_BLESSINGS, FIRST_OFFER, blessingModifiers, pickOffers, grantEligible } from '../src/data/selun';
import { SaveSystem, type StorageLike, SAVE_KEY } from '../src/game/systems/SaveSystem';
import { PlayerStats } from '../src/game/progression/PlayerStats';
import { buildAnimations } from '../src/data/animations';
import atlas from '../public/assets/atlas/characters.json';

const ready = { distance: 200, playerReady: true };

function run(b: SelunBrain, ms: number, ctx = ready, step = 50): SelunEvent[] {
  const out: SelunEvent[] = [];
  for (let t = 0; t < ms; t += step) out.push(...b.update(step, ctx));
  return out;
}

function memStorage(): StorageLike & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

const feats = (activeMs: number, breaks = 0) => ({ activeMs, breaks, recompositions: 1, perfectDodges: 2, phase: 2 });

describe('Sêlun — IA', () => {
  it('fase decidida pelo tempo de combate ativo; transição não conta no relógio', () => {
    const b = new SelunBrain(() => 0.3);
    b.start();
    const ev = run(b, SELUN.phase2At + 4000);
    expect(ev.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    expect(b.phase).toBe(2);
    // o tempo da própria transição não avançou o relógio
    expect(b.activeMs).toBeLessThan(SELUN.phase2At + 4000);
  });

  it('dano alto não pula fases: zerar a manifestação recompõe e mantém a fase temporal', () => {
    const b = new SelunBrain(() => 0.5);
    b.start();
    run(b, 3000);
    const before = b.activeMs;
    expect(b.manifestationBroken().map((e) => e.type)).toEqual(['fallen']);
    expect(b.tangible).toBe(false);
    const ev = run(b, SELUN.fallMs + SELUN.recomposeMs + 100);
    expect(ev.some((e) => e.type === 'recomposed')).toBe(true);
    expect(b.recompositions).toBe(1);
    expect(b.phase).toBe(1);
    // queda e recomposição não contam no relógio
    expect(b.activeMs - before).toBeLessThan(300);
    // nunca existe evento de chefe derrotado
    expect(ev.some((e) => (e.type as string) === 'defeated')).toBe(false);
  });

  it('postura: quebra interrompe a canalização, remove ataques pendentes e dá proteção depois', () => {
    const b = new SelunBrain(() => 0.5);
    b.start();
    b.state = 'channel';
    b.queue = ['horizon', 'sentence'];
    const ev = b.hitPosture(SELUN.posture + 1);
    expect(ev.map((e) => e.type)).toEqual(['channelInterrupted', 'staggered']);
    expect(b.state).toBe('stagger');
    expect(b.queue).toEqual([]);
    expect(b.attacking).toBe(false);
    // durante a janela não ataca
    const during = run(b, SELUN.breakMs - 100);
    expect(during.some((e) => e.type === 'windup')).toBe(false);
    run(b, 200);
    expect(b.state).toBe('idle');
    expect(b.protectMs).toBeGreaterThan(0);
    expect(b.hitPosture(9999)).toEqual([]);
    expect(b.breaks).toBe(1);
  });

  it('não quebra postura em transição, queda ou execução', () => {
    for (const st of ['transition', 'fallen', 'recompose', 'execution'] as const) {
      const b = new SelunBrain();
      b.start();
      b.state = st;
      expect(b.hitPosture(9999)).toEqual([]);
    }
  });

  it('Última Palavra aos 180 s, só com o jogador pronto; execução após 5 s, uma vez', () => {
    const b = new SelunBrain(() => 0.4);
    b.start();
    b.activeMs = SELUN.lastWordAt;
    b.phase = 3;
    // jogador em recuperação: espera
    const wait = run(b, 400, { distance: 200, playerReady: false });
    expect(wait.some((e) => e.type === 'lastWord')).toBe(false);
    let ev: SelunEvent[] = [];
    for (let i = 0; i < 200 && !ev.some((e) => e.type === 'lastWord'); i++) ev = b.update(50, ready);
    expect(b.state).toBe('execution');
    const clock = b.activeMs;
    const fin = run(b, SELUN.lastWordMs + 200);
    expect(fin.filter((e) => e.type === 'execute')).toHaveLength(1);
    expect(b.activeMs).toBe(clock);
    expect(b.state).toBe('done');
    expect(run(b, 2000)).toEqual([]);
  });

  it('morte do jogador tem precedência: stop() encerra sem novas transições', () => {
    const b = new SelunBrain();
    b.start();
    b.manifestationBroken();
    b.stop();
    expect(run(b, 5000)).toEqual([]);
    expect(b.state).toBe('done');
  });

  it('pausa (dt 0) não avança relógio, golpes nem contagem', () => {
    const b = new SelunBrain();
    b.start();
    run(b, 1000);
    const t = b.activeMs;
    for (let i = 0; i < 100; i++) b.update(0, ready);
    expect(b.activeMs).toBe(t);
  });

  it('fase 1: golpes isolados; fases 2 e 3 combinam e o Decreto ganha sequências', () => {
    const b = new SelunBrain(() => 0.2);
    b.start();
    const moves = run(b, 30_000).filter((e) => e.type === 'windup').map((e) => (e as { move: string }).move);
    expect(moves.length).toBeGreaterThan(5);
    expect(moves.every((m) => ['horizon', 'sentence', 'dash'].includes(m))).toBe(true);
    b.phase = 2;
    expect(b.decreeSequences).toBe(2);
    b.phase = 3;
    expect(b.decreeSequences).toBe(3);
  });

  it('animações do Sêlun existem no atlas, com eventos de impacto e loops', () => {
    const defs = buildAnimations(atlas.meta as never);
    const names = new Set((atlas as { textures: { frames: { filename: string }[] }[] }).textures.flatMap((t) => t.frames.map((f) => f.filename)));
    for (const k of ['idle', 'run', 'horizon', 'sentence', 'decree', 'dash', 'dash_loop', 'channel', 'channel_loop', 'stagger', 'hurt', 'fury', 'fall', 'recompose', 'plant']) {
      const d = defs[`selun.${k}`];
      expect(d, k).toBeTruthy();
      for (const f of d.frames) expect(names.has(f.name), f.name).toBe(true);
    }
    for (const k of ['horizon', 'sentence']) {
      const d = defs[`selun.${k}`];
      expect(d.frames.filter((f) => f.event === 'hit')).toHaveLength(1);
      expect(d.frames.findIndex((f) => f.event === 'hit')).toBe(3);
    }
    expect(defs['selun.dash_loop'].loop && defs['selun.channel_loop'].loop && defs['selun.stagger'].loop).toBe(true);
    for (const p of ['fxs_slash_h_00', 'fxs_slash_d_05', 'fxs_ground_03', 'fxs_rift_07']) expect(names.has(p), p).toBe(true);
  });
});

describe('Bênçãos de Apollon', () => {
  it('primeira derrota oferece as três fixas; depois sorteia distintas e nunca no máximo', () => {
    expect(pickOffers({}, true)).toEqual(FIRST_OFFER);
    const levels = { solar_heart: 5, dawn_blade: 5, aurora_step: 5, unbroken_will: 5, light_skin: 5 } as const;
    const o = pickOffers(levels, false, () => 0.1);
    expect(o.sort()).toEqual(['pain_memory', 'return_spark']);
    const all = Object.fromEntries(APOLLON_BLESSINGS.map((b) => [b.id, b.max]));
    expect(pickOffers(all, false)).toEqual([]);
    const some = pickOffers({}, false, () => 0.99);
    expect(new Set(some).size).toBe(3);
  });

  it('atributos derivados sempre da base (sem multiplicar o já modificado) e com tetos', () => {
    const m = blessingModifiers({ solar_heart: 5, dawn_blade: 5, aurora_step: 5, unbroken_will: 5, light_skin: 5, pain_memory: 5, return_spark: 3 }, true);
    expect(m.maxHpMul).toBeCloseTo(1.4);
    expect(m.damageMul).toBeCloseTo(1.3);
    expect(m.dashRechargeMul).toBeCloseTo(0.8);
    expect(m.postureMul).toBeCloseTo(1.6);
    expect(m.resistAdd).toBeCloseTo(0.15);
    expect(m.painDamage).toBeCloseTo(0.25);
    expect(m.sparkHeal).toBeCloseTo(0.03);
    // níveis acima do máximo no save são limitados
    expect(blessingModifiers({ solar_heart: 99 }).maxHpMul).toBeCloseTo(1.4);
    const st = new PlayerStats();
    st.addPermanent('resist', { add: 0.5 });
    st.addPermanent('resist', { add: 0.5 });
    expect(st.get('resist')).toBe(0.6);
  });

  it('elegibilidade: 20 s de combate ativo OU uma quebra de postura', () => {
    expect(grantEligible(feats(19_999))).toBe(false);
    expect(grantEligible(feats(20_000))).toBe(true);
    expect(grantEligible(feats(3000, 1))).toBe(true);
  });
});

describe('Persistência do Sêlun', () => {
  it('morte gera uma etapa pendente; repetir o callback não duplica; confirmar concede uma vez', () => {
    const st = memStorage();
    const s = new SaveSystem(st);
    const id = s.selunBeginAttempt(() => 0.5);
    const p1 = s.selunRecordDeath(id, feats(30_000));
    const p2 = s.selunRecordDeath(id, feats(30_000));
    expect(p1).toEqual(p2);
    expect(p1!.options).toEqual(FIRST_OFFER);
    expect(s.data.selun.records.defeats).toBe(1);
    const r = s.selunConfirm('dawn_blade');
    expect(r).toEqual({ kind: 'blessing', id: 'dawn_blade', level: 1 });
    expect(s.selunConfirm('dawn_blade')).toBeNull();
    expect(s.selunRecordDeath(id, feats(30_000))).toBeNull();
    expect(s.data.selun.blessings.dawn_blade).toBe(1);
  });

  it('recarregar durante a escolha reabre a MESMA escolha; após confirmar não concede de novo', () => {
    const st = memStorage();
    const a = new SaveSystem(st);
    a.data.selun.records.defeats = 3; // não é a primeira derrota: opções sorteadas
    a.save();
    const id = a.selunBeginAttempt();
    const p = a.selunRecordDeath(id, feats(60_000), () => 0.7)!;
    const b = new SaveSystem(st);
    expect(b.data.selun.pending?.options).toEqual(p.options);
    b.selunConfirm(p.options[1]);
    const c = new SaveSystem(st);
    expect(c.data.selun.pending).toBeNull();
    expect(c.selunConfirm(p.options[1])).toBeNull();
    expect(c.data.selun.blessings[p.options[1]]).toBe(1);
  });

  it('morte rápida concede só a Brasa (nunca os dois prêmios); Brasa não acumula e é consumida', () => {
    const s = new SaveSystem(memStorage());
    const id = s.selunBeginAttempt();
    const p = s.selunRecordDeath(id, feats(5000));
    expect(p!.eligible).toBe(false);
    expect(p!.options).toEqual([]);
    expect(s.selunConfirm()).toEqual({ kind: 'ember', complete: false });
    expect(Object.keys(s.data.selun.blessings)).toHaveLength(0);
    const id2 = s.selunBeginAttempt();
    s.selunRecordDeath(id2, feats(1000));
    s.selunConfirm();
    expect(s.data.selun.ember).toBe(true);
    expect(s.consumeEmber()).toBe(true);
    expect(s.consumeEmber()).toBe(false);
  });

  it('todas no máximo: cada derrota ainda concede a Brasa e informa conjunto completo', () => {
    const s = new SaveSystem(memStorage());
    for (const b of APOLLON_BLESSINGS) s.data.selun.blessings[b.id] = b.max;
    const id = s.selunBeginAttempt();
    const p = s.selunRecordDeath(id, feats(90_000));
    expect(p!.eligible).toBe(true);
    expect(p!.options).toEqual([]);
    expect(s.selunConfirm()).toEqual({ kind: 'ember', complete: true });
  });

  it('sem encontro aberto (abandonar, outro inimigo, recarregar) não concede nada', () => {
    const s = new SaveSystem(memStorage());
    expect(s.selunRecordDeath('inventado', feats(90_000))).toBeNull();
    const id = s.selunBeginAttempt();
    s.selunBeginAttempt(); // nova tentativa substitui a anterior abandonada
    expect(s.selunRecordDeath(id, feats(90_000))).toBeNull();
  });

  it('save antigo sem bloco do Sêlun migra com padrões seguros, preservando o progresso', () => {
    const st = memStorage();
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, records: { bossVictories: 4, eternityBest: 7 }, unlocks: { blessingOfGlory: true } }));
    const s = new SaveSystem(st);
    expect(s.data.records.bossVictories).toBe(4);
    expect(s.data.unlocks.blessingOfGlory).toBe(true);
    expect(s.data.selun.schema).toBe(1);
    expect(s.data.selun.blessings).toEqual({});
    expect(s.data.selun.pending).toBeNull();
    expect(s.data.selun.eternityUnlocked).toBe(true); // já tinha vencido Caim
    // IDs desconhecidos e níveis fora do limite são saneados
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, selun: { blessings: { solar_heart: 99, xyz: 3 }, pending: { attemptId: 'a', options: ['dawn_blade', 'nope'], eligible: true } } }));
    const t = new SaveSystem(st);
    expect(t.data.selun.blessings).toEqual({ solar_heart: 5 });
    expect(t.data.selun.pending?.options).toEqual(['dawn_blade']);
  });
});
