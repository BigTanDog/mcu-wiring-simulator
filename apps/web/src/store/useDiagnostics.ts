/**
 * 诊断索引：把校验结果（诊断列表）转成"按目标查严重度"的索引，
 * 供画布节点/连线高亮与结果面板定位使用。
 */
import { useMemo } from 'react';
import type { Severity } from '../definitions/types';
import { selectActiveResult, useProjectStore } from './useProjectStore';

export interface DiagnosticIndex {
  pin: Map<string, Severity>;
  instance: Map<string, Severity>;
  port: Map<string, Severity>;
  connection: Map<string, Severity>;
  /** 端口 key: `${instanceId}:${portId}` */
  hasError: boolean;
  hasWarning: boolean;
}

const worse = (current: Severity | undefined, next: Severity): Severity => {
  if (!current) return next;
  const weight: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return weight[next] < weight[current] ? next : current;
};

export const useDiagnosticIndex = (): DiagnosticIndex => {
  const result = useProjectStore(selectActiveResult);
  return useMemo(() => {
    const pin = new Map<string, Severity>();
    const instance = new Map<string, Severity>();
    const port = new Map<string, Severity>();
    const connection = new Map<string, Severity>();
    let hasError = false;
    let hasWarning = false;

    for (const diagnostic of result?.diagnostics ?? []) {
      if (diagnostic.severity === 'error') hasError = true;
      if (diagnostic.severity === 'warning') hasWarning = true;
      for (const target of diagnostic.targets) {
        if (target.type === 'pin') pin.set(target.id, worse(pin.get(target.id), diagnostic.severity));
        if (target.type === 'instance')
          instance.set(target.id, worse(instance.get(target.id), diagnostic.severity));
        if (target.type === 'port')
          port.set(target.id, worse(port.get(target.id), diagnostic.severity));
        if (target.type === 'connection')
          connection.set(target.id, worse(connection.get(target.id), diagnostic.severity));
      }
    }

    return { pin, instance, port, connection, hasError, hasWarning };
  }, [result]);
};
