import { Injectable } from '@nestjs/common';
import type { ComponentCategory, ComponentDef } from '@sim/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { notFound } from '../../common/domain-errors';

export interface ComponentSummary {
  slug: string;
  displayName: string;
  category: ComponentCategory;
  version: string;
  iconKey: string;
  portCount: number;
  requirementCount: number;
}

const parseJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

@Injectable()
export class ComponentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string, q?: string): Promise<ComponentSummary[]> {
    const rows = await this.prisma.componentDefinition.findMany({
      where: category ? { category, enabled: true } : { enabled: true },
      orderBy: { version: 'desc' },
    });

    const latestBySlug = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestBySlug.has(row.slug)) latestBySlug.set(row.slug, row);
    }

    const keyword = q?.trim().toLowerCase();
    return [...latestBySlug.values()]
      .filter(
        (row) =>
          !keyword ||
          row.displayName.toLowerCase().includes(keyword) ||
          row.slug.toLowerCase().includes(keyword) ||
          row.description.toLowerCase().includes(keyword),
      )
      .map((row) => ({
        slug: row.slug,
        displayName: row.displayName,
        category: row.category as ComponentCategory,
        version: row.version,
        iconKey: row.icon,
        portCount: parseJson<unknown[]>(row.ports, []).length,
        requirementCount: parseJson<string[]>(row.requirements, []).length,
      }));
  }

  async detail(slug: string, version?: string): Promise<ComponentDef> {
    const row = version
      ? await this.prisma.componentDefinition.findUnique({
          where: { slug_version: { slug, version } },
        })
      : await this.prisma.componentDefinition.findFirst({
          where: { slug },
          orderBy: { createdAt: 'desc' },
        });

    if (!row) {
      throw notFound(
        'DEFINITION_NOT_FOUND',
        `未找到组件定义 ${slug}${version ? `@${version}` : ''}`,
      );
    }

    return {
      slug: row.slug,
      displayName: row.displayName,
      category: row.category as ComponentCategory,
      icon: row.icon,
      version: row.version,
      description: row.description,
      ports: parseJson<ComponentDef['ports']>(row.ports, []),
      protocols: parseJson<string[]>(row.protocols, []),
      requirements: parseJson<ComponentDef['requirements']>(row.requirements, []),
      portOptions: row.portOptions
        ? parseJson<NonNullable<ComponentDef['portOptions']>>(row.portOptions, [])
        : undefined,
    };
  }
}
