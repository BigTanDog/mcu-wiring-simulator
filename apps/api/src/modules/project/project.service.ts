import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ComponentInstance,
  Connection,
  CreateProjectRequest,
  ImportProjectRequest,
  PatchProjectRequest,
  Project,
  ProjectDetail,
  ProjectOptionsSnapshot,
  ProjectSnapshot,
} from '@sim/contracts';
import type { ComponentInstanceRecord, ConnectionRecord, Project as ProjectRow } from '@prisma/client';
import { COMPONENTS, findBoard } from '@sim/definitions';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, conflict, notFound } from '../../common/domain-errors';

const DEFAULT_OPTIONS: ProjectOptionsSnapshot = { wifiEnabled: false, mode: 'loose' };

/**
 * 实例/连线 id 是前端局部唯一（如 `c-led`），直接作为库内主键会跨项目冲突（实测缺陷）。
 * 存储时加项目前缀保证全局唯一，读取时剥离前缀还给前端，保持前端 id 语义稳定。
 */
const scopedId = (projectId: string, localId: string): string => `${projectId}-${localId}`;

const localIdOf = (projectId: string, scoped: string): string =>
  scoped.startsWith(`${projectId}-`) ? scoped.slice(projectId.length + 1) : scoped;

/**
 * 项目持久化（§8.3 事务边界）：
 *  - 保存项目 = 1 个事务（revision 递增 + 全量替换实例/连线）
 *  - 乐观锁：If-Match: <revision>，冲突返回 409
 *  - 无账号：ownerKey 做数据隔离；匿名项目带 TTL
 */
@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  private expiryFromNow(): Date {
    const days = Number(process.env.ANON_PROJECT_TTL_DAYS ?? 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private parseOptions(text: string | null): ProjectOptionsSnapshot {
    if (!text) return DEFAULT_OPTIONS;
    try {
      const parsed = JSON.parse(text) as Partial<ProjectOptionsSnapshot>;
      return {
        wifiEnabled: parsed.wifiEnabled === true,
        mode: parsed.mode === 'strict' ? 'strict' : 'loose',
      };
    } catch {
      return DEFAULT_OPTIONS;
    }
  }

  private toProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      ownerKey: row.ownerKey,
      boardSlug: row.boardSlug,
      boardVersion: row.boardVersion,
      schemaVersion: row.schemaVersion,
      revision: row.revision,
      viewport: row.viewport
        ? (JSON.parse(row.viewport) as Project['viewport'])
        : undefined,
      options: this.parseOptions(row.options),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
    };
  }

  private toInstance(row: ComponentInstanceRecord): ComponentInstance {
    return {
      id: localIdOf(row.projectId, row.id),
      definitionSlug: row.definitionSlug,
      definitionVersion: row.definitionVersion,
      label: row.label,
      position: { x: row.x, y: row.y },
      portConfig: JSON.parse(row.portConfig) as Record<string, string | boolean>,
    };
  }

  private toConnection(row: ConnectionRecord): Connection {
    return {
      id: localIdOf(row.projectId, row.id),
      from: JSON.parse(row.fromRef) as Connection['from'],
      to: JSON.parse(row.toRef) as Connection['to'],
      kind: row.kind as Connection['kind'],
      enabled: row.enabled,
    };
  }

  private async requireOwned(id: string, ownerKey: string): Promise<ProjectRow> {
    const row = await this.prisma.project.findFirst({ where: { id, ownerKey } });
    if (!row) {
      throw notFound('PROJECT_NOT_FOUND', '项目不存在、已过期或不属于当前用户');
    }
    return row;
  }

  /** 校验实例引用的定义均存在（导入与创建共用） */
  private assertDefinitionsExist(instances: Array<{ definitionSlug: string }>): void {
    const unknown = [
      ...new Set(
        instances
          .map((item) => item.definitionSlug)
          .filter((slug) => !COMPONENTS.some((def) => def.slug === slug)),
      ),
    ];
    if (unknown.length > 0) {
      throw badRequest('DEFINITION_NOT_FOUND', `存在未知组件定义: ${unknown.join(', ')}`);
    }
  }

  async create(ownerKey: string, body: CreateProjectRequest): Promise<Project> {
    const board = findBoard(body.boardSlug);
    if (!board) {
      throw badRequest('DEFINITION_NOT_FOUND', `未找到开发板定义 ${body.boardSlug}`);
    }
    const row = await this.prisma.project.create({
      data: {
        id: randomUUID(),
        name: body.name,
        ownerKey,
        boardSlug: board.slug,
        boardVersion: body.boardVersion ?? board.version,
        options: JSON.stringify(DEFAULT_OPTIONS),
        expiresAt: this.expiryFromNow(),
      },
    });
    return this.toProject(row);
  }

  async detail(ownerKey: string, id: string): Promise<ProjectDetail> {
    const row = await this.requireOwned(id, ownerKey);
    const [instanceRows, connectionRows] = await Promise.all([
      this.prisma.componentInstanceRecord.findMany({ where: { projectId: id } }),
      this.prisma.connectionRecord.findMany({ where: { projectId: id } }),
    ]);
    const board = findBoard(row.boardSlug);
    if (!board) {
      throw badRequest('DEFINITION_NOT_FOUND', `未找到开发板定义 ${row.boardSlug}`);
    }
    const usedSlugs = [...new Set(instanceRows.map((item) => item.definitionSlug))];
    return {
      project: this.toProject(row),
      board,
      componentDefs: COMPONENTS.filter((def) => usedSlugs.includes(def.slug)),
      instances: instanceRows.map((item) => this.toInstance(item)),
      connections: connectionRows.map((item) => this.toConnection(item)),
    };
  }

  async patch(
    ownerKey: string,
    id: string,
    ifMatch: string | undefined,
    body: PatchProjectRequest,
  ): Promise<{ revision: number; updatedAt: string }> {
    const row = await this.requireOwned(id, ownerKey);

    const expected = ifMatch ? Number(ifMatch) : Number.NaN;
    if (!Number.isNaN(expected) && expected !== row.revision) {
      throw conflict('PROJECT_REVISION_CONFLICT', '项目已在别处更新，请刷新后重试', {
        currentRevision: row.revision,
        expectedRevision: expected,
      });
    }

    if (body.instances) this.assertDefinitionsExist(body.instances);

    const updated = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          name: body.name ?? row.name,
          revision: { increment: 1 },
          viewport: body.viewport ? JSON.stringify(body.viewport) : row.viewport,
          options: body.options ? JSON.stringify(body.options) : row.options,
          expiresAt: this.expiryFromNow(),
        },
      });

      if (body.instances) {
        await tx.componentInstanceRecord.deleteMany({ where: { projectId: id } });
        if (body.instances.length > 0) {
          await tx.componentInstanceRecord.createMany({
            data: body.instances.map((item) => ({
              id: scopedId(id, item.id),
              projectId: id,
              definitionSlug: item.definitionSlug,
              definitionVersion: item.definitionVersion ?? '1.0.0',
              label: item.label,
              x: item.position.x,
              y: item.position.y,
              portConfig: JSON.stringify(item.portConfig),
            })),
          });
        }
      }

      if (body.connections) {
        await tx.connectionRecord.deleteMany({ where: { projectId: id } });
        if (body.connections.length > 0) {
          await tx.connectionRecord.createMany({
            data: body.connections.map((conn) => ({
              id: scopedId(id, conn.id),
              projectId: id,
              fromType: conn.from.type,
              fromRef: JSON.stringify(conn.from),
              toType: conn.to.type,
              toRef: JSON.stringify(conn.to),
              kind: conn.kind,
              enabled: conn.enabled,
            })),
          });
        }
      }

      return project;
    });

    return { revision: updated.revision, updatedAt: updated.updatedAt.toISOString() };
  }

  async remove(ownerKey: string, id: string): Promise<{ deleted: true }> {
    await this.requireOwned(id, ownerKey);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  /** 导出：含 schemaVersion 与所用定义版本（§9.2） */
  async exportSnapshot(
    ownerKey: string,
    id: string,
  ): Promise<ProjectSnapshot & { schemaVersion: number; projectName: string }> {
    const detail = await this.detail(ownerKey, id);
    return {
      schemaVersion: detail.project.schemaVersion,
      projectName: detail.project.name,
      boardSlug: detail.project.boardSlug,
      boardVersion: detail.project.boardVersion,
      instances: detail.instances,
      connections: detail.connections,
      options: detail.project.options ?? DEFAULT_OPTIONS,
    };
  }

  async importProject(ownerKey: string, body: ImportProjectRequest): Promise<Project> {
    const snapshot = body.payload;
    const board = findBoard(snapshot.boardSlug);
    if (!board) {
      throw badRequest('DEFINITION_NOT_FOUND', `未找到开发板定义 ${snapshot.boardSlug}`);
    }
    this.assertDefinitionsExist(snapshot.instances);

    const projectId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: projectId,
          name: body.name ?? '导入的项目',
          ownerKey,
          boardSlug: snapshot.boardSlug,
          boardVersion: snapshot.boardVersion,
          options: JSON.stringify(snapshot.options),
          expiresAt: this.expiryFromNow(),
        },
      });

      if (snapshot.instances.length > 0) {
        await tx.componentInstanceRecord.createMany({
          data: snapshot.instances.map((item) => ({
            id: `${projectId}-${item.id}`,
            projectId,
            definitionSlug: item.definitionSlug,
            definitionVersion: item.definitionVersion ?? '1.0.0',
            label: item.label,
            x: item.position.x,
            y: item.position.y,
            portConfig: JSON.stringify(item.portConfig),
          })),
        });
      }

      if (snapshot.connections.length > 0) {
        await tx.connectionRecord.createMany({
          data: snapshot.connections.map((conn) => ({
            id: `${projectId}-${conn.id}`,
            projectId,
            fromType: conn.from.type,
            fromRef: JSON.stringify(conn.from),
            toType: conn.to.type,
            toRef: JSON.stringify(conn.to),
            kind: conn.kind,
            enabled: conn.enabled,
          })),
        });
      }
    });

    const detail = await this.detail(ownerKey, projectId);
    return detail.project;
  }
}
