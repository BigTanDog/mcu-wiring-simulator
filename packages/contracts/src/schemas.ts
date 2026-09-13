/**
 * Zod schema（请求体校验与响应校验的唯一真相源）
 *
 * 用途：
 *  - 后端：校验 /validate、/projects 等接口请求体（对应 docs/技术设计文档.md §9.1）
 *  - 前端：运行时校验响应，防止契约漂移
 */
import { z } from 'zod';

/* --------------------------------- 基础 --------------------------------- */

export const voltageDomainSchema = z.enum(['3V3', '5V', 'GND']);

export const pinDefSchema = z.object({
  id: z.string().min(1).max(64),
  physicalLabel: z.string().min(1).max(24),
  number: z.number().int().positive(),
  side: z.enum(['left', 'right']),
  order: z.number().int().nonnegative(),
  kind: z.enum(['io', 'power', 'ground', 'enable']),
  capabilities: z.array(z.string().min(1).max(24)).min(1),
  voltageDomain: voltageDomainSchema,
  internalPull: z.enum(['up', 'down', 'both', 'none']).optional(),
  note: z.string().max(200).optional(),
});

export const boardDefSchema = z.object({
  slug: z.string().min(1).max(64),
  displayName: z.string().min(1).max(80),
  mcuFamily: z.string().min(1).max(80),
  version: z.string().min(1).max(24),
  logicVoltage: z.enum(['3V3', '5V']),
  sourceRef: z.string().min(1).max(300),
  pins: z.array(pinDefSchema).min(1),
});

export const portDefSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(32),
  role: z.enum(['signal', 'power', 'ground', 'passive']),
  direction: z.enum(['in', 'out', 'io']),
  voltageDomain: voltageDomainSchema,
  required: z.boolean(),
  protocols: z.array(z.string().min(1).max(24)).optional(),
  note: z.string().max(200).optional(),
});

export const portOptionDefSchema = z.object({
  key: z.string().min(1).max(32),
  label: z.string().min(1).max(80),
  kind: z.enum(['select', 'toggle']),
  options: z.array(z.string().min(1).max(32)).optional(),
  defaultValue: z.union([z.string().max(64), z.boolean()]),
  satisfies: z.string().max(40).optional(),
});

export const componentDefSchema = z.object({
  slug: z.string().min(1).max(64),
  displayName: z.string().min(1).max(80),
  category: z.enum(['mcu', 'sensor', 'display', 'actuator', 'power_passive']),
  icon: z.string().min(1).max(16),
  version: z.string().min(1).max(24),
  ports: z.array(portDefSchema).min(1),
  protocols: z.array(z.string().min(1).max(24)),
  requirements: z.array(z.string().min(1).max(40)),
  portOptions: z.array(portOptionDefSchema).optional(),
  description: z.string().min(1).max(300),
});

/* ------------------------------ 项目与连线 ------------------------------ */

export const endpointRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pin'), pinId: z.string().min(1).max(64) }),
  z.object({
    type: z.literal('port'),
    instanceId: z.string().min(1).max(64),
    portId: z.string().min(1).max(32),
  }),
]);

export const connectionSchema = z.object({
  id: z.string().min(1).max(64),
  from: endpointRefSchema,
  to: endpointRefSchema,
  kind: z.enum(['signal', 'power', 'ground', 'bus']),
  enabled: z.boolean(),
});

export const componentInstanceSchema = z.object({
  id: z.string().min(1).max(64),
  definitionSlug: z.string().min(1).max(64),
  definitionVersion: z.string().min(1).max(24).optional(),
  label: z.string().min(1).max(64),
  position: z.object({ x: z.number(), y: z.number() }),
  portConfig: z.record(z.union([z.string().max(64), z.boolean()])),
});

export const projectSnapshotSchema = z.object({
  boardSlug: z.string().min(1).max(64),
  boardVersion: z.string().min(1).max(24),
  instances: z.array(componentInstanceSchema).max(500),
  connections: z.array(connectionSchema).max(2000),
  options: z.object({
    wifiEnabled: z.boolean(),
    mode: z.enum(['strict', 'loose']),
  }),
});

/* --------------------------------- 请求 --------------------------------- */

export const createProjectRequestSchema = z.object({
  name: z.string().min(1).max(80),
  boardSlug: z.string().min(1).max(64),
  boardVersion: z.string().min(1).max(24).optional(),
});

export const patchProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    instances: z.array(componentInstanceSchema).max(500).optional(),
    connections: z.array(connectionSchema).max(2000).optional(),
    viewport: z
      .object({ x: z.number(), y: z.number(), zoom: z.number().min(0.1).max(4) })
      .optional(),
    options: z
      .object({ wifiEnabled: z.boolean(), mode: z.enum(['strict', 'loose']) })
      .optional(),
  })
  .strict();

export const ruleConfigSchema = z.object({
  code: z.string().min(1).max(16),
  enabled: z.boolean(),
  severityOverride: z.enum(['error', 'warning', 'info']).optional(),
});

export const validateRequestSchema = z
  .object({
    snapshot: projectSnapshotSchema,
    ruleSetVersion: z.string().max(64).optional(),
    ruleConfigs: z.array(ruleConfigSchema).max(64).optional(),
  })
  .strict();

export const importProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    payload: projectSnapshotSchema,
  })
  .strict();
