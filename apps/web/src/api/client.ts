/**
 * 数据源选择：VITE_API_MODE=http（默认，接真实后端）| mock（离线/演示）
 *
 * 前端 UI 与状态层只依赖 ApiClient 契约，切换数据源无需改动业务代码。
 */
import { httpApi } from './httpClient';
import { mockApi } from './mockApi';
import type { ApiClient } from './types';

export type { ApiClient } from './types';

const rawMode = import.meta.env.VITE_API_MODE ?? 'http';
export const apiMode: 'http' | 'mock' = rawMode === 'mock' ? 'mock' : 'http';

export const apiClient: ApiClient = apiMode === 'mock' ? mockApi : httpApi;
