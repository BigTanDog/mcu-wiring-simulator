/**
 * Mock 数据源（VITE_API_MODE=mock 或后端不可用时的离线降级）
 *
 * 与 httpClient 实现同一 ApiClient 契约，接口签名对齐 docs/技术设计文档.md §9。
 */
import { BOARDS, COMPONENTS, getBoard } from '@sim/definitions';
import type { ProjectSnapshot, ValidationResult } from '@sim/contracts';
import { RULE_SET_VERSION, validateProject } from '@sim/rule-engine';
import type { ApiClient, BackendVersionInfo } from './types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let simulatedOffline = false;

/** 演示用：模拟后端不可用，用于验证前端降级流程 */
export const setSimulatedOffline = (offline: boolean): void => {
  simulatedOffline = offline;
};

export const isSimulatedOffline = (): boolean => simulatedOffline;

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
};
