/**
 * 诊断分组（Q-T5）：同规则的多处命中折叠为一组，组间按严重度排序。
 */
import type { Diagnostic } from '@sim/contracts';
import { describe, expect, it } from 'vitest';
import { groupDiagnostics } from '../diagGroups';

const diag = (code: string, severity: Diagnostic['severity'], message: string): Diagnostic => ({
  code,
  severity,
  message,
  targets: [],
});

describe('诊断分组（按规则码聚合）', () => {
  it('空列表 → 空分组', () => {
    expect(groupDiagnostics([])).toEqual([]);
  });

  it('同一规则的多处命中合并为一组，组内保持原顺序', () => {
    const groups = groupDiagnostics([
      diag('R-16', 'warning', 'GPIO0 是启动敏感引脚'),
      diag('R-16', 'warning', 'GPIO12 是启动敏感引脚'),
      diag('R-16', 'warning', 'GPIO15 是启动敏感引脚'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].code).toBe('R-16');
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].items.map((item) => item.message)).toEqual([
      'GPIO0 是启动敏感引脚',
      'GPIO12 是启动敏感引脚',
      'GPIO15 是启动敏感引脚',
    ]);
  });

  it('组严重度取组内最高（同规则可因配置不同而不同）', () => {
    const groups = groupDiagnostics([
      diag('R-12', 'warning', '第一条'),
      diag('R-12', 'error', '第二条'),
    ]);
    expect(groups[0].severity).toBe('error');
  });

  it('组间排序：错误 > 警告 > 提示，同权重按规则码升序', () => {
    const groups = groupDiagnostics([
      diag('R-17', 'warning', 'w1'),
      diag('R-01', 'error', 'e1'),
      diag('R-16', 'warning', 'w2'),
      diag('R-05', 'info', 'i1'),
      diag('R-03', 'error', 'e2'),
    ]);
    expect(groups.map((group) => group.code)).toEqual(['R-01', 'R-03', 'R-16', 'R-17', 'R-05']);
    expect(groups.map((group) => group.severity)).toEqual([
      'error',
      'error',
      'warning',
      'warning',
      'info',
    ]);
  });

  it('组标题取自规则说明（含代码时回退为代码）', () => {
    const groups = groupDiagnostics([
      diag('R-16', 'warning', 'a'),
      diag('R-XX-UNKNOWN', 'warning', 'b'),
    ]);
    expect(groups[0].title).toBe('占用启动敏感（Strapping）引脚');
    expect(groups[1].title).toBe('R-XX-UNKNOWN');
  });

  it('单条命中的规则同样成组（界面上平铺展示）', () => {
    const groups = groupDiagnostics([diag('R-15', 'warning', '舵机由板载供电')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });
});
