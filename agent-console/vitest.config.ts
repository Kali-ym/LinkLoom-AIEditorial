import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@lobehub/fluent-emoji': path.resolve(__dirname, 'src/test/stubs/fluentEmoji.tsx'),
      '@lobehub/fluent-emoji/es/FluentEmoji': path.resolve(__dirname, 'src/test/stubs/fluentEmoji.tsx'),
    },
  },
  test: {
    setupFiles: ['./src/test/vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@lobehub/fluent-emoji', '@lobehub/ui'],
      },
    },
    deps: {
      optimizer: {
        ssr: {
          include: ['@lobehub/fluent-emoji', '@lobehub/ui'],
        },
      },
    },
  },
});
