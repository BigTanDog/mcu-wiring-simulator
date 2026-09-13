/**
 * 幂等 seed：把 packages/definitions 的板与组件定义写入数据库（§8.6）
 *
 * 幂等要求：连续执行两次，第二次必须输出「新增 0」。
 * 运行：npm run seed -w @sim/api
 */
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BOARDS, COMPONENTS } from '@sim/definitions';

// seed 可脱离 .env 独立运行（本地开发默认指向同目录下的 dev.db）
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${resolve(__dirname, 'dev.db')}`;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const board of BOARDS) {
    const existing = await prisma.boardDefinition.findUnique({
      where: { slug_version: { slug: board.slug, version: board.version } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.boardDefinition.create({
      data: {
        id: `board-${board.slug}@${board.version}`,
        slug: board.slug,
        version: board.version,
        displayName: board.displayName,
        mcuFamily: board.mcuFamily,
        logicVoltage: board.logicVoltage,
        sourceRef: board.sourceRef,
        pins: JSON.stringify(board.pins),
      },
    });
    created += 1;
  }

  for (const def of COMPONENTS) {
    const existing = await prisma.componentDefinition.findUnique({
      where: { slug_version: { slug: def.slug, version: def.version } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.componentDefinition.create({
      data: {
        id: `component-${def.slug}@${def.version}`,
        slug: def.slug,
        version: def.version,
        displayName: def.displayName,
        category: def.category,
        icon: def.icon,
        description: def.description,
        ports: JSON.stringify(def.ports),
        protocols: JSON.stringify(def.protocols),
        requirements: JSON.stringify(def.requirements),
        portOptions: def.portOptions ? JSON.stringify(def.portOptions) : null,
      },
    });
    created += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] 新增 ${created} 条，跳过 ${skipped} 条（幂等）`);
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[seed] 失败:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
