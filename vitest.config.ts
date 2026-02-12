import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.{test,spec}.ts(x)?', 'src/**/*.{test,spec}.ts(x)?'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/__tests__', 'src/core/**/*.test.ts', 'src/core/workers/**']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: { alias: { '@': '/src' } }
})
