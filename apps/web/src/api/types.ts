import type {
  BoardDef,
  ComponentDef,
  PatchProjectRequest,
  Project,
  ProjectDetail,
  ProjectSnapshot,
  ProjectSummary,
  ValidationResult,
} from '@sim/contracts';

export interface BackendVersionInfo {
  apiVersion: string;
  ruleSetVersion: string;
  boardCount: number;
  componentCount: number;
  ruleCount: number;
}

/**
 * 数据访问契约：mock（离线/测试）与 http（真实后端）两种实现共用。
 * 对应 docs/技术设计文档.md §9 的接口契约（M-01 增加项目管理相关方法）。
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

  /* ------------------------------ 项目管理 ------------------------------ */
  listProjects(): Promise<ProjectSummary[]>;
  createProject(input: { name: string; boardSlug: string }): Promise<Project>;
  getProject(id: string): Promise<ProjectDetail>;
  /** PATCH /projects/:id，携带 If-Match 乐观锁；冲突时后端返回 409 */
  saveProject(
    id: string,
    revision: number,
    patch: PatchProjectRequest,
  ): Promise<{ revision: number; updatedAt: string }>;
  deleteProject(id: string): Promise<{ deleted: true }>;
  importProject(payload: ProjectSnapshot, name?: string): Promise<Project>;
}
