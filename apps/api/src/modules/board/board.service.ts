import { Injectable } from '@nestjs/common';
import type { BoardDef } from '@sim/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { notFound } from '../../common/domain-errors';

export interface BoardSummary {
  slug: string;
  displayName: string;
  version: string;
  pinCount: number;
}

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BoardSummary[]> {
    const rows = await this.prisma.boardDefinition.findMany({ orderBy: { version: 'desc' } });
    const latestBySlug = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestBySlug.has(row.slug)) latestBySlug.set(row.slug, row);
    }
    return [...latestBySlug.values()].map((row) => ({
      slug: row.slug,
      displayName: row.displayName,
      version: row.version,
      pinCount: (JSON.parse(row.pins) as unknown[]).length,
    }));
  }

  async detail(slug: string, version?: string): Promise<BoardDef> {
    const row = version
      ? await this.prisma.boardDefinition.findUnique({
          where: { slug_version: { slug, version } },
        })
      : await this.prisma.boardDefinition.findFirst({
          where: { slug },
          orderBy: { createdAt: 'desc' },
        });

    if (!row) {
      throw notFound(
        'DEFINITION_NOT_FOUND',
        `未找到开发板定义 ${slug}${version ? `@${version}` : ''}`,
      );
    }

    return {
      slug: row.slug,
      displayName: row.displayName,
      mcuFamily: row.mcuFamily,
      version: row.version,
      logicVoltage: row.logicVoltage === '5V' ? '5V' : '3V3',
      sourceRef: row.sourceRef,
      pins: JSON.parse(row.pins) as BoardDef['pins'],
    };
  }
}
