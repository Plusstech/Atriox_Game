import { defineConfig, loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The manifest and every referenced page form one release. Pixel-only changes
// must change texture URLs too, even when frame coordinates remain identical.
const atlasDirectory = new URL('./public/assets/atlas/', import.meta.url);
const manifestBytes = readFileSync(new URL('characters.json', atlasDirectory));
const manifest = JSON.parse(manifestBytes.toString('utf8')) as { textures: { image: string }[] };
const atlasHash = createHash('sha256').update(manifestBytes);
for (const texture of manifest.textures) atlasHash.update(readFileSync(new URL(texture.image, atlasDirectory)));
const atlasRevision = atlasHash.digest('hex').slice(0, 16);

// base relativa ('./') permite publicar a pasta dist/ na raiz do public_html
// ou em qualquer subdiretório da Hostinger sem reconfigurar.
// Para forçar um caminho absoluto: VITE_BASE=/jogos/atriox/ npm run build
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: { __ATLAS_REVISION__: JSON.stringify(atlasRevision) },
    base: env.VITE_BASE || './',
    server: { port: 5173, host: true },
    build: {
      outDir: 'dist',
      assetsDir: 'bundle',
      target: 'es2020',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: { manualChunks: { phaser: ['phaser'] } }
      }
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts']
    }
  };
});
