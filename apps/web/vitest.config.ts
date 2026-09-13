import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 测试环境固定使用 mock 数据源：
 *  - 单测不应依赖后端进程是否启动；
 *  - 真实后端联通由 scripts/smoke.mjs（真实浏览器）与 apps/api 集成测试覆盖。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sim/contracts': resolve(repoRoot, 'packages/contracts/src/index.ts'),
      '@sim/definitions': resolve(repoRoot, 'packages/definitions/src/index.ts'),
      '@sim/rule-engine': resolve(repoRoot, 'packages/rule-engine/src/index.ts'),
    },
  },
  define: {
    'import.meta.env.VITE_API_MODE': JSON.stringify('mock'),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
