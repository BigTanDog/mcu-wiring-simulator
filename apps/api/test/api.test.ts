/**
 * 后端集成测试（§10.3）
 *
 * 覆盖：健康检查、版本、定义读取、校验（含错误码）、项目 CRUD、乐观锁、导入导出往返。
 * 运行：npm test -w @sim/api
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { EnvelopeInterceptor } from '../src/common/envelope.interceptor';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';

let app: INestApplication;
const ownerKey = `test-${randomUUID()}`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

const api = () => request(app.getHttpServer());

describe('健康与版本', () => {
  it('GET /health 返回 ok 与数据库状态', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('ok');
    expect(res.body.meta.requestId).toBeTruthy();
  });

  it('GET /version 暴露规则集版本与定义数量', async () => {
    const res = await api().get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body.data.ruleSetVersion).toMatch(/^rules-/);
    expect(res.body.data.componentCount).toBeGreaterThanOrEqual(5);
    expect(res.body.data.ruleCount).toBeGreaterThanOrEqual(16);
  });
});

describe('定义读取', () => {
  it('GET /boards 返回 ESP32 开发板', async () => {
    const res = await api().get('/api/v1/boards');
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((item: { slug: string }) => item.slug);
    expect(slugs).toContain('esp32-devkitc-v4');
  });

  it('GET /boards/esp32-devkitc-v4 返回 38 个引脚', async () => {
    const res = await api().get('/api/v1/boards/esp32-devkitc-v4');
    expect(res.status).toBe(200);
    expect(res.body.data.pins).toHaveLength(38);
  });

  it('GET /components 返回 5 个组件', async () => {
    const res = await api().get('/api/v1/components');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('未知定义返回 DEFINITION_NOT_FOUND', async () => {
    const res = await api().get('/api/v1/boards/not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DEFINITION_NOT_FOUND');
  });
});

describe('校验接口', () => {
  const snapshot = {
    boardSlug: 'esp32-devkitc-v4',
    boardVersion: '1.0.0',
    instances: [
      {
        id: 'c-dht11',
        definitionSlug: 'dht11',
        definitionVersion: '1.0.0',
        label: 'DHT11-1',
        position: { x: 0, y: 0 },
        portConfig: { pullup: true },
      },
    ],
    connections: [
      {
        id: 'e1',
        from: { type: 'pin', pinId: 'pin-esp32-3v3' },
        to: { type: 'port', instanceId: 'c-dht11', portId: 'VCC' },
        kind: 'power',
        enabled: true,
      },
      {
        id: 'e2',
        from: { type: 'pin', pinId: 'pin-esp32-gpio4' },
        to: { type: 'port', instanceId: 'c-dht11', portId: 'DATA' },
        kind: 'signal',
        enabled: true,
      },
      {
        id: 'e3',
        from: { type: 'pin', pinId: 'pin-esp32-gnd-1' },
        to: { type: 'port', instanceId: 'c-dht11', portId: 'GND' },
        kind: 'ground',
        enabled: true,
      },
    ],
    options: { wifiEnabled: false, mode: 'loose' as const },
  };

  it('正确接线返回 passed，且 source=server', async () => {
    const res = await api().post('/api/v1/validate').send({ snapshot });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('passed');
    expect(res.body.data.source).toBe('server');
    expect(res.body.data.ruleSetVersion).toMatch(/^rules-/);
  });

  it('错误接线返回 failed 且含 R-08', async () => {
    const bad = {
      ...snapshot,
      connections: snapshot.connections.map((conn) =>
        conn.id === 'e2' ? { ...conn, from: { type: 'pin', pinId: 'pin-esp32-gpio34' } } : conn,
      ),
    };
    const res = await api().post('/api/v1/validate').send({ snapshot: bad });
    expect(res.body.data.status).toBe('failed');
    const codes = res.body.data.diagnostics.map((item: { code: string }) => item.code);
    expect(codes).toContain('R-08');
  });

  it('非法请求体返回 422 VALIDATION_FAILED', async () => {
    const res = await api().post('/api/v1/validate').send({ snapshot: { boardSlug: 1 } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /rule-sets/latest 返回 16+ 条规则', async () => {
    const res = await api().get('/api/v1/rule-sets/latest');
    expect(res.status).toBe(200);
    expect(res.body.data.rules.length).toBeGreaterThanOrEqual(16);
    expect(res.body.data.version).toMatch(/^rules-/);
  });
});

describe('项目 CRUD 与乐观锁', () => {
  it('创建 → 读取 → 保存（revision 递增）→ 导出往返', async () => {
    const createRes = await api()
      .post('/api/v1/projects')
      .set('x-owner-key', ownerKey)
      .send({ name: '集成测试项目', boardSlug: 'esp32-devkitc-v4' });
    expect(createRes.status).toBe(201);
    const projectId = createRes.body.data.id as string;
    expect(createRes.body.data.revision).toBe(1);

    const detailRes = await api().get(`/api/v1/projects/${projectId}`).set('x-owner-key', ownerKey);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.board.pins).toHaveLength(38);

    const patchRes = await api()
      .patch(`/api/v1/projects/${projectId}`)
      .set('x-owner-key', ownerKey)
      .set('If-Match', '1')
      .send({
        name: '改名后的项目',
        instances: [
          {
            id: 'c-led',
            definitionSlug: 'led',
            definitionVersion: '1.0.0',
            label: 'LED-1',
            position: { x: 10, y: 20 },
            portConfig: { seriesResistor: true },
          },
        ],
        connections: [
          {
            id: 'e-led-a',
            from: { type: 'pin', pinId: 'pin-esp32-gpio4' },
            to: { type: 'port', instanceId: 'c-led', portId: 'A' },
            kind: 'signal',
            enabled: true,
          },
        ],
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.revision).toBe(2);

    // 过期 revision → 409
    const conflictRes = await api()
      .patch(`/api/v1/projects/${projectId}`)
      .set('x-owner-key', ownerKey)
      .set('If-Match', '1')
      .send({ name: '并发写入' });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('PROJECT_REVISION_CONFLICT');

    const exportRes = await api()
      .get(`/api/v1/projects/${projectId}/export`)
      .set('x-owner-key', ownerKey);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.instances).toHaveLength(1);
    expect(exportRes.body.data.connections).toHaveLength(1);
    expect(exportRes.body.data.schemaVersion).toBe(1);

    // 导入导出内容 → 新项目往返一致
    const importRes = await api()
      .post('/api/v1/projects/import')
      .set('x-owner-key', ownerKey)
      .send({ name: '导入副本', payload: exportRes.body.data });
    expect(importRes.status).toBe(201);
    const importedId = importRes.body.data.id as string;

    const importedDetail = await api()
      .get(`/api/v1/projects/${importedId}`)
      .set('x-owner-key', ownerKey);
    const imported = importedDetail.body.data;
    expect(imported.instances).toHaveLength(1);
    expect(imported.instances[0].definitionSlug).toBe('led');
    expect(imported.instances[0].portConfig.seriesResistor).toBe(true);
    expect(imported.connections[0].from.pinId).toBe('pin-esp32-gpio4');
  });

  it('GET /projects 返回本人项目列表（含计数），他人项目不可见', async () => {
    const created = await api()
      .post('/api/v1/projects')
      .set('x-owner-key', ownerKey)
      .send({ name: '列表用例项目', boardSlug: 'esp32-devkitc-v4' });
    expect(created.status).toBe(201);

    const res = await api().get('/api/v1/projects').set('x-owner-key', ownerKey);
    expect(res.status).toBe(200);
    const item = (
      res.body.data as Array<{ id: string; componentCount: number; connectionCount: number }>
    ).find((entry) => entry.id === created.body.data.id);
    expect(item).toBeTruthy();
    expect(item?.componentCount).toBe(0);
    expect(item?.connectionCount).toBe(0);

    const otherRes = await api()
      .get('/api/v1/projects')
      .set('x-owner-key', `other-${randomUUID()}`);
    expect(otherRes.body.data).toHaveLength(0);
  });

  it('未找到项目返回 404 PROJECT_NOT_FOUND', async () => {
    const res = await api().get(`/api/v1/projects/${randomUUID()}`).set('x-owner-key', ownerKey);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('不同 ownerKey 无法读取他人项目（数据隔离）', async () => {
    const createRes = await api()
      .post('/api/v1/projects')
      .set('x-owner-key', `other-${randomUUID()}`)
      .send({ name: '他人项目', boardSlug: 'esp32-devkitc-v4' });
    const otherId = createRes.body.data.id as string;
    const res = await api().get(`/api/v1/projects/${otherId}`).set('x-owner-key', ownerKey);
    expect(res.status).toBe(404);
  });

  it('回归：不同项目可使用相同的前端局部 id（库内以项目前缀避免主键冲突）', async () => {
    const instances = [
      {
        id: 'c-led',
        definitionSlug: 'led',
        definitionVersion: '1.0.0',
        label: 'LED-1',
        position: { x: 0, y: 0 },
        portConfig: { seriesResistor: true },
      },
    ];
    const connections = [
      {
        id: 'e-led-a',
        from: { type: 'pin', pinId: 'pin-esp32-gpio4' },
        to: { type: 'port', instanceId: 'c-led', portId: 'A' },
        kind: 'signal',
        enabled: true,
      },
    ];

    const create = async (name: string): Promise<string> => {
      const res = await api()
        .post('/api/v1/projects')
        .set('x-owner-key', ownerKey)
        .send({ name, boardSlug: 'esp32-devkitc-v4' });
      return res.body.data.id as string;
    };

    const firstId = await create('项目 A');
    const firstPatch = await api()
      .patch(`/api/v1/projects/${firstId}`)
      .set('x-owner-key', ownerKey)
      .set('If-Match', '1')
      .send({ instances, connections });
    expect(firstPatch.status).toBe(200);

    const secondId = await create('项目 B');
    const secondPatch = await api()
      .patch(`/api/v1/projects/${secondId}`)
      .set('x-owner-key', ownerKey)
      .set('If-Match', '1')
      .send({ instances, connections });
    // 修复前：同 id 在库内主键冲突 → 500
    expect(secondPatch.status).toBe(200);

    // 读取时 id 应还原为前端局部 id（语义稳定）
    const detail = await api().get(`/api/v1/projects/${secondId}`).set('x-owner-key', ownerKey);
    expect(detail.body.data.instances[0].id).toBe('c-led');
    expect(detail.body.data.connections[0].id).toBe('e-led-a');
  });
});
