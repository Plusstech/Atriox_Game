import { describe, it, expect } from 'vitest';
import { GiftBuild } from '../src/game/progression/GiftBuild';
import { AdvancedInput } from '../src/game/combat/AdvancedInput';
import { ToknarBrain } from '../src/game/ai/ToknarBrain';
import { CaimDefense } from '../src/game/ai/CaimDefense';
import { CaimBrain } from '../src/game/ai/CaimBrain';
import { APOLLON_GIFTS, type ApollonGiftId } from '../src/data/apollon';
import { CAIM } from '../src/data/bosses';
import { TOKNAR, SKILLS, FINAL_BOSS } from '../src/data/v03';
import { ROOMS } from '../src/data/rooms';
import { SaveSystem, sanitize } from '../src/game/systems/SaveSystem';

describe('Dons e campanha v0.3', () => {
  it('há oportunidades de build e Toknar é obrigatório antes de Caim', () => {
    expect(ROOMS.findIndex((r) => r.boss === 'toknar')).toBeLessThan(
      ROOMS.findIndex((r) => r.boss === 'caim'),
    );
    expect(
      ROOMS.filter((r) => r.kind === 'combat').length,
    ).toBeGreaterThanOrEqual(5);
  });
  it('ofertas distintas, funcionais, com pré-requisitos e evoluções finitas', () => {
    const b = new GiftBuild(new Set());
    expect(b.grant('execution_mark')).toBe(false);
    expect(b.grant('ascending')).toBe(true);
    expect(b.grant('execution_mark')).toBe(true);
    expect(b.grant('ascending')).toBe(true);
    expect(b.grant('ascending')).toBe(false);
    for (let i = 0; i < 50; i++) {
      const o = b.offers();
      expect(o).toHaveLength(2);
      expect(o[0].gift.id).not.toBe(o[1].gift.id);
      expect(o.every((x) => b.valid(x.gift))).toBe(true);
    }
  });
  it('incompatibilidades impedem aquisição', () => {
    const b = new GiftBuild(new Set<ApollonGiftId>(['ascending']));
    const g = {
      ...APOLLON_GIFTS[0],
      incompatible: ['ascending'] as ApollonGiftId[],
    };
    expect(b.valid(g)).toBe(false);
  });
  it('build máxima recebe duas alternativas úteis, sem rerrolar snapshots', () => {
    const b = new GiftBuild(new Set());
    for (let k = 0; k < 3; k++)
      for (const g of APOLLON_GIFTS.filter(
        (g) => !g.id.startsWith('universal'),
      ))
        b.grant(g.id);
    const offers = b.offers(() => 0.3);
    expect(offers.every((o) => o.gift.id.startsWith('universal'))).toBe(true);
    const before = JSON.stringify(offers);
    b.grant(offers[0].gift.id);
    expect(JSON.stringify(offers)).toBe(before);
  });
});
describe('Arbitragem de ataque', () => {
  const input = {
    held: false,
    released: false,
    pressed: false,
    cancel: false,
    chargeGift: true,
    counterGift: true,
    ready: true,
  };
  it('clique simples continua básico; soltar sem carga não duplica', () => {
    const c = new AdvancedInput();
    expect(c.update(16, { ...input, pressed: true }).basic).toBe(true);
    expect(c.update(16, { ...input, released: true }).hit).toBe(null);
    expect(c.action).toBe(null);
  });
  it('segurar/soltar gera exatamente um golpe carregado após antecipação', () => {
    const c = new AdvancedInput();
    c.update(850, { ...input, held: true });
    expect(c.charging).toBe(true);
    expect(c.update(1, { ...input, released: true }).hit).toBe(null);
    expect(c.perfect).toBe(true);
    expect(c.update(SKILLS.chargeWindup, input).hit).toBe('charged');
    expect(c.update(100, input).hit).toBe(null);
  });
  it('dash dá uma única janela de contra-ataque; interrupção limpa carga', () => {
    const c = new AdvancedInput();
    c.dash();
    c.update(16, { ...input, pressed: true });
    expect(c.action).toBe('counter');
    c.reset();
    expect(c.action).toBe(null);
    expect(c.counterMs).toBe(0);
    c.update(600, { ...input, held: true });
    c.update(16, { ...input, cancel: true });
    expect(c.charging).toBe(false);
  });
  it('não carrega durante combo ou magia, janela pós dash expira', () => {
    const c = new AdvancedInput();
    c.update(1000, { ...input, held: true, ready: false });
    expect(c.charging).toBe(false);
    c.dash();
    c.update(SKILLS.counterWindow + 1, input);
    c.update(16, { ...input, pressed: true });
    expect(c.action).toBe(null);
  });
});
describe('Toknar', () => {
  it('drenagem só aceita dano positivo e tem teto por golpe', () => {
    const b = new ToknarBrain();
    b.start();
    expect(b.drain(0)).toBe(0);
    expect(b.drain(-1)).toBe(0);
    expect(b.drain(999)).toBe(TOKNAR.drainCap);
    expect(b.drain(999)).toBe(0);
    b.kill();
    expect(b.drain(10)).toBe(0);
  });
  it('fases não regridem com cura nem repetem transições', () => {
    const b = new ToknarBrain();
    b.start();
    expect(b.update(16, 200, 0.69)).toContain('phase');
    expect(b.update(16, 200, 0.9)).not.toContain('phase');
    expect(b.phase).toBe(2);
    expect(b.update(16, 200, 0.34)).toContain('phase');
    expect(b.update(16, 200, 0.65)).not.toContain('phase');
    expect(b.phase).toBe(3);
  });
  it('banquete é interrompível por postura, com imunidade contra stagger infinito', () => {
    const b = new ToknarBrain();
    b.start();
    b.state = 'active';
    b.move = 'feast';
    expect(b.hitPosture(TOKNAR.posture)).toBe(true);
    expect(b.state).toBe('broken');
    expect(b.hitPosture(999)).toBe(false);
    expect(b.update(TOKNAR.breakMs, 100, 0.8)).not.toContain('heal');
  });
  it('ceifa tem 3 golpes distintos e o terceiro é atrasado', () => {
    const b = new ToknarBrain();
    b.start();
    b.state = 'windup';
    b.move = 'cleave';
    expect(b.update(680, 100, 1)).toContain('strike');
    expect(b.update(400, 100, 1)).toContain('strike');
    expect(b.update(400, 100, 1)).not.toContain('strike');
    expect(b.update(280, 100, 1)).toContain('strike');
  });
});
describe('Caim final e persistência', () => {
  it('escudo anuncia, absorve e avisa antes da onda; oferece punição depois', () => {
    const d = new CaimDefense();
    d.shieldCd = 0;
    d.update(1200, 100, 1, 0, true);
    expect(d.mode).toBe('shieldWarning');
    d.update(FINAL_BOSS.shieldWarn, 100, 1, 0, true);
    expect(d.shield).toBe(FINAL_BOSS.shieldHp);
    expect(d.absorb(999, 20)).toBe(true);
    expect(d.mode).toBe('rupture');
    expect(d.update(FINAL_BOSS.waveWarn - 1, 100, 1, 0, true)).toBe(null);
    expect(d.update(1, 100, 1, 0, true)).toBe('wave');
    expect(d.mode).toBe('punish');
  });
  it('orçamento impede defesa junto de muitas ameaças e escudo expira', () => {
    const d = new CaimDefense();
    d.shieldCd = 0;
    d.update(2000, 100, 1, 3, true);
    expect(d.mode).toBe('none');
    d.update(16, 100, 1, 0, true);
    d.update(FINAL_BOSS.shieldWarn, 100, 1, 0, true);
    d.update(FINAL_BOSS.shieldMs, 100, 1, 0, true);
    expect(d.mode).toBe('none');
  });
  it('ritual pode ser interrompido sem concluir a expansão', () => {
    const d = new CaimDefense();
    d.ritualCd = 0;
    d.update(16, 300, 3, 0, true);
    expect(d.mode).toBe('ritual');
    d.absorb(50, FINAL_BOSS.ritualPosture);
    expect(d.mode).toBe('punish');
    expect(d.update(FINAL_BOSS.ritualMs, 300, 3, 0, true)).not.toBe(
      'ritualComplete',
    );
  });
  it('Caim chega a 3 fases sem regressão e reação tem proteção', () => {
    const b = new CaimBrain(CAIM);
    b.start();
    const c = { distance: 300, wyverns: 0, canPool: true, hpRatio: 0.3 };
    b.update(16, c);
    b.update(16, c);
    expect(b.phase).toBe(3);
    b.update(16, { ...c, hpRatio: 0.8 });
    expect(b.phase).toBe(3);
    b.state = 'reposition';
    expect(b.onDamage(999)).toBe(true);
    b.update(600, c);
    expect(b.onDamage(999)).toBe(false);
  });
  it('save antigo migra e Eternidade registra ondas completas', () => {
    expect(sanitize({ records: { attempts: 4 } }).records.eternityBest).toBe(0);
    const m = new Map<string, string>();
    const save = new SaveSystem({
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
      },
      removeItem: (k) => {
        m.delete(k);
      },
    });
    save.recordEternity(10, true);
    save.recordEternity(12, false);
    expect(save.data.records.eternityBest).toBe(11);
    expect(save.data.records.eternityLast).toBe(12);
  });
});
