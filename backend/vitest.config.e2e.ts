import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Les fichiers partagent la même base : on les exécute l'un après l'autre.
    fileParallelism: false,
  },
});
