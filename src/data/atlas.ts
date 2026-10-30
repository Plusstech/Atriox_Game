import manifest from '../../public/assets/atlas/characters.json';

/** Metadata travels with the hashed JS bundle, never a potentially stale JSON URL. */
export const CHARACTER_ATLAS_META = manifest.meta;

/** Phaser uses image names as both URLs and internal page identifiers. */
export function versionedCharacterAtlas(revision: string) {
  return {
    ...manifest,
    textures: manifest.textures.map(texture => ({
      ...texture,
      image: `${texture.image}?v=${encodeURIComponent(revision)}`
    }))
  };
}
