import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'node',
    
    // Test globals (no need to import describe, it, expect)
    globals: true,
    
    // Include test files
    include: ['src/**/__tests__/**/*.{test,spec}.ts(x)?', 'src/**/*.{test,spec}.ts(x)?'],
    
    // Coverage reporting
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**/*.ts'],
      exclude: [
        'src/core/**/__tests__',
        'src/core/**/*.test.ts',
        'src/core/workers/**'
      ]
    },
    
    // Timeout for async tests (services need time to initialize)
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000
  },
  
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
