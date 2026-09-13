/**
 * Mock 数据源（VITE_API_MODE=mock 或离线演示）
 *
 * 与 httpClient 实现同一 ApiClient 契约。项目管理用 localStorage 模拟服务端存储，
 * 保证 mock 模式下 M-01 的功能路径同样可点、可验证。
 */
import { BOARDS, COMPONENTS, getBoard } from '@sim/definitions';
import type {
  ComponentInstance,
  Connection,
  PatchProjectRequest,
  Project,
  ProjectDetail,
  ProjectSnapshot,
  ProjectSummary,
  ValidationResult,
} from '@sim/contracts';
import { RULE_SET_VERSION, validateProject } from '@sim/rule-engine';
import { ApiHttpError } from './httpClient';
import type { ApiClient, BackendVersionInfo } from './types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let simulatedOffline = false;

/** 演示用：模拟后端不可用，用于验证前端降级流程 */
export const setSimulatedOffline = (offline: boolean): void => {
  simulatedOffline = offline;
};

export const isSimulatedOffline = (): boolean => simulatedOffline;

/* --------------------------- 本地"服务端"存储 --------------------------- */

const STORE_KEY = 'sim-mcu-mock-projects';

interface MockRecord {
  project: Project;
  instances: ComponentInstance[];
  connections: Connection[];
}

const readRecords = (): MockRecord[] => {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '[]') as MockRecord[];
  } catch {
    return [];
  }
};

const writeRecords = (records: MockRecord[]): void => {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(records));
};

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toSummary = (record: MockRecord): ProjectSummary => ({
  id: record.project.id,
  name: record.project.name,
  boardSlug: record.project.boardSlug,
  revision: record.project.revision,
  componentCount: record.instances.length,
  connectionCount: record.connections.length,
  createdAt: record.project.createdAt,
  updatedAt: record.project.updatedAt,
});

/* --------------------------------- 实现 -------------------------------- */

export const mockApi: ApiClient = {
  async health() {
    await delay(60);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return { status: 'ok', version: '0.1.0-mock', db: 'ok' };
  },

  async version(): Promise<BackendVersionInfo> {
    await delay(40);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return {
      apiVersion: 'v1-mock',
      ruleSetVersion: RULE_SET_VERSION,
      boardCount: BOARDS.length,
      componentCount: COMPONENTS.length,
      ruleCount: 0,
    };
  },

  async listBoards() {
    await delay(120);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return BOARDS;
  },

  async getBoard(slug: string) {
    await delay(120);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return getBoard(slug);
  },

  async listComponents() {
    await delay(150);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return COMPONENTS;
  },

  async validate(snapshot: ProjectSnapshot): Promise<ValidationResult> {
    await delay(280);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    const result = validateProject({
      board: getBoard(snapshot.boardSlug),
      instances: snapshot.instances,
      connections: snapshot.connections,
      defs: COMPONENTS,
      options: { wifiEnabled: snapshot.options.wifiEnabled, mode: snapshot.options.mode },
    });
    return { ...result, source: 'server' };
  },

  async getRuleSetVersion() {
    await delay(40);
    return RULE_SET_VERSION;
  },

  /* ---------------------------- 项目管理（本地） ---------------------------- */

  async listProjects(): Promise<ProjectSummary[]> {
    await delay(120);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return readRecords()
      .map(toSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async createProject(input): Promise<Project> {
    await delay(150);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    const board = getBoard(input.boardSlug);
    const now = new Date().toISOString();
    const project: Project = {
      id: newId(),
      name: input.name,
      ownerKey: 'mock-owner',
      boardSlug: board.slug,
      boardVersion: board.version,
      schemaVersion: 1,
      revision: 1,
      options: { wifiEnabled: false, mode: 'loose' },
      createdAt: now,
      updatedAt: now,
    };
    writeRecords([...readRecords(), { project, instances: [], connections: [] }]);
    return project;
  },

  async getProject(id: string): Promise<ProjectDetail> {
    await delay(120);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    const record = readRecords().find((item) => item.project.id === id);
    if (!record) throw new ApiHttpError(404, 'PROJECT_NOT_FOUND', '项目不存在（mock）');
    return {
      project: record.project,
      board: getBoard(record.project.boardSlug),
      componentDefs: COMPONENTS,
      instances: record.instances,
      connections: record.connections,
    };
  },

  async saveProject(id: string, revision: number, patch: PatchProjectRequest) {
    await delay(180);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    const records = readRecords();
    const index = records.findIndex((item) => item.project.id === id);
    if (index < 0) throw new Error('项目不存在（mock）');
    const record = records[index];
    if (record.project.revision !== revision) {
      // 与真实后端一致：抛 409 语义错误，便于 store 走"冲突 → 可覆盖保存"分支
      throw new ApiHttpError(409, 'PROJECT_REVISION_CONFLICT', '项目已在别处更新（mock）');
    }
    const updatedAt = new Date().toISOString();
    records[index] = {
      project: {
        ...record.project,
        name: patch.name ?? record.project.name,
        options: patch.options ?? record.project.options,
        revision: record.project.revision + 1,
        updatedAt,
      },
      instances: patch.instances ?? record.instances,
      connections: patch.connections ?? record.connections,
    };
    writeRecords(records);
    return { revision: records[index].project.revision, updatedAt };
  },

  async deleteProject(id: string) {
    await delay(120);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    writeRecords(readRecords().filter((item) => item.project.id !== id));
    return { deleted: true as const };
  },

  async importProject(payload: ProjectSnapshot, name?: string): Promise<Project> {
    await delay(200);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    const board = getBoard(payload.boardSlug);
    const now = new Date().toISOString();
    const project: Project = {
      id: newId(),
      name: name ?? '导入的项目',
      ownerKey: 'mock-owner',
      boardSlug: board.slug,
      boardVersion: payload.boardVersion,
      schemaVersion: 1,
      revision: 1,
      options: payload.options,
      createdAt: now,
      updatedAt: now,
    };
    writeRecords([...readRecords(), { project, instances: payload.instances, connections: payload.connections }]);
    return project;
  },
};
