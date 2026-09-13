import { useEffect, useState } from 'react';
import { apiClient, apiMode } from '../api/client';
import type { BackendVersionInfo } from '../api/types';

export type BackendStatus = 'checking' | 'online' | 'offline';

/**
 * 后端连通性探测：用于顶栏提示"后端已连接 / 离线（本地规则集）"。
 * 探测失败不影响使用——本地规则引擎仍可完成校验（§D-08 双轨设计）。
 */
export const useBackendStatus = (): { status: BackendStatus; info: BackendVersionInfo | null } => {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [info, setInfo] = useState<BackendVersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const probe = async (): Promise<void> => {
      try {
        const version = await apiClient.version();
        if (!cancelled) {
          setInfo(version);
          setStatus('online');
        }
      } catch {
        if (!cancelled) {
          setInfo(null);
          setStatus('offline');
        }
      }
    };

    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status: apiMode === 'mock' ? 'offline' : status, info };
};
