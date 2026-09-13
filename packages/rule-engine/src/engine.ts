/**
 * 校验编排：装配规则集 → 执行 → 稳定排序 → 判定状态
 *
 * 设计约束（docs/技术设计文档.md §6.1/§6.4）：
 *  - 纯函数：无 IO、无随机、无时间依赖（除耗时统计）；
 *  - 稳定输出：同输入诊断集合与顺序完全一致（排序键 severity → code → 首个 target.id）；
 *  - 规则集版本可复现：由规则集合内容哈希得出，前后端算法一致；
 *  - 支持 RuleConfig 启停与严重度覆盖（后端可热配置，无需发版）。
 */
import type {
  BoardDef,
  ComponentDef,
  ComponentInstance,
  Connection,
  Diagnostic,
  RuleConfig,
  RuleMeta,
  RuleSetInfo,
  Severity,
  ValidationResult,
  ValidationStatus,
} from '@sim/contracts';
import { buildNets } from './nets';
import { RULES, type Rule, type RuleInput } from './rules';

/** 规则集版本：规则集合（码 + 名称 + 默认严重度）的 FNV-1a 哈希 */
export const computeRuleSetVersion = (rules: Rule[]): string => {
  const payload = rules
    .map((rule) => `${rule.meta.code}:${rule.meta.name}:${rule.meta.severity}`)
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rules-${(hash >>> 0).toString(36)}`;
};

export const RULE_SET_VERSION = computeRuleSetVersion(RULES);

/** 规则集元数据（供 GET /api/v1/rule-sets/latest） */
export const getRuleSetInfo = (ruleConfigs: RuleConfig[] = []): RuleSetInfo => {
  const configs = new Map(ruleConfigs.map((config) => [config.code, config]));
  return {
    version: RULE_SET_VERSION,
    rules: RULES.map<RuleMeta>((rule) => {
      const config = configs.get(rule.meta.code);
      return {
        ...rule.meta,
        severity: config?.severityOverride ?? rule.meta.severity,
        enabled: config?.enabled ?? true,
      };
    }),
  };
};

export interface ValidateArgs {
  board: BoardDef;
  instances: ComponentInstance[];
  connections: Connection[];
  /** 组件定义表（由调用方注入，保持引擎与定义来源解耦 —— D-04） */
  defs: ComponentDef[];
  options?: {
    wifiEnabled?: boolean;
    mode?: 'strict' | 'loose';
    ruleConfigs?: RuleConfig[];
  };
}

const severityWeight: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const sortDiagnostics = (list: Diagnostic[]): Diagnostic[] =>
  [...list].sort((a, b) => {
    const bySeverity = severityWeight[a.severity] - severityWeight[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byCode = a.code.localeCompare(b.code);
    if (byCode !== 0) return byCode;
    return (a.targets[0]?.id ?? '').localeCompare(b.targets[0]?.id ?? '');
  });

export const validateProject = ({
  board,
  instances,
  connections,
  defs: defList,
  options,
}: ValidateArgs): ValidationResult => {
  // 使用 Date.now()：引擎需在 Node 与浏览器两端运行且不依赖宿主计时 API
  const startedAt = Date.now();
  const defs = new Map(defList.map((def) => [def.slug, def]));
  const enabledConnections = connections.filter((conn) => conn.enabled);

  const input: RuleInput = {
    board,
    instances,
    connections: enabledConnections,
    nets: buildNets(board, instances, enabledConnections, defs),
    defs,
    options: { wifiEnabled: options?.wifiEnabled ?? false },
  };

  const configs = new Map((options?.ruleConfigs ?? []).map((config) => [config.code, config]));
  const collected: Diagnostic[] = [];

  for (const rule of RULES) {
    const config = configs.get(rule.meta.code);
    if (config?.enabled === false) continue;
    const severity = config?.severityOverride ?? rule.meta.severity;
    for (const item of rule.run(input)) {
      collected.push(item.severity === severity ? item : { ...item, severity });
    }
  }

  const diagnostics = sortDiagnostics(collected);
  const hasError = diagnostics.some((item) => item.severity === 'error');
  const hasWarning = diagnostics.some((item) => item.severity === 'warning');
  const strict = options?.mode === 'strict';
  const status: ValidationStatus = hasError
    ? 'failed'
    : hasWarning && strict
      ? 'failed'
      : hasWarning
        ? 'warning'
        : 'passed';

  return {
    status,
    ruleSetVersion: RULE_SET_VERSION,
    diagnostics,
    durationMs: Date.now() - startedAt,
    source: 'local',
  };
};
