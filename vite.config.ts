import { defineConfig, loadEnv } from 'vite';

// base relativa ('./') permite publicar a pasta dist/ na raiz do public_html
// ou em qualquer subdiretório da Hostinger sem reconfigurar.
// Para forçar um caminho absoluto: VITE_BASE=/jogos/atriox/ npm run build
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
