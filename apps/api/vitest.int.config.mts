import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    env: {
      NODE_ENV: 'test',
    },
  },
});
