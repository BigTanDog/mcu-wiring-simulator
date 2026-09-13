import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * 测试直接消费 workspace 源码（而非 dist），避免"改源码要重新 build 才能测"。
 * 后端运行时仍消费 dist（见 docs/技术设计文档.md §2.2）。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@sim/contracts': resolve(__dirname, '../contracts/src/index.ts'),
      '@sim/definitions': resolve(__dirname, '../definitions/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
