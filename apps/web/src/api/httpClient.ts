/**
 * 真实后端客户端（VITE_API_MODE=http 时启用）
 *
 * 契约见 docs/技术设计文档.md §9：统一包络 { data, meta }，失败 { error }。
 * 超时：默认 5s，/validate 8s（对应的离线降级由 store 处理）。
 */
import type { ApiEnvelope, BoardDef, ComponentDef, ProjectSnapshot, ValidationResult } from '@sim/contracts';
import type { ApiClient, BackendVersionInfo } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const OWNER_KEY_STORAGE = 'sim-mcu-owner-key';

/** 匿名 ownerKey：浏览器级标识，用于服务端数据隔离（无账号体系） */
const ownerKey = (): string => {
  const existing = window.localStorage.getItem(OWNER_KEY_STORAGE);
  if (existing) return existing;
  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(OWNER_KEY_STORAGE, created);
  return created;
};

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { timeoutMs = 5000, ...init } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Key': ownerKey(),
        ...(init.headers ?? {}),
      },
    });

    const body = (await response.json()) as ApiEnvelope<T> & {
      error?: { code: string; message: string };
    };

    if (!response.ok) {
      throw new Error(body.error?.message ?? `请求失败（HTTP ${response.status}）`);
    }
    return body.data;
  } finally {
    window.clearTimeout(timer);
  }
};

export const httpApi: ApiClient = {
  health: () => request<{ status: string; version: string; db: string }>('/health'),
  version: () => request<BackendVersionInfo>('/version'),
  listBoards: () => request<BoardDef[]>('/boards'),
  getBoard: (slug) => request<BoardDef>(`/boards/${slug}`),
  listComponents: () => request<ComponentDef[]>('/components'),
  validate: (snapshot: ProjectSnapshot) =>
    request<ValidationResult>('/validate', {
      method: 'POST',
      body: JSON.stringify({ snapshot }),
      timeoutMs: 8000,
    }),
  getRuleSetVersion: async () => (await request<BackendVersionInfo>('/version')).ruleSetVersion,
};
