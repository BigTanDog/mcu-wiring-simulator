/**
 * 诊断分组（Q-T5 决策，M-06 体验补齐）。
 *
 * 背景：原方案设想"按引脚聚合"，但实测（综合实验项目 26 组件 / 59 连线）显示
 * —— 诊断**没有**同引脚重复，真正的冗余是"同一条规则的**多处命中**"：
 *   R-16 启动敏感引脚 ×5、R-17 UART0 占用 ×2 …
 * 未接线的半成品项目更极端：R-01 会为每个未连接端口各产出一条。
 *
 * 因此按**规则码**分组：同规则的多处命中折叠成一行（标题 + N 处），展开看详情；
 * 单条命中的组在界面上直接平铺，不引入多余点击。
 */
import type { Diagnostic, Severity } from '@sim/contracts';
import { ruleDocOf } from '@sim/rule-engine';

export interface DiagnosticGroup {
  code: string;
  /** 组内最高严重度（决定配色与排序） */
  severity: Severity;
  /** 规则标题（取自规则说明；缺失时回退为规则码） */
  title: string;
  items: Diagnostic[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

export const severityWeight = (severity: Severity): number => SEVERITY_WEIGHT[severity];

/**
 * 分组规则：
 *  - 按规则码聚合，组内保持引擎产出顺序（与页面上"第一个错在哪"的直觉一致）；
 *  - 组间排序：错误 > 警告 > 提示，同权重按规则码升序（保证顺序稳定可测）。
 */
export const groupDiagnostics = (diagnostics: Diagnostic[]): DiagnosticGroup[] => {
  const groups = new Map<string, DiagnosticGroup>();

  for (const item of diagnostics) {
    const existing = groups.get(item.code);
    if (existing) {
      existing.items.push(item);
      if (SEVERITY_WEIGHT[item.severity] > SEVERITY_WEIGHT[existing.severity]) {
        existing.severity = item.severity;
      }
      continue;
    }
    groups.set(item.code, {
      code: item.code,
      severity: item.severity,
      title: ruleDocOf(item.code)?.title ?? item.code,
      items: [item],
    });
  }

  return [...groups.values()].sort((a, b) => {
    const bySeverity = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    return bySeverity !== 0 ? bySeverity : a.code.localeCompare(b.code);
  });
};
