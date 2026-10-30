import { describe, expect, it } from 'vitest';
import { CHARACTER_ATLAS_META, versionedCharacterAtlas } from '../src/data/atlas';
import { buildAnimations } from '../src/data/animations';

describe('Atlas ligado à versão do jogo', () => {
  it('inclui todos os quadros de Toknar e todos os frames usados nas animações', () => {
    const atlas=versionedCharacterAtlas('release-A');
    const names=new Set(atlas.textures.flatMap(t=>t.frames.map(f=>f.filename)));
    for(const anim of Object.values(buildAnimations(CHARACTER_ATLAS_META)))
      for(const frame of anim.frames) expect(names.has(frame.name),frame.name).toBe(true);
    // v0.3: 32 quadros (movimento + combate); v0.5: + Ceifa 8 + Fome 8
    expect([...names].filter(n=>n.startsWith('toknar_'))).toHaveLength(48);
    for (const p of ['carrasco_','goblin_','orc_','wyvwild_','fxt_','fxc_','caim_pool3q_','caim_erupt3q_'])
      expect([...names].some(n=>n.startsWith(p)),p).toBe(true);
  });
  it('versiona todas as páginas e mantém metadados sem mutação', () => {
    const first=versionedCharacterAtlas('release-A');
    const second=versionedCharacterAtlas('release-B');
    expect(first.textures.every(t=>t.image.endsWith('?v=release-A'))).toBe(true);
    expect(second.textures.every(t=>t.image.endsWith('?v=release-B'))).toBe(true);
    expect(first.textures.some(t=>t.image.includes('release-B'))).toBe(false);
    expect(first.meta).toBe(CHARACTER_ATLAS_META);
  });
});
