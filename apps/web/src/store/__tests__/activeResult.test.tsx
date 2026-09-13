// @vitest-environment jsdom
/**
 * 回归测试：校验结果 selector 的引用稳定性
 *
 * 背景（已在真实浏览器复现的白屏缺陷）：
 * zustand v5 直接使用 React 原生 useSyncExternalStore，其 getSnapshot 必须返回
 * 稳定引用；若 selector 每次都返回新对象（如 `{ ...localResult, offline: true }`），
 * React 会持续判定"快照已变化"并强制重渲染，最终 "Maximum update depth exceeded" → 白屏。
 * 触发条件：点击「运行」后 localResult 已写入、serverResult 尚未返回的中间态。
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationResult } from '../../definitions/types';
import { useActiveResult, useProjectStore } from '../useProjectStore';

const localResult: ValidationResult = {
  status: 'failed',
  ruleSetVersion: 'rules-test',
  diagnostics: [],
  durationMs: 1.2,
  source: 'local',
};

const serverResult: ValidationResult = {
  status: 'passed',
  ruleSetVersion: 'rules-test',
  diagnostics: [],
  durationMs: 8.5,
  source: 'server',
};

describe('useActiveResult 引用稳定性（白屏缺陷根因）', () => {
  beforeEach(() => {
    useProjectStore.setState({ serverResult: null, localResult: null });
  });

  it('同一 state 下多次渲染必须返回同一引用', () => {
    const { result, rerender } = renderHook(() => useActiveResult());
    expect(result.current).toBeNull();

    act(() => {
      useProjectStore.setState({ serverResult: null, localResult });
    });

    const first = result.current;
    expect(first?.offline).toBe(true);

    rerender();
    expect(result.current).toBe(first);

    rerender();
    expect(result.current).toBe(first);
  });

  it('后端结果存在时优先返回后端结果，且不带 offline 标记', () => {
    act(() => {
      useProjectStore.setState({ serverResult, localResult });
    });
    const { result } = renderHook(() => useActiveResult());
    expect(result.current?.source).toBe('server');
    expect(result.current?.offline).toBeUndefined();
  });

  it('仅本地结果时标注离线（本地规则集可能过期）', () => {
    act(() => {
      useProjectStore.setState({ serverResult: null, localResult });
    });
    const { result } = renderHook(() => useActiveResult());
    expect(result.current?.source).toBe('local');
    expect(result.current?.offline).toBe(true);
    expect(result.current?.ruleSetVersion).toBe('rules-test');
  });
});
