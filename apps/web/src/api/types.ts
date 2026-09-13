import type { BoardDef, ComponentDef, ProjectSnapshot, ValidationResult } from '@sim/contracts';

export interface BackendVersionInfo {
  apiVersion: string;
  ruleSetVersion: string;
  boardCount: number;
  componentCount: number;
  ruleCount: number;
}

/**
 * 数据访问契约：mock（离线/测试）与 http（真实后端）两种实现共用。
 * 对应 docs/技术设计文档.md §9 的接口契约。
 */
export interface ApiClient {
  health(): Promise<{ status: string; version: string; db: string }>;
  version(): Promise<BackendVersionInfo>;
  listBoards(): Promise<BoardDef[]>;
  getBoard(slug: string): Promise<BoardDef>;
  listComponents(): Promise<ComponentDef[]>;
  /** POST /api/v1/validate —— 权威校验（与前端同源规则实现） */
  validate(snapshot: ProjectSnapshot): Promise<ValidationResult>;
  getRuleSetVersion(): Promise<string>;
}
