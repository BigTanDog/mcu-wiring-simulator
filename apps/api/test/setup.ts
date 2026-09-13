import { resolve } from 'node:path';

// 测试直接使用本地 SQLite（与开发库同一个文件，测试数据用独立 ownerKey 隔离）
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? `file:${resolve(__dirname, '../prisma/dev.db')}`;
process.env.ANON_PROJECT_TTL_DAYS = process.env.ANON_PROJECT_TTL_DAYS ?? '30';
