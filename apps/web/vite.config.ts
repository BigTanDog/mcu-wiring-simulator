import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** 仓库根（apps/web → 上两级） */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 前端直接消费 workspace 源码（含 HMR），避免"改 packages 需先 build"。
 * 后端（apps/api）消费 packages 的 dist 产物，见 docs/技术设计文档.md §2.2。
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
  server: {
    port: 5180,
    host: '127.0.0.1',
  },
  preview: {
    port: 4180,
  },
});
