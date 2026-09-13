/**
 * Mock API 客户端（Demo 阶段替代真实后端）
 *
 * 目的：在不启动后端服务的前提下，验证"前端 + 后端契约"的交互流程是否合理。
 * 接口签名与 docs/产品计划文档.md 第 11.4 章的 REST 草案保持一致，
 * 后续接入真实后端时只需替换本文件的实现（调用方不变）。
 */
import { BOARDS, getBoard } from '../definitions/esp32';
import { COMPONENTS } from '../definitions/components';
import type { BoardDef, ComponentDef, ProjectSnapshot, ValidationResult } from '../definitions/types';
import { RULE_SET_VERSION, validateProject } from '../rules/engine';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let simulatedOffline = false;

/** 演示用：模拟后端不可用，用于验证前端降级流程 */
export const setSimulatedOffline = (offline: boolean): void => {
  simulatedOffline = offline;
};

export const isSimulatedOffline = (): boolean => simulatedOffline;

export interface ApiClient {
  health(): Promise<{ status: 'ok'; version: string }>;
  listBoards(): Promise<BoardDef[]>;
  getBoard(slug: string): Promise<BoardDef>;
  listComponents(): Promise<ComponentDef[]>;
  /** POST /api/v1/validate（权威校验：与前端同源规则 + 服务端规则集版本） */
  validate(snapshot: ProjectSnapshot): Promise<ValidationResult>;
  getRuleSetVersion(): Promise<string>;
}

export const mockApi: ApiClient = {
  async health() {
    await delay(60);
    if (simulatedOffline) throw new Error('后端不可用（模拟）');
    return { status: 'ok', version: '0.1.0-mock' };
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

  async validate(snapshot: ProjectSnapshot) {
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
