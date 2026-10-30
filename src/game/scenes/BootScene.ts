import Phaser from 'phaser';
import { COLORS, FONT_UI, GAME_H, GAME_W } from '../config/constants';
import { generateAllTextures, makeAtrioxFallback } from '../fx/TextureFactory';
import { ATLAS_KEY, type AnimLibrary } from '../animation/SpriteAnimator';
import { buildAnimations, type AtlasMeta } from '../../data/animations';
import { CHARACTER_ATLAS_META, versionedCharacterAtlas } from '../../data/atlas';
import { ARENA_IMAGES, PORTRAITS } from '../../data/dialogues';

export const ATRIOX_POSES = ['idle', 'lunge', 'slash', 'cast', 'dash', 'hurt'] as const;

/**
 * Carrega os assets externos (poses do Atriox) e gera as texturas procedurais.
 * Assets ausentes NÃO travam o jogo: são substituídos e listados no menu/console.
 */
export class BootScene extends Phaser.Scene {
  private missing: string[] = [];

  constructor() {
    super('BootScene');
  }

  preload(): void {
    const bar = this.add.graphics();
    const label = this.add.text(GAME_W / 2, GAME_H / 2 + 34, 'Acendendo as brasas...', { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.hex.dim }).setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.lineStyle(1, COLORS.gold, 1);
      bar.strokeRect(GAME_W / 2 - 200, GAME_H / 2, 400, 10);
      bar.fillStyle(COLORS.gold, 1);
      bar.fillRect(GAME_W / 2 - 198, GAME_H / 2 + 2, 396 * v, 6);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.missing.push(file.src || file.key);
      console.warn(`[assets] falha ao carregar ${file.key} (${file.src})`);
    });
    this.load.once('complete', () => {
      bar.destroy();
      label.destroy();
    });

    // concept original (menu, retrato, telas de resultado)
    this.load.setPath('assets/atriox/');
    this.load.json('atriox_poses', 'atriox_poses.json');
    for (const p of ATRIOX_POSES) this.load.image(`atriox_${p}`, `${p}.png`);
    // atlas de animação (tools/build_atlases.py)
    this.load.setPath('assets/atlas/');
    // Phaser 3.90 supports an inline JSON object (MultiAtlasFile -> JSONFile),
    // but its declaration incorrectly restricts atlasURL to string.
    // @ts-expect-error Runtime supports the documented inline-JSON overload.
    this.load.multiatlas(ATLAS_KEY, versionedCharacterAtlas(__ATLAS_REVISION__), 'assets/atlas/');
    this.cache.json.add('characters_meta', { meta: CHARACTER_ATLAS_META });
    // v0.5: arenas ilustradas (Toknar, Caim) e retratos das conversas pré-chefe
    const v = `?v=${encodeURIComponent(__ATLAS_REVISION__)}`;
    this.load.setPath('assets/arenas/');
    for (const a of ARENA_IMAGES) this.load.image(a, `${a}.webp${v}`);
    this.load.setPath('assets/portraits/');
    for (const p of PORTRAITS) this.load.image(`portrait_${p}`, `${p}.webp${v}`);
  }

  create(): void {
    generateAllTextures(this);
    for (const p of ATRIOX_POSES) {
      const key = `atriox_${p}`;
      if (!this.textures.exists(key) || this.textures.get(key).key === '__MISSING') makeAtrioxFallback(this, key);
    }
    if (!this.cache.json.exists('atriox_poses')) {
      this.cache.json.add('atriox_poses', { poses: {} });
    }
    const meta = (this.cache.json.get('characters_meta')?.meta ?? { atrioxRunOrder: [], caimRunOrder: [], origins: {} }) as AtlasMeta;
    const lib: AnimLibrary = { anims: buildAnimations(meta), origins: meta.origins ?? {} };
    if (!this.textures.exists(ATLAS_KEY)) {
      console.error('[assets] atlas de personagens ausente — o jogo não pode animar os personagens');
      this.missing.push('assets/atlas/characters.json');
    }
    this.registry.set('animLibrary', lib);
    this.registry.set('missingAssets', this.missing);
    this.scene.start(new URLSearchParams(location.search).has('inspector') ? 'AnimInspectorScene' : 'MenuScene');
  }
}
