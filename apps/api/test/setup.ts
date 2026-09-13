import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * 测试隔离（实测踩坑）：
 *  1. 使用独立的 SQLite 文件（prisma/test.db）——SQLite 并发写会 database is locked，
 *     若与本地 dev 服务共用 dev.db，集成测试会随机 500；
 *  2. 每次运行前清空业务表，保证用例可重复执行（实例/连线 id 为前端局部 id，历史数据会主键冲突）。
 */
const apiRoot = resolve(__dirname, '..');
const testDbPath = resolve(apiRoot, 'prisma/test.db');

process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.ANON_PROJECT_TTL_DAYS = process.env.ANON_PROJECT_TTL_DAYS ?? '30';

if (!existsSync(testDbPath)) {
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: 'ignore',
  });
  execSync('npx ts-node --transpile-only prisma/seed.ts', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: 'ignore',
  });
}

const prisma = new PrismaClient();
await prisma.validationRun.deleteMany();
await prisma.connectionRecord.deleteMany();
await prisma.componentInstanceRecord.deleteMany();
await prisma.project.deleteMany();
await prisma.$disconnect();
