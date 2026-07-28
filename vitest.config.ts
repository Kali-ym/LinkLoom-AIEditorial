import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'backend/tests/**/*.test.ts',
      'admin/src/**/*.test.ts',
      'admin/src/**/*.test.tsx',
      'web/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 45,
        lines: 40,
      },
    },
  },
});
