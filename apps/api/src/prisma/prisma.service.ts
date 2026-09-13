import { resolve } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 规范化 SQLite 连接串。
 *
 * 背景（实测踩坑）：`file:./dev.db` 在 Prisma CLI 中相对 schema.prisma 所在目录解析，
 * 而运行时 Prisma Client 相对进程启动目录解析 —— 两者不一致会导致「CLI 迁移成功但接口查不到库」。
 * 这里统一按 schema 目录（apps/api/prisma）解析，保证运行期与 CLI 行为一致。
 */
const normalizeDatabaseUrl = (): string | undefined => {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) return url;

  const target = url.slice('file:'.length);
  const isAbsolute = target.startsWith('/') || /^[A-Za-z]:/.test(target);
  if (isAbsolute) return url;

  return `file:${resolve(__dirname, '../../prisma', target)}`;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = normalizeDatabaseUrl();
    super(url ? { datasources: { db: { url } } } : {});
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** 健康检查用：探测数据库连通性 */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
