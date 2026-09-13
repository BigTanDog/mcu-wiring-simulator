import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * NestJS 依赖注入需要 emitDecoratorMetadata，而 esbuild 不支持该能力，
 * 因此测试用 SWC 转译（读取 tsconfig 的 experimentalDecorators / emitDecoratorMetadata）。
 */
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
