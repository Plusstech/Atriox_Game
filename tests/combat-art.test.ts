import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import prepared from '../art_source/v04/frames.json';
import atlas from '../public/assets/atlas/characters.json';
import { buildAnimations } from '../src/data/animations';
import { FrameTimeline } from '../src/game/animation/FrameTimeline';
import { ATRIOX_COMBO } from '../src/data/attacks';
import { ComboController } from '../src/game/combat/ComboController';

describe('Novas folhas de combate', () => {
  it('exporta 40 PNGs RGBA em 512x512, com apoio e margem constantes', () => {
    // 32 (v0.4) + 8 do finalizador diagonal (v0.5)
    expect(Object.keys(prepared.frames)).toHaveLength(40);
    for (const [name, frame] of Object.entries(prepared.frames)) {
      const png = readFileSync(
        new URL(`../art_source/v04/normalized/${name}.png`, import.meta.url),
      );
      expect(png.readUInt32BE(16)).toBe(512);
      expect(png.readUInt32BE(20)).toBe(512);
      expect(png[25]).toBe(6);
      expect(frame.anchor).toEqual([256, 448]);
      expect(frame.bounds[0]).toBeGreaterThanOrEqual(8);
      expect(frame.bounds[1]).toBeGreaterThanOrEqual(8);
      expect(frame.bounds[2]).toBeLessThanOrEqual(504);
      expect(frame.bounds[3]).toBeLessThanOrEqual(504);
    }
  });
  it('usa quatro quadros próprios de carga em pé e não os antigos agachados', () => {
    const a = buildAnimations(atlas.meta)['atriox.charge_hold'];
    expect(a.loop).toBe(true);
    expect(a.frames.map((f) => f.name)).toEqual(
      [0, 1, 2, 3].map((i) => `atriox_charge_0${i}`),
    );
  });
  it('preserva os oito quadros e a ordem das folhas, com impacto na fase ativa', () => {
    const defs = buildAnimations(atlas.meta);
    for (const [key, sheet] of [
      ['attack_1', 'atriox_horizontal'],
      ['attack_2', 'atriox_return'],
      ['ascending', 'atriox_ascending'],
      ['return_cut', 'atriox_horizontal'],
    ]) {
      const d = defs[`atriox.${key}`];
      expect(d.frames.map((f) => f.name)).toEqual(
        Array.from({ length: 8 }, (_, i) => `${sheet}_0${i}`),
      );
      expect(d.frames.filter((f) => f.phase === 'windup')).toHaveLength(3);
      expect(d.frames.filter((f) => f.phase === 'active')).toHaveLength(2);
      expect(d.frames.filter((f) => f.phase === 'recovery')).toHaveLength(3);
      expect(d.frames.filter((f) => f.event === 'hit')).toEqual([d.frames[3]]);
    }
  });
  it('finalizador diagonal próprio (v0.5): 3 antecipação, 2 ativos, 2 recuperação, sem o quadro 05', () => {
    const defs = buildAnimations(atlas.meta);
    for (const key of ['attack_3', 'attack_3_glory']) {
      const d = defs[`atriox.${key}`];
      expect(d.frames.map((f) => f.name)).toEqual(
        [0, 1, 2, 3, 4, 6, 7].map((i) => `atriox_diagonal_0${i}`),
      );
      expect(d.frames.filter((f) => f.phase === 'windup')).toHaveLength(3);
      expect(d.frames.filter((f) => f.phase === 'active')).toHaveLength(2);
      expect(d.frames.filter((f) => f.phase === 'recovery')).toHaveLength(2);
      expect(d.frames.filter((f) => f.event === 'hit')).toEqual([d.frames[3]]);
    }
  });
  it('o instante de dano de cada combo coincide com o quadro de impacto', () => {
    const defs = buildAnimations(atlas.meta);
    for (let i = 0; i < 3; i++) {
      const combo = new ComboController(ATRIOX_COMBO);
      combo.nextIndex = i;
      combo.press();
      const timeline = new FrameTimeline();
      timeline.play(defs[`atriox.attack_${i + 1}`]);
      let hits = 0;
      for (let t = 0; t < 1000; t += 10) {
        for (const event of combo.update(10))
          if (event.type === 'activeStart') {
            const marker = timeline.sync('active', 0);
            expect(marker[0].frame?.event).toBe('hit');
            expect(timeline.index).toBe(3);
            hits++;
          }
      }
      expect(hits).toBe(1);
    }
  });
  it('retorno e Sentença chegam ao último quadro de recuperação', () => {
    const defs = buildAnimations(atlas.meta);
    for (const key of ['atriox.return_cut', 'atriox.ascending']) {
      const t = new FrameTimeline();
      t.play(defs[key]);
      t.sync('recovery', 0.99);
      expect(t.index).toBe(7);
    }
  });
});
